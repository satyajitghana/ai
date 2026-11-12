// weight-edits-without-finetuning / sharpen
//
// Deletion Tuning's forward pass on a toy gate matrix, as the paper's Figure 1
// and the code describe it: a frozen weight grid W, a grid of trainable logits
// G (most start just above zero, a few just below), and the layer W times
// sigmoid(alpha G). Training moves the logits while alpha ramps up, so the
// sigmoid steepens into a step; a logit that ends below zero has deleted its
// weight, and what ships is one bit per weight. A toy (random weights, random
// drift), so the runtime stamps it Illustrative; labels are storyboard strings.
//
// steps: 0 W and G · 1 the soft mask · 2 training sharpens it · 3 the bitmask
// params: { w, g, out, curve: [3], bits, legend: [4] }
BESPOKE.define((() => {
  const R = 10, C = 14, N = R * C
  let s = 3 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const w = [], g0 = [], drift = []
  for (let j = 0; j < N; j++) {
    w.push(.25 + .75 * rnd())
    const del = rnd() < .06
    g0.push((del ? -.03 : .03) + (rnd() - .5) * .02)
    drift.push(rnd() < .08 ? -.05 - rnd() * .02 : rnd() < .04 ? .06 : (rnd() - .5) * .012)
  }
  const sig = x => 1 / (1 + Math.exp(-x))
  return {
    stampAt: k => [760, Math.max(k.top + 60, 270) + 470],
    plan: () => ({
      min: [3.6, 3.6, 5.6, 4.4],
      events: [{ step: 0, at: .2, type: 'ticks', n: 10, span: 1.2 }, { step: 1, at: .3, type: 'draw' }, { step: 2, at: .3, type: 'grow' }, { step: 2, at: 4.6, type: 'thunk' }, { step: 3, at: .4, type: 'print' }],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 2, from: 0, to: 5 }, { step: 3, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 60, 270), CS = 24, WX = 170, GX = 560, PX = 960, PW = 300, PH = 200
      const u = i < 2 ? 0 : i > 2 || k.thumb ? 1 : k.ease(k.p(2, 4.6, .3))
      const alpha = i < 1 ? 0 : 30 * Math.pow(1000 / 30, u)          // the sharpness, ramping
      const g = g0.map((x, j) => x + drift[j] * u)
      const keepCol = k.ink, delCol = k.P.a
      // W, frozen
      const show = k.thumb ? 1 : k.easeOut(k.span(0, .8))
      if (p.w) k.text(p.w, WX, Y0 - 20, { role: 'label', size: 24, min: 12, maxW: C * CS + 40, lines: 1 })
      if (p.g) k.text(p.g, GX, Y0 - 20, { role: 'label', size: 24, min: 12, maxW: C * CS + 40, lines: 1 })
      for (let j = 0; j < N; j++) {
        const r = Math.floor(j / C), c = j % C
        const m = i < 1 ? 1 : i >= 3 ? (g[j] > 0 ? 1 : 0) : sig(alpha * g[j])
        k.flat(k.rect(WX + c * CS + 1, Y0 + r * CS + 1, CS - 2, CS - 2), k.mix(k.paper, k.ink, w[j] * m * .85 + .05), show)
        if (i >= 3 && g[j] <= 0) { const x = WX + c * CS, y = Y0 + r * CS; k.flat([[x + 3, y + 5], [x + 5, y + 3], [x + CS - 3, y + CS - 5], [x + CS - 5, y + CS - 3]], delCol, 1); k.flat([[x + CS - 3, y + 5], [x + CS - 5, y + 3], [x + 3, y + CS - 5], [x + 5, y + CS - 3]], delCol, 1) }
        // G: blue keep, red delete, saturation by distance from zero
        const v = Math.max(-1, Math.min(1, g[j] / .04))
        k.flat(k.rect(GX + c * CS + 1, Y0 + r * CS + 1, CS - 2, CS - 2), k.mix(k.paper, v >= 0 ? keepCol : delCol, .25 + .75 * Math.abs(v)), show)
      }
      // the sigmoid of alpha G, steepening
      if (i >= 1) {
        const ck = k.thumb ? 1 : k.easeOut(k.p(1, .8, .1))
        k.push(); k.alpha(ck)
        k.seed('axes'); k.line([[PX, Y0 + PH], [PX + PW, Y0 + PH]], .8, k.dim); k.seed('axy'); k.line([[PX + PW / 2, Y0], [PX + PW / 2, Y0 + PH + 10]], .6, k.dim)
        const pts = []
        for (let q = 0; q <= 60; q++) { const x = -.06 + .12 * q / 60; pts.push([PX + PW * q / 60, Y0 + PH - PH * sig(alpha * x)]) }
        k.seed('sig' + Math.round(alpha)); k.line(pts, 1.4, k.P.hi)
        const cl = p.curve ? p.curve[Math.min(2, i - 1)] : ''
        if (cl) k.text(cl, PX, Y0 + PH + 44, { role: 'mono', size: 22, min: 11, maxW: PW + 80, lines: 2, col: k.dim })
        k.pop()
      }
      // the bitmask that ships
      if (i >= 3) {
        const bk = k.thumb ? 1 : k.p(3, 1.2, .3), BY = Y0 + R * CS + 70, n = Math.floor(bk * 40)
        for (let j = 0; j < n; j++) k.flat(k.rect(WX + j * 18, BY, 14, 22), g[j] > 0 ? k.mix(k.paper, k.ink, .6) : delCol, 1)
        if (p.bits) k.text(p.bits, WX, BY + 64, { role: 'head', size: 30, min: 14, maxW: 860, lines: 1, alpha: bk })
      }
      if (p.legend && p.legend[i]) k.text(p.legend[i], PX, Y0 + PH + 130, { role: 'head', size: 36, min: 16, maxW: 400, lines: 3 })
      k.point = i === 1 || i === 2 ? [PX + PW / 2, Y0 + PH / 2] : i === 3 ? [WX + 400, Y0 + R * CS + 80] : [GX + C * CS, Y0 + 100]
      k.mood = i === 2 ? 'thinking' : i === 3 ? 'happy' : 'neutral'
    },
  }
})())
