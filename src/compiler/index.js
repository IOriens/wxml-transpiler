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
  templates: Array<Object>,
  options: CompilerOptions
): CompiledResult | any {
  const asts: Array<{
    ast: any,
    path: string,
  }> = templates.map(template => ({
    path: template.path,
    ast: parse(template.template, options)
  }))
  asts.map(ast => optimize(ast.ast, options))
  const code = asts.map(ast => generate(ast.ast, options).render).join('\n')
  return {
    asts,
    render: genTemplate(code)
    // staticRenderFns: code.staticRenderFns
  }
})
