// Pure arena state: warriors, their vitals, the XP ledger by project, and the remote desk. No I/O here, so it can
// be unit tested. Every session event goes through `apply`, which dispatches to one handler per event type.
import { monsterFor, levelOf } from './monsters.js'
import { RemoteDesk, cleanTitle } from './remote-desk.js'

const LOG_LINES = 12
const QUEST_MAX = 60
const SQUIRE_DESCRIPTION_MAX = 40
const ANSWER_XP = 5
export const AGENTS = new Set(['claude', 'codex'])
/** Only a Claude session has a mod that can take a prompt or a rename from the page. */
export const acceptsRemote = warrior => warrior.agent === 'claude'
export const HEARTBEAT_REST_MS = 20_000   // no heartbeat → the warrior sits down (resting)
export const HEARTBEAT_LEAVE_MS = 90_000  // still nothing → the warrior leaves the yard

/** The terminal window a session runs in, as the mod reports it; the server brings it to the front on request. */
export function terminalOf(t) {
  if (!t || typeof t !== 'object' || !(t.pid > 0)) return null
  return { pid: Math.floor(t.pid), hwnd: t.hwnd > 0 ? Math.floor(t.hwnd) : 0, name: String(t.name || '').slice(0, 40), title: String(t.title || '').slice(0, 80) }
}

const normalizePath = cwd => (cwd || 'unknown').replace(/\\/g, '/').replace(/\/+$/, '')
export const projectKey = cwd => normalizePath(cwd).toLowerCase()
export const projectName = cwd => { const p = normalizePath(cwd); return p.slice(p.lastIndexOf('/') + 1) || p }

// What each handler returns: whether the page should hear an `update`, nothing, or that the warrior left.
const UPDATE = 'update', SILENT = 'silent', LEFT = 'left'

const HANDLERS = {
  heartbeat: () => UPDATE,

  terminal(arena, warrior, event) {
    warrior.terminal = terminalOf(event.terminal) || warrior.terminal
    return UPDATE
  },

  title(arena, warrior, event) {
    const title = cleanTitle(event.title)
    if (title === warrior.title) return SILENT
    warrior.title = title
    warrior.name = title || warrior.project
    arena.log(warrior, `이름: ${warrior.name}`, 'suggestion')
    return UPDATE
  },

  vitals(arena, warrior, event) {
    for (const key of ['hp', 'mp', 'sp']) if (typeof event[key] === 'number') warrior[key] = event[key]
    if (event.model) warrior.model = event.model
    return UPDATE
  },

  'turn.start'(arena, warrior, event) {
    warrior.status = 'training'; warrior.pose = 'walk'; warrior.idleSince = null
    warrior.quest = String(event.text || '').split('\n')[0].slice(0, QUEST_MAX)
    arena.log(warrior, `퀘스트: ${warrior.quest}`)
    return UPDATE
  },

  'turn.complete'(arena, warrior, event, now) {
    warrior.status = 'idle'; warrior.enemy = null; warrior.idleSince = now
    if (event.reason === 'answer') { warrior.pose = 'victory'; arena.gain(warrior, ANSWER_XP); arena.log(warrior, '퀘스트 완료!', 'success') }
    else if (event.reason === 'error' || event.reason === 'refusal') { warrior.pose = 'hurt'; arena.log(warrior, `쓰러짐: ${event.reason}`, 'error') }
    else { warrior.pose = 'idle'; arena.log(warrior, '퀘스트 중단', 'warning') }
    return UPDATE
  },

  // phase: 'start' | 'win' | 'fail' | 'blocked'
  fight(arena, warrior, event) {
    const monster = monsterFor(event.tool)
    if (event.phase === 'start') {
      warrior.status = 'training'; warrior.pose = 'attack'; warrior.idleSince = null
      warrior.enemy = { name: monster.name, tool: event.tool, target: event.target || '' }
      arena.log(warrior, `${monster.name}(${event.tool}) 출현${event.target ? `: ${event.target}` : ''}`)
    } else if (event.phase === 'win') {
      warrior.pose = 'walk'; warrior.enemy = null
      warrior.kills += 1; arena.ledgerFor(warrior.cwd).kills = warrior.kills
      arena.gain(warrior, monster.hp)
      arena.log(warrior, `${monster.name} 격파 (${event.tool})`, 'success')
    } else {
      warrior.pose = 'hurt'; warrior.enemy = null
      if (event.phase === 'blocked') arena.log(warrior, `${event.tool} 가로막힘`, 'warning')
      else arena.log(warrior, `${monster.name}의 반격! ${event.tool} 실패`, 'error')
    }
    return UPDATE
  },

  squire(arena, warrior, event) {
    if (event.phase === 'join') {
      warrior.squires = [...warrior.squires, { id: event.id, description: String(event.description || '').slice(0, SQUIRE_DESCRIPTION_MAX) }]
      arena.log(warrior, `종자 합류: ${event.description || ''}`.slice(0, 50), 'suggestion')
    } else {
      warrior.squires = warrior.squires.filter(s => s.id !== event.id)
      arena.log(warrior, '종자 귀환', 'inactive')
    }
    return UPDATE
  },

  chat(arena, warrior, event, now) {
    if (Array.isArray(event.rows)) { arena.remote.addAll(event.session, event.rows, now, event.reset === true); return SILENT }
    const text = typeof event.text === 'string' ? event.text : ''
    if (event.role === 'user' && arena.remote.markStarted(event.session, text)) return SILENT
    arena.remote.add(event.session, { role: event.role, text, t: event.t }, now)
    return SILENT
  },

  'remote.ack'(arena, warrior, event) {
    arena.remote.ack(event.session, event.id, event.state, event.error)
    return SILENT
  },

  // the slash commands the session can run, for the page's autocomplete
  commands(arena, warrior, event) {
    arena.remote.setCommands(event.session, event.commands)
    return SILENT
  },

  leave(arena, warrior, event, now) {
    warrior.status = 'gone'; warrior.pose = 'walk'; warrior.enemy = null; warrior.squires = []
    arena.ledgerFor(warrior.cwd).lastSeen = now
    if (warrior.demo) delete arena.ledger[projectKey(warrior.cwd)]   // a rehearsal warrior leaves no trace
    arena.log(warrior, `퇴장 (${event.reason || 'exit'})`, 'inactive')
    arena.emit('leave', { warrior })
    arena.warriors.delete(event.session)
    arena.remote.drop(event.session)
    return LEFT
  },
}

