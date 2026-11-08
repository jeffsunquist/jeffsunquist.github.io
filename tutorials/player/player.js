// Animated tutorial player: a scene of SVG objects driven by a scrubbable
// timeline. Each step is a keyframe; scrubbing tweens between neighbouring
// keyframes, so the timeline works forwards and backwards.
//
// Usage:
//   import { createPlayer } from '../player/player.js'
//   createPlayer(document.getElementById('tutorial'), tutorial)

const SVG = 'http://www.w3.org/2000/svg'

const COLORS = {
  ink: '#1f2937',
  muted: '#6b7280',
  line: '#cbd5e1',
  amber: '#b45309',
  red: '#b91c1c',
  green: '#15803d',
  purple: '#6d28d9',
  teal: '#0f766e',
  blue: '#0b57d0'
}

const NUMERIC = ['x', 'y', 'w', 'h', 'dx', 'dy', 'r']
const DUR_PER_STEP = 1.35

function svgEl(name, attrs = {}) {
  const e = document.createElementNS(SVG, name)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  return e
}

function esc(s) {
  return String(s == null ? '' : s)
}

function renderEquation(el, tex) {
  el.innerHTML = ''
  if (!tex) return
  if (window.katex) {
    try {
      window.katex.render(tex, el, { throwOnError: false, displayMode: true })
      return
    } catch (err) { /* fall through */ }
  }
  el.textContent = tex
}

function buildObject(o) {
  const g = svgEl('g')
  const parts = {}
  if (o.kind === 'ground') {
    parts.line = svgEl('line', { stroke: '#94a3b8', 'stroke-width': 2 })
    g.appendChild(parts.line)
  } else if (o.kind === 'box') {
    parts.rect = svgEl('rect', { rx: 8, fill: '#eef2f7', stroke: '#94a3b8', 'stroke-width': 2 })
    parts.text = svgEl('text', {
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 16, fill: COLORS.ink, 'font-family': 'system-ui, sans-serif'
    })
    g.append(parts.rect, parts.text)
  } else if (o.kind === 'circle') {
    parts.circle = svgEl('circle', { fill: '#eef2f7', stroke: '#94a3b8', 'stroke-width': 2 })
    parts.text = svgEl('text', {
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 16, fill: COLORS.ink, 'font-family': 'system-ui, sans-serif'
    })
    g.append(parts.circle, parts.text)
  } else if (o.kind === 'arrow') {
    parts.line = svgEl('line', { 'stroke-width': 4, 'stroke-linecap': 'round' })
    parts.head = svgEl('polygon')
    parts.text = svgEl('text', {
      'font-size': 15, 'font-weight': 600, 'dominant-baseline': 'middle',
      'font-family': 'system-ui, sans-serif'
    })
    g.append(parts.line, parts.head, parts.text)
  } else {
    parts.text = svgEl('text', {
      'font-size': 15, 'dominant-baseline': 'middle',
      'font-family': 'system-ui, sans-serif', fill: COLORS.ink
    })
    g.append(parts.text)
  }
  return { g, parts }
}

