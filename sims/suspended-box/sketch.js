// Suspended Box — a hand-drawn vertical tension / net-force sandbox.
//
// A crate hangs from one, two, or three parallel vertical ropes and starts on
// the floor with slack ropes (zero tension). The player chooses the number of
// ropes, the rope tension, and the mass; the acceleration is read from the
// forces. Two free-body diagrams update every frame: all individual forces
// (each rope's tension, the weight, and the normal force from the floor) and
// the net force.
//
// The camera is locked to the crate, so the crate stays put and the cloud
// layers scroll vertically. The scroll is exactly v * PX_PER_M at each depth
// (parallax factors only change the layer, not the proportionality).
//
// Physics (up positive):
//   F_g = mg
//   each of n identical ropes: F_T (the only force the player sets)
//   total tension: F_T,total = n F_T
//   airborne:  a = (F_T,total - F_g) / m
//   on the floor:  F_N = max(0, F_g - F_T,total).  While F_N > 0 the floor
//   holds the crate at rest (a = 0, F_net = 0), so a negative tension (the
//   ropes pushing down) makes F_N larger than the weight.
//   equilibrium: F_T,total = F_g  ->  a = 0
//   slack ropes: F_T = 0  ->  on the floor F_N = F_g; airborne a = -g
//
// The crate's speed is capped at 0.999c.  Above 0.9c the stars draw as
// vertical streaks whose length grows as the cap is approached.
//
// p5 instance-mode sketch, no assets. The world is a fixed 960x640 logical
// space scaled to fit the stage.
export default function sketch(p) {
  // ---------------------------------------------------------------- world
  const W = 960
  const H = 640
  const G = 9.8
  const C_LIGHT = 299792458   // m/s
  const V_MAX = 0.999 * C_LIGHT
  const BETA_STREAK = 0.9

  const BOX_X = 230
  const BOX_W = 160
  const BOX_H = 130
  const BOX_TOP = 380

  const PX_PER_M = 46       // cloud scroll, pixels per metre of altitude
  const PX_PER_N = 0.45     // FBD force scale
  const ARROW_MAX = 80
  const NET_ARROW_MAX = 45
  const EPS_V = 0.05
  const EPS_A = 0.02

  const MASS_MIN = 1
  const MASS_MAX = 10
  const FT_MAX = 300
  const FT_MIN = -300
  const GROUND_START = BOX_TOP + BOX_H  // screen y of the ground at altitude 0

  const CARD1 = { x: 480, y: 14, w: 460, h: 250 }
  const CARD2 = { x: 520, y: 280, w: 380, h: 130 }
  const CALLOUT = { x: 592, y: 424, w: 236, h: 112 }
  const DOT1 = { x: 710, y: 160 }
  const DOT2 = { x: 710, y: 358 }

  const TYPE = {
    title: 22,
    force: 20,
    symbol: 20,
    foot: 17,
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
    tension: [13, 148, 136],
    normal: [11, 87, 208],
    gravity: [220, 38, 38],
    net: [109, 40, 217],
    warn: [180, 83, 9],
    bad: [185, 28, 28],
    box: [238, 225, 205],
    boxEdge: [143, 112, 78],
    boxLine: [214, 194, 164],
    ground: [238, 233, 224],
    groundLine: [214, 206, 192]
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
    { f: 0.001, cellW: 120, cellH: 110, r: 1.0, chance: 0.7, alpha: 0.55 },
    { f: 0.002, cellW: 170, cellH: 160, r: 1.5, chance: 0.55, alpha: 0.75 },
    { f: 0.004, cellW: 230, cellH: 220, r: 2.1, chance: 0.45, alpha: 1.0 }
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
  let tension = 0          // rope tension per rope, N, up positive

  let v = 0                // m/s, up positive
  let y = 0                // m, altitude from the ground (cloud scroll)
  let clock = 0            // s, twinkle / animation time
  let starWarpY = null     // frozen star altitude once the warp starts
  let starWarpClock = 0
  let paused = false

  // Logical letterbox margins, so the sky/ground/stars fill the whole canvas.
  let viewPadX = 0
  let viewPadY = 0

  let stage, controls
  let handReady = false

  let accelOut, ftInput
  let pauseBtn, readout
  let ropeBtns = []

  // -------------------------------------------------------------- helpers
  const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val))
  const fmtF = (val) => {
    const a = Math.abs(val)
    if (a < 0.05) return '0'
    const s = a.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  const fmtNum = (n) => String(Number(n.toFixed(2)))
  const fmtSigned = (val) => {
    if (Math.abs(val) < 0.05) return '0'
    const s = val.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  const dirArrowV = (val) => (val > 0.005 ? ' \u2191' : val < -0.005 ? ' \u2193' : '')
  const fmtSpeed = (val) => {
    const s = Math.abs(val)
    if (s < 1e4) return `${s.toFixed(1)} m/s`
    if (s < 1e7) return `${(s / 1000).toFixed(1)} km/s`
    return `${(s / C_LIGHT).toFixed(3)}c`
  }
  const fmtAlt = (val) => {
    const a = Math.abs(val)
    if (a >= 1e9) return `${(val / 1e9).toFixed(2)} Gm`
    if (a >= 1000) return `${(val / 1000).toFixed(2)} km`
    return `${val.toFixed(1)} m`
  }

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
  function computeForces() {
    const Fg = mass * G
    const totalT = tension * nRopes
    // The crate can only rest on the floor at ground level and while it is
    // not already moving upward.
    const onFloor = y <= 0.001 && v <= 0.001
    const Fn = onFloor ? Math.max(0, Fg - totalT) : 0
    // The floor supplies whatever the ropes do not, so the crate cannot
    // accelerate while F_N > 0.
    const a = Fn > 0 ? 0 : aFromFt(tension)
    return {
      Fg,
      a,
      totalT,
      eachT: tension,
      Fn,
      held: Fn >= 0.4,
      net: mass * a
    }
  }

  const aFromFt = (ft) => (nRopes * ft) / mass - G

  function update(dt) {
    // The floor removes the downward acceleration while it supports the crate.
    v += computeForces().a * dt
    v = clamp(v, -V_MAX, V_MAX)
    y += v * dt
    if (y < 0) {
      y = 0
      v = 0
    }
  }

  function reset() {
    v = 0
    y = 0
    clock = 0
    starWarpY = null
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
        { t: ` = ${fmtSigned(f.eachT)} N` }
      ],
      CARD1.x + CARD1.w - 20,
      CARD1.y + 26,
      'RIGHT',
      TYPE.foot,
      C.tension
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
    if (f.held) {
      drawSub(
        [
          { t: 'F' },
          { t: 'N', sub: true },
          { t: ` = ${fmtF(f.Fn)} N` }
        ],
        CARD1.x + CARD1.w - 20,
        CARD1.y + 74,
        'RIGHT',
        TYPE.foot,
        C.normal
      )
    }

    const d = DOT1
    const R = 16
    const noRopes = Math.abs(f.eachT) < 0.05
    const down = !noRopes && f.eachT < 0
    const tensionUp = f.eachT > 0.05
    const normalUp = f.held && tensionUp
    let offs = fbdOffsets()
    let nx = d.x
    if (normalUp) {
      if (nRopes === 1) {
        offs = [-10]
      } else if (nRopes === 2) {
        offs = [-10, 10]
      } else {
        // Three ropes plus the normal force: four parallel arrows across the
        // dot, with F_N on the right.
        offs = [-14, -4.67, 4.67]
        nx = d.x + 14
      }
    }
    const lenT = arrowLen(f.eachT)
    const lenG = arrowLen(f.Fg)
    // With the ropes pushing down, the weight moves to its own lane so the two
    // downward forces stay distinct.
    const gx = down ? d.x + 30 : d.x
    const gTail = down ? d.y : d.y + R - 1

    // Tension tails sit on the dot's edge, upper for a pull and lower for a
    // push, at each rope offset.
    const tails = []
    const tips = []
    if (!noRopes) {
      for (let i = 0; i < offs.length; i++) {
        const off = offs[i]
        const edge = Math.sqrt(Math.max(0, R * R - off * off))
        const tail = down ? d.y + edge - 1 : d.y - edge + 1
        tails.push(tail)
        tips.push(tail + (down ? lenT : -lenT))
      }
    }

    dot(d.x, d.y, R, C.ink)

    if (!noRopes) {
      for (let i = 0; i < offs.length; i++) {
        const x = d.x + offs[i]
        arrow(x, tails[i], x, tips[i], C.tension, 860 + i * 13)
      }
    }
    arrow(gx, gTail, gx, gTail + lenG, C.gravity, 890)

    // Normal force: the floor pushes up, straight out of the dot.
    if (f.held) {
      const lenN = arrowLen(f.Fn)
      const nOff = nx - d.x
      const tailN = d.y - Math.sqrt(Math.max(0, R * R - nOff * nOff)) + 1
      const tipN = tailN - lenN
      arrow(nx, tailN, nx, tipN, C.normal, 930)
      if (normalUp && nRopes === 3) {
        // Four-arrow row: label F_N outboard so it clears the rope arrows.
        drawSub(
          [
            { t: 'F' },
            { t: 'N', sub: true }
          ],
          nx + 8,
          (tailN + tipN) / 2 + 6,
          'LEFT',
          TYPE.symbol,
          C.normal
        )
      } else {
        drawSub(
          [
            { t: 'F' },
            { t: 'N', sub: true }
          ],
          normalUp ? nx : nx + 10,
          normalUp ? tipN - 6 : tipN + 5,
          normalUp ? 'CENTER' : 'LEFT',
          TYPE.symbol,
          C.normal
        )
      }
    }

    // Symbols only on the vectors; values live in the corner key. A downward
    // bundle gets one label clear of the weight's label.
    if (!noRopes) {
      const parts = [
        { t: 'F' },
        { t: 'T', sub: true }
      ]
      if (down) {
        const leftX = d.x - Math.max(...offs.map((off) => Math.abs(off)))
        const midY = (tails[0] + tips[0]) / 2 + 6
        drawSub(parts, leftX - 8, midY, 'RIGHT', TYPE.symbol, C.tension)
      } else if (normalUp) {
        // F_N owns the centre, so the tension label sits left of the bundle.
        const midY = (tails[0] + tips[0]) / 2 + 6
        drawSub(parts, d.x + offs[0] - 10, midY, 'RIGHT', TYPE.symbol, C.tension)
      } else {
        // One label for the whole bundle; the corner key carries the value.
        let topTip = tips[0]
        for (const tip of tips) topTip = Math.min(topTip, tip)
        drawSub(parts, d.x, topTip - 6, 'CENTER', TYPE.symbol, C.tension)
      }
    }

    drawSub(
      [
        { t: 'F' },
        { t: 'g', sub: true }
      ],
      gx + 12,
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
    const freeFall = Math.abs(f.eachT) < 0.05 && f.Fn <= 0
    const caption = freeFall ? 'free fall' : zero ? 'equilibrium' : 'unbalanced'
    p.text(caption, CARD2.x + 20, CARD2.y + CARD2.h - 14)
  }

  function velocityState(f) {
    const speed = Math.abs(v)
    const accel = Math.abs(f.a)
    if (f.held) return { text: 'on ground', color: C.muted }
    if (speed >= V_MAX - 1 && f.a * v >= 0) {
      return { text: 'at 0.999c', color: C.warn }
    }
    if (speed < EPS_V && accel < EPS_A) return { text: 'at rest', color: C.muted }
    if (accel < EPS_A) return { text: 'constant velocity', color: C.tension }
    if (f.a * v >= 0) return { text: 'speeding up', color: C.warn }
    return { text: 'slowing down', color: C.bad }
  }

  function drawCallout(f) {
    drawCard(CALLOUT, 771)

    const x = CALLOUT.x + 20

    p.fill(...C.ink)
    p.textSize(TYPE.velocity)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text(`v = ${fmtSpeed(v)}${dirArrowV(v)}`, x, CALLOUT.y + 34)

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
      const ix0 = Math.floor(-viewPadX / L.cellW) - 1
      const ix1 = Math.ceil((W + viewPadX) / L.cellW) + 1
      const wj0 = Math.floor((-180 - viewPadY - off) / L.cellH) - 1
      const wj1 = Math.ceil((H + viewPadY + 180 - off) / L.cellH) + 1

      for (let wj = wj0; wj <= wj1; wj++) {
        for (let ix = ix0; ix <= ix1; ix++) {
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
  // different depths give the same parallax treatment as the clouds.  Above
  // 0.9c they render as streaks and the field is frozen so it does not strobe.
  function drawStars() {
    const a = clamp((y - STAR_START) / (KARMAN - STAR_START), 0, 1)
    if (a <= 0.02) return

    const beta = Math.abs(v) / C_LIGHT
    const warp = clamp((beta - BETA_STREAK) / (0.999 - BETA_STREAK), 0, 1)
    if (warp > 0 && starWarpY === null) {
      starWarpY = y
      starWarpClock = clock
    } else if (warp <= 0) {
      starWarpY = null
    }
    const starY = starWarpY !== null ? starWarpY : y
    const drift = starWarpY !== null ? (clock - starWarpClock) * 90 * Math.sign(v) : 0
    const streakBase = 6 + 74 * warp

    for (let li = 0; li < STAR_LAYERS.length; li++) {
      const L = STAR_LAYERS[li]
      const depth = L.f / STAR_LAYERS[STAR_LAYERS.length - 1].f
      const off = starY * PX_PER_M * L.f + drift * depth
      const ix0 = Math.floor(-viewPadX / L.cellW) - 1
      const ix1 = Math.ceil((W + viewPadX) / L.cellW) + 1
      const wj0 = Math.floor((-60 - viewPadY - off) / L.cellH) - 1
      const wj1 = Math.ceil((H + viewPadY + 60 - off) / L.cellH) + 1

      for (let wj = wj0; wj <= wj1; wj++) {
        for (let ix = ix0; ix <= ix1; ix++) {
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
          const tw = 0.6 + 0.4 * Math.sin(clock * (1.2 + h3 * 1.8) + h4 * p.TWO_PI)
          const alpha = 230 * a * L.alpha * tw

          if (warp > 0) {
            const len = streakBase * (0.75 + h4 * 0.5) * (0.65 + 0.35 * depth)
            const tail = v > 0 ? sy - len : sy + len
            p.stroke(245, 248, 255, alpha)
            p.strokeWeight(Math.max(1.3, r))
            p.line(sx, tail, sx, sy)
            p.noStroke()
            p.fill(245, 248, 255, Math.min(255, alpha * 1.2))
            p.circle(sx, sy, r * 1.9)
          } else {
            p.noStroke()
            p.fill(245, 248, 255, alpha)
            p.circle(sx, sy, r * 2)
          }
        }
      }
    }
  }

  function sceneOffsets() {
    if (nRopes === 1) return [0]
    if (nRopes === 2) return [-50, 50]
    return [-80, 0, 80]
  }

  function drawGround() {
    const gy = GROUND_START + y * PX_PER_M
    if (gy > H + 60) return

    p.noStroke()
    p.fill(...C.ground)
    p.rect(-viewPadX, gy, W + viewPadX * 2, H - gy + viewPadY)

    p.stroke(...C.groundLine)
    p.strokeWeight(1.3)
    for (let x = -viewPadX; x < W + viewPadX; x += 26) {
      const k = Math.round(x)
      if (hash(k * 0.37) < 0.35) continue
      roughLine(x, gy + 8, x - 10, gy + 24, k * 0.7, 0.5)
    }
    p.noStroke()
    for (let x = -viewPadX; x < W + viewPadX; x += 37) {
      const k = Math.round(x)
      p.fill(...C.groundLine)
      p.circle(x + jit(k, 8), gy + 14 + hash(k * 0.9) * 30, 2 + hash(k * 0.3) * 3)
    }

    p.stroke(...C.ink)
    p.strokeWeight(2.4)
    roughLine(-viewPadX - 12, gy, W + viewPadX + 12, gy, 77, 0.7)
  }

  function drawRig(f) {
    if (Math.abs(f.eachT) < 0.05) return

    const offs = sceneOffsets()
    // Ropes go pale as the sky darkens so they stay visible in space.
    const ropeT = clamp((y - 15000) / 60000, 0, 1)
    const ropeCol = lerp3(C.ink, [228, 236, 248], ropeT)
    // Negative tension pulls the crate down: the ropes leave the bottom.
    const down = f.eachT < 0
    const ropeStart = down ? BOX_TOP + BOX_H - 2 : BOX_TOP - 6
    const ropeEnd = down ? H + 80 : -60
    const knotY = down ? BOX_TOP + BOX_H + 2 : BOX_TOP - 2

    p.stroke(...ropeCol)
    p.strokeWeight(2)
    for (const off of offs) {
      roughLine(BOX_X + off, ropeStart, BOX_X + off, ropeEnd, 710 + off, 0.5)
      p.strokeWeight(1.3)
      p.noFill()
      p.ellipse(BOX_X + off, knotY, 9, 6)
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
    drawGround()
    drawRig(f)
    drawBox()
    drawFBD(f)
    drawNet(f)
    drawCallout(f)
  }

  // -------------------------------------------------------------- controls
  function setTension(val) {
    tension = clamp(val, FT_MIN, FT_MAX)
    if (ftInput) ftInput.value = fmtNum(tension)
  }

  function setRopes(n) {
    nRopes = n
    for (const b of ropeBtns) {
      b.classList.toggle('active', parseInt(b.dataset.n, 10) === n)
      b.setAttribute('aria-pressed', parseInt(b.dataset.n, 10) === n ? 'true' : 'false')
    }
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

    // Acceleration: read from the forces, not typed.
    const accelLabel = el('label')
    accelLabel.appendChild(el('span', null, 'Acceleration'))
    accelOut = el('span', 'val', '0')
    accelLabel.appendChild(accelOut)
    accelLabel.appendChild(el('span', null, 'm/s²'))
    controls.appendChild(accelLabel)

    // F_T per rope: the only editable force.
    const ftLabel = el('label')
    ftLabel.appendChild(el('span', null, 'F_T / rope'))
    ftInput = el('input')
    ftInput.type = 'number'
    ftInput.min = FT_MIN
    ftInput.max = FT_MAX
    ftInput.step = 0.5
    ftInput.value = fmtNum(tension)
    ftInput.inputMode = 'decimal'
    attachNumber(ftInput, FT_MIN, FT_MAX, () => tension, setTension)
    ftLabel.appendChild(ftInput)
    ftLabel.appendChild(el('span', null, 'N'))
    controls.appendChild(ftLabel)

    // Tension presets.
    const presetGroup = el('div', 'cluster')
    const zeroBtn = el('button', null, 'Zero tension')
    zeroBtn.type = 'button'
    zeroBtn.title = 'Set F_T = 0 (slack ropes)'
    zeroBtn.addEventListener('click', () => setTension(0))
    presetGroup.appendChild(zeroBtn)
    const balanceBtn = el('button', null, 'Balance the weight')
    balanceBtn.type = 'button'
    balanceBtn.title = 'Set F_T so the total tension balances the weight'
    balanceBtn.addEventListener('click', () => setTension((mass * G) / nRopes))
    presetGroup.appendChild(balanceBtn)
    controls.appendChild(presetGroup)

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
  }

  function updateReadout(f) {
    if (accelOut) accelOut.textContent = fmtNum(f.a)
    readout.textContent =
      `F_net = ${fmtF(f.net)} N${dirArrowV(f.net)}  ·  ` +
      `total F_T = ${fmtSigned(f.totalT)} N  ·  ` +
      (f.held ? `F_N = ${fmtF(f.Fn)} N  ·  ` : '') +
      `v = ${fmtSpeed(v)}${dirArrowV(v)}  ·  ` +
      `Δy = ${fmtAlt(y)}`
  }

  // -------------------------------------------------------------- keyboard
  function onKey(e) {
    const tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      setRopes(parseInt(e.key, 10))
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
      clock += dt
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
