import type { EngineInterface, Register } from 'claude-code'

// Where the Gladiator Yard listens and where its checkout is, read once per session from the environment
// (set them in settings.json's `env` next to CLAUDE_CODE_PLUGIN_DIRS):
//   GLADIATOR_YARD_URL  default http://127.0.0.1:4747
//   GLADIATOR_YARD_DIR  the bot-monitor folder; without it the mod reports to the yard but cannot start it
const DEFAULT_URL = 'http://127.0.0.1:4747'
const HEARTBEAT_MS = 5000
const SPAWN_RETRY_MS = 20000
const QUEUE_MAX = 60
const REMOTE_POLL_MS = 2000      // how often the yard's inbox is checked for prompts typed on the page
const CHAT_DUMP_ROWS = 40        // how much of the transcript the page gets when the warrior joins
const TITLE_MAX = 60

type YardEvent = Record<string, unknown>

// Module state: starts over on a reload, refilled by session.start.
const state = {
  url: DEFAULT_URL,
  dir: '',
  windows: true,
  session: '',
  cwd: '',
  model: '',
  connected: false,
  lastSpawnAt: 0,
  warnedNoDir: false,
  queue: [] as YardEvent[],
  sending: false,
  polling: false,
  vitals: {} as { hp?: number; mp?: number; sp?: number },
  terminal: null as null | { pid: number; hwnd: number; name: string; title: string },
  title: '',   // the session's own name, as /rename set it; '' when it has none
}

// ---------- helpers ----------
const percentLeft = (used: number | undefined): number | undefined => (used === undefined ? undefined : Math.max(0, Math.round(100 - used)))

// HP = context left, MP = the 5-hour window left, SP = the 7-day window left (the first two rate limits the engine reports).
const vitalsFrom = (usage: { context: { percent?: number }; rateLimits: ReadonlyArray<{ percentUsed: number }> }): typeof state.vitals => ({
  hp: percentLeft(usage.context.percent),
  mp: percentLeft(usage.rateLimits[0]?.percentUsed),
  sp: percentLeft(usage.rateLimits[1]?.percentUsed),
})

const lastLine = (stdout: string): string => stdout.trim().split('\n').pop() ?? ''

const runPowerShell = async ($: EngineInterface, script: string, timeoutMs: number): Promise<string> => {
  const ran = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs })
  return lastLine(ran.stdout)
}

const runShell = async ($: EngineInterface, script: string, timeoutMs: number): Promise<string> => {
  const ran = await $.process.run(['sh', '-c', script], { timeoutMs })
  return lastLine(ran.stdout)
}

const shortName = (s: string, max: number): string => {
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  const base = cut >= 0 ? s.slice(cut + 1) : s
  return base.length > max ? `${base.slice(0, max - 1)}…` : base
}

const targetOf = (e: Record<string, unknown>): string => {
  for (const k of ['file_path', 'notebook_path', 'pattern', 'command', 'description', 'url', 'skill']) {
    const v = e[k]
    if (typeof v !== 'string' || v === '') continue
    const line = v.split('\n')[0] ?? v
    // A path or URL reads best by its last segment; a command or description by its start.
    if (k === 'command' || k === 'description') return line.length > 28 ? `${line.slice(0, 27)}…` : line
    return shortName(line, 28)
  }
  return ''
}

// The first line of the prompt that a person wrote, skipping system notification tags.
const questOf = (text: string): string => {
  const line = text.split('\n').map(l => l.trim()).find(l => l !== '' && !l.startsWith('<'))
  return line ?? ''
}

const cleanText = (text: string): string => text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()

const joinEvent = (): YardEvent => ({ type: 'join', session: state.session, cwd: state.cwd, model: state.model, terminal: state.terminal, title: state.title })
const vitalsEvent = (): YardEvent => ({ type: 'vitals', session: state.session, model: state.model, ...state.vitals })

