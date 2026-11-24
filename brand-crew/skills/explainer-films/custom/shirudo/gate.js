// shirudo / gate
//
// The article's ShieldPicker as a moving picture: one kernel bug (CVE-2026-31431, Copy Fail) and
// four choices of upatch, played against the same six kinds of AF_ALG traffic. Rows of requests
// stand on the left; each beat sends them right toward a gate drawn on the LSM hook, and on to the
// page cache. Four beats:
//   0  no shield: everything passes, and the exploit row lands on the page cache, which stains
//   1  detector only: everything still passes; the counter by the gate lights as the exploit goes by
//   2  block AF_ALG (lsm/socket_create): every AF_ALG row stops at the gate, honest ones included
//   3  block splice (lsm/socket_sendmsg + MSG_SPLICE_PAGES): only the two splicing rows stop
// The rules are the three BPF programs in upatches/kernel-cve/sources/; the rows are examples
// (the article says so), so the runtime stamps it Illustrative.
//
// params: { heads: [4 strings], rows: [{label, alg, splice, exploit}] x6, gate: [4 strings],
//           page, stain, counter, refused }
BESPOKE.define((() => {
  const passes = (r, st) => {
    if (st === 2 && r.alg) return false
    if (st === 3 && r.alg && r.splice) return false
    return true
  }
  return {
    stampAt: k => [1230, k.top + 24],
    plan: () => ({
      min: [5.2, 4.6, 4.8, 5.2],
      events: [{ step: 0, at: 2.2, type: 'thunk' }, { step: 1, at: 2.0, type: 'ding' },
        { step: 2, at: 1.6, type: 'ticks', n: 5, span: .8 }, { step: 3, at: 1.6, type: 'ticks', n: 2, span: .4 }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const rows = p.rows || []
      const X0 = 130, LABW = 420
      const SX = 590, GX = 900, PX = 1090, PW = 260
      const Y0 = Math.max(k.top + 80, 250), DY = 92
      const H = DY * rows.length

      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, Y0 - 40, { role: 'head', size: 32, min: 14, maxW: 1240, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // the gate on the hook
      const gateOn = st >= 2 || k.thumb
      k.seed('rail'); k.line([[GX, Y0 - 6], [GX, Y0 + H - 30]], gateOn ? 5 : 1.4, gateOn ? k.P.hi : k.dim)
      const gl = (p.gate || [])[st]
      if (gl) k.text(gl, GX - 150, Y0 + H + 6, { role: 'mono', size: 20, min: 11, maxW: 330, lines: 2, col: k.dim })

      // the page cache box
      const stained = (st === 0 || st === 1) && !k.thumb
      const stainA = stained ? k.easeOut(k.clamp((k.since(st) - 2.0) / .6, 0, 1)) : 0
      k.seed('page'); k.shape(k.rrect(PX, Y0 + H * .25, PW, H * .45, 16), { fill: k.P.light, op: .35, sw: 1.6, ink: k.ink })
      if (stainA > .01) k.flat(k.rrect(PX + 6, Y0 + H * .25 + 6, PW - 12, H * .45 - 12, 12), k.P.hi, .45 * stainA)
      if (p.page) k.text(p.page, PX + 18, Y0 + H * .25 + 46, { role: 'mono', size: 24, min: 12, maxW: PW - 30, lines: 1 })
      if (stainA > .3 && p.stain) k.text(p.stain, PX + 18, Y0 + H * .25 + 96, { role: 'body', size: 22, min: 12, maxW: PW - 30, lines: 2, col: k.P.hi, alpha: stainA })

      // the detector's counter
      if (st === 1 && p.counter) {
        const lit = k.easeOut(k.clamp((k.since(1) - 1.9) / .4, 0, 1))
        k.seed('ctr'); k.shape(k.rrect(GX - 70, Y0 - 100, 140, 52, 10), { fill: lit > .5 ? k.P.hi : k.P.light, op: .5, sw: 1.2, ink: k.ink })
        k.text(p.counter, GX - 56, Y0 - 64, { role: 'mono', size: 22, min: 11, maxW: 115, lines: 1 })
      }

      let refused = 0
      rows.forEach((r, i) => {
        const y = Y0 + i * DY
        k.text(r.label || '', X0, y + 10, { role: 'body', size: 22, min: 12, maxW: LABW, lines: 2, col: r.exploit ? k.P.hi : k.ink })
        const ok = passes(r, st)
        if (!ok) refused++
        const t = k.thumb ? 1 : k.ease(k.clamp((k.since(st) - .3 - i * .12) / 1.5, 0, 1))
        const endX = ok ? PX - 34 : GX - 34
        const x = k.lerp(SX, endX, t)
        const yy = ok ? k.lerp(y, Y0 + H * .25 + 30 + (i % 3) * 40, k.clamp((t - .7) / .3, 0, 1)) : y
        const tcol = r.exploit ? k.P.hi : (r.alg ? k.P.a : k.P.b)
        // moving tokens are flat (brush bakes are keyed by geometry); a settled one gets the brush
        if (t < 1) k.flat(k.circle(x, yy, 18, 24), tcol, .85)
        else { k.seed('tok' + i + (ok ? 'p' : 'r')); k.shape(k.circle(x, yy, 18, 24), { fill: tcol, op: .85, sw: 1.2, ink: k.ink }) }
        if (!ok && t > .95) {
          k.seed('x' + i)
          k.line([[GX - 56, y - 22], [GX - 12, y + 22]], 3, k.P.hi)
          k.line([[GX - 56, y + 22], [GX - 12, y - 22]], 3, k.P.hi)
        }
      })
      if (refused && p.refused && (st >= 2)) {
        const a = k.thumb ? 1 : k.easeOut(k.clamp((k.since(st) - 2.2) / .5, 0, 1))
        k.text(p.refused, GX + 40, Y0 + H - 20, { role: 'mono', size: 20, min: 11, maxW: 300, lines: 1, col: k.dim, alpha: a })
      }

      k.point = st === 0 ? [PX + PW / 2, Y0 + H * .4] : st === 1 ? [GX, Y0 - 74] : [GX, Y0 + H / 2]
      k.mood = st === 0 ? 'surprised' : st === 3 ? 'proud' : 'thinking'
    },
  }
})())
