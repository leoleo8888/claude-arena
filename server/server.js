// Arena server: POST /event from sessions, SSE /events to browsers, the remote API, static web/ pages.
// No dependencies. `node server/server.js [port]`  (default 4747, or ARENA_PORT)
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Arena } from './arena.js'
import { LedgerStore } from './ledger-store.js'
import { LiveClients } from './live.js'
import { routes, matchRoute } from './routes.js'
import { HttpError, sendJson, sendCorsPreflight, serveStatic } from './http.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB = path.join(ROOT, 'web')
const PORT = Number(process.argv[2] || process.env.ARENA_PORT || 4747)
const SWEEP_MS = 5000

const store = new LedgerStore(path.join(ROOT, 'data', 'ledger.json'))
const arena = new Arena(store.load())
const live = new LiveClients(arena)
const table = routes({ arena, live })

arena.subscribe(message => {
  if (message.kind !== 'chat' && message.kind !== 'remote') store.saveSoon(arena.ledger)
  live.relay(message)
})
const sweeper = setInterval(() => arena.sweep(), SWEEP_MS)
sweeper.unref()

/** Ctrl+C or a service stop: write the ledger now (the debounced save may be pending), close, exit. */
function shutdown() {
  clearInterval(sweeper)
  store.saveNow(arena.ledger)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1000).unref()   // open event streams keep close() waiting; do not
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('unhandledRejection', err => console.error('unhandled rejection', err))

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  try {
    if (req.method === 'OPTIONS') return sendCorsPreflight(res)
    const match = matchRoute(table, req.method, url.pathname)
    if (match && match.handler) return await match.handler({ req, res, url, params: match.params })
    if (match && match.methodMismatch) throw new HttpError(405, 'method not allowed')
    if (req.method === 'GET') return serveStatic(WEB, url.pathname, res)
    throw new HttpError(405, 'method not allowed')
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    sendJson(res, status, { ok: false, error: String(err.message || err) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`arena listening on http://127.0.0.1:${PORT}  (ledger: ${store.file})`)
})
