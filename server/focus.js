// Brings a session's terminal window to the front by running focus.ps1 (Windows only).
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'focus.ps1')
const TIMEOUT_MS = 8000
const RESULTS = new Set(['focused', 'flashed', 'gone'])

/** Resolves 'focused' | 'flashed' (Windows let us only flash the taskbar button) | 'gone' | 'unsupported'. */
export function focusTerminal(terminal) {
  if (process.platform !== 'win32') return Promise.resolve('unsupported')
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Hwnd', String(terminal.hwnd || 0), '-ProcessId', String(terminal.pid || 0)]
  return new Promise(resolve => {
    execFile('powershell', args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout) => {
      const word = String(stdout || '').trim().split(/\s+/).pop()
      resolve(!err && RESULTS.has(word) ? word : 'gone')
    })
  })
}
