// voxel-slam / planeba
//
// The article's PlaneBA widget as a moving picture. Three scans see one straight wall; the vertical
// scale is exaggerated so centimetres show. Scan 2 carries an old registration error that is
// already in the map; scan 3 arrives with the odometry's prediction error.
//   step 0  the three scans as estimated, the true wall dashed
//   step 1  scan-to-map: a plane is fitted to scans 1 and 2 as they stand, and only scan 3 moves
//           onto it (it lands on a wall that is not there)
//   step 2  back to the start; window BA: scans 2 and 3 move together, the plane re-solved each
//           iteration, until the points form one thin wall
//   step 3  the plane is never a variable: the spread across it (the smallest eigenvalue) shrinks
//   step 4  each scan's points collapse into one cluster (count, sum, sum of outer products)
// Same algebra as components/articles/voxel-slam/plane-ba.tsx, on a seeded toy, so the runtime stamps
// it Illustrative. Every string drawn comes from params.
// params: { labels: [5 strings], scan: [3 strings], wall, cluster }
BESPOKE.define((() => {
  let s = 17 >>> 0
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + .5) / 4294967296 }
  const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd())
  const SIG = .02, SY = -2, NP = 22
  const SC = [{ cx: 1, x0: 0, x1: 3.2 }, { cx: 3, x0: 1.4, x1: 4.6 }, { cx: 5, x0: 2.8, x1: 6 }]
  const BODY = SC.map(sc => Array.from({ length: NP }, (_, i) => [sc.x0 + (sc.x1 - sc.x0) * (i + .5) / NP - sc.cx, -SY + SIG * gauss()]))
  const DEG = Math.PI / 180
  const START = [{ th: 0, dy: 0 }, { th: 1.2 * DEG, dy: .06 }, { th: -.8 * DEG, dy: -.04 }]
  const world = (b, k, p) => {
    const c = Math.cos(p.th), sn = Math.sin(p.th)
    return [c * b[0] - sn * b[1] + SC[k].cx, sn * b[0] + c * b[1] + SY + p.dy]
  }
  const fit = pts => {
    let mx = 0, my = 0; pts.forEach(q => { mx += q[0]; my += q[1] }); mx /= pts.length; my /= pts.length
    let a = 0, b = 0, d = 0
    pts.forEach(q => { const u = q[0] - mx, v = q[1] - my; a += u * u; b += u * v; d += v * v })
    a /= pts.length; b /= pts.length; d /= pts.length
    const tr = (a + d) / 2, r = Math.sqrt(((a - d) / 2) ** 2 + b * b), lmin = tr - r
    let nx = b, ny = lmin - a; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L
    if (Math.abs(ny) < 1e-9) { nx = 0; ny = 1 }
    return { m: [mx, my], n: [nx, ny], lmin }
  }
  const align = (k, p, f) => {
    let q = { ...p }
    for (let it = 0; it < 4; it++) {
      let h00 = 0, h01 = 0, h11 = 0, g0 = 0, g1 = 0
      const c = [SC[k].cx, SY + q.dy]
      BODY[k].forEach(b => {
        const w = world(b, k, q)
        const r = f.n[0] * (w[0] - f.m[0]) + f.n[1] * (w[1] - f.m[1])
        const jt = -f.n[0] * (w[1] - c[1]) + f.n[1] * (w[0] - c[0]), jy = f.n[1]
        h00 += jt * jt; h01 += jt * jy; h11 += jy * jy; g0 += jt * r; g1 += jy * r
      })
      const det = h00 * h11 - h01 * h01; if (Math.abs(det) < 1e-12) break
      q = { th: q.th - (h11 * g0 - h01 * g1) / det, dy: q.dy - (h00 * g1 - h01 * g0) / det }
    }
    return q
  }
  const pts = P => P.flatMap((p, k) => BODY[k].map(b => world(b, k, p)))
  // scan-to-map
  const F12 = fit(BODY[0].map(b => world(b, 0, START[0])).concat(BODY[1].map(b => world(b, 1, START[1]))))
  const S2M = [START[0], START[1], align(2, START[2], F12)]
  // window BA, recorded per iteration
  const ITER = [START.map(p => ({ ...p }))]
  for (let it = 0; it < 8; it++) {
    const cur = ITER[ITER.length - 1], f = fit(pts(cur))
    ITER.push([cur[0], align(1, cur[1], f), align(2, cur[2], f)])
  }
  const lerpPose = (a, b, t) => ({ th: a.th + (b.th - a.th) * t, dy: a.dy + (b.dy - a.dy) * t })
  const lerpP = (A, B, t) => A.map((p, i) => lerpPose(p, B[i], t))
  const iterAt = t => { const x = t * (ITER.length - 1), i = Math.min(ITER.length - 2, Math.floor(x)); return lerpP(ITER[i], ITER[i + 1], x - i) }

  return {
    stampAt: k => [1150, k.top - 20],
    plan: () => ({
      min: [4.6, 5.2, 6.2, 4.6, 5.0],
      events: [{ step: 1, at: .5, type: 'whoosh' }, { step: 2, at: .3, type: 'ticks', n: 8, span: 3.4 }, { step: 3, at: .4, type: 'ding' }, { step: 4, at: .5, type: 'pop' }],
      motion: [{ step: 1, from: 0, to: 3.2 }, { step: 2, from: 0, to: 4.6 }, { step: 4, from: 0, to: 2.6 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 150, X1 = 1330, YC = Math.max(k.top + 300, 560)
      const X = x => X0 + (x / 6) * (X1 - X0)
      const EX = 1900 // px per metre, vertical only (the exaggeration)
      const Y = y => YC - y * EX
      const COL = [k.P.a, k.P.hi, k.P.b]

      // pose set this frame
      let P = START
      if (st === 1) P = lerpP(START, S2M, k.thumb ? 1 : k.ease(k.p(1, 2.6, .6)))
      if (st === 2) P = iterAt(k.thumb ? 1 : k.ease(k.p(2, 3.8, .6)))
      if (st >= 3) P = ITER[ITER.length - 1]
      const W = P.map((q, kk) => BODY[kk].map(b => world(b, kk, q)))

      // the true wall
      k.push(); k.alpha(.55); k.seed('wall')
      for (let x = 0; x < 6; x += .3) k.line([[X(x), Y(0)], [X(Math.min(6, x + .16)), Y(0)]], .8, k.dim)
      k.pop()
      if (p.wall) k.text(p.wall, X(6), Y(0) - 80, { role: 'label', size: 24, min: 12, maxW: 260, lines: 1, col: k.dim, align: 'right' })

      // the fitted plane: frozen map in step 1, all points otherwise
      const f = st === 1 ? F12 : fit(W.flat())
      const yAt = x => f.m[1] - (f.n[0] / f.n[1]) * (x - f.m[0])
      const la = st === 0 ? 0 : k.thumb ? 1 : k.easeOut(k.p(st, .6, .2))
      if (la > .02) {
        k.push(); k.alpha(la); k.seed('plane' + st)
        k.line([[X(0), Y(yAt(0))], [X(6), Y(yAt(6))]], 1.4, st === 1 ? k.P.hi : k.ink)
        k.pop()
      }

      // spread across the plane (step 3): a band whose half-width is the RMS distance
      if (st === 3) {
        const g = k.thumb ? 1 : k.ease(k.p(3, 1.4, .3))
        const f0 = fit(pts(START)), sd0 = Math.sqrt(Math.max(f0.lmin, 0)), sd1 = Math.sqrt(Math.max(f.lmin, 0))
        const sd = sd0 + (sd1 - sd0) * g
        k.seed('band'); k.shape([[X(0), Y(yAt(0) + sd)], [X(6), Y(yAt(6) + sd)], [X(6), Y(yAt(6) - sd)], [X(0), Y(yAt(0) - sd)]], { fill: k.tone('light'), op: .55, sw: .6 })
      }

      // points, or (step 4) clusters
      const col = st >= 4 ? (k.thumb ? 1 : k.ease(k.p(4, 1.8, .3))) : 0
      W.forEach((ws, kk) => {
        let cx = 0, cy = 0; ws.forEach(q => { cx += q[0]; cy += q[1] }); cx /= ws.length; cy /= ws.length
        ws.forEach((q, i) => {
          const x = X(q[0]) + (X(cx) - X(q[0])) * col, y = Y(q[1]) + (Y(cy) - Y(q[1])) * col
          const r = 7 * (1 - col * .6)
          k.flat(k.circle(x, y + kk * 0, r + 2, 10), k.ink, 1 - col * .8)
          k.flat(k.circle(x, y, r, 10), COL[kk], 1 - col * .8)
        })
        if (col > .02) {
          k.seed('cl' + kk); k.shape(k.circle(X(cx), Y(cy), 38 * col, 30), { fill: COL[kk], op: .9, sw: 1.2 })
          if (p.cluster && kk === 1) k.text(p.cluster, X(cx), Y(cy) + 80, { role: 'mono', size: 22, min: 11, maxW: 300, lines: 1, align: 'center', alpha: col })
        }
        const lab = (p.scan || [])[kk]
        if (lab) k.text(lab, X((SC[kk].x0 + SC[kk].x1) / 2), Math.min(Y(0) + 170, 840) + kk * 36, { role: 'label', size: 26, min: 14, maxW: 420, lines: 1, align: 'center', col: COL[kk] })
      })

      const lab = (p.labels || [])[st]
      if (lab) k.text(lab, X0, k.top + 20, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .6, .1)) })

      const c3 = W[2][Math.floor(NP / 2)], c2 = W[1][Math.floor(NP / 2)]
      k.point = st === 1 ? [X(c3[0]), Y(c3[1])] : st === 2 ? [X(c2[0]), Y(c2[1])] : [X(3), Y(0)]
      k.mood = st === 1 ? 'surprised' : st === 2 ? 'thinking' : st === 4 ? 'proud' : 'neutral'
    },
  }
})())
