// open-models-roundup-nov-20 / loop
//
// SenseNova-Loop-9B's execution plan (modeling_sensenova_loop.py, execution_plan):
// layers 0-3 once, layers 4-27 twice, layers 28-31 once. Every fourth layer is full
// attention and every execution keeps its own KV slot. The numbers are the article's
// (32 stored, 4 and 28 the loop's edges, 2 passes, 32 / 56 / 64 KiB per token).
// Every string drawn is the storyboard's.
//
// steps: 0 the stored layers · 1 the schedule runs · 2 two streams per pass · 3 the cache bill
// params: { data, stored, start, end, passes, kv: [3 numbers], text: { stored, executed, streams, kv }, kvRows: [3 strings] }
BESPOKE.define((() => {
  const X0 = 120, X1 = 1370
  const full = i => i % 4 === 3
  function plan(p) {
    const out = []
    for (let i = 0; i < p.start; i++) out.push({ L: i, pass: -1 })
    for (let r = 0; r < p.passes; r++) for (let i = p.start; i < p.end; i++) out.push({ L: i, pass: r })
    for (let i = p.end; i < p.stored; i++) out.push({ L: i, pass: -1 })
    return out
  }
  return {
    plan: () => ({
      min: [3.6, 5.2, 5.0, 5.6],
      events: [{ step: 1, at: .3, type: 'ticks', n: 14, span: 2.6 }, { step: 3, at: 1.2, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 3.4 }, { step: 2, from: 0, to: 2.6 }, { step: 3, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, T = p.text
      const top = k.top + 20
      const ex = plan(p)

      // row 1: the stored layers
      const sw = (X1 - X0) / p.stored
      const g0 = k.thumb ? 1 : k.ease(k.p(0, 1.4, .1))
      for (let L = 0; L < p.stored; L++) {
        if (L / p.stored > g0) break
        const looped = L >= p.start && L < p.end
        k.seed('s' + L)
        k.shape(k.rect(X0 + L * sw + 3, top + 70, sw - 6, full(L) ? 70 : 50), {
          fill: looped ? k.P.a : k.dim, op: looped ? .7 : .35, sw: full(L) ? 1.4 : .6,
        })
      }
      k.text(T.stored, X0, top + 20, { role: 'head', size: 38, min: 20, maxW: 900, lines: 1 })

      // row 2: the executions, in order
      const ey = top + 250
      const ew = (X1 - X0) / ex.length
      if (i >= 1) {
        const g1 = k.thumb ? 1 : k.p(1, 3.2, .2)
        const shown = Math.floor(g1 * ex.length + .001)
        for (let n = 0; n < Math.min(shown, ex.length); n++) {
          const e = ex[n]
          const col = e.pass < 0 ? k.dim : e.pass === 0 ? k.P.a : k.P.b
          k.seed('e' + n)
          k.shape(k.rect(X0 + n * ew + 1.5, ey, ew - 3, full(e.L) ? 70 : 44), { fill: col, op: e.pass < 0 ? .4 : .8, sw: .5 })
        }
        if (shown < ex.length && !k.thumb) {
          // the cursor running along the schedule, and a thin line back up to the stored layer it reuses
          const e = ex[shown]
          const cx = X0 + shown * ew + ew / 2
          k.seed('cur'); k.line([[X0 + e.L * sw + sw / 2, top + 145], [cx, ey - 6]], .8, k.P.hi)
        }
        k.text(T.executed, X0, ey - 50, { role: 'head', size: 38, min: 20, maxW: 900, lines: 1, alpha: k.thumb ? 1 : Math.min(1, g1 * 1.5) })
      }

      // row 3: the two streams, split at the loop's first layer, averaged at its last, on every pass
      const sy = ey + 130
      if (i >= 2) {
        const g2 = k.thumb ? 1 : k.ease(k.p(2, 2.0, .2))
        for (let r = 0; r < p.passes; r++) {
          const a = X0 + (p.start + r * (p.end - p.start)) * ew
          const b = X0 + (p.start + (r + 1) * (p.end - p.start)) * ew
          const col = r === 0 ? k.P.a : k.P.b
          const up = [[a, sy], [a + 30, sy - 16], [b - 30, sy - 16], [b, sy]]
          const dn = [[a, sy], [a + 30, sy + 16], [b - 30, sy + 16], [b, sy]]
          k.seed('su' + r); k.line(k.partial(k.through(up), g2), 1.6, col)
          k.seed('sd' + r); k.line(k.partial(k.through(dn), g2), 1.6, col)
        }
        k.seed('sl0'); k.line([[X0, sy], [X0 + p.start * ew, sy]], 1.6, k.ink)
        k.seed('sl1'); k.line([[X0 + (p.start + p.passes * (p.end - p.start)) * ew, sy], [X1, sy]], 1.6, k.ink)
        k.text(T.streams, X0, sy + 44, { role: 'body', size: 30, min: 18, maxW: 1200, lines: 1, alpha: g2 })
      }

      // the cache bill: three bars, KV per token
      if (i >= 3) {
        const by = sy + 140
        const max = Math.max(...p.kv)
        k.text(T.kv, X0, by, { role: 'label', size: 28, min: 16, maxW: 400, lines: 1 })
        p.kv.forEach((v, n) => {
          const g = k.thumb ? 1 : k.ease(k.p(3, 1.0, .2 + n * .35))
          const y = by + 40 + n * 56
          const w = (v / max) * 560 * g
          k.seed('kv' + n)
          if (w > 2) k.shape(k.rect(X0 + 430, y, w, 36), { fill: n === 1 ? k.P.hi : k.dim, op: n === 1 ? .85 : .45, sw: .8 })
          k.text(p.kvRows[n], X0, y + 4, { role: 'mono', size: 26, min: 14, maxW: 410, lines: 1, col: n === 1 ? k.ink : k.dim })
        })
        k.point = [X0 + 430 + (p.kv[1] / max) * 560, by + 40 + 56 + 18]
      } else if (i === 2) {
        k.point = [X0 + (p.start + (p.end - p.start)) * ew, sy]
      } else if (i === 1) {
        k.point = [X0 + (ex.length * .6) * ew, ey + 20]
      } else {
        k.point = [X0 + ((p.start + p.end) / 2) * sw, top + 100]
      }
      k.mood = i === 3 ? 'surprised' : 'neutral'
    },
  }
})())
