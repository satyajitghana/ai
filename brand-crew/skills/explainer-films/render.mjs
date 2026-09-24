// Explainer-films renderer. Headless Chromium paints each frame; ffmpeg encodes.
//
//   node render.mjs sheet <storyboard.json> --at=0.5,1.2,3 [--every=0.5] [--cols=4] [--w=400] --out=sheet.jpg
//   node render.mjs strip <storyboard.json> --from=2.0 --to=2.6 [--cols=8] [--w=320] --out=strip.jpg
//   node render.mjs film  <storyboard.json ...> --out=dir [--workers=2] [--poster=1.6] [--scale=960] [--crf264=32]
//   node render.mjs thumb <storyboard.json ...> --out=dir [--w=1200] [--q=0.72]
//   node render.mjs lines <storyboard.json ...>
//
// thumb writes <slug>.jpg, 1200x630: the film's first mechanism scene, fully
// built, with no text chrome, for the article's backdrop and its OG image.
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
  await page.goto(pathToFileURL(join(HERE, 'studio.html')).href)
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
    return { url: c.toDataURL('image/jpeg', .9), ms: ms.reduce((a, b) => a + b, 0) / ms.length, pb: typeof PB !== 'undefined' && PB.stats.bakes ? { ...PB.stats, ms: Math.round(PB.stats.ms) } : undefined }
  }, { times, cols, w, labels })
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64'))
  console.log(JSON.stringify({ out, duration: +info.duration.toFixed(2), frames: times.length, msPerFrame: Math.round(data.ms), pb: data.pb, scenes: info.scenes }))
}

// H.264 only. x264 with -tune animation beat VP9 on these frames at every
// setting tried, and H.264 plays everywhere, so a WebM would add bytes, not reach.
function encoder(out, slug, hard) {
  const mp4 = join(out, `${slug}.mp4`)
  // The pixel style is painted at 320x180: it ships at exactly 2x (640x360) and
  // the page scales it up with image-rendering: pixelated. At 960 its hard edges
  // cost H.264 twice the bits of any other style for no visible gain.
  const sw = hard && opt.scale ? 640 : +opt.scale
  const scale = opt.scale ? ['-vf', `scale=${sw}:${Math.round(sw * 9 / 16 / 2) * 2}:flags=${hard ? 'neighbor' : 'lanczos'}`] : []
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf264 || 32), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
    { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  return { ff, done, mp4 }
}
const write = (stream, buf) => new Promise(res => (stream.write(buf) ? res() : stream.once('drain', res)))

async function film(pages, sb, out) {
  const page = pages[0]
  if (opt.opts) for (const p of pages) await p.evaluate(o => Object.assign(RF.OPT, o), JSON.parse(opt.opts))
  const info = (await Promise.all(pages.map(p => p.evaluate(sb => FILM.load(sb), sb))))[0]
  const n = Math.round(info.duration * FPS)
  const enc = encoder(out, sb.slug, !!info.lowres)
  const t0 = Date.now()
  // Animated on twos: one drawing per two frames, like hand-drawn animation.
  // The duplicate frame is nearly free to encode, which halves the file.
  const step = opt.ones ? 1 : 2
  const at = []; for (let i = 0; i < n; i += step) at.push(i)
  // With more than one page, the drawings are split into one contiguous run
  // per page and streamed to the encoder in order as they arrive. Frames are
  // pure functions of t and paintings are seeded by their key, so a page
  // paints exactly what any other would; and a run is mostly its own scenes,
  // so pages rarely paint the same shape twice.
  const shots = new Map(), per = Math.ceil(at.length / pages.length)
  let wrote = 0, flushing = Promise.resolve()
  const flush = () => (flushing = flushing.then(async () => {
    while (shots.has(wrote)) {
      const buf = shots.get(wrote); shots.delete(wrote)
      for (let r = 0; r < Math.min(step, n - at[wrote]); r++) await write(enc.ff.stdin, buf)
      wrote++
    }
  }))
  await Promise.all(pages.map(async (p, w) => {
    for (let j = w * per; j < Math.min(at.length, (w + 1) * per); j++) {
      const url = await p.evaluate(t => { FILM.frame(t); return document.getElementById('c').toDataURL('image/jpeg', .95) }, at[j] / FPS)
      shots.set(j, Buffer.from(url.split(',')[1], 'base64'))
      if (j === wrote) await flush()
    }
  }))
  await flush()
  enc.ff.stdin.end()
  const paintMs = (Date.now() - t0) / n
  // poster: the title card, fully composed
  const pt = Number(opt.poster || 0) || info.posterT
  const pw = +(opt.scale || 960)
  await page.evaluate(h => { window.__HARD = h }, !!info.lowres)
  const purl = await page.evaluate(({ t, pw }) => {
    FILM.frame(t)
    const c = document.createElement('canvas'); c.width = pw; c.height = Math.round(pw * 9 / 16)
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'
    g.imageSmoothingEnabled = !window.__HARD; g.drawImage(document.getElementById('c'), 0, 0, c.width, c.height)
    return c.toDataURL('image/webp', .8)
  }, { t: pt, pw })
  const poster = join(out, `${sb.slug}-poster.webp`)
  writeFileSync(poster, Buffer.from(purl.split(',')[1], 'base64'))
  await enc.done
  const size = f => statSync(f).size
  const r = { slug: sb.slug, duration: +info.duration.toFixed(2), frames: n, paintMs: Math.round(paintMs), wallS: Math.round((Date.now() - t0) / 1000), mp4: size(enc.mp4), poster: size(poster), posterT: pt, scenes: info.scenes, beats: info.beats, events: info.events || [], lines: info.lines || [], style: info.style, music: info.music, bpm: info.bpm, mascot: info.mascot }
  console.log(JSON.stringify(r))
  return r
}

