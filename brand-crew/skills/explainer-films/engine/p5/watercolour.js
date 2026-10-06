// watercolour in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.watercolour and nothing else.
//
// The lite and live tiers lay a wash down with 'multiply', so a pale wash
// (a palette's `light`, #F7D9DF) still tints the cream paper clearly. In the
// p5 tier p5.brush mixes the wash into the paper as pigment, and a pale
// colour mixed into a pale paper is almost nothing. Each wash is painted in
// the colour multiply would have landed it at, so the mix lands near the
// same tint; how the wash bleeds, pools and granulates is p5.brush's own.
{
  const S = STYLES.watercolour, shape = S.shape, hl = S.hl
  const mul = (c, p) => { const a = parseInt(c.slice(1), 16), b = parseInt(p.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round((a >> s & 255) * (b >> s & 255) / 255).toString(16).padStart(2, '0')).join('') }
  const landed = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? mul(c, S.paper) : c)
  S.shape = function (pts, o = {}) { return shape.call(this, pts, o.fill ? { ...o, fill: landed(o.fill) } : o) }
  S.hl = function (x, y, w, h, col, k) { return hl.call(this, x, y, w, h, landed(col), k) }
}
