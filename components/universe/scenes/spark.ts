// Scene 12, spark: "Someone hits one stone with another." The first scene of the Stone Age.
//
// Idea. Hands making a tool, and the first fire it lights: a core flaked on a hide pad, a hand-axe
// shaped on both faces and turned in the last sun, then pyrite struck with flint over tinder.
//
// Story parameter. `strikes`: how many flakes have left the stone (seven off the core, twelve off
// the biface, one running count that orders the scatter), then `fire` 0..1. One clock,
// `uClock = beat * 100 + t`, places every flake, puff of dust, spark and flame in closed form.
//
// World rule (TSL `lit`). One key light, a low sun the colour of the ember that crossed the cut
// and then the fire; a cool fill; and one list of sphere occluders (the hammerstone, both hands,
// the stone, the people by the hearth) that every surface tests its ray to the key against. There
// is no fire and no spark before the pyrite is struck in beat 3: knapping is cold.
//
// Stone. A worked stone is its unworked shape minus spheres: every flake scar is the inside of a
// sphere through the point of percussion (a conchoid is close to one near the bulb). The vertex
// stage pulls each vertex in to the nearest active sphere along its ray from the centre and the
// fragment stage repeats the test per pixel, so arrises are exact intersections and each scar
// knows its own point of percussion (ripples, the hollow the bulb leaves, hackles).

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, fract, fwidth, If, length, Loop, max, min, mix as mixN, modelWorldMatrix, normalGeometry, normalize, positionGeometry, pow, select, sign, sin, smoothstep, sqrt, step, uniform, uniformArray, uniformTexture, uv, vec2, vec3, vec4 } from "three/tsl"

import { featherMaterial, makeAim, makeHerd, makePress, skinMaterial, solveGrip, type Pose, type Drive, type Herd, type Lights, type Press, type Rig } from "../engine/creature"
import * as HM from "../engine/creature/hand"
import * as HU from "../engine/creature/human"
import { SPARK_BRAND, SPARK_PEOPLE } from "../engine/people"
import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash11, hash21, luma, sampleRT, vnoise, vnoise3, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { EMBER_DUR, EMBER_HIT, EMBER_LAND } from "../transitions/ember"

// ---------------------------------------------------------------- the schedule (seconds into each beat)
/** What is left of `ember` when this scene's clock starts: the card, the rule and the headline wait for it. */
const START = EMBER_DUR * (1 - EMBER_LAND)
/** Beat 1: seven flakes off the core. The first lands with the ember. */
const K0 = [0, 3.0, 4.15, 5.2, 6.15, 7.0, 7.75]
/** Beat 2: twelve shaping blows, quickening, with the piece turned over between the sixth and seventh. */
const K1 = (() => {
  const out: number[] = []
  let t = 0.5
  for (let i = 0; i < 12; i++) {
    out.push(t)
    t += mix(0.33, 0.17, i / 11) + (i === 5 ? 0.3 : 0)
  }
  return out
})()
const FLIP: [number, number] = [K1[5] + 0.07, K1[6] - 0.1]
const BLINK = 0.16 // beat 2: the stone in the hand changes under a blink
const LIFT: [number, number] = [3.7, 5.0] // beat 2: the finished piece is raised to the lens
/** Beat 3: three strikes on the pyrite; the third catches. Two breaths, then flame. */
const K2 = [1.3, 1.9, 2.45]
const BREATH = [2.75, 3.3]
const FLAME = 3.9
/** Beat 3's dur + hold (script.ts): the lens's drift ends here (transitions/torch.ts rebuilds that camera). */
const HOLD_END = 4.5 + 4.5
const NK = K0.length + K1.length

// ---------------------------------------------------------------- the place (1 unit = 10 cm)
const fr = (x: number) => x - Math.floor(x)
const h3 = (x: number, y: number, z: number) => fr(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453)
function vn3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), ux), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), ux), uy), l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), ux), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), ux), uy), uz)
}
/** The anvil: a block of basalt on the floor; the core stands on its top (Lomekwi 3 is reported as struck on anvils). */
const ANVIL_R: [number, number, number] = [1.3, 0.78, 1.05]
const ANVIL_C = new THREE.Vector3(0.1, 0.62, -0.05)
const PAD_H = 1.48 // the anvil's top, under the core
/** Height of the ground: a trodden silt floor with grit and pebbles. */
function groundH(x: number, z: number) {
  return 0.07 * vn3(x * 0.6, z * 0.6, 8.2) + 0.03 * vn3(x * 2.4, z * 2.4, 2.2)
}
const CORE_C = new THREE.Vector3(0.05, PAD_H + 0.52, 0.0)
const CORE_R: [number, number, number] = [0.8, 0.56, 0.68]
const BIF_R: [number, number, number] = [0.86, 0.2, 0.5]
const BIF_C = new THREE.Vector3(0.05, PAD_H + 0.17, 0.1)
/** Where the fire will be. */
const HEARTH = new THREE.Vector3(2.4, 0, -6.6)
const TINDER = new THREE.Vector3(HEARTH.x - 0.3, 0.22, HEARTH.z + 1.45)
const FOV = 30

/** Width and thickness profile of the hand-axe along its length (x = -1 butt .. 1 tip, in units of its half-length). */
const bifW = (x: number) => mix(1, 0.42, smooth(-0.2, 1, x))
const bifT = (x: number) => mix(1.25, 0.7, smooth(-0.6, 0.9, x))

/** The unworked shape of a stone, as a point for a direction. */
function shape(kind: "core" | "biface" | "cobble", d: THREE.Vector3, r: [number, number, number], seed: number, out: THREE.Vector3) {
  const a1 = kind === "core" ? 0.24 : kind === "biface" ? 0.07 : 0.14
  const a2 = kind === "core" ? 0.09 : 0.035
  const lump = 1 + a1 * (vn3(d.x * 2.1 + seed, d.y * 2.1, d.z * 2.1) - 0.5) + a2 * (vn3(d.x * 5.3, d.y * 5.3 + seed, d.z * 5.3) - 0.5)
  out.set(d.x * r[0], d.y * r[1], d.z * r[2]).multiplyScalar(lump)
  if (kind === "biface") {
    out.z *= bifW(d.x)
    out.y *= bifT(d.x)
  }
  if (kind === "core" && d.y > 0.35) out.y *= 1 - 0.22 * smooth(0.35, 0.95, d.y) // a flattish top: the platform
  return out
}

/** A stone as a cube-sphere of `n` cells per face edge, shaped in JS with analytic-quality normals. */
function stoneGeometry(kind: "core" | "biface" | "cobble", r: [number, number, number], seed: number, n: number) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = []
  const d = new THREE.Vector3(), p = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3()
  const at = (f: number, a: number, b: number, o: THREE.Vector3) => {
    // an equal-angle cube map: even cells
    const x = Math.tan((a * Math.PI) / 4), y = Math.tan((b * Math.PI) / 4)
    if (f === 0) o.set(1, y, -x)
    else if (f === 1) o.set(-1, y, x)
    else if (f === 2) o.set(x, 1, -y)
    else if (f === 3) o.set(x, -1, y)
    else if (f === 4) o.set(x, y, 1)
    else o.set(-x, y, -1)
    return o.normalize()
  }
  const e = 0.6 / n
  for (let f = 0; f < 6; f++) {
    const base = pos.length / 3
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 - 1, b = (j / n) * 2 - 1
        shape(kind, at(f, a, b, d), r, seed, p)
        shape(kind, at(f, a + e, b, d), r, seed, pa)
        shape(kind, at(f, a, b + e, d), r, seed, pb)
        t1.subVectors(pa, p)
        t2.subVectors(pb, p)
        t1.cross(t2).normalize()
        if (t1.dot(p) < 0) t1.negate()
        pos.push(p.x, p.y, p.z)
        nor.push(t1.x, t1.y, t1.z)
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const q = base + j * (n + 1) + i
        idx.push(q, q + 1, q + n + 1, q + 1, q + n + 2, q + n + 1)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** A flake scar: the sphere that cut it (centre, radius), its point of percussion, and where the flake sat. */
type Scar = { c: THREE.Vector4; q: THREE.Vector3; mid: THREE.Vector3; out: THREE.Vector3; down: THREE.Vector3; len: number }
/**
 * A scar as a near-flat facet: the sphere of radius R whose nearest point to `o` lies `dist` out along `n`.
 * The blow fell at the facet's `up` end, `reach` from its middle.
 */
function scar(o: THREE.Vector3, n: THREE.Vector3, dist: number, R: number, up: THREE.Vector3, reach: number): Scar {
  const c = o.clone().addScaledVector(n, dist + R)
  const tu = up.clone().addScaledVector(n, -up.dot(n)).normalize()
  const mid = o.clone().addScaledVector(n, dist)
  const q = mid.clone().addScaledVector(tu, reach)
  q.sub(c).setLength(R).add(c)
  return { c: new THREE.Vector4(c.x, c.y, c.z, R), q, mid, out: n.clone(), down: tu.clone().negate(), len: reach * 2 }
}
const ORIGIN = new THREE.Vector3()
const CORE_SCARS: Scar[] = K0.map((_, k) => {
  const ph = 0.95 - k * 0.2 - (k % 2) * 0.05
  const el = -0.12 + 0.1 * ((k * 5) % 3)
  const n = new THREE.Vector3(Math.cos(ph) * Math.cos(el), Math.sin(el), Math.sin(ph) * Math.cos(el))
  const h = Math.hypot(n.x * CORE_R[0], n.y * CORE_R[1], n.z * CORE_R[2])
  return scar(ORIGIN, n, h - 0.1 - 0.03 * (k % 3), 2.0 + 0.5 * (k % 2), new THREE.Vector3(0, 1, 0), 0.4)
})
/** The hand-axe: twelve scars already on the far edge, six to come on the near edge from one face, six from the other. */
const BIF_SCARS: Scar[] = (() => {
  const out: Scar[] = []
  const add = (e: number, f: number, i: number, stagger: number) => {
    const x = -0.56 + ((i + stagger) / 5.5) * 1.12
    const k = Math.sqrt(Math.max(0.04, 1 - (x / BIF_R[0]) ** 2))
    const hw = BIF_R[2] * bifW(x / BIF_R[0]) * k
    const th = BIF_R[1] * bifT(x / BIF_R[0]) * k
    const beta = 0.95 + 0.14 * (((i * 7 + (f > 0 ? 0 : 3)) % 5) / 4 - 0.5)
    const n = new THREE.Vector3(0.1 * (((i * 3) % 4) - 1.5), f * Math.cos(beta), e * Math.sin(beta)).normalize()
    const h = Math.hypot(n.y * th, n.z * hw)
    // the blow fell on the edge: the facet's rim end
    out.push(scar(new THREE.Vector3(x, 0, 0), n, h - 0.022 - 0.012 * ((i * 5) % 3), 1.3 + 0.3 * (i % 2), new THREE.Vector3(0, -f * 0.2, e), 0.14))
  }
  for (let i = 0; i < 6; i++) add(-1, 1, i, 0)
  for (let i = 0; i < 6; i++) add(-1, -1, i, 0.5)
  for (let i = 0; i < 6; i++) add(1, 1, i, 0)
  for (let i = 0; i < 6; i++) add(1, -1, 5 - i, 0.5)
  return out
})()

/** Where flake `i` of the running count comes to rest: one arc down the right of the hide, the first one furthest along it. */
function restOf(i: number, R: () => number) {
  const a = -0.95 + i * 0.118
  const r = 2.25 + 0.5 * R() + (i % 3) * 0.16
  const x = 0.35 + r * Math.cos(a), z = 0.5 + r * Math.sin(a)
  return new THREE.Vector3(x, groundH(x, z), z)
}

/** One flake, unit sized: x across, z from the platform (0) to the feathered end (1), y through it (ventral down). */
function flakeGeometry() {
  const NU = 14, NV = 22
  const pos: number[] = [], nor: number[] = [], st: number[] = [], idx: number[] = []
  const hw = (v: number) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.07 + 0.93 * v) * 0.985), 0.6) * mix(0.62, 1, smooth(0, 0.55, v))
  const th = (u: number, v: number) => Math.pow(Math.max(0, 1 - u * u), 0.75) * mix(1, 0.1, Math.pow(v, 0.8))
  const P = (side: number, u: number, v: number, o: THREE.Vector3) => {
    const t = th(u, v)
    // dorsal: a ridge down the middle. ventral: the bulb of percussion swelling just under the platform
    const y = side > 0 ? t * (1 - 0.3 * Math.abs(u)) : -0.12 * t - 0.5 * Math.exp(-(((v - 0.13) / 0.12) ** 2)) * Math.exp(-((u / 0.55) ** 2)) * t
    return o.set(u * hw(v), y, v - 0.5)
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (const side of [1, -1]) {
    const base = pos.length / 3
    for (let j = 0; j <= NV; j++)
      for (let i = 0; i <= NU; i++) {
        const u = (i / NU) * 2 - 1, v = j / NV
        P(side, u, v, a)
        P(side, Math.min(1, u + 0.02), v, b).sub(P(side, Math.max(-1, u - 0.02), v, c))
        const dv = P(side, u, Math.min(1, v + 0.02), c).clone().sub(P(side, u, Math.max(0, v - 0.02), new THREE.Vector3()))
        const n = b.clone().cross(dv).normalize().multiplyScalar(-side)
        if (!(n.lengthSq() > 0.5)) n.set(0, side, 0)
        pos.push(a.x, a.y, a.z)
        nor.push(n.x, n.y, n.z)
        st.push(u, v, side)
      }
    for (let j = 0; j < NV; j++)
      for (let i = 0; i < NU; i++) {
        const q = base + j * (NU + 1) + i
        if (side > 0) idx.push(q, q + NU + 1, q + 1, q + 1, q + NU + 1, q + NU + 2)
        else idx.push(q, q + 1, q + NU + 1, q + 1, q + NU + 2, q + NU + 1)
      }
  }
  // the striking platform: the flat facet that closes the thick end
  const base = pos.length / 3
  for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * 2 - 1
    for (const side of [1, -1]) {
      P(side, u, 0, a)
      pos.push(a.x, a.y, a.z)
      nor.push(0, 0, -1)
      st.push(u, 0, 0)
    }
  }
  for (let i = 0; i < NU; i++) {
    const q = base + i * 2
    idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3)
  }
  // one interleaved buffer: with six per-instance attributes the pipeline is at WebGPU's limit of eight vertex buffers
  const g = new THREE.InstancedBufferGeometry()
  const nv = pos.length / 3
  const il = new Float32Array(nv * 9)
  for (let i = 0; i < nv; i++) il.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], st[i * 3], st[i * 3 + 1], st[i * 3 + 2]], i * 9)
  const ib = new THREE.InterleavedBuffer(il, 9)
  g.setAttribute("position", new THREE.InterleavedBufferAttribute(ib, 3, 0))
  g.setAttribute("normal", new THREE.InterleavedBufferAttribute(ib, 3, 3))
  g.setAttribute("aSt", new THREE.InterleavedBufferAttribute(ib, 3, 6))
  g.setIndex(idx)
  return g
}

// ---------------------------------------------------------------- the people (shared with hands.ts: the same three people)
//
// Built from the toolkit's figure (BUILD 5c) and macro hand (5d). One table, so scene 13 can build
// the same people: body type, the look's skin, hair and hide, seed, scale and tint. The knapper's
// hands in beats 1 to 3 are `hand.makeHand` R and L in the knapper's skin.
/** Scene units are 10 cm; the toolkit models people in metres. */
const HS = 10
/** Where each person sits round the hearth (offset from it, scene units), which way they face, and their pose. */
const SEATS: { who: number; dx: number; dz: number; pose: "seated" | "crouch" | "feed" }[] = [
  { who: 1, dx: -6.8, dz: -5.2, pose: "seated" },
  { who: 2, dx: 1.2, dz: -10.4, pose: "crouch" },
  { who: 0, dx: 6.2, dz: -4.6, pose: "feed" },
]

