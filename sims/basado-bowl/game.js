import { CONFIG, SPELL_BY_ID, CATEGORY_BY_ID } from './config.js';
import { QUESTIONS, questionAssetUrl } from './questions.js';
import { CHARACTERS, characterSVG } from './characters.js';
import { loadKatex } from './katex-loader.js';

await loadKatex();

const VERSION = 12;
const SAVE_KEY = 'basado-bowl:v12';
const params = new URLSearchParams(location.search);
const app = document.getElementById('app');

const fxLayer = (() => {
  let layer = document.getElementById('fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    document.body.appendChild(layer);
  }
  return layer;
})();

let state;
let undoStack = [];
let ui = { modal: null, pendingSpell: null, animating: false, fx: null };
let toastEl = null;
let toastTimer = null;
let audioCtx = null;
let lastSaveAt = 0;
let lastPhase = null;

const NOISE_HOLD_MS = 1200;
const noise = {
  stream: null,
  ctx: null,
  analyser: null,
  data: null,
  raf: null,
  lastTick: 0,
  level: 0,
  over: false,
  overSince: 0,
  gateOpen: true,
  quietSince: 0,
  enabled: false,
  micState: 'off',
  error: '',
  dragging: false,
};

const DEV = (() => {
  try {
    return params.get('dev') === '1' || localStorage.getItem('basado-bowl:dev') === '1';
  } catch {
    return params.get('dev') === '1';
  }
})();

const ICON_PATHS = {
  shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.4-7 8-4.1-.6-7-3.8-7-8V6l7-3z"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  fifty: '<circle cx="6" cy="7" r="2.4"/><circle cx="6" cy="17" r="2.4"/><path d="M8 8.4 20 19M8 15.6 20 5"/>',
  reroll: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v6h-6"/>',
  missile: '<path d="M14 3l7 7-8 8-4-4 5-11z"/><path d="M9 15l-4 4"/><path d="M15 9l1.5 1.5"/>',
  jinx: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  jammer: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
  heist: '<path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M6 8h12l-1 12H7L6 8z"/><path d="M12 12v4M10 14h4"/>',
  sci: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  ele: '<circle cx="12" cy="12" r="9"/><path d="M13 6l-5 7h3l-1 5 5-7h-3l1-5z"/>',
  wav: '<path d="M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/><path d="M2 17c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/>',
  mom: '<path d="M3 12h7M7 8l4 4-4 4"/><path d="M21 12h-7M17 8l-4 4 4 4"/>',
  kin: '<path d="M3 18l5-6 4 3 6-8"/><path d="M18 7h3v3"/>',
  for: '<path d="M4 12h14"/><path d="M14 7l5 5-5 5"/>',
  ene: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  undo: '<path d="M9 7H4v5"/><path d="M4 7l5 5a6 6 0 1 0 1.5-6"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  crown: '<path d="M4 8l4 4 4-7 4 7 4-4v9H4V8z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  slot: '<path d="M12 5v14M5 12h14"/>',
};

function svgIcon(name, cls = '') {
  const path = ICON_PATHS[name];
  if (!path) return '';
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function mathMarkup(value) {
  return esc(value)
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>');
}

function renderTex(tex, display = false) {
  if (!window.katex) return mathMarkup(tex);
  try {
    return window.katex.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      trust: false,
      strict: 'ignore',
    });
  } catch {
    return mathMarkup(tex);
  }
}

const FORMULA_TEX = [
  ['F_{f} = μF_{N}', 'F_{f} = \\mu F_{N}'],
  ['F_{G} = G m_{1}m_{2}/r^{2}', 'F_{G} = G m_{1}m_{2}/r^{2}'],
  ['F_{e} = k|q_{1}||q_{2}|/r^{2}', 'F_{e} = k|q_{1}||q_{2}|/r^{2}'],
  ['v^{2} = v_{0}^{2} + 2aΔx', 'v^{2} = v_{0}^{2} + 2a\\Delta x'],
  ['Δx = v_{0}t + 1/2 at^{2}', '\\Delta x = v_{0}t + \\frac{1}{2}at^{2}'],
  ['F_{1}d_{1} = F_{2}d_{2}', 'F_{1}d_{1} = F_{2}d_{2}'],
  ['K = 1/2 mv^{2}', 'K = \\frac{1}{2}mv^{2}'],
  ['1/2 mv^{2}', '\\frac{1}{2}mv^{2}'],
  ['1/2 mv²', '\\frac{1}{2}mv^{2}'],
  ['1/2 at^{2}', '\\frac{1}{2}at^{2}'],
  ['1/2 gt^{2}', '\\frac{1}{2}gt^{2}'],
  ['F_{g} = mg', 'F_{g} = mg'],
  ['F_{net} = ma', 'F_{net} = ma'],
  ['U_{g} = mgh', 'U_{g} = mgh'],
  ['U = mgh', 'U = mgh'],
  ['a = change in velocity / change in time', 'a = \\frac{\\Delta v}{\\Delta t}'],
  ['h = U_{g}/(mg)', 'h = U_{g}/(mg)'],
  ['h = U_{g}/m', 'h = U_{g}/m'],
  ['h = U_{g}mg', 'h = U_{g}mg'],
  ['h = mg/U_{g}', 'h = mg/U_{g}'],
  ['m = U_{g}/(gh)', 'm = U_{g}/(gh)'],
  ['m = U_{g}/g', 'm = U_{g}/g'],
  ['m = U_{g}gh', 'm = U_{g}gh'],
  ['m = gh/U_{g}', 'm = gh/U_{g}'],
  ['E = K + U', 'E = K + U'],
  ['E = K - U', 'E = K - U'],
  ['E = K × U', 'E = K \\times U'],
  ['E = U - K', 'E = U - K'],
  ['E = mc²', 'E = mc^{2}'],
  ['U = E + K', 'U = E + K'],
  ['U = E - K', 'U = E - K'],
  ['U = E / K', 'U = E / K'],
  ['U = K - E', 'U = K - E'],
  ['I = VR', 'I = VR'],
  ['R = VI', 'R = VI'],
  ['V = I/R', 'V = I/R'],
  ['a = F/m', 'a = F/m'],
  ['a = m/F', 'a = m/F'],
  ['a = v/t', 'a = v/t'],
  ['Δp = mv - mv_{0}', '\\Delta p = mv - mv_{0}'],
  ['J = Δp = FΔt', 'J = \\Delta p = F\\Delta t'],
  ['J = FΔt', 'J = F\\Delta t'],
  ['p_{before} = p_{after}', 'p_{before} = p_{after}'],
  ['p = mv', 'p = mv'],
  ['W = FΔx', 'W = F\\Delta x'],
  ['W = Fd', 'W = Fd'],
  ['W = mgh', 'W = mgh'],
  ['P = W/t', 'P = W/t'],
  ['I = V/R', 'I = V/R'],
  ['V = IR', 'V = IR'],
  ['f = 1/T', 'f = 1/T'],
  ['v = λf', 'v = \\lambda f'],
  ['τ = Fd', '\\tau = Fd'],
  ['q = ne', 'q = ne'],
  ['v = v_{0} + at', 'v = v_{0} + at'],
  ['v = Δx/t', 'v = \\Delta x/t'],
  ['a = (v - v_{0})/t', 'a = (v - v_{0})/t'],
  ['a = F_{net}/m', 'a = F_{net}/m'],
  ['Δx = x - x_{0}', '\\Delta x = x - x_{0}'],
  ['v = √(2gh)', 'v = \\sqrt{2gh}'],
  ['v = √(2aΔx)', 'v = \\sqrt{2a\\Delta x}'],
  ['v = √(2K/m)', 'v = \\sqrt{2K/m}'],
  ['W = F_{g}d = mgh', 'W = F_{g}d = mgh'],
  ['W = F_{g}Δx = mgh', 'W = F_{g}\\Delta x = mgh'],
].sort((a, b) => b[0].length - a[0].length);

const TOKEN_TEX = {
  'kg·m/s²': '\\mathrm{kg\\cdot m/s^{2}}',
  'kg·m/s': '\\mathrm{kg\\cdot m/s}',
  'N·s': '\\mathrm{N\\cdot s}',
  'm/s^{2}': '\\mathrm{m/s^{2}}',
  'm/s²': '\\mathrm{m/s^{2}}',
  'm/s': '\\mathrm{m/s}',
  'km/h': '\\mathrm{km/h}',
  'g/cm^{3}': '\\mathrm{g/cm^{3}}',
  'cm^{3}': '\\mathrm{cm^{3}}',
  'kg/m³': '\\mathrm{kg/m^{3}}',
  'N/m²': '\\mathrm{N/m^{2}}',
  'J/s': '\\mathrm{J/s}',
  'N·m': '\\mathrm{N\\cdot m}',
  '°C': '^\\circ\\mathrm{C}',
  'Δx': '\\Delta x',
  'Δv': '\\Delta v',
  'Δt': '\\Delta t',
  'Δp': '\\Delta p',
  'Δ': '\\Delta',
  'μ': '\\mu',
  'λ': '\\lambda',
  'τ': '\\tau',
  'Ω': '\\Omega',
  'θ': '\\theta',
  'π': '\\pi',
  '×': '\\times',
  '÷': '\\div',
  '≈': '\\approx',
  '≤': '\\le',
  '≥': '\\ge',
  '→': '\\to',
  '°': '^\\circ',
  '²': '^{2}',
  '³': '^{3}',
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TOKEN_RE = new RegExp(
  Object.keys(TOKEN_TEX)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|'),
  'g'
);

function toTex(text) {
  return String(text)
    .replace(/×/g, '\\times ')
    .replace(/Δx/g, '\\Delta x')
    .replace(/Δ/g, '\\Delta ')
    .replace(/μ/g, '\\mu ')
    .replace(/λ/g, '\\lambda ')
    .replace(/τ/g, '\\tau ')
    .replace(/Ω/g, '\\Omega ')
    .replace(/θ/g, '\\theta ')
    .replace(/√/g, '\\sqrt ')
    .replace(/²/g, '^{2}')
    .replace(/³/g, '^{3}');
}

const SENTINEL = '\u0001';

function autoMath(value) {
  const maths = [];
  const stash = (tex) => `${SENTINEL}${maths.push(tex) - 1}${SENTINEL}`;
  let out = String(value ?? '');

  for (const [needle, tex] of FORMULA_TEX) {
    out = out.split(needle).join(stash(tex));
  }

  out = out.replace(/√\(([^)]+)\)/g, (match, inner) =>
    stash(`\\sqrt{${toTex(inner)}}`)
  );
  out = out.replace(/10\^\{?([-+]?\d+)\}?/g, (match, exp) => stash(`10^{${exp}}`));
  out = out.replace(/([A-Za-zΔμλτΩθ])_\{([^{}]+)\}/g, (match, base, sub) =>
    stash(`${base}_{${sub}}`)
  );
  out = out.replace(TOKEN_RE, (match) => stash(TOKEN_TEX[match]));
  out = out.replace(/([A-Za-z0-9)])\^\{([^{}]+)\}/g, (match, base, exp) =>
    stash(`${base}^{${exp}}`)
  );
  out = out.replace(/([A-Za-z0-9)])([²³])/g, (match, base, sup) =>
    stash(`${base}^{${sup === '²' ? 2 : 3}}`)
  );

  out = esc(out)
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>');

  return out.replace(/\u0001(\d+)\u0001/g, (match, index) =>
    renderTex(maths[Number(index)])
  );
}

