/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'
import {parse} from 'acorn'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const bracketInBracketTagRE =/\{\{((['"][^'"]+['"]|[^{}]+)+)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

export function parseText (
  text: string,
  delimiters?: [string, string]
): string | void {
  // const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  const tagRE = delimiters ? buildRegex(delimiters) : bracketInBracketTagRE
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index
  while ((match = tagRE.exec(text))) {
// console.log(match)
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push(JSON.stringify(text.slice(lastIndex, index)))
    }
    // tag token
    const exp = parseExp(match[1].trim())|| ''
    tokens.push(`_s(${exp})`)
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push(JSON.stringify(text.slice(lastIndex)))
  }
  return tokens.join('+')
}

export function parseExp (
  text: string
): string | void {
  let ast
  try {
    ast = parse(text)
  } catch(e) {
    try {
      ast = parse(`x={${text}}`)
    } catch (e) {
      throw new Error(`${text} contains syntax errs`)
    }
  } finally{
    return JSON.stringify(ast)
  }
}