const XA = new THREE.Vector3(1, 0, 0), YA = new THREE.Vector3(0, 1, 0), ZA = new THREE.Vector3(0, 0, 1)
const NOCC = 12
const OCC = { hammer: 0, handR: 1, handL: 2, stone: 3, fig: 4, armR: 10, armL: 11 }
const sm01 = (x: number) => x * x * (3 - 2 * x)
const XL = new THREE.Vector3(1, 0, 0), YL = new THREE.Vector3(0, 1, 0)
/** The hammerstone's striking face in the hand's model frame: where the cobble stands out of the grip, under the fingers on the thumb side. */
const D_HAM = new THREE.Vector3(0.55, -0.75, -0.25).normalize()
const P_HAM = D_HAM.clone().multiplyScalar(1 / Math.hypot(D_HAM.x / HM.HELD.stone.r[0], D_HAM.y / HM.HELD.stone.r[1], D_HAM.z / HM.HELD.stone.r[2]))
/** The pyrite nodule: lying on the left palm and fingers with the thumb over it (hand.ts HELD.core, a strike-a-light hold). */
const PYR_R: [number, number, number] = [HM.HELD.core.r[0] * HS * 0.9, HM.HELD.core.r[1] * HS * 0.9, HM.HELD.core.r[2] * HS * 0.9]
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fc = new THREE.Vector3(), _fd = new THREE.Vector3()
/** The world axes (images of the model's x and y) of a rigid frame that takes local direction `dL` to `dW` and turns local `xL` as near to `xW` as it can. */
function frameFrom(dL: THREE.Vector3, xL: THREE.Vector3, dW: THREE.Vector3, xW: THREE.Vector3, outX: THREE.Vector3, outY: THREE.Vector3) {
  const a1 = dL, a2 = _fa.copy(xL).addScaledVector(a1, -xL.dot(a1)).normalize(), a3 = _fb.crossVectors(a1, a2)
  const b1 = dW, b2 = _fc.copy(xW).addScaledVector(b1, -xW.dot(b1)).normalize(), b3 = _fd.crossVectors(b1, b2)
  outX.set(0, 0, 0).addScaledVector(b1, a1.x).addScaledVector(b2, a2.x).addScaledVector(b3, a3.x)
  outY.set(0, 0, 0).addScaledVector(b1, a1.y).addScaledVector(b2, a2.y).addScaledVector(b3, a3.y)
}

