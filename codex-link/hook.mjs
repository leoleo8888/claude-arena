#!/usr/bin/env node
// Codex CLI hook forwarder. Codex runs this on each hook event with the payload on stdin; it maps the event to
// yard events and posts them to the arena. It never blocks Codex: nothing on stdout, exit 0, short timeouts.
// Configure with `npm run codex:install` (writes ~/.codex/hooks.json), then trust the hooks once in Codex's /hooks.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lockPathFor, readLock, isAlive, postEvents, HERE } from './shared.mjs'

const TARGET_MAX = 28
const NOTE_MAX = 60

/** The yard events for one Codex hook payload. Pure, so the tests can cover every event. */
export function eventsFor(payload) {
  const session = payload.session_id
  if (typeof session !== 'string' || session === '') return []
  const base = { session }
  switch (payload.hook_event_name) {
    case 'SessionStart':
    case 'SessionEnd':
      // join is the daemon's job (it also finds the terminal window); leave is sent here and the daemon notices the lock go.
      return payload.hook_event_name === 'SessionEnd' ? [{ ...base, type: 'leave', reason: payload.reason || 'exit' }] : []
    case 'UserPromptSubmit': {
      const text = String(payload.prompt || '').trim()
      return text === '' ? [] : [{ ...base, type: 'turn.start', text: text.split('\n')[0] }, { ...base, type: 'chat', role: 'user', text }]
    }
    case 'PreToolUse':
      return [{ ...base, type: 'fight', phase: 'start', tool: payload.tool_name, target: targetOf(payload.tool_name, payload.tool_input) }]
    case 'PostToolUse':
      return [{ ...base, type: 'fight', phase: failed(payload.tool_response) ? 'fail' : 'win', tool: payload.tool_name }]
    case 'PermissionRequest':
      return [{ ...base, type: 'chat', role: 'notice', text: `권한 승인 대기: ${payload.tool_name || ''}`.slice(0, NOTE_MAX) }]
    case 'Stop': {
      const text = String(payload.last_assistant_message || '').trim()
      const events = [{ ...base, type: 'turn.complete', reason: 'answer' }]
      if (text !== '') events.push({ ...base, type: 'chat', role: 'assistant', text })
      return events
    }
    case 'Interrupt':
      return [{ ...base, type: 'turn.complete', reason: 'aborted' }]
    case 'SubagentStart':
      return [{ ...base, type: 'squire', phase: 'join', id: payload.agent_id, description: payload.agent_type || 'agent' }]
    case 'SubagentStop':
      return [{ ...base, type: 'squire', phase: 'leave', id: payload.agent_id }]
    default:
      return []
  }
}

/** A short label for the thing a tool call touches: the command's start, or a path's last segment. */
export function targetOf(tool, input) {
  if (!input || typeof input !== 'object') return ''
  const command = Array.isArray(input.command) ? input.command.join(' ') : input.command
  if (typeof command === 'string' && command !== '') return cut(command.split('\n')[0], TARGET_MAX)
  if (typeof input.patch === 'string') {
    const file = input.patch.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/)
    if (file) return basename(file[1])
  }
  for (const key of ['path', 'file_path', 'filename', 'pattern', 'query', 'url', 'description']) {
    const value = input[key]
    if (typeof value === 'string' && value !== '') return key === 'query' || key === 'description' ? cut(value, TARGET_MAX) : basename(value)
  }
  return ''
}

const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const basename = p => cut(p.trim().split(/[\\/]/).pop() || p, TARGET_MAX)

/** Best-effort failure detection on a tool's response, whose shape depends on the tool. */
export function failed(response) {
  if (!response || typeof response !== 'object') return false
  if (response.is_error === true || response.success === false || response.error) return true
  const code = response.exit_code ?? response.exitCode ?? response.metadata?.exit_code
  return typeof code === 'number' && code !== 0
}

/** Starts the heartbeat daemon for this session unless one already runs (SessionStart fires on resume and clear too). */
function ensureDaemon(payload) {
  if (process.env.YARD_NO_DAEMON === '1') return
  const lock = readLock(lockPathFor(payload.session_id))
  if (lock && isAlive(lock.pid)) return
  const args = [path.join(HERE, 'daemon.mjs'), '--session', payload.session_id, '--cwd', payload.cwd || process.cwd(), '--model', payload.model || '',
    '--parent', String(process.ppid), '--transcript', payload.transcript_path || '']
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true, env: process.env })
  child.unref()
}

function releaseDaemon(payload) {
  try { fs.unlinkSync(lockPathFor(payload.session_id)) } catch { /* no daemon, or already gone */ }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let payload
  try { payload = JSON.parse(await readStdin()) } catch { return }
  if (payload.hook_event_name === 'SessionStart' && payload.source !== 'compact') ensureDaemon(payload)
  if (payload.hook_event_name === 'SessionEnd') releaseDaemon(payload)
  const events = eventsFor(payload)
  if (events.length > 0) await postEvents(events)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {}).finally(() => process.exit(0))
}
