// Suspended Box — a hand-drawn vertical tension / net-force sandbox.
//
// A crate hangs from one, two, or three parallel vertical ropes. The player
// chooses the number of ropes, whether the crate is at rest or accelerating,
// the acceleration magnitude and direction, and the mass. Two free-body
// diagrams update every frame: all individual forces (each rope's tension and
// the weight) and the net force.
//
// The camera is locked to the crate, so the crate stays put and the cloud
// layers scroll vertically. The scroll is exactly v * PX_PER_M at each depth
// (parallax factors only change the layer, not the proportionality).
//
// Physics (up positive):
//   F_g = mg
//   accelerating:  F_T,total - F_g = ma  ->  F_T,total = m(g + a)
//   each of n identical ropes: F_T = m(g + a) / n
//   at rest: a = 0, v = 0  ->  each rope carries mg / n, F_net = 0
//
// p5 instance-mode sketch, no assets. The world is a fixed 960x640 logical
// space scaled to fit the stage.
export default function sketch(p) {
  // ---------------------------------------------------------------- world
  const W = 960
  const H = 640
  const G = 9.8

  const BOX_X = 230
  const BOX_W = 160
  const BOX_H = 130
  const BOX_TOP = 380

  const PX_PER_M = 46       // cloud scroll, pixels per metre of altitude
  const PX_PER_N = 0.45     // FBD force scale
  const ARROW_MAX = 100
  const NET_ARROW_MAX = 45
  const EPS_V = 0.05
  const EPS_A = 0.02

  const MASS_MIN = 1
  const MASS_MAX = 10
  const ACCEL_UP_MAX = 10
  const ACCEL_DOWN_MAX = 9  // keep the ropes taut (a > -g)

  const CARD1 = { x: 480, y: 14, w: 460, h: 250 }
  const CARD2 = { x: 520, y: 280, w: 380, h: 130 }
  const CALLOUT = { x: 592, y: 424, w: 236, h: 112 }
  const DOT1 = { x: 710, y: 180 }
  const DOT2 = { x: 710, y: 358 }

  const TYPE = {
    title: 22,
    force: 18,
    symbol: 15,
    foot: 16,
    netValue: 20,
    caption: 15,
    velocity: 26,
    accel: 19,
    state: 18,
    box: 28
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
    normal: [13, 148, 136],
    gravity: [220, 38, 38],
    net: [109, 40, 217],
    warn: [180, 83, 9],
    bad: [185, 28, 28],
    box: [238, 225, 205],
    boxEdge: [143, 112, 78],
    boxLine: [214, 194, 164]
  }

  // Scattered, non-repeating cloud field. Each depth layer is a grid of
  // invisible cells; a hash of the cell coordinates gives each cloud its
  // position, size and shape, so a fast scroll never shows a repeating pitch.
  const CLOUD_LAYERS = [
    { f: 0.2, cellW: 240, cellH: 220, w: 110, color: [239, 244, 250], chance: 0.72 },
    { f: 0.45, cellW: 300, cellH: 280, w: 150, color: [232, 240, 249], chance: 0.6 },
    { f: 0.8, cellW: 380, cellH: 340, w: 200, color: [224, 234, 246], chance: 0.5 }
  ]

  // Three star depths: far stars are small, dim and slow; near ones are
  // larger, brighter and faster. Same non-repeating cell technique.
  const STAR_LAYERS = [
    { f: 0.004, cellW: 120, cellH: 110, r: 1.0, chance: 0.7, alpha: 0.55 },
    { f: 0.008, cellW: 170, cellH: 160, r: 1.5, chance: 0.55, alpha: 0.75 },
    { f: 0.016, cellW: 230, cellH: 220, r: 2.1, chance: 0.45, alpha: 1.0 }
  ]

  // Real-atmosphere sky stops, in metres above the start.
  const SKY_STOPS = [
    { alt: 0, c: [251, 251, 253] },
    { alt: 2000, c: [214, 232, 250] },
    { alt: 12000, c: [120, 158, 206] },
    { alt: 50000, c: [44, 60, 104] },
    { alt: 100000, c: [6, 8, 20] }
  ]

  const STAR_START = 50000
  const KARMAN = 100000

  // ---------------------------------------------------------------- state
  let mass = 10
  let nRopes = 1
  let mode = 'rest'        // rest | accel
  let accelMag = 2
  let accelDir = 1         // +1 up, -1 down

  let v = 0                // m/s, up positive
  let y = 0                // m, altitude from the start (cloud scroll)
  let paused = false

  let stage, controls
  let handReady = false

  let accelInput, upBtn, downBtn
  let pauseBtn, readout
  let ropeBtns = []
  let restBtn, accelBtn

  // -------------------------------------------------------------- helpers
  const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val))
  const fmtF = (val) => {
    const a = Math.abs(val)
    if (a < 0.05) return '0'
    const s = a.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  const fmtNum = (n) => String(Number(n.toFixed(2)))
  const dirArrowV = (val) => (val > 0.005 ? ' \u2191' : val < -0.005 ? ' \u2193' : '')
  const fmtAlt = (val) =>
    Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(2)} km` : `${val.toFixed(1)} m`

  function lerp3(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ]
  }

  function skyAt(alt) {
    if (alt <= SKY_STOPS[0].alt) return SKY_STOPS[0].c
    for (let i = 1; i < SKY_STOPS.length; i++) {
      const b = SKY_STOPS[i]
      if (alt < b.alt) {
        const a = SKY_STOPS[i - 1]
        return lerp3(a.c, b.c, (alt - a.alt) / (b.alt - a.alt))
      }
    }
    return SKY_STOPS[SKY_STOPS.length - 1].c
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  // ------------------------------------------------------------ rough ink
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

  // ------------------------------------------------------------- physics
  function accelSigned() {
    return mode === 'rest' ? 0 : accelMag * accelDir
  }

  function computeForces() {
    const Fg = mass * G
    const a = accelSigned()
    const totalT = mass * (G + a)
    return {
      Fg,
      a,
      totalT,
      eachT: totalT / nRopes,
      net: mass * a
    }
  }

  function update(dt) {
    if (mode === 'rest') {
      v = 0
      return
    }
    v += accelSigned() * dt
    y += v * dt
  }

  function reset() {
    v = 0
    y = 0
  }

  // -------------------------------------------------------------- arrows
  const arrowLen = (F) => {
    const a = Math.abs(F)
    if (a < 0.4) return 0
    return clamp(a * PX_PER_N, 7, ARROW_MAX)
  }

  const netArrowLen = (F) => {
    const a = Math.abs(F)
    if (a < 0.4) return 0
    return clamp(a * PX_PER_N, 7, NET_ARROW_MAX)
  }

  function arrow(x1, y1, x2, y2, color, seed) {
    p.stroke(...color)
    p.strokeWeight(2.2)
    roughLine(x1, y1, x2, y2, seed, 0.5)
    const a = Math.atan2(y2 - y1, x2 - x1)
    const hl = clamp(Math.hypot(x2 - x1, y2 - y1) * 0.42, 4, 12)
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

  function fbdOffsets() {
    if (nRopes === 1) return [0]
    if (nRopes === 2) return [-10, 10]
    return [-12, 0, 12]
  }

  function drawFBD(f) {
    drawCard(CARD1, 801)

    p.fill(...C.ink)
    p.textSize(TYPE.title)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Free-body diagram', CARD1.x + 20, CARD1.y + 26)

    // Corner key: symbols with their values, everything else stays uncluttered.
    drawSub(
      [
        { t: 'F' },
        { t: 'T', sub: true },
        { t: ` = ${fmtF(f.eachT)} N` }
      ],
      CARD1.x + CARD1.w - 20,
      CARD1.y + 26,
      'RIGHT',
      TYPE.foot,
      C.normal
    )
    drawSub(
      [
        { t: 'F' },
        { t: 'g', sub: true },
        { t: ` = ${fmtF(f.Fg)} N` }
      ],
      CARD1.x + CARD1.w - 20,
      CARD1.y + 50,
      'RIGHT',
      TYPE.foot,
      C.gravity
    )

    const offs = fbdOffsets()
    const d = DOT1
    const R = 14
    const lenT = arrowLen(f.eachT)
    const lenG = arrowLen(f.Fg)
    const gTail = d.y + R - 1

    // Every rope's tension starts on the dot's upper edge, directly on the
    // body. The big dot hides the tails so they read as one junction.
    const tips = []
    for (let i = 0; i < offs.length; i++) {
      const off = offs[i]
      const tail = d.y - Math.sqrt(Math.max(0, R * R - off * off)) + 1
      const tip = tail - lenT
      tips.push(tip)
      arrow(d.x + off, tail, d.x + off, tip, C.normal, 860 + i * 13)
    }
    arrow(d.x, gTail, d.x, gTail + lenG, C.gravity, 890)
    dot(d.x, d.y, R, C.ink)

    // Symbols only on the vectors; values live in the corner key.
    for (let i = 0; i < offs.length; i++) {
      const parts = [
        { t: 'F' },
        { t: 'T', sub: true }
      ]
      let align = 'CENTER'
      let lx = d.x + offs[i]
      let ly = tips[i] - 6
      if (nRopes > 1 && i === 0) {
        align = 'RIGHT'
        lx = d.x + offs[i] - 6
        ly = tips[i] + 6
      } else if (nRopes > 1 && i === offs.length - 1) {
        align = 'LEFT'
        lx = d.x + offs[i] + 6
        ly = tips[i] + 6
      }
      drawSub(parts, lx, ly, align, TYPE.symbol, C.normal)
    }

    drawSub(
      [
        { t: 'F' },
        { t: 'g', sub: true }
      ],
      d.x + 12,
      gTail + lenG + 5,
      'LEFT',
      TYPE.symbol,
      C.gravity
    )
  }

  function drawNet(f) {
    drawCard(CARD2, 901)

    p.fill(...C.ink)
    p.textSize(TYPE.title)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Net force', CARD2.x + 20, CARD2.y + 26)

    const zero = Math.abs(f.net) < 0.05
    drawSub(
      [
        { t: 'F' },
        { t: 'net', sub: true },
        { t: ` = ${fmtF(f.net)} N${dirArrowV(f.net)}` }
      ],
      CARD2.x + CARD2.w - 18,
      CARD2.y + 26,
      'RIGHT',
      TYPE.netValue,
      zero ? C.muted : C.net
    )

    const len = netArrowLen(f.net)
    if (len > 0) {
      const up = f.net > 0
      const tipY = DOT2.y + (up ? -len : len)
      arrow(DOT2.x, DOT2.y, DOT2.x, tipY, C.net, 911)
      drawSub(
        [
          { t: 'F' },
          { t: 'net', sub: true }
        ],
        DOT2.x + 12,
        (DOT2.y + tipY) / 2 + 6,
        'LEFT',
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
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(zero ? 'balanced' : 'unbalanced', CARD2.x + 20, CARD2.y + CARD2.h - 14)
  }

  function velocityState(f) {
    const speed = Math.abs(v)
    const accel = Math.abs(f.a)
    if (speed < EPS_V && accel < EPS_A) return { text: 'at rest', color: C.muted }
    if (accel < EPS_A) return { text: 'constant velocity', color: C.normal }
    if (f.a * v >= 0) return { text: 'speeding up', color: C.warn }
    return { text: 'slowing down', color: C.bad }
  }

  function drawCallout(f) {
    drawCard(CALLOUT, 771)

    const speed = Math.abs(v)
    const vTxt = speed < 0.05 ? '0' : speed.toFixed(1)
    const x = CALLOUT.x + 20

    p.fill(...C.ink)
    p.textSize(TYPE.velocity)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(`v = ${vTxt} m/s${dirArrowV(v)}`, x, CALLOUT.y + 34)

    drawSub(
      [
        { t: `a = ${Math.abs(f.a).toFixed(2)} m/s` },
        { t: '2', sup: true },
        { t: dirArrowV(f.a) }
      ],
      x,
      CALLOUT.y + 64,
      'LEFT',
      TYPE.accel,
      C.ink
    )

    const state = velocityState(f)
    p.fill(...state.color)
    p.textSize(TYPE.state)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(state.text, x, CALLOUT.y + 92)
  }

  // --------------------------------------------------------------- scene
  function drawCloud(cx, cy, w, h, color, seed) {
    fillBlob(cx - w * 0.24, cy + h * 0.08, w * 0.58, h * 0.78, color, seed + 1.3, 2.0)
    fillBlob(cx + w * 0.02, cy - h * 0.12, w * 0.64, h * 1.0, color, seed + 8.7, 2.0)
    fillBlob(cx + w * 0.28, cy + h * 0.1, w * 0.5, h * 0.7, color, seed + 15.1, 2.0)
  }

  function drawClouds(sky) {
    const fade = clamp((y - 2000) / 10000, 0, 1)
    if (fade >= 0.99) return

    for (let li = 0; li < CLOUD_LAYERS.length; li++) {
      const L = CLOUD_LAYERS[li]
      const col = lerp3(L.color, sky, fade)
      const off = y * PX_PER_M * L.f
      const cols = Math.ceil(W / L.cellW) + 2
      const wj0 = Math.floor((-180 - off) / L.cellH) - 1
      const wj1 = Math.ceil((H + 180 - off) / L.cellH) + 1

      for (let wj = wj0; wj <= wj1; wj++) {
        for (let ix = -1; ix <= cols; ix++) {
          const salt = li * 919.7
          const h0 = hash(ix * 127.1 + wj * 311.7 + salt)
          if (h0 > L.chance) continue
          const h1 = hash(ix * 71.3 + wj * 53.9 + salt + 17.1)
          const h2 = hash(ix * 19.7 + wj * 89.3 + salt + 41.3)
          const h3 = hash(ix * 43.1 + wj * 23.7 + salt + 73.9)
          const h4 = hash(ix * 97.3 + wj * 67.1 + salt + 101.7)

          const cx = ix * L.cellW + L.cellW * 0.5 + (h1 - 0.5) * L.cellW * 0.7
          const cy = wj * L.cellH + off + L.cellH * 0.5 + (h2 - 0.5) * L.cellH * 0.7
          const cw = L.w * (0.6 + h3 * 0.55)
          const ch = cw * (0.26 + h4 * 0.12)
          drawCloud(cx, cy, cw, ch, col, h0 * 300 + h1 * 71)
        }
      }
    }
  }

  // Stars only exist in the dark upper atmosphere. Three cell fields at
  // different depths give the same parallax treatment as the clouds.
  function drawStars() {
    const a = clamp((y - STAR_START) / (KARMAN - STAR_START), 0, 1)
    if (a <= 0.02) return

    for (let li = 0; li < STAR_LAYERS.length; li++) {
      const L = STAR_LAYERS[li]
      const off = y * PX_PER_M * L.f
      const cols = Math.ceil(W / L.cellW) + 2
      const wj0 = Math.floor((-60 - off) / L.cellH) - 1
      const wj1 = Math.ceil((H + 60 - off) / L.cellH) + 1

      for (let wj = wj0; wj <= wj1; wj++) {
        for (let ix = -1; ix <= cols; ix++) {
          const salt = li * 733.1
          const h0 = hash(ix * 113.7 + wj * 271.3 + salt)
          if (h0 > L.chance) continue
          const h1 = hash(ix * 59.3 + wj * 97.1 + salt + 11.7)
          const h2 = hash(ix * 37.9 + wj * 61.7 + salt + 29.3)
          const h3 = hash(ix * 7.1 + wj * 13.3 + salt + 47.9)
          const h4 = hash(ix * 5.7 + wj * 19.9 + salt + 67.1)

          const sx = ix * L.cellW + L.cellW * 0.5 + (h1 - 0.5) * L.cellW * 0.8
          const sy = wj * L.cellH + off + L.cellH * 0.5 + (h2 - 0.5) * L.cellH * 0.8
          const r = L.r * (0.7 + h3 * 0.7)
          p.noStroke()
          p.fill(245, 248, 255, 230 * a * L.alpha * (0.5 + h4 * 0.5))
          p.circle(sx, sy, r * 2)
        }
      }
    }
  }

  function sceneOffsets() {
    if (nRopes === 1) return [0]
    if (nRopes === 2) return [-50, 50]
    return [-80, 0, 80]
  }

  function drawRig() {
    const offs = sceneOffsets()
    // Ropes go pale as the sky darkens so they stay visible in space.
    const ropeT = clamp((y - 15000) / 60000, 0, 1)
    const ropeCol = lerp3(C.ink, [228, 236, 248], ropeT)

    p.stroke(...ropeCol)
    p.strokeWeight(2)
    for (const off of offs) {
      roughLine(BOX_X + off, BOX_TOP - 6, BOX_X + off, -60, 710 + off, 0.5)
      p.strokeWeight(1.3)
      p.noFill()
      p.ellipse(BOX_X + off, BOX_TOP - 2, 9, 6)
      p.strokeWeight(2)
    }
  }

  function drawBox() {
    const left = BOX_X - BOX_W / 2
    const top = BOX_TOP

    p.noStroke()
    p.fill(...C.box)
    p.rect(left, top, BOX_W, BOX_H, 5)

    p.stroke(...C.boxLine)
    p.strokeWeight(1.2)
    roughLine(left + 8, top + BOX_H * 0.28, left + BOX_W - 8, top + BOX_H * 0.28, 601, 0.5)
    roughLine(left + 8, top + BOX_H * 0.72, left + BOX_W - 8, top + BOX_H * 0.72, 602, 0.5)

    p.stroke(...C.boxEdge)
    p.strokeWeight(2.6)
    roughRect(left, top, BOX_W, BOX_H, 600, 0.8)

    p.fill(...C.ink)
    p.noStroke()
    p.textSize(TYPE.box)
    p.textAlign(p.CENTER, p.CENTER)
    p.text(`${fmtNum(mass)} kg`, BOX_X, top + BOX_H * 0.5)
  }

  function render(f) {
    const sky = skyAt(y)
    p.background(...sky)
    drawStars()
    drawClouds(sky)
    drawRig()
    drawBox()
    drawFBD(f)
    drawNet(f)
    drawCallout(f)
  }

  // -------------------------------------------------------------- controls
  function syncAccelInput() {
    if (accelInput) accelInput.value = fmtNum(accelMag)
  }

  function setRopes(n) {
    nRopes = n
    for (const b of ropeBtns) {
      b.classList.toggle('active', parseInt(b.dataset.n, 10) === n)
      b.setAttribute('aria-pressed', parseInt(b.dataset.n, 10) === n ? 'true' : 'false')
    }
  }

  function updateAccelButtons() {
    if (upBtn) upBtn.classList.toggle('active', accelDir > 0)
    if (downBtn) downBtn.classList.toggle('active', accelDir < 0)
    if (upBtn) upBtn.setAttribute('aria-pressed', accelDir > 0 ? 'true' : 'false')
    if (downBtn) downBtn.setAttribute('aria-pressed', accelDir < 0 ? 'true' : 'false')
  }

  function updateModeButtons() {
    if (restBtn) restBtn.classList.toggle('active', mode === 'rest')
    if (accelBtn) accelBtn.classList.toggle('active', mode === 'accel')
    if (restBtn) restBtn.setAttribute('aria-pressed', mode === 'rest' ? 'true' : 'false')
    if (accelBtn) accelBtn.setAttribute('aria-pressed', mode === 'accel' ? 'true' : 'false')
    const off = mode === 'rest'
    if (accelInput) {
      accelInput.disabled = off
      accelInput.value = off ? '0' : fmtNum(accelMag)
    }
    if (upBtn) upBtn.disabled = off
    if (downBtn) downBtn.disabled = off
  }

  function setMode(next) {
    mode = next
    if (mode === 'rest') v = 0
    updateModeButtons()
  }

  function setAccelMag(val) {
    const max = accelDir < 0 ? ACCEL_DOWN_MAX : ACCEL_UP_MAX
    accelMag = clamp(val, 0, max)
  }

  function setAccelDir(d) {
    accelDir = d
    if (d < 0 && accelMag > ACCEL_DOWN_MAX) accelMag = ACCEL_DOWN_MAX
    updateAccelButtons()
    syncAccelInput()
  }

  function togglePause() {
    paused = !paused
    pauseBtn.textContent = paused ? 'Resume' : 'Pause'
    pauseBtn.classList.toggle('active', paused)
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false')
  }

  // Live update while typing; clamp and rewrite on Enter/change/blur.
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

  function buildControls() {
    controls.classList.add('big')

    // Ropes.
    const ropeGroup = el('div', 'cluster')
    ropeGroup.appendChild(el('span', null, 'Ropes'))
    for (let n = 1; n <= 3; n++) {
      const b = el('button', null, String(n))
      b.type = 'button'
      b.title = `${n} rope${n > 1 ? 's' : ''}`
      b.dataset.n = String(n)
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', () => setRopes(n))
      ropeGroup.appendChild(b)
      ropeBtns.push(b)
    }
    controls.appendChild(ropeGroup)

    // Motion mode.
    const motionGroup = el('div', 'cluster')
    motionGroup.appendChild(el('span', null, 'Motion'))
    restBtn = el('button', null, 'At rest')
    restBtn.type = 'button'
    restBtn.setAttribute('aria-pressed', 'false')
    restBtn.addEventListener('click', () => setMode('rest'))
    motionGroup.appendChild(restBtn)
    accelBtn = el('button', null, 'Accelerating')
    accelBtn.type = 'button'
    accelBtn.setAttribute('aria-pressed', 'false')
    accelBtn.addEventListener('click', () => setMode('accel'))
    motionGroup.appendChild(accelBtn)
    controls.appendChild(motionGroup)

    // Acceleration magnitude.
    const accelLabel = el('label')
    accelLabel.appendChild(el('span', null, 'Acceleration'))
    accelInput = el('input')
    accelInput.type = 'number'
    accelInput.min = 0
    accelInput.max = ACCEL_UP_MAX
    accelInput.step = 0.5
    accelInput.value = fmtNum(accelMag)
    accelInput.inputMode = 'decimal'
    attachNumber(accelInput, 0, ACCEL_UP_MAX, () => accelMag, setAccelMag)
    accelLabel.appendChild(accelInput)
    accelLabel.appendChild(el('span', null, 'm/s²'))
    controls.appendChild(accelLabel)

    upBtn = el('button', null, '\u2191 Up')
    upBtn.type = 'button'
    upBtn.setAttribute('aria-pressed', 'false')
    upBtn.addEventListener('click', () => setAccelDir(1))
    controls.appendChild(upBtn)

    downBtn = el('button', null, '\u2193 Down')
    downBtn.type = 'button'
    downBtn.setAttribute('aria-pressed', 'false')
    downBtn.addEventListener('click', () => setAccelDir(-1))
    controls.appendChild(downBtn)

    // Mass.
    const massLabel = el('label')
    massLabel.appendChild(el('span', null, 'Mass'))
    const massInput = el('input')
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

    pauseBtn = el('button', null, 'Pause')
    pauseBtn.type = 'button'
    pauseBtn.setAttribute('aria-pressed', 'false')
    pauseBtn.addEventListener('click', togglePause)
    controls.appendChild(pauseBtn)

    const resetBtn = el('button', null, 'Reset')
    resetBtn.type = 'button'
    resetBtn.addEventListener('click', reset)
    controls.appendChild(resetBtn)

    controls.appendChild(el('span', 'spacer'))
    readout = el('span', 'readout', '')
    controls.appendChild(readout)

    setRopes(1)
    updateAccelButtons()
    updateModeButtons()
  }

  function updateReadout(f) {
    readout.textContent =
      `F_net = ${fmtF(f.net)} N${dirArrowV(f.net)}  ·  ` +
      `total tension = ${fmtF(f.totalT)} N  ·  ` +
      `v = ${Math.abs(v).toFixed(2)} m/s${dirArrowV(v)}  ·  ` +
      `Δy = ${fmtAlt(y)}`
  }

  // -------------------------------------------------------------- keyboard
  function onKey(e) {
    const tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      setRopes(parseInt(e.key, 10))
      e.preventDefault()
    } else if (e.key === 'ArrowUp' && mode === 'accel') {
      setAccelDir(1)
      e.preventDefault()
    } else if (e.key === 'ArrowDown' && mode === 'accel') {
      setAccelDir(-1)
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
    if (!paused) update(dt)

    const s = Math.min(p.width / W, p.height / H)
    const ox = (p.width - W * s) / 2
    const oy = (p.height - H * s) / 2

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
