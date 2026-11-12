// The story-format renderer: render.mjs for storyboards with "format": "story".
//
// render.mjs is frozen (every legacy film hashes it), so the story format
// renders through this fork of it. The page is story/studio.html: the legacy
// painter, type, styles, host and p5.brush bake, unchanged, with the story
// engine (story/explainer.js, story/scenes.js) in place of engine/explainer.js.
// What differs from render.mjs:
//   - the lite tier only (no --live, no --p5)
//   - on macOS, Chromium paints WebGL on the machine's own GPU through ANGLE's
//     Metal backend (there is no Xvfb or llvmpipe there); Linux and Windows
//     choose as render.mjs does
//   - the encoder is told the frame size and CRF by build.mjs, which picks the
//     story path's own (longer films, so a little more compression)
//   - no metrics mode: metrics.json is the legacy styles' and still holds
//
//   node story/render.mjs sheet <storyboard.json> [--every=0.5 | --at=1,2.5] [--cols=4] [--w=400] --out=sheet.jpg
//   node story/render.mjs strip <storyboard.json> --from=2.0 --to=2.6 --out=strip.jpg
//   node story/render.mjs film  <storyboard.json ...> --out=dir [--workers=3] [--scale=960] [--crf264=34]
//   node story/render.mjs thumb <storyboard.json ...> --out=dir
//   node story/render.mjs lines <storyboard.json ...>
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url)), SKILL = join(HERE, '..')
const FPS = 24
const FFMPEG = process.env.EXPLAINER_FFMPEG || 'ffmpeg'

