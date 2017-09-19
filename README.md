# wxml-transpiler

## Intro

Port of wcc.cpp/wcc/wcc.exe to JavaScript: use compiler carried with Vue.js to transpile wxml ([Grammers to Support](https://mp.weixin.qq.com/debug/wxadoc/dev/framework/view/wxml/)).

## Give it a Try

> Get Started

```sh
# install deps
yarn

# build dep
yarn run build

# run
node test/test
```

> Dev Opts

```sh
# auto rebuild
yarn run dev

# autorestart type check system
## brew install watch
watch -t npm run flow

# autorestart test
## yarn global add nodemon
nodemon test/test -w packages/wxml-transpiler -w test/test.js -w test/pages -e js,wxml -V -d 2000ms
```

## Todo

- error position feedback
- `propStore` should better not be global
- push props in parseText to reuse pushed props

## License

[MIT](http://opensource.org/licenses/MIT)
