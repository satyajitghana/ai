// mascot.js — the host. Every film has its own: a cat, a dog, a fox, a bunny,
// a capybara or a fish, with its own fur, markings, ears, hat, glasses, outfit
// and the prop in its paw (the storyboard's `mascot`, or, field by field, a
// hash of the slug). It presents from the side of the frame, big, cropped at
// the bottom edge like a presenter in shot — never standing on a floor.
// It is drawn as one solid, shaded character — a sticker, not a wiring diagram:
// every part is filled on its own layer with a soft light-to-shade gradient and
// only faint seams in a darker shade of its own colour, then the layer gets a
// single outline around its whole silhouette (dark on paper, light on a board
// or a blueprint, a coloured glow under neon) and is laid onto the scene.
//
//   mascot(x, y, u, o)   feet at (x, y) — usually below the frame; u is the size
//                        unit (the head is ~3.7u across, the whole body ~10u)
//   o.mood    neutral | happy | surprised | thinking | proud | wink | excited
//   o.point   [x, y]: a paw (and the pointer, if it holds one) aims there
//   o.wave    the free paw waves
//   o.talk    0..1, how open the mouth is (the film drives it from the voice)
//   o.dy, o.sq   bounce height and squash; o.look -1..1 where the eyes go
const MASCOT_OPTS = {
  species: ['cat', 'dog', 'fox', 'bunny', 'capybara', 'fish'],
  fur: {
    white: '#F6F1E7', cream: '#F1DFBF', grey: '#B8B4AE', brown: '#A8765A', chocolate: '#70503E', black: '#3E3836', caramel: '#DDA163',
    orange: '#E58A3C', ginger: '#D96F32', gold: '#F2B134', lilac: '#C9B5E6', mint: '#B9E4CF', peach: '#F5C2A5', sky: '#B8D5F2',
    rose: '#F2B5C4', coral: '#F2836B', teal: '#4FB8AE', blue: '#5AA9E6',
  },
  ears: ['up', 'lop', 'one-down', 'tall', 'short'],
  hat: ['none', 'hardhat', 'beret', 'wizard', 'cap', 'headphones', 'crown', 'goggles', 'party', 'chef', 'beanie', 'flower', 'tophat', 'bandana', 'yuzu'],
  glasses: ['none', 'round', 'square', 'shades', 'monocle'],
  outfit: ['none', 'scarf', 'bowtie', 'labcoat', 'hoodie', 'cape', 'vest', 'overalls', 'tie'],
  prop: ['pointer', 'clipboard', 'wrench', 'magnifier', 'book', 'carrot', 'pencil', 'flag', 'none'],
  patch: ['none', 'eye', 'belly', 'spots', 'socks'],
  accent: ['#E4572E', '#3B7DD8', '#2BA84A', '#F2B134', '#8E5CC7', '#E24D8B', '#17A2A2', '#F07F3C'],
}
const NAMES = ['Mochi', 'Pip', 'Juniper', 'Biscuit', 'Clover', 'Tofu', 'Waffles', 'Nimbus', 'Maple', 'Dumpling', 'Sprocket', 'Hazel', 'Quill', 'Basil', 'Pebble', 'Ziggy', 'Marbles', 'Poppy', 'Cosmo', 'Fennel', 'Truffle', 'Bramble']
// where each species keeps its face, relative to the shared head centre (0, -5.15)
const FACE = {
  bunny: { eyeY: -5.25, eyeX: .68, eyeS: 1, noseY: -4.8, mouthY: -4.5, hatDy: 0 },
  cat: { eyeY: -5.25, eyeX: .7, eyeS: 1.05, noseY: -4.82, mouthY: -4.52, hatDy: 0 },
  dog: { eyeY: -5.4, eyeX: .72, eyeS: 1, noseY: -4.92, mouthY: -4.35, hatDy: 0 },
  fox: { eyeY: -5.35, eyeX: .74, eyeS: .95, noseY: -4.55, mouthY: -4.32, hatDy: .05 },
  capybara: { eyeY: -5.62, eyeX: .8, eyeS: .72, noseY: -4.7, mouthY: -4.18, hatDy: .38 },
  fish: { eyeY: -4.95, eyeX: .78, eyeS: 1.2, noseY: 99, mouthY: -4.15, hatDy: .2 },
}
const SPECIES_FUR = { cat: ['grey', 'ginger', 'black', 'white', 'cream'], dog: ['caramel', 'brown', 'cream', 'white', 'chocolate'], fox: ['orange', 'ginger'], bunny: ['white', 'grey', 'brown', 'cream', 'lilac'], capybara: ['brown', 'caramel'], fish: ['gold', 'coral', 'teal', 'blue', 'orange'] }

// an ellipse whose long axis is rotated by rot (ellPts only shifts its start)
function rellPts(cx, cy, rx, ry, n = 20, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), p = []
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; p.push([cx + x * c - y * s, cy + x * s + y * c]) }
  return p
}
function mascotFor(slug, m = {}) {
  const r = seededRng(hashStr('mascot|' + slug)), pick = a => a[Math.floor(r() * a.length)]
  const species = m.species || pick(MASCOT_OPTS.species)
  const d = {
    species, name: pick(NAMES), fur: pick(SPECIES_FUR[species]), ears: species === 'bunny' ? pick(['up', 'lop', 'tall']) : 'up', hat: pick(MASCOT_OPTS.hat), glasses: pick(MASCOT_OPTS.glasses),
    outfit: pick(MASCOT_OPTS.outfit), prop: pick(MASCOT_OPTS.prop), patch: pick(MASCOT_OPTS.patch), accent: pick(MASCOT_OPTS.accent),
  }
  const out = { ...d, ...m }
  out.furCol = MASCOT_OPTS.fur[out.fur] || out.fur
  out.accentCol = /^#[0-9a-f]{6}$/i.test(out.accent) ? out.accent : d.accent
  return out
}

// ---- the sticker renderer: what shape() and line() mean while the host is drawn
const OUTLINE = { watercolour: '#2B2233', riso: '#262140', notebook: '#1F3A93', pixel: '#000000', chalkboard: '#F4F1E8', blueprint: '#EAF3FF', neon: '#15121F',
  crayon: '#2B2530', pastel: '#2A2622', ballpoint: '#1A3C8F', pencil: '#3A3836', marker: '#1B1B1E', charcoal: '#1C1B1A' }
