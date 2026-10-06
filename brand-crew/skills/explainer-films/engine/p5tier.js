// p5tier.js — the p5 tier (render.mjs --p5): PB, painting straight into a real p5.js canvas.
//
// The lite and live tiers (brushbake.js) paint each p5.brush shape alone on a
// scratch canvas and lay the painting down with 'multiply'. Here there is no
// scratch painting and no cache: one p5.js 2.x sketch owns a WEBGL canvas the
// size of the frame, and p5.brush's p5 build paints every shape, line and
// wash into it, over whatever the frame already holds, in drawing order. Its
// blend pass mixes each stroke with the paint under it as pigment (yellow over
// blue goes green), which a multiply of a painting made on white cannot do.
//
// The rest of the engine (ground, type, figures, the host's fills, overlays)
// is Canvas2D on G, and stays so; it enters the p5 canvas in order, as the
// animation kit's own paper and lettering do (claude-animation-base core.js,
// image() of a 2D layer). The frame is handed between the two:
//
//   op     p5.brush paints the shape into the p5 canvas with its own
//          predraw/postdraw hooks (what p5 runs around a draw()). If G has
//          been drawn on since the p5 canvas last matched it, G's canvas goes
//          in first (a texture upload). The paint stays in the p5 canvas, so a
//          run of brush ops (a node's wash, its outline, the arrows) is one
//          hand-off, not one per op
//   settle the p5 canvas comes back into G before anything else touches G:
//          any 2D draw on the frame, a clip, a read of its pixels (from any
//          context), the end of paintFrame. The frame's context is watched
//          for those, so no caller has to know
//   fade   a shape at alpha a, or under a clip (an op's own, or one already
//          on G), is settled at once: it comes back at a, inside the clip,
//          over what G held, which is the frame without it, so
//          a*painted + (1-a)*before, exactly as a 2D drawImage would lay it
//   cover  an opaque medium (pastel, chalk, spray paint, a rotring on a
//          dark sheet). p5.brush mixes every stroke into what is under it as
//          transparent pigment, so a light chalk on a dark board mixes to mud
//          instead of sitting on top. A covering op is painted on a plain
//          ground in the p5 canvas, un-mixed into its colour at an alpha (as
//          brushbake.js does) and laid on G with 'source-over', still fresh
//          for every drawing and still in drawing order
//
// Every op is seeded from its geometry, its paint and the drawing (BOILN), so
// a shape repaints identically across workers and boils on twos like the rest
// of the linework. Nothing falls back: without p5, p5.brush or a hardware
// WebGL context, or when the context is lost, it throws.
const PB = (() => {
  let p = null, ok = false, lost = false, pre = [], post = [], gl = null, renderer = ''
  const wraps = new Map(), textures = new Map(), curves = new Map()
  const stats = { ops: 0, ms: 0, sync: 0, uploads: 0, settles: 0 }
  // the hand-off: `mirror` is the 2D canvas the p5 canvas holds a copy of;
  // `ahead`, it holds paint that canvas has not got yet; `stale`, that canvas
  // was drawn on since. Only the frame's own canvas (MAIN) is left ahead;
  // any other canvas an op lands on (a pixel style's small one) settles at once.
  let mirror = null, ahead = false, stale = true, mainCtx = null, clipped = false
  const clipStack = []
  const C2D = CanvasRenderingContext2D.prototype, ORIG = {}

  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
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

  async function start() {
    if (typeof p5 === 'undefined') throw new Error('p5 tier: p5.js is not loaded')
    if (typeof brush === 'undefined' || !brush.instance || brush.createCanvas) throw new Error('p5 tier: the p5 build of p5.brush is not loaded')
    p5.disableFriendlyErrors = true
    // p5.brush's own lifecycle hooks: the ones registered after p5's (studio.html notes the count between the two scripts)
    const at = self.P5_HOOKS || { predraw: 0, postdraw: 0 }
    pre = p5.lifecycleHooks.predraw.slice(at.predraw); post = p5.lifecycleHooks.postdraw.slice(at.postdraw)
    if (!pre.length || !post.length) throw new Error('p5 tier: p5.brush registered no draw hooks')
    let inst = null
    new p5(q => {
      inst = q; brush.instance(q)
      q.setup = () => { q.createCanvas(OUT_W, OUT_H, q.WEBGL); q.pixelDensity(1); q.noLoop() }
      q.draw = () => {}
    })
    for (let i = 0; !(inst && inst._setupDone); i++) { if (i > 400) throw new Error('p5 tier: p5 setup did not finish'); await new Promise(r => setTimeout(r, 10)) }
    await new Promise(r => setTimeout(r, 30))   // postsetup hooks
    p = inst
    gl = p.drawingContext
    if (!gl || !gl.getParameter) throw new Error('p5 tier: no WebGL context')
    const e = gl.getExtension('WEBGL_debug_renderer_info')
    renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    if (/swiftshader/i.test(renderer) && !self.ALLOW_SWIFTSHADER) throw new Error('p5 tier: WebGL is SwiftShader (' + renderer + '), not a GPU')
    p.canvas.addEventListener('webglcontextlost', () => { lost = true })
    watch(MAIN)
    op(() => {
      brush.add('sumi', { type: 'custom', weight: 6, scatter: .25, opacity: 170, spacing: .22, pressure: [.3, 1.5, .15], rotate: 'natural', noise: .45,
        tip: m => { m.noStroke(); m.fill('#000'); m.ellipse(0, 0, 84, 62) } })
      brush.add('nib', { type: 'custom', weight: 4.2, scatter: .02, opacity: 235, spacing: .12, pressure: [.9, 1.1, .85], rotate: 'none', markerTip: false, noise: .1,
        tip: m => { m.noStroke(); m.fill('#000'); m.rotate(-Math.PI / 4); m.rect(-46, -8, 92, 16) } })
      brush.add('stipple', { type: 'spray', weight: 3, scatter: 5, sharpness: 1, grain: 1.5, opacity: 170, spacing: 1.6, pressure: [1, 1], noise: .2 })
      // sized as brushbake.js sizes them, so a weight means the same in every tier
      brush.scaleBrushes(1.4 * OUT_W / 1280)
    })
    ok = true
    return renderer
  }

  function alive() {
    if (!p) throw new Error('p5 tier: PB used before PB.start()')
    if (lost || gl.isContextLost()) throw new Error('p5 tier: the WebGL context was lost')
  }
  // one p5.brush pass, as p5 runs a draw(): its predraw hook, the drawing in
  // device pixels (p5's WEBGL origin is the centre), its postdraw hook, which
  // composites everything pending into the canvas
  function op(draw) {
    alive()
    for (const h of pre) h.call(p)
    p.push(); p.resetMatrix(); p.translate(-OUT_W / 2, -OUT_H / 2)
    try { draw() } finally { p.pop(); for (const h of post) h.call(p) }
  }
  // G's canvas, as a p5.Image whose pixels are that canvas (re-uploaded on every use)
  function wrap(cv) {
    let w = wraps.get(cv)
    if (!w || w.width !== cv.width || w.height !== cv.height) { w = p.createImage(cv.width, cv.height); w.canvas = cv; w.drawingContext = cv.getContext('2d'); wraps.set(cv, w) }
    w.setModified(true)
    return w
  }
  function upload(cv) {
    const t0 = performance.now()
    p.push(); p.resetMatrix(); p.clear(); p.imageMode(p.CORNER); p.noTint(); p.image(wrap(cv), -OUT_W / 2, -OUT_H / 2, cv.width, cv.height); p.pop()
    stale = false; stats.uploads++; stats.sync += performance.now() - t0
  }
  // the p5 canvas into a 2D context, through the context's untouched drawImage
  function lay(g, alpha, clip, tf, op) {
    const cv = g.canvas
    ORIG.save.call(g)
    if (clip) { g.setTransform(tf); g.beginPath(); g.rect(clip[0], clip[1], clip[2], clip[3]); ORIG.clip.call(g) }
    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)'
    g.globalCompositeOperation = op; g.globalAlpha = alpha
    ORIG.drawImage.call(g, p.canvas, 0, 0, cv.width, cv.height, 0, 0, cv.width, cv.height)
    ORIG.restore.call(g)
  }
  // the paint the p5 canvas is ahead by, into its 2D canvas (never under a clip: a clip settles first)
  function settle() {
    if (!ahead) return
    const t0 = performance.now()
    ahead = false
    lay(mirror.getContext('2d'), 1, null, null, 'copy')
    stats.settles++; stats.sync += performance.now() - t0
  }
  // Watch the frame's context: settle before anything draws on it, clips it
  // or reads it, and note that it changed. Reads of it from other contexts
  // come through drawImage on the prototype.
  function watch(ctx) {
    mainCtx = ctx
    for (const m of ['save', 'restore', 'clip', 'drawImage', 'getImageData']) ORIG[m] = C2D[m]
    const writes = ['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'putImageData', 'reset']
    for (const m of writes) {
      const f = C2D[m]
      ctx[m] = function (...a) { settle(); const r = f.apply(this, a); if (mirror === this.canvas) stale = true; return r }
    }
    ctx.getImageData = function (...a) { settle(); return ORIG.getImageData.apply(this, a) }
    ctx.save = function () { clipStack.push(clipped); return ORIG.save.call(this) }
    ctx.restore = function () { if (clipStack.length) clipped = clipStack.pop(); return ORIG.restore.call(this) }
    ctx.clip = function (...a) { settle(); clipped = true; return ORIG.clip.apply(this, a) }
    const reset = ctx.reset
    ctx.reset = function (...a) { clipStack.length = 0; clipped = false; return reset.apply(this, a) }
    C2D.drawImage = function (...a) { if (ahead && a[0] === mirror) settle(); return ORIG.drawImage.apply(this, a) }
    const cv = ctx.canvas
    for (const m of ['toDataURL', 'toBlob']) { const f = cv[m]; cv[m] = function (...a) { settle(); return f.apply(this, a) } }
    // a frame ends with its paint in G, for whoever reads it next
    const pf = paintFrame
    paintFrame = function (...a) { try { return pf.apply(this, a) } finally { settle() } }
  }
  // run one op's brush work on G's canvas; see the header for when it settles
  function onCanvas(g, alpha, clip, tf, draw) {
    const cv = g.canvas
    if (mirror !== cv) { settle(); mirror = cv; stale = true }
    const keep = !self.P5_EAGER && g === mainCtx && !clipped && !clip && alpha >= 1 && g.globalAlpha >= 1
    if (self.P5_TRACE) (PB.trace || (PB.trace = [])).push([keep ? 'keep' : 'lay', stale, clipped, +alpha.toFixed(2), +g.globalAlpha.toFixed(2), !!clip, g === mainCtx])
    if (!keep) settle()
    if (stale) upload(cv)
    op(draw)
    if (keep) { ahead = true; return }
    const t0 = performance.now()
    lay(g, g.globalAlpha * clamp(alpha), clip, tf, 'source-over')
    // the p5 canvas holds the op at full strength and unclipped, G does not
    stale = true
    stats.settles++; stats.sync += performance.now() - t0
  }
  // an op that paints the p5 canvas over (a plain ground) takes what it holds into G first
  function wipe() { settle(); stale = true }

  const KEYS = o => [o.fill, o.alpha, o.bleed, o.tex, o.border, o.ink, o.brush, o.weight, o.medium, o.fillBrush, o.fillWeight, o.dist, o.angle, o.cross, o.rand, o.continuous, o.gradient, o.strength, o.precision].join('|')
  // the shape's own brush work, in device pixels; kk turns a weight tuned at
  // the lite tier's 1280-wide canvas into this one's (as brushbake.js does)
  function brushwork(P, o, kk, closed) {
    brush.noStroke(); brush.noFill(); brush.noHatch()
    if (o.fill && P.length >= 3) {
      if (o.medium === 'hatch') {
        const passes = [o.angle ?? 45].concat(o.cross != null ? [o.cross] : [])
        passes.forEach((a, j) => {
          brush.hatch((o.dist ?? 6) * kk * (j ? 1.25 : 1), a * Math.PI / 180, { rand: o.rand ?? .15, continuous: !!o.continuous, gradient: o.gradient ?? false })
          brush.hatchStyle(o.fillBrush, o.fill, (o.fillWeight ?? 1) * kk); brush.polygon(P)
        })
        brush.noHatch()
      } else if (o.medium === 'mass') {
        brush.mass(o.fillBrush, o.fill, { strength: o.strength ?? .7, precision: o.precision ?? .4 }); brush.polygon(P); brush.noMass()
      } else {
        brush.fill(o.fill, o.alpha); brush.fillBleed(o.bleed, 'out'); brush.fillTexture(o.tex, o.border, false); brush.polygon(P); brush.noFill()
      }
    }
    if (o.ink && P.length >= 2) {
      brush.set(o.brush, o.ink, o.weight * kk)
      if (closed && P.length >= 3) brush.polygon(P); else brush.spline(P, 0)
      brush.noStroke()
    }
  }
  function paint(kind, pts, o, closed, alpha = 1, clip = null) {
    if (alpha <= .003) return
    alive()
    const t0 = performance.now(), g = G, tf = g.getTransform(), k = Math.hypot(tf.a, tf.b)
    const D = pts.map(([x, y]) => [tf.a * x + tf.c * y + tf.e, tf.b * x + tf.d * y + tf.f])
    const P = simplify(D, o.eps ?? 1.3)
    const seed = fnv(kind + '|' + KEYS(o) + '|' + o.cover + '|' + D.map(([x, y]) => Math.round(x) + ',' + Math.round(y)).join(' ') + '|d' + BOILN) % 1000003
    if (o.cover) cover(g, P, o, k, closed, seed, alpha, clip, tf)
    else onCanvas(g, alpha, clip, tf, () => { brush.seed(seed); brush.noiseSeed(seed); brushwork(P, o, k / (1280 / W), closed) })
    stats.ops++; stats.ms += performance.now() - t0
  }
  const rgbOf = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
  const lum = c => { const [r, gg, b] = rgbOf(c); return (.299 * r + .587 * gg + .114 * b) / 255 }
  function cover(g, P, o, k, closed, seed, alpha, clip, tf) {
    const col = o.fill || o.ink, bg = lum(col) > .5 ? '#000000' : '#FFFFFF', cv = g.canvas
    wipe()
    p.push(); p.resetMatrix(); p.background(bg); p.pop()
    op(() => { brush.seed(seed); brush.noiseSeed(seed); brushwork(P, o, k / (1280 / W), closed) })
    // only the shape's neighbourhood is read back: its bleed, overshoot and stroke width
    const b = bbox(P), m = Math.ceil(24 + Math.max(b.w, b.h) * .12 + (o.ink ? o.weight * k * 30 : 0))
    const x0 = Math.max(0, Math.floor(b.x0 - m)), y0 = Math.max(0, Math.floor(b.y0 - m))
    const x1 = Math.min(cv.width, Math.ceil(b.x1 + m)), y1 = Math.min(cv.height, Math.ceil(b.y1 + m))
    if (x1 <= x0 || y1 <= y0) return
    const c = grab(x0, y0, x1 - x0, y1 - y0, true), cg = c.getContext('2d'), id = cg.getImageData(0, 0, c.width, c.height), d = id.data
    const C = rgbOf(col), B = rgbOf(bg)
    let ch = 0; for (let i = 1; i < 3; i++) if (Math.abs(C[i] - B[i]) > Math.abs(C[ch] - B[ch])) ch = i
    const den = C[ch] - B[ch] || 1
    for (let i = 0; i < d.length; i += 4) { const a = clamp((d[i + ch] - B[ch]) / den); d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = a * 255 }
    cg.putImageData(id, 0, 0)
    g.save()
    if (clip) { g.setTransform(tf); g.beginPath(); g.rect(clip[0], clip[1], clip[2], clip[3]); g.clip() }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha *= clamp(alpha)
    g.drawImage(c, x0, y0)
    g.restore()
  }

  // the canvas, read back for measuring (landed) or keeping (texture)
  function grab(x, y, w, h, read) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d', { willReadFrequently: !!read }).drawImage(p.canvas, x, y, w, h, 0, 0, w, h)
    return c
  }
  const white = () => { p.push(); p.resetMatrix(); p.background(255); p.pop() }

  // How light a fill medium lands for a given colour: measured on six grey
  // swatches on white, as brushbake.js measures it (see there)
  const LEVELS = [0, .25, .5, .7, .85, 1]
  function curve(o) {
    const key = SCALE.toFixed(3) + '|' + [o.medium, o.fillBrush, o.fillWeight, o.dist, o.angle, o.cross, o.rand, o.continuous, o.gradient, o.strength, o.precision, o.alpha, o.bleed, o.tex, o.border].join('|')
    if (curves.has(key)) return curves.get(key)
    const s = SCALE, sw = 260 * s, sh = 110 * s, x0 = 40, y0 = 40
    const out = LEVELS.map(l => {
      const v = Math.round(l * 255), hex = '#' + [v, v, v].map(x => x.toString(16).padStart(2, '0')).join('')
      wipe(); white()
      op(() => { const sd = fnv(key + hex) % 1000003; brush.seed(sd); brush.noiseSeed(sd); brushwork([[x0, y0], [x0 + sw, y0], [x0 + sw, y0 + sh], [x0, y0 + sh]], { ...o, fill: hex, ink: null }, s / (1280 / W), true) })
      const px = grab(Math.round(x0 + sw * .3), Math.round(y0 + sh * .3), Math.round(sw * .4), Math.round(sh * .4), true).getContext('2d').getImageData(0, 0, Math.round(sw * .4), Math.round(sh * .4)).data
      let sum = 0; for (let i = 0; i < px.length; i += 4) sum += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]
      return sum / (px.length / 4) / 255
    })
    curves.set(key, out)
    return out
  }
  function landed(o, l) {
    const c = curve(o)
    for (let i = 1; i < LEVELS.length; i++) if (l <= LEVELS[i]) return lerp(c[i - 1], c[i], (l - LEVELS[i - 1]) / (LEVELS[i] - LEVELS[i - 1]))
    return c[c.length - 1]
  }

  const tiny = pts => { const b = bbox(pts); return Math.min(b.w, b.h) * SCALE < 14 || b.w * b.h * SCALE * SCALE < 900 }

  return {
    get ok() { if (!ok) throw new Error('p5 tier: PB used before PB.start()'); return true },
    get renderer() { return renderer },
    start, tiny, stats, simplify, landed,
    clear() {},
    shape(pts, o, alpha = 1, clip = null) { paint('s', pts, o, true, alpha, clip) },
    line(pts, o, closed, alpha = 1) { paint(closed ? 'lc' : 'l', pts, o, closed, alpha) },
    // strokes along closed loops given in device pixels (the host's outline), straight into the frame
    loops(polys, o, seed) {
      alive()
      const t0 = performance.now(), g = G
      onCanvas(g, o.alpha ?? 1, null, null, () => {
        brush.seed(seed); brush.noiseSeed(seed); brush.noFill(); brush.noHatch(); brush.set(o.brush, o.ink, o.weight)
        for (const P of polys) if (P.length >= 3) brush.polygon(P)
        brush.noStroke()
      })
      stats.ops++; stats.ms += performance.now() - t0
    },
    // a pigment texture, painted on white in the top-left w x h and kept (an
    // asset, like the paper: painted once, used under many frames)
    texture(name, draw, w = OUT_W, h = OUT_H) {
      const id = 'tex:' + name + ':' + w + 'x' + h
      if (textures.has(id)) return textures.get(id)
      wipe(); white()
      op(() => { const sd = fnv(name) % 1000003; brush.seed(sd); brush.noiseSeed(sd); brush.noStroke(); brush.noFill(); brush.noHatch(); draw(w, h) })
      const c = grab(0, 0, w, h)
      textures.set(id, c)
      return c
    },
  }
})()
