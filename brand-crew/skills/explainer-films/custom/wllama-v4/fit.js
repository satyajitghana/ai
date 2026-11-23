// wllama-v4 / fit
//
// The article's PlacementPlanner as a moving picture: how wllama 4.0.0 places a model too big
// for one wasm instance. A strip of 32 layer cells (the planner's toy model) sits over four
// boxes: the main wasm instance, two rpc workers and WebGPU. Five beats:
//   0  the whole model tries to fit in the main instance and overflows its box
//   1  the measure asks for workers: two boxes appear beside it
//   2  WebGPU takes the last n_gpu_layers (here 8), arriving along arcs
//   3  the fit fills from the last device back: worker one, then worker zero, each to its cap
//   4  what is left stays in the main instance with the token embeddings
// Geometry only; every string comes from params (labels for the boxes, one heading per beat).
// A toy model, so the runtime stamps it Illustrative.
//
// params: { heads: [5 strings], boxes: [main, rpc0, rpc1, gpu], cap, embd }
BESPOKE.define((() => {
  const N = 32
  const GPU_N = 8
  const W1 = 13        // layers worker one takes (the cap)
  const W0 = 9         // worker zero takes the rest of what does not stay
  // owner per layer at the end: 0 main, 1 rpc0, 2 rpc1, 3 gpu
  const OWNER = []
  for (let i = 0; i < N; i++) {
    if (i >= N - GPU_N) OWNER.push(3)
    else if (i >= N - GPU_N - W1) OWNER.push(2)
    else if (i >= N - GPU_N - W1 - W0) OWNER.push(1)
    else OWNER.push(0)
  }
  // the beat at which each layer leaves the strip for its box
  const MOVE_AT = OWNER.map(o => (o === 3 ? 2 : o === 0 ? 4 : 3))

  return {
    stampAt: k => [1230, k.top + 24],
    plan: () => ({
      min: [4.4, 3.6, 4.4, 5.4, 4.6],
      events: [{ step: 0, at: 1.6, type: 'thunk' }, { step: 1, at: .3, type: 'pop' },
        { step: 2, at: .3, type: 'whoosh' }, { step: 3, at: .3, type: 'ticks', n: 22, span: 3.2 }, { step: 4, at: .5, type: 'ding' }],
      motion: 'all',
    }),
    draw(k) {
      const p = k.params, st = k.step
      const X0 = 150, X1 = 1350
      const cellW = (X1 - X0) / N, cellH = 54
      const SY = Math.max(k.top + 70, 230)
      // boxes: main, rpc0, rpc1, gpu
      const BY = SY + 210, BH = 300
      const BX = [150, 450, 750, 1050], BW = 270
      const showBox = k.thumb ? [1, 1, 1, 1] : [1, st >= 1 ? 1 : 0, st >= 1 ? 1 : 0, st >= 2 ? 1 : 0]
      const boxIn = i => (k.thumb ? 1 : i === 0 ? 1 : k.easeOut(k.p(i === 3 ? 2 : 1, .6, i * .12)))
      const tone = o => (o === 0 ? k.P.a : o === 3 ? k.P.hi : k.P.b)

      // heading for this beat
      const head = (p.heads || [])[st]
      if (head) k.text(head, X0, SY - 30, { role: 'head', size: 32, min: 14, maxW: X1 - X0, lines: 1, alpha: k.thumb ? 1 : k.easeOut(k.p(st, .5, .1)) })

      // the boxes
      for (let b = 0; b < 4; b++) {
        if (!showBox[b]) continue
        const a = boxIn(b)
        k.push(); k.alpha(a)
        const over = b === 0 && st === 0
        k.seed('box' + b)
        k.shape(k.rrect(BX[b], BY, BW, BH, 18), { fill: k.P.light, op: .3, sw: over ? 3 : 1.6, ink: over ? k.P.hi : k.ink })
        const lab = (p.boxes || [])[b]
        if (lab) k.text(lab, BX[b] + 16, BY + BH + 40, { role: 'mono', size: 24, min: 12, maxW: BW - 10, lines: 1, col: k.dim })
        // the cap line inside a wasm box (3 of its 4 GiB)
        if (b < 3 && p.cap && (st >= 3 || k.thumb)) {
          const cy = BY + BH * .25
          k.seed('cap' + b); k.line([[BX[b] + 10, cy], [BX[b] + BW - 10, cy]], 1.2, k.dim)
          if (b === 2) k.text(p.cap, BX[b] + 14, cy - 10, { role: 'mono', size: 18, min: 10, maxW: BW - 20, lines: 1, col: k.dim })
        }
        k.pop()
      }

      // where a layer sits inside its box: a grid of small cells, filled from the bottom
      const slot = (o, i) => {
        let idx = 0
        for (let j = 0; j < i; j++) if (OWNER[j] === o) idx++
        if (o === 1 || o === 2) { // workers fill from the top of the strip order backwards
          let cnt = 0
          for (let j = N - 1; j > i; j--) if (OWNER[j] === o) cnt++
          idx = cnt
        }
        return gridAt(o, idx)
      }
      function gridAt(o, idx) {
        const cols = 5, cw = (BW - 40) / cols, ch = 34
        const c = idx % cols, r = Math.floor(idx / cols)
        return [BX[o] + 20 + c * cw, BY + BH - 20 - (r + 1) * ch, cw - 6, ch - 6]
      }

      // step 0: the whole strip sinks into the main box and overflows it
      for (let i = 0; i < N; i++) {
        const o = OWNER[i]
        const sx = X0 + i * cellW, sy = SY
        let x = sx, y = sy, w = cellW - 4, h = cellH, col = k.P.a, alpha = .9
        const moved = k.thumb ? true : st >= MOVE_AT[i]
        if (moved) {
          const s = slot(o, i)
          const order = o === 2 ? N - 1 - i : o === 1 ? N - 1 - i : i
          const t = k.thumb ? 1 : st > MOVE_AT[i] ? 1 : k.ease(k.clamp((k.since(MOVE_AT[i]) - order * .045) / .9, 0, 1))
          const pos = k.arc([sx, sy], [s[0], s[1]], 120, t)
          x = pos[0]; y = pos[1]
          w = k.lerp(cellW - 4, s[2], t); h = k.lerp(cellH, s[3], t)
          col = tone(o)
        } else if (st === 0) {
          // tries to pour into the main box: cells drop, the last third spill over its edge
          const t = k.ease(k.p(0, 1.4, .2))
          const back = k.easeOut(k.clamp((k.since(0) - 2.4) / .8, 0, 1))
          const s = gridAt(0, Math.min(i, 29))
          const tx = i < 30 ? s[0] : BX[0] + BW + 10 + (i - 30) * 40
          const ty = i < 30 ? s[1] : BY + 40
          const down = t * (1 - back)
          x = k.lerp(sx, tx, down); y = k.lerp(sy, ty, down)
          if (i >= 30 && down > .6) col = k.P.hi
        }
        k.flat(k.rect(x, y, w, h), col, alpha)
      }

      // step 4: the token embeddings join the main instance
      if (st === 4 || k.thumb) {
        const a = k.thumb ? 1 : k.easeOut(k.p(4, .6, .6))
        k.push(); k.alpha(a)
        k.seed('embd'); k.shape(k.rect(BX[0] + 20, BY + 24, BW - 40, 46), { fill: k.P.hi, op: .5, sw: 1.2, ink: k.ink })
        if (p.embd) k.text(p.embd, BX[0] + 30, BY + 56, { role: 'mono', size: 20, min: 10, maxW: BW - 60, lines: 1 })
        k.pop()
      }

      k.point = st === 0 ? [BX[0] + BW, BY + 40] : st === 1 ? [BX[1] + BW, BY + BH / 2] : st === 2 ? [BX[3] + BW / 2, BY + BH / 2]
        : st === 3 ? [BX[2] + BW / 2, BY + BH / 2] : [BX[0] + BW / 2, BY + 50]
      k.mood = st === 0 ? 'surprised' : st === 4 ? 'proud' : 'thinking'
    },
  }
})())
