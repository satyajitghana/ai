// deepba-tfd-sfm / schur
//
// The arrow-shaped normal matrix of bundle adjustment, and the Schur
// complement that makes it cheap, drawn the way the article's LM stepper shows
// it. Four cameras and nine points: the camera block B (dense, top left), the
// point block C (one small block per point on the diagonal), and the coupling
// E between a camera and the points it sees.
//   step 0: the matrix builds, cameras first, then points, then the coupling
//   step 1: each point block is inverted on its own (they glow in turn)
//   step 2: the points fold into the camera block: the coupling slides up-left
//           and the matrix shrinks to S, cameras only, which fills in wherever
//           two cameras share a point
//   step 3: solve S, then the points come back one at a time (back-substitution)
// The sizes are a toy, so the runtime stamps it Illustrative. Every label is a
// storyboard string (params.labels, params.legend).
BESPOKE.define((() => {
  const NC = 4 // cameras
  const NP = 9 // points
  // which cameras see which point (a walk: each point seen by two or three neighbours)
  const SEES = [[0, 1], [0, 1, 2], [0, 1], [1, 2], [1, 2, 3], [1, 2, 3], [2, 3], [2, 3], [0, 3]]

  function lay(k) {
    const x0 = 160, y0 = k.top + 40
    const size = 560
    const n = NC + NP
    const cell = size / n
    return { x0, y0, size, cell, n }
  }

  return {
    stampAt: k => [1180, k.top + 10],
    plan: () => ({
      min: [4.4, 4.4, 4.8, 4.8],
      events: [{ step: 0, at: .3, type: 'ticks', n: 13, span: 2.2 }, { step: 1, at: .3, type: 'ticks', n: 9, span: 2.4 },
        { step: 2, at: .4, type: 'whoosh' }, { step: 3, at: .4, type: 'ticks', n: 9, span: 2.6 }, { step: 3, at: 3.4, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 2.6 }, { step: 1, from: 0, to: 2.8 }, { step: 2, from: 0, to: 3.2 }, { step: 3, from: 0, to: 3.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const L = lay(k)
      const at = (r, c) => [L.x0 + c * L.cell, L.y0 + r * L.cell]
      const box = (r, c, col, a, w = 1, h = 1) => {
        const [x, y] = at(r, c)
        k.seed('b' + r + '_' + c + '_' + w)
        k.flat(k.rect(x + 2, y + 2, L.cell * w - 4, L.cell * h - 4), col, a)
      }
      // progress of each phase
      const build = k.thumb || i > 0 ? 1 : k.ease(k.p(0, 2.4, .2))
      const fold = k.thumb ? 1 : i < 2 ? 0 : i === 2 ? k.ease(k.p(2, 2.6, .4)) : 1
      const back = k.thumb ? 1 : i < 3 ? 0 : k.ease(k.p(3, 2.8, .5))

      // frame of the full matrix (shrinks toward the camera block as the points fold away)
      const g = 1 + 1.6 * fold // the camera block grows once it is all that is left
      const atB = (r, c) => [L.x0 + c * L.cell * g, L.y0 + r * L.cell * g]
      const full = L.size * (1 - fold) + L.cell * NC * g * fold
      k.seed('frame'); k.line(k.rect(L.x0 - 6, L.y0 - 6, full + 12, full + 12), 1.4, k.ink, { closed: true })

      // camera block B: dense
      const nb = Math.min(1, build * 3)
      for (let r = 0; r < NC; r++) for (let c = 0; c < NC; c++) {
        const near = Math.abs(r - c) <= 1 || (r === 0 && c === 3) || (r === 3 && c === 0)
        // cameras that share a point fill in once the points are folded in (S is denser than B)
        const a = near ? nb * (fold > .5 ? 1 : .8) : nb * Math.max(0, (fold - .5) * 2)
        if (a > 0) {
          const [x, y] = atB(r, c)
          k.seed('B' + r + '_' + c)
          k.flat(k.rect(x + 2, y + 2, L.cell * g - 4, L.cell * g - 4), k.P.hi, a)
        }
      }
      if (fold < 1) {
        const a = 1 - fold
        // point block C: block diagonal
        const nc = Math.min(1, Math.max(0, build * 3 - 1))
        for (let j = 0; j < NP; j++) {
          const r = NC + j
          const lit = i === 1 && !k.thumb ? k.clamp((k.since(1) - .3 - j * .26) / .3, 0, 1) * (1 - k.clamp((k.since(1) - .6 - j * .26) / .4, 0, 1)) : 0
          box(r, r, lit > .05 ? k.P.a : k.P.b, nc * a)
          if (lit > .05) { k.push(); k.alpha(lit); const [x, y] = at(r, r); k.seed('ring' + j); k.line(k.circle(x + L.cell / 2, y + L.cell / 2, L.cell * .9, 16), 1.6, k.P.a, { closed: true }); k.pop() }
        }
        // coupling E and its transpose; they slide into B as the points fold
        const ne = Math.min(1, Math.max(0, build * 3 - 2))
        SEES.forEach((cams, j) => cams.forEach(c => {
          const r = NC + j
          const [x1, y1] = at(c, r)
          const [x2, y2] = at(r, c)
          const [tx, ty] = atB(c, c)
          k.push(); k.alpha(ne * a)
          k.seed('e' + j + c); k.flat(k.rect(k.lerp(x1, tx, fold) + 2, k.lerp(y1, ty, fold) + 2, L.cell - 4, L.cell - 4), k.P.light, 1)
          k.seed('et' + j + c); k.flat(k.rect(k.lerp(x2, tx, fold) + 2, k.lerp(y2, ty, fold) + 2, L.cell - 4, L.cell - 4), k.P.light, 1)
          k.pop()
        }))
      }

      // labels on the blocks
      const lab = p.labels || []
      if (fold < .5) {
        const a = (1 - fold * 2) * build
        if (lab[0]) k.text(lab[0], L.x0 - 14, L.y0 + L.cell * NC / 2 + 8, { role: 'mono', size: 22, min: 14, maxW: 140, align: 'right', alpha: a })
        if (lab[1]) k.text(lab[1], L.x0 + L.size, L.y0 + L.size + 40, { role: 'mono', size: 22, min: 14, maxW: 400, align: 'right', alpha: a })
        if (lab[2]) k.text(lab[2], L.x0 + L.size, L.y0 - 18, { role: 'mono', size: 22, min: 14, maxW: 300, align: 'right', alpha: a })
      } else if (lab[3]) {
        k.text(lab[3], L.x0, L.y0 + L.cell * NC * g + 48, { role: 'mono', size: 28, min: 14, maxW: 420, alpha: Math.min(1, (fold - .5) * 2) })
      }

      // right side: the points as dots, which light up when back-substituted
      const px = 900, py0 = k.top + 70
      for (let j = 0; j < NP; j++) {
        const y = py0 + j * 52
        const on = i < 3 ? 0 : k.clamp(back * NP - j, 0, 1)
        k.seed('pt' + j)
        k.line(k.circle(px, y, 14, 14), 1.4, k.ink, { closed: true })
        if (on > 0) k.flat(k.circle(px, y, 11 * on, 14), k.P.a, 1)
      }
      const leg = (p.legend || [])[i]
      if (leg) k.text(leg, px + 50, py0 + 4 * 52, { role: 'body', size: 34, min: 16, maxW: 420, lines: 4, alpha: k.thumb ? 1 : k.p(i, .5, .2) })

      k.point = i === 3 ? [px, py0 + 4 * 52] : i === 2 ? atB(1, 1) : i === 1 ? at(NC + 4, NC + 4) : at(2, 2)
      k.mood = i === 3 ? 'happy' : i === 2 ? 'excited' : 'thinking'
    },
  }
})())
