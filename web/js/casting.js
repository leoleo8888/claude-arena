// Who exactly steps out when the server says "a Goblin appeared": one foe drawn at random from the arena's cast for
// that class. The pick is made when the appearance line is read and remembered per session and class, so the
// canvas sprite, the battle log and the roster all name the same foe until the next appearance.
import { castOf } from './themes.js'

const MONSTER_RE = /\b(Slime|Scribe|Goblin|Summon|Bat|Imp|Wisp)\b/g
const APPEARANCE = '출현'
const current = new Map()   // `${session}:${monster}` -> skin

const keyOf = (session, monster) => `${session}:${monster}`

export function pickCast(session, theme, monster) {
  const pool = castOf(theme, monster)
  const skin = pool[Math.floor(Math.random() * pool.length)]
  current.set(keyOf(session, monster), skin)
  return skin
}

export const currentCast = (session, theme, monster) => current.get(keyOf(session, monster)) || pickCast(session, theme, monster)

/** A battle log line with the server's class names replaced by the cast; an appearance line draws a new foe. */
export function castLine(text, session, theme) {
  if (!theme) return text
  const appears = text.includes(APPEARANCE)
  return text.replace(MONSTER_RE, monster => (appears ? pickCast(session, theme, monster) : currentCast(session, theme, monster)).name)
}

export function forgetCast(session) {
  for (const key of [...current.keys()]) if (key.startsWith(`${session}:`)) current.delete(key)
}
