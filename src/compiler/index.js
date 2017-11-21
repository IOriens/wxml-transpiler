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
    props: [],
    tags: []
  }

  const program: {
    asts: Array<{ path: string, ast: ASTElement }>,
    store: Store,
  } = templates.reduce(
    (codeInfos, template) => {
      codeInfos.store.codeInfoMap.push({
        path: template.path,
        ti: [],
        ic: [],
        templates: []
      })

      try {
        const ast = parse(
          `<div>${template.template}</div>`,
          codeInfos.store,
          options
        )
        codeInfos.asts.push({
          ast,
          path: template.path
        })
      } catch (e) {
        console.error(e.name, e.message)
        console.log(e)
        console.error(`When Parsing: ${template.path}`)
        process.exit(1)
      }
      return {
        asts: codeInfos.asts,
        store: codeInfos.store
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
    .map((ast, idx) => {
      let programBody = ''
      try {
        programBody = generate(ast.ast, program.store, idx, options).render
      } catch (e) {
        console.error(e)
        console.error(`When Generating: ${ast.path}`)
        process.exit(1)
      }
      const templateImportInfo = program.store.codeInfoMap[idx].ti
        .map(ti => `"${ti}"`)
        .join(',')
      const templateIncludeInfo = program.store.codeInfoMap[idx].ic
        .map(ic => `"${ic}"`)
        .join(',')

      return `${programBody}
        e_["${ast.path}"]={f:m${idx},j:[],i:[],ti:[${templateImportInfo}],ic:[${templateIncludeInfo}]};`
    })
    .join('')

  return {
    program,
    render: genTemplate(propsCode + code),
    tags: Array.from(new Set(initStore.tags))
    // staticRenderFns: code.staticRenderFns
  }
})
