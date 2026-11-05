#!/usr/bin/env node
// A stand-in model for exercising the Codex hooks without an account: an OpenAI Chat Completions endpoint that
// answers the first request of a turn with one tool call (a shell echo) and the next with a short message.
//   node codex-link/mock-model.mjs [port]      (default 4799)   → base_url http://127.0.0.1:<port>/v1
import http from 'node:http'

const PORT = Number(process.argv[2] || 4799)
const ECHO = 'yard-hooks-ok'

/** Picks the tool Codex offers for running a command, and arguments in that tool's own shape. */
export function toolCallFor(tools = []) {
  const names = tools.map(t => t.function?.name || t.name).filter(Boolean)
  const name = names.find(n => /^(shell|local_shell|exec_command|shell_command|container\.exec)$/.test(n)) || names.find(n => /shell|exec/i.test(n))
  if (!name) return null
  const args = name === 'shell' || name === 'local_shell' || name === 'container.exec'
    ? { command: ['cmd', '/c', `echo ${ECHO}`], timeout_ms: 10000 }
    : { cmd: `echo ${ECHO}`, yield_time_ms: 5000 }
  return { name, arguments: JSON.stringify(args) }
}

/** The reply to one request: a tool call until a tool result shows up in the messages, then the answer. */
export function replyFor(body) {
  const messages = body.messages || []
  const sawToolResult = messages.some(m => m.role === 'tool')
  const call = sawToolResult ? null : toolCallFor(body.tools)
  return call ? { toolCall: call } : { text: `모의 답변: 도구 결과를 확인했습니다 (${ECHO}).` }
}

function chunk(model, delta, finish = null) {
  return { id: 'chatcmpl-yard', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finish }] }
}

function respond(req, res, body) {
  const reply = replyFor(body), model = body.model || 'mock'
  const message = reply.toolCall
    ? { role: 'assistant', content: null, tool_calls: [{ id: 'call_yard_1', type: 'function', function: reply.toolCall }] }
    : { role: 'assistant', content: reply.text }
  const finish = reply.toolCall ? 'tool_calls' : 'stop'
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ id: 'chatcmpl-yard', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }))
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = c => res.write(`data: ${JSON.stringify(c)}\n\n`)
  if (reply.toolCall) send(chunk(model, { role: 'assistant', tool_calls: [{ index: 0, id: 'call_yard_1', type: 'function', function: reply.toolCall }] }))
  else send(chunk(model, { role: 'assistant', content: reply.text }))
  send(chunk(model, {}, finish))
  res.write('data: [DONE]\n\n')
  res.end()
}

export function startMockModel(port = PORT) {
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      if (req.method === 'GET' && req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-1', object: 'model' }] })) }
      if (req.method !== 'POST') { res.writeHead(404); return res.end() }
      let body
      try { body = JSON.parse(raw) } catch { res.writeHead(400); return res.end('{"error":"bad json"}') }
      console.log(`[mock-model] ${req.url} stream=${!!body.stream} messages=${(body.messages || []).length} tools=${(body.tools || []).map(t => t.function?.name || t.name).join(',')}`)
      respond(req, res, body)
    })
  })
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (process.argv[1] && process.argv[1].endsWith('mock-model.mjs')) {
  startMockModel(PORT).then(() => console.log(`[mock-model] listening on http://127.0.0.1:${PORT}/v1`))
}
