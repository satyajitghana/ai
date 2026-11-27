// 12 → 13. The torch.
//
// spark ends on a hearth lighting a rock shelter. A brand is lifted out of that fire and carried
// toward the lens and across it, right to left: a resinous branch with a charred head, a flame of
// instanced tongues that rise, thin and tear off (leaning away from the way it is carried), sparks
// on ballistic paths, smoke lit from below. The light leaves with it: the hearth's frame is lit only
// inside the brand's pool, and what the brand has passed is night. That night is already the cave:
// behind the flame the incoming scene is showing, and its own torch is this same brand (`makeBrand`
// below is the one object both draw), so the only light in it is the flame's. At TORCH_LAND the
// scene thrusts the brand at the wall and the first hand is lit: that is `hands`' clock zero.
//
// What crosses the cut is the fire. Everything is closed-form in the linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp, cos, dot, exp, float, Fn, fract, length, max, mix, modelWorldMatrix, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, sin, smoothstep, uniform, uniformTexture, uv, vec2, vec3, vec4 } from "three/tsl"

import { rng } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, sampleRT, toLinear, toSRGB, vnoise, type F, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"
import { SPARK_BRAND } from "../engine/people"

export const TORCH_DUR = 3.0
/** The thrust at the wall: scenes/hands.ts starts its clock here. */
export const TORCH_LAND = 0.72
/** Progress at which the flame is across the lens and the cave is all there is behind it. */
export const TORCH_CROSS = 0.53

// ---------------------------------------------------------------- the brand: one object, drawn by the transition and by the scene

export type Brand = {
  /** Add to a scene. World space: leave its transform alone. */
  group: THREE.Group
  /**
   * Place it for this frame. `head` is the burning end, `handle` a unit vector from the head down
   * the stick, `lean` how far the flame trails (metres at its tip, world space: minus the velocity,
   * scaled), `power` 0..1, `burst` 0..1 extra sparks, `time` the caller's seekable clock.
   */
  set(head: THREE.Vector3, handle: THREE.Vector3, lean: THREE.Vector3, camera: THREE.Camera, time: number, power: number, burst?: number): void
  /** Where the light comes from this frame (the flame's bright body), world space. */
  light: THREE.Vector3
  dispose(): void
}

const TONGUES = 96
const SPARKS = 140
const PUFFS = 20
const FLAME_H = 0.3 // metres, base to tip in still air

function instQuad(n: number, seed: number, ySeg = 1) {
  const p = new THREE.PlaneGeometry(1, 1, 1, ySeg)
  const g = new THREE.InstancedBufferGeometry()
  g.index = p.index
  g.setAttribute("position", p.getAttribute("position"))
  g.setAttribute("uv", p.getAttribute("uv"))
  const R = rng(seed)
  const a = new Float32Array(n * 4)
  for (let i = 0; i < n * 4; i++) a[i] = R()
  // (the first component is the instance's rank, so a count can be dialled by a threshold)
  for (let i = 0; i < n; i++) a[i * 4] = (i + 0.5) / n
  g.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
  g.instanceCount = n
  return g
}

/**
 * `coc`: a scene that keeps its depth of field in alpha passes its circle-of-confusion function: the
 * stick writes it, and the smoke leaves alpha as it found it. (The transition's own layer reads the
 * smoke's alpha as cover, so it does not pass one.)
 */
