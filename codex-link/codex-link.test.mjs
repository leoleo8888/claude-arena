// The Codex side without Codex: feed the documented hook payloads to the forwarder and watch what reaches a mock arena.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { eventsFor, targetOf, failed } from './hook.mjs'
import { contextLeftFromTranscript } from './daemon.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** A stand-in arena that records every event posted to it. */
function mockArena() {
  const received = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => { try { received.push(...[].concat(JSON.parse(body))) } catch { /* ignore */ } res.end('{"ok":true}') })
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ received, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })))
}

const base = { session_id: 'cx-1', cwd: 'C:/work/api', model: 'gpt-5-codex', transcript_path: '' }

test('each documented hook event maps to the yard events the page expects', () => {
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'SessionStart', source: 'startup' }), [])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'UserPromptSubmit', prompt: '로그인 버그 고쳐줘\n자세히' }),
    [{ session: 'cx-1', type: 'turn.start', text: '로그인 버그 고쳐줘' }, { session: 'cx-1', type: 'chat', role: 'user', text: '로그인 버그 고쳐줘\n자세히' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'PreToolUse', tool_name: 'shell', tool_use_id: 't1', tool_input: { command: ['npm', 'test'] } }),
    [{ session: 'cx-1', type: 'fight', phase: 'start', tool: 'shell', target: 'npm test' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'PostToolUse', tool_name: 'shell', tool_input: {}, tool_response: { exit_code: 1 } }),
    [{ session: 'cx-1', type: 'fight', phase: 'fail', tool: 'shell' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: {}, tool_response: { output: 'ok' } }),
    [{ session: 'cx-1', type: 'fight', phase: 'win', tool: 'apply_patch' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: '테스트 42개 통과' }),
    [{ session: 'cx-1', type: 'turn.complete', reason: 'answer' }, { session: 'cx-1', type: 'chat', role: 'assistant', text: '테스트 42개 통과' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'Interrupt' }), [{ session: 'cx-1', type: 'turn.complete', reason: 'aborted' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'explorer' }),
    [{ session: 'cx-1', type: 'squire', phase: 'join', id: 'a1', description: 'explorer' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'SubagentStop', agent_id: 'a1' }), [{ session: 'cx-1', type: 'squire', phase: 'leave', id: 'a1' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'SessionEnd', reason: 'other' }), [{ session: 'cx-1', type: 'leave', reason: 'other' }])
  assert.deepEqual(eventsFor({ ...base, hook_event_name: 'PreCompact', trigger: 'auto' }), [])
  assert.deepEqual(eventsFor({ hook_event_name: 'Stop' }), [])   // no session id: nothing to attribute
})

test('tool targets and failure detection read the shapes codex tools use', () => {
  assert.equal(targetOf('shell', { command: 'git status --short' }), 'git status --short')
  assert.equal(targetOf('apply_patch', { patch: '*** Begin Patch\n*** Update File: src/auth/login.ts\n@@' }), 'login.ts')
  assert.equal(targetOf('read_file', { path: 'C:\\work\\api\\README.md' }), 'README.md')
  assert.equal(targetOf('web_search', { query: 'node 26 fetch timeout behaviour and AbortSignal' }), 'node 26 fetch timeout behav…')
  assert.equal(targetOf('x', null), '')
  assert.equal(failed({ exit_code: 0 }), false)
  assert.equal(failed({ metadata: { exit_code: 2 } }), true)
  assert.equal(failed({ error: 'boom' }), true)
  assert.equal(failed('plain text'), false)
})

test('the forwarder posts what it maps, prints nothing, and exits 0 even when the arena is down', async () => {
  const arena = await mockArena()
  const run = (payload, url) => new Promise(resolve => {
    const child = execFile(process.execPath, [path.join(HERE, 'hook.mjs')], { env: { ...process.env, ARENA_URL: url, YARD_NO_DAEMON: '1' } }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout }))
    child.stdin.end(JSON.stringify(payload))
  })
  const ok = await run({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'hi' }, arena.url)
  assert.equal(ok.code, 0); assert.equal(ok.stdout, '')
  assert.deepEqual(arena.received.map(e => e.type), ['turn.start', 'chat'])
  const down = await run({ ...base, hook_event_name: 'Stop', last_assistant_message: 'x' }, 'http://127.0.0.1:1')
  assert.equal(down.code, 0); assert.equal(down.stdout, '')
  arena.close()
})

