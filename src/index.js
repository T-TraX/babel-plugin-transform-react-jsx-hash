import { declare } from "@babel/helper-plugin-utils";
import { types as t } from "@babel/core";
import path from "path";
import fs from "fs";
import uuid from "uuid";

const TRACE_ID = "__i18n";
const FILE_HASH_VAR = "_jsxFileHash";

function _generateHashes(srcPath, pathToHash, prefix) {
  const pathToHashes = path.join(srcPath, pathToHash);
  const hashes = fs.existsSync(pathToHashes)
    ? JSON.parse(fs.readFileSync(pathToHashes))
    : {};
  function recFindByExt(base, ext, files, result) {
    files = files || fs.readdirSync(base);
    result = result || [];

    files.forEach(function(file) {
      const newbase = path.join(base, file);
      if (fs.statSync(newbase).isDirectory()) {
        result = recFindByExt(newbase, ext, fs.readdirSync(newbase), result);
      } else {
        if (file.substr(-1 * (ext.length + 1)) == "." + ext) {
          result.push(newbase);
        }
      }
    });
    return result;
  }
  const hashList = {};
  const extFileList = recFindByExt(srcPath, "jsx");
  for (const file of extFileList) {
    const key = prefix + "/" + file;
    hashList[key] = !hashes[key] ? uuid() : hashes[key];
  }
  fs.writeFile(
    path.join(srcPath, pathToHash),
    JSON.stringify(hashList),
    function(err) {
      console.log(err);
    }
  );
  return hashList;
}

export default declare((api, opts) => {
  api.assertVersion(7);
  const hashes = _generateHashes(opts.srcPath, opts.pathToHash, opts.prefix);

  function makeTrace(fileHashIdentifier) {
    const fileHashProperty = t.objectProperty(
      t.identifier("fileHash"),
      fileHashIdentifier
    );
    return t.objectExpression([fileHashProperty]);
  }

  const visitor = {
    JSXOpeningElement(path, state) {
      const id = t.jsxIdentifier(TRACE_ID);
      const location = path.container.openingElement.loc;
      if (!location) {
        // the element was generated and doesn't have location information
        return;
      }

      const attributes = path.container.openingElement.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const name = attributes[i].name;
        if (name && name.name === TRACE_ID) {
          // The __i18n attibute already exists
          return;
        }
      }

      const fileName = state.filename || "";
      const fileNameKey = state.opts.prefix + fileName.replace(state.cwd, "");
      const hash = hashes[fileNameKey];
      if(!hash)
        return;


      if (!state.fileHashIdentifier) {
        const fileHashIdentifier = path.scope.generateUidIdentifier(
          FILE_HASH_VAR
        );
        const scope = path.hub.getScope();
        if (scope) {
          scope.push({
            id: fileHashIdentifier,
            init: t.stringLiteral(hash)
          });
        }
        state.fileHashIdentifier = fileHashIdentifier;
      }

      const trace = makeTrace(state.fileHashIdentifier, location.start.line);
      attributes.push(t.jsxAttribute(id, t.jsxExpressionContainer(trace)));
    }
  };

  return {
    name: "babel-plugin-transform-react-jsx-hash",
    visitor
  };
});
