// Entry point: wire the modules together in dependency order, then connect to the server.
import { initSound } from './audio.js'
import { applyTier, startTierWatch, forceShrink } from './tiers.js'
import { initPanels } from './panels.js'
import { initRemote, openRemote, closeRemote, sendRemote, focusTerminal } from './remote.js'
import { initInput } from './input.js'
import { canvas, startRenderLoop } from './render.js'
import { connect } from './stream.js'
import { warriors, actors, chats, liveCount } from './store.js'
import { slots, layout, activeSlots, board } from './layout.js'
import { THEMES } from './themes.js'
import { paintFloor } from './floor.js'

initSound()
applyTier(2)          // the yard opens with two posts and grows as sessions arrive
startTierWatch()
initPanels()
initRemote()
initInput(canvas)
startRenderLoop()
connect()

// A small read-mostly handle for the console and the headless test scripts; not used by the page itself.
window.yard = {
  canvas, warriors, actors, chats, slots, THEMES, board, activeSlots, liveCount,
  tier: () => layout.tier, forceShrink, openRemote, closeRemote, sendRemote, focusTerminal, paintFloor,
}
