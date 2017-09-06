'use strict'

var fs = require('fs')
var path = require('path')
var gUtil = require('gulp-util')
var cheerio = require('cheerio')
var through = require('through2')
var Selector = require('./Selector')
var PLUGIN_NAME = require('./package.json').name

if (!Buffer.from) {
  Buffer.from = function (arg) {
    return new Buffer(arg)
  }
}

if (!Array.from) {
  Array.from = function (arg) {
    for (var i = 0, arr = [], length = arg.length; i < length; ++i) {
      arr[i] = arg[i]
    }
    return arr
  }
}

var log = gUtil.log
var PluginError = gUtil.PluginError

var readFileOpts = {
  flag: 'r',
  encoding: null
}

function fileExists (path, mode) {
  return new Promise(function fileExistsExecutor (resolve) {
    fs.access(path, mode, function (err) {
      resolve(!err)
    })
  })
}

function readFile (path) {
  return new Promise(function readFileContent (resolve, reject) {
    fs.readFile(path, readFileOpts, function (err, data) {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

function genVinylFileObj (cwd, base, filePath) {
  filePath = path.join(base, filePath)
  return fileExists(filePath, fs.constants.R_OK)
    .then(function (exists) {
      if (!exists) {
        log('File: ' + filePath + " isn't accessible")
        return null
      }

      return readFile(filePath).catch(function () {
        log("Couldn't read file: " + filePath)
        return null
      })
    })
    .then(function toVinyl (data) {
      if (!data) return null

      return new gUtil.File({
        cwd: cwd,
        base: base,
        path: filePath,
        contents: data
      })
    })
}

function parseSelectorArguments (selectors) {
  if (selectors instanceof Selector) {
    if (arguments.length > 1) {
      return parseSelectorArguments(Array.from(arguments))
    }
    return [selectors]
  } else if (Selector.isSelectorArray(selectors)) {
    return selectors
  } else if (typeof selectors === 'string') {
    return parseSelectorArguments(
      new Selector(arguments[0], arguments[1], arguments[2])
    )
  }

  throw new PluginError(
    PLUGIN_NAME,
    'Argument must be a selector or selector array'
  )
}

module.exports = function retriever () {
  var selectors = parseSelectorArguments.apply(null, arguments)
  var length = selectors.length

  return through.obj(function (file, enc, cb) {
    var i, root, gulp, files
    gulp = this

    if (file.isStream()) {
      return cb(new PluginError(PLUGIN_NAME, 'Streams are not supported!'))
    }

    if (file.isBuffer()) {
      root = cheerio.load(file.contents)
      files = []
      for (i = 0; i < length; ++i) {
        files = files.concat(selectors[i].retrieveIn(root))
      }

      return Promise.all(
        files.map(genVinylFileObj.bind(null, file.cwd, file.base))
      )
        .then(function (files) {
          var i, length
          for (i = 0, length = files.length; i < length; ++i) {
            if (files[i]) gulp.push(files[i])
          }
          cb()
        })
        .catch(function (error) {
          cb(new PluginError(PLUGIN_NAME, error, { showStack: true }))
        })
    }

    gulp.push(file)
    cb()
  })
}

module.exports.Selector = Selector
