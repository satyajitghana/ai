// tokeneconomizer / rebill
//
// Why an unused tool costs money. Five rows stack down the frame, one per turn of a session;
// each row is that turn's whole request, left to right in the order a prompt cache matches it:
// the tool definitions, the system prompt, the task, then the history so far. Every row
// re-sends the row above plus a new tail. Step 1 underlines what each turn reads from the
// cache and what it writes. Step 2 shrinks the tools block in every row (the deny list:
// a cut that pays on every turn). Step 3 shows the one case that hurts: a conversation resumed
// after its tool list changed, whose whole history is written to the cache again.
// Widths are invented geometry, so the runtime stamps it Illustrative. Every label is a
// storyboard string.
//
// steps: 0 the rows build · 1 read vs written · 2 tools shrink · 3 resumed after a change
// params: { tools, system, task, history, row, read, written, cut, resumed }
BESPOKE.define((() => {
  const ROWS = 5
  const X0 = 130
  const TW = 240, TW2 = 150, SW = 100, KW = 70, HW = 90
  const RH = 76, GAP = 34

  return {
    stampAt: () => [1180, 900],
    plan: () => ({
      min: [5.0, 4.6, 4.8, 4.8],
      events: [{ step: 0, at: .3, type: 'ticks', n: 5, span: 2.4 }, { step: 1, at: .4, type: 'pop' },
        { step: 2, at: .5, type: 'ticks', n: 5, span: 1.4 }, { step: 3, at: .6, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 3 }, { step: 2, from: 0, to: 2.2 }, { step: 3, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 70
      const shrink = i < 2 ? 0 : k.thumb ? 1 : k.ease(k.p(2, 1.6, .3))
      const tw = TW + (TW2 - TW) * shrink
      const RD = k.mix(k.dim, k.ink, .5), WR = k.mix(k.P.a, k.ink, .45)
      const label = { role: 'label', size: 24, min: 13, maxW: 260, lines: 1 }

      // column labels over the first row
      const heads = [[p.tools, X0], [p.system, X0 + tw], [p.task, X0 + tw + SW], [p.history, X0 + tw + SW + KW]]
      heads.forEach(([s, x], n) => {
        if (!s) return
        const a = k.thumb ? 1 : k.p(0, .5, .1 + n * .1)
        k.text(s, x + 4, top - 18, { ...label, maxW: n === 3 ? 300 : (n === 0 ? tw - 8 : 96), alpha: a })
      })

      for (let r = 0; r < ROWS; r++) {
        const y = top + r * (RH + GAP)
        const appear = k.thumb || i > 0 ? 1 : k.easeOut(k.p(0, .6, .3 + r * .5))
        if (appear <= 0) continue
        const resumed = i === 3 && r === ROWS - 1
        k.push(); k.alpha(appear)
        // tools block, with a ghost of what the deny list removed
        if (shrink > 0) {
          k.push(); k.alpha(.3 * shrink); k.seed('ghost' + r)
          k.line(k.rect(X0 + tw, y, TW - tw, RH), .6, k.dim, { closed: true }); k.pop()
        }
        let x = X0
        k.seed('t' + r + ':' + Math.round(tw / 10)); k.shape(k.rect(x, y, tw, RH), { fill: k.P.b, op: .8, sw: .8 }); x += tw
        k.seed('s' + r); k.shape(k.rect(x, y, SW, RH), { fill: k.mix(k.P.b, k.paper, .55), op: .8, sw: .8 }); x += SW
        k.seed('k' + r); k.shape(k.rect(x, y, KW, RH), { fill: k.tone('light'), op: .9, sw: .8 }); x += KW
        const hist = r * HW
        if (hist > 0) { k.seed('h' + r); k.shape(k.rect(x, y, hist, RH), { fill: k.mix(k.P.a, k.paper, .45), op: .8, sw: .8 }) }
        const end = x + hist
        // step 1+: the underline. Read from cache up to the previous row's end, the new tail written.
        if (i >= 1) {
          const u = k.thumb ? 1 : i === 1 ? k.p(1, .8, .2 + r * .15) : 1
          const prevEnd = r === 0 ? X0 : end - (r === 0 ? 0 : HW)
          const uy = y + RH + 10
          if (resumed) {
            k.seed('uw' + r); k.line(k.partial([[X0, uy], [end, uy]], u), 3.2, WR)
          } else {
            if (r > 0) { k.seed('ur' + r); k.line(k.partial([[X0, uy], [prevEnd, uy]], u), 3, RD) }
            k.seed('uw' + r); k.line(k.partial([[prevEnd, uy], [end, uy]], u), 3.2, WR)
          }
        }
        k.pop()
      }

      // legend on the right
      const lx = 1010
      let ly = top + 10
      const lo = { role: 'body', size: 30, min: 15, maxW: 360, lines: 3 }
      if (p.row) ly += k.text(p.row, lx, ly, { ...lo, col: k.dim, alpha: k.thumb ? 1 : k.p(0, .6, 1.6) }).h + 26
      if (i >= 1) {
        const a = k.thumb ? 1 : i === 1 ? k.p(1, .5, .6) : 1
        k.seed('lr'); k.line([[lx, ly + 16], [lx + 50, ly + 16]], 3, RD)
        if (p.read) ly += k.text(p.read, lx + 66, ly, { ...lo, maxW: 300, alpha: a }).h + 14
        k.seed('lw'); k.line([[lx, ly + 16], [lx + 50, ly + 16]], 3.2, WR)
        if (p.written) ly += k.text(p.written, lx + 66, ly, { ...lo, maxW: 300, alpha: a }).h + 26
      }
      if (i === 2 && p.cut) k.text(p.cut, lx, ly, { ...lo, role: 'head', size: 32, alpha: k.thumb ? 1 : k.p(2, .6, 1.4) })
      if (i === 3 && p.resumed) k.text(p.resumed, lx, ly, { ...lo, role: 'head', size: 32, col: WR, alpha: k.thumb ? 1 : k.p(3, .6, .4) })

      const lastY = top + (ROWS - 1) * (RH + GAP)
      k.point = i === 2 ? [X0 + tw / 2, top + RH] : i === 3 ? [X0 + 450, lastY + RH / 2] : i === 1 ? [X0 + 420, top + 2 * (RH + GAP)] : [X0 + 560, top + 3 * (RH + GAP)]
      k.mood = i === 2 ? 'happy' : i === 3 ? 'surprised' : 'thinking'
    },
  }
})())
