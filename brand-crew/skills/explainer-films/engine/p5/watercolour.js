// watercolour in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.watercolour and nothing else.
//
// The lite and live tiers lay a wash down with 'multiply', so a pale wash
// (a palette's `light`, #F7D9DF) still tints the cream paper clearly. In the
// p5 tier p5.brush mixes the wash into the paper as pigment, and a pale
// colour mixed into a pale paper is almost nothing: the colour multiply
// would land at mixes to a tint a sixth as strong as the live tier's (RGB
// distance from the paper 4-5 against ~30). So each wash is painted in that
// colour pushed further from the paper, along the same line, until it is
// PALE away from it, and laid denser the paler it was; a wash already that
// far out (a palette's `a`, `b`, `hi`) keeps its colour.
//
// p5.brush's fill is random from end to end (how far each layer grows, where
// it is trimmed, where the texture lifts it), so one wash lands up to three
// times as strong as another from seed to seed. Measured on the farm over
// eight seeds, the multiply colour of #F2C94C ranged 19-46 from the paper,
// of #F4D5CC 2-10. Repainted on every drawing, as the p5 tier does with
// every op, the wash flickered, and a frame could catch a node's wash at its
// weakest. Two things hold it still:
//   - a wash is pigment that has dried, so it is painted once per shape, not
//     per drawing: its seed leaves out the boil (the lite tier, baking each
//     shape once per film, never boiled washes either). Its outline still
//     boils, so they are two ops, in one run, so no extra hand-off
//   - each wash is two thinner glazes from two seeds, so one unlucky seed
//     cannot leave a node bare: #F4D5CC now lands 20-34 (mean 28), #F2C94C
//     28-57 (mean 40), about the live tier's 31 and 42
{
  const S = STYLES.watercolour, shape = S.shape, hl = S.hl
  const PALE = 120
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
  const hex = v => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
  // the colour a multiply leaves on the paper, pushed out to PALE from it
  const landed = c => {
    if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return { fill: c }
    const p = rgb(S.paper), m = rgb(c).map((v, i) => v * p[i] / 255), d = Math.hypot(...m.map((v, i) => v - p[i]))
    if (d >= PALE) return { fill: hex(m), alpha: 120 }
    const k = PALE / Math.max(d, 1), pale = clamp((PALE - d) / (PALE * .5))
    return { fill: hex(m.map((v, i) => p[i] + (v - p[i]) * k)), alpha: Math.round(120 + 40 * pale) }
  }
  const dried = f => { const b = BOILN; BOILN = 0; try { return f() } finally { BOILN = b } }
  S.shape = function (pts, o = {}) {
    if (!o.fill || !PB.ok || PB.tiny(pts)) return shape.call(this, pts, o)
    // a faded wash fades both glazes, so together they land at a
    const L = landed(o.fill), P = o.curv ? throughClosed(pts, 5) : pts, a = 1 - Math.sqrt(1 - clamp((o.op ?? .75) / .75))
    dried(() => { for (const j of [0, 1]) PB.shape(P, { fill: L.fill, alpha: L.alpha + j, bleed: o.bleed ?? .1, tex: .5, border: .5 }, a) })
    const ink = o.ink === null ? null : (o.ink || this.ink)
    if (ink) PB.line(P, { ink, brush: 'charcoal', weight: o.sw ?? 1 }, true)
  }
  S.hl = function (x, y, w, h, col, k) {
    if (k <= 0) return
    const L = landed(col)
    // the swipe is painted once and revealed left to right, so it never boils
    dried(() => PB.shape(rectPts(x - 12, y - 4, w + 24, h + 14), { fill: L.fill, alpha: 190, bleed: .04, tex: .3, border: .3 }, 1, k >= 1 ? null : [x - 60, y - 60, (w + 24) * k + 48, h + 120]))
  }
}
