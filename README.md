# wxml-transpiler

**Under development now...**

## Intro

Port of wcc.cpp/wcc/wcc.exe to JavaScript: use compiler carried with Vue.js to transpile wxml ([Grammers to Support](https://mp.weixin.qq.com/debug/wxadoc/dev/framework/view/wxml/)).

## Give it a Try

> Get Started

```sh
# install deps
yarn
# build dep
yarn run dev:compiler
# run
node test/test
```

> Dev Opts

```sh
# autorestart type check
watch -t flow
# autorestart test
nodemon test/test -w packages/wxml-transpiler -w test/test.js -w test/pages -e js,wxml
```

## Todo

### must

- add more doc, remove more useless files, reorange directories
- dataset & event binding

### perf & ux

- error position feedback
- `propStore` should better not be global
- push props in parseText to reuse pushed props

## License

[MIT](http://opensource.org/licenses/MIT)
