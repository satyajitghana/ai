// Math reels: one 15-20 s, 1280x720 reel per openai/math result family.
//
//   REEL.load(spec) -> { duration, scenes, events, posterT, checks }
//   REEL.frame(t)   paints the frame at time t (seconds)
//
// A frame is a pure function of (spec, t): no timers, no transitions, no
// randomness that is not seeded. Graphics go on the canvas; text and math are
// DOM labels (KaTeX) in #ui, reused by key from frame to frame. The spec
// contract lives in ../SKILL.md and ../schema.json.
//
// Motion model (v2). Every scene is drawn inside a *layer*: one affine camera
// matrix applied both to the canvas (setTransform) and to a DOM div holding
// that scene's labels (CSS matrix), so text and graphics move as one. The
// camera pushes in slowly on each scene's focal point and drifts on a shared,
// continuous path; the background pattern drifts at a third of that speed
// (parallax). Scenes overlap at each cut: a wipe along an accent light bar
// (title -> object), a push-through cross-dissolve (object -> achievement ->
// verify), a dissolve (verify -> end). Accent strokes are drawn twice, the
// second time into a half-size glow buffer that is blurred and added back
// (bloom); the HUD (top bar, captions, progress) never moves with the camera.
'use strict'

const W = 1280, H = 720
const cv = document.getElementById('c'), MAIN = cv.getContext('2d')
let g = MAIN
const UI = document.getElementById('ui')

// ---------------------------------------------------------------- palette --
const K = {
  bg: '#0b0d12', ink: '#ECE9E2', soft: '#C3C8D0', mute: '#8E95A1', faint: '#4A515E', line: '#262B35',
  ok: '#7BD88F', warn: '#E7B65C', bad: '#F07C7C', hot: '#FFD479', cool: '#9FB4D6',
}
// One accent per discipline, all at a similar lightness so no reel shouts.
// Names are exactly the review/catalogue discipline strings. The second entry
// is the background pattern the discipline is drawn over.
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
const PATTERNS = {
  'Number theory': 'lattice', 'Algebra': 'lattice', 'Group theory': 'lattice', 'Operator algebras': 'lattice', 'Algebraic and complex geometry': 'lattice',
  'Real and complex analysis': 'waves', 'Functional analysis': 'waves', 'Partial differential equations': 'waves', 'Mathematical physics': 'waves', 'Dynamical systems and ergodic theory': 'waves',
  'Combinatorics': 'network', 'Theoretical computer science': 'network', 'Mathematical logic': 'network',
  'Convex and metric geometry': 'contours', 'Differential geometry': 'contours', 'Topology': 'contours',
  'Probability and statistical mechanics': 'walk',
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
const LIMITS = { short: 44, title: 64, subtitle: 110, heading: 72, text: 96, note: 80, detail: 100, label: 72, context: 110, ourCheck: 80, review: 40, gap: 40 }

let ACC = '#6CB6FF', SPEC = null, PLAN = null, ALPHA = 1

// ------------------------------------------------------------------ maths --
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const lerp = (a, b, e) => a + (b - a) * e
const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const eout = x => 1 - Math.pow(1 - x, 3)
const eback = x => { const c = 1.4, d = x - 1; return 1 + (c + 1) * d * d * d + c * d * d }
const bell = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x))
// a pulse that rises fast and decays: 0 at x<=0, peak near .15, 0 at x>=1
const flare = x => (x <= 0 || x >= 1 ? 0 : Math.min(1, x / .15) * Math.pow(1 - x, 1.6))
function hexrgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const rgba = (h, a) => { const [r, gg, b] = hexrgb(h); return `rgba(${r},${gg},${b},${a})` }
function mix(h1, h2, k) { const a = hexrgb(h1), b = hexrgb(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join('') }
function tone(n) {
  if (!n) return K.ink
  if (n[0] === '#') return n
  return { accent: ACC, claim: ACC, new: ACC, ink: K.ink, soft: K.soft, old: K.mute, mute: K.mute, faint: K.faint, ok: K.ok, warn: K.warn, bad: K.bad, hot: K.hot, cool: K.cool }[n] || K.ink
}
// a seeded PRNG for anything decorative; seeded by family id
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }

// 2-D affine matrices in canvas order [a, b, c, d, e, f]
const I = [1, 0, 0, 1, 0, 0]
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
// scale s about (fx, fy), then translate by (dx, dy)
const about = (fx, fy, s, dx = 0, dy = 0) => [s, 0, 0, s, fx + dx - s * fx, fy + dy - s * fy]

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
// The same, with every word and every math chunk in its own <span class="w">
// so a label can be revealed word by word (stagger()).
function richW(s) {
  const out = []
  String(s).split(/(\$[^$]+\$)/).forEach(part => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) { out.push(`<span class="w">${texHTML(part.slice(1, -1))}</span>`); return }
    part.split(/(==.+?==|\*\*.+?\*\*)/).forEach(q => {
      let pre = '', post = ''
      if (q.length > 4 && q.startsWith('==') && q.endsWith('==')) { q = q.slice(2, -2); pre = `<span style="color:${ACC}">`; post = '</span>' }
      else if (q.length > 4 && q.startsWith('**') && q.endsWith('**')) { q = q.slice(2, -2); pre = '<b style="font-weight:680">'; post = '</b>' }
      q.split(/(\s+)/).forEach(w => { if (!w) return; out.push(/^\s+$/.test(w) ? ' ' : `<span class="w">${pre}${esc(w)}${post}</span>`) })
    })
  })
  return out.join('')
}
const WORDS = '.w', TERMS = '.katex-html > .base > *:not(.strut)'

// DOM labels, pooled by key. Each frame marks what it uses; the rest hide.
// A label lives in the div of the layer it was last drawn in.
const pool = new Map(); let used = new Set()
const LAYERS = new Map(); let LAYER = null, M = I, BLOOM_PASS = false
function L(key, html, o = {}) {
  if (BLOOM_PASS && pool.has(key)) return pool.get(key)
  let e = pool.get(key)
  if (!e) { e = document.createElement('div'); e.className = 'lb'; pool.set(key, e); e._h = null; e._c = null }
  const host = LAYER || UI
  if (e.parentNode !== host) host.appendChild(e)
  const cls = 'lb ' + (o.cls || '') + (o.w ? ' wrap' : '')
  if (e._c !== cls) { e.className = cls; e._c = cls }
  const sty = `${o.size || 26}|${o.color || K.ink}|${o.weight || ''}|${o.w || ''}|${o.align || ''}|${o.lh || ''}|${o.ls || ''}`
  if (e._s !== sty) {
    e._s = sty
    e.style.fontSize = (o.size || 26) + 'px'; e.style.color = o.color || K.ink
    e.style.fontWeight = o.weight || ''; e.style.width = o.w ? o.w + 'px' : ''
    e.style.textAlign = o.align || ''; e.style.lineHeight = o.lh || ''; e.style.letterSpacing = o.ls || ''
  }
  if (e._h !== html) { e.innerHTML = html; e._h = html; e._items = null }
  used.add(key)
  const op = clamp((o.op == null ? 1 : o.op) * ALPHA)
  e.style.opacity = op.toFixed(4)
  e.style.display = op <= .002 ? 'none' : ''
  const ax = o.ax || 0, ay = o.ay || 0, s = o.scale || 1
  e.style.transform = `translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px)${o.rot ? ` rotate(${o.rot}rad)` : ''} scale(${s}) translate(${-ax * 100}%,${-ay * 100}%)`
  // a soft glow behind accent text (0..1)
  const gl = o.glow ? `0 0 ${(10 + 16 * o.glow).toFixed(1)}px ${rgba(o.glowColor || o.color || ACC, (.55 * o.glow).toFixed(3))}` : ''
  if (e._gl !== gl) { e.style.textShadow = gl; e._gl = gl }
  if (o.st) stagger(e, o.st)
  return e
}
// Reveal the parts of a label one after another: words (sel WORDS) or the
// top-level terms of a KaTeX formula (sel TERMS). p runs 0..1 over the whole
// reveal; each part fades in and rises dy px, starting spread*i/(n-1) in.
function stagger(e, { sel = WORDS, p = 1, spread = .6, dy = 10, dx = 0 }) {
  if (!e._items || e._sel !== sel) { e._items = [...e.querySelectorAll(sel)]; e._sel = sel; e._iv = [] }
  const n = e._items.length
  e._items.forEach((it, i) => {
    const st = n > 1 ? spread * i / (n - 1) : 0, k = eout(clamp((p - st) / (1 - spread || 1)))
    const key = k.toFixed(3); if (e._iv[i] === key) return; e._iv[i] = key
    it.style.position = 'relative'; it.style.opacity = key
    it.style.top = (dy * (1 - k)).toFixed(2) + 'px'; it.style.left = dx ? (dx * (1 - k)).toFixed(2) + 'px' : ''
  })
}
// size of a label without showing it (laid out, then hidden this frame)
function measure(key, html, o = {}) {
  const was = used.has(key), e = L(key, html, { ...o, op: 1, st: null })
  const r = [e.offsetWidth, e.offsetHeight]
  if (!was && !BLOOM_PASS) { used.delete(key); e.style.display = 'none' }
  return r
}

// ----------------------------------------------------------------- layers --
// A layer is a camera matrix shared by the canvas and a DOM div, an opacity,
// and an optional clip polygon (in screen pixels).
const GL = document.createElement('canvas'); GL.width = W / 2; GL.height = H / 2
const GG = GL.getContext('2d')
const GB = document.createElement('canvas'); GB.width = W / 2; GB.height = H / 2
const GBG = GB.getContext('2d')
let BLOOMED = false
function layerDiv(name, z) {
  let d = LAYERS.get(name)
  if (!d) { d = document.createElement('div'); d.className = 'layer'; if (z) d.style.zIndex = z; UI.appendChild(d); LAYERS.set(name, d); d._t = null; d._c = null }
  d._used = true
  return d
}
function withLayer(name, m, a, clip, fn, z) {
  const pM = M, pL = LAYER, pA = ALPHA
  M = mul(pM, m); LAYER = layerDiv(name, z)
  const css = `matrix(${M.map(v => +v.toFixed(5)).join(',')})`
  if (LAYER._t !== css) { LAYER.style.transform = css; LAYER._t = css }
  // the clip, mapped into the layer's own coordinates
  const loc = clip && clip.map(([x, y]) => [(x - M[4]) / M[0], (y - M[5]) / M[3]])
  const cp = loc ? `polygon(${loc.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` : ''
  if (LAYER._c !== cp) { LAYER.style.clipPath = cp; LAYER._c = cp }
  for (const [c, k] of [[MAIN, 1], [GG, .5]]) {
    c.save(); c.setTransform(M[0] * k, M[1] * k, M[2] * k, M[3] * k, M[4] * k, M[5] * k)
    if (loc) { c.beginPath(); loc.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip() }
  }
  ALPHA = pA * a
  try { fn() } finally { MAIN.restore(); GG.restore(); M = pM; LAYER = pL; ALPHA = pA }
}
// Draw fn normally, then again into the glow buffer (k scales its alpha).
function bloom(fn, k = 1) {
  fn()
  if (BLOOM_PASS || k <= 0) return
  const keepA = ALPHA
  // the glow buffer follows whatever transform the main canvas has now
  // (a layer's camera, plus any local translate/rotate the caller made)
  const m = MAIN.getTransform()
  GG.save(); GG.setTransform(m.a * .5, m.b * .5, m.c * .5, m.d * .5, m.e * .5, m.f * .5)
  BLOOM_PASS = true; g = GG; ALPHA = keepA * k; BLOOMED = true
  try { fn() } finally { BLOOM_PASS = false; g = MAIN; ALPHA = keepA; GG.restore() }
}
function compositeBloom() {
  if (!BLOOMED) return
  GBG.setTransform(1, 0, 0, 1, 0, 0); GBG.globalCompositeOperation = 'copy'
  GBG.filter = 'blur(2.5px)'; GBG.drawImage(GL, 0, 0); GBG.filter = 'none'; GBG.globalCompositeOperation = 'source-over'
  MAIN.save(); MAIN.setTransform(1, 0, 0, 1, 0, 0); MAIN.globalCompositeOperation = 'lighter'
  MAIN.globalAlpha = .65; MAIN.drawImage(GB, 0, 0, W, H)
  GBG.globalCompositeOperation = 'copy'; GBG.filter = 'blur(9px)'; GBG.drawImage(GL, 0, 0); GBG.filter = 'none'; GBG.globalCompositeOperation = 'source-over'
  MAIN.globalAlpha = .5; MAIN.drawImage(GB, 0, 0, W, H)
  MAIN.restore()
}

