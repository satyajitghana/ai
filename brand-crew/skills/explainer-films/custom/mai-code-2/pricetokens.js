// mai-code-2 / pricetokens
//
// The article's cost argument as rectangles: on DeepSWE 1.1, cost per task is
// price per token (width) times billed token volume (height). GPT-6.1 Sol is
// the unit rectangle. MAI Code 2 at the promo is a quarter as wide (every MAI
// price is a quarter of Sol's) and 2.04x as tall (0.618 / 1.212 / 0.25), so
// about half the area. At list price the width doubles and the areas meet.
// Dividing by the pass rate (74.6% Sol, 73.2% MAI) gives cost per resolved
// task, and MAI's rectangle ends up the larger one.
// Geometry is computed here from the article's numbers; every string drawn is
// the storyboard's.
//
// steps: 0 Sol's rectangle · 1 MAI at the promo · 2 MAI at list price ·
//        3 both divided by their pass rates
// params: { sol, mai, price, tokens, solCost, maiCost, maiList, quarter, more, list,
//           solRes, maiRes }
BESPOKE.define((() => {
  const W0 = 540, H0 = 185
  const MAI_W = 0.25, MAI_H = 0.618 / 1.212 / 0.25
  const PASS_SOL = 0.746, PASS_MAI = 0.732
  const BASE = 840
  const SX = 170, MX = 880

  return {
    plan: () => ({
      min: [4.0, 4.6, 4.4, 4.8],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 6, span: 1.2 },
        { step: 1, at: .4, type: 'slide' },
        { step: 2, at: .4, type: 'slide' },
        { step: 3, at: .4, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 1, from: 0, to: 1.8 }, { step: 2, from: 0, to: 1.6 }, { step: 3, from: 0, to: 1.8 }],
    }),
    stampAt: k => [1240, k.top + 30],
    draw(k) {
      const p = k.params, i = k.step
      const a = k.P.a, hi = k.P.hi, light = k.tone('light'), ink = k.ink

      // progress of each change
      const g0 = k.thumb || i > 0 ? 1 : k.ease(k.p(0, 1.2, .1))
      const g1 = k.thumb || i > 1 ? 1 : i === 1 ? k.ease(k.p(1, 1.4, .2)) : 0
      const gList = k.thumb || i > 2 ? 1 : i === 2 ? k.ease(k.p(2, 1.2, .3)) : 0
      const gRes = k.thumb || i > 3 ? 1 : i === 3 ? k.ease(k.p(3, 1.4, .3)) : 0

      const solH = H0 * k.lerp(1, 1 / PASS_SOL, gRes)
      const maiW = W0 * MAI_W * k.lerp(1, 2, gList)
      const maiH = H0 * MAI_H * k.lerp(1, 1 / PASS_MAI, gRes)

      // Sol rectangle grows up from the baseline
      const sh = solH * g0
      k.seed('sol' + Math.round(sh)); k.shape(k.rect(SX, BASE - sh, W0, sh), { fill: light, op: .9, sw: .8 })
      k.text(p.sol, SX + W0 / 2, BASE - sh - 22, { role: 'head', size: 34, min: 18, maxW: W0, lines: 1, align: 'center' })
      const solLabel = gRes > .5 ? p.solRes : p.solCost
      k.text(solLabel, SX + W0 / 2, BASE - sh / 2 + 10, { role: 'mono', size: 30, min: 15, maxW: W0 - 30, lines: 1, align: 'center', col: k.textOn(light) })

      // axis words under and beside Sol
      k.push(); k.alpha(g0)
      k.seed('pw'); k.arrow([[SX, BASE + 26], [SX + W0, BASE + 26]], k.dim, .7, 1)
      k.text(p.price, SX + W0 / 2, BASE + 66, { role: 'label', size: 26, min: 14, maxW: W0, lines: 1, align: 'center', col: ink })
      k.push(); k.translate(SX - 34, BASE - H0 / 2); k.rotate(-Math.PI / 2)
      k.text(p.tokens, 0, 8, { role: 'label', size: 24, min: 13, maxW: 260, lines: 1, align: 'center', col: ink })
      k.pop()
      k.seed('th'); k.arrow([[SX - 12, BASE], [SX - 12, BASE - H0]], k.dim, .7, 1)
      k.pop()

      // MAI rectangle
      if (g1 > 0) {
        const mh = maiH * g1
        const col = gList > 0 ? hi : a
        k.seed('mai' + Math.round(mh) + '_' + Math.round(maiW)); k.shape(k.rect(MX, BASE - mh, maiW, mh), { fill: col, op: .9, sw: .8 })
        k.text(p.mai, MX + maiW / 2, BASE - mh - 22, { role: 'head', size: 34, min: 18, maxW: 340, lines: 1, align: 'center' })
        const maiLabel = gRes > .5 ? p.maiRes : gList > .5 ? p.maiList : p.maiCost
        // label to the right of the narrow rectangle
        k.text(maiLabel, MX + maiW + 24, BASE - mh / 2 + 10, { role: 'mono', size: 30, min: 15, maxW: 1380 - (MX + maiW + 24), lines: 3 })
        if (i === 1 || (k.thumb && false)) {
          const al = k.ease(k.p(1, .8, 1))
          k.push(); k.alpha(al)
          k.text(p.quarter, MX + maiW / 2, BASE + 66, { role: 'label', size: 24, min: 13, maxW: 300, lines: 2, align: 'center', col: ink })
          k.text(p.more, MX + maiW + 24, BASE - mh + 30, { role: 'label', size: 24, min: 13, maxW: 300, lines: 1, col: ink })
          k.pop()
        }
        if (i >= 2 || k.thumb) {
          const al = k.thumb || i > 2 ? 1 : k.ease(k.p(2, .8, .8))
          k.push(); k.alpha(al)
          k.text(p.list, MX + maiW / 2 + 60, BASE + 66, { role: 'label', size: 24, min: 13, maxW: 420, lines: 2, align: 'center', col: ink })
          k.pop()
        }
      }

      k.point = i === 0 ? [SX + W0 / 2, BASE - H0 / 2] : [MX + maiW / 2, BASE - maiH * Math.max(g1, .01) / 2]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
