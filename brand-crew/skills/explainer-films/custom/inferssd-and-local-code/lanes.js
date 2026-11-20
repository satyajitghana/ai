// inferssd-and-local-code / lanes
//
// The article's PrefetchPipeline widget, painted: one decode layer of
// InferSSD's CPU sink on three lanes (GPU, SSD, CPU), built up one mechanism a
// step. Order of events from cpu-sink.cpp (role-major io_issue: every gate/up
// read before any down read), the RAM cache (hits need no read), and the
// decode prefetch (after a layer's own reads, read the next layer's predicted
// experts into its slots until its call starts). Durations are toy units, so
// the scene is stamped Illustrative. Every string drawn is the storyboard's.
//
// steps: 0 serial · 1 gate/up first · 2 RAM cache hits · 3 read ahead into the gap
// params: { gpu, ssd, cpu, attn, attn2, gu, dn, math, hit, guess, gap }
BESPOKE.define((() => {
  // [lane, start, end, kind]; kind: g gpu, u gate+up read, d down read, c cpu, h hit, p prefetch
  const S = [
    [[0,0,2,'g'],[1,2,3,'u'],[1,3,3.6,'d'],[1,3.6,4.6,'u'],[1,4.6,5.2,'d'],[1,5.2,6.2,'u'],[1,6.2,6.8,'d'],[1,6.8,7.8,'u'],[1,7.8,8.4,'d'],[2,8.4,11.2,'c'],[0,11.2,12,'g']],
    [[0,0,2,'g'],[1,2,3,'u'],[1,3,4,'u'],[1,4,5,'u'],[1,5,6,'u'],[1,6,6.6,'d'],[1,6.6,7.2,'d'],[1,7.2,7.8,'d'],[1,7.8,8.4,'d'],[2,3,3.4,'c'],[2,4,4.4,'c'],[2,5,5.4,'c'],[2,6,6.4,'c'],[2,6.6,6.9,'c'],[2,7.2,7.5,'c'],[2,7.8,8.1,'c'],[2,8.4,8.7,'c'],[0,8.7,10.7,'g']],
    [[0,0,2,'g'],[2,2,2.7,'h'],[2,2.7,3.4,'h'],[1,2,3,'u'],[1,3,4,'u'],[1,4,4.6,'d'],[1,4.6,5.2,'d'],[2,3.4,3.8,'c'],[2,4,4.4,'c'],[2,4.6,4.9,'c'],[2,5.2,5.5,'c'],[0,5.5,7.5,'g'],[1,7.5,8.5,'u'],[1,8.5,9.5,'u'],[1,9.5,10.1,'d'],[1,10.1,10.7,'d'],[2,8.5,8.9,'c'],[2,9.5,9.9,'c'],[2,10.1,10.4,'c'],[2,10.7,11,'c']],
    [[0,0,2,'g'],[2,2,2.7,'h'],[2,2.7,3.4,'h'],[1,2,3,'u'],[1,3,4,'u'],[1,4,4.6,'d'],[1,4.6,5.2,'d'],[2,3.4,3.8,'c'],[2,4,4.4,'c'],[2,4.6,4.9,'c'],[2,5.2,5.5,'c'],[0,5.5,7.5,'g'],[1,5.2,6.8,'p'],[1,6.8,8.4,'p'],[2,7.5,8.2,'h'],[2,8.4,9.1,'h']],
  ]
  const X0 = 300, W = 1040, T = 12, LY = [0, 1, 2]
  const x = t => X0 + (t / T) * W
  return {
    plan: () => ({
      min: [5.0, 5.0, 5.2, 5.6],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 8, span: 2.0 },
        { step: 1, at: .3, type: 'ticks', n: 8, span: 2.0 },
        { step: 2, at: .3, type: 'ding' },
        { step: 3, at: .6, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 2.6 }, { step: 1, from: 0, to: 2.6 }, { step: 2, from: 0, to: 2.6 }, { step: 3, from: 0, to: 2.6 }],
    }),
    stampAt: k => [1230, k.top + 10],
    draw(k) {
      const p = k.params, i = k.step
      const grow = k.thumb ? 1 : k.ease(k.p(i, 2.2, .2))
      const top = k.top + 60, LH = 190
      const col = { g: k.tone('light'), u: k.P.a, d: k.mix(k.P.a, k.paper, .65), c: k.P.b, h: k.mix(k.P.b, k.ink, .55), p: k.P.hi }
      const names = [p.gpu, p.ssd, p.cpu]
      LY.forEach(l => {
        const y = top + l * LH
        k.text(names[l], 120, y + 70, { role: 'head', size: 40, min: 18, maxW: 160, lines: 1 })
        k.seed('lane' + l); k.line([[X0 - 10, y + 130], [X0 + W + 10, y + 130]], .7, k.dim)
      })
      const now = grow * T
      S[i].forEach((b, n) => {
        const [l, s, e, kind] = b
        if (now <= s) return
        const ee = Math.min(e, now)
        const y = top + l * LH
        k.seed(`b${i}-${n}`)
        k.shape(k.rrect(x(s) + 3, y + 40, Math.max(4, x(ee) - x(s) - 6), 84, 10), { fill: col[kind], op: .92, sw: .7 })
      })
      // labels for the kinds, once per step, under the lanes
      const legend = [[p.gu, col.u], [p.dn, col.d], [p.math, col.c], [p.hit, col.h]].concat(i === 3 ? [[p.guess, col.p]] : [])
      let lx = X0
      const ly = top + 3 * LH + 20
      legend.forEach(([lab, c], n) => {
        k.seed('lg' + n); k.shape(k.rect(lx, ly - 22, 30, 30), { fill: c, op: .95, sw: .6 })
        const m = k.text(lab, lx + 42, ly, { role: 'label', size: 26, min: 14, maxW: 240, lines: 1 })
        lx += 42 + m.w + 40
      })
      if (i >= 2) {
        const gx = x(5.2), gw = x(7.5) - x(5.2), y = top + LH
        const a = k.thumb ? 1 : k.p(i, .8, 1.4)
        k.push(); k.alpha(a)
        k.seed('gap'); k.line(k.rrect(gx - 4, y + 30, gw + 8, 104, 12), 1.1, k.ink, { closed: true })
        k.text(p.gap, gx + gw / 2, y + 18, { role: 'label', size: 26, min: 14, maxW: 360, lines: 1, align: 'center', col: k.ink })
        k.pop()
      }
      k.point = i >= 2 ? [x(6.3), top + LH + 80] : [x(5), top + LH + 80]
      k.mood = i === 3 ? 'proud' : i === 0 ? 'thinking' : 'neutral'
    },
  }
})())
