/* @flow */

// import { genHandlers } from './events'
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

function camelizeAttr (attr) {
  if (attr.substring(0, 5) === 'data-') return attr
  else return camelize(attr)
}

export type CodegenResult = {
  render: string,
  staticRenderFns: Array<string>,
}

let propStore: Store
let templateIdx: number
export function generate (
  ast: ASTElement | void,
  gstore: Store,
  idx: number,
  options: CompilerOptions
): CodegenResult {
  propStore = gstore
  templateIdx = idx
  const state = new CodegenState(options)
  const codeInfo = getCurrentCodeInfo()

  // generate tmplates
  const templateImpls = codeInfo.templates
    .map(tmpl => genTemplate(tmpl, state))
    .join('')

  // generate main elements
  let code = ast ? genElement(ast, state) : '_m("div")'

  // compose above codes
  code = `d_["${codeInfo.path}"] = {};${templateImpls}
  var m${templateIdx}=function(e,s,r,gg){
    ${code}
    return r;
  };`

  return {
    render: code,
    staticRenderFns: state.staticRenderFns
  }
}
function genTemplate (tmpl: template, state: CodegenState) {
  const codeInfo = getCurrentCodeInfo()
  const children = genElement(tmpl.tmpl, state)
  tmpl.tmpl.tmplProcessed = true
  tmpl.tmpl.children = []
  return `d_["${codeInfo.path}"]["${tmpl.path}"]=function(e,s,r,gg){
    var b='${codeInfo.path}:${tmpl.path}'
    r.wxVkey=b
    if(p_[b]){_wl(b,'${codeInfo.path}');return}
    p_[b]=true
    try{
      ${children}
    }catch(err){
    p_[b]=false
    throw err
    }
    p_[b]=false
    return r
    };`
}

