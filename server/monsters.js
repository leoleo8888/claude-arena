// Which monster a tool call summons, and the XP curve.

export const MONSTERS = {
  // Claude Code tools
  Read: ['Slime', 1], Grep: ['Slime', 1], Glob: ['Slime', 1],
  Edit: ['Scribe', 2], Write: ['Scribe', 2], NotebookEdit: ['Scribe', 2],
  Bash: ['Goblin', 3], PowerShell: ['Goblin', 3],
  Agent: ['Summon', 2],
  WebFetch: ['Bat', 2], WebSearch: ['Bat', 2],
  // Codex CLI tools
  shell: ['Goblin', 3], local_shell: ['Goblin', 3], exec_command: ['Goblin', 3],
  apply_patch: ['Scribe', 2], write_file: ['Scribe', 2],
  read_file: ['Slime', 1], list_dir: ['Slime', 1], grep_files: ['Slime', 1], view_image: ['Slime', 1],
  web_search: ['Bat', 2],
  spawn_agent: ['Summon', 2],
}
const MCP_MONSTER = { name: 'Imp', hp: 2 }
const DEFAULT_MONSTER = { name: 'Wisp', hp: 1 }

export function monsterFor(tool) {
  const known = MONSTERS[tool]
  if (known) return { name: known[0], hp: known[1] }
  if (typeof tool === 'string' && tool.startsWith('mcp__')) return MCP_MONSTER
  return DEFAULT_MONSTER
}

export const levelOf = xp => Math.floor(Math.sqrt(xp / 10)) + 1
export const xpForLevel = level => level * level * 10
