// styles.js — seven looks. A style owns the ground under every scene, the
// texture over it, how a line and a filled shape are drawn, how text is set,
// how a phrase is highlighted, how a data packet looks, the cut between scenes
// and the kind of score under it (audio.py reads `music` and `bpm`). Scenes
// only ever call these, so one storyboard renders in any style.
//
//   watercolour  paper, pooled washes, boiling ink          (the painted cut)
//   chalkboard   slate, chalk hatching and dust               (lo-fi piano)
//   blueprint    drafting grid, rotring lines, construction   (synth arps)
//   neon         dark room, glowing tubes, a synthwave floor  (synthwave)
//   notebook     ruled paper, ballpoint, highlighter          (ukulele)
//   riso         two-ink print, flat fills, misregistration   (marimba)
//   pixel        320x180 on a 16-colour palette, hard pixels  (chiptune)
const STYLES = (() => {
  const cache = {}
  const cached = (key, w, h, draw) => {
    const k = key + w
    if (!cache[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); cache[k] = c }
    return cache[k]
  }
  const speckle = (c, w, h, n, col, amax, seed, rmax = 1.2) => {
    const r = lcg(seed); c.fillStyle = col
    for (let i = 0; i < n; i++) { c.globalAlpha = r() * amax; const s = .4 + r() * rmax; c.fillRect(r() * w, r() * h, s, s) }
    c.globalAlpha = 1
  }
  const vignette = (c, w, h, col, a) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * .42, w / 2, h / 2, h * 1.02)
    g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, a)); c.fillStyle = g; c.fillRect(0, 0, w, h)
  }
  // plain canvas stroke of a polyline (optionally smoothed)
  const poly = (pts, closed, curv) => {
    const P = curv ? (closed ? throughClosed(pts, 5) : through(pts, 6)) : pts
    G.beginPath(); G.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) G.lineTo(P[i][0], P[i][1]); if (closed) G.closePath()
  }
  const P = () => STYLE.P, P0 = P
  const lumOf = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 }
  // the colour a multiply lay-down leaves: `c` on paper `p`
  const mulCol = (c, p) => { const a = parseInt(c.slice(1), 16), b = parseInt(p.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round((a >> s & 255) * (b >> s & 255) / 255).toString(16).padStart(2, '0')).join('') }
  const lenOf = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L }

  // ------------------------------------------------------------- watercolour
  const watercolour = {
    name: 'watercolour', dark: false, ink: '#2B2233', dim: '#6B6275', paper: '#F3EBDC', music: 'paper', bpm: 120, trans: 'brush',
    font: { head: { fam: FAM.marker, caps: true }, body: { fam: FAM.hanken, w: 700 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.hanken, w: 800 } },
    pals: {
      'pink-blue': { a: '#E27A92', b: '#3B4E9A', hi: '#F2C94C', light: '#F7D9DF', wash: '#DCE6F4' },
      'orange-blue': { a: '#D97757', b: '#3B4E9A', hi: '#F2C94C', light: '#F9DECF', wash: '#DDE3F0' },
      'red-marine': { a: '#C8553D', b: '#23737A', hi: '#F2C94C', light: '#F4D5CC', wash: '#D4EAE8' },
      'green-pink': { a: '#6E9F58', b: '#D96A86', hi: '#F2C94C', light: '#DFEDD3', wash: '#F6DFE5' },
      'purple-sun': { a: '#7B5CA8', b: '#C98A1E', hi: '#8FD3C9', light: '#E6DCF2', wash: '#F8EACB' },
      'teal-flame': { a: '#3A9C98', b: '#D97757', hi: '#F2C94C', light: '#D2ECE9', wash: '#F9DECF' },
    },
    ground(g, w, h) {
      g.drawImage(cached('wc-paper', w, h, (c, w, h) => {
        const rnd = lcg(11), s = w / W; c.fillStyle = this.paper; c.fillRect(0, 0, w, h); c.scale(s, s)
        for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 380, gr = c.createRadialGradient(x, y, 0, x, y, r), a = .045 * rnd(); gr.addColorStop(0, `rgba(160,125,80,${a})`); gr.addColorStop(1, 'rgba(160,125,80,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r) }
        c.lineWidth = 1
        for (let i = 0; i < 1400; i++) { const x = rnd() * W, y = rnd() * H, l = 6 + rnd() * 26, a = rnd() * TAU; c.strokeStyle = `rgba(110,88,60,${.035 + rnd() * .06})`; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke() }
      }), 0, 0)
    },
    over(g, w, h) {
      g.globalCompositeOperation = 'multiply'
      g.drawImage(cached('wc-grain', w, h, (c, w, h) => {
        const id = c.createImageData(w, h), d = id.data, rnd = lcg(5)
        for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < .55 ? rnd() * rnd() * 26 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 3; d[i + 3] = 255 }
        c.putImageData(id, 0, 0); vignette(c, w, h, '#78604A', .28)
      }), 0, 0)
    },
    // with WebGL these are real p5.brush paintings (brushbake.js): washes that
    // bleed and pool, charcoal ink; without it, the Canvas2D washes below
    line(pts, sw, col, o = {}) {
      const curv = o.curv ?? .5, P = curv > 0 && pts.length > 2 ? (o.closed ? throughClosed(pts, 5) : through(pts, 6)) : pts
      let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
      if (PB.ok && L * SCALE > 18) return PB.line(P, { ink: col || this.ink, brush: 'charcoal', weight: sw * .95 }, !!o.closed)
      strokePath(pts, !!o.closed, sw, col || this.ink, o.br || 'ink', curv)
    },
    shape(pts, o = {}) {
      const ink = o.ink === null ? null : (o.ink || this.ink)
      if (PB.ok && !PB.tiny(pts)) {
        const P = o.curv ? throughClosed(pts, 5) : pts, a = clamp((o.op ?? .75) / .75), wash = { fill: o.fill, alpha: 150, bleed: o.bleed ?? .1, tex: .5, border: .5 }
        const pen = { ink, brush: 'charcoal', weight: o.sw ?? 1 }
        // a faded wash keeps its outline at full strength, so they are two paintings
        if (!o.fill) return ink && PB.line(P, pen, true)
        if (!ink) return PB.shape(P, wash, a)
        if (a > .98) return PB.shape(P, { ...wash, ...pen })
        PB.shape(P, wash, a); return PB.line(P, pen, true)
      }
      paint(pts, { fill: o.fill, fillOp: 255 * (o.op ?? .75), bleed: o.bleed ?? .06, tex: .4, border: .35, ink, sw: o.sw ?? 1, curv: o.curv || 0 })
    },
    flat(pts, col, a = 1) { paint(pts, { wash: col, washOp: 255 * a, ink: null }) },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return
      // the whole swipe is painted once and revealed left to right
      if (PB.ok) return PB.shape(rectPts(x - 12, y - 4, w + 24, h + 14), { fill: col, alpha: 190, bleed: .04, tex: .3, border: .3 }, 1, k >= 1 ? null : [x - 60, y - 60, (w + 24) * k + 48, h + 120])
      boilSeed('hl' + Math.round(x + y)); paint(rectPts(x - 12, y - 4, (w + 24) * k, h + 14), { fill: col, fillOp: 190, bleed: .02, tex: .2, border: .2, ink: null })
    },
    shadow(x, y, rx, ry) {
      if (PB.ok) return PB.shape(ellPts(x, y, rx, ry, 14), { fill: '#2B2233', alpha: 90, bleed: .12, tex: .4, border: .2 }, .35)
      paint(ellPts(x, y, rx, ry, 22), { wash: '#2B2233', washOp: 40, ink: null })
    },
  }

  // --------------------------------------------------------------- chalkboard
  const chalkboard = {
    name: 'chalkboard', dark: true, ink: '#F2F0E6', dim: '#B9C2BA', music: 'lofi', bpm: 86, trans: 'erase',
    font: { head: { fam: FAM.sketch, w: 700, k: 1.05 }, body: { fam: FAM.patrick, k: 1.12 }, mono: { fam: FAM.patrick, k: 1.08 }, label: { fam: FAM.sketch, w: 700 } },
    pals: {
      green: { bg: '#24392F', a: '#F6D776', b: '#8FD0E8', hi: '#F29CBF', light: '#BFE3A8', wash: '#2E4739' },
      slate: { bg: '#2B3138', a: '#F6D776', b: '#F29CBF', hi: '#8FD0E8', light: '#C5B6F0', wash: '#353D46' },
      night: { bg: '#1F2223', a: '#9FE0B8', b: '#F7B26A', hi: '#F6D776', light: '#8FD0E8', wash: '#2A2E2F' },
    },
    ground(g, w, h) {
      const bg = P().bg
      g.drawImage(cached('ch-' + bg, w, h, (c, w, h) => {
        const r = lcg(3); c.fillStyle = bg; c.fillRect(0, 0, w, h)
        for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h, rr = (.1 + r() * .35) * w, gr = c.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.035)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h) }
        // old erasing, swept in arcs
        c.lineCap = 'round'
        for (let i = 0; i < 12; i++) { c.strokeStyle = `rgba(255,255,255,${.012 + r() * .02})`; c.lineWidth = (30 + r() * 60) * w / W; c.beginPath(); const x = r() * w, y = r() * h; c.arc(x, y, (.1 + r() * .3) * w, r() * 6, r() * 6 + 1.5); c.stroke() }
        speckle(c, w, h, w * h / 30, '#FFFFFF', .06, 9)
        vignette(c, w, h, '#000000', .35)
      }), 0, 0)
    },
    over(g, w, h) {
      // dust in the board's own colour, over everything: chalk never covers solidly
      g.drawImage(cached('ch-dust-' + P().bg, w, h, (c, w, h) => speckle(c, w, h, w * h / 8, P().bg, .6, 21, 1.5)), 0, 0)
    },
    line(pts, sw, col, o = {}) {
      col = col || this.ink
      strokePath(pts, !!o.closed, sw * .62, hexA(col, .9), 'inkfine', o.curv ?? .5)
      strokePath(pts, !!o.closed, sw * .9, col, 'charcoal', o.curv ?? .5)
    },
    shape(pts, o = {}) {
      const c = o.fill, S = o.curv ? throughClosed(pts, 5) : pts, bb = bbox(S)
      if (c) {
        // big shapes are hatched; small ones (the bunny's parts) get a soft solid rub, or they turn to noise
        const small = bb.w * bb.h < 40000
        G.save(); pathOf(S, true); G.fillStyle = hexA(c, (small ? .5 : .16) * (o.op ?? .75) / .75); G.fill(); G.restore()
        if (!small) hatchFill(S, { d: 13, a: .95 + hash(pts.length) * .3, c: hexA(c, .7), w: 1.5 })
      }
      if (o.ink !== null) this.line(pts, o.sw ?? 1, o.ink || (c ? mixCol(c, '#FFFFFF', .35) : this.ink), { closed: true, curv: o.curv || 0 })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return; boilSeed('hl' + Math.round(x))
      const x1 = x + w * k, yy = y + h + 8
      this.line([[x - 6, yy], [(x + x1) / 2, yy + 4], [x1 + 6, yy - 2]], 2.2, col, { curv: .5 })
      if (k > .6) this.line([[x + 10, yy + 12], [x1 - 4, yy + 9]], 1.4, col, { curv: .5 })
    },
    shadow() {},
  }

  // ---------------------------------------------------------------- blueprint
  const blueprint = {
    name: 'blueprint', dark: true, ink: '#EAF3FF', dim: '#A9C4E6', music: 'synth', bpm: 122, trans: 'slide',
    font: { head: { fam: FAM.plex, w: 700, caps: true, k: .92 }, body: { fam: FAM.hanken, w: 600 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.plex, w: 700, caps: true } },
    pals: {
      cobalt: { bg: '#1C4E8A', a: '#FFD166', b: '#8EC9FF', hi: '#FF9F80', light: '#CFE6FF', wash: '#2A5F9E' },
      navy: { bg: '#12375F', a: '#7CF0C9', b: '#8EC9FF', hi: '#FFD166', light: '#CFE6FF', wash: '#1D4675' },
      teal: { bg: '#15505A', a: '#FFD166', b: '#9FE8FF', hi: '#FF9F80', light: '#D5F3F6', wash: '#1F616C' },
    },
    ground(g, w, h) {
      const bg = P().bg
      g.drawImage(cached('bp-' + bg, w, h, (c, w, h) => {
        const s = w / W; c.fillStyle = bg; c.fillRect(0, 0, w, h)
        const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = gr; c.fillRect(0, 0, w, h)
        c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1
        for (let x = 0; x <= W; x += 40) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, h); c.stroke() }
        for (let y = 0; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y * s); c.lineTo(w, y * s); c.stroke() }
        c.strokeStyle = 'rgba(255,255,255,.14)'
        for (let x = 0; x <= W; x += 200) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, h); c.stroke() }
        for (let y = 0; y <= H; y += 200) { c.beginPath(); c.moveTo(0, y * s); c.lineTo(w, y * s); c.stroke() }
        c.strokeStyle = 'rgba(234,243,255,.55)'; c.lineWidth = 2 * s; c.strokeRect(40 * s, 40 * s, w - 80 * s, h - 80 * s)
        c.lineWidth = 1 * s; c.strokeRect(52 * s, 52 * s, w - 104 * s, h - 104 * s)
        speckle(c, w, h, w * h / 40, '#FFFFFF', .05, 4)
        vignette(c, w, h, '#000814', .35)
      }), 0, 0)
    },
    over() {},
    line(pts, sw, col, o = {}) {
      col = col || this.ink
      strokePath(pts, !!o.closed, sw * 1.15, col, 'rotring', 0)
      if (o.closed && pts.length <= 5 && !o.curv) {
        // construction lines: every edge overshoots its corner a little
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d
          strokePath([[a[0] - ux * 16, a[1] - uy * 16], [a[0], a[1]]], false, sw * .5, hexA(col, .6), 'rotring', 0)
          strokePath([[b[0], b[1]], [b[0] + ux * 16, b[1] + uy * 16]], false, sw * .5, hexA(col, .6), 'rotring', 0)
        }
      }
    },
    shape(pts, o = {}) {
      const S = o.curv ? throughClosed(pts, 5) : pts
      if (o.fill) { G.save(); pathOf(S, true); G.fillStyle = hexA(o.fill, .22 * (o.op ?? .75) / .75); G.fill(); G.restore() }
      if (o.ink !== null) this.line(S, o.sw ?? 1, o.ink || (o.fill ? mixCol(o.fill, '#FFFFFF', .5) : this.ink), { closed: true, curv: 0 })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return
      G.save(); G.fillStyle = hexA(col, .18); G.fillRect(x - 10, y - 6, (w + 20) * k, h + 14)
      G.setLineDash([12, 8]); G.lineWidth = 2.5; G.strokeStyle = col; G.strokeRect(x - 10, y - 6, (w + 20) * k, h + 14); G.restore()
    },
    shadow() {},
  }

  // --------------------------------------------------------------------- neon
  const glowStroke = (col, width, blur) => { G.shadowColor = col; G.shadowBlur = blur * SCALE; G.strokeStyle = col; G.lineWidth = width; G.lineCap = 'round'; G.lineJoin = 'round' }
  const neon = {
    name: 'neon', dark: true, ink: '#EAF6FF', dim: '#98A0C8', music: 'wave', bpm: 104, trans: 'flicker',
    font: { head: { fam: FAM.righteous, k: 1.02 }, body: { fam: FAM.hanken, w: 700 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.righteous } },
    pals: {
      club: { bg: '#0C0B18', a: '#FF4FD8', b: '#3EF0FF', hi: '#B6FF3B', light: '#FFB347', wash: '#15132A' },
      ocean: { bg: '#06131C', a: '#3EF0FF', b: '#9B7BFF', hi: '#FFE45C', light: '#FF6FA8', wash: '#0B2130' },
      sunset: { bg: '#140816', a: '#FF8A3D', b: '#FF3D7F', hi: '#44F2C1', light: '#9D7BFF', wash: '#221026' },
    },
    ground(g, w, h) {
      const p = P()
      g.drawImage(cached('ne-' + p.bg, w, h, (c, w, h) => {
        const s = w / W; c.fillStyle = p.bg; c.fillRect(0, 0, w, h)
        const hz = 800 * s, gr = c.createLinearGradient(0, hz - 260 * s, 0, hz); gr.addColorStop(0, hexA(p.a, 0)); gr.addColorStop(1, hexA(p.a, .14)); c.fillStyle = gr; c.fillRect(0, hz - 260 * s, w, 260 * s)
        c.strokeStyle = hexA(p.b, .22); c.lineWidth = 1.2 * s
        for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(w / 2 + i * 40 * s, hz); c.lineTo(w / 2 + i * 260 * s, h); c.stroke() }
        for (let k = 0; k < 9; k++) { const y = hz + (h - hz) * Math.pow(k / 8, 1.8); c.globalAlpha = .25 + k * .05; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke() }
        c.globalAlpha = 1; speckle(c, w, hz, 180, '#FFFFFF', .5, 13, 1.5)
        vignette(c, w, h, '#000000', .6)
      }), 0, 0)
    },
    over(g, w, h) {
      g.drawImage(cached('ne-scan', w, h, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1) }), 0, 0)
    },
    line(pts, sw, col, o = {}) {
      col = col || this.ink
      G.save(); poly(pts, !!o.closed, o.curv ?? .5 ? .5 : 0)
      glowStroke(col, 5.5 * sw, 26); G.globalAlpha *= .55; G.stroke()
      G.globalAlpha /= .55; glowStroke(mixCol(col, '#FFFFFF', .55), 2.2 * sw, 8); G.stroke(); G.restore()
    },
    shape(pts, o = {}) {
      const S = o.curv ? throughClosed(pts, 5) : pts, c = o.fill || this.ink
      G.save(); pathOf(S, true); G.fillStyle = hexA(mixCol(P().bg, c, .12), .92 * (o.op ?? .75) / .75); G.fill(); G.restore()
      if (o.ink !== null) this.line(S, o.sw ?? 1, o.ink || c, { closed: true, curv: 0 })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    write(str, x, y, f, col, o = {}) {
      G.save(); G.shadowColor = col === this.ink ? P().b : col; G.shadowBlur = (col === this.ink ? 10 : 22) * SCALE
      text(str, x, y, f, col, o); G.restore()
    },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return
      G.save(); G.fillStyle = hexA(col, .14); G.fillRect(x - 10, y - 4, (w + 20) * k, h + 10)
      poly([[x - 6, y + h + 12], [x - 6 + (w + 12) * k, y + h + 12]], false, 0); glowStroke(col, 5, 20); G.stroke(); G.restore()
    },
    shadow() {},
  }

  // ----------------------------------------------------------------- notebook
  const notebook = {
    name: 'notebook', dark: false, ink: '#1F3A93', dim: '#55628F', paper: '#FBF8EF', music: 'uke', bpm: 104, trans: 'page',
    font: { head: { fam: FAM.caveat, w: 700, k: 1.3 }, body: { fam: FAM.caveat, w: 700, k: 1.22 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.caveat, w: 700, k: 1.2 } },
    pals: {
      yellow: { a: '#FFE45C', b: '#FF9EC7', hi: '#8FEA8F', light: '#A5D8FF', wash: '#EEF4FF' },
      pink: { a: '#FF9EC7', b: '#8FEA8F', hi: '#FFE45C', light: '#FFD3A5', wash: '#FFF0F5' },
      green: { a: '#8FEA8F', b: '#A5D8FF', hi: '#FFE45C', light: '#FF9EC7', wash: '#EFFBEF' },
    },
    ground(g, w, h) {
      g.drawImage(cached('nb-paper', w, h, (c, w, h) => {
        const s = w / W; c.fillStyle = this.paper; c.fillRect(0, 0, w, h)
        c.strokeStyle = 'rgba(120,160,215,.42)'; c.lineWidth = 1.6 * s
        for (let y = 160; y < H; y += 56) { c.beginPath(); c.moveTo(0, y * s); c.lineTo(w, y * s); c.stroke() }
        c.strokeStyle = 'rgba(230,110,110,.55)'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(88 * s, 0); c.lineTo(88 * s, h); c.stroke()
        for (const y of [200, 540, 880]) { c.fillStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.arc(40 * s, (y + 3) * s, 17 * s, 0, TAU); c.fill(); c.fillStyle = '#E9E4D6'; c.beginPath(); c.arc(38 * s, y * s, 16 * s, 0, TAU); c.fill() }
        speckle(c, w, h, w * h / 60, '#6B5B3E', .05, 7)
        vignette(c, w, h, '#7A6A50', .16)
      }), 0, 0)
    },
    over() {},
    line(pts, sw, col, o = {}) { strokePath(pts, !!o.closed, sw * 1.5, col || this.ink, 'pen', o.curv ?? .5) },
    shape(pts, o = {}) {
      const S = o.curv ? throughClosed(pts, 5) : pts
      if (o.fill) { G.save(); G.globalCompositeOperation = 'multiply'; boilSeed('nbf' + pts.length); const r = seededRng(shapeSeed(pts, 3)); pathOf(deform(S, 1, 6, r), true); G.fillStyle = hexA(o.fill, .72 * (o.op ?? .75) / .75); G.fill(); G.restore() }
      if (o.ink !== null) this.line(pts, o.sw ?? 1, o.ink || this.ink, { closed: true, curv: o.curv || 0 })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return
      G.save(); G.globalCompositeOperation = 'multiply'; G.fillStyle = hexA(col, .8)
      const x1 = x - 8 + (w + 16) * k
      G.beginPath(); G.moveTo(x - 8, y + 2); G.lineTo(x1, y - 2); G.lineTo(x1 - 4, y + h + 12); G.lineTo(x - 12, y + h + 14); G.closePath(); G.fill(); G.restore()
    },
    shadow(x, y, rx, ry) { G.save(); G.fillStyle = 'rgba(31,58,147,.10)'; G.beginPath(); G.ellipse(x, y, rx, ry, 0, 0, TAU); G.fill(); G.restore() },
  }

  // --------------------------------------------------------------------- riso
  const riso = {
    name: 'riso', dark: false, ink: '#262140', dim: '#5E5873', paper: '#F5EFE0', music: 'marimba', bpm: 116, trans: 'blocks',
    font: { head: { fam: FAM.hanken, w: 900, k: 1.02 }, body: { fam: FAM.hanken, w: 700 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.hanken, w: 800, caps: true } },
    pals: {
      'pink-blue': { a: '#FF48B0', b: '#0078BF', hi: '#FFE800', light: '#FFC9E5', wash: '#D8ECF8' },
      'orange-teal': { a: '#FF6C2F', b: '#00838A', hi: '#FFE800', light: '#FFD4BF', wash: '#CFEDEC' },
      'yellow-violet': { a: '#F2C500', b: '#765BA7', hi: '#FF48B0', light: '#FFF2A8', wash: '#E6DDF3' },
      'green-red': { a: '#00A95C', b: '#E8403A', hi: '#FFE800', light: '#C4EDD6', wash: '#FBD9D6' },
    },
    ground(g, w, h) {
      g.drawImage(cached('ri-paper', w, h, (c, w, h) => { c.fillStyle = this.paper; c.fillRect(0, 0, w, h); speckle(c, w, h, w * h / 8, '#8A7A5A', .07, 17, .8) }), 0, 0)
    },
    over(g, w, h) {
      g.globalCompositeOperation = 'screen'
      g.drawImage(cached('ri-grain', w, h, (c, w, h) => speckle(c, w, h, w * h / 4, '#FFFFFF', .35, 29, 1)), 0, 0)
    },
    line(pts, sw, col, o = {}) {
      col = col || this.ink
      G.save(); G.globalCompositeOperation = 'multiply'
      G.translate(4, 3); strokePath(pts, !!o.closed, sw * 1.1, hexA(P().b, .45), 'marker', o.curv ?? .4); G.translate(-4, -3)
      strokePath(pts, !!o.closed, sw * 1.1, col, 'marker', o.curv ?? .4); G.restore()
    },
    shape(pts, o = {}) {
      const S = o.curv ? throughClosed(pts, 5) : pts
      if (o.fill) { G.save(); G.globalCompositeOperation = 'multiply'; pathOf(S, true); G.fillStyle = hexA(o.fill, .9 * (o.op ?? .75) / .75); G.fill(); G.restore() }
      if (o.ink !== null) this.line(S, o.sw ?? 1, o.ink || this.ink, { closed: true, curv: 0 })
    },
    flat(pts, col, a = 1) { G.save(); G.globalCompositeOperation = 'multiply'; pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    write(str, x, y, f, col, o = {}) {
      G.save(); G.globalCompositeOperation = 'multiply'
      if (col === this.ink) text(str, x + 3, y + 3, f, hexA(P().a, .75), o)
      text(str, x, y, f, col, o); G.restore()
    },
    hl(x, y, w, h, col, k) { if (k <= 0) return; G.save(); G.globalCompositeOperation = 'multiply'; G.fillStyle = hexA(col, .9); G.fillRect(x - 10, y + h * .15, (w + 20) * k, h * .95); G.restore() },
    shadow(x, y, rx, ry) { G.save(); G.globalCompositeOperation = 'multiply'; G.fillStyle = hexA(P().b, .25); G.beginPath(); G.ellipse(x + 6, y, rx, ry, 0, 0, TAU); G.fill(); G.restore() },
  }

  // -------------------------------------------------------------------- pixel
  const PICO = ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA']
  const PICO_RGB = PICO.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
  const pixel = {
    name: 'pixel', dark: true, lowres: [320, 180], minPx: 44, ls: 6, ink: '#FFF1E8', dim: '#C2C3C7', music: 'chip', bpm: 132, trans: 'dither',
    font: { head: { fam: FAM.silk, caps: true, k: 1.1 }, body: { fam: FAM.vt, k: 1.55 }, mono: { fam: FAM.vt, k: 1.45 }, label: { fam: FAM.silk, caps: true, k: 1.05 } },
    pals: {
      pico: { bg: '#1D2B53', a: '#FF004D', b: '#29ADFF', hi: '#FFEC27', light: '#00E436', wash: '#1D2B53' },
      night: { bg: '#000000', a: '#FFA300', b: '#FF77A8', hi: '#00E436', light: '#29ADFF', wash: '#1D2B53' },
      wine: { bg: '#7E2553', a: '#FFEC27', b: '#29ADFF', hi: '#00E436', light: '#FF77A8', wash: '#5F574F' },
    },
    ground(g, w, h) {
      const p = P()
      g.drawImage(cached('px-' + p.bg, w, h, (c, w, h) => {
        c.fillStyle = p.bg; c.fillRect(0, 0, w, h)
        const r = lcg(31); for (let i = 0; i < 60; i++) { c.fillStyle = r() < .7 ? '#5F574F' : '#C2C3C7'; c.fillRect(Math.floor(r() * w), Math.floor(r() * h * .7), 1, 1) }
      }), 0, 0)
    },
    over() {},
    quantize(g, w, h) {
      const id = g.getImageData(0, 0, w, h), d = id.data, memo = new Map()
      for (let i = 0; i < d.length; i += 4) {
        const key = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3)
        let best = memo.get(key)
        if (best === undefined) {
          let bd = 1e9; best = 0
          for (let k = 0; k < 16; k++) { const q = PICO_RGB[k], dr = d[i] - q[0], dg = d[i + 1] - q[1], db = d[i + 2] - q[2], dd = dr * dr * .3 + dg * dg * .59 + db * db * .11; if (dd < bd) { bd = dd; best = k } }
          memo.set(key, best)
        }
        const q = PICO_RGB[best]; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255
      }
      g.putImageData(id, 0, 0)
    },
    line(pts, sw, col, o = {}) { G.save(); poly(pts, !!o.closed, 0); G.strokeStyle = col || this.ink; G.lineWidth = Math.max(6.5, 6 * sw); G.lineJoin = 'miter'; G.stroke(); G.restore() },
    shape(pts, o = {}) {
      const S = o.curv ? throughClosed(pts, 5) : pts
      if (o.fill) { G.save(); pathOf(S, true); G.fillStyle = o.fill; G.globalAlpha *= Math.min(1, (o.op ?? .75) / .75); G.fill(); G.restore() }
      if (o.ink !== null) this.line(S, o.sw ?? 1, o.ink || '#000000', { closed: true })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    hl(x, y, w, h, col, k) { if (k <= 0) return; G.save(); G.fillStyle = col; G.globalAlpha *= .9; G.fillRect(x - 8, y - 2, (w + 16) * k, h + 10); G.restore() },
    shadow(x, y, rx, ry) { G.save(); G.fillStyle = '#000000'; G.globalAlpha *= .5; G.fillRect(x - rx, y - ry / 2, rx * 2, ry); G.restore() },
  }

  // ------------------------------------------------------ p5.brush drawing media
  // Six looks painted with p5.brush's own brushes (brushbake.js), each built
  // from one description of its medium:
  //   fill   how a shape is filled: massed gestures ('mass'), ruled strokes
  //          ('hatch', `cross` for a second pass) or a wash, and with what brush
  //   pen    the brush and weight every line is drawn with
  //   mark   how a highlighted phrase is marked (revealed left to right)
  //   cover  the pigment covers what is under it, as pastel does on toned
  //          paper, instead of glazing over it
  //   hostPen, hostTex   how the host is inked and what texture its fills take
  // Without WebGL each falls back to plain Canvas2D fills and ink.
  const paperGround = (key, col, draw) => function (g, w, h) {
    g.drawImage(cached(key, w, h, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); draw(c, w, h, w / W) }), 0, 0)
  }
  const fibres = (c, w, h, n, col, a, seed) => {
    const r = lcg(seed); c.lineWidth = 1
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, l = 4 + r() * 18, t = r() * TAU; c.strokeStyle = hexA(col, a * (.4 + r() * .6)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(t) * l, y + Math.sin(t) * l); c.stroke() }
  }
  const media = spec => ({
    // a node's sub-label is written in full ink: dim grey vanishes into hatching and spray
    dark: false, over() {}, subInk: spec.ink, ...spec,
    line(pts, sw, col, o = {}) {
      col = col || this.ink
      const curv = o.curv ?? .4, P = curv > 0 && pts.length > 2 ? (o.closed ? throughClosed(pts, 5) : through(pts, 6)) : pts
      let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
      if (PB.ok && L * SCALE > 12) return PB.line(P, { ink: col, brush: this.pen.brush, weight: sw * this.pen.weight, cover: this.cover }, !!o.closed)
      strokePath(pts, !!o.closed, sw * 1.2, col, this.pen.fallback || 'pen', curv)
    },
    shape(pts, o = {}) {
      const ink = o.ink === null ? null : (o.ink || this.ink), P = o.curv ? throughClosed(pts, 5) : pts, a = clamp((o.op ?? .75) / .75)
      // labels sit on fills in the style's ink, so a dense medium (wax, charcoal,
      // stipple) paints its colours part-way to the paper to keep them readable
      // every medium keeps its fills readable under its own ink: on paper a
      // fill is lifted until dark text reads on it, on a dark ground it is
      // sunk until light text does; a dense medium (tint) starts further along.
      // What is judged is the colour that lands, not the one asked for: the
      // medium paints darker than its colour (PB.landed measures by how much)
      // and multiplying onto toned paper darkens it again. So a fill is lifted
      // toward white, since lifting it toward the paper would count the
      // paper's tone twice; a medium that can never land light enough (heavy
      // charcoal) stops at the lightest it can. Ruled hatching and washes land
      // lighter on average than their colour, but a full-strength stroke still
      // crosses the letters, so a fill is judged by the darker of the two
      let fill = o.fill
      if (fill && !this.keepFill) {
        const paper = this.paper || P0().bg, mul = !this.dark && !this.cover, to = mul ? '#FFFFFF' : paper
        const seen = c => !mul ? lumOf(c) : Math.min(lumOf(mulCol(c, paper)), PB.ok ? PB.landed(this.fill, lumOf(c)) * lumOf(paper) : 1)
        const ok = c => this.dark ? seen(c) <= .6 : seen(c) >= .68
        let k = this.tint || 0; while (!ok(mixCol(fill, to, k)) && k < .85) k += .05
        fill = mixCol(fill, to, k)
      }
      if (PB.ok && !PB.tiny(pts)) {
        if (fill) PB.shape(P, { ...this.fill, fill, cover: this.cover }, a)
        if (ink) PB.line(P, { ink, brush: this.pen.brush, weight: (o.sw ?? 1) * this.pen.weight, cover: this.cover }, true)
        return
      }
      if (fill) { G.save(); if (!this.cover) G.globalCompositeOperation = 'multiply'; pathOf(P, true); G.fillStyle = hexA(fill, .8 * a); G.fill(); G.restore() }
      if (ink) this.line(pts, o.sw ?? 1, ink, { closed: true, curv: o.curv || 0 })
    },
    flat(pts, col, a = 1) { G.save(); pathOf(pts, true); G.fillStyle = hexA(col, a); G.fill(); G.restore() },
    hl(x, y, w, h, col, k) {
      if (k <= 0) return
      if (PB.ok) return PB.shape(rectPts(x - 10, y - 2, w + 20, h + 10), { ...this.mark, fill: col, cover: this.cover }, 1, k >= 1 ? null : [x - 60, y - 60, (w + 20) * k + 50, h + 120])
      G.save(); if (!this.cover) G.globalCompositeOperation = 'multiply'; G.fillStyle = hexA(col, .75); G.fillRect(x - 10, y - 2, (w + 20) * k, h + 10); G.restore()
    },
    shadow(x, y, rx, ry) {
      if (PB.ok) return PB.shape(ellPts(x, y, rx, ry, 14), { ...this.fill, fill: '#3A3530', cover: false }, .22)
      G.save(); G.fillStyle = 'rgba(0,0,0,.1)'; G.beginPath(); G.ellipse(x, y, rx, ry, 0, 0, TAU); G.fill(); G.restore()
    },
  })

  // crayon: waxy massed strokes on cream cartridge paper, a music box
  const crayon = media({
    name: 'crayon', tint: .5, ink: '#2B2530', dim: '#6E6670', paper: '#FBF6EA', music: 'musicbox', bpm: 100, trans: 'scribble',
    font: { head: { fam: FAM.gaegu, w: 700, k: 1.28 }, body: { fam: FAM.gaegu, w: 700, k: 1.16 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.gaegu, w: 700, k: 1.14 } },
    pals: {
      primary: { a: '#E63946', b: '#1D6FD8', hi: '#FFC300', light: '#FFD6A5', wash: '#CFE8FF' },
      garden: { a: '#2A9D55', b: '#F77F00', hi: '#FFD60A', light: '#C7F0D2', wash: '#FFE3C2' },
      berry: { a: '#9B5DE5', b: '#F15BB5', hi: '#FEE440', light: '#E5D4FF', wash: '#FFD6EC' },
    },
    ground: paperGround('cr-paper', '#FBF6EA', (c, w, h) => { speckle(c, w, h, w * h / 10, '#8A7A5A', .06, 41, .9); vignette(c, w, h, '#8A7A5A', .14) }),
    fill: { medium: 'mass', fillBrush: 'crayon', strength: .3, precision: .62 },
    pen: { brush: 'crayon', weight: 1.35, fallback: 'charcoal' },
    mark: { medium: 'mass', fillBrush: 'crayon', strength: .45, precision: .6 },
    hostPen: { brush: 'crayon', weight: 1.7 },
    hostTex: (tw, th) => { brush.mass('crayon', '#BDB6AC', { strength: .55, precision: .3 }); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noMass() },
  })

  // pastel: soft chalk pastel that covers toned paper, a harp
  const pastel = media({
    name: 'pastel', dark: true, cover: true, keepFill: true, ink: '#FFF4E0', dim: '#E4DACB', music: 'harp', bpm: 84, trans: 'erase',
    font: { head: { fam: FAM.amatic, w: 700, k: 1.42 }, body: { fam: FAM.patrick, k: 1.14 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.amatic, w: 700, k: 1.4 } },
    pals: {
      slate: { bg: '#56677A', a: '#FFB4A2', b: '#A8E6CF', hi: '#FFE66D', light: '#FFD8BE', wash: '#6C7F93' },
      umber: { bg: '#7A6A5A', a: '#FFD166', b: '#9AD1F5', hi: '#FF9AA2', light: '#F6E7CB', wash: '#8E7D6B' },
      moss: { bg: '#5E6B55', a: '#FFC6A5', b: '#D0B8FF', hi: '#FFF3A3', light: '#E8F0C8', wash: '#707E66' },
    },
    ground(g, w, h) {
      const bg = P().bg
      g.drawImage(cached('pa-' + bg, w, h, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); fibres(c, w, h, w * h / 180, '#FFFFFF', .06, 43); speckle(c, w, h, w * h / 14, '#000000', .06, 47, .8); vignette(c, w, h, '#000000', .3) }), 0, 0)
    },
    fill: { medium: 'mass', fillBrush: 'pastel', strength: .55, precision: .45 },
    pen: { brush: 'pastel', weight: 1.1, fallback: 'charcoal' },
    mark: { medium: 'mass', fillBrush: 'pastel', strength: .4, precision: .6 },
    hostPen: { brush: 'charcoal', weight: 1.5, ink: '#2A2622' },
    hostTex: (tw, th) => { brush.mass('pastel', '#B9B2A8', { strength: .6, precision: .3 }); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noMass() },
  })

  // ballpoint: a four-colour pen on a dot-grid sketchbook, cross-hatched
  const ballpoint = media({
    name: 'ballpoint', ink: '#1A3C8F', dim: '#5A6E9E', paper: '#FDFCF7', music: 'pizz', bpm: 112, trans: 'page',
    font: { head: { fam: FAM.nanum, k: 1.5 }, body: { fam: FAM.kalam, w: 400, k: 1.04 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.nanum, k: 1.45 } },
    pals: {
      bic: { a: '#D62828', b: '#1F4FBF', hi: '#2A9D55', light: '#3D6FD8', wash: '#2B2B2B' },
      sketch: { a: '#1F4FBF', b: '#D62828', hi: '#2A9D55', light: '#2B2B2B', wash: '#3D6FD8' },
    },
    ground: paperGround('bp-dots', '#FDFCF7', (c, w, h, s) => { c.fillStyle = 'rgba(80,90,120,.28)'; for (let y = 40; y < H; y += 40) for (let x = 40; x < W; x += 40) c.fillRect(x * s - 1, y * s - 1, 2, 2); vignette(c, w, h, '#7A7A70', .1) }),
    fill: { medium: 'hatch', fillBrush: 'pen', fillWeight: .9, dist: 11, angle: 45, cross: -45, rand: .18 },
    pen: { brush: 'pen', weight: 1.5, fallback: 'pen' },
    mark: { medium: 'hatch', fillBrush: 'pen', fillWeight: 1, dist: 5, angle: 75, rand: .3, continuous: true },
    hostPen: { brush: 'pen', weight: 2.2 },
    hostTex: (tw, th) => { brush.hatch(9, Math.PI / 4, { rand: .2 }); brush.hatchStyle('pen', '#9AA4BE', 1); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noHatch() },
  })

  // pencil: coloured pencils hatched over graphite, on cream drawing paper
  const pencil = media({
    name: 'pencil', ink: '#3A3836', dim: '#77716A', paper: '#F7F1E3', music: 'lofi', bpm: 86, trans: 'erase',
    font: { head: { fam: FAM.gochi, k: 1.24 }, body: { fam: FAM.gochi, k: 1.1 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.gochi, k: 1.12 } },
    pals: {
      meadow: { a: '#E76F51', b: '#2A9D8F', hi: '#E9C46A', light: '#F4A261', wash: '#A8DADC' },
      dusk: { a: '#B56576', b: '#6D597A', hi: '#EAAC8B', light: '#E56B6F', wash: '#9FB4C7' },
      sea: { a: '#118AB2', b: '#EF476F', hi: '#FFD166', light: '#06D6A0', wash: '#9AD1D4' },
    },
    ground: paperGround('pe-paper', '#F7F1E3', (c, w, h) => { fibres(c, w, h, w * h / 220, '#8A7A5A', .07, 53); speckle(c, w, h, w * h / 16, '#7A6A4A', .05, 59, .7); vignette(c, w, h, '#8A7A5A', .12) }),
    fill: { medium: 'hatch', fillBrush: 'cpencil', fillWeight: 1.25, dist: 3.6, angle: 35, rand: .35 },
    pen: { brush: '2B', weight: 1.35, fallback: 'HB' },
    mark: { medium: 'hatch', fillBrush: 'cpencil', fillWeight: 1.4, dist: 3, angle: 20, rand: .3 },
    hostPen: { brush: '2B', weight: 2.1 },
    hostTex: (tw, th) => { brush.hatch(4, .6, { rand: .35 }); brush.hatchStyle('cpencil', '#B8B1A6', 1.2); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noHatch() },
  })

  // marker: felt-tip streaks and a fine liner on bright white paper
  const marker = media({
    name: 'marker', ink: '#1B1B1E', dim: '#5B5E66', paper: '#FCFDFF', music: 'uke', bpm: 108, trans: 'blocks',
    font: { head: { fam: FAM.kalam, w: 700, k: 1.16 }, body: { fam: FAM.kalam, w: 700, k: 1.02 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.kalam, w: 700, k: 1.05 } },
    pals: {
      pop: { a: '#FF3D7F', b: '#00A6ED', hi: '#FFE600', light: '#7AE582', wash: '#FFB86B' },
      tropic: { a: '#FF6B35', b: '#00B4A6', hi: '#F7FF58', light: '#B28DFF', wash: '#8FD694' },
    },
    ground: paperGround('mk-paper', '#FCFDFF', (c, w, h) => { speckle(c, w, h, w * h / 30, '#5A6070', .035, 61, .7); vignette(c, w, h, '#5A6070', .08) }),
    fill: { medium: 'hatch', fillBrush: 'marker', fillWeight: 1.5, dist: 8, angle: 22, rand: .06 },
    pen: { brush: 'marker', weight: .5, fallback: 'marker' },
    mark: { medium: 'hatch', fillBrush: 'marker', fillWeight: 1.8, dist: 7, angle: 4, rand: .05 },
    hostPen: { brush: 'rotring', weight: 3.2 },
    hostTex: (tw, th) => { brush.hatch(10, .38, { rand: .06 }); brush.hatchStyle('marker', '#D5D8DE', 1.6); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noHatch() },
  })

  // charcoal: soft massed charcoal on grey paper, one colour of pastel, jazz
  const charcoal = media({
    name: 'charcoal', tint: .5, ink: '#1C1B1A', dim: '#5E5A55', paper: '#DCD7CD', music: 'jazz', bpm: 96, trans: 'brush',
    font: { head: { fam: FAM.rocksalt, k: .8 }, body: { fam: FAM.kalam, w: 700, k: 1.02 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.kalam, w: 700, k: 1.05 } },
    pals: {
      ember: { a: '#B8141F', b: '#4A4641', hi: '#D9A21B', light: '#9A958D', wash: '#B9B3A8' },
      cobalt: { a: '#1F4E9C', b: '#4A4641', hi: '#C9412B', light: '#9A958D', wash: '#B9B3A8' },
    },
    ground: paperGround('cc-paper', '#DCD7CD', (c, w, h) => { fibres(c, w, h, w * h / 160, '#5A5248', .08, 67); speckle(c, w, h, w * h / 12, '#3A342E', .06, 71, .8); vignette(c, w, h, '#3A342E', .3) }),
    fill: { medium: 'mass', fillBrush: 'charcoal', strength: .2, precision: .55 },
    pen: { brush: 'charcoal', weight: 1.4, fallback: 'charcoal' },
    mark: { medium: 'mass', fillBrush: 'pastel', strength: .5, precision: .6 },
    hostPen: { brush: 'charcoal', weight: 1.9 },
    hostTex: (tw, th) => { brush.mass('charcoal', '#C4BEB4', { strength: .5, precision: .3 }); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noMass() },
  })

  const sheet = (tw, th) => [[0, 0], [tw, 0], [tw, th], [0, th]]

  // sumi: grey ink washes and a soft round brush on rice paper, one red seal
  const sumi = media({
    name: 'sumi', ink: '#1E1B18', dim: '#6A635B', paper: '#F4EEE2', music: 'koto', bpm: 76, trans: 'brush',
    font: { head: { fam: FAM.kaushan, k: 1.12 }, body: { fam: FAM.kalam, w: 400, k: 1.04 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.kaushan, k: 1.08 } },
    pals: {
      ink: { a: '#B3261E', b: '#3C3A37', hi: '#C9A227', light: '#8E8A84', wash: '#B8B2A8' },
      indigo: { a: '#B3261E', b: '#2E4A7D', hi: '#C9A227', light: '#7F94B5', wash: '#AAB6C8' },
    },
    ground: paperGround('su-paper', '#F4EEE2', (c, w, h) => { fibres(c, w, h, w * h / 90, '#8A7A60', .07, 73); vignette(c, w, h, '#6A5A40', .14) }),
    fill: { alpha: 120, bleed: .14, tex: .7, border: .6 },
    pen: { brush: 'sumi', weight: 1, fallback: 'ink' },
    mark: { alpha: 150, bleed: .05, tex: .4, border: .4 },
    hostPen: { brush: 'sumi', weight: 1.35 },
    hostTex: (tw, th) => { brush.fill('#B5AFA6', 90); brush.fillBleed(.3, 'out'); brush.fillTexture(.9, .7, true); brush.polygon(sheet(tw, th)); brush.noFill() },
  })

  // engraving: tone made of ruled lines, closer where darker, like a banknote
  const engraving = media({
    name: 'engraving', tint: .2, ink: '#1A1A1A', dim: '#5C564C', paper: '#F3ECDD', music: 'baroque', bpm: 100, trans: 'slide',
    font: { head: { fam: FAM.fell, k: 1.14 }, body: { fam: FAM.fell, k: 1.06 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.fell, caps: true, k: 1.0 } },
    pals: {
      bank: { a: '#1F5E3A', b: '#6B2E2E', hi: '#B08D2E', light: '#3F6E8C', wash: '#7A6E5A' },
      chart: { a: '#2E5E8C', b: '#8C3B2E', hi: '#C29A3E', light: '#4F7A4A', wash: '#8C7A5A' },
    },
    ground: paperGround('en-paper', '#F3ECDD', (c, w, h, s) => {
      speckle(c, w, h, w * h / 30, '#6A5A40', .05, 79, .7); vignette(c, w, h, '#6A5A40', .18)
      c.strokeStyle = 'rgba(40,34,26,.5)'; c.lineWidth = 2 * s; c.strokeRect(30 * s, 30 * s, w - 60 * s, h - 60 * s); c.lineWidth = 1 * s; c.strokeRect(40 * s, 40 * s, w - 80 * s, h - 80 * s)
    }),
    fill: { medium: 'hatch', fillBrush: 'rotring', fillWeight: .55, dist: 7.5, angle: 35, rand: .04, gradient: .35 },
    pen: { brush: 'rotring', weight: 1.15, fallback: 'rotring' },
    mark: { medium: 'hatch', fillBrush: 'rotring', fillWeight: .8, dist: 2.6, angle: 0, rand: .02 },
    hostPen: { brush: 'rotring', weight: 2.2 },
    hostTex: (tw, th) => { brush.hatch(5, .6, { rand: .04, gradient: .4 }); brush.hatchStyle('rotring', '#A9A398', .8); brush.polygon(sheet(tw, th)); brush.noHatch() },
  })

  // stipple: tone made of dots, a fine pen and a typewriter
  const stipple = media({
    name: 'stipple', tint: .45, ink: '#2A2A2A', dim: '#6B6B6B', paper: '#FAF8F2', music: 'marimba', bpm: 112, trans: 'dots',
    font: { head: { fam: FAM.elite, k: 1.1 }, body: { fam: FAM.elite, k: 1.0 }, mono: { fam: FAM.elite, k: .95 }, label: { fam: FAM.elite, caps: true, k: .95 } },
    pals: {
      duotone: { a: '#E4572E', b: '#29335C', hi: '#F3A712', light: '#669BBC', wash: '#A8C686' },
      ink: { a: '#2A6F97', b: '#C1121F', hi: '#F4A261', light: '#61A5C2', wash: '#8D99AE' },
    },
    ground: paperGround('st-paper', '#FAF8F2', (c, w, h) => { speckle(c, w, h, w * h / 40, '#5A5A50', .05, 83, .7); vignette(c, w, h, '#5A5A50', .1) }),
    fill: { medium: 'mass', fillBrush: 'stipple', strength: .35, precision: .2 },
    pen: { brush: 'rotring', weight: .95, fallback: 'rotring' },
    mark: { medium: 'hatch', fillBrush: 'stipple', fillWeight: 1.1, dist: 3, angle: 0, rand: .4 },
    hostPen: { brush: 'rotring', weight: 2.1 },
    hostTex: (tw, th) => { brush.hatch(5, 0, { rand: .5 }); brush.hatchStyle('stipple', '#A5A29A', 1); brush.polygon(sheet(tw, th)); brush.noHatch() },
  })

  // calligraphy: a broad nib in iron-gall ink, watercolour tints, laid paper
  const calligraphy = media({
    name: 'calligraphy', ink: '#1B2A4A', dim: '#5E6A80', paper: '#FBF7EE', music: 'baroque', bpm: 96, trans: 'page',
    font: { head: { fam: FAM.dancing, w: 700, k: 1.22 }, body: { fam: FAM.kalam, w: 400, k: 1.04 }, mono: { fam: FAM.plex, w: 500 }, label: { fam: FAM.dancing, w: 700, k: 1.12 } },
    pals: {
      ink: { a: '#8B1E3F', b: '#1B4E6B', hi: '#C99A2E', light: '#6C8EAD', wash: '#B9A88A' },
      emerald: { a: '#1E6B52', b: '#6B2E5E', hi: '#C99A2E', light: '#7FA88E', wash: '#B9A88A' },
    },
    ground: paperGround('ca-paper', '#FBF7EE', (c, w, h, s) => {
      c.strokeStyle = 'rgba(120,100,70,.06)'; c.lineWidth = 1
      for (let x = 0; x < W; x += 28) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, h); c.stroke() }        // chain lines
      for (let y = 0; y < H; y += 4) { c.globalAlpha = .35; c.beginPath(); c.moveTo(0, y * s); c.lineTo(w, y * s); c.stroke() }   // laid lines
      c.globalAlpha = 1; vignette(c, w, h, '#7A6A50', .14)
    }),
    fill: { alpha: 110, bleed: .08, tex: .5, border: .45 },
    pen: { brush: 'nib', weight: 1, fallback: 'ink' },
    mark: { alpha: 140, bleed: .04, tex: .3, border: .3 },
    hostPen: { brush: 'nib', weight: 1.5 },
    hostTex: (tw, th) => { brush.fill('#C9C0B0', 80); brush.fillBleed(.25, 'out'); brush.fillTexture(.8, .6, true); brush.polygon(sheet(tw, th)); brush.noFill() },
  })

  // spray: aerosol on a concrete or brick wall, bright paint that covers
  const spray = media({
    name: 'spray', dark: true, cover: true, ink: '#F5F5F5', dim: '#BDBDBD', music: 'boombap', bpm: 90, trans: 'brush',
    font: { head: { fam: FAM.sedgwick, k: 1.28 }, body: { fam: FAM.kalam, w: 700, k: 1.02 }, mono: { fam: FAM.plex, w: 600 }, label: { fam: FAM.sedgwick, k: 1.2 } },
    pals: {
      concrete: { bg: '#3A3B3E', a: '#FF3D6E', b: '#2EC4F1', hi: '#FFE14D', light: '#8AF27A', wash: '#505257' },
      brick: { bg: '#5A2F2A', a: '#2EC4F1', b: '#FFE14D', hi: '#FF6FD8', light: '#B8F27A', wash: '#6E3C35' },
    },
    ground(g, w, h) {
      const bg = P().bg, brick = bg === '#5A2F2A'
      g.drawImage(cached('sp-' + bg, w, h, (c, w, h) => {
        const s = w / W; c.fillStyle = bg; c.fillRect(0, 0, w, h)
        speckle(c, w, h, w * h / 3, '#000000', .12, 89, 1.4); speckle(c, w, h, w * h / 6, '#FFFFFF', .05, 97, 1.2)
        if (brick) { c.strokeStyle = 'rgba(20,10,8,.45)'; c.lineWidth = 5 * s; for (let y = 0, r = 0; y < H; y += 70, r++) { c.beginPath(); c.moveTo(0, y * s); c.lineTo(w, y * s); c.stroke(); for (let x = (r % 2) * 110; x < W; x += 220) { c.beginPath(); c.moveTo(x * s, y * s); c.lineTo(x * s, (y + 70) * s); c.stroke() } } }
        vignette(c, w, h, '#000000', .45)
      }), 0, 0)
    },
    fill: { medium: 'mass', fillBrush: 'spray', strength: .75, precision: .5 },
    pen: { brush: 'spray', weight: 1.1, fallback: 'spray' },
    mark: { medium: 'mass', fillBrush: 'spray', strength: .6, precision: .6 },
    hostPen: { brush: 'marker', weight: 1.1, ink: '#101010' },
    hostTex: (tw, th) => { brush.mass('spray', '#C8C8C8', { strength: .5, precision: .3 }); brush.polygon(sheet(tw, th)); brush.noMass() },
  })

  // Three of the original looks, now drawn with p5.brush where it runs: chalk
  // is pastel on the board (covering), a blueprint's lines are rotring, and a
  // notebook's are pen, its fills and highlights felt-tip marker. Their
  // Canvas2D versions stay as the fallback.
  {
    const c2d = { line: chalkboard.line, shape: chalkboard.shape }
    chalkboard.line = function (pts, sw, col, o = {}) {
      col = col || this.ink
      const curv = o.curv ?? .5, P = curv > 0 && pts.length > 2 ? (o.closed ? throughClosed(pts, 5) : through(pts, 6)) : pts
      if (PB.ok && lenOf(P) * SCALE > 12) return PB.line(P, { ink: col, brush: 'pastel', weight: sw * 1.05, cover: true }, !!o.closed)
      c2d.line.call(this, pts, sw, col, o)
    }
    chalkboard.shape = function (pts, o = {}) {
      if (!PB.ok || PB.tiny(pts)) return c2d.shape.call(this, pts, o)
      const c = o.fill, S = o.curv ? throughClosed(pts, 5) : pts, bb = bbox(S), a = clamp((o.op ?? .75) / .75)
      if (c) PB.shape(S, bb.w * bb.h < 40000 ? { medium: 'mass', fillBrush: 'pastel', strength: .24, precision: .7, fill: c, cover: true }
        : { medium: 'hatch', fillBrush: 'pastel', fillWeight: .9, dist: 15, angle: 55, rand: .2, fill: c, cover: true }, a)
      if (o.ink !== null) this.line(pts, o.sw ?? 1, o.ink || (c ? mixCol(c, '#FFFFFF', .35) : this.ink), { closed: true, curv: o.curv || 0 })
    }
    const bpLine = blueprint.line
    blueprint.line = function (pts, sw, col, o = {}) {
      if (!PB.ok || lenOf(pts) * SCALE <= 12) return bpLine.call(this, pts, sw, col, o)
      col = col || this.ink
      PB.line(pts, { ink: col, brush: 'rotring', weight: sw * 1.3, cover: true }, !!o.closed)
      // construction lines: every edge still overshoots its corner a little
      if (o.closed && pts.length <= 5 && !o.curv) for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d
        strokePath([[a[0] - ux * 16, a[1] - uy * 16], [a[0], a[1]]], false, sw * .5, hexA(col, .6), 'rotring', 0)
        strokePath([[b[0], b[1]], [b[0] + ux * 16, b[1] + uy * 16]], false, sw * .5, hexA(col, .6), 'rotring', 0)
      }
    }
    const nbLine = notebook.line
    notebook.line = function (pts, sw, col, o = {}) {
      const curv = o.curv ?? .5, P = curv > 0 && pts.length > 2 ? (o.closed ? throughClosed(pts, 5) : through(pts, 6)) : pts
      if (PB.ok && lenOf(P) * SCALE > 12) return PB.line(P, { ink: col || this.ink, brush: 'pen', weight: sw * 1.6 }, !!o.closed)
      nbLine.call(this, pts, sw, col, o)
    }
    const nbShape = notebook.shape
    notebook.shape = function (pts, o = {}) {
      if (!PB.ok || PB.tiny(pts) || !o.fill) return nbShape.call(this, pts, o)
      const S = o.curv ? throughClosed(pts, 5) : pts
      PB.shape(S, { medium: 'hatch', fillBrush: 'marker', fillWeight: 1.5, dist: 8, angle: 12, rand: .05, fill: o.fill }, clamp((o.op ?? .75) / .75))
      if (o.ink !== null) this.line(pts, o.sw ?? 1, o.ink || this.ink, { closed: true, curv: o.curv || 0 })
    }
    notebook.hl = function (x, y, w, h, col, k) {
      if (k <= 0) return
      if (PB.ok) return PB.shape(rectPts(x - 8, y, w + 16, h + 10), { medium: 'hatch', fillBrush: 'marker', fillWeight: 1.8, dist: 7, angle: 3, rand: .04, fill: col }, 1, k >= 1 ? null : [x - 60, y - 60, (w + 16) * k + 50, h + 120])
      G.save(); G.globalCompositeOperation = 'multiply'; G.fillStyle = hexA(col, .8); G.fillRect(x - 8, y, (w + 16) * k, h + 10); G.restore()
    }
  }

  return { watercolour, chalkboard, blueprint, neon, notebook, riso, pixel, crayon, pastel, ballpoint, pencil, marker, charcoal, sumi, engraving, stipple, calligraphy, spray }
})()

