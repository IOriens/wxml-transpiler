/* @flow */

// import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
// import { parseFilters } from './filter-parser'
import { no } from 'shared/util'
// import { genAssignmentCode } from '../directives/model'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addAttr,
  baseWarn,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'

export const onRE = /^@|^v-on:/
export const dirRE = /^v-|^@|^:/

// https://mp.weixin.qq.com/debug/wxadoc/dev/framework/view/wxml/list.html
// ({{object name|array|expression}})|string
export const tplBracket = /(?:{{\s*(.+)\s*}}|(.+))/

// const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn
let delimiters
// let transforms
let preTransforms
let postTransforms
let platformIsPreTag
// let platformMustUseProp
let platformGetTagNamespace
let propStore
/**
 * Convert HTML string to AST.
 */
export function parse (
  template: string,
  globStore: Object,
  options: CompilerOptions
): ASTElement {
  warn = options.warn || baseWarn

  platformIsPreTag = options.isPreTag || no
  // platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no

  // transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  delimiters = options.delimiters
  propStore = globStore

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false

  const root: ASTElement = {
    type: 1,
    tag: 'Program',
    attributeList: [],
    attributeMap: makeAttrsMap([]),
    parent: void 0,
    children: []
  }

  let currRoot = root
  let currentParent
  let inVPre = false
  let inPre = false
  let warned = false

  function warnOnce (msg) {
    console.warn(msg)
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

  function endPre (element) {
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldKeepComment: options.comments,
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      const ns =
        (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      const element: ASTElement = {
        type: 1,
        tag,
        attributeList: attrs,
        attributeMap: makeAttrsMap(attrs),
        parent: currentParent,
        children: []
      }
      propStore.tags.push(tag)
      if (ns) {
        element.ns = ns
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' &&
          warn(
            'Templates should only be responsible for mapping the state to the ' +
              'UI. Avoid placing tags with side-effects in your templates, such as ' +
              `<${tag}>` +
              ', as they will not be parsed.'
          )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options)
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else {
        processFor(element)
        processIf(element)
        processOnce(element)
        processKey(element)
        // determine whether this is a plain element after
        // removing structural attributes
        element.plain = !element.key && !attrs.length
        processInclude(element)
        processImport(element)
        processComponent(element)
        processAttrs(element)
      }

      // tree management
      if (!root.children.length) {
        root.children.push(element)
        currRoot = element
        // checkRootConstraints(element)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        if (currRoot.if && (element.elseif || element.else)) {
          // checkRootConstraints(element)
          addIfCondition(currRoot, {
            exp: element.elseif,
            block: element
          })
        } else {
          root.children.push(element)
          currRoot = element
        }
      }
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        } else if (element.slotScope) {
          // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[
            name
          ] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        endPre(element)
      }
      // apply post-transforms
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    },

    end () {
      // remove trailing whitespace
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      endPre(element)
    },

    chars (text: string) {
      // parse text in tags
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            warnOnce(`text "${text}" outside root element will be ignored.`)
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (
        isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attributeMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      // only preserve whitespace if its not right after a starting tag
      text = inPre || text.trim()
        ? text
        : preserveWhitespace && children.length ? ' ' : ''
      if (text) {
        let expression
        if (
          !inVPre &&
          text !== ' ' &&
          (expression = parseText(text, {
            delimiters: delimiters,
            inTag: true
          }))
        ) {
          pushProp(text, { inTag: true })

          children.push({
            type: 2,
            expression,
            text
          })
        }
        // else if (
        //   text !== ' ' ||
        //   !children.length ||
        //   children[children.length - 1].text !== ' '
        // ) {
        //   // pushProp(text)
        //   // children.push({
        //   //   type: 3,
        //   //   text
        //   // })
        // }
      }
    },
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })
  return root
}

function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

function processRawAttrs (el) {
  const l = el.attributeList.length
  if (l) {
    const attrs = (el.attrs = new Array(l))
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attributeList[i].name,
        value: JSON.stringify(el.attributeList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

function processKey (el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(
        `<template> cannot be keyed. Place the key on real elements instead.`
      )
    }
    el.key = exp
  }
}

function processFor (el) {
  if (el.tag === 'import') {
    getAndRemoveAttr(el, 'wx:for')
    getAndRemoveAttr(el, 'wx:for-items')
    return
  }
  let exp =
    getAndRemoveAttr(el, 'wx:for') || getAndRemoveAttr(el, 'wx:for-items')
  if (exp) {
    const inMatch = exp.match(tplBracket)
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' &&
        warn(`Invalid wx:for expression: ${exp}`)
      return
    }

    el.for = exp
    pushProp(exp)
    if ((exp = getAndRemoveAttr(el, 'wx:for-item'))) {
      el.alias = exp
      pushProp(exp)
    } else {
      el.alias = 'item'
    }
    if ((exp = getAndRemoveAttr(el, 'wx:for-index'))) {
      el.iterator1 = exp
      pushProp(exp)
    } else {
      el.iterator1 = 'index'
    }
    if ((exp = getAndRemoveAttr(el, 'wx:key'))) {
      el.key = exp
      pushProp(exp)
    } else {
      el.key = ''
    }
  }
}

