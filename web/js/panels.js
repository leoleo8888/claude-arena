// The side panels: the roster, the battle log with one tab per connected session, and the hall of fame.
import { PANEL_REFRESH_MS, FEED_MAX } from './config.js'
import { warriors, feed, seenLog, latestLine, store, serverNow, napping, agentBadge } from './store.js'
import { themeOf } from './themes.js'
import { castLine, currentCast } from './casting.js'
import { renderRemote } from './remote.js'
import { levelOf, xpFor, esc, fmtDur, projectKey, shortModel, $ } from './util.js'

const HALL_ROWS = 8
const EMPTY = text => `<div class="empty">${text}</div>`

export function renderPanels() {
  renderRoster()
  renderHall()
  renderRemote()
}

const bar = (cls, label, value) =>
  `<b>${label}</b><span class="bar ${cls}"><i style="width:${value == null ? 0 : value}%"></i></span><span>${value == null ? '--' : value + '%'}</span>`

function doingOf(warrior, theme) {
  if (warrior.enemy) return `${currentCast(warrior.session, theme, warrior.enemy.name).name} (${warrior.enemy.tool})`
  if (warrior.status === 'training') return warrior.quest || '퀘스트 중'
  if (warrior.status === 'resting') return '휴식 중'
  return napping(warrior) ? '낮잠 중 💤' : '대기 중'
}

function rosterCard(warrior, now) {
  const level = levelOf(warrior.xp), into = warrior.xp - xpFor(level - 1), need = xpFor(level) - xpFor(level - 1)
  const theme = themeOf(warrior.session)
  const project = warrior.project && warrior.project !== warrior.name ? `📁 ${esc(warrior.project)} · ` : ''
  const squires = warrior.squires.length ? ` · 종자 ${warrior.squires.length}` : ''
  return `<div class="w ${warrior.status}" data-session="${esc(warrior.session)}" title="클릭하면 이 세션과 대화">
    <div class="n"><b title="${esc(warrior.name)}">${esc(warrior.name)}</b>${agentBadge(warrior)}<small>Lv${level} · ${warrior.kills} kills · ${esc(shortModel(warrior.model))}</small></div>
    <div class="d" title="${esc(theme ? theme.fact : '')}">${project}🏛 ${esc(theme ? theme.name : '')} · ${esc(doingOf(warrior, theme))}${squires} · ⏱ ${fmtDur(Math.max(0, now - warrior.joinedAt))}</div>
    <div class="bars">${bar('hp', 'HP', warrior.hp)}${bar('mp', 'MP', warrior.mp)}${bar('sp', 'SP', warrior.sp)}${bar('xp', 'XP', need ? Math.round(into / need * 100) : 0)}</div></div>`
}

function renderRoster() {
  const list = [...warriors.values()], now = serverNow()
  $('#count').textContent = list.length ? `${list.length} warrior${list.length > 1 ? 's' : ''} in the yard` : ''
  $('#rosterBody').innerHTML = list.length ? list.map(w => rosterCard(w, now)).join('') : EMPTY('연습장이 비어 있습니다.')
}

/** The hall counts what the server credited so far plus the uncredited tail of each live session. */
function renderHall() {
  const now = serverNow(), liveMinutes = {}
  for (const w of warriors.values()) liveMinutes[projectKey(w.cwd)] = (liveMinutes[projectKey(w.cwd)] || 0) + Math.max(0, now - (w.creditedAt || w.joinedAt)) / 60000
  const rows = Object.entries(store.ledger)
    .map(([key, row]) => ({ ...row, minutes: (row.minutes || 0) + (liveMinutes[key] || 0) }))
    .sort((a, b) => b.xp - a.xp).slice(0, HALL_ROWS)
  $('#ledgerBody').innerHTML = rows.length
    ? `<table>${rows.map(r => `<tr><td title="${esc(r.name)}">${esc(r.name)}</td><td>Lv${levelOf(r.xp)}</td><td class="r">${r.kills} kills</td><td class="r">${r.xp} xp</td><td class="r">${r.sessions} ses</td><td class="r">${fmtDur(r.minutes * 60000)}</td></tr>`).join('')}</table>`
    : EMPTY('아직 기록이 없습니다.')
}

/** Adds a warrior's new log lines to the feed and remembers its newest one for the scoreboard. */
export function ingestLog(warrior) {
  const theme = themeOf(warrior.session)
  let added = false
  for (const line of warrior.log) {
    const id = `${warrior.session}:${line.t}:${line.text}`
    if (seenLog.has(id)) continue
    seenLog.add(id)
    const text = castLine(line.text, warrior.session, theme)
    feed.push({ t: line.t, session: warrior.session, who: warrior.name, text, tone: line.tone })
    added = true
    const newest = latestLine.get(warrior.session)
    if (!newest || line.t >= newest.t) latestLine.set(warrior.session, { key: id, t: line.t, text, tone: line.tone })
  }
  if (!added) return
  feed.sort((a, b) => a.t - b.t)
  while (feed.length > FEED_MAX) feed.shift()
  renderLog()
}

/** One tab per connected session plus "All"; a departed session's lines stay under All. */
export function renderLog() {
  if (store.logTab !== 'all' && !warriors.has(store.logTab)) store.logTab = 'all'
  const counts = {}
  for (const line of feed) counts[line.session] = (counts[line.session] || 0) + 1
  const tab = (id, label, n) => `<button class="tab${store.logTab === id ? ' on' : ''}" data-tab="${esc(id)}" title="${esc(label)}">${esc(label)}<i>${n}</i></button>`
  $('#logTabs').innerHTML = tab('all', 'All', feed.length) + [...warriors.values()].map(w => tab(w.session, w.name, counts[w.session] || 0)).join('')
  const list = $('#logBody')
  const shown = store.logTab === 'all' ? feed : feed.filter(line => line.session === store.logTab)
  list.innerHTML = shown.map(line => `<li class="${line.tone}">${store.logTab === 'all' ? `<b>${esc(line.who)}</b> › ` : ''}${esc(line.text)}</li>`).join('')
  list.scrollTop = list.scrollHeight
}

export function initPanels() {
  $('#logTabs').addEventListener('click', ev => {
    const button = ev.target.closest('button[data-tab]')
    if (!button) return
    store.logTab = button.dataset.tab
    renderLog()
  })
  setInterval(renderPanels, PANEL_REFRESH_MS)
}
