# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Each deck is served at `/<deck>/` (e.g. `/KIN-01_Position_and_Reference_Frames/`).
Grade-specific decks carry a `_G6` / `_G7` filename suffix:

- `KIN-02_Speed_and_Velocity_G6.md` → `/KIN-02_Speed_and_Velocity_G6/`
- `KIN-02_Speed_and_Velocity_G7.md` → `/KIN-02_Speed_and_Velocity_G7/`

Decks **without** a suffix are shared and appear in both grade columns. Merged
source decks are kept as `.md.hold` reference copies and are not built.

The landing `index.html` is rendered from `scripts/index.template.html` and has a
**Lessons** section and a **Handouts** section, each split into a Grade 6 and a
Grade 7 column, plus an **Aura Tracker** section pairing the aura chart with an
element tier list (from `data/element_tier.csv`). Lesson cards show an
icon, the lesson code, "Lesson N of M", the topic, and the deck's objective,
with an All / Grade 6 / Grade 7 filter. Handouts are
classified by their `_G6` / `_G7` filename token (a file with neither token
appears in both columns).

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
