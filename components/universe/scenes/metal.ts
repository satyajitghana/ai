// Scene 15, "Copper and tin, poured." / "Then iron, hammered." The Bronze Age, then the Iron Age.
//
// A smith's workshop, dark and lit by what is hot. Beat 1: a clay mould, bound and wrapped (the
// London Museum's), stands in a bed of sand with its near half swung open, so the lens sees the
// cavity of a leaf-shaped blade in section. Bronze is poured, fills it from the tip, cools, is
// broken out, has its flash and jet knocked off, and is set into the earth of the floor, where the
// workshop falls quiet around it and it goes brown and then green. Beat 2: the lens rises from the
// green blade to the next fire: a bloom is drawn solid from a bloomery and beaten on a stone anvil,
// in two heats, into a blade: sparks, slag, hammer scale that cools black where it lands, a quench.
// Beat sheet: R/beats/metal.md.
//
// One world rule, `shade`: almost no ambient; up to three point lights that are whatever is hot,
// coloured by one temperature ramp `heatCol`, with soft shadows from a handful of spheres; a cool
// shaft of daylight through the doorway in the far wall; and smoke that every light shows up in
// (`fin`: closed-form airlight per fire, the shaft marched in five steps). View depth rides in the
// stage's alpha as a circle of confusion; one pass does depth of field and the shimmer over the fires.

import * as THREE from "three/webgpu"
import {
  abs, atan, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dFdx, dFdy, dot, exp, faceDirection, float, floor, Fn, fract, If, instanceIndex, int, length, Loop, max, min, mix as mixN,
  modelWorldMatrix, normalGeometry, normalize, normalLocal, normalWorld, positionGeometry, positionLocal, positionWorld, pow, select, sin, smoothstep as smoothstepN, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4, Discard,
} from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels } from "../engine/ages"
import { featherMaterial, makeAim, makeHerd, skinMaterial, type Drive, type Lights } from "../engine/creature"
import * as HU from "../engine/creature/human"
import { clamp, E, mix, rng } from "../engine/ease"
import { disposeTree, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles } from "../engine/titles"
import { fbm, fbm3, hash11, hash21, sampleRT, sat, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { MOULD, MOULD_DUR, MOULD_IN, PRE_CAM, roundBox } from "../transitions/mould"

/** `smoothstep` that may fall: WGSL leaves a reversed pair of edges undefined. */
const smoothstep = (a: number | F, b: number | F, x: unknown): F => (typeof a === "number" && typeof b === "number" && a > b ? smoothstepN(b, a, x as F).oneMinus() : smoothstepN(a as F, b as F, x as F)) as F

// ---------------------------------------------------------------- where things are (metres; the mould parts in the plane z = 0, the floor is y = 0, the lens is on +z)

const START = MOULD_DUR * (1 - MOULD_IN)
const { x: MX, y0: MY0, w: MW, h: MH, d: MD } = MOULD
const WRAP = 0.028
const FUR: [number, number, number] = [0.66, 0, -0.38] //   the bowl furnace the bronze is melted in
const PIT: [number, number] = [-0.56, 0.44] //              where the blade is set into the floor (x, z)
const WX = -1.5 //                                           the anvil
const ZW = -0.2
const ATOP = 0.78
const BLM: [number, number, number] = [WX + 0.8, 0, ZW - 0.4] // the bloomery, at the smith's left hand; its mouth looks at the anvil
const MDIR: [number, number] = [-0.894, 0.447]
const MOUTH: [number, number, number] = [BLM[0] + MDIR[0] * 0.3, 0.2, BLM[2] + MDIR[1] * 0.3]
const TROUGH: [number, number] = [WX + 0.25, ZW + 0.55]
const ROCK: [number, number, number] = [-0.1, 0.1, 0.3]
const DOOR = { x: -1.85, hw: 0.21, top: 1.2, z: -2.15 }
/** The hide hung over the doorway: drawn aside to here (x), its loose edge. */
const FLAP = DOOR.x - DOOR.hw + 0.19
const LD = new THREE.Vector3(0.22, -0.62, 1).normalize() //   the way the daylight travels (at rest; the days sweep it)

// the blade's cavity, in the valve's own frame (y up from its foot): tip down, poured from the hilt end

const TIP = 0.035, YS = 0.455, YT = 0.545
const HWN = 64
/** Half-width of the cavity at height y: a leaf-shaped blade, shoulders, a hilt plate, the pouring cup. */
function bladeHW(y: number): number {
  if (y < TIP || y > MH) return 0
  if (y <= YS) {
    const v = (y - TIP) / (YS - TIP)
    return 0.0275 * Math.sqrt(v) * (0.8 + 0.2 * Math.cos((v - 0.36) * 6) + 0.32 * clamp((v - 0.9) / 0.1) ** 2)
  }
  if (y <= YT) return 0.0115 + 0.0045 * Math.sin(((y - YS) / (YT - YS)) * Math.PI) + 0.014 * (1 - clamp((y - YS) / 0.012)) ** 2
  const c = (y - YT) / (MH - YT)
  return mix(0.0115, 0.036, c * c * (3 - 2 * c))
}
const HWS = Array.from({ length: HWN }, (_, i) => bladeHW((i / (HWN - 1)) * MH))

// the smith's blows (seconds into beat 2), two heats, and the quench
const BLOWS = [3.1, 3.75, 4.35, 4.9, 5.4, 5.9, 8.0, 8.45, 8.9, 9.3, 9.7, 10.1, 10.5]
const HEATS = [2.0, 7.3]
const QUENCH = 11.2
const POUR_END = 3.4
const CRACK = 6.0
const KNOCK = 8.25
const B1 = 100 // beat 2's events live on one clock with beat 1's, this far along it

const tempAt = (t: number) => {
  const th = t >= HEATS[1] ? HEATS[1] : HEATS[0]
  return Math.min(1, Math.exp(-Math.max(t - th, 0) / 5)) * (t > QUENCH ? Math.exp(-(t - QUENCH) * 7) : 1)
}
const kk = (t: number, a: number, b: number, e: (x: number) => number = E.io2) => e(clamp((t - a) / (b - a)))
/** The temperature ramp on the CPU (for the lights): black, dull red, orange, yellow, white. */
function heatRGB(T: number, out: THREE.Vector3) {
  const t = clamp(T)
  const a = clamp((t - 0.12) / 0.18), b = clamp((t - 0.28) / 0.24), c = clamp((t - 0.5) / 0.28), d = clamp((t - 0.78) / 0.22)
  out.set(0.42 * a, 0.025 * a, 0)
  out.lerp(_h.set(mix(1.15, 2.1, c), mix(0.25, 1.0, c), mix(0.02, 0.18, c)).lerp(_w.set(3.3, 2.65, 1.7), d), b)
  return out
}
const _h = new THREE.Vector3(), _w = new THREE.Vector3()


/** Push a geometry's vertices about along their normals with a few seeded waves: nothing here is a clean primitive. */
function knead<T extends THREE.BufferGeometry>(g: T, seed: number, amp: number, f = 9): T {
  const R = rng(seed)
  const Wv = Array.from({ length: 6 }, () => [(R() * 2 - 1) * f, (R() * 2 - 1) * f, (R() * 2 - 1) * f, R() * 6.28])
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    let k = 0
    for (const w of Wv) k += Math.sin(x * w[0] + y * w[1] + z * w[2] + w[3])
    k *= amp / 3
    p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}
const lathe = (prof: number[][], seg = 28) => new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg)

/** A stone: an icosphere pushed about by a few seeded waves. */
function rock(seed: number, sx: number, sy: number, sz: number, amp = 0.16) {
  const g = new THREE.SphereGeometry(1, 30, 20)
  const R = rng(seed)
  const W = Array.from({ length: 7 }, () => [R() * 6 - 3, R() * 6 - 3, R() * 6 - 3, R() * 6.28])
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    let k = 1
    for (const w of W) k += (amp / 3) * Math.sin(x * w[0] + y * w[1] + z * w[2] + w[3])
    // a flat seat and a flattish top
    p.setXYZ(i, x * k * sx, clamp(y * k, -0.82, 0.8) * sy, z * k * sz)
  }
  g.computeVertexNormals()
  return g
}
/** One side of the casting: a lens section following the cavity between y0 and y1. `grow` widens it (the flash). */
function castGeo(y0: number, y1: number, rows: number, grow: number, thick: (y: number) => number, yc: number) {
  const NI = 10
  const pos: number[] = [], uvs: number[] = [], idx: number[] = []
  for (const side of [1, -1])
    for (let j = 0; j <= rows; j++) {
      const y = y0 + ((y1 - y0) * j) / rows
      for (let i = 0; i <= NI; i++) {
        const s = (i / NI) * 2 - 1
        pos.push((Math.max(bladeHW(y), 0.0004) + grow) * s, y - yc, side * thick(y) * (1 - s * s) ** 0.7)
        uvs.push(s, y / MH)
      }
    }
  const row = NI + 1
  for (let sd = 0; sd < 2; sd++)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < NI; i++) {
        const a = sd * (rows + 1) * row + j * row + i
        if (sd === 0) idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
        else idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
const quadGeo = (n: number) => {
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.instanceCount = n
  return g
}
const blend = (m: THREE.NodeMaterial, add = false) => {
  // colour over or added; the stage's alpha (the circle of confusion) is left as it was
  Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide })
  return m
}


