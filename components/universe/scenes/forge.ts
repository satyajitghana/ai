// Scene 3, "The first five minutes": the early universe as a kitchen. A cast crucible on a hob
// set into a brushed steel counter, full of rattling protons (red-hot) and neutrons (pale) that
// pair and then clump into fours while a wind-up timer runs to five minutes and rings; then the
// stove is turned off and everything stops where it is.
//
// One story parameter per half: `cook` 0..1 (the timer's hand) and `heat` (the world rule: one
// emissive temperature that colours the spheres, the pot, the light on the counter and the bloom).
// Every position is closed-form: a sphere is at mix(home, its place in a pair, its place in a
// four) by two schedule times baked into instance attributes, plus a jitter whose clock slows to
// a stop as the pot cools.
//
// Drawing. One lit stage (half-float, depth, 4x MSAA) and one full-screen pass for the air. The
// 176 spheres are one instanced draw, the shells of the fours another, the grate one merged mesh.
// Nothing is allocated per frame: update() fills `st` and the uniforms, render() reads them.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dot, exp, faceDirection, float, floor, Fn, fract, fwidth, If, length, max, min, mix as mixN, modelWorldMatrix, normalGeometry, normalize, positionGeometry, pow, reflect, sin, smoothstep, sqrt, step, texture, uniform, uniformTexture, uv as uvGeometry, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos, type Pos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles } from "../engine/titles"
import { fbm, hash11, hash21, luma, sampleRT, sat, smoothstepRev, TAU, vnoise, voronoi, type F, type V2, type V3 } from "../engine/tsl"
import type { Ctx, Cue, Portal, PostOpts, SceneInstance, State } from "../engine/types"

// ---------------------------------------------------------------- layout (world units; the pot's rim radius is about 1)

const CARD = { x: -3.3, z: 0.42, w: 2.1, h: 1.45, rot: 0.11 }
const TIMER = { x: 1.82, z: -1.72, r: 0.62 }
const KNOB = { x: 1.95, z: 1.2, r: 0.3 }
const HOB = 1.72
const RAD = 0.078 // sphere radius
const N_N = 22 // neutrons: one in eight, so the pot ends as helium fours in a crowd of lone protons
const N_P = 154
const COOK0 = 0.6 // seconds of beat 1 at which the timer starts, and how long it runs
const COOK_LEN = 6.8
const SWEEP = 4.9 // radians the timer's hand travels from 0 to 5 minutes

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)

/** GLSL smoothstep whose edges are nodes and may fall (e0 > e1), spelled out so WGSL defines it. */
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

// ---------------------------------------------------------------- the world rule

const POT = /*@__PURE__*/ vec3(0, 0.82, 0)
const KEY = /*@__PURE__*/ vec3(-0.42, 0.8, -0.43)
const KEYC = /*@__PURE__*/ vec3(0.5, 0.58, 0.74)

/** One temperature, one colour: dull red, orange, yellow, white-hot (linear HDR). */
const heatCol = /*@__PURE__*/ Fn(([h]: [F]) => {
  const c = vec3(0.55, 0.045, 0.004).mul(smoothstep(0, 0.3, h)).toVar()
  c.assign(mixN(c, vec3(1.7, 0.42, 0.035), smoothstep(0.16, 0.55, h)))
  c.assign(mixN(c, vec3(3.6, 1.9, 0.55), smoothstep(0.5, 0.9, h)))
  c.assign(mixN(c, vec3(8, 6.6, 4.6), smoothstep(0.9, 1.3, h)))
  return c
}).setLayout({ name: "forgeHeatCol", type: "vec3", inputs: [{ name: "h", type: "float" }] })

