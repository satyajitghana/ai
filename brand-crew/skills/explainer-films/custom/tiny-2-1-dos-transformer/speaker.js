// tiny-2-1-dos-transformer / speaker
//
// The article's SpeakerVoice widget as a moving picture: what the PC speaker
// can do, and how TINY.C fakes speech with it. A strip of square wave scrolls
// across the frame. Beat 0: one pitch, on or off, the only thing the speaker
// can play. Beat 1: a vowel, two pitches swapped every 2 ms (the wave visibly
// changes period back and forth). Beat 2: a hiss, a new random pitch every
// millisecond. Beat 3: a word laid out as a timeline of buzzes, hisses and
// clicks. Periods are drawn to scale with each other, not in real time.
// Stamped Illustrative; every label is a storyboard string.
//
// params: { one, vowel, hiss, word, lo, hi }
BESPOKE.define((() => {
  // the segments of "whale" as say_letter() makes them: w l r buzz, h hiss,
  // a buzz, l buzz, e buzz (durations in ms from TINY.C)
  const WORD = [['w', 'buzz', 36], ['h', 'hiss', 30], ['a', 'buzz', 64], ['l', 'buzz', 36], ['e', 'buzz', 56]]

  // a square wave as a polyline: period(x) gives the half-period in px at x
  function square(x0, x1, yMid, amp, half, phase) {
    const pts = []
    let x = x0 - (phase % (2 * half(x0)))
    let hi = true
    pts.push([x0, yMid - amp])
    while (x < x1) {
      const h = half(Math.max(x, x0))
      const nx = Math.min(x1, x + h)
      const y = yMid + (hi ? -amp : amp)
      pts.push([Math.max(x, x0), y], [nx, y])
      if (nx < x1) pts.push([nx, yMid + (hi ? amp : -amp)])
      hi = !hi
      x = nx
    }
    return pts
  }

  return {
    stampAt: k => [1180, k.top + 20],
    plan: () => ({
      min: [4.0, 4.6, 4.0, 5.0],
      events: [{ step: 0, at: .3, type: 'pop' }, { step: 1, at: .3, type: 'ticks', n: 12, span: 1.4 },
        { step: 2, at: .3, type: 'ticks', n: 20, span: 1.2 }, { step: 3, at: .4, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 140, X1 = 1360, Y = Math.max(k.top + 220, 440), AMP = 70
      const scroll = k.thumb ? 0 : k.lt * 90
      const rng = k.rng('hiss')
      const rand = Array.from({ length: 400 }, () => rng())
      // the speaker cone, a small symbol at the left
      k.seed('cone'); k.shape([[X0 - 10, Y - 30], [X0 + 20, Y - 30], [X0 + 60, Y - 70], [X0 + 60, Y + 70], [X0 + 20, Y + 30], [X0 - 10, Y + 30]], { fill: k.P.light, op: .6, sw: 1 })
      const L = X0 + 100

      if (st <= 2) {
        let half
        if (st === 0) half = () => 26
        else if (st === 1) half = x => (Math.floor((x + scroll) / 120) % 2 === 0 ? 30 : 13)
        else half = x => 4 + Math.floor(rand[Math.floor((x + scroll) / 18) % 400] * 12)
        const a = k.thumb ? 1 : k.easeOut(k.p(st, .6, .1))
        k.seed('wave' + st)
        k.line(k.partial(square(L, X1, Y, AMP, half, scroll), a), 1.3, st === 2 ? k.P.hi : k.P.a)
        const label = [p.one, p.vowel, p.hiss][st]
        if (label) k.text(label, X0, Y + AMP + 70, { role: 'head', size: 40, min: 16, maxW: 1100, lines: 2, alpha: a })
        if (st === 1) {
          // mark the two alternating periods
          if (p.lo) k.text(p.lo, L + 10, Y - AMP - 60, { role: 'mono', size: 28, min: 12, maxW: 300, lines: 1, col: k.P.a })
          if (p.hi) k.text(p.hi, L + 380, Y - AMP - 60, { role: 'mono', size: 28, min: 12, maxW: 300, lines: 1, col: k.P.b })
        }
      } else {
        // the word as a timeline
        const total = WORD.reduce((s, w) => s + w[2], 0)
        const W = X1 - L
        let x = L
        const a = k.thumb ? 1 : k.easeOut(k.p(3, 1.6, .1))
        WORD.forEach(([ch, kind, ms], i) => {
          const w = (ms / total) * W
          const on = a * WORD.length > i
          if (!on) { x += w; return }
          k.seed('seg' + i)
          k.shape(k.rect(x + 3, Y - AMP, w - 6, 2 * AMP), { fill: kind === 'hiss' ? k.P.hi : k.P.a, op: .45, sw: .8 })
          k.text(ch, x + w / 2 - 10, Y - 24, { role: 'head', size: 48, min: 20, maxW: 60, lines: 1 })
          x += w
        })
        if (p.word) k.text(p.word, X0, Y + AMP + 70, { role: 'head', size: 40, min: 16, maxW: 1100, lines: 2, alpha: a })
      }
      k.point = [L + 200, Y]
      k.mood = st === 3 ? 'happy' : st === 2 ? 'surprised' : 'thinking'
    },
  }
})())