export class Arena {
  constructor(ledger = {}) {
    this.ledger = ledger          // projectKey -> { xp, kills, sessions, name, minutes, lastSeen }
    this.warriors = new Map()     // sessionId -> warrior
    this.listeners = new Set()
    this.remote = new RemoteDesk((kind, payload) => this.emit(kind, payload))
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  emit(kind, payload) { for (const fn of this.listeners) fn({ kind, ...payload }) }
  snapshot() { return { warriors: [...this.warriors.values()], ledger: this.ledger } }

  ledgerFor(cwd) {
    const key = projectKey(cwd)
    if (!this.ledger[key]) this.ledger[key] = { xp: 0, kills: 0, sessions: 0, name: projectName(cwd), minutes: 0, lastSeen: 0 }
    const entry = this.ledger[key]
    if (typeof entry.minutes !== 'number') entry.minutes = 0     // ledgers written before these fields existed
    if (typeof entry.lastSeen !== 'number') entry.lastSeen = 0
    return entry
  }

  log(warrior, text, tone = 'text') {
    warrior.log = [...warrior.log, { t: Date.now(), text, tone }].slice(-LOG_LINES)
  }

  /** Applies one event from a session. Returns the warrior touched, or null when nothing applied. */
  apply(event, now = Date.now()) {
    if (!event || typeof event.session !== 'string' || typeof event.type !== 'string') return null
    if (event.type === 'join') return this.join(event, now)
    const warrior = this.warriors.get(event.session), handle = HANDLERS[event.type]
    if (!warrior || !handle) return null
    warrior.lastSeen = now
    this.credit(warrior, now)
    if (warrior.status === 'resting' && event.type !== 'leave') { warrior.status = 'idle'; this.log(warrior, '훈련 재개', 'inactive') }
    if (handle(this, warrior, event, now) === UPDATE) this.emit('update', { warrior })
    return warrior
  }

  join(event, now) {
    const entry = this.ledgerFor(event.cwd)
    entry.sessions += 1
    const title = cleanTitle(event.title)
    const warrior = {
      session: event.session,
      name: title || entry.name,   // the session's own title (/rename) when it has one, else the project folder
      title,
      project: entry.name,
      cwd: event.cwd || '',
      model: event.model || '',
      agent: AGENTS.has(event.agent) ? event.agent : 'claude',   // which CLI the session runs in; the remote only reaches Claude
      demo: event.demo === true,
      status: 'idle',              // idle | training | resting | gone
      pose: 'idle',                // idle | walk | attack | hurt | victory
      enemy: null,                 // { name, tool, target }
      squires: [],                 // [{ id, description }]
      quest: '',
      hp: null, mp: null, sp: null,
      xp: entry.xp, kills: entry.kills,
      joinedAt: now, lastSeen: now, creditedAt: now,
      idleSince: now,              // when the warrior last ran out of work; null while training
      terminal: terminalOf(event.terminal),
      log: [],
    }
    this.warriors.set(event.session, warrior)
    this.log(warrior, `${warrior.name} 입장 (${warrior.model || '?'}, Lv${levelOf(warrior.xp)})`, 'suggestion')
    this.emit('join', { warrior })
    return warrior
  }

  /** Training time goes to the ledger as it passes, so a server or session that dies keeps what was earned. */
  credit(warrior, now) {
    this.ledgerFor(warrior.cwd).minutes += Math.max(0, (now - warrior.creditedAt) / 60000)
    warrior.creditedAt = now
  }

  gain(warrior, amount) {
    const before = levelOf(warrior.xp)
    warrior.xp += amount
    this.ledgerFor(warrior.cwd).xp = warrior.xp
    const after = levelOf(warrior.xp)
    if (after > before) { this.log(warrior, `LEVEL UP! Lv${after}`, 'success'); this.emit('levelup', { warrior, level: after }) }
  }

  /** Called on a timer: rests warriors that went quiet, drops the ones that vanished. */
  sweep(now = Date.now()) {
    for (const warrior of [...this.warriors.values()]) {
      const quiet = now - warrior.lastSeen
      if (quiet > HEARTBEAT_LEAVE_MS) this.apply({ type: 'leave', session: warrior.session, reason: 'timeout' }, now)
      else if (quiet > HEARTBEAT_REST_MS && warrior.status !== 'resting') {
        warrior.status = 'resting'; warrior.pose = 'idle'; warrior.enemy = null
        this.log(warrior, '휴식 중', 'inactive')
        this.emit('update', { warrior })
      }
    }
  }
}
