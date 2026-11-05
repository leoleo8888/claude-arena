// Packs the project for another machine: every tracked file (no node_modules, data, engine-written types), as
// <parent>/bot-monitor-<date>.zip. Uses `git archive` when the checkout has git; otherwise copies the same file
// list into a staging folder and zips it with PowerShell.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INCLUDE = ['server', 'web', 'mod', 'codex-link', 'scripts', 'package.json', 'package-lock.json', 'README.md', 'CLAUDE.md', 'eslint.config.js', '.gitignore', '.gitattributes']
const EXCLUDE_DIRS = new Set(['node_modules', 'types', 'data'])
const stamp = new Date().toISOString().slice(0, 10)
const out = path.resolve(ROOT, '..', `bot-monitor-${stamp}.zip`)

function hasGit() {
  try { execFileSync('git', ['-C', ROOT, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); return true } catch { return false }
}

function copyTree(from, to) {
  const stat = fs.statSync(from)
  if (stat.isDirectory()) {
    if (EXCLUDE_DIRS.has(path.basename(from))) return
    fs.mkdirSync(to, { recursive: true })
    for (const name of fs.readdirSync(from)) copyTree(path.join(from, name), path.join(to, name))
  } else fs.copyFileSync(from, to)
}

if (fs.existsSync(out)) fs.unlinkSync(out)
if (hasGit()) {
  execFileSync('git', ['-C', ROOT, 'archive', '--format=zip', '--prefix=bot-monitor/', '-o', out, 'HEAD'], { stdio: 'inherit' })
} else {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-monitor-pack-'))
  const top = path.join(staging, 'bot-monitor')
  for (const entry of INCLUDE) if (fs.existsSync(path.join(ROOT, entry))) copyTree(path.join(ROOT, entry), path.join(top, entry))
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -Path '${top}' -DestinationPath '${out}' -Force`], { stdio: 'inherit' })
  fs.rmSync(staging, { recursive: true, force: true })
}
const size = fs.statSync(out).size
console.log(`packed ${out} (${(size / 1024).toFixed(0)} KB)`)
console.log('On the new machine: unzip, install Node 20+, add the three env lines to ~/.claude/settings.json (see README "Setting up on a new machine").')
