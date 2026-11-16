// tiny-tts-roundup / sourcefilter
//
// tiny-voca's waveform head (SourceFilter in model.py), painted. Two sources on the left: a
// band-limited pulse train at the predicted pitch, and white noise. On the right, the filter the
// network predicts once per 10.7 ms frame as a cepstrum, shown as a spectral envelope that morphs
// from one frame's shape to the next. At the bottom, the two shaped sources summed into speech.
// The waveforms and envelopes are toy curves, so the scene is stamped Illustrative. Every string
// drawn is the storyboard's.
//
// steps: 0 pulse train · 1 noise · 2 per-frame filter · 3 shaped and summed
// params: { pulse, noise, filter, frame, out, voiced, unvoiced }
BESPOKE.define((() => {
  const X0 = 140, X1 = 880, N = 220
  // noise samples, fixed once with a small LCG
  const NOISE = (() => {
    let s = 12345; const out = []
    for (let i = 0; i < N; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push(s / 2147483648 * 2 - 1) }
    return out
  })()
  // pitch glides from a slow to a faster period across the window
  const pulses = () => {
    const xs = []; let x = X0 + 10, per = 62
    while (x < X1) { xs.push(x); x += per; per = Math.max(34, per - 2.6) }
    return xs
  }
  const PULSES = pulses()
  // two spectral envelopes (vowel-like with formant peaks, fricative-like with a high tilt)
  const env = (kind, x0, y0, w, h) => {
    const pts = []
    for (let i = 0; i <= 60; i++) {
      const u = i / 60
      let v
      if (kind === 0) v = .55 * Math.exp(-((u - .14) ** 2) / .004) + .4 * Math.exp(-((u - .38) ** 2) / .006) + .25 * Math.exp(-((u - .62) ** 2) / .008) + .12 * (1 - u)
      else v = .08 + .75 * u * u + .1 * Math.exp(-((u - .8) ** 2) / .01)
      pts.push([x0 + u * w, y0 + h - Math.min(1, v) * h])
    }
    return pts
  }
  return {
    plan: () => ({
      min: [4.2, 3.8, 5.0, 5.0],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 10, span: 2.0 },
        { step: 2, at: .4, type: 'ding' },
        { step: 3, at: .5, type: 'ding' },
      ],
      motion: [{ step: 0, from: 0, to: 2.4 }, { step: 1, from: 0, to: 2.0 }, { step: 2, from: 0, to: 4.8 }, { step: 3, from: 0, to: 2.6 }],
    }),
    stampAt: k => [1120, k.top + 600],
    draw(k) {
      const p = k.params, i = k.step
      const top = k.top + 20
      const lab = (s, x, y, col) => k.text(s, x, y, { role: 'label', size: 28, min: 15, maxW: 520, lines: 1, col })

      // 0: pulse train
      const yP = top + 120
      const g0 = k.thumb ? 1 : k.ease(k.p(0, 2.0, .2))
      lab(p.pulse, X0, top + 20)
      k.seed('axisP'); k.line([[X0, yP], [X1, yP]], .5, k.dim)
      PULSES.forEach((x, n) => {
        if ((x - X0) / (X1 - X0) > g0) return
        k.seed('p' + n); k.line([[x, yP], [x, yP - 80]], 1.1, k.P.a)
      })

      // 1: noise
      const yN = top + 290
      if (i >= 1) {
        const g1 = k.thumb ? 1 : k.ease(k.p(1, 1.6, .1))
        lab(p.noise, X0, top + 200)
        const pts = NOISE.slice(0, Math.max(2, Math.floor(N * g1))).map((v, n) => [X0 + (n / (N - 1)) * (X1 - X0), yN + v * 34])
        k.seed('noise'); k.line(pts, .7, k.P.b)
      }

      // 2: the per-frame filter, as an envelope morphing between frames
      const ex = 1000, ey = top + 40, ew = 360, eh = 260
      if (i >= 2) {
        const a = k.thumb ? 1 : k.p(2, .8, 0)
        k.push(); k.alpha(a)
        lab(p.filter, ex, top + 20)
        k.seed('eframe'); k.line(k.rrect(ex - 10, ey + 20, ew + 20, eh + 20, 14), .8, k.dim, { closed: true })
        // the filter swings voiced -> unvoiced -> voiced over the step; on twos it reads as frame steps
        const ph = k.thumb ? 0 : k.since(2)
        const t = .5 - .5 * Math.cos(Math.min(ph, 4.4) / 4.4 * Math.PI * 2)
        const cur = k.morph(env(0, ex, ey + 30, ew, eh - 10), env(1, ex, ey + 30, ew, eh - 10), t, 61)
        k.seed('env'); k.line(cur, 1.4, k.P.hi)
        lab(t < .5 ? p.voiced : p.unvoiced, ex, ey + eh + 80, k.ink)
        k.text(p.frame, ex, ey + eh + 130, { role: 'mono', size: 24, min: 14, maxW: 380, lines: 1, col: k.dim })
        k.pop()
      }

      // 3: shaped and summed
      const yO = top + 560
      if (i >= 3) {
        const g3 = k.thumb ? 1 : k.ease(k.p(3, 2.2, .1))
        lab(p.out, X0, top + 450)
        const pts = []
        for (let n = 0; n < 360; n++) {
          const u = n / 359
          if (u > g3) break
          const x = X0 + u * (X1 - X0)
          // ring after each pulse (a damped resonance) plus noise in the later, unvoiced stretch
          let v = 0
          for (const px of PULSES) { const d = x - px; if (d >= 0 && d < 70) v += Math.exp(-d / 18) * Math.sin(d / 4.2) }
          const unv = u > .62 && u < .82 ? 1 : 0
          v = v * (1 - unv * .85) + unv * NOISE[n % N] * .6
          pts.push([x, yO + v * 70])
        }
        if (pts.length > 1) { k.seed('out'); k.line(pts, 1.0, k.ink) }
        // arrows from the sources and the filter into the output
        const aa = k.thumb ? 1 : k.p(3, .8, 0)
        k.arrow([[X1 + 30, yP - 40], [X1 + 70, yO - 80]], k.dim, .8, aa)
        k.arrow([[X1 + 30, yN], [X1 + 60, yO - 60]], k.dim, .8, aa)
        k.arrow([[ex + ew / 2, ey + eh + 160], [X1 + 90, yO - 40]], k.P.hi, .9, aa)
      }

      k.point = i === 2 ? [ex + ew / 2, ey + eh / 2] : i === 3 ? [X1 - 60, yO] : i === 1 ? [X1 - 80, yN] : [X1 - 80, yP - 40]
      k.mood = i === 3 ? 'proud' : i === 2 ? 'thinking' : 'neutral'
    },
  }
})())
