// klm-1-6 / erase
//
// The article's EraseWrite toy, painted: one 4x4 Gated DeltaNet-2 head and
// three tokens. Left, the state S (key rows x value columns), each cell tinted
// by its value. Under it, the two gates of the current token as rails. Right,
// what a query reads back at k1 and at k2: four value channels as bars, the
// wanted value marked. The update is modeling_klm.py's recurrence():
//   r = (b * k)^T S ;  S <- S + k (w * v - r)^T      (decay 1 here)
// keys k1 = (0.8, 0.6, 0, 0), k2 = (0, 0.6, 0.8, 0), sharing channel 2.
// Values are computed here for colour and bar height only; every string drawn
// is the storyboard's.
//
// steps: 0 token 1 writes v1 at k1 · 1 token 2 writes v2 at k2 (leak) ·
//        2 token 3 rewrites k1, gates tied at 1 · 3 the same token, b = 1, w = 0.5
// params: { state, gateB, gateW, read1, read2, want1a, want1b, want2 }
BESPOKE.define((() => {
  const K1 = [0.8, 0.6, 0, 0], K2 = [0, 0.6, 0.8, 0]
  const V1 = [1, 0, 0, 0], V2 = [0, 1, 0, 0], V3 = [0, 0, 1, 0]
  const Z = () => [0, 1, 2, 3].map(() => [0, 0, 0, 0])
  function upd(S, k, v, b, w) {
    const r = [0, 1, 2, 3].map(j => S.reduce((a, row, i) => a + b * k[i] * row[j], 0))
    return S.map((row, i) => row.map((s, j) => s + k[i] * (w * v[j] - r[j])))
  }
  const read = (S, q) => [0, 1, 2, 3].map(j => S.reduce((a, row, i) => a + q[i] * row[j], 0))
  const S0 = Z()
  const S1 = upd(S0, K1, V1, 1, 1)
  const S2 = upd(S1, K2, V2, 1, 1)
  const S3 = upd(S2, K1, V3, 1, 1)
  const S4 = upd(S2, K1, V3, 1, 0.5)
  const STATES = [S1, S2, S3, S4]
  const PREV = [S0, S1, S2, S3]
  const GATES = [[1, 1], [1, 1], [1, 1], [1, 0.5]]

  return {
    plan: () => ({
      min: [4.0, 4.6, 5.0, 5.0],
      events: [
        { step: 0, at: .3, type: 'write' },
        { step: 1, at: .3, type: 'write' },
        { step: 2, at: .3, type: 'scratch' },
        { step: 3, at: .3, type: 'slide' },
      ],
      motion: [{ step: 0, from: 0, to: 1.4 }, { step: 1, from: 0, to: 1.4 }, { step: 2, from: 0, to: 1.4 }, { step: 3, from: 0, to: 1.4 }],
    }),
    stampAt: k => [1180, k.top - 60],
    draw(k) {
      const p = k.params, i = k.step
      const t = k.thumb ? 1 : k.ease(k.p(i, 1.2, .2))
      const lerpM = (A, B) => A.map((row, r) => row.map((x, c) => x + (B[r][c] - x) * t))
      const S = lerpM(PREV[i], STATES[i])
      const A = k.P.a, HI = k.P.hi, L = k.tone('light')
      const top = k.top + 20

      // the state grid
      const GX = 150, GY = top + 70, C = 104
      k.text(p.state, GX + 2 * C, top + 20, { role: 'label', size: 26, min: 14, maxW: 460, lines: 1, align: 'center' })
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const v = S[r][c], m = Math.min(1, Math.abs(v))
          const col = k.mix(k.paper, v >= 0 ? A : HI, m)
          k.flat(k.rect(GX + c * C + 4, GY + r * C + 4, C - 8, C - 8), col, 1)
        }
      }
      // channel 2 is the one k1 and k2 share
      const shared = i >= 1 ? (k.thumb ? 1 : i === 1 ? k.p(1, .8, .6) : 1) : 0
      if (shared > 0) { k.seed('shared'); k.line(k.rect(GX, GY + C, 4 * C, C), 1.1, HI, { closed: true }) }
      k.seed('grid'); k.line(k.rect(GX, GY, 4 * C, 4 * C), .9, k.ink, { closed: true })

      // the gates of the current token
      const [b0, w0] = i === 3 ? GATES[2] : GATES[i]
      const [b1, w1] = GATES[i]
      const gb = b0 + (b1 - b0) * t, gw = w0 + (w1 - w0) * t
      const RY = GY + 4 * C + 60, RW = 4 * C
      const rails = [[p.gateB, gb, A], [p.gateW, gw, k.tone('b')]]
      rails.forEach(([lab, v, col], n) => {
        const y = RY + n * 74
        k.text(lab, GX, y, { role: 'mono', size: 24, min: 13, maxW: RW, lines: 1 })
        k.flat(k.rect(GX, y + 16, RW, 16), L, .8)
        k.seed('rail' + n); k.shape(k.rect(GX, y + 16, Math.max(4, RW * v), 16), { fill: col, op: .95, sw: .7 })
      })
      const gateNote = k.s.gates
      if (gateNote) k.text(gateNote, GX + RW / 2, RY + 170, { role: 'label', size: 26, min: 14, maxW: RW + 80, lines: 1, align: 'center', col: k.ink })

      // the two readouts
      const panels = [[p.read1, read(S, K1), i >= 2 ? V3 : V1, i >= 2 ? p.want1b : p.want1a], [p.read2, read(S, K2), V2, p.want2]]
      const BASE = top + 470, H = 300, BW = 58, GAP = 16
      panels.forEach(([lab, y, want, wantLab], n) => {
        const PX = 690 + n * 350
        const show = n === 0 || i >= 1
        if (!show) return
        const al = n === 1 && i === 1 && !k.thumb ? k.p(1, .6) : 1
        const focusK2 = n === 1 && i === 2
        k.push(); k.alpha(al)
        k.text(lab, PX + 2 * (BW + GAP) - GAP / 2, top + 20, { role: 'head', size: 34, min: 16, maxW: 320, lines: 1, align: 'center', col: focusK2 ? HI : k.ink })
        k.seed('base' + n); k.line([[PX - 10, BASE], [PX + 4 * (BW + GAP), BASE]], .8, k.ink)
        for (let j = 0; j < 4; j++) {
          const v = y[j], x = PX + j * (BW + GAP)
          const h = Math.min(1, Math.abs(v)) * H
          if (h > 2) {
            k.seed(`bar${n}${j}`)
            k.shape(v >= 0 ? k.rect(x, BASE - h, BW, h) : k.rect(x, BASE, BW, h), { fill: v >= 0 ? A : HI, op: .9, sw: .7 })
          }
          if (want[j] > 0) {
            k.seed(`want${n}${j}`); k.line([[x - 6, BASE - H], [x + BW + 6, BASE - H]], 1.2, k.ink)
          }
        }
        k.text(wantLab, PX + 2 * (BW + GAP) - GAP / 2, BASE + 130, { role: 'label', size: 24, min: 13, maxW: 320, lines: 2, align: 'center', col: k.dim })
        k.pop()
      })

      k.point = i === 1 ? [GX + 2 * C, GY + 1.5 * C] : i === 2 ? [1040 + 140, BASE - 150] : i === 3 ? [GX + RW / 2, RY + 90] : [690 + 140, BASE - 150]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'proud' : 'thinking'
    },
  }
})())
