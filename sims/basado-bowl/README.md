# Basado Bowl

Teacher-run, three-team physics trivia with original chibi pixel art.
The Blue, Red, and Yellow teams stand on floating candy platforms. Each team
drafts **items**, answers questions, and uses them against rivals across the
arena. The teacher chooses the units once at setup; every turn draws a random
question from those units. Every question is worth 100 points and runs on a
30-second timer.

Published at **`/sims/basado-bowl/`** and listed as a **Game** card in the
landing page's Sims & Demos section.

## Run locally

From the repo root:

```bash
python3 -m http.server 8000
# open http://localhost:8000/sims/basado-bowl/
```

No build step, no npm packages. Edit a file, refresh.

## Noise gate

The top bar has a microphone button and a live **NOISE** meter. Tapping the mic
button turns the gate on or off at any time; dragging the marker on the meter
sets the loudness threshold. The threshold is saved, but the gate starts off
after a reload so the browser microphone permission is always tied to a tap.

When the gate is on, both **DRAW A QUESTION** on the prep screen and **NEXT
TEAM** on the reveal screen stay locked until the room is below the threshold
for about 1.2 seconds. Turning the gate off immediately unlocks both buttons.

- If the microphone is denied or unavailable, the gate stays off and the game
  remains playable.
- Audio is processed in memory only; it is never recorded, stored, or sent.
- Microphone access requires HTTPS on the deployed site (or `localhost`).
- This is a relative classroom loudness meter, not a calibrated SPL meter. The
  microphone will also hear the teacher and game sound effects, so place the
  laptop toward the class and tune the threshold in the room.

The header shows two match clocks:

- **Total time** next to the round pill, running from START MATCH.
- **Loud time** next to the noise meter, counting only while the mic is active
  and the room is over the threshold.

Both pause when the browser tab is hidden. Total time freezes when a final
winner is decided; loud time stops with it. The game-over screen shows **TOTAL
TIME** and **ABOVE THRESHOLD** (or **MIC OFF** if the microphone was never
used) alongside the current threshold.

## Teams and order

| Turn | Team | Colour | Look |
|---|---|---|---|
| 1 | **Blue** | Blue | Teal twin-tails |
| 2 | **Red** | Red | Red drill twin-tails |
| 3 | **Yellow** | Yellow | Blonde side ponytail, yellow ribbon, school uniform |

The sprites in `characters.js` are original pixel art drawn as SVG pixel grids.
They are not official artwork or assets.

## The four items

| Item | Type | Effect |
|---|---|---|
| **Shield** | Passive | Block one spell. |
| **Double Down** | Self | Double the points from the next correct answer. |
| **Magic Missile** | Attack | Target loses 100 points. |
| **Jinx** | Attack | Target loses 10 s for 5 turns. |

## One item at a time

- Before round 1, every team drafts **one item**.
- After every 5 completed rounds, every team drafts **one new item**:
  after round 5 (before round 6) and after round 10 (before round 11).
  A 5-round game has only the opening draft.
- A team holds **one item at a time**, shown as a single orb over the open palm.
- Picking the same item again keeps it. Picking a different item replaces the
  held item; an unused replaced item is discarded.
- Items are not locked for the whole game, so they can be drafted again later.
- Using an item empties the slot. Shield stays held until it blocks an attack.
- Jinx reduces the target’s timer from 30 s to 20 s for five normal turns.
  Recasting refreshes it to five turns.
- The prep screen and question tray show the single held item, or an empty slot
  after it has been used.

## Scoring

Points only. Every question is worth **100 points**, regardless of its internal
difficulty. Double Down doubles that to 200. Magic Missile removes 100 points
from the target, stopping at 0. Jinx cuts the target’s next five normal
questions to **20 seconds**. Shield blocks either attack and breaks. There are
no stars or shop currency.

If the top score is tied, **Sudden Death** includes only the teams tied for the
lead. Those rounds draw **hard questions only** and use a **15-second** timer.
**No items can be used during sudden death**, and any active Double Down or Jinx
effect is cleared. Non-contenders stay visible but are dimmed and cannot be
targeted.

## Question bank and grades

The game ships with **755 questions**:

- 82 curated questions in `questions/{sci,kin,for,ene}.js`.
- 600 authored questions in `questions/bank/{sci,kin,for,ene,ele,wav,mom}.js`.
- 73 approved FOR handout MCQs in `questions/bank/for-approved.js`.
- 250 of the authored questions are new quantitative hard problems; every
  unit/grade has 10 easy, 10 medium, and 30 hard questions.

