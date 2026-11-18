// Static vs. Kinetic Friction — a hand-drawn 1-D friction sandbox.
//
// A crate sits on a rough floor while the player sets the push strength and
// direction. The camera is locked to the crate, so the crate stays put and the
// ground marks, fence, bushes and hills scroll past to show motion.
//
// Two floating free-body diagrams update every frame:
//   1. all forces (F_N, F_g, F_app, and F_s or F_k)
//   2. the net force alone
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
  const SCROLL_CAP = 12     // m/s of visual scroll (keeps extreme runs sane)
  const PX_PER_N = 0.65     // fixed force scale, shared by both diagrams
  const ARROW_MAX = 78
  const EPS_V = 0.03        // below this the crate counts as at rest

  // Floating diagram cards, above the crate.
  const CARD1 = { x: 268, y: 14, w: 424, h: 210 }
  const CARD2 = { x: 340, y: 236, w: 280, h: 104 }
  const DOT1 = { x: 480, y: 128 }
  const DOT2 = { x: 480, y: 302 }

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
    box: [238, 242, 247],
    boxLine: [148, 163, 184],
    dirt: [244, 246, 249],
    hillFar: [233, 238, 244],
    hillNear: [222, 231, 241],
    cloud: [236, 242, 249],
    foliage: [182, 199, 186],
    foliageLine: [140, 163, 145],
    trunk: [146, 128, 105]
  }

  // ---------------------------------------------------------------- state
  let mass = 10        // kg
  let mus = 0.5
  let muk = 0.4
  let push = 30        // N, magnitude
  let dir = 1          // +1 right, -1 left
  let paused = false

  let v = 0            // m/s, signed
  let x = 0            // m, displacement from the start
  let camX = 0         // m, visual scroll (capped) used to place the world
  let dustAcc = 0
  let dust = []

  // Logical units of letterbox margin on each side of the fixed 960x640 world.
  // The background bleeds out to these so the scene fills the whole stage.
  let viewPadX = 0
  let viewPadY = 0

  let stage, controls
  let handReady = false

  let pushInput, pushVal, leftBtn, rightBtn, pauseBtn, readout
  let mukCtl

  // -------------------------------------------------------------- helpers
  const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val))
  const fmtF = (val) => {
    const a = Math.abs(val)
    if (a < 0.05) return '0'
    const s = a.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
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
  function drawSub(parts, x, y, align = 'LEFT', size = 14.5, color = C.ink) {
    const subSize = size * 0.68
    const widths = parts.map((pt) => {
      p.textSize(pt.sub ? subSize : size)
      return p.textWidth(pt.t)
    })
    const total = widths.reduce((a, b) => a + b, 0)
    let cx = align === 'CENTER' ? x - total / 2 : align === 'RIGHT' ? x - total : x
    p.fill(...color)
    p.textAlign(p.LEFT, p.BASELINE)
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i]
      p.textSize(pt.sub ? subSize : size)
      p.text(pt.t, cx, y + (pt.sub ? size * 0.3 : 0))
      cx += widths[i]
    }
  }

  const forceSym = (sub, value, unit = 'N') => [
    { t: 'F' },
    { t: sub, sub: true },
    { t: ` = ${fmtF(value)} ${unit}` }
  ]

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

    camX += clamp(v, -SCROLL_CAP, SCROLL_CAP) * dt

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
      x: BOX_X + back * (BOX_W / 2 - 8) + (p.random() - 0.5) * 12,
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
    camX = 0
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
    p.textSize(14)
    const w = p.textWidth(text) + 18
    const h = 22
    const x = rightX - w
    p.noStroke()
    p.fill(...bg)
    p.rect(x, cy - h / 2, w, h, 11)
    p.stroke(...fg)
    p.strokeWeight(1.3)
    strokeLoop(roundRectPoints(x, cy - h / 2, w, h, 11, 3), seed, 0.45)
    p.fill(...fg)
    p.textAlign(p.CENTER, p.CENTER)
    p.text(text, x + w / 2, cy + 1)
  }

  function drawFBD(f) {
    drawCard(CARD1, 801)

    p.fill(...C.ink)
    p.textSize(17)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Free-body diagram', CARD1.x + 20, CARD1.y + 26)

    const rest = f.kind === 'static'
    drawChip(
      CARD1.x + CARD1.w - 18,
      CARD1.y + 26,
      rest ? 'at rest' : 'sliding',
      rest ? C.normal : [180, 83, 9],
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

    dot(d.x, d.y, 5.5, C.ink)

    // Keep the vertical labels clear of the horizontal arrows even when a
    // light box makes F_N and F_g short.
    if (lenN > 0) {
      drawSub(forceSym('N', f.Fn), d.x + 12, d.y - Math.max(lenN, 52) + 5, 'LEFT', 14.5, C.normal)
    }
    if (lenG > 0) {
      drawSub(forceSym('g', f.Fg), d.x + 12, d.y + Math.max(lenG, 52) + 5, 'LEFT', 14.5, C.gravity)
    }
    if (lenA > 0) {
      const tx = d.x + Math.sign(f.fapp) * Math.max(lenA, 40)
      drawSub(forceSym('app', f.fapp), tx, d.y - 12, 'CENTER', 14.5, C.applied)
    }
    if (lenF > 0) {
      const tx = d.x + Math.sign(f.friction) * Math.max(lenF, 40)
      const sym = f.kind === 'static' ? 's' : 'k'
      drawSub(forceSym(sym, f.friction), tx, d.y + 24, 'CENTER', 14.5, C.friction)
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
      CARD1.y + 198,
      'LEFT',
      13.5,
      C.muted
    )
  }

  function drawNet(f) {
    drawCard(CARD2, 901)

    p.fill(...C.ink)
    p.textSize(17)
    p.textAlign(p.LEFT, p.CENTER)
    p.text('Net force', CARD2.x + 20, CARD2.y + 26)

    const zero = Math.abs(f.net) < 0.05
    drawSub(
      [
        { t: 'F' },
        { t: 'net', sub: true },
        { t: ` = ${fmtF(f.net)} N` }
      ],
      CARD2.x + CARD2.w - 18,
      CARD2.y + 26,
      'RIGHT',
      15,
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
        DOT2.x + Math.sign(f.net) * Math.max(len, 40),
        DOT2.y - 12,
        'CENTER',
        14.5,
        C.net
      )
    } else {
      p.noFill()
      p.stroke(...C.faint)
      p.strokeWeight(1.2)
      p.circle(DOT2.x, DOT2.y, 18)
    }

    dot(DOT2.x, DOT2.y, 5, C.ink)

    p.fill(...C.muted)
    p.textSize(12.5)
    p.textAlign(p.CENTER, p.BASELINE)
    p.text(zero ? 'balanced' : 'unbalanced', DOT2.x, DOT2.y + 30)
  }

  // --------------------------------------------------------------- scene
  function drawHillLayer(factor, baseY, amp, period, color, phase) {
    const off = camX * PX_PER_M * factor
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
    const shift = (((camX * PX_PER_M * 0.06) % cycle) + cycle) % cycle
    for (let i = -1; i <= n + 2; i++) {
      const idx = ((i % n) + n) % n
      const bx = i * period + 90 - shift
      if (bx < -viewPadX - 180 || bx > W + viewPadX + 180) continue
      const cy = 360 + hash(idx * 5.3) * 44
      const s = 0.75 + hash(idx * 8.1) * 0.5
      const w = 140 * s
      const h = 42 * s
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
    const k0 = Math.floor((camX - span) / period)
    const k1 = Math.ceil((camX + span) / period)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period + hash(k * 3.7) * 2.4
      const sx = BOX_X + (wx - camX) * PX_PER_M * factor
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
    const k0 = Math.floor((camX - span) / period)
    const k1 = Math.ceil((camX + span) / period)
    const baseY = GROUND_Y - 4
    const postH = 30
    p.stroke(...C.faint)
    p.strokeWeight(1.6)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period
      const sx = BOX_X + (wx - camX) * PX_PER_M * factor
      roughLine(sx, baseY, sx, baseY - postH, k * 3.3, 0.4)
    }
    // Two rails between consecutive posts.
    for (let k = k0; k <= k1; k++) {
      const x0 = BOX_X + (k * period - camX) * PX_PER_M * factor
      const x1 = BOX_X + ((k + 1) * period - camX) * PX_PER_M * factor
      if (x1 < -viewPadX - 10 || x0 > W + viewPadX + 10) continue
      roughLine(x0, baseY - postH * 0.45, x1, baseY - postH * 0.45, k * 5.1, 0.4)
      roughLine(x0, baseY - postH * 0.85, x1, baseY - postH * 0.85, k * 6.7, 0.4)
    }
  }

  function drawBushes() {
    const period = 3.3
    const factor = 0.94
    const span = (W / 2 + viewPadX) / (PX_PER_M * factor) + 4
    const k0 = Math.floor((camX - span) / period)
    const k1 = Math.ceil((camX + span) / period)
    for (let k = k0; k <= k1; k++) {
      const wx = k * period + hash(k * 1.9) * 1.4
      const sx = BOX_X + (wx - camX) * PX_PER_M * factor
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

  function drawGround() {
    // Dirt below the floor line, full-bleed.
    p.noStroke()
    p.fill(...C.dirt)
    p.rect(-viewPadX, GROUND_Y, W + viewPadX * 2, H - GROUND_Y + viewPadY)

    const span = (W / 2 + viewPadX) / PX_PER_M + 4
    const k0 = Math.floor((camX - span) / 0.5)
    const k1 = Math.ceil((camX + span) / 0.5)

    // Half-metre marks: the scrolling ruler.
    p.stroke(...C.faint)
    p.strokeWeight(1.3)
    for (let k = k0; k <= k1; k++) {
      const sx = BOX_X + (k * 0.5 - camX) * PX_PER_M
      roughLine(sx, GROUND_Y - 9, sx, GROUND_Y - 1, k * 1.7, 0.3)
    }

    // Pebbles.
    p.noStroke()
    for (let k = k0; k <= k1; k++) {
      if (hash(k * 4.7) < 0.45) continue
      const sx = BOX_X + (k * 0.5 - camX) * PX_PER_M + jit(k * 2.3, 7)
      const sy = GROUND_Y + 12 + hash(k * 6.1) * 22
      p.fill(...C.faint)
      p.circle(sx, sy, 2 + hash(k * 8.7) * 3)
    }

    // Hand-drawn floor line + hatching.
    p.stroke(...C.ink)
    p.strokeWeight(2.4)
    roughLine(-viewPadX - 12, GROUND_Y, W + viewPadX + 12, GROUND_Y, 77, 0.7)
    p.stroke(...C.line)
    p.strokeWeight(1.3)
    for (let k = k0; k <= k1; k++) {
      const sx = BOX_X + (k * 0.5 - camX) * PX_PER_M
      roughLine(sx, GROUND_Y + 7, sx - 12, GROUND_Y + 28, k * 3.7, 0.5)
    }
  }

  function drawBox() {
    const left = BOX_X - BOX_W / 2
    const top = GROUND_Y - BOX_H

    p.noStroke()
    p.fill(31, 41, 55, 20)
    p.ellipse(BOX_X, GROUND_Y + 4, BOX_W * 1.14, 18)

    p.fill(...C.box)
    p.rect(left, top, BOX_W, BOX_H, 5)

    p.stroke(...C.boxLine)
    p.strokeWeight(1.2)
    roughLine(left + 7, top + BOX_H * 0.28, left + BOX_W - 7, top + BOX_H * 0.28, 601, 0.5)
    roughLine(left + 7, top + BOX_H * 0.72, left + BOX_W - 7, top + BOX_H * 0.72, 602, 0.5)

    p.stroke(...C.ink)
    p.strokeWeight(2.6)
    roughRect(left, top, BOX_W, BOX_H, 600, 0.8)

    p.fill(...C.ink)
    p.noStroke()
    p.textSize(22)
    p.textAlign(p.CENTER, p.CENTER)
    const kg = Number.isInteger(mass) ? `${mass}` : mass.toFixed(1)
    p.text(`${kg} kg`, BOX_X, top + BOX_H * 0.5)
  }

  function drawDust() {
    for (const d of dust) {
      const a = clamp(d.life / d.max, 0, 1)
      p.noStroke()
      p.fill(148, 163, 184, 150 * a)
      p.circle(d.x, d.y, d.r * 2)
    }
  }

  function drawHints() {
    p.fill(...C.muted)
    p.textSize(13)
    p.textAlign(p.LEFT, p.BASELINE)
    p.text('frame of reference follows the box', 20, 28)
    p.textAlign(p.RIGHT, p.BASELINE)
    p.textSize(12.5)
    p.text('drag the push slider  \u00b7  \u2190/\u2192 flips direction  \u00b7  space pauses', W - 18, H - 14)
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
    drawFBD(f)
    drawNet(f)
    drawHints()
  }

  // -------------------------------------------------------------- controls
  function setPush(val) {
    push = clamp(val, 0, 120)
    if (pushInput) {
      pushInput.value = push
      pushVal.textContent = `${push.toFixed(0)} N`
    }
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

  // `get` keeps the readout honest when `set` clamps the value it was given
  // (mu_k is never allowed above mu_s).
  function addSlider(text, min, max, step, get, set, format) {
    const label = el('label')
    label.appendChild(el('span', null, text))
    const input = el('input')
    input.type = 'range'
    input.min = min
    input.max = max
    input.step = step
    input.value = get()
    label.appendChild(input)
    const val = el('span', 'val', format(get()))
    label.appendChild(val)
    input.addEventListener('input', () => {
      set(parseFloat(input.value))
      input.value = get()
      val.textContent = format(get())
    })
    controls.appendChild(label)
    return { input, val }
  }

  function buildControls() {
    // Push magnitude.
    const pushLabel = el('label')
    pushLabel.appendChild(el('span', null, 'Push'))
    pushInput = el('input')
    pushInput.type = 'range'
    pushInput.min = 0
    pushInput.max = 120
    pushInput.step = 1
    pushInput.value = push
    pushInput.addEventListener('input', () => setPush(parseFloat(pushInput.value)))
    pushLabel.appendChild(pushInput)
    pushVal = el('span', 'val', `${push} N`)
    pushLabel.appendChild(pushVal)
    controls.appendChild(pushLabel)

    // Direction.
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
    addSlider(
      'Mass',
      1,
      10,
      0.5,
      () => mass,
      (val) => {
        mass = val
      },
      (val) => `${Number.isInteger(val) ? val : val.toFixed(1)} kg`
    )

    // Friction coefficients.
    addSlider(
      'μs',
      0,
      2,
      0.05,
      () => mus,
      (val) => {
        mus = val
        if (muk > mus) {
          muk = mus
          if (mukCtl) {
            mukCtl.input.value = muk
            mukCtl.val.textContent = muk.toFixed(2)
          }
        }
      },
      (val) => val.toFixed(2)
    )

    mukCtl = addSlider(
      'μk',
      0,
      2,
      0.05,
      () => muk,
      (val) => {
        muk = Math.min(val, mus)
      },
      (val) => val.toFixed(2)
    )

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
      `F_net = ${fmtF(f.net)} N${dirArrow(f.net)}   ` +
      `a = ${f.a.toFixed(2)} m/s²${dirArrow(f.a)}   ` +
      `v = ${v.toFixed(2)} m/s${dirArrow(v)}   ` +
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
      setPush(push + 5)
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      setPush(push - 5)
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
        .load('16px "Patrick Hand"')
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
