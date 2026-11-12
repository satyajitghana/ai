// llama-modchip / codebook
//
// The article's CodebookExplorer, animated. Left: the int8 cube seen face-on
// (the x / y projection), with the disk of radius 127 that the inscribed ball
// projects to. First a 3-bit scalar grid: 8 levels per coordinate, so 512
// points per triple for 9 bits. Then the shipped LUT-VQ3-64 codebook from
// vq3/vq3_codebook.h lands, 128 int8 triples for 7 bits, the ones beyond the
// ball in the second ink. Right: the 24-byte block_vq3_0 builds bit field by bit
// field (16 + 140 + 12 + 24 = 192 bits for 64 weights), then the decode: one
// index lights one entry. The codebook's coordinates are fixed data in this
// file (geometry only); every label drawn is a storyboard string.
//
// steps: 0 the scalar grid · 1 the codebook lands · 2 the block's fields ·
//        3 the total · 4 a lookup
// params: { data, grid, cb, ball, block, parts: [{label, text, bits}], total, lookup }
BESPOKE.define((() => {
  const CB = [
  -24, -19, -24, -37, -20, -123, -41, -18, 18, 23, -6, 27, 29, -15, -65, -3, 4, 0, -59, -25, 72, -68, -13, -66,
  11, -54, -122, -84, -5, 30, 35, -51, 51, -19, 8, 50, 54, 9, 62, 12, -74, -55, -41, -73, -34, 16, 46, 19,
  -62, -70, -111, 69, -14, 116, -65, -73, 20, 70, 11, 12, 75, -2, -40, 55, 43, -65, -6, 62, -121, -47, 32, 16,
  73, -64, 65, -22, 67, 121, 62, 61, -9, 5, 80, -18, -123, -46, 55, -119, -58, -56, -24, -120, -122, -57, 48, -72,
  -125, -52, -3, -30, 77, 27, -19, -126, -11, 43, -118, -118, -56, 69, -22, 52, -122, 119, 120, 6, -116, 123, -22, -59,
  124, -26, 115, 127, 4, -10, -97, -121, -34, 119, 46, -48, 117, 54, -115, 7, 117, 76, 9, 120, 26, -122, -113, 102,
  -123, -114, 19, 5, 124, -58, 51, 122, -8, 100, -123, 51, 114, -111, -62, 62, 123, 52, -56, 119, -59, -122, 6, -31,
  -123, 8, 120, -121, 40, -121, 122, -120, -3, -127, 1, 15, 114, 114, 111, 121, 114, 28, -114, 97, 118, -119, 116, 48,
  5, -19, 75, 16, -14, 126, 10, 8, -122, -18, -41, -70, 18, -35, -16, -13, -51, 18, -37, -47, 123, 29, 16, -25,
  -15, 8, -63, -15, 14, 120, -19, -71, 69, -75, -42, -18, 31, -64, 121, 60, -2, -118, -15, 37, -26, 1, 49, 66,
  20, -81, 0, 43, 42, 120, 66, -41, 8, 63, -53, -98, 4, 58, -67, 63, -62, -38, -115, -30, -124, -108, -47, 118,
  53, 59, -124, -54, 31, -125, 58, 65, 56, -62, 19, 123, -5, -119, 115, -66, 13, -23, -24, -121, 38, -31, -120, -66,
  -61, -113, 118, -63, 46, 65, 30, -121, 48, 35, -124, -54, 118, -18, 34, -76, -122, 46, 56, -122, -4, 118, 26, 62,
  122, -48, -117, 115, 44, 120, 122, -56, -12, 38, 112, 124, -113, -115, -109, 124, -70, 44, 121, 55, 14, 63, 110, -59,
  25, 123, -120, -47, 113, -121, -24, 124, -9, 116, -106, 119, -51, 117, 60, -40, 124, 122, 114, -118, -124, -115, 55, 13,
  -124, 4, -76, -124, 26, 64, -74, 117, 8, -119, 59, -46, 110, 120, -115, 121, 116, -38, -115, 114, -106, -122, 121, -25,
  ]
  const LEVELS = [-112, -80, -48, -16, 16, 48, 80, 112]
  const PICK = 41
  const PX = 150, PS = 560, RX = 790, RW = 570
  const T_CAP = { role: 'label', size: 26, min: 13, maxW: PS, lines: 2, lh: 1.08 }
  const T_HEAD = { role: 'head', size: 32, min: 16, maxW: RW, lines: 2, lh: 1.08 }
  const T_ROW = { role: 'label', size: 25, min: 12, maxW: RW - 150, lines: 1 }
  const T_VAL = { role: 'mono', size: 24, min: 12, maxW: 150, lines: 1 }

  return {
    stampAt: k => [RX + RW - 100, k.top + 10],
    plan: () => ({
      min: [3.8, 4.4, 4.8, 3.6, 3.8],
      events: [{ step: 0, at: .2, type: 'ticks', n: 8, span: 1.2 }, { step: 1, at: .2, type: 'grow' },
        { step: 2, at: .3, type: 'ticks', n: 4, span: 2.4 }, { step: 3, at: .3, type: 'ding' }, { step: 4, at: .4, type: 'pop' }],
      motion: [{ step: 0, from: 0, to: 1.8 }, { step: 1, from: 0, to: 2.4 }, { step: 2, from: 0, to: 3.0 }, { step: 3, from: 0, to: 1.0 }, { step: 4, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.thumb ? 3 : k.step
      const top = k.top + 6
      // ---- left: the cube, face on ---------------------------------------
      const capH = Math.max(k.measure(p.grid, T_CAP).h, k.measure(p.cb, T_CAP).h)
      const S = Math.min(PS, 925 - top - capH - 30)
      const X0 = PX + (PS - S) / 2, Y0 = top
      const at = v => (v + 128) / 255 * S
      const sx = v => X0 + at(v), sy = v => Y0 + S - at(v)
      k.seed('cube'); k.line(k.rect(X0, Y0, S, S), .9, k.ink, { closed: true })
      const r127 = 127 / 255 * S
      const bk = k.thumb ? 1 : k.easeOut(k.p(0, 1.0, .2))
      k.seed('ball'); k.line(k.partial(k.circle(X0 + S / 2, Y0 + S / 2, r127, 72).concat([k.circle(X0 + S / 2, Y0 + S / 2, r127, 72)[0]]), bk), .7, k.dim)
      // the scalar grid: strong at step 0, faint once the codebook lands
      const gk = k.thumb ? .35 : i === 0 ? k.p(0, 1.4, .3) : k.lerp(1, .35, k.p(1, 1, 0))
      LEVELS.forEach((u, a) => LEVELS.forEach((v, b) => {
        const n = a * 8 + b
        if (i === 0 && n / 64 > gk) return
        k.flat(k.rect(sx(u) - 4, sy(v) - 4, 8, 8), k.dim, i === 0 ? .9 : gk)
      }))
      // the codebook
      if (i >= 1) {
        const ck = k.thumb ? 1 : k.p(1, 2.0, .2)
        for (let j = 0; j < 128; j++) {
          if (j / 128 > ck) break
          const x = CB[3 * j], y = CB[3 * j + 1], z = CB[3 * j + 2]
          const out = x * x + y * y + z * z > 127 * 127
          const lit = i >= 4 && j === PICK
          const pk = k.thumb ? 1 : i === 1 ? k.clamp((ck - j / 128) * 8, 0, 1) : 1
          k.push(); k.translate(sx(x), sy(y))
          k.seed(lit ? 'pick' : out ? 'cbo' : 'cbi')
          if (pk < .5) { k.pop(); continue }
          k.shape(k.circle(0, 0, lit ? 15 : 8, 12), { fill: lit ? k.P.hi : out ? k.P.b : k.P.a, op: 1, sw: .5 })
          k.pop()
        }
      }
      const cap = i === 0 ? p.grid : p.cb
      const cm = k.measure(cap, T_CAP)
      k.text(cap, PX + PS / 2, Y0 + S + 24 + cm.px, { ...T_CAP, align: 'center', col: k.dim })
      if (i >= 1 && p.ball) {
        const a = k.thumb ? 1 : k.easeOut(k.p(1, .6, 1.6))
        k.text(p.ball, X0 + S / 2, Y0 + S / 2 - r127 - 10, { role: 'mono', size: 22, min: 11, maxW: S - 40, align: 'center', col: k.dim, alpha: a })
      }

      // ---- right: the block -----------------------------------------------
      if (i < 2) { k.point = [X0 + S, Y0 + S / 2]; k.mood = i === 1 ? 'excited' : 'thinking'; return }
      const parts = p.parts || []
      const hm = k.measure(p.block, T_HEAD)
      k.text(p.block, RX, top + hm.px, T_HEAD)
      const BY = top + hm.h + 30, BH = 70
      k.seed('blk'); k.line(k.rect(RX, BY, RW, BH), .8, k.dim, { closed: true })
      const tones = ['light', 'a', 'hi', 'b']
      let x = RX, ly = BY + BH + 30
      parts.forEach((q, j) => {
        const pk = k.thumb || i > 2 ? 1 : k.ease(k.p(2, .7, .2 + j * .65))
        const w = RW * q.bits / 192
        if (pk > 0) {
          const wq = Math.round(w * pk / 8) * 8; k.seed('f' + j + '_' + wq); k.shape(k.rect(x, BY, wq, BH), { fill: k.tone(tones[j % tones.length]), op: .9, sw: .6 })
          const m = k.measure(q.label, T_ROW)
          k.flat(k.rect(RX, ly + 4, 22, 22), k.tone(tones[j % tones.length]), pk)
          k.text(q.label, RX + 34, ly + m.px, { ...T_ROW, alpha: pk })
          k.text(q.text, RX + RW, ly + m.px, { ...T_VAL, align: 'right', col: k.dim, alpha: pk })
        }
        x += w
        ly += Math.max(30, k.measure(q.label, T_ROW).h) + 14
      })
      if (i >= 3 && p.total) {
        const a = k.thumb ? 1 : k.backOut(k.p(3, .7, .2))
        const m = k.measure(p.total, { ...T_HEAD, size: 36 })
        k.text(p.total, RX, ly + 16 + m.px, { ...T_HEAD, size: 36, col: k.P.a, alpha: Math.min(1, a) })
        ly += 16 + m.h
      }
      if (i >= 4 && p.lookup) {
        const a = k.thumb ? 1 : k.easeOut(k.p(4, .6, .5))
        const m = k.measure(p.lookup, { ...T_CAP, maxW: RW })
        k.text(p.lookup, RX, Math.min(920, ly + 30 + m.px), { ...T_CAP, maxW: RW, alpha: a })
        k.point = [sx(CB[3 * PICK]), sy(CB[3 * PICK + 1])]
      } else k.point = [RX + RW / 2, BY + BH / 2]
      k.mood = i === 3 ? 'proud' : 'thinking'
    },
  }
})())
