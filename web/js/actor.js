// One warrior on the canvas: its place, its walk, and the effects its server record triggers.
import { GATE, WALK_PX_PER_MS, ENEMY_DIE_MS } from './config.js'
import { freeSlot, claimSlot, releaseSlot, routeIn, routeOut } from './layout.js'
import { napping } from './store.js'
import { SFX } from './audio.js'
import { THEMES } from './themes.js'
import { currentCast } from './casting.js'
import { launchFireworks, markLaunched } from './fireworks.js'
import { beginFight, endFight, stepFight } from './fightstyles.js'
import { levelOf, $ } from './util.js'

const HURT_POSE_MS = 900, VICTORY_POSE_MS = 1800
const FX_MS = 1200, FX_BIG_MS = 2200
const ENEMY_OFFSET_X = 64
const RACE_ENEMY_OFFSET_X = 104   // in a race the foe runs ahead, past the warrior's horse
// While the session thinks (training, no tool call) the warrior drills: one of these for 2.5–5 s, then another.
export const DRILL_POSES = ['jump', 'rope', 'handstand', 'squat', 'walk']
const DRILL_MIN_MS = 2500, DRILL_MAX_MS = 5000

const snapshotOf = warrior => ({ kills: warrior.kills, xp: warrior.xp, pose: warrior.pose, enemy: warrior.enemy, level: levelOf(warrior.xp), logLen: warrior.log.length })

export class Actor {
  constructor(warrior) {
    this.session = warrior.session
    this.slot = freeSlot(); claimSlot(this.slot, this.session)
    this.x = GATE.x; this.y = GATE.y
    this.path = routeIn(this.slot)
    this.leaving = false; this.dead = false; this.moving = false; this.facingLeft = false
    this.poseUntil = 0; this.pose = 'walk'
    this.enemy = null       // { name, tool, target, bornAt, dying, dieAt }
    this.fx = []            // floating texts { text, x, y, color, born, big? }
    this.particles = []
    this.prev = snapshotOf(warrior)
    this.bob = Math.random() * 100
    this.drill = null; this.drillUntil = 0
    this.dim = 0            // 0 lit … 1 dark, eased by the render loop while the warrior naps or rests
  }

  theme() { return THEMES[this.slot.theme] }
  mounted() { return this.theme().race === true }

  /** The drill to show right now, switching to a different random one when the current one has run its time. */
  currentDrill(now) {
    if (this.mounted()) return 'walk'   // no handstands on a moving chariot: the reins keep the hands busy
    if (now >= this.drillUntil) {
      const others = DRILL_POSES.filter(pose => pose !== this.drill)
      this.drill = others[Math.floor(Math.random() * others.length)]
      this.drillUntil = now + DRILL_MIN_MS + Math.random() * (DRILL_MAX_MS - DRILL_MIN_MS)
    }
    return this.drill
  }

  /** Reacts to the warrior's latest server record: enemies appearing and dying, xp, poses, level ups. */
  update(warrior, now) {
    const prev = this.prev
    if (warrior.enemy && (!this.enemy || this.enemy.tool !== warrior.enemy.tool || this.enemy.target !== warrior.enemy.target || this.enemy.dying)) {
      // the foe this appearance drew (the log line that announced it made the pick)
      const skin = currentCast(this.session, this.theme(), warrior.enemy.name)
      this.enemy = { ...warrior.enemy, skin, bornAt: now, dying: false }
      beginFight(this, this.enemy, now)
      SFX.swing()
    }
    if (!warrior.enemy && this.enemy && !this.enemy.dying) {
      this.enemy.dying = true; this.enemy.dieAt = now
      const killed = warrior.kills > prev.kills
      endFight(this, this.enemy, now, killed)
      if (killed) { this.burst(this.enemyX(), this.y + 10, this.enemy.skin.c); SFX.kill() }
    }
    if (warrior.xp > prev.xp) this.float(`+${warrior.xp - prev.xp}xp`, 20, -10, '#7cf2a0', now)
    if (warrior.pose !== prev.pose || (warrior.pose === 'hurt' && warrior.log.length !== prev.logLen)) {
      if (warrior.pose === 'hurt') { this.hold('hurt', now + HURT_POSE_MS); this.float('OUCH', 10, -6, '#ff4d4d', now); SFX.hurt() }
      else if (warrior.pose === 'victory') {
        this.hold('victory', now + VICTORY_POSE_MS); SFX.victory()
        // a quest is done: fireworks over the yard so the person notices even from across the room
        if (markLaunched(this.session)) launchFireworks(warrior.name, $('#yard'), now)
      }
    }
    const level = levelOf(warrior.xp)
    if (level > prev.level) { this.float(`LEVEL UP! Lv${level}`, -20, -28, '#ffd23f', now, true); this.burst(this.x + 18, this.y + 20, '#ffd23f', 40); SFX.levelup() }
    this.prev = snapshotOf(warrior)
  }

  hold(pose, until) { this.pose = pose; this.poseUntil = until }
  float(text, dx, dy, color, now, big = false) { this.fx.push({ text, x: this.x + dx, y: this.y + dy, color, born: now, big }) }
  enemyX() { return this.x + (this.mounted() ? RACE_ENEMY_OFFSET_X : ENEMY_OFFSET_X) }
  burst(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (Math.random() - .5) * 4, vy: -Math.random() * 4 - 1, color, born: performance.now(), life: 500 + Math.random() * 400 })
  }

  /** Walks out: from wherever the walk-in got to, rejoin the route at the nearest point and follow it back. */
  leave() {
    this.leaving = true; this.enemy = null
    releaseSlot(this.slot, this.session)
    const out = routeOut(this.slot)
    let nearest = 0, nearestDist = Infinity
    out.forEach((pt, i) => { const d = Math.hypot(pt.x - this.x, pt.y - this.y); if (d < nearestDist) { nearestDist = d; nearest = i } })
    this.path = out.slice(nearest)
  }

  /** Advances the walk, particles, floating texts and a dying enemy by one frame. */
  step(dt, now) {
    const goal = this.path[0]
    if (goal) {
      const dx = goal.x - this.x, dy = goal.y - this.y, dist = Math.hypot(dx, dy)
      const stride = WALK_PX_PER_MS * dt
      if (dist <= stride) { this.x = goal.x; this.y = goal.y; this.path.shift() }
      else { this.x += dx / dist * stride; this.y += dy / dist * stride }
      if (Math.abs(dx) > 2) this.facingLeft = dx < 0
      this.moving = true
    } else {
      this.moving = false; this.facingLeft = false
      if (this.leaving) this.dead = true
    }
    stepFight(this, now, dt)
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15 }
    this.particles = this.particles.filter(p => now - p.born < p.life)
    this.fx = this.fx.filter(f => now - f.born < (f.big ? FX_BIG_MS : FX_MS))
    if (this.enemy && this.enemy.dying && now - this.enemy.dieAt > ENEMY_DIE_MS) { this.enemy = null; this.fight = null }
  }

  currentPose(warrior, now) {
    if (this.moving) return 'walk'
    if (now < this.poseUntil) return this.pose
    if (!warrior) return 'idle'
    if (warrior.status === 'resting' || napping(warrior)) return 'rest'
    if (this.enemy && !this.enemy.dying) return 'attack'
    if (warrior.status === 'training') return this.currentDrill(now)
    this.drillUntil = 0   // the next thinking spell starts a fresh drill
    return 'idle'
  }
}

export const fxLifetime = fx => (fx.big ? FX_BIG_MS : FX_MS)
