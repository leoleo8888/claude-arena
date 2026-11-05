// Synthesized sound effects, off until the person turns them on (the choice is remembered per browser).
import { $ } from './util.js'

const STORAGE_KEY = 'yard.sound'
const audio = { ctx: null, on: false }

function beep(freq, duration, type = 'square', volume = 0.05, slide = 0) {
  if (!audio.on || !audio.ctx) return
  const ctx = audio.ctx, osc = ctx.createOscillator(), gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + duration)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

const arpeggio = (notes, duration, gapMs, volume) => notes.forEach((f, i) => setTimeout(() => beep(f, duration, 'triangle', volume), i * gapMs))

export const SFX = {
  swing: () => beep(260, 0.06, 'square', 0.025, -140),
  kill: () => { beep(660, 0.07, 'square', 0.04); setTimeout(() => beep(990, 0.1, 'square', 0.04), 70) },
  hurt: () => beep(150, 0.25, 'sawtooth', 0.05, -90),
  victory: () => arpeggio([523, 659, 784], 0.12, 90, 0.05),
  levelup: () => arpeggio([523, 659, 784, 1046, 1318], 0.16, 100, 0.06),
  join: () => { beep(392, 0.1, 'triangle', 0.05); setTimeout(() => beep(523, 0.16, 'triangle', 0.05), 100) },
  leave: () => { beep(523, 0.1, 'triangle', 0.05); setTimeout(() => beep(392, 0.16, 'triangle', 0.05), 100) },
}

export function setSound(on) {
  audio.on = on
  if (on && !audio.ctx) {
    try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { audio.on = false }
  }
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {})
  const button = $('#sound')
  button.textContent = audio.on ? '🔊 sound' : '🔇 sound'
  button.className = audio.on ? 'tg on' : 'tg'
  try { localStorage.setItem(STORAGE_KEY, audio.on ? '1' : '0') } catch { /* private window */ }
}

/** Wires the sound button. A remembered "on" still needs a gesture before the browser lets audio play: arm it on the first click. */
export function initSound() {
  $('#sound').addEventListener('click', () => setSound(!audio.on))
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      $('#sound').textContent = '🔈 click to enable'
      document.addEventListener('pointerdown', () => { if (!audio.on) setSound(true) }, { once: true })
    }
  } catch { /* storage blocked: stays off */ }
}
