// Small pure helpers shared by every module.

export const levelOf = xp => Math.floor(Math.sqrt(xp / 10)) + 1
export const xpFor = level => level * level * 10

/** The ledger key of a project: its path, forward slashes, lower case, no trailing slash. */
export const projectKey = cwd => (cwd || 'unknown').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

export const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
export const $ = selector => document.querySelector(selector)
export const shortModel = model => (model || '').replace('claude-', '')

export const fmtDur = ms => {
  const minutes = Math.floor(ms / 60000)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Greedy word wrap to lines of at most `max` characters. */
export function wrap(text, max) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

/** Fisher–Yates on a copy. */
export function shuffle(items) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