let MLAYER = null, MTINT = null, LIGHT = null
function stickerStyle(scene) {
  const flatFill = scene.name === 'pixel'
  const seamOf = c => mixCol(c, '#2B2233', .42)
  return {
    name: 'sticker', dark: false, ink: '#3A2E3A', dim: '#7A6A78', P: scene.P, outline: OUTLINE[scene.name] || '#2B2233',
    shape(pts, o = {}) {
      if (!o.fill) return
      const P = pts.length >= 8 && !o.exact ? throughClosed(pts, 3) : pts
      G.save(); pathOf(P, true)
      if (flatFill || o.flat) G.fillStyle = o.fill
      else {
        // one light for the whole character, not one per part: an arm over the
        // body is then exactly the body's colour where they overlap, so it reads
        // as the same animal instead of a piece laid on top
        const bb = LIGHT || bbox(P), gr = G.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1)
        gr.addColorStop(0, mixCol(o.fill, '#FFFFFF', .2)); gr.addColorStop(.55, o.fill); gr.addColorStop(1, mixCol(o.fill, '#2B2233', .14))
        G.fillStyle = gr
      }
      const op = o.op ?? 1
      if (op < .8) G.globalAlpha *= op
      G.fill()
      if (o.ink !== null) { G.globalAlpha = 1; G.lineJoin = 'round'; G.lineWidth = Math.max(1.4, (o.sw || 1) * 1.05); G.strokeStyle = seamOf(o.fill); G.stroke() }
      G.restore()
    },
    line(pts, sw, col, o = {}) {
      const P = o.curv && pts.length > 2 ? (o.closed ? throughClosed(pts, 4) : through(pts, 5)) : pts
      G.save(); pathOf(P, !!o.closed); G.lineCap = 'round'; G.lineJoin = 'round'; G.lineWidth = Math.max(1.2, sw * 2.1); G.strokeStyle = col || '#3A2E3A'; G.stroke(); G.restore()
    },
  }
}
function mascot(x, y, u, o = {}) {
  const target = G, scene = STYLE, tf = target.getTransform(), alpha = target.globalAlpha, cv = target.canvas
  if (!MLAYER || MLAYER.width !== cv.width || MLAYER.height !== cv.height) {
    MLAYER = document.createElement('canvas'); MLAYER.width = cv.width; MLAYER.height = cv.height
    MTINT = document.createElement('canvas'); MTINT.width = cv.width; MTINT.height = cv.height
  }
  const L = MLAYER.getContext('2d')
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, cv.width, cv.height); L.setTransform(tf)
  G = L; STYLE = stickerStyle(scene)
  // light from the top left of the whole character, in its own coordinates
  LIGHT = { x0: -3 * u, y0: -9.5 * u, x1: 3 * u, y1: 0 }
  try { drawMascot(x, y, u, o) } finally { G = target; STYLE = scene; LIGHT = null }
  // the region the host can occupy, in device pixels (the pointer reaches ~6u left)
  const p0 = tf.transformPoint(new DOMPoint(x - 7 * u, y - 12 * u)), p1 = tf.transformPoint(new DOMPoint(x + 4.5 * u, y + u))
  const rx = Math.max(0, Math.floor(Math.min(p0.x, p1.x))), ry = Math.max(0, Math.floor(Math.min(p0.y, p1.y)))
  const rw = Math.min(cv.width, Math.ceil(Math.max(p0.x, p1.x))) - rx, rh = Math.min(cv.height, Math.ceil(Math.max(p0.y, p1.y))) - ry
  if (rw <= 0 || rh <= 0) return
  const k = Math.hypot(tf.a, tf.b)
  const painted = scene.name === 'watercolour'
  // the pen the host is inked with: charcoal for watercolour, or the style's own
  const pen = PB.ok && (scene.hostPen || (painted ? { brush: 'charcoal', weight: 1.8 } : null))
  if (painted) paintLayer(rx, ry, rw, rh, u * k)
  else if (pen && scene.hostTex) texLayer(rx, ry, rw, rh, scene)
  const Tn = MTINT.getContext('2d')
  Tn.setTransform(1, 0, 0, 1, 0, 0); Tn.globalCompositeOperation = 'source-over'; Tn.clearRect(rx, ry, rw, rh)
  Tn.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh)
  Tn.globalCompositeOperation = 'source-in'; Tn.fillStyle = OUTLINE[scene.name] || '#2B2233'; Tn.fillRect(rx, ry, rw, rh); Tn.globalCompositeOperation = 'source-over'
  const r = Math.max(1, u * .085 * k)
  target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = alpha
  if (scene.name === 'neon') { target.shadowColor = scene.P.a; target.shadowBlur = u * .45 * k; target.drawImage(MTINT, rx, ry, rw, rh, rx, ry, rw, rh); target.drawImage(MTINT, rx, ry, rw, rh, rx, ry, rw, rh); target.shadowBlur = 0 }
  if (pen) {
    // inked with a real brush: the figure's silhouette traced from its own
    // pixels and stroked in charcoal by p5.brush, re-inked with every drawing
    // (twelve a second), so the line boils the way a hand-inked one does
    target.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh)
    target.restore()
    const loops = silhouette(MLAYER, rx, ry, rw, rh, 2)
    if (loops.length) PB.loops(loops, { ink: pen.ink || OUTLINE[scene.name] || scene.ink, brush: pen.brush, weight: u * k / 70 * pen.weight, alpha }, BOILN * 7919 + 17)
    return
  }
  if (painted) {
    // a hand-inked outline: its weight swells and thins around the figure and
    // re-draws twelve times a second, like the boiling line of the painted base
    const rnd = seededRng(BOILN * 7919 + 17)
    for (let i = 0; i < 20; i++) { const a = (i + rnd() * .5) / 20 * TAU, rr = r * (.78 + rnd() * .4); target.drawImage(MTINT, rx, ry, rw, rh, rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, rw, rh) }
  } else for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; target.drawImage(MTINT, rx, ry, rw, rh, rx + Math.cos(a) * r, ry + Math.sin(a) * r, rw, rh) }
  target.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh)
  target.restore()
}

// The outline of everything opaque in a layer region, as closed loops in
// device pixels: marching squares over a half-size, slightly blurred copy, so
// hairlines (whiskers, a pointer's shaft) drop out instead of being outlined
// twice over, and the loops come out smooth.
let SIL = null
function silhouette(src, rx, ry, rw, rh, step) {
  const gw = Math.ceil(rw / step) + 2, gh = Math.ceil(rh / step) + 2
  if (!SIL || SIL.width < gw || SIL.height < gh) { SIL = document.createElement('canvas'); SIL.width = gw + 32; SIL.height = gh + 32 }
  const c = SIL.getContext('2d', { willReadFrequently: true })
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SIL.width, SIL.height); c.filter = 'blur(0.8px)'
  c.drawImage(src, rx, ry, rw, rh, 1, 1, rw / step, rh / step); c.filter = 'none'
  const d = c.getImageData(0, 0, gw, gh).data, v = new Uint8Array(gw * gh)
  for (let i = 0; i < gw * gh; i++) v[i] = d[i * 4 + 3] > 150 ? 1 : 0
  // each cell's crossing edges, as undirected segments between edge midpoints
  // (doubled grid coordinates keep midpoints integral)
  const adj = new Map(), K = (x, y) => x * 65536 + y
  const link = (p, q) => { (adj.get(p) || adj.set(p, []).get(p)).push(q); (adj.get(q) || adj.set(q, []).get(q)).push(p) }
  const CASES = { 1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['TR'], 5: ['TR', 'LB'], 6: ['TB'], 7: ['TL'], 8: ['TL'], 9: ['TB'], 10: ['TL', 'BR'], 11: ['TR'], 12: ['LR'], 13: ['BR'], 14: ['LB'] }
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const idx = v[j * gw + i] * 8 + v[j * gw + i + 1] * 4 + v[(j + 1) * gw + i + 1] * 2 + v[(j + 1) * gw + i]
    const segs = CASES[idx]; if (!segs) continue
    const E = { T: K(2 * i + 1, 2 * j), R: K(2 * i + 2, 2 * j + 1), B: K(2 * i + 1, 2 * j + 2), L: K(2 * i, 2 * j + 1) }
    for (const s of segs) link(E[s[0]], E[s[1]])
  }
  const seen = new Set(), loops = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const loop = []; let prev = -1, cur = start
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); loop.push(cur)
      const nb = adj.get(cur), nx = nb[0] !== prev ? nb[0] : nb[1]
      prev = cur; cur = nx
    }
    if (loop.length < 24) continue
    const pts = loop.map(p => [rx + (Math.floor(p / 65536) / 2 - 1) * step, ry + ((p % 65536) / 2 - 1) * step])
    // simplify a closed loop as two open halves: split at the point farthest
    // from the start, since a chord from a point to itself measures nothing
    let m = 0, dm = -1; pts.forEach(([x, y], i) => { const dd = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2; if (dd > dm) { dm = dd; m = i } })
    loops.push(PB.simplify(pts.slice(0, m + 1), .9).concat(PB.simplify(pts.slice(m).concat([pts[0]]), .9).slice(1, -1)))
  }
  return loops
}