// ----------------------------------------------------------------- canvas --
function A(a) { g.globalAlpha = clamp(ALPHA * (a == null ? 1 : a)) }
function stroke(color, w, a, dash) { A(a); g.strokeStyle = color; g.lineWidth = w * (BLOOM_PASS ? 1.8 : 1); g.setLineDash(dash || []); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.setLineDash([]) }
function fill(color, a) { A(a); g.fillStyle = color; g.fill() }
function line(x1, y1, x2, y2, color, w = 2, a = 1, dash) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); stroke(color, w, a, dash) }
function dot(x, y, r, color, a = 1) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 2 * Math.PI); fill(color, a) }
function ring(x, y, r, color, w = 2, a = 1) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 2 * Math.PI); stroke(color, w, a) }
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))) }
// soft round light, from a cached radial sprite (cheap)
const SPR = new Map()
function sprite(color) {
  let c = SPR.get(color)
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d')
    const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(.22, rgba(color, .5)); gr.addColorStop(.55, rgba(color, .12)); gr.addColorStop(1, rgba(color, 0))
    q.fillStyle = gr; q.fillRect(0, 0, 64, 64); SPR.set(color, c)
  }
  return c
}
function glowDot(x, y, r, color, a = 1) { if (a <= .002 || r <= 0) return; A(a); g.drawImage(sprite(color), x - r, y - r, 2 * r, 2 * r) }
// the tip of a line that is being drawn: a hot core in a soft halo
function pen(x, y, color, a = 1, r = 16) { if (a <= .002) return; bloom(() => { glowDot(x, y, r, color, .85 * a); dot(x, y, 2.6, '#ffffff', .9 * a) }) }
// a polyline drawn up to fraction f of its length; returns the tip
function polyline(pts, f, color, w, a, dash) {
  if (f <= 0 || pts.length < 2) return null
  let total = 0; const seglen = []
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seglen.push(d); total += d }
  let left = total * clamp(f), tip = pts[0]
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = seglen[i - 1], k = Math.min(1, left / (d || 1))
    tip = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]
    g.lineTo(tip[0], tip[1]); left -= d
  }
  stroke(color, w, a, dash)
  return tip
}
function arrowHead(x, y, ang, size, color, a = 1) {
  g.beginPath(); g.moveTo(x, y)
  g.lineTo(x - size * Math.cos(ang - .45), y - size * Math.sin(ang - .45))
  g.lineTo(x - size * Math.cos(ang + .45), y - size * Math.sin(ang + .45)); g.closePath(); fill(color, a)
}
// a rounded rectangle's outline traced to fraction f, from its top-left corner
function traceRect(x, y, w, h, r, f, color, lw, a) {
  if (f <= 0) return
  const per = 2 * (w + h) - (8 - 2 * Math.PI) * r
  rrect(x, y, w, h, r)
  if (f >= 1) return stroke(color, lw, a)
  A(a); g.strokeStyle = color; g.lineWidth = lw * (BLOOM_PASS ? 1.8 : 1); g.lineCap = 'round'
  g.setLineDash([per * f, per]); g.lineDashOffset = 0; g.stroke(); g.setLineDash([])
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
// Base colour, two slow pools of light, the discipline's pattern (drawn once,
// then drifted with parallax), a veil that keeps the centre quiet behind the
// content, and a vignette.
let BGP = null, VIG = null
const PAD = 48
function buildBackground() {
  const kind = PATTERNS[SPEC.discipline] || 'lattice', R = rng(parseInt(SPEC.id, 10) * 7919 + 13)
  const period = kind === 'waves' ? 400 : 0
  const c = document.createElement('canvas'); c.width = W + 2 * PAD + period; c.height = H + 2 * PAD
  const q = c.getContext('2d'), cw = c.width, ch = c.height
  const col = mix(ACC, K.ink, .35)
  q.lineCap = 'round'; q.lineJoin = 'round'
  const B = { c, kind, period, pulses: [] }
  if (kind === 'lattice') {
    // a slightly rotated integer lattice: hairlines, and a dot at every point
    const s = 58, rot = -.21, cx = cw / 2, cy = ch / 2
    q.save(); q.translate(cx, cy); q.rotate(rot)
    const n = Math.ceil(Math.hypot(cw, ch) / s / 2) + 1
    q.strokeStyle = rgba(col, .05); q.lineWidth = 1
    for (let i = -n; i <= n; i++) { q.beginPath(); q.moveTo(i * s, -n * s); q.lineTo(i * s, n * s); q.moveTo(-n * s, i * s); q.lineTo(n * s, i * s); q.stroke() }
    q.fillStyle = rgba(col, .2)
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { q.beginPath(); q.arc(i * s, j * s, 1.6, 0, 7); q.fill() }
    // a few sublattice points picked out
    q.fillStyle = rgba(ACC, .32)
    for (let i = -n; i <= n; i += 3) for (let j = -n; j <= n; j += 2) if (R() < .35) { q.beginPath(); q.arc(i * s, j * s, 2.6, 0, 7); q.fill() }
    q.restore()
  } else if (kind === 'waves') {
    // standing families of sinusoids whose wavelengths divide the period, so
    // the strip scrolls seamlessly
    for (let k = 0; k < 15; k++) {
      const y0 = (k + .5) * ch / 15, m1 = 1 + Math.floor(R() * 3), m2 = 3 + Math.floor(R() * 4), a1 = 10 + R() * 18, a2 = 3 + R() * 6, p1 = R() * 6.3, p2 = R() * 6.3
      q.beginPath()
      for (let x = 0; x <= cw; x += 4) { const y = y0 + a1 * Math.sin(2 * Math.PI * m1 * x / period + p1) + a2 * Math.sin(2 * Math.PI * m2 * x / period + p2); x ? q.lineTo(x, y) : q.moveTo(x, y) }
      q.strokeStyle = rgba(k % 4 === 1 ? ACC : col, k % 4 === 1 ? .11 : .06); q.lineWidth = k % 4 === 1 ? 1.4 : 1; q.stroke()
    }
  } else if (kind === 'network') {
    // a random geometric graph: points on a jittered grid, near pairs joined
    const pts = [], s = 112
    for (let x = s / 2; x < cw; x += s) for (let y = s / 2; y < ch; y += s) pts.push([x + (R() - .5) * s * .8, y + (R() - .5) * s * .8])
    const edges = []
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < s * 1.25 && R() < .62) edges.push([i, j]) }
    q.strokeStyle = rgba(col, .07); q.lineWidth = 1
    for (const [i, j] of edges) { q.beginPath(); q.moveTo(...pts[i]); q.lineTo(...pts[j]); q.stroke() }
    for (const p of pts) { q.fillStyle = rgba(col, .22); q.beginPath(); q.arc(p[0], p[1], 2, 0, 7); q.fill() }
    // a handful of packets travel the network forever
    for (let k = 0; k < 7; k++) { const e = edges[Math.floor(R() * edges.length)]; if (e) B.pulses.push({ a: pts[e[0]], b: pts[e[1]], ph: R(), sp: .18 + R() * .16 }) }
  } else if (kind === 'contours') {
    // level sets of a few smooth bumps, as nested closed curves
    for (let b = 0; b < 4; b++) {
      const cx = R() * cw, cy = R() * ch, h = [R() * 6.3, R() * 6.3, R() * 6.3]
      for (let k = 1; k <= 9; k++) {
        const r0 = k * 26
        q.beginPath()
        for (let i = 0; i <= 120; i++) { const th = 2 * Math.PI * i / 120, r = r0 * (1 + .16 * Math.sin(2 * th + h[0]) + .1 * Math.sin(3 * th + h[1]) + .06 * Math.sin(5 * th + h[2]) * (k / 9)); const x = cx + r * Math.cos(th), y = cy + r * .82 * Math.sin(th); i ? q.lineTo(x, y) : q.moveTo(x, y) }
        q.closePath(); q.strokeStyle = rgba(k === 5 ? ACC : col, k === 5 ? .1 : .055); q.lineWidth = 1; q.stroke()
      }
    }
  } else {
    // 'walk': Brownian paths and the points they visit
    for (let k = 0; k < 9; k++) {
      let x = R() * cw, y = R() * ch
      q.beginPath(); q.moveTo(x, y)
      for (let i = 0; i < 260; i++) { const u = R(), v = R(); const n = Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.cos(2 * Math.PI * v); const n2 = Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.sin(2 * Math.PI * v); x += n * 9; y += n2 * 9; q.lineTo(x, y) }
      q.strokeStyle = rgba(k % 3 ? col : ACC, k % 3 ? .06 : .09); q.lineWidth = 1; q.stroke()
    }
    q.fillStyle = rgba(col, .18)
    for (let i = 0; i < 140; i++) { q.beginPath(); q.arc(R() * cw, R() * ch, 1.4, 0, 7); q.fill() }
  }
  BGP = B
  if (!VIG) {
    VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H
    const v = VIG.getContext('2d')
    // centre veil: the pattern recedes behind the content
    let gr = v.createRadialGradient(W / 2, H / 2 + 10, 0, W / 2, H / 2 + 10, W * .46)
    gr.addColorStop(0, rgba(K.bg, .78)); gr.addColorStop(.6, rgba(K.bg, .5)); gr.addColorStop(1, rgba(K.bg, 0))
    v.fillStyle = gr; v.fillRect(0, 0, W, H)
    gr = v.createRadialGradient(W / 2, H / 2, H * .32, W / 2, H / 2, W * .74)
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)')
    v.fillStyle = gr; v.fillRect(0, 0, W, H)
  }
}
function background(t, D, lvl) {
  g = MAIN; MAIN.setTransform(1, 0, 0, 1, 0, 0); A(1); MAIN.globalCompositeOperation = 'source-over'
  MAIN.fillStyle = K.bg; MAIN.fillRect(0, 0, W, H)
  // the pattern, with parallax (a third of the camera's drift) and, for waves, a slow flow
  const ox = -PAD - .35 * D[0] - (BGP.period ? (t * 9) % BGP.period : 0), oy = -PAD - .35 * D[1] - 4 * Math.sin(t * .13)
  A(lvl); MAIN.drawImage(BGP.c, ox, oy)
  for (const p of BGP.pulses) {
    const u = (t * p.sp + p.ph) % 1, x = lerp(p.a[0], p.b[0], u) + ox, y = lerp(p.a[1], p.b[1], u) + oy
    glowDot(x, y, 9, ACC, .35 * lvl * bell(u))
  }
  A(1); MAIN.drawImage(VIG, 0, 0)
  // two slow pools of light
  const gx = 1010 + 46 * Math.sin(t * .19), gy = 120 + 34 * Math.cos(t * .15)
  let gr = MAIN.createRadialGradient(gx, gy, 0, gx, gy, 700)
  gr.addColorStop(0, rgba(ACC, .09)); gr.addColorStop(1, rgba(ACC, 0)); MAIN.fillStyle = gr; MAIN.fillRect(0, 0, W, H)
  const hx = 160 + 40 * Math.cos(t * .11), hy = 700 + 20 * Math.sin(t * .17)
  gr = MAIN.createRadialGradient(hx, hy, 0, hx, hy, 640)
  gr.addColorStop(0, 'rgba(120,140,190,0.06)'); gr.addColorStop(1, 'rgba(120,140,190,0)'); MAIN.fillStyle = gr; MAIN.fillRect(0, 0, W, H)
}

// --------------------------------------------------------------- the plan --
function need(c, msg) { if (!c) throw new Error(`reel ${SPEC && SPEC.id}: ${msg}`) }
function durOf(name, v) { const [a, b, d] = DUR[name]; if (v == null) return d; need(v >= a && v <= b, `${name}.dur ${v} outside ${a}-${b} s`); return v }

// when the stamp starts, and when it hits the page (scene-local seconds)
const STAMP_HIT = .3
function stampAt(ac) { return ac.form === 'status' ? 1.5 : ac.stamp ? 2.4 : null }

function load(spec) {
  SPEC = spec; pool.forEach(e => e.remove()); pool.clear(); LAYERS.forEach(d => d.remove()); LAYERS.clear()
  need(/^\d{3}$/.test(spec.id || ''), 'id must be a 3-digit family number')
  need(DISCIPLINES[spec.discipline], `unknown discipline "${spec.discipline}"`)
  need(KINDS[spec.kind], `kind must be one of ${Object.keys(KINDS).join(', ')}`)
  ACC = DISCIPLINES[spec.discipline]; SPR.clear(); BGP = null
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
    p._last = i === panels.length - 1
    p._key = 'p' + i
    for (const k of Object.keys(p)) if (k.startsWith('_') && !['_t0', '_t1', '_last', '_key'].includes(k)) delete p[k]
  })
  ob._panels = panels; ob._layout = layout
  const ac = spec.achievement
  scenes[2].impacts = stampAt(ac) != null ? [stampAt(ac) + STAMP_HIT] : []
  CHECKS = {}
  for (const p of panels) if (p.primitive === 'graph') { p._g = null; p._g0 = buildGraph(p, BOX); if (p._g0.cross) CHECKS.crossings = p._g0.cross.length }
  // events for the sound bed: every cut, plus the beats that land something
  const events = scenes.slice(1).map(s => ({ t: +s.t0.toFixed(3), kind: 'cut' }))
  for (const p of panels) for (const e of (PRIM[p.primitive].events ? PRIM[p.primitive].events(p) : [])) if (e.t <= p._t1 - p._t0 + .3) events.push({ t: +(scenes[1].t0 + p._t0 + e.t).toFixed(3), kind: e.kind })
  events.push({ t: +(scenes[2].t0 + 1.35).toFixed(3), kind: 'land' })
  if (stampAt(ac) != null) events.push({ t: +(scenes[2].t0 + stampAt(ac) + STAMP_HIT - .02).toFixed(3), kind: 'stamp' })
  events.push({ t: +(scenes[3].t0 + .45).toFixed(3), kind: 'badge' })
  events.sort((a, b) => a.t - b.t)
  PLAN = { scenes, duration: t, panels, events }
  checkText(spec)
  fitLayout(spec)
  buildBackground()
  const o = scenes[1]
  return { id: spec.id, duration: +t.toFixed(3), scenes: scenes.map(s => ({ name: s.name, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3) })), events, posterT: +(o.t1 - .6).toFixed(3), checks: CHECKS }
}

