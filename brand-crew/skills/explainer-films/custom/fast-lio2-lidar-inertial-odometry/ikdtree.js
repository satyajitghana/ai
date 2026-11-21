// fast-lio2-lidar-inertial-odometry / ikdtree
//
// The article's IkdOps widget as a moving picture: a 2-D incremental k-d tree,
// one dot per node, laid out by depth. Points arrive along one side and the
// tree grows a deep branch; the largest subtree whose bigger child holds more
// than 0.6 of it is flattened into an array and rebuilt from the median; then a
// box delete marks the trailing points dead with lazy labels, and once more
// than half of a subtree is dead it is rebuilt and the dead nodes are freed.
// Same rules as ikd_Tree.cpp (Criterion_Check), on a seeded toy, so the
// runtime stamps it Illustrative. Every string drawn comes from params.
//
// steps: 0 insert · 1 the subtree tips · 2 flatten and rebuild · 3 box delete · 4 rebuild, free
// params: { labels: [5 strings], array, dead }
BESPOKE.define((() => {
  let s = 7 >>> 0
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  // the field: 25 points spread out, then 14 that arrive on the right as the sensor drives on
  const P = []
  for (let i = 0; i < 25; i++) P.push([rnd() * .6, rnd()])
  const NEW = []
  for (let i = 0; i < 14; i++) { NEW.push(P.length); P.push([.62 + rnd() * .36, rnd()]) }

  // tree node: { i (point index), axis, l, r }
  const build = idx => {
    if (!idx.length) return null
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9
    idx.forEach(i => { x0 = Math.min(x0, P[i][0]); x1 = Math.max(x1, P[i][0]); y0 = Math.min(y0, P[i][1]); y1 = Math.max(y1, P[i][1]) })
    const axis = x1 - x0 >= y1 - y0 ? 0 : 1
    const sd = idx.slice().sort((a, b) => P[a][axis] - P[b][axis])
    const mid = Math.floor((sd.length - 1) / 2)
    return { i: sd[mid], axis, l: build(sd.slice(0, mid)), r: build(sd.slice(mid + 1)) }
  }
  const clone = n => n ? { i: n.i, axis: n.axis, l: clone(n.l), r: clone(n.r) } : null
  const insert = (n, i) => {
    if (!n) return { i, axis: 0, l: null, r: null }
    if (P[i][n.axis] < P[n.i][n.axis]) n.l = insert(n.l, i); else n.r = insert(n.r, i)
    return n
  }
  const size = n => n ? 1 + size(n.l) + size(n.r) : 0
  const nodes = (n, out = []) => { if (n) { out.push(n.i); nodes(n.l, out); nodes(n.r, out) } return out }
  // largest subtree breaking the balance rule (more than 10 nodes, a child above 0.6 or below 0.4 of size - 1)
  let worst = null
  const scan = n => {
    if (!n) return
    const sz = size(n)
    if (sz > 10) { const c = n.l || n.r, b = size(c) / (sz - 1); if ((b > .6 || b < .4) && (!worst || sz > size(worst))) worst = n }
    scan(n.l); scan(n.r)
  }
  const replace = (n, target, by) => { if (!n) return null; if (n === target) return by; n.l = replace(n.l, target, by); n.r = replace(n.r, target, by); return n }

  const T0 = build(P.slice(0, 25).map((_, i) => i))
  const T1 = clone(T0); NEW.forEach(i => insert(T1, i))
  scan(T1)
  const SUB = worst ? nodes(worst) : []
  const T3 = clone(T1)
  let w3 = null; const find = n => { if (!n) return; if (worst && n.i === worst.i) w3 = n; find(n.l); find(n.r) }; find(T3)
  const rebuilt = build(SUB.slice())
  const T3b = w3 ? replace(T3, w3, rebuilt) : T3
  // box delete: everything with x < 0.3 is marked dead
  const DEAD = new Set(P.map((p, i) => p[0] < .3 ? i : -1).filter(i => i >= 0))
  // rebuild the root subtree with the dead dropped (more than half of the left side was dead)
  const T5 = build(nodes(T3b).filter(i => !DEAD.has(i)))

  // layout: in-order x, depth y
  const lay = (t) => {
    const pos = {}; let c = 0, maxD = 0
    const walk = (n, d) => { if (!n) return; walk(n.l, d + 1); pos[n.i] = [c++, d]; maxD = Math.max(maxD, d); walk(n.r, d + 1) }
    walk(t, 0)
    const edges = []; const ew = n => { if (!n) return; [n.l, n.r].forEach(ch => { if (ch) edges.push([n.i, ch.i]) }); ew(n.l); ew(n.r) }
    ew(t)
    return { pos, n: c, maxD, edges }
  }
  const L0 = lay(T0), L1 = lay(T1), L3 = lay(T3b), L5 = lay(T5)
  const subSet = new Set(SUB)
  const arrOrder = SUB.slice().sort((a, b) => P[a][0] - P[b][0])

  return {
    stampAt: k => [1150, k.top - 30],
    plan: () => ({
      min: [4.2, 3.6, 5.6, 3.8, 4.2],
      events: [{ step: 0, at: .3, type: 'ticks', n: 14, span: 3.2 }, { step: 1, at: .4, type: 'ding' }, { step: 2, at: .3, type: 'whoosh' },
        { step: 2, at: 2.8, type: 'pop' }, { step: 3, at: .4, type: 'thunk' }, { step: 4, at: .5, type: 'pop' }],
      motion: [{ step: 0, from: 0, to: 3.8 }, { step: 2, from: 0, to: 5 }, { step: 4, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 150, X1 = 1330, Y0 = Math.max(k.top + 70, 270), Y1 = 900
      const at = (L, i) => {
        const q = L.pos[i]; if (!q) return null
        return [X0 + (q[0] / Math.max(L.n - 1, 1)) * (X1 - X0), Y0 + (q[1] / Math.max(L.maxD, 1)) * (Y1 - Y0 - 120)]
      }
      const arrAt = j => [X0 + 60 + (j / Math.max(arrOrder.length - 1, 1)) * (X1 - X0 - 120), Y1 + 10]
      // where each point is, this frame
      const ins = st < 1 ? (k.thumb ? 1 : k.p(0, 3.6, .2)) : 1
      const nShown = 25 + Math.floor(ins * NEW.length + 1e-6)
      let L = L1, live = i => i < nShown, place = i => at(L1, i)
      const flat = st >= 2 ? (k.thumb ? 1 : k.ease(k.p(2, 1.8, .2))) : 0
      const up = st >= 2 ? (k.thumb ? 1 : k.ease(k.p(2, 1.8, 2.4))) : 0
      if (st >= 2) {
        place = i => {
          if (!subSet.has(i)) return at(L3, i)
          const a = at(L1, i), m = arrAt(arrOrder.indexOf(i)), b = at(L3, i)
          if (up <= 0) return [a[0] + (m[0] - a[0]) * flat, a[1] + (m[1] - a[1]) * flat]
          return [m[0] + (b[0] - m[0]) * up, m[1] + (b[1] - m[1]) * up]
        }
        L = L3
      }
      const fin = st >= 4 ? (k.thumb ? 1 : k.ease(k.p(4, 1.6, .4))) : 0
      if (st >= 4) {
        place = i => {
          const a = at(L3, i), b = at(L5, i)
          if (!b) return a
          return [a[0] + (b[0] - a[0]) * fin, a[1] + (b[1] - a[1]) * fin]
        }
        live = i => !DEAD.has(i) || fin < .5
        L = L5
      }
      const deadNow = i => st >= 3 && DEAD.has(i)
      const deadA = st >= 3 ? (k.thumb ? 1 : k.easeOut(k.p(3, .8, .3))) : 0

      // edges of the current structure (during the rebuild, the subtree's edges fade out and back in)
      const edgeSet = st >= 4 && fin > .5 ? L5.edges : st >= 2 ? L3.edges : L1.edges
      const ea = st === 2 ? (up > 0 ? up : 1 - flat) : st === 4 ? Math.abs(1 - 2 * fin) : 1
      edgeSet.forEach(([a, b], j) => {
        if (!live(a) || !live(b)) return
        const inSub = st === 2 && (subSet.has(a) || subSet.has(b))
        const alpha = inSub ? ea : st === 4 ? ea : 1
        if (alpha <= .02) return
        const pa = place(a), pb = place(b); if (!pa || !pb) return
        k.push(); k.alpha(alpha * .9); k.seed('e' + a + '-' + b); k.line([pa, pb], .9, k.dim); k.pop()
      })

      // the subtree that broke the rule
      if (st === 1 && SUB.length) {
        const pts = SUB.map(i => at(L1, i))
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
        pts.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]) })
        const hk = k.thumb ? 1 : k.easeOut(k.p(1, .7, .2))
        k.hl(x0 - 34, y0 - 34, x1 - x0 + 68, y1 - y0 + 68, k.P.hi, hk)
      }

      // nodes
      P.forEach((q, i) => {
        if (!live(i)) return
        const xy = place(i); if (!xy) return
        const isNew = NEW.includes(i)
        const born = st === 0 && isNew && !k.thumb ? k.easeOut(k.clamp((ins * NEW.length - NEW.indexOf(i)) * 1.5, 0, 1)) : 1
        if (born <= 0) return
        const r = 12 * born
        const hot = (st === 1 || st === 2) && subSet.has(i)
        const col = hot ? k.P.hi : isNew ? k.P.b : k.P.a
        if (deadNow(i)) {
          const fade = st >= 4 ? 1 - fin : 1
          k.push(); k.alpha(fade)
          k.seed('d' + i); k.line(k.circle(xy[0], xy[1], r + 2, 18).concat([k.circle(xy[0], xy[1], r + 2, 18)[0]]), 2.2, k.mix(col, k.ink, deadA * .7))
          if (deadA < 1) k.flat(k.circle(xy[0], xy[1], r * (1 - deadA), 14), col, 1)
          k.pop()
        } else {
          k.flat(k.circle(xy[0], xy[1], r + 3, 14), k.ink, 1)
          k.flat(k.circle(xy[0], xy[1], r, 14), col, 1)
        }
      })

      // the array V the subtree is flattened into
      if (st === 2 && p.array) {
        const a = k.thumb ? 0 : flat * (1 - up)
        if (a > .05) k.text(p.array, X0 + 40, Y1 + 70, { role: 'mono', size: 26, min: 12, maxW: 900, lines: 1, col: k.dim, alpha: a })
      }
      if (st === 3 && p.dead) k.text(p.dead, X0, Y1 + 70, { role: 'mono', size: 26, min: 12, maxW: 900, lines: 1, col: k.dim, alpha: deadA })

      // what this step is
      const lab = (p.labels || [])[st]
      if (lab) {
        const la = k.thumb ? 1 : k.easeOut(k.p(st, .6, .1))
        k.text(lab, X0, Y0 - 70, { role: 'head', size: 34, min: 14, maxW: X1 - X0, lines: 1, alpha: la })
      }

      const anyNew = NEW[Math.min(NEW.length - 1, Math.max(0, Math.floor(ins * NEW.length) - 1))]
      k.point = st === 0 ? (place(anyNew) || [X1, Y0]) : st === 1 && SUB.length ? at(L1, SUB[0]) : st === 3 ? [X0 + 200, Y0 + 200] : [X0 + (X1 - X0) * .6, Y0 + 160]
      k.mood = st === 1 ? 'surprised' : st === 2 ? 'thinking' : st === 4 ? 'happy' : 'neutral'
    },
  }
})())
