// deja-view / loop
//
// One block, applied again and again to the same tokens, and what decoding the
// state shows as it goes. Left: a column of view tokens and a single block with
// its output arrow bent back to its own input; a packet runs the loop once per
// beat. Right: a top-down toy room (an L-shaped wall sampled as points) and four
// cameras. The geometry error shrinks beat by beat, the way Figure 1 of the
// paper shows its fire-extinguisher corner sharpening at k = 2, 4, 8 and 16, and
// the cameras go from the palette's warning tone to its main tone. A seeded toy,
// not the model's output, so the runtime stamps it Illustrative; every label is
// a storyboard string.
//
// steps: 0 the state starts as encoder features · 1 k = 2 · 2 k = 4 · 3 k = 8 · 4 k = 16
// params: { block, tokens, labels: [5 strings] }
BESPOKE.define((() => {
  // the room: an L-shaped wall, as points along its outline, in a unit square
  const WALL = [[.05, .08], [.95, .08], [.95, .55], [.55, .55], [.55, .92], [.05, .92]]
  const pts = []
  for (let s = 0; s < WALL.length; s++) {
    const a = WALL[s], b = WALL[(s + 1) % WALL.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(4, Math.round(len * 34))
    for (let j = 0; j < n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n])
  }
  // four cameras inside the room, each looking at a wall
  const CAMS = [[.25, .3, -1.2], [.75, .3, -1.9], [.3, .7, 2.6], [.42, .45, 0.2]]
  // error amplitude per beat: the state's decode gets closer each loop
  const AMP = [1, .62, .34, .13, .03]
  // per-point and per-camera offsets, from a fixed seeded generator
  let sd = 7 >>> 0
  const rnd = () => { sd = (sd + 0x6d2b79f5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const off = pts.map(() => [(rnd() - .5) * .16, (rnd() - .5) * .16])
  const coff = CAMS.map(() => [(rnd() - .5) * .14, (rnd() - .5) * .14, (rnd() - .5) * 1.4])

  return {
    stampAt: k => [360, Math.max(k.top + 40, 250) + 520],
    plan: () => ({
      min: [4.2, 3.8, 3.8, 3.8, 4.4],
      events: [{ step: 0, at: .3, type: 'ticks', n: 5, span: 1 }, { step: 1, at: .2, type: 'whoosh' }, { step: 2, at: .2, type: 'whoosh' },
        { step: 3, at: .2, type: 'whoosh' }, { step: 4, at: .2, type: 'whoosh' }, { step: 4, at: 1.6, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 1.8 }, { step: 2, from: 0, to: 1.8 }, { step: 3, from: 0, to: 1.8 }, { step: 4, from: 0, to: 1.8 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 70, 280)
      // ---- left: tokens and the looped block ----
      const BX = 250, BY = Y0 + 150, BW = 250, BH = 170
      const tin = k.thumb ? 1 : k.easeOut(k.span(0, .8))
      for (let j = 0; j < 6; j++) {
        k.seed('tok' + j)
        k.shape(k.rrect(130, Y0 + 90 + j * 46, 46, 36, 6), { fill: j === 0 ? k.tone('b') : k.tone('a'), op: .55 * tin, sw: .7 })
      }
      if (p.tokens) k.text(p.tokens, 110, Y0 + 400, { role: 'label', size: 24, min: 12, maxW: 200, lines: 2, col: k.dim })
      k.seed('in'); k.arrow([[190, BY + BH / 2], [BX - 8, BY + BH / 2]], k.ink, 1, tin)
      k.seed('block')
      k.shape(k.rrect(BX, BY, BW, BH, 18), { fill: k.tone('light'), op: .7, sw: 1.1 })
      if (p.block) {
        const m = k.measure(p.block, { role: 'head', size: 34, min: 16, maxW: BW - 30, lines: 2 })
        k.text(p.block, BX + (BW - m.w) / 2, BY + (BH - m.h) / 2 + m.h * .1, { role: 'head', size: 34, min: 16, maxW: BW - 30, lines: 2 })
      }
      // the loop: out of the right side, up and over, back into the left
      const loopPts = k.through([[BX + BW + 6, BY + BH * .35], [BX + BW + 70, BY - 20], [BX + BW / 2, BY - 95], [BX - 70, BY - 20], [BX - 6, BY + BH * .35]])
      k.seed('loop'); k.arrow(loopPts, k.P.a, 1.2, 1)
      // a packet runs the loop once on every beat after the first
      if (i >= 1 && !k.thumb) {
        const f = k.p(i, 1.4, .1)
        if (f > 0 && f < 1) {
          const L = k.lenOf(loopPts), q = k.along(loopPts, k.ease(f) * L)
          k.flat(k.circle(q[0], q[1], 13, 18), k.P.hi, 1)
        }
      }
      // ---- right: the toy room, decoded from the state ----
      const RX = 680, RY = Y0 + 90, RS = 480
      const prev = i === 0 ? AMP[0] : AMP[i - 1]
      const tA = k.thumb ? 1 : k.ease(k.p(i, 1.4, .2))
      const amp = i === 0 ? AMP[0] : prev + (AMP[i] - prev) * tA
      const show = k.thumb ? 1 : k.easeOut(k.span(.3, 1.3))
      const rot = amp * .12, cx = .5, cy = .5
      const P = (q, o) => {
        const x = q[0] + o[0] * amp - cx, y = q[1] + o[1] * amp - cy
        const c = Math.cos(rot), s = Math.sin(rot)
        const u = Math.max(-.02, Math.min(1.02, cx + x * c - y * s)), v = Math.max(-.02, Math.min(1.02, cy + x * s + y * c))
        return [RX + u * RS, RY + v * RS * .9]
      }
      k.push(); k.alpha(show)
      k.seed('frame'); k.line(k.rrect(RX - 20, RY - 20, RS + 40, RS * .9 + 40, 16), .6, k.dim, { closed: true })
      pts.forEach((q, m) => { const [x, y] = P(q, off[m]); k.flat(k.circle(x, y, 6, 10), k.P.b, .85) })
      const good = 1 - amp
      CAMS.forEach((c, j) => {
        const [x, y] = P(c, coff[j]), th = c[2] + coff[j][2] * amp
        const tri = [[x, y], [x + Math.cos(th - .45) * 46, y + Math.sin(th - .45) * 46], [x + Math.cos(th + .45) * 46, y + Math.sin(th + .45) * 46]]
        k.flat(tri, k.mix(k.P.hi, k.P.a, good), .85)
      })
      k.pop()
      if (p.labels && p.labels[i]) {
        const m = k.measure(p.labels[i], { role: 'head', size: 40, min: 16, maxW: RS, lines: 1 })
        k.text(p.labels[i], RX + (RS - m.w) / 2, RY - 40 - m.h, { role: 'head', size: 40, min: 16, maxW: RS, lines: 1 })
      }
      k.point = i === 0 ? [BX + BW / 2, BY + BH / 2] : [RX + RS * .7, RY + RS * .3]
      k.mood = i === 4 ? 'happy' : i === 0 ? 'neutral' : 'thinking'
    },
  }
})())
