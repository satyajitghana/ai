// cram-energy-based / relax
//
// The article's EnergyRelax widget as a moving picture: the hand-set CRAM energy on a real
// Sudoku-Extreme board (puzzle A with extra clues, as in the widget). Every pair of cells in
// the same row, column or box holding the same digit is one unit of energy, drawn as a red
// link between the two cells. No digits are drawn: the links are the energy.
// The search is run here, once, with a seeded PRNG: plain descent (T = 0) from a random fill
// until no single-cell change lowers the energy, then focused heat-bath moves at T = 0.35
// conflicts from that stuck board until the energy reaches zero, the stopping threshold.
// A simulation of the mechanism, so it is stamped Illustrative.
//
// steps: 0 random fill · 1 plain descent, stuck · 2 a little temperature · 3 threshold, stop
// params: { legend: [4 strings], threshold, energy }
BESPOKE.define((() => {
  const Q = '........45...6....3.....267....517....9.....5...827....74..2.3.98......1..3689...'
  const A = '261793584547268319398145267826951743719436825435827196674512938982374651153689472'
  const q = Q.split('').map((c, i) => (c === '.' && i % 4 === 0 ? A[i] : c))
  const clue = q.map((c) => c !== '.')
  const PEERS = []
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3), out = []
    for (let j = 0; j < 81; j++) {
      if (j === i) continue
      const rj = Math.floor(j / 9), cj = j % 9, bj = Math.floor(rj / 3) * 3 + Math.floor(cj / 3)
      if (rj === r || cj === c || bj === b) out.push(j)
    }
    PEERS.push(out)
  }
  const prng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  const free = []; clue.forEach((c, i) => { if (!c) free.push(i) })
  const links = (y) => { const out = []; for (let i = 0; i < 81; i++) for (const j of PEERS[i]) if (j > i && y[i] === y[j]) out.push([i, j]); return out }

  function runFrom(seed) {
    const rnd = prng(seed)
    const y = q.map((c) => (c === '.' ? Math.floor(rnd() * 9) : Number(c) - 1))
    const G = []; for (let i = 0; i < 81; i++) { G.push(new Array(9).fill(0)); for (const j of PEERS[i]) G[i][y[j]]++ }
    let E = 0; for (let i = 0; i < 81; i++) E += G[i][y[i]]; E /= 2
    const frames = [{ y: y.slice(), E }]
    const move = (T) => {
      const hot = free.filter((f) => G[f][y[f]] > 0)
      const pool = hot.length ? hot : free
      const i = pool[Math.floor(rnd() * pool.length)], g = G[i]
      let lo = Infinity; for (let a = 0; a < 9; a++) lo = Math.min(lo, g[a])
      let nx
      if (T <= 0) { const ties = []; for (let a = 0; a < 9; a++) if (g[a] === lo) ties.push(a); nx = ties[Math.floor(rnd() * ties.length)] }
      else { const w = g.map((v) => Math.exp(-(v - lo) / T)); let u = rnd() * w.reduce((s, v) => s + v, 0); nx = 8; for (let a = 0; a < 9; a++) { u -= w[a]; if (u <= 0) { nx = a; break } } }
      const old = y[i]; if (nx === old) return
      E += g[nx] - g[old]; y[i] = nx; for (const j of PEERS[i]) { G[j][old]--; G[j][nx]++ }
    }
    const localMin = () => free.every((f) => { const g = G[f]; return g.every((v) => v >= g[y[f]]) })
    let m = 0
    while (!localMin() && m < 20000) { move(0); m++; if (m % 4 === 0) frames.push({ y: y.slice(), E }) }
    frames.push({ y: y.slice(), E })
    const stuck = frames.length - 1
    if (E === 0) return null
    let n = 0
    while (E > 0 && n < 400000) { move(0.35); n++; if (n % 40 === 0) frames.push({ y: y.slice(), E }) }
    frames.push({ y: y.slice(), E })
    if (E !== 0) return null
    return { frames, stuck }
  }
  let sim = null
  for (let s = 1; s < 200 && !sim; s++) sim = runFrom(s * 7919 + 3)
  const F = sim.frames, STUCK = sim.stuck, LAST = F.length - 1
  const E0 = F[0].E
  const LK = F.map((f) => links(f.y))

  return {
    plan: () => ({
      min: [3.6, 5.2, 6.0, 3.6],
      events: [{ step: 0, at: .2, type: 'ticks', n: 9, span: 1.2 }, { step: 1, at: .3, type: 'ticks', n: 12, span: 3.4 }, { step: 2, at: .3, type: 'ticks', n: 16, span: 4.6 }, { step: 3, at: .3, type: 'ding' }],
      motion: [{ step: 1, from: 0, to: 4.6 }, { step: 2, from: 0, to: 5.6 }],
    }),
    stampAt: (k) => [1180, k.top + 20],
    draw(k) {
      const p = k.params, i = k.step
      // which frame of the search we are on
      let fi = 0
      if (k.thumb) fi = STUCK
      else if (i === 1) fi = Math.round(STUCK * k.easeOut(Math.min(1, k.p(1, 4.0, .3))))
      else if (i === 2) fi = STUCK + Math.round((LAST - STUCK) * Math.min(1, k.p(2, 5.0, .3)))
      else if (i >= 3) fi = LAST
      const fr = F[fi], lk = LK[fi]
      const CS = 52, BX = 150, BY = Math.max(k.top + 40, 250), BW = CS * 9
      const cx = (c) => BX + (c % 9) * CS + CS / 2, cy = (c) => BY + Math.floor(c / 9) * CS + CS / 2
      const appear = k.thumb ? 1 : k.easeOut(k.span(0, .9))
      k.push(); k.alpha(appear)
      for (let c = 0; c < 81; c++) {
        const x = BX + (c % 9) * CS, y = BY + Math.floor(c / 9) * CS
        k.flat(k.rect(x + 3, y + 3, CS - 6, CS - 6), clue[c] ? k.mix(k.paper, k.ink, .55) : k.mix(k.paper, k.P.light || k.P.a, .35), 1)
      }
      for (let g = 0; g <= 3; g++) {
        k.seed('gv' + g); k.line([[BX + g * 3 * CS, BY], [BX + g * 3 * CS, BY + BW]], 1.4, k.ink)
        k.seed('gh' + g); k.line([[BX, BY + g * 3 * CS], [BX + BW, BY + g * 3 * CS]], 1.4, k.ink)
      }
      k.pop()
      // the energy, as links between clashing cells
      const red = k.P.hi
      lk.forEach(([a, b], n) => {
        const pa = [cx(a), cy(a)], pb = [cx(b), cy(b)]
        const mid = [(pa[0] + pb[0]) / 2 + (pa[1] === pb[1] ? 0 : 10), (pa[1] + pb[1]) / 2 + (pa[1] === pb[1] ? -16 : 0)]
        k.seed('lk' + a + '-' + b); k.line(k.through([pa, mid, pb]), 1.1, red)
        k.flat(k.circle(pa[0], pa[1], 7), red, .9); k.flat(k.circle(pb[0], pb[1], 7), red, .9)
        if (n > 160) return
      })
      if (i >= 3 || (k.thumb && fr.E === 0)) {
        k.seed('done'); k.line(k.rect(BX - 8, BY - 8, BW + 16, BW + 16).concat([[BX - 8, BY - 8]]), 2, k.P.a)
      }
      // the energy trace
      const TX = 760, TW = 560, TY = BY + 10, TH = BW - 120
      const px = (j) => TX + (j / LAST) * TW
      const py = (e) => TY + TH - (e / E0) * TH
      k.seed('axis'); k.line([[TX, TY - 10], [TX, TY + TH], [TX + TW, TY + TH]], 1, k.dim)
      const thr = py(0)
      for (let x = TX; x < TX + TW; x += 26) k.flat(k.rect(x, thr - 6, 14, 3), k.P.a, .9)
      if (p.threshold) k.text(p.threshold, TX + TW, thr + 34, { role: 'label', size: 24, min: 12, align: 'right', maxW: TW, lines: 1, col: k.P.a })
      if (p.energy) k.text(p.energy, TX + 16, TY - 22, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1, col: k.dim })
      const pts = []
      for (let j = 0; j <= fi; j += Math.max(1, Math.floor(LAST / 260))) pts.push([px(j), py(F[j].E)])
      pts.push([px(fi), py(fr.E)])
      if (pts.length > 1) { k.seed('trace'); k.line(pts, 1.6, k.ink) }
      k.flat(k.circle(px(fi), py(fr.E), 9), red, 1)
      if (i >= 1 || k.thumb) { k.seed('stuck'); k.line(k.circle(px(STUCK), py(F[STUCK].E), 16), 1, k.dim) }
      if (p.legend && p.legend[i]) k.text(p.legend[i], TX, TY + TH + 70, { role: 'head', size: 34, min: 16, maxW: TW, lines: 3 })
      k.point = i === 0 ? [BX + BW, BY + BW / 2] : [px(fi), py(fr.E)]
      k.mood = i === 1 ? 'thinking' : i === 3 ? 'happy' : i === 2 ? 'excited' : 'neutral'
    },
  }
})())
