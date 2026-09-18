#!/usr/bin/env python3
"""Write a grade-specific variant of a merged lesson deck.

Usage:
    python3 scripts/grade_variant.py <source.md> <output.md> --grade {6,7}

The merged KIN decks contain Grade 6 content plus Grade 7 enrichment slides
marked with per-slide frontmatter `class: g7`. The site builds two grade-specific
versions of every deck:

  --grade 6   drop every `class: g7` slide, drop Grade 7-only LO ids from the
              frontmatter `learning_outcomes:`, and relabel the `info:` grade to
              "Grade 6 Physics".
  --grade 7   keep every slide and every LO, and relabel the `info:` grade to
              "Grade 7 Physics".

It prints how many slides the Grade 6 variant dropped.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
G7_ONLY_LOS_FILE = SCRIPT_DIR / "g7_only_los.txt"

# A per-slide frontmatter block that marks a Grade 7 slide.
G7_RE = re.compile(r"^\s*class\s*:.*\bg7\b", re.IGNORECASE)
# Grade labels in the deck's `info:` frontmatter.
GRADE67_RE = re.compile(r"Grade\s*6\s*[-\u2013]\s*7\s*Physics", re.IGNORECASE)
GRADE7_RE = re.compile(r"Grade\s*7\s*Physics", re.IGNORECASE)
# A slide separator: exactly `---` plus optional spaces/tabs. Only spaces/tabs
# are consumed (NOT newlines), so the blank line that normally follows a
# separator is preserved - Slidev treats a `---` line as the start of per-slide
# frontmatter when the next line is non-blank.
SEP_RE = re.compile(r"(?m)^---[ \t]*$")
LO_HEADER_RE = re.compile(r"^learning_outcomes\s*:\s*$")
LO_ITEM_RE = re.compile(r"^(\s*-\s*)([A-Z]+-\d+)\s*$")


def load_g7_only_los() -> set[str]:
    if not G7_ONLY_LOS_FILE.exists():
        print(
            f"warning: {G7_ONLY_LOS_FILE} not found; not filtering learning_outcomes",
            file=sys.stderr,
        )
        return set()
    ids: set[str] = set()
    for line in G7_ONLY_LOS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            ids.add(line)
    return ids


def split_deck(text: str) -> tuple[str, list[str]] | None:
    """Return (top frontmatter, body segments) or None if there is no frontmatter."""
    parts = SEP_RE.split(text)
    if len(parts) < 2:
        return None
    return parts[1], parts[2:]


def strip_g7_slides(segments: list[str]) -> tuple[list[str], int]:
    """Drop G7 frontmatter segments and the slide content that follows them."""
    kept: list[str] = []
    dropped = 0
    i = 0
    while i < len(segments):
        if G7_RE.search(segments[i]):
            dropped += 1
            i += 2
        else:
            kept.append(segments[i])
            i += 1
    return kept, dropped


def relabel_info(top: str, grade: int) -> str:
    if grade == 6:
        top = GRADE67_RE.sub("Grade 6 Physics", top)
        top = GRADE7_RE.sub("Grade 6 Physics", top)
    else:
        top = GRADE67_RE.sub("Grade 7 Physics", top)
    return top


def filter_los(top: str, g7_only: set[str]) -> str:
    if not g7_only:
        return top
    out: list[str] = []
    in_los = False
    for line in top.split("\n"):
        if in_los:
            m = LO_ITEM_RE.match(line)
            if m:
                if m.group(2) in g7_only:
                    continue
                out.append(line)
                continue
            in_los = False
        if LO_HEADER_RE.match(line):
            in_los = True
        out.append(line)
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--grade", type=int, choices=(6, 7), required=True)
    args = ap.parse_args()

    src, dst = Path(args.src), Path(args.dst)
    text = src.read_text(encoding="utf-8")
    split = split_deck(text)
    if split is None:
        dst.write_text(text, encoding="utf-8")
        print(f"{src.name}: no frontmatter; copied unchanged -> {dst}")
        return 0

    top, segments = split
    dropped = 0
    if args.grade == 6:
        segments, dropped = strip_g7_slides(segments)
        top = filter_los(top, load_g7_only_los())
    top = relabel_info(top, args.grade)

    out = "---" + top + "".join("---" + seg for seg in segments)
    dst.write_text(out, encoding="utf-8")
    print(f"{src.name}: grade {args.grade} variant (dropped {dropped} G7 slide(s)) -> {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
