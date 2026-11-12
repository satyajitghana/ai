// sketchpad-exact-arithmetic / tape
//
// The article's TapeAdder, run on its own example, 999999999 + 1. A sheet of
// cells (carry row, top, bottom, answer); a three-cell window on one column;
// the view goes to the model, which answers one token ("a" is digit 0 with a
// carry, a digit alone is that digit with none, H halts); the runtime writes
// the digit under the column and the carry one column left, and moves the
// window left. The whole carry chain lives on the sheet, one column at a time.
// The article's own worked example and token code, so params say
// "data": "article". Digits are drawn as pieces of the storyboard's strings.
//
// steps: 0 the sheet · 1 the first column · 2 the chain · 3 the last column and halt
// params: { data, top: "9 9 …", bottom, carryDigit, answer: "1 0 0 …", model, view, tokens: { a, one, halt }, legend: [4] }
BESPOKE.define((() => {
  const COLS = 10
  // per column, right to left: what the view holds and what the model answers
  const steps = []
  for (let c = 9; c >= 1; c--) steps.push({ c, view: [c < 9 ? 'carry' : '', 'nine', c === 9 ? 'one' : ''], tok: 'a', digit: 'zero', carry: true })
  steps.push({ c: 0, view: ['carry', '', ''], tok: 'one', digit: 'one', carry: false })
  steps.push({ c: -1, view: ['', '', ''], tok: 'halt' })
  return {
    plan: () => ({
      min: [3.4, 5.2, 5.4, 4.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 10, span: 1.2 }, { step: 1, at: .6, type: 'pop' }, { step: 1, at: 2.2, type: 'print' },
        { step: 2, at: .2, type: 'ticks', n: 8, span: 3.6 }, { step: 3, at: .5, type: 'print' }, { step: 3, at: 2.6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, i = k.step
      const word = (s, j) => (s || '').split(' ')[j]
      const CW = 62, X0 = 170, Y0 = Math.max(k.top + 50, 260), RY = [Y0, Y0 + 72, Y0 + 144, Y0 + 246]
      // how far the machine has run: in units of columns processed (0..11)
      let run = 0
      if (i === 1) run = k.thumb ? 1 : Math.min(1, k.p(1, 4, .3))
      if (i === 2) run = 1 + (k.thumb ? 8 : 8 * Math.min(1, k.p(2, 4.2, .3)))
      if (i >= 3) run = 9 + (k.thumb ? 2 : 2 * Math.min(1, k.p(3, 3.4, .3)))
      const cur = Math.min(steps.length - 1, Math.floor(run)), ph = run - Math.floor(run)
      const st = steps[cur]
      // the sheet
      const sk = k.thumb ? 1 : k.easeOut(k.span(0, .8))
      k.push(); k.alpha(sk)
      for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) {
        k.flat(k.rect(X0 + c * CW + 3, RY[r] + 3, CW - 6, CW - 6), k.mix(k.paper, k.ink, r === 0 ? .1 : .18), 1)
      }
      k.flat(k.rect(X0, RY[3] - 22, COLS * CW, 4), k.ink, .8)
      const glyph = (s, c, r, col) => { if (s) k.text(s, X0 + c * CW + CW / 2, RY[r] + CW / 2 + 12, { role: 'mono', size: 38, min: 14, align: 'center', col: col || k.ink }) }
      for (let c = 1; c < COLS; c++) glyph(word(p.top, c - 1), c, 1)
      glyph(p.bottom, 9, 2)
      k.pop()
      // what has been painted: answers and carries of the columns already done
      const done = Math.floor(run) + (ph > .7 ? 1 : 0)
      steps.forEach((s2, j) => {
        if (j >= done || s2.c < 0) return
        glyph(word(p.answer, s2.c), s2.c, 3, k.P.a)
        if (s2.carry) glyph(p.carryDigit, s2.c - 1, 0, k.P.b)
      })
      // the window on the current column
      if (i >= 1 || k.thumb) {
        const wc = cur < steps.length - 1 ? st.c : -1
        const wx = X0 + wc * CW
        if (wc >= -1) { k.seed('win' + wc); k.line(k.rect(wx - 4, RY[0] - 4, CW + 8, CW * 3 + 34).concat([[wx - 4, RY[0] - 4]]), 1.6, k.P.hi) }
      }
      // the machine, below: view → model → token
      const MY = RY[3] + 120
      if (i >= 1 || k.thumb) {
        const vx = X0, show = (s) => s === 'nine' ? word(p.top, 0) : s === 'one' ? p.bottom : s === 'carry' ? p.carryDigit : ''
        if (p.view) k.text(p.view, vx, MY - 24, { role: 'label', size: 24, min: 10, maxW: 700, lines: 1, col: k.dim })
        for (let r = 0; r < 3; r++) {
          k.flat(k.rect(vx + r * (CW + 6), MY, CW, CW), k.mix(k.paper, k.ink, .18), 1); k.seed('vc' + r); k.line(k.rect(vx + r * (CW + 6), MY, CW, CW).concat([[vx + r * (CW + 6), MY]]), .8, k.dim)
          const g = show(st.view[r]); if (g) k.text(g, vx + r * (CW + 6) + CW / 2, MY + CW / 2 + 12, { role: 'mono', size: 36, min: 14, align: 'center' })
        }
        const ak = Math.min(1, ph / .35)
        k.seed('a1'); k.arrow([[vx + 3 * (CW + 6) + 6, MY + CW / 2], [vx + 3 * (CW + 6) + 70, MY + CW / 2]], k.ink, 1, 1)
        const bx = vx + 3 * (CW + 6) + 84
        k.seed('model'); k.shape(k.rrect(bx, MY - 6, 230, CW + 12, 10), { fill: k.P.b, op: .8, sw: 1 })
        if (p.model) k.text(p.model, bx + 115, MY + CW / 2 + 10, { role: 'label', size: 26, min: 10, align: 'center', maxW: 210, lines: 1, col: k.textOn(k.P.b) })
        k.seed('a2'); k.arrow([[bx + 242, MY + CW / 2], [bx + 300, MY + CW / 2]], k.ink, 1, 1)
        const tk = p.tokens ? p.tokens[st.tok] : ''
        if (tk && ak > .5) k.text(tk, bx + 316, MY + CW / 2 + 12, { role: 'mono', size: 32, min: 12, maxW: 1360 - bx - 316, lines: 1, col: k.P.a })
      }
      if (p.legend && p.legend[i]) k.text(p.legend[i], X0 + COLS * CW + 50, Y0 + 20, { role: 'head', size: 32, min: 14, maxW: 1360 - (X0 + COLS * CW + 50), lines: 4 })
      k.point = i === 0 ? [X0 + COLS * CW, RY[1] + 30] : [X0 + Math.max(0, st.c) * CW + CW / 2, RY[1]]
      k.mood = i === 3 ? 'happy' : i === 2 ? 'excited' : 'thinking'
    },
  }
})())
