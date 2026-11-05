// The remote: a modal with one session's conversation, a prompt box, a rename field and the terminal button.
import { warriors, actors, chats, moodOf, acceptsRemote } from './store.js'
import { themeOf } from './themes.js'
import { showBoardNote } from './notes.js'
import { esc, shortModel, postJson, $ } from './util.js'
import { renderMarkdown } from './markdown.js'

const STATE_LABEL = { queued: '전달 대기 중…', sent: '세션에 전달됨', started: '', failed: '전달 실패' }
const FOCUS_WORD = {
  focused: '터미널 창을 앞으로 가져왔습니다',
  flashed: '작업 표시줄에서 터미널 창이 깜빡입니다. 클릭해 주세요',
  gone: '터미널 창을 찾지 못했습니다 (닫혔거나 다시 열림)',
  unsupported: '이 서버의 OS에서는 창 활성화를 지원하지 않습니다',
}
const NOTE_MS = 5000, FLASH_MS = 700

const modal = { session: null, note: null, commands: [] }   // note: a transient line under the conversation that re-renders must not wipe
const isEnter = ev => ev.key === 'Enter' && !ev.isComposing && ev.keyCode !== 229
const SUGGESTIONS_MAX = 8

export const setNote = (text, ms = NOTE_MS) => { modal.note = { text, until: Date.now() + ms }; renderRemote() }

export async function openRemote(session) {
  modal.session = session
  $('#remote').hidden = false
  renderRemote(true)
  try {
    const { rows } = await (await fetch(`/chat/${encodeURIComponent(session)}`)).json()
    if (rows) chats.set(session, rows)
    modal.commands = (await (await fetch(`/commands/${encodeURIComponent(session)}`)).json()).commands || []
  } catch (err) { setNote(`대화를 불러오지 못했습니다 (${err.message}). 스트림이 이어지면 채워집니다`) }
  renderRemote(true)
  $('#rmText').focus()
}

// ---- slash commands: "/" at the start of the prompt box lists what the session can run; Tab takes the first match
function suggestionsFor(value) {
  const match = /^\/([\w:-]*)$/.exec(value)
  if (!match) return []
  const typed = match[1].toLowerCase()
  return modal.commands.filter(c => c.name.toLowerCase().startsWith(typed)).slice(0, SUGGESTIONS_MAX)
}

function renderSuggestions() {
  const box = $('#rmSuggest'), list = suggestionsFor($('#rmText').value)
  box.hidden = list.length === 0
  box.innerHTML = list.map(c => `<button type="button" data-cmd="${esc(c.name)}"><b>/${esc(c.name)}</b> <span>${esc(c.description)}</span></button>`).join('')
}

function takeSuggestion(name) {
  const textarea = $('#rmText')
  textarea.value = `/${name} `
  $('#rmSuggest').hidden = true
  textarea.focus()
}

export function closeRemote() {
  modal.session = null
  $('#remote').hidden = true
  closeRename(false)
}

// An answer is Markdown, rendered as the terminal shows it; what the person typed and the notices stay literal.
const messageHtml = row => {
  const status = row.via === 'remote' && STATE_LABEL[row.state] ? `<span class="st">${esc(STATE_LABEL[row.state])}${row.error ? ` · ${esc(row.error)}` : ''}</span>` : ''
  const body = row.role === 'assistant' ? `<div class="md">${renderMarkdown(row.text)}</div>` : esc(row.text)
  const kind = row.kind === 'command' ? ' cmd' : ''
  return `<div class="msg ${row.role}${row.via === 'remote' ? ' remote' : ''}${kind}${row.state === 'failed' ? ' failed' : ''}">${body}${status}</div>`
}

export function renderRemote(scrollToEnd = false) {
  if (!modal.session) return
  const warrior = warriors.get(modal.session), theme = themeOf(modal.session)
  const drivable = !!warrior && acceptsRemote(warrior)
  if ($('#rmNameInput').hidden) $('#rmName').textContent = warrior ? warrior.name : '퇴장한 세션'   // not while a new name is being typed
  $('#rmRename').disabled = !drivable
  const agentNote = warrior && !drivable ? ` · ${warrior.agent} · 읽기 전용` : ''
  $('#rmMeta').textContent = warrior ? `🏛 ${theme ? theme.name : ''} · ${shortModel(warrior.model)} · ${moodOf(warrior)}${agentNote}` : '세션이 끝나 더 보낼 수 없습니다'
  const rows = chats.get(modal.session) || [], box = $('#rmRows')
  const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40
  box.innerHTML = rows.length ? rows.map(messageHtml).join('') : '<div class="msg notice">아직 대화가 없습니다.</div>'
  const liveNote = modal.note && modal.note.until > Date.now() ? modal.note.text : ''
  $('#rmTyping').textContent = liveNote || (warrior && warrior.status === 'training' ? '⚔ 전사가 싸우는 중… 답변이 끝나면 여기 나타납니다' : '')
  $('#rmText').disabled = !drivable; $('#rmSend').disabled = !drivable
  $('#rmText').placeholder = drivable || !warrior ? '이 세션에 보낼 지시… (Enter 전송, Shift+Enter 줄바꿈)' : `${warrior.agent} 세션은 지켜볼 수만 있습니다 (입력 전달 미지원)`
  $('#rmFocus').disabled = !(warrior && warrior.terminal)
  $('#rmFocus').title = warrior && warrior.terminal ? `${warrior.terminal.name} 창을 앞으로: ${warrior.terminal.title || ''}` : '이 세션의 터미널 창을 알지 못합니다'
  if (scrollToEnd || wasAtBottom) box.scrollTop = box.scrollHeight
}

