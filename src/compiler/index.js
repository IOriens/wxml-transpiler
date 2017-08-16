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
    tmplMap: [],
    props: []
  }

  const program: {
    asts: Array<{ path: string, ast: ASTElement }>,
    store: Store,
  } = templates.reduce(
    (p, c) => {
      p.store.tmplMap.push({
        path: c.path,
        ti: [],
        ic: []
      })
      const ast = parse(c.template, p.store, options)
      return {
        asts: p.asts.concat({
          ast,
          path: c.path
        }),
        store: p.store
      }
    },
    {
      store: initStore,
      asts: []
    }
  )

  const propsCode = `var z = [];
  (function(z){
    var a = 11;
    function Z(ops){z.push(ops)};
    ${program.store.props.map(prop => `Z(${prop});`).join('\n')}
  })(z);`

  program.asts.map(ast => optimize(ast.ast, options))

  const code = program.asts
    .map(
      (ast, idx) =>
        `d_["${ast.path}"] = {};
      var m${idx}=function(e,s,r,gg){
        ${generate(ast.ast, program.store, options).render}
        return r
      };
      e_["${ast.path}"]={f:m${idx},j:[],i:[],ti:[],ic:[${program.store.tmplMap[
          idx
        ].ic
          .map(ic => `"${ic}"`)
          .join(',')}]}`
    )
    .join('\n')

  return {
    program,
    render: genTemplate(propsCode + code)
    // staticRenderFns: code.staticRenderFns
  }
})
