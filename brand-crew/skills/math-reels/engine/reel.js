// Math reels: one 15-20 s, 1280x720 reel per openai/math result family.
//
//   REEL.load(spec) -> { duration, scenes, events, posterT, checks }
//   REEL.frame(t)   paints the frame at time t (seconds)
//
// A frame is a pure function of (spec, t): no timers, no transitions, no
// randomness that is not seeded. Graphics go on the canvas; text and math are
// DOM labels (KaTeX) in #ui, reused by key from frame to frame. The spec
// contract lives in ../SKILL.md and ../schema.json.
'use strict'

const W = 1280, H = 720
const cv = document.getElementById('c'), g = cv.getContext('2d')
const UI = document.getElementById('ui')

// ---------------------------------------------------------------- palette --
const K = {
  bg: '#0b0d12', ink: '#ECE9E2', soft: '#C3C8D0', mute: '#8E95A1', faint: '#4A515E', line: '#262B35',
  ok: '#7BD88F', warn: '#E7B65C', bad: '#F07C7C', hot: '#FFD479', cool: '#9FB4D6',
}
// One accent per discipline, all at a similar lightness so no reel shouts.
// Names are exactly the review/catalogue discipline strings.
const DISCIPLINES = {
  'Number theory': '#F2A65A',
  'Algebraic and complex geometry': '#C792EA',
  'Real and complex analysis': '#7FD1C7',
  'Convex and metric geometry': '#E6C86E',
  'Theoretical computer science': '#6CB6FF',
  'Dynamical systems and ergodic theory': '#F08BB3',
  'Combinatorics': '#8BD17C',
  'Algebra': '#B4A7FF',
  'Probability and statistical mechanics': '#FF8F7A',
  'Mathematical logic': '#A8C7FA',
  'Group theory': '#E39BF0',
  'Mathematical physics': '#5FD4F4',
  'Operator algebras': '#93A3FF',
  'Topology': '#D7E37A',
  'Functional analysis': '#74E0A6',
  'Differential geometry': '#F6C177',
  'Partial differential equations': '#E8A87C',
}
const KINDS = {
  'proof': 'Claimed proof', 'disproof': 'Claimed disproof', 'counterexample': 'Claimed counterexample',
  'improved-bound': 'Claimed improved bound', 'partial': 'Claimed partial result', 'conditional': 'Claimed conditional result',
}
const STAMPS = { proved: 'Proved', disproved: 'Disproved', counterexample: 'Counterexample', improved: 'Improved', partial: 'Partly proved', conditional: 'Proved, conditionally' }
const LEAN = {
  main: { text: 'Lean-checked: main theorem', color: K.ok, icon: 'check' },
  part: { text: 'Lean: part only', color: K.warn, icon: 'half' },
  none: { text: 'Manuscript only', color: K.mute, icon: 'doc' },
}
const DUR = { title: [2, 3, 2.6], object: [6, 9, 8], achievement: [3, 5, 4.4], verify: [2, 3, 2.6], end: [1.2, 2, 1.6] }
const LIMITS = { short: 44, title: 64, subtitle: 110, heading: 72, text: 96, note: 80, detail: 100, label: 72, context: 110, ourCheck: 80, review: 40 }

let ACC = '#6CB6FF', SPEC = null, PLAN = null, ALPHA = 1

// ------------------------------------------------------------------ maths --
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const lerp = (a, b, e) => a + (b - a) * e
const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const eout = x => 1 - Math.pow(1 - x, 3)
const eback = x => { const c = 1.4, d = x - 1; return 1 + (c + 1) * d * d * d + c * d * d }
function hexrgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const rgba = (h, a) => { const [r, gg, b] = hexrgb(h); return `rgba(${r},${gg},${b},${a})` }
function tone(n) {
  if (!n) return K.ink
  if (n[0] === '#') return n
  return { accent: ACC, claim: ACC, new: ACC, ink: K.ink, soft: K.soft, old: K.mute, mute: K.mute, faint: K.faint, ok: K.ok, warn: K.warn, bad: K.bad, hot: K.hot, cool: K.cool }[n] || K.ink
}
// a seeded PRNG for anything decorative; seeded by family id
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }

// ------------------------------------------------------------- text / math --
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function texHTML(src, display) {
  return katex.renderToString(src, {
    throwOnError: true, displayMode: !!display, strict: 'ignore', output: 'html',
    // '##' is a literal '#' inside a macro body
    macros: { '\\hl': `\\textcolor{#${ACC}}{#1}`, '\\mute': `\\textcolor{#${K.mute}}{#1}`, '\\hot': `\\textcolor{#${K.hot}}{#1}` },
  })
}
// Rich text: "plain $tex$ ==accent== **bold**". Everything that is not Latin
// text goes in $...$ so it is set by KaTeX's fonts, never a system fallback.
function rich(s) {
  const out = []
  String(s).split(/(\$[^$]+\$)/).forEach(part => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) out.push(texHTML(part.slice(1, -1)))
    else out.push(esc(part).replace(/==(.+?)==/g, `<span style="color:${ACC}">$1</span>`).replace(/\*\*(.+?)\*\*/g, '<b style="font-weight:680">$1</b>'))
  })
  return out.join('')
}

// DOM labels, pooled by key. Each frame marks what it uses; the rest hide.
const pool = new Map(); let used = new Set()
function L(key, html, o = {}) {
  let e = pool.get(key)
  if (!e) { e = document.createElement('div'); e.className = 'lb'; UI.appendChild(e); pool.set(key, e); e._h = null; e._c = null }
  const cls = 'lb ' + (o.cls || '') + (o.w ? ' wrap' : '')
  if (e._c !== cls) { e.className = cls; e._c = cls }
  const sty = `${o.size || 26}|${o.color || K.ink}|${o.weight || ''}|${o.w || ''}|${o.align || ''}|${o.lh || ''}|${o.ls || ''}`
  if (e._s !== sty) {
    e._s = sty
    e.style.fontSize = (o.size || 26) + 'px'; e.style.color = o.color || K.ink
    e.style.fontWeight = o.weight || ''; e.style.width = o.w ? o.w + 'px' : ''
    e.style.textAlign = o.align || ''; e.style.lineHeight = o.lh || ''; e.style.letterSpacing = o.ls || ''
  }
  if (e._h !== html) { e.innerHTML = html; e._h = html }
  used.add(key)
  const op = clamp((o.op == null ? 1 : o.op) * ALPHA)
  e.style.opacity = op.toFixed(4)
  e.style.display = op <= .002 ? 'none' : ''
  const ax = o.ax || 0, ay = o.ay || 0, s = o.scale || 1
  e.style.transform = `translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px)${o.rot ? ` rotate(${o.rot}rad)` : ''} scale(${s}) translate(${-ax * 100}%,${-ay * 100}%)`
  return e
}
// size of a label without showing it (laid out, then hidden this frame)
function measure(key, html, o = {}) {
  const was = used.has(key), e = L(key, html, { ...o, op: 1 })
  const r = [e.offsetWidth, e.offsetHeight]
  if (!was) { used.delete(key); e.style.display = 'none' }
  return r
}

// ----------------------------------------------------------------- canvas --
function A(a) { g.globalAlpha = clamp(ALPHA * (a == null ? 1 : a)) }
function stroke(color, w, a, dash) { A(a); g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.setLineDash([]) }
function fill(color, a) { A(a); g.fillStyle = color; g.fill() }
function line(x1, y1, x2, y2, color, w = 2, a = 1, dash) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); stroke(color, w, a, dash) }
function dot(x, y, r, color, a = 1) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 2 * Math.PI); fill(color, a) }
function ring(x, y, r, color, w = 2, a = 1) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 2 * Math.PI); stroke(color, w, a) }
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }
// a polyline drawn up to fraction f of its length
function polyline(pts, f, color, w, a, dash) {
  if (f <= 0 || pts.length < 2) return
  let total = 0; const seglen = []
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seglen.push(d); total += d }
  let left = total * clamp(f)
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = seglen[i - 1], k = Math.min(1, left / (d || 1))
    g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d
  }
  stroke(color, w, a, dash)
}
function arrowHead(x, y, ang, size, color, a = 1) {
  g.beginPath(); g.moveTo(x, y)
  g.lineTo(x - size * Math.cos(ang - .45), y - size * Math.sin(ang - .45))
  g.lineTo(x - size * Math.cos(ang + .45), y - size * Math.sin(ang + .45)); g.closePath(); fill(color, a)
}
function icon(kind, x, y, r, color, a = 1, e = 1) {
  if (kind === 'check') {
    ring(x, y, r, color, 2.5, a); dot(x, y, r - 1, color, .14 * a)
    polyline([[x - r * .42, y + r * .02], [x - r * .1, y + r * .34], [x + r * .46, y - r * .32]], e, color, 3.2, a)
  } else if (kind === 'half') {
    ring(x, y, r, color, 2.5, a)
    g.beginPath(); g.arc(x, y, r - 4, Math.PI / 2, Math.PI * 1.5); g.closePath(); fill(color, .85 * a * e)
  } else if (kind === 'doc') {
    const w = r * 1.3, h = r * 1.7, x0 = x - w / 2, y0 = y - h / 2, f = r * .45
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w - f, y0); g.lineTo(x0 + w, y0 + f); g.lineTo(x0 + w, y0 + h); g.lineTo(x0, y0 + h); g.closePath(); stroke(color, 2.2, a)
    for (let i = 0; i < 3; i++) line(x0 + w * .22, y0 + h * (.42 + i * .17), x0 + w * (.78 - (i === 2 ? .2 : 0)), y0 + h * (.42 + i * .17), color, 2, a * e)
  }
}

