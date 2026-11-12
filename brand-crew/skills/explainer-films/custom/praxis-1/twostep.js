// praxis-1 / twostep
//
// The article's TwoStepSampler, animated. A time ruler from 1 (noise) to 0
// (clean) with the served grid: two steps, shifted by 12.5, so the model is
// called at 1 and 0.926. Left, the video latent for the next chunk, a tile of
// noise that clears only as far as t has moved. Right, the article's toy: a
// 24-row reach that should go to one of two mugs, with a 50/50 context. Step
// one clears the video 7.4% and leaves the actions noise; step two jumps the
// actions to clean in one move, skips the decoder, and lands between the mugs
// (the prior-weighted average). Then the contrast: 8 steps, no shift, and the
// reach commits to one mug. A toy, so the runtime stamps it Illustrative.
//
// steps: 0 the grid · 1 pure noise · 2 step one · 3 step two · 4 eight steps
// params: { ruler: [3 strings: even, shifted, eight], video, actions, legend: [5], skipped }
BESPOKE.define((() => {
  let s = 11 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const G = 14
  const noise = []; for (let j = 0; j < G * G; j++) noise.push(rnd())
  // the clean frame: a table edge and two mugs, as cell tones (0 ground, 1 table, 2 mug)
  const img = []
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const inMug = (cx, cy) => (c - cx) ** 2 + (r - cy) ** 2 <= 2.3
    img.push(inMug(3.5, 4) || inMug(10.5, 4) ? 2 : r >= 9 ? 1 : 0)
  }
  // the toy reach: 24 rows from the gripper toward one of two mugs
  const N = 24, start = [.5, .92], mugs = [[.22, .22], [.78, .22]]
  const path = m => Array.from({ length: N }, (_, j) => { const u = (j + 1) / N, e = 1 - (1 - u) ** 2; return [start[0] + (m[0] - start[0]) * e + Math.sin(u * Math.PI) * (m[0] < .5 ? -.05 : .05), start[1] + (m[1] - start[1]) * e] })
  const L = path(mugs[0]), R = path(mugs[1]), AVG = L.map((a, j) => [(a[0] + R[j][0]) / 2, (a[1] + R[j][1]) / 2])
  const nz = Array.from({ length: N }, () => [.1 + rnd() * .8, .1 + rnd() * .8])
  const mixP = (a, b, t) => a.map((x, j) => [x[0] + (b[j][0] - x[0]) * t, x[1] + (b[j][1] - x[1]) * t])
  const shiftT = (u, sh) => sh * u / (1 + (sh - 1) * u)

  return {
    stampAt: k => [1230, Math.max(k.top + 70, 270) + 230],
    plan: () => ({
      min: [3.6, 3, 3.6, 4.2, 5.4],
      events: [{ step: 0, at: .3, type: 'slide' }, { step: 1, at: .2, type: 'scratch' }, { step: 2, at: .3, type: 'tick' }, { step: 3, at: .3, type: 'whoosh' }, { step: 3, at: 1.2, type: 'thunk' }, { step: 4, at: .2, type: 'ticks', n: 8, span: 3.6 }, { step: 4, at: 4, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2.4 }, { step: 2, from: 0, to: 1.6 }, { step: 3, from: 0, to: 1.8 }, { step: 4, from: 0, to: 4.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const RX = 170, RW = 1080, RY = Math.max(k.top + 70, 270)
      const tx = t => RX + (1 - t) * RW
      // the ruler
      k.seed('ruler'); k.line([[RX, RY], [RX + RW, RY]], 1, k.ink)
      const grid = i === 4 ? Array.from({ length: 9 }, (_, j) => 1 - j / 8) : [1, shiftT(.5, 12.5), 0]
      const even = [1, .5, 0]
      const sk = i === 0 ? (k.thumb ? 1 : k.ease(k.p(0, 1.4, 1))) : 1
      if (i < 4) even.forEach((u, j) => { const x = tx(u + (grid[j] - u) * sk); k.flat(k.rect(x - 2, RY - 18, 4, 36), j === 1 ? k.P.a : k.ink, 1) })
      else grid.forEach(u => k.flat(k.rect(tx(u) - 2, RY - 14, 4, 28), k.P.b, 1))
      if (i === 0 && sk < .5) k.flat(k.rect(tx(.5) - 2, RY - 18, 4, 36), k.dim, .5)
      const rl = p.ruler ? (i === 4 ? p.ruler[2] : sk > .5 ? p.ruler[1] : p.ruler[0]) : ''
      if (rl) k.text(rl, RX, RY - 40, { role: 'mono', size: 24, min: 12, maxW: RW, lines: 1, col: k.dim })
      // where the sampler is: t
      let t = 1
      if (i === 2) t = 1 + (shiftT(.5, 12.5) - 1) * (k.thumb ? 1 : k.ease(k.p(2, 1.2, .3)))
      if (i === 3) t = shiftT(.5, 12.5) * (1 - (k.thumb ? 1 : k.expoOut(k.p(3, 1, .3))))
      if (i === 4) t = 1 - (k.thumb ? 1 : k.p(4, 3.8, .2))
      if (i >= 1) { const x = tx(t); k.flat([[x, RY - 4], [x - 14, RY - 30], [x + 14, RY - 30]], k.P.hi, 1) }
      // the video latent tile
      const VX = 170, VY = RY + 90, C = 24, side = G * C
      const vclean = i === 2 || i === 3 ? 1 - shiftT(.5, 12.5) : 0
      const vtone = [k.mix(k.ink, k.paper, .62), k.mix(k.P.b, k.paper, .35), k.P.a]
      for (let j = 0; j < G * G; j++) {
        const r = Math.floor(j / G), c = j % G, nzc = k.mix(k.paper, k.ink, noise[j])
        const show = i === 2 ? (1 - t) : vclean
        k.flat(k.rect(VX + c * C, VY + r * C, C - 1, C - 1), k.mix(nzc, vtone[img[j]], Math.max(0, Math.min(1, show))), i === 3 ? .5 : 1)
      }
      if (p.video) k.text(p.video, VX, VY - 22, { role: 'label', size: 24, min: 12, maxW: side + 40, lines: 1 })
      if (i === 3 && p.skipped) { const a = k.thumb ? 1 : k.p(3, .4, 1); k.text(p.skipped, VX + 20, VY + side / 2, { role: 'head', size: 30, min: 14, maxW: side - 40, lines: 2, alpha: a }) }
      // the toy reach
      const AX = 640, AY = VY, AW = 460, AH = side
      k.seed('table'); k.line(k.rect(AX, AY, AW, AH).concat([[AX, AY]]), .7, k.dim)
      mugs.forEach((m, j) => { k.seed('mug' + j); k.shape(k.circle(AX + m[0] * AW, AY + m[1] * AH, 30, 20), { fill: k.P.a, op: .7, sw: .9 }) })
      k.flat(k.rect(AX + start[0] * AW - 18, AY + start[1] * AH - 8, 36, 16), k.ink, 1)
      if (p.actions) k.text(p.actions, AX, AY - 22, { role: 'label', size: 24, min: 12, maxW: AW + 40, lines: 1 })
      let dots = nz
      if (i === 3) dots = mixP(nz, AVG, k.thumb ? 1 : k.expoOut(k.p(3, 1, .3)))
      if (i === 4) { const u = k.thumb ? 1 : k.p(4, 3.8, .2), commit = Math.max(0, Math.min(1, (u - .55) / .3)); dots = mixP(nz, mixP(AVG, L, commit), u) }
      dots.forEach(([x, y], j) => k.flat(k.circle(AX + x * AW, AY + y * AH, 7, 10), j === N - 1 ? k.P.hi : k.ink, .9))
      // the legend for this beat
      if (p.legend && p.legend[i]) k.text(p.legend[i], 170, VY + side + 60, { role: 'head', size: 32, min: 16, maxW: 1080, lines: 2 })
      k.point = i <= 2 ? [tx(t), RY] : [AX + AW * .5, AY + AH * .3]
      k.mood = i === 3 ? 'surprised' : i === 4 ? 'happy' : 'thinking'
    },
  }
})())
