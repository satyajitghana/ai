// Math-reel renderer. Headless Chromium paints each frame (reel.html), the
// page is screenshotted, and the JPEG frames are piped to ffmpeg with a
// procedural music bed (audio.py) muxed in as AAC.
//
//   node render.mjs <spec.json ...> --out=public/films/math/ [--workers=2] [--crf=32] [--fps=30]
//        -> <id>.mp4 (1280x720 H.264 + AAC) and <id>-poster.webp per spec
//   node render.mjs frame <spec.json> --t=4.5[,9,13] --out=x.png   single-frame previews
//   node render.mjs sheet <spec.json> --every=1 [--cols=5] [--w=320] --out=sheet.jpg
//   node render.mjs plan  <spec.json ...>   timings, sound events and computed checks; paints nothing
//
// Options: --chrome=<path to chrome.exe>  (win32 default: system Chrome, then Edge)
//          --python=<python>  --ffmpeg=<ffmpeg>  --no-audio  --keep-wav
//
// Full renders (the default mode) run on the Windows render farm. On Linux
// the default mode refuses unless --allow-linux is passed, because the shared
// Linux server must not encode video; frame/sheet/plan are fine anywhere.
//
// Patterns follow brand-crew/skills/explainer-films/render.mjs (playwright
// discovery, image2pipe into x264 -tune animation, one page per worker) but
// nothing is imported from it: that folder is hashed into every explainer
// film's freshness check.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')

const args = process.argv.slice(2)
const MODES = ['frame', 'sheet', 'plan']
const mode = MODES.includes(args[0]) ? args[0] : 'reel'
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const files = args.slice(mode === 'reel' ? 0 : 1).filter(a => !a.startsWith('--'))
const FPS = +(opt.fps || 30)

async function chromium() {
  const require = createRequire(join(ROOT, 'package.json'))
  for (const p of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try { const m = await import(p.startsWith('/') ? pathToFileURL(p).href : p); const c = m.chromium || (m.default && m.default.chromium); if (c) return c } catch {}
    try { const c = require(p).chromium; if (c) return c } catch {}
  }
  throw new Error('playwright not found (npm i -g playwright, or install it beside the repo)')
}

// On Windows, drive the installed Chrome (or Edge) through Playwright rather
// than a downloaded Chromium: the farm machines already have it. Reels are
// Canvas2D + DOM only (no WebGL), so no GPU setup is needed on any platform.
// Elsewhere, Playwright's own Chromium is used.
function systemChrome() {
  if (opt.chrome) return opt.chrome
  if (process.platform !== 'win32') return null
  const bases = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  const cands = bases.flatMap(b => [join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe')])
  return cands.find(existsSync) || null
}

async function launch() {
  const cr = await chromium()
  const exe = systemChrome()
  const a = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files']
  if (exe) return cr.launch({ executablePath: exe, headless: true, args: a })
  return cr.launch({ headless: true, args: a })
}

function katexBase() {
  const require = createRequire(join(ROOT, 'package.json'))
  const js = require.resolve('katex/dist/katex.min.js')
  return pathToFileURL(dirname(js)).href + '/'
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(opt.dpr || 1) })
  page.on('pageerror', e => console.error('page error:', e.message))
  page.on('console', m => { if (m.type() === 'error') console.error('page console:', m.text()) })
  await page.goto(pathToFileURL(join(HERE, 'reel.html')).href + '?katex=' + encodeURIComponent(katexBase()))
  await page.evaluate(() => window.READY)
  return page
}
const loadSpec = f => JSON.parse(readFileSync(f, 'utf8'))
async function loadInto(page, spec) {
  const info = await page.evaluate(s => REEL.load(s), spec)
  await page.evaluate(() => document.fonts.ready.then(() => true))
  return info
}
const shot = async (page, t, type = 'jpeg') => {
  await page.evaluate(t => REEL.frame(t), t)
  return page.screenshot({ type, ...(type === 'jpeg' ? { quality: +(opt.q || 92) } : {}), clip: { x: 0, y: 0, width: 1280, height: 720 } })
}

// ---------------------------------------------------------------- audio --
function bed(spec, info, dir) {
  if (opt['no-audio']) return null
  const py = opt.python || (process.platform === 'win32' ? 'python' : 'python3')
  const ev = join(dir, `${spec.id}-events.json`), wav = join(dir, `${spec.id}.wav`)
  writeFileSync(ev, JSON.stringify({ id: spec.id, duration: info.duration, events: info.events }))
  const r = spawnSync(py, [join(HERE, 'audio.py'), ev, wav], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`audio.py failed for ${spec.id}: ${r.stderr || r.error}`)
  return wav
}

