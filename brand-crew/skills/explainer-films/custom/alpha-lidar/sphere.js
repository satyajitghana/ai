// alpha-lidar / sphere
//
// The article's HeadCoverage widget as a moving picture: the sphere around the sensor unrolled
// into a map (azimuth across, elevation up), and the returns of a 16-line LiDAR landing on it
// sweep by sweep. Four beats, one mount each: upright (a band), on its side with the motor still
// (a vertical slice), the motor turning (the slice sweeps the whole map), and the focus sweep
// (the slice swings over a sector and the dots pile up in the box ahead). Same geometry as the
// widget (rings every 2 degrees from -15 to +15, the LiDAR's spin axis at right angles to the
// motor's), subsampled to every other ring and 12-degree steps so a frame stays cheap. A model,
// so the runtime stamps it Illustrative. Every string drawn comes from params.
//
// steps: 0 upright · 1 on its side · 2 motor turning · 3 focus sweep
// params: { labels: [4 strings], up, down, ahead, behind, box }
BESPOKE.define((() => {
  const D2R = Math.PI / 180
  const RINGS = []
  for (let e = -15; e <= 15; e += 4) RINGS.push(e * D2R)
  const AZ = []
  for (let a = 0; a < 360; a += 12) AZ.push(a * D2R)
  const SWEEPS = 10          // one second of scans per beat
  const OMEGA = 3            // rad/s while turning
  const AMP = 30 * D2R       // focus half-width

  const motor = (mode, t) => {
    if (mode === 2) return OMEGA * t
    if (mode === 3) return Math.PI / 2 + AMP * Math.sin((OMEGA / AMP) * t)
    return 0
  }
  // every return of one beat as [u, v, sweepIndex], u = azimuth 0..1, v = elevation 0..1 (top = up)
  const beat = mode => {
    const out = []
    for (let s = 0; s < SWEEPS; s++) {
      AZ.forEach((phi, ai) => {
        const t = s * 0.1 + (ai / AZ.length) * 0.1
        const th = motor(mode, t), ct = Math.cos(th), st = Math.sin(th)
        RINGS.forEach(e => {
          const lx = Math.cos(e) * Math.cos(phi), ly = Math.cos(e) * Math.sin(phi), lz = Math.sin(e)
          let x, y, z
          if (mode === 0) { x = lx; y = ly; z = lz } else {
            const sx = lz, sy = ly, sz = -lx
            x = ct * sx - st * sy; y = st * sx + ct * sy; z = sz
          }
          const el = Math.asin(Math.max(-1, Math.min(1, z))), az = Math.atan2(y, x)
          out.push([(az / D2R + 180) / 360, (90 - el / D2R) / 180, s])
        })
      })
    }
    return out
  }
  const BEATS = [0, 1, 2, 3].map(beat)

  return {
    stampAt: k => [1210, k.top + 20],
    plan: () => ({
      min: [4.2, 3.8, 5.2, 5.2],
      events: [{ step: 0, at: .3, type: 'ticks', n: 10, span: 3 }, { step: 2, at: .3, type: 'whoosh' },
        { step: 3, at: .4, type: 'ticks', n: 10, span: 3.4 }, { step: 3, at: 3.6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 150, W = 1160, H = W / 2
      const Y0 = Math.max(k.top + 90, 250)
      const X = u => X0 + u * W, Y = v => Y0 + v * H
      // the map frame and its graticule
      k.seed('frame'); k.shape(k.rect(X0, Y0, W, H), { fill: k.P.light, op: .35, sw: 1.4, ink: k.ink })
      for (let g = 1; g < 4; g++) { k.seed('gv' + g); k.line([[X(g / 4), Y0], [X(g / 4), Y0 + H]], .6, k.dim) }
      k.seed('eq'); k.line([[X0, Y(.5)], [X0 + W, Y(.5)]], .8, k.dim)
      const lab = { role: 'mono', size: 22, min: 12, maxW: 260, lines: 1, col: k.dim }
      if (p.up) k.text(p.up, X0 + 10, Y0 + 28, lab)
      if (p.down) k.text(p.down, X0 + 10, Y0 + H - 12, lab)
      if (p.ahead) k.text(p.ahead, X(.5) - 40, Y0 + H + 36, lab)
      if (p.behind) k.text(p.behind, X0 + W - 110, Y0 + H + 36, lab)
      // the box ahead (azimuth and elevation within 20 degrees)
      const bx = X(160 / 360), by = Y(70 / 180), bw = W * 40 / 360, bh = H * 40 / 180
      if (st === 3) {
        const a = k.thumb ? 1 : k.easeOut(k.p(3, .6, .1))
        k.push(); k.alpha(a); k.seed('box'); k.line(k.rect(bx, by, bw, bh).concat([[bx, by]]), 2, k.P.hi); k.pop()
        if (p.box) k.text(p.box, bx + bw + 14, by + 26, { role: 'mono', size: 22, min: 12, maxW: 300, lines: 2, col: k.P.hi, alpha: a })
      }
      // returns: sweeps appear over the beat (a still shows them all)
      const prog = k.thumb ? 1 : k.clamp(k.since(st) / 3.2, 0, 1)
      const shown = Math.max(1, Math.ceil(prog * SWEEPS))
      const pts = BEATS[st]
      const col = st === 0 ? k.P.a : st === 3 ? k.P.hi : k.P.b
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]
        if (q[2] >= shown) continue
        const fresh = q[2] === shown - 1 && !k.thumb
        const r = fresh ? 5 : 3.4
        k.flat(k.rect(X(q[0]) - r, Y(q[1]) - r, 2 * r, 2 * r), fresh ? k.ink : col, fresh ? 1 : .8)
      }
      const head = (p.labels || [])[st]
      if (head) k.text(head, X0, Y0 - 34, { role: 'head', size: 32, min: 14, maxW: W, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })
      k.point = st === 3 ? [bx + bw / 2, by + bh / 2] : [X(.5), Y(.5)]
      k.mood = st === 2 ? 'excited' : st === 3 ? 'proud' : 'neutral'
    },
  }
})())
