// What the hook forwarder and the daemon share: where the arena is, the per-session lock, and a quiet HTTP post.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ARENA_URL = process.env.ARENA_URL || 'http://127.0.0.1:4747'
export const POST_TIMEOUT_MS = 1500
const LOCK_DIR = path.join(os.tmpdir(), 'yard-codex')

export const lockPathFor = session => path.join(LOCK_DIR, `${session.replace(/[^\w.-]/g, '_')}.json`)

export function readLock(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

export function writeLock(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}

export function isAlive(pid) {
  if (!(pid > 0)) return false
  try { process.kill(pid, 0); return true } catch (err) { return err.code === 'EPERM' }
}

/** Posts yard events; resolves true when the arena answered. Never throws: Codex must not wait on the yard. */
export async function postEvents(events, timeoutMs = POST_TIMEOUT_MS) {
  try {
    const res = await fetch(`${ARENA_URL}/event`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(events), signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch { return false }
}
