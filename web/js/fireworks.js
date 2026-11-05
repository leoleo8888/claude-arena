// Fireworks over the yard when a quest is done: rockets climb from the bottom to the middle of the screen and burst
// into sparks with tails and glow, under a banner naming the warrior. Loud on purpose: the point is to notice
// that a session finished. Four burst shapes are mixed: peony (full sphere), ring, willow (slow, drooping) and
// crackle (sparks that pop a second time).
import { COLOR, font } from './config.js'

const ROCKETS_PER_SHOW = 8
const ROCKET_GAP_MS = 140
const ROCKET_FLIGHT_MS = 600
const SPARK_LIFE_MS = 1600
const FLASH_MS = 160
const BANNER_MS = 3000
const TRAIL_POINTS = 5
const GRAVITY = 0.00016           // px per ms²
const PALETTES = [
  ['#ffd23f', '#ffb347', '#fff1a8', '#ffffff'], ['#7cf2a0', '#3ddc84', '#d8ffe8', '#ffffff'], ['#ff6b6b', '#ff9b4a', '#ffd1d1', '#fff1a8'],
  ['#8fd3ff', '#6aa6ff', '#e0f0ff', '#ffffff'], ['#c080ff', '#b48cff', '#efe0ff', '#ff9bd5'], ['#ff5fa2', '#ffd23f', '#8fd3ff', '#ffffff'],
]
const SHAPES = ['peony', 'ring', 'willow', 'crackle', 'peony']

const shows = []      // { label, startedAt, rockets, sparks, flashes }
const launched = new Set()
const rand = (lo, hi) => lo + Math.random() * (hi - lo)

export function launchFireworks(label, canvas, now = performance.now()) {
  const cx = canvas.width / 2, cy = canvas.height / 2
  const rockets = Array.from({ length: ROCKETS_PER_SHOW }, (_, i) => {
    const targetX = cx + (Math.random() - 0.5) * canvas.width * 0.6
    const targetY = cy - 40 + (Math.random() - 0.5) * 200
    return {
      startAt: now + i * ROCKET_GAP_MS, x0: targetX + (Math.random() - 0.5) * 160, y0: canvas.height - 6, x1: targetX, y1: targetY,
      colors: PALETTES[Math.floor(Math.random() * PALETTES.length)], shape: SHAPES[i % SHAPES.length], burst: false, trail: [],
    }
  })
  shows.push({ label, startedAt: now, rockets, sparks: [], flashes: [] })
}

function makeSpark(x, y, angle, speed, color, now, extra = {}) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now, color, size: 3 + Math.round(Math.random() * 2), trail: [], life: SPARK_LIFE_MS, drag: 0.0006, ...extra }
}

function burst(show, rocket, now) {
  const { x1: x, y1: y, colors, shape } = rocket
  show.flashes.push({ x, y, born: now, color: colors[0] })
  const count = shape === 'ring' ? 56 : 90
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.05, 0.05)
    const color = colors[i % colors.length]
    if (shape === 'ring') show.sparks.push(makeSpark(x, y, angle, 0.13, color, now, { size: 4 }))
    else if (shape === 'willow') show.sparks.push(makeSpark(x, y, angle, rand(0.03, 0.09), color, now, { life: SPARK_LIFE_MS * 1.5, drag: 0.0012, gravity: GRAVITY * 1.6 }))
    else if (shape === 'crackle') show.sparks.push(makeSpark(x, y, angle, rand(0.05, 0.14), color, now, { popAt: now + rand(350, 700) }))
    else show.sparks.push(makeSpark(x, y, angle, rand(0.04, 0.17), color, now))
  }
}

/** A crackle spark pops into a small cluster of fast, short-lived sparks. */
function pop(show, spark, now) {
  for (let i = 0; i < 6; i++) show.sparks.push(makeSpark(spark.x, spark.y, Math.random() * Math.PI * 2, rand(0.06, 0.12), '#ffffff', now, { size: 2, life: 420 }))
  spark.popAt = null
  spark.life = now - spark.born + 60
}

/** Advances and draws every running show; finished ones are dropped. */
export function drawFireworks(ctx, dt, now) {
  for (const show of shows) {
    stepRockets(ctx, show, now)
    stepSparks(ctx, show, dt, now)
    drawFlashes(ctx, show, now)
    drawBanner(ctx, show, now)
  }
  const done = s => now - s.startedAt > BANNER_MS && s.sparks.length === 0 && s.rockets.every(r => r.burst)
  for (let i = shows.length - 1; i >= 0; i--) if (done(shows[i])) shows.splice(i, 1)
}

