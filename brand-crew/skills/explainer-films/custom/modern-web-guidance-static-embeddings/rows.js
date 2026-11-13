// modern-web-guidance-static-embeddings / rows
//
// The seven-line loop, drawn. Left: the word table, a stack of thin Int8 rows
// (the real one is 29,165 rows of 256; here 22 rows of 32 cells). A query
// lights its words' rows; each lit row is scaled by its one number and
// travels to the accumulator on the right, where its cells add into the
// output vector bar by bar. Then the vector is normalised and compared with
// the guides, and the best one lights. A seeded toy (the engine stamps it
// Illustrative); every label is a storyboard string.
//
// steps: 0 the table · 1 the query's rows light · 2 scale and add · 3 normalise, compare, pick
// params: { table, words: [3], scale, out, guides: [4], best }
BESPOKE.define((() => {
  let s = 7 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const NR = 22, NC = 32
  const ROWS = Array.from({ length: NR }, () => Array.from({ length: NC }, () => rnd() * 2 - 1))
  const PICK = [4, 11, 17] // the query's rows
  const W = [1.25, 0.85, 0.45] // their weights (scale x f), toy
  // make the three picked rows share a direction so the sum has a clear shape
  const shape = Array.from({ length: NC }, (_, c) => (c % 7 < 3 ? 0.8 : -0.5) + (rnd() - 0.5) * 0.6)
  PICK.forEach((r, j) => { for (let c = 0; c < NC; c++) ROWS[r][c] = 0.55 * shape[c] + 0.45 * ROWS[r][c] * (j === 2 ? 1.4 : 1) })
  const partial = (n) => Array.from({ length: NC }, (_, c) => PICK.slice(0, n).reduce((a, r, j) => a + W[j] * ROWS[r][c], 0))
  const SUM = partial(3)
  const NORM = Math.sqrt(SUM.reduce((a, v) => a + v * v, 0))
  const MAXS = Math.max(...SUM.map(Math.abs))

  return {
    plan: () => ({
      min: [3.2, 3.4, 5.2, 4.6],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 22, span: 1.1 },
        { step: 1, at: .3, type: 'ticks', n: 3, span: .9 },
        { step: 2, at: .4, type: 'ticks', n: 12, span: 3.2 },
        { step: 3, at: 2.0, type: 'ding' },
      ],
      motion: 'all',
    }),
    stampAt: k => [1290, k.top + 4],
    draw(k) {
      const p = k.params, i = k.step
      const words = p.words || []
      const TX = 300, TW = 360, TY = k.top + 60, RH = Math.min(26, (840 - TY) / NR), CW = TW / NC
      const lit = k.thumb || i >= 1 ? 1 : 0
      const litT = k.thumb ? 1 : i > 1 ? 1 : i === 1 ? k.easeOut(k.p(1, .8, .2)) : 0

      // the table caption
      k.text(p.table || '', TX, TY - 22, { role: 'mono', size: 24, min: 14, maxW: 520, lines: 1, col: k.dim })
      // the table: every row a strip of grey cells; the query's rows tinted
      const tableIn = k.thumb ? 1 : k.easeOut(k.p(0, 1.2, 0))
      for (let r = 0; r < NR; r++) {
        if (r / NR > tableIn) break
        const y = TY + r * RH
        const pi = PICK.indexOf(r)
        for (let c = 0; c < NC; c++) {
          const v = ROWS[r][c]
          const base = k.mix(k.paper, k.ink, .12 + .28 * Math.abs(v))
          const col = pi >= 0 && lit ? k.mix(base, [k.P.a, k.P.b, k.P.hi][pi], litT * (.5 + .5 * Math.abs(v))) : base
          k.flat(k.rect(TX + c * CW + .5, y + 2, CW - 1, RH - 4), col, 1)
        }
        if (pi >= 0 && lit) {
          k.push(); k.alpha(litT)
          k.text(words[pi] || '', TX - 18, y + RH * .72, { role: 'mono', size: 26, min: 14, maxW: 170, lines: 1, align: 'right' })
          k.pop()
        }
      }
      k.seed('table'); k.line(k.rect(TX, TY, TW, NR * RH), .8, k.ink, { closed: true })

      // the accumulator: the output vector as 32 bars around a baseline
      const AX = 820, AW = 520, AY = TY + 230, AH = 150, BW = AW / NC
      const showAcc = k.thumb || i >= 2
      if (showAcc) {
        const n = k.thumb || i > 2 ? 3 : Math.min(3, Math.floor(k.since(2) / 1.4))
        const t = k.thumb || i > 2 ? 1 : k.ease(k.clamp((k.since(2) - n * 1.4) / 1.0, 0, 1))
        const prev = partial(n), next = partial(Math.min(3, n + 1))
        // travelling row: the next row flies from the table to the accumulator
        if (!k.thumb && i === 2 && n < 3) {
          const r = PICK[n], fly = k.ease(k.clamp((k.since(2) - n * 1.4) / .7, 0, 1))
          const from = [TX, TY + r * RH], to = [AX, AY - 20]
          const at = k.arc(from, to, 80, fly)
          k.push(); k.alpha(1 - .6 * fly)
          for (let c = 0; c < NC; c++) k.flat(k.rect(at[0] + c * (AW / NC) * fly + c * CW * (1 - fly), at[1], CW, RH - 4), [k.P.a, k.P.b, k.P.hi][n], 1)
          k.pop()
        }
        const normT = k.thumb ? 1 : i > 3 ? 1 : i === 3 ? k.ease(k.p(3, 1.2, .2)) : 0
        for (let c = 0; c < NC; c++) {
          let v = prev[c] + (next[c] - prev[c]) * (n < 3 ? t : 0)
          if (n >= 3) v = SUM[c]
          const sc = (1 - normT) / MAXS + normT * (1 / NORM) * (NC / 9)
          const hgt = Math.max(-1, Math.min(1, v * sc)) * AH
          const x = AX + c * BW + 1
          k.flat(k.rect(x, hgt > 0 ? AY - hgt : AY, BW - 2, Math.abs(hgt) + 1), normT > .5 ? k.P.a : k.mix(k.P.b, k.P.a, normT), 1)
        }
        k.seed('base'); k.line([[AX - 10, AY], [AX + AW + 10, AY]], .7, k.ink)
        k.text(p.out || '', AX, AY + AH + 50, { role: 'mono', size: 24, min: 14, maxW: AW, lines: 1, col: k.dim })
        if (p.scale) k.text(p.scale, AX, TY - 22, { role: 'mono', size: 24, min: 14, maxW: 340, lines: 1 })
      }

      // compare: the guides, best one lit
      if (k.thumb || i >= 3) {
        const g = p.guides || [], GY = AY + AH + 110
        const appear = k.thumb ? 1 : k.easeOut(k.p(3, 1, 1.0))
        const pick = k.thumb ? 1 : k.ease(k.p(3, .6, 2.0))
        g.forEach((name, j) => {
          const y = GY + j * 46
          k.push(); k.alpha(appear * (j === 0 ? 1 : 1 - .45 * pick))
          k.text(name, AX + 30, y, { role: 'mono', size: 24, min: 13, maxW: AW - 40, lines: 1, col: j === 0 && pick > .5 ? k.ink : k.dim })
          k.pop()
          if (j === 0 && pick > 0) { k.seed('pick'); k.line(k.circle(AX + 10, y - 8, 9), .9, k.P.hi) }
        })
        k.point = [AX + 10, GY - 8]
      } else if (showAcc) {
        k.point = [AX + AW / 2, AY - 40]
      } else {
        k.point = [TX + TW, TY + (i >= 1 ? PICK[1] * RH : NR * RH / 2)]
      }
      k.mood = i >= 3 ? 'proud' : 'thinking'
    },
  }
})())
