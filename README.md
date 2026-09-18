# Physics Lesson Slides

G6–G7 Physics lesson decks built with [Slidev](https://sli.dev).

Visit the site at **https://www.basado.org/**

Every deck is built twice — once per grade — and served under a grade path:

- `/g6/<deck>/` — Grade 6 build (Grade 7 enrichment slides dropped, Grade 7-only
  learning outcomes filtered)
- `/g7/<deck>/` — Grade 7 build (full deck)

The merged KIN decks contain Grade 6 content plus Grade 7 enrichment slides
marked with per-slide frontmatter `class: g7`; `scripts/grade_variant.py`
produces the per-grade source and normalizes each build's `info:` label to
"Grade 6 Physics" / "Grade 7 Physics".

The landing `index.html` has a **Lessons** section and a **Handouts** section,
each split into a Grade 6 and a Grade 7 column, with the Aura tracker full width
below. Handouts are classified by their `_g6` / `_g7` filename token (a file
with neither token appears in both columns).

The decks are built and published automatically by the Pages workflow in
`.github/workflows/deploy.yml` — just commit and push to `main`.
