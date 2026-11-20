// The cluster LOD DAG, built in the browser (or in Node for the article's tests).
//
// Written for this article. It follows the recipe Karis, Stubbe and Wihlidal give for
// Nanite (SIGGRAPH 2021) and that meshoptimizer's clusterlod.h and apekshik/three-nanite's
// src/build.js implement: split into clusters, group neighbouring clusters, lock the
// vertices a group shares with other groups, simplify the group to half, split it into
// clusters again, repeat. The grouping below is my own (seeded greedy growth by shared
// vertices), simpler than METIS or three-nanite's heavy-edge matching.
//
// What each cluster keeps is the part that makes the run-time cut crack-free:
//   self   = the group that produced it  (its error, and that group's bounding sphere)
//   parent = the group that consumed it  (the next group's error and sphere)
// Siblings share both, so they always make the same decision.
//
// meshoptimizer is passed in, not imported, so this file has no side effects at import
// and the caller decides when the WASM loads.

import type { RawMesh } from "./mesh"

type Clusterizer = {
  buildMeshlets: (
    indices: Uint32Array,
    positions: Float32Array,
    stride: number,
    maxVertices: number,
    maxTriangles: number,
    coneWeight?: number,
  ) => { meshlets: Uint32Array; vertices: Uint32Array; triangles: Uint8Array; meshletCount: number }
}
type Simplifier = {
  simplify: (
    indices: Uint32Array,
    positions: Float32Array,
    stride: number,
    targetIndexCount: number,
    targetError: number,
    flags?: ("LockBorder" | "ErrorAbsolute" | "Permissive" | "Sparse" | "Prune")[],
  ) => [Uint32Array, number]
  simplifyWithAttributes: (
    indices: Uint32Array,
    positions: Float32Array,
    stride: number,
    attributes: Float32Array,
    attributeStride: number,
    weights: number[],
    lock: Uint8Array | null,
    targetIndexCount: number,
    targetError: number,
    flags?: ("LockBorder" | "ErrorAbsolute" | "Permissive" | "Sparse" | "Prune")[],
  ) => [Uint32Array, number]
}

export const CLUSTER_TRIS = 128
export const GROUP_SIZE = 8

export type Dag = {
  positions: Float32Array // the source vertices; every level indexes into these
  normals: Float32Array
  clusterCount: number
  groupCount: number
  levels: number
  // per cluster
  cIdxStart: Uint32Array // offset into cIndices (global vertex ids)
  cIdxCount: Uint32Array // indices (3 per triangle)
  cLevel: Uint8Array
  cSelf: Int32Array // producing group, -1 for source clusters
  cParent: Int32Array // consuming group, -1 for the coarsest clusters (never refined further)
  cSphere: Float32Array // the cluster's own bounds, for frustum culling only
  cIndices: Uint32Array
  // per group: x y z r of a sphere that contains every child group's sphere, and the error
  gSphere: Float32Array
  gError: Float32Array
  leafTris: number
  rootTris: number
  stats: { level: number; clusters: number; tris: number; groups: number; stuck: number }[]
}

type Cl = { idx: Uint32Array; sphere: number[]; self: number; gs: number[]; ge: number; level: number; fails: number }

