// llama-modchip / budget
//
// The article's TokenBudget widget, as a picture. Left: a tall frame for the
// machine's RAM, filled from the bottom by the MaxQ checkpoint's tensors in the
// shares the GGUF header gives (routed experts 92.7%, attention 4.2%, shared
// expert 1.5%, head 0.7%, the rest 0.3%). Right: one token's reads as a bar
// that grows a segment per beat: first the routed experts' slice (six of 256
// per layer), lit as a scatter of small cells inside the experts' block; then
// attention, which every token reads whole; then the rest and the total. The
// point the picture makes is the inversion: the biggest block on the left is a
// quarter of the bar on the right. Every label is a storyboard string.
//
// steps: 0 the file fills RAM · 1 a token reads its experts · 2 attention ·
//        3 the rest, and the total
// params: { data, ram, file, fileParts: [{label, share}], tokenTitle,
//           token: [{label, value, gb}], routedShare, total }
BESPOKE.define((() => {
  const FX = 150, FW = 300, BX = 600, BW = 760
  const T_LAB = { role: 'label', size: 26, min: 13, maxW: 300, lines: 2, lh: 1.08 }
  const T_HEAD = { role: 'head', size: 34, min: 16, maxW: BW, lines: 1 }
  const T_VAL = { role: 'mono', size: 24, min: 12, maxW: 220, lines: 1 }
  const T_SEG = { role: 'label', size: 24, min: 12, maxW: 220, lines: 2, lh: 1.05 }

  // which expert cells light for the token: a fixed draw, so every frame agrees
  function cells(k) {
    const r = k.rng('experts'), out = []
    for (let row = 0; row < 12; row++) {
      const lit = new Set()
      while (lit.size < 2) lit.add(Math.floor(r() * 16))
      out.push([...lit])
    }
    return out
  }

  return {
    stampAt: k => [BX + BW - 120, k.top + 20],
    plan: () => ({
      min: [4.2, 4.6, 4.0, 4.6],
      events: [{ step: 0, at: .2, type: 'grow' }, { step: 1, at: .3, type: 'ticks', n: 12, span: 1.4 },
        { step: 2, at: .3, type: 'pop' }, { step: 3, at: .3, type: 'pop' }, { step: 3, at: 1.4, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2.4 }, { step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 1.4 }, { step: 3, from: 0, to: 2.0 }],
    }),
    draw(k) {
      const p = k.params, i = k.thumb ? 3 : k.step
      const parts = p.fileParts || [], tok = p.token || []
      const top = k.top + 10

      // ---- left: RAM, filled by the file ---------------------------------
      const hRam = k.measure(p.ram, T_LAB).h
      k.text(p.ram, FX + FW / 2, top + k.measure(p.ram, T_LAB).px, { ...T_LAB, align: 'center', col: k.dim })
      const FY0 = top + hRam + 14, FY1 = 900, FH = FY1 - FY0
      k.seed('ram'); k.line(k.rect(FX, FY0, FW, FH), 1.1, k.ink, { closed: true })
      // the file is 56.93 of 64 GB: it fills about 89% of the frame
      const fill = k.thumb ? 1 : k.ease(k.p(0, 2.2, .2))
      const used = Math.round(FH * .89 * fill / 12) * 12
      let y = FY1
      const tones = ['a', 'hi', 'b', 'light', 'light']
      const total = parts.reduce((s, q) => s + q.share, 0) || 1
      const routedTop = FY1 - FH * .89 * (parts[0] ? parts[0].share / total : 0)
      parts.forEach((q, j) => {
        const h = Math.max(j === 0 ? 0 : 6, used * q.share / total)
        if (used <= 0) return
        k.seed('fp' + j); k.shape(k.rect(FX + 4, y - h, FW - 8, h), { fill: k.tone(tones[j % tones.length]), op: .85, sw: .6 })
        y -= h
      })
      // labels for the file's parts, to the right of the frame
      const lk = k.thumb ? 1 : k.easeOut(k.p(0, .8, 1.8))
      if (lk > 0 && parts.length) {
        k.text(parts[0].label, FX + FW / 2, (FY1 + routedTop) / 2, { ...T_LAB, maxW: FW - 30, align: 'center', col: k.textOn(k.tone('a')), alpha: lk })
        if (p.file) k.text(p.file, FX + FW / 2, FY0 + FH * .11 - 14, { ...T_VAL, maxW: FW - 20, align: 'center', col: k.dim, alpha: lk })
      }
      // step 1: the token's experts light inside the routed block
      if (i >= 1) {
        const ck = k.thumb ? 1 : k.p(1, 1.4, .3)
        const g = cells(k), rows = g.length, cw = (FW - 24) / 16, rh = (FY1 - routedTop - 20) / rows
        g.forEach((lit, r) => {
          if (r / rows > ck) return
          lit.forEach(c => {
            k.flat(k.rect(FX + 12 + c * cw + 2, routedTop + 10 + r * rh + 2, cw - 4, rh - 4), k.P.hi, .95)
          })
        })
      }

      // ---- right: what one token reads -----------------------------------
      if (i < 1) { k.point = [FX + FW, FY1 - used / 2]; k.mood = 'thinking'; return }
      const hk = k.thumb ? 1 : k.easeOut(k.p(1, .6, 0))
      const th = k.measure(p.tokenTitle, T_HEAD)
      k.text(p.tokenTitle, BX, top + th.px, { ...T_HEAD, alpha: hk })
      const BY = top + th.h + 40, BH = 90
      const sumGB = tok.reduce((s, q) => s + q.gb, 0) || 1
      // which segments are shown: 0 at step 1, +1 at step 2, all at step 3
      const shown = i === 1 ? 1 : i === 2 ? 2 : tok.length
      const segT = j => (k.thumb ? 1 : k.ease(k.p(j === 0 ? 1 : j === 1 ? 2 : 3, 1.0, j < 2 ? .4 : .2 + (j - 2) * .25)))
      let x = BX
      k.seed('bar'); k.line(k.rect(BX, BY, BW, BH), .8, k.dim, { closed: true })
      const segTone = ['a', 'hi', 'b', 'light', 'light']
      let ly = BY + BH + 44
      tok.forEach((q, j) => {
        if (j >= shown) return
        const w = Math.round(BW * q.gb / sumGB * segT(j) / 8) * 8
        if (w > 1) { k.seed('seg' + j + '_' + Math.round(w)); k.shape(k.rect(x, BY, w, BH), { fill: k.tone(segTone[j % segTone.length]), op: .9, sw: .7 }) }
        // labels: the two big parts under their segments, the rest in a list
        const a = segT(j)
        if (j < 2) {
          const cx = x + BW * q.gb / sumGB / 2
          const m = k.measure(q.label, T_SEG)
          k.text(q.label, cx, BY + BH + 12 + m.px, { ...T_SEG, align: 'center', alpha: a })
          k.text(q.value, cx, BY + BH + 12 + m.h + 8 + k.measure(q.value, T_VAL).px, { ...T_VAL, align: 'center', col: k.dim, alpha: a })
        }
        x += BW * q.gb / sumGB
      })
      ly = BY + BH + 12 + Math.max(...tok.slice(0, 2).map(q => k.measure(q.label, T_SEG).h)) + 8 + k.measure(tok[0].value, T_VAL).h + 40
      if (i >= 1 && p.routedShare) {
        const a = k.thumb ? 1 : k.easeOut(k.p(1, .6, 1.2))
        const m = k.measure(p.routedShare, { ...T_HEAD, size: 30 })
        k.text(p.routedShare, BX, ly + m.px, { ...T_HEAD, size: 30, col: k.P.a, alpha: a })
        ly += m.h + 24
      }
      if (i >= 3) {
        tok.slice(2).forEach((q, j) => {
          const a = segT(j + 2), LO = { ...T_SEG, maxW: BW - 240, lines: 1 }
          const m = k.measure(q.label, LO)
          k.text(q.label, BX, ly + m.px, { ...LO, col: k.dim, alpha: a })
          k.text(q.value, BX + BW, ly + m.px, { ...T_VAL, align: 'right', col: k.dim, alpha: a })
          ly += m.h + 6
        })
        const a = k.thumb ? 1 : k.backOut(k.p(3, .8, 1.2))
        if (p.total && a > 0) {
          const m = k.measure(p.total, { ...T_HEAD, size: 44 })
          k.text(p.total, BX, Math.min(925, ly + 20 + m.px), { ...T_HEAD, size: 44, alpha: Math.min(1, a) })
        }
      }
      k.point = i === 0 ? [FX + FW, FY1 - used / 2] : i === 1 ? [FX + FW, (FY1 + routedTop) / 2] : [BX + BW / 2, BY + BH / 2]
      k.mood = i === 3 ? 'proud' : 'thinking'
    },
  }
})())