export function makeBrand(o: { stick?: boolean; scale?: number; coc?: (P: V3) => F } = {}): Brand {
  const S = o.scale ?? 1
  const U = {
    uT: uniform(0),
    uPow: uniform(1),
    uBurst: uniform(0),
    uLean: uniform(new THREE.Vector3()),
    uRight: uniform(new THREE.Vector3(1, 0, 0)),
    uFwd: uniform(new THREE.Vector3(0, 0, -1)),
  }
  const group = new THREE.Group()
  const fire = new THREE.Group()
  group.add(fire)
  const VP = cameraProjectionMatrix.mul(cameraViewMatrix)
  const origin = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz
  const aS = attribute("aS", "vec4") as V4
  const q = positionGeometry
  const st = uv()
  const add = <T extends THREE.Mesh>(m: T, order: number) => {
    m.frustumCulled = false
    m.renderOrder = order
    fire.add(m)
    return m
  }
  const additive = (frag: THREE.Node, vert: THREE.Node) => {
    const m = new THREE.NodeMaterial()
    m.vertexNode = vert as THREE.Node<"vec4">
    m.fragmentNode = frag
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.CustomBlending
    m.blendSrc = THREE.OneFactor
    m.blendDst = THREE.OneFactor
    m.blendSrcAlpha = THREE.ZeroFactor
    m.blendDstAlpha = THREE.OneFactor
    m.side = THREE.DoubleSide
    return m
  }

  // ---- tongues: each is a ribbon that is born at the head, climbs, thins and tears off
  {
    const u = fract(U.uT.mul(aS.z.mul(1.3).add(1.5)).add(aS.y)).toVar()
    const v = st.y
    const len = aS.w.mul(0.3).add(0.36).mul(u.mul(0.55).oneMinus()).mul(FLAME_H)
    const y = u.mul(0.62 * FLAME_H).add(v.mul(len)).toVar()
    const yN = y.div(FLAME_H).toVar()
    const ph = aS.x.mul(41.3)
    const sway = sin(y.mul(34).sub(U.uT.mul(11)).add(ph)).mul(0.014).add(sin(y.mul(13).sub(U.uT.mul(5.3)).add(ph.mul(1.7))).mul(0.02)).mul(yN)
    const side = fract(aS.x.mul(7.31)).sub(0.5)
    const depth = fract(aS.x.mul(13.7)).sub(0.5)
    // the body is widest a third of the way up and closes to a point
    const body = pow(max(yN.mul(1.25).oneMinus(), 0.0), 0.7).mul(0.5).add(0.12)
    const w = body.mul(0.11).mul(v.oneMinus().pow(0.55)).mul(aS.w.mul(0.5).add(0.6))
    const lean = U.uLean.mul(yN.mul(yN).mul(aS.z.mul(0.5).add(0.75)))
    const local = U.uRight.mul(side.mul(0.07).mul(yN.mul(0.8).oneMinus().max(0.15)).add(sway).add(q.x.mul(w))).add(vec3(0, y, 0)).add(U.uFwd.mul(depth.mul(0.05))).add(lean)
    const heat = u.oneMinus().pow(1.3).mul(v.mul(0.75).oneMinus()).toVarying()
    const sd = aS.x.toVarying()
    const frag = Fn(() => {
      const x = st.x.sub(0.5).mul(2)
      const tear = vnoise(vec2(x.mul(1.6).add(sd.mul(57)), st.y.mul(3.2).sub(U.uT.mul(2.6)).add(sd.mul(9))))
      const m = smoothstep(1.0, 0.25, abs(x)).mul(smoothstep(0.0, 0.12, st.y)).mul(smoothstep(0.25, 0.6, tear.add(st.y.oneMinus().mul(0.55))))
      const h = heat.mul(m).toVar()
      const c = mix(vec3(1.5, 0.16, 0.015), vec3(3.2, 1.05, 0.14), smoothstep(0.05, 0.4, h)).toVar()
      c.assign(mix(c, vec3(5.2, 3.5, 1.5), smoothstep(0.38, 0.85, h)))
      return vec4(c.mul(h).mul(U.uPow).mul(0.3), 0)
    })()
    add(new THREE.Mesh(instQuad(TONGUES, 131, 5), additive(frag, VP.mul(vec4(origin.add(local.mul(S)), 1)))), 21)
  }
  // ---- the incandescent body at the head: one soft card
  {
    const local = U.uRight.mul(q.x.mul(0.2)).add(vec3(0, q.y.mul(0.26).add(0.07), 0)).add(U.uLean.mul(0.12))
    const frag = Fn(() => {
      const d = length(st.sub(vec2(0.5, 0.42)).mul(vec2(1.25, 1)))
      const g = exp(d.mul(d).mul(-26)).mul(0.55).add(exp(d.mul(d).mul(-5)).mul(0.1)).mul(smoothstep(0.5, 0.22, d))
      const fl = sin(U.uT.mul(23)).mul(0.08).add(sin(U.uT.mul(37.7)).mul(0.05)).add(1)
      return vec4(vec3(3.4, 1.7, 0.45).mul(g).mul(fl).mul(U.uPow), 0)
    })()
    add(new THREE.Mesh(instQuad(1, 7), additive(frag, VP.mul(vec4(origin.add(local.mul(S)), 1)))), 20)
  }
  // ---- sparks: thrown up and out, slowed by the air, lifted by the heat, cooling as they go
  {
    const on = float(1).sub(smoothstep(0.0, 0.02, aS.x.sub(U.uBurst.mul(0.8).add(0.2)))).toVar()
    const rate = aS.z.mul(0.5).add(0.45).add(U.uBurst.mul(0.5))
    const u = fract(U.uT.mul(rate).add(aS.y)).toVar()
    const age = u.mul(1.3)
    const ang = aS.w.mul(6.2832)
    const el = fract(aS.x.mul(91.7)).mul(1.1).add(0.25)
    const sp = fract(aS.x.mul(27.1)).mul(0.5).add(0.22).mul(U.uBurst.mul(1.6).add(1))
    const v0 = vec3(cos(ang).mul(cos(el)), sin(el), sin(ang).mul(cos(el))).mul(sp)
    const drag = float(1).sub(exp(age.mul(-2.4))).div(2.4)
    const curl = vec3(sin(age.mul(9).add(ang)), 0, cos(age.mul(7).add(ang.mul(2)))).mul(0.018).mul(age)
    const c = v0.mul(drag).add(vec3(0, age.mul(0.16).add(age.mul(age).mul(0.1)).add(0.05), 0)).add(curl).add(U.uLean.mul(age.mul(1.6)))
    const sz = float(0.0035).mul(fract(aS.x.mul(5.3)).add(0.6))
    const local = c.add(U.uRight.mul(q.x.mul(sz))).add(vec3(0, q.y.mul(sz).mul(u.oneMinus().mul(3).add(1)), 0))
    const k = u.oneMinus().pow(2).mul(on).mul(smoothstep(0.0, 0.04, u)).toVarying()
    const frag = Fn(() => {
      const d = length(st.sub(0.5).mul(2))
      return vec4(mix(vec3(2.2, 0.35, 0.04), vec3(7, 3.4, 0.9), k).mul(smoothstep(1, 0.2, d)).mul(k).mul(U.uPow.mul(0.6).add(0.4)), 0)
    })()
    add(new THREE.Mesh(instQuad(SPARKS, 977), additive(frag, VP.mul(vec4(origin.add(local.mul(S)), 1)))), 22)
  }
  // ---- smoke: puffs that swell as they climb, lit by the flame under them
  {
    const u = fract(U.uT.mul(aS.z.mul(0.1).add(0.17)).add(aS.y)).toVar()
    const rise = u.mul(1.5).add(0.2)
    const sway = vec3(sin(u.mul(7).add(aS.x.mul(50))), 0, cos(u.mul(5).add(aS.x.mul(31)))).mul(0.07).mul(u)
    const c = vec3(aS.w.sub(0.5).mul(0.1).mul(u.add(0.3)), rise, 0).add(sway).add(U.uLean.mul(u.mul(2.4).add(0.3)))
    const sz = u.mul(0.42).add(0.1)
    const local = c.add(U.uRight.mul(q.x.mul(sz))).add(vec3(0, q.y.mul(sz).mul(1.25), 0))
    const uu = u.toVarying()
    const sd = aS.x.toVarying()
    const m = new THREE.NodeMaterial()
    m.vertexNode = VP.mul(vec4(origin.add(local.mul(S)), 1)) as THREE.Node<"vec4">
    m.fragmentNode = Fn(() => {
      const p = st.sub(0.5).mul(2)
      const wq = p.mul(1.4).add(vec2(sd.mul(37), uu.mul(2.2).add(sd.mul(11))))
      const wisp = vnoise(wq).mul(0.65).add(vnoise(wq.mul(2.3).add(5.1)).mul(0.35))
      const a = smoothstep(1, 0.15, length(p).add(wisp.sub(0.5).mul(0.9))).mul(sin(uu.mul(3.1416)).pow(0.7)).mul(0.3).mul(U.uPow)
      const lit = vec3(0.9, 0.36, 0.1).div(uu.mul(7).pow(2).add(1)).add(vec3(0.02, 0.021, 0.026))
      return vec4(lit.mul(wisp.mul(0.7).add(0.65)).mul(a), a)
    })()
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.CustomBlending
    m.blendSrc = THREE.OneFactor
    m.blendDst = THREE.OneMinusSrcAlphaFactor
    if (o.coc) {
      m.blendSrcAlpha = THREE.ZeroFactor
      m.blendDstAlpha = THREE.OneFactor
    }
    m.side = THREE.DoubleSide
    add(new THREE.Mesh(instQuad(PUFFS, 4421), m), 19)
  }
  // ---- the branch: bark, a charred head, embers glowing in its cracks
  const stick = new THREE.Group()
  if (o.stick !== false) {
    const g = new THREE.CylinderGeometry(0.017, 0.011, 0.62, 12, 10)
    g.translate(0, -0.29, 0)
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const P = positionLocal
      const a = P.y.negate() // metres down from the head
      const grain = vnoise(vec2(P.x.mul(180).add(P.z.mul(140)), P.y.mul(26))).mul(0.6).add(vnoise(vec2(P.z.mul(300), P.y.mul(90))).mul(0.4))
      const char = smoothstep(0.17, 0.03, a.add(grain.mul(0.04)))
      const bark = mix(vec3(0.16, 0.1, 0.06), vec3(0.3, 0.2, 0.12), grain)
      const ember = smoothstep(0.72, 0.9, fbm(vec2(P.x.mul(300).add(P.z.mul(260)), P.y.mul(210).add(U.uT.mul(0.3))))).mul(smoothstep(0.05, 0.0, a))
      const N = normalize(normalWorld)
      const lit = max(N.y.mul(0.75).add(0.35), 0).div(a.mul(9).pow(2).add(1)).mul(2.6)
      const c = mix(bark, vec3(0.012, 0.01, 0.01), char).mul(vec3(1.5, 0.7, 0.3).mul(lit).mul(U.uPow).add(vec3(0.02, 0.022, 0.03)))
      return vec4(c.add(vec3(1.6, 0.3, 0.03).mul(ember).mul(sin(U.uT.mul(3).add(P.y.mul(80))).mul(0.25).add(0.75)).mul(U.uPow)), o.coc ? o.coc(positionWorld as V3) : float(1))
    })()
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    stick.add(mesh)
    stick.scale.setScalar(S)
    group.add(stick)
  }

  const light = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3()
  return {
    group,
    light,
    set(head, handle, lean, camera, time, power, burst = 0) {
      fire.position.copy(head)
      stick.position.copy(head)
      stick.quaternion.setFromUnitVectors(up, tmp.copy(handle).negate())
      U.uT.value = time
      U.uPow.value = power
      U.uBurst.value = burst
      U.uLean.value.copy(lean)
      camera.updateMatrixWorld()
      const e = camera.matrixWorld.elements
      U.uRight.value.set(e[0], e[1], e[2])
      U.uFwd.value.set(-e[8], -e[9], -e[10])
      light.copy(head).addScaledVector(lean, 0.3)
      light.y += 0.1 * S
      group.updateMatrixWorld(true)
    },
    dispose() {
      group.traverse((x) => {
        const m = x as THREE.Mesh
        m.geometry?.dispose?.()
        ;(m.material as THREE.Material | undefined)?.dispose?.()
      })
    },
  }
}