// ------------------------------------------------------------- background --
let GRID = null
function background(t) {
  A(1); g.globalCompositeOperation = 'source-over'
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H)
  const gx = 1010 + 46 * Math.sin(t * .19), gy = 120 + 34 * Math.cos(t * .15)
  let gr = g.createRadialGradient(gx, gy, 0, gx, gy, 700)
  gr.addColorStop(0, rgba(ACC, .085)); gr.addColorStop(1, rgba(ACC, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H)
  gr = g.createRadialGradient(140, 760, 0, 140, 760, 620)
  gr.addColorStop(0, 'rgba(120,140,190,0.05)'); gr.addColorStop(1, 'rgba(120,140,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H)
  if (!GRID) {
    GRID = document.createElement('canvas'); GRID.width = W; GRID.height = H
    const q = GRID.getContext('2d'); q.fillStyle = 'rgba(255,255,255,0.045)'
    for (let x = 16; x < W; x += 32) for (let y = 16; y < H; y += 32) q.fillRect(x - .75, y - .75, 1.5, 1.5)
    const v = q.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .75)
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)'); q.fillStyle = v; q.fillRect(0, 0, W, H)
  }
  g.drawImage(GRID, 0, 0)
}

// --------------------------------------------------------------- the plan --
function need(c, msg) { if (!c) throw new Error(`reel ${SPEC && SPEC.id}: ${msg}`) }
function durOf(name, v) { const [a, b, d] = DUR[name]; if (v == null) return d; need(v >= a && v <= b, `${name}.dur ${v} outside ${a}-${b} s`); return v }

function load(spec) {
  SPEC = spec; pool.forEach(e => e.remove()); pool.clear()
  need(/^\d{3}$/.test(spec.id || ''), 'id must be a 3-digit family number')
  need(DISCIPLINES[spec.discipline], `unknown discipline "${spec.discipline}"`)
  need(KINDS[spec.kind], `kind must be one of ${Object.keys(KINDS).join(', ')}`)
  ACC = DISCIPLINES[spec.discipline]
  for (const k of ['title', 'object', 'achievement', 'verify']) need(spec[k], `missing "${k}"`)
  const order = [['title', spec.title], ['object', spec.object], ['achievement', spec.achievement], ['verify', spec.verify], ['end', spec.end || {}]]
  let t = 0; const scenes = []
  for (const [name, sc] of order) { const d = durOf(name, sc.dur); scenes.push({ name, sc, t0: t, t1: t + d, dur: d }); t += d }
  // panels of the object scene
  const ob = spec.object, panels = ob.panels || (ob.primitive ? [ob] : null)
  need(panels && panels.length >= 1 && panels.length <= 3, 'object needs 1-3 panels (or one primitive)')
  const layout = ob.layout || (panels.length === 1 ? 'single' : 'sequence')
  const od = scenes[1].dur
  panels.forEach((p, i) => {
    need(PRIM[p.primitive], `unknown primitive "${p.primitive}" (have: ${Object.keys(PRIM).join(', ')})`)
    if (layout === 'sequence') { p._t0 = p.from != null ? p.from : od * i / panels.length; p._t1 = p.until != null ? p.until : (i === panels.length - 1 ? od : (panels[i + 1].from != null ? panels[i + 1].from : od * (i + 1) / panels.length)) }
    else { p._t0 = p.from || 0; p._t1 = od }
    p._key = 'p' + i
  })
  ob._panels = panels; ob._layout = layout
  CHECKS = {}
  for (const p of panels) if (p.primitive === 'graph') { p._g = null; p._g0 = buildGraph(p, BOX); if (p._g0.cross) CHECKS.crossings = p._g0.cross.length }
  // events for the sound bed: every cut, plus the beats that land something
  const events = scenes.slice(1).map(s => ({ t: +s.t0.toFixed(3), kind: 'cut' }))
  for (const p of panels) for (const e of (PRIM[p.primitive].events ? PRIM[p.primitive].events(p) : [])) events.push({ t: +(scenes[1].t0 + p._t0 + e.t).toFixed(3), kind: e.kind })
  const ac = spec.achievement
  events.push({ t: +(scenes[2].t0 + 1.35).toFixed(3), kind: 'land' })
  if (ac.stamp || ac.form === 'status') events.push({ t: +(scenes[2].t0 + (ac.form === 'status' ? 1.5 : 2.4)).toFixed(3), kind: 'stamp' })
  events.push({ t: +(scenes[3].t0 + .45).toFixed(3), kind: 'badge' })
  events.sort((a, b) => a.t - b.t)
  PLAN = { scenes, duration: t, panels, events }
  checkText(spec)
  const o = scenes[1]
  return { id: spec.id, duration: +t.toFixed(3), scenes: scenes.map(s => ({ name: s.name, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3) })), events, posterT: +(o.t1 - .6).toFixed(3), checks: CHECKS }
}

// Text the viewer reads: length limits, and no glyph the fonts cannot set.
const LATIN = /^[\x20-\x7E -ÿ–—‘’“”·×…−]*$/
function checkText(spec) {
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const lim = LIMITS[path.split('.').pop()]
      const plain = v.replace(/\$[^$]+\$/g, 'x').replace(/==|\*\*/g, '')
      if (lim) need(plain.length <= lim, `${path} is ${plain.length} characters, limit ${lim}: "${v}"`)
      if (!/(^|\.)(tex|f|f2|expr|id|discipline|kind|primitive|preset|tone|side|form|stamp|lean|layout|mode|direction|status|parent|url)$/.test(path) && !/\.(deps|sources)\./.test(path)) {
        need(LATIN.test(v.replace(/\$[^$]+\$/g, '')), `${path}: put math and non-Latin symbols inside $...$ ("${v}")`)
        need((v.match(/\$/g) || []).length % 2 === 0, `${path}: unbalanced $ in "${v}"`)
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '.' + i))
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!k.startsWith('_') && k !== 'sources') walk(v[k], path ? path + '.' + k : k)
  }
  walk(spec, '')
}

// ---------------------------------------------------------------- framing --
const BOX = { x: 96, y: 128, w: 1088, h: 448 }
let CHECKS = {}

function frame(t) {
  used = new Set(); CHECKS = CHECKS || {}
  ALPHA = 1
  background(t)
  const { scenes, duration } = PLAN
  for (const s of scenes) {
    if (t < s.t0 - 1e-9 || t >= s.t1 + 1e-9) continue
    const lt = t - s.t0
    const last = s === scenes[scenes.length - 1]
    const fin = eout(seg(lt, 0, .55)), fout = last ? 1 - eio(seg(t, duration - .5, duration)) : 1 - eio(seg(lt, s.dur - .35, s.dur))
    ALPHA = fin * fout
    SCENES[s.name](s.sc, lt, s.dur, t)
    ALPHA = 1
  }
  // chrome: who this is, on every scene after the title
  const ti = scenes[0], en = scenes[scenes.length - 1]
  const ca = seg(t, ti.t1 - .2, ti.t1 + .4) * (1 - seg(t, en.t0 - .3, en.t0 + .1))
  if (ca > 0) chromeBar(ca)
  // progress hairline
  A(.5); g.fillStyle = ACC; g.fillRect(0, H - 3, W * clamp(t / duration), 3)
  for (const [k, e] of pool) if (!used.has(k) && e.style.display !== 'none') e.style.display = 'none'
  A(1)
}

function chromeBar(a) {
  ALPHA = a
  dot(84, 46, 6, ACC, 1)
  const idw = measure('ch.id', esc(SPEC.id), { cls: 'mono', size: 19 })[0]
  L('ch.id', esc(SPEC.id), { x: 100, y: 46, ay: .5, cls: 'mono', size: 19, color: K.soft })
  L('ch.t', rich(SPEC.short || SPEC.title.title), { x: 100 + idw + 14, y: 46, ay: .5, size: 19, color: K.mute, weight: 500 })
  L('ch.d', esc(SPEC.discipline), { x: W - 84, y: 46, ax: 1, ay: .5, cls: 'caps', size: 14, color: K.mute })
  ALPHA = 1
}

