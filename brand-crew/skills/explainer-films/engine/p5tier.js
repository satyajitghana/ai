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
// image() of a 2D layer). The frame is handed between the two, and every
// hand-off is a texture upload one way or a readback the other, which (with
// the GPU waits they force) was 80% of the brush time when each op paid both.
// So the frame goes over to the p5 canvas once and mostly stays there:
//
//   op     p5.brush paints the shape into the p5 canvas with its own
//          predraw/postdraw hooks (what p5 runs around a draw()). The first
//          op of a frame uploads G's canvas whole and empties it; from then
//          on the p5 canvas holds the frame and G's canvas is an overlay
//   overlay 2D drawing on the frame while the p5 canvas holds it lands on the
//          emptied canvas, and goes into the p5 canvas (an upload laid with
//          ONE / ONE_MINUS_SRC_ALPHA, which is 2D source-over) before the
//          next brush op, so 2D and brush work keep their order. Source-over
//          is associative, so drawing on the overlay and laying it over the
//          frame is drawing on the frame, to within 8-bit rounding
//   settle the p5 canvas comes back into G (the overlay first, then a readback
//          with 'copy') when 2D drawing needs the pixels under it: any other
//          composite (multiply, screen, a clear, a put), a clip, a read of
//          its pixels from any context, the end of paintFrame. The frame's
//          context is watched for those, so no caller has to know
//   fade   a shape at alpha a (its own, times G's): the frame is copied aside
//          on the GPU (a framebuffer blit), the op painted at full strength,
//          and the copy laid back over it at 1 - a, which is
//          a*painted + (1-a)*before, as a 2D drawImage at a would lay it.
//          Under a clip (an op's own, or one already on G) the frame settles
//          and the op comes back into G at a, inside the clip
//   cover  an opaque medium (pastel, chalk, spray paint, a rotring on a
//          dark sheet). p5.brush mixes every stroke into what is under it as
//          transparent pigment, so a light chalk on a dark board mixes to mud
//          instead of sitting on top. A covering op is painted on a plain
//          ground and un-mixed into its colour at an alpha (as brushbake.js
//          does), on the GPU: the frame and the painting are copied aside and
//          one shader pass writes the frame back with the colour laid over it
//          at that alpha, inside the shape's neighbourhood. Under a clip, a
//          filter or a shadow, the same is done through a readback and G
//          (cover2d), still fresh for every drawing and in drawing order
//
// --eager (P5_EAGER) hands the frame back after every op through G, the
// first design; it is the reference the default is diffed against (within
// rounding: max 3/255 on a watercolour thumbnail, 4/255 on a pastel one).
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
  // `ahead`, the p5 canvas holds the frame and that canvas only an overlay,
  // what 2D drawing added since (`dirty`); `stale`, that canvas was drawn on
  // since the two matched. Only the frame's own canvas (MAIN) is left ahead;
  // any other canvas an op lands on (a pixel style's small one) settles at once.
  let mirror = null, ahead = false, dirty = false, stale = true, mainCtx = null, clipped = false
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
  // P5_PROFILE: wait for the GPU at each phase's edges (a 1-pixel read), so
  // the time a hand-off spends waiting for brush work is the brush's, not the
  // hand-off's. Off by default: it is a measurement, and it costs.
  const px1 = new Uint8Array(4)
  function drain() { if (self.P5_PROFILE) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1) }
  function timed(key, f) {
    drain(); const t0 = performance.now()
    try { return f() } finally { drain(); const dt = performance.now() - t0; stats[key] = (stats[key] || 0) + dt; if (key !== 'brush') stats.sync += dt }
  }
  // G's canvas into the p5 canvas: the whole frame (over a cleared canvas), or
  // an overlay of what 2D drawing added since, laid over it as a 2D
  // source-over would (premultiplied, ONE / ONE_MINUS_SRC_ALPHA)
  function upload(cv, over = false) {
    timed('up', () => {
      p.push(); p.resetMatrix(); if (!over) p.clear(); p.imageMode(p.CORNER); p.noTint(); p.blendMode(p.BLEND)
      p.image(wrap(cv), -OUT_W / 2, -OUT_H / 2, cv.width, cv.height); p.pop()
    })
    stale = false; stats.uploads++
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
  // the frame's canvas emptied, to collect the next overlay (never under a clip: in the p5's hands, a clip settles first)
  function empty(g) {
    ORIG.save.call(g); g.setTransform(1, 0, 0, 1, 0, 0); ORIG.clearRect.call(g, 0, 0, g.canvas.width, g.canvas.height); ORIG.restore.call(g)
    dirty = false
  }
  // the frame, back from the p5 canvas into its 2D canvas: the overlay goes in
  // first, then the whole p5 canvas comes back with 'copy'
  function settle() {
    if (!ahead) return
    ahead = false
    if (dirty) upload(mirror, true)
    dirty = false
    timed('back', () => lay(mirror.getContext('2d'), 1, null, null, 'copy'))
    stale = false; stats.settles++
  }
  // Watch the frame's context. While the p5 canvas holds the frame, its 2D
  // canvas is an overlay: a draw that composites source-over (most of them:
  // fills, strokes, type, images, at any alpha, blurred or shadowed) lands on
  // it and goes into the p5 canvas, in order, before the next brush op. One
  // that needs the pixels under it (multiply, screen, a clear, a put, a clip,
  // a read of its pixels from any context) settles first.
  function watch(ctx) {
    mainCtx = ctx
    for (const m of ['save', 'restore', 'clip', 'drawImage', 'getImageData', 'clearRect']) ORIG[m] = C2D[m]
    const writes = ['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'putImageData', 'reset']
    const over = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage'])
    for (const m of writes) {
      const f = C2D[m], lays = over.has(m)
      ctx[m] = function (...a) {
        if (ahead) {
          if (lays && this.globalCompositeOperation === 'source-over' && a[0] !== this.canvas) { dirty = true; return f.apply(this, a) }
          settle()
        }
        const r = f.apply(this, a); if (mirror === this.canvas) stale = true; return r
      }
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
  // a framebuffer the frame is copied into, on the GPU, as p5.brush's blend
  // pass copies it. Row for row: the canvas is multisampled, and a resolving
  // blit cannot flip, so the copy is upside down for image() and is drawn
  // flipped back (see onCanvas). The first copy checks that the blit took.
  const fbs = {}
  function snapshot(name = 'before') {
    let fb = fbs[name]
    if (!fb) fb = fbs[name] = p.createFramebuffer({ width: OUT_W, height: OUT_H, density: 1, antialias: false, depth: false, stencil: false })
    p._renderer?.flushDraw?.()
    const r = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)
    if (!fb.checked) gl.getError()
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb.framebuffer)
    gl.blitFramebuffer(0, 0, OUT_W, OUT_H, 0, 0, OUT_W, OUT_H, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, r); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d)
    if (!fb.checked) { const e = gl.getError(); if (e) throw new Error('p5 tier: copying the frame on the GPU failed (GL error ' + e + ')'); fb.checked = true }
    return fb
  }
  // run one op's brush work on G's canvas; see the header for when it settles
  function onCanvas(g, alpha, clip, tf, draw) {
    const cv = g.canvas
    if (mirror !== cv) { settle(); mirror = cv; stale = true }
    const a = g.globalAlpha * clamp(alpha)
    const keep = !self.P5_EAGER && g === mainCtx && !clipped && !clip
    if (self.P5_TRACE) (PB.trace || (PB.trace = [])).push([keep ? (a < 1 ? 'fade' : 'keep') : 'lay', ahead, dirty, stale, clipped, +a.toFixed(2), !!clip, g === mainCtx])
    if (keep) {
      // the frame goes over to the p5 canvas (once), or the overlay drawn since goes into it
      if (!ahead) { if (stale) upload(cv); empty(g); ahead = true }
      else if (dirty) { upload(cv, true); empty(g) }
      if (a >= 1) return timed('brush', () => op(draw))
      // a fade on the GPU: the frame before the op, laid back over it at 1 - a
      const before = timed('fade', snapshot)
      timed('brush', () => op(draw))
      timed('fade', () => { p.push(); p.resetMatrix(); p.scale(1, -1); p.imageMode(p.CORNER); p.blendMode(p.BLEND); p.tint(255, 255 * (1 - a)); p.image(before, -OUT_W / 2, -OUT_H / 2, OUT_W, OUT_H); p.pop() })
      stats.fades = (stats.fades || 0) + 1
      return
    }
    const why = 'lay_' + (g !== mainCtx ? 'canvas' : clipped ? 'clipped' : clip ? 'clip' : 'eager'); stats[why] = (stats[why] || 0) + 1
    settle()
    if (stale) upload(cv)
    timed('brush', () => op(draw))
    timed('back', () => lay(g, a, clip, tf, 'source-over'))
    // the p5 canvas holds the op at full strength and unclipped, G does not
    stale = true
    stats.settles++
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
  // A covering op, un-mixed on the GPU while the p5 canvas holds the frame:
  // the frame is copied aside, the op painted on the plain ground and copied
  // aside too, and one pass writes the frame back with the op's colour laid
  // over it at the alpha its paint un-mixes to, inside the same neighbourhood
  // the 2D path reads back (cover2d). Under a clip, a filter or a shadow on G,
  // or on another canvas, the 2D path runs instead.
  const UNMIX_V = `#version 300 es
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
void main() { gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0); }`
  const UNMIX_F = `#version 300 es
precision highp float;
uniform sampler2D uFrame;
uniform sampler2D uPaint;
uniform vec3 uCol;
uniform float uBg;
uniform float uDen;
uniform int uCh;
uniform float uK;
uniform vec4 uBox;
out vec4 outColor;
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec3 f = texelFetch(uFrame, q, 0).rgb;
  vec2 xy = gl_FragCoord.xy;
  if (xy.x < uBox.x || xy.x >= uBox.z || xy.y < uBox.y || xy.y >= uBox.w) { outColor = vec4(f, 1.0); return; }
  vec3 s = floor(texelFetch(uPaint, q, 0).rgb * 255.0 + 0.5);
  float v = uCh == 0 ? s.r : uCh == 1 ? s.g : s.b;
  float a = floor(clamp((v - uBg) / uDen, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  outColor = vec4(mix(f, uCol / 255.0, a * uK), 1.0);
}`
  let unmix = null
  function cover(g, P, o, k, closed, seed, alpha, clip, tf) {
    const a = g.globalAlpha * clamp(alpha)
    if (self.P5_EAGER || g !== mainCtx || clipped || clip || g.filter !== 'none' || g.shadowBlur > 0 && !/^rgba\(.*,\s*0\)$/.test(g.shadowColor)) return cover2d(g, P, o, k, closed, seed, alpha, clip, tf)
    const col = o.fill || o.ink, bg = lum(col) > .5 ? '#000000' : '#FFFFFF', cv = g.canvas
    if (mirror !== cv) { settle(); mirror = cv; stale = true }
    const b = bbox(P), m = Math.ceil(24 + Math.max(b.w, b.h) * .12 + (o.ink ? o.weight * k * 30 : 0))
    const x0 = Math.max(0, Math.floor(b.x0 - m)), y0 = Math.max(0, Math.floor(b.y0 - m))
    const x1 = Math.min(cv.width, Math.ceil(b.x1 + m)), y1 = Math.min(cv.height, Math.ceil(b.y1 + m))
    if (x1 <= x0 || y1 <= y0) return
    if (!ahead) { if (stale) upload(cv); empty(g); ahead = true }
    else if (dirty) { upload(cv, true); empty(g) }
    const frame = timed('cover', () => snapshot('before'))
    timed('brush', () => { p.push(); p.resetMatrix(); p.background(bg); p.pop(); op(() => { brush.seed(seed); brush.noiseSeed(seed); brushwork(P, o, k / (1280 / W), closed) }) })
    timed('cover', () => {
      const paint = snapshot('paint'), C = rgbOf(col), B = rgbOf(bg)
      let ch = 0; for (let i = 1; i < 3; i++) if (Math.abs(C[i] - B[i]) > Math.abs(C[ch] - B[ch])) ch = i
      if (!unmix) unmix = p.createShader(UNMIX_V, UNMIX_F)
      const depth = gl.isEnabled(gl.DEPTH_TEST); gl.disable(gl.DEPTH_TEST)
      p.push(); p.resetMatrix(); p.shader(unmix)
      unmix.setUniform('uFrame', frame); unmix.setUniform('uPaint', paint)
      unmix.setUniform('uCol', C); unmix.setUniform('uBg', B[ch]); unmix.setUniform('uDen', C[ch] - B[ch] || 1); unmix.setUniform('uCh', ch); unmix.setUniform('uK', a)
      unmix.setUniform('uBox', [x0, cv.height - y1, x1, cv.height - y0])
      p.noStroke(); p.blendMode(p.BLEND); p.rect(-OUT_W / 2, -OUT_H / 2, OUT_W, OUT_H)
      p.pop(); p.resetShader()
      if (depth) gl.enable(gl.DEPTH_TEST)
    })
    stats.covers = (stats.covers || 0) + 1
  }
  function cover2d(g, P, o, k, closed, seed, alpha, clip, tf) {
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