// ---------------------------------------------------------------- the carry

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const FOV = 35
const TAN = Math.tan((FOV * Math.PI) / 360)
const NEAR = 0.4

// ---------------------------------------------------------------- where the brand starts: spark's own stick, through spark's own lens
// spark's last beat ends pulled back on the hearth; its camera there, in closed form (spark.ts, beat 3 after
// the pull back: target, distance, azimuth, elevation, the frame slid by `look`, FOV 30), in spark's units
// (SPARK_BRAND.unit metres). Spark's lens drifts through the hold and stops where the hold ends (dur + hold),
// however long live play lingers, so through the whole hand-off it is that one camera.
const SP = { fov: 30, tgt: [SPARK_BRAND.hearth[0] - 0.4, 3.0, SPARK_BRAND.hearth[2] - 2] as const, dist: 33, az: -0.1, el: 0.1, look: [-0.25, -0.12] as const, end: 4.5 + 4.5, flame: 3.9 + 3.2 }
const spCam = new THREE.PerspectiveCamera(SP.fov, 16 / 9, 0.1, 400)
const spV = new THREE.Vector3(), spW = new THREE.Vector3()
/** The brand's head on spark's last frame, as a point in the carry camera's space (metres) that lands on the same pixel at the same size, and its stick's direction. */
function sparkStart(asp: number, head: THREE.Vector3, handle: THREE.Vector3) {
  const hold = SP.end - SP.flame
  const dist = SP.dist - 0.15 * hold, az = SP.az + 0.006 * hold
  spCam.aspect = asp
  spCam.updateProjectionMatrix()
  spCam.position.set(Math.sin(az) * Math.cos(SP.el), Math.sin(SP.el), Math.cos(az) * Math.cos(SP.el)).multiplyScalar(dist).add(spV.set(SP.tgt[0], SP.tgt[1], SP.tgt[2]))
  spCam.up.set(0, 1, 0)
  spCam.lookAt(SP.tgt[0], SP.tgt[1], SP.tgt[2])
  const span = dist * Math.tan((SP.fov * Math.PI) / 360)
  spCam.translateX(SP.look[0] * span)
  spCam.translateY(SP.look[1] * span)
  spCam.updateMatrixWorld()
  spCam.matrixWorldInverse.copy(spCam.matrixWorld).invert()
  const to = SPARK_BRAND.to, from = SPARK_BRAND.from
  spV.set(to[0], to[1], to[2]).applyMatrix4(spCam.matrixWorldInverse)
  // (metres; depth scaled by the ratio of the lenses so the brand is as big as spark's stick on screen)
  const k = Math.tan((SP.fov * Math.PI) / 360) / TAN
  head.set(spV.x * SPARK_BRAND.unit, spV.y * SPARK_BRAND.unit, spV.z * SPARK_BRAND.unit * k)
  spW.set(from[0] - to[0], from[1] - to[1], from[2] - to[2]).transformDirection(spCam.matrixWorldInverse)
  handle.copy(spW)
}
const s0 = new THREE.Vector3(), h0 = new THREE.Vector3()
/** The brand's head in the carry camera's space at progress pl, and how hard it burns; `handle` gets the stick's direction. */
function carry(pl: number, asp: number, out: THREE.Vector3, handle?: THREE.Vector3) {
  sparkStart(asp, s0, h0)
  const FAR = -s0.z
  const u0 = 0.5 + s0.x / (2 * TAN * asp * FAR)
  const lift = sm(0.0, 0.2, pl)
  const go = sm(0.12, 0.57, pl)
  // depth falls geometrically, so it grows on screen at a steady rate and then rushes the lens
  const z = FAR * Math.pow(NEAR / FAR, Math.pow(go, 1.35))
  // screen-space course: from the hearth, up, then across to the left and out
  const sx = (u0 * 2 - 1) * (1 - go) + -1.7 * Math.pow(go, 1.8)
  const step = Math.abs(Math.sin(pl * Math.PI * 5.2)) * 0.035 * go * (1 - go) * 4
  const x = s0.x * (1 - go) + sx * TAN * asp * z * go
  const y = s0.y * (z / FAR) + lift * 0.34 * (FAR / 4.6) * (z / FAR) + (0.02 - 0.1 * go) * go + step * z
  if (handle) {
    // lifted by its cold end out of the fire: from lying along spark's stick to held upright, leaning toward the carrier
    const up = sm(0.0, 0.16, pl)
    handle.set(0.18 + 0.3 * sm(0.3, 0.6, pl), -1, 0.35).normalize().multiplyScalar(up).addScaledVector(h0, 1 - up).normalize()
  }
  return out.set(x, y, -z)
}
const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "crackle", o: { g: 0.7, dur: 0.6, pos: [0.3, -0.2, 0.8] }, p: 0.02 },
  { s: "scratch", o: { f: 180, g: 0.3, dur: 0.3, pos: [0.3, -0.3, 0.8] }, p: 0.04 },
  { s: "whoosh", o: { f: 190, dur: 1.1, g: 0.55, pos: [0.2, 0, 0.2] }, p: 0.26 },
  { s: "crackle", o: { g: 0.8, dur: 0.5, pos: [-0.5, 0, -0.2] }, p: 0.44 },
  { s: "rumble", o: { f: H(2), dur: 1.2, g: 0.35 }, p: 0.4 },
  { s: "riser", o: { dur: 0.5, g: 0.35 }, p: TORCH_LAND - 0.5 / TORCH_DUR },
  { s: "sub", o: { g: 0.8, dur: 1.4 }, p: TORCH_LAND },
  { s: "thud", o: { f: 90, g: 0.7, pos: [-0.5, 0, 0.5] }, p: TORCH_LAND },
  { s: "crackle", o: { g: 1, dur: 0.8, pos: [-0.5, 0.1, 0.5] }, p: TORCH_LAND },
]

