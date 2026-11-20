// jeveration / shared
//
// The article's SharedState widget, painted. A toy prompt admits two pictures: day with the
// island on the right, night with the island on the left. Each picture is a 16 by 8 grid of
// codes (128 cells, as Jeveration decides 128 codes). Three ways to fill the grid:
//   mode 'independent'  every cell flips its own coin between the two pictures (Eq. 1):
//                       a double exposure, the left ear of one picture and the right of another
//   mode 'shared'       one random state, drawn as a strip of noise, is read by every cell, and
//                       all cells follow the picture it selects (Eq. 3); `pick` is which picture
// The coins come from k.rng, so this is a simulation and is stamped Illustrative.
// Every string drawn is the storyboard's.
//
// params: { state, legend: [per step] }
// steps:  { mode: 'independent' | 'shared', pick: 0 | 1 }
BESPOKE.define((() => {
  const C = 16, R = 8
  const SKY = 0, NIGHT = 1, SUN = 2, MOON = 3, SEA = 4, LAND = 5
  function picture(night, islandLeft) {
    const g = []
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      let v = night ? NIGHT : SKY
      const bc = islandLeft ? 11 : 2
      if (r >= 1 && r <= 2 && c >= bc && c <= bc + 2) v = night ? MOON : SUN
      if (r >= 5) v = SEA
      const ic = islandLeft ? 2 : 9
      if (r === 4 && c >= ic + 1 && c <= ic + 3) v = LAND
      if (r === 5 && c >= ic && c <= ic + 4) v = LAND
      g.push(v)
    }
    return g
  }
  const PICS = [picture(false, false), picture(true, true)]

  return {
    plan: (params, steps) => ({
      min: steps.map(() => 4.2),
      events: steps.map((s, i) => ({ step: i, at: .25, type: s.mode === 'shared' ? 'pop' : 'ticks', n: 16, span: 1.2 })),
      motion: steps.map((_, i) => ({ step: i, from: 0, to: 2.0 })),
    }),
    stampAt: k => [1250, k.top + 40],
    draw(k) {
      const p = k.params, i = k.step, s = k.s || {}
      const tones = [
        k.mix('#8ECAE6', k.paper, .15), k.mix('#1D2B53', k.paper, .1), k.mix('#FFB703', k.paper, .1),
        k.mix('#E9ECEF', k.ink, .08), k.mix('#219EBC', k.paper, .15), k.mix('#6A994E', k.paper, .1),
      ]
      const shared = s.mode === 'shared'
      const pick = s.pick || 0
      const CS = 50, GX = 500, GY = Math.max(k.top + 110, 300)
      const r = k.rng('coins-' + i)
      const coins = Array.from({ length: C * R }, () => (r() < .5 ? 0 : 1))

      // the random state: a strip of noise on the left, only in shared steps
      const SX = 170, SW = 150, SH = R * CS
      if (shared) {
        const a = k.thumb ? 1 : k.easeOut(k.p(i, .8, .1))
        const nr = k.rng('state-' + i)
        k.push(); k.alpha(a)
        for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) {
          k.flat(k.rect(SX + x * (SW / 6), GY + y * (SH / 16), SW / 6 - 2, SH / 16 - 2), k.mix(k.paper, k.ink, .15 + .6 * nr()), 1)
        }
        k.pop()
        if (p.state) k.text(p.state, SX, GY - 24, { role: 'label', size: 28, min: 14, maxW: 300, lines: 1 })
        const ar = k.thumb ? 1 : k.ease(k.p(i, .8, .7))
        for (let j = 0; j < 3; j++) {
          const y = GY + SH * (.2 + .3 * j)
          if (ar > 0) k.arrow([[SX + SW + 12, y], [GX - 16, y]], k.P.hi, 1.2, ar)
        }
      }

      // the 128 cells, filled left to right
      for (let j = 0; j < C * R; j++) {
        const cx = j % C, cy = Math.floor(j / C)
        const src = shared ? pick : coins[j]
        const t = k.thumb ? 1 : k.easeOut(k.p(i, .6, (shared ? 1.0 : .2) + (cx + cy) * .025))
        if (t <= 0) {
          k.flat(k.rect(GX + cx * CS + 1, GY + cy * CS + 1, CS - 2, CS - 2), k.mix(k.paper, k.ink, .06), 1)
          continue
        }
        k.flat(k.rect(GX + cx * CS + 1, GY + cy * CS + 1, CS - 2, CS - 2), tones[PICS[src][j]], t)
      }
      k.seed('frame'); k.line(k.rect(GX - 4, GY - 4, C * CS + 8, R * CS + 8), .9, k.ink, { closed: true })

      const leg = (p.legend || [])[i]
      if (leg) k.text(leg, GX, GY + R * CS + 60, { role: 'head', size: 38, min: 18, maxW: C * CS, lines: 2 })

      k.point = [GX + C * CS * .5, GY + R * CS * .5]
      k.mood = shared ? (i === k.steps.length - 1 ? 'excited' : 'happy') : 'surprised'
    },
  }
})())
