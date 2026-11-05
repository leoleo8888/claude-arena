// The server's event stream: a snapshot on connect, then join/update/levelup/leave/chat events.
import { warriors, actors, store, liveCount } from './store.js'
import { Actor } from './actor.js'
import { requestTier } from './tiers.js'
import { renderPanels, ingestLog, renderLog } from './panels.js'
import { onChat } from './remote.js'
import { forgetCast } from './casting.js'
import { SFX } from './audio.js'
import { projectKey, $ } from './util.js'

const RETRY_LABEL = '서버 연결 끊김, 재시도 중…'

/** Keeps the page's copy of the hall of fame in step: the name stays the project folder, never the session title. */
function rememberInLedger(warrior, minutesToAdd = 0) {
  const key = projectKey(warrior.cwd), old = store.ledger[key] || {}
  store.ledger[key] = { ...old, name: warrior.project || old.name || warrior.name, xp: warrior.xp, kills: warrior.kills, sessions: old.sessions || 1, minutes: (old.minutes || 0) + minutesToAdd }
}

function upsert(warrior) {
  const now = performance.now()
  if (warrior.lastSeen) store.clockSkew = warrior.lastSeen - Date.now()
  warriors.set(warrior.session, warrior)
  let actor = actors.get(warrior.session)
  if (!actor || actor.leaving) {
    requestTier(liveCount() + 1)
    actor = new Actor(warrior)
    actors.set(warrior.session, actor)
    SFX.join()
  }
  ingestLog(warrior)        // first: an appearance line casts the foe the actor is about to show
  actor.update(warrior, now)
  rememberInLedger(warrior)
}

function remove(warrior) {
  if (warrior && warrior.log) ingestLog(warrior)
  warriors.delete(warrior.session)
  const actor = actors.get(warrior.session)
  if (actor && !actor.leaving) { actor.leave(); SFX.leave() }
  forgetCast(warrior.session)
  renderLog()
}

function onSnapshot(snapshot) {
  const alive = new Set(snapshot.warriors.map(w => w.session))
  for (const warrior of [...warriors.values()]) if (!alive.has(warrior.session)) remove(warrior)
  store.ledger = snapshot.ledger
  requestTier(snapshot.warriors.length, { quiet: true })   // size the yard once, before the warriors walk in
  for (const warrior of snapshot.warriors) upsert(warrior)
  renderPanels()
}

function onLeave(warrior) {
  remove(warrior)
  if (warrior.demo) delete store.ledger[projectKey(warrior.cwd)]
  else rememberInLedger(warrior, Math.max(0, (warrior.lastSeen - (warrior.creditedAt || warrior.joinedAt)) / 60000))
  renderPanels()
}

export function connect() {
  const status = $('#conn')
  const source = new EventSource('/events')
  source.onopen = () => { status.textContent = '연결됨'; status.className = 'status' }
  source.onerror = () => { status.textContent = RETRY_LABEL; status.className = 'status off' }
  const data = ev => JSON.parse(ev.data)
  source.addEventListener('snapshot', ev => onSnapshot(data(ev)))
  for (const kind of ['join', 'update', 'levelup']) source.addEventListener(kind, ev => { upsert(data(ev).warrior); renderPanels() })
  source.addEventListener('leave', ev => onLeave(data(ev).warrior))
  source.addEventListener('chat', ev => onChat(data(ev)))
}
