// spray in the p5 tier. Loaded after the engine, for every film in the p5
// tier, so it touches STYLES.spray and nothing else.
//
// A spray fill is massed gestures of the spray brush, covering. On a box
// (four long edges) the gestures run on past the outline in proportion to
// the edges' length, a node's width out past its sides, and cutting the same
// outline into short edges stops it (measured on the farm, not read from
// p5.brush's source). The lite and live tiers hide it: they
// paint each shape on a scratch canvas cut to the shape plus a margin
// (brushbake.js `paintOne`), which crops the streaks. The p5 tier paints
// into the whole frame, and a clip to the same margin left a hard vertical
// cut in the overspray. So the fill's outline is cut into short edges
// before it is massed: the gestures stay at the outline, with their
// overspray, and nothing is cropped. p5tier simplifies a shape (eps, in
// device pixels) and would merge the cuts back into one edge, so each cut is
// nudged a twentieth of a pixel off the line, alternately, under that eps.
{
  const S = STYLES.spray, shape = S.shape
  const densify = (P, step = 4) => {
    const out = []
    P.forEach((a, i) => {
      const b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.ceil(L / step))
      for (let j = 0; j < n; j++) { const w = j % 2 ? .05 : -.05; out.push([a[0] + dx * j / n - dy / L * w, a[1] + dy * j / n + dx / L * w]) }
    })
    return out
  }
  S.shape = function (pts, o = {}) {
    if (!o.fill || !PB.ok || PB.tiny(pts)) return shape.call(this, pts, o)
    const sh = PB.shape
    PB.shape = function (P, op, a, clip) { return op.medium === 'mass' ? sh.call(this, densify(P), { ...op, eps: .02 }, a, clip) : sh.call(this, P, op, a, clip) }
    try { return shape.call(this, pts, o) } finally { PB.shape = sh }
  }
}
