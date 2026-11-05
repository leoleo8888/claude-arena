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
  const f = floor.getContext('2d')
  f.clearRect(0, 0, floor.width, floor.height)
  paintTiles(f)
  paintLanes(f)
  for (const slot of activeSlots()) paintPost(f, slot)
  paintDecor(f)
}

function paintTiles(f) {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647   // deterministic, so the sand never flickers
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = c * TILE, y = r * TILE
    const wall = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1
    const gate = c === 0 && GATE_ROWS.has(r)
    if (wall && !gate) {
      f.fillStyle = (r + c) % 2 ? '#6b5a48' : '#5f5040'; f.fillRect(x, y, TILE, TILE)
      f.fillStyle = '#4a3e32'; f.fillRect(x, y + TILE - 4, TILE, 4); f.fillRect(x + TILE - 3, y, 3, TILE)
      f.fillStyle = '#7d6b57'; f.fillRect(x + 4, y + 4, TILE - 12, 3)
    } else if (gate) {
      f.fillStyle = '#1a1612'; f.fillRect(x, y, TILE, TILE)
      f.fillStyle = '#3a2f26'; f.fillRect(x + TILE - 6, y, 6, TILE)
    } else {
      const v = rnd()
      f.fillStyle = v < 0.08 ? '#cdb58a' : v < 0.2 ? '#b89f76' : '#c2aa80'
      f.fillRect(x, y, TILE, TILE)
      if (v > 0.93) { f.fillStyle = '#a8906a'; f.fillRect(x + 8 + rnd() * 16, y + 8 + rnd() * 16, 4, 3) }
      if (v < 0.05) { f.fillStyle = '#8f9b66'; f.fillRect(x + 6 + rnd() * 18, y + 10 + rnd() * 14, 3, 5) }
    }
  }
}

/** Worn walking lanes: the corridor by the gate and one below each open row of posts. */
function paintLanes(f) {
  f.fillStyle = 'rgba(120, 95, 60, .18)'
  f.fillRect(CORRIDOR_X - 10, TILE * 2.2, 36, TILE * 14.2)
  for (const y of new Set(activeSlots().map(s => s.y))) {
    const rightmost = Math.max(...activeSlots().filter(s => s.y === y).map(s => s.x))
    f.fillRect(CORRIDOR_X - 10, y + LANE_DY + 8, rightmost - CORRIDOR_X + 30, 26)
  }
}

function paintPost(f, slot) {
  const theme = THEMES[slot.theme]
  f.save(); theme.paint(f, slot); f.restore()
  // name strip under the post
  f.fillStyle = 'rgba(0,0,0,.35)'; f.fillRect(slot.x - 50, slot.y + 66, 190, 14)
  f.fillStyle = COLOR.text; f.font = font(10, true); f.textAlign = 'center'
  f.fillText(`${theme.name}  ·  ${theme.era}`, slot.x + 45, slot.y + 77)
  // scoreboard frame above it; the render loop crawls the latest log line across it
  const b = board(slot)
  f.fillStyle = COLOR.woodDark; f.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6)
  f.fillStyle = '#0b0d12'; f.fillRect(b.x, b.y, b.w, b.h)
  f.fillStyle = COLOR.wood
  for (const px of [b.x - 1, b.x + b.w - 2]) for (const py of [b.y - 1, b.y + b.h - 2]) f.fillRect(px, py, 3, 3)
  f.fillRect(b.x + 20, b.y + b.h + 3, 3, 6); f.fillRect(b.x + b.w - 23, b.y + b.h + 3, 3, 6)   // legs down to the sand
}

/** A banner over the gate and a few torches along the top wall. */
function paintDecor(f) {
  f.fillStyle = '#8c2f2f'; f.fillRect(TILE * 0.3, TILE * 6.6, 24, 40)
  f.fillStyle = '#d9484a'; f.fillRect(TILE * 0.3 + 4, TILE * 6.6 + 4, 16, 28)
  for (const tx of [8, 16, 24]) {
    f.fillStyle = COLOR.wood; f.fillRect(tx * TILE + 14, 10, 6, 18)
    f.fillStyle = COLOR.amber; f.fillRect(tx * TILE + 11, 2, 12, 10)
    f.fillStyle = '#ffe08a'; f.fillRect(tx * TILE + 14, 4, 6, 6)
  }
}