// ----------------------------------------------------------------- scenes --
const SCENES = {
  title(sc, lt) {
    const x = 96
    // giant family number, a quiet watermark on the right
    L('ti.num', esc(SPEC.id), { x: W - 70, y: 560, ax: 1, ay: .5, cls: 'mono', size: 230, color: rgba(ACC, .13), op: eout(seg(lt, 0, 1.2)), weight: 500 })
    L('ti.fam', 'Family', { x: W - 86, y: 428, ax: 1, ay: 1, cls: 'caps', size: 15, color: K.mute, op: eout(seg(lt, .2, 1)) })
    // discipline chip + kind
    const cy = 200, ce = eout(seg(lt, 0, .5))
    const [cw] = measure('ti.chip', esc(SPEC.discipline), { cls: 'caps', size: 16 })
    ALPHA *= ce
    rrect(x, cy - 19, cw + 50, 38, 19); fill(ACC, .12); stroke(ACC, 1.5, .75)
    dot(x + 20, cy, 5, ACC, 1)
    L('ti.chip', esc(SPEC.discipline), { x: x + 34, y: cy + 1, ay: .5, cls: 'caps', size: 16, color: ACC })
    const kx = x + cw + 66, kt = KINDS[SPEC.kind]
    const [kw] = measure('ti.kind', esc(kt), { cls: 'caps', size: 14 })
    rrect(kx, cy - 17, kw + 30, 34, 17); stroke(K.faint, 1.5, 1)
    L('ti.kind', esc(kt), { x: kx + 15, y: cy + 1, ay: .5, cls: 'caps', size: 14, color: K.soft })
    ALPHA /= ce || 1
    if (!ce) ALPHA = 0
    // title
    const te = eout(seg(lt, .15, .85))
    const tEl = L('ti.t', rich(sc.title), { x, y: 246 + 16 * (1 - te), w: 940, size: 60, weight: 640, lh: 1.08, ls: '-0.015em', op: te })
    const th = tEl.offsetHeight
    if (sc.subtitle) { const se = eout(seg(lt, .45, 1.1)); L('ti.s', rich(sc.subtitle), { x, y: 246 + th + 22 + 12 * (1 - se), w: 860, size: 27, color: K.soft, lh: 1.3, op: se }) }
    // accent rule
    const re = eio(seg(lt, .3, 1.2))
    line(x, 140, x + 80 * re, 140, ACC, 3, 1)
  },

  object(sc, lt, dur) {
    if (sc.heading) L('ob.h', rich(sc.heading), { x: 96, y: 100, ay: .5, size: 23, color: K.soft, weight: 520, op: eout(seg(lt, .1, .6)) })
    const panels = sc._panels, lay = sc._layout
    panels.forEach((p, i) => {
      let box = BOX
      if (lay === 'split') { const gw = 48, w = (BOX.w - gw * (panels.length - 1)) / panels.length; box = { x: BOX.x + i * (w + gw), y: BOX.y, w, h: BOX.h } }
      if (sc.heading) box = { ...box, y: box.y + 14, h: box.h - 14 }
      if (lt < p._t0 - 1e-9 || lt > p._t1 + 1e-9) return
      const pl = lt - p._t0, pd = p._t1 - p._t0
      const keep = ALPHA
      if (lay === 'sequence') ALPHA *= eout(seg(pl, 0, .45)) * (i === panels.length - 1 ? 1 : 1 - eio(seg(pl, pd - .4, pd)))
      if (ALPHA > .002) PRIM[p.primitive].draw(p, pl, box, p._key, pd)
      ALPHA = keep
    })
    // caption beats: the on-screen text is the caption
    const beats = sc.beats || []
    beats.forEach((b, i) => {
      const end = i + 1 < beats.length ? beats[i + 1].at : dur
      const e = eout(seg(lt, b.at, b.at + .4)) * (i + 1 < beats.length ? 1 - eio(seg(lt, end - .3, end)) : 1)
      if (e <= 0) return
      L('ob.b' + i, rich(b.text), { x: W / 2, y: 640 + 8 * (1 - e), ax: .5, ay: .5, w: 1060, align: 'center', size: 28, color: K.ink, lh: 1.25, op: e, weight: 470 })
    })
  },

  achievement(sc, lt) {
    if (sc.heading) L('ac.h', rich(sc.heading), { x: 96, y: 100, ay: .5, size: 23, color: K.soft, weight: 520, op: eout(seg(lt, .1, .6)) })
    if (sc.form === 'status') return achievementStatus(sc, lt)
    // before -> after, side by side
    const yB = 330, xL = 96, xR = 712
    const be = eout(seg(lt, .1, .7)), dim = 1 - .45 * eio(seg(lt, 1.3, 2.0))
    L('ac.bl', esc(sc.before.label), { x: xL, y: yB - 92, cls: 'caps', size: 15, color: K.mute, op: be })
    L('ac.bv', rich(`$${sc.before.tex}$`), { x: xL, y: yB, ay: .5, size: 52, color: K.soft, op: be * dim })
    if (sc.before.note) L('ac.bn', rich(sc.before.note), { x: xL, y: yB + 62, size: 21, color: K.mute, op: be * dim, w: 500 })
    // the arrow
    const ae = eio(seg(lt, .75, 1.35)), ax0 = 600, ax1 = 664
    line(ax0, yB, lerp(ax0, ax1, ae), yB, ACC, 3, 1)
    if (ae > .05) arrowHead(lerp(ax0, ax1, ae) + 6, yB, 0, 15, ACC, ae)
    const fe = eout(seg(lt, 1.3, 2.0))
    L('ac.al', esc(sc.after.label), { x: xR, y: yB - 92, cls: 'caps', size: 15, color: ACC, op: fe })
    L('ac.av', rich(`$${sc.after.tex}$`), { x: xR, y: yB + 10 * (1 - fe), ay: .5, size: 60, color: K.ink, op: fe, scale: lerp(.96, 1, fe) })
    if (sc.after.note) L('ac.an', rich(sc.after.note), { x: xR, y: yB + 66, size: 21, color: K.soft, op: fe, w: 480 })
    // optional stamp, and a line underneath
    if (sc.stamp) stamp(sc.stamp, 1040, 470, lt - 2.4, .8)
    if (sc.note) { const ne = eout(seg(lt, 2.1, 2.7)); L('ac.n', rich(sc.note), { x: W / 2, y: 560, ax: .5, ay: .5, w: 1060, align: 'center', size: 25, color: K.soft, op: ne, lh: 1.3 }) }
    return null
  },

  verify(sc, lt) {
    const L0 = LEAN[sc.lean]
    need(L0, 'verify.lean must be main | part | none')
    const e = eout(seg(lt, .1, .6)), cx = W / 2, cy = 270
    const html = esc(L0.text)
    const [tw] = measure('ve.t', html, { size: 38, weight: 620 })
    const bw = tw + 130, bh = 92, bx = cx - bw / 2
    rrect(bx, cy - bh / 2 + 10 * (1 - e), bw, bh, 22); fill(L0.color, .08 * e); stroke(L0.color, 2, .85 * e)
    icon(L0.icon, bx + 50, cy + 10 * (1 - e), 22, L0.color, e, eio(seg(lt, .4, 1.0)))
    L('ve.t', html, { x: bx + 90, y: cy + 10 * (1 - e), ay: .5, size: 38, weight: 620, color: K.ink, op: e })
    if (sc.detail) L('ve.d', rich(sc.detail), { x: cx, y: cy + 82, ax: .5, w: 1000, align: 'center', size: 25, color: K.soft, op: eout(seg(lt, .4, 1)), lh: 1.3 })
    // the standing caveat
    const pe = eout(seg(lt, .8, 1.4)), py = 488
    const ptxt = esc(sc.review || 'Claim, not yet peer-reviewed')
    const [pw] = measure('ve.p', ptxt, { size: 22, weight: 560 })
    rrect(cx - pw / 2 - 26, py - 24, pw + 52, 48, 24); stroke(K.warn, 1.5, .8 * pe); fill(K.warn, .07 * pe)
    L('ve.p', ptxt, { x: cx, y: py, ax: .5, ay: .5, size: 22, weight: 560, color: K.warn, op: pe })
    if (sc.ourCheck) L('ve.o', rich(sc.ourCheck), { x: cx, y: py + 52, ax: .5, size: 19, color: K.mute, op: eout(seg(lt, 1.0, 1.6)) })
  },

  end(sc, lt) {
    const e = eout(seg(lt, 0, .5)), cx = W / 2
    line(cx - 40 * e, 268, cx + 40 * e, 268, ACC, 3, 1)
    L('en.u', 'ai.thesatyajit.com', { x: cx, y: 330, ax: .5, ay: .5, size: 54, weight: 640, ls: '-0.01em', op: e })
    L('en.p', esc(sc.path || '/articles/openai-math'), { x: cx, y: 386, ax: .5, ay: .5, cls: 'mono', size: 22, color: K.mute, op: e })
    L('en.f', `Family ${esc(SPEC.id)} of openai/math · drawn from the release and our review`, { x: cx, y: 470, ax: .5, ay: .5, size: 19, color: K.mute, op: eout(seg(lt, .2, .7)) })
  },
}

function achievementStatus(sc, lt) {
  const cx = W / 2
  const le = eout(seg(lt, .05, .6))
  L('as.l', esc(sc.label || 'Conjecture'), { x: cx, y: 172, ax: .5, cls: 'caps', size: 15, color: K.mute, op: le })
  const lines = sc.statement || []
  let y = 236
  lines.forEach((tx, i) => {
    const e = eout(seg(lt, .25 + i * .3, .85 + i * .3))
    const el = L('as.s' + i, rich(`$${tx}$`), { x: cx, y: y + 10 * (1 - e), ax: .5, size: lines.length > 1 ? 44 : 52, color: K.ink, op: e })
    y += el.offsetHeight + 18
  })
  if (sc.context) L('as.c', rich(sc.context), { x: cx, y: y + 10, ax: .5, w: 1000, align: 'center', size: 23, color: K.soft, op: eout(seg(lt, .8, 1.3)), lh: 1.3 })
  stamp(sc.stamp || 'proved', cx, 520, lt - 1.5, 1)
  if (sc.note) { const ne = eout(seg(lt, 2.2, 2.8)); L('ac.n', rich(sc.note), { x: cx, y: 626, ax: .5, ay: .5, w: 1060, align: 'center', size: 23, color: K.mute, op: ne, lh: 1.3 }) }
}

// A rubber stamp, always labelled as a claim.
function stamp(kind, cx, cy, lt, scale) {
  need(STAMPS[kind], `stamp must be one of ${Object.keys(STAMPS).join(', ')}`)
  if (lt <= 0) return
  const e = seg(lt, 0, .35), k = lerp(1.35, 1, eback(e)), a = eout(e)
  const word = STAMPS[kind].toUpperCase()
  const rot = -.05
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(k * scale, k * scale)
  const [ww] = measure('st.w', esc(word), { size: 40, weight: 760, ls: '0.14em' })
  const bw = Math.max(ww + 64, 240), bh = 104
  rrect(-bw / 2, -bh / 2, bw, bh, 12); stroke(ACC, 3, a); fill(ACC, .08 * a)
  rrect(-bw / 2 + 7, -bh / 2 + 7, bw - 14, bh - 14, 8); stroke(ACC, 1.2, .6 * a)
  g.restore()
  // the DOM text rides the same rotation about the stamp's centre
  const at = dy => [cx - Math.sin(rot) * dy * k * scale, cy + Math.cos(rot) * dy * k * scale]
  const [x1, y1] = at(-24), [x2, y2] = at(12)
  L('st.c', 'CLAIMED', { x: x1, y: y1, ax: .5, ay: .5, size: 14 * scale, weight: 700, ls: '0.3em', color: ACC, op: a * .85, scale: k, rot })
  L('st.w', esc(word), { x: x2, y: y2, ax: .5, ay: .5, size: 40 * scale, weight: 760, ls: '0.14em', color: ACC, op: a, scale: k, rot })
}

// ------------------------------------------------------------- primitives --
// Each primitive: draw(params, localTime, box, key, panelDuration), and
// optionally events(params) -> [{t, kind}] in panel-local seconds.
const PRIM = {}

