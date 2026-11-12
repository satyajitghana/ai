// agent-substrate / swap
//
// The article's mechanism in one picture: many actors, few worker slots, and a
// snapshot store in between. Left, a grid of 24 toy actors sitting as
// snapshots in object storage. Right, two warm worker pods with two sandbox
// slots each. Step 0: everything is a snapshot, the slots are empty. Step 1:
// three requests arrive and three actors are restored into free slots, lit as
// running. Step 2: one of them goes idle, SuspendActor checkpoints it, and it
// flies back to storage, freeing its slot. Step 3: a request for a different
// actor lands, and it is restored into the slot that was just freed: any free
// worker will do. The counts are a toy (24 actors, 4 slots); no number reaches
// the screen, so the runtime stamps it Illustrative. Every string drawn is a
// storyboard string.
//
// steps: 0 all suspended · 1 three resumes · 2 one suspends · 3 another resumes into the freed slot
// params: { store, pool, running, pods: [2 strings], status: [4 strings] }
BESPOKE.define((() => {
  const COLS = 6, ROWS = 4, CELL = 64, GAP = 16
  const GX = 150 // left edge of the store grid
  const PX = 800, PW = 560, PH = 190, PGAP = 60 // pods
  const SW = 230, SH = 120 // a slot inside a pod

  // which actor sits in which slot after each step (slot index 0..3)
  const ASSIGN = [
    {},
    { 3: 0, 10: 1, 17: 2 },
    { 3: 0, 17: 2 },
    { 3: 0, 17: 2, 21: 1 },
  ]

  function layout(k) {
    const top = Math.max(k.top + 70, 290)
    const gy = top + 40
    const pods = [0, 1].map(j => ({ x: PX, y: top + j * (PH + PGAP), w: PW, h: PH }))
    const slots = []
    for (const pod of pods) {
      for (let s = 0; s < 2; s++) {
        const x = pod.x + 30 + s * (SW + 40)
        const y = pod.y + 50
        slots.push({ x, y, cx: x + SW / 2, cy: y + SH / 2 })
      }
    }
    return { top, gy, pods, slots }
  }

  function cellCenter(L, a) {
    const c = a % COLS, r = Math.floor(a / COLS)
    return [GX + c * (CELL + GAP) + CELL / 2, L.gy + r * (CELL + GAP) + CELL / 2]
  }

  function where(L, a, step) {
    const m = ASSIGN[Math.max(0, Math.min(ASSIGN.length - 1, step))]
    if (m[a] !== undefined) {
      const s = L.slots[m[a]]
      return [s.cx, s.cy]
    }
    return cellCenter(L, a)
  }

  return {
    stampAt: k => [1260, Math.max(k.top + 70, 290) + 2 * PH + PGAP + 60],
    plan: () => ({
      min: [3.4, 4.0, 4.0, 4.0],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 12, span: 1.4 },
        { step: 1, at: .4, type: 'pop' },
        { step: 2, at: .4, type: 'thunk' },
        { step: 3, at: .4, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 1.8 }, { step: 2, from: 0, to: 1.8 }, { step: 3, from: 0, to: 1.8 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const L = layout(k)

      // the store
      const storeW = COLS * (CELL + GAP) - GAP
      const storeH = ROWS * (CELL + GAP) - GAP
      k.seed('store'); k.shape(k.rrect(GX - 26, L.gy - 26, storeW + 52, storeH + 52, 20), { fill: k.paper, op: .5, sw: .9 })
      if (p.store) k.text(p.store, GX - 26, L.gy - 60, { role: 'label', size: 28, maxW: storeW + 52, col: k.dim })
      for (let a = 0; a < COLS * ROWS; a++) {
        const [x, y] = cellCenter(L, a)
        k.seed('ghost' + a); k.line(k.rrect(x - CELL / 2, y - CELL / 2, CELL, CELL, 10), .5, k.dim, { closed: true })
      }

      // the pods and their slots
      L.pods.forEach((pod, j) => {
        const appear = k.thumb ? 1 : (i > 0 ? 1 : k.easeOut(k.p(0, .6, .3 + .2 * j)))
        k.push(); k.alpha(appear)
        k.seed('pod' + j); k.shape(k.rrect(pod.x, pod.y, pod.w, pod.h, 22), { fill: k.tone('light'), op: .55, sw: 1 })
        if (p.pods && p.pods[j]) k.text(p.pods[j], pod.x + 24, pod.y + 34, { role: 'mono', size: 22, maxW: pod.w - 48, col: k.dim })
        k.pop()
      })
      if (p.pool) k.text(p.pool, PX, L.top - 34, { role: 'label', size: 28, maxW: PW, col: k.dim })
      L.slots.forEach((s, j) => {
        k.seed('slot' + j); k.line(k.rrect(s.x, s.y, SW, SH, 14), .7, k.dim, { closed: true, dash: [10, 8] })
      })

      // the actors: every one drawn where it is, moving on the step that moves it
      const t = k.thumb ? 1 : k.ease(k.p(i, 1.2, .3))
      const now = ASSIGN[Math.max(0, Math.min(ASSIGN.length - 1, i))]
      for (let a = 0; a < COLS * ROWS; a++) {
        const from = where(L, a, i - 1)
        const to = where(L, a, i)
        const x = k.lerp(from[0], to[0], t)
        const y = k.lerp(from[1], to[1], t)
        const running = now[a] !== undefined
        const moving = from[0] !== to[0] || from[1] !== to[1]
        const size = running ? k.lerp(CELL, SW - 40, moving ? t : 1) : (moving ? k.lerp(SW - 40, CELL, t) : CELL)
        const hgt = running ? k.lerp(CELL, SH - 30, moving ? t : 1) : (moving ? k.lerp(SH - 30, CELL, t) : CELL)
        const fill = running ? k.P.a : k.tone('light')
        k.seed('actor' + a + (running ? 'r' : 's'))
        k.shape(k.rrect(x - size / 2, y - hgt / 2, size, hgt, 12), { fill, op: running ? .9 : .7, sw: .8 })
        if (running && t > .8 && p.running) {
          k.push(); k.alpha((t - .8) / .2)
          k.text(p.running, x, y + 10, { role: 'mono', size: 26, min: 12, maxW: size - 20, align: 'center', col: k.textOn(fill) })
          k.pop()
        }
      }

      // the status line for this step
      const sk = k.thumb ? 1 : k.easeOut(k.p(i, .5, .5))
      const status = (p.status || [])[i] || ''
      if (status) {
        k.push(); k.alpha(sk)
        k.text(status, GX - 26, L.top + 2 * PH + PGAP + 70, { role: 'body', size: 30, maxW: 1000, lines: 2, col: k.ink })
        k.pop()
      }

      // where the host points
      const focus = i === 0 ? cellCenter(L, 9) : i === 2 ? cellCenter(L, 10) : L.slots[1] ? [L.slots[1].cx, L.slots[1].cy] : [PX, L.top]
      k.point = focus
      k.mood = i === 2 ? 'thinking' : i === 3 ? 'happy' : 'neutral'
    },
  }
})())
