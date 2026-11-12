// open-robotics-mapping-roundup / floorstack
//
// The article's FloorGate widget, animated: a side view of two identical
// floors. Floor 1's height is the weighted mean of the stair transition
// (3.0 m, sigma 0.15 m) and every accepted cross-floor loop (0 m, sigma
// 0.05 m), so one false loop drops it to 0.30 m and many drop it onto floor 0;
// the floor gate removes the loops and it returns to 3.0 m. The heights are
// geometry computed here from that formula; every label drawn is a storyboard
// string. A one-number caricature, so the runtime stamps it Illustrative.
//
// steps: 0 the floors and the stairs · 1 one false loop · 2 many loops, collapse · 3 gate on
// params: { floor0, floor1, truth, labels: [4 strings, one per step] }
BESPOKE.define((() => {
  const SIG_T = 0.15, SIG_L = 0.05, TRUE_H = 3.0
  const height = n => (TRUE_H / (SIG_T * SIG_T)) / (1 / (SIG_T * SIG_T) + n / (SIG_L * SIG_L))
  const LOOPS = [0, 1, 9, 0] // loop lines drawn per step (geometry, not a count shown)
  const H = [height(0), height(1), height(35), height(0)]
  const X0 = 230, X1 = 1180, Y0 = 860, PXM = 150
  const zy = z => Y0 - z * PXM

  return {
    stampAt: [1240, 300],
    plan: () => ({
      min: [3, 3.4, 3.6, 3.4],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .4, type: 'thunk' }, { step: 2, at: .3, type: 'ticks', n: 9, span: 1.4 }, { step: 3, at: .4, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 1.6 }, { step: 2, from: 0, to: 2 }, { step: 3, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      // floor 1's height eases from the previous step's value to this one's
      const prev = i > 0 ? H[i - 1] : H[0]
      const e = k.thumb ? 1 : k.ease(k.p(i, 1.3, .3))
      const h = prev + (H[i] - prev) * e
      // the ground slab, floor 0
      k.seed('f0'); k.shape(k.rect(X0, Y0, X1 - X0, 26), { fill: k.ink, op: .8, sw: .8 })
      k.text(p.floor0 || '', X1, Y0 + 70, { role: 'mono', size: 28, col: k.dim, align: 'right' })
      // where floor 1 really is: a dashed outline
      k.seed('ghost'); k.line(k.rect(X0, zy(TRUE_H), X1 - X0, 26).concat([[X0, zy(TRUE_H)]]), .7, k.dim, { dash: [10, 8] })
      k.text(p.truth || '', X1, zy(TRUE_H) - 22, { role: 'mono', size: 26, col: k.dim, align: 'right' })
      // the stairs on the left, six treads up to the true height
      for (let s = 0; s < 6; s++) {
        const top = zy(((s + 1) * TRUE_H) / 6)
        k.seed('st' + s); k.shape(k.rect(X0 + 10 + s * 22, top, 22, Y0 - top), { fill: k.tone('light'), op: .5, sw: .5 })
      }
      // false loops: lines from the estimated floor down to floor 0
      const nL = LOOPS[i], lk = i === 3 ? 1 - k.p(3, .5) : 1
      for (let j = 0; j < nL; j++) {
        const x = X0 + 260 + j * 90
        const dk = k.thumb ? 1 : k.easeOut(k.p(i, .5, .2 + j * .12))
        if (dk <= 0 || lk <= 0) continue
        k.push(); k.alpha(lk)
        k.seed('loop' + j); k.line(k.partial([[x, zy(h) + 26], [x, Y0]], dk), 1.1, k.P.hi)
        k.pop()
      }
      // the estimated floor 1
      const fall = h < 2.5
      k.seed('f1' + i); k.shape(k.rect(X0, zy(h), X1 - X0, 26), { fill: fall ? k.P.hi : k.P.a, op: .9, sw: .9 })
      for (let j = 0; j < 9; j++) { k.seed('kf' + j); k.shape(k.circle(X0 + 260 + j * 90, zy(h) + 13, 9, 12), { fill: k.paper, op: 1, sw: .8 }) }
      k.text(p.floor1 || '', X0 + 170, zy(h) - 22, { role: 'mono', size: 28, col: k.ink })
      // what this step says, top right
      if (p.labels && p.labels[i]) k.text(p.labels[i], 1180, 330, { role: 'head', size: 40, min: 24, maxW: 620, lines: 2, align: 'right', col: k.ink })
      k.point = [X0 + 600, zy(h)]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'happy' : 'thinking'
    },
  }
})())
