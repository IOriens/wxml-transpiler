/* @flow */

import { cached } from 'shared/util'
// import { parseFilters } from './filter-parser'
import { parse } from 'babylon'

// const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const bracketInBracketTagRE = /\{\{((['"][^'"]+['"]|[^{}]+)+)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

const escapeTxt = function (str) {
  const map = [
    { ori: /"/g, n: '\\x22' },
    { ori: /'/g, n: '\\x27' },
    { ori: /\\/g, n: '\\x5c' },
    { ori: /\n/g, n: '\\n' },
    { ori: /=/g, n: '\\x3d' },
    { ori: /&/g, n: '\\x26' }
  ]
  map.forEach(v => (str = str.replace(v.ori, v.n)))
  return str
}

export function parseText (
  text: string,
  delimiters?: [string, string],
  wrapBracket?: boolean
): string | void {
  // const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  const tagRE = delimiters ? buildRegex(delimiters) : bracketInBracketTagRE

  if (!tagRE.test(text)) {
    return `[3, '${escapeTxt(text)}']`
  }
  const tokens = []
  let lastIndex = (tagRE.lastIndex = 0)
  let match, index
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push(`[3, '${escapeTxt(text.slice(lastIndex, index))}']`)
    }
    // tag token
    const txt = match[1].trim()
    const exp = parseExp(txt, wrapBracket) || ''
    tokens.push(exp)
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push(`[3, '${escapeTxt(text.slice(lastIndex))}']`)
  }

  if (tokens.length > 1) {
    return `[a, ${tokens.join(',')}]`
  } else {
    return tokens.join('')
  }
}

export function walk (node: BabylonNode | void, isStatic?: boolean): string {
  if (node) {
    let res = 'Unknown Type'
    switch (node.type) {
      case 'File':
        res = walk(node.program)
        break
      case 'Program':
        if (node.directives && node.directives.length === 1) {
          // directive string
          res = walk(node.directives[0])
          break
        } else if (node.body && node.body.length === 1) {
          // normal expresiions
          res = walk(node.body[0])
          break
        } else {
          res = `Error in ${node.type}`
        }
      case 'ExpressionStatement':
        res = walk(node.expression)
        break
      case 'Identifier':
        if (node.name) {
          if (isStatic) {
            res = `[3, "${node.name}"]`
          } else {
            res = `[[7],[3, "${node.name}"]]`
          }
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      // case 'Literal':
      //   if (node.raw) res = `[1, ${node.raw}]`
      //   break
      case 'NumericLiteral':
      case 'BooleanLiteral':
      case 'RegExpLiteral':
        if (node.value) {
          res = `[1, ${node.value}]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'DirectiveLiteral':
      case 'StringLiteral':
        if (node.value) {
          res = `[1, "${node.value}"]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'NullLiteral':
        res = `[1, false]`
        break
      case 'LabeledStatement':
        if (node.label && node.body) {
          res = `[[8],"${node.label.name || 'no name error'}", ${walk(node.body.expression)}]`
          break
        }
      case 'MemberExpression':
        res = `[[6],${walk(node.object)},${walk(node.property, !node.computed)}]`
        break
      case 'BinaryExpression':
        if (node.operator) {
          res = `[[2, "${node.operator}"], ${walk(node.left)}, ${walk(node.right)}]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'LogicalExpression':
        if (node.operator && node.left) {
          res = `[[2, "${node.operator}"],${walk(node.left)},${walk(node.right)}]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'UnaryExpression':
        if (node.operator) {
          res = `[[2, "${node.operator}"], ${walk(node.argument)}]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'ArrayExpression':
        if (node.elements) {
          res = `[[4], ${node.elements.reduce((p, c) => `[[5], ${p} ${p && ','} ${walk(c)}]`, '')}]`
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'SpreadProperty':
        res = `[[10], ${walk(node.argument)}]`
        break
      case 'ConditionalExpression':
        res = `[[2,'?:'],${walk(node.test)},${walk(node.consequent)},${walk(node.alternate)}]`
        break
      case 'ObjectExpression':
        if (node.properties) {
          if (node.properties.length === 1) {
            return node.properties.map(prop => walk(prop)).join(',')
          } else {
            res = `[[9], ${node.properties.map(prop => walk(prop)).join(',')}]`
          }
          break
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'Directive':
        res = walk(node.value)
        break
      case 'ObjectProperty':
        // case 'Property':
        if (node.key) {
          if (node.value && typeof node.value === 'object') {
            res = `[[8], "${node.key.name || 'no name error'}", ${walk(node.value)}]`
            break
          }
        } else {
          res = `Prop Lost in ${node.type}`
        }
      case 'AssignmentExpression':
        console.log(node)
        res = `assignment in wrong place`
      default:
        throw new Error((res = `${res}: ${node.type}`))
    }
    return res
  } else {
    return ''
  }
}

export function walkExp (ast: Object, type: number): string {
  if (type === 0) {
    // if (ast.program.body[0].expression) {
    //   return walk(ast.program.body[0].expression)
    // } else if (ast.program.body[0]) return walk(ast.program.body[0])
    return walk(ast)
  } else if (type === 1) {
    return walk(ast.program.body[0].expression.right)
  }
  return JSON.stringify(ast)
}

export function parseExp (txt: string, wrapBracket?: boolean): string | void {
  let ast: BabylonNode
  const text = wrapBracket ? `x={${txt}}` : txt
  try {
    ast = parse(text, {
      plugins: ['objectRestSpread']
    })
    if (wrapBracket) {
      return walkExp(ast, 1)
    } else {
      return walkExp(ast, 0)
    }
  } catch (e) {
    e.name += ` parsing statement => ${txt} <= `
    throw e
  }
}
