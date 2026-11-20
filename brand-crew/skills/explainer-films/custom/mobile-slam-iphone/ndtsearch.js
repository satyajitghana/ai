// mobile-slam-iphone / ndtsearch
//
// The article's NDT localiser (core/ndt.cpp and Lio::globalSearch), drawn on a
// planar floor plan, the same room as the article's NdtToy widget:
//   step 0  the saved map is cut into 1 m cells; every cell with enough points
//           becomes a Gaussian, drawn as its 2-sigma ellipse
//   step 1  tracking: a scan arrives a little off (turned and shifted) and is
//           eased onto the walls, its points turning from "unmatched" to
//           "matched" as they land inside a cell's ellipse
//   step 2  no heading at all: the global search fans out 12 headings at each
//           of five starting points, the guess and four points 1 m away
//   step 3  the best-scoring start is refined and the scan settles on the map
// The motion between poses is eased, not computed by Gauss-Newton, so the
// scene is stamped Illustrative. Every string drawn is a param.
//
// params: { cells, track, search, settle, matched, unmatched }
BESPOKE.define((() => {
  // the floor plan, in metres (the widget's room, moved so the map origin is inside it)
  const WALLS = [
    [[0, 0], [11, 0]], [[11, 0], [11, 4.5]], [[11, 4.5], [8.5, 4.5]], [[8.5, 4.5], [8.5, 7.5]],
    [[8.5, 7.5], [0, 7.5]], [[0, 7.5], [0, 0]],
    [[3, 3], [4.2, 3]], [[4.2, 3], [4.2, 4.1]], [[4.2, 4.1], [3, 4.1]], [[3, 4.1], [3, 3]],
    [[6.2, 0], [6.2, 2]], [[1.4, 7.5], [1.4, 6.2]],
  ]
  const TRUTH = { th: -0.5, x: 6.4, y: 4.6 }
  const OFF = { th: 0.22, x: 0.45, y: -0.3 }  // the tracking start, relative to the truth
  const S = 84                                 // px per metre
  const X0 = 150

  const rot = (th, x, y) => [Math.cos(th) * x - Math.sin(th) * y, Math.sin(th) * x + Math.cos(th) * y]

  function ray(ox, oy, dx, dy) {
    let best = 1e9
    for (const [a, b] of WALLS) {
      const ex = b[0] - a[0], ey = b[1] - a[1]
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-12) continue
      const wx = a[0] - ox, wy = a[1] - oy
      const t = (wx * ey - wy * ex) / den
      const u = (wx * dy - wy * dx) / den
      if (t > 1e-6 && u >= 0 && u <= 1 && t < best) best = t
    }
    return best < 15 ? best : null
  }

  let cache = null
  function build(k) {
    if (cache) return cache
    const r = k.rng(101)
    const g = () => { const u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
    const pts = []
    for (const [a, b] of WALLS) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(2, Math.round(L / 0.12))
      for (let i = 0; i <= n; i++) {
        const u = i / n
        pts.push([a[0] + u * (b[0] - a[0]) + 0.015 * g(), a[1] + u * (b[1] - a[1]) + 0.015 * g()])
      }
    }
    const acc = new Map()
    for (const p of pts) {
      const key = Math.floor(p[0]) + ',' + Math.floor(p[1])
      const c = acc.get(key) || { n: 0, sx: 0, sy: 0, xx: 0, xy: 0, yy: 0 }
      c.n++; c.sx += p[0]; c.sy += p[1]; c.xx += p[0] * p[0]; c.xy += p[0] * p[1]; c.yy += p[1] * p[1]
      acc.set(key, c)
    }
    const cells = []
    for (const [key, c] of acc) {
      if (c.n < 4) continue
      const mx = c.sx / c.n, my = c.sy / c.n
      const a = c.xx / c.n - mx * mx, b = c.xy / c.n - mx * my, d = c.yy / c.n - my * my
      const m = (a + d) / 2, q = Math.sqrt(((a - d) / 2) ** 2 + b * b)
      const l1 = m + q, l2 = Math.max(m - q, 0.01 * l1, 1e-4)
      const ang = 0.5 * Math.atan2(2 * b, a - d)
      const [ix, iy] = key.split(',').map(Number)
      cells.push({ mx, my, r1: 2 * Math.sqrt(l1), r2: 2 * Math.sqrt(l2), ang, ix, iy })
    }
    const scan = []
    const sr = k.rng(202)
    const N = 90
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * (i + 0.5 * sr())) / N
      const t = ray(TRUTH.x, TRUTH.y, Math.cos(a), Math.sin(a))
      if (t === null || t < 0.4) continue
      scan.push(rot(-TRUTH.th, Math.cos(a) * t, Math.sin(a) * t))
    }
    cache = { pts, cells, scan }
    return cache
  }

  return {
    plan: () => ({
      min: [4.6, 5.4, 5.6, 4.6],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 8, span: 2.4 },
        { step: 1, at: 2.4, type: 'ding' },
        { step: 2, at: .3, type: 'ticks', n: 12, span: 2.6 },
        { step: 3, at: 1.8, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 3.4 }, { step: 2, from: 0, to: 3.2 }, { step: 3, from: 0, to: 2.6 }],
    }),
    stampAt: k => [1250, k.top + 20],
    draw(k) {
      const p = k.params
      const i = k.thumb ? 3 : k.step
      const { cells, scan, pts } = build(k)
      const Y0 = k.top + 40 + 7.5 * S
      const X = x => X0 + x * S
      const Y = y => Y0 - y * S
      const ink = k.ink, dim = k.dim, a = k.P.a, hi = k.P.hi
      const bad = k.tone('b')

      // grid of 1 m cells
      for (let gx = 0; gx <= 11; gx++) { k.seed('gx' + gx); k.line([[X(gx), Y(0)], [X(gx), Y(7.5)]], .25, dim) }
      for (let gy = 0; gy <= 7; gy++) { k.seed('gy' + gy); k.line([[X(0), Y(gy)], [X(11), Y(gy)]], .25, dim) }

      // the map: points fade as the Gaussians take over
      const toCells = k.thumb ? 1 : k.ease(k.p(0, 2.2, .3))
      k.push(); k.alpha(1 - .6 * toCells)
      for (let j = 0; j < pts.length; j += 2) k.flat(k.circle(X(pts[j][0]), Y(pts[j][1]), 2.4, 6), ink, .55)
      k.pop()
      cells.forEach((c, j) => {
        const t = k.thumb ? 1 : k.clamp((toCells * cells.length - j * .6) / 3, 0, 1)
        if (t <= 0) return
        const e = k.ellipse(0, 0, Math.max(c.r1 * S, 6), Math.max(c.r2 * S, 4), 28).map(([x, y]) => {
          const [rx, ry] = rot(-c.ang, x, y)
          return [X(c.mx) + rx, Y(c.my) + ry]
        })
        k.push(); k.alpha(t)
        k.seed('cell' + j); k.shape(e, { fill: a, op: .18, sw: .5 })
        k.pop()
      })
      k.text(p.cells, X(11) + 30, k.top + 90, { role: 'label', size: 30, min: 16, maxW: 250, lines: 3, col: ink })

      if (i === 0) {
        k.point = [X(5.5), Y(3.7)]
        k.mood = 'thinking'
        return
      }

      // the pose the scan is drawn at
      let pose = TRUTH
      let label = p.track
      if (i === 1) {
        const t = k.thumb ? 1 : k.ease(k.p(1, 2.6, .6))
        pose = { th: TRUTH.th + OFF.th * (1 - t), x: TRUTH.x + OFF.x * (1 - t), y: TRUTH.y + OFF.y * (1 - t) }
      }
      if (i >= 2) {
        // the global search: 12 headings at each of five starts around a guess
        const guess = [TRUTH.x + 0.3, TRUTH.y - 0.2]
        const starts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        const fan = i === 2 ? (k.thumb ? 1 : k.ease(k.p(2, 2.6, .2))) : 1
        const fade = i === 3 ? (k.thumb ? 1 : k.ease(k.p(3, .8))) : 0
        starts.forEach((o, s) => {
          for (let h = 0; h < 12; h++) {
            const show = k.clamp(fan * 60 - (s * 12 + h), 0, 1)
            if (show <= 0) continue
            const th = (2 * Math.PI * h) / 12
            const cx = X(guess[0] + o[0]), cy = Y(guess[1] + o[1])
            const best = s === 0 && h === 11
            k.push(); k.alpha(show * (best ? 1 : 1 - .75 * fade))
            k.seed('st' + s + '-' + h)
            k.line([[cx, cy], [cx + Math.cos(th) * 34, cy - Math.sin(th) * 34]], best ? 1 : .45, best ? hi : dim)
            k.pop()
          }
          k.seed('sc' + s); k.flat(k.circle(X(guess[0] + o[0]), Y(guess[1] + o[1]), 7, 10), hi, fan)
        })
        label = i === 2 ? p.search : p.settle
        if (i === 2) {
          // the scan rides along with the fan's current candidate
          const c = Math.min(59, Math.floor(fan * 59.99))
          const s = Math.floor(c / 12), h = c % 12
          pose = { th: (2 * Math.PI * h) / 12, x: guess[0] + starts[s][0], y: guess[1] + starts[s][1] }
        } else {
          const t = k.thumb ? 1 : k.ease(k.p(3, 2.0, .4))
          const from = { th: (2 * Math.PI * 11) / 12 - 2 * Math.PI, x: guess[0], y: guess[1] }
          pose = { th: k.lerp(from.th, TRUTH.th, t), x: k.lerp(from.x, TRUTH.x, t), y: k.lerp(from.y, TRUTH.y, t) }
        }
      }

      // scan points, coloured by whether they sit near a wall cell (hidden while the search fans out)
      let nm = 0
      for (let j = 0; j < (i === 2 ? 0 : scan.length); j++) {
        const [qx, qy] = rot(pose.th, scan[j][0], scan[j][1])
        const wx = qx + pose.x, wy = qy + pose.y
        let m = false
        for (const c of cells) {
          const dx = wx - c.mx, dy = wy - c.my
          const [ux, uy] = rot(-c.ang, dx, dy)
          if ((ux / Math.max(c.r1, .06)) ** 2 + (uy / Math.max(c.r2, .06)) ** 2 < 1.6) { m = true; break }
        }
        if (m) nm++
        k.flat(k.circle(X(wx), Y(wy), 6, 8), m ? hi : bad, .95)
      }
      // the sensor
      const tip = rot(pose.th, .5, 0), l = rot(pose.th, -.3, .25), rr = rot(pose.th, -.3, -.25)
      k.seed('pose'); k.shape([[X(pose.x + tip[0]), Y(pose.y + tip[1])], [X(pose.x + l[0]), Y(pose.y + l[1])], [X(pose.x + rr[0]), Y(pose.y + rr[1])]], { fill: hi, op: .9, sw: .8 })

      const frac = scan.length ? nm / scan.length : 0
      k.text(label, X(11) + 30, k.top + 300, { role: 'label', size: 30, min: 16, maxW: 250, lines: 4, col: ink })
      if (i !== 2) k.text(frac > .8 ? p.matched : p.unmatched, X(11) + 30, k.top + 520, { role: 'mono', size: 26, min: 14, maxW: 250, lines: 2, col: frac > .8 ? hi : bad })
      k.point = i === 2 ? [X(TRUTH.x + 0.3), Y(TRUTH.y - 0.2)] : [X(pose.x), Y(pose.y)]
      k.mood = i === 3 && frac > .8 ? 'proud' : i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
