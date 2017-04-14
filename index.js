#!/usr/bin/env node
'use strict';

/**
 * @file
 * HTML to JS templating.
 */

var esprima = require('esprima');
var jsmin = require('escompress');
var htmlmin = require('html-minifier').minify;

var sc = module.exports = {

  options: {
    esprima: {},
    jsmin: {},
    htmlmin: {ignoreCustomFragments: [ /\{\{[\s\S]*?\}\}/ ]}
  },

  helpers: {
    '_partial': function (partialName, options) {
      var p = Template7.prototype.partials[partialName];
      if (!p || (p && !p.template)) return '';
      if (!p.compiled) {
        p.compiled = new Template7(p.template).compile();
      }
      var ctx = this;
      for (var hashName in options.hash) {
        ctx[hashName] = options.hash[hashName];
      }
      return p.compiled(ctx, options.data, options.root);
    },
    escape: {
      process: (ctx, block, returns, functions) => {
        returns.push('this._es(' + ctx + '.' + block.contextName + ')');
        functions['_es'] = eval(
          '(function(c){return c.replace(/&/g, "&amp;")'
          + '.replace(/</g, "&lt;").replace(/>/g, "&gt;").'
          + 'replace(/"/g, "&quot;")})'
        );
      }
    },
    if: {
      process: (ctx, block, returns, functions) => {
        var inverse = block.contextName.toString().substring(0, 1) == '!';
        block.contextName = inverse ? block.contextName.toString().substring(1) : block.contextName;
        returns.push(
          '('
          + (inverse ? '!' : '')
          + (ctx ? ctx + '.' : '') + block.contextName + '?'
          + (sc.compile(block.content, functions, null, ctx, block) || "''") + ':'
          + (sc.compile(block.inverseContent, functions, null, ctx, block) || "''")
          + ')'
        );
      },
    },
    for: {
      process: (ctx, block, returns, functions) => {
        var forFunc = block.contextName[1] == 'in' ? sc.helpers.for.forIn : sc.helpers.for.forOf;
        returns.push(
          'this.' + forFunc.abbrv + '('
          + (ctx ? ctx + '.' : '') + block.contextName[2] + ','
          + JSON.stringify(sc.compile(block.content, functions, null, 'k', block)) + ','
          + JSON.stringify(sc.compile(block.inverseContent, functions, null, 'k', block))
          + ')'
        );
        functions[forFunc.abbrv] = forFunc.func();
      },
      forOf: {
        abbrv: '_fo',
        func: () => {
          return eval('(function(a,c,d){let r=\'\';if(a.length){for(let k of a)r+=eval(c);}else{r+=d;}return r})');
        },
      },
      forIn: {
        abbrv: '_fi',
        func: () => {
          return eval('(function(a,c,d){let r=\'\';if(a.length){for(let k in a)r+=eval(c);}else{r+=d;}return r})');
        },
      },
      blockAlter: function (helper, block) {
        if (block.type == 'variable') {
          var reps = {};
          reps[helper.contextName[2]] = 'a';
          reps[helper.contextName[0]] = 'k';
          block.contextName = sc.varReplace(block.contextName, reps);
        }
      },
    },
    js: {
      process: (ctx, block, returns, functions) => {
        var parsed = esprima.tokenize(block.contextName.join(' '), sc.options.esprima);
        var jsCode = [];
        var newVars = [];
        for (var i = 0; i < parsed.length; ++i) {
          let isVar = parsed[i].type == 'Identifier';
          let declares = ['let', 'var'];
          if (isVar && i > 0 && declares.indexOf(parsed[i - 1].value) > -1) {
            newVars.push(parsed[i].value);
          }
          jsCode.push((isVar && newVars.indexOf(parsed[i].value) == -1 ? ctx + '.' : '') + parsed[i].value);
        }
        let minifiedJsCode = jsmin.transform(jsCode.join(' '), sc.options.jsmin);
        returns.push('eval(\'' + minifiedJsCode.code.replace(/'/, "\'") + '\')');
      },
    },
  },

  varReplace: (varName, reps) => {
    for (let find in reps) {
      let re = new RegExp('\\b' + find + '\\b', 'gi');
      varName = varName.replace(re, reps[find]);
    }
    return varName;
  },

  compile: (htmlTpl, functions, name, ctx, helper) => {
    if (typeof htmlTpl !== 'string') {
      throw new Error('Invalid template');
    }
    if (!helper) {
      ctx = ctx ? ctx + '.p' : 'p';

      // Remove extra whitespace.
      htmlTpl = htmlTpl.trim().replace(/\s\s+/g, ' ').replace(/> </, '><');
    }

    var blocks = sc.stringToBlocks(htmlTpl);
    var statements = [];
    var returns = [];
    var resultString = '';
    for (let block of blocks) {

      // If this is a helper recurrence allow the helper to alter the block.
      if (helper) {
        var alterFunc = sc.helpers[helper.helperName].blockAlter;
        if (alterFunc) {
          alterFunc(helper, block);
        }
      }

      // Plain block
      if (block.type == 'plain') {
        returns.push('\'' + block.content
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n')
          .replace(/'/g, '\\' + '\'') + '\'');
        continue;
      }

      // Variable block
      if (block.type == 'variable') {
        returns.push((!helper ? ctx + '.' : '') + block.contextName);
      }

      // Helpers block
      if (block.type === 'helper') {
        if (block.helperName in sc.helpers) {
          let contextNameLast = block.contextName.length - 1;
          let oldctx = ctx;
          if (block.contextName[0].substring(0,3) == 'js('
           && block.contextName[contextNameLast].substring(block.contextName[contextNameLast].length - 1) == ')') {
            block.contextName[0] = block.contextName[0].substring(3);
            block.contextName[contextNameLast] =
              block.contextName[contextNameLast].substring(0, block.contextName[contextNameLast].length - 1);
            let jsret = [];
            sc.helpers.js.process(ctx, block, jsret, null);
            block.contextName = jsret[0];
            ctx = null;
          }
          sc.helpers[block.helperName].process(ctx, block, returns, functions);
          ctx = oldctx;
        }
        else {
          throw new Error('Missing helper: "' + block.helperName + '"');
        }
      }
    }

    if (helper) {
      statements.push( returns.join('+') );
      return statements.join(';');
    }
    else {
      statements.push('return ' + returns.join('+'));
      functions[name] = eval('(function(' + ctx + '){' + statements.join(';').replace(/\s\s+/g, ' ') + '})');
    }
  },


  stringToBlocks: (string) => {
    var blocks = [], i, j, k;
    if (!string) return [];
    var _blocks = string.split(/({[^{^}]*})/);
    for (i = 0; i < _blocks.length; i++) {
      var block = _blocks[i];
      if (block === '') continue;
      if (block.indexOf('{') < 0) {
        blocks.push({
          type: 'plain',
          content: block
        });
      }
      else {
        if (block.indexOf('{/') >= 0) {
          continue;
        }
        if (block.indexOf('{#') < 0 && block.indexOf(' ') < 0 && block.indexOf('else') < 0) {
          // Simple variable
          blocks.push({
            type: 'variable',
            contextName: block.replace(/[{}]/g, '')
          });
          continue;
        }
        // Helpers
        var helperSlices = sc.helperToSlices(block);
        var helperName = helperSlices[0];
        var isPartial = helperName === '>';
        var helperContext = [];
        var helperHash = {};
        for (j = 1; j < helperSlices.length; j++) {
          var slice = helperSlices[j];
          if (slice.constructor === Array) {
            // Hash
            helperHash[slice[0]] = slice[1] === 'false' ? false : slice[1];
          }
          else {
            helperContext.push(slice);
          }
        }

        if (block.indexOf('{#') >= 0) {
          // Condition/Helper
          var helperStartIndex = i;
          var helperContent = '';
          var elseContent = '';
          var toSkip = 0;
          var shiftIndex;
          var foundClosed = false, foundElse = false, foundClosedElse = false, depth = 0;
          for (j = i + 1; j < _blocks.length; j++) {
            if (_blocks[j].indexOf('{#') >= 0) {
              depth++;
            }
            if (_blocks[j].indexOf('{/') >= 0) {
              depth--;
            }
            if (_blocks[j].indexOf('{#' + helperName) >= 0) {
              helperContent += _blocks[j];
              if (foundElse) elseContent += _blocks[j];
              toSkip++;
            }
            else if (_blocks[j].indexOf('{/' + helperName) >= 0) {
              if (toSkip > 0) {
                toSkip--;
                helperContent += _blocks[j];
                if (foundElse) elseContent += _blocks[j];
              }
              else {
                shiftIndex = j;
                foundClosed = true;
                break;
              }
            }
            else if (_blocks[j].indexOf('else') >= 0 && depth === 0) {
              foundElse = true;
            }
            else {
              if (!foundElse) helperContent += _blocks[j];
              if (foundElse) elseContent += _blocks[j];
            }

          }
          if (foundClosed) {
            if (shiftIndex) i = shiftIndex;
            blocks.push({
              type: 'helper',
              helperName: helperName,
              contextName: helperContext,
              content: helperContent,
              inverseContent: elseContent,
              hash: helperHash
            });
          }
        }
        else if (block.indexOf(' ') > 0) {
          if (isPartial) {
            helperName = '_partial';
            if (helperContext[0]) helperContext[0] = '"' + helperContext[0].replace(/"|'/g, '') + '"';
          }
          blocks.push({
            type: 'helper',
            helperName: helperName,
            contextName: helperContext,
            hash: helperHash
          });
        }
      }
    }
    return blocks;
  },

  helperToSlices: (string) => {
    var helperParts = string.replace(/[{}#}]/g, '').split(' ');
    var slices = [];
    var shiftIndex, i, j;
    var quoteSingleRegExp = new RegExp('\'', 'g');
    var quoteDoubleRegExp = new RegExp('"', 'g');
    for (i = 0; i < helperParts.length; i++) {
      var part = helperParts[i];
      var blockQuoteRegExp, openingQuote;
      if (i === 0) slices.push(part);
      else {
        if (part.indexOf('"') === 0 || part.indexOf('\'') === 0) {
          blockQuoteRegExp = part.indexOf('"') === 0 ? quoteDoubleRegExp : quoteSingleRegExp;
          openingQuote = part.indexOf('"') === 0 ? '"' : '\'';
          // Plain String
          if (part.match(blockQuoteRegExp).length === 2) {
            // One word string
            slices.push(part);
          }
          else {
            // Find closed Index
            shiftIndex = 0;
            for (j = i + 1; j < helperParts.length; j++) {
              part += ' ' + helperParts[j];
              if (helperParts[j].indexOf(openingQuote) >= 0) {
                shiftIndex = j;
                slices.push(part);
                break;
              }
            }
            if (shiftIndex) i = shiftIndex;
          }
        }
        else {
          if (part.indexOf('=') > 0) {
            // Hash
            var hashParts = part.split('=');
            var hashName = hashParts[0];
            var hashContent = hashParts[1];
            if (!blockQuoteRegExp) {
              blockQuoteRegExp = hashContent.indexOf('"') === 0 ? quoteDoubleRegExp : quoteSingleRegExp;
              openingQuote = hashContent.indexOf('"') === 0 ? '"' : '\'';
            }
            if (hashContent.match(blockQuoteRegExp).length !== 2) {
              shiftIndex = 0;
              for (j = i + 1; j < helperParts.length; j++) {
                hashContent += ' ' + helperParts[j];
                if (helperParts[j].indexOf(openingQuote) >= 0) {
                  shiftIndex = j;
                  break;
                }
              }
              if (shiftIndex) i = shiftIndex;
            }
            var hash = [hashName, hashContent.replace(blockQuoteRegExp, '')];
            slices.push(hash);
          }
          else {
            // Plain variable
            slices.push(part);
          }
        }
      }
    }
    return slices;
  }

};