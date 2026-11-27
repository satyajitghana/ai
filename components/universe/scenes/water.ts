// Scene 8, water: "Water, earlier than expected."
//
// Idea. A grain of sand that remembers an ocean, and the ocean inside it.
//
// Story parameter. `depth`: the log zoom from the grain to the sea floor. 0 on the slide; inside
// the crystal one unit per e-fold of scale (RIDE), 1 when the lens is in the water. Then `tags`,
// the claims pinned so far. Everything is drawn from the beat clock; nothing is accumulated.
//
// World rule, macro (TSL `ringEnv` and `slideLit`). One ring light over a pale stage. Those two
// functions are the only light there is: the glass, the quartz, the steel and the crystal all call
// them, and the rays the crystal refracts and reflects inside itself end in the same two functions.
//
// World rule, sea (TSL `waterField`). One height field, a sum of travelling sines with analytic
// slope and Hessian. Caustics are its Jacobian, 1 / |det(I + d·Hess)|, on sand, mats, tags and
// card; the surface seen from below refracts through its slope; the shafts are the same pattern
// marched at half resolution; strings, tags and silt lean in the current it implies.
//
// The crystal is an intersection of half-spaces: the square prism and the two four-sided pyramids
// of zircon's tetragonal habit, and one oblique plane that takes a corner off (the grain is
// detrital). The mesh is clipped from those planes on the CPU; the fragment shader traces the same
// planes for refraction (index 1.95) and three internal bounces. Growth zones are shells of the
// polyhedron's own gauge, max over faces of n·p / d, so they run parallel to the faces; the ride of
// beat 2 is the same gauge seen end-on in log radius.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, Discard, dot, exp, float, floor, Fn, fract, fwidth, If, int, length, log, Loop, max, min, mix as mixN, modelWorldMatrix, normalGeometry, normalize, positionGeometry, pow, reflect, select, sin, smoothstep, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, LABEL_MIN, labelFloor, stageTarget, typeCues } from "../engine/stage"
import { H } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, wrap, type TitleOpts } from "../engine/titles"
import { fbm, hash21, luma, hash22, rot, sampleRT, vnoise, vnoise3, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, Portal, PostOpts, SceneInstance, State } from "../engine/types"
import { comment, SELECT } from "../engine/ui"

// ---------------------------------------------------------------- the crystal (macro units: its half-length is 1)
const ZL = 1
const ZW = 0.235
const PHI = Math.atan(0.9) // the pyramid face's normal stands 42 degrees off the long axis (zircon: c/a = 0.90)
const CP = Math.cos(PHI)
const SP = Math.sin(PHI)
const ZC: [number, number, number] = [0.9, ZW, -0.2] // lying on a prism face
const ZYAW = 0.46
const N_ZIRCON = 1.95
/** Crystal-local planes [nx, ny, nz, d]: inside is n·p <= d. The long (c) axis is local x. */
const PL_LOCAL: number[][] = (() => {
  const p: number[][] = [[0, 1, 0, ZW], [0, -1, 0, ZW], [0, 0, 1, ZW], [0, 0, -1, ZW]]
  for (const sx of [1, -1]) p.push([sx * CP, SP, 0, CP * ZL], [sx * CP, -SP, 0, CP * ZL], [sx * CP, 0, SP, CP * ZL], [sx * CP, 0, -SP, CP * ZL])
  const c = new THREE.Vector3(0.74, 0.5, 0.45).normalize()
  p.push([c.x, c.y, c.z, c.x * ZL - 0.085]) // the worn corner
  return p
})()
const CY = Math.cos(ZYAW)
const SY = Math.sin(ZYAW)
const toWorld = (x: number, y: number, z: number): [number, number, number] => [CY * x + SY * z, y, -SY * x + CY * z]
const PL_WORLD = PL_LOCAL.map(([x, y, z, d]) => {
  const n = toWorld(x, y, z)
  return [n[0], n[1], n[2], d + n[0] * ZC[0] + n[1] * ZC[1] + n[2] * ZC[2]]
})

/** The mesh of a convex polyhedron given as planes: each face is a big quad clipped by all the others. */
function hull(planes: number[][]) {
  const pos: number[] = []
  const nor: number[] = []
  planes.forEach((P, i) => {
    const n = new THREE.Vector3(P[0], P[1], P[2])
    const u = new THREE.Vector3(1, 0, 0)
    if (Math.abs(n.x) > 0.8) u.set(0, 1, 0)
    u.addScaledVector(n, -u.dot(n)).normalize()
    const v = new THREE.Vector3().crossVectors(n, u)
    let poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => n.clone().multiplyScalar(P[3]).addScaledVector(u, a * 9).addScaledVector(v, b * 9))
    planes.forEach((Q, j) => {
      if (j === i || poly.length < 3) return
      const m = new THREE.Vector3(Q[0], Q[1], Q[2])
      const out: THREE.Vector3[] = []
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k]
        const b = poly[(k + 1) % poly.length]
        const da = m.dot(a) - Q[3]
        const db = m.dot(b) - Q[3]
        if (da <= 0) out.push(a)
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(a.clone().lerp(b, da / (da - db)))
      }
      poly = out
    })
    for (let k = 1; k + 1 < poly.length; k++)
      for (const p of [poly[0], poly[k], poly[k + 1]]) {
        pos.push(p.x, p.y, p.z)
        nor.push(n.x, n.y, n.z)
      }
  })
  return { pos, nor }
}

// ---------------------------------------------------------------- the bench
const RING_H = 9 // the ring light hangs this far over the glass
const RING_R: [number, number] = [0.95, 1.5] // the ring light's inner and outer radius, round the lens
const SLIDE_ROT = -0.2
const SLIDE_HALF: [number, number] = [19, 6.2]
const SLIDE_C: [number, number] = [2.5, -0.9]
const SCALE_C: [number, number] = [0.3, 1.75] // where the engraved scale starts its middle
const DIV = 0.08 // one division of the scale: a hundredth of its length
/** Quartz grains: x, z, radius, squash, seed, and when each lands (seconds before the scene's clock starts). */
const GRAINS: number[][] = [
  [-1.5, -2.0, 1.3, 0.8, 1, 0.5],
  [3.7, -1.5, 1.05, 0.86, 2, 0.34],
  [-2.7, 1.7, 0.95, 0.9, 3, 0.42],
  [4.6, 2.2, 0.92, 0.82, 4, 0.2],
  [0.4, -5.6, 1.7, 0.78, 5, 0.6],
  [-6.8, -0.6, 1.35, 0.85, 6, 0.26],
  [8.1, -0.8, 1.55, 0.8, 7, 0.46],
  [2.2, 5.2, 1.25, 0.84, 8, 0.12],
  [-1.2, -9.2, 1.9, 0.8, 9, 0.56],
]
const NG = GRAINS.length

const fr = (x: number) => x - Math.floor(x)
const h3 = (x: number, y: number, z: number) => fr(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453)
function vn3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), ux), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), ux), uy), l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), ux), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), ux), uy), uz)
}

// ---------------------------------------------------------------- the sea (metres)
const FOV_S = 50
const SURF = 1.45 // the water is this deep
const SUNW = new THREE.Vector3(-0.44, 1, -0.3).normalize() // toward the sun, as the surface bends it
const FLOOR = { x0: -8, x1: 9, z0: -15, z1: 6 }
const floorH = (x: number, z: number) => 0.05 * Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.7 - 0.4) + 0.03 * Math.sin(z * 1.9 + x * 0.6)
/** The wave field: seven travelling sines. Amplitude goes as 1/k², so every wave bends the light about as much. */
const WAVES = (() => {
  const r = rng(808)
  return Array.from({ length: 7 }, (_, i) => {
    const lam = 0.26 * 1.33 ** i * (0.85 + 0.3 * r())
    const k = (2 * Math.PI) / lam
    const th = 0.5 + (r() - 0.5) * 2.6
    return { kx: Math.cos(th) * k, kz: Math.sin(th) * k, a: 0.62 / (k * k), w: Math.sqrt(9.81 * k) * 0.3, ph: r() * 6.2832 }
  })
})()
// the lens's way over the floor: where it is at the start of the glide, at the end of beat 2, as the tags go by, and at rest
const PA: [number, number, number] = [-0.2, 0.4, 3.5]
const PB: [number, number, number] = [-0.55, 0.3, 0.35]
const PC: [number, number, number] = [0.0, 0.44, -1.85]
const PD: [number, number, number] = [0.08, 0.5, -1.9]
type Mound = { x: number; z: number; r: number; h: number; seed: number; cone: number; rot: number; cut: number; sat?: boolean }
const BROKEN = 0
const MOUNDS: Mound[] = (() => {
  const r = rng(3480)
  const out: Mound[] = [
    // the broken dome the lens banks past, its face toward the lens
    { x: 0.38, z: -0.62, r: 0.37, h: 0.31, seed: 3.1, cone: 0, rot: (-3 * Math.PI) / 4 + 0.15, cut: 0.12 },
    // the three that get tags: near, middle, far
    { x: 1.26, z: -3.26, r: 0.24, h: 0.19, seed: 11.3, cone: 0.05, rot: 0.4, cut: 9 },
    { x: 1.12, z: -3.95, r: 0.3, h: 0.27, seed: 23.9, cone: 0.7, rot: 1.9, cut: 9 },
    { x: 0.85, z: -5.0, r: 0.38, h: 0.31, seed: 37.7, cone: 0, rot: 4.4, cut: 9 },
  ]
  const segD = (px: number, pz: number, a: number[], b: number[]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)))
    return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t)
  }
  const path = [[PA[0], PA[2] + 2], [PA[0], PA[2]], [PB[0], PB[2]], [PC[0], PC[2]], [PD[0], PD[2]]]
  const sight = [[out[1].x, out[1].z], [out[2].x, out[2].z], [out[3].x, out[3].z], [0.56, -2.8]]
  let guard = 0
  while (out.length < 64 && guard++ < 6000) {
    const x = FLOOR.x0 + 1 + r() * (FLOOR.x1 - FLOOR.x0 - 2)
    const z = 4.6 - r() * 17
    const big = r()
    const rad = 0.09 + 0.36 * big * big + 0.05 * r()
    // they grow in patches
    if (vn3(x * 0.55 + 4, z * 0.55, 2) < 0.42 && r() < 0.8) continue
    let ok = true
    for (let i = 0; i + 1 < path.length && ok; i++) if (segD(x, z, path[i], path[i + 1]) < rad + 0.33) ok = false
    for (const sg of sight) if (ok && segD(x, z, [PD[0], PD[2]], sg) < rad + 0.2) ok = false
    if (ok && segD(x, z, [PB[0], PB[2]], [out[0].x, out[0].z]) < rad + 0.25) ok = false
    if (!ok || out.some((m) => Math.hypot(m.x - x, m.z - z) < (m.r + rad) * 0.78)) continue
    out.push({ x, z, r: rad, h: rad * (0.6 + 0.45 * r()), seed: r() * 90, cone: r() < 0.24 ? 0.55 + 0.45 * r() : r() * 0.12, rot: r() * 6.28, cut: 9 })
  }
  // Heads crowd and grow into one another (Hamelin Pool, Shark Bay: fields of coalesced, knobbly heads, not
  // lone domes). Satellites from their own seed, so every mound above and every sightline stays where it was.
  const rs = rng(3481)
  const base = out.length
  for (let i = 4; i < base; i++) {
    const m = out[i]
    const k = 1 + Math.floor(rs() * (m.r > 0.25 ? 4 : 2.5))
    for (let j = 0; j < k; j++) {
      const a = rs() * 6.2832
      const rad = m.r * (0.32 + 0.45 * rs())
      const d = (m.r + rad) * (0.45 + 0.35 * rs()) // overlapping: they share a base
      const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d
      let ok = true
      for (let q = 0; q + 1 < path.length && ok; q++) if (segD(x, z, path[q], path[q + 1]) < rad + 0.3) ok = false
      for (const sg of sight) if (ok && segD(x, z, [PD[0], PD[2]], sg) < rad + 0.18) ok = false
      if (ok && segD(x, z, [PB[0], PB[2]], [out[0].x, out[0].z]) < rad + 0.25) ok = false
      if (ok) for (let q = 0; q < 4 && ok; q++) if (Math.hypot(out[q].x - x, out[q].z - z) < out[q].r + rad + 0.05) ok = false
      if (!ok || x < FLOOR.x0 + 0.5 || x > FLOOR.x1 - 0.5) continue
      out.push({ x, z, r: rad, h: rad * (0.75 + 0.5 * rs()), seed: rs() * 90, cone: rs() < 0.15 ? 0.5 + 0.4 * rs() : rs() * 0.1, rot: rs() * 6.28, cut: 9, sat: true })
    }
  }
  return out
})()
const NSILT = 800
const NBUB = 300
const GROW = 1.7 // seconds a bubble swells on the mat before it lets go
const TAG_W = 0.3
const TAG_ASP = [0.5, 0.5, 0.7]
const TAG_NUM_F = 176 // px on an 820-wide tag
const TAG_CAP_F = 84
const TAG_L = [0.34, 0.42, 0.52] // string lengths
const TAG_T = [0.7, 1.9, 3.1] // when each is let go (seconds into beat 3)
const CARD_T = 3.3 // the card is planted
const PIN_T = [4.25, 4.65, 5.05] // when each string is pinned to the card
const TAG_MOUND = [1, 2, 3]
const TAG_RGB: [number, number, number][] = [[0.92, 0.9, 0.82], [0.95, 0.27, 0.1], [1.0, 0.76, 0.12]]
const TAG_CSS = ["#efe9d6", "#e2562b", "#f5c330"]
const CARD_W = 0.72
const CARD_H = 0.2925
const CARD_V: [number, number] = [3400, 4450]
const CARD_X = (v: number) => -CARD_W / 2 + 0.15 + ((v - CARD_V[0]) / (CARD_V[1] - CARD_V[0])) * (CARD_W - 0.18)
const CARD_ROW = [0.08, 0.016, -0.05]
const CARD_P: [number, number, number] = [0.56, 0, -2.8]
const CARD_YAW = Math.atan2(PD[0] - CARD_P[0], PD[2] - CARD_P[2])
// the ride through the crystal (seconds into beat 2)
const RIDE = { push: 1.5, in0: 1.1, in1: 1.5, sea: 2.9, open: 3.0, end: 3.95, z: 5.4 }
const rideZ = (t: number) => RIDE.z * E.io2(clamp((t - RIDE.in0) / (RIDE.end - RIDE.in0)))
const num = (s: string) => parseInt(s.replace(/,/g, ""), 10)