// ---- watercolour: the host painted, not printed. Applied to the whole host
// layer at once, so the character stays one piece:
//   pooling    each edge of the figure darkens a little inside it, where a
//              dried wash leaves its pigment (the layer's own colours,
//              multiplied over a rim found by subtracting a blurred copy)
//   mottling   one blotchy pigment texture, with a fine granulation, across
//              every part, so the fur is not a smooth gradient
let MPAINT = null, MOTTLE = null
function paintLayer(rx, ry, rw, rh, uk) {
  const w = MLAYER.width, h = MLAYER.height
  if (!MPAINT || MPAINT.width !== w || MPAINT.height !== h) { MPAINT = document.createElement('canvas'); MPAINT.width = w; MPAINT.height = h; MOTTLE = null }
  if (!MOTTLE) {
    MOTTLE = document.createElement('canvas'); MOTTLE.width = w; MOTTLE.height = h
    const c = MOTTLE.getContext('2d'), r = lcg(97), s = w / 1280
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h)
    // with WebGL the blotches are p5.brush's own: overlapping washes painted
    // at quarter size (they are soft, and a wash costs its area) and scaled up
    if (PB.ok) c.drawImage(PB.texture('host-mottle', (tw, th) => {
      const q = lcg(41)
      for (let i = 0; i < 10; i++) {
        const cx = q() * tw, cy = q() * th, R = (.1 + q() * .18) * th, pts = []
        for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, m = R * (.7 + q() * .5); pts.push([cx + Math.cos(a) * m, cy + Math.sin(a) * m]) }
        brush.noStroke(); brush.fill('#8C7460', 70 + q() * 60); brush.fillBleed(.35, 'out'); brush.fillTexture(1, .8, true); brush.polygon(pts)
      }
    }, Math.round(w / 4), Math.round(h / 4)), 0, 0, w, h)
    else for (let i = 0; i < 140; i++) {
      const x = r() * w, y = r() * h, rr = (30 + r() * 160) * s, g = c.createRadialGradient(x, y, 0, x, y, rr), a = .05 + r() * .12
      g.addColorStop(0, `rgba(120,95,80,${a})`); g.addColorStop(.7, `rgba(120,95,80,${a * .4})`); g.addColorStop(1, 'rgba(120,95,80,0)')
      c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    for (let i = 0; i < w * h / 18; i++) { c.fillStyle = `rgba(90,70,60,${.05 + r() * .09})`; const d = (.6 + r() * 1.1) * s; c.fillRect(r() * w, r() * h, d, d) }
  }
  const L = MLAYER.getContext('2d'), Pn = MPAINT.getContext('2d')
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0)
  // pooling: the rim just inside every outer edge, in the figure's own colours
  Pn.setTransform(1, 0, 0, 1, 0, 0); Pn.globalCompositeOperation = 'source-over'; Pn.filter = 'none'; Pn.clearRect(rx, ry, rw, rh)
  Pn.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh)
  Pn.globalCompositeOperation = 'destination-out'; Pn.filter = `blur(${Math.max(1, uk * .24).toFixed(1)}px)`
  Pn.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh)
  Pn.filter = 'none'; Pn.globalCompositeOperation = 'source-over'
  L.globalCompositeOperation = 'multiply'; L.globalAlpha = PB.ok ? .55 : .38; L.drawImage(MPAINT, rx, ry, rw, rh, rx, ry, rw, rh)
  // mottling: one pigment texture over the whole figure, kept inside it
  Pn.clearRect(rx, ry, rw, rh); Pn.drawImage(MOTTLE, rx, ry, rw, rh, rx, ry, rw, rh)
  Pn.globalCompositeOperation = 'destination-in'; Pn.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh); Pn.globalCompositeOperation = 'source-over'
  L.globalAlpha = 1; L.drawImage(MPAINT, rx, ry, rw, rh, rx, ry, rw, rh)
  L.restore()
}

// A drawing-media host (crayon, pencil, marker…) takes its fills' texture
// from the style's own medium: one sheet of that medium in a pale grey, painted
// once by p5.brush and multiplied over the figure, so the fur is crayon wax or
// hatched pencil rather than flat colour.
let MTEX = null, MTEXKEY = ''
function texLayer(rx, ry, rw, rh, scene) {
  const w = MLAYER.width, h = MLAYER.height
  if (!MTEX || MTEX.width !== w || MTEX.height !== h || MTEXKEY !== scene.name) {
    MTEX = document.createElement('canvas'); MTEX.width = w; MTEX.height = h; MTEXKEY = scene.name
    MTEX.getContext('2d').drawImage(PB.texture('host-' + scene.name, scene.hostTex, Math.round(w / 2), Math.round(h / 2)), 0, 0, w, h)
  }
  if (!MPAINT || MPAINT.width !== w || MPAINT.height !== h) { MPAINT = document.createElement('canvas'); MPAINT.width = w; MPAINT.height = h }
  const L = MLAYER.getContext('2d'), Pn = MPAINT.getContext('2d')
  Pn.setTransform(1, 0, 0, 1, 0, 0); Pn.globalCompositeOperation = 'source-over'; Pn.clearRect(rx, ry, rw, rh)
  Pn.drawImage(MTEX, rx, ry, rw, rh, rx, ry, rw, rh)
  Pn.globalCompositeOperation = 'destination-in'; Pn.drawImage(MLAYER, rx, ry, rw, rh, rx, ry, rw, rh); Pn.globalCompositeOperation = 'source-over'
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'multiply'; L.drawImage(MPAINT, rx, ry, rw, rh, rx, ry, rw, rh); L.restore()
}

