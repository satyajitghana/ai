// edge0-145b / latent
//
// The latent MoE layer, drawn left to right as a token's width: the 2560-wide
// hidden state, the shared down-projection D (eight groups per layer), the
// 1792-wide latent the 512 experts work at (ten lit), the up-projection U back
// to 2560. Then the bill: the D/U weights a layer reads for every token
// against the ten routed experts it reads. Bar heights are proportional to the
// widths (2560 : 1792) and to the weight counts (73.4M : 34.4M); every string
// is the storyboard's, and every number in them is the article's.
//
// steps: 0 the base: token straight into ten of 512 experts · 1 D squeezes to
//        the latent, experts shrink · 2 U widens back · 3 the bill
// params: { data, token, latent, out, d, u, experts, oldExpert, newExpert, billDU, billEx }
BESPOKE.define((() => {
  // ten lit experts of 512, fixed (a 16 x 32 grid)
  const LIT = [7, 41, 66, 130, 171, 222, 289, 340, 402, 477]
  const COLS = 16, ROWS = 32

  return {
    plan: () => ({
      min: [4.2, 4.6, 3.6, 4.8],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 10, span: 1.0 },
        { step: 1, at: .4, type: 'whoosh' },
        { step: 2, at: .4, type: 'whoosh' },
        { step: 3, at: .5, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 1.6 }, { step: 2, from: 0, to: 1.4 }, { step: 3, from: 0, to: 1.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const T = k.thumb
      const top = k.top + 10
      const CY = top + 250                 // centre line of the flow
      const WIDE = 330, LAT = WIDE * 1792 / 2560
      const squeeze = T ? 1 : i < 1 ? 0 : i > 1 ? 1 : k.ease(k.p(1, 1.4, .2))
      const widen = T ? 1 : i < 2 ? 0 : i > 2 ? 1 : k.ease(k.p(2, 1.2, .2))
      const bill = T ? 1 : i < 3 ? 0 : k.easeOut(k.p(3, 1.2, .2))
      const fade = 1 - .55 * bill

      const A = k.P.a, B = k.tone('b'), HI = k.P.hi, L = k.tone('light')

      k.push(); k.alpha(fade)
      // the token in, 2560 wide
      const xIn = 150
      k.seed('tok'); k.shape(k.rect(xIn, CY - WIDE / 2, 46, WIDE), { fill: A, op: .85, sw: .9 })
      k.text(p.token, xIn + 23, CY + WIDE / 2 + 40, { role: 'mono', size: 24, min: 14, maxW: 220, lines: 2, align: 'center' })

      // D: a trapezoid from WIDE to LAT, drawn as it squeezes
      const xD = 250, wD = 120
      const hOut = WIDE + (LAT - WIDE) * squeeze
      if (squeeze > 0) {
        k.seed('D'); k.shape([[xD, CY - WIDE / 2], [xD + wD, CY - hOut / 2], [xD + wD, CY + hOut / 2], [xD, CY + WIDE / 2]], { fill: B, op: .55 * squeeze + .05, sw: .9 })
        k.push(); k.alpha(squeeze)
        k.text(p.d, xD + wD / 2, CY - WIDE / 2 - 26, { role: 'label', size: 24, min: 14, maxW: 240, lines: 1, align: 'center' })
        k.pop()
      }
      // the latent bar
      const xL = 410
      if (squeeze > 0) {
        k.push(); k.alpha(squeeze)
        k.seed('lat'); k.shape(k.rect(xL, CY - hOut / 2, 40, hOut), { fill: B, op: .85, sw: .9 })
        k.text(p.latent, xL + 20, CY + WIDE / 2 + 40, { role: 'mono', size: 24, min: 14, maxW: 200, lines: 2, align: 'center' })
        k.pop()
      }

      // the experts: 512 cells, ten lit; cell size follows the expert's width
      const GX = 520, GW = 380
      const cw = GW / COLS
      const gh = WIDE + (LAT - WIDE) * squeeze
      const ch = gh / ROWS
      for (let c = 0; c < 512; c++) {
        const col = c % COLS, row = Math.floor(c / COLS)
        const lit = LIT.includes(c)
        const shown = T || i > 0 || k.p(0, 1.0, .3) * 512 > c
        if (!shown) continue
        k.flat(k.rect(GX + col * cw + 1, CY - gh / 2 + row * ch + .6, cw - 2, Math.max(1, ch - 1.2)), lit ? HI : L, lit ? 1 : .55)
      }
      k.seed('grid'); k.line(k.rect(GX, CY - gh / 2, GW, gh), .6, k.ink, { closed: true })
      k.text(p.experts, GX + GW / 2, CY + WIDE / 2 + 44, { role: 'label', size: 24, min: 14, maxW: 340, lines: 1, align: 'center' })
      // one expert's size, old struck through when the latent arrives
      const ex = GX + GW / 2
      k.text(p.oldExpert, ex, top + 6, { role: 'mono', size: 22, min: 12, maxW: 380, lines: 1, align: 'center', col: squeeze > .5 ? k.dim : k.ink })
      if (squeeze > .5) {
        const m = k.measure(p.oldExpert, { role: 'mono', size: 22, min: 12, maxW: 380, lines: 1 })
        k.flat(k.rect(ex - m.w / 2, top - 2, m.w, 3), k.dim, 1)
        k.push(); k.alpha(k.clamp((squeeze - .5) * 2))
        k.text(p.newExpert, ex, top + 40, { role: 'mono', size: 24, min: 12, maxW: 380, lines: 1, align: 'center', col: B })
        k.pop()
      }

      // U: back to 2560, then the token out
      const xU = 940, wU = 120
      if (widen > 0) {
        const hU = LAT + (WIDE - LAT) * widen
        k.seed('U'); k.shape([[xU, CY - LAT / 2], [xU + wU, CY - hU / 2], [xU + wU, CY + hU / 2], [xU, CY + LAT / 2]], { fill: B, op: .05 + .55 * widen, sw: .9 })
        if (widen > 0) {
          k.push(); k.alpha(widen)
          k.text(p.u, xU + wU / 2, CY - WIDE / 2 - 26, { role: 'label', size: 24, min: 14, maxW: 240, lines: 1, align: 'center' })
          k.seed('out'); k.shape(k.rect(1100, CY - WIDE / 2, 46, WIDE), { fill: A, op: .85, sw: .9 })
          k.text(p.out, 1123, CY + WIDE / 2 + 40, { role: 'mono', size: 24, min: 14, maxW: 220, lines: 2, align: 'center' })
          k.pop()
        }
      } else if (squeeze === 0) {
        // the base: experts write straight back at full width
        k.arrow([[GX + GW + 20, CY], [1090, CY]], k.ink, 1, T ? 1 : k.p(0, .8, 1.2))
      }
      k.pop()

      // the bill: two bars, proportional
      if (bill > 0) {
        const BX = 160, BW = 1000, by = CY + WIDE / 2 + 110
        const du = BW * bill, exw = BW * (34.4 / 73.4) * bill
        k.seed('billDU'); k.shape(k.rect(BX, by, du, 54), { fill: B, op: .9, sw: .9 })
        k.seed('billEx'); k.shape(k.rect(BX, by + 76, exw, 54), { fill: HI, op: .9, sw: .9 })
        k.push(); k.alpha(bill)
        k.text(p.billDU, BX + 16, by + 38, { role: 'label', size: 26, min: 14, maxW: 700, lines: 1, col: k.textOn(B) })
        k.text(p.billEx, BX + exw + 18, by + 76 + 38, { role: 'label', size: 26, min: 14, maxW: 600, lines: 1 })
        k.pop()
      }

      k.point = i === 0 ? [GX + GW / 2, CY] : i === 1 ? [xD + wD / 2, CY] : i === 2 ? [xU + wU / 2, CY] : [160 + 520, CY + WIDE / 2 + 140]
      k.mood = i === 3 ? 'surprised' : 'thinking'
    },
  }
})())
