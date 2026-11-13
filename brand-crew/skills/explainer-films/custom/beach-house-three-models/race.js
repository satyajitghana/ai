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
  const X0 = 360, X1 = 1100, MAXMIN = 95
  // minutes after launch of each critic verdict, and of the finished file
  const RUNS = [
    { marks: [[21, 'no'], [26, 'no'], [42, 'yes']], end: 42 },                              // Sonnet
    { marks: [[27, 'no'], [39, 'no'], [43, 'no'], [48, 'close']], end: 48 },                 // Opus
    { marks: [[42, 'no'], [60, 'no'], [74, 'no'], [83, 'yes'], [93, 'yes']], end: 93 },      // Fable
  ]
  const xOf = (m) => X0 + (m / MAXMIN) * (X1 - X0)

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
      const y0 = k.top + 110, gap = 210

      // the clock
      const ak = k.thumb ? 1 : k.easeOut(k.p(0, .8))
      k.seed('axis'); k.line(k.partial([[X0, y0 + 2 * gap + 150], [X1, y0 + 2 * gap + 150]], ak), .7, k.dim)
      k.text(p.axis || '', X1, y0 + 2 * gap + 190, { role: 'mono', size: 24, col: k.dim, align: 'right' })

      for (let j = 0; j < 3; j++) {
        const y = y0 + j * gap
        const run = RUNS[j]
        const nk = k.thumb ? 1 : k.easeOut(k.p(0, .6, .2 + j * .15))
        k.push(); k.alpha(nk)
        k.text(lanes[j], X0 - 30, y + 12, { role: 'head', size: 34, align: 'right', maxW: 230 })
        k.seed('ghost' + j); k.line([[X0, y], [X1, y]], .5, k.dim, { dash: [6, 10] })
        k.pop()

        // this lane's run draws on in its own step
        const step = j + 1
        if (!k.thumb && i < step) continue
        const dur = j === 2 ? 3.0 : 2.2
        const rk = k.thumb ? 1 : k.p(step, dur, .2)
        const nowMin = run.end * rk
        const col = j === 2 ? k.P.a : j === 1 ? k.P.b : k.P.hi
        k.seed('lane' + j); k.line([[X0, y], [xOf(nowMin), y]], 1.3, col)

        for (let m = 0; m < run.marks.length; m++) {
          const [at, v] = run.marks[m]
          if (nowMin < at) continue
          const pop = k.thumb ? 1 : k.backOut(k.clamp((nowMin - at) / 6, 0, 1))
          const x = xOf(at), yes = v === 'yes', close = v === 'close'
          const fill = yes ? k.P.b : close ? k.P.light : k.paper
          k.push(); k.alpha(Math.min(1, pop))
          k.seed('mark' + j + '-' + m); k.shape(k.circle(x, y, 14 * Math.min(1.15, pop)), { fill, op: .95, sw: .9 })
          // labels alternate above and below the lane so neighbours 4 minutes apart do not collide
          const ly = m % 2 === 0 ? y - 30 : y + 50
          k.text(V[v] || '', x, ly, { role: 'mono', size: 20, align: 'center', col: yes ? k.ink : k.dim })
          k.pop()
        }
        if (rk >= 1) {
          k.text(ends[j], xOf(run.end) + 40, y + 10, { role: 'body', size: 26, maxW: 220 })
          if (i === step) { k.point = [xOf(run.end), y]; k.mood = j === 0 ? 'surprised' : 'thinking' }
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
          k.seed('judged' + j); k.hl(X0 + 10, y + 70, w, 46, j === 2 ? k.P.hi : k.P.light, jk)
          k.text(judged[j], X0 + 28, y + 102, { role: 'body', size: 28 })
          k.pop()
        }
        if (!k.thumb) { k.point = [X0 + 200, y0 + 2 * gap + 50]; k.mood = 'proud' }
      }
    },
  }
})())
