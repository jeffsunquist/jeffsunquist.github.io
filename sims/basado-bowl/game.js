import { CONFIG, SPELL_BY_ID, CATEGORY_BY_ID } from './config.js';
import { QUESTIONS } from './questions.js';
import { CHARACTERS, characterSVG } from './characters.js';

const VERSION = 7;
const SAVE_KEY = 'basado-bowl:v7';
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
  jinx: '<path d="M5 11a7 7 0 0 1 14 0v3a2 2 0 0 1-2 2h-1v2H8v-2H7a2 2 0 0 1-2-2v-3z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/><path d="M10 16h4"/>',
  jammer: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
  heist: '<path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M6 8h12l-1 12H7L6 8z"/><path d="M12 12v4M10 14h4"/>',
  sci: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  ele: '<circle cx="12" cy="12" r="9"/><path d="M13 6l-5 7h3l-1 5 5-7h-3l1-5z"/>',
  wav: '<path d="M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/><path d="M2 17c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/>',
  kin: '<path d="M3 18l5-6 4 3 6-8"/><path d="M18 7h3v3"/>',
  for: '<path d="M4 12h14"/><path d="M14 7l5 5-5 5"/>',
  ene: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  undo: '<path d="M9 7H4v5"/><path d="M4 7l5 5a6 6 0 1 0 1.5-6"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  crown: '<path d="M4 8l4 4 4-7 4 7 4-4v9H4V8z"/>',
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

function mathText(value) {
  return esc(value)
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>');
}

function teamMeta(id) {
  return CONFIG.teams.find((t) => t.id === id) || CONFIG.teams[0];
}

function teamStyle(meta) {
  return `--team:${meta.color};--team-soft:${meta.soft};--team-ink:${meta.ink}`;
}

function currentTeam() {
  return state.teams[state.turn];
}

function hasEffect(team, kind) {
  return (team.effects || []).some((e) => e.kind === kind);
}

function addEffect(team, kind, from) {
  team.effects = team.effects.filter((e) => e.kind !== kind);
  team.effects.push({ kind, from });
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
    })),
    turn: 0,
    round: 1,
    roundLimit: CONFIG.defaultRounds,
    used: [],
    current: null,
    draft: {},
  };
}

function save() {
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
      t.character = t.character || teamMeta(t.id).character;
    });
    s.used = Array.isArray(s.used) ? s.used : [];
    s.draft = s.draft && typeof s.draft === 'object' ? s.draft : {};
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
  state.turn = 0;
  state.round = 1;
  state.roundLimit = state.settings.rounds;
  state.used = [];
  state.current = null;
  state.draft = {};
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
  undoStack = [];
  ui = { modal: null, pendingSpell: null, animating: false, fx: null };
  save();
  render();
}

function suddenDeath() {
  pushUndo();
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
  const team = currentTeam();
  const jinxed = hasEffect(team, 'jinx');
  const selected = QUESTIONS.filter(
    (q) => gradeOk(q) && state.settings.units.includes(q.unit)
  );
  if (!selected.length) {
    toast('Choose at least one unit with questions.');
    return;
  }

  pushUndo();
  let pool = selected.filter((q) => !state.used.includes(q.id));
  if (!pool.length) {
    state.used = state.used.filter((id) => !selected.some((q) => q.id === id));
    pool = selected.slice();
    toast('Question bank reshuffled.');
  }

  let candidates = jinxed ? pool.filter((q) => q.level === 3) : pool;
  if (!candidates.length) candidates = pool;

  const q = candidates[Math.floor(Math.random() * candidates.length)];
  state.used.push(q.id);
  if (jinxed) team.effects = team.effects.filter((e) => e.kind !== 'jinx');

  const points = CONFIG.questionPoints;
  const seconds = jinxed ? CONFIG.jinxSeconds : CONFIG.questionSeconds;

  state.current = {
    q,
    unit: q.unit,
    level: q.level,
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
    if (team.buffs.double) points *= 2;
    team.score += points;
    team.correct += 1;
  }
  if (team.buffs.double) delete team.buffs.double;

  cur.earned = { points, correct };
  state.phase = 'reveal';
  ui.fx = { kind: 'answer', teamId: team.id, correct, points };
  save();
  render();
  playAnswerFX(team.id, correct, points);
}

