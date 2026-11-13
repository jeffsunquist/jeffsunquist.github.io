// Lift Force — a small arena platformer in the spirit of the early-2000s
// helicopter shooters: hold a strip of rock and scaffolding while choppers
// sweep in from above, and grab whatever the wreckage drops.
//
// p5 instance-mode sketch, no assets. The world is a fixed 960x640 logical
// space scaled to fit the stage, so jump distances and aim never change with
// the window size.
export default function sketch(p) {
  // ---------------------------------------------------------------- world
  const W = 960
  const H = 640
  const GROUND_Y = 540
  const HUD_TOP = H - 88

  const PLATFORMS = [
    { x: 70, y: 480, w: 220, h: 14 },
    { x: 670, y: 480, w: 220, h: 14 },
    { x: 370, y: 425, w: 220, h: 14 }
  ]

  // ------------------------------------------------------------- movement
  const GRAVITY = 1900
  const MAX_FALL = 1150
  const RUN_MAX = 265
  const RUN_ACCEL = 3300
  const AIR_ACCEL = 1750
  const GROUND_DRAG = 3000
  const AIR_DRAG = 260
  const JUMP_V = 650
  const AIR_JUMP_V = 600
  const COYOTE = 0.09
  const BUFFER = 0.12
  const AIM_SWEEP = Math.PI / 3   // 60 deg/sec on the keyboard aim sweep

  // ---------------------------------------------------------------- dash
  const DASH_SPEED = 760
  const DASH_TIME = 0.18
  const DASH_COOLDOWN = 1.2
  const DASH_IFRAMES = 0.12

  // ---------------------------------------------------------------- waves
  const WAVE_FIGHT = 25
  const WAVE_BREATHER = 6
  const WAVE_COUNTDOWN = 2.2
  const BOSS_EVERY = 4
  const COMBO_TIME = 3
  const COMBO_MAX = 5
  const SHIELD_TIME = 20
  const OVERDRIVE_TIME = 6

  // --------------------------------------------------------------- colour
  const C = {
    ink: [31, 41, 55],
    muted: [107, 114, 128],
    faint: [156, 163, 175],
    line: [203, 213, 225],
    paper: [251, 251, 253],
    panel: [238, 241, 245],
    stage: [232, 236, 242],
    accent: [11, 87, 208],
    force: [220, 38, 38],
    danger: [185, 28, 28],
    flame: [234, 88, 12],
    good: [13, 148, 136],
    cyan: [6, 182, 212],
    charcoal: [58, 66, 78]
  }

  // Fixed enemy stats — difficulty comes from the roster, not from HP.
  const ENEMIES = {
    scout: { hp: 110, r: 26, points: 150, speed: 1.0, alt: [140, 280], hover: [140, 300], travel: 280, anchor: [1.4, 2.6] },
    heavy: { hp: 300, r: 40, points: 400, speed: 0.85, alt: [140, 280], hover: [140, 300], travel: 280, anchor: [1.4, 2.6] },
    bomber: { hp: 220, r: 38, points: 350, speed: 0.55, alt: [80, 140], hover: [80, 140], travel: 220, anchor: [1.8, 3.0] },
    nighthawk: { hp: 180, r: 30, points: 500, speed: 2.0, alt: [140, 280], hover: [140, 300], travel: 560, anchor: [2.2, 3.4] },
    gunship: { hp: 2200, r: 62, points: 2500, speed: 0.5, alt: [140, 220], hover: [150, 220], travel: 300, anchor: [9, 12] }
  }

  // -------------------------------------------------------------- weapons
  // `cd` is seconds between trigger pulls, `counts` feeds the accuracy stat.
  const WEAPONS = {
    pistol: { label: 'Pistol', short: 'Pistol', max: Infinity, dmg: 10, cd: 0.13, spread: 0.018, speed: 950, pellets: 1, size: 3, life: 1.1, color: C.ink, counts: true },
    shotgun: { label: 'Shotgun', short: 'Shotgun', max: 28, cap: 999, dmg: 9, cd: 0.52, spread: 0.17, speed: 820, pellets: 8, size: 2.6, life: 0.62, color: C.ink, counts: true, recoil: 275 },
    rocket: { label: 'Rocket', short: 'Rocket', max: 2, cap: 999, dmg: 280, cd: 0.85, spread: 0.012, speed: 45, pellets: 1, size: 4, life: 2.6, color: C.accent, counts: true, splash: 80, splashR: 85, kick: 150, homing: true },
    flame: { label: 'Flamethrower', short: 'Flame', max: 8, cap: 999, dmg: 7, speed: 520, size: 6, life: 0.85, color: C.flame }
  }
  const ORDER = ['pistol', 'shotgun', 'flame']

  // ------------------------------------------------------- rescue questions
  // One of these is asked when the player runs out of health. Keep the
  // options short so they fit the answer buttons.
  const PHYSICS_QUESTIONS = [
    {
      q: 'A car travels 100 m in 5 s. What is its average speed?',
      options: ['5 m/s', '20 m/s', '50 m/s', '500 m/s'],
      answer: 1
    },
    {
      q: 'Which of these is a vector quantity?',
      options: ['Speed', 'Distance', 'Velocity', 'Mass'],
      answer: 2
    },
    {
      q: 'A 10 kg box has a net force of 50 N. What is its acceleration?',
      options: ['0.2 m/s²', '5 m/s²', '40 m/s²', '500 m/s²'],
      answer: 1
    },
    {
      q: 'What is the weight of a 2 kg object on Earth? (Use g = 9.8 m/s².)',
      options: ['2 N', '9.8 N', '19.6 N', '196 N'],
      answer: 2
    },
    {
      q: 'A 3 kg object accelerates at 4 m/s². What is the net force?',
      options: ['0.75 N', '7 N', '12 N', '24 N'],
      answer: 2
    },
    {
      q: 'An object has zero net force acting on it. It must…',
      options: ['be at rest', 'accelerate', 'be at rest or move at constant velocity', 'be in free fall'],
      answer: 2
    },
    {
      q: "Newton's third law says action–reaction forces are…",
      options: ['equal and in the same direction', 'equal and opposite on different objects', 'equal and opposite on the same object', 'always unequal'],
      answer: 1
    },
    {
      q: 'A ball is thrown straight up. At its highest point, its acceleration is…',
      options: ['zero', '9.8 m/s² downward', '9.8 m/s² upward', 'equal to its velocity'],
      answer: 1
    },
    {
      q: 'A crate is pushed with 40 N right while kinetic friction is 10 N left. The net force is…',
      options: ['10 N left', '30 N right', '40 N right', '50 N left'],
      answer: 1
    },
    {
      q: 'You push a box sideways while it moves forward. The work done by your push is…',
      options: ['positive', 'negative', 'zero', 'equal to its weight'],
      answer: 2
    },
    {
      q: 'What is the SI unit of force?',
      options: ['joule', 'newton', 'watt', 'pascal'],
      answer: 1
    },
    {
      q: 'A person walks 4 m east, then 3 m west. Their displacement is…',
      options: ['7 m east', '1 m east', '1 m west', '7 m west'],
      answer: 1
    }
  ]

  // Answer buttons: a compact 2x2 grid in the bottom-sheet question panel.
  const RESCUE_BTN_W = 350
  const RESCUE_BTN_H = 50
  function rescueAnswerRect(i) {
    const col = i % 2
    const row = Math.floor(i / 2)
    return { x: W / 2 + (col ? 185 : -185), y: 444 + row * 58, w: RESCUE_BTN_W, h: RESCUE_BTN_H }
  }

  // On-canvas buttons, shared by the drawing and the hit test.
  const PLAY_BTN = { x: W / 2, y: 268, w: 220, h: 62 }
  const AGAIN_BTN = { x: W / 2, y: 470, w: 240, h: 58 }

  // HUD weapon capsules, shared by the drawing and the pickup-flight target.
  const CAP_ORDER = ['pistol', 'shotgun', 'flame', 'rocket']
  const CAP_W = 118
  const CAP_H = 28
  const CAP_GAP = 8
  const CAP_X = 24
  const CAP_Y = H - 28

  function capsuleRect(i) {
    return { x: CAP_X + i * (CAP_W + CAP_GAP), y: CAP_Y, w: CAP_W, h: CAP_H }
  }

  // A full flame tank (10 ammo) burns for FLAME_TANK / FLAME_DRAIN seconds.
  const FLAME_DRAIN = 2          // ammo per second
  const FLAME_EMIT = 0.032       // seconds between particles
  const FLAME_SPREAD = 0.13

  // Parachute crate physics: terminal velocity is sqrt(g / k).
  const CRATE_G = 130            // px/s^2
  const CRATE_VT = 105           // px/s
  const CRATE_K = CRATE_G / (CRATE_VT * CRATE_VT)
  const SUPPLY_FALLBACK = 30     // seconds without a plane
  const SUPPLY_COOLDOWN = 8      // seconds between planes

  // ---------------------------------------------------------------- state
  let mode = 'title'            // title | play | pause | over
  let view = { s: 1, ox: 0, oy: 0 }
  let stage, controls, canvasEl
  let handReady = false
  let pointer = { x: W / 2, y: 60 }

  let player, bullets, helis, pickups, particles, planes, crates, flyers, bombs
  let popups
  let truckPuffs
  let hudFlash = { pistol: 0, shotgun: 0, flame: 0, rocket: 0 }
  let cheatBuf = ''
  let cheatsUsed = false
  let ammo, weapon
  let score, best, kills, shots, hits
  let elapsed = 0, spawnT = 0, dropIndex = 0, weaponDrop = 0, shake = 0, hurtFlash = 0, titleT = 0
  let animT = 0
  let supplyT = SUPPLY_FALLBACK, planeCooldown = 0
  let newBest = false

  // Waves and encounter pacing.
  let waveIndex = 0
  let wavePhase = 'countdown'   // countdown | fight | breather | boss
  let waveT = WAVE_COUNTDOWN
  let waveBanner = null
  let bossNumber = 0

  // Dash, combo, and smart supply timers.
  let dashT = 0, dashCd = 0, dashDir = 1
  let combo = 0, comboT = 0
  let healthDropCd = 0, pistolOnlyT = 0, powerupIndex = 0

  // The rescue event: null when idle, otherwise the cutscene state.
  let rescue = null
  let rescued = false
  let lastQuestion = -1
  // Cinematic camera, only used while mode === 'rescue'.
  let camera = { zoom: 1, x: W / 2, y: H / 2 }

  let firing = false
  let keys = new Set()
  let aimByMouse = true
  let keyAim = Math.PI / 2   // keyboard aim, 0 = right, PI/2 = up, PI = left

  // -------------------------------------------------------------- helpers
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)
  const rgba = (c, a = 255) => `rgba(${c[0]},${c[1]},${c[2]},${a / 255})`
  const comboMult = () => Math.min(COMBO_MAX, 1 + Math.max(0, combo - 1) * 0.5)

  // Flame ammo is fractional while the jet burns; show whole units.
  function ammoLabel(name) {
    const v = ammo[name]
    if (!isFinite(v)) return '∞'
    return String(Math.max(0, Math.ceil(v)))
  }

  // ------------------------------------------------------------ rough ink
  // Hand-drawn outlines: every shape is stroked twice with a small, seeded
  // wobble. The seeds are deterministic, so nothing shimmers at 60 fps.
  const ROUGH = 1.1

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return s - Math.floor(s)
  }

  const jit = (seed, amp) => (hash(seed) - 0.5) * 2 * amp

  function roughLine(x1, y1, x2, y2, seed = 0, amp = ROUGH) {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    p.noFill()
    for (let pass = 0; pass < 2; pass++) {
      const s = seed + pass * 37.1
      const bow = jit(s, amp * 1.7)
      const ox = jit(s + 3.1, amp * 0.55)
      const oy = jit(s + 7.3, amp * 0.55)
      p.beginShape()
      p.vertex(x1 + ox, y1 + oy)
      p.quadraticVertex((x1 + x2) / 2 + nx * bow, (y1 + y2) / 2 + ny * bow, x2 + ox, y2 + oy)
      p.endShape()
    }
  }

  function roughRect(x, y, w, h, seed = 0, amp = ROUGH) {
    roughLine(x, y, x + w, y, seed + 1, amp)
    roughLine(x + w, y, x + w, y + h, seed + 2, amp)
    roughLine(x + w, y + h, x, y + h, seed + 3, amp)
    roughLine(x, y + h, x, y, seed + 4, amp)
  }

  function blobPoints(cx, cy, w, h, seed = 0, amp = ROUGH, n = 22) {
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * p.TWO_PI
      const k = jit(seed + i * 1.7, amp)
      pts.push({ x: cx + Math.cos(a) * (w / 2 + k), y: cy + Math.sin(a) * (h / 2 + k) })
    }
    return pts
  }

  // A true capsule: straight top/bottom, one semicircle per end.
  function capsulePoints(w, h, seed = 0, amp = ROUGH, per = 7) {
    const hw = w / 2
    const r = h / 2
    const pts = []
    for (let i = 0; i <= per * 2; i++) {
      const a = -Math.PI / 2 + (i / (per * 2)) * Math.PI
      const k = jit(seed + i * 1.7, amp)
      pts.push({ x: hw - r + Math.cos(a) * (r + k), y: Math.sin(a) * (r + k) })
    }
    for (let i = 0; i <= per * 2; i++) {
      const a = Math.PI / 2 + (i / (per * 2)) * Math.PI
      const k = jit(seed + 50 + i * 1.7, amp)
      pts.push({ x: -hw + r + Math.cos(a) * (r + k), y: Math.sin(a) * (r + k) })
    }
    return pts
  }

  // Rounded-rectangle outline, sampled from four corner arcs and jittered.
  function roundedPoints(w, h, rad, seed = 0, amp = ROUGH, per = 4) {
    const pts = []
    const hw = w / 2
    const hh = h / 2
    const corners = [
      [hw - rad, -hh + rad, Math.PI * 1.5, Math.PI * 2],
      [hw - rad, hh - rad, 0, Math.PI * 0.5],
      [-hw + rad, hh - rad, Math.PI * 0.5, Math.PI],
      [-hw + rad, -hh + rad, Math.PI, Math.PI * 1.5]
    ]
    for (const [cx, cy, a0, a1] of corners) {
      for (let i = 0; i <= per; i++) {
        const a = a0 + (a1 - a0) * (i / per)
        const k = jit(seed + pts.length * 1.7, amp)
        pts.push({ x: cx + Math.cos(a) * (rad + k), y: cy + Math.sin(a) * (rad + k) })
      }
    }
    return pts
  }

  function fillBlob(cx, cy, w, h, color, seed = 0, amp = ROUGH) {
    const pts = blobPoints(cx, cy, w, h, seed, amp)
    p.noStroke()
    p.fill(...color)
    p.beginShape()
    for (const q of pts) p.vertex(q.x, q.y)
    p.endShape(p.CLOSE)
    return pts
  }

  function strokeBlob(pts, seed = 0, amp = ROUGH) {
    p.noFill()
    for (let pass = 0; pass < 2; pass++) {
      p.beginShape()
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]
        const s = seed + i * 2.3 + pass * 11.7
        p.vertex(q.x + jit(s, amp * 0.45), q.y + jit(s + 5.1, amp * 0.45))
      }
      p.endShape(p.CLOSE)
    }
  }

  function fillPoly(pts, color) {
    p.noStroke()
    p.fill(...color)
    p.beginShape()
    for (const q of pts) p.vertex(q[0], q[1])
    p.endShape(p.CLOSE)
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  const store = {
    get() {
      try {
        return parseInt(window.localStorage.getItem('lift-force.best'), 10) || 0
      } catch (e) {
        return 0
      }
    },
    set(v) {
      try {
        window.localStorage.setItem('lift-force.best', String(v))
      } catch (e) { /* private mode */ }
    }
  }

  // --------------------------------------------------------------- layout
  function layout() {
    const s = Math.min(p.width / W, p.height / H) || 1
    view.s = s
    view.ox = (p.width - W * s) / 2
    view.oy = (p.height - H * s) / 2
  }

  function pointerFromEvent(e) {
    const r = canvasEl.getBoundingClientRect()
    return {
      x: (e.clientX - r.left - view.ox) / view.s,
      y: (e.clientY - r.top - view.oy) / view.s
    }
  }

  function mouseWorld() {
    return pointer
  }

  // ------------------------------------------------------------ new run
  function reset() {
    player = {
      x: W / 2, y: GROUND_Y, vx: 0, vy: 0,
      w: 20, h: 32, onGround: true, jumps: 1,
      coyote: 0, buffer: 0, hp: 100, maxHp: 100,
      invuln: 0, aim: -Math.PI / 2, fireCd: 0, flash: 0, recoilVx: 0,
      invincible: 0, shieldT: 0, overdriveT: 0
    }
    bullets = []
    helis = []
    pickups = []
    particles = []
    planes = []
    crates = []
    flyers = []
    bombs = []
    popups = []
    truckPuffs = []
    hudFlash = { pistol: 0, shotgun: 0, flame: 0, rocket: 0 }
    cheatBuf = ''
    cheatsUsed = false
    ammo = { pistol: Infinity, shotgun: 0, rocket: 0, flame: 0 }
    weapon = 'pistol'
    score = 0
    kills = 0
    shots = 0
    hits = 0
    elapsed = 0
    animT = 0
    spawnT = 0.5
    dropIndex = 0
    weaponDrop = 0
    supplyT = SUPPLY_FALLBACK
    planeCooldown = 0
    shake = 0
    hurtFlash = 0
    newBest = false
    waveIndex = 0
    wavePhase = 'countdown'
    waveT = WAVE_COUNTDOWN
    waveBanner = { text: 'WAVE 1', sub: 'GET READY', life: 2.2, max: 2.2 }
    bossNumber = 0
    dashT = 0
    dashCd = 0
    dashDir = 1
    combo = 0
    comboT = 0
    healthDropCd = 0
    pistolOnlyT = 0
    powerupIndex = 0
    rescue = null
    rescued = false
    camera = { zoom: 1, x: W / 2, y: H / 2 }
    aimByMouse = true
    keyAim = Math.PI / 2
    firing = false
  }

  function startGame() {
    reset()
    mode = 'play'
  }

  // ---------------------------------------------------------------- input
  function jumpPressed() {
    player.buffer = BUFFER
  }

  function tryDash() {
    if (mode !== 'play' || dashCd > 0 || dashT > 0) return
    const held = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
    dashDir = held !== 0 ? held : (Math.cos(player.aim) >= 0 ? 1 : -1)
    dashT = DASH_TIME
    dashCd = DASH_COOLDOWN
    player.vx = dashDir * DASH_SPEED
    player.invuln = Math.max(player.invuln, DASH_IFRAMES)
    puff(player.x, player.y, 6)
    shake = Math.max(shake, 2)
  }

  function activateCheat(code) {
    cheatsUsed = true
    player.hp = player.maxHp
    if (code === 'monster') {
      player.invincible = Infinity
      ammo.pistol = Infinity
      ammo.shotgun = Infinity
      ammo.rocket = Infinity
      ammo.flame = Infinity
    } else {
      player.invincible = Math.max(player.invincible, 1)
    }
  }

  // Hand aim over to the keyboard, seeded from wherever the mouse was pointing.
  function takeKeyboardAim() {
    if (!aimByMouse) return
    let a = -player.aim
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    if (a > Math.PI) a = (a - Math.PI) < (Math.PI * 2 - a) ? Math.PI : 0
    keyAim = clamp(a, 0, Math.PI)
    aimByMouse = false
  }

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    if (e.repeat) return
    keys.add(e.code)

    if (mode === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') startGame()
      return
    }
    if (mode === 'over') {
      if (e.code === 'Enter' || e.code === 'Space') startGame()
      return
    }
    if (mode === 'rescue') return
    if (e.code === 'KeyP' || e.code === 'Escape') {
      mode = mode === 'play' ? 'pause' : 'play'
      firing = false
      return
    }
    if (mode === 'pause') return

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') tryDash()
    if (e.code === 'KeyW') jumpPressed()
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') takeKeyboardAim()
    if (e.code === 'KeyR') launchRocket()

    const slot = ORDER[['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)]
    if (slot) selectWeapon(slot)
    if (e.code === 'End') cycleWeapon()

    // Hidden cheats: quietly watch the last characters typed.
    if (e.key && e.key.length === 1) {
      cheatBuf = (cheatBuf + e.key.toLowerCase()).slice(-8)
      if (cheatBuf.endsWith('f=ma')) {
        activateCheat('f=ma')
        cheatBuf = ''
      } else if (cheatBuf.endsWith('monster')) {
        activateCheat('monster')
        cheatBuf = ''
      }
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code)
  }

  function selectWeapon(name) {
    if (name === 'pistol' || ammo[name] > 0 || player.overdriveT > 0) weapon = name
  }

  function cycleWeapon() {
    const i = ORDER.indexOf(weapon)
    for (let k = 1; k <= ORDER.length; k++) {
      const next = ORDER[(i + k) % ORDER.length]
      if (next === 'pistol' || ammo[next] > 0 || player.overdriveT > 0) {
        weapon = next
        return
      }
    }
  }

  function inRect(mx, my, x, y, w, h) {
    return mx >= x - w / 2 && mx <= x + w / 2 && my >= y - h / 2 && my <= y + h / 2
  }

  function onCanvasDown(e) {
    e.preventDefault()
    pointer = pointerFromEvent(e)
    const m = pointer

    if (mode === 'title') {
      if (inRect(m.x, m.y, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) startGame()
      return
    }
    if (mode === 'over') {
      if (inRect(m.x, m.y, AGAIN_BTN.x, AGAIN_BTN.y, AGAIN_BTN.w, AGAIN_BTN.h)) startGame()
      return
    }
    if (mode === 'rescue') {
      if (rescue && rescue.phase === 'ask') {
        for (let i = 0; i < 4; i++) {
          const r = rescueAnswerRect(i)
          if (inRect(m.x, m.y, r.x, r.y, r.w, r.h)) {
            answerRescue(i)
            break
          }
        }
      }
      return
    }
    if (mode === 'pause') {
      mode = 'play'
      return
    }
    firing = true
  }

  // -------------------------------------------------------------- player
  function updatePlayer(dt) {
    const left = keys.has('KeyA')
    const right = keys.has('KeyD')
    const dir = (right ? 1 : 0) - (left ? 1 : 0)

    dashCd = Math.max(0, dashCd - dt)
    if (dashT > 0) {
      dashT = Math.max(0, dashT - dt)
      player.vx = dashDir * DASH_SPEED
      if (Math.floor(animT * 60) % 2 === 0) puff(player.x, player.y, 1)
    } else if (dir !== 0) {
      player.vx += dir * (player.onGround ? RUN_ACCEL : AIR_ACCEL) * dt
      player.vx = clamp(player.vx, -RUN_MAX, RUN_MAX)
    } else {
      const drag = (player.onGround ? GROUND_DRAG : AIR_DRAG) * dt
      if (Math.abs(player.vx) <= drag) player.vx = 0
      else player.vx -= Math.sign(player.vx) * drag
    }

    player.coyote = player.onGround ? COYOTE : Math.max(0, player.coyote - dt)
    player.buffer = Math.max(0, player.buffer - dt)

    if (player.buffer > 0) {
      if (player.onGround || player.coyote > 0) {
        player.vy = -JUMP_V
        player.onGround = false
        player.coyote = 0
        player.buffer = 0
        player.jumps = 1
        puff(player.x, player.y, 5)
      } else if (player.jumps > 0) {
        player.vy = -AIR_JUMP_V
        player.jumps--
        player.buffer = 0
        puff(player.x, player.y, 7)
      }
    }

    player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL)

    const prevFeet = player.y
    player.x = clamp(player.x + player.vx * dt, 14, W - 14)

    // Shotgun recoil: a short horizontal slide that fades out, independent of
    // walking friction so it stays visible for a beat.
    if (player.recoilVx) {
      player.x = clamp(player.x + player.recoilVx * dt, 14, W - 14)
      player.recoilVx *= Math.max(0, 1 - 14 * dt)
      if (Math.abs(player.recoilVx) < 2) player.recoilVx = 0
    }
    player.y += player.vy * dt
    player.onGround = false

    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y
      player.vy = 0
      player.onGround = true
    }

    if (player.vy >= 0) {
      const l = player.x - player.w / 2
      const r = player.x + player.w / 2
      for (const pl of PLATFORMS) {
        if (r > pl.x && l < pl.x + pl.w && prevFeet <= pl.y + 2 && player.y >= pl.y) {
          player.y = pl.y
          player.vy = 0
          player.onGround = true
        }
      }
    }

    if (player.onGround) player.jumps = 1

    if (aimByMouse) {
      const m = mouseWorld()
      player.aim = Math.atan2(m.y - (player.y - 20), m.x - player.x)
    } else {
      const rot = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)
      if (rot !== 0) keyAim = clamp(keyAim + rot * AIM_SWEEP * dt, 0, Math.PI)
      player.aim = -keyAim
    }
  }

  function muzzle() {
    const ax = Math.cos(player.aim)
    const ay = Math.sin(player.aim)
    return { x: player.x + ax * 26, y: player.y - 20 + ay * 26, ax, ay }
  }

  function tryFire(dt) {
    player.fireCd = Math.max(0, player.fireCd - dt)
    // Space is a second trigger, for laptop trackpads.
    if (!firing && !keys.has('Space')) return

    if (weapon === 'flame') {
      flameTick(dt)
      return
    }
    if (player.fireCd > 0) return

    const w = WEAPONS[weapon]
    const od = player.overdriveT > 0
    if (!od && isFinite(ammo[weapon]) && ammo[weapon] <= 0) {
      weapon = 'pistol'
      return
    }

    const m = muzzle()
    for (let i = 0; i < w.pellets; i++) {
      const a = player.aim + p.random(-w.spread, w.spread)
      const sp = w.speed * p.random(0.94, 1.06)
      bullets.push({
        x: m.x, y: m.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: w.life, life0: w.life, dmg: w.dmg, r: w.size, color: w.color,
        splash: w.splash || 0, splashR: w.splashR || 0,
        drag: w.drag || 1, own: true, counts: w.counts,
        homing: !!w.homing,
        target: w.homing ? nearestHeli(m.x, m.y) : null,
        ax: 0, ay: 0, maxSpeed: 640, accel: 320, turn: 4.5,
        arm: 0.15, smokeT: 0
      })
      if (w.counts) shots++
    }

    if (!od && isFinite(ammo[weapon])) {
      ammo[weapon]--
      if (ammo[weapon] <= 0) weapon = 'pistol'
    }

    player.fireCd = w.cd * (od ? 0.55 : 1)
    player.flash = 0.06
    player.vx -= Math.cos(player.aim) * (w.kick || 0) * 0.06
    player.vy -= Math.sin(player.aim) * (w.kick || 0) * 0.02
    if (w.recoil) player.recoilVx = -Math.cos(player.aim) * w.recoil
  }

  // A heavy, continuous jet: the tank drains while the trigger is held, so a
  // full 10 ammo lasts five seconds. Particles are emitted every few frames.
  function flameTick(dt) {
    const od = player.overdriveT > 0
    if (ammo.flame <= 0 && !od) {
      weapon = 'pistol'
      return
    }
    if (!od) ammo.flame = Math.max(0, ammo.flame - FLAME_DRAIN * dt)
    if (player.fireCd > 0) return
    player.fireCd = FLAME_EMIT * (od ? 0.55 : 1)

    const w = WEAPONS.flame
    const m = muzzle()
    for (let i = 0; i < 2; i++) {
      const a = player.aim + p.random(-FLAME_SPREAD, FLAME_SPREAD)
      const sp = w.speed * p.random(0.9, 1.1)
      bullets.push({
        x: m.x, y: m.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: w.life, life0: w.life, dmg: w.dmg, r: w.size, color: w.color,
        splash: 0, splashR: 0, drag: 0.992, own: true, counts: false, fade: true
      })
    }
    player.flash = 0.05
    if (ammo.flame <= 0 && !od) weapon = 'pistol'
  }

  // Rockets are a special item: R launches one whatever gun is equipped.
  function launchRocket() {
    if (mode !== 'play' || (ammo.rocket <= 0 && player.overdriveT <= 0)) return
    if (player.overdriveT <= 0) ammo.rocket--

    const w = WEAPONS.rocket
    const m = muzzle()
    const a = player.aim + p.random(-w.spread, w.spread)
    const sp = w.speed * p.random(0.94, 1.06)
    bullets.push({
      x: m.x, y: m.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: w.life, life0: w.life, dmg: w.dmg, r: w.size, color: w.color,
      splash: w.splash, splashR: w.splashR,
      drag: 1, own: true, counts: true,
      homing: true, target: nearestHeli(m.x, m.y),
      ax: 0, ay: 0, maxSpeed: 640, accel: 320, turn: 4.5,
      arm: 0.15, smokeT: 0
    })
    shots++

    player.flash = 0.06
    player.vx -= Math.cos(a) * w.kick * 0.06
    player.vy -= Math.sin(a) * w.kick * 0.02
  }

  function damagePlayer(dmg) {
    if (player.invuln > 0 || player.invincible > 0 || mode !== 'play') return
    combo = 0
    comboT = 0

    if (player.shieldT > 0) {
      player.shieldT = 0
      player.invuln = 0.6
      shake = Math.max(shake, 5)
      burst(player.x, player.y - 16, 14, C.cyan, 220)
      return
    }

    player.hp -= dmg
    player.invuln = 0.85
    shake = Math.max(shake, 7)
    hurtFlash = 1
    burst(player.x, player.y - 16, 8, C.danger, 160)

    if (player.hp <= 0) {
      player.hp = 0
      beginRescue()
    }
  }

  function recordBest() {
    if (score > best) {
      best = score
      newBest = true
      store.set(best)
    }
  }

  function die() {
    mode = 'over'
    firing = false
    shake = 14
    burst(player.x, player.y - 16, 30, C.ink, 320)
    burst(player.x, player.y - 16, 14, C.accent, 240)
    recordBest()
  }

  // ------------------------------------------------------------- Rescue event
  // Running out of health calls the Cybertruck instead of ending the run
  // outright. Answer the physics question correctly to be carried off, or
  // watch him leave and take the normal "owari da" ending.
  function pickRescueQuestion() {
    const n = PHYSICS_QUESTIONS.length
    let i = Math.min(n - 1, Math.floor(p.random(n)))
    if (n > 1 && i === lastQuestion) i = (i + 1) % n
    lastQuestion = i

    const src = PHYSICS_QUESTIONS[i]
    const correctText = src.options[src.answer]
    const options = src.options.slice()
    for (let k = options.length - 1; k > 0; k--) {
      const j = Math.floor(p.random(k + 1))
      const tmp = options[k]
      options[k] = options[j]
      options[j] = tmp
    }
    return { q: src.q, options, answer: options.indexOf(correctText) }
  }

  function beginRescue() {
    if (rescue || mode !== 'play') return
    mode = 'rescue'
    firing = false
    hurtFlash = 0
    shake = Math.max(shake, 8)
    burst(player.x, player.y - 16, 18, C.danger, 220)
    player.aim = -Math.PI / 2

    // The cutscene is safe: clear live fire and stop any pending bursts.
    bullets.length = 0
    bombs.length = 0
    for (const h of helis) {
      h.burst = 0
      h.charge = 0
      h.attackT = 0
    }

    const question = pickRescueQuestion()
    const hx = clamp(player.x + 40, 260, W - 260)
    const hy = Math.max(180, player.y - 190)
    rescue = {
      phase: 'swoop', t: 0,
      sx: W + 180, sy: -150,
      x: W + 180, y: -150,
      hx, hy, tilt: -0.45,
      question, picked: -1,
      panelT: 0,
      jetOn: [0, 0], jetOff: [p.random(0.05, 0.25), p.random(0.05, 0.25)], jetEmitT: 0,
      ani: 0, pull: 0, pullHold: 0, hidden: false,
      aniFireT: p.random(0.3, 0.7), aniFlash: 0, aniAim: -0.6, aniShots: [],
      pullFrom: { x: player.x, y: player.y }
    }
  }

  function answerRescue(i) {
    if (!rescue || rescue.phase !== 'ask' || rescue.panelT < 0.75) return
    rescue.picked = i
    rescue.t = 0
    if (i === rescue.question.answer) {
      rescue.phase = 'correct'
      burst(player.x, player.y - 16, 16, C.cyan, 220)
    } else {
      rescue.phase = 'wrong'
      rescue.panelT = 0
    }
  }

  function endRescue(ok) {
    if (ok) {
      rescued = true
      mode = 'over'
      firing = false
      shake = 6
      recordBest()
    } else {
      die()
    }
  }

  function rescueCameraTarget() {
    const r = rescue
    if (!r) return { zoom: 1, x: W / 2, y: H / 2 }
    if (r.phase === 'swoop') {
      return {
        zoom: 1.35,
        x: player.x * 0.65 + r.x * 0.35,
        y: player.y * 0.65 + r.y * 0.35 - 40
      }
    }
    if (r.phase === 'fly' || (r.phase === 'wrong' && r.t > 1.8)) {
      return { zoom: 1, x: W / 2, y: H / 2 }
    }
    // Close-up: put the truck in the upper third of the frame.
    return { zoom: 2, x: r.x, y: r.y + (H / 2 - 150) / 2 }
  }

  function updateRescueCamera(dt) {
    const target = rescueCameraTarget()
    const k = 1 - Math.pow(0.02, dt)
    camera.zoom += (target.zoom - camera.zoom) * k
    camera.x += (target.x - camera.x) * k
    camera.y += (target.y - camera.y) * k
  }

  function updateRescue(dt) {
    const r = rescue
    if (!r) return
    animT += dt
    r.t += dt
    updateParticles(dt)
    updateTruckPuffs(dt)
    updateTruckJets(r, dt)
    updateHelis(dt, false)
    updateAniGunner(r, dt)
    shake = Math.max(0, shake - shake * 9 * dt)
    updateRescueCamera(dt)

    if (r.phase === 'swoop') {
      const k = clamp(r.t / 1.2, 0, 1)
      const e = 1 - Math.pow(1 - k, 3)
      r.x = r.sx + (r.hx - r.sx) * e
      r.y = r.sy + (r.hy - r.sy) * e
      r.tilt = -0.45 * (1 - e)
      if (k >= 1) {
        r.phase = 'greet'
        r.t = 0
        r.jetOn = [p.random(0.15, 0.25), p.random(0.15, 0.25)]
        r.jetOff = [0, 0]
        r.jetEmitT = 0
      }
    } else if (r.phase === 'greet') {
      r.x = r.hx
      r.y = r.hy
      r.tilt = Math.sin(r.t * 2.6) * 0.02
      if (r.t >= 1.5) {
        r.phase = 'ask'
        r.t = 0
        r.panelT = 0
      }
    } else if (r.phase === 'ask') {
      r.x = r.hx
      r.y = r.hy
      r.tilt = Math.sin(r.t * 2.6) * 0.02
      r.panelT = Math.min(1, r.panelT + dt * 6)
    } else if (r.phase === 'correct') {
      r.x = r.hx
      r.y = r.hy
      r.tilt = 0
      if (r.t > 0.4) {
        r.phase = 'grab'
        r.t = 0
        r.ani = 0
        r.pull = 0
        r.pullHold = 0
        r.pullFrom = { x: player.x, y: player.y }
      }
    } else if (r.phase === 'grab') {
      r.x = r.hx
      r.y = r.hy
      r.tilt = 0
      if (r.ani < 1) {
        r.ani = Math.min(1, r.ani + dt / 0.5)
      } else if (r.pull < 1) {
        r.pull = Math.min(1, r.pull + dt / 0.9)
        const e = r.pull < 0.5
          ? 2 * r.pull * r.pull
          : 1 - Math.pow(-2 * r.pull + 2, 2) / 2
        const toX = r.x + 34
        const toY = r.y + 2
        player.x = r.pullFrom.x + (toX - r.pullFrom.x) * e
        player.y = r.pullFrom.y + (toY - r.pullFrom.y) * e - Math.sin(e * Math.PI) * 22
      } else {
        r.pullHold += dt
        if (r.pullHold > 0.25) {
          r.hidden = true
          r.phase = 'fly'
          r.t = 0
        }
      }
    } else if (r.phase === 'fly') {
      r.tilt = 0.28
      r.x += 620 * dt
      r.y -= 540 * dt
      if (r.y < -300 || r.x > W + 340) endRescue(true)
    } else if (r.phase === 'wrong') {
      if (r.t > 1.8) {
        r.tilt = 0.3
        r.x += 900 * dt
        r.y -= 220 * dt
        if (r.x > W + 340 || r.y < -300) endRescue(false)
      } else {
        r.x = r.hx
        r.y = r.hy
        r.tilt = 0
      }
    }
  }

  function wrapLines(text, maxW) {
    const words = String(text).split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (!line || p.textWidth(test) <= maxW) line = test
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // --------------------------------------------------------------- bullets
  function nearestHeli(x, y) {
    let best = null
    let bd = Infinity
    for (const h of helis) {
      const d = dist(x, y, h.x, h.y)
      if (d < bd) { bd = d; best = h }
    }
    return best
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]
      b.life -= dt

      const pvx = b.vx
      const pvy = b.vy

      // Heat-seeking: steer toward the locked chopper, then keep accelerating.
      if (b.homing) {
        if (b.target && helis.indexOf(b.target) === -1) b.target = null
        if (!b.target) b.target = nearestHeli(b.x, b.y)
        b.arm = (b.arm || 0) - dt
        let speed = Math.hypot(b.vx, b.vy)
        let ang = Math.atan2(b.vy, b.vx)
        if (b.target && b.arm <= 0) {
          const want = Math.atan2(b.target.y - b.y, b.target.x - b.x)
          let diff = want - ang
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          ang += clamp(diff, -b.turn * dt, b.turn * dt)
        }
        speed = Math.min(b.maxSpeed, speed + b.accel * dt)
        b.vx = Math.cos(ang) * speed
        b.vy = Math.sin(ang) * speed

        // Exhaust smoke, puffed from the tail in the flamethrower's style.
        b.smokeT = (b.smokeT || 0) - dt
        if (b.smokeT <= 0) {
          b.smokeT = 0.022
          const ux = Math.cos(ang)
          const uy = Math.sin(ang)
          const life = p.random(0.4, 0.65)
          particles.push({
            x: b.x - ux * 9 + p.random(-1.5, 1.5),
            y: b.y - uy * 9 + p.random(-1.5, 1.5),
            vx: -ux * 22 + p.random(-10, 10),
            vy: -uy * 22 + p.random(-10, 10) - 10,
            life, max: life, size: 4, grow: 14,
            color: C.muted, round: true, grav: -25, drag: 0.6
          })
        }
      }

      if (b.drag < 1) {
        const k = Math.pow(b.drag, dt * 60)
        b.vx *= k
        b.vy *= k
      }
      b.x += b.vx * dt
      b.y += b.vy * dt

      if (b.homing && dt > 0) {
        const k = Math.min(1, dt * 10)
        b.ax += ((b.vx - pvx) / dt - b.ax) * k
        b.ay += ((b.vy - pvy) / dt - b.ay) * k
      }

      let done = b.life <= 0 || b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50
      let hitHeli = null

      if (!done && b.y > GROUND_Y - 2) done = true

      if (!done && b.own) {
        for (let k = helis.length - 1; k >= 0; k--) {
          const h = helis[k]
          if (dist(b.x, b.y, h.x, h.y) < h.r * 0.95 + b.r) {
            damageHeli(h, b.dmg)
            if (b.counts) hits++
            hitHeli = h
            done = true
            break
          }
        }
      } else if (!done) {
        const cx = clamp(b.x, player.x - player.w / 2, player.x + player.w / 2)
        const cy = clamp(b.y, player.y - player.h, player.y)
        if (dist(b.x, b.y, cx, cy) < b.r + 2) {
          damagePlayer(b.dmg)
          done = true
        }
      }

      if (done) {
        if (b.splash) explode(b.x, b.y, b.splashR, b.splash, hitHeli)
        else burst(b.x, b.y, 2, b.color, 60)
        bullets.splice(i, 1)
      }
    }
  }

  function explode(x, y, radius, dmg, skip) {
    shake = Math.max(shake, 6)
    flameBurst(x, y, 16)
    burst(x, y, 6, C.ink, 150)
    for (let k = helis.length - 1; k >= 0; k--) {
      const h = helis[k]
      if (h === skip) continue
      const d = dist(x, y, h.x, h.y)
      if (d < radius + h.r) {
        const falloff = clamp(1 - d / (radius + h.r), 0.35, 1)
        damageHeli(h, dmg * falloff)
      }
    }
  }

  // The flamethrower's look — orange fading circles — as a short impact burst.
  function flameBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = p.random(p.TWO_PI)
      const s = p.random(120, 260)
      const life = p.random(0.25, 0.5)
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life, max: life,
        size: p.random(4, 8), grow: 10,
        color: i % 4 === 0 ? C.ink : C.flame,
        round: true, grav: 220
      })
    }
  }

  // ----------------------------------------------------------------- helis
  function difficulty() {
    return Math.min(1 + (Math.max(1, waveIndex) - 1) * 0.16, 5)
  }

  // The roster opens up with each wave.
  function pickEnemyType() {
    const w = Math.max(1, waveIndex)
    const r = p.random()
    const nightOK = w >= 7 && !helis.some(h => h.type === 'nighthawk')
    if (w >= 9) {
      if (nightOK && r < 0.15) return 'nighthawk'
      if (r < 0.40) return 'bomber'
      if (r < 0.70) return 'heavy'
      return 'scout'
    }
    if (w >= 7) {
      if (nightOK && r < 0.10) return 'nighthawk'
      if (r < 0.35) return 'bomber'
      if (r < 0.65) return 'heavy'
      return 'scout'
    }
    if (w >= 5) {
      if (r < 0.25) return 'bomber'
      if (r < 0.55) return 'heavy'
      return 'scout'
    }
    if (w >= 3) {
      if (r < 0.12) return 'bomber'
      if (r < 0.35) return 'heavy'
      return 'scout'
    }
    if (w >= 2 && r < 0.2) return 'heavy'
    return 'scout'
  }

  function spawnHeli(forcedType) {
    const type = forcedType || pickEnemyType()
    const def = ENEMIES[type]
    const fromLeft = p.random() < 0.5
    helis.push({
      type,
      x: fromLeft ? -90 : W + 90,
      y: p.random(def.alt[0], def.alt[1]),
      vx: 0, vy: 0,
      dir: fromLeft ? 1 : -1,
      r: def.r,
      heavy: type === 'heavy',
      hp: def.hp, maxHp: def.hp,
      phase: p.random(100),
      rotor: p.random(10),
      fireT: p.random(0.9, 1.8),
      burst: 0,
      burstT: 0,
      anchorT: 0,
      tx: W / 2, ty: 190,
      ax: 0, ay: 0, tilt: 0,
      seed: p.random(1000),
      tailRotor: p.random(10),
      armed: false,
      seen: false,
      armT: 0,
      attackT: 0,
      hit: 0
    })
  }

  function spawnBoss() {
    bossNumber++
    const def = ENEMIES.gunship
    const hp = def.hp + (bossNumber - 1) * 900
    helis.push({
      type: 'gunship',
      x: W + 180, y: 165, vx: -80, vy: 0,
      dir: -1, r: def.r, heavy: true,
      hp, maxHp: hp,
      phase: p.random(10), rotor: p.random(10),
      fireT: 2.4, burst: 0, burstT: 0,
      anchorT: 0, tx: W / 2, ty: 165,
      ax: 0, ay: 0, tilt: 0,
      seed: p.random(1000), tailRotor: p.random(10),
      armed: false, seen: true, armT: 0, hit: 0,
      charge: 0, pattern: -1, enraged: false
    })
  }

  function updateGunship(h, dt, shoot = true) {
    h.rotor += dt * 20
    h.tailRotor = (h.tailRotor || 0) + dt * 46
    h.hit = Math.max(0, h.hit - dt)
    h.phase += dt
    if (!h.enraged && h.hp <= h.maxHp * 0.35) h.enraged = true

    const pvx = h.vx
    const pvy = h.vy
    const tx = W / 2 + Math.sin(h.phase * 0.35) * 250
    const ty = 165 + Math.sin(h.phase * 0.7) * 18
    h.vx += ((tx - h.x) * 0.55 - h.vx * 1.1) * dt
    h.vy += ((ty - h.y) * 0.9 - h.vy * 1.4) * dt
    h.x += h.vx * dt
    h.y += h.vy * dt
    h.dir = h.vx > 6 ? 1 : h.vx < -6 ? -1 : h.dir
    h.tilt += (clamp(h.vx * 0.0015, -0.2, 0.2) - h.tilt) * Math.min(1, dt * 8)

    if (dt > 0) {
      const k = Math.min(1, dt * 8)
      h.ax += ((h.vx - pvx) / dt - h.ax) * k
      h.ay += ((h.vy - pvy) / dt - h.ay) * k
    }

    if (!h.armed && h.x < W - 120) h.armed = true
    if (!shoot) return
    if (!h.armed) return

    if (h.charge > 0) {
      h.charge -= dt
      if (h.charge <= 0) fireGunship(h)
    } else {
      h.fireT -= dt
      if (h.fireT <= 0) {
        h.pattern = (h.pattern + 1) % 3
        h.charge = h.enraged ? 0.65 : 0.95
        h.fireT = (h.enraged ? 2.6 : 3.8) + h.charge
      }
    }
  }

  function fireGunship(h) {
    const base = Math.atan2(player.y - 18 - h.y, player.x - h.x)

    if (h.pattern === 0) {
      // Missile salvo.
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.16
        bullets.push({
          x: h.x, y: h.y + 22,
          vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
          life: 4.5, dmg: 16, r: 5, color: C.danger,
          splash: 0, splashR: 0, drag: 1, own: false, counts: false
        })
      }
    } else if (h.pattern === 1) {
      // Bomb carpet with telegraphed impact rings.
      for (const off of [-1.5, -0.5, 0.5, 1.5]) {
        bombs.push({
          x: clamp(player.x + off * 55, 50, W - 50),
          y: h.y + 26, vx: 0, vy: 70, r: 8, life: 6
        })
      }
    } else {
      // Minigun fan.
      const n = h.enraged ? 7 : 5
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.075 + p.random(-0.02, 0.02)
        bullets.push({
          x: h.x + Math.cos(a) * h.r * 0.8,
          y: h.y + Math.sin(a) * h.r * 0.5,
          vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          life: 4, dmg: 10, r: 3.5, color: C.danger,
          splash: 0, splashR: 0, drag: 1, own: false, counts: false
        })
      }
    }
    shake = Math.max(shake, 3)
  }

  function onBossKilled(h) {
    score += 2500
    addPopup('GUNSHIP DOWN +2500', h.x, h.y - 20, C.force, 20)
    const x = clamp(h.x, 90, W - 90)
    pickups.push({
      x: x - 34, y: GROUND_Y - 10, type: 'health', weapon: null,
      life: 35, landed: true, t: 0
    })
    const type = powerupIndex++ % 2 === 0 ? 'shield' : 'overdrive'
    pickups.push({
      x: x + 34, y: GROUND_Y - 10, type, weapon: null,
      life: 35, landed: true, t: 0
    })
  }

  function updateHelis(dt, shoot = true) {
    const d = difficulty()
    const maxShooters = player.hp < player.maxHp * 0.35 ? 1 : (waveIndex >= 5 ? 3 : 2)
    let active = 0
    for (const x of helis) {
      if (x.type !== 'gunship' && (x.attackT || 0) > 0) active++
    }

    for (let i = helis.length - 1; i >= 0; i--) {
      const h = helis[i]
      if (h.type === 'gunship') {
        updateGunship(h, dt, shoot)
        continue
      }
      h.rotor += dt * 26
      h.tailRotor = (h.tailRotor || 0) + dt * 55
      h.hit = Math.max(0, h.hit - dt)
      h.phase += dt
      h.attackT = Math.max(0, (h.attackT || 0) - dt)

      const def = ENEMIES[h.type]
      h.anchorT -= dt
      if (h.anchorT <= 0) {
        h.anchorT = p.random(def.anchor[0], def.anchor[1])
        h.tx = clamp(player.x + p.random(-def.travel, def.travel), 90, W - 90)
        h.ty = p.random(def.hover[0], def.hover[1])
      }

      const bob = Math.sin(h.phase * 1.7) * 16
      const ax = (h.tx - h.x) * 1.8
      const ay = (h.ty + bob - h.y) * 2.2
      const maxA = 260 + d * 45
      const spd = ENEMIES[h.type].speed
      const axMax = maxA * spd
      const pvx = h.vx
      const pvy = h.vy
      h.vx = clamp(h.vx + clamp(ax, -axMax, axMax) * dt, -axMax * 0.6, axMax * 0.6)
      h.vy = clamp(h.vy + clamp(ay, -maxA, maxA) * dt, -220, 220)
      h.vx *= 1 - 1.8 * dt
      h.vy *= 1 - 1.8 * dt
      h.x += h.vx * dt
      h.y += h.vy * dt
      h.dir = h.vx > 8 ? 1 : h.vx < -8 ? -1 : h.dir

      // Guns stay cold until the chopper has been on screen for three seconds,
      // so it can't snipe from the edge at a shallow angle. Once armed it
      // stays armed.
      if (!h.seen && h.x > 0 && h.x < W) h.seen = true
      if (h.seen) h.armT += dt
      if (!h.armed && h.armT >= 3) h.armed = true

      // Measured acceleration drives both the force arrows and the bank.
      if (dt > 0) {
        const k = Math.min(1, dt * 12)
        h.ax += ((h.vx - pvx) / dt - h.ax) * k
        h.ay += ((h.vy - pvy) / dt - h.ay) * k
      }
      h.tilt += (clamp(h.ax * 0.0012, -0.35, 0.35) - h.tilt) * Math.min(1, dt * 10)

      if (h.armed && shoot) {
        if (h.burst > 0) {
          h.attackT = Math.max(h.attackT, 0.25)
          h.burstT -= dt
          if (h.burstT <= 0) {
            fireHeli(h, d, h.type === 'nighthawk' ? 6 : 12)
            h.burst--
            h.burstT = h.type === 'nighthawk' ? 0.09 : 0.13
          }
        }

        h.fireT -= dt
        if (h.fireT <= 0) {
          if (active < maxShooters) {
            active++
            h.attackT = 1.3
            if (h.type === 'heavy') {
              h.burst = 3
              h.burstT = 0
            } else if (h.type === 'nighthawk') {
              h.burst = 8
              h.burstT = 0
            } else if (h.type === 'bomber') {
              dropBomb(h)
            } else {
              fireHeli(h, d)
            }
            const gap = clamp(2.5 - d * 0.25, 0.9, 2.5) + p.random(0, 0.6)
            h.fireT = h.type === 'nighthawk' ? gap * 2 : gap
          } else {
            h.fireT = p.random(0.35, 0.8)
          }
        }
      }
    }
  }

  function fireHeli(h, d, dmg = 12) {    const err = clamp(0.19 - d * 0.032, 0.032, 0.19)
    const lead = clamp((d - 1) / 3, 0, 0.8)
    const tx = player.x + player.vx * lead * 0.22
    const ty = player.y - 18 + player.vy * lead * 0.12
    const a = Math.atan2(ty - h.y, tx - h.x) + p.random(-err, err)
    const sp = 400 + d * 28
    bullets.push({
      x: h.x + Math.cos(a) * h.r * 0.8,
      y: h.y + Math.sin(a) * h.r * 0.5,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 4,
      dmg,
      r: 3.5,
      color: C.danger,
      splash: 0,
      splashR: 0,
      drag: 1,
      own: false,
      counts: false
    })
  }

  // ---------------------------------------------------------------- bombs
  const BOMB_G = 950
  const BOMB_FRAC = 0.28

  function dropBomb(h) {
    bombs.push({
      x: h.x,
      y: h.y + h.r * 0.5,
      vx: h.vx * 0.25,
      vy: 40,
      r: 8,
      life: 6
    })
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i]
      b.life -= dt
      b.vy += BOMB_G * dt   // free fall: gravity only, no drag
      const prev = b.y
      b.x += b.vx * dt
      b.y += b.vy * dt

      let hit = b.y + b.r >= GROUND_Y
      if (!hit) {
        for (const pl of PLATFORMS) {
          if (b.x > pl.x && b.x < pl.x + pl.w && prev + b.r <= pl.y + 2 && b.y + b.r >= pl.y) {
            hit = true
            break
          }
        }
      }

      if (hit) {
        bombBlast(b.x, Math.min(b.y, GROUND_Y))
        bombs.splice(i, 1)
      } else if (b.life <= 0 || b.x < -60 || b.x > W + 60) {
        bombs.splice(i, 1)
      }
    }
  }

  function bombBlast(x, y) {
    shake = Math.max(shake, 9)
    flameBurst(x, y, 20)
    burst(x, y, 8, C.ink, 220)
    if (dist(x, y, player.x, player.y - 16) < 70) {
      damagePlayer(Math.round(player.maxHp * BOMB_FRAC))
    }
  }

  function drawBombs() {
    for (const b of bombs) {
      // Telegraphed impact ring on the surface below.
      let impactY = GROUND_Y
      for (const pl of PLATFORMS) {
        if (b.x > pl.x && b.x < pl.x + pl.w && pl.y >= b.y && pl.y < impactY) impactY = pl.y
      }
      const drop = clamp(1 - (impactY - b.y) / 420, 0.15, 1)
      p.noFill()
      p.stroke(185, 28, 28, 80 + 130 * drop)
      p.strokeWeight(2)
      p.circle(b.x, impactY - 3, 42 - drop * 14)
      p.stroke(185, 28, 28, 60 + 80 * drop)
      p.strokeWeight(1)
      p.line(b.x, b.y + b.r, b.x, impactY - 10)

      p.push()
      p.translate(b.x, b.y)
      p.noStroke()
      p.fill(...C.ink)
      p.circle(0, 0, b.r * 2)
      p.triangle(-b.r + 1, -2, -b.r - 4, -7, -b.r + 1, 3)
      p.triangle(b.r - 1, -2, b.r + 4, -7, b.r - 1, 3)
      p.fill(...C.flame)
      p.circle(0, -b.r - 3, 3 + Math.sin(animT * 54) * 1.2)
      p.pop()
    }
    p.noStroke()
  }

  function damageHeli(h, dmg) {
    if (h.hp <= 0) return
    h.hp -= dmg
    h.hit = 0.1
    if (h.hp <= 0) killHeli(h)
  }

  function killHeli(h) {
    const idx = helis.indexOf(h)
    if (idx === -1) return
    helis.splice(idx, 1)
    kills++

    combo++
    comboT = COMBO_TIME
    const mult = comboMult()
    const earned = Math.round(ENEMIES[h.type].points * mult)
    score += earned
    addPopup(`+${earned}`, h.x, h.y - 12, mult > 1 ? C.accent : C.ink, mult >= 3 ? 19 : 15)

    shake = Math.max(shake, h.r >= 38 ? 10 : 6)
    burst(h.x, h.y, h.r >= 38 ? 26 : 16, C.ink, 300)
    burst(h.x, h.y, 10, C.accent, 220)

    if (h.type === 'gunship') {
      onBossKilled(h)
      return
    }
    maybeDrop(h)
  }

  function maybeDrop(h) {
    // Supplies arrive by parachute now; kills only call the plane in.
    if (kills % 3 === 0) callSupply()
  }

  // --------------------------------------------------------- supply planes
  function callSupply() {
    if (planeCooldown > 0 || planes.length) return
    const fromLeft = p.random() < 0.5
    planes.push({
      x: fromLeft ? -150 : W + 150,
      y: 86,
      vx: (fromLeft ? 1 : -1) * 190,
      dropX: p.random(210, 750),
      dropped: false,
      prop: 0,
      seed: p.random(1000)
    })
    planeCooldown = SUPPLY_COOLDOWN
    supplyT = SUPPLY_FALLBACK
  }

  function updatePlanes(dt) {
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i]
      pl.x += pl.vx * dt
      pl.prop += dt * 40

      const passed = pl.vx > 0 ? pl.x >= pl.dropX : pl.x <= pl.dropX
      if (!pl.dropped && passed) {
        pl.dropped = true
        dropCrate(pl)
      }
      if (pl.x < -220 || pl.x > W + 220) planes.splice(i, 1)
    }
  }

  function hasPickupType(type) {
    return pickups.some(it => it.type === type) || crates.some(c => c.type === type)
  }

  function dropCrate(pl) {
    let type
    const lowHealth = player.hp <= player.maxHp * 0.35
    const forceHealth = healthDropCd <= 0 && lowHealth && !hasPickupType('health')
    const forceWeapon = pistolOnlyT > 20 && !hasPickupType('weapon')

    if (forceWeapon) {
      type = 'weapon'
      pistolOnlyT = 0
    } else if (forceHealth) {
      type = 'health'
      healthDropCd = 15
    } else if (dropIndex % 6 === 5) {
      type = powerupIndex++ % 2 === 0 ? 'shield' : 'overdrive'
    } else if (dropIndex % 3 === 2) {
      type = 'health'
    } else {
      type = 'weapon'
    }

    let weaponName = null
    if (type === 'weapon') {
      weaponName = ['shotgun', 'rocket', 'flame'][weaponDrop % 3]
      weaponDrop++
    }
    dropIndex++

    crates.push({
      x: pl.x,
      y: pl.y + 24,
      vx: pl.vx * 0.25,
      vy: 0,
      type,
      weapon: weaponName,
      dragMag: 0,
      life: 40,
      t: p.random(10)
    })
  }

  function updateCrates(dt) {
    for (let i = crates.length - 1; i >= 0; i--) {
      const c = crates[i]
      c.life -= dt
      c.t += dt

      // Quadratic drag: acceleration falls to zero at terminal velocity.
      const sp = Math.hypot(c.vx, c.vy)
      c.dragMag = CRATE_K * sp * sp
      c.vx += -CRATE_K * sp * c.vx * dt
      c.vy += (CRATE_G - CRATE_K * sp * c.vy) * dt

      const prev = c.y
      c.x += c.vx * dt
      c.y += c.vy * dt

      let landed = false
      if (c.y >= GROUND_Y - 10) {
        c.y = GROUND_Y - 10
        landed = true
      } else {
        for (const pl of PLATFORMS) {
          if (c.x > pl.x && c.x < pl.x + pl.w && prev <= pl.y - 10 && c.y >= pl.y - 10) {
            c.y = pl.y - 10
            landed = true
          }
        }
      }

      if (landed) {
        pickups.push({
          x: c.x, y: c.y, type: c.type, weapon: c.weapon,
          life: 30, landed: true, t: 0
        })
        crates.splice(i, 1)
        continue
      }
      if (c.life <= 0 || c.x < -60 || c.x > W + 60) crates.splice(i, 1)
    }
  }

  // --------------------------------------------------------------- pickups
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const it = pickups[i]
      it.life -= dt
      it.t += dt

      if (!it.landed) {
        it.vy = Math.min(it.vy + 900 * dt, 520)
        const prev = it.y
        it.y += it.vy * dt

        if (it.y >= GROUND_Y - 10 && it.vy >= 0) {
          it.y = GROUND_Y - 10
          it.vy = 0
          it.landed = true
        } else if (it.vy >= 0) {
          for (const pl of PLATFORMS) {
            if (it.x > pl.x && it.x < pl.x + pl.w && prev <= pl.y && it.y >= pl.y - 10) {
              it.y = pl.y - 10
              it.vy = 0
              it.landed = true
            }
          }
        }
      }

      if (dist(it.x, it.y, player.x, player.y - 16) < 32) {
        collect(it)
        pickups.splice(i, 1)
        continue
      }
      if (it.life <= 0) pickups.splice(i, 1)
    }
  }

  function collect(it) {
    if (it.type === 'health') {
      player.hp = Math.min(player.maxHp, player.hp + 40)
      addPopup('+40 HP', it.x, it.y - 8, C.good, 15)
      burst(it.x, it.y, 8, C.good, 120)
      return
    }
    if (it.type === 'shield') {
      player.shieldT = SHIELD_TIME
      addPopup('SHIELD', it.x, it.y - 8, C.cyan, 17)
      burst(it.x, it.y, 14, C.cyan, 160)
      return
    }
    if (it.type === 'overdrive') {
      player.overdriveT = OVERDRIVE_TIME
      addPopup('OVERDRIVE', it.x, it.y - 8, [217, 119, 6], 17)
      burst(it.x, it.y, 14, [250, 204, 21], 160)
      return
    }
    const w = WEAPONS[it.weapon]
    if (isFinite(ammo[it.weapon])) {
      ammo[it.weapon] = Math.min(w.cap, ammo[it.weapon] + w.max)
    }
    addPopup(w.short.toUpperCase(), it.x, it.y - 8, C.accent, 15)
    spawnFlyer(it.weapon, it.x, it.y)
    burst(it.x, it.y, 8, C.accent, 120)
  }

  // The pickup icon arcs into its HUD capsule; the capsule flashes on arrival.
  function spawnFlyer(name, x, y) {
    const r = capsuleRect(CAP_ORDER.indexOf(name))
    flyers.push({
      sx: x, sy: y,
      tx: r.x + r.w / 2, ty: r.y + r.h / 2,
      t: 0, dur: 0.45, name
    })
  }

  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]
      f.t += dt
      if (f.t >= f.dur) {
        hudFlash[f.name] = 0.6
        flyers.splice(i, 1)
      }
    }
    for (const k in hudFlash) hudFlash[k] = Math.max(0, hudFlash[k] - dt)
  }

  function drawFlyers() {
    for (const f of flyers) {
      const k = clamp(f.t / f.dur, 0, 1)
      const e = 1 - Math.pow(1 - k, 3)
      const x = f.sx + (f.tx - f.sx) * e
      const y = f.sy + (f.ty - f.sy) * e - Math.sin(e * Math.PI) * 50
      p.push()
      p.translate(x, y)
      p.scale(0.72)
      drawCrateFace(0, 0, 'weapon', f.name)
      p.pop()
    }
  }

  // ------------------------------------------------------------- particles
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = p.random(Math.PI * 0.9, Math.PI * 2.1)
      particles.push({
        x: x + p.random(-8, 8), y: y - 4,
        vx: Math.cos(a) * p.random(20, 70), vy: Math.sin(a) * p.random(10, 50),
        life: p.random(0.2, 0.4), max: 0.4, size: p.random(2, 4), color: C.faint
      })
    }
  }

  function burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = p.random(p.TWO_PI)
      const s = p.random(speed * 0.25, speed)
      const life = p.random(0.3, 0.8)
      particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life, max: life, size: p.random(2, 5), color
      })
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i]
      q.life -= dt
      if (q.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      q.vy += (q.grav === undefined ? 900 : q.grav) * dt
      q.vx *= 1 - (q.drag === undefined ? 1.4 : q.drag) * dt
      if (q.grow) q.size += q.grow * dt
      q.x += q.vx * dt
      q.y += q.vy * dt
    }
  }

  // ----------------------------------------------------------------- waves
  function setBanner(text, sub, life = 2.2) {
    waveBanner = { text, sub, life, max: life }
  }

  function waveMaxHelis() {
    return Math.min(3 + Math.floor(waveIndex / 2), 5)
  }

  function waveSpawnGap() {
    return clamp(2.2 - (waveIndex - 1) * 0.1, 1.1, 2.2)
  }

  function beginWave(n) {
    waveIndex = n
    waveT = 0
    spawnT = 0.6
    if (n % BOSS_EVERY === 0) {
      wavePhase = 'boss'
      setBanner('WARNING', 'GUNSHIP MK-IV', 2.4)
      spawnBoss()
    } else {
      wavePhase = 'fight'
      waveT = WAVE_FIGHT
      setBanner(`WAVE ${n}`, n === 1 ? 'SURVIVE' : 'INCOMING', 2)
    }
  }

  function beginBreather(bossCleared) {
    wavePhase = 'breather'
    waveT = WAVE_BREATHER
    setBanner(bossCleared ? 'GUNSHIP DOWN' : 'WAVE CLEARED', 'SUPPLY INBOUND', 2.6)
    bullets = bullets.filter(b => b.own)
    bombs.length = 0
    planes.length = 0
    planeCooldown = 0
    callSupply()
    player.invuln = Math.max(player.invuln, 0.8)
  }

  function updateWaves(dt) {
    if (waveBanner) {
      waveBanner.life -= dt
      if (waveBanner.life <= 0) waveBanner = null
    }

    if (wavePhase === 'countdown') {
      waveT -= dt
      if (waveT <= 0) beginWave(1)
    } else if (wavePhase === 'fight') {
      waveT -= dt
      if (waveT <= 0 && helis.length === 0) beginBreather(false)
    } else if (wavePhase === 'breather') {
      waveT -= dt
      if (waveT <= 0) beginWave(waveIndex + 1)
    } else if (wavePhase === 'boss') {
      if (!helis.some(h => h.type === 'gunship')) beginBreather(true)
    }
  }

  function spawnTick(dt) {
    if (wavePhase !== 'fight' || waveT <= 0) return
    spawnT -= dt
    if (spawnT <= 0 && helis.length < waveMaxHelis()) {
      spawnHeli()
      spawnT = waveSpawnGap()
    }
  }

  function update(dt) {
    elapsed += dt
    animT += dt
    updatePlayer(dt)
    tryFire(dt)
    updateBullets(dt)
    updateHelis(dt)
    updatePlanes(dt)
    updateCrates(dt)
    updatePickups(dt)
    updateFlyers(dt)
    updateBombs(dt)
    updateParticles(dt)
    updatePopups(dt)
    updateWaves(dt)
    spawnTick(dt)

    supplyT -= dt
    planeCooldown = Math.max(0, planeCooldown - dt)
    if (supplyT <= 0) callSupply()

    player.invuln = Math.max(0, player.invuln - dt)
    player.invincible = Math.max(0, player.invincible - dt)
    player.flash = Math.max(0, player.flash - dt)
    player.shieldT = Math.max(0, player.shieldT - dt)
    player.overdriveT = Math.max(0, player.overdriveT - dt)
    healthDropCd = Math.max(0, healthDropCd - dt)

    comboT = Math.max(0, comboT - dt)
    if (comboT <= 0) combo = 0

    const armed = ammo.shotgun > 0 || ammo.rocket > 0 || ammo.flame > 0
    pistolOnlyT = armed ? 0 : pistolOnlyT + dt

    shake = Math.max(0, shake - shake * 9 * dt)
    hurtFlash = Math.max(0, hurtFlash - dt * 2.4)
  }

  // ---------------------------------------------------------------- render
  function applyCamera() {
    p.translate(W / 2, H / 2)
    p.scale(camera.zoom)
    p.translate(-camera.x, -camera.y)
  }

  function render() {
    p.background(...C.stage)
    p.noStroke()
    p.fill(...C.paper)
    p.rectMode(p.CORNER)
    p.rect(view.ox, view.oy, W * view.s, H * view.s)
    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.rectMode(p.CENTER)
    p.push()
    p.translate(view.ox, view.oy)
    p.scale(view.s)
    if (shake > 0.2) p.translate(p.random(-shake, shake), p.random(-shake, shake))
    p.rectMode(p.CENTER)

    p.push()
    applyCamera()
    drawBackdrop()
    drawPlatforms()
    drawPlanes()
    drawCrates()
    drawBombs()
    drawPickups()
    drawHelis()
    drawBullets()
    drawPlayer()
    drawParticles()
    drawPopups()
    p.pop()

    if (mode === 'rescue') {
      // Wash the frozen arena back, then draw the truck on top of the wash so
      // the close-up stays crisp.
      p.noStroke()
      p.fill(251, 251, 253, 80)
      p.rect(W / 2, H / 2, W, H)

      p.push()
      applyCamera()
      drawTruckPuffs()
      drawAniShots()
      drawRescueTruck()
      p.pop()
    }

    drawHud()
    if (mode === 'play') drawWaveBanner()
    if (mode === 'rescue') {
      drawRescueUI()
    } else {
      drawFlyers()
      drawOverlay()
    }

    p.pop()

    if (hurtFlash > 0.01) {
      p.noFill()
      p.stroke(185, 28, 28, 90 * hurtFlash)
      p.strokeWeight(10)
      p.rect(p.width / 2, p.height / 2, p.width, p.height)
      p.noStroke()
    }
  }

  function drawBackdrop() {
    p.noStroke()
    p.fill(...C.stage)
    p.rect(W / 2, GROUND_Y + (H - GROUND_Y) / 2, W, H - GROUND_Y)

    // Clouds: pale sketchy blobs instead of perfect circles.
    const cloud = [244, 246, 249]
    p.stroke(226, 233, 242)
    p.strokeWeight(1.3)
    for (const [cx, cy, w, h, seed] of [
      [140, 128, 130, 110, 11],
      [228, 108, 90, 78, 12],
      [806, 168, 104, 88, 13]
    ]) {
      strokeBlob(fillBlob(cx, cy, w, h, cloud, seed, 3.4), seed, 3.4)
    }

    // Mountain silhouette: jittered ridge, filled, then stroked by hand.
    const ridge = [
      [0, 470], [180, 396], [360, 486], [560, 408], [740, 492], [960, 420]
    ]
    p.noStroke()
    p.fill(236, 240, 245)
    p.beginShape()
    p.vertex(0, GROUND_Y)
    for (let i = 0; i < ridge.length; i++) {
      p.vertex(ridge[i][0] + jit(i * 3.1, 2.6), ridge[i][1] + jit(i * 3.7, 2.6))
    }
    p.vertex(W, GROUND_Y)
    p.endShape(p.CLOSE)

    p.stroke(212, 221, 232)
    p.strokeWeight(1.6)
    for (let i = 0; i < ridge.length - 1; i++) {
      roughLine(ridge[i][0], ridge[i][1], ridge[i + 1][0], ridge[i + 1][1], i * 5 + 3, 2.2)
    }
    p.noStroke()

    p.stroke(...C.line)
    p.strokeWeight(2)
    roughLine(0, GROUND_Y, W, GROUND_Y, 21, 1.3)
    p.noStroke()

    // ground hatch
    p.stroke(226, 231, 238)
    p.strokeWeight(1)
    for (let x = -40; x < W + 40; x += 34) roughLine(x, GROUND_Y + 6, x - 26, H, x, 0.7)
    p.noStroke()
  }

  function drawPlatforms() {
    for (const pl of PLATFORMS) {
      p.noStroke()
      p.fill(...C.panel)
      p.rect(pl.x + pl.w / 2, pl.y + pl.h / 2, pl.w, pl.h, 4)

      p.stroke(160, 172, 190)
      p.strokeWeight(1.4)
      roughRect(pl.x, pl.y, pl.w, pl.h, pl.x * 0.13 + pl.y, 1.05)

      p.stroke(255)
      p.strokeWeight(2)
      roughLine(pl.x + 6, pl.y + 2, pl.x + pl.w - 6, pl.y + 2, pl.x + 9, 0.5)
    }
    p.noStroke()
  }

  // Downed pose for the rescue event: flat on the ground, waiting for an
  // answer. The normal standing figure would read as still being in the fight.
  function drawDownedPlayer() {
    const cx = player.x
    const cy = player.y
    const seed = 520

    p.stroke(...C.ink)
    p.strokeWeight(3)
    roughLine(cx - 26, cy - 3, cx - 8, cy - 9, seed + 1, 0.4)
    roughLine(cx - 26, cy - 3, cx - 8, cy - 3, seed + 2, 0.4)

    p.strokeWeight(8)
    roughLine(cx - 8, cy - 7, cx + 9, cy - 7, seed + 3, 0.4)

    p.strokeWeight(3)
    roughLine(cx + 2, cy - 6, cx + 12, cy - 13, seed + 4, 0.4)
    roughLine(cx + 2, cy - 6, cx + 12, cy - 2, seed + 5, 0.4)

    fillBlob(cx + 18, cy - 9, 14, 14, C.ink, seed + 6, 0.6)
    p.noStroke()
    p.fill(...C.accent)
    p.circle(cx + 21, cy - 10, 4)
  }

  function drawCarriedPlayer() {
    const cx = player.x
    const cy = player.y
    const seed = 560
    const swing = Math.sin(animT * 21) * 3

    p.stroke(...C.ink)
    p.strokeWeight(3)
    roughLine(cx - 4, cy - 12, cx - 7 + swing, cy, seed + 1, 0.4)
    roughLine(cx + 4, cy - 12, cx + 7 - swing, cy, seed + 2, 0.4)
    roughLine(cx - 1, cy - 22, cx - 13, cy - 31, seed + 3, 0.4)
    roughLine(cx + 1, cy - 22, cx + 13, cy - 31, seed + 4, 0.4)

    p.strokeWeight(7)
    roughLine(cx, cy - 22, cx, cy - 11, seed + 5, 0.4)

    fillBlob(cx, cy - 29, 14, 14, C.ink, seed + 6, 0.6)
    p.noStroke()
    p.fill(...C.accent)
    p.circle(cx + 3, cy - 30, 4)
  }

  function drawPlayer() {
    if (mode === 'over') return
    if (mode === 'rescue') {
      if (!rescue || rescue.hidden) return
      if (rescue.phase === 'grab' && rescue.ani >= 1) drawCarriedPlayer()
      else drawDownedPlayer()
      return
    }
    if (player.invuln > 0 && Math.floor(player.invuln * 22) % 2 === 0) return

    const ax = Math.cos(player.aim)
    const ay = Math.sin(player.aim)
    const cx = player.x
    const cy = player.y
    const seed = 400

    // Dash afterimages.
    if (dashT > 0) {
      p.noStroke()
      p.fill(11, 87, 208, 55)
      p.rect(cx - dashDir * 16, cy - 16, 10, 26, 4)
      p.fill(11, 87, 208, 32)
      p.rect(cx - dashDir * 30, cy - 16, 9, 24, 4)
    }

    // legs
    p.stroke(...C.ink)
    p.strokeWeight(3)
    const run = player.onGround && Math.abs(player.vx) > 40 ? Math.sin(animT * 30) * 4 : 0
    roughLine(cx - 5, cy - 8, cx - 6 + run, cy, seed + 1, 0.5)
    roughLine(cx + 5, cy - 8, cx + 6 - run, cy, seed + 2, 0.5)

    // body: a slightly irregular slab
    const body = [
      [cx - 8, cy - 27], [cx + 8, cy - 27], [cx + 8, cy - 5], [cx - 8, cy - 5]
    ].map(([x, y], i) => [x + jit(seed + 10 + i, 0.7), y + jit(seed + 20 + i, 0.7)])
    fillPoly(body, C.ink)

    // head
    fillBlob(cx, cy - 32, 14, 14, C.ink, seed + 30, 0.6)

    p.fill(...C.accent)
    p.circle(cx + ax * 3.5, cy - 33 + ay * 3.5, 5)

    // gun last, so the barrel always reads against the figure
    p.stroke(255)
    p.strokeWeight(5)
    roughLine(cx + ax * 4, cy - 21 + ay * 4, cx + ax * 23, cy - 21 + ay * 23, seed + 40, 0.35)
    p.stroke(...C.ink)
    p.strokeWeight(3)
    roughLine(cx + ax * 4, cy - 21 + ay * 4, cx + ax * 23, cy - 21 + ay * 23, seed + 40, 0.35)

    if (player.flash > 0) {
      p.noStroke()
      p.fill(rgba(C.accent, 190 * (player.flash / 0.06)))
      p.circle(cx + ax * 28, cy - 20 + ay * 28, 13)
    }

    if (player.shieldT > 0) {
      p.noFill()
      p.stroke(6, 182, 212, 170 + Math.sin(animT * 9) * 40)
      p.strokeWeight(2)
      p.circle(cx, cy - 16, 48)
    }
    if (player.overdriveT > 0) {
      p.noFill()
      p.stroke(250, 204, 21, 150 + Math.sin(animT * 12) * 50)
      p.strokeWeight(2)
      p.circle(cx, cy - 16, 42)
    }
    p.noStroke()
  }

  function drawHelis() {
    for (const h of helis) drawHeli(h)
  }

  // Force arrows: weight is constant, lift tracks vertical acceleration, and
  // the horizontal arrow appears only while the chopper is accelerating.
  function heliForces(h) {
    const weight = h.r * 0.78
    return {
      weight,
      // ay is in screen space (down positive), so climbing means ay < 0.
      lift: weight * clamp(1 - h.ay / 300, 0.15, 2.2),
      thrust: clamp(Math.abs(h.ax) * 0.13, 0, 30)
    }
  }

  function arrow(x, y, ux, uy, len, color) {
    const ex = x + ux * len
    const ey = y + uy * len
    const head = Math.min(6, len * 0.5)
    p.stroke(...color)
    p.strokeWeight(1.6)
    p.line(x, y, ex, ey)
    p.line(ex, ey, ex - ux * head - uy * head * 0.5, ey - uy * head + ux * head * 0.5)
    p.line(ex, ey, ex - ux * head + uy * head * 0.5, ey - uy * head - ux * head * 0.5)
  }

  function drawHeliForces(h) {
    const f = heliForces(h)
    arrow(h.x, h.y - h.r * 1.05, 0, -1, f.lift, C.force)
    arrow(h.x, h.y + h.r * 0.8, 0, 1, f.weight, C.force)
    if (f.thrust > 3) {
      const s = h.ax < 0 ? -1 : 1
      arrow(h.x + s * h.r * 0.95, h.y, s, 0, f.thrust, C.force)
    }
  }

  function drawGunship(h) {
    const r = h.r
    const dir = h.dir || -1
    const seed = h.seed || 17
    p.push()
    p.translate(h.x, h.y)
    p.rotate(h.tilt)

    // Tail boom and tail rotor.
    p.stroke(...C.ink)
    p.strokeWeight(6)
    roughLine(-dir * r * 0.8, 0, -dir * r * 1.9, -r * 0.2, seed + 1, 0.5)
    p.strokeWeight(4)
    roughLine(-dir * r * 1.9, -r * 0.2, -dir * r * 2.05, -r * 0.58, seed + 2, 0.4)
    roughLine(-dir * r * 1.9, -r * 0.2, -dir * r * 1.72, r * 0.08, seed + 3, 0.4)
    p.strokeWeight(2)
    const tr = r * 0.28
    for (let k = 0; k < 2; k++) {
      const a = (h.tailRotor || 0) + k * Math.PI / 2
      p.line(
        -dir * r * 1.9 + Math.cos(a) * tr, -r * 0.2 + Math.sin(a) * tr,
        -dir * r * 1.9 - Math.cos(a) * tr, -r * 0.2 - Math.sin(a) * tr
      )
    }

    // Twin rotor masts and blades.
    const wob = Math.sin(h.rotor) * 4
    p.strokeWeight(4)
    roughLine(-r * 0.45, -r * 0.42, -r * 0.45, -r * 0.85, seed + 4, 0.4)
    roughLine(r * 0.45, -r * 0.42, r * 0.45, -r * 0.85, seed + 5, 0.4)
    p.strokeWeight(5)
    roughLine(-r * 1.3, -r * 0.9 + wob, -r * 0.04, -r * 0.9 - wob, seed + 6, 0.6)
    roughLine(r * 0.04, -r * 0.9 + wob, r * 1.3, -r * 0.9 - wob, seed + 7, 0.6)

    // Angular armored hull.
    const hull = [
      [-1.0, 0.1], [-0.78, -0.38], [-0.32, -0.54], [0.42, -0.54],
      [0.88, -0.24], [1.05, 0.12], [0.86, 0.48], [-0.64, 0.5], [-1.0, 0.24]
    ].map(([x, y], i) => [x * r + jit(seed + 10 + i, 0.6), y * r + jit(seed + 20 + i, 0.6)])
    fillPoly(hull, h.hit > 0 ? C.danger : [198, 206, 218])
    p.stroke(...C.ink)
    p.strokeWeight(2)
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i]
      const b = hull[(i + 1) % hull.length]
      roughLine(a[0], a[1], b[0], b[1], seed + 30 + i, 0.4)
    }

    // Cockpit glass and side weapon pods.
    const cockpit = [
      [0.3, -0.42], [0.8, -0.28], [0.9, -0.02], [0.32, -0.05]
    ].map(([x, y], i) => [dir * x * r + jit(seed + 40 + i, 0.3), y * r + jit(seed + 50 + i, 0.3)])
    fillPoly(cockpit, C.charcoal)

    p.fill(...C.charcoal)
    p.rect(-r * 0.5, r * 0.44, r * 0.52, r * 0.26, 3)
    p.rect(r * 0.5, r * 0.44, r * 0.52, r * 0.26, 3)
    p.stroke(...C.ink)
    p.strokeWeight(3)
    roughLine(-r * 0.62, r * 0.56, -r * 0.62, r * 0.82, seed + 60, 0.4)
    roughLine(r * 0.62, r * 0.56, r * 0.62, r * 0.82, seed + 61, 0.4)

    // Red core, brighter while a pattern is charging.
    const pulse = h.charge > 0 ? 0.55 + 0.45 * Math.sin(animT * 21) : 0.6
    p.noStroke()
    p.fill(220, 38, 38, 190 * pulse)
    p.circle(0, r * 0.1, r * 0.3)
    if (h.charge > 0) {
      p.noFill()
      p.stroke(220, 38, 38, 80 + 120 * pulse)
      p.strokeWeight(2)
      p.circle(0, 0, r * 2.3 + pulse * 6)
    }

    p.noStroke()
    p.pop()

    drawHeliForces(h)
  }

  function drawHeli(h) {
    if (h.type === 'gunship') {
      drawGunship(h)
      return
    }
    const r = h.r
    const dir = h.dir || 1
    const seed = h.seed || 17
    p.push()
    p.translate(h.x, h.y)
    p.rotate(h.tilt)

    const wob = Math.sin(h.rotor) * 3.5
    p.stroke(...C.ink)
    if (h.type === 'bomber') {
      // Tandem rotors: two masts, two bars.
      p.strokeWeight(3)
      roughLine(-r * 0.6, -r * 0.5, -r * 0.6, -r * 0.85, seed + 1, 0.5)
      roughLine(r * 0.55, -r * 0.5, r * 0.55, -r * 0.85, seed + 2, 0.5)
      p.strokeWeight(4)
      roughLine(-r * 1.2, -r * 0.92 + wob, -r * 0.04, -r * 0.92 - wob, seed + 3, 0.5)
      roughLine(r * 0.04, -r * 0.92 + wob, r * 1.12, -r * 0.92 - wob, seed + 4, 0.5)
    } else {
      p.strokeWeight(3)
      roughLine(0, -r * 0.5, 0, -r * 0.85, seed + 1, 0.5)
      p.strokeWeight(4)
      roughLine(-r * 1.1, -r * 0.92 + wob, r * 1.1, -r * 0.92 - wob, seed + 2, 0.6)
    }

    if (h.type !== 'bomber') {
      p.strokeWeight(Math.max(3, r * 0.16))
      roughLine(-dir * r * 0.5, -r * 0.08, -dir * r * 1.28, -r * 0.34, seed + 3, 0.5)

      p.stroke(...C.ink)
      p.strokeWeight(2)
      strokeBlob(blobPoints(-dir * r * 1.34, -r * 0.34, r * 0.5, r * 0.5, seed + 4, 0.5), seed + 4, 0.5)

      // Tail rotor: four thin blades spinning fast enough to blur.
      const trx = -dir * r * 1.34
      const tryy = -r * 0.34
      const trr = r * 0.25
      p.strokeWeight(1.2)
      for (let b = 0; b < 2; b++) {
        const a0 = (h.tailRotor || 0) + b * Math.PI / 2
        for (let k = 0; k < 2; k++) {
          const a = a0 - k * 0.2
          p.stroke(rgba(C.ink, k === 0 ? 175 : 65))
          p.line(trx + Math.cos(a) * trr, tryy + Math.sin(a) * trr, trx - Math.cos(a) * trr, tryy - Math.sin(a) * trr)
        }
      }
      p.stroke(...C.ink)
    }
    if (h.type === 'bomber') {
      const bw = r * 2.27
      const bh = r * 1.05
      const pts = capsulePoints(bw, bh, seed + 5, 0.4, 7)
      fillPoly(pts.map(q => [q.x, q.y]), h.hit > 0 ? C.danger : C.panel)
      p.stroke(...C.ink)
      p.strokeWeight(2)
      strokeBlob(pts, seed + 5, 0.45)
      fillBlob(dir * r * 0.58, -r * 0.02, r * 0.4, r * 0.28, C.ink, seed + 6, 0.25)
    } else if (h.type === 'nighthawk') {
      const pts = [
        [1.15, -0.02], [0.5, -0.34], [-0.7, -0.42], [-1.05, -0.12],
        [-0.95, 0.3], [0.35, 0.38], [0.9, 0.18]
      ].map(([x, y], i) => [dir * r * x + jit(seed + 50 + i, 0.5), r * y + jit(seed + 60 + i, 0.5)])
      fillPoly(pts, h.hit > 0 ? C.danger : C.charcoal)
      p.stroke(...C.ink)
      p.strokeWeight(2)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        roughLine(a[0], a[1], b[0], b[1], seed + 70 + i, 0.35)
      }
      const cp = [
        [0.62, -0.16], [0.3, -0.26], [0.24, -0.02], [0.58, 0.06]
      ].map(([x, y], i) => [dir * r * x + jit(seed + 80 + i, 0.25), r * y + jit(seed + 90 + i, 0.25)])
      fillPoly(cp, [205, 212, 222])
    } else {
      const body = fillBlob(0, 0, h.type === 'nighthawk' ? r * 2.2 : r * 1.8, r, h.hit > 0 ? C.danger : C.panel, seed + 5, 0.7)
      p.stroke(...C.ink)
      p.strokeWeight(2)
      strokeBlob(body, seed + 5, 0.7)
      fillBlob(dir * r * 0.46, -r * 0.04, r * 0.52, r * 0.36, C.ink, seed + 6, 0.35)
    }

    if (h.type === 'nighthawk') {
      // Chin-mounted machine gun.
      p.stroke(...C.ink)
      p.strokeWeight(2)
      p.line(dir * r * 0.45, r * 0.42, dir * r * 1.0, r * 0.42)
    }

    p.stroke(...C.ink)
    p.strokeWeight(2)
    roughLine(-r * 0.55, r * 0.5, -r * 0.55, r * 0.74, seed + 7, 0.4)
    roughLine(r * 0.55, r * 0.5, r * 0.55, r * 0.74, seed + 8, 0.4)
    roughLine(-r * 0.78, r * 0.74, r * 0.78, r * 0.74, seed + 9, 0.5)
    p.pop()

    drawHeliForces(h)

    if (h.hp < h.maxHp) {
      const w = r * 1.4
      const bx = h.x - w / 2
      const by = h.y + r * 1.8
      p.noStroke()
      p.fill(...C.line)
      p.rect(bx + w / 2, by, w, 4, 2)
      p.fill(...(h.heavy ? C.danger : C.accent))
      p.rect(bx + (w * clamp(h.hp / h.maxHp, 0, 1)) / 2, by, w * clamp(h.hp / h.maxHp, 0, 1), 4, 2)
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      if (b.homing) {
        const sp = Math.hypot(b.vx, b.vy) || 1
        const ux = b.vx / sp
        const uy = b.vy / sp

        p.stroke(234, 88, 12, 150)
        p.strokeWeight(3)
        p.line(b.x - ux * 15, b.y - uy * 15, b.x - ux * 6, b.y - uy * 6)

        p.stroke(...C.ink)
        p.strokeWeight(3.5)
        p.line(b.x - ux * 6, b.y - uy * 6, b.x + ux * 5, b.y + uy * 5)
        p.noStroke()
        p.fill(...C.force)
        p.circle(b.x + ux * 5, b.y + uy * 5, 4)

        // One net-force vector: direction and size both follow the measured
        // acceleration, so it points into the turn and fades at steady speed.
        const mag = Math.hypot(b.ax, b.ay)
        if (mag > 15) {
          const len = clamp(mag * 0.01, 4, 26)
          arrow(b.x, b.y, b.ax / mag, b.ay / mag, len, C.force)
        }
        continue
      }

      const a = b.fade && b.life0 ? clamp(b.life / b.life0, 0, 1) : 1
      p.stroke(rgba(b.color, 120 * a))
      p.strokeWeight(b.r * 1.4)
      p.line(b.x - b.vx * 0.018, b.y - b.vy * 0.018, b.x, b.y)
      p.noStroke()
      p.fill(rgba(b.color, 255 * a))
      p.circle(b.x, b.y, b.r * 2)
    }
  }

  function drawPlanes() {
    for (const pl of planes) {
      const seed = pl.seed || 300
      p.push()
      p.translate(pl.x, pl.y)
      if (pl.vx < 0) p.scale(-1, 1)

      p.stroke(...C.ink)
      p.strokeWeight(1.8)
      const body = fillBlob(0, 0, 74, 16, C.panel, seed, 1.1)
      strokeBlob(body, seed, 1.1)

      fillBlob(4, 6, 32, 9, [226, 232, 240], seed + 10, 0.7)

      const fin = [
        [-30, 0], [-25, -15], [-17, 0]
      ].map(([x, y], i) => [x + jit(seed + 20 + i, 0.9), y + jit(seed + 30 + i, 0.9)])
      fillPoly(fin, C.panel)
      p.stroke(...C.ink)
      p.strokeWeight(1.5)
      roughLine(fin[0][0], fin[0][1], fin[1][0], fin[1][1], seed + 40, 0.5)
      roughLine(fin[1][0], fin[1][1], fin[2][0], fin[2][1], seed + 41, 0.5)
      roughLine(fin[2][0], fin[2][1], fin[0][0], fin[0][1], seed + 42, 0.5)

      fillBlob(-27, 1, 16, 5, C.panel, seed + 50, 0.5)
      fillBlob(22, -2, 10, 7, C.ink, seed + 60, 0.4)

      p.stroke(...C.ink)
      p.strokeWeight(2)
      roughLine(37, -8 + Math.sin(pl.prop) * 2, 37, 8 - Math.sin(pl.prop) * 2, seed + 70, 0.5)
      p.pop()
    }
  }

  // One crate face for both the chute drop and the landed box, with a
  // weapon-specific icon so you can read the contents at a glance.
  function pickupLabel(type, weapon) {
    if (type === 'health') return 'HEALTH'
    if (type === 'shield') return 'SHIELD'
    if (type === 'overdrive') return 'OVERDRIVE'
    return WEAPONS[weapon].short.toUpperCase()
  }

  function drawCrateFace(cx, cy, type, weapon) {
    const good = type === 'health'
    const col = good ? C.good : type === 'shield' ? C.cyan : type === 'overdrive' ? [217, 119, 6] : C.accent
    p.push()
    p.translate(cx, cy)

    p.fill(255)
    p.stroke(...col)
    p.strokeWeight(2)
    p.rect(0, 0, 26, 22, 3)

    p.noStroke()
    p.fill(...col)
    if (good) {
      p.rect(0, 0, 12, 3.5)
      p.rect(0, 0, 3.5, 12)
    } else if (type === 'shield') {
      p.beginShape()
      p.vertex(0, -9)
      p.vertex(7, -5)
      p.vertex(7, 1)
      p.vertex(0, 8)
      p.vertex(-7, 1)
      p.vertex(-7, -5)
      p.endShape(p.CLOSE)
    } else if (type === 'overdrive') {
      p.triangle(-2, -9, 5, -1, 1, -1)
      p.triangle(2, 9, -5, 1, -1, 1)
    } else if (weapon === 'shotgun') {
      p.rect(1, -3, 15, 3.5, 1)
      p.triangle(-6.5, -3, -6.5, 5, -0.5, -1)
      p.rect(4, 1, 4, 3.5, 1)
    } else if (weapon === 'rocket') {
      p.triangle(-3.5, -8, 3.5, -8, 0, -2)
      p.rect(0, 1, 7, 8, 1)
      p.triangle(-3.5, 2, -3.5, 7, -0.5, 5)
      p.triangle(3.5, 2, 3.5, 7, 0.5, 5)
      p.fill(...C.flame)
      p.triangle(-2, 6, 2, 6, 0, 10)
    } else if (weapon === 'flame') {
      p.rect(-8, -4, 7, 11, 2)
      p.rect(-1, -1, 7, 3, 1)
      p.fill(...C.flame)
      p.triangle(3, -2.5, 3, 2.5, 10, 0)
    }
    p.pop()
  }

  function drawCrates() {
    for (const c of crates) {
      p.push()
      p.translate(c.x, c.y)
      p.rotate(Math.sin(c.t * 1.8) * 0.07)

      p.stroke(148, 163, 184)
      p.strokeWeight(1)
      p.line(-10, -11, -21, -58)
      p.line(10, -11, 21, -58)
      p.line(-10, -11, 0, -58)
      p.line(10, -11, 0, -58)

      p.fill(232, 238, 246)
      p.stroke(...C.ink)
      p.strokeWeight(1.5)
      p.arc(0, -58, 46, 28, Math.PI, p.TWO_PI)

      drawCrateFace(0, 0, c.type, c.weapon)
      p.pop()

      // World-aligned vectors out of the top and bottom edges; they meet at
      // terminal velocity.
      const dragLen = 24 * clamp(c.dragMag / CRATE_G, 0, 1.2)
      arrow(c.x, c.y + 12, 0, 1, 24, C.force)
      if (dragLen > 1) arrow(c.x, c.y - 12, 0, -1, dragLen, C.force)

      p.noStroke()
      p.fill(...C.muted)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(11)
      p.text(pickupLabel(c.type, c.weapon), c.x, c.y + 40)
    }
  }

  function drawPickups() {
    for (const it of pickups) {
      const blink = it.life < 3 && Math.floor(it.life * 8) % 2 === 0
      if (blink) continue
      const bob = Math.sin(it.t * 4) * 3
      // Landed boxes stay horizontal: no rotation, just the bob.
      drawCrateFace(it.x, it.y + bob, it.type, it.weapon)

      p.noStroke()
      p.fill(...C.muted)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(11)
      const label = it.type === 'health'
        ? '+HEALTH'
        : it.type === 'shield'
          ? '+SHIELD'
          : it.type === 'overdrive'
            ? '+OVERDRIVE'
            : WEAPONS[it.weapon].label.toUpperCase()
      p.text(label, it.x, it.y - 22)
    }
  }

  function drawParticles() {
    p.noStroke()
    for (const q of particles) {
      const a = 255 * clamp(q.life / q.max, 0, 1)
      p.fill(rgba(q.color, a))
      if (q.round) p.circle(q.x, q.y, q.size)
      else p.rect(q.x, q.y, q.size, q.size)
    }
  }

  function addPopup(text, x, y, color, size = 15) {
    popups.push({ text, x, y, color, size, life: 0.9, max: 0.9, vy: -44 })
  }

  function updatePopups(dt) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const q = popups[i]
      q.life -= dt
      if (q.life <= 0) {
        popups.splice(i, 1)
        continue
      }
      q.y += q.vy * dt
      q.vy *= 1 - 1.8 * dt
    }
  }

  function drawPopups() {
    p.textAlign(p.CENTER, p.CENTER)
    for (const q of popups) {
      const a = clamp(q.life / q.max, 0, 1)
      p.noStroke()
      p.fill(rgba(q.color, 255 * a))
      p.textSize(q.size)
      p.textStyle(p.BOLD)
      p.text(q.text, q.x, q.y)
      p.textStyle(p.NORMAL)
    }
    p.textAlign(p.CENTER, p.CENTER)
  }

  // ------------------------------------------------------------------- hud
  function drawHud() {
    if (mode === 'title' || mode === 'rescue') return

    // Dedicated control strip, separated from the arena floor.
    p.noStroke()
    p.fill(251, 251, 253, 242)
    p.rect(W / 2, (HUD_TOP + H) / 2, W, H - HUD_TOP)
    p.stroke(...C.line)
    p.strokeWeight(1)
    p.line(0, HUD_TOP, W, HUD_TOP)
    p.noStroke()

    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.noStroke()

    // score
    p.textAlign(p.LEFT, p.TOP)
    p.fill(...C.muted)
    p.textSize(12)
    p.text('SCORE', 26, 24)
    p.fill(...C.ink)
    p.textSize(34)
    p.textStyle(p.BOLD)
    p.text(score, 24, 38)
    p.textStyle(p.NORMAL)

    p.fill(...C.muted)
    p.textSize(12)
    p.text(`CHOPPERS  ${kills}`, 26, 82)
    p.text(`WAVE ${Math.max(1, waveIndex)}`, 26, 104)

    if (combo > 1) {
      const mult = comboMult()
      p.fill(...C.accent)
      p.textSize(12)
      p.textStyle(p.BOLD)
      p.text(`COMBO ×${mult.toFixed(1)}`, 26, 126)
      p.textStyle(p.NORMAL)
      p.fill(...C.line)
      p.rect(86, 145, 120, 4, 2)
      p.fill(...C.accent)
      p.rect(26 + 60 * (comboT / COMBO_TIME), 145, 120 * (comboT / COMBO_TIME), 4, 2)
    }

    // boss health
    if (mode === 'play') {
      const boss = helis.find(h => h.type === 'gunship')
      if (boss) {
        const bwid = 380
        p.textAlign(p.CENTER, p.BOTTOM)
        p.fill(...C.muted)
        p.textSize(11)
        p.text('GUNSHIP MK-IV', W / 2, 22)
        p.fill(...C.line)
        p.rect(W / 2, 32, bwid, 9, 4)
        p.fill(...C.danger)
        p.rect(W / 2 - bwid / 2 + (bwid * clamp(boss.hp / boss.maxHp, 0, 1)) / 2, 32, bwid * clamp(boss.hp / boss.maxHp, 0, 1), 9, 4)
      }
    }

    // best
    p.textAlign(p.RIGHT, p.TOP)
    p.fill(...C.muted)
    p.textSize(12)
    p.text('BEST', W - 26, 24)
    p.fill(...C.ink)
    p.textSize(20)
    p.text(best, W - 24, 38)

    // health
    const bw = 190
    const by = H - 48
    p.textAlign(p.LEFT, p.BOTTOM)
    p.fill(...C.muted)
    p.textSize(12)
    p.text('HEALTH', 26, by - 12)
    p.fill(...C.line)
    p.rect(26 + bw / 2, by, bw, 12, 6)
    const frac = clamp(player.hp / player.maxHp, 0, 1)
    if (frac > 0) {
      const inv = player.invincible > 0
      const cyanOn = Math.floor(animT * 7.5) % 2 === 0
      const col = inv
        ? (cyanOn ? C.cyan : [165, 243, 252])
        : (frac > 0.35 ? C.accent : C.danger)
      p.fill(...col)
      p.rect(26 + (bw * frac) / 2, by, bw * frac, 12, 6)
    }

    // dash cooldown
    const dashX = 26 + bw + 18
    p.textAlign(p.LEFT, p.BOTTOM)
    p.fill(...C.muted)
    p.textSize(11)
    p.text('DASH', dashX, by - 12)
    p.fill(...C.line)
    p.rect(dashX + 32, by, 64, 10, 5)
    const dashFrac = 1 - clamp(dashCd / DASH_COOLDOWN, 0, 1)
    if (dashFrac > 0) {
      p.fill(...(dashFrac >= 1 ? C.good : C.accent))
      p.rect(dashX + 32 - 32 * (1 - dashFrac), by, 64 * dashFrac, 10, 5)
    }

    // temporary power-up status
    let sx = dashX + 112
    p.textSize(12)
    p.textStyle(p.BOLD)
    if (player.shieldT > 0) {
      p.fill(...C.cyan)
      const t = `SHIELD ${Math.ceil(player.shieldT)}s`
      p.text(t, sx, by + 5)
      sx += p.textWidth(t) + 14
    }
    if (player.overdriveT > 0) {
      p.fill(217, 119, 6)
      p.text(`OVERDRIVE ${Math.ceil(player.overdriveT)}s`, sx, by + 5)
    }
    p.textStyle(p.NORMAL)

    // equipped weapon readout
    p.textAlign(p.RIGHT, p.BOTTOM)
    p.fill(...C.muted)
    p.textSize(12)
    p.text('WEAPON', W - 26, by - 12)
    p.fill(...C.ink)
    p.textSize(20)
    p.textStyle(p.BOLD)
    const w = WEAPONS[weapon]
    p.text(`${w.label}  ${ammoLabel(weapon)}`, W - 24, by + 6)
    p.textStyle(p.NORMAL)

    // weapon capsules
    for (let i = 0; i < CAP_ORDER.length; i++) {
      const name = CAP_ORDER[i]
      const r = capsuleRect(i)
      const active = name === weapon
      const fl = hudFlash[name] || 0
      const hot = active || (fl > 0 && Math.floor(fl * 10) % 2 === 0)
      if (hot) {
        p.noStroke()
        p.fill(...C.accent)
        p.rect(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 9)
      } else {
        p.fill(255)
        p.stroke(...C.line)
        p.strokeWeight(1.2)
        p.rect(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 9)
        p.noStroke()
      }
      p.fill(...(hot ? [255, 255, 255] : C.ink))
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(14)
      const label = name === 'rocket'
        ? `R Rocket ${ammoLabel('rocket')}`
        : `${i + 1} ${WEAPONS[name].short} ${ammoLabel(name)}`
      p.text(label, r.x + r.w / 2, r.y + r.h / 2 + 1)
    }
  }

  function drawWaveBanner() {
    if (!waveBanner) return
    const b = waveBanner
    const a = clamp(Math.min((b.max - b.life) / 0.25, b.life / 0.55), 0, 1)
    p.textAlign(p.CENTER, p.CENTER)
    p.noStroke()
    p.fill(rgba(C.ink, 255 * a))
    p.textSize(42)
    p.textStyle(p.BOLD)
    p.text(b.text, W / 2, 148)
    p.textStyle(p.NORMAL)
    p.fill(rgba(C.muted, 255 * a))
    p.textSize(15)
    p.text(b.sub, W / 2, 182)
  }

  function panel(cx, cy, w, h) {
    p.noStroke()
    p.fill(214, 220, 228, 120)
    p.rect(cx + 4, cy + 6, w, h, 18)
    p.fill(255, 255, 255, 248)
    p.stroke(...C.line)
    p.strokeWeight(1.5)
    p.rect(cx, cy, w, h, 18)
    p.noStroke()
  }

  // Faint "cheat codes used" wallpaper behind the score panel.
  function cheatWatermark(cx, cy, w, h) {
    p.push()
    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.textAlign(p.CENTER, p.CENTER)
    p.textSize(15)
    p.noStroke()
    p.fill(220, 38, 38, 38)
    p.drawingContext.save()
    p.drawingContext.beginPath()
    p.drawingContext.rect(cx - w / 2, cy - h / 2, w, h)
    p.drawingContext.clip()
    p.translate(cx, cy)
    p.rotate(-0.35)
    let row = 0
    for (let y = -h / 2 - 50; y <= h / 2 + 50; y += 44, row++) {
      const shift = row % 2 ? 65 : 0
      for (let x = -w / 2 - 140 + shift; x <= w / 2 + 140; x += 130) {
        p.text('cheat codes used', x, y)
      }
    }
    p.drawingContext.restore()
    p.pop()
  }

  function button(cx, cy, w, h, label, hot) {
    const m = mouseWorld()
    const over = inRect(m.x, m.y, cx, cy, w, h) && (mode === 'title' || mode === 'over')
    p.fill(...(hot || over ? C.accent : C.ink))
    p.noStroke()
    p.rect(cx, cy, w, h, 12)
    p.fill(255)
    p.textAlign(p.CENTER, p.CENTER)
    p.textSize(24)
    p.text(label, cx, cy + 1)
  }

  // ------------------------------------------------------- The rescue truck
  // The Cybertruck is lifted only by short, fast bursts of white air.
  const PUFF_SHADES = [
    [255, 255, 255],
    [241, 244, 248],
    [224, 230, 238],
    [203, 213, 225]
  ]

  function emitJetPuff(r, moving, side) {
    const ox = side * (28 + p.random(0, 12))
    const oy = 16 + p.random(-2, 4)
    const cos = Math.cos(r.tilt)
    const sin = Math.sin(r.tilt)
    const sx = r.x + ox * cos - oy * sin
    const sy = r.y + ox * sin + oy * cos

    let a = Math.PI / 2 - side * 0.35 + p.random(-0.18, 0.18)
    if (r.phase === 'fly' || (r.phase === 'wrong' && r.t > 1.8)) a += 0.3
    const speed = p.random(320, 500) * (moving ? 1.2 : 1)
    const life = p.random(0.18, 0.32)
    truckPuffs.push({
      x: sx, y: sy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life, max: life,
      size: p.random(3.5, 8),
      grow: p.random(8, 22),
      drag: p.random(7, 10),
      color: PUFF_SHADES[Math.floor(p.random(PUFF_SHADES.length))]
    })
  }

  // Each side has its own short jet. Both can fire at once, and each flickers
  // off independently so the truck looks like it is trimming its level.
  function updateTruckJets(r, dt) {
    const moving = r.phase === 'swoop' || r.phase === 'fly' || (r.phase === 'wrong' && r.t > 1.8)
    const gapMin = moving ? 0.03 : 0.1
    const gapMax = moving ? 0.08 : 0.4

    for (let i = 0; i < 2; i++) {
      if (r.jetOn[i] > 0) {
        r.jetOn[i] -= dt
        if (r.jetOn[i] <= 0) {
          r.jetOn[i] = 0
          r.jetOff[i] = p.random(gapMin, gapMax)
        }
      } else {
        r.jetOff[i] -= dt
        if (r.jetOff[i] <= 0) {
          r.jetOff[i] = 0
          r.jetOn[i] = p.random(0.1, 0.25)
        }
      }
    }

    r.jetEmitT -= dt
    if (r.jetEmitT > 0) return
    r.jetEmitT = moving ? 0.018 : 0.028

    for (let i = 0; i < 2; i++) {
      if (r.jetOn[i] > 0) {
        const side = i === 0 ? -1 : 1
        emitJetPuff(r, moving, side)
        if (p.random() < 0.5) emitJetPuff(r, moving, side)
      }
    }
  }

  function nearestAniTarget(x, y) {
    let best = null
    let bd = Infinity
    for (const h of helis) {
      if (h.type === 'gunship') continue
      if (h.x < -20 || h.x > W + 20 || h.y < -20 || h.y > GROUND_Y) continue
      const d = dist(x, y, h.x, h.y)
      if (d < bd) {
        bd = d
        best = h
      }
    }
    return best
  }

  function cutsceneKill(h) {
    const idx = helis.indexOf(h)
    if (idx === -1) return
    helis.splice(idx, 1)
    shake = Math.max(shake, h.r >= 38 ? 9 : 5)
    burst(h.x, h.y, h.r >= 38 ? 24 : 14, C.ink, 300)
    burst(h.x, h.y, 10, C.cyan, 240)
  }

  function updateAniGunner(r, dt) {
    r.aniFlash = Math.max(0, r.aniFlash - dt)
    for (let i = r.aniShots.length - 1; i >= 0; i--) {
      r.aniShots[i].life -= dt
      if (r.aniShots[i].life <= 0) r.aniShots.splice(i, 1)
    }

    const target = nearestAniTarget(r.x, r.y)
    const want = target
      ? Math.atan2(target.y - (r.y - 12), target.x - (r.x + 40))
      : -0.6
    let diff = want - r.aniAim
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    r.aniAim += diff * Math.min(1, dt * 9)

    const canShoot = (r.phase === 'greet' || r.phase === 'ask') && target
    if (!canShoot) return

    r.aniFireT -= dt
    if (r.aniFireT > 0) return
    r.aniFireT = p.random(0.25, 0.5)

    const mx = r.x + 40 + Math.cos(r.aniAim) * 16
    const my = r.y - 12 + Math.sin(r.aniAim) * 16
    r.aniShots.push({
      x1: mx, y1: my,
      x2: target.x, y2: target.y,
      life: 0.14, max: 0.14
    })
    r.aniFlash = 0.06
    cutsceneKill(target)
    shake = Math.max(shake, 1.8)
  }

  function updateTruckPuffs(dt) {
    for (let i = truckPuffs.length - 1; i >= 0; i--) {
      const q = truckPuffs[i]
      q.life -= dt
      if (q.life <= 0) {
        truckPuffs.splice(i, 1)
        continue
      }
      q.vx *= 1 - q.drag * dt
      q.vy *= 1 - q.drag * dt
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.size += q.grow * dt
    }
  }

  function drawTruckPuffs() {
    p.noStroke()
    for (const q of truckPuffs) {
      p.fill(rgba(q.color, 235 * clamp(q.life / q.max, 0, 1)))
      p.circle(q.x, q.y, q.size)
    }
  }

  // A cartoon driver leaning out of the driver's window.
  function drawDriverInCab(t, showAni, showPlayer) {
    p.push()

    // Jacket and shoulders.
    p.noStroke()
    p.fill(24, 28, 35)
    p.rect(0, -8, 32, 16, 5)

    // Head.
    p.fill(245, 201, 168)
    p.circle(0, -23, 21)

    // Hair.
    p.fill(39, 42, 48)
    p.arc(0, -26, 23, 20, Math.PI, p.TWO_PI)
    p.rect(-10.5, -26, 3, 7, 1)
    p.rect(7.5, -26, 3, 7, 1)

    // Eyes and smile.
    p.fill(31, 41, 55)
    p.circle(-4, -23, 2.2)
    p.circle(4, -23, 2.2)
    p.noFill()
    p.stroke(120, 70, 55)
    p.strokeWeight(1.1)
    p.arc(0, -19, 7, 5, 0.15, Math.PI - 0.15)

    // Arm resting on the window, with a little wave.
    p.stroke(245, 201, 168)
    p.strokeWeight(4)
    roughLine(13, -10, 26, -15 + Math.sin(t * 5) * 2, 1200, 0.3)
    p.noStroke()

    // Grok Ani tucked into the passenger side.
    if (showAni) {
      p.fill(245, 205, 186)
      p.circle(22, -18, 15)
      p.fill(235, 198, 105)
      p.arc(22, -21, 17, 14, Math.PI, p.TWO_PI)
      p.rect(15, -21, 2.5, 5, 1)
      p.rect(26.5, -21, 2.5, 5, 1)
      p.circle(13, -15, 7)
      p.circle(31, -15, 7)
      p.fill(24, 24, 28)
      p.circle(15, -18, 3)
      p.circle(29, -18, 3)
      p.triangle(13, -20, 13, -16, 15, -18)
      p.triangle(31, -20, 31, -16, 29, -18)
      p.fill(31, 41, 55)
      p.circle(19, -18, 1.8)
      p.circle(25, -18, 1.8)
    }

    // The rescued player, tucked in the back.
    if (showPlayer) {
      p.fill(31, 41, 55)
      p.circle(44, -13, 13)
      p.fill(...C.accent)
      p.circle(47, -13, 2.6)
    }

    p.pop()
  }

  function drawCybertruck(x, y, t, tilt = 0, boost = 0, showAni = false, showPlayer = false) {
    p.push()
    p.translate(x, y)
    p.rotate(tilt + Math.sin(t * 2.4) * 0.01)

    // Angular steel wedge, stroked by hand like the rest of the game.
    const body = [
      [-62, 6], [-44, -16], [26, -22], [48, -16], [64, -2], [62, 10], [40, 16], [-42, 16]
    ].map(([px, py], i) => [px + jit(900 + i, 0.5), py + jit(920 + i, 0.5)])
    fillPoly(body, [226, 232, 240])
    p.stroke(...C.ink)
    p.strokeWeight(2)
    for (let i = 0; i < body.length; i++) {
      const a = body[i]
      const b = body[(i + 1) % body.length]
      roughLine(a[0], a[1], b[0], b[1], 940 + i * 1.7, 0.5)
    }

    // Windshield, side crease, and the driver.
    fillPoly([[-36, -13], [14, -17], [30, -8], [-24, -5]], C.charcoal)
    p.stroke(...C.faint)
    p.strokeWeight(1.4)
    roughLine(-52, 4, 54, -1, 980, 0.4)
    drawDriverInCab(t, showAni, showPlayer)

    // Wheels.
    p.noStroke()
    for (const wx of [-36, 38]) {
      p.fill(...C.charcoal)
      p.circle(wx, 12, 17)
      p.fill(...C.faint)
      p.circle(wx, 12, 7)
    }

    p.pop()
  }

  // A hemp rope with a loop at the bottom, drawn as a slacked quadratic curve.
  function drawRope(ax, ay, bx, by, slack, t) {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const sway = Math.sin(t * 5) * Math.min(6, slack * 0.4)
    const cx = (ax + bx) / 2 + nx * (slack + sway)
    const cy = (ay + by) / 2 + ny * (slack + sway)

    p.push()
    p.noFill()
    p.stroke(120, 96, 64)
    p.strokeWeight(4.2)
    p.beginShape()
    p.vertex(ax, ay)
    p.quadraticVertex(cx, cy, bx, by)
    p.endShape()

    p.stroke(205, 170, 118)
    p.strokeWeight(2.2)
    p.beginShape()
    p.vertex(ax, ay)
    p.quadraticVertex(cx, cy, bx, by)
    p.endShape()

    // Grab loop at the player end.
    p.stroke(120, 96, 64)
    p.strokeWeight(2.2)
    p.ellipse(bx, by + 1, 15, 11)
    p.stroke(205, 170, 118)
    p.strokeWeight(1)
    p.ellipse(bx, by + 1, 12, 8)
    p.pop()
  }

  // Grok Ani — blond pigtails, black ribbons — lowers a rope to the player.
  function drawGrokAni(r) {
    if (!r || r.ani <= 0.02) return
    const emerge = r.ani
    const anchor = { x: r.x + 40, y: r.y - 2 }
    const endTarget = r.pull > 0
      ? { x: player.x, y: player.y - 28 }
      : { x: r.pullFrom.x, y: r.pullFrom.y - 28 }
    const end = {
      x: anchor.x + (endTarget.x - anchor.x) * emerge,
      y: anchor.y + (endTarget.y - anchor.y) * emerge
    }
    const head = { x: r.x + 44, y: r.y - 4 - emerge * 10 }
    const ropeLen = Math.hypot(end.x - anchor.x, end.y - anchor.y)
    const slack = 4 + ropeLen * (r.pull > 0 ? 0.015 : 0.04)

    p.push()

    // Rope first: the truck and her hands cover its root.
    drawRope(anchor.x, anchor.y, end.x, end.y, slack, r.t)

    // Torso leaning out of the rear window.
    p.stroke(52, 44, 70)
    p.strokeWeight(10)
    roughLine(r.x + 32, r.y + 3, head.x - 2, head.y + 9, 1300, 0.4)
    p.stroke(6, 182, 212)
    p.strokeWeight(2)
    roughLine(r.x + 30, r.y - 3, head.x - 3, head.y + 6, 1310, 0.3)

    // Blond pigtails hanging behind the face.
    p.noStroke()
    const sway = Math.sin(r.t * 7) * 1.5
    fillBlob(head.x - 13, head.y + 8 + sway, 15, 27, [235, 198, 105], 1320, 0.7)
    fillBlob(head.x + 13, head.y + 8 - sway, 15, 27, [235, 198, 105], 1325, 0.7)

    // Face.
    p.fill(245, 205, 186)
    p.circle(head.x, head.y, 17)

    // Blond fringe.
    p.fill(235, 198, 105)
    p.arc(head.x, head.y - 4, 20, 15, Math.PI, p.TWO_PI)
    p.rect(head.x - 9, head.y - 5, 2.5, 6, 1)
    p.rect(head.x + 6.5, head.y - 5, 2.5, 6, 1)
    p.fill(250, 224, 150)
    p.circle(head.x - 3, head.y - 8, 4)

    // Eyes and smile.
    p.fill(31, 41, 55)
    p.circle(head.x - 3.5, head.y, 1.9)
    p.circle(head.x + 3.5, head.y, 1.9)
    p.noFill()
    p.stroke(120, 70, 80)
    p.strokeWeight(1)
    p.arc(head.x, head.y + 4, 5, 3, 0.2, Math.PI - 0.2)

    // Black ribbon bows tying the pigtails.
    p.noStroke()
    p.fill(24, 24, 28)
    p.circle(head.x - 13, head.y - 3, 4.5)
    p.circle(head.x + 13, head.y - 3, 4.5)
    p.triangle(head.x - 15, head.y - 6.5, head.x - 15, head.y + 0.5, head.x - 19, head.y - 3)
    p.triangle(head.x - 11, head.y - 6.5, head.x - 11, head.y + 0.5, head.x - 7, head.y - 3)
    p.triangle(head.x + 15, head.y - 6.5, head.x + 15, head.y + 0.5, head.x + 19, head.y - 3)
    p.triangle(head.x + 11, head.y - 6.5, head.x + 11, head.y + 0.5, head.x + 7, head.y - 3)

    // Hands gripping the rope, working it hand-over-hand while lowering.
    const bob = Math.sin(r.t * 11) * 2
    p.fill(245, 205, 186)
    p.circle(anchor.x - 3.5, anchor.y + 1 + bob, 6.5)
    p.circle(anchor.x + 3.5, anchor.y + 1 - bob, 6.5)

    p.pop()
  }

  function drawAniGunner(r) {
    const head = { x: r.x + 42, y: r.y - 14 }
    const sway = Math.sin(r.t * 7) * 1.2
    const blond = [235, 198, 105]

    p.push()

    // Torso leaning out of the rear window.
    p.stroke(52, 44, 70)
    p.strokeWeight(10)
    roughLine(r.x + 30, r.y + 2, head.x - 2, head.y + 9, 1300, 0.4)
    p.stroke(6, 182, 212)
    p.strokeWeight(2)
    roughLine(r.x + 28, r.y - 3, head.x - 3, head.y + 6, 1310, 0.3)

    // Blond pigtails.
    p.noStroke()
    fillBlob(head.x - 13, head.y + 8 + sway, 15, 27, blond, 1320, 0.7)
    fillBlob(head.x + 13, head.y + 8 - sway, 15, 27, blond, 1325, 0.7)

    // Face and fringe.
    p.fill(245, 205, 186)
    p.circle(head.x, head.y, 17)
    p.fill(...blond)
    p.arc(head.x, head.y - 4, 20, 15, Math.PI, p.TWO_PI)
    p.rect(head.x - 9, head.y - 5, 2.5, 6, 1)
    p.rect(head.x + 6.5, head.y - 5, 2.5, 6, 1)
    p.fill(250, 224, 150)
    p.circle(head.x - 3, head.y - 8, 4)

    // Eyes and smile.
    p.fill(31, 41, 55)
    p.circle(head.x - 3.5, head.y, 1.9)
    p.circle(head.x + 3.5, head.y, 1.9)
    p.noFill()
    p.stroke(120, 70, 80)
    p.strokeWeight(1)
    p.arc(head.x, head.y + 4, 5, 3, 0.2, Math.PI - 0.2)

    // Black ribbon bows.
    p.noStroke()
    p.fill(24, 24, 28)
    p.circle(head.x - 13, head.y - 3, 4.5)
    p.circle(head.x + 13, head.y - 3, 4.5)
    p.triangle(head.x - 15, head.y - 6.5, head.x - 15, head.y + 0.5, head.x - 19, head.y - 3)
    p.triangle(head.x - 11, head.y - 6.5, head.x - 11, head.y + 0.5, head.x - 7, head.y - 3)
    p.triangle(head.x + 15, head.y - 6.5, head.x + 15, head.y + 0.5, head.x + 19, head.y - 3)
    p.triangle(head.x + 11, head.y - 6.5, head.x + 11, head.y + 0.5, head.x + 7, head.y - 3)

    // Arm and blaster, trained on the nearest chopper.
    const aim = r.aniAim
    const sx = r.x + 34
    const sy = r.y - 6
    const handX = sx + Math.cos(aim) * 20
    const handY = sy + Math.sin(aim) * 20
    const muzzleX = handX + Math.cos(aim) * 15
    const muzzleY = handY + Math.sin(aim) * 15

    p.stroke(245, 205, 186)
    p.strokeWeight(4.5)
    roughLine(sx, sy, handX, handY, 1330, 0.35)
    p.stroke(31, 41, 55)
    p.strokeWeight(5)
    p.line(handX, handY, muzzleX, muzzleY)
    p.fill(6, 182, 212)
    p.noStroke()
    p.circle(muzzleX, muzzleY, 4)

    if (r.aniFlash > 0) {
      const a = clamp(r.aniFlash / 0.06, 0, 1)
      p.fill(250, 204, 21, 230 * a)
      p.circle(muzzleX, muzzleY, 10 + 8 * a)
      p.fill(255, 255, 255, 220 * a)
      p.circle(muzzleX, muzzleY, 5)
    }

    p.pop()
  }

  function drawAniShots() {
    if (!rescue) return
    p.noStroke()
    for (const s of rescue.aniShots) {
      const k = clamp(1 - s.life / s.max, 0, 1)
      const e = 1 - Math.pow(1 - k, 3)
      const hx = s.x1 + (s.x2 - s.x1) * e
      const hy = s.y1 + (s.y2 - s.y1) * e
      const a = clamp(s.life / s.max, 0, 1)

      p.stroke(6, 182, 212, 220 * a)
      p.strokeWeight(2)
      p.line(s.x1, s.y1, hx, hy)
      p.noStroke()
      p.fill(255, 255, 255, 230 * a)
      p.circle(hx, hy, 4)

      if (k > 0.7) {
        p.noFill()
        p.stroke(6, 182, 212, 190 * a)
        p.strokeWeight(2)
        p.circle(s.x2, s.y2, 10 + 10 * k)
        p.noStroke()
      }
    }
  }

  function drawRescueTruck() {
    const r = rescue
    if (!r) return
    const moving = r.phase === 'fly' || (r.phase === 'wrong' && r.t > 1.8)
    const bob = moving ? 0 : Math.sin(r.t * 2.6) * 3
    const boost = moving ? 1 : 0
    const inside = r.phase === 'swoop' || r.phase === 'fly' || (r.phase === 'wrong' && r.t > 1.8)
    const showPlayer = r.phase === 'fly'
    drawCybertruck(r.x, r.y + bob, r.t, r.tilt, boost, inside, showPlayer)
    if (r.phase === 'grab') drawGrokAni(r)
    else if (r.phase === 'greet' || r.phase === 'ask' || r.phase === 'correct' || r.phase === 'wrong') {
      if (!inside) drawAniGunner(r)
    }
  }

  function worldToScreen(x, y) {
    return {
      x: W / 2 + (x - camera.x) * camera.zoom,
      y: H / 2 + (y - camera.y) * camera.zoom
    }
  }

  function drawRescueAnswer(i, dy) {
    const r = rescueAnswerRect(i)
    const y = r.y + dy
    const m = pointer
    const asking = rescue.phase === 'ask' && rescue.panelT > 0.75
    const hover = asking && inRect(m.x, m.y, r.x, y, r.w, r.h)
    const picked = rescue.picked === i
    const correct = i === rescue.question.answer

    let bg = [255, 255, 255]
    let border = C.line
    let fg = C.ink
    if (asking && hover) {
      bg = C.accent
      border = C.accent
      fg = [255, 255, 255]
    } else if (!asking && picked) {
      bg = correct ? C.good : C.danger
      border = bg
      fg = [255, 255, 255]
    } else if (!asking && correct) {
      bg = [220, 252, 231]
      border = C.good
      fg = [6, 95, 70]
    }

    p.fill(...bg)
    p.stroke(...border)
    p.strokeWeight(hover ? 2.4 : 1.4)
    p.rect(r.x, y, r.w, r.h, 12)

    p.noStroke()
    p.fill(...fg)
    p.textAlign(p.LEFT, p.CENTER)
    p.textSize(17)
    p.textStyle(p.BOLD)
    p.text('ABCD'[i], r.x - r.w / 2 + 16, y + 1)
    p.textStyle(p.NORMAL)
    p.textSize(17)
    const lines = wrapLines(rescue.question.options[i], r.w - 70)
    const startY = y - (lines.length - 1) * 10
    lines.forEach((line, k) => p.text(line, r.x - r.w / 2 + 44, startY + k * 20))
    p.textAlign(p.CENTER, p.CENTER)
  }

  function drawSpeechBubble() {
    const r = rescue
    let text = null
    if (r.phase === 'greet') text = 'Answer this question!'
    else if (r.phase === 'wrong' && r.t < 1.9) text = 'I only rescue smart people.'
    if (!text) return

    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.textSize(18)
    const lines = wrapLines(text, 270)
    const w = 310
    const h = 30 + lines.length * 23
    const truck = worldToScreen(r.x, r.y)
    const cx = clamp(truck.x + 280, 210, W - 170)
    const cy = clamp(truck.y + 14, 105, 265)

    // Tail first, then the bubble body covers its base.
    p.fill(255)
    p.stroke(...C.line)
    p.strokeWeight(1.5)
    p.triangle(cx - w / 2 + 7, cy + 4, cx - w / 2 + 7, cy + 26, truck.x + 46, truck.y + 6)
    panel(cx, cy, w, h)

    p.noStroke()
    p.textAlign(p.CENTER, p.CENTER)
    p.textSize(18)
    p.fill(...C.ink)
    lines.forEach((line, i) => p.text(line, cx, cy - h / 2 + 15 + i * 23))
  }

  function drawRescuePanel(e) {
    const dy = (1 - e) * 50
    panel(W / 2, 469 + dy, 780, 312)

    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.noStroke()
    p.textAlign(p.CENTER, p.CENTER)
    p.fill(...C.muted)
    p.textSize(12)
    p.textStyle(p.BOLD)
    p.text('ANSWER TO BE RESCUED', W / 2, 338 + dy)
    p.textStyle(p.NORMAL)

    p.fill(...C.ink)
    p.textSize(20)
    const lines = wrapLines(rescue.question.q, 700).slice(0, 2)
    lines.forEach((line, i) => p.text(line, W / 2, 364 + i * 26 + dy))

    for (let i = 0; i < 4; i++) drawRescueAnswer(i, dy)

    p.textAlign(p.CENTER, p.CENTER)
    if (rescue.phase === 'correct') {
      p.fill(...C.good)
      p.textSize(18)
      p.textStyle(p.BOLD)
      p.text('Correct!', W / 2, 574 + dy)
      p.textStyle(p.NORMAL)
    } else {
      p.fill(...C.muted)
      p.textSize(14)
      p.text('Click an answer.', W / 2, 574 + dy)
    }
  }

  function drawRescueUI() {
    if (!rescue) return
    const e = 1 - Math.pow(1 - clamp(rescue.panelT, 0, 1), 3)
    if (rescue.phase === 'greet' || (rescue.phase === 'wrong' && rescue.t < 1.9)) {
      drawSpeechBubble()
    }
    if (rescue.phase === 'ask' || rescue.phase === 'correct') drawRescuePanel(e)
  }

  function drawOverlay() {
    if (mode === 'title') {
      p.fill(255, 255, 255, 175)
      p.rect(W / 2, H / 2, W, H)

      // The title chopper drifts on an explicit path, and its vectors come
      // from the second derivative of that path, so they match its motion.
      const t = titleT
      const hax = -34 * 1.6 * 1.6 * Math.sin(t * 1.6)
      const hay = -12 * 2.1 * 2.1 * Math.sin(t * 2.1)
      drawHeli({
        x: 872 + Math.sin(t * 1.6) * 34,
        y: 158 + Math.sin(t * 2.1) * 12,
        r: 30, heavy: false,
        dir: Math.cos(t * 1.6) >= 0 ? 1 : -1,
        rotor: t * 26, hit: 0,
        ax: hax, ay: hay,
        tilt: clamp(hax * 0.0012, -0.35, 0.35),
        seed: 7,
        tailRotor: t * 55,
        hp: 1, maxHp: 1
      })

      panel(W / 2, 330, 600, 470)

      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.noStroke()
      p.fill(...C.ink)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(76)
      p.text('Lift Force', W / 2, 195)

      button(PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 'PLAY', true)

      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.fill(...C.muted)
      p.textSize(16)
      p.text('Move: A / D', W / 2, 342)
      p.text('Jump: W', W / 2, 366)
      p.text('Dash: Shift', W / 2, 390)
      p.text('Aim: mouse or ←/→', W / 2, 414)
      p.text('Shoot: click or spacebar', W / 2, 438)
      p.text('Launch rocket: R', W / 2, 462)

      p.fill(...C.good)
      p.textSize(14)
      p.textStyle(p.BOLD)
      p.text(`BEST  ${best}`, W / 2, 508)
      p.textStyle(p.NORMAL)
      return
    }

    if (mode === 'pause') {
      p.fill(251, 251, 253, 170)
      p.rect(W / 2, H / 2, W, H)
      panel(W / 2, H / 2, 380, 190)
      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.noStroke()
      p.fill(...C.ink)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(52)
      p.text('Paused', W / 2, H / 2 - 26)
      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.fill(...C.muted)
      p.textSize(14)
      p.text('click or press P to resume', W / 2, H / 2 + 34)
      return
    }

    if (mode === 'over') {
      if (rescued) {
        p.fill(251, 251, 253, 165)
        p.rect(W / 2, H / 2, W, H)
        panel(W / 2, 330, 460, 400)
        if (cheatsUsed) cheatWatermark(W / 2, 330, 460, 400)

        p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.fill(...C.good)
        p.textSize(54)
        p.textStyle(p.BOLD)
        p.text('Rescued!', W / 2, 194)
        p.textStyle(p.NORMAL)

        p.fill(...C.muted)
        p.textSize(16)
        p.text('You have been rescued.', W / 2, 238)

        p.textSize(12)
        p.text('SCORE', W / 2, 272)
        p.fill(...C.ink)
        p.textSize(46)
        p.textStyle(p.BOLD)
        p.text(score, W / 2, 300)
        p.textStyle(p.NORMAL)

        const acc = shots ? Math.round((100 * hits) / shots) : 0
        const rows = [
          ['CHOPPERS', String(kills)],
          ['ACCURACY', `${acc}%`],
          ['BEST', String(best)]
        ]
        p.textSize(16)
        rows.forEach((row, i) => {
          const y = 338 + i * 24
          p.textAlign(p.LEFT, p.CENTER)
          p.fill(...C.muted)
          p.text(row[0], W / 2 - 130, y)
          p.textAlign(p.RIGHT, p.CENTER)
          p.fill(...C.ink)
          p.text(row[1], W / 2 + 130, y)
        })

        if (newBest) {
          p.textAlign(p.CENTER, p.CENTER)
          p.fill(...C.accent)
          p.textSize(16)
          p.textStyle(p.BOLD)
          p.text('NEW BEST', W / 2, 420)
          p.textStyle(p.NORMAL)
        }

        button(AGAIN_BTN.x, AGAIN_BTN.y, AGAIN_BTN.w, AGAIN_BTN.h, 'PLAY AGAIN', true)
        return
      }

      p.fill(251, 251, 253, 165)
      p.rect(W / 2, H / 2, W, H)
      panel(W / 2, 330, 460, 400)
      if (cheatsUsed) cheatWatermark(W / 2, 330, 460, 400)

      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.noStroke()
      p.fill(...C.ink)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(56)
      p.text('owari da', W / 2, 196)

      p.fill(...C.muted)
      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.textSize(12)
      p.text('SCORE', W / 2, 246)
      p.fill(...C.ink)
      p.textSize(46)
      p.textStyle(p.BOLD)
      p.text(score, W / 2, 276)
      p.textStyle(p.NORMAL)

      const acc = shots ? Math.round((100 * hits) / shots) : 0
      const rows = [
        ['CHOPPERS', String(kills)],
        ['ACCURACY', `${acc}%`],
        ['BEST', String(best)]
      ]
      p.textSize(16)
      rows.forEach((row, i) => {
        const y = 330 + i * 26
        p.textAlign(p.LEFT, p.CENTER)
        p.fill(...C.muted)
        p.text(row[0], W / 2 - 130, y)
        p.textAlign(p.RIGHT, p.CENTER)
        p.fill(...C.ink)
        p.text(row[1], W / 2 + 130, y)
      })

      if (newBest) {
        p.textAlign(p.CENTER, p.CENTER)
        p.fill(...C.accent)
        p.textSize(16)
        p.textStyle(p.BOLD)
        p.text('NEW BEST', W / 2, 422)
        p.textStyle(p.NORMAL)
      }

      button(AGAIN_BTN.x, AGAIN_BTN.y, AGAIN_BTN.w, AGAIN_BTN.h, 'PLAY AGAIN', true)
      return
    }
  }

  // ----------------------------------------------------------------- setup
  function buildControlsBar() {
    if (!controls) return
    const add = (text, cls) => controls.appendChild(el('span', cls || 'readout', text))
    add('A / D move')
    add('W jump (twice for a double)')
    add('Shift dash')
    add('mouse or ←/→ aim')
    add('space or click fire')
    add('1–3 weapon')
    add('R rocket')
    add('P pause')
    controls.appendChild(el('span', 'spacer'))
    const link = el('button', null, 'Restart')
    link.addEventListener('click', () => startGame())
    controls.appendChild(link)
  }

  function resize() {
    if (!stage) return
    p.resizeCanvas(stage.clientWidth, stage.clientHeight)
  }

  p.setup = () => {
    stage = document.getElementById('stage')
    controls = document.getElementById('controls')
    best = store.get()

    if (document.fonts && document.fonts.load) {
      document.fonts.load('16px "Patrick Hand"')
        .then(() => { handReady = true })
        .catch(() => {})
    }

    const renderer = p.createCanvas(stage.clientWidth, stage.clientHeight)
    p.frameRate(60)
    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.rectMode(p.CENTER)

    canvasEl = renderer.elt || renderer.canvas
    canvasEl.addEventListener('mousedown', onCanvasDown)
    canvasEl.addEventListener('mousemove', e => {
      const next = pointerFromEvent(e)
      if (Math.hypot(next.x - pointer.x, next.y - pointer.y) > 3) aimByMouse = true
      pointer = next
    })
    canvasEl.addEventListener('contextmenu', e => e.preventDefault())
    window.addEventListener('mouseup', () => { firing = false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', () => {
      keys.clear()
      firing = false
      if (mode === 'play') mode = 'pause'
    })

    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage)

    reset()
    buildControlsBar()
    layout()

    if (window.location.search.includes('debug')) {
      window.__lift = {
        state: () => ({
          mode, score, kills, hp: player.hp, weapon, best, shots, hits,
          invincible: player.invincible,
          permanent: player.invincible === Infinity,
          bombs: bombs.length,
          wave: waveIndex, wavePhase, waveT, bossNumber,
          animT,
          waveBanner: waveBanner && { text: waveBanner.text, sub: waveBanner.sub, life: waveBanner.life },
          combo, comboT, comboMult: comboMult(),
          dashT, dashCd,
          shieldT: player.shieldT, overdriveT: player.overdriveT,
          healthDropCd, pistolOnlyT,
          rescued,
          rescue: rescue && {
            phase: rescue.phase,
            q: rescue.question.q,
            options: rescue.question.options,
            answer: rescue.question.answer,
            picked: rescue.picked,
            x: rescue.x, y: rescue.y,
            ani: rescue.ani, pull: rescue.pull,
            panelT: rescue.panelT, hidden: rescue.hidden,
            jets: { on: rescue.jetOn.slice(), off: rescue.jetOff.slice() },
            aniFireT: rescue.aniFireT, aniShots: rescue.aniShots.length
          },
          camera: { zoom: camera.zoom, x: camera.x, y: camera.y },
          px: player.x, py: player.y, onGround: player.onGround,
          legSwing: player.onGround && Math.abs(player.vx) > 40 ? Math.sin(animT * 30) * 4 : 0,
          aim: player.aim, aimByMouse, recoilVx: player.recoilVx,
          bullets: bullets.length,
          ammo: { shotgun: ammo.shotgun, rocket: ammo.rocket, flame: ammo.flame },
          ammoInf: !isFinite(ammo.shotgun) && !isFinite(ammo.rocket) && !isFinite(ammo.flame),
          helis: helis.map(h => {
            const f = heliForces(h)
            return {
              x: h.x, y: h.y, vx: h.vx, vy: h.vy, hp: h.hp, maxHp: h.maxHp, heavy: h.heavy, type: h.type, burst: h.burst,
              ax: h.ax, ay: h.ay, tilt: h.tilt, armed: h.armed,
              charge: h.charge, pattern: h.pattern, enraged: h.enraged,
              lift: f.lift, weight: f.weight, thrust: f.thrust
            }
          }),
          crates: crates.map(c => ({
            x: c.x, y: c.y, vx: c.vx, vy: c.vy,
            vt: CRATE_VT, drag: c.dragMag, weight: CRATE_G,
            type: c.type, weapon: c.weapon
          })),
          rockets: bullets.filter(b => b.homing).map(b => ({
            x: b.x, y: b.y, vx: b.vx, vy: b.vy,
            ax: b.ax, ay: b.ay,
            target: b.target ? { x: b.target.x, y: b.target.y } : null
          })),
          planes: planes.length,
          planeXs: planes.map(pl => Math.round(pl.x)),
          supplyT, planeCooldown,
          particles: particles.length,
          flyers: flyers.length,
          flash: { ...hudFlash },
          platformTops: PLATFORMS.map(pl => pl.y),
          pickups: pickups.map(it => ({ x: it.x, y: it.y, type: it.type, weapon: it.weapon, landed: it.landed }))
        }),
        supply: () => { planeCooldown = 0; planes.length = 0; callSupply() },
        setScore: (v) => { score = v },
        spawn: (type) => { if (ENEMIES[type] && type !== 'gunship') spawnHeli(type) },
        spawnBoss: () => { spawnBoss() },
        setWave: (n) => { helis.length = 0; bullets.length = 0; bombs.length = 0; beginWave(n) },
        setWaveTime: (t) => { waveT = t },
        clear: () => { helis.length = 0 },
        killAll: () => { for (const h of helis.slice()) killHeli(h) },
        hurt: (d) => damagePlayer(d),
        spawnPickup: (type, x) => {
          pickups.push({
            x: x === undefined ? player.x : x,
            y: GROUND_Y - 10,
            type,
            weapon: type === 'weapon' ? 'shotgun' : null,
            life: 30, landed: true, t: 0
          })
        },
        pickup: (name) => collect({
          type: name === 'health' ? 'health' : (name === 'shield' || name === 'overdrive') ? name : 'weapon',
          weapon: name,
          x: player.x,
          y: player.y - 40
        }),
        equip: (name) => {
          if (name === 'rocket') { ammo.rocket = WEAPONS.rocket.max; return }
          if (!ORDER.includes(name)) return
          ammo[name] = WEAPONS[name].max
          weapon = name
        },
        setHp: (v) => { player.hp = clamp(v, 0, player.maxHp) },
        setPos: (x, y) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0 },
        rescueNow: () => {
          if (mode === 'play') {
            player.hp = 0
            beginRescue()
          }
        },
        answer: (i) => answerRescue(i)
      }
    }
  }

  p.windowResized = resize

  p.draw = () => {
    const dt = Math.min(p.deltaTime, 40) / 1000
    layout()
    titleT += dt

    if (mode === 'play') update(dt)
    else if (mode === 'rescue') updateRescue(dt)
    else if (mode === 'over') {
      updateParticles(dt)
      shake = Math.max(0, shake - shake * 9 * dt)
      hurtFlash = Math.max(0, hurtFlash - dt * 2.4)
    }

    render()
  }
}
