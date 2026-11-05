// Where things stand: the posts (slots), their scoreboards, the walking routes and the mouse hit boxes.
// Six slot objects exist from the start so an actor's slot reference survives a re-layout; only the first
// `layout.tier` of them are in use (2, 4 or 6 posts: one centered row, 2x2, 3x2).
import { GATE, CORRIDOR_X, MAX_POSTS, SLOT_X0, SLOT_DX, ROWS_Y, LANE_DY, POST_HIT, BOARD, BOARD_HIT_PAD } from './config.js'

export const slots = Array.from({ length: MAX_POSTS }, (_, i) => ({ x: 0, y: 0, used: null, lastUsed: null, theme: i, tickerKey: null, tickerX: 0, flashUntil: 0 }))
export const layout = { tier: 0, hoverSlot: null, hoverBoard: false }

export const tierFor = sessions => sessions <= 2 ? 2 : sessions <= 4 ? 4 : 6
export const activeSlots = () => slots.slice(0, layout.tier)

/** Moves the first `tier` slots into that tier's grid; the rest keep their last place. */
export function placeSlots(tier) {
  const cols = tier === 6 ? 3 : 2
  const rowsY = ROWS_Y[tier === 2 ? 1 : 2]
  const x0 = SLOT_X0 + (3 - cols) * SLOT_DX / 2     // fewer columns sit centered where the full row would be
  slots.forEach((slot, i) => {
    if (i < tier) { slot.x = x0 + (i % cols) * SLOT_DX; slot.y = rowsY[Math.floor(i / cols)] }
    slot.tickerKey = null                            // the scoreboard moved: restart its crawl
  })
}

export const freeSlot = () => activeSlots().find(slot => !slot.used) || activeSlots()[Math.floor(Math.random() * layout.tier)]
export const claimSlot = (slot, session) => { slot.used = session; slot.lastUsed = session }
export const releaseSlot = (slot, session) => { if (slot.used === session) slot.used = null }

export const board = slot => ({ x: slot.x + BOARD.dx, y: slot.y + BOARD.dy, w: BOARD.w, h: BOARD.h })
export const laneY = slot => slot.y + LANE_DY

// Walk the corridor and the row's lane instead of cutting across other posts.
export const routeIn = slot => [{ x: CORRIDOR_X, y: GATE.y }, { x: CORRIDOR_X, y: laneY(slot) }, { x: slot.x, y: laneY(slot) }, { x: slot.x, y: slot.y }]
export const routeOut = slot => [{ x: slot.x, y: laneY(slot) }, { x: CORRIDOR_X, y: laneY(slot) }, { x: CORRIDOR_X, y: GATE.y }, { x: GATE.x, y: GATE.y }]
/** After a re-layout: from the gate side take the full route in, otherwise drop to the lane and walk along it. */
export const relocationPath = (actor, slot) =>
  actor.x <= CORRIDOR_X + 1 ? routeIn(slot) : [{ x: actor.x, y: laneY(slot) }, { x: slot.x, y: laneY(slot) }, { x: slot.x, y: slot.y }]

export const slotAt = (x, y) => activeSlots().find(s => x > s.x + POST_HIT.left && x < s.x + POST_HIT.right && y > s.y + POST_HIT.top && y < s.y + POST_HIT.bottom) || null
export const isOnBoard = (slot, y) => { const b = board(slot); return y >= b.y - BOARD_HIT_PAD && y <= b.y + b.h + BOARD_HIT_PAD }

/** A mouse event's position in canvas pixels (the canvas is scaled by CSS). */
export const canvasPoint = (canvas, ev) => {
  const r = canvas.getBoundingClientRect()
  return { x: (ev.clientX - r.left) * canvas.width / r.width, y: (ev.clientY - r.top) * canvas.height / r.height }
}
