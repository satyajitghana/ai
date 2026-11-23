// trellis2-lora-finetuning / rotate
//
// The article's PoseVsShape widget, as a moving picture. A reference shoe
// outline (grey) and a generated one (the film's accent) are overlaid after
// the eval script's normalization. Step 0: the generated shoe lies on its side
// and the score is poor. Step 1: it is turned upright, with no change to its
// shape, and the score jumps: that part was pose. Step 2: its sole morphs into
// the reference sole, the part the LoRA was trained for. A toy outline, stamped
// Illustrative; the scores drawn are storyboard strings (the guide's five-shoe
// means).
//
// steps: 0 as generated · 1 best rotation · 2 with the LoRA
// params: { raw, rot, lora, refLabel, genLabel, poseNote, shapeNote }
BESPOKE.define((() => {
  const OUT = [[0, .14], [.02, .03], [.2, 0], [.5, 0], [.8, 0], [.96, .02], [1, .08], [.96, .15], [.8, .22], [.62, .27], [.5, .36], [.4, .42], [.2, .42], [.06, .36]]
  const resample = (poly, n) => {
    const seg = []; let tot = 0
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, l]); tot += l }
    const out = []; let si = 0, acc = 0
    for (let k = 0; k < n; k++) {
      const s = k / n * tot
      while (acc + seg[si][2] < s) { acc += seg[si][2]; si++ }
      const [a, b, l] = seg[si], t = l ? (s - acc) / l : 0
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
    return out
  }
  const REF = resample(OUT, 160)
  // the base model's sole: bulged through the arch, heel dropped
  const BAD = REF.map(([x, y]) => y < .05 ? [x, y + .09 * Math.sin(Math.PI * x) - .04 * (1 - x)] : [x, y])
  return {
    stampAt: k => [1120, k.top + 520],
    plan: () => ({
      min: [4.2, 4.6, 4.8],
      events: [{ step: 1, at: .3, type: 'whoosh' }, { step: 1, at: 1.6, type: 'ding' }, { step: 2, at: .3, type: 'ticks', n: 8, span: 1.6 }, { step: 2, at: 2.2, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 1.8 }, { step: 2, from: 0, to: 2.2 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const S = 620, CX = 560, CY = Math.max(k.top + 300, 560)
      const rotT = k.thumb ? 1 : st === 0 ? 0 : st === 1 ? k.ease(k.p(1, 1.5, .2)) : 1
      const morphT = k.thumb ? 1 : st < 2 ? 0 : k.ease(k.p(2, 2, .2))
      const ang = (1 - rotT) * Math.PI / 2
      const shape = BAD.map((q, i) => [q[0] + (REF[i][0] - q[0]) * morphT, q[1] + (REF[i][1] - q[1]) * morphT])
      const place = (pts, a) => pts.map(([x, y]) => {
        const u = x - .5, v = y - .21, c = Math.cos(a), s = Math.sin(a)
        return [CX + (c * u - s * v) * S, CY - (s * u + c * v) * S]
      })
      const ref = place(REF, 0), gen = place(shape, ang)
      k.seed('ref'); k.shape(ref, { fill: k.tone('light'), op: .35, sw: 1.2, ink: k.dim })
      const gc = k.mix(k.P.a, k.ink, .45)
      gen.forEach(([x, y], i) => { if (i % 2 === 0) k.flat(k.circle(x, y, 4.5, 8), gc, 1) })
      // labels for the two outlines
      if (p.refLabel) k.text(p.refLabel, CX - S * .5, CY + 160, { role: 'label', size: 24, min: 12, maxW: 320, lines: 1, col: k.dim })
      if (p.genLabel) k.text(p.genLabel, CX + S * .05, CY + 160, { role: 'label', size: 24, min: 12, maxW: 320, lines: 1, col: k.mix(k.P.a, k.ink, .45) })
      // the score board on the right
      const rows = [p.raw, p.rot, p.lora]
      let y = k.top + 40
      rows.forEach((s, n) => {
        if (!s || n > st) return
        const on = n === st
        const a = on && !k.thumb ? k.easeOut(k.p(n, .5, n === 0 ? .3 : 1.4)) : 1
        const o = { role: on ? 'head' : 'body', size: on ? 36 : 26, min: 14, maxW: 420, lines: 2, col: on ? k.ink : k.dim, alpha: a }
        const m = k.measure(s, o); k.text(s, 960, y, o); y += m.h + 28
      })
      const note = st === 1 ? p.poseNote : st === 2 ? p.shapeNote : ''
      if (note) {
        const a = k.thumb ? 1 : k.easeOut(k.p(st, .6, 2.2))
        k.hl(950, y + 4, 420, 46, k.P.hi, a)
        k.text(note, 960, y + 8, { role: 'label', size: 26, min: 12, maxW: 360, lines: 1, alpha: a })
      }
      k.point = st === 2 ? [CX, CY + 20] : [CX + S * .3, CY - 60]
      k.mood = st === 1 ? 'surprised' : st === 2 ? 'happy' : 'thinking'
    },
  }
})())
