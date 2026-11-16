// biollm-8b / write
//
// The gain write BioLLM says it serves, as a toy: an 8 by 8 electrode grid
// with the 52 electrodes the served adapter reads on culture 149 lit,
// ties fanning from them to a row of MLP neurons, each neuron's bar scaled by
// its gain, the next-word bars shifting; then four arms side by side (real
// row, shuffled row, random ties, no write) where every arm but the last moves
// the words. Seeded toy values, so the runtime stamps it Illustrative; every
// label is a storyboard string.
//
// steps: 0 electrodes light · 1 ties fan out · 2 gains and words shift · 3 the four arms
// params: { dish, ties, gain, words[4], arms[4], moved }
BESPOKE.define((() => {
  let s = 149 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  // the electrodes the served adapter reads on culture 149 (ties-joint1.json); the stimulated ones are left out
  const LIT = [1, 2, 3, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 57, 58, 59, 60, 61, 62]
  const zval = LIT.map(() => .35 + .65 * rnd())
  const NN = 22
  const act = Array.from({ length: NN }, () => .3 + .6 * rnd())
  const gain = Array.from({ length: NN }, () => (rnd() - .45) * 1.1)
  const ties = []
  LIT.forEach((_, e) => { for (let n = 0; n < NN; n++) if (rnd() < .045) ties.push([e, n, rnd()]) })
  const base = [.42, .28, .18, .12]
  const arm = [[.22, .44, .16, .18], [.30, .20, .34, .16], [.26, .24, .14, .36], base]

  return {
    stampAt: k => [1180, k.top + 10],
    plan: () => ({
      min: [3, 3.6, 4, 4.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 7, span: 1.2 }, { step: 1, at: .2, type: 'ticks', n: 12, span: 1.8 },
        { step: 2, at: .4, type: 'pop' }, { step: 3, at: .3, type: 'ticks', n: 4, span: 1.6 }, { step: 3, at: 2.6, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 2 }, { step: 3, from: 0, to: 2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 40, 250)
      // the dish: 8 by 8 slots
      const CELL = 42, GX = 120, GY = Y0 + 50
      const lit = k.thumb ? 1 : k.easeOut(k.p(0, 1.2, .2))
      k.seed('dish'); k.shape(k.rrect(GX - 18, GY - 18, CELL * 8 + 30, CELL * 8 + 30, 20), { fill: k.tone('light'), op: .22, sw: .8 })
      const cellXY = e => [GX + (e % 8) * CELL, GY + Math.floor(e / 8) * CELL]
      for (let e = 0; e < 64; e++) {
        const [x, y] = cellXY(e), j = LIT.indexOf(e)
        k.flat(k.rrect(x + 3, y + 3, CELL - 8, CELL - 8, 5), j >= 0 ? k.P.a : k.dim, j >= 0 ? .25 + .75 * lit * zval[j] : .25)
      }
      if (p.dish) k.text(p.dish, GX - 16, GY + CELL * 8 + 40, { role: 'mono', size: 24, min: 12, maxW: 380, lines: 2, col: k.dim })

      // MLP neurons: a row of bars
      const NX = 560, NW = 470, NY = Y0 + 400, NH = 200
      const nx = n => NX + (n + .5) * (NW / NN)
      const tf = i < 1 ? 0 : k.thumb ? 1 : k.ease(k.p(1, 1.8, .1))
      const gf = i < 2 ? 0 : k.thumb ? 1 : k.ease(k.p(2, 1.4, .2))
      for (let n = 0; n < NN; n++) {
        const h = NH * act[n] * (1 + gf * (i >= 2 ? gain[n] : 0))
        const col = gf > 0 && gain[n] > 0 ? k.P.hi : gf > 0 && gain[n] < 0 ? k.P.b : k.mix(k.P.b, k.ink, .3)
        k.flat(k.rect(nx(n) - 8, NY - h, 16, h), col, .9)
      }
      k.seed('base'); k.line([[NX - 10, NY + 2], [NX + NW + 10, NY + 2]], .8, k.dim)
      // ties: lines from lit cells to neurons
      if (tf > 0) ties.forEach(([e, n, w], m) => {
        const [x, y] = cellXY(LIT[e]), a = [x + CELL / 2 - 1, y + CELL / 2 - 1], b = [nx(n), NY - NH * act[n] - 14]
        const t = k.clamp((tf * 1.4 - m / ties.length * .4), 0, 1)
        if (t <= 0) return
        k.seed('tie' + m); k.line(k.partial(k.through([a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 60], b]), t), .45 + .5 * w, k.mix(k.P.a, k.paper, .25))
      })
      if (i >= 1 && p.ties) k.text(p.ties, NX, Y0 + 20, { role: 'label', size: 26, min: 12, maxW: NW, lines: 1, alpha: tf })
      if (i >= 2 && p.gain) k.text(p.gain, NX, NY + 30, { role: 'mono', size: 22, min: 12, maxW: NW, lines: 2, col: k.dim, alpha: gf })

      // the next word
      const WX = 1110, WY = Y0 + 150, BW = 250
      const words = p.words || []
      const drawWords = (x, y, probs, sc, alpha, label) => {
        words.forEach((w, j) => {
          const yy = y + j * 44 * sc
          k.text(w, x, yy + 22 * sc, { role: 'mono', size: 22 * sc, min: 10, maxW: 90 * sc, lines: 1, alpha })
          k.flat(k.rect(x + 95 * sc, yy + 4 * sc, BW * sc * base[j], 12 * sc), k.dim, .45 * alpha)
          k.flat(k.rect(x + 95 * sc, yy + 18 * sc, BW * sc * probs[j], 12 * sc), k.P.hi, alpha)
        })
        if (label) k.text(label, x, y - 18 * sc, { role: 'label', size: 22 * sc, min: 11, maxW: 330 * sc, lines: 1, alpha })
      }
      if (i < 3) {
        const wa = k.thumb ? 1 : k.easeOut(k.span(.1, .6))
        const shift = i < 2 ? base : base.map((b, j) => b + (arm[0][j] - b) * gf)
        drawWords(WX, WY, shift, 1.1, wa, '')
        if (i >= 2) { k.arrow([[NX + NW + 20, NY - 80], [WX - 20, WY + 80]], k.ink, 1, gf) }
      } else {
        const af = k.thumb ? 1 : k.ease(k.p(3, 1.6, .2))
        const arms = p.arms || []
        ;[[1080, Y0 + 50], [1290, Y0 + 50], [1080, Y0 + 330], [1290, Y0 + 330]].forEach(([x, y], a) => {
          const pr = base.map((b, j) => b + (arm[a][j] - b) * af)
          k.seed('panel' + a); k.shape(k.rrect(x - 16, y - 52, 200, 262, 14), { fill: k.tone(a === 3 ? 'light' : 'a'), op: .12, sw: .6 })
          drawWords(x, y, pr, .68, 1, arms[a] || '')
        })
        if (p.moved) k.text(p.moved, 1064, Y0 + 610, { role: 'head', size: 28, min: 14, maxW: 420, lines: 2, alpha: k.thumb ? 1 : k.p(3, .6, 2.4) })
      }
      k.point = i === 0 ? [GX + CELL * 4, GY + CELL * 4] : i === 1 ? [NX + NW / 2, NY - NH] : i === 2 ? [WX + 60, WY + 60] : [1200, Y0 + 300]
      k.mood = i === 3 ? 'surprised' : i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
