// The HTTP API as a route table: method, path pattern, handler. Handlers get the parsed request and return nothing;
// they answer through `res`. A handler that throws an HttpError answers with its status.
import { HttpError, readJson, sendJson } from './http.js'
import { focusTerminal } from './focus.js'
import { acceptsRemote } from './arena.js'

const EVENT_BODY_MAX = 2_000_000    // a chat dump of a long session runs well past a few KB
const PROMPT_BODY_MAX = 16_000
const TITLE_BODY_MAX = 4_000

/** Routes under /<kind>/<session> need a live warrior; the session id is the rest of the path, URL-encoded. */
function warriorOf(arena, params) {
  const session = decodeURIComponent(params.session)
  const warrior = arena.warriors.get(session)
  if (!warrior) throw new HttpError(404, 'no such warrior')
  return { session, warrior }
}

function remoteWarriorOf(arena, params) {
  const found = warriorOf(arena, params)
  if (!acceptsRemote(found.warrior)) throw new HttpError(409, `remote input is not available for a ${found.warrior.agent} session`)
  return found
}

export function routes({ arena, live }) {
  return [
    ['POST', '/event', async ({ req, res }) => {
      const body = await readJson(req, EVENT_BODY_MAX)
      const events = Array.isArray(body) ? body : [body]
      const applied = events.filter(event => arena.apply(event)).length
      sendJson(res, 200, { ok: true, applied })
    }],
    ['GET', '/state', ({ res }) => sendJson(res, 200, arena.snapshot())],
    ['GET', '/health', ({ res }) => sendJson(res, 200, { ok: true, warriors: arena.warriors.size, uptime: process.uptime() })],
    ['GET', '/events', ({ req, res }) => live.attachBrowser(req, res)],

    // ---- the remote: conversation rows for the page, prompts and renames from the page, the mod's inbox, the terminal
    ['GET', '/chat/:session', ({ res, params }) => {
      const { session } = warriorOf(arena, params)
      sendJson(res, 200, { session, rows: arena.remote.rowsOf(session) })
    }],
    ['POST', '/remote/:session', async ({ req, res, params }) => {
      const { session } = remoteWarriorOf(arena, params)
      const body = await readJson(req, PROMPT_BODY_MAX)
      const row = arena.remote.post(session, body && body.text)
      if (!row) throw new HttpError(400, 'empty text')
      sendJson(res, 200, { ok: true, row })
    }],
    ['GET', '/remote/:session', ({ req, res, params, url }) => {
      const { session } = warriorOf(arena, params)
      live.pollInbox(req, res, session, Number(url.searchParams.get('wait') || 0))
    }],
    ['POST', '/rename/:session', async ({ req, res, params }) => {
      const { session } = remoteWarriorOf(arena, params)
      const body = await readJson(req, TITLE_BODY_MAX)
      const item = arena.remote.rename(session, body && body.title)
      if (!item) throw new HttpError(400, 'empty title')
      sendJson(res, 200, { ok: true, item })
    }],
    ['POST', '/focus/:session', async ({ res, params }) => {
      const { warrior } = warriorOf(arena, params)
      if (!warrior.terminal) return sendJson(res, 404, { ok: false, error: 'no terminal known for this session', result: 'gone' })
      sendJson(res, 200, { ok: true, result: await focusTerminal(warrior.terminal), terminal: warrior.terminal })
    }],
  ]
}

/** Finds the route for a request: `{ handler, params }`, or `{ methodMismatch: true }` when only the method differs. */
export function matchRoute(table, method, pathname) {
  let methodMismatch = false
  for (const [routeMethod, pattern, handler] of table) {
    const params = matchPath(pattern, pathname)
    if (!params) continue
    if (routeMethod === method) return { handler, params }
    methodMismatch = true
  }
  return methodMismatch ? { methodMismatch } : null
}

function matchPath(pattern, pathname) {
  const colon = pattern.indexOf('/:')
  if (colon < 0) return pattern === pathname ? {} : null
  const prefix = pattern.slice(0, colon + 1), name = pattern.slice(colon + 2)
  if (!pathname.startsWith(prefix) || pathname.length === prefix.length) return null
  return { [name]: pathname.slice(prefix.length) }
}
