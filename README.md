# wxml-transpiler

**Under development now...**

## Intro

Use  compiler built in Vue.js to transpile wxml.

## Give it a Try

```sh
# Start
## install deps
yarn
## build dep
yarn run dev:compiler
## run
node newTest/test

# Dev
## autorestart type check
watch -t flow
## autorestart test
nodemon newTest/test -w packages/vue-template-compiler -w newTest/test.js -w newTest/pages -e js,wxml
```

## Todo

- `propStore` should better not be global
- push props in parseText to reuse pushed props

## License

[MIT](http://opensource.org/licenses/MIT)
