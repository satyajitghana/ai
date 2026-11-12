// iris-z / onesequence
//
// How a picture and its depth map share one token sequence, from the SDK's
// rgbd.py as the article reads it. A picture and its depth map (red near, blue
// far) are cut into a coarse patch grid (4 by 4 here; 32 by 32 at 512 pixels).
// The patches lift into one strip: text tokens, then every image token, then
// every depth token. A thread joins each image token to its depth twin (same
// row and column); a time coordinate tags them 0 and 1; a 4-row modality
// table says who is who; and finally one grid can be noisy while the other is
// given clean. The grid is coarser than the real one, so the runtime stamps it
// Illustrative; every label is a storyboard string.
//
// steps: 0 picture and depth · 1 one strip · 2 same positions · 3 time axis · 4 modality table · 5 own noise level
// params: { picture, depth, strip, time: [2], table: [4], tableHead, noisy, clean, legend: [6] }
BESPOKE.define((() => {
  const G = 4, NT = 3
  // a toy room: depth per cell, 0 near .. 1 far; tones for the picture
  const depth = [[.95, .9, .9, .95], [.7, .6, .6, .7], [.45, .35, .4, .5], [.15, .1, .1, .2]]
  const pic = [[0, 0, 0, 0], [1, 2, 2, 1], [1, 2, 3, 1], [4, 4, 4, 4]]
  let s = 5 >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const nz = Array.from({ length: 2 * G * G }, () => rnd())

  return {
    stampAt: k => [1300, Math.max(k.top + 60, 270) + 470],
    plan: () => ({
      min: [3.4, 3.8, 3.6, 3.4, 4.4, 4],
      events: [{ step: 0, at: .2, type: 'pop' }, { step: 1, at: .2, type: 'ticks', n: 16, span: 1.6 }, { step: 2, at: .3, type: 'draw' }, { step: 3, at: .3, type: 'print' }, { step: 4, at: .3, type: 'slide' }, { step: 5, at: .3, type: 'scratch' }],
      motion: [{ step: 1, from: 0, to: 2.2 }, { step: 2, from: 0, to: 1.6 }, { step: 4, from: 0, to: 1.2 }, { step: 5, from: 0, to: 3 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const Y0 = Math.max(k.top + 60, 270), CS = 62, PX = 170, DX = 520, SY = Y0 + 400, CW = 30, SX = 170
      const picTone = [k.mix(k.P.b, k.paper, .45), k.mix(k.ink, k.paper, .55), k.mix(k.P.hi, k.paper, .3), k.P.a, k.mix(k.P.b, k.ink, .3)]
      const depTone = d => k.mix('#D9483B', '#3B6FD8', d)
      const fly = i < 1 ? 0 : k.thumb ? 1 : k.ease(k.p(1, 1.8, .2))
      // noise for step 5: the picture is being generated (noisy), the depth given clean
      const noisyK = i >= 5 ? (k.thumb ? .6 : .9 - .5 * k.p(5, 3, .4)) : 0
      const tokCol = (side, r, c) => { const base = side ? depTone(depth[r][c]) : picTone[pic[r][c]]; return side === 0 && noisyK > 0 ? k.mix(base, k.mix(k.paper, k.ink, nz[r * G + c]), noisyK) : base }
      // the two grids, and their patches flying into the strip
      ;[PX, DX].forEach((gx, side) => {
        const head = side ? p.depth : p.picture
        if (head) k.text(head, gx, Y0 - 22, { role: 'label', size: 24, min: 12, maxW: 300, lines: 1 })
        for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
          const j = r * G + c, a = k.thumb ? 1 : k.backOut(k.span(.1 + j * .03, .4 + j * .03)); if (a <= 0) continue
          const gxp = gx + c * CS, gyp = Y0 + r * CS
          k.flat(k.rect(gxp + 1, gyp + 1, CS - 2, CS - 2), tokCol(side, r, c), i >= 1 ? .35 : a)
          if (fly > 0) {
            const tx = SX + (NT + side * G * G + j) * CW, ty = SY
            const f = Math.max(0, Math.min(1, fly * 1.6 - j * .035))
            const x = gxp + (tx - gxp) * f, y = gyp + (ty - gyp) * f, w = CS + (CW - 4 - CS) * f, h = CS + (44 - CS) * f
            k.flat(k.rect(x + 1, y + 1, w - 2, h - 2), tokCol(side, r, c), 1)
          }
        }
      })
      // text tokens at the head of the strip
      if (fly > 0) for (let t = 0; t < NT; t++) k.flat(k.rect(SX + t * CW + 1, SY + 1, CW - 6, 42), k.dim, Math.min(1, fly * 2))
      if (fly > .8 && p.strip) k.text(p.strip, SX, SY - 18, { role: 'mono', size: 22, min: 12, maxW: 1100, lines: 1, col: k.dim })
      // step 2: threads join each image token to its depth twin
      if (i >= 2) {
        const tk = k.thumb ? 1 : k.p(2, 1.4, .2)
        for (let j = 0; j < G * G; j++) {
          const a = SX + (NT + j) * CW + CW / 2 - 2, b = SX + (NT + G * G + j) * CW + CW / 2 - 2
          const d = Math.max(0, Math.min(1, tk * 1.5 - j * .03)); if (d <= 0) continue
          const pts = []; for (let q = 0; q <= 14; q++) { const u = q / 14; pts.push([a + (b - a) * u, SY + 50 + Math.sin(u * Math.PI) * (60 + j * 2)]) }
          k.seed('thr' + j); k.line(k.partial(pts, d), .5, j === 5 ? k.P.hi : k.dim)
        }
      }
      // step 3: the time coordinate under each half
      if (i >= 3 && p.time) {
        const a = k.thumb ? 1 : k.p(3, .5, .2)
        k.text(p.time[0], SX + (NT + 6) * CW, SY + 170, { role: 'mono', size: 26, min: 12, maxW: 300, lines: 1, alpha: a, col: k.P.b })
        k.text(p.time[1], SX + (NT + G * G + 6) * CW, SY + 170, { role: 'mono', size: 26, min: 12, maxW: 300, lines: 1, alpha: a, col: k.P.a })
      }
      // step 4: the modality table, its rows lighting by token kind
      if (i >= 4 && p.table) {
        const TX = 900, TY = Y0, RH = 56, a = k.thumb ? 1 : k.easeOut(k.p(4, .6, .1))
        k.push(); k.alpha(a)
        if (p.tableHead) k.text(p.tableHead, TX, TY - 22, { role: 'label', size: 24, min: 12, maxW: 440, lines: 1 })
        p.table.forEach((row, r) => {
          const lit = i === 4 ? (r === Math.floor((k.thumb ? .99 : k.p(4, 3.2, .8)) * 3.99)) : (r === 0 || r === 3)
          k.seed('trow' + r); k.shape(k.rect(TX, TY + r * RH, 400, RH - 8), { fill: lit ? k.P.hi : k.tone('light'), op: lit ? .8 : .3, sw: .7 })
          k.text(row, TX + 18, TY + r * RH + RH / 2 + 4, { role: 'body', size: 26, min: 12, maxW: 370, lines: 1, col: lit ? k.textOn(k.P.hi) : k.ink })
        })
        k.pop()
      }
      // step 5: one grid noisy, one given clean
      if (i >= 5) {
        const a = k.thumb ? 1 : k.p(5, .5, .2)
        if (p.noisy) k.text(p.noisy, PX, Y0 + G * CS + 46, { role: 'label', size: 24, min: 12, maxW: 330, lines: 1, alpha: a, col: k.P.a })
        if (p.clean) k.text(p.clean, DX, Y0 + G * CS + 46, { role: 'label', size: 24, min: 12, maxW: 330, lines: 1, alpha: a })
      }
      if (p.legend && p.legend[i] && i < 4) k.text(p.legend[i], 900, Y0 + 30, { role: 'head', size: 32, min: 16, maxW: 440, lines: 3 })
      if (p.legend && p.legend[i] && i >= 4) k.text(p.legend[i], 900, Y0 + 260, { role: 'head', size: 30, min: 16, maxW: 440, lines: 3 })
      k.point = i === 0 ? [DX + G * CS, Y0 + 100] : i <= 3 ? [SX + (NT + G * G) * CW, SY + 60] : [1300, Y0 + 100]
      k.mood = i === 4 ? 'surprised' : i === 5 ? 'happy' : 'thinking'
    },
  }
})())
