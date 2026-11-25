// tools-and-papers-roundup-nov-25 / submit
//
// skia-wasm against CanvasKit on 10,000 rounded rects, from the author's BENCHMARK.md
// as the article prints it (phone at full clock). Two lanes, one per library.
//   0  the record part of each frame grows: about the same length in both
//   1  the submit part grows: a sliver for CanvasKit, longer than the record for skia-wasm
//   2  why: CanvasKit's frame is a few big draws, skia-wasm's is a storm of tiny ones
//   3  the cause, named: a Graphite setting under Emscripten, not WebGPU
// Bar lengths are geometry from params.ms (the article's milliseconds); every string
// drawn comes from params.
//
// params: { data, heads[4], ck, sw, rec, sub, ms: {ckRec, ckSub, swRec, swSub},
//           msText: {ckRec, ckSub, swRec, swSub}, ckCalls, swCalls, cause }
BESPOKE.define((() => {
  const X0 = 400, SPAN = 900
  return {
    plan: () => ({
      min: [4.2, 4.6, 5.2, 4.6],
      events: [
        { step: 0, at: 0.3, type: 'whoosh' },
        { step: 1, at: 0.5, type: 'whoosh' },
        { step: 2, at: 0.4, type: 'ticks', n: 24, span: 2.4 },
        { step: 3, at: 0.6, type: 'ding' },
      ],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params
      const m = p.ms
      const st = k.thumb ? 3 : k.step
      const T = k.top
      const max = m.swRec + m.swSub
      const px = (v) => (v / max) * SPAN
      const yC = T + 190, yS = T + 330, BH = 70

      const head = (p.heads || [])[st]
      if (head) k.text(head, 130, T + 40, { role: 'head', size: 32, min: 14, maxW: 1220, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, 0.5, 0.1)) })

      // lane labels
      const la = k.thumb ? 1 : k.easeOut(k.p(0, 0.5, 0))
      k.text(p.ck, 130, yC + 10, { role: 'label', size: 28, min: 12, maxW: 250, lines: 1, alpha: la })
      k.text(p.sw, 130, yS + 10, { role: 'label', size: 28, min: 12, maxW: 250, lines: 1, alpha: la })

      // record bars
      const r = k.thumb ? 1 : k.ease(k.p(0, 1.6, 0.3))
      const bar = (key, x, y, w, col, op) => {
        if (w < 1) return
        k.seed(key); k.shape(k.rect(x, y - BH / 2, w, BH), { fill: col, op, sw: 2, ink: k.ink })
      }
      bar('ckr', X0, yC, px(m.ckRec) * r, k.P.a, 0.85)
      bar('swr', X0, yS, px(m.swRec) * r, k.P.a, 0.85)
      if (r > 0.95) {
        k.text(p.msText.ckRec, X0 + px(m.ckRec) / 2, yC + 9, { role: 'mono', size: 24, min: 12, maxW: 260, lines: 1, align: 'center', col: k.textOn(k.P.a) })
        k.text(p.msText.swRec, X0 + px(m.swRec) / 2, yS + 9, { role: 'mono', size: 24, min: 12, maxW: 260, lines: 1, align: 'center', col: k.textOn(k.P.a) })
        if (st === 0 && !k.thumb) k.text(p.rec, X0, yC - BH / 2 - 16, { role: 'body', size: 24, min: 12, maxW: 400, lines: 1, col: k.dim })
      }

      // submit bars
      if (st >= 1) {
        const s = k.thumb ? 1 : k.ease(k.p(1, 2.2, 0.4))
        bar('cks', X0 + px(m.ckRec), yC, px(m.ckSub) * s, k.P.hi, 0.9)
        bar('sws', X0 + px(m.swRec), yS, px(m.swSub) * s, k.P.hi, 0.9)
        if (s > 0.95) {
          k.text(p.msText.ckSub, X0 + px(m.ckRec + m.ckSub) + 18, yC + 9, { role: 'mono', size: 24, min: 12, maxW: 200, lines: 1, col: k.ink })
          k.text(p.msText.swSub, X0 + px(m.swRec) + px(m.swSub) / 2, yS + 9, { role: 'mono', size: 26, min: 12, maxW: 300, lines: 1, align: 'center', col: k.textOn(k.P.hi) })
          k.text(p.sub, X0 + px(m.swRec), yS + BH / 2 + 36, { role: 'body', size: 24, min: 12, maxW: 500, lines: 1, col: k.dim })
        }
      }

      // the calls: a few big draws against a storm of tiny ones
      if (st >= 2) {
        const yB = T + 560
        const a = k.thumb ? 1 : k.easeOut(k.p(2, 0.5, 0))
        k.push(); k.alpha(a)
        for (let i = 0; i < 4; i++) {
          const g = k.thumb ? 1 : k.backOut(k.clamp((k.since(2) - 0.3 - i * 0.25) / 0.4, 0, 1))
          if (g > 0) { k.seed('big' + i); k.shape(k.rrect(140 + i * 70, yB - 30 * g, 56, 60 * g, 8), { fill: k.P.b, op: 0.8, sw: 2, ink: k.ink }) }
        }
        k.text(p.ckCalls, 140, yB + 76, { role: 'label', size: 26, min: 12, maxW: 360, lines: 1 })
        const rng = k.rng('storm')
        const N = 420
        const shown = k.thumb ? N : Math.floor(N * k.clamp((k.since(2) - 0.4) / 2.6, 0, 1))
        for (let i = 0; i < N; i++) {
          const x = 620 + rng() * 740, y = yB - 46 + rng() * 92
          if (i < shown) k.flat(k.rect(x, y, 7, 7), k.P.hi, 0.9)
        }
        k.text(p.swCalls, 620, yB + 76, { role: 'label', size: 26, min: 12, maxW: 740, lines: 1 })
        k.pop()
      }

      if (st >= 3 && p.cause) {
        const c = k.thumb ? 1 : k.easeOut(k.p(3, 0.6, 0.3))
        const w = k.measure(p.cause, { role: 'body', size: 28, min: 12, maxW: 740, lines: 1 }).w
        k.hl(616, T + 690, w + 12, 40, k.P.hi, c)
        k.text(p.cause, 620, T + 720, { role: 'body', size: 28, min: 12, maxW: 740, lines: 1, col: k.ink, alpha: c })
      }

      k.point = st === 0 ? [X0 + px(m.swRec), yS] : st === 1 ? [X0 + px(max) - 40, yS] : st === 2 ? [1000, T + 560] : [900, T + 710]
      k.mood = st === 1 ? 'surprised' : st === 3 ? 'proud' : 'thinking'
    },
  }
})())
