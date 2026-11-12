// mutiny-bim / ledger
//
// The article's race finding, animated. A wall record on the left, its four
// fields (start, end, thickness, values) and beside each one the commit
// server's authored ledger: whether a command that writes the field records
// it. On the right, the commit server with two edits sent on the same base.
// Step 0: the record and its ledger. Step 1: two moves race; start and end are
// recorded, so the second is refused by name. Step 2: Priya sets the
// thickness to 300; the ledger cell stays empty. Step 3: Avery's 250 arrives,
// there is nothing to compare, both commit and the later one wins; the values
// row lights too, since set_element_values has the same empty list.
// Every string drawn comes from the storyboard; the numbers (230, 300, 250)
// are the article's, so params say data: article and nothing is stamped.
//
// params: { recordHead, ledgerHead, fields[4], marks[2], server, serverSub,
//           moves[2], thick[3], thickEdits[2], outcomes[2], valuesNote }
BESPOKE.define((() => {
  const CX = 130, CW = 600, ROW0 = 150, RH = 112
  const SX = 820, SW = 520

  return {
    plan: () => ({
      min: [3.4, 4.2, 3.6, 4.4],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .4, type: 'flow' }, { step: 1, at: 1.7, type: 'thunk' }, { step: 2, at: .35, type: 'pop' }, { step: 3, at: .4, type: 'flow' }, { step: 3, at: 1.6, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 2.2 }, { step: 3, from: 0, to: 2.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, top = k.top
      const fields = p.fields || []
      const marks = p.marks || ['', '']
      const thick = p.thick || ['', '', '']
      const y0 = top + ROW0

      // the record card
      const ck = k.thumb ? 1 : k.easeOut(k.p(0, .7, .1))
      k.push(); k.alpha(ck)
      k.seed('card'); k.shape(k.rrect(CX, top + 20, CW, ROW0 + RH * 4 - 10, 18), { fill: k.paper, op: 1, sw: 1.1 })
      k.text(p.recordHead || '', CX + 30, top + 80, { role: 'head', size: 34, maxW: 300 })
      k.text(p.ledgerHead || '', CX + CW - 30, top + 80, { role: 'mono', size: 22, maxW: 230, align: 'right', col: k.dim })
      k.pop()

      // which rows are lit, and what each ledger cell says
      const movedLit = i === 1
      const thickLit = i >= 2
      const valuesLit = i >= 3
      const thickVal = i < 2 ? thick[0] : i === 2 ? thick[1] : thick[2]
      fields.forEach((f, r) => {
        const y = y0 + r * RH
        const rk = k.thumb ? 1 : k.easeOut(k.p(0, .5, .3 + r * .18))
        if (rk <= 0) return
        const lit = (r < 2 && movedLit) || (r === 2 && thickLit) || (r === 3 && valuesLit)
        k.push(); k.alpha(rk)
        if (lit) k.hl(CX + 16, y - 34, CW - 32, 64, r < 2 ? k.P.a : k.P.hi, k.thumb ? 1 : k.easeOut(k.p(i, .5, .2)))
        k.text(f, CX + 34, y + 10, { role: 'mono', size: 30, maxW: 200 })
        if (r === 2) k.text(thickVal, CX + 270, y + 10, { role: 'body', size: 32, maxW: 120 })
        // the ledger cell: recorded for start and end, empty for thickness and values
        const recorded = r < 2
        const lx = CX + CW - 200, lw = 170
        k.seed('cell' + r); k.shape(k.rrect(lx, y - 30, lw, 56, 12), { fill: recorded ? k.tone('light') : k.paper, op: recorded ? .9 : .6, sw: .8 })
        k.text(recorded ? marks[0] : marks[1], lx + lw / 2, y + 8, { role: 'label', size: 22, maxW: lw - 20, align: 'center', col: recorded ? k.ink : k.dim })
        k.pop()
      })

      // the commit server
      const sk = k.thumb ? 1 : (i >= 1 ? k.easeOut(k.p(1, .6)) : 0)
      if (sk > 0) {
        const sy = top + 20, sh = 470
        k.push(); k.alpha(sk)
        k.seed('server'); k.shape(k.rrect(SX, sy, SW, sh, 18), { fill: k.paper, op: 1, sw: 1.1 })
        k.text(p.server || '', SX + SW / 2, sy + 62, { role: 'head', size: 36, maxW: SW - 40, align: 'center' })
        k.text(p.serverSub || '', SX + SW / 2, sy + 108, { role: 'mono', size: 22, maxW: SW - 40, align: 'center', col: k.dim })
        // the two edits, sent on the same base
        const edits = i >= 2 ? (p.thickEdits || ['', '']) : (p.moves || ['', ''])
        const step = i >= 2 ? (i === 2 ? 2 : 3) : 1
        edits.forEach((e, j) => {
          if (i === 2 && j === 1) return
          const ek = k.thumb ? 1 : k.backOut(k.p(step, .5, .2 + j * .45))
          if (ek <= 0) return
          const ex = SX + 30, ey = sy + 150 + j * 90, ew = SW - 60
          k.push(); k.alpha(Math.min(1, ek))
          k.seed('edit' + step + j); k.shape(k.rrect(ex, ey, ew, 66, 14), { fill: j === 0 ? k.tone('a') : k.tone('b'), op: .85, sw: .9 })
          k.text(e, ex + ew / 2, ey + 43, { role: 'body', size: 28, maxW: ew - 30, align: 'center', col: k.textOn(j === 0 ? k.tone('a') : k.tone('b')) })
          k.pop()
        })
        // the outcome
        if (i === 1 || i === 3) {
          const ok = i === 3
          const ok2 = k.thumb ? 1 : k.easeOut(k.p(i, .5, 1.3))
          if (ok2 > 0) {
            const col = ok ? k.P.hi : k.P.a
            k.push(); k.alpha(ok2)
            k.seed('out' + i); k.shape(k.rrect(SX + 30, sy + sh - 120, SW - 60, 92, 14), { fill: col, op: .92, sw: 1 })
            k.text((p.outcomes || [])[ok ? 1 : 0] || '', SX + SW / 2, sy + sh - 64, { role: 'head', size: 30, min: 20, maxW: SW - 100, align: 'center', col: k.textOn(col) })
            k.pop()
          }
        }
        k.pop()
        // a link from the field being compared to the server
        const fk = k.thumb ? 1 : k.easeOut(k.p(i, .8, .6))
        if (i >= 1 && fk > 0) {
          const ry = y0 + (i === 1 ? 0 : 2) * RH
          k.seed('link' + i); k.arrow([[CX + CW + 10, ry], [SX - 14, top + 260]], k.ink, 1, fk)
        }
      }

      // the same gap on values
      if (i >= 3 && p.valuesNote) {
        const nk = k.thumb ? 1 : k.easeOut(k.p(3, .6, 2.0))
        if (nk > 0) {
          k.push(); k.alpha(nk)
          k.text(p.valuesNote, CX + 30, y0 + RH * 4 + 40, { role: 'body', size: 30, maxW: 1180, col: k.ink })
          k.pop()
        }
      }

      k.point = i === 0 ? [CX + CW - 120, y0] : i === 1 ? [SX + SW / 2, top + 400] : i === 2 ? [CX + 300, y0 + 2 * RH] : [SX + SW / 2, top + 420]
      k.mood = i === 1 ? 'proud' : i === 3 ? 'surprised' : 'thinking'
    },
  }
})())
