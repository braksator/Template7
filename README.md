[![npm](https://img.shields.io/npm/dt/shortcurly.svg)](#)

ShortCurly
===========

Light and powerful JavaScript templating

Allows writing HTML templates with moustache/handlebars inspired shortcodes, the templates
are converted to very concise JavaScript functions which can be used in your applications
to generate HTML.

The intention is to not send an expensive templating engine to the browser, but simple JS
functions.

On the server you write:

```
// Your template
<p>Here are some people:</p>
<ul>
  {#for person of people}
  <li>{person.firstName} {person.lastName}</li>
  {/for}
</ul>

// Your data.
{
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
}
```

Then you compile it to this:

```
myTemplateFunctions = {
  _fo:function (a,c,d){let r='';if(a.length){for(let k of a)r+=eval(c);}else{r+=d;}return r}
  template:function (p){return'<p>Here are some people:</p><ul> '+this._fo(p.people,"' <li>'+k.firstName+' '+k.lastName+'</li>
'","")+'</ul> '}
}
```

Your application can execute the template function to write this to the browser:

```
<p>Here are some people:</p>
<ul>
  <li>John Doe</li>
  <li>Mark Johnson</li>
</ul>
```

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
var shortcurly = require('shortcurly');

// @todo
```


## Customization

This module exports all of its functions so you can potentially overwrite some parts of it!

### Custom Helpers

## Tests

Tests are available in the github repo and can be executed with `npm test`.

To check coverage you have to install istanbul globally:
`npm install istanbul -g`
and then execute:
`npm run coverage`
A coverage summary will be displayed and a full coverage report will appear in the /coverage directory.

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add mocha tests for coverage and explicitly test bugs.
