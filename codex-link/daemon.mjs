#!/usr/bin/env node
// Codex has no long-lived hook, so this small detached process stands in for the Claude mod's timers: it joins the
// yard (finding the terminal window on the way), heartbeats while the Codex process lives, reads context usage from
// the session transcript now and then, and sends `leave` when Codex exits or the lock is released by SessionEnd.
//   node daemon.mjs --session ID --cwd DIR [--model M] [--parent PID | --watch-pid PID] [--transcript FILE]
//                   [--heartbeat-ms N] [--no-terminal]
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lockPathFor, readLock, writeLock, isAlive, postEvents, ARENA_URL, HERE } from './shared.mjs'

const HEARTBEAT_MS = 5000
const VITALS_EVERY = 3            // heartbeats between transcript reads
const TRANSCRIPT_TAIL_BYTES = 256 * 1024
const SPAWN_RETRY_MS = 20000
const PS_TIMEOUT_MS = 15000

export function parseArgs(list) {
  const out = {}
  for (let i = 0; i < list.length; i++) {
    if (!list[i].startsWith('--')) continue
    const key = list[i].slice(2)
    if (list[i + 1] === undefined || list[i + 1].startsWith('--')) out[key] = true
    else out[key] = list[++i]
  }
  return out
}

const runPowerShell = script => new Promise(resolve => {
  const full = `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', full], { timeout: PS_TIMEOUT_MS, windowsHide: true }, (err, stdout) => resolve(err ? '' : String(stdout).trim()))
})

const WALK_UP = (pid, body) => `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; for ($i = 0; $i -lt 12 -and $p; $i++) { ${body}; $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" }`

/** Walks up from `pid`: the first ancestor named codex* is the process to watch; else `pid` itself. */
async function findCodexPid(pid) {
  if (process.platform !== 'win32') return pid
  const out = await runPowerShell(WALK_UP(pid, `if ($p.Name -like 'codex*') { Write-Output $p.ProcessId; break }`))
  return Number(out.split('\n').pop()) || pid
}

/** The first ancestor that owns a window (Windows Terminal, VS Code, a console), as the Claude mod reports it. */
async function findTerminal(pid) {
  if (process.platform !== 'win32') return null
  const out = await runPowerShell(WALK_UP(pid, `$proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue; if ($proc -and $proc.MainWindowHandle -ne 0) { Write-Output "$($proc.Id)|$($proc.MainWindowHandle)|$($proc.ProcessName)|$($proc.MainWindowTitle)"; break }`))
  const [wpid, hwnd, name, ...title] = out.split('\n').pop().split('|')
  return Number(wpid) > 0 ? { pid: Number(wpid), hwnd: Number(hwnd) || 0, name: name || '', title: title.join('|').trim() } : null
}

/** Context left (0–100) from the newest token-count record in the rollout transcript; null when nothing usable. */
export function contextLeftFromTranscript(file) {
  let text
  try {
    const size = fs.statSync(file).size
    const fd = fs.openSync(file, 'r')
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES), buf = Buffer.alloc(size - start)
    fs.readSync(fd, buf, 0, buf.length, start)
    fs.closeSync(fd)
    text = buf.toString('utf8')
  } catch { return null }
  for (const line of text.split('\n').reverse()) {
    if (!line.includes('token_count')) continue
    let row
    try { row = JSON.parse(line) } catch { continue }
    const info = row.payload?.info || row.info || row.payload
    const window = info?.model_context_window
    const used = info?.last_token_usage?.total_tokens ?? info?.total_token_usage?.total_tokens
    if (window > 0 && used >= 0) return Math.max(0, Math.round(100 - used / window * 100))
  }
  return null
}

/** Starts the yard server when a post failed, at most once per SPAWN_RETRY_MS (Windows only, like the Claude mod). */
function serverStarter() {
  let lastSpawnAt = 0
  return async () => {
    if (process.platform !== 'win32' || Date.now() - lastSpawnAt < SPAWN_RETRY_MS) return
    lastSpawnAt = Date.now()
    const dir = path.resolve(HERE, '..')
    await runPowerShell(`Start-Process -FilePath node -ArgumentList 'server/server.js' -WorkingDirectory '${dir}' -WindowStyle Hidden`)
  }
}

export async function runDaemon(args) {
  const session = args.session
  if (!session) throw new Error('--session is required')
  const lock = lockPathFor(session)
  const heartbeatMs = Number(args['heartbeat-ms'] || HEARTBEAT_MS)
  const startServer = serverStarter()
  const event = (type, extra = {}) => ({ type, session, ...extra })
  const state = { watchPid: Number(args['watch-pid'] || 0), terminal: null, lastHp: null, ticks: 0, timer: null }

  const join = async () => {
    const ok = await postEvents([event('join', { cwd: args.cwd || process.cwd(), model: args.model || '', agent: 'codex', terminal: state.terminal })])
    if (!ok) await startServer()
  }

  const leave = async reason => {
    clearInterval(state.timer)
    await postEvents([event('leave', { reason })])
    try { if (readLock(lock)?.pid === process.pid) fs.unlinkSync(lock) } catch { /* already gone */ }
    process.exit(0)
  }

  const tick = async () => {
    const current = readLock(lock)
    const released = !current || current.pid !== process.pid
    if (released || !isAlive(state.watchPid)) return leave(released ? 'exit' : 'process-exit')
    state.ticks += 1
    const events = [event('heartbeat')]
    if (args.transcript && state.ticks % VITALS_EVERY === 0) {
      const hp = contextLeftFromTranscript(args.transcript)
      if (hp != null && hp !== state.lastHp) { state.lastHp = hp; events.push(event('vitals', { hp })) }
    }
    if (!(await postEvents(events))) { await startServer(); await join() }   // the server came back and has forgotten us
  }

  const parent = Number(args.parent || 0)
  if (!state.watchPid) state.watchPid = parent ? await findCodexPid(parent) : process.ppid
  writeLock(lock, { pid: process.pid, watchPid: state.watchPid, session, arena: ARENA_URL })
  if (!args['no-terminal']) state.terminal = await findTerminal(state.watchPid)
  await join()
  state.timer = setInterval(() => { tick().catch(() => {}) }, heartbeatMs)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDaemon(parseArgs(process.argv.slice(2))).catch(() => process.exit(2))
}
