// Scene 24, fold: "Seeing, then folding". The AI age, 2012 and 2020.
//
// Staging. Beat 0: a table-top bar chart on a black epoxy lab bench. Every year's bar is the same
// 30 cm plaster casting, driven down through the bench top until what stands above it is that
// year's ImageNet top-5 error, 1 point to the centimetre (the winning entry, Russakovsky et al. 2015).
// 2010 and 2011 already stand. 2012 falls from above and punches through the bench to 16.4: the
// top cracks round it, chips are thrown on closed-form arcs, plaster dust puffs out. 2013 and 2014
// follow, each driven deeper. The three years that have bootstrap intervals (2012 to 2014, and
// only those) carry them to scale as small steel brackets proud of the block's face. A value flag
// rises on a pin only once its block is at that value; the year stands on a tent card in front.
// Beat 1: the lens cranes up off the chart to a glass ribbon hanging over it, lit from inside: the
// backbone of protein G's B1 domain (PDB 1PGA, X-ray, 56 residues), drawn the way structural
// biologists draw it: the helix a right-handed ribbon, the four strands twisted arrows pointing N to
// C, the loops thin tubes. It starts as a loose chain and folds while the lens orbits it, local
// structure first; hydrogen bonds (each helix residue's C=O to the N-H four along, and across the
// paired strands) light up as threads as they come within reach. At the end it is exactly the
// deposited coordinates. The path it takes is a drawing: AlphaFold predicts the finished
// structure; it does not simulate folding (the script's note says so).
//
// Story parameter. Beat 0 `err`: which bars have been driven home. Beat 1 `fold`, 0..1.
// World rule. One key (a big soft panel up and to the left, front) shadowing through every block,
// and one inner light, the ribbon's glow (a point at its centre whose strength is the fold), on
// bench, blocks, chips, dust and the rule.
// Beat sheet, facts and references: R/beats/fold.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, floor, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, Discard, dot, exp, float, Fn, fract, length, max, min, mix as mixN, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, reflect, select, sin, smoothstep, texture, uniform, uniformTexture, uv, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, ramp, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, labelFloor, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, vnoise3, type F, type V2, type V3 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { TRACE_DUR, TRACE_IN } from "../transitions/trace"

const START = TRACE_DUR * (1 - TRACE_IN)
const FOV = 30

// ---------------------------------------------------------------- the chart, in centimetres

const BW = 8 // block width
const BL = 30 // every bar is the same casting
const PITCH = 16
const G = 1200 // cm/s², a little more than gravity: the drop reads at the deck's pace
const FALL = 0.32 // seconds of free fall before the bar meets the bench
const V0 = G * FALL
type Bar = { year: string; v: number; ci?: [number, number]; drop?: number }
// Russakovsky et al. 2015 (arXiv 1409.0575): winners by year, and the 99.9% bootstrap intervals
// of section 6.2, which exist for 2012 to 2014 only.
const DATA: Bar[] = [
  { year: "2010", v: 28.2 },
  { year: "2011", v: 25.8 },
  { year: "2012", v: 16.4, ci: [16.04, 16.8], drop: 0.95 },
  { year: "2013", v: 11.7, ci: [11.41, 12.08], drop: 1.62 },
  { year: "2014", v: 6.7, ci: [6.4, 6.92], drop: 2.08 },
]
const NB = DATA.length
const bx = (i: number) => (i - 2) * PITCH
/** How long a bar takes to stop once it meets the bench (out3, matched to the speed it arrives at). */
const tauOf = (i: number) => (3 * (BL - DATA[i].v)) / V0
/** The top of bar i at t seconds into beat 0 (null: not yet in the air above the frame). */
function barTop(i: number, t: number): number | null {
  const b = DATA[i]
  if (b.drop === undefined) return b.v
  const T = b.drop
  if (t < T - FALL - 0.04) return null
  if (t < T) return BL + 0.5 * G * (T - t) * (T - t)
  const D = BL - b.v
  const tau = tauOf(i)
  const u = (t - T) / tau
  if (u < 1) return BL - D * E.out3(u)
  const r = t - T - tau
  return b.v + 0.22 * (D / 13.6) * Math.exp(-r * 16) * Math.sin(r * 48)
}
const FLAG_DX = [-1.6, 2.2, 1.2, 1.2, 1.2] // pins splay so the two tall flags do not touch
const TENT_Z = BW / 2 + 7.5 // the year cards stand well clear of the chips and dust
const settledAt = (i: number) => (DATA[i].drop === undefined ? -99 : DATA[i].drop! + tauOf(i) + 0.08)

// ---------------------------------------------------------------- the protein: PDB 1PGA, chain A (Gallagher et al. 1994)
// CA and O of all 56 residues, in ångströms, centred on the CA centroid. Fetched from files.rcsb.org.
// prettier-ignore
const CA0 = [1.19,8.79,11.02,3.24,5.87,9.73,1.45,3.46,7.36,2.41,0.07,6.02,1.81,-1.49,2.67,1.76,-5.26,2.21,2.28,-6.09,-1.5,1.13,-9.51,-2.71,1.72,-9.17,-6.42,2.62,-11.93,-8.84,6.18,-10.61,-9.25,6.77,-8.27,-6.29,6.09,-9.18,-2.71,7.08,-7.37,0.38,6.41,-4.73,2.94,7.12,-1.03,3.09,5.86,1.89,5.14,5.17,5.59,4.56,4.64,8.71,6.65,1.48,10.67,5.79,-1.05,13.14,7.32,-3.95,10.83,6.86,-4.91,7.57,5.21,-6.24,9.26,1.99,-2.83,10.68,1.37,-0.97,7.38,2.21,-3.37,5.61,-0.16,-2.29,7.95,-3.05,1.41,7.53,-2.3,1.13,3.73,-2.1,-1.01,3.38,-5.22,1.54,5.38,-7.1,4.3,3.22,-5.55,2.45,0.06,-6.68,1.8,1.53,-10.06,5.44,2.43,-10.67,6.44,-1.13,-9.78,4.04,-2.84,-12.2,1.51,-3.92,-9.55,-2.2,-3.82,-10.31,-4.4,-5.59,-7.78,-7.19,-5.41,-5.2,-6.7,-3.15,-2.2,-7.91,-3.11,1.38,-7.09,-0.69,4.16,-7.28,-1.59,7.86,-7.3,1.43,10.04,-6.99,-0.7,13.15,-3.44,-1.51,12.11,-2.92,1.36,9.65,-2.25,-1.24,6.93,-2.91,-1.26,3.21,-2.59,-4.42,1.19,-2.62,-4.81,-2.63,-3.11,-8.25,-4.14,-2.92,-9.41,-7.76]
// prettier-ignore
const O0 = [2.23,8.36,8.89,1.72,4.03,10.12,3.45,2.64,6.34,0.45,-0.34,4.66,3.51,-3.1,2.6,0.21,-5.37,0.26,3.31,-8.21,-1.53,-0.15,-9.81,-4.73,2.73,-11.35,-6.13,4.75,-13,-8.59,7.95,-10.37,-7.64,4.78,-8.34,-4.87,8.11,-8.59,-1.69,5.07,-6.52,1.3,8.44,-3.47,2.91,5.09,-0.67,4.2,6.81,3.59,3.71,4.19,5.94,6.66,3.83,9.94,4.77,0.39,10.76,7.87,-2.83,12.46,8.74,-3,9.64,5.01,-4.65,7.15,2.84,-4.83,9.39,0.09,-1.28,9.29,0.21,-0.68,5.91,0.33,-2.71,5.27,-2.48,-0.39,7.35,-4.44,2.52,5.72,-3.45,1.32,2.42,-4.1,0.25,3.05,-7.16,3.38,4.11,-8.01,4.85,1.39,-7.08,2.98,-0.64,-8.85,3.37,0.95,-11.8,7.16,0.95,-11.38,6.03,-3.45,-10.26,2.51,-4.58,-12.15,0.05,-2.06,-10.08,-3.42,-5.9,-10.27,-6.04,-3.9,-7.31,-5.51,-5.44,-3.5,-8.87,-3.39,-1.22,-5.91,-1.93,1.94,-8.88,-1.09,5.63,-5.52,-0.58,9.2,-6.14,1.73,12.03,-4.95,-1.08,14.28,-1.53,-0.66,10.99,-1.28,1.18,7.92,-4.24,-1.45,5.63,-1.18,-2.87,2.89,-4.16,-3.89,-0.54,-1.31,-6.83,-2.73,-4.48,-8.12,-6.04,-3.12,-11.68,-7.03]
const NR = 56
// secondary structure from the file's HELIX and SHEET records (residues 1-based there, 0-based here)
const HELIX: [number, number][] = [[22, 35]]
const STRANDS: [number, number][] = [[0, 8], [11, 19], [41, 45], [49, 55]]
const KIND = Array.from({ length: NR }, (_, i) => (HELIX.some(([a, b]) => i >= a && i <= b) ? 1 : STRANDS.some(([a, b]) => i >= a && i <= b) ? 2 : 0))
const STRAND_END = new Set(STRANDS.map(([, b]) => b))
/** When each residue's local geometry settles, as a window of the fold: the helix first, then the hairpin turns, the strands, the long loops last. Illustration. */
const WIN = Array.from({ length: NR }, (_, i): [number, number] => {
  if (KIND[i] === 1) return [0.02 + (i - 22) * 0.008, 0.36 + (i - 22) * 0.008]
  if (i === 9 || i === 10 || (i >= 46 && i <= 48)) return [0.16, 0.5]
  if (KIND[i] === 2) return [0.3 + (i % 7) * 0.012, 0.74 + (i % 7) * 0.01]
  return [0.42, 0.97]
})
const ANCHOR = 27 // the chain is rebuilt outward from residues 26 to 28 (inside the helix)

