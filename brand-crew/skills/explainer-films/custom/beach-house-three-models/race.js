// beach-house-three-models / race
//
// The three critic loops on one clock. One lane per model; a lane draws on
// from launch to the finished file, and each critic round lands on it as a
// stamp reading no, close or yes. Lane order: Sonnet, Opus, Fable (fastest
// first). Then the blind judges' order is written at the end of each lane.
// Every string drawn is a storyboard string (params); positions are geometry,
// read off the run logs' clocks (minutes after launch), so the runtime stamps
// it Illustrative rather than claiming exact times.
//
// steps: 0 the clock and the three lanes · 1 Sonnet's run · 2 Opus's run ·
//        3 Fable's run · 4 what the blind judges said
// params: { lanes[3], ends[3], verdicts { no, close, yes }, judged[3], axis }
BESPOKE.define((() => {
  const X0 = 510, X1 = 1110, MAXMIN = 95, MINGAP = 70
  // minutes after launch of each critic verdict, and of the finished file
  const RUNS = [
    { marks: [[21, 'no'], [26, 'no'], [42, 'yes']], end: 42 },                              // Sonnet
    { marks: [[27, 'no'], [39, 'no'], [43, 'no'], [48, 'close']], end: 48 },                 // Opus
    { marks: [[42, 'no'], [60, 'no'], [74, 'no'], [83, 'yes'], [93, 'yes']], end: 93 },      // Fable
  ]
  const xOf = (m) => X0 + (m / MAXMIN) * (X1 - X0)
  // largest size (down to 14) at which a string fits maxW on one line, in this style's own type
  const fit = (k, str, role, size, maxW) => {
    let s = size
    while (s > 14 && k.measure(str || '', { role, size: s }).w > maxW) s -= 1
    return s
  }

  return {
    stampAt: (k) => [1240, k.top + 10],
    plan: () => ({
      min: [3.0, 3.6, 3.8, 4.4, 4.2],
      events: [
        { step: 0, at: .3, type: 'draw' },
        { step: 1, at: 1.2, type: 'ding' },
        { step: 2, at: 1.4, type: 'thunk' },
        { step: 3, at: 2.4, type: 'ding' },
        { step: 4, at: .4, type: 'pop' },
      ],
      motion: [{ step: 1, from: 0, to: 2.4 }, { step: 2, from: 0, to: 2.4 }, { step: 3, from: 0, to: 3.2 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const lanes = p.lanes || ['', '', '']
      const ends = p.ends || ['', '', '']
      const judged = p.judged || ['', '', '']
      const V = p.verdicts || { no: 'no', close: 'close', yes: 'yes' }
      const y0 = k.top + 100, gap = 195

      // the clock
      const ak = k.thumb ? 1 : k.easeOut(k.p(0, .8))
      k.seed('axis'); k.line(k.partial([[X0, y0 + 2 * gap + 142], [X1, y0 + 2 * gap + 142]], ak), .7, k.dim)
      k.text(p.axis || '', X1, y0 + 2 * gap + 174, { role: 'mono', size: 24, col: k.dim, align: 'right' })

      for (let j = 0; j < 3; j++) {
        const y = y0 + j * gap
        const run = RUNS[j]
        const nk = k.thumb ? 1 : k.easeOut(k.p(0, .6, .2 + j * .15))
        k.push(); k.alpha(nk)
        k.text(lanes[j], 110, y + 11, { role: 'head', size: 30 })
        k.seed('ghost' + j); k.line([[X0, y], [X1, y]], .5, k.dim, { dash: [6, 10] })
        k.pop()

        // this lane's run draws on in its own step
        const step = j + 1
        if (!k.thumb && i < step) continue
        const dur = j === 2 ? 3.0 : 2.2
        const rk = k.thumb ? 1 : k.p(step, dur, .2)
        // marks sit at their minute, pushed right to keep MINGAP between neighbours
        const xs = []
        for (const [at] of run.marks) xs.push(Math.max(xOf(at), xs.length ? xs[xs.length - 1] + MINGAP : X0))
        const endX = Math.max(xOf(run.end), xs[xs.length - 1])
        // the lane reaches its end at 80% of the step; each mark pops as the lane passes it
        const lk = Math.min(1, rk / .8)
        const col = j === 2 ? k.P.a : j === 1 ? k.P.b : k.P.hi
        k.seed('lane' + j); k.line([[X0, y], [X0 + (endX - X0) * lk, y]], 1.3, col)

        for (let m = 0; m < run.marks.length; m++) {
          const v = run.marks[m][1], x = xs[m]
          const frac = (x - X0) / (endX - X0)
          const pop = k.thumb ? 1 : k.backOut(k.clamp((rk - .8 * frac) / .12, 0, 1))
          if (pop <= 0) continue
          const yes = v === 'yes', close = v === 'close'
          const fill = yes ? k.P.b : close ? k.P.light : k.paper
          k.push(); k.alpha(Math.min(1, pop))
          k.seed('mark' + j + '-' + m); k.shape(k.circle(x, y, 17 * Math.min(1.15, pop)), { fill, op: .95, sw: .9 })
          // labels alternate above and below the lane, clear of the line
          const ly = m % 2 === 0 ? y - 34 : y + 58
          k.text(V[v] || '', x, ly, { role: 'mono', size: 27, align: 'center', col: yes ? k.ink : k.dim })
          k.pop()
        }
        if (rk >= .92 || k.thumb) {
          // totals in their own column right of the clock, off every line
          const ek = k.thumb ? 1 : k.easeOut(k.clamp((rk - .92) / .08, 0, 1))
          k.push(); k.alpha(ek)
          k.text(ends[j], X1 + 50, y + 10, { role: 'body', size: fit(k, ends[j], 'body', 26, 190) })
          k.pop()
          if (i === step) { k.point = [endX, y]; k.mood = j === 0 ? 'surprised' : 'thinking' }
        }
      }

      // the blind judges' verdict, written under each lane
      if (i >= 4 || k.thumb) {
        for (let j = 0; j < 3; j++) {
          const jk = k.thumb ? 1 : k.easeOut(k.p(4, .6, .25 + j * .35))
          if (jk <= 0) continue
          const y = y0 + j * gap
          k.push(); k.alpha(jk)
          const w = k.measure(judged[j], { role: 'body', size: 28 }).w + 36
          k.seed('judged' + j); k.hl(X0 + 10, y + 80, w, 46, j === 2 ? k.P.hi : k.P.light, jk)
          k.text(judged[j], X0 + 28, y + 112, { role: 'body', size: 28 })
          k.pop()
        }
        if (!k.thumb) { k.point = [X0 + 200, y0 + 2 * gap + 50]; k.mood = 'proud' }
      }
    },
  }
})())
