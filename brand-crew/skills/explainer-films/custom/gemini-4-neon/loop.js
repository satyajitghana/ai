// gemini-4-neon / loop
//
// Why an agent's bill is mostly input. An agent works in steps; on every step it
// re-sends the whole conversation so far. Eight columns stand for eight steps:
// each column is what that step reads. The part it has read before comes from
// the cache (pale, cheap); the slice that is new this step is billed at the full
// input rate (solid); a small cap on top is what the step writes (output).
// Then the three parts are pulled out of the columns into three piles: the
// article's per-task split for Neon at xhigh, from Artificial Analysis.
// The step sizes come from a seeded PRNG, so the loop is a toy and the scene is
// stamped Illustrative. Every string drawn is the storyboard's.
//
// params: { cached, fresh, out, total }   pile labels and the total line
//         { bills: [full, cached, out] }  pile heights (geometry only)
// steps:  { focus? : 'cached' | 'fresh' | 'piles' }
BESPOKE.define((() => {
  const N = 8

  function sizes(k) {
    const r = k.rng('loop-sizes')
    const fresh = [], outs = []
    for (let i = 0; i < N; i++) {
      fresh.push(i === 0 ? 120 : 28 + r() * 34)
      outs.push(10 + r() * 12)
    }
    return { fresh, outs }
  }

  return {
    plan: (params, steps) => ({
      min: steps.map((_, i) => (i === 0 ? 5.2 : 4.2)),
      events: [
        { step: 0, at: .3, type: 'ticks', n: 8, span: 2.4 },
        { step: steps.length - 1, at: .4, type: 'ding' },
      ],
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 2.6 })),
    }),
    stampAt: k => [1250, k.top + 40],
    draw(k) {
      const p = k.params, i = k.step, s = k.s || {}
      const focus = s.focus || ''
      const { fresh, outs } = sizes(k)
      const base = 900, X0 = 170, DX = 92, BW = 58
      const scale = .62
      const PALE = k.P.light, SOLID = k.P.a, OUT = k.P.hi

      // how far the piles have been pulled out (last step)
      const pull = focus === 'piles' ? (k.thumb ? 1 : k.ease(k.p(i, 1.6, .2))) : 0

      // columns: each step reads everything before it (pale) plus its new slice
      let seen = 0
      const cols = []
      for (let c = 0; c < N; c++) {
        const grow = k.thumb || i > 0 ? 1 : k.easeOut(k.p(0, .5, .25 + c * .3))
        cols.push({ c, seen, fresh: fresh[c], out: outs[c], grow })
        seen += fresh[c] + outs[c]
      }

      k.push(); k.alpha(1 - pull)
      cols.forEach(col => {
        if (col.grow <= 0) return
        const x = X0 + col.c * DX
        const hSeen = col.seen * scale * col.grow
        const hNew = col.fresh * scale * col.grow
        const hOut = col.out * scale * col.grow
        const dimSeen = focus === 'fresh' ? .35 : 1
        const dimNew = focus === 'cached' ? .35 : 1
        if (hSeen > 0) {
          k.push(); k.alpha(dimSeen)
          k.seed(`seen${col.c}`); k.shape(k.rect(x, base - hSeen, BW, hSeen), { fill: PALE, op: .9, sw: .6 })
          k.pop()
        }
        k.push(); k.alpha(dimNew)
        k.seed(`new${col.c}`); k.shape(k.rect(x, base - hSeen - hNew, BW, hNew), { fill: SOLID, op: 1, sw: .8 })
        k.pop()
        k.seed(`out${col.c}`); k.shape(k.rect(x, base - hSeen - hNew - hOut, BW, hOut), { fill: OUT, op: 1, sw: .8 })
      })
      k.seed('floor'); k.line([[X0 - 30, base + 4], [X0 + N * DX, base + 4]], 1, k.ink)
      k.pop()

      // labels for the focus beats
      const lx = X0 + N * DX + 30
      if (focus === 'cached' || focus === '') {
        const t = k.thumb ? 1 : k.ease(k.p(i, .6, .4))
        k.push(); k.alpha(i === 0 ? t * .9 : t)
        k.text(p.cached, lx, base - 300, { role: 'label', size: 34, min: 18, maxW: 360, lines: 2, col: focus === 'cached' ? k.ink : k.dim })
        k.pop()
      }
      if (focus === 'fresh') {
        const t = k.thumb ? 1 : k.ease(k.p(i, .6, .4))
        k.push(); k.alpha(t)
        k.text(p.fresh, lx, base - 300, { role: 'label', size: 34, min: 18, maxW: 360, lines: 2 })
        k.pop()
      }

      // piles: the per-task split, pulled out of the columns
      if (pull > 0) {
        const bills = (p.bills || [1, 1, 1])
        const max = Math.max(...bills)
        const labels = [p.fresh, p.cached, p.out]
        const tones = [SOLID, PALE, OUT]
        const PX = 260, PDX = 330, PW = 170, PH = 430
        bills.forEach((b, j) => {
          const t = k.thumb ? 1 : k.ease(k.p(i, 1.0, .3 + j * .35))
          if (t <= 0) return
          const h = (b / max) * PH * t
          const x = PX + j * PDX
          k.seed(`pile${j}`); k.shape(k.rect(x, base - h, PW, h), { fill: tones[j], op: 1, sw: .9 })
          k.push(); k.alpha(t)
          k.text(labels[j], x - 20, base + 50, { role: 'label', size: 30, min: 16, maxW: PW + 80, lines: 2 })
          k.pop()
        })
        const tt = k.thumb ? 1 : k.ease(k.p(i, .8, 1.6))
        k.push(); k.alpha(tt)
        k.text(p.total, PX - 20, k.top + 60, { role: 'head', size: 44, min: 20, maxW: 1000, lines: 1 })
        k.pop()
        k.point = [PX + PW / 2, base - PH * .8]
      } else {
        k.point = focus === 'fresh' ? [X0 + 6 * DX, base - 420] : [X0 + 7 * DX, base - 250]
      }
      k.mood = focus === 'piles' ? 'excited' : focus === 'cached' ? 'surprised' : 'thinking'
    },
  }
})())
