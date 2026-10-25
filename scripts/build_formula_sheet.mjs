// =============================================================================
// build_formula_sheet.mjs — render the A4 formula sheets to PDF.
//
// Source: reference/formula-sheet-<grade>.md (Markdown + KaTeX). A logical page
// is delimited by an HTML comment `<!-- page -->`; each becomes one printed A4
// side laid out in 3 columns. Rendered with markdown-it (+ KaTeX) and printed
// by Playwright Chromium (served over a small local HTTP server so /public
// figures and node_modules/katex resolve). Output: pdfs/Formula_Sheet_<Grade>.pdf
//
// Run: node scripts/build_formula_sheet.mjs
// =============================================================================

import MarkdownIt from 'markdown-it'
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
import katex from 'katex'
import { chromium } from 'playwright-chromium'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REF = path.join(ROOT, 'reference')
const TMP = path.join(REF, '.build')
const OUT = path.join(ROOT, 'pdfs')

// --------------------------------------------------------------------------
// Markdown-it + KaTeX (markdown-it-katex style rules).
function katexPlugin(md) {
  const isValidDelim = (state, pos) => {
    const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
    const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1
    let canOpen = true
    let canClose = true
    if (prev === 0x20 || prev === 0x09 || (next >= 0x30 && next <= 0x39)) canClose = false
    if (next === 0x20 || next === 0x09) canOpen = false
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
    if (silent) return true
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
const STYLE = `
@font-face { font-family:'Patrick Hand'; font-weight:400; font-display:block;
  src:url('/public/fonts/PatrickHand-Regular.ttf') format('truetype'); }
@page { size: A4; margin: 6mm 6mm 5mm; }
* { box-sizing: border-box; }
html { font-size: 11.2pt; }
body { margin:0; color:#0f172a; line-height:1.32;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.page { column-count:3; column-gap:5mm; column-rule:1px solid #e2e8f0; }
.page + .page { break-before: page; }
h1 { column-span:all; font-family:'Patrick Hand', sans-serif; font-size:2rem; line-height:1;
  margin:0 0 1.6mm; padding-bottom:.7mm; border-bottom:2.5px solid #111827; letter-spacing:.3px; }
h2 { font-size:1.02rem; line-height:1.12; margin:.75em 0 .28em; padding:.2em .45em; background:#111827;
  color:#fff; border-radius:3px; break-after:avoid; }
h3 { font-size:.92rem; margin:.5em 0 .12em; color:#111827; break-after:avoid; }
p { margin:.22em 0; }
ul,ol { margin:.22em 0; padding-left:1.1em; } li { margin:.05em 0; }
table { border-collapse:collapse; width:100%; font-size:.82rem; margin:.25em 0; break-inside:avoid; }
th,td { border:1px solid #cbd5e1; padding:.14em .32em; text-align:left; vertical-align:top; }
th { background:#f1f5f9; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.95em; }
hr { border:0; border-top:1px solid #e2e8f0; margin:.45em 0; }
.katex { font-size:1.02em; }
.katex-block { margin:.3em 0; text-align:center; }
img { max-width:100%; height:auto; display:block; margin:.3em auto; break-inside:avoid; }
.fig-row { display:flex; gap:2.5mm; align-items:center; justify-content:center; }
.fig-row img { flex:1 1 0; min-width:0; width:100%; }
.markdown-alert-title .octicon { display:none; }
.markdown-alert { border:1px solid #cbd5e1; border-left:4px solid #64748b; background:#f8fafc;
  border-radius:4px; padding:.35em .5em; margin:.35em 0; break-inside:avoid; font-size:.86rem; }
.markdown-alert > :first-child { margin-top:0; } .markdown-alert > :last-child { margin-bottom:0; }
.markdown-alert-title { font-weight:700; color:#334155; display:flex; gap:.3em; align-items:center;
  margin:0 0 .1em; font-size:.86rem; }
.markdown-alert-title .octicon { width:1em; height:1em; fill:currentColor; }
.markdown-alert-tip       { border-left-color:#0d9488; background:#f0fdfa; }
.markdown-alert-important { border-left-color:#d97706; background:#fffbeb; }
.markdown-alert-warning   { border-left-color:#ea580c; background:#fff7ed; }
.markdown-alert-note      { border-left-color:#64748b; }
`

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

function renderSheet(source) {
  const parts = source.split(/<!--\s*page\s*-->/i)
  return parts.map(p => `<section class="page">\n${md.render(p)}\n</section>`).join('\n')
}

async function build(server, file, outName) {
  const { port } = server.address()
  const source = await readFile(path.join(REF, file), 'utf8')
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${file}</title>
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">
<style>${STYLE}</style></head>
<body>
${renderSheet(source)}
</body></html>`
  await mkdir(TMP, { recursive: true })
  const htmlName = `${path.basename(file, '.md')}.html`
  const htmlPath = path.join(TMP, htmlName)
  await writeFile(htmlPath, html)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${port}/reference/.build/${htmlName}`,
      { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => Promise.all(Array.from(document.images)
      .map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r }))))
    const pdfPath = path.join(OUT, outName)
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
    return pdfPath
  } finally {
    await browser.close()
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const server = await startServer()
  try {
    const sheets = [
      ['formula-sheet-g6.md', 'Formula_Sheet_G6.pdf'],
      ['formula-sheet-g7.md', 'Formula_Sheet_G7.pdf'],
    ]
    for (const [file, out] of sheets) {
      const pdf = await build(server, file, out)
      console.log(`built ${path.relative(ROOT, pdf)}`)
    }
  } finally {
    server.close()
    if (!process.env.KEEP_TMP) await rm(TMP, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exit(1) })
