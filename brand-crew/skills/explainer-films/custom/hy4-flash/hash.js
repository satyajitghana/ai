// hy4-flash / hash
//
// The article's EngramLookup widget as a moving picture: how one token of "Alexander the Great"
// becomes sixteen row numbers in a table of about 165 million rows. Five beats:
//   0  three tokens drop into canonical ids
//   1  case and accent variants of "the" fold into one id
//   2  each id is multiplied by its own odd constant; XOR makes a bigram key, then a trigram key
//   3  sixteen heads reduce the keys by sixteen primes: sixteen rows light along the table
//   4  the sixteen rows lift out of the table (60 px, clear of the key boxes), and the table itself stays where it is
// The tick positions along the table are the real rows of the first Engram layer for " Great"
// after "Alexander the" (row / prime, from the release's own constants), so `data: article` is
// not claimed for them; the scene is stamped Illustrative. Every string drawn comes from params.
//
// params: { heads: [5 strings], tokens: [3], canon, variants: [4], mult, keys: [2], primes, rows, table, home }
BESPOKE.define((() => {
  const FRAC = [0.218, 0.66, 0.778, 0.942, 0.102, 0.92, 0.788, 0.334, 0.387, 0.809, 0.823, 0.771, 0.399, 0.465, 0.888, 0.717]

  return {
    stampAt: k => [1250, k.top + 20],
    plan: () => ({
      min: [4.2, 4.2, 5.0, 5.2, 4.6],
      events: [{ step: 0, at: .4, type: 'pop' }, { step: 1, at: .5, type: 'whoosh' }, { step: 2, at: 1.2, type: 'ding' },
        { step: 3, at: .4, type: 'ticks', n: 16, span: 2.0 }, { step: 4, at: .6, type: 'whoosh' }],
      motion: [{ step: 1, from: 0, to: 2.4 }, { step: 3, from: 0, to: 2.8 }, { step: 4, from: 0, to: 2.6 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 140, X1 = 1360
      const T = Math.max(k.top + 40, 200)
      const shown = i => k.thumb || st >= i
      const pin = (i, d, dl) => (k.thumb ? 1 : st > i ? 1 : st === i ? k.ease(k.p(i, d, dl)) : 0)

      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, T - 10, { role: 'head', size: 32, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // three token chips
      const CX = [330, 650, 970], CY = T + 70, CW = 250, CH = 70
      const toks = p.tokens || []
      for (let i = 0; i < 3; i++) {
        const a = pin(0, .6, i * .25)
        if (a <= 0) continue
        k.push(); k.alpha(a); k.seed('tok' + i)
        k.shape(k.rrect(CX[i] - CW / 2, CY, CW, CH, 14), { fill: k.P.light, op: .35, sw: 1.4 })
        if (toks[i]) k.text(toks[i], CX[i], CY + 47, { role: 'mono', size: 30, min: 14, maxW: CW - 20, lines: 1, align: 'center' })
        // down to its canonical id
        k.arrow([[CX[i], CY + CH + 6], [CX[i], CY + CH + 60]], k.ink, 1.1, a)
        k.seed('can' + i)
        k.shape(k.rrect(CX[i] - 90, CY + CH + 66, 180, 50, 10), { fill: k.tone('a'), op: .5, sw: 1.1 })
        if (p.canon) k.text(p.canon, CX[i], CY + CH + 99, { role: 'label', size: 20, min: 11, maxW: 170, lines: 1, align: 'center' })
        k.pop()
      }

      // beat 1: variants of "the" fly into the middle chip
      const vars = p.variants || []
      if (st === 1) {
        vars.forEach((v, j) => {
          const t = k.ease(k.p(1, 1.6, .2 + j * .15))
          const from = [1180 + (j % 2) * 140, T + 40 + Math.floor(j / 2) * 70]
          const to = [CX[1], CY + 35]
          const [x, y] = k.arc(from, to, 120, t)
          k.push(); k.alpha(1 - t * .85); k.seed('var' + j)
          k.shape(k.rrect(x - 60, y - 24, 120, 48, 10), { fill: k.tone('hi'), op: .35, sw: 1 })
          k.text(v, x, y + 10, { role: 'mono', size: 24, min: 12, maxW: 110, lines: 1, align: 'center' })
          k.pop()
        })
      }

      // beat 2: multipliers and the two keys
      const KY = CY + CH + 170
      if (shown(2)) {
        const a = pin(2, .8, 0)
        k.push(); k.alpha(a)
        if (p.mult) k.text(p.mult, X0, KY - 6, { role: 'mono', size: 22, min: 11, maxW: 560, lines: 1, col: k.dim })
        const keys = p.keys || []
        const KX = [520, 900]
        for (let j = 0; j < 2; j++) {
          const b = pin(2, .7, .6 + j * .6)
          k.push(); k.alpha(b); k.seed('key' + j)
          k.shape(k.rrect(KX[j] - 140, KY + 20, 280, 60, 12), { fill: k.tone('b'), op: .45, sw: 1.3 })
          if (keys[j]) k.text(keys[j], KX[j], KY + 59, { role: 'label', size: 22, min: 11, maxW: 260, lines: 1, align: 'center' })
          // which ids feed it: the bigram uses the last two, the trigram all three
          const feeds = j === 0 ? [1, 2] : [0, 1, 2]
          feeds.forEach(i => { k.seed('feed' + j + i); k.line(k.partial([[CX[i], CY + CH + 118], [KX[j], KY + 20]], b), .7, k.dim) })
          k.pop()
        }
        k.pop()
      }

      // beat 3: the table strip, sixteen head segments, sixteen rows lighting
      const SY = KY + 170, SH = 56
      if (shown(3)) {
        const a = pin(3, .6, 0)
        k.push(); k.alpha(a)
        const segW = (X1 - X0) / 16
        for (let h = 0; h < 16; h++) {
          k.seed('seg' + h)
          k.shape(k.rect(X0 + h * segW + 2, SY, segW - 4, SH), { fill: h < 8 ? k.tone('light') : k.tone('a'), op: .3, sw: .8 })
        }
        if (p.primes) k.text(p.primes, X0, SY - 14, { role: 'mono', size: 20, min: 10, maxW: X1 - X0, lines: 1, col: k.dim })
        if (p.table) k.text(p.table, X0, SY + SH + 36, { role: 'label', size: 22, min: 11, maxW: 700, lines: 1, col: k.dim })
        for (let h = 0; h < 16; h++) {
          const t = pin(3, .5, .3 + h * .12)
          if (t <= 0) continue
          const x = X0 + h * segW + 2 + FRAC[h] * (segW - 4)
          const kx = h < 8 ? 520 : 900
          if (st === 3 && !k.thumb) { k.seed('ray' + h); k.line(k.partial([[kx, KY + 80], [x, SY]], t), .6, k.dim) }
          const lift = st >= 4 ? (k.thumb ? 1 : k.ease(k.p(4, 1.4, h * .04))) : 0
          const y = SY - lift * 60
          k.flat(k.rect(x - 4, y, 8, SH), k.P.hi, .95 * t)
        }
        k.pop()
      }

      // beat 4: what one token takes away
      if (shown(4)) {
        const a = pin(4, .6, 1.2)
        k.push(); k.alpha(a)
        if (p.rows) k.text(p.rows, X1, SY + SH + 90, { role: 'head', size: 30, min: 13, maxW: 620, lines: 1, align: 'right' })
        if (p.home) k.text(p.home, X1, SY + SH + 36, { role: 'label', size: 22, min: 11, maxW: 520, lines: 1, align: 'right', col: k.dim })
        k.pop()
      }

      k.point = st <= 1 ? [CX[1], CY + 35] : st === 2 ? [900, KY + 50] : [X0 + 600, SY]
      k.mood = st === 1 ? 'surprised' : st === 4 ? 'proud' : 'thinking'
    },
  }
})())