// ---------- transitions: p 0..1 across the cut, covered at .5 ----------
const TRANS = {
  brush(p) {
    if (p <= 0 || p >= 1) return
    const c1 = STYLE.P.a, c2 = mixCol(STYLE.P.a, STYLE.ink, .25), n = 5, bh = (H + 420) / n + 40
    push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2)
    for (let i = 0; i < n; i++) {
      const y0 = -230 + i * (H + 420) / n, d = [0, .14, .06, .18, .1][i]
      const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)))
      const x0 = p < .5 ? -300 : lerp(-300, W + 400, q), x1 = p < .5 ? lerp(-300, W + 400, q) : W + 400
      if (x1 - x0 < 30) continue
      const pts = [], rag = k => 40 + 50 * hash(i * 31 + k) + jit(12)
      boilSeed('wipe' + i)
      for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14 + jit(5)])
      for (let k = 1; k < 9; k++) pts.push([x1 + rag(k) - 40, y0 + bh * k / 9])
      for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14 + jit(5)])
      if (p >= .5) for (let k = 8; k > 0; k--) pts.push([x0 - rag(k + 20) + 40, y0 + bh * k / 9])
      paint(pts, { wash: i % 2 ? c1 : c2, washOp: 255, fill: i % 2 ? c2 : c1, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null })
    }
    pop()
  },
  // a felt eraser dragged across the board in three passes
  erase(p) {
    if (p <= 0 || p >= 1) return
    const bg = STYLE.P.bg || STYLE.paper
    for (let i = 0; i < 3; i++) {
      const y0 = i * H / 3 - 20, q = p < .5 ? ease(clamp(p * 2 - i * .08)) : 1, x1 = q * (W + 200), r = p < .5 ? 0 : ease(clamp((p - .5) * 2 - i * .08)) * (W + 200)
      if (x1 - r < 10) continue
      G.save(); G.fillStyle = bg; G.fillRect(r - 100, y0, x1 - r, H / 3 + 40)
      G.globalAlpha = .035; G.fillStyle = '#FFFFFF'
      for (let k = 0; k < 5; k++) G.fillRect(r - 100, y0 + 30 + k * 70 + 10 * Math.sin(k), x1 - r, 22)
      G.restore()
    }
  },
  // the blueprint cut is a camera slide, done in frame(); nothing painted over it
  slide() {},
  // the sign cuts out, stutters and comes back
  flicker(p) {
    if (p <= 0 || p >= 1) return
    const on = [.3, .38, .46, .5, .56, .62].some(x => Math.abs(p - x) < .035)
    if (on || (p > .44 && p < .56)) { G.save(); G.fillStyle = STYLE.P.bg; G.fillRect(-10, -10, W + 20, H + 20); G.restore() }
    if (p > .25 && p < .75) {
      const r = seededRng(Math.floor(p * 40) + 7)
      for (let i = 0; i < 5; i++) { G.save(); G.fillStyle = hexA([STYLE.P.a, STYLE.P.b][i % 2], .35); G.fillRect(0, r() * H, W, 8 + r() * 30); G.restore() }
    }
  },
  // a fresh page slides up over the old one
  page(p) {
    if (p <= 0 || p >= 1) return
    const k = p < .5 ? easeOut(p * 2) : 1, y = H * (1 - k) + (p >= .5 ? -H * ease((p - .5) * 2) : 0)
    G.save(); G.shadowColor = 'rgba(0,0,0,.25)'; G.shadowBlur = 40 * SCALE; G.fillStyle = STYLE.paper || '#FFFFFF'; G.fillRect(-20, y, W + 40, H + 40)
    G.shadowBlur = 0; G.strokeStyle = 'rgba(120,160,215,.42)'; G.lineWidth = 1.6
    // a notebook's page is ruled; a sketchbook's is dotted
    if (STYLE.name === 'notebook') for (let yy = 160; yy < H; yy += 56) { if (y + yy > H) break; G.beginPath(); G.moveTo(0, y + yy); G.lineTo(W, y + yy); G.stroke() }
    else { G.fillStyle = 'rgba(80,90,120,.28)'; for (let yy = 40; yy < H; yy += 40) { if (y + yy > H) break; for (let x = 40; x < W; x += 40) G.fillRect(x - 1.5, y + yy - 1.5, 3, 3) } }
    G.restore()
  },
  // halftone dots swell until they touch, then shrink away
  dots(p) {
    if (p <= 0 || p >= 1) return
    const k = p < .5 ? easeIn(p * 2) : 1 - ease((p - .5) * 2), step = 48, r = k * step * .75
    if (r < .5) return
    G.save(); G.fillStyle = STYLE.ink; G.beginPath()
    for (let y = -step; y < H + step; y += step) for (let x = -step + ((y / step) % 2) * step / 2; x < W + step; x += step) { G.moveTo(x + r, y); G.arc(x, y, r, 0, TAU) }
    G.fill(); G.restore()
  },
  // a crayon scribbles the frame out in one zigzag, then lifts off the same way
  scribble(p) {
    if (p <= 0 || p >= 1) return
    const rows = 7, bh = H / rows, pts = []
    for (let i = 0; i <= rows; i++) { const y = i * bh + bh / 2 - 30; pts.push([i % 2 ? W + 90 : -90, y], [i % 2 ? -90 : W + 90, y + bh * .5]) }
    let Lt = 0; const seg_ = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg_.push(d); Lt += d }
    const a = (p < .5 ? 0 : ease((p - .5) * 2)) * Lt, b = (p < .5 ? easeOut(p * 2) : 1) * Lt
    if (b - a < 5) return
    const out = []; let run = 0
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = seg_[i - 1], s0 = clamp((a - run) / d), s1 = clamp((b - run) / d)
      if (s1 > s0) { if (!out.length) out.push([lerp(x0, x1, s0), lerp(y0, y1, s0)]); out.push([lerp(x0, x1, s1), lerp(y0, y1, s1)]) }
      run += d
    }
    G.save(); G.lineCap = 'round'; G.lineJoin = 'round'; G.strokeStyle = STYLE.P.a; G.lineWidth = bh * 1.5
    pathOf(out, false); G.stroke()
    // wax skips on the paper's tooth: the paper's own colour, speckled back in
    G.globalCompositeOperation = 'source-atop'; boilSeed('scribble'); G.fillStyle = hexA(STYLE.paper, .5)
    for (let i = 0; i < 900; i++) G.fillRect(random() * W, random() * H, 2 + random() * 5, 1.5)
    G.restore()
  },
  // flat ink blocks slide across on a diagonal
  blocks(p) {
    if (p <= 0 || p >= 1) return
    const cols = [STYLE.P.a, STYLE.P.b, STYLE.P.hi]
    for (let i = 0; i < 3; i++) {
      const d = i * .1, q = p < .5 ? ease(clamp((p * 2 - d) / (1 - d))) : 1, r = p < .5 ? 0 : ease(clamp(((p - .5) * 2 - d) / (1 - d)))
      const x0 = -600 + r * (W + 1400), x1 = -600 + q * (W + 1400)
      if (x1 - x0 < 5) continue
      G.save(); G.globalCompositeOperation = i ? 'multiply' : 'source-over'; G.fillStyle = cols[i]
      G.beginPath(); G.moveTo(x0, -20); G.lineTo(x1, -20); G.lineTo(x1 - 500, H + 20); G.lineTo(x0 - 500, H + 20); G.closePath(); G.fill(); G.restore()
    }
  },
  // an ordered dither fills the screen, then drains
  dither(p) {
    if (p <= 0 || p >= 1) return
    const k = p < .5 ? p * 2 : 2 - p * 2, B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], cell = W / 320
    G.save(); G.fillStyle = '#000000'
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) if (B[(y & 3) * 4 + (x & 3)] < k * 16.5) G.fillRect(x * cell, y * cell, cell + .5, cell + .5)
    G.restore()
  },
}
