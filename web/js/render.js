// The frame loop: blit the floor, crawl the scoreboards, draw every actor with its plate and effects, then the
// canvas notes and the hover tooltip. Nothing here changes state except the actors' per-frame step.
import { SCALE, TILE, COLOR, font, FRAME_MS, NIGHTFALL, POST_HIT, TICKER_PX_PER_MS, TICKER_COLOR, ENEMY_LABEL_AGE_MS, ENEMY_GROW_AGE_MS, ENEMY_DIE_MS } from './config.js'
import { warriors, actors, latestLine, napping } from './store.js'
import { layout, activeSlots, board } from './layout.js'
import { THEMES } from './themes.js'
import { HERO, HERO_PALETTE, PALETTE_BY_AGENT, DRILLS, HERO_LIFT, SQUIRE, SQUIRE_PALETTE, SHAPES, CHARIOT, CHARIOT_PALETTE, CHARIOT_BOARD_ROWS, HORSE_PALETTE, enemyPalette, drawSprite } from './sprites.js'
import { floor } from './floor.js'
import { notes, expireNotes } from './notes.js'
import { drawFireworks } from './fireworks.js'
import { lungeOffset, enemyOffset, drawEnemyStage, drawEnemyCover, drawFightEffects } from './fightstyles.js'
import { fxLifetime } from './actor.js'
import { levelOf, xpFor, wrap, $ } from './util.js'

export const canvas = $('#yard')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
let lastFrameAt = performance.now(), frame = 0

export function startRenderLoop() { requestAnimationFrame(render) }

let faults = 0
const MAX_FAULT_LOGS = 5

/** One frame. A fault in a frame is logged and skipped: the loop must never stop, or the yard looks dead. */
function render(now) {
  try {
    drawFrame(now)
  } catch (err) {
    if (faults++ < MAX_FAULT_LOGS) console.error('render fault (frame skipped)', err)
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic'
  }
  requestAnimationFrame(render)
}

function drawFrame(now) {
  const dt = Math.min(50, now - lastFrameAt)
  lastFrameAt = now
  frame = Math.floor(now / FRAME_MS)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(floor, 0, 0)
  drawScoreboards(dt, now)
  expireNotes(now)
  drawBoardNote()
  for (const actor of [...actors.values()].sort((a, b) => a.y - b.y)) {
    actor.step(dt, now)
    if (actor.dead) { actors.delete(actor.session); continue }
    drawActor(actor, warriors.get(actor.session), now, dt)
  }
  if (actors.size === 0) drawEmptyNotice()
  drawFireworks(ctx, dt, now)
  drawToast()
  drawTooltip()
}

