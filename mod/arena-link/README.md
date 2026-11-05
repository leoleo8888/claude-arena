# arena-link

Sends this Claude Code session to the Gladiator Yard (the `claude-arena` server next to this folder), where every
open session is one warrior. This is the source of record: register the folder itself, do not copy it.

Setup, in `~/.claude/settings.json` (read at session start):

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "<other mods>;<repo>\\mod\\arena-link",
    "GLADIATOR_YARD_DIR": "<repo>",
    "GLADIATOR_YARD_URL": "http://127.0.0.1:4747"
  }
}
```

`GLADIATOR_YARD_URL` defaults to the value above. Without `GLADIATOR_YARD_DIR` the mod still reports, but cannot
start the server when it is down.

What the yard sees, taken from the session's own events:

- `session.start` → the warrior walks in, named after the session title (`/rename`) or the working folder, with
  its XP from the yard's ledger; the mod also reports the terminal window it runs in (Windows)
- `turn.start` / `turn.complete` → a quest begins; an answer is a victory (+5 XP) and the answer text goes to the
  remote; an error is a fall
- `tool.call` → a fight: Slime (Read/Grep/Glob), Scribe (Edit/Write), Goblin (Bash), Summon (Agent), Bat (web),
  Imp (MCP), Wisp (others); a failing call hurts
- `agent.spawn` and its `turn.complete` → a squire joins and returns
- `session.measure` → HP (context left), MP (5-hour window), SP (7-day window)
- `session.end` → the warrior leaves; a `/clear` brings in a fresh one under the new session id
- every 2 s the yard's inbox is polled: a prompt typed on the page is submitted as the person's own words, a new
  name runs `/rename`

Transport: events are queued and POSTed in batches to `<url>/event` through `$.http.fetch`, with a heartbeat
every 5 seconds. When the server is unreachable the mod keeps the newest events, shows `⚔ yard offline` in the
status line, and starts `node server/server.js` detached from `GLADIATOR_YARD_DIR` (at most once per 20 seconds;
PowerShell on Windows, `nohup` elsewhere). After a reconnect it re-joins first, so a restarted server rebuilds its
roster by itself. `/arena` opens the yard in the browser.

Checks: `tsc -p .` (after the engine has laid `.claude-plugin/types/`, which it does on first load) and
`claude plugin validate .`.
