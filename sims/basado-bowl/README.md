# Basado Bowl

Teacher-run, three-team physics trivia with original chibi pixel characters.
Miku, Teto, and Akita stand on floating candy platforms. Each team drafts
**spells**, answers questions, and casts at rivals across the arena. The teacher
chooses the units once at setup; every turn draws a random question from those
units. Every question is worth 100 points and runs on a 30-second timer.

Published at **`/sims/basado-bowl/`** and listed as a **Game** card in the
landing page's Sims & Demos section.

## Run locally

From the repo root:

```bash
python3 -m http.server 8000
# open http://localhost:8000/sims/basado-bowl/
```

No build step, no npm packages. Edit a file, refresh.

## Characters and order

| Turn | Character | Team colour | Look |
|---|---|---|---|
| 1 | **Miku** | Blue | Teal twin-tails |
| 2 | **Teto** | Red | Red drill twin-tails |
| 3 | **Akita** | Yellow | Blonde side ponytail, yellow ribbon, school uniform |

The sprites in `characters.js` are original pixel-art interpretations drawn as
SVG pixel grids. They are not official artwork or assets.

## The three spells

| Spell | Type | Effect |
|---|---|---|
| **Shield** | Passive | Blocks the next attack cast at the team. Breaks when it blocks. |
| **Double Down** | Self | Double the points from the next correct answer. |
| **Jinx** | Attack | Cast at a team: their next question is Hard, 100 pts, 15 s. |

## One spell at a time

- Before round 1, every team drafts **one spell**.
- After every 5 completed rounds, every team drafts **one new spell**:
  after round 5 (before round 6) and after round 10 (before round 11).
  A 5-round game has only the opening draft.
- A team holds **one spell at a time**, shown as a single orb over the open palm.
- Picking the same spell again keeps it. Picking a different spell replaces the
  held spell; an unused replaced spell is discarded.
- Spells are not locked for the whole game, so they can be drafted again later.
- Using a spell empties the slot. Shield stays held until it blocks an attack.
- The prep screen and question tray show the single held spell, or an empty slot
  after it has been used.

## Scoring

Points only. Every question is worth **100 points**, regardless of its internal
difficulty. Double Down doubles that to 200. Jinx still cuts the target to 15
seconds. There are no stars or shop currency.

## Question bank and grades

The game ships with **412 questions**:

- 82 curated questions in `questions/{sci,kin,for,ene}.js`.
- 330 authored questions in `questions/bank/{sci,kin,for,ene,ele,wav}.js`.

Setup offers **Grade 6** and **Grade 7** only. There is no mixed mode.

| Unit | Grade 6 | Grade 7 |
|---|---|---|
| Scientific Inquiry (`SCI`) | 50 | 50 |
| Kinematics (`KIN`) | 48 | 52 |
| Forces (`FOR`) | 50 | 54 |
| Simple Machines / Energy (`ENE`) | 46 | 30 |
| Electricity (`ELE`) | 30 | 30 |
| Waves (`WAV`) | 0 | 30 |

A Grade 6 game draws only questions tagged `grade: '6'` plus shared
`grade: 'both'` questions. A Grade 7 game draws only `'7'` plus `'both'`.
Grade-specific questions never cross over. **Waves is Grade 7 only** because
every WAV learning objective in `shared/lo_master.csv` is Grade 7. In Grade 6
the Waves tile shows 0 and is disabled; switching to Grade 7 enables it and
adds it to the default selection.

Each authored question carries an `lo` tag. `tools/validate-questions.mjs`
checks every LO against `shared/lo_master.csv` so a Grade 6 question cannot use
a Grade 7-only objective, or the reverse.

## Math markup

Authored questions use a tiny markup for real subscripts and superscripts:

- `v_{0}` renders as v with a subscript 0.
- `m/s^{2}` renders as m/s with a superscript 2.
- `F_{net}`, `m_{1}`, `10^{-3}`, and `x^{2}` all work.

Unicode symbols stay as-is: `×`, `÷`, `≈`, `≤`, `≥`, `√`, `Ω`, `μ`, `Δ`, `θ`,
`λ`, `°`, and `→`. `mathText()` escapes the text first, then turns `_{...}`
into `<sub>` and `^{...}` into `<sup>`. The validator rejects unbalanced markup.

## Where to change things

| What | File |
|---|---|
| Question points, timer, round default, draft interval | `config.js` |
| Team colours, names, characters | `config.js` → `teams` |
| Spells and descriptions | `config.js` → `spells` |
| Characters and pixel sprites | `characters.js` |
| Curated questions | `questions/{sci,kin,for,ene}.js` |
| Authored bank | `questions/bank/{sci,kin,for,ene,ele,wav}.js` |
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

### Change the spells

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
| `?phase=question` | Seed a match with starter spells and jump to a question. |
| `?fast=1` | Skip cast flights and disable CSS animation. |

Console helpers: `BB.state`, `BB.addScore('miku', 100)`, `BB.phase('draft')`,
`BB.question()`, `BB.reset()`.

The match autosaves to `localStorage` under `basado-bowl:v7`. Bump `VERSION` in
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
basado-bowl,Basado Bowl,both,Three teams answer physics trivia and cast spells to help or sabotage.,Game
```

`Game` selects the amber card accent and `public/icons/game.svg`. For a fast
landing-page iteration that leaves existing dist decks alone:

```bash
SKIP_DECKS=1 bash scripts/deploy.sh
```
