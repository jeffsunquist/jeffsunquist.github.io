#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_textbook.sh — build the Quarter-1 textbook PDFs.
#
# The lesson decks are the single source of truth. This:
#   1. runs textbook/build_textbook.mjs (decks -> flowing HTML -> A4 PDF via
#      Chromium; video slides skipped), and
#   2. copies the PDFs into pdfs/ with the `_G6` / `_G7` grade tokens so the
#      landing page lists them and the Pages workflow publishes them.
#
# The lesson decks and public/ are never modified. Run from anywhere.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

node textbook/build_textbook.mjs

mkdir -p pdfs
for g in g6 g7; do
    G="${g^^}"
    cp "textbook/build/textbook_q1_${g}.pdf" "pdfs/Textbook_Q1_${G}.pdf"
    echo "published pdfs/Textbook_Q1_${G}.pdf"
done
