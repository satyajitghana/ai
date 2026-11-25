// claude-artifact-apps-and-webmcp / loop
//
// The cookbook's WebMCP loop as a moving picture, the article's CartToolsLab without the log.
// Two boxes: the server (the model and the key) on the left, the browser tab (the page and its
// tools) on the right, a small cart drawn inside the tab. Four beats:
//   0  list: the page's tool cards fly from the tab to the server with the request
//   1  call: the model sends one tool call back across
//   2  run: the page runs it; two mugs drop into the cart
//   3  return: the result travels back and the loop starts again (a ring around both)
// Geometry only; every string comes from params. No data, so the runtime stamps it Illustrative.
//
// params: { heads: [4 strings], server, tab, tools: [n strings], call, result, cart }
BESPOKE.define((() => {
  const SX = 140, SY0 = 0, SW = 420, SH = 470
  const TX = 880, TW = 480
  return {
    stampAt: k => [1230, k.top + 24],
    plan: () => ({
      min: [4.6, 4.0, 4.4, 4.6],
      events: [{ step: 0, at: .5, type: 'whoosh' }, { step: 1, at: .4, type: 'whoosh' },
        { step: 2, at: 1.0, type: 'pop' }, { step: 2, at: 1.4, type: 'pop' }, { step: 3, at: .6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const Y = Math.max(k.top + 90, 250) + SY0
      const head = (p.heads || [])[st]
      if (head) k.text(head, SX, Y - 40, { role: 'head', size: 32, min: 14, maxW: TX + TW - SX, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // the two boxes
      k.seed('server'); k.shape(k.rrect(SX, Y, SW, SH, 18), { fill: k.P.light, op: .5, sw: 1.6, ink: k.ink })
      k.seed('tab'); k.shape(k.rrect(TX, Y, TW, SH, 18), { fill: k.P.light, op: .5, sw: 1.6, ink: k.ink })
      if (p.server) k.text(p.server, SX + 24, Y + 44, { role: 'head', size: 28, min: 14, maxW: SW - 48, lines: 1 })
      if (p.tab) k.text(p.tab, TX + 24, Y + 44, { role: 'head', size: 28, min: 14, maxW: TW - 48, lines: 1 })

      // the model: a circle in the server box
      const MX = SX + SW / 2, MY = Y + 380
      k.seed('model'); k.shape(k.circle(MX, MY, 60, 40), { fill: k.P.a, op: .75, sw: 1.4, ink: k.ink })

      // tool cards in the tab, and their copies carried to the server in step 0
      const tools = p.tools || []
      const cardW = 190, cardH = 44
      tools.forEach((name, i) => {
        const cx = TX + 24, cy = Y + 80 + i * (cardH + 10)
        k.seed('tool' + i); k.shape(k.rrect(cx, cy, cardW, cardH, 8), { fill: k.P.b, op: .6, sw: 1, ink: k.ink })
        k.text(name, cx + 12, cy + 30, { role: 'mono', size: 19, min: 10, maxW: cardW - 24, lines: 1 })
        const travelled = k.thumb ? 1 : st > 0 ? 1 : k.ease(k.clamp((k.since(0) - .5 - i * .18) / 1.1, 0, 1))
        if (travelled > 0) {
          const dst = [SX + 24, Y + 80 + i * (cardH + 10)]
          const pos = travelled >= 1 ? dst : k.arc([cx, cy], dst, 90, travelled)
          if (travelled >= 1) { k.seed('copy' + i); k.shape(k.rrect(pos[0], pos[1], cardW * .8, cardH * .8, 8), { fill: k.P.b, op: .35, sw: .8, ink: k.dim }) }
          else k.flat(k.rrect(pos[0], pos[1], cardW * .8, cardH * .8, 8), k.P.b, .6)
        }
      })

      // the cart in the tab: three rows, two mugs drop in on step 2
      const CX = TX + 250, CY = Y + 110
      if (p.cart) k.text(p.cart, CX, CY - 12, { role: 'mono', size: 20, min: 10, maxW: 200, lines: 1, col: k.dim })
      k.seed('cart'); k.line(k.rrect(CX, CY, 200, 170, 10), 1.4, k.ink, { closed: true })
      const mugs = k.thumb || st > 2 ? 2 : st === 2 ? (k.since(2) > 1.4 ? 2 : k.since(2) > 1.0 ? 1 : 0) : 0
      for (let m = 0; m < 2; m++) {
        const show = m < mugs
        if (!show) continue
        const fall = k.thumb || st > 2 ? 1 : k.easeOut(k.clamp((k.since(2) - 1.0 - m * .4) / .4, 0, 1))
        const mx = CX + 40 + m * 70, my = k.lerp(CY - 60, CY + 70, fall)
        k.flat(k.rrect(mx, my, 44, 52, 6), k.P.hi, .9)
        k.seed('handle' + m); k.line(k.circle(mx + 50, my + 26, 14, 14), 4, k.P.hi, { closed: true })
      }

      // the tool call, server to tab, step 1 onward
      const callT = k.thumb ? 1 : st > 1 ? 1 : st === 1 ? k.ease(k.clamp((k.since(1) - .4) / 1.2, 0, 1)) : 0
      const A = [MX + 60, MY], B = [CX, CY + 85]
      if (callT > 0) {
        k.seed('callpath'); k.arrow(k.partial(k.through([A, [(A[0] + B[0]) / 2, MY - 120], B]), callT), k.P.hi, 3, 1)
        if (p.call && callT > .3) k.text(p.call, SX + SW + 20, MY - 170, { role: 'mono', size: 22, min: 11, maxW: TX - SX - SW - 40, lines: 1, col: k.P.hi })
      }
      // the result, tab to server, step 3
      if (st === 3 || k.thumb) {
        const rT = k.thumb ? 1 : k.ease(k.clamp((k.since(3) - .3) / 1.2, 0, 1))
        const R0 = [CX, CY + 150], R1 = [MX + 50, MY + 30]
        k.seed('retpath'); k.arrow(k.partial(k.through([R0, [(R0[0] + R1[0]) / 2, MY + 110], R1]), rT), k.P.b, 3, 1)
        if (p.result && rT > .3) k.text(p.result, SX + SW + 20, MY + 150, { role: 'mono', size: 22, min: 11, maxW: TX - SX - SW - 40, lines: 1, col: k.P.b })
      }

      k.point = st === 0 ? [TX + 120, Y + 120] : st === 1 ? [MX, MY] : st === 2 ? [CX + 100, CY + 80] : [MX + 50, MY + 30]
      k.mood = st === 2 ? 'happy' : st === 3 ? 'proud' : st === 1 ? 'thinking' : 'neutral'
    },
  }
})())
