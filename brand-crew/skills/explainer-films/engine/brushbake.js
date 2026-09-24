// brushbake.js — real p5.brush paint for the watercolour style.
//
// p5.brush (vendor/, MIT, Alejandro Campos) paints watercolour washes and
// brush strokes on a WebGL2 canvas. With no GPU that canvas runs on
// SwiftShader, where one wash costs 0.1-3 s (the cost grows with its area),
// so nothing is painted per frame:
//
//   bake   a shape is painted once, alone, on opaque white (a transparent
//          clear is (1,1,1,0), which composites brighter than the paper), at
//          the frame's scale, and
//          the painting is kept, keyed by its geometry and its paint
//   lay    a frame lays kept paintings down with 'multiply', which is what
//          transparent pigment on paper does anyway: white leaves the paper
//          alone and colours darken where they overlap. Opacity is applied as
//          a painting is laid down, so a fade costs no new painting, and a
//          reveal (a highlight sweeping on) is the finished painting clipped
//
// A shape whose geometry changes every frame is baked once per distinct
// geometry; everything else once per film. Bakes are seeded from their key, so
// two render workers paint the same shape identically. Without WebGL, PB.ok is
// false and the style falls back to its Canvas2D washes.
const PB = (() => {
  let CVB = null, BW = 0, BH = 0, tried = false, ok = false
  const cache = new Map(), textures = new Map(), MAX = 1200
  const stats = { bakes: 0, ms: 0, hits: 0 }

  function ready() {
    if (tried) return ok
    tried = true
    try {
      if (typeof brush === 'undefined' || !brush.createCanvas) return (ok = false)
      BW = OUT_W; BH = OUT_H
      CVB = brush.createCanvas(BW, BH, { parent: null })
      // three brushes p5.brush does not ship, built from its own parts (a tip
      // is drawn in a 100x100 box about its centre; dark is paint):
      //   sumi     a soft round ink brush that swells mid-stroke and lifts off
      //   nib      a broad calligraphy nib held at 45 degrees: thick one way, thin the other
      //   stipple  a sparse spray of fine dots
      brush.add('sumi', { type: 'custom', weight: 6, scatter: .25, opacity: 170, spacing: .22, pressure: [.3, 1.5, .15], rotate: 'natural', noise: .45,
        tip: m => { m.noStroke(); m.fill('#000'); m.ellipse(0, 0, 84, 62) } })
      brush.add('nib', { type: 'custom', weight: 4.2, scatter: .02, opacity: 235, spacing: .12, pressure: [.9, 1.1, .85], rotate: 'none', markerTip: false, noise: .1,
        tip: m => { m.noStroke(); m.fill('#000'); m.rotate(-Math.PI / 4); m.rect(-46, -8, 92, 16) } })
      brush.add('stipple', { type: 'spray', weight: 3, scatter: 5, sharpness: 1, grain: 1.5, opacity: 170, spacing: 1.6, pressure: [1, 1], noise: .2 })
      // p5.brush sizes its built-in brushes for a ~500px canvas
      brush.scaleBrushes(1.4 * BW / 1280)
      ok = true
    } catch (e) { console.warn('p5.brush unavailable, painting with Canvas2D washes:', e.message); ok = false }
    return ok
  }

  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
  // Ramer-Douglas-Peucker: p5.brush bleeds a wash outward at every vertex, so a
  // densely sampled outline grows a fringe of spikes; a sparse one bleeds softly
  function simplify(P, eps) {
    if (P.length < 4) return P
    const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1
    const stack = [[0, P.length - 1]]
    while (stack.length) {
      const [a, b] = stack.pop(); let dmax = 0, idx = -1
      const [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay) || 1
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - P[i][1]) - (ax - P[i][0]) * (by - ay)) / L; if (d > dmax) { dmax = d; idx = i } }
      if (dmax > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
    }
    return P.filter((_, i) => keep[i])
  }

  // the scale a shape is painted at: the frame's, or more when a camera zooms
  // in on it; never less, so a shape popping in from nothing reuses one bake
  function bakeScale() {
    const tf = G.getTransform(), k = Math.hypot(tf.a, tf.b)
    if (k <= SCALE * 1.05) return SCALE
    return SCALE * Math.pow(1.25, Math.ceil(Math.log(k / SCALE) / Math.log(1.25)))
  }

  function paintOne(pts, o, s, closed) {
    const bb = bbox(pts), size = Math.max(bb.w, bb.h) * s
    // room for what spills past the outline: a wash's bleed, a massed gesture's overshoot
    const spill = !o.fill ? 0 : o.medium === 'mass' ? .08 : o.medium === 'hatch' ? .02 : (o.bleed ?? .1)
    const pad = Math.ceil(12 + size * (spill + .03) * 1.3 + (o.ink ? 10 : 0))
    let k = s, w = Math.ceil(bb.w * k) + 2 * pad, h = Math.ceil(bb.h * k) + 2 * pad
    if (w > BW || h > BH) {
      k *= Math.min((BW - 2 * pad) / Math.max(1, bb.w * k), (BH - 2 * pad) / Math.max(1, bb.h * k))
      w = Math.min(BW, Math.ceil(bb.w * k) + 2 * pad); h = Math.min(BH, Math.ceil(bb.h * k) + 2 * pad)
    }
    const P = simplify(pts.map(([x, y]) => [(x - bb.x0) * k + pad, (y - bb.y0) * k + pad]), o.eps ?? 1.3)
    const t0 = performance.now(), kk = k / (OUT_W / W)
    // a covering pigment is painted light-on-black or dark-on-white, whichever
    // separates it from its ground best, and un-mixed into alpha afterwards
    const col = o.fill || o.ink, bg = o.cover && lum(col) > .5 ? '#000000' : '#FFFFFF'
    brush.clear(bg); brush.seed(o.seed); if (brush.noiseSeed) brush.noiseSeed(o.seed)
    brush.push(); brush.translate(-BW / 2, -BH / 2)   // the standalone build draws about the centre
    brush.noStroke(); brush.noFill(); brush.noHatch()
    if (o.fill && P.length >= 3) {
      if (o.medium === 'hatch') {
        // ruled strokes across the shape; `cross` adds a second pass
        const passes = [o.angle ?? 45].concat(o.cross != null ? [o.cross] : [])
        passes.forEach((a, j) => {
          brush.hatch((o.dist ?? 6) * kk * (j ? 1.25 : 1), a * Math.PI / 180, { rand: o.rand ?? .15, continuous: !!o.continuous, gradient: o.gradient ?? false })
          brush.hatchStyle(o.fillBrush, o.fill, (o.fillWeight ?? 1) * kk); brush.polygon(P)
        })
        brush.noHatch()
      } else if (o.medium === 'mass') {
        // hand-filled value: layered gestures in the brush, not a wash
        brush.mass(o.fillBrush, o.fill, { strength: o.strength ?? .7, precision: o.precision ?? .4 }); brush.polygon(P); brush.noMass()
      } else {
        brush.fill(o.fill, o.alpha); brush.fillBleed(o.bleed, 'out'); brush.fillTexture(o.tex, o.border, false); brush.polygon(P); brush.noFill()
      }
    }
    if (o.ink && P.length >= 2) {
      brush.set(o.brush, o.ink, o.weight * kk)
      if (closed && P.length >= 3) brush.polygon(P); else brush.spline(P, 0)
    }
    brush.pop(); brush.render()
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d', { willReadFrequently: !!o.cover }).drawImage(CVB, 0, 0, w, h, 0, 0, w, h)
    if (o.cover) unmix(c, col, bg)
    stats.bakes++; stats.ms += performance.now() - t0
    return { c, x: bb.x0 - pad / k, y: bb.y0 - pad / k, k, cover: !!o.cover }
  }

  const rgbOf = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
  const lum = c => { const [r, g, b] = rgbOf(c); return (.299 * r + .587 * g + .114 * b) / 255 }
  // A one-colour painting on a known ground holds its own coverage: each
  // pixel is ground + a * (colour - ground). Solving for a, on the channel
  // where colour and ground differ most, turns the painting into that colour
  // at that alpha, which covers what is under it as real pastel or chalk does.
  function unmix(c, col, bg) {
    const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data
    const C = rgbOf(col), B = rgbOf(bg)
    let ch = 0; for (let i = 1; i < 3; i++) if (Math.abs(C[i] - B[i]) > Math.abs(C[ch] - B[ch])) ch = i
    const den = C[ch] - B[ch] || 1
    for (let i = 0; i < d.length; i += 4) { const a = clamp((d[i + ch] - B[ch]) / den); d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = a * 255 }
    g.putImageData(id, 0, 0)
  }

  function get(kind, pts, o, closed) {
    const s = bakeScale()
    const geo = pts.map(([x, y]) => Math.round(x * s) + ',' + Math.round(y * s)).join(' ')
    const key = kind + '|' + s.toFixed(3) + '|' + [o.fill, o.alpha, o.bleed, o.tex, o.border, o.ink, o.brush, o.weight,
      o.medium, o.fillBrush, o.fillWeight, o.dist, o.angle, o.cross, o.rand, o.continuous, o.gradient, o.strength, o.precision, o.cover].join('|') + '|' + geo
    const id = fnv(key) + ':' + fnv(key.split('').reverse().join('')) + ':' + key.length
    let e = cache.get(id)
    if (e) { stats.hits++; cache.delete(id); cache.set(id, e); return e }
    e = paintOne(pts, { ...o, seed: fnv(key) % 1000003 }, s, closed)
    cache.set(id, e)
    if (cache.size > MAX) cache.delete(cache.keys().next().value)
    return e
  }

  function lay(e, alpha, clip) {
    if (alpha <= .003) return
    G.save()
    if (clip) { G.beginPath(); G.rect(clip[0], clip[1], clip[2], clip[3]); G.clip() }
    G.globalCompositeOperation = e.cover ? 'source-over' : 'multiply'; G.globalAlpha *= clamp(alpha)
    G.drawImage(e.c, e.x, e.y, e.c.width / e.k, e.c.height / e.k)
    G.restore()
  }

  // is this too small to be worth a painting? (progress ticks, packets, dots)
  const tiny = pts => { const b = bbox(pts); return Math.min(b.w, b.h) * SCALE < 14 || b.w * b.h * SCALE * SCALE < 900 }

  return {
    get ok() { return ready() },
    tiny, stats, simplify,
    // a new film starts with no paintings: another film's are never reused
    // (style textures are, and stay)
    clear() { cache.clear() },
    // a filled shape with an optional outline; o = { fill, alpha, bleed, tex, border, ink, brush, weight }
    shape(pts, o, alpha = 1, clip = null) { lay(get('s', pts, o, true), alpha, clip) },
    // a stroke along a path
    line(pts, o, closed, alpha = 1) { lay(get(closed ? 'lc' : 'l', pts, o, closed), alpha) },
    // strokes along closed loops given in device pixels, painted fresh and laid
    // straight down: the host's outline, which changes with every drawing
    loops(polys, o, seed) {
      const all = polys.flat(), bb = bbox(all), pad = 14
      const x0 = Math.floor(bb.x0) - pad, y0 = Math.floor(bb.y0) - pad
      const w = Math.min(BW, Math.ceil(bb.w) + 2 * pad), h = Math.min(BH, Math.ceil(bb.h) + 2 * pad)
      const t0 = performance.now()
      brush.clear('#FFFFFF'); brush.seed(seed); if (brush.noiseSeed) brush.noiseSeed(seed)
      brush.push(); brush.translate(-BW / 2, -BH / 2); brush.noFill(); brush.set(o.brush, o.ink, o.weight)
      for (const P of polys) if (P.length >= 3) brush.polygon(P.map(([x, y]) => [x - x0, y - y0]))
      brush.pop(); brush.render()
      G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.globalCompositeOperation = 'multiply'; G.globalAlpha *= o.alpha ?? 1
      G.drawImage(CVB, 0, 0, w, h, x0, y0, w, h)
      G.restore()
      stats.loops = (stats.loops || 0) + 1; stats.loopMs = (stats.loopMs || 0) + performance.now() - t0
    },
    // a pigment texture, painted in the top-left w x h of the bake canvas
    texture(name, draw, w = BW, h = BH) {
      const id = 'tex:' + name + ':' + w + 'x' + h
      if (textures.has(id)) return textures.get(id)
      const t0 = performance.now()
      brush.clear('#FFFFFF'); brush.seed(fnv(name) % 1000003); if (brush.noiseSeed) brush.noiseSeed(fnv(name) % 1000003)
      brush.push(); brush.translate(-BW / 2, -BH / 2); brush.noStroke(); brush.noFill(); brush.noHatch(); draw(w, h); brush.pop(); brush.render()
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(CVB, 0, 0, w, h, 0, 0, w, h)
      stats.bakes++; stats.ms += performance.now() - t0
      textures.set(id, c)
      return c
    },
  }
})()
