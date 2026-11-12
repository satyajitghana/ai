// steerdistill / steerloop
//
// The paper's Figure 2, animated, on the article's directory example. Two
// trajectories of six turns: the BF16 teacher's successful reference on top,
// the 4-bit student's failed rollout below, diverging at the fourth turn
// (the student reads a file from the wrong directory). Then the closed loop:
// the history before that turn is restored, the teacher writes a steering
// prompt, the student retries; the first attempt fails the local check and
// the prompt is refined, the second passes and is kept. The student continues
// with no prompt, and the revised trajectory is what gets distilled: forward
// KL to the steered student at the corrected turn, reverse KL to the teacher
// everywhere else. Bead positions and the attempt count are a toy, so the
// runtime stamps the scene Illustrative.
//
// steps: 0 reference and failed rollout · 1 restore, prompt, attempt fails ·
//        2 refined prompt, attempt passes · 3 continue without the prompt ·
//        4 distill: which target each turn gets
// params: { rows: [4], prompt, promptSub, fail, pass, fkl, rkl, legend: [5] }
BESPOKE.define((() => {
  const N = 6, DIV = 3
  return {
    stampAt: k => [1250, Math.max(k.top + 70, 280) + 70],
    plan: () => ({
      min: [4.2, 4.6, 3.8, 3.8, 4.6],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 6, span: 1.2 },
        { step: 0, at: 1.8, type: 'scratch' },
        { step: 1, at: .3, type: 'slide' },
        { step: 1, at: 1.6, type: 'scratch' },
        { step: 2, at: .6, type: 'ding' },
        { step: 3, at: .2, type: 'ticks', n: 3, span: .9 },
        { step: 4, at: .3, type: 'whoosh' },
      ],
      motion: [{ step: 0, from: 0, to: 2.2 }, { step: 1, from: 0, to: 2 }, { step: 2, from: 0, to: 1.2 }, { step: 3, from: 0, to: 1.4 }, { step: 4, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const rows = p.rows || []
      const Y0 = Math.max(k.top + 70, 280), GAP = 140
      const RY = [Y0, Y0 + GAP, Y0 + 2 * GAP, Y0 + 3 * GAP]
      const X0 = 230, DX = 196, R = 26
      const bx = j => X0 + j * DX
      const lab = { role: 'label', size: 24, min: 12, maxW: 900, lines: 1 }
      const at = (st, d, delay) => (k.thumb ? 1 : k.p(st, d, delay))
      const green = k.mix(k.P.b, k.ink, .15), red = k.P.a

      // a row of turn beads joined by a line; state(j) -> 'ok' | 'bad' | 'ghost' | 'hi' | null
      const row = (key, y, appear, state, endMark) => {
        const shown = j => k.backOut(Math.max(0, Math.min(1, appear * (N + 1) - j)))
        k.seed(key + 'rail')
        const last = (() => { let m = -1; for (let j = 0; j < N; j++) if (state(j) && shown(j) > 0) m = j; return m })()
        if (last >= 0) k.line([[bx(0) - 50, y], [bx(last) + (last === N - 1 ? 70 : 0), y]], .7, k.dim)
        for (let j = 0; j < N; j++) {
          const s = state(j), a = shown(j)
          if (!s || a <= 0) continue
          const col = s === 'bad' ? red : s === 'hi' ? green : s === 'ghost' ? k.mix(k.paper, k.dim, .35) : k.mix(k.paper, k.ink, .2)
          k.seed(key + j)
          k.shape(k.circle(bx(j), y, R * a, 28), { fill: col, op: s === 'ghost' ? .35 : .85, sw: .8 })
        }
        if (endMark && appear >= 1) {
          const ex = bx(N - 1) + 96
          k.seed(key + 'end')
          if (endMark === 'ok') k.line([[ex - 16, y], [ex - 4, y + 14], [ex + 18, y - 16]], 1.2, green)
          else { k.line([[ex - 14, y - 14], [ex + 14, y + 14]], 1.2, red); k.line([[ex + 14, y - 14], [ex - 14, y + 14]], 1.2, red) }
        }
      }

      // row 0: the teacher's successful reference
      const a0 = at(0, 1, .1)
      if (rows[0]) k.text(rows[0], X0 - 50, RY[0] - 46, { ...lab, alpha: a0 })
      row('ref', RY[0], a0, () => 'ok', 'ok')

      // row 1: the student's failed rollout, diverging at turn DIV
      const a1 = at(0, 1, .9)
      if (rows[1]) k.text(rows[1], X0 - 50, RY[1] - 46, { ...lab, alpha: a1 })
      row('stu', RY[1], a1, j => (j < DIV ? 'ok' : j === DIV ? 'bad' : 'ghost'), a1 >= 1 ? 'bad' : null)
      if (a1 >= 1) {
        const da = k.thumb ? 1 : k.easeOut(k.p(0, .6, 1.9))
        k.seed('div'); k.arrow([[bx(DIV), RY[1] - R - 6], [bx(DIV), RY[1] - R - 6 - (GAP - 2 * R - 16) * da]], red, 1, da)
      }

      // row 2: retry from the restored state, with the steering prompt
      if (i >= 1 && i <= 2) {
        const a2 = at(1, .8, .1)
        if (rows[2]) k.text(rows[2], X0 - 50, RY[2] - 46, { ...lab, alpha: a2 })
        const cx = X0 - 50, cw = bx(DIV) - R - 60 - cx, cy = RY[2] - 34, ch = 68
        k.push(); k.alpha(a2)
        k.seed('card' + (i === 2 ? 'b' : 'a'))
        k.shape(k.rrect(cx, cy, cw, ch, 10), { fill: k.P.hi, op: .55, sw: .8 })
        const head = p.prompt ? k.text(p.prompt, cx + 18, cy + 28, { role: 'mono', size: 24, min: 12, maxW: cw - 36, lines: 1 }) : null
        if (p.promptSub && head) k.text(p.promptSub, cx + 18, cy + 56, { role: 'body', size: 20, min: 11, maxW: cw - 36, lines: 1, col: k.dim })
        k.pop()
        const aa = at(1, .5, .6)
        k.seed('cardarrow'); k.arrow([[cx + cw + 6, RY[2]], [bx(DIV) - R - 8, RY[2]]], k.ink, .9, aa)
        // the attempt bead
        const fail = i === 1, ab = at(i, .5, i === 1 ? 1.1 : .3)
        if (ab > 0) {
          k.seed('att' + i)
          k.shape(k.circle(bx(DIV), RY[2], R * k.backOut(ab), 28), { fill: fail ? red : green, op: .85, sw: .8 })
          const mx = bx(DIV) + R + 34
          k.seed('mark' + i)
          if (fail) { k.line([[mx - 14, RY[2] - 14], [mx + 14, RY[2] + 14]], 1.2, red); k.line([[mx + 14, RY[2] - 14], [mx - 14, RY[2] + 14]], 1.2, red) }
          else k.line([[mx - 16, RY[2]], [mx - 4, RY[2] + 14], [mx + 18, RY[2] - 16]], 1.2, green)
          const msg = fail ? p.fail : p.pass
          if (msg) k.text(msg, mx + 40, RY[2] + 9, { role: 'head', size: 28, min: 14, maxW: 1360 - (mx + 40), lines: 1, col: fail ? red : green, alpha: ab })
        }
        if (fail) {
          const back = at(1, .6, 2.2)
          if (back > 0) { k.seed('refine'); k.arrow(k.through([[bx(DIV) + R + 34, RY[2] + 30], [bx(DIV) - 40, RY[2] + 66], [cx + cw * .7, cy + ch + 6]]), red, .8, back) }
        }
      }

      // row 3 (rows 2 and 3 share space): the revised trajectory, continued with no prompt
      if (i >= 3) {
        const yR = RY[2]
        const a3 = at(3, 1, .1)
        if (rows[3]) k.text(rows[3], X0 - 50, yR - 46, { ...lab, alpha: Math.max(a3, i > 3 ? 1 : 0) })
        const grow = i > 3 ? 1 : a3
        row('rev', yR, 1, j => (j < DIV ? 'ok' : j === DIV ? 'hi' : (grow * (N - DIV) > j - DIV ? 'ok' : null)), grow >= 1 ? 'ok' : null)
        if (i === 4) {
          const d = at(4, .8, .2)
          const ly = yR + 82
          // the corrected turn: forward KL to the steered student
          k.seed('fklbox'); k.hl(bx(DIV) - R - 8, yR - R - 8, 2 * R + 16, 2 * R + 16, k.P.hi, d)
          if (p.fkl) k.text(p.fkl, bx(DIV) - 180, ly, { role: 'label', size: 24, min: 12, maxW: 360, lines: 2, col: green, alpha: d })
          // every other turn: reverse KL to the teacher
          const d2 = at(4, .8, .9)
          if (p.rkl) k.text(p.rkl, bx(DIV + 1) + 40, ly, { role: 'label', size: 24, min: 12, maxW: 1360 - bx(DIV + 1) - 40, lines: 2, alpha: d2 })
          if (p.rkl) k.text(p.rkl, X0 - 50, ly, { role: 'label', size: 24, min: 12, maxW: bx(DIV) - 200 - (X0 - 50), lines: 2, alpha: d2 })
        }
      }

      if (p.legend && p.legend[i]) k.text(p.legend[i], X0 - 50, RY[3] + 70, { role: 'head', size: 32, min: 16, maxW: 1150, lines: 2 })
      k.point = i === 0 ? [bx(DIV), RY[1]] : i <= 2 ? [bx(DIV), RY[2]] : i === 3 ? [bx(N - 1), RY[2]] : [bx(DIV), RY[2] + 80]
      k.mood = i === 0 ? 'surprised' : i === 1 ? 'thinking' : i === 2 ? 'happy' : i === 4 ? 'proud' : 'neutral'
    },
  }
})())
