// painted-valley-patch / kuwahara
//
// The valley's paint finish, as a moving picture. Left: a patch of the frame as
// pixels, two colours meeting at an edge, each speckled. A window centred on one
// pixel by the edge is cut into four overlapping quadrants; each quadrant's
// spread shows as a bar; the calmest (the one wholly on one side of the edge)
// wins, and the pixel takes its mean. Then the window sweeps the patch and the
// right-hand copy fills in: flat areas, the edge kept. A seeded toy, so the
// runtime stamps it Illustrative; every label is a storyboard string.
//
// steps: 0 the pixels · 1 the window and its quadrants · 2 the calmest wins ·
//        3 the sweep · 4 the result side by side
// params: { input, output, quads, calm, edge }
BESPOKE.define((() => {
  const N = 11, R = 2, CELL = 50, GAP = 4
  const X_IN = 130, X_OUT = 130 + N * CELL + 90
  const CX = 5, CY = 5
  // the picture: two paints meeting at a slanted edge, each speckled
  let s = 7 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const cells = []
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const side = i > j * 0.55 + 3.2 ? 1 : 0
    cells.push({ side, n: (rnd() - 0.5) * 0.7 })
  }
  const at = (i, j) => cells[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))]
  // a quadrant's mean (fraction of side 1, mean speckle) and spread
  const quad = (i, j, q) => {
    const sx = q % 2 === 0 ? -R : 0, sy = q < 2 ? -R : 0
    let f = 0, m = 0, m2 = 0, n = 0
    for (let y = 0; y <= R; y++) for (let x = 0; x <= R; x++) {
      const c = at(i + sx + x, j + sy + y)
      f += c.side; m += c.n; m2 += c.n * c.n; n++
    }
    f /= n; m /= n
    const spread = f * (1 - f) * 4 + Math.max(0, m2 / n - m * m) * 2.5
    return { f, m, spread, sx, sy }
  }
  const out = cells.map((_, k) => {
    const i = k % N, j = Math.floor(k / N)
    let best = null
    for (let q = 0; q < 4; q++) { const Q = quad(i, j, q); if (!best || Q.spread < best.spread) best = { ...Q, q } }
    return best
  })
  const centreQuads = [0, 1, 2, 3].map(q => quad(CX, CY, q))
  const win = centreQuads.reduce((b, Q, q) => (Q.spread < centreQuads[b].spread ? q : b), 0)

  const colOf = (k, side, n) => {
    const base = side >= 0.5 ? k.P.b : k.P.a
    const other = side >= 0.5 ? k.P.a : k.P.b
    const mixed = side > 0 && side < 1 ? k.mix(base, other, Math.min(side, 1 - side)) : base
    return n >= 0 ? k.mix(mixed, k.paper, Math.min(0.6, n)) : k.mix(mixed, k.ink, Math.min(0.5, -n * 0.8))
  }
  const cellBox = (x0, y0, i, j) => k0 => k0.rect(x0 + i * CELL + GAP / 2, y0 + j * CELL + GAP / 2, CELL - GAP, CELL - GAP)
  const QCOL = ['a', 'b', 'hi', 'light']

  return {
    stampAt: k => [1290, k.top + 40 + N * CELL + 50],
    plan: () => ({
      min: [3.2, 4.2, 4.4, 5.6, 3.6],
      events: [
        { step: 1, at: .3, type: 'draw' }, { step: 2, at: 1.6, type: 'ding' },
        { step: 3, at: .2, type: 'ticks', n: 14, span: 4.2 }, { step: 4, at: .3, type: 'pop' },
      ],
      motion: [{ step: 3, from: 0, to: 5.0 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const y0 = k.top + 40
      // the input pixels
      const ik = k.thumb ? 1 : k.easeOut(k.p(0, .9))
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const c = at(i, j)
        const d = (i + j) / (2 * N)
        const a = k.clamp((ik - d * .5) / .5)
        if (a <= 0) continue
        k.flat(cellBox(X_IN, y0, i, j)(k), colOf(k, c.side, c.n), a)
      }
      k.text(p.input || '', X_IN, y0 - 18, { role: 'label', size: 28, col: k.dim })

      // the window and its quadrants around the centre pixel
      if (st >= 1 && st <= 2) {
        const wk = k.easeOut(k.p(1, .8))
        k.push(); k.alpha(wk)
        k.seed('window'); k.line(k.rect(X_IN + (CX - R) * CELL, y0 + (CY - R) * CELL, (2 * R + 1) * CELL, (2 * R + 1) * CELL), 1.3, k.ink, { closed: true })
        for (let q = 0; q < 4; q++) {
          const Q = centreQuads[q]
          const qk = k.thumb ? 1 : k.easeOut(k.p(1, .5, .4 + q * .35))
          if (qk <= 0) continue
          const inset = 6 + q * 3
          const x = X_IN + (CX + Q.sx) * CELL + inset, y = y0 + (CY + Q.sy) * CELL + inset
          const w = (R + 1) * CELL - 2 * inset
          const winner = st === 2 && q === win
          const fade = st === 2 && q !== win ? 1 - .7 * k.easeOut(k.p(2, .6, 1.4)) : 1
          k.push(); k.alpha(qk * fade)
          k.seed('q' + q); k.line(k.rect(x, y, w, w), winner ? 1.4 : .9, k.tone(QCOL[q]), { closed: true })
          k.pop()
        }
        k.pop()
        k.text(p.quads || '', X_OUT, y0 + 10, { role: 'head', size: 34, maxW: 520, lines: 2 })
        // spread bars, one per quadrant
        for (let q = 0; q < 4; q++) {
          const Q = centreQuads[q]
          const bk = k.thumb ? 1 : k.easeOut(k.p(st === 2 ? 2 : 1, .7, st === 2 ? q * .2 : 99))
          if (bk <= 0) continue
          const y = y0 + 120 + q * 70
          const len = 40 + Math.min(1, Q.spread) * 380
          const winner = q === win
          k.seed('bar' + q)
          k.shape(k.rect(X_OUT, y, len * bk, 36), { fill: k.tone(QCOL[q]), op: winner ? .95 : .55, sw: .7 })
          k.flat(k.rect(X_OUT + len * bk + 20, y + 4, 28, 28), colOf(k, Q.f, Q.m), bk)
        }
        if (st === 2) {
          const ck = k.easeOut(k.p(2, .6, 1.4))
          k.push(); k.alpha(ck)
          k.text(p.calm || '', X_OUT, y0 + 430, { role: 'body', size: 32, maxW: 520, lines: 2 })
          k.pop()
          // the centre pixel takes the winner's mean
          const Q = centreQuads[win]
          k.flat(cellBox(X_IN, y0, CX, CY)(k), colOf(k, Q.f, Q.m), ck)
          k.seed('centre'); k.line(k.rect(X_IN + CX * CELL, y0 + CY * CELL, CELL, CELL), 1.2, k.ink, { closed: true })
          k.point = [X_IN + (CX + .5) * CELL, y0 + (CY + .5) * CELL]; k.mood = 'thinking'
        } else {
          k.point = [X_IN + (CX + .5) * CELL, y0 + (CY + .5) * CELL]
        }
      }

      // the sweep: the output fills cell by cell as the window passes
      if (st >= 3 || k.thumb) {
        const sw = k.thumb || st > 3 ? 1 : k.clamp(k.since(3) / 4.6)
        const done = Math.floor(sw * N * N)
        k.text(p.output || '', X_OUT, y0 - 18, { role: 'label', size: 28, col: k.dim })
        for (let c = 0; c < Math.min(done + 1, N * N); c++) {
          const i = c % N, j = Math.floor(c / N)
          const o = out[c]
          const a = c < done ? 1 : sw * N * N - done
          k.flat(cellBox(X_OUT, y0, i, j)(k), colOf(k, o.f, o.m * .25), a)
        }
        if (st === 3 && !k.thumb && done < N * N) {
          const i = done % N, j = Math.floor(done / N)
          k.seed('sweep'); k.line(k.rect(X_IN + (i - R) * CELL, y0 + (j - R) * CELL, (2 * R + 1) * CELL, (2 * R + 1) * CELL), 1.1, k.ink, { closed: true })
          k.point = [X_OUT + (i + .5) * CELL, y0 + (j + .5) * CELL]
        }
        if (st === 4 || k.thumb) {
          const ek = k.thumb ? 1 : k.easeOut(k.p(4, .7))
          k.push(); k.alpha(ek)
          const w = k.measure(p.edge || '', { role: 'body', size: 30 }).w + 36
          k.seed('edgehl'); k.hl(X_OUT - 6, y0 + N * CELL + 22, w, 50, k.P.hi, ek)
          k.text(p.edge || '', X_OUT + 12, y0 + N * CELL + 58, { role: 'body', size: 30 })
          k.pop()
          if (!k.thumb) { k.point = [X_OUT + N * CELL / 2, y0 + N * CELL / 2]; k.mood = 'proud' }
        }
      }
    },
  }
})())