// ---------- configuration: the environment says where the yard is and what OS this is ----------
async function configure($: EngineInterface): Promise<void> {
  state.url = ((await $.env.get('GLADIATOR_YARD_URL')) || DEFAULT_URL).replace(/\/+$/, '')
  state.dir = (await $.env.get('GLADIATOR_YARD_DIR')) || ''
  state.windows = (await $.env.get('OS')) === 'Windows_NT'
}

// ---------- what the session knows about itself: its title and its terminal window ----------
// The name /rename gave this session lives in its transcript as a `custom-title` row; the last one wins.
const READ_TITLE_PS = (sessionId: string): string => [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  `$f = Get-ChildItem (Join-Path $HOME '.claude/projects/*/${sessionId}.jsonl') -ErrorAction SilentlyContinue | Select-Object -First 1`,
  'if ($f) { $m = Select-String -Path $f.FullName -Pattern \'"type":"custom-title"\' | Select-Object -Last 1; if ($m) { Write-Output $m.Line } }',
].join('; ')
const READ_TITLE_SH = (sessionId: string): string => `grep -h '"type":"custom-title"' "$HOME"/.claude/projects/*/${sessionId}.jsonl 2>/dev/null | tail -n 1`

async function readTitle($: EngineInterface): Promise<void> {
  if (state.session === '' || !/^[0-9a-f-]+$/i.test(state.session)) return
  try {
    const line = state.windows ? await runPowerShell($, READ_TITLE_PS(state.session), 20000) : await runShell($, READ_TITLE_SH(state.session), 20000)
    const title = line === '' ? '' : String((JSON.parse(line) as { customTitle?: string }).customTitle ?? '').trim()
    setTitle($, title)
  } catch (err) {
    $.ui.log(`arena-link: could not read the session title: ${String(err)}`, { to: 'debug' })
  }
}

const setTitle = ($: EngineInterface, title: string): void => {
  if (title === state.title) return
  state.title = title
  post($, { type: 'title', title })
}

// The window this session is drawn in: walk up from a child process to the first ancestor that owns a window
// (WindowsTerminal.exe, or the console window itself). The yard brings it to the front when a post is clicked.
const FIND_WINDOW_PS = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  '$p = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"',
  'for ($i = 0; $i -lt 12 -and $p; $i++) {',
  '  $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue',
  '  if ($proc -and $proc.MainWindowHandle -ne 0) { Write-Output "$($proc.Id)|$($proc.MainWindowHandle)|$($proc.ProcessName)|$($proc.MainWindowTitle)"; break }',
  '  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"',
  '}',
].join('; ')

async function findTerminal($: EngineInterface): Promise<void> {
  if (!state.windows) return   // window handles are a Windows idea; elsewhere the page shows the terminal button disabled
  try {
    const line = await runPowerShell($, FIND_WINDOW_PS, 15000)
    const [pid, hwnd, name, ...title] = line.split('|')
    if (!(Number(pid) > 0)) return
    state.terminal = { pid: Number(pid), hwnd: Number(hwnd) || 0, name: name ?? '', title: title.join('|').trim() }
    post($, { type: 'terminal', terminal: state.terminal })
  } catch (err) {
    $.ui.log(`arena-link: could not find the terminal window: ${String(err)}`, { to: 'debug' })
  }
}

// ---------- transport: queue, batch, retry, and start the server when it is down ----------
async function startServer($: EngineInterface): Promise<void> {
  if (state.dir === '') {
    if (!state.warnedNoDir) { state.warnedNoDir = true; $.ui.log('arena-link: GLADIATOR_YARD_DIR is not set, so the yard server cannot be started from here', { to: 'debug' }) }
    return
  }
  const now = await $.clock.now()
  if (now - state.lastSpawnAt < SPAWN_RETRY_MS) return
  state.lastSpawnAt = now
  try {
    // Detached from this session either way, so the yard outlives whichever session started it.
    if (state.windows) await runPowerShell($, `Start-Process -FilePath node -ArgumentList 'server/server.js' -WorkingDirectory '${state.dir}' -WindowStyle Hidden`, 15000)
    else await runShell($, `cd '${state.dir}' && nohup node server/server.js >/dev/null 2>&1 &`, 15000)
    $.ui.log(`arena-link: started the yard server from ${state.dir}`, { to: 'debug' })
  } catch (err) {
    $.ui.log(`arena-link: could not start the yard server: ${String(err)}`, { to: 'debug' })
  }
}

