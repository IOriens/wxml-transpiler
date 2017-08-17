const fs = require('fs')
const resolve = require('path').resolve
const exec = require('child_process').exec
const prettier = require('prettier')
const compiler = require('../packages/vue-template-compiler/build.js')

const fileList = ['./pages/index/index.wxml']

const srcFiles = fileList.reverse()
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
  template: fs.readFileSync(resolve(__dirname, path), 'utf-8')
}))

const vueRes = compiler.compile(files)
fs.writeFileSync(vueDist, vueRes.render, 'utf8')

exec(
  `cd ${__dirname} && ${resolve(__dirname, 'wcc')} -b ${srcFiles.join(' ')}`,
  (err, wccRes) => {
    if (err) throw err
    fs.writeFileSync(wccOriDist, wccRes, 'utf8')
    fs.writeFileSync(wccDist, prettier.format(wccRes, formatRule), 'utf8')
    fs.writeFileSync(
      vueDist,
      prettier.format(vueRes.render, formatRule),
      'utf8'
    )
    exec(`diff -rp ${vueDist} ${wccDist}`, (err, diffRes) => {
      // console.log(res)
      fs.writeFileSync(diffDist, diffRes, 'utf8')
    })
  }
)

console.log('See Result in test.vue.dist.js && test.wcc.dist.js')
