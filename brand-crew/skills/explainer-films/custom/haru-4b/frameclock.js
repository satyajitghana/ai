// haru-4b / frameclock
//
// The article's DuplexTimeline, as one moving picture. Eight 133 ms frames run
// left to right; three rows hold the user's audio, the model's audio and the
// model's text stream (PAD, EOP, words). A playhead walks the frames while the
// user asks and the model answers after an EOP. Then one column is pulled out:
// its three cells drop and merge into one position, which runs the backbone and
// branches into the next text token and the next audio latent. Then the same
// lanes with a backchannel (the model keeps talking) and with an interruption
// (the model trails off two frames in). Last, the position count for six
// frames: 18 interleaved against 6 summed. A script, not a recording, so the
// runtime stamps it Illustrative.
//
// steps: 0 the clock · 1 one position · 2 backchannel · 3 interruption · 4 the count
// params: { frame, rows: [3], tokens: [8], sum, lm, outs: [2], bc, intr, inter, summed, legend: [5] }
BESPOKE.define((() => {
  const N = 8
  const rnd = (() => { let s = 7 >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  const BARS = Array.from({ length: N * 3 }, () => Array.from({ length: 9 }, () => .25 + rnd() * .75))

  // who is speaking in each frame, per step: 1 = full frame, .5 = half a frame
  const userAt = (step, f) => {
    if (f <= 2) return 1
    if (step === 2 && f === 6) return .5
    if (step === 3 && f >= 5) return 1
    return 0
  }
  const modelAt = (step, f) => {
    if (f < 4) return 0
    if (step === 3) return f <= 5 ? 1 : f === 6 ? .5 : 0
    return 1
  }

  return {
    stampAt: k => [1240, Math.max(k.top + 40, 230) - 10],
    plan: () => ({
      min: [5.2, 5.6, 4.6, 4.6, 4.8],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 8, span: 3.2 },
        { step: 1, at: .4, type: 'whoosh' }, { step: 1, at: 1.6, type: 'thunk' },
        { step: 2, at: .6, type: 'tick' },
        { step: 3, at: .6, type: 'scratch' },
        { step: 4, at: .4, type: 'ticks', n: 6, span: 1.6 }, { step: 4, at: 2.4, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 3.8 }, { step: 1, from: 0, to: 2.6 }, { step: 4, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 40, 230)
      const LX = 300, RX = 1330, CW = (RX - LX) / N
      const rowY = [Y0, Y0 + 96, Y0 + 192], RH = 72
      const cols = [k.P.b, k.P.a, k.P.hi]
      const lane = i <= 1 ? 0 : i

      // frame ticks and the frame label
      for (let f = 0; f <= N; f++) k.flat(k.rect(LX + f * CW - 1, Y0 - 18, 2, 290), k.dim, .35)
      if (p.frame) k.text(p.frame, LX, Y0 - 30, { role: 'mono', size: 24, min: 12, maxW: 520, lines: 1, col: k.dim })
      ;(p.rows || []).forEach((r, j) => k.text(r, 120, rowY[j] + RH * .62, { role: 'label', size: 28, min: 14, maxW: LX - 140, lines: 1, col: cols[j] }))

      // the playhead reveals the frames on step 0; afterwards everything is shown
      const reveal = i === 0 ? (k.thumb ? N : k.p(0, 3.6, .3) * N) : N
      const head = LX + Math.min(N, reveal) * CW
      if (i === 0 && !k.thumb && reveal < N) k.flat(k.rect(head - 2, Y0 - 24, 4, 302), k.ink, .9)

      // audio cells: little bar waveforms inside a rounded cell
      const cell = (row, f, amt, col, bump) => {
        const x = LX + f * CW + 6, y = rowY[row] + 4, w = (CW - 12) * amt, h = RH - 8
        k.seed('c' + row + '_' + f + '_' + amt + '_' + lane)
        k.shape(k.rrect(x, y, w, h, 12), { fill: col, op: .32, sw: .7, ink: col })
        const bars = BARS[(row * N + f) % BARS.length], nb = Math.max(2, Math.floor(9 * amt))
        for (let b = 0; b < nb; b++) {
          const bh = h * .7 * bars[b] * (bump || 1), bx = x + 10 + b * (w - 20) / Math.max(1, nb - 1)
          k.flat(k.rect(bx - 3, y + h / 2 - bh / 2, 6, bh), col, .95)
        }
      }
      for (let f = 0; f < N; f++) {
        if (f + 1 > reveal + .001) continue
        const u = userAt(lane, f), m = modelAt(lane, f)
        if (u) cell(0, f, u, cols[0])
        if (m) cell(1, f, m, cols[1])
        let tok = (p.tokens || [])[f] || ''
        if (lane === 3 && f >= 6) tok = (p.tokens || [])[0] || ''
        if (tok) {
          const word = !/^(PAD|EOP)$/.test(tok)
          k.flat(k.rrect(LX + f * CW + 8, rowY[2] + 8, CW - 16, RH - 24, 10), word ? cols[2] : k.dim, word ? .85 : .3)
          k.text(tok, LX + f * CW + CW / 2, rowY[2] + RH * .5, { role: 'mono', size: 22, min: 11, maxW: CW - 24, lines: 1, align: 'center', col: word ? k.textOn(cols[2]) : k.ink })
        }
      }

      // backchannel / interruption labels on the user lane
      if (lane === 2 && p.bc) k.text(p.bc, LX + 6 * CW, rowY[0] - 8, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: cols[0] })
      if (lane === 3 && p.intr) k.text(p.intr, LX + 5 * CW, rowY[0] - 8, { role: 'label', size: 24, min: 12, maxW: 420, lines: 1, col: cols[0] })
      if (lane === 3) k.flat(k.rect(LX + 6.5 * CW - 2, rowY[1] - 6, 4, RH + 12), k.P.hi, .9)

      const low = Y0 + 330
      // step 1: one column becomes one position
      if (i === 1) {
        const c = 4, cx = LX + c * CW + CW / 2
        k.hl(LX + c * CW, Y0 - 14, CW, 282, k.P.light, k.thumb ? 1 : k.p(1, .5, 0))
        const drop = k.thumb ? 1 : k.easeOut(k.p(1, 1.2, .5))
        const merge = k.thumb ? 1 : k.ease(k.p(1, .8, 1.6))
        const by = low + 30
        ;[0, 1, 2].forEach(j => {
          const y = rowY[j] + (by - rowY[j]) * drop
          const x = cx - 150 + j * 100 + (cx - 40 - (cx - 150 + j * 100)) * merge
          k.flat(k.rrect(x, y, 80, 56, 10), cols[j], .8 * (1 - merge * .6))
          if (j < 2 && merge < .5) k.text('+', cx - 150 + j * 100 + 88, by + 40, { role: 'head', size: 34, col: k.ink, alpha: drop * (1 - merge * 2) })
        })
        if (merge > 0) {
          k.push(); k.alpha(merge)
          k.seed('pos'); k.shape(k.rrect(cx - 70, by - 6, 140, 68, 14), { fill: k.P.light, op: .5, sw: 1 })
          if (p.sum) k.text(p.sum, cx + 90, by + 40, { role: 'label', size: 26, min: 13, maxW: 360, lines: 1 })
          k.pop()
        }
        const run = k.thumb ? 1 : k.p(1, .8, 2.4)
        if (run > 0) {
          k.push(); k.alpha(run)
          k.arrow([[cx, by + 66], [cx, by + 120]], k.ink, 1, run)
          k.seed('lm'); k.shape(k.rrect(LX, by + 128, RX - LX, 64, 16), { fill: k.P.a, op: .25, sw: .9 })
          if (p.lm) k.text(p.lm, (LX + RX) / 2, by + 170, { role: 'label', size: 28, min: 14, maxW: RX - LX - 40, lines: 1, align: 'center' })
          const outs = p.outs || []
          outs.forEach((o, j) => {
            const ox = cx + (j ? 260 : -260)
            k.arrow([[cx, by + 196], [ox, by + 250]], cols[2 - j], 1, run)
            k.text(o, ox, by + 290, { role: 'label', size: 26, min: 13, maxW: 360, lines: 1, align: 'center', col: cols[2 - j] })
          })
          k.pop()
        }
      }

      // step 4: positions for six frames, interleaved against summed
      if (i === 4) {
        const t = k.thumb ? 1 : k.p(4, 1.6, .3)
        const sq = 44, gap = 10, ax = LX
        const shown = Math.floor(t * 18 + .001)
        for (let q = 0; q < 18; q++) {
          if (q >= shown) break
          k.flat(k.rrect(ax + q * (sq + gap), low + 10, sq, sq, 8), cols[[0, 2, 1][q % 3]], .85)
        }
        if (p.inter) k.text(p.inter, ax, low - 4, { role: 'label', size: 26, min: 13, maxW: 900, lines: 1 })
        const t2 = k.thumb ? 1 : k.p(4, 1, 1.9)
        const shown2 = Math.floor(t2 * 6 + .001)
        for (let q = 0; q < shown2; q++) {
          const x = ax + q * (3 * (sq + gap)), y = low + 130
          ;[0, 1, 2].forEach(j => k.flat(k.rect(x, y + j * (sq / 3), 3 * sq + 2 * gap, sq / 3), cols[j], .85))
        }
        if (p.summed) k.text(p.summed, ax, low + 116, { role: 'label', size: 26, min: 13, maxW: 900, lines: 1 })
      }

      // the legend for this beat
      const leg = (p.legend || [])[i]
      if (leg && i !== 1) k.text(leg, 120, Math.min(900, i === 4 ? Y0 + 600 : Y0 + 400), { role: 'head', size: 32, min: 16, maxW: 1200, lines: 2 })

      k.point = i === 1 ? [LX + 4.5 * CW, low + 60] : i === 4 ? [LX + 300, low + 80] : i === 0 ? [head, Y0 + 100] : [LX + 6.5 * CW, rowY[1] + 30]
      k.mood = i === 2 ? 'happy' : i === 3 ? 'surprised' : i === 4 ? 'proud' : 'thinking'
    },
  }
})())
