// The creature toolkit, part 2: spec -> welded, skinned geometry and its skeleton.
//
// Every part is a tube: rings of a superellipse section swept along a centre line, welded ring to
// ring, capped, with normals taken from the finished grid (so they stay smooth through bends,
// tapers and the junction blend). A part that grows out of another is flared where it leaves the
// parent and its root is laid on the parent's surface with the parent's normal and skin weights:
// the junction is a fillet that shades and deforms as one skin, not two primitives intersecting.
//
// Skinning: up to four weights per vertex. Spine "frames" are bones the solver places on the path;
// a vertex between two frames blends them. A limb has a bone per segment, blended across each
// joint; a flap or an antenna has a short chain. Every bone's rest orientation is the model's own
// axes, so a bone's skinning transform is one quaternion and one translation (rig.ts).
//
// All of this runs once, in `create`. Nothing here is called per frame.

import * as THREE from "three/webgpu"

import { rng } from "../ease"
import { MAT, type Bulge, type Cap, type CardSpec, type CreatureSpec, type PartSpec, type Section, type Vec3 } from "./spec"

type V = [number, number, number]
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mad = (a: Vec3, b: Vec3, k: number): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: Vec3): V => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const lerp = (a: Vec3, b: Vec3, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mixn = (a: number, b: number, t: number) => a + (b - a) * t
const sstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** Skin weights of one ring or vertex: bone indices and weights (any number; trimmed to four at the end). */
type W = { i: number[]; w: number[] }
const mixW = (a: W, b: W, t: number): W => {
  const o: W = { i: [], w: [] }
  const put = (s: W, k: number) => {
    for (let n = 0; n < s.i.length; n++) {
      const x = s.w[n] * k
      if (x <= 1e-4) continue
      const at = o.i.indexOf(s.i[n])
      if (at >= 0) o.w[at] += x
      else {
        o.i.push(s.i[n])
        o.w.push(x)
      }
    }
  }
  put(a, 1 - t)
  put(b, t)
  return o
}

export type Ring = {
  c: V; t: V; u: V; s: V; w: number; up: number; dn: number; n: number; nb: number; bow: number; v: number; wt: W
  /** dorsal ridge and ventral keel: height, half-width */
  rg?: number; rgw?: number; kl?: number; klw?: number
  /** bulges live at this ring: triples of (centre angle, half-arc, height), radians and model units */
  b?: number[] | null
}

/** What the solvers and the anchoring code need to know about a built part. */
export type PartInfo = {
  name: string
  role: string
  row: number
  /** +1 right, -1 left (a mirrored copy), 0 on the midline. */
  side: number
  rings: Ring[]
  /** Bone indices of its chain (empty for a rigid part). */
  bones: number[]
  /** The bone it hangs from. */
  attach: number
  /** Rest positions of its bone heads, then its tip. */
  joints: V[]
  /** The part's own axes at its root: tangent, section up, section side (the chord of a flat part). */
  axes: [V, V, V]
  mat: number
  limits: [number, number] | null
  /** The part's spec name (without the "R" / "L" of a mirrored copy) and whether its last segment is a toe segment. */
  base?: string
  toes?: boolean
}

export type Skeleton = {
  n: number
  names: string[]
  parent: Int16Array
  /** Rest position of every bone's head, model space. */
  head: Float32Array
  /** How many of the first bones are spine frames, their positions 0..1 along the spine, and their rest x. */
  spine: number
  spineAt: Float32Array
}

export type Built = {
  hide: THREE.BufferGeometry
  cards: THREE.BufferGeometry | null
  skel: Skeleton
  parts: PartInfo[]
  part(name: string): PartInfo
  /** Rest-pose bounding sphere (model units). */
  centre: V
  radius: number
  tris: number
  verts: number
  /** An ellipsoid standing in for the trunk (centre, then radii; model units): what the shading's self-shadow tests against. */
  trunk: [number, number, number, number, number, number]
}

// ---------------------------------------------------------------- sections and curves

/** Shape-preserving cubic (no overshoot between stations) for sizes; exponents and bow are linear. */
export function sectAt(S: Section[], t: number): { w: number; up: number; dn: number; n: number; nb: number; bow: number; rg: number; rgw: number; kl: number; klw: number } {
  let i = 0
  while (i < S.length - 2 && t > S[i + 1].at) i++
  const a = S[i]
  const b = S[Math.min(i + 1, S.length - 1)]
  const h = b.at - a.at || 1
  const f = Math.min(1, Math.max(0, (t - a.at) / h))
  const pch = (get: (s: Section) => number) => {
    const y0 = get(a)
    const y1 = get(b)
    const d = (y1 - y0) / h
    const slope = (j: number) => {
      if (j <= 0 || j >= S.length - 1) return 0
      const dl = (get(S[j]) - get(S[j - 1])) / (S[j].at - S[j - 1].at || 1)
      const dr = (get(S[j + 1]) - get(S[j])) / (S[j + 1].at - S[j].at || 1)
      return dl * dr <= 0 ? 0 : (2 * dl * dr) / (dl + dr)
    }
    let m0 = i === 0 ? d : slope(i)
    let m1 = i + 1 >= S.length - 1 ? d : slope(i + 1)
    if (d === 0) m0 = m1 = 0
    const f2 = f * f
    const f3 = f2 * f
    return (2 * f3 - 3 * f2 + 1) * y0 + (f3 - 2 * f2 + f) * h * m0 + (-2 * f3 + 3 * f2) * y1 + (f3 - f2) * h * m1
  }
  const up = pch((s) => s.up)
  return {
    w: Math.max(1e-5, pch((s) => s.w)), up: Math.max(1e-5, up), dn: Math.max(1e-5, pch((s) => s.dn ?? s.up)), n: mixn(a.n ?? 2, b.n ?? 2, f), nb: mixn(a.nb ?? a.n ?? 2, b.nb ?? b.n ?? 2, f), bow: mixn(a.bow ?? 0, b.bow ?? 0, f),
    rg: mixn(a.ridge?.[0] ?? 0, b.ridge?.[0] ?? 0, f), rgw: mixn(a.ridge?.[1] ?? b.ridge?.[1] ?? 1, b.ridge?.[1] ?? a.ridge?.[1] ?? 1, f),
    kl: mixn(a.keel?.[0] ?? 0, b.keel?.[0] ?? 0, f), klw: mixn(a.keel?.[1] ?? b.keel?.[1] ?? 1, b.keel?.[1] ?? a.keel?.[1] ?? 1, f),
  }
}

/** A dense polyline through `pts` (Catmull-Rom when smooth) with its arc-length table. */
export function curve(pts: V[], smooth: boolean) {
  const P: V[] = []
  if (!smooth || pts.length < 3) {
    for (const p of pts) P.push([p[0], p[1], p[2]])
  } else {
    const g = (i: number) => pts[Math.min(pts.length - 1, Math.max(0, i))]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2)
      for (let k = 0; k < 12; k++) {
        const t = k / 12, t2 = t * t, t3 = t2 * t
        const q: V = [0, 0, 0]
        for (let c = 0; c < 3; c++) q[c] = 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)
        P.push(q)
      }
    }
    P.push([...pts[pts.length - 1]] as V)
  }
  const L = [0]
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + len(sub(P[i], P[i - 1])))
  const total = L[L.length - 1] || 1e-6
  const at = (f: number): V => {
    const d = Math.min(1, Math.max(0, f)) * total
    let i = 1
    while (i < L.length - 1 && L[i] < d) i++
    const h = L[i] - L[i - 1] || 1
    return lerp(P[i - 1], P[i], (d - L[i - 1]) / h)
  }
  /** arc-length fraction of each input point (polyline form only) */
  const knots = smooth && pts.length >= 3 ? pts.map((_, i) => L[Math.min(i * 12, L.length - 1)] / total) : L.map((l) => l / total)
  return { at, total, knots }
}

