export default function sketch(p) {
  const A_MIN = -3
  const A_MAX = 3
  const T_MAX = 10
  const V_MAX = 30

  let acc = 1
  let v0 = 0
  let running = false
  let t = 0
  let v = 0
  let disp = 0
  let samples = [{ t: 0, v: 0 }]

  let stage
  let controls
  let accInput
  let accVal
  let playBtn
  let resetBtn
  let readout

  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value))
  const fmt = (value, d = 1) => value.toFixed(d)

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function buildControls() {
    const accLabel = el('label')
    accLabel.appendChild(el('span', null, 'Acceleration'))
    accInput = el('input')
    accInput.type = 'range'
    accInput.min = A_MIN
    accInput.max = A_MAX
    accInput.step = 0.1
    accInput.value = acc
    accLabel.appendChild(accInput)
    accVal = el('span', 'val', `${fmt(acc)} m/s²`)
    accLabel.appendChild(accVal)
    controls.appendChild(accLabel)

    accInput.addEventListener('input', () => {
      acc = parseFloat(accInput.value)
      accVal.textContent = `${fmt(acc)} m/s²`
    })

    playBtn = el('button', null, 'Play')
    playBtn.addEventListener('click', () => {
      if (t >= T_MAX) reset()
      running = !running
      playBtn.textContent = running ? 'Pause' : 'Play'
      playBtn.classList.toggle('active', running)
    })
    controls.appendChild(playBtn)

    resetBtn = el('button', null, 'Reset')
    resetBtn.addEventListener('click', reset)
    controls.appendChild(resetBtn)

    controls.appendChild(el('span', 'spacer'))
    readout = el('span', 'readout', '')
    controls.appendChild(readout)
  }

  function reset() {
    running = false
    t = 0
    v = v0
    disp = 0
    samples = [{ t: 0, v: v0 }]
    if (playBtn) {
      playBtn.textContent = 'Play'
      playBtn.classList.remove('active')
    }
  }

  function updateReadout() {
    readout.textContent = `t = ${fmt(t)} s   ·   v = ${fmt(v)} m/s   ·   Δx = ${fmt(disp)} m`
  }

  p.setup = () => {
    stage = document.getElementById('stage')
    controls = document.getElementById('controls')
    v = v0
    buildControls()
    p.createCanvas(stage.clientWidth, stage.clientHeight)
    if (window.ResizeObserver)
      new ResizeObserver(() => p.resizeCanvas(stage.clientWidth, stage.clientHeight)).observe(stage)
  }

  p.windowResized = () => {
    p.resizeCanvas(stage.clientWidth, stage.clientHeight)
  }

  p.draw = () => {
    if (running) {
      const dt = clamp(p.deltaTime, 0, 100) / 1000
      t += dt
      if (t >= T_MAX) {
        t = T_MAX
        running = false
        playBtn.textContent = 'Play'
        playBtn.classList.remove('active')
      }
      v = v0 + acc * t
      disp += v * dt
      samples.push({ t, v })
    }
    updateReadout()
    render()
  }

  function render() {
    const w = p.width
    const h = p.height
    p.background(251, 251, 253)

    const pad = 14
    const graphLeft = 58
    const graphRight = w - pad
    const meterH = clamp(h * 0.22, 54, 120)
    const meterCy = 16 + meterH / 2
    const graphTop = 16 + meterH + 22
    const graphBottom = h - 30

    const tToX = tt => p.map(tt, 0, T_MAX, graphLeft, graphRight)
    const vToY = vv => p.map(vv, -V_MAX, V_MAX, graphBottom, graphTop)

    drawMeter(graphLeft, graphRight, meterCy)
    drawGraph(graphLeft, graphRight, graphTop, graphBottom, tToX, vToY)
  }

  function drawMeter(left, right, cy) {
    const originX = left
    const span = (right - left) * 0.42
    const len = p.map(clamp(v, -V_MAX, V_MAX), -V_MAX, V_MAX, -span, span)

    p.stroke(203, 213, 225)
    p.strokeWeight(1)
    p.line(left, cy, right, cy)

    p.stroke(226, 232, 240)
    for (let i = 0; i <= 6; i++) {
      const px = p.map(i, 0, 6, left, right)
      p.line(px, cy - 8, px, cy + 8)
    }

    const positive = v >= 0
    const color = positive ? p.color(11, 87, 208) : p.color(217, 119, 6)
    p.stroke(color)
    p.strokeWeight(4)
    p.line(originX, cy, originX + len, cy)
    p.noStroke()
    p.fill(color)
    p.triangle(
      originX + len + (positive ? 10 : -10), cy,
      originX + len, cy - 8,
      originX + len, cy + 8,
    )

    p.fill(31, 41, 55)
    p.textSize(13)
    p.textAlign(p.LEFT, p.BOTTOM)
    p.text(`v = ${fmt(v)} m/s`, originX, cy - 14)
  }

  function drawGraph(left, right, top, bottom, tToX, vToY) {
    p.stroke(226, 232, 240)
    p.strokeWeight(1)
    for (let tt = 0; tt <= T_MAX; tt += 2)
      p.line(tToX(tt), top, tToX(tt), bottom)
    for (let vv = -V_MAX; vv <= V_MAX; vv += 10)
      p.line(left, vToY(vv), right, vToY(vv))

    p.stroke(203, 213, 225)
    p.line(left, vToY(0), right, vToY(0))
    p.line(left, top, left, bottom)

    p.noStroke()
    p.fill(148, 163, 184)
    p.textSize(11)
    p.textAlign(p.CENTER, p.TOP)
    for (let tt = 0; tt <= T_MAX; tt += 2)
      p.text(`${tt}`, tToX(tt), bottom + 6)
    p.textAlign(p.RIGHT, p.CENTER)
    for (let vv = -V_MAX; vv <= V_MAX; vv += 10)
      p.text(`${vv}`, left - 6, vToY(vv))

    if (samples.length > 1) {
      const last = samples[samples.length - 1]
      p.noStroke()
      p.fill(11, 87, 208, 40)
      p.beginShape()
      p.vertex(tToX(0), vToY(0))
      for (const s of samples)
        p.vertex(tToX(s.t), vToY(s.v))
      p.vertex(tToX(last.t), vToY(0))
      p.endShape(p.CLOSE)

      p.noFill()
      p.stroke(11, 87, 208)
      p.strokeWeight(2.5)
      p.beginShape()
      for (const s of samples)
        p.vertex(tToX(s.t), vToY(s.v))
      p.endShape()

      p.noStroke()
      p.fill(11, 87, 208)
      p.circle(tToX(last.t), vToY(last.v), 9)
    }

    p.textAlign(p.RIGHT, p.BOTTOM)
    p.fill(107, 114, 128)
    p.textStyle(p.BOLD)
    p.text('t (s)', right, bottom + 24)
    p.textAlign(p.LEFT, p.TOP)
    p.text('v (m/s)', 6, top + 16)
    p.textStyle(p.NORMAL)

    p.fill(31, 41, 55)
    p.textSize(12)
    p.textAlign(p.LEFT, p.TOP)
    p.text(`slope = ${fmt(acc)} m/s²`, left + 10, top + 8)
    p.textAlign(p.RIGHT, p.TOP)
    p.text(`area = ${fmt(disp)} m`, right - 10, top + 8)
  }
}
