// dwg-redraw-skill / ledger
//
// The article's ProvenanceLedger widget as a moving drawing. A small plan (a
// 6,000 by 4,200 mm room, an interior wall, a door, a window, a column) is
// redrawn line by line, then each dimension gets its evidence level in the
// four colours of a ballpoint pen: known in blue, scaled in green, inferred
// in black, unreadable in red. Then the anchor slips four pixels: the scaled
// wall position switches from 3,600 to 3,584 and the chain check
// (3,584 + 2,400 = 5,984, not 6,000) fails. Last, what draw_image_spec.py
// writes: the colours drain to plain ink, because the script never reads the
// tag. Geometry is fixed here; every string is a storyboard string.
//
// steps: 0 the redraw · 1 known · 2 scaled, with the anchor · 3 inferred and unreadable · 4 the slip · 5 as drawn
// params: { overall, bay, wall, wallSlip, depth, door, window, anchor, slip, chain, drawn, legend[4] }
BESPOKE.define((() => {
  const S = .108                       // px per mm on screen
  const X0 = 250, PW = 6000 * S, PH = 4200 * S
  const WALL = 3600, D0 = 1500, D1 = 2400

  return {
    plan: () => ({
      min: [4.2, 3.6, 4.2, 4.0, 4.6, 4.0],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 18, span: 1.6 },
        { step: 1, at: .3, type: 'pop' }, { step: 2, at: .3, type: 'pop' }, { step: 3, at: .3, type: 'pop' },
        { step: 4, at: .6, type: 'ding' }, { step: 5, at: .3, type: 'pop' },
      ],
      motion: [{ step: 0, from: 0, to: 2.4 }, { step: 4, from: .2, to: 1.8 }, { step: 5, from: 0, to: 1.4 }],
    }),
    stampAt: k => [1250, k.top - 10],
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = k.top + 90                    // top of the plan on screen
      const X = mm => X0 + mm * S
      const Y = mm => Y0 + PH - mm * S
      const lg = p.legend || []

      // colour by evidence level; at step 5 every colour drains to ink
      const drain = k.thumb ? 0 : k.ease(k.p(5, 1.2, .1))
      const col = c => (i >= 5 ? k.mix(c, k.ink, drain) : c)
      // the pen's four colours: blue, green, black, red; untagged values are pencil-dim
      const known = col(k.P.b), scaled = col(k.P.hi), infer = col(k.P.wash || '#2B2B2B'), unread = col(k.P.a)
      const tag = (step, c) => (k.thumb || i >= step ? c : k.dim)
      const tagT = step => (k.thumb ? 1 : i > step ? 1 : i < step ? 0 : k.ease(k.p(step, .7, .2)))

      // the slip: 16 mm is under two pixels here, so the wall stays put and its number changes
      const slip = k.thumb ? 1 : i >= 4 ? k.ease(k.p(4, 1.1, .3)) : 0
      const wallX = X(WALL)

      // 0: the walls draw on
      const draw = k.thumb || i > 0 ? 1 : k.ease(k.p(0, 2.2, .1))
      k.seed('outer'); k.line(k.partial([[X(0), Y(0)], [X(6000), Y(0)], [X(6000), Y(4200)], [X(0), Y(4200)], [X(0), Y(0)]], draw), 1.4, k.ink)
      k.seed('wall1'); k.line(k.partial([[wallX, Y(0)], [wallX, Y(D0)]], draw), 1.4, k.ink)
      k.seed('wall2'); k.line(k.partial([[wallX, Y(D1)], [wallX, Y(4200)]], draw), 1.4, k.ink)
      // door leaf and swing (inferred: black, dashed look by drawing it thinner)
      const dc = tag(3, infer)
      const swing = []
      for (let a = 0; a <= 16; a++) { const t = Math.PI / 2 + (Math.PI / 2) * a / 16; swing.push([wallX + 900 * S * Math.cos(t), Y(D0) - 900 * S * Math.sin(t)]) }
      k.seed('leaf'); k.line(k.partial([[wallX, Y(D0)], [wallX - 900 * S, Y(D0)]], draw), 1, dc)
      k.seed('swing'); k.line(k.partial(swing, draw), .8, dc)
      // window, on the top wall (unreadable: red)
      const wc = tag(3, unread)
      k.push(); k.alpha(draw)
      k.seed('window'); k.line(k.rect(X(1200), Y(4300), 1500 * S, 200 * S), 1.2, wc, { closed: true })
      // column
      k.seed('column'); k.line(k.circle(X(5200), Y(800), 200 * S, 24), 1.2, k.ink, { closed: true })
      k.pop()

      // dimensions, appearing as the walls finish
      const dimA = k.thumb || i > 0 ? 1 : k.ease(k.p(0, .8, 1.6))
      const dimH = (key, x0, x1, y, text, c, a) => {
        k.push(); k.alpha(a)
        k.seed(key); k.line([[x0, y], [x1, y]], .9, c)
        k.seed(key + 't'); k.line([[x0, y - 9], [x0, y + 9]], .9, c); k.line([[x1, y - 9], [x1, y + 9]], .9, c)
        k.text(text, (x0 + x1) / 2, y - 14, { role: 'mono', size: 26, min: 14, maxW: Math.max(120, x1 - x0), lines: 1, col: c, align: 'center' })
        k.pop()
      }
      dimH('overall', X(0), X(6000), Y(0) + 52, p.overall, tag(1, known), dimA)
      dimH('bay', wallX, X(6000), Y(4200) - 48, p.bay, tag(1, known), dimA)
      // the wall position: switches at the slip
      const wallText = i >= 4 && slip > .5 ? p.wallSlip : p.wall
      dimH('wallpos', X(0), wallX, Y(4200) - 48, wallText, tag(2, scaled), dimA)
      // depth, on the left, as a word
      k.push(); k.alpha(dimA)
      k.seed('depth'); k.line([[X(0) - 40, Y(0)], [X(0) - 40, Y(4200)]], .9, tag(2, scaled))
      k.text(p.depth, X(0) - 52, Y(2100), { role: 'mono', size: 24, min: 14, maxW: 120, lines: 1, col: tag(2, scaled), align: 'right' })
      k.pop()
      // door and window labels
      k.push(); k.alpha(dimA)
      k.text(p.door, wallX - 900 * S + 6, Y(D0) + 30, { role: 'mono', size: 22, min: 12, maxW: 160, lines: 1, col: dc })
      k.text(p.window, X(1200) + 4, Y(4100) + 30, { role: 'mono', size: 22, min: 12, maxW: 240, lines: 1, col: wc })
      k.pop()

      // 2: the anchor, a bracket under the overall dimension
      if (k.thumb || i >= 2) {
        const a = tagT(2)
        k.push(); k.alpha(i >= 5 ? 1 - drain : a)
        k.seed('anchor'); k.line([[X(0), Y(0) + 86], [X(6000), Y(0) + 86]], 1.6, k.P.hi)
        k.text(p.anchor, X(3000), Y(0) + 124, { role: 'label', size: 24, min: 12, maxW: 400, lines: 1, col: k.P.hi, align: 'center' })
        k.pop()
      }
      // 4: the slip marker and the failed chain
      if (k.thumb || i >= 4) {
        const a = i >= 5 ? 1 - drain : slip
        k.push(); k.alpha(a)
        k.arrow([[X(0) + 60, Y(0) + 150], [X(0) + 6, Y(0) + 92]], k.P.a, 1.2, slip)
        k.text(p.slip, X(0) + 70, Y(0) + 166, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: k.P.a })
        k.pop()
      }

      // the ledger, on the right
      const LX = 1000
      let ly = k.top + 70
      const rows = [
        { step: 1, c: known, txt: lg[0] },
        { step: 2, c: scaled, txt: lg[1] },
        { step: 3, c: infer, txt: lg[2] },
        { step: 3, c: unread, txt: lg[3] },
      ]
      const LO = { role: 'label', size: 28, min: 14, maxW: 340, lines: 2 }
      const rowY = []
      rows.forEach((r, j) => {
        rowY.push(ly)
        const hgt = r.txt ? k.measure(r.txt, LO).h : 40
        const a = tagT(r.step)
        if (a > 0 && r.txt) {
          k.push(); k.alpha(a)
          k.flat(k.rect(LX, ly - 18, 26, 26), r.c, 1)
          k.text(r.txt, LX + 42, ly + 4, { ...LO, col: k.ink })
          k.pop()
          if (i >= 5 && !k.thumb) { k.push(); k.alpha(drain); k.seed('strike' + j); k.line([[LX - 6, ly - 4], [LX + 380, ly - 4]], 1.2, k.P.a); k.pop() }
        }
        ly += Math.max(60, hgt + 22)
      })
      const CO = { role: 'mono', size: 26, min: 14, maxW: 380, lines: 2 }
      if (k.thumb || i >= 4) {
        const a = k.thumb ? 1 : slip
        k.push(); k.alpha(a)
        k.text(p.chain, LX, ly + 20, { ...CO, col: k.P.a })
        k.pop()
      }
      ly += k.measure(p.chain || '', CO).h + 50
      if (i >= 5 && !k.thumb && p.drawn) {
        k.push(); k.alpha(drain)
        k.text(p.drawn, LX, ly + 20, { role: 'head', size: 32, min: 16, maxW: 380, lines: 2 })
        k.pop()
      }

      k.point = i === 0 ? [X(3000), Y(2100)] : i === 4 ? [wallX, Y(4200) - 48] : [LX, rowY[Math.min(3, Math.max(0, i - 1))]]
      k.mood = i === 4 ? 'surprised' : i === 5 ? 'thinking' : 'neutral'
    },
  }
})())
