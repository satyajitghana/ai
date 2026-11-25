// memonce / pool
//
// The article's MemoryWalk as a moving picture: write once, index once, read in every layer.
// A toy conversation of 20 turns (the checkpoint keeps 64 states per turn, a window of 16 blocks
// and retrieves 64; here a window of 4 and K of 5). Four beats:
//   0  write: each turn arrives as a long bar; only its tail is kept and drops into the pool
//   1  window: the newest blocks light up as the short window, always read
//   2  index: the question's key scores every older block once; the top K lift out
//   3  read: the lifted blocks and the window fan out into the eight attention layers
// Geometry only; every string comes from params. Toy data, so the runtime stamps it Illustrative.
//
// params: { heads: [4 strings], pool, window, question, layers, tail }
BESPOKE.define((() => {
  const N = 20, WIN = 4, K = 5, LAYERS = 8
  // fixed toy relevance per block (higher = closer to the question)
  const REL = [.2, .7, .1, .3, .9, .2, .1, .6, .3, .2, .8, .1, .4, .2, .75, .3]
  const order = REL.map((r, i) => [r, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, K).map(x => x[1])
  const PICK = new Set(order)
  return {
    stampAt: k => [1230, k.top + 24],
    plan: () => ({
      min: [5.4, 3.6, 4.8, 5.2],
      events: [{ step: 0, at: .4, type: 'ticks', n: 20, span: 3.6 }, { step: 1, at: .3, type: 'pop' },
        { step: 2, at: 1.2, type: 'whoosh' }, { step: 3, at: .6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 140, X1 = 1360
      const Y = Math.max(k.top + 70, 240)
      const cw = (X1 - X0) / N
      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, Y - 30, { role: 'head', size: 32, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // pool shelf
      const PY = Y + 230, BH = 70
      k.seed('shelf'); k.line([[X0 - 10, PY + BH + 14], [X1 + 10, PY + BH + 14]], 1.4, k.dim)
      if (p.pool) k.text(p.pool, X0, PY + BH + 52, { role: 'mono', size: 22, min: 11, maxW: 500, lines: 1, col: k.dim })

      for (let i = 0; i < N; i++) {
        // step 0: turn i arrives as a bar, then its tail drops
        const t0 = k.thumb ? 1 : st > 0 ? 1 : k.clamp((k.since(0) - .2 - i * .17) / .9, 0, 1)
        const bx = X0 + i * cw + 4, bw = cw - 8
        if (st === 0 && t0 > 0 && t0 < 1) {
          const barA = 1 - k.clamp((t0 - .55) / .45, 0, 1)
          k.push(); k.alpha(barA)
          k.flat(k.rect(bx, Y + 10, bw, 150), k.P.light, .9)
          k.pop()
        }
        if (t0 <= .4) continue
        const drop = k.ease(k.clamp((t0 - .4) / .6, 0, 1))
        const inWin = i >= N - WIN
        const picked = PICK.has(i)
        let y = k.lerp(Y + 120, PY, drop), x = bx
        let col = k.P.a
        if ((st >= 1 || k.thumb) && inWin) col = k.P.b
        if ((st >= 2 || k.thumb) && picked) {
          const lift = k.thumb || st > 2 ? 0 : k.easeOut(k.clamp((k.since(2) - 1.0 - order.indexOf(i) * .15) / .7, 0, 1))
          y = PY - 120 * lift
          col = k.P.hi
        }
        if (st === 3 && !picked && !inWin && !k.thumb) {
          k.push(); k.alpha(.35); k.flat(k.rect(x, y, bw, BH), col, .9); k.pop()
        } else if (drop < 1 || (y !== PY && !k.thumb)) {
          k.flat(k.rect(x, y, bw, BH), col, .85)  // moving: flat, brush bakes are keyed by geometry
        } else {
          k.seed('b' + i + (inWin ? 'w' : picked && st >= 2 ? 'p' : '')); k.shape(k.rect(x, y, bw, BH), { fill: col, op: .8, sw: 1, ink: k.ink })
        }
        // index: score bar under each pool block
        if (st === 2 && i < N - WIN && !k.thumb) {
          const g = k.easeOut(k.clamp((k.since(2) - .2) / .8, 0, 1))
          k.flat(k.rect(x, PY + BH + 20, bw * REL[i] * g, 8), k.P.hi, .9)
        }
      }
      if (st === 0 && p.tail) k.text(p.tail, X0, Y + 200, { role: 'body', size: 22, min: 12, maxW: 700, lines: 1, col: k.dim })
      if ((st >= 1 || k.thumb) && p.window) {
        const wx = X0 + (N - WIN) * cw
        k.seed('win'); k.line(k.rrect(wx - 2, PY - 10, WIN * cw + 4, BH + 20, 10), 2, k.P.b, { closed: true })
        k.text(p.window, wx, PY - 26, { role: 'mono', size: 20, min: 11, maxW: WIN * cw + 60, lines: 1, col: k.P.b })
      }
      if (st === 2 && p.question) {
        const a = k.easeOut(k.p(2, .5, .1))
        k.push(); k.alpha(a)
        k.seed('q'); k.shape(k.circle(X1 - 40, Y + 40, 30, 28), { fill: k.P.hi, op: .9, sw: 1.2, ink: k.ink })
        k.text(p.question, X1 - 330, Y + 50, { role: 'mono', size: 22, min: 11, maxW: 250, lines: 1 })
        k.pop()
      }
      // read: eight layer rows receive the same blocks
      if (st === 3 || k.thumb) {
        const LY = Y + 20, LH = 16, gap = 8
        const a = k.thumb ? 1 : k.easeOut(k.p(3, .8, .2))
        const sel = [...order].sort((m, n) => m - n).concat(Array.from({ length: WIN }, (_, j) => N - WIN + j))
        k.push(); k.alpha(a)
        for (let l = 0; l < LAYERS; l++) {
          const ly = LY + l * (LH + gap)
          sel.forEach((b, j) => {
            const w = 52
            k.flat(k.rect(X0 + 260 + j * (w + 6), ly, w, LH), j < K ? k.P.hi : k.P.b, .85)
          })
        }
        if (p.layers) k.text(p.layers, X0, LY + 30, { role: 'mono', size: 20, min: 11, maxW: 240, lines: 2, col: k.dim })
        k.pop()
      }
      k.point = st === 0 ? [X0 + N * cw * .5, PY] : st === 1 ? [X1 - WIN * cw * .5, PY] : st === 2 ? [X1 - 40, Y + 40] : [X0 + 500, Y - 20]
      k.mood = st === 2 ? 'thinking' : st === 3 ? 'proud' : 'neutral'
    },
  }
})())
