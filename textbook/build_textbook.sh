#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_textbook.sh — build the Quarter-1 textbook PDFs.
#
# The lesson decks are the single source of truth. This runs
# textbook/build_textbook.mjs, which builds three 2-column books and copies
# them into pdfs/: Textbook_SCI.pdf (shared), Textbook_KIN_G6.pdf, and
# Textbook_KIN_G7.pdf (the `_G6` / `_G7` tokens place them in the right
# landing-page column).
#
# The lesson decks and public/ are never modified. Run from anywhere.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

node textbook/build_textbook.mjs

# The old combined Quarter-1 books are superseded by the separate KIN/SCI books.
rm -f pdfs/Textbook_Q1_G6.pdf pdfs/Textbook_Q1_G7.pdf