function drawMascot(x, y, u, o = {}) {
  const S = STYLE, B = o.m || MASCOT, sp = B.species || 'bunny', Fc = FACE[sp] || FACE.bunny
  const ink = S.dark ? mixCol(B.furCol, '#FFFFFF', .2) : S.ink
  const fur = B.furCol, pale = mixCol(fur, '#FFFFFF', .6), deep = mixCol(fur, '#2B2233', .35), dark = '#2B2233', pink = '#E98AA0', acc = B.accentCol
  const t = o.t ?? T, sq = o.sq || 0, dy = o.dy || 0
  const sw = Math.max(.6, u / 30)
  const lineOf = (pts, w = 1, col = ink, closed = false) => S.line(pts, sw * w, col, { closed, curv: .5 })
  const blob = (pts, fill, w = 1, op = .88) => S.shape(pts, { fill, op, ink: S.dark ? mixCol(fill, '#FFFFFF', .25) : S.ink, sw: sw * w, curv: .5 })
  const flat = (pts, fill, op = .85) => S.shape(pts, { fill, op, ink: null })
  const E = (cx, cy, rx, ry, n = 22, rot = 0) => rellPts(cx * u, cy * u, rx * u, ry * u, n, rot)
  const tri = (pts) => pts.map(([a, b]) => [a * u, b * u])
  boilSeed('mascot' + (o.key || ''))
  push(); translate(x, y + dy + Math.sin(t * 2.2) * u * .05); scale(1 + sq * .4, 1 - sq)
  const blink = o.blink ?? (frac(t / 3.7 + hash(u)) < .035)
  const mood = o.mood || 'neutral', look = clamp(o.look ?? 0, -1, 1), lookY = o.lookY ?? 0
  const sway = .06 * Math.sin(t * 2.1) + (o.earKick || 0)

  // what is solid so far — torso, tail, clothes — so an arm knows where it
  // lies across the figure and draws its own contour only there
  const solid = []
  const inSolid = ([px, py]) => solid.some(Q => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, yi] = Q[i], [xj, yj] = Q[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c } return c })
  const body = (pts, fill, w, op) => { solid.push(pts); blob(pts, fill, w, op) }

  // ---- behind the body: tail, cape, ears that sit behind the head. A tail
  // leaves the body low and clear of where a resting paw hangs, so the two
  // never meet in a notch.
  if (sp === 'cat') { const w = Math.sin(t * 1.6) * .3; body(ribbon([[.7 * u, -.85 * u], [1.85 * u, -.72 * u], [2.55 * u, -1.45 * u], [2.6 * u + w * .4 * u, -2.55 * u], [2.25 * u + w * u, -3.3 * u]], .6 * u, .42 * u), fur) }
  if (sp === 'dog') { const w = Math.sin(t * 11) * .22; body(rellPts(1.9 * u, -2.8 * u, .3 * u, .78 * u, 16, .75 + w), fur) }
  if (sp === 'fox') { const w = Math.sin(t * 1.4) * .12; body(rellPts(2.2 * u, -2.6 * u, .95 * u, 2.0 * u, 26, .55 + w), fur); blob(rellPts(2.2 * u + Math.sin(.55 + w) * 1.55 * u, -2.6 * u - Math.cos(.55 + w) * 1.55 * u, .55 * u, .55 * u, 16, 0), '#FFF8EE', .8) }
  // the fish faces the content on the left, so its tail swishes on the right
  if (sp === 'fish') { const w = Math.sin(t * 5) * .15; blob(tri([[1.9, -4.3], [3.4, -5.6 + w], [3.0, -4.3], [3.4, -3.0 + w]]), mixCol(fur, '#FFFFFF', .25)) }
  if (B.outfit === 'cape' && sp !== 'fish') blob([[-1.2 * u, -3.9 * u], [1.2 * u, -3.9 * u], [1.9 * u, -.2 * u + Math.sin(t * 3) * 4], [-1.9 * u, -.2 * u - Math.sin(t * 3) * 4]], acc, 1)
  const earsBehind = () => {
    const kind = B.ears || 'up'
    if (sp === 'bunny') {
      const len = kind === 'tall' ? 3.6 : kind === 'short' ? 2.1 : 2.9
      for (const side of [-1, 1]) {
        let base, ang, bend = 0
        // lop ears hang down the sides of the head, a little outward, not out like wings
        if (kind === 'lop') { base = [side * 1.5, -5.95]; ang = side * 2.78 + sway * side * .5 } else { base = [side * .72, -6.35]; ang = side * .2 + sway * (side > 0 ? 1 : -.8) }
        if (kind === 'one-down' && side > 0) bend = 1.9
        const L1 = bend ? len * .45 : len, dx = Math.sin(ang), dy2 = -Math.cos(ang), mid = [base[0] + dx * L1 / 2, base[1] + dy2 * L1 / 2]
        blob(E(mid[0], mid[1], .42, L1 / 2 + .1, 18, ang), fur)
        if (!bend) flat(E(mid[0] + dx * .05, mid[1] + dy2 * .05, .2, L1 / 2 - .35, 14, ang), pink, .6)
        else { const tip = [base[0] + dx * L1, base[1] + dy2 * L1], a2 = ang + bend, L2 = len * .6; blob(E(tip[0] + Math.sin(a2) * L2 / 2, tip[1] - Math.cos(a2) * L2 / 2, .4, L2 / 2 + .08, 16, a2), fur) }
      }
    }
    if (sp === 'cat' || sp === 'fox') {
      const big = sp === 'fox' ? 1.25 : kind === 'tall' ? 1.2 : kind === 'short' ? .8 : 1
      for (const side of [-1, 1]) {
        const fold = kind === 'lop' || (kind === 'one-down' && side > 0)
        const bx = side * 1.08, by = -6.05, h = 1.45 * big, w = .62 * big, tilt = side * (.28 + sway * .5)
        const tip = [bx + Math.sin(tilt) * h, by - Math.cos(tilt) * h]
        if (fold) { blob(tri([[bx - w, by + .1], [bx + w, by + .1], [bx + side * .9, by - .45]]), fur); continue }
        blob(tri([[bx - w * Math.cos(tilt), by - w * Math.sin(tilt) + .15], tip, [bx + w * Math.cos(tilt), by + w * Math.sin(tilt) + .15]]), fur)
        flat(tri([[bx - w * .55 * Math.cos(tilt), by + .05], [bx + Math.sin(tilt) * h * .72, by - Math.cos(tilt) * h * .72], [bx + w * .55 * Math.cos(tilt), by + .05]]), sp === 'fox' ? '#FFF1E0' : pink, .75)
        if (sp === 'fox') flat(tri([[tip[0] - .22, tip[1] + .42], tip, [tip[0] + .22, tip[1] + .42]]), '#3A2A2A', .9)
      }
    }
    if (sp === 'dog' && (kind === 'up' || kind === 'tall' || kind === 'one-down')) {
      for (const side of [-1, 1]) {
        if (kind === 'one-down' && side > 0) continue
        const h = kind === 'tall' ? 1.7 : 1.3, bx = side * 1.1, by = -6.0, tilt = side * (.35 + sway * .5)
        blob(tri([[bx - .6, by + .2], [bx + Math.sin(tilt) * h, by - Math.cos(tilt) * h], [bx + .6, by + .2]]), deep)
      }
    }
    if (sp === 'capybara') for (const side of [-1, 1]) blob(E(side * 1.3, -6.35, .34, .3, 12), deep)
    if (sp === 'fish') blob(tri([[-.9, -6.35], [.2, -7.35 + Math.sin(t * 3) * .1], [1.1, -6.35]]), mixCol(fur, '#FFFFFF', .25))
  }
  earsBehind()

  // ---- body
  if (sp !== 'fish') {
    const socks = B.patch === 'socks' ? '#FFFFFF' : fur
    blob(E(-.82, -.3, .72, .36), socks); blob(E(.82, -.3, .72, .36), socks)
    const rx = sp === 'capybara' ? 1.85 : 1.55
    body(E(0, -2.3, rx, 1.95, 30), fur)
    if (sp !== 'capybara' && B.outfit !== 'labcoat' && B.outfit !== 'hoodie') flat(E(0, -2.05, .98, 1.22, 20), sp === 'fox' ? '#FFF6EA' : pale, .8)
    if (B.patch === 'spots') { flat(E(-.7, -2.8, .38, .3, 12), deep); flat(E(.6, -1.6, .45, .34, 12), deep) }
    // clothes follow the torso's own curve: a panel is the torso's outline on
    // its outer side and a straight front edge on its inner side
    const panel = (side, x0, x1, top, bot) => {
      const pts = []
      for (let i = 0; i <= 16; i++) { const yy = lerp(top, bot, i / 16), dy = (yy + 2.3) / 1.95, xx = rx * Math.sqrt(Math.max(0, 1 - dy * dy)); pts.push([side * xx * u, yy * u]) }
      pts.push([side * x1 * u, bot * u], [side * x0 * u, top * u])
      return pts
    }
    const seam = (pts, w = .7) => S.line(pts, sw * w, S.outline || ink, { curv: .5 })
    if (B.outfit === 'labcoat') {
      // a white coat over the whole torso, open down the front over a shirt
      body(E(0, -2.3, rx + .04, 1.97, 30), '#FFFFFF', .8, 1)
      flat([[-.62 * u, -4.2 * u], [.62 * u, -4.2 * u], [.16 * u, -2.35 * u], [-.16 * u, -2.35 * u]], acc, 1)
      seam([[-.62 * u, -4.1 * u], [-.12 * u, -2.3 * u], [0, -.5 * u]]); seam([[.62 * u, -4.1 * u], [.12 * u, -2.3 * u]])
      seam([[-1.15 * u, -1.55 * u], [-.55 * u, -1.5 * u]], .6); seam([[.55 * u, -1.5 * u], [1.15 * u, -1.55 * u]], .6)
      for (const yy of [-1.95, -1.25]) S.shape(E(.2, yy, .07, .07, 8), { fill: S.outline || ink, op: 1, ink: null, flat: true })
    }
    if (B.outfit === 'hoodie') { body(E(0, -2.3, rx + .03, 1.97, 30), acc, 1, 1); seam([[-.85 * u, -1.05 * u], [-.7 * u, -1.75 * u], [.7 * u, -1.75 * u], [.85 * u, -1.05 * u]], .6) }
    if (B.outfit === 'vest') { body(panel(-1, .32, .3, -3.9, -.9), acc, .8, 1); body(panel(1, .32, .3, -3.9, -.9), acc, .8, 1) }
    if (B.outfit === 'overalls') { blob(rrPts(-1.05 * u, -2.6 * u, 2.1 * u, 2.15 * u, .4 * u), acc, .8); lineOf([[-.8 * u, -2.6 * u], [-1.1 * u, -3.8 * u]], 1.2, acc); lineOf([[.8 * u, -2.6 * u], [1.1 * u, -3.8 * u]], 1.2, acc) }
  } else {
    blob(E(0, -4.45, 2.35, 2.3, 30), fur)
    flat(E(.1, -3.7, 1.5, 1.1, 22), mixCol(fur, '#FFFFFF', .5), .7)
    // bubbles drift up
    for (let i = 0; i < 3; i++) { const p = frac(t * .35 + i / 3), bx = (-1.6 + Math.sin(t * 2 + i) * .3) * u, by = (-6.5 - p * 4) * u; S.line(ellPts(bx, by, (.12 + i * .05) * u, (.12 + i * .05) * u, 12), sw * .5, S.dark ? P0().b : S.dim, { closed: true, curv: 0 }) }
  }

  // ---- arms (fins, for a fish), inked the way a cartoonist inks them. A limb
  // is one tapered shape whose root is buried in the torso, so the figure's
  // silhouette runs from the shoulder straight into the arm with no join. Its
  // paw is the limb's own rounded end at the wrist's width, never a ball on a
  // stick, and a sleeve stops at a cuff. The only line inside the figure is
  // the arm's own contour where it lies across something solid (torso, tail,
  // clothes), in the outline's ink, fading out towards the shoulder: that is
  // how a drawing says "in front of the body" rather than "stuck on". Whatever
  // the paw holds goes between the arm and the paw, so the paw grips it.
  // Angles: 0 points right, PI/2 points down.
  const shoulder = side => sp === 'fish' ? [side * 1.95 * u, -3.9 * u] : [side * (sp === 'capybara' ? 1.05 : .85) * u, -3.1 * u]
  const rest = side => Math.PI / 2 - side * .42
  let aL = o.aL ?? rest(-1), aR = o.aR ?? rest(1), pointSide = 0, waveSide = 0
  if (o.point) {
    const [tx, ty] = o.point
    pointSide = tx - x < 0 ? -1 : 1
    const s0 = shoulder(pointSide), a = Math.atan2((ty - y - dy) - s0[1], (tx - x) - s0[0])
    if (pointSide < 0) aL = a; else aR = a
  }
  // a wave goes out to the side and up, so the paw clears the cheek
  if (o.wave) { const w = .22 * Math.sin(t * 8); waveSide = pointSide < 0 ? 1 : -1; if (waveSide > 0) aR = -Math.PI / 2 + 1.0 + w; else aL = -Math.PI / 2 - 1.0 - w }
  const sleeve = B.outfit === 'labcoat' ? '#FFFFFF' : B.outfit === 'hoodie' ? acc : fur
  const pawCol = sp === 'fox' ? '#3A2A2A' : fur
  const holdSide = !B.prop || B.prop === 'none' ? 0 : B.prop === 'pointer' ? (pointSide || -1) : (pointSide ? -pointSide : -1)
  const lineInk = S.outline || ink, wline = .085 * u
  // a stroke whose width follows wf(k), as a filled outline
  const taper = (run, wf) => {
    const Lp = [], Rp = []
    run.forEach(([p, k], i) => {
      const a = run[Math.max(0, i - 1)][0], b = run[Math.min(run.length - 1, i + 1)][0], dx = b[0] - a[0], dy2 = b[1] - a[1], d = Math.hypot(dx, dy2) || 1, w = wf(k) / 2
      Lp.push([p[0] - dy2 / d * w, p[1] + dx / d * w]); Rp.push([p[0] + dy2 / d * w, p[1] - dx / d * w])
    })
    return Lp.concat(Rp.reverse())
  }
  // the runs of a contour that lie over something solid, each reaching one
  // point past it on both ends so it meets the silhouette's outline
  const overSolid = (pts, ks, wf) => {
    let run = [], prev = null
    const flush = () => { if (run.length > 1) S.shape(taper(run, wf), { fill: lineInk, op: 1, ink: null, flat: true, exact: true }); run = [] }
    pts.forEach((p, i) => {
      const q = [p, ks[i]]
      if (inSolid(p)) { if (!run.length && prev) run.push(prev); run.push(q) } else if (run.length) { run.push(q); flush() }
      prev = q
    })
    flush()
  }
  const fade = k => { const s = clamp((k - .1) / .4); return s * s * (3 - 2 * s) }
  const arm = (side, a) => {
    const s0 = shoulder(side), active = side === pointSide || side === waveSide
    if (sp === 'fish') {
      const L = 1.05 * u, fx = s0[0] + Math.cos(a) * L, fy = s0[1] + Math.sin(a) * L
      // a fish points with its fin; it holds nothing
      void fx; void fy
      blob(rellPts(s0[0] + Math.cos(a) * L * .5, s0[1] + Math.sin(a) * L * .5, L * .62, .3 * u, 18, a), mixCol(fur, '#FFFFFF', .25), .9)
      return
    }
    const L = (active ? 2.35 : 1.75) * u, ex = s0[0] + Math.cos(a) * L, ey = s0[1] + Math.sin(a) * L
    // the elbow bows away from the body's centre line
    const px = -Math.sin(a), py = Math.cos(a), out = px * side > 0 ? 1 : -1, bow = (active ? .14 : .08) * u * out
    const mid = [(s0[0] + ex) / 2 + px * bow, (s0[1] + ey) / 2 + py * bow]
    const n = 20, C = [], hw = [], ks = [], Lft = [], Rgt = []
    for (let i = 0; i <= n; i++) {
      const k = i / n, bx = (1 - k) * (1 - k) * s0[0] + 2 * k * (1 - k) * mid[0] + k * k * ex, by = (1 - k) * (1 - k) * s0[1] + 2 * k * (1 - k) * mid[1] + k * k * ey
      const tx = 2 * (1 - k) * (mid[0] - s0[0]) + 2 * k * (ex - mid[0]), ty = 2 * (1 - k) * (mid[1] - s0[1]) + 2 * k * (ey - mid[1]), d = Math.hypot(tx, ty) || 1
      const w = lerp(.46, .36, k * k * (3 - 2 * k)) * u
      C.push([bx, by]); hw.push(w); ks.push(k)
      Lft.push([bx - ty / d * w, by + tx / d * w]); Rgt.push([bx + ty / d * w, by - tx / d * w])
    }
    // the paw is the limb's own rounded end, exactly as wide as the wrist
    const ea = Math.atan2(ey - C[n - 1][1], ex - C[n - 1][0]), rp = hw[n]
    const cap = []; for (let i = 1; i < 12; i++) { const q = ea + Math.PI / 2 - i / 12 * Math.PI; cap.push([ex + Math.cos(q) * rp, ey + Math.sin(q) * rp]) }
    const whole = Lft.concat(cap, Rgt.slice().reverse())
    // the paw starts about a paw's length back from the tip
    let c = n; for (let run = 0; c > 1 && run < .4 * u; c--) run += Math.hypot(C[c][0] - C[c - 1][0], C[c][1] - C[c - 1][1])
    const paw = Lft.slice(c).concat(cap, Rgt.slice(c).reverse())
    const ca = Math.atan2(C[c + 1][1] - C[c - 1][1], C[c + 1][0] - C[c - 1][0])
    const across = (k0, k1, t0) => [[C[c][0] + Math.cos(ca) * t0 - Math.sin(ca) * k0, C[c][1] + Math.sin(ca) * t0 + Math.cos(ca) * k0], [C[c][0] + Math.cos(ca) * t0 - Math.sin(ca) * k1, C[c][1] + Math.sin(ca) * t0 + Math.cos(ca) * k1]]
    // a cuff: a band a little wider than the arm where the sleeve ends
    const cuff = () => {
      const h = hw[c] * 1.12, th = .1 * u
      S.shape(rrPts(-th, -h, th * 2, h * 2, th * .9).map(([qx, qy]) => [C[c][0] + qx * Math.cos(ca) - qy * Math.sin(ca), C[c][1] + qx * Math.sin(ca) + qy * Math.cos(ca)]), { fill: sleeve, op: 1, ink: null, exact: true })
      S.shape(taper(across(-h, h, th).map(p => [p, 1]), () => wline * .8), { fill: lineInk, op: 1, ink: null, flat: true, exact: true })
    }
    S.shape(whole, { fill: sleeve, op: 1, ink: null })
    if (sleeve !== pawCol) S.shape(paw, { fill: pawCol, op: 1, ink: null })
    if (side === holdSide) {
      drawProp(B.prop, [ex + Math.cos(ea) * .05 * u, ey + Math.sin(ea) * .05 * u, a], u, sw, ink, acc)
      S.shape(paw, { fill: pawCol, op: 1, ink: null })
    }
    if (sleeve !== pawCol) cuff()
    // the arm's contour, only where it crosses the figure
    const contour = Lft.concat(cap, Rgt.slice().reverse()), kc = ks.concat(cap.map(() => 1), ks.slice().reverse())
    overSolid(contour, kc, k => wline * fade(k))
    // two toe creases at the tip
    for (const off of [-.13, .13]) {
      const qx = ex + Math.cos(ea) * rp * .96 - Math.sin(ea) * off * u, qy = ey + Math.sin(ea) * rp * .96 + Math.cos(ea) * off * u
      S.shape(taper([[[qx, qy], 1], [[qx - Math.cos(ea) * .17 * u, qy - Math.sin(ea) * .17 * u], 0]], k => wline * (.3 + .4 * k)), { fill: mixCol(pawCol, lineInk, .6), op: 1, ink: null, flat: true, exact: true })
    }
  }
  arm(-1, aL); arm(1, aR)
  if (sp !== 'fish') {
    if (B.outfit === 'scarf') { blob(rrPts(-1.2 * u, -4.05 * u, 2.4 * u, .5 * u, .25 * u), acc, .9); blob([[.5 * u, -3.7 * u], [.95 * u, -3.7 * u], [1.05 * u, -2.6 * u + Math.sin(t * 4) * 3], [.62 * u, -2.7 * u]], acc, .9) }
    if (B.outfit === 'bowtie') { blob([[0, -3.85 * u], [-.6 * u, -4.15 * u], [-.6 * u, -3.5 * u]], acc, .8); blob([[0, -3.85 * u], [.6 * u, -4.15 * u], [.6 * u, -3.5 * u]], acc, .8) }
    if (B.outfit === 'tie') blob([[-.18 * u, -3.9 * u], [.18 * u, -3.9 * u], [.26 * u, -2.2 * u], [0, -1.9 * u], [-.26 * u, -2.2 * u]], acc, .8)
  } else if (B.outfit === 'bowtie' || B.outfit === 'tie' || B.outfit === 'scarf') { blob([[0, -2.55 * u], [-.55 * u, -2.85 * u], [-.55 * u, -2.25 * u]], acc, .8); blob([[0, -2.55 * u], [.55 * u, -2.85 * u], [.55 * u, -2.25 * u]], acc, .8) }

  // ---- head
  push(); translate(0, -5.15 * u); rotate((o.tilt || 0) + .03 * Math.sin(t * 1.3)); translate(0, 5.15 * u)
  if (B.outfit === 'hoodie' && sp !== 'fish') blob(E(0, -5.25, 2.15, 1.9, 24), acc, 1)
  if (sp === 'capybara') blob(rrPts(-1.75 * u, -6.45 * u, 3.5 * u, 2.7 * u, 1.05 * u), fur)
  else if (sp === 'fox') { blob(E(0, -5.2, 1.95, 1.55, 30), fur); blob(tri([[-1.75, -5.0], [-2.35, -4.55], [-1.55, -4.35]]), fur, .8); blob(tri([[1.75, -5.0], [2.35, -4.55], [1.55, -4.35]]), fur, .8) }
  else if (sp !== 'fish') blob(E(0, -5.15, sp === 'cat' ? 1.95 : 1.85, sp === 'cat' ? 1.55 : 1.6, 30), fur)
  if (sp !== 'fish') S.shape(rellPts(-.85 * u, -6.05 * u, .55 * u, .22 * u, 16, -.35), { fill: '#FFFFFF', op: .32, ink: null })
  else S.shape(rellPts(-.9 * u, -5.9 * u, .6 * u, .25 * u, 16, -.4), { fill: '#FFFFFF', op: .32, ink: null })
  // markings
  if (sp === 'fox') flat([[-1.55 * u, -4.7 * u], [-.6 * u, -4.9 * u], [0, -4.72 * u], [.6 * u, -4.9 * u], [1.55 * u, -4.7 * u], [.85 * u, -4.0 * u], [0, -3.78 * u], [-.85 * u, -4.0 * u]], '#FFF6EA', .95)
  if (sp === 'dog') flat(E(0, -4.62, 1.0, .68, 22), pale, .9)
  // a capybara's big blunt muzzle: one soft shade darker than the head, no seam
  if (sp === 'capybara') flat(rellPts(0, -4.45 * u, 1.2 * u, .78 * u, 28, 0), mixCol(fur, '#2B2233', .16), 1)
  if (sp === 'cat' && B.patch === 'spots') for (const k of [-1, 0, 1]) lineOf([[k * .35 * u, -6.55 * u], [k * .3 * u, -6.05 * u]], 1.1, deep)
  if (B.patch === 'eye' && sp !== 'fish') flat(E(Fc.eyeX, Fc.eyeY, .62, .55, 16), deep, .8)
  if (sp !== 'capybara' && sp !== 'fish') { flat(E(-1.18, -4.7, .32, .18, 12), pink, .45); flat(E(1.18, -4.7, .32, .18, 12), pink, .45) }
  // eyes
  const ex = look * .14, ey = lookY * .1, es = Fc.eyeS
  // on dark fur the face line work goes light, and open eyes get a white with a pupil
  const lum = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 }
  const darkFur = lum(fur) < .34, faceInk = darkFur ? '#F6EFE6' : dark
  const eyeCol = faceInk
  for (const side of [-1, 1]) {
    const cx = side * Fc.eyeX + ex, cy = Fc.eyeY + ey
    const shut = blink || mood === 'happy' || mood === 'proud' || (mood === 'wink' && side > 0)
    if (shut) { const up = mood === 'proud' ? 1 : -1; lineOf([[(cx - .26 * es) * u, cy * u], [cx * u, (cy + .2 * up * es) * u], [(cx + .26 * es) * u, cy * u]], 1.1, eyeCol); continue }
    const big = (mood === 'surprised' || mood === 'excited' ? 1.25 : 1) * es
    if (darkFur) S.shape(E(cx, cy, .27 * big, .35 * big, 16), { fill: '#F6EFE6', op: 1, ink: null })
    S.shape(E(cx, cy + (darkFur ? .04 : 0), .21 * big * (darkFur ? .72 : 1), .3 * big * (darkFur ? .8 : 1), 14), { fill: darkFur ? '#3A7A3A' : dark, op: 1, ink: null })
    if (darkFur) S.shape(E(cx, cy + .05, .1 * big, .16 * big, 10), { fill: dark, op: 1, ink: null })
    if (!S.dark || S.name === 'pixel') { S.shape(E(cx + .07 * big, cy - .1 * big, .075 * big, .075 * big, 8), { fill: '#FFFFFF', op: 1, ink: null }); S.shape(E(cx - .06 * big, cy + .1 * big, .035 * big, .035 * big, 6), { fill: '#FFFFFF', op: 1, ink: null }) }
    if (mood === 'thinking') lineOf([[(cx - .25) * u, (cy - .52 * es) * u], [(cx + .2) * u, (cy - .6 * es) * u]], .8, eyeCol)
  }
  // nose and mouth
  const talk = clamp(o.talk || 0), mouthCol = faceInk
  if (sp === 'dog') S.shape(rrPts(-.32 * u, (Fc.noseY - .2) * u, .64 * u, .4 * u, .18 * u), { fill: '#2B2233', op: 1, ink: null })
  else if (sp === 'fox') S.shape(E(0, Fc.noseY, .2, .15, 12), { fill: '#2B2233', op: 1, ink: null })
  else if (sp === 'capybara') { S.shape(E(-.35, Fc.noseY, .12, .09, 10), { fill: '#2B2233', op: 1, ink: null }); S.shape(E(.35, Fc.noseY, .12, .09, 10), { fill: '#2B2233', op: 1, ink: null }) }
  else if (sp !== 'fish') S.shape([[-.17 * u, (Fc.noseY - .1) * u], [.17 * u, (Fc.noseY - .1) * u], [0, (Fc.noseY + .1) * u]], { fill: pink, op: 1, ink: null })
  const my = Fc.mouthY
  if (mood === 'surprised') S.shape(E(0, my, .17, .2, 12), { fill: '#7A2A3A', op: 1, ink: null })
  else if (talk > .08) S.shape(E(0, my, .22, .06 + .2 * talk, 12), { fill: '#7A2A3A', op: 1, ink: null })
  else if (sp === 'fish') S.line(ellPts(0, my * u, .14 * u, .1 * u, 12), sw * .8, mouthCol, { closed: true, curv: 0 })
  else if (sp === 'capybara') lineOf([[-.35 * u, my * u], [0, (my + .06) * u], [.35 * u, my * u]], .75, mouthCol)
  else {
    lineOf([[-.3 * u, (my - .05) * u], [-.13 * u, (my + .08) * u], [0, (my - .1) * u], [.13 * u, (my + .08) * u], [.3 * u, (my - .05) * u]], .75, mouthCol)
    if (sp === 'dog' && (mood === 'happy' || mood === 'excited')) S.shape(E(.05, my + .22, .16, .2, 12), { fill: '#E9707F', op: 1, ink: null })
  }
  if (sp === 'cat' || sp === 'bunny' || sp === 'fox') {
    const L = sp === 'cat' ? 1.9 : 1.55
    for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) lineOf([[side * .55 * u, (Fc.noseY + .05 + k * .1) * u], [side * L * u, (Fc.noseY + k * .3) * u]], .35, darkFur ? '#D8CFC6' : S.dim)
  }
  // floppy ears hang over the head
  if (sp === 'dog' && (B.ears === 'lop' || B.ears === 'short' || B.ears === 'one-down')) {
    for (const side of [-1, 1]) {
      if (B.ears === 'one-down' && side < 0) continue
      const len = B.ears === 'short' ? 1.3 : 2.0
      blob(rellPts(side * 1.72 * u, -5.35 * u, .55 * u, len / 2 * u, 18, side * (.25 + sway * .6)), deep)
    }
  }
  push(); translate(0, Fc.hatDy * u)
  drawHat(B.hat, u, sw, ink, acc, fur, t)
  pop()
  drawGlasses(B.glasses, u, sw, ex, ey + (Fc.eyeY + 5.25), Fc.eyeX)
  pop()
  pop()
}
const P0 = () => STYLE.P

