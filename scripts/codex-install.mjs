// Writes the Gladiator Yard hooks into ~/.codex/hooks.json (merging with what is there), or removes them.
//   npm run codex:install            merge, keeping a backup of the previous file
//   npm run codex:install -- --print show the JSON without writing
//   npm run codex:install -- --remove
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = path.join(ROOT, 'codex-link', 'hook.mjs')
const CODEX_DIR = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
const FILE = path.join(CODEX_DIR, 'hooks.json')
const MARK = 'codex-link/hook.mjs'
// SessionEnd hooks get at most 3 s; the rest have time to spare, but a yard hook must never hold Codex up.
const EVENTS = { SessionStart: 10, UserPromptSubmit: 5, PreToolUse: 5, PostToolUse: 5, PermissionRequest: 5, Stop: 5, Interrupt: 3, SubagentStart: 5, SubagentStop: 5, SessionEnd: 3 }

const quote = p => `"${p.replace(/\\/g, '/')}"`
const ours = entry => JSON.stringify(entry).replace(/\\\\/g, '/').includes(MARK)

function yardHooks() {
  const out = {}
  for (const [event, timeout] of Object.entries(EVENTS)) {
    out[event] = [{ hooks: [{ type: 'command', command: `${quote(process.execPath)} ${quote(HOOK)}`, timeout, statusMessage: 'Gladiator Yard' }] }]
  }
  return out
}

function merge(existing, remove) {
  const hooks = { ...(existing.hooks || {}) }
  for (const event of Object.keys(EVENTS)) hooks[event] = (hooks[event] || []).filter(entry => !ours(entry))
  if (!remove) for (const [event, entries] of Object.entries(yardHooks())) hooks[event] = [...hooks[event], ...entries]
  for (const event of Object.keys(hooks)) if (hooks[event].length === 0) delete hooks[event]
  return { ...existing, hooks }
}

const flags = new Set(process.argv.slice(2))
let existing = {}
try { existing = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { /* no file yet */ }
const next = merge(existing, flags.has('--remove'))

if (flags.has('--print')) { console.log(JSON.stringify(next, null, 2)); process.exit(0) }
fs.mkdirSync(CODEX_DIR, { recursive: true })
if (fs.existsSync(FILE)) fs.copyFileSync(FILE, `${FILE}.bak-${Date.now()}`)
fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n')
console.log(`${flags.has('--remove') ? 'removed the yard hooks from' : 'wrote the yard hooks to'} ${FILE}`)
if (!flags.has('--remove')) console.log('Next: start codex, run /hooks, and trust the "Gladiator Yard" hooks once (they are skipped until trusted).')
