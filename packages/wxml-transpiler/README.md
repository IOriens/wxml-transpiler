# wxml-transpiler

This package can be used to compile wxml templates.

## Usage

```sh
npm i wxml-transpiler
```

``` js
const compiler = require('wxml-transpiler')

const fileList = [
    './pages/index/index.wxml',
    './common/head.wxml',
    './common/foot.wxml'
  ]

const res = compiler.wxmlCompile(fileList)
```