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

  jsPerm: true,
  state: false,

  options: {
    esprima: {},
    jsmin: {},
    htmlmin: {ignoreCustomFragments: [ /\{\{[\s\S]*?\}\}/ ]}
  },

  helpers: {
    partial: {
      process: (ctx, block, returns, functions, report) => {
        var arg = block.contextName[1] ? ctx + '.' + block.contextName[1] : 'p';
        if (sc.state) {
          arg = 'Object.assign(' + arg + ',{' + sc.state + ':' + ctx + '.' + sc.state + '})';
        }
        returns.push('this.' + block.contextName[0] + '(' + arg + ')');
        if (!functions[block.contextName[0]]) {
          if (!report.missing) {
            report.missing = [];
          }
          report.missing.push(block.contextName[0]);
        }
      }
    },
    escape: {
      process: (ctx, block, returns, functions, report) => {
        returns.push('this._es(' + ctx + '.' + block.contextName + ')');
        functions['_es'] = eval(
          '(function(c){return c.replace(/&/g, "&amp;")'
          + '.replace(/</g, "&lt;").replace(/>/g, "&gt;").'
          + 'replace(/"/g, "&quot;")})'
        );
      }
    },
    if: {
      process: (ctx, block, returns, functions, report) => {
        var inverse = block.contextName.toString().substring(0, 1) == '!';
        block.contextName = inverse ? block.contextName.toString().substring(1) : block.contextName;
        returns.push(
          '('
          + (inverse ? '!' : '')
          + (ctx ? ctx + '.' : '') + block.contextName + '?'
          + (sc.compile(block.content, functions, null, report, ctx, block) || "''") + ':'
          + (sc.compile(block.inverseContent, functions, null, report, ctx, block) || "''")
          + ')'
        );
      },
    },
    for: {
      process: (ctx, block, returns, functions, report) => {
        var forFunc = block.contextName[1] == 'in' ? sc.helpers.for.forIn : sc.helpers.for.forOf;
        returns.push(
          'this.' + forFunc.abbrv + '('
          + (ctx ? ctx + '.' : '') + block.contextName[2] + ','
          + JSON.stringify(sc.compile(block.content, functions, null, report, 'k', block)) + ','
          + JSON.stringify(sc.compile(block.inverseContent, functions, null, report, 'k', block))
          + ')'
        );
        functions[forFunc.abbrv] = forFunc.func();
      },
      forOf: {
        abbrv: '_fo',
        func: () => {
          return eval('(function(a,c,d){let r=\'\';if(a&&a.length){for(let k of a)r+=eval(c);}else{r+=eval(d);}return r})');
        },
      },
      forIn: {
        abbrv: '_fi',
        func: () => {
          return eval('(function(a,c,d){let r=\'\';if(a&&Object.keys(a).length){for(let k in a)r+=eval(c);}else{r+=eval(d);}return r})');
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
      process: (ctx, block, returns, functions, report) => {
        if (sc.jsPerm) {
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
        }
        else {
          report.jsSkipped = true;
        }

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

  compile: (htmlTpl, functions, name, report, ctx, helper) => {
    if (typeof htmlTpl !== 'string') {
      throw new Error('Invalid template');
    }
    if (!helper) {
      ctx = ctx ? ctx + '.p' : 'p';

      // Remove extra whitespace.
      htmlTpl = htmlTpl.trim().replace(/\s\s+/g, ' ').replace(/> </, '><');
    }
    if (!report) report = {};

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
          let oldCtx = ctx;
          if (block.contextName[0].substring(0,3) == 'js('
           && block.contextName[contextNameLast].substring(block.contextName[contextNameLast].length - 1) == ')') {
            block.contextName[0] = block.contextName[0].substring(3);
            block.contextName[contextNameLast] =
              block.contextName[contextNameLast].substring(0, block.contextName[contextNameLast].length - 1);
            let jsret = [];
            sc.helpers.js.process(ctx, block, jsret, null, report);
            block.contextName = jsret[0];
            ctx = null;
          }
          sc.helpers[block.helperName].process(ctx, block, returns, functions, report);
          ctx = oldCtx;
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
    else if (name) {
      statements.push('return ' + returns.join('+'));
      functions[name] = eval('(function(' + ctx + '){' + statements.join(';').replace(/\s\s+/g, ' ') + '})');
      var missingIndex = report.missing ? report.missing.indexOf(name) : -1;
      if (missingIndex > -1) {
        report.missing.splice(missingIndex, 1);
      }
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
        var helperName = helperSlices[0] === '>' ? 'partial' : helperSlices[0];
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
        else {
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
    var shiftIndex, i;
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
          // Plain variable
          slices.push(part);
        }
      }
    }
    return slices;
  }

};