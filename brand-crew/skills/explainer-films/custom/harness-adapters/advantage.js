// harness-adapters / advantage
//
// The reward section of the article, painted: GRPO turns eight rollouts of one task into
// advantages, (reward - group mean) / group spread. Two groups, both from the article's
// own worked arithmetic (data: article):
//   mixed  - three of eight correct, with 6, 9 and 12 tool calls: the bonus barely matters.
//   allok  - all eight correct, with 5 ... 20 calls: the tiny bonus becomes the whole signal.
// Each column is a rollout: a chip with its tool-call count (or "fail"), then a bar for its
// advantage that grows up or down from a zero line, labelled with the article's value.
// Every string drawn is a storyboard string; bar heights are the article's numbers.
//
// params: { data: "article", zero, groups: { mixed|allok: { calls[8], adv[8] (numbers), advText[8] } } }
// steps:  { group: "mixed"|"allok", show: "calls"|"adv", label }
BESPOKE.define((() => {
  const G = 8
  return {
    plan: (params, steps) => ({
      min: steps.map(() => 4.2),
      events: steps.map((s, i) => (s.show === 'adv' ? { step: i, at: .4, type: 'ticks', n: 8, span: 1.1 } : { step: i, at: .2, type: 'pop' })),
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 2.0 })),
    }),
    draw(k) {
      const p = k.params, s = k.s || {}, i = k.step
      const g = p.groups[s.group] || p.groups.mixed
      const top = k.top + 20
      const X0 = 200, DX = 145, CHIP = top + 110, ZERO = top + 440, UNIT = 170
      const PASS = k.P.hi

      k.text(s.label || '', X0 - 60, top + 30, { role: 'head', size: 40, min: 18, maxW: 1150, lines: 1 })

      // zero line
      k.seed('zero' + s.group)
      k.line([[X0 - 70, ZERO], [X0 + (G - 1) * DX + 70, ZERO]], .9, k.dim)
      k.text(p.zero, X0 - 70, ZERO - 14, { role: 'label', size: 24, min: 14, maxW: 120, lines: 1, col: k.dim })

      const showAdv = s.show === 'adv'
      for (let b = 0; b < G; b++) {
        const x = X0 + b * DX
        const label = g.calls[b]
        const ok = label !== p.fail
        const inT = k.thumb ? 1 : k.easeOut(k.p(i, .6, .05 + b * .06))
        k.push(); k.alpha(inT)
        k.seed(`chip-${s.group}-${b}`)
        if (ok) k.shape(k.rrect(x - 52, CHIP - 40, 104, 70, 16), { fill: PASS, op: 1, sw: .9 })
        else k.line(k.rrect(x - 52, CHIP - 40, 104, 70, 16), 1.0, k.ink, { closed: true })
        k.text(label, x, CHIP + 8, { role: 'mono', size: 30, min: 14, maxW: 96, lines: 1, align: 'center', col: ok ? k.textOn(PASS) : k.ink })
        k.pop()

        if (showAdv) {
          const a = g.adv[b]
          const grow = k.thumb ? 1 : k.expoOut(k.p(i, 1.2, .3 + b * .08))
          const h = a * UNIT * grow
          if (Math.abs(h) > 1) {
            k.seed(`bar-${s.group}-${b}`)
            const y0 = Math.min(ZERO, ZERO - h), y1 = Math.max(ZERO, ZERO - h)
            k.shape(k.rect(x - 34, y0, 68, y1 - y0), { fill: a > 0 ? PASS : k.P.b, op: .95, sw: .8 })
          }
          const lt = k.thumb ? 1 : k.ease(k.p(i, .5, 1.2 + b * .08))
          k.push(); k.alpha(lt)
          const ty = a >= 0 ? ZERO - a * UNIT - 16 : ZERO - a * UNIT + 40
          k.text(g.advText[b], x, ty, { role: 'mono', size: 26, min: 14, maxW: 130, lines: 1, align: 'center' })
          k.pop()
        }
      }

      k.point = showAdv ? [X0 + 0 * DX, ZERO - g.adv[0] * UNIT] : [X0 + 3.5 * DX, CHIP]
      k.mood = showAdv && s.group === 'allok' ? 'excited' : showAdv ? 'happy' : 'thinking'
    },
  }
})())
