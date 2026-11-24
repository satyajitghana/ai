// nopeworld-non-penetrating-world-models / fan
//
// The article's CandidateFan widget as a moving picture. From above, a camera
// walks at an oblique wall with W held. Beat 0: the raw model's path runs
// straight through the wall (a ghost line out the far side). Beat 1: at the
// decision, the fan of candidate motions opens from the camera; each is swept
// with a disc, and the ones that would touch the wall turn red, the rest green.
// Beat 2: the engine's answer, walk to the wall and slide, is drawn dashed, and
// the safe candidate closest to it lights up. Beat 3: the camera takes it and
// slides along the wall. Geometry only, stamped Illustrative; every label is a
// storyboard string.
//
// params: { wall, raw, safe, unsafe, slide, pick }
BESPOKE.define((() => {
  const ELL_D = [8.8, 17.58, 26.4, 35.24, 44.13, 52.84, 60.85, 67.76, 73.66, 78.83, 83.53, 88.0]
  const ELL_R = [0.9999, 0.9989, 0.994, 0.9798, 0.9474, 0.8851, 0.7873, 0.6621, 0.5215, 0.3735, 0.2224, 0.0697]
  const DELTA = [0, 0, 0, 0, 0, 0, 30, 60, ...ELL_D, -30, -60, ...ELL_D.map(d => -d)]
  const RHO = [1, 0, 0.75, 0.5, 0.25, 0.125, 0.433, 0.25, ...ELL_R, 0.433, 0.25, ...ELL_R]
  // world: metres, camera walks +y; wall through (0, WALLY) tilted by ANG
  const ANG = 35 * Math.PI / 180, R = 0.25, STEP = 0.9, WALLY = 2.4
  const n = [Math.sin(ANG), -Math.cos(ANG)]               // normal, towards the camera side
  const gap = p => (p[0] - 0) * n[0] + (p[1] - WALLY) * n[1]
  const CAM = [0, 1.9]                                     // where the decision is made
  const g0 = gap(CAM) - R
  const cands = DELTA.map((dd, i) => {
    const a = dd * Math.PI / 180
    const d = [Math.sin(a) * RHO[i] * STEP, Math.cos(a) * RHO[i] * STEP]
    const g = Math.min(g0, gap([CAM[0] + d[0], CAM[1] + d[1]]) - R)
    return { i, d, safe: g >= 0.05 }
  })
  // the slide response of the input, and the safe candidate nearest it
  const along = -(0 * n[0] + STEP * n[1])
  const t = Math.max(0, g0 / along)
  const rest = [0, STEP * (1 - t)]
  const rn = rest[0] * n[0] + rest[1] * n[1]
  const vS = [rest[0] - rn * n[0], STEP * t + rest[1] - rn * n[1]]
  let pick = 1, best = 1e9
  cands.forEach(c => {
    if (!c.safe || c.i === 1) return
    const e = Math.hypot(c.d[0] - vS[0], c.d[1] - vS[1])
    if (e < best) { best = e; pick = c.i }
  })
  const tdir = [-n[1], n[0]]                               // along the wall

  return {
    stampAt: k => [1150, k.top + 20],
    plan: () => ({
      min: [4.2, 4.6, 4.4, 4.8],
      events: [{ step: 0, at: 1.6, type: 'pop' }, { step: 1, at: .3, type: 'ticks', n: 16, span: 1.6 },
        { step: 2, at: .6, type: 'ding' }, { step: 3, at: .2, type: 'pop' }],
      motion: [{ step: 0, from: 0, to: 3.6 }, { step: 1, from: 0, to: 2.2 }, { step: 3, from: 0, to: 4 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const U = 180, X0 = 780, Y0 = Math.min(930, k.top + 660)
      const X = v => [X0 + v[0] * U, Y0 - v[1] * U]
      // the wall, a thick band
      const w0 = [0 + tdir[0] * 2.0, WALLY + tdir[1] * 2.0], w1 = [0 - tdir[0] * 2.0, WALLY - tdir[1] * 2.0]
      const back = [-n[0] * .22, -n[1] * .22]
      k.seed('wall')
      k.shape([X(w0), X(w1), X([w1[0] + back[0], w1[1] + back[1]]), X([w0[0] + back[0], w0[1] + back[1]])], { fill: k.dim, op: .55, sw: 1 })
      if (p.wall) k.text(p.wall, X0 + 150, Y0 - 2.75 * U, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: k.dim })

      // beat 0: the walk in, and the raw model's path through the wall
      const walk = k.thumb ? 1 : st > 0 ? 1 : k.ease(k.p(0, 1.6, .1))
      const camY = k.lerp(0, CAM[1], walk)
      k.seed('path'); k.line([X([0, 0]), X([0, camY])], 1.4, k.ink)
      const rawT = k.thumb ? 1 : st > 0 ? 1 : k.easeOut(k.p(0, 1.8, 1.8))
      if (rawT > 0) {
        k.seed('raw'); k.line(k.partial([X(CAM), X([0, 3.4])], rawT), 1.2, k.P.hi)
        if (p.raw && rawT > .6) k.text(p.raw, X0 + 30, Y0 - 3.55 * U, { role: 'label', size: 26, min: 12, maxW: 280, lines: 2, col: k.P.hi, alpha: k.clamp((rawT - .6) / .4, 0, 1) })
      }

      // beat 1: the fan
      const fan = k.thumb ? 1 : st >= 1 ? k.easeOut(k.p(1, 1.6, .1)) : 0
      if (fan > 0) {
        cands.forEach(c => {
          if (c.i === 1) return
          const tip = [CAM[0] + c.d[0] * fan, CAM[1] + c.d[1] * fan]
          const col = c.safe ? k.P.a : k.P.hi
          const dim = st >= 2 && c.i !== pick ? .35 : .85
          k.seed('c' + c.i); k.line([X(CAM), X(tip)], dim, col)
        })
        if (fan > .8 && st >= 1) {
          if (p.safe) k.text(p.safe, 140, k.top + 60, { role: 'body', size: 30, min: 13, maxW: 300, lines: 2, col: k.P.a })
          if (p.unsafe) k.text(p.unsafe, 140, k.top + 160, { role: 'body', size: 30, min: 13, maxW: 300, lines: 2, col: k.P.hi })
        }
      }

      // beat 2: the engine's slide, dashed, and the chosen candidate
      if (st >= 2) {
        const a = k.thumb ? 1 : k.easeOut(k.p(2, .8, .1))
        const tip = [CAM[0] + vS[0], CAM[1] + vS[1]]
        for (let s = 0; s < 6; s++) {
          const u0 = s / 6, u1 = u0 + .09
          if (u0 > a) break
          k.seed('vs' + s); k.line([X([CAM[0] + vS[0] * u0 * 1.0, CAM[1] + vS[1] * u0]), X([CAM[0] + vS[0] * Math.min(u1, a), CAM[1] + vS[1] * Math.min(u1, a)])], 1.1, k.P.b)
        }
        if (p.slide) k.text(p.slide, 140, k.top + 260, { role: 'body', size: 30, min: 13, maxW: 300, lines: 2, col: k.P.b, alpha: a })
        const c = cands[pick]
        k.seed('pick'); k.line([X(CAM), X([CAM[0] + c.d[0], CAM[1] + c.d[1]])], 2.4, k.P.a)
        if (p.pick) k.text(p.pick, 140, k.top + 360, { role: 'head', size: 34, min: 14, maxW: 300, lines: 2, alpha: a })
        void tip
      }

      // beat 3: the camera takes the pick
      let cam = [0, camY]
      if (st >= 3) {
        const c = cands[pick]
        const m = k.thumb ? 1 : k.ease(k.p(3, 2.4, .2))
        cam = [CAM[0] + c.d[0] * m, CAM[1] + c.d[1] * m]
        k.seed('took'); k.line([X(CAM), X(cam)], 2, k.ink)
      }
      const [cx, cy] = X(cam)
      k.seed('disc'); k.shape(k.circle(cx, cy, R * U, 24), { fill: k.P.light, op: .35, sw: .6 })
      k.flat(k.circle(cx, cy, 10, 14), k.ink, 1)
      k.point = st >= 2 ? X([CAM[0] + cands[pick].d[0], CAM[1] + cands[pick].d[1]]) : [cx, cy]
      k.mood = st === 0 ? 'surprised' : st === 1 ? 'thinking' : 'happy'
    },
  }
})())