function sectPoint(r: Ring, phi: number, k = 1): V {
  const c = Math.cos(phi), sn = Math.sin(phi)
  const h = c >= 0 ? r.up : r.dn
  const e = c >= 0 ? r.n : r.nb
  const m = Math.pow(Math.pow(Math.abs(c), e) + Math.pow(Math.abs(sn), e), -1 / e)
  const zz = m * sn
  let y = m * c * h - r.bow * r.w * zz * zz
  let z = zz * r.w
  if (r.rg && c > 0) y += r.rg * Math.exp(-(z * z) / ((r.rgw ?? 1) * (r.rgw ?? 1)))
  if (r.kl && c < 0) y -= r.kl * Math.exp(-(z * z) / ((r.klw ?? 1) * (r.klw ?? 1)))
  if (r.b) {
    // swellings push the surface out along the section's own radius
    let add = 0
    for (let i = 0; i < r.b.length; i += 3) {
      let d = phi - r.b[i]
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
      d /= r.b[i + 1]
      if (d > -1 && d < 1) add += r.b[i + 2] * (1 - d * d) * (1 - d * d)
    }
    if (add !== 0) {
      const rad = Math.hypot(y, z) || 1
      const g = Math.max(-0.9, add / rad)
      y += y * g
      z += z * g
    }
  }
  y *= k
  z *= k
  return [r.c[0] + r.u[0] * y + r.s[0] * z, r.c[1] + r.u[1] * y + r.s[1] * z, r.c[2] + r.u[2] * y + r.s[2] * z]
}

