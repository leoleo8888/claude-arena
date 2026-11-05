// Who is waiting on the arena right now: browsers on the event stream, and mods long-polling their inbox.
import { sendJson, openEventStream } from './http.js'

const PING_MS = 15_000
export const LONG_POLL_MAX_MS = 25_000

export class LiveClients {
  constructor(arena) {
    this.arena = arena
    this.browsers = new Set()    // SSE responses
    this.waiters = new Set()     // { session, res, timer }: GET /remote/<session>?wait=… held until an item arrives
    setInterval(() => { for (const res of this.browsers) res.write(': ping\n\n') }, PING_MS).unref()
  }

  /** Sends an arena event to every browser, or answers the mods waiting for that session's inbox. */
  relay(message) {
    if (message.kind === 'remote') { for (const waiter of [...this.waiters]) if (waiter.session === message.session) this.answer(waiter); return }
    for (const res of this.browsers) this.write(res, message.kind, message)
  }

  write(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }

  attachBrowser(req, res) {
    openEventStream(res)
    this.write(res, 'snapshot', this.arena.snapshot())
    this.browsers.add(res)
    req.on('close', () => this.browsers.delete(res))
  }

  /** Answers at once when the inbox has items (or no wait was asked); otherwise holds the response up to `waitMs`. */
  pollInbox(req, res, session, waitMs) {
    const items = this.arena.remote.take(session)
    const wait = Math.min(LONG_POLL_MAX_MS, Math.max(0, waitMs))
    if (items.length > 0 || wait === 0) return sendJson(res, 200, { items })
    const waiter = { session, res, timer: null }
    waiter.timer = setTimeout(() => this.answer(waiter), wait)
    this.waiters.add(waiter)
    req.on('close', () => { clearTimeout(waiter.timer); this.waiters.delete(waiter) })
  }

  answer(waiter) {
    clearTimeout(waiter.timer)
    this.waiters.delete(waiter)
    sendJson(waiter.res, 200, { items: this.arena.remote.take(waiter.session) })
  }
}
