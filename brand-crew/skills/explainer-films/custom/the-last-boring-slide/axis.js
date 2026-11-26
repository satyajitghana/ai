// the-last-boring-slide / axis
//
// The deck's time-horizon tower, then the same points with the axis swapped: METR's 50% time
// horizons (the deck's own values, which match METR's TH1.1 results file), drawn on a linear axis
// where everything before 2025 lies on the floor, then eased point by point onto a log axis where
// they fall near a straight line. Last beat: GPT-6 Astra's 95% interval from METR's appendix and
// the Opus 5.5 point the deck leaves out. Positions are computed from params.points (years and
// hours, geometry only); every string drawn is a storyboard string.
//
// steps: 0 linear axis, points arrive left to right, nearly all on the floor
//        1 Astra climbs; the dashed trend runs on to 200 h in July 2027
//        2 the axis morphs to log; the points straighten
//        3 Astra's interval and Opus 5.5
// params: { data: "article", heads[4], linear, log, points[{date, h, label?}], proj{date, h, label},
//           ci{lo, hi, label}, extra{date, h, label}, floor }
BESPOKE.define((() => {
  const X0 = 2022.9, X1 = 2027.8
  const LIN_MAX = 230
  const LOG_MIN = 0.03, LOG_MAX = 3000
  const l10 = v => Math.log(v) / Math.LN10
  // "Mar 2023" or "July 2027" -> a fractional year, mid-month (geometry only)
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const yearOf = s => {
    const [m, y] = String(s || '').trim().split(/\s+/)
    return Number(y) + (MON.indexOf(m.slice(0, 3).toLowerCase()) + .5) / 12
  }

  function geo(k) {
    const top = Math.max(k.top + 70, 250)
    return { L: 190, R: 1330, T: top + 40, B: 880 }
  }
  const xAt = (G, t) => G.L + ((t - X0) / (X1 - X0)) * (G.R - G.L)
  const yLin = (G, h) => G.B - (Math.min(h, LIN_MAX * 1.15) / LIN_MAX) * (G.B - G.T)
  const yLog = (G, h) => {
    const a = l10(LOG_MIN), b = l10(LOG_MAX)
    return G.B - ((l10(Math.max(h, LOG_MIN)) - a) / (b - a)) * (G.B - G.T)
  }

  return {
    plan: () => ({
      min: [4.2, 4.0, 4.6, 4.6],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 11, span: 1.6 },
        { step: 1, at: .4, type: 'whoosh' },
        { step: 2, at: .3, type: 'whoosh' }, { step: 2, at: 2.0, type: 'ding' },
        { step: 3, at: .5, type: 'pop' },
      ],
      motion: 'all',
    }),
    stampAt: k => [1180, geo(k).T - 10],
    draw(k) {
      const p = k.params, st = k.step, G = geo(k)
      const pts = p.points || []
      const astra = pts[pts.length - 1]
      // how far into the log axis we are (0 linear, 1 log)
      const m = k.thumb ? 1 : st < 2 ? 0 : st === 2 ? k.ease(k.clamp((k.since(2) - .4) / 2.2, 0, 1)) : 1
      const yOf = h => k.lerp(yLin(G, h), yLog(G, h), m)

      const head = (p.heads || [])[k.thumb ? 2 : st]
      if (head) k.text(head, G.L - 60, G.T - 46, { role: 'head', size: 34, min: 16, maxW: G.R - G.L + 60, lines: 1 })

      // axes
      k.seed('xaxis'); k.line([[G.L, G.B], [G.R, G.B]], 1.6, k.ink)
      k.seed('yaxis'); k.line([[G.L, G.T], [G.L, G.B]], 1.6, k.ink)
      const axisName = m < .5 ? p.linear : p.log
      if (axisName) {
        k.push(); k.alpha(Math.abs(m - .5) * 2)
        k.text(axisName, G.L + 16, G.T + 24, { role: 'label', size: 26, min: 12, maxW: 420, lines: 1, col: k.dim })
        k.pop()
      }
      // gridlines: linear thirds fade out, log decades fade in
      for (let i = 1; i <= 4; i++) {
        const y = G.B - (i / 4) * (G.B - G.T)
        k.push(); k.alpha((1 - m) * .5); k.seed('lg' + i); k.line([[G.L, y], [G.R, y]], .8, k.dim); k.pop()
      }
      for (let e = -1; e <= 3; e++) {
        const y = yLog(G, Math.pow(10, e))
        k.push(); k.alpha(m * .5); k.seed('dg' + e); k.line([[G.L, y], [G.R, y]], .8, k.dim); k.pop()
      }
      // the floor, on the linear axis
      if (p.floor && m < .6 && (k.thumb ? false : true)) {
        k.push(); k.alpha((1 - m / .6) * k.easeOut(k.p(0, .8, 2.2)))
        k.text(p.floor, G.L + 20, G.B - 26, { role: 'body', size: 24, min: 12, maxW: 560, lines: 1, col: k.dim })
        k.pop()
      }

      // points arrive left to right in step 0; Astra waits for step 1
      pts.forEach((q, i) => {
        const isAstra = i === pts.length - 1
        const arrive = k.thumb ? 1 : isAstra
          ? (st >= 1 ? k.easeOut(k.clamp((k.since(1) - .2) / 1.2, 0, 1)) : 0) * (st > 1 ? 1 : 1)
          : (st >= 1 ? 1 : k.easeOut(k.clamp((k.since(0) - .3 - i * .14) / .5, 0, 1)))
        if (arrive <= 0) return
        const x = xAt(G, yearOf(q.date))
        const yEnd = yOf(q.h)
        const y = isAstra && st === 1 && !k.thumb ? k.lerp(G.B, yEnd, arrive) : yEnd
        k.push(); k.alpha(Math.min(1, arrive * 1.4))
        k.seed('pt' + i); k.shape(k.circle(x, y, isAstra ? 13 : 9, 18), { fill: isAstra ? k.P.hi : k.P.a, op: .95, sw: 1, ink: k.ink })
        const showLabel = q.label && (m > .5 || q.h > 3 || isAstra)
        if (showLabel) k.text(q.label, x - 18, y - 22, { role: 'label', size: 22, min: 11, maxW: 300, lines: 1, align: 'right' })
        k.pop()
      })

      // the dashed trend to 200 h, from step 1
      if (p.proj && (st >= 1 || k.thumb)) {
        const t = k.thumb || st > 1 ? 1 : k.ease(k.clamp((k.since(1) - 1.2) / 1.4, 0, 1))
        if (t > 0) {
          const a = [xAt(G, yearOf(astra.date)), yOf(astra.h)], b = [xAt(G, yearOf(p.proj.date)), yOf(p.proj.h)]
          const n = 9
          for (let s = 0; s < n; s++) {
            const s0 = s / n, s1 = (s + .55) / n
            if (s0 > t) break
            const e = Math.min(s1, t)
            k.seed('dash' + s); k.line([[k.lerp(a[0], b[0], s0), k.lerp(a[1], b[1], s0)], [k.lerp(a[0], b[0], e), k.lerp(a[1], b[1], e)]], 1.6, k.dim)
          }
          if (t >= 1) {
            k.seed('proj'); k.line(k.circle(b[0], b[1], 9, 16), 1.4, k.ink, { closed: true })
            k.text(p.proj.label, b[0] - 16, b[1] - 20, { role: 'label', size: 22, min: 11, maxW: 340, lines: 1, align: 'right', col: k.dim })
          }
        }
      }

      // step 3: Astra's interval and the Opus 5.5 point
      if ((st === 3 || k.thumb) && p.ci) {
        const t = k.thumb ? 1 : k.ease(k.clamp((k.since(3) - .3) / 1.0, 0, 1))
        const x = xAt(G, yearOf(astra.date)) + 26
        const yLo = yOf(p.ci.lo), yHi = Math.max(G.T - 10, yOf(p.ci.hi))
        const yMid = yOf(astra.h)
        k.seed('ci'); k.line([[x, yMid], [x, k.lerp(yMid, yHi, t)]], 2.2, k.P.hi)
        k.seed('ci2'); k.line([[x, yMid], [x, k.lerp(yMid, yLo, t)]], 2.2, k.P.hi)
        if (t > .6) k.text(p.ci.label, x + 18, yHi + 26, { role: 'label', size: 22, min: 11, maxW: 300, lines: 1, col: k.P.hi })
        if (p.extra) {
          const ex = xAt(G, yearOf(p.extra.date)) + 44, ey = yOf(p.extra.h)
          const a2 = k.thumb ? 1 : k.easeOut(k.clamp((k.since(3) - 1.6) / .6, 0, 1))
          if (a2 > 0) {
            k.push(); k.alpha(a2)
            k.seed('extra'); k.shape(k.circle(ex, ey, 11, 18), { fill: k.P.b, op: .95, sw: 1, ink: k.ink })
            k.text(p.extra.label, ex + 20, ey + 40, { role: 'label', size: 22, min: 11, maxW: 300, lines: 1, col: k.ink })
            k.pop()
          }
        }
      }

      k.point = st === 0 ? [xAt(G, 2024.5), G.B - 20] : st === 1 ? [xAt(G, yearOf(astra.date)), yOf(astra.h)] : st === 2 ? [xAt(G, 2025.5), yOf(3)] : [xAt(G, yearOf(astra.date)) + 26, yOf(p.ci ? p.ci.hi : 100)]
      k.mood = st === 2 ? 'surprised' : st === 3 ? 'thinking' : 'neutral'
    },
  }
})())
