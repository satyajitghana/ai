// multiset-vps-robotcar / ransac
//
// The article's PnpRansac widget, animated: a street seen from above, two rows of
// facade points (the map built on the overcast day), and a query camera. Each
// 2D-3D match is a ray from the camera: good matches end on the map point they
// claim, wrong ones point at nothing. RANSAC draws three rays, solves a pose, and
// counts which other rays agree. At night most rays are wrong, a bad triple wins
// and the pose lands in the wrong place; with learned features enough good rays
// come back and the pose lands again. Points, rays and offsets are a toy drawn
// from a seeded PRNG, so the runtime stamps it Illustrative; every label drawn
// is a storyboard string.
//
// steps: 0 the map · 1 a query's matches · 2 three rays, one pose, inliers ·
//        3 night: few good rays, a wrong pose · 4 learned features: the pose lands
// params: { map, truth, labels: [5 strings, one per step] }
BESPOKE.define((() => {
  let s = 23 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const NP = 20
  // facade points: x in 0..1 across the street, a small jitter off each facade line
  const north = Array.from({ length: NP }, (_, j) => [(j + .3 + rnd() * .4) / NP, (rnd() - .5) * 26])
  const south = Array.from({ length: NP }, (_, j) => [(j + .3 + rnd() * .4) / NP, (rnd() - .5) * 26])
  // ray sets per condition: [side, index] for good rays; [angle, length] for wrong ones
  const pickGood = n => {
    const out = [], used = new Set()
    while (out.length < n) {
      const side = rnd() < .5 ? 0 : 1, j = 6 + Math.floor(rnd() * (NP - 7))
      const key = side + ':' + j
      if (!used.has(key)) { used.add(key); out.push([side, j]) }
    }
    return out
  }
  const pickBad = n => Array.from({ length: n }, () => [(rnd() * 2 - 1) * .75, 260 + rnd() * 380])
  const DAY = { good: pickGood(12), bad: pickBad(3) }
  const NIGHT = { good: DAY.good.slice(0, 3), bad: pickBad(8) }
  const LEARN = { good: DAY.good.slice(0, 9), bad: NIGHT.bad.slice(0, 4) }
  const SETS = [null, DAY, DAY, NIGHT, LEARN]

  return {
    stampAt: k => [1240, k.top + 40],
    plan: () => ({
      min: [3.4, 3.8, 4.4, 4.2, 4],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .2, type: 'ticks', n: 15, span: 1.6 },
        { step: 2, at: 1.2, type: 'ding' }, { step: 3, at: .2, type: 'ticks', n: 11, span: 1.4 }, { step: 3, at: 2, type: 'thunk' },
        { step: 4, at: 1.6, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 2 }, { step: 2, from: 0, to: 2 }, { step: 3, from: 0, to: 2.6 }, { step: 4, from: 0, to: 2.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const X0 = 150, X1 = 1330
      const yN = k.top + 170, yS = 860, mid = (yN + yS) / 2
      const C = [370, mid + 30]
      const pt = (side, j) => {
        const q = side === 0 ? north[j] : south[j]
        return [X0 + 40 + q[0] * (X1 - X0 - 60), (side === 0 ? yN + 18 : yS - 18) + q[1]]
      }
      // the label for this step, above the street
      if (p.labels && p.labels[i]) k.text(p.labels[i], X0, k.top + 60, { role: 'head', size: 36, min: 20, maxW: 980, lines: 2 })
      // facades and the map's points
      k.seed('fN'); k.shape(k.rect(X0, yN - 40, X1 - X0, 40), { fill: k.tone('light'), op: .55, sw: .5 })
      k.seed('fS'); k.shape(k.rect(X0, yS, X1 - X0, 40), { fill: k.tone('light'), op: .55, sw: .5 })
      const mk = k.thumb ? 1 : i > 0 ? 1 : k.ease(k.p(0, 1.4, .2))
      for (let j = 0; j < NP; j++) {
        for (const side of [0, 1]) {
          const a = Math.max(0, Math.min(1, mk * 1.6 - j / NP * .6))
          if (a <= 0) continue
          const [x, y] = pt(side, j)
          k.push(); k.alpha(a); k.seed('mp' + side + j); k.shape(k.circle(x, y, 7, 10), { fill: k.ink, op: .8, sw: .5 }); k.pop()
        }
      }
      if (p.map && i === 0) k.text(p.map, X1 - 10, yS - 60, { role: 'mono', size: 24, min: 12, maxW: 600, lines: 1, col: k.dim, align: 'right' })
      // the camera's frustum, at a pose
      const frustum = (c, h, col, op, dash) => {
        const L = 120, a = .7
        const q = [c, [c[0] + L * Math.cos(h - a), c[1] + L * Math.sin(h - a)], [c[0] + L * Math.cos(h + a), c[1] + L * Math.sin(h + a)], c]
        if (dash) { k.seed('tru'); k.line(q, .8, k.dim, { dash: [10, 8] }) }
        else { k.seed('est' + i); k.shape(q, { fill: col, op, sw: 1 }) }
      }
      if (i === 0) { k.point = [X0 + 500, yN + 18]; k.mood = 'neutral'; return }
      // where the camera truly was: dashed, from step 1 on
      frustum(C, 0, null, 0, true)
      if (p.truth && i === 1) k.text(p.truth, C[0] - 40, C[1] + 110, { role: 'mono', size: 22, min: 11, maxW: 380, lines: 1, col: k.dim })
      // rays for this step's condition
      const set = SETS[i]
      const rk = k.thumb ? 1 : (i === 2 ? 1 : k.p(i, 1.6, .2))
      const tri = i === 2 || i === 4 ? [0, 1, 2] : []
      const pick = i === 2 ? (k.thumb ? 1 : k.ease(k.p(2, .8, .2))) : 0
      set.good.forEach(([side, j], n) => {
        const e = pt(side, j)
        const d = Math.max(0, Math.min(1, rk * 1.5 - n / set.good.length * .5))
        if (d <= 0) return
        const hot = tri.includes(n)
        k.seed('g' + i + ':' + n)
        k.line(k.partial([C, e], d), hot && pick > .5 ? 1.6 : .9, k.P.a)
      })
      set.bad.forEach(([ang, len], n) => {
        const d = Math.max(0, Math.min(1, rk * 1.5 - n / set.bad.length * .5))
        if (d <= 0) return
        const e = [C[0] + len * Math.cos(ang), C[1] + len * Math.sin(ang)]
        k.seed('b' + i + ':' + n)
        k.line(k.partial([C, e], d), .9, k.P.hi, { dash: [8, 7] })
      })
      // the estimate: lands on the truth (day, learned), or somewhere else (night)
      if (i >= 2) {
        const ek = k.thumb ? 1 : k.ease(k.p(i, 1, i === 2 ? 1 : 1.4))
        if (ek > 0) {
          const wrong = i === 3
          const c = wrong ? [C[0] + 170 * ek, C[1] - 120 * ek] : C
          const h = wrong ? .35 * ek : 0
          k.push(); k.alpha(ek); frustum(c, h, wrong ? k.P.hi : k.P.b, .55, false); k.pop()
          // inliers: the good rays this pose explains get a ring at their map point
          if (!wrong) {
            set.good.forEach(([side, j], n) => {
              const r = k.thumb ? 1 : k.easeOut(k.p(i, .4, (i === 2 ? 1.3 : 1.7) + n * .06))
              if (r <= 0) return
              const [x, y] = pt(side, j)
              k.seed('in' + i + ':' + n); k.line(k.circle(x, y, 15 * r, 14), 1, k.P.b, { closed: true })
            })
          }
        }
      }
      k.point = i === 3 ? [C[0] + 170, C[1] - 120] : C
      k.mood = i === 3 ? 'surprised' : i === 4 ? 'happy' : 'thinking'
    },
  }
})())