const ringAt = (R: Ring[], v: number): [number, number] => {
  let i = 0
  while (i < R.length - 2 && v > R[i + 1].v) i++
  const h = R[i + 1].v - R[i].v || 1
  return [i, Math.min(1, Math.max(0, (v - R[i].v) / h))]
}

/** A point on a part's surface: `v` along it, `phi` radians round it from its dorsal line. */
export function surf(R: Ring[], v: number, phi: number): V {
  const [i, f] = ringAt(R, v)
  return lerp(sectPoint(R[i], phi), sectPoint(R[i + 1], phi), f)
}
export function surfNormal(R: Ring[], v: number, phi: number): V {
  const dv = 0.004, dp = 0.02
  const a = sub(surf(R, Math.min(1, v + dv), phi), surf(R, Math.max(0, v - dv), phi))
  const b = sub(surf(R, v, phi + dp), surf(R, v, phi - dp))
  return norm(cross(b, a))
}
const weightsAt = (R: Ring[], v: number): W => {
  const [i, f] = ringAt(R, v)
  return mixW(R[i].wt, R[i + 1].wt, f)
}

/** The nearest surface point of a part to `p`: where, its normal, the signed height of `p` above it, and v. */
function project(R: Ring[], p: Vec3) {
  let best = 1e30, bi = 0, bf = 0
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i].c, d = sub(R[i + 1].c, a)
    const f = Math.min(1, Math.max(0, dot(sub(p, a), d) / (dot(d, d) || 1e-9)))
    const q = sub(p, mad(a, d, f))
    const dd = dot(q, q)
    if (dd < best) {
      best = dd
      bi = i
      bf = f
    }
  }
  const A = R[bi], B = R[bi + 1]
  const c = lerp(A.c, B.c, bf), u = norm(lerp(A.u, B.u, bf)), s = norm(lerp(A.s, B.s, bf))
  const w = mixn(A.w, B.w, bf), bow = mixn(A.bow, B.bow, bf)
  const rel = sub(p, c)
  const z = dot(rel, s)
  const y = dot(rel, u) + bow * w * Math.min(1, (z / w) * (z / w))
  const h = y >= 0 ? mixn(A.up, B.up, bf) : mixn(A.dn, B.dn, bf)
  const phi = Math.atan2(z / w, y / h)
  const v = mixn(A.v, B.v, bf)
  const q = surf(R, v, phi)
  const n = surfNormal(R, v, phi)
  let d = dot(sub(p, q), n)
  // past either end the part is not an endless extrusion: it stops at its cap (taken as a dome of the end section)
  const end = bi === 0 && bf <= 0 ? -1 : bi === R.length - 2 && bf >= 1 ? 1 : 0
  if (end) {
    const E = end < 0 ? R[0] : R[R.length - 1]
    const axial = dot(sub(p, E.c), E.t) * end
    if (axial > 0) {
      const rr = (z / w) * (z / w) + (y / (h || 1e-9)) * (y / (h || 1e-9))
      d = Math.max(d, axial - Math.min(E.w, (E.up + E.dn) / 2) * Math.sqrt(Math.max(0, 1 - rr)))
    }
  }
  return { q, n, d, v, phi }
}

// ---------------------------------------------------------------- the mesh being built

class MeshData {
  pos: number[] = []
  nrm: number[] = []
  body: number[] = []
  aux: number[] = []
  tan: number[] = []
  si: number[] = []
  sw: number[] = []
  idx: number[] = []
  get count() {
    return this.pos.length / 3
  }
  vert(p: Vec3, n: Vec3, body: [number, number, number, number], aux: [number, number, number, number], wt: W, tan: Vec3 = [1, 0, 0]) {
    this.pos.push(p[0], p[1], p[2])
    this.tan.push(tan[0], tan[1], tan[2])
    this.nrm.push(n[0], n[1], n[2])
    this.body.push(...body)
    this.aux.push(...aux)
    // keep the four largest weights, renormalised
    const order = wt.i.map((_, k) => k).sort((a, b) => wt.w[b] - wt.w[a]).slice(0, 4)
    let sum = 0
    for (const k of order) sum += wt.w[k]
    for (let k = 0; k < 4; k++) {
      const o = order[k]
      this.si.push(o === undefined ? 0 : wt.i[o])
      this.sw.push(o === undefined ? 0 : wt.w[o] / (sum || 1))
    }
  }
  geometry() {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(this.nrm), 3))
    g.setAttribute("aBody", new THREE.BufferAttribute(new Float32Array(this.body), 4))
    g.setAttribute("aAux", new THREE.BufferAttribute(new Float32Array(this.aux), 4))
    g.setAttribute("aTan", new THREE.BufferAttribute(new Float32Array(this.tan), 3))
    g.setAttribute("aSkinI", new THREE.BufferAttribute(new Float32Array(this.si), 4))
    g.setAttribute("aSkinW", new THREE.BufferAttribute(new Float32Array(this.sw), 4))
    g.setIndex(this.count > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : new THREE.BufferAttribute(new Uint16Array(this.idx), 1))
    g.instanceCount = 1
    return g
  }
}

