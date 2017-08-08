var fs = require('fs')
// var babylon = require('./babylon/')
// var babel = require('./babel/packages/babel-core');
// var generate = require('babel-generator').default
// import generate from 'babel-generator';

const compiler = require('./packages/vue-template-compiler/build.js')


var file = fs
  .readFileSync('test.wxml', 'utf8')
  // .replace(/(\w*)\{\{(((['"][^'"]+['"])|[^{}]+)+)\}\}/g, '$1{$2}')
  // .replace(/<!--.*-->/g, '')
// console.log(file)

// var ast = babylon.parse(file, {
//   // parse in strict mode and allow module declarations
//   sourceType: 'module',

//   plugins: [
//     // enable jsx and flow syntax
//     'jsx'
//     // "flow"
//   ]
// })
// debugger
// console.log(JSON.stringify(ast))
// var code = generate(ast, {}, file)




// const out = babel.transform(file, {
//   presets: [require('./babel/packages/babel-preset-react')]
// });
const ast = compiler.compile(file)


console.log(ast)
