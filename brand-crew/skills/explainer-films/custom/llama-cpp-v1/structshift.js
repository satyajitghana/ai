// llama-cpp-v1 / structshift
//
// The article's ABI argument, drawn as a byte ruler: struct llama_context_params
// from byte 80 to the end, at v0.9.0 (top row) and v1.0.0 (bottom row), on a
// 64-bit Linux target. Offsets are the article's: yarn_orig_ctx at 80,
// defrag_thold 84-87, cb_eval at 88 at both tags (the deleted float becomes
// alignment padding), moe_cache_size 112-119, the new moe_cache_cpu_share
// 120-123 plus padding, and every field after it 8 bytes later.
// Geometry is computed here; every string drawn is the storyboard's.
//
// steps: 0 the v0.9.0 layout · 1 v1.0.0 drops defrag_thold, cb_eval stays put ·
//        2 the new float at 120 pushes the tail 8 bytes on ·
//        3 an old binary's fields land on the wrong ones
// params: { rowA, rowB, names: {key: label}, ticks: [str x4] (80, 88, 120, 128),
//           shift, pad, wrong }
BESPOKE.define((() => {
  // [key, start, size] for each row; byte offsets
  const A = [
    ['yoc', 80, 4], ['defrag', 84, 4], ['cb', 88, 8], ['cbud', 96, 8], ['kv', 104, 8], ['moe', 112, 8],
    ['abort', 120, 8], ['abud', 128, 8], ['bools', 136, 8], ['samp', 144, 16], ['other', 160, 8],
  ]
  const B = [
    ['yoc', 80, 4], ['pad1', 84, 4], ['cb', 88, 8], ['cbud', 96, 8], ['kv', 104, 8], ['moe', 112, 8],
    ['share', 120, 4], ['pad2', 124, 4],
    ['abort', 128, 8], ['abud', 136, 8], ['bools', 144, 8], ['samp', 152, 16], ['other', 168, 8],
  ]
  const X0 = 130, PX = 12.8, B0 = 80
  const x = b => X0 + (b - B0) * PX
  const TAIL = new Set(['abort', 'abud', 'bools', 'samp', 'other'])

  return {
    plan: () => ({
      min: [4.2, 4.4, 4.8, 4.6],
      events: [
        { step: 0, at: .2, type: 'ticks', n: 11, span: 1.6 },
        { step: 1, at: .4, type: 'scratch' },
        { step: 2, at: .3, type: 'slide' },
        { step: 3, at: .4, type: 'thunk' },
      ],
      motion: [{ step: 0, from: 0, to: 1.8 }, { step: 1, from: 0, to: 1.4 }, { step: 2, from: 0, to: 1.8 }, { step: 3, from: 0, to: 1.4 }],
    }),
    draw(k) {
      const p = k.params, i = k.step, nm = p.names
      const top = k.top + 10
      const H = 190
      const YA = top + 90, YB = top + 440
      const ink = k.ink, a = k.P.a, hi = k.P.hi, light = k.tone('light'), bcol = k.tone('b')

      const box = (key, b, n, y, fill, alpha, label) => {
        const X = x(b), W = n * PX
        k.push(); k.alpha(alpha)
        k.seed(key + y)
        if (fill === 'pad') {
          k.flat(k.rect(X + 2, y + 2, W - 4, H - 4), k.paper, 1)
          for (let s = 0; s < 6; s++) {
            const yy = y + 12 + s * 30
            k.seed(key + 'h' + s + y); k.line([[X + 4, yy + 18], [X + W - 4, yy]], .5, k.dim)
          }
          k.seed(key + 'o' + y); k.line(k.rect(X + 2, y + 2, W - 4, H - 4), .5, k.dim, { closed: true })
        } else {
          k.shape(k.rect(X + 2, y + 2, W - 4, H - 4), { fill, op: .9, sw: .7 })
        }
        if (label) {
          const col = fill === 'pad' ? k.dim : k.textOn(fill)
          if (W < 120) {
            k.push(); k.translate(X + W / 2, y + H / 2); k.rotate(-Math.PI / 2)
            k.text(label, 0, 9, { role: 'mono', size: 25, min: 12, maxW: H - 18, lines: 1, align: 'center', col })
            k.pop()
          } else {
            k.text(label, X + W / 2, y + H / 2 + 9, { role: 'mono', size: 26, min: 13, maxW: W - 12, lines: 2, align: 'center', col })
          }
        }
        k.pop()
      }

      const colour = key => key === 'share' ? hi : key === 'defrag' ? bcol : TAIL.has(key) ? a : light

      // row labels
      k.text(p.rowA, X0, YA - 22, { role: 'head', size: 34, min: 18, maxW: 300, lines: 1 })
      // top row: built left to right on step 0
      A.forEach(([key, b, n], j) => {
        const al = k.thumb || i > 0 ? 1 : k.clamp((k.p(0, 1.6) * A.length - j) * 1.5, 0, 1)
        if (al > 0) box(key, b, n, YA, colour(key), al, nm[key])
      })

      if (i >= 1 || k.thumb) {
        const al = k.thumb ? 1 : i === 1 ? k.ease(k.p(1, .8)) : 1
        k.push(); k.alpha(al)
        k.text(p.rowB, X0, YB - 22, { role: 'head', size: 34, min: 18, maxW: 300, lines: 1 })
        k.pop()
        // the slide: on step 1 the tail sits where v0.9.0 had it; step 2 moves it
        const slide = k.thumb || i >= 3 ? 1 : i === 2 ? k.ease(k.p(2, 1.4, .3)) : 0
        B.forEach(([key, b, n]) => {
          if (key === 'share' || key === 'pad2') {
            const g = k.thumb || i >= 3 ? 1 : i === 2 ? k.backOut(k.p(2, .8)) : 0
            if (g <= 0) return
            box(key, b, n, YB, key === 'pad2' ? 'pad' : colour(key), Math.min(1, g) * al, nm[key])
            return
          }
          let bb = b
          if (TAIL.has(key)) bb = b - 8 + 8 * slide
          if (key === 'pad1') {
            const g = k.thumb || i >= 2 ? 1 : k.ease(k.p(1, 1, .5))
            box('defrag', 84, 4, YB, colour('defrag'), al * (1 - g), nm.defrag)
            box(key, b, n, YB, 'pad', al * g, nm.pad1)
            return
          }
          box(key, bb, n, YB, colour(key), al, nm[key])
        })
      }

      // byte ticks under the rows
      const tickAt = [80, 88, 120, 128]
      const showTick = j => k.thumb || (j === 0 && true) || (j === 1 && i >= 1) || (j >= 2 && i >= 2)
      tickAt.forEach((b, j) => {
        if (!showTick(j)) return
        const X = x(b)
        const y1 = j === 3 ? YB + H + 10 : YA + H + 10
        k.seed('tick' + j); k.line([[X, YA - 6], [X, YB + H + 6]], .5, j === 1 ? hi : k.dim)
        k.text(p.ticks[j], X, j === 3 ? YB + H + 44 : YA + H + 44, { role: 'mono', size: 24, min: 13, maxW: 90, lines: 1, align: 'center', col: j === 1 ? hi : ink })
        void y1
      })

      // captions under the bottom row
      const capY = YB + H + 100
      if (i === 1 && !k.thumb) k.text(p.pad, (x(84) + x(96)) / 2 + 200, capY, { role: 'label', size: 28, min: 15, maxW: 760, lines: 2, align: 'center', col: ink })
      if (i === 2 || k.thumb) k.text(p.shift, (x(120) + x(176)) / 2 - 80, capY, { role: 'label', size: 28, min: 15, maxW: 760, lines: 2, align: 'center', col: ink })
      if (i === 3 && !k.thumb) {
        // old binary's abort callback (top, 120) lands on the new float (bottom, 120)
        const t = k.ease(k.p(3, 1, .2))
        const from = [x(124), YA + H + 4], to = [x(122), YB - 4]
        k.seed('wrong1'); k.arrow(k.partial([from, [x(124) + 30, (YA + YB + H) / 2], to], t), hi, 1.1, t)
        const from2 = [x(132), YA + H + 4], to2 = [x(132), YB - 4]
        const t2 = k.ease(k.p(3, 1, .7))
        k.seed('wrong2'); k.arrow(k.partial([from2, to2], t2), hi, 1.1, t2)
        k.text(p.wrong, (x(120) + x(176)) / 2 - 80, capY, { role: 'label', size: 28, min: 15, maxW: 760, lines: 2, align: 'center', col: ink })
      }

      k.point = i === 0 ? [x(100), YA + H / 2] : i === 1 ? [x(86), YB + H / 2] : i === 2 ? [x(124), YB + H / 2] : [x(128), (YA + YB + H) / 2]
      k.mood = i === 2 ? 'surprised' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