/** The hammer arm's lift above contact (radians about the elbow) `tau` seconds from a blow: lift, drop, rebound, settle. */
function swing(tau: number, big: number) {
  const hover = 0.17
  if (tau < -0.36) return hover
  if (tau < -0.09) return mix(hover, big, E.out3((tau + 0.36) / 0.27))
  if (tau < 0) return big * (1 - E.in2((tau + 0.09) / 0.09))
  if (tau < 0.07) return 0.16 * E.out2(tau / 0.07)
  return hover + 0.05 * Math.exp(-(tau - 0.07) * 9) * Math.cos((tau - 0.07) * 26)
}
/** The blow nearest `t` in a list of times: its index and the seconds from it (negative before). */
function nearest(times: number[], t: number, o: { k: number; tau: number; done: number }) {
  let k = 0
  while (k < times.length - 1 && t > (times[k] + times[k + 1]) / 2 + 0.1) k++
  o.k = k
  o.tau = t - times[k]
  let n = 0
  for (const x of times) if (t >= x) n++
  o.done = n
  return o
}

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const hdr = ctx.target({})
  const world = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.08, 200)
  const texs: THREE.Texture[] = []
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (fragment: THREE.Node, vertex?: THREE.Node | null, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }
  // transparent layers leave the stage's alpha (the circle of confusion) alone
  const ADD: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }
  const OVER: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }

  // ================================================================ the world rule
  const occ = Array.from({ length: NOCC }, () => new THREE.Vector4(0, -50, 0, 0))
  const U = {
    uClock: uniform(0),
    uT: uniform(0),
    uCam: uniform(new THREE.Vector3()),
    uFwd: uniform(new THREE.Vector3(0, 0, -1)),
    uFocus: uniform(6),
    uAp: uniform(1),
    uSunDir: uniform(new THREE.Vector3(-0.8, 0.3, 0.2).normalize()),
    uSunCol: uniform(new THREE.Vector3(2.4, 1.3, 0.6)),
    uFirePos: uniform(HEARTH.clone().setY(0.6)),
    uFireCol: uniform(new THREE.Vector3(0, 0, 0)),
    uSky: uniform(new THREE.Vector3(0.1, 0.13, 0.18)),
    uBounce: uniform(new THREE.Vector3(0.06, 0.045, 0.035)),
    uOcc: uniformArray(occ, "vec4"),
    uDust: uniform(0), // stone dust lying under the work, 0..1
    uFire: uniform(0),
    uGlow: uniform(0), // the tinder's glow
    uFlash: uniform(new THREE.Vector4(0, 0, 0, 0)), // a spark burst as a light: where, how bright
    uFlame: uniform(0),
    uSmoke: uniform(0),
  }
  /** Circle of confusion for a world point, signed: negative in front of the focal plane. */
  const coc = (P: V3): F => {
    const d = max(dot(P.sub(U.uCam), U.uFwd), 0.1)
    return clampN(d.sub(U.uFocus).div(d).mul(U.uAp), -1, 1) as F
  }
  /**
   * The light at P on a surface with normal N: albedo `alb`, a highlight of strength `spec` and
   * tightness `gloss`. `skip` is the occluder the surface itself belongs to. Call inside an Fn.
   */
  const lit = (P: V3, N: V3, alb: V3, spec: F | number, gloss: F | number, skip = -1, wrap = 0): V3 => {
    const toF = U.uFirePos.sub(P).toVar()
    const dF = length(toF).toVar()
    const att = float(1).div(dF.mul(dF).mul(0.022).add(1)).toVar()
    const fireC = U.uFireCol.mul(att).toVar()
    const wS = luma(U.uSunCol as unknown as V3), wF = luma(fireC as V3)
    const L = normalize(U.uSunDir.mul(wS).add(toF.div(dF).mul(wF)).add(vec3(0, 1e-4, 0))).toVar()
    const tMax = select(wF.greaterThan(wS), dF, float(80))
    const sh = float(1).toVar()
    Loop(NOCC, ({ i }) => {
      const o = (U.uOcc.element(i) as unknown as V4).toVar()
      const r = select(float(i).sub(skip).abs().lessThan(0.5), float(0), o.w)
      If(r.greaterThan(0.001), () => {
        const oc = o.xyz.sub(P)
        const tc = clampN(dot(oc, L), 0, tMax)
        // further from what casts it a shadow is wider and weaker
        sh.mulAssign(mixN(float(1), smoothstep(r.mul(0.7), r.mul(1.3).add(tc.mul(0.16)), length(oc.sub(L.mul(tc)))), float(1).div(tc.mul(0.22).add(1))))
      })
    })
    // the sun only reaches the mouth of the shelter
    const key = U.uSunCol.mul(smoothstep(-13, -3.5, P.z)).add(fireC).mul(sh).toVar()
    const V = normalize(U.uCam.sub(P)).toVar()
    const ndl = dot(N, L).toVar()
    const dif = clampN(ndl.add(wrap).div(1 + wrap), 0, 1)
    const amb = mixN(U.uBounce, U.uSky, N.y.mul(0.5).add(0.5))
    const nh = clampN(dot(N, normalize(L.add(V))), 0, 1)
    const g = (typeof gloss === "number" ? float(gloss) : gloss) as F
    const sp = pow(nh, g).mul(g.add(8).div(40)).mul(spec).mul(clampN(ndl.mul(5), 0, 1))
    const fres = pow(clampN(dot(N, V), 0, 1).oneMinus(), 4)
    // a burst of sparks is a small light of its own for a few frames
    const toS = (U.uFlash.xyz as unknown as V3).sub(P)
    const sparkL = vec3(0.7, 0.26, 0.08).mul(U.uFlash.w).mul(clampN(dot(N, normalize(toS)).mul(0.6).add(0.4), 0, 1)).div(dot(toS, toS).mul(1.6).add(0.5))
    return alb.mul(key.mul(dif).add(amb).add(sparkL)).add(key.mul(sp)).add(amb.mul(fres).mul(spec).mul(0.6)) as V3
  }
  // two octaves of value noise: what a surface a few hundred pixels across can show (five were a third of the frame's cost)
  const n2 = (q: THREE.Node): F => vnoise(q as V2).mul(0.66).add(vnoise((q as V2).mul(2.13).add(7.3)).mul(0.34)) as F
  const n3 = (q: THREE.Node): F => vnoise3(q as V3).mul(0.66).add(vnoise3((q as V3).mul(2.13).add(7.3)).mul(0.34)) as F
  /** Perturb N by the screen-space gradient of a height `h` over the surface through P. */
  const bump = (P: V3, N: V3, h: F): V3 => {
    const dpx = dFdx(P), dpy = dFdy(P)
    const r1 = cross(dpy, N), r2 = cross(N, dpx)
    const det = dot(dpx, r1)
    const g = r1.mul(dFdx(h)).add(r2.mul(dFdy(h)))
    return normalize(N.mul(abs(det)).sub(g.mul(sign(det)))) as V3
  }
  const worldOf = (p: THREE.Node): V3 => modelWorldMatrix.mul(vec4(p as V3, 1)).xyz as V3
  const turn = (n: THREE.Node): V3 => normalize(modelWorldMatrix.mul(vec4(n as V3, 0)).xyz) as V3

  // ---- what the stone is made of (local position in, colour out)
  const C_FRESH = uniform(new THREE.Vector3(0.085, 0.095, 0.09)) // fine-grained grey-green lava, fresh
  const C_CORTEX = uniform(new THREE.Vector3(0.36, 0.27, 0.17)) // its weathered rind
  const freshCol = (p: V3, tone: F | number): V3 => {
    const grain = vnoise3(p.mul(24)).mul(0.3).add(0.85)
    // small pale crystals in a dark groundmass
    const cry = smoothstep(0.78, 0.9, vnoise3(p.mul(95))).mul(smoothstep(0.55, 0.2, fwidth(p.x.mul(95))))
    return C_FRESH.mul(grain).mul(tone).add(vec3(0.05, 0.05, 0.045).mul(cry)) as V3
  }
  const cortexCol = (p: V3): V3 => {
    const blot = n3(p.mul(4.2))
    const pits = smoothstep(0.58, 0.78, vnoise3(p.mul(34)))
    return C_CORTEX.mul(blot.mul(0.7).add(0.62)).mul(pits.mul(0.4).oneMinus()).add(vec3(0.05, 0.045, 0.035).mul(smoothstep(0.6, 0.9, vnoise3(p.mul(11))))) as V3
  }

  // ================================================================ worked stone
  type Stone = { mesh: THREE.Mesh; on: number[]; scars: Scar[] }
  function makeStone(kind: "core" | "biface" | "cobble", r: [number, number, number], scars: Scar[], cells: number, seed: number, skip: number, tint: [number, number, number] = [1, 1, 1], soot = false): Stone {
    const N = scars.length
    const on = new Array<number>(Math.max(1, N)).fill(0)
    const uC = uniformArray(N ? scars.map((s) => s.c) : [new THREE.Vector4(0, 99, 0, 0.1)], "vec4")
    const uQ = uniformArray(N ? scars.map((s) => s.q) : [new THREE.Vector3()], "vec3")
    const uOn = uniformArray(on, "float")
    const base = positionGeometry
    const rb = length(base).toVar()
    const bd = base.div(rb).toVar()
    const cutR = Fn(() => {
      const rr = float(rb).toVar()
      if (N)
        Loop(N, ({ i }) => {
          const c = (uC.element(i) as unknown as V4).toVar()
          const b = dot(bd, c.xyz)
          const disc = b.mul(b).sub(dot(c.xyz, c.xyz)).add(c.w.mul(c.w))
          If(disc.greaterThan(0).and(b.greaterThan(0)).and((uOn.element(i) as unknown as F).greaterThan(0.5)), () => {
            rr.assign(min(rr, b.sub(sqrt(disc))))
          })
        })
      return rr
    })()
    const local = bd.mul(cutR).toVar()
    const vL = local.toVarying()
    const vRb = rb.toVarying()
    const vN = normalGeometry.toVarying()
    const frag = Fn(() => {
      const pl = vL as V3
      const u = normalize(pl).toVar()
      const best = float(vRb).toVar()
      const second = float(1e3).toVar()
      const own = vec4(0, 0, 0, 1).toVar()
      const oq = vec4(0, 0, 0, -1).toVar()
      if (N)
        Loop(N, ({ i }) => {
          const c = (uC.element(i) as unknown as V4).toVar()
          const b = dot(u, c.xyz)
          const disc = b.mul(b).sub(dot(c.xyz, c.xyz)).add(c.w.mul(c.w))
          If(disc.greaterThan(0).and(b.greaterThan(0)).and((uOn.element(i) as unknown as F).greaterThan(0.5)), () => {
            const t = b.sub(sqrt(disc)).toVar()
            If(t.lessThan(best), () => {
              second.assign(best)
              best.assign(t)
              own.assign(c)
              oq.assign(vec4(uQ.element(i) as unknown as V3, float(i)))
            }).Else(() => {
              second.assign(min(second, t))
            })
          })
        })
      const cut = step(-0.5, oq.w).toVar()
      const Pw = worldOf(pl).toVar()
      // ---- the old surface: weathered rind (or, for a cobble, water-worn skin with a battered patch)
      const nC = normalize(vN).toVar()
      const hC = n3(pl.mul(kind === "cobble" ? 9 : 13)).mul(kind === "cobble" ? 0.012 : 0.03)
      const NC = turn(nC).toVar()
      NC.assign(bump(Pw, NC, hC as F))
      const albC = cortexCol(pl).toVar()
      const col = vec3(0).toVar()
      const N1 = vec3(NC).toVar()
      const alb = vec3(albC).toVar()
      const spec = float(kind === "cobble" ? 0.1 : 0.04).toVar()
      const gloss = float(14).toVar()
      if (kind === "cobble") {
        // a river cobble: paler, smoother, pecked white where it has been used as a hammer (its -y end)
        alb.assign(mixN(vec3(0.3, 0.27, 0.23), vec3(0.2, 0.17, 0.14), n3(pl.mul(3.1))).mul(vnoise3(pl.mul(40)).mul(0.2).add(0.9)))
        const batter = smoothstep(-0.55, -0.92, nC.y).mul(smoothstep(0.35, 0.7, vnoise3(pl.mul(46))))
        alb.assign(mixN(alb, vec3(0.5, 0.48, 0.44), batter.mul(0.75)))
      }
      if (kind === "biface") {
        // a blank struck from a bigger stone: older, duller fracture faces, with rind left toward the butt
        const rind = smoothstep(0.1, 0.3, pl.x.negate().sub(0.25).add(n3(pl.mul(3.3)).sub(0.5).mul(0.9)))
        alb.assign(mixN(freshCol(pl, 0.72).mul(vec3(1.08, 1, 0.9)), albC, rind))
        spec.assign(mixN(float(0.25), float(0.04), rind))
        gloss.assign(22)
        N1.assign(mixN(turn(nC), NC, rind.mul(0.8).add(0.2)))
      }
      alb.mulAssign(vec3(tint[0], tint[1], tint[2]))
      If(cut.greaterThan(0.5), () => {
        // ---- a flake scar: the inside of its sphere, read from its own point of percussion
        const nS = normalize(own.xyz.sub(pl)).toVar()
        const rd = pl.sub(oq.xyz).toVar()
        const d = length(rd).toVar()
        const rt = normalize(rd.sub(nS.mul(dot(rd, nS))).add(vec3(1e-5, 0, 0))).toVar()
        const wob = vnoise3(pl.mul(7)).mul(2.2)
        const ph = d.mul(88).add(wob)
        const aa = smoothstep(2.2, 0.7, fwidth(ph))
        // ripples spreading from the blow, the hollow the bulb left right under it
        const tilt = cos(ph).mul(0.035).mul(smoothstep(0.03, 0.2, d)).mul(aa).sub(smoothstep(0.17, 0.03, d).mul(0.55))
        nS.assign(normalize(nS.add(rt.mul(tilt))))
        N1.assign(turn(nS))
        const hack = smoothstep(0.55, 0.82, vnoise3(normalize(rd).mul(24))).mul(smoothstep(0.18, 0.5, d))
        const edge = smoothstep(0.03, 0.004, second.sub(best))
        const tone = hash11(oq.w.mul(7.31).add(seed)).mul(0.3).add(0.85)
        alb.assign(freshCol(pl, tone as F).mul(hack.mul(0.22).oneMinus()).add(vec3(0.1, 0.1, 0.095).mul(edge)).mul(vec3(tint[0], tint[1], tint[2])))
        // crushing on the platform edge where the hammer met it
        alb.addAssign(vec3(0.3, 0.29, 0.27).mul(smoothstep(0.07, 0.01, d)).mul(smoothstep(0.4, 0.75, vnoise3(pl.mul(120)))))
        spec.assign(0.3)
        gloss.assign(30)
      })
      if (soot) {
        // a hearth stone: blackened by soot on the face the fire licks, reddened and crazed behind the soot line
        const toH = normalize(vec3(HEARTH.x, 0.6, HEARTH.z).sub(Pw))
        const lick = smoothstep(-0.1, 0.6, dot(N1, toH)).mul(smoothstep(3.4, 1.4, length(Pw.xz.sub(vec2(HEARTH.x, HEARTH.z))))).toVar()
        const blot = vnoise3(pl.mul(9)).mul(0.5).add(0.5)
        alb.mulAssign(mixN(vec3(1, 1, 1), vec3(1.25, 0.82, 0.66), smoothstep(0, 0.4, lick).mul(0.8)))
        alb.assign(mixN(alb, vec3(0.012, 0.011, 0.011), smoothstep(0.35, 0.8, lick.mul(blot)).mul(0.95)))
        spec.mulAssign(lick.oneMinus())
      }
      // dust settles on what faces up
      alb.assign(mixN(alb, vec3(0.46, 0.44, 0.4), U.uDust.mul(clampN(N1.y, 0, 1)).mul(vnoise3(pl.mul(17)).mul(0.5).add(0.2)).mul(0.5)))
      col.assign(lit(Pw, N1 as V3, alb as V3, spec, gloss, skip))
      return vec4(col, coc(Pw))
    })()
    const m = new THREE.Mesh(stoneGeometry(kind, r, seed, cells), mat(frag, viewProj.mul(vec4(worldOf(local), 1))))
    m.name = "stone"
    m.renderOrder = -3
    m.frustumCulled = false
    world.add(m)
    return { mesh: m, on, scars }
  }
  const core = makeStone("core", CORE_R, CORE_SCARS, 44, 3.7, OCC.stone)
  const biface = makeStone("biface", BIF_R, BIF_SCARS, 48, 9.2, OCC.stone)
  // the hammerstone: the cobble the macro hand's power grip was solved round (hand.ts HELD.stone), at scene scale
  const hammer = makeStone("cobble", [HM.HELD.stone.r[0] * HS, HM.HELD.stone.r[1] * HS, HM.HELD.stone.r[2] * HS], [], 22, 1.3, OCC.hammer)
  const anvil = makeStone("cobble", ANVIL_R, [], 30, 4.4, -1, [0.62, 0.62, 0.66])
  anvil.mesh.position.copy(ANVIL_C)
  anvil.mesh.rotation.set(Math.PI + 0.04, 0.5, -0.03) // its battered face up

  // ================================================================ the ground: a silt floor, grit, pebbles, old debitage stains
  {
    const n = 200
    const pos = new Float32Array((n + 1) * (n + 1) * 3)
    const idx: number[] = []
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 - 1, b = (j / n) * 2 - 1
        const x = 4 * a + 30 * a * a * a, z = 0.5 + 4.2 * b + 30 * b * b * b
        const o = j * (n + 1) + i
        pos[o * 3] = x
        pos[o * 3 + 1] = groundH(x, z)
        pos[o * 3 + 2] = z
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const q = j * (n + 1) + i
        idx.push(q, q + n + 1, q + 1, q + 1, q + n + 1, q + n + 2)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const vP = positionGeometry.toVarying()
    const vN = normalGeometry.toVarying()
    const frag = Fn(() => {
      const P = vP as V3
      const q = P.xz as V2
      const N = normalize(vN).toVar()
      // dry silt with grit and small stones, trodden; coarser sand washed in round the anvil
      const grit = vnoise(q.mul(38)).toVar()
      const peb = smoothstep(0.7, 0.86, vnoise(q.mul(3.6).add(vnoise(q.mul(1.1)).mul(2)))).toVar()
      const sand = smoothstep(0.55, 0.75, vnoise(q.mul(70))).mul(0.35)
      const floorC = mixN(vec3(0.21, 0.17, 0.125), vec3(0.13, 0.105, 0.08), n2(q.mul(0.35))).mul(grit.mul(0.3).add(0.85)).add(vec3(0.05, 0.045, 0.04).mul(sand)).toVar()
      floorC.assign(mixN(floorC, vec3(0.24, 0.22, 0.2).mul(vnoise(q.mul(9)).mul(0.5).add(0.6)), peb))
      // charcoal and ash trodden in round the hearth
      const dH = length(q.sub(vec2(HEARTH.x, HEARTH.z)))
      floorC.assign(mixN(floorC, vec3(0.045, 0.04, 0.04), smoothstep(3.4, 1.2, dH).mul(vnoise(q.mul(4.1)).mul(0.6).add(0.3))))
      // the anvil's own dust and grit, pale, thickest at its foot
      const dA = length(q.sub(vec2(ANVIL_C.x + 0.5, ANVIL_C.z + 0.2)))
      const dust = U.uDust.mul(smoothstep(3.0, 1.0, dA)).mul(vnoise(q.mul(13)).mul(0.6).add(0.4)).add(smoothstep(1.9, 1.2, dA).mul(0.25))
      floorC.assign(mixN(floorC, vec3(0.4, 0.38, 0.34), dust.mul(0.5)))
      // a contact shadow round the anvil's foot
      floorC.mulAssign(mixN(float(0.35), float(1), smoothstep(1.05, 1.6, length(q.sub(vec2(ANVIL_C.x, ANVIL_C.z)).div(vec2(ANVIL_R[0], ANVIL_R[2]))))))
      const hF = grit.mul(0.012).add(peb.mul(0.07)).add(vnoise(q.mul(7)).mul(0.03))
      N.assign(bump(P, N as V3, hF as F))
      const c = lit(P, N as V3, floorC as V3, 0.02, 9, -1, 0.12)
      return vec4(c, coc(P))
    })()
    const ground = new THREE.Mesh(g, mat(frag))
    ground.name = "ground"
    ground.renderOrder = 2
    ground.frustumCulled = false
    world.add(ground)
  }

  // ================================================================ the shelter: a leaning back wall of bedded rock
  {
    const g = new THREE.PlaneGeometry(1, 1, 90, 40)
    const p = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) * 2, b = p.getY(i) + 0.5
      const x = HEARTH.x + a * 46
      // the wall curves round the hearth and leans out over it as it rises
      const z = HEARTH.z - 17 + a * a * 12 + b * b * 12 + 2.2 * (vn3(a * 5, b * 3.2, 4.4) - 0.5) + 0.7 * vn3(a * 17, b * 11, 1.1)
      p.setXYZ(i, x, b * 36 - 0.6, z)
    }
    g.computeVertexNormals()
    const vP = positionGeometry.toVarying()
    const vN = normalGeometry.toVarying()
    const frag = Fn(() => {
      const P = vP as V3
      const N = normalize(vN).toVar()
      // bedding: beds of unequal thickness dipping a few degrees, with recessed partings; blocky joints across them
      const yb = P.y.add(P.x.mul(0.07)).add(vnoise(P.xy.mul(0.25)).mul(0.9)).toVar()
      const bed = vnoise(vec2(yb.mul(0.85), 0.5)).toVar()
      const fb = fract(yb.mul(0.42).add(bed.mul(0.6)))
      const part = smoothstep(0.07, 0.0, min(fb, fb.oneMinus()))
      const joint = smoothstep(0.82, 0.95, vnoise(vec2(P.x.mul(0.5).add(floor(yb.mul(0.42)).mul(3.7)), yb.mul(0.08)))).mul(0.6)
      const rough = n3(P.mul(0.9)).toVar()
      const h = rough.mul(0.5).add(n2(P.xy.mul(4.2)).mul(0.07)).sub(part.mul(0.35)).sub(joint.mul(0.25))
      N.assign(bump(P, N as V3, h as F))
      const alb = mixN(vec3(0.3, 0.24, 0.18), vec3(0.19, 0.16, 0.14), bed).mul(rough.mul(0.5).add(0.72)).mul(part.mul(0.5).oneMinus()).mul(joint.mul(0.4).oneMinus()).toVar()
      // soot where fires have been before, low on the wall above the hearth
      alb.mulAssign(mixN(float(1), float(0.35), smoothstep(9, 2, length(P.xy.sub(vec2(HEARTH.x, 3)))).mul(n2(P.xy.mul(0.5)).mul(0.8).add(0.2))))
      const c = lit(P, N as V3, alb as V3, 0.03, 8)
      return vec4(c, coc(P))
    })()
    const wall = new THREE.Mesh(g, mat(frag, null, { side: THREE.DoubleSide }))
    wall.frustumCulled = false
    wall.name = "wall"
    wall.renderOrder = 4
    world.add(wall)
    // what is beyond the wall and above it: the night
    const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 16, 10), mat(Fn(() => vec4(U.uSky.mul(0.22), 1))(), null, { side: THREE.BackSide, depthWrite: false }))
    dome.frustumCulled = false
    dome.renderOrder = 6
    world.add(dome)
  }

  // ================================================================ flakes: the running count, plus what lay here before
  const OLD = 46
  const NF = NK + OLD
  const flakeRest: THREE.Vector3[] = []
  const flakeLand: number[] = []
  {
    const g = flakeGeometry()
    const R = rng(1207)
    const A = new Float32Array(NF * 4), B = new Float32Array(NF * 4), C = new Float32Array(NF * 4), D = new Float32Array(NF * 4), Q0 = new Float32Array(NF * 4), Q1 = new Float32Array(NF * 4)
    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4()
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3()
    for (let i = 0; i < NF; i++) {
      const fresh = i < NK
      const onCore = i < K0.length
      let rest: THREE.Vector3
      let p0: THREE.Vector3
      let t0 = -1000
      let size: [number, number, number]
      if (fresh) {
        const sc = onCore ? CORE_SCARS[i] : BIF_SCARS[12 + (i - K0.length)]
        const C0 = onCore ? CORE_C : BIF_C
        rest = restOf(i, R)
        p0 = sc.mid.clone().addScaledVector(sc.out, 0.03).add(C0)
        t0 = onCore ? K0[i] : 100 + K1[i - K0.length]
        size = onCore ? [0.62 + 0.2 * R(), 0.085 + 0.03 * R(), sc.len * 0.86] : [0.24 + 0.1 * R(), 0.03 + 0.012 * R(), 0.3 + 0.1 * R()]
        // on the stone: its length runs from the point of percussion down the scar, its back faces out
        Z.copy(sc.down)
        Y.copy(sc.out)
        X.crossVectors(Y, Z).normalize()
        Y.crossVectors(Z, X)
        q0.setFromRotationMatrix(m4.makeBasis(X, Y, Z))
      } else {
        // debitage from earlier work, lying round the pad and out across the floor
        const a = R() * 6.283, r = 2.0 + 5.5 * R() ** 1.4
        const x = 0.4 + r * Math.cos(a), z = 0.4 + r * Math.sin(a) * 0.8
        rest = new THREE.Vector3(x, groundH(x, z), z)
        p0 = rest
        size = [0.2 + 0.45 * R(), 0.03 + 0.05 * R(), 0.25 + 0.5 * R()]
        q0.identity()
      }
      // at rest: lying on the ground's slope, either face up, turned any way round
      const e = 0.05
      Y.set(groundH(rest.x - e, rest.z) - groundH(rest.x + e, rest.z), 2 * e, groundH(rest.x, rest.z - e) - groundH(rest.x, rest.z + e)).normalize()
      const yaw = R() * 6.283
      X.set(Math.cos(yaw), 0, Math.sin(yaw))
      X.addScaledVector(Y, -X.dot(Y)).normalize()
      Z.crossVectors(X, Y)
      if (R() < 0.45) {
        Y.negate()
        Z.negate()
      }
      q1.setFromRotationMatrix(m4.makeBasis(X, Y, Z))
      if (q0.dot(q1) < 0) q1.set(-q1.x, -q1.y, -q1.z, -q1.w)
      rest.y += size[1] * 0.5 + 0.012
      const tau = 0.32 + 0.1 * R()
      const hop = X.set(rest.x - p0.x, 0, rest.z - p0.z).normalize().multiplyScalar(0.22 + 0.2 * R())
      A.set([p0.x, p0.y, p0.z, t0], i * 4)
      B.set([rest.x - hop.x, rest.y + 0.02, rest.z - hop.z, tau], i * 4)
      C.set([rest.x, rest.y, rest.z, R()], i * 4)
      D.set([size[0], size[1], size[2], fresh ? (onCore && i < 3 ? 1 : 0) : R() < 0.4 ? 1 : 0], i * 4)
      Q0.set([q0.x, q0.y, q0.z, q0.w], i * 4)
      Q1.set([q1.x, q1.y, q1.z, q1.w], i * 4)
      if (fresh) {
        flakeRest.push(rest.clone())
        flakeLand.push(tau)
      }
    }
    for (const [name, arr] of [["aA", A], ["aB", B], ["aC", C], ["aD", D], ["aQ0", Q0], ["aQ1", Q1]] as const) g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, 4))
    g.instanceCount = NF
    const aA = attribute("aA", "vec4") as V4, aB = attribute("aB", "vec4") as V4, aC = attribute("aC", "vec4") as V4, aD = attribute("aD", "vec4") as V4
    const aQ0 = attribute("aQ0", "vec4") as V4, aQ1 = attribute("aQ1", "vec4") as V4
    const qrot = (q: V4, v: V3): V3 => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2)) as V3
    const tau = U.uClock.sub(aA.w).toVar()
    const fl = clampN(tau.div(aB.w), 0, 1).toVar()
    const hopT = clampN(tau.sub(aB.w).div(0.15), 0, 1).toVar()
    const G = 98
    // ballistic to the landing, one short hop, rest
    const tt = fl.mul(aB.w)
    const arc = tt.mul(aB.w.sub(tt)).mul(G * 0.5)
    const flight = mixN(aA.xyz, aB.xyz, fl).add(vec3(0, arc, 0))
    const hopArc = hopT.mul(hopT.oneMinus()).mul(0.15 * 0.15 * G * 0.5)
    const centre = select(tau.lessThan(aB.w), flight, mixN(aB.xyz, aC.xyz, hopT).add(vec3(0, hopArc, 0))).toVar()
    // it tumbles a whole number of turns on the way, so it arrives square to its rest
    const turns = floor(aC.w.mul(2).add(1))
    const e = clampN(tau.div(aB.w.add(0.15)), 0, 1).toVar()
    const ang = e.mul(turns).mul(Math.PI)
    const axis = normalize(vec3(aC.w.sub(0.5), 0.25, fract(aC.w.mul(7.7)).sub(0.5)))
    const qs = vec4(axis.mul(sin(ang)), cos(ang)).toVar()
    const qn = normalize(mixN(aQ0, aQ1, smoothstep(0, 1, e))).toVar()
    const q = vec4(qn.xyz.mul(qs.w).add(qs.xyz.mul(qn.w)).add(cross(qs.xyz, qn.xyz)), qs.w.mul(qn.w).sub(dot(qs.xyz, qn.xyz))).toVar()
    const st = attribute("aSt", "vec3") as V3
    // each flake its own outline: skewed and pinched by its seed
    const lp = positionGeometry.mul(vec3(aD.x, aD.y, aD.z)).add(vec3(positionGeometry.z.mul(aC.w.sub(0.5)).mul(aD.x).mul(0.5), 0, 0)).toVar()
    // before its blow a flake is still part of the stone
    const born = step(0, tau)
    const P = centre.add(qrot(q as V4, lp as V3)).toVar()
    const vP = P.toVarying()
    const vN = qrot(q as V4, normalGeometry.div(vec3(aD.x, aD.y, aD.z)) as V3).toVarying()
    const vSt = st.toVarying()
    const vK = vec4(aC.w, aD.w, aD.x, aD.z).toVarying()
    const frag = Fn(() => {
      const Pw = vP as V3
      const N = normalize(vN).toVar()
      const u = (vSt as V3).x, v = (vSt as V3).y, side = (vSt as V3).z
      const k = vK as V4
      const lp3 = vec3(u.mul(k.z), k.x.mul(9), v.mul(k.w)).toVar()
      const alb = vec3(0).toVar()
      const spec = float(0.5).toVar()
      const gloss = float(44).toVar()
      // ventral: the fracture face, ripples concentric on the point of percussion at the platform
      const d = length(vec2(u.mul(k.z).mul(0.5), v.mul(k.w)))
      const ph = d.mul(88).add(vnoise3(lp3.mul(7)).mul(2))
      const rip = cos(ph).mul(smoothstep(2.2, 0.7, fwidth(ph))).mul(smoothstep(0.03, 0.2, d))
      const fresh = freshCol(lp3 as V3, k.x.mul(0.3).add(0.85) as F)
      const ventral = step(side, -0.5)
      const dorsal = step(0.5, side)
      alb.assign(fresh)
      N.assign(normalize(N.add(normalize(dFdx(d).mul(dFdx(Pw)).add(dFdy(d).mul(dFdy(Pw))).add(vec3(1e-5))).mul(rip.mul(0.09)).mul(ventral))))
      // dorsal: rind on the first flakes off a stone, earlier scars on the rest
      If(dorsal.mul(k.y).greaterThan(0.5), () => {
        alb.assign(cortexCol(lp3 as V3))
        spec.assign(0.04)
        gloss.assign(12)
        N.assign(bump(Pw, N as V3, n3(lp3.mul(13)).mul(0.03) as F))
      })
      alb.mulAssign(mixN(float(1), float(0.86), dorsal.mul(step(0, u))))
      return vec4(lit(Pw, N as V3, alb as V3, spec, gloss), coc(Pw))
    })()
    const flakes = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(P, 1)).mul(born), { side: THREE.DoubleSide }))
    flakes.frustumCulled = false
    world.add(flakes)
  }

  // ================================================================ dust: a puff of stone powder at every blow
  const PUFF = 12
  const dustPos = Array.from({ length: NK + K2.length }, (_, i) => (i < K0.length ? new THREE.Vector4(CORE_SCARS[i].q.x + CORE_C.x, CORE_SCARS[i].q.y + CORE_C.y, CORE_SCARS[i].q.z + CORE_C.z, K0[i]) : new THREE.Vector4(0, 0, 0, -1000)))
  {
    const n = dustPos.length * PUFF
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const R = rng(77)
    const a = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) a.set([R() * 2 - 1, R(), R() * 2 - 1, R()], i * 4)
    g.setAttribute("aI", new THREE.InstancedBufferAttribute(a, 4))
    g.instanceCount = n
    const uDust = uniformArray(dustPos, "vec4")
    const aI = attribute("aI", "vec4") as V4
    const src = (uDust.element(attribute("aK", "float").add(0.5).toInt()) as unknown as V4).toVar()
    const ks = new Float32Array(n)
    for (let i = 0; i < n; i++) ks[i] = Math.floor(i / PUFF)
    g.setAttribute("aK", new THREE.InstancedBufferAttribute(ks, 1))
    const tauRaw = U.uClock.sub(src.w)
    const life = aI.w.mul(0.5).add(0.55)
    // a puff that is not in the air is not drawn at all (its quad collapses)
    const alive = step(0, tauRaw).mul(step(tauRaw, life))
    const tau = clampN(tauRaw, 0, 2).toVar()
    const x = clampN(tau.div(life), 0, 1).toVar()
    // thrown out, then hanging and sinking: drag, in closed form
    const reach = float(1).sub(exp(tau.mul(-7))).mul(aI.w.mul(0.3).add(0.25))
    const c = src.xyz.add(vec3(aI.x, aI.y.mul(0.9).add(0.15), aI.z).mul(reach)).sub(vec3(0, tau.mul(tau).mul(0.35), 0))
    const size = mixN(0.05, 0.3, pow(x, 0.5)).mul(aI.w.mul(0.6).add(0.6))
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const vQ = positionGeometry.xy.toVarying()
    const vA = x.oneMinus().mul(alive).toVarying()
    const vC = c.toVarying()
    const frag = Fn(() => {
      const q = vQ as V2
      const a = smoothstep(1, 0.1, length(q)).mul(vA as F).mul(0.2).toVar()
      const col = lit(vC as V3, normalize(U.uCam.sub(vC as V3)) as V3, vec3(0.55, 0.52, 0.47) as V3, 0, 4, -1, 1)
      return vec4(col.mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(frag, cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size)), vc.z, 1)).mul(alive), OVER))
    m.frustumCulled = false
    m.renderOrder = 30
    world.add(m)
  }

  // ================================================================ hands
  /** The key without its shadow, as plain expressions: for materials that take a `Lights`. */
  const keyOf = (P: V3) => {
    const toF = U.uFirePos.sub(P)
    const dF = length(toF)
    const fireC = U.uFireCol.div(dF.mul(dF).mul(0.022).add(1))
    const wS = luma(U.uSunCol as unknown as V3), wF = luma(fireC as V3)
    return { L: normalize(U.uSunDir.mul(wS).add(toF.div(dF).mul(wF)).add(vec3(0, 1e-4, 0))) as V3, col: U.uSunCol.mul(smoothstep(-13, -3.5, P.z)).add(fireC) as V3, tMax: select(wF.greaterThan(wS), dF, float(80)) as F }
  }
  /** The world rule as the toolkit's `Lights`: the key, the fill, and the occluders (less the surface's own). */
  const skinLights = (P: V3, skipA: number, skipB: number, pair = false): Lights => {
    const k = keyOf(P)
    return {
      key: k.L, keyCol: k.col, sky: U.uSky as unknown as V3, bounce: U.uBounce as unknown as V3,
      shadow: (p: V3) => {
        const kk = keyOf(p)
        const sh = float(1).toVar()
        Loop(NOCC, ({ i }) => {
          const o = (U.uOcc.element(i) as unknown as V4).toVar()
          const fi = float(i)
          const own = pair ? fi.sub(skipA).abs().lessThan(0.5).or(fi.sub(skipB).abs().lessThan(0.5)) : fi.greaterThan(skipA - 0.5).and(fi.lessThan(skipB + 0.5))
          const r = select(own, float(0), o.w)
          If(r.greaterThan(0.001), () => {
            const oc = o.xyz.sub(p)
            const tc = clampN(dot(oc, kk.L), 0, kk.tMax)
            sh.mulAssign(mixN(float(1), smoothstep(r.mul(0.7), r.mul(1.3).add(tc.mul(0.16)), length(oc.sub(kk.L.mul(tc)))), float(1).div(tc.mul(0.22).add(1))))
          })
        })
        return sh as F
      },
    }
  }
  // The knapper's hands: the toolkit's macro hand (hand.ts), modelled in metres, drawn at scale HS.
  // A hand is placed by its palm frame, not its elbow: `place(at, local, X, Y)` puts the model-space
  // point `local` (an anchor: the palm, the held stone) at `at`, with the fingers along X and the back
  // of the hand along Y; the wrist stays straight, so the forearm runs back along -X from the palm
  // and leaves the frame where the palm's direction says. Channels (`stone`, `cup`, `curl` ...) shape it.
  const knapper = SPARK_PEOPLE[0]
  type MHand = {
    H: HM.HandModel; herd: Herd; ch: Record<string, number>; roll: number; time: number
    elbow: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; Z: THREE.Vector3
    place(at: THREE.Vector3, local: readonly number[], X: THREE.Vector3, Y: THREE.Vector3): void
    /** re-aim about the elbow (the hand swings with the forearm) */
    orient(X: THREE.Vector3, Y: THREE.Vector3): void
    update(): void
    /** a model-space point of the posed hand, in the world (after update) */
    ride(local: readonly number[], out: THREE.Vector3): THREE.Vector3
    q: THREE.Quaternion
  }
  function macroHand(side: "R" | "L", skipA: number, skipB: number, seed: number, press?: Press, extra?: (H: HM.HandModel) => Record<string, Pose>): MHand {
    const H0 = HM.makeHand({ side, mass: 1.08 })
    const H: HM.HandModel = extra ? { ...H0, spec: { ...H0.spec, poses: { ...H0.spec.poses, ...extra(H0) } } } : H0
    const look = HM.handLook(H, { skin: knapper.look.skin, dust: 0.85, hair: 0.6, veins: 0.55, callus: side === "R" ? 0.8 : 0.5 })
    const aim = makeAim()
    const herd = makeHerd({
      spec: H.spec, count: 1, path: aim, lods: [{ detail: 1, cover: 0 }], press,
      material: (n) => {
        const m = skinMaterial(n, skinLights(n.vW, skipA, skipB, true), look)
        const skin = m.fragmentNode as unknown as V4
        // the sparks light the fingers too; alpha carries the focus
        const toS = (U.uFlash.xyz as unknown as V3).sub(n.vW)
        const sparkL = vec3(0.5, 0.17, 0.05).mul(U.uFlash.w).mul(clampN(dot(n.vN, normalize(toS)).mul(0.6).add(0.4), 0, 1)).div(dot(toS, toS).mul(1.6).add(0.15))
        m.fragmentNode = vec4(skin.rgb.add(sparkL), coc(n.vW))
        return m
      },
    })
    herd.group.traverse((o) => {
      o.renderOrder = -4
      o.frustumCulled = false
    })
    world.add(herd.group)
    const bone = herd.rig.bone("arm.2")
    const head = herd.built[0].skel.head
    const r0 = new THREE.Vector3(), u0 = new THREE.Vector3(), tmp = [0, 0, 0], e = [0, 0, 0], d = [1, 0, 0]
    const h: MHand = {
      H, herd, ch: {}, roll: 0, time: 0, q: new THREE.Quaternion(),
      elbow: new THREE.Vector3(), X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1),
      orient(X, Y) {
        h.X.copy(X).normalize()
        h.Y.copy(Y).addScaledVector(h.X, -h.Y.dot(h.X)).normalize()
        h.Z.crossVectors(h.X, h.Y)
        // the rig's frame for a heading: right = horizontal, up = right x heading; roll turns up toward right
        r0.set(-h.X.z, 0, h.X.x).normalize()
        u0.crossVectors(r0, h.X)
        h.roll = Math.atan2(h.Y.dot(r0), h.Y.dot(u0))
      },
      place(at, local, X, Y) {
        h.orient(X, Y)
        h.elbow.copy(at).addScaledVector(h.X, -local[0] * HS).addScaledVector(h.Y, -local[1] * HS).addScaledVector(h.Z, -local[2] * HS)
      },
      update() {
        e[0] = h.elbow.x
        e[1] = h.elbow.y
        e[2] = h.elbow.z
        d[0] = h.X.x
        d[1] = h.X.y
        d[2] = h.X.z
        aim.set(e, d)
        herd.update(camera, fill)
        const o = bone * 4
        h.q.set(herd.rig.q[o], herd.rig.q[o + 1], herd.rig.q[o + 2], herd.rig.q[o + 3])
      },
      ride(local, out) {
        HU.ride(herd.rig, bone, head, local as [number, number, number], HS, tmp)
        return out.set(tmp[0], tmp[1], tmp[2])
      },
    }
    const fill = (_i: number, dr: Drive) => {
      dr.dist = 0
      dr.lane = 0
      dr.rise = 0
      dr.time = h.time
      dr.scale = HS
      dr.seed = seed
      dr.look = null
      for (const k in dr.ch) dr.ch[k] = 0
      for (const k in h.ch) dr.ch[k] = h.ch[k]
      dr.roll = h.roll
    }
    return h
  }
  const pressR = makePress(), pressL = makePress()
  const handR = macroHand("R", OCC.handR, OCC.armR, knapper.seed, pressR)
  // the left hand's hold on the core, solved once: every finger closed onto the core where the palm lies on it (beat 1)
  const CORE_REACH = (() => {
    const a = new THREE.Vector3(-0.72, 0.68, 0.12).normalize()
    return 1 / Math.sqrt((a.x / CORE_R[0]) ** 2 + (a.y / CORE_R[1]) ** 2 + (a.z / CORE_R[2]) ** 2)
  })()
  const handL = macroHand("L", OCC.handL, OCC.armL, knapper.seed + 0.2, pressL, (H) => {
    const p = H.anchors.palm
    return { onCore: solveGrip(H.spec, { kind: "sphere", c: [p[0], p[1] - (CORE_REACH * 0.9) / HS, p[2]], r: (CORE_REACH * 0.95) / HS }, { wrap: true, slack: 0.3, gap: 0.0003, max: [1.6, 1.9, 1.6], maxOf: { thumb: [0.9, 1.1, 1.3] } }) }
  })
  /** The flint flake in the right hand's pinch: its middle at the pads, its length along the stylus the pinch was solved for. */
  const STY_A = handR.H.anchors.stylus[0]
  const STY_M = STY_A
  const Q_STY = new THREE.Quaternion().setFromUnitVectors(XA, new THREE.Vector3(...STY_A).sub(new THREE.Vector3(...handR.H.anchors.stylus[1])).normalize())
  const PYR_AT = handL.H.map.p(HM.HELD.core.c)
  const fA = { e: new THREE.Vector3(), q: new THREE.Quaternion() }, fB = { e: new THREE.Vector3(), q: new THREE.Quaternion() }

  // ================================================================ the hearth: stones, a lay of sticks, tinder
  const hearth = new THREE.Group()
  // fractured blocks, not cobbles: struck pieces of the shelter's own rock
  const hearthStone = makeStone("core", [0.66, 0.42, 0.52], CORE_SCARS.map((sc) => ({ ...sc, c: new THREE.Vector4(sc.c.x * 0.8, sc.c.y * 0.8, sc.c.z * 0.8, sc.c.w * 0.8), q: sc.q.clone().multiplyScalar(0.8) })), 26, 5.1, -1, [0.8, 0.7, 0.62], true)
  hearthStone.on.fill(1)
  {
    const R = rng(404)
    hearthStone.mesh.visible = false
    world.add(hearth)
    for (let i = 0; i < 11; i++) {
      // a ring with a gap toward the knapper, where the tinder goes in
      const a = 0.95 + (i / 10) * (Math.PI * 2 - 1.9) + Math.PI / 2
      const r = 1.75 + 0.2 * R()
      const m = new THREE.Mesh(hearthStone.mesh.geometry, hearthStone.mesh.material)
      const sc = 0.65 + 0.4 * R()
      m.position.set(HEARTH.x + r * Math.cos(a), 0.2 * sc, HEARTH.z + r * Math.sin(a))
      m.rotation.set(R() * 0.5, R() * 6.28, R() * 0.5)
      m.scale.setScalar(sc)
      m.frustumCulled = false
      hearth.add(m)
    }
  }
  // flints that have been in a fire: reddened and cracked (Barnham), lying by the ring
  const cracked = makeStone("core", [0.34, 0.2, 0.27], CORE_SCARS.slice(0, 3).map((s) => ({ ...s, c: new THREE.Vector4(s.c.x * 0.4, s.c.y * 0.4, s.c.z * 0.4, s.c.w * 0.4), q: s.q.clone().multiplyScalar(0.4) })), 26, 6.6, -1, [1.25, 0.78, 0.62])
  cracked.on.fill(1)
  hearth.add(cracked.mesh)
  cracked.mesh.position.set(HEARTH.x - 2.5, 0.2, HEARTH.z + 0.9)
  cracked.mesh.rotation.set(0.3, 1.1, 0.1)
  {
    const m = new THREE.Mesh(cracked.mesh.geometry, cracked.mesh.material)
    m.position.set(HEARTH.x - 2.05, 0.17, HEARTH.z + 1.6)
    m.rotation.set(-0.2, 2.6, 0.4)
    m.scale.setScalar(0.8)
    m.frustumCulled = false
    hearth.add(m)
  }
  // the fire kit: a brassy pyrite nodule and a flint flake to strike it with
  const pyrite = makeStone("cobble", PYR_R, [], 16, 7.7, -1, [1.9, 1.5, 0.62])
  const striker = makeStone("biface", [0.42, 0.1, 0.24], [], 18, 2.9, -1, [0.9, 0.82, 0.72])

  /** Firelight on skin (BUILD 5c): a point light with an inverse-square fall-off in metres, a cool sky, a warm low bounce. */
  const fireLights = (P: V3): Lights => {
    const toF = U.uFirePos.sub(P).toVar()
    const dm = length(toF).mul(0.1)
    return {
      key: normalize(toF) as V3, keyCol: U.uFireCol.mul(0.32).div(dm.mul(dm).mul(0.9).add(0.25)) as V3,
      sky: vec3(0.02, 0.028, 0.05) as V3, bounce: U.uFireCol.mul(0.006).add(vec3(0.002, 0.0015, 0.001)) as V3,
    }
  }
  // ---- the people round the fire: three whole figures (human.ts), firelit, faces small in frame
  const people = (() => {
    const FIREW = [0, 0, 0]
    // the knapper by the fire is still working: a hammerstone in the right hand, a small core in the left
    const kHam = new THREE.Mesh(hammer.mesh.geometry, hammer.mesh.material), kCore = new THREE.Mesh(core.mesh.geometry, core.mesh.material)
    kCore.scale.setScalar(0.5)
    for (const m of [kHam, kCore]) {
      m.frustumCulled = false
      hearth.add(m)
    }
    const gL: [number, number, number] = [0, 0, 0]
    const tmp = [0, 0, 0]
    let bR = -1, bL = -1
    const carry = (rig: Rig) => {
      const A = herds[2].h.anchors, gR = A.stone
      if (bR < 0) {
        bR = rig.bone("armR.2")
        bL = rig.bone("armL.2")
        gL[0] = A.palm[0] + 0.01
        gL[1] = A.palm[1] - 0.045
        gL[2] = -A.palm[2]
      }
      const sc = HS * SPARK_PEOPLE[0].scale
      HU.ride(rig, bR, herds[2].herd.built[0].skel.head, gR, sc, tmp)
      kHam.position.set(tmp[0], tmp[1], tmp[2])
      kHam.quaternion.set(rig.q[bR * 4], rig.q[bR * 4 + 1], rig.q[bR * 4 + 2], rig.q[bR * 4 + 3])
      HU.ride(rig, bL, herds[2].herd.built[0].skel.head, gL, sc, tmp)
      kCore.position.set(tmp[0], tmp[1], tmp[2])
    }
    const herds = SEATS.map((seat) => {
      const P = SPARK_PEOPLE[seat.who]
      const h = HU.makeHuman(HU[P.body])
      // a matte, dusty skin: no oil, a little sheen left for the brow and shoulders to catch
      const look = { ...HU.humanLook(h, P.look), rough: 0.86, spec: 0.07, mottle: 0.22, blotch: 0.16, wrap: 0.18, glow: 0.8 }
      // hair on every level the figure is drawn at, and a fur cloak over the shoulders and a fur hide at the waist (cards with lift: a pelt has thickness)
      const B = h.body, neck = B.shoulder + 0.04
      const at = (y: number) => Math.min(1, Math.max(0, (y - B.crotch) / (neck - B.crotch)))
      const spec = {
        ...h.spec,
        cards: [
          ...(h.spec.cards ?? []).map((c) => ({ ...c, minDetail: 0.45, len: c.len * 1.5, lift: (c.lift ?? 0.1) + 0.25, jitter: 0.8 })),
          { from: at(B.shoulder - 0.2 * B.stature / 1.756), to: 1, arc: [0, 150] as [number, number], count: 2600, len: 0.06, w: 0.016, lift: 0.05, jitter: 0.55, seed: 21 + seat.who, minDetail: 0.45 },
          { from: 0, to: at(B.crotch + 0.12), arc: [0, 180] as [number, number], count: 1500, len: 0.075, w: 0.018, lift: 0.3, jitter: 0.5, seed: 31 + seat.who, minDetail: 0.45 },
        ],
      }
      const hairY = B.shoulder + 0.11
      const aim = makeAim()
      const herd = makeHerd({
        spec, count: 1, path: aim, lods: HU.HUMAN_LODS,
        material: (n, _lod, kind) => {
          const L = fireLights(n.vW)
          const m = kind === "cards" ? featherMaterial(n, L, { ...look, base: 0x3a2a1d, belly: 0x2e2117, rough: 0.8, spec: 0.06, wrap: 0.4, rim: 0.05, bleed: 0x120a05 }) : skinMaterial(n, L, look)
          let rgb = (m.fragmentNode as unknown as V4).rgb as V3
          // cards above the shoulders are hair: darker and colder than the pelt
          if (kind === "cards") rgb = rgb.mul(mixN(vec3(1, 1, 1), vec3(0.32, 0.3, 0.3), smoothstep(hairY - 0.02, hairY + 0.02, n.vRest.y))) as V3
          // the side away from the fire falls into the dark, edged with the cold of the open sky
          const N = normalize(n.vN), Vv = normalize(U.uCam.sub(n.vW))
          const away = clampN(dot(N, normalize(U.uFirePos.sub(n.vW))).negate(), 0, 1)
          const rim = pow(clampN(dot(N, Vv).oneMinus(), 0, 1), 3).mul(away.mul(0.7).add(0.3)).mul(clampN(N.y.add(0.6), 0, 1))
          m.fragmentNode = vec4(rgb.add(vec3(0.07, 0.1, 0.17).mul(rim)), coc(n.vW))
          return m
        },
        after: seat.pose === "feed" ? (_i, rig) => carry(rig) : undefined,
      })
      herd.tint.set(P.tint)
      herd.group.traverse((o) => (o.frustumCulled = false))
      hearth.add(herd.group)
      const pos = [HEARTH.x + seat.dx, 0, HEARTH.z + seat.dz]
      // facing the fire
      const dir = [-seat.dx, 0, -seat.dz]
      aim.set(pos, dir)
      return { h, herd, seat, P, aim, t: 0, lookAt: -10 }
    })
    let time = 0
    const LOOK = { look: FIREW, lookAt: -10 }
    const STRIKE: HU.StrikeOpts = { base: "crouch", tool: "stone", rate: 0.62 }
    const fillFor = (k: number) => (_i: number, d: Drive) => {
      const it = herds[k]
      d.dist = 0
      d.lane = 0
      d.rise = 0
      d.scale = HS * it.P.scale
      d.seed = it.P.seed
      d.time = time + it.P.seed * 7
      if (it.seat.pose === "seated") HU.seated(it.h, d, d.time, LOOK)
      else if (it.seat.pose === "feed") HU.strike(it.h, d, d.time, STRIKE)
      else HU.crouch(it.h, d, d.time, LOOK)
    }
    const fills = herds.map((_, k) => fillFor(k))
    const v = new THREE.Vector3()
    return {
      pose(t: number, fireAt: THREE.Vector3) {
        time = t
        FIREW[0] = fireAt.x
        FIREW[1] = fireAt.y
        FIREW[2] = fireAt.z
        herds.forEach((it, k) => {
          it.herd.update(camera, fills[k])
          // what they block of the fire's light: a trunk and a head
          const sc = HS * it.P.scale * (it.P.body === "child" ? 0.72 : 1)
          v.set(HEARTH.x + it.seat.dx, 0, HEARTH.z + it.seat.dz)
          occ[OCC.fig + k * 2].set(v.x, v.y + 0.55 * sc, v.z, 0.2 * sc)
          occ[OCC.fig + k * 2 + 1].set(v.x, v.y + 0.95 * sc, v.z, 0.12 * sc)
        })
      },
      dispose() {
        for (const it of herds) it.herd.dispose()
      },
    }
  })()

  /** How hot the lay is at P: the fire's core is a column over the hearth, and it climbs with `uFire`. */
  const heatAt = (P: V3): F => {
    const d = length(P.xz.sub(vec2(HEARTH.x, HEARTH.z)))
    return U.uFire.mul(smoothstep(1.5, 0.15, d)).mul(smoothstep(U.uFire.mul(2.4).add(0.2), 0, P.y)) as F
  }
  const NSTICK = 17
  // the sticks; the brand (the last instance) is dropped once torch is lifting it out of the fire
  const stickGeo = new THREE.InstancedBufferGeometry()
  {
    const g = stickGeo
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 9, 7, false).translate(0, 0.5, 0)
    g.setAttribute("position", cyl.getAttribute("position"))
    g.setAttribute("normal", cyl.getAttribute("normal"))
    g.setIndex(cyl.getIndex())
    const A = new Float32Array(NSTICK * 4), B = new Float32Array(NSTICK * 4)
    const R = rng(909)
    for (let i = 0; i < NSTICK; i++) {
      let p0: number[], p1: number[]
      if (i < 12) {
        // leaning in to a point over the middle
        const a = (i / 12) * 6.283 + R() * 0.3
        const r = 0.95 + 0.25 * R()
        p0 = [HEARTH.x + r * Math.cos(a), 0.03, HEARTH.z + r * Math.sin(a)]
        p1 = [HEARTH.x - 0.22 * Math.cos(a) + (R() - 0.5) * 0.2, 1.25 + 0.4 * R(), HEARTH.z - 0.22 * Math.sin(a) + (R() - 0.5) * 0.2]
      } else if (i < 16) {
        const a = R() * 6.283, r = 0.9
        p0 = [HEARTH.x + r * Math.cos(a), 0.08, HEARTH.z + r * Math.sin(a)]
        p1 = [HEARTH.x - r * Math.cos(a + 0.5), 0.1 + 0.1 * R(), HEARTH.z - r * Math.sin(a + 0.5)]
      } else {
        // the brand: one long stick lying out of the fire toward the lens, its far end in the heat
        p0 = [...SPARK_BRAND.from]
        p1 = [...SPARK_BRAND.to]
      }
      A.set([p0[0], p0[1], p0[2], i < 16 ? 0.065 + 0.05 * R() : 0.075], i * 4)
      B.set([p1[0], p1[1], p1[2], R()], i * 4)
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 4))
    g.instanceCount = NSTICK
    const aA = attribute("aA", "vec4") as V4, aB = attribute("aB", "vec4") as V4
    const axis = aB.xyz.sub(aA.xyz).toVar()
    const len = length(axis).toVar()
    const t = axis.div(len).toVar()
    const s1 = normalize(cross(t, vec3(0.31, 0.2, 0.93))).toVar()
    const s2 = cross(t, s1).toVar()
    const y = positionGeometry.y
    const knots = sin(y.mul(len).mul(4.2).add(aB.w.mul(40))).mul(0.08).add(1)
    const rad = mixN(aA.w, aA.w.mul(0.55), y).mul(knots)
    const bend = sin(y.mul(3.1416)).mul(len).mul(aB.w.sub(0.5)).mul(0.07)
    const P = aA.xyz.add(axis.mul(y)).add(s1.mul(positionGeometry.x.mul(rad).add(bend))).add(s2.mul(positionGeometry.z.mul(rad))).toVar()
    const vP = P.toVarying()
    const vN = s1.mul(normalGeometry.x).add(s2.mul(normalGeometry.z)).add(t.mul(normalGeometry.y)).toVarying()
    const vK = vec4(y.mul(len), aB.w, positionGeometry.x, positionGeometry.z).toVarying()
    const frag = Fn(() => {
      const Pw = vP as V3
      const k = vK as V4
      const N = normalize(vN).toVar()
      const ang = k.z.mul(3).add(k.w.mul(2))
      const fib = vnoise(vec2(ang.mul(2.4).add(k.y.mul(30)), k.x.mul(1.3))).toVar()
      const bark = mixN(vec3(0.17, 0.115, 0.07), vec3(0.09, 0.065, 0.045), fib).mul(vnoise(vec2(ang.mul(7), k.x.mul(9))).mul(0.4).add(0.75)).toVar()
      N.assign(bump(Pw, N as V3, fib.mul(0.02) as F))
      const heat = heatAt(Pw).toVar()
      // it chars from where the heat is, and glows through the cracks in the char
      const crawl = n3(Pw.mul(5).add(vec3(0, U.uT.mul(-0.35), 0))).toVar()
      const char = smoothstep(0.1, 0.5, heat.add(crawl.sub(0.5).mul(0.3)))
      const alb = mixN(bark, vec3(0.012, 0.011, 0.012), char)
      const cracks = pow(clampN(vnoise3(Pw.mul(13)).mul(1.6).sub(0.2), 0, 1), 3).mul(sin(U.uT.mul(5.1).add(crawl.mul(20))).mul(0.25).add(0.75))
      const glow = vec3(5.5, 1.5, 0.22).mul(cracks).mul(smoothstep(0.3, 0.8, heat.add(crawl.mul(0.25))))
      return vec4(lit(Pw, N as V3, alb as V3, 0.03, 10).add(glow), coc(Pw))
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(P, 1))))
    m.frustumCulled = false
    hearth.add(m)
  }
  // ---- tinder: a nest of dry grass and bark fibre
  const camRight = uniform(new THREE.Vector3(1, 0, 0))
  {
    const NFIB = 620
    const g = new THREE.InstancedBufferGeometry()
    const pl = new THREE.PlaneGeometry(2, 1, 1, 7).translate(0, 0.5, 0)
    g.setAttribute("position", pl.getAttribute("position"))
    g.setIndex(pl.getIndex())
    const A = new Float32Array(NFIB * 4), B = new Float32Array(NFIB * 4)
    const R = rng(515)
    for (let i = 0; i < NFIB; i++) {
      const rho = 0.08 + 0.36 * Math.sqrt(R())
      A.set([rho, 0.03 + 0.2 * R() * (1 - rho * 1.4), R() * 6.283, 0.5 + 1.6 * R()], i * 4)
      B.set([R(), R(), R(), R()], i * 4)
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 4))
    g.instanceCount = NFIB
    const aA = attribute("aA", "vec4") as V4, aB = attribute("aB", "vec4") as V4
    const v = positionGeometry.y
    const at = (vv: THREE.Node): V3 => {
      const w = vv as F
      const th = aA.z.add(w.sub(0.5).mul(aA.w))
      const stray = smoothstep(0.62, 1, abs(w.mul(2).sub(1))).mul(aB.x.mul(aB.x)).mul(0.5)
      const rho = aA.x.add(sin(w.mul(9).add(aB.y.mul(40))).mul(0.035)).add(stray.mul(0.3))
      return vec3(cos(th).mul(rho).add(TINDER.x), aA.y.add(sin(w.mul(7).add(aB.z.mul(31))).mul(0.035)).add(stray.mul(0.45)).add(TINDER.y - 0.2), sin(th).mul(rho).add(TINDER.z)) as V3
    }
    const c = at(v).toVar()
    const tan = normalize(at(v.add(0.03)).sub(at(v.sub(0.03)))).toVar()
    const side = normalize(cross(tan, U.uCam.sub(c))).toVar()
    const wdt = mixN(0.012, 0.004, aB.w).mul(smoothstep(0, 0.1, v).mul(smoothstep(1, 0.8, v)).mul(0.7).add(0.3))
    const P = c.add(side.mul(positionGeometry.x.mul(wdt))).toVar()
    const vP = P.toVarying()
    const vT = tan.toVarying()
    const vK = vec3(positionGeometry.x, v, aB.w).toVarying()
    const frag = Fn(() => {
      const Pw = vP as V3
      const k = vK as V3
      // a blade is a little cylinder: its normal swings across its width
      const T = normalize(vT)
      const toCam = normalize(U.uCam.sub(Pw))
      const sd = normalize(cross(T, toCam))
      const N = normalize(toCam.mul(sqrt(max(float(1).sub(k.x.mul(k.x)), 0.05))).add(sd.mul(k.x))).toVar()
      const straw = mixN(vec3(0.42, 0.33, 0.17), vec3(0.2, 0.14, 0.08), k.z).mul(vnoise(vec2(k.y.mul(26), k.z.mul(50))).mul(0.3).add(0.8)).toVar()
      // the glow: a point where the spark fell, spreading through the fibres as it is breathed on; ash behind it
      const d = length(Pw.sub(vec3(TINDER.x, TINDER.y, TINDER.z)))
      const reach = U.uGlow.mul(0.3).add(U.uFire.mul(0.5))
      const fr = n3(Pw.mul(22).add(vec3(0, U.uT.mul(-0.2), 0)))
      const hot = smoothstep(reach, reach.mul(0.35), d.add(fr.sub(0.5).mul(0.16))).mul(step(0.001, U.uGlow))
      const ash = smoothstep(0.25, 0.9, U.uFire).mul(smoothstep(0.55, 0.2, d))
      const alb = mixN(mixN(straw, vec3(0.015), hot.mul(0.9)), vec3(0.2, 0.19, 0.18), ash.mul(0.8))
      const glow = vec3(6, 1.7, 0.25).mul(hot).mul(fr.mul(1.4).add(0.3)).mul(U.uGlow.mul(0.8).add(0.2)).mul(ash.oneMinus())
      return vec4(lit(Pw, N as V3, alb as V3, 0.12, 20, -1, 0.5).add(glow), coc(Pw))
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(P, 1)), { side: THREE.DoubleSide }))
    m.frustumCulled = false
    hearth.add(m)
  }
  // ---- flame: tongues of gas, each a strip that faces the lens and is eaten by rising noise
  {
    const NT = 44
    const g = new THREE.InstancedBufferGeometry()
    const pl = new THREE.PlaneGeometry(2, 1, 2, 12).translate(0, 0.5, 0)
    g.setAttribute("position", pl.getAttribute("position"))
    g.setIndex(pl.getIndex())
    const A = new Float32Array(NT * 4)
    const R = rng(606)
    for (let i = 0; i < NT; i++) {
      const r = Math.sqrt(R()), a = R() * 6.283
      A.set([r * Math.cos(a), r * Math.sin(a), R(), R()], i * 4)
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.instanceCount = NT
    const aA = attribute("aA", "vec4") as V4
    const v = positionGeometry.y
    const t = U.uT
    const spread = mixN(0.1, 0.72, U.uFire)
    const hgt = mixN(0.45, 2.9, U.uFire).mul(aA.z.mul(0.6).add(0.5)).mul(float(1).sub(length(aA.xy).mul(0.45))).mul(sin(t.mul(aA.w.mul(3).add(4)).add(aA.z.mul(30))).mul(0.16).add(0.9)).mul(U.uFlame)
    const base = vec3(mixN(TINDER.x, HEARTH.x, U.uFire), mixN(TINDER.y - 0.05, 0.12, U.uFire), mixN(TINDER.z, HEARTH.z, U.uFire))
    const sway = vec3(sin(t.mul(3.1).add(aA.w.mul(40)).add(v.mul(4))), 0, cos(t.mul(2.7).add(aA.z.mul(50)).add(v.mul(3.3)))).mul(v).mul(hgt).mul(0.07)
    const c = base.add(vec3(aA.x, 0, aA.y).mul(spread).mul(float(1).sub(v.mul(0.65)))).add(vec3(0, v.mul(hgt), 0)).add(sway)
    const wdt = mixN(0.1, 0.42, U.uFire).mul(aA.w.mul(0.5).add(0.7)).mul(float(1).sub(v.mul(0.7)))
    const P = c.add(camRight.mul(positionGeometry.x.mul(wdt))).toVar()
    const vK = vec4(positionGeometry.x, v, aA.z, aA.w).toVarying()
    const frag = Fn(() => {
      const k = vK as V4
      const u = k.x, vv = k.y
      const n = fbm(vec2(u.mul(1.3).add(k.z.mul(17)), vv.mul(2.6).sub(t.mul(k.w.mul(0.8).add(2.2))))).toVar()
      const shape = float(1).sub(pow(abs(u), 1.6)).mul(smoothstep(0, 0.1, vv)).mul(pow(float(1).sub(vv), 0.6))
      const a = smoothstep(0.22, 0.6, shape.mul(1.45).sub(n.sub(0.45).mul(1.1)).sub(vv.mul(0.3))).toVar()
      const heat = clampN(shape.mul(float(1).sub(vv.mul(0.85))).add(n.sub(0.5).mul(0.4)), 0, 1)
      const col = mixN(vec3(1.5, 0.2, 0.02), mixN(vec3(3.6, 1.15, 0.16), vec3(6, 4.2, 1.9), smoothstep(0.55, 0.95, heat)), smoothstep(0.1, 0.55, heat))
      return vec4(col.mul(a).mul(0.22).mul(U.uFlame), 0)
    })()
    const m = new THREE.Mesh(g, mat(frag, viewProj.mul(vec4(P, 1)).mul(step(0.002, U.uFlame)), ADD))
    m.frustumCulled = false
    m.renderOrder = 40
    world.add(m)
  }
  // ---- sparks off the pyrite (three bursts), and the embers the fire sends up
  const sparkAt = new THREE.Vector3().copy(TINDER).add(new THREE.Vector3(-0.05, 1.45, 0.05))
  const uSparkAt = uniform(sparkAt)
  {
    const BURST = [18, 26, 40]
    const NS = BURST[0] + BURST[1] + BURST[2], NE = 110
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const A = new Float32Array((NS + NE) * 4), B = new Float32Array((NS + NE) * 4)
    const R = rng(3)
    let i = 0
    BURST.forEach((n, j) => {
      for (let q = 0; q < n; q++, i++) {
        // thrown down and forward off the struck face, in a fan
        const a = (R() - 0.5) * 2.2, e = -0.2 - R() * 1.1, sp = 5 + 11 * R() * R()
        A.set([Math.sin(a) * Math.cos(e) * sp + 1.5, Math.sin(e) * sp, Math.cos(a) * Math.cos(e) * sp * 0.7 + 1, 200 + K2[j] + R() * 0.02], i * 4)
        B.set([0.14 + 0.5 * R() * R(), R(), 0, R()], i * 4)
      }
    })
    for (let q = 0; q < NE; q++, i++) {
      A.set([R() - 0.5, R(), R() - 0.5, -1], i * 4)
      B.set([1.4 + 2.2 * R(), R(), 1, R()], i * 4)
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 4))
    g.instanceCount = NS + NE
    const aA = attribute("aA", "vec4") as V4, aB = attribute("aB", "vec4") as V4
    const isE = aB.z
    // a spark: drag and gravity in closed form; it is hottest as it leaves and is ash before it lands
    const tauR = U.uClock.sub(aA.w)
    const tauS = clampN(tauR, 0, 2)
    const kd = 3.2
    const reach = float(1).sub(exp(tauS.mul(-kd))).div(kd)
    const pS = uSparkAt.add(aA.xyz.mul(reach)).sub(vec3(0, tauS.mul(tauS).mul(22), 0))
    const vS = aA.xyz.mul(exp(tauS.mul(-kd))).sub(vec3(0, tauS.mul(44), 0))
    const xS = clampN(tauS.div(aB.x), 0, 1)
    // an ember: carried up the column on a helix, cooling, on a loop
    const ph = fract(U.uT.div(aB.x).add(aB.y))
    const rise = ph.mul(aB.x).mul(mixN(1.2, 2.3, aB.w))
    const pE = vec3(HEARTH.x, 0.5, HEARTH.z).add(vec3(aA.x.mul(0.9).add(sin(rise.mul(2.1).add(aB.w.mul(30))).mul(0.25).mul(ph.add(0.3))), rise, aA.z.mul(0.9).add(cos(rise.mul(1.7).add(aB.y.mul(30))).mul(0.25).mul(ph.add(0.3)))))
    const vE = vec3(cos(rise.mul(2.1).add(aB.w.mul(30))).mul(0.4), 1.6, sin(rise.mul(1.7).add(aB.y.mul(30))).mul(-0.4))
    const c = mixN(pS, pE, isE).toVar()
    const vel = mixN(vS, vE, isE).toVar()
    const x = mixN(xS, ph, isE).toVar()
    const live = mixN(step(0, tauR).mul(step(tauR, aB.x)), smoothstep(0.35, 0.8, U.uFire).mul(step(aB.w, U.uFire.mul(1.2))), isE)
    // drawn as a streak along its velocity, as long as it moves in a shutter time
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const vv = cameraViewMatrix.mul(vec4(vel, 0)).xy.toVar()
    const sp2 = length(vv).add(1e-4)
    const dir = vv.div(sp2)
    const size = mixN(0.012, 0.02, aB.w).mul(mixN(float(1), float(1.3), isE))
    const lenS = sp2.mul(0.006).add(size)
    const off = dir.mul(positionGeometry.x.mul(lenS)).add(vec2(dir.y.negate(), dir.x).mul(positionGeometry.y.mul(size)))
    const vQ = positionGeometry.xy.toVarying()
    const vX = vec2(x, live).toVarying()
    const frag = Fn(() => {
      const q = vQ as V2
      const xx = (vX as V2).x
      const a = smoothstep(1, 0.2, length(q)).mul((vX as V2).y)
      // pyrite sparks are dull: orange, red, then grey ash
      const col = mixN(mixN(vec3(3.6, 1.2, 0.22), vec3(1.6, 0.25, 0.04), smoothstep(0, 0.55, xx)), vec3(0.05, 0.045, 0.04), smoothstep(0.6, 1, xx))
      return vec4(col.mul(a), 0)
    })()
    const m = new THREE.Mesh(g, mat(frag, cameraProjectionMatrix.mul(vec4(vc.xy.add(off), vc.z, 1)).mul(step(0.002, live)), ADD))
    m.frustumCulled = false
    m.renderOrder = 41
    world.add(m)
  }
  // ---- smoke: before the flame, and after
  {
    const NS = 54
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const A = new Float32Array(NS * 4)
    const R = rng(8)
    for (let i = 0; i < NS; i++) A.set([R(), R(), R(), R()], i * 4)
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.instanceCount = NS
    const aA = attribute("aA", "vec4") as V4
    const life = aA.x.mul(2).add(3.2)
    const ph = fract(U.uT.div(life).add(aA.y))
    const h = ph.mul(life).mul(mixN(0.5, 1.5, U.uFire))
    const src = vec3(mixN(TINDER.x, HEARTH.x, U.uFire), mixN(TINDER.y, 1.6, U.uFire), mixN(TINDER.z, HEARTH.z, U.uFire))
    const c = src.add(vec3(sin(h.mul(1.3).add(aA.z.mul(40))).mul(0.18).mul(h).add(h.mul(h).mul(0.06)), h, cos(h.mul(1.1).add(aA.w.mul(40))).mul(0.14).mul(h))).toVar()
    const size = mixN(0.06, 0.5, pow(ph, 0.7)).mul(aA.w.mul(0.6).add(0.7)).mul(mixN(1, 2.4, U.uFire))
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const vQ = positionGeometry.xy.toVarying()
    const vK = vec3(ph, aA.z, aA.w).toVarying()
    const vC = c.toVarying()
    const frag = Fn(() => {
      const q = vQ as V2
      const k = vK as V3
      const n = fbm(q.mul(1.4).add(vec2(k.y.mul(31), k.z.mul(17).sub(U.uT.mul(0.12)))))
      const a = smoothstep(1, 0.2, length(q).add(n.sub(0.5).mul(0.8))).mul(smoothstep(0, 0.12, k.x)).mul(float(1).sub(k.x)).mul(U.uSmoke).mul(0.07).toVar()
      const col = lit(vC as V3, vec3(0, -1, 0) as V3, vec3(0.5, 0.5, 0.52) as V3, 0, 4, -1, 1)
      return vec4(col.mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(frag, cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size)), vc.z, 1)).mul(step(0.002, U.uSmoke)), OVER))
    m.frustumCulled = false
    m.renderOrder = 39
    world.add(m)
  }

  // ---- haze: wood smoke hanging between the lens and the people once the fire is going, soft as it is near
  {
    const NH = 16
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const A = new Float32Array(NH * 4)
    const R = rng(19)
    for (let i = 0; i < NH; i++) A.set([HEARTH.x - 12 + 22 * R(), 1.2 + 5 * R(), HEARTH.z + 2.5 + 8 * R(), R()], i * 4)
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.instanceCount = NH
    const aA = attribute("aA", "vec4") as V4
    const c = aA.xyz.add(vec3(sin(U.uT.mul(0.07).add(aA.w.mul(30))).mul(1.6).add(U.uT.mul(0.18)), sin(U.uT.mul(0.11).add(aA.w.mul(17))).mul(0.4), 0)).toVar()
    const size = aA.w.mul(3).add(3.5)
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const vQ = positionGeometry.xy.toVarying()
    const vK = aA.w.toVarying()
    const vC = c.toVarying()
    const frag = Fn(() => {
      const q = vQ as V2
      const n = fbm(q.mul(1.1).add(vec2((vK as F).mul(23), U.uT.mul(0.03))))
      const a = smoothstep(1, 0.1, length(q).add(n.sub(0.5).mul(0.9))).mul(smoothstep(0.3, 1, U.uFire)).mul(0.05).toVar()
      const toF = U.uFirePos.sub(vC as V3)
      const col = U.uFireCol.mul(0.05).div(dot(toF, toF).mul(0.012).add(1)).add(U.uSky.mul(0.6))
      return vec4(col.mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(frag, cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size)), vc.z, 1)).mul(step(0.3, U.uFire)), OVER))
    m.frustumCulled = false
    m.renderOrder = 38
    hearth.add(m)
  }

  // ================================================================ the rule of ages, in this scene's light
  const face = ruleFace()
  const ruleStyle = { treatment: "steel" as const, debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const rule = (() => {
    const tex = uniformTexture(face.tex)
    const vP = worldOf(positionGeometry).toVarying()
    const vN = turn(normalGeometry).toVarying()
    const frag = Fn(() => {
      const st = uv().toVar()
      const P = vP as V3
      const cut = tex.sample(st).toVar()
      const on = cut.a.mul(attribute("face", "float")).toVar()
      // steel that has been handled: brushed along its length, warm where the key rakes it
      const grain = vnoise(vec2(st.x.mul(52), st.y.mul(150))).mul(0.6).add(vnoise(vec2(st.x.mul(190), st.y.mul(560))).mul(0.4)).toVar()
      const metal = vec3(0.58, 0.56, 0.54).mul(grain.mul(0.36).add(0.82)).toVar()
      const N = normalize(vN).toVar()
      // the key as the rule sees it: the sun from the left, then the fire from where the hearth is on screen
      const V = normalize(U.uCam.sub(P))
      const toF = normalize(U.uFirePos.sub(P))
      const wS = luma(U.uSunCol as unknown as V3), wF = luma(U.uFireCol as unknown as V3)
      const L = normalize(U.uSunDir.mul(wS).add(toF.mul(wF)).add(V.mul(0.6).mul(wS.add(wF))).add(vec3(0, 1e-3, 0))).toVar()
      const key = U.uSunCol.add(U.uFireCol.mul(0.5)).toVar()
      const ndl = clampN(dot(N, L), 0, 1)
      // a streak of the key slides along the brushing
      const Hh = normalize(L.add(V))
      const streak = pow(clampN(dot(N, Hh), 0, 1), 26).mul(grain.mul(0.8).add(0.2))
      // never darker than a reading light: the face has to be legible in the dark before the fire
      const fill = max(U.uSky.mul(1.6), vec3(0.2, 0.2, 0.22)).add(U.uFireCol.mul(0.035))
      const base = metal.mul(key.mul(ndl.mul(0.55)).add(fill)).add(key.mul(streak).mul(0.5)).toVar()
      const ink = cut.rgb.mul(fill.add(key.mul(0.1)))
      const c = mixN(base, ink, on)
      // (for the review tool the face paints its label plates magenta: show them unlit)
      return vec4(ctx.debugLabels ? mixN(base, cut.rgb, step(0.25, on)) : c, 2)
    })()
    const m = new THREE.Mesh(ruleGeometry(), mat(frag, viewProj.mul(vec4(worldOf(positionGeometry), 1)), { depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending }))
    m.renderOrder = 1000
    m.frustumCulled = false
    world.add(m)
    return m
  })()

  // ================================================================ depth of field
  const D = { tS: uniformTexture(stage.texture), uMax: uniform(0.02) }
  const TAPS = 22
  const dof = ctx.pass(({ uv: st, res }) => {
    const c0 = sampleRT(D.tS, st).toVar()
    const out = vec3(c0.rgb).toVar()
    // alpha 2 marks the rule: it is rigid to the lens and never blurred, nor blurred into
    If(c0.a.lessThan(1.5), () => {
      const a0 = abs(c0.a).toVar()
      const acc = vec3(c0.rgb).toVar()
      const w = float(1).toVar()
      const asp = res.x.div(res.y)
      const spin = hash21(floor(st.mul(res))).mul(6.2832)
      Loop(TAPS, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(TAPS)).toVar()
        const an = fi.mul(2.39996).add(spin)
        const s = sampleRT(D.tS, st.add(vec2(cos(an), sin(an)).mul(rr).mul(D.uMax).div(vec2(asp, 1))) as V2).toVar()
        const as = abs(s.a)
        // near things spread over whatever is behind them; far things only over things as soft
        const lim = select(s.a.lessThan(0), as, select(c0.a.lessThan(0), max(as, a0), min(as, a0)))
        const k = smoothstep(rr.sub(0.06), rr.add(0.06), lim).mul(step(s.a, 1.5)).toVar()
        acc.addAssign(s.rgb.mul(k))
        w.addAssign(k)
      })
      out.assign(acc.div(w))
    })
    return vec4(out, 1)
  }, D)

  // ================================================================ the story, per frame
  const W = {
    strikes: 0, fire: 0, glow: 0, dark: 0,
    hitX: 0.6, hitY: 0.5,
    // listener-space positions the cues read
    strike: [0, 0, 0] as [number, number, number],
    tind: [0, 0, 0] as [number, number, number],
  }
  const near = { k: 0, tau: 0, done: 0 }
  const tgt = new THREE.Vector3(), camP = new THREE.Vector3(), look = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), ax = new THREE.Vector3()
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion()
  const strikeW = new THREE.Vector3(), hamC = new THREE.Vector3()
  const stonePos = new THREE.Vector3()
  const pcR = new THREE.Vector3(), pcL = new THREE.Vector3()
  const XA2 = new THREE.Vector3(), YA2 = new THREE.Vector3(), ZA2 = new THREE.Vector3(), m4 = new THREE.Matrix4(), bifHold = new THREE.Quaternion()
  /** Sum of settled punch-ins: each blow before `t` counts one, arriving with an overshoot. */
  const punches = (times: number[], t: number, len = 0.24) => {
    let n = 0
    for (const x of times) if (t > x) n += E.outBack(clamp((t - x) / len))
    return n
  }
  /** A kick that decays: 1 at the blow, gone in a quarter second. */
  const kick = (times: number[], t: number) => {
    let n = 0
    for (const x of times) if (t > x && t < x + 0.5) n += Math.exp(-(t - x) * 14)
    return n
  }
  const POST: PostOpts = { tone: "agx", exposure: 1, bloom: 0.3, bloomThresh: 1.0, vignette: 0.32, contrast: 1.1, sat: 1.05, grain: 0.028, ca: 0.0009, halation: 0.25, bloomRadius: 1, lift: [0.004, 0.006, 0.012], gain: [1.02, 1, 0.97] }
  const HUD = { color: "#f3e7d3", shadow: "rgba(0,0,0,0.6)" }
  const TITLES: TitleOpts = { color: "#f6ecdc", shadow: "rgba(0,0,0,0.7)", delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.5, 0.4] }

  function update(s: State) {
    const b = s.beat
    const t0 = s.at(0), t1 = b >= 1 ? s.at(1) : -1, t2 = b >= 2 ? s.at(2) : -1
    U.uClock.value = b * 100 + Math.min(s.t, 90)
    U.uT.value = s.time
    // torch lifts the brand out of the fire: from its first frame the stick is torch's, not ours
    stickGeo.instanceCount = s.exit > 0 || (b === 2 && t2 > HOLD_END && !s.live) ? NSTICK - 1 : NSTICK

    // ---- strikes so far, and the scars they opened
    nearest(K0, t0, near)
    const done0 = b > 0 ? K0.length : near.done
    for (let i = 0; i < K0.length; i++) core.on[i] = i < done0 ? 1 : 0
    const k0 = near.k, tau0 = near.tau
    nearest(K1, t1, near)
    const done1 = b > 1 ? K1.length : b === 1 ? near.done : 0
    for (let i = 0; i < 24; i++) biface.on[i] = i < 12 + done1 ? 1 : 0
    const k1 = near.k, tau1 = near.tau
    W.strikes = done0 + done1
    U.uDust.value = clamp(W.strikes / 9)
    const blink = b === 1 ? clamp(1 - Math.abs(t1 - BLINK) / BLINK) : 0
    const useBif = b > 1 || (b === 1 && t1 >= BLINK)
    core.mesh.visible = !useBif
    biface.mesh.visible = useBif

    // ---- light: a low sun, dusk, dark, fire
    const dusk = s.k(1, 0, 0.3, E.lin)
    const night = s.k(2, 0, 0.9, E.io2)
    const sunLv = mix(1, 0.62, dusk) * (1 - night)
    U.uSunDir.value.set(0.86, mix(0.34, 0.16, dusk), mix(0.3, 0.46, dusk)).normalize()
    U.uSunCol.value.set(mix(2.5, 2.1, dusk), mix(1.32, 0.72, dusk), mix(0.62, 0.26, dusk)).multiplyScalar(sunLv)
    const glow = b === 2 ? clamp((t2 - K2[2]) / 0.25) * (0.35 + 0.3 * sm01(clamp(1 - Math.abs(t2 - BREATH[0] - 0.22) / 0.3)) + 0.45 * sm01(clamp(1 - Math.abs(t2 - BREATH[1] - 0.25) / 0.34))) : 0
    const fire = s.k(2, FLAME, FLAME + 2.6, E.out2)
    W.fire = fire
    W.glow = glow * (1 - fire)
    U.uFire.value = fire
    U.uGlow.value = Math.max(glow, fire)
    const flick = 0.82 + 0.1 * Math.sin(s.time * 11.3) + 0.06 * Math.sin(s.time * 23.7 + 1.3) + 0.05 * Math.sin(s.time * 37.1 + 4)
    const fireLv = fire * 6 * flick + W.glow * 0.5
    U.uFlame.value = s.k(2, FLAME, FLAME + 0.5, E.out2)
    U.uSmoke.value = b === 2 ? clamp((t2 - K2[2] - 0.2) / 0.6) : 0
    let fl = 0
    if (b === 2) for (let j = 0; j < 3; j++) if (t2 > K2[j]) fl += Math.exp(-(t2 - K2[j]) * 7) * (0.8 + 0.4 * j)
    U.uFlash.value.set(sparkAt.x, sparkAt.y - 0.15, sparkAt.z + 0.1, fl)
    U.uFirePos.value.set(mix(TINDER.x, HEARTH.x, fire) + 0.06 * Math.sin(s.time * 7.1), mix(0.3, 0.95, fire) + 0.05 * Math.sin(s.time * 9.7), mix(TINDER.z, HEARTH.z, fire))
    U.uFireCol.value.set(1.0, 0.5, 0.17).multiplyScalar(fireLv)
    // after sunset the sky is still a deep blue: a cool fill the hands and the tinder read against
    U.uSky.value.set(mix(mix(0.1, 0.07, dusk), 0.05, night), mix(mix(0.13, 0.1, dusk), 0.07, night), mix(mix(0.18, 0.17, dusk), 0.13, night))
    U.uBounce.value.set(0.07, 0.05, 0.035).multiplyScalar(mix(mix(1, 0.6, dusk), 0.25, night) + fire * 0.1)
    W.dark = night

    // ---- the stone in the hand
    const dip0 = b === 0 ? kick(K0, t0) : 0
    core.mesh.position.copy(CORE_C)
    core.mesh.position.y -= 0.05 * dip0
    core.mesh.rotation.set(0.02 * dip0, 0, -0.03 * dip0)
    // the hand-axe: worked on the pad (near edge up to the hammer), turned over, raised and turned in the light, put down by the hearth
    const flip = b === 1 ? E.io3(clamp((t1 - FLIP[0]) / (FLIP[1] - FLIP[0]))) : 1
    const lift = b > 1 ? 1 : b === 1 ? E.io3(clamp((t1 - LIFT[0]) / (LIFT[1] - LIFT[0]))) : 0
    const down = s.k(2, 0.05, 0.95, E.io3)
    const dip1 = b === 1 ? kick(K1, t1) : 0
    qA.setFromAxisAngle(XA, -0.55 + Math.PI * flip) // working pose
    const spin = 2.1 + 0.8 * Math.sin(0.62 * Math.max(0, t1 - LIFT[0]) - 1.1)
    qB.setFromAxisAngle(ZA, Math.PI / 2 - 0.12).premultiply(qC.setFromAxisAngle(YA, spin)) // tip up, turning
    biface.mesh.quaternion.copy(qA).slerp(qB, lift)
    bifHold.setFromAxisAngle(XA, -0.55).slerp(qB, lift)
    biface.mesh.position.copy(BIF_C).lerp(v1.set(0.5, 4.0, 1.5), lift)
    biface.mesh.position.y -= 0.035 * dip1
    if (b === 1) biface.mesh.position.y += 0.3 * Math.sin(Math.PI * clamp((t1 - FLIP[0]) / (FLIP[1] - FLIP[0])))
    if (down > 0) {
      const gx = HEARTH.x - 5.4, gz = HEARTH.z + 2.6
      v1.set(gx, groundH(gx, gz) + 0.17, gz)
      biface.mesh.position.lerp(v1, down)
      biface.mesh.position.y += 0.6 * Math.sin(down * Math.PI)
      qB.setFromAxisAngle(YA, 0.5).multiply(qC.setFromAxisAngle(XA, 0.12))
      biface.mesh.quaternion.slerp(qB, down)
      bifHold.slerp(qB, down)
    }
    const stone = useBif ? biface : core
    stone.mesh.updateMatrixWorld()
    stonePos.copy(stone.mesh.position)

    // ---- where the next blow falls
    nearest(K2, t2, near)
    const tau2 = near.tau
    let lifted = 0.17
    let away = 0
    if (b === 0) {
      strikeW.copy(CORE_SCARS[k0].q).applyMatrix4(core.mesh.matrixWorld)
      lifted = swing(tau0, 0.5)
    } else if (b === 1) {
      strikeW.copy(BIF_SCARS[12 + k1].q).applyMatrix4(biface.mesh.matrixWorld)
      lifted = swing(tau1, 0.3)
      away = E.io2(clamp((t1 - LIFT[0] + 0.3) / 0.7))
      if (t1 < BLINK) strikeW.copy(CORE_SCARS[6].q).add(CORE_C)
    } else {
      strikeW.copy(sparkAt)
      lifted = swing(tau2, 0.34)
    }
    const gone = b === 2 ? E.io2(clamp((t2 - K2[2] - 0.25) / 0.6)) : 0
    const come = s.k(2, 0.6, 1.2, E.out3)
    hearth.visible = b === 2
    hammer.mesh.visible = b < 2
    pyrite.mesh.visible = striker.mesh.visible = b === 2 && gone < 1

    // ---- the striking hand: the hammerstone's face on the struck point, then the swing about the elbow
    {
      const kit = b === 2
      const H = handR.H
      for (const k in handR.ch) handR.ch[k] = 0
      handR.time = s.time
      if (!kit) {
        // the blow comes down and a little in from the right; the fingers point left and away, palm down
        frameFrom(D_HAM, XL, v2.set(-0.3, -1, -0.1).normalize(), v3.set(-1, 0.3, 0.15).normalize(), XA2, YA2)
        // the hammer's centre: back from the struck point by the stone's own reach along the blow
        hamC.copy(strikeW).sub(v1.copy(P_HAM).multiplyScalar(HS).applyMatrix4(m4.makeBasis(XA2, YA2, ZA2.crossVectors(XA2, YA2))))
        handR.place(hamC, H.anchors.stone, XA2, YA2)
        handR.ch.stone = 1
      } else {
        // the flint flake in a pinch, its edge on the pyrite's top; the stroke glances down past it
        frameFrom(XL, YL, v2.set(-1, -0.3, -0.45).normalize(), v3.set(0, 1, 0), XA2, YA2)
        hamC.copy(sparkAt).add(v1.set(0.12, 0.16, 0.05))
        handR.place(hamC, STY_A, XA2, YA2)
        handR.ch.pinch = 1
      }
      // the swing: about a level axis across the forearm, through the elbow
      ax.crossVectors(handR.X, YA).normalize()
      const ang = 0.6 * lifted + away * 1.1 + (kit ? (1 - come + gone * 1.6) * 0.9 : 0)
      qB.setFromAxisAngle(ax, ang)
      handR.orient(XA2.copy(handR.X).applyQuaternion(qB), YA2.copy(handR.Y).applyQuaternion(qB))
      // after the hand-axe is lifted, or the fire caught, the hand withdraws the way the forearm points
      handR.elbow.addScaledVector(handR.X, -4 * (kit ? gone : away))
      handR.ch.wristFlex = -0.4 * Math.max(0, lifted - 0.17)
      handR.herd.group.visible = b < 2 ? away < 1 : gone < 0.97
      handR.update()
      const obj = kit ? striker : hammer
      if (kit) {
        handR.ride(STY_M, obj.mesh.position)
        obj.mesh.quaternion.copy(handR.q).multiply(Q_STY)
        pressR.amt.value = 0
      } else {
        handR.ride(H.anchors.stone, obj.mesh.position)
        obj.mesh.quaternion.copy(handR.q)
        pressR.c.value.copy(obj.mesh.position)
        pressR.q.value.set(handR.q.x, handR.q.y, handR.q.z, handR.q.w)
        pressR.r.value.set(HM.HELD.stone.r[0] * HS, HM.HELD.stone.r[1] * HS, HM.HELD.stone.r[2] * HS)
        pressR.amt.value = 1
      }
      handR.ride(H.anchors.palm, pcR)
      occ[OCC.handR].set(pcR.x, pcR.y, pcR.z, handR.herd.group.visible ? 0.45 : 0)
      v1.copy(pcR).lerp(handR.elbow, 0.55)
      occ[OCC.armR].set(v1.x, v1.y, v1.z, handR.herd.group.visible ? 0.4 : 0)
      occ[OCC.hammer].set(hammer.mesh.position.x, hammer.mesh.position.y, hammer.mesh.position.z, hammer.mesh.visible ? 0.36 : 0)
    }
    // ---- the holding hand: the left, on the stone it holds
    {
      const H = handL.H
      for (const k in handL.ch) handL.ch[k] = 0
      handL.time = s.time + 1.7
      pressL.amt.value = 0
      if (!useBif) {
        // the core stands on the anvil: the palm over its left shoulder, fingers down its far side, thumb on the near face
        v2.set(-0.72, 0.68, 0.12).normalize()
        v1.copy(core.mesh.position).addScaledVector(v2, CORE_REACH * 0.9)
        v1.y -= 0.035 * kick(K0, t0)
        v3.set(0.55, -0.3, -0.78)
        v3.addScaledVector(v2, -v2.dot(v3)).normalize()
        handL.place(v1, H.anchors.palm, v3, v2)
        handL.ch.onCore = 1
      } else {
        // the hand-axe rests on the anvil: the palm presses its butt down, the fingers over its far edge, the
        // forearm in from the near left corner with the same lay as on the core, its elbow out of frame. Lifted, the hand closes round the butt from below.
        const toss = b === 1 ? Math.sin(Math.PI * clamp((t1 - FLIP[0]) / (FLIP[1] - FLIP[0]))) : 0
        v1.set(-0.45, BIF_R[1] + 0.03, 0).applyQuaternion(bifHold).add(biface.mesh.position)
        v1.y += 0.35 * toss
        v2.set(-0.55, 0.82, 0.12).normalize()
        v3.set(0.55, -0.3, -0.78)
        v3.addScaledVector(v2, -v2.dot(v3)).normalize()
        handL.place(v1, H.anchors.palm, v3, v2)
        if (lift > 0) {
          fA.e.copy(handL.elbow)
          fA.q.setFromRotationMatrix(m4.makeBasis(handL.X, handL.Y, handL.Z))
          v1.set(-0.5, -BIF_R[1] - 0.06, 0).applyQuaternion(bifHold).add(biface.mesh.position)
          handL.place(v1, H.anchors.palm, v3.set(1, 0, 0).applyQuaternion(bifHold), v2.set(0, -1, 0).applyQuaternion(bifHold))
          fB.e.copy(handL.elbow)
          fB.q.setFromRotationMatrix(m4.makeBasis(handL.X, handL.Y, handL.Z))
          handL.elbow.lerpVectors(fA.e, fB.e, lift)
          qC.slerpQuaternions(fA.q, fB.q, lift)
          handL.orient(XA2.set(1, 0, 0).applyQuaternion(qC), YA2.set(0, 1, 0).applyQuaternion(qC))
        }
        // changing hold, the hand opens and comes clear of the stone, then closes on it from below
        const between = Math.sin(Math.PI * lift)
        handL.elbow.addScaledVector(handL.Y, 0.9 * between)
        handL.ch.cup = mix(0.75, 0.55, lift) * (1 - 0.6 * toss) * (1 - between)
        handL.ch.curl = mix(0.2, 0.5, lift) * (1 - between)
      }
      if (b === 2) {
        // put the hand-axe down, let go, and come back with the pyrite in a power grip, held over the tinder
        const kitP = s.k(2, 0.75, 1.25, E.io3)
        fA.e.copy(handL.elbow)
        fA.q.setFromRotationMatrix(m4.makeBasis(handL.X, handL.Y, handL.Z))
        // palm up, the fingers pointing right and away: the pyrite's top face is the struck one
        frameFrom(XL, YL, v2.set(0.9, 0.12, -0.5).normalize(), v3.set(-0.2, -1, 0.15), XA2, YA2)
        v1.copy(sparkAt).add(v3.set(-0.08, -PYR_R[1] * 0.8, -0.04))
        v1.y += 0.03 * kick(K2, t2)
        handL.place(v1, PYR_AT, XA2, YA2)
        handL.elbow.addScaledVector(handL.X, -5 * gone)
        fB.e.copy(handL.elbow)
        fB.q.setFromRotationMatrix(m4.makeBasis(handL.X, handL.Y, handL.Z))
        handL.elbow.lerpVectors(fA.e, fB.e, kitP)
        handL.elbow.y += 1.2 * Math.sin(kitP * Math.PI)
        qC.slerpQuaternions(fA.q, fB.q, kitP)
        handL.orient(XA2.set(1, 0, 0).applyQuaternion(qC), YA2.set(0, 1, 0).applyQuaternion(qC))
        const rel = s.k(2, 0.6, 0.95, E.io2)
        handL.ch.cup = mix(0.5 * (1 - rel), 0, kitP)
        handL.ch.core = kitP
      }
      handL.herd.group.visible = b < 2 || gone < 0.97
      handL.update()
      if (b === 2) {
        handL.ride(PYR_AT, pyrite.mesh.position)
        pyrite.mesh.quaternion.copy(handL.q)
        pyrite.mesh.visible = s.k(2, 0.75, 1.25, E.io3) > 0.02 && gone < 1
        pressL.c.value.copy(pyrite.mesh.position)
        pressL.q.value.set(handL.q.x, handL.q.y, handL.q.z, handL.q.w)
        pressL.r.value.set(PYR_R[0], PYR_R[1], PYR_R[2])
        pressL.amt.value = pyrite.mesh.visible ? 1 : 0
      }
      handL.ride(H.anchors.palm, pcL)
      occ[OCC.handL].set(pcL.x, pcL.y, pcL.z, handL.herd.group.visible ? 0.45 : 0)
      v1.copy(pcL).lerp(handL.elbow, 0.55)
      occ[OCC.armL].set(v1.x, v1.y, v1.z, handL.herd.group.visible ? 0.4 : 0)
    }

    if (b === 2) people.pose(s.time, U.uFirePos.value)
    // ---- occluders: what stands between a surface and the key
    occ[OCC.stone].set(stonePos.x, stonePos.y, stonePos.z, useBif ? 0.3 : 0.6)

    // ---- camera
    const hh = shake(s.time, 1, 0.16)
    const fov = FOV
    let dist = 6.4, az = 0.2, el = 0.6, focus = 0, ap = 1.5, roll = 0
    if (b === 0) {
      const n = punches(K0, t0) - 1 // the first blow is the arrival
      const kk = kick(K0, t0)
      tgt.copy(CORE_C).add(v1.set(0.2, 0.0, 0.2))
      dist = 8.6 * Math.pow(0.95, n) - 0.035 * clamp(t0, 0, 10) + 0.5 * (1 - E.out3(clamp((t0 + 2.2) / 2.2)))
      az = 0.04 + 0.06 * (Math.round(n) % 2 ? 1 : -1) * clamp(n) + 0.012 * t0
      el = 0.34 - 0.012 * n
      roll = 0.012 * kk * (k0 % 2 ? 1 : -1)
      tgt.y -= 0.03 * kk
      look.set(-0.85, 0.28, 0)
    } else if (b === 1) {
      const n = punches(K1, t1, 0.14)
      const kk = kick(K1, t1)
      const up = lift
      tgt.copy(biface.mesh.position)
      dist = mix(8.4 * Math.pow(0.985, n), 6.4, up) - 0.05 * Math.max(0, t1 - LIFT[1])
      az = mix(-0.05 + 0.015 * n, 0.55 + 0.035 * Math.max(0, t1 - LIFT[1]), E.io2(up))
      el = mix(0.36, 0.06, up)
      roll = 0.008 * kk * (k1 % 2 ? 1 : -1)
      look.set(mix(-0.7, -0.75, up), mix(0.25, 0.05, up), 0)
      ap = mix(1.5, 2.3, up)
    } else {
      // forward and low to the tinder, the hand-axe left sharp for a moment in the foreground, then the rack
      const go = s.k(2, 0, 1.25, E.io3)
      const back = s.k(2, FLAME - 0.2, FLAME + 3.2, E.io3)
      // the drift stops where the beat's hold ends, so live play (which may linger) leaves the lens where seek does and torch picks it up
      const hold = clamp(t2 - FLAME - 3.2, 0, HOLD_END - FLAME - 3.2)
      v1.copy(biface.mesh.position)
      v2.copy(TINDER).add(v3.set(0, 0.3, 0))
      tgt.lerpVectors(v1, v2, go).lerp(v3.set(HEARTH.x - 0.4, 3.0, HEARTH.z - 2), back)
      dist = mix(mix(4.6, 4.7, go), 33, back) - 0.15 * hold
      az = mix(mix(0.55, -0.32, go), -0.1, back) + 0.006 * hold
      el = mix(mix(0.06, 0.34, go), 0.1, back)
      look.set(mix(mix(-0.75, -0.45, go), -0.25, back), mix(mix(0.05, 0.1, go), -0.12, back), 0)
      const n = punches(K2, t2, 0.16)
      dist *= Math.pow(0.975, n * (1 - back))
      roll = 0.008 * kick(K2, t2)
      ap = mix(2.3, 2.6, back)
    }
    camP.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(tgt)
    camP.x += hh[0] * 0.035 + s.mouse.x * 0.12
    camP.y += hh[1] * 0.03 + s.mouse.y * 0.08
    camera.position.copy(camP)
    camera.up.set(Math.sin(roll), Math.cos(roll), 0)
    camera.lookAt(tgt)
    // the subject sits right of centre: slide the view, in units of the frame at the subject
    const span = dist * Math.tan((fov * Math.PI) / 360)
    camera.translateX(look.x * span)
    camera.translateY(look.y * span)
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    // focus: on the struck edge; in beat 3 racked from the hand-axe to the tinder, then the hearth
    camera.getWorldDirection(v1)
    if (b === 2) {
      const rack = s.k(2, 0.75, 1.25, E.io3)
      const back = s.k(2, FLAME - 0.2, FLAME + 3.2, E.io3)
      v2.copy(biface.mesh.position).lerp(TINDER, rack).lerp(HEARTH, back)
      focus = v3.subVectors(v2, camera.position).dot(v1)
    } else focus = v3.subVectors(b === 1 ? biface.mesh.position : strikeW, camera.position).dot(v1)
    U.uCam.value.copy(camera.position)
    camRight.value.setFromMatrixColumn(camera.matrixWorld, 0)
    U.uFwd.value.copy(v1)
    U.uFocus.value = focus
    U.uAp.value = ap + blink * 6
    D.uMax.value = 0.02 + 0.012 * s.k(2, FLAME, FLAME + 3, E.io2)

    // ---- where things are for the listener, and where the ember has to land
    listenerPos(strikeW, camera, dist, W.strike)
    listenerPos(TINDER, camera, dist, W.tind)
    if (b === 0 && t0 <= 0.05) {
      v2.copy(CORE_SCARS[0].q).add(CORE_C).project(camera)
      EMBER_HIT.x = v2.x * 0.5 + 0.5
      EMBER_HIT.y = v2.y * 0.5 + 0.5
    }
    // dust rises where each blow fell
    // (a pure function of the clock, so a seek shows the same puff: the core's are fixed, the hand-axe's follow it)
    if (b === 1 && tau1 >= 0) dustPos[K0.length + k1].set(strikeW.x, strikeW.y, strikeW.z, 100 + K1[k1])
    if (b === 2 && tau2 >= 0) dustPos[NK + near.k].set(sparkAt.x, sparkAt.y, sparkAt.z, 200 + K2[near.k])

    // ---- the rule of ages
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    placeRule(rule, camera, { dist: 1.2, lean: 0.16 })

    POST.exposure = (1 - 0.55 * blink) * mix(1, 1.25, night * (1 - fire))
    POST.bloom = 0.3 + 0.35 * fire
    POST.vignette = 0.32 + 0.12 * night
    if (ctx.debugLabels) {
      // the review tool counts magenta: give it the plates as painted
      POST.tone = "none"
      POST.bloom = 0
      POST.exposure = 1
      POST.vignette = 0
    }

    if (s.live) {
      ctx.synth.bed("air", 0.5 * (1 - fire))
      ctx.synth.bed("wind", 0.12 * (1 - night))
      ctx.synth.bed("crackle", Math.max(W.glow * 0.25, fire * 0.9))
      ctx.synth.bed("fire", fire * 0.7)
    }
  }

  const strikePos = () => W.strike
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    ...K0.flatMap((at, i): Cue[] => [
      { b: 0, at, s: "knap", o: { f: H(18 + i), g: 0.95 }, pos: strikePos },
      { b: 0, at: at + 0.005, s: "thud", o: { f: 70, g: i ? 0.22 : 0.5 }, pos: strikePos },
    ]),
    ...K1.flatMap((at, i): Cue[] => [{ b: 1, at, s: "knap", o: { f: H(26 + i), g: 0.7 }, pos: strikePos }]),
    { b: 1, at: LIFT[0], s: "pad", o: { f: H(4), g: 0.3, dur: 4 } },
    { b: 1, at: LIFT[0] + 0.1, s: "shimmer", o: { g: 0.22, dur: 2.5 } },
  ]
  // beat 3: flint on pyrite (a scrape and a click), the breaths, the catch, the flame
  const tindPos = () => W.tind
  K2.forEach((at, j) => {
    cues.push({ b: 2, at, s: "knap", o: { f: H(40 + j * 2), g: 0.55 }, pos: tindPos }, { b: 2, at: at - 0.06, s: "scratch", o: { g: 0.4, dur: 0.12 }, pos: tindPos }, { b: 2, at: at + 0.03, s: "sizzle", o: { g: 0.12 + 0.08 * j, dur: 0.25 }, pos: tindPos })
  })
  cues.push(
    { b: 2, at: K2[2] + 0.12, s: "crackle", o: { g: 0.35, dur: 0.5 }, pos: tindPos },
    { b: 2, at: BREATH[0], s: "hiss", o: { g: 0.3, dur: 0.5 }, pos: [0, -0.2, -0.6] },
    { b: 2, at: BREATH[1], s: "hiss", o: { g: 0.36, dur: 0.6 }, pos: [0, -0.2, -0.6] },
    { b: 2, at: FLAME, s: "whoosh", o: { f: 240, g: 0.4, dur: 0.9 }, pos: tindPos },
    { b: 2, at: FLAME + 0.05, s: "boom", o: { f: H(2), g: 0.45, dur: 2.2 } },
    { b: 2, at: FLAME + 0.1, s: "crackle", o: { g: 0.6, dur: 1.4 }, pos: tindPos },
    { b: 2, at: FLAME + 1.6, s: "pad", o: { f: H(3), g: 0.3, dur: 5 } },
  )
  // every flake ticks down on to the scatter, where it lands
  for (let i = 0; i < NK; i++) {
    const b = i < K0.length ? 0 : 1
    const at = (b ? K1[i - K0.length] : K0[i]) + flakeLand[i]
    const p = flakeRest[i]
    cues.push({ b, at, s: "tick", o: { f: 2300 + ((i * 331) % 900), g: b ? 0.22 : 0.4 }, pos: () => listenerPos(p, camera) }, { b, at: at + 0.15, s: "tick", o: { f: 3100 + ((i * 197) % 700), g: b ? 0.1 : 0.2 }, pos: () => listenerPos(p, camera) })
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: world, camera, target: stage },
      { pass: dof, target: hdr },
    ],
    render() {
      const r = ctx.renderer
      r.setRenderTarget(stage)
      r.render(world, camera)
      D.tS.value = stage.texture
      dof.render(hdr)
      ctx.finish(hdr.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,.65)", color: "#f6ecdc" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: (): LabelInfo[] => ruleLabels(face),
    dispose() {
      face.dispose()
      people.dispose()
      handR.herd.dispose()
      handL.herd.dispose()
      disposeTree(world)
      for (const t of texs) t.dispose()
    },
  }
}
