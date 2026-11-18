// Static vs. Kinetic Friction — a hand-drawn 1-D friction sandbox.
//
// A crate sits on a rough floor. The applied force and the crate's mass are
// typed in, the surface is picked from a short list of real-world friction
// pairs, and the push direction is a pair of buttons. The camera is locked to
// the crate, so the crate stays put and the ground marks, fence, bushes and
// hills scroll past to show motion.
//
// Two floating free-body diagrams update every frame:
//   1. all forces (F_N, F_g, F_app, and F_s or F_k)
//   2. the net force alone
// A third card beside the crate reports the velocity and whether the crate is
// speeding up, slowing down, moving at constant velocity, or at rest.
//
// The friction model is the usual static / kinetic one:
//   F_g = mg, F_N = F_g, F_s,max = mu_s F_N, F_k = mu_k F_N
//   at rest:  |F_app| <= F_s,max  ->  F_s = -F_app, F_net = 0
//   sliding:  F_k opposes v, so the net force may brake the crate
//   at v = 0 the static check runs again, so the crate sticks cleanly instead
//   of jittering through zero or flipping its friction direction.
//
// p5 instance-mode sketch, no assets. The world is a fixed 960x640 logical
// space scaled to fit the stage, so the layout never depends on window size.
export default function sketch(p) {
  // ---------------------------------------------------------------- world
  const W = 960
  const H = 640
  const GROUND_Y = 566
  const BOX_X = W / 2
  const BOX_W = 150
  const BOX_H = 122
  const G = 9.8

  const PX_PER_M = 46       // background scroll, pixels per metre
  const PX_PER_N = 0.6      // fixed force scale, shared by both diagrams
  const ARROW_MAX = 120
  const EPS_V = 0.05        // below this the crate counts as motionless
  const EPS_A = 0.02        // below this the acceleration counts as zero
  const PUSH_MAX = 200
  const MASS_MIN = 1
  const MASS_MAX = 10

  // Floating diagram cards, above the crate.
  const CARD1 = { x: 250, y: 8, w: 460, h: 244 }
  const CARD2 = { x: 290, y: 268, w: 380, h: 116 }
  const DOT1 = { x: 480, y: 138 }
  const DOT2 = { x: 480, y: 342 }
  const VEL_CARD = { x: BOX_X + BOX_W / 2 + 30, y: 446, w: 236, h: 112 }

  // Projector-friendly type sizes.
  const TYPE = {
    title: 22,
    force: 20,
    foot: 17,
    chip: 17,
    netValue: 20,
    caption: 15,
    box: 28,
    velocity: 26,
    accel: 19,
    state: 18
  }

  // --------------------------------------------------------------- colour
  const C = {
    ink: [31, 41, 55],
    pencil: [51, 65, 85],
    muted: [107, 114, 128],
    faint: [156, 163, 175],
    line: [203, 213, 225],
    paper: [251, 251, 253],
    card: [255, 255, 255],
    applied: [11, 87, 208],
    normal: [13, 148, 136],
    gravity: [220, 38, 38],
    friction: [217, 119, 6],
    net: [109, 40, 217],
    warn: [180, 83, 9],
    bad: [185, 28, 28],
    hillFar: [233, 238, 244],
    hillNear: [222, 231, 241],
    cloud: [236, 242, 249],
    foliage: [182, 199, 186],
    foliageLine: [140, 163, 145],
    trunk: [146, 128, 105]
  }

  // Every surface pair carries its own floor texture and crate finish.
  // `pattern` picks the floor drawing, `prop` adds the crate decoration.
  const THEMES = {
    glass: {
      pattern: 'glass',
      prop: 'gloss',
      floor: [242, 247, 253],
      line: [208, 222, 238],
      accent: [170, 195, 220],
      dust: [176, 198, 220],
      box: [247, 250, 254],
      boxEdge: [128, 148, 172],
      boxLine: [210, 222, 236],
      label: [31, 41, 55]
    },
    snow: {
      pattern: 'snow',
      prop: null,
      floor: [250, 252, 255],
      drift: [228, 239, 252],
      line: [219, 231, 246],
      accent: [180, 202, 228],
      dust: [214, 230, 246],
      box: [152, 42, 40],
      boxEdge: [96, 22, 20],
      boxLine: [190, 70, 64],
      label: [250, 250, 252]
    },
    tile: {
      pattern: 'tile',
      prop: 'gloss',
      floor: [236, 247, 247],
      line: [199, 222, 224],
      accent: [143, 190, 200],
      dust: [168, 205, 212],
      box: [226, 178, 148],
      boxEdge: [166, 116, 90],
      boxLine: [205, 152, 122],
      label: [31, 41, 55]
    },
    wood: {
      pattern: 'wood',
      prop: null,
      floor: [246, 239, 227],
      line: [224, 209, 187],
      accent: [196, 173, 140],
      dust: [188, 168, 140],
      box: [238, 225, 205],
      boxEdge: [143, 112, 78],
      boxLine: [214, 194, 164],
      label: [31, 41, 55]
    },
    road: {
      pattern: 'road',
      prop: null,
      floor: [233, 236, 240],
      line: [206, 212, 219],
      accent: [145, 153, 164],
      dust: [150, 158, 170],
      box: [76, 82, 90],
      boxEdge: [44, 49, 56],
      boxLine: [112, 120, 130],
      label: [248, 250, 252],
      lane: [250, 250, 252]
    },
    f1: {
      pattern: 'road',
      prop: null,
      floor: [227, 231, 236],
      line: [199, 206, 214],
      accent: [138, 146, 158],
      dust: [146, 154, 166],
      box: [66, 72, 80],
      boxEdge: [38, 43, 50],
      boxLine: [100, 108, 118],
      label: [248, 250, 252],
      lane: [250, 250, 252],
      curb: [206, 52, 48]
    }
  }

  // Common classroom friction pairs, slick to grippy.
  const SURFACES = [
    { name: 'Frictionless', mus: 0, muk: 0, theme: THEMES.glass },
    { name: 'Ski on snow', mus: 0.1, muk: 0.05, theme: THEMES.snow },
    { name: 'Foot on wet tile', mus: 0.3, muk: 0.2, theme: THEMES.tile },
    { name: 'Chair on floor', mus: 0.5, muk: 0.4, theme: THEMES.wood },
    { name: 'Regular car tire on road', mus: 0.9, muk: 0.7, theme: THEMES.road },
    { name: 'Formula 1 tire on road', mus: 1.8, muk: 1.6, theme: THEMES.f1 }
  ]
  const DEFAULT_SURFACE = 3

  // ---------------------------------------------------------------- state
  let mass = 10        // kg
  let mus = SURFACES[DEFAULT_SURFACE].mus
  let muk = SURFACES[DEFAULT_SURFACE].muk
  let surfaceIndex = DEFAULT_SURFACE
  let surfaceStyle = SURFACES[DEFAULT_SURFACE].theme
  let push = 30        // N, magnitude
  let dir = 1          // +1 right, -1 left
  let paused = false

  let v = 0            // m/s, signed
  // Displacement from the start. The camera is locked to the crate, so the
  // world is drawn at -x: the background scroll rate is exactly v * PX_PER_M,
  // with no cap, or the background would lie about the indicated velocity.
  let x = 0
  let dustAcc = 0
  let dust = []

  // Logical units of letterbox margin on each side of the fixed 960x640 world.
  // The background bleeds out to these so the scene fills the whole stage.
  let viewPadX = 0
  let viewPadY = 0

  let stage, controls
  let handReady = false

  let pushInput, leftBtn, rightBtn, pauseBtn, readout
  let massInput, surfaceSelect, muVal

  // -------------------------------------------------------------- helpers
  const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val))
  const fmtF = (val) => {
    const a = Math.abs(val)
    if (a < 0.05) return '0'
    const s = a.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  const fmtNum = (n) => String(Number(n.toFixed(2)))
  const dirArrow = (val) => (val > 0.005 ? ' \u2192' : val < -0.005 ? ' \u2190' : '')

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  // ------------------------------------------------------------ rough ink
  // Deterministic seeded wobble, so nothing shimmers at 60 fps.
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
      p.quadraticVertex(
        (x1 + x2) / 2 + nx * bow,
        (y1 + y2) / 2 + ny * bow,
        x2 + ox,
        y2 + oy
      )
      p.endShape()
    }
  }

  function roughRect(x, y, w, h, seed = 0, amp = ROUGH) {
    roughLine(x, y, x + w, y, seed + 1, amp)
    roughLine(x + w, y, x + w, y + h, seed + 2, amp)
    roughLine(x + w, y + h, x, y + h, seed + 3, amp)
    roughLine(x, y + h, x, y, seed + 4, amp)
  }

  function roundRectPoints(x, y, w, h, rad, per = 4) {
    const pts = []
    const corners = [
      [x + w - rad, y + rad, -Math.PI / 2, 0],
      [x + w - rad, y + h - rad, 0, Math.PI / 2],
      [x + rad, y + h - rad, Math.PI / 2, Math.PI],
      [x + rad, y + rad, Math.PI, Math.PI * 1.5]
    ]
    for (const [cx, cy, a0, a1] of corners) {
      for (let i = 0; i <= per; i++) {
        const a = a0 + (a1 - a0) * (i / per)
        pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
      }
    }
    return pts
  }

  function strokeLoop(pts, seed = 0, amp = ROUGH) {
    p.noFill()
    for (let pass = 0; pass < 2; pass++) {
      p.beginShape()
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]
        const s = seed + i * 2.3 + pass * 11.7
        p.vertex(q[0] + jit(s, amp * 0.5), q[1] + jit(s + 5.1, amp * 0.5))
      }
      p.endShape(p.CLOSE)
    }
  }

  function blobPoints(cx, cy, w, h, seed = 0, amp = ROUGH, n = 20) {
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * p.TWO_PI
      const k = jit(seed + i * 1.7, amp)
      pts.push([cx + Math.cos(a) * (w / 2 + k), cy + Math.sin(a) * (h / 2 + k)])
    }
    return pts
  }

  function fillBlob(cx, cy, w, h, color, seed = 0, amp = ROUGH) {
    const pts = blobPoints(cx, cy, w, h, seed, amp)
    p.noStroke()
    p.fill(...color)
    p.beginShape()
    for (const q of pts) p.vertex(q[0], q[1])
    p.endShape(p.CLOSE)
    return pts
  }

  function dot(x, y, r, color) {
    p.noStroke()
    p.fill(...color)
    p.beginShape()
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * p.TWO_PI
      const k = jit(991 + i * 1.7, 0.9)
      p.vertex(x + Math.cos(a) * (r + k), y + Math.sin(a) * (r + k))
    }
    p.endShape(p.CLOSE)
  }

  // --------------------------------------------------------------- labels
  // Draws a force label with a real subscript, e.g. F + "app" = 60 N.
  function drawSub(parts, x, y, align = 'LEFT', size = TYPE.force, color = C.ink) {
    const smallSize = size * 0.68
    const widths = parts.map((pt) => {
      p.textSize(pt.sub || pt.sup ? smallSize : size)
      return p.textWidth(pt.t)
    })
    const total = widths.reduce((a, b) => a + b, 0)
    let cx = align === 'CENTER' ? x - total / 2 : align === 'RIGHT' ? x - total : x
    p.fill(...color)
    p.textAlign(p.LEFT, p.BASELINE)
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i]
      p.textSize(pt.sub || pt.sup ? smallSize : size)
      const dy = pt.sub ? size * 0.3 : pt.sup ? -size * 0.34 : 0
      p.text(pt.t, cx, y + dy)
      cx += widths[i]
    }
  }

  const forceSym = (sub, value, unit = 'N') => [
    { t: 'F' },
    { t: sub, sub: true },
    { t: ` = ${fmtF(value)} ${unit}` }
  ]

  // Width of a label before drawing it, so short arrows can push their label
  // clear of the vertical force arrows.
  function subWidth(parts, size = TYPE.force) {
    const subSize = size * 0.68
    return parts.reduce((sum, pt) => {
      p.textSize(pt.sub ? subSize : size)
      return sum + p.textWidth(pt.t)
    }, 0)
  }

  // ------------------------------------------------------------- physics
  function computeForces() {
    const Fg = mass * G
    const Fn = Fg
    const fapp = push * dir
    const FsMax = mus * Fn
    const Fk = muk * Fn
    const atRest = Math.abs(v) < EPS_V

    let friction = 0
    let kind = 'static'
    if (atRest) {
      if (Math.abs(fapp) <= FsMax) {
        friction = -fapp
        kind = 'static'
      } else {
        friction = -Math.sign(fapp) * Fk
        kind = 'kinetic'
      }
    } else {
      friction = -Math.sign(v) * Fk
      kind = 'kinetic'
    }

    const net = fapp + friction
    return { Fg, Fn, fapp, FsMax, Fk, friction, kind, net, a: net / mass }
  }

  function update(dt) {
    const f = computeForces()
    if (Math.abs(v) < EPS_V) {
      if (Math.abs(f.fapp) <= f.FsMax) {
        v = 0
      } else {
        v += f.a * dt
        x += v * dt
      }
    } else {
      const vn = v + f.a * dt
      if (vn * v < 0) {
        // Stop at zero; the static check decides what happens next frame.
        v = 0
      } else {
        v = vn
        x += v * dt
      }
    }

    // Kick up dust behind the sliding crate.
    if (Math.abs(v) > 0.3) {
      dustAcc += Math.abs(v) * dt * 16
      while (dustAcc >= 1) {
        dustAcc -= 1
        spawnDust()
      }
    }
  }

  function spawnDust() {
    const back = -Math.sign(v)
    dust.push({
      // Scatter across the whole contact patch, not just the trailing corner.
      x: BOX_X - BOX_W / 2 + p.random() * BOX_W,
      y: GROUND_Y - 3 + (p.random() - 0.5) * 6,
      vx: back * (18 + p.random() * 55),
      vy: -8 - p.random() * 26,
      life: 0.45 + p.random() * 0.4,
      max: 0.85,
      r: 2 + p.random() * 3.5
    })
    if (dust.length > 60) dust.shift()
  }

  function updateDust(dt) {
    for (const d of dust) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 42 * dt
      d.life -= dt
    }
    dust = dust.filter((d) => d.life > 0)
  }

  function reset() {
    v = 0
    x = 0
    dust = []
    dustAcc = 0
  }

  // -------------------------------------------------------------- arrows
  const arrowLen = (F) => {
    const a = Math.abs(F)
    if (a < 0.5) return 0
    return clamp(a * PX_PER_N, 8, ARROW_MAX)
  }

  function arrow(x1, y1, x2, y2, color, seed) {
    p.stroke(...color)
    p.strokeWeight(2.2)
    roughLine(x1, y1, x2, y2, seed, 0.5)
    const a = Math.atan2(y2 - y1, x2 - x1)
    const hl = 12
    p.strokeWeight(2)
    roughLine(
      x2,
      y2,
      x2 - Math.cos(a - 0.42) * hl,
      y2 - Math.sin(a - 0.42) * hl,
      seed + 5.1,
      0.3
    )
    roughLine(
      x2,
      y2,
      x2 - Math.cos(a + 0.42) * hl,
      y2 - Math.sin(a + 0.42) * hl,
      seed + 9.3,
      0.3
    )
  }

  // --------------------------------------------------------------- cards
  function drawCard(c, seed) {
    p.noStroke()
    p.fill(31, 41, 55, 14)
    p.rect(c.x + 2, c.y + 5, c.w, c.h, 12)
    p.fill(...C.card)
    p.rect(c.x, c.y, c.w, c.h, 12)
    p.stroke(...C.pencil)
    p.strokeWeight(1.7)
    strokeLoop(roundRectPoints(c.x, c.y, c.w, c.h, 12), seed, 0.55)
  }

  function drawChip(rightX, cy, text, fg, bg, seed) {
    p.textSize(TYPE.chip)
    const w = p.textWidth(text) + 20
    const h = 26
    const x = rightX - w
    p.noStroke()
    p.fill(...bg)
    p.rect(x, cy - h / 2, w, h, 13)
    p.stroke(...fg)
    p.strokeWeight(1.4)
    strokeLoop(roundRectPoints(x, cy - h / 2, w, h, 13, 3), seed, 0.45)
    p.fill(...fg)
    p.textAlign(p.CENTER, p.CENTER)
    p.text(text, x + w / 2, cy + 1)
  }

  function drawFBD(f) {
    drawCard(CARD1, 801)

    p.fill(...C.ink)
    p.textSize(TYPE.title)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Free-body diagram', CARD1.x + 20, CARD1.y + 30)

    const rest = f.kind === 'static'
    drawChip(
      CARD1.x + CARD1.w - 18,
      CARD1.y + 30,
      rest ? 'at rest' : 'sliding',
      rest ? C.normal : C.warn,
      rest ? [227, 243, 240] : [253, 240, 224],
      811
    )

    const d = DOT1
    const lenN = arrowLen(f.Fn)
    const lenG = arrowLen(f.Fg)
    const lenA = arrowLen(f.fapp)
    const lenF = arrowLen(f.friction)

    if (lenG > 0) arrow(d.x, d.y, d.x, d.y + lenG, C.gravity, 821)
    if (lenN > 0) arrow(d.x, d.y, d.x, d.y - lenN, C.normal, 831)
    if (lenA > 0) {
      arrow(d.x, d.y, d.x + Math.sign(f.fapp) * lenA, d.y, C.applied, 841)
    }
    if (lenF > 0) {
      arrow(d.x, d.y, d.x + Math.sign(f.friction) * lenF, d.y, C.friction, 851)
    }

    dot(d.x, d.y, 6, C.ink)

    // Keep the vertical labels clear of the horizontal arrows even when a
    // light box makes F_N and F_g short.
    if (lenN > 0) {
      drawSub(
        forceSym('N', f.Fn),
        d.x + 12,
        d.y - Math.max(lenN, 52) + 5,
        'LEFT',
        TYPE.force,
        C.normal
      )
    }
    if (lenG > 0) {
      drawSub(
        forceSym('g', f.Fg),
        d.x + 12,
        d.y + Math.max(lenG, 52) + 5,
        'LEFT',
        TYPE.force,
        C.gravity
      )
    }
    if (lenA > 0) {
      const parts = forceSym('app', f.fapp)
      const clear = subWidth(parts, TYPE.force) / 2 + 14
      const tx = d.x + Math.sign(f.fapp) * Math.max(lenA, clear)
      drawSub(parts, tx, d.y - 14, 'CENTER', TYPE.force, C.applied)
    }
    if (lenF > 0) {
      const sym = f.kind === 'static' ? 's' : 'k'
      const parts = forceSym(sym, f.friction)
      const clear = subWidth(parts, TYPE.force) / 2 + 14
      const tx = d.x + Math.sign(f.friction) * Math.max(lenF, clear)
      drawSub(parts, tx, d.y + 28, 'CENTER', TYPE.force, C.friction)
    }

    drawSub(
      [
        { t: 'F' },
        { t: 's,max', sub: true },
        { t: ` = ${fmtF(f.FsMax)} N` },
        { t: '    \u00b7    ' },
        { t: 'F' },
        { t: 'k', sub: true },
        { t: ` = ${fmtF(f.Fk)} N` }
      ],
      CARD1.x + 20,
      CARD1.y + 232,
      'LEFT',
      TYPE.foot,
      C.muted
    )
  }

  function drawNet(f) {
    drawCard(CARD2, 901)

    p.fill(...C.ink)
    p.textSize(TYPE.title)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Net force', CARD2.x + 20, CARD2.y + 28)

    const zero = Math.abs(f.net) < 0.05
    drawSub(
      [
        { t: 'F' },
        { t: 'net', sub: true },
        { t: ` = ${fmtF(f.net)} N` }
      ],
      CARD2.x + CARD2.w - 18,
      CARD2.y + 28,
      'RIGHT',
      TYPE.netValue,
      zero ? C.muted : C.net
    )

    const len = arrowLen(f.net)
    if (len > 0) {
      const tx = DOT2.x + Math.sign(f.net) * len
      arrow(DOT2.x, DOT2.y, tx, DOT2.y, C.net, 911)
      drawSub(
        [
          { t: 'F' },
          { t: 'net', sub: true }
        ],
        DOT2.x + Math.sign(f.net) * Math.max(len, 42),
        DOT2.y - 16,
        'CENTER',
        TYPE.force,
        C.net
      )
    } else {
      p.noFill()
      p.stroke(...C.faint)
      p.strokeWeight(1.3)
      p.circle(DOT2.x, DOT2.y, 20)
    }

    dot(DOT2.x, DOT2.y, 5.5, C.ink)

    p.fill(...C.muted)
    p.textSize(TYPE.caption)
    p.textAlign(p.CENTER, p.BASELINE)
    p.text(zero ? 'balanced' : 'unbalanced', DOT2.x, DOT2.y + 32)
  }

  function velocityState(f) {
    const speed = Math.abs(v)
    const accel = Math.abs(f.a)
    if (speed < EPS_V && accel < EPS_A) return { text: 'at rest', color: C.muted }
    if (accel < EPS_A) return { text: 'constant velocity', color: C.normal }
    if (f.a * v >= 0) return { text: 'speeding up', color: C.warn }
    return { text: 'slowing down', color: C.bad }
  }

  function drawVelocity(f) {
    drawCard(VEL_CARD, 771)

    const speed = Math.abs(v)
    const vTxt = speed < 0.05 ? '0' : speed.toFixed(1)
    const x = VEL_CARD.x + 20

    p.fill(...C.ink)
    p.textSize(TYPE.velocity)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(`v = ${vTxt} m/s${dirArrow(v)}`, x, VEL_CARD.y + 34)

    drawSub(
      [
        { t: `a = ${Math.abs(f.a).toFixed(2)} m/s` },
        { t: '2', sup: true },
        { t: dirArrow(f.a) }
      ],
      x,
      VEL_CARD.y + 64,
      'LEFT',
      TYPE.accel,
      C.ink
    )

    const state = velocityState(f)
    p.fill(...state.color)
    p.textSize(TYPE.state)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(state.text, x, VEL_CARD.y + 92)
  }

  // --------------------------------------------------------------- scene
  function drawHillLayer(factor, baseY, amp, period, color, phase) {
    const off = x * PX_PER_M * factor
    const left = -viewPadX - 20
    const right = W + viewPadX + 20
    p.noStroke()
    p.fill(...color)
    p.beginShape()
    p.vertex(left, GROUND_Y + 2)
    for (let sx = left; sx <= right; sx += 6) {
      const a = (sx + off) / period
      const y =
        baseY -
        amp * (0.55 + 0.3 * Math.sin(a + phase) + 0.15 * Math.sin(a * 2.7 + phase * 1.7))
      p.vertex(sx, y)
    }
    p.vertex(right, GROUND_Y + 2)
    p.endShape(p.CLOSE)
  }

  function drawHills() {
    drawHillLayer(0.16, 500, 44, 140, C.hillFar, 0.8)
    drawHillLayer(0.3, 532, 32, 92, C.hillNear, 2.1)
  }

  // A slow, wrapping cloud bank that fills the sky between the diagram cards
  // and the horizon.
  function drawClouds() {
    const period = 360
    const n = 4
    const cycle = period * n
    const shift = (((x * PX_PER_M * 0.06) % cycle) + cycle) % cycle
    for (let i = -1; i <= n + 2; i++) {
      const idx = ((i % n) + n) % n
      const bx = i * period + 90 - shift
      if (bx < -viewPadX - 180 || bx > W + viewPadX + 180) continue
      const cy = 400 + hash(idx * 5.3) * 34
      const s = 0.75 + hash(idx * 8.1) * 0.5
      const w = 132 * s
      const h = 38 * s
      const seed = idx * 3.1
      fillBlob(bx - w * 0.22, cy + h * 0.08, w * 0.55, h * 0.8, C.cloud, seed + 1.3, 2.2)
      fillBlob(bx + w * 0.02, cy - h * 0.12, w * 0.62, h * 1.0, C.cloud, seed + 8.7, 2.2)
      fillBlob(bx + w * 0.28, cy + h * 0.1, w * 0.48, h * 0.72, C.cloud, seed + 15.1, 2.2)
    }
  }

  function drawTrees() {
    const period = 5.5
    const factor = 0.55
    const span = (W / 2 + viewPadX) / (PX_PER_M * factor) + 8
    const k0 = Math.floor((x - span) / period)
    const k1 = Math.ceil((x + span) / period)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period + hash(k * 3.7) * 2.4
      const sx = BOX_X + (wx - x) * PX_PER_M * factor
      if (sx < -viewPadX - 70 || sx > W + viewPadX + 70) continue
      const h = 50 + hash(k * 7.3) * 30
      const baseY = GROUND_Y - 10
      p.stroke(...C.trunk)
      p.strokeWeight(2.2)
      roughLine(sx, baseY, sx + jit(k * 2.1, 3), baseY - h * 0.6, k * 2.1, 0.6)
      const cy = baseY - h * 0.78
      const rw = 30 + hash(k * 9.1) * 22
      const rh = 26 + hash(k * 4.3) * 18
      p.stroke(...C.foliageLine)
      p.strokeWeight(1.5)
      const pts = fillBlob(sx, cy, rw, rh, C.foliage, k * 4.1, 1.2)
      strokeLoop(pts, k * 4.1, 0.9)
    }
  }

  function drawFence() {
    const period = 2.4
    const factor = 0.88
    const span = (W / 2 + viewPadX) / (PX_PER_M * factor) + 4
    const k0 = Math.floor((x - span) / period)
    const k1 = Math.ceil((x + span) / period)
    const baseY = GROUND_Y - 4
    const postH = 30
    p.stroke(...C.faint)
    p.strokeWeight(1.6)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period
      const sx = BOX_X + (wx - x) * PX_PER_M * factor
      roughLine(sx, baseY, sx, baseY - postH, k * 3.3, 0.4)
    }
    // Two rails between consecutive posts.
    for (let k = k0; k <= k1; k++) {
      const x0 = BOX_X + (k * period - x) * PX_PER_M * factor
      const x1 = BOX_X + ((k + 1) * period - x) * PX_PER_M * factor
      if (x1 < -viewPadX - 10 || x0 > W + viewPadX + 10) continue
      roughLine(x0, baseY - postH * 0.45, x1, baseY - postH * 0.45, k * 5.1, 0.4)
      roughLine(x0, baseY - postH * 0.85, x1, baseY - postH * 0.85, k * 6.7, 0.4)
    }
  }

  function drawBushes() {
    const period = 3.3
    const factor = 0.94
    const span = (W / 2 + viewPadX) / (PX_PER_M * factor) + 4
    const k0 = Math.floor((x - span) / period)
    const k1 = Math.ceil((x + span) / period)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period + hash(k * 1.9) * 1.4
      const sx = BOX_X + (wx - x) * PX_PER_M * factor
      if (sx < -viewPadX - 40 || sx > W + viewPadX + 40) continue
      if (hash(k * 8.3) < 0.35) continue
      const w = 26 + hash(k * 2.7) * 20
      const h = 16 + hash(k * 5.9) * 10
      p.stroke(...C.foliageLine)
      p.strokeWeight(1.3)
      const pts = fillBlob(sx, GROUND_Y - h * 0.4, w, h, C.foliage, k * 7.1, 1.0)
      strokeLoop(pts, k * 7.1, 0.8)
    }
  }

  // Visit every world repeat of `period` metres across the visible width.
  function forEachWorld(period, fn, padM = 4) {
    const span = (W / 2 + viewPadX) / PX_PER_M + padM
    const k0 = Math.floor((x - span) / period)
    const k1 = Math.ceil((x + span) / period)
    for (let k = k0; k <= k1; k++) fn(k)
  }

  // ------------------------------------------------------------- surfaces
  function drawWoodFloor(t) {
    const rows = [16, 38, 60]
    p.stroke(...t.line)
    p.strokeWeight(1.3)
    for (let i = 1; i < rows.length; i++) {
      roughLine(-viewPadX, GROUND_Y + rows[i], W + viewPadX, GROUND_Y + rows[i], 1200 + i, 0.5)
    }
    for (let r = 0; r < rows.length; r++) {
      const top = r === 0 ? GROUND_Y + 2 : GROUND_Y + rows[r - 1]
      const bot = GROUND_Y + rows[r]
      forEachWorld(1.7, (k) => {
        const sx = BOX_X + ((k + r * 0.5) * 1.7 - x) * PX_PER_M
        p.stroke(...t.line)
        p.strokeWeight(1.1)
        roughLine(sx, top + 2, sx, bot - 1, k * 2.3 + r * 9, 0.4)
        p.stroke(...t.accent)
        p.strokeWeight(1)
        const gy = top + 5 + hash(k * 5.3 + r * 2.7) * Math.max(4, bot - top - 12)
        roughLine(
          sx + 6,
          gy,
          sx + 8 + 12 + hash(k * 9.1) * 18,
          gy + jit(k * 1.3, 2),
          k * 4.1 + r,
          0.4
        )
      })
    }
  }

  function drawTileFloor(t) {
    p.stroke(...t.line)
    p.strokeWeight(1.2)
    forEachWorld(0.8, (k) => {
      const sx = BOX_X + (k * 0.8 - x) * PX_PER_M
      roughLine(sx, GROUND_Y + 1, sx, H + viewPadY, k * 1.7, 0.4)
    })
    for (const gy of [18, 42, 66]) {
      roughLine(-viewPadX, GROUND_Y + gy, W + viewPadX, GROUND_Y + gy, 1300 + gy, 0.4)
    }
    // Droplets and a wet sheen.
    p.noStroke()
    forEachWorld(1.4, (k) => {
      const sx = BOX_X + (k * 1.4 + hash(k * 3.3) * 0.5 - x) * PX_PER_M
      const sy = GROUND_Y + 9 + hash(k * 6.1) * 50
      p.fill(...t.accent)
      p.ellipse(sx, sy, 7, 4)
      p.fill(255, 255, 255, 140)
      p.circle(sx - 1, sy - 1, 2)
    })
    p.stroke(255, 255, 255, 130)
    p.strokeWeight(2)
    forEachWorld(1.1, (k) => {
      const sx = BOX_X + (k * 1.1 + 0.3 - x) * PX_PER_M
      roughLine(sx, GROUND_Y + 6, sx + 26, GROUND_Y + 6, k * 2.1, 0.4)
    })
  }

  function drawSnowFloor(t) {
    // Drifts piled along the line.
    forEachWorld(1.9, (k) => {
      const wx = k * 1.9 + hash(k * 2.9) * 0.7
      const sx = BOX_X + (wx - x) * PX_PER_M
      fillBlob(
        sx,
        GROUND_Y + 5,
        34 + hash(k * 4.7) * 26,
        12 + hash(k * 7.1) * 8,
        t.drift,
        k * 3.7,
        1.2
      )
    })
    // Sparkle speckles.
    p.noStroke()
    forEachWorld(0.37, (k) => {
      const sx = BOX_X + (k * 0.37 + hash(k * 5.9) * 0.2 - x) * PX_PER_M
      const sy = GROUND_Y + 9 + hash(k * 8.3) * 52
      p.fill(...t.accent)
      p.circle(sx, sy, 1.4 + hash(k * 2.1) * 2)
    })
    // Ski grooves.
    p.stroke(...t.line)
    p.strokeWeight(1.5)
    for (const gy of [26, 36]) {
      roughLine(-viewPadX, GROUND_Y + gy, W + viewPadX, GROUND_Y + gy, 1400 + gy, 0.8)
    }
  }

  function drawRoadFloor(t) {
    // Aggregate.
    p.noStroke()
    forEachWorld(0.33, (k) => {
      const sx = BOX_X + (k * 0.33 + hash(k * 4.3) * 0.2 - x) * PX_PER_M
      const sy = GROUND_Y + 8 + hash(k * 7.7) * 56
      p.fill(...t.accent, 120)
      p.circle(sx, sy, 1.5 + hash(k * 3.1) * 2.5)
    })
    // Dashed lane line.
    p.stroke(...t.lane)
    p.strokeWeight(3)
    forEachWorld(2, (k) => {
      const sx = BOX_X + (k * 2 - x) * PX_PER_M
      roughLine(sx, GROUND_Y + 34, sx + 0.9 * PX_PER_M, GROUND_Y + 34, k * 2.7, 0.4)
    })
    // F1 curb.
    if (t.curb) {
      const bw = 0.6 * PX_PER_M
      forEachWorld(0.6, (k) => {
        const sx = BOX_X + (k * 0.6 - x) * PX_PER_M
        p.noStroke()
        p.fill(...(k % 2 === 0 ? t.curb : [248, 248, 248]))
        p.rect(sx, GROUND_Y + 1, bw + 1, 8)
      })
    }
  }

  function drawGlassFloor(t) {
    p.stroke(...t.line)
    p.strokeWeight(1.4)
    for (const gy of [14, 30, 48, 64]) {
      roughLine(-viewPadX, GROUND_Y + gy, W + viewPadX, GROUND_Y + gy, 1500 + gy, 0.8)
    }
    p.stroke(255, 255, 255, 150)
    p.strokeWeight(2)
    forEachWorld(1.25, (k) => {
      const sx = BOX_X + (k * 1.25 - x) * PX_PER_M
      roughLine(sx, GROUND_Y + 22, sx + 28, GROUND_Y + 22, k * 1.3, 0.5)
    })
  }

  function drawGround() {
    const t = surfaceStyle

    // Floor band below the line, full-bleed.
    p.noStroke()
    p.fill(...t.floor)
    p.rect(-viewPadX, GROUND_Y, W + viewPadX * 2, H - GROUND_Y + viewPadY)

    if (t.pattern === 'wood') drawWoodFloor(t)
    else if (t.pattern === 'tile') drawTileFloor(t)
    else if (t.pattern === 'snow') drawSnowFloor(t)
    else if (t.pattern === 'road') drawRoadFloor(t)
    else drawGlassFloor(t)

    // Half-metre marks: the scrolling ruler.
    p.stroke(...C.faint)
    p.strokeWeight(1.3)
    forEachWorld(0.5, (k) => {
      const sx = BOX_X + (k * 0.5 - x) * PX_PER_M
      roughLine(sx, GROUND_Y - 9, sx, GROUND_Y - 1, k * 1.7, 0.3)
    })

    // Hand-drawn floor line.
    p.stroke(...C.ink)
    p.strokeWeight(2.4)
    roughLine(-viewPadX - 12, GROUND_Y, W + viewPadX + 12, GROUND_Y, 77, 0.7)
  }

  function drawBox() {
    const t = surfaceStyle
    const left = BOX_X - BOX_W / 2
    const top = GROUND_Y - BOX_H

    p.noStroke()
    p.fill(31, 41, 55, 20)
    p.ellipse(BOX_X, GROUND_Y + 4, BOX_W * 1.14, 18)

    p.noStroke()
    p.fill(...t.box)
    p.rect(left, top, BOX_W, BOX_H, 5)

    p.stroke(...t.boxLine)
    p.strokeWeight(1.2)
    roughLine(left + 7, top + BOX_H * 0.28, left + BOX_W - 7, top + BOX_H * 0.28, 601, 0.5)
    roughLine(left + 7, top + BOX_H * 0.72, left + BOX_W - 7, top + BOX_H * 0.72, 602, 0.5)

    // Glass / wet-skin gloss.
    if (t.prop === 'gloss') {
      p.noStroke()
      p.fill(255, 255, 255, 105)
      p.beginShape()
      p.vertex(left + 26, top + 12)
      p.vertex(left + 54, top + 12)
      p.vertex(left + 32, top + 56)
      p.vertex(left + 12, top + 56)
      p.endShape(p.CLOSE)
      p.fill(255, 255, 255, 160)
      p.rect(left + 62, top + 12, 6, 26, 3)
    }

    p.stroke(...t.boxEdge)
    p.strokeWeight(2.6)
    roughRect(left, top, BOX_W, BOX_H, 600, 0.8)

    p.fill(...t.label)
    p.noStroke()
    p.textSize(TYPE.box)
    p.textAlign(p.CENTER, p.CENTER)
    p.text(`${fmtNum(mass)} kg`, BOX_X, top + BOX_H * 0.5)
  }

  function drawDust() {
    for (const d of dust) {
      const a = clamp(d.life / d.max, 0, 1)
      p.noStroke()
      p.fill(...surfaceStyle.dust, 165 * a)
      p.circle(d.x, d.y, d.r * 2)
    }
  }

  function render(f) {
    p.background(...C.paper)
    drawHills()
    drawClouds()
    drawTrees()
    drawFence()
    drawBushes()
    drawGround()
    drawBox()
    drawDust()
    drawVelocity(f)
    drawFBD(f)
    drawNet(f)
  }

  // -------------------------------------------------------------- controls
  function syncPush() {
    if (pushInput) pushInput.value = fmtNum(push)
  }

  function setDir(d) {
    dir = d
    if (leftBtn) {
      leftBtn.classList.toggle('active', dir < 0)
      leftBtn.setAttribute('aria-pressed', dir < 0 ? 'true' : 'false')
      rightBtn.classList.toggle('active', dir > 0)
      rightBtn.setAttribute('aria-pressed', dir > 0 ? 'true' : 'false')
    }
  }

  function togglePause() {
    paused = !paused
    pauseBtn.textContent = paused ? 'Resume' : 'Pause'
    pauseBtn.classList.toggle('active', paused)
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false')
  }

  // Typed values update live but are only rewritten (and clamped visibly) on
  // Enter, change, or blur, so typing "0.5" or "10" is never interrupted.
  function attachNumber(input, lo, hi, get, set) {
    const commit = () => {
      const n = parseFloat(input.value)
      set(Number.isFinite(n) ? clamp(n, lo, hi) : get())
      input.value = fmtNum(get())
    }
    input.addEventListener('input', () => {
      const n = parseFloat(input.value)
      if (Number.isFinite(n)) set(clamp(n, lo, hi))
    })
    input.addEventListener('change', commit)
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
    })
  }

  function surfaceText() {
    return `μs = ${mus.toFixed(2)} · μk = ${muk.toFixed(2)}`
  }

  function applySurface(index) {
    const s = SURFACES[index]
    if (!s) return
    surfaceIndex = index
    mus = s.mus
    muk = s.muk
    surfaceStyle = s.theme
    if (muVal) muVal.textContent = surfaceText()
  }

  function buildControls() {
    controls.classList.add('big')

    // Applied force: typed magnitude + direction buttons.
    const pushLabel = el('label')
    pushLabel.appendChild(el('span', null, 'Applied force'))
    pushInput = el('input')
    pushInput.type = 'number'
    pushInput.min = 0
    pushInput.max = PUSH_MAX
    pushInput.step = 1
    pushInput.value = fmtNum(push)
    pushInput.inputMode = 'decimal'
    attachNumber(pushInput, 0, PUSH_MAX, () => push, (n) => {
      push = n
    })
    pushLabel.appendChild(pushInput)
    pushLabel.appendChild(el('span', null, 'N'))
    controls.appendChild(pushLabel)

    leftBtn = el('button', null, '\u2190 Left')
    leftBtn.type = 'button'
    leftBtn.title = 'Push left'
    leftBtn.setAttribute('aria-pressed', 'false')
    leftBtn.addEventListener('click', () => setDir(-1))
    controls.appendChild(leftBtn)

    rightBtn = el('button', null, 'Right \u2192')
    rightBtn.type = 'button'
    rightBtn.title = 'Push right'
    rightBtn.setAttribute('aria-pressed', 'false')
    rightBtn.addEventListener('click', () => setDir(1))
    controls.appendChild(rightBtn)

    // Mass.
    const massLabel = el('label')
    massLabel.appendChild(el('span', null, 'Mass'))
    massInput = el('input')
    massInput.type = 'number'
    massInput.min = MASS_MIN
    massInput.max = MASS_MAX
    massInput.step = 0.5
    massInput.value = fmtNum(mass)
    massInput.inputMode = 'decimal'
    attachNumber(massInput, MASS_MIN, MASS_MAX, () => mass, (n) => {
      mass = n
    })
    massLabel.appendChild(massInput)
    massLabel.appendChild(el('span', null, 'kg'))
    controls.appendChild(massLabel)

    // Surface pair.
    const surfaceLabel = el('label')
    surfaceLabel.appendChild(el('span', null, 'Surface'))
    surfaceSelect = el('select')
    SURFACES.forEach((s, i) => {
      const opt = el('option', null, s.name)
      opt.value = String(i)
      surfaceSelect.appendChild(opt)
    })
    surfaceSelect.value = String(surfaceIndex)
    surfaceSelect.addEventListener('change', () => {
      applySurface(parseInt(surfaceSelect.value, 10))
    })
    surfaceLabel.appendChild(surfaceSelect)
    muVal = el('span', 'val', surfaceText())
    surfaceLabel.appendChild(muVal)
    controls.appendChild(surfaceLabel)

    pauseBtn = el('button', null, 'Pause')
    pauseBtn.type = 'button'
    pauseBtn.title = 'Pause or resume the motion'
    pauseBtn.setAttribute('aria-pressed', 'false')
    pauseBtn.addEventListener('click', togglePause)
    controls.appendChild(pauseBtn)

    const resetBtn = el('button', null, 'Reset')
    resetBtn.type = 'button'
    resetBtn.title = 'Put the box back at the start'
    resetBtn.addEventListener('click', reset)
    controls.appendChild(resetBtn)

    controls.appendChild(el('span', 'spacer'))
    readout = el('span', 'readout', '')
    controls.appendChild(readout)

    setDir(1)
  }

  function updateReadout(f) {
    readout.textContent =
      `F_net = ${fmtF(f.net)} N${dirArrow(f.net)}  ·  ` +
      `a = ${Math.abs(f.a).toFixed(2)} m/s²${dirArrow(f.a)}  ·  ` +
      `Δx = ${x.toFixed(1)} m`
  }

  // -------------------------------------------------------------- keyboard
  function onKey(e) {
    const tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return
    if (e.key === 'ArrowLeft') {
      setDir(-1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      setDir(1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      push = clamp(push + 5, 0, PUSH_MAX)
      syncPush()
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      push = clamp(push - 5, 0, PUSH_MAX)
      syncPush()
      e.preventDefault()
    } else if (e.key === ' ') {
      togglePause()
      e.preventDefault()
    } else if (e.key === 'r' || e.key === 'R') {
      reset()
    }
  }

  // ------------------------------------------------------------------ p5
  function resize() {
    p.resizeCanvas(stage.clientWidth, stage.clientHeight)
  }

  p.setup = () => {
    stage = document.getElementById('stage')
    controls = document.getElementById('controls')
    buildControls()
    p.createCanvas(stage.clientWidth, stage.clientHeight)
    if (document.fonts && document.fonts.load) {
      document.fonts
        .load('20px "Patrick Hand"')
        .then(() => {
          handReady = true
        })
        .catch(() => {})
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage)
    window.addEventListener('keydown', onKey)
  }

  p.windowResized = resize

  p.draw = () => {
    const dt = clamp(p.deltaTime, 0, 50) / 1000
    if (!paused) {
      update(dt)
      updateDust(dt)
    }

    const s = Math.min(p.width / W, p.height / H)
    const ox = (p.width - W * s) / 2
    const oy = (p.height - H * s) / 2
    viewPadX = (p.width / s - W) / 2
    viewPadY = (p.height / s - H) / 2

    p.textFont(handReady ? 'Patrick Hand' : 'sans-serif')
    p.textStyle(p.NORMAL)

    const f = computeForces()

    p.push()
    p.translate(ox, oy)
    p.scale(s)
    render(f)
    p.pop()

    updateReadout(f)
  }
}
