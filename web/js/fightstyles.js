// How a fight looks in each arena. A style is data: how often the warrior attacks, what flies (or lunges), how
// the foe arrives and how it goes. The engine below turns that into projectiles, lunges and particle bursts on
// the actor; render.js asks for the offsets and draws the effects. Historical note: no cannon in antiquity, so
// the sea battle shoots arrows, scorpio bolts and catapult stones.
import { SCALE } from './config.js'

const LUNGE_MS = 320
const STRIKE_MS = 220
const ENTRANCE_MS = 600
const EXIT_MS = 700

export const STYLES = {
  'Circus Maximus': { cadenceMs: 950, attack: { kind: 'lunge', px: 26, impact: 'sparks' }, exit: 'wheel', hitAt: 'wheel' },
  'Naumachia': { cadenceMs: 720, attack: { kind: 'projectile', shapes: ['arrow', 'arrow', 'bolt', 'stone'], flightMs: 420, arc: 34, impact: 'splash' }, entrance: 'splash', exit: 'sink' },
  'Venatio': { cadenceMs: 880, attack: { kind: 'projectile', shapes: ['javelin'], flightMs: 300, arc: 14, impact: 'dust', lungePx: 10 }, exit: 'dust' },
  'Ludus Capua': { cadenceMs: 800, attack: { kind: 'projectile', shapes: ['knife', 'knife', 'chain'], flightMs: 260, arc: 10, impact: 'sparks' }, exit: 'chains' },
  'Ludus Magnus': { cadenceMs: 700, attack: { kind: 'strike', lungePx: 12, impact: 'dust' }, exit: 'dust' },
  'Hypogeum': { cadenceMs: 760, attack: { kind: 'projectile', shapes: ['ember', 'ember', 'ember'], flightMs: 380, arc: 22, impact: 'embers' }, entrance: 'lift', exit: 'drop' },
}
const DEFAULT_STYLE = { cadenceMs: 800, attack: { kind: 'strike', lungePx: 8, impact: 'dust' }, exit: 'dust' }

const IMPACT = {
  sparks: { color: '#ffe08a', count: 14 }, splash: { color: '#5a9fc8', count: 18 }, dust: { color: '#c2aa80', count: 14 },
  embers: { color: '#ff9b4a', count: 12 }, chains: { color: '#8a8a90', count: 16 },
}

export const styleOf = theme => STYLES[theme?.name] || DEFAULT_STYLE

/** Called when a foe appears: resets the actor's fight state and plays the arena's entrance. */
export function beginFight(actor, enemy, now) {
  const style = styleOf(actor.theme())
  actor.fight = { style, lastAttackAt: now + 200, shots: 0, projectiles: [], lunge: null, strike: null }
  enemy.entrance = style.entrance || null
  if (style.entrance === 'splash') actor.burst(actor.enemyX() + 15, actor.y + 40, IMPACT.splash.color, 16)
}

/** Called when the foe starts dying: the arena's exit effect. */
export function endFight(actor, enemy, now, killed) {
  const style = actor.fight ? actor.fight.style : styleOf(actor.theme())
  enemy.exit = killed ? style.exit : 'dust'
  const spot = IMPACT[style.attack.impact] || IMPACT.dust
  if (killed && style.exit === 'wheel') actor.fight.projectiles.push({ shape: 'wheel', x0: actor.enemyX() + 6, y0: actor.y + 44, x1: actor.enemyX() + 110, y1: actor.y + 50, born: now, flightMs: 900, arc: 18, loose: true })
  if (killed && style.exit === 'chains') actor.burst(actor.enemyX() + 15, actor.y + 20, IMPACT.chains.color, 20)
  if (!killed) actor.burst(actor.enemyX() + 15, actor.y + 24, spot.color, 8)
}

