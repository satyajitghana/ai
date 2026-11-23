// avm-autoregressive-view-model / pool
//
// The article's ContextPool widget, as a moving picture. Seen from above, a
// camera trucks along a room facing the far wall, out to the right and back
// to the left, the paper's out-and-back revisit. Every view it makes drops
// into the pool as a dot where it stood. On the way back the scene shows what
// each part of the context brings: the motion window (the model's own last
// few frames), then pose retrieval, which fetches the views taken at this spot
// on the way out, and the sink (the prefill image). Points of the far wall in
// the target's view fill in when an older view saw them too. A geometric toy,
// stamped Illustrative; every label is a storyboard string.
//
// steps: 0 the walk fills the pool · 1 the motion window · 2 retrieval and the sink
// params: { pool, motion, cover, sink, wall }
BESPOKE.define((() => {
  const OUT = 48, N = 96, HALF = 32 * Math.PI / 180, UP = -Math.PI / 2
  const pose = i => i < OUT
    ? { x: .2 + (i / (OUT - 1)) * 1.0, y: .72, th: UP }
    : { x: 1.2 - ((i - OUT) / (N - OUT - 1)) * 1.0, y: .8, th: UP }
  const P = Array.from({ length: N }, (_, i) => pose(i))
  const T = 80, MOT = 8, WALL = .12
  const sees = (v, px, py) => {
    const dx = px - v.x, dy = py - v.y, d = Math.hypot(dx, dy)
    if (d < .01 || d > 1) return false
    let da = Math.atan2(dy, dx) - v.th
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    return Math.abs(da) <= HALF
  }
  // anchor points on the far wall inside the target's view
  const q = P[T], anchors = []
  for (let a = 0; a < 9; a++) {
    const ang = q.th - HALF + 2 * HALF * a / 8
    const t = (WALL - q.y) / Math.sin(ang)
    anchors.push([q.x + t * Math.cos(ang), WALL])
  }
  // greedy coverage over the pool (views older than the motion window), budget three
  const pool = []; for (let i = 1; i < T - MOT; i++) pool.push(i)
  const cover = [], got = anchors.map(() => false)
  for (let n = 0; n < 3; n++) {
    let best = -1, gain = 0
    pool.forEach(i => {
      if (cover.includes(i) || Math.hypot(P[i].x - q.x, P[i].y - q.y) > .3) return
      let g = 0; anchors.forEach(([px, py], k) => { if (!got[k] && sees(P[i], px, py)) g++ })
      if (g > gain) { gain = g; best = i }
    })
    if (best < 0) break
    cover.push(best); anchors.forEach(([px, py], k) => { if (sees(P[best], px, py)) got[k] = true })
  }

  return {
    stampAt: k => [880, Math.max(k.top + 40, 250) + 610],
    plan: () => ({
      min: [6.2, 4.2, 6.0],
      events: [{ step: 0, at: .3, type: 'ticks', n: 20, span: 5.4 }, { step: 1, at: .3, type: 'pop' },
        { step: 2, at: .4, type: 'ticks', n: 4, span: 1.2 }, { step: 2, at: 2.4, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 6 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const U = 600, X0 = 140, Y0 = Math.max(k.top + 40, 250)
      const X = v => [X0 + v[0] * U, Y0 + v[1] * U]
      const walk = k.thumb ? 1 : st > 0 ? 1 : k.ease(k.p(0, 5.8, .2))
      const cur = Math.max(1, Math.min(T, Math.round(walk * T)))
      const cone = (v, col, op, key) => {
        const pts = [X([v.x, v.y])]
        for (const a of [v.th - HALF, v.th + HALF]) { const t = (WALL - v.y) / Math.sin(a); pts.push(X([Math.min(1.36, Math.max(.04, v.x + t * Math.cos(a))), WALL])) }
        k.seed(key); k.shape(pts, { fill: col, op, sw: .6 })
      }
      // the room, and its far wall with a few things on it
      k.seed('room'); k.line(k.rect(X0, Y0, 1.4 * U, U), 1, k.dim, { closed: true })
      k.seed('wall'); k.line([X([.04, WALL]), X([1.36, WALL])], 1.6, k.ink)
      ;[[.25, .12, 'a'], [.55, .2, 'b'], [.92, .14, 'hi'], [1.18, .1, 'a']].forEach(([x, w, t], n) => {
        k.seed('obj' + n); k.shape(k.rect(X0 + (x - w / 2) * U, Y0 + (WALL - .07) * U, w * U, .06 * U), { fill: k.tone(t), op: .5, sw: .7 })
      })
      if (p.wall) k.text(p.wall, X0 + 10, Y0 - 34, { role: 'label', size: 22, min: 11, maxW: 400, lines: 1, col: k.dim })
      // the pool: one dot per view made so far
      for (let i = 1; i < cur; i++) { const [x, y] = X([P[i].x, P[i].y]); k.flat(k.circle(x, y, 5, 10), k.dim, .6) }
      // motion window: the last few frames, ringed
      if (st >= 1) {
        const a = k.thumb ? 1 : k.easeOut(k.p(1, .6, .2))
        for (let i = T - MOT; i < T; i++) { const [x, y] = X([P[i].x, P[i].y]); k.seed('m' + i); k.line(k.circle(x, y, 11, 14), .9 * a, k.P.a, { closed: true }) }
      }
      // retrieval: the views taken here on the way out, and the sink
      const ra = k.thumb ? 1 : st >= 2 ? k.easeOut(k.p(2, .8, .3)) : 0
      if (ra > 0) {
        cover.forEach((i, n) => {
          cone(P[i], k.P.b, .28 * ra, 'r' + n)
          const [x, y] = X([P[i].x, P[i].y]); k.flat(k.circle(x, y, 10 * ra, 14), k.P.b, 1)
        })
        const sa = k.thumb ? 1 : k.easeOut(k.p(2, .6, 1.6))
        if (sa > 0) {
          cone(P[0], k.P.hi, .25 * sa, 'sink')
          const [x, y] = X([P[0].x, P[0].y]); k.flat(k.circle(x, y, 11 * sa, 14), k.P.hi, 1)
          if (p.sink) k.text(p.sink, x - 40, y + 32, { role: 'label', size: 22, min: 11, maxW: 240, lines: 1, alpha: sa })
        }
      }
      // the camera and what it sees
      const c = P[cur]
      cone(c, k.P.a, .2, 'cam')
      const [cx, cy] = X([c.x, c.y]); k.flat(k.circle(cx, cy, 13, 16), k.P.a, 1)
      // far-wall points in the target's view: filled once an older view also sees them
      if (st >= 1) {
        anchors.forEach(([px, py], n) => {
          const ok = st >= 2 && ra > .5 && [0, ...cover].some(i => sees(P[i], px, py))
          const [x, y] = X([px, py])
          k.flat(k.circle(x, y, 8, 12), ok ? k.P.b : k.paper, 1)
          k.seed('an' + n); k.line(k.circle(x, y, 8, 12), .6, k.P.b, { closed: true })
        })
      }
      // legend: what this beat is about
      let ly = Y0 + 10
      ;[p.pool, p.motion, p.cover].forEach((s, n) => {
        if (!s || n > st) return
        const on = n === st
        const o = { role: on ? 'head' : 'body', size: on ? 34 : 26, min: 13, maxW: 350, lines: 3, col: on ? k.ink : k.dim }
        const m = k.measure(s, o); k.text(s, 1020, ly, o); ly += m.h + 26
      })
      k.point = st === 2 && cover.length ? X([P[cover[0]].x, P[cover[0]].y]) : [cx, cy]
      k.mood = st === 1 ? 'thinking' : st === 2 ? 'happy' : 'neutral'
    },
  }
})())