// ----------------------------------------------------------------- reels --
const write = (stream, buf) => new Promise(res => (stream.write(buf) ? res() : stream.once('drain', res)))
async function reel(page, file, out, tmp) {
  const spec = loadSpec(file)
  const info = await loadInto(page, spec)
  const n = Math.round(info.duration * FPS)
  const wav = bed(spec, info, tmp)
  const mp4 = join(out, `${spec.id}.mp4`)
  const ff = spawn(opt.ffmpeg || 'ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(wav ? ['-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf || 32), '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-t', info.duration.toFixed(3), '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  const t0 = Date.now()
  for (let i = 0; i < n; i++) await write(ff.stdin, await shot(page, i / FPS))
  ff.stdin.end()
  // poster: the object at its fullest, with the chrome naming the family
  const png = await shot(page, info.posterT, 'png')
  const webp = await page.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode()
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').drawImage(im, 0, 0)
    return c.toDataURL('image/webp', .82)
  }, png.toString('base64'))
  const poster = join(out, `${spec.id}-poster.webp`)
  writeFileSync(poster, Buffer.from(webp.split(',')[1], 'base64'))
  await done
  if (wav && !opt['keep-wav']) rmSync(wav, { force: true })
  const r = { id: spec.id, duration: info.duration, frames: n, msPerFrame: Math.round((Date.now() - t0) / n), mp4, bytes: statSync(mp4).size, poster, posterBytes: statSync(poster).size, checks: info.checks }
  console.log(JSON.stringify(r))
  return r
}

const main = async () => {
  if (!files.length) throw new Error('usage: node render.mjs <spec.json ...> --out=dir | frame <spec> --t=s --out=x.png | sheet <spec> --every=1 --out=s.jpg | plan <spec ...>')
  if (mode === 'reel' && process.platform === 'linux' && !opt['allow-linux']) throw new Error('full reel renders run on the Windows farm; this Linux server only makes previews (frame | sheet | plan). Pass --allow-linux on a machine where encoding is allowed.')
  const browser = await launch()
  try {
    if (mode === 'plan') {
      const page = await openPage(browser)
      for (const f of files) {
        try { console.log(JSON.stringify(await loadInto(page, loadSpec(f)))) }
        catch (e) { console.error(`${basename(f)}: ${String(e.message).split('\n')[0].replace(/^page\.evaluate: Error: /, '')}`); process.exitCode = 1 }
      }
    } else if (mode === 'frame') {
      const page = await openPage(browser)
      const spec = loadSpec(files[0]); const info = await loadInto(page, spec)
      const ts = String(opt.t ?? info.posterT).split(',').map(Number)
      const out = opt.out || `${spec.id}.png`
      mkdirSync(dirname(resolve(out)), { recursive: true })
      for (const t of ts) {
        const f = ts.length > 1 ? out.replace(/(\.png)?$/, `-${t.toFixed(2)}s.png`) : out
        writeFileSync(f, await shot(page, t, 'png'))
        console.log(JSON.stringify({ id: spec.id, t, file: f }))
      }
    } else if (mode === 'sheet') {
      const page = await openPage(browser)
      const spec = loadSpec(files[0]); const info = await loadInto(page, spec)
      const every = +(opt.every || 1), times = []
      for (let t = +(opt.start || .5); t < info.duration; t += every) times.push(+t.toFixed(3))
      const cols = +(opt.cols || 5), w = +(opt.w || 320), h = Math.round(w * 9 / 16)
      const shots = [], paint = [], cap = []
      for (const t of times) {
        const t0 = Date.now()
        paint.push(await page.evaluate(t => { const a = performance.now(); REEL.frame(t); document.body.offsetHeight; return performance.now() - a }, t))
        const t1 = Date.now()
        shots.push((await page.screenshot({ type: 'jpeg', quality: +(opt.q || 92), clip: { x: 0, y: 0, width: 1280, height: 720 } })).toString('base64'))
        cap.push(Date.now() - t1)
      }
      const st = a => { const s = [...a].sort((x, y) => x - y); return { mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p50: +s[s.length >> 1].toFixed(1), max: +s[s.length - 1].toFixed(1) } }
      if (opt.bench) console.log(JSON.stringify({ id: spec.id, paintMs: st(paint), screenshotMs: st(cap) }))
      const url = await page.evaluate(async ({ shots, times, cols, w, h }) => {
        const rows = Math.ceil(shots.length / cols), c = document.createElement('canvas'); c.width = cols * w; c.height = rows * (h + 20)
        const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height)
        for (let i = 0; i < shots.length; i++) { const im = new Image(); im.src = 'data:image/jpeg;base64,' + shots[i]; await im.decode(); const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 20); g.drawImage(im, x, y, w, h); g.fillStyle = '#bbb'; g.font = '12px monospace'; g.fillText(times[i].toFixed(2) + 's', x + 4, y + h + 14) }
        return c.toDataURL('image/jpeg', .88)
      }, { shots, times, cols, w, h })
      const out = opt.out || `${spec.id}-sheet.jpg`; mkdirSync(dirname(resolve(out)), { recursive: true })
      writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
      console.log(JSON.stringify({ id: spec.id, out, frames: times.length }))
    } else {
      const out = opt.out || 'public/films/math'; mkdirSync(out, { recursive: true })
      const tmp = mkdtempSync(join(tmpdir(), 'math-reels-'))
      const queue = [...files], workers = Math.max(1, Math.min(+(opt.workers || 1), queue.length))
      try {
        await Promise.all(Array.from({ length: workers }, async () => {
          const page = await openPage(browser)
          while (queue.length) { const f = queue.shift(); try { await reel(page, f, out, tmp) } catch (e) { console.error(`${basename(f)}: ${e.message}`); process.exitCode = 1 } }
        }))
      } finally { rmSync(tmp, { recursive: true, force: true }) }
    }
  } finally { await browser.close() }
}
main().catch(e => { console.error(e.message || e); process.exit(1) })