type Vec = [number, number, number]
const v3 = (a: number[], i: number): Vec => [a[3 * i], a[3 * i + 1], a[3 * i + 2]]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const crs = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const nrm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
/** IUPAC dihedral: positive is clockwise looking down b→c. The 1PGA helix reads about +50° (right-handed). */
const dihedral = (a: Vec, b: Vec, c: Vec, d: Vec) => {
  const b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c)
  const n1 = crs(b1, b2), n2 = crs(b2, b3)
  return Math.atan2(dot3(crs(n1, n2), nrm(b2)), dot3(n1, n2))
}
const angle = (b: Vec, c: Vec, d: Vec) => Math.acos(clamp(dot3(nrm(sub(b, c)), nrm(sub(d, c))), -1, 1))
/** NeRF: place d from a, b, c given |cd|, the angle bcd and the dihedral abcd. Writes into `out` at index k. */
function place(P: Float32Array, a: number, b: number, c: number, k: number, L: number, th: number, ph: number) {
  const bcx = P[3 * c] - P[3 * b], bcy = P[3 * c + 1] - P[3 * b + 1], bcz = P[3 * c + 2] - P[3 * b + 2]
  const bl = Math.hypot(bcx, bcy, bcz)
  const ux = bcx / bl, uy = bcy / bl, uz = bcz / bl
  const abx = P[3 * b] - P[3 * a], aby = P[3 * b + 1] - P[3 * a + 1], abz = P[3 * b + 2] - P[3 * a + 2]
  let nx = aby * uz - abz * uy, ny = abz * ux - abx * uz, nz = abx * uy - aby * ux
  const nl = Math.hypot(nx, ny, nz) || 1
  nx /= nl
  ny /= nl
  nz /= nl
  const mx = ny * uz - nz * uy, my = nz * ux - nx * uz, mz = nx * uy - ny * ux
  const x = -L * Math.cos(th), y = L * Math.sin(th) * Math.cos(ph), z = L * Math.sin(th) * Math.sin(ph)
  P[3 * k] = P[3 * c] + ux * x + mx * y + nx * z
  P[3 * k + 1] = P[3 * c + 1] + uy * x + my * y + ny * z
  P[3 * k + 2] = P[3 * c + 2] + uz * x + mz * y + nz * z
}
// internal coordinates of the native chain, built outward from the anchor in both directions
const IC = Array.from({ length: NR }, (_, i) => {
  if (i > ANCHOR + 1) return { L: Math.hypot(...sub(v3(CA0, i), v3(CA0, i - 1))), th: angle(v3(CA0, i - 2), v3(CA0, i - 1), v3(CA0, i)), ph: dihedral(v3(CA0, i - 3), v3(CA0, i - 2), v3(CA0, i - 1), v3(CA0, i)) }
  if (i < ANCHOR - 1) return { L: Math.hypot(...sub(v3(CA0, i), v3(CA0, i + 1))), th: angle(v3(CA0, i + 2), v3(CA0, i + 1), v3(CA0, i)), ph: dihedral(v3(CA0, i + 3), v3(CA0, i + 2), v3(CA0, i + 1), v3(CA0, i)) }
  return { L: 3.8, th: 0, ph: 0 }
})
// The loose chain it starts from (illustration): a random coil grown outward from the anchor the same
// way rebuild() grows it, each residue's angles picked from seeded candidates so that its CA keeps
// 6 Å from every residue already placed (a chain does not pass through itself) and the coil stays
// within about 19 Å of its middle, so it hangs in frame rather than trailing out of it.
const COIL = (() => {
  const r = rng(2404)
  const out = Array.from({ length: NR }, () => ({ th: 1.9, ph: Math.PI }))
  const P = new Float32Array(NR * 3)
  const placed: number[] = []
  for (const j of [ANCHOR - 1, ANCHOR, ANCHOR + 1]) {
    P.set([CA0[3 * j], CA0[3 * j + 1], CA0[3 * j + 2]], 3 * j)
    placed.push(j)
  }
  const cx = CA0[3 * ANCHOR], cy = CA0[3 * ANCHOR + 1], cz = CA0[3 * ANCHOR + 2]
  const grow = (i: number, a: number, b: number, c: number) => {
    let best = -Infinity, bt = 1.9, bp = Math.PI
    for (let k = 0; k < 40; k++) {
      const th = 1.65 + r() * 0.55, ph = (r() - 0.5) * 2 * Math.PI
      place(P, a, b, c, i, IC[i].L, th, ph)
      let dmin = Infinity
      for (const j of placed) {
        if (Math.abs(i - j) < 3) continue
        dmin = Math.min(dmin, Math.hypot(P[3 * i] - P[3 * j], P[3 * i + 1] - P[3 * j + 1], P[3 * i + 2] - P[3 * j + 2]))
      }
      const rad = Math.hypot(P[3 * i] - cx, P[3 * i + 1] - cy, P[3 * i + 2] - cz)
      const score = Math.min(dmin, 6.5) * 2 - Math.max(0, rad - 19) * 1.5 + r() * 0.8
      if (score > best) {
        best = score
        bt = th
        bp = ph
      }
    }
    place(P, a, b, c, i, IC[i].L, bt, bp)
    out[i] = { th: bt, ph: bp }
    placed.push(i)
  }
  for (let n = 1; n < NR; n++) {
    const up = ANCHOR + 1 + n, dn = ANCHOR - 1 - n
    if (up < NR) grow(up, up - 3, up - 2, up - 1)
    if (dn >= 0) grow(dn, dn + 3, dn + 2, dn + 1)
  }
  return out
})()
// each carbonyl O in the local frame of (CA i-1, CA i, CA i+1), so the ribbon's guide follows the chain as it folds
function frameAt(P: ArrayLike<number>, i: number, out: number[]) {
  const j = Math.min(NR - 2, Math.max(1, i))
  const ax = P[3 * j + 3] - P[3 * j - 3], ay = P[3 * j + 4] - P[3 * j - 2], az = P[3 * j + 5] - P[3 * j - 1]
  const al = Math.hypot(ax, ay, az)
  const e1x = ax / al, e1y = ay / al, e1z = az / al
  let bx2 = P[3 * j] - (P[3 * j + 3] + P[3 * j - 3]) / 2, by2 = P[3 * j + 1] - (P[3 * j + 4] + P[3 * j - 2]) / 2, bz2 = P[3 * j + 2] - (P[3 * j + 5] + P[3 * j - 1]) / 2
  const d = bx2 * e1x + by2 * e1y + bz2 * e1z
  bx2 -= d * e1x
  by2 -= d * e1y
  bz2 -= d * e1z
  const bl = Math.hypot(bx2, by2, bz2) || 1
  const e2x = bx2 / bl, e2y = by2 / bl, e2z = bz2 / bl
  out[0] = e1x; out[1] = e1y; out[2] = e1z
  out[3] = e2x; out[4] = e2y; out[5] = e2z
  out[6] = e1y * e2z - e1z * e2y; out[7] = e1z * e2x - e1x * e2z; out[8] = e1x * e2y - e1y * e2x
}
const OC = (() => {
  const f: number[] = []
  const out: number[] = []
  for (let i = 0; i < NR; i++) {
    frameAt(CA0, i, f)
    const d = sub(v3(O0, i), v3(CA0, i))
    out.push(d[0] * f[0] + d[1] * f[1] + d[2] * f[2], d[0] * f[3] + d[1] * f[4] + d[2] * f[5], d[0] * f[6] + d[1] * f[7] + d[2] * f[8])
  }
  return out
})()
/** N of residue j, near enough: 1.46 Å from its CA toward the CA before. */
const nAt = (P: ArrayLike<number>, j: number, k: number) => P[3 * j + k] + (j > 0 ? (P[3 * (j - 1) + k] - P[3 * j + k]) * 0.385 : 0)
// hydrogen bonds: in the helix C=O(i) to N-H(i+4); across the sheet each strand C=O to the nearest strand N-H within 3.3 Å
const HB = (() => {
  const out: { o: number; n: number; L: number }[] = []
  const dist = (o: number, n: number) => Math.hypot(O0[3 * o] - nAt(CA0, n, 0), O0[3 * o + 1] - nAt(CA0, n, 1), O0[3 * o + 2] - nAt(CA0, n, 2))
  for (let i = HELIX[0][0]; i + 4 <= HELIX[0][1]; i++) out.push({ o: i, n: i + 4, L: dist(i, i + 4) })
  for (let i = 0; i < NR; i++) {
    if (KIND[i] !== 2) continue
    let best = -1, bd = 3.3
    for (let j = 1; j < NR; j++) if (KIND[j] === 2 && Math.abs(i - j) > 3 && dist(i, j) < bd) {
      bd = dist(i, j)
      best = j
    }
    if (best >= 0) out.push({ o: i, n: best, L: bd })
  }
  return out
})()

// the ribbon: a Catmull-Rom spline through the CAs, a cross-section per residue kind
const SEG = 8
const RING = 12
const NP = (NR - 1) * SEG + 1
const ASC = 0.55 // centimetres per ångström

// ---------------------------------------------------------------- small TSL helpers

const ssN = (e0: number, e1: number, x: F): F => {
  const k = x.sub(e0).div(e1 - e0).clamp(0, 1)
  return k.mul(k).mul(k.mul(-2).add(3)) as F
}

