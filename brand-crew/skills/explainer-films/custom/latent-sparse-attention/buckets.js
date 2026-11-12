// latent-sparse-attention / buckets
//
// The article's BucketLab, animated: the index space in two dimensions, so a
// unit key is a point on a circle and its angle is its meaning. One toy block
// of 64 keys in topical runs; every 4 consecutive keys pooled; pools merged by
// Ward's rule (cost a_b + a_b' - a_(b+b'), a = |key sum|, cap 16 keys) in rounds
// of mutual-cheapest pairs down to 8 buckets; a centroid per bucket; then a
// query scores the centroids, keeps the best 3 and reads their keys best first.
// A simulation (the toy's keys are random), so the runtime stamps it
// Illustrative; the real block's numbers are the storyboard's strings.
//
// steps: 0 keys appear · 1 pool · 2 Ward merges · 3 centroids · 4 the query picks
// params: { legend: [5 strings, one per step], toy: [5 short labels], query: degrees }
BESPOKE.define((() => {
  const N = 64, POOL = 4, BUCKETS = 8, CAP = 16, KEEP = 3
  const TOPICS = [20, 75, 140, 200, 255, 320]
  // the toy's data, from a fixed seed: a frame is a pure function of time
  let s = 7 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const rad = d => d * Math.PI / 180
  const keys = []
  let cur = 0
  for (let i = 0; i < N; i++) {
    if (i % 8 === 0) cur = Math.floor(rnd() * TOPICS.length)
    keys.push(rad(TOPICS[cur] + (rnd() + rnd() + rnd() - 1.5) * 26))
  }
  const vec = a => [Math.cos(a), Math.sin(a)], norm = v => Math.hypot(v[0], v[1]), add = (a, b) => [a[0] + b[0], a[1] + b[1]]
  const ang = v => Math.atan2(v[1], v[0])
  // pools: the sum of 4 consecutive keys
  const pools = []
  for (let p = 0; p < N / POOL; p++) {
    let sum = [0, 0]; const members = []
    for (let j = 0; j < POOL; j++) { sum = add(sum, vec(keys[p * POOL + j])); members.push(p * POOL + j) }
    pools.push({ sum, members })
  }
  // Ward rounds: every cluster finds its cheapest allowed partner; mutual pairs merge
  const rounds = []
  let cl = pools.map((p, i) => ({ id: i, sum: p.sum, members: p.members.slice() }))
  while (cl.length > BUCKETS) {
    const best = cl.map((a, i) => {
      let bj = -1, bc = Infinity
      cl.forEach((b, j) => { if (j === i || a.members.length + b.members.length > CAP) return; const c = norm(a.sum) + norm(b.sum) - norm(add(a.sum, b.sum)); if (c < bc) { bc = c; bj = j } })
      return [bj, bc]
    })
    const pairs = []
    cl.forEach((_, i) => { const j = best[i][0]; if (j > i && best[j][0] === i) pairs.push([best[i][1], i, j]) })
    if (!pairs.length) break
    pairs.sort((a, b) => a[0] - b[0])
    const used = new Set(), next = []
    for (const [, i, j] of pairs.slice(0, cl.length - BUCKETS)) { used.add(i); used.add(j); next.push({ id: cl[i].id, sum: add(cl[i].sum, cl[j].sum), members: cl[i].members.concat(cl[j].members) }) }
    cl.forEach((c, i) => { if (!used.has(i)) next.push(c) })
    cl = next
    rounds.push(cl.map(c => ({ ...c, members: c.members.slice() })))
  }
  const buckets = cl
  // a cluster's arc on the circle: from its first key to its last, the short way round
  function arc(members) {
    const a = members.map(m => keys[m]), c = ang(a.reduce((s, x) => add(s, vec(x)), [0, 0]))
    const off = a.map(x => Math.atan2(Math.sin(x - c), Math.cos(x - c)))
    return [c + Math.min(...off), c + Math.max(...off)]
  }

  return {
    stampAt: k => [1230, k.top + 30],
    plan: () => ({
      min: [3.2, 3.2, 4.6, 3, 4.8],
      events: [{ step: 0, at: .2, type: 'ticks', n: 16, span: 1.2 }, { step: 1, at: .3, type: 'draw' }, { step: 2, at: .2, type: 'ticks', n: 8, span: 2.4 },
        { step: 3, at: .3, type: 'pop' }, { step: 4, at: .2, type: 'whoosh' }, { step: 4, at: 1.1, type: 'ding' }],
      motion: [{ step: 0, from: 0, to: 1.6 }, { step: 1, from: 0, to: 1.4 }, { step: 2, from: 0, to: 3.2 }, { step: 4, from: 0, to: 3 }],
    }),
    draw(k) {
      const p = k.params, CX = 600, CY = 590, R = 255, i = k.step
      const pal = [k.P.a, k.P.b, k.P.hi, k.tone('light'), k.mix(k.P.a, k.P.b, .5), k.mix(k.P.b, k.ink, .3), k.mix(k.P.hi, k.P.a, .5), k.mix(k.P.a, k.ink, .35)]
      const at = (a, r = R) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r]
      // the circle, the index space
      const ck = k.span(0, .8)
      k.seed('ring'); k.line(k.partial(k.circle(CX, CY, R, 72).concat([k.circle(CX, CY, R, 72)[0]]), ck), .8, k.dim)
      // the stage this step reaches: pools from step 1, Ward rounds through step 2
      const poolK = i >= 1 ? k.ease(k.p(1, 1.2, .2)) : 0
      const wardF = i >= 2 ? k.p(2, Math.max(1.6, (k.at(3) - k.at(2)) * .7), .3) : 0
      const r = Math.min(rounds.length, Math.floor(wardF * (rounds.length + .999)))
      const clusters = i >= 2 ? (r > 0 ? rounds[r - 1] : pools.map((pp, j) => ({ id: j, sum: pp.sum, members: pp.members }))) : null
      const ranked = buckets.map((b, j) => ({ j, score: Math.cos(ang(b.sum) - (p.query || 0) * Math.PI / 180) })).sort((a, b) => b.score - a.score)
      const kept = new Set(ranked.slice(0, KEEP).map(x => x.j))
      // buckets: a band hugging the circle over each cluster's arc
      if (clusters) clusters.forEach((c, j) => {
        const [a0, a1] = arc(c.members), bi = buckets.findIndex(b => b.id === c.id && b.members.length === c.members.length)
        const lit = i >= 4 && bi >= 0 && kept.has(bi), dimmed = i >= 4 && !lit
        const band = []
        for (let q = 0; q <= 16; q++) band.push(at(a0 - .07 + (a1 - a0 + .14) * q / 16, R + 26))
        for (let q = 16; q >= 0; q--) band.push(at(a0 - .07 + (a1 - a0 + .14) * q / 16, R - 26))
        k.seed('band' + c.id + '_' + c.members.length)
        k.push(); if (dimmed) k.alpha(.35)
        k.shape(band, { fill: pal[c.id % pal.length], op: lit ? .85 : .55, sw: lit ? 1.4 : .8 })
        k.pop()
      })
      // keys: dots on the circle, sliding to their pool's point while pooling
      const read = i >= 4 ? Math.floor(k.p(4, 2.2, 1.1) * 16.999) : 0
      const order = i >= 4 ? ranked.slice(0, KEEP).flatMap(x => buckets[x.j].members.slice().sort((a, b) => Math.cos(keys[b] - (p.query || 0) * Math.PI / 180) - Math.cos(keys[a] - (p.query || 0) * Math.PI / 180))) : []
      keys.forEach((a, m) => {
        const kk = k.thumb ? 1 : k.backOut(k.span(.2 + m * .018, .5 + m * .018)); if (kk <= 0) return
        const pa = ang(pools[Math.floor(m / POOL)].sum), aa = Math.atan2(Math.sin(pa - a), Math.cos(pa - a)) * poolK + a
        const [x, y] = at(aa)
        const hot = order.indexOf(m), on = hot >= 0 && hot < read
        k.push(); k.translate(x, y); k.scale(kk * (on ? 1.5 : 1))
        k.seed('key' + m); k.shape(k.circle(0, 0, poolK > .9 ? 9 : 7, 12), { fill: on ? k.P.a : k.ink, op: on ? 1 : .8, sw: .6, ink: k.dark ? (on ? k.P.a : k.ink) : k.ink })
        k.pop()
      })
      // centroids: a triangle per bucket, at its normalised key sum
      if (i >= 3) buckets.forEach((b, j) => {
        const tk = k.backOut(k.p(3, .35, .15 + j * .1)); if (tk <= 0) return
        const a = ang(b.sum), [x, y] = at(a, R - 78), lit = i >= 4 && kept.has(j)
        k.push(); k.translate(x, y); k.rotate(a + Math.PI / 2); k.scale(tk * (lit ? 1.3 : 1))
        k.seed('tri' + j); k.shape([[0, -20], [18, 13], [-18, 13]], { fill: lit ? k.P.a : pal[b.id % pal.length], op: 1, sw: 1 })
        k.pop()
      })
      // the query: an arrow from the centre at its angle
      if (i >= 4) {
        const qa = (p.query || 0) * Math.PI / 180, qk = k.easeOut(k.p(4, .6))
        k.seed('q'); k.arrow([[CX, CY], at(qa, R - 120)], k.P.a, 1.6, qk)
        k.push(); k.translate(CX, CY); k.seed('qdot'); k.shape(k.circle(0, 0, 14, 14), { fill: k.P.a, op: 1, sw: .8 }); k.pop()
      }
      // the toy's own words under the circle, and what each stage is in the real block, on the right
      if (p.toy && p.toy[i]) k.text(p.toy[i], CX, CY + R + 64, { role: 'mono', size: 26, col: k.dim, align: 'center', maxW: 760 })
      const LX = 1010
      // the legend stacks by the height each line actually takes in this style
      // (in a wide face, the oldest lines give way to the newest)
      const room = 930 - (k.top + 140), hs = (p.legend || []).map((s, j) => k.measure(s, { role: j === i ? 'head' : 'body', size: j === i ? 40 : 28, min: 18, maxW: 360, lines: 3 }))
      let first = Math.min(i, (p.legend || []).length - 1), used = 0
      while (first >= 0 && used + hs[first].h + 26 <= room) { used += hs[first].h + 26; first-- }
      first++
      let ly = k.top + 140, lyAt = []
      ;(p.legend || []).forEach((s, j) => {
        if (j > i || j < first) { lyAt.push(ly); return }
        const lk = k.thumb ? 1 : k.easeOut(k.p(j, .4, .25)), cur = j === i
        k.push(); k.alpha(lk * (cur ? 1 : .45))
        k.seed('lg' + j); k.shape(k.circle(LX, ly - 10, 9, 12), { fill: cur ? k.P.a : k.dim, op: 1, ink: null })
        const r = k.text(s, LX + 26, ly, { role: cur ? 'head' : 'body', size: cur ? 40 : 28, min: 18, maxW: 360, lines: 3, col: k.ink })
        k.pop()
        lyAt.push(ly); ly += r.h + 26
      })
      k.point = i >= 4 ? at((p.query || 0) * Math.PI / 180, R - 120) : [LX - 10, (lyAt[i] || k.top + 140) - 10]
      k.mood = i === 2 ? 'surprised' : i === 4 ? 'happy' : 'thinking'
    },
  }
})())