function drawProp(p, hand, u, sw, ink, acc) {
  if (!p || p === 'none') return
  const S = STYLE, [hx, hy, a] = hand, L = (n, w, col) => S.line(n, sw * w, col || ink, { curv: 0 })
  const blob = (pts, fill, w = .9) => S.shape(pts, { fill, op: .9, ink: S.dark ? mixCol(fill, '#FFFFFF', .3) : S.ink, sw: sw * w })
  if (p === 'pointer') { L([[hx, hy], [hx + Math.cos(a) * 2.8 * u, hy + Math.sin(a) * 2.8 * u]], 1.2, '#8A5A3A'); S.shape(ellPts(hx + Math.cos(a) * 2.85 * u, hy + Math.sin(a) * 2.85 * u, .16 * u, .16 * u, 10), { fill: acc, op: 1, ink: null }); return }
  push(); translate(hx, hy)
  if (p === 'clipboard') { blob(rrPts(-.5 * u, -1.3 * u, 1.1 * u, 1.4 * u, .1 * u), '#C8935B'); blob(rectPts(-.38 * u, -1.15 * u, .86 * u, 1.1 * u), '#FFFFFF', .5); L([[-.25 * u, -.85 * u], [.3 * u, -.85 * u]], .5); L([[-.25 * u, -.6 * u], [.3 * u, -.6 * u]], .5) }
  else if (p === 'wrench') { rotate(-.6); blob(rrPts(-.14 * u, -1.6 * u, .28 * u, 1.6 * u, .1 * u), '#9AA3AD'); blob(ellPts(0, -1.75 * u, .36 * u, .36 * u, 14), '#9AA3AD') }
  else if (p === 'magnifier') { L([[0, 0], [.7 * u, -.7 * u]], 1.4, '#8A5A3A'); S.shape(ellPts(1.05 * u, -1.05 * u, .5 * u, .5 * u, 18), { fill: '#CFE8F5', op: .6, ink: S.dark ? '#CFE8F5' : S.ink, sw }) }
  else if (p === 'book') { blob(rectPts(-.7 * u, -1.2 * u, 1.3 * u, 1 * u), acc); L([[-.05 * u, -1.2 * u], [-.05 * u, -.2 * u]], .6) }
  else if (p === 'carrot') { rotate(-.5); blob([[-.22 * u, -1.5 * u], [.22 * u, -1.5 * u], [0, .1 * u]], '#F28C28'); L([[0, -1.5 * u], [-.2 * u, -2 * u]], 1, '#3C9A4A'); L([[0, -1.5 * u], [.2 * u, -2.05 * u]], 1, '#3C9A4A') }
  else if (p === 'pencil') { rotate(-.4); blob(rectPts(-.14 * u, -1.8 * u, .28 * u, 1.5 * u), '#F2C230'); blob([[-.14 * u, -.3 * u], [.14 * u, -.3 * u], [0, .1 * u]], '#E8C9A0', .6) }
  else if (p === 'flag') { L([[0, .2 * u], [0, -2.4 * u]], 1, '#8A5A3A'); blob([[0, -2.4 * u], [1.2 * u, -2.1 * u + Math.sin(T * 6) * 3], [0, -1.7 * u]], acc) }
  pop()
}

