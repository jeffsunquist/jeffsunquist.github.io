# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Each deck is served at `/<deck>/` (e.g. `/KIN-L01_Position_and_Reference_Frames_G6/`).
Deck names follow the handout scheme `{TOPIC}-{KIND}{NN}_{Title}[_G6|_G7]`
(`L` = lesson; see `AGENTS.md`), so a deck never collides with a learning
outcome ID (`FOR-02`) and pairs with its worksheet (`FOR-W02`). Old
`{TOPIC}-{NN}_…` URLs redirect to the new path.

Grade-specific decks carry a `_G6` / `_G7` filename suffix:

- `KIN-L02_Speed_and_Velocity_G6.md` → `/KIN-L02_Speed_and_Velocity_G6/`
- `KIN-L02_Speed_and_Velocity_G7.md` → `/KIN-L02_Speed_and_Velocity_G7/`

Decks **without** a suffix are shared and appear in both grade columns. Merged
source decks are kept as `.md.hold` reference copies and are not built.

The **KIN**, **FOR**, and **SCI** decks are composed from standalone slide files:
each content slide lives one-file-per-slide under `slides/kin/`, `slides/for/`,
`slides/ene/`, and `slides/sci/`, and a deck lists the slides it uses as `src:`
imports (Slidev's built-in slide-import feature). A slide shared by Grade 6 and
Grade 7 — or across decks — is a single file referenced by each deck, so editing
it updates them all — no duplication. Recap slides are fragments too: a lesson's
closing recap and the *same* recap opening the next lesson are one shared file
(`slides/<topic>/recap-<topic>.md`, heading `## Review: <Topic>`). Only the title
slide and its objective stay inline in the deck. Add, remove, or reorder a
content slide by editing the `src:` list in the relevant deck file. The textbook
builder resolves these imports when it compiles the PDFs.

The landing `index.html` is rendered from `scripts/index.template.html` and has a
**Lessons** section split into Grade 6 and Grade 7 columns, plus an **Aura
Tracker** section pairing the aura chart with an element tier list (from
`data/element_tier.csv`). Lesson cards show an icon, lesson code, "Lesson N of
M", topic, and objective, with an All / Grade 6 / Grade 7 filter. PDFs under
`pdfs/` remain local reference files and are no longer published. The floating
page links next to the filter open the Class Clock (`/clock/`), the 3D Club
listing (`/3d-club/`), and a generic PDF annotator (`/pdf/`) that can open a
local file, a `?pdf=` link, or any PDF published under `3d-club/`, with pen,
line, arrow, eraser, colour, undo/redo, and print tools. Annotations autosave in
the browser on that device.

There is also a **Tutorials** section of animated worked examples (a problem,
then the solution steps on a draggable timeline) and a **Sims & Demos**
section listing standalone p5.js simulations, browser demos, and a classroom
game. Each one lives in `sims/<slug>/` (a self-contained page plus, for sims, a
`sketch.js` ES module) and is described by `data/sims.csv` or
`data/demos.csv` (`slug,title,grade,description`; demos take an optional fifth
`kind` column, set to `Game` for Basado Bowl). The whole
`sims/` tree is copied to `dist/sims/` at build time; p5 is vendored at
`sims/vendor/p5.min.js`. `sims/lift-force/` is the arena shooter: A/D move, W
jumps (twice for a double), the mouse aims and fires, `1`–`4` swap weapons.
`sims/delta-v/` is the top-down John Wick chase: balance engine force against
drag, match the target car's speed and position, then press Space to make the
jump before the 60-second heat catches up. `sims/momentum-rescue/` is the
gravity-and-collisions rescue game.

`sims/basado-bowl/` is **Basado Bowl**, the teacher-run three-team trivia game:
The Blue, Red, and Yellow teams stand on floating candy platforms, each with a single item
orb hovering over an open palm. Teams draft Shield, Double Down, Magic Missile,
and Jinx — one item before round 1, then a new item after every 5 rounds — and
use them to help themselves or sabotage another team across the arena. A team
holds only one item at a time.
The teacher chooses Grade 6 or Grade 7 and any of seven units at setup:
Scientific Inquiry, Kinematics, Forces, Simple Machines / Energy, Electricity,
Waves, and Momentum.
Every turn draws a random question from those units, and every question is worth
100 points on a 30-second timer. Grade 6-only questions never appear in a Grade 7
game, and Grade 7-only questions never appear in a Grade 6 game; shared
questions appear in both. Waves and Momentum are Grade 7 only. The bank holds
682 questions, including 250 new quantitative hard problems. Formula rendering uses self-hosted
KaTeX in questions, choices, and explanations. Each new match uses a fresh
random seed, so question selection changes between games. Tied leaders go to sudden death,
which uses only tied teams, hard questions, and a 15-second timer; no items can
be used there. There is no
shop and no star currency. Questions live in
`sims/basado-bowl/questions/` and `sims/basado-bowl/questions/bank/`, the
characters and pixel sprites in `sims/basado-bowl/characters.js`, and all
balance values (points, timers, round default) in `sims/basado-bowl/config.js`. Add `?dev=1` for the debug bar,
`?fresh=1` to clear the saved match, `?phase=draft` to open the first draft, and
`?phase=question` to jump straight into a question while editing.

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