const EXPLICIT_MATH = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\))/g;

function richText(value) {
  const text = String(value ?? '');
  if (!window.katex) return mathMarkup(text);

  let out = '';
  let last = 0;
  let match;
  EXPLICIT_MATH.lastIndex = 0;

  while ((match = EXPLICIT_MATH.exec(text))) {
    out += autoMath(text.slice(last, match.index));
    const token = match[0];
    const display = token.startsWith('$$');
    const tex = display
      ? token.slice(2, -2)
      : token.startsWith('\\(')
      ? token.slice(2, -2)
      : token.slice(1, -1);
    out += renderTex(tex, display);
    last = EXPLICIT_MATH.lastIndex;
  }

  out += autoMath(text.slice(last));
  return out;
}

function questionFigure(q) {
  if (!q.image) return '';
  const src = questionAssetUrl(q.image);
  return `<figure class="question-figure">
    <img src="${esc(src)}" alt="${esc(q.imageAlt || 'Question diagram')}" decoding="async" />
  </figure>`;
}

/* ------------------------------------------------------------------ */
/* Noise gate                                                          */
/* ------------------------------------------------------------------ */

function noiseSupported() {
  return Boolean(
    navigator.mediaDevices?.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext) &&
      (window.isSecureContext || location.hostname === 'localhost')
  );
}

function noiseThreshold() {
  return Math.max(0, Math.min(100, Number(state?.settings?.noiseThreshold ?? 55)));
}

function noiseActive() {
  return Boolean(noise.enabled && noise.micState === 'ready');
}

function noiseBlocking() {
  return noiseActive() && (!noise.gateOpen || noise.over);
}

function noiseStatusText() {
  if (noise.micState === 'denied') return 'MIC BLOCKED';
  if (noise.micState === 'unavailable') return 'NO MIC';
  if (!noise.enabled) return 'OFF';
  if (noise.micState === 'requesting') return 'MIC…';
  if (noise.micState === 'ready') {
    if (noise.over) return 'TOO LOUD';
    return noise.gateOpen ? 'QUIET' : 'SETTLING';
  }
  return 'MIC OFF';
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function matchElapsedMs(now = Date.now()) {
  if (!state.matchActive) return state.matchElapsedMs || 0;
  const base = state.matchElapsedMs || 0;
  return base + (state.matchTickAt ? Math.max(0, now - state.matchTickAt) : 0);
}

function accrueMatchTime(now = Date.now()) {
  if (!state.matchActive || state.matchEndedAt || !state.matchTickAt) return;
  state.matchElapsedMs = (state.matchElapsedMs || 0) + Math.max(0, now - state.matchTickAt);
  state.matchTickAt = now;
}

function loudElapsedMs(now = performance.now()) {
  const base = state.loudMs || 0;
  if (!state.matchActive || state.matchEndedAt || state.phase === 'setup') return base;
  return noise.over && noise.overSince ? base + Math.max(0, now - noise.overSince) : base;
}

function flushLoudTime(now = performance.now()) {
  if (!state.matchActive || state.matchEndedAt || state.phase === 'setup') {
    noise.overSince = 0;
    return;
  }
  if (noise.over && noise.overSince) {
    state.loudMs = (state.loudMs || 0) + Math.max(0, now - noise.overSince);
  }
  noise.overSince = noise.over ? now : 0;
}

function finalizeMatchIfNeeded() {
  if (state.phase !== 'gameover' || !state.matchActive) return;
  const max = Math.max(...state.teams.map((t) => t.score));
  const leaders = state.teams.filter((t) => t.score === max);
  if (leaders.length !== 1) return;
  accrueMatchTime();
  flushLoudTime();
  noise.overSince = 0;
  state.matchActive = false;
  state.matchTickAt = null;
  state.matchEndedAt = Date.now();
}

function updateClocks() {
  const match = formatClock(matchElapsedMs());
  const loud = state.noiseUsed ? formatClock(loudElapsedMs()) : '--';
  document.querySelectorAll('[data-match-clock]').forEach((el) => {
    el.textContent = match;
  });
  document.querySelectorAll('[data-loud-clock]').forEach((el) => {
    el.textContent = loud;
  });
  document.querySelectorAll('[data-final-match-clock]').forEach((el) => {
    el.textContent = match;
  });
  document.querySelectorAll('[data-final-loud-clock]').forEach((el) => {
    el.textContent = state.noiseUsed ? formatClock(loudElapsedMs()) : 'MIC OFF';
  });
}

function updateNoiseDOM() {
  const threshold = noiseThreshold();
  const level = Math.max(0, Math.min(100, Math.round(noise.level)));
  const over = noise.over || noise.level >= threshold;
  document.querySelectorAll('[data-noise-fill]').forEach((el) => {
    el.style.width = `${level}%`;
    el.classList.toggle('over', over);
  });
  document.querySelectorAll('[data-noise-marker]').forEach((el) => {
    el.style.left = `${threshold}%`;
  });
  document.querySelectorAll('[data-noise-readout]').forEach((el) => {
    el.textContent = noise.micState === 'ready' ? String(level) : '--';
  });
  document.querySelectorAll('[data-noise-status]').forEach((el) => {
    el.textContent = noiseStatusText();
  });
  document.querySelectorAll('[data-noise-threshold-readout]').forEach((el) => {
    el.textContent = String(threshold);
  });
  document.querySelectorAll('[data-noise-threshold-control]').forEach((el) => {
    el.setAttribute('aria-valuenow', String(threshold));
  });
  document.querySelectorAll('[data-noise-pill]').forEach((el) => {
    el.classList.toggle('over', over);
    el.classList.toggle('live', noise.micState === 'ready');
    el.classList.toggle('off', !noise.enabled);
  });
  document.querySelectorAll('[data-noise-toggle]').forEach((el) => {
    el.classList.toggle('on', noiseActive());
    el.classList.toggle('off', !noise.enabled);
    el.setAttribute('aria-pressed', String(noise.enabled));
    el.disabled = noise.micState === 'requesting';
    el.title = noise.enabled ? 'Turn noise gate off' : 'Turn noise gate on';
  });

  const blocked = noiseBlocking();
  const gated = [
    ['next-turn-btn', 'NEXT TEAM →'],
    ['draw-question-btn', 'DRAW A QUESTION →'],
  ];
  for (const [id, label] of gated) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = blocked;
    button.textContent = blocked ? 'WAIT FOR QUIET' : label;
  }
  document.querySelectorAll('[data-noise-gate-hint]').forEach((el) => {
    el.hidden = !blocked;
    el.textContent = blocked
      ? `NOISE ${level} · THRESHOLD ${threshold} — WAIT FOR QUIET`
      : '';
  });
}

function stopNoise(micState = 'off') {
  flushLoudTime();
  if (noise.raf) cancelAnimationFrame(noise.raf);
  noise.raf = null;
  if (noise.stream) {
    noise.stream.getTracks().forEach((track) => track.stop());
  }
  noise.stream = null;
  if (noise.ctx) {
    noise.ctx.close().catch(() => {});
  }
  noise.ctx = null;
  noise.analyser = null;
  noise.data = null;
  noise.enabled = false;
  noise.micState = micState;
  noise.level = 0;
  noise.over = false;
  noise.overSince = 0;
  noise.gateOpen = true;
  noise.quietSince = 0;
  if (micState === 'off') noise.error = '';
  updateNoiseDOM();
}

async function enableNoise() {
  if (noise.micState === 'ready' || noise.micState === 'requesting') return;
  if (!noiseSupported()) {
    noise.enabled = false;
    noise.micState = 'unavailable';
    noise.error = 'This browser cannot access a microphone on this page.';
    toast(noise.error);
    updateNoiseDOM();
    return;
  }
  noise.enabled = true;
  noise.micState = 'requesting';
  noise.error = '';
  updateNoiseDOM();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    noise.stream = stream;
    noise.ctx = ctx;
    noise.analyser = analyser;
    noise.data = new Float32Array(analyser.fftSize);
    noise.enabled = true;
    noise.micState = 'ready';
    noise.level = 0;
    noise.over = false;
    noise.gateOpen = false;
    noise.quietSince = performance.now();
    state.noiseUsed = true;
    startNoiseLoop();
  } catch (err) {
    const state =
      err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
        ? 'denied'
        : 'unavailable';
    noise.error =
      state === 'denied'
        ? 'Microphone permission was denied. The gate is inactive.'
        : 'No microphone was found. The gate is inactive.';
    stopNoise(state);
    toast(noise.error);
  }
  updateNoiseDOM();
}

async function toggleNoise() {
  if (noise.enabled || noise.micState === 'ready' || noise.micState === 'requesting') {
    stopNoise();
    save();
    return;
  }
  await enableNoise();
  save();
}

function startNoiseLoop() {
  if (noise.raf) cancelAnimationFrame(noise.raf);
  noise.lastTick = 0;
  noise.raf = requestAnimationFrame(noiseLoop);
}

function noiseLoop(ts) {
  if (noise.micState !== 'ready' || !noise.analyser || !noise.data) return;
  noise.raf = requestAnimationFrame(noiseLoop);
  if (ts - noise.lastTick < 50) return;
  noise.lastTick = ts;
  noise.analyser.getFloatTimeDomainData(noise.data);
  let sum = 0;
  for (const value of noise.data) sum += value * value;
  const rms = Math.sqrt(sum / noise.data.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-8));
  const raw = Math.max(0, Math.min(100, ((db + 70) / 70) * 100));
  noise.level = noise.level * 0.72 + raw * 0.28;

  const threshold = noiseThreshold();
  if (!noise.over && noise.level >= threshold + 2) {
    noise.over = true;
    noise.overSince =
      state.matchActive && !state.matchEndedAt && state.phase !== 'setup' ? ts : 0;
    noise.quietSince = 0;
  } else if (noise.over && noise.level <= threshold - 2) {
    if (noise.overSince) {
      state.loudMs = (state.loudMs || 0) + Math.max(0, ts - noise.overSince);
    }
    noise.over = false;
    noise.overSince = 0;
    noise.quietSince = ts;
  }
  if (noise.over) {
    noise.gateOpen = false;
    noise.quietSince = 0;
  } else {
    if (!noise.quietSince) noise.quietSince = ts;
    noise.gateOpen = ts - noise.quietSince >= NOISE_HOLD_MS;
  }
  updateNoiseDOM();
}