function drawHat(h, u, sw, ink, acc, fur, t) {
  if (!h || h === 'none') return
  const S = STYLE, blob = (pts, fill, w = .9) => S.shape(pts, { fill, op: .9, ink: S.dark ? mixCol(fill, '#FFFFFF', .3) : S.ink, sw: sw * w, curv: .4 })
  const E = (cx, cy, rx, ry, n = 20, rot = 0) => rellPts(cx * u, cy * u, rx * u, ry * u, n, rot)
  if (h === 'hardhat') { blob([[-1.35 * u, -6.1 * u], [-1.2 * u, -7.1 * u], [0, -7.55 * u], [1.2 * u, -7.1 * u], [1.35 * u, -6.1 * u]], '#F2C230'); blob(rrPts(-1.75 * u, -6.25 * u, 3.5 * u, .3 * u, .12 * u), '#F2C230') }
  else if (h === 'beret') blob(E(-.3, -6.55, 1.55, .5, 20, -.15), acc)
  else if (h === 'wizard') { blob([[-1.1 * u, -6.3 * u], [1.1 * u, -6.3 * u], [.3 * u, -9.2 * u]], acc); S.shape(starPts(0, -7.4 * u, .28 * u, .4, 5), { fill: '#F2C230', op: 1, ink: null }); blob(rrPts(-1.5 * u, -6.45 * u, 3 * u, .3 * u, .12 * u), acc) }
  else if (h === 'cap') { blob([[-1.3 * u, -6.1 * u], [-1.1 * u, -7.05 * u], [.2 * u, -7.35 * u], [1.25 * u, -6.9 * u], [1.35 * u, -6.1 * u]], acc); blob([[.6 * u, -6.25 * u], [2.3 * u, -6.1 * u], [2.1 * u, -5.9 * u], [.6 * u, -6.0 * u]], mixCol(acc, '#000000', .2)) }
  else if (h === 'headphones') { S.line([[-1.85 * u, -5.2 * u], [-1.3 * u, -7 * u], [0, -7.35 * u], [1.3 * u, -7 * u], [1.85 * u, -5.2 * u]], sw * 1.6, '#3A3A48', { curv: .6 }); blob(rrPts(-2.25 * u, -5.8 * u, .6 * u, 1.1 * u, .25 * u), acc); blob(rrPts(1.65 * u, -5.8 * u, .6 * u, 1.1 * u, .25 * u), acc) }
  else if (h === 'crown') blob([[-1 * u, -6.4 * u], [-1.05 * u, -7.4 * u], [-.5 * u, -6.95 * u], [0, -7.6 * u], [.5 * u, -6.95 * u], [1.05 * u, -7.4 * u], [1 * u, -6.4 * u]], '#F2C230')
  else if (h === 'goggles') { S.line([[-1.85 * u, -5.95 * u], [1.85 * u, -5.95 * u]], sw * 2, '#5A4A3A', { curv: 0 }); blob(E(-.62, -6.0, .48, .4, 16), '#9FD8E8'); blob(E(.62, -6.0, .48, .4, 16), '#9FD8E8') }
  else if (h === 'party') { blob([[-.7 * u, -6.45 * u], [.7 * u, -6.45 * u], [.1 * u, -8.3 * u]], acc); S.shape(E(.1, -8.35, .22, .22, 10), { fill: '#F2C230', op: 1, ink: null }) }
  else if (h === 'chef') { blob(rectPts(-1 * u, -7 * u, 2 * u, .7 * u), '#FFFFFF'); blob(E(-.55, -7.35, .6, .5, 14), '#FFFFFF'); blob(E(.55, -7.35, .6, .5, 14), '#FFFFFF'); blob(E(0, -7.65, .65, .55, 14), '#FFFFFF') }
  else if (h === 'beanie') { blob([[-1.5 * u, -6.1 * u], [-1.25 * u, -7.1 * u], [0, -7.5 * u], [1.25 * u, -7.1 * u], [1.5 * u, -6.1 * u]], acc); blob(rrPts(-1.6 * u, -6.35 * u, 3.2 * u, .45 * u, .2 * u), mixCol(acc, '#FFFFFF', .3)); S.shape(E(0, -7.65, .35, .35, 12), { fill: mixCol(acc, '#FFFFFF', .5), op: 1, ink: null }) }
  else if (h === 'flower') { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + t * .5; S.shape(E(1.25 + Math.cos(a) * .32, -6.35 + Math.sin(a) * .32, .24, .24, 10), { fill: acc, op: .95, ink: null }) } S.shape(E(1.25, -6.35, .18, .18, 10), { fill: '#F2C230', op: 1, ink: null }) }
  else if (h === 'tophat') { blob(rectPts(-.8 * u, -8.3 * u, 1.6 * u, 1.8 * u), '#2E2A33'); blob(rrPts(-1.35 * u, -6.65 * u, 2.7 * u, .3 * u, .1 * u), '#2E2A33'); S.shape(rectPts(-.8 * u, -6.95 * u, 1.6 * u, .3 * u), { fill: acc, op: 1, ink: null }) }
  else if (h === 'bandana') { blob([[-1.7 * u, -5.9 * u], [-1.2 * u, -6.9 * u], [1.2 * u, -6.9 * u], [1.7 * u, -5.9 * u]], acc); blob([[1.6 * u, -6 * u], [2.3 * u, -5.6 * u + Math.sin(t * 5) * 3], [2.1 * u, -6.3 * u]], acc) }
  else if (h === 'yuzu') { blob(E(.2, -7.0, .75, .62, 20), '#F2A93B'); blob(E(.55, -7.62, .32, .14, 10, -.5), '#5AA84A', .6) }
}

