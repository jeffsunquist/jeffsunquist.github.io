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
  cat <<'HTML'
  </ul>

  <h2>Aura Tracker</h2>
  <div style="max-width:720px; height:360px;">
    <canvas id="auraChart"></canvas>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    const auraLabels = [
      'Aug 17','Aug 18','Aug 19','Aug 20','Aug 21','Aug 22','Aug 23','Aug 24',
      'Aug 25','Aug 26','Aug 27','Aug 28','Aug 29','Aug 30','Aug 31',
      'Sep 1','Sep 2','Sep 3','Sep 4'
    ];
    const auraData = [62, 64, 66, 66, 65, 65, 65, 62, 50, 50, 45, 50, 50, 50, 60, 48, 44, 42, 19];
    new Chart(document.getElementById('auraChart'), {
      type: 'line',
      data: {
        labels: auraLabels,
        datasets: [{
          data: auraData,
          borderColor: '#0b57d0',
          tension: 0.3,
          pointRadius: 3
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

echo "Deck build complete -> $(pwd)/dist"