function sphereOf(idx: Uint32Array, p: Float32Array): number[] {
  // centre of the bounding box, radius to the farthest vertex: loose but enclosing
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (let k = 0; k < idx.length; k++) {
    const v = idx[k] * 3
    if (p[v] < x0) x0 = p[v]
    if (p[v] > x1) x1 = p[v]
    if (p[v + 1] < y0) y0 = p[v + 1]
    if (p[v + 1] > y1) y1 = p[v + 1]
    if (p[v + 2] < z0) z0 = p[v + 2]
    if (p[v + 2] > z1) z1 = p[v + 2]
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2
  let r = 0
  for (let k = 0; k < idx.length; k++) {
    const v = idx[k] * 3
    const dx = p[v] - cx, dy = p[v + 1] - cy, dz = p[v + 2] - cz
    const d = dx * dx + dy * dy + dz * dz
    if (d > r) r = d
  }
  return [cx, cy, cz, Math.sqrt(r)]
}

function mergeSpheres(list: number[][]): number[] {
  let [x, y, z, r] = list[0]
  for (let i = 1; i < list.length; i++) {
    const [bx, by, bz, br] = list[i]
    const dx = bx - x, dy = by - y, dz = bz - z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (d + br <= r) continue
    if (d + r <= br) {
      x = bx; y = by; z = bz; r = br
      continue
    }
    const nr = (d + r + br) / 2, k = (nr - r) / d
    x += dx * k; y += dy * k; z += dz * k; r = nr
  }
  return [x, y, z, r * 1.0001]
}

export async function buildDag(
  mesh: RawMesh,
  MC: Clusterizer,
  MS: Simplifier,
  onProgress?: (msg: string, frac: number) => Promise<void> | void,
): Promise<Dag> {
  const P = mesh.positions
  const V = P.length / 3

  const clusterize = (idx: Uint32Array, lpos: Float32Array, toGlobal: Uint32Array | null): Uint32Array[] => {
    const mb = MC.buildMeshlets(idx, lpos, 3, 255, CLUSTER_TRIS, 0)
    const out: Uint32Array[] = []
    for (let i = 0; i < mb.meshletCount; i++) {
      const vo = mb.meshlets[i * 4], to = mb.meshlets[i * 4 + 1], tc = mb.meshlets[i * 4 + 3]
      const g = new Uint32Array(tc * 3)
      for (let k = 0; k < tc * 3; k++) {
        const lv = mb.vertices[vo + mb.triangles[to + k]]
        g[k] = toGlobal ? toGlobal[lv] : lv
      }
      out.push(g)
    }
    return out
  }

  // Group clusters that share vertices. Seeds are taken in a fixed order; each group grows by
  // the free neighbour sharing the most vertices with it until it holds GROUP_SIZE clusters.
  const owner = new Int32Array(V)
  const partition = (pool: Cl[]): number[][] => {
    const n = pool.length
    if (n <= GROUP_SIZE) return [pool.map((_, i) => i)]
    owner.fill(-1)
    const adj: Map<number, number>[] = Array.from({ length: n }, () => new Map())
    for (let c = 0; c < n; c++) {
      const idx = pool[c].idx
      for (let k = 0; k < idx.length; k++) {
        const v = idx[k], o = owner[v]
        if (o === c) continue
        if (o < 0) owner[v] = c
        else {
          adj[c].set(o, (adj[c].get(o) || 0) + 1)
          adj[o].set(c, (adj[o].get(c) || 0) + 1)
        }
      }
    }
    // seed order: along one axis, so groups march across the mesh instead of scattering
    const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => pool[a].sphere[1] - pool[b].sphere[1] || pool[a].sphere[0] - pool[b].sphere[0],
    )
    const gOf = new Int32Array(n).fill(-1)
    const groups: number[][] = []
    for (const seed of order) {
      if (gOf[seed] >= 0) continue
      const g = [seed]
      gOf[seed] = groups.length
      const score = new Map<number, number>()
      const take = (c: number) => {
        for (const [o, w] of adj[c]) if (gOf[o] < 0) score.set(o, (score.get(o) || 0) + w)
        score.delete(c)
      }
      take(seed)
      while (g.length < GROUP_SIZE && score.size) {
        let best = -1, bw = -1
        for (const [o, w] of score) if (w > bw) { bw = w; best = o }
        g.push(best)
        gOf[best] = groups.length
        take(best)
      }
      groups.push(g)
    }
    // fold groups of one or two clusters into the neighbouring group they touch most
    const out: number[][] = []
    const merged = new Int32Array(groups.length).fill(-1)
    groups.forEach((g, gi) => {
      if (g.length > 2) return
      let best = -1, bw = 0
      for (const c of g)
        for (const [o, w] of adj[c]) {
          const og = gOf[o]
          if (og !== gi && groups[og].length > 2 && w > bw) { bw = w; best = og }
        }
      if (best >= 0) {
        groups[best].push(...g)
        for (const c of g) gOf[c] = best
        merged[gi] = best
      }
    })
    groups.forEach((g, gi) => { if (merged[gi] < 0) out.push(g) })
    return out
  }

  // ---- level 0: the source mesh as clusters
  let pool: Cl[] = clusterize(mesh.indices, P, null).map((idx) => {
    const s = sphereOf(idx, P)
    return { idx, sphere: s, self: -1, gs: s, ge: 0, level: 0, fails: 0 }
  })
  const leafTris = mesh.indices.length / 3
  const stats: Dag["stats"] = [{ level: 0, clusters: pool.length, tris: leafTris, groups: 0, stuck: 0 }]
  const done: (Cl & { parent: number })[] = []
  const gSph: number[][] = [], gErr: number[] = []
  const seenBy = new Int32Array(V), locked = new Uint8Array(V), localId = new Int32Array(V).fill(-1)
  let level = 0

  while (pool.length > 1) {
    level++
    await onProgress?.(`level ${level}: grouping ${pool.length} clusters`, Math.min(0.95, level / 12))
    const parts = partition(pool)
    seenBy.fill(-1)
    locked.fill(0)
    parts.forEach((g, gi) => {
      for (const c of g) {
        const idx = pool[c].idx
        for (let k = 0; k < idx.length; k++) {
          const v = idx[k]
          if (seenBy[v] < 0) seenBy[v] = gi
          else if (seenBy[v] !== gi) locked[v] = 1
        }
      }
    })
    const next: Cl[] = []
    let progressed = 0, stuck = 0, trisOut = 0
    for (let pi = 0; pi < parts.length; pi++) {
      const members = parts[pi].map((c) => pool[c])
      let total = 0
      for (const m of members) total += m.idx.length
      const lidx = new Uint32Array(total), toGlobal: number[] = []
      let o = 0
      for (const m of members)
        for (let k = 0; k < m.idx.length; k++) {
          const v = m.idx[k]
          let l = localId[v]
          if (l < 0) { l = localId[v] = toGlobal.length; toGlobal.push(v) }
          lidx[o++] = l
        }
      const lv = toGlobal.length
      const lpos = new Float32Array(lv * 3), lnrm = new Float32Array(lv * 3), llock = new Uint8Array(lv)
      for (let l = 0; l < lv; l++) {
        const v = toGlobal[l]
        localId[v] = -1
        lpos[l * 3] = P[v * 3]; lpos[l * 3 + 1] = P[v * 3 + 1]; lpos[l * 3 + 2] = P[v * 3 + 2]
        lnrm[l * 3] = mesh.normals[v * 3]; lnrm[l * 3 + 1] = mesh.normals[v * 3 + 1]; lnrm[l * 3 + 2] = mesh.normals[v * 3 + 2]
        llock[l] = locked[v]
      }
      const gs = mergeSpheres(members.map((m) => m.gs))
      const target = Math.floor((total / 3) * 0.5) * 3
      // positions drive the error (in mesh units, ErrorAbsolute); normals get a small weight so
      // creases are not flattened first. The simplifier only collapses onto existing vertices,
      // so every level indexes the source vertex buffer.
      const [simp, err] = MS.simplifyWithAttributes(lidx, lpos, 3, lnrm, 3, [0.05, 0.05, 0.05], llock, target, gs[3] * 0.5, ["ErrorAbsolute"])
      if (simp.length === 0 || simp.length > total * 0.85) {
        // stuck: the locked border leaves nothing to collapse. Try again next level, with
        // different neighbours; after two failures the cluster stays a root.
        stuck++
        for (const m of members) {
          m.fails++
          if (m.fails >= 2 || parts.length === 1) done.push({ ...m, parent: -1 })
          else next.push(m)
        }
        continue
      }
      progressed++
      let ge = err
      for (const m of members) if (m.ge > ge) ge = m.ge // error never shrinks going up
      const gid = gErr.length
      gSph.push(gs)
      gErr.push(ge)
      for (const m of members) done.push({ ...m, parent: gid })
      for (const idx of clusterize(simp, lpos, Uint32Array.from(toGlobal))) {
        next.push({ idx, sphere: sphereOf(idx, P), self: gid, gs, ge, level, fails: 0 })
      }
      trisOut += simp.length / 3
      if ((pi & 31) === 31) await onProgress?.(`level ${level}: simplified ${pi + 1} of ${parts.length} groups`, Math.min(0.95, (level - 1 + pi / parts.length) / 12))
    }
    for (const m of next) if (m.level !== level) trisOut += m.idx.length / 3
    stats.push({ level, clusters: next.length, tris: trisOut, groups: parts.length, stuck })
    pool = next
    if (!progressed) break
  }
  for (const m of pool) done.push({ ...m, parent: -1 })

  // ---- pack
  const C = done.length
  let totalIdx = 0
  for (const c of done) totalIdx += c.idx.length
  const dag: Dag = {
    positions: P,
    normals: mesh.normals,
    clusterCount: C,
    groupCount: gErr.length,
    levels: level + 1,
    cIdxStart: new Uint32Array(C),
    cIdxCount: new Uint32Array(C),
    cLevel: new Uint8Array(C),
    cSelf: new Int32Array(C),
    cParent: new Int32Array(C),
    cSphere: new Float32Array(C * 4),
    cIndices: new Uint32Array(totalIdx),
    gSphere: new Float32Array(gSph.flat()),
    gError: Float32Array.from(gErr),
    leafTris,
    rootTris: 0,
    stats,
  }
  let off = 0
  done.forEach((c, i) => {
    dag.cIdxStart[i] = off
    dag.cIdxCount[i] = c.idx.length
    dag.cIndices.set(c.idx, off)
    off += c.idx.length
    dag.cLevel[i] = c.level
    dag.cSelf[i] = c.self
    dag.cParent[i] = c.parent
    dag.cSphere.set(c.sphere, i * 4)
    if (c.parent < 0) dag.rootTris += c.idx.length / 3
  })
  return dag
}

