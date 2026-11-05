#!/usr/bin/env node
// End to end without an OpenAI account: start the mock model, run one `codex exec` turn against it with the yard
// hooks forced on, and watch the arena for the codex warrior's journey (join, quest, fight, answer, leave).
//   npm run codex:e2e        (needs codex on PATH, the yard server on 4747, and hooks installed via codex:install)
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMockModel } from './mock-model.mjs'

const ARENA = process.env.ARENA_URL || 'http://127.0.0.1:4747'
const MODEL_PORT = 4799
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const model = await startMockModel(MODEL_PORT)
const seen = new Map()   // session -> { name, log: Set of lines, chat: rows }
const watch = setInterval(async () => {
  try {
    const { warriors } = await (await fetch(`${ARENA}/state`)).json()
    for (const w of warriors.filter(w => w.agent === 'codex')) {
      const entry = seen.get(w.session) || { name: w.name, log: [], chat: [] }
      for (const line of w.log) if (!entry.log.some(l => l.t === line.t && l.text === line.text)) entry.log.push(line)
      entry.terminal = w.terminal; entry.hp = w.hp
      try { entry.chat = (await (await fetch(`${ARENA}/chat/${encodeURIComponent(w.session)}`)).json()).rows } catch { /* keep */ }
      seen.set(w.session, entry)
    }
  } catch { /* arena not up yet */ }
}, 250)

// Everything this run needs goes in as `-c` overrides, so nothing is written to ~/.codex: the mock provider, and
// the yard hooks themselves as inline TOML (the same commands `codex:install` would persist).
const HOOK_EVENTS = { SessionStart: 10, UserPromptSubmit: 5, PreToolUse: 5, PostToolUse: 5, PermissionRequest: 5, Stop: 5, Interrupt: 3, SubagentStart: 5, SubagentStop: 5, SessionEnd: 3 }
const hookCommand = `"${process.execPath.replace(/\\/g, '/')}" "${path.join(ROOT, 'codex-link', 'hook.mjs').replace(/\\/g, '/')}"`
const overrides = {
  model_provider: '"yardmock"',
  'model_providers.yardmock.name': '"Yard mock model"',
  'model_providers.yardmock.base_url': `"http://127.0.0.1:${MODEL_PORT}/v1"`,
  'model_providers.yardmock.wire_api': '"chat"',
  'model_providers.yardmock.env_key': '"YARD_MOCK_KEY"',
  model: '"mock-1"',
}
for (const [event, timeout] of Object.entries(HOOK_EVENTS)) {
  overrides[`hooks.${event}`] = `[{hooks=[{type="command",command=${JSON.stringify(hookCommand)},timeout=${timeout}}]}]`
}
const args = ['exec', '--skip-git-repo-check', '--dangerously-bypass-hook-trust', '--full-auto', '-C', ROOT]
for (const [key, value] of Object.entries(overrides)) args.push('-c', `${key}=${value}`)
args.push('연습장 hooks 점검: 명령 하나 실행하고 끝내줘')

// Spawn codex's own entry script with node: no shell, so the TOML in the overrides reaches codex untouched.
const codexJs = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
console.log('[e2e] codex exec with', Object.keys(overrides).length, 'overrides (mock provider + hooks), cwd', ROOT)
const codex = spawn(process.execPath, [codexJs, ...args], { env: { ...process.env, YARD_MOCK_KEY: 'mock' }, stdio: ['ignore', 'pipe', 'pipe'] })

codex.stdout.on('data', d => process.stdout.write(d))
codex.stderr.on('data', d => process.stderr.write(d))
const code = await new Promise(resolve => codex.on('close', resolve))
await sleep(1500)   // SessionEnd's leave and the daemon's own leave
clearInterval(watch)
model.close()

console.log(`\n[e2e] codex exited with ${code}; codex warriors seen in the yard: ${seen.size}`)
for (const [session, entry] of seen) {
  console.log(`\n[e2e] session ${session.slice(0, 8)} "${entry.name}"  terminal=${entry.terminal ? entry.terminal.name : 'none'}  hp=${entry.hp}`)
  for (const line of entry.log) console.log(`  log  ${line.text}`)
  for (const row of entry.chat) console.log(`  chat ${row.role}: ${row.text.slice(0, 80).replace(/\n/g, ' ')}`)
}
process.exit(seen.size > 0 ? 0 : 1)
