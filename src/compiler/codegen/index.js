/* @flow */

import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction, generateId } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string
type DataGenFunction = (el: ASTElement) => string
type DirectiveFunction = (
  el: ASTElement,
  dir: ASTDirective,
  warn: Function
) => boolean

export class CodegenState {
  options: CompilerOptions
  warn: Function
  transforms: Array<TransformFunction>
  dataGenFns: Array<DataGenFunction>
  directives: { [key: string]: DirectiveFunction }
  maybeComponent: (el: ASTElement) => boolean
  onceId: number
  staticRenderFns: Array<string>

  constructor (options: CompilerOptions) {
    this.options = options
    this.warn = options.warn || baseWarn
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    this.directives = extend(extend({}, baseDirectives), options.directives)
    const isReservedTag = options.isReservedTag || no
    this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
    this.onceId = 0
    this.staticRenderFns = []
  }
}

export type CodegenResult = {
  render: string,
  staticRenderFns: Array<string>,
}

let propStore: Store

export function generate (
  ast: ASTElement | void,
  gstore: Store,
  options: CompilerOptions
): CodegenResult {
  propStore = gstore
  const state = new CodegenState(options)
  const code = ast ? genElement(ast, state) : '_m("div")'
  return {
    render: code,
    staticRenderFns: state.staticRenderFns
  }
}

export function genElement (el: ASTElement, state: CodegenState): string {
  debugger
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genTemplate(el, state)
  } else if (el.tag === 'block') {
    return genChildren(el, state) || 'GenChild Error'
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else if (el.tag === 'include') {
    return genInclude(el, state)
  } else if (el.tag === 'import') {
    return genImport(el, state)
  } else {
    // component or element
    let code
    if (el.component) {
      code = genComponent(el.component, el, state)
    } else {
      const data = el.plain ? undefined : genData(el, state)
      if (el.tag == 'Program') {
        el.nodeFuncName = 'r'
        const importFuncName = (el.importFuncName = generateId())
        const tmplInfo = getTmplInfo()
        const tmplIc = tmplInfo.ic
        const tmplTi = tmplInfo.ti
        const oldIcLen = tmplIc.length
        const oldTiLen = tmplTi.length
        const children = el.inlineTemplate ? null : genChildren(el, state, true)
        const newIcLen = tmplIc.length
        const newTiLen = tmplTi.length

        let icTop = ''
        let icBottom = ''
        if (newIcLen > oldIcLen) {
          const icName = generateId()
          icTop = `var ${icName} = e_["${tmplInfo.path}"].j;`
          for (var icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
            icBottom += `${icName}.pop();`
          }
        }

        if (newTiLen > oldTiLen) {
          icTop = `var ${importFuncName} = e_["${tmplInfo.path}"].i;${icTop}`
          for (var icIdx = newTiLen - 1; icIdx >= oldTiLen; icIdx--) {
            icBottom += `${importFuncName}.pop();`
          }
        }
        code = `${icTop}${children ? `${children}` : ''}${icBottom}`
      } else {
        const children = el.inlineTemplate ? null : genChildren(el, state, true)
        const dataLen = el.attrsList.length
        if (dataLen == 0) {
          code = `var ${el.nodeFuncName || 'nodeFuncName error'} = _n("${el.tag}");${children ? `${children}` : ''}`
        } else if (dataLen == 1) {
          const attr = el.attrsList[0]
          code = `var ${el.nodeFuncName || 'nodeFuncName error2'} = _n("${el.tag}");
          _r(${el.nodeFuncName || 'nodeFuncName error3'}, '${attr.name}', ${propStore.map[attr.value]}, e, s, gg);${children ? `${children}` : ''}`
        } else {
          code = `var ${el.nodeFuncName || 'nodeFuncName error4'} = _m( "${el.tag}", ${data || 'data error'}, e, s, gg);${children ? `${children}` : ''}`
        }
      }
    }
    // module transforms
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    return code
  }
}

// hoist static sub-trees out
function genStatic (el: ASTElement, state: CodegenState): string {
  el.staticProcessed = true
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
  return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
function genOnce (el: ASTElement, state: CodegenState): string {
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    if (!key) {
      process.env.NODE_ENV !== 'production' &&
        state.warn(`v-once can only be used inside v-for that is keyed. `)
      return genElement(el, state)
    }
    return `_o(${genElement(el, state)},${state.onceId++}${key ? `,${key}` : ``})`
  } else {
    return genStatic(el, state)
  }
}

