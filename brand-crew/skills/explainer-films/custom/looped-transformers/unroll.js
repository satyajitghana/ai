// looped-transformers / unroll
//
// The article's LoopUnroll widget as a moving picture: Inkling 2 Mini's 24 stored layers, its
// loop core (layers 6 to 17), the core's weights travelling down into three passes so a token
// sees 48 layer applications, the gated message between passes, and then the bill: what the
// file holds against what an untied 48-layer twin would hold. Five beats:
//   0  the stored strip: 24 cells, prelude and final block grey, core blue
//   1  the core lifts and rings
//   2  the unrolled row builds: prelude, pass 1, pass 2, pass 3, final block, cells arriving on arcs
//   3  message arrows from each pass to the next, through a gate that opens
//   4  two bars: held by Mini against held by the untied twin, with the per-token read beside them
// The layout is the config's (core_start 6, core_end 18, 3 passes); the bar lengths are the
// article's sizes (16.6 and 31.3 GB). Every string comes from params.
//
// params: { data: "article", heads: [5 strings], parts: [5 strings], bars: [{label, value, w}, {label, value, w}], read }
BESPOKE.define((() => {
  const N = 24
  const isCore = i => i >= 6 && i < 18

  return {
    plan: () => ({
      min: [3.6, 3.4, 6.0, 4.6, 5.4],
      events: [{ step: 0, at: .3, type: 'ticks', n: 24, span: 1.2 }, { step: 1, at: .3, type: 'pop' },
        { step: 2, at: .4, type: 'whoosh' }, { step: 3, at: .5, type: 'ding' }, { step: 4, at: .6, type: 'thunk' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 140, X1 = 1360
      const SY = Math.max(k.top + 80, 240)
      const cw = (X1 - X0) / N, ch = 58
      const core = k.P.b, once = k.dim, hi = k.P.hi

      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, SY - 34, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // the stored strip
      const lift = k.thumb ? 1 : st >= 1 ? k.easeOut(k.p(1, .7, .1)) : 0
      const stripIn = k.thumb ? 1 : k.easeOut(k.p(0, 1.2, .1))
      for (let i = 0; i < N; i++) {
        const a = k.clamp(stripIn * N - i, 0, 1)
        if (a <= 0) continue
        const y = SY - (isCore(i) ? 14 * lift : 0)
        k.push(); k.alpha(a)
        k.flat(k.rect(X0 + i * cw + 2, y, cw - 4, ch), isCore(i) ? core : once, .9)
        k.pop()
      }
      if (lift > 0 && st < 4) {
        k.push(); k.alpha(lift)
        k.seed('ring'); k.line(k.rrect(X0 + 6 * cw - 6, SY - 24, 12 * cw + 12, ch + 20, 10), 2.4, hi, { closed: true })
        k.pop()
      }

      // the unrolled row: 6 + 12 x 3 + 6 = 48 cells in two lines
      const RY = SY + 150
      const parts = p.parts || []
      // row 0: prelude, pass 1; row 1: pass 2, a gap, pass 3; row 2: the final block under pass 3's end
      const GAP = 70
      const segs = [{ from: 0, n: 6, row: 0, col: 0, dx: 0 }, { from: 6, n: 12, row: 0, col: 6, dx: 0, pass: 1 }, { from: 6, n: 12, row: 1, col: 0, dx: 0, pass: 2 },
        { from: 6, n: 12, row: 1, col: 12, dx: GAP, pass: 3 }, { from: 18, n: 6, row: 2, col: 18, dx: GAP }]
      const uw = (X1 - X0 - GAP) / 24, uh = 40, rowGap = 112
      if (st >= 2 || k.thumb) {
        if (st < 4 || k.thumb) segs.forEach((s, si) => {
          for (let j = 0; j < s.n; j++) {
            const src = s.from + j
            const order = si * 12 + j
            const t = k.thumb || st > 2 ? 1 : k.ease(k.clamp((k.since(2) - .3 - order * .06) / .7, 0, 1))
            if (t <= 0) continue
            const tx = X0 + s.dx + (s.col + j) * uw + 2, ty = RY + s.row * rowGap
            const pos = k.arc([X0 + src * cw + 2, SY], [tx, ty], 90, t)
            k.flat(k.rect(pos[0], pos[1], k.lerp(cw - 4, uw - 4, t), k.lerp(ch, uh, t)), s.pass ? core : once, s.pass > 1 ? .7 : .9)
          }
          const la = k.thumb || st > 2 ? 1 : k.easeOut(k.clamp((k.since(2) - .3 - si * .7) / .6, 0, 1))
          if (parts[si] && la > 0) k.text(parts[si], X0 + s.dx + s.col * uw + 4, RY + s.row * rowGap + uh + 30, { role: 'mono', size: 22, min: 11, maxW: s.n * uw - 8, lines: 1, col: k.dim, alpha: la })
        })
      }

      // the message gates between passes
      if ((st === 3 || k.thumb) && st < 4) {
        const open = k.thumb ? 1 : k.easeOut(k.p(3, 1.6, .4))
        // pass 1's end (row 0) down to pass 2's start (row 1); pass 2's end across the gap to pass 3
        const ends = [[[X0 + 18 * uw - 10, RY + uh + 4], [X0 + 2 * uw, RY + rowGap - 6]], [[X0 + 12 * uw + 2, RY + rowGap + uh / 2], [X0 + GAP + 12 * uw - 2, RY + rowGap + uh / 2]]]
        ends.forEach((e, i) => {
          const g = [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2]
          k.seed('msg' + i); k.arrow(i === 0 ? k.through([e[0], [g[0], g[1] + 10], e[1]]) : [e[0], e[1]], hi, 2.6, open)
          // a gate: two bars that part as it opens
          const gap = 4 + 16 * open
          k.flat(k.rect(g[0] - 3, g[1] - 18 - gap / 2, 6, 16), k.ink, .8)
          k.flat(k.rect(g[0] - 3, g[1] + 2 + gap / 2, 6, 16), k.ink, .8)
        })
      }

      // the bill
      if (st === 4 && !k.thumb) {
        const bars = p.bars || []
        const BY = RY - 10, BH = 64, max = 31.3
        bars.forEach((b, i) => {
          const t = k.easeOut(k.p(4, 1.0, .3 + i * .5))
          const w = (X1 - X0 - 260) * (b.w / max) * t
          const y = BY + i * 120
          k.seed('bar' + i); k.shape(k.rect(X0, y, Math.max(w, 2), BH), { fill: i === 0 ? core : k.P.a, op: .85, sw: 1.4, ink: k.ink })
          if (t > .6) {
            k.text(b.value, X0 + w + 16, y + 44, { role: 'head', size: 30, min: 14, maxW: 240, lines: 1 })
            k.text(b.label, X0, y + BH + 30, { role: 'mono', size: 21, min: 11, maxW: X1 - X0, lines: 1, col: k.dim })
          }
        })
        if (p.read) k.text(p.read, X0, BY + 300, { role: 'body', size: 26, min: 12, maxW: X1 - X0, lines: 1, alpha: k.easeOut(k.p(4, .6, 1.6)) })
      }

      k.point = st === 0 ? [X0 + 12 * cw, SY + ch] : st === 1 ? [X0 + 17 * cw, SY] : st === 2 ? [X0 + GAP + 20 * uw, RY + rowGap]
        : st === 3 ? [X0 + GAP / 2 + 12 * uw, RY + rowGap] : [X0 + 900, RY + 120]
      k.mood = st === 2 ? 'excited' : st === 4 ? 'proud' : 'thinking'
    },
  }
})())