function teamMeta(id) {
  return CONFIG.teams.find((t) => t.id === id) || CONFIG.teams[0];
}

function teamStyle(meta) {
  return `--team:${meta.color};--team-soft:${meta.soft};--team-ink:${meta.ink}`;
}

function isSuddenDeath() {
  return Array.isArray(state.contenders) && state.contenders.length > 0;
}

function activeTeams() {
  if (!isSuddenDeath()) return state.teams;
  return state.teams.filter((t) => state.contenders.includes(t.id));
}

function currentTeam() {
  return activeTeams()[state.turn] || state.teams[0];
}

function removeSpell(team, id) {
  const i = team.spells.indexOf(id);
  if (i >= 0) team.spells.splice(i, 1);
}

function isFast() {
  return params.get('fast') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function toast(message, kind = '') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = '';
  }, 2400);
}

const SEED_COUNTER_KEY = 'basado-bowl:seedCounter';

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeMatchSeed() {
  let counter = 0;
  try {
    counter = (Number(localStorage.getItem(SEED_COUNTER_KEY)) || 0) + 1;
    localStorage.setItem(SEED_COUNTER_KEY, String(counter));
  } catch {
    counter = 0;
  }
  let random = 0;
  try {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    random = values[0];
  } catch {
    random = Math.floor(Math.random() * 0xffffffff);
  }
  return hashSeed(`${Date.now()}:${counter}:${random}`) || 1;
}

function nextRandom() {
  const current = Number.isFinite(state.rngState) ? state.rngState : state.seed || 1;
  state.rngState = (current + 0x6d2b79f5) >>> 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function spellOrb(spell, cls = '') {
  return `<span class="spell-orb ${cls}" style="--spell:${spell.color}">${svgIcon(spell.icon)}</span>`;
}

/* ------------------------------------------------------------------ */
/* State, save, undo                                                   */
/* ------------------------------------------------------------------ */

function defaultState() {
  return {
    version: VERSION,
    phase: 'setup',
    settings: {
      grade: '6',
      units: ['SCI', 'KIN', 'FOR', 'ENE', 'ELE'],
      rounds: CONFIG.defaultRounds,
      timer: true,
      sound: true,
      noiseThreshold: 55,
    },
    teams: CONFIG.teams.map((t) => ({
      id: t.id,
      name: t.name,
      character: t.character,
      score: 0,
      spells: [],
      learned: [],
      buffs: {},
      effects: [],
      correct: 0,
      total: 0,
      jinxTurns: 0,
    })),
    turn: 0,
    round: 1,
    roundLimit: CONFIG.defaultRounds,
    used: [],
    current: null,
    draft: {},
    contenders: null,
    seed: null,
    rngState: 0,
    lastQuestionId: null,
    matchActive: false,
    matchElapsedMs: 0,
    matchTickAt: null,
    matchEndedAt: null,
    loudMs: 0,
    noiseUsed: false,
  };
}

function save() {
  if (state && state.matchActive && !state.matchEndedAt) {
    accrueMatchTime();
    if (noise.over) flushLoudTime();
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

function load() {
  if (params.get('fresh') === '1') {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== VERSION || !Array.isArray(s.teams) || s.teams.length !== 3) {
      return null;
    }
    s.settings = { ...defaultState().settings, ...s.settings };
    s.teams.forEach((t) => {
      t.spells = Array.isArray(t.spells)
        ? Array.from(new Set(t.spells)).slice(0, CONFIG.maxSpells)
        : [];
      t.learned = Array.from(
        new Set([
          ...(Array.isArray(t.learned) ? t.learned : []),
          ...t.spells,
        ])
      ).slice(0, CONFIG.maxSpells);
      t.buffs = t.buffs || {};
      t.effects = Array.isArray(t.effects) ? t.effects : [];
      t.correct = t.correct || 0;
      t.total = t.total || 0;
      t.jinxTurns = Number.isFinite(t.jinxTurns) ? Math.max(0, Math.floor(t.jinxTurns)) : 0;
      t.character = t.character || teamMeta(t.id).character;
    });
    s.used = Array.isArray(s.used) ? s.used : [];
    s.draft = s.draft && typeof s.draft === 'object' ? s.draft : {};
    s.contenders = Array.isArray(s.contenders) && s.contenders.length ? s.contenders : null;
    s.seed = Number.isFinite(s.seed) ? s.seed >>> 0 : makeMatchSeed();
    s.rngState = Number.isFinite(s.rngState) ? s.rngState >>> 0 : s.seed;
    s.lastQuestionId = typeof s.lastQuestionId === 'string' ? s.lastQuestionId : null;
    s.matchActive = Boolean(s.matchActive);
    s.matchElapsedMs = Number.isFinite(s.matchElapsedMs) ? Math.max(0, s.matchElapsedMs) : 0;
    s.matchTickAt = null;
    s.matchEndedAt = Number.isFinite(s.matchEndedAt) ? s.matchEndedAt : null;
    s.loudMs = Number.isFinite(s.loudMs) ? Math.max(0, s.loudMs) : 0;
    s.noiseUsed = Boolean(s.noiseUsed);
    if (!s.roundLimit) s.roundLimit = s.settings.rounds;
    return s;
  } catch {
    return null;
  }
}

function pushUndo() {
  if (state.phase === 'setup') return;
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 40) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  state = JSON.parse(undoStack.pop());
  ui = { modal: null, pendingSpell: null, animating: false, fx: null };
  if (state.phase === 'question' && state.current && state.current.timer) {
    if (state.current.timer.remaining <= 0) state.current.timer.remaining = 10;
    state.current.timer.running = false;
    state.current.timer.last = Date.now();
  }
  save();
  render();
}

/* ------------------------------------------------------------------ */
/* Match lifecycle                                                     */
/* ------------------------------------------------------------------ */

function gradeOk(q) {
  return q.grade === 'both' || q.grade === state.settings.grade;
}

function hasAnyQuestions() {
  return QUESTIONS.some((q) => gradeOk(q) && state.settings.units.includes(q.unit));
}

function resetTeams() {
  state.teams.forEach((t) => {
    t.score = 0;
    t.spells = [];
    t.learned = [];
    t.buffs = {};
    t.effects = [];
    t.correct = 0;
    t.total = 0;
    t.jinxTurns = 0;
  });
}

function startMatch() {
  if (!hasAnyQuestions()) {
    toast('Pick a grade and at least one unit with questions.');
    return;
  }
  state.teams.forEach((t, i) => {
    t.name = String(t.name || '').trim() || CONFIG.teams[i].name;
  });
  resetTeams();
  state.seed = makeMatchSeed();
  state.rngState = state.seed;
  state.lastQuestionId = null;
  state.matchActive = true;
  state.matchElapsedMs = 0;
  state.matchTickAt = Date.now();
  state.matchEndedAt = null;
  state.loudMs = 0;
  state.noiseUsed = noise.micState === 'ready';
  noise.overSince = noise.over ? performance.now() : 0;
  state.turn = 0;
  state.round = 1;
  state.roundLimit = state.settings.rounds;
  state.used = [];
  state.current = null;
  state.draft = {};
  state.contenders = null;
  state.phase = 'draft';
  undoStack = [];
  ui = { modal: null, pendingSpell: null, animating: false, fx: null };
  save();
  render();
  sfx('start');
}

function playAgain() {
  startMatch();
}

function newSetup() {
  state.phase = 'setup';
  state.current = null;
  state.used = [];
  state.draft = {};
  state.contenders = null;
  state.matchActive = false;
  state.matchElapsedMs = 0;
  state.matchTickAt = null;
  state.matchEndedAt = null;
  state.loudMs = 0;
  state.noiseUsed = false;
  noise.overSince = 0;
  undoStack = [];
  ui = { modal: null, pendingSpell: null, animating: false, fx: null };
  save();
  render();
}

function suddenDeath() {
  const max = Math.max(...state.teams.map((t) => t.score));
  const tied = state.teams.filter((t) => t.score === max);
  if (tied.length < 2) return;
  pushUndo();
  accrueMatchTime();
  flushLoudTime();
  state.contenders = tied.map((t) => t.id);
  state.teams.forEach((t) => {
    t.buffs = {};
    t.jinxTurns = 0;
  });
  state.matchActive = true;
  state.matchEndedAt = null;
  state.matchTickAt = Date.now();
  noise.overSince = noise.over ? performance.now() : 0;
  state.roundLimit = Math.max(state.roundLimit, state.round);
  state.round = state.roundLimit;
  state.turn = 0;
  state.current = null;
  state.draft = {};
  state.phase = 'prep';
  ui = { modal: null, pendingSpell: null, animating: false, fx: null };
  save();
  render();
  sfx('start');
}

/* ------------------------------------------------------------------ */
/* Question pool and drawing                                           */
/* ------------------------------------------------------------------ */

function unitCount(unit, level = null) {
  return QUESTIONS.filter(
    (q) =>
      q.unit === unit &&
      gradeOk(q) &&
      !state.used.includes(q.id) &&
      (level === null || q.level === level)
  ).length;
}

function drawRandomQuestion() {
  if (noiseBlocking()) {
    toast('Too loud — wait for quiet.');
    return;
  }
  const selected = QUESTIONS.filter(
    (q) => gradeOk(q) && state.settings.units.includes(q.unit)
  );
  if (!selected.length) {
    toast('Choose at least one unit with questions.');
    return;
  }

  const sudden = isSuddenDeath();
  const bank = sudden ? selected.filter((q) => q.level === 3) : selected;
  if (!bank.length) {
    toast('No hard questions are available for the selected units.');
    return;
  }

  pushUndo();
  let pool = bank.filter((q) => !state.used.includes(q.id));
  if (!pool.length) {
    state.used = state.used.filter((id) => !bank.some((q) => q.id === id));
    pool = bank.slice();
    toast(sudden ? 'Sudden-death hard questions reshuffled.' : 'Question bank reshuffled.');
  }

  if (pool.length > 1 && state.lastQuestionId) {
    const withoutLast = pool.filter((q) => q.id !== state.lastQuestionId);
    if (withoutLast.length) pool = withoutLast;
  }
  const q = pool[Math.floor(nextRandom() * pool.length)];
  state.lastQuestionId = q.id;
  state.used.push(q.id);

  const team = currentTeam();
  const jinxed = !sudden && (team.jinxTurns || 0) > 0;
  const points = CONFIG.questionPoints;
  const seconds = sudden
    ? CONFIG.suddenDeathSeconds
    : CONFIG.questionSeconds - (jinxed ? CONFIG.jinxPenaltySeconds : 0);

  state.current = {
    q,
    unit: q.unit,
    level: q.level,
    suddenDeath: sudden,
    jinxed,
    points,
    removed: [],
    chosen: null,
    earned: null,
    timer: {
      total: seconds,
      remaining: seconds,
      running: state.settings.timer,
      last: Date.now(),
    },
  };
  state.phase = 'question';
  ui.fx = null;
  save();
  render();
  sfx('draw');
}

/* ------------------------------------------------------------------ */
/* Answers and turns                                                   */
/* ------------------------------------------------------------------ */

function answer(index) {
  if (state.phase !== 'question' || !state.current) return;
  const cur = state.current;
  const team = currentTeam();

  pushUndo();
  cur.chosen = index;
  cur.timer.running = false;
  team.total += 1;

  const correct = index !== null && index === cur.q.correct;
  let points = 0;

  if (correct) {
    points = cur.points;
    if (team.buffs.double && !isSuddenDeath()) points *= 2;
    team.score += points;
    team.correct += 1;
  }
  if (team.buffs.double) delete team.buffs.double;
  if (cur.jinxed) team.jinxTurns = Math.max(0, (team.jinxTurns || 1) - 1);

  cur.earned = { points, correct };
  state.phase = 'reveal';
  ui.fx = { kind: 'answer', teamId: team.id, correct, points };
  save();
  render();
  playAnswerFX(team.id, correct, points);
}

function nextTurn() {
  if (state.phase !== 'reveal') return;
  if (noiseBlocking()) {
    toast('Too loud — wait for quiet.');
    return;
  }
  pushUndo();

  state.current = null;
  state.turn += 1;
  let roundAdvanced = false;
  if (state.turn >= activeTeams().length) {
    state.turn = 0;
    state.round += 1;
    roundAdvanced = true;
  }

  if (state.round > state.roundLimit) {
    state.phase = 'gameover';
    sfx('fanfare');
  } else if (
    roundAdvanced &&
    state.round > 1 &&
    (state.round - 1) % CONFIG.draftInterval === 0
  ) {
    state.phase = 'draft';
    state.draft = {};
    state.turn = 0;
    sfx('turn');
  } else {
    state.phase = 'prep';
    sfx('turn');
  }
  ui.fx = null;
  ui.animating = false;
  save();
  render();
}

/* ------------------------------------------------------------------ */
/* Item draft                                                          */
/* ------------------------------------------------------------------ */

function draftReady() {
  return state.teams.every((t) => Boolean(state.draft[t.id]));
}

function nextDraftRound() {
  const next = Math.ceil(state.round / CONFIG.draftInterval) * CONFIG.draftInterval + 1;
  return next <= state.roundLimit ? next : null;
}

function startRound() {
  if (state.phase !== 'draft' || !draftReady()) return;
  pushUndo();
  state.teams.forEach((t) => {
    const spellId = state.draft[t.id];
    if (!spellId) return;
    t.spells = [spellId];
    t.learned = [spellId];
  });
  state.draft = {};
  state.turn = 0;
  state.phase = 'prep';
  save();
  render();
  sfx('turn');
}

function draftPick(teamId, spellId) {
  if (state.phase !== 'draft') return;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  state.draft[teamId] = spellId;
  save();
  render();
  sfx('click');
}

function seedSpells() {
  if (state.teams.some((t) => t.learned.length)) return;
  const starters = ['shield', 'double', 'missile'];
  state.teams.forEach((t, i) => {
    t.learned = [starters[i % starters.length]];
    t.spells = [starters[i % starters.length]];
  });
  state.draft = {};
  state.phase = 'prep';
  state.turn = 0;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

function spellStatus(team, spellId) {
  if (isSuddenDeath()) return { ok: false, label: 'SUDDEN DEATH' };
  if (state.phase !== 'prep' && state.phase !== 'question') {
    return { ok: false, label: 'NOT NOW' };
  }
  if (spellId === 'jinx' && !state.settings.timer) {
    return { ok: false, label: 'TIMER OFF' };
  }
  if (spellId === 'shield') return { ok: false, label: 'PASSIVE' };
  if (spellId === 'double' && team.buffs.double) return { ok: false, label: 'ARMED' };
  if ((spellId === 'missile' || spellId === 'jinx') && state.phase !== 'prep') {
    return { ok: false, label: 'PREP ONLY' };
  }
  if (!team.spells.includes(spellId)) return { ok: false, label: 'USED' };
  return { ok: true, label: 'USE' };
}

function useSpell(spellId) {
  if (ui.animating) return;
  const team = currentTeam();
  if (!team.spells.includes(spellId)) return;
  const status = spellStatus(team, spellId);
  if (!status.ok) {
    toast(status.label);
    return;
  }

  if (spellId === 'missile' || spellId === 'jinx') {
    ui.pendingSpell = spellId;
    ui.modal = 'target';
    render();
    return;
  }

  const spell = SPELL_BY_ID[spellId];
  if (!spell) return;

  if (spellId === 'double') {
    pushUndo();
    removeSpell(team, 'double');
    team.buffs.double = true;
    ui.fx = null;
    save();
    render();
    playSelfFX(team.id, spellId, 'x2');
    sfx('cast');
  }
}

/* ------------------------------------------------------------------ */
/* Casting and effects                                                 */
/* ------------------------------------------------------------------ */

function platformEl(teamId) {
  return document.querySelector(`.platform[data-team="${teamId}"]`);
}

function ringCenter(teamId) {
  const el = document.querySelector(`.spell-ring[data-team="${teamId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function charCenter(teamId) {
  const el = document.querySelector(`.platform[data-team="${teamId}"] .char-sprite`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function playSelfFX(teamId, spellId, label) {
  const spell = SPELL_BY_ID[spellId];
  const ring = ringCenter(teamId);
  const body = charCenter(teamId) || ring;
  if (!body) return;
  const origin = ring || body;
  const orb = document.createElement('div');
  orb.className = 'fx-projectile self';
  orb.style.setProperty('--spell', spell.color);
  orb.innerHTML = svgIcon(spell.icon);
  orb.style.left = `${origin.x}px`;
  orb.style.top = `${origin.y}px`;
  fxLayer.appendChild(orb);
  pixelBurst(origin.x, origin.y, spell.color, 12);
  floatText(label, body.x, body.y - 12, spell.color, 'big');
  orb.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 1 },
      { transform: 'translate(-50%,-90%) scale(1.4)', opacity: 0 },
    ],
    { duration: 650, easing: 'ease-out' }
  ).onfinish = () => orb.remove();
}

function castSpell(spellId, targetId) {
  const actor = currentTeam();
  const target = state.teams.find((t) => t.id === targetId);
  const spell = SPELL_BY_ID[spellId];
  if (!actor || !target || !spell || actor.id === target.id || isSuddenDeath()) return;
  if (!actor.spells.includes(spellId) || state.phase !== 'prep' || ui.animating) return;

  pushUndo();
  const blocked = target.spells.includes('shield');
  const damage = blocked || spellId !== 'missile' ? 0 : Math.min(100, target.score);
  ui.modal = null;
  ui.pendingSpell = null;
  ui.animating = true;
  ui.fx = null;
  render();

  playCast(actor.id, target.id, spellId, blocked, damage).then(() => {
    removeSpell(actor, spellId);
    if (blocked) {
      removeSpell(target, 'shield');
      toast(`${target.name}'s Shield blocked ${spell.name}!`, 'bad');
    } else if (spellId === 'jinx') {
      target.jinxTurns = CONFIG.jinxTurns;
      toast(`${target.name} loses ${CONFIG.jinxPenaltySeconds} s for ${CONFIG.jinxTurns} turns.`, 'bad');
    } else {
      target.score = Math.max(0, target.score - 100);
      toast(
        damage > 0
          ? `${spell.name} hits ${target.name} for ${damage} points!`
          : `${spell.name} hits ${target.name}, but they have 0 points.`,
        'bad'
      );
    }
    ui.animating = false;
    save();
    render();
  });
}