function processIf (el) {
  const exp = getAndRemoveAttr(el, 'wx:if')
  if (exp) {
    const inMatch = exp.match(tplBracket)
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' &&
        warn(`Invalid wx:if expression: ${exp}`)
      return
    }

    const ifExp = inMatch[0]
    el.if = ifExp
    pushProp(ifExp)

    addIfCondition(el, {
      exp: ifExp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'wx:else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'wx:elif')
    if (elseif) {
      const inMatch = elseif.match(tplBracket)
      if (!inMatch) {
        process.env.NODE_ENV !== 'production' &&
          warn(`Invalid wx:if expression: ${elseif}`)
        return
      }
      const elifExp = inMatch[0]
      el.elseif = elifExp
      pushProp(elifExp)
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? 'else-if="' + el.elseif + '"' : 'else'} ` +
        `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}

function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
            `will be ignored.`
        )
      }
      children.pop()
    }
  }
}

function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

// function processSlot (el) {
//   if (el.tag === 'slot') {
//     el.slotName = getBindingAttr(el, 'name')
//     if (process.env.NODE_ENV !== 'production' && el.key) {
//       warn(
//         `\`key\` does not work on <slot> because slots are abstract outlets ` +
//           `and can possibly expand into multiple elements. ` +
//           `Use the key on a wrapping element instead.`
//       )
//     }
//   } else {
//     const slotTarget = getBindingAttr(el, 'slot')
//     if (slotTarget) {
//       el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
//     }
//     if (el.tag === 'template') {
//       el.slotScope = getAndRemoveAttr(el, 'scope')
//     }
//   }
// }

function processInclude (el) {
  if (el.tag === 'include') {
    const src = getAndRemoveAttr(el, 'src')
    if (src) {
      el.include = src
    } else {
      throw new Error('must have src attribute in include tag')
    }
  }
}

function processImport (el) {
  if (el.tag === 'import') {
    const src = getAndRemoveAttr(el, 'src')
    if (src) {
      el.import = src
    } else {
      throw new Error('must have src attribute in include tag')
    }
  }
}

function processComponent (el) {
  let binding, data
  if (el.tag === 'template') {
    if ((binding = getAndRemoveAttr(el, 'name'))) {
      el.name = binding
      getCurrentCodeInfo().templates.push({ path: binding, tmpl: el })
    } else if ((binding = getAndRemoveAttr(el, 'is'))) {
      el.component = binding
      pushProp(binding)
    }
  }
  // else if (el.tag === 'wxs') {
  //   binding = getAndRemoveAttr(el, 'module')
  //   el.module = binding
  //   pushProp(binding)
  // }
  if ((data = getAndRemoveAttr(el, 'data'))) {
    el.data = data + 'is'
    pushProp(data, { wrapBracket: true })
  }
}

function processAttrs (el) {
  const list = el.attributeList.sort((a, b) => (a.name > b.name ? 1 : -1))
  let i, l, name, value
  for ((i = 0), (l = list.length); i < l; i++) {
    name = list[i].name
    value = list[i].value

    pushProp(value)

    addAttr(el, name, value)
  }
}

function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] &&
      !isIE &&
      !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' &&
      (!el.attributeMap.type || el.attributeMap.type === 'text/javascript'))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function pushProp (
  exp: string,
  opt?: { optExp?: string, wrapBracket?: boolean, inTag?: boolean }
) {
  const key = exp + (opt && opt.wrapBracket ? 'is' : '')
  if (propStore.map[key] == null) {
    if (exp) {
      propStore.map[key] = propStore.props.length
      propStore.props.push(
        parseText(
          (opt && opt.optExp) || exp,
          {
            wrapBracket: opt && opt.wrapBracket,
            inTag: opt && opt.inTag
          }
          // opt && ,
          // opt &&
        )
      )
    } else {
      propStore.map[key] = -1
    }
  }
}

function getCurrentCodeInfo (): TemplateInfo {
  return propStore.codeInfoMap.slice(-1)[0]
}
