// A 2D, three-level stand-in for Budget3D's token layouts. A 64 x 64 image of
// an object on an empty background is cut into 16 coarse blocks, each of which
// can open into 4 medium blocks, each of which can open into 4 fine tokens
// (256 fine tokens = the 100% budget). A token stores the mean of what it
// covers. A budget is spent by opening the blocks whose contents vary most
// first, the way Budget3D merges low-variance regions; the uniform baseline
// opens blocks in raster order regardless of content. Error is measured
// against the 100% result, as Budget3D's own eval script does.
import { mexp, mlog10, msin } from "@/lib/dmath"

const sq = (x: number) => x * x

export const IMG = 64
export const FINE = 16 // fine tokens per side, 4 x 4 px each
export const FULL = FINE * FINE

function makeImage(): number[] {
  const px = new Array<number>(IMG * IMG).fill(0)
  for (let y = 0; y < IMG; y++) {
    for (let x = 0; x < IMG; x++) {
      const u = (x - 30) / 14
      const v = (y - 34) / 18
      const body = u * u + v * v < 1
      // a seat back with a slatted pattern
      const back = x > 18 && x < 42 && y > 8 && y < 24
      let val = 0
      if (body) val = 0.55 + 0.3 * mexp(-(sq(u + 0.4) + sq(v + 0.4)) * 1.5) + 0.06 * msin(x * 0.45) * msin(y * 0.35)
      if (back) val = 0.35 + 0.3 * (msin(x * 1.3) > 0 ? 1 : 0)
      // two legs
      if ((x > 20 && x < 24 && y >= 50 && y < 62) || (x > 38 && x < 42 && y >= 50 && y < 62)) val = 0.3
      px[y * IMG + x] = val
    }
  }
  return px
}

export const IMAGE = makeImage()

// value of each fine token: the mean of its 4 x 4 pixels
export const FINE_VALS: number[] = (() => {
  const out: number[] = []
  for (let ty = 0; ty < FINE; ty++)
    for (let tx = 0; tx < FINE; tx++) {
      let s = 0
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s += IMAGE[(ty * 4 + y) * IMG + tx * 4 + x]
      out.push(s / 16)
    }
  return out
})()

export type Block = { x: number; y: number; size: number } // in fine-token units

function stats(b: Block) {
  let s = 0
  let s2 = 0
  for (let y = b.y; y < b.y + b.size; y++)
    for (let x = b.x; x < b.x + b.size; x++) {
      const v = FINE_VALS[y * FINE + x]
      s += v
      s2 += v * v
    }
  const n = b.size * b.size
  const mean = s / n
  return { mean, spread: Math.sqrt(Math.max(0, s2 / n - mean * mean)) }
}

const children = (b: Block): Block[] => {
  const h = b.size / 2
  return [
    { x: b.x, y: b.y, size: h },
    { x: b.x + h, y: b.y, size: h },
    { x: b.x, y: b.y + h, size: h },
    { x: b.x + h, y: b.y + h, size: h },
  ]
}

export function realizable(n: number) {
  // 16 + 3 * opens, so the count moves in steps of 3
  return 16 + 3 * Math.max(0, Math.min(80, Math.round((n - 16) / 3)))
}

export function layout(nTokens: number, salient: boolean): Block[] {
  let leaves: Block[] = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) leaves.push({ x: x * 4, y: y * 4, size: 4 })
  const opens = (realizable(nTokens) - 16) / 3
  for (let i = 0; i < opens; i++) {
    const cands = leaves.filter((b) => b.size > 1)
    if (!cands.length) break
    let pick = cands[0]
    if (salient) {
      let best = -1
      for (const b of cands) {
        // a coarse block is ranked before its children can be, as in a top-down split
        const sc = stats(b).spread * (b.size === 4 ? 1.0001 : 1)
        if (sc > best) {
          best = sc
          pick = b
        }
      }
    } else {
      // content-blind: open the largest blocks first, in raster order
      const maxSize = Math.max(...cands.map((b) => b.size))
      pick = cands.filter((b) => b.size === maxSize).sort((a, b) => a.y - b.y || a.x - b.x)[0]
    }
    leaves = leaves.filter((b) => b !== pick).concat(children(pick))
  }
  return leaves
}

export function evaluate(blocks: Block[]) {
  const recon = new Array<number>(FULL).fill(0)
  let empty = 0
  for (const b of blocks) {
    const { mean } = stats(b)
    if (mean === 0) empty++
    for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) recon[y * FINE + x] = mean
  }
  let se = 0
  for (let i = 0; i < FULL; i++) se += sq(recon[i] - FINE_VALS[i])
  const mse = se / FULL
  // PSNR against the 100% result, values in [0, 1]
  const psnr = mse < 1e-12 ? Infinity : -10 * mlog10(mse)
  return { recon, psnr, emptyShare: empty / blocks.length, tokens: blocks.length }
}
