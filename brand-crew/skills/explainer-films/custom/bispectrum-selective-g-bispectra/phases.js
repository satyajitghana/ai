// bispectrum-selective-g-bispectra / phases
//
// The article's ShiftLab as a moving picture, for a periodic signal made of three harmonics.
// The signal slides the whole scene long (a cyclic shift, continuously). Four beats:
//   0  shift: three phase dials, one per harmonic, spin at one, two and three times the shift rate
//   1  power: under each dial, a bar of the needle's length; the bars never move while the needles turn
//   2  twin: a second waveform with the same three lengths and other phases; the same bars
//   3  triple: the product F1 F2 conj(F3) on one big dial: the turns cancel, so the needle holds still,
//      and the twin's needle points somewhere else
// Geometry only; every string comes from params. A toy signal, so the runtime stamps it Illustrative.
//
// params: { heads: [4 strings], dials: [3 strings], power, twin, signal, triple }
BESPOKE.define((() => {
  const AMP = [1.0, .7, .45]
  const PH = [-.4, 1.1, -2.0]
  const PH2 = [1.7, -.3, .9]           // the twin: same amplitudes, other phases
  const RATE = .55                      // radians of shift per second
  const wave = (ph, s, x) => AMP[0] * Math.cos(x - s + ph[0]) + AMP[1] * Math.cos(2 * (x - s) + ph[1]) + AMP[2] * Math.cos(3 * (x - s) + ph[2])
  const tri = ph => ph[0] + ph[1] - ph[2]
  return {
    stampAt: k => [1250, k.top + 24],
    plan: () => ({
      min: [5.6, 4.6, 4.8, 6.0],
      events: [{ step: 1, at: .4, type: 'pop' }, { step: 2, at: .3, type: 'whoosh' }, { step: 3, at: .6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.thumb ? 3 : k.step
      const s = k.thumb ? .8 : k.lt * RATE
      const Y = Math.max(k.top + 60, 230)
      const head = (p.heads || [])[st]
      if (head) k.text(head, 140, Y - 24, { role: 'head', size: 34, min: 14, maxW: 1220, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // waveform panel
      const WX0 = 140, WX1 = 740, WY = Y + 150, WA = 52
      k.seed('axis'); k.line([[WX0, WY], [WX1, WY]], 1, k.dim)
      const path = ph => Array.from({ length: 97 }, (_, i) => {
        const x = (i / 96) * 2 * Math.PI
        return [WX0 + (i / 96) * (WX1 - WX0), WY - WA * wave(ph, s, x)]
      })
      k.line(path(PH), 1.6, k.P.a)
      if (p.signal) k.text(p.signal, WX0, WY + 120, { role: 'mono', size: 22, min: 11, maxW: 300, lines: 1, col: k.P.a })
      if (st >= 2) {
        const a = k.thumb || st > 2 ? 1 : k.easeOut(k.p(2, .8, .2))
        k.push(); k.alpha(a)
        k.line(path(PH2), 1.4, k.P.b)
        if (p.twin) k.text(p.twin, WX0 + 320, WY + 120, { role: 'mono', size: 22, min: 11, maxW: 280, lines: 1, col: k.P.b })
        k.pop()
      }

      // three harmonic dials
      const DX = [880, 1060, 1240], DY = Y + 120, R = 66
      for (let j = 0; j < 3; j++) {
        const ang = PH[j] - (j + 1) * s
        k.seed('dial' + j); k.line(k.circle(DX[j], DY, R, 40), .7, k.dim, { closed: true })
        const len = R * AMP[j] * .92
        // the needles keep turning in every beat: the turn is what the triple product cancels
        k.line([[DX[j], DY], [DX[j] + len * Math.cos(ang), DY - len * Math.sin(ang)]], 1.8, k.P.a)
        if (st >= 2) {
          const a2 = k.thumb || st > 2 ? 1 : k.easeOut(k.p(2, .8, .2)), ang2 = PH2[j] - (j + 1) * s
          k.push(); k.alpha(a2)
          k.line([[DX[j], DY], [DX[j] + len * .8 * Math.cos(ang2), DY - len * .8 * Math.sin(ang2)]], 1.6, k.P.b)
          k.pop()
        }
        if (p.dials && p.dials[j]) k.text(p.dials[j], DX[j], DY + R + 34, { role: 'mono', size: 20, min: 10, maxW: 170, lines: 1, align: 'center', col: k.dim })
        // the power spectrum: a bar of the needle's length, still
        if (st >= 1) {
          const g = k.thumb || st > 1 ? 1 : k.easeOut(k.p(1, .9, .3))
          const bh = 150 * AMP[j] * AMP[j] * g
          const BY = Y + 420
          k.flat(k.rect(DX[j] - 26, BY - bh, 24, bh), k.P.a, .85)
          if (st >= 2) k.flat(k.rect(DX[j] + 2, BY - bh, 24, bh), k.P.b, .85)
          if (j === 0) { k.seed('base'); k.line([[DX[0] - 70, BY], [DX[2] + 70, BY]], 1.2, k.dim) }
        }
      }
      if (st >= 1 && p.power) k.text(p.power, DX[1], Y + 470, { role: 'body', size: 24, min: 12, maxW: 460, lines: 1, align: 'center', col: k.dim })

      // the triple product
      if (st >= 3) {
        const a = k.thumb ? 1 : k.easeOut(k.p(3, .9, .2))
        const TX = 300, TY = Y + 400, TR = 105
        k.push(); k.alpha(a)
        k.seed('tri'); k.line(k.circle(TX, TY, TR, 56), .8, k.dim, { closed: true })
        const a1 = tri(PH), a2 = tri(PH2)
        k.line([[TX, TY], [TX + TR * .9 * Math.cos(a1), TY - TR * .9 * Math.sin(a1)]], 2.4, k.P.a)
        k.line([[TX, TY], [TX + TR * .75 * Math.cos(a2), TY - TR * .75 * Math.sin(a2)]], 2.2, k.P.b)
        if (p.triple) k.text(p.triple, TX + TR + 36, TY - 30, { role: 'body', size: 26, min: 12, maxW: 330, lines: 3 })
        k.pop()
      }

      k.point = st === 0 ? [DX[1], DY] : st === 1 ? [DX[1], Y + 380] : st === 2 ? [WX1 - 120, WY] : [300, Y + 400]
      k.mood = st === 3 ? 'excited' : st === 2 ? 'surprised' : 'neutral'
    },
  }
})())
