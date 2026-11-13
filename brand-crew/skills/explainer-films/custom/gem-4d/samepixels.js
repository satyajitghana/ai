// gem-4d / samepixels
//
// The article's SamePixels widget, animated: why a pixel loss cannot pin down
// geometry. Left, five frames of a generated clip, the gripper a dot that
// steps right by the same number of pixels each frame; these never change.
// Right, a top view of what those frames mean in 3D: a camera at the bottom,
// one ray per frame through the gripper's pixel, and the gripper lifted along
// each ray to some depth, the way an action extractor lifts it. Each beat
// picks a different reading of the same frames: one depth (a straight reach),
// a deeper scene (a longer reach), the camera panning (the gripper barely
// moves), depth drifting frame to frame (a zigzag), and finally one consistent
// geometry again, which is what GEM-4D's training pushes the backbone toward.
// A toy, so the runtime stamps it Illustrative; every word drawn is a
// storyboard string.
//
// steps: 0 one reading · 1 deeper · 2 camera pans · 3 depth drifts · 4 consistent
// params: { frames, top, legend: [5 strings], pixels, path }
BESPOKE.define((() => {
  const U = [-.36, -.18, 0, .18, .36]            // pixel positions, fixed
  const DRIFT = [1, 1.45, .75, 1.35, .85]        // per-frame depth multipliers
  const CFG = [                                  // one reading per beat
    { s: 1, share: 0, d: 0 },
    { s: 1.55, share: 0, d: 0 },
    { s: 1, share: .85, d: 0 },
    { s: 1, share: 0, d: 1 },
    { s: 1, share: 0, d: 0 },
  ]
  const Z0 = 1.6
  const lift = (c) => U.map((u, j) => {
    const z = Z0 * c.s * (1 + (DRIFT[j] - 1) * c.d)
    const cam = -c.share * (U[1] - U[0]) * Z0 * c.s * j
    return { u, z, cam, x: cam + u * z }
  })
  const mixC = (a, b, t) => ({ s: a.s + (b.s - a.s) * t, share: a.share + (b.share - a.share) * t, d: a.d + (b.d - a.d) * t })

  return {
    stampAt: k => [1240, Math.max(k.top + 40, 250) + 40],
    plan: () => ({
      min: [4.2, 3.8, 3.8, 4.2, 4.2],
      events: [{ step: 0, at: .3, type: 'ticks', n: 5, span: 1 }, { step: 1, at: .2, type: 'whoosh' }, { step: 2, at: .2, type: 'slide' },
        { step: 3, at: .2, type: 'scratch' }, { step: 4, at: .2, type: 'whoosh' }, { step: 4, at: 1.4, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 1.6 }, { step: 2, from: 0, to: 1.6 }, { step: 3, from: 0, to: 1.6 }, { step: 4, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = Math.min(k.step, CFG.length - 1)
      const Y0 = Math.max(k.top + 40, 250)
      const tin = k.thumb ? 1 : k.easeOut(k.span(0, .8))

      // ---- left: five frames, never changing ----
      const FX = 130, FW = 380, FH = 64, GAP = 18
      if (p.frames) k.text(p.frames, FX, Y0 + 10, { role: 'label', size: 26, min: 13, maxW: FW + 20, lines: 1, col: k.dim })
      for (let j = 0; j < 5; j++) {
        const y = Y0 + 50 + j * (FH + GAP)
        k.seed('frame' + j)
        k.shape(k.rrect(FX, y, FW, FH, 8), { fill: k.tone('light'), op: .45 * tin, sw: .8 })
        const a = k.thumb ? 1 : k.p(0, .5, .15 * j)
        k.flat(k.circle(FX + FW / 2 + U[j] * 480, y + FH / 2, 14, 16), k.P.hi, a)
      }
      if (p.pixels) k.text(p.pixels, FX, Y0 + 50 + 5 * (FH + GAP) + 10, { role: 'body', size: 24, min: 12, maxW: FW + 20, lines: 2, col: k.dim })

      // ---- right: the top view ----
      const RX = 600, RW = 760, RY = Y0 + 50, RH = 470
      const sx = x => RX + ((x + 2.4) / 4.4) * RW
      const sz = z => RY + RH - (z / 4) * RH
      if (p.top) k.text(p.top, RX, Y0 + 10, { role: 'label', size: 26, min: 13, maxW: RW, lines: 1, col: k.dim })
      k.seed('frameR'); k.line(k.rect(RX, RY, RW, RH).concat([[RX, RY]]), .6, k.dim)

      const prev = CFG[Math.max(0, i - 1)], cur = CFG[i]
      const t = i === 0 || k.thumb ? 1 : k.ease(k.p(i, 1.3, .2))
      const P = lift(mixC(prev, cur, t))

      P.forEach((q, j) => {
        k.seed('ray' + j)
        k.line([[sx(q.cam), sz(0)], [sx(q.cam + q.u * 3.9), sz(3.9)]], .5, k.mix(k.dim, k.paper, .4))
        const cx = sx(q.cam), cy = sz(0) + 2
        k.flat([[cx, cy - 18], [cx - 16, cy + 8], [cx + 16, cy + 8]], k.mix(k.ink, k.paper, .75 - .13 * j), 1)
      })
      const pts = P.map(q => [sx(q.x), sz(q.z)])
      k.seed('path' + i)
      k.line(pts, 1.3, k.P.a)
      pts.forEach(([x, y], j) => k.flat(k.circle(x, y, 13, 16), j === pts.length - 1 ? k.P.hi : k.P.a, 1))
      if (p.path) k.text(p.path, RX + 16, RY + 14, { role: 'label', size: 22, min: 12, maxW: RW - 40, lines: 1, col: k.dim })

      // the reading for this beat
      if (p.legend && p.legend[i]) k.text(p.legend[i], RX, RY + RH + 40, { role: 'head', size: 34, min: 16, maxW: RW, lines: 2 })

      k.point = pts[pts.length - 1]
      k.mood = i === 3 ? 'surprised' : i === 4 ? 'happy' : 'thinking'
    },
  }
})())