type TubeOpts = {
  pts: V[]
  smooth: boolean
  up: Vec3
  sect: Section[]
  rings: number
  sides: number
  caps: [Cap, Cap]
  mat: number
  thin: number
  row: number
  rand: number
  weights: (v: number) => W
  parent?: Ring[]
  fillet: number
  flare: number
  eps: number
  segments?: { from: number; to: number; count: number; depth: number }
  breath?: [number, number, number]
  /** resolved for this copy: angles in radians, already mirrored */
  bulges?: { at: number; len: number; phi: number; arc: number; h: number }[]
}

const resolveBulges = (B: Bulge[] | undefined, mir: boolean) => {
  if (!B || !B.length) return undefined
  const out: { at: number; len: number; phi: number; arc: number; h: number }[] = []
  for (const b of B) {
    const phi = (b.around * Math.PI) / 180 * (mir ? -1 : 1)
    const arc = Math.max(1e-3, (b.arc * Math.PI) / 180)
    out.push({ at: b.at, len: Math.max(1e-4, b.len), phi, arc, h: b.h })
    const mid = Math.abs(((b.around % 360) + 360) % 360) < 1e-6 || Math.abs((((b.around % 360) + 360) % 360) - 180) < 1e-6
    if ((b.mirror ?? true) && !mid) out.push({ at: b.at, len: Math.max(1e-4, b.len), phi: -phi, arc, h: b.h })
  }
  return out
}

