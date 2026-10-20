# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Each deck is served at `/<deck>/` (e.g. `/KIN-01_Position_and_Reference_Frames_G6/`).
Grade-specific decks carry a `_G6` / `_G7` filename suffix:

- `KIN-02_Speed_and_Velocity_G6.md` → `/KIN-02_Speed_and_Velocity_G6/`
- `KIN-02_Speed_and_Velocity_G7.md` → `/KIN-02_Speed_and_Velocity_G7/`

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
**Lessons** section and a **Handouts** section, each split into a Grade 6 and a
Grade 7 column, plus an **Aura Tracker** section pairing the aura chart with an
element tier list (from `data/element_tier.csv`). Lesson cards show an
icon, the lesson code, "Lesson N of M", the topic, and the deck's objective,
with an All / Grade 6 / Grade 7 filter. Handouts are
classified by their `_G6` / `_G7` filename token (a file with neither token
appears in both columns), and include the A4 double-sided **formula sheets**
(`pdfs/Formula_Sheet_G6.pdf` / `_G7.pdf`, built from `reference/formula-sheet-*.md`).

There is also a **Sims & Games (WIP)** section listing standalone p5.js physics
simulations and browser games. Each one lives in `sims/<slug>/` (a
self-contained page plus a `sketch.js` ES module) and is described by
`data/sims.csv` or `data/games.csv` (`slug,title,grade,description`). The whole
`sims/` tree is copied to `dist/sims/` at build time; p5 is vendored at
`sims/vendor/p5.min.js`. `sims/lift-force/` is the arena shooter: A/D move, W
jumps (twice for a double), the mouse aims and fires, `1`–`4` swap weapons.

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
