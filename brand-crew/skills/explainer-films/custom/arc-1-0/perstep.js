// arc-1-0 / perstep
//
// The article's argument in one picture: an agent run is a row of steps, and a
// router decides each one. Eight step cards from the clip's job (browse, read
// stats, plan the page, write the HTML, verify, summarise, open the file,
// report). Step 0: one small local model takes every card. Step 1: before each
// step the router predicts the local model's chance of success, drawn as a bar
// under the card, with the prefer-local threshold as a dashed line. Step 2:
// cards whose bar clears the line stay local (tone a); the two under it turn
// to the cloud tone and take the cloud label. Step 3: the cloud cards pulse
// and the tally appears: price enters only for those. The bar heights are a
// toy (geometry only, no number reaches the screen), so the runtime stamps it
// Illustrative. Every string drawn is a storyboard string.
//
// steps: 0 one model for all · 1 predicted success · 2 threshold split · 3 pay only there
// params: { cards: [8 strings], local, cloud, line, legend: [4 strings], tally }
BESPOKE.define((() => {
  const P = [.96, .78, .74, .92, .97, .88, .95, .93] // toy predicted local success per step
  const THR = .85
  const N = 8, CW = 132, GAP = 20, X0 = 150
  const cx = j => X0 + j * (CW + GAP) + CW / 2

  return {
    stampAt: k => [1270, Math.max(k.top + 40, 250) + 500],
    plan: () => ({
      min: [3.6, 4.2, 4.2, 3.8],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 8, span: 1.6 },
        { step: 1, at: .3, type: 'grow' },
        { step: 2, at: .4, type: 'thunk' },
        { step: 3, at: .5, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 2 }, { step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const top = Math.max(k.top + 40, 250)
      const CY = top, CH = 104
      const BASE = top + 430, BH = 250
      const barH = v => Math.max(6, ((v - .5) / .5) * BH)
      const thrY = BASE - barH(THR)
      const split = i >= 2 ? (k.thumb ? 1 : k.ease(k.p(2, 1, .3))) : 0

      // the step cards
      for (let j = 0; j < N; j++) {
        const appear = i > 0 || k.thumb ? 1 : k.ease(k.p(0, .5, .2 * j))
        if (appear <= 0) continue
        const x = X0 + j * (CW + GAP)
        const cloud = P[j] < THR
        const fill = cloud && split > .5 ? k.P.b : k.P.a
        k.push(); k.alpha(appear)
        k.seed('card' + j + (cloud && split > .5 ? 'c' : 'l'))
        k.shape(k.rrect(x, CY, CW, CH, 14), { fill, op: cloud && i === 3 ? .95 : .6, sw: .9 })
        if (p.cards && p.cards[j]) k.text(p.cards[j], x + CW / 2, CY + 26, { role: 'label', size: 22, min: 12, maxW: CW - 16, lines: 2, align: 'center', col: k.textOn(fill) })
        const tag = cloud && split > .5 ? p.cloud : p.local
        if (tag) k.text(tag, x + CW / 2, CY + CH - 26, { role: 'mono', size: 18, min: 10, maxW: CW - 16, lines: 1, align: 'center', col: k.textOn(fill), alpha: i === 0 ? .7 : 1 })
        k.pop()
      }

      // predicted success bars and the threshold
      if (i >= 1) {
        k.seed('base'); k.line([[X0 - 10, BASE], [X0 + N * (CW + GAP) - GAP + 10, BASE]], .8, k.ink)
        for (let j = 0; j < N; j++) {
          const g = i > 1 || k.thumb ? 1 : k.easeOut(k.p(1, .9, .12 * j))
          const h = barH(P[j]) * g
          const cloud = P[j] < THR
          const col = cloud && split > .5 ? k.P.b : k.P.a
          k.seed('bar' + j + ':' + Math.round(h / 8)); k.shape(k.rect(cx(j) - 26, BASE - h, 52, h), { fill: col, op: .85, sw: .7 })
        }
        const lt = i > 1 || k.thumb ? 1 : k.p(1, 1, 1.4)
        if (lt > 0) {
          const xs = X0 - 10, xe = xs + (N * (CW + GAP) - GAP + 20) * lt
          k.seed('thr'); k.line([[xs, thrY], [xe, thrY]], 1, k.P.hi, { dash: [14, 10] })
          if (p.line && lt > .9) k.text(p.line, X0 - 10, thrY - 34, { role: 'mono', size: 22, min: 12, maxW: 520, lines: 1, col: k.P.hi })
        }
      }

      // tally of the steps that pay
      if (i === 3 && p.tally) {
        const a = k.thumb ? 1 : k.p(3, .6, .5)
        k.text(p.tally, X0, BASE + 40, { role: 'head', size: 32, min: 16, maxW: 1000, lines: 1, alpha: a })
      }
      // legend for the beat
      const ly = i === 3 ? BASE + 96 : BASE + 40
      if (p.legend && p.legend[i]) k.text(p.legend[i], X0, ly, { role: 'body', size: 30, min: 16, maxW: 1000, lines: 2 })

      const focus = i === 0 ? Math.min(N - 1, Math.floor((k.thumb ? 1 : k.p(0, 1.6, .2)) * N)) : i === 1 ? 2 : 1
      k.point = i >= 2 ? [cx(1), CY + CH / 2] : i === 1 ? [cx(focus), BASE - barH(P[focus])] : [cx(focus), CY + CH / 2]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'happy' : 'thinking'
    },
  }
})())
