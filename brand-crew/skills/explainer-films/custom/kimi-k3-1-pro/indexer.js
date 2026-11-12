// kimi-k3-1-pro / indexer
//
// What the 120 new tensors appear to do, as the article reads them (DeepSeek's
// lightning indexer; the repository ships no modelling code). In K3 a
// full-attention layer reads every earlier token. In K3.1 Pro a small indexer
// scores every earlier token with one small key each, and only the top-k reach
// the real attention. As the context grows, attention still reads k entries;
// the price is a slightly bigger cache per token in those layers. Token counts
// and scores are a toy (k is 6 here, 2,048 in the model), so the runtime stamps
// it Illustrative; the model's numbers are storyboard strings.
//
// steps: 0 dense, as in K3 · 1 the indexer scores · 2 top-k only · 3 a longer context · 4 the cache
// params: { mla, indexer, newTok, legend: [5], cache: [2] }
BESPOKE.define((() => {
  let s = 9 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const NMAX = 150, KEEP = 6
  const score = Array.from({ length: NMAX }, () => Math.pow(rnd(), 2.2))
  const topOf = n => new Set(score.slice(0, n).map((v, j) => [v, j]).sort((a, b) => b[0] - a[0]).slice(0, KEEP).map(x => x[1]))
  return {
    stampAt: k => [1230, Math.max(k.top + 50, 260) + 20],
    plan: () => ({
      min: [3.6, 4, 3.8, 4.2, 4.4],
      events: [{ step: 0, at: .3, type: 'flow' }, { step: 1, at: .2, type: 'ticks', n: 20, span: 2 }, { step: 2, at: .4, type: 'ding' }, { step: 3, at: .3, type: 'grow' }, { step: 4, at: .3, type: 'grow' }],
      motion: [{ step: 1, from: 0, to: 2.4 }, { step: 2, from: 0, to: 1.4 }, { step: 3, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 50, 260), SY = Y0 + 360, X0 = 170, X1 = 1060
      const n = i < 3 ? 40 : Math.round(40 + (NMAX - 40) * (k.thumb || i > 3 ? 1 : k.ease(k.p(3, 2, .3))))
      const top = topOf(n), dx = (X1 - X0) / n
      const MX = 470, MW = 330, MY = Y0, MH = 90
      // attention box
      k.seed('mla'); k.shape(k.rrect(MX, MY, MW, MH, 14), { fill: k.P.a, op: .8, sw: 1 })
      if (p.mla) k.text(p.mla, MX + MW / 2, MY + MH / 2 + 10, { role: 'label', size: 28, min: 12, align: 'center', maxW: MW - 20, lines: 1, col: k.textOn(k.P.a) })
      // the new token
      const NX = 1170, NY = SY
      k.flat(k.rect(NX - 18, NY - 18, 36, 36), k.P.hi, 1)
      if (p.newTok) k.text(p.newTok, NX - 60, NY + 60, { role: 'mono', size: 22, min: 11, maxW: 220, lines: 1, col: k.dim })
      // earlier tokens, and which of them reach attention
      const sk = i >= 1 ? (k.thumb || i > 1 ? 1 : k.p(1, 2, .3)) : 0
      const filt = i >= 2 ? (k.thumb || i > 2 ? 1 : k.ease(k.p(2, 1, .2))) : 0
      for (let j = 0; j < n; j++) {
        const x = X0 + (j + .5) * dx, w = Math.max(3, dx * .7), hit = top.has(j)
        k.flat(k.rect(x - w / 2, SY - 14, w, 28), hit && i >= 2 ? k.P.a : k.mix(k.paper, k.ink, .45), 1)
        // score bar, rising as the indexer passes over it
        const reach = Math.max(0, Math.min(1, sk * 1.3 - j / n * .3))
        if (reach > 0) k.flat(k.rect(x - w / 2, SY - 24 - score[j] * 120 * reach, w, score[j] * 120 * reach), hit && i >= 2 ? k.P.hi : k.P.b, i >= 2 && !hit ? .35 : .85)
        // a read into attention: every token in K3; only the kept ones after the filter
        const a = i === 0 ? (k.thumb ? 1 : k.p(0, 1.2, .3)) * .5 : hit ? 1 : (1 - filt) * .5 * (i === 1 ? 1 : 1)
        if (a > .02 && (i === 0 || i === 1 || hit)) { k.seed('rd' + j + ':' + n); k.line([[x, SY - 30 - (i >= 1 ? score[j] * 120 : 0)], [MX + MW * (.15 + .7 * j / n), MY + MH]], hit && i >= 2 ? 1.1 : .4, hit && i >= 2 ? k.P.a : k.dim) }
      }
      // the indexer, between the new token and the strip
      if (i >= 1) {
        const ik = k.thumb ? 1 : k.easeOut(k.p(1, .6, .1)), IX = 960, IY = Y0 + 150
        k.push(); k.alpha(ik)
        k.seed('ix'); k.shape(k.rrect(IX, IY, 250, 70, 12), { fill: k.P.b, op: .75, sw: .9 })
        if (p.indexer) k.text(p.indexer, IX + 125, IY + 44, { role: 'label', size: 24, min: 11, align: 'center', maxW: 230, lines: 1, col: k.textOn(k.P.b) })
        k.seed('q2ix'); k.arrow([[NX, NY - 22], [IX + 200, IY + 74]], k.ink, .9, 1)
        k.pop()
      }
      // the cache, per token, in those layers
      if (i >= 4 && p.cache) {
        const ck = k.thumb ? 1 : k.easeOut(k.p(4, 1.2, .2)), CX = 170, CY = SY + 90, U = 1.1
        k.flat(k.rect(CX, CY, 576 * U, 34), k.P.a, .85)
        k.flat(k.rect(CX + 576 * U, CY, 128 * U * ck, 34), k.P.hi, .95)
        k.text(p.cache[0], CX + 10, CY + 25, { role: 'mono', size: 20, min: 10, maxW: 576 * U - 20, lines: 1, col: k.textOn(k.P.a) })
        k.text(p.cache[1], CX + 576 * U + 140 * U, CY + 25, { role: 'mono', size: 20, min: 10, maxW: 360, lines: 1, alpha: ck })
      }
      if (p.legend && p.legend[i]) k.text(p.legend[i], 170, Y0 + 40, { role: 'head', size: 30, min: 14, maxW: 290, lines: 4 })
      k.point = i === 0 ? [MX + MW, MY + MH] : i === 1 ? [960, Y0 + 185] : i === 4 ? [900, SY + 105] : [X0 + 400, SY - 40]
      k.mood = i === 2 ? 'happy' : i === 3 ? 'surprised' : 'thinking'
    },
  }
})())
