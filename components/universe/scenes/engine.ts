// Scene 19, engine: "Steam, then light". Power you can make, then power you can send.
//
// Staging. Beat 0: an engine house at a low sun. A Boulton and Watt rotative beam engine, to the
// published dimensions of the 1785 engine (bore 0.635 m, stroke 1.83 m, flywheel 4.27 m): a brick-set
// boiler with a glowing fire door, a vertical cylinder, a strapped oak beam on its gudgeon, Watt's
// parallel motion, the condenser and air pump in a cistern of cold water under the cylinder floor,
// a connecting rod whose planet gear walks round the sun gear on the flywheel shaft (two turns of
// the shaft to each double stroke, the planet keyed to the rod), and a flyball governor belted off
// the shaft whose sleeve, lever and rod close a butterfly valve in the steam pipe. It starts from
// rest and quickens. The camera rides the connecting rod, drops to the piston rod and its gland,
// and circles the governor. Beat 1: a bench in the dark, a blown glass globe on a wooden stand, a
// carbonised cotton thread between two platinum wires coming up from dull red to yellow-white; a
// rack of focus through the globe to the window, and a night city of gas-amber windows going white
// one by one on an exponential count.
//
// Story parameter. `phase` (crank angle, the closed-form integral of a stroke rate that rises from
// rest), then `volts`, then `lit`.
// World rule. `houseLit`: light has a place. The sun reaches a point only along a ray that passes a
// pane of one of the house's windows (the same function draws the shafts in the haze, the patches
// on the flagstones, the glints on oiled steel and the window in the lamp's glass), plus one point
// light: the fire door, then the filament.
// Beat sheet and sources: R/beats/engine.md.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dot, exp, float, floor, Fn, fract, If, int, length, Loop, max, min, mix as mixN, normalize, normalLocal, normalWorld, positionGeometry, positionLocal, positionWorld, pow, reflect, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, shake, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, vnoise3, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { TICKER_DUR, TICKER_IN } from "../transitions/ticker"

// ---------------------------------------------------------------- layout (metres; x along the beam, y up, z toward the lens)

const START = TICKER_DUR * (1 - TICKER_IN)
const FOV = 34
const PIV = { x: 0, y: 5.4 } // the beam's gudgeon
const LB = 2.6 // half the beam
const RC = 0.915 // the planet's orbit: half the 1.83 m stroke
const GR = RC / 2 // pitch radius of sun and planet (equal)
const NT = 36 // teeth on each
const SUN = { x: LB, y: 1.7 } // the flywheel shaft
const LROD = PIV.y - SUN.y
const XC = -LB * (1 + Math.cos(Math.asin(RC / LB))) * 0.5 // the cylinder's axis: the middle of the beam end's arc
const LINK = 0.78 // main link of the parallel motion
const FLY = { r: 2.135, z: -0.78 }
const GOV = { x: 1.8, y: 3.05, z: -0.22, arm: 0.42, ratio: 1.4 } // the governor's apex
const ZW = -3.4 // the plane of every window
const BENCH = { x: 60, y: 0.9, z: ZW + 1.25 } // the lamp's foot, on the bench
const FIL = { x: BENCH.x, y: BENCH.y + 0.215, z: BENCH.z }
const CITY_Y = -25
// the stroke clock: from rest to the governed 21 double strokes a minute of the 1785 engine (script
// note: 20 to 21), overshooting as the steam comes on and pulled back as the balls rise and the
// butterfly closes. Phase is its integral, tabulated once (Simpson), so seek equals play.
const T_GO = 0.02, W_GOV = (Math.PI * 2 * 21) / 60, TAU = 1.5
const rateAt = (t0: number) => {
  const t = Math.min(t0, 40) - T_GO
  if (t <= 0) return 0
  return W_GOV * (1 - Math.exp(-t / TAU)) * (1 + 0.24 * Math.exp(-(((t - 3.3) / 1.5) ** 2)))
}
const W_MAX = W_GOV * 1.2
const PH_DT = 1 / 240
const PH: Float64Array = (() => {
  const n = Math.ceil(41 / PH_DT) + 1
  const a = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    const t = (i - 1) * PH_DT
    a[i] = a[i - 1] + (PH_DT / 6) * (rateAt(t) + 4 * rateAt(t + PH_DT / 2) + rateAt(t + PH_DT))
  }
  return a
})()
const phaseAt = (t0: number) => {
  const x = Math.max(0, Math.min(t0, 40)) / PH_DT
  const i = Math.floor(x)
  return PH[i] + (PH[i + 1] - PH[i]) * (x - i)
}
/** Seconds of beat 0 at which the crank passes each dead centre (phase = k pi). */
const STROKES: number[] = (() => {
  const out: number[] = []
  for (let k = 1; k <= 14; k++) {
    let a = 0, b = 40
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2
      if (phaseAt(m) < k * Math.PI) a = m
      else b = m
    }
    out.push(a)
  }
  return out
})()
// beat 1
const CUT_H = 1.85, CUT_B = 3.6, CUT_C = 5.0, CUT_D = 6.3
const T_ARRIVE = 0.5, T_GLOW0 = 1.1, T_GLOW1 = 3.6, T_RACK0 = 4.5, T_RACK1 = 5.4, T_CITY0 = 5.1, T_CITY1 = 8.5, CITY_K = 3.6

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const OVER = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const

/** The engine's linkage for one crank angle: everything else hangs off these points. Pure. */
type Pose = { cx: number; cy: number; beta: number; bx: number; by: number; ax: number; ay: number; ty: number; rod: number; orbit: number; sun: number }
const makePose = (): Pose => ({ cx: 0, cy: 0, beta: 0, bx: 0, by: 0, ax: 0, ay: 0, ty: 0, rod: 0, orbit: 0, sun: 0 })
function solve(theta: number, o: Pose) {
  o.cx = SUN.x + RC * Math.sin(theta)
  o.cy = SUN.y + RC * Math.cos(theta)
  // the beam's angle: its end is one rod length from the planet's centre
  let b = Math.asin(clamp((o.cy + LROD - PIV.y) / LB, -0.9, 0.9))
  for (let i = 0; i < 5; i++) {
    const ex = PIV.x + LB * Math.cos(b) - o.cx, ey = PIV.y + LB * Math.sin(b) - o.cy
    const f = ex * ex + ey * ey - LROD * LROD
    const df = 2 * LB * (-ex * Math.sin(b) + ey * Math.cos(b))
    b -= f / df
  }
  o.beta = b
  o.bx = PIV.x + LB * Math.cos(b)
  o.by = PIV.y + LB * Math.sin(b)
  o.ax = PIV.x - LB * Math.cos(b)
  o.ay = PIV.y - LB * Math.sin(b)
  o.ty = o.ay - Math.sqrt(LINK * LINK - (o.ax - XC) * (o.ax - XC))
  o.rod = Math.atan2(o.bx - o.cx, o.by - o.cy) // tilt from the vertical
  o.orbit = Math.atan2(o.cy - SUN.y, o.cx - SUN.x)
  // equal gears, the planet keyed to the rod: the sun turns twice for each orbit, less the rod's own tilt
  o.sun = 2 * o.orbit + o.rod + Math.PI / NT
  return o
}

function gearGeometry(r: number, n: number, depth: number, bore: number) {
  const s = new THREE.Shape()
  const add = 0.022, ded = 0.026
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, da = (Math.PI * 2) / n
    const pt = (k: number, rr: number) => [Math.cos(a + da * k) * rr, Math.sin(a + da * k) * rr] as const
    const P = [pt(-0.25, r - ded), pt(-0.14, r + add), pt(0.14, r + add), pt(0.25, r - ded)]
    P.forEach(([x, y], j) => (i === 0 && j === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  }
  s.closePath()
  // a web lightened by six openings, as a cast wheel is
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const h = new THREE.Path()
    h.absellipse(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.17, r * 0.17, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  const c = new THREE.Path()
  c.absellipse(0, 0, bore, bore, 0, Math.PI * 2, true)
  s.holes.push(c)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 10 })
  g.translate(0, 0, -depth / 2)
  return g
}

