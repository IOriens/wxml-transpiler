var fs = require('fs')
const prettier = require("prettier");
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
// console.log(JSON.stringify(ast))
// var code = generate(ast, {}, file)




// const out = babel.transform(file, {
//   presets: [require('./babel/packages/babel-preset-react')]
// });
const res = compiler.compile(file)

const code = res.render.substring(18, res.render.length - 1)

fs.writeFileSync('test.vue.dist.js', prettier.format(code, {tabWidth: 2, useTabs: false, semi: false, singleQuote: true}), 'utf8')

console.log('See Result in test.vue.dist.js')
