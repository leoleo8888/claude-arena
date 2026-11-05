// Fill every free post of the yard with a demo warrior for ~30 s of varied fights, then send them all home.
const ARENA = 'http://127.0.0.1:4747'
const DURATION_MS = Number(process.argv[2] || 30000)
const SLOTS = 6
const post = body => fetch(`${ARENA}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const NAMES = ['alpha-service', 'beta-web', 'gamma-api', 'delta-cli', 'epsilon-db', 'zeta-mobile', 'eta-infra', 'theta-ml', 'iota-docs', 'kappa-auth', 'lambda-queue', 'mu-gateway']
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1']
const TOOLS = [['Read', 'auth.ts'], ['Grep', 'TODO'], ['Glob', '**/*.test.ts'], ['Edit', 'server.js'], ['Write', 'README.md'], ['Bash', 'npm test'], ['PowerShell', 'Get-Process'],
  ['Agent', 'review changes'], ['WebFetch', 'docs.example.com'], ['WebSearch', 'node 26 fetch'], ['mcp__github__list_prs', 'open'], ['ToolSearch', 'select:Monitor'], ['NotebookEdit', 'train.ipynb']]
const QUESTS = ['로그인 버그 고쳐줘', '테스트 추가', 'PR 목록 가져와', '배포 스크립트 정리', '마이그레이션 작성', 'README 갱신', '성능 프로파일링', '의존성 업데이트', '로그 포맷 통일', 'CI 캐시 수정', 'API 문서화', '타입 오류 정리']

const live = (await (await fetch(`${ARENA}/state`)).json()).warriors.length
const n = Math.max(0, SLOTS - live)
console.log(`live warriors: ${live}, adding ${n} demo warriors for ${DURATION_MS / 1000}s`)
const demos = Array.from({ length: n }, (_, i) => ({ session: `demo-${i}`, name: NAMES[i], model: pick(MODELS), squires: 0, busy: false }))

for (const d of demos) {
  await post({ type: 'join', session: d.session, cwd: `C:/demo/${d.name}`, model: d.model, demo: true })
  await post({ type: 'vitals', session: d.session, hp: 40 + Math.floor(Math.random() * 60), mp: 30 + Math.floor(Math.random() * 70), sp: 50 + Math.floor(Math.random() * 50) })
  await sleep(350)
}
await sleep(2500)
for (const d of demos) await post({ type: 'turn.start', session: d.session, text: pick(QUESTS) })

const t0 = Date.now()
const heartbeat = setInterval(() => { for (const d of demos) void post({ type: 'heartbeat', session: d.session }) }, 5000)
async function life(d) {
  while (Date.now() - t0 < DURATION_MS) {
    const [tool, target] = pick(TOOLS)
    await post({ type: 'fight', session: d.session, tool, phase: 'start', target })
    await sleep(600 + Math.random() * 2200)
    const r = Math.random()
    await post({ type: 'fight', session: d.session, tool, phase: r < 0.8 ? 'win' : r < 0.93 ? 'fail' : 'blocked' })
    if (tool === 'Agent' && d.squires < 2) { d.squires += 1; await post({ type: 'squire', session: d.session, phase: 'join', id: `${d.session}-sq${d.squires}`, description: target }) }
    if (Math.random() < 0.12) {
      await post({ type: 'turn.complete', session: d.session, reason: Math.random() < 0.85 ? 'answer' : 'error' })
      await sleep(1500 + Math.random() * 1500)
      await post({ type: 'turn.start', session: d.session, text: pick(QUESTS) })
    } else {
      await sleep(300 + Math.random() * 900)
    }
  }
}
await Promise.all(demos.map(life))
clearInterval(heartbeat)
for (const d of demos) { await post({ type: 'turn.complete', session: d.session, reason: 'answer' }); await sleep(120) }
await sleep(2000)
for (const d of demos) { await post({ type: 'leave', session: d.session, reason: 'exit' }); await sleep(250) }
console.log('demo finished: all demo warriors left')