export async function sendRemote() {
  const textarea = $('#rmText'), text = textarea.value.trim()
  if (!modal.session || !text || textarea.disabled) return
  textarea.value = ''
  $('#rmSuggest').hidden = true
  try {
    const res = await postJson(`/remote/${encodeURIComponent(modal.session)}`, { text })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) { textarea.value = text; setNote(`보내지 못했습니다: ${err.message}`) }
}

/** Brings the session's terminal window to the front; feedback goes on the scoreboard and, if open, the modal. */
export async function focusTerminal(session) {
  const warrior = warriors.get(session)
  if (!warrior) return
  const actor = actors.get(session), slot = actor ? actor.slot : null
  if (!warrior.terminal) { showBoardNote(slot, '🖥 터미널 정보 없음 (세션을 다시 시작하면 보고됩니다)', 2500); return }
  if (slot) slot.flashUntil = performance.now() + FLASH_MS
  showBoardNote(slot, `🖥 ${warrior.terminal.name} 창을 앞으로…`, 4000)
  let word = 'gone'
  try { word = (await (await fetch(`/focus/${encodeURIComponent(session)}`, { method: 'POST' })).json()).result || 'gone' } catch { /* offline */ }
  const text = `🖥 ${FOCUS_WORD[word] || word}`
  showBoardNote(slot, text, word === 'focused' ? 1500 : 3500)
  if (modal.session === session) setNote(text)
}

// ---- rename: the name turns into an input; Enter sends it, the session runs /rename when idle, and the title event renames the warrior
function openRename() {
  const warrior = warriors.get(modal.session)
  if (!warrior) return
  const input = $('#rmNameInput')
  input.value = warrior.title || warrior.name
  input.hidden = false; $('#rmName').textContent = ''; $('#rmRename').hidden = true
  input.focus(); input.select()
}

function closeRename(rerender = true) {
  $('#rmNameInput').hidden = true
  $('#rmRename').hidden = false
  if (rerender) renderRemote()
}

async function sendRename() {
  const title = $('#rmNameInput').value.trim(), session = modal.session
  closeRename()
  if (!title || !session) return
  try {
    const res = await postJson(`/rename/${encodeURIComponent(session)}`, { title })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setNote(`✎ 이름 변경 요청을 보냈습니다: ${title} (세션이 한가해지면 적용됩니다)`, 8000)
  } catch (err) { setNote(`이름을 바꾸지 못했습니다: ${err.message}`) }
}

/** A `chat` message from the stream: a whole conversation (reset) or one row, added or replaced by id. */
export function onChat(message) {
  if (message.reset) chats.set(message.session, message.rows)
  else {
    const rows = chats.get(message.session) || []
    const index = rows.findIndex(row => row.id === message.row.id)
    if (index >= 0) rows[index] = message.row; else rows.push(message.row)
    chats.set(message.session, rows)
  }
  if (message.session === modal.session) renderRemote()
}

async function copyCode(button) {
  const code = button.closest('.codebox')?.querySelector('code')
  if (!code) return
  try { await navigator.clipboard.writeText(code.textContent); button.textContent = '복사됨' } catch { button.textContent = '복사 실패' }
  setTimeout(() => { button.textContent = '복사' }, 1500)
}

export function initRemote() {
  $('#rmRows').addEventListener('click', ev => { const button = ev.target.closest('button[data-copy]'); if (button) copyCode(button) })
  $('#rmClose').addEventListener('click', closeRemote)
  $('#remote').addEventListener('click', ev => { if (ev.target === $('#remote')) closeRemote() })
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && modal.session) closeRemote() })
  $('#rmSend').addEventListener('click', sendRemote)
  $('#rmText').addEventListener('keydown', ev => {
    if (isEnter(ev) && !ev.shiftKey) { ev.preventDefault(); sendRemote() }
    else if (ev.key === 'Tab') { const first = suggestionsFor($('#rmText').value)[0]; if (first) { ev.preventDefault(); takeSuggestion(first.name) } }
  })
  $('#rmText').addEventListener('input', renderSuggestions)
  $('#rmSuggest').addEventListener('mousedown', ev => { const b = ev.target.closest('button[data-cmd]'); if (b) { ev.preventDefault(); takeSuggestion(b.dataset.cmd) } })
  $('#rmFocus').addEventListener('click', () => focusTerminal(modal.session))
  $('#rmRename').addEventListener('click', openRename)
  $('#rmNameInput').addEventListener('keydown', ev => {
    if (isEnter(ev)) { ev.preventDefault(); sendRename() }
    else if (ev.key === 'Escape') { ev.stopPropagation(); closeRename() }
  })
  $('#rmNameInput').addEventListener('blur', () => { if (!$('#rmNameInput').hidden) closeRename() })
}
