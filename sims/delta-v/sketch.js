// Delta-V — a top-down highway stunt about matching a moving car.
//
// The player's car is the object. The throttle lever sets the engine force;
// drag pushes back; the net force changes the car's velocity. A steady speed
// is therefore a balanced state: F_engine = F_drag, F_net = 0, a = 0.
//
// The stuntman jumps from the target car to the player's car. Because he
// inherits the target car's horizontal velocity, the landing offset is
//
//     offset = gap + (v_target - v_player) * jumpTime
//
// so the player has to match both velocity and position. The SPEED UP /
// SLOW DOWN banner makes that relative velocity visible before the jump
// instead of after it.

export default function sketch(p) {
  // ------------------------------------------------------------------ world
  const W = 960
  const H = 640
  const ROAD_TOP = 230
  const ROAD_BOTTOM = 470
  const TARGET_Y = 300
  const PLAYER_Y = 400
  const PLAYER_X = 290
  const PLAYER_X_REVERSE = 670
  const PX_PER_M = 20
  const CAR_LEN = 92
  const CAR_W = 42
  const LAND_TOL = 1.8
  const JUMP_T = 0.8
  const JUMP_RANGE = 5.0
  const JUMP_ARC = 62
  const MASS = 1200
  const ENGINE_MAX = 6000
  const BRAKE_MAX = 8000
  const DRAG_K = 6.0
  const FONT = 'Patrick Hand'

  const TITLE_BTN = { x: 380, y: 482, w: 200, h: 56 }
  const RESULT_BTN = { x: 360, y: 430, w: 240, h: 54 }

  const C = {
    panel: [10, 14, 24],
    white: [244, 247, 250],
    muted: [157, 169, 190],
    faint: [105, 117, 139],
    green: [34, 197, 94],
    amber: [245, 158, 11],
    red: [239, 68, 68],
    blue: [47, 111, 237],
    gold: [250, 204, 21]
  }

  const PALETTES = [
    // day desert
    { sand: [224, 190, 133], sandDark: [204, 166, 111], road: [63, 67, 77], line: [245, 235, 205], shoulder: [210, 172, 112], prop: [105, 137, 79], prop2: [139, 105, 67] },
    // sunset
    { sand: [217, 150, 101], sandDark: [192, 123, 80], road: [64, 57, 66], line: [255, 232, 196], shoulder: [199, 126, 83], prop: [104, 113, 70], prop2: [130, 87, 56] },
    // dusk
    { sand: [126, 108, 133], sandDark: [104, 89, 115], road: [50, 48, 60], line: [237, 226, 204], shoulder: [109, 94, 120], prop: [80, 96, 99], prop2: [96, 77, 88] },
    // storm
    { sand: [144, 150, 151], sandDark: [124, 131, 133], road: [60, 65, 67], line: [233, 238, 231], shoulder: [127, 135, 137], prop: [78, 97, 86], prop2: [94, 98, 97] },
    // neon night
    { sand: [51, 45, 70], sandDark: [41, 37, 59], road: [33, 33, 48], line: [236, 226, 177], shoulder: [49, 42, 68], prop: [64, 80, 101], prop2: [62, 52, 82] }
  ]

  const LEVELS = [
    {
      name: 'The Getaway',
      tag: 'Hold a steady speed.',
      startGap: 14,
      startPlayerV: 15,
      speed: [{ t: 0, v: 20 }, { t: 999, v: 20 }],
      manReadyAt: 2.5,
      dragScale: 1,
      palette: 0
    },
    {
      name: 'Speed Trap',
      tag: 'Target accelerating.',
      startGap: 18,
      startPlayerV: 16,
      speed: [{ t: 0, v: 20 }, { t: 5, v: 20 }, { t: 12, v: 28 }, { t: 999, v: 28 }],
      manReadyAt: 5,
      dragScale: 1,
      palette: 1
    },
    {
      name: 'Brake Check',
      tag: 'Target braking hard.',
      startGap: 12,
      startPlayerV: 24,
      speed: [{ t: 0, v: 26 }, { t: 4, v: 26 }, { t: 7, v: 17 }, { t: 13, v: 17 }, { t: 17, v: 24 }, { t: 999, v: 24 }],
      manReadyAt: 6,
      dragScale: 1,
      palette: 2,
      reverse: true
    },
    {
      name: 'Headwind',
      tag: 'Drag +55%. Add force.',
      startGap: 16,
      startPlayerV: 17,
      speed: [{ t: 0, v: 22 }, { t: 999, v: 22 }],
      manReadyAt: 4,
      dragScale: 1.55,
      palette: 3
    },
    {
      name: 'The Gauntlet',
      tag: 'Quick changes. Short window.',
      startGap: 18,
      startPlayerV: 18,
      speed: [{ t: 0, v: 20 }, { t: 4, v: 29 }, { t: 8, v: 18 }, { t: 12, v: 27 }, { t: 16, v: 22 }, { t: 999, v: 25 }],
      manReadyAt: 6,
      dragScale: 1,
      palette: 4,
      reverse: true
    }
  ]

  // ------------------------------------------------------------------ state
  let stage, controls, slider, sliderVal, jumpBtn, restartBtn, hintsCb, readout
  const view = { s: 1, ox: 0, oy: 0 }

  let state = 'title'            // title | play | jump | win | miss | complete
  let levelIndex = 0
  let level = LEVELS[0]
  let dir = 1                    // +1 travels right, -1 travels left
  let playerScreenX = PLAYER_X
  let levelTime = 0
  let playerX = 0, playerV = 0
  let targetX = 0, targetV = 0, targetVPrev = 0, targetAccel = 0
  let gap = 0
  let lever = 0.25
  let engine = 0, brake = 0, drag = 0, net = 0, accel = 0
  let manReady = false
  let hint = null, hintT = 0
  let hintsEnabled = true
  let jumpT = 0, jumpVt = 0, jumpVp = 0
  let jumpOffset = 0, jumpSuccess = false, jumpGap = 0, jumpDv = 0
  let result = null, resultT = 0
  let levelStars = [0, 0, 0, 0, 0]
  let roadDist = 0
  let titleT = 0
  let shake = 0
  let particles = []
  const keys = new Set()
  let lastJumpLabel = ''
  let lastJumpDisabled = null
  let lastReadout = ''
  let exhaustTimer = 0
  let targetExhaustTimer = 0

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const mod = (n, m) => ((n % m) + m) % m
  const el = (tag, cls, text) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }
  const setFill = (c, a = 255) => p.fill(c[0], c[1], c[2], a)

  function panel(x, y, w, h, a = 0.9, r = 12) {
    p.noStroke()
    p.fill(10, 14, 24, Math.round(a * 255))
    p.rect(x, y, w, h, r)
    p.noFill()
    p.stroke(255, 255, 255, 22)
    p.strokeWeight(1)
    p.rect(x, y, w, h, r)
    p.noStroke()
  }

  // ------------------------------------------------------------- level math
  function speedAt(t) {
    const pts = level.speed
    if (t <= pts[0].t) return pts[0].v
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i]
      const a = pts[i - 1]
      if (t <= b.t) {
        const u = (t - a.t) / (b.t - a.t)
        return a.v + (b.v - a.v) * u
      }
    }
    return pts[pts.length - 1].v
  }

  function engineForce() { return Math.max(lever, 0) * ENGINE_MAX }
  function brakeForce() { return Math.max(-lever, 0) * BRAKE_MAX }
  function landingOffsetNow() { return gap + (targetV - playerV) * JUMP_T }
  function canJump() {
    return state === 'play' && manReady && Math.abs(gap) <= JUMP_RANGE
  }

  // ------------------------------------------------------------------ setup
  p.setup = () => {
    stage = document.getElementById('stage')
    controls = document.getElementById('controls')
    buildControls()
    const sw = stage.clientWidth || W
    const sh = stage.clientHeight || H
    p.createCanvas(sw, sh)
    p.textFont(FONT)
    p.frameRate(60)
    resize()
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', () => keys.clear())
    setupPreview()
  }

  p.windowResized = () => resize()

  function resize() {
    if (!stage) return
    const sw = stage.clientWidth || W
    const sh = stage.clientHeight || H
    p.resizeCanvas(sw, sh)
    const s = Math.min(sw / W, sh / H)
    view.s = s
    view.ox = (sw - W * s) / 2
    view.oy = (sh - H * s) / 2
  }

  function buildControls() {
    controls.innerHTML = ''

    const throttleLabel = el('label', 'throttle-label')
    throttleLabel.appendChild(el('span', null, 'Throttle'))
    slider = el('input', 'throttle')
    slider.type = 'range'
    slider.min = -100
    slider.max = 100
    slider.step = 1
    slider.value = String(Math.round(lever * 100))
    slider.addEventListener('input', () => setLever(parseFloat(slider.value) / 100))
    throttleLabel.appendChild(slider)
    sliderVal = el('span', 'throttle-val', 'Engine 1,350 N')
    throttleLabel.appendChild(sliderVal)
    controls.appendChild(throttleLabel)

    jumpBtn = el('button', 'jump', 'Start')
    jumpBtn.addEventListener('click', primaryAction)
    controls.appendChild(jumpBtn)

    restartBtn = el('button', null, 'Restart')
    restartBtn.addEventListener('click', () => {
      if (state !== 'title' && state !== 'complete') startLevel(levelIndex)
    })
    controls.appendChild(restartBtn)

    const hintLabel = el('label')
    hintsCb = el('input')
    hintsCb.type = 'checkbox'
    hintsCb.checked = hintsEnabled
    hintsCb.addEventListener('change', () => {
      hintsEnabled = hintsCb.checked
      if (!hintsEnabled) hint = null
    })
    hintLabel.appendChild(hintsCb)
    hintLabel.appendChild(document.createTextNode('Hints'))
    controls.appendChild(hintLabel)

    controls.appendChild(el('span', 'spacer'))
    readout = el('span', 'readout', 'Balance the forces.')
    controls.appendChild(readout)
  }

  function setupPreview() {
    state = 'title'
    levelIndex = 0
    level = LEVELS[0]
    dir = 1
    playerScreenX = PLAYER_X
    levelTime = 0
    playerX = 0
    playerV = 20
    targetX = 0.6
    targetV = 20
    targetVPrev = 20
    targetAccel = 0
    gap = 0.6
    manReady = true
    hint = null
    hintT = 0
    jumpT = 0
    result = null
    resultT = 0
    particles = []
    roadDist = 0
    titleT = 0
    shake = 0
    engine = 0
    brake = 0
    drag = DRAG_K * playerV * playerV
    net = 0
    accel = 0
    setLever(drag / ENGINE_MAX)
  }

  function startNewGame() {
    levelStars = [0, 0, 0, 0, 0]
    startLevel(0)
  }

  function startLevel(i) {
    levelIndex = i
    level = LEVELS[i]
    dir = level.reverse ? -1 : 1
    playerScreenX = level.reverse ? PLAYER_X_REVERSE : PLAYER_X
    state = 'play'
    levelTime = 0
    playerX = 0
    playerV = level.startPlayerV
    targetX = level.startGap
    targetV = speedAt(0)
    targetVPrev = targetV
    targetAccel = 0
    gap = targetX - playerX
    manReady = false
    hint = null
    hintT = 0
    jumpT = 0
    jumpOffset = 0
    jumpSuccess = false
    jumpGap = 0
    jumpDv = 0
    result = null
    resultT = 0
    particles = []
    roadDist = 0
    shake = 0
    exhaustTimer = 0
    targetExhaustTimer = 0
    engine = 0
    brake = 0
    drag = DRAG_K * level.dragScale * playerV * playerV
    net = 0
    accel = 0
    setLever(drag / ENGINE_MAX)
  }

  function nextLevel() {
    if (levelIndex + 1 < LEVELS.length) {
      startLevel(levelIndex + 1)
    } else {
      state = 'complete'
      resultT = 0
      hint = null
    }
  }

  function primaryAction() {
    if (state === 'title' || state === 'complete') startNewGame()
    else if (state === 'play') { if (canJump()) startJump() }
    else if (state === 'win') nextLevel()
    else if (state === 'miss') startLevel(levelIndex)
  }

  // ------------------------------------------------------------------ input
  function setLever(v) {
    lever = clamp(v, -1, 1)
    if (slider) {
      const nv = String(Math.round(lever * 100))
      if (slider.value !== nv) slider.value = nv
    }
    updateLeverLabel()
  }

  function updateLeverLabel() {
    if (!sliderVal) return
    if (lever >= 0) sliderVal.textContent = `Engine ${Math.round(engineForce()).toLocaleString()} N`
    else sliderVal.textContent = `Brake ${Math.round(brakeForce()).toLocaleString()} N`
  }

  function onKeyDown(e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }
    keys.add(e.code)
    if (e.code === 'Space' && !e.repeat) primaryAction()
    if (e.code === 'KeyR') {
      if (state === 'play' || state === 'jump' || state === 'win' || state === 'miss') startLevel(levelIndex)
      else startNewGame()
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code)
  }

  p.mousePressed = () => {
    const m = mouseLogical()
    if (state === 'title') {
      if (inRect(m, TITLE_BTN)) primaryAction()
    } else if (state === 'win' || state === 'miss' || state === 'complete') {
      if (inRect(m, RESULT_BTN)) primaryAction()
    }
  }

  function mouseLogical() {
    return { x: (p.mouseX - view.ox) / view.s, y: (p.mouseY - view.oy) / view.s }
  }

  function inRect(m, r) {
    return m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h
  }

  // ----------------------------------------------------------------- physics
  function updatePlay(dt) {
    levelTime += dt

    targetVPrev = targetV
    targetV = speedAt(levelTime)
    targetAccel = dt > 0 ? (targetV - targetVPrev) / dt : 0
    targetX += targetV * dt

    engine = engineForce()
    brake = brakeForce()
    drag = DRAG_K * level.dragScale * playerV * playerV
    net = engine - brake - drag
    accel = net / MASS
    playerV += accel * dt
    if (playerV < 0) {
      playerV = 0
      accel = 0
    }
    playerX += playerV * dt

    gap = targetX - playerX
    roadDist += dir * playerV * dt * PX_PER_M
    manReady = levelTime >= level.manReadyAt

    updateHint(dt)
    updateExhaust(dt)
  }

  function updateHint(dt) {
    hintT += dt
    if (!hintsEnabled || state !== 'play') {
      hint = null
      return
    }
    const off = landingOffsetNow()
    if (hint === 'up') {
      if (off < LAND_TOL) hint = null
    } else if (hint === 'down') {
      if (off > -LAND_TOL) hint = null
    }
    if (!hint) {
      if (off > LAND_TOL + 0.4) { hint = 'up'; hintT = 0 }
      else if (off < -(LAND_TOL + 0.4)) { hint = 'down'; hintT = 0 }
    }
  }

  function startJump() {
    if (!canJump()) return
    jumpVt = targetV
    jumpVp = playerV
    jumpGap = gap
    jumpDv = targetV - playerV
    jumpOffset = gap + jumpDv * JUMP_T
    jumpSuccess = Math.abs(jumpOffset) <= LAND_TOL
    jumpT = 0
    state = 'jump'
    hint = null
    shake = 0.18
    spawnDust(playerScreenX + dir * gap * PX_PER_M, TARGET_Y, 8, [226, 202, 160])
  }

  function updateJump(dt) {
    jumpT += dt
    targetX += jumpVt * dt
    playerX += jumpVp * dt
    gap = targetX - playerX
    playerV = jumpVp
    targetV = jumpVt
    targetAccel = 0
    roadDist += dir * jumpVp * dt * PX_PER_M
    updateExhaust(dt)

    if (jumpT >= JUMP_T) {
      jumpT = JUMP_T
      finishJump()
    }
  }

  function finishJump() {
    const abGap = Math.abs(jumpGap)
    const abDv = Math.abs(jumpDv)
    const stars = abGap < 0.5 && abDv < 0.5 ? 3 : (abGap < 1.5 && abDv < 1.5 ? 2 : 1)
    result = {
      success: jumpSuccess,
      offset: jumpOffset,
      gap: jumpGap,
      dv: jumpDv,
      stars: jumpSuccess ? stars : 0,
      levelIndex,
      levelName: level.name
    }
    state = jumpSuccess ? 'win' : 'miss'
    resultT = 0
    hint = null
    if (jumpSuccess) {
      levelStars[levelIndex] = Math.max(levelStars[levelIndex] || 0, stars)
      spawnDust(playerScreenX, PLAYER_Y, 16, [226, 202, 160])
      shake = 0.25
    } else {
      spawnDust(playerScreenX + dir * jumpOffset * PX_PER_M, PLAYER_Y + 16, 20, [226, 202, 160])
      shake = 0.4
    }
  }

  function updateExhaust(dt) {
    exhaustTimer -= dt
    if (exhaustTimer <= 0 && engine > 0 && lever > 0.5) {
      exhaustTimer = 0.06
      particles.push({
        x: playerScreenX - dir * (CAR_LEN / 2 + 4),
        y: PLAYER_Y + (Math.random() * 20 - 10),
        vx: -dir * (40 + Math.random() * 55),
        vy: -10 + Math.random() * 20,
        life: 0.25, max: 0.25,
        size: 2 + Math.random() * 3,
        col: [170, 190, 210]
      })
    }
    targetExhaustTimer -= dt
    if (targetExhaustTimer <= 0 && targetAccel > 0.4) {
      targetExhaustTimer = 0.08
      const tx = playerScreenX + dir * gap * PX_PER_M
      particles.push({
        x: tx - dir * (CAR_LEN / 2 + 4),
        y: TARGET_Y + (Math.random() * 20 - 10),
        vx: -dir * (40 + Math.random() * 60),
        vy: -8 + Math.random() * 16,
        life: 0.28, max: 0.28,
        size: 2 + Math.random() * 3,
        col: [190, 200, 215]
      })
    }
  }

  // --------------------------------------------------------------- particles
  function spawnDust(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 20 + Math.random() * 90
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.45 - 20,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        size: 2 + Math.random() * 5,
        col
      })
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220)
  }

  function updateParticles(dt) {
    for (const q of particles) {
      q.life -= dt
      q.x += (q.vx - dir * playerV * PX_PER_M * 0.22) * dt
      q.y += q.vy * dt
      q.vy += 60 * dt
      q.vx *= (1 - dt * 1.2)
    }
    particles = particles.filter(q => q.life > 0)
  }

  // ------------------------------------------------------------------ frame
  p.draw = () => {
    const dt = clamp((p.deltaTime || 16) / 1000, 0, 0.05)

    if (state === 'play') {
      let d = 0
      const accelKey = dir > 0 ? 'ArrowRight' : 'ArrowLeft'
      const brakeKey = dir > 0 ? 'ArrowLeft' : 'ArrowRight'
      if (keys.has('ArrowUp') || keys.has(accelKey)) d += 1
      if (keys.has('ArrowDown') || keys.has(brakeKey)) d -= 1
      if (d) setLever(lever + d * 0.62 * dt)
      updatePlay(dt)
    } else if (state === 'jump') {
      updateJump(dt)
    } else if (state === 'title') {
      titleT += dt
      roadDist += dir * 155 * dt
    } else {
      resultT += dt
    }

    updateParticles(dt)
    shake = Math.max(0, shake - dt * 1.8)
    refreshPrimary()
    updateReadout()
    drawFrame()
  }

  function refreshPrimary() {
    if (!jumpBtn) return
    let label = ''
    let disabled = false
    if (state === 'title') {
      label = 'Start'
    } else if (state === 'play') {
      label = 'Jump'
      disabled = !canJump()
    } else if (state === 'jump') {
      label = 'Jumping…'
      disabled = true
    } else if (state === 'win') {
      label = levelIndex + 1 < LEVELS.length ? 'Next stunt' : 'Finish'
    } else if (state === 'miss') {
      label = 'Retry'
    } else {
      label = 'Play again'
    }

    if (label !== lastJumpLabel) {
      jumpBtn.textContent = label
      lastJumpLabel = label
    }
    if (disabled !== lastJumpDisabled) {
      jumpBtn.disabled = disabled
      lastJumpDisabled = disabled
    }
    if (slider) slider.disabled = state !== 'play'
    if (restartBtn) restartBtn.style.display = (state === 'title' || state === 'complete') ? 'none' : ''
  }

  function updateReadout() {
    if (!readout) return
    let t
    if (state === 'play') {
      const netScreen = dir * net
      const sign = netScreen > 0.5 ? '+' : ''
      t = `Engine ${Math.round(engine).toLocaleString()} N · Drag ${Math.round(drag).toLocaleString()} N · F_net ${sign}${Math.round(netScreen).toLocaleString()} N`
    } else if (state === 'jump') {
      t = 'Jump in progress…'
    } else if (state === 'title') {
      t = 'Balance engine and drag. Match the target.'
    } else if (state === 'win') {
      t = 'Catch complete.'
    } else if (state === 'miss') {
      t = 'Missed. Adjust the throttle and retry.'
    } else {
      t = 'All stunts cleared.'
    }
    if (t !== lastReadout) {
      readout.textContent = t
      lastReadout = t
    }
  }

  function drawFrame() {
    p.background(8, 10, 17)
    p.push()
    p.translate(view.ox, view.oy)
    p.scale(view.s)

    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake * 8 : 0
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake * 8 : 0
    p.push()
    p.translate(sx, sy)
    drawScene()
    p.pop()

    if (state === 'play' || state === 'jump') drawHUD()
    if (state === 'title') drawTitleOverlay()
    if (state === 'win' || state === 'miss' || state === 'complete') drawResultOverlay()

    p.pop()
  }

  // ------------------------------------------------------------------ scene
  function drawScene() {
    const pal = PALETTES[level.palette] || PALETTES[0]
    drawGround(pal)
    drawRoad(pal)

    const tx = playerScreenX + dir * gap * PX_PER_M
    drawCar(tx, TARGET_Y, pal, true)
    if (state === 'play' || state === 'title') drawTargetMan(tx)
    drawCar(playerScreenX, PLAYER_Y, pal, false)

    if (state === 'jump') drawJumpMan()
    else if (state === 'win' || (state === 'complete' && (!result || result.success))) drawManOnPlayer()
    else if (state === 'miss') drawManOnRoad()

    drawParticles()

    if ((state === 'play' || state === 'jump') && (tx < -50 || tx > W + 50)) drawTargetArrow(tx)
  }

  function drawGround(pal) {
    p.noStroke()
    setFill(pal.sand)
    p.rect(0, 0, W, H)
    p.fill(0, 0, 0, 10)
    p.rect(0, 0, W, ROAD_TOP - 40)
    p.fill(0, 0, 0, 14)
    p.rect(0, ROAD_BOTTOM + 20, W, H - ROAD_BOTTOM - 20)

    const scroll = roadDist
    for (let i = 0; i < 16; i++) {
      const x = mod(i * 167 - scroll, W + 260) - 130
      const top = i % 2 === 0
      const y = top ? 70 + (i * 53) % 120 : ROAD_BOTTOM + 50 + (i * 47) % 110
      drawProp(x, y, pal, i)
    }
  }

  function drawProp(x, y, pal, i) {
    p.noStroke()
    p.fill(0, 0, 0, 28)
    p.ellipse(x + 8, y + 10, 34, 16)
    if (i % 3 === 0) {
      setFill(pal.prop)
      p.rect(x - 5, y - 26, 10, 34, 5)
      p.rect(x - 17, y - 16, 13, 8, 4)
      p.rect(x - 17, y - 24, 8, 16, 4)
      p.rect(x + 5, y - 8, 14, 8, 4)
      p.rect(x + 12, y - 18, 8, 18, 4)
    } else if (i % 3 === 1) {
      setFill(pal.prop2)
      p.ellipse(x, y, 26 + (i % 4) * 4, 14 + (i % 3) * 3)
      p.fill(0, 0, 0, 20)
      p.ellipse(x + 3, y + 2, 16, 7)
    } else {
      p.fill(60, 55, 50, 180)
      p.rect(x - 2, y - 34, 4, 42, 2)
      p.fill(120, 100, 70, 160)
      p.rect(x - 7, y - 38, 14, 4, 2)
    }
  }

  function drawRoad(pal) {
    p.noStroke()
    setFill(pal.shoulder)
    p.rect(0, ROAD_TOP - 14, W, 14)
    p.rect(0, ROAD_BOTTOM, W, 14)
    setFill(pal.road)
    p.rect(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP)
    p.fill(0, 0, 0, 18)
    p.rect(0, ROAD_TOP, W, 10)
    p.fill(255, 255, 255, 8)
    p.rect(0, ROAD_TOP + 10, W, 2)

    setFill(pal.line, 210)
    p.rect(0, ROAD_TOP + 8, W, 4)
    p.rect(0, ROAD_BOTTOM - 12, W, 4)

    const mid = (ROAD_TOP + ROAD_BOTTOM) / 2
    const spacing = 80
    const dash = 46
    const off = mod(roadDist, spacing)
    setFill(pal.line, 230)
    for (let x = -off; x < W; x += spacing) p.rect(x, mid - 2, dash, 4, 2)

    p.fill(255, 255, 255, 9)
    for (let i = 0; i < 14; i++) {
      const y = ROAD_TOP + 24 + (i * 37) % (ROAD_BOTTOM - ROAD_TOP - 48)
      const x = mod(i * 131 - roadDist, W + 160) - 80
      p.rect(x, y, 40 + (i % 4) * 14, 1.5)
    }

    p.fill(0, 0, 0, 60)
    for (let i = 0; i < 10; i++) {
      const x = mod(i * 120 - roadDist, W + 120) - 60
      p.rect(x, ROAD_TOP - 18, 4, 7, 1)
      p.rect(x, ROAD_BOTTOM + 11, 4, 7, 1)
    }
  }

  function drawCar(x, y, pal, isTarget) {
    const L = CAR_LEN
    const Wd = CAR_W

    p.noStroke()
    p.fill(0, 0, 0, 55)
    p.rect(x - L / 2 + 6, y - Wd / 2 + 6, L, Wd, 14)

    p.push()
    p.translate(x, y)
    p.scale(dir, 1)
    p.translate(-x, -y)

    p.fill(16, 18, 24)
    p.rect(x - 38, y - Wd / 2 - 4, 17, 7, 3)
    p.rect(x + 21, y - Wd / 2 - 4, 17, 7, 3)
    p.rect(x - 38, y + Wd / 2 - 3, 17, 7, 3)
    p.rect(x + 21, y + Wd / 2 - 3, 17, 7, 3)

    const body = isTarget ? [205, 65, 65] : [45, 105, 232]
    p.fill(body[0], body[1], body[2])
    p.rect(x - L / 2, y - Wd / 2, L, Wd, 13)

    p.fill(0, 0, 0, 28)
    p.rect(x - L / 2 + 3, y + Wd / 2 - 13, L - 6, 10, 6)
    p.fill(255, 255, 255, 30)
    p.rect(x - L / 2 + 4, y - Wd / 2 + 3, L - 8, 4, 2)

    p.fill(body[0] * 0.82, body[1] * 0.82, body[2] * 0.82)
    p.rect(x + L / 2 - 24, y - Wd / 2 + 4, 20, Wd - 8, 7)
    p.rect(x - L / 2 + 3, y - Wd / 2 + 4, 17, Wd - 8, 7)

    p.fill(28, 42, 59)
    p.rect(x + 6, y - Wd / 2 + 7, 12, Wd - 14, 6)
    p.rect(x - 24, y - Wd / 2 + 7, 10, Wd - 14, 5)

    p.fill(isTarget ? 58 : 30, isTarget ? 38 : 62, isTarget ? 38 : 132)
    p.rect(x - 14, y - Wd / 2 + 8, 20, Wd - 16, 6)

    p.fill(isTarget ? 28 : 240, isTarget ? 28 : 244, isTarget ? 32 : 250)
    p.rect(x - L / 2 + 6, y - 2.5, L - 12, 5, 2)

    p.fill(255, 238, 180)
    p.rect(x + L / 2 - 5, y - Wd / 2 + 8, 4, 7, 2)
    p.rect(x + L / 2 - 5, y + Wd / 2 - 15, 4, 7, 2)

    const braking = isTarget ? targetAccel < -0.25 : brake > 10
    p.fill(braking ? 255 : 130, braking ? 50 : 35, braking ? 40 : 35)
    p.rect(x - L / 2 + 1, y - Wd / 2 + 8, 4, 7, 2)
    p.rect(x - L / 2 + 1, y + Wd / 2 - 15, 4, 7, 2)
    if (braking) {
      p.fill(255, 60, 40, 45)
      p.ellipse(x - L / 2 - 3, y - Wd / 2 + 11, 18, 12)
      p.ellipse(x - L / 2 - 3, y + Wd / 2 - 11, 18, 12)
    }

    if (level.palette === 4) {
      p.fill(255, 239, 190, 18)
      p.triangle(x + L / 2 - 2, y - 8, x + L / 2 + 52, y - 30, x + L / 2 + 52, y + 2)
      p.triangle(x + L / 2 - 2, y + 8, x + L / 2 + 52, y - 2, x + L / 2 + 52, y + 30)
    }

    p.pop()
  }

  function drawTargetMan(tx) {
    const ready = manReady || state === 'title'
    const t = state === 'title' ? titleT : levelTime
    const bob = Math.sin(t * 6) * 1.2
    if (ready) {
      p.noFill()
      p.stroke(34, 197, 94, 150)
      p.strokeWeight(2)
      p.ellipse(tx, TARGET_Y - 10, 30, 30)
      p.noStroke()
    }
    p.noStroke()
    p.fill(0, 0, 0, 40)
    p.ellipse(tx, TARGET_Y + 3, 16, 7)
    drawMan(tx, TARGET_Y - 4 + bob, 0.92, 0, 255, ready ? 'stand' : 'crouch')
  }

  function drawMan(x, y, scale, rot, alpha, pose) {
    p.push()
    p.translate(x, y)
    if (pose === 'crouch') p.translate(0, 3)
    p.rotate(rot)
    p.scale(scale)

    const legSpread = pose === 'jump' || pose === 'tumble' ? 7 : 3
    p.stroke(28, 32, 42)
    p.strokeWeight(3)
    p.line(-3, -10, -legSpread, 2)
    p.line(3, -10, legSpread, 2)

    p.strokeWeight(2.5)
    p.line(-4, -20, -9, -12)
    p.line(4, -20, 9, -12)

    p.noStroke()
    p.fill(238, 240, 244, alpha)
    p.rect(-6, -24, 12, 15, 5)
    p.fill(190, 55, 55, alpha)
    p.rect(-6, -24, 12, 4, 2)

    p.fill(226, 180, 140, alpha)
    p.ellipse(0, -30, 11, 11)
    p.fill(38, 32, 28, alpha)
    p.arc(0, -32, 11, 8, p.PI, p.TWO_PI)
    p.pop()
  }

  function drawJumpMan() {
    const u = clamp(jumpT / JUMP_T, 0, 1)
    const tx = playerScreenX + dir * gap * PX_PER_M
    const y = lerp(TARGET_Y, PLAYER_Y, u) - Math.sin(Math.PI * u) * JUMP_ARC
    const sy = lerp(TARGET_Y, PLAYER_Y, u) + 12

    p.noStroke()
    p.fill(0, 0, 0, 45)
    p.ellipse(tx, sy, 20 + 8 * Math.sin(Math.PI * u), 9)
    p.fill(255, 255, 255, 28)
    p.ellipse(tx, y + 6, 14, 34)
    drawMan(tx, y, 0.95, u * Math.PI * 2.4, 255, 'jump')
  }

  function drawManOnPlayer() {
    p.noStroke()
    p.fill(0, 0, 0, 45)
    p.ellipse(playerScreenX, PLAYER_Y + 5, 24, 10)
    drawMan(playerScreenX, PLAYER_Y - 4, 0.92, 0.1, 255, 'crouch')
  }

  function drawManOnRoad() {
    const x = playerScreenX + dir * jumpOffset * PX_PER_M
    p.noStroke()
    p.fill(0, 0, 0, 45)
    p.ellipse(x, PLAYER_Y + 24, 30, 12)
    drawMan(x, PLAYER_Y + 18, 0.95, 1.2, 255, 'tumble')
  }

  function drawTargetArrow(tx) {
    const toRight = tx > playerScreenX
    const x = toRight ? W - 22 : 22
    const edgeDir = toRight ? 1 : -1
    p.noStroke()
    p.fill(0, 0, 0, 80)
    p.rect(x - 60, TARGET_Y - 18, 120, 36, 10)
    p.fill(255, 255, 255, 25)
    p.triangle(x + edgeDir * 10, TARGET_Y, x - edgeDir * 8, TARGET_Y - 9, x - edgeDir * 8, TARGET_Y + 9)
    p.fill(255, 255, 255, 210)
    p.textAlign(p.CENTER, p.CENTER)
    p.textSize(14)
    p.text(`${Math.abs(gap).toFixed(0)} m`, x, TARGET_Y + 24)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawParticles() {
    p.noStroke()
    for (const q of particles) {
      const a = clamp(q.life / q.max, 0, 1) * 255
      p.fill(q.col[0], q.col[1], q.col[2], a * 0.7)
      p.ellipse(q.x, q.y, q.size, q.size * 0.75)
    }
  }

  // -------------------------------------------------------------------- HUD
  function drawHUD() {
    drawLevelPanel()
    if (state === 'play') {
      if (hintsEnabled) drawHint()
      drawForcePanel()
    }
  }

  function drawLevelPanel() {
    panel(330, 22, 300, 74)
    p.textAlign(p.CENTER, p.TOP)
    p.fill(C.muted[0], C.muted[1], C.muted[2])
    p.textSize(12)
    p.text(`STUNT ${levelIndex + 1} / ${LEVELS.length}`, 480, 36)
    p.fill(C.white[0], C.white[1], C.white[2])
    p.textSize(28)
    p.textStyle(p.BOLD)
    p.text(level.name.toUpperCase(), 480, 52)
    p.textStyle(p.NORMAL)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawHint() {
    if (!hint) return
    const up = hint === 'up'
    const col = up ? [22, 163, 74] : [217, 119, 6]
    const pulse = 0.72 + 0.28 * Math.sin(hintT * Math.PI * 2 * 1.2)
    const x = 300, y = 126, w = 360, h = 54
    p.noStroke()
    p.fill(col[0], col[1], col[2], 235 * pulse)
    p.rect(x, y, w, h, 12)
    p.fill(255, 255, 255, 30)
    p.rect(x + 2, y + 2, w - 4, 4, 2)
    p.fill(255, 255, 255, 245)
    p.textAlign(p.CENTER, p.TOP)
    p.textStyle(p.BOLD)
    p.textSize(30)
    const arrow = up ? (dir > 0 ? '→' : '←') : (dir > 0 ? '←' : '→')
    p.text(`${arrow}  ${up ? 'SPEED UP!' : 'SLOW DOWN!'}`, x + w / 2, y + 10)
    p.textStyle(p.NORMAL)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawForcePanel() {
    const px = playerScreenX - 220
    panel(px, 500, 440, 120)
    p.fill(C.muted[0], C.muted[1], C.muted[2])
    p.textAlign(p.LEFT, p.TOP)
    p.textSize(12)
    p.text(`m = ${MASS.toLocaleString()} kg`, px + 22, 508)
    p.textAlign(p.LEFT, p.TOP)

    drawFBD()

    const netScreen = dir * net
    const accelScreen = dir * accel
    const balanced = Math.abs(netScreen) < 25
    p.textAlign(p.LEFT, p.TOP)
    p.textStyle(p.BOLD)

    let rest
    if (balanced) {
      p.fill(C.green[0], C.green[1], C.green[2])
      rest = '= 0 N  ·  CONSTANT SPEED'
    } else {
      p.fill(netScreen > 0 ? C.green[0] : C.red[0], netScreen > 0 ? C.green[1] : C.red[1], netScreen > 0 ? C.green[2] : C.red[2])
      const sign = netScreen >= 0 ? '+' : ''
      const netArrow = netScreen >= 0 ? '→' : '←'
      rest = `= ${sign}${Math.round(netScreen).toLocaleString()} N  ${netArrow}  a = ${accelScreen >= 0 ? '+' : ''}${accelScreen.toFixed(2)} m/s²`
    }

    const lineY = 597
    p.textSize(16)
    const fW = p.textWidth('F')
    p.textSize(11)
    const subW = p.textWidth('net')
    p.textSize(16)
    const restW = p.textWidth(rest)
    const totalW = fW + 2 + subW + 4 + restW
    const startX = playerScreenX - totalW / 2
    p.text('F', startX, lineY)
    p.textSize(11)
    p.text('net', startX + fW + 2, lineY + 7)
    p.textSize(16)
    p.text(rest, startX + fW + 2 + subW + 4, lineY)

    p.textStyle(p.NORMAL)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawFBD() {
    const cx = playerScreenX
    const cy = 558
    const maxLen = 180
    const eLen = engine > 1 ? 10 + maxLen * clamp(engine / ENGINE_MAX, 0, 1) : 0
    const dLen = (drag + brake) > 1 ? 10 + maxLen * clamp((drag + brake) / ENGINE_MAX, 0, 1) : 0
    // Colour by screen direction: right/positive is green, left/negative is red.
    const engineCol = dir > 0 ? C.green : C.red
    const dragCol = dir > 0 ? C.red : C.green

    p.textAlign(p.CENTER, p.BOTTOM)
    p.textSize(12)
    if (eLen > 0) {
      p.fill(engineCol[0], engineCol[1], engineCol[2])
      p.text(`ENGINE ${Math.round(engine).toLocaleString()} N`, cx + dir * (12 + Math.max(eLen / 2, 60)), 538)
    }
    if (dLen > 0) {
      p.fill(dragCol[0], dragCol[1], dragCol[2])
      const label = brake > 10 ? 'DRAG + BRAKE' : 'DRAG'
      p.text(`${label} ${Math.round(drag + brake).toLocaleString()} N`, cx - dir * (12 + Math.max(dLen / 2, 60)), 538)
    }

    if (eLen > 0) drawFBDArrow(cx + dir * 12, cy, cx + dir * (12 + eLen), cy, engineCol)
    if (dLen > 0) drawFBDArrow(cx - dir * 12, cy, cx - dir * (12 + dLen), cy, dragCol)

    p.noStroke()
    p.fill(47, 111, 237)
    p.ellipse(cx, cy, 20, 20)
    p.noFill()
    p.stroke(255, 255, 255, 120)
    p.strokeWeight(2)
    p.ellipse(cx, cy, 24, 24)
    p.noStroke()

    p.fill(C.muted[0], C.muted[1], C.muted[2])
    p.textAlign(p.CENTER, p.BOTTOM)
    p.textSize(10)
    p.text('CAR', cx, 578)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawFBDArrow(x1, y1, x2, y2, col) {
    p.stroke(col[0], col[1], col[2])
    p.strokeWeight(4)
    p.line(x1, y1, x2, y2)
    p.noStroke()
    p.fill(col[0], col[1], col[2])
    const dir = x2 >= x1 ? 1 : -1
    p.triangle(x2 + dir * 7, y2, x2, y2 - 6, x2, y2 + 6)
  }

  // --------------------------------------------------------------- overlays
  function drawTitleOverlay() {
    p.noStroke()
    p.fill(6, 8, 15, 168)
    p.rect(0, 0, W, H)

    const cx = 480, cy = 142
    p.fill(34, 197, 94)
    p.triangle(cx - 30, cy + 26, cx + 30, cy + 26, cx, cy - 30)
    p.fill(6, 8, 15)
    p.triangle(cx - 15, cy + 18, cx + 15, cy + 18, cx, cy - 8)

    p.fill(255, 255, 255, 255)
    p.textAlign(p.CENTER, p.CENTER)
    p.textStyle(p.BOLD)
    p.textSize(58)
    p.text('DELTA-V', cx, cy + 78)
    p.textStyle(p.NORMAL)
    p.textSize(17)
    p.fill(180, 193, 210)
    p.text('MATCH SPEED  ·  BALANCE FORCES  ·  MAKE THE JUMP', cx, cy + 118)

    panel(536, 300, 372, 164, 0.82)
    p.textAlign(p.LEFT, p.TOP)
    p.textSize(16)
    p.fill(C.white[0], C.white[1], C.white[2])
    p.textStyle(p.BOLD)
    p.text('HOW TO PLAY', 560, 316)
    p.textStyle(p.NORMAL)
    p.fill(C.muted[0], C.muted[1], C.muted[2])
    p.textSize(14)
    p.text('Engine pushes forward. Drag pushes back.', 560, 344)
    p.text('Balance the arrows to hold a steady speed.', 560, 366)
    p.text("Match the target's speed and position, then jump.", 560, 388)
    p.fill(C.green[0], C.green[1], C.green[2])
    p.text('SPEED UP / SLOW DOWN tells you which way to adjust.', 560, 414)

    const b = TITLE_BTN
    const hover = inRect(mouseLogical(), b)
    p.noStroke()
    if (hover) p.fill(30, 180, 90)
    else p.fill(22, 163, 74)
    p.rect(b.x, b.y, b.w, b.h, 14)
    p.fill(255, 255, 255, 255)
    p.textAlign(p.CENTER, p.CENTER)
    p.textStyle(p.BOLD)
    p.textSize(24)
    p.text('PLAY', b.x + b.w / 2, b.y + b.h / 2 - 1)
    p.textStyle(p.NORMAL)
    p.fill(160, 172, 190)
    p.textSize(13)
    p.text('↑↓ throttle  ·  SPACE jump  ·  R restart', cx, 570)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawResultOverlay() {
    p.noStroke()
    p.fill(6, 8, 15, 190)
    p.rect(0, 0, W, H)
    panel(238, 138, 484, 366, 0.93, 16)

    const cx = 480
    p.textAlign(p.CENTER, p.TOP)
    p.textStyle(p.BOLD)

    if (state === 'complete') {
      p.fill(34, 197, 94)
      p.textSize(36)
      p.text('ALL STUNTS CLEARED', cx, 170)
      const total = levelStars.reduce((a, b) => a + b, 0)
      p.fill(C.white[0], C.white[1], C.white[2])
      p.textSize(18)
      p.textStyle(p.NORMAL)
      p.text(`${total} / ${LEVELS.length * 3} stars`, cx, 220)

      p.textStyle(p.NORMAL)
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      LEVELS.forEach((lv, i) => {
        p.fill(C.muted[0], C.muted[1], C.muted[2])
        p.text(`${i + 1}. ${lv.name}`, 330, 258 + i * 30)
        drawStars(590, 266 + i * 30, 7, levelStars[i] || 0)
      })
    } else {
      const win = state === 'win'
      const stars = result ? result.stars : 0
      if (win) p.fill(34, 197, 94)
      else p.fill(239, 68, 68)
      p.textSize(40)
      const headline = !win ? 'MISSED!' : (stars >= 3 ? 'PERFECT CATCH!' : (stars === 2 ? 'CLEAN CATCH!' : 'CAUGHT!'))
      p.text(headline, cx, 166)

      p.textStyle(p.NORMAL)
      p.fill(C.muted[0], C.muted[1], C.muted[2])
      p.textSize(15)
      p.text(level.name, cx, 216)

      if (result) {
        drawStars(cx, 252, 15, result.stars)
        p.fill(C.white[0], C.white[1], C.white[2])
        p.textSize(16)
        const offset = result.offset
        const where = Math.abs(offset) < 0.3
          ? 'LANDING CENTERED'
          : `LANDED ${Math.abs(offset).toFixed(1)} m ${offset > 0 ? 'AHEAD' : 'BEHIND'}`
        p.text(where, cx, 292)
        p.fill(C.muted[0], C.muted[1], C.muted[2])
        p.textSize(14)
        const dvDisplay = dir * result.dv
        p.text(`gap ${Math.abs(result.gap).toFixed(1)} m  ·  Δv ${dvDisplay >= 0 ? '+' : ''}${dvDisplay.toFixed(1)} m/s`, cx, 320)
        p.textSize(13)
        const note = !win
          ? 'Match the speed and position, then try again.'
          : (stars >= 2
            ? 'Speed and position matched. The stuntman is safe.'
            : 'Caught, but the match was loose. Try for a cleaner catch.')
        p.text(note, cx, 350)
      }
    }

    const b = RESULT_BTN
    const hover = inRect(mouseLogical(), b)
    p.noStroke()
    if (hover) p.fill(30, 180, 90)
    else p.fill(22, 163, 74)
    p.rect(b.x, b.y, b.w, b.h, 14)
    p.fill(255, 255, 255, 255)
    p.textAlign(p.CENTER, p.CENTER)
    p.textStyle(p.BOLD)
    p.textSize(20)
    const label = state === 'complete'
      ? 'PLAY AGAIN'
      : (state === 'win' ? (levelIndex + 1 < LEVELS.length ? 'NEXT STUNT' : 'FINISH') : 'RETRY')
    p.text(label, b.x + b.w / 2, b.y + b.h / 2 - 1)
    p.textStyle(p.NORMAL)
    p.textAlign(p.LEFT, p.TOP)
  }

  function drawStars(cx, cy, r, n) {
    for (let i = 0; i < 3; i++) {
      drawStar(cx + (i - 1) * (r * 2.6), cy, r, i < n)
    }
  }

  function drawStar(x, y, r, filled) {
    if (filled) {
      p.fill(C.gold[0], C.gold[1], C.gold[2])
      p.noStroke()
    } else {
      p.noFill()
      p.stroke(120, 130, 148)
      p.strokeWeight(1.5)
    }
    p.beginShape()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5
      const rr = i % 2 === 0 ? r : r * 0.45
      p.vertex(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    p.endShape(p.CLOSE)
    p.noStroke()
  }
}
