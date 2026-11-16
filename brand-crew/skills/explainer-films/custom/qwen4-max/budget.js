// qwen4-max / budget
//
// The article's LayerCost idea, painted: what one new token reads in one
// Qwen4 layer group. A long context is a row of micro-blocks (four tokens
// each). The new token sits at the right end.
//   step 0  full attention: an arc from the token to every block
//   step 1  Gated DeltaNet: the blocks slide into one fixed box (the state);
//           the box does not grow
//   step 2  QSA's indexer: a cheap sweep scores each block (a short bar)
//   step 3  QSA attends: arcs only to the best few blocks, the rest dim
// Block scores are a seeded toy, so the scene is stamped Illustrative.
//
// params: { ctx, full, gdn, idx, sel, state }  (all screen text)
BESPOKE.define((() => {
  const N = 40, X0 = 150, X1 = 1350, BW = (X1 - X0) / N
  const PICK = 6
  let SC = null
  const scores = k => {
    if (SC) return SC
    const r = k.rng('qsa-scores')
    SC = Array.from({ length: N }, (_, i) => 0.15 + 0.55 * r() + (i % 13 === 4 ? 0.3 : 0) + (i > N - 4 ? 0.25 : 0))
    return SC
  }
  const topIdx = s => s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, PICK).map(x => x[1])

  return {
    plan: () => ({
      min: [4.4, 4.8, 4.8, 5.0],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 20, span: 1.2 },
        { step: 1, at: .3, type: 'whoosh' },
        { step: 2, at: .2, type: 'ticks', n: 14, span: 1.4 },
        { step: 3, at: .4, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 1, from: 0, to: 1.8 }, { step: 2, from: 0, to: 1.8 }, { step: 3, from: 0, to: 1.4 }],
    }),
    stampAt: k => [1230, k.top + 10],
    draw(k) {
      const p = k.params, i = k.step
      const s = scores(k), best = topIdx(s)
      const A = k.P.a, HI = k.P.hi, L = k.tone('light')
      const top = k.top + 30
      const RY = top + 240, RH = 46
      const QX = X1 + 10, QY = RY + RH / 2

      k.text(p.ctx, (X0 + X1) / 2, RY + RH + 44, { role: 'label', size: 28, min: 14, maxW: 1100, lines: 1, align: 'center', col: k.dim })

      // step-local progress
      const pr = k.thumb ? 1 : k.ease(k.p(i, 1.4, .2))

      // the row of blocks; in step 1 they fold into the state box
      const boxX = 640, boxY = top + 10, boxS = 150
      for (let b = 0; b < N; b++) {
        const x = X0 + b * BW
        let bx = x, by = RY, bw = BW - 4, bh = RH, a = 1
        if (i === 1) {
          const tb = k.clamp((pr * 1.3) - (b / N) * 0.3, 0, 1)
          const pt = k.arc([x, RY], [boxX + boxS / 2 - 8, boxY + boxS / 2 - 8], 60, tb)
          bx = pt[0]; by = pt[1]; bw = (BW - 4) * (1 - tb * 0.6); bh = RH * (1 - tb * 0.6); a = 1 - tb * 0.7
        }
        let col = L
        if (i === 0) col = A
        if (i === 3) col = best.includes(b) ? HI : L
        if (i === 3 && !best.includes(b)) a = 0.45
        k.push(); k.alpha(a)
        k.seed('blk' + b); k.shape(k.rect(bx + 2, by, bw, bh), { fill: col, op: .9, sw: .6 })
        k.pop()
      }
      // the new token
      k.seed('q'); k.shape(k.circle(QX + 22, QY, 16), { fill: HI, op: 1, sw: .8 })

      if (i === 0) {
        // arcs to every block, drawn left from the token
        for (let b = 0; b < N; b++) {
          const x = X0 + b * BW + BW / 2
          const tb = k.clamp(pr * 1.4 - (1 - b / N) * 0.4, 0, 1)
          if (tb <= 0) continue
          const pts = k.through([[QX + 22, QY - 16], [(x + QX) / 2, RY - 40 - (QX - x) * 0.1], [x, RY]])
          k.seed('arc' + b); k.line(k.partial(pts, tb), .55, A)
        }
        k.text(p.full, (X0 + X1) / 2, RY + RH + 130, { role: 'head', size: 38, min: 18, maxW: 1100, lines: 2, align: 'center' })
        k.point = [X0 + 300, RY - 80]; k.mood = 'surprised'
      }
      if (i === 1) {
        // the history is gone from the row: only a ghost of it is left
        k.push(); k.alpha(.18 * pr)
        for (let b = 0; b < N; b++) { k.seed('ghost' + b); k.line(k.rect(X0 + b * BW + 2, RY, BW - 4, RH), .5, k.dim, { closed: true }) }
        k.pop()
        k.seed('state'); k.shape(k.rect(boxX, boxY, boxS, boxS), { fill: A, op: .35 + .5 * pr, sw: 1 })
        k.text(p.state, boxX + boxS + 30, boxY + boxS / 2 + 10, { role: 'label', size: 28, min: 14, maxW: 420, lines: 1 })
        k.text(p.gdn, (X0 + X1) / 2, RY + RH + 130, { role: 'head', size: 38, min: 18, maxW: 1100, lines: 2, align: 'center' })
        k.point = [boxX + boxS, boxY + boxS / 2]; k.mood = 'thinking'
      }
      if (i === 2) {
        const sweep = X1 - (X1 - X0) * pr
        for (let b = 0; b < N; b++) {
          const x = X0 + b * BW
          if (x + BW < sweep) continue
          const h = s[b] * 120
          k.seed('sc' + b); k.shape(k.rect(x + 6, RY - 14 - h, BW - 12, h), { fill: k.tone('b'), op: .85, sw: .5 })
        }
        k.seed('sweep'); k.line([[sweep, RY - 150], [sweep, RY + RH + 10]], 1.2, HI)
        k.text(p.idx, (X0 + X1) / 2, RY + RH + 130, { role: 'head', size: 38, min: 18, maxW: 1100, lines: 2, align: 'center' })
        k.point = [sweep, RY - 120]; k.mood = 'thinking'
      }
      if (i === 3) {
        best.forEach((b, n) => {
          const x = X0 + b * BW + BW / 2
          const tb = k.clamp(pr * 1.3 - n * 0.05, 0, 1)
          const pts = k.through([[QX + 22, QY - 16], [(x + QX) / 2, RY - 60 - (QX - x) * 0.11], [x, RY]])
          k.seed('sel' + b); k.line(k.partial(pts, tb), 1.1, HI)
        })
        k.text(p.sel, (X0 + X1) / 2, RY + RH + 130, { role: 'head', size: 38, min: 18, maxW: 1100, lines: 2, align: 'center' })
        k.point = [X0 + best[0] * BW + BW / 2, RY - 60]; k.mood = 'proud'
      }
    },
  }
})())