function nextTurn() {
  if (state.phase !== 'reveal') return;
  pushUndo();

  state.current = null;
  state.turn += 1;
  let roundAdvanced = false;
  if (state.turn >= state.teams.length) {
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
/* Spell draft                                                         */
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
  const starters = ['shield', 'double', 'jinx'];
  state.teams.forEach((t, i) => {
    t.learned = [starters[i % starters.length]];
    t.spells = [starters[i % starters.length]];
  });
  state.draft = {};
  state.phase = 'prep';
  state.turn = 0;
}

/* ------------------------------------------------------------------ */
/* Spells                                                              */
/* ------------------------------------------------------------------ */

function spellStatus(team, spellId) {
  if (state.phase !== 'prep' && state.phase !== 'question') {
    return { ok: false, label: 'NOT NOW' };
  }
  if (spellId === 'shield') return { ok: false, label: 'PASSIVE' };
  if (spellId === 'double' && team.buffs.double) return { ok: false, label: 'ARMED' };
  if (spellId === 'jinx' && state.phase !== 'prep') {
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

  if (spellId === 'jinx') {
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
  if (!actor || !target || !spell || actor.id === target.id) return;
  if (!actor.spells.includes(spellId) || state.phase !== 'prep' || ui.animating) return;

  pushUndo();
  const blocked = target.spells.includes('shield');
  ui.modal = null;
  ui.pendingSpell = null;
  ui.animating = true;
  ui.fx = null;
  render();

  playCast(actor.id, target.id, spellId, blocked).then(() => {
    removeSpell(actor, spellId);
    if (blocked) {
      removeSpell(target, 'shield');
      toast(`${target.name}'s Shield blocked ${spell.name}!`, 'bad');
    } else {
      addEffect(target, spellId, actor.id);
      toast(`${spell.name} cast on ${target.name}.`, 'bad');
    }
    ui.animating = false;
    save();
    render();
  });
}

function playCast(actorId, targetId, spellId, blocked) {
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
        blocked ? 'BLOCKED!' : item.name.toUpperCase(),
        end.x,
        end.y - 48,
        blocked ? '#41e0ff' : item.color,
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
  if (!state.current || state.phase !== 'question' || !state.current.timer.running) return;
  const t = state.current.timer;
  const now = Date.now();
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
      ${inGame ? `<div class="round-pill">${roundText()}</div>` : ''}
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
  return `<span class="ring-halo"></span><button type="button" class="ring-slot filled"
    data-action="use" data-spell="${id}" data-team="${team.id}" title="${esc(spell.name)}"
    style="--spell:${spell.color}">${svgIcon(spell.icon)}</button>`;
}

function effectChips(team) {
  const chips = [];
  if (team.spells.includes('shield')) {
    chips.push(
      `<span class="effect-chip" style="--c:#41e0ff" title="Shield">${svgIcon('shield')}</span>`
    );
  }
  if (team.buffs.double) {
    chips.push(
      `<span class="effect-chip" style="--c:#ffd23f" title="Double Down">${svgIcon('bolt')}</span>`
    );
  }
  if (hasEffect(team, 'jinx')) {
    chips.push(
      `<span class="effect-chip" style="--c:#a855f7" title="Jinxed">${svgIcon('jinx')}</span>`
    );
  }
  return chips.join('');
}

function renderArena() {
  const max = Math.max(...state.teams.map((t) => t.score));
  const tie = state.teams.filter((t) => t.score === max).length > 1;
  return `
    <section class="arena">
      ${state.teams
        .map((t, i) => {
          const meta = teamMeta(t.id);
          const active =
            ['prep', 'question', 'reveal'].includes(state.phase) && i === state.turn;
          const winner = state.phase === 'gameover' && !tie && t.score === max;
          const fx = ui.fx && ui.fx.teamId === t.id ? ui.fx : null;
          const reaction = fx?.kind === 'answer' ? (fx.correct ? 'celebrate' : 'sad') : '';
          return `
            <div class="platform ${active ? 'active' : ''} ${winner ? 'winner' : ''}"
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
        <span class="hero-kicker">MIKU · TETO · AKITA</span>
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
              .map((t) => {
                const meta = teamMeta(t.id);
                const character = CHARACTERS[t.character] || CHARACTERS.miku;
                return `
                  <div class="team-name-row" style="${teamStyle(meta)}">
                    <div class="setup-char">${characterSVG(t.character)}</div>
                    <div class="team-input-wrap">
                      <span class="team-char-name">${character.name}</span>
                      <input data-team-name="${t.id}" value="${esc(t.name)}" maxlength="14"
                        aria-label="${character.name} team name" />
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
          <h2>HOW IT WORKS</h2>
          <ul class="rules">
            <li>Each team answers a question drawn at random from the units you choose. Every question is worth <strong>100 points</strong> on a 30-second timer.</li>
            <li>Before round 1, each team drafts one <strong>spell</strong>.</li>
            <li>Draft one new spell after every 5 rounds. A team holds only one spell at a time.</li>
            <li>Highest score after the set rounds wins.</li>
          </ul>
        </section>
      </div>

      <div class="setup-lineup">
        ${state.teams
          .map((t) => {
            const meta = teamMeta(t.id);
            const character = CHARACTERS[t.character] || CHARACTERS.miku;
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
        <span class="ribbon-kicker">ROUND ${state.round} / ${state.roundLimit}</span>
        <h2>${esc(team.name).toUpperCase()}'S TURN</h2>
      </div>
      <div class="ribbon-spells">SPELL: ${
        team.spells[0] ? SPELL_BY_ID[team.spells[0]].short.toUpperCase() : 'NONE'
      }</div>
    </div>`;
}

function spellTray(team) {
  const id = team.spells[0];
  if (!id) return '<div class="tray-slot empty" title="No spell held">+</div>';
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
      <h3>${last ? last.name : 'No spell held'}</h3>
      <p>${last ? 'That spell has been used. Draft one after the next 5-round block.' : 'Draft a spell after the next 5-round block.'}</p>
      <button type="button" class="btn" disabled>${last ? 'USED' : 'EMPTY SLOT'}</button>
    </article>`;
}

function nextDraftHint(team) {
  const next = nextDraftRound();
  if (!next) return 'NO MORE SPELL DRAFTS.';
  const held = SPELL_BY_ID[team.spells[0]];
  return `${held ? `HOLDING ${held.short.toUpperCase()} · ` : ''}NEXT SPELL DRAFT: ROUND ${next}.`;
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
            <span class="kick">YOUR SPELL</span>
            <h2>READY UP</h2>
            <p>One spell in hand. Use it before the next draft.</p>
          </div>
          <div class="loadout one">${spellLoadout(team)}</div>
          <button type="button" class="btn draw-btn" data-action="draw">DRAW A QUESTION →</button>
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
        <h2>SPELL DRAFT</h2>
        <p>Each team picks one spell. It replaces the spell they are holding.</p>
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
                  <em>${held ? held.short.toUpperCase() : 'NO SPELL'}</em>
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
    <section class="phase question team-${team.id}" style="${teamStyle(meta)}">
      <div class="q-top">
        <div class="q-badges">
          <span class="badge" style="--c:${cat.color}">${svgIcon(cat.icon)} ${cat.short}</span>
          ${cur.jinxed ? `<span class="badge jinxed">${svgIcon('jinx')} JINXED</span>` : ''}
          <span class="badge pts">${cur.points} PTS</span>
        </div>
        ${state.settings.timer ? timerHTML(cur) : '<span class="timer-off">NO TIMER</span>'}
      </div>
      <div class="question-body">
        <div class="question-card">
          <p class="q-team">${esc(team.name).toUpperCase()} · ROUND ${state.round} / ${state.roundLimit}</p>
          <h2 class="question-text">${mathText(cur.q.q)}</h2>
        </div>
        <div class="answers">
          ${cur.q.a
            .map((ans, i) => {
              const removed = cur.removed.includes(i);
              const ansColor = ['#ff3b5c', '#1e6bff', '#ffd23f', '#18a96b'][i];
              return `
                <button type="button" class="answer ${removed ? 'removed' : ''}" data-action="answer"
                  data-index="${i}" style="--ans:${ansColor}" ${removed ? 'disabled' : ''}>
                  <span class="letter">${'ABCD'[i]}</span><span>${mathText(ans)}</span>
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
          <strong class="${correct ? 'good-text' : 'bad-text'}">${mathText(chosenText)}</strong>
        </div>
        <div class="reveal-card">
          <span class="kick">CORRECT ANSWER</span>
          <strong class="good-text">${mathText(correctText)}</strong>
          <span class="kick why-kick">WHY</span>
          <p>${mathText(cur.q.why)}</p>
        </div>
      </div>
      <div class="reveal-actions">
        <button type="button" class="btn primary next-btn" data-action="next">NEXT TEAM →</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Render: game over                                                   */
/* ------------------------------------------------------------------ */

function renderGameover() {
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.correct - a.correct);
  const tie = ranked[0].score === ranked[1].score;

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
      <div class="gameover-actions">
        ${
          tie
            ? '<button type="button" class="btn primary xl" data-action="sudden-death">SUDDEN DEATH ROUND →</button>'
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
          <p>Draft one spell, draw a random question from the selected units, then answer as a class. The teacher taps the answer the team commits to.</p>
        </div>
        <div>
          <h3>SCORE</h3>
          <p>Every question is worth 100 points on a 30-second timer. Each team drafts one spell before round 1, then one new spell after every 5 rounds.</p>
        </div>
        <div>
          <h3>SPELLS</h3>
          <p>Each team holds one spell at a time, shown as a single orb over the open palm. Using it frees the slot. Picking the same spell at a later draft keeps it; picking another replaces it. Jinx forces a hard question, still worth 100 points, with 15 seconds.</p>
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
      <p class="modal-sub">Scores, spells, and the current turn will be reset.</p>
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
      <p class="modal-sub">Who do you want to cast it on?</p>
      <div class="target-grid">
        ${state.teams
          .filter((t) => t.id !== actor.id)
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

app.addEventListener('input', (e) => {
  const input = e.target.closest('[data-team-name]');
  if (!input) return;
  const team = state.teams.find((t) => t.id === input.dataset.teamName);
  if (team) {
    team.name = input.value;
    save();
  }
});

app.addEventListener('contextmenu', (e) => {
  if (e.target.closest('input')) return;
  e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  save();
  if (state.phase === 'question' && state.current && state.current.timer.running) {
    state.current.timer.running = false;
    save();
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

if (params.get('fast') === '1') document.documentElement.classList.add('fast');

state = load() || defaultState();

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
