// Validate the Basado Bowl question bank.
// Run: node tools/validate-questions.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { QUESTIONS } from '../../questions/index.js';
import { CONFIG } from '../config.js';

const here = dirname(fileURLToPath(import.meta.url));
const loPath = resolve(here, '../../../../shared/lo_master.csv');
const rows = readFileSync(loPath, 'utf8').trim().split(/\r?\n/).slice(1);
const lo = new Map();
for (const row of rows) {
  const cols = row.split(',');
  lo.set(cols[0], { g6: Boolean(cols[3]?.trim()), g7: Boolean(cols[4]?.trim()) });
}

const unitIds = new Set(CONFIG.categories.map((c) => c.id));
const errors = [];
const newId = /^(SCI|KIN|FOR|ENE|ELE|WAV|MOM)[67]-/;
const seenIds = new Set();
const seenText = new Map();
const counts = {};
const indexCounts = [0, 0, 0, 0];

function fail(q, message) {
  errors.push(`${q.id || '(no id)'}: ${message}`);
}

const bannedSymbols = [
  [/\bW\s*=\s*mg(?![a-zA-Z])/, 'use F_{g} = mg for weight, not W = mg'],
  [/\bF\s*=\s*ma\b/, 'use F_{net} = ma for Newton’s second law'],
  [/\bF\s*=\s*μ\s*N\b/, 'use F_{f} = μF_{N} for friction'],
  [/\bv_i\b/, 'use v_{0} for initial velocity'],
  [/sqrt\(/, 'use √(...) instead of sqrt(...)'],
];

function checkSymbols(q) {
  const fields = [q.q, q.why, ...(Array.isArray(q.a) ? q.a : [])];
  for (const text of fields) {
    for (const [re, message] of bannedSymbols) {
      if (re.test(String(text ?? ''))) fail(q, message);
    }
  }
}

function checkLatex(q, value, field) {
  const text = String(value ?? '');
  let dollars = 0;
  let escaped = false;
  for (const char of text) {
    if (char === '\\') {
      escaped = !escaped;
      continue;
    }
    if (char === '$' && !escaped) dollars += 1;
    escaped = false;
  }
  if (dollars % 2 !== 0) fail(q, `unbalanced $ delimiters in ${field}`);
  const open = (text.match(/\\\(/g) || []).length;
  const close = (text.match(/\\\)/g) || []).length;
  if (open !== close) fail(q, `unbalanced \\( \\) delimiters in ${field}`);
}

function checkOneD(q) {
  const fields = [q.q, q.why, ...(Array.isArray(q.a) ? q.a : [])].map((v) => String(v ?? ''));
  if (['KIN', 'FOR', 'MOM'].includes(q.unit)) {
    for (const text of fields) {
      const northSouth = /\b(north|south)\b/i.test(text);
      const eastWest = /\b(east|west)\b/i.test(text);
      if (northSouth && eastWest) {
        fail(q, 'uses perpendicular compass axes; keep motion and forces 1-D');
        break;
      }
    }
  }
  if (['KIN', 'FOR', 'ENE'].includes(q.unit)) {
    for (const text of fields) {
      if (/(?:cos|sin)\s*\(/i.test(text)) {
        fail(q, 'uses a 2-D trig component; keep force and motion 1-D');
        break;
      }
    }
  }
  if (/negative acceleration/i.test(`${q.q} ${q.why}`)) {
    const statesDirection = /(positive direction|negative direction|velocity is negative|velocity is positive|moves? in the negative|moves? in the positive)/i.test(
      q.q
    );
    if (!statesDirection) {
      fail(q, 'negative acceleration must state the velocity direction');
    }
  }
}

function checkMath(q, value, field) {
  const text = String(value ?? '');
  let i = 0;
  while (i < text.length) {
    if ((text[i] === '_' || text[i] === '^') && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2);
      if (end === -1) return fail(q, `unclosed math markup in ${field}`);
      const inner = text.slice(i + 2, end);
      if (inner.includes('{') || inner.includes('}')) {
        return fail(q, `nested math markup in ${field}`);
      }
      i = end + 1;
      continue;
    }
    i += 1;
  }
}

for (const q of QUESTIONS) {
  if (!q || typeof q !== 'object') {
    errors.push('question is not an object');
    continue;
  }
  if (!q.id) fail(q, 'missing id');
  if (seenIds.has(q.id)) fail(q, 'duplicate id');
  seenIds.add(q.id);

  if (!unitIds.has(q.unit)) fail(q, `unknown unit ${q.unit}`);
  if (!['6', '7', 'both'].includes(q.grade)) fail(q, `invalid grade ${q.grade}`);
  if (![1, 2, 3].includes(q.level)) fail(q, `invalid level ${q.level}`);

  if (typeof q.q !== 'string' || !q.q.trim()) fail(q, 'empty question text');
  if (!Array.isArray(q.a) || q.a.length !== 4) fail(q, 'needs exactly four choices');
  if (q.a) q.a.forEach((a, i) => {
    if (typeof a !== 'string' || !a.trim()) fail(q, `empty choice ${'ABCD'[i]}`);
  });
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
    fail(q, `invalid correct index ${q.correct}`);
  }
  if (typeof q.why !== 'string' || !q.why.trim()) fail(q, 'empty why');

  if (q.image != null) {
    if (typeof q.image !== 'string' || !q.image.trim()) {
      fail(q, 'invalid image path');
    } else if (!q.image.startsWith('images/') || q.image.includes('..')) {
      fail(q, 'image must live under images/');
    } else if (!existsSync(resolve(here, '../../questions', q.image))) {
      fail(q, `missing image file ${q.image}`);
    }
    if (typeof q.imageAlt !== 'string' || !q.imageAlt.trim()) {
      fail(q, 'image is missing imageAlt text');
    }
  }

  if (q.lo) {
    const gradeInfo = lo.get(q.lo);
    if (!gradeInfo) fail(q, `unknown LO ${q.lo}`);
    else if (q.grade === '6' && !gradeInfo.g6) fail(q, `LO ${q.lo} is not available in Grade 6`);
    else if (q.grade === '7' && !gradeInfo.g7) fail(q, `LO ${q.lo} is not available in Grade 7`);
    else if (q.grade === 'both' && (!gradeInfo.g6 || !gradeInfo.g7)) {
      fail(q, `shared question uses grade-specific LO ${q.lo}`);
    }
  } else if (newId.test(q.id)) {
    fail(q, 'authored question is missing an LO tag');
  }

  checkSymbols(q);
  checkOneD(q);
  ['q', 'why'].forEach((field) => {
    checkMath(q, q[field], field);
    checkLatex(q, q[field], field);
  });
  if (Array.isArray(q.a)) q.a.forEach((a, i) => {
    const field = `choice ${'ABCD'[i]}`;
    checkMath(q, a, field);
    checkLatex(q, a, field);
  });

  const norm = String(q.q).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seenText.has(norm)) fail(q, `duplicate wording of ${seenText.get(norm)}`);
  else seenText.set(norm, q.id);

  const key = `${q.unit}-${q.grade}`;
  counts[key] = counts[key] || { total: 0, levels: { 1: 0, 2: 0, 3: 0 } };
  counts[key].total += 1;
  counts[key].levels[q.level] += 1;
  if (Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3) indexCounts[q.correct] += 1;
}

console.log('Questions:', QUESTIONS.length);
console.log('By unit and grade:');
for (const [key, value] of Object.entries(counts).sort()) {
  const [unit, grade] = key.split('-');
  console.log(`  ${unit.padEnd(3)} G${grade.padEnd(4)} ${String(value.total).padStart(3)}  (${value.levels[1]}/${value.levels[2]}/${value.levels[3]} easy/medium/hard)`);
}
console.log('Correct-index spread A/B/C/D:', indexCounts.join(' / '));
console.log('Authored bank questions:', QUESTIONS.filter((q) => newId.test(q.id)).length);
console.log('Authored hard questions:', QUESTIONS.filter((q) => newId.test(q.id) && q.level === 3).length);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) console.error('  -', error);
  process.exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
