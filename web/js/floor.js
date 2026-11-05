// The static background, painted once per layout onto an offscreen canvas: walls, sand, lanes, the posts and their
// scoreboard frames. The render loop blits it every frame.
import { TILE, COLS, ROWS, CORRIDOR_X, LANE_DY, COLOR, font } from './config.js'
import { activeSlots, board } from './layout.js'
import { THEMES } from './themes.js'

export const floor = document.createElement('canvas')
floor.width = COLS * TILE
floor.height = ROWS * TILE

const GATE_ROWS = new Set([8, 9, 10])

export function paintFloor() {
  const ctx = floor.getContext('2d')
  ctx.clearRect(0, 0, floor.width, floor.height)
  paintTiles(ctx)
  paintLanes(ctx)
  for (const slot of activeSlots()) paintPost(ctx, slot)
  paintDecor(ctx)
}

function paintTiles(ctx) {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647   // deterministic, so the sand never flickers
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = c * TILE, y = r * TILE
    const wall = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1
    const gate = c === 0 && GATE_ROWS.has(r)
    if (wall && !gate) {
      ctx.fillStyle = (r + c) % 2 ? '#6b5a48' : '#5f5040'; ctx.fillRect(x, y, TILE, TILE)
      ctx.fillStyle = '#4a3e32'; ctx.fillRect(x, y + TILE - 4, TILE, 4); ctx.fillRect(x + TILE - 3, y, 3, TILE)
      ctx.fillStyle = '#7d6b57'; ctx.fillRect(x + 4, y + 4, TILE - 12, 3)
    } else if (gate) {
      ctx.fillStyle = '#1a1612'; ctx.fillRect(x, y, TILE, TILE)
      ctx.fillStyle = '#3a2f26'; ctx.fillRect(x + TILE - 6, y, 6, TILE)
    } else {
      const grain = rnd()
      ctx.fillStyle = grain < 0.08 ? '#cdb58a' : grain < 0.2 ? '#b89f76' : '#c2aa80'
      ctx.fillRect(x, y, TILE, TILE)
      if (grain > 0.93) { ctx.fillStyle = '#a8906a'; ctx.fillRect(x + 8 + rnd() * 16, y + 8 + rnd() * 16, 4, 3) }
      if (grain < 0.05) { ctx.fillStyle = '#8f9b66'; ctx.fillRect(x + 6 + rnd() * 18, y + 10 + rnd() * 14, 3, 5) }
    }
  }
}

/** Worn walking lanes: the corridor by the gate and one below each open row of posts. */
function paintLanes(ctx) {
  ctx.fillStyle = 'rgba(120, 95, 60, .18)'
  ctx.fillRect(CORRIDOR_X - 10, TILE * 2.2, 36, TILE * 14.2)
  for (const y of new Set(activeSlots().map(slot => slot.y))) {
    const rightmost = Math.max(...activeSlots().filter(slot => slot.y === y).map(slot => slot.x))
    ctx.fillRect(CORRIDOR_X - 10, y + LANE_DY + 8, rightmost - CORRIDOR_X + 30, 26)
  }
}

function paintPost(ctx, slot) {
  const theme = THEMES[slot.theme]
  ctx.save(); theme.paint(ctx, slot); ctx.restore()
  // name strip under the post
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(slot.x - 50, slot.y + 66, 190, 14)
  ctx.fillStyle = COLOR.text; ctx.font = font(10, true); ctx.textAlign = 'center'
  ctx.fillText(`${theme.name}  ·  ${theme.era}`, slot.x + 45, slot.y + 77)
  // scoreboard frame above it; the render loop crawls the latest log line across it
  const b = board(slot)
  ctx.fillStyle = COLOR.woodDark; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6)
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.fillStyle = COLOR.wood
  for (const px of [b.x - 1, b.x + b.w - 2]) for (const py of [b.y - 1, b.y + b.h - 2]) ctx.fillRect(px, py, 3, 3)
  ctx.fillRect(b.x + 20, b.y + b.h + 3, 3, 6); ctx.fillRect(b.x + b.w - 23, b.y + b.h + 3, 3, 6)   // legs down to the sand
}

/** A banner over the gate and a few torches along the top wall. */
function paintDecor(ctx) {
  ctx.fillStyle = '#8c2f2f'; ctx.fillRect(TILE * 0.3, TILE * 6.6, 24, 40)
  ctx.fillStyle = '#d9484a'; ctx.fillRect(TILE * 0.3 + 4, TILE * 6.6 + 4, 16, 28)
  for (const tx of [8, 16, 24]) {
    ctx.fillStyle = COLOR.wood; ctx.fillRect(tx * TILE + 14, 10, 6, 18)
    ctx.fillStyle = COLOR.amber; ctx.fillRect(tx * TILE + 11, 2, 12, 10)
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(tx * TILE + 14, 4, 6, 6)
  }
}
