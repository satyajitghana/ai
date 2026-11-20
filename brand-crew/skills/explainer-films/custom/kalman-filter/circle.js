// kalman-filter / circle
//
// The article's EskfStep widget, drawn: one heading update done three ways on a
// body that turns in the plane. A heading is a point on the unit circle, the
// 2-D cousin of the unit quaternion.
//   step 0  the prior heading and the truth the sensor will report
//   step 1  the classic EKF: a straight-line correction that leaves the circle
//           (|q| = 1.166), then the renormalisation back onto it
//   step 2  the ESKF: the correction as an angle, wrapped along the circle
//   step 3  the IEKF: passes that relinearise and march on to the answer
// Every angle and the norm come from params, which are the article's numbers
// (data: "article"); the in-between IEKF dots are geometry, never text.
//
// params: { data, prior, truth, norm, ekf, eskf, iekf, labels: { ... } }
BESPOKE.define((() => {
  const D = Math.PI / 180
  return {
    plan: () => ({
      min: [4.4, 6.2, 4.8, 5.6],
      events: [
        { step: 1, at: 1.4, type: 'ding' },
        { step: 2, at: 1.6, type: 'ding' },
        { step: 3, at: .4, type: 'ticks', n: 5, span: 2.6 },
      ],
      motion: [{ step: 1, from: 0, to: 4.2 }, { step: 2, from: 0, to: 2.4 }, { step: 3, from: 0, to: 3.4 }],
    }),
    stampAt: k => [1250, k.top + 20],
    draw(k) {
      const p = k.params
      const L = p.labels
      const i = k.thumb ? 3 : k.step
      const R = Math.min(290, (930 - k.top - 100) / 2)
      const CX = 520
      const CY = k.top + 70 + R
      const pt = (deg, r = 1) => [CX + R * r * Math.cos(deg * D), CY - R * r * Math.sin(deg * D)]
      const arcPts = (a0, a1, r = 1, n = 40) => {
        const out = []
        for (let j = 0; j <= n; j++) out.push(pt(a0 + (a1 - a0) * j / n, r))
        return out
      }
      const ink = k.ink, dim = k.dim
      const cEKF = k.P.b, cESKF = k.P.a, cIEKF = k.P.hi
      const dot = (key, x, y, r, col, a = 1) => { k.seed(key); k.flat(k.circle(x, y, r, 20), col, a); k.line(k.circle(x, y, r, 20), 1, ink, { closed: true }) }

      // axes and the circle of headings
      k.seed('ax'); k.line([[CX - R - 40, CY], [CX + R + 40, CY]], .5, dim)
      k.seed('ay'); k.line([[CX, CY - R - 40], [CX, CY + R + 40]], .5, dim)
      k.seed('circle'); k.line(k.circle(CX, CY, R, 96), 1.4, ink, { closed: true })

      // the truth, as a dashed spoke and a label
      const tIn = k.thumb ? 1 : k.ease(k.p(0, 1.0, .1))
      k.push(); k.alpha(tIn)
      const tEnd = pt(p.truth, 1.12)
      for (let j = 0; j < 14; j++) {
        const a = j / 14, b = (j + .55) / 14
        k.seed('ts' + j); k.line([[CX + (tEnd[0] - CX) * a, CY + (tEnd[1] - CY) * a], [CX + (tEnd[0] - CX) * b, CY + (tEnd[1] - CY) * b]], .9, dim)
      }
      k.pop()

      // the prior, a point with its arc of uncertainty
      const pr = pt(p.prior)
      k.seed('priorArc'); k.line(arcPts(p.prior - 40, p.prior + 40, 1.06), 6, k.mix(cESKF, k.paper, .45))
      dot('prior', pr[0], pr[1], 15, cESKF)
      k.text(L.prior, pr[0] + 34, pr[1] - 30, { role: 'label', size: 40, min: 18, maxW: 320, col: ink })

      // step 1: the EKF leaves the circle, then is pulled back on
      if (i >= 1) {
        const off = pt(p.ekf, p.norm)
        const go = k.thumb ? 1 : k.ease(k.p(1, 1.4, .2))
        const back = k.thumb ? 1 : k.ease(k.p(1, 1.0, 2.6))
        k.seed('ekfLine'); k.arrow([pr, off], cEKF, 1.6, go)
        const cur = [pr[0] + (off[0] - pr[0]) * go, pr[1] + (off[1] - pr[1]) * go]
        if (back < 1) dot('ekfDot', cur[0], cur[1], 14, cEKF)
        if (go > .9) k.text(L.norm, off[0] - 290, off[1] + 40, { role: 'mono', size: 36, min: 16, maxW: 280, col: ink, alpha: k.clamp((go - .9) * 10) })
        if (back > 0) {
          const on = pt(p.ekf)
          const q = [off[0] + (on[0] - off[0]) * back, off[1] + (on[1] - off[1]) * back]
          k.seed('ekfBack'); k.line([off, q], 1, cEKF)
          dot('ekfOn', q[0], q[1], 14, cEKF)
        }
        k.point = i === 1 ? off : k.point
      }

      // step 2: the ESKF moves along the circle
      if (i >= 2) {
        const g = k.thumb ? 1 : k.ease(k.p(2, 1.6, .2))
        const a = p.prior + (p.eskf - p.prior) * g
        k.seed('eskfArc'); k.line(arcPts(p.prior, a, .93), 2.4, cESKF)
        const e = pt(a, .93)
        dot('eskfDot', e[0], e[1], 14, cESKF)
        if (i === 2) k.point = e
      }

      // step 3: IEKF passes march on toward the truth
      if (i >= 3) {
        const passes = [p.eskf, p.eskf + (p.iekf - p.eskf) * .9, p.eskf + (p.iekf - p.eskf) * .99, p.iekf, p.iekf]
        for (let j = 0; j < passes.length; j++) {
          const s = k.thumb ? 1 : k.ease(k.p(3, .5, .3 + .55 * j))
          if (s <= 0) continue
          const q = pt(passes[j], .84)
          dot('pass' + j, q[0], q[1], j === passes.length - 1 ? 15 : 9, cIEKF, s)
        }
        k.point = pt(p.iekf, .84)
      }

      // the scoreboard on the right, filled in as each filter lands
      const X = 960
      let y = k.top + 110
      const rows = [
        { s: 0, t: L.truth, c: dim },
        { s: 1, t: L.ekf, c: cEKF },
        { s: 2, t: L.eskf, c: cESKF },
        { s: 3, t: L.iekf, c: cIEKF },
      ]
      for (const r of rows) {
        if (i < r.s) break
        const a = k.thumb || i > r.s ? 1 : k.ease(k.p(r.s, .8, r.s === 1 ? 3.2 : r.s === 0 ? 0 : 1.8))
        if (a > 0) {
          if (r.s > 0) dot('sw' + r.s, X + 14, y - 2, 15, r.c, a)
          const m = k.text(r.t, X + 40, y, { role: 'head', size: 50, min: 20, maxW: 420, col: r.s === 0 ? dim : ink, alpha: a })
          y += m.h + 34
        } else y += 70
      }
      if (i === 0) k.point = pr
      k.mood = i === 3 ? 'proud' : i === 1 ? 'surprised' : 'thinking'
    },
  }
})())
