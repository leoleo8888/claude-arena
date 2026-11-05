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
  const lang = lines[start].slice(3).trim()
  const body = []
  let i = start + 1
  while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++])
  out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`)
  return Math.min(lines.length, i + 1)
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
