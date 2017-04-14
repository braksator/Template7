'use strict';

var fs = require('fs');
var chai = require('chai');
chai.use(require('chai-fs'));
var expect = chai.expect;
var assert = chai.assert;
var sc = require('../index');
var lint = require('mocha-eslint');

// Linting paths.
var paths = [
    'index.js',
    'test/test.js'
];

// Linting options.
var options = {
    // Specify style of output
    formatter: 'compact',  // Defaults to `stylish`

    // Only display warnings if a test is failing
    alwaysWarn: false,  // Defaults to `true`, always show warnings

    // Increase the timeout of the test if linting takes to long
    timeout: 5000,  // Defaults to the global mocha `timeout` option

    // Increase the time until a test is marked as slow
    slow: 1000,  // Defaults to the global mocha `slow` option

    // Consider linting warnings as errors and return failure
    strict: true  // Defaults to `false`, only notify the warnings
};

// Run the lint.
lint(paths, options);

var debugFuncs = (funcs) => {
  for (let func in funcs) {
    console.log(func + ":" + funcs[func].toString());
  }
};

// Tests
describe('Compile', function () {
  it('should handle if-statement', function () {
    var tpl = '\
      <a href="#"{#if active} class="active"{/if}>{title}</a>\
    ';
    var data = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal(' <a href="#" class="active">Link</a> ');
  });

  it('should handle if-statement with else expression', function () {
    var tpl = '\
      <p>Hello, my name is {name}.</p>\
      {#if hobby}\
      <p>I have hobby</p>\
      {else}\
      <p>I don\'t have hobby</p>\
      {/if}\
    ';
    var data = {
      name: 'John Doe',
      hobby: false
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal(' <p>Hello, my name is John Doe.</p>  <p>I don\'t have hobby</p>  ');
  });

});
