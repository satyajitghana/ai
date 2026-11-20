// kinetic-and-linger / passes
//
// The article's arithmetic for Kinetic's edit number, drawn as passes over a
// slab of weights. Each sweep across the slab is one read of the model; the
// tokens it commits drop into the answer row below.
//   step 0  plain decoding: one sweep, one token
//   step 1  a first edit: a draft of 8 guesses copied from the prompt, a few
//           kept, plus the model's own token
//   step 2  a repeated edit: the draft index already holds the answer, all 8
//           kept, 9 tokens a sweep (the code's cap)
//   step 3  the ledger: the README's two speeds and what one divided by the
//           other means
// Box counts are a toy (stamped Illustrative); every string drawn is the
// storyboard's.
// params: { slab, lanes: [str x3], ledger: [str x3] }
BESPOKE.define((() => {
  const X0 = 140, X1 = 1340
  const SLAB_Y = 0      // offset under k.top
  const SLAB_H = 120
  const ROW_Y = 360
  const BOX = 56, GAP = 10
  // per step: tokens committed by each sweep (sweeps at fixed times)
  const PLAN = [
    [1, 1, 1, 1, 1],
    [4, 2, 5, 3],
    [9, 9, 9],
  ]
  const SWEEP = [0.85, 1.05, 1.25]   // seconds per sweep

  return {
    plan: () => ({
      min: [5.0, 5.4, 5.0, 5.2],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 5, span: 4.2 },
        { step: 1, at: .2, type: 'ticks', n: 4, span: 4.2 },
        { step: 2, at: .2, type: 'whoosh' },
        { step: 3, at: .4, type: 'ding' },
      ],
      motion: 'all',
    }),
    stampAt: k => [1240, k.top + 760],
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 20
      const ink = k.ink, a = k.P.a, hi = k.P.hi, light = k.tone('light'), bcol = k.tone('b')

      // the slab of weights
      k.seed('slab')
      k.shape(k.rect(X0, top + SLAB_Y, X1 - X0, SLAB_H), { fill: light, op: .9, sw: .8 })
      for (let c = 1; c < 24; c++) {
        const xx = X0 + c * (X1 - X0) / 24
        k.seed('col' + c); k.line([[xx, top + 8], [xx, top + SLAB_H - 8]], .35, k.dim)
      }
      k.text(p.slab, (X0 + X1) / 2, top + SLAB_H + 46, { role: 'label', size: 30, min: 16, maxW: 1100, lines: 1, align: 'center', col: ink })

      const lane = Math.min(i, 2)
      const sweeps = PLAN[lane]
      const per = SWEEP[lane]
      const st = k.thumb ? 99 : k.since(i)
      const done = k.thumb ? sweeps.length : Math.min(sweeps.length, Math.floor(st / per))
      const frac = k.thumb ? 0 : (st / per) - Math.floor(st / per)

      // the sweep head
      if (i < 3 && done < sweeps.length && !k.thumb) {
        const xx = X0 + frac * (X1 - X0)
        k.seed('head' + done)
        k.shape(k.rect(Math.max(X0, xx - 60), top - 6, Math.min(60, xx - X0), SLAB_H + 12), { fill: hi, op: .55, sw: .4 })
      }

      // the lane label
      if (i < 3) {
        k.text(p.lanes[lane], X0, top + ROW_Y - 40, { role: 'head', size: 34, min: 18, maxW: 1100, lines: 1, col: ink })
      }

      // drafted guesses for the current sweep (steps 1 and 2): 8 pale boxes above the row
      if ((i === 1 || i === 2) && !k.thumb) {
        const cur = Math.min(done, sweeps.length - 1)
        const kept = sweeps[cur] - 1
        const fr = done >= sweeps.length ? 1 : frac
        for (let g = 0; g < 8; g++) {
          const gx = X0 + g * (BOX + GAP)
          const gy = top + SLAB_H + 90
          const show = k.clamp(fr * 3 - g * .12, 0, 1)
          if (show <= 0) continue
          k.push(); k.alpha(show * (g < kept ? 1 : .45))
          k.seed('g' + cur + '-' + g)
          k.shape(k.rect(gx, gy, BOX, BOX * .7), { fill: g < kept ? bcol : k.paper, op: .8, sw: .6 })
          k.pop()
        }
      }

      // the answer row: tokens committed so far
      if (i < 3 || k.thumb) {
        let n = 0
        const total = k.thumb ? 9 * 3 : sweeps.slice(0, done).reduce((s, v) => s + v, 0)
        const perRow = Math.floor((X1 - X0) / (BOX + GAP))
        const row0 = top + ROW_Y
        for (let s = 0; s < (k.thumb ? 3 : done); s++) {
          const cnt = k.thumb ? 9 : sweeps[s]
          for (let t = 0; t < cnt; t++) {
            const r = Math.floor(n / perRow), c = n % perRow
            const bx = X0 + c * (BOX + GAP), by = row0 + r * (BOX + GAP)
            const last = t === cnt - 1
            k.seed('tok' + lane + '-' + n)
            k.shape(k.rect(bx, by, BOX, BOX), { fill: last ? hi : a, op: .88, sw: .6 })
            n++
          }
        }
        void total
      }

      // the ledger
      if (i === 3 && !k.thumb) {
        p.ledger.forEach((line, j) => {
          const al = k.ease(k.p(3, .7, .2 + j * .9))
          if (al <= 0) return
          k.push(); k.alpha(al)
          k.text(line, (X0 + X1) / 2, top + 280 + j * 120, { role: j === 2 ? 'head' : 'body', size: j === 2 ? 52 : 40, min: 20, maxW: 1150, lines: 1, align: 'center', col: j === 2 ? hi : ink })
          k.pop()
        })
      }

      k.point = i === 3 ? [(X0 + X1) / 2 + 300, top + 520] : [X0 + 400, top + ROW_Y]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