// Numbers on a line: old bounds, new bounds, an interval, a slide from the
// old value to the claimed one, a zoom into a gap too small to see.
PRIM.numberline = {
  events(p) {
    const ev = (p.markers || []).map((m, i) => ({ t: m.at != null ? m.at : .6 + i * .45, kind: 'tick' }))
    if (p.slide) ev.push({ t: p.slide.at + (p.slide.dur || 1.4), kind: 'land' })
    if (p.zoom) ev.push({ t: p.zoom.at + (p.zoom.dur || 2), kind: 'land' })
    return ev
  },
  draw(p, lt, box, key) {
    const x0 = box.x + 24, x1 = box.x + box.w - 24, y = box.y + box.h * (p.y != null ? p.y : .62)
    const z = p.zoom
    let lo = p.min, hi = p.max
    if (z) {
      const w0 = p.max - p.min, w1 = z.max - z.min
      const phi = (p.min - z.min) / (w1 - w0), f = p.min + phi * w0
      const e = eio(seg(lt, z.at, z.at + (z.dur || 2)))
      const w = w0 * Math.pow(w1 / w0, e); lo = f - phi * w; hi = lo + w
    }
    const X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0)
    const XF = z ? (v => x0 + (v - z.min) / (z.max - z.min) * (x1 - x0)) : X
    const ae = eio(seg(lt, 0, .8))
    line(x0, y, lerp(x0, x1, ae), y, K.soft, 2, .9)
    if (p.arrow !== false && ae > .95) arrowHead(x1 + 12, y, 0, 11, K.soft, .9)
    // ticks
    const tk = (list, a, pre) => (list || []).forEach((tv, i) => {
      const v = typeof tv === 'number' ? tv : tv.v, lab = typeof tv === 'number' ? String(tv) : tv.label
      const x = X(v); if (x < x0 - 1 || x > x1 + 1 || a <= 0) return
      line(x, y - 7, x, y + 7, K.soft, 1.5, a)
      L(key + pre + i, rich(lab), { x, y: y + 16, ax: .5, cls: 'mono', size: 22, color: K.mute, op: a })
    })
    const ta = eout(seg(lt, .3, 1))
    tk(p.ticks, z ? ta * (1 - seg(lt, z.at, z.at + (z.dur || 2) * .3)) : ta, '.t')
    if (z) tk(z.ticks, seg(lt, z.at + (z.dur || 2) * .75, z.at + (z.dur || 2)), '.zt')
    if (p.axisLabel) L(key + '.ax', rich(p.axisLabel), { x: x0, y: y + 62, size: 22, color: K.mute, op: ta })
    // label rows, computed once in the final mapping so nothing jumps
    if (!p._rows) {
      const items = []
      ;(p.ranges || []).forEach((r, i) => items.push({ id: 'r' + i, x: (XF(r.from) + XF(r.to)) / 2, html: labelHTML(r), side: r.side || 'above' }))
      ;(p.markers || []).forEach((m, i) => items.push({ id: 'm' + i, x: XF(m.v), html: labelHTML(m), side: m.side || 'above' }))
      if (p.slide) items.push({ id: 's', x: XF(p.slide.to), html: labelHTML({ tone: 'claim', ...p.slide }), side: p.slide.side || 'above' })
      p._rows = {}
      const occ = { above: [], below: [] }
      for (const it of items) {
        const [w, h] = measure(key + '.m_' + it.id, it.html, { size: 26 })
        let x = clamp(it.x - w / 2, box.x - 10, box.x + box.w + 10 - w)
        let row = 0
        while (occ[it.side].some(o => o.row === row && !(x + w + 14 < o.a || x > o.b + 14))) row++
        occ[it.side].push({ row, a: x, b: x + w })
        p._rows[it.id] = { row, x, w, h, shift: x - (it.x - w / 2) }
      }
    }
    const placeLabel = (id, html, side, xv, a, color) => {
      const r = p._rows[id]; if (!r) return
      const off = 34 + r.row * 74
      const ly = side === 'above' ? y - off : y + off + 36
      const x = clamp(xv - r.w / 2 + r.shift, box.x - 10, box.x + box.w + 10 - r.w)
      line(xv, side === 'above' ? y - 9 : y + 9, xv, side === 'above' ? ly + 2 : ly - 2, color, 1.2, .55 * a)
      L(key + '.m_' + id, html, { x: x + r.w / 2, y: ly, ax: .5, ay: side === 'above' ? 1 : 0, size: 26, op: a, color: K.ink })
    }
    // ranges
    ;(p.ranges || []).forEach((r, i) => {
      const at = r.at != null ? r.at : .8, e = eout(seg(lt, at, at + .6))
      if (e <= 0) return
      const a = X(r.from), b = X(r.to), c = tone(r.tone || 'old')
      rrect(Math.min(a, b), y - 6, Math.max(2, Math.abs(b - a) * e), 12, 4); fill(c, .45 * e)
      placeLabel('r' + i, labelHTML(r), r.side || 'above', (a + b) / 2, e, c)
    })
    // markers
    ;(p.markers || []).forEach((m, i) => {
      const at = m.at != null ? m.at : .6 + i * .45, e = seg(lt, at, at + .45)
      if (e <= 0) return
      const x = X(m.v); if (x < x0 - 2 || x > x1 + 2) return
      const c = tone(m.tone || 'old')
      if (m.style === 'ring') ring(x, y, 7 * eback(e), c, 2.2, 1); else dot(x, y, 6.5 * eback(e), c, 1)
      placeLabel('m' + i, labelHTML(m), m.side || 'above', x, eout(e), c)
    })
    // the slide: old value -> claimed value
    if (p.slide) {
      const s = p.slide, d = s.dur || 1.4, e = eio(seg(lt, s.at, s.at + d)), c = tone(s.tone || 'claim')
      if (lt >= s.at) {
        const xa = X(s.from), xb = X(s.to), xc = lerp(xa, xb, e)
        ring(xa, y, 8, K.mute, 1.5, .8)
        const gr = g.createLinearGradient(xa, 0, xc, 0); gr.addColorStop(0, rgba(c, .05)); gr.addColorStop(1, rgba(c, .9))
        g.beginPath(); g.moveTo(xa, y); g.lineTo(xc, y); A(1); g.strokeStyle = gr; g.lineWidth = 5; g.lineCap = 'round'; g.stroke()
        dot(xc, y, 8, c, 1); dot(xc, y, 3.5, K.bg, 1)
        const land = lt - s.at - d
        if (land > 0) { const pe = seg(land, 0, .8); ring(xb, y, 8 + 26 * eout(pe), c, 2, 1 - pe) }
        placeLabel('s', labelHTML({ tone: 'claim', ...s }), s.side || 'above', xc, eout(seg(lt, s.at + d - .2, s.at + d + .3)), c)
      }
    }
    if (z && z.counter) {
      const e = seg(lt, z.at, z.at + (z.dur || 2)), k = Math.round(Math.log10((p.max - p.min) / (hi - lo)))
      const a = eout(seg(lt, z.at, z.at + .3))
      L(key + '.zc', rich(`zoom $\\times 10^{${k}}$`), { x: x1, y: box.y + 8, ax: 1, cls: 'mono', size: 24, color: e >= 1 ? ACC : K.soft, op: a })
    }
  },
}
function labelHTML(m) {
  const c = tone(m.tone || 'old')
  let h = `<div style="color:${m.tone === 'old' || !m.tone ? K.soft : c};font-weight:560">${rich(m.label || '')}</div>`
  if (m.note) h += `<div style="font-size:18px;color:${K.mute};font-weight:450;margin-top:2px">${rich(m.note)}</div>`
  return `<div style="text-align:center">${h}</div>`
}

// Graphs: explicit nodes/edges, or a preset (two-page drawing of K_n with its
// crossings computed and counted, the FFT butterfly, K_n on a circle).
PRIM.graph = {
  events(p) { const ev = []; if (p.preset === 'twopage' || p.counter) ev.push({ t: (p.edgeAt || .6) + (p.edgeDur || 4.2) + .3, kind: 'land' }); return ev },
  draw(p, lt, box, key, pd) {
    if (!p._g) p._g = buildGraph(p, box)
    const G = p._g
    const ne = eout(seg(lt, 0, .6))
    // edges
    const e0 = p.edgeAt != null ? p.edgeAt : .6, ed = p.edgeDur != null ? p.edgeDur : 4.2
    const n = G.edges.length
    const edgeStart = i => e0 + (n > 1 ? ed * .78 * G.edges[i].ord / (n - 1) : 0), edgeLen = ed * .22 + .25
    const edgeProg = i => eio(seg(lt, edgeStart(i), edgeStart(i) + edgeLen))
    // when edge i has drawn fraction f (inverse of the eased progress)
    const reach = (i, f) => { let a = 0, b = 1; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (eio(m) < f) a = m; else b = m } return edgeStart(i) + edgeLen * b }
    G.edges.forEach((E, i) => {
      const f = edgeProg(i); if (f <= 0) return
      const c = tone(E.tone || 'soft'), w = E.w || 2.2, a = E.a != null ? E.a : .85
      if (E.arc) {
        g.save(); g.translate(E.cx, G.y); g.scale(1, G.k)
        g.beginPath()
        if (E.up) g.arc(0, 0, E.r, Math.PI, Math.PI + Math.PI * f, false); else g.arc(0, 0, E.r, Math.PI, Math.PI - Math.PI * f, true)
        g.restore(); stroke(c, w, a)
      } else polyline([[E.ax, E.ay], [E.bx, E.by]], f, c, w, a)
    })
    // crossings, each appearing when the later of its two arcs reaches it
    let count = 0, lastT = 0
    if (G.cross) for (const X of G.cross) {
      const tx = Math.max(reach(X.i, X.fi), reach(X.j, X.fj))
      lastT = Math.max(lastT, tx)
      if (lt < tx) continue
      count++
      const pe = seg(lt - tx, 0, .35)
      ring(X.x, X.y, 6 * eback(pe), K.hot, 2.2, 1); dot(X.x, X.y, 2.4, K.hot, pe)
    }
    // packets along the edges (butterfly), stage by stage, looping
    if (G.flow) {
      const fs = (p.flowAt != null ? p.flowAt : e0 + ed + .2)
      if (lt > fs) {
        const per = .9, tt = (lt - fs) / per
        G.edges.forEach(E => {
          const ph = tt - E.stage
          const u = ph - Math.floor(ph / G.stages) * G.stages
          if (u < 0 || u > 1) return
          const x = lerp(E.ax, E.bx, eio(u)), y = lerp(E.ay, E.by, eio(u))
          dot(x, y, 4.2, E.hl ? ACC : K.ink, .95 * seg(lt, fs, fs + .4) * Math.min(1, 6 * u, 6 * (1 - u) + .35))
        })
      }
    }
    // nodes
    G.nodes.forEach((N, i) => {
      const st = (G.nodeStagger || 0) * i, e = eout(seg(lt, st, st + .5)) * ne
      if (e <= 0) return
      const c = tone(N.tone || 'ink')
      dot(N.x, N.y, G.r, K.bg, e); ring(N.x, N.y, G.r, c, 2, e)
      if (N.fill) dot(N.x, N.y, G.r - 3.5, tone(N.fill), e)
      if (N.label != null) L(key + '.n' + i, rich(String(N.label)), { x: N.x + (N.lx || 0), y: N.y + (N.ly || 0), ax: N.lax != null ? N.lax : .5, ay: .5, cls: N.lx || N.ly ? '' : 'mono', size: N.lsize || (N.lx || N.ly ? 20 : G.r > 12 ? 17 : 16), color: N.lx || N.ly ? K.soft : K.ink, op: e })
    })
    // annotations
    ;(G.notes || []).forEach((nt, i) => { const e = eout(seg(lt, nt.at, nt.at + .5)); if (e > 0) L(key + '.a' + i, rich(nt.text), { x: nt.x, y: nt.y, ax: nt.ax != null ? nt.ax : .5, ay: .5, size: nt.size || 19, color: nt.color || K.mute, op: e }) })
    if (G.hl) { const e = eout(seg(lt, G.hl.at, G.hl.at + .5)); if (e > 0) { rrect(G.hl.x, G.hl.y, G.hl.w, G.hl.h, 14); stroke(ACC, 1.6, .9 * e, [6, 6]); L(key + '.hl', rich(G.hl.label), { x: G.hl.x + G.hl.w / 2, y: G.hl.y - 12, ax: .5, ay: 1, size: 19, color: ACC, op: e }) } }
    // the counter
    if (p.counter && G.cross) {
      const ce = eout(seg(lt, e0, e0 + .5))
      L(key + '.cl', esc(p.counter.label || 'crossings'), { x: box.x, y: box.y + 4, cls: 'caps', size: 15, color: K.mute, op: ce })
      const cw = measure(key + '.cn', String(count), { cls: 'mono', size: 56, weight: 500 })[0]
      L(key + '.cn', String(count), { x: box.x, y: box.y + 28, cls: 'mono', size: 56, color: count === G.cross.length ? ACC : K.ink, op: ce, weight: 500 })
      if (p.counter.done && count === G.cross.length) {
        const de = eout(seg(lt - lastT, .3, .9))
        L(key + '.cd', rich(p.counter.done), { x: box.x + cw + 16, y: box.y + 62, ay: .5, size: 34, color: ACC, op: de })
      }
      CHECKS.crossings = G.cross.length
    }
  },
}

