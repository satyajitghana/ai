// type.js — text on the painting: fonts by role, measuring, wrapping, fitting.
//
// A style names a family for each role (head, body, mono) with a weight, a
// size factor and whether the family is capitals only; scenes ask for a role
// and a size, never for a family, so the same scene reads as chalk on one film
// and neon on the next.
const FAM = {
  marker: '"Permanent Marker"', hanken: 'Hanken', plex: 'Plex', caveat: 'Caveat', sketch: '"Cabin Sketch"',
  patrick: '"Patrick Hand"', silk: 'Silkscreen', vt: 'VT323', righteous: 'Righteous',
  gaegu: 'Gaegu', amatic: '"Amatic SC"', nanum: '"Nanum Pen Script"', gochi: '"Gochi Hand"', kalam: 'Kalam', rocksalt: '"Rock Salt"',
  kaushan: '"Kaushan Script"', fell: '"IM Fell English"', dancing: '"Dancing Script"', elite: '"Special Elite"', sedgwick: '"Sedgwick Ave Display"',
}
let STYLE = null   // the current style, set by the film
function fnt(fam, w, px) { return `${w ? w + ' ' : ''}${Math.round(px)}px ${fam}` }
function roleOf(r) { return STYLE.font[r] || STYLE.font.body }
// a style may set a floor (the pixel style: nothing under ~9 of its own pixels)
function F(r, px) { const R = roleOf(r); return fnt(R.fam, R.w, Math.max(px * (R.k || 1), STYLE.minPx || 0)) }
function caps(r, s) { return roleOf(r).caps ? String(s).toUpperCase() : String(s) }
function measure(txt, f, ls = 0) { G.save(); G.font = f; G.letterSpacing = ls + 'px'; const w = G.measureText(txt).width; G.restore(); return w }
function wrap(str, f, maxW, ls = 0) {
  const ws = String(str).split(/\s+/).filter(Boolean), sp = measure(' ', f, ls), lines = []
  let cur = [], cw = 0
  for (const w of ws) {
    const ww = measure(w, f, ls)
    if (cur.length && cw + sp + ww > maxW) { lines.push(cur); cur = []; cw = 0 }
    cur.push({ text: w, w: ww }); cw += (cur.length > 1 ? sp : 0) + ww
  }
  if (cur.length) lines.push(cur)
  return lines.map(l => { let x = 0; for (const w of l) { w.x = x; x += w.w + sp } return { text: l.map(w => w.text).join(' '), width: x - sp, words: l } })
}
// the largest size at which `str` fits maxW in maxLines, in a role's font
function fitR(r, str, maxPx, minPx, maxW, maxLines, lsK = 0) {
  str = caps(r, str)
  const k = roleOf(r).k || 1
  for (let px = maxPx; px >= minPx; px -= 2) {
    const f = F(r, px), ls = lsK * px, lines = wrap(str, f, maxW, ls)
    if (lines.length <= maxLines && lines.every(l => l.width <= maxW)) return { px: Math.max(px * k, STYLE.minPx || 0), f, ls, lines, str }
  }
  const f = F(r, minPx); return { px: Math.max(minPx * k, STYLE.minPx || 0), f, ls: lsK * minPx, lines: wrap(str, f, maxW, lsK * minPx), str }
}
function text(str, x, y, f, col, o = {}) {
  G.save(); G.font = f; G.letterSpacing = (o.ls || 0) + 'px'; G.textAlign = o.align || 'left'; G.textBaseline = o.base || 'alphabetic'
  if (o.alpha != null) G.globalAlpha *= clamp(o.alpha)
  if (o.shadow) { G.fillStyle = o.shadow; G.fillText(str, x + (o.sx ?? 5), y + (o.sy ?? 6)) }
  G.fillStyle = col; G.fillText(str, x, y); G.restore()
}
// every scene writes through the style, which may glow, chalk or misregister it
function write(str, x, y, f, col, o = {}) { (STYLE.write || text)(str, x, y, f, col, o) }
// lines revealed left to right, like a pass of the pen
function wipeLines(lt, b, x, y, lh, t0, gap, col, o = {}) {
  b.lines.forEach((line, i) => {
    const k = easeOut(seg(lt, t0 + i * gap, t0 + i * gap + (o.dur || .3))); if (k <= 0) return
    const lx = o.align === 'center' ? x - line.width / 2 : o.align === 'right' ? x - line.width : x
    G.save(); G.beginPath(); G.rect(lx - 40, y + i * lh - b.px * 1.2, (line.width + 80) * k, b.px * 1.7); G.clip()
    write(line.text, lx, y + i * lh, b.f, col, { ls: b.ls, alpha: o.alpha }); G.restore()
  })
}
// where a phrase sits inside a wrapped block: one box per line it spans
function phraseBoxes(b, phrase, x, y, lh) {
  if (!phrase) return []
  const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, '')
  const target = String(phrase).split(/\s+/).map(norm).filter(Boolean), flat = []
  b.lines.forEach((l, li) => l.words.forEach(w => flat.push({ ...w, li })))
  for (let i = 0; i + target.length <= flat.length; i++) {
    let ok = true
    for (let j = 0; j < target.length; j++) if (norm(flat[i + j].text) !== target[j]) { ok = false; break }
    if (!ok) continue
    const bx = {}
    for (let j = 0; j < target.length; j++) { const w = flat[i + j], q = bx[w.li] || (bx[w.li] = { x0: 1e9, x1: -1e9, li: w.li }); q.x0 = Math.min(q.x0, w.x); q.x1 = Math.max(q.x1, w.x + w.w) }
    return Object.values(bx).map(q => ({ x: x + q.x0, y: y + q.li * lh - b.px * .8, w: q.x1 - q.x0, h: b.px }))
  }
  return []
}

// ---------- narration grammar ----------
const words = s => String(s || '').split(/\s+/).filter(Boolean).length
const sent = s => { s = String(s || '').trim().replace(/[\s.]+$/, ''); if (!s) return ''; s = s[0].toUpperCase() + s.slice(1); return /[!?]$/.test(s) ? s : s + '.' }
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
