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
  const GROUND_Y = 556

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
    nighthawk: { hp: 180, r: 30, points: 500, speed: 2.0, alt: [140, 280], hover: [140, 300], travel: 560, anchor: [2.2, 3.4] }
  }
  const NIGHTHAWK_SCORE = 10000

  // -------------------------------------------------------------- weapons
  // `cd` is seconds between trigger pulls, `counts` feeds the accuracy stat.
  const WEAPONS = {
    pistol: { label: 'Pistol', short: 'Pistol', max: Infinity, dmg: 10, cd: 0.13, spread: 0.018, speed: 950, pellets: 1, size: 3, life: 1.1, color: C.ink, counts: true },
    shotgun: { label: 'Shotgun', short: 'Shotgun', max: 24, cap: 999, dmg: 9, cd: 0.52, spread: 0.17, speed: 820, pellets: 8, size: 2.6, life: 0.62, color: C.ink, counts: true, recoil: 275 },
    rocket: { label: 'Rocket', short: 'Rocket', max: 1, cap: 999, dmg: 280, cd: 0.85, spread: 0.012, speed: 45, pellets: 1, size: 4, life: 2.6, color: C.accent, counts: true, splash: 80, splashR: 85, kick: 150, homing: true },
    flame: { label: 'Flamethrower', short: 'Flame', max: 10, cap: 999, dmg: 7, speed: 520, size: 6, life: 0.85, color: C.flame }
  }
  const ORDER = ['pistol', 'shotgun', 'flame']

  // On-canvas buttons, shared by the drawing and the hit test.
  const PLAY_BTN = { x: W / 2, y: 268, w: 220, h: 62 }
  const AGAIN_BTN = { x: W / 2, y: 470, w: 240, h: 58 }

  // HUD weapon capsules, shared by the drawing and the pickup-flight target.
  const CAP_ORDER = ['pistol', 'shotgun', 'flame', 'rocket']
  const CAP_W = 118
  const CAP_H = 28
  const CAP_GAP = 8
  const CAP_X = 24
  const CAP_Y = H - 40

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
  let hudFlash = { pistol: 0, shotgun: 0, flame: 0, rocket: 0 }
  let nightSpawned = false
  let cheatBuf = ''
  let ammo, weapon
  let score, best, kills, shots, hits
  let elapsed = 0, spawnT = 0, dropIndex = 0, weaponDrop = 0, shake = 0, hurtFlash = 0, titleT = 0
  let supplyT = SUPPLY_FALLBACK, planeCooldown = 0
  let newBest = false

  let firing = false
  let keys = new Set()
  let aimByMouse = true
  let keyAim = Math.PI / 2   // keyboard aim, 0 = right, PI/2 = up, PI = left

  // -------------------------------------------------------------- helpers
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)
  const rgba = (c, a = 255) => `rgba(${c[0]},${c[1]},${c[2]},${a / 255})`

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

  // ------------------------------------------------------------ new game
  function reset() {
    player = {
      x: W / 2, y: GROUND_Y, vx: 0, vy: 0,
      w: 20, h: 32, onGround: true, jumps: 1,
      coyote: 0, buffer: 0, hp: 100, maxHp: 100,
      invuln: 0, aim: -Math.PI / 2, fireCd: 0, flash: 0, recoilVx: 0,
      invincible: 0
    }
    bullets = []
    helis = []
    pickups = []
    particles = []
    planes = []
    crates = []
    flyers = []
    bombs = []
    hudFlash = { pistol: 0, shotgun: 0, flame: 0, rocket: 0 }
    nightSpawned = false
    cheatBuf = ''
    ammo = { pistol: Infinity, shotgun: 0, rocket: 0, flame: 0 }
    weapon = 'pistol'
    score = 0
    kills = 0
    shots = 0
    hits = 0
    elapsed = 0
    spawnT = 1.1
    dropIndex = 0
    weaponDrop = 0
    supplyT = SUPPLY_FALLBACK
    planeCooldown = 0
    shake = 0
    hurtFlash = 0
    newBest = false
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

  function activateCheat(code) {
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
    if (e.code === 'KeyP' || e.code === 'Escape') {
      mode = mode === 'play' ? 'pause' : 'play'
      firing = false
      return
    }
    if (mode === 'pause') return

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
    if (name === 'pistol' || ammo[name] > 0) weapon = name
  }

  function cycleWeapon() {
    const i = ORDER.indexOf(weapon)
    for (let k = 1; k <= ORDER.length; k++) {
      const next = ORDER[(i + k) % ORDER.length]
      if (next === 'pistol' || ammo[next] > 0) {
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

    if (dir !== 0) {
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
    if (isFinite(ammo[weapon]) && ammo[weapon] <= 0) {
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

    if (isFinite(ammo[weapon])) {
      ammo[weapon]--
      if (ammo[weapon] <= 0) weapon = 'pistol'
    }

    player.fireCd = w.cd
    player.flash = 0.06
    player.vx -= Math.cos(player.aim) * (w.kick || 0) * 0.06
    player.vy -= Math.sin(player.aim) * (w.kick || 0) * 0.02
    if (w.recoil) player.recoilVx = -Math.cos(player.aim) * w.recoil
  }

  // A heavy, continuous jet: the tank drains while the trigger is held, so a
  // full 10 ammo lasts five seconds. Particles are emitted every few frames.
  function flameTick(dt) {
    if (ammo.flame <= 0) {
      weapon = 'pistol'
      return
    }
    ammo.flame = Math.max(0, ammo.flame - FLAME_DRAIN * dt)
    if (player.fireCd > 0) return
    player.fireCd = FLAME_EMIT

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
    if (ammo.flame <= 0) weapon = 'pistol'
  }

  // Rockets are a special item: R launches one whatever gun is equipped.
  function launchRocket() {
    if (mode !== 'play' || ammo.rocket <= 0) return
    ammo.rocket--

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
    player.hp -= dmg
    player.invuln = 0.85
    shake = Math.max(shake, 7)
    hurtFlash = 1
    burst(player.x, player.y - 16, 8, C.danger, 160)

    if (player.hp <= 0) {
      player.hp = 0
      die()
    }
  }

  function die() {
    mode = 'over'
    firing = false
    shake = 14
    burst(player.x, player.y - 16, 30, C.ink, 320)
    burst(player.x, player.y - 16, 14, C.accent, 240)
    if (score > best) {
      best = score
      newBest = true
      store.set(best)
    }
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
    return Math.min(1 + elapsed / 50, 4.5)
  }

  // The roster opens up with score; the weights are the only gate.
  function pickEnemyType() {
    const r = p.random()
    if (score >= NIGHTHAWK_SCORE) {
      if (r < 0.18) return 'nighthawk'
      if (r < 0.38) return 'bomber'
      if (r < 0.64) return 'heavy'
      return 'scout'
    }
    if (score >= 5000) {
      if (r < 0.07) return 'bomber'
      if (r < 0.40) return 'heavy'
      return 'scout'
    }
    if (score >= 1000) {
      if (r < 0.32) return 'heavy'
      return 'scout'
    }
    return 'scout'
  }

  function spawnHeli(forcedType) {
    const d = difficulty()
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
      hit: 0
    })
  }

  function updateHelis(dt) {
    const d = difficulty()

    for (let i = helis.length - 1; i >= 0; i--) {
      const h = helis[i]
      h.rotor += dt * 26
      h.tailRotor = (h.tailRotor || 0) + dt * 55
      h.hit = Math.max(0, h.hit - dt)
      h.phase += dt

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

      if (h.armed) {
        if (h.burst > 0) {
          h.burstT -= dt
          if (h.burstT <= 0) {
            fireHeli(h, d, h.type === 'nighthawk' ? 6 : 12)
            h.burst--
            h.burstT = h.type === 'nighthawk' ? 0.09 : 0.13
          }
        }

        h.fireT -= dt
        if (h.fireT <= 0) {
          if (h.type === 'heavy') {
            h.burst = 3
            h.burstT = 0
          } else if (h.type === 'nighthawk') {
            h.burst = 12
            h.burstT = 0
          } else if (h.type === 'bomber') {
            dropBomb(h)
          } else {
            fireHeli(h, d)
          }
          const gap = clamp(2.5 - d * 0.25, 0.9, 2.5) + p.random(0, 0.6)
          h.fireT = h.type === 'nighthawk' ? gap * 2 : gap
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
  const BOMB_FRAC = 0.34

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
      p.push()
      p.translate(b.x, b.y)
      p.noStroke()
      p.fill(...C.ink)
      p.circle(0, 0, b.r * 2)
      p.triangle(-b.r + 1, -2, -b.r - 4, -7, -b.r + 1, 3)
      p.triangle(b.r - 1, -2, b.r + 4, -7, b.r - 1, 3)
      p.fill(...C.flame)
      p.circle(0, -b.r - 3, 3 + Math.sin(p.frameCount * 0.9) * 1.2)
      p.pop()
    }
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
    score += ENEMIES[h.type].points
    shake = Math.max(shake, h.r >= 38 ? 10 : 6)
    burst(h.x, h.y, h.r >= 38 ? 26 : 16, C.ink, 300)
    burst(h.x, h.y, 10, C.accent, 220)
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

  function dropCrate(pl) {
    const health = dropIndex % 3 === 2
    const weaponName = ['shotgun', 'rocket', 'flame'][weaponDrop % 3]
    if (!health) weaponDrop++
    dropIndex++
    crates.push({
      x: pl.x,
      y: pl.y + 24,
      vx: pl.vx * 0.25,
      vy: 0,
      type: health ? 'health' : 'weapon',
      weapon: health ? null : weaponName,
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
      player.hp = Math.min(player.maxHp, player.hp + 35)
      burst(it.x, it.y, 8, C.good, 120)
      return
    }
    const w = WEAPONS[it.weapon]
    if (isFinite(ammo[it.weapon])) {
      ammo[it.weapon] = Math.min(w.cap, ammo[it.weapon] + w.max)
    }
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

  // ----------------------------------------------------------------- ticks
  function spawnTick(dt) {
    const d = difficulty()
    spawnT -= dt
    const maxHelis = Math.min(Math.floor(0.5 + d * 0.85), 6)
    if (spawnT <= 0 && helis.length < maxHelis) {
      spawnHeli()
      spawnT = clamp(2.6 - d * 0.42, 0.85, 2.6)
    }
  }

  function update(dt) {
    elapsed += dt
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
    spawnTick(dt)

    // First nighthawk is guaranteed the moment the score hits 10k.
    if (!nightSpawned && score >= NIGHTHAWK_SCORE) {
      spawnHeli('nighthawk')
      nightSpawned = true
    }

    supplyT -= dt
    planeCooldown = Math.max(0, planeCooldown - dt)
    if (supplyT <= 0) callSupply()

    player.invuln = Math.max(0, player.invuln - dt)
    player.invincible = Math.max(0, player.invincible - dt)
    player.flash = Math.max(0, player.flash - dt)
    shake = Math.max(0, shake - shake * 9 * dt)
    hurtFlash = Math.max(0, hurtFlash - dt * 2.4)

    if (helis.length === 0 && spawnT > 0) spawnT = Math.min(spawnT, 0.8)
  }

  // ---------------------------------------------------------------- render
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
    drawHud()
    drawFlyers()
    drawOverlay()

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

  function drawPlayer() {
    if (mode === 'over') return
    if (player.invuln > 0 && Math.floor(player.invuln * 22) % 2 === 0) return

    const ax = Math.cos(player.aim)
    const ay = Math.sin(player.aim)
    const cx = player.x
    const cy = player.y
    const seed = 400

    // legs
    p.stroke(...C.ink)
    p.strokeWeight(3)
    const run = player.onGround && Math.abs(player.vx) > 40 ? Math.sin(p.frameCount * 0.5) * 4 : 0
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

  function drawHeli(h) {
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
  function drawCrateFace(cx, cy, type, weapon) {
    const good = type === 'health'
    const col = good ? C.good : C.accent
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
      p.text(c.type === 'health' ? 'HEALTH' : WEAPONS[c.weapon].short.toUpperCase(), c.x, c.y + 40)
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
      const label = it.type === 'health' ? '+HEALTH' : WEAPONS[it.weapon].label.toUpperCase()
      p.text(label, it.x, it.y + 20)
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

  // ------------------------------------------------------------------- hud
  function drawHud() {
    if (mode === 'title') return

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
    const by = H - 66
    p.textAlign(p.LEFT, p.BOTTOM)
    p.fill(...C.muted)
    p.textSize(12)
    p.text('HEALTH', 26, by - 12)
    p.fill(...C.line)
    p.rect(26 + bw / 2, by, bw, 12, 6)
    const frac = clamp(player.hp / player.maxHp, 0, 1)
    if (frac > 0) {
      const inv = player.invincible > 0
      const cyanOn = Math.floor(p.frameCount / 8) % 2 === 0
      const col = inv
        ? (cyanOn ? C.cyan : [165, 243, 252])
        : (frac > 0.35 ? C.accent : C.danger)
      p.fill(...col)
      p.rect(26 + (bw * frac) / 2, by, bw * frac, 12, 6)
    }

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
      p.text('Jump: W', W / 2, 369)
      p.text('Aim: mouse or ←/→', W / 2, 396)
      p.text('Shoot: click or spacebar', W / 2, 423)
      p.text('Launch rocket: R', W / 2, 450)

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
      p.fill(251, 251, 253, 165)
      p.rect(W / 2, H / 2, W, H)
      panel(W / 2, 330, 460, 400)

      p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
      p.noStroke()
      p.fill(...C.ink)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(56)
      p.text('Game Over', W / 2, 196)

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
          nightSpawned, bombs: bombs.length,
          px: player.x, py: player.y, onGround: player.onGround,
          aim: player.aim, aimByMouse, recoilVx: player.recoilVx,
          bullets: bullets.length,
          ammo: { shotgun: ammo.shotgun, rocket: ammo.rocket, flame: ammo.flame },
          ammoInf: !isFinite(ammo.shotgun) && !isFinite(ammo.rocket) && !isFinite(ammo.flame),
          helis: helis.map(h => {
            const f = heliForces(h)
            return {
              x: h.x, y: h.y, vx: h.vx, vy: h.vy, hp: h.hp, heavy: h.heavy, type: h.type, burst: h.burst,
              ax: h.ax, ay: h.ay, tilt: h.tilt, armed: h.armed,
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
        spawn: (type) => { if (ENEMIES[type]) spawnHeli(type) },
        clear: () => { helis.length = 0 },
        pickup: (name) => collect({
          type: name === 'health' ? 'health' : 'weapon',
          weapon: name,
          x: player.x,
          y: player.y - 40
        }),
        equip: (name) => {
          if (name === 'rocket') { ammo.rocket = WEAPONS.rocket.max; return }
          if (!ORDER.includes(name)) return
          ammo[name] = WEAPONS[name].max
          weapon = name
        }
      }
    }
  }

  p.windowResized = resize

  p.draw = () => {
    const dt = Math.min(p.deltaTime, 40) / 1000
    layout()
    titleT += dt

    if (mode === 'play') update(dt)
    else if (mode === 'over') {
      updateParticles(dt)
      shake = Math.max(0, shake - shake * 9 * dt)
      hurtFlash = Math.max(0, hurtFlash - dt * 2.4)
    }

    render()
  }
}
