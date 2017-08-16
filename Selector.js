'use strict'

var path = require('path')
var cheerio = require('cheerio')

// Constants
var isArray = Array.isArray
var tagRegex = /^<(\S+)>$/
var TAG_DEFAULT = {
  a: ['href'],
  img: ['src'],
  link: ['href'],
  embed: ['src'],
  track: ['src'],
  video: ['src', '<source>', '<track>'],
  audio: ['src', '<source>', '<track>'],
  script: ['src'],
  source: ['src'],
  object: ['data']
}

function Selector (_tagName, _propName, _ext) {
  var ext = typeof _ext === 'string' ? _ext : ''
  var tagName = typeof _tagName === 'string' ? _tagName.toLowerCase() : ''
  var propName

  if (typeof _propName === 'string') {
    if (_propName.length > 0) {
      if (_ext === undefined && _propName[0] === '.') {
        ext = _propName
        propName = null
      } else {
        propName = [_propName]
      }
    }
  } else if (isArray(_propName)) {
    propName =
      _propName.length === 0
        ? null
        : _propName.map(function mapPropertiesArray (prop) {
          return prop instanceof Selector ? prop : prop + ''
        })
  }

  if (!tagName) throw new Error('Tag name is required')
  if (ext && (ext.length < 2 || ext[0] !== '.')) {
    throw new TypeError('Invalid extension type')
  }

  this.ext = ext || null
  this.tagName = tagName
  this.propName = propName || TAG_DEFAULT[tagName] || null
}

Selector.isSelectorArray = function isSelectorArray (arr) {
  if (!isArray(arr)) return false

  var length = arr.length
  while (--length >= 0 && arr[length] instanceof Selector) {}

  return length === 0
}

Selector.prototype = {
  retrieveIn: function retriveIn ($, fatherSelector, cb) {
    var ext = this.ext || (fatherSelector && fatherSelector.ext) || null
    var elements = $(this.tagName)
    var filePaths = []
    var elementsLength = elements.length
    for (var i = 0; i < elementsLength; ++i) {
      var element = $(elements[i])
      var propNames = this.propName
      var propNamesLength = propNames.length
      for (var j = 0; j < propNamesLength; ++j) {
        var propName = propNames[j]
        if (typeof propName === 'string') {
          var tempProp = tagRegex.exec(propName)

          if (tempProp === null) {
            tempProp = element.prop(propName)

            if (tempProp && (!ext || path.extname(tempProp) === ext)) {
              filePaths.push(
                typeof cb === 'function'
                  ? cb(element, propName, tempProp)
                  : tempProp
              )
              break
            }
          } else {
            tempProp = new Selector(tempProp[1]).retrieveIn(
              function (tagName) {
                return cheerio(tagName, elements)
              },
              this,
              cb
            )

            if (tempProp.length > 0) {
              filePaths.concat(tempProp)
              break
            }
          }
        } else {
          tempProp = propName.retrieveIn(
            function (tagName) {
              return cheerio(tagName, elements)
            },
            this,
            cb
          )

          if (tempProp.length > 0) {
            filePaths.concat(tempProp)
            break
          }
        }
      }
    }

    return filePaths
  }
}

module.exports = Selector
