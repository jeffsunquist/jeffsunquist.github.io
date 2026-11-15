// Validate the Basado Bowl question bank.
// Run: node tools/validate-questions.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { QUESTIONS } from '../questions.js';
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
const newId = /^(SCI|KIN|FOR|ENE|ELE|WAV)[67]-/;
const seenIds = new Set();
const seenText = new Map();
const counts = {};
const indexCounts = [0, 0, 0, 0];

function fail(q, message) {
  errors.push(`${q.id || '(no id)'}: ${message}`);
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

  ['q', 'why'].forEach((field) => checkMath(q, q[field], field));
  if (Array.isArray(q.a)) q.a.forEach((a, i) => checkMath(q, a, `choice ${'ABCD'[i]}`));

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

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) console.error('  -', error);
  process.exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
