// leapquant / leap
//
// Why rounding every token freezes a slowly decaying state, and why rounding
// once per window does not. One state entry over 48 tokens, drawn against the
// stored format's grid of levels (faint horizontal lines). Step 0: the exact
// trajectory, a gentle decay with small writes. Step 1: the same entry stored
// and re-rounded after every token: each change is less than half a level, so
// it rounds back to where it was and the stored value never moves (a tick
// under every token for every rounding). Step 2: stored once per 16 tokens,
// with the updates applied exactly in between: the value leaps along dotted
// arcs and lands on the level nearest the exact curve, three roundings. Step
// 3: the gap at the end, per-token against per-window. The trajectory is a toy
// (geometry only; no number is drawn), so the runtime stamps it Illustrative.
//
// steps: 0 exact · 1 rounded every token · 2 rounded once per window · 3 the gap
// params: { exact, perToken, perWindow, grid, legend: [4 strings] }
BESPOKE.define((() => {
  const N = 48, WIN = 16
  // toy trajectory in units of one grid level: decay 0.985 per token plus a small write
  const ex = [10.4]
  const wob = [0.05, -0.03, 0.02, 0.04, -0.05, 0.01, 0.03, -0.02]
  for (let t = 1; t <= N; t++) ex.push(ex[t - 1] * 0.985 + wob[t % wob.length])
  // rounded every token: from the stored value, step, round
  const pt = [Math.round(ex[0])]
  for (let t = 1; t <= N; t++) pt.push(Math.round(pt[t - 1] * 0.985 + wob[t % wob.length]))
  // rounded once per window: exact updates from the stored boundary value, round at the boundary
  const pw = [Math.round(ex[0])]
  let w = pw[0]
  for (let t = 1; t <= N; t++) {
    w = w * 0.985 + wob[t % wob.length]
    if (t % WIN === 0) w = Math.round(w)
    pw.push(w)
  }
  const VMIN = 3.5, VMAX = 11.5

  return {
    stampAt: k => [1250, Math.max(k.top + 20, 250)],
    plan: () => ({
      min: [4, 4.6, 4.8, 4],
      events: [
        { step: 0, at: .2, type: 'draw' },
        { step: 1, at: .3, type: 'ticks', n: 16, span: 1.8 },
        { step: 2, at: .3, type: 'whoosh' },
        { step: 2, at: 1.2, type: 'ding' },
        { step: 3, at: .4, type: 'thunk' },
      ],
      motion: [{ step: 0, from: 0, to: 2.2 }, { step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 2.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 90, 300), Y1 = 750, X0 = 190, X1 = 1300
      const xOf = t => X0 + (t / N) * (X1 - X0)
      const yOf = v => Y1 - ((v - VMIN) / (VMAX - VMIN)) * (Y1 - Y0)

      // the grid of stored levels
      for (let v = 4; v <= 11; v++) {
        k.seed('lv' + v); k.line([[X0 - 20, yOf(v)], [X1 + 10, yOf(v)]], .45, k.mix(k.paper, k.ink, .28))
      }
      // the key: one swatch and label per series, each arriving on its step
      let kx = X0 - 20
      const key = (str, col, sw, a) => {
        if (!str || a <= 0) return
        const ky = Y0 - 56
        k.push(); k.alpha(a)
        k.seed('key' + str.length); k.line([[kx, ky], [kx + 40, ky]], sw, col)
        const m = k.text(str, kx + 52, ky + 8, { role: 'label', size: 22, min: 12, maxW: 290, lines: 1, col })
        k.pop()
        kx += 52 + m.w + 36
      }
      key(p.grid, k.mix(k.paper, k.ink, .4), .6, 1)
      key(p.exact, k.ink, 1.6, i > 0 || k.thumb ? 1 : k.p(0, .6, 1.8))
      key(p.perToken, k.P.b, 2.2, i >= 1 ? (k.thumb ? 1 : k.p(1, .6, 1.6)) : 0)
      key(p.perWindow, k.P.a, 1.6, i >= 2 ? (k.thumb ? 1 : k.p(2, .6, 1.8)) : 0)
      // token axis
      k.seed('axis'); k.line([[X0, Y1 + 40], [X1, Y1 + 40]], .8, k.ink)
      for (let t = WIN; t < N; t += WIN) { k.seed('wb' + t); k.line([[xOf(t), Y0 - 6], [xOf(t), Y1 + 40]], .5, k.mix(k.paper, k.P.hi, .55), { dash: [8, 10] }) }

      // exact trajectory
      const ek = i > 0 || k.thumb ? 1 : k.ease(k.p(0, 2, .2))
      const exPts = ex.map((v, t) => [xOf(t), yOf(v)])
      if (ek > .02) { k.seed('exact'); k.line(k.partial(exPts, ek), 1.6, k.ink) }

      // rounded every token: a flat staircase, a rounding tick under every token
      if (i >= 1) {
        const pk = i > 1 || k.thumb ? 1 : k.easeOut(k.p(1, 2, .2))
        const stair = []
        for (let t = 0; t <= N; t++) { stair.push([xOf(t), yOf(pt[t])]); if (t < N) stair.push([xOf(t + 1), yOf(pt[t])]) }
        if (pk > .02) { k.seed('pt'); k.line(k.partial(stair, pk), 2.2, k.P.b) }
        const nt = Math.floor(pk * N)
        for (let t = 1; t <= nt; t++) k.flat(k.rect(xOf(t) - 2, Y1 + 48, 4, 16), k.P.b, .9)
      }

      // rounded once per window: leaps along dotted arcs, three roundings
      if (i >= 2) {
        const wk = i > 2 || k.thumb ? 1 : k.ease(k.p(2, 2.2, .2))
        for (let s = 0; s < N / WIN; s++) {
          const a = s * WIN, b = a + WIN
          const seg = Math.max(0, Math.min(1, wk * (N / WIN) - s))
          if (seg <= .02) continue
          const xa = xOf(a), xb = xOf(b), ya = yOf(pw[a]), yb = yOf(pw[b])
          const arc = []
          for (let q = 0; q <= 20; q++) { const u = q / 20; arc.push([xa + (xb - xa) * u, ya + (yb - ya) * u - 70 * 4 * u * (1 - u)]) }
          k.seed('arc' + s); k.line(k.partial(arc, seg), 1.4, k.P.a, { dash: [6, 9] })
          if (seg > .98) {
            k.seed('dot' + s); k.shape(k.circle(xb, yb, 11), { fill: k.P.a, op: 1, sw: .8 })
            k.flat(k.rect(xb - 3, Y1 + 72, 6, 22), k.P.a, 1)
          }
        }
        k.seed('dot0'); k.shape(k.circle(xOf(0), yOf(pw[0]), 11), { fill: k.P.a, op: 1, sw: .8 })
      }

      // the gap at the end
      if (i >= 3) {
        const gk = k.thumb ? 1 : k.easeOut(k.p(3, .8, .2))
        const x = xOf(N) - 26
        if (gk > .02) { k.seed('gap'); k.arrow([[x, yOf(pt[N]) + 8], [x, yOf(ex[N]) - 8]], k.P.hi, 1.4, gk) }
        k.hl(x - 18, Math.min(yOf(pt[N]), yOf(ex[N])) - 6, 36, Math.abs(yOf(pt[N]) - yOf(ex[N])) + 12, k.P.hi, gk)
      }

      if (p.legend && p.legend[i]) k.text(p.legend[i], X0, Y1 + 118, { role: 'head', size: 30, min: 16, maxW: 1150, lines: 1 })
      k.point = i === 1 ? [xOf(30), yOf(pt[30])] : i === 2 ? [xOf(32), yOf(pw[32])] : i === 3 ? [xOf(N), yOf(ex[N])] : [xOf(20), yOf(ex[20])]
      k.mood = i === 1 ? 'surprised' : i === 3 ? 'proud' : 'thinking'
    },
  }
})())