function playCast(actorId, targetId, spellId, blocked, damage = 0) {
  return new Promise((resolve) => {
    const item = SPELL_BY_ID[spellId];
    const ring = ringCenter(actorId);
    const actorBody = charCenter(actorId);
    const start = ring ? { x: ring.x, y: ring.y + 30 } : actorBody;
    const end = charCenter(targetId);
    const actorEl = platformEl(actorId);
    const targetEl = platformEl(targetId);

    actorEl?.classList.add('casting');
    targetEl?.classList.add('targeted');

    const proj = document.createElement('div');
    proj.className = 'fx-projectile';
    proj.style.setProperty('--spell', item.color);
    proj.innerHTML = svgIcon(item.icon);
    proj.style.left = '0px';
    proj.style.top = '0px';
    fxLayer.appendChild(proj);

    const skip = document.createElement('div');
    skip.className = 'fx-skip';
    skip.innerHTML = '<span>TAP TO SKIP</span>';
    fxLayer.appendChild(skip);

    let done = false;
    let timer = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      skip.remove();
      proj.remove();
      actorEl?.classList.remove('casting');
      targetEl?.classList.remove('targeted');
      resolve();
    };

    const impact = () => {
      if (!end) return;
      pixelBurst(end.x, end.y, item.color, blocked ? 8 : 18);
      if (blocked) shieldBurst(end.x, end.y);
      floatText(
        blocked
          ? 'BLOCKED!'
          : spellId === 'jinx'
          ? 'JINXED!'
          : damage > 0
          ? `-${damage}`
          : 'NO DAMAGE',
        end.x,
        end.y - 48,
        blocked ? '#41e0ff' : spellId === 'jinx' ? item.color : damage > 0 ? '#ff3b5c' : item.color,
        'big'
      );
      targetEl?.classList.add('hit');
      setTimeout(() => targetEl?.classList.remove('hit'), 420);
      sfx(blocked ? 'block' : 'impact');
    };

    const fast = isFast();

    skip.addEventListener('click', () => {
      impact();
      finish();
    });

    if (fast || !start || !end) {
      proj.remove();
      impact();
      setTimeout(finish, 120);
      return;
    }

    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 24;

    const castRing = document.createElement('div');
    castRing.className = 'fx-cast-ring';
    castRing.style.left = `${ring ? ring.x : start.x}px`;
    castRing.style.top = `${ring ? ring.y : start.y}px`;
    castRing.style.setProperty('--spell', item.color);
    fxLayer.appendChild(castRing);
    castRing.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.4 },
        { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 },
      ],
      { duration: 650, easing: 'ease-out' }
    ).onfinish = () => castRing.remove();

    proj.animate(
      [
        {
          transform: `translate(${start.x}px, ${start.y}px) translate(-50%,-50%) scale(.4) rotate(0deg)`,
          opacity: 0.2,
        },
        {
          transform: `translate(${midX}px, ${midY}px) translate(-50%,-50%) scale(1.15) rotate(180deg)`,
          opacity: 1,
          offset: 0.56,
        },
        {
          transform: `translate(${end.x}px, ${end.y}px) translate(-50%,-50%) scale(.8) rotate(360deg)`,
          opacity: 1,
        },
      ],
      { duration: 820, easing: 'ease-in-out', fill: 'forwards' }
    );

    sfx('cast');
    timer = setTimeout(() => {
      impact();
      setTimeout(finish, 220);
    }, 840);
  });
}

