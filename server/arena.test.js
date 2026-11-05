import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Arena, HEARTBEAT_REST_MS, HEARTBEAT_LEAVE_MS, acceptsRemote } from './arena.js'
import { levelOf, monsterFor } from './monsters.js'
import { CHAT_ROWS } from './remote-desk.js'

test('join, fight, leave keeps xp in the ledger by project', () => {
  const a = new Arena()
  const s = 'sess-1'
  a.apply({ type: 'join', session: s, cwd: 'C:\\workspace\\bot-monitor', model: 'fable' })
  assert.equal(a.warriors.get(s).name, 'bot-monitor')
  a.apply({ type: 'fight', session: s, tool: 'Bash', phase: 'start', target: 'npm test' })
  assert.equal(a.warriors.get(s).enemy.name, 'Goblin')
  a.apply({ type: 'fight', session: s, tool: 'Bash', phase: 'win' })
  assert.equal(a.warriors.get(s).xp, 3)
  assert.equal(a.warriors.get(s).kills, 1)
  a.apply({ type: 'turn.complete', session: s, reason: 'answer' })
  assert.equal(a.warriors.get(s).xp, 8)
  a.apply({ type: 'leave', session: s, reason: 'exit' })
  assert.equal(a.warriors.size, 0)
  const led = a.ledger['c:/workspace/bot-monitor']
  assert.deepEqual({ ...led, minutes: Math.round(led.minutes), lastSeen: led.lastSeen > 0 }, { xp: 8, kills: 1, sessions: 1, name: 'bot-monitor', minutes: 0, lastSeen: true })
  // a second session of the same project starts from the ledger
  a.apply({ type: 'join', session: 'sess-2', cwd: 'c:/workspace/bot-monitor/' })
  assert.equal(a.warriors.get('sess-2').xp, 8)
  assert.equal(led.sessions, 2)
})

test('level up emits and failure hurts without xp', () => {
  const a = new Arena({ 'c:/p': { xp: 9, kills: 0, sessions: 0, name: 'p' } })
  const kinds = []
  a.subscribe(m => kinds.push(m.kind))
  a.apply({ type: 'join', session: 'x', cwd: 'C:/p' })
  a.apply({ type: 'fight', session: 'x', tool: 'Read', phase: 'win' })
  assert.equal(levelOf(a.warriors.get('x').xp), 2)
  assert.ok(kinds.includes('levelup'))
  a.apply({ type: 'fight', session: 'x', tool: 'Edit', phase: 'fail' })
  assert.equal(a.warriors.get('x').pose, 'hurt')
  assert.equal(a.warriors.get('x').xp, 10)
})

test('sweep rests quiet warriors, then removes them', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 'q', cwd: '/tmp/q' }, 0)
  a.sweep(HEARTBEAT_REST_MS + 1)
  assert.equal(a.warriors.get('q').status, 'resting')
  a.apply({ type: 'heartbeat', session: 'q' }, HEARTBEAT_REST_MS + 2)
  assert.equal(a.warriors.get('q').status, 'idle')
  a.sweep(HEARTBEAT_REST_MS + 2 + HEARTBEAT_LEAVE_MS + 1)
  assert.equal(a.warriors.size, 0)
})

test('web and mcp tools have their own monsters; training time accumulates per project', () => {
  assert.deepEqual(monsterFor('ToolSearch'), { name: 'Wisp', hp: 1 })
  const a = new Arena({ 'c:/old': { xp: 5, kills: 1, sessions: 1, name: 'old' } })   // a ledger row written before `minutes` existed
  a.apply({ type: 'join', session: 'w', cwd: 'C:/old' }, 0)
  a.apply({ type: 'fight', session: 'w', tool: 'WebFetch', phase: 'start' }, 10)
  assert.equal(a.warriors.get('w').enemy.name, 'Bat')
  a.apply({ type: 'fight', session: 'w', tool: 'mcp__github__list_prs', phase: 'start' }, 20)
  assert.equal(a.warriors.get('w').enemy.name, 'Imp')
  a.apply({ type: 'fight', session: 'w', tool: 'mcp__github__list_prs', phase: 'win' }, 30)
  assert.equal(a.warriors.get('w').xp, 7)
  a.apply({ type: 'leave', session: 'w' }, 15 * 60000)
  assert.equal(Math.round(a.ledger['c:/old'].minutes), 15)
})

test('a demo warrior fights like any other but vanishes from the ledger on leave', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 'd', cwd: 'C:/demo/x', demo: true })
  a.apply({ type: 'fight', session: 'd', tool: 'Read', phase: 'win' })
  assert.equal(a.warriors.get('d').xp, 1)
  assert.ok(a.ledger['c:/demo/x'])
  a.apply({ type: 'leave', session: 'd' })
  assert.equal(a.ledger['c:/demo/x'], undefined)
})

test('idleSince marks when a warrior last ran out of work', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 'i', cwd: 'C:/i' }, 100)
  assert.equal(a.warriors.get('i').idleSince, 100)
  a.apply({ type: 'turn.start', session: 'i', text: 'go' }, 200)
  assert.equal(a.warriors.get('i').idleSince, null)
  a.apply({ type: 'turn.complete', session: 'i', reason: 'answer' }, 300)
  assert.equal(a.warriors.get('i').idleSince, 300)
})

