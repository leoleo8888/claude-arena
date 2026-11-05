// Mouse on the yard: hover for the tooltip, click a post for its remote, click its scoreboard for its terminal.
import { warriors } from './store.js'
import { layout, slotAt, isOnBoard, canvasPoint } from './layout.js'
import { openRemote, focusTerminal } from './remote.js'
import { $ } from './util.js'

const occupied = slot => slot && slot.used && warriors.has(slot.used)

export function initInput(canvas) {
  canvas.addEventListener('mousemove', ev => {
    const { x, y } = canvasPoint(canvas, ev)
    layout.hoverSlot = slotAt(x, y)
    layout.hoverBoard = !!layout.hoverSlot && isOnBoard(layout.hoverSlot, y)
    canvas.style.cursor = occupied(layout.hoverSlot) ? 'pointer' : 'default'
  })
  canvas.addEventListener('mouseleave', () => { layout.hoverSlot = null; layout.hoverBoard = false })
  canvas.addEventListener('click', ev => {
    const { x, y } = canvasPoint(canvas, ev)
    const slot = slotAt(x, y)
    if (!occupied(slot)) return
    if (isOnBoard(slot, y)) focusTerminal(slot.used)   // the scoreboard is the "go to terminal" button
    else openRemote(slot.used)
  })
  $('#rosterBody').addEventListener('click', ev => {
    const card = ev.target.closest('.w[data-session]')
    if (card) openRemote(card.dataset.session)
  })
}
