// Pixel sprites as strings of glyphs; a legend maps each glyph to a color. '.' and ' ' are transparent.

export const HERO_PALETTE = { h: '#c7ced6', d: '#8a929c', k: '#f2c9a0', e: '#1b1b1f', s: '#ffd23f', b: '#3f4049', r: '#d9484a', x: '#ff4d4d', w: '#ffffff', p: '#a0763c' }
// A codex session wears a green plume so the two CLIs tell apart at a glance.
export const PALETTE_BY_AGENT = { claude: HERO_PALETTE, codex: { ...HERO_PALETTE, r: '#3ddc84' } }
export const HERO = {
  idle: [
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '..dhhhhhd...', '.khhhhhhhk..', '.k.hhhhh.k..', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
    ['............', '....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '.kdhhhhhdk..', '.khhhhhhhk..', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
  ],
  walk: [
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '..dhhhhhd...', '.khhhhhhhk..', '.k.hhhhh.k..', '...hhhhh....', '..hh..hh....', '.hh....hh...', '.bb....bb...', 'bbb....bbb..'],
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '..dhhhhhd...', '.khhhhhhhk..', '.k.hhhhh.k..', '...hhhhh....', '...hhhh.....', '...hhhh.....', '...bbbb.....', '..bbbbbb....'],
  ],
  attack: [
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '..dhhhhhd.s.', '.khhhhhhks..', '...hhhhhks..', '...hhhhh..s.', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '..dhhhhhd...', '.khhhhhhhksss', '...hhhhh.k..', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
  ],
  hurt: [
    ['....rrr.....', '...xxxxx....', '..xxxxxxx...', '..xkkkkkx...', '..xkxkxkx...', '...kkkkk....', 'k.dxxxxxd.k.', '.kxxxxxxxk..', '...xxxxx....', '...xxxxx....', '...xx.xx....', '...xx.xx....', '...bb.bb....', '..bbb.bbb...'],
  ],
  victory: [
    ['k...rrr...k.', 'k..hhhhh..k.', 'k.hhhhhhh.k.', 'k.hkkkkkh.k.', 'k.hkekekh.k.', 'kk.kkkkk.kk.', '.kdhhhhhdk..', '..hhhhhhh...', '...hhhhh....', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', 'k.hkekekh.k.', 'k..kkkkk..k.', 'kkdhhhhhdkk.', '..hhhhhhh...', '...hhhhh....', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
  ],
  rest: [
    ['............', '............', '............', '....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hk-k-kh...', '...kkkkk....', '.kdhhhhhdk..', 'bbhhhhhhhbb.', 'bbhhhhhhhbb.', '............', '............'],
  ],
}
export const SQUIRE = [
  ['..ppp...', '.ppppp..', '.pkkkp..', '.pkekp..', '..kkk...', '.ppppp..', 'kppppk..', '.ppppp..', '.pp.pp..', '.bb.bb..'],
  ['........', '..ppp...', '.ppppp..', '.pkkkp..', '.pkekp..', '..kkk...', 'kpppppk.', '.ppppp..', '.pp.pp..', '.bb.bb..'],
]
export const SQUIRE_PALETTE = { p: '#b48cff', k: '#f2c9a0', e: '#1b1b1f', b: '#3f4049' }

