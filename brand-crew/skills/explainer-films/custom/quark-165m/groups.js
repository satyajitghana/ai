// quark-165m / groups
//
// The article's GroupSignal widget, painted. GRPO samples a group of replies per
// prompt and scores each pass or fail; a reply's advantage is its reward minus the
// group mean over the group's spread. Six prompts, eight replies each (the group
// size is not published; eight is a stand-in). A row where every reply passes or
// every reply fails has zero spread, so it is crossed out: it teaches nothing.
// A row with both gets arrows: passes pushed up, fails pushed down.
// Pass/fail draws come from a seeded PRNG at the step's rate, so this is a
// simulation and is stamped Illustrative. Every string drawn is the storyboard's.
//
// params: { none, some }                       row tags
// steps:  { label, rate, force? }              rate is geometry (a probability);
//                                             force: row index made to hold exactly one pass
BESPOKE.define((() => {
  const ROWS = 6, G = 8

  function sample(k, i) {
    const s = k.steps[i] || {}
    const r = k.rng('groups-' + i)
    const rows = []
    for (let a = 0; a < ROWS; a++) {
      const row = []
      for (let b = 0; b < G; b++) row.push(r() < (s.rate || 0) ? 1 : 0)
      rows.push(row)
    }
    if (typeof s.force === 'number') {
      const row = rows[s.force]
      for (let b = 0; b < G; b++) row[b] = b === 5 ? 1 : 0
    }
    return rows
  }

  return {
    plan: (params, steps) => ({
      min: steps.map(() => 4.4),
      events: steps.map((_, i) => ({ step: i, at: .3, type: 'ticks', n: 12, span: 1.0 })),
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 1.8 })),
    }),
    stampAt: k => [1250, k.top + 60],
    draw(k) {
      const p = k.params, i = k.step, s = k.s || {}
      const rows = sample(k, i)
      const top = k.top + 30
      const X0 = 170, DX = 92, Y0 = top + 120, DY = 104, R = 30
      const PASS = k.P.hi

      k.text(s.label || '', X0 - R, top + 20, { role: 'head', size: 40, min: 18, maxW: 900, lines: 1 })

      let firstSignal = -1
      rows.forEach((row, a) => {
        const sum = row.reduce((x, y) => x + y, 0)
        const signal = sum > 0 && sum < G
        if (signal && firstSignal < 0) firstSignal = a
        const y = Y0 + a * DY
        const rowT = k.thumb ? 1 : k.easeOut(k.p(i, .9, .1 + a * .12))
        k.push(); k.alpha(rowT * (signal ? 1 : .55))
        row.forEach((v, b) => {
          const x = X0 + b * DX
          k.seed(`dot${i}-${a}-${b}`)
          if (v) k.shape(k.circle(x, y, R), { fill: PASS, op: 1, sw: .9 })
          else k.line(k.circle(x, y, R * .8), 1.0, k.ink, { closed: true })
          if (signal) {
            const at = k.thumb ? 1 : k.ease(k.p(i, .7, 1.0 + a * .1))
            const dir = v ? 1 : -1
            if (at > 0) k.arrow([[x + R + 14, y + dir * 26], [x + R + 14, y - dir * 30]], v ? PASS : k.ink, 1.3, at)
          }
        })
        if (!signal) {
          k.seed(`strike${i}-${a}`)
          k.line([[X0 - R - 10, y], [X0 + (G - 1) * DX + R + 10, y]], 1.1, k.ink)
        }
        k.text(signal ? p.some : p.none, X0 + G * DX + 20, y + 10, {
          role: 'label', size: 32, min: 16, maxW: 300, lines: 1, col: signal ? PASS : k.dim,
        })
        k.pop()
      })

      k.point = firstSignal >= 0 ? [X0 + 5 * DX, Y0 + firstSignal * DY] : [X0 + 3.5 * DX, Y0 + 2.5 * DY]
      k.mood = firstSignal < 0 ? 'surprised' : 'happy'
      if (i === k.steps.length - 1) k.mood = 'excited'
    },
  }
})())
