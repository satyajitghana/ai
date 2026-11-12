// meta-encoder / cosvote
//
// The article's DecideSoftmax widget, animated. A decision is a retrieval over a
// short corpus: the request and every option are embedded by the same network
// into unit vectors, drawn here as arrows on a circle (the real space has 6,656
// dimensions; two is a toy). Each option's cosine to the request is divided by
// the temperature 0.02 and pushed through a softmax. Then the temperature is
// raised: the bars flatten, the winner does not change. Angles are a toy, so
// params do not say "data": "article" and the scene is stamped Illustrative.
//
// steps: 0 request and options as unit vectors · 1 cosines, closest lit ·
//        2 divide by 0.02, softmax bars · 3 hotter temperature, same winner
// params: { query, options: [3 strings], legend: [4 strings], cold, hot }
BESPOKE.define((() => {
  // toy angles in degrees: the request, then three options
  const QA = 20, OA = [34, 128, 214]
  const rad = d => (d * Math.PI) / 180
  const cosv = OA.map(a => Math.cos(rad(a - QA)))
  const soft = tau => {
    const l = cosv.map(c => c / tau), m = Math.max(...l)
    const w = l.map(x => Math.exp(x - m)), z = w.reduce((a, b) => a + b, 0)
    return w.map(x => x / z)
  }
  const COLD = soft(0.02), HOT = soft(0.6)
  return {
    stampAt: k => [1250, Math.max(k.top + 40, 250) + 500],
    plan: () => ({
      min: [4.2, 4.0, 4.6, 4.8],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 4, span: 1.2 },
        { step: 1, at: .4, type: 'ding' },
        { step: 2, at: .3, type: 'whoosh' },
        { step: 3, at: .3, type: 'slide' },
      ],
      motion: [{ step: 0, from: 0, to: 1.8 }, { step: 2, from: 0, to: 1.6 }, { step: 3, from: 0, to: 2.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const opts = p.options || []
      const at = (st, d, delay) => (k.thumb ? 1 : k.p(st, d, delay))
      const TOP = Math.max(k.top + 40, 250)
      const CX = 400, CY = TOP + 300, R = 230
      const tip = (a, r) => [CX + r * Math.cos(rad(a)), CY - r * Math.sin(rad(a))]
      const colOpt = [k.P.b, k.mix(k.P.a, k.ink, .2), k.mix(k.P.light || k.P.b, k.ink, .45)]

      // the unit circle
      const ca = k.thumb ? 1 : k.easeOut(k.span(.05, .9))
      k.push(); k.alpha(ca)
      k.seed('unit'); k.line(k.circle(CX, CY, R, 72), .7, k.dim)
      k.pop()

      // options, then the request
      for (let j = 0; j < 3; j++) {
        const g = k.backOut(at(0, .6, .3 + j * .25))
        if (g <= 0) continue
        const lit = i >= 1 && j === 0
        const fade = i >= 1 && j !== 0 ? .45 : 1
        k.push(); k.alpha(fade)
        k.seed('opt' + j); k.arrow([[CX, CY], tip(OA[j], R * g)], colOpt[j], lit ? 1.4 : 1, 1)
        if (opts[j] && g > .6) {
          const [tx, ty] = tip(OA[j], R + 34)
          const m = k.measure(opts[j], { role: 'label', size: 26, min: 14, maxW: 220, lines: 1 })
          const ax = Math.cos(rad(OA[j])) < -.2 ? tx - m.w : Math.cos(rad(OA[j])) > .2 ? tx : tx - m.w / 2
          k.text(opts[j], ax, ty + 8, { role: 'label', size: 26, min: 14, maxW: 220, lines: 1, col: lit ? k.ink : k.dim })
        }
        k.pop()
      }
      const qg = k.backOut(at(0, .7, 1.2))
      if (qg > 0) {
        k.seed('query'); k.arrow([[CX, CY], tip(QA, R * qg)], k.P.hi, 1.6, 1)
        if (p.query && qg > .6) {
          const [tx, ty] = tip(QA, R + 30)
          k.text(p.query, tx + 6, ty + 14, { role: 'label', size: 26, min: 14, maxW: 170, lines: 2, col: k.ink })
        }
      }
      // step 1: the angle between the request and the closest option
      if (i >= 1) {
        const a = k.easeOut(at(1, .9, .2))
        const arc = []
        for (let s = 0; s <= 12; s++) arc.push(tip(QA + (OA[0] - QA) * (s / 12) * a, R * .45))
        k.seed('arc'); k.line(arc, 1.1, k.P.hi)
      }

      // steps 2-3: softmax bars, cold then hot
      const BX = 860, BW = 440, BH = 46, BY = TOP + 150
      if (i >= 2) {
        const show = k.easeOut(at(2, .8, .1))
        const mixT = i >= 3 ? k.easeOut(at(3, 1.6, .2)) : 0
        k.push(); k.alpha(show)
        for (let j = 0; j < 3; j++) {
          const y = BY + j * (BH + 34)
          const v = k.lerp(COLD[j], HOT[j], mixT)
          k.flat(k.rect(BX, y, BW, BH), k.mix(k.paper, k.dim, .18), 1)
          const w = Math.max(4, BW * v * show)
          k.seed('bar' + j); k.shape(k.rect(BX, y, w, BH), { fill: colOpt[j], op: .9, sw: .6 })
          if (opts[j]) k.text(opts[j], BX, y - 8, { role: 'label', size: 22, min: 12, maxW: BW, lines: 1, col: k.dim })
        }
        // the winner ring stays put
        k.seed('win'); k.line(k.rrect(BX - 10, BY - 10, BW + 20, BH + 20, 10), 1, k.P.hi)
        const tag = i >= 3 ? p.hot : p.cold
        if (tag) k.text(tag, BX, BY + 3 * (BH + 34) + 20, { role: 'mono', size: 26, min: 14, maxW: BW, lines: 1, col: k.ink })
        k.pop()
      }

      // legend for the beat
      const leg = p.legend && p.legend[i]
      if (leg && i < 2) k.text(leg, 860, TOP + 160, { role: 'head', size: 36, min: 18, maxW: 480, lines: 4 })
      if (leg && i >= 2) k.text(leg, 860, TOP + 30, { role: 'head', size: 30, min: 16, maxW: 480, lines: 2 })

      k.point = i < 2 ? tip(QA, R) : [BX + BW, BY + BH / 2]
      k.mood = i === 3 ? 'happy' : i === 1 ? 'thinking' : 'neutral'
    },
  }
})())
