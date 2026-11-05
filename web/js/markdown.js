// A small Markdown renderer for the remote's answer rows: the subset the terminal shows (headings, bold, italics,
// code spans and fences, lists, quotes, tables, links, rules). Everything is HTML-escaped first; links only keep
// http(s) targets. No dependency, by design.
import { esc } from './util.js'

const FENCE = /^```/
const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^(-{3,}|\*{3,}|_{3,})\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

export function renderMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (FENCE.test(line)) { i = fence(lines, i, out); continue }
    if (RULE.test(line)) { out.push('<hr>'); i += 1; continue }
    const heading = line.match(HEADING)
    if (heading) { out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); i += 1; continue }
    if (TABLE_ROW.test(line) && TABLE_SEP.test(lines[i + 1] || '')) { i = table(lines, i, out); continue }
    if (BULLET.test(line) || NUMBERED.test(line)) { i = list(lines, i, out); continue }
    if (QUOTE.test(line)) { i = quote(lines, i, out); continue }
    if (line.trim() === '') { i += 1; continue }
    i = paragraph(lines, i, out)
  }
  return out.join('')
}

function fence(lines, start, out) {
  const lang = lines[start].slice(3).trim().toLowerCase()
  const body = []
  let i = start + 1
  while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++])
  out.push(`<div class="codebox"><div class="codebar"><span>${esc(lang || 'code')}</span><button type="button" class="copy" data-copy>복사</button></div><pre><code>${highlight(body.join('\n'), lang)}</code></pre></div>`)
  return Math.min(lines.length, i + 1)
}

// ---- a light syntax colouring: comments, strings, numbers and keywords, enough to read code at a glance
const KEYWORDS = new Set(('const let var function return if else for while do switch case break continue new class extends import export from default ' +
  'async await try catch finally throw typeof instanceof of in null undefined true false this super yield static get set delete void ' +
  'def lambda pass elif not and or is None True False with as print raise except global nonlocal ' +
  'fn pub struct impl enum match use mut let trait where type interface implements package func go defer chan select range ' +
  'then fi done esac local echo exit export source elif').split(' '))
const HASH_COMMENT_LANGS = new Set(['sh', 'bash', 'zsh', 'shell', 'python', 'py', 'yaml', 'yml', 'toml', 'ps1', 'powershell', 'ruby', 'rb', 'dockerfile', 'makefile', ''])
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g

export function highlight(code, lang = '') {
  const hashComments = HASH_COMMENT_LANGS.has(lang)
  const slashComments = !hashComments || lang === ''
  let out = '', last = 0
  for (const match of code.matchAll(TOKEN)) {
    const [whole, slashComment, hashComment, string, number, word] = match
    out += esc(code.slice(last, match.index))
    last = match.index + whole.length
    if (slashComment && slashComments) out += `<i class="tc">${esc(whole)}</i>`
    else if (hashComment && hashComments) out += `<i class="tc">${esc(whole)}</i>`
    else if (string) out += `<i class="ts">${esc(whole)}</i>`
    else if (number) out += `<i class="tn">${esc(whole)}</i>`
    else if (word && KEYWORDS.has(word)) out += `<i class="tk">${esc(whole)}</i>`
    else out += esc(whole)
  }
  return out + esc(code.slice(last))
}

function table(lines, start, out) {
  const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()))
  const head = cells(lines[start])
  let i = start + 2
  const rows = []
  while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]))
  out.push(`<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
  return i
}

function list(lines, start, out) {
  const ordered = NUMBERED.test(lines[start])
  const pattern = ordered ? NUMBERED : BULLET
  const items = []
  let i = start
  while (i < lines.length) {
    const item = lines[i].match(pattern)
    if (item) { items.push(item[1]); i += 1; continue }
    if (lines[i].trim() !== '' && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i += 1; continue }   // a wrapped item
    break
  }
  out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(item => `<li>${inline(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
  return i
}

function quote(lines, start, out) {
  const body = []
  let i = start
  while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].match(QUOTE)[1])
  out.push(`<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`)
  return i
}

function paragraph(lines, start, out) {
  const body = []
  let i = start
  const blockStart = l => FENCE.test(l) || HEADING.test(l) || BULLET.test(l) || NUMBERED.test(l) || QUOTE.test(l) || RULE.test(l) || (TABLE_ROW.test(l) && TABLE_SEP.test(lines[i + 1] || ''))
  while (i < lines.length && lines[i].trim() !== '' && !(i > start && blockStart(lines[i]))) body.push(lines[i++])
  out.push(`<p>${body.map(inline).join('<br>')}</p>`)
  return i
}

/** Inline marks on one escaped line: code spans are protected first so their contents stay literal. */
export function inline(raw) {
  const spans = []
  // a private-use character marks each protected span; it cannot occur in escaped text
  let text = esc(raw).replace(/`([^`]+)`/g, (_, code) => { spans.push(`<code>${code}</code>`); return `${spans.length - 1}` })
  text = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return text.replace(/(\d+)/g, (_, n) => spans[Number(n)])
}