const postJson = ($: EngineInterface, path: string, body: unknown) =>
  $.http.fetch(`${state.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function flush($: EngineInterface): Promise<void> {
  if (state.sending || state.queue.length === 0 || state.session === '') return
  state.sending = true
  let batch: YardEvent[] = []
  try {
    batch = state.queue
    state.queue = []
    // After a disconnect the server may have restarted and forgotten us: announce ourselves first.
    if (!state.connected && batch[0]?.type !== 'join') batch = [joinEvent(), vitalsEvent(), ...batch]
    const res = await postJson($, '/event', batch)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let applied = -1
    try { applied = Number((JSON.parse(res.text) as { applied?: number }).applied) } catch { /* not json */ }
    // Applied nothing although we sent real events: the server lost us. Re-join and replay once.
    if (applied === 0 && batch.some(b => b.type !== 'join' && b.type !== 'heartbeat')) {
      await postJson($, '/event', [joinEvent(), vitalsEvent(), ...batch.filter(b => b.type !== 'join')])
    }
    if (!state.connected) {
      state.connected = true
      $.ui.status(undefined)
      $.ui.log('arena-link: connected to the yard', { to: 'debug' })
    }
  } catch (err) {
    // Server down: put the batch back before whatever arrived meanwhile (bounded), try to start it.
    state.queue = [...batch.filter(b => b.type !== 'join' && b.type !== 'vitals'), ...state.queue].slice(-QUEUE_MAX)
    if (state.connected || state.lastSpawnAt === 0) $.ui.log(`arena-link: yard unreachable (${String(err)})`, { to: 'debug' })
    state.connected = false
    $.ui.status('⚔ yard offline')
    void startServer($)
  } finally {
    state.sending = false
  }
}

const post = ($: EngineInterface, ev: YardEvent): void => {
  state.queue = [...state.queue, { ...ev, session: state.session }].slice(-QUEUE_MAX)
  void flush($)
}

async function join($: EngineInterface): Promise<void> {
  state.session = await $.session.id()
  state.cwd = await $.session.cwd()
  state.model = await $.session.model()
  state.vitals = vitalsFrom(await $.session.usage())
  state.queue = [joinEvent(), vitalsEvent()]
  await flush($)
  void dumpChat($)
  void readTitle($)
  if (!state.terminal) void findTerminal($)
}

// ---------- the remote: the conversation goes to the yard, prompts typed on the page come back ----------
// The page opens on the conversation so far: the transcript's tail, user and assistant rows with text.
async function dumpChat($: EngineInterface): Promise<void> {
  try {
    const rows = (await $.session.messages())
      .map(m => ({ role: m.role, text: cleanText(m.text) }))
      .filter(r => r.text !== '')
      .slice(-CHAT_DUMP_ROWS)
    post($, { type: 'chat', reset: true, rows })
  } catch (err) {
    $.ui.log(`arena-link: could not read the transcript for the yard: ${String(err)}`, { to: 'debug' })
  }
}

// Prompts typed on the page wait in the yard's inbox; each is submitted as the person's own words.
async function pollRemote($: EngineInterface): Promise<void> {
  if (state.polling || !state.connected || state.session === '') return
  state.polling = true
  try {
    const res = await $.http.fetch(`${state.url}/remote/${encodeURIComponent(state.session)}`)
    if (!res.ok) return
    const { items } = JSON.parse(res.text) as { items?: Array<{ id: number; kind?: string; text: string }> }
    for (const item of items ?? []) {
      if (item.kind === 'rename') {
        // Runs as if the person typed `/rename <name>` (once the session is idle); our own command.run hook does
        // not hear a run we make, so read the recorded title back afterwards.
        $.ui.toast(`⚔ 세션 이름 변경: ${item.text}`)
        $.command.run({ command: 'rename', args: item.text })
          .then(() => { setTitle($, item.text); $.clock.after(1500, () => { void readTitle($) }) })
          .catch(err => post($, { type: 'chat', role: 'notice', text: `이름 변경 실패: ${String(err)}` }))
        continue
      }
      const line = item.text.split('\n')[0] ?? item.text
      $.ui.toast(`⚔ 원격 입력: ${line.length > 40 ? `${line.slice(0, 39)}…` : line}`)
      $.prompt.submit({ text: item.text, asUser: true })
        .then(() => post($, { type: 'remote.ack', id: item.id, state: 'sent' }))
        .catch(err => post($, { type: 'remote.ack', id: item.id, state: 'failed', error: String(err) }))
    }
  } catch { /* the yard is down: flush() notices and restarts it */ } finally {
    state.polling = false
  }
}

async function openBrowser($: EngineInterface): Promise<void> {
  const argv = state.windows ? ['cmd', '/c', 'start', '', state.url] : ['sh', '-c', `(command -v open || command -v xdg-open) >/dev/null && (open '${state.url}' 2>/dev/null || xdg-open '${state.url}')`]
  try { await $.process.run(argv, { timeoutMs: 5000 }) } catch { /* no browser: the URL in the answer is enough */ }
}

// ---------- hooks ----------
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await configure($)
    await $.command.register({ name: 'arena', description: 'Open the Gladiator Yard in the browser' })
    void join($)
    $.clock.every(HEARTBEAT_MS, () => {
      if (!state.queue.some(q => q.type === 'heartbeat')) post($, { type: 'heartbeat' })
      else void flush($)
    })
    $.clock.every(REMOTE_POLL_MS, () => { void pollRemote($) })
    return next(e)
  })

  on('command.run', { command: 'arena' }, async $ => {
    await openBrowser($)
    return { text: `Gladiator Yard: ${state.url} (${state.connected ? 'connected' : 'offline'}, warrior ${shortName(state.cwd, 30)})` }
  })

  // /rename: take the typed name at once, then read back what the transcript recorded (the source of truth).
  on('command.run', { command: 'rename' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.args.trim() !== '') setTitle($, e.args.trim().slice(0, TITLE_MAX))
    $.clock.after(1500, () => { void readTitle($) })
    return ran
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    state.vitals = vitalsFrom(e)
    post($, vitalsEvent())
    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    state.model = await $.session.model()
    post($, vitalsEvent())
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) {
      post($, { type: 'turn.start', text: questOf(e.text) })
      const text = cleanText(e.text)
      if (text !== '') post($, { type: 'chat', role: 'user', text })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) { post($, { type: 'squire', phase: 'leave', id: e.agentId }); return next(e) }
    const done = await next(e)
    post($, { type: 'turn.complete', reason: e.reason })
    const text = cleanText(done.text ?? '')
    if (text !== '') post($, { type: 'chat', role: 'assistant', text })
    else if (e.reason !== 'answer') post($, { type: 'chat', role: 'notice', text: `턴 종료: ${e.reason}` })
    return done
  })

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.agentId !== undefined) post($, { type: 'squire', phase: 'join', id: ran.agentId, description: e.description })
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const isMain = e.agentId === undefined
    if (isMain) post($, { type: 'fight', phase: 'start', tool: e.tool, target: targetOf(e as unknown as Record<string, unknown>) })
    const ran = await next(e)
    if (isMain) post($, { type: 'fight', phase: ran.deny !== undefined ? 'blocked' : ran.isError === true ? 'fail' : 'win', tool: e.tool })
    return ran
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    state.queue = [...state.queue.filter(q => q.type !== 'heartbeat'), { type: 'leave', session: state.session, reason: e.reason }]
    await flush($)
    const ended = await next(e)
    if (e.reason === 'clear') {
      // The process goes on under a new session id and no session.start fires: a fresh warrior walks in.
      state.session = ended.sessionId
      state.connected = false
      await join($)
    }
    return ended
  })
}
