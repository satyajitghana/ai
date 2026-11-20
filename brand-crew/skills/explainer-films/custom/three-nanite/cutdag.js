// three-nanite / cutdag
//
// The article's CutStrip widget, painted: a curve cut into 32 clusters of four segments,
// paired and halved five times into a hierarchy drawn as six rows under it. A camera sits
// above the curve; a cluster is drawn when its own projected error is within the threshold
// and its parent's is not. Same model as components/articles/three-nanite/cut-model.ts
// (toy geometry, so the scene is stamped Illustrative). Every string drawn is the storyboard's.
//
// steps: 0 the rows build up from the source clusters · 1 the cut, camera on the left ·
//        2 the camera travels right and the cut follows · 3 parents measured from each
//        child's own bounds: holes open
// params: { fine, row, hole, camera }
BESPOKE.define((() => {
  const SPAN = 8, LEAVES = 32, SEGS = 4, LEVELS = 6, K = 40, CAM_Y = 1.0
  const f = x => 0.42 * Math.sin(x * 1.3) + 0.2 * Math.sin(x * 3.7 + 1) + 0.09 * Math.sin(x * 9.1 + 2) + 0.05 * Math.sin(x * 19.3)
  const N = LEAVES * SEGS
  const fine = []
  for (let i = 0; i <= N; i++) { const x = i / N * SPAN; fine.push([x, f(x)]) }
  const T = []
  for (let L = 0; L < LEVELS; L++) {
    const n = LEAVES >> L, row = []
    for (let k = 0; k < n; k++) {
      const i0 = k * (N / n), i1 = (k + 1) * (N / n), st = (i1 - i0) / SEGS, pts = []
      for (let s = 0; s <= SEGS; s++) pts.push(fine[i0 + s * st])
      let err = 0, lo = Infinity, hi = -Infinity
      for (let i = i0; i <= i1; i++) {
        const s = Math.min(SEGS - 1, Math.floor((i - i0) / st)), a = pts[s], b = pts[s + 1]
        const t = (fine[i][0] - a[0]) / (b[0] - a[0])
        err = Math.max(err, Math.abs(a[1] + (b[1] - a[1]) * t - fine[i][1]))
        lo = Math.min(lo, fine[i][1]); hi = Math.max(hi, fine[i][1])
      }
      const x0 = fine[i0][0], x1 = fine[i1][0], cx = (x0 + x1) / 2, cy = (lo + hi) / 2
      let r = Math.hypot((x1 - x0) / 2, (hi - lo) / 2)
      if (L > 0) for (const c of [T[L - 1][2 * k], T[L - 1][2 * k + 1]]) { err = Math.max(err, c.err); r = Math.max(r, Math.hypot(c.cx - cx, c.cy - cy) + c.r) }
      row.push({ k, pts, err, cx, cy, r })
    }
    T.push(row)
  }
  const proj = (e, cx, cy, r, X) => { const d = Math.hypot(cx - X, cy - CAM_Y) - r; return d <= 1e-6 ? Infinity : e * K / d }
  function cut(X, tau, shared) {
    const on = T.map(row => row.map(() => false))
    for (let L = 0; L < LEVELS; L++) for (const c of T[L]) {
      const self = L === 0 || proj(c.err, c.cx, c.cy, c.r, X) <= tau
      let par = true
      if (L < LEVELS - 1) { const p = T[L + 1][c.k >> 1]; par = shared ? proj(p.err, p.cx, p.cy, p.r, X) > tau : proj(p.err, c.cx, c.cy, c.r, X) > tau }
      on[L][c.k] = self && par
    }
    const cover = new Array(LEAVES).fill(0)
    for (let L = 0; L < LEVELS; L++) T[L].forEach((c, k) => { if (on[L][k]) for (let s = k << L; s < (k + 1) << L; s++) cover[s]++ })
    return { on, cover }
  }

  const X0 = 150, X1 = 1350
  // a polyline as a filled ribbon, so a drawn piece reads at a glance in every medium
  const ribbon = (pts, w) => {
    const L = [], R = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      L.push([pts[i][0] - dy / l * w, pts[i][1] + dx / l * w]); R.push([pts[i][0] + dy / l * w, pts[i][1] - dx / l * w])
    }
    return L.concat(R.reverse())
  }
  return {
    plan: () => ({
      min: [5.2, 4.6, 6.0, 5.0],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 6, span: 2.4 },
        { step: 1, at: .4, type: 'ding' },
        { step: 3, at: .8, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 3.2 }, { step: 2, from: 0, to: 5.0 }, { step: 3, from: 0, to: 1.6 }],
    }),
    stampAt: k => [1250, k.top + 10],
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 10
      const SY = top + 180, YS = 150
      const sx = x => X0 + x / SPAN * (X1 - X0), sy = y => SY - y * YS
      const ROW0 = top + 400, RH = 60
      // where the camera is
      let camF = .2
      if (i === 2) camF = .2 + .55 * (k.thumb ? 1 : k.ease(k.p(2, 4.4, .3)))
      if (i >= 3) camF = .75
      const X = camF * SPAN
      const tau = i >= 3 ? 8 : 2
      const shared = i < 3
      const C = cut(X, tau, shared)
      const build = i === 0 ? (k.thumb ? 1 : k.p(0, 3.0, .2)) : 1
      const showCut = i >= 1

      // the source curve, faint
      k.seed('src')
      k.line(fine.map(([x, y]) => [sx(x), sy(y)]), 1.4, k.dim)

      // camera
      if (showCut) {
        const cx = sx(X), cy = sy(CAM_Y) - 40
        k.seed('cam' + Math.round(cx / 6))
        k.shape(k.rrect(cx - 34, cy - 22, 68, 44, 8), { fill: k.ink, op: 1, sw: .8 })
        k.seed('lens'); k.shape(k.circle(cx, cy, 11), { fill: k.paper, op: 1, sw: .5 })
        k.text(p.camera, cx, cy - 40, { role: 'label', size: 32, align: 'center', maxW: 240, lines: 1, col: k.dim })
        if (shared) {
          const o = { role: 'head', size: 34, maxW: 480, lines: 1 }
          const tw = k.measure(p.fine, o).w
          k.text(p.fine, X < SPAN / 2 ? cx + 60 : cx - 60 - tw, cy + 10, o)
        }
      }

      // holes, under the drawn pieces
      if (!shared) {
        const a = k.thumb ? 1 : k.easeOut(k.p(3, .8, .4))
        let s = 0
        while (s < LEAVES) {
          if (C.cover[s] === 0) {
            let e = s; while (e < LEAVES && C.cover[e] === 0) e++
            const x0 = sx(s / LEAVES * SPAN), x1 = sx(e / LEAVES * SPAN)
            k.push(); k.alpha(a)
            k.hl(x0, SY - 170, x1 - x0, 340, k.P.b, 1)
            k.text(p.hole, (x0 + x1) / 2, SY + 150, { role: 'head', size: 40, align: 'center', maxW: Math.max(140, x1 - x0), lines: 1, col: k.P.b })
            k.pop()
            s = e
          } else s++
        }
      }

      // drawn pieces of the curve, by level
      const tones = [k.mix(k.P.a, k.ink, .2), k.mix(k.P.b, k.ink, .2), k.mix(k.P.hi, k.ink, .35), k.mix(k.P.a, k.ink, .6), k.mix(k.P.b, k.ink, .6), k.ink]
      if (showCut) for (let L = 0; L < LEVELS; L++) T[L].forEach((c, n) => {
        if (!C.on[L][n]) return
        k.flat(ribbon(c.pts.map(([x, y]) => [sx(x), sy(y)]), 5), tones[L], 1)
      })

      // the hierarchy rows: source at the bottom, built upward in step 0
      k.text(p.row, X0, ROW0 - 24, { role: 'label', size: 32, maxW: 900, lines: 1, col: k.dim })
      for (let L = 0; L < LEVELS; L++) {
        const rowT = k.clamp((build * LEVELS - L), 0, 1)
        if (rowT <= 0) continue
        const y = ROW0 + (LEVELS - 1 - L) * RH
        const w = (X1 - X0) / (LEAVES >> L)
        k.push(); k.alpha(k.easeOut(rowT))
        T[L].forEach((c, n) => {
          const inCut = showCut && C.on[L][n]
          k.seed(`cell${L}-${n}-${inCut ? 1 : 0}`)
          if (inCut) k.flat(k.rect(X0 + n * w + 3, y + 4, w - 6, RH - 10), tones[L], 1)
          else k.line(k.rrect(X0 + n * w + 3, y + 4, w - 6, RH - 10, 6), .6, k.dim, { closed: true })
        })
        k.pop()
      }
      k.point = showCut ? [sx(X), sy(CAM_Y) - 40] : [X0 + 300, ROW0 + (LEVELS - 1) * RH]
      k.mood = i === 3 ? 'surprised' : i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