export function create(ctx: Ctx): SceneInstance {
  // ---------------------------------------------------------------- uniforms and the world rule

  const U = {
    camP: uniform(new THREE.Vector3()),
    camR: uniform(new THREE.Vector3(1, 0, 0)),
    camU: uniform(new THREE.Vector3(0, 1, 0)),
    camF: uniform(new THREE.Vector3(0, 0, -1)),
    time: uniform(0),
    t0: uniform(0), // seconds of beat 0
    sunI: uniform(1),
    skyC: uniform(new THREE.Vector3(2.3, 2.7, 3.2)), // what a pane shows
    paneG: uniform(1), // the wall panes' own brightness, held down when a shot looks straight into them
    amb: uniform(new THREE.Vector3(0.012, 0.014, 0.018)),
    l2P: uniform(new THREE.Vector3(-6.3, 0.7, 1.3)), // the second light: fire door, then filament
    l2C: uniform(new THREE.Vector3(1, 0.4, 0.1)),
    l2R: uniform(0.6),
    l3P: uniform(new THREE.Vector3(2.85, 3.55, 0.95)), // the engineman's oil lamp, hung off the spring beam
    l3C: uniform(new THREE.Vector3(0, 0, 0)),
    rate: uniform(0), // flywheel speed, radians a second
    volts: uniform(0),
    cityT: uniform(-9),
    strokeT: uniformArray([-99, -99, -99, -99, -99, -99], "float"),
    beamA: uniform(new THREE.Vector3(-LB, PIV.y, 0)),
    beamB: uniform(new THREE.Vector3(LB, PIV.y, 0)),
    rodA: uniform(new THREE.Vector3(SUN.x, SUN.y + RC, 0.13)),
    flyAng: uniform(0),
  }
  const LSv = new THREE.Vector3(-0.2, 0.36, -0.91).normalize() // toward the sun, out through the back wall
  const LS = vec3(LSv.x, LSv.y, LSv.z)
  const SUNC = vec3(1.0, 0.84, 0.62).mul(3.4)
  // every window: centre x, sill, spring of the arch, half-width
  const WINS = [[-3.4, 1.9, 6.2, 1.15], [1.9, 1.9, 6.2, 1.15], [BENCH.x + 0.3, 1.02, 2.3, 0.6]]
  /** How much of a pane a ray from P along d (d.z < 0) finds: the arch, the glazing bars, the dirt. */
  const winHit = (P: V3, d: V3): F => {
    const s = max(P.z.sub(ZW), 0).div(max(d.z.negate(), 0.04)).toVar()
    const h = P.add(d.mul(s)).toVar()
    const soft = s.mul(0.011).add(0.012).toVar()
    const m = float(0).toVar()
    for (const w of WINS) {
      const r = length(vec2(h.x.sub(w[0]), max(h.y.sub(w[2]), 0)))
      const inside = sstep(soft, soft.negate(), r.sub(w[3])).mul(sstep(soft.negate(), soft, h.y.sub(w[1])))
      const bx = abs(fract(h.x.sub(w[0]).div(0.52).add(0.5)).sub(0.5)).mul(0.52)
      const by = abs(fract(h.y.sub(w[1]).div(0.62)).sub(0.5)).mul(0.62).sub(0.31).abs()
      const bar = sstep(float(0.018).sub(soft), float(0.022).add(soft), min(bx, by) as F)
      m.assign(max(m, inside.mul(bar.mul(0.94).add(0.06))))
    }
    const dirt = vnoise(h.xy.mul(2.1)).mul(0.45).add(0.6)
    return m.mul(dirt).mul(step(ZW, P.z)) as F
  }
  // ---- cast shadows: the sun's ray from a point is tested against the engine's big members as
  // capsules and against the flywheel's plane (rim, hub and the six arms, smeared as they are seen)
  /** Least distance between the ray o + t d (t >= margin) and the segment a..b; and where along the ray. */
  const segRay = (o: V3, d: V3, a: V3, b: V3, r: number, soft: number): F => {
    const u = b.sub(a).toVar(), w = o.sub(a).toVar()
    const uu = dot(u, u), ud = dot(u, d), uw = dot(u, w), dw = dot(d, w)
    const sP = clampN(uw.sub(dw.mul(ud)).div(max(uu.sub(ud.mul(ud)), 1e-5)), 0, 1)
    const tR = max(sP.mul(ud).sub(dw), 0)
    const dist = length(w.add(d.mul(tR)).sub(u.mul(sP)))
    const pen = soft + 0.012
    // a point on the member's own skin does not shade itself: the near half of the ray is ignored
    return sstep(r - pen, r + pen, dist as F).add(step(tR, r * 1.15)).min(1) as F
  }
  const v3 = (x: number, y: number, z: number) => vec3(x, y, z) as V3
  const flyShadow = (P: V3, d: V3): F => {
    const tF = P.z.sub(FLY.z).div(d.z.negate().max(0.05))
    const h = P.add(d.mul(tF)).toVar()
    const rel = h.xy.sub(vec2(SUN.x, SUN.y)).toVar()
    const r = length(rel).toVar()
    const rim = sstep(FLY.r - 0.23, FLY.r - 0.18, r).mul(sstep(FLY.r + 0.04, FLY.r, r))
    const hub = sstep(0.38, 0.32, r)
    const a = rel.y.atan(rel.x).sub(U.flyAng)
    const w = max(U.rate.mul(0.02), 0.0005)
    const hw = mixN(float(0.085), float(0.06), r.div(FLY.r)).div(max(r, 0.2))
    const dd = abs(fract(a.div(1.0471976)).sub(0.5)).mul(1.0471976)
    const arm = clampN(hw.add(w.mul(0.5)).sub(dd).div(w.add(0.01)), 0, min(float(1), hw.mul(2).div(w))).mul(step(0.3, r)).mul(step(r, FLY.r - 0.17))
    return float(1).sub(max(max(rim, hub), arm).mul(step(FLY.z + 0.16, P.z))) as F
  }
  const sunShadow = (P: V3, d: V3, full: boolean): F => {
    const k = flyShadow(P, d).toVar()
    k.mulAssign(segRay(P, d, U.beamA as unknown as V3, U.beamB as unknown as V3, 0.3, 0.05))
    k.mulAssign(segRay(P, d, v3(XC, 1.15, 0), v3(XC, 3.45, 0), 0.42, 0.04))
    k.mulAssign(segRay(P, d, v3(0, 0.5, -0.55), v3(0, 4.9, -0.55), 0.17, 0.03))
    k.mulAssign(segRay(P, d, v3(0, 0.5, 0.55), v3(0, 4.9, 0.55), 0.17, 0.03))
    if (full) {
      k.mulAssign(segRay(P, d, U.rodA as unknown as V3, U.beamB as unknown as V3, 0.09, 0.02))
      for (const z of [-0.78, 0.78]) k.mulAssign(segRay(P, d, v3(-5.0, 4.72, z), v3(3.8, 4.72, z), 0.16, 0.03))
      k.mulAssign(segRay(P, d, v3(XC + 0.62, 1.3, -0.42), v3(XC + 0.62, 3.25, -0.42), 0.22, 0.03))
      k.mulAssign(segRay(P, d, v3(GOV.x, 2.3, GOV.z), v3(GOV.x, 3.75, GOV.z), 0.13, 0.03))
      k.mulAssign(segRay(P, d, v3(-7.0, 0, -1.2), v3(-7.0, 3.7, -1.2), 1.75, 0.08))
      k.mulAssign(segRay(P, d, v3(-4.6, 4.05, -0.42), v3(XC + 0.62, 4.05, -0.42), 0.1, 0.02))
    }
    return k as F
  }
  /** Ambient lost near the big members and in the corners where they meet the floor. */
  const occlusion = (P: V3): F => {
    const segD = (a: V3, b: V3, r: number, reach: number): F => {
      const u = b.sub(a), w = P.sub(a)
      const h = clampN(dot(w, u).div(dot(u, u)), 0, 1)
      return float(1).sub(exp(length(w.sub(u.mul(h))).sub(r).max(0).div(-reach)).mul(0.55)) as F
    }
    const k = segD(v3(XC, 0.9, 0), v3(XC, 3.4, 0), 0.62, 0.35).toVar()
    k.mulAssign(segD(v3(0, 0.0, -0.55), v3(0, 4.9, -0.55), 0.3, 0.3))
    k.mulAssign(segD(v3(0, 0.0, 0.55), v3(0, 4.9, 0.55), 0.3, 0.3))
    k.mulAssign(segD(v3(-7.0, 0, -1.2), v3(-7.0, 2.4, -1.2), 2.0, 0.45))
    k.mulAssign(segD(v3(SUN.x, 0, -0.9), v3(SUN.x, 1.5, -0.9), 0.5, 0.35))
    // the floor darkens into the foot of every wall
    k.mulAssign(float(1).sub(exp(max(P.z.sub(ZW), 0).div(-0.6)).mul(0.5)))
    return k as F
  }
  const depthOf = (P: V3): F => dot(P.sub(U.camP), U.camF) as F
  const done = (c: V3, P: V3): V4 => vec4(c, depthOf(P)) as V4
  /** The house's light on a surface. `gloss` scales highlights and what the surface mirrors; `metal` tints them. */
  const houseLit = (alb: V3, N: V3, P: V3, gloss: Num, shine: Num, metal: Num): V3 => {
    const V = normalize(U.camP.sub(P)).toVar()
    const sun = winHit(P, LS).mul(U.sunI).toVar()
    If(sun.greaterThan(0.002), () => {
      sun.mulAssign(sunShadow(P, LS, true))
    })
    const ao = occlusion(P).toVar()
    const R = reflect(V.negate(), N).toVar()
    const env = U.skyC.mul(winHit(P, normalize(vec3(R.x, R.y, min(R.z, -0.05))) as V3)).mul(step(R.z, -0.03))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 4).mul(0.85).add(0.15)
    const d2 = U.l2P.sub(P).toVar()
    const q2 = dot(d2, d2).toVar()
    const L2 = d2.div(sqrt(q2))
    const i2 = U.l2C.div(q2.add(U.l2R))
    const sp1 = pow(max(dot(N, normalize(LS.add(V))), 0), fl(shine)).mul(gloss)
    const sp2 = pow(max(dot(N, normalize(L2.add(V))), 0), fl(shine)).mul(gloss)
    const d3 = U.l3P.sub(P).toVar()
    const q3 = dot(d3, d3).toVar()
    const L3 = d3.div(sqrt(q3))
    const i3 = U.l3C.div(q3.add(0.08))
    const sp3 = pow(max(dot(N, normalize(L3.add(V))), 0), fl(shine)).mul(gloss)
    // the sun's patches on the flagstones in front of the engine throw a warm bounce up and back onto it
    const bounce = SUNC.mul(U.sunI).mul(0.032).mul(clampN(N.y.mul(-0.45).add(N.z.mul(0.4)).add(0.5), 0, 1)).mul(sstep(-2.5, 1.5, P.z))
    const amb = U.amb.mul(N.y.mul(0.3).add(0.7)).add(U.skyC.mul(0.006).mul(max(N.z.negate().mul(0.6).add(0.4), 0))).add(bounce)
    const tint = mixN(vec3(1), alb.mul(2.6).add(0.08), fl(metal))
    const diff = alb.mul(float(1).sub(fl(metal).mul(0.65)))
    return diff
      .mul(SUNC.mul(sun).mul(max(dot(N, LS), 0)).add(i2.mul(max(dot(N, L2).mul(0.8).add(0.2), 0)).mul(ao)).add(i3.mul(max(dot(N, L3), 0))).add(amb.mul(ao)))
      .add(tint.mul(SUNC.mul(sun).mul(sp1).add(i2.mul(sp2)).add(i3.mul(sp3)).add(env.mul(fres).mul(min(fl(gloss), 1.5)).mul(0.5)))) as V3
  }

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 1400)
  const vp = cameraProjectionMatrix.mul(cameraViewMatrix)

  // ---------------------------------------------------------------- materials: cast iron, oiled steel, brass, oak, brick, flagstone

  type Stuff = "gear" | "cyl" | "cold" | "iron" | "steel" | "brass" | "oak" | "brick" | "wall" | "flag" | "leather" | "plaster" | "water" | "coal" | "platinum"
  const surf = (kind: Stuff, tone: [number, number, number], axis: "x" | "y" | "z" = "y") => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const q = positionLocal
      const P = positionWorld
      const N = normalize(normalWorld).toVar()
      const along = axis === "x" ? q.x : axis === "y" ? q.y : q.z
      const ac = axis === "x" ? vec2(q.y, q.z) : axis === "y" ? vec2(q.x, q.z) : vec2(q.x, q.y)
      const alb = vec3(...tone).toVar()
      const gloss = float(0.05).toVar()
      const shine = float(30).toVar()
      let metal: Num = 0
      const out = vec3(0).toVar()
      if (kind === "iron" || kind === "cyl" || kind === "cold") {
        // sand-cast: a pebbled skin, soot in the hollows, rust where it has stood, oil where rags reach; drips down it
        const peb = vnoise(vec2(q.x.mul(170).add(q.z.mul(97)), q.y.mul(170).sub(q.z.mul(61)))).toVar()
        const grime = fbm(vec2(along.mul(1.9).add(ac.y), ac.x.mul(2.6).add(ac.y.mul(2.2)))).toVar()
        const drip = sstep(0.62, 0.9, vnoise(vec2(q.x.mul(46).add(q.z.mul(38)), q.y.mul(1.7))))
        alb.mulAssign(peb.mul(0.5).add(0.65).mul(grime.mul(1.1).add(0.3)))
        alb.addAssign(vec3(0.07, 0.028, 0.01).mul(sstep(0.5, 0.75, grime)).mul(0.6))
        // the parting seam of the mould, left as a fin and dressed off
        alb.addAssign(sstep(0.007, 0.002, abs(ac.y)).mul(0.03))
        gloss.assign(grime.oneMinus().mul(0.55).add(0.1).add(drip.mul(0.8)))
        shine.assign(drip.mul(90).add(26))
        metal = 0.55
        if (kind === "cyl" || kind === "cold") {
          // water: on the cylinder, what the gland leaks condenses on the cover and runs down the barrel
          // in tracks, carrying the oil with it; the condenser and the air pump stand in cold water and sweat
          const a = q.z.atan(q.x)
          const run = sstep(0.55, 0.82, vnoise(vec2(a.mul(9), q.y.mul(0.5)))).mul(kind === "cyl" ? sstep(0.4, 1.9, q.y) : float(0.6)).toVar()
          const wetZone = kind === "cyl" ? sstep(1.9, 2.05, q.y).add(run).min(1) : float(1)
          const c = vec2(a.mul(kind === "cyl" ? 34 : 18), q.y.mul(kind === "cyl" ? 70 : 60))
          const cell = floor(c)
          const h = hash21(cell)
          const f = fract(c).sub(0.5).sub(vec2(hash21(cell.add(3.7)), hash21(cell.add(9.1))).sub(0.5).mul(0.5))
          const rad = h.mul(0.22).add(0.12)
          const bead = sstep(rad, rad.mul(0.35), length(f)).mul(step(0.45, h)).mul(wetZone).toVar()
          const tang = vec3(sin(a).negate(), 0, cos(a))
          N.assign(normalize(N.add(tang.mul(f.x).add(vec3(0, 1, 0).mul(f.y)).div(rad).mul(bead).mul(0.9))))
          alb.assign(mixN(alb, alb.mul(vec3(0.55, 0.42, 0.25)), run.mul(0.7)))
          alb.mulAssign(float(1).sub(wetZone.mul(0.35)))
          gloss.assign(max(gloss, wetZone.mul(1.0).add(bead.mul(1.6))))
          shine.assign(mixN(shine, float(240), max(bead, run.mul(0.5))))
        }
      } else if (kind === "gear") {
        // sun and planet: cast iron blacked with paint over the sand skin. The paint is chipped off the
        // tooth tips and the meshing flanks are rubbed down to bright grey metal; oil sits in the roots
        // and is flung out across the web in streaks; rust blooms brown where the paint has lifted.
        const nl = normalize(normalLocal)
        const rr = length(q.xy).toVar()
        const tang = abs(dot(nl.xy, vec2(q.y.negate(), q.x).div(max(rr, 0.0001))))
        const side = abs(nl.z)
        const tooth = sstep(GR - 0.03, GR - 0.012, rr).toVar()
        const flank = tooth.mul(sstep(0.3, 0.65, tang)).mul(sstep(0.7, 0.3, side)).toVar()
        const peb = vnoise(vec2(q.x.mul(160).add(q.z.mul(90)), q.y.mul(160).sub(q.z.mul(70)))).toVar()
        const grime = fbm(vec2(q.x.mul(3.1), q.y.mul(3.1)).add(q.z.mul(2))).toVar()
        const chip = sstep(0.71, 0.76, vnoise(vec2(q.x.mul(34), q.y.mul(34)).add(q.z.mul(11)))).mul(tooth.mul(0.7).add(0.25)).max(sstep(GR + 0.012, GR + 0.02, rr)).toVar()
        const bloom = sstep(0.62, 0.7, vnoise(vec2(q.x.mul(34), q.y.mul(34)).add(q.z.mul(11)))).mul(float(1).sub(chip)).mul(0.6).toVar()
        const rust = bloom.max(sstep(0.74, 0.9, grime).mul(0.4)).mul(float(1).sub(flank)).toVar()
        const ang = q.y.atan(q.x)
        const fling = sstep(0.55, 0.85, vnoise(vec2(ang.mul(40), rr.mul(5)))).mul(sstep(0.5, 0.95, side)).mul(sstep(0.12, 0.4, rr))
        const root = sstep(GR - 0.005, GR - 0.022, rr).mul(sstep(GR - 0.05, GR - 0.034, rr)).add(fling.mul(0.7)).min(1).toVar()
        alb.assign(vec3(0.02, 0.019, 0.018).mul(peb.mul(0.35).add(0.8)).mul(grime.mul(0.5).add(0.75)))
        alb.assign(mixN(alb, vec3(0.08, 0.075, 0.07).mul(peb.mul(0.5).add(0.7)), chip))
        alb.assign(mixN(alb, mixN(vec3(0.07, 0.03, 0.012), vec3(0.13, 0.055, 0.02), peb), rust.mul(0.85)))
        alb.assign(mixN(alb, vec3(0.2, 0.2, 0.21).mul(vnoise(vec2(rr.mul(900), q.z.mul(40))).mul(0.25).add(0.8)), flank))
        alb.assign(mixN(alb, alb.mul(vec3(0.5, 0.36, 0.18)), root.mul(0.8)))
        gloss.assign(mixN(float(0.22), float(0.08), rust).add(flank.mul(1.0)).add(root.mul(1.4)))
        shine.assign(mixN(float(34), float(150), max(root, flank.mul(0.6))))
        metal = mixN(float(0.15), float(0.9), max(flank, chip.mul(0.6)))
      } else if (kind === "steel" || kind === "platinum") {
        // turned and oiled: fine rings from the lathe, the oil gone amber and thick in places
        const ring = vnoise(vec2(along.mul(900), 0.5)).mul(0.18).add(vnoise(vec2(along.mul(140), 3.5)).mul(0.2))
        const oil = sstep(0.45, 0.8, fbm(vec2(along.mul(5), ac.x.mul(9).add(ac.y.mul(7)))))
        alb.mulAssign(ring.add(0.72))
        alb.assign(mixN(alb, alb.mul(vec3(0.75, 0.56, 0.3)), oil.mul(kind === "steel" ? 0.6 : 0)))
        gloss.assign(oil.mul(0.6).add(1.3))
        shine.assign(190)
        metal = 1
      } else if (kind === "brass") {
        const tarn = fbm(vec2(along.mul(9), ac.x.mul(14).add(ac.y.mul(11)))).toVar()
        alb.mulAssign(tarn.mul(0.7).add(0.55))
        alb.assign(mixN(alb, vec3(0.05, 0.075, 0.055), sstep(0.62, 0.85, tarn).mul(0.5)))
        gloss.assign(tarn.oneMinus().mul(1.1).add(0.3))
        shine.assign(80)
        metal = 1
      } else if (kind === "oak") {
        // old oak: long grain, drying checks along it, soot rubbed into the pores
        const g1 = vnoise(vec2(along.mul(1.1), ac.x.mul(38).add(ac.y.mul(31))))
        const g2 = vnoise(vec2(along.mul(7), ac.x.mul(260).add(ac.y.mul(210))))
        const check = sstep(0.8, 0.92, vnoise(vec2(along.mul(0.55), ac.x.mul(70).add(ac.y.mul(59)))))
        alb.mulAssign(g1.mul(0.6).add(g2.mul(0.35)).add(0.4))
        alb.mulAssign(check.mul(0.75).oneMinus())
        alb.mulAssign(fbm(vec2(along.mul(0.7), ac.y.mul(3))).mul(0.6).add(0.55))
        gloss.assign(g2.mul(0.12))
      } else if (kind === "brick" || kind === "wall") {
        // English bond, lime mortar, a century of soot rising up the wall
        const u = N.z.abs().greaterThan(0.5).select(P.x, P.z).toVar()
        const row = floor(P.y.div(0.075)).toVar()
        const header = row.mod(2)
        const bl = mixN(float(0.225), float(0.1125), header)
        const uu = u.div(bl).add(row.mul(0.37)).toVar()
        const fx = fract(uu), fy = fract(P.y.div(0.075))
        const joint = min(min(fx, fx.oneMinus()).mul(bl), min(fy, fy.oneMinus()).mul(0.075))
        const aa = max(abs(dFdxS(u)).add(abs(dFdyS(P.y))), 0.0006)
        const mort = sstep(aa.mul(1.5).add(0.006), 0.004, joint as F).mul(sstep(0.02, 0.006, aa))
        const id = hash21(vec2(floor(uu), row))
        const soot = fbm(vec2(u.mul(0.35), P.y.mul(0.5))).mul(0.8).add(sstep(0.5, 7, P.y).mul(0.55)).toVar()
        alb.assign(mixN(vec3(0.2, 0.075, 0.045), vec3(0.13, 0.06, 0.05), id).mul(id.mul(0.5).add(0.7)))
        alb.assign(mixN(alb, vec3(0.3, 0.28, 0.24), mort.mul(0.7)))
        alb.mulAssign(float(1.05).sub(soot.mul(0.8)).max(0.12))
        alb.mulAssign(vnoise(vec2(u.mul(130), P.y.mul(130))).mul(0.3).add(0.85))
        // wear: a few faces spalled back to fresh orange brick, the arrises knocked off at shoulder
        // height, and salt blooming white out of the courses near the damp floor
        const id2 = hash21(vec2(floor(uu), row).add(17.3))
        const spall = step(0.93, id2).mul(sstep(0.25, 0.55, vnoise(vec2(u.mul(28), P.y.mul(28)))))
        alb.assign(mixN(alb, vec3(0.3, 0.12, 0.06).mul(vnoise(vec2(u.mul(90), P.y.mul(90))).mul(0.4).add(0.7)), spall.mul(sstep(0.0, 0.004, joint as F))))
        const salt = sstep(0.5, 0.78, fbm(vec2(u.mul(1.3), P.y.mul(3.1)).add(2.2))).mul(sstep(1.4, 0.15, P.y))
        alb.assign(mixN(alb, vec3(0.32, 0.31, 0.28), salt.mul(0.55)))
        gloss.assign(0.03)
        if (kind === "wall") {
          // the windows themselves: bright dirty glass in iron bars, a splayed reveal round each
          const pane = winHit(P.add(vec3(0, 0, 0.02)) as V3, vec3(0, 0, -1) as V3).mul(step(P.z, ZW + 0.3)).mul(step(0.5, N.z))
          out.assign(U.skyC.mul(pane).mul(vnoise(P.xy.mul(7)).mul(0.3).add(0.8)).mul(U.paneG.mul(0.42)))
        }
      } else if (kind === "flag") {
        // flagstones laid in courses, worn hollow, coal dust trodden in toward the boiler, oil under the engine
        const row = floor(P.z.div(0.62)).toVar()
        const xx = P.x.div(0.95).add(hash21(vec2(row, 3.1)).mul(7)).toVar()
        const fx = fract(xx), fz = fract(P.z.div(0.62))
        const joint = min(min(fx, fx.oneMinus()).mul(0.95), min(fz, fz.oneMinus()).mul(0.62))
        const id = hash21(vec2(floor(xx), row))
        const st = fbm(P.xz.mul(5.5)).toVar()
        alb.assign(mixN(vec3(0.19, 0.185, 0.17), vec3(0.13, 0.125, 0.12), id).mul(st.mul(0.6).add(0.65)))
        alb.mulAssign(sstep(0.004, 0.02, joint as F).mul(0.75).add(0.25))
        const coal = sstep(0.35, 0.75, fbm(P.xz.mul(0.9).add(4.4)).add(sstep(-2.5, -6.5, P.x).mul(0.45)))
        alb.mulAssign(coal.mul(0.82).oneMinus())
        const oil = sstep(0.55, 0.7, fbm(P.xz.mul(1.7).add(9.1))).mul(sstep(4.5, 1.5, length(P.xz.sub(vec2(-0.6, 0.6)))))
        alb.mulAssign(oil.mul(0.6).oneMinus())
        gloss.assign(oil.mul(1.1).add(st.mul(0.22)).add(0.05))
        shine.assign(60)
      } else if (kind === "leather") {
        alb.mulAssign(vnoise(vec2(along.mul(60), ac.x.mul(200))).mul(0.4).add(0.7))
        gloss.assign(0.18)
      } else if (kind === "coal") {
        const f = vnoise(vec2(q.x.mul(90).add(q.y.mul(70)), q.z.mul(90).sub(q.y.mul(50))))
        alb.mulAssign(f.mul(0.8).add(0.4))
        gloss.assign(sstep(0.55, 0.8, f).mul(1.4))
        shine.assign(50)
      } else if (kind === "water") {
        // the cistern: black cold water, shaken a little by the pump
        const w = sin(P.x.mul(31).add(U.time.mul(3.1))).mul(sin(P.z.mul(27).sub(U.time.mul(2.3)))).mul(U.rate.mul(0.012).add(0.02))
        N.assign(normalize(vec3(w, 1, w.mul(0.7))))
        gloss.assign(2.4)
        shine.assign(260)
      } else {
        alb.mulAssign(fbm(vec2(P.x.mul(2.4).add(P.z), P.y.mul(2.4))).mul(0.4).add(0.75))
      }
      out.addAssign(houseLit(alb as V3, N as V3, P as V3, gloss as F, shine as F, metal))
      return done(out as V3, P as V3)
    })()
    return m
  }
  // (derivatives of a world coordinate, for the brick joints' anti-aliasing)
  function dFdxS(x: F): F {
    return x.dFdx() as F
  }
  function dFdyS(x: F): F {
    return x.dFdy() as F
  }
  const M = {
    iron: surf("iron", [0.05, 0.05, 0.055]),
    cyl: surf("cyl", [0.055, 0.052, 0.055]),
    cold: surf("cold", [0.045, 0.048, 0.052]),
    ironX: surf("iron", [0.05, 0.05, 0.055], "x"),
    ironZ: surf("iron", [0.045, 0.045, 0.05], "z"),
    gear: surf("gear", [0.02, 0.02, 0.02], "z"),
    steel: surf("steel", [0.62, 0.63, 0.66]),
    steelX: surf("steel", [0.55, 0.56, 0.6], "x"),
    brass: surf("brass", [0.62, 0.42, 0.15]),
    oakX: surf("oak", [0.2, 0.125, 0.07], "x"),
    oakY: surf("oak", [0.17, 0.105, 0.06], "y"),
    oakZ: surf("oak", [0.18, 0.11, 0.06], "z"),
    brick: surf("brick", [0, 0, 0]),
    wall: surf("wall", [0, 0, 0]),
    flag: surf("flag", [0, 0, 0]),
    belt: surf("leather", [0.1, 0.06, 0.035], "x"),
    coal: surf("coal", [0.018, 0.018, 0.02]),
    water: surf("water", [0.004, 0.006, 0.006]),
    plaster: surf("plaster", [0.07, 0.06, 0.05]),
    platinum: surf("platinum", [0.36, 0.355, 0.34]),
  }

  // ---------------------------------------------------------------- building: static parts are merged per material

  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4a = new THREE.Vector3(), v4b = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1)
  /** A static part: baked into its material's batch at (x, y, z) with a rotation. */
  const put = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(m4.compose(v4a.set(x, y, z), q4.setFromEuler(e4.set(rx, ry, rz)), ONE))
    if (!batches.has(m)) batches.set(m, [])
    batches.get(m)!.push(g)
  }
  const merge = (parts: THREE.BufferGeometry[]) => {
    let n = 0
    const flat = parts.map((g) => {
      const f = g.index ? g.toNonIndexed() : g
      n += f.getAttribute("position").count
      return f
    })
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3)
    let o = 0
    for (const f of flat) {
      pos.set(f.getAttribute("position").array as Float32Array, o)
      nor.set(f.getAttribute("normal").array as Float32Array, o)
      o += f.getAttribute("position").count * 3
      f.dispose()
    }
    for (const g of parts) g.dispose()
    const out = new THREE.BufferGeometry()
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
    return out
  }
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const cyl = (r0: number, r1: number, h: number, seg = 20) => new THREE.CylinderGeometry(r0, r1, h, seg)
  const lathe = (pts: number[][], seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
  /** A static round bar from a to b. */
  const pipe = (a: number[], b: number[], r: number, m: THREE.Material, seg = 12) => {
    v4a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = v4a.length()
    const g = cyl(r, r, len, seg)
    g.applyQuaternion(q4.setFromUnitVectors(v4b.set(0, 1, 0), v4a.normalize()))
    put(g, m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  }
  /** A ring of hex bolt heads round a flange (axis y), or along a line. */
  const boltRing = (x: number, y: number, z: number, r: number, n: number, s = 0.024) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      put(cyl(s, s, s * 1.3, 6), M.iron, x + Math.cos(a) * r, y, z + Math.sin(a) * r)
    }
  }
  const boltsZ = (pts: number[][], z: number, s = 0.026) => {
    for (const p of pts) put(cyl(s, s, s * 1.2, 6), M.ironZ, p[0], p[1], z, Math.PI / 2)
  }
  const dyn = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = scene) => {
    const o = new THREE.Mesh(g, m)
    parent.add(o)
    return o
  }

  // ---- the house: flagstones, brick walls, the roof's timbers
  put(box(40, 0.3, 26), M.flag, -1, -0.15, 3)
  put(box(40, 12, 0.5), M.wall, -1, 6, ZW - 0.25)
  put(box(0.5, 12, 26), M.brick, -11.2, 6, 3)
  put(box(0.5, 12, 26), M.brick, 9.5, 6, 3)
  for (const x of [-7.5, -0.6, 6.2]) {
    // king-post trusses overhead, and a brick pier under each
    put(box(0.26, 0.34, 14), M.oakZ, x, 9.2, 2.5)
    put(box(0.2, 1.7, 0.2), M.oakY, x, 10.1, 2.5)
    put(box(0.2, 0.26, 6.4), M.oakZ, x, 10.2, 0.1, 0.42)
    put(box(0.2, 0.26, 6.4), M.oakZ, x, 10.2, 4.9, -0.42)
    put(box(0.7, 9.2, 0.24), M.brick, x, 4.6, ZW + 0.12)
  }
  // a stone sill and an iron frame to each window
  for (const w of WINS.slice(0, 2)) put(box(2.7, 0.14, 0.34), M.flag, w[0], w[1] - 0.07, ZW + 0.15)
  // the flywheel pit: a kerb of dressed stone round a slot in the floor
  put(box(4.9, 0.22, 0.16), M.flag, SUN.x, 0.11, FLY.z + 0.36)
  put(box(4.9, 0.22, 0.16), M.flag, SUN.x, 0.11, FLY.z - 0.36)

  // ---- the boiler: a haystack of riveted plates in a brick setting, the fire door, the ash pit, coal
  const BO = { x: -7.0, z: -1.2 }
  put(box(3.6, 2.5, 3.6), M.brick, BO.x, 1.25, BO.z)
  put(box(3.9, 0.16, 3.9), M.flag, BO.x, 2.58, BO.z)
  put(lathe([[1.5, 0], [1.56, 0.5], [1.5, 0.95], [1.25, 1.35], [0.85, 1.62], [0.4, 1.76], [0.001, 1.8]], 40), M.iron, BO.x, 2.66, BO.z)
  for (let k = 0; k < 4; k++) boltRing(BO.x, 2.66 + [0.5, 0.95, 1.36, 1.62][k] + 0.01, BO.z, [1.57, 1.51, 1.25, 0.86][k], [56, 54, 44, 30][k], 0.016) // rivet seams
  put(box(1.0, 1.05, 0.1), M.ironZ, BO.x + 0.5, 0.95, BO.z + 1.82) // the fire door's frame
  put(box(0.9, 0.34, 0.12), M.ironZ, BO.x + 0.5, 0.2, BO.z + 1.82) // ash pit
  boltsZ([[-0.42, 1.4], [0.42, 1.4], [-0.42, 0.5], [0.42, 0.5]].map(([a, b]) => [BO.x + 0.5 + a, b]), BO.z + 1.88)
  // the door: two leaves standing ajar on the heat, bright through the gap and the air slots
  const fireMat = new THREE.NodeMaterial()
  fireMat.fragmentNode = Fn(() => {
    const q = positionLocal
    const fl2 = fbm(vec2(q.x.mul(5), q.y.mul(4).sub(U.time.mul(1.6)))).toVar()
    const slot = sstep(0.03, 0.012, abs(q.x)).add(sstep(0.02, 0.008, abs(fract(q.y.mul(9)).sub(0.5)).mul(0.11)).mul(step(q.y, -0.2)))
    const c = vec3(1.0, 0.36, 0.06).mul(fl2.mul(9).add(2.5)).mul(sat1(slot as F)).add(vec3(0.3, 0.03, 0.0).mul(fl2))
    return done(c.add(houseLit(vec3(0.03) as V3, normalize(normalWorld) as V3, positionWorld as V3, 0.3, 30, 0.5).mul(sat1(slot as F).oneMinus())) as V3, positionWorld as V3)
  })()
  dyn(box(0.78, 0.84, 0.05), fireMat).position.set(BO.x + 0.5, 0.95, BO.z + 1.89)
  {
    // the coal heap, and what has rolled from it
    const R = rng(1769)
    for (let i = 0; i < 260; i++) {
      const a = R() * 6.283, r = Math.pow(R(), 0.7) * 1.5, hgt = Math.max(0, 0.62 - r * 0.45)
      const s = 0.05 + R() * 0.09
      const g = new THREE.DodecahedronGeometry(s, 0)
      g.scale(1, 0.6 + R() * 0.6, 0.7 + R() * 0.5)
      put(g, M.coal, BO.x - 1.2 + Math.cos(a) * r * 1.2, hgt * R() + s * 0.4, BO.z + 3.6 + Math.sin(a) * r * 0.8, R() * 3, R() * 3, R() * 3)
    }
  }
  // the steam pipe: off the crown of the boiler, along to the valve chest, with the throttle in it
  const SP = { y: 4.05, z: -0.42 }
  pipe([BO.x, 4.4, BO.z], [BO.x, SP.y + 0.6, BO.z], 0.1, M.iron)
  pipe([BO.x, SP.y + 0.6, BO.z], [-4.6, SP.y, SP.z], 0.1, M.iron)
  pipe([-4.6, SP.y, SP.z], [XC + 0.62, SP.y, SP.z], 0.1, M.ironX)
  pipe([XC + 0.62, SP.y, SP.z], [XC + 0.62, 3.2, SP.z], 0.1, M.iron)
  for (const x of [-4.6, -3.6, XC + 0.2]) put(cyl(0.17, 0.17, 0.05, 20), M.ironX, x, SP.y, SP.z, 0, 0, Math.PI / 2) // flanges
  const TH = { x: -3.1 } // the butterfly's housing
  put(cyl(0.15, 0.15, 0.2, 20), M.ironX, TH.x, SP.y, SP.z, 0, 0, Math.PI / 2)

  // ---- the cylinder on its plinth, the valve chest behind it
  const CY = { y0: 1.15, y1: 3.3, r: 0.4 }
  put(box(1.7, 0.7, 1.9), M.flag, XC + 0.2, 0.35, -0.1)
  put(box(1.5, 0.45, 1.5), M.ironX, XC, 0.92, 0)
  put(lathe([[0.56, 0], [0.56, 0.06], [0.42, 0.08], [CY.r, 0.14], [CY.r, 0.9], [CY.r + 0.022, 0.92], [CY.r + 0.022, 0.97], [CY.r, 0.99], [CY.r, 1.95], [0.42, 2.02], [0.55, 2.04], [0.55, 2.1], [0.5, 2.13], [0.3, 2.19], [0.13, 2.21], [0.13, 2.33], [0.09, 2.35], [0.001, 2.35]], 48), M.cyl, XC, CY.y0, 0)
  boltRing(XC, CY.y0 + 2.115, 0, 0.49, 16)
  boltRing(XC, CY.y0 + 0.075, 0, 0.5, 16)
  put(lathe([[0.1, 0], [0.14, 0.02], [0.14, 0.08], [0.06, 0.1], [0.045, 0.1]], 20), M.brass, XC, CY.y0 + 2.34, 0) // the gland
  put(lathe([[0.02, 0], [0.035, 0.03], [0.035, 0.09], [0.012, 0.1], [0.001, 0.13]], 12), M.brass, XC + 0.28, CY.y0 + 2.2, 0.2) // an oil cup on the cover
  const VC = { x: XC + 0.62, z: SP.z }
  put(box(0.42, 0.5, 0.4), M.iron, VC.x, 3.0, VC.z) // upper and lower nozzle boxes
  put(box(0.42, 0.5, 0.4), M.iron, VC.x, 1.5, VC.z)
  pipe([VC.x, 1.7, VC.z], [VC.x, 2.8, VC.z], 0.13, M.iron)
  pipe([VC.x - 0.2, 3.0, VC.z + 0.1], [XC + 0.25, 3.0, 0.1], 0.12, M.ironX)
  pipe([VC.x - 0.2, 1.5, VC.z + 0.1], [XC + 0.25, 1.5, 0.1], 0.12, M.ironX)
  boltsZ([[-0.16, 3.2], [0.16, 3.2], [-0.16, 2.8], [0.16, 2.8], [-0.16, 1.7], [0.16, 1.7], [-0.16, 1.3], [0.16, 1.3]].map(([a, b]) => [VC.x + a, b]), VC.z + 0.21, 0.02)
  // ---- Watt's improvement: the cistern of cold water under the floor's edge, the condenser and the air pump standing in it
  const CI = { x: -1.25, z: 0.15, w: 1.5, d: 1.7 }
  put(box(CI.w + 0.16, 0.5, 0.09), M.oakX, CI.x, 0.25, CI.z + CI.d / 2)
  put(box(CI.w + 0.16, 0.5, 0.09), M.oakX, CI.x, 0.25, CI.z - CI.d / 2)
  put(box(0.09, 0.5, CI.d), M.oakZ, CI.x - CI.w / 2, 0.25, CI.z)
  put(box(0.09, 0.5, CI.d), M.oakZ, CI.x + CI.w / 2, 0.25, CI.z)
  for (const y of [0.1, 0.4]) {
    put(box(CI.w + 0.2, 0.04, 0.012), M.ironX, CI.x, y, CI.z + CI.d / 2 + 0.05) // the tank's iron hoops
    put(box(0.012, 0.04, CI.d + 0.1), M.ironZ, CI.x + CI.w / 2 + 0.05, y, CI.z)
  }
  put(box(CI.w, 0.02, CI.d), M.water, CI.x, 0.36, CI.z)
  const PUMP = { x: -0.95, z: 0.0 }
  put(lathe([[0.2, 0], [0.2, 0.62], [0.26, 0.64], [0.26, 0.69], [0.1, 0.71], [0.1, 0.76], [0.045, 0.78]], 28), M.cold, PUMP.x, 0.2, PUMP.z) // the air pump's barrel
  boltRing(PUMP.x, 0.9, PUMP.z, 0.225, 10, 0.016)
  put(lathe([[0.17, 0], [0.17, 0.44], [0.1, 0.52], [0.07, 0.56]], 24), M.cold, -1.62, 0.2, 0.5) // the condenser
  pipe([-1.62, 0.74, 0.5], [-1.62, 1.0, 0.5], 0.07, M.iron)
  pipe([-1.62, 1.0, 0.5], [VC.x, 1.3, VC.z + 0.1], 0.07, M.iron) // the eduction pipe, down from the lower nozzle
  pipe([-1.45, 0.5, 0.4], [PUMP.x - 0.18, 0.45, 0.1], 0.06, M.iron) // condenser to pump, under water
  put(lathe([[0.012, 0], [0.02, 0.02], [0.02, 0.1], [0.012, 0.12], [0.012, 0.3]], 10), M.brass, -1.75, 0.72, 0.62) // the injection cock

  // ---- the frame: a stone pier, two cast columns, the entablature and the beam's plummer blocks
  put(box(1.0, 0.5, 1.9), M.flag, 0, 0.25, 0)
  for (const z of [-0.55, 0.55]) {
    put(lathe([[0.3, 0], [0.3, 0.1], [0.22, 0.16], [0.2, 0.3], [0.165, 0.42], [0.15, 2.2], [0.135, 4.05], [0.16, 4.12], [0.2, 4.16], [0.25, 4.28], [0.25, 4.36]], 28), M.iron, 0, 0.5, z)
    put(box(0.5, 0.2, 0.3), M.ironX, 0, 5.16, z) // plummer block
    put(lathe([[0.012, 0], [0.03, 0.03], [0.03, 0.08], [0.001, 0.1]], 10), M.brass, 0, 5.52, z) // its oil cup
    put(box(0.34, 0.1, 0.26), M.ironX, 0, 5.45, z)
    boltsZ([[-0.19, 5.5], [0.19, 5.5]], z, 0.02)
  }
  put(box(0.56, 0.2, 1.7), M.ironZ, 0, 4.96, 0)
  // spring beams from the wall carrying the frame's top, and the radius rods' anchors on them
  for (const z of [-0.78, 0.78]) put(box(8.8, 0.3, 0.2), M.oakX, -0.6, 4.72, z)
  for (const x of [-4.6, 3.4]) put(box(0.24, 0.3, 4.6), M.oakZ, x, 4.42, -1.2)
  put(box(0.22, 4.6, 0.22), M.oakY, -4.6, 2.3, 0.78)
  put(box(0.22, 4.6, 0.22), M.oakY, 3.4 + 1.8, 2.3, 0.78)
  put(box(2.0, 0.3, 0.2), M.oakX, 4.3, 4.72, 0.78)

  // ---- the shaft: plummer blocks on masonry, the sun gear overhung on its end
  put(box(0.7, SUN.y - 0.2, 0.5), M.flag, SUN.x, (SUN.y - 0.2) / 2, -0.32)
  put(box(0.7, SUN.y - 0.2, 0.5), M.flag, SUN.x, (SUN.y - 0.2) / 2, -1.5)
  for (const z of [-0.32, -1.5]) {
    put(box(0.56, 0.36, 0.3), M.ironX, SUN.x, SUN.y - 0.04, z)
    put(lathe([[0.012, 0], [0.03, 0.03], [0.03, 0.08], [0.001, 0.1]], 10), M.brass, SUN.x, SUN.y + 0.14, z)
    boltsZ([[SUN.x - 0.22, SUN.y + 0.16], [SUN.x + 0.22, SUN.y + 0.16]], z, 0.022)
  }

  // ---- the governor's bracket and the lay shaft that drives it
  put(box(0.12, 0.9, 0.12), M.ironX, GOV.x, 4.2, GOV.z - 0.36) // hanger from the spring beam
  put(box(0.5, 0.1, 0.12), M.ironX, GOV.x, 3.72, GOV.z - 0.18)
  put(box(0.5, 0.08, 0.12), M.ironX, GOV.x, 1.75, GOV.z - 0.18)
  put(box(0.1, 2.0, 0.1), M.ironX, GOV.x - 0.2, 2.72, GOV.z - 0.36)
  for (const b of batches) {
    const mesh = new THREE.Mesh(merge(b[1]), b[0])
    mesh.frustumCulled = false
    scene.add(mesh)
  }
  batches.clear()

  // ---------------------------------------------------------------- the moving engine

  const UNIT = cyl(1, 1, 1, 14).translate(0, 0.5, 0) // a bar from its foot, for links that span two points
  const UNITB = box(1, 1, 1).translate(0, 0.5, 0)
  /** Lay a unit bar from (ax, ay) to (bx, by) at depth z, with thickness r (and rz for a flat strap). */
  const span = (o: THREE.Object3D, ax: number, ay: number, bx: number, by: number, z: number, r: number, rz = r) => {
    o.position.set(ax, ay, z)
    o.rotation.z = -Math.atan2(bx - ax, by - ay)
    o.scale.set(r, Math.hypot(bx - ax, by - ay), rz)
  }
  // the beam: oak, strapped and bolted, iron end-fittings and a gudgeon through its middle
  const beam = new THREE.Group()
  beam.position.set(PIV.x, PIV.y, 0)
  scene.add(beam)
  {
    const parts: THREE.BufferGeometry[] = []
    const iron: THREE.BufferGeometry[] = []
    // a fish-bellied timber: deepest at the gudgeon
    const s = new THREE.Shape()
    s.moveTo(-LB - 0.1, -0.2)
    s.quadraticCurveTo(0, -0.42, LB + 0.1, -0.2)
    s.lineTo(LB + 0.1, 0.2)
    s.quadraticCurveTo(0, 0.36, -LB - 0.1, 0.2)
    s.closePath()
    parts.push(new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 16 }).translate(0, 0, -0.18))
    for (const x of [-2.5, -1.75, -0.95, -0.3, 0.3, 0.95, 1.75, 2.5]) {
      const h = 0.44 + 0.3 * (1 - (x / LB) ** 2)
      iron.push(box(0.09, h + 0.03, 0.39).translate(x, -0.02 * (1 - (x / LB) ** 2), 0)) // straps
      for (const sy of [-1, 1]) iron.push(cyl(0.02, 0.02, 0.42, 6).rotateX(Math.PI / 2).translate(x, sy * h * 0.36, 0))
    }
    iron.push(cyl(0.085, 0.085, 1.5, 20).rotateX(Math.PI / 2)) // the gudgeon
    iron.push(box(0.5, 0.5, 0.4))
    for (const x of [-LB, LB]) iron.push(cyl(0.05, 0.05, 0.66, 14).rotateX(Math.PI / 2).translate(x, 0, 0), box(0.3, 0.36, 0.4).translate(x, 0, 0))
    iron.push(cyl(0.04, 0.04, 0.6, 12).rotateX(Math.PI / 2).translate(-LB / 2, 0, 0), cyl(0.04, 0.04, 0.5, 12).rotateX(Math.PI / 2).translate(-0.95, 0, 0))
    // a king post and tie rods over the back, as the timber beams were trussed
    iron.push(box(0.07, 0.7, 0.07).translate(0, 0.6, 0))
    for (const sx of [-1, 1]) iron.push(cyl(0.016, 0.016, 2.62, 8).rotateZ(sx * 1.335).translate(sx * 1.27, 0.62, 0))
    dyn(merge(parts), M.oakX, beam)
    dyn(merge(iron), M.ironX, beam)
  }
  // the connecting rod, with the planet gear keyed to its foot
  const rod = new THREE.Group()
  scene.add(rod)
  {
    const iron: THREE.BufferGeometry[] = []
    iron.push(lathe([[0.05, 0.28], [0.062, 0.5], [0.085, LROD * 0.5], [0.062, LROD - 0.5], [0.05, LROD - 0.22]], 16).translate(0, 0, 0.13))
    iron.push(box(0.2, 0.44, 0.1).translate(0, LROD - 0.06, 0.13), box(0.22, 0.46, 0.1).translate(0, 0.1, 0.13)) // the strap ends
    iron.push(box(0.06, 0.12, 0.14).translate(0.12, LROD - 0.06, 0.13), box(0.06, 0.12, 0.14).translate(0.13, 0.1, 0.13)) // gib and cotter
    dyn(merge(iron), M.iron, rod)
    dyn(gearGeometry(GR, NT, 0.13, 0.07), M.gear, rod)
    dyn(cyl(0.07, 0.07, 0.34, 16).rotateX(Math.PI / 2).translate(0, 0, 0.08), M.steel, rod)
  }
  const sun = dyn(gearGeometry(GR, NT, 0.13, 0.09), M.gear)
  sun.position.set(SUN.x, SUN.y, 0)
  const shaft = dyn(merge([cyl(0.09, 0.09, 2.2, 20).rotateX(Math.PI / 2).translate(0, 0, -0.85), cyl(0.34, 0.34, 0.16, 28).rotateX(Math.PI / 2).translate(0, 0, -0.5), box(0.05, 0.2, 0.3).translate(0, 0.08, FLY.z)]), M.steel)
  shaft.position.set(SUN.x, SUN.y, 0)
  const link = dyn(merge([box(0.1, RC, 0.035).translate(0, RC / 2, 0), cyl(0.11, 0.11, 0.035, 18).rotateX(Math.PI / 2), cyl(0.11, 0.11, 0.035, 18).rotateX(Math.PI / 2).translate(0, RC, 0)]), M.steel)
  link.position.set(SUN.x, SUN.y, 0.235)
  // the flywheel: a cast rim in segments on six arms. Its arms are drawn on a disc so they can smear with speed.
  const fly = new THREE.Group()
  fly.position.set(SUN.x, SUN.y, FLY.z)
  scene.add(fly)
  {
    const rim = lathe([[FLY.r - 0.16, -0.13], [FLY.r, -0.13], [FLY.r + 0.012, -0.1], [FLY.r + 0.012, 0.1], [FLY.r, 0.13], [FLY.r - 0.16, 0.13], [FLY.r - 0.19, 0.06], [FLY.r - 0.19, -0.06], [FLY.r - 0.16, -0.13]], 96).rotateX(Math.PI / 2)
    const hub = lathe([[0.09, -0.2], [0.3, -0.2], [0.34, -0.12], [0.34, 0.12], [0.3, 0.2], [0.09, 0.2]], 32).rotateX(Math.PI / 2)
    dyn(merge([rim, hub]), M.ironZ, fly)
  }
  const armMat = new THREE.NodeMaterial()
  armMat.fragmentNode = Fn(() => {
    const q = positionLocal.toVar()
    const r = length(q.xy).toVar()
    const a = q.y.atan(q.x)
    // six arms, each a tapering oval bar; over a shutter of 1/50 s an arm sweeps `w` radians and smears to that width
    const w = max(U.rate.mul(0.02), 0.0005).toVar()
    const hw = mixN(float(0.085), float(0.06), r.div(FLY.r)).div(max(r, 0.2)).toVar()
    const d = abs(fract(a.div(1.0471976)).sub(0.5)).mul(1.0471976).toVar()
    const cov = clampN(hw.add(w.mul(0.5)).sub(d).div(w.add(0.004)), 0, min(float(1), hw.mul(2).div(w))).mul(step(0.3, r)).mul(step(r, FLY.r - 0.17)).toVar()
    // a round bar's shading across its width, lost as it smears
    const x = clampN(d.div(hw), 0, 1)
    const sharp = sstep(0.5, 0.05, w.div(hw))
    const P = positionWorld
    const Nf = normalize(normalWorld).toVar()
    const N = normalize(Nf.add(vec3(a.sin().negate(), a.cos(), 0).mul(x.mul(1.2).mul(sharp)))).toVar()
    const grime = fbm(vec2(r.mul(3), a.mul(2))).mul(sharp).add(sharp.oneMinus().mul(0.5))
    const c = houseLit(vec3(0.05, 0.05, 0.055).mul(grime.mul(1.1).add(0.4)) as V3, N as V3, P as V3, 0.4, 26, 0.55)
    return vec4(c, cov)
  })()
  Object.assign(armMat, OVER, { side: THREE.DoubleSide })
  for (const z of [-0.07, 0.07]) {
    const d = dyn(new THREE.CircleGeometry(FLY.r - 0.16, 72), armMat, fly)
    d.position.z = z
    d.renderOrder = 2
  }
  // the parallel motion on the cylinder end: main links, back links, the parallel bars, the radius rods
  const mkLinks = (r: number, flat: number, m: THREE.Material, zs: number[]) => zs.map((z) => ({ o: dyn(flat ? UNITB : UNIT, m), z }))
  const mainL = mkLinks(0.05, 0.03, M.steel, [-0.25, 0.25])
  const backL = mkLinks(0.045, 0.028, M.steel, [-0.25, 0.25])
  const parB = mkLinks(0.04, 0.028, M.steel, [-0.29, 0.29])
  const radR = mkLinks(0.022, 0, M.steel, [-0.33, 0.33])
  const pins = [0, 1, 2].map(() => dyn(cyl(0.035, 0.035, 0.74, 12).rotateX(Math.PI / 2), M.steel))
  // the piston rod (bright where it runs through the gland), its crosshead, and the air pump's rod
  const pRod = dyn(merge([cyl(0.045, 0.045, 2.3, 20).translate(0, -1.15, 0), box(0.16, 0.2, 0.42).translate(0, 0.02, 0)]), M.steel)
  const pumpRod = dyn(merge([cyl(0.03, 0.03, 4.4, 12).translate(0, -2.2, 0), box(0.1, 0.16, 0.1)]), M.steel)
  // the governor: spindle, two arms and balls, the links down to a sliding sleeve
  const gov = new THREE.Group()
  gov.position.set(GOV.x, GOV.y, GOV.z)
  scene.add(gov)
  dyn(merge([cyl(0.022, 0.022, 2.0, 12).translate(0, -0.3, 0), lathe([[0.05, 0], [0.05, 0.05], [0.03, 0.08], [0.001, 0.12]], 14).translate(0, 0.0, 0), cyl(0.2, 0.2, 0.07, 24).translate(0, 0.58, 0)]), M.steel, gov)
  const BALL = lathe(Array.from({ length: 13 }, (_, i) => [Math.max(0.001, 0.105 * Math.sin((i / 12) * Math.PI)), -0.105 * Math.cos((i / 12) * Math.PI)]), 20)
  const govArms = [0, 1].map((i) => {
    const g = new THREE.Group()
    g.rotation.y = i * Math.PI
    gov.add(g)
    const arm = new THREE.Group()
    g.add(arm)
    dyn(merge([cyl(0.014, 0.014, GOV.arm, 8).translate(0, -GOV.arm / 2, 0)]), M.steel, arm)
    dyn(BALL.clone().translate(0, -GOV.arm - 0.07, 0), M.iron, arm)
    const lk = dyn(UNIT, M.steel, g)
    return { arm, lk }
  })
  const sleeve = dyn(lathe([[0.03, -0.05], [0.06, -0.05], [0.06, -0.03], [0.04, -0.02], [0.04, 0.02], [0.06, 0.03], [0.06, 0.05], [0.03, 0.05]], 16), M.brass, gov)
  // lay shaft, pulleys and belt from the flywheel shaft; a pair of bevels up to the spindle
  const LAY = { y: GOV.y + 0.62 }
  const layShaft = dyn(merge([cyl(0.03, 0.03, 0.7, 12).rotateX(Math.PI / 2).translate(0, 0, -0.1), cyl(0.26, 0.26, 0.12, 28).rotateX(Math.PI / 2).translate(0, 0, -0.28), cyl(0.12, 0.09, 0.06, 20).rotateX(Math.PI / 2).translate(0, 0, 0.14)]), M.ironZ)
  layShaft.position.set(GOV.x, LAY.y, GOV.z)
  {
    // the belt: two straight runs between a 0.34 m and a 0.26 m pulley
    const z = GOV.z - 0.28
    const dx = SUN.x - GOV.x, dy = SUN.y - LAY.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx)
    for (const sgn of [-1, 1]) {
      const off = Math.asin((0.34 - 0.26) / L) * sgn
      const nx = -Math.sin(a + off) * sgn, ny = Math.cos(a + off) * sgn
      const g = box(L, 0.012, 0.1)
      put(g, M.belt, (SUN.x + GOV.x) / 2 + nx * 0.3, (SUN.y + LAY.y) / 2 + ny * 0.3, z, 0, 0, a + off)
    }
    for (const b of batches) {
      const mesh = new THREE.Mesh(merge(b[1]), b[0])
      mesh.frustumCulled = false
      scene.add(mesh)
    }
    batches.clear()
  }
  // the throttle linkage: a lever under the sleeve, a long rod back along the frame to the butterfly's arm
  const govLever = dyn(UNITB, M.steel)
  const govRodV = dyn(UNIT, M.steel)
  const govRodH = dyn(UNIT, M.steel)
  const throttle = new THREE.Group()
  throttle.position.set(TH.x, SP.y, SP.z)
  scene.add(throttle)
  dyn(merge([cyl(0.014, 0.014, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.2), box(0.03, 0.34, 0.03).translate(0, 0.15, 0.42), cyl(0.03, 0.03, 0.04, 10).rotateX(Math.PI / 2).translate(0, 0.3, 0.42)]), M.brass, throttle)

  // the engineman's oil lamp: a brass font and a glass chimney on a hook and chain off the spring beam
  {
    const L = { x: 2.85, y: 3.55, z: 0.95 }
    put(lathe([[0.001, -0.07], [0.05, -0.065], [0.065, -0.04], [0.06, -0.01], [0.03, 0], [0.018, 0.012]], 20), M.brass, L.x, L.y, L.z)
    for (let i = 0; i < 9; i++) put(new THREE.TorusGeometry(0.012, 0.0035, 5, 10), M.iron, L.x, L.y + 0.2 + i * 0.022, L.z, 0, (i % 2) * Math.PI / 2, 0)
    put(box(0.012, 0.012, 0.2), M.iron, L.x, 4.6, L.z - 0.1)
    for (const b of batches) {
      const mesh = new THREE.Mesh(merge(b[1]), b[0])
      mesh.frustumCulled = false
      scene.add(mesh)
    }
    batches.clear()
    const flameMat = new THREE.NodeMaterial()
    flameMat.fragmentNode = Fn(() => {
      const q = positionLocal
      const f = sin(U.time.mul(13)).mul(0.08).add(1)
      const core = sstep(0.9, 0.1, length(vec2(q.x.mul(2.2), q.y.sub(0.012).mul(1.1))).div(0.022).mul(f))
      return done(vec3(6, 3.0, 0.9).mul(core.add(0.25)) as V3, positionWorld as V3)
    })()
    dyn(new THREE.SphereGeometry(0.02, 12, 10).scale(0.55, 1.4, 0.55), flameMat).position.set(L.x, L.y + 0.035, L.z)
    const chimney = dyn(lathe([[0.03, 0], [0.034, 0.03], [0.03, 0.07], [0.022, 0.13], [0.022, 0.16]], 20), new THREE.NodeMaterial())
    const cm = chimney.material as THREE.NodeMaterial
    cm.fragmentNode = Fn(() => {
      const P = positionWorld
      const N = normalize(normalWorld)
      const V = normalize(U.camP.sub(P))
      const fres = pow(float(1).sub(abs(dot(N, V))), 3).mul(0.8).add(0.05)
      return vec4(vec3(1.0, 0.6, 0.25).mul(fres).mul(0.6), depthOf(P as V3))
    })()
    Object.assign(cm, ADD, { side: THREE.DoubleSide })
    chimney.position.set(L.x, L.y + 0.005, L.z)
    chimney.renderOrder = 4
  }

  // ---------------------------------------------------------------- steam: leaks at the gland and the valve chest, breath off the hot well, the safety valve

  const NS = 260
  const SRC = [[XC, CY.y0 + 2.46, 0.02], [VC.x, 3.28, VC.z + 0.1], [VC.x - 0.1, 1.3, VC.z + 0.22], [PUMP.x, 1.0, PUMP.z + 0.1], [BO.x + 0.6, 4.5, BO.z + 0.3]]
  const steamGeo = new THREE.InstancedBufferGeometry()
  steamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  steamGeo.setIndex([0, 1, 2, 0, 2, 3])
  {
    const R = rng(1712)
    const a = new Float32Array(NS * 4), b = new Float32Array(NS * 4)
    for (let i = 0; i < NS; i++) {
      const src = i % 5
      a.set([SRC[src][0], SRC[src][1], SRC[src][2], src + (Math.floor(i / 5) % 6) * 0.1], i * 4)
      b.set([R(), R(), R(), R()], i * 4)
    }
    steamGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
    steamGeo.setAttribute("aR", new THREE.InstancedBufferAttribute(b, 4))
    steamGeo.instanceCount = NS
  }
  const steamMat = new THREE.NodeMaterial()
  {
    const aS = attribute("aS", "vec4") as unknown as V4
    const aR = attribute("aR", "vec4") as unknown as V4
    const src = floor(aS.w)
    const slot = fract(aS.w).mul(10).add(0.5).floor()
    const life = aR.w.mul(1.2).add(1.5)
    // a leak puffs when the crank passes a dead centre and the valves change over; the well and the safety valve breathe all the time
    const tk = U.strokeT.element(int(slot)) as unknown as F
    const pulsed = step(src, 2.5)
    const agePulse = U.t0.sub(tk).sub(aR.x.mul(0.3))
    const ageIdle = fract(U.time.div(life).add(aR.x)).mul(life)
    const age = mixN(ageIdle, agePulse, pulsed).toVar()
    const live = step(0, age).mul(step(age, life))
    const side = vec3(aR.y.sub(0.5), 0.2, aR.z.sub(0.5)).mul(mixN(float(0.5), float(1.6), step(1.5, src).mul(step(src, 2.5))))
    const run = float(1).sub(exp(age.mul(-2.2)))
    const centre = aS.xyz.add(side.mul(run).mul(0.5)).add(vec3(sin(age.mul(1.3).add(aR.x.mul(6))).mul(0.06), age.mul(0.42).add(run.mul(0.25)), age.mul(0.1)))
    // the gland and the chest only weep: small wisps; the hot well and the safety valve breathe larger
    const size = age.mul(0.24).add(0.05).mul(aR.z.mul(0.6).add(0.7)).mul(live).mul(mixN(float(0.5), float(1), step(2.5, src)))
    const world = centre.add(U.camR.mul(positionGeometry.x.mul(size))).add(U.camU.mul(positionGeometry.y.mul(size)))
    steamMat.vertexNode = vp.mul(vec4(world, 1))
    steamMat.fragmentNode = Fn(() => {
      const st = positionGeometry.xy.toVarying()
      const P = world.toVarying()
      const k = age.div(life).toVarying()
      const seed = aR.x.toVarying()
      const r = length(st)
      const n = fbm(st.mul(1.6).add(seed.mul(31)).add(vec2(0, k.mul(-1.5))))
      const a = sstep(1, 0.15, r.add(n.sub(0.5).mul(0.9))).mul(sstep(0, 0.12, k)).mul(sstep(1, 0.35, k)).mul(0.22)
      // steam has no colour of its own: it is the light it is standing in
      const c = SUNC.mul(winHit(P as V3, LS).mul(U.sunI)).mul(0.5).add(U.l2C.div(dot(U.l2P.sub(P), U.l2P.sub(P)).add(1.5)).mul(0.5)).add(U.amb.mul(3)).add(U.skyC.mul(0.012))
      return vec4(c, a)
    })()
    Object.assign(steamMat, OVER)
  }
  const steam = dyn(steamGeo, steamMat)
  steam.frustumCulled = false
  steam.renderOrder = 4

  // ---------------------------------------------------------------- beat 1: the bench, the lamp, the window

  const lampG = new THREE.Group()
  scene.add(lampG)
  {
    const bx = BENCH.x, by = BENCH.y, bz = BENCH.z
    // the room: a plastered wall with the window's opening, a deep oak sill, the bench against it
    const ws = new THREE.Shape()
    ws.moveTo(-5, -1)
    ws.lineTo(5, -1)
    ws.lineTo(5, 5)
    ws.lineTo(-5, 5)
    ws.closePath()
    const WB = WINS[2]
    const hole = new THREE.Path()
    hole.moveTo(WB[0] - bx - WB[3], WB[1])
    hole.lineTo(WB[0] - bx + WB[3], WB[1])
    hole.lineTo(WB[0] - bx + WB[3], WB[2])
    hole.absarc(WB[0] - bx, WB[2], WB[3], 0, Math.PI, false)
    hole.lineTo(WB[0] - bx - WB[3], WB[1])
    ws.holes.push(hole)
    put(new THREE.ExtrudeGeometry(ws, { depth: 0.3, bevelEnabled: false, curveSegments: 24 }), M.plaster, bx, 0, ZW - 0.3)
    put(box(1.5, 0.05, 0.42), M.oakX, WB[0], WB[1] - 0.025, ZW + 0.06)
    // the sash: stiles, rails and glazing bars where the light function has them
    for (const dx of [-0.26, 0.26]) put(box(0.012, WB[2] + WB[3] - WB[1], 0.03), M.oakY, WB[0] + dx, (WB[1] + WB[2] + WB[3]) / 2, ZW - 0.12)
    for (const dy of [0.62, 1.24]) put(box(WB[3] * 2, 0.012, 0.03), M.oakX, WB[0], WB[1] + dy, ZW - 0.12)
    put(box(WB[3] * 2, 0.05, 0.05), M.oakX, WB[0], WB[1] + 0.025, ZW - 0.12)
    // the bench: thick planks, a tool well, a vice's edge
    for (let i = 0; i < 4; i++) put(box(3.2, 0.07, 0.235), M.oakX, bx + 0.2, by - 0.035, ZW + 0.13 + i * 0.24 + 0.12)
    put(box(3.2, 0.2, 0.06), M.oakX, bx + 0.2, by - 0.14, ZW + 1.12)
    // the lamp's stand: a turned base, two brass binding posts with knurled nuts
    put(lathe([[0.075, 0], [0.078, 0.012], [0.07, 0.022], [0.05, 0.03], [0.034, 0.04], [0.03, 0.062], [0.036, 0.07], [0.036, 0.078], [0.022, 0.082], [0.001, 0.082]], 40), M.oakY, bx, by, bz)
    for (const sx of [-1, 1]) {
      put(lathe([[0.006, 0], [0.006, 0.012], [0.01, 0.013], [0.01, 0.021], [0.004, 0.022], [0.004, 0.034], [0.008, 0.035], [0.008, 0.041], [0.001, 0.042]], 14), M.brass, bx + sx * 0.055, by + 0.02, bz + 0.02)
    }
    // the stem inside: a glass tube pinched at the top, two platinum wires through the pinch, a clamp at each tip
    for (const sx of [-1, 1]) {
      pipe([bx + sx * 0.005, by + 0.08, bz], [bx + sx * 0.006, by + 0.165, bz], 0.0006, M.platinum, 6)
      pipe([bx + sx * 0.006, by + 0.165, bz], [bx + sx * 0.021, by + 0.2, bz], 0.0006, M.platinum, 6)
      pipe([bx + sx * 0.021, by + 0.2, bz], [bx + sx * 0.021, by + 0.214, bz], 0.0006, M.platinum, 6)
      put(box(0.0026, 0.004, 0.0022), M.platinum, bx + sx * 0.021, by + 0.215, bz)
    }
    // copper wires from the posts away to the cells, and the cells: glass jars with their plates, in a row in the dark
    const copper = surf("brass", [0.55, 0.26, 0.12], "x")
    const wire = (pts: number[][], r = 0.0012) => put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 40, r, 6), copper)
    wire([[bx - 0.055, by + 0.05, bz + 0.02], [bx - 0.11, by + 0.035, bz + 0.05], [bx - 0.2, by + 0.004, bz + 0.02], [bx - 0.34, by + 0.004, bz - 0.2], [bx - 0.5, by + 0.05, bz - 0.5], [bx - 0.55, by + 0.2, bz - 0.62]])
    wire([[bx + 0.055, by + 0.05, bz + 0.02], [bx + 0.1, by + 0.03, bz + 0.07], [bx + 0.16, by + 0.004, bz + 0.12], [bx - 0.05, by + 0.004, bz + 0.2], [bx - 0.4, by + 0.004, bz + 0.1], [bx - 0.75, by + 0.05, bz - 0.4], [bx - 0.8, by + 0.2, bz - 0.62]])
    for (let i = 0; i < 6; i++) {
      const x = bx - 0.55 - i * 0.125, z = bz - 0.66 + (i % 2) * 0.012
      put(lathe([[0.001, 0], [0.05, 0], [0.052, 0.01], [0.052, 0.11], [0.001, 0.11]], 20), M.water, x, by + 0.002, z) // the acid
      put(box(0.05, 0.16, 0.004), M.ironX, x - 0.012, by + 0.1, z)
      put(box(0.05, 0.16, 0.004), copper, x + 0.012, by + 0.1, z)
      if (i < 5) wire([[x - 0.012, by + 0.18, z], [x - 0.06, by + 0.2, z], [x - 0.113, by + 0.18, z]], 0.001)
    }
    for (const b of batches) {
      const mesh = new THREE.Mesh(merge(b[1]), b[0])
      mesh.frustumCulled = false
      lampG.add(mesh)
    }
    batches.clear()
  }
  /** The thread's colour for a temperature 0..1: black, dull red, orange, yellow-white (emitted light). */
  const glow = (t: F): V3 => {
    const k = sat1(t)
    return mixN(mixN(vec3(0.35, 0.012, 0.0), vec3(1.0, 0.22, 0.02).mul(5), sstep(0.05, 0.5, k)), vec3(1.0, 0.74, 0.4).mul(60), sstep(0.45, 1.0, k)).mul(sstep(0.0, 0.1, k)) as V3
  }
  // the thread: carbonised cotton, nearly straight between the clamps, bowing a little as it heats
  const thread = dyn(cyl(0.00034, 0.00034, 0.042, 6).rotateZ(Math.PI / 2), new THREE.NodeMaterial(), lampG)
  {
    const m = thread.material as THREE.NodeMaterial
    const bow = sin(positionGeometry.x.div(0.042).add(0.5).mul(Math.PI)).toVar()
    const w = modelPos(vec3(positionGeometry.x, positionGeometry.y.add(bow.mul(U.volts.mul(0.0012).add(0.0006))), positionGeometry.z))
    m.vertexNode = vp.mul(vec4(w, 1))
    m.fragmentNode = Fn(() => {
      const u = positionGeometry.x.div(0.042).add(0.5).toVarying()
      // cooler where the platinum carries the heat away, and never quite even along its length
      const T = U.volts.mul(sin(u.mul(Math.PI)).pow(0.35)).mul(vnoise(vec2(u.mul(46), 1.5)).mul(0.14).add(0.9))
      return vec4(glow(T as F).add(vec3(0.004)), depthOf(w.toVarying() as V3))
    })()
  }
  thread.position.set(FIL.x, FIL.y, FIL.z)
  thread.frustumCulled = false
  function modelPos(p: V3): V3 {
    return p.add(vec3(FIL.x, FIL.y, FIL.z)) as V3
  }
  // the globe: free-blown, a long neck into the stand, the tip where it was sealed off the pump. Inside face, then outside.
  const globeGeo = lathe(
    [[0.017, 0.08], [0.0165, 0.12], [0.02, 0.145], [0.034, 0.165], [0.047, 0.185], [0.0535, 0.21], [0.054, 0.225], [0.05, 0.245], [0.041, 0.262], [0.027, 0.275], [0.012, 0.282], [0.006, 0.286], [0.0035, 0.295], [0.0012, 0.303], [0.0001, 0.305]],
    64,
  )
  const glassMat = (inside: boolean) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const P = positionWorld
      const q = positionLocal
      const N0 = normalize(normalWorld)
      const V = normalize(U.camP.sub(P)).toVar()
      // blown glass is never true: its wall wanders, and that is what makes its reflections swim
      const wob = vec3(vnoise(vec2(q.y.mul(60), q.x.atan(q.z).mul(3))).sub(0.5), vnoise(vec2(q.y.mul(47).add(3), q.x.atan(q.z).mul(4))).sub(0.5), 0).mul(0.22)
      const N = normalize((inside ? N0.negate() : N0).add(wob)).toVar()
      const ndv = max(dot(N, V), 0)
      const fres = pow(ndv.oneMinus(), 3).mul(0.9).add(0.04).toVar()
      const R = reflect(V.negate(), N).toVar()
      // what it mirrors: the window with its bars, the lit bench below, and the thread itself as a stretched ghost
      const win = U.skyC.mul(winHit(P as V3, normalize(vec3(R.x, R.y, min(R.z, -0.05))) as V3)).mul(step(R.z, -0.03))
      const lit = glow(U.volts as unknown as F)
      const toF = vec3(FIL.x, FIL.y, FIL.z).sub(P).toVar()
      const Lf = normalize(toF)
      const ghost = pow(max(dot(R, Lf), 0), inside ? 400 : 900).mul(inside ? 0.012 : 0.01)
      const bench = lit.mul(0.0012).mul(sstep(0.1, -0.7, R.y)).mul(vnoise(vec2(R.x.mul(9), R.z.mul(9))).mul(0.6).add(0.5))
      // seed and cord in the glass, a bloom of carbon above the thread as the hours go by
      const seed = step(0.985, hash21(floor(vec2(q.y.mul(900), q.x.atan(q.z).mul(140))))).mul(0.02)
      const c = win.mul(fres).mul(inside ? 0.5 : 1).add(lit.mul(ghost)).add(bench.mul(fres.mul(4).add(0.6))).add(lit.mul(seed).mul(0.04)).add(U.skyC.mul(seed).mul(0.2))
      return vec4(c, depthOf(P as V3))
    })()
    Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor, side: inside ? THREE.BackSide : THREE.FrontSide })
    return m
  }
  const glassIn = glassMat(true), glassOut = glassMat(false)
  const stemGeo = lathe([[0.0085, 0.08], [0.0085, 0.15], [0.0095, 0.158], [0.0075, 0.166], [0.002, 0.168]], 20)
  ;[[stemGeo, glassOut, 5], [globeGeo, glassIn, 6], [globeGeo, glassOut, 7]].forEach(([g, m, ro]) => {
    const o = dyn(g as THREE.BufferGeometry, m as THREE.Material, lampG)
    o.position.set(BENCH.x, BENCH.y, BENCH.z)
    o.renderOrder = ro as number
  })
  // the pane itself: old glass, with the lamp standing in it as a second, dimmer lamp
  const paneMat = new THREE.NodeMaterial()
  paneMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const mir = vec3(FIL.x, FIL.y, 2 * (ZW - 0.12) - FIL.z)
    const V = normalize(P.sub(U.camP))
    const d = length(V.cross(mir.sub(U.camP)))
    const g = glow(U.volts as unknown as F).mul(exp(d.mul(d).mul(-900)).mul(0.012).add(exp(d.mul(-9)).mul(0.0004)))
    const streak = vnoise(vec2(P.x.mul(160), P.y.mul(3))).mul(0.5).add(0.5)
    return vec4(g.mul(streak.mul(0.6).add(0.5)), 0)
  })()
  Object.assign(paneMat, ADD)
  const pane = dyn(new THREE.PlaneGeometry(1.3, 2.0), paneMat, lampG)
  pane.position.set(WINS[2][0], 2.0, ZW - 0.12)
  pane.renderOrder = 3

  // ---------------------------------------------------------------- the city: blocks of brick, gas in some windows, then the new light

  const cityG = new THREE.Group()
  scene.add(cityG)
  const HAZE = vec3(0.016, 0.02, 0.032)
  const fog = (c: V3, P: V3): V3 => mixN(c, HAZE.mul(sstep(-60, 60, P.y.sub(CITY_Y)).mul(0.9).add(0.35)), float(1).sub(exp(length(P.sub(U.camP)).mul(-0.0034)))) as V3
  let cityCues: number[] = []
  {
    const R = rng(1882)
    const bld: number[] = [], bh: number[] = []
    type Win = { x: number; y: number; z: number; kind: number; rank: number; r: number }
    const wins: Win[] = []
    const lamps: number[][] = []
    const OX = BENCH.x - 40, OZ = ZW - 150 // where the first station is
    for (let j = 0; j < 13; j++)
      for (let i = -9; i <= 9; i++) {
        const cx = BENCH.x + 14 + i * 68, cz = ZW - 42 - j * 50
        const blockRank = Math.abs(cx - OX) + Math.abs(cz - OZ) * 1.15
        for (let row = 0; row < 2; row++)
          for (let k = 0; k < 4; k++) {
            if (R() < 0.06) continue // a yard
            const w = 13.2, d = 17.5
            const x = cx - 27 + k * 13.6 + w / 2, z = cz + 9 - row * 18 - d / 2 + 9
            const hgt = 9 + Math.floor(R() * 4) * 3.3 + (j > 4 ? Math.floor(R() * R() * 5) * 3.3 : 0)
            bld.push(x, z, w, d)
            bh.push(hgt, R())
            const floors = Math.floor(hgt / 3.3), cols = 5
            for (let f = 0; f < floors; f++)
              for (let c = 0; c < cols; c++) {
                const u = R()
                const kind = u < 0.32 ? 0 : u < 0.6 ? 1 : u < 0.7 ? 2 : -1
                if (kind < 0) continue
                wins.push({ x: x - w / 2 + (c + 0.5) * (w / cols), y: CITY_Y + f * 3.3 + 1.9, z: z + d / 2, kind, rank: blockRank + R() * 55 + row * 12, r: R() })
              }
          }
        // gas lamps on the kerb: four to a block front, and down the side street
        for (let k = 0; k < 4; k++) lamps.push([cx - 24 + k * 16, CITY_Y + 3.6, cz + 22])
        for (let k = 0; k < 2; k++) lamps.push([cx + 31, CITY_Y + 3.6, cz + 8 - k * 22])
      }
    // buildings
    const bg = new THREE.InstancedBufferGeometry()
    const ub = box(1, 1, 1).translate(0, 0.5, 0)
    bg.index = ub.index
    bg.setAttribute("position", ub.getAttribute("position"))
    bg.setAttribute("normal", ub.getAttribute("normal"))
    bg.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(bld), 4))
    bg.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(bh), 2))
    bg.instanceCount = bh.length / 2
    const bm = new THREE.NodeMaterial()
    const aB = attribute("aB", "vec4") as unknown as V4
    const aH = attribute("aH", "vec2") as unknown as V2
    const bw = vec3(aB.x.add(positionGeometry.x.mul(aB.z)), positionGeometry.y.mul(aH.x).add(CITY_Y), aB.y.add(positionGeometry.z.mul(aB.w)))
    bm.vertexNode = vp.mul(vec4(bw, 1))
    bm.fragmentNode = Fn(() => {
      const P = bw.toVarying()
      const q = positionGeometry.toVarying()
      const dim = vec3(aB.z, aH.x, aB.w).toVarying()
      const rnd = aH.y.toVarying()
      const N = attribute("normal", "vec3").toVarying()
      // a front of brick with stone sills and dark sashes; a slate roof wet enough to hold a little sky
      const fu = fract(q.x.add(0.5).mul(5)), fv = fract(q.y.mul(dim.y).div(3.3))
      const sash = step(0.3, fu).mul(step(fu, 0.7)).mul(step(0.3, fv)).mul(step(fv, 0.8)).mul(step(0.5, N.z))
      const brickC = mixN(vec3(0.02, 0.012, 0.01), vec3(0.03, 0.026, 0.024), rnd).mul(float(1).sub(sash.mul(0.75)))
      const roof = vec3(0.012, 0.014, 0.02).add(HAZE.mul(0.5))
      const c = mixN(brickC.mul(N.z.mul(0.5).add(0.75)), roof, step(0.5, N.y))
      // the street's own light climbs the fronts a little way
      const street = vec3(1.0, 0.55, 0.18).mul(0.012).mul(exp(P.y.sub(CITY_Y).mul(-0.16))).mul(step(0.5, N.z.abs().add(N.x.abs())))
      return done(fog(c.add(street) as V3, P as V3), P as V3)
    })()
    const bmesh = dyn(bg, bm, cityG)
    bmesh.frustumCulled = false
    // the ground: cobbles, darker than the roofs, with the lamps' pools
    // the streets: wet setts holding the night sky, and a pool of gaslight under every lamp on the kerbs
    const streetMat = new THREE.NodeMaterial()
    streetMat.fragmentNode = Fn(() => {
      const P = positionWorld
      const md = (x: F, per: number) => fract(x.div(per)).sub(0.5).mul(per)
      const fdx = md(P.x.sub(BENCH.x + 14 - 24), 16), fdz = md(P.z.sub(ZW - 42 + 22), 50)
      const sdx = md(P.x.sub(BENCH.x + 14 + 31), 68), sdz = md(P.z.sub(ZW - 42 + 8), 22)
      const pool = exp(dot(vec2(fdx, fdz), vec2(fdx, fdz)).mul(-1 / 22)).add(exp(dot(vec2(sdx, sdz), vec2(sdx, sdz)).mul(-1 / 22)))
      const sett = vnoise(P.xz.mul(4)).mul(0.4).add(0.7)
      const c = vec3(0.012, 0.015, 0.024).mul(sett).add(vec3(1.0, 0.45, 0.1).mul(pool).mul(0.09))
      return done(fog(c as V3, P as V3), P as V3)
    })()
    const street = dyn(box(1600, 1, 900), streetMat, cityG)
    street.position.set(BENCH.x, CITY_Y - 0.5, ZW - 440)
    // windows and street lamps: one draw. When each goes electric is its rank on an exponential count.
    wins.sort((a, b) => a.rank - b.rank)
    const elec = wins.filter((w) => w.kind !== 1)
    const tOf = (u: number) => T_CITY0 + ((T_CITY1 - T_CITY0) * Math.log(1 + u * (Math.exp(CITY_K) - 1))) / CITY_K
    const n = wins.length + lamps.length
    const aW = new Float32Array(n * 4), aK = new Float32Array(n * 4)
    let ei = 0
    wins.forEach((w, i) => {
      const t = w.kind === 1 ? 99 : tOf(ei++ / elec.length)
      aW.set([w.x, w.y, w.z, t], i * 4)
      aK.set([w.kind, w.r, 1, 0], i * 4)
    })
    lamps.forEach((l, i) => {
      aW.set([l[0], l[1], l[2], 99], (wins.length + i) * 4)
      aK.set([3, R(), 0.55, 0], (wins.length + i) * 4)
    })
    // a tick for a window while they can still be told apart: every nth, the nth doubling
    for (let k = 0, i = 0; i < elec.length && cityCues.length < 46; k++, i = Math.floor(1.32 ** k)) cityCues.push(tOf(i / elec.length))
    cityCues = cityCues.filter((t, i, a) => i === 0 || t - a[i - 1] > 0.05)
    const wg = new THREE.InstancedBufferGeometry()
    wg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    wg.setIndex([0, 1, 2, 0, 2, 3])
    wg.setAttribute("aW", new THREE.InstancedBufferAttribute(aW, 4))
    wg.setAttribute("aK", new THREE.InstancedBufferAttribute(aK, 4))
    wg.instanceCount = n
    const wm = new THREE.NodeMaterial()
    const iW = attribute("aW", "vec4") as unknown as V4
    const iK = attribute("aK", "vec4") as unknown as V4
    const dist = length(iW.xyz.sub(U.camP)).toVar()
    // never smaller than a pixel and a half: past that a window keeps its light and loses its shape
    const grow = max(float(1), dist.mul(0.00062 * 1.5).div(iK.z.mul(0.5))).toVar()
    const wpos = iW.xyz.add(vec3(positionGeometry.x.mul(0.5).mul(iK.z).mul(grow), positionGeometry.y.mul(0.8).mul(iK.z).mul(grow), 0.05))
    wm.vertexNode = vp.mul(vec4(wpos, 1))
    wm.fragmentNode = Fn(() => {
      const kind = iK.x.toVarying()
      const rnd = iK.y.toVarying()
      const since = U.cityT.sub(iW.w).toVarying()
      const g2 = grow.toVarying()
      const dd = dist.toVarying()
      const st = positionGeometry.xy.toVarying()
      const on = step(0, since)
      // gas: a fishtail flame behind a blind, never still. The new light: steady, whiter, three times as strong, and it arrives all at once
      const flick = sin(U.time.mul(rnd.mul(9).add(7)).add(rnd.mul(40))).mul(0.16).add(sin(U.time.mul(23).add(rnd.mul(90))).mul(0.06)).add(0.85)
      const gasOn = step(0.5, kind)
      const gas = vec3(1.0, 0.42, 0.08).mul(mixN(float(0.55), float(1.6), step(2.5, kind))).mul(flick).mul(gasOn)
      const el = vec3(0.82, 0.9, 1.0).mul(exp(max(since, 0).mul(-5)).mul(3.5).add(2.6)) // (clamped: a gas window's -90 s would overflow to infinity, and inf * 0 is NaN on WebGL 2)
      const c = mixN(gas, el, on.mul(step(kind, 2.5)))
      // the sash's cross and a blind drawn part-way
      const pane2 = sstep(0.0, 0.14, abs(st.x)).mul(sstep(0.0, 0.1, abs(st.y.sub(0.1)))).mul(0.6).add(0.4)
      const blind = mixN(float(1), float(0.55), step(rnd.mul(1.6).sub(0.6), st.y))
      const shape = mixN(pane2.mul(blind), sstep(1.0, 0.2, length(st)), sat1(g2.sub(1).add(step(2.5, kind)) as F))
      return vec4(c.mul(shape).mul(exp(dd.mul(-0.0026))).div(g2.mul(g2)).mul(1.4), 0)
    })()
    Object.assign(wm, ADD)
    const wmesh = dyn(wg, wm, cityG)
    wmesh.frustumCulled = false
    wmesh.renderOrder = 1
    // the night behind it: smoke-brown at the roofs, blue above, a moonless glow
    const skyM = new THREE.NodeMaterial()
    skyM.fragmentNode = Fn(() => {
      const P = positionWorld
      const h = P.y.sub(CITY_Y).div(420)
      const smoke = fbm(vec2(P.x.mul(0.004), P.y.mul(0.012))).mul(sstep(0.5, 0.05, h))
      const c = mixN(vec3(0.03, 0.026, 0.03), vec3(0.008, 0.012, 0.028), sstep(0.0, 0.5, h)).add(vec3(0.03, 0.02, 0.012).mul(smoke))
      return vec4(c, 900)
    })()
    const sky = dyn(new THREE.PlaneGeometry(2600, 900), skyM, cityG)
    sky.position.set(BENCH.x, CITY_Y + 380, ZW - 780)
    for (const b of batches) {
      const mesh = new THREE.Mesh(merge(b[1]), b[0])
      mesh.frustumCulled = false
      cityG.add(mesh)
    }
    batches.clear()
  }

  // ---------------------------------------------------------------- the rule of ages: a bar of sooty cast iron, its cuts run in with brass

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "blackened", debug: ctx.debugLabels, fonts: { name: ctx.fonts.fell, mono: ctx.fonts.mono }, ink: "#f1c56a", accent: "#ff7a3c" }
  const ruleMat = new THREE.NodeMaterial()
  const RU = { glint: uniform(0.5), warm: uniform(new THREE.Vector3(1, 0.8, 0.5)) }
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    // cast iron: pebbled, blacked and rubbed with oil; soot lies along its upper edge and rust has started in the pits
    const peb = vnoise(st.mul(vec2(900, 60))).mul(0.5).add(vnoise(st.mul(vec2(260, 17)).add(4)).mul(0.5)).toVar()
    const soot = sstep(0.35, 0.8, fbm(st.mul(vec2(22, 2.2)).add(1.7)).add(st.y.mul(0.25)))
    const iron = vec3(0.06, 0.06, 0.066).mul(peb.mul(0.7).add(0.55)).mul(soot.mul(0.6).oneMinus()).add(vec3(0.05, 0.02, 0.008).mul(sstep(0.7, 0.9, peb)))
    // brass let into the cuts and filed flush: it takes the light the iron does not
    const brass = cut.rgb.mul(vnoise(st.mul(vec2(1400, 90))).mul(0.25).add(0.85))
    const N = normalize(normalWorld)
    const sheen = pow(sat1(N.y.mul(0.6).add(0.5).add(sin(st.x.mul(5).add(RU.glint.mul(6))).mul(0.2)) as F), 3)
    const lit = iron.mul(RU.warm.mul(0.55).add(0.25)).add(RU.warm.mul(sheen).mul(0.03))
    const lb = brass.mul(RU.warm.mul(0.55).add(0.5)).add(RU.warm.mul(sheen).mul(0.25))
    const col = mixN(lit, lb, on)
    return vec4(ctx.debugLabels ? mixN(col, cut.rgb, step(0.02, on)) : col, -1)
  })()
  ruleMat.depthTest = false
  // drawn after the blended layers (flywheel arms, steam, glass), which would otherwise cover it; it
  // overwrites colour and the depth the lens reads from alpha (negative: never blurred, never hazed)
  Object.assign(ruleMat, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor })
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 20
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- targets; the lens: focus, and the haze the shafts stand in

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(4), asp: uniform(16 / 9), tanH: uniform(Math.tan((FOV * Math.PI) / 360)), haze: uniform(1), shade: uniform(1) }
  const lens = ctx.pass(({ uv, res, time }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    // circle of confusion from view depth (carried in alpha; the rule is negative and never blurs)
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.02)).mul(D.focus.min(6).div(D.focus).mul(0.55).add(0.45)) as F).mul(step(0, d)) as F
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(D.blur.greaterThan(0.0005), () => {
      // a turned spiral per pixel: points of light open into discs, not into rings of dots
      const spin = hash21(floor(uv.mul(res))).mul(6.283).toVar()
      Loop(30, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(30))
        const a = fi.mul(2.39996).add(spin)
        const o = vec2(cos(a), sin(a)).mul(rr).div(vec2(D.asp, 1))
        // gather: a tap contributes if its own disc reaches this pixel
        const t = sampleRT(D.tT, uv.add(o.mul(max(r0, D.blur.mul(0.5)))) as V2).toVar()
        const rt = coc(t.a as F).mul(D.blur)
        const reach = max(r0, D.blur.mul(0.5)).mul(rr)
        const w = sstep(reach.mul(0.8), reach.mul(1.05).add(0.0004), rt.add(step(t.a, c0.a).mul(r0)) as F).mul(step(0, t.a)).mul(step(0, c0.a))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    const col = acc.rgb.div(acc.a).toVar()
    // the air of the house: coal dust and steam hanging in it, seen only where the sun crosses it
    If(D.haze.greaterThan(0.001).and(c0.a.greaterThanEqual(0)), () => {
      const ndc = uv.mul(2).sub(1)
      const rd = normalize(U.camF.add(U.camR.mul(ndc.x.mul(D.tanH).mul(D.asp))).add(U.camU.mul(ndc.y.mul(D.tanH)))).toVar()
      const far = min(c0.a.div(dot(rd, U.camF)), 18).toVar()
      const jit = hash21(floor(uv.mul(res)).add(floor(time.mul(24)))).toVar()
      const sum = float(0).toVar()
      Loop(14, ({ i }) => {
        const p = U.camP.add(rd.mul(far.mul(float(i).add(jit).div(14)))).toVar()
        const dn = vnoise3(p.mul(0.8).add(vec3(time.mul(0.05), time.mul(-0.03), 0))).mul(0.9).add(0.35)
        const wh = winHit(p as V3, LS).toVar()
        If(wh.greaterThan(0.002), () => {
          wh.mulAssign(sunShadow(p as V3, LS, false))
        })
        sum.addAssign(wh.mul(dn))
      })
      const fwd = pow(max(dot(rd, LS), 0), 6).mul(1.3).add(0.16)
      col.addAssign(SUNC.mul(sum.div(14)).mul(far).mul(0.0042).mul(fwd).mul(D.haze))
      col.addAssign(vec3(0.006, 0.0055, 0.006).mul(float(1).sub(exp(far.mul(-0.12)))).mul(D.haze))
    })
    // a soft shade behind the headline
    col.mulAssign(float(1).sub(D.shade.mul(sstep(0.6, 0.0, length(uv.sub(vec2(0.18, 0.82)).mul(vec2(1.0, 2.0)))).mul(0.55))))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- the story clock

  const P0 = makePose()
  const camP = new THREE.Vector3(), camT = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3()
  const st = { focus: 6, blur: 0, bench: 0, rate: 0, dark: 0, exposure: 1, fov: FOV }
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.55, bloomThresh: 0.9, bloomRadius: 1, vignette: 0.3, grain: 0.03, contrast: 1.06, sat: 1, halation: 0.25, ca: 0.0012, lift: [0.006, 0.008, 0.013], gain: [1.0, 0.98, 0.95], fade: 0, fadeColor: [0, 0, 0] }
  const HUD = { color: "#e9dfca", shadow: "rgba(0,0,0,.7)" }
  const TITLES: TitleOpts = { color: "#f3ead8", shadow: "rgba(4,3,2,0.8)", delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.75] }

  const lerpPose = (px: number, py: number, pz: number, tx: number, ty: number, tz: number, k: number) => {
    camP.lerp(tmpP.set(px, py, pz), k)
    camT.lerp(tmpT.set(tx, ty, tz), k)
  }
  const update = (s: State) => {
    const t0 = s.at(0), t1 = s.at(1)
    const bench = t1 >= T_ARRIVE ? 1 : 0
    st.bench = bench
    U.time.value = s.time
    U.t0.value = t0

    // ---- the engine: one crank angle places every part
    const th = phaseAt(t0), w = rateAt(t0)
    st.rate = w
    solve(th, P0)
    const p = P0
    beam.rotation.z = p.beta
    rod.position.set(p.cx, p.cy, 0)
    rod.rotation.z = -p.rod
    sun.rotation.z = p.sun
    shaft.rotation.z = p.sun
    fly.rotation.z = p.sun
    link.rotation.z = p.orbit - Math.PI / 2
    U.rate.value = 2 * w
    U.beamA.value.set(p.ax, p.ay, 0)
    U.beamB.value.set(p.bx, p.by, 0)
    U.rodA.value.set(p.cx, p.cy, 0.13)
    U.flyAng.value = p.sun
    // parallel motion: T is the rod's head on the cylinder's axis; F closes the parallelogram on the beam's mid point
    const mx = PIV.x - (LB / 2) * Math.cos(p.beta), my = PIV.y - (LB / 2) * Math.sin(p.beta)
    const fx = mx + (XC - p.ax), fy = my + (p.ty - p.ay)
    for (const l of mainL) span(l.o, p.ax, p.ay, XC, p.ty, l.z, 0.05, 0.03)
    for (const l of backL) span(l.o, mx, my, fx, fy, l.z, 0.045, 0.028)
    for (const l of parB) span(l.o, fx, fy, XC, p.ty, l.z, 0.04, 0.028)
    for (const l of radR) span(l.o, fx - LB / 2, PIV.y - LINK - 0.02, fx, fy, l.z, 0.022)
    pins[0].position.set(XC, p.ty, 0)
    pins[1].position.set(fx, fy, 0)
    pins[2].position.set(fx - LB / 2, PIV.y - LINK - 0.02, 0)
    pRod.position.set(XC, p.ty, 0)
    pumpRod.position.set(PIV.x - 0.95 * Math.cos(p.beta), PIV.y - 0.95 * Math.sin(p.beta) - 0.1, PUMP.z)
    // the governor: the balls stand where gravity and their speed agree; the sleeve, the lever and the butterfly follow
    const wg = 2 * w * GOV.ratio
    const ga = Math.acos(clamp(9.81 / (Math.max(wg, 0.01) ** 2 * (GOV.arm + 0.07)), Math.cos(1.2), Math.cos(0.42)))
    gov.rotation.y = 2 * th * GOV.ratio
    const lift = (Math.cos(0.42) - Math.cos(ga)) * 0.3 * 2
    for (const a of govArms) {
      a.arm.rotation.z = ga
      // the link from the arm's mid point down to the sleeve
      const ax = Math.sin(ga) * 0.22, ay = -Math.cos(ga) * 0.22
      span(a.lk, ax, ay, 0.05, -0.62 + lift, 0, 0.009)
    }
    sleeve.position.y = -0.62 + lift
    const close = clamp(lift / 0.24)
    const sy = GOV.y - 0.62 + lift
    // a lever on the bracket: sleeve end up, far end down; a drop rod, then the long rod to the butterfly's arm
    const lx0 = GOV.x + 0.06, lx1 = GOV.x - 0.5, ly1 = GOV.y - 0.5 - lift * 0.9
    span(govLever, lx0, sy, lx1, ly1, GOV.z + 0.09, 0.03, 0.012)
    const tha = 0.25 + close * 1.05 // the butterfly's angle: across the pipe when the balls are out
    throttle.rotation.z = tha - 0.5
    const hx = TH.x - Math.sin(tha - 0.5) * 0.3, hy = SP.y + Math.cos(tha - 0.5) * 0.3
    span(govRodV, lx1, ly1, lx1, SP.y + 0.34, GOV.z + 0.09, 0.008)
    span(govRodH, lx1, SP.y + 0.34, hx, hy, SP.z + 0.42, 0.008)
    // which dead centres are behind us: the leaks puff on those
    for (let j = 0; j < 6; j++) {
      const k = Math.floor(th / Math.PI) - j
      U.strokeT.array[j] = k >= 1 ? STROKES[Math.min(k - 1, STROKES.length - 1)] : k === 0 && t0 > T_GO ? T_GO : -99
    }

    // ---- light
    const flick = 0.8 + 0.2 * Math.sin(s.time * 9.1) * Math.sin(s.time * 5.3 + 1) + 0.1 * Math.sin(s.time * 23)
    const volts = E.in2(smooth(T_GLOW0, T_GLOW1, t1)) * (0.97 + 0.03 * Math.sin(s.time * 31))
    U.volts.value = volts
    if (bench) {
      U.sunI.value = 0
      U.skyC.value.set(0.06, 0.08, 0.15)
      U.amb.value.set(0.0011, 0.0013, 0.002)
      U.l2P.value.set(FIL.x, FIL.y, FIL.z)
      const v = Math.pow(volts, 2.2)
      U.l2C.value.set(1.0, 0.25 + 0.42 * volts, 0.03 + 0.3 * volts * volts).multiplyScalar(0.0006 + 0.11 * v)
      U.l2R.value = 0.006
      U.l3C.value.set(0, 0, 0)
      RU.warm.value.set(0.5 + 1.2 * volts, 0.5 + 0.85 * volts, 0.6 + 0.4 * volts)
    } else {
      U.sunI.value = 1
      U.skyC.value.set(2.3, 2.7, 3.2)
      U.amb.value.set(0.012, 0.014, 0.018)
      U.l2P.value.set(BO.x + 0.5, 0.95, BO.z + 2.3)
      U.l2C.value.set(1, 0.36, 0.08).multiplyScalar(2.6 * flick)
      U.l2R.value = 0.6
      U.l3C.value.set(1.0, 0.56, 0.22).multiplyScalar(0.9 * (0.92 + 0.08 * Math.sin(s.time * 7.3) * Math.sin(s.time * 3.1 + 2)))
      RU.warm.value.set(1.25, 1.0, 0.72)
    }
    RU.glint.value = s.time * 0.05
    U.cityT.value = t1

    // ---- camera
    const sh = shake(s.time, 1, 0.16)
    if (!bench) {
      // A: wide and low on the flagstones, pushing in. The snap of the tape nudges it.
      const kA = E.out2(clamp((t0 + START * 2) / 4))
      camP.set(5.9 - 0.9 * kA, 1.45 + 0.15 * kA, 10.6 - 2.0 * kA)
      camT.set(-0.9, 3.05, 0)
      let focus = 10, blur = 0.004, fov = FOV
      U.paneG.value = 1
      // Shots are cut, not flown: every straight line between these poses runs through a beam or a column.
      if (t0 >= CUT_H && t0 < CUT_B) {
        // H, the hero: high in the front corner, the whole engine in profile against its windows, the sun's
        // patches on the flagstones in front of it crossed by the shadows of beam, rod and flywheel
        const u = E.io2(clamp((t0 - CUT_H) / (CUT_B - CUT_H)))
        camP.set(5.0 - 0.6 * u, 4.6 - 0.1 * u, 9.7 - 0.5 * u)
        camT.set(1.0, 4.35, 0)
        focus = 9.6
        blur = 0.002
        fov = 38
      } else if (t0 >= CUT_B && t0 < CUT_C) {
        // B: low beside the flywheel, looking up the connecting rod: the planet walking round the sun in
        // the foreground, a hand-span per tooth, and the rod climbing to the beam end overhead for scale
        const u = E.io2(clamp((t0 - CUT_B) / (CUT_C - CUT_B)))
        camP.set(4.4 - 0.4 * u, 1.4 + 0.15 * u, 5.0 - 0.7 * u)
        camT.set(2.2, 2.6 + 0.1 * u, -0.1)
        focus = 3.9 - 0.4 * u
        blur = 0.004
        fov = 50
      } else if (t0 >= CUT_C && t0 < CUT_D) {
        // C: from the boiler's side, the sun through the first window on the gland, the rod and the links
        const u = 0.45 + 0.55 * E.io2(clamp((t0 - CUT_C) / (CUT_D - CUT_C)))
        camP.set(XC - 1.9 - 0.3 * u, 4.2 - 0.4 * u, 2.3 - 0.3 * u)
        camT.set(XC + 0.25, 3.95 - 0.3 * u, -0.1)
        focus = 2.9
        blur = 0.008
      } else if (t0 >= CUT_D) {
        // D: the governor from in front, the engineman's lamp on it, the flywheel a blur behind and the
        // brick pier between the windows behind that; a slow arc as the balls climb
        const a = 0.42 + 0.34 * E.out2(clamp((t0 - CUT_D) / 4.5))
        camP.set(GOV.x + Math.sin(a) * 1.55, GOV.y - 0.12, GOV.z + Math.cos(a) * 1.55)
        camT.set(GOV.x - 0.02, GOV.y - 0.32, GOV.z)
        focus = 1.6
        blur = 0.013
        // exposed for the iron in the lamp's light, the glazing behind it would burn out: the panes are
        // held to a dull glow (as a film unit would gel them) so the frame edges stop flaring
        U.paneG.value = 0.12
      }
      st.fov = fov
      // out: truck along the wall into the dark of the next room
      const kO = E.in2(clamp(t1 / T_ARRIVE))
      camP.x += 3.5 * kO
      camT.x += 5.5 * kO
      st.focus = focus
      st.blur = blur
      // every dead centre is felt in the floor
      let knock = 0
      for (const tk of STROKES) if (t0 > tk) knock = Math.max(knock, Math.exp(-(t0 - tk) * 9))
      knock += Math.exp(-Math.max(0, t0) * 5) * (t0 > -0.05 ? 1.6 : 0)
      camP.y += knock * 0.012 * Math.cos(t0 * 60)
      camP.x += sh[0] * 0.03
      camP.y += sh[1] * 0.02
      // the snap of the tape lands in the house: dust shaken off the trusses hangs in the sun for a moment
      D.haze.value = ctx.debugLabels ? 0 : 1 + (t0 >= 0 ? 1.1 * Math.exp(-t0 * 1.6) * (1 - Math.exp(-t0 * 14)) : 0)
      st.dark = kO
    } else {
      // K: macro on the globe, a slow arc; then a rack to the window, and a rise to the glass
      const arc = E.out2(clamp((t1 - T_ARRIVE) / 4.5))
      const kR = s.k(1, T_RACK0, T_RACK1, E.io3)
      const kP = s.k(1, T_RACK1 - 0.3, 9.4, E.io2)
      camP.set(FIL.x + 0.012 + 0.075 * arc, FIL.y + 0.022 - 0.012 * arc, FIL.z + 0.235 - 0.03 * arc)
      camT.set(FIL.x + 0.01, FIL.y - 0.002, FIL.z)
      lerpPose(FIL.x + 2.4, CITY_Y + 44, ZW - 14, FIL.x + 9, CITY_Y + 2, ZW - 330, kP)
      camT.lerp(tmpT.set(FIL.x + 1.6, FIL.y - 9 * kP, ZW - 150), kR * (1 - kP) * 0.35)
      st.focus = Math.exp(mix(Math.log(0.22), Math.log(170), kR))
      st.blur = mix(0.012, 0.02, kR)
      camP.x += sh[0] * 0.0012
      camP.y += sh[1] * 0.001
      D.haze.value = 0
      st.dark = 1 - smooth(T_ARRIVE, T_ARRIVE + 0.9, t1)
    }
    cam.aspect = s.w / s.h
    cam.fov = bench ? FOV : st.fov
    D.tanH.value = Math.tan((cam.fov * Math.PI) / 360)
    cam.position.copy(camP)
    cam.position.x += s.mouse.x * (bench ? 0.004 : 0.12)
    cam.position.y += s.mouse.y * (bench ? 0.003 : 0.06)
    cam.lookAt(camT)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    const e = cam.matrixWorld.elements
    U.camP.value.copy(cam.position)
    U.camR.value.set(e[0], e[1], e[2])
    U.camU.value.set(e[4], e[5], e[6])
    U.camF.value.set(-e[8], -e[9], -e[10])
    D.asp.value = cam.aspect
    D.focus.value = st.focus
    D.blur.value = ctx.debugLabels ? 0 : st.blur
    D.shade.value = ctx.debugLabels ? 0 : 1
    lampG.visible = cityG.visible = t1 > -0.5
    placeRule(rule, cam, { dist: cam.near * 5 })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)

    if (s.live) {
      const run = bench ? 0 : clamp(w / W_MAX) * (1 - st.dark)
      ctx.synth.bed("fire", bench ? 0 : 0.25 * (t0 < 0 ? s.enter : 1) * (1 - st.dark))
      ctx.synth.bed("air", 0.1 + 0.5 * run)
      ctx.synth.bed("hum", bench ? 0.3 * volts : 0)
    }
  }

  // ---------------------------------------------------------------- sound: the engine's beat is its own phase

  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  cues.push({ b: 0, at: T_GO, s: "tick", o: { f: H(24), g: 0.6 }, pos: [-0.3, 0.1, 0.3] }, { b: 0, at: T_GO + 0.06, s: "hiss", o: { g: 0.3, dur: 1.4, f: 900 }, pos: [-0.3, 0.2, 0.3] })
  STROKES.forEach((tk, k) => {
    if (tk > 10.6) return
    const up = k % 2 === 0
    const g = 0.55 + 0.35 * Math.min(1, k / 6)
    // valve gear trips, the piston turns, the steam goes to the condenser
    cues.push({ b: 0, at: tk - 0.05, s: "tick", o: { f: H(up ? 20 : 24), g: 0.5 }, pos: [-0.35, 0.1, 0.3] })
    cues.push({ b: 0, at: tk, s: "thump", o: { g, f: H(up ? 2 : 3), lfe: 0.9 }, pos: [up ? -0.3 : 0.3, -0.3, 0.2] })
    cues.push({ b: 0, at: tk + 0.07, s: "hiss", o: { g: 0.2 + 0.12 * (k % 3), dur: 0.5, f: up ? 1400 : 1000 }, pos: [-0.4, 0.3, 0.3] })
    if (k % 2 === 1) cues.push({ b: 0, at: tk + 0.16, s: "splash", o: { g: 0.16 }, pos: [-0.2, -0.5, 0.2] }) // the air pump's delivery
  })
  cues.push({ b: 0, at: 5.9, s: "governor", o: { g: 0.5, dur: 3.2, f: H(8) }, pos: [0.1, 0.1, 0.1] })
  cues.push({ b: 0, at: 2.0, s: "whoosh", o: { g: 0.2, f: 140, dur: 0.8 } })
  // beat 1: the engine stops in mid-breath; then a tone that rises with the thread, and a tick for a window
  cues.push({ b: 1, at: 0.0, s: "whoosh", o: { g: 0.3, f: 110, dur: 0.5 } }, { b: 1, at: T_ARRIVE - 0.05, s: "thud", o: { g: 0.5, f: H(2) }, pos: [0, 0, 0.5] })
  cues.push({ b: 1, at: T_GLOW0, s: "pad", o: { f: H(8), dur: 3.4, g: 0.16 }, pos: [0, 0, 0] }, { b: 1, at: T_GLOW0 + 1.5, s: "pad", o: { f: H(12), dur: 2.6, g: 0.16 }, pos: [0, 0, 0] }, { b: 1, at: T_GLOW1 - 0.9, s: "shimmer", o: { f: H(16), dur: 1.8, g: 0.2 } })
  cues.push({ b: 1, at: T_GLOW1 - 0.05, s: "glass", o: { f: H(32), g: 0.3 }, pos: [-0.1, 0, 0] })
  {
    const R = rng(85)
    cityCues.forEach((t, i) => cues.push({ b: 1, at: t, s: "tick", o: { f: H(40 + ((i * 7) % 24)), g: 0.16 + 0.12 * R(), wet: 1.6 }, pos: [R() * 1.6 - 0.8, R() * 0.5 - 0.3, 0.6 + R()] }))
  }
  cues.push({ b: 1, at: T_CITY1, s: "bell", o: { f: H(16), g: 0.3 }, pos: [0, 0.1, 1] }, { b: 1, at: T_CITY1, s: "pad", o: { f: H(4), dur: 3, g: 0.2 } })

  update({ beat: 0, t: 0, time: 0, dt: 0, enter: 1, exit: 0, w: 1280, h: 720, live: false, mouse: { x: 0, y: 0 }, k: () => 0, at: (b) => (b === 0 ? 0 : -99) })

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: lens, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      lens.render(out)
      if (ctx.debugLabels) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1], fade: 0 })
      else {
        POST.exposure = st.bench ? 1.15 : 1.0
        POST.bloom = st.bench ? 0.8 : 0.5
        POST.fade = st.dark
      }
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(4,3,2,0.75)", color: "#f6eedc" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      UNIT.dispose()
      UNITB.dispose()
      BALL.dispose()
      disposeTree(scene)
    },
  }
}