// Enemies: name -> { c: color, frames }  (c body, e eye, w white, b dark, f flame)
export const ENEMIES = {
  Slime:  { c: '#5fd35f', frames: [['...cccc...', '..cccccc..', '.cceccecc.', '.cccccccc.', '.cccccccc.', '..cccccc..'], ['..........', '..cccccc..', '.cceccecc.', 'cccccccccc', 'cccccccccc', '.cccccccc.']] },
  Scribe: { c: '#6aa6ff', frames: [['...cccc...', '..cccccc..', '..ceeeec..', '..cccccc..', '.wcccccc..', '.wccccccw.', '..cccccc..', '..cc..cc..'], ['...cccc...', '..cccccc..', '..ceeeec..', '..cccccc..', '..ccccccw.', '.wcccccc..', '..cccccc..', '..cc..cc..']] },
  Goblin: { c: '#e06060', frames: [['.c......c.', '.cc....cc.', '..cccccc..', '..cecec...', '..cccccc..', '...cccc...', '..cccccc..', '.c.cccc.c.', '...cc.cc..', '...bb.bb..'], ['.c......c.', '.cc....cc.', '..cccccc..', '..cecec...', '..cccccc..', '...cccc...', '.ccccccc..', 'c..cccc...', '...cc.cc..', '...bb.bb..']] },
  Summon: { c: '#c080ff', frames: [['....cc....', '...cccc...', '..cceecc..', '..cccccc..', '.cccccccc.', '..c.cc.c..', '...c..c...', '..c....c..'], ['....cc....', '...cccc...', '..cceecc..', '..cccccc..', '.cccccccc.', '.c..cc..c.', '..c....c..', '...c..c...']] },
  Bat:    { c: '#8fb3c7', frames: [['c........c', 'cc..cc..cc', 'ccc.ee.ccc', '.cccccccc.', '..cccccc..', '...c..c...'], ['..........', '....cc....', 'c..ceec..c', 'cccccccccc', '.cc.cc.cc.', '...c..c...']] },
  Imp:    { c: '#ff9b4a', frames: [['.f......f.', '.cc....cc.', '..cccccc..', '..ceccec..', '..cccccc..', '...cwwc...', '..cccccc..', '.c.cccc.c.', '...cc.cc..', '....c..c..'], ['.f......f.', '.cc....cc.', '..cccccc..', '..ceccec..', '..cccccc..', '...cccc...', '.ccccccc..', 'c..cccc.c.', '...cc.cc..', '...c..c...']] },
  Wisp:   { c: '#9aa0a6', frames: [['...cc.....', '..cccc....', '.cceecc...', '.cccccc...', '..cccc....', '...cc.....', '....c.....'], ['....cc....', '...cccc...', '..cceecc..', '..cccccc..', '...cccc...', '....cc....', '.....c....']] },
}
// Extra body shapes the arena themes dress the server's monster classes in (c body, e eye, w white, b dark, f flame/gold, g gold).
export const SHAPES = {
  blob: ENEMIES.Slime.frames, hood: ENEMIES.Scribe.frames, goblin: ENEMIES.Goblin.frames, float: ENEMIES.Summon.frames,
  wing: ENEMIES.Bat.frames, imp: ENEMIES.Imp.frames, wisp: ENEMIES.Wisp.frames,
  beast: [['..cc......cc', '.cccccccccc.', 'cceccccccccc', 'cccccccccccc', '.cccccccccc.', '..cc.cc.cc..', '..bb.bb.bb..'], ['..cc......cc', '.cccccccccc.', 'cceccccccccc', 'cccccccccccc', '.cccccccccc.', '.cc..cc..cc.', '.bb..bb..bb.']],
  bigbeast: [['...cc.......', '..cccccccc..', '.cceccccccc.', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.', '.cc..cc..cc.', '.bb..bb..bb.', 'wc..........'], ['...cc.......', '..cccccccc..', '.cceccccccc.', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.', '..cc.cc.cc..', '..bb.bb.bb..', 'wc..........']],
  warrior: [['...cccc...', '..cccccc..', '..ceeeec..', '...cccc...', '.cccccccc.', 'cccccccc.s', '.cccccc.s.', '..cccc....', '..cc.cc...', '..bb.bb...'], ['...cccc...', '..cccccc..', '..ceeeec..', '...cccc...', '.cccccccc.', 'cccccccc..', '.cccccc.ss', '..cccc....', '..cc.cc...', '..bb.bb...']],
  crowned: [['..g.g.g...', '..gggggg..', '..cccccc..', '..ceeeec..', '...cccc...', '.cccccccc.', 'cccccccc.s', '.cccccc.s.', '..cccc....', '..cc.cc...', '..bb.bb...'], ['..g.g.g...', '..gggggg..', '..cccccc..', '..ceeeec..', '...cccc...', '.cccccccc.', 'cccccccc..', '.cccccc.ss', '..cccc....', '..cc.cc...', '..bb.bb...']],
  ship: [['....w.....', '....wwww..', '....w.....', '....w.....', '.ccccccccc', 'cccccccccc', '.cccccccc.', '..cccccc..'], ['....w.....', '....wwww..', '....w.....', '....w.....', '.ccccccccc', 'cccccccccc', '.cccccccc.', '..cccccc..']],
  serpent: [['........cc', '.......cecc', '..ccc..ccc.', '.ccccc.cc..', 'cc...ccc...', 'c.........'], ['........cc', '.......cecc', '...cc..ccc.', '..cccc.cc..', '.cc..ccc...', 'cc........']],
}
/** The legend an enemy of body color c is drawn with. */
export const enemyPalette = c => ({ c, e: '#1b1b1f', w: '#fff', b: '#3f4049', f: '#ffe08a', g: '#ffd23f', s: '#c7ced6' })

export function drawSprite(ctx, rows, legend, x, y, scale, flip, alpha) {
  const w = Math.max(...rows.map(r => r.length))
  if (alpha !== undefined) ctx.globalAlpha = alpha
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const g = row[c]
      if (g === '.' || g === ' ') continue
      const col = legend[g]
      if (!col) continue
      ctx.fillStyle = col
      const px = flip ? x + (w - 1 - c) * scale : x + c * scale
      ctx.fillRect(px, y + r * scale, scale, scale)
    }
  }
  ctx.globalAlpha = 1
}