Setup offers **Grade 6** and **Grade 7** only. There is no mixed mode.

| Unit | Grade 6 | Grade 7 |
|---|---|---|
| Scientific Inquiry (`SCI`) | 70 | 70 |
| Kinematics (`KIN`) | 68 | 72 |
| Forces (`FOR`) | 131 | 143 |
| Simple Machines / Energy (`ENE`) | 66 | 50 |
| Electricity (`ELE`) | 50 | 50 |
| Waves (`WAV`) | 0 | 50 |
| Momentum (`MOM`) | 0 | 50 |

A Grade 6 game draws only questions tagged `grade: '6'` plus shared
`grade: 'both'` questions. A Grade 7 game draws only `'7'` plus `'both'`.
Grade-specific questions never cross over.

Each match generates a fresh random seed from the current time, browser
randomness, and a persistent match counter. Questions do not repeat until the
selected unit/grade pool is exhausted; after a reshuffle the last question is
excluded from the first new draw. Reloading a saved match keeps the same seed
and sequence. **Waves is Grade 7 only** because
every WAV learning objective in `shared/lo_master.csv` is Grade 7. In Grade 6
the Waves tile shows 0 and is disabled; switching to Grade 7 enables it and
adds it to the default selection.

Each authored question carries an `lo` tag. `tools/validate-questions.mjs`
checks every LO against `shared/lo_master.csv` so a Grade 6 question cannot use
a Grade 7-only objective, or the reverse.

### Approved FOR handout MCQs

`questions/bank/for-approved.js` is generated from the approved FOR MCQs used in
the scored `FOR-W01`–`FOR-W06` and `FOR-D01`–`FOR-D06` handouts. It contains 73
questions (75 approved unique questions minus two exact duplicates already
covered by the bank).

- Explanations and image alt text live in `questions/for-approved.meta.yaml`.
- Diagram questions use self-contained SVGs from `questions/images/for/`.
- Regenerate from `handouts_builder/` with:

```bash
.venv/bin/python tools/export_basado_bowl.py
```

The generator drops known duplicate questions, validates that every imported
question has an explanation, renders TikZ diagrams with `pdflatex` + `mutool`,
and shuffles choices deterministically so the correct answer is not always A.

## Math markup

Questions, choices, and explanations render math with self-hosted **KaTeX**.
Published builds load it from `/katex/`; the source server falls back to
`node_modules/katex/dist/`.

Use inline LaTeX with `$...$`:

- `$F_{g} = mg$`
- `$\Delta x$`
- `$v_{0}$`
- `$\frac{1}{2}mv^{2}$`
- `$F_{f} = \mu F_{N}$`

Display math with `$$...$$` is also supported.

For compatibility, existing `_{...}` / `^{...}` markup and common units such as
`m/s^{2}` are also detected and rendered through KaTeX automatically. If KaTeX
cannot load, the game falls back to the original subscript/superscript renderer.
The validator rejects unbalanced `$...$` and `\(...\)` delimiters.

## Formula symbols

Questions use the same symbols as the formula sheets and lesson slides:

| Quantity | Symbol form |
|---|---|
| Weight | `F_{g} = mg` |
| Newton’s second law | `F_{net} = ma`, `a = F_{net}/m` |
| Friction | `F_{f} = μF_{N}` |
| Average velocity | `Δx/t` |
| Displacement | `Δx = x - x_{0}` |
| Acceleration | `a = (v - v_{0})/t` |
| Motion equations | `v = v_{0} + at`, `Δx = v_{0}t + 1/2 at^{2}`, `v^{2} = v_{0}^{2} + 2aΔx` |
| Work | `W = Fd` in Grade 6, `W = FΔx` in Grade 7 |
| Power | `P = W/t` |
| Potential energy | `U = mgh` in Grade 6, `U_{g} = mgh` in Grade 7 |
| Kinetic energy | `K = 1/2 mv^{2}` |
| Mechanical energy | `E = K + U` |
| Gravitation | `F_{G} = G m_{1}m_{2}/r^{2}` |
| Coulomb’s law | `F_{e} = k|q_{1}||q_{2}|/r^{2}` |
| Charge | `q = ne` |
| Momentum | `p = mv` |
| Change in momentum | `Δp = mv - mv_{0}` |
| Impulse | `J = FΔt = Δp` |
| Momentum units | `kg·m/s`, `N·s` |
| Ohm’s law | `I = V/R` |
| Waves | `f = 1/T`, `v = λf` |
| Moments | `τ = Fd`, `F_{1}d_{1} = F_{2}d_{2}` |

