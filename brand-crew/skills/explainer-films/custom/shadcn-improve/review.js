// shadcn-improve / review
//
// The execute loop from closing-the-loop.md, as one picture. Left, the plan
// card the strong model writes (four sections fill in). Middle, the worktree:
// the cheap executor's steps tick down. Right, the strong model's review: four
// gates, two command-shaped and two judgment-shaped. Round one, the scope gate
// fails (a file outside the plan was touched): REVISE, an arrow back to the
// worktree. Round two, the steps tick again and every gate passes: APPROVE.
// Last, the merge stays with the user.
//
// steps: 0 the plan is written · 1 the executor works in its worktree ·
//        2 review, round one: scope fails, REVISE · 3 round two: all pass,
//        APPROVE · 4 the merge is yours
// params: { heads[3], plan[4], exec[4], gates[4], kinds[4], verdicts[2],
//           rounds[2], final, stray }
// A toy run, not a measured one: the runtime stamps it Illustrative. Every
// string drawn is a storyboard string; positions are geometry.
BESPOKE.define((() => {
  const PX = 130, PW = 330
  const WX = 520, WW = 360
  const GX = 940, GW = 420
  const ROW = 92

  function tick(k, x, y, s, col) {
    k.seed('tick' + x + ':' + y)
    k.line([[x - s, y], [x - s * .3, y + s * .7], [x + s, y - s * .8]], 1.1, col)
  }
  function cross(k, x, y, s, col) {
    k.seed('crossa' + x + ':' + y); k.line([[x - s, y - s], [x + s, y + s]], 1.1, col)
    k.seed('crossb' + x + ':' + y); k.line([[x - s, y + s], [x + s, y - s]], 1.1, col)
  }

  return {
    stampAt: k => [PX + 10, Math.max(k.top + 30, 230) + 50 + 4 * ROW + 40 + 30],
    plan: () => ({
      min: [4.2, 4.2, 5.0, 4.6, 3.6],
      events: [
        { step: 0, at: .3, type: 'draw' },
        { step: 1, at: .3, type: 'ticks', n: 4, span: 2.4 },
        { step: 2, at: 1.6, type: 'thunk' },
        { step: 3, at: .3, type: 'ticks', n: 4, span: 1.8 }, { step: 3, at: 3.0, type: 'ding' },
        { step: 4, at: .4, type: 'pop' },
      ],
      motion: [{ step: 2, from: 0, to: 3.2 }, { step: 3, from: 0, to: 3.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const top = Math.max(k.top + 30, 230)
      const heads = p.heads || [], plan = p.plan || [], exec = p.exec || []
      const gates = p.gates || [], kinds = p.kinds || [], verdicts = p.verdicts || [], rounds = p.rounds || []
      const boxY = top + 50, boxH = 4 * ROW + 40

      // column heads
      k.text(heads[0] || '', PX, top + 20, { role: 'label', size: 28, maxW: PW, col: k.dim })
      k.text(heads[1] || '', WX, top + 20, { role: 'label', size: 28, maxW: WW, col: k.dim })
      k.text(heads[2] || '', GX, top + 20, { role: 'label', size: 28, maxW: GW, col: k.dim })

      // the plan card
      k.seed('plan'); k.shape(k.rrect(PX, boxY, PW, boxH, 18), { fill: k.paper, op: .65, sw: .9 })
      const fill = k.thumb ? 4 : i === 0 ? k.p(0, 3.2, .3) * 4 : 4
      plan.forEach((s, j) => {
        const a = k.clamp(fill - j, 0, 1)
        if (a <= 0) return
        const y = boxY + 30 + j * ROW
        k.push(); k.alpha(k.easeOut(a))
        k.seed('pl' + j); k.shape(k.rrect(PX + 20, y, 14, 44, 4), { fill: k.P.a, op: .9, sw: .4 })
        k.text(s, PX + 50, y + 32, { role: 'body', size: 26, min: 16, maxW: PW - 70 })
        k.pop()
      })

      // the worktree with the executor's steps
      k.seed('wt'); k.line(k.rrect(WX, boxY, WW, boxH, 18), .8, k.dim, { closed: true, dash: [10, 8] })
      const run = k.thumb ? 4 : i < 1 ? 0 : i === 1 ? k.p(1, 2.8, .3) * 4 : i === 3 ? k.p(3, 2.2, .2) * 4 : 4
      exec.forEach((s, j) => {
        const y = boxY + 30 + j * ROW
        const done = run - j >= 1
        const a = k.clamp(run - j, 0, 1)
        k.seed('ex' + j); k.shape(k.rrect(WX + 20, y, WW - 40, 60, 10), { fill: k.tone('light'), op: done ? .9 : .35, sw: .6 })
        k.text(s, WX + 40, y + 40, { role: 'mono', size: 22, min: 13, maxW: WW - 120 })
        if (a > 0) {
          k.push(); k.alpha(a); tick(k, WX + WW - 52, y + 30, 13, k.P.a); k.pop()
        }
      })
      // the stray file touched in round one
      if (i === 2 || (i === 1 && run >= 4)) {
        const sa = k.thumb ? 1 : i === 1 ? k.clamp(run - 3.6, 0, 1) * 2 : 1
        k.push(); k.alpha(k.clamp(sa, 0, 1))
        k.seed('stray'); k.shape(k.rrect(WX + 20, boxY + boxH + 18, WW - 40, 52, 10), { fill: k.P.hi, op: .8, sw: .6 })
        k.text(p.stray || '', WX + WW / 2, boxY + boxH + 52, { role: 'mono', size: 22, min: 13, maxW: WW - 60, align: 'center', col: k.textOn(k.P.hi) })
        k.pop()
      }

      // the review gates
      k.seed('gates'); k.shape(k.rrect(GX, boxY, GW, boxH, 18), { fill: k.paper, op: .55, sw: .9 })
      const done = k.thumb || i >= 3
      const r1 = k.thumb ? 0 : i === 2 ? k.p(2, 2.4, .3) * 4 : 0
      const r2 = k.thumb ? 4 : i === 3 ? k.clamp((k.p(3, 3.4, .2) * 4 - 1.6) / .6, 0, 4) : i >= 4 ? 4 : 0
      gates.forEach((s, j) => {
        const y = boxY + 30 + j * ROW
        k.text(s, GX + 24, y + 26, { role: 'body', size: 26, min: 16, maxW: GW - 110 })
        k.text(kinds[j] || '', GX + 24, y + 58, { role: 'mono', size: 18, min: 12, maxW: GW - 110, col: k.dim })
        const mx = GX + GW - 48, my = y + 34
        if (i === 2 && r1 - j > 0) {
          k.push(); k.alpha(k.clamp(r1 - j, 0, 1))
          if (j === 1) { k.hl(GX + 12, y, GW - 24, 70, k.P.hi, k.clamp(r1 - 1, 0, 1)); cross(k, mx, my, 13, k.P.hi) } else if (j === 0) tick(k, mx, my, 13, k.P.a)
          k.pop()
        }
        if (done && r2 - j > 0) {
          k.push(); k.alpha(k.clamp(r2 - j, 0, 1)); tick(k, mx, my, 13, k.P.a); k.pop()
        }
      })

      // the round label and the verdict under the gates
      const vy = boxY + boxH + 18
      if ((i === 2 && !k.thumb) || done) {
        const v = i === 2 && !k.thumb ? 0 : 1
        const va = k.thumb ? 1 : i === 2 ? k.clamp((r1 - 2) / 1, 0, 1) : i === 3 ? k.clamp(r2 - 3.4, 0, 1) * 2 : 1
        k.text(rounds[v] || '', GX + 24, vy + 36, { role: 'mono', size: 22, min: 13, maxW: 200, col: k.dim })
        if (va > 0) {
          k.push(); k.alpha(k.clamp(va, 0, 1))
          const col = v === 0 ? k.P.hi : k.P.a
          k.seed('verdict' + v); k.shape(k.rrect(GX + GW - 220, vy, 200, 56, 12), { fill: col, op: .9, sw: .6 })
          k.text(verdicts[v] || '', GX + GW - 120, vy + 38, { role: 'head', size: 28, min: 16, maxW: 180, align: 'center', col: k.textOn(col) })
          k.pop()
        }
      }
      // round one: the arrow back to the worktree
      if (i === 2 && !k.thumb) {
        const aa = k.thumb ? 0 : k.clamp((r1 - 3) / .8, 0, 1)
        if (aa > 0) {
          k.seed('back')
          k.arrow(k.through([[GX + 20, vy + 90], [GX - 40, vy + 120], [WX + WW - 40, vy + 100]]), k.P.hi, 1, aa)
        }
      }

      // the merge stays yours
      if ((i >= 4 || k.thumb) && p.final) {
        const fa = k.thumb ? 1 : k.easeOut(k.p(4, .6, .3))
        k.push(); k.alpha(fa)
        k.text(p.final, PX, vy + 110, { role: 'head', size: 34, min: 20, maxW: GX + GW - PX })
        k.pop()
      }

      // where the host points
      k.point = i === 0 ? [PX + PW - 30, boxY + 120]
        : i === 1 ? [WX + WW - 52, boxY + 30 + Math.min(3, Math.floor(run)) * ROW + 30]
          : i === 2 ? [GX + GW - 48, boxY + 30 + ROW + 34]
            : i === 3 ? [GX + GW - 120, vy + 28]
              : [PX + 200, vy + 100]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'happy' : i === 4 ? 'proud' : 'thinking'
    },
  }
})())
