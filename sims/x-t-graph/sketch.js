export default function sketch(p) {
  const V_MIN = -4
  const V_MAX = 4
  const T_MAX = 10
  const X_MAX = 40

  let vel = 2
  let running = false
  let t = 0
  let x = 0
  let samples = [{ t: 0, x: 0 }]

  let stage
  let controls
  let speedInput
  let speedVal
  let playBtn
  let resetBtn
  let readout

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const fmt = (v, d = 1) => v.toFixed(d)

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function buildControls() {
    const speedLabel = el('label')
    speedLabel.appendChild(el('span', null, 'Velocity'))
    speedInput = el('input')
    speedInput.type = 'range'
    speedInput.min = V_MIN
    speedInput.max = V_MAX
    speedInput.step = 0.1
    speedInput.value = vel
    speedLabel.appendChild(speedInput)
    speedVal = el('span', 'val', `${fmt(vel)} m/s`)
    speedLabel.appendChild(speedVal)
    controls.appendChild(speedLabel)

    speedInput.addEventListener('input', () => {
      vel = parseFloat(speedInput.value)
      speedVal.textContent = `${fmt(vel)} m/s`
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
    x = 0
    samples = [{ t: 0, x: 0 }]
    if (playBtn) {
      playBtn.textContent = 'Play'
      playBtn.classList.remove('active')
    }
  }

  function updateReadout() {
    readout.textContent = `t = ${fmt(t)} s   ·   x = ${fmt(x)} m   ·   v = ${fmt(vel)} m/s`
  }

  function resize() {
    p.resizeCanvas(stage.clientWidth, stage.clientHeight)
  }

  p.setup = () => {
    stage = document.getElementById('stage')
    controls = document.getElementById('controls')
    buildControls()
    p.createCanvas(stage.clientWidth, stage.clientHeight)
    if (window.ResizeObserver)
      new ResizeObserver(resize).observe(stage)
  }

  p.windowResized = resize

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
      x += vel * dt
      samples.push({ t, x })
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
    const trackH = clamp(h * 0.28, 64, 140)
    const trackCx = graphLeft
    const trackCy = 16 + trackH / 2
    const graphTop = 16 + trackH + 22
    const graphBottom = h - 30

    const tToX = tt => p.map(tt, 0, T_MAX, graphLeft, graphRight)
    const xToY = xx => p.map(xx, -X_MAX, X_MAX, graphBottom, graphTop)

    drawTrack(graphLeft, graphRight, trackCx, trackCy, trackH)
    drawGraph(graphLeft, graphRight, graphTop, graphBottom, tToX, xToY)
  }

  function drawTrack(left, right, cxHint, cy, trackH) {
    p.noFill()
    p.stroke(203, 213, 225)
    p.strokeWeight(1)
    p.line(left, cy, right, cy)

    p.stroke(226, 232, 240)
    for (let xx = -X_MAX; xx <= X_MAX; xx += 10) {
      const px = p.map(xx, -X_MAX, X_MAX, left, right)
      p.line(px, cy - 10, px, cy + 10)
    }

    const cartX = p.map(clamp(x, -X_MAX, X_MAX), -X_MAX, X_MAX, left, right)
    p.noStroke()
    p.fill(15, 23, 42)
    p.rectMode(p.CENTER)
    p.rect(cartX, cy - 14, 26, 18, 3)
    p.fill(11, 87, 208)
    p.circle(cartX - 8, cy - 3, 8)
    p.circle(cartX + 8, cy - 3, 8)
    p.rectMode(p.CORNER)

    p.fill(107, 114, 128)
    p.noStroke()
    p.textSize(11)
    p.textAlign(p.CENTER, p.TOP)
    p.text('position', (left + right) / 2, cy + 12)
  }

  function drawGraph(left, right, top, bottom, tToX, xToY) {
    p.stroke(226, 232, 240)
    p.strokeWeight(1)
    for (let tt = 0; tt <= T_MAX; tt += 2) {
      const px = tToX(tt)
      p.line(px, top, px, bottom)
    }
    for (let xx = -X_MAX; xx <= X_MAX; xx += 10) {
      const py = xToY(xx)
      p.line(left, py, right, py)
    }

    p.stroke(203, 213, 225)
    p.line(left, xToY(0), right, xToY(0))
    p.line(left, top, left, bottom)

    p.noStroke()
    p.fill(148, 163, 184)
    p.textSize(11)
    p.textAlign(p.CENTER, p.TOP)
    for (let tt = 0; tt <= T_MAX; tt += 2)
      p.text(`${tt}`, tToX(tt), bottom + 6)
    p.textAlign(p.RIGHT, p.CENTER)
    for (let xx = -X_MAX; xx <= X_MAX; xx += 20)
      p.text(`${xx}`, left - 6, xToY(xx))

    p.textAlign(p.RIGHT, p.BOTTOM)
    p.fill(107, 114, 128)
    p.textStyle(p.BOLD)
    p.text('t (s)', right, bottom + 24)
    p.textAlign(p.LEFT, p.TOP)
    p.text('x (m)', 6, top + 16)
    p.textStyle(p.NORMAL)

    if (samples.length > 1) {
      p.noFill()
      p.stroke(11, 87, 208)
      p.strokeWeight(2.5)
      p.beginShape()
      for (const s of samples)
        p.vertex(tToX(s.t), xToY(s.x))
      p.endShape()
    }

    const last = samples[samples.length - 1]
    p.noStroke()
    p.fill(11, 87, 208)
    p.circle(tToX(last.t), xToY(last.x), 9)

    p.fill(31, 41, 55)
    p.textSize(12)
    p.textAlign(p.LEFT, p.TOP)
    p.text(`slope = ${fmt(vel)} m/s`, left + 10, top + 8)
  }
}
