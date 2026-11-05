// The yard grows with the sessions at once and shrinks back only after a quiet spell.
import { SHRINK_MS, TIER_CHECK_MS } from './config.js'
import { actors, liveCount } from './store.js'
import { layout, slots, placeSlots, freeSlot, claimSlot, releaseSlot, relocationPath, tierFor } from './layout.js'
import { paintFloor } from './floor.js'
import { showToast } from './notes.js'

let shrinkSince = null

export function applyTier(tier) {
  if (tier === layout.tier) return
  const previous = layout.tier
  layout.tier = tier
  placeSlots(tier)
  paintFloor()
  shrinkSince = null
  for (const actor of actors.values()) {
    if (actor.leaving) continue
    // a warrior whose post is beyond the new edge takes a free one; everyone walks to where their post now stands
    if (slots.indexOf(actor.slot) >= tier) { releaseSlot(actor.slot, actor.session); actor.slot = freeSlot(); claimSlot(actor.slot, actor.session) }
    actor.path = relocationPath(actor, actor.slot)
  }
  if (previous > 0) showToast(tier > previous ? `⚒ 연습장 확장 · 자리 ${tier}개` : `연습장 축소 · 자리 ${tier}개`)
}

/** Grows right away for `count` sessions; a smaller tier is only noted, and applied by the watch after SHRINK_MS. */
export function requestTier(count) {
  const wanted = tierFor(count)
  if (wanted > layout.tier) applyTier(wanted)
  else if (wanted < layout.tier) { if (shrinkSince == null) shrinkSince = performance.now() }
  else shrinkSince = null
}

export function startTierWatch() {
  setInterval(() => {
    requestTier(liveCount())
    if (shrinkSince != null && performance.now() - shrinkSince > SHRINK_MS) applyTier(tierFor(liveCount()))
  }, TIER_CHECK_MS)
}

/** Test hook: pretend the quiet spell has passed, so the next watch tick may shrink the yard. */
export const forceShrink = () => { shrinkSince = performance.now() - SHRINK_MS - 1 }
