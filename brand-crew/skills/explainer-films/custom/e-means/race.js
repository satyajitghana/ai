// e-means / race
//
// The authors' two toy animations, side by side and simulated for real: five
// blobs of points and one bad start (two centroids in one blob, one between
// two others). Left, Lloyd: every iteration moves each centroid all the way to
// its cluster's mean over the whole dataset, and polishes the bad start.
// Right, e-means: shuffled mini-batches, each centroid stepping a fraction of
// the way toward its batch mean (the moving-average update with a cosine step
// and split revival every 5 updates), which shakes the crowded pair loose.
// A seeded toy, so the runtime stamps it Illustrative; every label is a
// storyboard string.
//
// steps: 0 points and the shared start · 1 Lloyd runs · 2 e-means runs · 3 both ends
// params: { left, right, start, lloydEnd, emEnd, stuck }
BESPOKE.define((() => {
  let s = 2 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const BL = [[.2, .25], [.75, .2], [.15, .75], [.47, .8], [.85, .72]]
  const g = () => (rnd() + rnd() + rnd() - 1.5) * .09
  const pts = []
  BL.forEach((b, i) => { for (let j = 0; j < 40; j++) pts.push([b[0] + g(), b[1] + g(), i]) })
  const init = [[.2, .25], [.70, .2], [.80, .2], [.31, .78], [.85, .72]]
  const near = (c, p) => { let bi = 0, bd = 1e9; c.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; bi = i } }); return bi }
  // Lloyd, 25 iterations
  let L = init.map(c => c.slice()); const Ls = [L.map(c => c.slice())]
  for (let it = 0; it < 25; it++) {
    const S = L.map(() => [0, 0, 0])
    pts.forEach(p => { const j = near(L, p); S[j][0] += p[0]; S[j][1] += p[1]; S[j][2]++ })
    L = L.map((c, j) => S[j][2] ? [S[j][0] / S[j][2], S[j][1] / S[j][2]] : c); Ls.push(L.map(c => c.slice()))
  }
  // e-means: 5 epochs of batches of 12, peak step .8 on a cosine to a tenth, split revival every 5 updates
  const B = 12, A0 = .8, T = 5
  let C = init.map(c => c.slice()); const Nn = C.map(() => 1e-3), Es = [{ C: C.map(c => c.slice()), batch: [] }]
  const order = []
  for (let e = 0; e < T; e++) {
    const idx = pts.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp }
    for (let b = 0; b + B <= idx.length; b += B) order.push(idx.slice(b, b + B))
  }
  const M = order.length
  order.forEach((batch, t) => {
    const al = A0 * (.1 + .9 * .5 * (1 + Math.cos(Math.PI * t / M)))
    const S = C.map(() => [0, 0, 0])
    batch.forEach(i => { const p = pts[i], j = near(C, p); S[j][0] += p[0]; S[j][1] += p[1]; S[j][2]++ })
    C = C.map((c, j) => {
      const n = S[j][2], N2 = (1 - al) * Nn[j] + al * n
      let cc = c
      if (n) { const m = [S[j][0] / n, S[j][1] / n], w = al * n / N2; cc = [c[0] + w * (m[0] - c[0]), c[1] + w * (m[1] - c[1])] }
      Nn[j] = N2; return cc
    })
    if (t % 5 === 4) {
      const mean = Nn.reduce((a, b) => a + b) / Nn.length
      Nn.forEach((n, j) => { if (n < .1 * mean) { let d = 0; Nn.forEach((x, i) => { if (x > Nn[d]) d = i }); const c = C[d]; C[j] = [c[0] * 1.02, c[1] * .98]; C[d] = [c[0] * .98, c[1] * 1.02]; Nn[j] = Nn[d] / 2; Nn[d] /= 2 } })
    }
    Es.push({ C: C.map(c => c.slice()), batch })
  })
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const stateAt = (arr, f, get) => { const x = Math.max(0, Math.min(arr.length - 1, f * (arr.length - 1))), i = Math.floor(x), t = x - i; const a = get(arr[i]), b = get(arr[Math.min(arr.length - 1, i + 1)]); return a.map((c, j) => lerp2(c, b[j], t)) }

  return {
    stampAt: k => [1060, k.top - 40],
    plan: () => ({
      min: [3.4, 5.5, 6.5, 3.4],
      events: [{ step: 0, at: .2, type: 'ticks', n: 12, span: 1.2 }, { step: 1, at: .3, type: 'ticks', n: 10, span: 3 }, { step: 1, at: 3.8, type: 'thunk' },
        { step: 2, at: .2, type: 'ticks', n: 24, span: 4.5 }, { step: 2, at: 5, type: 'ding' }, { step: 3, at: .3, type: 'pop' }],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 1, from: 0, to: 4.2 }, { step: 2, from: 0, to: 5.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, SZ = 500, Y0 = Math.max(k.top + 90, 300)
      const PX = [150, 790]
      const pal = [k.P.a, k.P.b, k.P.hi, k.mix(k.P.a, k.P.b, .5), k.mix(k.P.b, k.ink, .35)]
      const X = (px, q) => [px + q[0] * SZ, Y0 + q[1] * SZ]
      const lf = i < 1 ? 0 : k.thumb ? 1 : k.ease(k.p(1, 3.6, .3))
      const ef = i < 2 ? 0 : k.thumb ? 1 : k.p(2, 4.8, .3)
      const LC = stateAt(Ls, lf, x => x)
      const EC = stateAt(Es, ef, x => x.C)
      const batch = i === 2 && ef < 1 ? new Set(Es[Math.min(Es.length - 1, Math.round(ef * (Es.length - 1)))].batch) : new Set()
      PX.forEach((px, side) => {
        // panel frame and its heading
        const fk = k.thumb ? 1 : k.easeOut(k.span(0, .6))
        k.push(); k.alpha(fk)
        k.seed('frame' + side)
        if (k.pixel) k.line(k.rrect(px - 20, Y0 - 20, SZ + 40, SZ + 40, 18), .8, k.dim, { closed: true })
        else k.shape(k.rrect(px - 20, Y0 - 20, SZ + 40, SZ + 40, 18), { fill: k.tone('light'), op: .25, sw: .8 })
        const head = side ? p.right : p.left
        if (head) { const hm = k.measure(head, { role: 'head', size: 32, min: 14, maxW: SZ + 20, lines: 1 }); k.text(head, px - 10, Y0 - 40 - hm.h * .25, { role: 'head', size: 32, min: 14, maxW: SZ + 20, lines: 1 }) }
        k.pop()
        // the points: coloured by the centroid they are nearest to on this side
        const Cs = side ? EC : LC
        pts.forEach((q, m) => {
          const a = k.thumb ? 1 : k.span(.15 + m * .004, .45 + m * .004); if (a <= 0) return
          const [x, y] = X(px, q), j = i >= (side ? 2 : 1) || (i === 3) ? near(Cs, q) : -1
          const hot = side === 1 && batch.has(m)
          k.flat(k.circle(x, y, hot ? 7 : 4.5, 10), hot ? k.ink : j >= 0 ? pal[j] : k.dim, a * (hot ? 1 : .8))
        })
        // centroids
        const show = k.thumb ? 1 : k.backOut(k.p(0, .5, 1.1))
        Cs.forEach((c, j) => {
          const [x, y] = X(px, c), r = 15 * show
          if (r <= 0) return
          k.flat([[x, y - r * 1.25], [x + r, y], [x, y + r * 1.25], [x - r, y]], k.ink, 1)
          k.flat([[x, y - r * .8], [x + r * .62, y], [x, y + r * .8], [x - r * .62, y]], pal[j], 1)
        })
        // Lloyd's stranded centroid, ringed at the end of its run
        if (side === 0 && i >= 1) {
          const rk = k.thumb ? 1 : k.easeOut(k.p(1, .6, 3.9)); if (rk > 0) {
            const [x, y] = X(px, LC[3])
            k.seed('ring'); k.line(k.partial(k.circle(x, y, 46, 40).concat([k.circle(x, y, 46, 40)[0]]), rk), 1.4, k.P.hi)
            if (p.stuck) k.text(p.stuck, x - 150, y - 70, { role: 'label', size: 24, min: 12, maxW: 340, lines: 1, alpha: rk })
          }
        }
        // what the run has done, under each panel
        const cap = side === 0 ? (i === 0 ? p.start : p.lloydEnd) : (i < 2 ? (i === 0 ? p.start : '') : p.emEnd)
        const ck = side === 0 ? (i === 0 ? 1 : (k.thumb ? 1 : k.p(1, .5, 3.8))) : (i === 0 ? 1 : (k.thumb ? 1 : k.p(2, .5, 5)))
        if (cap && ck > 0) k.text(cap, px - 10, Y0 + SZ + 62, { role: 'mono', size: 26, min: 12, maxW: SZ + 20, lines: 1, col: k.dim, alpha: ck })
      })
      k.point = i === 2 ? [PX[1] + SZ * .5, Y0 + SZ * .5] : i === 1 ? X(PX[0], LC[3]) : [PX[1] + SZ, Y0 + SZ * .3]
      k.mood = i === 1 ? 'thinking' : i === 2 ? 'excited' : i === 3 ? 'happy' : 'neutral'
    },
  }
})())
