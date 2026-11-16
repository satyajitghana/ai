// floor-plan-to-3d-roundup / extrude
//
// The article's PlanExtruder widget as a moving drawing. A two-room plan
// (900 by 600 cm on the wall axes, 25 cm exterior walls, a 12 cm partition)
// draws on in plan view: a door in the south wall, a door in the partition,
// a wide window in the north wall. Then the drawing tips into isometric and
// the walls rise to a height the plan never gave (the default). Then the
// openings are cut as hosted holes, a sill and a lintel over the window.
// Then the same plan goes through the raster tracer's rule (trace.rs): the
// two door gaps, under max_gap, fill in as solid wall (bridged, in the
// highlight colour), and the wide window gap stays as a hole from floor to
// top. Geometry is fixed here; every string drawn is a storyboard string.
//
// steps: 0 the plan · 1 extrude to the default height · 2 openings as elements ·
//        3 traced: doors bridged · 4 traced: the wide window is a void
// params: { legend: [5 strings], tags: { height, bridged, void } }
BESPOKE.define((() => {
  const W = 900, D = 600, TE = 25, TP = 12, H = 250, PX = 420
  const C30 = 0.8660254, S30 = 0.5
  // walls: horizontal ones run the full width, vertical ones between them
  const WALLS = [
    { id: 'N', horiz: true, fixed: 0, from: -TE / 2, to: W + TE / 2, t: TE, open: { at: PX / 2, w: 200, kind: 'wide' } },
    { id: 'S', horiz: true, fixed: D, from: -TE / 2, to: W + TE / 2, t: TE, open: { at: PX + (W - PX) / 2, w: 90, kind: 'door' } },
    { id: 'W', horiz: false, fixed: 0, from: TE / 2, to: D - TE / 2, t: TE, open: null },
    { id: 'E', horiz: false, fixed: W, from: TE / 2, to: D - TE / 2, t: TE, open: null },
    { id: 'P', horiz: false, fixed: PX, from: TE / 2, to: D - TE / 2, t: TP, open: { at: 420, w: 80, kind: 'door' } },
  ]
  const box = (g, a, b, z0, z1, tone) => g.horiz
    ? { x0: a, x1: b, y0: g.fixed - g.t / 2, y1: g.fixed + g.t / 2, z0, z1, tone }
    : { x0: g.fixed - g.t / 2, x1: g.fixed + g.t / 2, y0: a, y1: b, z0, z1, tone }

  // the pieces in each mode: 'plain' (no openings), 'cut' (elements), 'traced'
  function pieces(mode) {
    const out = []
    for (const g of WALLS) {
      const o = g.open
      if (!o || mode === 'plain') { out.push(box(g, g.from, g.to, 0, H, 'wall')); continue }
      const a = o.at - o.w / 2, b = o.at + o.w / 2
      out.push(box(g, g.from, a, 0, H, 'wall'), box(g, b, g.to, 0, H, 'wall'))
      if (mode === 'foot') continue
      if (mode === 'cut') {
        if (o.kind !== 'door') out.push(box(g, a, b, 0, 90, 'wall'))
        out.push(box(g, a, b, 210, H, 'wall'))
      } else if (o.w <= 130) out.push(box(g, a, b, 0, H, 'bridge'))
      else out.push({ ...box(g, a, b, 0, H, 'void'), ghost: true })
    }
    return order(out)
  }
  function before(a, b) {
    const e = .01
    if (a.x1 <= b.x0 + e) return true
    if (b.x1 <= a.x0 + e) return false
    if (a.y1 <= b.y0 + e) return true
    if (b.y1 <= a.y0 + e) return false
    return a.z1 <= b.z0 + e
  }
  function order(list) {
    const n = list.length, indeg = new Array(n).fill(0), out = list.map(() => [])
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
      if (i !== j && before(list[i], list[j]) && !before(list[j], list[i])) { out[i].push(j); indeg[j]++ }
    const res = [], done = new Array(n).fill(false)
    for (let c = 0; c < n; c++) {
      let p = -1
      for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) { p = i; break }
      if (p < 0) for (let i = 0; i < n; i++) if (!done[i]) { p = i; break }
      done[p] = true; res.push(list[p]); for (const j of out[p]) indeg[j]--
    }
    return res
  }
  const FOOT = pieces('foot'), CUT = pieces('cut'), TRACED = pieces('traced')

  return {
    plan: () => ({
      min: [4.6, 4.4, 4.4, 4.4, 4.4],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 14, span: 1.8 },
        { step: 1, at: .4, type: 'slide' },
        { step: 2, at: .3, type: 'pop' },
        { step: 3, at: .4, type: 'pop' },
        { step: 4, at: .4, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 2.2 }, { step: 1, from: 0, to: 2.2 }, { step: 3, from: .2, to: 1.4 }],
    }),
    stampAt: k => [300, k.top + 10],
    draw(k) {
      const p = k.params, i = k.step
      const legend = p.legend || []
      const tags = p.tags || {}
      const top = k.top

      // plan view to isometric: t = 0 is the plan seen from above, 1 is isometric
      const tip = k.thumb ? 1 : i === 0 ? 0 : i === 1 ? k.ease(k.p(1, 1.4, .1)) : 1
      const rise = k.thumb ? 1 : i === 0 ? 0 : i === 1 ? k.easeOut(k.p(1, 1.6, .7)) : 1
      const PS = .82, PX0 = 160, PY0 = top + 90               // plan: px per cm and origin
      const IS = .6, IX0 = 520, IY0 = top + 250               // isometric: px per cm and origin
      const P = (x, y, z) => {
        const ax = PX0 + x * PS, ay = PY0 + y * PS
        const bx = IX0 + (x - y) * C30 * IS, by = IY0 + (x + y) * S30 * IS - z * IS * rise
        return [k.lerp(ax, bx, tip), k.lerp(ay, by, tip)]
      }

      const list = i <= 1 ? FOOT : i === 2 ? CUT : TRACED
      const wallTop = k.mix(k.paper, k.tone('light'), .35)
      const faceX = k.mix(k.paper, k.P.a, .32), faceY = k.mix(k.paper, k.P.a, .55)
      const brTop = k.mix(k.paper, k.P.hi, .45), brX = k.mix(k.paper, k.P.hi, .65), brY = k.mix(k.paper, k.P.hi, .85)
      const bridgeA = k.thumb ? 1 : i === 3 ? k.ease(k.p(3, .9, .3)) : i > 3 ? 1 : 0
      const voidA = k.thumb ? 1 : i === 4 ? k.ease(k.p(4, .8, .3)) : 0

      // the plan draws on during step 0
      const draw = k.thumb || i > 0 ? 1 : k.ease(k.p(0, 2.0, .1))
      k.push(); k.alpha(draw)
      k.flat([P(-TE / 2, -TE / 2, 0), P(W + TE / 2, -TE / 2, 0), P(W + TE / 2, D + TE / 2, 0), P(-TE / 2, D + TE / 2, 0)], k.mix(k.paper, k.tone('light'), .12), 1)
      list.forEach((b, n) => {
        if (b.ghost) return
        const br = b.tone === 'bridge'
        k.push(); if (br) k.alpha(bridgeA)
        const fx = [P(b.x1, b.y0, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x1, b.y0, b.z1)]
        const fy = [P(b.x0, b.y1, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)]
        const ft = [P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)]
        if (rise > .02) { k.flat(fx, br ? brX : faceX, 1); k.flat(fy, br ? brY : faceY, 1) }
        k.flat(ft, br ? brTop : (rise > .02 ? wallTop : k.ink), 1)
        k.seed('edge' + i + '-' + n)
        k.line(ft, .7, k.ink, { closed: true })
        if (rise > .02) { k.line(fx, .6, k.ink, { closed: true }); k.line(fy, .6, k.ink, { closed: true }) }
        k.pop()
      })
      k.pop()

      // door swings in plan view
      if (tip < .5) {
        k.push(); k.alpha(draw * (1 - tip * 2))
        const sw = (cx, cy, r, a0) => { const pts = []; for (let s = 0; s <= 12; s++) { const a = a0 + (Math.PI / 2) * s / 12; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return pts }
        const sd = WALLS[1].open, pd = WALLS[4].open
        k.seed('swingS'); k.line(sw(PX0 + (sd.at - 45) * PS, PY0 + D * PS, 90 * PS, -Math.PI / 2), 1.1, k.ink)
        k.seed('swingP'); k.line(sw(PX0 + PX * PS, PY0 + (pd.at - 40) * PS, 80 * PS, 0), 1.1, k.ink)
        const nw = WALLS[0].open
        k.seed('glass'); k.line([[PX0 + (nw.at - 100) * PS, PY0 - 6], [PX0 + (nw.at + 100) * PS, PY0 - 6]], 1, k.ink); k.line([[PX0 + (nw.at - 100) * PS, PY0 + 6], [PX0 + (nw.at + 100) * PS, PY0 + 6]], 1, k.ink)
        k.pop()
      }

      // the void: an outline where the wide window was
      if (voidA > 0) {
        const v = list.find(b => b.ghost)
        const fy = [P(v.x0, v.y1, 0), P(v.x1, v.y1, 0), P(v.x1, v.y1, H), P(v.x0, v.y1, H)]
        k.push(); k.alpha(voidA)
        k.seed('void'); k.line(fy, 1.6, k.P.b, { closed: true })
        if (tags.void) { const c = P(v.x0 + 100, 0, H + 40); k.text(tags.void, c[0], c[1] - 90, { role: 'label', size: 28, min: 14, maxW: 360, lines: 1, align: 'center', col: k.P.b }) }
        k.pop()
      }
      // the height tag on the east wall
      if (i >= 1 && tags.height) {
        const a = k.thumb ? 1 : i === 1 ? k.p(1, .6, 1.6) : 1
        const q0 = P(W + TE, D + TE, 0), q1 = P(W + TE, D + TE, H)
        k.push(); k.alpha(a)
        k.seed('hdim'); k.line([[q0[0] + 26, q0[1]], [q1[0] + 26, q1[1]]], .9, k.P.hi)
        { const o = { role: 'mono', size: 26, min: 14, maxW: 200, lines: 2, col: k.P.hi }; const m = k.measure(tags.height, o); k.text(tags.height, q1[0] + 44 + m.w / 2, (q0[1] + q1[1]) / 2, { ...o, align: 'center' }) }
        k.pop()
      }
      if (i >= 3 && tags.bridged) {
        const g = WALLS[1], o = g.open, c = P(o.at, g.fixed + 60, 0)
        k.push(); k.alpha(bridgeA)
        k.text(tags.bridged, c[0], c[1] + 40, { role: 'label', size: 28, min: 14, maxW: 340, lines: 1, align: 'center', col: k.mix(k.ink, k.P.hi, .5) })
        k.pop()
      }

      // the legend, one line per step, the current one in ink
      // the legend: the current step's line only, sized to fit every style
      const cur = legend[Math.min(i, legend.length - 1)]
      if (cur) {
        const a = k.thumb ? 1 : k.p(i, .6, .1)
        k.push(); k.alpha(a)
        k.text(cur, 1210, top + 150, { role: 'head', size: 38, min: 16, maxW: 330, lines: 5, col: k.ink, align: 'center' })
        k.pop()
      }

      k.point = i === 0 ? [PX0 + 450 * PS, PY0 + 300 * PS] : i === 3 ? P(WALLS[1].open.at, D, 120) : i === 4 ? P(100, 0, 150) : P(W, D, 200)
      k.mood = i === 3 ? 'surprised' : i === 4 ? 'thinking' : i === 1 ? 'proud' : 'neutral'
    },
  }
})())
