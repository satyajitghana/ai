// A one-dimensional cluster hierarchy, small enough to draw whole: the model behind the
// CutStrip widget. A "surface" is a curve over x in [0, SPAN]; level 0 has 32 clusters of
// 4 segments each; every level up pairs neighbouring clusters (a group of two) and
// simplifies them to one cluster of 4 segments over twice the width, by keeping every
// other vertex. The shared end vertices of a group never move: the locked border.
//
// In one dimension a pair always makes one cluster, so this is a tree. Nanite's and the
// demo's groups are re-formed at every level, which is what makes theirs a DAG; the cut
// rule is the same either way.

import { msin } from "@/lib/dmath"

export const SPAN = 8
export const LEAVES = 32
export const SEGS = 4
export const LEVELS = 6 // 32, 16, 8, 4, 2, 1 clusters

export const surface = (x: number) =>
  0.42 * msin(x * 1.3) + 0.2 * msin(x * 3.7 + 1) + 0.09 * msin(x * 9.1 + 2) + 0.05 * msin(x * 19.3)

export type Cl = {
  level: number
  k: number // index within its level
  x0: number
  x1: number
  pts: [number, number][]
  err: number // max distance to the level-0 curve, forced >= children's
  cx: number // bounding circle, forced to hold the children's
  cy: number
  r: number
}

export function buildTree(): Cl[][] {
  const N = LEAVES * SEGS
  const fine: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * SPAN
    fine.push([x, surface(x)])
  }
  const levels: Cl[][] = []
  for (let L = 0; L < LEVELS; L++) {
    const n = LEAVES >> L
    const row: Cl[] = []
    for (let k = 0; k < n; k++) {
      const i0 = k * (N / n), i1 = (k + 1) * (N / n)
      const stride = (i1 - i0) / SEGS
      const pts: [number, number][] = []
      for (let s = 0; s <= SEGS; s++) pts.push(fine[i0 + s * stride])
      // error: worst vertical gap between this polyline and the fine curve over its span
      let err = 0
      for (let i = i0; i <= i1; i++) {
        const s = Math.min(SEGS - 1, Math.floor((i - i0) / stride))
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1]
        const t = (fine[i][0] - ax) / (bx - ax)
        const gap = Math.abs(ay + (by - ay) * t - fine[i][1])
        if (gap > err) err = gap
      }
      const x0 = fine[i0][0], x1 = fine[i1][0]
      let ylo = Infinity, yhi = -Infinity
      for (let i = i0; i <= i1; i++) { ylo = Math.min(ylo, fine[i][1]); yhi = Math.max(yhi, fine[i][1]) }
      const cx = (x0 + x1) / 2, cy = (ylo + yhi) / 2
      let r = Math.sqrt(((x1 - x0) / 2) ** 2 + ((yhi - ylo) / 2) ** 2)
      if (L > 0) {
        for (const c of [levels[L - 1][2 * k], levels[L - 1][2 * k + 1]]) {
          if (c.err > err) err = c.err
          const d = Math.sqrt((c.cx - cx) ** 2 + (c.cy - cy) ** 2) + c.r
          if (d > r) r = d
        }
      }
      row.push({ level: L, k, x0, x1, pts, err, cx, cy, r })
    }
    levels.push(row)
  }
  return levels
}

// projected error in pixels of a cluster's error, measured from the circle (cx, cy, r)
export const proj = (err: number, cx: number, cy: number, r: number, camX: number, camY: number, K: number) => {
  const d = Math.sqrt((cx - camX) ** 2 + (cy - camY) ** 2) - r
  return d <= 1e-6 ? Infinity : (err * K) / d
}

export type Cut = { drawn: boolean[][]; holes: [number, number][]; overlaps: [number, number][]; segs: number; clusters: number }

// shared = true: the parent test uses the parent's own circle, the same for both siblings
// (Nanite's rule). shared = false: each cluster measures its parent's error from its own
// circle, so two siblings at different distances can disagree.
export function selectCut(T: Cl[][], camX: number, camY: number, K: number, tau: number, shared: boolean): Cut {
  const drawn = T.map((row) => row.map(() => false))
  let segs = 0, clusters = 0
  for (let L = 0; L < LEVELS; L++)
    for (const c of T[L]) {
      const selfOk = L === 0 || proj(c.err, c.cx, c.cy, c.r, camX, camY, K) <= tau
      let parentCoarse = true
      if (L < LEVELS - 1) {
        const p = T[L + 1][c.k >> 1]
        parentCoarse = shared ? proj(p.err, p.cx, p.cy, p.r, camX, camY, K) > tau : proj(p.err, c.cx, c.cy, c.r, camX, camY, K) > tau
      }
      if (selfOk && parentCoarse) {
        drawn[L][c.k] = true
        segs += SEGS
        clusters++
      }
    }
  // coverage per leaf-width slot
  const cover = new Array(LEAVES).fill(0)
  for (let L = 0; L < LEVELS; L++)
    T[L].forEach((c, k) => {
      if (!drawn[L][k]) return
      for (let s = k << L; s < (k + 1) << L; s++) cover[s]++
    })
  const runs = (want: (n: number) => boolean) => {
    const out: [number, number][] = []
    let start = -1
    for (let s = 0; s <= LEAVES; s++) {
      const hit = s < LEAVES && want(cover[s])
      if (hit && start < 0) start = s
      if (!hit && start >= 0) { out.push([(start / LEAVES) * SPAN, (s / LEAVES) * SPAN]); start = -1 }
    }
    return out
  }
  return { drawn, holes: runs((n) => n === 0), overlaps: runs((n) => n > 1), segs, clusters }
}
