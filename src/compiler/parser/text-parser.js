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
    {
      ori: /(\\)([^nrt\\])/g,
      n: '\\x5c$2'
    },
    {
      ori: /&/g,
      n: '\\x26'
    },
    {
      ori: /\\$/g,
      n: '\\x5c'
    },
    {
      ori: /</g,
      n: '\\x3c'
    },
    {
      ori: />/g,
      n: '\\x3e'
    },
    {
      ori: /"/g,
      n: '\\x22'
    },
    {
      ori: /'/g,
      n: '\\x27'
    },
    {
      ori: /\n/g, // multiline to oneline
      n: '\\n'
    },
    {
      ori: /\r/g,
      n: '\\r'
    },
    {
      ori: /=/g,
      n: '\\x3d'
    }
  ]
  map.forEach(v => (str = str.replace(v.ori, v.n)))
  return str
}

export function parseText (
  text: string,
  opt?: {
    delimiters?: [string, string],
    wrapBracket?: boolean,
    inTag?: boolean,
  }
): string | void {
  const tagRE = opt && opt.delimiters
    ? buildRegex(opt.delimiters)
    : bracketInBracketTagRE

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
    const exp = parseExp(txt, opt && opt.wrapBracket) || ''
    tokens.push(exp)
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push(`[3, '${escapeTxt(text.slice(lastIndex))}']`)
  }

  if (tokens.length > 1 || (opt && opt.inTag)) {
    return `[a, ${tokens.join(',')}]`
  } else {
    return tokens.join('')
  }
}

export function walk (node: BabylonNode | void, isStatic?: boolean): string {
  function throwErr (node) {
    throw new Error(`No Match Case in ${node.type}`)
  }
  if (node) {
    switch (node.type) {
      case 'File':
        return walk(node.program)
      case 'Program':
        if (node.directives && node.directives.length === 1) {
          // directive string
          return walk(node.directives[0])
        } else if (node.body && node.body.length === 1) {
          // normal expresiions
          return walk(node.body[0])
        } else {
          throwErr(node)
        }
        break
      case 'ExpressionStatement':
        return walk(node.expression)
      case 'Identifier':
        if (node.name != null) {
          if (isStatic) {
            return `[3, "${node.name}"]`
          } else {
            return `[[7],[3, "${node.name}"]]`
          }
        } else {
          throwErr(node)
        }
        break
      case 'NumericLiteral':
      case 'BooleanLiteral':
      case 'RegExpLiteral':
        if (node.value != null) {
          return `[1, ${node.value}]`
        } else {
          throwErr(node)
        }
        break
      case 'DirectiveLiteral':
      case 'StringLiteral':
        if (node.value != null) {
          return `[1, "${node.value}"]`
        } else {
          throwErr(node)
        }
        break
      case 'NullLiteral':
        return `[1, false]`
      case 'LabeledStatement':
        if (node.label && node.body) {
          return `[[8],"${node.label.name || 'no name error'}", ${walk(node.body.expression)}]`
        } else {
          throwErr(node)
        }
        break
      case 'MemberExpression':
        return `[[6],${walk(node.object)},${walk(node.property, !node.computed)}]`
      case 'BinaryExpression':
        if (node.operator) {
          return `[[2, "${node.operator}"], ${walk(node.left)}, ${walk(node.right)}]`
        } else {
          throwErr(node)
        }
        break
      case 'LogicalExpression':
        if (node.operator && node.left) {
          return `[[2, "${node.operator}"],${walk(node.left)},${walk(node.right)}]`
        } else {
          throwErr(node)
        }
        break
      case 'UnaryExpression':
        if (node.operator) {
          return `[[2, "${node.operator}"], ${walk(node.argument)}]`
        } else {
          throwErr(node)
        }
        break
      case 'ArrayExpression':
        if (node.elements) {
          return `[[4], ${node.elements.reduce((p, c) => `[[5], ${p} ${p && ','} ${walk(c)}]`, '')}]`
        } else {
          throwErr(node)
        }
        break
      case 'SpreadProperty':
        return `[[10], ${walk(node.argument)}]`
      case 'ConditionalExpression':
        return `[[2,'?:'],${walk(node.test)},${walk(node.consequent)},${walk(node.alternate)}]`
      case 'ObjectExpression':
        if (node.properties != null) {
          if (node.properties.length === 1) {
            return node.properties.map(prop => walk(prop)).join(',')
          } else {
            let res = ''
            const props = node.properties || []
            res = `[[9], ${props
              .slice(0, 2)
              .map(prop => walk(prop))
              .join(',')}]`
            for (let i = 2, len = props.length; i < len; i++) {
              res = `[[9], ${res}, ${walk(props[i])}]`
            }
            return res
          }
        } else {
          throwErr(node)
        }
        break
      case 'Directive':
        return walk(node.value)
      case 'ThisExpression':
        return `[[7], [3, 'this']]`
      case 'ObjectProperty':
        if (node.key != null) {
          if (node.value != null && typeof node.value === 'object') {
            return `[[8], "${node.key.name || 'no name error'}", ${walk(node.value)}]`
          }
        } else {
          throwErr(node)
        }
        break
      case 'AssignmentExpression':
        return `assignment in wrong place`
      default:
        throw new Error(`Unknown Type: ${node.type}`)
    }
    return `Unknown Type: ${node.type}`
  } else {
    return ''
  }
}

export function walkExp (ast: Object, type: number): string {
  if (type === 0) {
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
