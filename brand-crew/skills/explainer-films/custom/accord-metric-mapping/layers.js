// accord-metric-mapping / layers
//
// The article's ScaleChain widget as a moving picture. One wall, six images in three keyframe
// windows; each image draws the wall at its depth times exp(its log-scale error). The vertical axis
// is that error, exaggerated, so a few percent shows.
//   step 0  after the depth model and the window fit: each window's scale is still off (u_j + e_i)
//   step 1  the metric anchor: every window takes the filter's scale; a few percent per image remain
//   step 2  agreement between views: pairs from different windows are measured (arcs), then every
//           image takes one correction and the copies fall onto one line (the group mean is kept)
//   step 3  the filter's own scale error moves the whole line together: no stage can see it
// Seeded toy errors, so the runtime stamps it Illustrative. Every string drawn comes from params.
// params: { labels: [4 strings], windows: [3 strings], wall, filter }
BESPOKE.define((() => {
  let s = 20261123 >>> 0
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + .5) / 4294967296 }
  const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd())
  const NW = 3, PER = 2, NI = NW * PER, NP = 16
  const U = [.11, -.07, .06]                               // window scale left after the fit
  const E = Array.from({ length: NI }, () => .025 * gauss()) // per-image error
  const NOISE = Array.from({ length: NI * NP }, () => .003 * gauss())
  const MEAN = E.reduce((a, b) => a + b, 0) / NI
  const F = .09                                           // a filter scale error, exaggerated for step 3
  const errAt = (st, i) => {
    const j = Math.floor(i / PER)
    if (st === 0) return U[j] + E[i]
    if (st === 1) return E[i]
    if (st === 2) return MEAN
    return MEAN + F
  }
  // pairs: overlapping images of different windows
  const PAIRS = []
  for (let a = 0; a < NI; a++) for (let b = a + 1; b < NI; b++) {
    if (Math.floor(a / PER) === Math.floor(b / PER)) continue
    if (b * .9 < a * .9 + 1.5) PAIRS.push([a, b])
  }

  return {
    stampAt: k => [1290, k.top + 70],
    plan: () => ({
      min: [4.4, 4.8, 6.0, 4.6],
      events: [{ step: 1, at: .4, type: 'whoosh' }, { step: 2, at: .3, type: 'ticks', n: PAIRS.length, span: 2.2 }, { step: 2, at: 3.0, type: 'ding' }, { step: 3, at: .5, type: 'pop' }],
      motion: [{ step: 1, from: 0, to: 2.6 }, { step: 2, from: 0, to: 5.0 }, { step: 3, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 160, X1 = 1320, YC = Math.max(k.top + 330, 570)
      const X = x => X0 + (x / 5.9) * (X1 - X0)
      const EX = 1700
      const Y = e => YC - e * EX
      const COL = [k.P.a, k.P.b, k.P.hi]

      // progress from the previous state into this one
      const t = k.thumb ? 1 : st === 2 ? k.ease(k.p(2, 1.8, 2.4)) : k.ease(k.p(st, 1.8, .4))
      const prev = Math.max(0, st - 1)
      const errNow = i => st === 0 ? errAt(0, i) : errAt(prev, i) + (errAt(st, i) - errAt(prev, i)) * t

      // the true wall and its 5 cm band, dashed
      k.seed('band'); k.shape(k.rect(X0, Y(.012), X1 - X0, Y(-.012) - Y(.012)), { fill: k.tone('light'), op: .45, sw: .4 })
      k.push(); k.alpha(.6); k.seed('wall')
      for (let x = 0; x < 5.9; x += .25) k.line([[X(x), Y(0)], [X(Math.min(5.9, x + .13)), Y(0)]], .8, k.dim)
      k.pop()
      if (p.wall) k.text(p.wall, X0, Y(0) + 80, { role: 'label', size: 24, min: 12, maxW: 360, lines: 1, col: k.dim })

      // pair arcs while the views are compared (step 2, before the collapse)
      if (st === 2) {
        const a = k.thumb ? 0 : k.p(2, 2.2, .2)
        const fade = k.thumb ? 0 : 1 - k.ease(k.p(2, .8, 2.6))
        PAIRS.forEach(([i, j], n) => {
          const show = k.clamp((a * PAIRS.length - n), 0, 1)
          if (show <= 0 || fade <= 0) return
          const xa = X(i * .9 + .75), xb = X(j * .9 + .75)
          const ya = Y(errNow(i)), yb = Y(errNow(j))
          const top = Math.min(ya, yb) - 90 - 12 * n
          const arc = k.through([[xa, ya - 14], [(xa + xb) / 2, top], [xb, yb - 14]])
          k.push(); k.alpha(fade); k.seed('pair' + n); k.line(k.partial(arc, show), 1.1, k.ink); k.pop()
        })
      }

      // the six copies of the wall
      for (let i = 0; i < NI; i++) {
        const j = Math.floor(i / PER), e = errNow(i)
        for (let q = 0; q < NP; q++) {
          const x = X(i * .9 + 1.5 * q / (NP - 1))
          const y = Y(e) - NOISE[i * NP + q] * EX
          k.flat(k.circle(x, y, 8, 10), k.ink, .9)
          k.flat(k.circle(x, y, 6, 10), COL[j], .95)
        }
      }

      // window labels under the picture
      ;(p.windows || []).forEach((w, j) => {
        k.text(w, X(j * 1.8 + 1.2), Math.min(YC + 330, 900), { role: 'label', size: 26, min: 13, maxW: 360, lines: 1, align: 'center', col: COL[j] })
      })

      // step 3: the filter's offset, an arrow from the true wall to the line
      if (st === 3) {
        const g = k.thumb ? 1 : k.ease(k.p(3, 1.2, 1.4))
        const x = X(5.75)
        k.arrow([[x, Y(0)], [x, Y(MEAN + F) + 10]], k.P.hi, 1.4, g)
        if (p.filter) k.text(p.filter, x, Y(MEAN + F) - 70, { role: 'mono', size: 24, min: 11, maxW: 520, lines: 1, align: 'right', alpha: g })
      }

      const lab = (p.labels || [])[st]
      if (lab) k.text(lab, X0, k.top + 20, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .6, .1)) })

      k.point = st === 3 ? [X(5.75), Y(MEAN + F)] : [X(2.9), Y(errNow(2))]
      k.mood = st === 0 ? 'thinking' : st === 2 ? 'happy' : st === 3 ? 'surprised' : 'neutral'
    },
  }
})())