const t: TransitionDef = {
  id: "torch",
  dur: TORCH_DUR,
  inAt: TORCH_LAND,
  ease: (x) => x,
  snd,
  sound(pl, _prev, synth) {
    const near = sm(0.1, 0.5, pl) * (1 - 0.4 * sm(0.6, 0.72, pl))
    synth.bed("fire", 0.35 + 0.65 * near)
    synth.bed("crackle", 0.3 + 0.6 * near)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const layer = ctx.target({ hdr: true, depth: false, scale: 0.5 })
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.02, 30)
    const scene = new THREE.Scene()
    const brand = makeBrand()
    scene.add(brand.group)
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tL: uniformTexture(layer.texture),
      p: uniform(0),
      uAsp: uniform(16 / 9),
      /** The flame on screen: uv.xy, its size in frame heights, its power. */
      uF: uniform(new THREE.Vector4(0.5, 0.5, 0.1, 0)),
    }
    const pass = ctx.pass(({ uv: st }) => {
      const p = U.p
      const A = toLinear(sampleRT(U.tA, st).rgb).toVar()
      const B = toLinear(sampleRT(U.tB, st).rgb).toVar()
      const asp2 = vec2(U.uAsp, 1)
      const d = length(st.sub(U.uF.xy).mul(asp2)).toVar()
      const r = U.uF.z
      // the pool: what the flame lights of the old frame, inverse-square on its own size
      const pool = r.mul(r).mul(5).div(d.mul(d).add(r.mul(r).mul(1.2))).toVar()
      const dark = smoothstep(0.04, 0.3, p).toVar()
      // what it has passed is night (it travels right to left)
      const passed = smoothstep(-0.02, 0.3, st.x.sub(U.uF.x)).mul(smoothstep(0.2, 0.4, p))
      const lum = dot(A, vec3(0.2126, 0.7152, 0.0722))
      const aLit = A.mul(mix(float(1), clamp(pool, 0.0, 1.5).mul(0.95).add(0.012), dark)).add(vec3(1.6, 0.62, 0.2).mul(lum.add(0.01)).mul(clamp(pool, 0, 3)).mul(dark).mul(0.22)).mul(passed.mul(0.96).oneMinus()).toVar()
      // behind the flame it is already the cave
      const wipe = max(smoothstep(0.0, 0.3, st.x.sub(U.uF.x)).mul(smoothstep(0.28, 0.42, p)), smoothstep(TORCH_CROSS - 0.03, TORCH_CROSS + 0.07, p)).toVar()
      const base = mix(aLit, B, wipe).toVar()
      // the brand itself, over both: smoke darkens, fire is added and rolled off
      const L = sampleRT(U.tL, st).toVar()
      const glow = vec3(1.0, 0.42, 0.12).mul(r.mul(r).mul(0.9).div(d.mul(d).add(r.mul(r).mul(0.6)))).mul(U.uF.w)
      // close to the lens the fire is a veil of heat over everything
      const veil = vec3(1.0, 0.5, 0.16).mul(exp(d.mul(d).div(r.mul(r).mul(1.6)).negate())).mul(smoothstep(0.45, 1.3, r)).mul(U.uF.w)
      const fire = L.rgb.mul(2.4).add(glow.mul(0.12)).add(veil.mul(0.1))
      const col = base.mul(L.a.oneMinus()).toVar()
      const tm = vec3(1).sub(exp(fire.mul(-1.15)))
      col.assign(vec3(1).sub(vec3(1).sub(clamp(col, 0, 1)).mul(vec3(1).sub(tm))))
      return vec4(toSRGB(clamp(col, 0, 1)), 1)
    }, U)

    const head = new THREE.Vector3()
    const prev = new THREE.Vector3()
    const lean = new THREE.Vector3()
    const handle = new THREE.Vector3()
    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        cam.aspect = asp
        cam.updateProjectionMatrix()
        const pl = a.pl
        carry(pl, asp, head, handle)
        carry(Math.max(0, pl - 0.012), asp, prev)
        // the flame trails behind the motion; the handle points down and toward the carrier, who walks at the lens
        lean.copy(prev).sub(head).multiplyScalar(2.2)
        lean.z *= 0.25
        if (lean.length() > 0.2) lean.setLength(0.2)
        const power = sm(0.0, 0.07, pl) * (1 - sm(TORCH_CROSS - 0.02, TORCH_CROSS + 0.08, pl))
        brand.set(head, handle, lean, cam, a.time, power, 0.25 * sm(0.0, 0.1, pl) * (1 - sm(0.1, 0.3, pl)))
        const r = ctx.renderer
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(layer)
        r.render(scene, cam)
        const z = -head.z
        U.uF.value.set(0.5 + head.x / (2 * TAN * asp * z), 0.5 + (head.y + 0.12) / (2 * TAN * z), (0.5 * FLAME_H) / (TAN * z), power)
        U.uAsp.value = asp
        U.tA.value = a.A
        U.tB.value = a.B
        U.tL.value = layer.texture
        U.p.value = pl
        pass.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: layer },
        { pass, target: hold },
      ],
      dispose() {
        brand.dispose()
        pass.dispose()
      },
    }
  },
}

export default t
