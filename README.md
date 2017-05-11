[![npm](https://img.shields.io/npm/dt/shortcurly.svg)](#)

ShortCurly
===========

Light and powerful JavaScript templating

Allows writing HTML templates with moustache/handlebars inspired shortcodes, the templates
are converted to very concise JavaScript functions which can be used in your applications
to generate HTML.

The intention is to not send an expensive templating engine to the browser, but simple JS
functions.

## Background

After looking at various JavaScript templating modules I've decided to create
this alternative that is more suitable for my purposes.  Some of the code is
forked from [Template7](http://idangero.us/template7) but the usage and resulting
code is a little different.

## Installation

This is a Node.JS module available from the Node Package Manager (NPM).

Here's the command to download and install from NPM:

`npm install shortcurly -S`

## Usage

### In a Node.js module

```javascript
// Require shortcurly.
var sc = require('shortcurly');

// Create your template string.
var tpl = '<div>{name}</div><div>{birthday.year}</div><div>{sizes}</div>';

// Create an object to hold your functions.
// You can keep passing this back into sc.compile() to build out more templates.
var funcs = {};

// Convert your tpl to a template functions named 'myTpl'.
sc.compile(tpl, funcs, 'myTpl');

// Now funcs.myTpl contains:
// function (p){return '<div>'+p.name+'</div><div>'+p.birthday.year+'</div><div>'+p.sizes+'</div>'}

// Create your params.
var params = {
  name: 'Bob',
  birthday: { year: 1960 },
  sizes: [ 'small', 'medium', 'large' ]
};

// Send your params and funcs to the browser.

// Executing funcs.myTpl(params) returns:
// '<div>Bob</div><div>1960</div><div>small,medium,large</div>'
```

## Helpers

### Nested templates / Subtemplates / Partials
(yeah, I'm not sure what to call these - partials is misleading because the
subtemplate can be a repurposed full template)

A template can use another template to handle part of it's output.
`{> SubtemplateName childParam}`
Where 'SubtemplateName' is the name of the nested template and 'childParam'
is an object that will be used as the param for that template.

These nested templates can access the state variable if applicable
(see "Working With State" below)

### If-Statement
`{#if variable}variable is truthy{/if}`
`{#if !variable}variable is falsey{/if}`
`{#if variable}variable is truthy{else}variable is falsey{/if}`

### Looping Object Properties
```JavaScript
{#for stuff in myObject}
<li>{stuff}: {myObject[stuff]}</li>
{/for}
```
Here the object `myObject` is being looped, and the template has nominated each property be named `stuff`.
So `{stuff}` will output the key, and `{myObject[stuff]}` will output the value.
Note: The syntax for looping object properties uses the 'in' keyword.
You can also use `{_i}` to get a numeric index.

### Looping Arrays Of Objects
```JavaScript
{#for person of people}
<li>{person.firstName} {person.lastName}</li>
{/for}
```

Will work with these params:
```JavaScript
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
```
Note: The syntax for looping arrays uses the 'of' keyword.
You can also use `{_i}` to get a numeric index.

### Looping Arrays
```JavaScript
{#for thing of like}
<li>{thing}</li>
{/for}
```

Will work with these params:
```JavaScript
var params = {
  like: ['people', 'places', 'things']
};
```
Note: The syntax for looping arrays uses the 'of' keyword.
You can also use `{_i}` to get a numeric index.

### Handling Empty Arrays/Objects
For-loops have an in-built 'else' condition which is used when there are no
items to loop or the variable is missing.
```JavaScript
{#for thing of like}
<li>{thing}</li>
{else}
<li>No items to display</li>
{/for}
```
Will work with these params:
```JavaScript
var params = {
  like: [],
};
```

### Escaping HTML
```JavaScript
var tpl = '<div>{escape value}</div>';
var funcs = {};
sc.compile(tpl, funcs, 'myTpl');

// In the browser...
var params = {
  value: '<this>" & is not"</html>'
};
// funcs.myTpl(params)
// returns: '<div>&lt;this&gt;&quot; &amp; is not&quot;&lt;/html&gt;</div>'
```

### JavaScript
There is support for JavaScript in templates.

As a helper:
`{js label + (3+5)}` with params `{ label: 'test' }` produces `'<div>test8</div>'`.

As an argument to another helper:
`<a href="#"{#if js(title == "Link")} class="active"{/if}>` with params `{title: 'Link'}` produces `<a href="#" class="active">`.

See "User-Supplied JavaScript" (below) if templates can be created by your users.

## Customization

This module exports all of its functions so you can potentially overwrite
some parts of it!

### Creating Helpers

You can add to `sc.helpers`, to create new helpers:

```JavaScript
sc.helpers.baz = {
  process: (ctx, block, returns, functions, report) => {
    // Look at the values of ctx and block, and modify returns/functions/report as needed.
    // Typically you just use returns.push() to add a new string to concat into the output.
    // You can add supporting functions to 'functions', but try to inline where possible to
    // maintain variable scope.  Try to manually minify output as much as possible.
    // See code in the existing helpers, it may take some time to understand/debug.
  }
}
```

### Working With State

In addition to the params you can also access a state variable in your templates.  State variables
are passed to subtemplates/partials (unlike the parent template's params).

To use a state variable simply set `sc.state` to the name of your state variable prior to running
sc.compile():
```javascript
var tpl = 'I can access {state.foo} in templates';
sc.state = 'state';
sc.compile(tpl, funcs, 'myTpl');

// Now in the browser...
var params = {
  // Your Params
};
var state = {
  // Your State
  foo: 'state values'
};
funcs.myTpl(params, state);
```

### User-Supplied JavaScript

Allowing users to create templates has security implications because of the
access to JavaScript in this templating system.

If you're allowing users to create templates (e.g. via a GUI) you need to decide whether they
have permission to use the JS helpers.  Prior to running sc.compile() you should set `sc.jsPerm`
to `true` or `false` accordingly for each user.  When `false` the JavaScript parts will be
replaced with an empty string.

If you want to know whether a template contained JS that was skipped because of jsPerm being
false, you can pass a 4th param to sc.compile(), an empty object, which will contain a report:
```javascript
var tpl = "(the user supplied template)"
var funcs = {};
var report = {};
sc.jsPerm = false;
sc.compile(tpl, funcs, 'templateName', report);
// report.jsSkipped now contains an array of template names where JS was skipped.
```
You can reuse the report variable as you would with the func variable, and check it later.
The results of this report can be used to warn the user that their JavaScript was omitted.

## Tests

Tests are available in the github repo and can be executed with `npm test`.

To check coverage you have to install istanbul globally:
`npm install istanbul -g`
and then execute:
`npm run coverage`
A coverage summary will be displayed and a full coverage report will appear in the /coverage directory.

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add mocha tests for coverage and explicitly test bugs.