function drawGlasses(g, u, sw, ex, ey, eyeX = .68) {
  if (!g || g === 'none') return
  const S = STYLE, col = S.dark ? '#EAF3FF' : '#2B2233', L = (pts, w = 1) => S.line(pts, sw * w, col, { closed: true, curv: 0 })
  const cy = (-5.25 + ey) * u
  if (g === 'round' || g === 'monocle') {
    for (const s of g === 'monocle' ? [1] : [-1, 1]) L(ellPts((s * eyeX + ex) * u, cy, .44 * u, .44 * u, 18), .8)
    if (g === 'round') S.line([[(-eyeX + .44 + ex) * u, cy], [(eyeX - .44 + ex) * u, cy]], sw * .8, col, { curv: 0 })
    else S.line([[(eyeX + .44 + ex) * u, cy], [1.6 * u, cy + 1.4 * u]], sw * .5, col, { curv: .5 })
  } else if (g === 'square' || g === 'shades') {
    for (const s of [-1, 1]) {
      const pts = rrPts((s * eyeX + ex - .46) * u, cy - .34 * u, .92 * u, .68 * u, .12 * u)
      if (g === 'shades') S.shape(pts, { fill: '#1E1E28', op: 1, ink: col, sw: sw * .8 }); else L(pts, .8)
    }
    S.line([[(-eyeX + .46 + ex) * u, cy - .1 * u], [(eyeX - .46 + ex) * u, cy - .1 * u]], sw * .8, col, { curv: 0 })
  }
}
