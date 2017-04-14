#!/usr/bin/env node
'use strict';

/**
 * @file
 * HTML to JS templating.
 */
var sc = module.exports = {

  helpers: {
      '_partial' : function (partialName, options) {
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
      'escape': function (context, options) {
          if (typeof context !== 'string') {
              throw new Error('Template7: Passed context to "escape" helper should be a string');
          }
          return _escape(context);
      },
      if: {
        process: (ctx, block, returns, functions) => {
          var inverse = block.contextName.toString().substring(0, 1) == '!';
          block.contextName = inverse ? block.contextName.toString().substring(1) : block.contextName;
          var content = inverse ? block.inverseContent : block.content;
          var inverseContent = inverse ? block.content : block.inverseContent;
          returns.push(
            '('
            + (inverse ? '!' : '')
            + ctx + '.' + block.contextName + '?'
            + sc.compile(content, functions, null, ctx, block) + ':'
            + sc.compile(inverseContent, functions, null, ctx, block)
            + ')'
          );
          console.log(returns);
        },
      },
      // Iterate array.
      for: {
        process: (ctx, block, returns, functions) => {
            //             reps = {};
            // reps[helper.contextName[2]] = 'a';
            // reps[helper.contextName[0]] = 'k';
            // block.contextName = tpl.varReplace(block.contextName, reps);
            console.log(block);

          var forFunc = block.contextName[1] == 'in' ? sc.helpers.for.forIn : sc.helpers.for.forOf;
          returns.push(
            'this.' + forFunc.abbrv + '('
            + ctx + '.' + block.contextName[2] + ','
            + JSON.stringify(sc.compile(block.content, functions, null, forFunc.ctx, block)) + ','
            + JSON.stringify(sc.compile(block.inverseContent, functions, null, forFunc.ctx, block))
            + ')'
          );
          functions[forFunc.abbrv] = forFunc.func();
        },
        forOf: {
          abbrv: '_fo',
          func: () => {
            return eval('(function(a,c,d){let r=\'\';if(a.length){for(let k of a)r+=eval(c);}else{r+=d;}return r})');
          },
          ctx: 'k',
        },
        forIn: {
          abbrv: '_fi',
          func: () => {
            return eval('(function(a,c,d){let r=\'\';if(a.length){for(let k in a)r+=eval(c);}else{r+=d;}return r})');
          },
          ctx: 'k',
        },
        blockAlter: function(helper, block) {
          if (block.type == 'variable') {
            reps = {};
            reps[helper.contextName[2]] = 'a';
            reps[helper.contextName[0]] = 'k';
            block.contextName = sc.varReplace(block.contextName, reps);
          }
        },
      },
      'with': function (context, options) {
          if (isFunction(context)) { context = context.call(this); }
          return options.fn(context);
      },
      'join': function (context, options) {
          if (isFunction(context)) { context = context.call(this); }
          return context.join(options.hash.delimiter || options.hash.delimeter);
      },
      'js': function (expression, options) {
          var func;
          if (expression.indexOf('return')>=0) {
              func = '(function(){'+expression+'})';
          }
          else {
              func = '(function(){return ('+expression+')})';
          }
          return eval.call(this, func).call(this);
      },
      'js_compare': function (expression, options) {
          var func;
          if (expression.indexOf('return')>=0) {
              func = '(function(){'+expression+'})';
          }
          else {
              func = '(function(){return ('+expression+')})';
          }
          var condition = eval.call(this, func).call(this);
          if (condition) {
              return options.fn(this, options.data);
          }
          else {
              return options.inverse(this, options.data);
          }
      }
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
      }

      // Remove extra whitespace.
      htmlTpl = htmlTpl.replace(/\s\s+/g, ' ');

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
              returns.push((helper ? '' : '\'') + (block.content)
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n')
                .replace(/'/g, '\\' + '\'') + (helper ? '' : '\''));
              continue;
          }

          // Variable block
          if (block.type == 'variable') {
            returns.push((!helper ? ctx + '.' : '') + block.contextName);
          }

          // Helpers block
          if (block.type === 'helper') {
              if (block.helperName in sc.helpers) {
                  //compiledArguments = tpl.getCompiledArguments(block.contextName);

                  //if (!helperTrack[block.helperName]) helperTrack[block.helperName] = '';
                  sc.helpers[block.helperName].process(ctx, block, returns, functions);
              }
              else {
                throw new Error('Missing helper: "' + block.helperName + '"');
              }
          }
      }

      if (helper) {
        statements.push('\'' + returns.join('+') + '\'');
        return statements.join(';');
      }
      else {
        statements.push('return' + returns.join('+'));
        functions[name] = eval('(function(' + ctx + '){' + statements.join(';') + '})');
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
                          depth ++;
                      }
                      if (_blocks[j].indexOf('{/') >= 0) {
                          depth --;
                      }
                      if (_blocks[j].indexOf('{#' + helperName) >= 0) {
                          helperContent += _blocks[j];
                          if (foundElse) elseContent += _blocks[j];
                          toSkip ++;
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

  // getCompiledArguments: (contextArray) => {
  //     var arr = [];
  //     for (var i = 0; i < contextArray.length; i++) {
  //         if (/^['"]/.test(contextArray[i])) arr.push(contextArray[i]);
  //         else if (/^(true|false|\d+)$/.test(contextArray[i])) arr.push(contextArray[i]);
  //         else {
  //             arr.push(tpl.getCompileVar(contextArray[i]));
  //         }
  //     }

  //     return arr.join(', ');
  // },

  getCompileVar: (inp) => {
    console.log("getCompileVar got:"+inp);
  },


  helperToSlices: (string) => {
        var helperParts = string.replace(/[{}#}]/g, '').split(' ');
        var slices = [];
        var shiftIndex, i, j;
        for (i = 0; i < helperParts.length; i++) {
            var part = helperParts[i];
            var blockQuoteRegExp, openingQuote;
            if (i === 0) slices.push(part);
            else {
                if (part.indexOf('"') === 0 || part.indexOf('\'') === 0) {
                    blockQuoteRegExp = part.indexOf('"') === 0 ? quoteDoubleRexExp : quoteSingleRexExp;
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
                            blockQuoteRegExp = hashContent.indexOf('"') === 0 ? quoteDoubleRexExp : quoteSingleRexExp;
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
                        var hash = [hashName, hashContent.replace(blockQuoteRegExp,'')];
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