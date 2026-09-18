#!/bin/bash
# Build all Slidev decks for deployment to GitHub Pages (user site at the root).
#
# Every deck is built TWICE, once per grade. The merged KIN decks contain Grade 6
# content plus Grade 7 enrichment slides (per-slide frontmatter `class: g7`), and
# scripts/grade_variant.py produces the per-grade source:
#
#   dist/g6/<slug>/   Grade 6 - G7 slides dropped, G7-only LOs filtered
#   dist/g7/<slug>/   Grade 7 - full deck
#
# Both variants get their `info:` grade label normalized ("Grade 6 Physics" /
# "Grade 7 Physics"). Shared decks (the SCI unit) are identical in both builds
# but are still built twice, because Slidev bakes the absolute `--base` path into
# every asset URL.
#
# The landing index.html has a "Lessons" section and a "Handouts" section, each
# split into a Grade 6 and a Grade 7 column, with the Aura tracker full width
# below. Handouts are classified by their `_g6` / `_g7` filename token (a file
# with neither token appears in both columns).
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

# The per-grade variants are written next to the decks as hidden dotfiles (so
# the `*.md` glob below ignores them) because Slidev resolves public/ and
# styles/ relative to the entry file's directory. Clean them up on exit.
tmp_files=()
cleanup() {
  for f in "${tmp_files[@]:-}"; do
    [ -n "$f" ] && rm -f "$f"
  done
}
trap cleanup EXIT

decks=()
for f in *.md; do
  case "$f" in
    AGENTS.md|README.md|slides.md) continue ;;   # docs / Slidev scaffold, not lesson decks
  esac
  slug="${f%.md}"
  decks+=("$slug")

  for grade in 6 7; do
    echo "Building $f -> /g$grade/$slug/ (Grade $grade)"
    variant=".$slug.g$grade.md"
    python3 scripts/grade_variant.py "$f" "$variant" --grade "$grade"
    tmp_files+=("$variant")
    npx slidev build "$variant" --base "/g$grade/$slug/" --router-mode hash --out "dist/g$grade/$slug"
  done
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

# Classify handouts by grade token: `_g6` -> Grade 6 only, `_g7` -> Grade 7
# only, neither -> both columns.
g6_handouts=()
g7_handouts=()
if [ -d pdfs ]; then
  shopt -s nullglob
  for pdf in pdfs/*.pdf; do
    name="${pdf##*/}"
    if [[ "$name" == *_g6* ]]; then
      g6_handouts+=("$name")
    elif [[ "$name" == *_g7* ]]; then
      g7_handouts+=("$name")
    else
      g6_handouts+=("$name")
      g7_handouts+=("$name")
    fi
  done
  shopt -u nullglob
fi

# Write the landing index.html.
{
  cat <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Physics Lesson Slides</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 40px auto;
           padding: 0 16px; color: #222; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.25rem; margin-top: 2.5rem; padding-bottom: 0.25rem;
         border-bottom: 1px solid #e5e7eb; }
    h3 { font-size: 1rem; margin: 0 0 0.5rem; color: #374151; }
    ul { line-height: 2; margin: 0; padding-left: 1.1rem; }
    a { color: #0b57d0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    @media (max-width: 600px) { .columns { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Physics Lesson Slides</h1>

  <h2>Lessons</h2>
  <div class="columns">
HTML

  for grade in g6 g7; do
    case "$grade" in
      g6) heading="Grade 6" ;;
      g7) heading="Grade 7" ;;
    esac
    printf '    <section>\n      <h3>%s</h3>\n      <ul>\n' "$heading"
    for slug in "${decks[@]}"; do
      label="$(printf '%s' "$slug" | tr '_-' ' ')"
      printf '        <li><a href="/%s/%s/">%s</a></li>\n' "$grade" "$slug" "$label"
    done
    printf '      </ul>\n    </section>\n'
  done

  printf '  </div>\n\n  <h2>Handouts</h2>\n  <div class="columns">\n'

  for grade in g6 g7; do
    case "$grade" in
      g6) heading="Grade 6"; handouts=("${g6_handouts[@]:-}") ;;
      g7) heading="Grade 7"; handouts=("${g7_handouts[@]:-}") ;;
    esac
    printf '    <section>\n      <h3>%s</h3>\n      <ul>\n' "$heading"
    for name in "${handouts[@]}"; do
      [ -z "$name" ] && continue
      base="${name%.pdf}"
      printf '        <li><a href="/pdfs/annotate.html?pdf=/pdfs/%s">%s</a></li>\n' "$name" "$base"
    done
    printf '      </ul>\n    </section>\n'
  done

  printf '  </div>\n'

  cat <<'HTML'

  <h2>Aura Tracker</h2>
  <div style="max-width:960px; height:360px;">
    <canvas id="auraChart"></canvas>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    const auraLabels = __AURA_LABELS__;
    const auraData = __AURA_DATA__;
    const bestFitData = (() => {
      const n = auraData.length;
      const sx = (n - 1) * n / 2;
      let sy = 0, sxy = 0, sx2 = 0;
      auraData.forEach((y, x) => { sy += y; sxy += x * y; sx2 += x * x; });
      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / n;
      return auraData.map((_, x) => intercept + slope * x);
    })();
    new Chart(document.getElementById('auraChart'), {
      type: 'line',
      data: {
        labels: auraLabels,
        datasets: [{
          data: auraData,
          borderColor: 'black',
          tension: 0.3,
          pointRadius: 3
        }, {
          label: 'line of best fit',
          data: bestFitData,
          borderColor: '#0b57d0',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Aura Intensity vs Time' },
          legend: { display: false }
        },
        scales: {
          y: {
            title: { display: true, text: 'Aura Intensity (cd)' },
            min: 0,
            max: 100
          },
          x: {
            title: { display: true, text: 'Day' }
          }
        }
      }
    });
  </script>
</body>
</html>
HTML
} > dist/index.html

# Inject the Aura tracker data parsed from data/aura.csv into the landing page.
sed -i \
  -e "s|__AURA_LABELS__|${aura_labels_js}|g" \
  -e "s|__AURA_DATA__|${aura_data_js}|g" \
  dist/index.html

echo "Deck build complete -> $(pwd)/dist"