The validator rejects `W = mg`, `F = ma`, `F = μN`, `v_i`, and `sqrt(...)`.

## One-dimensional motion

Translational motion and net-force questions stay on a single axis. Any
question involving a negative sign states the positive direction or the sign of
the velocity, so “negative acceleration” is never treated as automatically
slowing down. Perpendicular-axis wording and angled force components are
rejected. Moment/rotational questions are separate and intentionally not
one-dimensional.

## Where to change things

| What | File |
|---|---|
| Question points, timer, round default, draft interval | `config.js` |
| Team colours, names, characters | `config.js` → `teams` |
| Items and descriptions | `config.js` → `spells` |
| Characters and pixel sprites | `characters.js` |
| Curated questions | `questions/{sci,kin,for,ene}.js` |
| Authored bank | `questions/bank/{sci,kin,for,ene,ele,wav}.js` |
| Approved FOR handout bank | `questions/bank/for-approved.js` |
| FOR handout explanations / image alt text | `questions/for-approved.meta.yaml` |
| FOR handout diagrams | `questions/images/for/*.svg` |
| Validate the bank | `node tools/validate-questions.mjs` |
| Layout and animation styling | `style.css` |
| Flow, draft, casting, effects | `game.js` |

### Add a question

Append an object to the right unit file. New questions should be
grade-specific and carry an `lo` tag:

```js
{
  id: 'KIN6-031',         // unique
  grade: '6',             // '6' or '7'; 'both' stays shared
  unit: 'KIN',            // SCI, KIN, FOR, ENE, ELE, or WAV
  level: 2,               // internal only: 1 easy, 2 medium, 3 hard
  lo: 'KIN-25',           // one logical_id from shared/lo_master.csv
  q: 'A car travels 60 m in 6 s. What is its speed?',
  a: ['6 m/s', '10 m/s', '60 m/s', '360 m/s'],
  correct: 1,             // zero-based index into a[]
  why: 'Speed = distance / time = 60 / 6 = 10 m/s.',
}
```

Use `_{...}` for subscripts and `^{...}` for superscripts, for example
`v_{0}` and `m/s^{2}`. Run `node tools/validate-questions.mjs` from this
folder after editing.

### Change the items

Add or edit an object in `CONFIG.spells`:

```js
{
  id: 'shield',
  name: 'Shield',
  short: 'Shield',
  icon: 'shield',      // key in ICON_PATHS in game.js
  color: '#41e0ff',
  type: 'passive',     // 'passive' | 'self' | 'attack'
  desc: 'Full description.',
  draftDesc: 'Short draft-screen description.',
}
```

Then handle the effect in `useSpell()` / `castSpell()` in `game.js`.

## Dev flags

| URL | Effect |
|---|---|
| `?dev=1` | Floating dev bar: scores, draft, question, reveal, end, reset. |
| `?fresh=1` | Clear the saved match and start at setup. |
| `?phase=draft` | Seed a match and open the first draft. |
| `?phase=question` | Seed a match with starter items and jump to a question. |
| `?fast=1` | Skip cast flights and disable CSS animation. |

Console helpers: `BB.state`, `BB.addScore('blue', 100)`, `BB.phase('draft')`,
`BB.question()`, `BB.reset()`.

The match autosaves to `localStorage` under `basado-bowl:v12`. Bump `VERSION` in
`game.js` when the state shape changes so an old save is ignored.

## Fonts

The two self-hosted fonts live in `fonts/` and are licensed under the SIL Open
Font License 1.1:

- **Lilita One** — Juan Pablo del Peral.
- **Nunito** — Vernon Adams, Cyreal, and Jacques Le Bailly.

They were downloaded from Google Fonts. See `fonts/README.md` for source links.

## Landing page

`data/demos.csv` carries an optional fifth column:

```csv
basado-bowl,Basado Bowl,both,Three teams answer physics trivia and use items to help or sabotage.,Game
```

`Game` selects the amber card accent and `public/icons/game.svg`. For a fast
landing-page iteration that leaves existing dist decks alone:

```bash
SKIP_DECKS=1 bash scripts/deploy.sh
```
