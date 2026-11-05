// The six arenas: each a documented chapter of the Roman games, with its own floor painting and its own cast.
// The server fights seven monster classes (by tool type: Slime weak, Scribe editing, Goblin shell, Summon agents,
// Bat the web, Imp MCP tools, Wisp the rest); each arena dresses every class in several possible foes, and
// casting.js picks one at random each time a foe appears.
import { ENEMIES } from './sprites.js'
import { actors } from './store.js'
import { shuffle } from './util.js'

const skin = (name, c, shape, mount = null) => ({ name, c, shape, mount })   // mount: 'chariot' (rider in a cart behind a horse) | 'cart' (a horse pulling a cart)

function ring(f, s, color) { f.fillStyle = color; f.beginPath(); f.ellipse(s.x + 40, s.y + 44, 84, 26, 0, 0, Math.PI * 2); f.fill() }
function post(f, s) { ring(f, s, '#ad9468'); f.fillStyle = '#5a4634'; f.fillRect(s.x + 108, s.y - 10, 8, 58); f.fillStyle = '#7a6148'; f.fillRect(s.x + 100, s.y - 14, 24, 8) }
function tree(f, x, y) { f.fillStyle = '#5a4634'; f.fillRect(x, y + 10, 6, 36); f.fillStyle = '#4a7a3a'; f.beginPath(); f.arc(x + 3, y + 6, 16, 0, Math.PI * 2); f.fill(); f.fillStyle = '#5f9a4a'; f.beginPath(); f.arc(x - 3, y, 9, 0, Math.PI * 2); f.fill() }
function oval(f, s, color, rx = 92, ry = 30) { f.fillStyle = color; f.beginPath(); f.ellipse(s.x + 40, s.y + 44, rx, ry, 0, 0, Math.PI * 2); f.fill() }

