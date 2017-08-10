const fs = require('fs')
const path = require('path')
const exec = require('child_process').exec
const prettier = require('prettier')
const compiler = require('../packages/vue-template-compiler/build.js')

const srcFile = path.resolve(__dirname, './test.wxml')
const vueDist = path.resolve(__dirname, 'test.vue.dist.js')
const wccDist = path.resolve(__dirname, 'test.wcc.dist.js')
const diffDist = path.resolve(__dirname, 'vue-wcc.diff')
const formatRule = {
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true
}
var file = fs.readFileSync(srcFile, 'utf8')

const res = compiler.compile(file)
fs.writeFileSync(vueDist, res.render, 'utf8')
fs.writeFileSync(vueDist, prettier.format(res.render, formatRule), 'utf8')

exec(`${path.resolve(__dirname, 'wcc')} -b ${srcFile}`, (err, res) => {
  fs.writeFileSync(wccDist, prettier.format(res, formatRule), 'utf8')
  exec(`diff -rp ${vueDist} ${wccDist}`, (err, res) => {
    fs.writeFileSync(diffDist, res, 'utf8')
  })
})

console.log('See Result in test.vue.dist.js && test.wcc.dist.js')
