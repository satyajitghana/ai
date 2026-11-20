// 3d-reconstruction-roundup-5 / triangulate
//
// The article's PoseNoiseBA widget, drawn. Top view of a room; five frames of
// a 360 walk down its middle each cast a ray to every wall point. Step 0: the
// true rays meet on the walls. Step 1: every frame's heading turns by a small
// error, all its rays turn with it, and the least-squares intersections of the
// rays scatter off the walls. Step 2: bundle adjustment turns the headings
// back while the points ride home. The angles are exaggerated for the eye and
// computed here only as geometry, so the runtime stamps it Illustrative. Every
// label is a storyboard string.
//
// steps: 0 true rays · 1 noisy headings, scattered points · 2 bundle adjustment
// params: { legend[3] (one line per step), before, after }
BESPOKE.define((() => {
  const NOISE = [5.5, -4.2, 3.1, -6.0, 4.4] // degrees, for the eye only
  const rad = d => d * Math.PI / 180

  function geom(k) {
    const x0 = 170, x1 = 1210, y0 = k.top + 70, y1 = 790
    const pts = []
    for (let i = 0; i < 4; i++) {
      const x = x0 + 120 + i * (x1 - x0 - 240) / 3
      pts.push([x, y0], [x, y1])
    }
    pts.push([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2])
    const my = (y0 + y1) / 2
    const cams = [0, 1, 2, 3, 4].map(j => [x0 + 250 + j * (x1 - x0 - 500) / 4, my + (j % 2 ? 26 : -18)])
    return { x0, x1, y0, y1, pts, cams }
  }

  // least-squares intersection of the rays to point i, each ray turned by err[j]
  function tri(g, i, err) {
    let a = 0, b = 0, d = 0, ex = 0, ey = 0
    g.cams.forEach((c, j) => {
      const p = g.pts[i]
      const ang = Math.atan2(p[1] - c[1], p[0] - c[0]) + err[j]
      const nx = -Math.sin(ang), ny = Math.cos(ang)
      a += nx * nx; b += nx * ny; d += ny * ny
      const cc = nx * c[0] + ny * c[1]
      ex += nx * cc; ey += ny * cc
    })
    const det = a * d - b * b
    return [(d * ex - b * ey) / det, (a * ey - b * ex) / det]
  }

  return {
    stampAt: k => [1060, k.top + 4],
    plan: () => ({
      min: [4.0, 4.6, 4.8],
      events: [{ step: 0, at: .2, type: 'ticks', n: 5, span: 1.4 }, { step: 1, at: .3, type: 'pop' }, { step: 2, at: .4, type: 'ticks', n: 10, span: 2.4 }, { step: 2, at: 3.0, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2 }, { step: 1, from: 0, to: 2.4 }, { step: 2, from: 0, to: 3.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const g = geom(k)
      // how much of the heading error is applied: 0 → 1 in step 1, 1 → 0 in step 2
      const on = i === 0 ? 0 : i === 1 ? (k.thumb ? 1 : k.ease(k.p(1, 1.4, .3))) : (k.thumb ? 0 : 1 - k.ease(k.p(2, 2.4, .4)))
      const err = NOISE.map(n => rad(n) * on)
      const rayGrow = k.thumb || i > 0 ? 1 : k.easeOut(k.p(0, 1.4, .2))

      // the room
      k.seed('room'); k.line(k.rect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0), 1.4, k.ink, { closed: true })

      // rays: from each frame toward each wall point, turned by its error
      g.cams.forEach((c, j) => {
        g.pts.forEach((pt, m) => {
          const ang = Math.atan2(pt[1] - c[1], pt[0] - c[0]) + err[j]
          const L = Math.hypot(pt[0] - c[0], pt[1] - c[1]) * 1.08 * rayGrow
          k.push(); k.alpha(.35)
          k.seed('ray' + j + '_' + m)
          k.line([c, [c[0] + Math.cos(ang) * L, c[1] + Math.sin(ang) * L]], .5, on > .05 ? k.P.b : k.dim)
          k.pop()
        })
      })

      // true wall points
      g.pts.forEach((pt, m) => { k.seed('pt' + m); k.flat(k.circle(pt[0], pt[1], 13, 16), k.ink, 1) })

      // triangulated points, once the error is on (and while it comes off)
      if (on > .02) {
        g.pts.forEach((pt, m) => {
          const q = tri(g, m, err)
          const qx = Math.max(g.x0 - 60, Math.min(g.x1 + 60, q[0])), qy = Math.max(g.y0 - 60, Math.min(g.y1 + 60, q[1]))
          k.seed('q' + m); k.line(k.circle(qx, qy, 14, 18), 1.6, i === 2 ? k.P.a : k.P.hi, { closed: true })
          k.push(); k.alpha(.6); k.seed('qe' + m); k.line([pt, [qx, qy]], .6, i === 2 ? k.P.a : k.P.hi); k.pop()
        })
      }

      // frames, with a heading tick
      g.cams.forEach((c, j) => {
        k.seed('cam' + j); k.flat(k.circle(c[0], c[1], 18, 18), k.paper, 1)
        k.line(k.circle(c[0], c[1], 18, 18), 1.8, k.ink, { closed: true })
        const h = -Math.PI / 2 + err[j] * 1.0
        k.seed('tick' + j); k.line([c, [c[0] + Math.cos(h) * 40, c[1] + Math.sin(h) * 40]], 1.8, on > .05 ? k.P.b : k.ink)
      })

      // the line for this step, under the room
      const legend = (p.legend || [])[i]
      const ly = g.y1 + 58
      if (legend) k.text(legend, g.x0, ly, { role: 'body', size: 34, min: 16, maxW: 760, lines: 1, alpha: k.thumb ? 1 : k.p(i, .5, .2) })
      const big = i === 1 ? p.before : i === 2 ? p.after : ''
      if (big) k.text(big, g.x1 - 10, ly, { role: 'mono', size: 38, min: 16, maxW: 360, lines: 1, align: 'right', col: i === 2 ? k.P.a : k.P.hi, alpha: k.thumb ? 1 : k.p(i, .5, i === 2 ? 2.4 : 1.2) })

      k.point = i === 0 ? g.cams[4] : g.pts[6]
      k.mood = i === 2 ? 'happy' : i === 1 ? 'surprised' : 'neutral'
    },
  }
})())
