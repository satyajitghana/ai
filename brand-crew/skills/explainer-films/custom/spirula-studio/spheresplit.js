// spirula-studio / spheresplit
//
// The article's SphereSplit widget, animated: the whole sphere unrolled as an
// equirectangular map, and the pinhole views Spirula Studio cuts a 360 frame
// into, laid on it. Each view is painted as a translucent layer, so where two
// views see the same direction the paint doubles up on its own.
//
// Geometry is Pano360.cpp's at commit bef5063 (the same as the widget):
//   GoPro MAX: per lens, the face on its axis (90 degrees) plus four half faces
//   tilted 45 deg + atan(half / S) off it, half = S tan 22.5 rounded down to
//   even, wide = S / cos(that) rounded up to even, focal S / 2, S = 1504.
//   MAX 2: six square 100 degree faces, centres at +-35.26 deg elevation every
//   60 deg of azimuth, each kept level.
// The coverage figures the narration quotes are the article's; this module
// draws the shapes and prints only storyboard strings.
//
// steps: 0 the sphere unrolled, the lens seam · 1 the front lens's five views ·
//        2 the back lens's five · 3 where they overlap · 4 the MAX 2's six, and its gaps
// params: { seam, front, back, legend[5] }
BESPOKE.define((() => {
  const COLS = 120, ROWS = 60
  const D2R = Math.PI / 180
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c] }
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
  const mul = (a, b) => { const r = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) r[i * 3 + j] += a[i * 3 + q] * b[q * 3 + j]; return r }
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

  // GoPro MAX: ten views, five per lens
  const S = 1504, f = S / 2
  const half = 2 * Math.floor(S * Math.tan(22.5 * D2R) / 2)
  const av = Math.atan(half / S)
  const wide = 2 * Math.ceil(S / Math.cos(av) / 2)
  const MAX = []
  for (const lens of [0, 1]) {
    const axis = lens === 0 ? I3 : rotY(Math.PI)
    const t = 45 * D2R + av
    MAX.push({ m: axis, hx: 1, hy: 1, lens })
    MAX.push({ m: mul(axis, rotX(-t)), hx: wide / 2 / f, hy: half / 2 / f, lens })
    MAX.push({ m: mul(axis, rotX(t)), hx: wide / 2 / f, hy: half / 2 / f, lens })
    MAX.push({ m: mul(axis, rotY(t)), hx: half / 2 / f, hy: wide / 2 / f, lens })
    MAX.push({ m: mul(axis, rotY(-t)), hx: half / 2 / f, hy: wide / 2 / f, lens })
  }
  // MAX 2: a cube stood on a corner, six upright 100 degree faces
  const CORNER = []
  const tilt = Math.asin(1 / Math.sqrt(3)), h100 = Math.tan(50 * D2R)
  for (let q = 0; q < 6; q++) {
    const up = q % 2 ? -tilt : tilt, az = 60 * q * D2R
    const ez = [Math.cos(up) * Math.sin(az), -Math.sin(up), Math.cos(up) * Math.cos(az)]
    const n = Math.hypot(ez[0], ez[2]), ex = [ez[2] / n, 0, -ez[0] / n]
    const ey = [ez[1] * ex[2] - ez[2] * ex[1], ez[2] * ex[0] - ez[0] * ex[2], ez[0] * ex[1] - ez[1] * ex[0]]
    CORNER.push({ m: [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]], hx: h100, hy: h100, lens: 2 })
  }

  const sees = (v, d) => {
    const m = v.m
    const x = d[0] * m[0] + d[1] * m[3] + d[2] * m[6]
    const y = d[0] * m[1] + d[1] * m[4] + d[2] * m[7]
    const z = d[0] * m[2] + d[1] * m[5] + d[2] * m[8]
    return z > 0 && Math.abs(x) < v.hx * z && Math.abs(y) < v.hy * z
  }
  const dirs = []
  for (let r = 0; r < ROWS; r++) {
    const lat = (90 - (r + .5) * 180 / ROWS) * D2R, row = []
    for (let c = 0; c < COLS; c++) {
      const lon = (-180 + (c + .5) * 360 / COLS) * D2R
      row.push([Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)])
    }
    dirs.push(row)
  }
  // runs of cells, per row, where a predicate holds: [row, c0, c1)
  const runsOf = pred => {
    const out = []
    for (let r = 0; r < ROWS; r++) {
      let s = -1
      for (let c = 0; c <= COLS; c++) {
        const on = c < COLS && pred(dirs[r][c])
        if (on && s < 0) s = c
        if (!on && s >= 0) { out.push([r, s, c]); s = -1 }
      }
    }
    return out
  }
  const centre = v => { const z = [v.m[2], v.m[5], v.m[8]]; return [Math.atan2(z[0], z[2]) / D2R, Math.asin(-z[1]) / D2R] }
  const MAXR = MAX.map(v => ({ runs: runsOf(d => sees(v, d)), c: centre(v), lens: v.lens }))
  const CORR = CORNER.map(v => ({ runs: runsOf(d => sees(v, d)), c: centre(v) }))
  const count = (vs, d) => vs.reduce((a, v) => a + (sees(v, d) ? 1 : 0), 0)
  const OVER = runsOf(d => count(MAX, d) >= 2)
  const HOLES = runsOf(d => count(CORNER, d) === 0)

  return {
    stampAt: k => [1150, k.top - 30],
    plan: () => ({
      min: [3.6, 4.6, 4.2, 4.2, 5.4],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .2, type: 'ticks', n: 5, span: 2.2 }, { step: 2, at: .2, type: 'ticks', n: 5, span: 2.2 },
        { step: 3, at: .4, type: 'ding' }, { step: 4, at: .3, type: 'ticks', n: 6, span: 2.4 }, { step: 4, at: 3, type: 'pop' }],
      motion: [{ step: 1, from: 0, to: 2.8 }, { step: 2, from: 0, to: 2.8 }, { step: 3, from: 0, to: 1.2 }, { step: 4, from: 0, to: 3.6 }],
    }),
    draw(k) {
      const p = k.params, legend = p.legend || []
      const i = k.thumb ? 3 : k.step
      const MW = 1040, MH = 520, X0 = 170, Y0 = Math.max(k.top + 30, 230)
      const cw = MW / COLS, ch = MH / ROWS
      const X = lon => X0 + (lon + 180) / 360 * MW, Y = lat => Y0 + (90 - lat) / 180 * MH
      const paint = (runs, col, a) => { if (a <= 0) return; for (const [r, c0, c1] of runs) k.flat(k.rect(X0 + c0 * cw, Y0 + r * ch, (c1 - c0) * cw + .6, ch + .6), col, a) }

      // the map: frame, graticule, the seam
      const fk = k.thumb ? 1 : k.easeOut(k.span(0, .8))
      k.push(); k.alpha(fk)
      k.flat(k.rect(X0, Y0, MW, MH), k.tone('light'), .35)
      for (const lon of [-90, 0, 90]) { k.seed('lon' + lon); k.line([[X(lon), Y0], [X(lon), Y0 + MH]], .35, k.dim) }
      for (const lat of [-45, 0, 45]) { k.seed('lat' + lat); k.line([[X0, Y(lat)], [X0 + MW, Y(lat)]], .35, k.dim) }
      k.pop()

      // step 4 swaps the MAX for the MAX 2
      const swap = i >= 4 ? (k.thumb ? 1 : k.ease(k.p(4, 1.2))) : 0
      const maxA = 1 - swap
      const colA = k.tone('a'), colB = k.tone('b')
      MAXR.forEach((v, j) => {
        const st = v.lens === 0 ? 1 : 2, jj = j % 5
        if (i < st) return
        const a = k.thumb || i > st ? 1 : k.easeOut(k.p(st, .55, .15 + jj * .45))
        paint(v.runs, v.lens === 0 ? colA : colB, .34 * a * maxA)
        if (a > 0 && maxA > 0) { const [lo, la] = v.c; k.flat(k.circle(X(lo), Y(la), 6 * a, 12), k.ink, .8 * maxA) }
      })
      if (i >= 3) {
        const oa = k.thumb || i > 3 ? 1 : k.easeOut(k.p(3, .7, .2))
        paint(OVER, k.P.hi, .85 * oa * maxA)
      }
      if (swap > 0) {
        CORR.forEach((v, j) => {
          const a = k.thumb ? 1 : k.easeOut(k.p(4, .5, .9 + j * .3))
          paint(v.runs, k.mix(k.P.a, k.P.b, .5), .3 * a)
          if (a > 0) { const [lo, la] = v.c; k.flat(k.circle(X(lo), Y(la), 6 * a, 12), k.ink, .8 * a) }
        })
        const ha = k.thumb ? 1 : k.easeOut(k.p(4, .6, 3))
        paint(HOLES, k.P.hi, ha)
      }

      // the seam between the two lenses of a MAX
      if (maxA > 0 && fk > 0) {
        k.push(); k.alpha(fk * maxA)
        for (const lon of [-90, 90]) { k.seed('seam' + lon); k.line([[X(lon), Y0 - 8], [X(lon), Y0 + MH + 8]], 1.1, k.P.hi, { dash: [12, 9] }) }
        if (p.seam) k.text(p.seam, X(90) + 12, Y0 - 16, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: k.P.hi })
        if (i >= 1 && p.front) k.text(p.front, X(0), Y0 + MH + 40, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, align: 'center', col: k.dim })
        if (i >= 2 && p.back) k.text(p.back, X(-180) + 10, Y0 + MH + 40, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: k.dim })
        k.pop()
      }
      k.seed('frame'); k.line(k.rect(X0, Y0, MW, MH), .7, k.ink, { closed: true })

      // what this step means, under the map
      const lg = legend[Math.min(i, legend.length - 1)]
      if (lg) {
        const la = k.thumb ? 1 : k.easeOut(k.p(k.step, .5, .3))
        k.text(lg, X0, Y0 + MH + 100, { role: 'body', size: 32, min: 16, maxW: MW, lines: 2, alpha: la })
      }

      const pc = i === 1 ? MAXR[0].c : i === 2 ? MAXR[5].c : i === 3 ? [90, 0] : i >= 4 ? [90, 20] : [90, 0]
      k.point = [X(pc[0]), Y(pc[1])]
      k.mood = i === 3 ? 'surprised' : i === 4 ? 'thinking' : 'neutral'
    },
  }
})())
