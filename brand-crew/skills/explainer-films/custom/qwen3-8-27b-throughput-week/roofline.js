// qwen3-8-27b-throughput-week / roofline
//
// The article's BatchRoofline widget, as a picture. Left: the ceiling for one
// RTX 3090 with plain batching, on log axes, from the widget's own 3090
// preset (16 GB of weights at 79% of 936 GB/s, 72 MiB of FP16 state and 640
// tokens of FP8 KV per stream, 51.2 GFLOP a row at 63 TFLOP/s). Right: one
// decode step. Streams join one at a time (a 16x4 grid of slots fills); the
// weight read is a fixed bar, each stream adds a sliver of state and KV
// traffic, and the math bar grows by a row per stream. The total climbs and
// the per-stream line sags until the math bar passes the memory bar (the
// mid-30s) and the total flattens. Then the week's claims land at their stream
// counts, each point labelled by its value, and the right-hand panel turns
// into their key: HyperQwen's 1,035 at 64 streams just under the line, the
// eight-lane 5090 runs (764, 1,099 average, 1,623 best second) above it,
// because they also draft. Last, the best second is bracketed against the
// run it came from. The curve is the model, not a measurement, so the runtime
// stamps the scene Illustrative; every label drawn is a storyboard string.
//
// Layout is measured, not assumed: pixel's type is twice as wide as most, so
// every label is sized with k.measure and stacked by the heights it returns.
//
// steps: 0 one stream · 1 streams 1→8, one at a time · 2 streams 8→64, compute
//        catches memory · 3 the claims land · 4 best second against the run
// params: { ceiling, xLabel, yLabel, ticks: [7 strings for 1..64], yTicks: [{v, label}],
//           total, per, streams: [[B, label]], weights, state, math, bend,
//           claims: [{b, v, value, label, sub?}] (top to bottom), best }
BESPOKE.define((() => {
  // the widget's 3090 preset, in milliseconds per decode step
  const MIB = 1048576, BWE = .79 * 936e9
  const T_W = 16e9 / BWE * 1e3                                   // weights, once a step
  const T_S = (2 * 72 * MIB + 640 * 32 * 1024) / BWE * 1e3      // state read+write and KV, per stream
  const T_C = 51.2e9 / 63e12 * 1e3                               // math, per stream
  const tMem = b => T_W + T_S * b, tCmp = b => T_C * b
  const agg = b => b * 1e3 / Math.max(tMem(b), tCmp(b))
  const per = b => agg(b) / b
  const BEND = T_W / (T_C - T_S)
  const B_MAX = 64, Y_LO = 15, Y_HI = 4000
  const L2 = Math.log2, L10 = Math.log10
  const X0 = 300, X1 = 880, PX = 1010, PW = 360

  const T_CEIL = { role: 'head', size: 28, min: 15, maxW: X1 - X0 + 170, lines: 2, lh: 1.1 }
  const T_YL = { role: 'label', size: 24, min: 12, maxW: X1 - X0 + 170, lines: 1 }
  const T_XL = { role: 'label', size: 26, min: 14, maxW: X1 - X0 + 40, lines: 2, lh: 1.1 }

  // the plot's frame, from the heights its labels actually take
  function frame(k) {
    const p = k.params, top = k.top + 6
    const hc = p.ceiling ? k.measure(p.ceiling, T_CEIL).h : 0
    const hy = p.yLabel ? k.measure(p.yLabel, T_YL).h : 0
    const hx = p.xLabel ? k.measure(p.xLabel, T_XL).h : 0
    const Y0 = top + hc + hy + 40, Y1 = Math.min(860, 930 - 44 - hx)
    const X = b => X0 + L2(b) / L2(B_MAX) * (X1 - X0)
    const Y = v => Y1 - (L10(v) - L10(Y_LO)) / (L10(Y_HI) - L10(Y_LO)) * (Y1 - Y0)
    return { top, hc, hy, Y0, Y1, X, Y }
  }

  // streams in the step at scene time: 1, then one at a time to 8, then on to 64
  function streams(k) {
    if (k.thumb) return B_MAX
    if (k.step === 0) return 1
    if (k.step === 1) return 1 + Math.min(7, Math.floor(k.p(1, 4, .3) * 7.999))
    if (k.step === 2) return 8 * Math.pow(8, k.ease(k.p(2, 4.2, .3)))
    return B_MAX
  }

  return {
    // in the empty band between the two curves, right of the middle
    // in the empty band between the two curves; pixel's plot is too short for
    // its wide stamp, so there it sits right of the heading's second line
    stampAt: k => { if (k.pixel) return [1010, k.top - 64]; const f = frame(k); return [f.X(20), f.Y(110)] },
    plan: () => ({
      min: [3.4, 5, 5.2, 4.4, 3.6],
      events: [{ step: 0, at: .2, type: 'draw' }, { step: 1, at: .3, type: 'ticks', n: 7, span: 4 },
        { step: 2, at: .3, type: 'grow' }, { step: 2, at: 3.2, type: 'thunk' },
        { step: 3, at: .3, type: 'pop' }, { step: 3, at: 1.1, type: 'pop' }, { step: 4, at: .3, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 1.4 }, { step: 1, from: 0, to: 4.6 }, { step: 2, from: 0, to: 4.8 }, { step: 3, from: 0, to: 2.2 }, { step: 4, from: 0, to: 1.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, B = streams(k), f = frame(k), { X, Y, Y0, Y1 } = f
      // a dashed stroke, cut from the path (the style's line has no dashes)
      const dashed = (pts, sw, col, on, off) => {
        const L = k.lenOf(pts); if (L < 1) return
        for (let d = 0; d < L; d += on + off) { const q = []; for (let e = d; e <= Math.min(L, d + on); e += 4) q.push(k.along(pts, e)); if (q.length > 1) k.line(q, sw, col) }
      }

      // ---- the plot -------------------------------------------------------
      const ak = k.thumb ? 1 : k.easeOut(k.span(0, .7))
      k.push(); k.alpha(ak)
      if (p.ceiling) k.text(p.ceiling, X0 - 170, f.top + k.measure(p.ceiling, T_CEIL).px, { ...T_CEIL, col: k.dim })
      if (p.yLabel) k.text(p.yLabel, X0 - 170, f.top + f.hc + k.measure(p.yLabel, T_YL).px + 4, { ...T_YL, col: k.dim })
      k.seed('ax'); k.line([[X0, Y0 - 10], [X0, Y1], [X1 + 20, Y1]], .9, k.ink)
      ;(p.yTicks || []).forEach((t, j) => {
        const y = Y(t.v)
        k.seed('gy' + j); k.line([[X0, y], [X1, y]], .3, k.dim)
        k.text(t.label, X0 - 16, y + 9, { role: 'mono', size: 24, min: 12, maxW: 170, align: 'right', col: k.dim })
      })
      ;(p.ticks || []).forEach((t, j) => {
        const x = X(Math.pow(2, j))
        k.seed('tx' + j); k.line([[x, Y1], [x, Y1 + 10]], .6, k.ink)
        k.text(t, x, Y1 + 40, { role: 'mono', size: 24, min: 12, maxW: 90, align: 'center', col: k.dim })
      })
      if (p.xLabel) k.text(p.xLabel, (X0 + X1) / 2, Y1 + 44 + k.measure(p.xLabel, T_XL).px, { ...T_XL, align: 'center', col: k.dim })
      k.pop()

      // the two curves, drawn as far as the batch has grown
      const pts = fn => { const out = []; const n = 48; for (let j = 0; j <= n; j++) { const b = Math.pow(B, j / n); out.push([X(b), Y(fn(b))]) } return out }
      if (B > 1.01) {
        k.seed('agg'); k.line(pts(agg), 1.5, k.P.a)
        k.seed('per'); dashed(pts(per), 1.2, k.P.b, 18, 10)
      }
      const dk = k.thumb ? 1 : k.backOut(k.span(.4, .9))
      if (dk > 0) {
        k.seed('da'); k.shape(k.circle(X(B), Y(agg(B)), 11 * dk, 16), { fill: k.P.a, op: 1, sw: .7 })
        k.seed('dp'); k.shape(k.circle(X(B), Y(per(B)), 9 * dk, 16), { fill: k.P.b, op: 1, sw: .7 })
      }
      // curve names, pinned to the curves' early stretch, which nothing else uses
      const LB = 2.6, nk = k.thumb ? 1 : i >= 2 ? 1 : i === 1 ? k.p(1, .6, 1.4) : 0
      if (nk > 0 && B >= LB) {
        if (p.total) k.text(p.total, X(LB) - 12, Y(agg(LB)) - 20, { role: 'label', size: 26, min: 14, maxW: 220, align: 'right', col: k.P.a, alpha: nk })
        if (p.per) {
          const PL = { role: 'label', size: 26, min: 14, maxW: 460, lines: 1, align: 'center', col: k.P.b, alpha: nk }
          k.text(p.per, Math.max(X(LB) + 30, X0 + 14 + k.measure(p.per, PL).w / 2), Y(per(LB)) + 42, PL)
        }
      }
      // the bend, marked while the batch passes it
      const bk = i === 2 && !k.thumb && B >= BEND ? k.easeOut(k.p(2, .6, 2.9)) : 0
      if (bk > 0) { k.seed('bend'); dashed(k.partial([[X(BEND), Y1], [X(BEND), Y(agg(BEND)) + 26]], bk), .8, k.P.hi, 10, 8) }

      // the claims: each lands at its stream count, labelled by its value
      const cl = p.claims || []
      const lane = cl.filter(c => c.b < B_MAX)
      const cIn = j => (k.thumb ? 1 : i < 3 ? 0 : k.backOut(k.p(3, .5, j === cl.length - 1 ? .2 : .9 + j * .22)))
      // the eight-lane values sit 0.16 decades apart: spread them to their own
      // height where a style's type is taller than that, on short leaders
      const VL = { role: 'head', size: 26, min: 13 }
      const vy = new Map()
      if (lane.length) {
        const g = k.measure(lane[0].value, VL).h * .92
        const want = lane.map(c => Y(c.v) + 9), got = want.slice()
        for (let j = 1; j < got.length; j++) got[j] = Math.max(got[j], got[j - 1] + g)
        const shift = (want.reduce((a, b) => a + b) - got.reduce((a, b) => a + b)) / got.length
        lane.forEach((c, j) => vy.set(c, got[j] + shift))
      }
      if (i >= 3) {
        cl.forEach((c, j) => {
          const ck = cIn(j); if (ck <= 0) return
          const x = X(c.b), y = Y(c.v), best = i >= 4 && c === lane[0], lk = Math.min(1, ck)
          k.seed('c' + j); k.shape(k.circle(x, y, 13 * ck, 16), { fill: best ? k.paper : k.P.hi, op: 1, sw: 1.1 })
          if (c.b >= B_MAX) {
            // just under the line at the right edge: the value hangs below on a short leader
            k.seed('lead' + j); k.line(k.partial([[x, y + 18], [x, y + 44]], lk), .6, k.dim)
            k.text(c.value, x, y + 50 + k.measure(c.value, { role: 'head', size: 28, min: 15 }).px, { role: 'head', size: 28, min: 15, maxW: 200, align: 'center', alpha: lk })
          } else {
            const ly = vy.get(c), lx = x - 46
            if (Math.abs(ly - 9 - y) > 3) { k.seed('vl' + j); k.line([[lx + 6, ly - 9], [x - 16, y]], .5, k.dim) }
            // a patch of paper under the value, so the 1,000 gridline does not strike through it
            const vm = k.measure(c.value, { ...VL, maxW: lx - X0 - 10 })
            k.flat(k.rect(lx - vm.w - 6, ly - vm.px * .85, vm.w + 12, vm.px * 1.05), k.paper, .9 * lk)
            k.text(c.value, lx, ly, { ...VL, maxW: lx - X0 - 10, align: 'right', alpha: lk, col: best ? k.dim : k.ink })
          }
        })
        // the best second against the run it came from
        if (i >= 4 && lane.length >= 2) {
          const x = X(8) + 30, rk = k.thumb ? 1 : k.easeOut(k.p(4, .6, .2))
          k.seed('br'); k.line(k.partial([[x, Y(lane[0].v)], [x + 16, Y(lane[0].v)], [x + 16, Y(lane[1].v)], [x, Y(lane[1].v)]], rk), 1.1, k.P.hi)
        }
      }

      // ---- the right-hand panel: one decode step, then the claims' key ----
      const swap = k.thumb ? 1 : i < 3 ? 0 : k.ease(k.p(3, .6, 0))
      const T0 = k.top + 6
      if (swap < 1) {
        k.push(); k.alpha(1 - swap)
        let y = T0
        const LB2 = { role: 'label', size: 24, min: 12, maxW: PW, lines: 3, lh: 1.1 }
        const LM = { role: 'mono', size: 22, min: 11, maxW: PW, lines: 2, lh: 1.05 }
        const LH = { role: 'head', size: 34, min: 18, maxW: PW, lines: 1 }
        // what the panel needs, top to bottom; a style with wide type drops the state
        // caption first, then folds the slots into two rows
        const hOf = (str, o) => (str ? k.measure(str, o).h : 0)
        const need = rows => hOf('64 streams', LH) + 14 + rows * 22.5 + 34 + hOf(p.weights, LB2) + 8 + 36 + 10 + hOf(p.math, LB2) + 8 + 36 + 10 + hOf(p.bend, LB2)
        const room = 935 - T0
        const showState = need(4) + hOf(p.state, LM) + 22 <= room
        const ROWS = showState || need(4) <= room ? 4 : 2
        const nB = Math.floor(B + 1e-6), lab = (p.streams || []).filter(s => s[0] <= nB).pop()
        if (lab) k.text(lab[1], PX, y + k.measure(lab[1], LH).px, LH)
        y += k.measure('64 streams', LH).h + 14
        // the batch: 64 slots, filled as streams join
        const PER_ROW = 64 / ROWS, G = ROWS === 4 ? 4.5 : 2.5, C = PW / PER_ROW - G
        for (let j = 0; j < 64; j++) {
          const cx = PX + (j % PER_ROW) * (C + G), cy = y + Math.floor(j / PER_ROW) * (C + G)
          if (j < nB) { k.flat(k.rrect(cx, cy, C, C, 4), k.P.b, 1); k.seed('s' + j); k.line(k.rrect(cx, cy, C, C, 4), .45, k.ink, { closed: true }) }
          else { k.seed('o' + j); k.line(k.rrect(cx, cy, C, C, 4), .3, k.mix(k.dim, k.paper, .4), { closed: true }) }
        }
        const lastJ = Math.max(0, nB - 1), slot = [PX + (lastJ % PER_ROW) * (C + G) + C / 2, y + Math.floor(lastJ / PER_ROW) * (C + G)]
        y += ROWS * (C + G) + 34
        // memory traffic: weights, then state and KV per stream
        const SC = PW / (tCmp(B_MAX) + 1), H = 36
        const wW = T_W * SC, wS = T_S * B * SC, wC = tCmp(B) * SC
        if (p.weights) { const m = k.measure(p.weights, LB2); k.text(p.weights, PX, y + m.px, { ...LB2, col: k.P.a }); y += m.h + 8 }
        const yM = y
        k.seed('bw'); k.shape(k.rect(PX, yM, wW, H), { fill: k.P.a, op: 1, sw: .8 })
        if (wS > 1) { k.seed('bs'); k.shape(k.rect(PX + wW, yM, wS, H), { fill: k.tone('b'), op: .85, sw: .6 }) }
        y += H + 10
        if (p.state && showState) { const m = k.measure(p.state, LM); if (i >= 1 || k.thumb) k.text(p.state, PX, y + m.px, { ...LM, col: k.dim, alpha: k.thumb ? 1 : i > 1 ? 1 : k.p(1, .5, .6) }); y += m.h + 22 }
        if (p.math) { const m = k.measure(p.math, LB2); k.text(p.math, PX, y + m.px, { ...LB2, col: k.P.hi }); y += m.h + 8 }
        const yC = y
        k.seed('bc'); k.shape(k.rect(PX, yC, Math.max(3, wC), H), { fill: k.P.hi, op: 1, sw: .8 })
        y += H + 10
        // the memory bar's end, carried down: the math bar passing it is the bend
        const mx = PX + wW + wS
        k.seed('mend'); dashed([[mx, yM - 4], [mx, yC + H + 6]], .6, k.dim, 8, 8)
        if (p.bend && i === 2 && B >= BEND && y + k.measure(p.bend, LB2).h <= 935) { const m = k.measure(p.bend, LB2); k.text(p.bend, PX, y + m.px, { ...LB2, alpha: k.easeOut(k.p(2, .6, 2.9)) }) }
        k.pop()
        if (i === 0) k.point = [PX + wW, yM + H / 2]
        else if (i === 1) k.point = slot
        else if (i === 2) k.point = [PX + wC, yC + H / 2]
      }
      if (swap > 0) {
        // the key: value over what it is, top to bottom as the points sit
        k.push(); k.alpha(swap)
        const KV = { role: 'head', size: 34, min: 16, maxW: PW, lines: 1 }
        const KL = { role: 'body', size: 26, min: 13, maxW: PW, lines: 2, lh: 1.1 }
        const KS = { role: 'mono', size: 22, min: 11, maxW: PW, lines: 2, lh: 1.05 }
        let y = T0
        const entry = (c, sub) => k.measure(c.value, KV).h + 2 + (c.label ? k.measure(c.label, KL).h : 0) + (sub && c.sub ? k.measure(c.sub, KS).h : 0) + 18
        const extra = p.best ? k.measure(p.best, KL).h : 0
        const subs = cl.reduce((a, c) => a + entry(c, true), extra) <= 935 - T0
        // tighter still: the best second's caption takes its label's place instead of adding a line
        const inPlace = !subs && cl.reduce((a, c) => a + entry(c, false), extra) > 935 - T0
        cl.forEach((c, j) => {
          const lk = Math.min(1, cIn(j)), best = i >= 4 && c === lane[0]
          const mv = k.measure(c.value, KV)
          if (lk > 0) { k.seed('key' + j); k.shape(k.circle(PX + 12, y + mv.px * .62, 10, 14), { fill: best ? k.paper : k.P.hi, op: lk, sw: .8 }) }
          k.text(c.value, PX + 34, y + mv.px, { ...KV, maxW: PW - 34, alpha: lk })
          y += mv.h + 2
          if (best && p.best && inPlace) { const m = k.measure(p.best, KL); k.text(p.best, PX, y + m.px, { ...KL, col: k.P.hi }); y += m.h }
          else if (c.label) { const m = k.measure(c.label, KL); k.text(c.label, PX, y + m.px, { ...KL, alpha: lk }); y += m.h }
          if (best && p.best && !inPlace) { const m = k.measure(p.best, KL); k.text(p.best, PX, y + m.px, { ...KL, col: k.P.hi, alpha: k.thumb ? 1 : k.p(4, .5, .6) }); y += m.h }
          if (c.sub && subs) { const m = k.measure(c.sub, KS); k.text(c.sub, PX, y + m.px, { ...KS, col: k.dim, alpha: lk }); y += m.h }
          y += 18
        })
        k.pop()
      }

      // ---- the host -------------------------------------------------------
      if (i === 3) k.point = [X(64), Y(1035)]
      else if (i >= 4) k.point = [X(8) + 46, Y(1300)]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : i === 4 ? 'proud' : 'neutral'
    },
  }
})())
