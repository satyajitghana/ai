// threert / cachepath
//
// ThreeRT's live estimator (pathtrace.wgsl `main` + `cache_end`), painted in a room cut in half. A camera ray finds
// the floor; a shadow ray goes to the lamp (direct light at the camera hit); the path bounces once and stops in a
// voxel of the radiance cache, which lights up with what other samples taught it; then a fan of pixels does the same
// and the grid fills in. The room, rays and cell values are a toy, so the scene is stamped Illustrative. Every string
// drawn is the storyboard's.
//
// steps: 0 camera ray · 1 shadow ray to the lamp · 2 one bounce, then the cache · 3 every pixel, every frame
// params: { camera, lamp, hit, shadow, cell, legend: [4 strings] }
BESPOKE.define((() => {
  const RX0 = 150, RX1 = 1010, CW = 10, CH = 6
  const CAM = [215, 0] // y set from the room's top at draw time
  // a fixed fan of 9 pixels: a floor, block-top or wall hit, then one bounce into a cell (room units 0..1, y up).
  // Floor hits left of the block bounce up and to the left, so no ray passes through the block.
  const FAN = [
    { hit: [.18, 0], b: [0, .38] }, { hit: [.25, 0], b: [.08, 1] }, { hit: [.33, 0], b: [0, .86] },
    { hit: [.45, 0], b: [.2, 1] }, { hit: [.52, 0], b: [.36, 1] }, { hit: [.6, .34], b: [.72, 1] },
    { hit: [.7, .34], b: [1, .7] }, { hit: [1, .3], b: [.86, 1] }, { hit: [1, .5], b: [.62, 1] },
  ]
  // what each cell "knows": brighter near the lamp, a red and a green bleed at the walls (toy values)
  const cellTone = (cx, cy) => {
    const x = (cx + .5) / CW, y = (cy + .5) / CH
    const near = Math.max(0, 1 - Math.hypot(x - .5, (1 - y) * .9) * 1.5)
    return near
  }
  return {
    plan: () => ({
      min: [3.6, 3.8, 5.2, 5.4],
      events: [{ step: 1, at: .4, type: 'ding' }, { step: 2, at: 1.2, type: 'ding' }, { step: 3, at: .3, type: 'ticks', n: 9, span: 2.2 }],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 1, from: 0, to: 1.6 }, { step: 2, from: 0, to: 3.0 }, { step: 3, from: 0, to: 3.4 }],
    }),
    stampAt: k => [1150, k.top + 560],
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 30, bot = top + 560
      const X = u => RX0 + u * (RX1 - RX0)
      const Y = v => bot - v * (bot - top)
      const cam = [CAM[0], Y(.62)]
      const lamp = [[X(.42), Y(1) + 4], [X(.58), Y(1) + 4]]
      const lampMid = [X(.5), Y(1) + 6]

      // the cache grid, faint; cells fill as they learn
      const fill = k.thumb ? 1 : i >= 3 ? k.p(3, 2.6, .3) : i === 2 ? k.p(2, 1.4, 1.4) * .25 : 0
      for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
        const x0 = X(cx / CW), y0 = Y((cy + 1) / CH), w = (RX1 - RX0) / CW, h = (bot - top) / CH
        const order = ((cx * 7 + cy * 3) % 11) / 11
        const on = fill > order
        if (on) k.flat(k.rect(x0 + 3, y0 + 3, w - 6, h - 6), k.mix(k.paper, k.P.hi, .15 + .5 * cellTone(cx, cy)), .55)
        k.seed('cell' + cx + '_' + cy); k.line(k.rect(x0, y0, w, h), .25, k.dim, { closed: true })
      }

      // the room
      k.seed('floor'); k.line([[X(0), bot], [X(1), bot]], 1.4, k.ink)
      k.seed('ceil'); k.line([[X(0), top], [X(1), top]], 1.4, k.ink)
      k.seed('wallL'); k.line([[X(0), top], [X(0), bot]], 1.6, k.P.a)
      k.seed('wallR'); k.line([[X(1), top], [X(1), bot]], 1.6, k.P.b)
      k.seed('block'); k.shape(k.rect(X(.56), Y(.34), X(.78) - X(.56), Y(0) - Y(.34)), { fill: k.dim, op: .35, sw: 1.0 })
      k.seed('lamp'); k.line(lamp, 3.2, k.P.hi)
      k.text(p.lamp, lampMid[0], top - 18, { role: 'label', size: 26, min: 14, maxW: 260, lines: 1, align: 'center' })

      // camera
      k.seed('cam'); k.shape(k.circle(cam[0], cam[1], 16, 24), { fill: k.ink, op: 1, sw: .8 })
      k.text(p.camera, cam[0] - 20, cam[1] - 34, { role: 'label', size: 26, min: 14, maxW: 220, lines: 1 })

      // 0: the camera ray to the floor
      const h0 = [X(.4), bot]
      const g0 = k.thumb ? 1 : k.ease(k.p(0, 1.2, .2))
      k.seed('ray0'); k.line(k.partial([cam, h0], g0), 1.3, k.P.a)
      if (g0 > .95) {
        k.seed('h0'); k.shape(k.circle(h0[0], h0[1] - 2, 8, 16), { fill: k.P.a, op: 1, sw: .6 })
        k.text(p.hit, h0[0] - 70, bot + 44, { role: 'label', size: 24, min: 14, maxW: 300, lines: 1 })
      }

      // 1: shadow ray to the lamp, dashed
      if (i >= 1) {
        const g1 = k.thumb ? 1 : k.ease(k.p(1, 1.2, .1))
        const n = 10
        for (let d = 0; d < n; d += 1) {
          const a = d / n, b = (d + .55) / n
          if (a > g1) break
          k.seed('sh' + d)
          k.line([[k.lerp(h0[0], lampMid[0], a), k.lerp(h0[1], lampMid[1], a)], [k.lerp(h0[0], lampMid[0], Math.min(b, g1)), k.lerp(h0[1], lampMid[1], Math.min(b, g1))]], 1.0, k.P.hi)
        }
        k.text(p.shadow, X(.5), Y(.55), { role: 'label', size: 24, min: 14, maxW: 300, lines: 1, col: k.P.hi })
      }

      // 2: one bounce, then the cache cell
      const h1 = [X(.15), Y(1)]
      if (i >= 2) {
        const g2 = k.thumb ? 1 : k.ease(k.p(2, 1.1, .1))
        k.seed('ray1'); k.line(k.partial([h0, h1], g2), 1.3, k.P.b)
        if (g2 > .95) {
          const cx = 1, cy = CH - 1
          const pulse = k.thumb ? 1 : k.easeOut(k.p(2, .8, 1.2))
          const w = (RX1 - RX0) / CW, h = (bot - top) / CH
          k.seed('hot'); k.shape(k.rect(X(cx / CW), Y((cy + 1) / CH), w, h), { fill: k.P.hi, op: .55 * pulse, sw: 1.8, ink: k.P.hi })
          k.text(p.cell, X(.22), Y(.93), { role: 'label', size: 24, min: 14, maxW: 300, lines: 1, col: k.ink })
        }
      }

      // 3: every pixel, every frame
      if (i >= 3) {
        FAN.forEach((f, n) => {
          const g = k.thumb ? 1 : k.ease(k.p(3, .9, .15 + n * .2))
          if (g <= 0) return
          const a = [X(f.hit[0]), Y(f.hit[1])], b = [X(f.b[0]), Y(f.b[1])]
          k.push(); k.alpha(.7)
          k.seed('fa' + n); k.line(k.partial([cam, a], Math.min(1, g * 2)), .7, k.P.a)
          if (g > .5) { k.seed('fb' + n); k.line(k.partial([a, b], (g - .5) * 2), .7, k.P.b) }
          k.pop()
        })
      }

      // legend, one line per step, at the right
      const L = p.legend || []
      let ly = top + 20
      for (let s = 0; s <= Math.min(i, L.length - 1); s++) {
        const r = k.text(L[s], 1060, ly, { role: 'body', size: 30, min: 16, maxW: 320, lines: 3, col: s === i ? k.ink : k.dim })
        ly += r.h + 26
      }

      k.point = i === 0 ? h0 : i === 1 ? lampMid : i === 2 ? h1 : [X(.5), Y(.5)]
      k.mood = i === 3 ? 'proud' : i === 2 ? 'excited' : 'neutral'
    },
  }
})())
