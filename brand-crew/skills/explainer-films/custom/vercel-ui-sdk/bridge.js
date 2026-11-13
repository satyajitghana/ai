// vercel-ui-sdk / bridge
//
// The article's ActSimulator, animated: the project-settings screen from the
// launch video, driven two ways. Left, a browser-tools agent's loop as a grid
// of small calls (look, click, read again), filling one by one. Right, the
// same four settings driven by the UI SDK bridge: snapshot gives each control
// a ref, one act call carries four steps, each control changes through its
// own API, and act hands back every value so nothing is read twice.
// The grid's size is a toy, not the benchmark: the runtime stamps the scene
// Illustrative. Every string drawn is a storyboard string; positions are
// geometry.
//
// steps: 0 snapshot: the card and its refs · 1 the browser loop fills ·
//        2 one act call, four rows change in turn · 3 act returns the values
// params: { left, right, calls[3], rows[4], refs[4], from[4], to[4], act, values, status[4] }
BESPOKE.define((() => {
  const LX = 130, LW = 470
  const CX = 690, CW = 660
  const COLS = 4, NCALL = 12, CHW = 104, CHH = 54, CHG = 18
  const RH = 86, RG = 14

  function layout(k) {
    const top = Math.max(k.top + 40, 250)
    return { top, gridY: top + 70, cardY: top + 70 }
  }

  function rowY(L, r) { return L.cardY + 24 + r * (RH + RG) }

  return {
    stampAt: k => [LX + 10, Math.max(k.top + 40, 250) + 640],
    plan: () => ({
      min: [3.6, 4.4, 5.2, 3.8],
      events: [
        { step: 0, at: .3, type: 'draw' },
        { step: 1, at: .2, type: 'ticks', n: 12, span: 3.0 },
        { step: 2, at: .4, type: 'pop' },
        { step: 3, at: .4, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 3.4 }, { step: 2, from: 0, to: 4.4 }, { step: 3, from: 0, to: 1.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const L = layout(k)
      const rows = p.rows || [], refs = p.refs || [], from = p.from || [], to = p.to || []

      // headers
      k.text(p.left || '', LX, L.top, { role: 'label', size: 28, maxW: LW, col: k.dim })
      k.text(p.right || '', CX, L.top, { role: 'label', size: 28, maxW: CW, col: k.dim })

      // left: the browser-tools loop, one chip per call
      const shownCalls = k.thumb ? NCALL : i < 1 ? 0 : i === 1 ? Math.floor(k.p(1, 3.2, .2) * NCALL + .001) : NCALL
      for (let j = 0; j < NCALL; j++) {
        const c = j % COLS, r = Math.floor(j / COLS)
        const x = LX + c * (CHW + CHG), y = L.gridY + r * (CHH + CHG)
        k.seed('slot' + j); k.line(k.rrect(x, y, CHW, CHH, 10), .45, k.dim, { closed: true, dash: [8, 7] })
        if (j < shownCalls) {
          const a = i === 1 && !k.thumb ? k.easeOut(k.clamp((k.p(1, 3.2, .2) * NCALL - j) * 2, 0, 1)) : 1
          k.push(); k.alpha(i >= 2 ? .45 * a : a)
          k.seed('call' + j); k.shape(k.rrect(x, y, CHW, CHH, 10), { fill: k.tone('light'), op: .85, sw: .7 })
          const name = (p.calls || [])[j % 3] || ''
          k.text(name, x + CHW / 2, y + CHH / 2 + 8, { role: 'mono', size: 18, min: 11, maxW: CHW - 12, align: 'center' })
          k.pop()
        }
      }

      // right: the settings card
      const cardH = 24 + rows.length * (RH + RG) + 10
      k.seed('card'); k.shape(k.rrect(CX, L.cardY, CW, cardH, 20), { fill: k.paper, op: .6, sw: .9 })
      const refIn = k.thumb ? 1 : i === 0 ? k.easeOut(k.p(0, 1.4, .6)) : 1
      const actT = k.thumb ? 1 : i < 2 ? 0 : i === 2 ? k.p(2, 3.6, .4) : 1
      rows.forEach((label, r) => {
        const y = rowY(L, r)
        const changing = i === 2 && !k.thumb && actT > r / 4 && actT < (r + 1) / 4
        const done = actT >= (r + .5) / 4
        if (changing) k.hl(CX + 18, y + 6, CW - 36, RH - 12, k.P.hi, k.clamp((actT - r / 4) * 8, 0, 1))
        k.seed('row' + r); k.line([[CX + 24, y + RH], [CX + CW - 24, y + RH]], .4, k.dim)
        // the ref snapshot gives it
        const rk = k.clamp(refIn * 4 - r, 0, 1)
        if (rk > 0) {
          k.push(); k.alpha(rk)
          k.seed('ref' + r); k.shape(k.rrect(CX + 26, y + 26, 54, 36, 8), { fill: k.P.a, op: .85, sw: .6 })
          k.text(refs[r] || '', CX + 53, y + 52, { role: 'mono', size: 20, maxW: 46, align: 'center', col: k.textOn(k.P.a) })
          k.pop()
        }
        k.text(label, CX + 98, y + 54, { role: 'body', size: 28, min: 18, maxW: 300 })
        const val = done ? (to[r] || '') : (from[r] || '')
        k.text(val, CX + CW - 34, y + 54, { role: 'mono', size: 26, min: 16, maxW: 220, align: 'right', col: done ? k.P.a : k.ink })
      })

      // the one act call, above the card's right edge
      if (i >= 2 && p.act) {
        const ak = k.thumb ? 1 : i === 2 ? k.easeOut(k.p(2, .5)) : 1
        k.push(); k.alpha(ak)
        const m = k.measure(p.act, { role: 'mono', size: 22 })
        const w = Math.min(CW - 40, m.w + 36)
        k.seed('act'); k.shape(k.rrect(CX + CW - w, L.top + 22, w, 40, 10), { fill: k.P.b, op: .85, sw: .6 })
        k.text(p.act, CX + CW - w / 2, L.top + 49, { role: 'mono', size: 22, min: 14, maxW: w - 20, align: 'center', col: k.textOn(k.P.b) })
        k.pop()
      }

      // what act returns
      const boxY = L.cardY + cardH + 26
      if (i >= 3 && p.values) {
        const vk = k.thumb ? 1 : k.easeOut(k.p(3, .6, .2))
        k.push(); k.alpha(vk)
        k.seed('values'); k.shape(k.rrect(CX, boxY, CW, 70, 14), { fill: k.tone('light'), op: .9, sw: .8 })
        k.text(p.values, CX + CW / 2, boxY + 46, { role: 'body', size: 28, min: 16, maxW: CW - 40, align: 'center' })
        k.pop()
      }

      // the status line under the left grid
      const gridBottom = L.gridY + 3 * (CHH + CHG)
      const status = (p.status || [])[i] || ''
      if (status) {
        const sk = k.thumb ? 1 : k.easeOut(k.p(i, .5, .4))
        k.push(); k.alpha(sk)
        k.text(status, LX, gridBottom + 40, { role: 'body', size: 28, min: 18, maxW: LW, lines: 4 })
        k.pop()
      }

      // where the host points
      const pr = i === 2 ? Math.min(3, Math.floor(actT * 4)) : 0
      k.point = i === 0 ? [CX + 53, rowY(L, 0) + 44]
        : i === 1 ? [LX + LW - 40, L.gridY + 80]
          : i === 2 ? [CX + CW - 120, rowY(L, pr) + 44]
            : [CX + CW - 80, boxY + 35]
      k.mood = i === 1 ? 'thinking' : i === 3 ? 'happy' : 'neutral'
    },
  }
})())
