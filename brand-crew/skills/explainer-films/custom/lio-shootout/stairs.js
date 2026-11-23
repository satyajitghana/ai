// lio-shootout / stairs
//
// The stair sequence as a race. The track is the walk's height over time, drawn as a profile: a
// landing, a stairwell down, the gallery, a stairwell back up (the shape of the Hilti exp16 reference,
// simplified to straight runs; it is a picture of the route, not the data, so the runtime stamps it
// Illustrative). One runner per system rides the profile from left to right. A runner whose row the
// article reports as diverged leaves the track inside the stairwell where its trajectory left the
// reference and flies off upward as a streak; a runner that finished reaches the end and shows its
// error. Every label drawn is a string from params.
//
// steps: 0 the track · 1 runners set off, the first stairwell takes three · 2 the second stairwell
//        takes one more · 3 who reached the end
// params: { stations: [4 strings under the track], runners: [{ label, fate: 'finish'|'first'|'second', result }] }
BESPOKE.define((() => {
  // the profile in unit coordinates (x 0..1 time, y 0..1 height, 1 = top), straight segments
  const TRACK = [[0, .92], [.1, .92], [.3, .18], [.68, .18], [.72, .16], [.9, .9], [1, .9]]
  const STAIR1 = [.12, .28]   // where in x the first stairwell is (failures break inside it)
  const STAIR2 = [.73, .88]
  const yAt = x => {
    for (let i = 1; i < TRACK.length; i++) {
      const [x0, y0] = TRACK[i - 1], [x1, y1] = TRACK[i]
      if (x <= x1) return y0 + (y1 - y0) * (x - x0) / Math.max(1e-6, x1 - x0)
    }
    return TRACK[TRACK.length - 1][1]
  }
  return {
    stampAt: k => [1220, k.top + 16],
    plan: () => ({
      min: [3.6, 5.6, 4.6, 4.4],
      events: [{ step: 1, at: .4, type: 'whoosh' }, { step: 2, at: 1.2, type: 'whoosh' }, { step: 3, at: .5, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 150, W = 1150, Y0 = Math.max(k.top + 120, 290), H = 380
      const X = u => X0 + u * W, Y = v => Y0 + (1 - v) * H
      const pts = TRACK.map(([u, v]) => [X(u), Y(v)])
      // the track draws itself in step 0
      const tr = k.thumb ? 1 : st > 0 ? 1 : k.easeOut(k.p(0, 2.4, .2))
      k.seed('track'); k.line(k.partial(pts, tr), 5, k.ink)
      // stairwell bands
      ;[STAIR1, STAIR2].forEach((s, i) => {
        const a = k.thumb ? .5 : st === 0 ? .5 * k.easeOut(k.p(0, .8, 1.6 + .4 * i)) : .5
        k.push(); k.alpha(a); k.seed('band' + i)
        k.shape(k.rect(X(s[0]), Y0 - 30, X(s[1]) - X(s[0]), H + 60), { fill: k.P.light, op: .5, sw: 0, ink: k.P.light })
        k.pop()
      })
      ;(p.stations || []).forEach((s, i) => {
        const u = [.05, .2, .5, .8][i]
        k.text(s, X(u), Y0 + H + 70, { role: 'mono', size: 22, min: 12, maxW: 260, lines: 2, align: 'center', col: k.dim })
      })
      // runners: progress u along x by step; a broken runner stops in its stairwell and streaks off
      const runners = p.runners || []
      const lane = (i) => (i - (runners.length - 1) / 2) * 16
      runners.forEach((r, i) => {
        const brk = r.fate === 'first' ? STAIR1[0] + (STAIR1[1] - STAIR1[0]) * (.35 + .15 * (i % 3))
          : r.fate === 'second' ? STAIR2[0] + (STAIR2[1] - STAIR2[0]) * .45 : 2
        let u
        if (k.thumb) u = Math.min(1, brk)
        else if (st === 0) u = -1
        else if (st === 1) u = k.ease(k.clamp(k.since(1) / 4.2, 0, 1)) * .6
        else if (st === 2) u = .6 + k.ease(k.clamp(k.since(2) / 3.4, 0, 1)) * .4
        else u = 1
        if (u < 0) return
        const col = r.fate === 'finish' ? k.P.a : k.P.b
        const at = Math.min(u, brk)
        const px = X(at), py = Y(yAt(at)) + lane(i)
        if (u > brk) {      // flew off: a streak from the break point up and to the right
          const fly = k.clamp((u - brk) / .25, 0, 1)
          const ex = px + 260 * fly, ey = py - 300 * fly
          k.seed('fly' + i); k.line([[px, py], [ex, ey]], 2.2, col)
          k.flat(k.circle(ex, ey, 7), col, .9)
          if (fly > .5) k.text(r.result, ex + 12, ey - 6, { role: 'mono', size: 20, min: 11, maxW: 230, lines: 1, col, alpha: k.clamp((fly - .5) * 2, 0, 1) })
        } else {
          k.flat(k.circle(px, py, 9), col, 1)
        }
        if (r.fate === 'finish' && u >= 1) {
          k.text(r.result, X(1) + 18, Y(yAt(1)) + lane(i) + 6, { role: 'mono', size: 20, min: 11, maxW: 220, lines: 1, col })
        }
        if (st === 1 && i < 6 && k.since(1) < 1.6) k.text(r.label, X(0) - 10, Y(yAt(0)) + lane(i) - 2, { role: 'mono', size: 18, min: 10, maxW: 200, lines: 1, align: 'right', col: k.dim })
      })
      // legend of names once they are running
      if (st >= 1) {
        runners.forEach((r, i) => {
          const col = r.fate === 'finish' ? k.P.a : k.P.b
          k.text(r.label, X0 + 30 + (i % 3) * 300, Y0 - 86 + Math.floor(i / 3) * 30,
            { role: 'mono', size: 20, min: 11, maxW: 280, lines: 1, col })
        })
      }
      const head = st === 3 ? X(1) : st === 2 ? X((STAIR2[0] + STAIR2[1]) / 2) : X((STAIR1[0] + STAIR1[1]) / 2)
      k.point = [head, Y(.5)]
      k.mood = st === 3 ? 'proud' : st >= 1 ? 'surprised' : 'thinking'
    },
  }
})())
