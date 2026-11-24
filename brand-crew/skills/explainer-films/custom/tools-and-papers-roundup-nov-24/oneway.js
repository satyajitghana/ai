// tools-and-papers-roundup-nov-24 / oneway
//
// AlphaAnything's decoder, as a moving picture (the article's Figure 2, redrawn as a schematic).
// Top row: the latent, then the frozen RGB decoder's stages, then the RGB image.
// Bottom row: the trainable alpha branch, one state under each stage, then the alpha matte.
// Four beats:
//   0  the frozen RGB decoder builds left to right, a packet running along it
//   1  the alpha branch appears; an arrow drops from every RGB stage into it (one way)
//   2  an arrow from alpha back up into RGB is tried and crossed out; the RGB output is marked unchanged
//   3  the alpha loss's gradient travels back through the decoder into the LoRA above the latent
// A schematic with no numbers: every string comes from params.
//
// params: { heads: [4 strings], latent, rgb, alpha, rgbRow, alphaRow, lora, blocked, same, grad }
BESPOKE.define((() => {
  const BX = [440, 640, 840, 1040] // stage centres
  const BW = 140, BH = 96
  const LAT = 210, OUT = 1250
  return {
    stampAt: (k) => [1230, k.top + 24],
    plan: () => ({
      min: [4.4, 4.8, 4.6, 5.8],
      events: [
        { step: 0, at: 0.3, type: 'ticks', n: 4, span: 1.2 },
        { step: 1, at: 0.4, type: 'ticks', n: 4, span: 1.0 },
        { step: 2, at: 1.2, type: 'ding' },
        { step: 3, at: 0.4, type: 'whoosh' },
      ],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params
      const st = k.thumb ? 3 : k.step
      const T = k.top
      const yR = T + 320, yA = T + 590
      const head = (p.heads || [])[st]
      if (head) k.text(head, 130, T + 40, { role: 'head', size: 32, min: 14, maxW: 1220, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, 0.5, 0.1)) })

      const box = (key, cx, cy, w, h, fill, op, label, a, size) => {
        if (a <= 0) return
        k.push(); k.alpha(a)
        k.seed(key)
        k.shape(k.rrect(cx - w / 2, cy - h / 2, w, h, 14), { fill, op, sw: 2, ink: k.ink })
        if (label) k.text(label, cx, cy + 9, { role: 'label', size: size || 24, min: 12, maxW: w - 16, lines: 2, align: 'center', col: k.textOn(fill) })
        k.pop()
      }

      // row labels
      const rowA0 = k.thumb ? 1 : k.easeOut(k.p(0, 0.6, 0.2))
      if (p.rgbRow && st < 3) k.text(p.rgbRow, BX[0] - BW / 2, yR - BH / 2 - 22, { role: 'body', size: 24, min: 12, maxW: 700, lines: 1, col: k.dim, alpha: rowA0 })

      // the latent
      box('lat', LAT, yR, 150, BH, k.P.light, 0.9, p.latent, rowA0)

      // RGB stages, built left to right
      for (let i = 0; i < 4; i++) {
        const a = k.thumb ? 1 : k.easeOut(k.clamp((k.since(0) - 0.4 - i * 0.35) / 0.5, 0, 1))
        if (i === 0) {
          k.push(); k.alpha(a); k.arrow([[LAT + 78, yR], [BX[0] - BW / 2 - 6, yR]], k.ink, 2, 1); k.pop()
        } else {
          k.push(); k.alpha(a); k.arrow([[BX[i - 1] + BW / 2 + 4, yR], [BX[i] - BW / 2 - 6, yR]], k.ink, 2, 1); k.pop()
        }
        box('rgb' + i, BX[i], yR, BW, BH, k.P.a, 0.85, '', a)
      }
      const outR = k.thumb ? 1 : k.easeOut(k.clamp((k.since(0) - 1.9) / 0.5, 0, 1))
      k.push(); k.alpha(outR); k.arrow([[BX[3] + BW / 2 + 4, yR], [OUT - 80, yR]], k.ink, 2, 1); k.pop()
      box('outR', OUT, yR, 150, BH, k.P.a, 1, p.rgb, outR, 28)

      // a packet running along the RGB row in beat 0
      if (!k.thumb && st === 0) {
        const t = k.clamp((k.since(0) - 0.6) / 2.4, 0, 1)
        if (t > 0 && t < 1) {
          const x = k.lerp(LAT, OUT, k.ease(t))
          k.flat(k.circle(x, yR - BH / 2 - 8, 9), k.P.hi, 0.95)
        }
      }

      // alpha branch
      const aA = k.thumb ? 1 : st >= 1 ? k.easeOut(k.p(1, 0.6, 0.1)) : 0
      if (aA > 0) {
        if (p.alphaRow) k.text(p.alphaRow, BX[0] - BW / 2, yA + BH / 2 + 42, { role: 'body', size: 24, min: 12, maxW: 700, lines: 1, col: k.dim, alpha: aA })
        for (let i = 0; i < 4; i++) {
          const a = k.thumb ? 1 : k.easeOut(k.clamp((k.since(1) - 0.2 - i * 0.3) / 0.5, 0, 1))
          box('al' + i, BX[i], yA, BW, BH, k.P.b, 0.55, '', a)
          if (i > 0) { k.push(); k.alpha(a); k.arrow([[BX[i - 1] + BW / 2 + 4, yA], [BX[i] - BW / 2 - 6, yA]], k.ink, 2, 1); k.pop() }
          // the one-way drop from RGB into alpha
          const d = k.thumb ? 1 : k.clamp((k.since(1) - 0.5 - i * 0.3) / 0.6, 0, 1)
          if (d > 0) k.arrow([[BX[i], yR + BH / 2 + 6], [BX[i], yA - BH / 2 - 8]], k.P.hi, 3, k.ease(d))
        }
        const oa = k.thumb ? 1 : k.easeOut(k.clamp((k.since(1) - 1.6) / 0.5, 0, 1))
        k.push(); k.alpha(oa); k.arrow([[BX[3] + BW / 2 + 4, yA], [OUT - 80, yA]], k.ink, 2, 1); k.pop()
        box('outA', OUT, yA, 150, BH, k.ink, 0.85, p.alpha, oa, 28)
      }

      // beat 2: the path back is refused
      if (st >= 2) {
        const t = k.thumb ? 1 : k.p(2, 1.0, 0.2)
        const x = (BX[1] + BX[2]) / 2
        const y0 = yA - BH / 2 - 8, y1 = yR + BH / 2 + 8
        k.push(); k.alpha(st === 2 || k.thumb ? 1 : 0.45)
        k.arrow([[x, y0], [x, y1]], k.dim, 2.4, k.ease(t))
        const c = k.thumb ? 1 : k.easeOut(k.clamp((k.since(2) - 1.1) / 0.4, 0, 1))
        if (c > 0) {
          const ym = (y0 + y1) / 2, r = 34 * c
          k.seed('x1'); k.line([[x - r, ym - r], [x + r, ym + r]], 4, k.P.hi)
          k.seed('x2'); k.line([[x - r, ym + r], [x + r, ym - r]], 4, k.P.hi)
          if (p.blocked) k.text(p.blocked, x + 50, ym + 8, { role: 'label', size: 22, min: 12, maxW: 220, lines: 1, col: k.ink, alpha: c })
        }
        k.pop()
        const sa = k.thumb ? 1 : k.easeOut(k.clamp((k.since(2) - 1.8) / 0.5, 0, 1))
        if (p.same && sa > 0) {
          k.hl(OUT - 90, yR - BH / 2 - 52, 180, 34, k.P.hi, sa)
          k.text(p.same, OUT, yR - BH / 2 - 26, { role: 'label', size: 22, min: 12, maxW: 220, lines: 1, align: 'center', col: k.ink, alpha: sa })
        }
      }

      // beat 3: the gradient goes back to the LoRA
      if (st >= 3) {
        const g = k.thumb ? 1 : k.ease(k.p(3, 2.6, 0.3))
        const path = [[OUT, yA + BH / 2 + 8], [OUT, yA + BH / 2 + 30], [BX[3] + BW / 2 + 30, yA + BH / 2 + 30],
          [BX[3] + BW / 2 + 30, yR - BH / 2 - 30], [LAT, yR - BH / 2 - 30], [LAT, yR - BH / 2 - 70]]
        k.seed('grad')
        k.line(k.partial(path, g), 3, k.P.hi)
        if (!k.thumb && g > 0 && g < 1) {
          const head = k.along(path, g * k.lenOf(path))
          if (head) k.flat(k.circle(head[0], head[1], 10), k.P.hi, 1)
        }
        if (p.grad) k.text(p.grad, BX[1], yA + BH / 2 + 76, { role: 'label', size: 22, min: 12, maxW: 520, lines: 1, col: k.dim, alpha: g })
        const la = k.thumb ? 1 : k.easeOut(k.clamp((k.since(3) - 2.4) / 0.5, 0, 1))
        box('lora', LAT, yR - BH / 2 - 112, 200, 64, k.P.hi, 0.9, p.lora, la, 22)
      }

      k.point = st === 0 ? [OUT, yR] : st === 1 ? [BX[2], (yR + yA) / 2] : st === 2 ? [(BX[1] + BX[2]) / 2, (yR + yA) / 2] : [LAT, yR - BH / 2 - 112]
      k.mood = st === 2 ? 'surprised' : st === 3 ? 'proud' : 'thinking'
    },
  }
})())
