// Receipts renderer. Headless Chromium paints each frame; ffmpeg encodes.
//
//   node render.mjs sheet <storyboard.json> --at=0.5,1.2,3 [--every=0.5] [--cols=4] [--w=400] --out=sheet.jpg
//   node render.mjs strip <storyboard.json> --from=2.0 --to=2.6 [--cols=8] [--w=320] --out=strip.jpg
//   node render.mjs film  <storyboard.json ...> --out=dir [--workers=2] [--poster=1.6] [--scale=960] [--crf264=32]
//
// film writes <slug>.mp4 (H.264, no audio, animated on twos) and
// <slug>-poster.webp into --out, and prints one JSON line per film: duration,
// frames, ms per frame, bytes. Frames are pure functions of t, so a film
// re-renders identically. Use build.mjs rather than this for site films: it
// fills in the article date and keeps the manifest.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const FPS = 24

async function chromium() {
  const require = createRequire(import.meta.url)
  for (const p of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try { const m = await import(p.startsWith('/') ? pathToFileURL(p).href : p); const c = m.chromium || (m.default && m.default.chromium); if (c) return c } catch {}
    try { const c = require(p).chromium; if (c) return c } catch {}
  }
  throw new Error('playwright not found (npm i -g playwright, or set it up beside this script)')
}

const args = process.argv.slice(2)
const mode = args[0]
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const files = args.slice(1).filter(a => !a.startsWith('--'))

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', e => console.error('page error:', e.message))
  await page.goto(pathToFileURL(join(HERE, 'studio-painted.html')).href)
  await page.evaluate(() => window.READY)
  return page
}
const loadSb = f => JSON.parse(readFileSync(f, 'utf8'))

async function sheet(page, sb, times, cols, w, out, labels = true) {
  const info = await page.evaluate(sb => FILM.load(sb), sb)
  const data = await page.evaluate(({ times, cols, w, labels }) => {
    const h = Math.round(w * 720 / 1280), rows = Math.ceil(times.length / cols)
    const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * (h + (labels ? 22 : 0))
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height)
    const src = document.getElementById('c')
    const ms = []
    times.forEach((t, i) => {
      const a = performance.now(); FILM.frame(t); ms.push(performance.now() - a)
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + (labels ? 22 : 0))
      g.drawImage(src, x, y, w, h)
      if (labels) { g.fillStyle = '#ddd'; g.font = '13px monospace'; g.fillText(t.toFixed(2) + 's', x + 6, y + h + 15) }
    })
    return { url: c.toDataURL('image/jpeg', .9), ms: ms.reduce((a, b) => a + b, 0) / ms.length }
  }, { times, cols, w, labels })
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64'))
  console.log(JSON.stringify({ out, duration: +info.duration.toFixed(2), frames: times.length, msPerFrame: Math.round(data.ms), scenes: info.scenes }))
}

// H.264 only. x264 with -tune animation beat VP9 on these frames at every
// setting tried, and H.264 plays everywhere, so a WebM would add bytes, not reach.
function encoder(out, slug) {
  const mp4 = join(out, `${slug}.mp4`)
  const scale = opt.scale ? ['-vf', `scale=${+opt.scale}:${Math.round(+opt.scale * 9 / 16 / 2) * 2}:flags=lanczos`] : []
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf264 || 32), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
    { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  return { ff, done, mp4 }
}
const write = (stream, buf) => new Promise(res => (stream.write(buf) ? res() : stream.once('drain', res)))

async function film(page, sb, out) {
  if (opt.opts) await page.evaluate(o => Object.assign(RF.OPT, o), JSON.parse(opt.opts))
  const info = await page.evaluate(sb => FILM.load(sb), sb)
  const n = Math.round(info.duration * FPS)
  const enc = encoder(out, sb.slug)
  const t0 = Date.now()
  // Animated on twos: one drawing per two frames, like hand-drawn animation.
  // The duplicate frame is nearly free to encode, which halves the file.
  const twos = !opt.ones
  let last = null
  for (let i = 0; i < n; i++) {
    if (twos && i % 2 === 1 && last) { await write(enc.ff.stdin, last); continue }
    const url = await page.evaluate(t => { FILM.frame(t); return document.getElementById('c').toDataURL('image/jpeg', .95) }, i / FPS)
    last = Buffer.from(url.split(',')[1], 'base64')
    await write(enc.ff.stdin, last)
  }
  enc.ff.stdin.end()
  const paintMs = (Date.now() - t0) / n
  // poster: the title card, fully composed
  const pt = Number(opt.poster || 0) || info.posterT
  const pw = +(opt.scale || 960)
  const purl = await page.evaluate(({ t, pw }) => {
    FILM.frame(t)
    const c = document.createElement('canvas'); c.width = pw; c.height = Math.round(pw * 9 / 16)
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'
    g.drawImage(document.getElementById('c'), 0, 0, c.width, c.height)
    return c.toDataURL('image/webp', .8)
  }, { t: pt, pw })
  const poster = join(out, `${sb.slug}-poster.webp`)
  writeFileSync(poster, Buffer.from(purl.split(',')[1], 'base64'))
  await enc.done
  const size = f => statSync(f).size
  const r = { slug: sb.slug, duration: +info.duration.toFixed(2), frames: n, paintMs: Math.round(paintMs), wallS: Math.round((Date.now() - t0) / 1000), mp4: size(enc.mp4), poster: size(poster), posterT: pt, scenes: info.scenes, events: info.events || [], lines: info.lines || [] }
  console.log(JSON.stringify(r))
  return r
}

const main = async () => {
  const cr = await chromium()
  const browser = await cr.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (mode === 'sheet' || mode === 'strip') {
      const page = await openPage(browser)
      const sb = loadSb(files[0])
      let times
      if (mode === 'strip') {
        const a = +opt.from, b = +opt.to; times = []
        for (let t = a; t <= b + 1e-6; t += 1 / FPS) times.push(+t.toFixed(4))
      } else if (opt.every) {
        const info = await page.evaluate(sb => FILM.load(sb), sb)
        times = []; for (let t = +opt.start || 0; t < info.duration; t += +opt.every) times.push(+t.toFixed(3))
      } else times = String(opt.at).split(',').map(Number)
      await sheet(page, sb, times, +(opt.cols || (mode === 'strip' ? 8 : 4)), +(opt.w || (mode === 'strip' ? 320 : 400)), opt.out || 'sheet.jpg')
    } else if (mode === 'lines') {
      // the narration each storyboard will speak, before anything is timed
      const page = await openPage(browser)
      const out = {}
      for (const f of files) { const sb = loadSb(f); out[sb.slug] = await page.evaluate(sb => FILM.lines(sb), sb) }
      console.log(JSON.stringify(out))
    } else if (mode === 'film') {
      const out = opt.out || 'out'; mkdirSync(out, { recursive: true })
      const workers = Math.max(1, +(opt.workers || 1))
      const queue = [...files]
      await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
        const page = await openPage(browser)
        while (queue.length) { const f = queue.shift(); await film(page, loadSb(f), out) }
      }))
    } else throw new Error('mode: sheet | strip | film')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exit(1) })
