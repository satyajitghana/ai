// agent-harness / prefix
//
// The token-flow widget's finding, painted: what each harness sends before any history (its first agent
// request), and what a whole run ends up sending (the median prompt tokens per run). Four rows, one per
// harness. Step "first": a short dark bar per harness, the first request, labelled. Step "total": a long
// pale bar grows behind it to the run's median total, labelled. Step "focus": one row is ringed.
// Bar lengths are the article's numbers (data: article); every string drawn is a storyboard string.
//
// params: { data: "article", rows: [{ label, first (number), firstText, total (number), totalText }],
//           firstKey, totalKey }
// steps:  { show: "first" | "total", ring?: row index }
BESPOKE.define((() => {
  return {
    plan: (params, steps) => ({
      min: steps.map(() => 4.0),
      events: steps.map((s, i) => (s.show === 'total' ? { step: i, at: .3, type: 'ticks', n: 6, span: 1.4 } : { step: i, at: .2, type: 'pop' })),
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 2.2 })),
    }),
    draw(k) {
      const p = k.params, s = k.s || {}, i = k.step
      const rows = p.rows
      const top = k.top + 40
      const X0 = 420, XMAX = 1360, ROW = 135
      const max = Math.max(...rows.map((r) => r.total))
      const scale = (XMAX - X0) / max
      const firstAt = steps => steps.findIndex((x) => x.show === 'first')
      const totalAt = k.steps.findIndex((x) => x.show === 'total')
      const showTotal = totalAt >= 0 && i >= totalAt

      // legend
      k.seed('legend-first')
      k.shape(k.rect(X0, top - 8, 34, 22), { fill: k.P.a, op: 1, sw: .7 })
      k.text(p.firstKey, X0 + 46, top + 12, { role: 'label', size: 24, min: 14, maxW: 380, lines: 1 })
      if (showTotal) {
        k.seed('legend-total')
        k.shape(k.rect(X0 + 470, top - 8, 34, 22), { fill: k.P.light, op: 1, sw: .7 })
        k.text(p.totalKey, X0 + 516, top + 12, { role: 'label', size: 24, min: 14, maxW: 420, lines: 1 })
      }

      rows.forEach((r, j) => {
        const y = top + 50 + j * ROW
        const inT = k.thumb ? 1 : k.easeOut(k.p(Math.max(0, firstAt(k.steps)), .7, .1 + j * .12))
        k.push(); k.alpha(inT)
        k.text(r.label, 120, y + 52, { role: 'head', size: 38, min: 18, maxW: 280, lines: 1 })
        k.pop()

        if (showTotal) {
          const g = k.thumb ? 1 : k.expoOut(k.p(totalAt, 1.6, .2 + j * .15))
          const w = Math.max(r.first * scale, r.total * scale * g)
          k.seed('total-' + j)
          k.shape(k.rect(X0, y, w, 74), { fill: k.P.light, op: .95, sw: .8 })
          const lt = k.thumb ? 1 : k.ease(k.p(totalAt, .5, 1.3 + j * .15))
          k.push(); k.alpha(lt)
          const tx = Math.min(X0 + w + 18, XMAX - 150)
          k.text(r.totalText, tx, y + 50, { role: 'mono', size: 30, min: 14, maxW: 180, lines: 1, col: k.ink })
          k.pop()
        }

        const fw = r.first * scale * (k.thumb ? 1 : k.easeOut(k.p(Math.max(0, firstAt(k.steps)), .9, .2 + j * .12)))
        k.seed('first-' + j)
        k.shape(k.rect(X0, y + 12, Math.max(fw, 6), 50), { fill: k.P.a, op: 1, sw: .8 })
        if (!showTotal) {
          k.text(r.firstText, X0 + Math.max(fw, 6) + 18, y + 50, { role: 'mono', size: 30, min: 14, maxW: 180, lines: 1 })
        }

        if (s.ring === j) {
          const rt = k.thumb ? 1 : k.ease(k.p(i, .8, .3))
          k.seed('ring-' + j)
          k.line(k.partial(k.rrect(100, y - 14, XMAX - 70, 102, 24), rt), 1.1, k.P.hi, { closed: rt >= 1 })
        }
      })

      const ringed = typeof s.ring === 'number' ? s.ring : 0
      k.point = [X0 + 40, top + 50 + ringed * ROW + 36]
      k.mood = showTotal ? 'surprised' : 'thinking'
    },
  }
})())
