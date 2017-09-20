# wxml-transpiler

## Intro

Port of wcc.cpp/wcc/wcc.exe to JavaScript: use compiler carried with Vue.js to transpile wxml ([Grammers to Support](https://mp.weixin.qq.com/debug/wxadoc/dev/framework/view/wxml/)).

## Give it a Try

> Get Started

```sh
# install deps
npm i

# build dep
npm run build

# run
node test/test
```

> Dev Opts

```sh
# auto rebuild
npm run dev

# autorestart type check system
## brew install watch
watch -t npm run flow

# autorestart test
npm run autotest
```

## Todo

- error position feedback
- `propStore` should better not be global
- push props in parseText to reuse pushed props

## License

[MIT](http://opensource.org/licenses/MIT)
