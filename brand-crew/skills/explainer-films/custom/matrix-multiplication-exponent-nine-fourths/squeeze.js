// matrix-multiplication-exponent-nine-fourths / squeeze
//
// The article's BoundsSqueeze as a moving picture: both bounds on ω, 1969 to 2026.
// Four beats:
//   0  the upper bound steps down: Strassen, Schönhage, Coppersmith–Winograd (1969 to 1990)
//   1  thirty-six years of hundredths: the stair crawls to 2.371177
//   2  October: the drop to 9/4
//   3  the lower bound, flat at 2 all along, jumps to 9/4; the gap closes
// The geometry is the article's numbers (params.upper, params.lower: [year, ω]); every drawn
// string comes from params. "data": "article" in the storyboard, so no Illustrative stamp.
//
// params: { data, heads: [4], upper: [[y, w]...], lower: [[y, w]...], ticks: [strings],
//           tickValues: [numbers], years: [strings], yearValues: [numbers],
//           upperLabel, lowerLabel, claimLabel, gapLabel }
BESPOKE.define((() => {
  const Y0 = 1966, Y1 = 2029, W0 = 1.95, W1 = 2.9
  return {
    plan: () => ({
      min: [5.2, 4.2, 4.4, 5.4],
      events: [{ step: 0, at: .4, type: 'ticks', n: 3, span: 3.2 }, { step: 2, at: .6, type: 'whoosh' },
        { step: 3, at: 1.0, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 230, X1 = 1330
      const TOP = Math.max(k.top + 90, 250), BOT = 900
      const sx = y => X0 + (y - Y0) / (Y1 - Y0) * (X1 - X0)
      const sy = w => TOP + (W1 - w) / (W1 - W0) * (BOT - TOP)
      const head = (p.heads || [])[st]
      if (head) k.text(head, 140, TOP - 60, { role: 'head', size: 34, min: 16, maxW: 1200, lines: 1,
        alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // axes
      k.seed('axis-y'); k.line([[X0, TOP - 10], [X0, BOT]], 1.6, k.dim)
      k.seed('axis-x'); k.line([[X0, BOT], [X1, BOT]], 1.6, k.dim)
      ;(p.tickValues || []).forEach((v, i) => {
        const y = sy(v)
        k.seed('tick' + i); k.line([[X0 - 10, y], [X0, y]], 1.2, k.dim)
        if (p.ticks && p.ticks[i]) k.text(p.ticks[i], X0 - 20, y + 9, { role: 'mono', size: 24, min: 12, maxW: 110, lines: 1, align: 'right', col: k.dim })
      })
      ;(p.yearValues || []).forEach((v, i) => {
        if (p.years && p.years[i]) k.text(p.years[i], sx(v), BOT + 38, { role: 'mono', size: 22, min: 11, maxW: 120, lines: 1, align: 'center', col: k.dim })
      })

      // upper bound as a stair; how much of it is drawn depends on the beat
      const U = p.upper || []
      const upto = [3, U.length - 1, U.length, U.length][st] // points shown at the end of each beat
      const from = [0, 3, U.length - 1, U.length][st]
      const prog = k.thumb ? 1 : k.ease(k.p(st, st === 0 ? 3.2 : 2.0, .3))
      const nShow = k.thumb ? U.length : (st === 0 ? 0 : from) + (upto - (st === 0 ? 0 : from)) * prog
      const stair = [[sx(Y0), sy(3)]]
      for (let i = 0; i < U.length; i++) {
        if (i + 1 > nShow + 1e-6) {
          // partial step towards point i
          const f = Math.max(0, nShow - i)
          if (f > 0) {
            const [y, w] = U[i], prev = stair[stair.length - 1]
            const hx = k.lerp(prev[0], sx(y), Math.min(1, f * 2))
            stair.push([hx, prev[1]])
            if (f > .5) stair.push([hx, k.lerp(prev[1], sy(w), (f - .5) * 2)])
          }
          break
        }
        const [y, w] = U[i], prev = stair[stair.length - 1]
        stair.push([sx(y), prev[1]]); stair.push([sx(y), sy(w)])
      }
      k.seed('upper' + st); k.line(stair, 3.2, k.P.a)
      const tip = stair[stair.length - 1]
      for (let i = 0; i < Math.min(U.length, Math.floor(nShow + 1e-6)); i++) {
        k.flat(k.circle(sx(U[i][0]), sy(U[i][1]), 7), k.P.a, 1)
      }
      if (p.upperLabel) k.text(p.upperLabel, Math.min(tip[0] + 16, X1 - 220), tip[1] - 16, { role: 'label', size: 24, min: 12, maxW: 260, lines: 1, col: k.P.a })

      // lower bound: flat at 2, then the claimed jump
      const L = p.lower || []
      if (L.length >= 2) {
        const flatEnd = sx(L[1][0])
        const lp = [[sx(L[0][0]), sy(L[0][1])], [flatEnd, sy(L[1][1])]]
        if (st >= 3 || k.thumb) {
          const j = k.thumb ? 1 : k.backOut(k.p(3, 1.4, .8))
          const top = L[2] ? L[2][1] : 2.25
          lp.push([flatEnd, k.lerp(sy(L[1][1]), sy(top), j)])
          lp.push([sx(Y1 - .5), k.lerp(sy(L[1][1]), sy(top), j)])
          if (j > .9 && p.claimLabel) k.text(p.claimLabel, sx(Y1) - 30, sy(top) + 44, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, align: 'right', col: k.P.hi })
          if (j > .95 && p.gapLabel) {
            k.text(p.gapLabel, sx(1995), sy(2.6), { role: 'head', size: 34, min: 16, maxW: 520, lines: 1, align: 'center', col: k.P.hi,
              alpha: k.thumb ? 1 : k.easeOut(k.p(3, .8, 2.0)) })
          }
        } else {
          lp.push([sx(Y1 - .5), sy(L[1][1])])
        }
        k.seed('lower' + (st >= 3 ? 'j' : '')); k.line(lp, 3.2, k.P.b)
        if (p.lowerLabel) k.text(p.lowerLabel, sx(1972), sy(2) - 18, { role: 'label', size: 24, min: 12, maxW: 600, lines: 1, col: k.P.b })
      }

      k.point = st >= 3 ? [sx(2020), sy(2.2)] : tip
      k.mood = st === 3 ? 'surprised' : st === 2 ? 'excited' : 'thinking'
    },
  }
})())
