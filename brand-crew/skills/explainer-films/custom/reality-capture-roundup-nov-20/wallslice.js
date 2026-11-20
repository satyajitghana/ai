// reality-capture-roundup-nov-20 / wallslice
//
// The article's WallEvidence widget as a moving picture: one exterior wall seen from inside, in
// elevation at the top (window, desk, downstand beam), and the plan slice below it. A cut line
// moves to a height per step and the scan points at that height sweep in along the wall:
//   step 0  cut at 1.2 m: the inside face, hundreds of points on one line
//   step 1  same cut: the outside face is a dashed guess, no points (thickness is not in the cloud)
//   step 2  cut at 1.5 m through the window: a gap bounded by the frames, the glass narrower than
//           the rough opening
//   step 3  cut at 2.5 m: the slice meets a face 400 mm into the room (beam or hanging wall)
// The wall and its dimensions are the widget's (the article prints them). Noise is a seeded toy,
// so the scene is stamped Illustrative. Every string drawn is a param.
//
// params: { face, thick, rough, glass, beam }
BESPOKE.define((() => {
  const L = 6.0, T = 0.25
  const RO0 = 2.2, RO1 = 3.8, FR = 0.045, SILL = 0.9, HEAD = 2.1
  const DESK0 = 0.6, DESK1 = 2.0, DESK_H = 0.72
  const BEAM_D = 0.4, BEAM_Z = 2.35, CEIL = 2.75
  const CUTS = [1.2, 1.2, 1.5, 2.5]
  const SX = 183
  const X0 = 170

  let cache = null
  function build(k) {
    if (cache) return cache
    const sets = CUTS.map((z, ci) => {
      const r = k.rng(40 + ci)
      const n = () => (r() + r() + r() - 1.5) * 0.012
      const pts = []
      const band = z > SILL && z < HEAD
      const beam = z >= BEAM_Z
      for (let i = 0; i <= 150; i++) {
        const x = i * 0.04
        if (beam) { pts.push([x, -BEAM_D + n(), 'b']); continue }
        if (z < DESK_H && x > DESK0 && x < DESK1) continue
        if (band && x > RO0 && x < RO1) {
          if (x < RO0 + FR + 0.02 || x > RO1 - FR - 0.02) pts.push([x, 0.06 + n(), 'f'])
          continue
        }
        pts.push([x, n(), 'w'])
      }
      return pts
    })
    cache = sets
    return cache
  }

  return {
    plan: () => ({
      min: [4.2, 4.4, 5.0, 5.0],
      events: [
        { step: 0, at: .4, type: 'ticks', n: 10, span: 1.6 },
        { step: 2, at: .4, type: 'ticks', n: 10, span: 1.6 },
        { step: 3, at: 1.6, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 2.4 }, { step: 2, from: 0, to: 2.6 }, { step: 3, from: 0, to: 2.6 }],
    }),
    stampAt: k => [1150, k.top + 310],
    draw(k) {
      const p = k.params
      const i = k.thumb ? 2 : k.step
      const sets = build(k)
      const ink = k.ink, dim = k.dim, a = k.P.a, hi = k.P.hi, bad = k.tone('b')
      const X = x => X0 + x * SX
      const EZ = z => k.top + 270 - z * 90
      const PY = y => k.top + 480 + y * 320

      // elevation
      k.seed('elev'); k.shape(k.rect(X(0), EZ(CEIL), L * SX, CEIL * 90), { fill: k.tone('light'), op: .35, sw: 1.2 })
      k.seed('beam'); k.shape(k.rect(X(0), EZ(CEIL), L * SX, (CEIL - BEAM_Z) * 90), { fill: dim, op: .35, sw: .8 })
      k.seed('win'); k.shape(k.rect(X(RO0), EZ(HEAD), (RO1 - RO0) * SX, (HEAD - SILL) * 90), { fill: a, op: .3, sw: 1 })
      k.seed('desk'); k.shape(k.rect(X(DESK0), EZ(DESK_H), (DESK1 - DESK0) * SX, DESK_H * 90), { fill: k.tone('b'), op: .3, sw: .8 })

      // the cut, easing between heights
      const prev = i > 0 ? CUTS[i - 1] : CUTS[0]
      const z = k.thumb ? CUTS[i] : k.lerp(prev, CUTS[i], k.ease(k.p(i, 1.0, .1)))
      k.seed('cut' + i); k.line([[X(0) - 20, EZ(z)], [X(L) + 20, EZ(z)]], 2.2, hi)

      // plan: the true wall, dashed outside face
      k.seed('face'); k.line([[X(0), PY(0)], [X(L), PY(0)]], .6, dim)
      if (i >= 1) {
        const t = k.thumb ? 1 : (i === 1 ? k.ease(k.p(1, 1.2, .3)) : 1)
        for (let s = 0; s < 30; s++) {
          if (s / 30 > t) break
          k.seed('ext' + s); k.line([[X(s * 0.2), PY(T)], [X(s * 0.2 + 0.1), PY(T)]], 1.4, bad)
        }
      }

      // points sweep in along the wall
      const pts = sets[i]
      const sweep = k.thumb ? 1 : k.ease(k.p(i, 1.6, .5))
      for (const [x, y, kind] of pts) {
        if (x / L > sweep) continue
        const col = kind === 'f' ? a : kind === 'b' ? bad : ink
        k.flat(k.circle(X(x), PY(y), 4.2, 8), col, .9)
      }

      // dimension bars on the window step
      if (i === 2) {
        const d = k.thumb ? 1 : k.ease(k.p(2, 1, 1.6))
        k.push(); k.alpha(d)
        k.seed('dimro'); k.line([[X(RO0), PY(-0.22)], [X(RO1), PY(-0.22)]], 1.6, ink)
        k.seed('dimgl'); k.line([[X(RO0 + FR), PY(-0.36)], [X(RO1 - FR), PY(-0.36)]], 1.6, a)
        k.text(p.rough, X(RO1) + 24, PY(-0.22) + 10, { role: 'mono', size: 28, min: 16, maxW: 420, lines: 1, col: ink })
        k.text(p.glass, X(RO1) + 24, PY(-0.36) + 10, { role: 'mono', size: 28, min: 16, maxW: 420, lines: 1, col: a })
        k.pop()
      }

      const label = [p.face, p.thick, '', p.beam][i]
      if (label) k.text(label, X(0), k.top + 640, { role: 'label', size: 34, min: 18, maxW: 1100, lines: 2, col: i === 3 ? bad : ink })

      k.point = i === 1 ? [X(4.8), PY(T)] : i === 3 ? [X(3), PY(-BEAM_D)] : [X(3), PY(0)]
      k.mood = i === 3 ? 'thinking' : i === 1 ? 'surprised' : 'neutral'
    },
  }
})())
