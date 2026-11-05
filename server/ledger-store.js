// The ledger on disk: loaded once at start, saved a little after each change so a burst of events writes once.
import fs from 'node:fs'
import path from 'node:path'

const SAVE_DELAY_MS = 500

export class LedgerStore {
  constructor(file) {
    this.file = file
    this.timer = null
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }

  load() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')) } catch { return {} }
  }

  saveSoon(ledger) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => fs.writeFile(this.file, JSON.stringify(ledger, null, 2), () => {}), SAVE_DELAY_MS)
  }
}
