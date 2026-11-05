// Short-lived messages drawn on the canvas: a toast at the top, and a note above one scoreboard.

export const notes = { toast: null, board: null }   // each { text, until } (board also { slot })

export const showToast = (text, ms = 2500) => { notes.toast = { text, until: performance.now() + ms } }
export const showBoardNote = (slot, text, ms) => { if (slot) notes.board = { slot, text, until: performance.now() + ms } }

export function expireNotes(now) {
  if (notes.toast && notes.toast.until <= now) notes.toast = null
  if (notes.board && notes.board.until <= now) notes.board = null
}
