// reality-capture-roundup-nov-20 / bbsearch
//
// The article's RelocSearch widget, animated: lidar_localization_ros2's map-wide branch-and-bound
// search (bbs_branch_and_bound.hpp), run here on the widget's toy floor, two identical rooms over a
// corridor with one pillar at the east end. The search is the widget's port, executed in the
// module; only heading 0 is drawn.
//   step 0  the floor, and the scan taken in the east room
//   step 1  coarse blocks shaded by their upper bound: an 8 by 8 cell block can only score less
//           than its bound, so dark blocks are never opened
//   step 2  best-first: blocks open in the order the heap pops them, down to single cells; the two
//           rooms end with the same score, and the tie-break picks the west one
//   step 3  query two from the corridor sees the pillar: the answer is where the robot is, and the
//           first answer moved by the odometry lands somewhere else, so the pair is rejected
// A toy, stamped Illustrative. Every string drawn is a param.
//
// params: { scan, bound, best, tie, again, reject }
BESPOKE.define((() => {
  const W = 64, H = 40, DEPTH = 3, K = 6, NMS = 4
  const P1 = [47, 13], P2 = [47, 32]
  const CS = 14
  const GX = 180

  function makeMap() {
    const g = new Uint8Array(W * H)
    const set = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = 1 }
    set(0, 0, W - 1, 0); set(0, H - 1, W - 1, H - 1); set(0, 0, 0, H - 1); set(W - 1, 0, W - 1, H - 1)
    set(31, 0, 32, 25); set(0, 25, 13, 25); set(18, 25, 45, 25); set(50, 25, W - 1, 25)
    set(6, 6, 9, 9); set(38, 6, 41, 9); set(55, 31, 58, 34)
    return g
  }
  function dilate(g, w, h) {
    const o = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0
      for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && g[yy * w + xx]) { v = 1; break }
      }
      o[y * w + x] = v
    }
    return o
  }
  function pool(g, w, h) {
    const pw = (w + 1) >> 1, ph = (h + 1) >> 1, o = new Uint8Array(pw * ph)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x]) o[(y >> 1) * pw + (x >> 1)] = 1
    return [o, pw, ph]
  }
  function cast(g, px, py) {
    const pts = []
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a)
      for (let r = 0.5; r < 60; r += 0.1) {
        const x = px + c * r, y = py + s * r, ix = Math.floor(x), iy = Math.floor(y)
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) break
        if (g[iy * W + ix]) { pts.push([x - px, y - py]); break }
      }
    }
    return pts
  }
  // heading 0 only: enough for the picture, and the tie is at heading 0
  function search(grid, scan) {
    const pyr = [[dilate(grid, W, H), W, H]]
    for (let i = 0; i < DEPTH; i++) pyr.push(pool(...pyr[pyr.length - 1]))
    const ub = pyr.map(([g, w, h], i) => (i === 0 ? g : dilate(g, w, h)))
    const n = scan.length
    const offs = pyr.map((_, L) => {
      const f = 1 << L, m = new Map()
      for (const [x, y] of scan) {
        const qx = Math.floor((0.5 + x) / f), qy = Math.floor((0.5 + y) / f), key = qx + ',' + qy
        const e = m.get(key); if (e) e[2]++; else m.set(key, [qx, qy, 1])
      }
      return [...m.values()]
    })
    const hits = (L, tx, ty) => {
      const [, w, h] = pyr[L], u = ub[L], bx = tx >> L, by = ty >> L
      let hit = 0
      for (const [qx, qy, c] of offs[L]) { const ix = qx + bx, iy = qy + by; if (ix >= 0 && iy >= 0 && ix < w && iy < h && u[iy * w + ix]) hit += c }
      return hit
    }
    const heap = []
    const better = (a, b) => a.b > b.b || (a.b === b.b && a.seq < b.seq)
    const push = nd => { heap.push(nd); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!better(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p } }
    const pop = () => {
      const top = heap[0], last = heap.pop()
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && better(heap[l], heap[m])) m = l; if (r < heap.length && better(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m } }
      return top
    }
    const step = 1 << DEPTH
    const coarse = []
    let seq = 0
    for (let ty = 0; ty < H; ty += step) for (let tx = 0; tx < W; tx += step) {
      const nd = { b: hits(DEPTH, tx, ty) / n, seq: seq++, L: DEPTH, tx, ty }
      coarse.push(nd); push(nd)
    }
    const popped = [], best = []
    let kth = -Infinity
    while (heap.length) {
      const nd = pop()
      if (best.length >= K && nd.b <= kth + 1e-12) break
      popped.push(nd)
      if (nd.L === 0) {
        const c = { tx: nd.tx, ty: nd.ty, score: hits(0, nd.tx, nd.ty) / n }
        const j = best.findIndex(b => Math.abs(b.tx - c.tx) <= NMS && Math.abs(b.ty - c.ty) <= NMS)
        if (j >= 0) { if (c.score > best[j].score) best[j] = c } else best.push(c)
        best.sort((a, b) => b.score - a.score || a.ty - b.ty || a.tx - b.tx)
        if (best.length > K) best.length = K
        if (best.length >= K) kth = best[K - 1].score
        continue
      }
      const cs = 1 << (nd.L - 1)
      for (let dy = 0; dy <= cs; dy += cs) for (let dx = 0; dx <= cs; dx += cs) {
        const tx = nd.tx + dx, ty = nd.ty + dy
        if (tx >= W || ty >= H) continue
        const b = hits(nd.L - 1, tx, ty) / n
        if (best.length >= K && b < kth - 1e-12) continue
        push({ b, seq: seq++, L: nd.L - 1, tx, ty })
      }
    }
    return { coarse, popped, best }
  }

  let cache = null
  function build() {
    if (cache) return cache
    const g = makeMap()
    const s1 = cast(g, P1[0] + .5, P1[1] + .5), s2 = cast(g, P2[0] + .5, P2[1] + .5)
    cache = { g, s1, s2, q1: search(g, s1), q2: search(g, s2) }
    return cache
  }

  return {
    plan: () => ({
      min: [3.6, 4.2, 6.0, 5.6],
      events: [
        { step: 1, at: .3, type: 'ticks', n: 12, span: 1.8 },
        { step: 2, at: .3, type: 'ticks', n: 20, span: 4.0 },
        { step: 2, at: 4.6, type: 'ding' },
        { step: 3, at: 3.0, type: 'ding' },
      ],
      motion: [{ step: 2, from: 0, to: 5.0 }, { step: 3, from: 0, to: 3.6 }],
    }),
    stampAt: k => [1250, k.top + 20],
    draw(k) {
      const p = k.params
      const i = k.thumb ? 2 : k.step
      const { g, s1, s2, q1, q2 } = build()
      const ink = k.ink, dim = k.dim, a = k.P.a, hi = k.P.hi, bad = k.tone('b')
      const GY = k.top + 30
      const X = x => GX + x * CS, Y = y => GY + y * CS

      // the floor
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x]) k.flat(k.rect(X(x), Y(y), CS, CS), ink, .75)

      const truth = i === 3 ? P2 : P1
      const scan = i === 3 ? s2 : s1
      const q = i === 3 ? q2 : q1

      // step 1: coarse blocks shaded by their bound
      if (i === 1 || i === 2) {
        const fade = i === 1 ? (k.thumb ? 1 : k.ease(k.p(1, 1.2, .2))) : 1 - (k.thumb ? .6 : .6 * k.ease(k.p(2, 1, 0)))
        for (const nd of q.coarse) {
          const s = (1 << nd.L) * CS
          k.flat(k.rect(X(nd.tx), Y(nd.ty), s, s), nd.b > .9 ? hi : dim, fade * (0.08 + 0.45 * nd.b * nd.b))
        }
      }
      // step 2 and 3: the nodes the heap opened, in order
      if (i >= 2) {
        const f = k.thumb ? 1 : k.clamp(k.since(i) / 4.2, 0, 1)
        const m = Math.floor(q.popped.length * f)
        for (let j = 0; j < m; j++) {
          const nd = q.popped[j]
          const s = (1 << nd.L) * CS
          k.flat(k.rect(X(nd.tx), Y(nd.ty), s, s), nd.L === 0 ? hi : a, nd.L === 0 ? .8 : .18)
        }
        if (f >= 1) {
          for (const [j, b] of q.best.entries()) {
            if (j > 1) break
            k.seed('cand' + i + j)
            k.line(k.circle(X(b.tx + .5), Y(b.ty + .5), 22, 40), j === 0 ? 3 : 1.6, j === 0 ? hi : bad, { closed: true })
          }
        }
      }
      // the scan, at the robot (steps 0 and 3) or at the chosen candidate
      const at = i === 0 ? truth : (i >= 2 && (k.thumb || k.since(i) > 4.2)) ? [q.best[0].tx, q.best[0].ty] : null
      if (at) for (const [x, y] of scan) k.flat(k.circle(X(at[0] + .5 + x), Y(at[1] + .5 + y), 4, 8), a, .85)
      // where the robot really is
      k.seed('truth' + i)
      k.line([[X(truth[0] + .5) - 14, Y(truth[1] + .5) - 14], [X(truth[0] + .5) + 14, Y(truth[1] + .5) + 14]], 3, k.tone('hi'))
      k.line([[X(truth[0] + .5) - 14, Y(truth[1] + .5) + 14], [X(truth[0] + .5) + 14, Y(truth[1] + .5) - 14]], 3, k.tone('hi'))

      // step 3: query one's answer moved by the odometry, a dashed box that misses
      if (i === 3) {
        const b = q1.best[0], px = b.tx, py = b.ty + (P2[1] - P1[1])
        const t = k.thumb ? 1 : k.ease(k.p(3, 1, 2.4))
        k.push(); k.alpha(t)
        k.seed('pred'); k.line(k.rect(X(px) - 14, Y(py) - 14, 46, 46), 2.4, bad, { closed: true })
        k.pop()
      }

      const label = [p.scan, p.bound, p.best, p.again][i]
      k.text(label, GX, k.top + 618, { role: 'label', size: 32, min: 18, maxW: 1000, lines: 2, col: ink })
      if (i === 3 && (k.thumb || k.since(3) > 3)) k.text(p.reject, GX, k.top + 680, { role: 'label', size: 30, min: 16, maxW: 1000, lines: 1, col: bad })
      if (i === 2 && (k.thumb || k.since(2) > 4.2)) k.text(p.tie, GX, k.top + 680, { role: 'label', size: 30, min: 16, maxW: 1000, lines: 1, col: bad })

      k.point = i === 0 ? [X(P1[0]), Y(P1[1])] : i === 3 ? [X(P2[0]), Y(P2[1])] : [X(16), Y(13)]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