export function genIf (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(
    el.ifConditions.slice(),
    state,
    altGen,
    altEmpty,
    el.nodeFuncName,
    el.env,
    el.scope
  )
}

function genIfConditions (
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string,
  nodeFuncName?: string,
  env?: string,
  scope?: string,
  vkey?: number
): string {
  if (!conditions.length) {
    return altEmpty || ' '
  }

  const condition = conditions.shift()
  const childnodeFuncName = generateId()
  condition.block.nodeFuncName = childnodeFuncName
  condition.block.blockFuncName = isOneOf(condition.block.tag, [
    'include',
    'block'
  ])
    ? nodeFuncName
    : childnodeFuncName
  env = env || 'e'
  scope = scope || 's'

  const pushChildTmpl = isOneOf(condition.block.tag, [
    'block',
    'include',
    'import'
  ])
    ? ''
    : `_(${nodeFuncName || ''}, ${childnodeFuncName});`

  const importFuncName = condition.block.importFuncName = generateId()
  const tmplInfo = getTmplInfo()
  const tmplIc = tmplInfo.ic
  const tmplTi = tmplInfo.ti
  const oldIcLen = tmplIc.length
  const oldTiLen = tmplTi.length
  let childTmpl = genTernaryExp(condition.block)
  const newIcLen = tmplIc.length
  const newTiLen = tmplTi.length

  if (newIcLen > oldIcLen) {
    const icName = generateId()
    childTmpl = `var ${icName} = e_["${tmplInfo.path}"].j;${childTmpl};`
    for (var icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
      childTmpl += `${icName}.pop();`
      tmplIc.pop()
    }
  }

  if (newTiLen > oldTiLen) {
    childTmpl = `var ${importFuncName} = e_["${tmplInfo.path}"].i;${childTmpl};`
    for (var icIdx = newTiLen - 1; icIdx >= oldTiLen; icIdx--) {
      childTmpl += `${importFuncName}.pop();`
      tmplTi.pop()
    }
  }

  if (condition.block.if) {
    return `var ${nodeFuncName || ''} = _v();
      if (_o(${propStore.map[condition.exp]}, ${env}, ${scope}, gg)) {
        ${nodeFuncName || ''}.wxVkey = ${(vkey = 1)};${childTmpl}${pushChildTmpl}
      }${genIfConditions(conditions, state, altGen, altEmpty, nodeFuncName, env, scope, vkey + 1)}`
  } else if (condition.block.elseif) {
    return `else if (_o(${propStore.map[condition.exp]}, ${env}, ${scope}, gg)) {
        ${nodeFuncName || ''}.wxVkey = ${vkey || 2};${childTmpl}${pushChildTmpl}
      }${genIfConditions(conditions, state, altGen, altEmpty, nodeFuncName, env, scope, vkey + 1)}`
  } else {
    return `else {
        ${nodeFuncName || ''}.wxVkey = ${vkey || 2};${childTmpl}${pushChildTmpl}
      }`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  function genTernaryExp (el) {
    return altGen
      ? altGen(el, state)
      : el.once ? genOnce(el, state) : genElement(el, state)
  }
}

export function genFor (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  if (
    process.env.NODE_ENV !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} vx:for="${alias} in ${exp}">: component lists rendered with ` +
        `v-for should have explicit keys. ` +
        `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }
  // console.log(666, el)
  el.forProcessed = true // avoid recursion
  let parentnodeFuncName = el.nodeFuncName
  let forFuncId = generateId()
  let childnodeFuncName = generateId()
  let returnNodeName = generateId()
  el.nodeFuncName = childnodeFuncName
  el.blockFuncName = el.tag == 'block' || el.tag == 'include'
    ? returnNodeName
    : childnodeFuncName

  let oldScope = el.scope || 's'
  let newScope = (el.scope = generateId())
  let oldEnv = el.env || 'e'
  let newEnv = (el.env = generateId())

  let importFuncName = (el.importFuncName = generateId())

  const tmplInfo = getTmplInfo()
  const tmplIc = tmplInfo.ic
  const tmplTi = tmplInfo.ti
  const oldIcLen = tmplIc.length
  const oldTiLen = tmplTi.length
  let children = `${(altGen || genElement)(el, state)}`
  const newIcLen = tmplIc.length
  const newTiLen = tmplTi.length

  let icTop = ''
  let icBottom = ''
  if (newIcLen > oldIcLen) {
    const icName = generateId()
    icTop = `var ${icName} = e_["${tmplInfo.path}"].j;`
    for (var icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
      icBottom += `${icName}.pop();`
      tmplIc.pop()
    }
  }
  if (newTiLen > oldTiLen) {
    icTop = `var ${importFuncName} = e_["${tmplInfo.path}"].i;${icTop}`
    for (var tiIdx = newTiLen - 1; tiIdx >= oldTiLen; tiIdx--) {
      icBottom += `${importFuncName}.pop();`
      tmplTi.pop()
    }
  }

  const cantainEle = isOneOf(el.tag, ['block', 'include'])
    ? ''
    : `_(${returnNodeName}, ${childnodeFuncName});`

  let code = `var ${parentnodeFuncName} = _v();
  var ${forFuncId} = function (${newEnv},${newScope},${returnNodeName},gg) {
    ${icTop}${children}${icBottom}${cantainEle}
    return ${returnNodeName};
  };
  _2(${propStore.map[exp]}, ${forFuncId}, ${oldEnv}, ${oldScope}, gg, ${parentnodeFuncName}, "${el.alias}", "${el.iterator1}", '');`
  console.log(666, el)
  return code
}