/** Advances the warrior's attacks: launches the next one when due, moves projectiles, resolves impacts. */
export function stepFight(actor, now, dt) {
  const fight = actor.fight, enemy = actor.enemy
  if (!fight || !enemy || enemy.dying || actor.moving) return
  const { attack } = fight.style
  if (now - fight.lastAttackAt >= fight.style.cadenceMs && now - enemy.bornAt > ENTRANCE_MS) {
    fight.lastAttackAt = now
    fight.shots += 1
    if (attack.kind === 'projectile') launch(actor, fight, attack, now)
    if (attack.kind === 'lunge' || attack.lungePx) fight.lunge = { born: now, px: attack.px || attack.lungePx, hit: false }
    if (attack.kind === 'strike') fight.strike = { born: now }
  }
  for (const p of fight.projectiles) {
    if (p.loose) continue
    if (now - p.born >= p.flightMs) { p.done = true; impact(actor, attack, now) }
  }
  fight.projectiles = fight.projectiles.filter(p => !p.done && now - p.born < (p.loose ? p.flightMs : p.flightMs + 50))
  if (fight.lunge && !fight.lunge.hit && now - fight.lunge.born > LUNGE_MS / 2) { fight.lunge.hit = true; if (attack.kind === 'lunge') impact(actor, attack, now) }
  if (fight.lunge && now - fight.lunge.born > LUNGE_MS) fight.lunge = null
  if (fight.strike && now - fight.strike.born > STRIKE_MS) { impact(actor, attack, now); fight.strike = null }
  void dt
}

function launch(actor, fight, attack, now) {
  const shape = attack.shapes[fight.shots % attack.shapes.length]
  const from = { x: actor.x + 30, y: actor.y + 16 }
  const to = { x: actor.enemyX() + 12, y: actor.y + 26 }
  if (shape === 'chain') { fight.strike = { born: now, chain: true }; return }
  fight.projectiles.push({ shape, x0: from.x, y0: from.y, x1: to.x, y1: to.y, born: now, flightMs: attack.flightMs, arc: attack.arc })
}

function impact(actor, attack, now) {
  const spot = IMPACT[attack.impact] || IMPACT.dust
  const style = actor.fight.style
  const x = style.hitAt === 'wheel' ? actor.enemyX() + 4 : actor.enemyX() + 15
  const y = style.hitAt === 'wheel' ? actor.y + 46 : actor.y + 26
  actor.burst(x, y, spot.color, spot.count)
  actor.enemy.jolt = now
}

/** The warrior's horizontal offset while lunging (a ram, a shield bash, a thrust). */
export function lungeOffset(actor, now) {
  const lunge = actor.fight && actor.fight.lunge
  if (!lunge) return 0
  const t = Math.min(1, (now - lunge.born) / LUNGE_MS)
  return Math.round(Math.sin(t * Math.PI) * lunge.px)
}

/** Where a foe is drawn relative to its rest position: rising on the lift, flinching on a hit, sinking or dropping when beaten. */
export function enemyOffset(enemy, now) {
  let dy = 0
  const age = now - enemy.bornAt
  if (enemy.entrance === 'lift' && age < ENTRANCE_MS) dy += Math.round((1 - age / ENTRANCE_MS) * 44)
  if (enemy.jolt && now - enemy.jolt < 160) dy -= 3
  if (enemy.dying) {
    const t = Math.min(1, (now - enemy.dieAt) / EXIT_MS)
    if (enemy.exit === 'sink') dy += Math.round(t * 30)
    if (enemy.exit === 'drop') dy += Math.round(t * t * 60)
  }
  const dx = enemy.jolt && now - enemy.jolt < 160 ? 4 : 0
  return { dx, dy }
}

/** Draws the arena furniture of a fight that is not a particle: the lift platform, the trapdoor, the waterline. */
export function drawEnemyStage(ctx, actor, enemy, now) {
  const ex = actor.enemyX(), ground = actor.y + 44
  if (enemy.entrance === 'lift') {
    const open = !enemy.dying || now - enemy.dieAt < EXIT_MS
    ctx.fillStyle = '#2a2420'; ctx.fillRect(ex - 6, ground - 2, 46, 8)                       // the trapdoor opening
    if (open) { ctx.fillStyle = '#7a6148'; ctx.fillRect(ex - 2, ground + enemyOffset(enemy, now).dy - 1, 38, 4) }   // the lift platform
  }
}

