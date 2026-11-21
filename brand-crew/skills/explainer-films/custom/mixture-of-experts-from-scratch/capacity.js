// mixture-of-experts-from-scratch / capacity
//
// Expert capacity and dropped tokens, painted. 32 tokens, each routed to one of 8 experts
// (top-1, as in Switch). Every expert is a column of slots; a step's `slots` says how many.
// Tokens fly along arcs into their expert's column in batch order; a token that finds its
// column full turns to the drop colour and slides along the residual lane on the right,
// skipping the layer. The assignments come from a seeded PRNG with a skew (`skew` per
// step, 0 = even), so the scene is stamped Illustrative. Every string drawn is the
// storyboard's.
//
// params: { experts, residual }
// steps:  { label, slots, skew }
BESPOKE.define((() => {
  const E = 8, T = 32
  const memo = {}
  function assign(k, i) {
    const key = 'cap' + i
    if (memo[key]) return memo[key]
    const s = k.steps[i] || {}
    const r = k.rng('moe-capacity-' + (s.skew || 0))
    const w = []
    for (let e = 0; e < E; e++) w.push(1 / Math.pow(e + 1, (s.skew || 0) * 1.6))
    const order = [5, 2, 7, 0, 3, 6, 1, 4]
    const sum = w.reduce((a, b) => a + b, 0)
    const out = []
    if (!(s.skew > 0)) {                       // even routing: every expert gets exactly T / E tokens
      for (let t = 0; t < T; t++) out.push(order[(t * 3) % E])
      memo[key] = out
      return out
    }
    for (let t = 0; t < T; t++) {
      let u = r() * sum, e = 0
      while (u > w[e] && e < E - 1) { u -= w[e]; e++ }
      out.push(order[e])
    }
    memo[key] = out
    return out
  }
  return {
    plan: (params, steps) => ({
      min: steps.map(() => 5.0),
      events: steps.map((_, i) => ({ step: i, at: .3, type: 'ticks', n: 16, span: 2.6 })),
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 3.6 })),
    }),
    stampAt: k => [1250, k.top + 30],
    draw(k) {
      const P = k.params, i = k.step, s = k.s || {}
      const slots = s.slots || 4
      const tok = assign(k, i)
      const top = k.top + 40
      const colW = 104, X0 = 170, slotH = 46, base = top + 520
      const lane = 1150
      const srcY = top + 20

      k.text(s.label || '', X0 - 30, top - 4, { role: 'head', size: 36, min: 18, maxW: 920, lines: 1 })
      k.text(P.experts, X0 - 30, base + 54, { role: 'label', size: 26, min: 14, maxW: 600, lines: 1 })

      // columns of slots
      for (let e = 0; e < E; e++) {
        const x = X0 + e * colW
        for (let j = 0; j < slots; j++) {
          k.seed('slot' + e + '_' + j)
          k.line(k.rect(x, base - (j + 1) * slotH, colW - 22, slotH - 6), .6, k.dim, { closed: true })
        }
      }
      // residual lane
      k.seed('lane'); k.line([[lane, top + 60], [lane, base]], 1.2, k.P.b)
      k.text(P.residual, lane + 20, top + 90, { role: 'label', size: 24, min: 14, maxW: 220, lines: 3, col: k.P.b })

      const fill = new Array(E).fill(0)
      let dropped = 0
      tok.forEach((e, t) => {
        const tt = k.thumb ? 1 : k.ease(k.p(i, .55, .15 + t * .085))
        if (tt <= 0) return
        const x = X0 + e * colW + (colW - 22) / 2
        const start = [X0 + (t % 16) * 56 + 20, srcY + Math.floor(t / 16) * 36]
        if (fill[e] < slots) {
          const y = base - fill[e] * slotH - slotH / 2 - 3
          fill[e]++
          const at = k.arc(start, [x, y], 80, tt)
          k.seed('tok' + t); k.shape(k.circle(at[0], at[1], 15), { fill: k.P.a, op: 1, sw: .7 })
        } else {
          const y = base - slots * slotH - 28
          const at = tt < .6 ? k.arc(start, [x, y], 80, tt / .6) : k.arc([x, y], [lane, top + 200 + dropped * 34], 40, (tt - .6) / .4)
          dropped++
          k.seed('drop' + t); k.shape(k.circle(at[0], at[1], 15), { fill: k.P.hi, op: 1, sw: .7 })
        }
      })
      k.point = dropped > 0 ? [lane, top + 220] : [X0 + 4 * colW, base - slots * slotH]
      k.mood = dropped > 2 ? 'surprised' : 'happy'
    },
  }
})())
