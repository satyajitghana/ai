// depth-pro-2-single-image-splats / stretch
//
// The article's FocalStretch widget, drawn. A room seen from above with the
// camera at the bottom: its back-projection from one photo. The network fixes
// how big things look (f / Z); the focal length turns that into depth. So
// changing the assumed focal length stretches the room along the camera's
// axis and leaves its width alone: the walls stay put sideways, the back wall
// moves, a round table becomes an ellipse, the corners stop being square.
// Geometry only (a toy room), so the runtime stamps it Illustrative; every
// label is a storyboard string.
//
// steps: 0 the true focal length · 1 assumed 30% too long · 2 30% too short · 3 back, width unchanged
// params: { legend[4], width, deep, shallow }
BESPOKE.define((() => {
  const K = [1, 1.3, 0.7, 1]

  // the room in metres: 6 wide, 7 deep, starting 1.5 m in front of the camera; a table and a pillar
  const ROOM = { w: 6, z0: 1.5, z1: 8.5 }
  const TABLE = { x: -1.1, z: 4.6, r: 0.75 }
  const PILLAR = { x: 1.6, z: 6.2, s: 0.5 }

  function frame(k) {
    const cx = 640, by = 945, s = 50 // px per metre
    return { cx, by, s }
  }

  return {
    stampAt: k => [1150, k.top + 6],
    plan: () => ({
      min: [4.2, 4.6, 4.6, 4.6],
      events: [{ step: 1, at: .3, type: 'whoosh' }, { step: 2, at: .3, type: 'whoosh' }, { step: 3, at: .4, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 2.2 }, { step: 3, from: 0, to: 2.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const f = frame(k)
      // the stretch, eased from the previous step's to this one's
      const from = i === 0 ? 1 : K[i - 1]
      const t = k.thumb ? 1 : k.ease(k.p(i, 1.6, .3))
      const kk = k.lerp(from, K[i], t)
      const P = (x, z) => [f.cx + x * f.s, f.by - z * kk * f.s]
      const T = (x, z) => [f.cx + x * f.s, f.by - z * f.s] // the true room, for the ghost

      // field of view wedge
      k.push(); k.alpha(.35); k.seed('fov')
      k.line([[f.cx - 4.6 * f.s, f.by - 11 * f.s], [f.cx, f.by], [f.cx + 4.6 * f.s, f.by - 11 * f.s]], .8, k.dim)
      k.pop()

      const room = (M, key, col, sw) => {
        const r = [M(-ROOM.w / 2, ROOM.z0), M(-ROOM.w / 2, ROOM.z1), M(ROOM.w / 2, ROOM.z1), M(ROOM.w / 2, ROOM.z0)]
        k.seed(key + 'room'); k.line(r, sw, col)
        const c = M(TABLE.x, TABLE.z), e = M(TABLE.x + TABLE.r, TABLE.z + TABLE.r)
        k.seed(key + 'table'); k.line(k.ellipse(c[0], c[1], Math.abs(e[0] - c[0]), Math.abs(e[1] - c[1]), 40), sw, col, { closed: true })
        const h = PILLAR.s / 2, a0 = M(PILLAR.x - h, PILLAR.z + h), a1 = M(PILLAR.x + h, PILLAR.z - h)
        k.seed(key + 'pillar'); k.line(k.rect(a0[0], a0[1], a1[0] - a0[0], a1[1] - a0[1]), sw, col, { closed: true })
      }
      // ghost of the true room once it differs
      if (Math.abs(kk - 1) > .01) { k.push(); k.alpha(.35); room(T, 'g', k.dim, 1.2); k.pop() }
      room(P, 'r', i === 0 || i === 3 ? k.ink : k.P.hi, 2.2)

      // camera
      k.seed('cam'); k.shape([[f.cx, f.by - 22], [f.cx - 20, f.by + 14], [f.cx + 20, f.by + 14]], { fill: k.ink, op: 1 })

      // width: a dimension line along the front of the room, never changes
      const wy = f.by - ROOM.z1 * kk * f.s - 30
      k.seed('wdim'); k.arrow([[f.cx - ROOM.w / 2 * f.s, wy], [f.cx + ROOM.w / 2 * f.s, wy]], k.P.a, 1.6, 1)
      k.arrow([[f.cx + ROOM.w / 2 * f.s, wy], [f.cx - ROOM.w / 2 * f.s, wy]], k.P.a, 1.6, 1)
      if (p.width) k.text(p.width, f.cx, wy - 34, { role: 'mono', size: 28, min: 14, maxW: 300, align: 'center', col: k.P.a })

      // depth: a dimension line up the left wall, changes with the focal length
      const dx = f.cx - ROOM.w / 2 * f.s - 44
      k.seed('ddim'); k.arrow([[dx, f.by - ROOM.z0 * kk * f.s], [dx, f.by - ROOM.z1 * kk * f.s]], k.P.b, 1.6, 1)
      const lab = i === 1 ? p.deep : i === 2 ? p.shallow : ''
      if (lab) k.text(lab, dx - 16, f.by - (ROOM.z0 + ROOM.z1) / 2 * kk * f.s, { role: 'mono', size: 28, min: 14, maxW: 260, align: 'right', col: k.P.b, alpha: k.thumb ? 1 : k.p(i, .6, 1.2) })

      // the line for this step
      const legend = (p.legend || [])[i]
      if (legend) k.text(legend, 980, k.top + 120, { role: 'head', size: 40, min: 18, maxW: 380, lines: 4, alpha: k.thumb ? 1 : k.p(i, .5, .2) })

      k.point = i === 3 ? [f.cx, wy] : [dx, f.by - ROOM.z1 * kk * f.s]
      k.mood = i === 3 ? 'happy' : i === 0 ? 'neutral' : 'thinking'
    },
  }
})())
