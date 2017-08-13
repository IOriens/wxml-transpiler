/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { genTemplate } from './codegen/template'
import { createCompilerCreator } from './create-compiler'

// import { stringify } from 'circular-json'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  templates: Array<{ path: string, template: string }>,
  options: CompilerOptions
): CompiledResult | any {
  const initStore = {
    map: Object.create(null),
    props: []
  }

  const asts: {
    asts: Array<{ path: string, ast: ASTElement }>,
    store: { map: Object, props: Array<string> },
  } = templates.reduce(
    (p, c) => ({
      asts: p.asts.concat({
        ast: parse(c.template, p.store, options),
        path: c.path
      }),
      store: p.store
    }),
    {
      store: initStore,
      asts: []
    }
  )

  console.log(asts.store)

  const propsCode = `var z = [];
  (function(z){
    var a = 11;
    function Z(ops){z.push(ops)};
    ${asts.store.props
    .map(prop => `Z(${prop});`)
    .join('\n')}
  })(z);
  `

  asts.asts.map(ast => optimize(ast.ast, options))
  const code = asts.asts
    .map(ast => generate(ast.ast, options).render)
    .join('\n')
  return {
    asts,
    render: genTemplate(propsCode + code)
    // staticRenderFns: code.staticRenderFns
  }
})