/** The newest log line of each post's warrior crawls right to left; a vacated post keeps its last line, dimmed. */
function drawScoreboards(dt, now) {
  ctx.font = font(11, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  for (const slot of activeSlots()) {
    const b = board(slot), line = latestLine.get(slot.used || slot.lastUsed)
    ctx.save(); ctx.beginPath(); ctx.rect(b.x + 2, b.y, b.w - 4, b.h); ctx.clip()
    if (!line) {
      ctx.fillStyle = COLOR.woodDark; ctx.fillText('· · · · · · · · · · · · · · · · · · ·', b.x + 6, b.y + b.h / 2 + 1)
    } else {
      if (slot.tickerKey !== line.key) { slot.tickerKey = line.key; slot.tickerX = b.x + b.w }
      const width = ctx.measureText(line.text).width
      slot.tickerX -= dt * TICKER_PX_PER_MS
      if (slot.tickerX + width < b.x + 2) slot.tickerX = b.x + b.w
      ctx.fillStyle = slot.used ? (TICKER_COLOR[line.tone] || COLOR.amber) : COLOR.boardIdle
      ctx.fillText(line.text, Math.round(slot.tickerX), b.y + b.h / 2 + 1)
    }
    ctx.restore()
    // a clicked scoreboard flashes; hovering one with a known terminal outlines it as a button
    const warrior = slot.used && warriors.get(slot.used)
    const hot = layout.hoverSlot === slot && layout.hoverBoard && warrior && warrior.terminal
    if (slot.flashUntil > now || hot) {
      ctx.strokeStyle = slot.flashUntil > now ? COLOR.gold : 'rgba(255,210,63,.6)'; ctx.lineWidth = 2
      ctx.strokeRect(b.x - 3.5, b.y - 3.5, b.w + 7, b.h + 7)
    }
  }
  ctx.textBaseline = 'alphabetic'
}

function drawBoardNote() {
  const note = notes.board
  if (!note) return
  const b = board(note.slot)
  ctx.font = font(11, true); ctx.textAlign = 'left'
  const width = ctx.measureText(note.text).width + 16
  const x = Math.min(b.x, canvas.width - 8 - width)
  ctx.fillStyle = COLOR.panel; ctx.fillRect(x, b.y - 24, width, 18)
  ctx.strokeStyle = COLOR.gold; ctx.lineWidth = 1; ctx.strokeRect(x + .5, b.y - 23.5, width - 1, 17)
  ctx.fillStyle = COLOR.gold; ctx.fillText(note.text, x + 8, b.y - 11)
}

function drawActor(actor, warrior, now, dt) {
  const pose = actor.currentPose(warrior, now)
  const frames = HERO[pose] || DRILLS[pose] || HERO.idle
  const frameIndex = frame % frames.length
  const lift = (HERO_LIFT[pose] || [])[frameIndex] || 0
  const bobY = pose === 'idle' ? Math.round(Math.sin((now + actor.bob) / 400)) : 0
  // shadow, squires behind, then the hero
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(actor.x + 18, actor.y + 44, 20, 6, 0, 0, Math.PI * 2); ctx.fill()
  if (warrior) warrior.squires.forEach((_, i) => drawSprite(ctx, SQUIRE[(frame + i) % 2], SQUIRE_PALETTE, actor.x - 26 - i * 16, actor.y + 14 + (i % 2) * 6, 2, false, 0.95))
  const palette = (warrior && PALETTE_BY_AGENT[warrior.agent]) || HERO_PALETTE
  const mounted = actor.mounted() && pose !== 'rest'
  // the chariot rolls whenever there is something to do: walking, fighting, or the session thinking between calls
  const rolling = actor.moving || (actor.enemy && !actor.enemy.dying) || (warrior && warrior.status === 'training')
  const rideBob = mounted && rolling ? Math.round(Math.sin(now / 110)) : 0   // a bumpy ride, so a thinking charioteer never looks frozen
  const hx = actor.x + lungeOffset(actor, now)   // a ram, a shield bash or a thrust carries the warrior forward for a moment
  if (actor.enemy) drawEnemyStage(ctx, actor, actor.enemy, now)
  if (mounted) drawMount(ctx, 'chariot', hx, actor.y + 14 * SCALE + rideBob, 12 * SCALE, SCALE, actor.facingLeft, rolling ? frame : 0, '#8a5a30', 'under')
  drawSprite(ctx, frames[frameIndex], palette, hx, actor.y + bobY + lift + rideBob, SCALE, actor.facingLeft, warrior && warrior.status === 'resting' ? 0.7 : 1)
  if (mounted) drawMount(ctx, 'chariot', hx, actor.y + 14 * SCALE + rideBob, 12 * SCALE, SCALE, actor.facingLeft, rolling ? frame : 0, '#8a5a30', 'over')
  if (actor.enemy) drawEnemy(actor, pose, now)
  drawFightEffects(ctx, actor, now)
  drawNightfall(actor, warrior, dt)
  if (warrior) drawNamePlate(actor, warrior, now)
  drawEffects(actor, now)
}

/** Lights out over a napping or resting warrior's post: an eased dark overlay and a small moon; the plate stays readable above it. */
function drawNightfall(actor, warrior, dt) {
  const dark = !!warrior && (warrior.status === 'resting' || napping(warrior)) && !actor.moving
  actor.dim += ((dark ? 1 : 0) - actor.dim) * Math.min(1, dt / NIGHTFALL.easeMs)
  if (actor.dim < 0.01) { actor.dim = 0; return }
  const slot = actor.slot
  ctx.fillStyle = `rgba(${NIGHTFALL.color}, ${(NIGHTFALL.alpha * actor.dim).toFixed(3)})`
  ctx.fillRect(slot.x + POST_HIT.left, slot.y + POST_HIT.top, POST_HIT.right - POST_HIT.left, POST_HIT.bottom - POST_HIT.top)
  ctx.globalAlpha = actor.dim; ctx.fillStyle = '#e8ecf2'; ctx.font = font(14); ctx.textAlign = 'right'
  ctx.fillText('☾', slot.x + POST_HIT.right - 6, slot.y + POST_HIT.top + 36)
  ctx.globalAlpha = 1
}

/** The enemy pops in, grows a little while a long tool call runs, and shrinks away when beaten. */
function drawEnemy(actor, pose, now) {
  const enemy = actor.enemy
  const skin = enemy.skin
  const frames = SHAPES[skin.shape] || SHAPES.wisp
  const age = now - enemy.bornAt
  const fullScale = age > ENEMY_GROW_AGE_MS ? SCALE + 1 : SCALE
  const keepsSize = enemy.exit === 'sink' || enemy.exit === 'drop'   // these foes leave by going down, not by shrinking
  const scale = enemy.dying && !keepsSize ? Math.max(0, SCALE * (1 - (now - enemy.dieAt) / ENEMY_DIE_MS)) : Math.min(fullScale, fullScale * age / 200)
  const offset = enemyOffset(enemy, now)              // rising on the lift, flinching, sinking, dropping
  const x = actor.enemyX() + offset.dx + (enemy.dying ? 0 : Math.round(Math.sin(now / 90) * (pose === 'attack' ? 2 : 0)))
  const y = actor.y + 44 + offset.dy - frames[0].length * scale
  const racing = actor.mounted()                      // the foe runs ahead, facing the same way as the warrior
  const bottom = actor.y + 44 + offset.dy, width = frames[0][0].length * scale
  if (skin.mount) drawMount(ctx, skin.mount, x, bottom, width, scale, racing ? false : true, frame, skin.c, 'under')
  drawSprite(ctx, frames[frame % 2], enemyPalette(skin.c), x, y, scale, !racing)
  if (skin.mount) drawMount(ctx, skin.mount, x, bottom, width, scale, racing ? false : true, frame, skin.c, 'over')
  drawEnemyCover(ctx, actor, enemy, now)
  if (enemy.dying) return
  ctx.font = font(11); ctx.fillStyle = skin.c; ctx.textAlign = 'center'
  ctx.fillText(age > ENEMY_LABEL_AGE_MS ? `${skin.name} ${Math.floor(age / 1000)}s` : skin.name, x + 15, y - 6)
  if (enemy.target) { ctx.fillStyle = COLOR.text; ctx.fillText(enemy.target.slice(0, 22), x + 15, actor.y + 58) }
}

/**
 * A chariot around a rider whose feet rest at `bottom` and whose sprite is `width` px wide: a horse in front, the
 * cart under the feet. `layer` 'under' draws the whole thing behind the rider, 'over' only the cart's front board,
 * so the rider ends up standing inside the cart. 'cart' is a cart alone behind a horse-shaped sprite.
 */
function drawMount(ctx, kind, x, bottom, width, scale, facingLeft, animFrame, horseColor, layer) {
  const dir = facingLeft ? -1 : 1
  const cartRows = CHARIOT[animFrame % 2], cartW = cartRows[0].length * scale
  const cartX = kind === 'cart'
    ? (facingLeft ? x + width + 2 : x - cartW - 2)                         // behind the horse that pulls it
    : (facingLeft ? x + width + 4 * scale - cartW : x - 4 * scale)        // under the rider's feet (floor is row 4)
  const cartY = bottom - 4 * scale
  if (layer === 'over') return drawSprite(ctx, cartRows.slice(0, CHARIOT_BOARD_ROWS), CHARIOT_PALETTE, cartX, cartY, scale, facingLeft)
  drawSprite(ctx, cartRows, CHARIOT_PALETTE, cartX, cartY, scale, facingLeft)
  if (kind !== 'chariot') return
  const horse = SHAPES.horse[animFrame % 2], horseW = horse[0].length * scale, horseH = horse.length * scale
  const horseX = dir > 0 ? x + width + 2 : x - horseW - 2
  drawSprite(ctx, horse, HORSE_PALETTE(horseColor), horseX, bottom + 2 * scale - horseH, scale, facingLeft)
}

/** Name and bars above the hero; just the name while walking, so plates do not cross other posts. */
function drawNamePlate(actor, warrior, now) {
  const name = warrior.name.slice(0, 12)
  if (actor.moving) {
    ctx.font = font(12, true); ctx.textAlign = 'center'
    ctx.fillStyle = COLOR.shade; ctx.fillRect(actor.x - 24, actor.y - 20, 84, 16)
    ctx.fillStyle = COLOR.text; ctx.fillText(name, actor.x + 18, actor.y - 8)
    return
  }
  const level = levelOf(warrior.xp), into = warrior.xp - xpFor(level - 1), need = xpFor(level) - xpFor(level - 1)
  const x = actor.x - 16, y = actor.y - 34
  ctx.font = font(12, true); ctx.textAlign = 'left'
  ctx.fillStyle = COLOR.shade; ctx.fillRect(x - 4, y - 13, 100, 34)
  ctx.fillStyle = warrior.status === 'training' ? COLOR.gold : COLOR.text; ctx.fillText(name, x, y - 2)
  ctx.fillStyle = COLOR.dim; ctx.font = font(10); ctx.textAlign = 'right'; ctx.fillText(`Lv${level}`, x + 94, y - 2)
  const bar = (row, value, color) => {
    ctx.fillStyle = COLOR.dark; ctx.fillRect(x, y + 2 + row * 5, 92, 3)
    if (value != null) { ctx.fillStyle = color; ctx.fillRect(x, y + 2 + row * 5, Math.round(92 * value / 100), 3) }
  }
  bar(0, warrior.hp, COLOR.hp); bar(1, warrior.mp, COLOR.mp); bar(2, warrior.sp, COLOR.sp); bar(3, need ? into / need * 100 : 0, COLOR.gold)
  if (warrior.status === 'resting' || napping(warrior)) {
    ctx.fillStyle = COLOR.dim; ctx.font = font(12); ctx.textAlign = 'left'
    ctx.fillText('z z', actor.x + 36, actor.y + 4 - Math.round(Math.sin(now / 500) * 3))
  }
}

function drawEffects(actor, now) {
  for (const p of actor.particles) { ctx.globalAlpha = 1 - (now - p.born) / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3) }
  ctx.globalAlpha = 1
  for (const fx of actor.fx) {
    const t = (now - fx.born) / fxLifetime(fx)
    ctx.globalAlpha = 1 - t; ctx.fillStyle = fx.color; ctx.textAlign = 'left'
    ctx.font = font(fx.big ? 16 : 12, true)
    ctx.fillText(fx.text, fx.x, fx.y - t * 30)
  }
  ctx.globalAlpha = 1
}

