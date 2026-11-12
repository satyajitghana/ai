// flide-decision-inference / forkmask
//
// The article's ForkMask widget, animated: one request laid out as a flat
// stream of 6 state tokens and three questions of 3, 2 and 4 tokens (15 in
// all), and below it the attention mask built row by row from Equation 3: a
// query may read a key in the trunk or in its own branch, never a later one.
// Then one question's rows are set beside the mask of the same question asked
// alone, cell for cell the same. The article's own example, so params say
// "data": "article"; every label is a storyboard string.
//
// steps: 0 the stream · 1 state rows · 2 question rows · 3 same as asked alone
// params: { data, stream, rowsLabel, legend: [4 strings], alone }
BESPOKE.define((() => {
  const SEG = [6, 3, 2, 4]                 // trunk, then three branches
  const branch = [], pos = []
  SEG.forEach((n, b) => { for (let j = 0; j < n; j++) { branch.push(b); pos.push(b === 0 ? j : 6 + j) } })
  const T = branch.length                  // 15
  const allow = (q, kk) => (branch[kk] === 0 || branch[kk] === branch[q]) && pos[kk] <= pos[q]
  return {
    plan: () => ({
      min: [3.4, 3.6, 5.4, 4.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 15, span: 1.4 }, { step: 1, at: .2, type: 'ticks', n: 6, span: 1.6 },
        { step: 2, at: .2, type: 'ticks', n: 9, span: 3.4 }, { step: 3, at: .3, type: 'slide' }, { step: 3, at: 1.6, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 1.8 }, { step: 1, from: 0, to: 2 }, { step: 2, from: 0, to: 3.8 }, { step: 3, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const col = [k.P.a, k.P.b, k.P.hi, k.mix(k.P.b, k.ink, .35)]
      const X0 = 200, CW = 34, SY = Math.max(k.top + 40, 250), MY = SY + 110
      // the stream, as chips
      for (let t = 0; t < T; t++) {
        const a = k.thumb ? 1 : k.backOut(k.span(.1 + t * .06, .4 + t * .06)); if (a <= 0) continue
        const x = X0 + t * CW
        k.flat(k.rect(x + 2, SY + 2, CW - 4, 44), col[branch[t]], a)
      }
      if (p.stream) k.text(p.stream, X0, SY - 18, { role: 'mono', size: 24, min: 12, maxW: T * CW + 300, lines: 1, col: k.dim })
      // mask frame: rows are queries in stream order, columns keys
      const fk = k.thumb ? 1 : k.easeOut(k.span(.3, 1))
      k.push(); k.alpha(fk)
      k.seed('maskframe'); k.line(k.rect(X0, MY, T * CW, T * CW).concat([[X0, MY]]), .7, k.dim)
      for (let j = 1; j < T; j++) {
        k.flat(k.rect(X0 + j * CW - .5, MY, 1, T * CW), k.dim, .25)
        k.flat(k.rect(X0, MY + j * CW - .5, T * CW, 1), k.dim, .25)
      }
      for (let t = 0; t < T; t++) k.flat(k.rect(X0 - 18, MY + t * CW + 4, 12, CW - 8), col[branch[t]], 1)
      if (p.rowsLabel) k.text(p.rowsLabel, X0, MY - 14, { role: 'mono', size: 22, min: 12, maxW: T * CW + 200, lines: 1, col: k.dim })
      k.pop()
      // rows fill: state rows on step 1, question rows on step 2
      const rowsShown = i < 1 ? 0 : i === 1 ? (k.thumb ? 6 : 6 * k.p(1, 1.8, .2)) : (k.thumb || i > 2 ? T : 6 + 9 * k.p(2, 3.4, .2))
      const focusRow = 6 + 3 + 1                // the second question's last token
      for (let q = 0; q < T; q++) {
        const rk = Math.max(0, Math.min(1, rowsShown - q)); if (rk <= 0) continue
        const dimRow = i >= 3 && branch[q] !== 2
        for (let c = 0; c < T; c++) if (allow(q, c)) k.flat(k.rect(X0 + c * CW + 3, MY + q * CW + 3, CW - 6, CW - 6), col[branch[q]], rk * (dimRow ? .25 : .9))
      }
      // step 3: the second question asked alone, its own causal mask
      if (i >= 3) {
        const ak = k.thumb ? 1 : k.easeOut(k.p(3, .9, .2))
        const AX = X0 + T * CW + 120, n = 8, cw = 30, AY = MY + 150
        k.push(); k.alpha(ak)
        for (let t = 0; t < n; t++) k.flat(k.rect(AX + t * cw + 2, AY - 50, cw - 4, 36), col[t < 6 ? 0 : 2], 1)
        k.seed('aloneframe'); k.line(k.rect(AX, AY, n * cw, n * cw).concat([[AX, AY]]), .7, k.dim)
        for (let q = 0; q < n; q++) for (let c = 0; c <= q; c++) k.flat(k.rect(AX + c * cw + 3, AY + q * cw + 3, cw - 6, cw - 6), q >= 6 ? col[2] : col[0], q >= 6 ? .9 : .3)
        if (p.alone) k.text(p.alone, AX, AY + n * cw + 44, { role: 'label', size: 24, min: 12, maxW: 360, lines: 2 })
        const hk = k.thumb ? 1 : k.p(3, .6, 1)
        k.seed('match'); k.arrow([[X0 + T * CW + 14, MY + (focusRow + .5) * CW], [AX - 14, AY + 7.5 * cw]], k.P.hi, 1.2, hk)
        k.pop()
      }
      // the legend for this beat
      const LX = 840
      if (i < 3 && p.legend && p.legend[i]) k.text(p.legend[i], LX, MY + 40, { role: 'head', size: 34, min: 18, maxW: 500, lines: 3 })
      if (i >= 3 && p.legend && p.legend[3]) k.text(p.legend[3], X0 + T * CW + 120, MY + 20, { role: 'head', size: 30, min: 16, maxW: 520, lines: 2 })
      k.point = i === 0 ? [X0 + T * CW, SY + 22] : i < 3 ? [X0 + T * CW, MY + Math.min(rowsShown, T) * CW] : [X0 + T * CW + 300, MY + T * CW / 2]
      k.mood = i === 3 ? 'happy' : i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
