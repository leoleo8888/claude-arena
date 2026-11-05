// The remote desk: each session's conversation rows (memory only, never on disk) and its inbox of items typed on
// the page, which the session's mod pulls: a prompt to submit as the person's own words, or a new session name.

export const CHAT_ROWS = 200
export const CHAT_TEXT_MAX = 8000
export const REMOTE_TEXT_MAX = 4000
export const TITLE_MAX = 60
const CHAT_ROLES = new Set(['user', 'assistant', 'notice'])
const PENDING_STATES = new Set(['queued', 'sent'])

export const cleanTitle = title => (typeof title === 'string' ? title.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX) : '')

export class RemoteDesk {
  /** @param emit (kind, payload) => void: 'chat' rows for the page, 'remote' when an inbox item arrives */
  constructor(emit) {
    this.emit = emit
    this.rows = new Map()     // session -> [{ id, t, role, text, via?, state?, error? }]
    this.inbox = new Map()    // session -> [{ id, kind: 'prompt' | 'rename', text }]
    this.seq = 0
  }

  rowsOf(session) {
    if (!this.rows.has(session)) this.rows.set(session, [])
    return this.rows.get(session)
  }

  /** Validates and trims one row; null when it is not a chat row at all. */
  makeRow(row, now) {
    if (!row || !CHAT_ROLES.has(row.role) || typeof row.text !== 'string') return null
    const text = row.text.length > CHAT_TEXT_MAX ? `${row.text.slice(0, CHAT_TEXT_MAX)}\n…(${row.text.length - CHAT_TEXT_MAX}자 생략)` : row.text
    const made = { id: ++this.seq, t: typeof row.t === 'number' ? row.t : now, role: row.role, text }
    if (row.via === 'remote') { made.via = 'remote'; made.state = row.state || 'queued' }
    return made
  }

  add(session, row, now = Date.now()) {
    const made = this.makeRow(row, now)
    if (!made) return null
    const rows = this.rowsOf(session)
    rows.push(made)
    this.trim(rows)
    this.emit('chat', { session, row: made })
    return made
  }

  /** The mod's transcript dump on join: replaces (or extends) what we hold. */
  addAll(session, rows, now, reset = false) {
    if (reset) this.rows.set(session, [])
    const kept = this.rowsOf(session)
    for (const row of rows.slice(-CHAT_ROWS)) { const made = this.makeRow(row, now); if (made) kept.push(made) }
    this.trim(kept)
    this.emit('chat', { session, rows: kept, reset: true })
  }

  trim(rows) { if (rows.length > CHAT_ROWS) rows.splice(0, rows.length - CHAT_ROWS) }

  /** A user row that repeats a remote prompt still pending is that prompt starting, not a new row. */
  markStarted(session, text) {
    const pending = [...this.rowsOf(session)].reverse().find(row => row.via === 'remote' && PENDING_STATES.has(row.state))
    if (!pending || pending.text !== text.trim()) return false
    pending.state = 'started'
    this.emit('chat', { session, row: pending })
    return true
  }

  ack(session, id, state, error) {
    const row = this.rowsOf(session).find(r => r.id === id && r.via === 'remote')
    if (!row) return
    row.state = state === 'failed' ? 'failed' : 'sent'
    if (state === 'failed') row.error = String(error || '').slice(0, 200)
    this.emit('chat', { session, row })
  }

  /** A prompt typed on the page: shown at once as a queued user row, handed to the mod on its next pull. */
  post(session, text, now = Date.now()) {
    const clean = typeof text === 'string' ? text.trim().slice(0, REMOTE_TEXT_MAX) : ''
    if (clean === '') return null
    const row = this.add(session, { role: 'user', text: clean, via: 'remote', state: 'queued' }, now)
    this.enqueue(session, { id: row.id, kind: 'prompt', text: clean })
    return row
  }

  /** A new name typed on the page: the mod runs /rename with it once the session is idle. */
  rename(session, title, now = Date.now()) {
    const clean = cleanTitle(title)
    if (clean === '') return null
    const row = this.add(session, { role: 'notice', text: `이름 변경 요청: ${clean}` }, now)
    const item = { id: row.id, kind: 'rename', text: clean }
    this.enqueue(session, item)
    return item
  }

  enqueue(session, item) {
    if (!this.inbox.has(session)) this.inbox.set(session, [])
    this.inbox.get(session).push(item)
    this.emit('remote', { session, id: item.id })
  }

  take(session) {
    const items = this.inbox.get(session) || []
    this.inbox.delete(session)
    return items
  }

  drop(session) { this.rows.delete(session); this.inbox.delete(session) }
}