export function genData (el: ASTElement, state: CodegenState): string {
  let data = ''

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute
  if (el.component) {
    // data += `tag:"${el.tag}",`
  }
  // module data generation functions
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }
  // attributes
  if (el.attrs) {
    data += `${genProps(el.attrs)},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:{${genProps(el.props)}},`
  }
  // event handlers
  if (el.events) {
    data += `${genHandlers(el.events, false, state.warn)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true, state.warn)},`
  }
  // slot target
  if (el.slotTarget) {
    data += `slot:${el.slotTarget},`
  }
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots, state)},`
  }
  // component v-model
  if (el.model) {
    data += `model:{value:${el.model.value},callback:${el.model.callback},expression:${el.model.expression}},`
  }
  // inline-template
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  data = data.replace(/,$/, '') + ''
  // v-bind data wrap
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  // v-on data wrap
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }
  return data
}

function genDirectives (el: ASTElement, state: CodegenState): string | void {
  const dirs = el.directives
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  for ((i = 0), (l = dirs.length); i < l; i++) {
    dir = dirs[i]
    needRuntime = true
    const gen: DirectiveFunction = state.directives[dir.name]
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, state.warn)
    }
    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''}${dir.arg ? `,arg:"${dir.arg}"` : ''}${dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''}},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}

function genTemplate (el: ASTElement, state: CodegenState): string {
  console.log(el)
  const container = el.nodeFuncName || 'name err'
  const isFunc = generateId()
  const tmplName = getTmplInfo().path
  const dataFunc = generateId()
  const compFunc = generateId()
  const env = el.env || 'e'
  const scope = el.scope || 's'
  const isProp = propStore.map[el.component]
  console.log(666, el.data)
  const dataProp = propStore.map[el.data]
  const data = dataProp ? `_1(${dataProp},${env},${scope},gg);` : `{};`
  return `var ${container} = _v();
       var ${isFunc} = _o(${isProp}, ${env}, ${scope}, gg);
       var ${compFunc} = _gd('${tmplName}', ${isFunc}, e_, d_);
       if (${compFunc}) {
         var ${dataFunc} = ${data}
         ${compFunc}(${dataFunc},${dataFunc},${container}, gg);
       } else _w(${isFunc}, '${tmplName}', 0, 0);`
}

function genInlineTemplate (el: ASTElement, state: CodegenState): ?string {
  const ast = el.children[0]
  if (
    process.env.NODE_ENV !== 'production' &&
    (el.children.length > 1 || ast.type !== 1)
  ) {
    state.warn(
      'Inline-template components must have exactly one child element.'
    )
  }
  if (ast.type === 1) {
    const inlineRenderFns = generate(ast, propStore, state.options)
    return `inlineTemplate:{render:function(){${inlineRenderFns.render}},staticRenderFns:[${inlineRenderFns.staticRenderFns
      .map(code => `function(){${code}}`)
      .join(',')}]}`
  }
}

function genScopedSlots (
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  return `scopedSlots:_u([${Object.keys(slots)
    .map(key => {
      return genScopedSlot(key, slots[key], state)
    })
    .join(',')}])`
}

function genScopedSlot (
  key: string,
  el: ASTElement,
  state: CodegenState
): string {
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  return (
    `{key:${key},fn:function(${String(el.attrsMap.scope)}){` +
    `return ${el.tag === 'template' ? genChildren(el, state) || 'void 0' : genElement(el, state)}}}`
  )
}

function genForScopedSlot (key: string, el: any, state: CodegenState): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
  el.forProcessed = true // avoid recursion
  return (
    `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
    `return ${genScopedSlot(key, el, state)}` +
    '})'
  )
}