function buildGraph(p, box) {
  const G = { nodes: [], edges: [], r: p.r || 13 }
  if (p.preset === 'twopage') {
    const n = p.n; need(n >= 3 && n <= 12, 'twopage: n in 3..12')
    const span = Math.min(box.w - 160, 880), sp = span / (n - 1), y = box.y + box.h * .55
    const left = box.x + box.w - 40 - span
    G.y = y
    const maxR = (n - 1) * sp / 2
    G.k = Math.min(1, (box.h * .45 - 8) / maxR); G.r = p.r || 15
    for (let i = 0; i < n; i++) G.nodes.push({ x: left + i * sp, y, label: p.labels === false ? null : i, tone: 'ink' })
    const half = Math.floor(n / 2), order = []
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const up = (i + j) % n < half
      order.push({ i, j, up, len: j - i })
    }
    // above first, short to long, then below
    order.sort((a, b) => (b.up - a.up) || (a.len - b.len) || (a.i - b.i))
    order.forEach((o, k) => {
      const xa = G.nodes[o.i].x, xb = G.nodes[o.j].x
      G.edges.push({ arc: true, up: o.up, cx: (xa + xb) / 2, r: (xb - xa) / 2, i: o.i, j: o.j, ord: k, tone: o.up ? 'accent' : 'cool', w: 2.2, a: .85 })
    })
    // crossings: same side, interleaved endpoints a < c < b < d
    G.cross = []
    for (let u = 0; u < G.edges.length; u++) for (let v = u + 1; v < G.edges.length; v++) {
      const E = G.edges[u], F = G.edges[v]
      if (E.up !== F.up) continue
      const [a, b] = [E.i, E.j], [c, d] = [F.i, F.j]
      if (!((a < c && c < b && b < d) || (c < a && a < d && d < b))) continue
      // intersection of the two circles (same centre line), upper/lower root
      const dx = F.cx - E.cx, xi = (E.r * E.r - F.r * F.r + dx * dx) / (2 * dx)
      const hy = Math.sqrt(Math.max(0, E.r * E.r - xi * xi))
      const X = E.cx + xi, Yraw = E.up ? -hy : hy
      // fraction of each arc drawn when it reaches the crossing: arcs run
      // left to right, through the top (above) or the bottom (below)
      const frac = Ed => { const th = Math.atan2(Yraw, X - Ed.cx); return Ed.up ? (Math.PI + th) / Math.PI : (Math.PI - th) / Math.PI }
      const fu = frac(E), fv = frac(F)
      G.cross.push({ x: X, y: y + Yraw * G.k, i: u, j: v, fi: fu, fj: fv })
    }
    const Z = n => Math.floor(n / 2) * Math.floor((n - 1) / 2) * Math.floor((n - 2) / 2) * Math.floor((n - 3) / 2) / 4
    CHECKS.zarankiewicz = Z(n)
    need(G.cross.length === Z(n), `twopage K_${n}: drawing has ${G.cross.length} crossings, Z(n) = ${Z(n)}`)
  } else if (p.preset === 'butterfly') {
    const n = p.n || 8, st = Math.round(Math.log2(n)); need(1 << st === n && n <= 16, 'butterfly: n a power of two, at most 16')
    const padL = 90, padR = 90, x0 = box.x + padL, x1 = box.x + box.w - padR
    const y0 = box.y + 30, y1 = box.y + box.h - 40
    G.r = p.r || 9; G.stages = st; G.flow = p.flow !== false
    const X = s => lerp(x0, x1, s / st), Y = i => lerp(y0, y1, i / (n - 1))
    const id = (s, i) => s * n + i
    for (let s = 0; s <= st; s++) for (let i = 0; i < n; i++) {
      const N = { x: X(s), y: Y(i), label: null, tone: 'soft' }
      if (s === 0 && p.inLabel) Object.assign(N, { label: p.inLabel.replace('#', i), lx: -26, lax: 1 })
      if (s === st && p.outLabel) Object.assign(N, { label: p.outLabel.replace('#', i), lx: 26, lax: 0 })
      G.nodes[id(s, i)] = N
    }
    let k = 0
    for (let s = 0; s < st; s++) {
      const span = 1 << s
      for (let i = 0; i < n; i++) {
        const j = i ^ span
        for (const tgt of [i, j]) {
          const hl = p.highlight && s === 0 && (i === 0 || i === 1)
          G.edges.push({ ax: X(s), ay: Y(i), bx: X(s + 1), by: Y(tgt), stage: s, ord: s * 1000 + k++, tone: hl ? 'accent' : 'soft', w: hl ? 3 : 1.6, a: hl ? 1 : .55, hl })
        }
      }
    }
    // order is stage-major so each stage draws as a sweep
    const byStage = G.edges.map((e, i) => i).sort((a, b) => G.edges[a].ord - G.edges[b].ord)
    byStage.forEach((ei, r) => { G.edges[ei].ord = r })
    G.notes = []
    for (let s = 0; s < st; s++) G.notes.push({ text: `stage ${s + 1}`, x: (X(s) + X(s + 1)) / 2, y: y1 + 30, at: (p.edgeAt || .6) + s * (p.edgeDur || 4.2) / st, color: K.mute, size: 17 })
    if (p.highlight) {
      G.hl = { x: X(0) - 22, y: Y(0) - 22, w: X(1) - X(0) + 44, h: Y(1) - Y(0) + 44, at: (p.edgeAt || .6) + (p.edgeDur || 4.2) * .4, label: p.highlight }
    }
    G.nodeStagger = 0
  } else if (p.preset === 'complete' || p.nodes) {
    let pts
    if (p.preset === 'complete') {
      const n = p.n; pts = []
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = Math.min(box.w, box.h) * .42
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * i / n; pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), label: p.labels ? i : null, tone: (p.colours || [])[i] }) }
      G.nodes = pts
      let k = 0
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) G.edges.push({ ax: pts[i].x, ay: pts[i].y, bx: pts[j].x, by: pts[j].y, ord: k++, tone: 'soft', a: .6, w: 1.6, i, j })
    } else {
      const P = (v, a, b) => lerp(a, b, v)
      G.nodes = p.nodes.map(N => ({ ...N, x: P(N.x, box.x, box.x + box.w), y: P(N.y, box.y, box.y + box.h), tone: N.tone, fill: N.fill }))
      const idx = Object.fromEntries(p.nodes.map((N, i) => [N.id, i]))
      p.edges.forEach((E, k) => { const [a, b] = [idx[E[0]], idx[E[1]]]; need(a != null && b != null, `graph edge ${E} names a missing node`); const o = E[2] || {}; G.edges.push({ ax: G.nodes[a].x, ay: G.nodes[a].y, bx: G.nodes[b].x, by: G.nodes[b].y, ord: k, tone: o.tone || 'soft', w: o.w || 2.2, a: o.a != null ? o.a : .85, i: a, j: b }) })
    }
    if (p.crossings) {
      G.cross = []
      const E = G.edges
      for (let u = 0; u < E.length; u++) for (let v = u + 1; v < E.length; v++) {
        const A1 = E[u], B1 = E[v]
        if (A1.i === B1.i || A1.i === B1.j || A1.j === B1.i || A1.j === B1.j) continue
        const r = segX(A1.ax, A1.ay, A1.bx, A1.by, B1.ax, B1.ay, B1.bx, B1.by)
        if (r) G.cross.push({ x: r.x, y: r.y, i: u, j: v, fi: r.s, fj: r.t })
      }
    }
  } else need(false, 'graph needs a preset (twopage | butterfly | complete) or nodes + edges')
  return G
}
function segX(ax, ay, bx, by, cx, cy, dx, dy) {
  const r = [bx - ax, by - ay], s = [dx - cx, dy - cy], den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((cx - ax) * s[1] - (cy - ay) * s[0]) / den, u = ((cx - ax) * r[1] - (cy - ay) * r[0]) / den
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null
  return { x: ax + t * r[0], y: ay + t * r[1], s: t, t: u }
}