/** Sweep one tube into `M`. Returns its rings (without caps) for anchoring children. */
function tube(M: MeshData, o: TubeOpts): Ring[] {
  const cv = curve(o.pts, o.smooth)
  // ring positions: even along a smooth curve; for a jointed limb, a ring on every joint and the rest shared out by length
  const vs: number[] = []
  if (o.smooth) for (let i = 0; i < o.rings; i++) vs.push(i / (o.rings - 1))
  else
    for (let k = 0; k < cv.knots.length - 1; k++) {
      const a = cv.knots[k], b = cv.knots[k + 1]
      const m = Math.max(2, Math.round(o.rings * (b - a)))
      for (let i = k === 0 ? 0 : 1; i <= m; i++) vs.push(a + ((b - a) * i) / m)
    }
  const R: Ring[] = []
  let u: V = [o.up[0], o.up[1], o.up[2]]
  for (const v of vs) {
    const h = 0.5 / Math.max(8, vs.length)
    const t = norm(sub(cv.at(v + h), cv.at(v - h)))
    u = norm(mad(u, t, -dot(u, t)))
    const s = cross(t, u)
    const q = sectAt(o.sect, v)
    let k = 1
    if (o.segments && v > o.segments.from && v < o.segments.to) {
      const x = ((v - o.segments.from) / (o.segments.to - o.segments.from)) * o.segments.count
      const f = x - Math.floor(x)
      // each tergite swells toward its rear edge and drops into a groove where the next begins
      k = 1 + o.segments.depth * (0.5 * f - Math.pow(1 - Math.min(1, Math.min(f, 1 - f) * 5), 2))
    }
    let bl: number[] | null = null
    if (o.bulges)
      for (const g of o.bulges) {
        const x = (v - g.at) / g.len
        if (x <= -1 || x >= 1) continue
        ;(bl ??= []).push(g.phi, g.arc, g.h * (1 - x * x) * (1 - x * x))
      }
    R.push({ c: cv.at(v), t, u: [...u] as V, s, w: q.w * k, up: q.up * k, dn: q.dn * k, n: q.n, nb: q.nb, bow: q.bow, v, wt: o.weights(v), rg: q.rg * k, rgw: q.rgw, kl: q.kl * k, klw: q.klw, b: bl })
  }
  // rows = start cap + rings + end cap; a cap ring is its end ring shrunk and pushed along the tangent
  type Row = { r: Ring; k: number; pole: number }
  const rows: Row[] = []
  const capRows = (end: Ring, kind: Cap, dir: number): Row[] => {
    if (kind === "none") return []
    const out: Row[] = []
    const depth = kind === "round" ? Math.min(end.w, (end.up + end.dn) / 2) : 0
    const steps = kind === "round" ? 3 : 1
    for (let i = 1; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 0.5
      const k = i === steps ? 0.02 : Math.cos(a)
      out.push({ r: { ...end, c: mad(end.c, end.t, dir * depth * Math.sin(a)) }, k, pole: i === steps ? dir : 0 })
    }
    return out
  }
  for (const c of capRows(R[0], o.caps[0], -1).reverse()) rows.push(c)
  for (const r of R) rows.push({ r, k: 1, pole: 0 })
  for (const c of capRows(R[R.length - 1], o.caps[1], 1)) rows.push(c)

  const S = o.sides
  let P: V[][] = rows.map((row) => {
    const line: V[] = []
    for (let j = 0; j <= S; j++) line.push(sectPoint(row.r, ((j % S) / S) * Math.PI * 2, row.k))
    return line
  })
  // the junction: flare the root toward the parent's surface, lay what is under it on the surface
  let blend: number[][] = P.map((l) => l.map(() => 0))
  let pn: (V | null)[][] = P.map((l) => l.map(() => null))
  let pw: (W | null)[][] = P.map((l) => l.map(() => null))
  let first = 0
  if (o.parent) {
    const F = Math.max(o.fillet, 1e-6)
    let outside = -1
    for (let i = 0; i < P.length; i++) {
      let all = true
      for (let j = 0; j < S; j++) {
        let pr = project(o.parent, P[i][j])
        if (pr.d > 0 && outside < 0) outside = i
        // the root rim never shows: where the first ring stands proud of the parent it is laid on the parent's skin
        if (i === 0 && o.fillet > 0 && pr.d > 0 && rows[i].pole === 0) {
          P[i][j] = mad(pr.q, pr.n, o.eps)
          blend[i][j] = 1
          pn[i][j] = pr.n
          pw[i][j] = weightsAt(o.parent, pr.v)
          all = false
          continue
        }
        if (pr.d >= F) continue
        all = false
        if (o.fillet > 0) {
          const b = Math.pow(1 - Math.max(pr.d, 0) / F, 2)
          const c = rows[i].r.c
          P[i][j] = mad(P[i][j], sub(P[i][j], c), o.flare * b)
          pr = project(o.parent, P[i][j])
          // (a vertex deep inside the parent stays where it is, hidden: its nearest surface point may be on the far side)
          if (pr.d < o.eps && pr.d > -F * 0.75) P[i][j] = mad(pr.q, pr.n, o.eps)
          blend[i][j] = pr.d < o.eps ? 1 : Math.pow(1 - Math.max(pr.d, 0) / F, 2)
          pn[i][j] = pr.n
          pw[i][j] = weightsAt(o.parent, pr.v)
        }
      }
      P[i][S] = P[i][0]
      blend[i][S] = blend[i][0]
      pn[i][S] = pn[i][0]
      pw[i][S] = pw[i][0]
      if (all && outside >= 0 && i > outside + 1) break
    }
    // rings wholly inside the parent are never seen: start one ring before the first that surfaces
    first = Math.max(0, outside - 1)
    if (o.fillet <= 0) first = 0
  }
  if (first > 0) {
    P = P.slice(first)
    blend = blend.slice(first)
    pn = pn.slice(first)
    pw = pw.slice(first)
    rows.splice(0, first)
  }
  const base = M.count
  const nR = rows.length
  for (let i = 0; i < nR; i++) {
    const row = rows[i]
    for (let j = 0; j <= S; j++) {
      let n: V
      if (row.pole) n = [row.r.t[0] * row.pole, row.r.t[1] * row.pole, row.r.t[2] * row.pole]
      else {
        const a = sub(P[Math.min(nR - 1, i + 1)][j], P[Math.max(0, i - 1)][j])
        const b = sub(P[i][(j + 1) % S], P[i][(j + S - 1) % S])
        n = norm(cross(b, a))
        if (!(len(cross(b, a)) > 1e-12)) n = norm(sub(P[i][j], row.r.c))
      }
      const bl = blend[i][j]
      const q = pn[i][j]
      if (bl > 0 && q) n = norm(lerp(n, q, bl))
      const own = row.r.wt
      const par = pw[i][j]
      const wt = bl > 0 && par ? mixW(own, par, bl) : own
      const v = row.r.v
      const br = o.breath && v > o.breath[0] && v < o.breath[1] ? o.breath[2] * Math.sin((Math.PI * (v - o.breath[0])) / (o.breath[1] - o.breath[0])) * Math.abs(Math.sin((j / S) * Math.PI * 2)) : 0
      M.vert(P[i][j], n, [v, j / S, o.mat, o.row + 0.999 * o.rand], [o.thin, 1 - 0.5 * bl, br, v], wt, row.r.t)
    }
  }
  for (let i = 0; i < nR - 1; i++)
    for (let j = 0; j < S; j++) {
      const a = base + i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1
      M.idx.push(a, b, c, b, d, c)
    }
  return R
}

