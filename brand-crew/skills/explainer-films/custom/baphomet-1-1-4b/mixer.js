// baphomet-1-1-4b / mixer
//
// Task arithmetic as arrows. A dot is the base model; eight arrows leave it,
// one per parent, each the parent's change from the base (its task vector), so
// an arrow's tip is the parent itself. The search's seeds light up: each
// parent alone and the plain average. Then every arrow shrinks to its searched
// weight (the card's eight lambdas, used here only as lengths), and the scaled
// arrows chain head to tail into the merge. Directions are invented: eight
// arrows on a page stand in for near-orthogonal vectors in four billion
// dimensions, so the runtime stamps it Illustrative. Every label is a
// storyboard string.
//
// steps: 0 base and eight parents · 1 the seeds (one-hot, average) ·
//        2 each arrow scaled to its weight · 3 chained into the merge
// params: { base, parents[8], weights[8] (labels, '' to omit), average, merge, sum }
BESPOKE.define((() => {
  // the card's coefficients, as geometry only (never drawn as text)
  const LAM = [0.590, 0.297, 0.204, 0.032, 0.012, 0.003, 0.001, -0.001]
  // directions in degrees (0 = right, positive = down): invented, spread so labels clear
  const ANG = [-6, 6, -17, 17, -28, 28, -39, 39]
  const BX = 250, R = 520
  const rad = d => d * Math.PI / 180
  const dir = ANG.map(a => [Math.cos(rad(a)), Math.sin(rad(a))])

  return {
    stampAt: () => [1120, 915],
    plan: () => ({
      min: [4.2, 4.4, 4.6, 4.8],
      events: [{ step: 0, at: .2, type: 'ticks', n: 8, span: 1.6 }, { step: 1, at: .3, type: 'ticks', n: 9, span: 2.4 },
        { step: 2, at: .3, type: 'pop' }, { step: 3, at: .3, type: 'ticks', n: 8, span: 2.2 }, { step: 3, at: 2.8, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2.2 }, { step: 1, from: 0, to: 3.2 }, { step: 2, from: 0, to: 2 }, { step: 3, from: 0, to: 3.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const BY = Math.round((k.top + 930) / 2)
      const base = [BX, BY]
      const tip = j => [BX + dir[j][0] * R, BY + dir[j][1] * R]
      const pal = [k.P.a, k.P.b, k.P.hi, k.mix(k.P.a, k.ink, .4), k.mix(k.P.b, k.ink, .4), k.dim, k.dim, k.dim]
      const names = p.parents || []
      const wts = p.weights || []

      // scale: 1 until step 2, then each arrow eases to its lambda
      const sk = i < 2 ? 0 : k.thumb ? 1 : k.ease(k.p(2, 1.4, .2))
      const len = j => R * (1 + (LAM[j] - 1) * sk)
      // chain: from step 3, the scaled arrows travel head to tail
      const ck = i < 3 ? 0 : k.thumb ? 1 : k.p(3, 2.6, .2)
      const order = [0, 1, 2, 3, 4, 5, 6, 7]
      const starts = []
      let acc = [BX, BY]
      order.forEach(j => { starts[j] = acc.slice(); acc = [acc[0] + dir[j][0] * R * LAM[j], acc[1] + dir[j][1] * R * LAM[j]] })
      const merged = acc

      // the full-length ghosts stay once the arrows shrink
      if (i >= 2) order.forEach(j => {
        k.push(); k.alpha(.28); k.seed('ghost' + j); k.line([base, tip(j)], .6, k.dim); k.pop()
      })

      order.forEach((j, n) => {
        const grow = k.thumb || i > 0 ? 1 : k.easeOut(k.p(0, .7, .15 + n * .18))
        if (grow <= 0) return
        // where this arrow starts: the base, or its place in the chain
        const lag = Math.max(0, Math.min(1, ck * 1.6 - n * .08))
        const s0 = ck > 0 ? k.arc(base, starts[j], 40, k.ease(lag)) : base
        const L = len(j)
        const e = [s0[0] + dir[j][0] * L * grow, s0[1] + dir[j][1] * L * grow]
        const tiny = Math.abs(LAM[j]) < .05 && sk > .9
        k.seed('arrow' + j)
        if (tiny) k.flat(k.circle(e[0], e[1], 5, 10), pal[j], .9)
        else k.arrow([s0, e], pal[j], j < 3 ? 2.6 : 1.5, 1)
        // label at the full-length tip while the arrows are whole; at the scaled tip for the heavy three
        const la = k.thumb ? 1 : i === 0 ? k.p(0, .5, .4 + n * .18) : 1
        if (names[j] && i < 2) {
          const t = tip(j)
          // the labels step back while the average is named
          const back = i === 1 && !k.thumb ? 1 - .7 * k.clamp((k.p(1, 3, .1) - 8 / 9) * 9) : 1
          k.text(names[j], t[0] + 20, t[1] + 10, { role: 'label', size: 28, min: 14, maxW: 330, lines: 1, alpha: la * back })
        }
        if (i === 2 && wts[j]) {
          const w = k.thumb ? 1 : k.p(2, .5, 1.2)
          k.text(wts[j], e[0] + 16, e[1] + (j === 0 ? -14 : j === 1 ? 34 : -22), { role: 'mono', size: 32, min: 16, maxW: 200, lines: 1, alpha: w })
        }
      })

      // the base dot and its label
      k.seed('base'); k.flat(k.circle(BX, BY, 14, 16), k.ink, 1)
      if (p.base) {
        // left of the dot when it fits there, under it when the style's type is wide
        const bo = { role: 'label', size: 30, min: 14, maxW: 220, lines: 1 }
        const bw = k.measure(p.base, bo).w
        if (BX - 30 - bw >= 100) k.text(p.base, BX - 30, BY + 10, { ...bo, align: 'right' })
        else k.text(p.base, BX - bw / 2, BY + 56, bo)
      }

      // step 1: the seeds. A ring visits each parent's tip, then the average point
      if (i === 1) {
        const f = k.thumb ? 1 : k.p(1, 3, .1)
        const hop = Math.min(8, Math.floor(f * 9))
        if (hop < 8) {
          const t = tip(hop)
          k.seed('seed' + hop); k.line(k.circle(t[0], t[1], 26, 24), 1.2, k.P.hi, { closed: true })
        } else {
          const avg = [0, 0]
          order.forEach(j => { const t = tip(j); avg[0] += t[0] / 8; avg[1] += t[1] / 8 })
          k.seed('avg'); k.flat(k.circle(avg[0], avg[1], 9, 14), k.P.hi, 1)
          k.line(k.circle(avg[0], avg[1], 26, 24), 1.2, k.P.hi, { closed: true })
          if (p.average) {
            // named up and to the left of the fan, where no arrow runs, with a leader to the point
            const lx = BX - 150, ly = BY - 250
            const m = k.text(p.average, lx, ly, { role: 'label', size: 28, min: 14, maxW: 330, lines: 2 })
            k.seed('leader'); k.line([[lx + Math.min(m.w, 300) * .5, ly + m.h], [avg[0] - 18, avg[1] - 18]], .7, k.P.hi)
          }
        }
      }

      // step 3: the merge, where the chain ends
      if (i === 3) {
        const mk = k.thumb ? 1 : k.backOut(k.p(3, .6, 2.6))
        if (mk > 0) {
          k.seed('merge'); k.flat(k.circle(merged[0], merged[1], 13 * mk, 16), k.P.a, 1)
          k.line(k.circle(merged[0], merged[1], 34 * mk, 28), 1.4, k.ink, { closed: true })
          let my = merged[1] - 14
          if (p.merge) my += k.text(p.merge, merged[0] + 48, my, { role: 'head', size: 34, min: 16, maxW: 420, lines: 2, alpha: Math.min(1, mk) }).h + 6
          if (p.sum) k.text(p.sum, merged[0] + 48, my, { role: 'mono', size: 26, min: 14, maxW: 420, lines: 1, col: k.dim, alpha: Math.min(1, mk) })
        }
      }

      k.point = i === 3 ? merged : i === 1 ? [BX + R * .7, BY] : i === 2 ? [BX + R * .5, BY - 40] : [BX + R, BY]
      k.mood = i === 3 ? 'happy' : i === 1 ? 'thinking' : 'neutral'
    },
  }
})())