// Grids: a matrix of cells with blocks; the A x B = C sweep; a 3-way tensor.
PRIM.grid = {
  events(p) { return p.preset === 'matmul' ? [{ t: (p.sweepAt || .8) + (p.sweep || 3.6), kind: 'land' }] : [] },
  draw(p, lt, box, key) {
    if (p.preset === 'matmul') return matmul(p, lt, box, key)
    if (p.preset === 'tensor') return tensor(p, lt, box, key)
    const R = p.rows, Cn = p.cols
    const cs = Math.min((box.w - 40) / Cn, (box.h - 60) / R, 64)
    const gx = box.x + (box.w - cs * Cn) / 2, gy = box.y + (box.h - cs * R) / 2 + 10
    const tones = {}
    ;(p.cells || []).forEach(([r, c, t]) => { tones[r + ',' + c] = t || 'accent' })
    for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
      const st = .2 + (r + c) * (p.stagger != null ? p.stagger : .04), e = eout(seg(lt, st, st + .4))
      if (e <= 0) continue
      const tn = tones[r + ',' + c]
      rrect(gx + c * cs + 2, gy + r * cs + 2, cs - 4, cs - 4, 5)
      if (tn) fill(tone(tn), .55 * e); else fill('#ffffff', .035 * e)
      stroke(K.faint, 1, e)
      const v = p.values && p.values[r] && p.values[r][c]
      if (v != null && v !== '') L(`${key}.v${r}_${c}`, rich(String(v)), { x: gx + (c + .5) * cs, y: gy + (r + .5) * cs, ax: .5, ay: .5, cls: 'mono', size: Math.min(22, cs * .42), color: tn ? K.bg : K.soft, op: e })
    }
    ;(p.blocks || []).forEach((b, i) => {
      const at = b.at != null ? b.at : 1.2 + i * .5, e = eout(seg(lt, at, at + .5)); if (e <= 0) return
      const c = tone(b.tone || 'accent')
      rrect(gx + b.c * cs - 3, gy + b.r * cs - 3, b.w * cs + 6, b.h * cs + 6, 8); stroke(c, 2.5, e); fill(c, .1 * e)
      if (b.label) L(`${key}.b${i}`, rich(b.label), { x: gx + (b.c + b.w / 2) * cs, y: gy + b.r * cs - 10, ax: .5, ay: 1, size: 19, color: c, op: e })
    })
    if (p.caption) L(key + '.cap', rich(p.caption), { x: box.x + box.w / 2, y: gy + R * cs + 20, ax: .5, size: 20, color: K.mute, op: eout(seg(lt, .5, 1)) })
  },
}
function matmul(p, lt, box, key) {
  const n = p.n || 4, gap = 64
  const cs = Math.min((box.w - 2 * gap - 120) / (3 * n), (box.h - 120) / n, 58)
  const gw = cs * n, total = 3 * gw + 2 * gap
  const x0 = box.x + (box.w - total) / 2, y0 = box.y + (box.h - gw) / 2 + 6
  const GX = [x0, x0 + gw + gap, x0 + 2 * (gw + gap)]
  const sa = p.sweepAt != null ? p.sweepAt : .8, sw = p.sweep || 3.6
  const step = (lt - sa) / sw * n * n
  const cur = Math.floor(step), ci = Math.floor(cur / n), cj = cur % n
  const active = step >= 0 && step < n * n
  const names = p.names || ['A', 'B', 'C']
  for (let m = 0; m < 3; m++) {
    const e = eout(seg(lt, m * .15, m * .15 + .5)); if (e <= 0) continue
    L(`${key}.nm${m}`, rich(`$${names[m]}$`), { x: GX[m] + gw / 2, y: y0 - 18, ax: .5, ay: 1, size: 30, color: K.soft, op: e })
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      let hl = 0
      if (active && ((m === 0 && r === ci) || (m === 1 && c === cj))) hl = 1
      let filled = 0
      if (m === 2) { const k = r * n + c; filled = step >= k + 1 ? 1 : (step >= k ? step - k : 0) }
      rrect(GX[m] + c * cs + 2, y0 + r * cs + 2, cs - 4, cs - 4, 5)
      if (m === 2) fill(ACC, (.06 + .36 * filled) * e); else fill(hl ? ACC : '#ffffff', (hl ? .42 : .035) * e)
      stroke(m === 2 && active && r === ci && c === cj ? ACC : K.faint, m === 2 && active && r === ci && c === cj ? 2.4 : 1, e)
    }
  }
  const oe = eout(seg(lt, .3, .8))
  L(`${key}.x`, rich('$\\times$'), { x: GX[0] + gw + gap / 2, y: y0 + gw / 2, ax: .5, ay: .5, size: 34, color: K.mute, op: oe })
  L(`${key}.eq`, rich('$=$'), { x: GX[1] + gw + gap / 2, y: y0 + gw / 2, ax: .5, ay: .5, size: 34, color: K.mute, op: oe })
  if (p.counter !== false) {
    const done = Math.max(0, Math.min(n * n, step)), prods = Math.floor(done) * n
    const ce = eout(seg(lt, sa, sa + .4))
    L(`${key}.ct`, `${prods}<span style="color:${K.mute}"> of ${n * n * n} products</span>`, { x: box.x + box.w / 2, y: y0 + gw + 40, ax: .5, cls: 'mono', size: 24, color: prods === n * n * n ? ACC : K.ink, op: ce })
  }
}
function tensor(p, lt, box, key) {
  const [a, b, c] = p.dims || [3, 3, 3]
  const s = p.cell || Math.min(box.h / (a + b + c) * 1.9, 84)
  const yaw = (p.yaw != null ? p.yaw : .62) + (p.spin ? lt * .05 : 0)
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2 + 10
  const proj = (i, j, k) => { // i -> x, j -> depth, k -> up
    const x = (i - a / 2) * Math.cos(yaw) - (j - b / 2) * Math.sin(yaw)
    const d = (i - a / 2) * Math.sin(yaw) + (j - b / 2) * Math.cos(yaw)
    return [cx + x * s, cy - (k - c / 2) * s + d * s * .45, d]
  }
  const e = eout(seg(lt, 0, .8))
  // wire box
  const C8 = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, c], [a, 0, c], [a, b, c], [0, b, c]].map(v => proj(...v))
  ;[[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([u, v]) => line(C8[u][0], C8[u][1], C8[v][0], C8[v][1], K.faint, 1.4, e))
  const cells = (p.cells || []).map((q, i) => ({ q, i, d: proj(q[0] + .5, q[1] + .5, q[2] + .5)[2] }))
  cells.sort((u, v) => v.d - u.d)
  for (const { q, i } of cells) {
    const at = (p.cellAt != null ? p.cellAt : .8) + i * (p.cellStagger != null ? p.cellStagger : .18), ce = eout(seg(lt, at, at + .4)); if (ce <= 0) continue
    const [x, y] = proj(q[0] + .5, q[1] + .5, q[2] + .5), r = s * .36 * eback(seg(lt, at, at + .4))
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .9, y - r * .45); g.lineTo(x + r * .9, y + r * .55); g.lineTo(x, y + r); g.lineTo(x - r * .9, y + r * .55); g.lineTo(x - r * .9, y - r * .45); g.closePath()
    fill(tone(q[3] || 'accent'), .8 * ce); stroke(K.bg, 1, ce)
  }
  ;(p.axes || []).forEach((lab, i) => {
    const P = [proj(a + .6, 0, 0), proj(0, b + .9, 0), proj(0, 0, c + .5)][i]
    L(`${key}.ax${i}`, rich(lab), { x: P[0], y: P[1], ax: .5, ay: .5, size: 20, color: K.mute, op: e })
  })
}

