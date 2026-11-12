// leapquant / lift
//
// Why outliers make each rounding expensive, and what Compensator Tokens and
// smoothing do about it. One value channel of a toy state: sixteen key-row
// entries as bars, on one fixed scale, with the low-bit grid drawn behind them
// (levels spaced by the column's largest entry) and a tick on each bar where
// its stored value lands. Step 0: two outlier rows set the grid, so ordinary
// entries get almost no levels and land far from their true height. Step 1:
// the outliers' rank-one part lifts off into an FP16 box; the column's largest
// entry drops and the grid gets finer. Step 2: smoothing rescales each row by
// the square root of its mean magnitude; the bars even out and the grid gets
// finer again. Step 3: the paper's peak-over-median for one real head, as
// three chips. The bars are a toy (geometry only), so the runtime stamps the
// scene Illustrative; the chips are the article's numbers, from params.
//
// steps: 0 outliers set the grid · 1 lift them out · 2 smooth the rows · 3 the paper's head
// params: { fp16, stages: [3], ratios: [3], paper, legend: [4] }
BESPOKE.define((() => {
  const RAW = [1.0, 0.8, 1.3, 9.5, 0.7, 1.1, 0.9, 1.4, 7.2, 0.6, 1.2, 1.0, 0.8, 2.6, 1.1, 0.9]
  const OUT = { 3: 8.3, 8: 6.1 } // what the rank-one Compensator Tokens take from those rows
  const LEVELS = 7               // a 4-bit-like grid, so the levels are visible
  const comp = RAW.map((v, j) => v - (OUT[j] || 0))
  const smooth = comp.map((v, j) => (j === 13 ? v * 0.55 : v)) // the wide row divided down
  const stored = (vals) => {
    const m = Math.max(...vals), step = m / LEVELS
    return { step, q: vals.map(v => Math.round(v / step) * step) }
  }
  const S = [stored(RAW), stored(comp), stored(smooth)]

  return {
    stampAt: k => [1250, Math.max(k.top + 20, 250)],
    plan: () => ({
      min: [4.4, 4.6, 4.2, 4.4],
      events: [
        { step: 0, at: .2, type: 'grow' },
        { step: 1, at: .4, type: 'whoosh' },
        { step: 1, at: 1.4, type: 'ticks', n: 10, span: 1 },
        { step: 2, at: .4, type: 'slide' },
        { step: 3, at: .3, type: 'pop' },
        { step: 3, at: 1, type: 'pop' },
        { step: 3, at: 1.7, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const top = Math.max(k.top + 30, 260), BASE = Math.min(top + 440, 740), H = BASE - top - 40, X0 = 190, BW = 34, GAP = 14
      const hOf = v => (v / 9.5) * H
      const xOf = j => X0 + j * (BW + GAP)
      const X1 = xOf(RAW.length - 1) + BW

      // which stage the column is in, blended while it moves
      const c1 = i >= 1 ? (k.thumb ? 1 : k.ease(k.p(1, 1.4, .3))) : 0
      const c2 = i >= 2 ? (k.thumb ? 1 : k.ease(k.p(2, 1.1, .3))) : 0
      const vals = RAW.map((v, j) => k.lerp(k.lerp(v, comp[j], c1), smooth[j], c2))
      const st = c2 > .5 ? S[2] : c1 > .5 ? S[1] : S[0]

      // the grid of stored levels for this column
      const gk = i === 0 && !k.thumb ? k.p(0, .8, .9) : 1
      for (let l = 1; l <= LEVELS; l++) {
        const y = BASE - hOf(st.step * l)
        k.push(); k.alpha(gk)
        k.seed('lv' + l + ':' + (c2 > .5 ? 2 : c1 > .5 ? 1 : 0)); k.line([[X0 - 24, y], [X1 + 16, y]], .45, k.mix(k.paper, k.ink, .3))
        k.pop()
      }
      k.seed('base'); k.line([[X0 - 24, BASE], [X1 + 16, BASE]], .9, k.ink)

      // the bars, and where each one is stored
      RAW.forEach((_, j) => {
        const g = k.thumb ? 1 : k.easeOut(k.p(0, .7, .04 * j))
        const h = hOf(vals[j]) * g
        const outlier = OUT[j] !== undefined
        if (h < 2) return
        k.seed('bar' + j + ':' + Math.round(h / 6))
        k.shape(k.rect(xOf(j), BASE - h, BW, h), { fill: outlier && c1 < .5 ? k.P.hi : k.P.b, op: .8, sw: .7 })
        if (gk > .9 && g > .9) {
          const qy = BASE - hOf(st.q[j])
          k.flat(k.rect(xOf(j) - 6, qy - 3, BW + 12, 6), k.P.a, 1)
        }
      })

      // the lifted rank-one part, kept in FP16
      if (i >= 1) {
        const lk = k.thumb ? 1 : k.ease(k.p(1, 1.2, .2))
        const BX = 1040, BY = BASE - Math.min(330, H - 20), BWID = 300, BH = 200
        k.push(); k.alpha(lk)
        k.seed('fp16box'); k.shape(k.rrect(BX, BY, BWID, BH, 16), { fill: k.mix(k.paper, k.P.hi, .25), op: 1, sw: .9 })
        // the two lifted pieces, flown from their rows into the box
        Object.keys(OUT).forEach((jj, n) => {
          const j = Number(jj), h = hOf(OUT[j])
          const fx = k.lerp(xOf(j), BX + 70 + n * 110, lk), fy = k.lerp(BASE - hOf(RAW[j]), BY + 40, lk)
          const fh = k.lerp(h, 110, lk)
          k.seed('lift' + j); k.shape(k.rect(fx, fy, BW, fh), { fill: k.P.hi, op: .9, sw: .7 })
        })
        if (p.fp16) k.text(p.fp16, BX + BWID / 2, BY + BH + 40, { role: 'label', size: 22, min: 12, maxW: BWID + 20, lines: 2, align: 'center' })
        k.pop()
      }

      // the paper's head: three chips
      if (i >= 3 && p.ratios) {
        const y = BASE + 60
        let x = X0
        p.ratios.forEach((r, n) => {
          const a = k.thumb ? 1 : k.backOut(k.p(3, .5, .2 + .7 * n))
          if (a <= 0) return
          const lab = (p.stages || [])[n] || ''
          const w = Math.max(k.measure(r, { role: 'head', size: 36 }).w, k.measure(lab, { role: 'label', size: 20, maxW: 300 }).w) + 40
          k.push(); k.alpha(Math.min(1, a))
          k.seed('chip' + n); k.shape(k.rrect(x, y, w, 96, 14), { fill: n === 2 ? k.P.a : k.mix(k.paper, k.P.b, .35), op: .9, sw: .8 })
          k.text(r, x + w / 2, y + 40, { role: 'head', size: 36, min: 18, maxW: w - 20, align: 'center', col: n === 2 ? k.textOn(k.P.a) : k.ink })
          if (lab) k.text(lab, x + w / 2, y + 78, { role: 'label', size: 20, min: 11, maxW: w - 16, align: 'center', col: n === 2 ? k.textOn(k.P.a) : k.dim })
          k.pop()
          if (n < p.ratios.length - 1) { k.seed('chev' + n); k.arrow([[x + w + 10, y + 48], [x + w + 46, y + 48]], k.ink, 1, a) }
          x += w + 60
        })
        if (p.paper) k.text(p.paper, x + 10, y + 52, { role: 'label', size: 22, min: 12, maxW: 1340 - x, lines: 2, col: k.dim })
      } else if (p.legend && p.legend[i]) {
        k.text(p.legend[i], X0, BASE + 90, { role: 'head', size: 30, min: 16, maxW: 1150, lines: 2 })
      }

      k.point = i === 0 ? [xOf(3) + BW / 2, BASE - hOf(RAW[3])] : i === 1 ? [1190, BASE - 230] : i === 2 ? [xOf(13) + BW / 2, BASE - hOf(smooth[13]) - 20] : [X0 + 400, BASE + 100]
      k.mood = i === 0 ? 'surprised' : i === 3 ? 'proud' : 'thinking'
    },
  }
})())