// ---------------------------------------------------------------- the creature

const mirrorV = (p: Vec3): V => [p[0], p[1], -p[2]]

/**
 * Build a creature at a level of detail: 1 is the hero mesh, 0.5 a reduced one, 0.25 a far one.
 * Lower detail thins rings and sides and drops parts whose `minDetail` is above it. Every level
 * has the same skeleton, so one posed palette drives them all.
 */
export function buildCreature(spec: CreatureSpec, detail = 1): Built {
  const M = new MeshData()
  const names: string[] = []
  const parent: number[] = []
  const head: number[] = []
  const bone = (name: string, par: number, at: Vec3) => {
    names.push(name)
    parent.push(par)
    head.push(at[0], at[1], at[2])
    return names.length - 1
  }
  const rnd = rng(spec.name.length * 7919 + spec.parts.length * 104729 + 17)
  const B = spec.body
  const q = (n: number, lo: number) => Math.max(lo, Math.round(n * Math.min(1, detail)))

  // the body and its spine frames
  const spinePts = B.spine.map((p) => [...p] as V)
  const scv = curve(spinePts, true)
  const frames = typeof B.bones === "number" ? Array.from({ length: B.bones }, (_, i) => i / (B.bones as number - 1)) : B.bones
  for (let j = 0; j < frames.length; j++) bone("spine" + j, -1, scv.at(frames[j]))
  const size = scv.total
  const eps = size * 0.0015
  const bodyW = (v: number): W => {
    let j = 0
    while (j < frames.length - 2 && v > frames[j + 1]) j++
    const f = sstep((v - frames[j]) / (frames[j + 1] - frames[j] || 1))
    return f <= 0 ? { i: [j], w: [1] } : f >= 1 ? { i: [j + 1], w: [1] } : { i: [j, j + 1], w: [1 - f, f] }
  }
  const parts: PartInfo[] = []
  const t0 = norm(sub(scv.at(0.02), scv.at(0)))
  const bodyUp: Vec3 = B.up ?? (Math.abs(t0[1]) > 0.86 ? [-1, 0, 0] : [0, 1, 0])
  const bodyRings = tube(M, { pts: spinePts, smooth: true, up: bodyUp, sect: B.sect, rings: q(B.rings ?? 64, 10), sides: q(B.sides ?? 28, 8), caps: B.caps ?? ["round", "round"], mat: B.mat ?? MAT.skin, thin: 0, row: 0, rand: rnd(), weights: bodyW, fillet: 0, flare: 0.55, eps, segments: B.segments, breath: B.breath, bulges: resolveBulges(B.bulges, false) })
  parts.push({ name: "body", role: "body", row: 0, side: 0, rings: bodyRings, bones: frames.map((_, i) => i), attach: -1, joints: frames.map((f) => scv.at(f)), axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], mat: B.mat ?? MAT.skin , limits: null })
  const find = (name: string) => {
    const p = parts.find((x) => x.name === name)
    if (!p) throw new Error(`creature "${spec.name}": no part "${name}" (a part must come after the part it grows on)`)
    return p
  }

  const addPart = (ps: PartSpec, side: number) => {
    if ((ps.minDetail ?? 0) > detail) return
    const mir = side < 0
    const par = find(ps.on === undefined || ps.on === "body" ? "body" : mir && parts.some((x) => x.name === ps.on + "L") ? ps.on + "L" : parts.some((x) => x.name === ps.on + (side > 0 ? "R" : "")) ? ps.on + (side > 0 ? "R" : "") : ps.on)
    let origin: V
    let anchorV: number
    if (ps.origin) {
      origin = mir ? mirrorV(ps.origin) : ([...ps.origin] as V)
      anchorV = project(par.rings, origin).v
    } else {
      const phi = ((ps.around ?? 0) * Math.PI) / 180 * (mir ? -1 : 1)
      anchorV = ps.at ?? 0
      origin = mad(surf(par.rings, anchorV, phi), surfNormal(par.rings, anchorV, phi), -(ps.sink ?? 0))
    }
    const pts: V[] = [origin]
    if (ps.frame === "surface") {
      const phi = ((ps.around ?? 0) * Math.PI) / 180 * (mir ? -1 : 1)
      const T = norm(sub(surf(par.rings, Math.min(1, anchorV + 0.01), phi), surf(par.rings, Math.max(0, anchorV - 0.01), phi)))
      const N = surfNormal(par.rings, anchorV, phi)
      const Bn = cross(T, N)
      for (const p of ps.path) pts.push(add(origin, [T[0] * p[0] + N[0] * p[1] + Bn[0] * p[2] * side, T[1] * p[0] + N[1] * p[1] + Bn[1] * p[2] * side, T[2] * p[0] + N[2] * p[1] + Bn[2] * p[2] * side]))
    } else for (const p of ps.path) pts.push(add(origin, mir ? mirrorV(p) : p))
    const jointed = !!ps.jointed
    const cv = curve(pts, !jointed)
    const dir = norm(sub(pts[1], pts[0]))
    let up: V = ps.up ? (mir ? mirrorV(ps.up) : ([...ps.up] as V)) : Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    up = norm(mad(up, dir, -dot(up, dir)))
    // bones
    const pw = weightsAt(par.rings, anchorV)
    let attach = pw.i[0]
    for (let k = 1; k < pw.i.length; k++) if (pw.w[k] > pw.w[pw.i.indexOf(attach)]) attach = pw.i[k]
    const name = ps.name + (ps.mirror ? (mir ? "L" : "R") : "")
    const nb = ps.bones === "joints" ? pts.length - 1 : (ps.bones ?? 0)
    const bAt: number[] = []
    const bones: number[] = []
    for (let k = 0; k < nb; k++) {
      bAt.push(ps.bones === "joints" ? cv.knots[k] : k / nb)
      bones.push(bone(name + "." + k, k === 0 ? attach : bones[k - 1], cv.at(bAt[k])))
    }
    const win = 0.3
    // a rigid part that follows other parts' first bones at its far end (a web of skin between two fingers)
    let fol: W | null = null
    if (ps.follow?.length && !nb) {
      const sfx = ps.mirror ? (mir ? "L" : "R") : ""
      const ids = ps.follow.map((f) => {
        const [nm, k] = f.split(".")
        return (parts.find((x) => x.name === nm + sfx) ?? find(nm)).bones[+(k ?? 0)]
      }).filter((b) => b !== undefined)
      if (ids.length) fol = { i: ids, w: ids.map(() => 1 / ids.length) }
    }
    const fAt = ps.followFrom ?? 0
    const weights = (v: number): W => {
      if (fol) return mixW({ i: [attach], w: [1] }, fol, sstep((v - fAt) / (1 - fAt || 1)))
      if (!nb) return { i: [attach], w: [1] }
      let k = 0
      while (k < nb - 1 && v >= bAt[k + 1]) k++
      const end = k + 1 < nb ? bAt[k + 1] : 1
      const f = (v - bAt[k]) / (end - bAt[k] || 1)
      const o: W = { i: [bones[k]], w: [1] }
      if (k > 0 && f < win) return mixW(o, { i: [bones[k - 1]], w: [1] }, 0.5 * (1 - sstep(f / win)))
      if (k + 1 < nb && f > 1 - win) return mixW(o, { i: [bones[k + 1]], w: [1] }, 0.5 * (1 - sstep((1 - f) / win)))
      return o
    }
    const flat = ps.sect.some((s) => s.up < s.w * 0.25)
    const rings = tube(M, { pts, smooth: !jointed, up, sect: ps.sect, rings: q(ps.rings ?? 14, jointed ? 6 : 4), sides: q(ps.sides ?? 12, flat ? 6 : 5), caps: [ps.cap0 ?? "none", ps.cap ?? "round"], mat: ps.mat ?? MAT.skin, thin: ps.thin ?? 0, row: ps.row ?? 0, rand: rnd(), weights, parent: par.rings, fillet: ps.fillet ?? 0, flare: ps.flare ?? 0.55, eps, segments: ps.segments ? { from: 0, to: 1, ...ps.segments } : undefined, bulges: resolveBulges(ps.bulges, mir) })
    const joints: V[] = bAt.map((a) => cv.at(a))
    joints.push(cv.at(1))
    parts.push({ name, role: ps.role ?? "", row: ps.row ?? 0, side: ps.mirror ? side : 0, rings, bones, attach, joints, axes: [dir, up, cross(dir, up)], mat: ps.mat ?? MAT.skin, limits: ps.limits ?? null, base: ps.name, toes: !!ps.toes })
  }
  for (const ps of spec.parts) {
    addPart(ps, 1)
    if (ps.mirror) addPart(ps, -1)
  }

  // cards: little leaf-shaped blades rooted in the skin, each riding the skin weights under its root
  let C: MeshData | null = null
  const addCards = (cs: CardSpec) => {
    C ??= new MeshData()
    const par = find(cs.on ?? "body")
    const r = rng((cs.seed ?? 1) * 9973 + cs.count)
    const jit = cs.jitter ?? 0.25
    for (let n = 0; n < cs.count; n++) {
      const side = n % 2 ? -1 : 1
      const rows = cs.rows ?? 0
      const fr = rows ? (Math.floor((n / 2 / (cs.count / 2)) * rows) + 0.5) / rows : r()
      const fa = rows ? (((n >> 1) % Math.max(1, Math.floor(cs.count / 2 / rows))) + 0.5) / Math.max(1, Math.floor(cs.count / 2 / rows)) : r()
      const v = mixn(cs.from, cs.to, fr)
      const phi = (mixn(cs.arc[0], cs.arc[1], fa) * Math.PI) / 180 * side
      const p = surf(par.rings, v, phi)
      const nn = surfNormal(par.rings, v, phi)
      // lie along the skin pointing tailward, lifted off it, with a seeded turn
      let back = norm(sub(surf(par.rings, Math.max(0, v - 0.01), phi), p))
      const turn = (r() - 0.5) * 2 * jit
      const sideways = cross(nn, back)
      back = norm(mad(back, sideways, Math.tan(turn)))
      const lift = (cs.lift ?? 0.3) * (1 + (r() - 0.5) * jit)
      const d = norm(mad(back, nn, Math.tan(lift)))
      const sd = norm(cross(nn, d))
      const L = cs.len * (1 + (r() - 0.5) * jit), wd = cs.w * (1 + (r() - 0.5) * jit)
      const wt = weightsAt(par.rings, v)
      const cn = norm(mad(nn, d, -0.35))
      const b0 = C.count
      const rand = r()
      const put = (along: number, across: number) => C!.vert(add(mad(p, d, L * along), [sd[0] * wd * across, sd[1] * wd * across, sd[2] * wd * across]), norm(mad(cn, sd, across * 0.5)), [along, across * 0.5 + 0.5, MAT.membrane, rand], [1, 0.6 + 0.4 * along, 0, along], wt, d)
      put(0, -0.3)
      put(0, 0.3)
      put(0.45, -1)
      put(0.45, 1)
      put(1, 0)
      C.idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2, b0 + 2, b0 + 3, b0 + 4)
    }
  }
  for (const cs of spec.cards ?? []) if (detail >= (cs.minDetail ?? 1)) addCards(cs)

  // bounds of the rest pose
  const lo: V = [1e30, 1e30, 1e30], hi: V = [-1e30, -1e30, -1e30]
  for (let i = 0; i < M.pos.length; i += 3)
    for (let c = 0; c < 3; c++) {
      lo[c] = Math.min(lo[c], M.pos[i + c])
      hi[c] = Math.max(hi[c], M.pos[i + c])
    }
  const centre = lerp(lo, hi, 0.5)
  let radius = 0
  for (let i = 0; i < M.pos.length; i += 3) radius = Math.max(radius, Math.hypot(M.pos[i] - centre[0], M.pos[i + 1] - centre[1], M.pos[i + 2] - centre[2]))
  const cards = C as MeshData | null
  // the trunk: the stretch of the body at least 0.62 of its greatest girth
  let gMax = 0
  for (const r of bodyRings) gMax = Math.max(gMax, r.w * (r.up + r.dn))
  let x0 = 1e30, x1 = -1e30, ty = 0, tn = 0, rw = 0, rh = 0
  for (const r of bodyRings) {
    if (r.w * (r.up + r.dn) < gMax * 0.62) continue
    x0 = Math.min(x0, r.c[0])
    x1 = Math.max(x1, r.c[0])
    ty += r.c[1] + (r.up - r.dn) / 2
    tn++
    rw = Math.max(rw, r.w)
    rh = Math.max(rh, (r.up + r.dn) / 2)
  }
  const trunk: [number, number, number, number, number, number] = [(x0 + x1) / 2, ty / Math.max(1, tn), 0, Math.max(1e-3, (x1 - x0) * 0.62), Math.max(1e-3, rh), Math.max(1e-3, rw)]
  return {
    trunk,
    hide: M.geometry(),
    cards: cards ? cards.geometry() : null,
    skel: { n: names.length, names, parent: Int16Array.from(parent), head: Float32Array.from(head), spine: frames.length, spineAt: Float32Array.from(frames) },
    parts,
    part: find,
    centre,
    radius,
    tris: M.idx.length / 3 + (cards ? cards.idx.length / 3 : 0),
    verts: M.count + (cards ? cards.count : 0),
  }
}