// Function plots: curves revealed left to right, regions, asymptotes, points.
function fnOf(src) { return new Function('x', `with (Math) { return (${src}) }`) }
PRIM.plot = {
  draw(p, lt, box, key) {
    const [xa, xb] = p.x, [ya, yb] = p.y
    const L0 = box.x + 70, R0 = box.x + box.w - (p.labelRoom != null ? p.labelRoom : 150), T0 = box.y + 20, B0 = box.y + box.h - 50
    const X = v => L0 + (v - xa) / (xb - xa) * (R0 - L0), Y = v => B0 - (v - ya) / (yb - ya) * (B0 - T0)
    const ae = eio(seg(lt, 0, .7))
    line(L0, B0, lerp(L0, R0, ae), B0, K.soft, 1.6, .9); line(L0, B0, L0, lerp(B0, T0, ae), K.soft, 1.6, .9)
    ;(p.xticks || []).forEach((tv, i) => { const v = tv.v != null ? tv.v : tv; line(X(v), B0, X(v), B0 + 6, K.soft, 1.2, ae); L(`${key}.xt${i}`, rich(tv.label || String(v)), { x: X(v), y: B0 + 12, ax: .5, cls: 'mono', size: 17, color: K.mute, op: ae }) })
    ;(p.yticks || []).forEach((tv, i) => { const v = tv.v != null ? tv.v : tv; line(L0 - 6, Y(v), L0, Y(v), K.soft, 1.2, ae); L(`${key}.yt${i}`, rich(tv.label || String(v)), { x: L0 - 12, y: Y(v), ax: 1, ay: .5, cls: 'mono', size: 17, color: K.mute, op: ae }) })
    if (p.xlabel) L(key + '.xl', rich(p.xlabel), { x: R0, y: B0 + 36, ax: 1, size: 20, color: K.mute, op: ae })
    if (p.ylabel) L(key + '.yl', rich(p.ylabel), { x: L0 + 10, y: T0 - 4, size: 20, color: K.mute, op: ae })
    const sample = (f, a, b, N = 240) => { const pts = []; for (let i = 0; i <= N; i++) { const x = lerp(a, b, i / N), y = f(x); if (isFinite(y)) pts.push([X(x), clamp(Y(y), T0 - 40, B0 + 40)]) } return pts }
    g.save(); g.beginPath(); g.rect(L0 + 1, T0 - 30, R0 - L0, B0 - T0 + 29); g.clip()
    ;(p.regions || []).forEach((r, i) => {
      const at = r.at != null ? r.at : 2, e = eout(seg(lt, at, at + .8)); if (e <= 0) return
      const f1 = fnOf(r.f), f2 = r.f2 ? fnOf(r.f2) : () => ya
      const a = r.from != null ? r.from : xa, b = r.to != null ? r.to : xb, N = 160
      g.beginPath()
      for (let k = 0; k <= N; k++) { const x = lerp(a, b, k / N); const y = f1(x); k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)) }
      for (let k = N; k >= 0; k--) { const x = lerp(a, b, k / N); g.lineTo(X(x), Y(f2(x))) }
      g.closePath(); fill(tone(r.tone || 'accent'), .18 * e)
    })
    ;(p.asymptotes || []).forEach((s, i) => { const e = eout(seg(lt, s.at || 1, (s.at || 1) + .6)); if (s.x != null) line(X(s.x), T0, X(s.x), B0, K.mute, 1.4, e, [6, 6]); else line(L0, Y(s.y), R0, Y(s.y), K.mute, 1.4, e, [6, 6]) })
    const ends = []
    ;(p.curves || []).forEach((c, i) => {
      const at = c.at != null ? c.at : .6 + i * .9, f = eio(seg(lt, at, at + (c.dur || 1.6))); if (f <= 0) return
      const pts = sample(fnOf(c.f), c.from != null ? c.from : xa, c.to != null ? c.to : xb)
      polyline(pts, f, tone(c.tone || (i ? 'soft' : 'accent')), c.w || 3, 1, c.dash ? [8, 7] : null)
      if (c.label && f > .95) ends.push({ i, c, p: pts[pts.length - 1], e: seg(f, .95, 1) })
    })
    g.restore()
    ends.forEach(({ i, c, p: q, e }) => L(`${key}.cl${i}`, rich(c.label), { x: q[0] + 12, y: q[1] + (c.labelDy || 0), ax: 0, ay: .5, size: 21, color: tone(c.tone || (i ? 'soft' : 'accent')), op: e }))
    ;(p.points || []).forEach((q, i) => { const at = q.at != null ? q.at : 2.5, e = seg(lt, at, at + .4); if (e <= 0) return; dot(X(q.x), Y(q.y), 6 * eback(e), tone(q.tone || 'accent')); if (q.label) L(`${key}.pt${i}`, rich(q.label), { x: X(q.x) + 12, y: Y(q.y) - 12, ay: 1, size: 19, color: K.soft, op: eout(e) }) })
  },
}

