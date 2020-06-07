const fs = require('fs')
const resolve = require('path').resolve
const exec = require('child_process').exec
const prettier = require('prettier')
const compiler = require('../packages/wxml-transpiler/build.js')

const fileList = ['./pages/full/index.wxml']

const srcFiles = fileList.reverse()
const distDir = resolve(__dirname, './dist')
const vueDist = resolve(distDir, 'test.vue.dist.js')
const vueExecResult = resolve(distDir, 'test.vue.dist.log')
const vueOriDist = resolve(distDir, 'test.vue.ori.dist.js')
const wccDist = resolve(distDir, 'test.wcc.dist.js')
const wccOriDist = resolve(distDir, 'test.wcc.ori.dist.js')
const wccExecResult = resolve(distDir, 'test.wcc.dist.log')
const diffDist = resolve(distDir, 'vue-wcc.diff')
const execDiff = resolve(distDir, 'vue-wcc-exec.diff')
const formatRule = {
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true
}

var files = srcFiles.map((path) => ({
  path,
  template: fs.readFileSync(resolve(__dirname, path), 'utf-8')
}))

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir)
}

exec(
  `cd ${__dirname} && ${resolve(__dirname, './lib/wcc3')} -b ${srcFiles.join(
    ' '
  )}`,
  (err, wccRes) => {
    if (err) throw err
    fs.writeFileSync(wccOriDist, wccRes, 'utf8')
    fs.writeFileSync(
      wccDist,
      prettier.format(
        `var window = global;${wccRes};console.log(JSON.stringify($gwx('${fileList[0]}', {})({},{}, {} ), null, 2) );`,
        formatRule
      ),
      'utf8'
    )
    const vueRes = compiler.compile(files)
    console.log(vueRes.tags)
    fs.writeFileSync(vueOriDist, vueRes.render, 'utf8')
    fs.writeFileSync(
      vueDist,
      prettier.format(
        `var window = global;${vueRes.render};console.log(JSON.stringify($gwx('${fileList[0]}', {})({},{}, {} ), null, 2) );`,
        formatRule
      ),
      'utf8'
    )
    exec(`diff -rp ${vueDist} ${wccDist}`, (err, diffRes) => {
      // console.log(res)
      fs.writeFileSync(diffDist, diffRes, 'utf8')
    })

    exec(`node ${vueDist}`, (err, res) => {
      // console.log(res)
      // fs.writeFileSync(diffDist, diffRes, 'utf8')
      console.log('vue dist')
      console.log(res)
      fs.writeFileSync(vueExecResult, res, 'utf8')
      exec(`node ${wccDist}`, (err, res) => {
        // console.log(res)
        // fs.writeFileSync(diffDist, diffRes, 'utf8')
        console.log('wcc dist')
        fs.writeFileSync(wccExecResult, res, 'utf8')

        exec(`diff -rp ${vueExecResult} ${wccExecResult}`, (err, diffRes) => {
          // console.log(res)
          fs.writeFileSync(execDiff, diffRes, 'utf8')
        })
      })
    })

    // fs.writeFileSync(wccDist, prettier.format(wccRes, formatRule), 'utf8')
  }
)

console.log('See Result in test/dist dir.')
