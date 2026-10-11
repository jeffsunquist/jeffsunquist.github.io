// =============================================================================
// build_textbook.mjs — build the Quarter-1 textbook (flowing document).
//
// The lesson decks are the single source of truth. This script:
//   1. reads each deck, strips frontmatter, splits slides, drops video slides,
//   2. strips Slidev-only syntax (<v-click>, <Transform>, ...),
//   3. renders each slide to HTML with markdown-it (+ KaTeX),
//   4. wraps each slide in <section class="slide"> (break-inside: avoid),
//   5. writes one HTML document per grade and prints it to A4 PDF with
//      Playwright Chromium (served over a small local HTTP server so /public
//      assets and fonts resolve).
//
// Nothing in the lesson decks or public/ is modified. Run:
//     node textbook/build_textbook.mjs [--no-pdf]
// =============================================================================

import MarkdownIt from 'markdown-it'
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
import katex from 'katex'
import { chromium } from 'playwright-chromium'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { createReadStream, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'textbook', 'build')
const WITH_PDF = !process.argv.includes('--no-pdf')
// Spike: render a 2-column, atomic-slide book and print natively (no Paged.js)
// so we can measure page counts. Orientation via SPIKE_ORIENT=landscape.
const SPIKE = process.argv.includes('--spike')
const ORIENT = process.env.SPIKE_ORIENT === 'landscape' ? 'landscape' : 'portrait'
// SPIKE_FIGSPAN: 0 = keep figures in-column; N = span a figure's slide when
// the image aspect ratio is >= N (a value like 3 keeps only the widest graphs).
const SPIKE_FIGSPAN = parseFloat(process.env.SPIKE_FIGSPAN || '0') || 0
const SPIKE_TAG = SPIKE_FIGSPAN > 0 ? `_figspan${SPIKE_FIGSPAN}` : ''

// --------------------------------------------------------------------------
// SCI-only textbook: portrait, 2-column content, own title + TOC pages,
// printed natively (no Paged.js) then paginated in a post-step.
const SCI_DECKS = [
  'SCI-01_Observations',
  'SCI-02_Measurements_and_Metric_Prefixes',
  'SCI-03_Base_and_Derived_Units',
  'SCI-04_Problem_Solving',
  'SCI-05_Graphs',
  'SCI-06_Scientific_Method',
]
const SCI_BOOK = {
  key: 'sci',
  outStem: 'textbook_sci',
  coverTitle: 'Physics',
  coverSub: 'Scientific Inquiry',
  coverGrade: 'Grade 6–7',
  coverRule: 'Quarter 1',
  units: [['Unit 1 — Scientific Inquiry', SCI_DECKS]],
}

// --------------------------------------------------------------------------
// Which decks make up each grade's textbook, grouped by unit.
const BOOKS = {
  g6: [
    ['Unit 1 — Scientific Inquiry', [
      'SCI-01_Observations',
      'SCI-02_Measurements_and_Metric_Prefixes',
      'SCI-03_Base_and_Derived_Units',
      'SCI-04_Problem_Solving',
      'SCI-05_Graphs',
      'SCI-06_Scientific_Method',
    ]],
    ['Unit 2 — Kinematics', [
      'KIN-01_Position_and_Reference_Frames',
      'KIN-02_Speed_and_Velocity_G6',
      'KIN-03_Acceleration_G6',
      'KIN-04_Motion_Graphs_G6',
    ]],
  ],
  g7: [
    ['Unit 1 — Scientific Inquiry', [
      'SCI-01_Observations',
      'SCI-02_Measurements_and_Metric_Prefixes',
      'SCI-03_Base_and_Derived_Units',
      'SCI-04_Problem_Solving',
      'SCI-05_Graphs',
      'SCI-06_Scientific_Method',
    ]],
    ['Unit 2 — Kinematics', [
      'KIN-01_Position_and_Reference_Frames',
      'KIN-02_Speed_and_Velocity_G7',
      'KIN-03_Acceleration_G7',
      'KIN-04_Motion_Graphs_G7',
      'KIN-05_Area_Under_Velocity_Time_G7',
    ]],
  ],
}

