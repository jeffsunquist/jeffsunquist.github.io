#!/bin/bash
# Build all Slidev decks for deployment to GitHub Pages (user site at the root).
#
# Each deck is built to dist/<slug>/ with base /<slug>/ and hash routing; Slidev
# rewrites its asset paths (JS/CSS and the public/ images referenced with a
# leading slash) against that base automatically. A simple dist/index.html links
# to every deck, and the repo's CNAME (custom domain) is copied into dist/ so
# the GitHub Pages deployment keeps serving www.basado.org.
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

decks=()
for f in *.md; do
  case "$f" in
    AGENTS.md|README.md) continue ;;   # docs, not decks
  esac
  slug="${f%.md}"
  decks+=("$slug")
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
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto;
           padding: 0 16px; color: #222; }
    h1 { font-size: 1.6rem; }
    ul { line-height: 2; }
    a { color: #0b57d0; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Physics Lesson Slides</h1>
  <ul>
HTML
  for slug in "${decks[@]}"; do
    label="$(printf '%s' "$slug" | tr '_-' ' ')"
    printf '    <li><a href="/%s/">%s</a></li>\n' "$slug" "$label"
  done
  printf '  </ul>\n'
  if [ -d pdfs ]; then
    shopt -s nullglob
    pdf_files=(pdfs/*.pdf)
    shopt -u nullglob
    if [ "${#pdf_files[@]}" -gt 0 ]; then
      printf '\n  <h2>Handouts</h2>\n  <ul>\n'
      for pdf in "${pdf_files[@]}"; do
        name="${pdf##*/}"
        base="${name%.pdf}"
        printf '    <li><a href="/pdfs/annotate.html?pdf=/pdfs/%s">%s</a></li>\n' "$name" "$base"
      done
      printf '  </ul>\n'
    fi
  fi
  cat <<'HTML'
  <h2>Aura Tracker</h2>
  <div style="max-width:720px; height:360px;">
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
          borderColor: '#0b57d0',
          tension: 0.3,
          pointRadius: 3
        }, {
          label: 'line of best fit',
          data: bestFitData,
          borderColor: 'black',
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
