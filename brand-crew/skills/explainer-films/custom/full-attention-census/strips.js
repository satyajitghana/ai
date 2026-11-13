// full-attention-census / strips
//
// The census widget's layer strips, one model a step: each token-mixing layer
// is a cell, coloured by its kind (full, window, linear state, index-selected
// sparse), in config order. The layouts are the article's, from the configs:
//   K2 Horizon 375B   61 layers, all full
//   Gemma 4 31B       60 layers, every 6th full, the rest a window
//   Qwen3.8-27B       64 layers, every 4th full, the rest Gated DeltaNet
//   Kimi K3           93 layers, every 4th and the last full (24), the rest KDA (69)
//   then K3.1 Pro     the same 24 cells turn sparse: an indexer, not a new layer
//   MiniMax M3        60 layers, first 3 full, 57 sparse; M3.1 Flash: all 60 sparse
// Every number in params is the article's ("data": "article"); strings are
// the screen text. Nothing is random.
//
// steps: 0 K2 Horizon · 1 Gemma · 2 Qwen · 3 Kimi K3 · 4 K3 -> K3.1 Pro · 5 M3 -> M3.1 Flash
// params: { data, rows: [{ label, sub, after?, n, period?, lastFull?, first?, other }], legend: [4] }
BESPOKE.define((() => {
  // the kind of layer i (0-based) in row r, before any flip
  function kindOf(r, i) {
    if (r.other === 'F') return 'F'
    if (r.first) return i < r.first ? 'F' : r.other
    const full = (i + 1) % r.period === 0 || (r.lastFull && i === r.n - 1)
    return full ? 'F' : r.other
  }
  // the step at which each row arrives, and the step at which its full cells flip to sparse
  const ARRIVE = [0, 1, 2, 3, 5]
  const FLIP = [-1, -1, -1, 4, 5]

  return {
    plan: () => ({
      min: [3.6, 3.8, 3.8, 3.8, 4.2, 4.6],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 20, span: 1.2 },
        { step: 1, at: .2, type: 'ticks', n: 20, span: 1.2 },
        { step: 2, at: .2, type: 'ticks', n: 20, span: 1.2 },
        { step: 3, at: .2, type: 'ticks', n: 24, span: 1.4 },
        { step: 4, at: .5, type: 'ding' },
        { step: 5, at: .2, type: 'ticks', n: 20, span: 1.2 }, { step: 5, at: 2.2, type: 'ding' },
      ],
      motion: [0, 1, 2, 3].map(s => ({ step: s, from: 0, to: 1.8 })).concat([{ step: 4, from: .3, to: 1.6 }, { step: 5, from: 0, to: 3.4 }]),
    }),
    draw(k) {
      const p = k.params, i = k.step, rows = p.rows || []
      const tone = {
        F: k.P.a,
        S: k.tone('light'),
        L: k.tone('b'),
        P: k.P.hi,
      }
      const X0 = 130, LW = 330, SX = X0 + LW + 20, SX1 = 1360
      const legendY = 900
      const RH = Math.min(132, (legendY - 40 - (k.top + 20)) / Math.max(1, rows.length))
      let pointAt = null

      rows.forEach((r, ri) => {
        const at = ARRIVE[ri] ?? ri
        if (!k.thumb && i < at) return
        const y = k.top + 20 + ri * RH
        const arrive = k.thumb || i > at ? 1 : k.easeOut(k.p(at, 1.2, .1))
        // flipping: full cells turn sparse; for M3 the flip comes after the row has drawn
        const fs = FLIP[ri]
        const flipT = fs < 0 ? 0 : k.thumb ? 1 : i > fs ? 1 : i < fs ? 0 : k.ease(k.p(fs, 1.1, ri === 4 ? 2 : .3))
        const flipped = flipT > .5 && r.after
        // the label and what it is
        k.push(); k.alpha(arrive)
        k.text(flipped ? r.after : r.label, X0, y + 36, { role: 'head', size: 32, min: 18, maxW: LW, lines: 1 })
        if (r.sub) k.text(flipped && r.afterSub ? r.afterSub : r.sub, X0, y + 72, { role: 'mono', size: 22, min: 12, maxW: LW, lines: 1, col: k.dim })
        k.pop()
        // the strip: one cell per layer, drawn left to right as the row arrives
        const cw = (SX1 - SX) / r.n, h = Math.min(54, RH * .46), top = y + 14
        const shown = Math.ceil(r.n * arrive)
        for (let c = 0; c < shown; c++) {
          const kind = kindOf(r, c)
          const col = kind === 'F' && flipT > 0 ? k.mix(tone.F, tone.P, flipT) : tone[kind]
          k.flat(k.rect(SX + c * cw + .6, top, Math.max(1, cw - 1.2), h), col, 1)
        }
        k.seed('strip' + ri); k.line(k.rect(SX, top, (SX1 - SX) * arrive, h), .6, k.ink, { closed: true })
        const focusRow = i <= 3 ? i : i === 4 ? 3 : 4
        if (ri === focusRow) pointAt = [SX + (SX1 - SX) * .5, top + h / 2]
      })

      // the legend, once the first window layer exists
      const lg = p.legend || []
      const keys = ['F', 'S', 'L', 'P']
      keys.forEach((kk, j) => {
        const need = [0, 1, 2, 4][j]
        if (!k.thumb && i < need) return
        const a = k.thumb || i > need ? 1 : k.easeOut(k.p(need, .6, .2))
        const x = X0 + j * 312
        k.push(); k.alpha(a)
        k.flat(k.rect(x, legendY - 18, 26, 26), tone[kk], 1)
        if (lg[j]) k.text(lg[j], x + 38, legendY + 2, { role: 'label', size: 22, min: 12, maxW: 260, lines: 1 })
        k.pop()
      })

      k.point = pointAt || [SX, k.top + 60]
      k.mood = i >= 4 ? 'surprised' : 'thinking'
    },
  }
})())
