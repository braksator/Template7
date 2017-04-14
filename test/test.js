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
  it('should handle variables', function () {
    var tpl = '\
      <div>{name}</div><div>{birthday.year}</div><div>{sizes}</div>\
    ';
    var data = {
      name: 'Bob',
      birthday: { year: 1960 },
      sizes: [ 'small', 'medium', 'large' ]
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<div>Bob</div><div>1960</div><div>small,medium,large</div>');
  });

  it('should escape HTML', function () {
    var tpl = '\
      <div>{escape value}</div>\
    ';
    var data = {
      value: '<this>" & is not"</html>'
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<div>&lt;this&gt;&quot; &amp; is not&quot;&lt;/html&gt;</div>');
  });

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
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<a href="#" class="active">Link</a>');
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
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<p>Hello, my name is John Doe.</p>  <p>I don\'t have hobby</p> ');
  });

  it('should handle negated if-statement', function () {
    var tpl = '\
      <a href="#"{#if !active} class="active"{/if}>{title}</a>\
    ';
    var data = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<a href="#">Link</a>');
  });

  it('should handle negated if-statement with else expression', function () {
    var tpl = '\
      <p>Hello, my name is {name}.</p>\
      {#if !hobby}\
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
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<p>Hello, my name is John Doe.</p>  <p>I have hobby</p> ');
  });


  it('should handle for-loop over arrays of objects', function () {
    var tpl = '\
      <p>Here is the list of people I know:</p>\
      <ul>\
        {#for person of people}\
        <li>{person.firstName} {person.lastName}</li>\
        {/for}\
      </ul>\
    ';
    var data = {
      people : [
        {
          firstName: 'John',
          lastName: 'Doe'
        },
        {
          firstName: 'Mark',
          lastName: 'Johnson'
        },
      ]
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<p>Here is the list of people I know:</p><ul>  <li>John Doe</li>  <li>Mark Johnson</li>  </ul>');
  });

  it('should execute JS', function () {
    var tpl = '\
      <div>{js label + (3+5)}</div>\
    ';
    var funcs = {};
    var data = { label: 'test' };

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<div>test8</div>');
  });

  it('should execute JS in if-statement', function () {
    var tpl = '\
      <a href="#"{#if js(title == "Link")} class="active"{/if}>{title}</a>\
    ';
    var data = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('<a href="#" class="active">Link</a>');
  });

  it('should execute multiple statements in JS in if-statement', function () {
    var tpl = '\
      {#if js(let x = 10; let y = 5; x/2 == y)}YES{else}NO{/if}\
    ';
    var data = {};
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(data);

    expect(rendered).to.equal('YES');
  });


});
