// meteor-driving / depthgate
//
// The article's depth-gated lift, animated on a toy. Left: a top-down ground
// grid around the car, the way METEOR lays its 800 x 500 BEV, here 10 x 9
// cells. A parked car sits straight ahead. One camera looks forward; the ray
// through one pixel crosses every cell in that column. Plain IPM paints the
// pixel's feature onto all of them (the smear behind the car). Right: the
// depth head's probability over bins along that ray, peaked at the car. The
// gate w = P + 0.05 re-weights each cell by that probability, so only the car's
// cell keeps the feature. Then a second camera from the side, whose ray
// crosses the same cell, and the weighted average across cameras. The cell
// counts and the probabilities are a toy, so the runtime stamps it
// Illustrative.
//
// steps: 0 grid, car, camera · 1 plain IPM smears the ray · 2 depth
//        probability along the ray · 3 the gate keeps one cell · 4 a second
//        camera agrees, weighted average
// params: { legend: [5], depthLabel, gateLabel, camA, camB }
BESPOKE.define((() => {
  const ROWS = 10, COLS = 9, C = 46
  const RAY_COL = 4, CAR_ROW = 3
  // toy depth distribution along the forward ray, nearest cell first (d = 0 is row 9)
  const P = [0.01, 0.01, 0.02, 0.03, 0.06, 0.17, 0.44, 0.17, 0.06, 0.03]
  // the side camera's distribution along its ray, nearest column first (col 0 nearest)
  const Q = [0.02, 0.04, 0.12, 0.3, 0.36, 0.1, 0.03, 0.02, 0.01]
  const FLOOR = 0.05
  const PEAK = 0.44 + FLOOR
  return {
    stampAt: k => [1250, Math.max(k.top + 40, 250) + 500],
    plan: () => ({
      min: [3.6, 4.2, 4, 4.4, 4.6],
      events: [
        { step: 0, at: .3, type: 'slide' },
        { step: 1, at: .2, type: 'ticks', n: 10, span: 1.6 },
        { step: 2, at: .2, type: 'ticks', n: 10, span: 1.4 },
        { step: 3, at: .4, type: 'whoosh' },
        { step: 3, at: 1.6, type: 'ding' },
        { step: 4, at: .3, type: 'slide' },
        { step: 4, at: 2, type: 'thunk' },
      ],
      motion: [{ step: 0, from: 0, to: 1.4 }, { step: 1, from: 0, to: 2 }, { step: 2, from: 0, to: 1.8 }, { step: 3, from: 0, to: 2 }, { step: 4, from: 0, to: 2.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const at = (st, d, delay) => (k.thumb ? 1 : k.p(st, d, delay))
      const GX = 230, GY = Math.max(k.top + 40, 250)
      const cx = c => GX + c * C, cy = r => GY + r * C
      const feat = k.P.a, gateCol = k.P.b

      // the ground grid
      k.seed('grid')
      const a0 = at(0, 1, 0)
      for (let r = 0; r <= ROWS; r++) k.line([[GX, cy(r)], [GX + COLS * C * a0, cy(r)]], .5, k.dim)
      for (let c = 0; c <= COLS; c++) k.line([[cx(c), GY], [cx(c), GY + ROWS * C * a0]], .5, k.dim)

      // the ego car and its forward camera, below the grid
      const egoX = cx(RAY_COL) + C / 2, egoY = cy(ROWS) + 34
      k.seed('ego'); k.shape(k.rrect(egoX - 22, egoY - 18, 44, 60, 10), { fill: k.mix(k.paper, k.ink, .25), op: .9, sw: .8 })
      k.flat(k.circle(egoX, egoY - 18, 7, 12), k.ink, 1)
      if (p.camA) k.text(p.camA, egoX + 40, egoY + 4, { role: 'label', size: 22, min: 12, maxW: 260, lines: 1, alpha: a0 })

      // the parked car in the ray's column
      k.seed('parked')
      k.shape(k.rrect(cx(RAY_COL) + 8, cy(CAR_ROW) + 4, C - 16, C - 8, 8), { fill: k.mix(k.paper, k.ink, .55), op: .9 * a0, sw: .8 })

      // cell weight along the forward ray: d = 0 nearest
      const dOf = r => ROWS - 1 - r
      const smear = i >= 1 ? at(1, 1.6, .2) : 0
      const gate = i >= 3 ? k.ease(at(3, 1.4, .3)) : 0
      for (let r = ROWS - 1; r >= 0; r--) {
        const d = dOf(r)
        const reach = Math.max(0, Math.min(1, smear * ROWS - d))
        if (reach <= 0) continue
        const plain = .62
        const gated = Math.min(1, (P[d] + FLOOR) / PEAK) * .9
        const a = reach * (plain + (gated - plain) * gate)
        k.flat(k.rect(cx(RAY_COL) + 3, cy(r) + 3, C - 6, C - 6), feat, a)
      }
      // the ray itself
      if (i >= 1) {
        const ra = k.thumb ? 1 : k.easeOut(k.p(1, 1.2, 0))
        k.seed('rayA'); k.line([[egoX, egoY - 18], [egoX, egoY - 18 - (egoY - 18 - GY + 10) * ra]], 1, k.ink)
      }

      // right panel: the depth head's probability per bin along the ray
      const BX = 820, BW = 520, BY = GY + 60, BH = 330
      if (i >= 2) {
        const ba = at(2, 1.4, .1)
        if (p.depthLabel) k.text(p.depthLabel, BX, BY - 30, { role: 'label', size: 24, min: 12, maxW: BW, lines: 2 })
        k.seed('axis'); k.line([[BX, BY + BH], [BX + BW, BY + BH]], .7, k.ink)
        const bw = BW / P.length
        P.forEach((v, d) => {
          const grow = Math.max(0, Math.min(1, ba * P.length - d))
          const h = (v / 0.44) * (BH - 40) * k.easeOut(grow)
          if (h > 0.5) { k.seed('bar' + d); k.shape(k.rect(BX + d * bw + 6, BY + BH - h, bw - 12, h), { fill: d === 6 ? feat : k.mix(k.paper, k.ink, .35), op: .85, sw: .6 }) }
        })
        // the floor
        if (i >= 3) {
          const fy = BY + BH - (FLOOR / 0.44) * (BH - 40)
          const fa = at(3, .8, .2)
          k.seed('floor'); k.line([[BX, fy], [BX + BW * fa, fy]], .9, gateCol)
          if (p.gateLabel) k.text(p.gateLabel, BX, BY + BH + 44, { role: 'mono', size: 24, min: 12, maxW: BW, lines: 1, col: gateCol, alpha: fa })
        }
      }

      // a second camera from the side: its ray crosses the same cell
      if (i >= 4) {
        const sa = at(4, 1.2, .1), wa = k.ease(at(4, 1.2, 1.2))
        const sx = GX - 50, sy = cy(CAR_ROW) + C / 2
        k.seed('egoB'); k.flat(k.circle(sx, sy, 9, 14), k.ink, sa)
        if (p.camB) k.text(p.camB, sx - 20, sy - 54, { role: 'label', size: 22, min: 12, maxW: 300, lines: 1, alpha: sa })
        k.seed('rayB'); k.line([[sx + 9, sy], [sx + 9 + (GX + COLS * C - sx - 9) * sa, sy]], 1, k.ink)
        for (let c = 0; c < COLS; c++) {
          const reach = Math.max(0, Math.min(1, sa * COLS - c))
          if (reach <= 0 || c === RAY_COL) continue
          k.flat(k.rect(cx(c) + 3, cy(CAR_ROW) + 3, C - 6, C - 6), gateCol, reach * Math.min(1, (Q[c] + FLOOR) / PEAK) * .8)
        }
        // the agreed cell
        k.seed('ring'); k.line(k.circle(cx(RAY_COL) + C / 2, cy(CAR_ROW) + C / 2, 38 * (0.6 + 0.4 * wa), 40), 1.4 * wa + .1, k.P.hi, { closed: true })
      }

      // legend for the beat
      const lg = p.legend && p.legend[i]
      if (lg) k.text(lg, 230, Math.min(cy(ROWS) + 120, 910), { role: 'head', size: 30, min: 16, maxW: 1120, lines: 1 })

      k.point = i >= 2 && i <= 3 ? [BX + 6.5 * (BW / P.length), BY + BH - 200] : [cx(RAY_COL) + C / 2, cy(CAR_ROW) + C / 2]
      k.mood = i === 1 ? 'surprised' : i === 3 ? 'happy' : i === 4 ? 'proud' : 'thinking'
    },
  }
})())
