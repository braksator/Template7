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
    var params = {
      name: 'Bob',
      birthday: { year: 1960 },
      sizes: [ 'small', 'medium', 'large' ]
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<div>Bob</div><div>1960</div><div>small,medium,large</div>');
  });

  it('should escape HTML', function () {
    var tpl = '\
      <div>{escape value}</div>\
    ';
    var params = {
      value: '<this>" & is not"</html>'
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<div>&lt;this&gt;&quot; &amp; is not&quot;&lt;/html&gt;</div>');
  });

  it('should handle if-statement', function () {
    var tpl = '\
      <a href="#"{#if active} class="active"{/if}>{title}</a>\
    ';
    var params = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

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
    var params = {
      name: 'John Doe',
      hobby: false
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Hello, my name is John Doe.</p>  <p>I don\'t have hobby</p> ');
  });

  it('should handle negated if-statement', function () {
    var tpl = '\
      <a href="#"{#if !active} class="active"{/if}>{title}</a>\
    ';
    var params = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

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
    var params = {
      name: 'John Doe',
      hobby: false
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

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
    var params = {
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
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here is the list of people I know:</p><ul>  <li>John Doe</li>  <li>Mark Johnson</li>  </ul>');
  });

  it('should handle for-loop over properties of objects', function () {
    var tpl = '\
      <p>Here are the properties of the person:</p>\
      <ul>\
        {#for property in person}\
        <li>{property}: {person[property]}</li>\
        {/for}\
      </ul>\
    ';
    var params = {
      person: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here are the properties of the person:</p><ul>  <li>firstName: John</li>  <li>lastName: Doe</li>  </ul>');
  });

  it('should handle for-loop over properties with if-statement wrapper', function () {
    var tpl = '\
      <p>Here are the properties of the person:</p>\
      <ul>\
        {#if person}\
        {#for property in person}\
        <li>{property}: {person[property]}</li>\
        {/for}\
        {/if}\
      </ul>\
    ';
    var params = {
      person: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here are the properties of the person:</p><ul>   <li>firstName: John</li>  <li>lastName: Doe</li>   </ul>');
  });

  it('should handle for-loop over properties of objects else condition', function () {
    var tpl = '\
      <p>Here are the properties of the person:</p>\
      <ul>\
        {#for property in person}\
        <li>{property}: {person[property]}</li>\
        {else}\
        <li>No props</li>\
        {/for}\
      </ul>\
    ';
    var params = {
      wrongParamName: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here are the properties of the person:</p><ul>  <li>No props</li>  </ul>');
  });

  it('should handle for-loop over arrays', function () {
    var tpl = '\
      <p>Here are the things I like:</p>\
      <ul>\
        {#for thing of like}\
        <li>{thing}</li>\
        {/for}\
      </ul>\
    ';
    var params = {
      like: ['people', 'places', 'things']
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here are the things I like:</p><ul>  <li>people</li>  <li>places</li>  <li>things</li>  </ul>');
  });

  it('should handle for-loop over arrays else condition', function () {
    var tpl = '\
      <p>Here are the things I like:</p>\
      <ul>\
        {#for thing of like}\
        <li>{thing}</li>\
        {else}\
        <li>No items to display</li>\
        {/for}\
      </ul>\
    ';
    var params = {
      like: [],
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<p>Here are the things I like:</p><ul>  <li>No items to display</li>  </ul>');
  });

  it('should execute JS', function () {
    var tpl = '\
      <div>{js label + (3+5)}</div>\
    ';
    var funcs = {};
    var params = { label: 'test' };

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<div>test8</div>');
  });

  it('should not execute JS', function () {
    var tpl = '\
      <div>{js label + (3+5)}</div>\
    ';
    var funcs = {};
    var params = { label: 'test' };

    sc.jsPerm = false;

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<div></div>');

    sc.jsPerm = true;
  });

  it('should execute JS in if-statement', function () {
    var tpl = '\
      <a href="#"{#if js(title == "Link")} class="active"{/if}>{title}</a>\
    ';
    var params = {
      active: true,
      title: 'Link',
    };
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('<a href="#" class="active">Link</a>');
  });

  it('should execute multiple statements in JS in if-statement', function () {
    var tpl = '\
      {#if js(let x = 10; let y = 5; x/2 == y)}YES{else}NO{/if}\
    ';
    var params = {};
    var funcs = {};

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params);

    expect(rendered).to.equal('YES');
  });

  it('should compile multiple templates', function () {
    var nameTpl = '\
      <div>{name}</div>\
    ';
    var yearTpl = '\
      <div>{year}</div>\
    ';
    var masterTpl = '\
      <div>{> nameTpl}{> yearTpl birthday}</div>\
    ';
    var params = {
      name: 'Bob',
      birthday: { year: 1960 },
    };
    var funcs = {};

    sc.compile(nameTpl, funcs, 'nameTpl');
    sc.compile(yearTpl, funcs, 'yearTpl');
    sc.compile(masterTpl, funcs, 'masterTpl');
    //debugFuncs(funcs);
    var rendered = funcs.masterTpl(params);

    expect(rendered).to.equal('<div><div>Bob</div><div>1960</div></div>');
  });

  it('should tolerate missing templates', function () {
    var nameTpl = '\
      <div>{name}</div>\
    ';
    var masterTpl = '\
      <div>{> nameTpl}{> yearTpl birthday}</div>\
    ';
    var params = {
      name: 'Bob',
      birthday: { year: 1960 },
    };
    var funcs = {};
    var report = {};

    sc.compile(nameTpl, funcs, 'nameTpl', report);
    sc.compile(masterTpl, funcs, 'masterTpl', report);
    //debugFuncs(funcs);

    expect(report.missing).to.deep.equal(['yearTpl']);
  });

  it('should compile multiple nested templates', function () {
    var nameTpl = '\
      <div>{name}</div>{> yearTpl birthday}\
    ';
    var yearTpl = '\
      <div>{year}</div>\
    ';
    var masterTpl = '\
      <div>{> nameTpl}</div>\
    ';
    var params = {
      name: 'Bob',
      birthday: { year: 1960 },
    };
    var funcs = {};

    sc.compile(nameTpl, funcs, 'nameTpl');
    sc.compile(yearTpl, funcs, 'yearTpl');
    sc.compile(masterTpl, funcs, 'masterTpl');
    //debugFuncs(funcs);
    var rendered = funcs.masterTpl(params);

    expect(rendered).to.equal('<div><div>Bob</div><div>1960</div></div>');
  });

  it('should handle state in a sub template', function () {
    var tpl = '\
      <div>{name}</div><div>{state.alpha}</div>{> subTpl sub}\
    ';
    var subTpl = '\
      <div>{year} - {state.beta}</div>\
    ';
    var state = {
      alpha: "uno",
      beta: "dos",
    };
    var params = {
      name: 'Bob',
      sub: {
        year: 1960,
      },
    };
    var funcs = {};
    sc.state = 'state';

    sc.compile(tpl, funcs, 'myTpl');
    sc.compile(subTpl, funcs, 'subTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params, state);

    expect(rendered).to.equal('<div>Bob</div><div>uno</div><div>1960 - dos</div>');

    sc.state = false;
  });

  it('should handle state in for-loop over properties of objects', function () {
    var tpl = '\
      <p>Here are the properties of the person:</p>\
      <ul>\
        {#for property in person}\
        <li>{property}: {person[property]} {state.alpha}</li>\
        {/for}\
      </ul>\
    ';
    var state = {
      alpha: "uno",
      beta: "dos",
    };
    var params = {
      person: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    var funcs = {};
    sc.state = 'state';

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params, state);

    expect(rendered).to.equal('<p>Here are the properties of the person:</p><ul>  <li>firstName: John uno</li>  <li>lastName: Doe uno</li>  </ul>');

    sc.state = false;
  });

  it('should handle counter in for-loop over properties of objects', function () {
    var tpl = '\
      <p>Here are the properties of the person:</p>\
      <ul>\
        {#for property in person}\
        <li>{property}: {person[property]} {_i}</li>\
        {/for}\
      </ul>\
    ';
    var state = {
      alpha: "uno",
      beta: "dos",
    };
    var params = {
      person: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    var funcs = {};
    sc.state = 'state';

    sc.compile(tpl, funcs, 'myTpl');
    //debugFuncs(funcs);
    var rendered = funcs.myTpl(params, state);

    expect(rendered).to.equal('<p>Here are the properties of the person:</p><ul>  <li>firstName: John 0</li>  <li>lastName: Doe 1</li>  </ul>');

    sc.state = false;
  });
});
