#!/bin/bash
# Build all Slidev decks for deployment to GitHub Pages (user site at the root).
#
# Every *.md deck is built to dist/<slug>/ with base /<slug>/ and hash routing;
# Slidev rewrites its asset paths (JS/CSS and the public/ images referenced with
# a leading slash) against that base automatically.
#
# Grade-specific decks carry a `_G6` / `_G7` filename suffix and appear only in
# the matching column of the landing page; decks without a suffix are shared and
# appear in both columns.
#
# The landing page is rendered from scripts/index.template.html: a "Lessons"
# section and a "Handouts" section, each split into a Grade 6 and a Grade 7
# column, with the Aura tracker full width below. Lesson cards are derived from
# each deck's frontmatter (`title:`, `info:`) and its "## Learning Objective"
# sentence; handouts are classified by their `_G6` / `_G7` filename token (a
# file with neither token appears in both columns).
#
# Used by .github/workflows/deploy.yml and for manual local builds.
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

# Carry the custom domain into the published artifact.
if [ -f CNAME ]; then
  cp CNAME dist/CNAME
fi

# Publish the annotatable PDFs (pdfs/ -> dist/pdfs/). Empty is fine.
if [ -d pdfs ]; then
  cp -r pdfs dist/pdfs
fi

# Self-hosted handwriting font for the landing page (public/fonts/ -> dist/fonts/).
if [ -d public/fonts ]; then
  mkdir -p dist/fonts
  cp -r public/fonts/. dist/fonts/
fi

for f in *.md; do
  case "$f" in
    AGENTS.md|README.md|slides.md) continue ;;   # docs / Slidev scaffold, not lesson decks
  esac
  slug="${f%.md}"
  echo "Building $f -> /$slug/"
  npx slidev build "$f" --base "/$slug/" --router-mode hash --out "dist/$slug"
done

# Aura tracker data is a build-time input from data/aura.csv (date,value rows).
# Build JS array literals; empty CSV -> empty chart.
clean() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  s="${s%\"}"
  s="${s#\"}"
  printf '%s' "$s"
}
aura_labels_js='[]'
aura_data_js='[]'
if [ -f data/aura.csv ]; then
  labels=''
  values=''
  first=1
  while IFS=, read -r label value; do
    label="$(clean "${label:-}")"
    value="$(clean "${value:-}")"
    [ -z "$label" ] && continue
    [ "$label" = "date" ] && continue
    if [ "$first" -eq 0 ]; then
      labels="$labels,"
      values="$values,"
    fi
    first=0
    labels="$labels\"$label\""
    values="$values$value"
  done < data/aura.csv
  aura_labels_js="[$labels]"
  aura_data_js="[$values]"
fi

# ---------------------------------------------------------------------------
# Landing page data
# ---------------------------------------------------------------------------

# Escape a value for embedding in an inline <script> JSON literal.
json_str() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  s="${s//$'\r'/}"
  s="${s//$'\t'/ }"
  s="${s//</\\u003c}"
  s="${s//>/\\u003e}"
  s="${s//&/\\u0026}"
  printf '"%s"' "$s"
}

# Extract the deck's objective sentence from its "## Objectives" slide (the
# old "## Learning Objective" heading is tolerated). Wrapped lines are joined.
deck_objective() {
  awk '
    /^## Objectives?[[:space:]]*$/ { inobj = 1; next }
    /^## Learning Objective/ { inobj = 1; next }
    inobj && (/^## / || /^---[[:space:]]*$/) { exit }
    inobj {
      if ($0 ~ /[^[:space:]]/) {
        gsub(/^[[:space:]]+/, "")
        out = (out == "" ? $0 : out " " $0)
      } else if (out != "") {
        exit
      }
    }
    END { if (out != "") print out }
  ' "$1"
}

lessons_json='['
first=1
for f in *.md; do
  case "$f" in
    AGENTS.md|README.md|slides.md) continue ;;
  esac
  slug="${f%.md}"
  code="$(printf '%s' "$slug" | cut -d_ -f1)"

  title="$(sed -n 's/^title:[[:space:]]*//p' "$f" | head -n1)"
  topic="${title##*— }"
  [ "$topic" = "$title" ] && topic="$title"
  topic="$(printf '%s' "$topic" | sed -e 's/[[:space:]]*$//')"

  info="$(awk '/^info: \|/{getline; print; exit} /^info:/{sub(/^info:[[:space:]]*/,""); print; exit}' "$f" \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  lesson_num="$(printf '%s' "$info" | sed -n 's/.*Lesson \([0-9][0-9]*\) of.*/\1/p')"
  lesson_total="$(printf '%s' "$info" | sed -n 's/.*of \([0-9][0-9]*\).*/\1/p')"
  lesson_num="${lesson_num:-0}"
  lesson_total="${lesson_total:-0}"

  case "$slug" in
    *_G6) g6=true; g7=false ;;
    *_G7) g6=false; g7=true ;;
    *)    g6=true; g7=true ;;
  esac

  objective="$(deck_objective "$f")"
  [ -z "$objective" ] && objective="$topic"
  objective="$(printf '%s' "$objective" \
    | sed -e 's/\*\*//g' -e 's/_//g' -e 's/`//g' -e 's/[[:space:]]*$//')"

  [ "$first" -eq 1 ] || lessons_json+=','
  first=0
  lessons_json+="{\"slug\":$(json_str "$slug"),\"url\":$(json_str "/$slug/"),\"code\":$(json_str "$code"),\"topic\":$(json_str "$topic"),\"lesson\":$lesson_num,\"total\":$lesson_total,\"g6\":$g6,\"g7\":$g7,\"objective\":$(json_str "$objective")}"
done
lessons_json+=']'

# Handouts from pdfs/; `_G6` / `_G7` token selects the grade column, otherwise both.
handouts_json='['
first=1
if [ -d pdfs ]; then
  shopt -s nullglob
  for pdf in pdfs/*.pdf; do
    name="${pdf##*/}"
    label="$(printf '%s' "${name%.pdf}" | tr '_' ' ')"
    case "$name" in
      *_G6*) g6=true; g7=false ;;
      *_G7*) g6=false; g7=true ;;
      *)     g6=true; g7=true ;;
    esac
    [ "$first" -eq 1 ] || handouts_json+=','
    first=0
    handouts_json+="{\"name\":$(json_str "$name"),\"label\":$(json_str "$label"),\"url\":$(json_str "/pdfs/annotate.html?pdf=/pdfs/$name"),\"g6\":$g6,\"g7\":$g7}"
  done
  shopt -u nullglob
fi
handouts_json+=']'

# Render the template. Bash parameter substitution is literal, so the JSON is
# injected verbatim (no sed `&` / delimiter pitfalls).
template="$(cat scripts/index.template.html)"
template="${template//__LESSONS_JSON__/$lessons_json}"
template="${template//__HANDOUTS_JSON__/$handouts_json}"
template="${template//__AURA_LABELS__/$aura_labels_js}"
template="${template//__AURA_DATA__/$aura_data_js}"
printf '%s\n' "$template" > dist/index.html

echo "Deck build complete -> $(pwd)/dist"
