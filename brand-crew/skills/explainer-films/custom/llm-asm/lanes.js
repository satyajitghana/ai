// llm-asm / lanes
//
// The article's Q8Dot widget as a moving picture: one Q8_0 block of 32 weights dotted with
// 32 activations by the FAST_Q8=1 kernel. Five beats:
//   0  quantize: the float activations snap to int8 cells (one scale per block, once per matmul)
//   1  sign: |x| stays on top, x's sign drops onto the weights below (vpabsb + vpsignb)
//   2  pairs: 32 products fold pairwise into 16 lanes (vpmaddubsw)
//   3  widen: 16 lanes fold into 8 (vpmaddwd against ones)
//   4  scale: 8 lanes convert to float and pour into one accumulator, times two scales
// Geometry only; every string comes from params. Toy cell heights, so it is stamped Illustrative.
//
// params: { heads: [5 strings], rows: { x, w, p16, p32, acc }, scale }
BESPOKE.define((() => {
  const N = 32
  // toy magnitudes and signs for the 32 activations and weights, fixed
  const rnd = (() => { let s = 1234567; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 } })()
  const XV = Array.from({ length: N }, () => rnd() * 2 - 1)
  const WV = Array.from({ length: N }, () => rnd() * 2 - 1)
  return {
    stampAt: k => [1230, k.top + 24],
    plan: () => ({
      min: [4.6, 4.2, 4.6, 4.0, 4.8],
      events: [{ step: 0, at: .4, type: 'ticks', n: 32, span: 1.6 }, { step: 2, at: .5, type: 'whoosh' },
        { step: 3, at: .5, type: 'whoosh' }, { step: 4, at: 1.4, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step, rows = p.rows || {}
      const X0 = 150, X1 = 1350
      const top = Math.max(k.top + 40, 210)
      const cw = (X1 - X0) / N
      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, top, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      const YX = top + 90, YW = top + 230, Y16 = top + 400, Y8 = top + 520, YA = top + 640
      const H = 90
      const lab = (s, y, a) => { if (s) k.text(s, X0, y - 12, { role: 'mono', size: 20, min: 11, maxW: 700, lines: 1, col: k.dim, alpha: a }) }

      // activations: float bars that snap to int8 cells in step 0
      const snap = k.thumb || st > 0 ? 1 : k.ease(k.p(0, 1.6, .4))
      lab(rows.x, YX, 1)
      for (let i = 0; i < N; i++) {
        const x = X0 + i * cw + 3, w = cw - 6
        const mag = Math.abs(XV[i])
        const q = Math.round(mag * 8) / 8 // toy quantization: magnitudes on a coarse grid
        const h = H * 0.9 * k.lerp(mag, q, snap)
        const sign = XV[i] < 0
        const showSign = !(st >= 1 || k.thumb) // after step 1 the top row shows |x|
        k.seed('x' + i)
        k.shape(k.rect(x, YX + H - h, w, h), { fill: showSign && sign ? k.P.b : k.P.a, op: .85 })
      }

      // weights: their sign flips where x was negative (step 1)
      const flip = k.thumb || st > 1 ? 1 : st === 1 ? k.ease(k.p(1, 1.4, .5)) : 0
      lab(rows.w, YW, 1)
      for (let i = 0; i < N; i++) {
        const x = X0 + i * cw + 3, w = cw - 6
        const neg = XV[i] < 0
        const v = neg ? k.lerp(WV[i], -WV[i], flip) : WV[i]
        const h = Math.abs(v) * H * 0.9
        k.seed('w' + i)
        k.shape(k.rect(x, v >= 0 ? YW + H / 2 - h / 2 : YW + H / 2 - h / 2, w, Math.max(4, h)), { fill: v >= 0 ? k.P.a : k.P.b, op: .7 })
        if (st === 1 && neg && !k.thumb) {
          const t = k.p(1, 1.0, .1 + i * .02)
          if (t > 0 && t < 1) k.arrow([[x + w / 2, YX + H + 6], [x + w / 2, YW + 4]], k.P.hi, 1.2, k.ease(t))
        }
      }

      // 16 lanes: pairs of products fold together (step 2)
      if (st >= 2 || k.thumb) {
        const t = k.thumb || st > 2 ? 1 : k.ease(k.p(2, 1.6, .3))
        lab(rows.p16, Y16, t)
        for (let j = 0; j < 16; j++) {
          for (const side of [0, 1]) {
            const i = 2 * j + side
            const sx = X0 + i * cw + 3
            const dx = X0 + j * 2 * cw + 3
            const pos = k.arc([sx, YW + H], [dx, Y16], 60, t)
            const ww = k.lerp(cw - 6, 2 * cw - 6, t)
            const h = 24 + 40 * Math.abs(XV[i] * WV[i])
            k.seed('p16' + i)
            k.shape(k.rect(pos[0], pos[1], ww, h), { fill: k.P.hi, op: t < 1 ? .45 : .8 })
          }
        }
      }

      // 8 lanes (step 3)
      if (st >= 3 || k.thumb) {
        const t = k.thumb || st > 3 ? 1 : k.ease(k.p(3, 1.4, .3))
        lab(rows.p32, Y8, t)
        for (let j = 0; j < 16; j++) {
          const sx = X0 + j * 2 * cw + 3
          const dx = X0 + Math.floor(j / 2) * 4 * cw + 3
          const pos = k.arc([sx, Y16 + 60], [dx, Y8], 50, t)
          const ww = k.lerp(2 * cw - 6, 4 * cw - 6, t)
          k.seed('p32' + j)
          k.shape(k.rect(pos[0], pos[1], ww, 60), { fill: k.P.b, op: t < 1 ? .45 : .8 })
        }
      }

      // one accumulator, times the two scales (step 4)
      if (st >= 4 || k.thumb) {
        const t = k.thumb ? 1 : k.ease(k.p(4, 1.6, .3))
        lab(rows.acc, YA, t)
        const ax = X0 + 12 * cw, aw = 8 * cw
        for (let j = 0; j < 8; j++) {
          const sx = X0 + j * 4 * cw + 3
          const pos = k.arc([sx, Y8 + 60], [ax + aw / 2 - 20, YA], 80, k.clamp(t * 1.2 - j * .03, 0, 1))
          k.seed('acc' + j)
          k.flat(k.rect(pos[0], pos[1], 40, 40), k.P.a, k.clamp(1 - t, .15, .8))
        }
        k.seed('accbox')
        k.shape(k.rrect(ax, YA, aw, 70, 12), { fill: k.P.hi, op: .25 + .6 * t })
        if (p.scale) k.text(p.scale, ax + aw + 30, YA + 22, { role: 'body', size: 26, min: 12, maxW: X1 - ax - aw - 30, lines: 2, alpha: t })
        k.point = [ax + aw, YA + 30]
      } else {
        k.point = [X1 - 40, st >= 2 ? Y16 + 30 : YW + 40]
      }
      k.mood = st === 4 ? 'proud' : 'thinking'
    },
  }
})())
