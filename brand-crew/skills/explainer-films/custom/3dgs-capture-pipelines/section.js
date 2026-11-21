// 3dgs-capture-pipelines / section
//
// The tape-measure check from the article, as a section through the room. Top: the LiDAR's room in
// section, floor, ceiling and two walls as clean lines. Splat centres fall in as a cloud around them.
//   step 0  the splat's centres arrive, in SfM units: no scale yet
//   step 1  one known length, floor to ceiling from the LiDAR, scales the whole cloud
//   step 2  the other length, wall to wall, read off the scaled cloud against the LiDAR
//   step 3  how thick a wall is in splat centres: the band around one wall plane
// Every label is a param (the article's numbers). The cloud is a seeded toy: Illustrative.
//
// params: { units, height, width, band }
BESPOKE.define((() => {
  let pts = null
  function cloud(k) {
    if (pts) return pts
    const r = k.rng(7), g = () => (r() + r() + r() + r() - 2) * 0.5
    pts = []
    for (let i = 0; i < 520; i++) {
      const side = Math.floor(r() * 4), t = r()
      const sd = g() * (side < 2 ? 0.06 : 0.035)
      if (side === 0) pts.push([sd, t])            // left wall
      else if (side === 1) pts.push([1 + sd, t])   // right wall
      else if (side === 2) pts.push([t, sd])       // floor
      else pts.push([t, 1 + sd])                   // ceiling
    }
    return pts
  }
  return {
    plan: () => ({ min: [4.0, 4.4, 4.6, 4.6], events: [{ step: 1, at: .4, type: 'ding' }, { step: 2, at: 1.2, type: 'ding' }], motion: 'all' }),
    stampAt: k => [1180, k.top + 20],
    draw(k) {
      const p = k.params, i = k.thumb ? 2 : k.step
      const ink = k.ink, dim = k.dim, a = k.P.a, b = k.tone('b'), hi = k.P.hi
      const X0 = 200, Y0 = k.top + 560, Wd = 700, Hd = 430
      const s = i === 0 ? (k.thumb ? 1 : .62) : (i === 1 ? k.lerp(.62, 1, k.ease(k.p(1, 1.6, .3))) : 1)
      const cx = X0 + Wd / 2, cy = Y0 - Hd / 2
      const P = ([u, v]) => [cx + (u - .5) * Wd * s, cy - (v - .5) * Hd * s]
      // the LiDAR room, faint
      k.seed('room'); k.line([[X0, Y0], [X0 + Wd, Y0], [X0 + Wd, Y0 - Hd], [X0, Y0 - Hd]], 1.0, dim, { closed: true })
      const pc = cloud(k), show = k.thumb ? 1 : (i === 0 ? k.ease(k.p(0, 2.2, .2)) : 1)
      for (let j = 0; j < pc.length; j++) {
        if (j / pc.length > show) break
        const [x, y] = P(pc[j]); k.flat(k.circle(x, y, 4.2, 8), a, .75)
      }
      const lab = (str, x, y, col) => k.text(str, x, y, { role: 'mono', size: 30, min: 16, maxW: 400, lines: 3, col })
      if (i === 0) lab(p.units, X0, k.top + 40, ink)
      if (i >= 1) {
        const t = k.thumb ? 1 : (i === 1 ? k.ease(k.p(1, 1, 1.6)) : 1)
        k.push(); k.alpha(t)
        k.seed('h'); k.line([[X0 - 60, Y0], [X0 - 60, Y0 - Hd]], 2.2, hi)
        lab(p.height, X0 + Wd + 60, Y0 - Hd + 30, hi)
        k.pop()
      }
      if (i >= 2) {
        const t = k.thumb ? 1 : (i === 2 ? k.ease(k.p(2, 1, .5)) : 1)
        k.push(); k.alpha(t)
        k.seed('w'); k.line([[X0, Y0 + 50], [X0 + Wd, Y0 + 50]], 2.2, b)
        lab(p.width, X0, Y0 + 100, b)
        k.pop()
      }
      if (i === 3) {
        const t = k.ease(k.p(3, 1.2, .3))
        k.push(); k.alpha(t)
        k.hl(X0 + Wd - 40, Y0 - Hd, 80, Hd, hi, t)
        lab(p.band, X0 + Wd + 60, Y0 - Hd + 230, ink)
        k.pop()
      }
      k.point = i === 1 ? [X0 - 60, Y0 - Hd / 2] : i === 2 ? [X0 + Wd / 2, Y0 + 50] : i === 3 ? [X0 + Wd, Y0 - Hd / 2] : [cx, cy]
      k.mood = i === 2 ? 'proud' : 'neutral'
    },
  }
})())
