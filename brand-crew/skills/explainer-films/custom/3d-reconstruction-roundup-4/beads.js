// 3d-reconstruction-roundup-4 / beads
//
// The article's SegmentKernel widget: a line ten units long in the image
// plane, kernel width one, drawn as K Gaussian points of the same total mass
// or as one segment convolved with the same kernel. Under it, the density
// along the centre line. Five points bead, six nearly smooth, seven smooth;
// the segment has a flat top with no ripple. Then the segment is cut in two
// and the halves slide apart and back: the profile is the parent's. The
// ripple figures are the article's toy's, carried as storyboard strings; the
// drawing is computed, so the runtime stamps it Illustrative.
//
// steps: 0 five points · 1 six · 2 seven · 3 one segment · 4 cut in two
// params: { ripple: [5 strings], profile, legend: [5] }
BESPOKE.define((() => {
  const L = 10, SIG = 1
  const g = x => Math.exp(-x * x / (2 * SIG * SIG))
  const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
  const pointsProfile = (K, x) => { let s = 0; for (let j = 0; j < K; j++) s += g(x - L * j / (K - 1)); return s * L / (K - 1) / Math.sqrt(2 * Math.PI) / SIG }
  const segProfile = (a, b, x) => .5 * (erf((x - a) / (Math.SQRT2 * SIG)) - erf((x - b) / (Math.SQRT2 * SIG)))
  return {
    stampAt: k => [1230, Math.max(k.top + 90, 300) + 60],
    plan: () => ({
      min: [3.6, 3, 3, 3.6, 4.8],
      events: [{ step: 0, at: .3, type: 'pop' }, { step: 1, at: .2, type: 'pop' }, { step: 2, at: .2, type: 'pop' }, { step: 3, at: .3, type: 'draw' }, { step: 4, at: .4, type: 'slide' }, { step: 4, at: 2.6, type: 'ding' }],
      motion: [{ step: 4, from: 0, to: 3.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const X0 = 300, U = 70, Y0 = Math.max(k.top + 90, 300), PY = Y0 + 300, PH = 170
      const px = x => X0 + x * U
      const K = [5, 6, 7][Math.min(i, 2)]
      // the primitives
      if (i <= 2) {
        for (let j = 0; j < K; j++) {
          const cx = px(L * j / (K - 1)), a = k.thumb ? 1 : k.backOut(k.p(i, .4, .1 + j * .06)); if (a <= 0) continue
          ;[2.2, 1.5, .8].forEach((r, q) => k.flat(k.circle(cx, Y0, r * SIG * U * .55 * a, 28), k.P.a, [.18, .28, .5][q]))
        }
      } else {
        // the segment (or its two halves) as its density, strip by strip: what the kernel actually lays down
        const c = i === 4 ? (k.thumb ? 0 : Math.round(20 * Math.sin(Math.PI * Math.min(1, k.p(4, 2.4, .4)))) / 20) : 0
        const dens = x => i === 4 ? segProfile(-c * .9, L / 2 - c * .9, x) + segProfile(L / 2 + c * .9, L + c * .9, x) : segProfile(0, L, x)
        const n = 112, sw = (L + 4) * U / n
        for (let q = 0; q < n; q++) {
          const x = -2 + (L + 4) * (q + .5) / n, d = dens(x); if (d < .02) continue
          ;[2.2, 1.5, .8].forEach((r, qq) => { const h = r * SIG * U * .55; k.flat(k.rect(px(x) - sw / 2, Y0 - h, sw + .6, 2 * h), k.P.b, [.18, .28, .5][qq] * Math.min(1, d)) })
        }
        const halves = i === 4 ? [[-c * .9, L / 2 - c * .9], [L / 2 + c * .9, L + c * .9]] : [[0, L]]
        halves.forEach(([a, b]) => k.flat(k.rect(px(a), Y0 - 3, (b - a) * U, 6), k.ink, .8))
      }
      // the density along the centre line
      k.seed('axis'); k.line([[px(-2), PY + PH], [px(L + 2), PY + PH]], .7, k.dim)
      const cutP = i === 4 ? (k.thumb ? 0 : Math.round(20 * Math.sin(Math.PI * Math.min(1, k.p(4, 2.4, .4)))) / 20) : 0
      const prof = []
      for (let q = 0; q <= 120; q++) {
        const x = -2 + (L + 4) * q / 120
        const y = i <= 2 ? pointsProfile(K, x) : i === 4 ? segProfile(-cutP * .9, L / 2 - cutP * .9, x) + segProfile(L / 2 + cutP * .9, L + cutP * .9, x) : segProfile(0, L, x)
        prof.push([px(x), PY + PH - y * PH * .9])
      }
      k.seed('prof' + (i <= 2 ? K : 'seg' + cutP)); k.line(prof, 1.4, i <= 2 ? k.P.a : k.P.b)
      if (p.profile) k.text(p.profile, px(-2), PY + PH + 40, { role: 'mono', size: 22, min: 11, maxW: 900, lines: 1, col: k.dim })
      if (p.ripple && p.ripple[i]) k.text(p.ripple[i], px(L + 2) + 30, PY + PH * .45, { role: 'head', size: 40, min: 16, maxW: 1370 - px(L + 2) - 30, lines: 3 })
      if (p.legend && p.legend[i]) k.text(p.legend[i], X0 - 80, Y0 - 130, { role: 'label', size: 28, min: 14, maxW: 1000, lines: 1 })
      k.point = [px(L / 2), i === 4 ? Y0 : PY + 40]
      k.mood = i === 3 ? 'happy' : i === 4 ? 'surprised' : 'thinking'
    },
  }
})())
