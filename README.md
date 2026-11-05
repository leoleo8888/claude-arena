# bot-monitor — Gladiator Yard

A local website where every Claude Code session is a warrior training in a 2D yard.
Sessions report events through a mod (`arena-link`, phase 2); this repo is the server and the page.

```
npm start            # http://127.0.0.1:4747
npm test             # unit tests for the arena state
npm run demo         # fill every free post with rehearsal warriors for 30 s (npm run demo -- 60000 for a minute)
```

## Setting up on a new machine

1. Install Node 20 or newer, clone this repository (say to `<repo>`), and run `npm start` once to see the yard at
   http://127.0.0.1:4747. `npm install` is only needed for `npm run lint`.
2. Register the mod with Claude Code in `~/.claude/settings.json` (it is read at session start):
   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "<repo>/mod/arena-link",
       "GLADIATOR_YARD_DIR": "<repo>",
       "GLADIATOR_YARD_URL": "http://127.0.0.1:4747"
     }
   }
   ```
   Several mods are separated by `;`. On Windows write the paths with `\\`. From the next session on, the mod
   starts the server by itself when it is down, so `npm start` is not needed again.
3. Codex, if used: `npm run codex:install`, then `/hooks` in Codex once to trust the hooks (see below).
4. Open http://127.0.0.1:4747. The ledger (`data/ledger.json`) is per machine.

Windows gets the whole experience. On macOS or Linux the yard, the remote and the session name work; finding
and raising the terminal window are Windows-only and are skipped quietly.

Rehearsal warriors join with `demo: true`: they fight and level like anyone else but are wiped from the ledger when they leave.

## Event protocol — `POST /event` (one object or an array)

| type | fields | effect |
|---|---|---|
| `join` | `session`, `cwd`, `model`, `title?`, `terminal?` | warrior enters; name = the session's title (`/rename`) or else the cwd basename; xp/kills loaded from the ledger by project |
| `title` | `session`, `title` | the session was renamed; `''` falls back to the project folder |
| `heartbeat` | `session` | keeps the warrior awake (rest after 20s silence, leave after 90s) |
| `vitals` | `session`, `hp`, `mp`, `sp` (0–100), `model?` | context / 5h / 7d bars |
| `turn.start` | `session`, `text` | quest begins, warrior walks |
| `turn.complete` | `session`, `reason` (`answer`/`error`/`refusal`/other) | victory +5xp, hurt, or idle |
| `fight` | `session`, `tool`, `phase` (`start`/`win`/`fail`/`blocked`), `target?` | monster by tool; win = kill + xp |
| `squire` | `session`, `phase` (`join`/`leave`), `id`, `description?` | subagent beside the warrior |
| `leave` | `session`, `reason?` | warrior exits; ledger keeps its xp |
| `chat` | `session`, `role` (`user`/`assistant`/`notice`), `text` — or `rows: [{role,text}]` with `reset` | a conversation row for the remote (memory only, 200 rows, 8 KB each) |
| `remote.ack` | `session`, `id`, `state` (`sent`/`failed`), `error?` | the mod reports what became of a prompt typed on the page |

## The remote — `POST /remote/<session>`, `GET /remote/<session>`, `GET /chat/<session>`

Click a post (or a roster card) and a modal shows that session's conversation with a prompt box.
The page `POST`s `{ text }` to `/remote/<session>`; the row appears at once as *전달 대기 중*. The session's
mod polls `GET /remote/<session>` every 2 s (`?wait=ms` long-polls up to 25 s), submits each prompt with
`$.prompt.submit({ text, asUser: true })` and acks it; when the turn starts, the mod's `chat` echo of the same
text flips the row to started instead of duplicating it, and the answer arrives as an `assistant` row on
`turn.complete`. `GET /chat/<session>` returns the rows; the SSE stream carries `chat` events.

Caveats: permission prompts still appear only in the terminal, so a remote prompt that needs an approval
waits there; the answer shows when the turn ends (no streaming); the server has no auth beyond listening on
127.0.0.1, so anything on this machine can drive a session through it.

Slash commands: a prompt starting with `/` is queued as a `command` item (`{ command, args }`); the mod runs it
with `$.command.run` and posts its printed output as a notice row. The mod sends the session's command list
(`commands` event) on join, `GET /commands/<session>` serves it, and typing `/` in the prompt box lists matching
commands (Tab takes the first). Commands that open a panel in the terminal come back with "no output".

Renaming: the ✎ button beside the name in the modal posts `{ title }` to `POST /rename/<session>`; the item
waits in the same inbox (`kind: "rename"`), the mod runs `/rename <title>` through `$.command.run` once the
session is idle, then reads the recorded title back and sends a `title` event.

## Codex sessions

Codex CLI sessions join the yard too, through Codex's hooks instead of a mod:

```
npm run codex:install               # writes the Gladiator Yard hooks into ~/.codex/hooks.json (backup kept)
npm run codex:install -- --print    # show the JSON without writing;  -- --remove  takes them out again
```

Then start `codex`, run `/hooks` once and trust the "Gladiator Yard" hooks (Codex skips untrusted hooks).
`codex-link/hook.mjs` receives each hook payload on stdin and posts the matching yard events: UserPromptSubmit →
quest + chat row, PreToolUse/PostToolUse → fight (shell = Goblin, apply_patch = Scribe, read_file = Slime, …),
Stop → quest done + the answer (`last_assistant_message`), Interrupt, SubagentStart/Stop → squires,
PermissionRequest → a notice, SessionEnd → leave. It never writes to stdout and always exits 0, so it cannot hold
Codex up. SessionStart spawns `codex-link/daemon.mjs`, a detached process that sends `join` (with the terminal
window, as the Claude mod does), heartbeats every 5 s, reads context usage from the session transcript for the HP
bar, and sends `leave` when the Codex process exits. A codex warrior wears a green plume and a `codex` badge; its
modal is read-only (no prompt or rename from the page: Codex has no way to inject input into a running session),
and `POST /remote` or `/rename` for it answers 409.

Trying it without an OpenAI account:

```
npm run codex:e2e
```

starts a stand-in model (`codex-link/mock-model.mjs`, a Chat Completions endpoint that answers with one shell echo
and then a short message), runs one `codex exec` turn against it and prints the codex warrior's journey as the arena
saw it (join, quest, fight, answer, leave). The run passes the mock provider and the yard hooks as `-c` overrides,
so it writes nothing under `~/.codex`; it uses `--dangerously-bypass-hook-trust` (hooks given on the command line
cannot be trusted in `/hooks`) and `--full-auto` (so the echo runs without a prompt), which is why it is a command
you run yourself. The mapping itself is unit-tested with the payload shapes from the official hooks documentation
(`npm test` runs `codex-link/codex-link.test.mjs`).

## Go to the terminal — `POST /focus/<session>`

The mod walks up from its own process to the first ancestor that owns a window (WindowsTerminal.exe, or a
classic console) and reports it with `join` / a `terminal` event (`{ pid, hwnd, name, title }`). Clicking a
post's scoreboard, or the 🖥 button in the remote modal, posts to `/focus/<session>` and the server runs
`server/focus.ps1`, which restores and raises that window (a background process may only flash the taskbar
button, so the script minimizes and restores the window when the first attempt is refused). The result is
`focused`, `flashed` or `gone`; a stale handle falls back to the process's current main window. Windows only;
Windows Terminal is brought forward as a whole, the tab stays whichever was active (there is no public API
to pick a tab), so one session per window works best.

Monsters by tool: Slime (Read/Grep/Glob, 1 xp), Scribe (Edit/Write/NotebookEdit, 2), Goblin (Bash/PowerShell, 3),
Summon (Agent, 2), Bat (WebFetch/WebSearch, 2), Imp (any `mcp__*` tool, 2), Wisp (everything else, 1).

Other endpoints: `GET /events` (SSE: `snapshot`, `join`, `update`, `levelup`, `leave`), `GET /state`, `GET /health`.
The ledger lives in `data/ledger.json`, keyed by lower-cased project path: `xp`, `kills`, `sessions`,
`minutes` (training time, credited as it passes so a crash loses nothing) and `lastSeen`.

## The six arenas

Each post is a different chapter of the Roman games, and the monsters of a tool call are dressed in that
arena's cast (hover a post for the source): every monster class has three or four possible foes per arena
(the Circus fields the four racing factions as charioteers, the sea battle crabs, octopuses and pirates, the
hunt lions, tigers and bears…), one drawn at random each time a foe appears. The Circus is a race, not a duel:
the warrior stands in a two-wheeled chariot behind a horse, the charioteers and sponsors ride their own, the
four-horse teams pull a cart, and the foe runs ahead facing the same way instead of squaring up.

Each arena fights its own way (`web/js/fightstyles.js`, one data entry per arena): the Circus rams the chariot
ahead and sparks fly off its wheel, which rolls away when it is beaten; the Naumachia shoots arrows, scorpio bolts
and catapult stones from the raft (no cannon in antiquity), splashes on impact and sinks the beaten foe; the Venatio
throws javelins with a thrust; the Ludus Capua throws kitchen knives and whips a chain; the Ludus Magnus slashes
with the wooden sword and shield-bashes in a cloud of dust; in the Hypogeum the foe rises through a trapdoor on
the lift, is pelted with embers from a torch, and drops back down when beaten. The pick is made when the
appearance line reaches the page, so the sprite, the roster and the battle log name the same foe. The yard opens with two posts and grows to four, then six, as
sessions arrive (one centered row, then 2x2, then 3x2; warriors already inside walk to their post's new place);
it shrinks back a tier after 45 s with fewer sessions. The six are dealt in a random order on every page
load, so which two open the yard and where each stands differ from visit to visit:

| Arena | When | Grounded in |
|---|---|---|
| Naumachia | 46 BC, 2 BC | Caesar's staged sea battle on the Campus Martius; Augustus' basin with 30 ships and ~3,000 fighters (Res Gestae 23) |
| Circus Maximus | 6th c. BC – AD 549 | Chariot racing, four factions, 250,000 seats per Pliny; Diocles' 35.8 million sesterces (CIL VI 10048) |
| Venatio | AD 80 | Morning beast hunts; 9,000 animals at the Colosseum's inaugural games (Cassius Dio) |
| Ludus Capua | 73 BC | Spartacus and ~70 others broke out of Lentulus Batiatus' school with kitchen knives (Plutarch, Crassus 8) |
| Ludus Magnus | AD 80s | Domitian's great gladiator school beside the Colosseum; training at the wooden post (palus) |
| Hypogeum | AD 80s | The Colosseum's two-level cellar: cages, capstan lifts and trapdoors |

## The page

Canvas 2D yard: warriors walk in through the gate along the corridor and the lane below their row,
fight the monster of each tool call beside their post (a call running over 8 s shows its elapsed time,
over 20 s the monster grows), drill while the session thinks between calls (jumps, jump rope, a handstand,
squats or pacing, picked at random every few seconds), flinch on a failed call, pose on a finished turn (and
fireworks climb to the middle of the yard under a "퀘스트 완료 · name" banner, so a finished session is noticed
from across the room), lie down for a nap after
10 s with nothing to do (the server stamps `idleSince` on every warrior), sit when the session's heartbeat
stops, and walk out on `leave`. Squires stand behind the warrior. A scoreboard above each post
crawls its warrior's newest battle-log line right to left (green for wins, red for failures); a vacated
post keeps the last line, dimmed, until the next warrior arrives. The side panels hold the roster
with elapsed session time, the battle log with one tab per connected session (plus All, where a departed
session's lines remain), and the hall of fame. The sound button turns on
synthesized effects (swing, kill, hurt, victory, level up, join, leave); the choice is remembered per browser.

## Layout

```
npm run lint         # ESLint (recommended rules); the only dev dependency
```

Server (`server/`, no runtime dependencies):

- `arena.js` — pure arena state: warriors, XP ledger by project, one handler per event type, the idle sweep
- `remote-desk.js` — each session's conversation rows and its inbox of prompts / renames typed on the page
- `monsters.js` — which monster a tool call summons; the XP curve
- `routes.js` — the HTTP API as a route table; `http.js` — body/JSON/static helpers; `live.js` — SSE browsers and long-polling mods
- `focus.js` + `focus.ps1` — bringing a session's terminal window to the front; `ledger-store.js` — the ledger file
- `server.js` — wiring and `listen`

Page (`web/`, ES modules, no build step):

- `config.js` numbers and colors · `util.js` pure helpers · `store.js` the single source of truth (warriors, actors, chats, feed)
- `layout.js` posts, scoreboards, routes and hit boxes · `tiers.js` growing and shrinking the yard · `floor.js` the painted background
- `sprites.js` glyph art · `themes.js` the six arenas · `actor.js` one warrior's walk and effects · `render.js` the frame loop
- `panels.js` roster, battle log, hall of fame · `remote.js` the modal · `input.js` mouse · `stream.js` the event stream · `main.js` wiring
- `window.yard` is a small debug handle for the console and headless tests; the page does not use it

Codex (`codex-link/`): `hook.mjs` the hook forwarder (pure `eventsFor` + a post) · `daemon.mjs` heartbeats, transcript vitals, leave · `shared.mjs` lock and post helpers · `scripts/codex-install.mjs` the hooks.json merge

Mod (`mod/arena-link/`): the Claude Code hooks module that reports a session; registered by path, never copied

Other: `scripts/demo.mjs` rehearsal warriors · `data/` the ledger (git-ignored)
