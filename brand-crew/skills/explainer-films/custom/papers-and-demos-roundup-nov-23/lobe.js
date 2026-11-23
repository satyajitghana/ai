// papers-and-demos-roundup-nov-23 / lobe
//
// The hummingbird's gorget flash, from day 12's plumageMaterial.ts, as a moving picture.
// A fan of feather cards sits on an arc (the throat), each with its own platelet normal,
// tilted a little at random. An eye travels round the arc (the bill turning toward and away
// from the viewer). Four beats:
//   0  the feathers and their platelet normals appear
//   1  a body-wide tint: every feather the same colour, dimmed only gently with angle; no flash
//   2  the lobe: each feather's brightness is pow(dot(n, v), power) and its hue slides from
//      maroon (glancing) to violet (head-on), so only the feathers facing the eye flash
//   3  the lobe plotted beside it, widening then narrowing as the power rises
// Colours are the style's inks (k.P.b head-on, k.P.hi darkened at a glance). Geometry only; every string comes from params. A toy fan, so the runtime stamps it Illustrative.
//
// params: { heads: [4 strings], eye, wide, narrow }
BESPOKE.define((() => {
  const N = 13
  const CX = 560, CY = 870, R = 280
  // feather angles along the upper arc, with a seeded platelet tilt each
  let FEATHERS = null
  const build = (k) => {
    if (FEATHERS) return FEATHERS
    const rnd = k.rng('gorget')
    FEATHERS = []
    for (let i = 0; i < N; i++) {
      const a = Math.PI * (1.12 + (0.76 * i) / (N - 1)) // 202deg .. 338deg
      const tilt = (rnd() - 0.5) * 0.5
      FEATHERS.push({ a, n: a + tilt })
    }
    return FEATHERS
  }
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  // a feather card: a pointed leaf of length L, pointing along angle ang from its root
  const leaf = (x, y, ang, L, W) => {
    const pts = []
    const ca = Math.cos(ang), sa = Math.sin(ang)
    for (let j = 0; j <= 16; j++) {
      const t = j / 16
      const w = W * Math.sin(Math.PI * t) * (1 - 0.35 * t)
      pts.push([t * L, w])
    }
    for (let j = 16; j >= 0; j--) {
      const t = j / 16
      const w = W * Math.sin(Math.PI * t) * (1 - 0.35 * t)
      pts.push([t * L, -w])
    }
    return pts.map(([u, v]) => [x + u * ca - v * sa, y + u * sa + v * ca])
  }

  return {
    stampAt: (k) => [1230, k.top + 24],
    plan: () => ({
      min: [4.2, 4.4, 6.8, 5.6],
      events: [{ step: 0, at: 0.3, type: 'ticks', n: 13, span: 1.3 }, { step: 2, at: 0.4, type: 'whoosh' }, { step: 3, at: 0.6, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.thumb ? 2 : k.step
      const F = build(k)
      // the two ends of the hue slide, from the style's own inks: glancing (dark) and head-on
      const MAROON = k.mix(k.P.hi, k.ink, 0.55), VIOLET = k.P.b
      const head = (p.heads || [])[k.thumb ? 2 : st]
      if (head) k.text(head, 130, k.top + 40, { role: 'head', size: 32, min: 14, maxW: 1220, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, 0.5, 0.1)) })

      // where the eye is: an angle on a wider circle round the throat
      let eyeA = Math.PI * 1.5
      if (!k.thumb && st === 2) {
        const t = k.since(2)
        eyeA = Math.PI * (1.5 + 0.32 * Math.sin(t * 1.1 - 1.2))
      } else if (!k.thumb && st === 1) eyeA = Math.PI * 1.32
      else if (!k.thumb && st === 3) eyeA = Math.PI * (1.5 + 0.18 * Math.sin(k.since(3) * 0.9))
      const ER = R + 190
      const ex = CX + ER * Math.cos(eyeA), ey = CY + ER * Math.sin(eyeA)

      // power for the lobe: fixed while the eye sweeps, rising in beat three
      const power = st === 3 && !k.thumb ? 2 + 30 * k.ease(k.p(3, 3.2, 0.8)) : 32

      // the throat arc
      k.seed('arc')
      const arc = []
      for (let j = 0; j <= 40; j++) { const a = Math.PI * (1.08 + 0.84 * j / 40); arc.push([CX + R * Math.cos(a), CY + R * Math.sin(a)]) }
      k.line(arc, 1.4, k.dim)

      // feathers
      for (let i = 0; i < N; i++) {
        const f = F[i]
        const rx = CX + R * Math.cos(f.a), ry = CY + R * Math.sin(f.a)
        const appear = k.thumb ? 1 : k.easeOut(k.clamp((k.since(0) - i * 0.09) / 0.5, 0, 1))
        if (appear <= 0) continue
        const pts = leaf(rx, ry, f.a, 80, 26)
        // view direction from the feather to the eye
        const vx = ex - rx, vy = ey - ry, vl = Math.hypot(vx, vy)
        const c = Math.max(0, (Math.cos(f.n) * vx + Math.sin(f.n) * vy) / vl)
        let col = MAROON, a = 0.35
        if (st === 1) { col = k.mix(MAROON, VIOLET, 0.55); a = 0.45 + 0.35 * c }
        else if (st >= 2) {
          col = k.mix(MAROON, VIOLET, smooth(0.3, 0.8, c))
          a = 0.28 + 0.72 * Math.pow(c, power)
        }
        k.push(); k.alpha(appear)
        k.flat(pts, col, a)
        k.seed('f' + i); k.line(pts, 1.2, k.ink, { closed: true })
        // the platelet normal
        if (st === 0 || st === 3 || k.thumb) {
          const L = 56
          const nx = rx + Math.cos(f.n) * (80 + L), ny = ry + Math.sin(f.n) * (80 + L)
          const sx = rx + Math.cos(f.n) * 84, sy = ry + Math.sin(f.n) * 84
          const na = k.thumb ? 1 : st === 0 ? k.easeOut(k.clamp((k.since(0) - 1.2 - i * 0.05) / 0.4, 0, 1)) : 0.6
          if (na > 0) k.arrow([[sx, sy], [nx, ny]], k.P.b, 1.6, na)
        }
        k.pop()
      }

      // the eye
      if (st >= 1 || k.thumb) {
        const a = k.thumb ? 1 : st === 1 ? k.easeOut(k.p(1, 0.5, 0.1)) : 1
        k.push(); k.alpha(a)
        k.seed('eye'); k.shape(k.ellipse(ex, ey, 46, 26), { fill: k.paper, op: 1, sw: 2, ink: k.ink })
        k.flat(k.circle(ex, ey, 13), k.ink, 1)
        if (p.eye && st !== 3) k.text(p.eye, ex + 58, ey + 8, { role: 'label', size: 22, min: 12, maxW: 200, lines: 1, col: k.dim })
        k.pop()
      }

      // beat three: the lobe as a polar plot, power rising
      if (st === 3 && !k.thumb) {
        const a = k.easeOut(k.p(3, 0.6, 0.1))
        const PX = 1130, PY = 700, PR = 230
        k.push(); k.alpha(a)
        k.seed('axis'); k.line([[PX - PR - 20, PY], [PX + PR + 20, PY]], 1.2, k.dim)
        k.seed('axis2'); k.line([[PX, PY + 10], [PX, PY - PR - 30]], 1.2, k.dim)
        const curve = []
        for (let j = 0; j <= 60; j++) {
          const phi = -Math.PI / 2 + Math.PI * j / 60
          const r = PR * Math.pow(Math.max(0, Math.cos(phi)), power)
          curve.push([PX + r * Math.sin(phi), PY - r * Math.cos(phi)])
        }
        k.flat(curve, VIOLET, 0.35)
        k.line(curve, 2.2, k.ink)
        const lab = power < 12 ? p.wide : p.narrow
        if (lab) k.text(lab, PX - PR, PY + 52, { role: 'mono', size: 22, min: 12, maxW: 2 * PR + 40, lines: 1, col: k.dim })
        k.pop()
      }

      k.point = st === 3 ? [1130, 560] : st >= 1 ? [ex, ey] : [CX, CY - R - 60]
      k.mood = st === 2 ? 'excited' : st === 3 ? 'thinking' : 'neutral'
    },
  }
})())