function drawEmptyNotice() {
  const y = 15.2 * TILE
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(canvas.width / 2 - 230, y - 24, 460, 48)
  ctx.fillStyle = COLOR.text; ctx.font = font(16); ctx.textAlign = 'center'
  ctx.fillText('연습장이 비어 있습니다. 세션을 열면 전사가 입장합니다.', canvas.width / 2, y + 6)
}

function drawToast() {
  const toast = notes.toast
  if (!toast) return
  ctx.font = font(13, true); ctx.textAlign = 'center'
  const width = ctx.measureText(toast.text).width + 28
  ctx.fillStyle = 'rgba(10,12,16,.9)'; ctx.fillRect(canvas.width / 2 - width / 2, 44, width, 26)
  ctx.strokeStyle = COLOR.gold; ctx.lineWidth = 1; ctx.strokeRect(canvas.width / 2 - width / 2 + .5, 44.5, width - 1, 25)
  ctx.fillStyle = COLOR.gold; ctx.fillText(toast.text, canvas.width / 2, 62)
}

/** Hovering a post shows what a click does and the arena's history. */
function drawTooltip() {
  const slot = layout.hoverSlot
  if (!slot) return
  const theme = THEMES[slot.theme]
  const warrior = slot.used && warriors.get(slot.used)
  const hint = !warrior ? null
    : layout.hoverBoard ? (warrior.terminal ? `▶ 클릭: ${warrior.terminal.name} 터미널 창 앞으로` : '(터미널 정보 없음)')
    : '▶ 클릭: 이 세션과 대화 · 전광판 클릭: 터미널 창'
  const lines = hint ? [hint, '', ...wrap(theme.fact, 30)] : wrap(theme.fact, 30)
  const w = 360, h = 34 + lines.length * 15
  let x = slot.x - 60, y = layout.hoverBoard ? slot.y + 90 : slot.y - 40 - h   // keep the scoreboard and its note visible
  if (y < 8) y = slot.y + 90
  if (y + h > canvas.height - 8) y = canvas.height - 8 - h
  x = Math.max(8, Math.min(x, canvas.width - 8 - w))
  ctx.fillStyle = COLOR.panel; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = COLOR.gold; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1)
  ctx.textAlign = 'left'; ctx.fillStyle = COLOR.gold; ctx.font = font(12, true)
  ctx.fillText(`${theme.name}  ·  ${theme.era}`, x + 10, y + 18)
  ctx.fillStyle = COLOR.text; ctx.font = font(11)
  lines.forEach((line, i) => ctx.fillText(line, x + 10, y + 36 + i * 15))
}