export function create(ctx: Ctx): SceneInstance {
  const L_KEY = new THREE.Vector3(-0.46, 0.74, 0.5).normalize()
  const U = {
    key: uniform(L_KEY.clone()),
    keyCol: uniform(new THREE.Vector3(2.3, 2.2, 2.05)),
    sky: uniform(new THREE.Vector3(0.075, 0.082, 0.1)),
    glowP: uniform(new THREE.Vector3(0, 44, 2)),
    glow: uniform(0),
    glowCol: uniform(new THREE.Vector3(1.0, 0.84, 0.62)),
    tops: [0, 1, 2, 3, 4].map(() => uniform(0)),
    crack: [0, 1, 2, 3, 4].map(() => uniform(0)),
    pulse: uniform(-1),
    time: uniform(0),
  }

  // world rule: the key's soft shadow through every bar standing on (or in) the bench
  const keyShadow = (p: V3): F => {
    const lit = float(1).toVar()
    const L = U.key
    for (let i = 0; i < NB; i++) {
      const x0 = bx(i) - BW / 2, x1 = bx(i) + BW / 2
      const top = U.tops[i]
      const sx1 = float(x0).sub(p.x).div(L.x), sx2 = float(x1).sub(p.x).div(L.x)
      const sz1 = float(-BW / 2).sub(p.z).div(L.z), sz2 = float(BW / 2).sub(p.z).div(L.z)
      const a = max(max(min(sx1, sx2), min(sz1, sz2)), max(top.sub(BL).sub(p.y).div(L.y), 0.06))
      const b = min(min(max(sx1, sx2), max(sz1, sz2)), top.sub(p.y).div(L.y))
      const pen = a.mul(0.16).add(0.35)
      lit.mulAssign(float(1).sub(smoothstep(float(0), pen, b.sub(a)).mul(0.88)))
    }
    return lit
  }
  /** The ribbon's inner light on a surface: Lambert over a soft inverse square. */
  const glowOn = (p: V3, N: V3): V3 => {
    const d = U.glowP.sub(p)
    const r2 = dot(d, d)
    const lam = max(dot(N, normalize(d)), 0).mul(0.8).add(0.2)
    return U.glowCol.mul(U.glow).mul(lam).mul(float(1400).div(r2.add(160))) as V3
  }

  // ---------------------------------------------------------------- the room: bench, wall

  const room = new THREE.Scene()
  // The far wall, 130 cm behind the bench, always out of focus at the bench's distance, so it is drawn
  // soft: a steel-framed window on the left (overcast daylight, the roofline of the next building low
  // in it), and to its right steel shelving with reagent bottles (amber, clear, brown; paper labels).
  const WW = { x: -185, y: 86, hw: 54, hh: 64 }
  const winLight = (x: F, y: F): V3 => {
    const dx = abs(x.sub(WW.x)), dy = abs(y.sub(WW.y))
    const open = ssN(WW.hw, WW.hw - 4, dx).mul(ssN(WW.hh, WW.hh - 4, dy))
    const bars = ssN(1.0, 4.0, abs(x.sub(WW.x))).mul(ssN(1.0, 4.0, abs(fract(y.sub(WW.y - WW.hh).div(32).add(0.5)).sub(0.5)).mul(32)))
    // sky over a neighbouring roofline (overcast: brighter up, a dull band of brick and slate low down)
    const roof = y.sub(WW.y - WW.hh).sub(hash21(vec2(floor(x.div(23)), 4.0)).mul(16).add(14))
    const sky = mixN(vec3(0.5, 0.56, 0.64), vec3(1.05, 1.12, 1.25), ssN(10, 120, y.sub(WW.y - WW.hh)))
    const view = mixN(vec3(0.07, 0.065, 0.065), sky, ssN(-3, 3, roof))
    return view.mul(open).mul(bars).mul(0.95) as V3
  }
  const wallLook = (x: F, y: F): V3 => {
    const tone = fbm(vec2(x, y).mul(0.02)).mul(0.3).add(0.85)
    // the key's spill on the plaster, falling off to the right and down; the window's own light round its reveal
    const spill = exp(length(vec2(x, y).sub(vec2(-90, 70)).mul(vec2(0.006, 0.009))).mul(-1.6))
    const reveal = exp(length(max(abs(vec2(x.sub(WW.x), y.sub(WW.y))).sub(vec2(WW.hw, WW.hh)), vec2(0))).mul(-0.05))
    const plaster = vec3(0.07, 0.074, 0.082).mul(tone).mul(spill.mul(1.4).add(0.12).add(reveal.mul(0.5))).toVar()
    // shelving: three steel shelves from right of the window, bottles standing on each
    const onShelf = ssN(WW.x + WW.hw + 14, WW.x + WW.hw + 20, x).toVar()
    const sy = y.sub(34).div(42)
    const row = floor(sy)
    const inRow = row.greaterThanEqual(0).and(row.lessThan(3))
    const ly = fract(sy).mul(42).toVar() // height above this shelf's board
    const board = ssN(3.6, 2.0, ly).mul(onShelf)
    const lit = plaster.mul(spill.mul(0.6).add(0.5))
    const boardC = vec3(0.11, 0.115, 0.12).mul(spill.mul(1.6).add(0.3)).add(vec3(0.05).mul(ssN(3.2, 2.8, ly)))
    const cw = 12.5
    const cell = floor(x.div(cw))
    const h1 = hash21(vec2(cell, row.add(3))), h2 = hash21(vec2(cell, row.add(11))), h3 = hash21(vec2(cell, row.add(23)))
    const bh = h2.mul(17).add(11)
    const bw = h3.mul(2.2).add(2.6)
    const fx = fract(x.div(cw)).sub(0.5).mul(cw).sub(hash21(vec2(cell, row.add(31))).sub(0.5).mul(4))
    const neck = ssN(0.72, 0.86, ly.sub(3.6).div(bh))
    const half = mixN(bw, bw.mul(0.38), neck)
    const bottle = smoothstep(half.sub(1.6), half.add(1.6), abs(fx)).oneMinus().mul(ssN(3.0, 4.2, ly)).mul(smoothstep(bh.add(3.2), bh.add(4.6), ly).oneMinus()).mul(step01(h1.sub(0.3))).mul(onShelf).toVar()
    const glass = mixN(mixN(vec3(0.16, 0.07, 0.018), vec3(0.06, 0.035, 0.02), step01(h1.sub(0.6))), vec3(0.13, 0.14, 0.15), step01(h1.sub(0.82)))
    const glint = ssN(0.9, 0.0, abs(fx.add(half.mul(0.45)))).mul(0.25)
    const label = ssN(0.9, 0.2, abs(ly.sub(3.6).div(bh).sub(0.42)).mul(5)).mul(smoothstep(half.sub(0.8), half, abs(fx)).oneMinus()).mul(step01(h3.sub(0.3)))
    const bc = glass.mul(spill.mul(1.2).add(0.35)).add(glint.mul(spill.add(0.2))).add(vec3(0.16, 0.15, 0.13).mul(label).mul(spill.add(0.3)))
    const shelfC = mixN(mixN(lit, boardC, board), bc, bottle)
    const c = mixN(plaster, shelfC, select(inRow, float(1), float(0)).mul(onShelf).mul(ssN(-1, 1, sy.add(0.08))))
    return c.add(winLight(x, y)) as V3
  }
  const benchMat = new THREE.NodeMaterial()
  benchMat.fragmentNode = Fn(() => {
    const p = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    const V = normalize(cameraPosition.sub(p)).toVar()
    const R = reflect(V.negate(), N).toVar()
    // black epoxy resin: a faint cloud in the cast, fine wipe marks
    const cloud = fbm(p.xz.mul(0.05)).mul(0.5).add(0.75)
    const wipe = vnoise(vec2(p.x.mul(0.08).add(p.z.mul(0.03)), p.z.mul(1.6))).mul(0.25).add(0.85)
    const base = vec3(0.017, 0.018, 0.02).mul(cloud).toVar()
    const sh = keyShadow(p).toVar()
    // contact darkness round every foot
    const ao = float(1).toVar()
    const dust = float(0).toVar()
    const crackC = float(0).toVar()
    const rim = float(0).toVar()
    for (let i = 0; i < NB; i++) {
      const q = p.xz.sub(vec2(bx(i), 0)).toVar()
      const dq = max(abs(q).sub(BW / 2), vec2(0))
      const d = length(dq).toVar()
      ao.mulAssign(float(1).sub(exp(d.mul(-1.3)).mul(0.6)))
      if (DATA[i].drop !== undefined) {
        const amt = U.crack[i]
        // radial fractures from the corners and faces, branching with noise; a crushed rim; plaster dust
        const ang = atan(q.y, q.x).add(vnoise(q.mul(0.9)).mul(1.4)).add(i * 1.3)
        const rad = abs(sin(ang.mul(5.5 + i))).toVar()
        const reach = amt.mul(6.5 - i * 0.9)
        const wid = d.mul(0.012).add(0.035)
        crackC.addAssign(smoothstep(wid, float(0), rad).mul(smoothstep(reach, reach.mul(0.3), d)).mul(step0(d.sub(0.05))))
        rim.addAssign(smoothstep(float(0.9), float(0), d).mul(amt).mul(vnoise(q.mul(4)).mul(0.6).add(0.4)))
        dust.addAssign(smoothstep(float(7), float(0), d).mul(fbm(q.mul(0.9).add(i * 7)).mul(1.3).sub(0.25).clamp(0, 1)).mul(amt).mul(0.55))
      }
    }
    const top = smoothstep(float(0.5), float(0.9), N.y)
    // years of use: fine scratches in two directions, rings where beakers stood, a matt etched patch
    // toward the back where reagents spilt, and the front edge worn dull by sleeves
    const sa = vec2(p.x.mul(0.96).add(p.z.mul(0.28)), p.z.mul(0.96).sub(p.x.mul(0.28)))
    const sb = vec2(p.x.mul(0.6).sub(p.z.mul(0.8)), p.z.mul(0.6).add(p.x.mul(0.8)))
    const scratch = ssN(0.86, 0.97, vnoise(vec2(sa.x.mul(0.35), sa.y.mul(9)))).add(ssN(0.88, 0.98, vnoise(vec2(sb.x.mul(0.3), sb.y.mul(11)).add(7)))).mul(vnoise(p.xz.mul(0.03)).mul(1.2).add(0.1)).clamp(0, 1).toVar()
    const ringAt = (cx: number, cz: number, r: number) => ssN(0.55, 0.0, abs(length(p.xz.sub(vec2(cx, cz))).sub(r))).mul(vnoise(p.xz.mul(0.6).add(cx)).mul(0.9).add(0.2))
    const rings = ringAt(-78, -30, 4.6).add(ringAt(-72, -26, 4.6).mul(0.6)).add(ringAt(62, -58, 3.8)).add(ringAt(-120, 4, 6.2)).add(ringAt(96, 8, 5)).add(ringAt(30, -82, 4.2)).clamp(0, 1)
    const etch = ssN(0.56, 0.72, fbm(p.xz.mul(0.022).add(3.1))).mul(ssN(-20, -70, p.z)).toVar()
    const worn = ssN(22, 30, p.z).mul(vnoise(p.xz.mul(0.2)).mul(0.5).add(0.5))
    const matt = scratch.mul(0.55).add(rings.mul(0.7)).add(etch.mul(0.8)).add(worn.mul(0.6)).clamp(0, 1).mul(top).toVar()
    base.assign(base.add(vec3(0.03, 0.03, 0.032).mul(scratch).mul(top)).add(vec3(0.05, 0.05, 0.048).mul(rings.add(etch.mul(0.6))).mul(top)))
    const albedo = mixN(base.mul(wipe), vec3(0.55, 0.54, 0.52), dust.clamp(0, 0.8)).toVar()
    albedo.assign(mixN(albedo, vec3(0.16, 0.16, 0.17), rim.clamp(0, 1).mul(top)))
    albedo.addAssign(vec3(0.22).mul(crackC.clamp(0, 1)).mul(top))
    const ndl = max(dot(N, U.key), 0)
    const diff = albedo.mul(U.sky.mul(N.y.mul(0.4).add(0.6)).add(U.keyCol.mul(ndl).mul(sh))).mul(ao)
    // the soft panel's reflection in the gloss, broken where dust and cracks sit
    const rk = max(dot(R, U.key), 0)
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5).mul(0.94).add(0.05)
    const gloss = float(1).sub(dust.clamp(0, 1)).sub(rim.clamp(0, 1).mul(0.6)).sub(matt.mul(0.75)).max(0)
    // the window in the resin: where the mirror ray meets the far wall (blurred where the top is scratched)
    const tW = float(-170).sub(p.z).div(min(R.z, -0.0001))
    const hitW = p.add(R.mul(tW))
    const winRef = winLight(hitW.x, hitW.y).mul(select(R.z.lessThan(-0.02), float(1), float(0))).mul(fres).mul(gloss).mul(0.9)
    const spec = winRef.add(U.keyCol.mul(smoothstep(float(0.9), float(0.985), rk).mul(0.5).add(pow(rk, 6).mul(0.05))).mul(fres).mul(gloss).mul(sh.mul(0.7).add(0.3)))
    // the ribbon's glow: on the bench and in its gloss
    const gd = normalize(U.glowP.sub(p))
    const gspec = U.glowCol.mul(U.glow).mul(pow(max(dot(R, gd), 0), 60)).mul(fres).mul(gloss).mul(2.5)
    return vec4(diff.add(spec).add(glowOn(p, N).mul(albedo.add(0.02))).add(gspec), 1)
  })()
  const bench = new THREE.Mesh(new THREE.BoxGeometry(300, 4, 140), benchMat)
  bench.position.set(0, -2, -40)
  room.add(bench)
  // the cabinet under the top, set back under its lip: the bars' feet go down into it
  const cabMat = new THREE.NodeMaterial()
  cabMat.fragmentNode = Fn(() => {
    const p = positionWorld
    const N = normalize(normalWorld)
    const lip = smoothstep(float(-9), float(-4), p.y).mul(0.6).add(0.4) // the top's shadow on the doors
    const seam = smoothstep(float(0.25), float(0), abs(fract(p.x.div(60).add(0.5)).sub(0.5)).mul(60)).mul(0.5)
    const c = vec3(0.05, 0.055, 0.062).mul(U.sky.mul(4).add(U.keyCol.mul(max(dot(N, U.key), 0).mul(0.25)))).mul(lip).mul(float(1).sub(seam))
    return vec4(c.add(glowOn(p as unknown as V3, N as unknown as V3).mul(0.02)), 1)
  })()
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(298, 120, 130), cabMat)
  cabinet.position.set(0, -64, -40)
  room.add(cabinet)

  const wallMat = new THREE.NodeMaterial()
  wallMat.fragmentNode = Fn(() => {
    const p = positionWorld
    const c = wallLook(p.x, p.y)
    return vec4(c.add(glowOn(p as unknown as V3, vec3(0, 0, 1) as unknown as V3).mul(0.05)), 1)
  })()
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1400, 600), wallMat)
  wall.position.set(-150, 120, -170)
  room.add(wall)

  // ---------------------------------------------------------------- the bars: plaster castings

  const blockMat = new THREE.NodeMaterial()
  blockMat.fragmentNode = Fn(() => {
    const p = positionWorld.toVar()
    const l = positionLocal.toVar()
    const N = normalize(normalWorld).toVar()
    const V = normalize(cameraPosition.sub(p))
    // cast plaster: a slight tone drift, pinholes from trapped air, edges knocked and brighter where they catch the light
    const tone = vnoise3(l.mul(0.35)).mul(0.06).add(0.97)
    const pin = smoothstep(float(0.8), float(0.88), vnoise3(l.mul(3.1))).mul(0.22)
    const e3 = vec3(BW / 2, BL / 2, BW / 2).sub(abs(l))
    const edge = min(min(max(e3.x, e3.y), max(e3.y, e3.z)), max(e3.x, e3.z)).toVar()
    const knock = smoothstep(float(0.25), float(0), edge).mul(smoothstep(float(0.55), float(0.75), vnoise3(l.mul(1.7))))
    const albedo = vec3(0.86, 0.85, 0.81).mul(tone).mul(float(1).sub(pin)).mul(float(1).sub(knock.mul(0.18))).toVar()
    const sh = keyShadow(p).toVar()
    const ndl = dot(N, U.key)
    const wrap = ndl.add(0.25).div(1.25).max(0)
    const ao = float(1).sub(exp(p.y.mul(-0.6)).mul(0.45))
    const sky = U.sky.mul(N.y.mul(0.35).add(0.65)).mul(1.4)
    // a little light passes through the plaster's skin on the shadow side
    const sss = vec3(0.06, 0.05, 0.04).mul(max(ndl.negate(), 0)).mul(U.keyCol)
    const rimL = pow(float(1).sub(max(dot(N, V), 0)), 4).mul(0.08)
    const col = albedo.mul(sky.add(U.keyCol.mul(wrap).mul(sh)).add(sss)).mul(ao).add(albedo.mul(glowOn(p, N))).add(rimL.mul(sh))
    return vec4(col.add(vec3(0.04).mul(smoothstep(float(0.12), float(0), edge)).mul(max(ndl, 0)).mul(sh)), 1)
  })()
  const blockGeo = new THREE.BoxGeometry(BW, BL, BW, 1, 1, 1)
  const steelMat = new THREE.NodeMaterial()
  steelMat.fragmentNode = Fn(() => {
    const N = normalize(normalWorld)
    const V = normalize(cameraPosition.sub(positionWorld))
    const R = reflect(V.negate(), N)
    const spec = pow(max(dot(R, U.key), 0), 24).mul(2.2)
    const env = vec3(0.12, 0.125, 0.14).mul(N.y.mul(0.5).add(0.5))
    return vec4(env.add(U.keyCol.mul(spec).mul(0.6)).add(glowOn(positionWorld as unknown as V3, N as unknown as V3).mul(0.3)), 1)
  })()
  const blocks: THREE.Mesh[] = []
  for (let i = 0; i < NB; i++) {
    const m = new THREE.Mesh(blockGeo, blockMat)
    m.position.set(bx(i), DATA[i].v - BL / 2, 0)
    room.add(m)
    blocks.push(m)
    const ci = DATA[i].ci
    if (ci) {
      // the 99.9% interval, to scale, as a steel I-bracket stood 0.3 cm off the face
      const yl = (c: number) => c - DATA[i].v + BL / 2
      const g = new THREE.Group()
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, ci[1] - ci[0], 0.16), steelMat)
      stem.position.set(0, (yl(ci[0]) + yl(ci[1])) / 2, 0)
      const c0 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.16), steelMat)
      c0.position.set(0, yl(ci[0]), 0)
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.16), steelMat)
      c1.position.set(0, yl(ci[1]), 0)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.34), steelMat)
      foot.position.set(0, yl((ci[0] + ci[1]) / 2), -0.17)
      g.add(stem, c0, c1, foot)
      g.position.set(-BW / 2 + 1.6, 0, BW / 2 + 0.3)
      m.add(g)
    }
  }

  // ---------------------------------------------------------------- print: value flags and year tent cards, one atlas

  const SLOT = { w: 384, h: 180 }
  const atlas = canvasTex(1024, 1024, (c) => {
    for (let k = 0; k < NB * 2; k++) {
      const x = (k % 2) * SLOT.w, y = Math.floor(k / 2) * SLOT.h
      const i = Math.floor(k / 2)
      const isVal = k % 2 === 0
      c.fillStyle = isVal ? "#f3f0e8" : "#ebe6da"
      c.fillRect(x, y, SLOT.w, SLOT.h)
      c.strokeStyle = "rgba(40,36,30,0.35)"
      c.lineWidth = 4
      c.strokeRect(x + 6, y + 6, SLOT.w - 12, SLOT.h - 12)
      c.fillStyle = "#16140f"
      c.textAlign = "center"
      c.textBaseline = "alphabetic"
      c.font = `400 150px ${ctx.fonts.tall}`
      c.fillText(isVal ? `${DATA[i].v.toFixed(1)}%` : DATA[i].year, x + SLOT.w / 2, y + 144)
    }
  })
  atlas.generateMipmaps = true
  const CHh = 2.5, CW = (CHh * SLOT.w) / SLOT.h // card size; Anton's cap height is about 0.6 of it
  const CAP = 0.6 * CHh
  const cardMat = new THREE.NodeMaterial()
  cardMat.side = THREE.DoubleSide
  cardMat.fragmentNode = Fn(() => {
    const st = uv()
    const tex = texture(atlas, st)
    if (ctx.debugLabels) return vec4(1, 0, 1, 1)
    const N = normalize(normalWorld)
    const lit = U.sky.mul(1.6).add(U.keyCol.mul(abs(dot(N, U.key)).mul(0.5).add(0.2))).add(glowOn(positionWorld as unknown as V3, N as unknown as V3))
    return vec4(tex.rgb.mul(lit).mul(0.8), 1)
  })()
  const cardGeo = (k: number) => {
    const g = new THREE.PlaneGeometry(CW, CHh)
    const a = g.getAttribute("uv") as THREE.BufferAttribute
    const u0 = ((k % 2) * SLOT.w) / 1024, du = SLOT.w / 1024, v1 = 1 - (Math.floor(k / 2) * SLOT.h) / 1024, v0 = v1 - SLOT.h / 1024
    for (let j = 0; j < a.count; j++) a.setXY(j, u0 + a.getX(j) * du, v0 + a.getY(j) * (v1 - v0))
    return g
  }
  const flags: THREE.Mesh[] = [], pins: THREE.Mesh[] = [], tents: THREE.Mesh[] = []
  const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6)
  for (let i = 0; i < NB; i++) {
    const f = new THREE.Mesh(cardGeo(i * 2), cardMat)
    const pn = new THREE.Mesh(pinGeo, steelMat)
    const tn = new THREE.Mesh(cardGeo(i * 2 + 1), cardMat)
    room.add(f, pn, tn)
    flags.push(f)
    pins.push(pn)
    tents.push(tn)
  }

  // ---------------------------------------------------------------- chips and dust from the bench

  const CHIPS_E = 26, CHIPS_P = 12
  const drops = DATA.map((b, i) => (b.drop !== undefined ? i : -1)).filter((i) => i >= 0)
  const chipE = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.NodeMaterial(), CHIPS_E * drops.length)
  const chipP = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.NodeMaterial(), CHIPS_P * drops.length)
  const chipFrag = (albedo: V3, gloss: number) =>
    Fn(() => {
      const N = normalize(normalWorld)
      const V = normalize(cameraPosition.sub(positionWorld))
      const ndl = max(dot(N, U.key), 0)
      const spec = pow(max(dot(reflect(V.negate(), N), U.key), 0), 30).mul(gloss)
      return vec4(albedo.mul(U.sky.mul(1.5).add(U.keyCol.mul(ndl))).add(U.keyCol.mul(spec)).add(albedo.mul(glowOn(positionWorld as unknown as V3, N as unknown as V3))), 1)
    })()
  ;(chipE.material as THREE.NodeMaterial).fragmentNode = chipFrag(vec3(0.03, 0.031, 0.034) as unknown as V3, 0.9)
  ;(chipP.material as THREE.NodeMaterial).fragmentNode = chipFrag(vec3(0.8, 0.79, 0.75) as unknown as V3, 0.05)
  chipE.frustumCulled = chipP.frustumCulled = false
  room.add(chipE, chipP)
  type Chip = { a: number; vh: number; vy: number; s: number; sx: number; sy: number; spin: number; ax: THREE.Vector3; r0: number }
  const mkChips = (n: number, seed: number, big: number) => {
    const r = rng(seed)
    return Array.from({ length: n }, (): Chip => ({ a: r() * Math.PI * 2, vh: 18 + r() * 60 * big, vy: 60 + r() * 150 * big, s: 0.18 + r() * r() * 0.6, sx: 0.6 + r() * 0.8, sy: 0.3 + r() * 0.5, spin: 6 + r() * 20, ax: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r0: r() }))
  }
  const chipSetE = drops.map((i, k) => mkChips(CHIPS_E, 77 + k * 13, k === 0 ? 1 : 0.55))
  const chipSetP = drops.map((i, k) => mkChips(CHIPS_P, 501 + k * 17, k === 0 ? 0.8 : 0.45))

  // dust: soft billboards, positions written each frame from the impact time
  const NDUST = 30
  const dustGeo = new THREE.InstancedBufferGeometry()
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  dustGeo.setIndex([0, 1, 2, 0, 2, 3])
  const dustA = new Float32Array(NDUST * drops.length * 4)
  const dustB = new Float32Array(NDUST * drops.length)
  const dustAttr = new THREE.InstancedBufferAttribute(dustA, 4).setUsage(THREE.DynamicDrawUsage)
  const dustAlpha = new THREE.InstancedBufferAttribute(dustB, 1).setUsage(THREE.DynamicDrawUsage)
  dustGeo.setAttribute("aD", dustAttr)
  dustGeo.setAttribute("aA", dustAlpha)
  dustGeo.instanceCount = NDUST * drops.length
  dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  const aD = attribute("aD", "vec4")
  const aA = attribute("aA", "float")
  const dustMat = new THREE.NodeMaterial()
  const viewC = cameraViewMatrix.mul(vec4(aD.xyz, 1))
  dustMat.vertexNode = cameraProjectionMatrix.mul(viewC.add(vec4(positionGeometry.xy.mul(aD.w), 0, 0)))
  const vDust = vec4(positionGeometry.xy, aA, aD.x.add(aD.z)).toVarying("fDust")
  const vDustP = aD.xyz.toVarying("fDustP")
  dustMat.fragmentNode = Fn(() => {
    const r = length(vDust.xy)
    const n = vnoise(vDust.xy.mul(2.2).add(vDust.w)).mul(0.6).add(0.4)
    const a = smoothstep(float(1), float(0.1), r).mul(n).mul(vDust.z).toVar()
    const lit = vec3(0.78, 0.77, 0.74).mul(U.sky.mul(2).add(U.keyCol.mul(0.55))).add(glowOn(vDustP as unknown as V3, vec3(0, 1, 0) as unknown as V3).mul(0.6))
    return vec4(lit.mul(a), a)
  })()
  Object.assign(dustMat, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
  const dust = new THREE.Mesh(dustGeo, dustMat)
  dust.frustumCulled = false
  dust.renderOrder = 5
  room.add(dust)
  const dustSeed = drops.map((_, k) => {
    const r = rng(900 + k * 31)
    return Array.from({ length: NDUST }, () => ({ a: Math.PI * (1.02 + r() * 0.96), v: 8 + r() * 22, up: 3 + r() * 9, s0: 0.6 + r() * 1.4, life: 0.9 + r() * 1.4 }))
  })

  // ---------------------------------------------------------------- the ribbon

  const chain = new THREE.Scene()
  const chainGroup = new THREE.Group()
  chain.add(chainGroup)
  const ribGeo = new THREE.BufferGeometry()
  const ribPos = new Float32Array(NP * RING * 3)
  const ribNor = new Float32Array(NP * RING * 3)
  const ribU = new Float32Array(NP * RING * 2)
  const idx: number[] = []
  for (let p = 0; p < NP; p++) {
    const u = p / SEG
    const r = Math.min(NR - 1, Math.round(u))
    for (let k = 0; k < RING; k++) {
      ribU[(p * RING + k) * 2] = u / (NR - 1)
      ribU[(p * RING + k) * 2 + 1] = KIND[r]
      if (p < NP - 1) {
        const a = p * RING + k, b = p * RING + ((k + 1) % RING), c = a + RING, d = b + RING
        idx.push(a, c, b, b, c, d)
      }
    }
  }
  const posAttr = new THREE.BufferAttribute(ribPos, 3).setUsage(THREE.DynamicDrawUsage)
  const norAttr = new THREE.BufferAttribute(ribNor, 3).setUsage(THREE.DynamicDrawUsage)
  ribGeo.setAttribute("position", posAttr)
  ribGeo.setAttribute("normal", norAttr)
  ribGeo.setAttribute("aR", new THREE.BufferAttribute(ribU, 2))
  ribGeo.setIndex(idx)
  ribGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
  const ribMat = new THREE.NodeMaterial()
  const aR = attribute("aR", "vec2")
  ribMat.fragmentNode = Fn(() => {
    const N = normalize(normalWorld).toVar()
    const V = normalize(cameraPosition.sub(positionWorld)).toVar()
    const nv = abs(dot(N, V)).toVar()
    const fres = pow(nv.oneMinus(), 3)
    const kind = aR.y
    const tint = select(kind.greaterThan(1.5), vec3(0.88, 0.94, 1.04), select(kind.greaterThan(0.5), vec3(1.05, 0.97, 0.88), vec3(0.95, 0.95, 0.95)))
    // glass, lit from inside: brightest where the glass is thickest to the eye, a light running N to C
    const run = exp(aR.x.sub(U.pulse).mul(9).pow(2).negate()).mul(1.6)
    const inner = U.glowCol.mul(tint).mul(U.glow.mul(0.85).add(0.15)).mul(pow(nv, 1.6).mul(1.25).add(0.12)).mul(run.add(1))
    const H2 = normalize(U.key.add(V))
    const spec = pow(max(dot(N, H2), 0), 80).mul(1.4)
    const body = vec3(0.5, 0.53, 0.58).mul(U.sky.add(U.keyCol.mul(max(dot(N, U.key), 0).mul(0.06))))
    const rim = vec3(0.78, 0.84, 0.95).mul(fres).mul(0.85)
    // a hot filament down the middle of the glass, where the eye looks through the most of it
    const core = U.glowCol.mul(pow(nv, 7)).mul(U.glow.mul(1.4).add(0.2)).mul(run.mul(0.5).add(1))
    // the glass lets some of the room through at its edges-on-the-face, not at its rims
    const alpha = fres.mul(0.45).add(0.55).add(pow(nv, 7).mul(0.3)).clamp(0, 1)
    return vec4(body.add(inner.mul(1.2)).add(core).add(rim).add(U.keyCol.mul(spec).mul(0.35)), alpha)
  })()
  const ribbon = new THREE.Mesh(ribGeo, ribMat)
  ribbon.frustumCulled = false
  chainGroup.add(ribbon)
  // hydrogen bonds: dashed threads of light
  const hbMat = new THREE.NodeMaterial()
  hbMat.fragmentNode = Fn(() => {
    const d = fract(uv().y.mul(3.5).add(0.2))
    Discard(d.greaterThan(0.55))
    return vec4(U.glowCol.mul(U.glow.mul(1.6).add(0.2)), 1)
  })()
  const hb = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), hbMat, HB.length)
  hb.frustumCulled = false
  chainGroup.add(hb)

  // working buffers for the rebuild (allocated once)
  const CAt = new Float32Array(NR * 3)
  const Ot = new Float32Array(NR * 3)
  const Wt = new Float32Array(NR * 3)
  const fr: number[] = []
  const sp = new Float32Array(3), tg = new Float32Array(3)
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), vS = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0)

  function rebuild(fold: number, time: number) {
    // internal coordinates now: each residue moves from the loose chain to the native angles inside its window
    const eAt = (i: number) => E.io3(clamp((fold - WIN[i][0]) / (WIN[i][1] - WIN[i][0])))
    for (let k = 0; k < 3; k++) {
      for (const j of [ANCHOR - 1, ANCHOR, ANCHOR + 1]) CAt[3 * j + k] = CA0[3 * j + k]
    }
    const ang = (i: number, r: number) => {
      const e = eAt(r)
      const w = (1 - e) * 0.3
      let d = IC[i].ph - COIL[i].ph
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
      return [COIL[i].th + (IC[i].th - COIL[i].th) * e + w * 0.3 * Math.sin(time * 1.9 + i * 2.1), COIL[i].ph + d * e + w * Math.sin(time * 2.3 + i * 1.3)]
    }
    for (let i = ANCHOR + 2; i < NR; i++) {
      const [th, ph] = ang(i, i - 1)
      place(CAt, i - 3, i - 2, i - 1, i, IC[i].L, th, ph)
    }
    for (let i = ANCHOR - 2; i >= 0; i--) {
      const [th, ph] = ang(i, i + 1)
      place(CAt, i + 3, i + 2, i + 1, i, IC[i].L, th, ph)
    }
    // centre on the centroid (exactly the deposited frame at fold = 1, whose centroid is zero)
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < NR; i++) {
      cx += CAt[3 * i]
      cy += CAt[3 * i + 1]
      cz += CAt[3 * i + 2]
    }
    cx /= NR
    cy /= NR
    cz /= NR
    // halfway, mixed angles can swing an arm far out of frame: hold every CA inside a soft 16 Å ball (about the folded domain's own reach)
    // (an illustration; let go before the end, so fold = 1 is the deposited coordinates exactly)
    const hold = 1 - smooth(0.82, 0.98, fold)
    for (let i = 0; i < NR; i++) {
      CAt[3 * i] -= cx
      CAt[3 * i + 1] -= cy
      CAt[3 * i + 2] -= cz
      const rr = Math.hypot(CAt[3 * i], CAt[3 * i + 1], CAt[3 * i + 2])
      if (hold > 0 && rr > 11) {
        const k = 1 + hold * ((11 + 5 * Math.tanh((rr - 11) / 5)) / rr - 1)
        CAt[3 * i] *= k
        CAt[3 * i + 1] *= k
        CAt[3 * i + 2] *= k
      }
    }
    // carbonyls from their local frames, and a guide (the ribbon's width) that never flips
    let px = 0, py = 0, pz = 0
    for (let i = 0; i < NR; i++) {
      frameAt(CAt, i, fr)
      const a = OC[3 * i], b = OC[3 * i + 1], c = OC[3 * i + 2]
      const ox = a * fr[0] + b * fr[3] + c * fr[6], oy = a * fr[1] + b * fr[4] + c * fr[7], oz = a * fr[2] + b * fr[5] + c * fr[8]
      Ot[3 * i] = CAt[3 * i] + ox
      Ot[3 * i + 1] = CAt[3 * i + 1] + oy
      Ot[3 * i + 2] = CAt[3 * i + 2] + oz
      let wx = ox, wy = oy, wz = oz
      if (i > 0 && wx * px + wy * py + wz * pz < 0) {
        wx = -wx
        wy = -wy
        wz = -wz
      }
      Wt[3 * i] = wx
      Wt[3 * i + 1] = wy
      Wt[3 * i + 2] = wz
      px = wx
      py = wy
      pz = wz
    }
    // the ribbon: spline point, tangent, a frame from the guide, a cross-section by kind
    for (let p = 0; p < NP; p++) {
      const u = p / SEG
      const s0 = Math.min(NR - 2, Math.floor(u))
      const f = u - s0
      const i0 = Math.max(0, s0 - 1), i1 = s0, i2 = s0 + 1, i3 = Math.min(NR - 1, s0 + 2)
      const f2 = f * f, f3 = f2 * f
      for (let k = 0; k < 3; k++) {
        const P0 = CAt[3 * i0 + k], P1 = CAt[3 * i1 + k], P2 = CAt[3 * i2 + k], P3 = CAt[3 * i3 + k]
        sp[k] = 0.5 * (2 * P1 + (-P0 + P2) * f + (2 * P0 - 5 * P1 + 4 * P2 - P3) * f2 + (-P0 + 3 * P1 - 3 * P2 + P3) * f3)
        tg[k] = 0.5 * (-P0 + P2 + 2 * (2 * P0 - 5 * P1 + 4 * P2 - P3) * f + 3 * (-P0 + 3 * P1 - 3 * P2 + P3) * f2)
      }
      let tl = Math.hypot(tg[0], tg[1], tg[2]) || 1
      const tx = tg[0] / tl, ty = tg[1] / tl, tz = tg[2] / tl
      let wx = Wt[3 * i1] * (1 - f) + Wt[3 * i2] * f, wy = Wt[3 * i1 + 1] * (1 - f) + Wt[3 * i2 + 1] * f, wz = Wt[3 * i1 + 2] * (1 - f) + Wt[3 * i2 + 2] * f
      const d = wx * tx + wy * ty + wz * tz
      wx -= d * tx
      wy -= d * ty
      wz -= d * tz
      tl = Math.hypot(wx, wy, wz) || 1
      wx /= tl
      wy /= tl
      wz /= tl
      const nx = ty * wz - tz * wy, ny = tz * wx - tx * wz, nz = tx * wy - ty * wx
      // half width and half thickness: the residue's kind, blended across the segment; strands end in an arrowhead
      const dim = (r: number): [number, number] => (KIND[r] === 1 ? [1.25, 0.24] : KIND[r] === 2 ? [1.0, 0.3] : [0.34, 0.34])
      const A = dim(i1), B = dim(i2)
      let hw = A[0] + (B[0] - A[0]) * f, hh = A[1] + (B[1] - A[1]) * f
      if (KIND[i1] === 2 && STRAND_END.has(i2)) {
        hw = 1.8 + (0.16 - 1.8) * f
        hh = 0.3
      } else if (STRAND_END.has(i1) && KIND[i2] !== 2) {
        hw = 0.16 + (0.34 - 0.16) * f
        hh = 0.3 + (0.34 - 0.3) * f
      }
      for (let k = 0; k < RING; k++) {
        const a = (k / RING) * Math.PI * 2
        const ca = Math.cos(a), sa = Math.sin(a)
        // a flattened section with rounded edges: boxier as it widens
        const sq = hw > 0.5 ? Math.sign(sa) * Math.pow(Math.abs(sa), 0.45) : sa
        const x = hw * ca, y = hh * sq
        let mx = ca / hw, my = sa / hh
        const ml = Math.hypot(mx, my)
        mx /= ml
        my /= ml
        const o = (p * RING + k) * 3
        ribPos[o] = sp[0] + wx * x + nx * y
        ribPos[o + 1] = sp[1] + wy * x + ny * y
        ribPos[o + 2] = sp[2] + wz * x + nz * y
        ribNor[o] = wx * mx + nx * my
        ribNor[o + 1] = wy * mx + ny * my
        ribNor[o + 2] = wz * mx + nz * my
      }
    }
    posAttr.needsUpdate = true
    norAttr.needsUpdate = true
    // hydrogen bonds light when their ends come within reach of the native length
    for (let h = 0; h < HB.length; h++) {
      const { o, n, L } = HB[h]
      vA.set(Ot[3 * o], Ot[3 * o + 1], Ot[3 * o + 2])
      vB.set(nAt(CAt, n, 0), nAt(CAt, n, 1), nAt(CAt, n, 2))
      const len = vA.distanceTo(vB)
      const on = 1 - smooth(1.08, 1.5, len / L)
      vS.subVectors(vB, vA).normalize()
      q4.setFromUnitVectors(Y, vS)
      vA.add(vB).multiplyScalar(0.5)
      const r = 0.11 * on
      m4.compose(vA, q4, vS.set(r, Math.max(len - 0.5, 0.01), r))
      hb.setMatrixAt(h, m4)
    }
    hb.instanceMatrix.needsUpdate = true
  }
  rebuild(1, 0)

  // ---------------------------------------------------------------- the rule of ages: glazed porcelain, inked

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "inked", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = attribute("uv", "vec2") as unknown as V2
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const N = normalize(normalWorld)
    const V = normalize(cameraPosition.sub(positionWorld))
    const glaze = vec3(0.8, 0.79, 0.76).mul(U.sky.mul(2.2).add(U.keyCol.mul(max(dot(N, U.key), 0).mul(0.22).add(0.1))))
    const gl = pow(max(dot(reflect(V.negate(), N), U.key), 0), 40).mul(0.6)
    const lit = mixN(glaze.add(U.glowCol.mul(U.glow).mul(0.05)), cut.rgb.mul(0.6), on).add(vec3(gl).mul(on.oneMinus()))
    return vec4(ctx.debugLabels ? mixN(lit, cut.rgb, on) : lit, 1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 100
  rule.frustumCulled = false
  const ruleScene = new THREE.Scene()
  ruleScene.add(rule)

  // ---------------------------------------------------------------- camera, targets, the finishing pass

  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 2000)
  const stage = stageTarget(ctx)
  const chainStage = stageTarget(ctx)
  const out = ctx.target({})
  const C = { tBg: uniformTexture(stage.texture), tCh: uniformTexture(chainStage.texture), blur: uniform(0), asp: uniform(16 / 9), focusY: uniform(0.5), shade: uniform(1), chainOn: uniform(0) }
  const comp = ctx.pass(({ uv: q }) => {
    // the chart below drops out of focus as the lens rises to the ribbon: a Vogel disc, stronger away from the focus line
    const r = C.blur.mul(ssN(0.05, 0.4, abs(q.y.sub(C.focusY)) as F).mul(0.7).add(0.3)).toVar()
    const acc = vec3(0).toVar()
    const n = 14
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 2.39996
      const rr = Math.sqrt((i + 0.5) / n)
      const o = vec2(float(Math.cos(a) * rr).mul(r).div(C.asp), float(Math.sin(a) * rr).mul(r))
      acc.addAssign(sampleRT(C.tBg, q.add(o) as V2).rgb)
    }
    const bg = acc.div(n).toVar()
    const ch = sampleRT(C.tCh, q).mul(C.chainOn).toVar()
    const col = bg.mul(ch.a.oneMinus()).add(ch.rgb).toVar()
    // a little shade behind the headline
    col.mulAssign(float(1).sub(C.shade.mul(ssN(0.62, 0.0, length(q.sub(vec2(0.18, 0.84)).mul(vec2(1.0, 2.2))) as F)).mul(0.4)))
    return vec4(col, 1)
  }, C)

  // ---------------------------------------------------------------- the story clock

  const st = { beat1: false, fold: 0, shud: 0 }
  const tgt = new THREE.Vector3(), tmp = new THREE.Vector3(), corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const labelBox: LabelInfo[] = []
  const lb = (id: string): LabelInfo => ({ id, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] })
  const flagL = DATA.map((b) => lb(`value ${b.year}`)), tentL = DATA.map((b) => lb(`year ${b.year}`))
  const showFlag = new Array<boolean>(NB).fill(false)
  const P1 = new THREE.Vector3(4, 50, 4) // the ribbon's centre in the world

  // beat 0 camera: low across the bench from the front right, riding the drops; beat 1: crane up and orbit the fold
  const B0 = { a: { t: [-17, 18, 0], az: 0.56, el: 0.1, d: 196 }, b: { t: [-10, 20, 0], az: 0.42, el: 0.12, d: 164 } }
  const camAt = (t: [number, number, number], az: number, el: number, d: number) => {
    tgt.set(t[0], t[1], t[2])
    cam.position.set(t[0] + d * Math.sin(az) * Math.cos(el), t[1] + d * Math.sin(el), t[2] + d * Math.cos(az) * Math.cos(el))
  }
  function update(s: State) {
    const t0 = s.at(0)
    const { w, h } = ctx.size()
    cam.aspect = w / h
    st.beat1 = s.beat >= 1
    const t1 = s.beat >= 1 ? s.t : 0
    // --- camera
    const k0 = E.io3(ramp(t0, -START, 3.3))
    const ta: [number, number, number] = [mix(B0.a.t[0], B0.b.t[0], k0), mix(B0.a.t[1], B0.b.t[1], k0), 0]
    let az = mix(B0.a.az, B0.b.az, k0), el = mix(B0.a.el, B0.b.el, k0), d = mix(B0.a.d, B0.b.d, k0)
    if (st.beat1) {
      const crane = E.io3(clamp(t1 / 1.15))
      const orb = E.io2(clamp(t1 / 3.4))
      ta[0] = mix(ta[0], P1.x, crane)
      ta[1] = mix(ta[1], P1.y, crane)
      ta[2] = mix(ta[2], P1.z, crane)
      el = mix(el, 0.1, crane)
      d = mix(d, 60, E.out3(clamp(t1 / 1.6))) - 7 * orb
      az = az - 1.25 * orb - 0.15 * crane
    }
    camAt(ta, az, el, d)
    if (st.beat1) {
      // hold the fold right of centre and under the headline: aim left of it and above it
      const crane = E.io3(clamp(t1 / 1.15))
      vS.subVectors(tgt, cam.position).normalize().cross(Y).normalize()
      tgt.addScaledVector(vS, -11 * crane).add(vA.set(0, 1.5 * crane, 0))
    }
    // the drop's jolt, and the landing's at the lock
    let jolt = 0
    for (const i of drops) {
      const r = t0 - DATA[i].drop!
      if (r > 0 && r < 0.8) jolt += (i === 2 ? 0.55 : 0.22) * Math.exp(-r * 9) * Math.sin(r * 55)
    }
    st.shud = t0 > 0 && t0 < 0.7 && s.beat === 0 ? 0.3 * Math.exp(-t0 * 8) * Math.sin(t0 * 64) : 0
    const hh = shake(s.time, 0.14, 0.45)
    cam.position.x += hh[0]
    cam.position.y += hh[1] + jolt
    tgt.y += jolt * 0.5
    cam.lookAt(tgt)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    // --- the bars
    for (let i = 0; i < NB; i++) {
      const top = barTop(i, s.beat >= 1 ? 99 : t0)
      const m = blocks[i]
      m.visible = top !== null
      const tt = top ?? -200
      m.position.set(bx(i) + (i < 2 ? st.shud * (i ? -1 : 1) * 0.6 : 0), tt - BL / 2, 0)
      U.tops[i].value = tt
      U.crack[i].value = DATA[i].drop !== undefined ? smooth(DATA[i].drop!, DATA[i].drop! + 0.06, s.beat >= 1 ? 99 : t0) : 0
    }
    // --- chips and dust
    let ce = 0, cp = 0, di = 0
    drops.forEach((i, k) => {
      const tau = (s.beat >= 1 ? 99 : t0) - DATA[i].drop!
      const set = (mesh: THREE.InstancedMesh, list: Chip[], at: number) => {
        list.forEach((c, j) => {
          let x = 0, y = 0, z = 0, rot = 0, sc = c.s
          if (tau <= 0) sc = 0
          else {
            const ex = Math.cos(c.a), ez = Math.sin(c.a)
            const x0 = bx(i) + ex * (BW / 2 + 0.2), z0 = ez * (BW / 2 + 0.2)
            const tf = (2 * c.vy) / 980
            if (tau < tf) {
              x = x0 + ex * c.vh * tau
              z = z0 + ez * c.vh * tau * (ez > 0 ? 0.25 : 1)
              y = c.vy * tau - 490 * tau * tau
              rot = c.spin * tau
            } else {
              const sl = (1 - Math.exp(-(tau - tf) * 7)) / 7
              x = x0 + ex * c.vh * (tf + sl * 0.35)
              z = z0 + ez * c.vh * (tf + sl * 0.35) * (ez > 0 ? 0.25 : 1)
              rot = c.spin * tf
            }
            y += sc * c.sy * 0.6
          }
          q4.setFromAxisAngle(c.ax, rot + c.r0 * 6)
          m4.compose(vA.set(x, y, z), q4, vS.set(sc * c.sx, sc * c.sy, sc))
          mesh.setMatrixAt(at + j, m4)
        })
      }
      set(chipE, chipSetE[k], ce)
      set(chipP, chipSetP[k], cp)
      ce += CHIPS_E
      cp += CHIPS_P
      dustSeed[k].forEach((p) => {
        const o = di * 4
        if (tau <= 0 || tau > p.life + 0.3) {
          dustA[o + 3] = 0
          dustB[di] = 0
        } else {
          const ex = Math.cos(p.a), ez = Math.sin(p.a)
          const go = (p.v * (1 - Math.exp(-tau * 3.5))) / 3.5
          dustA[o] = bx(i) + ex * (BW / 2 + go)
          dustA[o + 1] = 0.6 + (p.up * (1 - Math.exp(-tau * 1.5))) / 1.5
          dustA[o + 2] = ez * (BW / 2 + go)
          dustA[o + 3] = p.s0 * (1 + tau * 2.2) * (k === 0 ? 1.4 : 1)
          dustB[di] = 0.42 * smooth(0, 0.05, tau) * (1 - smooth(p.life * 0.3, p.life, tau)) * (k === 0 ? 1 : 0.7)
        }
        di++
      })
    })
    chipE.instanceMatrix.needsUpdate = true
    chipP.instanceMatrix.needsUpdate = true
    dustAttr.needsUpdate = true
    dustAlpha.needsUpdate = true

    // --- print, held to the label floor, facing the lens
    labelBox.length = 0
    for (let i = 0; i < NB; i++) {
      const top = U.tops[i].value
      const settled = i < 2 || (s.beat >= 1 ? true : t0 > settledAt(i))
      const rise = i < 2 ? 1 : s.beat >= 1 ? 1 : E.outBack(clamp((t0 - settledAt(i)) / 0.28))
      const yaw = Math.atan2(cam.position.x - bx(i), cam.position.z)
      // the flag
      const f = flags[i]
      tmp.set(bx(i), top + 4, 0)
      const fs = Math.max(1, labelFloor(tmp, CAP, cam, 24))
      const pinH = 2.2 + 0.6 * fs
      f.visible = pins[i].visible = settled && blocks[i].visible
      f.scale.set(fs * rise, fs * rise, 1)
      f.rotation.set(0, yaw, 0)
      f.position.set(bx(i) + FLAG_DX[i], top + pinH * rise + (CHh * fs * rise) / 2, 0.4)
      pins[i].position.set(bx(i) + FLAG_DX[i], top + (pinH * rise) / 2, 0.4)
      pins[i].scale.set(1, Math.max(0.01, pinH * rise), 1)
      showFlag[i] = f.visible && rise > 0.98
      // the tent card in front
      const tn = tents[i]
      tmp.set(bx(i), CHh / 2, TENT_Z)
      const ts = Math.max(1, labelFloor(tmp, CAP, cam, 24))
      tn.scale.set(ts, ts, 1)
      tn.rotation.set(-0.1, yaw, 0)
      tn.position.set(bx(i), (CHh * ts) / 2 + 0.05, TENT_Z)
    }
    if (s.beat === 0) {
      for (let i = 0; i < NB; i++) {
        if (showFlag[i]) labelBox.push(project(flags[i], flagL[i]))
        labelBox.push(project(tents[i], tentL[i]))
      }
    }

    // --- the fold
    st.fold = st.beat1 ? E.io2(clamp((t1 - 0.12) / 2.45)) : 0
    if (st.beat1) rebuild(st.fold, s.time)
    chainGroup.visible = st.beat1
    chainGroup.position.copy(P1)
    chainGroup.scale.setScalar(ASC)
    chainGroup.rotation.set(0.35, 2.4, -0.2)
    U.glow.value = st.beat1 ? 0.25 + 0.95 * st.fold : 0
    U.glowP.value.copy(P1)
    U.pulse.value = st.beat1 ? -0.15 + 1.3 * fract1(t1 / 1.7) : -1
    U.time.value = s.time
    C.blur.value = ctx.debugLabels ? 0 : st.beat1 ? 0.012 * E.io2(clamp(t1 / 1.2)) : 0
    C.focusY.value = 0.55
    C.asp.value = w / h
    C.shade.value = ctx.debugLabels ? 0 : 1
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    if (s.live) ctx.synth.bed("hum", st.beat1 ? 0.25 + 0.45 * st.fold : 0.18)
  }
  function project(m: THREE.Mesh, L: LabelInfo): LabelInfo {
    m.updateMatrixWorld()
    const hw = CW / 2, hy = CHh / 2
    corners[0].set(-hw, hy, 0)
    corners[1].set(hw, hy, 0)
    corners[2].set(hw, -hy, 0)
    corners[3].set(-hw, -hy, 0)
    for (let k = 0; k < 4; k++) {
      corners[k].applyMatrix4(m.matrixWorld).project(cam)
      L.corners[k][0] = corners[k].x
      L.corners[k][1] = corners[k].y
    }
    return L
  }

  // ---------------------------------------------------------------- sound

  const at = (i: number) => () => listenerPos(vA.set(bx(i), 4, 0), cam)
  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  drops.forEach((i, k) => {
    const T = DATA[i].drop!
    const big = k === 0
    cues.push({ b: 0, at: T - FALL, s: "whoosh", o: { g: big ? 0.2 : 0.1, f: 900, dur: FALL }, pos: at(i) })
    cues.push({ b: 0, at: T, s: "crack", o: { g: big ? 0.95 : 0.5 }, pos: at(i) })
    cues.push({ b: 0, at: T + 0.01, s: big ? "thump" : "thud", o: { g: big ? 0.9 : 0.55, f: H(big ? 2 : 3) }, pos: at(i) })
    cues.push({ b: 0, at: T + 0.05, s: "crackle", o: { g: big ? 0.45 : 0.25, dur: big ? 0.5 : 0.3 }, pos: at(i) })
    if (big) cues.push({ b: 0, at: T, s: "sub", o: { g: 0.7 } })
    cues.push({ b: 0, at: settledAt(i), s: "tick", o: { g: 0.45, f: H(40 + k * 4) }, pos: at(i) })
  })
  cues.push(
    { b: 1, at: 0.02, s: "whoosh", o: { g: 0.22, f: 600, dur: 0.9 } },
    { b: 1, at: 0.2, s: "shimmer", o: { g: 0.3, f: H(24), dur: 2.4 } },
    { b: 1, at: 0.12 + 2.45 * 0.36, s: "glass", o: { g: 0.45, f: H(36) }, pos: [0.2, 0.2, 0.3] },
    { b: 1, at: 0.12 + 2.45 * 0.55, s: "glass", o: { g: 0.4, f: H(40) }, pos: [0.3, 0.15, 0.3] },
    { b: 1, at: 0.12 + 2.45 * 0.78, s: "glass", o: { g: 0.4, f: H(45) }, pos: [0.25, 0.1, 0.3] },
    { b: 1, at: 2.6, s: "bell", o: { g: 0.6, f: H(24) }, pos: [0.25, 0.15, 0.4] },
    { b: 1, at: 2.62, s: "pad", o: { g: 0.25, f: H(12), dur: 1.0 } },
  )

  // ---------------------------------------------------------------- type

  const TITLES: TitleOpts = { color: "#f6f3ec", shadow: "rgba(0,0,0,0.7)", delay: [0.1, 0.35] }
  const HUD = { color: "#e9e6df", shadow: "rgba(0,0,0,0.7)" }

  return {
    cues,
    update,
    warm: () => [
      { scene: room, camera: cam, target: stage },
      { scene: chain, camera: cam, target: chainStage },
      { pass: comp, target: out },
      { scene: ruleScene, camera: cam, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(room, cam)
      // the ribbon's layer only when there is a ribbon: an empty scene drawn into it in beat 0 left a
      // render pass whose end timestamp never landed, which voided the frame's GPU span in prof
      C.chainOn.value = st.beat1 ? 1 : 0
      if (st.beat1) {
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(chainStage)
        r.render(chain, cam)
        r.setClearColor(0x000000, 1)
      }
      C.tBg.value = stage.texture
      C.tCh.value = chainStage.texture
      comp.render(out)
      placeRule(rule, cam, { dist: 8 })
      r.setRenderTarget(out)
      r.autoClear = false
      r.render(ruleScene, cam)
      r.autoClear = true
      const post: PostOpts = ctx.debugLabels
        ? { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, vignette: 0 }
        : st.beat1
          ? { tone: "agx", exposure: 1.1, bloom: 0.5, bloomThresh: 0.85, bloomRadius: 0.8, vignette: 0.3, grain: 0.022, contrast: 1.08, sat: 1.0, lift: [0.006, 0.006, 0.008], gain: [1.02, 1, 0.98], halation: 0.35, ca: 0.0006 }
          : { tone: "agx", exposure: 1.05, bloom: 0.22, bloomThresh: 1.1, bloomRadius: 0.6, vignette: 0.26, grain: 0.02, contrast: 1.1, sat: 0.95, lift: [0.005, 0.006, 0.008], gain: [1, 1, 1], halation: 0.1, ca: 0.0005 }
      ctx.finish(out.texture, post)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,0.7)", color: "#f6f3ec" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face), ...labelBox],
    dispose() {
      face.dispose()
      atlas.dispose()
      disposeTree(room)
      disposeTree(chain)
      disposeTree(ruleScene)
    },
  }
}

function step01(x: F): F {
  return select(x.greaterThan(0), float(1), float(0)) as F
}
function step0(x: F): F {
  return select(x.greaterThan(0), float(1), float(0)) as F
}
function fract1(x: number) {
  return x - Math.floor(x)
}