// Drills a warrior runs through while its session thinks (training with no tool call): picked at random by the actor.
// Glyph p is the rope. HERO_LIFT raises a frame off the ground (px) for the hops.
export const DRILLS = {
  jump: [
    ['............', '............', '....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '.kdhhhhhdk..', '.khhhhhhhk..', '...hhhhh....', '..hhh.hhh...', '.bbb...bbb..', '............'],
    ['k...rrr...k.', 'k..hhhhh..k.', 'k.hhhhhhh.k.', 'k.hkkkkkh.k.', '.khkekekhk..', '..kkkkkkk...', '..dhhhhhd...', '...hhhhh....', '...hhhhh....', '...hhhhh....', '..hhh.hhh...', '..bb...bb...', '............', '............'],
  ],
  rope: [
    ['...ppppp....', '..p.rrr.p...', '.p.hhhhh.p..', '.phhhhhhhp..', '.phkkkkkhp..', '.phkekekhp..', '.p.kkkkk.p..', '.kdhhhhhdk..', '..hhhhhhh...', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', '.kdhhhhhdk..', '..hhhhhhh...', '...hhhhh....', '...hh.hh....', '..hhh.hhh...', '..bb...bb...', '.p.......p..', '..ppppppp...'],
  ],
  handstand: [
    ['...bb..bb...', '...hh..hh...', '...hh..hh...', '....hhhh....', '....hhhh....', '...dhhhhd...', '..k.hhhh.k..', '..k.kkkk.k..', '..khkekekhk.', '..khkkkkkhk.', '..khhhhhhhk.', '..k.hhhhh.k.', '..k..rrr..k.', '.kk.......kk'],
    ['.bb......bb.', '..hh....hh..', '...hh..hh...', '....hhhh....', '....hhhh....', '...dhhhhd...', '..k.hhhh.k..', '..k.kkkk.k..', '..khkekekhk.', '..khkkkkkhk.', '..khhhhhhhk.', '..k.hhhhh.k.', '..k..rrr..k.', '.kk.......kk'],
  ],
  squat: [
    ['....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', '...kkkkk....', 'kkdhhhhhdkk.', '..hhhhhhh...', '...hhhhh....', '...hhhhh....', '...hh.hh....', '...hh.hh....', '...bb.bb....', '..bbb.bbb...'],
    ['............', '............', '....rrr.....', '...hhhhh....', '..hhhhhhh...', '..hkkkkkh...', '..hkekekh...', 'kk.kkkkk.kk.', '..dhhhhhd...', '..hhhhhhh...', '...hhhhh....', '.hhhh.hhhh..', '.bbb...bbb..', '............'],
  ],
}
export const HERO_LIFT = { jump: [0, -14], rope: [0, -6] }

// Two more bodies for the casts: a horse (circus foals, chariot teams) and a crab (the sea battle).
SHAPES.horse = [
  ['.........cc.', '........cccc', '.cccccccccc.', 'cccccccccce.', 'cccccccccc..', '.cc..cc.....', '.cc..cc.....', '.bb..bb.....'],
  ['.........cc.', '........cccc', '.cccccccccc.', 'cccccccccce.', 'cccccccccc..', '.cc...cc....', 'cc.....cc...', 'bb.....bb...'],
]
SHAPES.crab = [
  ['c.........c', 'cc.......cc', '.c.ccccc.c.', '..ccecccec.', '.ccccccccc.', '..c.c.c.c..', '.c.c...c.c.'],
  ['.c.......c.', 'cc.......cc', '.c.ccccc.c.', '..ccecccec.', '.ccccccccc.', '.c.c...c.c.', 'c.c.....c.c'],
]
SHAPES.fish = [
  ['......cc...', '..cccccccc.', 'c.ccceccccc', 'cccccccccc.', 'c.cccccccc.', '..cccccccc.', '......cc...'],
  ['......cc...', '..cccccccc.', '.cccceccccc', 'cccccccccc.', '.ccccccccc.', '..cccccccc.', '.....cc....'],
]

// A two-wheeled racing chariot seen from the side, facing right: the cart the rider stands in (its floor is row 4,
// the wheel hangs below) and a horse in front. Glyphs: w wood, g gold trim, d axle, k wheel, r spokes.
export const CHARIOT = [
  ['.....wwwwwww..', '....wgggggggw.', '....wwwwwwwwww', '....wwwwwwwwww', '..ddddddddddd.', '..kkkk........', '.kkrrkk.......', '.kkrrkk.......', '..kkkk........'],
  ['.....wwwwwww..', '....wgggggggw.', '....wwwwwwwwww', '....wwwwwwwwww', '..ddddddddddd.', '..kkkk........', '.krkkrk.......', '.krkkrk.......', '..kkkk........'],
]
export const CHARIOT_PALETTE = { w: '#8a6a48', g: '#ffd23f', d: '#5a4634', k: '#3f3f46', r: '#c7ced6' }
export const CHARIOT_BOARD_ROWS = 4   // rows drawn again over the rider's legs, so the rider stands inside the cart
export const HORSE_PALETTE = c => ({ c, e: '#1b1b1f', b: '#3f4049' })
