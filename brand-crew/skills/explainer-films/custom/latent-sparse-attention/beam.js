// latent-sparse-attention / beam
//
// The tree's beam search, after the article's TreeBeam: at 10M tokens the
// beam starts at level 3, scores every node there, keeps the best 2,048,
// steps down to their children (4 each, 8,192), keeps 2,048 again, and so
// on to the buckets. Each row is drawn small (32 slots); the share kept is the
// real one (a tenth of level 3, a quarter of each set of children). The
// scores are random, so the runtime stamps it Illustrative; every number on
// screen is the storyboard's.
//
// steps: 0 level 3 scored, beam kept · 1 level 2 · 2 level 1 · 3 the buckets ·
//        4 the bill: the tree's total against flat's
// params: { rows: [4 row names], scored: [4 strings, what each row scores],
//           total: string, flat: string, fewer: string, flatLabel: string, treeLabel: string }
BESPOKE.define((() => {
  const SLOTS = 24, KEEP0 = 3, CHILD = 4
  let s = 11 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  // each row: the slots scored, their scores, the ones the beam keeps, and whose child each is
  const rows = []
  {
    const r0 = { slots: [], score: [], parent: [] }
    for (let j = 0; j < SLOTS; j++) { r0.slots.push(j); r0.score.push(rnd()); r0.parent.push(-1) }
    rows.push(r0)
    for (let level = 1; level < 4; level++) {
      const prev = rows[level - 1], keep = keepOf(prev)
      const row = { slots: [], score: [], parent: [] }
      // children sit under their parent, four abreast, pushed apart where they would collide
      let next = 0
      keep.sort((a, b) => prev.slots[a] - prev.slots[b]).forEach(pi => {
        let start = Math.max(next, Math.min(SLOTS - CHILD, prev.slots[pi] - 1))
        for (let c = 0; c < CHILD; c++) { row.slots.push(start + c); row.score.push(rnd()); row.parent.push(pi) }
        next = start + CHILD
      })
      // a group pushed past the end slides the row back inside
      const over = Math.max(0, ...row.slots) - (SLOTS - 1)
      if (over > 0) row.slots = row.slots.map(x => x - over)
      rows.push(row)
    }
  }
  function keepOf(row) { return row.score.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, KEEP0).map(x => x[1]) }

  return {
    stampAt: k => [1290, k.top + 20],
    plan: () => ({
      min: [4.2, 3.6, 3.4, 3.6, 4.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 24, span: 1 }, { step: 0, at: 1.4, type: 'ding' },
        { step: 1, at: .2, type: 'draw' }, { step: 1, at: .6, type: 'ticks', n: 12, span: .6 }, { step: 1, at: 1.4, type: 'ding' },
        { step: 2, at: .2, type: 'draw' }, { step: 2, at: .6, type: 'ticks', n: 12, span: .6 },
        { step: 3, at: .2, type: 'draw' }, { step: 3, at: 1.2, type: 'pop' }, { step: 4, at: .3, type: 'grow' }, { step: 4, at: 1.6, type: 'thunk' }],
      motion: [0, 1, 2, 3].map(i => ({ step: i, from: 0, to: 1.9 })).concat([{ step: 4, from: 0, to: 1.8 }]),
    }),
    draw(k) {
      const p = k.params, i = k.step, X0 = 330, X1 = 1110, cw = (X1 - X0) / SLOTS, Y0 = k.top + 110, DY = Math.min(128, (960 - k.top - 110) / 4.9)
      const sx = j => X0 + (j + .5) * cw
      rows.forEach((row, L) => {
        if (L > Math.min(i, 3)) return
        const y = Y0 + L * DY, kept = new Set(keepOf(row)), last = L === 3
        const ak = k.thumb ? 1 : k.easeOut(k.p(L, .4))
        // the row: its name and what it scores
        k.push(); k.alpha(ak)
        if (p.rows && p.rows[L]) k.text(p.rows[L], X0 - 30, y + 12, { role: 'head', size: 34, min: 22, maxW: 220, align: 'right' })
        if (p.scored && p.scored[L]) k.text(p.scored[L], X1 + 34, y + 2, { role: 'mono', size: 26, min: 14, maxW: 250, lines: 2, lh: 1.05, col: L === i ? k.ink : k.dim })
        // every slot of the level, faint: the nodes nobody scores
        k.seed('track' + L); k.line([[X0, y + 22], [X1, y + 22]], .6, k.dim)
        k.pop()
        // edges down from the kept parents, drawn as this row arrives
        if (L > 0) row.slots.forEach((slot, c) => {
          const par = rows[L - 1], pj = par.slots[row.parent[c]], ek = k.thumb ? 1 : k.easeOut(k.p(L, .5, .05 + (c % CHILD) * .05))
          k.seed('e' + L + '_' + c); k.line(k.partial([[sx(pj), Y0 + (L - 1) * DY + 26], [sx(slot), y - 30]], ek), .45, k.dim)
        })
        // scores: a bar per node scored, growing in a wave, then the beam lights the best
        const keepK = k.thumb ? 1 : k.p(L, .3, L === 0 ? 1.3 : 1.1)
        row.slots.forEach((slot, c) => {
          const bk = k.thumb ? 1 : k.easeOut(k.p(L, .35, (L ? .5 : .15) + c * (L ? .03 : .025))); if (bk <= 0) return
          const h = 10 + row.score[c] * 34 * bk, on = kept.has(c) && keepK > 0 && !(last && i < 3)
          k.seed('n' + L + '_' + c)
          k.shape(k.rect(sx(slot) - cw * .3, y + 16 - h, cw * .6, h), { fill: on ? k.P.a : last ? k.P.hi : k.tone('b'), op: on ? 1 : .7, sw: on ? 1 : .5 })
          if (on) { k.seed('mk' + L + '_' + c); k.shape([[sx(slot), y + 30], [sx(slot) - 9, y + 44], [sx(slot) + 9, y + 44]], { fill: k.P.a, op: 1, sw: .6 }) }
        })
      })
      // the bill: the tree's total, then flat's, as two bars
      if (i >= 4) {
        const y = Y0 + 4 * DY - 10, bk = k.easeOut(k.p(4, .9, .2)), fk = k.easeOut(k.p(4, .9, 1.3))
        // flat's bar stops where its number still fits left of the host
        const wf = p.flat ? k.measure(p.flat, { role: 'head', size: 36, min: 24, maxW: 400 }).w : 0
        const full = Math.min(X1 - X0, 1370 - 24 - wf - X0), tree = Math.max(8, full * 45056 / 1310720)
        k.seed('bt'); k.shape(k.rect(X0, y, tree * bk, 34), { fill: k.P.a, op: 1, sw: .9 })
        if (p.treeLabel) k.text(p.treeLabel, X0 - 30, y + 26, { role: 'body', size: 28, min: 20, maxW: 220, align: 'right' })
        const tw = p.total ? k.text(p.total, X0 + tree + 18, y + 26, { role: 'head', size: 36, min: 24, maxW: 400, alpha: bk }).w : 0
        k.seed('bf'); k.shape(k.rect(X0, y + 56, full * fk, 34), { fill: k.tone('b'), op: .8, sw: .9 })
        if (p.flatLabel) k.text(p.flatLabel, X0 - 30, y + 82, { role: 'body', size: 28, min: 20, maxW: 220, align: 'right' })
        if (p.flat && fk > .9) k.text(p.flat, X0 + full + 24, y + 82, { role: 'head', size: 36, min: 24, maxW: 260 })
        if (p.fewer && k.p(4, .3, 2.4) > 0) k.text(p.fewer, X0 + tree + 18 + tw + 40, y + 26, { role: 'head', size: 40, min: 26, maxW: 420, col: k.dark ? k.P.a : k.ink })
      }
      const L = Math.min(i, 3)
      k.point = i >= 4 ? [X0 + 60, Y0 + 4 * DY + 6] : [sx(rows[L].slots[keepOf(rows[L])[0]]), Y0 + L * DY - 10]
      k.mood = i >= 4 ? 'surprised' : 'thinking'
    },
  }
})())