// ---- the run-time cut ------------------------------------------------------------------

// Projected error of group g, in pixels, seen from a camera at (cx, cy, cz) in mesh space.
// K = viewport height in pixels / (2 tan(fov / 2)). The nearest point of the group's sphere
// is the worst case. A camera inside the sphere sees infinite error: always refine.
export function groupPx(dag: Dag, g: number, cx: number, cy: number, cz: number, K: number): number {
  const o = g * 4
  const dx = dag.gSphere[o] - cx, dy = dag.gSphere[o + 1] - cy, dz = dag.gSphere[o + 2] - cz
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - dag.gSphere[o + 3]
  return d <= 1e-6 ? Infinity : (dag.gError[g] * K) / d
}

// Fill `refine` (one byte per group): 1 when the group is too coarse at threshold tau px.
export function refineGroups(dag: Dag, cx: number, cy: number, cz: number, K: number, tau: number, refine: Uint8Array) {
  for (let g = 0; g < dag.groupCount; g++) refine[g] = groupPx(dag, g, cx, cy, cz, K) > tau ? 1 : 0
}

// The rule: draw a cluster when the group that made it is fine enough and the group that
// consumed it is not. Source clusters have no producing group (error 0); the coarsest have
// no consumer (error infinite).
export function inCut(dag: Dag, c: number, refine: Uint8Array): boolean {
  const s = dag.cSelf[c], p = dag.cParent[c]
  return (s < 0 || refine[s] === 0) && (p < 0 || refine[p] === 1)
}
