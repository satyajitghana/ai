// minimax-h3-image / rowsquare
//
// The article's TokenBudget widget, as a picture: on the left a square canvas
// cut into patches, each patch one transformer row; on the right the
// attention matrix those rows make, drawn as a square whose side is
// proportional to the row count, so its area grows with the square of it.
// Step i shows the 1024, 2048 and 4096 pixel canvases. The patch grid drawn is
// coarser than the real one (8, 16, 32 cells a side for 32, 64, 128 real
// rows a side) so it stays legible; the runtime stamps the scene Illustrative.
// Every label drawn is a storyboard string.
//
// steps: 0 1024 square · 1 2048 square · 2 4096 square
// params: { canvas: [3 strings], attn: [3 strings], left, right }
BESPOKE.define((() => {
  const CELLS = [8, 16, 32]
  const ROWS = [1024, 4096, 16384] // geometry only: relative sizes of the attention square
  const CX = 170, CS = 470, AX = 760, AS = 560

  return {
    stampAt: [1250, 300],
    plan: () => ({
      min: [3.2, 3.6, 4],
      events: [{ step: 0, at: .3, type: 'draw' }, { step: 1, at: .3, type: 'grow' }, { step: 2, at: .3, type: 'grow' }],
      motion: [{ step: 1, from: 0, to: 1.6 }, { step: 2, from: 0, to: 1.8 }],
    }),
    draw(k) {
      const p = k.params, i = k.step
      const top = Math.max(k.top + 40, 330)
      const e = k.thumb ? 1 : k.ease(k.p(i, 1.1, .2))
      // the canvas and its patch grid
      k.seed('canvas'); k.shape(k.rect(CX, top, CS, CS), { fill: k.tone('light'), op: .55, sw: .9 })
      const n = CELLS[i], prevN = i > 0 ? CELLS[i - 1] : n
      const cells = Math.round(prevN + (n - prevN) * e)
      for (let j = 1; j < cells; j++) {
        const d = (CS * j) / cells
        k.seed('gv' + cells + ':' + j); k.line([[CX + d, top], [CX + d, top + CS]], .35, k.dim)
        k.seed('gh' + cells + ':' + j); k.line([[CX, top + d], [CX + CS, top + d]], .35, k.dim)
      }
      // one patch highlighted: one row
      const c = CS / cells
      k.seed('cell' + cells); k.shape(k.rect(CX, top, c, c), { fill: k.P.hi, op: .9, sw: .5 })
      if (p.left) k.text(p.left, CX, top - 26, { role: 'mono', size: 26, col: k.dim })
      if (p.canvas && p.canvas[i]) k.text(p.canvas[i], CX, top + CS + 64, { role: 'head', size: 36, min: 22, maxW: CS + 60 })
      // the attention square, side proportional to rows
      const prevS = i > 0 ? (AS * ROWS[i - 1]) / ROWS[2] : (AS * ROWS[0]) / ROWS[2]
      const s = Math.max(14, prevS + ((AS * ROWS[i]) / ROWS[2] - prevS) * e)
      const ay = top + CS - s
      k.seed('attnframe'); k.line(k.rect(AX, top + CS - AS, AS, AS).concat([[AX, top + CS - AS]]), .6, k.dim, { dash: [10, 8] })
      k.seed('attn' + i + ':' + Math.round(s)); k.shape(k.rect(AX, ay, s, s), { fill: k.P.a, op: .85, sw: .8 })
      if (p.right) k.text(p.right, AX, top - 26, { role: 'mono', size: 26, col: k.dim })
      if (p.attn && p.attn[i]) k.text(p.attn[i], AX, top + CS + 64, { role: 'head', size: 36, min: 22, maxW: AS })
      k.point = [AX + s * .6, ay + s * .4]
      k.mood = i === 2 ? 'surprised' : 'thinking'
    },
  }
})())
