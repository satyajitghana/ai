// sumi in the p5 tier. Loaded after the engine, for every film in the p5
// tier, so it touches STYLES.sumi and nothing else.
//
// Washes: the other tiers multiply a grey wash onto the rice paper; here
// p5.brush mixes it in as pigment, and a pale grey mixed into a pale paper
// all but vanishes (a node's wash measured within 2 levels of bare paper).
// Each wash is painted darker than the colour multiply would have landed it
// at, after the usual lift that keeps labels readable, so it reads as a
// wash again.
//
// Strokes: brush.polygon strokes every edge of a closed shape as its own
// stroke, each tapering in and out under the sumi brush's pressure, so a
// rounded box or an ellipse (dozens of short edges) came out as a string of
// beads. A box drawn with a brush is four strokes, one per side, each
// pressing in and lifting off at the corners; so a closed outline with many
// vertices is split by the side of its bounding box each point is nearest
// and every run is painted as one open stroke, overlapping its neighbours
// at the corners. Shapes with few vertices keep one stroke per edge, which
// is already one stroke per side.
{
  const S = STYLES.sumi, line = S.line
  const hex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
  const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
  const lum = c => { const [r, g, b] = rgb(c); return (.299 * r + .587 * g + .114 * b) / 255 }
  const mul = (c, p) => { const a = rgb(c), b = rgb(p); return toHex(a.map((v, i) => v * b[i] / 255)) }
  // multiply's colour, pushed twice as far from the paper: a wash at that
  // colour still landed at about half multiply's tint (measured on a node)
  const GAIN = 2
  const landed = c => { if (!hex(c)) return c; const m = rgb(mul(c, S.paper)), p = rgb(S.paper); return toHex(m.map((v, i) => p[i] + (v - p[i]) * GAIN)) }

  // a closed loop as runs of points, one per side of its bounding box
  function sides(P) {
    const b = bbox(P), side = ([x, y]) => { const d = [y - b.y0, b.x1 - x, b.y1 - y, x - b.x0]; return d.indexOf(Math.min(...d)) }
    const s = P.map(side), n = P.length
    let start = 0; while (start < n && s[start] === s[(start + n - 1) % n]) start++
    if (start === n) return null
    const runs = []
    for (let i = 0; i < n; i++) {
      const j = (start + i) % n
      if (!runs.length || s[j] !== runs[runs.length - 1].s) runs.push({ s: s[j], idx: [j] }); else runs[runs.length - 1].idx.push(j)
    }
    // each run reaches one point into its neighbours, so strokes meet at the corners
    return runs.map(r => [(r.idx[0] + n - 1) % n, ...r.idx, (r.idx[r.idx.length - 1] + 1) % n].map(i => P[i]))
  }

  S.line = function (pts, sw, col, o = {}) {
    if (!PB.ok || !o.closed || pts.length < 3) return line.call(this, pts, sw, col, o)
    const curv = o.curv ?? .4, P = curv > 0 ? throughClosed(pts, 5) : pts
    const runs = P.length > 6 ? sides(P) : null
    if (!runs || runs.length < 2) return line.call(this, pts, sw, col, o)
    const pen = { ink: col || this.ink, brush: this.pen.brush, weight: sw * this.pen.weight }
    for (const R of runs) PB.line(R, pen, false)
  }

  // media()'s shape: the lift is done here and the wash landed after it
  // (keepFill, so it is not lifted again for having been darkened), and the
  // outline goes through the line above
  const shape = S.shape
  S.shape = function (pts, o = {}) {
    if (!PB.ok || PB.tiny(pts)) return shape.call(this, pts, o)
    let fill = o.fill
    if (fill && hex(fill)) {
      const seen = c => Math.min(lum(mul(c, this.paper)), PB.landed(this.fill, lum(c)) * lum(this.paper))
      let k = this.tint || 0; while (seen(mixCol(fill, '#FFFFFF', k)) < .68 && k < .85) k += .05
      fill = landed(mixCol(fill, '#FFFFFF', k))
    }
    if (fill) { this.keepFill = true; try { shape.call(this, pts, { ...o, fill, ink: null }) } finally { this.keepFill = false } }
    const ink = o.ink === null ? null : (o.ink || this.ink)
    if (ink) this.line(pts, o.sw ?? 1, ink, { closed: true, curv: o.curv || 0 })
  }
  const hl = S.hl
  // a highlight sits under words: multiply's colour, no more
  S.hl = function (x, y, w, h, col, k) { return hl.call(this, x, y, w, h, hex(col) ? mul(col, S.paper) : col, k) }
}
