// tokin-token-native-rollouts / drift
//
// The article's RetokenDrift widget, cut down to one short assistant turn: the
// ids the model sampled on top, and below them the ids you get by rendering
// the next request through the chat template and encoding it again. With
// canonical text they match. A non-canonical split (" rollout" + "s" against
// " roll" + "outs") changes two ids at the same length; a trimmed blank line
// changes a third; and a new user message makes the template drop the think
// block, so every later id shifts left while its recorded logprob stays where
// it was. The ids are Qwen3.5's, from the article; the turn is constructed, so
// the runtime stamps the scene Illustrative.
//
// steps: 0 sampled · 1 canonical: same ids · 2 the model sampled a split and a blank line · 3 think block dropped
// params: { top, bottom, chips: [canonical "piece id", ...], sampled: { 3: "piece id", 5: ..., 6: ... } (what the model drew instead, from step 2), legend: [4] }
BESPOKE.define((() => {
  const THINK = [0, 1, 2, 3, 4]   // chips inside the think block
  return {
    stampAt: k => [1250, Math.max(k.top + 60, 270) + 440],
    plan: () => ({
      min: [3.6, 3.2, 5, 5],
      events: [{ step: 0, at: .2, type: 'ticks', n: 8, span: 1.4 }, { step: 1, at: .3, type: 'slide' }, { step: 2, at: .4, type: 'scratch' }, { step: 2, at: 1.6, type: 'scratch' }, { step: 3, at: .4, type: 'whoosh' }],
      motion: [{ step: 0, from: 0, to: 1.8 }, { step: 1, from: 0, to: 1.2 }, { step: 3, from: 0, to: 2.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, chips = p.chips || []
      const Y0 = Math.max(k.top + 70, 280), AY = Y0, BY = Y0 + 250, X0 = 170, H = 70, GAP = 10
      const piece = s => s.split(' ').slice(0, -1).join(' ') || s.split(' ')[0]
      const id = s => { const w = s.split(' '); return w.length > 1 ? w[w.length - 1] : '' }
      const style = { role: 'mono', size: 26, min: 12 }
      const wOf = s => Math.max(86, k.measure(piece(s), style).w + 28)
      // top row: sampled, with a logprob tick under each
      let x = X0; const ax = []
      const alt = p.sampled || {}
      const altK = j => i >= 2 && alt[j] ? (k.thumb ? 1 : k.p(2, .5, j === 3 ? 1.6 : .4)) : 0
      const wOf2 = (c, j) => Math.max(wOf(c), alt[j] ? wOf(alt[j]) : 0)
      chips.forEach((c0, j) => {
        const c = altK(j) > .5 ? alt[j] : c0
        const a = k.thumb ? 1 : k.backOut(k.span(.1 + j * .12, .4 + j * .12)); const w = wOf2(c0, j); ax.push([x, w])
        if (a > 0) {
          k.flat(k.rect(x, AY, w, H), altK(j) > .5 ? k.mix(k.paper, k.P.hi, .55) : k.mix(k.paper, k.P.b, .35), a)
          k.text(piece(c), x + w / 2, AY + 32, { ...style, align: 'center', maxW: w - 10, lines: 1, alpha: a })
          if (id(c)) k.text(id(c), x + w / 2, AY + 60, { role: 'mono', size: 18, min: 10, align: 'center', col: k.dim, alpha: a })
          k.flat(k.circle(x + w / 2, AY + H + 26, 8, 10), k.P.b, a)
        }
        x += w + GAP
      })
      if (p.top) k.text(p.top, X0, AY - 22, { role: 'label', size: 24, min: 12, maxW: 1100, lines: 1 })
      // bottom row: re-rendered and re-encoded
      if (i >= 1) {
        const bk = k.thumb ? 1 : k.easeOut(k.p(1, .8, .1))
        const changed = i >= 2 ? alt : {}
        const dropK = i >= 3 ? (k.thumb ? 1 : k.ease(k.p(3, 1.6, .4))) : 0
        let shift = 0
        THINK.forEach(j => { if (ax[j]) shift += ax[j][1] + GAP })
        if (p.bottom) k.text(p.bottom, X0, BY + H + 34, { role: 'label', size: 24, min: 12, maxW: 1100, lines: 1, alpha: bk })
        chips.forEach((c, j) => {
          if (!ax[j]) return
          const inThink = THINK.includes(j)
          const ck = changed[j] && (k.thumb ? 1 : k.p(2, .5, j === 3 ? 1.6 : .4))
          const txt = c
          const [cx, w] = ax[j]
          const xx = inThink ? cx : cx - shift * dropK
          const fall = inThink ? dropK : 0
          const yy = BY + fall * 120, a = bk * (1 - fall)
          if (a <= 0) return
          const bad = ck > .5 || (dropK > .5 && !inThink)
          k.flat(k.rect(xx, yy, w, H), bad ? k.mix(k.paper, k.P.a, .55) : k.mix(k.paper, k.P.b, .35), a)
          k.text(piece(txt), xx + w / 2, yy + 32, { ...style, align: 'center', maxW: w - 10, lines: 1, alpha: a })
          if (id(txt)) k.text(id(txt), xx + w / 2, yy + 60, { role: 'mono', size: 18, min: 10, align: 'center', col: bad ? k.P.a : k.dim, alpha: a })
          // the trainer lines logprobs up by position: show which recorded tick each one now meets
          if (bad && !inThink && dropK > .5) { k.seed('mis' + j); k.line([[xx + w / 2, yy - 6], [cx + w / 2, AY + H + 36]], .6, k.P.a, { dash: [6, 6] }) }
        })
      }
      if (p.legend && p.legend[i]) k.text(p.legend[i], X0, BY + 200, { role: 'head', size: 34, min: 16, maxW: 1100, lines: 2 })
      k.point = i === 2 ? [ax[5] ? ax[5][0] + 40 : 800, BY] : i === 3 ? [X0 + 300, BY + 60] : [X0 + 900, AY + 40]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