async function chromium() {
  const require = createRequire(import.meta.url)
  for (const p of [process.env.PLAYWRIGHT_PATH, 'playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
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

// The article's own figures and clips, handed to a page before a film loads.
// An image goes as it is; a clip goes as frames ffmpeg pulls at 24 fps, muted,
// only over the span the scene plays, so a clip frame is a pure function of
// time like every other. Pulled once per clip per run.
const PUBLIC = join(SKILL, '..', '..', '..', 'public')
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }
const clips = new Map()
function mediaOf(sc) {
  const key = sc.src + '|' + (sc.clip || []).join(',')
  if (clips.has(key)) return clips.get(key)
  const ext = (sc.src.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()
  let r
  if (MIME[ext]) r = { key, kind: 'image', urls: [`data:${MIME[ext]};base64,${readFileSync(join(PUBLIC, sc.src)).toString('base64')}`] }
  else {
    const file = ext ? join(PUBLIC, sc.src) : ['.mp4', '.webm'].map(e => join(PUBLIC, sc.src + e)).find(existsSync)
    if (!file || !existsSync(file)) throw new Error(`figure: no file for ${sc.src}`)
    const [a, b] = sc.clip || [0, 12], dir = mkdtempSync(join(tmpdir(), 'clip-'))
    const ff = spawnSync(FFMPEG, ['-v', 'error', '-ss', String(a), '-t', String(b - a), '-i', file, '-an', '-vf', 'fps=24,scale=1280:-2', '-q:v', '4', join(dir, 'f%04d.jpg')])
    if (ff.status !== 0) throw new Error(`figure: ffmpeg on ${sc.src}: ${ff.stderr}`)
    r = { key, kind: 'video', urls: readdirSync(dir).sort().map(f => 'data:image/jpeg;base64,' + readFileSync(join(dir, f)).toString('base64')) }
    rmSync(dir, { recursive: true, force: true })
  }
  clips.set(key, r)
  return r
}
async function prepMedia(page, sb) {
  for (const sc of sb.scenes || []) if (sc.type === 'figure') { const m = mediaOf(sc); await page.evaluate(m => FILM.media(m.key, m.kind, m.urls, 24), m) }
  await prepBespoke(page, sb)
}
// A bespoke scene's drawing code is the film's own module,
// custom/<key>/<module>.js beside this skill, loaded once per page.
async function prepBespoke(page, sb) {
  for (const sc of sb.scenes || []) {
    if (sc.type !== 'custom') continue
    const id = `${sb.slug}/${sc.module}`
    if (await page.evaluate(id => BESPOKE.has(id), id)) continue
    const file = join(SKILL, 'custom', sb.slug, `${sc.module}.js`)
    if (!existsSync(file)) throw new Error(`custom scene: no module ${file}`)
    await page.evaluate(id => { BESPOKE.loading = id }, id)
    await page.addScriptTag({ path: file })
    await page.evaluate(() => { BESPOKE.loading = null })
    if (!(await page.evaluate(id => BESPOKE.has(id), id))) throw new Error(`custom scene: ${file} did not call BESPOKE.define({ draw })`)
  }
}

async function sheet(page, sb, times, cols, w, out, labels = true) {
  await prepMedia(page, sb)
  const info = await page.evaluate(sb => FILM.load(sb), sb)
  // --cpuprofile=file: a V8 CPU profile of the frames (for finding where a tier spends its time)
  let cdp = null
  if (opt.cpuprofile) { cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start') }
  const data = await page.evaluate(({ times, cols, w, labels, dump }) => {
    const h = Math.round(w * 720 / 1280), rows = Math.ceil(times.length / cols)
    const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * (h + (labels ? 22 : 0))
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height)
    const src = document.getElementById('c')
    const ms = [], full = []
    times.forEach((t, i) => {
      const a = performance.now(); FILM.frame(t, { blur: true }); ms.push(performance.now() - a)
      if (dump) full.push(src.toDataURL('image/png'))
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + (labels ? 22 : 0))
      g.drawImage(src, x, y, w, h)
      if (labels) { g.fillStyle = '#ddd'; g.font = '13px monospace'; g.fillText(t.toFixed(2) + 's', x + 6, y + h + 15) }
    })
    return { url: c.toDataURL('image/jpeg', .9), full, ms: ms.reduce((a, b) => a + b, 0) / ms.length, msEach: ms.map(Math.round), pb: typeof PB !== 'undefined' && (PB.stats.bakes || PB.stats.ops) ? Object.fromEntries(Object.entries(PB.stats).map(([k, v]) => [k, Math.round(v)])) : undefined }
  }, { times, cols, w, labels, dump: !!opt.dump })
  if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(opt.cpuprofile, JSON.stringify(profile)) }
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64'))
  if (opt.dump) { mkdirSync(opt.dump, { recursive: true }); data.full.forEach((u, i) => writeFileSync(join(opt.dump, `${sb.slug}-${times[i].toFixed(3)}.png`), Buffer.from(u.split(',')[1], 'base64'))) }
  console.log(JSON.stringify({ out, duration: +info.duration.toFixed(2), frames: times.length, msPerFrame: Math.round(data.ms), msEach: data.msEach, pb: data.pb, scenes: info.scenes }))
}

// H.264 only. x264 with -tune animation beat VP9 on these frames at every
// setting tried, and H.264 plays everywhere, so a WebM would add bytes, not reach.
function encoder(out, slug, hard) {
  const mp4 = join(out, `${slug}.mp4`)
  // The pixel style is painted at 320x180: it ships at exactly 2x (640x360) and
  // the page scales it up with image-rendering: pixelated. At 960 its hard edges
  // cost H.264 twice the bits of any other style for no visible gain.
  const sw = hard && opt.scale ? Math.min(640, +opt.scale) : +opt.scale
  const scale = opt.scale ? ['-vf', `scale=${sw}:${Math.round(sw * 9 / 16 / 2) * 2}:flags=${hard ? 'neighbor' : 'lanczos'}`] : []
  const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf264 || 32), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
    { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  return { ff, done, mp4 }
}
const write = (stream, buf) => new Promise(res => (stream.write(buf) ? res() : stream.once('drain', res)))

async function film(pages, sb, out) {
  const page = pages[0]
  await Promise.all(pages.map(p => prepMedia(p, sb)))
  const info = (await Promise.all(pages.map(p => p.evaluate(sb => FILM.load(sb), sb))))[0]
  const n = Math.round(info.duration * FPS)
  const enc = encoder(out, sb.slug, !!info.lowres)
  const t0 = Date.now()
  // Animated on twos: one drawing per two frames, like hand-drawn animation;
  // the duplicate frame is nearly free to encode. Inside a motion window
  // (a cut, parts arriving, packets running) every frame is painted, and
  // smeared over the shutter where the window says so, so movement is
  // smooth while the linework still boils on twos.
  const mo = info.motion || [], moving = t => mo.some(w => t >= w[0] && t <= w[1])
  const at = []; for (let i = 0; i < n; i++) if (opt.ones || i % 2 === 0 || (!opt.noblur && moving(i / FPS))) at.push(i)
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
      for (let r = 0; r < (at[wrote + 1] ?? n) - at[wrote]; r++) await write(enc.ff.stdin, buf)
      wrote++
    }
  }))
  await Promise.all(pages.map(async (p, w) => {
    for (let j = w * per; j < Math.min(at.length, (w + 1) * per); j++) {
      const url = await p.evaluate(({ t, blur }) => { FILM.frame(t, { blur }); return document.getElementById('c').toDataURL('image/jpeg', .95) }, { t: at[j] / FPS, blur: !opt.noblur })
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
  const r = { slug: sb.slug, duration: +info.duration.toFixed(2), frames: n, paintMs: Math.round(paintMs), wallS: Math.round((Date.now() - t0) / 1000), mp4: size(enc.mp4), poster: size(poster), posterT: pt, scenes: info.scenes, beats: info.beats, events: info.events || [], lines: info.lines || [], style: info.style, music: info.music, bpm: info.bpm, beat0: info.beat0, cuts: info.cuts || [], mascot: info.mascot }
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
  // Windows: Chrome on the machine's own GPU through ANGLE's Direct3D 11 backend.
  // There is no Xvfb or llvmpipe there, and SwiftShader would waste the GPU.
  // The p5 tier hands the frame between Canvas2D and WebGL on every brush
  // stroke, so there its 2D canvases stay on the GPU too (--cpu2d keeps them on the CPU).
  if (process.platform === 'win32') {
    const args = BASE_ARGS
    const browser = await cr.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: [...args, '--use-angle=d3d11'] })
    if (opt.gpu) console.error('gpu:', await rendererOf(browser))
    return browser
  }
  // macOS: the machine's GPU through ANGLE's Metal backend, checked rather than assumed
  if (process.platform === 'darwin' && !opt.swiftshader) {
    const browser = await cr.launch({ headless: true, args: [...BASE_ARGS, '--use-angle=metal'] })
    const gpu = await rendererOf(browser).catch(() => '')
    if (/metal/i.test(gpu)) { if (opt.gpu) console.error('gpu:', gpu); return browser }
    await browser.close()
    throw new Error(`no GPU: asked for ANGLE Metal, got "${gpu}"; pass --swiftshader on purpose`)
  }
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
  // no silent fallback: SwiftShader only when asked for by name
  if (!opt.swiftshader) throw new Error('no GPU: Mesa llvmpipe (through Xvfb) is not available; render on the GPU machine, or pass --swiftshader on purpose')
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
        await prepMedia(page, sb)
        const info = await page.evaluate(sb => FILM.load(sb), sb)
        times = []; for (let t = +opt.start || 0; t < info.duration; t += +opt.every) times.push(+t.toFixed(3))
      } else times = String(opt.at).split(',').map(Number)
      await sheet(page, sb, times, +(opt.cols || (mode === 'strip' ? 8 : 4)), +(opt.w || (mode === 'strip' ? 320 : 400)), opt.out || 'sheet.jpg')
    } else if (mode === 'lines') {
      // the narration each storyboard will speak, before anything is timed
      const page = await openPage(browser)
      const out = {}
      for (const f of files) { const sb = loadSb(f); await prepBespoke(page, sb); out[sb.slug] = await page.evaluate(sb => FILM.lines(sb), sb) }
      console.log(JSON.stringify(out))
    } else if (mode === 'thumb') {
      const out = opt.out || 'thumbs'; mkdirSync(out, { recursive: true })
      const w = +(opt.w || 1200), q = +(opt.q || .72), queue = [...files]
      await Promise.all(Array.from({ length: Math.min(Math.max(1, +(opt.workers || 3)), queue.length) }, async () => {
      const page = await openPage(browser)
      while (queue.length) {
        const sb = loadSb(queue.shift())
        await prepMedia(page, sb)
        const r = await page.evaluate(({ sb, w, q, full }) => {
          const t0 = performance.now(), info = FILM.thumb(sb), ms = performance.now() - t0, src = document.getElementById('c'), h = Math.round(w * 630 / 1200)
          const c = document.createElement('canvas'); c.width = w; c.height = h
          const g = c.getContext('2d'), sh = src.width * h / w
          g.imageSmoothingEnabled = info.style !== 'pixel'; g.imageSmoothingQuality = 'high'
          g.drawImage(src, 0, (src.height - sh) / 2, src.width, sh, 0, 0, w, h)
          const pb = typeof PB !== 'undefined' && PB.stats.ops ? Object.fromEntries(Object.entries(PB.stats).map(([k, v]) => [k, Math.round(v)])) : undefined
          return { ...info, ms, pb, url: c.toDataURL('image/jpeg', q), full: full ? src.toDataURL('image/png') : null }
        }, { sb, w, q, full: !!opt.full })
        const file = join(out, `${sb.slug}.jpg`)
        writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'))
        if (r.full) writeFileSync(join(out, `${sb.slug}-full.png`), Buffer.from(r.full.split(',')[1], 'base64'))
        console.log(JSON.stringify({ slug: sb.slug, file, bytes: statSync(file).size, scene: r.scene, style: r.style, mascot: r.mascot, ms: Math.round(r.ms), pb: r.pb }))
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
    } else throw new Error('mode: sheet | strip | film | thumb | lines')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exit(1) })
