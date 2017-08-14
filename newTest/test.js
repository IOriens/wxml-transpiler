const fs = require('fs')
const resolve = require('path').resolve
const exec = require('child_process').exec
const prettier = require('prettier')
const compiler = require('../packages/vue-template-compiler/build.js')

const fileList = ['test.wxml', 'test.full.wxml']

const srcFiles = fileList.reverse().map(file => resolve(__dirname, file))
const vueDist = resolve(__dirname, 'test.vue.dist.js')
const wccDist = resolve(__dirname, 'test.wcc.dist.js')
const wccOriDist = resolve(__dirname, 'test.wcc.ori.dist.js')
const diffDist = resolve(__dirname, 'vue-wcc.diff')
const formatRule = {
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true
}

var files = srcFiles.map(path => ({
  path,
  template: fs.readFileSync(path, 'utf-8')
}))

const res = compiler.compile(files)
fs.writeFileSync(vueDist, res.render, 'utf8')
fs.writeFileSync(vueDist, prettier.format(res.render, formatRule), 'utf8')

exec(`${resolve(__dirname, 'wcc')} -b ${srcFiles.reduce((p, c) => `${p} ${c}`, '')}`, (err, res) => {
  if(err) throw err
  fs.writeFileSync(wccOriDist, res, 'utf8')
  fs.writeFileSync(wccDist, prettier.format(res, formatRule), 'utf8')
  exec(`diff -rp ${vueDist} ${wccDist}`, (err, res) => {
    // console.log(res)
    fs.writeFileSync(diffDist, res, 'utf8')
  })
})

console.log('See Result in test.vue.dist.js && test.wcc.dist.js')
