# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Each deck is served at `/<deck>/` (e.g. `/KIN-01_Position_and_Reference_Frames/`).
Grade-specific decks carry a `_G6` / `_G7` filename suffix:

- `KIN-02_Speed_and_Velocity_G6.md` → `/KIN-02_Speed_and_Velocity_G6/`
- `KIN-02_Speed_and_Velocity_G7.md` → `/KIN-02_Speed_and_Velocity_G7/`

Decks **without** a suffix are shared and appear in both grade columns. Merged
source decks are kept as `.md.hold` reference copies and are not built.

The landing `index.html` has a **Lessons** section and a **Handouts** section,
each split into a Grade 6 and a Grade 7 column, with the Aura tracker full width
below. Link text is the filename with underscores shown as spaces and hyphens
kept (e.g. `KIN-01_Position_and_Reference_Frames` → "KIN-01 Position and
Reference Frames"). Handouts are classified by their `_G6` / `_G7` filename
token (a file with neither token appears in both columns).

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