// the reviewer
const SAY = "Smaller than a grain of sand."
const CPS = 18
const RV = { sel: 3.6, say: 4.0, out: 9.6 }
const FOV_M = 20

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const hdr = ctx.target({})
  const beats = ctx.def.beats
  const geos: THREE.BufferGeometry[] = []
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (fragment: THREE.Node, vertex?: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }
  const sq = (x: F): F => x.mul(x) as F
  const fall = (lo: number | F, hi: number | F, x: F): F => smoothstep(lo, hi, x).oneMinus() as F

  // ================================================================ the macro
  const macro = new THREE.Scene()
  const mcam = new THREE.PerspectiveCamera(FOV_M, 16 / 9, 0.04, 200)
  const gy = new Array<number>(NG).fill(0)
  const M = {
    uCam: uniform(new THREE.Vector3()),
    uFwd: uniform(new THREE.Vector3(0, 0, -1)),
    uFocus: uniform(10),
    uAp: uniform(1),
    uRing: uniform(1), // the ring light's level (it strikes when the hand-off lands)
    uGY: uniformArray(gy, "float"),
    uZing: uniform(0), // the crystal ringing after it lands
  }
  const gyAt = (i: number): F => M.uGY.element(int(i)) as unknown as F
  /** Circle of confusion for a world point, signed: negative in front of the focal plane. -1..1 of the widest blur. */
  const coc = (P: V3): F => {
    const d = max(dot(P.sub(M.uCam), M.uFwd), 0.1)
    return clampN(d.sub(M.uFocus).div(d).mul(M.uAp), -1, 1) as F
  }

  // ---- the world rule: what the bench looks like from a point `o` in direction `d`
  const sRot = (q: V2): V2 => vec2(q.x.mul(Math.cos(SLIDE_ROT)).sub(q.y.mul(Math.sin(SLIDE_ROT))), q.x.mul(Math.sin(SLIDE_ROT)).add(q.y.mul(Math.cos(SLIDE_ROT)))) as V2
  /** The glass and the stage under it at q = world xz. `fine` adds what only the glass's own surface needs. */
  const slideLit = (q: V2, fine: boolean, ring: F = M.uRing as unknown as F): V3 => {
    const s = sRot(q.sub(vec2(SLIDE_C[0], SLIDE_C[1])) as V2)
    const e = vec2(abs(s.x).sub(SLIDE_HALF[0]), abs(s.y).sub(SLIDE_HALF[1]))
    const sd = max(e.x, e.y) // negative on the glass
    const aa = fine ? max(fwidth(sd), 0.004) : float(0.03)
    const inS = fall(-1, 1, sd.div(aa) as F)
    // opal stage: brightest under the ring, falling away
    const r2 = dot(q, q)
    const pool = exp(r2.mul(-0.011))
    const col = mixN(vec3(0.3, 0.33, 0.39), vec3(0.9, 0.885, 0.85), pool).mul(ring.mul(0.82).add(0.18)).toVar()
    // the glass: a faint green, a ground edge that glows, and its shadow on the stage
    col.mulAssign(mixN(vec3(1), vec3(0.93, 0.965, 0.945), inS))
    const edge = exp(sq(sd.div(0.11) as F).negate())
    col.addAssign(vec3(0.45, 0.72, 0.62).mul(edge).mul(0.3).mul(ring))
    col.mulAssign(float(1).sub(fall(0, 0.9, sd).mul(step(0, sd)).mul(0.2)))
    // whatever lies on it: a soft contact shadow and the light it gathers underneath
    for (let i = 0; i < NG; i++) {
      const g = GRAINS[i]
      const lift = fine ? gyAt(i) : float(0)
      const d2 = dot(q.sub(vec2(g[0], g[1])), q.sub(vec2(g[0], g[1]))).div(g[2] * g[2])
      const near = float(1).div(lift.mul(0.6).add(1))
      col.mulAssign(mixN(vec3(1), vec3(0.5, 0.56, 0.68), exp(d2.mul(-1.5)).mul(0.75).mul(near)))
      col.addAssign(vec3(1.0, 0.97, 0.9).mul(exp(d2.mul(-9))).mul(0.55).mul(near).mul(ring))
    }
    // the zircon: a thin shadow along its length, and honey light spilled beside it
    const a = vec2(ZC[0] - CY * 0.75, ZC[2] + SY * 0.75)
    const ab = vec2(CY * 1.5, -SY * 1.5)
    const hq = clampN(dot(q.sub(a), ab).div(2.25), 0, 1)
    const dz = length(q.sub(a).sub(ab.mul(hq)))
    col.mulAssign(mixN(vec3(1), vec3(0.52, 0.5, 0.56), exp(sq(dz.div(0.34) as F).negate()).mul(0.8)))
    col.addAssign(vec3(1.0, 0.56, 0.12).mul(exp(sq(dz.sub(0.5).div(0.3) as F).negate())).mul(0.2).mul(ring))
    if (fine) {
      // the engraved scale: a hundred divisions, every fifth taller, every tenth tallest, inside a ring. No numerals.
      const p = s.sub(sRot(vec2(SCALE_C[0] - SLIDE_C[0], SCALE_C[1] - SLIDE_C[1]) as V2))
      const u = p.x.div(DIV)
      const idx = floor(u.add(0.5))
      const du = abs(u.sub(idx)).mul(DIV)
      const m5 = step(abs(idx.div(5).sub(floor(idx.div(5).add(0.5)))), 0.01)
      const m10 = step(abs(idx.div(10).sub(floor(idx.div(10).add(0.5)))), 0.01)
      const len = mixN(mixN(float(0.22), 0.34, m5), 0.5, m10)
      const fw = max(fwidth(p.x), 0.0015)
      const lw = max(float(0.011), fw.mul(0.75))
      const fade = clampN(float(0.03).div(fw), 0, 1) // the finest ticks merge before they alias
      const tick = fall(-1, 1, du.sub(lw).div(fw) as F).mul(step(abs(idx), 50.5)).mul(smoothstep(0, fw, p.y)).mul(fall(0, fw.mul(2).add(0.001) as F, p.y.sub(len) as F))
      const ink = tick.mul(mixN(fade, 1, max(m5, m10))).mul(inS)
      col.mulAssign(mixN(vec3(1), vec3(0.2, 0.2, 0.22), ink.mul(0.85)))
      // hairline scratches and dust, the kind every used slide has
      const sc = vnoise(vec2(s.x.mul(0.7).add(s.y.mul(9)), s.y.mul(0.35)).add(3)).sub(0.86).mul(8)
      col.mulAssign(float(1).sub(clampN(sc, 0, 1).mul(0.08).mul(inS)))
      const cell = floor(q.mul(2.3))
      const dp = q.mul(2.3).sub(cell).sub(hash21(cell).mul(0.6).add(0.2))
      const dust = fall(0.02, 0.06, length(dp).sub(hash21(cell.add(7.7)).mul(0.07)) as F).mul(step(0.8, hash21(cell.add(3.1))))
      col.mulAssign(float(1).sub(dust.mul(0.35)))
    }
    return col as V3
  }
  // (a real shader function may only use its arguments: the lamp's level and the lens are passed in)
  const ringEnvFn = Fn(([d, o, ring, cam]: [V3, V3, F, V3]) => {
    const col = vec3(0).toVar()
    // the ring light is on the lens, as ring lights are: a curved thing shows it as a small bright ring
    // with the lens dark in its middle, and a facet flashes when it squarely faces the camera
    const tc = cam.sub(o).toVar()
    const dc = length(tc)
    const cc = dot(d, tc.div(dc))
    const rr = sqrt(max(float(1).sub(cc.mul(cc)), 0)).div(max(cc, 0.05)).mul(dc)
    const lamp = smoothstep(RING_R[0] - 0.12, RING_R[0], rr).mul(fall(RING_R[1], RING_R[1] + 0.12, rr)).mul(step(0, cc))
    If(d.y.greaterThan(0), () => {
      const dy = max(d.y, 0.02)
      const q = o.xz.add(d.xz.mul(float(RING_H).sub(o.y).div(dy))).toVar()
      // the room past the lamp: dim, with one tall window so glass and steel have something to mirror
      const win = fall(0, 1, max(abs(q.x.add(5)).sub(9).div(3), abs(q.y.add(13)).sub(4.5).div(2.5)) as F)
      col.assign(vec3(0.05, 0.055, 0.07).add(vec3(0.75, 0.85, 1.0).mul(win).mul(2.6)))
    }).Else(() => {
      const q = o.xz.add(d.xz.mul(max(o.y, 0).div(max(d.y.negate(), 0.03))))
      col.assign(slideLit(q as V2, false, ring))
    })
    return col.add(vec3(1.0, 0.97, 0.93).mul(lamp).mul(16).mul(ring))
  }).setLayout({ name: "ringEnv", type: "vec3", inputs: [{ name: "d", type: "vec3" }, { name: "o", type: "vec3" }, { name: "ring", type: "float" }, { name: "cam", type: "vec3" }] })
  const ringEnv = (d: THREE.Node, o: THREE.Node): V3 => ringEnvFn(d as V3, o as V3, M.uRing as unknown as F, M.uCam as unknown as V3) as V3
  const schlick = (c: F, f0: number): F => pow(clampN(c.oneMinus(), 0, 1), 5).mul(1 - f0).add(f0) as F

  // ---- the glass slide and the stage
  {
    const g = new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2)
    geos.push(g)
    const vP = positionGeometry.toVarying("wsP")
    const frag = Fn(() => {
      const V = normalize(vP.sub(M.uCam)).toVar()
      const col = slideLit(vP.xz as V2, true).toVar()
      const s = sRot(vP.xz.sub(vec2(SLIDE_C[0], SLIDE_C[1])) as V2)
      const inS = step(max(abs(s.x).sub(SLIDE_HALF[0]), abs(s.y).sub(SLIDE_HALF[1])), 0)
      // the lamp mirrored in the glass: once in the top face, once, fainter and shifted, in the bottom
      const R = reflect(V, vec3(0, 1, 0)).toVar()
      const fres = schlick(V.y.negate() as F, 0.04)
      const top = ringEnv(R, vP).sub(vec3(0.05, 0.055, 0.07))
      const bot = ringEnv(R, vP.sub(vec3(0, 0.45, 0)) as V3).sub(vec3(0.05, 0.055, 0.07))
      col.addAssign(top.add(bot.mul(0.55)).mul(fres).mul(mixN(float(0.12), 1, inS)))
      return vec4(col, coc(vP as V3))
    })()
    const m = new THREE.Mesh(g, mat(frag))
    m.frustumCulled = false
    macro.add(m)
  }

  // ---- the zircon
  const zHull = hull(PL_WORLD)
  {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(zHull.pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(zHull.nor, 3))
    geos.push(g)
    const vP = positionGeometry.toVarying("zcP")
    const vN = normalGeometry.toVarying("zcN")
    /** How far through its growth a point is: 0 at the centre, 1 on the faces. Shells of this are the zones. */
    const gauge = (p: V3): F => {
      const dlt = p.sub(vec3(ZC[0], ZC[1], ZC[2]))
      const x = abs(dlt.x.mul(CY).sub(dlt.z.mul(SY)))
      const m = max(abs(dlt.y), abs(dlt.x.mul(SY).add(dlt.z.mul(CY))))
      return max(m.div(ZW), x.mul(CP).add(m.mul(SP)).div(CP * ZL)) as F
    }
    const frag = Fn(() => {
      const N = normalize(vN).toVar()
      const V = normalize(vP.sub(M.uCam)).toVar()
      const c0 = dot(V, N).negate().toVar()
      const F0 = schlick(c0, 0.104).toVar()
      const refl = ringEnv(reflect(V, N), vP).toVar()
      // into the crystal
      const eta = 1 / N_ZIRCON
      const k0 = float(1).sub(float(eta * eta).mul(float(1).sub(c0.mul(c0))))
      const d = normalize(V.mul(eta).add(N.mul(c0.mul(eta).sub(sqrt(max(k0, 0)))))).toVar()
      const o = vec3(vP).toVar()
      const thru = vec3(1).toVar()
      const acc = vec3(0).toVar()
      for (let b = 0; b < 3; b++) {
        // the face this ray leaves by
        const t = float(1e3).toVar()
        const Nn = vec3(0, 1, 0).toVar()
        for (const P of PL_WORLD) {
          const n = vec3(P[0], P[1], P[2])
          const dn = dot(n, d).toVar()
          const ti = float(P[3]).sub(dot(n, o)).div(max(dn, 1e-4)).toVar()
          If(dn.greaterThan(1e-4).and(ti.lessThan(t)), () => {
            t.assign(ti)
            Nn.assign(n)
          })
        }
        t.assign(max(t, 0))
        // what the light crosses on the way: the zones, the cloudy core, a few blebs of quartz
        const dens = float(0).toVar()
        const spark = float(0).toVar()
        for (const sAt of [0.2, 0.5, 0.8]) {
          const p = o.add(d.mul(t.mul(sAt))).toVar()
          const g = gauge(p).toVar()
          const band = sin(g.mul(48).add(vnoise(vec2(g.mul(11), 1.3)).mul(6))).mul(0.5).add(0.5)
          const wide = vnoise(vec2(g.mul(5), 7.1))
          const core = fall(0.2, 0.46, g).mul(vnoise3(p.mul(9)).mul(0.9).add(0.55))
          dens.addAssign(band.mul(band).mul(wide.mul(1.6).add(0.3)).add(0.3).add(core.mul(5.5)))
          const cell = floor(p.mul(4.2))
          const bp = p.mul(4.2).sub(cell).sub(0.5)
          spark.addAssign(fall(0.07, 0.12, length(bp)).mul(step(0.7, vnoise3(cell.mul(3.7).add(11)))).mul(fall(0.86, 0.95, g)))
        }
        thru.mulAssign(exp(mixN(vec3(0.05, 0.42, 1.5), vec3(0.2, 0.75, 1.5), fall(0.25, 0.6, gauge(o.add(d.mul(t.mul(0.5))) as V3))).mul(dens).mul(t).mul(-1.25)))
        const hit = o.add(d.mul(t)).toVar()
        acc.addAssign(thru.mul(spark).mul(0.5).mul(M.uRing))
        // out through that face, or, more often with an index this high, back in
        const c = dot(d, Nn).toVar()
        const k = float(1).sub(float(N_ZIRCON * N_ZIRCON).mul(float(1).sub(c.mul(c)))).toVar()
        const Fr = select(k.greaterThan(0), schlick(sqrt(max(k, 0)) as F, 0.104), float(1)).toVar()
        If(k.greaterThan(0), () => {
          // (three wavelengths leave at three angles: zircon's fire)
          const out = (n: number) => {
            const kk = float(1).sub(float(n * n).mul(float(1).sub(c.mul(c))))
            return ringEnv(normalize(d.mul(n).add(Nn.mul(sqrt(max(kk, 0)).sub(c.mul(n))))), hit)
          }
          const e = b === 0 ? vec3(out(N_ZIRCON - 0.03).x, out(N_ZIRCON).y, out(N_ZIRCON + 0.03).z) : out(N_ZIRCON)
          acc.addAssign(thru.mul(e).mul(Fr.oneMinus()))
        })
        thru.mulAssign(Fr)
        d.assign(d.sub(Nn.mul(c.mul(2))))
        o.assign(hit)
      }
      // whatever is still bouncing leaves as a warm glow
      acc.addAssign(thru.mul(vec3(1.0, 0.6, 0.2)).mul(0.35).mul(M.uRing))
      const col = mixN(acc, refl, F0).toVar()
      col.addAssign(vec3(1.0, 0.8, 0.5).mul(M.uZing).mul(0.6))
      return vec4(col, coc(vP as V3))
    })()
    const m = new THREE.Mesh(g, mat(frag))
    m.frustumCulled = false
    macro.add(m)
  }

  // ---- quartz sand: sub-rounded, frosted, bigger than the zircon
  {
    const pos: number[] = []
    const nor: number[] = []
    const aG: number[] = []
    GRAINS.forEach((gr, id) => {
      const g = new THREE.IcosahedronGeometry(1, 5)
      const p = g.attributes.position as THREE.BufferAttribute
      const sd = gr[4] * 17.3
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
        // worn lumps, a few flat chips, a fine tooth
        let r = 0.8 + 0.42 * vn3(x * 1.3 + sd, y * 1.3, z * 1.3) + 0.12 * vn3(x * 3.4 + sd, y * 3.4 + 5, z * 3.4)
        const c = vn3(sd + 2, 1, 1) * 2 - 1, e = vn3(sd + 5, 2, 1) * 2 - 1
        const cut = x * c + y * 0.5 + z * e
        r = Math.min(r, 1.04 / Math.max(cut + 0.42, 0.42) * 0.62 + 0.3)
        p.setXYZ(i, gr[0] + x * r * gr[2], gr[2] * gr[3] * 0.93 + y * r * gr[2] * gr[3], gr[1] + z * r * gr[2])
      }
      g.computeVertexNormals()
      const nn = g.attributes.normal as THREE.BufferAttribute
      const ix = g.index
      const push = (i: number) => {
        pos.push(p.getX(i), p.getY(i), p.getZ(i))
        nor.push(nn.getX(i), nn.getY(i), nn.getZ(i))
        aG.push(gr[0], gr[1], gr[2], id)
      }
      if (ix) for (let i = 0; i < ix.count; i++) push(ix.getX(i))
      else for (let i = 0; i < p.count; i++) push(i)
      g.dispose()
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute("aG", new THREE.Float32BufferAttribute(aG, 4))
    geos.push(g)
    const aGr = attribute("aG", "vec4")
    const lift = M.uGY.element(aGr.w.add(0.5).toInt()) as unknown as F
    const wp = positionGeometry.add(vec3(0, lift, 0))
    const vP = wp.toVarying("qzP")
    const vN = normalGeometry.toVarying("qzN")
    const vG = aGr.toVarying("qzG")
    const frag = Fn(() => {
      const V = normalize(vP.sub(M.uCam)).toVar()
      // frosting: the surface is pitted from a long life of being rolled about
      const fp = vP.mul(7)
      const fn = vec3(vnoise3(fp), vnoise3(fp.add(17.1)), vnoise3(fp.add(41.3))).sub(0.5)
      const frost = vnoise3(vP.mul(1.7).add(vG.w.mul(9))).toVar()
      const N = normalize(normalize(vN).add(fn.mul(mixN(float(0.1), 0.5, frost)))).toVar()
      const c0 = clampN(dot(V, N).negate(), 0, 1).toVar()
      const Fr = schlick(c0, 0.045)
      const refl = ringEnv(reflect(V, N), vP)
      // through it: the glass underneath, bent and upside down, as a ball lens shows it
      const T = normalize(V.mul(1 / 1.54).add(N.mul(c0.mul(1 / 1.54).sub(sqrt(float(1).sub(float(1 / 1.54 ** 2).mul(float(1).sub(c0.mul(c0)))))))))
      const exitP = vP.add(T.mul(vG.z.mul(1.6).mul(c0)))
      const ctr = vec3(vG.x, vG.z.mul(0.8), vG.y)
      const Nout = normalize(exitP.sub(ctr))
      const Tout = normalize(T.add(Nout.mul(-0.35)))
      const seen = ringEnv(vec3(Tout.x, abs(Tout.y).negate().sub(0.05), Tout.z), exitP).toVar()
      // milky body: lit from all round by the ring, warmer and brighter where it is thin
      const up = N.y.mul(0.5).add(0.5)
      const stain = smoothstep(0.55, 0.8, vnoise3(vP.mul(0.9).add(vG.w.mul(3.3))))
      const milk = mixN(vec3(0.9, 0.89, 0.86), vec3(0.93, 0.74, 0.5), stain.mul(0.55)).mul(up.mul(0.5).add(0.5)).mul(M.uRing.mul(0.85).add(0.15))
      const veil = smoothstep(0.35, 0.75, vnoise3(vP.mul(vec3(2.2, 0.8, 1.6)).add(5))).mul(0.5).add(frost.mul(0.35)).add(0.15)
      const body = mixN(seen.mul(vec3(1.0, 0.99, 0.96)), milk, clampN(veil.add(0.2), 0, 1)).toVar()
      body.mulAssign(mixN(vec3(0.34, 0.37, 0.43), vec3(1), smoothstep(0.0, 0.55, c0)))
      const col = mixN(body, refl, Fr.mul(mixN(float(1), 0.4, frost)))
      return vec4(col, coc(vP as V3))
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(wp, 1))))
    m.frustumCulled = false
    macro.add(m)
  }

  // ---- tweezers: two fine points coming in over the edge of the frame
  {
    const tip = new THREE.Vector3(ZC[0] + 0.95, 0.42, ZC[2] - 0.8)
    const dir = new THREE.Vector3(0.78, 0.4, -0.5).normalize()
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    const up = new THREE.Vector3().crossVectors(side, dir)
    const LEN = 44
    const pos: number[] = []
    for (const sgn of [1, -1]) {
      const b = new THREE.BoxGeometry(1, 1, 1, 24, 1, 1).toNonIndexed()
      const p = b.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const s = p.getX(i) + 0.5
        // (at this scale a watchmaker's point is as wide as the crystal's waist)
        const w = 0.07 + 2.6 * s ** 0.85
        const th = 0.07 + 0.9 * s
        // the blades spring apart toward the hand
        const off = sgn * (0.1 + 0.5 * th + 9 * s * s) + p.getZ(i) * th
        const v = tip.clone().addScaledVector(dir, s * LEN).addScaledVector(side, off).addScaledVector(up, p.getY(i) * w)
        pos.push(v.x, v.y, v.z)
      }
      b.dispose()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    geos.push(g)
    const vP = positionGeometry.toVarying("twP")
    const vN = normalGeometry.toVarying("twN")
    const frag = Fn(() => {
      const V = normalize(vP.sub(M.uCam)).toVar()
      const along = dot(vP.sub(vec3(tip.x, tip.y, tip.z)), vec3(dir.x, dir.y, dir.z))
      // brushed along its length: the highlight smears across the grain
      const br = vnoise(vec2(along.mul(0.6), dot(vP, vec3(up.x, up.y, up.z)).mul(60))).sub(0.5)
      const N = normalize(normalize(vN).add(vec3(side.x, side.y, side.z).mul(br.mul(0.35)))).toVar()
      const R = reflect(V, N)
      const e = ringEnv(R, vP).add(ringEnv(normalize(R.add(vec3(side.x, side.y, side.z).mul(0.18))), vP)).add(ringEnv(normalize(R.sub(vec3(side.x, side.y, side.z).mul(0.18))), vP)).div(3)
      const col = e.mul(vec3(0.62, 0.64, 0.68)).mul(br.mul(0.3).add(0.9)).add(vec3(0.02, 0.022, 0.026))
      return vec4(col, coc(vP as V3))
    })()
    const m = new THREE.Mesh(g, mat(frag, undefined, { side: THREE.DoubleSide }))
    m.frustumCulled = false
    macro.add(m)
  }

  // ---- depth of field: a gather over a spiral disc, each tap judged by its own blur
  const D = { tS: uniformTexture(stage.texture), uMax: uniform(0.03) }
  const TAPS = 28
  const dof = ctx.pass(({ uv, res }) => {
    const c0 = sampleRT(D.tS, uv).toVar()
    const a0 = abs(c0.a).toVar()
    const acc = vec3(c0.rgb).toVar()
    const w = float(1).toVar()
    const asp = res.x.div(res.y)
    const rot = hash21(floor(uv.mul(res))).mul(6.2832)
    Loop(TAPS, ({ i }) => {
      const fi = float(i).add(0.5)
      const rr = sqrt(fi.div(TAPS)).toVar()
      const an = fi.mul(2.39996).add(rot)
      const off = vec2(cos(an), sin(an)).mul(rr).mul(D.uMax).div(vec2(asp, 1))
      const s = sampleRT(D.tS, uv.add(off) as V2).toVar()
      const as = abs(s.a)
      // a tap in front of the focal plane spreads over anything; one behind it only over things as soft as itself
      const lim = select(s.a.lessThan(0), as, select(c0.a.lessThan(0), max(as, a0), min(as, a0)))
      const k = smoothstep(rr.sub(0.05), rr.add(0.05), lim).toVar()
      acc.addAssign(s.rgb.mul(k))
      w.addAssign(k)
    })
    return vec4(acc.div(w), 1)
  }, D)

  // ---- the three claims, cut from the script's own lines (nothing here is typed twice)
  const sub1 = beats[1].sub ?? ""
  const sub2 = beats[2].sub ?? ""
  const m1 = sub1.match(/^([^:]+):[^,]*, ([\d,]+ million years(?: ago)?), (\w+)/)
  const m2 = sub2.match(/^([^:]+): ([\d,]+ million years), (\w+)\. (\w+) ([\d,]+ to [\d,]+), (\w+)/)
  const claim = (i: number, status: string, date: string, place: string) => {
    const vs = date.match(/[\d,]{4,}/g) ?? []
    return { m: TAG_MOUND[i], status, date, place, vs, v: vs.map(num), rgb: TAG_RGB[i], css: TAG_CSS[i] }
  }
  const TAGS = [claim(0, m1?.[1] ?? "", m1?.[2] ?? sub1, m1?.[3] ?? ""), claim(1, m2?.[1] ?? "", m2?.[2] ?? sub2, m2?.[3] ?? ""), claim(2, m2?.[4] ?? "", m2?.[5] ?? "", m2?.[6] ?? "")]
  const zs = (beats[0].sub ?? "").match(/[\d,]{4,}/)?.[0] ?? ""
  const ZIRCON_V = { s: zs, v: zs ? num(zs) : CARD_V[1] }
  const UNIT_S = sub1.match(/million years ago/)?.[0] ?? "million years"

  // ================================================================ the sea floor
  const sea = new THREE.Scene()
  const scam = new THREE.PerspectiveCamera(FOV_S, 16 / 9, 0.04, 90)
  const lo = ctx.target({ scale: 0.4 })
  const S = {
    uT: uniform(0),
    uCam: uniform(new THREE.Vector3()),
    uR: uniform(new THREE.Vector3(1, 0, 0)),
    uU: uniform(new THREE.Vector3(0, 1, 0)),
    uF: uniform(new THREE.Vector3(0, 0, -1)),
    uTan: uniform(new THREE.Vector2(1, 1)),
    uPx: uniform(800), // pixels per radian, near enough
    uSilt: uniform(0), // the water thickens as the scene leaves
    uEv: uniform(new THREE.Vector3(-9, -9, -9)), // seconds since each tag was let go
    uSun: uniform(1),
    uFocus: uniform(1.5),
    uCard: uniform(-9), // seconds since the card was planted
  }
  const tagA = TAGS.map((t) => new THREE.Vector3(MOUNDS[t.m].x, floorH(MOUNDS[t.m].x, MOUNDS[t.m].z) + MOUNDS[t.m].h * 0.97, MOUNDS[t.m].z))
  const tagE = TAGS.map((_, i) => tagA[i].clone())
  const tagC = TAGS.map((_, i) => tagA[i].clone())
  const uTA = uniformArray(tagA, "vec3")
  const uTE = uniformArray(tagE, "vec3")
  const uTC = uniformArray(tagC, "vec3")
  const SUNV = vec3(SUNW.x, SUNW.y, SUNW.z)

  // ---- the world rule: one field of waves. Its Hessian bends the light into caustics.
  const caustic = Fn(([p_, t, D]: [V2, F, F]) => {
    const p = p_.add(vec2(vnoise(p_.mul(1.7).add(t.mul(0.07))), vnoise(p_.mul(1.7).add(vec2(9.1, 3.3)).sub(t.mul(0.06)))).sub(0.5).mul(0.22)).toVar()
    const hxx = float(0).toVar()
    const hxz = float(0).toVar()
    const hzz = float(0).toVar()
    for (const w of WAVES) {
      const sn = sin(p.x.mul(w.kx).add(p.y.mul(w.kz)).sub(t.mul(w.w)).add(w.ph)).mul(w.a).toVar()
      hxx.subAssign(sn.mul(w.kx * w.kx))
      hxz.subAssign(sn.mul(w.kx * w.kz))
      hzz.subAssign(sn.mul(w.kz * w.kz))
    }
    // light landing at depth D has moved by about 0.25·D·slope: the area it covers is det(I + c·Hess)
    const c = D.mul(0.3)
    const det = c.mul(hxx).add(1).mul(c.mul(hzz).add(1)).sub(sq(c.mul(hxz) as F))
    return pow(min(float(1).div(abs(det).add(0.1)), 5), 0.8)
  }).setLayout({ name: "caustic", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "t", type: "float" }, { name: "D", type: "float" }] })
  const slopeAt = Fn(([p, t]: [V2, F]) => {
    const s = vec2(0).toVar()
    for (const w of WAVES) s.addAssign(vec2(w.kx, w.kz).mul(cos(p.x.mul(w.kx).add(p.y.mul(w.kz)).sub(t.mul(w.w)).add(w.ph)).mul(w.a)))
    return s
  }).setLayout({ name: "waveSlope", type: "vec2", inputs: [{ name: "p", type: "vec2" }, { name: "t", type: "float" }] })
  /** Sunlight reaching a point under water, relative to an even surface: the caustic pattern, carried down the light's own slant. */
  const lightAt = (P: V3): F => {
    const D = max(float(SURF).sub(P.y), 0)
    const c = caustic(P.xz.add(vec2(SUNW.x / SUNW.y, SUNW.z / SUNW.y).mul(D)) as V2, S.uT as unknown as F, D as F)
    // focused a little under the surface; by the floor the pattern has begun to blur
    return mixN(c, float(1), smoothstep(0.95, 1.6, D).mul(0.38)) as F
  }
  const fogCol = (V: V3): V3 => {
    const up = smoothstep(-0.2, 0.9, V.y)
    const fwd = pow(max(dot(V, SUNV), 0), 5)
    return mixN(vec3(0.01, 0.075, 0.095), vec3(0.06, 0.3, 0.3), up).add(vec3(0.1, 0.3, 0.24).mul(fwd)).mul(float(1).add(S.uSilt.mul(0.5))) as V3
  }
  const SIG = vec3(0.34, 0.115, 0.1)
  /** Every surface in the sea is lit by this and by nothing else. Returns colour and, in alpha, distance from the lens. */
  const seaShade = (P: V3, N: V3, alb: V3, thin = 0, gloss?: F): V4 => {
    const D = max(float(SURF).sub(P.y), 0)
    const c = lightAt(P)
    const sun = vec3(1.0, 0.95, 0.8).mul(1.75).mul(exp(vec3(0.4, 0.09, 0.07).mul(D).negate())).mul(S.uSun)
    const dif = thin ? abs(dot(N, SUNV)).mul(0.6).add(0.4) : max(dot(N, SUNV), 0)
    const amb = vec3(0.085, 0.22, 0.24).mul(N.y.mul(0.4).add(0.6))
    const toC = P.sub(S.uCam)
    const dist = length(toC)
    let lit = alb.mul(sun.mul(dif).mul(c).add(amb))
    if (gloss) {
      // a wet film over the mat: the sun's glint through the caustics, and the bright water mirrored at grazing angles
      const V = toC.div(dist).negate()
      const Hh = normalize(SUNV.add(V))
      const spec = pow(max(dot(N, Hh), 0), 64).mul(c).mul(0.7)
      const fr = pow(clampN(float(1).sub(dot(N, V)), 0, 1), 4)
      lit = lit.add(sun.mul(spec).mul(gloss)).add(vec3(0.1, 0.34, 0.33).mul(fr).mul(gloss).mul(0.22))
    }
    const T = exp(SIG.mul(dist).mul(float(1).add(S.uSilt.mul(1.5))).negate())
    return vec4(lit.mul(T).add(fogCol(toC.div(dist) as V3).mul(T.oneMinus())), dist) as V4
  }
  const floorHN = (p: V2): F => sin(p.x.mul(0.9).add(1.3)).mul(cos(p.y.mul(0.7).sub(0.4))).mul(0.05).add(sin(p.y.mul(1.9).add(p.x.mul(0.6))).mul(0.03)) as F

  // ---- where the mats are, baked: r = mat on the floor round a mound, g = the shade at its foot
  const MW = 320
  const matData = new Uint8Array(MW * MW * 4)
  for (let j = 0; j < MW; j++)
    for (let i = 0; i < MW; i++) {
      const x = FLOOR.x0 + ((i + 0.5) / MW) * (FLOOR.x1 - FLOOR.x0)
      const z = FLOOR.z0 + ((j + 0.5) / MW) * (FLOOR.z1 - FLOOR.z0)
      let ap = 0
      let ao = 1
      for (const m of MOUNDS) {
        const d = Math.hypot(x - m.x, z - m.z) / m.r
        ap = Math.max(ap, 1 - smooth(0.85, 1.75 + 0.5 * vn3(x * 3, z * 3, m.seed), d))
        ao *= 1 - 0.55 * Math.exp(-((d - 0.95) ** 2) * 9) * (d > 0.5 ? 1 : 0)
      }
      matData.set([Math.round(ap * 255), Math.round(ao * 255), 0, 255], (j * MW + i) * 4)
    }
  const matTex = new THREE.DataTexture(matData, MW, MW, THREE.RGBAFormat)
  matTex.magFilter = THREE.LinearFilter
  matTex.minFilter = THREE.LinearFilter
  matTex.needsUpdate = true

  // ---- the floor: rippled sand
  {
    const g = new THREE.PlaneGeometry(FLOOR.x1 - FLOOR.x0, FLOOR.z1 - FLOOR.z0, 70, 86).rotateX(-Math.PI / 2).translate((FLOOR.x0 + FLOOR.x1) / 2, 0, (FLOOR.z0 + FLOOR.z1) / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, floorH(p.getX(i), p.getZ(i)))
    geos.push(g)
    const vP = positionGeometry.toVarying("flP")
    const frag = Fn(() => {
      const p2 = vP.xz.toVar()
      const mk = texture(matTex).sample(vec2(p2.x.sub(FLOOR.x0).div(FLOOR.x1 - FLOOR.x0), p2.y.sub(FLOOR.z0).div(FLOOR.z1 - FLOOR.z0))).toVar()
      const apron = mk.r
      // wave ripples: long crests that fork and die out, sharper at the crest than in the trough
      const warp = vnoise(p2.mul(1.3)).mul(6).add(vnoise(p2.mul(0.4).add(7)).mul(10))
      const ph = dot(p2, vec2(0.93, 0.37)).mul(6.2832 / 0.095).add(warp).toVar()
      const fw = fwidth(ph)
      const keep = clampN(float(1.6).div(fw.add(0.01)).sub(0.4), 0, 1).mul(apron.oneMinus()) // gone before they alias
      const sn = sin(ph).toVar()
      const crest = pow(sn.mul(0.5).add(0.5), 1.6)
      const sl = cos(ph).mul(keep).mul(0.5)
      const N = normalize(vec3(sl.mul(-0.93), 1, sl.mul(-0.37))).toVar()
      const speck = step(0.9, hash21(floor(p2.mul(700)))).mul(clampN(float(0.004).div(fwidth(p2.x).add(1e-5)), 0, 1))
      const sand = vec3(0.55, 0.49, 0.37).mul(vnoise(p2.mul(40)).mul(0.24).add(0.88)).mul(mixN(float(1), mixN(0.8, 1.06, crest), keep))
      const alb = mixN(sand, vec3(0.1, 0.09, 0.07), speck.mul(0.5)).toVar()
      // round every mound the mat creeps out over the sand and smooths it
      const film = vnoise(p2.mul(9)).mul(0.5).add(0.5)
      alb.assign(mixN(alb, vec3(0.075, 0.07, 0.04).mul(film.add(0.5)), smoothstep(0.25, 0.95, apron.mul(film.mul(0.7).add(0.65))).mul(0.85)))
      alb.mulAssign(mk.g)
      return seaShade(vP as V3, N as V3, alb as V3)
    })()
    const m = new THREE.Mesh(g, mat(frag))
    m.frustumCulled = false
    sea.add(m)
  }

  /** A mound's surface over the unit disc q, for the mound (A: x, z, radius, height; B: seed, cone, turn, cut). */
  const moundSurf = (q: V2, A: V4, B: V4) => {
    const cr = cos(B.z)
    const sr = sin(B.z)
    const base = vec2(A.x, A.y)
    const cutX = B.w.mul(A.z)
    // the heads are steep-sided, some nearly columns with a rounded cap (Shark Bay's sub-tidal heads); the broken one stays a dome
    const kCol = mixN(float(2), fract(B.x.mul(0.618)).mul(2.6).add(2), step(1, B.w))
    const prof = (r: F): F => mixN(pow(max(float(1).sub(pow(r, kCol)), 0), 0.55), pow(max(float(1).sub(r), 0), 1.1).mul(float(1).add(r.mul(0.5))), B.y) as F
    /** local (along, height, across) of the surface over q */
    const at = (qq: V2) => {
      const rho = length(qq)
      const dir = qq.div(max(rho, 1e-4))
      // lumps: the outline is not a circle, and neighbours have grown into one another
      const lump = vnoise(dir.mul(1.4).add(B.x)).sub(0.5).mul(0.5).add(vnoise(dir.mul(3.1).add(B.x.mul(1.7))).sub(0.5).mul(0.2)).mul(smoothstep(0, 0.5, rho)).add(1)
      const f0 = prof(min(rho, 1) as F)
      const xl0 = qq.x.mul(A.z).mul(lump)
      const zl = qq.y.mul(A.z).mul(lump)
      // knobbly: rounded lobes (billows) on two scales, the cauliflower heads of a living stromatolite
      const p3 = vec3(xl0, f0.mul(A.w), zl).div(A.z).add(B.x)
      const lobe = abs(vnoise3(p3.mul(3.4)).mul(2).sub(1)).oneMinus().mul(0.13).add(abs(vnoise3(p3.mul(7.5).add(5)).mul(2).sub(1)).oneMinus().mul(0.035))
      const knob = vnoise3(p3.mul(2.2)).sub(0.5).mul(0.2).add(lobe.sub(0.11).mul(step(1, B.w))).mul(smoothstep(0, 0.3, f0))
      const y = f0.add(knob).mul(A.w)
      return { x: min(xl0, cutX), y, z: zl, isCut: step(cutX, xl0), rho }
    }
    const P = at(q)
    const e = 0.035
    const Px = at(q.add(vec2(e, 0)) as V2)
    const Pz = at(q.add(vec2(0, e)) as V2)
    const tx = vec3(Px.x.sub(P.x), Px.y.sub(P.y), Px.z.sub(P.z))
    const tz = vec3(Pz.x.sub(P.x), Pz.y.sub(P.y), Pz.z.sub(P.z))
    const cz = cross(tz, tx).toVar()
    const cl = length(cz)
    // (a degenerate patch, where the cut flattens the mesh, falls back to straight up)
    const nl = cl.greaterThan(1e-7).select(cz.div(max(cl, 1e-7)), vec3(0, 1, 0))
    const nc = P.isCut.greaterThan(0.5).select(vec3(1, 0, 0), nl)
    const nw = vec3(nc.x.mul(cr).add(nc.z.mul(sr)), nc.y, nc.z.mul(cr).sub(nc.x.mul(sr)))
    const wp = vec3(base.x.add(P.x.mul(cr)).add(P.z.mul(sr)), floorHN(base as V2).sub(0.012).add(P.y), base.y.sub(P.x.mul(sr)).add(P.z.mul(cr)))
    return { wp, nw, xl: P.x, y: P.y, zl: P.z, isCut: P.isCut, rho: P.rho }
  }

  // ---- the mats: domes and a few cones, lumpy, wrinkled, dusted with caught sand. One is broken open.
  {
    const RS = 60
    const TS = 22
    const pos: number[] = []
    const idx: number[] = []
    for (let j = 0; j <= TS; j++)
      for (let i = 0; i <= RS; i++) {
        const rho = 1 - (j / TS) ** 1.25
        const th = (i / RS) * Math.PI * 2
        pos.push(Math.cos(th) * rho, 0, Math.sin(th) * rho)
      }
    for (let j = 0; j < TS; j++)
      for (let i = 0; i < RS; i++) {
        const a = j * (RS + 1) + i
        idx.push(a, a + RS + 1, a + 1, a + 1, a + RS + 1, a + RS + 2)
      }
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const aM = new Float32Array(MOUNDS.length * 4)
    const aN = new Float32Array(MOUNDS.length * 4)
    MOUNDS.forEach((m, i) => {
      aM.set([m.x, m.z, m.r, m.h], i * 4)
      aN.set([m.seed, m.cone, m.rot, m.cut], i * 4)
    })
    g.setAttribute("aM", new THREE.InstancedBufferAttribute(aM, 4))
    g.setAttribute("aN", new THREE.InstancedBufferAttribute(aN, 4))
    g.instanceCount = MOUNDS.length
    geos.push(g)
    const A = attribute("aM", "vec4")
    const B = attribute("aN", "vec4")
    const { wp, nw, xl, y, zl, isCut, rho } = moundSurf(positionGeometry.xz as V2, A as V4, B as V4)
    const vP = wp.toVarying("mdP")
    const vN = nw.toVarying("mdN")
    const vL = vec4(xl.div(A.z), y.div(A.w), zl.div(A.z), isCut).toVarying("mdL") // the mound's own coordinates
    const vK = vec4(B.x, A.z, A.w, rho).toVarying("mdK")
    const frag = Fn(() => {
      const L = vL.toVar()
      const seed = vK.x
      const N0 = normalize(vN).toVar()
      const col = vec3(0).toVar()
      const N = vec3(N0).toVar()
      const gloss = float(0.06).toVar()
      If(L.w.greaterThan(0.5), () => {
        // the broken face: laminae draped over one another, each a little wrinkled, dark mat and pale caught sediment
        const gg = sqrt(sq(L.y as F).add(sq(L.z as F))).toVar()
        const an = atan(L.z, L.y.add(0.25))
        const wr = vnoise(vec2(an.mul(7), gg.mul(5)).add(seed)).sub(0.5).mul(0.07).add(vnoise(vec2(an.mul(23), gg.mul(13))).sub(0.5).mul(0.022))
        const u = gg.add(wr).mul(30).toVar()
        const k = fract(u)
        const id = floor(u)
        const thick = hash21(vec2(id, seed.add(3))).mul(0.5).add(0.25)
        const aa = max(fwidth(u), 0.02)
        const dark = smoothstep(thick.sub(aa), thick.add(aa), k).mul(fall(float(1).sub(aa) as F, 1, k).mul(0.6).add(0.4))
        const soft = clampN(float(0.5).div(aa), 0, 1) // far away the layers merge into their average
        const pale = mixN(vec3(0.62, 0.56, 0.42), vec3(0.74, 0.7, 0.58), hash21(vec2(id, 9.1)))
        const lam = mixN(pale, vec3(0.085, 0.075, 0.05), mixN(float(0.55), dark, soft))
        const grit = vnoise3(vP.mul(260)).sub(0.5).mul(0.25).add(1)
        // a lens of sand caught in the stack, and the first dark layers at the heart
        const lens = smoothstep(0.62, 0.7, vnoise(vec2(L.z.mul(3).add(seed), gg.mul(9)))).mul(0.6)
        col.assign(mixN(lam, vec3(0.6, 0.55, 0.43), lens).mul(grit).mul(mixN(float(0.55), 1, smoothstep(0.08, 0.3, gg))))
        N.assign(normalize(N0.add(vec3(0, wr.mul(4), 0))))
      }).Else(() => {
        // the living skin: leathery, wrinkled in ridges, pimpled with small domes
        const q = vP.mul(float(1).div(vK.y).mul(0.42).add(22))
        const w1 = abs(vnoise3(q.mul(0.55)).sub(0.5)).mul(2)
        const w2 = abs(vnoise3(q.mul(1.3).add(5)).sub(0.5)).mul(2)
        const crease = fall(0.0, 0.16, min(w1, w2.add(0.05)))
        const hue = vnoise3(vP.mul(3.1).add(seed))
        const skin = mixN(vec3(0.055, 0.07, 0.03), vec3(0.14, 0.085, 0.035), hue).mul(mixN(float(1), 0.5, crease))
        // sand caught on the shoulders and in the creases, more on the side the current comes from
        const up = smoothstep(0.55, 0.95, N0.y)
        const stoss = N0.x.mul(-0.5).add(0.5)
        const caught = smoothstep(0.45, 0.75, vnoise3(vP.mul(17)).mul(0.6).add(up.mul(0.5)).add(stoss.mul(0.22)).add(crease.mul(0.25)))
        const grain = vnoise3(vP.mul(420)).mul(0.4).add(0.8)
        // greener where the sun reaches it: the crown is where the mat is growing
        const crown = up.mul(smoothstep(0.35, 0.9, L.y))
        col.assign(mixN(mixN(skin, vec3(0.05, 0.13, 0.04), crown.mul(0.6)), vec3(0.5, 0.45, 0.34).mul(grain), caught.mul(0.36)))
        gloss.assign(caught.oneMinus().mul(0.85).add(0.1))
        // faint growth lines round the flanks
        const line = sin(L.y.mul(46).add(vnoise3(vP.mul(6)).mul(5))).mul(0.5).add(0.5)
        col.mulAssign(mixN(float(1), line.mul(0.35).add(0.75), up.oneMinus().mul(0.7)))
        // beads of gas held on the mat
        const cell = floor(vP.mul(95))
        const bp = vP.mul(95).sub(cell).sub(0.5)
        const bead = fall(0.1, 0.22, length(bp)).mul(step(0.93, vnoise3(cell.mul(1.7)))).mul(up)
        col.addAssign(vec3(0.5, 0.75, 0.7).mul(bead).mul(0.5))
        N.assign(normalize(N0.add(vec3(w1.sub(0.5), 0, w2.sub(0.5)).mul(0.5))))
        // where it meets the floor it is in its own shade
        col.mulAssign(mixN(float(0.5), 1, smoothstep(0.0, 0.25, L.y)))
      })
      return seaShade(vP as V3, N as V3, col as V3, 0, gloss as F)
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(wp, 1))))
    m.frustumCulled = false
    sea.add(m)
  }

  // ---- the surface from underneath, and the water beyond everything
  {
    const g = new THREE.PlaneGeometry(90, 90).rotateX(Math.PI / 2).translate(0, SURF, -6)
    geos.push(g)
    const vP = positionGeometry.toVarying("sfP")
    const frag = Fn(() => {
      const toC = vP.sub(S.uCam)
      const dist = length(toC)
      const V = toC.div(dist).toVar()
      const sl = slopeAt(vP.xz, S.uT).toVar()
      const sl2 = slopeAt(vP.xz.mul(2.7).add(3.1), S.uT.mul(1.6)).mul(0.5)
      const Nu = normalize(vec3(sl.x.add(sl2.x).negate(), 1, sl.y.add(sl2.y).negate())).toVar()
      const c = dot(V, Nu).toVar()
      // out into the air, or, past 48 degrees, back down: the bright window overhead and the mirror round it
      const k = float(1).sub(float(1.333 * 1.333).mul(float(1).sub(c.mul(c)))).toVar()
      const Tr = normalize(V.mul(1.333).add(Nu.mul(sqrt(max(k, 0)).sub(c.mul(1.333)))))
      // the whole sky is squeezed into the window: pale at its rim (the horizon), blue overhead, a few clouds
      const cl = smoothstep(0.5, 0.75, vnoise(Tr.xz.div(max(Tr.y, 0.12)).mul(1.1).add(S.uT.mul(0.01))))
      const sky = mixN(vec3(1.25, 1.3, 1.2), vec3(0.62, 0.9, 1.12), smoothstep(0.15, 1, Tr.y)).mul(1.5).add(vec3(0.5, 0.5, 0.48).mul(cl))
      const glint = pow(max(dot(Tr, normalize(vec3(-0.62, 0.66, -0.42))), 0), 90).mul(26)
      const win = sky.add(vec3(1.0, 0.95, 0.8).mul(glint)).mul(S.uSun)
      const R = V.sub(Nu.mul(c.mul(2)))
      // (what the mirror shows is the lit floor under it, a water's depth away)
      const pf = vP.xz.add(R.xz.mul(float(SURF).div(max(R.y.negate(), 0.08))))
      const down = float(SURF).div(max(R.y.negate(), 0.08))
      const floorC = vec3(0.5, 0.46, 0.34).mul(caustic(pf.add(vec2(SUNW.x / SUNW.y, SUNW.z / SUNW.y).mul(SURF)) as V2, S.uT as unknown as F, float(SURF) as F)).mul(vec3(1.0, 0.95, 0.8)).mul(0.9)
      const Tm = exp(SIG.mul(down).negate())
      const mirror = floorC.mul(Tm).add(fogCol(R as V3).mul(Tm.oneMinus()))
      const fr = select(k.greaterThan(0), schlick(sqrt(max(k, 0)) as F, 0.02), float(1))
      const col = mixN(win, mirror, fr)
      const T = exp(SIG.mul(dist).mul(float(1).add(S.uSilt.mul(1.5))).negate())
      return vec4(col.mul(T).add(fogCol(V as V3).mul(T.oneMinus())), 40)
    })()
    const m = new THREE.Mesh(g, mat(frag))
    m.frustumCulled = false
    sea.add(m)
    const dg = new THREE.IcosahedronGeometry(60, 3)
    geos.push(dg)
    const dP = positionGeometry.toVarying("dmP")
    const dome = new THREE.Mesh(dg, mat(vec4(fogCol(normalize(dP.sub(S.uCam)) as V3), 40), undefined, { side: THREE.BackSide }))
    dome.frustumCulled = false
    dome.renderOrder = -1
    sea.add(dome)
  }

  const KEEP_A = { blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }
  const ADD: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, ...KEEP_A }
  const OVER: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, ...KEEP_A }
  const quad = () => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    geos.push(g)
    return g
  }
  const billboard = (c: THREE.Node, r: THREE.Node) => {
    const vc = cameraViewMatrix.mul(vec4(c as V3, 1))
    return cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(r as F)), vc.z, vc.w))
  }

  // ---- silt in the water: a box of specks that follows the lens and drifts with the current
  {
    const R = rng(88)
    const g = quad()
    const aP = new Float32Array(NSILT * 4)
    for (let i = 0; i < NSILT * 4; i++) aP[i] = R()
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    g.instanceCount = NSILT
    const a = attribute("aP", "vec4")
    const BOX = vec3(6, 1.5, 6)
    const drift = vec3(0.05, 0.003, 0.014).mul(S.uT).mul(a.w.mul(0.8).add(0.6)).add(vec3(sin(S.uT.mul(0.7).add(a.w.mul(40))), cos(S.uT.mul(0.5).add(a.w.mul(31))), 0).mul(0.012))
    const rel = a.xyz.mul(BOX).add(drift).sub(S.uCam)
    const c = rel.sub(floor(rel.div(BOX)).mul(BOX)).sub(BOX.mul(0.5)).add(S.uCam).toVar()
    const dist = length(c.sub(S.uCam))
    const size = fract(a.w.mul(7.3)).mul(fract(a.w.mul(7.3))).mul(0.0035).add(0.0012).mul(float(1).add(S.uSilt))
    const rw = max(size.add(abs(dist.sub(S.uFocus)).mul(0.011)), dist.mul(1.3).div(S.uPx))
    const li = lightAt(c as V3)
    const fade = smoothstep(0.07, 0.3, dist).mul(fall(2.0, 3.0, dist)).mul(step(c.y, SURF)).mul(step(floorHN(c.xz as V2), c.y))
    const vC = vec3(0.6, 0.8, 0.72).mul(li.mul(0.55).add(0.25)).mul(sq(size.div(rw) as F)).mul(fade).mul(float(0.5).add(S.uSilt.mul(2))).toVarying("stC")
    const vQ = positionGeometry.xy.toVarying("stQ")
    const m = new THREE.Mesh(g, mat(vec4(vC.mul(max(exp(dot(vQ, vQ).mul(-3)).sub(0.05), 0)), 0), billboard(c, rw), ADD))
    m.frustumCulled = false
    m.renderOrder = 5
    sea.add(m)
  }

  // ---- bubbles: strings of them leaving the mats, on loops; and a burst when the first tag is let go
  {
    const R = rng(4404)
    const g = quad()
    const aB = new Float32Array(NBUB * 4)
    const aC = new Float32Array(NBUB * 4)
    let n = 0
    const put = (x: number, y: number, z: number, ph: number, per: number, size: number, ev: number) => {
      if (n >= NBUB) return
      aB.set([x, y, z, ph], n * 4)
      aC.set([per, size, R(), ev], n * 4)
      n++
    }
    // vents: a few mounds let go a string of bubbles every few seconds
    const vents = MOUNDS.map((m, i) => i).filter((i) => !MOUNDS[i].sat && ((i * 7) % 3 === 0 || i < 6))
    for (const vi of vents) {
      const m = MOUNDS[vi]
      const a = R() * 6.28
      const x = m.x + Math.cos(a) * m.r * 0.3
      const z = m.z + Math.sin(a) * m.r * 0.3
      const per = 5 + R() * 5
      const ph = R()
      const k = 3 + Math.floor(R() * 5)
      for (let j = 0; j < k; j++) put(x, floorH(m.x, m.z) + m.h * 0.85, z, ph + j * 0.022 + R() * 0.006, per, 0.004 + 0.007 * R() * R(), -1)
    }
    // the burst, from the first tagged mound
    while (n < NBUB) {
      const m = MOUNDS[TAGS[0].m]
      const a = R() * 6.28
      const rr = Math.sqrt(R()) * m.r * 0.8
      put(m.x + Math.cos(a) * rr, floorH(m.x, m.z) + m.h * (0.35 + 0.6 * (1 - (rr / m.r) ** 2)), m.z + Math.sin(a) * rr, R() * 0.5, 1, 0.004 + 0.012 * R() * R(), 0)
    }
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(aB, 4))
    g.setAttribute("aC", new THREE.InstancedBufferAttribute(aC, 4))
    g.instanceCount = NBUB
    const b = attribute("aB", "vec4")
    const cc = attribute("aC", "vec4")
    const loop = fract(S.uT.div(cc.x).add(b.w)).mul(cc.x)
    const tau = select(cc.w.lessThan(-0.5), loop, S.uEv.x.sub(b.w)).toVar()
    // small bubbles rise slowly and wander; big ones go straight up and fast
    const sp = cc.y.mul(22).add(0.16)
    // a vent's bubble sits on the mat and swells for a while before it lets go
    const held = select(cc.w.lessThan(-0.5), float(GROW), float(0))
    const swell = select(cc.w.lessThan(-0.5), smoothstep(0, GROW, tau).mul(0.75).add(0.25), float(1))
    const tr = max(tau.sub(held), 0)
    const yy = b.y.add(tr.mul(sp))
    const wob = vec2(sin(tr.mul(7).add(cc.z.mul(40))), cos(tr.mul(5.3).add(cc.z.mul(17)))).mul(0.014).mul(smoothstep(0, 0.6, tr))
    const c = vec3(b.x.add(wob.x).add(tr.mul(0.035)), yy, b.z.add(wob.y)).toVar()
    const on = step(0, tau).mul(step(yy, SURF - 0.01)).mul(smoothstep(0, 0.15, tau))
    const dist = length(c.sub(S.uCam))
    const rw = max(cc.y.mul(tr.mul(0.12).add(1)).mul(swell), dist.mul(1.4).div(S.uPx)).mul(on)
    const vQ = positionGeometry.xy.toVarying("bbQ")
    const vF = vec2(exp(dist.mul(-0.16)), lightAt(c as V3)).toVarying("bbF")
    const frag = Fn(() => {
      const r = length(vQ)
      const rim = smoothstep(0.55, 0.95, r).mul(fall(0.95, 1, r))
      const spec = exp(dot(vQ.sub(vec2(-0.28, 0.5)), vQ.sub(vec2(-0.28, 0.5))).mul(-16))
      const a = clampN(rim.mul(0.75).add(spec).add(0.05), 0, 1).mul(fall(0.97, 1, r)).mul(vF.x)
      const col = vec3(0.55, 0.85, 0.8).mul(rim).mul(vF.y.mul(0.4).add(0.6)).add(vec3(1.3, 1.35, 1.2).mul(spec))
      return vec4(col.mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(frag, billboard(c, rw), OVER))
    m.frustumCulled = false
    m.renderOrder = 6
    sea.add(m)
  }

  // ---- soft sediment: it puffs where a string drags off its mound or the card's stakes go in, and drifts down-current
  const puffAt = [0, 1, 2].map((i) => new THREE.Vector3(tagA[i].x + 0.06, tagA[i].y - MOUNDS[TAG_MOUND[i]].h * 0.55, tagA[i].z + 0.08))
  puffAt.push(new THREE.Vector3(CARD_P[0], floorH(CARD_P[0], CARD_P[2]) + 0.03, CARD_P[2]))
  const uPuff = uniformArray(puffAt, "vec3")
  {
    const R = rng(3700)
    const g = quad()
    const NP = 22
    const aP = new Float32Array(NP * 4 * 4)
    const aE = new Float32Array(NP * 4)
    for (let i = 0; i < NP * 4; i++) {
      aP.set([R(), R(), R(), R()], i * 4)
      aE[i] = Math.floor(i / NP)
    }
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    g.setAttribute("aE", new THREE.InstancedBufferAttribute(aE, 1))
    g.instanceCount = NP * 4
    const a = attribute("aP", "vec4")
    const e = attribute("aE", "float")
    const ei = e.add(0.5).toInt()
    const o = uPuff.element(ei) as unknown as V3
    const tev = select(e.lessThan(0.5), S.uEv.x, select(e.lessThan(1.5), S.uEv.y, select(e.lessThan(2.5), S.uEv.z, S.uCard.sub(0.45))))
    const tau = max(tev.sub(a.w.mul(0.25)), 0)
    const an = a.x.mul(6.2832)
    const out = float(1).sub(exp(tau.mul(-1.6))).mul(a.y.mul(0.45).add(0.2))
    // up and out fast, then it hangs, sinks and goes with the current
    const c = vec3(o.x.add(cos(an).mul(out)).add(tau.mul(0.05)), o.y.add(out.mul(a.z.mul(0.8))).sub(tau.mul(0.012)), o.z.add(sin(an).mul(out)).add(tau.mul(0.011)))
    const al = step(0.001, tau).mul(exp(tau.mul(-0.7))).mul(smoothstep(0, 0.25, tau)).mul(0.17)
    // (a puff that has faded is not drawn at all: eighty soft quads over the lens cost more than the whole floor)
    const rw = min(tau.mul(0.05).add(0.04).add(out.mul(0.18)), 0.32).mul(step(0.004, al))
    const vQ = positionGeometry.xy.toVarying("pfQ")
    const vA = vec3(al, lightAt(c as V3), a.z).toVarying("pfA")
    const frag = Fn(() => {
      const d = dot(vQ, vQ)
      const n = vnoise(vQ.mul(2.3).add(vA.z.mul(40)))
      const k = max(exp(d.mul(-2.6)).sub(0.07), 0).mul(n.mul(0.8).add(0.5)).mul(vA.x)
      return vec4(vec3(0.42, 0.42, 0.33).mul(vA.y.mul(0.5).add(0.5)).mul(k), k)
    })()
    const m = new THREE.Mesh(g, mat(frag, billboard(c, rw), OVER))
    m.frustumCulled = false
    m.renderOrder = 4
    sea.add(m)
  }

  // ---- filaments: fine hairs standing off the mats, streaming in the current. Drawn only as wide as a pixel allows.
  {
    const R = rng(1616)
    const SEGS = 3
    const pos: number[] = []
    const idx: number[] = []
    for (let k = 0; k <= SEGS; k++) pos.push(-1, k / SEGS, 0, 1, k / SEGS, 0)
    for (let k = 0; k < SEGS; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2)
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const hm: number[] = []
    const hn: number[] = []
    const hq: number[] = []
    let n = 0
    MOUNDS.forEach((m) => {
      // (only where the lens goes near enough to see them)
      const near = Math.min(Math.hypot(m.x - PB[0], m.z - PB[2]), Math.hypot(m.x - PD[0], m.z - PD[2]), Math.hypot(m.x - PC[0], m.z - PC[2]), Math.hypot(m.x, m.z - 2))
      if (near > 3.4) return
      const cnt = Math.round(Math.min(900 * m.r * m.r + 40, 260) * (near < 1.6 ? 1.6 : 1))
      for (let i = 0; i < cnt; i++) {
        const rr = Math.sqrt(R()) * 0.93
        const th = R() * 6.2832
        hm.push(m.x, m.z, m.r, m.h)
        hn.push(m.seed, m.cone, m.rot, m.cut)
        hq.push(Math.cos(th) * rr, Math.sin(th) * rr, R(), R())
        n++
      }
    })
    g.setAttribute("aM", new THREE.InstancedBufferAttribute(new Float32Array(hm), 4))
    g.setAttribute("aN", new THREE.InstancedBufferAttribute(new Float32Array(hn), 4))
    g.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(hq), 4))
    g.instanceCount = n
    geos.push(g)
    const hA = attribute("aH", "vec4")
    const sf = moundSurf(hA.xy as V2, attribute("aM", "vec4") as V4, attribute("aN", "vec4") as V4)
    const root = sf.wp.toVar()
    const along = positionGeometry.y
    const len = hA.z.mul(0.026).add(0.012)
    // the current bends them over, and gusts of it run across the mat
    const gust = sin(S.uT.mul(1.7).sub(root.x.mul(5)).add(root.z.mul(2)).add(hA.w.mul(3))).mul(0.5).add(0.5)
    const lean = vec3(1, 0, 0.22).mul(gust.mul(0.7).add(0.35)).mul(along).add(vec3(0, 0, sin(S.uT.mul(2.9).add(hA.w.mul(40))).mul(0.12)).mul(along))
    const dirH = normalize(sf.nw.add(lean))
    const tip = root.add(dirH.mul(len).mul(along)).toVar()
    const distH = length(tip.sub(S.uCam))
    const pxw = distH.div(S.uPx)
    const wd = max(float(0.0007).mul(float(1).sub(along.mul(0.7))), pxw.mul(0.6))
    const side = normalize(dirH.cross(tip.sub(S.uCam)))
    const hwp = tip.add(side.mul(wd).mul(positionGeometry.x))
    // thinner than a pixel: it fades instead of shimmering; on the broken face there are none
    const cover = clampN(float(0.0007).div(pxw.mul(0.6)), 0, 1).mul(sf.isCut.oneMinus()).mul(fall(2.6, 3.6, distH))
    const li = lightAt(root as V3)
    const T = exp(SIG.mul(distH).negate())
    const hc = mixN(vec3(0.03, 0.07, 0.025), vec3(0.2, 0.36, 0.12), along).mul(li.mul(1.3).add(0.4)).mul(T).add(vec3(0.03, 0.2, 0.2).mul(T.oneMinus()))
    const vC = vec4(hc.mul(cover), cover.mul(0.9)).toVarying("hrC")
    const m = new THREE.Mesh(g, mat(vec4(vC.rgb, vC.a), viewProj.mul(vec4(hwp, 1)), { ...OVER, side: THREE.DoubleSide }))
    m.frustumCulled = false
    m.renderOrder = 3
    sea.add(m)
  }

  // ---- the tags: buoyant card on cotton string, streaming in the current
  const tagMeshes: THREE.Mesh[] = []
  const texs: THREE.Texture[] = [matTex]
  {
    const TW = 820
    TAGS.forEach((tg, i) => {
      // print big enough to read from across the floor: the place, and the number or the two numbers. Nothing else.
      const rows = tg.vs.length > 1 ? [tg.vs[0], `to ${tg.vs[1]}`] : [tg.vs[0] ?? ""]
      const TH = rows.length > 1 ? 590 : 420
      TAG_ASP[i] = TH / TW
      const tex = canvasTex(TW, TH, (c) => {
        c.fillStyle = "#e9d9aa"
        c.fillRect(0, 0, TW, TH)
        const gr = c.createLinearGradient(0, 0, TW, TH)
        gr.addColorStop(0, "rgba(255,250,225,0.35)")
        gr.addColorStop(1, "rgba(150,120,60,0.18)")
        c.fillStyle = gr
        c.fillRect(0, 0, TW, TH)
        c.strokeStyle = "rgba(60,40,20,0.55)"
        c.lineWidth = 5
        c.strokeRect(150, 22, TW - 172, TH - 44)
        c.fillStyle = "#b9814a"
        c.beginPath()
        c.arc(76, TH / 2, 44, 0, 6.3)
        c.fill()
        c.fillStyle = tg.css
        c.fillRect(150, 22, 18, TH - 44)
        c.fillStyle = "#2a2118"
        c.textBaseline = "alphabetic"
        c.font = `500 ${TAG_CAP_F}px ${ctx.fonts.mono}`
        c.fillText(tg.place.toUpperCase(), 196, 118)
        c.font = `400 ${TAG_NUM_F}px ${ctx.fonts.serif}`
        rows.forEach((r, k) => c.fillText(String(r), 190, 290 + k * 170))
      })
      texs.push(tex)
      const g = new THREE.PlaneGeometry(TAG_W, TAG_W * TAG_ASP[i], 10, 1)
      geos.push(g)
      const vP = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz
      const vW = vP.toVarying(`tg${i}P`)
      const vNn = modelWorldMatrix.mul(vec4(0, 0, 1, 0)).xyz.toVarying(`tg${i}N`)
      const vUv = uvAttr().toVarying(`tg${i}U`)
      const frag = Fn(() => {
        const u = vUv.toVar()
        // clipped corners at the string end, and the hole the string goes through
        const cut = abs(u.y.sub(0.5)).sub(0.5).add(max(float(0.11).sub(u.x), 0).mul(1.9))
        Discard(cut.greaterThan(0).or(length(u.sub(vec2(0.099, 0.5)).mul(vec2(TW / TH, 1))).lessThan(0.045)))
        const alb = texture(tex).sample(u).rgb
        return seaShade(vW as V3, normalize(vNn) as V3, alb.mul(0.9) as V3, 1)
      })()
      // a card under water bellies a little
      const flut = sin(positionGeometry.x.mul(14).sub(S.uT.mul(3.1)).add(i * 2)).mul(0.008).mul(positionGeometry.x.div(TAG_W).add(0.5))
      const m = new THREE.Mesh(g, mat(frag, viewProj.mul(modelWorldMatrix.mul(vec4(positionGeometry.add(vec3(0, 0, flut)), 1))), { side: THREE.DoubleSide }))
      m.frustumCulled = false
      m.matrixAutoUpdate = false
      sea.add(m)
      tagMeshes.push(m)
    })
    // the strings: a ribbon that faces the lens, from the knot on the mound to the tag's eyelet
    const SEG = 24
    const pos: number[] = []
    const idx: number[] = []
    const tid: number[] = []
    for (let t = 0; t < 3; t++)
      for (let k = 0; k <= SEG; k++) {
        pos.push(k / SEG, -1, 0, k / SEG, 1, 0)
        tid.push(t, t)
        if (k < SEG) {
          const a = t * (SEG + 1) * 2 + k * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("aT", new THREE.Float32BufferAttribute(tid, 1))
    g.setIndex(idx)
    geos.push(g)
    const ti = attribute("aT", "float").add(0.5).toInt()
    const A = uTA.element(ti) as unknown as V3
    const Ee = uTE.element(ti) as unknown as V3
    const Cc = uTC.element(ti) as unknown as V3
    const s = positionGeometry.x
    const P = A.mul(sq(s.oneMinus() as F)).add(Cc.mul(s.mul(s.oneMinus()).mul(2))).add(Ee.mul(s.mul(s))).toVar()
    const Tn = normalize(Cc.sub(A).mul(s.oneMinus()).add(Ee.sub(Cc).mul(s)).add(vec3(0, 1e-4, 0)))
    const side = normalize(Tn.cross(P.sub(S.uCam)))
    const wd = max(float(0.0035), length(P.sub(S.uCam)).mul(1.1).div(S.uPx))
    const wp = P.add(side.mul(wd).mul(positionGeometry.y))
    const vP = wp.toVarying("srP")
    const vT = attribute("aT", "float").toVarying("srT")
    const vS = vec2(s, positionGeometry.y).toVarying("srS")
    const frag = Fn(() => {
      const colr = select(vT.lessThan(0.5), vec3(...TAGS[0].rgb), select(vT.lessThan(1.5), vec3(...TAGS[1].rgb), vec3(...TAGS[2].rgb)))
      // twisted plies
      const ply = sin(vS.x.mul(260).add(vS.y.mul(2.2))).mul(0.18).add(0.86)
      const V = normalize(S.uCam.sub(vP))
      return seaShade(vP as V3, normalize(V.add(vec3(0, 0.6, 0))) as V3, colr.mul(ply).mul(float(1).sub(sq(vS.y as F).mul(0.5))) as V3, 1)
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(wp, 1)), { side: THREE.DoubleSide }))
    m.frustumCulled = false
    sea.add(m)
  }

  // ---- the ruled card: three strings pinned along it. A knot is a date; a length is a range.
  const card = new THREE.Group()
  const cardBits: { knot: THREE.Mesh[]; line: THREE.Mesh | null }[] = []
  {
    const CW = 1280
    const CH = 520
    const tex = canvasTex(CW, CH, (c) => {
      c.fillStyle = "#f1eee2"
      c.fillRect(0, 0, CW, CH)
      c.fillStyle = "rgba(120,110,80,0.10)"
      for (let i = 0; i < 60; i++) c.fillRect(0, (i * CH) / 60, CW, 1)
      const X = (v: number) => (CARD_X(v) / CARD_W + 0.5) * CW
      // the rule along the foot: a tick every 10, a longer one every 50, the longest every 100; bare
      c.strokeStyle = "#2a2a2a"
      for (let v = Math.ceil(CARD_V[0] / 10) * 10; v <= CARD_V[1]; v += 10) {
        const len = v % 100 === 0 ? 62 : v % 50 === 0 ? 44 : 26
        c.lineWidth = v % 100 === 0 ? 4 : 2.5
        c.beginPath()
        c.moveTo(X(v), CH - 18)
        c.lineTo(X(v), CH - 18 - len)
        c.stroke()
      }
      c.lineWidth = 3
      c.beginPath()
      c.moveTo(X(CARD_V[0]), CH - 18)
      c.lineTo(X(CARD_V[1]), CH - 18)
      c.stroke()
      c.textBaseline = "alphabetic"
      TAGS.forEach((tg, i) => {
        const y = (0.5 - CARD_ROW[i] / CARD_H) * CH
        c.fillStyle = "#2a2118"
        c.font = `500 40px ${ctx.fonts.mono}`
        c.textAlign = "left"
        c.fillText(tg.place.toUpperCase(), 26, y + 12)
        // a hairline from each pin down to the rule, and its number
        c.strokeStyle = "rgba(40,40,40,0.35)"
        c.lineWidth = 1.5
        c.font = `400 74px ${ctx.fonts.serif}`
        c.textAlign = "center"
        tg.v.forEach((v, k) => {
          c.beginPath()
          c.moveTo(X(v), y + 10)
          c.lineTo(X(v), CH - 84)
          c.stroke()
          c.fillText(tg.vs[k], X(v) + (k === 0 && tg.v.length > 1 ? 34 : 0), y - 20)
        })
      })
      // the grain that started the scene, glued on at its own date
      c.fillStyle = "#2a2118"
      c.font = `400 58px ${ctx.fonts.serif}`
      c.textAlign = "right"
      c.fillText(ZIRCON_V.s, X(ZIRCON_V.v) + 26, CH - 108)
      c.font = `500 26px ${ctx.fonts.mono}`
      c.textAlign = "right"
      c.fillText(UNIT_S, CW - 22, 40)
    })
    texs.push(tex)
    const lit = (alb: THREE.Node, name: string, tx = false) => {
      const vP = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz.toVarying(name + "P")
      const vNn = modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz.toVarying(name + "N")
      const vUv = uvAttr().toVarying(name + "U")
      return mat(seaShade(vP as V3, normalize(vNn) as V3, (tx ? texture(tex).sample(vUv).rgb.mul(0.92) : alb) as V3), viewProj.mul(modelWorldMatrix.mul(vec4(positionGeometry, 1))), { side: THREE.DoubleSide })
    }
    const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
      geos.push(g)
      const o = new THREE.Mesh(g, m)
      o.frustumCulled = false
      card.add(o)
      return o
    }
    add(new THREE.BoxGeometry(CARD_W, CARD_H, 0.006), lit(vec3(1), "cd", true))
    // two stakes hold it up out of the sand
    const wood = lit(vec3(0.3, 0.24, 0.16), "sk")
    add(new THREE.CylinderGeometry(0.008, 0.008, CARD_H + 0.22, 8).translate(-CARD_W / 2 + 0.03, -0.1, -0.012), wood)
    add(new THREE.CylinderGeometry(0.008, 0.008, CARD_H + 0.22, 8).translate(CARD_W / 2 - 0.03, -0.1, -0.012), wood)
    const brass = lit(vec3(0.75, 0.55, 0.2), "br")
    TAGS.forEach((tg, i) => {
      const sm = lit(vec3(...tg.rgb), "ks" + i)
      const y = CARD_ROW[i]
      const knot = tg.v.map((v) => {
        add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 8).rotateX(Math.PI / 2).translate(CARD_X(v), y, 0.01), brass)
        const k = add(new THREE.SphereGeometry(0.011, 10, 8), sm)
        k.position.set(CARD_X(v), y, 0.014)
        // the loose end below every knot
        const tail = add(new THREE.CylinderGeometry(0.0028, 0.0028, 0.05, 6).translate(0, -0.03, 0), sm)
        k.add(tail)
        return k
      })
      let line: THREE.Mesh | null = null
      if (tg.v.length > 1) {
        // (a unit cylinder from x = 0 to 1, so its scale is its length)
        line = add(new THREE.CylinderGeometry(0.0034, 0.0034, 1, 8).rotateZ(Math.PI / 2).translate(0.5, 0, 0), sm)
        line.position.set(CARD_X(tg.v[0]), y, 0.014)
      }
      cardBits.push({ knot, line })
    })
    // the fleck of zircon
    const zf = add(new THREE.OctahedronGeometry(0.008), lit(vec3(1.0, 0.55, 0.12), "zf"))
    zf.scale.set(1.9, 1, 1)
    zf.position.set(CARD_X(ZIRCON_V.v), -CARD_H / 2 + 0.085, 0.01)
    card.position.set(CARD_P[0], floorH(CARD_P[0], CARD_P[2]) + CARD_H / 2 + 0.07, CARD_P[2])
    card.rotation.set(-0.62, CARD_YAW, 0, "YXZ")
    sea.add(card)
  }

  // ---- shafts: the same light, seen from the side in the water it crosses. Half resolution.
  const X = { tS: uniformTexture(stage.texture), tL: uniformTexture(lo.texture), uWob: uniform(1) }
  const shaft = ctx.pass(({ uv, res }) => {
    const dist = sampleRT(X.tS, uv).a
    const ndc = uv.mul(2).sub(1)
    const rd = normalize(S.uF.add(S.uR.mul(ndc.x.mul(S.uTan.x))).add(S.uU.mul(ndc.y.mul(S.uTan.y)))).toVar()
    const tmax = min(dist, 7)
    const NSTEP = 9
    // interleaved gradient noise: a different start for every pixel, the same every frame
    const px = floor(uv.mul(res))
    const j = fract(fract(px.x.mul(0.06711056).add(px.y.mul(0.00583715))).mul(52.9829189))
    const acc = vec3(0).toVar()
    Loop(NSTEP, ({ i }) => {
      const t = float(i).add(j).div(NSTEP).mul(tmax).toVar()
      const p = S.uCam.add(rd.mul(t)).toVar()
      const D = max(float(SURF).sub(p.y), 0)
      const ps = p.xz.add(vec2(SUNW.x / SUNW.y, SUNW.z / SUNW.y).mul(D)).toVar()
      // shafts come and go: a slow, large mask over the fine pattern
      const gate = smoothstep(0.42, 0.7, vnoise(ps.mul(0.9).add(S.uT.mul(0.05))))
      const c = caustic(ps as V2, S.uT as unknown as F, D.mul(0.5).add(0.25) as F)
      // the red goes first: a shaft is white-gold under the surface, green by the floor, and blue-green far off
      acc.addAssign(exp(vec3(0.75, 0.16, 0.2).mul(D.add(t.mul(0.8))).negate()).mul(max(c.sub(1.15), 0)).mul(gate).mul(step(p.y, SURF)))
    })
    const phase = pow(max(dot(rd, SUNV), 0), 3).mul(1.6).add(0.4)
    return vec4(vec3(1.0, 0.98, 0.85).mul(acc).mul(tmax.div(NSTEP)).mul(phase).mul(S.uSun).mul(3.4), 1)
  }, X)
  const comp = ctx.pass(({ uv, res, time }) => {
    // the water between the lens and everything is never quite still
    const w = vec2(sin(uv.y.mul(31).add(time.mul(1.3))), cos(uv.x.mul(27).sub(time.mul(1.1)))).mul(0.0009).mul(X.uWob)
    const c = sampleRT(X.tS, uv.add(w) as V2).rgb
    // (the march starts at a different depth in every pixel: a small tent over the low-res layer hides that)
    const tx = vec2(2.6, 0).div(res)
    const ty = vec2(0, 2.6).div(res)
    const s = sampleRT(X.tL, uv).rgb.mul(0.28).add(sampleRT(X.tL, uv.add(tx) as V2).rgb.add(sampleRT(X.tL, uv.sub(tx) as V2).rgb).add(sampleRT(X.tL, uv.add(ty) as V2).rgb).add(sampleRT(X.tL, uv.sub(ty) as V2).rgb).mul(0.12)).add(sampleRT(X.tL, uv.add(tx).add(ty) as V2).rgb.add(sampleRT(X.tL, uv.sub(tx).sub(ty) as V2).rgb).add(sampleRT(X.tL, uv.add(tx).sub(ty) as V2).rgb).add(sampleRT(X.tL, uv.sub(tx).add(ty) as V2).rgb).mul(0.06))
    const o = c.add(s.mul(0.55)).toVar()
    // a little more depth than the light alone gives: deeper shadows, fuller colour
    const l = luma(o)
    o.assign(mixN(vec3(l), o, 1.2).mul(smoothstep(-0.05, 0.6, l).mul(0.5).add(0.62)))
    return vec4(max(o, 0), 1)
  }, X)

  // ================================================================ the ride: the crystal's zones seen end-on, in log radius
  const hdr2 = ctx.target({})
  const RD = {
    tB: uniformTexture(hdr.texture),
    uZ: uniform(0), // e-folds of scale gone through
    uOpen: uniform(0), // the half-width of the opening on the sea, in frame heights
    uMix: uniform(0), // honey to teal
    uIn: uniform(0),
    uRot: uniform(0),
    uC: uniform(new THREE.Vector2()),
    uMurk: uniform(0), // the cloudy core
  }
  const ride = ctx.pass(({ uv, res }) => {
    const asp = res.x.div(res.y)
    const q0 = uv.sub(0.5).mul(vec2(asp, 1)).sub(RD.uC).toVar()
    // a section across a tetragonal prism: a square with its corners taken off by the second prism
    const gaugeS = (q: THREE.Node): F => {
      const a = abs(rot(q as V2, RD.uRot as unknown as F))
      return max(max(a.x, a.y), a.x.add(a.y).mul(0.7071 * 1.1)) as F
    }
    const sig = mixN(vec3(0.12, 0.62, 2.1), vec3(1.7, 0.3, 0.42), RD.uMix)
    const light = mixN(vec3(1.7, 1.3, 0.8), vec3(0.75, 1.65, 1.5), RD.uMix)
    const dens = float(0).toVar()
    const glint = float(0).toVar()
    const bleb = float(0).toVar()
    // three depths of the same zoning, the deeper ones hung nearer the vanishing point: walls, not wallpaper
    for (let k = 0; k < 3; k++) {
      const qk = q0.add(RD.uC.mul(k * 0.7))
      const g = gaugeS(qk)
      const w = log(max(g, 1e-4)).sub(RD.uZ).add(k * 0.41).toVar()
      const fw = fwidth(w).add(1e-4)
      const fineK = clampN(float(0.035).div(fw), 0, 1)
      const wideK = clampN(float(0.25).div(fw), 0, 1)
      const wide = mixN(float(0.5), vnoise(vec2(w.mul(1.9), k * 3.1 + 0.5)), wideK)
      const ph = w.mul(30).add(vnoise(vec2(w.mul(5.5), 2.2 + k)).mul(8))
      const fine = sin(ph).mul(0.5).add(0.5)
      dens.addAssign(wide.mul(0.75).add(fine.mul(fine).mul(wide.add(0.25)).mul(fineK)).mul(k === 0 ? 1 : 0.6))
      glint.addAssign(pow(float(1).sub(abs(cos(ph))), 8).mul(fineK).mul(wide.add(0.2)).mul(k === 0 ? 1 : 0.5))
      if (k < 2) {
        // blebs of quartz the crystal grew round: each sits in its own zone and swells past with it
        const an = atan(qk.y, qk.x)
        const cq = vec2(w.mul(2.6), an.mul(7 / 6.2832 * 2)).add(k * 13.7)
        const cell = floor(cq)
        const jit = hash22(cell).mul(0.6).add(0.2)
        const d = length(cq.sub(cell).sub(jit).mul(vec2(1, 2.2)))
        const pick = step(0.74, hash21(cell.add(5.5)))
        bleb.addAssign(fall(0.07, 0.16, d).mul(pick).mul(clampN(float(0.4).div(fw.mul(2.6)), 0, 1)))
      }
    }
    const g0 = gaugeS(q0).toVar()
    const glow = exp(g0.mul(-2.2)).mul(1.6).add(0.3)
    const col = light.mul(glow).mul(exp(sig.mul(dens).mul(-0.9))).toVar()
    col.addAssign(light.mul(glint).mul(0.22).mul(glow))
    col.addAssign(vec3(1.2, 1.25, 1.2).mul(bleb).mul(0.5).mul(glow))
    // the core: cloudy, crazed, the oldest part and the most damaged
    If(RD.uMurk.greaterThan(0.001), () => {
      const n = fbm(q0.mul(3.2).add(vec2(RD.uZ.mul(0.8), 0))).toVar()
      const cr = abs(vnoise(q0.mul(4.5).add(RD.uZ)).sub(0.5))
      const crack = fall(0.004, 0.022, cr)
      const murk = vec3(0.3, 0.115, 0.04).mul(n.mul(1.6).add(0.15)).mul(glow)
      col.assign(mixN(col, murk, RD.uMurk.mul(smoothstep(0.25, 0.75, n.add(g0.mul(0.35))).mul(0.5).add(0.5)).mul(0.92)))
      col.mulAssign(float(1).sub(crack.mul(RD.uMurk).mul(0.22)))
    })
    // the last zone opens: through it, the sea, bent at the rim
    const m = fall(RD.uOpen.mul(0.86) as unknown as F, RD.uOpen as unknown as F, g0).mul(step(0.0005, RD.uOpen))
    const band = exp(sq(g0.sub(RD.uOpen).div(RD.uOpen.mul(0.07).add(0.012)) as F).negate()).mul(step(0.0005, RD.uOpen))
    const uvb = uv.sub(q0.div(vec2(asp, 1)).mul(m.oneMinus().mul(0.5).add(band.mul(0.12))))
    const bg = sampleRT(RD.tB, clampN(uvb, 0.001, 0.999) as V2).rgb
    col.addAssign(vec3(0.8, 1.5, 1.35).mul(band).mul(1.1))
    return vec4(mixN(col, bg, max(m, RD.uIn.oneMinus())), 1)
  }, RD)

  // ---------------------------------------------------------------- this frame's numbers
  const W = { t0: 0, t1: -1, t2: -1, land: 0, selX: 0, selY: 0, selW: 0, selH: 0, flash: 0, plant: -1, macroOn: true, seaOn: false, rideOn: false, sea: 0, splash: 0, tagX: [0, 0, 0], tagY: [0, 0, 0], tagOn: [0, 0, 0] }
  const tgt = new THREE.Vector3()
  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const bx = new THREE.Vector3()
  const by = new THREE.Vector3()
  const bz = new THREE.Vector3()
  const m4 = new THREE.Matrix4()
  const UP = new THREE.Vector3(0, 1, 0)
  const CUR = new THREE.Vector3(1, 0, 0.22).normalize() // the current
  const zVerts: THREE.Vector3[] = []
  for (let i = 0; i < zHull.pos.length; i += 3) zVerts.push(new THREE.Vector3(zHull.pos[i], zHull.pos[i + 1], zHull.pos[i + 2]))
  const port: Portal = { c: [[-1, 1], [1, 1], [1, -1], [-1, -1]], a: 1, shade: 1 }
  const b1len = beats[1].dur + beats[1].hold
  const LOOK = {
    broken: new THREE.Vector3(MOUNDS[BROKEN].x - 0.1, 0.17, MOUNDS[BROKEN].z + 0.1),
    end: new THREE.Vector3(PD[0] + 0.38 * 2.4, 0.2, PD[2] - 0.925 * 2.4),
  }

  const POST: PostOpts = { tone: "agx", exposure: 1, bloom: 0.35, bloomThresh: 1.1, bloomRadius: 0.8, halation: 0.2, vignette: 0.22, ca: 0.0008, sat: 1.05, contrast: 1.08, lift: [0, 0, 0], gain: [1, 1, 1], grain: 0.02 }
  const TITLES: TitleOpts = { color: "#1b1917", delay: [0.5, 4.3, 0.4], maxLine: 30, subs: beats.map((b, i) => (b.sub ? wrap(b.sub, i === 2 ? 36 : 46) : undefined)) }
  const HUD = { color: "#1b1917" }

  // when the ride crosses each whole e-fold (for the pings)
  const zoneT = [1, 2, 3, 4, 5].map((n) => {
    let a = RIDE.in0
    let b = RIDE.end
    for (let i = 0; i < 30; i++) {
      const mid = (a + b) / 2
      if (rideZ(mid) < n) a = mid
      else b = mid
    }
    return a
  })
  const blip = rng(77)
  const cues: Cue[] = [
    { b: 0, at: 0, s: "glass", o: { f: H(48), g: 0.5 } },
    { b: 0, at: 1.2, s: "tick", o: { f: 1500, g: 0.35 } },
    { b: 0, at: 2.1, s: "glass", o: { f: H(40), g: 0.22, pan: 0.3 } },
    { b: 0, at: 3.0, s: "glass", o: { f: H(54), g: 0.18, pan: 0.2 } },
    { b: 0, at: RV.sel, s: "select" },
    ...typeCues(0, RV.say + 0.25, RV.say + 0.25 + SAY.length / CPS, SAY.length, "type"),
    { b: 0, at: 5.6, s: "glass", o: { f: H(60), g: 0.16, pan: 0.4 } },
    // through the facet: a rush that is all low end, a ping per zone, falling
    { b: 1, at: 0.2, s: "whoosh", o: { f: 90, dur: 2.8, g: 0.9 } },
    { b: 1, at: RIDE.in0, s: "glass", o: { f: H(56), g: 0.5 } },
    ...zoneT.map((at, i): Cue => ({ b: 1, at, s: "glass", o: { f: H(44 - i * 6), g: 0.3, pan: i % 2 ? 0.4 : -0.4 } })),
    { b: 1, at: RIDE.open + 0.35, s: "boom", o: { f: 62, dur: 2.2, g: 0.5 } },
    { b: 1, at: RIDE.open + 0.4, s: "splash", o: { g: 0.8 } },
    { b: 1, at: RIDE.open + 0.5, s: "shimmer", o: { g: 0.4, dur: 2 } },
    { b: 1, at: RIDE.end, s: "pad", o: { f: H(4), dur: 8, g: 0.55 } },
    // bubbles, here and there
    ...Array.from({ length: 14 }, (_, i): Cue => ({ b: 1, at: 4.3 + i * 0.52 + blip() * 0.3, s: "marimba", o: { f: H(24 + Math.floor(blip() * 16)), g: 0.1 + 0.08 * blip(), pan: blip() * 1.6 - 0.8 } })),
    ...Array.from({ length: 12 }, (_, i): Cue => ({ b: 2, at: 0.2 + i * 0.8 + blip() * 0.4, s: "marimba", o: { f: H(24 + Math.floor(blip() * 16)), g: 0.07 + 0.06 * blip(), pan: blip() * 1.6 - 0.8 } })),
    // the tags: a string plucked taut, each a third higher, each with its own event
    ...TAG_T.flatMap((at, i): Cue[] => [
      { b: 2, at, s: "tick", o: { f: 2100 + i * 250, g: 0.5, pan: 0.5 - i * 0.3 } },
      { b: 2, at: at + 0.12, s: "pluck", o: { f: H([10, 12, 15][i]), g: 0.55, dur: 1.2, pan: 0.5 - i * 0.3 } },
    ]),
    ...Array.from({ length: 7 }, (_, i): Cue => ({ b: 2, at: TAG_T[0] + 0.05 + i * 0.06, s: "marimba", o: { f: H(30 + i * 3), g: 0.16, pan: 0.5 } })),
    { b: 2, at: TAG_T[1], s: "whoosh", o: { f: 160, dur: 0.8, g: 0.4, pan: 0.2 } },
    { b: 2, at: TAG_T[2] + 0.42, s: "pluck", o: { f: H(15), g: 0.3, dur: 0.9, pan: -0.1 } },
    { b: 2, at: CARD_T + 0.5, s: "thud", o: { f: 110, g: 0.6, pan: 0.5 } },
    { b: 2, at: CARD_T + 0.5, s: "splash", o: { g: 0.3, pos: [0.5, -0.4, 0.2] } },
    { b: 2, at: PIN_T[0], s: "tick", o: { f: 1800, g: 0.6, pan: 0.5 } },
    { b: 2, at: PIN_T[1], s: "tick", o: { f: 2000, g: 0.6, pan: 0.5 } },
    { b: 2, at: PIN_T[2], s: "scratch", o: { f: 2600, dur: 0.55, g: 1.2, pan: 0.5 } },
    { b: 2, at: PIN_T[2] + 0.6, s: "tick", o: { f: 2200, g: 0.7, pan: 0.6 } },
    { b: 2, at: PIN_T[2] + 0.62, s: "bell", o: { f: H(24), g: 0.22 } },
  ]

  function update(s: State) {
    const t0 = clamp(s.at(0), -10, 1e3)
    const t1 = s.beat >= 1 ? (s.beat > 1 ? b1len : s.t) : -1
    const t2 = s.beat >= 2 ? s.t : -1
    W.t0 = t0
    W.t1 = t1
    W.t2 = t2
    const land = Math.max(t0, 0)
    W.land = land
    const asp = s.w / s.h
    W.macroOn = t1 < RIDE.in1 + 0.05
    W.seaOn = t1 >= RIDE.sea
    W.rideOn = t1 >= RIDE.in0 && t1 < RIDE.end
    W.sea = smooth(RIDE.open, RIDE.end, t1)

    if (W.macroOn) {
      // ---- the hand-off: the grains that fell away as sand come down on the glass, the lamp strikes
      for (let i = 0; i < NG; i++) {
        const tt = t0 - 0.3 - GRAINS[i][5] // each comes down on the glass a little after the lock, as the facets turn to sand
        gy[i] = tt < 0 ? 30 * tt * tt : tt > 2 ? 0 : 0.2 * GRAINS[i][2] * Math.abs(Math.sin(tt * 9)) * Math.exp(-tt * 5)
      }
      W.flash = t0 >= 0 ? Math.exp(-land * 3.2) : 0
      M.uRing.value = t0 < 0 ? 0.55 + 0.45 * s.enter : 1 + 0.5 * W.flash
      M.uZing.value = t0 >= 0 ? Math.exp(-land * 4) * (0.5 + 0.5 * Math.cos(land * 40)) : 0

      // ---- the macro camera: a slow orbit round the crystal, pushing in; then straight at one face
      const orb = s.k(0, 0, 7, E.io2)
      const creep = clamp(t0 - 7, 0, beats[0].hold)
      const push = s.k(1, 0, RIDE.push, E.in2)
      const az = -0.62 + 1.22 * orb + 0.014 * creep + (0.012 * Math.sin(s.time * 0.31) + s.mouse.x * 0.04) * (1 - push) + 0.25 * push
      const el = mix(0.62 - 0.14 * orb + 0.008 * Math.sin(s.time * 0.23 + 1) + s.mouse.y * 0.03, 1.0, push)
      const dist = Math.exp(mix(Math.log(mix(12.5, 9.2, s.k(0, 0, 7, E.out2)) - 0.012 * creep), Math.log(0.62), push))
      tgt.set(ZC[0], ZC[1] + ZW * push, ZC[2])
      mcam.position.set(tgt.x + dist * Math.sin(az) * Math.cos(el), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(az) * Math.cos(el))
      mcam.aspect = asp
      mcam.updateProjectionMatrix()
      mcam.lookAt(tgt)
      mcam.rotation.z += 0.004 * Math.sin(s.time * 0.19) + 0.5 * push * push
      // the crystal sits right of centre: the title column stays clear
      mcam.translateX(-dist * 0.085 * (1 - push))
      mcam.translateY(dist * 0.012 * (1 - push))
      mcam.updateMatrixWorld()
      mcam.matrixWorldInverse.copy(mcam.matrixWorld).invert()
      M.uCam.value.copy(mcam.position)
      mcam.getWorldDirection(M.uFwd.value)
      // rack focus: from the nearest quartz grain to the crystal
      const rack = s.k(0, 1.2, 2.3, E.io3)
      v0.set(GRAINS[2][0], GRAINS[2][2] * 0.8, GRAINS[2][1]).sub(mcam.position)
      const fNear = v0.dot(M.uFwd.value)
      v0.copy(tgt).sub(mcam.position)
      M.uFocus.value = mix(fNear, v0.dot(M.uFwd.value), rack)
      M.uAp.value = 2.4 + 5 * push
      D.uMax.value = 0.03

      // ---- the selection box rides the crystal's own outline
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const p of zVerts) {
        v0.copy(p).project(mcam)
        x0 = Math.min(x0, v0.x)
        x1 = Math.max(x1, v0.x)
        y0 = Math.min(y0, v0.y)
        y1 = Math.max(y1, v0.y)
      }
      // the portal is the crystal's own oriented box on the frame (long axis first), for `anneal` to draw its outline in
      {
        v0.set(ZC[0] - CY * ZL, ZC[1], ZC[2] + SY * ZL).project(mcam)
        const ax0 = v0.x * asp, ay0 = v0.y
        v0.set(ZC[0] + CY * ZL, ZC[1], ZC[2] - SY * ZL).project(mcam)
        let ux = v0.x * asp - ax0, uy = v0.y - ay0
        const ul = Math.max(Math.hypot(ux, uy), 1e-4)
        ux /= ul
        uy /= ul
        const mx = ax0 + (ux * ul) / 2, my = ay0 + (uy * ul) / 2
        let L = 0, Wd = 0
        for (const p of zVerts) {
          v0.copy(p).project(mcam)
          const dx = v0.x * asp - mx, dy = v0.y - my
          L = Math.max(L, Math.abs(dx * ux + dy * uy))
          Wd = Math.max(Wd, Math.abs(-dx * uy + dy * ux))
        }
        const pc = (k: number, a: number, b: number) => {
          port.c[k][0] = (mx + ux * a * L - uy * b * Wd) / asp
          port.c[k][1] = my + uy * a * L + ux * b * Wd
        }
        pc(0, -1, 1)
        pc(1, 1, 1)
        pc(2, 1, -1)
        pc(3, -1, -1)
      }
      W.selX = (x0 * 0.5 + 0.5) * DW
      W.selY = (1 - (y1 * 0.5 + 0.5)) * DH
      W.selW = ((x1 - x0) / 2) * DW
      W.selH = ((y1 - y0) / 2) * DH
    }

    if (W.rideOn) {
      const z = rideZ(t1)
      RD.uZ.value = z
      RD.uIn.value = smooth(RIDE.in0, RIDE.in1, t1)
      const op = clamp((t1 - RIDE.open) / (RIDE.end - RIDE.open))
      RD.uOpen.value = t1 < RIDE.open ? 0 : 0.012 * Math.exp(op * op * 5.3)
      RD.uMix.value = smooth(2.6, 4.4, z)
      RD.uMurk.value = Math.exp(-(((z - 2.5) / 0.75) ** 2))
      RD.uRot.value = 0.5 + 0.16 * z
      RD.uC.value.set(0.05 * Math.sin(z * 1.1 + 0.4) * (1 - op), 0.035 * Math.sin(z * 0.8 + 2) * (1 - op))
    }

    if (W.seaOn) {
      S.uT.value = s.time
      // ---- the glide: in over the sand, banking past the broken dome; then right, along the tagged mounds; then down to the card
      const g1 = s.k(1, RIDE.sea, 8, E.out3)
      const creep1 = clamp(t1 - 8, 0, beats[1].hold)
      const ga = s.k(2, 0, 3.7, E.io2)
      const gb = s.k(2, 3.3, 6, E.io3)
      const creep2 = Math.max(t2 - 6, 0)
      const px = mix(mix(mix(PA[0], PB[0], g1), PC[0], ga), PD[0], gb)
      const py = mix(mix(mix(PA[1], PB[1], g1), PC[1], ga), PD[1], gb)
      const pz = mix(mix(mix(PA[2], PB[2], g1), PC[2], ga), PD[2], gb)
      scam.position.set(px - 0.012 * creep1 + 0.012 * Math.sin(s.time * 0.33) + 0.004 * creep2, py + 0.01 * Math.sin(s.time * 0.41 + 1) - 0.002 * creep2, pz - 0.035 * creep1 - 0.012 * creep2)
      // what it looks at: the broken dome, then each tag as it is let go, then card and tags together
      v0.copy(LOOK.broken)
      v0.x += 0.5 * (1 - g1)
      v0.z += 0.9 * (1 - g1)
      for (let i = 0; i < 3; i++) {
        const k = s.k(2, i === 0 ? 0 : TAG_T[i] - 0.75, TAG_T[i] - 0.05, E.io2)
        v1.copy(tagA[i]).addScaledVector(UP, TAG_L[i] * 0.75).addScaledVector(CUR, 0.12)
        v0.lerp(v1, k)
      }
      v0.lerp(LOOK.end, gb)
      scam.aspect = asp
      scam.updateProjectionMatrix()
      scam.lookAt(v0.x + s.mouse.x * 0.05, v0.y + s.mouse.y * 0.03, v0.z)
      // it banks into the turns
      scam.rotation.z += 0.006 * Math.sin(s.time * 0.27) - 0.05 * Math.sin(g1 * Math.PI) * (1 - g1) + 0.035 * Math.sin(ga * Math.PI)
      scam.updateMatrixWorld()
      scam.matrixWorldInverse.copy(scam.matrixWorld).invert()
      S.uCam.value.copy(scam.position)
      scam.matrixWorld.extractBasis(S.uR.value, S.uU.value, bz)
      S.uF.value.copy(bz).negate()
      const th = Math.tan((FOV_S * Math.PI) / 360)
      S.uTan.value.set(th * asp, th)
      S.uPx.value = s.h / (2 * th)
      S.uSilt.value = s.exit
      S.uFocus.value = scam.position.distanceTo(v0)
      W.splash = Math.exp(-Math.max(t1 - RIDE.end + 0.3, 0) * 1.6)
      S.uSun.value = 1 + 0.8 * W.splash

      // ---- the tags: let go one by one, each on a string that pays out, overshoots and rings
      for (let i = 0; i < 3; i++) {
        const tl = t2 - TAG_T[i]
        const on = tl > 0
        const ring = i === 2 ? Math.exp(-tl * 2.2) * Math.cos(tl * 9) : Math.exp(-tl * 4.5) * Math.cos(tl * 11)
        const L = on ? TAG_L[i] * (1 - ring) : 0
        const sway = 0.1 * Math.sin(s.time * 0.8 + i * 2.1) + 0.05 * Math.sin(s.time * 1.9 + i) + (on ? 0.5 * Math.exp(-tl * 2.5) * Math.sin(tl * 7) : 0) + 0.5 * s.exit
        const th2 = 0.42 + sway
        v1.copy(UP).multiplyScalar(Math.cos(th2)).addScaledVector(CUR, Math.sin(th2))
        v1.z += 0.12 * Math.sin(s.time * 0.6 + i * 1.3)
        v1.normalize()
        tagE[i].copy(tagA[i]).addScaledVector(v1, L)
        tagC[i].copy(tagA[i]).addScaledVector(UP, L * 0.6)
        // the card streams from its eyelet, down-current, and nods
        bx.copy(CUR).addScaledVector(UP, 0.2 + 0.1 * Math.sin(s.time * 1.3 + i * 1.7) + 0.5 * sway)
        bx.z -= 0.25 // (turned a little to face the lens)
        bx.normalize()
        bz.set(0, 0, 1).addScaledVector(bx, -bx.z).normalize()
        by.crossVectors(bz, bx)
        // the print keeps its size floor however far the tag is
        const glyph = TAG_W / 820
        const fl = Math.max(labelFloor(tagE[i], glyph * TAG_NUM_F * 0.66, scam, LABEL_MIN.number), labelFloor(tagE[i], glyph * TAG_CAP_F * 0.7, scam, LABEL_MIN.caption))
        const pop = (on ? E.outBack(clamp(tl / 0.35)) : 0) * fl
        m4.makeBasis(bx, by, bz).scale(v2.set(pop, pop, pop))
        v2.copy(tagE[i]).addScaledVector(bx, TAG_W * 0.401 * pop)
        m4.setPosition(v2)
        tagMeshes[i].matrix.copy(m4)
        tagMeshes[i].matrixWorld.copy(m4)
        tagMeshes[i].visible = on
        v2.copy(tagE[i]).addScaledVector(bx, TAG_W * 0.1 * pop).addScaledVector(by, TAG_W * TAG_ASP[i] * 0.5 * pop + 0.02).project(scam)
        W.tagX[i] = (v2.x * 0.5 + 0.5) * DW
        W.tagY[i] = (1 - (v2.y * 0.5 + 0.5)) * DH
        W.tagOn[i] = on && v2.z < 1 ? 1 : 0
      }
      S.uEv.value.set(t2 - TAG_T[0], t2 - TAG_T[1], t2 - TAG_T[2])
      // ---- the card comes down out of the top of the frame and is pushed into the sand; then knots, then the one length of string
      const plant = t2 - CARD_T
      card.visible = plant > 0
      const pk = clamp(plant / 0.5)
      const set = plant > 0.5 ? 0.02 * Math.exp(-(plant - 0.5) * 9) * Math.cos((plant - 0.5) * 30) : 0
      card.position.y = floorH(CARD_P[0], CARD_P[2]) + (CARD_H / 2) * card.scale.x + 0.07 + 0.7 * (1 - pk) * (1 - pk) + set
      card.rotation.x = -0.62 + 0.5 * (1 - E.out3(pk)) + set * 4
      card.scale.setScalar(Math.max(labelFloor(card.position, (CARD_H / 520) * 74 * 0.66, scam, LABEL_MIN.number), labelFloor(card.position, (CARD_H / 520) * 40 * 0.7, scam, LABEL_MIN.caption)))
      S.uCard.value = plant
      W.plant = plant
      cardBits.forEach((cb, i) => {
        const tl = t2 - PIN_T[i]
        cb.knot.forEach((k, j) => {
          const kk = E.outBack(clamp((tl - (j ? 0.55 : 0)) / 0.25))
          k.scale.setScalar(Math.max(kk, 1e-3))
        })
        if (cb.line) {
          // (the string is drawn out along the rule)
          const len = CARD_X(TAGS[i].v[1]) - CARD_X(TAGS[i].v[0])
          cb.line.scale.set(Math.max(len * E.io2(clamp((tl - 0.05) / 0.55)), 1e-4), 1, 1)
        }
      })
    }

    if (s.live) {
      ctx.synth.bed("air", 0.25 * (1 - W.sea))
      ctx.synth.bed("hum", 0.5 * (W.rideOn ? 1 - W.sea : 0))
      ctx.synth.bed("water", W.sea * (0.75 + 0.25 * s.exit))
    }
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: macro, camera: mcam, target: stage },
      { pass: dof, target: hdr },
      { scene: sea, camera: scam, target: stage },
      { pass: shaft, target: lo },
      { pass: comp, target: hdr },
      { pass: ride, target: hdr2 },
    ],

    render() {
      const r = ctx.renderer
      if (W.macroOn) {
        r.setRenderTarget(stage)
        r.render(macro, mcam)
        D.tS.value = stage.texture
        dof.render(hdr)
      } else if (W.seaOn) {
        r.setRenderTarget(stage)
        r.render(sea, scam)
        X.tS.value = stage.texture
        shaft.render(lo)
        X.tL.value = lo.texture
        comp.render(hdr)
      }
      const k = W.sea
      POST.exposure = mix(1 + 0.25 * W.flash, 1.05 + 0.5 * W.splash, k)
      POST.bloom = mix(0.35, 0.5 + 0.5 * W.splash, k)
      POST.bloomThresh = mix(1.1, 0.95, k)
      POST.vignette = mix(0.22, 0.3, k)
      POST.contrast = mix(1.08, 1.1, k)
      POST.sat = mix(1.05, 1.12, k)
      POST.ca = mix(0.0008, 0.0014, k) + (W.rideOn ? 0.004 * (1 - k) * RD.uIn.value : 0)
      POST.grain = mix(0.02, 0.026, k)
      if (W.rideOn) {
        RD.tB.value = hdr.texture
        ride.render(hdr2)
        ctx.finish(hdr2.texture, POST)
      } else ctx.finish(hdr.texture, POST)
    },

    type(g, s) {
      const wet = s.beat > 0 && (s.beat > 1 || s.t > 0.4)
      TITLES.color = wet ? "#ffffff" : "#1b1917"
      TITLES.shadow = wet ? "rgba(0,30,34,0.75)" : undefined
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 0) {
        const on = s.k(0, RV.sel, RV.sel + 0.3, E.lin)
        if (on > 0) {
          const pop = mix(1.5, 1, E.outBack(s.k(0, RV.sel, RV.sel + 0.34, E.lin)))
          const pad = 16
          const w = (W.selW + pad * 2) * pop
          const h = (W.selH + pad * 2) * pop
          const cx = W.selX + W.selW / 2
          const cy = W.selY + W.selH / 2
          g.selbox(cx - w / 2, cy - h / 2, w, h, on, SELECT)
          const t = W.t0
          comment(g, SAY, cx + w / 2 - 30, cy - h / 2 - 6, t > RV.out ? RV.out + (t - RV.out) * 2 : t, { t0: RV.say, out: RV.out, cps: CPS, side: "left" })
        }
      }
      if (s.beat === 2) {
        // each claim is typed beside its tag as the tag is let go, and rides with it
        TAGS.forEach((tg, i) => {
          if (!W.tagOn[i]) return
          const p = s.k(2, TAG_T[i] + 0.2, TAG_T[i] + 1.0, E.lin)
          // the tag carries the place and the number; the status of the claim is typed over it as it lands
          g.text(tg.status, W.tagX[i], W.tagY[i] - 10, { size: 24, font: "mono", weight: 500, color: TAG_CSS[i], style: "type", by: "glyph", p, caret: p < 1, shadow: { color: "rgba(0,25,30,0.95)", blur: 10 } })
        })
      }
    },

    hud: (s: State) => {
      HUD.color = s.beat > 0 && (s.beat > 1 || s.t > 0.4) ? "#ffffff" : "#1b1917"
      return HUD
    },
    portal: (s: State) => (s.beat === 0 && s.enter < 1 ? port : null),

    dispose() {
      disposeTree(macro)
      disposeTree(sea)
      for (const g of geos) g.dispose()
      for (const t of texs) t.dispose()
    },
  }
}