test('unknown session or malformed event is ignored', () => {
  const a = new Arena()
  assert.equal(a.apply({ type: 'fight', session: 'nope', tool: 'Bash', phase: 'win' }), null)
  assert.equal(a.apply({ type: 'join' }), null)
  assert.equal(a.apply(null), null)
  a.apply({ type: 'join', session: 'u', cwd: 'C:/u' })
  assert.equal(a.apply({ type: 'bogus', session: 'u' }), null)
})

test('remote desk: chat rows, queued prompt, ack, start dedupe, cleared on leave', () => {
  const a = new Arena()
  const kinds = []
  a.subscribe(m => kinds.push(m.kind))
  a.apply({ type: 'join', session: 'r', cwd: 'C:/r' })
  a.apply({ type: 'chat', session: 'r', rows: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }, { role: 'bogus', text: 'x' }], reset: true })
  assert.deepEqual(a.remote.rowsOf('r').map(r => r.role), ['user', 'assistant'])
  const row = a.remote.post('r', '  테스트 돌려줘  ')
  assert.equal(row.state, 'queued')
  assert.equal(row.text, '테스트 돌려줘')
  assert.equal(a.remote.rowsOf('r').length, 3)
  assert.deepEqual(a.remote.take('r').map(i => i.text), ['테스트 돌려줘'])
  assert.deepEqual(a.remote.take('r'), [])
  a.apply({ type: 'remote.ack', session: 'r', id: row.id, state: 'sent' })
  assert.equal(a.remote.rowsOf('r')[2].state, 'sent')
  a.apply({ type: 'chat', session: 'r', role: 'user', text: '테스트 돌려줘' })   // the mod echoing turn.start
  assert.equal(a.remote.rowsOf('r').length, 3)
  assert.equal(a.remote.rowsOf('r')[2].state, 'started')
  a.apply({ type: 'chat', session: 'r', role: 'assistant', text: 'x'.repeat(10000) })
  assert.ok(a.remote.rowsOf('r')[3].text.length < 10000)
  assert.equal(a.remote.post('r', '   '), null)
  for (let i = 0; i < CHAT_ROWS + 20; i++) a.apply({ type: 'chat', session: 'r', role: 'notice', text: `n${i}` })
  assert.equal(a.remote.rowsOf('r').length, CHAT_ROWS)
  assert.ok(kinds.includes('chat') && kinds.includes('remote'))
  a.apply({ type: 'leave', session: 'r' })
  assert.equal(a.remote.rowsOf('r').length, 0)
  assert.deepEqual(a.remote.take('r'), [])
})

test('a session title names the warrior; the ledger keeps the project folder', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 't', cwd: 'C:/work/api', title: '  로그인 버그  ' })
  assert.equal(a.warriors.get('t').name, '로그인 버그')
  assert.equal(a.warriors.get('t').project, 'api')
  a.apply({ type: 'title', session: 't', title: '결제 리팩터링' })
  assert.equal(a.warriors.get('t').name, '결제 리팩터링')
  a.apply({ type: 'title', session: 't', title: '' })
  assert.equal(a.warriors.get('t').name, 'api')
  a.apply({ type: 'join', session: 'u', cwd: 'C:/work/api' })
  assert.equal(a.warriors.get('u').name, 'api')
  assert.equal(a.ledger['c:/work/api'].name, 'api')
})

test('a rename typed on the page queues a rename item for the mod', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 'n', cwd: 'C:/work/api' })
  assert.equal(a.remote.rename('n', '   '), null)
  const item = a.remote.rename('n', '  결제   리팩터링  ')
  assert.equal(item.kind, 'rename')
  assert.equal(item.text, '결제 리팩터링')
  a.remote.post('n', '테스트 돌려')
  assert.deepEqual(a.remote.take('n').map(i => [i.kind, i.text]), [['rename', '결제 리팩터링'], ['prompt', '테스트 돌려']])
  assert.equal(a.remote.rowsOf('n')[0].role, 'notice')
  a.apply({ type: 'title', session: 'n', title: '결제 리팩터링' })   // what the mod reports after /rename ran
  assert.equal(a.warriors.get('n').name, '결제 리팩터링')
})

test('a codex session is a warrior too, but the remote is for claude sessions only', () => {
  const a = new Arena()
  a.apply({ type: 'join', session: 'cx', cwd: 'C:/work/api', model: 'gpt-5-codex', agent: 'codex' })
  a.apply({ type: 'join', session: 'cl', cwd: 'C:/work/api' })
  a.apply({ type: 'join', session: 'odd', cwd: 'C:/work/api', agent: 'gemini' })
  assert.equal(a.warriors.get('cx').agent, 'codex')
  assert.equal(a.warriors.get('cl').agent, 'claude')
  assert.equal(a.warriors.get('odd').agent, 'claude')
  assert.equal(acceptsRemote(a.warriors.get('cx')), false)
  assert.equal(acceptsRemote(a.warriors.get('cl')), true)
  a.apply({ type: 'fight', session: 'cx', tool: 'shell', phase: 'start', target: 'npm test' })
  assert.equal(a.warriors.get('cx').enemy.name, 'Goblin')   // codex's shell tool
})