// Text the viewer reads: length limits, and no glyph the fonts cannot set.
// GLYPHS is the real coverage shared by the bundled Hanken Grotesk and IBM
// Plex Mono files (base + latin-ext subsets), measured with fontTools:
// ASCII, Latin-1, Latin Extended-A (Lazić, Forstnerič, Erdős) and the usual
// punctuation. Anything else goes inside $...$ and is set by KaTeX.
const GLYPH_RANGES = [[32, 126], [160, 382], [399, 399], [402, 402], [416, 417], [431, 432], [461, 468], [506, 511], [536, 539], [567, 567], [601, 601], [710, 711], [730, 730], [732, 733], [768, 769], [771, 772], [776, 777], [803, 803], [7808, 7813], [7838, 7838], [7922, 7929], [8211, 8212], [8216, 8218], [8220, 8222], [8224, 8224], [8226, 8226], [8230, 8230], [8249, 8250], [8260, 8260], [8363, 8364], [8369, 8369], [8372, 8372], [8376, 8376], [8381, 8381], [8482, 8482], [8722, 8722], [8725, 8725]]
const hasGlyph = c => GLYPH_RANGES.some(([a, b]) => c >= a && c <= b)
const badGlyphs = s => [...new Set([...s].filter(ch => !hasGlyph(ch.codePointAt(0))))]
function checkText(spec) {
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const lim = LIMITS[path.split('.').pop()]
      const plain = v.replace(/\$[^$]+\$/g, 'x').replace(/==|\*\*/g, '')
      if (lim) need(plain.length <= lim, `${path} is ${plain.length} characters, limit ${lim}: "${v}"`)
      const isTex = /(^|\.)tex$/.test(path) || /(^|\.)statement\.\d+$/.test(path)
      if (isTex) { try { texHTML(v) } catch (e) { need(false, `${path}: KaTeX cannot set "${v}": ${e.message}`) } }
      else if (!/(^|\.)(f|f2|expr|id|discipline|kind|primitive|preset|tone|side|gapSide|form|stamp|lean|layout|mode|direction|status|parent|url|scene|archetype|ref|quote|\$schema)$/.test(path) && !/\.(deps|sources|voice)\./.test(path) && !/^voice\./.test(path)) {
        const bad = badGlyphs(v.replace(/\$[^$]+\$/g, ''))
        need(!bad.length, `${path}: the fonts have no ${bad.map(c => `"${c}" (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}; put math and symbols inside $...$ ("${v}")`)
        need((v.match(/\$/g) || []).length % 2 === 0, `${path}: unbalanced $ in "${v}"`)
        // every $...$ must compile now, not at render time
        try { rich(v.replace(/#/g, '0')) } catch (e) { need(false, `${path}: KaTeX cannot set "${v}": ${e.message}`) }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '.' + i))
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!k.startsWith('_') && k !== 'sources') walk(v[k], path ? path + '.' + k : k)
  }
  walk(spec, '')
}

// Formulas that would run off the frame are set smaller, down to a floor;
// below the floor the spec is refused (shorten it, or split the line).
function fitSize(html, size, maxW, min, what) {
  let s = size
  for (let k = 0; k < 12; k++) {
    const [w] = measure('_fit', html, { size: s })
    if (w <= maxW) return s
    s = Math.max(min, Math.floor(s * maxW / w * 0.98))
    if (s === min) { const [w2] = measure('_fit', html, { size: s }); need(w2 <= maxW, `${what} is ${w2}px wide even at ${min}px (room: ${maxW}px); shorten it or split it`); return s }
  }
  return s
}
function fitLayout(spec) {
  const ac = spec.achievement
  if (ac.form === 'status') {
    const lines = ac.statement || []
    ac._sizes = lines.map((tx, i) => fitSize(rich(`$${tx}$`), lines.length > 1 ? 44 : 52, 1120, 28, `achievement.statement.${i}`))
  } else if (ac.before && ac.after) {
    ac.before._size = fitSize(rich(`$${ac.before.tex}$`), 52, 470, 30, 'achievement.before.tex')
    ac.after._size = fitSize(rich(`$${ac.after.tex}$`), 60, 520, 32, 'achievement.after.tex')
  }
  const ob = spec.object, n = ob._panels.length
  ob._panels.forEach((p, i) => {
    if (p.primitive !== 'equation') return
    const bw = ob._layout === 'split' ? (BOX.w - 48 * (n - 1)) / n : BOX.w
    ;(p.lines || []).forEach((ln, j) => { ln._size = fitSize(texHTML(ln.tex, true), ln.size || (p.mode === 'replace' ? 46 : 40), bw - 20, 22, `object equation line ${j}`) })
  })
  const f = pool.get('_fit'); if (f) { f.remove(); pool.delete('_fit') }
  used.delete('_fit')
}

// ---------------------------------------------------------------- framing --
const BOX = { x: 96, y: 128, w: 1088, h: 448 }
let CHECKS = {}
// Cuts: how scene k hands over to scene k+1, and the overlap around the cut.
const TRANS = ['wipe', 'push', 'push', 'dissolve']
const TR_PRE = .3, TR_POST = .45
// Camera per scene: focal point and how far it pushes in over the scene.
const CAM = { title: [380, 300, .028], object: [640, 352, .034], achievement: [640, 330, .028], verify: [640, 300, .022], end: [640, 340, .02] }
// pattern strength per scene: the background recedes while the maths is on
const BGL = { title: 1, object: .6, achievement: .75, verify: .85, end: 1 }
// the shared, continuous camera drift (px)
const drift = t => [7 * Math.sin(t * .23 + .7) + 3 * Math.sin(t * .41 + 2.1), 4.5 * Math.sin(t * .19 + 1.3) + 2 * Math.sin(t * .37)]

function camera(s, lt, D) {
  const [fx, fy, push] = CAM[s.name]
  let sc = 1 + push * clamp((lt + TR_PRE) / (s.dur + TR_PRE + TR_POST)), dy = 0
  for (const it of s.impacts || []) { const d = seg(lt, it, it + .45); if (d > 0 && d < 1) { const k = Math.sin(Math.PI * d) * Math.pow(1 - d, 1.5); dy += 3 * k; sc += .006 * k } }
  return about(fx, fy, sc, -D[0], -D[1] + dy)
}

function frame(t) {
  used = new Set(); CHECKS = CHECKS || {}
  for (const d of LAYERS.values()) d._used = false
  M = I; LAYER = null; ALPHA = 1; g = MAIN; BLOOM_PASS = false; BLOOMED = false
  GG.setTransform(1, 0, 0, 1, 0, 0); GG.clearRect(0, 0, W / 2, H / 2)
  const { scenes, duration } = PLAN
  const D = drift(t)
  // background level: blend the levels of the scenes either side of a cut
  let lvl = BGL.title
  scenes.forEach((s, k) => { if (k && t >= s.t0 - TR_PRE) lvl = lerp(BGL[scenes[k - 1].name], BGL[s.name], eio(seg(t, s.t0 - TR_PRE, s.t0 + TR_POST))) })
  background(t, D, lvl)
  let wipe = null
  scenes.forEach((s, k) => {
    const last = k === scenes.length - 1
    if (t < (k ? s.t0 - TR_PRE : 0) - 1e-9) return
    if (!last && t > s.t1 + TR_POST + 1e-9) return
    const lt = t - s.t0
    let a = 1, m = camera(s, lt, D), clip = null
    if (k === 0) a *= eout(seg(lt, 0, .55))
    else {
      const p = seg(t, s.t0 - TR_PRE, s.t0 + TR_POST), ty = TRANS[k - 1]
      if (ty === 'wipe') { if (p < 1) { const xw = lerp(-140, W + 140, eio(p)); clip = [[-20, -20], [xw + 110, -20], [xw - 110, H + 20], [-20, H + 20]]; wipe = { xw, p } } }
      // the incoming scene arrives in the back half of the overlap, so text
      // never sits on text at half strength
      else if (ty === 'push') { const e = eout(seg(p, .35, 1)); a *= e; m = mul(about(640, 360, lerp(.955, 1, eout(p))), m) }
      else a *= eio(seg(p, .3, 1))
    }
    if (!last) {
      const p = seg(t, s.t1 - TR_PRE, s.t1 + TR_POST), ty = TRANS[k]
      if (p > 0) {
        if (ty === 'wipe') { const xw = lerp(-140, W + 140, eio(p)); clip = [[xw + 110, -20], [W + 20, -20], [W + 20, H + 20], [xw - 110, H + 20]]; a *= 1 - .5 * p; m = mul(about(640, 360, 1 + .03 * eio(p)), m) }
        else if (ty === 'push') { a *= 1 - eio(seg(p, 0, .6)); m = mul(about(640, 360, 1 + .07 * eio(p)), m) }
        else a *= 1 - eio(seg(p, 0, .7))
      }
    } else a *= 1 - eio(seg(t, duration - .5, duration))
    if (a <= .002) return
    withLayer(s.name, m, a, clip, () => SCENES[s.name](s.sc, lt, s.dur, t))
    if (HUDS[s.name]) withLayer(s.name + '.hud', I, a, clip, () => HUDS[s.name](s.sc, lt, s.dur, t), 5)
  })
  compositeBloom()
  // the wipe's light bar, along the cut
  if (wipe) {
    const b = bell(wipe.p), { xw } = wipe
    const gr = MAIN.createLinearGradient(xw - 70, 0, xw + 70, 0)
    gr.addColorStop(0, rgba(ACC, 0)); gr.addColorStop(.5, rgba(ACC, .16 * b)); gr.addColorStop(1, rgba(ACC, 0))
    MAIN.globalAlpha = 1; MAIN.fillStyle = gr
    MAIN.beginPath(); MAIN.moveTo(xw + 110 - 70, -20); MAIN.lineTo(xw + 110 + 70, -20); MAIN.lineTo(xw - 110 + 70, H + 20); MAIN.lineTo(xw - 110 - 70, H + 20); MAIN.closePath(); MAIN.fill()
    g = MAIN; line(xw + 110, -20, xw - 110, H + 20, mix(ACC, '#ffffff', .35), 2, .9 * b)
  }
  // chrome: who this is, on every scene after the title
  const ti = scenes[0], en = scenes[scenes.length - 1]
  const ca = seg(t, ti.t1 - .1, ti.t1 + .5) * (1 - seg(t, en.t0 - .3, en.t0 + .1))
  if (ca > 0) withLayer('hud', I, 1, null, () => chromeBar(ca, t), 6)
  // progress hairline, with a glowing head
  g = MAIN; MAIN.setTransform(1, 0, 0, 1, 0, 0)
  const px = W * clamp(t / duration)
  A(.5); MAIN.fillStyle = ACC; MAIN.fillRect(0, H - 3, px, 3)
  glowDot(px, H - 1.5, 10, ACC, .5 * (1 - seg(t, duration - .5, duration)))
  for (const [k, e] of pool) if (!used.has(k) && e.style.display !== 'none') e.style.display = 'none'
  for (const d of LAYERS.values()) { const v = d._used ? '' : 'none'; if (d.style.display !== v) d.style.display = v }
  A(1)
}

function chromeBar(a, t) {
  const keep = ALPHA; ALPHA = a
  const x = lerp(70, 84, eout(a))
  dot(x, 46, 6, ACC, 1); glowDot(x, 46, 16, ACC, .35 + .1 * Math.sin(t * 2.1))
  const idw = measure('ch.id', esc(SPEC.id), { cls: 'mono', size: 19 })[0]
  L('ch.id', esc(SPEC.id), { x: x + 16, y: 46, ay: .5, cls: 'mono', size: 19, color: K.soft })
  L('ch.t', rich(SPEC.short || SPEC.title.title), { x: x + 16 + idw + 14, y: 46, ay: .5, size: 19, color: K.mute, weight: 500 })
  L('ch.d', esc(SPEC.discipline), { x: W - 84, y: 46, ax: 1, ay: .5, cls: 'caps', size: 14, color: K.mute })
  ALPHA = keep
}

// ----------------------------------------------------------------- scenes --
const SCENES = {
  title(sc, lt, dur) {
    const x = 96
    // giant family number, a quiet watermark that drifts against the camera
    const we = eout(seg(lt, 0, 1.2))
    L('ti.num', esc(SPEC.id), { x: W - 70 + 22 * (1 - we) - 18 * lt / dur, y: 560, ax: 1, ay: .5, cls: 'mono', size: 230, color: rgba(ACC, .13), op: we, weight: 500 })
    L('ti.fam', 'Family', { x: W - 86, y: 428, ax: 1, ay: 1, cls: 'caps', size: 15, color: K.mute, op: eout(seg(lt, .2, 1)) })
    // discipline chip + kind, sliding in one after the other
    const cy = 200, ce = eout(seg(lt, 0, .5)), ke = eout(seg(lt, .12, .62))
    const [cw] = measure('ti.chip', esc(SPEC.discipline), { cls: 'caps', size: 16 })
    const cx = x - 14 * (1 - ce)
    if (ce > 0) {
      const keep = ALPHA; ALPHA *= ce
      bloom(() => { rrect(cx, cy - 19, cw + 50, 38, 19); fill(ACC, .12); stroke(ACC, 1.5, .75) }, .35)
      bloom(() => dot(cx + 20, cy, 5, ACC, 1), .8)
      L('ti.chip', esc(SPEC.discipline), { x: cx + 34, y: cy + 1, ay: .5, cls: 'caps', size: 16, color: ACC })
      ALPHA = keep
    }
    const kx = x + cw + 66 - 14 * (1 - ke), kt = KINDS[SPEC.kind]
    const [kw] = measure('ti.kind', esc(kt), { cls: 'caps', size: 14 })
    if (ke > 0) {
      const keep = ALPHA; ALPHA *= ke
      rrect(kx, cy - 17, kw + 30, 34, 17); stroke(K.faint, 1.5, 1)
      L('ti.kind', esc(kt), { x: kx + 15, y: cy + 1, ay: .5, cls: 'caps', size: 14, color: K.soft })
      ALPHA = keep
    }
    // title, word by word; subtitle a beat later
    const te = seg(lt, .15, 1.05)
    const tEl = L('ti.t', richW(sc.title), { x, y: 246, w: 940, size: 60, weight: 640, lh: 1.08, ls: '-0.015em', op: te > 0 ? 1 : 0, st: { p: te, spread: .55, dy: 18 } })
    const th = tEl.offsetHeight
    if (sc.subtitle) { const se = seg(lt, .55, 1.4); L('ti.s', richW(sc.subtitle), { x, y: 246 + th + 22, w: 860, size: 27, color: K.soft, lh: 1.3, op: se > 0 ? 1 : 0, st: { p: se, spread: .7, dy: 8 } }) }
    // accent rule, drawn with a light at its head
    const re = eio(seg(lt, .3, 1.2))
    if (re > 0) { bloom(() => line(x, 140, x + 80 * re, 140, ACC, 3, 1), .8); if (re < 1) pen(x + 80 * re, 140, ACC, bell(re)) }
  },

  object(sc, lt, dur) {
    if (sc.heading) { const he = seg(lt, .1, .8); L('ob.h', richW(sc.heading), { x: 96, y: 100, ay: .5, size: 23, color: K.soft, weight: 520, op: he > 0 ? 1 : 0, st: { p: he, spread: .6, dy: 6 } }) }
    const panels = sc._panels, lay = sc._layout
    panels.forEach((p, i) => {
      let box = BOX
      if (lay === 'split') { const gw = 48, w = (BOX.w - gw * (panels.length - 1)) / panels.length; box = { x: BOX.x + i * (w + gw), y: BOX.y, w, h: BOX.h } }
      if (sc.heading) box = { ...box, y: box.y + 14, h: box.h - 14 }
      // the last panel holds through the scene's exit; the others hand over
      // to the next with an overlap: out by scaling up, in from slightly small
      const end = p._last || lay !== 'sequence' ? Infinity : p._t1 + .3
      if (lt < p._t0 - 1e-9 || lt > end) return
      const pl = lt - p._t0, pd = p._t1 - p._t0
      let a = 1, s = 1
      if (lay === 'sequence') {
        const pi = eout(seg(pl, 0, .5)); a *= pi; s *= lerp(.965, 1, pi)
        if (!p._last) { const po = eio(seg(lt, p._t1 - .3, p._t1 + .3)); a *= 1 - po; s *= 1 + .045 * po }
      }
      if (a <= .002) return
      withLayer('ob.' + p._key, about(box.x + box.w / 2, box.y + box.h / 2, s), a, null, () => PRIM[p.primitive].draw(p, pl, box, p._key, pd))
    })
  },

  achievement(sc, lt) {
    if (sc.heading) L('ac.h', rich(sc.heading), { x: 96, y: 100, ay: .5, size: 23, color: K.soft, weight: 520, op: eout(seg(lt, .1, .6)) })
    if (sc.form === 'status') return achievementStatus(sc, lt)
    // before -> after, side by side; the old value steps back as the new lands
    const yB = 330, xL = 96, xR = 712
    const be = eout(seg(lt, .1, .7)), back = eio(seg(lt, 1.0, 1.7)), dim = 1 - .5 * back
    L('ac.bl', rich(sc.before.label), { x: xL, y: yB - 92, cls: 'caps', size: 15, color: K.mute, op: be })
    L('ac.bv', rich(`$${sc.before.tex}$`), { x: xL, y: yB + 8 * (1 - be), ay: .5, size: sc.before._size || 52, color: K.soft, op: be * dim, scale: 1 - .06 * back })
    if (sc.before.note) L('ac.bn', rich(sc.before.note), { x: xL, y: yB + 62, size: 21, color: K.mute, op: be * dim, w: 500 })
    // the arrow, drawn with a light at its head
    const ae = eio(seg(lt, .75, 1.35)), ax0 = 600, ax1 = 664
    if (ae > 0) {
      bloom(() => { line(ax0, yB, lerp(ax0, ax1, ae), yB, ACC, 3, 1); if (ae > .05) arrowHead(lerp(ax0, ax1, ae) + 6, yB, 0, 15, ACC, ae) }, .9)
      if (ae < 1) pen(lerp(ax0, ax1, ae) + 6, yB, ACC, bell(ae))
    }
    // the claimed value lands: drops in a touch large, settles, glows, rings
    const LAND = 1.3, fe = seg(lt, LAND, LAND + .5), fo = eout(seg(lt, LAND, LAND + .22))
    const fl = flare(seg(lt, LAND + .12, LAND + 1.3))
    L('ac.al', rich(sc.after.label), { x: xR, y: yB - 92, cls: 'caps', size: 15, color: ACC, op: eout(seg(lt, LAND + .1, LAND + .6)) })
    const av = rich(`$${sc.after.tex}$`)
    if (fo > 0) {
      const [aw] = measure('ac.av', av, { size: sc.after._size || 60 })
      const cx = xR + aw / 2
      bloom(() => glowDot(cx, yB, 90 + 60 * fl, ACC, .28 * fl + .06 * fo), 1)
      const rp = seg(lt, LAND + .14, LAND + .9)
      if (rp > 0 && rp < 1) bloom(() => { g.beginPath(); g.ellipse(cx, yB, aw / 2 + 20 + 70 * eout(rp), 42 + 34 * eout(rp), 0, 0, 2 * Math.PI); stroke(ACC, 1.6, .7 * (1 - rp)) }, .7)
    }
    L('ac.av', av, { x: xR, y: yB, ay: .5, size: sc.after._size || 60, color: K.ink, op: fo, scale: 1.16 - .16 * eback(fe), glow: .35 + .65 * fl, glowColor: ACC })
    if (sc.after.note) L('ac.an', rich(sc.after.note), { x: xR, y: yB + 66 + 8 * (1 - eout(seg(lt, 1.6, 2.1))), size: 21, color: K.soft, op: eout(seg(lt, 1.6, 2.1)), w: 480 })
    // optional stamp, and a line underneath
    if (sc.stamp) stamp(sc.stamp, 1040, 470, lt - 2.4, .8)
    if (sc.note) { const ne = seg(lt, 2.1, 2.8); L('ac.n', richW(sc.note), { x: W / 2, y: 560, ax: .5, ay: .5, w: 1060, align: 'center', size: 25, color: K.soft, op: ne > 0 ? 1 : 0, lh: 1.3, st: { p: ne, spread: .6, dy: 8 } }) }
    return null
  },

  verify(sc, lt) {
    const L0 = LEAN[sc.lean]
    need(L0, 'verify.lean must be main | part | none')
    const e = eout(seg(lt, .1, .6)), cx = W / 2, cy = 270
    const html = esc(L0.text)
    const [tw] = measure('ve.t', html, { size: 38, weight: 620 })
    const bw = tw + 130, bh = 92, bx = cx - bw / 2, by = cy - bh / 2
    // the badge: its outline traces itself, fills, then a sheen passes over it
    const tr = eio(seg(lt, 0, .8)), fe = seg(lt, .45, 1)
    rrect(bx, by, bw, bh, 22); fill(L0.color, .08 * fe)
    bloom(() => traceRect(bx, by, bw, bh, 22, tr, L0.color, 2, .9), .7)
    const sh = seg(lt, 1.0, 1.75)
    if (sh > 0 && sh < 1) {
      g.save(); rrect(bx, by, bw, bh, 22); g.clip()
      const sx = lerp(bx - 120, bx + bw + 120, eio(sh)), gr = g.createLinearGradient(sx - 70, 0, sx + 70, 0)
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${(.11 * bell(sh)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
      A(1); g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 40, by - 2); g.lineTo(sx + 100, by - 2); g.lineTo(sx + 40, by + bh + 2); g.lineTo(sx - 100, by + bh + 2); g.closePath(); g.fill()
      g.restore()
    }
    bloom(() => icon(L0.icon, bx + 50, cy, 22, L0.color, e, eio(seg(lt, .4, 1.0))), .8)
    const ie = seg(lt, .4, 1.0)
    if (ie > 0 && ie < 1 && L0.icon === 'check') { const r = 22, k = eio(ie); const pts = [[-.42, .02], [-.1, .34], [.46, -.32]].map(([u, v]) => [bx + 50 + r * u, cy + r * v]); const tip = k < .37 ? [lerp(pts[0][0], pts[1][0], k / .37), lerp(pts[0][1], pts[1][1], k / .37)] : [lerp(pts[1][0], pts[2][0], (k - .37) / .63), lerp(pts[1][1], pts[2][1], (k - .37) / .63)]; pen(tip[0], tip[1], L0.color, bell(ie), 12) }
    L('ve.t', html, { x: bx + 90 + 12 * (1 - e), y: cy, ay: .5, size: 38, weight: 620, color: K.ink, op: e })
    if (sc.detail) { const de = seg(lt, .45, 1.25); L('ve.d', richW(sc.detail), { x: cx, y: cy + 82, ax: .5, w: 1000, align: 'center', size: 25, color: K.soft, op: de > 0 ? 1 : 0, lh: 1.3, st: { p: de, spread: .6, dy: 8 } }) }
    // the standing caveat
    const pe = eout(seg(lt, .8, 1.4)), py = 488 + 8 * (1 - pe)
    const ptxt = esc(sc.review || 'Claim, not yet peer-reviewed')
    const [pw] = measure('ve.p', ptxt, { size: 22, weight: 560 })
    rrect(cx - pw / 2 - 26, py - 24, pw + 52, 48, 24); stroke(K.warn, 1.5, .8 * pe); fill(K.warn, .07 * pe)
    L('ve.p', ptxt, { x: cx, y: py, ax: .5, ay: .5, size: 22, weight: 560, color: K.warn, op: pe })
    if (sc.ourCheck) L('ve.o', rich(sc.ourCheck), { x: cx, y: 540 + 6 * (1 - eout(seg(lt, 1.0, 1.6))), ax: .5, size: 19, color: K.mute, op: eout(seg(lt, 1.0, 1.6)) })
  },

  end(sc, lt) {
    const e = eout(seg(lt, 0, .6)), cx = W / 2, le = eio(seg(lt, .05, .7))
    bloom(() => line(cx - 60 * le, 268, cx + 60 * le, 268, ACC, 3, 1), .9)
    if (le > 0 && le < 1) { pen(cx - 60 * le, 268, ACC, bell(le), 12); pen(cx + 60 * le, 268, ACC, bell(le), 12) }
    glowDot(cx, 330, 320, ACC, .07 * e)
    L('en.u', 'ai.thesatyajit.com', { x: cx, y: 330 + 10 * (1 - e), ax: .5, ay: .5, size: 54, weight: 640, ls: `${lerp(.09, -.01, eout(seg(lt, 0, .9))).toFixed(4)}em`, op: e })
    L('en.p', esc(sc.path || '/articles/openai-math'), { x: cx, y: 386 + 6 * (1 - eout(seg(lt, .2, .7))), ax: .5, ay: .5, cls: 'mono', size: 22, color: K.mute, op: eout(seg(lt, .2, .7)) })
    L('en.f', `Family ${esc(SPEC.id)} of openai/math · drawn from the release and our review`, { x: cx, y: 470, ax: .5, ay: .5, size: 19, color: K.mute, op: eout(seg(lt, .35, .85)) })
  },
}

// Fixed to the screen (no camera): the object scene's captions.
const HUDS = {
  object(sc, lt, dur) {
    const beats = sc.beats || []
    beats.forEach((b, i) => {
      const nxt = i + 1 < beats.length ? beats[i + 1].at : Infinity
      const out = isFinite(nxt) ? 1 - eio(seg(lt, nxt - .3, nxt)) : 1
      const p = seg(lt, b.at, b.at + .55)
      if (p <= 0 || out <= 0) return
      L('ob.b' + i, richW(b.text), { x: W / 2, y: 640 - 6 * (1 - out), ax: .5, ay: .5, w: 1060, align: 'center', size: 28, color: K.ink, lh: 1.25, op: out, weight: 470, st: { p, spread: .55, dy: 8 } })
    })
  },
}

function achievementStatus(sc, lt) {
  const cx = W / 2
  const le = eout(seg(lt, .05, .6))
  L('as.l', rich(sc.label || 'Conjecture'), { x: cx, y: 172 + 6 * (1 - le), ax: .5, cls: 'caps', size: 15, color: K.mute, op: le })
  const lines = sc.statement || []
  let y = 236
  lines.forEach((tx, i) => {
    // each formula assembles term by term
    const p = seg(lt, .2 + i * .3, .95 + i * .3)
    const el = L('as.s' + i, rich(`$${tx}$`), { x: cx, y, ax: .5, size: (sc._sizes && sc._sizes[i]) || (lines.length > 1 ? 44 : 52), color: K.ink, op: p > 0 ? 1 : 0, st: { sel: TERMS, p, spread: .7, dy: 12 } })
    y += el.offsetHeight + 18
  })
  if (sc.context) { const ce = seg(lt, .8, 1.4); L('as.c', richW(sc.context), { x: cx, y: y + 10, ax: .5, w: 1000, align: 'center', size: 23, color: K.soft, op: ce > 0 ? 1 : 0, lh: 1.3, st: { p: ce, spread: .6, dy: 6 } }) }
  stamp(sc.stamp || 'proved', cx, 520, lt - 1.5, 1)
  if (sc.note) { const ne = eout(seg(lt, 2.2, 2.8)); L('ac.n', rich(sc.note), { x: cx, y: 626, ax: .5, ay: .5, w: 1060, align: 'center', size: 23, color: K.mute, op: ne, lh: 1.3 }) }
}

// A rubber stamp, always labelled as a claim. It drops in large and turned,
// hits the page at STAMP_HIT (the camera dips, a shock ring spreads, dust
// flies), and settles.
function stamp(kind, cx, cy, lt, scale) {
  need(STAMPS[kind], `stamp must be one of ${Object.keys(STAMPS).join(', ')}`)
  if (lt <= 0) return
  const e = seg(lt, 0, STAMP_HIT), a = eout(seg(lt, 0, .14))
  const k = lt < STAMP_HIT ? lerp(1.75, 1, eio(e)) : 1 - .045 * bell(seg(lt, STAMP_HIT, STAMP_HIT + .3))
  const rot = lerp(-.26, -.05, eout(e))
  const word = STAMPS[kind].toUpperCase()
  const [ww] = measure('st.w', esc(word), { size: 40, weight: 760, ls: '0.14em' })
  const bw = Math.max(ww + 64, 240), bh = 104
  const hit = lt - STAMP_HIT, fl = flare(seg(hit, 0, .9))
  // shock ring and dust, under the stamp
  if (hit > 0) {
    const sr = seg(hit, 0, .55)
    if (sr < 1) {
      g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(scale, scale)
      const gx = 26 * eout(sr)
      bloom(() => { rrect(-bw / 2 - gx, -bh / 2 - gx, bw + 2 * gx, bh + 2 * gx, 12 + gx); stroke(ACC, 2, .6 * (1 - sr)) }, .8)
      g.restore()
    }
    const R = rng(parseInt(SPEC.id, 10) * 31 + 7)
    for (let i = 0; i < 26; i++) {
      const side = R(), u = R() * 2 - 1, life = .45 + R() * .5, sp = 70 + R() * 120, sz = 1 + R() * 1.8, tint = R()
      const d = hit / life; if (d >= 1) continue
      // a point on the stamp's edge and its outward direction
      const hw = bw / 2 * scale, hh = bh / 2 * scale
      let px, py, nx, ny
      if (side < .35) { px = u * hw; py = -hh; nx = u * .5; ny = -1 } else if (side < .7) { px = u * hw; py = hh; nx = u * .5; ny = 1 } else if (side < .85) { px = -hw; py = u * hh; nx = -1; ny = u * .4 } else { px = hw; py = u * hh; nx = 1; ny = u * .4 }
      const nl = Math.hypot(nx, ny), dist = sp * (1 - Math.exp(-4 * hit)) / 4
      const qx = px + nx / nl * dist, qy = py + ny / nl * dist + 18 * hit * hit
      const c = Math.cos(rot), s = Math.sin(rot)
      dot(cx + qx * c - qy * s, cy + qx * s + qy * c, sz, tint < .5 ? ACC : K.soft, .8 * (1 - d) * (1 - d))
    }
  }
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(k * scale, k * scale)
  bloom(() => { rrect(-bw / 2, -bh / 2, bw, bh, 12); stroke(ACC, 3, a); rrect(-bw / 2 + 7, -bh / 2 + 7, bw - 14, bh - 14, 8); stroke(ACC, 1.2, .6 * a) }, .55 + .6 * fl)
  rrect(-bw / 2, -bh / 2, bw, bh, 12); fill(ACC, (.08 + .1 * fl) * a)
  g.restore()
  // the DOM text rides the same rotation about the stamp's centre
  const at = dy => [cx - Math.sin(rot) * dy * k * scale, cy + Math.cos(rot) * dy * k * scale]
  const [x1, y1] = at(-24), [x2, y2] = at(12)
  L('st.c', 'CLAIMED', { x: x1, y: y1, ax: .5, ay: .5, size: 14 * scale, weight: 700, ls: '0.3em', color: ACC, op: a * .85, scale: k, rot })
  L('st.w', esc(word), { x: x2, y: y2, ax: .5, ay: .5, size: 40 * scale, weight: 760, ls: '0.14em', color: ACC, op: a, scale: k, rot, glow: .3 + .7 * fl })
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
    // the axis draws itself, a light at its head
    const ae = eio(seg(lt, 0, .8))
    line(x0, y, lerp(x0, x1, ae), y, K.soft, 2, .9)
    if (ae > 0 && ae < 1) pen(lerp(x0, x1, ae), y, K.soft, bell(ae), 12)
    if (p.arrow !== false && ae > .95) arrowHead(x1 + 12, y, 0, 11, K.soft, .9 * seg(ae, .95, 1))
    // a powers-of-ten ruler streams past while zooming: finer decades fade in
    if (z) {
      const zs = seg(lt, z.at - .1, z.at + .2) * (1 - seg(lt, z.at + (z.dur || 2), z.at + (z.dur || 2) + .6))
      if (zs > 0) {
        const w = hi - lo, top = Math.floor(Math.log10(w))
        for (let k = top - 2; k <= top; k++) {
          const s = Math.pow(10, k), px = s / w * (x1 - x0)
          const a = clamp((px - 7) / 40) * zs * (k === top ? .55 : .4); if (a <= .01) continue
          const hgt = 4 + 3 * (k - top + 2)
          const i0 = Math.ceil(lo / s), i1 = Math.floor(hi / s)
          if (i1 - i0 > 400) continue
          g.beginPath()
          for (let i = i0; i <= i1; i++) { const x = x0 + (i * s - lo) / w * (x1 - x0); g.moveTo(x, y - hgt); g.lineTo(x, y + hgt) }
          stroke(ACC, 1, a)
        }
      }
    }
    // ticks, one after another
    const tk = (list, a0, pre, t0) => (list || []).forEach((tv, i) => {
      const v = typeof tv === 'number' ? tv : tv.v, lab = typeof tv === 'number' ? String(tv) : tv.label
      const a = a0 * (t0 == null ? 1 : eout(seg(lt, t0 + i * .07, t0 + i * .07 + .4)))
      const x = X(v); if (x < x0 - 1 || x > x1 + 1 || a <= 0) return
      line(x, y - 7, x, y + 7, K.soft, 1.5, a)
      L(key + pre + i, rich(lab), { x, y: y + 16 + 4 * (1 - a), ax: .5, cls: 'mono', size: 22, color: K.mute, op: a })
    })
    tk(p.ticks, z ? 1 - seg(lt, z.at, z.at + (z.dur || 2) * .3) : 1, '.t', .3)
    if (z) tk(z.ticks, seg(lt, z.at + (z.dur || 2) * .75, z.at + (z.dur || 2)), '.zt')
    if (p.axisLabel) L(key + '.ax', rich(p.axisLabel), { x: x0, y: y + 62, size: 22, color: K.mute, op: eout(seg(lt, .4, 1.1)) })
    // label rows, computed once in the final mapping so nothing jumps
    if (!p._rows) {
      const items = []
      ;(p.ranges || []).forEach((r, i) => items.push({ id: 'r' + i, x: (XF(r.from) + XF(r.to)) / 2, html: labelHTML(r), side: r.side || 'above' }))
      ;(p.markers || []).forEach((m, i) => items.push({ id: 'm' + i, x: XF(m.v), html: labelHTML(m), side: m.side || 'above' }))
      if (p.slide) items.push({ id: 's', x: XF(p.slide.to), html: labelHTML({ tone: 'claim', ...p.slide }), side: p.slide.side || 'above' })
      if (p.slide && p.slide.gap) items.push({ id: 'g', x: (XF(p.slide.from) + XF(p.slide.to)) / 2, html: gapHTML(p.slide.gap), side: p.slide.gapSide || 'below' })
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
    const placeLabel = (id, html, side, xv, a, color, lead = true) => {
      const r = p._rows[id]; if (!r) return
      const off = 34 + r.row * 74
      const ly = side === 'above' ? y - off : y + off + 36
      const x = clamp(xv - r.w / 2 + r.shift, box.x - 10, box.x + box.w + 10 - r.w)
      if (lead) line(xv, side === 'above' ? y - 9 : y + 9, xv, side === 'above' ? ly + 2 : ly - 2, color, 1.2, .55 * a)
      L(key + '.m_' + id, html, { x: x + r.w / 2, y: ly + (side === 'above' ? 6 : -6) * (1 - a), ax: .5, ay: side === 'above' ? 1 : 0, size: 26, op: a, color: K.ink })
    }
    // focus: once the slide starts, the historical markers step back
    const sAt = p.slide ? p.slide.at : z ? z.at : Infinity
    const back = isFinite(sAt) ? 1 - .45 * eio(seg(lt, sAt, sAt + .7)) : 1
    // ranges
    ;(p.ranges || []).forEach((r, i) => {
      const at = r.at != null ? r.at : .8, e = eout(seg(lt, at, at + .6))
      if (e <= 0) return
      const a = X(r.from), b = X(r.to), c = tone(r.tone || 'old')
      rrect(Math.min(a, b), y - 6, Math.max(2, Math.abs(b - a) * e), 12, 4); fill(c, .45 * e)
      if (e < 1) glowDot(lerp(Math.min(a, b), Math.max(a, b), e), y, 14, c, .6 * bell(e))
      placeLabel('r' + i, labelHTML(r), r.side || 'above', (a + b) / 2, e, c)
    })
    // markers pop in with an overshoot and a ring
    ;(p.markers || []).forEach((m, i) => {
      const at = m.at != null ? m.at : .6 + i * .45, e = seg(lt, at, at + .45)
      if (e <= 0) return
      const x = X(m.v); if (x < x0 - 2 || x > x1 + 2) return
      const isNew = ['claim', 'accent', 'new'].includes(m.tone), c = tone(m.tone || 'old'), fa = isNew ? 1 : back
      const keep = ALPHA; ALPHA *= fa
      const pr = seg(lt, at, at + .7)
      if (pr < 1) ring(x, y, 6 + 18 * eout(pr), c, 1.5, .7 * (1 - pr))
      bloom(() => { if (m.style === 'ring') ring(x, y, 7 * eback(e), c, 2.2, 1); else dot(x, y, 6.5 * eback(e), c, 1) }, isNew ? 1 : .25)
      placeLabel('m' + i, labelHTML(m), m.side || 'above', x, eout(e), c)
      ALPHA = keep
    })
    // the slide: old value -> claimed value, leaving a glowing trail
    if (p.slide) {
      const s = p.slide, d = s.dur || 1.4, e = eio(seg(lt, s.at, s.at + d)), c = tone(s.tone || 'claim')
      if (lt >= s.at) {
        const xa = X(s.from), xb = X(s.to), xc = lerp(xa, xb, e)
        ring(xa, y, 8, K.mute, 1.5, .8)
        bloom(() => {
          const gr = g.createLinearGradient(xa, 0, xc + (xc === xa ? 1 : 0), 0); gr.addColorStop(0, rgba(c, .05)); gr.addColorStop(1, rgba(c, .95))
          g.beginPath(); g.moveTo(xa, y); g.lineTo(xc, y); A(1); g.strokeStyle = gr; g.lineWidth = BLOOM_PASS ? 10 : 5; g.lineCap = 'round'; g.stroke()
        }, .9)
        const moving = e > 0 && e < 1
        bloom(() => { dot(xc, y, 8, c, 1); if (moving) glowDot(xc, y, 26, c, .7) }, 1)
        dot(xc, y, 3.5, K.bg, 1)
        const land = lt - s.at - d
        if (land > 0) {
          for (const dl of [0, .22]) { const pe = seg(land - dl, 0, .9); if (pe > 0 && pe < 1) bloom(() => ring(xb, y, 8 + 34 * eout(pe), c, dl ? 1.2 : 2, (dl ? .5 : 1) * (1 - pe)), .6) }
          glowDot(xb, y, 40, c, .5 * flare(seg(land, 0, 1)))
          // the gap: a bracket just over the axis between the two values
          const ge = eio(seg(land, .15, .7))
          if (ge > 0 && s.gap !== false) {
            const yb = y - 17, xm = (xa + xb) / 2, hw = Math.abs(xa - xb) / 2 * ge
            bloom(() => { g.beginPath(); g.moveTo(xm - hw, yb + 6); g.lineTo(xm - hw, yb); g.lineTo(xm + hw, yb); g.lineTo(xm + hw, yb + 6); stroke(c, 1.5, .8 * ge) }, .5)
            if (s.gap) placeLabel('g', gapHTML(s.gap), s.gapSide || 'below', xm, ge, c, false)
          }
        }
        placeLabel('s', labelHTML({ tone: 'claim', ...s }), s.side || 'above', xc, eout(seg(lt, s.at + d - .2, s.at + d + .3)), c)
      }
    }
    if (z && z.counter) {
      const e = seg(lt, z.at, z.at + (z.dur || 2)), k = Math.round(Math.log10((p.max - p.min) / (hi - lo)))
      const a = eout(seg(lt, z.at, z.at + .3))
      // the counter bumps each time it ticks over a power of ten
      const kc = Math.log10((p.max - p.min) / (hi - lo)), frac = kc - Math.floor(kc + .5) + .5
      const bump = e > 0 && e < 1 ? .06 * (1 - seg(frac, 0, .25)) : .1 * flare(seg(lt, z.at + (z.dur || 2), z.at + (z.dur || 2) + .6))
      L(key + '.zc', rich(`zoom $\\times 10^{${k}}$`), { x: x1, y: box.y + 8, ax: 1, cls: 'mono', size: 24, color: e >= 1 ? ACC : K.soft, op: a, scale: 1 + bump, glow: e >= 1 ? .5 : 0 })
    }
  },
}
function labelHTML(m) {
  const c = tone(m.tone || 'old')
  let h = `<div style="color:${m.tone === 'old' || !m.tone ? K.soft : c};font-weight:560">${rich(m.label || '')}</div>`
  if (m.note) h += `<div style="font-size:18px;color:${K.mute};font-weight:450;margin-top:2px">${rich(m.note)}</div>`
  return `<div style="text-align:center">${h}</div>`
}
const gapHTML = s => `<div style="text-align:center;font-size:20px;color:${ACC};font-weight:520">${rich(s)}</div>`

// Graphs: explicit nodes/edges, or a preset (two-page drawing of K_n with its
// crossings computed and counted, the FFT butterfly, K_n on a circle).
function graphTiming(p, G) {
  const e0 = p.edgeAt != null ? p.edgeAt : .6, ed = p.edgeDur != null ? p.edgeDur : 4.2
  const n = G.edges.length
  const edgeStart = i => e0 + (n > 1 ? ed * .78 * G.edges[i].ord / (n - 1) : 0), edgeLen = ed * .22 + .25
  const edgeProg = (i, lt) => eio(seg(lt, edgeStart(i), edgeStart(i) + edgeLen))
  // when edge i has drawn fraction f (inverse of the eased progress)
  const reach = (i, f) => { let a = 0, b = 1; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (eio(m) < f) a = m; else b = m } return edgeStart(i) + edgeLen * b }
  return { e0, ed, edgeStart, edgeLen, edgeProg, reach }
}
PRIM.graph = {
  events(p) {
    const ev = []
    const G = p._g0
    if (G && G.cross && p.counter) {
      // a soft tick as each crossing appears (merged when they bunch up)
      const { reach } = graphTiming(p, G)
      const ts = G.cross.map(X => Math.max(reach(X.i, X.fi), reach(X.j, X.fj))).sort((a, b) => a - b)
      let last = -1; for (const t of ts) if (t - last > .16) { ev.push({ t, kind: 'tick' }); last = t }
    }
    if (p.preset === 'twopage' || p.counter) ev.push({ t: (p.edgeAt || .6) + (p.edgeDur || 4.2) + .3, kind: 'land' })
    return ev
  },
  draw(p, lt, box, key, pd) {
    if (!p._g) p._g = buildGraph(p, box)
    const G = p._g
    const ne = eout(seg(lt, 0, .6))
    const { e0, ed, edgeProg, reach } = graphTiming(p, G)
    // edges, each drawn with a light at its head
    const tips = []
    G.edges.forEach((E, i) => {
      const f = edgeProg(i, lt); if (f <= 0) return
      const c = tone(E.tone || 'soft'), w = E.w || 2.2, a = E.a != null ? E.a : .85
      const hot = E.tone === 'accent' || E.hl
      let tip
      if (E.arc) {
        const th = E.up ? Math.PI + Math.PI * f : Math.PI - Math.PI * f
        bloom(() => {
          g.save(); g.translate(E.cx, G.y); g.scale(1, G.k)
          g.beginPath()
          if (E.up) g.arc(0, 0, E.r, Math.PI, th, false); else g.arc(0, 0, E.r, Math.PI, th, true)
          g.restore(); stroke(c, w, a)
        }, hot ? .45 : .25)
        tip = [E.cx + E.r * Math.cos(th), G.y + G.k * E.r * Math.sin(th)]
      } else {
        let tp = null
        bloom(() => { tp = polyline([[E.ax, E.ay], [E.bx, E.by]], f, c, w, a) }, hot ? .5 : .12)
        tip = tp
      }
      if (f < 1 && tip) tips.push([tip, c])
    })
    // crossings: each flares when the later of its two arcs reaches it
    let count = 0, lastT = 0, lastHit = -Infinity
    const doneT = G.cross ? Math.max(...G.cross.map(X => Math.max(reach(X.i, X.fi), reach(X.j, X.fj))), 0) : 0
    if (G.cross) for (const X of G.cross) {
      const tx = Math.max(reach(X.i, X.fi), reach(X.j, X.fj))
      lastT = Math.max(lastT, tx)
      if (lt < tx) continue
      count++; lastHit = Math.max(lastHit, tx)
      const pe = seg(lt - tx, 0, .35), pr = seg(lt - tx, 0, .7)
      // a second, synchronised flash when the count completes
      const fin = flare(seg(lt, doneT + .25, doneT + 1.2))
      bloom(() => { ring(X.x, X.y, 6 * eback(pe), K.hot, 2.2, 1); dot(X.x, X.y, 2.4, K.hot, pe) }, .6 + .8 * fin)
      if (pr < 1) ring(X.x, X.y, 6 + 20 * eout(pr), K.hot, 1.4, .8 * (1 - pr))
      glowDot(X.x, X.y, 22, K.hot, .55 * flare(pr) + .4 * fin)
    }
    for (const [tp, c] of tips) pen(tp[0], tp[1], c, 1, 13)
    // packets along the edges (butterfly), stage by stage, looping
    if (G.flow) {
      const fs = (p.flowAt != null ? p.flowAt : e0 + ed + .2)
      if (lt > fs) {
        const per = .9, tt = (lt - fs) / per, fa = seg(lt, fs, fs + .4)
        G.edges.forEach(E => {
          for (let tr = 0; tr < 6; tr++) {
            const ph = tt - E.stage - tr * .018
            const u = ph - Math.floor(ph / G.stages) * G.stages
            if (u < 0 || u > 1) continue
            const x = lerp(E.ax, E.bx, eio(u)), y = lerp(E.ay, E.by, eio(u))
            const a = .95 * fa * Math.min(1, 6 * u, 6 * (1 - u) + .35) * (1 - tr * .16)
            if (tr === 0) bloom(() => { dot(x, y, 4.2, E.hl ? ACC : K.ink, a); glowDot(x, y, 13, E.hl ? ACC : K.cool, .5 * a) }, .6)
            else dot(x, y, 3.6 - tr * .45, E.hl ? ACC : K.soft, a * .45)
          }
        })
      }
    }
    // nodes pop in with an overshoot
    G.nodes.forEach((N, i) => {
      const st = (G.nodeStagger != null ? G.nodeStagger : .04) * i, e = seg(lt, st, st + .45)
      if (e <= 0) return
      const c = tone(N.tone || 'ink'), r = G.r * eback(e), a = eout(e) * ne
      dot(N.x, N.y, r, K.bg, a); ring(N.x, N.y, r, c, 2, a)
      if (N.fill) bloom(() => dot(N.x, N.y, Math.max(0, r - 3.5), tone(N.fill), a), .5)
      if (N.label != null) L(key + '.n' + i, rich(String(N.label)), { x: N.x + (N.lx || 0), y: N.y + (N.ly || 0), ax: N.lax != null ? N.lax : .5, ay: .5, cls: N.lx || N.ly ? '' : 'mono', size: N.lsize || (N.lx || N.ly ? 20 : G.r > 12 ? 17 : 16), color: N.lx || N.ly ? K.soft : K.ink, op: a, scale: N.lx || N.ly ? 1 : lerp(.6, 1, eout(e)) })
    })
    // annotations
    ;(G.notes || []).forEach((nt, i) => { const e = eout(seg(lt, nt.at, nt.at + .5)); if (e > 0) L(key + '.a' + i, rich(nt.text), { x: nt.x, y: nt.y + 6 * (1 - e), ax: nt.ax != null ? nt.ax : .5, ay: .5, size: nt.size || 19, color: nt.color || K.mute, op: e }) })
    if (G.hl) {
      const e = eout(seg(lt, G.hl.at, G.hl.at + .5)), tr = eio(seg(lt, G.hl.at, G.hl.at + .8))
      if (e > 0) {
        bloom(() => { rrect(G.hl.x, G.hl.y, G.hl.w, G.hl.h, 14); A(.9 * e); g.strokeStyle = ACC; g.lineWidth = 1.6 * (BLOOM_PASS ? 1.8 : 1); g.setLineDash([6, 6]); g.lineDashOffset = -lt * 14; g.stroke(); g.setLineDash([]) }, .5)
        rrect(G.hl.x, G.hl.y, G.hl.w, G.hl.h, 14); fill(ACC, .06 * tr)
        L(key + '.hl', rich(G.hl.label), { x: G.hl.x + G.hl.w / 2, y: G.hl.y - 12 + 6 * (1 - e), ax: .5, ay: 1, size: 19, color: ACC, op: e })
      }
    }
    // the counter: ticks up with each crossing, with a small bump
    if (p.counter && G.cross) {
      const ce = eout(seg(lt, e0, e0 + .5))
      const bump = .14 * (1 - seg(lt - lastHit, 0, .22))
      const done = count === G.cross.length
      L(key + '.cl', esc(p.counter.label || 'crossings'), { x: box.x, y: box.y + 4, cls: 'caps', size: 15, color: K.mute, op: ce })
      const cw = measure(key + '.cn', String(count), { cls: 'mono', size: 56, weight: 500 })[0]
      L(key + '.cn', String(count), { x: box.x, y: box.y + 28, cls: 'mono', size: 56, color: done ? ACC : K.ink, op: ce, weight: 500, scale: 1 + bump, glow: done ? .4 + .6 * flare(seg(lt - lastT, 0, .9)) : 0 })
      if (p.counter.done && done) {
        const de = eout(seg(lt - lastT, .3, .9))
        L(key + '.cd', rich(p.counter.done), { x: box.x + cw + 16 + 10 * (1 - de), y: box.y + 62, ay: .5, size: 34, color: ACC, op: de, glow: .3 * de })
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
    // columns of nodes appear stage by stage
    G.nodeStagger = .012
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
    // cells come up as a diagonal light bar sweeps across them
    for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
      const st = .2 + (r + c) * (p.stagger != null ? p.stagger : .04), e = eout(seg(lt, st, st + .4))
      if (e <= 0) continue
      const tn = tones[r + ',' + c], lb = flare(seg(lt, st, st + .7))
      rrect(gx + c * cs + 2, gy + r * cs + 2, cs - 4, cs - 4, 5)
      if (tn) bloom(() => { rrect(gx + c * cs + 2, gy + r * cs + 2, cs - 4, cs - 4, 5); fill(tone(tn), .55 * e) }, .25 + .5 * lb); else fill('#ffffff', .035 * e)
      if (lb > 0) { rrect(gx + c * cs + 2, gy + r * cs + 2, cs - 4, cs - 4, 5); fill('#ffffff', .16 * lb) }
      rrect(gx + c * cs + 2, gy + r * cs + 2, cs - 4, cs - 4, 5); stroke(K.faint, 1, e)
      const v = p.values && p.values[r] && p.values[r][c]
      if (v != null && v !== '') L(`${key}.v${r}_${c}`, rich(String(v)), { x: gx + (c + .5) * cs, y: gy + (r + .5) * cs, ax: .5, ay: .5, cls: 'mono', size: Math.min(22, cs * .42), color: tn ? K.bg : K.soft, op: e })
    }
    ;(p.blocks || []).forEach((b, i) => {
      const at = b.at != null ? b.at : 1.2 + i * .5, e = eout(seg(lt, at, at + .5)); if (e <= 0) return
      const c = tone(b.tone || 'accent'), tr = eio(seg(lt, at, at + .7))
      const bx = gx + b.c * cs - 3, by = gy + b.r * cs - 3, bw = b.w * cs + 6, bh = b.h * cs + 6
      rrect(bx, by, bw, bh, 8); fill(c, .1 * e)
      bloom(() => traceRect(bx, by, bw, bh, 8, tr, c, 2.5, 1), .6)
      if (b.label) L(`${key}.b${i}`, rich(b.label), { x: gx + (b.c + b.w / 2) * cs, y: gy + b.r * cs - 10 + 6 * (1 - e), ax: .5, ay: 1, size: 19, color: c, op: e })
    })
    if (p.caption) L(key + '.cap', rich(p.caption), { x: box.x + box.w / 2, y: gy + R * cs + 20, ax: .5, size: 20, color: K.mute, op: eout(seg(lt, .5, 1)) })
  },
}
// The schoolbook product, one multiplication at a time: the current entry's
// row of A and column of B light up, the pair being multiplied burns
// brightest, and C's entry fills as its n products accumulate.
function matmul(p, lt, box, key) {
  const n = p.n || 4, gap = 64
  const cs = Math.min((box.w - 2 * gap - 120) / (3 * n), (box.h - 120) / n, 58)
  const gw = cs * n, total = 3 * gw + 2 * gap
  const x0 = box.x + (box.w - total) / 2, y0 = box.y + (box.h - gw) / 2 + 6
  const GX = [x0, x0 + gw + gap, x0 + 2 * (gw + gap)]
  const sa = p.sweepAt != null ? p.sweepAt : .8, sw = p.sweep || 3.6
  const NP = n * n * n, P = clamp((lt - sa) / sw) * NP          // products done, continuous
  const cur = Math.min(NP - 1, Math.floor(P)), ent = Math.floor(cur / n), ci = Math.floor(ent / n), cj = ent % n, kk = cur % n
  const active = lt >= sa && P < NP, rate = NP / sw
  const doneAt = sa + sw
  const names = p.names || ['A', 'B', 'C']
  for (let m = 0; m < 3; m++) {
    const e = eout(seg(lt, m * .15, m * .15 + .5)); if (e <= 0) continue
    L(`${key}.nm${m}`, rich(`$${names[m]}$`), { x: GX[m] + gw / 2, y: y0 - 18 + 6 * (1 - e), ax: .5, ay: 1, size: 30, color: K.soft, op: e })
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      // cells come up in a quick diagonal wave
      const ce = eout(seg(lt, m * .15 + (r + c) * .03, m * .15 + (r + c) * .03 + .4)) * e
      if (ce <= 0) continue
      const x = GX[m] + c * cs + 2, y = y0 + r * cs + 2, w = cs - 4
      let a = .035, col = '#ffffff', glow = 0
      if (m < 2 && active) {
        const inLine = m === 0 ? r === ci : c === cj, pair = m === 0 ? r === ci && c === kk : r === kk && c === cj
        if (pair) { a = .72; col = ACC; glow = .5 } else if (inLine) { a = .26; col = ACC }
      }
      if (m === 2) {
        const k = r * n + c, filled = clamp((P - k * n) / n)
        a = .06 + .36 * filled; col = ACC
        if (active && r === ci && c === cj) glow = .6
        // a flash as the entry completes, and a wave over C when it is done
        const tc = sa + (k + 1) * n / rate
        const fl = flare(seg(lt, tc, tc + .5)) + .8 * flare(seg(lt, doneAt + (r + c) * .06, doneAt + (r + c) * .06 + .6))
        if (fl > 0) { rrect(x, y, w, w, 5); fill('#ffffff', .2 * fl * ce) }
      }
      rrect(x, y, w, w, 5)
      if (glow) bloom(() => { rrect(x, y, w, w, 5); fill(col, a * ce) }, glow); else fill(col, a * ce)
      const cur2 = m === 2 && active && r === ci && c === cj
      rrect(x, y, w, w, 5); stroke(cur2 ? ACC : K.faint, cur2 ? 2.4 : 1, ce)
    }
  }
  const oe = eout(seg(lt, .3, .8))
  L(`${key}.x`, rich('$\\times$'), { x: GX[0] + gw + gap / 2, y: y0 + gw / 2, ax: .5, ay: .5, size: 34, color: K.mute, op: oe })
  L(`${key}.eq`, rich('$=$'), { x: GX[1] + gw + gap / 2, y: y0 + gw / 2, ax: .5, ay: .5, size: 34, color: K.mute, op: oe })
  if (p.counter !== false) {
    const prods = Math.floor(P)
    const ce = eout(seg(lt, sa, sa + .4)), fin = flare(seg(lt, doneAt, doneAt + .9))
    L(`${key}.ct`, `${prods}<span style="color:${K.mute}"> of ${NP} products</span>`, { x: box.x + box.w / 2, y: y0 + gw + 40, ax: .5, cls: 'mono', size: 24, color: prods === NP ? ACC : K.ink, op: ce, scale: 1 + .08 * fin, glow: prods === NP ? .3 + .7 * fin : 0 })
  }
}
function tensor(p, lt, box, key) {
  const [a, b, c] = p.dims || [3, 3, 3]
  const s = p.cell || Math.min(box.h / (a + b + c) * 1.9, 84)
  const yaw = (p.yaw != null ? p.yaw : .62) + (p.spin ? lt * .05 : .03 * Math.sin(lt * .5))
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2 + 10
  const proj = (i, j, k) => { // i -> x, j -> depth, k -> up
    const x = (i - a / 2) * Math.cos(yaw) - (j - b / 2) * Math.sin(yaw)
    const d = (i - a / 2) * Math.sin(yaw) + (j - b / 2) * Math.cos(yaw)
    return [cx + x * s, cy - (k - c / 2) * s + d * s * .45, d]
  }
  const e = eout(seg(lt, 0, .8))
  // wire box, its edges drawing in
  const C8 = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, c], [a, 0, c], [a, b, c], [0, b, c]].map(v => proj(...v))
  ;[[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([u, v], i) => polyline([C8[u].slice(0, 2), C8[v].slice(0, 2)], eio(seg(lt, i * .04, i * .04 + .6)), K.faint, 1.4, 1))
  const cells = (p.cells || []).map((q, i) => ({ q, i, d: proj(q[0] + .5, q[1] + .5, q[2] + .5)[2] }))
  cells.sort((u, v) => v.d - u.d)
  for (const { q, i } of cells) {
    const at = (p.cellAt != null ? p.cellAt : .8) + i * (p.cellStagger != null ? p.cellStagger : .18), ce = eout(seg(lt, at, at + .4)); if (ce <= 0) continue
    const [x, y] = proj(q[0] + .5, q[1] + .5, q[2] + .5), r = s * .36 * eback(seg(lt, at, at + .4)), fl = flare(seg(lt, at, at + .8))
    const hex = () => { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .9, y - r * .45); g.lineTo(x + r * .9, y + r * .55); g.lineTo(x, y + r); g.lineTo(x - r * .9, y + r * .55); g.lineTo(x - r * .9, y - r * .45); g.closePath() }
    bloom(() => { hex(); fill(tone(q[3] || 'accent'), .8 * ce) }, .2 + .7 * fl)
    hex(); stroke(K.bg, 1, ce)
  }
  ;(p.axes || []).forEach((lab, i) => {
    const P = [proj(a + .6, 0, 0), proj(0, b + .9, 0), proj(0, 0, c + .5)][i]
    L(`${key}.ax${i}`, rich(lab), { x: P[0], y: P[1], ax: .5, ay: .5, size: 20, color: K.mute, op: e })
  })
}

// Function plots: curves traced left to right by a glowing pen, regions that
// bloom open behind them, asymptotes, points.
function fnOf(src) { return new Function('x', `with (Math) { return (${src}) }`) }
PRIM.plot = {
  draw(p, lt, box, key) {
    const [xa, xb] = p.x, [ya, yb] = p.y
    const L0 = box.x + 70, R0 = box.x + box.w - (p.labelRoom != null ? p.labelRoom : 150), T0 = box.y + 20, B0 = box.y + box.h - 50
    const X = v => L0 + (v - xa) / (xb - xa) * (R0 - L0), Y = v => B0 - (v - ya) / (yb - ya) * (B0 - T0)
    const ae = eio(seg(lt, 0, .7))
    line(L0, B0, lerp(L0, R0, ae), B0, K.soft, 1.6, .9); line(L0, B0, L0, lerp(B0, T0, ae), K.soft, 1.6, .9)
    if (ae > 0 && ae < 1) { pen(lerp(L0, R0, ae), B0, K.soft, bell(ae), 10); pen(L0, lerp(B0, T0, ae), K.soft, bell(ae), 10) }
    ;(p.xticks || []).forEach((tv, i) => { const v = tv.v != null ? tv.v : tv, ta = eout(seg(lt, .3 + i * .05, .7 + i * .05)); line(X(v), B0, X(v), B0 + 6, K.soft, 1.2, ta); L(`${key}.xt${i}`, rich(tv.label || String(v)), { x: X(v), y: B0 + 12, ax: .5, cls: 'mono', size: 17, color: K.mute, op: ta }) })
    ;(p.yticks || []).forEach((tv, i) => { const v = tv.v != null ? tv.v : tv, ta = eout(seg(lt, .3 + i * .05, .7 + i * .05)); line(L0 - 6, Y(v), L0, Y(v), K.soft, 1.2, ta); L(`${key}.yt${i}`, rich(tv.label || String(v)), { x: L0 - 12, y: Y(v), ax: 1, ay: .5, cls: 'mono', size: 17, color: K.mute, op: ta }) })
    if (p.xlabel) L(key + '.xl', rich(p.xlabel), { x: R0, y: B0 + 36, ax: 1, size: 20, color: K.mute, op: ae })
    if (p.ylabel) L(key + '.yl', rich(p.ylabel), { x: L0 + 10, y: T0 - 4, size: 20, color: K.mute, op: ae })
    const sample = (f, a, b, N = 240) => { const pts = []; for (let i = 0; i <= N; i++) { const x = lerp(a, b, i / N), y = f(x); if (isFinite(y)) pts.push([X(x), clamp(Y(y), T0 - 40, B0 + 40)]) } return pts }
    const clipPlot = () => { g.beginPath(); g.rect(L0 + 1, T0 - 30, R0 - L0, B0 - T0 + 29); g.clip() }
    g.save(); clipPlot(); GG.save(); { const kg = g; g = GG; clipPlot(); g = kg }
    ;(p.regions || []).forEach((r, i) => {
      const at = r.at != null ? r.at : 2, e = eout(seg(lt, at, at + .8)); if (e <= 0) return
      const f1 = fnOf(r.f), f2 = r.f2 ? fnOf(r.f2) : () => ya
      // the fill opens left to right, brightest as it arrives
      const a = r.from != null ? r.from : xa, b0 = r.to != null ? r.to : xb, b = lerp(a, b0, eio(seg(lt, at, at + .9))), N = 160
      const shape = () => {
        g.beginPath()
        for (let k = 0; k <= N; k++) { const x = lerp(a, b, k / N); const y = f1(x); k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)) }
        for (let k = N; k >= 0; k--) { const x = lerp(a, b, k / N); g.lineTo(X(x), Y(f2(x))) }
        g.closePath()
      }
      const fl = flare(seg(lt, at, at + 1.4))
      bloom(() => { shape(); fill(tone(r.tone || 'accent'), (.18 + .14 * fl) * e) }, .35 * fl)
    })
    ;(p.asymptotes || []).forEach((s, i) => { const e = eio(seg(lt, s.at || 1, (s.at || 1) + .6)); if (s.x != null) line(X(s.x), B0, X(s.x), lerp(B0, T0, e), K.mute, 1.4, e, [6, 6]); else line(L0, Y(s.y), lerp(L0, R0, e), Y(s.y), K.mute, 1.4, e, [6, 6]) })
    const ends = [], tips = []
    ;(p.curves || []).forEach((c, i) => {
      const at = c.at != null ? c.at : .6 + i * .9, f = eio(seg(lt, at, at + (c.dur || 1.6))); if (f <= 0) return
      const pts = sample(fnOf(c.f), c.from != null ? c.from : xa, c.to != null ? c.to : xb)
      const col = tone(c.tone || (i ? 'soft' : 'accent')), hot = col === ACC
      let tip = null
      bloom(() => { tip = polyline(pts, f, col, c.w || 3, 1, c.dash ? [8, 7] : null) }, hot ? .7 : .15)
      if (f < 1 && tip) tips.push([tip, col])
      if (c.label && f > .95) ends.push({ i, c, p: pts[pts.length - 1], e: seg(f, .95, 1) })
    })
    GG.restore(); g.restore()
    for (const [tp, col] of tips) pen(tp[0], tp[1], col, 1, 16)
    ends.forEach(({ i, c, p: q, e }) => L(`${key}.cl${i}`, rich(c.label), { x: q[0] + 12 + 8 * (1 - e), y: q[1] + (c.labelDy || 0), ax: 0, ay: .5, size: 21, color: tone(c.tone || (i ? 'soft' : 'accent')), op: e }))
    ;(p.points || []).forEach((q, i) => {
      const at = q.at != null ? q.at : 2.5, e = seg(lt, at, at + .4); if (e <= 0) return
      const x = X(q.x), y = Y(q.y), c = tone(q.tone || 'accent'), pr = seg(lt, at, at + .7)
      bloom(() => dot(x, y, 6 * eback(e), c), .7)
      if (pr < 1) ring(x, y, 6 + 18 * eout(pr), c, 1.5, .7 * (1 - pr))
      if (q.label) L(`${key}.pt${i}`, rich(q.label), { x: x + 12, y: y - 12 + 6 * (1 - eout(e)), ay: 1, size: 19, color: K.soft, op: eout(e) })
    })
  },
}

// Shapes: polygons, regular polygons, circles and ellipses, with morphs. The
// outline is drawn by a pen; a morph leaves a ghost of where it started.
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
    const M2 = q => [cx + q[0] * S, cy - q[1] * S]
    if (p.axes) { const e = eio(seg(lt, 0, .6)); line(cx - S * 1.25 * e, cy, cx + S * 1.25 * e, cy, K.faint, 1.2, 1); line(cx, cy - S * 1.15 * e, cx, cy + S * 1.15 * e, K.faint, 1.2, 1) }
    ;(p.shapes || []).forEach((s, i) => {
      const at = s.at != null ? s.at : .3 + i * .8, e = eio(seg(lt, at, at + (s.dur || 1.2))); if (e <= 0) return
      if (!s._base) s._base = resample(shapePts(s), 192)
      let pts = s._base, me = 0
      const c = tone(s.tone || (i ? 'soft' : 'accent')), hot = c === ACC
      if (s.morph) {
        me = eio(seg(lt, s.morph.at, s.morph.at + (s.morph.dur || 1.6)))
        if (me > 0) {
          if (!s._to) s._to = resample(shapePts(s.morph), 192)
          pts = pts.map((v, k) => [lerp(v[0], s._to[k][0], me), lerp(v[1], s._to[k][1], me)])
          // a ghost of the starting shape stays behind for comparison
          const B = s._base.map(M2); polyline([...B, B[0]], 1, c, 1.4, .3 * seg(me, 0, .3), [4, 6])
        }
      }
      const P = pts.map(M2)
      const fl = s.morph ? flare(seg(lt, s.morph.at + (s.morph.dur || 1.6) * .8, s.morph.at + (s.morph.dur || 1.6) + .9)) : 0
      if (s.fill !== false && e > .6) { g.beginPath(); P.forEach((v, k) => (k ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); fill(c, ((s.fillA != null ? s.fillA : .14) + .1 * fl) * seg(e, .6, 1)) }
      let tip = null
      bloom(() => { tip = polyline([...P, P[0]], e, c, s.w || 2.6, 1, s.dash ? [8, 7] : null) }, (hot ? .55 : .15) + .5 * fl)
      if (e < 1 && tip) pen(tip[0], tip[1], c, 1, 15)
      if (s.label) { const q = M2(s.labelAt || [0, 0]); L(`${key}.s${i}`, rich(s.label), { x: q[0], y: q[1], ax: .5, ay: .5, size: 21, color: c, op: seg(e, .7, 1) }) }
    })
    ;(p.points || []).forEach((q, i) => { const at = q.at != null ? q.at : 1.5, e = seg(lt, at, at + .4); if (e <= 0) return; const v = M2(q.p), c = tone(q.tone || 'ink'), pr = seg(lt, at, at + .7); bloom(() => dot(v[0], v[1], 5 * eback(e), c), .5); if (pr < 1) ring(v[0], v[1], 5 + 16 * eout(pr), c, 1.4, .6 * (1 - pr)); if (q.label) L(`${key}.p${i}`, rich(q.label), { x: v[0] + 10, y: v[1] - 8, ay: 1, size: 19, color: K.soft, op: eout(e) }) })
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
      const q = p._off.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H); q.save()
      const terms = r.set.split('&')
      for (const tm of terms) if (!tm.startsWith('!')) { const k = tm.charCodeAt(0) - 65; q.beginPath(); q.arc(C[k][0], C[k][1], R, 0, 2 * Math.PI); q.clip() }
      q.fillStyle = tone(r.tone || 'accent'); q.fillRect(0, 0, W, H); q.restore()
      q.globalCompositeOperation = 'destination-out'
      for (const tm of terms) if (tm.startsWith('!')) { const k = tm.charCodeAt(1) - 65; q.beginPath(); q.arc(C[k][0], C[k][1], R, 0, 2 * Math.PI); q.fill() }
      q.globalCompositeOperation = 'source-over'
      const fl = flare(seg(lt, at, at + 1.2))
      bloom(() => { A((.32 + .2 * fl) * e); g.drawImage(p._off, 0, 0) }, .4 * fl)
      if (r.label) L(`${key}.r${i}`, rich(r.label), { x: r.x != null ? box.x + r.x * box.w : cx, y: (r.y != null ? box.y + r.y * box.h : cy) + 6 * (1 - e), ax: .5, ay: .5, size: 20, color: K.ink, op: e })
    })
    p.sets.forEach((s, i) => {
      const at = s.at != null ? s.at : .2 + i * .4, e = eio(seg(lt, at, at + .9)); if (e <= 0) return
      const c = tone(s.tone || ['accent', 'cool', 'warn'][i]), a1 = -Math.PI / 2 + 2 * Math.PI * e
      bloom(() => { g.beginPath(); g.arc(C[i][0], C[i][1], R, -Math.PI / 2, a1); stroke(c, 2.6, 1) }, .45)
      if (e < 1) pen(C[i][0] + R * Math.cos(a1), C[i][1] + R * Math.sin(a1), c, 1, 15)
      // labels sit outside their circle, anchored away from it, never on the outline
      const [lx, ly, lax, lay] = i === 0 ? [C[0][0] - R * .74, C[0][1] - R * .8, 1, 1] : i === 1 ? [C[1][0] + R * .74, C[1][1] - R * .8, 0, 1] : [C[2][0] + R * .78, C[2][1] + R * .8, 0, 0]
      L(`${key}.l${i}`, rich(s.label), { x: lx, y: ly, ax: lax, ay: lay, size: 23, color: c, op: seg(e, .5, 1), weight: 560 })
    })
    ;(p.members || []).forEach((m, i) => { const at = m.at != null ? m.at : 2.5 + i * .25, e = seg(lt, at, at + .35); if (e <= 0) return; const x = box.x + m.x * box.w, y = box.y + m.y * box.h, c = tone(m.tone || 'ink'), pr = seg(lt, at, at + .6); bloom(() => dot(x, y, 4.5 * eback(e), c), .4); if (pr < 1) ring(x, y, 4 + 14 * eout(pr), c, 1.3, .6 * (1 - pr)); if (m.label) L(`${key}.m${i}`, rich(m.label), { x: x + 9, y, ay: .5, size: 18, color: K.soft, op: eout(e) }) })
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
      const mAt = mt ? (mt.at != null ? mt.at : st + .5) : 0
      const me = mt ? eout(seg(lt, mAt, mAt + .4)) : 0
      // each box pops in about its centre
      const k = lerp(.7, 1, eback(seg(lt, st, st + .4))), bx = x + bw / 2 - bw * k / 2, by = y + bh / 2 - bh * k / 2
      const mc = mt ? tone(mt.tone) : null
      rrect(bx, by, bw * k, bh * k, 8)
      if (mt && me > 0) bloom(() => { rrect(bx, by, bw * k, bh * k, 8); fill(mc, .16 * me + .04) }, .4 * me); else fill('#ffffff', .04 * e)
      rrect(bx, by, bw * k, bh * k, 8); stroke(mt && me > 0 ? mc : K.faint, mt && me > 0 ? 2 : 1, e)
      if (mt) { const pr = seg(lt, mAt, mAt + .7); if (pr > 0 && pr < 1) { const gx = 14 * eout(pr); bloom(() => { rrect(bx - gx, by - gx, bw * k + 2 * gx, bh * k + 2 * gx, 8 + gx); stroke(mc, 1.6, .8 * (1 - pr)) }, .6) } }
      L(`${key}.i${i}`, rich(String(it)), { x: x + bw / 2, y: y + bh / 2, ax: .5, ay: .5, cls: 'mono', size: Math.min(28, bh * .42), color: mt && me > .5 ? mc : K.ink, op: e, scale: k, glow: mt ? .4 * me : 0 })
      if (p.index) L(`${key}.x${i}`, rich(p.index.replace('#', i + (p.index0 || 0))), { x: x + bw / 2, y: y + bh + 6, ax: .5, cls: 'mono', size: 15, color: K.mute, op: e })
    })
    if (p.ellipsis) { const e = eout(seg(lt, (p.at || .3) + n * (p.stagger || .12), (p.at || .3) + n * (p.stagger || .12) + .4)); L(key + '.el', rich('$\\cdots$'), { x: x0 + tw + 22, y: y0 + (rows - 1) * (bh + 24) + bh / 2, ay: .5, size: 30, color: K.mute, op: e }) }
    if (p.caption) L(key + '.cap', rich(p.caption), { x: box.x + box.w / 2, y: y0 + rows * (bh + 24) + 24, ax: .5, size: 21, color: K.mute, op: eout(seg(lt, .6, 1.1)) })
  },
}

// Equations: KaTeX lines that stack, or replace one another. Each line
// assembles term by term.
PRIM.equation = {
  draw(p, lt, box, key, pd) {
    const lines = p.lines, cx = box.x + box.w / 2
    if (p.mode === 'replace') {
      lines.forEach((ln, i) => {
        const at = ln.at != null ? ln.at : .3 + i * (pd - .6) / lines.length, nx = i + 1 < lines.length ? (lines[i + 1].at != null ? lines[i + 1].at : .3 + (i + 1) * (pd - .6) / lines.length) : 1e9
        const pin = seg(lt, at, at + .7), out = eio(seg(lt, nx - .35, nx))
        if (pin <= 0 || out >= 1) return
        const col = tone(ln.tone || 'ink')
        L(`${key}.l${i}`, texHTML(ln.tex, true), { x: cx, y: box.y + box.h / 2 - 16 * out, ax: .5, ay: .5, size: ln._size || ln.size || 46, color: col, op: 1 - out, st: { sel: TERMS, p: pin, spread: .65, dy: 12 }, glow: col === ACC ? .3 : 0 })
        if (ln.note) L(`${key}.n${i}`, rich(ln.note), { x: cx, y: box.y + box.h / 2 + 84, ax: .5, size: 22, color: K.mute, op: eout(seg(lt, at + .4, at + .9)) * (1 - out) })
      })
      return
    }
    const n = lines.length, gapY = Math.min(110, box.h / (n + .5))
    let y = box.y + box.h / 2 - gapY * (n - 1) / 2
    lines.forEach((ln, i) => {
      const at = ln.at != null ? ln.at : .3 + i * .9, pin = seg(lt, at, at + .7)
      if (pin > 0) {
        const col = tone(ln.tone || 'ink')
        L(`${key}.l${i}`, texHTML(ln.tex, true), { x: cx, y, ax: .5, ay: .5, size: ln._size || ln.size || 40, color: col, op: 1, st: { sel: TERMS, p: pin, spread: .65, dy: 12 }, glow: col === ACC ? .3 : 0 })
        if (ln.note) { const w = pool.get(`${key}.l${i}`).offsetWidth, ne = eout(seg(lt, at + .4, at + .9)); L(`${key}.n${i}`, rich(ln.note), { x: cx + w / 2 + 28 + 10 * (1 - ne), y, ay: .5, size: 20, color: K.mute, op: ne }) }
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
      // keep every box inside the frame: measure, then pull edge nodes in
      const lo = Math.max(24, box.x - 56), hi = Math.min(W - 24, box.x + box.w + 56)
      for (const N of Object.values(byId)) {
        N.x = X(N.ix); N.y = Y(N.d)
        const [w] = measure(`${key}.n_${N.id}`, rich(N.label), { size: N.d === 0 ? 22 : 19 })
        const half = (w + 30) / 2
        N.x = clamp(N.x, lo + half, hi - half)
      }
      p._lay = { nodes: Object.values(byId), depth }
    }
    const { nodes, depth } = p._lay
    const at = p.at || .3, T = N => at + (depth - N.d) * .7
    // branches grow from each node up to its parent, a light at the tip
    for (const N of nodes) for (const k of N.kids) {
      const e = eio(seg(lt, T(k) + .3, T(k) + .9)); if (e <= 0) continue
      const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, yy = lerp(k.y, N.y, u); pts.push([lerp(k.x, N.x, eio(u)), yy]) }
      const lean = k.status === 'lean', c = lean ? ACC : K.faint
      let tip = null
      bloom(() => { tip = polyline(pts, e, c, 2, .9, k.status === 'paper' ? [6, 6] : null) }, lean ? .6 : 0)
      if (e < 1 && tip) pen(tip[0], tip[1], lean ? ACC : K.soft, 1, 12)
    }
    for (const N of nodes) {
      const e0 = seg(lt, T(N), T(N) + .45), e = eout(e0); if (e <= 0) continue
      const st = N.status || 'paper', c = st === 'lean' ? ACC : st === 'prior' ? K.mute : K.soft
      const html = rich(N.label)
      const [w, h] = measure(`${key}.n_${N.id}`, html, { size: N.d === 0 ? 22 : 19 })
      const k = lerp(.8, 1, eback(e0)), bw = (w + 30) * k, bh = (h + 16) * k
      rrect(N.x - bw / 2, N.y - bh / 2, bw, bh, 10); fill(K.bg, e)
      bloom(() => { rrect(N.x - bw / 2, N.y - bh / 2, bw, bh, 10); fill(c, (st === 'lean' ? .14 : .05) * e); stroke(c, N.d === 0 ? 2.4 : 1.6, e, st === 'paper' ? [5, 5] : null) }, st === 'lean' ? .5 : 0)
      L(`${key}.n_${N.id}`, html, { x: N.x, y: N.y, ax: .5, ay: .5, size: N.d === 0 ? 22 : 19, color: st === 'prior' ? K.mute : K.ink, op: e, scale: k })
      if (N.d === 0) { const ge = seg(lt, T(N) + .2, T(N) + 1.2); if (ge > 0 && ge < 1) { bloom(() => { rrect(N.x - bw / 2 - 10 * ge, N.y - bh / 2 - 10 * ge, bw + 20 * ge, bh + 20 * ge, 14); stroke(ACC, 1.5, .7 * (1 - ge)) }, .7) } }
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
window.REEL = { load, frame, get plan() { return PLAN }, DISCIPLINES, PATTERNS, KINDS, LEAN, DUR, LIMITS }
