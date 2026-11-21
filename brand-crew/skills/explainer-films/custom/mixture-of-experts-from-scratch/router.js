// mixture-of-experts-from-scratch / router
//
// One token through a Qwen3-style router, painted. 128 router probabilities rise as bars;
// the 8 tallest stay lit and the other 120 fade; the 8 travel along arcs into a panel on the
// right, where they are renormalised so they sum to one (each bar grows by the same factor);
// then the 8 weighted experts sum into the layer's output. The scores come from a seeded
// PRNG, so this is a simulation and is stamped Illustrative. Every string drawn is the
// storyboard's.
//
// steps:  0 scores · 1 keep the top 8 · 2 renormalise · 3 weighted sum
// params: { scores, kept, weights, out }
BESPOKE.define((() => {
  const E = 128, K = 8
  let cached = null
  function scores(k) {
    if (cached) return cached
    const r = k.rng('moe-router-scores')
    const logits = []
    for (let i = 0; i < E; i++) {
      const u = r(), v = r()
      logits.push((u + v + r() - 1.5) * 1.6 + (r() < .05 ? 2.6 : 0))
    }
    const m = Math.max(...logits)
    const ex = logits.map(x => Math.exp(x - m))
    const s = ex.reduce((a, b) => a + b, 0)
    const p = ex.map(x => x / s)
    const top = p.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, K).map(x => x[1]).sort((a, b) => a - b)
    const mass = top.reduce((a, i) => a + p[i], 0)
    cached = { p, top, mass, pmax: Math.max(...p) }
    return cached
  }
  return {
    plan: () => ({
      min: [3.6, 3.4, 4.4, 3.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 16, span: 1.4 }, { step: 1, at: .5, type: 'ding' }, { step: 3, at: .8, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2.0 }, { step: 1, from: 0, to: 1.4 }, { step: 2, from: 0, to: 2.8 }, { step: 3, from: 0, to: 2.2 }],
    }),
    stampAt: k => [600, k.top + 50],
    draw(k) {
      const P = k.params, i = k.step
      const S = scores(k)
      const top = k.top + 40
      const base = top + 520, H = 400
      const X0 = 140, X1 = 1000, bw = (X1 - X0) / E
      const panelX = 1060, pbw = 30, pgap = 4
      const kept = new Set(S.top)

      // axis
      k.seed('axis'); k.line([[X0 - 10, base], [X1 + 10, base]], 1.0, k.ink)
      k.text(P.scores, X0, base + 50, { role: 'label', size: 28, min: 16, maxW: 440, lines: 1 })

      const grow = k.thumb ? 1 : k.easeOut(k.p(0, 1.6, .1))
      const fade = k.thumb ? 1 : i >= 1 ? k.ease(k.p(1, .9, .2)) : 0
      const travel = k.thumb ? 1 : i >= 2 ? k.ease(k.p(2, 1.6, .2)) : 0
      const renorm = k.thumb ? 1 : i >= 2 ? k.ease(k.p(2, 1.0, 1.6)) : 0
      const sum = k.thumb ? 1 : i >= 3 ? k.ease(k.p(3, 1.2, .2)) : 0

      for (let e = 0; e < E; e++) {
        const h = (S.p[e] / S.pmax) * H * grow
        const x = X0 + e * bw
        const isTop = kept.has(e)
        if (isTop && travel > 0) continue
        const a = isTop ? 1 : 1 - .75 * fade
        k.push(); k.alpha(a)
        k.flat(k.rect(x + bw * .15, base - h, bw * .7, h), isTop && fade > 0 ? k.P.hi : k.P.a, isTop && fade > 0 ? 1 : .8)
        k.pop()
      }
      if (fade > 0) k.text(P.kept, X0 + 480, base + 50, { role: 'label', size: 28, min: 16, maxW: 380, lines: 1, col: k.P.hi, alpha: fade })

      // the 8 travel to the panel and are renormalised
      const scale = 1 / S.mass
      S.top.forEach((e, j) => {
        if (travel <= 0) return
        const h0 = (S.p[e] / S.pmax) * H
        const h1 = Math.min(H, S.p[e] * scale * 2 * H)  // the panel's full height is a weight of one half
        const from = [X0 + e * bw + bw / 2, base]
        const to = [panelX + j * (pbw + pgap) + pbw / 2, base]
        const at = k.arc(from, to, 160, travel)
        const w = k.lerp(bw * .7, pbw, travel)
        const h = k.lerp(h0, h1, renorm)
        k.seed('kept' + j); k.shape(k.rect(at[0] - w / 2, at[1] - h, w, h), { fill: k.P.hi, op: 1, sw: .8 })
      })
      if (renorm > 0) k.text(P.weights, panelX, top + 60, { role: 'label', size: 26, min: 14, maxW: 320, lines: 1, alpha: renorm })

      // weighted sum into the output
      if (sum > 0) {
        const ox = panelX + 4 * (pbw + pgap), oy = base + 150
        S.top.forEach((e, j) => {
          const sx = panelX + j * (pbw + pgap) + pbw / 2
          k.arrow([[sx, base + 8], [ox, oy - 34]], k.dim, .9, sum)
        })
        k.seed('outbox'); k.shape(k.rrect(ox - 120, oy - 30, 240, 64, 16), { fill: k.P.light, op: sum, sw: 1.0 })
        k.text(P.out, ox, oy + 12, { role: 'label', size: 26, min: 14, maxW: 230, lines: 1, align: 'center', alpha: sum })
      }

      k.point = i === 0 ? [X0 + 400, base - 200] : i === 1 ? [X0 + 600, top + 60] : [panelX + 120, base - 160]
      k.mood = i === 3 ? 'happy' : 'thinking'
    },
  }
})())
