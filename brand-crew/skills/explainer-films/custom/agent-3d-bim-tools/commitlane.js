// agent-3d-bim-tools / commitlane
//
// The article's CommitRace widget, animated: MutinyBIM's planCommit() for an
// agent command built on an older revision. Two lanes (Priya's session and
// the agent's), a base and a head on a revision axis, and the model server
// that re-runs the agent's command and compares the field it writes with what
// other sessions wrote since the base. Same field, other value: refused, by
// name. A different field: commits, rebased. Every label drawn is a storyboard
// string; positions are geometry. No numbers are shown, and the wall and edit
// are a toy, so the runtime stamps it Illustrative.
//
// steps: 0 lanes, base, the agent's edit · 1 Priya's edit lands at the head ·
//        2 the server re-runs and compares: refused · 3 Priya changed another field: commits
// params: { lanes[2], base, head, server, serverSub, agentEdit, priyaEdit[4], compare[2], outcome[2] }
BESPOKE.define((() => {
  const LX0 = 150, LX1 = 900, YA = 430, YB = 690, XB = 330, XH = 640
  const SX = 980, SY = 380, SW = 390, SH = 380

  return {
    stampAt: [1240, 300],
    plan: () => ({
      min: [3.4, 3.2, 3.8, 3.6],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .35, type: 'pop' }, { step: 2, at: .3, type: 'flow' }, { step: 2, at: 1.6, type: 'thunk' }, { step: 3, at: .4, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 1.4 }, { step: 2, from: 0, to: 2.2 }, { step: 3, from: 0, to: 1.6 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const lanes = p.lanes || ['', '']
      // the two lanes
      for (const [j, y] of [[0, YA], [1, YB]]) {
        k.seed('lane' + j); k.line([[LX0, y], [LX1, y]], .8, k.dim)
        k.text(lanes[j] || '', LX0, y - 70, { role: 'mono', size: 26, col: k.dim })
      }
      // base and head markers
      k.seed('base'); k.line([[XB, YA - 110], [XB, YB + 70]], .7, k.dim, { dash: [10, 8] })
      k.text(p.base || '', XB, YB + 115, { role: 'mono', size: 24, col: k.dim, align: 'center' })
      const hk = k.thumb ? 1 : (i >= 1 ? k.easeOut(k.p(1, .6)) : 0)
      if (hk > 0) {
        k.push(); k.alpha(hk)
        k.seed('head'); k.line([[XH, YA - 110], [XH, YB + 70]], .7, k.P.a, { dash: [10, 8] })
        k.text(p.head || '', XH, YB + 115, { role: 'mono', size: 24, col: k.P.a, align: 'center' })
        k.pop()
      }
      // the agent's edit, built on the base
      const ak = k.thumb ? 1 : k.easeOut(k.p(0, .6, .3))
      const agentX = XB - 120, agentW = 260
      if (ak > 0) {
        k.push(); k.alpha(ak)
        k.seed('agent'); k.shape(k.rrect(agentX, YB - 40, agentW, 80, 14), { fill: k.tone('light'), op: .9, sw: .9 })
        k.text(p.agentEdit || '', agentX + agentW / 2, YB + 10, { role: 'body', size: 28, maxW: agentW - 24, align: 'center' })
        k.pop()
      }
      // Priya's edit, landing at the head
      if (i >= 1) {
        const pk = k.thumb ? 1 : k.backOut(k.p(1, .55, .2))
        const label = (p.priyaEdit || [])[i] || ''
        const px = XH - 150, pw = 300
        k.push(); k.alpha(Math.min(1, pk))
        k.seed('priya' + (i === 3 ? 'b' : 'a')); k.shape(k.rrect(px, YA - 40, pw, 80, 14), { fill: i === 3 ? k.P.a : k.P.hi, op: .85, sw: .9 })
        k.text(label, px + pw / 2, YA + 10, { role: 'body', size: 28, maxW: pw - 24, align: 'center', col: k.textOn(i === 3 ? k.P.a : k.P.hi) })
        k.pop()
      }
      // the server
      const sk = k.thumb ? 1 : (i >= 2 ? k.easeOut(k.p(2, .6)) : 0)
      if (sk > 0) {
        k.push(); k.alpha(sk)
        k.seed('server'); k.shape(k.rrect(SX, SY, SW, SH, 18), { fill: k.paper, op: 1, sw: 1.1 })
        k.text(p.server || '', SX + SW / 2, SY + 60, { role: 'head', size: 38, maxW: SW - 30, align: 'center' })
        k.text(p.serverSub || '', SX + SW / 2, SY + 110, { role: 'mono', size: 24, maxW: SW - 30, align: 'center', col: k.dim })
        k.pop()
        // both edits flow into it
        const fk = k.thumb ? 1 : k.easeOut(k.p(2, .9, .3))
        k.seed('fa'); k.arrow([[agentX + agentW, YB], [SX - 10, SY + SH - 90]], k.ink, 1, fk)
        k.seed('fb'); k.arrow([[XH + 150, YA], [SX - 10, SY + 90]], k.ink, 1, fk)
        // the comparison and the outcome
        const ok = i === 3
        const ck = k.thumb ? 1 : k.easeOut(k.p(i, .5, i === 2 ? 1.1 : .4))
        if (ck > 0) {
          k.push(); k.alpha(ck)
          k.text((p.compare || [])[ok ? 1 : 0] || '', SX + SW / 2, SY + 190, { role: 'body', size: 28, maxW: SW - 40, align: 'center' })
          const col = ok ? k.P.a : k.P.hi
          k.seed('out' + (ok ? 'b' : 'a')); k.shape(k.rrect(SX + 30, SY + 240, SW - 60, 100, 14), { fill: col, op: .9, sw: 1 })
          k.text((p.outcome || [])[ok ? 1 : 0] || '', SX + SW / 2, SY + 300, { role: 'head', size: 30, min: 20, maxW: SW - 90, lines: 2, align: 'center', col: k.textOn(col) })
          k.pop()
        }
      }
      k.point = i >= 2 ? [SX + SW / 2, SY + 290] : i === 1 ? [XH, YA] : [XB, YB]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'happy' : 'thinking'
    },
  }
})())