/** Drawn over the foe: the water it sinks into, or the dark of the cellar it drops into, hiding what is below ground. */
export function drawEnemyCover(ctx, actor, enemy, now) {
  if (!enemy.dying || (enemy.exit !== 'sink' && enemy.exit !== 'drop')) return
  const ex = actor.enemyX(), ground = actor.y + 44
  ctx.fillStyle = enemy.exit === 'sink' ? '#2f6a8f' : '#2a2420'
  ctx.fillRect(ex - 8, ground + (enemy.exit === 'sink' ? -3 : 2), 52, 26)   // stays inside the pool / the cellar floor
  if (enemy.exit === 'sink') {
    const t = Math.min(1, (now - enemy.dieAt) / EXIT_MS)
    ctx.fillStyle = '#5a9fc8'; ctx.fillRect(ex - 8, ground - 4, 52, 3)
    for (let i = 0; i < 3; i++) ctx.fillRect(ex + 4 + i * 12, ground - 10 - Math.round(t * 24) - i * 5, 3, 3)   // bubbles
  }
}

/** Projectiles in flight and strike arcs; call after the foe is drawn. */
export function drawFightEffects(ctx, actor, now) {
  const fight = actor.fight
  if (!fight) return
  for (const p of fight.projectiles) {
    const t = Math.min(1, (now - p.born) / p.flightMs)
    const x = p.x0 + (p.x1 - p.x0) * t, y = p.y0 + (p.y1 - p.y0) * t - Math.sin(t * Math.PI) * p.arc
    const angle = Math.atan2((p.y1 - p.y0) - Math.cos(t * Math.PI) * p.arc * Math.PI, p.x1 - p.x0)
    drawProjectile(ctx, p.shape, x, y, angle, t, now)
  }
  if (fight.strike) drawStrike(ctx, actor, fight.strike, now)
}

function drawProjectile(ctx, shape, x, y, angle, t, now) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y))
  if (shape === 'arrow' || shape === 'bolt' || shape === 'javelin') {
    const len = shape === 'arrow' ? 16 : shape === 'bolt' ? 20 : 24, thick = shape === 'arrow' ? 2 : 3
    ctx.rotate(angle)
    ctx.fillStyle = shape === 'javelin' ? '#a08050' : '#5a4634'; ctx.fillRect(-len, -thick / 2, len, thick)
    ctx.fillStyle = '#c7ced6'; ctx.fillRect(-2, -2, 6, 4)                                       // the iron head
    if (shape === 'arrow') { ctx.fillStyle = '#e06060'; ctx.fillRect(-len, -3, 4, 6) }         // fletching
  } else if (shape === 'stone') {
    ctx.rotate(t * 6); ctx.fillStyle = '#8a8a8a'; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#a0a0a0'; ctx.fillRect(-2, -2, 3, 3)
  } else if (shape === 'knife') {
    ctx.rotate(t * 12); ctx.fillStyle = '#c7ced6'; ctx.fillRect(-7, -1, 10, 2); ctx.fillStyle = '#5a4634'; ctx.fillRect(3, -2, 5, 4)
  } else if (shape === 'ember') {
    const flick = (Math.floor(now / 60) % 2) ? '#ffd23f' : '#ff9b4a'
    ctx.fillStyle = flick; ctx.fillRect(-2, -2, 5, 5); ctx.globalAlpha = 0.5; ctx.fillRect(-7, -1, 4, 3); ctx.globalAlpha = 1
  } else if (shape === 'wheel') {
    ctx.rotate(t * 10); ctx.fillStyle = '#3f3f46'; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = '#c7ced6'; ctx.fillRect(-6, -1, 12, 2); ctx.fillRect(-1, -6, 2, 12)
  }
  ctx.restore()
}

function drawStrike(ctx, actor, strike, now) {
  const t = Math.min(1, (now - strike.born) / STRIKE_MS)
  const ex = actor.enemyX() + 15, ey = actor.y + 24
  if (strike.chain) {   // a chain whipped from the warrior's hand to the foe: a sagging line of links
    ctx.fillStyle = '#8a8a90'
    const x0 = actor.x + 30, y0 = actor.y + 18, reach = t < 0.5 ? t * 2 : 1
    for (let i = 0; i <= 10; i++) { const s = i / 10 * reach; const x = x0 + (ex - x0) * s, y = y0 + (ey - y0) * s + Math.sin(s * Math.PI) * 10; ctx.fillRect(Math.round(x), Math.round(y), 3, 3) }
    return
  }
  // a wooden-sword slash: a white crescent that opens then fades at the foe
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = SCALE; ctx.globalAlpha = 1 - t
  ctx.beginPath(); ctx.arc(ex, ey, 16 + t * 6, -Math.PI * 0.9, -Math.PI * 0.1 + t * 0.8); ctx.stroke()
  ctx.globalAlpha = 1
}