function drawObject(o, refs, st) {
  const { g, parts } = refs
  g.style.opacity = String(st.opacity)
  const color = COLORS[st.color] || st.color || COLORS.ink

  if (o.kind === 'ground') {
    parts.line.setAttribute('x1', 0)
    parts.line.setAttribute('x2', 10000)
    parts.line.setAttribute('y1', st.y)
    parts.line.setAttribute('y2', st.y)
    return
  }

  if (o.kind === 'box') {
    parts.rect.setAttribute('x', st.x)
    parts.rect.setAttribute('y', st.y)
    parts.rect.setAttribute('width', st.w)
    parts.rect.setAttribute('height', st.h)
    parts.text.setAttribute('x', st.x + st.w / 2)
    parts.text.setAttribute('y', st.y + st.h / 2)
    parts.text.textContent = esc(st.label)
    return
  }

  if (o.kind === 'circle') {
    parts.circle.setAttribute('cx', st.x)
    parts.circle.setAttribute('cy', st.y)
    parts.circle.setAttribute('r', st.r)
    parts.text.setAttribute('x', st.x)
    parts.text.setAttribute('y', st.y)
    parts.text.textContent = esc(st.label)
    return
  }

  if (o.kind === 'arrow') {
    const len = Math.hypot(st.dx || 0, st.dy || 0)
    if (len < 2) { g.style.opacity = '0'; return }
    const ux = st.dx / len
    const uy = st.dy / len
    const x2 = st.x + st.dx
    const y2 = st.y + st.dy
    const head = Math.min(13, len * 0.4)
    parts.line.setAttribute('x1', st.x)
    parts.line.setAttribute('y1', st.y)
    parts.line.setAttribute('x2', x2 - ux * head * 0.9)
    parts.line.setAttribute('y2', y2 - uy * head * 0.9)
    parts.line.setAttribute('stroke', color)
    const px = -uy * head * 0.45
    const py = ux * head * 0.45
    parts.head.setAttribute('points', [
      `${x2},${y2}`,
      `${x2 - ux * head + px},${y2 - uy * head + py}`,
      `${x2 - ux * head - px},${y2 - uy * head - py}`
    ].join(' '))
    parts.head.setAttribute('fill', color)
    parts.text.setAttribute('x', x2 + ux * 12)
    parts.text.setAttribute('y', y2 + uy * 12)
    parts.text.setAttribute('text-anchor', ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle')
    parts.text.setAttribute('fill', color)
    parts.text.textContent = esc(st.label)
    return
  }

  parts.text.setAttribute('x', st.x)
  parts.text.setAttribute('y', st.y)
  parts.text.setAttribute('fill', color)
  parts.text.textContent = esc(st.label)
}

export function createPlayer(root, tut) {
  const steps = tut.steps
  const n = steps.length
  const scene = tut.scene || { width: 640, height: 380, objects: [] }
  const W = scene.width || 640
  const H = scene.height || 380
  const objects = scene.objects || []

  // Resolve each step into a full snapshot of every object's props.
  const states = []
  let running = new Map(objects.map(o => [o.id, { ...o }]))
  for (const s of steps) {
    const next = new Map()
    for (const [id, props] of running) next.set(id, { ...props })
    for (const [id, props] of Object.entries(s.scene || {})) {
      next.set(id, { ...(next.get(id) || {}), ...props })
    }
    states.push(next)
    running = next
  }

  // ---- shell
  root.innerHTML = `
    <div class="tp-shell">
      <a class="tp-back" href="/">← Home</a>
      <header class="tp-head">
        <h1></h1>
        ${tut.subtitle ? '<p></p>' : ''}
      </header>
      <div class="tp-body">
        <div class="tp-stage-wrap"><svg class="tp-stage" viewBox="0 0 ${W} ${H}" role="img"></svg></div>
        <aside class="tp-panel" aria-live="polite">
          <div class="tp-count"></div>
          <p class="tp-text"></p>
          <div class="tp-eq"></div>
        </aside>
      </div>
      <div class="tp-controls">
        <button type="button" data-act="restart" title="Back to the start" aria-label="Back to the start">⏮</button>
        <button type="button" data-act="prev" title="Previous step" aria-label="Previous step">◀</button>
        <button type="button" class="primary" data-act="play" title="Play or pause" aria-label="Play or pause">▶</button>
        <button type="button" data-act="next" title="Next step" aria-label="Next step">▶|</button>
        <div class="tp-track">
          <input type="range" min="0" max="1000" value="0" step="1" aria-label="Timeline">
          <div class="tp-ticks"></div>
        </div>
        <div class="tp-status"></div>
      </div>
      <details class="tp-all">
        <summary>Show all steps as text</summary>
        <ol></ol>
      </details>
    </div>`

  root.querySelector('h1').textContent = tut.title
  if (tut.subtitle) root.querySelector('.tp-head p').textContent = tut.subtitle

  const svg = root.querySelector('.tp-stage')
  svg.setAttribute('aria-label', tut.title)
  const refs = new Map()
  for (const o of objects) {
    const r = buildObject(o)
    refs.set(o.id, r)
    svg.appendChild(r.g)
  }

  const countEl = root.querySelector('.tp-count')
  const textEl = root.querySelector('.tp-text')
  const eqEl = root.querySelector('.tp-eq')
  const range = root.querySelector('input[type="range"]')
  const statusEl = root.querySelector('.tp-status')
  const playBtn = root.querySelector('[data-act="play"]')
  const ticksEl = root.querySelector('.tp-ticks')

  for (let i = 0; i < n; i++) {
    const mark = document.createElement('span')
    mark.style.left = (n === 1 ? 0 : (i / (n - 1)) * 100) + '%'
    ticksEl.appendChild(mark)
  }

  const list = root.querySelector('.tp-all ol')
  steps.forEach(s => {
    const li = document.createElement('li')
    li.textContent = s.text || ''
    if (s.equation) {
      const eq = document.createElement('div')
      eq.className = 'tp-eq'
      renderEquation(eq, s.equation)
      li.appendChild(eq)
    }
    list.appendChild(li)
  })

  let shown = -1
  function paint(t) {
    const s = t * (n - 1)
    const i0 = Math.floor(s)
    const i1 = Math.min(i0 + 1, n - 1)
    const u = s - i0
    const A = states[i0]
    const B = states[i1]
    for (const o of objects) {
      const a = A.get(o.id) || {}
      const b = B.get(o.id) || {}
      const st = {}
      for (const k of NUMERIC) {
        const av = a[k]
        const bv = b[k]
        if (typeof av === 'number' && typeof bv === 'number') st[k] = av + (bv - av) * u
        else st[k] = (u < 0.5 ? av : bv)
      }
      const ao = a.hidden ? 0 : 1
      const bo = b.hidden ? 0 : 1
      st.opacity = ao + (bo - ao) * u
      st.label = u < 0.5 ? a.label : b.label
      st.color = u < 0.5 ? a.color : b.color
      drawObject(o, refs.get(o.id), st)
    }
    const idx = Math.round(s)
    if (idx !== shown) {
      shown = idx
      const step = steps[idx] || {}
      countEl.textContent = `Step ${idx + 1} / ${n}`
      textEl.textContent = step.text || ''
      renderEquation(eqEl, step.equation)
      statusEl.textContent = `${idx + 1} / ${n}`
    }
  }

  let t = 0
  let playing = false
  let raf = 0
  let last = 0
  const duration = Math.max(1, DUR_PER_STEP * (n - 1))

  function setT(v, sync = true) {
    t = Math.min(1, Math.max(0, v))
    range.value = String(Math.round(t * 1000))
    paint(t)
    if (sync) syncUrl()
  }

  function syncUrl() {
    const url = new URL(window.location.href)
    if (t > 0.001) url.searchParams.set('t', t.toFixed(3))
    else url.searchParams.delete('t')
    history.replaceState(null, '', url)
  }

  function play() {
    if (playing) return
    if (t >= 1) t = 0
    playing = true
    last = performance.now()
    playBtn.textContent = '❚❚'
    raf = requestAnimationFrame(tick)
  }

  function pause() {
    playing = false
    cancelAnimationFrame(raf)
    playBtn.textContent = '▶'
    syncUrl()
  }

  function tick(now) {
    if (!playing) return
    const dt = (now - last) / 1000
    last = now
    setT(t + dt / duration, false)
    if (t >= 1) { pause(); return }
    raf = requestAnimationFrame(tick)
  }

  function stepBy(delta) {
    const idx = Math.round(t * (n - 1)) + delta
    setT(Math.min(n - 1, Math.max(0, idx)) / (n - 1))
  }

  playBtn.addEventListener('click', () => (playing ? pause() : play()))
  root.querySelector('[data-act="restart"]').addEventListener('click', () => { pause(); setT(0) })
  root.querySelector('[data-act="prev"]').addEventListener('click', () => { pause(); stepBy(-1) })
  root.querySelector('[data-act="next"]').addEventListener('click', () => { pause(); stepBy(1) })

  range.addEventListener('input', () => { pause(); setT(Number(range.value) / 1000) })
  range.addEventListener('change', () => {
    if (n < 2) return
    const s = t * (n - 1)
    const nearest = Math.round(s)
    if (Math.abs(s - nearest) < 0.18) setT(nearest / (n - 1))
  })

  document.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); pause(); stepBy(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); stepBy(-1) }
    else if (e.key === 'Home') { e.preventDefault(); pause(); setT(0) }
    else if (e.key === 'End') { e.preventDefault(); pause(); setT(1) }
  })

  const fromUrl = parseFloat(new URLSearchParams(window.location.search).get('t'))
  setT(Number.isFinite(fromUrl) ? Math.min(1, Math.max(0, fromUrl)) : 0, false)

  return { setT, play, pause }
}
