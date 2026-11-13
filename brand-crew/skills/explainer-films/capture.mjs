// Record the site's own interactive widgets being used, as clips an article
// can embed with <Video> and a Story v2 film can play full-frame.
//
//   node brand-crew/skills/explainer-films/capture.mjs brand-crew/skills/explainer-films/shots/<slug>.json
//        [--base=http://localhost:3457] [--only=name,name] [--out=<dir>] [--keep-frames]
//
// The site has to be running (`pnpm dev` on a free port, or `pnpm build &&
// PORT=3000 pnpm start`). Start it with NEXT_PUBLIC_MEDIA_BASE=<the same
// origin>, so the page loads its media from public/ on this machine: the CDN
// refuses a localhost referer (hotlink protection), and a recording of a
// widget with broken images is not a recording of the widget.
//
// A shot list is JSON:
//
//   { "page": "/articles/e-means",
//     "shots": [ {
//       "name": "play-lloyd",                       → public/articles/e-means/play-lloyd.{mp4,webm} + -poster.jpg + .cues.json
//       "target": "figure:has-text('Lloyd vs e-means')",   the element that is filmed (Playwright selector)
//       "fit": "contain",                           contain: the whole element on the page's ground (default);
//                                                    cover: a 16:9 window of it, centred (a 3D canvas)
//       "pad": 16, "cursor": true, "theme": "light", "poster": 3.5 (seconds),
//       "size": [1280, 720],                        the clip's size; without it, the target's own shape at up to 1440 px wide
//       "window": [0, 560],                         only this band of a tall target, in CSS px from its top
//       "hide": ["button[aria-label='Toggle full screen']"],   page chrome over the target that is not the subject
//       "before": [ ... ],                          actions run before the camera rolls (load a model, pick a setting)
//       "actions": [
//         { "wait": 1.0 },
//         { "click": "button:has-text('play')", "cue": "play" },
//         { "hover": "svg >> nth=0", "at": [0.4, 0.5], "over": 0.6 },
//         { "drag": "canvas", "from": [0.3, 0.5], "to": [0.7, 0.45], "over": 2.5 },
//         { "slide": "input[aria-label='epoch']", "to": 0.2, "over": 2 },    a range input, dragged to a fraction of its track
//         { "select": "select", "value": "living" },
//         { "key": "w", "hold": 2.5 },
//         { "wheel": "canvas", "dy": -400, "over": 1 } ] } ] }
//
// Time is virtual. The page's clock (Date, timers, requestAnimationFrame,
// performance.now) is Playwright's; each frame advances it by exactly 1/24 s
// and takes a screenshot, so a clip is the same on a slow machine as on a
// fast one, a WebGL viewer never drops a frame, and an action lands on the
// frame the cue list says. Every action writes a cue (its time in the clip);
// a storyboard's footage steps are cut against <name>.cues.json.
//
// Nothing here is hashed into any film. The clips are media: they live under
// public/articles/<slug>/, are pushed with `pnpm media:push`, and a film may
// use one only if the article itself embeds it.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..', '..')
const FPS = 24, FF = process.env.EXPLAINER_FFMPEG || 'ffmpeg'
const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const file = args.find(a => !a.startsWith('--'))
if (!file) { console.error('usage: capture.mjs <shots.json> [--base=http://localhost:3457] [--only=a,b] [--out=dir]'); process.exit(2) }
const list = JSON.parse(readFileSync(file, 'utf8'))
const BASE = (opt.base || list.base || 'http://localhost:3457').replace(/\/+$/, '')
const only = opt.only ? String(opt.only).split(',') : null

async function chromium() {
  const require = createRequire(import.meta.url)
  for (const p of [process.env.PLAYWRIGHT_PATH, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { const m = await import(p.startsWith('/') ? pathToFileURL(p).href : p); const c = m.chromium || (m.default && m.default.chromium); if (c) return c } catch {}
    try { const c = require(p).chromium; if (c) return c } catch {}
  }
  throw new Error('playwright not found: set NODE_PATH or PLAYWRIGHT_PATH (SKILL.md, "Rendering on a Mac")')
}
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }

// what the page shows while it is filmed: no dev badge, no sticky header over
// the widget, no smooth scrolling, and a drawn pointer (a headless page has none)
const CSS = `
  nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important }
  html { scroll-behavior: auto !important }
  header, [data-site-header], .sticky { position: static !important }
  #__cap_cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
    transform: translate(-100px, -100px); transition: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)) }
  #__cap_cursor.down { scale: .86 }
`
const CURSOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22"><path d="M3 2l15 8.2-6.6 1.5L8.7 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`

async function shoot(browser, shot) {
  // "size": [w, h] films a window of that shape; without it the clip keeps the
  // target's own shape, at up to 1440 px wide (a film crops into it, so the
  // pixels are worth keeping)
  let size = shot.size || null
  const dsf = shot.dsf || 2
  const ctx = await browser.newContext({ viewport: { width: shot.viewport?.[0] || 1280, height: shot.viewport?.[1] || 1500 }, deviceScaleFactor: dsf, colorScheme: shot.theme === 'dark' ? 'dark' : 'light', reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  const bad = []
  page.on('requestfailed', r => bad.push(`failed ${r.url().slice(0, 140)}`))
  page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 140)}`) })
  page.on('pageerror', e => bad.push(`page error: ${e.message.slice(0, 200)}`))
  await page.clock.install()
  // 'load', then a pause for hydration: a dev server's open sockets never let the network go idle
  await page.goto(BASE + (shot.page || list.page), { waitUntil: 'load', timeout: 240000 })
  await page.waitForTimeout(shot.settle ?? 2500)
  if (shot.theme) await page.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); try { localStorage.setItem('theme', t) } catch {} }, shot.theme)
  // "hide": selectors of page chrome that sits over the target and is not part of what is being shown
  await page.addStyleTag({ content: CSS + (shot.hide || []).map(h => `${h} { visibility: hidden !important }`).join('\n') })
  const root = page.locator(shot.target).first()
  await root.waitFor({ state: 'attached', timeout: 60000 })
  await root.evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -40))
  await page.waitForTimeout(600)

  const find = sel => (sel ? (sel.startsWith('page:') ? page.locator(sel.slice(5)).first() : root.locator(sel).first()) : root)
  const point = async (sel, at = [.5, .5]) => { const b = await find(sel).boundingBox(); if (!b) throw new Error(`${shot.name}: nothing matches ${sel}`); return [b.x + b.width * at[0], b.y + b.height * at[1]] }

  // ---- the frame loop: one screenshot per 1/24 s of the page's own clock ----
  let rolling = false, n = 0, enc = null, clip = null, mouse = [-100, -100]
  const cues = []
  const tick = async (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      if (!rolling) { await page.waitForTimeout(1000 / FPS); continue }
      await page.clock.runFor(1000 / FPS)
      const buf = await page.screenshot({ clip, type: 'jpeg', quality: 93, animations: 'allow', caret: 'hide' })
      await new Promise(res => (enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res)))
      n++
    }
  }
  const secs = s => tick(Math.max(1, Math.round(s * FPS)))
  const moveTo = async (to, over = .5) => {
    const from = mouse[0] < 0 ? [to[0] - 60, to[1] - 40] : mouse, f = Math.max(1, Math.round(over * FPS))
    for (let i = 1; i <= f; i++) { const k = ease(i / f); mouse = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; await page.mouse.move(mouse[0], mouse[1]); await tick() }
  }
  const act = async a => {
    const cue = a.cue || Object.keys(a).find(k => !['over', 'at', 'from', 'to', 'cue', 'hold', 'value', 'dy', 'then'].includes(k))
    if (rolling && !('wait' in a && !a.cue)) cues.push({ t: +(n / FPS).toFixed(3), cue, ...(typeof a[cue] === 'string' ? { on: a[cue] } : {}) })
    if ('wait' in a) await secs(a.wait)
    else if (a.click) {
      await moveTo(await point(a.click, a.at), a.over ?? .5)
      await page.evaluate(() => document.getElementById('__cap_cursor')?.classList.add('down'))
      await page.mouse.down(); await tick(2); await page.mouse.up()
      await page.evaluate(() => document.getElementById('__cap_cursor')?.classList.remove('down'))
      await secs(a.then ?? .35)
    } else if (a.hover) { await moveTo(await point(a.hover, a.at), a.over ?? .6); await secs(a.then ?? .3) }
    else if (a.drag) {
      await moveTo(await point(a.drag, a.from), a.lead ?? .4)
      await page.mouse.down(); await tick()
      await moveTo(await point(a.drag, a.to), a.over ?? 1.5)
      await page.mouse.up(); await secs(a.then ?? .2)
    } else if (a.slide) {
      // a range input: press where its thumb is now, drag to the fraction asked for
      const el = find(a.slide), now = await el.evaluate(e => (Number(e.value) - Number(e.min || 0)) / (Number(e.max || 100) - Number(e.min || 0)))
      const pad = 9, b = await el.boundingBox(), x = k => b.x + pad + (b.width - 2 * pad) * k, y = b.y + b.height / 2
      await moveTo([x(now), y], a.lead ?? .4)
      await page.mouse.down(); await tick()
      await moveTo([x(a.to), y], a.over ?? 1.5)
      await page.mouse.up(); await secs(a.then ?? .2)
    } else if (a.select) { await find(a.select).selectOption(a.value); await secs(a.then ?? .3) }
    else if (a.key) { await find(a.on).focus().catch(() => {}); await page.keyboard.down(a.key); await secs(a.hold ?? .2); await page.keyboard.up(a.key); await secs(a.then ?? .1) }
    else if (a.wheel) {
      await moveTo(await point(a.wheel, a.at), a.lead ?? .3)
      const f = Math.max(1, Math.round((a.over ?? 1) * FPS)); for (let i = 0; i < f; i++) { await page.mouse.wheel(0, a.dy / f); await tick() }
    } else if (a.move) await moveTo(await point(a.on, a.move), a.over ?? .6)
    else if (a.waitFor) await find(a.waitFor).waitFor({ state: a.state || 'visible', timeout: 120000 })
    else throw new Error(`${shot.name}: unknown action ${JSON.stringify(a)}`)
  }

  // before the camera rolls: real time (a model downloads, a chunk loads)
  for (const a of shot.before || []) await act(a)
  await page.waitForTimeout(400)

  // the window that is filmed: the target, in the clip's shape
  const b = await root.boundingBox(), pad = shot.pad ?? 16
  // "window": [top, bottom] films only that band of a tall target (CSS px from its top)
  if (shot.window) { const [y0, y1] = shot.window; b.y += y0; b.height = Math.min(b.height - y0, (y1 ?? b.height) - y0) }
  if (!size) { const w = Math.min(shot.maxW || 1440, Math.round((b.width + 2 * pad) * dsf)); size = [w - (w % 2), Math.round(w * (b.height + 2 * pad) / (b.width + 2 * pad) / 2) * 2] }
  const A = size[0] / size[1]
  if (shot.fit === 'cover') {
    let w = b.width, h = w / A; if (h > b.height) { h = b.height; w = h * A }
    clip = { x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, width: w, height: h }
  } else {
    let w = b.width + 2 * pad, h = b.height + 2 * pad
    if (w / h < A - 1e-3) w = h * A; else if (w / h > A + 1e-3) h = w / A
    clip = { x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, width: w, height: h }
    const vp = page.viewportSize()
    if (clip.x < 0 || clip.x + clip.width > vp.width || clip.y < 0 || clip.y + clip.height > vp.height) console.error(`! ${shot.name}: the ${Math.round(clip.width)}x${Math.round(clip.height)} window around the target does not fit the ${vp.width}x${vp.height} viewport (set "viewport", or "fit": "cover")`)
    clip.x = Math.max(0, clip.x); clip.y = Math.max(0, clip.y)
  }
  if (shot.cursor !== false) {
    await page.evaluate(svg => {
      const d = document.createElement('div'); d.id = '__cap_cursor'; d.innerHTML = svg; document.body.appendChild(d)
      addEventListener('mousemove', e => { d.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)` }, true)
    }, CURSOR)
  }

  const outDir = opt.out ? resolve(String(opt.out)) : join(ROOT, 'public', (shot.page || list.page).replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  const base = join(outDir, shot.name), raw = base + '.raw.mp4'
  // the master is near-lossless; the two files the article serves are cut from it
  enc = spawn(FF, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', `scale=${size[0]}:${size[1]}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', raw], { stdio: ['pipe', 'inherit', 'inherit'] })
  const encoded = new Promise((res, rej) => enc.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  rolling = true
  const t0 = Date.now()
  for (const a of shot.actions) await act(a)
  enc.stdin.end(); await encoded
  rolling = false
  await ctx.close()

  const run = a => { const r = spawnSync(FF, ['-v', 'error', '-y', ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr) }
  // H.264 for Safari, VP9 first in <Video> for everyone else; no audio (the player is muted)
  run(['-i', raw, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(shot.crf || 25), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', base + '.mp4'])
  run(['-i', raw, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(shot.crf9 || 36), '-row-mt', '1', '-an', base + '.webm'])
  run(['-ss', String(shot.poster ?? Math.min(2, n / FPS / 2)), '-i', raw, '-frames:v', '1', '-q:v', '3', base + '-poster.jpg'])
  if (!opt['keep-frames']) rmSync(raw, { force: true })
  const dur = +(n / FPS).toFixed(3)
  // the cue list sits beside the shot list, not in public/: it is authoring data, not media
  const cueDir = join(dirname(resolve(file)), 'cues'); mkdirSync(cueDir, { recursive: true })
  writeFileSync(join(cueDir, `${list.slug || 'shots'}.${shot.name}.json`), JSON.stringify({ clip: `${(shot.page || list.page)}/${shot.name}`, duration: dur, fps: FPS, cues }, null, 1) + '\n')
  console.log(JSON.stringify({ shot: shot.name, duration: dur, frames: n, wallS: Math.round((Date.now() - t0) / 1000), out: base + '.mp4', cues, problems: [...new Set(bad)].slice(0, 12) }))
}

const main = async () => {
  const cr = await chromium()
  // the machine's own GPU where there is one (a 3D viewer is WebGL2); software otherwise
  const gpu = process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  const browser = await cr.launch({ headless: true, args: ['--no-sandbox', '--ignore-gpu-blocklist', ...gpu] })
  try { for (const shot of list.shots) if (!only || only.includes(shot.name)) await shoot(browser, shot) } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exit(1) })