export function genElement (el: ASTElement, state: CodegenState): string {
  const isTemplateWithName = el.tag === 'template' && el.name
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed && !isTemplateWithName) {
    return genIf(el, state)
  } else if (isTemplateWithName && el.tmplProcessed) {
    return ''
  } else if (el.tag === 'template' && !el.name) {
    return genTemplateCaller(el, state)
  } else if (el.tag === 'block') {
    return genChildren(el, state) || ''
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
      if (el.tag === 'Program' || isTemplateWithName) {
        el.nodeFuncName = 'r'
        const importFuncName = (el.importFuncName = generateId())
        const codeInfo = getCurrentCodeInfo()
        const includeVector = codeInfo.ic
        const importVector = codeInfo.ti
        const oldIcLen = includeVector.length
        const oldTiLen = importVector.length
        if (!isTemplateWithName) {
          var newRootEle: any = el.children[0]
          newRootEle.nodeFuncName = 'r'
          newRootEle.importFuncName = importFuncName
        } else {
          var newRootEle: any = el
        }

        const children = el.inlineTemplate
          ? null
          : genChildren(newRootEle, state, true)
        const newIcLen = includeVector.length
        const newTiLen = importVector.length

        let icTop = ''
        let icBottom = ''
        if (newIcLen > oldIcLen) {
          const icName = generateId()
          icTop = `var ${icName} = e_["${codeInfo.path}"].j;`
          for (let icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
            icBottom += `${icName}.pop();`
          }
        }

        if (newTiLen > oldTiLen) {
          icTop = `var ${importFuncName} = e_["${codeInfo.path}"].i;${icTop}`
          for (let icIdx = newTiLen - 1; icIdx >= oldTiLen; icIdx--) {
            icBottom += `${importFuncName}.pop();`
          }
        }
        code = `${icTop}${children ? `${children}` : ''}${icBottom}`
      } else {
        const children = el.inlineTemplate ? null : genChildren(el, state, true)
        const dataLen = el.attributeList.length
        const env = el.env || 'e'
        const scope = el.scope || 's'
        if (dataLen === 0) {
          code = `var ${el.nodeFuncName || 'nodeFuncName error'} = _n("${el.tag}");${children ? `${children}` : ''}`
        } else if (dataLen === 1) {
          const attr = el.attributeList[0]
          code = `var ${el.nodeFuncName || 'nodeFuncName error2'} = _n("${el.tag}");`
          const propPos = propStore.map[attr.value]
          if (propPos < 0) {
            code += `${el.nodeFuncName || 'nodeFuncName error3'}.attr['${camelizeAttr(attr.name)}'] = true;`
          } else {
            code += `_r(${el.nodeFuncName || 'nodeFuncName error3'}, '${camelizeAttr(attr.name)}', ${propStore.map[attr.value]}, ${env}, ${scope}, gg);${children ? `${children}` : ''}`
          }
        } else {
          code = `var ${el.nodeFuncName || 'nodeFuncName error4'} = _m( "${el.tag}", ${data || 'data error'}, ${env}, ${scope}, gg);${children ? `${children}` : ''}`
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

  const importFuncName = (condition.block.importFuncName = generateId())
  const codeInfo = getCurrentCodeInfo()
  const includeVector = codeInfo.ic
  const importVector = codeInfo.ti
  const oldIcLen = includeVector.length
  const oldTiLen = importVector.length
  let childTmpl = genTernaryExp(condition.block)
  const newIcLen = includeVector.length
  const newTiLen = importVector.length

  if (newIcLen > oldIcLen) {
    const icName = generateId()
    childTmpl = `var ${icName} = e_["${codeInfo.path}"].j;${childTmpl};`
    for (let icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
      childTmpl += `${icName}.pop();`
      includeVector.pop()
    }
  }

  if (newTiLen > oldTiLen) {
    childTmpl = `var ${importFuncName} = e_["${codeInfo.path}"].i;${childTmpl};`
    for (let icIdx = newTiLen - 1; icIdx >= oldTiLen; icIdx--) {
      childTmpl += `${importFuncName}.pop();`
      importVector.pop()
    }
  }

  if (condition.block.if) {
    return `var ${nodeFuncName || 'nodeFuncName error'} = _v();
      if (_o(${propStore.map[condition.exp]}, ${env}, ${scope}, gg)) {
        ${nodeFuncName || 'nodeFuncName error'}.wxVkey = ${(vkey = 1)};${childTmpl}${pushChildTmpl}
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
    return altGen ? altGen(el, state) : genElement(el, state)
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
  // const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  // const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

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
  el.forProcessed = true // avoid recursion
  const parentnodeFuncName = el.nodeFuncName
  const forFuncId = generateId()
  const childnodeFuncName = generateId()
  const returnNodeName = generateId()
  el.nodeFuncName = childnodeFuncName
  el.blockFuncName = el.tag === 'block' || el.tag === 'include'
    ? returnNodeName
    : childnodeFuncName

  const oldScope = el.scope || 's'
  const newScope = (el.scope = generateId())
  const oldEnv = el.env || 'e'
  const newEnv = (el.env = generateId())

  const importFuncName = (el.importFuncName = generateId())

  const codeInfo = getCurrentCodeInfo()
  const includeVector = codeInfo.ic
  const importVector = codeInfo.ti
  const oldIcLen = includeVector.length
  const oldTiLen = importVector.length
  const children = `${(altGen || genElement)(el, state)}`
  const newIcLen = includeVector.length
  const newTiLen = importVector.length

  let icTop = ''
  let icBottom = ''
  if (newIcLen > oldIcLen) {
    const icName = generateId()
    icTop = `var ${icName} = e_["${codeInfo.path}"].j;`
    for (let icIdx = newIcLen - 1; icIdx >= oldIcLen; icIdx--) {
      icBottom += `${icName}.pop();`
      includeVector.pop()
    }
  }
  if (newTiLen > oldTiLen) {
    icTop = `var ${importFuncName} = e_["${codeInfo.path}"].i;${icTop}`
    for (let tiIdx = newTiLen - 1; tiIdx >= oldTiLen; tiIdx--) {
      icBottom += `${importFuncName}.pop();`
      importVector.pop()
    }
  }

  const cantainEle = isOneOf(el.tag, ['block', 'include'])
    ? ''
    : `_(${returnNodeName}, ${childnodeFuncName});`

  const code =
    `var ${parentnodeFuncName} = _v();` +
    `var ${forFuncId} = function(${newEnv},${newScope},${returnNodeName},gg){` +
    `${icTop}${children}${icBottom}${cantainEle}` +
    `return ${returnNodeName};` +
    '};' +
    `_2(${propStore.map[exp]}, ${forFuncId}, ${oldEnv}, ${oldScope}, gg, ${parentnodeFuncName}, "${el.alias}", "${el.iterator1}", '${el.key || ''}');`
  return code
}

export function genData (el: ASTElement, state: CodegenState): string {
  let data = ''
  if (el.attrs) {
    data += `${genProps(el.attrs)},`
  }
  data = data.replace(/,$/, '') + ''
  return data
}

function genTemplateCaller (el: ASTElement, state: CodegenState): string {
  // console.log(el)
  const container = el.nodeFuncName || 'name err'
  const isFunc = generateId()
  const tmplName = getCurrentCodeInfo().path
  const dataFunc = generateId()
  const compFunc = generateId()
  const env = el.env || 'e'
  const scope = el.scope || 's'
  const isProp = propStore.map[el.component]
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

function genScopedSlot (
  key: string,
  el: ASTElement,
  state: CodegenState
): string {
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  return (
    `{key:${key},fn:function(${String(el.attributeMap.scope)}){` +
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
  parent: any,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = parent.children

  if (children.length) {
    const gen = altGenNode || genNode

    return children
      .map(child => {
        const nodeFuncName = generateId()
        // console.log(child, nodeFuncName)
        if (
          (child.tag === 'include' && !child.if && !child.for) ||
          (child.tag === 'import' && !child.if) ||
          (child.tag === 'template' && child.name && child.tmplProcessed)
        ) {
          if (parent.tag === 'block') {
            return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.blockFuncName, parent.importFuncName)}`
          } else {
            return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)}`
          }
        } else if (parent.tag === 'block') {
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)}_(${parent.blockFuncName || 'error'},${nodeFuncName || 'error'});`
        } else if (child.tag === 'block' && !child.if && !child.for && !child.else && !child.elseif) {
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)}`
        } else {
          return `${gen(child, state, nodeFuncName, parent.env, parent.scope, parent.nodeFuncName, parent.importFuncName)}_(${parent.nodeFuncName || 'error'},${nodeFuncName});`
        }
      })
      .join('')
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

export function genText (
  text: ASTText | ASTExpression,
  parentName?: string,
  env?: string,
  scope?: string
): string {
  // const nodeFuncName = generateId()
  return `var ${parentName || 'error'} = _o(${propStore.map[text.text || 'error']}, ${env || 'e'}, ${scope || 's'}, gg);`
}

export function genComment (comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)});`
}

function genInclude (el: ASTElement, state: CodegenState) {
  const codeInfo = getCurrentCodeInfo()
  if (el.include) {
    codeInfo.ic.push(el.include)
  }
  return `_ic("${el.include || 'src error'}",e_, "${codeInfo.path}",${el.env || 'e'},${el.scope || 's'},${el.blockFuncName || 'r'},gg);`
}

function genImport (el: ASTElement, state: CodegenState) {
  const codeInfo = getCurrentCodeInfo()
  if (el.import) {
    codeInfo.ti.push(el.import)
  }
  return `_ai(${el.importFuncName || 'import name err'}, '${el.import || 'src error'}', e_, '${codeInfo.path}', 0, 0);`
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent (
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_m(${componentName},${genData(el, state)}${children ? `,${children}` : ''});`
}

function genProps (props: Array<{ name: string, value: string }>): string {
  let res = '['
  let initIdx
  props = props.sort((a, b) => propStore.map[a.value] - propStore.map[b.value])
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (!initIdx) {
      const idx = propStore.map[prop.value]
      res += `"${camelizeAttr(prop.name)}", ${idx},`
      if (idx >= 0) initIdx = idx
    } else {
      res += `"${camelizeAttr(prop.name)}", ${propStore.map[prop.value] - initIdx},`
    }
  }
  return res.slice(0, -1) + ']'
}

function getCurrentCodeInfo (): TemplateInfo {
  return propStore.codeInfoMap[templateIdx]
}

function isOneOf (obj: any, targets: Array<mixed>) {
  return targets.indexOf(obj) !== -1
}
