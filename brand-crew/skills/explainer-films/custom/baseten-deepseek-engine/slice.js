// baseten-deepseek-engine / slice
//
// How deepseek-ultrafast spreads a MoE layer over four GPUs at batch 1, from
// the article's "Experts are sliced, not dispatched" section and StepWalk.
//   step 0  one row picks 6 of the 384 experts (six squares)
//   step 1  expert parallelism: each expert flies whole to the GPU that owns
//           it; the loads come out uneven (a toy owner map), with all-to-all
//           lines crossing between the row and the lanes
//   step 2  what the engine does: every expert splits into four column
//           strips and each GPU takes one strip of every expert; even bars
//   step 3  the all-reduce as stores: each lane writes its partial into every
//           other lane (arrows on the right)
// The owner map is a toy, so the scene is stamped Illustrative.
//
// params: { pick, dispatch, slice, push, gpu }  (all screen text)
BESPOKE.define((() => {
  const NE = 6
  const OWNER = [0, 0, 2, 2, 2, 3] // toy: which GPU owns each picked expert
  const LOAD = [0, 0, 0, 0]
  const SLOT = OWNER.map(o => LOAD[o]++)
  const SQ = 96, GAP = 54
  const EX0 = 745 - (NE * SQ + (NE - 1) * GAP) / 2
  const LX0 = 300, LX1 = 1330, LH = 74, LG = 22
  const CELL = 150

  return {
    plan: () => ({
      min: [3.6, 4.6, 4.8, 4.4],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 6, span: .9 },
        { step: 1, at: .3, type: 'whoosh' },
        { step: 2, at: .3, type: 'whoosh' },
        { step: 3, at: .5, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 2.0 }, { step: 2, from: 0, to: 2.2 }, { step: 3, from: 0, to: 1.6 }],
    }),
    stampAt: k => [1250, k.top + 4],
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 20
      const EY = top + 10
      const LY0 = top + 210
      const laneY = g => LY0 + g * (LH + LG)
      const A = k.P.a, HI = k.P.hi, B = k.tone('b'), L = k.tone('light')
      const pr = k.thumb ? 1 : k.ease(k.p(i, 1.6, .2))
      const exX = e => EX0 + e * (SQ + GAP)

      // the four GPU lanes
      for (let g = 0; g < 4; g++) {
        const y = laneY(g)
        k.text(p.gpu, LX0 - 40, y + LH / 2 + 10, { role: 'label', size: 26, min: 14, maxW: 150, lines: 1, align: 'right', col: k.dim })
        k.seed('lane' + g); k.line(k.rect(LX0, y, LX1 - LX0, LH), .7, k.dim, { closed: true })
      }

      // the picked experts, at the top, before they move
      const homeAlpha = i === 0 ? 1 : 0.28
      for (let e = 0; e < NE; e++) {
        const x = exX(e)
        const t0 = k.thumb ? 1 : k.clamp(k.p(0, .9, e * .12) * 1.2, 0, 1)
        k.push(); k.alpha(homeAlpha * (i === 0 ? t0 : 1))
        k.seed('ex' + e); k.shape(k.rect(x, EY, SQ, SQ), { fill: e % 2 ? B : A, op: .9, sw: .8 })
        k.pop()
      }

      let legend = p.pick
      if (i === 0) {
        k.point = [exX(NE - 1) + SQ, EY + SQ / 2]; k.mood = 'neutral'
      }

      if (i === 1) {
        legend = p.dispatch
        for (let e = 0; e < NE; e++) {
          const g = OWNER[e]
          const tx = LX0 + 20 + SLOT[e] * (CELL + 10), ty = laneY(g) + (LH - 60) / 2
          const te = k.clamp(pr * 1.25 - e * .05, 0, 1)
          const from = [exX(e) + SQ / 2, EY + SQ]
          const to = [tx + CELL / 2, ty]
          k.seed('route' + e)
          k.line(k.partial(k.through([from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 30], to]), te), .5, k.dim)
          const pos = k.arc([exX(e), EY], [tx, ty], 50, te)
          const w = k.lerp(SQ, CELL, te), h = k.lerp(SQ, 60, te)
          k.seed('exm' + e); k.shape(k.rect(pos[0], pos[1], w, h), { fill: e % 2 ? B : A, op: .9, sw: .8 })
        }
        // idle lane: mark it
        const idle = LOAD.indexOf(0)
        if (idle >= 0 && pr > .8) { k.seed('idle'); k.hl(LX0 + 10, laneY(idle) + 10, 220, LH - 20, L, k.clamp((pr - .8) * 5, 0, 1)) }
        k.point = [LX0 + 3 * (CELL + 10), laneY(2) + LH / 2]; k.mood = 'surprised'
      }

      if (i >= 2) {
        legend = i === 2 ? p.slice : p.push
        const sw = SQ / 4
        for (let e = 0; e < NE; e++) {
          for (let g = 0; g < 4; g++) {
            const tx = LX0 + 20 + e * (sw * 2 + 50), ty = laneY(g) + (LH - 60) / 2
            const te = i === 2 ? k.clamp(pr * 1.3 - e * .04 - g * .03, 0, 1) : 1
            const pos = k.arc([exX(e) + g * sw, EY], [tx, ty], 40 + g * 10, te)
            const w = k.lerp(sw - 3, sw * 2, te), h = k.lerp(SQ, 60, te)
            k.seed('st' + e + '-' + g); k.shape(k.rect(pos[0], pos[1], w, h), { fill: e % 2 ? B : A, op: .9, sw: .6 })
          }
        }
        if (i === 2) { k.point = [LX0 + 6 * (sw * 2 + 50), laneY(1) + LH / 2]; k.mood = 'proud' }
      }

      if (i === 3) {
        // every lane stores its partial sum into every other lane
        const XA = LX1 - 150
        let n = 0
        for (let a = 0; a < 4; a++) {
          for (let b = 0; b < 4; b++) {
            if (a === b) continue
            const ta = k.clamp(pr * 1.4 - n * .04, 0, 1); n++
            const ya = laneY(a) + LH / 2, yb = laneY(b) + LH / 2
            const bend = XA + 40 + Math.abs(a - b) * 22
            k.seed('push' + a + b)
            k.arrow(k.through([[XA, ya], [bend, (ya + yb) / 2], [XA + 6, yb]]), HI, .8, ta)
          }
        }
        k.point = [XA, laneY(1) + LH]; k.mood = 'happy'
      }

      k.text(legend, 745, laneY(3) + LH + 56, { role: 'head', size: 34, min: 18, maxW: 1150, lines: 2, align: 'center' })
    },
  }
})())
