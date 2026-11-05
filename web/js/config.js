// Every tunable number and color of the yard in one place.

// ---- canvas grid: 1120x630 = 32 x 18 tiles of 35 px
export const TILE = 35
export const COLS = 32
export const ROWS = 18
export const SCALE = 3                                   // hero/enemy sprite pixel size
export const GATE = { x: 1.5 * TILE, y: 9 * TILE }       // the opening in the left wall
export const CORRIDOR_X = 3.2 * TILE                     // the free strip between the gate and the first column of posts

// ---- posts (training slots)
export const MAX_POSTS = 6
export const SLOT_X0 = 7 * TILE                          // first column when three columns are open
export const SLOT_DX = 8.5 * TILE                        // column spacing
export const ROWS_Y = { 1: [8.9 * TILE], 2: [5.5 * TILE, 12.3 * TILE] }   // row baselines for one- and two-row layouts
export const LANE_DY = 72                                // the walking lane runs this far below a row of posts
export const POST_HIT = { left: -50, right: 140, top: -78, bottom: 80 }   // mouse hit box around a post, relative to its slot
export const BOARD = { dx: -50, dy: -74, w: 190, h: 18 }                   // the scoreboard strip above a post
export const BOARD_HIT_PAD = 3

// ---- timings (ms)
export const NAP_MS = 10_000              // nothing to do for this long → the warrior lies down
export const SHRINK_MS = 45_000           // fewer sessions for this long → the yard drops a tier
export const TIER_CHECK_MS = 5_000
export const PANEL_REFRESH_MS = 5_000     // elapsed times and nap states keep moving while nothing else happens
export const ENEMY_LABEL_AGE_MS = 8_000   // a tool call running longer than this shows its elapsed seconds
export const ENEMY_GROW_AGE_MS = 20_000   // …and longer than this makes the monster grow
export const ENEMY_DIE_MS = 700             // long enough for a sink or a drop through the trapdoor
export const FRAME_MS = 160               // sprite animation frame length
export const WALK_PX_PER_MS = 0.22
export const TICKER_PX_PER_MS = 0.05      // scoreboard crawl, ~50 px/s right to left
export const FEED_MAX = 400               // battle log lines kept on the page

// ---- text and colors
export const FONT = 'ui-monospace, Consolas, monospace'
export const font = (px, bold = false) => `${bold ? 'bold ' : ''}${px}px ${FONT}`
export const COLOR = {
  text: '#e5e7eb', dim: '#8b95a3', gold: '#ffd23f', ok: '#7cf2a0', err: '#ff4d4d', amber: '#ffb347',
  hp: '#5fd35f', mp: '#6aa6ff', sp: '#c080ff',
  dark: '#0b0e12', shade: 'rgba(0,0,0,.55)', panel: 'rgba(10,12,16,.92)',
  wood: '#5a4634', woodDark: '#3a2f26', boardIdle: '#6b5a48',
}
export const TICKER_COLOR = { success: '#7cf2a0', error: '#ff6b6b', warning: '#ffd23f', suggestion: '#8fd3ff', text: '#ffb347' }
