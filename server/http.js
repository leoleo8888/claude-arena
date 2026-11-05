// Plain node:http helpers: reading a JSON body, answering JSON, serving the static page.
import fs from 'node:fs'
import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
}
const CORS = { 'access-control-allow-origin': '*' }

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > maxBytes) { reject(new HttpError(413, 'body too large')); req.destroy() }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export async function readJson(req, maxBytes) {
  const body = await readBody(req, maxBytes)
  try { return JSON.parse(body) } catch { throw new HttpError(400, 'invalid json') }
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json', ...CORS })
  res.end(JSON.stringify(payload))
}

export function sendCorsPreflight(res) {
  res.writeHead(204, { ...CORS, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, GET' })
  res.end()
}

export function openEventStream(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', ...CORS })
  res.write('retry: 2000\n\n')
}

/** Serves a file under `root`; a path that escapes it or names nothing is a 404. */
export function serveStatic(root, pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const file = path.normalize(path.join(root, relative))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found') }
  // no-cache: the page is a graph of ES modules, and a stale one next to a fresh one breaks the import chain
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' })
  fs.createReadStream(file).pipe(res)
}
