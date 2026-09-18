# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Each deck is served at `/<deck>/`. Grade-specific decks carry a `-g6` / `-g7`
filename suffix:

- `kin-lesson-2-speed-and-velocity-g6.md` → `/kin-lesson-2-speed-and-velocity-g6/`
- `kin-lesson-2-speed-and-velocity-g7.md` → `/kin-lesson-2-speed-and-velocity-g7/`

Decks **without** a suffix are shared and appear in both grade columns. Merged
source decks are kept as `.md.hold` reference copies and are not built.

The landing `index.html` has a **Lessons** section and a **Handouts** section,
each split into a Grade 6 and a Grade 7 column, with the Aura tracker full width
below. Handouts are classified by their `_g6` / `_g7` filename token (a file
with neither token appears in both columns).

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
