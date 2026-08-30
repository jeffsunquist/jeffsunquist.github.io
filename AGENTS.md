# slides

Slidev-based lesson decks for G6–G7 Physics. One markdown file per lesson;
each is a self-contained Slidev deck (frontmatter + `---`-separated slides).
This file is the authoritative reference for creating lesson decks.

## Commands

```bash
npx slidev <deck>.md          # live presentation (or: npm run dev)
npx slidev build <deck>.md    # static site build (or: npm run build)
npx slidev export <deck>.md   # PDF / PPTX export (or: npm run export)
```

## Deployment (GitHub Pages)

Decks are published to **`https://www.basado.org`** (user site
`jeffsunquist/jeffsunquist.github.io`, custom domain `www.basado.org`). Each
deck is served at `/<deck-filename-without-.md>/` and a root `index.html` links
to them all.

- **Build:** `bash scripts/deploy.sh` builds every deck with
  `--base /<slug>/ --router-mode hash` into `dist/<slug>/` (Slidev rewrites the
  leading-slash `public/` image refs against the base automatically), writes
  `dist/index.html`, and copies the repo's `CNAME` into `dist/`. `dist/` is
  gitignored.
- **Auto-deploy:** `.github/workflows/deploy.yml` is the official Slidev
  Pages-Actions workflow (`configure-pages` → `upload-pages-artifact` →
  `deploy-pages`, source "GitHub Actions"). It runs `bash scripts/deploy.sh`
  on every push to `main`. No PAT or cross-repo push needed.
- **Setup:** this repo's Settings → Pages → Source is "GitHub Actions"; the
  `CNAME` (`www.basado.org`) lives in the repo root; DNS `CNAME` `www` →
  `jeffsunquist.github.io`; HTTPS enabled.
- **Adding a deck:** drop the `.md` in this folder (named per the convention
  below) — the script picks it up automatically. `AGENTS.md`/`README.md` are
  never treated as decks.

## Deck file naming

- Lesson decks: `sci-lesson-{N}-{slug}.md` — e.g.
  `sci-lesson-1-observations.md`, `sci-lesson-4-problem-solving.md`.
- The unit's intro deck: `welcome-lesson-1-class-introduction.md`.
- `slides.md` is the course-map index deck. **Always update its "The Decks"
  table** when you add or rename a lesson.

## Frontmatter

Every deck starts with:

```yaml
---
theme: default
colorSchema: light
title: Scientific Inquiry — <Topic>
info: |
  Grade 7 Physics · Lesson N of 6
learning_outcomes:
  - SCI-10
  - SCI-11
  ...
---
```

Rules:

- `theme: default`, `colorSchema: light` always — classroom light-mode look.
- **LO IDs come from the physics project's `shared/lo_master.csv`** — never
  invent IDs. Tag every lesson deck with the LOs it covers so they stay
  traceable to the exam bank. The lesson's LOs should match the companion
  worksheet's FRQ fragments (e.g. the L3 deck and
  `worksheet_sci_lesson3_base_derived_classwork` both tag MEAS-01..04,
  MEAS-08).

## Deck structure — slide flow

Every lesson deck follows this slide order:

### 1. Title

```md
# Scientific Inquiry — Observations

Lesson 1 of 6
```

### 2. CJ opener (Communication Journal)

The daily agenda slide. Heading is `## Physics` (or `## CJ`), with the four
journal lines as bullets:

```md
## Physics

- HW: get a calculator with fractions
- IC: observations
- A: N/A
- Do Now: cats or dogs, which pet is objectively better?
```

- `IC` = In Class (today's topic), `HW` = Homework, `A` = Announcements.
- Keep this slide first (or immediately after the title) so it stays the day's
  opener.

### 3. Learning Objective

```md
## Learning Objective

Students will be able to differentiate between qualitative and quantitative
observations, and between objective and subjective statements.
```

Either a single "Students will be able to …" sentence or a short bullet list
of LO-derived verbs.

### 4. Review of the previous lesson

**Required** for every lesson except the first of the unit. A single concise
recap slide of the previous lesson's main points, placed **after the Learning
Objective and before any new content**:

```md
## Review: Observations

- **Qualitative**: descriptive, non-numerical data
- **Quantitative**: numerical, measured data
- A **scientific statement** is objective, testable, and falsifiable.
```

Keep it short (3–6 bullets or a small table) — it recaps, it does not reteach.

### 5. Fresh content

One concept per slide; heading is the concept name:

```md
## Qualitative and Quantitative Statements

- **Qualitative**: descriptive, non-numerical data
- **Quantitative**: numerical, measured data
```

- Bold key terms (`**term**`).
- Use tables for SI units, prefix ladders, and side-by-side comparisons.
- Use KaTeX math inline `$...$` and display `$$...$$`; use `\cancel{}` for unit
  conversions.
- Reveal parts with `<v-click>` / `<v-clicks>` (click to advance).
- Images live in `public/` and are referenced with a leading slash:
  `<img src="/qualitative-pikachu.png" width="240" />`. Excalidraw SVGs
  (`*.excalidraw.svg`) are used directly and render fine in Slidev.

### 6. Guided practice

Worked examples and exercises:

```md
## Example 1

A train travels $180 \text{ km}$ in $2 \text{ h}$. What is its speed?
```

Long examples are split across step slides (see L4's 4-step solve: list the
quantities → pick the equation → plug in and solve → check units/direction),
with each step on its own slide or revealed via `<v-click>`. Exercises get a
`## Exercise N` heading.

### 7. Summary

A brief recap near the end of the deck:

```md
## Review the Structure

1. What am I given? What am I finding?
2. What equation connects them?
3. Plug in and solve.
4. Check the units and direction (if applicable).
```

(Also seen as `## Review: The Metric System`, `## Rule of Science`.)

### 8. Exit Ticket

```md
## Exit Ticket

Write one new statement that is objective and qualitative.
```

A single prompt; follow-up questions can be revealed with `<v-clicks>`, and an
image can accompany the prompt.

## Slidev conventions

- Slides are separated by `---` lines; the first frontmatter block is the deck
  config. A single blank slide start is used for the agenda (before the first
  `---`).
- Global styling in `styles/index.css` (auto-loaded by Slidev convention,
  `./style.css` / `./styles/index.css`); keep classroom light-mode look — don't
  add per-deck style overrides.
- Interactive elements use `<v-click>` / `<v-clicks>` / `<kbd>`.
- Math uses KaTeX inline `$...$` and display `$$...$$`.
- Markdown tables are styled globally (striped, bordered) — no extra work.
- `slides.md` is the course-map index deck listing every lesson.

## Build & verify

```bash
# 1. Preview while writing
npx slidev sci-lesson-N-<slug>.md

# 2. Check LO IDs against the master list
rg -n "sci-lesson-N" slides.md   # course-map updated?

# 3. Optional: export
npx slidev export sci-lesson-N-<slug>.md
```

Verify the deck loads, the LO IDs exist in the physics project's
`shared/lo_master.csv`, and the companion worksheet (if any) shares the same
LOs.
