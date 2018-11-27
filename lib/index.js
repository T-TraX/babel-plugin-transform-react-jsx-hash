"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _uuid = _interopRequireDefault(require("uuid"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TRACE_ID = "__i18n";
var FILE_HASH_VAR = "_jsxFileHash";

function _generateHashes(srcPath, pathToHash, prefix) {
  var pathToHashes = _path.default.join(srcPath, pathToHash);

  var hashes = _fs.default.existsSync(pathToHashes) ? JSON.parse(_fs.default.readFileSync(pathToHashes)) : {};

  function recFindByExt(base, ext, files, result) {
    files = files || _fs.default.readdirSync(base);
    result = result || [];
    files.forEach(function (file) {
      var newbase = _path.default.join(base, file);

      if (_fs.default.statSync(newbase).isDirectory()) {
        result = recFindByExt(newbase, ext, _fs.default.readdirSync(newbase), result);
      } else {
        if (file.substr(-1 * (ext.length + 1)) == "." + ext) {
          result.push(newbase);
        }
      }
    });
    return result;
  }

  var hashList = {};
  var extFileList = recFindByExt(srcPath, "jsx");
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = extFileList[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var file = _step.value;
      var key = prefix + "/" + file;
      hashList[key] = !hashes[key] ? (0, _uuid.default)() : hashes[key];
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return != null) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  _fs.default.writeFile(_path.default.join(srcPath, pathToHash), JSON.stringify(hashList), function (err) {
    console.log(err);
  });

  return hashList;
}

var _default = (0, _helperPluginUtils.declare)(function (api, opts) {
  api.assertVersion(7);

  var hashes = _generateHashes(opts.srcPath, opts.pathToHash, opts.prefix);

  function makeTrace(fileHashIdentifier) {
    var fileHashProperty = _core.types.objectProperty(_core.types.identifier("fileHash"), fileHashIdentifier);

    return _core.types.objectExpression([fileHashProperty]);
  }

  var visitor = {
    JSXOpeningElement: function JSXOpeningElement(path, state) {
      var id = _core.types.jsxIdentifier(TRACE_ID);

      var location = path.container.openingElement.loc;

      if (!location) {
        // the element was generated and doesn't have location information
        return;
      }

      var attributes = path.container.openingElement.attributes;

      for (var i = 0; i < attributes.length; i++) {
        var name = attributes[i].name;

        if (name && name.name === TRACE_ID) {
          // The __i18n attibute already exists
          return;
        }
      }

      var fileName = state.filename || "";
      var fileNameKey = state.opts.prefix + fileName.replace(state.cwd, "");
      var hash = hashes[fileNameKey];
      if (!hash) return;

      if (!state.fileHashIdentifier) {
        var fileHashIdentifier = path.scope.generateUidIdentifier(FILE_HASH_VAR);
        var scope = path.hub.getScope();

        if (scope) {
          scope.push({
            id: fileHashIdentifier,
            init: _core.types.stringLiteral(hash)
          });
        }

        state.fileHashIdentifier = fileHashIdentifier;
      }

      var trace = makeTrace(state.fileHashIdentifier, location.start.line);
      attributes.push(_core.types.jsxAttribute(id, _core.types.jsxExpressionContainer(trace)));
    }
  };
  return {
    name: "babel-plugin-transform-react-jsx-hash",
    visitor: visitor
  };
});

exports.default = _default;