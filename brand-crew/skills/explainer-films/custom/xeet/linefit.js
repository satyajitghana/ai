// xeet / linefit
//
// The article's line-fitting loop, from crates/xeet-core/src/inline.rs, drawn
// in the film's medium:
//   step 0  words go onto a line one break at a time; each candidate end is
//           measured against the column edge; the first that crosses stops it
//   step 1  the edge magnified: Blink's layout unit is 1/64 px, and a width is
//           rounded up to the next unit before it is compared (ceil64)
//   step 2  the worked example from the comment on fits(): a line one unit
//           wider than its 240 px box fits when it ends before a space (one
//           unit of slack) and not when it ends after a hyphen
//   step 3  the chosen line is shaped again on its own, kerning across the
//           break is gone, it no longer fits, and the loop steps back a word
// Word widths come from the style's own type (k.measure); the geometry is a
// toy, so the scene is stamped Illustrative. Every string drawn is a param.
//
// params: { words: [str], fits, tooWide, snap, width, box, space, hyphen, yes, no, reshape }
BESPOKE.define((() => {
  const X0 = 170
  const GAP = 22
  const SIZE = 40

  return {
    plan: () => ({
      min: [5.2, 4.6, 5.2, 4.8],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 6, span: 3.2 },
        { step: 1, at: .3, type: 'slide' },
        { step: 2, at: .5, type: 'ding' },
        { step: 3, at: 1.2, type: 'thunk' },
      ],
      motion: [{ step: 0, from: 0, to: 4.2 }, { step: 1, from: 0, to: 2.0 }, { step: 2, from: 0, to: 2.4 }, { step: 3, from: 0, to: 2.6 }],
    }),
    stampAt: k => [1250, k.top + 20],
    draw(k) {
      const p = k.params, i = k.thumb ? 0 : k.step
      const ink = k.ink, hi = k.P.hi, a = k.P.a, dim = k.dim
      const good = k.tone('b'), light = k.tone('light')
      const top = k.top + 30

      // ---- the words, laid out with the style's own type ----
      const opts = { role: 'head', size: SIZE, min: 22, maxW: 600, lines: 1 }
      const ws = p.words.map(w => k.measure(w, opts).w + 26)
      const starts = []
      let x = X0
      ws.forEach((w) => { starts.push(x); x += w + GAP })
      const ends = ws.map((w, j) => starts[j] + w)
      // the column edge: two fifths of the way into the fifth word, so it crosses
      const m = Math.min(4, ws.length - 1)
      const EDGE = ends[m - 1] + .4 * ws[m]
      const LY = top + 70, LH = 74

      const wordBox = (j, X, Y, al, col) => {
        k.push(); k.alpha(al)
        k.seed('w' + j); k.shape(k.rrect(X, Y, ws[j], LH, 10), { fill: col, op: .22, sw: .7 })
        k.text(p.words[j], X + ws[j] / 2, Y + LH / 2 + 14, { ...opts, align: 'center', maxW: ws[j] - 8, col: ink })
        k.pop()
      }

      // the column: a dashed box with its right edge as a hard rule
      const colH = i === 3 ? LH * 2 + 70 : LH + 40
      k.seed('col'); k.line(k.rect(X0 - 20, LY - 20, EDGE - X0 + 20, colH), .45, dim, { closed: true })
      k.seed('edge'); k.line([[EDGE, LY - 50], [EDGE, LY + colH + 10]], 1.1, hi)

      if (i === 0) {
        // candidates arrive one by one; a measuring bar follows the line's end
        const shown = k.thumb ? m + 1 : Math.min(m + 1, Math.floor(k.p(0, 4.0, .2) * (m + 1.6)))
        for (let j = 0; j < Math.max(1, shown); j++) {
          const crosses = j === m
          wordBox(j, starts[j], LY, 1, crosses ? hi : a)
        }
        const last = Math.max(0, Math.min(m, shown - 1))
        const barEnd = ends[last]
        k.seed('bar' + last); k.line([[X0, LY + LH + 18], [barEnd, LY + LH + 18]], 1.2, last === m ? hi : good)
        const verdict = last === m ? p.tooWide : p.fits
        k.text(verdict, Math.min(barEnd, 1300) - 10, LY + LH + 64, { role: 'label', size: 30, min: 16, maxW: 420, lines: 1, align: 'right', col: last === m ? hi : ink })
        k.point = [barEnd, LY + LH / 2]
        k.mood = last === m ? 'surprised' : 'thinking'
        return
      }

      // the line as chosen: words before the crossing one
      for (let j = 0; j < m; j++) wordBox(j, starts[j], LY, i === 3 && j === m - 1 ? 0 : 1, a)

      // ---- the magnified edge: cells of 1/64 px ----
      const RY = LY + LH + 300
      const CELL = 92
      const RX0 = 300
      const cells = 9
      const edgeCell = 5 // the box edge sits on this tick
      const tickX = c => RX0 + c * CELL
      if (i === 1 || i === 2) {
        const t = k.thumb ? 1 : k.ease(k.p(i, .9))
        // a zoom lens from the real edge down to the ruler
        k.seed('lens'); k.line([[EDGE - 12, LY + LH + 6], [tickX(edgeCell) - 40, RY - 60]], .4, dim)
        k.seed('lens2'); k.line([[EDGE + 12, LY + LH + 6], [tickX(edgeCell) + 40, RY - 60]], .4, dim)
        k.push(); k.alpha(t)
        for (let c = 0; c <= cells; c++) {
          k.seed('t' + c); k.line([[tickX(c), RY - 30], [tickX(c), RY + 30]], c === edgeCell ? 1.1 : .5, c === edgeCell ? hi : dim)
        }
        k.seed('rule'); k.line([[tickX(0), RY], [tickX(cells), RY]], .6, ink)
        k.text(p.box, tickX(edgeCell), RY + 76, { role: 'mono', size: 28, min: 15, maxW: 360, lines: 1, align: 'center', col: hi })
        k.pop()
      }

      if (i === 1) {
        // a width that ends a third of the way into a cell, snapped up to the next tick
        const raw = tickX(3) + CELL * .35
        const snap = k.thumb ? 1 : k.ease(k.p(1, 1.0, 1.4))
        const endX = k.lerp(raw, tickX(4), snap)
        k.seed('w1'); k.line([[tickX(0), RY - 52], [endX, RY - 52]], 1.4, good)
        k.seed('w1h'); k.arrow([[raw, RY - 92], [tickX(4), RY - 92]], ink, .7, snap)
        k.text(p.snap, 760, RY + 160, { role: 'label', size: 32, min: 17, maxW: 1000, lines: 2, align: 'center', col: ink })
        k.point = [tickX(4), RY - 52]
        k.mood = 'thinking'
        return
      }

      if (i === 2) {
        // the worked example: a width one unit past a 240 px box, two endings
        const rowY = [RY - 60, RY - 160]
        const endX = tickX(edgeCell + 1)
        const tA = k.thumb ? 1 : k.ease(k.p(2, 1.0, .2))
        const tB = k.thumb ? 1 : k.ease(k.p(2, 1.0, 1.6))
        // the slack cell exists only for a line that ends before a space
        k.hl(tickX(edgeCell), RY - 30, CELL, 60, good, tA)
        k.seed('ex1'); k.line([[tickX(0), rowY[0]], [k.lerp(tickX(0), endX, tA), rowY[0]]], 1.4, good)
        k.text(p.space + ': ' + p.yes, tickX(0), rowY[0] - 22, { role: 'label', size: 28, min: 15, maxW: 700, lines: 1, col: ink, alpha: tA })
        k.push(); k.alpha(tB)
        k.seed('ex2'); k.line([[tickX(0), rowY[1]], [k.lerp(tickX(0), endX, tB), rowY[1]]], 1.4, hi)
        k.pop()
        k.text(p.hyphen + ': ' + p.no, tickX(0), rowY[1] - 22, { role: 'label', size: 28, min: 15, maxW: 700, lines: 1, col: hi, alpha: tB })
        k.text(p.width, endX + 24, rowY[0] + 10, { role: 'mono', size: 26, min: 14, maxW: 420, lines: 1, col: ink, alpha: tA })
        k.point = [endX, rowY[0]]
        k.mood = tB > .5 ? 'surprised' : 'happy'
        return
      }

      // step 3: re-shaped alone, the line grows past the edge; the last word steps back
      const j = m - 1
      const grow = k.thumb ? 1 : k.ease(k.p(3, .9, .2))
      const hop = k.thumb ? 1 : k.ease(k.p(3, 1.2, 1.3))
      const lineEnd = ends[j] + 26 * grow
      k.seed('re'); k.line([[X0, LY + LH + 18], [lineEnd, LY + LH + 18]], 1.2, hop > 0 ? light : hi)
      if (lineEnd > EDGE && hop < .05) k.text(p.tooWide, EDGE - 12, LY - 32, { role: 'label', size: 28, min: 15, maxW: 400, lines: 1, align: 'right', col: hi })
      const from = [starts[j], LY]
      const to = [X0, LY + LH + 50]
      const pos = k.arc(from, to, 120, hop)
      wordBox(j, pos[0], pos[1], 1, hop > .95 ? a : hi)
      for (let q = m; q < Math.min(ws.length, m + 2); q++) {
        const off = ws[j] + GAP
        if (starts[q] - starts[m] + X0 + off + ws[q] < EDGE) wordBox(q, X0 + off + (starts[q] - starts[m]), LY + LH + 50, hop, a)
      }
      k.text(p.reshape, 760, LY + LH * 2 + 150, { role: 'label', size: 32, min: 17, maxW: 1100, lines: 2, align: 'center', col: ink, alpha: hop })
      k.point = pos
      k.mood = hop > .5 ? 'proud' : 'thinking'
    },
  }
})())