function stepRockets(ctx, show, now) {
  for (const rocket of show.rockets) {
    if (rocket.burst || now < rocket.startAt) continue
    const t = Math.min(1, (now - rocket.startAt) / ROCKET_FLIGHT_MS), ease = 1 - (1 - t) * (1 - t)
    const x = rocket.x0 + (rocket.x1 - rocket.x0) * ease, y = rocket.y0 + (rocket.y1 - rocket.y0) * ease
    rocket.trail.unshift({ x, y }); rocket.trail.length = Math.min(rocket.trail.length, 8)
    rocket.trail.forEach((p, i) => { ctx.globalAlpha = 0.7 * (1 - i / 8); ctx.fillStyle = rocket.colors[1]; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 4, 6) })
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 3, 5, 7)
    if (t >= 1) { rocket.burst = true; burst(show, rocket, now) }
  }
}

function stepSparks(ctx, show, dt, now) {
  for (const spark of show.sparks) {
    spark.vy += (spark.gravity || GRAVITY) * dt
    spark.vx *= 1 - spark.drag * dt; spark.vy *= 1 - spark.drag * dt
    spark.x += spark.vx * dt; spark.y += spark.vy * dt
    if (spark.popAt && now >= spark.popAt) pop(show, spark, now)
    spark.trail.unshift({ x: spark.x, y: spark.y }); spark.trail.length = Math.min(spark.trail.length, TRAIL_POINTS)
    const fade = Math.max(0, 1 - (now - spark.born) / spark.life)
    const flicker = fade < 0.4 && Math.random() < 0.3 ? 0.3 : 1
    ctx.fillStyle = spark.color
    spark.trail.forEach((p, i) => { ctx.globalAlpha = fade * flicker * 0.5 * (1 - i / TRAIL_POINTS); ctx.fillRect(Math.round(p.x), Math.round(p.y), spark.size - 1, spark.size - 1) })
    ctx.globalAlpha = fade * 0.25; ctx.fillRect(Math.round(spark.x) - 2, Math.round(spark.y) - 2, spark.size + 4, spark.size + 4)   // glow
    ctx.globalAlpha = fade * flicker; ctx.fillRect(Math.round(spark.x), Math.round(spark.y), spark.size, spark.size)
  }
  ctx.globalAlpha = 1
  show.sparks = show.sparks.filter(s => now - s.born < s.life)
}

function drawFlashes(ctx, show, now) {
  for (const flash of show.flashes) {
    const t = (now - flash.born) / FLASH_MS
    if (t > 1) continue
    ctx.globalAlpha = 0.55 * (1 - t); ctx.fillStyle = flash.color
    ctx.beginPath(); ctx.arc(flash.x, flash.y, 18 + 60 * t, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.9 * (1 - t); ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(flash.x, flash.y, 6 + 20 * t, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  show.flashes = show.flashes.filter(f => now - f.born < FLASH_MS)
}

function drawBanner(ctx, show, now) {
  const age = now - show.startedAt
  if (age > BANNER_MS) return
  const alpha = age < 200 ? age / 200 : age > BANNER_MS - 500 ? (BANNER_MS - age) / 500 : 1
  const pulse = 1 + 0.03 * Math.sin(age / 120)
  const text = `✓ 퀘스트 완료 · ${show.label}`
  ctx.font = font(Math.round(26 * pulse), true); ctx.textAlign = 'center'
  const w = ctx.measureText(text).width + 60, x = ctx.canvas.width / 2, y = ctx.canvas.height / 2 - 70
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(10,12,16,.94)'; ctx.fillRect(x - w / 2, y - 30, w, 54)
  ctx.strokeStyle = COLOR.gold; ctx.lineWidth = 3; ctx.strokeRect(x - w / 2 + 1.5, y - 28.5, w - 3, 51)
  ctx.fillStyle = COLOR.gold; ctx.fillText(text, x, y + 9)
  ctx.globalAlpha = 1
}

export const fireworksRunning = () => shows.length
export const markLaunched = key => { if (launched.has(key)) return false; launched.add(key); setTimeout(() => launched.delete(key), 1500); return true }
