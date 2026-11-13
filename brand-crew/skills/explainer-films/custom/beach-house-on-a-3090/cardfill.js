// beach-house-on-a-3090 / cardfill
//
// The article's VramBudget widget, as a picture. On the left, host RAM: one
// block per component (text encoder, DiT, VAE), each as tall as its weights.
// On the right, the 24 GB card drawn as a tank with its capacity line. The
// blocks move between the two as the residency policy says:
//
// steps: 0 the parts in RAM · 1 all resident: the stack spills past the line
//        2 one stage at a time: the text encoder alone · 3 it leaves, the DiT
//        and VAE come in and the steps tick · 4 the decode: activations stack
//        on top, up to the measured peak
//
// params: { parts: [{ label, size, gib }] (gib is geometry), card: number
//           (geometry), cardLabel, ramLabel, peak: number (geometry),
//           peakLabel, legend: [5 strings], ticks: number (dots, geometry),
//           data: "article" }
// Every string drawn is the storyboard's.
BESPOKE.define((() => {
  const RX = 150, RW = 560, CX = 900, CWID = 300, GAP = 26

  return {
    plan: () => ({
      min: [3.4, 4, 3.6, 4.4, 4],
      events: [
        { step: 0, at: .2, type: 'draw' },
        { step: 1, at: .3, type: 'whoosh' }, { step: 1, at: 1.3, type: 'thunk' },
        { step: 2, at: .3, type: 'whoosh' },
        { step: 3, at: .3, type: 'whoosh' }, { step: 3, at: 1.4, type: 'ticks', n: 10, span: 1.6 },
        { step: 4, at: .3, type: 'grow' }, { step: 4, at: 1.4, type: 'ding' },
      ],
      motion: [1, 2, 3, 4].map(s => ({ step: s, from: 0, to: 1.6 })),
    }),
    draw(k) {
      const p = k.params, i = k.step, parts = p.parts || []
      const base = 900, top = k.top + 120
      const total = parts.reduce((s, x) => s + x.gib, 0)
      const scale = (base - top) / Math.max(total, p.card || 24, p.peak || 0) // px per GiB
      const n = parts.length, colW = (RW - GAP * (n - 1)) / n

      // where each block sits in RAM, and where it sits when stacked in the card
      const ram = parts.map((x, j) => [RX + j * (colW + GAP), base - x.gib * scale, colW])
      const resident = j => i === 1 || (i === 2 && parts[j].key === 'te') || (i >= 3 && parts[j].key !== 'te')
      const order = parts.map((x, j) => j).filter(j => resident(j))
      const card = {}
      let y = base
      order.forEach(j => { y -= parts[j].gib * scale; card[j] = [CX + 20, y, CWID - 40] })
      const stackTop = y

      // host RAM shelf and the card tank
      k.seed('ram'); k.line([[RX - 20, base + 6], [RX + RW + 20, base + 6]], 1, k.ink)
      if (p.ramLabel) k.text(p.ramLabel, RX, base + 56, { role: 'mono', size: 26, col: k.dim })
      k.seed('tank'); k.line([[CX, top - 30], [CX, base + 6], [CX + CWID, base + 6], [CX + CWID, top - 30]], 1.1, k.ink)
      const cy = base - (p.card || 24) * scale
      k.seed('capline'); k.line([[CX - 16, cy], [CX + CWID + 16, cy]], .9, k.P.hi, { dash: [12, 8] })
      if (p.cardLabel) k.text(p.cardLabel, CX, base + 56, { role: 'mono', size: 26, col: k.dim })

      // the blocks: move from where they were at the previous step to where they are now
      const was = j => (i - 1 === 1 || (i - 1 === 2 && parts[j].key === 'te') || (i - 1 >= 3 && parts[j].key !== 'te'))
      const mv = k.thumb ? 1 : k.ease(k.p(i, 1.1, .2))
      // previous card stacking, to start the move from
      const prev = {}
      if (i > 0) {
        let yy = base
        parts.forEach((x, j) => { if (was(j)) { yy -= x.gib * scale; prev[j] = [CX + 20, yy, CWID - 40] } })
      }
      parts.forEach((x, j) => {
        const from = i > 0 && prev[j] ? prev[j] : ram[j]
        const to = card[j] || ram[j]
        const bx = k.lerp(from[0], to[0], mv), by = k.lerp(from[1], to[1], mv), bw = k.lerp(from[2], to[2], mv)
        const h = x.gib * scale
        const grow = i === 0 && !k.thumb ? k.easeOut(k.p(0, .6, .15 + j * .2)) : 1
        if (grow <= 0) return
        const hh = h * grow
        const col = x.key === 'te' ? k.tone('b') : x.key === 'dit' ? k.P.a : k.tone('light')
        k.seed('blk' + j + ':' + Math.round(bw) + ':' + Math.round(hh))
        k.shape(k.rect(bx, by + h - hh, bw, hh), { fill: col, op: .9, sw: .8 })
        if (x.label && hh > 40) k.text(x.label, bx + bw / 2, by + h - hh + Math.min(hh / 2, 60) + 10, { role: 'body', size: 28, min: 16, maxW: bw - 16, align: 'center', col: k.textOn(col) })
        if (x.size && hh > 90) k.text(x.size, bx + bw / 2, by + h - hh + Math.min(hh / 2, 60) + 46, { role: 'mono', size: 24, min: 14, maxW: bw - 16, align: 'center', col: k.textOn(col) })
      })

      // all resident: the part of the stack above the line is the spill
      if (i === 1 && stackTop < cy) {
        const sk = k.thumb ? 1 : k.p(1, .6, 1.2)
        if (sk > 0) { k.seed('spill'); k.hl(CX + 10, stackTop, CWID - 20, cy - stackTop, k.P.hi, sk) }
      }
      // denoising: the steps tick as dots beside the tank
      if (i >= 3) {
        const nd = Math.max(1, Math.min(40, p.ticks || 8))
        const tk = k.thumb ? 1 : k.p(3, 1.6, 1.2)
        for (let d = 0; d < nd; d++) {
          const on = i > 3 || tk * nd > d
          const dy = top + 10 + d * Math.min(24, (base - top - 20) / nd)
          k.seed('tick' + d); k.shape(k.circle(CX + CWID + 46, dy, 7, 14), { fill: on ? k.P.a : k.paper, op: on ? 1 : .4, sw: .5 })
        }
      }
      // the decode: activations on top of the stack, up to the measured peak
      if (i === 4 && p.peak) {
        const py = base - p.peak * scale, ak = k.thumb ? 1 : k.easeOut(k.p(4, 1, .3))
        const ah = (stackTop - py) * ak
        if (ah > 1) { k.seed('act' + Math.round(ah)); k.shape(k.rect(CX + 20, stackTop - ah, CWID - 40, ah), { fill: k.P.hi, op: .55, sw: .6 }) }
        if (ak > .8 && p.peakLabel) {
          k.seed('peakline'); k.line([[CX - 16, py], [CX + CWID + 16, py]], .8, k.ink)
          k.text(p.peakLabel, CX - 30, py + 10, { role: 'mono', size: 26, min: 16, maxW: 420, align: 'right' })
        }
      }
      if (p.legend && p.legend[i]) k.text(p.legend[i], RX, k.top + 40, { role: 'head', size: 38, min: 24, maxW: 1180, lines: 2 })

      k.point = i === 0 ? [RX + RW / 2, base - 120] : [CX + CWID / 2, Math.max(top, stackTop)]
      k.mood = i === 1 ? 'surprised' : i === 4 ? 'proud' : 'thinking'
    },
  }
})())