// The GPU the page paints with. There is none here, so it is software either
// way; the question is which, and it matters more than anything else:
//
//   Mesa llvmpipe, through ANGLE's GL backend, paints p5.brush (the
//   watercolour style, and the pen and pencil ones) several times faster than
//   Chromium's bundled SwiftShader, and reads a painting back ~20x faster.
//   It needs an X display, so a private Xvfb is started for it. Without one
//   Chromium quietly falls back, so the renderer is checked, not assumed.
//
//   2D canvases stay on the CPU (Skia). "Accelerating" them on a software GPU
//   made every style's Canvas2D painting 5-8x slower and readback worse still.
//
// --swiftshader skips llvmpipe; --gpu=<anything> prints which one was used.
const BASE_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas']
let XVFB = null
function startXvfb() {
  return new Promise(res => {
    let x
    try { x = spawn('Xvfb', ['-displayfd', '3', '-screen', '0', '1280x720x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe'] }) } catch { return res(null) }
    const give = v => { clearTimeout(timer); res(v) }
    const timer = setTimeout(() => { x.kill(); give(null) }, 5000)
    x.on('error', () => give(null))
    let buf = ''
    // once it has said which display it took, it must not keep this process alive
    x.stdio[3].on('data', d => { buf += d; const m = buf.match(/(\d+)\s/); if (m) { XVFB = x; x.stdio[3].destroy(); x.unref(); give(':' + m[1]) } })
  })
}
process.on('exit', () => { if (XVFB) XVFB.kill() })
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { if (XVFB) XVFB.kill(); process.exit(128 + (sig === 'SIGINT' ? 2 : sig === 'SIGTERM' ? 15 : 1)) })
async function rendererOf(browser) {
  const p = await browser.newPage()
  try { return await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return 'none'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }) } finally { await p.close() }
}
async function launch(cr) {
  if (!opt.swiftshader) {
    const display = await startXvfb()
    if (display) {
      const browser = await cr.launch({ headless: false, args: [...BASE_ARGS, '--use-angle=gl', '--window-size=1280,720'], env: { ...process.env, DISPLAY: display, LIBGL_ALWAYS_SOFTWARE: '1' } }).catch(() => null)
      const gpu = browser && await rendererOf(browser).catch(() => '')
      if (gpu && /llvmpipe/i.test(gpu)) { if (opt.gpu) console.error('gpu:', gpu); return browser }
      if (browser) await browser.close()
      if (XVFB) { XVFB.kill(); XVFB = null }
    }
  }
  const browser = await cr.launch({ args: [...BASE_ARGS, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  if (opt.gpu) console.error('gpu:', await rendererOf(browser))
  return browser
}

const main = async () => {
  const cr = await chromium()
  const browser = await launch(cr)
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
    } else if (mode === 'thumb') {
      const out = opt.out || 'thumbs'; mkdirSync(out, { recursive: true })
      const w = +(opt.w || 1200), q = +(opt.q || .72), queue = [...files]
      await Promise.all(Array.from({ length: Math.min(Math.max(1, +(opt.workers || 3)), queue.length) }, async () => {
      const page = await openPage(browser)
      while (queue.length) {
        const sb = loadSb(queue.shift())
        const r = await page.evaluate(({ sb, w, q }) => {
          const info = FILM.thumb(sb), src = document.getElementById('c'), h = Math.round(w * 630 / 1200)
          const c = document.createElement('canvas'); c.width = w; c.height = h
          const g = c.getContext('2d'), sh = src.width * h / w
          g.imageSmoothingEnabled = info.style !== 'pixel'; g.imageSmoothingQuality = 'high'
          g.drawImage(src, 0, (src.height - sh) / 2, src.width, sh, 0, 0, w, h)
          return { ...info, url: c.toDataURL('image/jpeg', q) }
        }, { sb, w, q })
        const file = join(out, `${sb.slug}.jpg`)
        writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'))
        console.log(JSON.stringify({ slug: sb.slug, file, bytes: statSync(file).size, scene: r.scene, style: r.style, mascot: r.mascot }))
      }
      }))
    } else if (mode === 'film') {
      const out = opt.out || 'out'; mkdirSync(out, { recursive: true })
      // pages are shared out between films; fewer films than pages means
      // each film is split across several
      const workers = Math.max(1, +(opt.workers || 1))
      const queue = [...files], groups = Math.min(workers, queue.length), per = Math.floor(workers / groups)
      await Promise.all(Array.from({ length: groups }, async () => {
        const pages = await Promise.all(Array.from({ length: per }, () => openPage(browser)))
        while (queue.length) { const f = queue.shift(); await film(pages, loadSb(f), out) }
      }))
    } else throw new Error('mode: sheet | strip | film')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exit(1) })