export function genChildren (
  parent: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = parent.children

  if (children.length) {
    const firstEl: any = children[0]
    // optimize single v-for
    if (
      children.length === 1 &&
      firstEl.for &&
      firstEl.tag !== 'template' &&
      firstEl.tag !== 'slot'
    ) {
      // return (altGenElement || genElement)(firstEl, state)
    }
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0
    const gen = altGenNode || genNode

    const res = children
      .map(child => {
        const nodeFuncName = generateId()
        if (
          (child.tag === 'include' && !child.if && !child.for) ||
          (child.tag === 'import' && !child.if)
        ) {
          console.log(11)
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)}`
        } else if (parent.tag === 'block') {
          console.log(22)
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)};_(${parent.blockFuncName || 'error'},${nodeFuncName || 'error'});`
        } else {
          console.log(33)
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)};_(${parent.nodeFuncName || 'error'},${nodeFuncName});`
        }
      })
      .join('')

    // return `[${children.map(c => gen(c, state)).join(',')}]${
    //   normalizationType ? `,${normalizationType}` : ''
    // }`
    return res
  }
}

function genNode (
  node: ASTNode,
  state: CodegenState,
  parentName?: string,
  env?: string,
  scope?: string,
  blockFuncName?: string,
  importFuncName?: string
): string {
  if (node.type === 1) {
    node.nodeFuncName = parentName
    node.env = env
    node.scope = scope
    node.blockFuncName = blockFuncName
    node.importFuncName = importFuncName
    return genElement(node, state)
  }
  if (node.type === 3 && node.isComment) {
    return genComment(node)
  } else {
    return genText(node, parentName, env, scope)
  }
}
// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType (
  children: Array<ASTNode>,
  maybeComponent: (el: ASTElement) => boolean
): number {
  let res = 0
  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    if (el.type !== 1) {
      continue
    }
    if (
      needsNormalization(el) ||
      (el.ifConditions &&
        el.ifConditions.some(c => needsNormalization(c.block)))
    ) {
      res = 2
      break
    }
    if (
      maybeComponent(el) ||
      (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))
    ) {
      res = 1
    }
  }
  return res
}

function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

export function genText (
  text: ASTText | ASTExpression,
  parentName?: string,
  env?: string,
  scope?: string
): string {
  const nodeFuncName = generateId()
  return `var ${parentName || 'error'} = _o(${propStore.map[text.text || 'error']}, ${env || 'e'}, ${scope || 's'}, gg);`
}

export function genComment (comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)})`
}

function genSlot (el: ASTElement, state: CodegenState): string {
  const slotName = el.slotName || '"default"'
  const children = genChildren(el, state)
  let res = `_t(${slotName}${children ? `,${children}` : ''}`
  const attrs =
    el.attrs &&
    `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

function genInclude (el: ASTElement, state: CodegenState) {
  const tmplInfo = getTmplInfo()
  if (el.include) {
    tmplInfo.ic.push(el.include)
  }
  return `
  _ic("${el.include || 'src error'}",e_, "${tmplInfo.path}",${el.env || 'e'},${el.scope || 's'},${el.blockFuncName || 'r'},gg);`
}

function genImport (el: ASTElement, state: CodegenState) {
  const tmplInfo = getTmplInfo()
  if (el.import) {
    tmplInfo.ti.push(el.import)
  }
  console.log(el)
  return `_ai(${el.importFuncName || 'import name err'}, '${el.import || 'src error'}', e_, '${tmplInfo.path}', 0, 0);`
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent (
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_m(${componentName},${genData(el, state)}${children ? `,${children}` : ''})`
}

function genProps (props: Array<{ name: string, value: string }>): string {
  let res = '['
  let initIdx
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (!initIdx) {
      initIdx = propStore.map[prop.value]
      res += `"${prop.name}", ${initIdx},`
    } else {
      res += `"${prop.name}", ${propStore.map[prop.value] - initIdx},`
    }
  }
  return res.slice(0, -1) + ']'
}

// #3895, #4268
function transformSpecialNewlines (text: string): string {
  return text.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function getTmplInfo (): TemplateInfo {
  return propStore.tmplMap.slice(-1)[0]
}

function isOneOf (obj: any, targets: Array<mixed>) {
  return targets.indexOf(obj) != -1
}