// Shapes: polygons, regular polygons, circles and ellipses, with morphs.
function resample(pts, N) {
  const P = [...pts, pts[0]], L1 = [0]
  for (let i = 1; i < P.length; i++) L1.push(L1[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
  const out = [], T = L1[L1.length - 1]
  for (let k = 0; k < N; k++) {
    const d = T * k / N; let i = 1; while (L1[i] < d) i++
    const u = (d - L1[i - 1]) / ((L1[i] - L1[i - 1]) || 1); out.push([lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)])
  }
  return out
}
function shapePts(s) {
  if (s.kind === 'regular') { const n = s.n, r = s.r || 1, a0 = s.rot || -Math.PI / 2; return Array.from({ length: n }, (_, i) => [r * Math.cos(a0 + 2 * Math.PI * i / n), r * Math.sin(a0 + 2 * Math.PI * i / n)]) }
  if (s.kind === 'circle' || s.kind === 'ellipse') { const rx = s.rx || s.r || 1, ry = s.ry || s.r || 1, c = s.c || [0, 0]; return Array.from({ length: 96 }, (_, i) => [c[0] + rx * Math.cos(2 * Math.PI * i / 96 - Math.PI / 2), c[1] + ry * Math.sin(2 * Math.PI * i / 96 - Math.PI / 2)]) }
  if (s.kind === 'superellipse') { const p = s.p || 4, r = s.r || 1; return Array.from({ length: 120 }, (_, i) => { const t = 2 * Math.PI * i / 120 - Math.PI / 2, c = Math.cos(t), sn = Math.sin(t); return [r * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), r * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p)] }) }
  return s.points
}
PRIM.shape = {
  draw(p, lt, box, key) {
    const S = Math.min(box.w, box.h) * .42 * (p.scale || 1), cx = box.x + box.w / 2, cy = box.y + box.h / 2
    const M = q => [cx + q[0] * S, cy - q[1] * S]
    if (p.axes) { const e = eout(seg(lt, 0, .6)); line(cx - S * 1.25, cy, cx + S * 1.25, cy, K.faint, 1.2, e); line(cx, cy - S * 1.15, cx, cy + S * 1.15, K.faint, 1.2, e) }
    ;(p.shapes || []).forEach((s, i) => {
      const at = s.at != null ? s.at : .3 + i * .8, e = eio(seg(lt, at, at + (s.dur || 1.2))); if (e <= 0) return
      let pts = resample(shapePts(s), 192)
      if (s.morph) { const me = eio(seg(lt, s.morph.at, s.morph.at + (s.morph.dur || 1.6))); if (me > 0) { const q = resample(shapePts(s.morph), 192); pts = pts.map((v, k) => [lerp(v[0], q[k][0], me), lerp(v[1], q[k][1], me)]) } }
      const P = pts.map(M), c = tone(s.tone || (i ? 'soft' : 'accent'))
      if (s.fill !== false && e > .6) { g.beginPath(); P.forEach((v, k) => (k ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); fill(c, (s.fillA != null ? s.fillA : .14) * seg(e, .6, 1)) }
      polyline([...P, P[0]], e, c, s.w || 2.6, 1, s.dash ? [8, 7] : null)
      if (s.label) { const q = M(s.labelAt || [0, 0]); L(`${key}.s${i}`, rich(s.label), { x: q[0], y: q[1], ax: .5, ay: .5, size: 21, color: c, op: seg(e, .7, 1) }) }
    })
    ;(p.points || []).forEach((q, i) => { const at = q.at != null ? q.at : 1.5, e = seg(lt, at, at + .4); if (e <= 0) return; const v = M(q.p); dot(v[0], v[1], 5 * eback(e), tone(q.tone || 'ink')); if (q.label) L(`${key}.p${i}`, rich(q.label), { x: v[0] + 10, y: v[1] - 8, ay: 1, size: 19, color: K.soft, op: eout(e) }) })
  },
}

// Venn diagrams of two or three sets, with shaded regions and members.
PRIM.venn = {
  draw(p, lt, box, key) {
    const n = p.sets.length; need(n === 2 || n === 3, 'venn: 2 or 3 sets')
    const R = Math.min(box.w, box.h) * (n === 2 ? .36 : .27), cx = box.x + box.w / 2, cy = box.y + box.h / 2 - (n === 3 ? R * .2 : 0)
    const C = n === 2 ? [[cx - R * .58, cy], [cx + R * .58, cy]] : [[cx - R * .58, cy - R * .32], [cx + R * .58, cy - R * .32], [cx, cy + R * .68]]
    // regions: strings like "A", "A&B", "A&!B", "A&B&C"
    ;(p.regions || []).forEach((r, i) => {
      const at = r.at != null ? r.at : 1.8 + i * .6, e = eout(seg(lt, at, at + .6)); if (e <= 0) return
      if (!p._off) { p._off = document.createElement('canvas'); p._off.width = W; p._off.height = H }
      const q = p._off.getContext('2d'); q.clearRect(0, 0, W, H); q.save()
      const terms = r.set.split('&')
      for (const tm of terms) if (!tm.startsWith('!')) { const k = tm.charCodeAt(0) - 65; q.beginPath(); q.arc(C[k][0], C[k][1], R, 0, 2 * Math.PI); q.clip() }
      q.fillStyle = tone(r.tone || 'accent'); q.fillRect(0, 0, W, H); q.restore()
      q.globalCompositeOperation = 'destination-out'
      for (const tm of terms) if (tm.startsWith('!')) { const k = tm.charCodeAt(1) - 65; q.beginPath(); q.arc(C[k][0], C[k][1], R, 0, 2 * Math.PI); q.fill() }
      q.globalCompositeOperation = 'source-over'
      A(.32 * e); g.drawImage(p._off, 0, 0)
      if (r.label) L(`${key}.r${i}`, rich(r.label), { x: r.x != null ? box.x + r.x * box.w : cx, y: r.y != null ? box.y + r.y * box.h : cy, ax: .5, ay: .5, size: 20, color: K.ink, op: e })
    })
    p.sets.forEach((s, i) => {
      const at = s.at != null ? s.at : .2 + i * .4, e = eio(seg(lt, at, at + .9)); if (e <= 0) return
      const c = tone(s.tone || ['accent', 'cool', 'warn'][i])
      g.beginPath(); g.arc(C[i][0], C[i][1], R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * e); stroke(c, 2.6, 1)
      const lx = C[i][0] + (i === 0 ? -R * 1.05 : i === 1 ? R * 1.05 : R * 1.05), ly = C[i][1] + (i === 2 ? R * .55 : -R * .8)
      L(`${key}.l${i}`, rich(s.label), { x: lx, y: ly, ax: .5, ay: .5, size: 23, color: c, op: seg(e, .5, 1), weight: 560 })
    })
    ;(p.members || []).forEach((m, i) => { const at = m.at != null ? m.at : 2.5 + i * .25, e = seg(lt, at, at + .35); if (e <= 0) return; const x = box.x + m.x * box.w, y = box.y + m.y * box.h; dot(x, y, 4.5 * eback(e), tone(m.tone || 'ink')); if (m.label) L(`${key}.m${i}`, rich(m.label), { x: x + 9, y, ay: .5, size: 18, color: K.soft, op: eout(e) }) })
  },
}

// Sequences: terms or digits in boxes, revealed in turn, some marked.
PRIM.sequence = {
  draw(p, lt, box, key) {
    const items = p.items, n = items.length
    const perRow = p.perRow || Math.min(n, 12), rows = Math.ceil(n / perRow)
    const bw = Math.min((box.w - 40) / perRow - 10, 84), bh = Math.min(bw, 72), gap = 10
    const tw = perRow * (bw + gap) - gap, x0 = box.x + (box.w - tw) / 2, y0 = box.y + (box.h - rows * (bh + 24)) / 2 + 20
    const marks = p.marks || {}
    items.forEach((it, i) => {
      const st = (p.at || .3) + i * (p.stagger != null ? p.stagger : .12), e = eout(seg(lt, st, st + .35)); if (e <= 0) return
      const r = Math.floor(i / perRow), c = i % perRow, x = x0 + c * (bw + gap), y = y0 + r * (bh + 24) + 8 * (1 - e)
      const mk = marks[i], mt = mk ? (typeof mk === 'string' ? { tone: mk } : mk) : null
      const me = mt ? eout(seg(lt, mt.at != null ? mt.at : st + .5, (mt.at != null ? mt.at : st + .5) + .4)) : 0
      rrect(x, y, bw, bh, 8); fill(mt ? tone(mt.tone) : '#ffffff', mt ? .16 * me + .04 : .04 * e); stroke(mt && me > 0 ? tone(mt.tone) : K.faint, mt && me > 0 ? 2 : 1, e)
      L(`${key}.i${i}`, rich(String(it)), { x: x + bw / 2, y: y + bh / 2, ax: .5, ay: .5, cls: 'mono', size: Math.min(28, bh * .42), color: mt && me > .5 ? tone(mt.tone) : K.ink, op: e })
      if (p.index) L(`${key}.x${i}`, rich(p.index.replace('#', i + (p.index0 || 0))), { x: x + bw / 2, y: y + bh + 6, ax: .5, cls: 'mono', size: 15, color: K.mute, op: e })
    })
    if (p.ellipsis) { const e = eout(seg(lt, (p.at || .3) + n * (p.stagger || .12), (p.at || .3) + n * (p.stagger || .12) + .4)); L(key + '.el', rich('$\\cdots$'), { x: x0 + tw + 22, y: y0 + (rows - 1) * (bh + 24) + bh / 2, ay: .5, size: 30, color: K.mute, op: e }) }
    if (p.caption) L(key + '.cap', rich(p.caption), { x: box.x + box.w / 2, y: y0 + rows * (bh + 24) + 24, ax: .5, size: 21, color: K.mute, op: eout(seg(lt, .6, 1.1)) })
  },
}

// Equations: KaTeX lines that stack, or replace one another.
PRIM.equation = {
  draw(p, lt, box, key, pd) {
    const lines = p.lines, cx = box.x + box.w / 2
    if (p.mode === 'replace') {
      lines.forEach((ln, i) => {
        const at = ln.at != null ? ln.at : .3 + i * (pd - .6) / lines.length, nx = i + 1 < lines.length ? (lines[i + 1].at != null ? lines[i + 1].at : .3 + (i + 1) * (pd - .6) / lines.length) : 1e9
        const e = eout(seg(lt, at, at + .5)) * (1 - eio(seg(lt, nx - .35, nx)))
        if (e <= 0) return
        L(`${key}.l${i}`, texHTML(ln.tex, true), { x: cx, y: box.y + box.h / 2 + 14 * (1 - e), ax: .5, ay: .5, size: ln.size || 46, color: tone(ln.tone || 'ink'), op: e })
        if (ln.note) L(`${key}.n${i}`, rich(ln.note), { x: cx, y: box.y + box.h / 2 + 84, ax: .5, size: 22, color: K.mute, op: e })
      })
      return
    }
    const n = lines.length, gapY = Math.min(110, box.h / (n + .5))
    let y = box.y + box.h / 2 - gapY * (n - 1) / 2
    lines.forEach((ln, i) => {
      const at = ln.at != null ? ln.at : .3 + i * .9, e = eout(seg(lt, at, at + .5))
      if (e > 0) {
        L(`${key}.l${i}`, texHTML(ln.tex, true), { x: cx, y: y + 12 * (1 - e), ax: .5, ay: .5, size: ln.size || 40, color: tone(ln.tone || 'ink'), op: e })
        if (ln.note) { const w = pool.get(`${key}.l${i}`).offsetWidth; L(`${key}.n${i}`, rich(ln.note), { x: cx + w / 2 + 28, y, ay: .5, size: 20, color: K.mute, op: e }) }
      }
      y += gapY
    })
  },
}

// A tree of dependencies: what the main theorem rests on, built bottom-up.
PRIM.tree = {
  events(p) { return [{ t: (p.at || .3) + (p._depth || 3) * .7 + .4, kind: 'land' }] },
  draw(p, lt, box, key) {
    if (!p._lay) {
      const byId = Object.fromEntries(p.nodes.map(N => [N.id, { ...N, kids: [] }]))
      let root = null
      for (const N of Object.values(byId)) { if (N.parent) { need(byId[N.parent], `tree: no node ${N.parent}`); byId[N.parent].kids.push(N) } else root = root || N }
      need(root, 'tree: one node has no parent (the root)')
      let leaf = 0, depth = 0
      const walk = (N, d) => { N.d = d; depth = Math.max(depth, d); if (!N.kids.length) N.ix = leaf++; else { N.kids.forEach(k => walk(k, d + 1)); N.ix = N.kids.reduce((s, k) => s + k.ix, 0) / N.kids.length } }
      walk(root, 0)
      p._depth = depth
      const X = ix => box.x + 40 + (leaf > 1 ? ix / (leaf - 1) : .5) * (box.w - 80)
      const Y = d => box.y + 40 + (depth ? d / depth : 0) * (box.h - 100)
      for (const N of Object.values(byId)) { N.x = X(N.ix); N.y = Y(N.d) }
      p._lay = { nodes: Object.values(byId), depth }
    }
    const { nodes, depth } = p._lay
    const at = p.at || .3, T = N => at + (depth - N.d) * .7
    for (const N of nodes) for (const k of N.kids) {
      const e = eio(seg(lt, T(k) + .3, T(k) + .9)); if (e <= 0) continue
      const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, yy = lerp(k.y, N.y, u); pts.push([lerp(k.x, N.x, eio(u)), yy]) }
      polyline(pts, e, k.status === 'lean' ? ACC : K.faint, 2, .9, k.status === 'paper' ? [6, 6] : null)
    }
    for (const N of nodes) {
      const e = eout(seg(lt, T(N), T(N) + .5)); if (e <= 0) continue
      const st = N.status || 'paper', c = st === 'lean' ? ACC : st === 'prior' ? K.mute : K.soft
      const html = rich(N.label)
      const [w, h] = measure(`${key}.n_${N.id}`, html, { size: N.d === 0 ? 22 : 19 })
      const bw = w + 30, bh = h + 16
      rrect(N.x - bw / 2, N.y - bh / 2, bw, bh, 10); fill(K.bg, e); fill(c, (st === 'lean' ? .14 : .05) * e); stroke(c, N.d === 0 ? 2.4 : 1.6, e, st === 'paper' ? [5, 5] : null)
      L(`${key}.n_${N.id}`, html, { x: N.x, y: N.y, ax: .5, ay: .5, size: N.d === 0 ? 22 : 19, color: st === 'prior' ? K.mute : K.ink, op: e })
      if (N.d === 0) { const ge = seg(lt, T(N) + .2, T(N) + 1.2); ring(N.x, N.y, 0, ACC, 1, 0); rrect(N.x - bw / 2 - 8 * ge, N.y - bh / 2 - 8 * ge, bw + 16 * ge, bh + 16 * ge, 14); stroke(ACC, 1.5, .6 * (1 - ge)) }
    }
    if (p.legend !== false) {
      const le = eout(seg(lt, at, at + .5)), items = [['lean', 'in Lean', ACC, null], ['paper', 'paper only', K.soft, [5, 5]], ['prior', 'prior work', K.mute, null]]
      let x = box.x + box.w - 10
      for (let i = items.length - 1; i >= 0; i--) {
        const [, lab, c, dash] = items[i]
        const [w] = measure(`${key}.lg${i}`, esc(lab), { size: 16 })
        x -= w; L(`${key}.lg${i}`, esc(lab), { x, y: box.y + box.h - 6, ay: .5, size: 16, color: K.mute, op: le })
        rrect(x - 30, box.y + box.h - 14, 22, 16, 4); stroke(c, 1.6, le, dash); x -= 54
      }
    }
  },
}

// ------------------------------------------------------------------ setup --
async function ready() {
  const q = new URLSearchParams(location.search)
  const base = q.get('katex') || '../../../node_modules/katex/dist/'
  if (!window.katex) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'katex.min.css'; document.head.appendChild(l)
    await new Promise((res, rej) => { l.onload = res; l.onerror = () => rej(new Error('katex css: ' + l.href)) })
    const s = document.createElement('script'); s.src = base + 'katex.min.js'; document.head.appendChild(s)
    await new Promise((res, rej) => { s.onload = res; s.onerror = () => rej(new Error('katex js: ' + s.src)) })
  }
  const fams = ['400 20px "Hanken Grotesk"', '600 20px "Hanken Grotesk"', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"',
    '20px KaTeX_Main', 'bold 20px KaTeX_Main', 'italic 20px KaTeX_Main', 'italic 20px KaTeX_Math', '20px KaTeX_AMS', '20px KaTeX_Size1', '20px KaTeX_Size2', '20px KaTeX_Size3', '20px KaTeX_Size4', '20px KaTeX_Caligraphic', '20px KaTeX_Fraktur', '20px KaTeX_SansSerif', '20px KaTeX_Script', '20px KaTeX_Typewriter']
  await Promise.all(fams.map(f => document.fonts.load(f, 'AaBb0123ωΣ∑')))
  // warm the math fonts with a sample that touches the common faces
  document.getElementById('probe').innerHTML = katex.renderToString('\\omega \\le \\tfrac94 \\sum_{i}\\int \\mathbb{R}\\mathcal{O}\\mathfrak{g}\\left(\\frac{a}{b}\\right)\\big(\\Big(\\bigg(\\Bigg(')
  await document.fonts.ready
  return true
}
window.READY = ready()
window.REEL = { load, frame, get plan() { return PLAN }, DISCIPLINES, KINDS, LEAN, DUR, LIMITS }
