// liquidcodec / quantize
//
// The article's QuantizerLab, as one moving picture. Left, residual vector
// quantisation on a 2-D toy: three codebooks of 16 entries, each a smaller
// scatter than the last, picked greedily, the path c1, c1+c2, c1+c2+c3
// closing in on z. Then the first code is swapped for its runner-up while
// codes 2 and 3 are kept: the path lands far from z, because those codes
// were corrections to a residual that no longer exists.
// Right, grouped FSQ: one group's four numbers on four number lines with 8,
// 7, 6 and 6 levels, each dot sliding to its nearest tick, then twelve groups
// making twelve tokens, and a wrong code for one group moving one dot one
// tick while the other three stay where they were.
// A seeded toy (stamped Illustrative); every label is a storyboard string.
//
// steps: 0 RVQ path · 1 wrong first code · 2 FSQ rounding · 3 twelve groups, one wrong
// params: { left, right, legend: [4 strings] }
BESPOKE.define((() => {
  let s = 20261113 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const BOOKS = []
  let scale = .95
  for (let b = 0; b < 3; b++) {
    const book = []
    for (let i = 0; i < 16; i++) book.push([(rnd() * 2 - 1) * scale, (rnd() * 2 - 1) * scale])
    BOOKS.push(book); scale *= .42
  }
  const Z = [-.55, -.55]
  const d2 = (a, b) => (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])
  const rank = (book, t) => book.map((c, i) => [i, d2(c, t)]).sort((x, y) => x[1] - y[1]).map(x => x[0])
  // greedy RVQ
  const codes = []
  let sum = [0, 0]
  const path = [[0, 0]]
  for (let b = 0; b < 3; b++) {
    const k = rank(BOOKS[b], [Z[0] - sum[0], Z[1] - sum[1]])[0]
    codes.push(k); sum = [sum[0] + BOOKS[b][k][0], sum[1] + BOOKS[b][k][1]]; path.push(sum)
  }
  // the runner-up for code 1, later codes kept
  const alt1 = rank(BOOKS[0], Z)[1]
  let as = BOOKS[0][alt1]
  const altPath = [[0, 0], as]
  for (let b = 1; b < 3; b++) { as = [as[0] + BOOKS[b][codes[b]][0], as[1] + BOOKS[b][codes[b]][1]]; altPath.push(as) }

  // FSQ: one group's four values before rounding, in [-1, 1]
  const LEVELS = [8, 7, 6, 6]
  const VALS = [.58, -.31, .12, .77]
  const snap = (v, L) => { const h = (L - 1) / 2; return Math.round((v + 1) * h) / h - 1 }
  const tokenTone = []
  for (let i = 0; i < 12; i++) tokenTone.push(rnd())

  return {
    plan: () => ({
      min: [5.2, 4.6, 5.4, 5.6],
      events: [
        { step: 0, at: .4, type: 'ticks', n: 3, span: 2.4 },
        { step: 1, at: .6, type: 'ding' },
        { step: 2, at: .8, type: 'ticks', n: 4, span: 1.2 },
        { step: 3, at: .3, type: 'ticks', n: 12, span: 2.0 },
        { step: 3, at: 3.0, type: 'ding' },
      ],
      motion: [{ step: 0, from: .2, to: 3.2 }, { step: 1, from: .2, to: 2.4 }, { step: 2, from: .4, to: 2.6 }, { step: 3, from: .2, to: 4.2 }],
    }),
    stampAt: k => [1300, k.top + 690],
    draw(k) {
      const p = k.params, i = k.step
      const lg = p.legend || []
      // left: the plane
      const CX = 420, CY = k.top + 320, S = 250
      const toPx = v => [CX + v[0] * S, CY - v[1] * S]
      k.text(p.left || '', 150, k.top + 40, { role: 'head', size: 34, min: 18, maxW: 520, lines: 1 })
      k.seed('plane'); k.line(k.rect(CX - S, CY - S, 2 * S, 2 * S), .8, k.dim, { closed: true })
      BOOKS[0].forEach((c, j) => { const [x, y] = toPx(c); k.flat(k.circle(x, y, 7, 12), k.dim, .7) })
      const [zx, zy] = toPx(Z)
      // the good path, one segment per code
      const prog = k.thumb || i > 0 ? 3 : 3 * k.ease(k.p(0, 3.0, .3))
      const good = path.map(toPx)
      const n = Math.floor(prog), frac = prog - n
      const drawn = good.slice(0, n + 1)
      if (n < 3) drawn.push([good[n][0] + (good[n + 1][0] - good[n][0]) * frac, good[n][1] + (good[n + 1][1] - good[n][1]) * frac])
      k.seed('good'); k.line(drawn, 1.5, k.P.a)
      for (let j = 1; j <= Math.min(3, n); j++) k.flat(k.circle(good[j][0], good[j][1], 12, 16), k.P.a, 1)
      // the wrong first code
      if (k.thumb || i >= 1) {
        const t = k.thumb || i > 1 ? 1 : k.ease(k.p(1, 2.0, .3))
        const bad = altPath.map(toPx)
        k.seed('bad'); k.line(k.partial(bad, t), 1.4, k.P.hi)
        if (t > .98) {
          const e = bad[3]
          k.seed('badend'); k.line(k.circle(e[0], e[1], 16, 20), 2.4, k.P.hi, { closed: true })
        }
      }
      // z last, over both paths, with a ring wider than the code dots
      k.seed('z'); k.line(k.circle(zx, zy, 30, 32), 1.6, k.ink, { closed: true })
      k.flat(k.circle(zx, zy, 7, 14), k.ink, 1)
      k.text('z', zx - 74, zy + 16, { role: 'head', size: 52 })
      // right: four number lines for one group, then the token column
      const RX0 = 820, RX1 = 1170, RY0 = k.top + 150, RG = 110
      k.text(p.right || '', RX0, k.top + 40, { role: 'head', size: 34, min: 18, maxW: 560, lines: 1 })
      const showR = k.thumb || i >= 2
      if (showR) {
        const a = k.thumb || i > 2 ? 1 : k.easeOut(k.p(2, .8, 0))
        const rt = k.thumb || i > 2 ? 1 : k.ease(k.p(2, 1.6, .9))
        k.push(); k.alpha(a)
        LEVELS.forEach((L, r) => {
          const y = RY0 + r * RG
          k.seed('axis' + r); k.line([[RX0, y], [RX1, y]], .9, k.ink)
          for (let q = 0; q < L; q++) {
            const x = RX0 + (q / (L - 1)) * (RX1 - RX0)
            k.line([[x, y - 12], [x, y + 12]], .7, k.ink)
          }
          let v = VALS[r]
          const sv = snap(v, L)
          let x = RX0 + ((v + 1) / 2) * (RX1 - RX0)
          let xs = RX0 + ((sv + 1) / 2) * (RX1 - RX0)
          // step 3: group 1's code is wrong by one level
          if (r === 0 && (k.thumb || i >= 3)) {
            const wt = k.thumb || i > 3 ? 1 : k.ease(k.p(3, .8, 2.6))
            const step = (RX1 - RX0) / (L - 1)
            xs = xs + step * wt
          }
          const cx = x + (xs - x) * rt
          const wrongNow = r === 0 && (k.thumb || (i >= 3 && k.p(3, .8, 2.6) > .5))
          k.flat(k.circle(cx, y, 11, 16), wrongNow ? k.P.hi : k.P.a, 1)
        })
        k.pop()
      }
      // the token column: twelve groups, twelve tokens
      const TX = 1250, TY = RY0 - 40, TH = 34
      if (k.thumb || i >= 3) {
        const filled = k.thumb || i > 3 ? 12 : Math.floor(12 * k.ease(k.p(3, 2.0, .2)) + .001)
        for (let j = 0; j < 12; j++) {
          const y = TY + j * (TH + 6)
          k.seed('tok' + j); k.line(k.rect(TX, y, 70, TH), .7, k.dim, { closed: true })
          if (j < filled) {
            const wrongTok = j === 0 && (k.thumb || k.p(3, .8, 2.6) > .5)
            k.flat(k.rect(TX + 4, y + 4, 62, TH - 8), wrongTok ? k.P.hi : k.mix(k.P.a, k.tone('light'), tokenTone[j] * .6), 1)
          }
        }
      }
      // the legend for this beat
      if (lg[i]) k.text(lg[i], 150, 900, { role: 'body', size: 34, min: 18, maxW: 1050, lines: 1 })
      k.point = i < 2 ? (i === 0 ? [zx, zy] : toPx(altPath[3])) : i === 2 ? [RX0 + 40, RY0 + 160] : [TX, TY + 200]
      k.mood = i === 1 ? 'surprised' : i === 3 ? 'proud' : 'thinking'
    },
  }
})())
