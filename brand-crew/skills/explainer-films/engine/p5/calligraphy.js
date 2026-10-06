// calligraphy in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.calligraphy and nothing else.
//
// The nib needs nothing: its pressure is nearly flat, so strokes match the
// other tiers. The watercolour tints under the lettering do: the other tiers
// multiply them onto the laid paper, and p5.brush mixes them in as pigment,
// where a pale rose or cream mixed into a cream paper landed within a few
// levels of bare paper. Each tint is painted darker than the colour multiply
// would have landed it at (as watercolour.js does, further); how it pools
// and bleeds is p5.brush's own. The lift media() applies first still keeps
// labels readable.
{
  const S = STYLES.calligraphy, shape = S.shape, hl = S.hl
  const hex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
  const mul = (c, p) => { const a = parseInt(c.slice(1), 16), b = parseInt(p.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round((a >> s & 255) * (b >> s & 255) / 255).toString(16).padStart(2, '0')).join('') }
  const lum = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 }
  // multiply's colour, pushed half again as far from the paper: at multiply's
  // own colour a tint landed at a third to a half of its tint in the other
  // tiers (the db's cream, over five drawings); twice as far overshot them
  const GAIN = 1.5
  const landed = c => {
    if (!hex(c)) return c
    const m = mul(c, S.paper), a = parseInt(m.slice(1), 16), b = parseInt(S.paper.slice(1), 16)
    return '#' + [16, 8, 0].map(s => { const p = b >> s & 255; return Math.round(Math.max(0, Math.min(255, p + ((a >> s & 255) - p) * GAIN))).toString(16).padStart(2, '0') }).join('')
  }
  // media()'s shape with keepFill set, so the lift is done here first and
  // the tint is landed after it, not lifted again for having been darkened
  S.shape = function (pts, o = {}) {
    let fill = o.fill
    if (!fill || !hex(fill) || !PB.ok || PB.tiny(pts)) return shape.call(this, pts, o)
    const seen = c => Math.min(lum(mul(c, this.paper)), PB.landed(this.fill, lum(c)) * lum(this.paper))
    let k = this.tint || 0; while (seen(mixCol(fill, '#FFFFFF', k)) < .68 && k < .85) k += .05
    fill = landed(mixCol(fill, '#FFFFFF', k))
    this.keepFill = true
    try { return shape.call(this, pts, { ...o, fill }) } finally { this.keepFill = false }
  }
  // a highlight sits under words: multiply's colour, no more
  S.hl = function (x, y, w, h, col, k) { return hl.call(this, x, y, w, h, hex(col) ? mul(col, S.paper) : col, k) }
}
