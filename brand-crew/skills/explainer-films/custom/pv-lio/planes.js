// pv-lio / planes
//
// The article's AdaptiveVoxels and PointNoise widgets as one moving picture, on a 2-D slice:
// points of a room (floor, wall, a step, a sloped ceiling, a round column) fall into 1 m root
// voxels; a voxel whose points are flat enough keeps a plane; one that is not is cut into four
// and the children try again, down to the last layer; then a scan point with its noise ellipse
// is matched to a plane inside a three-sigma band; and two residuals are weighed, a near
// head-on return against a far grazing one, beside FAST-LIO2's equal weights. Same rules as
// OctoTree::init_plane / cut_octo_tree (more than 5 points, smallest eigenvalue under the
// threshold), on a seeded toy, so the runtime stamps it Illustrative. Every string drawn comes
// from params.
//
// steps: 0 points arrive · 1 flat roots keep a plane · 2 the rest are cut · 3 match in a band · 4 weigh
// params: { labels: [5 strings], near, far, fast, pv }
BESPOKE.define((() => {
  let s = 11 >>> 0
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  const gauss = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
  const W = 4, H = 2.2
  const P = []
  const seg = (a, b, step) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(len / step)
    for (let i = 0; i <= n; i++) { const t = i / n; P.push([a[0] + (b[0] - a[0]) * t + .012 * gauss(), a[1] + (b[1] - a[1]) * t + .012 * gauss()]) }
  }
  seg([.1, .08], [2.6, .08], .05)          // floor
  seg([.1, .08], [.1, 2.1], .05)           // wall
  seg([2.6, .08], [2.6, .6], .05)          // step riser
  seg([2.6, .6], [3.95, .6], .05)          // step tread
  seg([.1, 2.1], [3.95, 1.78], .05)        // sloped ceiling
  for (let i = 0; i < 34; i++) { const a = 2 * Math.PI * i / 34; P.push([1.75 + .26 * Math.cos(a) + .012 * gauss(), 1.05 + .26 * Math.sin(a) + .012 * gauss()]) }
  const order = P.map((_, i) => i).sort((a, b) => P[a][0] - P[b][0])   // a sweep arriving left to right
  const rankOf = new Array(P.length); order.forEach((i, r) => { rankOf[i] = r })

  // the coarse-to-fine rule
  const THR = .0016, MAXL = 2, ROOT = 1
  const cells = []
  const fit = idx => {
    let mx = 0, my = 0; idx.forEach(i => { mx += P[i][0]; my += P[i][1] }); mx /= idx.length; my /= idx.length
    let a = 0, b = 0, c = 0
    idx.forEach(i => { const dx = P[i][0] - mx, dy = P[i][1] - my; a += dx * dx; b += dx * dy; c += dy * dy })
    a /= idx.length; b /= idx.length; c /= idx.length
    const d = Math.sqrt(((a - c) / 2) ** 2 + b * b)
    return { mx, my, lmin: (a + c) / 2 - d, lmax: (a + c) / 2 + d, ang: .5 * Math.atan2(2 * b, a - c) }
  }
  const visit = (x, y, sz, layer, idx) => {
    if (idx.length <= 5) return
    const f = fit(idx)
    if (f.lmin < THR) { cells.push({ x, y, sz, layer, kind: 'plane', f }); return }
    if (layer >= MAXL) { cells.push({ x, y, sz, layer, kind: 'rough' }); return }
    cells.push({ x, y, sz, layer, kind: 'split' })
    const h = sz / 2
    ;[[0, 0], [h, 0], [0, h], [h, h]].forEach(([ox, oy]) => visit(x + ox, y + oy, h, layer + 1,
      idx.filter(i => P[i][0] >= x + ox && P[i][0] < x + ox + h && P[i][1] >= y + oy && P[i][1] < y + oy + h)))
  }
  for (let x = 0; x < W - 1e-9; x += ROOT) for (let y = 0; y < H - 1e-9; y += ROOT)
    visit(x, y, ROOT, 0, P.map((_, i) => i).filter(i => P[i][0] >= x && P[i][0] < x + ROOT && P[i][1] >= y && P[i][1] < y + ROOT))
  const roots = cells.filter(c => c.layer === 0)
  // the plane the demo point matches: the floor plane under x = 1.3
  const target = cells.find(c => c.kind === 'plane' && c.f.mx > 1 && c.f.mx < 2 && c.f.my < .3) || cells.find(c => c.kind === 'plane')

  return {
    stampAt: k => [1180, k.top - 20],
    plan: () => ({
      min: [4.0, 4.2, 5.2, 4.6, 5.4],
      events: [{ step: 0, at: .2, type: 'ticks', n: 16, span: 3 }, { step: 1, at: .5, type: 'pop' }, { step: 2, at: .4, type: 'whoosh' },
        { step: 3, at: .8, type: 'ding' }, { step: 4, at: .6, type: 'thunk' }],
      motion: [{ step: 0, from: 0, to: 3.6 }, { step: 2, from: 0, to: 3.4 }, { step: 3, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 160, X1 = 1320, Y1 = 880
      const S = Math.min((X1 - X0) / W, (Y1 - Math.max(k.top + 80, 250)) / H)
      const Y0 = Y1 - H * S
      const X = x => X0 + x * S, Y = y => Y1 - y * S
      const tAll = k.thumb ? 1 : 0

      // label for the step
      const lab = (p.labels || [])[st]
      if (lab) k.text(lab, X0, Y0 - 46, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: tAll || k.easeOut(k.p(st, .6, .1)) })

      // voxel grid: roots from step 1, children from step 2
      const g1 = st >= 1 ? (tAll || k.ease(k.p(1, .9, .1))) : 0
      const g2 = st >= 2 ? (tAll || k.ease(k.p(2, 1.2, .3))) : 0
      cells.forEach((c, j) => {
        const a = c.layer === 0 ? g1 : g2
        if (a <= .02) return
        k.push(); k.alpha(a * (c.layer === 0 ? .8 : .55)); k.seed('g' + j)
        k.line(k.rect(X(c.x), Y(c.y + c.sz), c.sz * S, c.sz * S).concat([[X(c.x), Y(c.y + c.sz)]]), c.layer === 0 ? 1.4 : .9, k.dim); k.pop()
        // a root that is not flat is tinted at step 1; a leaf still not flat at the last layer stays tinted
        if ((c.layer === 0 && c.kind === 'split' && st === 1) || (c.kind === 'rough' && st >= 2)) {
          k.push(); k.alpha(.32 * a); k.flat(k.rect(X(c.x) + 3, Y(c.y + c.sz) + 3, c.sz * S - 6, c.sz * S - 6), k.P.hi, 1); k.pop()
        }
      })

      // points
      const arrive = st === 0 && !k.thumb ? k.p(0, 3.2, .2) : 1
      P.forEach((q, i) => {
        const born = k.clamp((arrive * P.length - rankOf[i]) / 12, 0, 1)
        if (born <= 0) return
        k.flat(k.circle(X(q[0]), Y(q[1]), 3.2 * born, 8), k.ink, .75)
      })

      // planes: roots at step 1, children at step 2
      const COL = [k.P.a, k.P.b, k.P.hi]
      cells.forEach((c, j) => {
        if (c.kind !== 'plane') return
        const a = c.layer === 0 ? g1 : g2
        if (a <= .02) return
        const half = Math.min(Math.sqrt(3 * c.f.lmax), c.sz * .7) * S
        const dx = Math.cos(c.f.ang) * half, dy = Math.sin(c.f.ang) * half
        const cx = X(c.f.mx), cy = Y(c.f.my)
        k.push(); k.alpha(a); k.seed('pl' + j)
        k.line(k.partial([[cx - dx, cy + dy], [cx + dx, cy - dy]], a), 6, COL[Math.min(c.layer, 2)]); k.pop()
      })

      // step 3: a scan point with its noise ellipse, matched inside a three-sigma band
      if (st >= 3 && target) {
        const m = tAll || k.ease(k.p(3, 1.4, .2))
        const f = target.f, nx = -Math.sin(f.ang), ny = Math.cos(f.ang)
        const px = f.mx + .12 + nx * .06, py = f.my + ny * .06
        const sx = X(px), sy = Y(py) - (1 - m) * 160
        const band = .1 * S
        k.push(); k.alpha(.22 * m)
        const hx = Math.cos(f.ang) * .45 * S, hy = -Math.sin(f.ang) * .45 * S
        k.flat([[X(f.mx) - hx - nx * band, Y(f.my) - hy + ny * band], [X(f.mx) + hx - nx * band, Y(f.my) + hy + ny * band],
          [X(f.mx) + hx + nx * band, Y(f.my) + hy - ny * band], [X(f.mx) - hx + nx * band, Y(f.my) - hy - ny * band]], k.P.b, 1)
        k.pop()
        const E = k.ellipse(sx, sy, 16, 44, 40)
        k.push(); k.alpha(.35 * m); k.flat(E, k.P.hi, 1); k.pop()
        k.seed('ell'); k.line(E.concat([E[0]]), 3, k.P.hi)
        k.flat(k.circle(sx, sy, 9, 12), k.ink, 1)
        if (m > .6) { k.seed('res'); k.arrow([[sx + 30, sy], [sx + 30 - nx * .06 * S, sy + ny * .06 * S]], k.ink, 2.6, k.clamp((m - .6) / .4, 0, 1)) }
        k.point = [sx, sy]
      }

      // step 4: two residuals weighed, PV-LIO against FAST-LIO2
      if (st >= 4) {
        const w = tAll || k.ease(k.p(4, 1.4, .3))
        const bx = X(2.72), by = Y(1.62), bw = X(3.9) - bx
        k.push(); k.alpha(.94); k.flat(k.rrect(bx - 18, by - 22, bw + 36, 262, 16), k.paper, 1); k.pop()
        k.seed('box'); k.line(k.rrect(bx - 18, by - 22, bw + 36, 262, 16).concat([[bx - 18 + 16, by - 22]]), 1.2, k.dim)
        const rows = [[p.pv, 0], [p.fast, 1]]
        rows.forEach(([title, r]) => {
          const y = by + r * 122
          k.text(title, bx, y + 6, { role: 'label', size: 21, min: 11, maxW: bw, lines: 1 })
          const near = r === 0 ? 1 : .55, far = r === 0 ? .12 : .55
          ;[[p.near, near, k.P.a], [p.far, far, k.P.b]].forEach(([lbl, v, col], q) => {
            const yy = y + 30 + q * 40
            k.text(lbl, bx, yy + 18, { role: 'mono', size: 17, min: 10, maxW: 140, lines: 1, col: k.dim })
            k.flat(k.rect(bx + 150, yy + 2, (bw - 150) * v * w, 24), col, 1)
          })
        })
        k.point = [bx + 150, by + 50]
      }
      k.mood = st === 1 ? 'thinking' : st === 2 ? 'surprised' : st === 4 ? 'proud' : 'neutral'
      if (st < 3) k.point = st === 0 ? [X0 + (X1 - X0) * Math.min(arrive, .9), Y(.3)] : [X(1.75), Y(1.05)]
    },
  }
})())
