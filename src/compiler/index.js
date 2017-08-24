/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { genTemplate } from './codegen/template'
import { createCompilerCreator } from './create-compiler'


// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  templates: Array<{ path: string, template: string }>,
  options: CompilerOptions
): CompiledResult | any {
  const initStore = {
    map: Object.create(null),
    codeInfoMap: [],
    props: []
  }

  const program: {
    asts: Array<{ path: string, ast: ASTElement }>,
    store: Store,
  } = templates.reduce(
    (p, c) => {
      p.store.codeInfoMap.push({
        path: c.path,
        ti: [],
        ic: [],
        templates: []
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
    ${program.store.props.map(prop => `Z(${prop});`).join('')}
  })(z);`

  program.asts.map(ast => optimize(ast.ast, options))

  const code = program.asts
    .map(
      (ast, idx) =>
        `${generate(ast.ast, program.store, idx, options).render}
      e_["${ast.path}"]={f:m${idx},j:[],i:[],ti:[${program.store.codeInfoMap[idx].ti
          .map(ti => `"${ti}"`)
          .join(
            ','
          )}],ic:[${program.store.codeInfoMap[idx].ic
          .map(ic => `"${ic}"`)
          .join(',')}]};`
    )
    .join('')

  return {
    program,
    render: genTemplate(propsCode + code)
    // staticRenderFns: code.staticRenderFns
  }
})