// --------------------------------------------------------------------------
// Markdown-it + KaTeX (markdown-it-katex style rules).
function katexPlugin(md) {
  const isValidDelim = (state, pos) => {
    const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
    const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1
    let canOpen = true
    let canClose = true
    // Closing delimiter cannot follow whitespace or precede a digit.
    if (prev === 0x20 || prev === 0x09 || (next >= 0x30 && next <= 0x39))
      canClose = false
    // Opening delimiter cannot be followed by whitespace.
    if (next === 0x20 || next === 0x09)
      canOpen = false
    return { canOpen, canClose }
  }

  const mathInline = (state, silent) => {
    if (state.src[state.pos] !== '$') return false
    let res = isValidDelim(state, state.pos)
    if (!res.canOpen) {
      if (!silent) state.pending += '$'
      state.pos += 1
      return true
    }
    const start = state.pos + 1
    let match = start
    while ((match = state.src.indexOf('$', match)) !== -1) {
      let pos = match - 1
      while (state.src[pos] === '\\') pos -= 1
      if ((match - pos) % 2 === 1) break
      match += 1
    }
    if (match === -1) {
      if (!silent) state.pending += '$'
      state.pos = start
      return true
    }
    if (match - start === 0) {
      if (!silent) state.pending += '$$'
      state.pos = start + 1
      return true
    }
    res = isValidDelim(state, match)
    if (!res.canClose) {
      if (!silent) state.pending += '$'
      state.pos = start
      return true
    }
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.markup = '$'
      token.content = state.src.slice(start, match)
    }
    state.pos = match + 1
    return true
  }

  const mathBlock = (state, start, end, silent) => {
    let pos = state.bMarks[start] + state.tShift[start]
    let max = state.eMarks[start]
    if (pos + 2 > max) return false
    if (state.src.slice(pos, pos + 2) !== '$$') return false
    pos += 2
    let firstLine = state.src.slice(pos, max)
    let found = false
    let lastLine = ''
    if (firstLine.trim().slice(-2) === '$$') {
      firstLine = firstLine.trim().slice(0, -2)
      found = true
    }
    let next = start
    while (!found) {
      next += 1
      if (next >= end) break
      pos = state.bMarks[next] + state.tShift[next]
      max = state.eMarks[next]
      if (pos < max && state.tShift[next] < state.blkIndent) break
      if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
        const lastPos = state.src.slice(0, max).lastIndexOf('$$')
        lastLine = state.src.slice(pos, lastPos)
        found = true
      }
    }
    state.line = next + 1
    const token = state.push('math_block', 'math', 0)
    token.block = true
    token.content = `${firstLine && firstLine.trim() ? `${firstLine}\n` : ''}`
      + state.getLines(start + 1, next, state.tShift[start], true)
      + (lastLine && lastLine.trim() ? lastLine : '')
    token.map = [start, state.line]
    token.markup = '$$'
    return true
  }

  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.after('blockquote', 'math_block', mathBlock,
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
  md.renderer.rules.math_inline = (tokens, idx) =>
    katex.renderToString(tokens[idx].content, { throwOnError: false })
  md.renderer.rules.math_block = (tokens, idx) =>
    `<p class="katex-block">${katex.renderToString(tokens[idx].content, { displayMode: true, throwOnError: false })}</p>\n`
}

const md = new MarkdownIt({ html: true, linkify: false, typographer: false })
  .use(katexPlugin)
  .use(MarkdownItGitHubAlerts)

// --------------------------------------------------------------------------
// Deck → slides.
const SEP_RE = /\n---[ \t]*\n/
const FRONTMATTER_ONLY_RE = /^[A-Za-z0-9_-]+:\s*.*$/

function splitHeadmatter(text) {
  if (!text.startsWith('---')) return text
  const end = text.indexOf('\n---', 3)
  return end === -1 ? text : text.slice(end + 4)
}

function isFrontmatterOnly(chunk) {
  const lines = chunk.split('\n').filter(ln => ln.trim())
  return lines.length > 0 && lines.every(ln => FRONTMATTER_ONLY_RE.test(ln))
}

