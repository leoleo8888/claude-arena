// The page's single source of truth: what the server told us, and the actors animating it.
import { NAP_MS } from './config.js'

export const warriors = new Map()     // session -> the server's warrior record (latest)
export const actors = new Map()       // session -> the Actor drawn on the canvas
export const chats = new Map()        // session -> conversation rows (memory only, here and on the server)
export const feed = []                // battle log lines across sessions: { t, session, who, text, tone }
export const seenLog = new Set()      // log line ids already in the feed
export const latestLine = new Map()   // session -> its newest log line, for the scoreboard

export const store = {
  ledger: {},        // projectKey -> { name, xp, kills, sessions, minutes }
  clockSkew: 0,      // server time - browser time, so elapsed times use the server's clock
  logTab: 'all',     // 'all' or the session whose log is shown
}

export const serverNow = () => Date.now() + store.clockSkew
export const napping = warrior => warrior.status === 'idle' && !warrior.enemy && warrior.idleSince != null && serverNow() - warrior.idleSince > NAP_MS
export const liveCount = () => [...actors.values()].filter(actor => !actor.leaving).length

/** Only a Claude session has a mod that takes prompts and renames from the page; a codex warrior is watched, not driven. */
export const acceptsRemote = warrior => !warrior.agent || warrior.agent === 'claude'
export const agentBadge = warrior => (warrior.agent && warrior.agent !== 'claude' ? `<i class="agent">${warrior.agent}</i>` : '')

export const moodOf = warrior =>
  warrior.status === 'training' ? '훈련 중' : warrior.status === 'resting' ? '휴식 중' : napping(warrior) ? '낮잠 중' : '대기 중'