export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const sharp = ctx.target({})
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(PRE_CAM.fov, 16 / 9, 0.05, 30)

  // ---------------------------------------------------------------- the world rule
  const W = {
    amb: uniform(new THREE.Vector3(0.02, 0.026, 0.04)),
    doorCol: uniform(new THREE.Vector3(0.5, 0.66, 0.9)),
    smoke: uniform(0.3),
    top: uniform(new THREE.Vector3()), //        daylight through the fallen roof, while the years pass
    decay: uniform(0), //                        the years the blade lies in the floor
    fwd: uniform(new THREE.Vector3(0, 0, -1)), focus: uniform(1.7), ap: uniform(0.5),
    hotP: uniformArray([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], "vec3"),
    hotC: uniformArray([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], "vec3"),
    occ: uniformArray(Array.from({ length: 6 }, () => new THREE.Vector4(0, -9, 0, 0.01)), "vec4"),
    t: uniform(0),
    g: uniform(-10), //                          the one event clock
    breath: uniform(new THREE.Vector2()), //     furnace, bloomery: 0..1
    // the mould
    level: uniform(0), mouldT: uniform(0), burnt: uniform(0), flow: uniform(0), crack: uniform(0),
    // the casting
    castT: uniform(0), years: uniform(0), cover: uniform(0),
    // the stream
    lip: uniform(new THREE.Vector3()), v0: uniform(new THREE.Vector3(-0.22, 0.02, 0)), fall: uniform(0.15), head: uniform(0), tail: uniform(0),
    // the iron
    ironT: uniform(0), dim: uniform(new THREE.Vector3(0.07, 0.06, 0.06)), lump: uniform(0.02), bar: uniform(0), blade: uniform(0), blows: uniform(0), wet: uniform(0),
    puff: uniformArray([0, 0, 0, 0, 0, 0], "float"),
    pat: uniform(0), ruleExp: uniform(1), proj: uniform(new THREE.Vector2(1, 1)),
    keyDir: uniform(new THREE.Vector3(0, -1, 0)), keyCol: uniform(new THREE.Vector3()),
    ld: uniform(LD.clone()), //                  the daylight's direction (low and sweeping while the years pass)
    flap: uniform(FLAP),
  }
  const hotP = (i: number) => W.hotP.element(i) as unknown as V3
  const hotC = (i: number) => W.hotC.element(i) as unknown as V3
  const LDv = W.ld as unknown as V3
  const heatCol = (T: F): V3 => {
    const t = sat(T)
    return mixN(vec3(0.42, 0.025, 0).mul(smoothstep(0.12, 0.3, t)), mixN(mixN(vec3(1.15, 0.25, 0.02), vec3(2.1, 1.0, 0.18), smoothstep(0.5, 0.78, t)), vec3(3.3, 2.65, 1.7), smoothstep(0.78, 1, t)), smoothstep(0.28, 0.52, t)) as V3
  }
  /** Circle of confusion of a world point, signed: negative in front of the plane of focus. */
  const coc = (P: V3): F => {
    const d = max(dot(P.sub(cameraPosition), W.fwd), 0.05)
    return clampN(d.sub(W.focus).div(d).mul(W.ap), -1, 1) as F
  }
  /** How much of the doorway's daylight reaches P: a slanting beam whose edges soften with distance. */
  const doorMask = (P: V3): F => {
    const s = P.z.sub(DOOR.z).div(LDv.z).max(0)
    const Q = P.sub(LDv.mul(s))
    const e = s.mul(0.05).add(0.015)
    // the opening, less the hide over its left part; the light thins and spreads as it crosses the room
    const open = smoothstepN(e.negate(), e, float(DOOR.hw).sub(abs(Q.x.sub(DOOR.x)))).mul(smoothstepN(e.negate(), e, float(DOOR.top).sub(Q.y)))
    const hide = smoothstepN(e.mul(-1.5), e.mul(1.5), Q.x.sub(W.flap).add(Q.y.mul(0.06)))
    return open.mul(hide).mul(exp(s.mul(-0.32))) as F
  }
  /** Soft shadow of the set's big shapes (six spheres) between P and a light. */
  const shadowOf = Fn(([P, Lp]: [V3, V3]) => {
    const s = float(1).toVar()
    const d = Lp.sub(P).toVar()
    const dd = dot(d, d)
    Loop(6, ({ i }) => {
      const o = W.occ.element(i) as unknown as V4
      const oc = o.xyz.sub(P).toVar()
      const tt = clampN(dot(oc, d).div(dd), 0, 1)
      const dist = length(oc.sub(d.mul(tt)))
      const outside = smoothstepN(o.w, o.w.mul(1.4), length(oc))
      s.mulAssign(mixN(float(1), smoothstepN(o.w.mul(0.5), o.w.mul(1.6), dist), outside))
    })
    return s
  })
  /** A height's slope as a tilt of the normal (h in metres, from screen derivatives). */
  const bump = (P: V3, N: V3, h: F, k = 1): V3 => {
    const px = dFdx(P), py = dFdy(P)
    const g = px.mul(dFdx(h).div(dot(px, px).add(1e-9))).add(py.mul(dFdy(h).div(dot(py, py).add(1e-9))))
    return normalize(N.sub(g.mul(k))) as V3
  }
  const POOL = vec3(DOOR.x + 0.4, 0, -1.0)
  /** What is hot, the doorway, and next to nothing else. */
  const shade = (P: V3, N: V3, alb: V3, rough: F | number, o: { metal?: F | number; ao?: F | number; shadow?: boolean } = {}): V3 => {
    const V = normalize(cameraPosition.sub(P)).toVar()
    const rg = float(rough as number) as F
    const mt = float((o.metal ?? 0) as number) as F
    const gl = float(2).div(max(rg.mul(rg), 0.004))
    const f0 = mixN(vec3(0.04, 0.04, 0.04), alb, mt)
    const dif = alb.mul(mt.oneMinus())
    const c = dif.mul(W.amb.mul(N.y.mul(0.4).add(0.6)).add(W.top.mul(max(N.y.mul(0.8).add(0.2), 0)))).add(f0.mul(W.amb.mul(3).add(W.top)).mul(rg.oneMinus())).toVar()
    const dm = doorMask(P).toVar()
    const Rf = V.negate().sub(N.mul(dot(N, V.negate()).mul(2)))
    const toDoor = normalize(vec3(DOOR.x, 0.7, DOOR.z).sub(P))
    c.addAssign(f0.mul(mt).mul(0.6).mul(W.amb.mul(5).add(W.doorCol.mul(0.05).mul(pow(max(dot(Rf, toDoor), 0), 6).mul(2.4).add(max(Rf.y, 0).mul(0.3))))).mul(rg.oneMinus().mul(0.7).add(0.3)))
    c.addAssign(W.doorCol.mul(dm).mul(dif.mul(max(dot(N, LDv.negate()), 0)).add(f0.mul(pow(max(dot(N, normalize(V.sub(LDv))), 0), gl)).mul(rg.oneMinus()))))
    // the pool of daylight on the floor fills the room from behind
    const tp = POOL.sub(P)
    c.addAssign(dif.mul(W.doorCol).mul(dot(N, normalize(tp)).mul(0.5).add(0.5)).mul(0.09).div(dot(tp, tp).mul(0.7).add(1)))
    for (let i = 0; i < 3; i++) {
      const d = hotP(i).sub(P).toVar()
      const d2 = dot(d, d).toVar()
      const l = d.div(sqrt(d2)).toVar()
      const sh = o.shadow === false ? float(1) : shadowOf(P, hotP(i))
      const lam = max(dot(N, l).add(0.2).div(1.2), 0)
      const sp = pow(max(dot(N, normalize(l.add(V))), 0), gl).mul(rg.oneMinus()).mul(gl.mul(0.04).add(0.6))
      c.addAssign(hotC(i).mul(sh).div(d2.add(0.07)).mul(dif.mul(lam).add(f0.mul(sp))))
    }
    return c.mul(float((o.ao ?? 1) as number)) as V3
  }
  /** Through the smoke to the lens: extinction, the glow round each fire, the daylight shaft; alpha is the circle of confusion. */
  const fin = (c: V3, P: V3): V4 => {
    const R = P.sub(cameraPosition).toVar()
    const d = length(R).toVar()
    const dir = R.div(d).toVar()
    const T = exp(d.mul(W.smoke).negate())
    const air = vec3(0, 0, 0).toVar()
    for (let i = 0; i < 3; i++) {
      const L = hotP(i).sub(cameraPosition).toVar()
      const tt = dot(L, dir).toVar()
      const h = max(length(L.sub(dir.mul(tt))), 0.05).toVar()
      air.addAssign(hotC(i).mul(atan(d.sub(tt).div(h)).add(atan(tt.div(h)))).div(h))
    }
    const beam = float(0).toVar()
    for (let k = 0; k < 5; k++) beam.addAssign(doorMask(cameraPosition.add(dir.mul(d.mul((k + 0.5) / 5))) as V3))
    const col = c.mul(T).add(W.amb.add(W.top.mul(0.12)).mul(T.oneMinus()).mul(0.9)).add(air.mul(W.smoke).mul(0.012)).add(W.doorCol.mul(beam).mul(d).mul(W.smoke).mul(0.085))
    return vec4(col, coc(P)) as V4
  }

  type Kind = "clay" | "coarse" | "stone" | "wood" | "bark" | "leather" | "iron" | "char" | "sand" | "cruc" | "bast" | "earth"
  const solid = (kind: Kind, o: { two?: boolean; fire?: number } = {}) => {
    const m = new THREE.NodeMaterial()
    if (o.two) m.side = THREE.DoubleSide
    m.fragmentNode = Fn(() => {
      const pl = positionLocal
      const P = positionWorld as V3
      const N0 = normalize(o.two ? normalWorld.mul(faceDirection) : normalWorld).toVar()
      const g = fbm3(pl.mul(kind === "bark" ? vec3(34, 9, 34) : kind === "wood" ? vec3(110, 7, 110) : 38)).toVar()
      const f = vnoise(pl.xy.mul(260).add(pl.z.mul(190))).toVar()
      let alb: V3, rough: F | number = 0.88, h: F = g.mul(0.003) as F, metal: F | number = 0
      const emit = vec3(0, 0, 0).toVar()
      if (kind === "clay") alb = mixN(vec3(0.34, 0.19, 0.11), vec3(0.5, 0.31, 0.19), g).mul(f.mul(0.18).add(0.9)).mul(smoothstep(0.3, 0.6, fbm3(pl.mul(9).add(5))).mul(0.45).oneMinus()) as V3
      else if (kind === "cruc") {
        // a used crucible: grey, heat-crazed, its lip a glassy slag with green and red copper in it
        const lipK = smoothstep(-0.03, 0.0, pl.y.add(g.sub(0.5).mul(0.02))).toVar()
        const slag = mixN(vec3(0.05, 0.07, 0.05), mixN(vec3(0.32, 0.07, 0.04), vec3(0.08, 0.3, 0.2), vnoise(pl.xz.mul(90).add(pl.y.mul(60)))), smoothstep(0.45, 0.7, g))
        alb = mixN(mixN(vec3(0.26, 0.24, 0.22), vec3(0.4, 0.37, 0.33), g).mul(f.mul(0.2).add(0.85)), slag, lipK) as V3
        rough = mixN(float(0.85), float(0.22), lipK) as F
        h = g.mul(0.004).add(lipK.mul(vnoise(pl.xz.mul(140)).mul(0.003))) as F
      } else if (kind === "coarse") {
        // a furnace wall: chaff-tempered daub, cracked, patched with paler clay, sooted upward, fired red toward the heat
        const chaff = smoothstep(0.72, 0.8, vnoise(pl.xy.mul(vec2(90, 420)).add(pl.z.mul(300))))
        const crack = smoothstep(0.009, 0.0, abs(fbm3(pl.mul(vec3(7, 4, 7)).add(7)).sub(0.5))).mul(smoothstep(0.35, 0.6, fbm3(pl.mul(2.2).add(3)))).toVar()
        const patch = smoothstep(0.56, 0.6, fbm3(pl.mul(4.5).add(11))).toVar()
        const soot = smoothstep(0.15, 0.95, pl.y.mul(1.1).add(g.mul(0.5))).mul(0.8)
        alb = mixN(mixN(vec3(0.3, 0.2, 0.14), vec3(0.47, 0.34, 0.24), g), vec3(0.72, 0.64, 0.46), chaff.mul(0.6)) as V3
        alb = mixN(alb, vec3(0.6, 0.5, 0.39).mul(f.mul(0.2).add(0.85)), patch.mul(0.8)) as V3
        alb = alb.mul(soot.oneMinus()).mul(crack.mul(0.85).oneMinus()) as V3
        h = g.mul(0.006).add(patch.mul(0.004)).sub(crack.mul(0.008)) as F
        // heat finds the cracks
        const br = o.fire === 1 ? W.breath.y : W.breath.x
        emit.assign(heatCol(br.mul(0.26).mul(crack).mul(smoothstep(0.34, 0.1, pl.y)) as F).mul(0.3))
      } else if (kind === "stone") {
        alb = mixN(vec3(0.17, 0.17, 0.18), vec3(0.36, 0.35, 0.33), g).mul(f.mul(0.4).add(0.75)).mul(smoothstep(0.75, 0.6, vnoise(pl.xy.mul(90).add(pl.z.mul(70)))).mul(0.35).add(0.65)) as V3
        rough = 0.72
        h = g.mul(0.006).add(f.mul(0.0015)) as F
      } else if (kind === "wood") {
        alb = mixN(vec3(0.08, 0.052, 0.03), vec3(0.21, 0.14, 0.08), g).mul(f.mul(0.25).add(0.85)) as V3
        rough = 0.66
        h = g.mul(0.002) as F
      } else if (kind === "bark") {
        // a log: furrowed bark on the round, rings and adze facets on the cut top
        const top = smoothstep(0.6, 0.85, normalLocal.y).toVar()
        const furrow = smoothstep(0.35, 0.65, g).toVar()
        const rr = length(pl.xz)
        const rings = sin(rr.mul(330).add(fbm(pl.xz.mul(14)).mul(7))).mul(0.5).add(0.5)
        const cell = voronoi(pl.xz.mul(26)).toVar()
        const facet = hash21(cell.yz).toVar()
        const barkC = mixN(vec3(0.035, 0.028, 0.022), vec3(0.16, 0.12, 0.085), furrow).mul(f.mul(0.3).add(0.8))
        const cutC = mixN(vec3(0.3, 0.2, 0.11), vec3(0.46, 0.33, 0.19), rings).mul(facet.mul(0.3).add(0.8)).mul(smoothstep(0.0, 0.08, cell.x).mul(0.25).add(0.75))
        alb = mixN(barkC, cutC, top) as V3
        rough = 0.8
        h = mixN(furrow.mul(0.012), facet.mul(0.004).add(cell.x.mul(0.01)), top) as F
      } else if (kind === "leather") {
        // hide, hair side out in patches, creased where the bag folds
        const hair = smoothstep(0.5, 0.62, fbm3(pl.mul(9))).toVar()
        alb = mixN(mixN(vec3(0.16, 0.095, 0.06), vec3(0.3, 0.19, 0.115), g), vec3(0.2, 0.17, 0.13).mul(vnoise(pl.xy.mul(vec2(600, 90))).mul(0.6).add(0.6)), hair.mul(0.7)) as V3
        rough = 0.6
        h = sin(pl.y.mul(170).add(g.mul(9))).mul(0.0018).add(g.mul(0.004)) as F
      } else if (kind === "iron") {
        alb = mixN(vec3(0.08, 0.08, 0.09), vec3(0.2, 0.2, 0.22), g) as V3
        rough = 0.45
        metal = 0.7
      } else if (kind === "sand") {
        const sp = vnoise(pl.xz.mul(900)).toVar()
        alb = mixN(vec3(0.36, 0.3, 0.22), vec3(0.6, 0.52, 0.4), fbm(pl.xz.mul(30))).mul(sp.mul(0.5).add(0.72)) as V3
        h = fbm(pl.xz.mul(46)).mul(0.008).add(sp.mul(0.0012)) as F
      } else if (kind === "earth") {
        // clods of trodden earth: darker and damp underneath, dry and paler on top, grit in it, dust settling with the years
        const top = smoothstep(-0.2, 0.8, N0.y).toVar()
        alb = mixN(mixN(vec3(0.1, 0.07, 0.045), vec3(0.2, 0.14, 0.09), g), mixN(vec3(0.26, 0.19, 0.12), vec3(0.36, 0.27, 0.18), f), top.mul(0.7)).mul(hash11(float(instanceIndex).mul(3.1)).mul(0.35).add(0.8)) as V3
        alb = mixN(alb, vec3(0.3, 0.24, 0.17), W.decay.mul(top).mul(0.4)) as V3
        rough = 0.95
        h = g.mul(0.002).add(f.mul(0.0008)) as F
      } else if (kind === "bast") {
        const tw = sin(pl.x.mul(900).add(pl.y.mul(700)).add(pl.z.mul(800))).mul(0.5).add(0.5)
        alb = mixN(vec3(0.16, 0.11, 0.05), vec3(0.42, 0.33, 0.18), tw).mul(g.mul(0.5).add(0.7)) as V3
        h = tw.mul(0.002) as F
      } else {
        // charcoal: lumps with their own heat near a fire, breathing with the bellows; ash on what faces the air
        alb = mixN(vec3(0.012, 0.012, 0.014), vec3(0.07, 0.066, 0.062), f) as V3
        const near0 = exp(length(P.sub(vec3(FUR[0], 0.2, FUR[2]))).mul(-9))
        const own = hash11(float(instanceIndex).mul(1.37).add(3))
        const heat = W.breath.x.mul(0.6).add(0.25).mul(own.mul(own).mul(1.15).add(0.08)).mul(smoothstep(0.8, -0.4, N0.y.mul(0.5).add(g.sub(0.5)))).mul(near0.mul(6).min(1))
        emit.assign(heatCol(heat.mul(1.25) as F).mul(1.3))
        alb = mixN(alb, vec3(0.42, 0.42, 0.42), smoothstep(0.62, 0.8, g).mul(max(N0.y, 0)).mul(0.5)) as V3
        rough = 0.6
      }
      const N = bump(P, N0 as V3, h)
      return fin(shade(P, N, alb, rough, { metal }).add(emit) as V3, P)
    })()
    return m
  }
  const M = { clay: solid("clay"), cruc: solid("cruc", { two: true }), coarse: solid("coarse", { two: true }), coarseB: solid("coarse", { two: true, fire: 1 }), stone: solid("stone"), wood: solid("wood"), bark: solid("bark"), leather: solid("leather"), iron: solid("iron"), char: solid("char"), sand: solid("sand"), bast: solid("bast") }
  const add = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) => {
    o.position.set(x, y, z)
    parent.add(o)
    return o
  }
  const rod = (len: number, r0: number, r1: number, mat: THREE.Material, seed: number, amp = 0.004) => new THREE.Mesh(knead(new THREE.CylinderGeometry(r1, r0, len, 9, 8), seed, amp, 14), mat)

  // ---------------------------------------------------------------- the floor: packed earth, and everything that has fallen on it
  const groundMat = new THREE.NodeMaterial()
  groundMat.fragmentNode = Fn(() => {
    const P = positionWorld as V3
    const p = P.xz.toVar()
    const g = fbm(p.mul(7)).toVar()
    const f = vnoise(p.mul(230)).toVar()
    const dF = length(p.sub(vec2(FUR[0], FUR[2]))).toVar(), dB = length(p.sub(vec2(BLM[0], BLM[2]))).toVar(), dA = length(p.sub(vec2(WX, ZW))).toVar(), dM = length(p.sub(vec2(MX, -0.02))).toVar()
    const fires = exp(dF.mul(-2.4)).add(exp(dB.mul(-2.0))).add(exp(dA.mul(-3)).mul(0.6)).toVar()
    // trampled earth, paler where it is walked hard
    const alb = mixN(vec3(0.2, 0.16, 0.115), vec3(0.4, 0.33, 0.24), fbm(p.mul(vec2(3, 5)).add(g))).mul(f.mul(0.3).add(0.82)).toVar()
    const h = g.mul(0.012).add(fbm(p.mul(40)).mul(0.004)).toVar()
    // two trails of bare footprints: door to furnace, furnace to anvil
    for (const [ox, oz, ang, len] of [[-1.8, -1.9, 0.62, 2.4], [0.25, 0.42, 3.06, 1.7]]) {
      const q = vec2(p.x.sub(ox).mul(Math.cos(ang)).add(p.y.sub(oz).mul(Math.sin(ang))), p.y.sub(oz).mul(Math.cos(ang)).sub(p.x.sub(ox).mul(Math.sin(ang)))).toVar()
      const n = floor(q.x.div(0.36))
      const side = fract(n.mul(0.5)).mul(4).sub(1) // -1, +1 alternately
      const c = vec2(fract(q.x.div(0.36)).sub(0.5).mul(0.36), q.y.sub(side.mul(0.085)))
      // heel and ball: two overlapping ellipses
      const foot = min(length(c.add(vec2(0.07, 0)).div(vec2(0.045, 0.034))), length(c.sub(vec2(0.045, side.mul(-0.006))).div(vec2(0.075, 0.045))))
      const pr = smoothstep(1.0, 0.6, foot).mul(step(0, q.x)).mul(step(q.x, len)).mul(smoothstep(0.35, 0.6, hash11(n.add(ox * 7)).add(0.4)))
      h.subAssign(pr.mul(0.007))
      alb.mulAssign(pr.mul(0.22).oneMinus())
    }
    // scorched and sooted round the fires, grey ash raked out of them
    alb.mulAssign(sat(fires.mul(0.75) as F).oneMinus().mul(0.8).add(0.2))
    const ash = smoothstep(0.5, 0.66, fbm(p.mul(5).add(3)).add(fires.mul(0.35))).mul(smoothstep(0.1, 0.5, fires)).toVar()
    alb.assign(mixN(alb, vec3(0.42, 0.41, 0.4).mul(f.mul(0.4).add(0.7)), ash.mul(0.7)))
    // the mould's bed of sand
    const sand = smoothstep(0.34, 0.2, dM.add(g.sub(0.5).mul(0.12))).toVar()
    alb.assign(mixN(alb, mixN(vec3(0.36, 0.3, 0.22), vec3(0.58, 0.5, 0.38), fbm(p.mul(30))).mul(vnoise(p.mul(900)).mul(0.5).add(0.72)), sand))
    h.addAssign(sand.mul(fbm(p.mul(46)).mul(0.008)))
    // charcoal crumbs, thick near the fires and the heap
    const cv = voronoi(p.mul(120).add(fbm(p.mul(9)).mul(3))).toVar()
    const ch = hash21(cv.yz).toVar()
    const crumb = smoothstep(0.3, 0.06, cv.x.add(vnoise(p.mul(500)).mul(0.25)).add(vnoise(p.mul(160)).mul(0.12))).mul(step(float(0.975).sub(fires.mul(0.4)), ch)).toVar()
    alb.assign(mixN(alb, vec3(0.025, 0.023, 0.022), crumb.mul(0.6)))
    h.addAssign(crumb.mul(0.004))
    // spilled bronze: solidified droplets round the mould, a few trodden toward the furnace
    const bv = voronoi(p.mul(95).add(5)).toVar()
    const drop = smoothstep(0.2, 0.11, bv.x).mul(step(float(0.985).sub(exp(dM.mul(-4)).mul(0.3)), hash21(bv.yz))).mul(smoothstep(1.1, 0.3, dM)).toVar()
    alb.assign(mixN(alb, vec3(0.86, 0.5, 0.2), drop))
    h.addAssign(drop.mul(smoothstep(0.2, 0.0, bv.x)).mul(0.006))
    // the scrape the blade is laid in
    const pq = vec2(p.x.sub(PIT[0]).mul(0.966).sub(p.y.sub(PIT[1]).mul(0.259)), p.y.sub(PIT[1]).mul(0.966).add(p.x.sub(PIT[0]).mul(0.259)))
    const scrape = smoothstep(1.0, 0.55, length(pq.div(vec2(0.36, 0.085))).add(g.sub(0.5).mul(0.3))).mul(W.cover.min(1)).toVar()
    h.subAssign(scrape.mul(0.012))
    alb.assign(mixN(alb, vec3(0.13, 0.1, 0.075).mul(f.mul(0.5).add(0.7)), scrape.mul(0.85)))
    // years: a pale film of dust and fallen daub over everything, green in the damp low places
    const film = W.decay.mul(smoothstep(0.25, 0.75, fbm(p.mul(11).add(20)).add(W.decay.mul(0.45)))).toVar()
    alb.assign(mixN(alb, vec3(0.3, 0.23, 0.16).mul(f.mul(0.3).add(0.8)), film.mul(0.6)))
    alb.assign(mixN(alb, vec3(0.07, 0.1, 0.04).mul(vnoise(p.mul(400)).mul(0.6).add(0.6)), W.decay.mul(smoothstep(0.5, 0.42, g)).mul(smoothstep(0.5, 0.72, fbm(p.mul(16).add(31)).add(vnoise(p.mul(120)).mul(0.15)))).mul(0.55)))
    const N = bump(P, vec3(0, 1, 0) as V3, h as F, 1.6)
    const metal = drop.mul(0.85)
    return fin(shade(P, N, alb as V3, mixN(float(0.92), float(0.3), drop) as F, { metal: metal as F }), P)
  })()
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(9, 6), groundMat), -0.8, 0, 0.2)
  ground.rotation.x = -Math.PI / 2

  // ---------------------------------------------------------------- walls of wattle and daub, the doorway, the roof
  const wallMat = new THREE.NodeMaterial()
  wallMat.side = THREE.DoubleSide
  wallMat.fragmentNode = Fn(() => {
    const P = positionWorld as V3
    const Ng = normalize(normalWorld.mul(faceDirection)).toVar()
    const u = mixN(P.x, P.z, step(0.5, abs(Ng.x)))
    const p = vec2(u, P.y).toVar()
    Discard(abs(P.x.sub(DOOR.x)).lessThan(DOOR.hw).and(P.y.lessThan(DOOR.top)).and(abs(Ng.z).greaterThan(0.5)))
    const g = fbm(p.mul(vec2(3, 5))).toVar()
    // the daub has come away in places and the woven hazel shows: rods over and under upright stakes
    const bare = smoothstep(0.56, 0.62, fbm(p.mul(1.7).add(4)).add(W.decay.mul(0.22)).add(smoothstep(0.5, 0.0, P.y).mul(0.12))).toVar()
    const col = floor(p.x.div(0.16))
    const wy = p.y.add(fract(col.mul(0.5)).mul(0.07))
    const weave = sin(wy.mul(90)).mul(0.5).add(0.5).toVar()
    const stake = pow(sin(p.x.mul(19.63)).mul(0.5).add(0.5), 8).toVar()
    const wattle = mixN(vec3(0.05, 0.035, 0.02), vec3(0.2, 0.14, 0.08), weave.mul(vnoise(p.mul(vec2(40, 300))).mul(0.5).add(0.6))).mul(stake.mul(0.6).oneMinus())
    const crack = smoothstep(0.02, 0.0, abs(fbm(p.mul(vec2(4, 6)).add(9)).sub(0.5))).mul(0.6)
    const daub = mixN(vec3(0.2, 0.16, 0.12), vec3(0.36, 0.3, 0.23), g).mul(vnoise(p.mul(70)).mul(0.2).add(0.88)).mul(crack.oneMinus())
    // soot gathers under the thatch
    const soot = smoothstep(0.7, 2.1, P.y.add(g.mul(0.5))).mul(0.85)
    const alb = mixN(daub, wattle, bare).mul(soot.oneMinus())
    const h = mixN(g.mul(0.01).sub(crack.mul(0.006)), weave.mul(0.014).add(stake.mul(0.012)).sub(0.02), bare)
    const N = bump(P, Ng as V3, h as F, 1.2)
    return fin(shade(P, N, alb as V3, 0.92), P)
  })()
  add(new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), wallMat), -0.8, 1.6, DOOR.z)
  add(new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat), -3.6, 1.6, 0.4).rotation.y = Math.PI / 2
  add(new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat), 2.3, 1.6, 0.4).rotation.y = -Math.PI / 2
  // outside: overexposed day, a line of trees
  const outMat = new THREE.NodeMaterial()
  outMat.fragmentNode = Fn(() => {
    const p = positionLocal.xy
    const trees = smoothstep(0.02, -0.02, p.y.sub(0.1).sub(fbm(vec2(p.x.mul(5), 2)).mul(0.5)))
    return vec4(W.doorCol.mul(mixN(float(1.15), float(0.22), trees)).mul(smoothstep(-0.75, -0.6, p.y).mul(0.6).add(0.4)), 1)
  })()
  add(new THREE.Mesh(new THREE.PlaneGeometry(4, 3), outMat), DOOR.x - 0.6, 0.75, DOOR.z - 2.2)
  // posts, a lintel, rafters under the thatch
  for (const [x, z, sd] of [[-2.7, -1.75, 31], [DOOR.x - DOOR.hw - 0.07, DOOR.z + 0.05, 32], [DOOR.x + DOOR.hw + 0.07, DOOR.z + 0.05, 33], [1.5, -1.75, 34], [0.25, -1.9, 35]]) add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.05, 0.065, 2.7, 10, 12), sd, 0.012, 3), M.bark), x, 1.35, z)
  add(rod(1.1, 0.05, 0.045, M.bark, 36, 0.008), DOOR.x, DOOR.top + 0.04, DOOR.z + 0.05).rotation.z = Math.PI / 2
  // the wall is a hand's breadth thick: daub reveals either side of the opening
  for (const sg of [-1, 1]) add(new THREE.Mesh(knead(roundBox(0.07, DOOR.top, 0.16, 0.02), 37 + sg, 0.006, 14), wallMat), DOOR.x + sg * (DOOR.hw + 0.035), DOOR.top / 2, DOOR.z + 0.06)
  // a hide hung over the doorway, pushed aside to the right and hooked; its rolled top over the lintel
  const flapG = knead(new THREE.PlaneGeometry(FLAP - (DOOR.x - DOOR.hw) + 0.06, DOOR.top + 0.05, 10, 24), 38, 0.012, 7)
  const flap = add(new THREE.Mesh(flapG, solid("leather", { two: true })), (FLAP + DOOR.x - DOOR.hw - 0.06) / 2, DOOR.top / 2 + 0.01, DOOR.z + 0.15)
  flap.rotation.y = 0.05
  const flapX0 = flap.position.x
  add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.035, 0.035, DOOR.hw * 2 + 0.16, 12, 8), 39, 0.008, 9), M.leather), DOOR.x, DOOR.top + 0.0, DOOR.z + 0.15).rotation.z = Math.PI / 2
  for (let i = 0; i < 7; i++) {
    const r = add(rod(4.6, 0.045, 0.035, M.wood, 40 + i, 0.01), -3.1 + i * 0.85, 2.25, -0.3)
    r.rotation.x = 1.12
  }
  const roof = add(new THREE.Mesh(new THREE.PlaneGeometry(10, 5), solid("bast", { two: true })), -0.8, 2.33, -0.3)
  roof.rotation.x = 1.12 - Math.PI
  // things hung on the wall and stood against it: withies, a coil of bast, tongs of green wood, a hide bag, pots
  const hang = add(new THREE.Group(), 0, 0, DOOR.z + 0.07)
  for (let i = 0; i < 5; i++) add(rod(1.3 + (i % 3) * 0.2, 0.012, 0.007, M.wood, 50 + i, 0.012), 0.55 + i * 0.045, 0.72 + (i % 3) * 0.1, 0.02 + (i % 2) * 0.02, hang).rotation.z = 0.06 - i * 0.035
  add(new THREE.Mesh(knead(new THREE.TorusGeometry(0.12, 0.028, 8, 22), 56, 0.01, 20), M.bast), 1.05, 1.32, 0.03, hang)
  add(new THREE.Mesh(knead(new THREE.TorusGeometry(0.1, 0.02, 8, 22), 57, 0.012, 20), M.bast), 1.07, 1.3, 0.06, hang).rotation.z = 0.5
  for (const sgn of [1, -1]) add(rod(0.7, 0.012, 0.008, M.wood, 58, 0.006), -0.05 + sgn * 0.03, 1.15, 0.03, hang).rotation.z = sgn * 0.09
  add(new THREE.Mesh(knead(new THREE.SphereGeometry(0.13, 16, 12), 59, 0.03, 9), M.leather), -0.4, 1.2, 0.08, hang).scale.set(1, 1.5, 0.5)
  for (const x of [-0.05, 1.05, -0.4]) add(rod(0.09, 0.012, 0.01, M.wood, 60, 0.001), x, 1.48, 0.04, hang).rotation.x = Math.PI / 2
  const potProf = [[0.001, 0], [0.07, 0.01], [0.11, 0.09], [0.1, 0.17], [0.06, 0.2], [0.07, 0.23]]
  for (const [x, z, sc, sd] of [[1.25, -1.8, 1.5, 61], [1.62, -1.6, 1.1, 62], [1.05, -1.55, 0.8, 63], [-2.65, -1.85, 1.7, 64]]) add(new THREE.Mesh(knead(lathe(potProf, 18), sd, 0.006, 20), M.clay), x, 0, z).scale.setScalar(sc)
  // a heap of charcoal in the corner and a basket of ore
  const lump = knead(new THREE.IcosahedronGeometry(1, 1), 5, 0.22, 2)
  const coal = (cx: number, cz: number, r: number, h: number, n: number, seed: number, y0 = 0, s0 = 0.011) => {
    const im = new THREE.InstancedMesh(lump, M.char, n)
    const R = rng(seed), o = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r
      o.position.set(cx + Math.cos(a) * rr, y0 + R() * h * (1 - rr / r) + 0.008, cz + Math.sin(a) * rr)
      o.rotation.set(R() * 6, R() * 6, R() * 6)
      o.scale.set(s0 * (0.8 + R()), s0 * (0.7 + R() * 0.8), s0 * (0.8 + R()))
      o.updateMatrix()
      im.setMatrixAt(i, o.matrix)
    }
    im.frustumCulled = false
    scene.add(im)
    return im
  }
  coal(-2.95, -1.5, 0.55, 0.42, 500, 7, 0, 0.028)
  coal(FUR[0], FUR[2], 0.17, 0.07, 380, 5, 0.2)
  coal(FUR[0] - 0.2, FUR[2] + 0.42, 0.3, 0.02, 90, 8, 0, 0.012)
  coal(WX + 0.1, ZW + 0.5, 0.5, 0.015, 60, 9, 0, 0.009)

  // ---------------------------------------------------------------- the bowl furnace, the bloomery, bellows
  const furG = add(new THREE.Group(), FUR[0], 0, FUR[2])
  add(new THREE.Mesh(knead(lathe([[0.3, 0], [0.29, 0.14], [0.24, 0.3], [0.19, 0.34], [0.165, 0.33], [0.19, 0.2], [0.17, 0.08], [0.001, 0.06]], 30), 14, 0.014, 8), M.coarse), 0, 0, 0, furG)
  // a shaft with an arch at its foot where the bloom comes out: the arch is drawn in the wall's own shader
  const blmMat = new THREE.NodeMaterial()
  blmMat.fragmentNode = Fn(() => {
    const pl = positionLocal
    const P = positionWorld as V3
    const N0 = normalize(normalWorld).toVar()
    const g = fbm3(pl.mul(30)).toVar()
    const a = dot(normalize(pl.xz), vec2(MDIR[0], MDIR[1]))
    const lat = sqrt(max(float(1).sub(a.mul(a)), 0)).mul(length(pl.xz))
    const arch = smoothstep(0.012, -0.012, length(vec2(lat.div(0.15), pl.y.sub(0.05).max(0).div(0.3))).sub(1).mul(0.15)).mul(step(0, a)).toVar()
    const rim = smoothstep(0.05, 0.0, abs(length(vec2(lat.div(0.15), pl.y.sub(0.05).max(0).div(0.3))).sub(1.12).mul(0.15))).mul(step(0, a)).mul(arch.oneMinus())
    const crack = smoothstep(0.009, 0.0, abs(fbm3(pl.mul(vec3(6, 3.5, 6)).add(7)).sub(0.5))).mul(smoothstep(0.3, 0.6, fbm3(pl.mul(2).add(3)))).toVar()
    const patch = smoothstep(0.55, 0.6, fbm3(pl.mul(4).add(11)))
    const soot = smoothstep(0.3, 1.2, pl.y.add(g.mul(0.4))).mul(0.8).add(rim.mul(0.6)).min(0.95)
    const alb = mixN(mixN(vec3(0.3, 0.2, 0.14), vec3(0.47, 0.34, 0.24), g), vec3(0.6, 0.5, 0.39), patch.mul(0.7)).mul(soot.oneMinus()).mul(crack.mul(0.85).oneMinus()).mul(arch.oneMinus())
    const N = bump(P, N0 as V3, g.mul(0.008).sub(crack.mul(0.01)).sub(arch.mul(0.05)) as F)
    // inside the arch: the charcoal bed, each lump its own heat, white at the heart
    const cv = voronoi(vec2(lat.mul(step(0, pl.x.mul(MDIR[1]).sub(pl.z.mul(MDIR[0]))).mul(2).sub(1)), pl.y).mul(46)).toVar()
    const own = hash21(cv.yz)
    const bed = W.breath.y.mul(0.5).add(0.3).mul(own.mul(0.9).add(0.25)).mul(smoothstep(0.5, 0.05, cv.x).mul(0.6).add(0.4)).mul(smoothstep(0.34, 0.05, pl.y).mul(0.7).add(0.3)).add(W.breath.y.mul(0.35).mul(smoothstep(0.2, 0.0, length(vec2(lat, pl.y.sub(0.12))))))
    const c = shade(P, N, alb as V3, 0.9).add(heatCol(bed as F).mul(arch)).add(heatCol(W.breath.y.mul(0.26).mul(crack).mul(smoothstep(0.4, 0.1, pl.y)) as F).mul(0.3))
    // the throat at the top glows up into the smoke
    return fin(c.add(heatCol(W.breath.y.mul(0.5)).mul(smoothstep(0.5, 0.9, normalLocal.y)).mul(smoothstep(0.22, 0.1, length(pl.xz)))) as V3, P)
  })()
  blmMat.side = THREE.DoubleSide
  const blm = add(new THREE.Mesh(knead(lathe([[0.36, 0], [0.33, 0.45], [0.26, 0.95], [0.21, 1.12], [0.15, 1.13], [0.17, 0.95], [0.001, 0.9]], 36), 15, 0.016, 7), blmMat), BLM[0], 0, BLM[2])
  // a tongue of tapped slag at the bloomery's foot
  const slagT = add(new THREE.Mesh(knead(new THREE.SphereGeometry(1, 20, 12), 16, 0.3, 3), M.iron), MOUTH[0] + 0.1, 0.004, MOUTH[2] + 0.12)
  slagT.scale.set(0.16, 0.018, 0.1)
  /** Two bag bellows on a clay tuyere: goatskin bags between a pair of boards, squeezed in turn. */
  const bellowsG: THREE.Group[] = []
  const bellows = (x: number, z: number, yaw: number) => {
    const g = add(new THREE.Group(), x, 0, z)
    g.rotation.y = yaw
    bellowsG.push(g)
    const tuy = add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.03, 0.045, 0.46, 12, 4, true), 21, 0.004), M.coarse), -0.34, 0.12, 0, g)
    tuy.rotation.z = 1.36
    const bags = [-0.13, 0.13].map((bz, i) => {
      const b = add(new THREE.Mesh(knead(new THREE.SphereGeometry(1, 24, 16), 22 + i, 0.07, 4), M.leather), 0, 0.13, bz, g)
      const nz = add(rod(0.24, 0.03, 0.016, M.wood, 24 + i), -0.17, 0.08, bz * 0.6, g)
      nz.rotation.z = 1.4
      nz.rotation.y = -bz * 1.2
      const top = add(new THREE.Mesh(knead(roundBox(0.24, 0.016, 0.17, 0.006), 26 + i, 0.002, 30), M.wood), 0, 0.26, bz, g)
      const grip = add(rod(0.2, 0.012, 0.012, M.wood, 28 + i, 0.002), 0.02, 0.03, 0, top)
      grip.rotation.x = Math.PI / 2
      add(new THREE.Mesh(roundBox(0.25, 0.014, 0.18, 0.006), M.wood), 0, 0.008, bz, g)
      return { b, top }
    })
    return (phase: number, power: number) => {
      for (let i = 0; i < 2; i++) {
        const bg = bags[i]
        const sq = 0.5 + 0.5 * Math.sin(phase + i * Math.PI)
        const h = 0.12 - 0.07 * sq * power
        bg.b.scale.set(0.13 + 0.025 * sq * power, h, 0.095 + 0.02 * sq * power)
        bg.b.position.y = h + 0.012
        bg.top.position.y = h * 2 + 0.014
        bg.top.rotation.z = 0.08 - 0.2 * sq * power
      }
    }
  }
  const blowA = bellows(FUR[0] + 0.56, FUR[2] + 0.04, 0.1), blowB = bellows(BLM[0] + 0.56, BLM[2] - 0.06, 0.1)
  // spent crucibles by the furnace, one broken; a hammerstone
  const crProf = [[0.001, -0.075], [0.04, -0.072], [0.062, -0.03], [0.066, 0.0], [0.052, 0.0], [0.048, -0.03], [0.03, -0.058], [0.001, -0.06]]
  for (const [x, z, rx, rz, sd] of [[0.34, 0.2, 0.2, 1.9, 71], [0.47, 0.3, 0.1, 0.2, 72], [1.02, 0.1, -1.5, 0.3, 73]]) {
    const c = add(new THREE.Mesh(knead(lathe(crProf, 20), sd, 0.004, 40), M.cruc), FUR[0] + x - 0.5, 0.072, FUR[2] + z + 0.3)
    c.rotation.set(rx, 0, rz)
    if (rz > 1) c.position.y = 0.05
  }

  // ---------------------------------------------------------------- the mould
  const uHW = uniformArray(HWS, "float")
  const hwAt = (y: F): F => {
    const k = sat(y.div(MH) as F).mul(HWN - 1)
    const i = floor(k)
    return mixN(uHW.element(int(i)) as unknown as F, uHW.element(int(min(i.add(1), HWN - 1))) as unknown as F, fract(k)) as F
  }
  const mouldG = add(new THREE.Group(), MX, MY0, 0)
  const faceMat = new THREE.NodeMaterial()
  faceMat.fragmentNode = Fn(() => {
    const x = positionLocal.x, y = positionLocal.y.add(MH / 2).toVar()
    const inValve = step(abs(x), MW / 2).mul(step(0, y))
    const g = fbm(positionLocal.xy.mul(60)).toVar()
    const d = abs(x).sub(hwAt(y as F)).toVar()
    const inside = smoothstep(0.0009, -0.0009, d).mul(inValve).toVar()
    // the wrap: coarse, chaff-tempered; bast cords cut through between it and the valve
    const chaff = smoothstep(0.7, 0.8, vnoise(positionLocal.xy.mul(vec2(120, 480))))
    const wrap = mixN(mixN(vec3(0.22, 0.12, 0.07), vec3(0.34, 0.2, 0.12), g), vec3(0.5, 0.4, 0.27), chaff.mul(0.5)).toVar()
    const cy = fract(y.div(0.052)).sub(0.5).mul(0.052)
    const cord = smoothstep(0.0062, 0.0045, length(vec2(abs(x).sub(MW / 2 + 0.0075), cy.mul(0.8))))
    wrap.assign(mixN(wrap, vec3(0.2, 0.15, 0.07).mul(g.add(0.5)), cord))
    // the valve: fine pale clay, sooted in the matrix, reddened where the metal heated it
    const near = exp(max(d, 0).mul(-85)).mul(step(y.sub(0.02), W.level)).toVar()
    const fine = mixN(vec3(0.38, 0.24, 0.15), vec3(0.5, 0.34, 0.22), g).mul(vnoise(positionLocal.xy.mul(700)).mul(0.1).add(0.95)).toVar()
    fine.assign(mixN(fine, vec3(0.5, 0.25, 0.17), near.mul(W.burnt).mul(0.75)))
    fine.mulAssign(smoothstep(0.0, 0.0018, abs(abs(x).sub(MW / 2))).mul(0.45).add(0.55)) // the joint with the wrap
    // cracks, just before it is broken off
    const cr = smoothstep(0.012, 0.0, abs(fbm(positionLocal.xy.mul(vec2(9, 5)).add(7)).sub(0.5))).mul(W.crack)
    const wall = smoothstep(-0.0045, 0.0, d).mul(inside).mul(mixN(float(0.55), float(1.25), step(0, x)))
    const matrix = vec3(0.13, 0.11, 0.1).mul(g.mul(0.5).add(0.75)).mul(wall.mul(1.4).add(0.8))
    const alb = mixN(wrap, mixN(fine, matrix, inside), inValve).mul(cr.mul(0.8).oneMinus()).toVar()
    const metal = inside.mul(smoothstep(0.003, -0.003, y.sub(W.level))).toVar()
    alb.assign(mixN(alb, vec3(0.5, 0.35, 0.19).mul(g.mul(0.4).add(0.7)), metal))
    const P = positionWorld as V3
    const N = bump(P, vec3(0, 0, 1) as V3, g.mul(0.003).sub(inside.mul(metal.oneMinus()).mul(0.02)).sub(cr.mul(0.004)) as F)
    const c = shade(P, N, alb as V3, 0.9, { shadow: false }).toVar()
    const crust = smoothstep(0.38, 0.62, fbm(positionLocal.xy.mul(vec2(140, 70))).add(W.mouldT.oneMinus().mul(0.35))).mul(smoothstep(0.9, 0.4, W.mouldT))
    c.addAssign(heatCol(W.mouldT.mul(g.mul(0.2).add(0.9)).mul(crust.mul(0.42).oneMinus()) as F).mul(metal).mul(crust.mul(0.5).oneMinus()))
    // the metal shines through the clay where the wall is thin, and lights the empty cavity above it
    c.addAssign(heatCol(W.mouldT.mul(0.6).mul(near) as F).mul(inside.oneMinus()).mul(inValve).mul(0.55))
    c.addAssign(heatCol(W.mouldT.mul(0.5).mul(exp(max(y.sub(W.level), 0).mul(-14))) as F).mul(inside).mul(metal.oneMinus()).mul(0.5).mul(W.flow.mul(0.6).add(0.4)))
    c.addAssign(heatCol(float(1)).mul(metal).mul(smoothstep(0.006, 0.0, abs(y.sub(W.level)))).mul(W.flow).mul(0.6)) // the meniscus
    return fin(c as V3, P)
  })()
  add(new THREE.Mesh(new THREE.PlaneGeometry(MW + WRAP * 2, MH - 0.015), faceMat), 0, MH / 2 - 0.0075, 0.0006, mouldG)
  /** The outer wrap of one half: coarse clay smeared on by hand over the cords, whose ribs show through; the heat comes through it late. */
  const wrapMat = (inner: boolean) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const pl = positionLocal
      const P = positionWorld as V3
      const g = fbm3(pl.mul(30)).toVar()
      const rib = pow(sin(pl.y.div(0.052).mul(6.2832)).mul(0.5).add(0.5), 3).toVar()
      const smear = fbm(vec2(pl.x.mul(8), pl.y.mul(40))).toVar()
      const finger = sin(pl.y.mul(210).add(smear.mul(9))).mul(0.5).add(0.5)
      const lute = smoothstep(0.014, 0.0, abs(fbm(pl.xy.mul(vec2(11, 6)).add(13)).sub(0.5))).mul(smoothstep(0.4, 0.6, fbm(pl.xy.mul(3).add(2)))).toVar()
      const sootT = smoothstep(0.1, 0.32, pl.y.add(g.mul(0.12))).mul(0.65)
      const alb = mixN(vec3(0.27, 0.15, 0.09), vec3(0.45, 0.28, 0.17), g).mul(rib.mul(0.25).oneMinus()).mul(smear.mul(0.3).add(0.8)).mul(sootT.oneMinus()).mul(lute.mul(0.75).oneMinus()).toVar()
      const pv = voronoi(pl.xy.mul(70).add(pl.z.mul(40))).toVar()
      const pit2 = smoothstep(0.16, 0.04, pv.x).mul(step(0.7, hash21(pv.yz))).toVar()
      alb.mulAssign(pit2.mul(0.35).oneMinus())
      const h = rib.mul(0.004).add(finger.mul(0.0012)).add(g.mul(0.007)).sub(lute.mul(0.003)).sub(pit2.mul(0.003)).toVar()
      const glow = vec3(0, 0, 0).toVar()
      if (inner) {
        // the parting face of the half that was drawn away: fine clay, the other half of the cavity, soot
        const face = smoothstep(0.6, 0.9, normalLocal.z.negate()).toVar()
        const y = pl.y.add(MH / 2 - 0.01)
        const d = abs(pl.x).sub(hwAt(y as F))
        const cav = smoothstep(0.001, -0.001, d).mul(step(abs(pl.x), MW / 2)).mul(face).toVar()
        alb.assign(mixN(alb, mixN(mixN(vec3(0.32, 0.19, 0.12), vec3(0.44, 0.28, 0.18), g), vec3(0.09, 0.08, 0.07), cav), face.mul(step(abs(pl.x), MW / 2))))
        h.assign(mixN(h, cav.mul(-0.02), face))
      } else glow.assign(heatCol(W.mouldT.mul(0.5).mul(smoothstep(0.035, 0.0, abs(pl.x))).mul(W.burnt).mul(smoothstep(0.3, -0.25, pl.y.sub(W.level).add(MH / 2))) as F).mul(0.5))
      const N = bump(P, normalize(normalWorld) as V3, h as F, 1.8)
      return fin(shade(P, N, alb as V3, 0.88, { shadow: false }).add(glow) as V3, P)
    })()
    return m
  }
  add(new THREE.Mesh(knead(roundBox(MW + WRAP * 2, MH - 0.02, 0.085, 0.028), 81, 0.004, 22), wrapMat(false)), 0, MH / 2 - 0.01, -0.0425, mouldG)
  add(new THREE.Mesh(roundBox(MW + 0.004, MH, MD, 0.012), M.clay), 0, MH / 2, -MD / 2, mouldG)
  // bast cords round the wrap, knotted at the side; lumps of luting clay pressed along the seam
  for (let i = 0; i < 5; i++) {
    const c = add(new THREE.Mesh(knead(new THREE.TorusGeometry(0.5, 0.036, 6, 20, Math.PI), 82 + i, 0.01, 30), M.bast), 0, 0.08 + i * 0.118 + (i % 2) * 0.012, 0.002, mouldG)
    c.scale.set((MW + WRAP * 2 + 0.012) * 1, 0.2, 0.2)
    c.rotation.set(-Math.PI / 2, 0, 0.03 - (i % 3) * 0.03)
  }
  for (let i = 0; i < 9; i++) add(new THREE.Mesh(knead(new THREE.SphereGeometry(1, 10, 8), 88 + i, 0.25, 3), M.clay), (i % 2 ? 1 : -1) * (MW / 2 + WRAP + 0.001), 0.05 + i * 0.062, -0.006, mouldG).scale.set(0.012, 0.022 + (i % 3) * 0.006, 0.014)
  for (const sg of [-1, 1]) add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.0075, 0.0085, MH - 0.03, 9, 40), 150 + sg, 0.0028, 40), M.clay), sg * (MW / 2 + WRAP + 0.002), MH / 2, 0.0, mouldG)
  // the near half: swung open on its long edge and left standing, its parting face to the pour
  const hinge = add(new THREE.Group(), MX - (MW / 2 + WRAP), MY0, 0)
  const nearHalf = add(new THREE.Mesh(knead(roundBox(MW + WRAP * 2, MH - 0.02, 0.085, 0.028), 81, 0.004, 22), wrapMat(true)), MW / 2 + WRAP, MH / 2 - 0.01, 0.0425, hinge)
  void nearHalf
  // the bed of sand it stands in, heaped against its foot; stones to steady it
  add(new THREE.Mesh(knead(lathe([[0.001, 0.05], [0.1, 0.045], [0.2, 0.02], [0.32, 0.0]], 28), 95, 0.012, 12), M.sand), MX, -0.002, -0.03).scale.set(1, 1, 0.8)
  add(new THREE.Mesh(rock(11, 0.09, 0.07, 0.08), M.stone), MX - 0.2, 0.045, -0.16)
  add(new THREE.Mesh(rock(12, 0.07, 0.06, 0.07), M.stone), MX + 0.16, 0.04, -0.14)
  add(new THREE.Mesh(rock(13, 0.13, 0.1, 0.12), M.stone), ROCK[0] - 0.02, ROCK[1] - 0.04, ROCK[2])

  // ---------------------------------------------------------------- the crucible on its withies, and the stream
  const cruc = add(new THREE.Group())
  const pot = add(new THREE.Mesh(knead(lathe(crProf, 24), 70, 0.003, 40), M.cruc), 0.066, 0, 0, cruc) // (pivots on its lip)
  const meltMat = new THREE.NodeMaterial()
  meltMat.fragmentNode = vec4(heatCol(float(0.98)).mul(vnoise(positionLocal.xz.mul(90).add(W.t)).mul(0.25).add(0.8)), 0)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.012, 20), meltMat), 0, -0.016, 0, pot)
  const withies = add(new THREE.Group())
  for (const z of [0.062, -0.062]) add(rod(1.5, 0.012, 0.009, M.wood, 74, 0.006), 0.36, 0.66, z, withies).rotation.z = -0.5
  add(new THREE.Mesh(knead(new THREE.TorusGeometry(0.066, 0.008, 8, 20), 75, 0.002, 60), M.wood), 0, 0, 0, withies).rotation.x = Math.PI / 2
  const NS = 48, NA = 8
  const sg = new THREE.BufferGeometry()
  {
    const pos: number[] = [], idx: number[] = []
    for (let j = 0; j <= NS; j++) for (let i = 0; i < NA; i++) pos.push(j / NS, (i / NA) * Math.PI * 2, 0)
    for (let j = 0; j < NS; j++) for (let i = 0; i < NA; i++) {
      const a = j * NA + i, b = j * NA + ((i + 1) % NA)
      idx.push(a, b, a + NA, b, b + NA, a + NA)
    }
    sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    sg.setIndex(idx)
  }
  const streamMat = new THREE.NodeMaterial()
  {
    // a falling jet: a parabola from the lip; by continuity its radius falls as its speed rises; it beads as the flow dies
    const s = positionGeometry.x, a = positionGeometry.y
    const tau = s.mul(W.fall)
    const vel = W.v0.add(vec3(0, tau.mul(-9.8), 0))
    const c = W.lip.add(W.v0.mul(tau)).add(vec3(0, tau.mul(tau).mul(-4.9), 0))
    const on = step(W.tail, s).mul(step(s, W.head))
    const bead = sin(s.mul(34).sub(W.t.mul(26))).mul(0.5).add(0.5)
    const r = float(0.0085).mul(sqrt(length(W.v0).div(length(vel)))).mul(mixN(float(1), bead.mul(1.5).add(0.15), W.tail.mul(1.6).min(1).add(s.mul(0.12)))).mul(on).mul(sin(s.mul(9).add(W.t.mul(17))).mul(0.06).add(1))
    const T = normalize(vel)
    const side = normalize(vec3(T.y.negate(), T.x, 0))
    const n = side.mul(cos(a)).add(vec3(0, 0, 1).mul(sin(a)))
    streamMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(c.add(n.mul(r)), 1))
    const vN = n.toVarying()
    streamMat.fragmentNode = Fn(() => vec4(mixN(heatCol(float(0.72)), heatCol(float(1)), pow(max(normalize(vN).z, 0), 1.6)), 0))()
    streamMat.side = THREE.DoubleSide
  }
  const stream = add(new THREE.Mesh(sg, streamMat))
  stream.frustumCulled = false

  // ---------------------------------------------------------------- the casting: blade, flash, jet
  const bronzeMat = new THREE.NodeMaterial()
  bronzeMat.side = THREE.DoubleSide
  bronzeMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const P = positionWorld as V3, pl = positionLocal
    const N = normalize(normalWorld.mul(faceDirection)).toVar()
    const g = fbm(pl.xy.mul(70)).toVar()
    const f = vnoise(pl.xy.mul(900)).toVar()
    // rivet holes in the hilt plate
    const hole = float(1).toVar()
    for (const [hx, hy] of [[0, 0.475], [-0.006, 0.505], [0.006, 0.505]]) hole.mulAssign(smoothstep(0.0022, 0.0032, length(vec2(pl.x.sub(hx), pl.y.add(0.3).sub(hy)))))
    const edge = abs(st.x)
    // years in the ground: red-brown cuprite all over, then malachite from the recesses and edges, a little azurite
    const brown = smoothstep(0.0, 0.3, W.years).mul(g.mul(0.3).add(0.75))
    const want = edge.pow(3).mul(0.5).add(smoothstep(0.72, 0.8, st.y).mul(0.3)).add(hole.oneMinus().mul(0.7)).add(smoothstep(0.2, 0.36, edge).mul(smoothstep(0.72, 0.52, edge)).mul(0.28)).add(smoothstep(0.012, 0.0, abs(st.y.mul(MH).sub(YS))).mul(0.4)).add(g.mul(0.3)).add(f.mul(0.12))
    const green = smoothstep(0.12, -0.05, float(1.25).sub(W.years.mul(1.45)).sub(want)).toVar()
    const cv = voronoi(pl.xy.mul(260)).toVar()
    const blue = step(0.985, hash21(cv.yz)).mul(smoothstep(0.4, 0.15, cv.x)).mul(green)
    const mal = mixN(mixN(vec3(0.09, 0.2, 0.12), vec3(0.3, 0.46, 0.3), vnoise(pl.xy.mul(310)).mul(0.7).add(g.mul(0.3))), vec3(0.42, 0.5, 0.36), smoothstep(0.55, 0.8, fbm(pl.xy.mul(60).add(9))).mul(0.5))
    const cover = max(sat(brown as F), green).toVar()
    const cr = voronoi(pl.xy.mul(950).add(g.mul(2))).toVar()
    const nod = smoothstep(0.42, 0.08, cr.x).toVar()
    const pits = smoothstep(0.22, 0.48, cr.x).mul(green).mul(smoothstep(1.0, 0.55, green.add(nod.mul(0.2)))).toVar()
    const pat = mixN(mixN(mixN(vec3(0.3, 0.14, 0.09), vec3(0.2, 0.11, 0.08), g), mixN(mal.mul(nod.mul(0.25).add(0.8)), vec3(0.1, 0.18, 0.4), blue), green), vec3(0.36, 0.1, 0.05), pits.mul(0.65)).mul(smoothstep(0.2, 0.8, fbm(pl.xy.mul(25))).mul(0.4).add(0.7))
    // the metal itself: an as-cast skin, bright where the flash was struck off
    const skin = smoothstep(0.35, 0.7, g).mul(0.14)
    const metal = vec3(0.92, 0.5, 0.17).mul(skin.oneMinus())
    const Nb = bump(P, N as V3, g.mul(0.0012).add(green.mul(nod).mul(0.0016)).add(green.mul(vnoise(pl.xy.mul(310))).mul(0.0008)) as F, 1.4)
    const lit = mixN(shade(P, Nb, metal as V3, mixN(float(0.34), float(0.6), skin) as F, { metal: 1 }), shade(P, Nb, pat as V3, 0.95), cover).mul(hole.mul(0.85).add(0.15)).toVar()
    // a bright edge where the doorway's light runs along the bevels: it reads as metal, not as wood
    const Vb = normalize(cameraPosition.sub(P))
    const Rb = Vb.negate().sub(Nb.mul(dot(Nb, Vb.negate()).mul(2)))
    lit.addAssign(metal.mul(W.doorCol).mul(pow(max(dot(Rb, normalize(LDv.negate())), 0), 10).mul(doorMask(P).mul(1.0).add(0.1)).add(0.03)).mul(cover.mul(0.85).oneMinus()))
    lit.addAssign(heatCol(W.castT.mul(g.mul(0.1).add(0.95)) as F))
    return fin(lit as V3, P)
  })()
  const cast = add(new THREE.Group(), MX, MY0 + 0.3, 0.004)
  cast.rotation.order = "YXZ" // laid flat, then turned on the floor (XYZ tipped one end 15 degrees into the air)
  const bladeM = add(new THREE.Mesh(castGeo(TIP, YT, 110, 0, (y) => (y > YS ? 0.0028 : 0.0042), 0.3), bronzeMat), 0, 0, 0, cast)
  const flashM = add(new THREE.Mesh(castGeo(TIP - 0.004, YT, 60, 0.007, () => 0.0006, 0.3), bronzeMat), 0, 0, 0, cast)
  const jetM = add(new THREE.Mesh(castGeo(YT, MH - 0.012, 14, 0, () => 0.02, 0.3), bronzeMat), 0, 0, 0, cast)
  void bladeM
  // loose earth pulled over the blade: it thins as the years blow it off
  const coverMat = new THREE.NodeMaterial()
  coverMat.fragmentNode = Fn(() => {
    const P = positionWorld as V3
    const p = P.xz
    const g = fbm(p.mul(38)).toVar()
    const edge = length(positionLocal.xy)
    Discard(g.mul(0.75).add(edge.mul(0.5)).add(fbm(p.mul(11).add(4)).mul(0.45)).add(vnoise(p.mul(260)).mul(0.14)).sub(0.2).greaterThan(W.cover))
    const alb = mixN(vec3(0.12, 0.095, 0.07), vec3(0.3, 0.25, 0.18), vnoise(p.mul(300))).mul(g.mul(0.5).add(0.7))
    const dusty = mixN(alb, vec3(0.33, 0.3, 0.25), W.decay.mul(0.6))
    return fin(shade(P, bump(P, vec3(0, 1, 0) as V3, g.mul(0.012).add(vnoise(p.mul(300)).mul(0.003)) as F, 2), dusty as V3, 0.95), P)
  })()
  const coverM = add(new THREE.Mesh(new THREE.CircleGeometry(1, 40), coverMat), PIT[0], 0.0095, PIT[1])
  coverM.rotation.set(-Math.PI / 2, 0, -0.262)
  coverM.scale.set(0.4, 0.1, 1)
  const earthM = solid("earth")
  const clod = knead(new THREE.IcosahedronGeometry(1, 1), 141, 0.22, 2.3)
  const AX = [0.966, -0.259], NX = [0.259, 0.966] //  along the blade (hilt +), across it, in x z
  const _o = new THREE.Object3D()
  const placeAt = (im: THREE.InstancedMesh, i: number, u: number, v: number, y: number, sx: number, sy: number, sz: number, R: () => number) => {
    _o.position.set(PIT[0] + u * AX[0] + v * NX[0], y, PIT[1] + u * AX[1] + v * NX[1])
    _o.rotation.set((R() - 0.5) * 0.8, R() * 6.28, (R() - 0.5) * 0.8)
    _o.scale.set(sx, sy, sz)
    _o.updateMatrix()
    im.setMatrixAt(i, _o.matrix)
  }
  {
    // the floor round the scrape: grit, crumbs and a few clods, heaped along the scrape's edge
    const N = 1400, im = new THREE.InstancedMesh(clod, earthM, N), R = rng(142)
    for (let i = 0; i < N; i++) {
      const rim = i < 800
      const a = R() * Math.PI * 2, rr = rim ? 1.0 + R() * R() * 0.45 : 1.1 + R() * 3.2
      const u = Math.cos(a) * rr * 0.31, v = Math.sin(a) * rr * (rim ? 0.07 : 0.09) * (rim ? 1 : 2.2)
      const sz = (i % 61 === 0 ? 0.008 + R() * 0.006 : 0.0012 + R() * R() * 0.005) * (rim ? 1.15 : 1)
      placeAt(im, i, u, v, sz * 0.35, sz * (0.8 + R() * 0.5), sz * (0.45 + R() * 0.3), sz * (0.8 + R() * 0.5), R)
    }
    im.frustumCulled = false
    scene.add(im)
  }
  // the soil over the blade: laid on as it is buried, worn away from the ends and edges first as the years pass
  const NOVER = 1100
  const over = new THREE.InstancedMesh(clod, earthM, NOVER)
  {
    const R = rng(143)
    const pts = Array.from({ length: NOVER }, () => {
      const u = -0.29 + R() * 0.56
      let v = (R() * 2 - 1) * 0.045
      // one bevel is left bare along the middle of the blade: from the start an edge of bronze catches the sun
      if (v > 0.016 && u > -0.17 && u < 0.19) v = -v
      return { u, v, k: Math.abs(v) / 0.045 * 0.45 + Math.abs(u + 0.01) / 0.28 * 0.35 + R() * 0.45, r: R() }
    }).sort((a, b) => a.k - b.k)
    pts.forEach((q, i) => {
      const sz = 0.0022 + q.r * 0.0038
      placeAt(over, i, q.u, q.v, 0.006 + sz * 0.3 + R() * 0.004, sz * 1.2, sz * 0.55, sz * 1.2, R)
    })
    over.frustumCulled = false
    scene.add(over)
  }
  // fine roots that find their way across the floor as it goes quiet
  const NROOT = 70
  const roots = new THREE.InstancedMesh(knead(new THREE.CylinderGeometry(0.0004, 0.00015, 1, 5, 14), 144, 0.0015, 9), M.wood, NROOT)
  {
    const R = rng(145)
    for (let i = 0; i < NROOT; i++) {
      const u = (R() - 0.5) * 0.9, v = (R() - 0.5) * 0.5
      _o.position.set(PIT[0] + u * AX[0] + v * NX[0], 0.0015, PIT[1] + u * AX[1] + v * NX[1])
      _o.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.1, 0, R() * 6.28)
      _o.rotation.order = "ZXY"
      _o.scale.set(1, 0.03 + R() * 0.07, 1)
      _o.updateMatrix()
      roots.setMatrixAt(i, _o.matrix)
    }
    _o.rotation.order = "XYZ"
    roots.frustumCulled = false
    scene.add(roots)
  }

  // ---------------------------------------------------------------- the anvil stone in its log, the quench trough
  add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.2, 0.23, ATOP - 0.09, 26, 10), 17, 0.012, 9), M.bark), WX, (ATOP - 0.09) / 2, ZW)
  add(new THREE.Mesh(rock(21, 0.17, 0.085, 0.14, 0.1), M.stone), WX, ATOP - 0.085 * 0.8, ZW)
  for (let i = 0; i < 3; i++) add(rod(0.2, 0.014, 0.004, M.wood, 97 + i, 0.001), WX + Math.cos(i * 2.2 + 0.4) * 0.185, ATOP - 0.1, ZW + Math.sin(i * 2.2 + 0.4) * 0.15).rotation.set(Math.sin(i * 2.2 + 0.4) * 0.2, 0, -Math.cos(i * 2.2 + 0.4) * 0.2) // wedges
  // a trough dug out of a half log
  const troughG = add(new THREE.Group(), TROUGH[0], 0, TROUGH[1])
  troughG.rotation.y = 1.3
  {
    const prof: number[][] = []
    for (let i = 0; i <= 12; i++) prof.push([0.15 * Math.sin((i / 12) * Math.PI), -0.15 * Math.cos((i / 12) * Math.PI)])
    const sh = new THREE.Shape()
    // a D section: bark outside, hollowed from the flat
    sh.absarc(0, 0, 0.16, Math.PI, 0, false)
    sh.lineTo(0.125, 0)
    sh.absarc(0, 0, 0.125, 0, Math.PI, true)
    sh.lineTo(-0.16, 0)
    const tg = knead(new THREE.ExtrudeGeometry(sh, { depth: 0.62, bevelEnabled: false, curveSegments: 14, steps: 8 }), 18, 0.006, 12)
    add(new THREE.Mesh(tg, solid("wood", { two: true })), 0, 0.165, -0.31, troughG)
    for (const z of [-0.3, 0.3]) add(new THREE.Mesh(knead(new THREE.CircleGeometry(0.15, 14, Math.PI, Math.PI), 19, 0.002), solid("bark", { two: true })), 0, 0.165, z, troughG)
  }
  const waterMat = new THREE.NodeMaterial()
  waterMat.fragmentNode = Fn(() => {
    const P = positionWorld as V3
    const p = P.xz
    const rip = sin(length(p.sub(vec2(TROUGH[0], TROUGH[1]))).mul(120).sub(W.t.mul(14))).mul(W.wet)
    const N = normalize(vec3(rip.mul(0.25).add(vnoise(p.mul(30).sub(W.t.mul(0.6))).sub(0.5).mul(0.08)), 1, vnoise(p.mul(40).add(W.t)).sub(0.5).mul(0.1)))
    // black water: only what is hot shows in it
    return fin(shade(P, N as V3, vec3(0.012, 0.016, 0.02) as V3, 0.12, { metal: 0.0 }).mul(3) as V3, P)
  })()
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.6), waterMat), 0, 0.13, 0, troughG).rotation.x = -Math.PI / 2

  // ---------------------------------------------------------------- the iron: one piece of metal from bloom to blade
  const ironMat = new THREE.NodeMaterial()
  {
    const p = positionGeometry
    const e = mixN(float(1), float(0.36), W.bar)
    const q = p.sign().mul(pow(abs(p), vec3(e, e, e))).toVar()
    const taper = mixN(float(1), sqrt(float(1).sub(smoothstep(0.1, 1.0, q.x.negate())).max(0.002)), W.blade)
    const n0 = normalGeometry
    const lumpy = fbm3(p.mul(2.6).add(3)).sub(0.5).mul(W.lump).add(fbm3(p.mul(7)).sub(0.5).mul(W.lump).mul(0.5))
    const local = vec3(q.x.mul(W.dim.x), q.y.mul(W.dim.y).mul(taper), q.z.mul(W.dim.z).mul(taper)).add(n0.mul(lumpy))
    ironMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix.mul(vec4(local, 1)))
    const vP = modelWorldMatrix.mul(vec4(local, 1)).xyz.toVarying() as V3
    const vL = p.toVarying() as V3
    const vN = modelWorldMatrix.mul(vec4(normalize(n0.div(W.dim.max(vec3(0.004)))), 0)).xyz.toVarying() as V3
    ironMat.fragmentNode = Fn(() => {
      const N = normalize(vN).toVar()
      const g = fbm3(vL.mul(vec3(3, 9, 9))).toVar()
      // pores of the sponge, hotter inside; slag stringers drawn out along the bar; scale that comes and goes with each blow
      const pv = voronoi(vL.xy.mul(7).add(vL.z.mul(5))).toVar()
      const pore = smoothstep(0.34, 0.12, pv.x).mul(W.lump.mul(45).min(1))
      const stringer = smoothstep(0.62, 0.7, vnoise(vec2(vL.x.mul(2.2), vL.y.mul(26).add(vL.z.mul(19))))).mul(W.bar)
      const scale = smoothstep(0.5, 0.62, fbm3(vL.mul(5.5).add(floor(W.blows).mul(3.7)))).mul(smoothstep(0.95, 0.5, W.ironT)).mul(smoothstep(0.0, 0.25, W.ironT).mul(0.7).add(0.3))
      const T = W.ironT.mul(g.mul(0.16).add(0.92)).mul(pore.mul(0.25).add(1)).mul(scale.mul(0.45).oneMinus()).mul(stringer.mul(0.2).oneMinus())
      const alb = mixN(mixN(vec3(0.16, 0.16, 0.17), vec3(0.3, 0.3, 0.31), g), vec3(0.035, 0.04, 0.05), max(scale, stringer.mul(0.7))).mul(pore.mul(0.6).oneMinus())
      const c = shade(vP, N as V3, alb as V3, mixN(float(0.5), float(0.18), W.wet) as F, { metal: 0.6, shadow: false }).add(heatCol(T as F)).toVar()
      const Vv = normalize(cameraPosition.sub(vP))
      const dM = hotP(2).sub(vP)
      const edge = pow(float(1).sub(abs(dot(N, Vv))), 3).mul(W.ironT.mul(3).oneMinus().max(0)).mul(W.wet.mul(1.5).add(0.6))
      c.addAssign(hotC(2).div(dot(dM, dM).add(0.07)).mul(0.5).add(W.doorCol.mul(0.12)).mul(edge))
      return fin(c as V3, vP)
    })()
  }
  const iron = add(new THREE.Mesh(new THREE.SphereGeometry(1, 56, 28), ironMat))
  iron.frustumCulled = false

  // ---------------------------------------------------------------- the smith: a whole man behind the anvil, hammer in the right hand, tongs in the left
  // The creature toolkit's figure (BUILD.md 5c), standing on the far side of the anvil and facing the lens. His
  // face is kept small in frame and lit from the side by the bloomery's mouth; the hands are seen in motion.
  const HUM = HU.makeHuman(HU.adultA)
  const SM = { x: WX + 0.05, z: ZW - 0.5 } //    where he stands (his right is -x)
  const smAim = makeAim([SM.x, 0, SM.z], [0, 0, 1])
  const smLook = { ...HU.humanLook(HUM, { skin: 0x6e4a36, hair: 0x120d0a, garment: "wrap", hide: 0x3e2c1e, dust: 0.6, clay: 0x2a2420, clayAmt: 0.45 }), wrap: 0.22 }
  /** Skin lit by what is hot: the bloomery's mouth and the iron (the nearer and brighter leads), the doorway's cold as the sky. */
  const smLights = (p: V3): Lights => {
    const dM = hotP(2).sub(p).toVar(), dI = hotP(1).sub(p).toVar()
    const FIRE = vec3(1.3, 0.67, 0.23)
    const cM = FIRE.mul(dot(hotC(2), vec3(0.3, 0.6, 0.1))).div(dot(dM, dM).mul(0.9).add(0.1)).mul(1.5).toVar(), cI = FIRE.mul(dot(hotC(1), vec3(0.3, 0.6, 0.1))).div(dot(dI, dI).mul(0.9).add(0.06)).toVar()
    const wI = dot(cI, vec3(0.3, 0.6, 0.1)).div(dot(cM.add(cI), vec3(0.3, 0.6, 0.1)).add(1e-4))
    return { key: normalize(mixN(normalize(dM), normalize(dI), wI)) as V3, keyCol: cM.add(cI) as V3, sky: vec3(0.06, 0.08, 0.13).mul(0.8).add(W.doorCol.mul(0.03)) as V3, bounce: cI.mul(0.12).add(vec3(0.02, 0.01, 0.004)) as V3 }
  }
  const boneR = { v: -1 }, boneL = { v: -1 }
  let skelHead: Float32Array = new Float32Array(0)
  // the hammer: authored with the handle on +y from the grip, the striking face on +x
  const FACE_L = new THREE.Vector3(0.085, 0.265, 0)
  const hammer = add(new THREE.Group())
  add(new THREE.Mesh(knead(new THREE.CylinderGeometry(0.012, 0.0145, 0.36, 10, 6), 140, 0.0012, 20), M.wood), 0, 0.11, 0, hammer)
  add(new THREE.Mesh(knead(roundBox(0.12, 0.04, 0.038, 0.006), 141, 0.0015, 40), M.iron), 0.025, 0.265, 0, hammer)
  // its rest-space frame: the handle runs from the little finger to the thumb, the face looks where the fingers point
  const qHam = new THREE.Quaternion()
  {
    const a = HUM.anchors.shaft
    const Y = new THREE.Vector3(a[0][0] - a[1][0], a[0][1] - a[1][1], a[0][2] - a[1][2]).normalize()
    const X = new THREE.Vector3(...HUM.anchors.fingers)
    X.addScaledVector(Y, -X.dot(Y)).normalize()
    qHam.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, new THREE.Vector3().crossVectors(X, Y)))
  }
  const GRIP_R: [number, number, number] = [(HUM.anchors.shaft[0][0] + HUM.anchors.shaft[1][0]) / 2, (HUM.anchors.shaft[0][1] + HUM.anchors.shaft[1][1]) / 2, (HUM.anchors.shaft[0][2] + HUM.anchors.shaft[1][2]) / 2]
  const GRIP_L: [number, number, number] = [GRIP_R[0], GRIP_R[1], -GRIP_R[2]]
  // the tongs: two reins (scaled to reach), a rivet and jaws, laid along +y from the left fist to the iron
  const tongs = add(new THREE.Group())
  const reins = add(new THREE.Group(), 0, 0, 0, tongs)
  for (const sgn of [1, -1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0065, 1, 8), M.iron), sgn * 0.007, 0.5, 0, reins).rotation.z = sgn * 0.012
  const jaws = add(new THREE.Group(), 0, 0, 0, tongs)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.026, 8), M.iron), 0, -0.05, 0, jaws).rotation.x = Math.PI / 2
  for (const sgn of [1, -1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.014), M.iron), -sgn * 0.012, -0.012, 0, jaws).rotation.z = -sgn * 0.14
  const _g = [0, 0, 0], _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _u = new THREE.Vector3()
  const Yax = new THREE.Vector3(0, 1, 0), Xax = new THREE.Vector3(1, 0, 0), QI = new THREE.Quaternion()
  /** Where the tongs' jaws are this frame (set before the figure is posed). */
  const tip = new THREE.Vector3()
  const smith = makeHerd({
    spec: HUM.spec, count: 1, path: smAim, lods: HU.HUMAN_LODS,
    material: (n, _lod, kind) => {
      const L = smLights(n.vW)
      const m = kind === "cards" ? featherMaterial(n, L, { ...smLook, base: 0x120d0a, belly: 0x120d0a, rough: 0.7, spec: 0.1, wrap: 0.3, rim: 0.03, bleed: 0x050403 }) : skinMaterial(n, L, smLook)
      const lit = (m.fragmentNode as unknown as V4).rgb as V3
      m.fragmentNode = Fn(() => {
        // the doorway behind him draws a cold line round the shoulders, arms and head
        const N = normalize(n.vN), V = normalize(cameraPosition.sub(n.vW))
        const toDoor = normalize(vec3(DOOR.x, 0.8, DOOR.z).sub(n.vW))
        const rim = pow(float(1).sub(max(dot(N, V), 0)), 2.5).mul(max(dot(N, toDoor), 0)).mul(doorMask(n.vW).mul(0.7).add(0.3))
        return fin(lit.add(W.doorCol.mul(rim).mul(0.3)) as V3, n.vW)
      })()
      return m
    },
    after: (_i, rig) => {
      // the hammer rides the right hand, the tongs leave the left fist for the jaws
      HU.ride(rig, boneR.v, skelHead, GRIP_R, 1, _g)
      hammer.position.set(_g[0], _g[1], _g[2])
      hammer.quaternion.set(rig.q[boneR.v * 4], rig.q[boneR.v * 4 + 1], rig.q[boneR.v * 4 + 2], rig.q[boneR.v * 4 + 3]).multiply(qHam)
      HU.ride(rig, boneL.v, skelHead, GRIP_L, 1, _g)
      tongs.position.set(_g[0], _g[1], _g[2])
      _v.copy(tip).sub(tongs.position)
      const len = Math.max(_v.length(), 0.05)
      tongs.quaternion.setFromUnitVectors(Yax, _v.divideScalar(len))
      reins.scale.set(1, len, 1)
      jaws.position.set(0, len, 0)
    },
  })
  boneR.v = smith.rig.bone("armR.2")
  boneL.v = smith.rig.bone("armL.2")
  skelHead = smith.built[0].skel.head
  scene.add(smith.group)
  /** Where the hammer's face is now (after the last pose). */
  const faceNow = (out: THREE.Vector3) => out.copy(FACE_L).applyQuaternion(hammer.quaternion).add(hammer.position)

  // what the figure does this frame, set in update and read by one hoisted, allocation-free fill
  const SS = { t: 0, tw: 0, mix: 0, reachW: 0, corr: new THREE.Vector3(), hand: new THREE.Vector3(), look: [0, 0, 0] as number[], lookAt: 0 }
  const AT: [number, number, number] = [0.5, ATOP + 0.1, 0.06]
  const STRIKE: HU.StrikeOpts = { base: "stand", tool: "shaft", rate: 1, at: AT, lift: 0.4, look: null }
  const REACH = { target: [0, 0, 0] as number[], w: 1, side: -1 as const, look: null as number[] | null, lookAt: 0 }
  const SAVE = { reach: [new Array<number>(13).fill(0), new Array<number>(13).fill(0), new Array<number>(13).fill(0), new Array<number>(13).fill(0)], ch: {} as Record<string, number>, rise: 0, dist: 0, lane: 0, eye: [0, 0] }
  const LIMBS = ["armR", "armL", "legR", "legL"] as const
  const _fr = [0, 0, 0] as [number, number, number], _hw = [0, 0, 0]
  const poseStrike = (d: Drive) => {
    const F = HU.strike(HUM, d, SS.tw, STRIKE)
    // the stone is low: he works bent over it, knees a little bent
    d.ch.lean += 0.24
    d.rise -= 0.05
    // the left fist holds the tongs' reins a forearm's length back from the jaws
    _hw[0] = SS.hand.x
    _hw[1] = SS.hand.y
    _hw[2] = SS.hand.z
    HU.toFrame(F, _hw, _fr)
    HU.limbTo(d, F, "armL", _fr[0], _fr[1], _fr[2], -0.3, -0.5, -1)
    d.ch.curlL = 0
    d.ch.shaftL = 1
    const T = d.reach!.armR!
    T[0] += SS.corr.x
    T[1] += SS.corr.y
    T[2] += SS.corr.z
  }
  const poseReach = (d: Drive) => {
    REACH.target[0] = SS.hand.x
    REACH.target[1] = SS.hand.y
    REACH.target[2] = SS.hand.z
    REACH.w = SS.reachW
    REACH.look = SS.look
    REACH.lookAt = SS.lookAt
    HU.reachTo(HUM, d, SS.t, REACH)
    d.ch.curlL = 0
    d.ch.flatL = 0
    d.ch.shaftL = 1
    d.ch.curlR = 0
    d.ch.shaftR = 1
  }
  const reset = (d: Drive) => {
    d.dist = 0
    d.lane = 0
    d.rise = 0
    d.time = SS.t
    d.scale = 1
    d.seed = 0.31
  }
  /** One pose, or a blend of the two (strike and reach) where the smith goes from one to the other. */
  const fillSmith = (_i: number, d: Drive) => {
    reset(d)
    if (SS.mix <= 0) return poseReach(d)
    if (SS.mix >= 1) return poseStrike(d)
    poseReach(d)
    for (let k = 0; k < 4; k++) {
      const T = d.reach![LIMBS[k]]!
      for (let j = 0; j < 13; j++) SAVE.reach[k][j] = T[j]
    }
    for (const key in d.ch) SAVE.ch[key] = d.ch[key]
    SAVE.rise = d.rise
    SAVE.dist = d.dist
    SAVE.lane = d.lane
    SAVE.eye[0] = d.eye ? d.eye[0] : 0
    SAVE.eye[1] = d.eye ? d.eye[1] : 0
    reset(d)
    poseStrike(d)
    const w = SS.mix
    for (let k = 0; k < 4; k++) {
      const T = d.reach![LIMBS[k]]!
      for (let j = 0; j < 13; j++) T[j] = SAVE.reach[k][j] + (T[j] - SAVE.reach[k][j]) * w
    }
    for (const key in d.ch) d.ch[key] = (SAVE.ch[key] ?? 0) + (d.ch[key] - (SAVE.ch[key] ?? 0)) * w
    d.rise = SAVE.rise + (d.rise - SAVE.rise) * w
    d.dist = SAVE.dist + (d.dist - SAVE.dist) * w
    d.lane = SAVE.lane + (d.lane - SAVE.lane) * w
    if (d.eye) {
      d.eye[0] = SAVE.eye[0] + (d.eye[0] - SAVE.eye[0]) * w
      d.eye[1] = SAVE.eye[1] + (d.eye[1] - SAVE.eye[1]) * w
    }
  }

  // ---------------------------------------------------------------- sparks, scale and fragments: closed-form, on one clock
  type Ev = { t: number; x: number; y: number; z: number; n: number; sp: number; up: number; kind: number }
  const sparkEv: Ev[] = [{ t: 0.02, x: MX, y: MY0 + MH - 0.02, z: 0.01, n: 46, sp: 1.3, up: 1.2, kind: 0 }, { t: 0.9, x: MX, y: MY0 + MH - 0.02, z: 0.01, n: 14, sp: 0.9, up: 1, kind: 0 }, { t: 2.1, x: MX, y: MY0 + MH - 0.02, z: 0.01, n: 12, sp: 0.9, up: 1, kind: 0 }]
  for (let i = 0; i < 9; i++) sparkEv.push({ t: B1 + 1.25 + i * 0.16, x: mix(MOUTH[0], WX, i / 9), y: 0.25 + 0.5 * Math.sin((i / 8) * 2.4), z: mix(MOUTH[2], ZW, i / 9), n: 12, sp: 0.7, up: 0.5, kind: 0 })
  BLOWS.forEach((t, i) => sparkEv.push({ t: B1 + t, x: WX, y: ATOP + 0.03, z: ZW, n: i < 6 ? 70 - i * 4 : 30, sp: i < 6 ? 2.4 : 1.7, up: 0.55, kind: i < 4 ? 1 : 0 }))
  const flakeEv: Ev[] = [{ t: CRACK + 0.05, x: MX, y: MY0 + 0.36, z: 0.02, n: 46, sp: 0.8, up: 0.8, kind: 2 }, { t: KNOCK, x: ROCK[0], y: ROCK[1] + 0.1, z: ROCK[2], n: 14, sp: 1.1, up: 0.9, kind: 3 }]
  BLOWS.forEach((t) => flakeEv.push({ t: B1 + t, x: WX, y: ATOP + 0.025, z: ZW, n: 22, sp: 0.75, up: 0.6, kind: 1 }))
  const fill = (ev: Ev[], seed: number, land: boolean) => {
    const R = rng(seed)
    const n = ev.reduce((a, e) => a + e.n, 0)
    const aP = new Float32Array(n * 4), aV = new Float32Array(n * 4), aQ = new Float32Array(n * 4)
    let i = 0
    for (const e of ev)
      for (let k = 0; k < e.n; k++, i++) {
        const a = R() * Math.PI * 2, sp = e.sp * (0.25 + R() * R() * 0.9)
        // off the anvil they fly at the lens as much as across it
        const vx = Math.cos(a) * sp, vy = Math.abs(Math.sin(a)) * sp * e.up + 0.2, vz = (R() - (e.t > B1 ? 0.25 : 0.5)) * sp * (e.t > B1 ? 1.1 : 0.5)
        const x0 = e.x + (R() - 0.5) * 0.05, y0 = e.y + R() * 0.02
        // where it comes down: the anvil's top if it is over it, else the floor
        const tl = (yl: number) => (vy + Math.sqrt(vy * vy + 2 * 6.5 * Math.max(y0 - yl, 0))) / 6.5
        let t1 = tl(0.004)
        if (e.kind === 1 && land && Math.hypot(x0 + vx * tl(ATOP) - WX, vz * tl(ATOP)) < 0.13) t1 = tl(ATOP + 0.002)
        aP.set([x0, y0, e.z + (land ? R() * 0.02 : 0), e.t + R() * 0.05], i * 4)
        aV.set([vx, vy, vz, t1], i * 4)
        aQ.set([R(), R(), e.kind, 0.4 + R() * 0.9], i * 4)
      }
    const g = quadGeo(n)
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    g.setAttribute("aV", new THREE.InstancedBufferAttribute(aV, 4))
    g.setAttribute("aQ", new THREE.InstancedBufferAttribute(aQ, 4))
    return g
  }
  const aP = attribute("aP", "vec4") as V4, aV = attribute("aV", "vec4") as V4, aQ = attribute("aQ", "vec4") as V4
  const ballistic = (tau: F): V3 => aP.xyz.add(aV.xyz.mul(tau)).add(vec3(0, tau.mul(tau).mul(-3.25), 0)) as V3
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const sparkMat = blend(new THREE.NodeMaterial(), true)
  {
    const age = W.g.sub(aP.w)
    const tau = age.min(aV.w)
    const c1 = ballistic(tau as F), c0 = ballistic(tau.sub(0.03).max(0) as F)
    // a streak is seen side-on whichever way it flies: it is widened across the lens, in clip space
    const a1 = viewProj.mul(vec4(c1, 1)), a0 = viewProj.mul(vec4(c0, 1))
    const sd = a1.xy.div(a1.w).sub(a0.xy.div(a0.w))
    const perp = normalize(vec2(sd.y.negate(), sd.x.mul(W.proj.y.div(W.proj.x))).add(vec2(0, 1e-6)))
    const slag = step(0.5, aQ.z).mul(step(aQ.x, 0.45)) // slag: fewer, heavier, slower to cool
    const wd = mixN(float(0.0022), float(0.005), slag).mul(aQ.w)
    const life = mixN(aQ.y.mul(0.5).add(0.25), aQ.y.mul(0.6).add(0.7), slag)
    const alive = step(0, age).mul(step(age, aV.w)).mul(step(age, life))
    const cl = mixN(a0, a1, uvAttr().x)
    sparkMat.vertexNode = vec4(cl.xy.add(perp.mul(W.proj).mul(positionGeometry.y.mul(wd))), cl.z, cl.w).mul(alive)
    const heat = float(1).sub(age.div(life)).mul(alive).toVarying()
    sparkMat.fragmentNode = Fn(() => vec4(heatCol(heat.mul(0.75).add(0.3) as F).mul(heat).mul(1.6).mul(smoothstep(1, 0.4, abs(uvAttr().y.sub(0.5).mul(2)))), 0))()
  }
  const sparks = add(new THREE.Mesh(fill(sparkEv, 77, false), sparkMat))
  sparks.frustumCulled = false
  /** Light on a small flat thing: no shadows, no highlight. */
  const glowLit = (P: V3, alb: V3): V3 => {
    const c = alb.mul(W.amb.add(W.doorCol.mul(doorMask(P)).mul(0.5))).toVar()
    for (let i = 0; i < 3; i++) {
      const d = hotP(i).sub(P)
      c.addAssign(alb.mul(hotC(i)).mul(0.6).div(dot(d, d).add(0.04)))
    }
    return c as V3
  }
  const flakeMat = new THREE.NodeMaterial()
  flakeMat.side = THREE.DoubleSide
  {
    const age = W.g.sub(aP.w)
    const tau = age.clamp(0, aV.w)
    const down = step(aV.w, age)
    const c = ballistic(tau as F)
    const ang = aQ.x.mul(40).add(tau.mul(aQ.y.mul(30).add(8))).mul(down.oneMinus())
    const big = step(1.5, aQ.z) // clay crumbs and bronze fins are larger than scale
    const sz = mixN(float(0.0042), float(0.0075), big).mul(aQ.w)
    // tumbling in the air, flat on whatever it lands on
    const q = positionGeometry.xy.mul(sz)
    const spin = vec3(q.x.mul(cos(ang)).sub(q.y.mul(sin(ang))), q.x.mul(sin(ang)).add(q.y.mul(cos(ang))), 0)
    const flat = vec3(q.x, 0, q.y)
    flakeMat.vertexNode = viewProj.mul(vec4(c.add(mixN(spin, flat, down)).add(vec3(0, float(0.0015).mul(down), 0)).mul(step(0, age)), 1))
    const vAge = age.toVarying(), vK = aQ.z.toVarying(), vR = aQ.x.toVarying(), vP = c.toVarying() as V3
    flakeMat.fragmentNode = Fn(() => {
      Discard(length(uvAttr().sub(0.5)).greaterThan(mixN(float(0.5), float(0.36), vR)))
      const col = vec3(0, 0, 0).toVar()
      If(vK.lessThan(1.5), () => {
        // hammer scale: glowing as it leaves, blue-black within a second
        col.assign(glowLit(vP, mixN(vec3(0.03, 0.035, 0.05), vec3(0.09, 0.1, 0.14), vR) as V3).add(heatCol(exp(vAge.mul(-2.6)).mul(0.82) as F)))
      })
        .ElseIf(vK.lessThan(2.5), () => {
          col.assign(glowLit(vP, mixN(vec3(0.42, 0.33, 0.24), vec3(0.7, 0.6, 0.47), vR) as V3))
        })
        .Else(() => {
          col.assign(glowLit(vP, vec3(0.5, 0.32, 0.14).mul(vR.mul(0.6).add(0.7)) as V3))
        })
      return fin(col as V3, vP)
    })()
  }
  const flakes = add(new THREE.Mesh(fill(flakeEv, 78, true), flakeMat))
  flakes.frustumCulled = false

  // ---------------------------------------------------------------- smoke, gas, steam, dust and the haze that hangs in the room: one draw
  const NP = 264
  // x, y, z, kind: 0 smoke, 1 gas, 2 steam, 3 dust, 4 haze
  const SRC: [number, number, number, number][] = [[FUR[0], 0.36, FUR[2], 0], [MX, MY0 + MH + 0.01, -0.01, 1], [BLM[0], 1.14, BLM[2], 0], [TROUGH[0], 0.2, TROUGH[1], 2], [MX, 0.2, 0.0, 3], [-0.8, 1.2, -0.8, 4]]
  const pg = quadGeo(NP)
  {
    const R = rng(909)
    const a = new Float32Array(NP * 4), b = new Float32Array(NP * 4)
    for (let i = 0; i < NP; i++) {
      const s = SRC[i % 6]
      const hz = s[3] === 4
      a.set([s[0] + (R() - 0.5) * (hz ? 4.6 : 0.1), s[1] + (hz ? (R() - 0.5) * 1.5 : 0), s[2] + (R() - 0.5) * (hz ? 2.2 : 0.08), R()], i * 4)
      b.set([i % 6, s[3], R(), R()], i * 4)
    }
    pg.setAttribute("aP", new THREE.InstancedBufferAttribute(a, 4))
    pg.setAttribute("aQ", new THREE.InstancedBufferAttribute(b, 4))
  }
  const puffMat = blend(new THREE.NodeMaterial())
  {
    const kind = aQ.y
    const haze = step(3.5, kind)
    const life = mixN(mixN(float(3.4), float(1.25), step(0.5, kind)), float(11), haze)
    const age = fract(W.t.div(life).add(aP.w))
    const rise = mixN(mixN(float(0.95), float(0.5), step(0.5, kind)), float(0.1), haze).mul(aQ.z.mul(0.6).add(0.6))
    const c = aP.xyz.add(vec3(sin(age.mul(5).add(aQ.w.mul(20))).mul(0.05).add(age.mul(aQ.w.sub(0.5)).mul(mixN(float(0.25), float(0.7), step(2.5, kind)))), age.mul(rise), age.mul(-0.1)))
    const sz = mixN(mixN(float(0.06), float(0.03), step(0.5, kind)), float(0.3), haze).mul(age.mul(3.2).add(0.8)).mul(aQ.z.mul(0.6).add(0.7))
    // a card that faces the lens, lit where it floats
    puffMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(c, 1)).add(vec4(positionGeometry.xy.mul(sz), 0, 0)))
    const str = (W.puff.element(int(aQ.x)) as unknown as F).mul(sin(age.mul(3.1416))).toVarying()
    const vK = kind.toVarying(), vS = aQ.w.toVarying()
    const lg = (i: number) => {
      const d = hotP(i).sub(c)
      return hotC(i).mul(0.35).div(dot(d, d).add(0.08))
    }
    const lightAt = W.amb.mul(2).add(W.top.mul(0.5)).add(W.doorCol.mul(doorMask(c as V3)).mul(0.6)).add(lg(0)).add(lg(1)).add(lg(2))
    const vL = lightAt.toVarying()
    puffMat.fragmentNode = Fn(() => {
      const d = length(uvAttr().sub(0.5)).mul(2)
      const body = smoothstep(1, 0.1, d.add(vnoise(uvAttr().mul(5).add(vS.mul(30))).sub(0.5).mul(0.5)))
      const al = body.mul(str).mul(mixN(mixN(float(0.16), float(0.3), step(1.5, vK)), float(0.07), step(3.5, vK)))
      const col = mixN(vec3(0.42, 0.43, 0.46), vec3(0.9, 0.92, 0.95), step(1.5, vK).mul(step(vK, 2.5)))
      return vec4(col.mul(vL).mul(al), al)
    })()
  }
  const puffs = add(new THREE.Mesh(pg, puffMat))
  puffs.frustumCulled = false
  puffs.renderOrder = 5

  // ---------------------------------------------------------------- the rule of ages: cast bronze that goes green with the years
  const face = ruleFace()
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const N = normalize(normalWorld).toVar()
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const g = fbm(st.mul(vec2(90, 9))).toVar()
    const f = vnoise(st.mul(vec2(900, 110))).toVar()
    const bronze = vec3(0.86, 0.6, 0.3).mul(g.mul(0.3).add(0.8))
    // verdigris: from the edges and the cuts inward, pale and powdery, with brown left showing through
    const want = abs(st.y.sub(0.5)).mul(0.9).add(g.mul(0.7)).add(f.mul(0.15))
    const green = smoothstep(0.1, -0.1, float(1.2).sub(W.pat.mul(1.75)).sub(want))
    const verd = mixN(vec3(0.42, 0.63, 0.52), vec3(0.6, 0.78, 0.66), f).mul(g.mul(0.25).add(0.85))
    const brown = vec3(0.4, 0.25, 0.15).mul(g.mul(0.4).add(0.8))
    const body = mixN(mixN(bronze, brown, smoothstep(0.0, 0.35, W.pat).mul(0.8)), verd, green)
    const col = mixN(body, cut.rgb, on).toVar()
    // its own light: it is held to the lens like a title, warmed by whatever is hot in the room
    const warm = hotC(1).add(hotC(0)).add(hotC(2)).mul(0.25).min(vec3(0.5, 0.3, 0.14))
    const lit = col.mul(vec3(0.62, 0.6, 0.58).mul(N.y.mul(0.25).add(0.8)).add(warm)).div(W.ruleExp)
    return vec4(ctx.debugLabels ? mixN(lit, cut.rgb, on) : lit, 2)
  })()
  ruleMat.depthTest = false
  ruleMat.transparent = true
  ruleMat.blending = THREE.NoBlending
  const rule = add(new THREE.Mesh(ruleGeometry(), ruleMat))
  rule.renderOrder = 40
  rule.frustumCulled = false
  const ruleStyle = { treatment: "worn" as const, ink: "#15120d", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }

  // ---------------------------------------------------------------- depth of field, and the air shaking over the fires
  const D = { tS: uniformTexture(stage.texture), max: uniform(0.014), sh: uniformArray([new THREE.Vector4(), new THREE.Vector4()], "vec4") }
  const TAPS = 18
  const dof = ctx.pass(({ uv: st0, res, time }) => {
    const asp = res.x.div(res.y)
    // shimmer: columns of hot air over the two fires, in screen space (x, y of the fire, strength, width)
    const off = vec2(0, 0).toVar()
    for (let i = 0; i < 2; i++) {
      const s = D.sh.element(i) as unknown as V4
      const dx = st0.x.sub(s.x).mul(asp).div(s.w.max(0.001))
      const dy = st0.y.sub(s.y).div(s.w.max(0.001))
      const m = exp(dx.mul(dx).mul(-1.6)).mul(smoothstepN(-0.2, 0.5, dy)).mul(exp(dy.max(0).mul(-0.42))).mul(s.z)
      off.addAssign(vec2(vnoise(vec2(st0.x.mul(70), st0.y.mul(34).sub(time.mul(2.6)))).sub(0.5), vnoise(vec2(st0.x.mul(52).add(9), st0.y.mul(40).sub(time.mul(3.1)))).sub(0.5)).mul(m).mul(0.006))
    }
    const st = st0.add(off.mul(step(sampleRT(D.tS, st0).a, 1.5)).mul(step(sampleRT(D.tS, st0.add(off) as V2).a, 1.5))).toVar() as V2
    const c0 = sampleRT(D.tS, st).toVar()
    const out = vec3(c0.rgb).toVar()
    // alpha 2 marks the rule: rigid to the lens, never blurred nor blurred into
    If(c0.a.lessThan(1.5), () => {
      const a0 = abs(c0.a).toVar()
      const acc = vec3(c0.rgb).toVar()
      const w = float(1).toVar()
      const spin = hash21(floor(st.mul(res))).mul(6.2832)
      Loop(TAPS, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(TAPS)).toVar()
        const an = fi.mul(2.39996).add(spin)
        const s = sampleRT(D.tS, st.add(vec2(cos(an), sin(an)).mul(rr).mul(D.max).div(vec2(asp, 1))) as V2).toVar()
        const as = abs(s.a)
        // what is nearer than the focus spreads over what is behind it; the far field only over what is as soft
        const lim = select(s.a.lessThan(0), as, select(c0.a.lessThan(0), max(as, a0), min(as, a0)))
        const k = smoothstepN(rr.sub(0.06), rr.add(0.06), lim).mul(step(s.a, 1.5)).toVar()
        acc.addAssign(s.rgb.mul(k))
        w.addAssign(k)
      })
      out.assign(acc.div(w))
    })
    return vec4(out, 1)
  }, D)

  // ---------------------------------------------------------------- the story: every clock is read here
  const V = { b2: 0, expo: 1, bloom: 0.5, hal: 0.4, cool: 0, temp: 0, breathA: 0, breathB: 0, hit: 0 }
  const cp = new THREE.Vector3(), cl = new THREE.Vector3()
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tD = new THREE.Vector3()
  /** Move the lens a fraction `w` of the way to a shot: where it stands, what it looks at (which is also what it focuses on). */
  const go = (w: number, px: number, py: number, pz: number, lx: number, ly: number, lz: number) => {
    cp.x += (px - cp.x) * w
    cp.y += (py - cp.y) * w
    cp.z += (pz - cp.z) * w
    cl.x += (lx - cl.x) * w
    cl.y += (ly - cl.y) * w
    cl.z += (lz - cl.z) * w
  }
  function camAt(t0: number, t1: number) {
    cp.set(PRE_CAM.pos[0], PRE_CAM.pos[1], PRE_CAM.pos[2])
    cl.set(PRE_CAM.look[0], PRE_CAM.look[1], PRE_CAM.look[2])
    // the pour: in close and a little round to the right, the stream and the cavity the subject; then a slow push
    go(kk(t0, -0.28, 1.5, E.io3), 0.34, 0.5, 1.12, MX - 0.13, 0.37, 0)
    go(kk(t0, 1.5, POUR_END + 0.3, E.lin), 0.3, 0.46, 0.94, MX - 0.11, 0.35, 0)
    // cooling: the lens sinks with the heat and backs off
    go(kk(t0, POUR_END + 0.2, CRACK - 0.2), 0.3, 0.38, 1.2, MX - 0.1, 0.25, 0)
    go(kk(t0, CRACK, CRACK + 0.55, E.outBack), MX + 0.08, 0.34, 1.12, MX, 0.31, 0)
    // with the casting to the stone
    go(kk(t0, 7.0, 8.2), ROCK[0] - 0.3, 0.42, ROCK[2] + 0.95, ROCK[0] + 0.06, 0.3, ROCK[2])
    // down to the floor where it is laid, and creeping in while the years pass
    // a grazing lens at the level of the floor, the room behind going soft and falling in
    go(kk(t0, 8.9, 11.2, E.io3), PIT[0] - 0.1, 0.12, PIT[1] + 0.36, PIT[0] - 0.08, 0.006, PIT[1] - 0.05)
    go(clamp((t0 - 11.2) / 7) * 0.6, PIT[0] - 0.08, 0.085, PIT[1] + 0.26, PIT[0] - 0.08, 0.004, PIT[1] - 0.04)
    if (t1 > 0) {
      // up from the green blade to the bloomery, the smith at its mouth drawing the bloom
      go(kk(t1, 0, 1.6, E.io3), 0.1, 1.0, 1.9, -1.1, 0.85, -0.5)
      // back with the bloom to the whole man at his anvil, then a slow push through the first heat
      go(kk(t1, 1.5, 3.0, E.io3), WX + 0.62, 1.0, ZW + 2.05, WX + 0.05, 1.0, ZW - 0.3)
      go(kk(t1, 3.0, 6.0, E.lin) * 0.55, WX + 0.42, 0.9, ZW + 1.55, WX + 0.01, 0.98, ZW - 0.25)
      // he turns to the fire and back
      go(Math.sin(Math.PI * kk(t1, 6.05, 7.95)) * 0.7, WX + 0.8, 0.85, ZW + 1.75, mix(WX, MOUTH[0], 0.6), 0.6, mix(ZW, MOUTH[2], 0.6))
      // the second heat from low by the stone: the hands and the metal, the face out of frame
      go(kk(t1, 7.85, 8.35, E.io3), WX + 0.95, 0.92, ZW + 1.45, WX - 0.02, 0.84, ZW - 0.15)
      // the trough, then the blade lifted into the last of the light
      go(kk(t1, QUENCH - 0.65, QUENCH + 0.2, E.io3), WX + 0.5, 0.95, ZW + 2.4, WX + 0.15, 0.85, ZW + 0.05)
      go(kk(t1, QUENCH + 0.9, QUENCH + 2.4, E.io3), WX + 0.45, 1.05, ZW + 2.2, WX + 0.15, 1.0, ZW)
      go(clamp((t1 - 13.6) / 6) * 0.35, WX + 0.32, 1.02, ZW + 1.75, WX + 0.15, 1.0, ZW)
    }
  }
  /** Seconds since the last blow, and how many have landed. */
  const BL = { n: 0, since: 99, next: 99, prev: 0 }
  const blowsAt = (t: number) => {
    BL.n = 0
    BL.since = 99
    BL.next = 99
    BL.prev = BLOWS[0] - 1.3
    for (let i = 0; i < BLOWS.length; i++) {
      const b = BLOWS[i]
      if (t >= b) {
        BL.n++
        BL.since = t - b
        BL.prev = b
      } else {
        BL.next = b
        break
      }
    }
    return BL
  }
  const _ndc = new THREE.Vector3()
  /** A world point as a shimmer source for the lens pass. */
  const shimmer = (i: number, x: number, y: number, z: number, strength: number, width: number) => {
    const o = D.sh.array[i] as THREE.Vector4
    _ndc.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
    const depth = -_ndc.z
    _ndc.applyMatrix4(camera.projectionMatrix)
    o.set(_ndc.x * 0.5 + 0.5, _ndc.y * 0.5 + 0.5, depth > 0.1 ? strength : 0, (width * camera.projectionMatrix.elements[5]) / (2 * Math.max(depth, 0.1)))
  }

  const at = (x: number, y: number, z: number, focus?: number) => () => listenerPos(tD.set(x, y, z), camera, focus)
  const anvilAt = at(WX, ATOP, ZW), mouldAt = at(MX, MY0 + MH, 0), furAt = at(FUR[0], 0.3, FUR[2]), rockAt = at(ROCK[0], ROCK[1], ROCK[2]), pitAt = at(PIT[0], 0, PIT[1]), mouthAt = at(MOUTH[0], MOUTH[1], MOUTH[2]), troughAt = at(TROUGH[0], 0.2, TROUGH[1])
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    { b: 0, at: 0.02, s: "sizzle", o: { g: 0.75, dur: 1.4, wet: 1.3 }, pos: mouldAt },
    { b: 0, at: 0.05, s: "crackle", o: { g: 0.5, dur: 0.4 }, pos: mouldAt },
    { b: 0, at: 1.5, s: "sizzle", o: { g: 0.35, dur: 1.6, wet: 1.3 }, pos: mouldAt },
    ...Array.from({ length: 6 }, (_, i): Cue => ({ b: 0, at: 0.35 + i * 1.6, s: "whoosh", o: { f: 82 + (i % 2) * 14, dur: 0.75, g: i < 4 ? 0.2 : 0.1, wet: 1.5 }, pos: furAt })),
    { b: 0, at: POUR_END + 0.1, s: "tick", o: { f: 2100, g: 0.2 }, pos: mouldAt },
    { b: 0, at: 4.4, s: "crack", o: { g: 0.12, wet: 1.4 }, pos: mouldAt },
    { b: 0, at: 5.3, s: "crack", o: { g: 0.1, wet: 1.4 }, pos: mouldAt },
    { b: 0, at: CRACK, s: "crack", o: { g: 0.6, wet: 1.5 }, pos: mouldAt },
    { b: 0, at: CRACK + 0.04, s: "knap", o: { f: H(7), g: 0.6, wet: 1.5 }, pos: mouldAt },
    { b: 0, at: CRACK + 0.55, s: "thud", o: { f: 80, g: 0.5, wet: 1.4 }, pos: mouldAt },
    { b: 0, at: KNOCK, s: "anvil", o: { f: H(26), g: 0.5, wet: 1.6 }, pos: rockAt },
    { b: 0, at: KNOCK, s: "knap", o: { f: H(11), g: 0.6, wet: 1.5 }, pos: rockAt },
    { b: 0, at: KNOCK + 0.3, s: "bell", o: { f: H(44), g: 0.12, wet: 1.8 }, pos: rockAt },
    { b: 0, at: 9.35, s: "thud", o: { f: 90, g: 0.3, wet: 1.3 }, pos: pitAt },
    ...[9.7, 10.2, 10.7].map((t, i): Cue => ({ b: 0, at: t, s: "scratch", o: { f: 150 + i * 20, dur: 0.4, g: 0.2 - i * 0.03 }, pos: pitAt })),
    { b: 0, at: 10.6, s: "rumble", o: { g: 0.22, dur: 4 } },
    { b: 0, at: 11.0, s: "shimmer", o: { f: H(24), g: 0.2, dur: 4 } },
    { b: 0, at: 11.4, s: "pad", o: { f: H(5), g: 0.28, dur: 5 } },
    { b: 1, at: 0.15, s: "whoosh", o: { f: 120, dur: 1.2, g: 0.25 } },
    { b: 1, at: 1.25, s: "crackle", o: { g: 0.6, dur: 0.9 }, pos: mouthAt },
    { b: 1, at: 1.5, s: "sizzle", o: { g: 0.3, dur: 0.8 }, pos: mouthAt },
    { b: 1, at: 2.75, s: "stone", o: { f: H(5), g: 0.5, wet: 1.4 }, pos: anvilAt },
    ...BLOWS.flatMap((t, i): Cue[] => {
      const T = tempAt(t)
      const f = H(18 + Math.round(14 * (1 - T)))
      return [
        { b: 1, at: t, s: "anvil", o: { f, g: 0.8 + 0.1 * (i % 2), wet: 1.7 }, pos: anvilAt },
        { b: 1, at: t, s: "thud", o: { f: 68, g: i < 6 ? 0.4 : 0.22, wet: 1.5 }, pos: anvilAt },
        ...(i === 0 || i === 6 ? [{ b: 1, at: t, s: "sub" as const, o: { g: 0.35 } }] : []),
        ...(i < 4 ? [{ b: 1, at: t + 0.01, s: "crackle" as const, o: { g: 0.35, dur: 0.25 }, pos: anvilAt }] : []),
        ...[0.27, 0.36, 0.5].map((d, k): Cue => ({ b: 1, at: t + d + 0.02 * ((i * 3 + k) % 4), s: "tick", o: { f: 2500 + ((i * 7 + k * 5) % 9) * 160, g: 0.1, wet: 0.9 }, pos: at(WX + (k - 1) * 0.3, 0.02, ZW + 0.3) })),
      ]
    }),
    { b: 1, at: 6.3, s: "whoosh", o: { f: 170, dur: 0.5, g: 0.2 }, pos: anvilAt },
    { b: 1, at: 6.6, s: "whoosh", o: { f: 84, dur: 0.6, g: 0.3, wet: 1.5 }, pos: mouthAt },
    { b: 1, at: 7.1, s: "whoosh", o: { f: 96, dur: 0.6, g: 0.3, wet: 1.5 }, pos: mouthAt },
    { b: 1, at: QUENCH - 0.02, s: "splash", o: { g: 0.5, wet: 1.3 }, pos: troughAt },
    { b: 1, at: QUENCH, s: "hiss", o: { f: 3200, dur: 1.9, g: 0.7, wet: 1.5 }, pos: troughAt },
    { b: 1, at: QUENCH, s: "sizzle", o: { g: 0.8, dur: 1.2 }, pos: troughAt },
    { b: 1, at: 12.7, s: "pad", o: { f: H(6), g: 0.3, dur: 5 } },
  ]

  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.6, bloomThresh: 1.15, bloomRadius: 0.95, halation: 0.45, vignette: 0.34, ca: 0.0009, sat: 1.06, contrast: 1.22, grain: 0.032, lift: [0.0, 0.002, 0.007], gain: [1.05, 1.0, 0.94] }
  const HUD = { color: "#f6efe2", shadow: "rgba(0,0,0,0.6)" }
  const TITLES = { color: "#fbf5ea", shadow: "rgba(10,8,6,0.8)", delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.4] }

  function update(s: State) {
    const t0 = s.beat === 0 ? s.at(0) : 60
    const t1 = s.beat >= 1 ? s.at(1) : -1
    const time = s.time
    camera.aspect = s.w / s.h
    camera.fov = s.beat >= 1 ? mix(PRE_CAM.fov, 36, kk(s.at(1), 1.4, 3)) : PRE_CAM.fov
    blm.visible = slagT.visible = bellowsG[1].visible = s.beat >= 1
    camera.updateProjectionMatrix()
    W.proj.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5])
    W.t.value = time
    W.g.value = s.beat === 0 ? t0 : B1 + t1

    // ---- the lens: hand-held; it flinches at the pour and punches in on every blow
    camAt(t0, t1)
    const bl = blowsAt(t1)
    const hit = t1 > 0 ? Math.exp(-bl.since * 9) : 0
    V.hit = hit
    const live = kk(t0, -0.1, 0.6)
    const sh = shake(time, 1, 0.2)
    const jolt = (t0 > 0 && t0 < 2 ? Math.exp(-t0 * 8) * Math.sin(t0 * 50) * 0.006 : 0) + hit * Math.sin(bl.since * 70) * 0.007 + (t0 > CRACK && t0 < CRACK + 1 ? Math.exp(-(t0 - CRACK) * 8) * Math.sin((t0 - CRACK) * 60) * 0.005 : 0)
    const punch = 0.1 * hit
    camera.position.set(cp.x + (cl.x - cp.x) * punch + (sh[0] * 0.005 + s.mouse.x * 0.03) * live, cp.y + (cl.y - cp.y) * punch + (sh[1] * 0.005 + s.mouse.y * 0.015) * live + jolt, cp.z + (cl.z - cp.z) * punch)
    tA.set(cl.x + sh[1] * 0.002 * live, cl.y + sh[0] * 0.002 * live + jolt * 0.5, cl.z)
    camera.lookAt(tA)
    camera.rotateZ(sh[2] * 0.003 * live + hit * 0.005 * Math.sin(bl.since * 50))
    camera.updateMatrixWorld()
    camera.getWorldDirection(W.fwd.value)
    const fdist = cp.distanceTo(cl)
    W.focus.value = fdist * (1 - punch)
    // wide open in close, stopped down for the wide of the room
    W.ap.value = clamp(1.45 - fdist * 0.5, 0.35, 1.2) * (t0 < -0.3 ? 0.4 : 1)
    D.max.value = ctx.debugLabels ? 0 : 0.013

    // ---- the years: the fires go out, the daub falls, days and nights cross the doorway
    const lapse = kk(t0, 10.0, 11.0) * (1 - kk(t1, 0.1, 1.3))
    const du = (((t0 - 10.2) * 1.1) % 1 + 1) % 1
    const sunUp = kk(du, 0, 0.08, E.lin) * (1 - kk(du, 0.6, 0.72, E.lin))
    const day = lapse > 0 ? sunUp : 1
    const da = clamp(du / 0.72)
    W.ld.value.set(mix(LD.x, mix(0.2, 0.72, da), lapse), mix(LD.y, -(0.3 + 0.12 * Math.sin(Math.PI * da)), lapse), 1).normalize()
    W.decay.value = kk(t0, 10.2, 16.5, E.lin) * (1 - 0.75 * kk(t1, 0.2, 1.8))
    W.amb.value.set(0.022, 0.025, 0.034).multiplyScalar(1 + lapse * (0.9 + 0.6 * day))
    W.doorCol.value.set(0.55 + 0.45 * lapse * (1 - Math.sin(Math.PI * da)), 0.7, 0.95 - 0.35 * lapse * (1 - Math.sin(Math.PI * da))).multiplyScalar((1.1 + lapse * 3.4 + (s.beat >= 1 ? 0.7 : 0)) * (1 - lapse * (1 - day) * 0.62))
    W.top.value.set(0.5 + 0.3 * (1 - day), 0.56, 0.6).multiplyScalar(lapse * (0.015 + 0.08 * day))
    W.smoke.value = 0.2 - 0.05 * lapse + (s.beat >= 1 ? 0.12 : 0)
    V.cool = lapse
    V.b2 = s.beat >= 1 ? 1 : 0

    // ---- the fires breathe with the bellows
    const powA = s.beat === 0 ? (1 - 0.6 * kk(t0, 3.6, 6.5)) * (1 - kk(t0, 10.2, 13.5)) : 0
    const powB = s.beat >= 1 ? kk(t1, -0.2, 0.9) * 1 : 0
    const ph = time * (Math.PI / 0.8)
    V.breathA = powA * (0.55 + 0.45 * Math.abs(Math.sin(ph)))
    V.breathB = powB * (0.55 + 0.45 * Math.abs(Math.sin(ph * 1.1)))
    W.breath.value.set(V.breathA, V.breathB)
    blowA(ph, powA)
    blowB(ph * 1.1, powB)
    furG.scale.y = 1 - 0.5 * W.decay.value
    const rot = kk(t0, 11, 15.5) * (1 - kk(t1, 0.1, 1.4))
    flap.scale.set(1 - 0.55 * rot, 1 - 0.35 * rot, 1)
    flap.position.x = flapX0 - 0.069 * rot
    flap.position.y = DOOR.top / 2 + 0.01 + 0.21 * rot
    W.flap.value = FLAP - 0.15 * rot
    const flick = 0.9 + 0.1 * Math.sin(time * 23) * Math.sin(time * 7.1)
    ;(W.hotP.array[0] as THREE.Vector3).set(FUR[0], 0.42, FUR[2])
    heatRGB(0.72, W.hotC.array[0] as THREE.Vector3).multiplyScalar(0.3 * V.breathA * flick)
    ;(W.hotP.array[2] as THREE.Vector3).set(MOUTH[0] + MDIR[0] * 0.1, 0.24, MOUTH[2] + MDIR[1] * 0.1)
    heatRGB(0.76, W.hotC.array[2] as THREE.Vector3).multiplyScalar(0.28 * V.breathB * flick)

    // ---- the mould: opened, filled, cooled, broken off
    const open = kk(t0, -0.62, -0.14, E.io2)
    const flow = t0 > 0 && t0 < POUR_END + 0.35 ? 1 : 0
    const fillK = kk(t0, 0.12, POUR_END, E.lin)
    W.level.value = (TIP + (MH - 0.02 - TIP) * Math.pow(fillK, 0.8)) * (t0 > 0.12 ? 1 : 0)
    const cool = Math.exp(-Math.max(t0 - POUR_END, 0) / 2.0)
    W.mouldT.value = t0 > 0 ? 0.97 * cool : 0
    W.burnt.value = kk(t0, 0.5, 4)
    W.flow.value = flow
    W.crack.value = kk(t0, CRACK - 0.5, CRACK, E.in2)
    const fall = kk(t0, CRACK, CRACK + 0.7, E.in2)
    mouldG.visible = hinge.visible = s.beat === 0
    mouldG.rotation.set(-1.45 * fall, 0, -0.25 * fall)
    mouldG.position.set(MX, MY0 - 0.14 * fall, -0.3 * fall)
    const fallB = kk(t0, CRACK + 0.08, CRACK + 0.72, E.in2)
    hinge.rotation.set(-1.4 * fallB, -2.25 * open, 0)
    hinge.position.set(MX - (MW / 2 + WRAP), MY0 - 0.12 * fallB, -0.28 * fallB)
    const occ = W.occ.array as THREE.Vector4[]
    occ[0].set(MX, fall > 0.5 ? -9 : 0.14, -0.04, 0.1)
    occ[1].set(MX, fall > 0.5 ? -9 : 0.4, -0.04, 0.095)
    occ[2].set(WX, 0.3, ZW, 0.25)
    occ[3].set(FUR[0], 0.1, FUR[2], 0.27)
    occ[5].set(TROUGH[0], 0.06, TROUGH[1], 0.17)

    // ---- the crucible: carried over on its withies, tipped, taken away
    const arrive = kk(t0, -1.1, -0.12, E.io2), leave = kk(t0, POUR_END + 0.5, POUR_END + 1.6, E.in2)
    const tilt = 1.2 * kk(t0, -0.25, 0.05, E.io2) * (1 - kk(t0, POUR_END - 0.1, POUR_END + 0.45)) + 0.05 * Math.sin(time * 2.3)
    const lipX = MX + 0.045, lipY = MY0 + MH + 0.11
    tA.set(mix(FUR[0] + 0.1, lipX, arrive) + 0.9 * leave, mix(1.0, lipY, arrive) + 0.25 * Math.sin(Math.PI * arrive) + 0.7 * leave + 0.004 * Math.sin(time * 3.1), mix(FUR[2] + 0.2, -0.005, arrive))
    cruc.position.copy(tA)
    cruc.rotation.z = tilt
    cruc.visible = s.beat === 0 && t0 < POUR_END + 1.7
    W.lip.value.copy(tA)
    W.v0.value.set(-0.2 - 0.1 * flow, 0.03, 0)
    const drop = Math.max(0.02, lipY - (MY0 + MH - 0.05))
    W.fall.value = Math.sqrt((2 * drop) / 9.8) * 1.05
    W.head.value = clamp(t0 / 0.14)
    W.tail.value = clamp((t0 - POUR_END) / 0.4)
    stream.visible = t0 > 0 && t0 < POUR_END + 0.42

    // ---- the casting: stands free, is lifted, rapped on the stone, laid in a scrape in the floor and covered
    const shown = s.beat === 0 ? t0 > CRACK - 0.9 : true
    cast.visible = shown
    const lift = kk(t0, 6.9, 7.9), swing = kk(t0, 7.9, KNOCK, E.in3), reb = kk(t0, KNOCK, KNOCK + 0.22, E.out2), lay = kk(t0, KNOCK + 0.3, 9.35)
    tB.set(mix(mix(mix(MX, -0.06, lift), ROCK[0] + 0.1, swing), PIT[0], lay) - 0.03 * reb * (1 - lay), mix(mix(mix(MY0 + 0.3, 0.66, lift), 0.36, swing) + 0.09 * reb, 0.004, lay), mix(mix(0.004 + 0.02 * Math.sin(Math.PI * lift), ROCK[2], swing), PIT[1], lay))
    cast.position.copy(tB)
    const castZ = -(0.75 * lift + 0.6 * swing - 0.2 * reb * (1 - lay) + (Math.PI / 2 - 1.35) * lay) - 0.02 * Math.sin(time * 2.1) * lift * (1 - lay)
    cast.rotation.set(-Math.PI / 2 * E.io2(lay), 0.262 * lay, castZ)
    flashM.visible = jetM.visible = t0 < KNOCK
    W.castT.value = t0 < 20 ? 0.97 * cool * 0.9 : 0
    W.years.value = kk(t0, 10.4, 16.5, E.lin)
    W.cover.value = 1.5 * kk(t0, 9.5, 10.9, E.io2) - 0.95 * kk(t0, 12.2, 16.5, E.io2)
    coverM.visible = false
    const bury = kk(t0, 9.5, 10.9, E.io2), erode = kk(t0, 12.0, 16.8, E.io2)
    over.count = Math.round(NOVER * Math.min(bury, 1 - 0.9 * erode))
    roots.count = Math.round(NROOT * W.decay.value)
    W.pat.value = kk(t0, 10.6, 15.5, E.io2)
    // the withies hold the crucible, then the casting by its hilt
    const holdCast = kk(t0, 6.6, 6.95)
    withies.visible = s.beat === 0 && (t0 < POUR_END + 1.7 || (t0 > 6.5 && t0 < 10.4))
    if (holdCast > 0) {
      const out = kk(t0, 9.4, 10.3, E.in2)
      withies.position.set(tB.x - Math.sin(castZ) * 0.235 * (1 - lay) + 0.26 * lay + 0.8 * out, tB.y + Math.cos(castZ) * 0.235 * (1 - lay) + 0.9 * out + (1 - holdCast) * 0.8, tB.z + 0.07 * lay)
      withies.rotation.set(0, 0, 0.25 - 0.2 * lay)
      withies.scale.set(0.3, 1, 0.16)
    } else {
      withies.position.set(cruc.position.x + Math.cos(tilt) * 0.066, cruc.position.y + Math.sin(tilt) * 0.066 - 0.02, cruc.position.z)
      withies.rotation.set(0, 0, 0)
      withies.scale.set(1, 1, 1)
    }

    // ---- the iron, the tongs and the smith
    let hot = 0
    const smithOn = s.beat >= 1
    const ironOn = s.beat >= 1 && t1 > 0.6
    iron.visible = ironOn
    smith.group.visible = hammer.visible = tongs.visible = smithOn
    if (smithOn) {
      const n = bl.n + (bl.since < 0.07 ? bl.since / 0.07 - 1 : 0)
      const a = clamp(n / 6), b = clamp((n - 6) / 7)
      // half-dimensions: bloom, billet, blade
      const hx = mix(mix(0.075, 0.085, a), 0.2, b), hy = mix(mix(0.058, 0.026, a), 0.0065, b), hz = mix(mix(0.065, 0.036, a), 0.024, b)
      const squash = 1 - 0.14 * hit * (1 - b * 0.5)
      W.dim.value.set(hx, hy * squash, hz * (2 - squash))
      W.lump.value = mix(0.02, 0.002, a)
      W.bar.value = clamp(a * 0.75 + b * 0.25)
      W.blade.value = b
      W.blows.value = bl.n
      const T = t1 < HEATS[0] ? 1 : tempAt(t1)
      W.ironT.value = T * (0.96 + 0.06 * hit)
      W.wet.value = kk(t1, QUENCH - 0.05, QUENCH + 0.2) * (1 - kk(t1, QUENCH + 1.5, QUENCH + 4))
      hot = T
      // where the jaws hold it: in the bloomery's mouth, drawn out to the anvil, back into the fire and out, into the trough, up to the eye
      const ax = WX + hx * 0.3, ay = ATOP + hy * squash + 0.012 * Math.max(0, Math.sin(bl.since * 26)) * hit
      const draw = kk(t1, 1.25, 2.75, E.io3)
      const back = Math.sin(Math.PI * kk(t1, 6.2, 7.85, E.io2))
      const dip = kk(t1, QUENCH - 0.6, QUENCH, E.in2), up = kk(t1, QUENCH + 0.9, QUENCH + 2.1, E.io2)
      const inX = MOUTH[0] - MDIR[0] * 0.1, inY = 0.17, inZ = MOUTH[2] - MDIR[1] * 0.1
      const gX = ax + hx * 0.92
      const onAnvil = draw * (1 - back) * (1 - dip)
      tip.set(mix(inX, gX, draw), mix(inY, ay, draw) + 0.22 * Math.sin(Math.PI * draw), mix(inZ, ZW, draw))
      tip.set(mix(tip.x, inX, back), mix(tip.y, inY, back) + 0.18 * Math.sin(Math.PI * back), mix(tip.z, inZ, back))
      tip.set(mix(tip.x, TROUGH[0] + 0.02, dip) - 0.12 * up, mix(tip.y, 0.15, dip) + 0.74 * up, mix(tip.z, TROUGH[1] + 0.05, dip) - 0.12 * up)
      // the left fist: a forearm's length up the reins from the jaws, toward his left shoulder
      _u.set(SM.x + mix(0.2, 0.36, onAnvil), mix(1.25, 0.95, onAnvil), SM.z + mix(0.05, 0.16, onAnvil)).sub(tip).normalize()
      SS.hand.copy(tip).addScaledVector(_u, mix(0.58, 0.5, onAnvil))
      // the piece hangs from the jaws, or lies flat on the stone
      _v.copy(tip).sub(SS.hand).normalize()
      _q.setFromUnitVectors(Xax, _u.copy(_v).negate())
      iron.quaternion.copy(_q).slerp(QI, onAnvil)
      tB.copy(tip).addScaledVector(_v, hx * 0.92)
      iron.position.set(mix(tB.x, ax, onAnvil), mix(tB.y, ay, onAnvil), mix(tB.z, ZW, onAnvil))
      // the hammer: one clock with the blows; the phase wraps to 0 exactly as each one lands
      let p: number
      if (bl.n === 0 || bl.n === 6) {
        const b0 = BLOWS[bl.n]
        p = t1 > b0 - 1.05 ? 0.1 + 0.9 * clamp((t1 - (b0 - 1.05)) / 1.05) : bl.n === 6 ? Math.min(0.1, bl.since * 0.25) : 0.05
      } else if (bl.n >= BLOWS.length) p = Math.min(0.1, bl.since * 0.25)
      else p = clamp((t1 - bl.prev) / (bl.next - bl.prev))
      SS.t = time
      SS.tw = bl.n + p - 0.31 * 1.7
      SS.mix = kk(t1, 2.35, 2.8) * (1 - kk(t1, 5.95, 6.35)) + kk(t1, 7.5, 7.9) * (1 - kk(t1, 10.6, 11.0))
      SS.reachW = 1
      SS.look[0] = iron.position.x
      SS.look[1] = iron.position.y
      SS.look[2] = iron.position.z
      SS.lookAt = 0
      // where the face must land: the top of the iron over the stone's centre
      tC.set(WX, ATOP + 2 * hy * squash, ZW)
      AT[0] = tC.z - SM.z
      AT[1] = tC.y
      AT[2] = -(tC.x - SM.x)
      SS.corr.set(0, 0, 0)
      smith.update(camera, fillSmith)
      if (SS.mix > 0) {
        // the wrist follows its target less than one for one (the hand turns with it): three passes close it
        const w = (1 - HU.strikeLift(p)) ** 2 * SS.mix
        for (let k = 0; k < 3; k++) {
          faceNow(_v)
          SS.corr.x += (tC.x - _v.x) * w * 1.3
          SS.corr.y += (tC.y - _v.y) * w * 1.3
          SS.corr.z += (tC.z - _v.z) * w * 1.3
          smith.update(camera, fillSmith)
        }
      }
      occ[4].set(SM.x, 1.05, SM.z + 0.05, 0.2)
    } else occ[4].set(0, -9, 0, 0.01)

    // ---- what is hot lights the room
    const hp = W.hotP.array[1] as THREE.Vector3, hcol = W.hotC.array[1] as THREE.Vector3
    if (s.beat === 0) {
      if (t0 < 0) hp.copy(cruc.position).add(tA.set(0.03, 0.06, 0.05))
      else if (t0 < CRACK) hp.set(MX + 0.02, MY0 + Math.max(W.level.value, 0.12) + (flow ? 0.05 : -0.05), flow ? 0.16 : 0.2)
      else hp.copy(cast.position).add(tA.set(0, 0.03, 0.08))
      heatRGB(t0 > 0 ? 0.95 * cool : 0.9, hcol).multiplyScalar(t0 > 0 ? (0.016 + 0.02 * flow * flick) * cool ** 3 : 0.06 * arrive)
      hot = t0 > 0 ? cool : 0.6 * arrive
    } else {
      hp.set(iron.position.x + 0.02, iron.position.y + 0.07, iron.position.z + 0.1)
      heatRGB(hot, hcol).multiplyScalar(ironOn ? 0.1 + 0.3 * hit : 0)
    }
    V.temp = hot
    W.keyDir.value.copy(hp).sub(tA.set(WX + 0.3, ATOP + 0.3, ZW)).normalize()
    W.keyCol.value.copy(hcol).multiplyScalar(6)
    const puff = W.puff.array as number[]
    puff[0] = 0.6 * powA + 0.1 * (1 - lapse)
    puff[1] = flow ? 1 : Math.max(0, 1 - (t0 - POUR_END) / 2) * (t0 > 0 ? 0.6 : 0)
    puff[2] = 0.8 * powB
    puff[3] = t1 > QUENCH ? 2.2 * Math.exp(-(t1 - QUENCH) / 1.6) + 0.2 * (1 - kk(t1, QUENCH + 2, QUENCH + 6)) : 0
    puff[4] = t0 > CRACK && t0 < CRACK + 2 ? 1.6 * Math.exp(-(t0 - CRACK) * 1.6) : 0
    puff[5] = 1 - 0.6 * lapse
    shimmer(0, s.beat === 0 ? FUR[0] : MOUTH[0], s.beat === 0 ? 0.4 : 0.45, s.beat === 0 ? FUR[2] : MOUTH[2], s.beat === 0 ? V.breathA : V.breathB, 0.45)
    shimmer(1, hp.x, hp.y, hp.z - 0.08, clamp(hot * 1.4) * (s.beat === 0 ? (t0 > 0 ? 1 : 0.5) : ironOn ? 1 : 0), 0.22)
    // the grade: hot and haloed at the pour and under the hammer, cold and flat while the years pass
    V.expo = 1.05 - 0.12 * kk(t0, 0, 0.4) * (1 - kk(t0, POUR_END, 5.5)) + 0.08 * kk(t0, 5.2, 7.5) * (1 - lapse) - 0.12 * lapse + (s.beat >= 1 ? 0.1 - 0.18 * hit + 0.35 * kk(t1, QUENCH - 0.4, QUENCH + 1.5) : 0)
    V.bloom = 0.55 + 0.35 * flow + 0.35 * hit - 0.3 * lapse
    V.hal = 0.45 + 0.25 * flow + 0.25 * hit - 0.3 * lapse

    // ---- the rule of ages
    face.update(ctx.def.id, ruleArrival(ctx.def.id, s.beat === 0 ? s.at(0) : 60, START), ruleStyle)
    placeRule(rule, camera, { dist: 1.2, lean: 0.14 })
    W.ruleExp.value = V.expo

    if (s.live) {
      const b = s.beat === 0 ? V.breathA : V.breathB
      ctx.synth.bed("fire", 0.12 * (1 - lapse) + 0.4 * b)
      ctx.synth.bed("air", 0.1 + 0.3 * b)
      ctx.synth.bed("crackle", 0.08 * (1 - lapse) + 0.18 * b + 0.3 * flow)
      ctx.synth.bed("wind", 0.35 * lapse)
    }
  }

  return {
    cues,
    update,
    warm: () => [
      { scene, camera, target: stage },
      { pass: dof, target: sharp },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, camera)
      POST.exposure = V.expo
      POST.bloom = ctx.debugLabels ? 0 : V.bloom
      POST.halation = V.hal
      POST.gain![0] = 1.05 - 0.09 * V.cool - 0.08 * V.b2
      POST.gain![2] = 0.94 + 0.1 * V.cool + 0.08 * V.b2
      POST.contrast = 1.22 + 0.1 * V.b2
      if (ctx.debugLabels) POST.ca = POST.halation = POST.vignette = POST.grain = 0
      D.tS.value = stage.texture
      dof.render(sharp)
      ctx.finish(sharp.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(8,6,4,0.75)" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => ruleLabels(face),
    dispose() {
      face.dispose()
      smith.dispose()
      disposeTree(scene)
    },
  }
}