function stripSlidev(s) {
  return s
    // Deck assets are referenced with a leading slash (Slidev's public/ dir);
    // remap them to /public/ so they resolve when served from the repo root.
    .replace(/(<img\b[^>]*\bsrc=")\//gi, '$1/public/')
    .replace(/<v-clicks?[^>]*>/gi, '')
    .replace(/<\/v-clicks?>/gi, '')
    .replace(/<Transform[^>]*>/gi, '')
    .replace(/<\/Transform>/gi, '')
    .replace(/<div[^>]*v-click[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    .replace(/<center>/gi, '<div class="center">')
    .replace(/<\/center>/gi, '</div>')
    .replace(/\s+v-click(\.[a-z]+)?="[^"]*"/gi, '')
    .replace(/\s+v-click\b/gi, '')
}

// Rewrite <img> tags: drop the presentation width/height (so SVGs render at
// their intrinsic size and rasters get a resolution-based width set in-page),
// and tag each as fig-svg / fig-raster. The column width (max-width:100%) is
// an absolute cap and always wins.
function tagImages(html) {
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const src = (tag.match(/\bsrc="([^"]*)"/i) || [])[1] || ''
    const cls = /\.svg(\?|#|$)/i.test(src) ? 'fig-svg' : 'fig-raster'
    const stripped = tag
      .replace(/\s+class="[^"]*"/gi, '')
      .replace(/\s+width="[^"]*"/gi, '')
      .replace(/\s+height="[^"]*"/gi, '')
    return stripped.replace(/<img\b/i, `<img class="${cls}"`)
  })
}

async function deckSlides(stem) {
  const source = await readFile(path.join(ROOT, `${stem}.md`), 'utf8')
  const body = splitHeadmatter(source).replace(/^\n+/, '')
  const slides = []
  for (const raw of body.split(SEP_RE)) {
    const chunk = raw.trim()
    if (!chunk || isFrontmatterOnly(chunk)) continue
    if (/<iframe/i.test(chunk)) continue
    // Print-only: drop presentation practice/review slides.
    const h = chunk.match(/^#{1,4}[ \t]+(.+)$/m)
    if (h && /^(practice|review)\b/i.test(h[1].trim())) continue
    slides.push(stripSlidev(chunk))
  }
  return slides
}

async function deckTitle(stem) {
  const source = await readFile(path.join(ROOT, `${stem}.md`), 'utf8')
  const end = source.startsWith('---') ? source.indexOf('\n---', 3) : -1
  const fm = end === -1 ? '' : source.slice(3, end)
  const m = fm.match(/^title:\s*(.+)$/m)
  return m ? m[1].trim() : stem
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// --------------------------------------------------------------------------
const COVER = grade => `
<section class="cover">
  <h1>Physics</h1>
  <p class="sub">Quarter 1 Textbook</p>
  <p class="sub">Grade ${grade}</p>
  <p class="rule">Scientific Inquiry &amp; Kinematics</p>
  <p class="lines">Name: ____________________&nbsp;&nbsp;Class: __________&nbsp;&nbsp;Date: __________</p>
</section>`

const STYLE = `
@font-face { font-family:'Patrick Hand'; font-weight:400; font-display:block;
  src:url('/public/fonts/PatrickHand-Regular.ttf') format('truetype'); }
@page { size: A4; margin: 12mm; }
html { font-size: 10pt; }
body { margin:0; color:#1f2937; line-height:1.35;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
h1,h2,h3,h4 { font-family:'Patrick Hand', sans-serif; line-height:1.15; color:#111827; margin:.5em 0 .2em; }
h1 { font-size:1.55rem; } h2 { font-size:1.3rem; } h3 { font-size:1.15rem; } h4 { font-size:1.0rem; }
h2,h3 { break-after:avoid; }
p { margin:.3em 0; } ul,ol { margin:.3em 0 .3em 1.2em; padding:0; } li { margin:.08em 0; }
a { color:#374151; }
strong { color:#111827; }
img { display:block; margin:.4em auto; height:auto; max-width:100%; max-height:80mm; break-inside:avoid; }
img.fig-svg { width:auto; }
img.fig-raster { }
.center { text-align:center; }
table { border-collapse:collapse; margin:.4em auto; font-size:.9rem; break-inside:avoid; }
th,td { border:1px solid #e5e7eb; padding:.15em .55em; text-align:left; }
thead th { background:#f3f4f6; color:#111827; }
tbody tr:nth-child(even) { background:#f9fafb; }
blockquote { background:#f9fafb; border-left:3px solid #d1d5db; margin:.5em 0; padding:.4em .8em; color:#374151; }
.markdown-alert { --cal-color:#64748b; --cal-bg:#f8fafc; border:1px solid #e5e7eb;
  border-left:5px solid var(--cal-color); background:var(--cal-bg); border-radius:6px;
  padding:.5em .85em; margin:.5em 0; break-inside:avoid; }
.markdown-alert > :first-child { margin-top:0; } .markdown-alert > :last-child { margin-bottom:0; }
.markdown-alert-title { display:flex; align-items:center; gap:.4em; font-weight:700;
  color:var(--cal-color); margin:0 0 .1em; line-height:1.2;
  font-family:'Patrick Hand', sans-serif; font-size:.85rem; }
.markdown-alert-title .octicon { fill:currentColor; width:1em; height:1em; flex:0 0 auto; }
.markdown-alert-title + p,
.markdown-alert-title + ul,
.markdown-alert-title + ol { margin-top:.15em; }
.markdown-alert p, .markdown-alert li { font-size:.85rem; line-height:1.3; }
.markdown-alert-note      { --cal-color:#64748b; --cal-bg:#f8fafc; }
.markdown-alert-tip       { --cal-color:#0d9488; --cal-bg:#f0fdfa; }
.markdown-alert-important { --cal-color:#d97706; --cal-bg:#fffbeb; }
.markdown-alert-warning   { --cal-color:#ea580c; --cal-bg:#fff7ed; }
.markdown-alert-caution   { --cal-color:#dc2626; --cal-bg:#fef2f2; }
.katex-block { text-align:center; margin:.45em 0; }
.slide { break-inside: auto; margin:0 0 3mm; }
.unit { break-before: auto; margin:.2em 0 4mm; }
.unit h1 { font-size:2.4rem; border-bottom:2px solid #d1d5db; padding-bottom:.1em; }
.cover { break-after:page; height:246mm; display:flex; flex-direction:column;
  justify-content:center; text-align:center; }
.cover h1 { font-size:3.2rem; margin:0; }
.cover .sub { font-family:'Patrick Hand', sans-serif; font-size:1.5rem; color:#6b7280; margin:.1em 0; }
.cover .rule { margin-top:1.2em; color:#374151; }
.cover .lines { margin-top:2.5em; color:#374151; }

/* Table of contents */
.toc { break-after: page; }
.toc h1 { font-size:1.9rem; }
.toc ul { list-style:none; margin:.4em 0 0; padding:0; }
.toc li.u { margin-top:.9em; }
.toc li.c { margin-left:1.4em; }
.toc a { display:flex; align-items:baseline; text-decoration:none; color:#111827;
  border-bottom:1px dotted #cbd5e1; padding:.18em 0; }
.toc a .num { margin-left:auto; color:#6b7280; font-variant-numeric:tabular-nums; }
.toc .u > a { font-family:'Patrick Hand', sans-serif; font-weight:700; font-size:1.15rem; }

/* Page numbers are injected per Paged.js page box (see printPdf). */
.pagedjs_page { position: relative; }
.pagedjs-page-number { position:absolute; left:0; right:0; bottom:6mm; text-align:center;
  color:#6b7280; font-size:.85rem; }
`

// Production 2-column book style: the flowing STYLE plus column rules.
const COLS_STYLE = STYLE + `
/* 2-column portrait content: atomic slides, spanning chapter/unit headings. */
.cols { column-count:2; column-gap:8mm; }
.slide { break-inside:avoid; }
.slide.span { column-span:all; }
.unit { column-span:all; }
`

const SPIKE_STYLE = `
@font-face { font-family:'Patrick Hand'; font-weight:400; font-display:block;
  src:url('/public/fonts/PatrickHand-Regular.ttf') format('truetype'); }
@page { size: A4 ${ORIENT}; margin: 12mm; }
html { font-size: 10pt; }
body { margin:0; color:#1f2937; line-height:1.35;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
h1,h2,h3,h4 { font-family:'Patrick Hand', sans-serif; line-height:1.15; color:#111827; margin:.5em 0 .2em; }
h1 { font-size:1.55rem; } h2 { font-size:1.3rem; } h3 { font-size:1.15rem; } h4 { font-size:1.0rem; }
h2,h3 { break-after:avoid; }
p { margin:.3em 0; } ul,ol { margin:.3em 0 .3em 1.2em; padding:0; } li { margin:.08em 0; }
img { display:block; margin:.4em auto; height:auto; max-width:100%; max-height:80mm; break-inside:avoid; }
img.fig-svg { width:auto; }
.center { text-align:center; }
table { border-collapse:collapse; margin:.4em auto; font-size:.9rem; break-inside:avoid; }
th,td { border:1px solid #e5e7eb; padding:.15em .55em; text-align:left; }
.cals { }
.markdown-alert { border:1px solid #e5e7eb; border-left:5px solid #64748b; background:#f8fafc;
  border-radius:6px; padding:.5em .85em; margin:.5em 0; break-inside:avoid; }
.markdown-alert > :first-child { margin-top:0; } .markdown-alert > :last-child { margin-bottom:0; }
.markdown-alert-title { display:flex; align-items:center; gap:.4em; font-weight:700;
  color:#64748b; margin:0 0 .1em; line-height:1.2;
  font-family:'Patrick Hand', sans-serif; font-size:.85rem; }
.markdown-alert-title .octicon { fill:currentColor; width:1em; height:1em; flex:0 0 auto; }
.markdown-alert-title + p,
.markdown-alert-title + ul,
.markdown-alert-title + ol { margin-top:.15em; }
.markdown-alert p, .markdown-alert li { font-size:.85rem; line-height:1.3; }
.katex-block { text-align:center; margin:.45em 0; }
.cover { break-after:page; text-align:center; }
.cover h1 { font-size:2.6rem; }
.toc { break-after:page; }
.cols { column-count:2; column-gap:8mm; }
.slide { break-inside:avoid; margin:0 0 3mm; }
.slide.span { column-span:all; }
.unit { column-span:all; margin:.2em 0 3mm; }
.unit h1 { font-size:1.8rem; border-bottom:2px solid #d1d5db; padding-bottom:.1em; }
`

function imgAspect(src) {
  try {
    const f = path.join(ROOT, src)          // src is '/public/...'
    const s = readFileSync(f, 'utf8').slice(0, 3000)
    let m = s.match(/viewBox="([-\d. ]+)"/)
    if (m) { const v = m[1].split(/\s+/).map(Number); return v[3] ? v[2] / v[3] : 0 }
    m = s.match(/width="([\d.]+)[a-z]*"\s+height="([\d.]+)/)
    return m && parseFloat(m[2]) ? parseFloat(m[1]) / parseFloat(m[2]) : 99
  } catch { return 99 }
}

function firstImgSpan(rendered) {
  const m = rendered.match(/<img[^>]*src="([^"]+)"/)
  return m ? imgAspect(m[1]) >= SPIKE_FIGSPAN : false
}

async function build(grade) {
  const toc = ['<section class="toc"><h1>Contents</h1><ul>']
  const body = []
  let unitNo = 0
  for (const [unit, decks] of BOOKS[grade]) {
    unitNo += 1
    const unitId = `unit-${unitNo}`
    toc.push(`<li class="u"><a href="#${unitId}">${unit}<span class="num"></span></a></li>`)
    body.push(`<section class="unit" id="${unitId}"><h1>${unit}</h1></section>`)
    for (const deck of decks) {
      const chId = slug(deck)
      toc.push(`<li class="c"><a href="#${chId}">${await deckTitle(deck)}<span class="num"></span></a></li>`)
      body.push(`<section class="chapter" id="${chId}">`)
      let firstSlide = true
      for (const slide of await deckSlides(deck)) {
        const rendered = tagImages(md.render(slide))
        const isFig = SPIKE_FIGSPAN > 0 && firstImgSpan(rendered)
        const cls = SPIKE && (firstSlide || isFig) ? 'slide span' : 'slide'
        body.push(`<section class="${cls}">\n${rendered}\n</section>`)
        firstSlide = false
      }
      body.push('</section>')
    }
  }
  toc.push('</ul></section>')
  const styleSheet = SPIKE ? SPIKE_STYLE : STYLE
  const content = SPIKE
    ? `<div class="cols">\n${body.join('\n')}\n</div>`
    : body.join('\n')
  const paged = SPIKE ? '' : `<script>window.PagedConfig = { auto: false };</script>
<script src="/node_modules/pagedjs/dist/paged.polyfill.js"></script>`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Physics Quarter 1 Textbook — Grade ${grade}</title>
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">
<style>${styleSheet}</style></head>
<body>
${COVER(grade)}
${toc.join('\n')}
${content}
${paged}
</body></html>`
  await mkdir(OUT, { recursive: true })
  const htmlPath = path.join(
    OUT, SPIKE ? `spike_${ORIENT}${SPIKE_TAG}_${grade}.html` : `textbook_q1_${grade}.html`)
  await writeFile(htmlPath, html)
  return htmlPath
}

// --------------------------------------------------------------------------
// Minimal static server rooted at the repo so /public and /node_modules load.
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent((req.url || '/').split('?')[0])
      const file = path.join(ROOT, path.normalize(url))
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return }
      await stat(file)
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
      createReadStream(file).pipe(res)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function printPdf(server, grade) {
  const { port } = server.address()
  const htmlName = SPIKE ? `spike_${ORIENT}${SPIKE_TAG}_${grade}.html`
                         : `textbook_q1_${grade}.html`
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${port}/textbook/build/${htmlName}`,
      { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => Promise.all(Array.from(document.images)
      .map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r }))))

    // Raster images print at 300 dpi: physical width = pixels / 300 in
    // (96 CSS px per inch). max-width:100% still caps them to the column.
    await page.evaluate(() => {
      document.querySelectorAll('img.fig-raster').forEach(img => {
        if (img.naturalWidth) img.style.width = `${(img.naturalWidth * 96 / 300).toFixed(3)}px`
      })
    })

    if (SPIKE) {
      // Native Chromium pagination (no Paged.js), so CSS columns work.
      const pdfPath = path.join(OUT, `spike_${ORIENT}${SPIKE_TAG}_${grade}.pdf`)
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
      return pdfPath
    }

    // Paginate with Paged.js, then number pages and fill the TOC ourselves
    // (Paged.js' element-level counter-reset is unreliable). Numbering starts
    // at 1 on the page holding the first unit; front matter stays unnumbered.
    const info = await page.evaluate(async () => {
      const previewer = new window.Paged.Previewer()
      await previewer.preview()
      const pages = [...document.querySelectorAll('.pagedjs_page')]
      const firstUnit = document.querySelector('.unit')
      let bodyStart = pages.findIndex(pg => firstUnit && pg.contains(firstUnit))
      if (bodyStart < 0) bodyStart = pages.length
      const numOf = pg => { const i = pages.indexOf(pg); return i >= bodyStart ? i - bodyStart + 1 : 0 }
      pages.forEach((pg, i) => {
        if (i < bodyStart) return
        const d = document.createElement('div')
        d.className = 'pagedjs-page-number'
        d.textContent = String(i - bodyStart + 1)
        pg.appendChild(d)
      })
      document.querySelectorAll('.toc a[href^="#"]').forEach(a => {
        const el = document.getElementById(a.getAttribute('href').slice(1))
        const pg = el && el.closest('.pagedjs_page')
        const n = pg ? numOf(pg) : 0
        a.querySelector('.num').textContent = n ? String(n) : ''
      })
      return { pages: pages.length, bodyStart }
    })
    console.log(`  ${grade}: ${info.pages} pages (front matter ${info.bodyStart})`)

    const pdfPath = path.join(OUT, `textbook_q1_${grade}.pdf`)
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 } })
    return pdfPath
  } finally {
    await browser.close()
  }
}

async function main() {
  const server = WITH_PDF ? await startServer() : null
  try {
    for (const grade of Object.keys(BOOKS)) {
      const htmlPath = await build(grade)
      const rel = path.relative(ROOT, htmlPath)
      if (server) {
        const pdf = await printPdf(server, grade)
        console.log(`built ${rel} -> ${path.relative(ROOT, pdf)}`)
      } else {
        console.log(`built ${rel}`)
      }
    }
  } finally {
    if (server) server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