export const ALL_THEMES = [
  { name: 'Ludus Magnus', era: 'AD 80s, Rome', fact: '도미티아누스가 콜로세움 옆에 세운 최대 검투사 양성소. 지하 통로로 경기장과 연결됐고, 훈련생은 목검(rudis)으로 나무 기둥(palus)을 치며 단련했다.',
    enemies: {
      Slime: [skin('Palus', '#8a6a48', 'blob'), skin('Saccus', '#b89f76', 'blob'), skin('Scutum', '#7d6b57', 'blob')],
      Scribe: [skin('Doctor', '#6aa6ff', 'hood'), skin('Magister', '#5f8fd6', 'hood'), skin('Medicus', '#8fb3ff', 'hood')],
      Goblin: [skin('Tiro', '#e06060', 'warrior'), skin('Secutor', '#c7ced6', 'warrior'), skin('Murmillo', '#d9a040', 'warrior'), skin('Hoplomachus', '#4a8a4a', 'warrior')],
      Summon: [skin('Lanista', '#c080ff', 'crowned'), skin('Editor', '#a060e0', 'crowned'), skin('Primus Palus', '#ffd23f', 'warrior')],
      Bat: [skin('Gull', '#8fb3c7', 'wing'), skin('Columba', '#dfe7ee', 'wing'), skin('Passer', '#a08060', 'wing')],
      Imp: [skin('Veteranus', '#ff9b4a', 'warrior'), skin('Rudiarius', '#e0a060', 'warrior'), skin('Provocator', '#ff7a4a', 'warrior')],
      Wisp: [skin('Dust', '#9aa0a6', 'wisp'), skin('Pulvis', '#c8b088', 'wisp'), skin('Sudor', '#b8c4cc', 'wisp')],
    },
    paint(f, s) { post(f, s); f.fillStyle = '#5a4634'; f.fillRect(s.x - 40, s.y - 8, 6, 40); f.fillRect(s.x - 20, s.y - 8, 6, 40); f.fillRect(s.x - 44, s.y - 12, 34, 5); f.fillStyle = '#c7ced6'; f.fillRect(s.x - 36, s.y - 4, 3, 26); f.fillRect(s.x - 28, s.y - 4, 3, 26) } },
  { name: 'Naumachia', era: '46 BC · 2 BC', fact: '카이사르는 46 BC 마르스 평원에 못을 파 모의 해전을 열었고, 아우구스투스는 2 BC 티베르 강 건너에 상설 해전장을 지어 함선 30척, 전투원 약 3,000명을 투입했다(Res Gestae 23).',
    enemies: {
      Slime: [skin('Medusa', '#5fd3c8', 'blob'), skin('Polypus', '#c060a0', 'blob'), skin('Cancer', '#e07050', 'crab'), skin('Piscis', '#6ab0d0', 'fish')],
      Scribe: [skin('Triton', '#6aa6ff', 'hood'), skin('Nauta', '#5f8fd6', 'hood'), skin('Gubernator', '#8fb3ff', 'hood')],
      Goblin: [skin('Pirata', '#e06060', 'warrior'), skin('Classiarius', '#c04040', 'warrior'), skin('Praedo', '#a04060', 'warrior')],
      Summon: [skin('Trireme', '#c080ff', 'ship'), skin('Liburna', '#a060e0', 'ship'), skin('Quinqueremis', '#8040c0', 'ship')],
      Bat: [skin('Larus', '#dfe7ee', 'wing'), skin('Mergus', '#8fb3c7', 'wing'), skin('Pelecanus', '#c8d8e0', 'wing')],
      Imp: [skin('Siren', '#ff9b4a', 'imp'), skin('Nereis', '#ffb070', 'imp'), skin('Scylla', '#e07040', 'serpent')],
      Wisp: [skin('Nebula', '#b8c4cc', 'wisp'), skin('Spuma', '#e8f0f4', 'wisp'), skin('Aura', '#9ab8c8', 'wisp')],
    },
    paint(f, s) { oval(f, s, '#2f6a8f'); f.fillStyle = '#5a9fc8'; for (let i = 0; i < 5; i++) f.fillRect(s.x - 30 + i * 34, s.y + 30 + (i % 2) * 14, 18, 2); f.fillStyle = '#7a5a3a'; f.fillRect(s.x - 6, s.y + 36, 50, 10); f.fillStyle = '#5a4634'; f.fillRect(s.x - 2, s.y + 46, 42, 3); f.fillRect(s.x + 100, s.y + 12, 8, 36); f.fillStyle = '#8a6a48'; f.fillRect(s.x + 92, s.y + 10, 24, 4) } },
  { name: 'Venatio', era: 'AD 80, Colosseum', fact: '오전 프로그램이던 맹수 사냥. 티투스의 콜로세움 개장 100일 경기에서 사자, 표범, 곰, 코끼리 등 9,000마리가 죽었다고 카시우스 디오는 전한다.',
    enemies: {
      Slime: [skin('Aper', '#7a5a3a', 'beast'), skin('Capra', '#c8b088', 'beast'), skin('Cervus', '#a08050', 'beast')],
      Scribe: [skin('Pardus', '#e0b040', 'beast'), skin('Lynx', '#d0a060', 'beast'), skin('Lupus', '#8a8a8a', 'beast')],
      Goblin: [skin('Leo', '#d9a040', 'bigbeast'), skin('Tigris', '#e08030', 'bigbeast'), skin('Ursus', '#6b4a2a', 'bigbeast'), skin('Leaena', '#c89a50', 'bigbeast')],
      Summon: [skin('Elephas', '#9aa0a6', 'bigbeast'), skin('Rhinoceros', '#7a7a80', 'bigbeast'), skin('Taurus', '#5a3a2a', 'bigbeast')],
      Bat: [skin('Vultur', '#6b5a48', 'wing'), skin('Grus', '#b8c4cc', 'wing'), skin('Aquila', '#8a6a48', 'wing')],
      Imp: [skin('Hyaena', '#b08050', 'beast'), skin('Simia', '#a07040', 'imp'), skin('Crocotta', '#9a7050', 'beast')],
      Wisp: [skin('Lepus', '#d8c8a8', 'wisp'), skin('Vulpes', '#e08040', 'wisp'), skin('Mustela', '#c0a080', 'wisp')],
    },
    paint(f, s) { ring(f, s, '#a88d5c'); tree(f, s.x - 44, s.y - 6); tree(f, s.x + 118, s.y - 14); f.fillStyle = '#8a7a66'; f.beginPath(); f.ellipse(s.x + 70, s.y + 62, 16, 7, 0, 0, Math.PI * 2); f.fill() } },
  { name: 'Ludus Capua', era: '73 BC', fact: '트라키아 출신 스파르타쿠스가 동료 약 70명과 부엌칼로 무장해 렌툴루스 바티아투스의 양성소를 탈출, 베수비오 산에 진을 치며 노예 전쟁이 시작됐다(Plutarch, Crassus 8).',
    enemies: {
      Slime: [skin('Rattus', '#7a6a5a', 'blob'), skin('Catena', '#8a8a90', 'blob'), skin('Canis', '#a08060', 'beast')],
      Scribe: [skin('Lanista', '#6aa6ff', 'hood'), skin('Doctor', '#5f8fd6', 'hood'), skin('Coquus', '#8fb3ff', 'hood')],
      Goblin: [skin('Custos', '#e06060', 'warrior'), skin('Vigil', '#c04040', 'warrior'), skin('Miles', '#b03030', 'warrior')],
      Summon: [skin('Legionarius', '#c04040', 'warrior'), skin('Centurio', '#d04040', 'crowned'), skin('Glaber', '#a02020', 'crowned')],
      Bat: [skin('Corvus', '#2b2b33', 'wing'), skin('Noctua', '#6a6a7a', 'wing'), skin('Cornix', '#3a3a44', 'wing')],
      Imp: [skin('Thraex', '#ff9b4a', 'warrior'), skin('Gallus', '#e0a060', 'warrior'), skin('Samnis', '#ffb070', 'warrior')],
      Wisp: [skin('Fumus', '#9aa0a6', 'wisp'), skin('Umbra', '#6a6a7a', 'wisp'), skin('Cinis', '#8a8a8a', 'wisp')],
    },
    paint(f, s) { f.fillStyle = '#8f8a80'; f.fillRect(s.x - 50, s.y - 4, 190, 70); f.fillStyle = '#6b665c'; for (let i = 0; i < 6; i++) f.fillRect(s.x - 50 + i * 36, s.y - 4, 2, 70); f.fillStyle = '#3f4049'; for (let i = 0; i < 7; i++) f.fillRect(s.x + 96 + i * 5, s.y - 14, 3, 30); f.fillStyle = '#5a5a66'; f.fillRect(s.x - 46, s.y + 56, 40, 4); f.fillRect(s.x - 10, s.y + 52, 4, 8) } },
  { name: 'Hypogeum', era: 'AD 80s', fact: '콜로세움 바닥 아래 2층 지하. 도미티아누스 때 완성된 통로와 우리, 캡스턴으로 돌리는 승강기 수십 대가 맹수와 무대 장치를 뚜껑문으로 밀어 올렸다.',
    enemies: {
      Slime: [skin('Serpens', '#5fd35f', 'serpent'), skin('Rana', '#6ab06a', 'blob'), skin('Rattus', '#7a6a5a', 'blob')],
      Scribe: [skin('Custos', '#6aa6ff', 'hood'), skin('Fossor', '#5f8fd6', 'hood'), skin('Faber', '#8fb3ff', 'hood')],
      Goblin: [skin('Ursus', '#6b4a2a', 'bigbeast'), skin('Lupus', '#8a8a8a', 'beast'), skin('Aper', '#7a5a3a', 'beast')],
      Summon: [skin('Crocodilus', '#4a8a4a', 'serpent'), skin('Hippopotamus', '#7a7a80', 'bigbeast'), skin('Leo', '#d9a040', 'bigbeast')],
      Bat: [skin('Vespertilio', '#8fb3c7', 'wing'), skin('Noctua', '#6a6a7a', 'wing'), skin('Strix', '#5a5a66', 'wing')],
      Imp: [skin('Machinator', '#ff9b4a', 'imp'), skin('Larva', '#c8d0d8', 'imp'), skin('Lemur', '#a0a8b0', 'imp')],
      Wisp: [skin('Umbra', '#6a6a7a', 'wisp'), skin('Vapor', '#9aa0a6', 'wisp'), skin('Tenebrae', '#4a4a55', 'wisp')],
    },
    paint(f, s) { f.fillStyle = '#4a4038'; f.fillRect(s.x - 50, s.y - 10, 190, 76); f.fillStyle = '#2a2420'; f.fillRect(s.x + 56, s.y + 26, 44, 24); f.fillStyle = '#7a6148'; f.fillRect(s.x + 56, s.y + 26, 44, 3); f.fillRect(s.x + 56, s.y + 47, 44, 3); f.fillStyle = '#5a4634'; f.fillRect(s.x + 106, s.y - 20, 6, 60); f.fillRect(s.x + 126, s.y - 20, 6, 60); f.fillRect(s.x + 106, s.y - 24, 26, 5); f.fillStyle = '#8a7a66'; f.fillRect(s.x + 112, s.y + 10, 14, 3); f.fillRect(s.x + 112, s.y + 24, 14, 3) } },
  { name: 'Circus Maximus', era: '6th c. BC – AD 549', race: true,   // a race, not a duel: the warrior rides a chariot and the foe runs ahead, facing the same way fact: '전차 경주장. 청·녹·적·백 4개 파벌이 겨뤘고, 플리니우스는 25만 석으로 전한다. 전차수 디오클레스는 24년간 상금 3,586만 세스테르티우스를 벌었다(CIL VI 10048).',
    enemies: {
      Slime: [skin('Equuleus', '#b08050', 'horse'), skin('Mulus', '#8a7a66', 'horse'), skin('Asinus', '#a0a0a0', 'horse')],
      Scribe: [skin('Sponsor', '#6aa6ff', 'hood', 'chariot'), skin('Dominus Factionis', '#5f8fd6', 'hood', 'chariot'), skin('Editor', '#8fb3ff', 'hood', 'chariot')],
      // the four racing factions, each in its colour
      Goblin: [skin('Auriga Prasinus', '#3a8a3a', 'warrior', 'chariot'), skin('Auriga Venetus', '#3a5ab0', 'warrior', 'chariot'), skin('Auriga Russatus', '#c03030', 'warrior', 'chariot'), skin('Auriga Albatus', '#e8e8e8', 'warrior', 'chariot')],
      Summon: [skin('Quadriga', '#c080ff', 'horse', 'cart'), skin('Biga', '#a060e0', 'horse', 'cart'), skin('Diocles', '#ffd23f', 'crowned', 'chariot')],
      Bat: [skin('Accipiter', '#8fb3c7', 'wing'), skin('Milvus', '#a08060', 'wing'), skin('Columba', '#dfe7ee', 'wing')],
      Imp: [skin('Fautor', '#ff9b4a', 'imp'), skin('Delator', '#e07040', 'imp'), skin('Agitator', '#ffb070', 'warrior', 'chariot')],
      Wisp: [skin('Pulvis', '#d8c8a8', 'wisp'), skin('Fumus', '#9aa0a6', 'wisp'), skin('Clamor', '#e0d0b0', 'wisp')],
    },
    paint(f, s) { oval(f, s, '#c8b088'); f.strokeStyle = '#e8dcc0'; f.lineWidth = 2; f.beginPath(); f.ellipse(s.x + 40, s.y + 44, 84, 24, 0, 0, Math.PI * 2); f.stroke(); f.beginPath(); f.ellipse(s.x + 40, s.y + 44, 60, 14, 0, 0, Math.PI * 2); f.stroke(); f.fillStyle = '#8a8070'; f.fillRect(s.x + 108, s.y - 24, 8, 70); f.fillStyle = '#ffd23f'; f.fillRect(s.x + 108, s.y - 30, 8, 6) } },
]

// Every page load deals the arenas in a fresh order: slot i wears THEMES[i], so which two open the yard, and where
// each stands once it is full, differs from one visit to the next.
export const THEMES = shuffle(ALL_THEMES)

export const themeOf = session => { const actor = actors.get(session); return actor ? THEMES[actor.slot.theme] : null }

/** The foes a monster class can appear as in a theme; a plain wisp in the class's own colour when the theme has none. */
export const castOf = (theme, monster) => (theme && theme.enemies[monster]) || [skin(monster, (ENEMIES[monster] || ENEMIES.Wisp).c, 'wisp')]