test('the daemon joins as codex, heartbeats, and leaves when the watched process dies', async () => {
  const arena = await mockArena()
  const dummy = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
  const daemon = spawn(process.execPath, [path.join(HERE, 'daemon.mjs'), '--session', 'cx-daemon', '--cwd', 'C:/work/api', '--model', 'gpt-5-codex',
    '--watch-pid', String(dummy.pid), '--heartbeat-ms', '150', '--no-terminal'], { env: { ...process.env, ARENA_URL: arena.url }, stdio: 'ignore' })
  await sleep(900)
  assert.equal(arena.received[0].type, 'join')
  assert.equal(arena.received[0].agent, 'codex')
  assert.ok(arena.received.filter(e => e.type === 'heartbeat').length >= 2)
  dummy.kill()
  const exited = new Promise(resolve => daemon.on('exit', resolve))
  await Promise.race([exited, sleep(3000)])
  assert.equal(arena.received.at(-1).type, 'leave')
  assert.equal(arena.received.at(-1).reason, 'process-exit')
  arena.close()
})

test('context left comes from the transcript tail; a file without usage rows gives null', () => {
  const file = path.join(os.tmpdir(), `yard-rollout-${process.pid}.jsonl`)
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'session_meta', payload: { id: 'x' } }),
    JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { model_context_window: 200000, last_token_usage: { total_tokens: 50000 } } } }),
    JSON.stringify({ type: 'response_item', payload: { type: 'message' } }),
  ].join('\n') + '\n')
  assert.equal(contextLeftFromTranscript(file), 75)
  fs.writeFileSync(file, JSON.stringify({ type: 'session_meta' }) + '\n')
  assert.equal(contextLeftFromTranscript(file), null)
  fs.unlinkSync(file)
  assert.equal(contextLeftFromTranscript('C:/nope/missing.jsonl'), null)
})

test('the mock model answers a turn with one tool call, then a message, in chat-completions shape', async () => {
  const { replyFor, toolCallFor, startMockModel } = await import('./mock-model.mjs')
  const tools = [{ type: 'function', function: { name: 'shell', parameters: {} } }, { type: 'function', function: { name: 'update_plan' } }]
  assert.equal(toolCallFor(tools).name, 'shell')
  assert.deepEqual(JSON.parse(toolCallFor(tools).arguments).command.slice(0, 2), ['cmd', '/c'])
  assert.equal(toolCallFor([{ type: 'function', function: { name: 'exec_command' } }]).name, 'exec_command')
  assert.equal(toolCallFor([]), null)
  assert.ok(replyFor({ messages: [{ role: 'user', content: 'go' }], tools }).toolCall)
  assert.ok(replyFor({ messages: [{ role: 'user', content: 'go' }, { role: 'tool', content: 'out' }], tools }).text)
  const server = await startMockModel(0)
  const url = `http://127.0.0.1:${server.address().port}/v1/chat/completions`
  const plain = await (await fetch(url, { method: 'POST', body: JSON.stringify({ model: 'mock-1', messages: [{ role: 'user', content: 'go' }], tools }) })).json()
  assert.equal(plain.choices[0].finish_reason, 'tool_calls')
  assert.equal(plain.choices[0].message.tool_calls[0].function.name, 'shell')
  const streamed = await (await fetch(url, { method: 'POST', body: JSON.stringify({ model: 'mock-1', stream: true, messages: [{ role: 'tool', content: 'out' }], tools }) })).text()
  assert.ok(streamed.includes('"finish_reason":"stop"') && streamed.trim().endsWith('data: [DONE]'))
  server.close()
})
