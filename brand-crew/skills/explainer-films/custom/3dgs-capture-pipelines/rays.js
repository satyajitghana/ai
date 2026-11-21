// 3dgs-capture-pipelines / rays
//
// The article's RayGeometry widget as a moving picture: one ring of rays, ten degrees across,
// drawn into the three ways a 360 camera's sphere gets stored.
//   step 0  the equirectangular panorama: the ring climbs toward the pole and stretches sideways
//   step 1  the cube net: the same ring lands on one face, then straddles two
//   step 2  the dual fisheye: two discs, the seam ring dashed; near the seam the ring splits in two
// Geometry only; the labels are params. Stamped Illustrative (no "data": "article").
//
// params: { erp, cube, fish, seam }
BESPOKE.define((() => {
  const DEG = Math.PI / 180
  const dir = (yaw, pitch) => [Math.cos(pitch * DEG) * Math.sin(yaw * DEG), -Math.sin(pitch * DEG), Math.cos(pitch * DEG) * Math.cos(yaw * DEG)]
  const nrm = v => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  function ring(d, deg, n = 36) {
    const e1 = nrm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(d, e1)
    const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), out = []
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, ca = Math.cos(a), sa = Math.sin(a)
      out.push([0, 1, 2].map(j => c * d[j] + s * (ca * e1[j] + sa * e2[j])))
    }
    return out
  }
  const erp = v => [(1 + Math.atan2(v[0], v[2]) / Math.PI) / 2, (1 + Math.atan2(v[1], Math.hypot(v[0], v[2])) * 2 / Math.PI) / 2]
  const NET = { left: [0, 1], front: [1, 1], right: [2, 1], back: [3, 1], up: [1, 0], down: [1, 2] }
  function cube(v) {
    const [x, y, z] = v, ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z)
    let f, u, w, m
    if (az >= ax && az >= ay) { m = az; if (z > 0) { f = 'front'; u = x / m; w = y / m } else { f = 'back'; u = -x / m; w = y / m } }
    else if (ax >= ay) { m = ax; if (x > 0) { f = 'right'; u = -z / m; w = y / m } else { f = 'left'; u = z / m; w = y / m } }
    else { m = ay; if (y < 0) { f = 'up'; u = x / m; w = z / m } else { f = 'down'; u = x / m; w = -z / m } }
    return [f, (u + 1) / 2, (w + 1) / 2]
  }
  function fish(v) {
    const lens = v[2] >= 0 ? 0 : 1, lx = lens ? -v[0] : v[0], lz = lens ? -v[2] : v[2]
    const r = Math.hypot(lx, v[1]), t = Math.atan2(r, lz), k = r > 1e-9 ? t / r / (100 * DEG) : 0
    return [lens, lx * k, v[1] * k]
  }
  return {
    plan: () => ({
      min: [5.0, 4.6, 5.0],
      events: [{ step: 0, at: .3, type: 'ticks', n: 8, span: 2.4 }, { step: 2, at: 2.4, type: 'ding' }],
      motion: 'all',
    }),
    stampAt: k => [1180, k.top + 20],
    draw(k) {
      const p = k.params, i = k.thumb ? 0 : k.step
      const ink = k.ink, dim = k.dim, a = k.P.a, b = k.tone('b'), hi = k.P.hi
      const top = k.top + 40
      const dot = (x, y, col) => k.flat(k.circle(x, y, 9, 10), col, .95)
      if (i === 0) {
        const X = 160, Y = top + 40, Wd = 1120, Hd = 560
        k.seed('erp'); k.shape(k.rect(X, Y, Wd, Hd), { fill: k.tone('light'), op: .25, sw: 1.4 })
        for (const lat of [-60, -30, 0, 30, 60]) { const yy = Y + Hd / 2 - lat / 180 * Hd; k.seed('lat' + lat); k.line([[X, yy], [X + Wd, yy]], lat ? .4 : .8, dim) }
        const pitch = k.thumb ? 62 : k.lerp(10, 72, k.ease(k.span(.1, .85)))
        for (const v of ring(dir(20, pitch), 15)) { const [u, w] = erp(v); dot(X + u * Wd, Y + w * Hd, a) }
        k.text(p.erp, X, Y + Hd + 70, { role: 'label', size: 34, min: 18, maxW: 1100, lines: 2, col: ink })
        const [u0, w0] = erp(dir(20, pitch)); k.point = [X + u0 * Wd, Y + w0 * Hd]
      } else if (i === 1) {
        const cs = 230, X = 240, Y = top
        for (const f in NET) { const [c, r] = NET[f]; k.seed('f' + f); k.shape(k.rect(X + c * cs, Y + r * cs, cs, cs), { fill: k.tone('light'), op: f === 'front' ? .35 : .15, sw: 1.2 }) }
        const yaw = k.thumb ? 40 : k.lerp(-5, 42, k.ease(k.p(1, 3.2, .4)))
        for (const v of ring(dir(yaw, 10), 15)) { const [f, u, w] = cube(v); const [c, r] = NET[f]; dot(X + (c + u) * cs, Y + (r + w) * cs, f === 'front' ? a : b) }
        k.text(p.cube, X, Y + 3 * cs + 60, { role: 'label', size: 34, min: 18, maxW: 1100, lines: 2, col: ink })
        k.point = [X + 2 * cs, Y + 1.5 * cs]
      } else {
        const R = 250, cy = top + 300, cx = [470, 1040]
        for (let l = 0; l < 2; l++) {
          k.seed('disc' + l); k.shape(k.circle(cx[l], cy, R, 72), { fill: k.tone('light'), op: .25, sw: 1.3 })
          const seam = k.circle(cx[l], cy, R * 0.9, 72)
          for (let s = 0; s < 72; s += 2) { k.seed('sm' + l + s); k.line([seam[s], seam[s + 1]], 1.4, hi) }
        }
        const yaw = k.thumb ? 88 : k.lerp(40, 90, k.ease(k.p(2, 3.0, .3)))
        for (const v of ring(dir(yaw, 0), 15)) { const [l, x, y] = fish(v); dot(cx[l] + x * R, cy + y * R, l ? b : a) }
        k.text(p.fish, 200, cy + R + 70, { role: 'label', size: 34, min: 18, maxW: 1100, lines: 1, col: ink })
        if (k.thumb || k.since(2) > 2.6) k.text(p.seam, 200, cy + R + 130, { role: 'label', size: 30, min: 16, maxW: 1100, lines: 1, col: hi })
        k.point = [cx[0] + R * 0.9, cy]
      }
      k.mood = i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