function pixelBurst(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-pixel';
    p.style.background = i % 3 === 0 ? '#fffdf4' : color;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    const dx = (Math.random() - 0.5) * 160;
    const dy = (Math.random() - 0.5) * 140;
    fxLayer.appendChild(p);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0) rotate(${Math.random() * 360}deg)`,
          opacity: 0,
        },
      ],
      { duration: 420 + Math.random() * 320, easing: 'cubic-bezier(.2,.7,.3,1)' }
    ).onfinish = () => p.remove();
  }
}

function confettiAt(x, y, colors, count = 26) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-pixel confetti';
    p.style.background = colors[i % colors.length];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    const dx = (Math.random() - 0.5) * 280;
    const dy = -80 - Math.random() * 180;
    fxLayer.appendChild(p);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${
            Math.random() * 720 - 360
          }deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx * 1.25}px, ${dy + 260}px) scale(.6) rotate(${
            Math.random() * 720
          }deg)`,
          opacity: 0,
        },
      ],
      { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.15,.65,.3,1)' }
    ).onfinish = () => p.remove();
  }
}

function floatText(text, x, y, color, cls = '') {
  const el = document.createElement('div');
  el.className = `fx-float ${cls}`;
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxLayer.appendChild(el);
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-80%) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 },
    ],
    { duration: 950, easing: 'ease-out' }
  ).onfinish = () => el.remove();
}

function shieldBurst(x, y) {
  const el = document.createElement('div');
  el.className = 'fx-shield';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxLayer.appendChild(el);
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0.9, offset: 0.5 },
      { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 0 },
    ],
    { duration: 600, easing: 'ease-out' }
  ).onfinish = () => el.remove();
}

function playAnswerFX(teamId, correct, points) {
  const p = charCenter(teamId);
  if (!p) return;
  if (correct) {
    confettiAt(p.x, p.y - 30, ['#ffd23f', '#3ddc84', '#41e0ff', '#ff7ab8', '#fffdf4'], 32);
    floatText(`+${points}`, p.x, p.y - 18, '#ffd23f', 'big');
    const el = document.querySelector(`[data-score="${teamId}"]`);
    const team = state.teams.find((t) => t.id === teamId);
    if (el && team) countUp(el, Math.max(0, team.score - points), team.score);
    sfx('correct');
  } else {
    floatText('MISS', p.x, p.y - 18, '#ff3b5c', 'big');
    sfx('wrong');
  }
}