const BOX = /*@__PURE__*/ new THREE.Vector3(-0.35, 0.75, -0.55).normalize()
const envOf = /*@__PURE__*/ Fn(([r]: [V3]) => {
  const up = smoothstep(-0.1, 0.9, r.y)
  const box = exp(max(0, dot(r, vec3(BOX.x, BOX.y, BOX.z)).oneMinus()).mul(-22))
  return vec3(0.006, 0.007, 0.011).add(KEYC.mul(up.mul(0.02).add(box.mul(0.5))))
}).setLayout({ name: "forgeEnvOf", type: "vec3", inputs: [{ name: "r", type: "vec3" }] })

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const post = ctx.target({})
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.2, 80)
  const uHeat = uniform(1)
  const uFlame = uniform(1)
  const uClock = uniform(0)

  // light arriving at p from the glowing pot
  const potE = (p: V3, n: V3, hc: V3) => {
    const d = POT.sub(p)
    const r2 = dot(d, d)
    const l = d.div(sqrt(r2))
    return hc.mul(sat(dot(n, l).mul(0.7).add(0.3) as F)).mul(1.25).div(r2.mul(0.5).add(1))
  }
  // the ring of gas flame under the pot
  const flameE = (p: V3, n: V3) => {
    const r = max(length(p.xz), 1e-3)
    const lp = vec3(p.x.div(r).mul(0.98), 0.16, p.z.div(r).mul(0.98))
    const d = lp.sub(p)
    const r2 = dot(d, d)
    return vec3(0.1, 0.32, 1).mul(uFlame).mul(sat(dot(n, normalize(d)).mul(0.6).add(0.4) as F)).mul(0.22).div(r2.mul(2.4).add(0.08))
  }
  // what polished things see: the same room, plus a band of dim windows and the fire from below
  const envRich = (r: V3, hc: V3) => {
    const band = smoothstep(-0.05, 0.2, r.y).mul(smoothstepRev(0.8, 0.3, r.y))
    return envOf(r)
      .add(vec3(0.16, 0.18, 0.23).mul(band).mul(smoothstep(-0.2, 0.6, sin(atan(r.z, r.x).mul(3).add(1))).mul(0.65).add(0.35)))
      .add(hc.mul(0.04).mul(smoothstepRev(0.3, -0.5, r.y)))
  }
  /** The shared surface: key light, the pot's glow, the flame ring, two speculars and the room. Call inside an Fn. */
  const shade = (p: V3, n: V3, alb: V3, rough_: Num, metal_: Num, hc: V3): V3 => {
    const rough = fl(rough_)
    const metal = fl(metal_)
    const v = normalize(cameraPosition.sub(p)).toVar()
    const f0 = mixN(vec3(0.04), alb, metal).toVar()
    const fres = pow(sat(dot(n, v) as F).oneMinus(), 5).toVar()
    const dif = alb.mul(metal.oneMinus()).mul(KEYC.mul(sat(dot(n, KEY) as F).mul(0.42).add(0.05).add(n.y.mul(0.05))).add(potE(p, n, hc)).add(flameE(p, n)))
    const hk = normalize(KEY.add(v))
    const sk = pow(sat(dot(n, hk) as F), mixN(160, 10, rough)).mul(mixN(4, 0.3, rough))
    const toPot = POT.sub(p).toVar()
    const hp = normalize(normalize(toPot).add(v))
    const r2 = dot(toPot, toPot)
    const sp = pow(sat(dot(n, hp) as F), mixN(50, 5, rough)).mul(mixN(1.6, 0.3, rough))
    const spec = mixN(f0, vec3(1), fres.mul(rough.oneMinus()).mul(0.6)).mul(KEYC.mul(sk).add(hc.mul(sp).div(r2.mul(0.35).add(1))))
    const env = envRich(reflect(v.negate(), n) as V3, hc).mul(mixN(f0, vec3(1), fres.mul(0.5))).mul(mixN(1, 0.25, rough)).mul(metal.mul(0.85).add(0.15))
    return dif.add(spec).add(env) as V3
  }

  // the standard vertex stage: world position and normal, interpolated
  const world = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz
  const stdVertex = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
  const vW = world.toVarying() as V3
  const vN = normalize(modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz).toVarying() as V3
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)

  const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } as const
  let made = 0
  const mk = (vertex: THREE.Node, fragment: THREE.Node, extra: Partial<THREE.NodeMaterial> = {}) => {
    const m = new THREE.NodeMaterial()
    m.name = `forge${++made}` // (pipeline errors name the material)
    m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    Object.assign(m, extra)
    return m
  }
  /** A plain lit surface: colour (or a printed map), roughness, metalness. */
  const lit = (col: number, rough: number, metal: number, map?: THREE.Texture, glow = 0) => {
    const k = new THREE.Color(col)
    return mk(
      stdVertex,
      Fn(() => {
        const a = (map ? vec3(k.r, k.g, k.b).mul(texture(map, uvGeometry()).rgb) : vec3(k.r, k.g, k.b)).toVar()
        const hc = heatCol(uHeat).toVar()
        const c = shade(vW, normalize(vN).toVar(), a, rough, metal, hc)
        return vec4(glow ? c.add(a.mul(heatCol(uHeat.mul(glow))).mul(glow)) : c, 1)
      })(),
    )
  }

  // ---------------------------------------------------------------- counter and hob

  const uRing = uniform(0)
  const sdBox = (p: V2, bx: number, by: number) => {
    const d = abs(p).sub(vec2(bx, by)).toVar()
    return length(max(d, 0)).add(min(max(d.x, d.y), 0)) as F
  }
  // a soft shadow thrown by a disc of radius r, pushed away from the pot and a little by the key
  const thrown = (p: V2, cx: number, cz: number, r: number, h: number) => {
    const l = Math.hypot(cx, cz)
    const ax = (cx / l) * h * 1.1 + 0.42 * h * 0.35
    const az = (cz / l) * h * 1.1 + 0.43 * h * 0.35
    const near = smoothstepRev(r * 1.06, r * 0.9, length(p.sub(vec2(cx + ax * 0.25, cz + az * 0.25))))
    const far = smoothstepRev(r * 1.9, r * 0.5, length(p.sub(vec2(cx + ax, cz + az))))
    return max(near.mul(0.6), far.mul(0.34)).oneMinus()
  }
  const counter = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2),
    mk(
      stdVertex,
      Fn(() => {
        const p = vW
        const v = normalize(cameraPosition.sub(p)).toVar()
        const rr = length(p.xz).toVar()
        const fw = max(fwidth(p.z), 1e-5).toVar()
        // brushing runs along x: long streaks, each octave faded once it is finer than a pixel
        const b = float(0).toVar()
        let a = 0.34
        for (let i = 0; i < 4; i++) {
          const f = 13 * 3.1 ** i
          const w = smoothstep(0.12, 0.45, fw.mul(f)).oneMinus()
          b.addAssign(vnoise(vec2(p.x.mul(f).mul(0.014).add(i * 7.3), p.z.mul(f))).sub(0.5).mul(a).mul(w))
          a *= 0.9
        }
        const wear = fbm(p.xz.mul(vec2(0.3, 1.9)).add(3)).toVar()
        const hob = smoothstepRev(HOB + 0.012, HOB - 0.012, rr).toVar() // black enamel plate
        const trim = smoothstepRev(0.05, 0.03, abs(rr.sub(HOB + 0.035))) // its polished ring
        const n = normalize(vec3(0, 1, b.mul(mixN(0.4, 0.03, hob))))
        const r = reflect(v.negate(), n) as V3
        const d = POT.sub(p).toVar()
        const r2 = dot(d, d).toVar()
        const h = normalize(d.div(sqrt(r2)).add(v)).toVar()
        // anisotropic lobe: tight along the grain, wide across it, so the glow smears up and down the frame
        const hx = h.x.div(mixN(0.11, 0.05, hob))
        const hz = h.z.div(mixN(0.5, 0.07, hob))
        const D = exp(hx.mul(hx).add(hz.mul(hz)).div(max(h.y.mul(h.y), 1e-3)).negate())
        const hc = heatCol(uHeat).toVar()
        const steel = mixN(vec3(0.6, 0.63, 0.69), vec3(0.045, 0.047, 0.055), hob).toVar()
        const col = steel.mul(envOf(r)).mul(mixN(0.8, 1.5, hob)).mul(b.mul(0.7).add(1)).toVar()
        col.addAssign(
          steel
            .mul(hc)
            .mul(
              D.mul(mixN(0.95, 1.5, hob))
                .div(r2.mul(0.07).add(1))
                .add(mixN(0.2, 0, hob).div(r2.mul(r2).mul(0.09).add(1)))
                .add(hob.mul(0.5).mul(exp(max(rr.sub(0.78), 0).mul(-4.2)))),
            )
            .mul(b.mul(mixN(1.05, 0.3, hob)).add(0.8).add(wear.sub(0.5).mul(0.35))),
        )
        col.addAssign(steel.mul(flameE(p, vec3(0, 1, 0))).mul(b.mul(2).add(1.2)))
        const rs = max(rr, 1e-4)
        const ringN = normalize(vec3(p.x.div(rs).mul(0.5), 1, p.z.div(rs).mul(0.5)))
        col.assign(mixN(col, vec3(0.8, 0.82, 0.86).mul(envOf(reflect(v.negate(), ringN) as V3)).mul(2.4).add(hc.mul(0.25).div(r2.add(1))), trim))
        // the bell: one ring of light running out across the steel from the timer
        If(uRing.greaterThanEqual(0.001), () => {
          const tr = length(p.xz.sub(vec2(TIMER.x, TIMER.z))).sub(TIMER.r)
          const e1 = tr.sub(uRing.mul(1.5)).mul(34)
          const e2 = tr.sub(uRing.mul(0.9)).mul(40)
          const fade = uRing.oneMinus()
          col.addAssign(steel.mul(KEYC).mul(fade.mul(fade)).mul(0.6).mul(exp(e1.mul(e1).negate()).add(exp(e2.mul(e2).negate()).mul(0.6))))
        })
        // contact: under the pot and grate, then each prop
        const sh = smoothstepRev(1.28, 0.62, rr).mul(-0.86).add(1).toVar()
        const q0 = p.xz.sub(vec2(CARD.x, CARD.z))
        const cs = Math.cos(CARD.rot)
        const sn = Math.sin(CARD.rot)
        const q = vec2(q0.x.mul(cs).sub(q0.y.mul(sn)), q0.x.mul(sn).add(q0.y.mul(cs))).toVar()
        const cl = Math.hypot(CARD.x, CARD.z)
        const awx = (CARD.x / cl) * 0.07 + 0.03
        const awz = (CARD.z / cl) * 0.07 + 0.03
        sh.mulAssign(
          float(1)
            .sub(smoothstepRev(0.05, -0.02, sdBox(q.sub(vec2(awx * 0.5, awz * 0.5)) as V2, CARD.w / 2, CARD.h / 2)).mul(0.45))
            .sub(smoothstepRev(0.22, -0.04, sdBox(q.sub(vec2(awx * 1.6, awz * 1.6)) as V2, CARD.w / 2, CARD.h / 2)).mul(0.16)),
        )
        sh.mulAssign(thrown(p.xz as V2, TIMER.x, TIMER.z, TIMER.r, 0.3).mul(thrown(p.xz as V2, KNOB.x, KNOB.z, KNOB.r, 0.22)))
        col.mulAssign(mixN(vec3(0.2, 0.23, 0.3), vec3(1), sh)) // shadows are blue-grey, never black
        return vec4(col, 1)
      })(),
    ),
  )
  scene.add(counter)

  // ---------------------------------------------------------------- crucible, grate, flames

  const prof: [number, number][] = [[0, 0.11], [0.68, 0.11], [0.75, 0.15], [0.97, 0.92], [1.035, 0.955], [1.065, 1.01], [1.05, 1.07], [1.0, 1.1], [0.93, 1.1], [0.885, 1.07], [0.87, 1.02], [0.69, 0.42], [0.6, 0.36], [0, 0.34]]
  const pot = new THREE.Mesh(
    new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96),
    mk(
      stdVertex,
      Fn(() => {
        const n = normalize(vN).mul(faceDirection).toVar()
        const r = length(vW.xz).toVar()
        const ang = atan(vW.z, vW.x).toVar()
        const inner = sat(step(dot(n.xz, vW.xz), -0.001).mul(step(0.3, vW.y)).add(step(0.9, n.y).mul(step(r, 0.7)).mul(step(vW.y, 0.5))) as F).toVar()
        // cast iron: pitted, a little glossy on the worn rim
        const pit = fbm(vec2(ang.mul(9), vW.y.mul(14)).add(2)).toVar()
        const fine = vnoise(vec2(ang.mul(60), vW.y.mul(90))).toVar()
        const nn = normalize(n.add(vec3(pit, fine, pit.mul(fine)).sub(0.5).mul(0.22))).toVar()
        const rim = smoothstep(0.98, 1.09, vW.y).toVar()
        const alb = mixN(vec3(0.035, 0.033, 0.032), vec3(0.1, 0.095, 0.09), rim.mul(0.7).add(pit.mul(0.3))).toVar()
        const hc = heatCol(uHeat).toVar()
        const c = shade(vW, nn as V3, alb as V3, mixN(0.62, 0.34, rim) as F, 0.55, hc as V3).toVar()
        // the wall glows through from the inside, hottest at the base where the flame is
        const through = uHeat.mul(mixN(0.62, 0.34, smoothstep(0.1, 1, vW.y))).mul(pit.mul(0.3).add(0.85))
        c.addAssign(heatCol(through).mul(inner.oneMinus()).mul(mixN(0.5, 0.16, rim)).mul(step(vW.y, 1.095)))
        // inside: lit by its own contents
        const depth = smoothstepRev(1.08, 0.35, vW.y).toVar()
        c.assign(
          mixN(
            c,
            alb
              .mul(hc)
              .mul(1.6)
              .mul(depth.add(0.3))
              .add(heatCol(uHeat.mul(depth.mul(0.5).add(0.42))).mul(depth.mul(0.5).add(0.12)).mul(pit.mul(0.5).add(0.75))),
            inner,
          ),
        )
        // the inner edge of the rim catches the glow
        c.addAssign(hc.mul(0.5).mul(rim).mul(smoothstepRev(1.0, 0.9, r)).mul(sat(n.y)))
        return vec4(c, 1)
      })(),
      { side: THREE.DoubleSide },
    ),
  )
  scene.add(pot)

  // the glowing floor the spheres sit over: slow convection cells
  const melt = new THREE.Mesh(
    new THREE.CircleGeometry(0.74, 64).rotateX(-Math.PI / 2).translate(0, 0.47, 0),
    mk(
      stdVertex,
      Fn(() => {
        const p = vW.xz
        const r = length(p)
        const w = voronoi(p.mul(3.2).add(fbm(p.mul(2).add(uClock.mul(0.12))).mul(1.4)).add(vec2(0, uClock.mul(0.05)))).x
        const f = fbm(p.mul(5).sub(uClock.mul(0.22)))
        const t = uHeat.mul(smoothstepRev(0.55, 0.05, w).mul(0.2).add(0.6).add(f.sub(0.5).mul(0.25)).sub(r.mul(r).mul(0.12)))
        return vec4(heatCol(t).mul(mixN(0.5, 0.7, smoothstep(0, 1, uHeat))), 1)
      })(),
    ),
  )
  scene.add(melt)

  // the grate: four arms, four feet and a ring, cast as one piece (one draw)
  const merge = (parts: THREE.BufferGeometry[]) => {
    let nv = 0
    let ni = 0
    for (const g of parts) {
      nv += g.getAttribute("position").count
      ni += g.getIndex()!.count
    }
    const pos = new Float32Array(nv * 3)
    const nor = new Float32Array(nv * 3)
    const idx = new Uint16Array(ni)
    let v = 0
    let k = 0
    for (const g of parts) {
      pos.set(g.getAttribute("position").array, v * 3)
      nor.set(g.getAttribute("normal").array, v * 3)
      const src = g.getIndex()!.array
      for (let i = 0; i < src.length; i++) idx[k++] = src[i] + v
      v += g.getAttribute("position").count
      g.dispose()
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
    out.setIndex(new THREE.BufferAttribute(idx, 1))
    return out
  }
  const grateParts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4
    grateParts.push(new THREE.BoxGeometry(1.02, 0.11, 0.13).translate(0.98, 0.055, 0).rotateY(a))
    grateParts.push(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 14).translate(1.42, 0.025, 0).rotateY(a))
  }
  grateParts.push(new THREE.TorusGeometry(0.62, 0.05, 10, 64).rotateX(Math.PI / 2).translate(0, 0.05, 0))
  const grate = new THREE.Mesh(merge(grateParts), lit(0x0a0a0b, 0.55, 0.6, undefined, 0.38))
  scene.add(grate)

  // gas jets: a ring of small blue flames licking out from under the base
  const NF = 40
  const flameGeo = new THREE.InstancedBufferGeometry()
  flameGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3))
  flameGeo.setIndex([0, 1, 2, 0, 2, 3])
  const fa = new Float32Array(NF * 2)
  for (let i = 0; i < NF; i++) {
    fa[i * 2] = (i / NF) * Math.PI * 2
    fa[i * 2 + 1] = (i * 0.618) % 1
  }
  flameGeo.setAttribute("aF", new THREE.InstancedBufferAttribute(fa, 2))
  flameGeo.instanceCount = NF
  // (the vertex stage moves these, so each instanced mesh carries a hand-set bound that covers its whole motion)
  flameGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 1.4)
  const aF = attribute("aF", "vec2")
  const flameV = (() => {
    const fl = sin(uClock.mul(17).add(aF.y.mul(40))).mul(0.25).add(0.75).add(sin(uClock.mul(31).add(aF.y.mul(17))).mul(0.12))
    const radial = vec3(cos(aF.x), 0, sin(aF.x))
    const base = radial.mul(0.72).add(vec3(0, 0.07, 0))
    const toCam = normalize(cameraPosition.sub(base))
    const side = normalize(cross(radial, toCam))
    // each jet leans outward and up the wall of the pot
    const along = normalize(radial.mul(0.8).add(vec3(0, 0.75, 0)).add(toCam.mul(0.25)))
    const len = fl.mul(0.34).mul(uFlame)
    return base.add(side.mul(positionGeometry.x).mul(0.06)).add(along.mul(positionGeometry.y).mul(len))
  })()
  const vQ = positionGeometry.xy.toVarying()
  const flames = new THREE.Mesh(
    flameGeo,
    mk(
      viewProj.mul(vec4(flameV, 1)),
      Fn(() => {
        const w = abs(vQ.x).div(vQ.y.mul(-0.85).add(1.001)).oneMinus().toVar()
        const core = smoothstep(0, 0.7, w).mul(smoothstepRev(1, 0.55, vQ.y)).mul(smoothstep(0, 0.12, vQ.y))
        const c = mixN(vec3(0.05, 0.25, 1.6), vec3(0.6, 1.3, 2.6), smoothstep(0.3, 1, w).mul(vQ.y.oneMinus())).mul(core).mul(uFlame).mul(1.6)
        return vec4(c, 0)
      })(),
      // (additive, so back and front faces can go in one draw: three's two-pass path for transparent double-sided
      // materials would draw the ring twice and compile two pipelines for it)
      { ...ADD, side: THREE.DoubleSide, forceSinglePass: true },
    ),
  )
  scene.add(flames)

  // ---------------------------------------------------------------- the contents: protons and neutrons on a schedule

  const N = N_N + N_P
  const R = rng(3)
  const wallAt = (y: number) => 0.69 + ((0.87 - 0.69) * (y - 0.42)) / 0.6 - RAD - 0.012
  const P: number[][] = []
  for (let i = 0; i < N; i++) {
    const y = 0.56 + R() * 0.38
    const a = R() * Math.PI * 2
    const r = Math.sqrt(R()) * wallAt(y)
    P.push([Math.cos(a) * r, y, Math.sin(a) * r])
  }
  // push them apart until they sit like a pot of marbles
  for (let it = 0; it < 90; it++) {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2]
        const d = Math.hypot(dx, dy, dz) || 1e-4
        const ov = RAD * 2.04 - d
        if (ov > 0) {
          const k = (ov * 0.5) / d
          P[i][0] -= dx * k; P[i][1] -= dy * k * 0.6; P[i][2] -= dz * k
          P[j][0] += dx * k; P[j][1] += dy * k * 0.6; P[j][2] += dz * k
        }
      }
      const p = P[i]
      p[1] = clamp(p[1], 0.56, 0.97)
      const r = Math.hypot(p[0], p[2])
      const m = wallAt(p[1])
      if (r > m) { p[0] *= m / r; p[2] *= m / r }
    }
  }
  // neutrons are picked from the top of the pile, spread out, so every pairing is seen
  const order = P.map((_, i) => i).sort((a, b) => P[b][1] - P[a][1])
  const kind = new Uint8Array(N) // 0 proton, 1 neutron
  const neutrons: number[] = []
  for (const i of order) {
    if (neutrons.length >= N_N) break
    if (neutrons.every((j) => Math.hypot(P[i][0] - P[j][0], P[i][2] - P[j][2]) > 0.24)) { neutrons.push(i); kind[i] = 1 }
  }
  for (const i of order) { if (neutrons.length >= N_N) break; if (!kind[i]) { neutrons.push(i); kind[i] = 1 } }
  const d3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const taken = new Uint8Array(N)
  const pairs = neutrons.map((n) => {
    let best = -1
    for (let i = 0; i < N; i++) if (!kind[i] && !taken[i] && (best < 0 || d3(P[i], P[n]) < d3(P[best], P[n]))) best = i
    taken[best] = 1
    return { n, p: best, c: [(P[n][0] + P[best][0]) / 2, Math.max(0.9, (P[n][1] + P[best][1]) / 2), (P[n][2] + P[best][2]) / 2], t: 0 }
  })
  const fours: { a: number; b: number; c: number[]; t: number }[] = []
  const used = new Uint8Array(pairs.length)
  for (let i = 0; i < pairs.length; i++) {
    if (used[i]) continue
    let best = -1
    for (let j = i + 1; j < pairs.length; j++) if (!used[j] && (best < 0 || d3(pairs[j].c, pairs[i].c) < d3(pairs[best].c, pairs[i].c))) best = j
    used[i] = used[best] = 1
    const A = pairs[i].c, B = pairs[best].c
    const c = [(A[0] + B[0]) / 2, 1.01, (A[2] + B[2]) / 2]
    const r = Math.hypot(c[0], c[2])
    if (r > 0.66) { c[0] *= 0.66 / r; c[2] *= 0.66 / r }
    fours.push({ a: i, b: best, c, t: 0 })
  }
  // the schedule: pairs through the first half of the cook, fours through the second
  const shuffle = <T,>(arr: T[]) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
  shuffle(fours.map((_, i) => i)).forEach((f, k) => { fours[f].t = 0.5 + ((k + 0.5 + (R() - 0.5) * 0.5) / fours.length) * 0.44 })
  shuffle(pairs.map((_, i) => i)).forEach((p, k) => { pairs[p].t = 0.05 + ((k + 0.5 + (R() - 0.5) * 0.6) / pairs.length) * 0.4 })

  const dHome = new Float32Array(N * 3), dPair = new Float32Array(N * 3), dFour = new Float32Array(N * 3), dTime = new Float32Array(N * 2), dSeed = new Float32Array(N * 4)
  for (let i = 0; i < N; i++) {
    dHome.set(P[i], i * 3); dPair.set(P[i], i * 3); dFour.set(P[i], i * 3)
    dTime[i * 2] = 9; dTime[i * 2 + 1] = 9
    dSeed.set([R() * 100, R() * 100, kind[i], R() * 100], i * 4)
  }
  const TET = [[1, 0.5, 0], [-1, 0.5, 0], [0, -0.5, 1], [0, -0.5, -1]].map((v) => v.map((x) => x * RAD * 0.86))
  fours.forEach((f, fi) => {
    const rotA = R() * 6.28
    const members = [pairs[f.a].n, pairs[f.b].n, pairs[f.a].p, pairs[f.b].p] // the two pale ones opposite each other
    members.forEach((m, k) => {
      const t = TET[k]
      dFour.set([f.c[0] + t[0] * Math.cos(rotA) - t[2] * Math.sin(rotA), f.c[1] + t[1], f.c[2] + t[0] * Math.sin(rotA) + t[2] * Math.cos(rotA)], m * 3)
      dTime[m * 2 + 1] = f.t
      dSeed[m * 4 + 3] = 200 + fi * 7.31
    })
    for (const pi of [f.a, f.b]) {
      const pr = pairs[pi]
      const a = R() * 6.28
      const o = [Math.cos(a) * RAD * 0.98, 0, Math.sin(a) * RAD * 0.98]
      dPair.set([pr.c[0] + o[0], pr.c[1], pr.c[2] + o[2]], pr.n * 3)
      dPair.set([pr.c[0] - o[0], pr.c[1], pr.c[2] - o[2]], pr.p * 3)
      dTime[pr.n * 2] = dTime[pr.p * 2] = pr.t
      dSeed[pr.n * 4 + 1] = dSeed[pr.p * 4 + 1] = 50 + pi * 3.17
    }
  })
  // All 176 spheres are one instanced draw: a unit sphere and five per-instance attributes.
  const ballGeo = new THREE.InstancedBufferGeometry()
  const sph = new THREE.SphereGeometry(1, 22, 14)
  ballGeo.setAttribute("position", sph.getAttribute("position"))
  ballGeo.setIndex(sph.getIndex())
  ballGeo.setAttribute("aHome", new THREE.InstancedBufferAttribute(dHome, 3))
  ballGeo.setAttribute("aPair", new THREE.InstancedBufferAttribute(dPair, 3))
  ballGeo.setAttribute("aFour", new THREE.InstancedBufferAttribute(dFour, 3))
  ballGeo.setAttribute("aTime", new THREE.InstancedBufferAttribute(dTime, 2))
  ballGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(dSeed, 4))
  ballGeo.instanceCount = N
  ballGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.8, 0), 3.4) // the pot, and the fall into it while it fills
  const uCook = uniform(0)
  const uJit = uniform(1)
  const uFill = uniform(1)
  const jit = (s: F, sp: number) => {
    const t = uClock.mul(sp)
    return vec3(
      sin(t.mul(7.1).add(s)).add(sin(t.mul(13.3).add(s.mul(2.7))).mul(0.6)),
      sin(t.mul(8.3).add(s.mul(1.9))).add(sin(t.mul(15.1).add(s.mul(0.7))).mul(0.6)),
      sin(t.mul(6.7).add(s.mul(3.1))).add(sin(t.mul(12.1).add(s.mul(1.3))).mul(0.6)),
    )
  }
  const aHome = attribute("aHome", "vec3"), aPair = attribute("aPair", "vec3"), aFour = attribute("aFour", "vec3"), aTime = attribute("aTime", "vec2"), aSeed = attribute("aSeed", "vec4")
  const ballV = (() => {
    const kp = smoothstep(aTime.x, aTime.x.add(0.045), uCook)
    const kf = smoothstep(aTime.y, aTime.y.add(0.05), uCook)
    // on its own it rattles hard; bound, it rides with its partners and only trembles
    const own = jit(aSeed.x, 1).mul(0.024).mul(uJit)
    const c0 = aHome.add(own.mul(kp.mul(-0.8).add(1)))
    const c1 = mixN(c0, aPair.add(jit(aSeed.y, 0.55).mul(0.02).mul(uJit)).add(own.mul(0.2)), kp.mul(kp).mul(kp.mul(-2).add(3)))
    const c2 = mixN(c1, aFour.add(jit(aSeed.w, 0.4).mul(0.014).mul(uJit)).add(own.mul(0.12)), kf.mul(kf).mul(kf.mul(-2).add(3)))
    // what is left over settles lower as the fours take the top of the pot
    const single = step(8, aTime.y)
    const sunk = single.mul(smoothstep(0.45, 1, uCook))
    // poured in: they arrive from above as the pot fills
    const dy = uFill.oneMinus().mul(fract(aSeed.x.mul(0.37)).mul(2.5).add(1.6)).sub(sunk.mul(fract(aSeed.x.mul(0.71)).mul(0.05).add(0.13)))
    const flash = max(exp(max(uCook.sub(aTime.y).sub(0.05), 0).mul(-34)).mul(kf), exp(max(uCook.sub(aTime.x).sub(0.045), 0).mul(-44)).mul(kp).mul(0.5))
    return { pos: c2.add(vec3(0, dy, 0)).add(positionGeometry.mul(RAD)), k: vec3(aSeed.z, kf, flash), s: sunk }
  })()
  const bW = ballV.pos.toVarying() as V3
  const bN = positionGeometry.toVarying() as V3
  const bK = ballV.k.toVarying()
  const bS = ballV.s.toVarying()
  const balls = new THREE.Mesh(
    ballGeo,
    mk(
      viewProj.mul(vec4(ballV.pos, 1)),
      Fn(() => {
        const n = normalize(bN).toVar()
        const v = normalize(cameraPosition.sub(bW))
        const neutron = bK.x
        const alb = mixN(vec3(0.5, 0.03, 0.025), vec3(0.66, 0.63, 0.57), neutron).toVar()
        const hc = heatCol(uHeat).toVar()
        const c = shade(bW, n as V3, alb as V3, mixN(0.32, 0.42, neutron) as F, 0, hc as V3).mul(0.75).toVar()
        // lit from underneath by the melt, and glowing itself
        c.addAssign(alb.mul(hc).mul(sat(n.y.mul(-0.55).add(0.45) as F)).mul(0.6))
        const h = uHeat.mul(uHeat)
        const own = mixN(vec3(1.7, 0.07, 0.01), vec3(1.9, 1.6, 1.15), neutron).mul(h).mul(sat(dot(n, v) as F).mul(0.5).add(0.5)).toVar()
        // a bound four keeps a little of the heat it gave off
        own.mulAssign(bS.mul(-0.55).add(1))
        own.addAssign(vec3(1.6, 0.9, 0.25).mul(bK.y).mul(h).mul(0.6).add(vec3(7, 5.2, 2.6).mul(bK.z)))
        // each sphere shades its neighbours: darker low in the pile
        const occ = smoothstep(0.5, 1, bW.y).mul(0.75).add(0.25).mul(bS.mul(-0.35).add(1))
        return vec4(c.add(own).mul(occ), 1)
      })(),
    ),
  )
  scene.add(balls)

  // each four gets a faint shell once it has formed: one nucleus, not four neighbours
  const shellGeo = new THREE.InstancedBufferGeometry()
  shellGeo.setAttribute("position", sph.getAttribute("position"))
  shellGeo.setIndex(sph.getIndex())
  const sh4 = new Float32Array(fours.length * 4), shS = new Float32Array(fours.length)
  fours.forEach((f, i) => { sh4.set([f.c[0], f.c[1], f.c[2], f.t], i * 4); shS[i] = 200 + i * 7.31 })
  shellGeo.setAttribute("aC", new THREE.InstancedBufferAttribute(sh4, 4))
  shellGeo.setAttribute("aSd", new THREE.InstancedBufferAttribute(shS, 1))
  shellGeo.instanceCount = fours.length
  shellGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.3)
  const aC = attribute("aC", "vec4"), aSd = attribute("aSd", "float")
  const shellV = (() => {
    const k = smoothstep(aC.w.add(0.03), aC.w.add(0.09), uCook)
    const since = max(uCook.sub(aC.w).sub(0.06), 0)
    const pop = k.mul(exp(since.mul(-30)).mul(0.5).add(1))
    return { pos: aC.xyz.add(jit(aSd, 0.4).mul(0.014).mul(uJit)).add(positionGeometry.mul(RAD * 2.05).mul(pop)), a: k.add(exp(since.mul(-26)).mul(2).mul(k)) }
  })()
  const sW = shellV.pos.toVarying()
  const sA = shellV.a.toVarying()
  const shells = new THREE.Mesh(
    shellGeo,
    mk(
      viewProj.mul(vec4(shellV.pos, 1)),
      Fn(() => {
        const v = normalize(cameraPosition.sub(sW))
        const f = max(abs(dot(normalize(bN), v)).oneMinus(), 0)
        const h = mixN(0.3, 0.55, uHeat.mul(uHeat))
        return vec4(vec3(1.7, 1.05, 0.32).mul(pow(f, 2.2)).mul(1.1).add(vec3(0.5, 0.3, 0.08).mul(0.12)).mul(sA).mul(h), 0)
      })(),
      ADD,
    ),
  )
  shells.renderOrder = 2
  scene.add(shells)

  // ---------------------------------------------------------------- the recipe card and its magnet

  const typer = ctx.fonts.typer
  const cardTex = canvasTex(1400, 964, (c, w, h) => {
    const r = rng(11)
    c.fillStyle = "#efe6d0"
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "120,96,60" : "255,250,235"},${0.03 + r() * 0.05})`; c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2) }
    const g = c.createRadialGradient(w * 0.82, h * 0.2, 20, w * 0.82, h * 0.2, 300)
    g.addColorStop(0, "rgba(150,105,50,0.16)"); g.addColorStop(0.8, "rgba(150,105,50,0.07)"); g.addColorStop(1, "rgba(150,105,50,0)")
    c.fillStyle = g
    c.fillRect(0, 0, w, h) // an old ring from a cup
    c.strokeStyle = "rgba(200,60,50,0.55)"; c.lineWidth = 3
    c.beginPath(); c.moveTo(0, 276); c.lineTo(w, 276); c.stroke()
    c.strokeStyle = "rgba(70,110,170,0.3)"; c.lineWidth = 2
    for (let y = 382; y < h - 20; y += 94) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke() }
    // typed, one character at a time: uneven ink and a wandering baseline
    const typeLine = (str: string, x: number, y: number, size: number) => {
      c.font = `400 ${size}px ${typer}`
      c.textBaseline = "alphabetic"
      const adv = c.measureText("M").width * 0.98
      ;[...str].forEach((ch, i) => { c.fillStyle = `rgba(28,24,22,${0.72 + r() * 0.26})`; c.fillText(ch, x + i * adv + (r() - 0.5) * 1.6, y + (r() - 0.5) * 2.4) })
    }
    typeLine("THE FIRST FIVE MINUTES", 86, 236, 78)
    typeLine("Heat: about 10 billion degrees C,", 86, 370, 49)
    typeLine("      at one second old.", 86, 464, 49)
    typeLine("Take: protons (red), neutrons (pale).", 86, 558, 49)
    typeLine("Cook for five minutes.", 86, 652, 49)
    typeLine("Then let the stove go cold.", 86, 746, 49)
    typeLine("Makes: hydrogen, helium", 86, 840, 49)
    typeLine("       and not much else.", 86, 924, 49)
  })
  const cardGeo = new THREE.PlaneGeometry(CARD.w, CARD.h, 24, 16).rotateX(-Math.PI / 2)
  {
    const pos = cardGeo.getAttribute("position")
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (CARD.w / 2), z = pos.getZ(i) / (CARD.h / 2)
      // held flat at the magnet; the far corners lift and the sheet has a slight bow
      const lift = 0.07 * Math.max(0, x * 0.9 + z * 0.8 - 0.55) ** 2 + 0.035 * Math.max(0, -x - z * 0.4 - 0.7) ** 2 + 0.012 * (1 - z * z)
      pos.setY(i, 0.012 + lift)
    }
    cardGeo.computeVertexNormals()
  }
  const card = new THREE.Mesh(cardGeo, lit(0xffffff, 0.9, 0, cardTex))
  card.position.set(CARD.x, 0, CARD.z)
  card.rotation.y = -CARD.rot
  scene.add(card)
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.07, 28).translate(0, 0.06, 0), lit(0xb3140f, 0.22, 0))
  magnet.position.set(CARD.x + 0.1, 0, CARD.z - CARD.h / 2 + 0.15)
  scene.add(magnet)
  const cardCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3((x * CARD.w) / 2, 0.02, (z * CARD.h) / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), -CARD.rot).add(new THREE.Vector3(CARD.x, 0, CARD.z)))

  // ---------------------------------------------------------------- the wind-up timer

  const faceTex = canvasTex(768, 768, (c, w) => {
    const m = w / 2
    c.fillStyle = "#f1ecdf"
    c.fillRect(0, 0, w, w)
    c.translate(m, m)
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + (i / 20) * SWEEP
      const major = i % 4 === 0
      c.strokeStyle = "#17181b"; c.lineWidth = major ? 9 : 4
      c.beginPath(); c.moveTo(Math.cos(a) * (major ? 262 : 286), Math.sin(a) * (major ? 262 : 286)); c.lineTo(Math.cos(a) * 326, Math.sin(a) * 326); c.stroke()
    }
    c.fillStyle = "#17181b"; c.textAlign = "center"; c.textBaseline = "middle"
    c.font = `400 92px ${typer}`
    c.fillText("0", Math.cos(-Math.PI / 2) * 206, Math.sin(-Math.PI / 2) * 206 + 6)
    const a5 = -Math.PI / 2 + SWEEP
    c.fillText("5", Math.cos(a5) * 206, Math.sin(a5) * 206 + 6)
    c.font = `400 40px ${typer}`
    c.fillStyle = "#a01d14"
    c.fillText("MINUTES", 0, 196)
    c.strokeStyle = "#a01d14"; c.lineWidth = 5
    c.beginPath(); c.arc(0, 0, 356, 0, 7); c.stroke()
  })
  const timer = new THREE.Group()
  timer.position.set(TIMER.x, 0, TIMER.z)
  const enamel = lit(0xd9d2c2, 0.3, 0)
  const chrome = lit(0xc8ccd2, 0.16, 1)
  const bake = lit(0x121214, 0.28, 0)
  const red = lit(0xb3140f, 0.3, 0)
  timer.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.6, 0], [0.62, 0.03], [0.62, 0.2], [0.585, 0.275], [0.55, 0.29], [0, 0.29]].map(([r, y]) => new THREE.Vector2(r, y)), 64), enamel))
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.545, 64).rotateX(-Math.PI / 2).translate(0, 0.292, 0), lit(0xffffff, 0.5, 0, faceTex))
  timer.add(face)
  timer.add(new THREE.Mesh(new THREE.TorusGeometry(0.563, 0.03, 12, 72).rotateX(Math.PI / 2).translate(0, 0.292, 0), chrome))
  const dial = new THREE.Group() // the knob and the hand turn together
  dial.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.175, 0.2, 14).translate(0, 0.39, 0), bake))
  dial.add(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 24).translate(0, 0.5, 0), chrome))
  dial.add(new THREE.Mesh(merge([new THREE.BoxGeometry(0.045, 0.03, 0.5).translate(0, 0.325, -0.24), new THREE.BoxGeometry(0.03, 0.012, 0.13).translate(0, 0.512, -0.04)]), red))
  timer.add(dial)
  scene.add(timer)

  // ---------------------------------------------------------------- the stove's own knob

  const knobTex = canvasTex(512, 512, (c, w) => {
    c.fillStyle = "#1b1c1f"; c.fillRect(0, 0, w, w)
    c.translate(w / 2, w / 2)
    c.fillStyle = "#e9e4d6"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = `400 54px ${typer}`
    c.fillText("OFF", 0, -196)
    c.save(); c.rotate(2.1); c.fillText("ON", 0, -196); c.restore()
    c.strokeStyle = "#e9e4d6"; c.lineWidth = 7
    c.beginPath(); c.arc(0, 0, 196, -Math.PI / 2 + 0.36, -Math.PI / 2 + 2.1 - 0.26); c.stroke()
  })
  const knob = new THREE.Group()
  knob.position.set(KNOB.x, 0, KNOB.z)
  knob.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 48).rotateX(-Math.PI / 2).translate(0, 0.004, 0), lit(0xffffff, 0.35, 0, knobTex)))
  const knobTop = new THREE.Group()
  knobTop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 40).translate(0, 0.1, 0), chrome))
  knobTop.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.19).translate(0, 0.203, -0.1), red))
  knob.add(knobTop)
  scene.add(knob)

  // ---------------------------------------------------------------- sparks: closed-form arcs out of the pot

  const NS = 70
  const sparkGeo = new THREE.InstancedBufferGeometry()
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  sparkGeo.setIndex([0, 1, 2, 0, 2, 3])
  const sa = new Float32Array(NS * 4)
  for (let i = 0; i < NS * 4; i++) sa[i] = R()
  sparkGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(sa, 4))
  sparkGeo.instanceCount = NS
  sparkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 2.6)
  const aS = attribute("aS", "vec4")
  const sparkV = (() => {
    const life = aS.y.mul(0.9).add(0.7)
    const ph = uClock.div(life).add(aS.x.mul(9))
    const u = fract(ph)
    const id = floor(ph)
    const a = hash11(id.mul(0.37).add(aS.z.mul(91))).mul(TAU)
    const sp = hash11(id.mul(1.7).add(aS.w.mul(13))).mul(0.9).add(0.5)
    const ul = u.mul(life)
    const p = vec3(cos(a).mul(0.5).mul(aS.w), 1, sin(a).mul(0.5).mul(aS.w))
      .add(vec3(cos(a).mul(sp).mul(0.55), sp.mul(1.5), sin(a).mul(sp).mul(0.55)).mul(ul))
      .sub(vec3(0, 1.9, 0).mul(ul.mul(ul)))
    const alpha = smoothstep(0, 0.08, u).mul(u.oneMinus()).mul(smoothstep(0.75, 1, uHeat)).mul(step(0.35, hash11(id.add(aS.x.mul(3)))))
    const mv = cameraViewMatrix.mul(vec4(p, 1))
    return { clip: cameraProjectionMatrix.mul(vec4(mv.xy.add(positionGeometry.xy.mul(0.014).mul(aS.z.add(1))), mv.z, mv.w)), a: alpha }
  })()
  const spA = sparkV.a.toVarying()
  const sparks = new THREE.Mesh(sparkGeo, mk(sparkV.clip, vec4(vec3(7, 3.4, 0.9).mul(spA).mul(smoothstepRev(1, 0.2, length(vQ))), 0), ADD))
  scene.add(sparks)

  // ---------------------------------------------------------------- air: shimmer over the pot, glow in it, and steam as it cools

  const A = {
    tA: uniformTexture(stage.texture),
    uPot: uniform(new THREE.Vector3(0.5, 0.5, 0.2)),
    uHeat: uniform(1),
    uSteam: uniform(0),
    uBlur: uniform(0),
    uAsp: uniform(16 / 9),
    uGlow: uniform(new THREE.Vector3()),
  }
  const air = ctx.pass(({ uv, res, time }) => {
    const asp2 = vec2(A.uAsp, 1)
    const pr = max(A.uPot.z, 1e-3)
    const q = uv.sub(A.uPot.xy).mul(asp2).toVar()
    const d = length(q).div(pr).toVar()
    const m = smoothstepRev(2.4, 0.5, d).mul(A.uHeat).mul(A.uHeat).toVar()
    const suv = vec2(uv).toVar()
    // (outside the column of hot air the shimmer has no weight: its two fbm calls are skipped)
    If(m.greaterThan(0), () => {
      const base = uv.mul(asp2).mul(9)
      const w = vec2(fbm(base.add(vec2(0, time.mul(-0.9)))), fbm(base.add(vec2(5.2, time.mul(-0.9).add(3.1))))).sub(0.5)
      suv.addAssign(w.mul(m).mul(0.0085))
    })
    const c = sampleRT(A.tA, suv as V2).rgb.toVar()
    // rack focus: at first only the mouth of the pot is sharp, then the whole counter comes in
    const coc = A.uBlur.mul(smoothstep(0.5, 2.6, d)).toVar()
    If(coc.greaterThan(0.0004), () => {
      const j = hash21(floor(uv.mul(res)).add(0.5)).mul(6.283).toVar()
      const acc = vec3(c).toVar()
      const wsum = float(1).toVar()
      for (let i = 0; i < 12; i++) {
        const a = j.add(i * 2.39996)
        const t = sampleRT(A.tA, suv.add(vec2(cos(a).div(A.uAsp), sin(a)).mul(coc.mul(Math.sqrt((i + 0.5) / 12)))) as V2).rgb.toVar()
        const wt = luma(t).mul(2).add(1).toVar()
        acc.addAssign(t.mul(wt))
        wsum.addAssign(wt)
      }
      c.assign(acc.div(wsum))
    })
    c.addAssign(A.uGlow.mul(exp(d.mul(d).mul(-0.9)).mul(0.12).add(exp(d.mul(-0.9)).mul(0.012))))
    If(A.uSteam.greaterThan(0.001), () => {
      // wisps: warped noise drifting up the frame from the mouth, spreading as it goes
      const s = q.div(pr).toVar()
      const rise = s.y.add(0.2).toVar()
      const widen = max(rise, 0).mul(0.9).add(1.1)
      const plume = sstep(widen.mul(1.25) as F, 0.2, abs(s.x) as F).mul(smoothstep(-0.9, 0.1, rise)).mul(sstep(A.uSteam.mul(5).add(1.2) as F, 0.2, rise as F)).toVar()
      const sp = s.mul(vec2(1.5, 0.8)).sub(vec2(0, time.mul(0.42))).toVar()
      const n = fbm(sp.add(fbm(sp.mul(1.7).add(time.mul(0.1))).mul(1.6)))
      const a = smoothstep(0.44, 0.78, n.add(plume.mul(0.25))).mul(plume).mul(sat(A.uSteam.mul(1.6) as F))
      c.addAssign(vec3(0.16, 0.18, 0.22).add(A.uGlow.mul(0.25)).mul(a))
    })
    return vec4(c, 1)
  }, A)
  air.mat.name = "forgeAir"

  // ---------------------------------------------------------------- the schedule in seconds (camera, sound, type)

  // Sound (sheet: beats/sound-forge.md). Home harmonic 5: every pitch is a multiple of it. Each
  // sound is heard where its object is through the camera of the moment it fires.
  const cues: Cue[] = []
  const at3 = (x: number, y: number, z: number) => { const p = { x, y, z }; return (): Pos => listenerPos(p, cam) }
  const atTimer = at3(TIMER.x, 0.3, TIMER.z)
  const atKnob = at3(KNOB.x, 0.15, KNOB.z)
  const atPot = at3(0, 1.0, 0)
  // each fusion is a marimba note at that sphere: the fours are the tune, the pairs a murmur under it
  const fourOrder = [...fours].sort((a, b) => a.t - b.t)
  const scale = [10, 15, 20, 25, 30, 20, 25, 30, 35, 40, 45, 50]
  fourOrder.forEach((f, i) => {
    const at = COOK0 + (f.t + 0.05) * COOK_LEN
    const pos = at3(f.c[0], f.c[1], f.c[2])
    cues.push({ b: 1, at, s: "marimba", o: { f: H(scale[i % scale.length]), g: 0.8 }, pos }, { b: 1, at: at + 0.02, s: "glass", o: { f: H(scale[i % scale.length] * 4), g: 0.12 }, pos })
  })
  pairs.forEach((p, i) => cues.push({ b: 1, at: COOK0 + (p.t + 0.045) * COOK_LEN, s: "marimba", o: { f: H(40 + (i % 5) * 5), g: 0.2 }, pos: at3(p.c[0], p.c[1], p.c[2]) }))
  // the selection box picks up the recipe card
  cues.push({ b: 1, at: 0.7, s: "select", o: { f: H(40), g: 1.1 }, pos: at3(CARD.x, 0.05, CARD.z) })
  // the timer: wound, twenty ticks (every fourth is the minute), and the bell
  cues.push({ b: 1, at: COOK0 - 0.3, s: "gear", o: { f: H(40), dur: 0.22, g: 0.45 }, pos: atTimer })
  for (let i = 1; i <= 20; i++) cues.push({ b: 1, at: COOK0 + (i / 20) * COOK_LEN - 0.01, s: "tick", o: { g: i % 4 === 0 ? 0.6 : 0.4, f: H(i % 4 === 0 ? 60 : 80) }, pos: atTimer })
  const BELL = COOK0 + COOK_LEN
  // the big moment: five minutes. Three strokes at the timer, and the ring of light running out over the steel
  cues.push({ b: 1, at: BELL, s: "bell", o: { f: H(40), g: 0.9 }, pos: atTimer }, { b: 1, at: BELL + 0.16, s: "bell", o: { f: H(40), g: 0.6 }, pos: atTimer }, { b: 1, at: BELL + 0.34, s: "bell", o: { f: H(40), g: 0.45 }, pos: atTimer })
  cues.push({ b: 1, at: BELL + 0.05, s: "shimmer", o: { f: H(48), dur: 1.4, g: 0.3 } })
  // the stove is turned off: the knob's detents, the flame going out, steam, and the iron ticking as it cools
  cues.push({ b: 2, at: 0.42, s: "gear", o: { f: H(30), dur: 0.16, g: 0.7 }, pos: atKnob }, { b: 2, at: 0.62, s: "thud", o: { g: 0.35, f: H(5), lfe: 0.2 }, pos: atPot }, { b: 2, at: 1.2, s: "hiss", o: { g: 0.7, dur: 3.2 } })
  cues.push({ b: 2, at: 1.0, s: "pad", o: { f: H(10), dur: 7, g: 0.4 } })
  for (let i = 0; i < 9; i++) cues.push({ b: 2, at: 1.5 + 0.22 * i + 0.045 * i * i, s: "tick", o: { f: H(50 - i * 2), g: 0.4 - i * 0.03, wet: 2 }, pos: atPot })

  // ---------------------------------------------------------------- per-frame state (all of it allocated here, once)

  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), look = new THREE.Vector3()
  const mouth = [new THREE.Vector3(-1.0, 1.1, -1.0), new THREE.Vector3(1.0, 1.1, -1.0), new THREE.Vector3(1.0, 1.1, 1.0), new THREE.Vector3(-1.0, 1.1, 1.0)]
  const port: Portal = { c: [[0, 0], [0, 0], [0, 0], [0, 0]], a: 1, shade: 1 }
  let hasPort = false
  const st = { blur: 0, heat: 1, cook: 0, flare: 0, ring: 0, lean: 0, steam: 0, sel: [0, 0, 0, 0] }
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.26, bloomThresh: 1.3, bloomRadius: 0.9, halation: 0.55, contrast: 1.2, sat: 1.16, vignette: 0.34, grain: 0.024, ca: 0.0025, lift: [0.002, 0.006, 0.014], gain: [1.03, 1, 0.97] }
  const TITLES = { color: "#fff6ea", shadow: "rgba(8,9,14,0.6)", delay: [1.9, 0.45, 0.6], maxLine: 40, heads: ["One second old.\nTen billion degrees."] }
  const HUD = { color: "#ffeedd", shadow: "rgba(0,0,0,0.5)" }

  function update(s: State) {
    const t0 = s.at(0)
    const arriving = s.beat === 0 && t0 < 0
    // --- story
    const cook = s.k(1, COOK0, COOK0 + COOK_LEN, E.lin)
    const off = s.k(2, 0.42, 0.6, E.io2) // the knob
    const cool = s.k(2, 0.7, 5.0, E.out2)
    const fill = arriving ? smooth(0.25, 0.92, s.enter) : 1
    const flare = arriving ? smooth(0.5, 1, s.enter) : Math.exp(-Math.max(t0, 0) * 1.25)
    let heat = mix(1, 0.21, cool) + 0.16 * flare
    heat += 0.025 * Math.sin(s.time * 9.1) * Math.sin(s.time * 5.3) * (1 - cool) + 0.06 * smooth(0.5, 1, cook) * (1 - cool)
    if (arriving) heat = mix(0.03, heat, fill)
    // the jitter clock runs with the scene, then winds down to a stop as it cools
    const t2 = Math.max(0, s.at(2) > 9e3 ? 0 : s.at(2))
    const D = 4.6
    const x = Math.min(t2, D) / D
    const clock = s.time - t2 + (s.beat === 2 ? (D / 3) * (1 - (1 - x) ** 3) : 0)
    const flame = (arriving ? fill : 1) * (1 - s.k(2, 0.5, 1.1, E.out3)) * (0.9 + 0.1 * Math.sin(s.time * 23))
    uHeat.value = heat
    uClock.value = clock
    uFlame.value = flame
    uCook.value = cook
    uJit.value = mix(1, 0.0, smooth(0, 1, x)) * (0.75 + 0.5 * flare + 0.3 * smooth(0.4, 0.9, cook))
    uFill.value = arriving ? E.out3(smooth(0.3, 1, s.enter)) : 1
    // nothing is drawn for what has no weight: the flames once the gas is off, sparks below their heat, shells before the first four
    flames.visible = flame > 0
    sparks.visible = heat > 0.75
    shells.visible = cook > 0.5
    // --- timer: the hand, then the bell shaking the whole thing
    const tb = s.at(1) - BELL
    const rung = s.beat > 1 ? 0 : tb > 0 ? Math.exp(-tb * 2.6) : 0
    dial.rotation.y = -(cook * SWEEP + (tb > 0 && s.beat === 1 ? 0.05 * Math.exp(-tb * 7) * Math.sin(tb * 38) : 0))
    timer.position.set(TIMER.x + rung * 0.016 * Math.sin(s.time * 97), 0, TIMER.z + rung * 0.016 * Math.sin(s.time * 83 + 1))
    timer.rotation.y = rung * 0.045 * Math.sin(s.time * 71)
    uRing.value = s.beat === 1 && tb > 0 ? clamp(tb / 0.9) : 0
    knobTop.rotation.y = -2.1 * (1 - off)
    // the pot rattles on its grate while it is at its hottest
    const rat = (0.5 * flare + 0.25 * (1 - cool)) * (arriving ? fill : 1)
    pot.rotation.set(rat * 0.006 * Math.sin(s.time * 41), 0, rat * 0.006 * Math.sin(s.time * 37 + 2))
    // --- camera: over the mouth while the pour lands, crane up and back, lean to the timer for the bell, settle wide
    const crane = s.k(0, 0.1, 4.4, E.io3)
    // a whip to the timer that overshoots and settles just as the bell goes
    const lean = E.outBack(s.k(1, 6.35, 7.2, E.out2)) * (1 - s.k(1, BELL + 0.9, 9, E.io3))
    v0.set(0.0, 4.5, 2.55).lerp(v1.set(-1.13, 7.8, 2.55), crane)
    look.set(0.0, 0.8, 0.12).lerp(v1.set(-1.28, 0.5, -0.55), crane)
    const back = 1 - s.k(1, BELL + 0.7, 9, E.io3)
    const push = s.k(1, 0.2, 6.3, E.io2) * back
    v0.lerp(v1.set(-0.8, 6.3, 2.15), push * (1 - lean))
    look.lerp(v1.set(-0.95, 0.58, -0.36), push * (1 - lean))
    v0.lerp(v1.set(1.75, 4.9, 1.35), lean)
    look.lerp(v1.set(TIMER.x - 0.75, 0.2, TIMER.z - 0.5), lean)
    // as the stove cools the camera backs away, and keeps creeping while the line is said
    const away = 0.07 * s.k(2, 0, 5, E.out2) + 0.05 * s.k(2, 5, 30, E.lin)
    v0.x += (v0.x - look.x) * away; v0.y += (v0.y - look.y) * away; v0.z += (v0.z - look.z) * away
    const dr = 0.05 + 0.05 * crane
    v0.x += dr * (Math.sin(s.time * 0.31) + 0.5 * Math.sin(s.time * 0.73 + 1)) + s.mouse.x * 0.22
    v0.z += dr * (Math.sin(s.time * 0.27 + 2) + 0.5 * Math.sin(s.time * 0.61)) - s.mouse.y * 0.16
    v0.y += dr * 0.6 * Math.sin(s.time * 0.23 + 4)
    // the heat throws the camera about a little at the start, and the bell gives it a knock
    const jolt = 0.02 * flare * (arriving ? fill : 1) + 0.012 * rung + (t0 >= 0 && s.beat === 0 ? 0.06 * Math.exp(-t0 * 4.5) : 0)
    v0.x += jolt * Math.sin(s.time * 31.7)
    v0.y += jolt * Math.sin(s.time * 27.1 + 1.7)
    cam.position.copy(v0)
    cam.up.set(0, 1, 0)
    cam.lookAt(look)
    cam.rotateZ(-0.035 * crane + 0.02 * lean)
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    // the mouth of the pot on screen: the portal the pour runs into
    for (let i = 0; i < 4; i++) {
      v1.copy(mouth[i]).project(cam)
      port.c[i][0] = v1.x
      port.c[i][1] = v1.y
    }
    hasPort = true
    // where the pot is on screen, for the air pass
    v1.set(0, 1.0, 0).project(cam)
    const cx = v1.x * 0.5 + 0.5, cy = v1.y * 0.5 + 0.5
    v1.set(1.0, 1.0, 0).project(cam)
    A.uPot.value.set(cx, cy, Math.abs(v1.x * 0.5 + 0.5 - cx) * (s.w / s.h))
    // the card's screen rectangle, for the selection box
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (let i = 0; i < 4; i++) {
      v1.copy(cardCorners[i]).project(cam)
      const px = (v1.x * 0.5 + 0.5) * DW, py = (0.5 - v1.y * 0.5) * DH
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    st.sel[0] = x0; st.sel[1] = y0; st.sel[2] = x1 - x0; st.sel[3] = y1 - y0
    st.heat = heat
    st.blur = 0.028 * (1 - s.k(0, 0.6, 3.6, E.io2))
    st.cook = cook
    st.flare = flare
    st.ring = rung
    st.lean = lean
    st.steam = s.k(2, 1.6, 5.2, E.io2) * 0.3 + s.exit * 1.2
    // sound: the fire thins as the pot cools; its pops go with the gas flame; steam is the air
    if (s.live) {
      // (while the glass is still pouring in, the fire is the one the last scene left burning)
      ctx.synth.bed("fire", arriving ? mix(0.5, clamp(heat * 0.8 - 0.1), fill) : clamp(heat * 0.8 - 0.1))
      ctx.synth.bed("crackle", clamp(0.45 * flame + 0.3 * flare * (arriving ? fill : 1)))
      // (`steam` goes on rising with `s.exit`: this is the hush of the hand-off into the fog)
      ctx.synth.bed("air", clamp(st.steam * 1.2))
    }
  }

  return {
    cues,
    update,
    // what this scene draws and into what, so its pipelines are compiled before it is shown
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: air, target: post },
    ],
    render(s) {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam) // (the renderer clears the target itself)
      A.tA.value = stage.texture
      A.uHeat.value = clamp(st.heat)
      A.uSteam.value = st.steam
      A.uBlur.value = st.blur
      A.uAsp.value = s.w / s.h
      const h = st.heat
      A.uGlow.value.set(1.0 * h * h, 0.34 * h * h * h, 0.06 * h * h * h)
      air.render(post)
      const f = st.flare
      POST.exposure = 1.0 + 1.7 * f * f
      POST.bloom = 0.26 + 1.0 * f + 0.25 * st.ring
      ctx.finish(post.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      // the deck's selection frame picks up the recipe card as its instruction is read out
      const a = s.k(1, 0.7, 0.85, E.out3) * (1 - s.k(1, 3.4, 3.9, E.io2))
      if (s.beat === 1 && a > 0) {
        const pad = 14 + 3 * Math.sin(s.time * 2.1) + 44 * (1 - s.k(1, 0.7, 1.05, E.outBack))
        g.selbox(st.sel[0] - pad, st.sel[1] - pad, st.sel[2] + pad * 2, st.sel[3] + pad * 2, a)
      }
    },
    hud: () => HUD,
    portal: () => (hasPort ? port : null),
    dispose() {
      // every geometry and material hangs off the scene; the textures live only inside node graphs.
      // (the stage, the post target and the air pass were made through ctx: the engine frees them)
      disposeTree(scene)
      sph.dispose()
      cardTex.dispose()
      faceTex.dispose()
      knobTex.dispose()
    },
  }
}