function countUp(el, from, to) {
  const start = performance.now();
  const dur = 520;
  el.textContent = String(from);
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = String(Math.round(from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function arenaConfetti() {
  const p = ringCenter(state.teams[0]?.id) || { x: window.innerWidth / 2, y: 120 };
  confettiAt(window.innerWidth * 0.25, 100, ['#ffd23f', '#3ddc84', '#41e0ff', '#ff7ab8'], 28);
  confettiAt(window.innerWidth * 0.75, 100, ['#ffd23f', '#ff3b5c', '#1e6bff', '#fffdf4'], 28);
  const winner = [...state.teams].sort((a, b) => b.score - a.score)[0];
  const wp = charCenter(winner?.id);
  if (wp) confettiAt(wp.x, wp.y - 40, ['#ffd23f', '#fffdf4', '#3ddc84'], 34);
  void p;
}

/* ------------------------------------------------------------------ */
/* Timer                                                               */
/* ------------------------------------------------------------------ */

function toggleTimer() {
  const cur = state.current;
  if (!cur || state.phase !== 'question') return;
  if (cur.timer.running) {
    cur.timer.running = false;
  } else if (cur.timer.remaining > 0) {
    cur.timer.running = true;
    cur.timer.last = Date.now();
  }
  save();
  render();
}

function tick() {
  const now = Date.now();
  accrueMatchTime(now);
  updateClocks();
  if (state.matchActive && now - lastSaveAt > 5000) {
    lastSaveAt = now;
    save();
  }
  if (!state.current || state.phase !== 'question' || !state.current.timer.running) return;
  const t = state.current.timer;
  const dt = Math.max(0, (now - t.last) / 1000);
  t.last = now;
  t.remaining -= dt;

  if (t.remaining <= 0) {
    t.remaining = 0;
    t.running = false;
    updateTimerDOM();
    answer(null);
    return;
  }

  updateTimerDOM();
  if (now - lastSaveAt > 2500) {
    lastSaveAt = now;
    save();
  }
}

function updateTimerDOM() {
  const el = document.getElementById('timer-value');
  if (!el || !state.current || !state.current.timer) return;
  const t = state.current.timer;
  const remaining = Math.max(0, t.remaining);
  el.textContent = Math.ceil(remaining);
  const ring = document.getElementById('timer');
  if (ring) {
    const pct = t.total ? Math.max(0, Math.min(100, (remaining / t.total) * 100)) : 0;
    ring.style.setProperty('--p', pct);
    ring.classList.toggle('urgent', remaining <= 10 && remaining > 0);
    ring.classList.toggle('paused', !t.running);
  }
}

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */

function sfx(name) {
  if (!state.settings.sound) return;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const tone = (freq, start, dur, type = 'square', vol = 0.04, endFreq = null) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + dur);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.03);
    };
    const noise = (dur, vol = 0.03) => {
      const length = Math.floor(audioCtx.sampleRate * dur);
      const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      src.buffer = buffer;
      gain.gain.value = vol;
      src.connect(gain).connect(audioCtx.destination);
      src.start();
    };

    switch (name) {
      case 'click':
        tone(520, 0, 0.04, 'square', 0.025);
        break;
      case 'buy':
        tone(880, 0, 0.06, 'square', 0.03);
        tone(1320, 0.055, 0.09, 'square', 0.03);
        break;
      case 'draw':
        tone(392, 0, 0.07, 'square', 0.03);
        tone(523, 0.07, 0.1, 'square', 0.03);
        break;
      case 'correct':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.1, 'square', 0.035));
        break;
      case 'wrong':
        tone(220, 0, 0.14, 'sawtooth', 0.04, 150);
        tone(150, 0.15, 0.18, 'sawtooth', 0.035, 100);
        break;
      case 'cast':
        tone(520, 0, 0.16, 'square', 0.03, 980);
        noise(0.1, 0.015);
        break;
      case 'impact':
        noise(0.16, 0.045);
        tone(140, 0, 0.12, 'square', 0.035, 80);
        break;
      case 'block':
        tone(1180, 0, 0.08, 'triangle', 0.04);
        tone(780, 0.08, 0.12, 'triangle', 0.035);
        break;
      case 'star':
        [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.1, 'square', 0.035));
        break;
      case 'turn':
        noise(0.12, 0.02);
        tone(330, 0, 0.08, 'square', 0.025, 520);
        break;
      case 'start':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.12, 'square', 0.035));
        break;
      case 'fanfare':
        [523, 659, 784, 1046, 1318, 1046].forEach((f, i) =>
          tone(f, i * 0.11, 0.16, 'square', 0.04)
        );
        break;
      default:
        break;
    }
  } catch {
    /* audio unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* Render: header and arena                                            */
/* ------------------------------------------------------------------ */

function roundText() {
  if (state.phase === 'gameover') return 'FINAL';
  if (isSuddenDeath()) return 'SUDDEN DEATH';
  return `ROUND ${Math.min(state.round, state.roundLimit)} / ${state.roundLimit}`;
}

function renderHeader(inGame) {
  return `
    <header class="app-header">
      <div class="brand">
        <span class="brand-mark">BB</span>
        <div>
          <h1>BASADO BOWL</h1>
          <span class="sub">PHYSICS TRIVIA BATTLE</span>
        </div>
      </div>
      ${
        inGame
          ? `<div class="round-pill"><span>${roundText()}</span><span class="match-clock" data-match-clock>${formatClock(
              matchElapsedMs()
            )}</span></div>`
          : ''
      }
      <div class="noise-pill" data-noise-pill>
        <button type="button" class="noise-toggle off" data-action="noise-toggle"
          data-noise-toggle aria-pressed="false" aria-label="Toggle noise gate"
          title="Turn noise gate on">${svgIcon('mic')}</button>
        <div class="noise-meter" data-noise-threshold-control role="slider"
          tabindex="0" aria-label="Noise gate threshold" aria-valuemin="0"
          aria-valuemax="100" aria-valuenow="${noiseThreshold()}">
          <span class="noise-label">NOISE</span>
          <span class="noise-track">
            <span class="noise-fill" data-noise-fill></span>
            <span class="noise-marker" data-noise-marker></span>
          </span>
          <span class="noise-readout" data-noise-readout>--</span>
          <span class="loud-clock" title="Time above threshold">LOUD <b data-loud-clock>${
            state.noiseUsed ? formatClock(loudElapsedMs()) : '--'
          }</b></span>
          <span class="noise-threshold-value" data-noise-threshold-readout>${noiseThreshold()}</span>
          <span class="noise-state" data-noise-status>${noiseStatusText()}</span>
        </div>
      </div>
      <div class="header-actions">
        ${
          inGame
            ? `<button type="button" class="icon-btn" data-action="undo" title="Undo" ${
                undoStack.length ? '' : 'disabled'
              }>${svgIcon('undo')}</button>`
            : ''
        }
        <button type="button" class="icon-btn" data-action="sound" title="Sound">${svgIcon(
          state.settings.sound ? 'sound' : 'mute'
        )}</button>
        <button type="button" class="icon-btn" data-action="fullscreen" title="Fullscreen">${svgIcon(
          'expand'
        )}</button>
        <button type="button" class="icon-btn" data-action="menu" title="Menu">${svgIcon(
          'menu'
        )}</button>
      </div>
    </header>`;
}

function ringHTML(team) {
  const id = team.spells[0];
  if (!id) return '<span class="ring-halo"></span><span class="ring-slot empty"></span>';
  const spell = SPELL_BY_ID[id];
  const out = isSuddenDeath() && !state.contenders.includes(team.id);
  const disabled = isSuddenDeath() || out;
  return `<span class="ring-halo"></span><button type="button" class="ring-slot filled"
    data-action="use" data-spell="${id}" data-team="${team.id}" title="${
      disabled ? 'Items are disabled in sudden death' : esc(spell.name)
    }" style="--spell:${spell.color}" ${disabled ? 'disabled' : ''}>${svgIcon(
      spell.icon
    )}</button>`;
}

function effectChips(team) {
  const chips = [];
  if (!isSuddenDeath() && team.spells.includes('shield')) {
    chips.push(
      `<span class="effect-chip" style="--c:#41e0ff" title="Shield">${svgIcon('shield')}</span>`
    );
  }
  if (team.buffs.double) {
    chips.push(
      `<span class="effect-chip" style="--c:#ffd23f" title="Double Down">${svgIcon('bolt')}</span>`
    );
  }
  if (!isSuddenDeath() && (team.jinxTurns || 0) > 0) {
    chips.push(
      `<span class="effect-chip jinx-chip" style="--c:#a855f7" title="Jinxed: ${
        team.jinxTurns
      } turns left">${svgIcon('jinx')}<b>${team.jinxTurns}</b></span>`
    );
  }
  return chips.join('');
}

function renderArena() {
  const max = Math.max(...state.teams.map((t) => t.score));
  const tie = state.teams.filter((t) => t.score === max).length > 1;
  const activeTeam = currentTeam();
  return `
    <section class="arena">
      ${state.teams
        .map((t) => {
          const meta = teamMeta(t.id);
          const active =
            ['prep', 'question', 'reveal'].includes(state.phase) &&
            activeTeam &&
            t.id === activeTeam.id;
          const out = isSuddenDeath() && !state.contenders.includes(t.id);
          const winner = state.phase === 'gameover' && !tie && t.score === max;
          const fx = ui.fx && ui.fx.teamId === t.id ? ui.fx : null;
          const reaction = fx?.kind === 'answer' ? (fx.correct ? 'celebrate' : 'sad') : '';
          return `
            <div class="platform ${active ? 'active' : ''} ${winner ? 'winner' : ''} ${
              out ? 'out' : ''
            }"
              data-team="${t.id}" style="${teamStyle(meta)}">
              ${active ? '<span class="turn-arrow" aria-hidden="true"></span>' : ''}
              ${winner ? `<span class="crown">${svgIcon('crown')}</span>` : ''}
              <div class="char-wrap">
                <div class="char-stage">
                  <div class="spell-ring" data-team="${t.id}">${ringHTML(t)}</div>
                  <div class="char-sprite ${reaction}">${characterSVG(t.character)}</div>
                </div>
              </div>
              <div class="platform-base"></div>
              <div class="nameplate">
                <span class="team-name">${esc(t.name)}</span>
                <span class="score" data-score="${t.id}">${t.score}</span>
                <span class="correct-count">${t.correct}/${t.total}</span>
              </div>
              <div class="effect-row">${effectChips(t)}</div>
            </div>`;
        })
        .join('')}
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: setup                                                       */
/* ------------------------------------------------------------------ */

function segmented(options, active, action) {
  return `<div class="segmented">${options
    .map(
      ([value, label]) => `
      <button type="button" data-action="${action}" data-value="${value}" class="${
        String(active) === String(value) ? 'active' : ''
      }" aria-pressed="${String(active) === String(value)}">${label}</button>`
    )
    .join('')}</div>`;
}

function field(label, html) {
  return `<div class="field"><label>${label}</label>${html}</div>`;
}

function renderSetup() {
  const selectedQuestions = state.settings.units.reduce((sum, unit) => sum + unitCount(unit), 0);
  const needed = state.settings.rounds * state.teams.length;
  return `
    <section class="setup">
      <div class="setup-hero">
        <span class="hero-kicker">BLUE · RED · YELLOW</span>
        <h1>BASADO BOWL</h1>
        <p class="tagline">THREE TEAMS · ONE BOWL · ANSWER · EARN · SABOTAGE</p>
      </div>

      <div class="setup-grid">
        <section class="panel">
          <h2>MATCH SETUP</h2>
          ${field(
            'GRADE',
            segmented(
              [
                ['6', 'GRADE 6'],
                ['7', 'GRADE 7'],
              ],
              state.settings.grade,
              'grade'
            )
          )}
          <div class="field">
            <label>UNITS</label>
            <div class="unit-grid">
              ${CONFIG.categories
                .map((c) => {
                  const count = unitCount(c.id);
                  const on = state.settings.units.includes(c.id);
                  return `
                    <button type="button" class="unit-chip ${on ? 'on' : ''}" data-action="unit"
                      data-value="${c.id}" ${count ? '' : 'disabled'}>
                      <span class="unit-icon" style="--c:${c.color}">${svgIcon(c.icon)}</span>
                      <strong>${c.short}</strong>
                      <small>${c.name}</small>
                      <em>${count} Q</em>
                    </button>`;
                })
                .join('')}
            </div>
            <div class="unit-summary">
              <strong>${selectedQuestions}</strong> questions selected · drawn at random
              ${selectedQuestions < needed ? '<span>The bank will reshuffle if it runs out.</span>' : ''}
            </div>
          </div>
          ${field(
            'ROUNDS',
            segmented(
              [
                ['5', '5'],
                ['10', '10'],
                ['15', '15'],
              ],
              String(state.settings.rounds),
              'rounds'
            )
          )}
          ${field(
            'TIMER',
            segmented(
              [
                ['on', 'ON'],
                ['off', 'OFF'],
              ],
              state.settings.timer ? 'on' : 'off',
              'timer-setting'
            )
          )}
        </section>

        <section class="panel">
          <h2>TEAMS</h2>
          <div class="team-name-list">
            ${state.teams
              .map((t, i) => {
                const meta = teamMeta(t.id);
                return `
                  <div class="team-name-row" style="${teamStyle(meta)}">
                    <div class="setup-char">${characterSVG(t.character)}</div>
                    <div class="team-input-wrap">
                      <span class="team-char-name">TEAM ${i + 1}</span>
                      <strong class="team-fixed-name">${esc(t.name)}</strong>
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
          <h2>HOW IT WORKS</h2>
          <ul class="rules">
            <li>Each team answers a question drawn at random from the units you choose. Every question is worth <strong>100 points</strong> on a 30-second timer.</li>
            <li>Before round 1, each team drafts one <strong>item</strong>.</li>
            <li>Draft one new item after every 5 rounds. A team holds only one item at a time.</li>
            <li>Highest score after the set rounds wins.</li>
          </ul>
        </section>
      </div>

      <div class="setup-lineup">
        ${state.teams
          .map((t) => {
            const meta = teamMeta(t.id);
            const character = CHARACTERS[t.character] || CHARACTERS.blue;
            return `
              <div class="lineup-slot" style="${teamStyle(meta)}">
                <div class="lineup-char">${characterSVG(t.character)}</div>
                <div class="lineup-base"></div>
                <span class="lineup-name">${character.name}</span>
              </div>`;
          })
          .join('')}
      </div>

      <div class="setup-start">
        <button type="button" class="btn primary xl start-btn" data-action="start">START MATCH →</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: prep                                                        */
/* ------------------------------------------------------------------ */

function turnRibbon(team, meta) {
  return `
    <div class="turn-ribbon" style="${teamStyle(meta)}">
      <div>
        <span class="ribbon-kicker">${
          isSuddenDeath() ? 'SUDDEN DEATH · HARD' : `ROUND ${state.round} / ${state.roundLimit}`
        }</span>
        <h2>${esc(team.name).toUpperCase()}'S TURN</h2>
      </div>
      <div class="ribbon-spells">ITEM: ${
        team.spells[0] ? SPELL_BY_ID[team.spells[0]].short.toUpperCase() : 'NONE'
      }</div>
    </div>`;
}

function spellTray(team) {
  const id = team.spells[0];
  if (!id) return '<div class="tray-slot empty" title="No item held">+</div>';
  const spell = SPELL_BY_ID[id];
  const st = spellStatus(team, id);
  return `
    <div class="tray-slot filled" style="--spell:${spell.color}">
      <span class="tray-orb">${svgIcon(spell.icon)}</span>
      <span class="tray-name">${spell.short}</span>
      <button type="button" class="btn tiny" data-action="use" data-spell="${id}" ${
        st.ok ? '' : 'disabled'
      }>${st.label}</button>
    </div>`;
}

function spellLoadout(team) {
  const held = team.spells[0];
  if (held) {
    const spell = SPELL_BY_ID[held];
    const status = spellStatus(team, held);
    return `
      <article class="spell-card ready" style="--spell:${spell.color}">
        <div class="spell-top">
          <span class="spell-orb-big">${svgIcon(spell.icon)}</span>
          <span class="spell-state">${status.label}</span>
        </div>
        <h3>${spell.name}</h3>
        <p>${spell.desc}</p>
        <button type="button" class="btn spell-use" data-action="use"
          data-spell="${spell.id}" ${status.ok ? '' : 'disabled'}>${status.label}</button>
      </article>`;
  }
  const last = SPELL_BY_ID[team.learned[0]];
  return `
    <article class="spell-card used" style="--spell:${last ? last.color : '#9b8f78'}">
      <div class="spell-top">
        <span class="spell-orb-big">${svgIcon(last ? last.icon : 'slot')}</span>
        <span class="spell-state">${last ? 'USED' : 'EMPTY'}</span>
      </div>
      <h3>${last ? last.name : 'No item held'}</h3>
      <p>${last ? 'That item has been used. Draft one after the next 5-round block.' : 'Draft an item after the next 5-round block.'}</p>
      <button type="button" class="btn" disabled>${last ? 'USED' : 'EMPTY SLOT'}</button>
    </article>`;
}

function nextDraftHint(team) {
  const next = nextDraftRound();
  if (!next) return 'NO MORE ITEM DRAFTS.';
  const held = SPELL_BY_ID[team.spells[0]];
  return `${held ? `HOLDING ${held.short.toUpperCase()} · ` : ''}NEXT ITEM DRAFT: ROUND ${next}.`;
}

function renderPrep() {
  const team = currentTeam();
  const meta = teamMeta(team.id);
  return `
    <section class="phase prep team-${team.id}" style="${teamStyle(meta)}">
      ${turnRibbon(team, meta)}
      <div class="prep-main">
        <div class="prep-body">
          <div class="prep-head">
            <span class="kick">YOUR ITEM</span>
            <h2>READY UP</h2>
            <p>One item in hand. Use it before the next draft.</p>
          </div>
          <div class="loadout one">${spellLoadout(team)}</div>
          <button type="button" class="btn draw-btn" id="draw-question-btn" data-action="draw" ${
            noiseBlocking() ? 'disabled' : ''
          }>${noiseBlocking() ? 'WAIT FOR QUIET' : 'DRAW A QUESTION →'}</button>
          <div class="noise-gate-hint" data-noise-gate-hint ${
            noiseBlocking() ? '' : 'hidden'
          }></div>
          <p class="draft-hint">${nextDraftHint(team)}</p>
        </div>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: draft                                                       */
/* ------------------------------------------------------------------ */

function renderDraft() {
  return `
    <section class="phase draft">
      <div class="draft-head">
        <span class="kick">ROUND ${state.round} / ${state.roundLimit}</span>
        <h2>ITEM DRAFT</h2>
        <p>Each team picks one item. It replaces the item they are holding.</p>
      </div>
      <div class="draft-grid">
        ${state.teams
          .map((t) => {
            const meta = teamMeta(t.id);
            const held = SPELL_BY_ID[t.spells[0]];
            return `
              <div class="draft-team" style="${teamStyle(meta)}">
                <div class="draft-team-head">
                  <span class="draft-mini">${characterSVG(t.character)}</span>
                  <strong>${esc(t.name)}</strong>
                  <em>${held ? held.short.toUpperCase() : 'NO ITEM'}</em>
                </div>
                <div class="draft-spells">
                  ${CONFIG.spells
                    .map((spell) => {
                      const selected = state.draft[t.id] === spell.id;
                      const keeping = held && held.id === spell.id;
                      const label = selected ? 'PICKED' : keeping ? 'KEEP' : 'PICK';
                      return `
                        <button type="button" class="draft-spell ${
                          selected ? 'selected' : ''
                        }" data-action="draft-pick"
                          data-team="${t.id}" data-spell="${spell.id}">
                          <span class="draft-icon" style="--spell:${spell.color}">${svgIcon(
                            spell.icon
                          )}</span>
                          <span class="draft-text"><strong>${spell.name}</strong><small>${
                            spell.draftDesc
                          }</small></span>
                          <em>${label}</em>
                        </button>`;
                    })
                    .join('')}
                </div>
              </div>`;
          })
          .join('')}
      </div>
      <div class="draft-actions">
        <button type="button" class="btn primary xl" data-action="start-round" ${
          draftReady() ? '' : 'disabled'
        }>START ROUND ${state.round} →</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: question and reveal                                         */
/* ------------------------------------------------------------------ */

function timerHTML(cur) {
  const remaining = Math.max(0, cur.timer.remaining);
  const pct = cur.timer.total
    ? Math.max(0, Math.min(100, (remaining / cur.timer.total) * 100))
    : 0;
  return `
    <div class="timer ${remaining <= 10 ? 'urgent' : ''} ${
      cur.timer.running ? '' : 'paused'
    }" id="timer" style="--p:${pct}">
      <div class="timer-inner"><span id="timer-value">${Math.ceil(remaining)}</span></div>
    </div>`;
}

function renderQuestion() {
  const cur = state.current;
  const team = currentTeam();
  const meta = teamMeta(team.id);
  const cat = CATEGORY_BY_ID[cur.unit];

  return `
    <section class="phase question team-${team.id} ${
      cur.jinxed ? 'question-jinxed' : ''
    } ${cur.q.image ? 'has-figure' : ''}" style="${teamStyle(meta)}">
      <div class="q-top">
        <div class="q-badges">
          <span class="badge" style="--c:${cat.color}">${svgIcon(cat.icon)} ${cat.short}</span>
          ${
            cur.suddenDeath
              ? `<span class="badge sudden">${svgIcon('bolt')} SUDDEN DEATH${
                  state.settings.timer ? ` · ${CONFIG.suddenDeathSeconds}s` : ''
                }</span>`
              : ''
          }
          ${
            cur.jinxed
              ? `<span class="badge jinxed">${svgIcon('jinx')} JINX −${CONFIG.jinxPenaltySeconds}s</span>`
              : ''
          }
          <span class="badge pts">${cur.points} PTS</span>
        </div>
        ${state.settings.timer ? timerHTML(cur) : '<span class="timer-off">NO TIMER</span>'}
      </div>
      <div class="question-body">
        <div class="question-card ${cur.q.image ? 'has-figure' : ''}">
          <p class="q-team">${esc(team.name).toUpperCase()} · ${
            cur.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${state.round} / ${state.roundLimit}`
          }</p>
          <h2 class="question-text">${richText(cur.q.q)}</h2>
          ${questionFigure(cur.q)}
        </div>
        <div class="answers">
          ${cur.q.a
            .map((ans, i) => {
              const removed = cur.removed.includes(i);
              const ansColor = ['#ff3b5c', '#1e6bff', '#ffd23f', '#18a96b'][i];
              return `
                <button type="button" class="answer ${removed ? 'removed' : ''}" data-action="answer"
                  data-index="${i}" style="--ans:${ansColor}" ${removed ? 'disabled' : ''}>
                  <span class="letter">${'ABCD'[i]}</span><span class="answer-text">${richText(
                    ans
                  )}</span>
                </button>`;
            })
            .join('')}
        </div>
        <div class="q-actions">
          <div class="q-tray">${spellTray(team)}</div>
          <div class="q-buttons">
            ${
              state.settings.timer
                ? `<button type="button" class="btn ghost" data-action="pause">${
                    cur.timer.running ? 'PAUSE' : 'RESUME'
                  }</button>`
                : ''
            }
            <button type="button" class="btn ghost" data-action="give-up">NO ANSWER</button>
          </div>
        </div>
      </div>
    </section>`;
}

function renderReveal() {
  const cur = state.current;
  const team = currentTeam();
  const meta = teamMeta(team.id);
  const correct = cur.earned.correct;
  const chosenText = cur.chosen === null ? 'NO ANSWER' : cur.q.a[cur.chosen];
  const correctText = cur.q.a[cur.q.correct];

  return `
    <section class="phase reveal" style="${teamStyle(meta)}">
      <div class="reveal-stamp ${correct ? 'good' : 'bad'}">${correct ? 'CORRECT!' : 'NOT QUITE!'}</div>
      <div class="reveal-grid">
        <div class="reveal-card score-card">
          <span class="kick">${esc(team.name).toUpperCase()}</span>
          <div class="score-gain">+${cur.earned.points}<small>PTS</small></div>
          <span class="your-answer">YOUR ANSWER</span>
          <strong class="${correct ? 'good-text' : 'bad-text'}">${richText(chosenText)}</strong>
        </div>
        <div class="reveal-card">
          <span class="kick">CORRECT ANSWER</span>
          <strong class="good-text">${richText(correctText)}</strong>
          <span class="kick why-kick">WHY</span>
          <p>${richText(cur.q.why)}</p>
        </div>
      </div>
      <div class="reveal-actions">
        <div class="noise-gate-hint" data-noise-gate-hint hidden></div>
        <button type="button" class="btn primary next-btn" id="next-turn-btn" data-action="next" ${
          noiseBlocking() ? 'disabled' : ''
        }>${noiseBlocking() ? 'WAIT FOR QUIET' : 'NEXT TEAM →'}</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: game over                                                   */
/* ------------------------------------------------------------------ */

function renderGameover() {
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.correct - a.correct);
  const leaders = ranked.filter((t) => t.score === ranked[0].score);
  const tie = leaders.length > 1;
  const tieLabel = leaders.map((t) => esc(t.name).toUpperCase()).join(' VS ');

  return `
    <section class="phase gameover">
      <div class="champion">
        <span class="kick">FINAL RESULTS</span>
        <h1>${tie ? 'SUDDEN DEATH!' : `${esc(ranked[0].name).toUpperCase()} WINS!`}</h1>
      </div>
      <div class="podium">
        ${ranked
          .map((t, i) => {
            const meta = teamMeta(t.id);
            return `
              <article class="podium-card ${i === 0 && !tie ? 'winner' : ''}" style="${teamStyle(meta)}">
                <span class="rank">#${i + 1}</span>
                <div class="podium-char">${characterSVG(t.character)}</div>
                <h3>${esc(t.name)}</h3>
                <div class="podium-score">${t.score}</div>
                <p>${t.correct}/${t.total} CORRECT</p>
              </article>`;
          })
          .join('')}
      </div>
      <div class="match-stats">
        <div class="match-stat">
          <span class="kick">TOTAL TIME</span>
          <strong data-final-match-clock>${formatClock(matchElapsedMs())}</strong>
        </div>
        <div class="match-stat">
          <span class="kick">ABOVE THRESHOLD</span>
          <strong data-final-loud-clock>${
            state.noiseUsed ? formatClock(loudElapsedMs()) : 'MIC OFF'
          }</strong>
          <small>threshold ${noiseThreshold()}</small>
        </div>
      </div>
      <div class="gameover-actions">
        ${
          tie
            ? `<button type="button" class="btn primary xl" data-action="sudden-death">SUDDEN DEATH: ${tieLabel} →</button>`
            : ''
        }
        <button type="button" class="btn ${tie ? '' : 'primary'} xl" data-action="play-again">PLAY AGAIN</button>
        <button type="button" class="btn ghost" data-action="new-setup">NEW SETUP</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: modal and dev bar                                           */
/* ------------------------------------------------------------------ */

function overlay(html) {
  return `<div class="overlay"><div class="modal">${html}</div></div>`;
}

function openModal(name) {
  if (state.phase === 'question' && state.current && state.current.timer.running) {
    state.current.timer.running = false;
  }
  ui.modal = name;
  render();
}

function renderModal() {
  if (!ui.modal) return '';

  if (ui.modal === 'menu') {
    return overlay(`
      <h2>MENU</h2>
      <p class="modal-sub">The match saves automatically on this device.</p>
      <div class="modal-actions">
        <button type="button" class="btn primary" data-action="close-modal">RESUME</button>
        <button type="button" class="btn" data-action="how">HOW TO PLAY</button>
        ${
          state.phase !== 'setup'
            ? '<button type="button" class="btn" data-action="restart">RESTART MATCH</button>'
            : ''
        }
        ${
          state.phase !== 'setup'
            ? '<button type="button" class="btn ghost" data-action="new-setup">NEW SETUP</button>'
            : ''
        }
        <a class="btn ghost" href="/">BACK TO PHYSICS SITE</a>
      </div>`);
  }

  if (ui.modal === 'how') {
    return overlay(`
      <h2>HOW TO PLAY</h2>
      <div class="how-grid">
        <div>
          <h3>TURN</h3>
          <p>Draft one item, draw a random question from the selected units, then answer as a class. The teacher taps the answer the team commits to. If the noise gate is on, drawing the next question and moving to the next turn both wait until the room is quiet.</p>
        </div>
        <div>
          <h3>SCORE</h3>
          <p>Every question is worth 100 points on a 30-second timer. Each team drafts one item before round 1, then one new item after every 5 rounds.</p>
        </div>
        <div>
          <h3>ITEMS</h3>
          <p>Each team holds one item at a time, shown as a single orb over the open palm. Using it frees the slot. Picking the same item at a later draft keeps it; picking another replaces it. Magic Missile deals 100 points of damage unless the target has a Shield.</p>
        </div>
        <div>
          <h3>WIN</h3>
          <p>Highest score after the set rounds wins. A tie triggers a sudden-death round.</p>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn primary" data-action="close-modal">GOT IT</button>
      </div>`);
  }

  if (ui.modal === 'confirm-restart') {
    return overlay(`
      <h2>RESTART MATCH?</h2>
      <p class="modal-sub">Scores, items, and the current turn will be reset.</p>
      <div class="modal-actions">
        <button type="button" class="btn primary" data-action="confirm-restart">YES, RESTART</button>
        <button type="button" class="btn ghost" data-action="close-modal">CANCEL</button>
      </div>`);
  }

  if (ui.modal === 'confirm-new') {
    return overlay(`
      <h2>NEW SETUP?</h2>
      <p class="modal-sub">This match will end. The next setup starts fresh.</p>
      <div class="modal-actions">
        <button type="button" class="btn primary" data-action="confirm-new">YES, NEW SETUP</button>
        <button type="button" class="btn ghost" data-action="close-modal">CANCEL</button>
      </div>`);
  }

  if (ui.modal === 'target') {
    const spell = SPELL_BY_ID[ui.pendingSpell];
    const actor = currentTeam();
    return overlay(`
      <h2>${svgIcon(spell.icon, 'lg')} ${spell.name.toUpperCase()}</h2>
      <p class="modal-sub">Who do you want to hit?</p>
      <div class="target-grid">
        ${state.teams
          .filter((t) => t.id !== actor.id && (!isSuddenDeath() || state.contenders.includes(t.id)))
          .map((t) => {
            const meta = teamMeta(t.id);
            return `
              <button type="button" class="target-btn" style="${teamStyle(meta)}"
                data-action="target" data-team="${t.id}">
                <span>${esc(t.name)}</span>
                <small>${t.score} PTS${
                  t.spells.includes('shield') ? ` · ${svgIcon('shield')} SHIELDED` : ''
                }</small>
              </button>`;
          })
          .join('')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">CANCEL</button>
      </div>`);
  }

  return '';
}

function devBar() {
  if (!DEV) return '';
  return `
    <div class="devbar">
      <strong>DEV</strong>
      <button type="button" data-action="dev-score">+1000 ALL</button>
      <button type="button" data-action="dev-draft">DRAFT</button>
      <button type="button" data-action="dev-question">QUESTION</button>
      <button type="button" data-action="dev-reveal">REVEAL</button>
      <button type="button" data-action="dev-end">END</button>
      <button type="button" data-action="dev-reset">RESET</button>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Phase dispatch and render                                           */
/* ------------------------------------------------------------------ */

function renderPhase() {
  switch (state.phase) {
    case 'setup':
      return renderSetup();
    case 'draft':
      return renderDraft();
    case 'prep':
      return renderPrep();
    case 'question':
      return renderQuestion();
    case 'reveal':
      return renderReveal();
    case 'gameover':
      return renderGameover();
    default:
      return renderSetup();
  }
}

function render() {
  finalizeMatchIfNeeded();
  const inGame = state.phase !== 'setup';
  const phaseChanged = state.phase !== lastPhase;
  lastPhase = state.phase;
  app.className = ui.animating ? 'is-animating' : '';
  app.innerHTML = `
    ${renderHeader(inGame)}
    ${inGame ? renderArena() : ''}
    <main class="stage ${phaseChanged ? 'phase-enter' : ''}">${renderPhase()}</main>
    ${renderModal()}
    ${devBar()}
  `;
  if (state.phase === 'question') updateTimerDOM();
  save();
  updateNoiseDOM();
  updateClocks();
  if (phaseChanged && state.phase === 'gameover') {
    requestAnimationFrame(() => arenaConfetti());
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function handleAction(action, el) {
  if (ui.animating) return;

  switch (action) {
    case 'start':
      startMatch();
      break;

    case 'grade': {
      const grade = el.dataset.value;
      if (grade === state.settings.grade) break;
      const before = CONFIG.categories
        .filter((c) => unitCount(c.id) > 0)
        .map((c) => c.id);
      state.settings.grade = grade;
      const usable = CONFIG.categories
        .filter((c) => unitCount(c.id) > 0)
        .map((c) => c.id);
      const newlyAvailable = usable.filter((u) => !before.includes(u));
      state.settings.units = Array.from(
        new Set([
          ...state.settings.units.filter((u) => usable.includes(u)),
          ...newlyAvailable,
        ])
      );
      if (!state.settings.units.length && usable.length) state.settings.units = [usable[0]];
      save();
      render();
      break;
    }

    case 'unit': {
      const unit = el.dataset.value;
      const on = state.settings.units.includes(unit);
      if (on && state.settings.units.length === 1) {
        toast('Keep at least one unit selected.');
        break;
      }
      state.settings.units = on
        ? state.settings.units.filter((u) => u !== unit)
        : [...state.settings.units, unit];
      save();
      render();
      break;
    }

    case 'rounds':
      state.settings.rounds = Number(el.dataset.value);
      save();
      render();
      break;

    case 'timer-setting':
      state.settings.timer = el.dataset.value === 'on';
      save();
      render();
      break;

    case 'noise-toggle':
      toggleNoise();
      break;

    case 'sound':
      state.settings.sound = !state.settings.sound;
      save();
      render();
      if (state.settings.sound) sfx('click');
      break;

    case 'fullscreen':
      if (!document.fullscreenElement) {
        const request = document.documentElement.requestFullscreen?.();
        request?.catch?.(() => {});
      } else {
        document.exitFullscreen?.();
      }
      break;

    case 'menu':
      openModal('menu');
      break;

    case 'how':
      openModal('how');
      break;

    case 'restart':
      openModal('confirm-restart');
      break;

    case 'confirm-restart':
      startMatch();
      break;

    case 'new-setup':
      if (state.phase === 'gameover' || state.phase === 'setup') {
        newSetup();
      } else {
        openModal('confirm-new');
      }
      break;

    case 'confirm-new':
      newSetup();
      break;

    case 'close-modal':
      ui.modal = null;
      ui.pendingSpell = null;
      render();
      break;

    case 'undo':
      undo();
      break;

    case 'use':
      useSpell(el.dataset.spell);
      break;

    case 'target':
      castSpell(ui.pendingSpell, el.dataset.team);
      break;

    case 'draft-pick':
      draftPick(el.dataset.team, el.dataset.spell);
      break;

    case 'start-round':
      startRound();
      break;

    case 'draw':
      drawRandomQuestion();
      break;

    case 'answer':
      answer(Number(el.dataset.index));
      break;

    case 'give-up':
      answer(null);
      break;

    case 'pause':
      toggleTimer();
      break;

    case 'next':
      nextTurn();
      break;

    case 'sudden-death':
      suddenDeath();
      break;

    case 'play-again':
      playAgain();
      break;

    case 'dev-score':
      state.teams.forEach((t) => {
        t.score += 1000;
      });
      save();
      render();
      break;

    case 'dev-draft':
      state.phase = 'draft';
      state.draft = {};
      state.turn = 0;
      ui.fx = null;
      ui.animating = false;
      save();
      render();
      break;

    case 'dev-question':
      if (state.phase === 'setup') startMatch();
      if (state.phase === 'draft') seedSpells();
      if (state.phase !== 'prep') state.phase = 'prep';
      drawRandomQuestion();
      break;

    case 'dev-reveal':
      if (state.phase === 'question' && state.current) {
        answer(state.current.q.correct);
      }
      break;

    case 'dev-end':
      state.phase = 'gameover';
      state.current = null;
      ui.fx = null;
      save();
      render();
      break;

    case 'dev-reset':
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      state = defaultState();
      undoStack = [];
      ui = { modal: null, pendingSpell: null, animating: false, fx: null };
      render();
      break;

    default:
      break;
  }
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  handleAction(el.dataset.action, el);
});

function setNoiseThresholdFromClientX(clientX) {
  const control = document.querySelector('[data-noise-threshold-control]');
  if (!control) return;
  const track = control.querySelector('.noise-track') || control;
  const rect = track.getBoundingClientRect();
  if (!rect.width) return;
  const value = Math.max(
    0,
    Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100))
  );
  if (value === state.settings.noiseThreshold) return;
  state.settings.noiseThreshold = value;
  noise.quietSince = performance.now();
  noise.gateOpen = false;
  save();
  updateNoiseDOM();
}

app.addEventListener('pointerdown', (e) => {
  const control = e.target.closest('[data-noise-threshold-control]');
  if (!control) return;
  e.preventDefault();
  control.focus({ preventScroll: true });
  control.setPointerCapture?.(e.pointerId);
  noise.dragging = true;
  setNoiseThresholdFromClientX(e.clientX);
});

app.addEventListener('pointermove', (e) => {
  if (!noise.dragging) return;
  setNoiseThresholdFromClientX(e.clientX);
});

const endNoiseDrag = () => {
  noise.dragging = false;
};
app.addEventListener('pointerup', endNoiseDrag);
app.addEventListener('pointercancel', endNoiseDrag);

app.addEventListener('keydown', (e) => {
  const control = e.target.closest('[data-noise-threshold-control]');
  if (!control) return;
  let value = state.settings.noiseThreshold;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') value -= 1;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') value += 1;
  else if (e.key === 'Home') value = 0;
  else if (e.key === 'End') value = 100;
  else return;
  e.preventDefault();
  state.settings.noiseThreshold = Math.max(0, Math.min(100, value));
  noise.quietSince = performance.now();
  noise.gateOpen = false;
  save();
  updateNoiseDOM();
});

app.addEventListener('contextmenu', (e) => {
  if (e.target.closest('input')) return;
  e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    accrueMatchTime();
    flushLoudTime();
    state.matchTickAt = null;
    noise.overSince = 0;
    save();
    if (state.phase === 'question' && state.current && state.current.timer.running) {
      state.current.timer.running = false;
      save();
    }
    return;
  }
  if (state.matchActive && !state.matchEndedAt) {
    state.matchTickAt = Date.now();
    if (noise.over) noise.overSince = performance.now();
  }
  save();
});

window.addEventListener('beforeunload', () => {
  accrueMatchTime();
  flushLoudTime();
  save();
  if (noise.stream) {
    noise.stream.getTracks().forEach((track) => track.stop());
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

if (params.get('fast') === '1') document.documentElement.classList.add('fast');

state = load() || defaultState();
state.matchTickAt =
  state.matchActive && !state.matchEndedAt && state.phase !== 'setup' ? Date.now() : null;
noise.overSince = 0;

if (state.current && state.current.timer && state.phase === 'question') {
  state.current.timer.last = Date.now();
}

render();
setInterval(tick, 200);

const phaseParam = params.get('phase');
if (phaseParam && state.phase === 'setup') {
  startMatch();
  if (phaseParam === 'draft') {
    save();
    render();
  } else if (['prep', 'gameover', 'question'].includes(phaseParam)) {
    seedSpells();
    if (phaseParam === 'question') {
      drawRandomQuestion();
    } else {
      state.phase = phaseParam;
      save();
      render();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Console / dev API                                                   */
/* ------------------------------------------------------------------ */

window.BB = {
  get state() {
    return state;
  },
  get noise() {
    return noise;
  },
  config: CONFIG,
  questions: QUESTIONS,
  characters: CHARACTERS,
  render,
  save,
  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    state = defaultState();
    undoStack = [];
    ui = { modal: null, pendingSpell: null, animating: false, fx: null };
    render();
  },
  addScore(teamId, n) {
    const t = state.teams.find((x) => x.id === teamId);
    if (!t) return;
    t.score += n;
    save();
    render();
  },
  phase(p) {
    if (state.phase === 'setup') startMatch();
    if (state.phase === 'draft' && p !== 'draft') seedSpells();
    if (p === 'question') {
      state.phase = 'prep';
      drawRandomQuestion();
      return;
    }
    state.phase = p;
    if (p !== 'gameover') state.current = state.current || null;
    save();
    render();
  },
  answer(i) {
    answer(i);
  },
  question() {
    drawRandomQuestion();
  },
};
