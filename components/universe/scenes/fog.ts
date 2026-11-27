// Scene 4, "The fog lifts": one photon, followed.
//
// First half: a chase camera behind the photon inside a glowing orange volume. Its path so far is
// a tube through instanced electron glints and soft fog cards; every scatter is a kink in the tube
// and a knock to the camera. Then electrons snap onto nuclei, a clear bubble opens outward from
// the camera, and the photon leaves in a straight line.
// Second half: a match cut on that streak into a dark instrument room, 13.8 billion years on. The
// streak is now a beam landing on an oval glass plate in a brass frame. At true contrast the plate
// is one flat colour. The deck's own "Format Picture" panel then drags its contrast slider up a
// log scale to 100,000 and the ripples from scene 2 come up.
//
// Story parameters: `free` (the mean free path: a fixed fog length plus the radius R of the clear
// bubble) and `contrast`. World rule: extinction exp(-max(d - R, 0) / FREE), shared by the tube,
// the glints, the cards and the backdrop.
//
// The walk is a table built once from a seed: scatter times and points, so the photon, the camera
// (a lagged average over the same path) and the tube are all closed-form in the beat clock.
//
// The plate shows the same picture as the last frame of scene 2: with q = plate coordinates (x in
// -1..1 along the long axis, y in -0.5..0.5), p = (q.x / 2 * 16/9, q.y) * RIPPLE_VIEW, which is
// inflation's p = (uv - .5) * (aspect, 1) * RIPPLE_VIEW with the plate standing in for the frame.
// Shown value = 0.5 + (ripples(p) - 0.5) * 1.25 * contrast / 100000.


import * as THREE from "three/webgpu"
import {
  abs, atan, attribute, cameraPosition, cameraProjectionMatrix, cameraProjectionMatrixInverse, cameraViewMatrix, cameraWorldMatrix, clamp as clampN, cos, cross, Discard, distance, dot, exp, float, Fn, fract, frontFacing, fwidth, If, instanceIndex,
  inverseSqrt, length, Loop, max, min, mix as mixN, mod, modelWorldMatrix, normalGeometry, normalize, positionGeometry, positionWorld, pow, reflect, select, sin, smoothstep, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, varyingProperty, vec2, vec3, vec4,
} from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos, type Pos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles } from "../engine/titles"
import { fbm, fbm3, hash21, hash33, PI, sampleRT, sat, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, Portal, PostOpts, SceneInstance, State } from "../engine/types"
import { RIPPLE_VIEW, ripples, ripples3, SELECT } from "../engine/ui"

const SPEED = 3.1 // world units a second
const FREE = 2.3 // how far you can see in the fog
const TILE = 13 // the glint field repeats in a box this size around the camera
const NG = 3200 // electron–nucleus pairs
const NCARD = 170
const FOV1 = 58
const FOV2 = 30
const ASPECT = 16 / 9
// where the streak sits on screen at the cut (clip space): from its near end to its vanishing point
const NEAR_NDC: [number, number] = [-0.84, -0.8]
const FAR_NDC: [number, number] = [0.24, -0.2]
// Reduced-resolution layers (see the notes where each is built).
const CARDS_LO = true
const RAYS_LO = true

type Seg = { a: THREE.Vector3; b: THREE.Vector3; t0: number; t1: number }
type Num = number | F

/** GLSL `smoothstep(e0, e1, x)` with e0 > e1 (a falling edge), for edges that are nodes. */
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const ssr = (e0: Num, e1: Num, x: Num): F => {
  const t = clampN(fl(e0).sub(x).div(fl(e0).sub(e1)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sq = (x: F): F => x.mul(x) as F
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } as const
const OVER = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } as const

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const texs: THREE.Texture[] = []
  const geos: THREE.BufferGeometry[] = []
  const beats = ctx.def.beats
  const CAP = beats[0].dur + beats[0].hold // the walk's clock at the moment beat 2 normally starts
  const node = (o: Partial<THREE.NodeMaterial> = {}) => Object.assign(new THREE.NodeMaterial(), o)
  const clip = (w: V3) => cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1))

  // ================================================================ the walk

  const R = rng(41)
  const rndDir = (o: THREE.Vector3) => {
    const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z)
    return o.set(Math.cos(a) * s, z * 0.7, Math.sin(a) * s).normalize()
  }
  const tmp = new THREE.Vector3()
  /** Extend a list of segments by scattering at each of `times`, staying near the origin. */
  const walk = (from: THREE.Vector3, t0: number, times: number[], prev?: THREE.Vector3) => {
    const out: Seg[] = []
    const p = from.clone()
    const last = prev ? prev.clone() : new THREE.Vector3(1, 0, 0)
    let t = t0
    for (const t1 of times) {
      const d = new THREE.Vector3()
      // a new direction that is a real change of course, leaning back toward the middle when far out
      for (let i = 0; i < 12; i++) {
        rndDir(d).addScaledVector(p, -0.045 * p.length()).normalize()
        if (d.dot(last) < 0.25) break
      }
      const b = p.clone().addScaledVector(d, SPEED * (t1 - t))
      out.push({ a: p.clone(), b, t0: t, t1 })
      p.copy(b)
      last.copy(d)
      t = t1
    }
    return out
  }
  const timesTo = (from: number, to: number, lo: number, hi: number) => {
    const out: number[] = []
    let t = from
    while (t < to - hi) { t += lo + R() * (hi - lo); out.push(t) }
    out.push(to)
    return out
  }
  const pre = walk(new THREE.Vector3(0.5, 0, 0), -10, timesTo(-10, CAP, 0.46, 0.86))
  const endPre = pre[pre.length - 1]
  const lastDir = endPre.b.clone().sub(endPre.a).normalize()
  // beat 2: the free path grows, three more scatters, then nothing in the way
  const main = walk(endPre.b, CAP, [CAP + 0.74, CAP + 1.72, CAP + 3.0], lastDir)
  const TF = CAP + 3.0
  const PF = main[main.length - 1].b.clone()
  const idle = walk(endPre.b, CAP, timesTo(CAP, CAP + 170, 0.46, 0.86), lastDir)

  const find = (list: Seg[], t: number) => {
    let lo = 0, hi = list.length - 1
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].t1 < t) lo = m + 1; else hi = m }
    return list[lo]
  }
  const final = { dir: new THREE.Vector3(0, 0, -1) }
  const flown = (u: number) => SPEED * u + 14 * u * u // distance along the last leg, u seconds after the last scatter
  /** Where the photon is at walk time t. `alt` = the endless branch used if beat 1 is held open. */
  const photon = (t: number, alt: boolean, o: THREE.Vector3) => {
    if (t <= CAP) { const s = find(pre, Math.max(t, -10)); return o.copy(s.a).lerp(s.b, clamp((t - s.t0) / (s.t1 - s.t0))) }
    if (alt) { const s = find(idle, t); return o.copy(s.a).lerp(s.b, clamp((t - s.t0) / (s.t1 - s.t0))) }
    if (t >= TF) return o.copy(PF).addScaledVector(final.dir, flown(t - TF))
    const s = find(main, t)
    return o.copy(s.a).lerp(s.b, clamp((t - s.t0) / (s.t1 - s.t0)))
  }
  const sinceScatter = (t: number, alt: boolean) => {
    if (t <= CAP) return t - find(pre, Math.max(t, -10)).t0
    if (alt) return t - find(idle, t).t0
    return t >= TF ? t - TF : t - find(main, t).t0
  }
  // the chase camera: close behind the head, a short lagged average of the path, so at every
  // scatter the photon veers off and the camera overshoots the kink before it swings round
  const LAGS = [0.34, 0.46, 0.6, 0.76, 0.94]
  const WTS = [0.16, 0.24, 0.26, 0.2, 0.14]
  const chasePos = (t: number, alt: boolean, o: THREE.Vector3) => {
    o.set(0, 0, 0)
    for (let i = 0; i < LAGS.length; i++) o.addScaledVector(photon(t - LAGS[i], alt, tmp), WTS[i])
    o.x += 0.1; o.y += 0.3; o.z += 0.08
    return o
  }
  const chaseAim = (t: number, alt: boolean, o: THREE.Vector3) => photon(t, alt, o).multiplyScalar(0.65).addScaledVector(photon(t - 0.14, alt, tmp), 0.35)
  const legAt = (t: number, alt: boolean) => (t <= CAP ? find(pre, Math.max(t, -10)) : alt ? find(idle, t) : t >= TF ? null : find(main, t))

  // Solve the last leg: with the camera stopped where it is at the final scatter, turn it so that
  // scatter point sits at NEAR_NDC, and send the photon toward the direction that projects to FAR_NDC.
  const ray = (ndc: [number, number], fov: number) => { const ty = Math.tan((fov * Math.PI) / 360); return new THREE.Vector3(ndc[0] * ty * ASPECT, ndc[1] * ty, -1).normalize() }
  const frameOn = (eye: THREE.Vector3, target: THREE.Vector3, ndc: [number, number], fov: number) => {
    const b = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)))
    return b.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), ray(ndc, fov)).invert())
  }
  const offAxis = (ndc: [number, number], fov: number) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), ray(ndc, fov)).invert()
  const CHASE_OFF = offAxis([0.2, -0.2], FOV1) // the head rides right of and below centre, clear of the title
  const stopPos = chasePos(TF, false, new THREE.Vector3())
  // once it is free the camera stops chasing and eases back a little, so the stars slide against the streak
  const backOff = new THREE.Vector3(0.3, 0.25, 1.5).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(stopPos, PF, new THREE.Vector3(0, 1, 0))))
  const endPos = stopPos.clone().add(backOff)
  const stopQ = frameOn(endPos, PF, NEAR_NDC, FOV1)
  final.dir.copy(ray(FAR_NDC, FOV1)).applyQuaternion(stopQ)
  const FAR_LEN = 900

  // ================================================================ the volume

  const vol = new THREE.Scene()
  const cam1 = new THREE.PerspectiveCamera(FOV1, ASPECT, 0.05, 1200)
  // shared by every material in the volume
  const uR = uniform(0)
  const uWall = uniform(1)
  const uFogC = uniform(new THREE.Vector3(1.0, 0.3, 0.05))
  const uClock = uniform(0)
  const uPx = uniform(0.002)
  const uPh = uniform(new THREE.Vector3())
  const uFocus = uniform(2)
  const uDof = uniform(1)
  // how much of something d away survives the fog; nothing is lost inside the clear bubble
  const through = (d: Num): F => exp(max(fl(d).sub(uR), 0).div(-FREE)) as F
  // the fog's own glow, and what is left of it once the wall has receded
  const fogCol = (dir: V3): V3 => uFogC.mul(uWall).mul(ripples3(dir.mul(2.2).add(1.7)).mul(0.4).add(0.8)).add(vec3(0.012, 0.005, 0.008)) as V3
  const quad = () => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    geos.push(g)
    return g
  }
  const fsTri = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  geos.push(fsTri)

  // backdrop: the fog seen from inside, or its wall once it has pulled away
  const skyMat = node({ depthTest: false, depthWrite: false })
  {
    // the ray through each pixel: unproject the far plane (clip z = 1 on both backends)
    const far = cameraProjectionMatrixInverse.mul(vec4(positionGeometry.xy, 1, 1))
    const vDir = cameraWorldMatrix.mul(vec4(far.xyz.div(far.w), 0)).xyz.toVarying("vDir")
    skyMat.vertexNode = vec4(positionGeometry.xy, 0, 1)
    skyMat.fragmentNode = Fn(() => {
      const d = normalize(vDir).toVar()
      const c = fogCol(d).toVar()
      // slow billows close by while we are still inside it
      const n = fbm3(d.mul(2.6).add(cameraPosition.mul(0.22)).add(vec3(0, uClock.mul(0.05), 0)))
      c.mulAssign(mixN(1, n.mul(1.3).add(0.35), smoothstep(0.15, 1, uWall)))
      c.mulAssign(d.y.mul(0.25).add(1))
      return vec4(c, 1)
    })()
  }
  const sky = new THREE.Mesh(fsTri, skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -10
  vol.add(sky)

  // fog cards: soft sprites tiled round the camera, gone once the bubble reaches them
  const blob = new THREE.DataTexture(
    (() => {
      const n = 128, d = new Uint8Array(n * n * 4), r = rng(7)
      const lat = [8, 16, 32].map((m) => ({ m, v: Float32Array.from({ length: m * m }, () => r()) }))
      const smp = (l: { m: number; v: Float32Array }, x: number, y: number) => {
        const fx = x * l.m, fy = y * l.m, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy
        const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy)
        const g = (i: number, j: number) => l.v[(((iy + j) % l.m) * l.m + ((ix + i) % l.m))]
        return mix(mix(g(0, 0), g(1, 0), sx), mix(g(0, 1), g(1, 1), sx), sy)
      }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n
        const f = smp(lat[0], u, v) * 0.55 + smp(lat[1], u, v) * 0.3 + smp(lat[2], u, v) * 0.15
        const rr = Math.hypot(u - 0.5, v - 0.5) * 2
        const a = clamp((f - 0.28) * 1.9) * smooth(1, 0.25, rr)
        d.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4)
      }
      return d
    })(), 128, 128)
  blob.minFilter = blob.magFilter = THREE.LinearFilter
  blob.needsUpdate = true
  texs.push(blob)
  const cardGeo = quad()
  const ca = new Float32Array(NCARD * 4), cb = new Float32Array(NCARD * 4)
  for (let i = 0; i < NCARD; i++) { ca.set([R() * 18, R() * 18, R() * 18, R()], i * 4); cb.set([1.6 + R() * 2.6, R() * 6.28, R(), R()], i * 4) }
  cardGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(ca, 4))
  cardGeo.setAttribute("aQ", new THREE.InstancedBufferAttribute(cb, 4))
  cardGeo.instanceCount = NCARD
  const cardMat = node(OVER)
  {
    const aP = attribute("aP", "vec4"), aQ = attribute("aQ", "vec4")
    const vQ = varyingProperty("vec2", "cQ"), vC = varyingProperty("vec4", "cC")
    cardMat.vertexNode = Fn(() => {
      const pos = positionGeometry
      const rel = mod(aP.xyz.sub(cameraPosition).add(9), 18).sub(9).toVar()
      rel.addAssign(vec3(sin(uClock.mul(0.11).add(aP.w.mul(20))), cos(uClock.mul(0.09).add(aP.w.mul(31))), sin(uClock.mul(0.07).add(aP.w.mul(11)))).mul(0.4))
      const d = length(rel).toVar()
      const a = smoothstep(0.9, 2.6, d).mul(ssr(8.6, 5, d)).mul(smoothstep(uR.sub(0.5), uR.add(2.5), d)).mul(through(d.mul(0.6)))
      const ang = aQ.y.add(uClock.mul(0.03).mul(aQ.z.sub(0.5))).toVar()
      const cr = cos(ang).toVar(), sr = sin(ang).toVar()
      // GLSL: position.xy * mat2(cr, -sr, sr, cr) (the vector on the left)
      vQ.assign(vec2(pos.x.mul(cr).sub(pos.y.mul(sr)), pos.x.mul(sr).add(pos.y.mul(cr))).mul(0.5).add(0.5))
      // lighter and darker billows, so the volume has shape
      const front = exp(sq(d.sub(uR).sub(1.3).mul(0.9) as F).negate()).mul(step(0.05, uR)).toVar()
      vC.assign(vec4(
        mixN(uFogC.mul(0.22), uFogC.mul(2.1).add(vec3(0.3, 0.2, 0.08)), smoothstep(0.35, 0.65, aQ.w)).mul(uWall).mul(front.mul(2.4).add(1)).add(vec3(1.2, 0.8, 0.4).mul(front).mul(0.5)),
        a.mul(mixN(0.8, 0.5, aQ.w)),
      ))
      const mv = cameraViewMatrix.mul(vec4(cameraPosition.add(rel), 1)).toVar()
      mv.xy.addAssign(pos.xy.mul(aQ.x))
      return cameraProjectionMatrix.mul(mv)
    })()
    cardMat.fragmentNode = Fn(() => {
      const a = texture(blob, vQ).a.mul(vC.a)
      return vec4(vC.rgb.mul(a), a)
    })()
  }
  const cards = new THREE.Mesh(cardGeo, cardMat)
  cards.frustumCulled = false
  cards.renderOrder = 1

  // electrons and nuclei: free and bright until the bubble passes, then bound and quiet.
  // Every one is placed in the vertex stage from its seed, the clock and the bubble's radius, so
  // nothing about them is kept between frames and nothing is uploaded per frame.
  const gGeo = quad()
  const ga = new Float32Array(NG * 2 * 4), gk = new Float32Array(NG * 2)
  for (let i = 0; i < NG; i++) {
    const p = [R() * TILE, R() * TILE, R() * TILE, R()]
    ga.set(p, i * 8); ga.set(p, i * 8 + 4)
    gk[i * 2] = 0; gk[i * 2 + 1] = 1
  }
  gGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(ga, 4))
  gGeo.setAttribute("aK", new THREE.InstancedBufferAttribute(gk, 1))
  gGeo.instanceCount = NG * 2
  const glintMat = node(ADD)
  {
    const aP = attribute("aP", "vec4"), aK = attribute("aK", "float")
    const vQ = varyingProperty("vec2", "gQ"), vC = varyingProperty("vec3", "gC"), vE = varyingProperty("vec3", "gE"), vL = varyingProperty("vec4", "gL"), vSoft = varyingProperty("float", "gSoft")
    glintMat.vertexNode = Fn(() => {
      const pos = positionGeometry
      vQ.assign(pos.xy)
      const L = TILE
      const s = aP.w
      const c = uClock
      const rel = mod(aP.xyz.sub(cameraPosition).add(L * 0.5), L).sub(L * 0.5).toVar()
      const off = hash33(vec3(s.mul(91), s.mul(37), s.mul(53))).sub(0.5).mul(0.9).toVar() // its nucleus is a little way off
      const nuc = rel.add(off).toVar()
      const dn = length(nuc).toVar()
      const k = sat(uR.sub(dn).div(0.55)).toVar()
      const bound = k.mul(k).mul(k.mul(-2).add(3)).add(sin(k.mul(PI)).mul(0.22).mul(k.oneMinus())).toVar()
      const isNuc = aK.greaterThan(0.5)
      const pN = nuc.add(vec3(sin(c.mul(1.3).add(s.mul(40))), cos(c.mul(1.1).add(s.mul(23))), sin(c.mul(0.9).add(s.mul(71)))).mul(0.03))
      const jit = vec3(
        sin(c.mul(5.1).add(s.mul(60))).add(sin(c.mul(8.7).add(s.mul(13)))),
        sin(c.mul(6.3).add(s.mul(29))).add(sin(c.mul(9.9).add(s.mul(47)))),
        sin(c.mul(5.7).add(s.mul(83))).add(sin(c.mul(7.9).add(s.mul(5)))),
      ).mul(0.05)
      const a = c.mul(s.mul(5).add(7)).add(s.mul(30)).toVar()
      const ax = normalize(off.add(1e-3)).toVar()
      const e1 = normalize(cross(ax, vec3(0.3, 1, 0.2))).toVar()
      const e2 = cross(ax, e1)
      const pE = mixN(rel.add(jit), nuc.add(e1.mul(cos(a)).add(e2.mul(sin(a))).mul(0.085)), bound)
      const p = select(isNuc, pN, pE).toVar()
      const d = length(p).toVar()
      const T = through(d)
      const flash = exp(sq(uR.sub(dn).sub(0.12).mul(4) as F).negate()).mul(step(0.01, uR)).toVar() // light given off as it is captured
      // a few big ones, many small
      const big = mixN(0.7, 2.6, pow(fract(s.mul(7.31)), 4))
      const rad = select(isNuc, float(0.036), float(0.019)).mul(big).mul(mixN(1, 0.8, bound)).add(flash.mul(0.02)).toVar()
      // lit by the photon, which is the only lamp in here
      const toPh = uPh.sub(cameraPosition.add(p)).toVar()
      const l2 = dot(toPh, toPh)
      vL.assign(vec4(normalize(cameraViewMatrix.mul(vec4(toPh, 0)).xyz), float(2.2).div(l2.mul(1.1).add(0.25))))
      const col = select(isNuc, mixN(vec3(1, 0.2, 0.06), vec3(0.55, 0.32, 0.2), bound), mixN(vec3(0.25, 0.7, 1), vec3(0.5, 0.6, 0.7), bound))
      // its own glow: free electrons are bright, bound atoms nearly dark
      const em = select(
        isNuc,
        vec3(0.9, 0.16, 0.03).mul(mixN(0.5, 0.1, bound)),
        vec3(0.5, 1.5, 2.4).mul(mixN(1.1, 0.08, bound)).mul(sin(c.mul(s.mul(4).add(3)).add(s.mul(90))).mul(0.3).add(0.7)),
      ).add(vec3(3, 2.4, 1.6).mul(flash))
      // a lens focused on the photon: nearer and farther ones open into discs
      const blurW = abs(d.sub(uFocus)).mul(0.011).mul(uDof).add(ssr(0.8, 0.2, d).mul(0.06)).toVar()
      const sz = max(rad.add(blurW), uPx.mul(d).mul(1.2)).toVar()
      const soft = sat(blurW.div(rad.mul(0.8).add(blurW))).toVar()
      vSoft.assign(soft)
      const keep = min(1, rad.mul(rad).div(sz.mul(sz)).mul(mixN(1, 3, soft)))
      const fade = ssr(L * 0.5, L * 0.36, d).mul(smoothstep(0.1, 0.35, d)).mul(T).mul(keep).toVar()
      vC.assign(col.mul(fade))
      vE.assign(em.mul(fade))
      const mv = cameraViewMatrix.mul(vec4(cameraPosition.add(p), 1)).toVar()
      mv.xy.addAssign(pos.xy.mul(sz))
      return cameraProjectionMatrix.mul(mv)
    })()
    glintMat.fragmentNode = Fn(() => {
      const r = length(vQ).toVar()
      Discard(r.greaterThan(1))
      // in focus: a small lit ball
      const n = vec3(vQ, sqrt(max(0, r.mul(r).oneMinus()))).toVar()
      const dif = sat(dot(n, vL.xyz).mul(0.8).add(0.2))
      const sp = pow(sat(dot(n, normalize(vL.xyz.add(vec3(0, 0, 1))))), 24)
      const amb = uFogC.mul(uWall)
      const ball = vC.mul(vec3(1.6, 1.2, 0.7).mul(dif).mul(vL.w).add(amb.mul(0.5).mul(n.y.mul(0.5).add(0.5))))
        .add(vec3(1.4, 1.1, 0.7).mul(sp).mul(vL.w).mul(0.5))
        .add(vE.mul(n.z.mul(0.65).add(0.35)))
        .mul(ssr(1, 0.9, r))
      // out of focus: a flat disc with a brighter rim, carrying the same light
      const flat = vC.mul(vec3(1.6, 1.2, 0.7).mul(vL.w).mul(0.45).add(amb.mul(0.35))).add(vE.mul(0.7)).mul(ssr(1, 0.86, r)).mul(smoothstep(0.55, 0.95, r).mul(0.5).add(0.7))
      return vec4(mixN(ball, flat, vSoft), 0)
    })()
  }
  const glints = new THREE.Mesh(gGeo, glintMat)
  glints.frustumCulled = false
  glints.renderOrder = 2
  vol.add(glints)

  // the tube: one instanced open cylinder per leg of the walk, revealed by the walk's clock
  const segs: { s: Seg; br: number }[] = [...pre.map((s) => ({ s, br: 0 })), ...main.map((s) => ({ s, br: 1 })), ...idle.map((s) => ({ s, br: 2 })), { s: { a: PF, b: PF.clone().addScaledVector(final.dir, FAR_LEN), t0: TF, t1: TF + 1 }, br: 3 }]
  const tubeGeo = new THREE.InstancedBufferGeometry()
  geos.push(tubeGeo)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0)
  geos.push(cyl)
  tubeGeo.setAttribute("position", cyl.getAttribute("position"))
  tubeGeo.setIndex(cyl.getIndex())
  const tA = new Float32Array(segs.length * 3), tB = new Float32Array(segs.length * 3), tT = new Float32Array(segs.length * 3)
  segs.forEach(({ s, br }, i) => { s.a.toArray(tA, i * 3); s.b.toArray(tB, i * 3); tT.set([s.t0, s.t1, br], i * 3) })
  tubeGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(tA, 3))
  tubeGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(tB, 3))
  tubeGeo.setAttribute("aT", new THREE.InstancedBufferAttribute(tT, 3))
  tubeGeo.instanceCount = segs.length
  const uTau = uniform(0)
  const uBranch = uniform(1)
  const uFinal = uniform(0)
  const uOld0 = uniform(1)
  /** The tube's vertex stage, `wide` times its own radius (the halo is the same legs, fatter) plus `pad` pixels. */
  const tubeStage = (wide: number, pad = 0) => {
    const aA = attribute("aA", "vec3"), aB = attribute("aB", "vec3"), aT = attribute("aT", "vec3")
    const vN = varyingProperty("vec3", "tN"), vW = varyingProperty("vec3", "tW"), vAge = varyingProperty("float", "tAge"), vAlong = varyingProperty("float", "tAlong")
    const vertex = Fn(() => {
      const pos = positionGeometry
      const last = step(2.5, aT.z).toVar()
      const mine = select(aT.z.lessThan(0.5), float(1), select(last.greaterThan(0.5), step(uBranch, 1.5), step(abs(aT.z.sub(uBranch)), 0.5)))
      const show = step(aT.x, uTau).mul(mine).toVar()
      const u = mixN(sat(uTau.sub(aT.x).div(aT.y.sub(aT.x))), uFinal, last).toVar()
      const age = max(uTau.sub(aT.y), 0).mul(last.oneMinus()).toVar()
      vAge.assign(age)
      show.mulAssign(step(age, 30))
      const ax = aB.sub(aA).toVar()
      const w = aA.add(ax.mul(pos.y).mul(u)).toVar()
      const dir = normalize(ax).toVar()
      const e1 = normalize(cross(dir, select(abs(dir.y).lessThan(0.9), vec3(0, 1, 0), vec3(1, 0, 0)))).toVar()
      const e2 = cross(dir, e1)
      const d = distance(w, cameraPosition).toVar()
      const r = max(0.02, uPx.mul(d).mul(1.25)).mul(wide).add(uPx.mul(d).mul(pad)).mul(show).mul(smoothstep(0.12, 0.6, d)).mul(mixN(1, uOld0, step(0.001, age).mul(last.oneMinus())))
      const n = e1.mul(pos.x).add(e2.mul(pos.z)).toVar()
      vN.assign(n)
      const ww = w.add(n.mul(r)).toVar()
      vW.assign(ww)
      vAlong.assign(pos.y.mul(u).mul(length(ax)))
      return clip(ww)
    })()
    return { vertex, vN, vW, vAge, vAlong }
  }
  const tubeMat = node()
  {
    const { vertex, vN, vW, vAge, vAlong } = tubeStage(1)
    tubeMat.vertexNode = vertex
    tubeMat.fragmentNode = Fn(() => {
      const vv = cameraPosition.sub(vW).toVar()
      const d = length(vv).toVar()
      const v = vv.div(d).toVar()
      const old = mixN(1, uOld0, step(0.001, vAge))
      const face = abs(dot(normalize(vN), v)).toVar()
      // white-hot where it has just been, cooling to orange along its length
      const fresh = exp(vAge.mul(-0.22)).toVar()
      const hot = mixN(vec3(1.5, 0.4, 0.05), vec3(3.4, 2.3, 1.1), fresh.mul(fresh)).toVar()
      hot.assign(mixN(hot.mul(vec3(0.5, 0.22, 0.08)), hot, face.mul(face)).mul(sin(vAlong.mul(14).sub(uClock.mul(9))).mul(0.14).add(0.86)))
      hot.mulAssign(mixN(0.3, 1, ssr(30, 14, vAge)).mul(old))
      return vec4(mixN(fogCol(v.negate() as V3), hot, through(d.mul(0.8))), 1)
    })()
  }
  const tube = new THREE.Mesh(tubeGeo, tubeMat)
  tube.frustumCulled = false
  vol.add(tube)
  const haloMat = node({ ...ADD, side: THREE.FrontSide })
  {
    const { vertex, vN, vW, vAge } = tubeStage(5)
    haloMat.vertexNode = vertex
    haloMat.fragmentNode = Fn(() => {
      const vv = cameraPosition.sub(vW).toVar()
      const d = length(vv).toVar()
      const face = abs(dot(normalize(vN), vv.div(d)))
      const a = pow(face, 4).mul(exp(vAge.mul(-0.16)))
      return vec4(vec3(1.5, 0.62, 0.16).mul(a).mul(0.1).mul(through(d.mul(0.6))).mul(smoothstep(0.6, 1.8, d)).mul(mixN(1, uOld0, step(0.001, vAge))), 0)
    })()
  }
  const halo = new THREE.Mesh(tubeGeo, haloMat)
  halo.frustumCulled = false
  halo.renderOrder = 3
  vol.add(halo)

  // a bead at every kink, so the legs join
  const nodeGeo = quad()
  nodeGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(tB, 3))
  nodeGeo.setAttribute("aT", new THREE.InstancedBufferAttribute(tT, 3))
  nodeGeo.instanceCount = segs.length - 1
  const beadMat = node(ADD)
  {
    const aA = attribute("aA", "vec3"), aT = attribute("aT", "vec3")
    const vQ = varyingProperty("vec2", "bQ"), vC = varyingProperty("vec3", "bC")
    beadMat.vertexNode = Fn(() => {
      const pos = positionGeometry
      vQ.assign(pos.xy)
      const show = step(aT.y, uTau).mul(select(aT.z.lessThan(0.5), float(1), step(abs(aT.z.sub(uBranch)), 0.5))).toVar()
      const age = max(uTau.sub(aT.y), 0).toVar()
      show.mulAssign(step(age, 30).mul(uOld0))
      const mv = cameraViewMatrix.mul(vec4(aA, 1)).toVar()
      const d = mv.z.negate().toVar()
      const fresh = exp(age.mul(-0.22)).toVar()
      vC.assign(mixN(vec3(1.5, 0.4, 0.05), vec3(3.4, 2.3, 1.1), fresh.mul(fresh)).mul(through(d.mul(0.8))).mul(show).mul(smoothstep(0.35, 1.3, d)))
      mv.xy.addAssign(pos.xy.mul(max(0.034, uPx.mul(d).mul(2))).mul(show))
      return cameraProjectionMatrix.mul(mv)
    })()
    beadMat.fragmentNode = Fn(() => vec4(vC.mul(ssr(1, 0.7, length(vQ))), 0))()
  }
  const beads = new THREE.Mesh(nodeGeo, beadMat)
  beads.frustumCulled = false
  beads.renderOrder = 3
  vol.add(beads)

  // Four flares in one instanced draw: the photon itself, the flare where it last scattered, the
  // electron it has just hit (recoiling) and the one it is about to hit (waiting).
  // xyz = where, w = size; rgb = tint times gain.
  const SP = { head: 0, kink: 1, hit: 2, next: 3 }
  const spPos = [new THREE.Vector4(0, 0, 0, 0.3), new THREE.Vector4(0, 0, 0, 0.5), new THREE.Vector4(0, 0, 0, 0.2), new THREE.Vector4(0, 0, 0, 0.16)]
  const spCol = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()]
  const WARM_TINT: [number, number, number] = [1, 0.86, 0.62], COLD_TINT: [number, number, number] = [0.35, 0.8, 1.3]
  const flare = (i: number, tint: [number, number, number], gain: number) => spCol[i].set(tint[0] * gain, tint[1] * gain, tint[2] * gain, gain)
  const uSpPos = uniformArray(spPos, "vec4"), uSpCol = uniformArray(spCol, "vec4")
  const spGeo = quad()
  spGeo.instanceCount = 4
  const spMat = node(ADD)
  {
    const vQ = varyingProperty("vec2", "sQ"), vD = varyingProperty("float", "sD"), vT = varyingProperty("vec3", "sT")
    spMat.vertexNode = Fn(() => {
      const pos = positionGeometry
      const P = (uSpPos.element(instanceIndex) as unknown as V4).toVar()
      const C = (uSpCol.element(instanceIndex) as unknown as V4).toVar()
      vQ.assign(pos.xy)
      vT.assign(C.xyz)
      const mv = cameraViewMatrix.mul(vec4(P.xyz, 1)).toVar()
      const d = mv.z.negate().toVar()
      vD.assign(d)
      // (a flare with no gain is not rasterised at all)
      mv.xy.addAssign(pos.xy.mul(max(P.w, uPx.mul(d).mul(9))).mul(step(1e-5, C.w)))
      return cameraProjectionMatrix.mul(mv)
    })()
    spMat.fragmentNode = Fn(() => {
      const r = length(vQ).toVar()
      const a = atan(vQ.y, vQ.x)
      const c = exp(r.mul(r).mul(-140)).mul(4)
        .add(exp(r.mul(-12)).mul(0.5))
        .add(exp(r.mul(-3.2)).mul(0.2).mul(r.oneMinus()))
        .add(pow(max(0, r.oneMinus()), 3).mul(pow(abs(cos(a.mul(2))), 30).mul(0.25).add(0.25)))
      return vec4(vT.mul(c).mul(through(vD)).mul(step(r, 1)), 0)
    })()
  }
  const sprites = new THREE.Mesh(spGeo, spMat)
  sprites.frustumCulled = false
  sprites.renderOrder = 5
  vol.add(sprites)

  // The cards are 170 soft sprites a metre or more across, close to the lens: most of the scene's
  // fill. They can be drawn into a half-size layer (with the tube laid into its depth first, so a
  // card behind the tube stays behind it) and laid over the stage by one full-screen triangle that
  // sits where the cards sat in the draw order. Premultiplied "over" is associative, so the only
  // difference is resolution.
  const post1 = ctx.target({})
  const FULL = {} // a full-size pooled target
  const cardsLo = CARDS_LO ? ctx.target({ scale: 0.5, depth: true }) : null
  // (the upsampled layer is a pooled target borrowed each frame; the input starts on one of the same kind)
  const tCards = uniformTexture(post1.texture)
  const volLo = new THREE.Scene()
  let cardLayer: THREE.Mesh | null = null
  let tubeDepth: THREE.Mesh | null = null
  if (CARDS_LO) {
    const dm = node({ colorWrite: false })
    dm.vertexNode = tubeStage(1, 1).vertex // a full-size pixel fatter all round, so it always lands on the half-size grid
    dm.fragmentNode = vec4(0, 0, 0, 0)
    tubeDepth = new THREE.Mesh(tubeGeo, dm)
    tubeDepth.frustumCulled = false
    volLo.add(tubeDepth, cards)
    const lm = node({ ...OVER, depthTest: false })
    lm.vertexNode = vec4(positionGeometry.xy, 0, 1)
    lm.fragmentNode = sampleRT(tCards, positionGeometry.xy.mul(0.5).add(0.5).toVarying("lUv") as V2)
    cardLayer = new THREE.Mesh(fsTri, lm)
    cardLayer.frustumCulled = false
    cardLayer.renderOrder = 1
    vol.add(cardLayer)
  } else vol.add(cards)

  // light shafts: the stage is smeared toward the photon and broken into rays by noise in angle.
  // The smear of speed stays at full size; what the shafts add is smooth, so it is made at half
  // size and filtered up.
  const RU = { tA: uniformTexture(stage.texture), tS: uniformTexture(post1.texture), uL: uniform(new THREE.Vector2(0.5, 0.5)), uAmt: uniform(1), uAsp: uniform(ASPECT), uSpeed: uniform(0), uCol: uniform(new THREE.Vector3(1.3, 0.75, 0.3)) }
  /** What the shafts add: the bright parts of the stage dragged toward the photon, and the photon's own rays. */
  const shafts = (uv: V2, res: V2, time: F) => {
    const d = uv.sub(RU.uL).toVar()
    const acc = vec3(0).toVar()
    const w = float(1).toVar()
    const j = hash21(uv.mul(res).add(fract(time).mul(91))).toVar()
    Loop(18, ({ i }) => {
      const u = uv.sub(d.mul(float(i).add(j)).div(18).mul(0.8))
      acc.addAssign(max(sampleRT(RU.tA, u as V2).rgb.sub(0.8), 0).mul(w))
      w.mulAssign(0.92)
    })
    const q = d.mul(vec2(RU.uAsp, 1)).toVar()
    const rad = length(q).toVar()
    const dir = q.div(max(rad, 1e-4)).toVar()
    const shaft = pow(fbm(dir.mul(2.3).add(vec2(time.mul(0.07), 3))), 2).mul(2.2).add(pow(vnoise(dir.mul(9).add(vec2(1, time.mul(0.16)))), 4).mul(1.6)).toVar()
    return acc.div(18).mul(RU.uAmt).mul(shaft.mul(0.3).add(0.1)).add(RU.uCol.mul(shaft).mul(exp(rad.mul(-3.6)).mul(0.16).add(exp(rad.mul(-1.3)).mul(0.035))).mul(RU.uAmt))
  }
  const rays = ctx.pass(({ uv, res, time }) => {
    const c = sampleRT(RU.tA, uv).rgb.toVar()
    const d = uv.sub(RU.uL).toVar()
    // speed: everything but the photon streaks away from it, only while we are moving
    If(RU.uSpeed.greaterThan(0.01), () => {
      const jj = hash21(uv.mul(res).mul(1.3).add(7)).toVar()
      const m = vec3(c).toVar()
      const stp = d.mul(0.011).mul(RU.uSpeed).mul(smoothstep(0.05, 0.5, length(d))).toVar()
      Loop({ type: "int", start: 1, end: 7 }, ({ i }) => {
        m.addAssign(sampleRT(RU.tA, uv.add(stp.mul(float(i).sub(jj))) as V2).rgb)
      })
      c.assign(m.div(7))
    })
    c.addAssign(RAYS_LO ? sampleRT(RU.tS, uv).rgb : shafts(uv, res, time))
    return vec4(c, 1)
  }, RU)
  const shaftLo = RAYS_LO ? ctx.target({ scale: 0.5 }) : null
  const shaftPass = RAYS_LO ? ctx.pass(({ uv, res, time }) => vec4(shafts(uv, res, time), 1), RU) : null

  // ================================================================ the instrument room

  const room = new THREE.Scene()
  const cam2 = new THREE.PerspectiveCamera(FOV2, ASPECT, 0.1, 60)
  const O2 = new THREE.Vector3(0, 1.28, 0) // the plate's centre
  const PA = 1.2, PB = 0.6 // its half-axes
  const uLit = uniform(0)
  const uCon = uniform(1)
  const uHit = uniform(new THREE.Vector2())
  const uBeam = uniform(0)
  const uClock2 = uniform(0)
  const uPulse = uniform(0)
  const PLATE = vec3(0, 1.28, 0.06)
  const KEY2 = vec3(0.38, 0.85, 0.36)
  const LAMP = vec3(-1.55, 1.62, 0.95)
  const KEYC2 = vec3(0.62, 0.78, 1.1)
  // the map's colours: deep blue, pale blue, cream, orange, dark red
  const cmap = (v_: F): V3 => {
    const v = sat(v_)
    const a = mixN(vec3(0.01, 0.05, 0.42), vec3(0.12, 0.42, 0.86), smoothstep(0, 0.28, v))
    const b = mixN(a, vec3(0.84, 0.82, 0.7), smoothstep(0.26, 0.5, v))
    const c = mixN(b, vec3(0.95, 0.47, 0.09), smoothstep(0.5, 0.76, v))
    return mixN(c, vec3(0.42, 0.03, 0.02), smoothstep(0.76, 1, v)) as V3
  }
  // (the two scales are RIPPLE_VIEW * 8/9 and RIPPLE_VIEW, to the digits the GLSL was printed with)
  const mapv = (q: V2): F => ripples(q.mul(vec2(+((RIPPLE_VIEW * 8) / 9).toFixed(4), RIPPLE_VIEW))).sub(0.5).mul(uCon).mul(1e-5 * 1.25).add(0.5) as F
  // cmap(.5) is the cream stop exactly
  const plateGlow = () => vec3(0.84, 0.82, 0.7).mul(uLit).mul(0.8)
  const env2 = (r: V3): V3 => {
    const strip = exp(sq(r.y.sub(0.55).mul(4.5) as F).negate()).mul(smoothstep(-0.9, 0.3, r.x))
    return vec3(0.005, 0.006, 0.01).add(KEYC2.mul(strip.mul(0.55).add(smoothstep(-0.2, 1, r.y).mul(0.03)))) as V3
  }
  /** The room's lighting. Call inside an Fn. */
  const shade2 = (p: V3, n: V3, alb: V3, rough: Num, metal: Num): V3 => {
    const v = normalize(cameraPosition.sub(p)).toVar()
    const f0 = mixN(vec3(0.04), alb, metal)
    const d = PLATE.sub(p).toVar()
    const r2 = dot(d, d).toVar()
    const l = d.mul(inverseSqrt(r2)).toVar()
    // the plate is a broad soft source facing +z
    const facing = sat(l.z.mul(-0.75).add(0.35))
    const Ep = plateGlow().mul(facing).mul(1.5).div(r2.mul(0.6).add(1)).toVar()
    // one hooded lamp over the bench, off to the left
    const ld = LAMP.sub(p).toVar()
    const l2 = dot(ld, ld).toVar()
    const ln = ld.mul(inverseSqrt(l2)).toVar()
    const lampE = vec3(1, 0.78, 0.5).mul(18).mul(sat(dot(n, ln))).div(l2.add(0.3)).mul(smoothstep(0.05, 0.75, ln.y))
      .add(vec3(0.4, 0.55, 0.9).mul(0.9).mul(sat(n.y.mul(0.6).add(0.4))).div(dot(p.xz, p.xz).mul(0.05).add(1)))
      .toVar()
    const m6 = fl(metal).mul(0.6).oneMinus()
    const dif = alb.mul(m6).mul(KEYC2.mul(sat(dot(n, KEY2)).mul(0.12).add(0.02)).add(lampE).add(Ep.mul(sat(dot(n, l).mul(0.8).add(0.2))).mul(2.2)))
    const h = normalize(l.add(v))
    const sp = pow(sat(dot(n, h)), mixN(60, 6, rough)).mul(mixN(1.6, 0.25, rough))
    const hk = normalize(KEY2.add(v))
    const sk = pow(sat(dot(n, hk)), mixN(140, 10, rough)).mul(mixN(3, 0.25, rough)).toVar()
    const fres = pow(sat(dot(n, v)).oneMinus(), 5)
    const spec = Ep.mul(sp).add(KEYC2.mul(sk)).add(lampE.mul(sk).mul(0.4)).add(env2(reflect(v.negate(), n) as V3).mul(mixN(1, 0.2, rough)).mul(fl(metal).mul(0.9).add(0.1)))
    return dif.mul(fl(metal).mul(0.75).oneMinus()).add(mixN(f0, vec3(1), fres.mul(0.5)).mul(spec)) as V3
  }
  const worldN = () => normalize(modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz).toVarying("vN")

  // Every brass, steel and painted part of the room is baked into two meshes (the bench, and what
  // rides on the plate's stand), with its colour, roughness, metalness and glow per vertex.
  type Part = { g: THREE.BufferGeometry; m: THREE.Matrix4; col: number; rough: number; metal: number; emis: number }
  type Mat = [col: number, rough: number, metal: number, emis?: number]
  const brass: Mat = [0x9a6a1c, 0.26, 1]
  const darkBrass: Mat = [0x4e3812, 0.4, 1]
  const black: Mat = [0x0b0b0d, 0.5, 0.2]
  const e0 = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), qq = new THREE.Quaternion()
  const part = (list: Part[], g: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0, rot?: THREE.Quaternion | [number, number, number], sy = 1) => {
    if (Array.isArray(rot)) qq.setFromEuler(e0.set(rot[0], rot[1], rot[2]))
    else if (rot) qq.copy(rot)
    else qq.identity()
    list.push({ g, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), qq, s1.set(1, sy, 1)), col: mat[0], rough: mat[1], metal: mat[2], emis: mat[3] ?? 0 })
  }
  const bake = (list: Part[]) => {
    let nv = 0, ni = 0
    for (const p of list) { nv += p.g.getAttribute("position").count; ni += p.g.getIndex()!.count }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), M = new Float32Array(nv * 4), S = new Float32Array(nv * 2), I = new Uint32Array(ni)
    const v = new THREE.Vector3(), nm = new THREE.Matrix3(), col = new THREE.Color()
    let vo = 0, io = 0
    for (const p of list) {
      const gp = p.g.getAttribute("position"), gn = p.g.getAttribute("normal"), gi = p.g.getIndex()!
      nm.getNormalMatrix(p.m)
      col.set(p.col)
      for (let i = 0; i < gp.count; i++) {
        v.fromBufferAttribute(gp, i).applyMatrix4(p.m).toArray(P, (vo + i) * 3)
        v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize().toArray(N, (vo + i) * 3)
        M.set([col.r, col.g, col.b, p.emis], (vo + i) * 4)
        S.set([p.rough, p.metal], (vo + i) * 2)
      }
      for (let i = 0; i < gi.count; i++) I[io + i] = gi.getX(i) + vo
      vo += gp.count
      io += gi.count
    }
    for (const p of list) p.g.dispose()
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(P, 3))
    g.setAttribute("normal", new THREE.BufferAttribute(N, 3))
    g.setAttribute("aM", new THREE.BufferAttribute(M, 4))
    g.setAttribute("aS", new THREE.BufferAttribute(S, 2))
    g.setIndex(new THREE.BufferAttribute(I, 1))
    geos.push(g)
    return g
  }
  const bakedMat = node()
  {
    const aM = attribute("aM", "vec4").toVarying("vM"), aS = attribute("aS", "vec2").toVarying("vS")
    const vN = worldN()
    bakedMat.fragmentNode = Fn(() => vec4(shade2(positionWorld as V3, normalize(vN) as V3, aM.rgb as V3, aS.x as F, aS.y as F).add(aM.rgb.mul(aM.w)), 1))()
  }
  /** One lit part with its own material: for the two that need a texture or both faces. */
  const lit2 = (col: number, rough: number, metal: number, map?: THREE.Texture, twoSided = false) => {
    const m = node(twoSided ? { side: THREE.DoubleSide } : {})
    const uCol = uniform(new THREE.Color(col)) as unknown as V3
    const vN = worldN()
    m.fragmentNode = Fn(() => {
      const a = (map ? uCol.mul(texture(map, uvAttr()).rgb) : uCol) as V3
      const n0 = normalize(vN)
      const n = (twoSided ? select(frontFacing, n0, n0.negate()) : n0) as V3
      return vec4(shade2(positionWorld as V3, n, a, rough, metal), 1)
    })()
    return m
  }
  const bench: Part[] = [], stand: Part[] = []

  // the optical table: black anodised, a grid of tapped holes
  const tableMat = node()
  tableMat.fragmentNode = Fn(() => {
    const p = positionWorld as V3
    const g = p.xz.div(0.25).toVar()
    const c = fract(g).sub(0.5).toVar()
    const fw = max(fwidth(g.x), fwidth(g.y)).toVar()
    const lc = length(c).toVar()
    const hole = ssr(fw.add(0.16) as F, fw.negate().add(0.16) as F, lc).mul(ssr(0.9, 0.25, fw)).toVar()
    const bevel = ssr(fw.add(0.24) as F, 0.2, lc).mul(hole.oneMinus()).mul(ssr(0.6, 0.15, fw)).toVar()
    const grainy = vnoise(p.xz.mul(vec2(260, 9))).mul(0.5).add(vnoise(p.xz.mul(70)).mul(0.5)).toVar()
    const n = normalize(vec3(grainy.sub(0.5).mul(0.06).add(c.x.mul(bevel).mul(1.2)), 1, c.y.mul(bevel).mul(1.2))).toVar()
    const col = shade2(p, n as V3, vec3(0.13, 0.135, 0.15) as V3, 0.4, 0.3).toVar()
    // the plate's own light pooling in front of it, and its smeared reflection
    const v = normalize(cameraPosition.sub(p))
    const r = reflect(v.negate(), n).toVar()
    const t = PLATE.z.sub(p.z).div(min(r.z, -1e-3)).toVar()
    const hit = p.add(r.mul(t))
    const q = hit.xy.sub(PLATE.xy).div(vec2(PA, PB)).toVar()
    const inside = ssr(1.25, 0.6, length(q)).mul(step(0, t))
    col.addAssign(cmap(mapv(q.mul(vec2(1, 0.5)) as V2)).mul(uLit).mul(inside).mul(0.3).mul(grainy.mul(0.6).add(0.7)))
    col.mulAssign(hole.mul(0.92).oneMinus())
    // contact shadow under the stand
    col.mulAssign(ssr(0.7, 0.2, length(p.xz)).mul(0.7).oneMinus())
    return vec4(col, 1)
  })()
  room.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), tableMat))
  // back wall: a dark panel with a rail, so the room has a far side
  const wallMat = node()
  wallMat.fragmentNode = Fn(() => {
    const p = positionWorld as V3
    const panel = ssr(0.02, 0, abs(fract(p.x.div(2.4)).sub(0.5)).sub(0.49) as F)
    const col = shade2(p, vec3(0, 0, 1) as V3, vec3(0.07, 0.078, 0.095) as V3, 0.8, 0).mul(panel.mul(0.5).oneMinus()).toVar()
    col.addAssign(vec3(0.014, 0.02, 0.034).mul(ssr(6, 0.3, p.y)).mul(fbm(p.xy.mul(0.6)).mul(0.4).add(0.6)))
    return vec4(col, 1)
  })()
  room.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 14).translate(0, 7, -4.2), wallMat))

  // the plate
  const plateGroup = new THREE.Group()
  plateGroup.position.copy(O2)
  plateGroup.rotation.y = -0.16
  const plateMat = node()
  {
    const vQ = positionGeometry.xy.div(vec2(PA, PB)).toVarying("pQ")
    const vN = normalize(modelWorldMatrix.mul(vec4(0, 0, 1, 0)).xyz).toVarying("pN")
    plateMat.fragmentNode = Fn(() => {
      const r = length(vQ).toVar()
      const v = normalize(cameraPosition.sub(positionWorld)).toVar()
      const n = normalize(vN).toVar()
      const q = vQ.mul(vec2(1, 0.5)).toVar()
      // the light spreads from where it landed
      const lit = smoothstep(0, 0.5, uLit.mul(3.4).sub(distance(q, uHit)))
      const c = cmap(mapv(q as V2)).mul(lit).mul(uLit).mul(0.62).toVar()
      // glass: thick green edge, a dim reflection of the room, dust that only shows in the reflection
      const edge = smoothstep(0.93, 1, r)
      c.assign(mixN(c, c.mul(vec3(0.35, 0.7, 0.55)).add(vec3(0.01, 0.03, 0.025)), edge.mul(0.8)))
      const rr = reflect(v.negate(), n)
      const fres = pow(sat(dot(n, v)).oneMinus(), 5).mul(0.96).add(0.04)
      const dust = vnoise(vQ.mul(90)).mul(vnoise(vQ.mul(23).add(4)))
      c.addAssign(env2(rr as V3).mul(fres.mul(2.2).add(dust.mul(0.25))).add(vec3(0.004, 0.006, 0.008)))
      c.addAssign(vec3(0.5, 0.55, 0.6).mul(smoothstep(0.985, 1, r)).mul(0.12))
      const hd = distance(q, uHit).toVar()
      c.addAssign(vec3(1.6, 1.25, 0.8).mul(uBeam).mul(exp(hd.mul(hd).mul(-900)).mul(7).add(exp(hd.mul(hd).mul(-60)).mul(0.5))))
      return vec4(c, 1)
    })()
  }
  plateGroup.add(new THREE.Mesh(new THREE.CircleGeometry(1, 128).scale(PA, PB, 1), plateMat))
  class Oval extends THREE.Curve<THREE.Vector3> {
    constructor(private k: number) { super() }
    getPoint(t: number, o = new THREE.Vector3()) { const a = t * Math.PI * 2; return o.set(Math.cos(a) * PA * this.k, Math.sin(a) * PB * this.k * (1 + (this.k - 1) * 1.0), 0) }
  }
  part(stand, new THREE.TubeGeometry(new Oval(1.02), 160, 0.05, 14, true), brass)
  part(stand, new THREE.TubeGeometry(new Oval(1.02), 160, 0.03, 10, true).translate(0, 0, -0.06), darkBrass)
  part(stand, new THREE.CircleGeometry(1, 96).scale(PA * 1.02, PB * 1.04, 1).translate(0, 0, -0.07).rotateY(Math.PI), black)
  // four clamps with thumbscrews, the stand, its collar and foot
  for (const a of [0.42, Math.PI - 0.42, Math.PI + 0.42, -0.42]) {
    const cx = Math.cos(a) * PA * 1.03, cy = Math.sin(a) * PB * 1.06
    part(stand, new THREE.BoxGeometry(0.13, 0.09, 0.14), brass, cx, cy, -0.01, [0, 0, Math.atan2(Math.sin(a) * PA, Math.cos(a) * PB) - Math.PI / 2 + Math.PI / 2])
    part(stand, new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12).rotateX(Math.PI / 2), darkBrass, cx, cy, 0.09)
  }
  part(stand, new THREE.CylinderGeometry(0.045, 0.045, O2.y - PB - 0.04, 20).translate(0, -(O2.y + PB + 0.04) / 2, -0.05), brass)
  part(stand, new THREE.CylinderGeometry(0.085, 0.085, 0.12, 20).translate(0, -PB - 0.1, -0.05), darkBrass)
  part(stand, new THREE.CylinderGeometry(0.075, 0.09, 0.16, 20).translate(0, -O2.y + 0.2, -0.05), darkBrass)
  part(stand, new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.42, 0.05], [0.36, 0.1], [0.12, 0.12], [0, 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 48).translate(0, -O2.y, -0.05), black)
  plateGroup.add(new THREE.Mesh(bake(stand), bakedMat))
  // an engraved plate on the foot: print that restates the script
  const plaqueTex = canvasTex(1024, 220, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, "#d9b25a"); g.addColorStop(1, "#a97f2c")
    c.fillStyle = g; c.fillRect(0, 0, w, h)
    c.strokeStyle = "rgba(50,34,8,0.8)"; c.lineWidth = 5; c.strokeRect(14, 14, w - 28, h - 28)
    c.fillStyle = "rgba(42,28,6,0.92)"; c.textAlign = "center"; c.textBaseline = "middle"
    c.font = `500 60px ${ctx.fonts.mono}`
    c.fillText("COSMIC MICROWAVE BACKGROUND", w / 2, 78)
    c.font = `500 54px ${ctx.fonts.mono}`
    c.fillText("2.726 K", w / 2, 152)
  })
  texs.push(plaqueTex)
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.215), lit2(0xffffff, 0.45, 0.6, plaqueTex))
  plaque.position.set(0.1, -O2.y + 0.1, 0.62)
  plaque.rotation.x = -0.75
  plateGroup.add(plaque)
  room.add(plateGroup)

  // bench furniture: two instrument cases at the back with pilot lamps, a lens in a ring mount
  for (const [x, z, w, h, d] of [[-2.6, -2.6, 1.5, 0.9, 0.9], [2.4, -3.0, 2.0, 1.25, 0.9], [3.9, -1.2, 0.8, 0.5, 0.7]]) {
    part(bench, new THREE.BoxGeometry(w, h, d), [0x30343c, 0.6, 0.2], x, h / 2, z)
    part(bench, new THREE.SphereGeometry(0.03, 10, 8), [x < 0 ? 0xff7a1a : 0x35e07a, 0.4, 0, 2.2], x - w * 0.32, h * 0.72, z + d / 2 + 0.01)
    part(bench, new THREE.CircleGeometry(0.16, 28), [0x8d8a7c, 0.5, 0], x + w * 0.12, h * 0.55, z + d / 2 + 0.005)
  }
  // a hooded lamp on the left: the one practical in the room
  part(bench, new THREE.CylinderGeometry(0.26, 0.3, 0.07, 32).translate(-2.25, 0.035, 0.7), black)
  part(bench, new THREE.CylinderGeometry(0.025, 0.025, 1.9, 12).translate(-2.25, 0.95, 0.7), brass)
  part(bench, new THREE.CylinderGeometry(0.02, 0.02, 0.8, 10).rotateZ(Math.PI / 2 - 0.25), brass, -1.9, 1.99, 0.82, [0, -0.33, 0])
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.36, 40, 1, true), lit2(0x2c5a46, 0.35, 0.3, undefined, true))
  shade.position.set(-1.55, 1.9, 0.95)
  room.add(shade)
  part(bench, new THREE.SphereGeometry(0.075, 16, 12), [0xffd9a0, 0.5, 0, 9], -1.55, 1.78, 0.95)
  // the rail the plate rides on, its carriage, and bolts in the table
  part(bench, new THREE.BoxGeometry(3.6, 0.07, 0.36).translate(0.2, 0.035, -0.05), [0x1a1c20, 0.35, 0.6])
  part(bench, new THREE.BoxGeometry(3.6, 0.012, 0.05).translate(0.2, 0.076, 0.1), brass)
  part(bench, new THREE.BoxGeometry(0.56, 0.13, 0.5).translate(0, 0.1, -0.05), [0x24272d, 0.3, 0.7])
  part(bench, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 14).rotateX(Math.PI / 2), brass, 0.18, 0.1, 0.24)
  const boltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 6)
  for (const [bx, bz] of [[-1.5, -0.25], [1.75, -0.25], [-1.5, 0.25], [1.75, 0.25], [-0.75, 1.0], [1.0, 1.25], [-2.25, 1.5], [0.5, 2.0], [2.5, 0.75]]) part(bench, boltGeo, darkBrass, bx + 0.125, 0.018, bz + 0.125)

  // camera 2 at the cut, placed so the plate sits where the photon was heading
  const cut = { pos: new THREE.Vector3(-1.45, 1.66, 4.75), q: new THREE.Quaternion() }
  const ROOM_OFF = offAxis(FAR_NDC, FOV2), SIDE_OFF = offAxis([-0.2, -0.22], FOV2)
  cut.q.copy(frameOn(cut.pos, O2, FAR_NDC, FOV2))
  // ...and the beam along the same screen line as the streak
  const beamFrom = cut.pos.clone().addScaledVector(ray(NEAR_NDC, FOV2).applyQuaternion(cut.q), 2.4)
  beamFrom.add(beamFrom.clone().sub(O2).multiplyScalar(1.4))
  const beamTo = O2.clone().add(new THREE.Vector3(0, 0, 0.02))
  const beamLen = beamFrom.distanceTo(beamTo)
  const beamQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamTo.clone().sub(beamFrom).normalize())
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0)
  geos.push(beamGeo)
  const beamMat = (wide: number) => {
    const m = node(ADD)
    const pos = positionGeometry
    const world = modelWorldMatrix.mul(vec4(pos.x.mul(wide), pos.y.mul(beamLen), pos.z.mul(wide), 1)).xyz
    const vW = world.toVarying("mW")
    const vN = normalize(modelWorldMatrix.mul(vec4(pos.x, 0, pos.z, 0)).xyz).toVarying("mN")
    const vY = pos.y.toVarying("mY")
    m.vertexNode = clip(world as V3)
    m.fragmentNode = Fn(() => {
      const v = normalize(cameraPosition.sub(vW))
      const face = abs(dot(normalize(vN), v))
      const core = wide < 0.03 ? float(1) : pow(face, 5).mul(0.1)
      // dust drifting through it
      const dust = vnoise(vec2(vY.mul(60), uClock2.mul(0.6))).mul(0.6).add(0.7).add(pow(vnoise(vec2(vY.mul(220).add(uClock2.mul(0.9)), 3)), 6).mul(4).mul(0.5))
      const pulse = exp(sq(vY.sub(uPulse).mul(7) as F).negate()).mul(6).mul(step(uPulse, 1.02))
      return vec4(vec3(1.6, 1.25, 0.8).mul(core).mul(uBeam.mul(dust).mul(0.55).add(pulse)), 0)
    })()
    return m
  }
  for (const wide of [0.011, 0.07]) {
    const b = new THREE.Mesh(beamGeo, beamMat(wide))
    b.position.copy(beamFrom)
    b.quaternion.copy(beamQ)
    b.frustumCulled = false
    b.renderOrder = 4
    room.add(b)
  }
  // a lens in a ring mount that the beam passes through
  const lensAt = beamFrom.clone().lerp(beamTo, 0.63)
  part(bench, new THREE.TorusGeometry(0.2, 0.035, 12, 48).rotateX(Math.PI / 2), brass, lensAt.x, lensAt.y, lensAt.z, beamQ)
  const glassMat = node(ADD)
  {
    const vN = worldN()
    glassMat.fragmentNode = Fn(() => {
      const v = normalize(cameraPosition.sub(positionWorld)).toVar()
      const n = normalize(vN).toVar()
      const f = pow(sat(dot(n, v)).oneMinus(), 3)
      return vec4(env2(reflect(v.negate(), n) as V3).mul(f.mul(1.2).add(0.03)).add(vec3(1.4, 1.1, 0.7).mul(uBeam).mul(0.015)), 0)
    })()
  }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 40), glassMat)
  glass.position.copy(lensAt)
  glass.quaternion.copy(beamQ)
  room.add(glass)
  part(bench, new THREE.CylinderGeometry(0.03, 0.03, 1, 14), brass, lensAt.x, (lensAt.y - 0.24) / 2, lensAt.z, undefined, lensAt.y - 0.24)
  part(bench, new THREE.CylinderGeometry(0.2, 0.22, 0.06, 28), black, lensAt.x, 0.03, lensAt.z)
  room.add(new THREE.Mesh(bake(bench), bakedMat))

  const plateCorners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => new THREE.Vector3(x * PA * 1.07, y * PB * 1.12, 0))

  // ================================================================ schedule: sound

  // Sheet: beats/sound-fog.md. Home harmonic 6: every pitch is a multiple of it. A scatter is a
  // glass ping at the point where it happens, through the chase camera of that moment, with the
  // whip of the photon veering off; the room half is heard through the room's camera.
  const cues: Cue[] = []
  const pitch = [48, 54, 60, 66, 72, 78, 84, 96]
  const in1 = (v: THREE.Vector3) => (): Pos => listenerPos(v, cam1, 6)
  const in2 = (v: THREE.Vector3) => (): Pos => listenerPos(v, cam2)
  const scr = (px: number, py: number): Pos => [(px / DW) * 2 - 1, 1 - (py / DH) * 2, 0]
  const scatter = (b: number, at: number, seg: Seg, n: number, g: number) =>
    cues.push({ b, at, s: "glass", o: { f: H(n), g }, pos: in1(seg.b) }, { b, at: at + 0.01, s: "whoosh", o: { f: H(24), dur: 0.24, g: 0.3 }, pos: in1(seg.b) })
  pre.forEach((s, i) => { if (s.t1 > 0.05 && s.t1 < CAP - 0.05) scatter(0, s.t1, s, pitch[(i * 5) % pitch.length], 0.5) })
  // beat 2: the last scatter of the fog, then three more, each further on, brighter and a step higher
  scatter(1, 0.02, endPre, 54, 0.6)
  main.forEach((s, i) => scatter(1, s.t1 - CAP, s, [72, 84, 96][i] ?? 96, 0.6 + 0.1 * i))
  // electrons snap onto nuclei and the clear bubble opens outward from the camera
  cues.push({ b: 1, at: 0.7, s: "crackle", o: { dur: 0.9, g: 0.35, wet: 2 }, pos: [0, 0, -0.3] }, { b: 1, at: 0.75, s: "hiss", o: { g: 0.4, dur: 3 } })
  // the big moment: nothing in the way. The photon leaves in a straight line, and a tone rises under it to the end of the beat
  cues.push(
    { b: 1, at: TF - CAP, s: "whoosh", o: { f: H(12), dur: 3.4, g: 0.7 }, pos: in1(PF) },
    { b: 1, at: TF - CAP, s: "riser", o: { f: H(6), dur: beats[1].dur - (TF - CAP), g: 0.4 } },
    { b: 1, at: TF - CAP + 0.05, s: "pad", o: { f: H(12), dur: 7, g: 1 } },
    { b: 1, at: TF - CAP + 0.4, s: "shimmer", o: { f: H(48), dur: 3, g: 0.3 } },
  )
  // the match cut into the instrument room; the pulse runs down the beam and lands on the plate
  cues.push({ b: 2, at: 0.02, s: "thud", o: { g: 0.5, f: H(2) } }, { b: 2, at: 0.38, s: "glass", o: { f: H(48), g: 1 }, pos: in2(O2) }, { b: 2, at: 0.38, s: "bell", o: { f: H(12), g: 0.5 }, pos: in2(O2) }, { b: 2, at: 0.5, s: "pad", o: { f: H(6), dur: 6, g: 0.8 } })
  const DRAG0 = 2.0, DRAG1 = 5.7
  // the plate is selected, its format panel opens, the pointer takes the contrast slider
  const atThumb = (): Pos => scr(1392 + (1780 - 1392) * st.thumb, 714) // (TR0, TR1 and TRY of the panel below)
  cues.push(
    { b: 3, at: 0.3, s: "select", o: { f: H(36), g: 1.1 }, pos: in2(O2) },
    { b: 3, at: 0.7, s: "select", o: { f: H(24), g: 0.8 }, pos: scr(1586, 566) },
    { b: 3, at: DRAG0 - 0.08, s: "key", o: { f: H(48), g: 1 }, pos: atThumb },
    // the contrast winding up under the drag, heard at the plate
    { b: 3, at: DRAG0, s: "governor", o: { f: H(3), dur: DRAG1 - DRAG0, g: 0.45 }, pos: in2(O2) },
    { b: 3, at: DRAG1 + 0.25, s: "key", o: { f: H(42), g: 0.8 }, pos: atThumb },
  )
  // one tick per decade as the slider passes it, at the thumb; the last decade is where the picture arrives
  let SLAM = DRAG1
  for (let n = 1; n <= 5; n++) {
    let lo = 0, hi = 1
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (E.io2(m) < n / 5) lo = m; else hi = m }
    if (n === 4) {
      SLAM = DRAG0 + lo * (DRAG1 - DRAG0) + 0.25
      cues.push({ b: 3, at: SLAM, s: "sub", o: { f: H(2), g: 0.6, lfe: 1 }, pos: in2(O2) }, { b: 3, at: SLAM, s: "boom", o: { g: 0.35, dur: 1.6, f: H(2) } }, { b: 3, at: SLAM + 0.03, s: "shimmer", o: { f: H(48), dur: 2.4, g: 0.35 } })
    }
    cues.push({ b: 3, at: DRAG0 + lo * (DRAG1 - DRAG0) - 0.01, s: n === 5 ? "bell" : "tick", o: n === 5 ? { f: H(24), g: 0.45 } : { g: 0.8, f: H(54 + n * 6) }, pos: atThumb })
  }

  // ================================================================ per-frame state

  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3()
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4()
  const UP = new THREE.Vector3(0, 1, 0)
  const port: Portal = { c: [[0, 0], [0, 0], [0, 0], [0, 0]], a: 1, shade: 1 }
  const st = { thumb: 0, room: false, flash: 0, wall: 1, lit: 0, drag: 0, sel: [0, 0, 0, 0], leave: 0, exp: 1 }
  // what `finish` is told, refilled each frame
  const POST1: PostOpts = { tone: "aces", exposure: 1, bloom: 0, bloomThresh: 1, bloomRadius: 0.9, halation: 0.6, contrast: 1, sat: 1.2, vignette: 0, grain: 0.03, ca: 0.003, lift: [0.006, 0.002, 0.004], gain: [1.03, 1, 0.97] }
  const POST2: PostOpts = { tone: "aces", exposure: 1, bloom: 0, bloomThresh: 1, bloomRadius: 0.9, halation: 0.5, contrast: 1.16, sat: 1, vignette: 0.3, grain: 0.028, ca: 0.002, lift: [0.002, 0.004, 0.01], gain: [1.02, 1, 0.98] }
  const HUD0 = { color: "#fff3e2", shadow: "rgba(70,22,0,0.7)" }, HUD1 = { color: "#fff3e2", shadow: "rgba(0,0,0,0.5)" }

  function update(s: State) {
    st.room = s.beat >= 2
    if (!st.room) {
      // ---------------- the walk's clock
      const t0 = s.at(0)
      const alt = s.beat === 0 && t0 > CAP
      const tau = s.beat === 0 ? clamp(t0, -9, CAP + 168) : CAP + Math.min(s.at(1), 60)
      const t1 = s.beat >= 1 ? tau - CAP : 0
      // the clear bubble: nothing, then an exponential run-away
      const Rr = t1 > 0.7 ? 1.1 * (Math.exp(0.8 * (t1 - 0.7)) - 1) : 0
      const wall = 1 / (1 + (Rr / 13) ** 1.7)
      uR.value = Rr
      uWall.value = wall
      uClock.value = s.time
      uPx.value = (2 * Math.tan((FOV1 * Math.PI) / 360)) / s.h
      // ---------------- camera
      const leave = smooth(TF, TF + 2.6, tau)
      const tc = Math.min(tau, TF)
      chasePos(tc, alt, v0)
      chaseAim(tc, alt, v1)
      m4.lookAt(v0, v1, UP)
      q0.setFromRotationMatrix(m4).multiply(CHASE_OFF)
      if (tau > TF) {
        q0.slerp(stopQ, E.io3(leave))
        v0.addScaledVector(backOff, E.io2(clamp((tau - TF) / 6)))
      }
      // every scatter knocks it; the knocks get rarer and stop
      const ss = sinceScatter(tau, alt)
      const jolt = Math.exp(-ss * 5.5) * (tau > TF ? 0.4 : 1)
      const live = 1 - leave
      v0.x += 0.07 * jolt * Math.sin(ss * 47) + 0.02 * live * Math.sin(s.time * 0.9)
      v0.y += 0.08 * jolt * Math.sin(ss * 39 + 1) + 0.02 * live * Math.sin(s.time * 0.7 + 2)
      cam1.position.copy(v0)
      cam1.quaternion.copy(q0)
      cam1.rotateZ(0.07 * jolt * Math.sin(ss * 31 + 2) + 0.04 * live * Math.sin(s.time * 0.31))
      cam1.rotateY(-s.mouse.x * 0.05 * live)
      cam1.rotateX(s.mouse.y * 0.03 * live)
      // a dolly zoom while the fog clears: the lens opens as the walls fall away, then it all stops
      cam1.fov = FOV1 + 7 * jolt * live + 11 * smooth(0.7, 2.9, t1) * (1 - E.io3(leave))
      cam1.aspect = s.w / s.h
      cam1.updateProjectionMatrix()
      cam1.updateMatrixWorld()
      // ---------------- photon, tube
      photon(tau, alt, v2)
      const hp = spPos[SP.head]
      hp.set(v2.x, v2.y, v2.z, 0.34 + 0.2 * jolt)
      flare(SP.head, WARM_TINT, 0.7 + 1.6 * jolt)
      uPh.value.copy(v2)
      uDof.value = 1 - 0.8 * leave
      uFocus.value = mix(Math.min(v2.distanceTo(v0), 6), 4.5, leave)
      uTau.value = tau
      uBranch.value = alt ? 2 : 1
      uFinal.value = tau > TF ? Math.min(1, flown(tau - TF) / FAR_LEN) : 0
      uOld0.value = 1 - smooth(TF + 0.3, TF + 3.2, tau)
      photon(tau - ss, alt, v1)
      spPos[SP.kink].set(v1.x, v1.y, v1.z, 0.5 + ss * 1.6)
      flare(SP.kink, WARM_TINT, 1.6 * Math.exp(-ss * 5))
      // the electron that was hit takes what the photon lost: it is thrown along (in - out), flaring
      const leg = legAt(tau, alt)
      const before = legAt(tau - ss - 0.01, alt)
      if (before) {
        v3.copy(before.b).sub(before.a).normalize()
        if (leg) v3.sub(tmp.copy(leg.b).sub(leg.a).normalize())
        else v3.sub(final.dir)
        v3.normalize()
        v1.addScaledVector(v3, 0.75 * (1 - Math.exp(-ss * 3.2))).addScaledVector(UP, 0.03 * Math.sin(ss * 30) * Math.exp(-ss * 3))
        spPos[SP.hit].set(v1.x, v1.y, v1.z, 0.16 + 0.3 * Math.exp(-ss * 4))
        flare(SP.hit, COLD_TINT, (0.5 + 3.5 * Math.exp(-ss * 3.5)) * (1 - 0.8 * leave))
      }
      flare(SP.next, COLD_TINT, leg ? 0.55 + 0.25 * Math.sin(s.time * 11) : 0)
      if (leg) spPos[SP.next].set(leg.b.x, leg.b.y, leg.b.z, 0.16)
      // where the photon is on screen, for the shafts
      v3.copy(v2).project(cam1)
      const behind = v3.z > 1 ? 0 : 1
      RU.uL.value.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5)
      RU.uAmt.value = behind * (0.04 + 0.96 * wall) * (1 + 1.2 * jolt)
      RU.uAsp.value = s.w / s.h
      RU.uSpeed.value = live * (1 + 2.2 * jolt)
      st.flash = s.beat === 1 ? Math.exp(-Math.max(s.at(1), 0) * 5) : 0
      st.wall = wall
      st.leave = leave
      if (s.live) {
        // (on the way in the hum comes up out of the steam, and the air is still the steam's own hush)
        ctx.synth.bed("hum", (0.5 * wall + 0.2) * smooth(0.3, 1, s.enter))
        if (s.enter >= 1) ctx.synth.bed("air", 0.25 + 0.5 * (1 - wall) * (1 - leave))
      }
    } else {
      // ---------------- the room
      const t2 = s.at(2) > 9e3 ? 1e3 : s.at(2)
      const push = s.k(2, 0.6, 9.5, E.out2)
      const settle = smooth(0.8, 3, t2)
      // from the cut pose a slow push and drift round the plate, which stays pinned where the photon
      // was heading; then the camera steps back and aside to make room for the panel
      const side = s.k(3, 0.0, 2.2, E.io3)
      const slam = s.beat === 3 && s.t > SLAM ? Math.exp(-(s.t - SLAM) * 3.2) : 0
      v0.copy(cut.pos).lerp(v1.set(-0.55, 1.5, 4.1), push).lerp(v1.set(0.5, 1.62, 5.5), side)
      v0.x += settle * (0.05 * Math.sin(s.time * 0.31) + s.mouse.x * 0.12) + 0.012 * slam * Math.sin(s.time * 60)
      v0.y += settle * (0.03 * Math.sin(s.time * 0.27 + 1) + s.mouse.y * 0.06) + 0.012 * slam * Math.sin(s.time * 53 + 1)
      v0.z -= settle * 0.25 * s.k(3, 2.2, 14, E.lin)
      m4.lookAt(v0, O2, UP)
      q0.setFromRotationMatrix(m4)
      q1.copy(ROOM_OFF).slerp(SIDE_OFF, side)
      q0.multiply(q1)
      plateGroup.scale.setScalar(1 + 0.04 * slam * Math.cos((s.t - SLAM) * 22))
      cam2.position.copy(v0)
      cam2.quaternion.copy(q0)
      cam2.aspect = s.w / s.h
      cam2.updateProjectionMatrix()
      cam2.updateMatrixWorld()
      // the pulse runs down the beam and lands; the plate lights from that point
      const pulse = clamp((t2 - 0.02) / 0.36)
      const lit = s.k(2, 0.38, 1.9, E.out2)
      const drag = s.k(3, DRAG0, DRAG1, E.io2)
      const over = s.beat === 3 && s.t > DRAG1 ? 0.045 * Math.sin((s.t - DRAG1) * 17) * Math.exp(-(s.t - DRAG1) * 5) : 0
      st.thumb = drag + over
      uLit.value = lit * 0.9
      uCon.value = 10 ** (5 * drag)
      uBeam.value = 1 - 0.55 * smooth(1.2, 4, t2)
      uClock2.value = s.time
      uHit.value.set(0, 0)
      uPulse.value = t2 < 0.02 ? -1 : pulse < 1 ? pulse : 2
      st.lit = lit
      st.drag = drag
      st.flash = Math.exp(-Math.max(t2 - 0.38, 0) * 4) * (t2 > 0.38 ? 1 : 0) + 0.7 * slam
      // the plate on screen, for the selection box and the hand-off
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      plateGroup.updateMatrixWorld()
      for (let i = 0; i < 4; i++) {
        v2.copy(plateCorners[i]).applyMatrix4(plateGroup.matrixWorld).project(cam2)
        port.c[i][0] = v2.x
        port.c[i][1] = v2.y
        const px = (v2.x * 0.5 + 0.5) * DW, py = (0.5 - v2.y * 0.5) * DH
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
      }
      st.sel[0] = x0; st.sel[1] = y0; st.sel[2] = x1 - x0; st.sel[3] = y1 - y0
      // the room's hum is the lamp's: it goes when the lamp is switched off at the start of the hand-off
      if (s.live) ctx.synth.bed("hum", (0.25 + 0.3 * lit) * (s.exit > 0 ? 0 : 1))
    }
  }

  // ---------------- the Format Picture panel (drawn in the type layer: it is the deck's own UI)
  const PX = 1352, PY = 286, PW = 468, PH = 560
  const TR0 = PX + 40, TR1 = PX + PW - 40, TRY = PY + 428
  function panel(g: Parameters<NonNullable<SceneInstance["type"]>>[0], s: State) {
    const pop = s.k(3, 0.7, 1.0, E.outBack)
    if (s.beat < 3 || pop <= 0) return
    const drag = st.drag
    const tx = mix(TR0, TR1, st.thumb)
    const held = s.at(3) > DRAG0 - 0.1 && s.at(3) < DRAG1 + 0.25
    // the pointer: comes in from the right, takes the thumb, lets go and backs off
    const come = s.k(3, 1.15, 1.9, E.io3), go = s.k(3, DRAG1 + 0.3, DRAG1 + 1.1, E.io3)
    const cx = mix(mix(PX + PW + 90, tx + 6, come), tx + 70, go), cy = mix(mix(PY + 250, TRY + 10, come), TRY + 86, go)
    const label = drag <= 0.0001 ? "1" : drag >= 0.9999 ? "100,000" : "…"
    g.custom(`fp${Math.round(pop * 100)},${Math.round(tx * 4)},${held ? 1 : 0},${Math.round(cx)},${Math.round(cy)},${label}`, (c) => {
      c.save()
      c.translate(PX + PW / 2, PY + PH / 2); c.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop); c.translate(-PX - PW / 2, -PY - PH / 2)
      c.globalAlpha = clamp(pop * 1.4)
      c.shadowColor = "rgba(0,0,0,0.55)"; c.shadowBlur = 50; c.shadowOffsetY = 18
      c.fillStyle = "#f4f4f4"; c.beginPath(); c.roundRect(PX, PY, PW, PH, 10); c.fill()
      c.shadowColor = "transparent"
      const arial = "Arial, Helvetica, sans-serif"
      c.fillStyle = "#1f1f1f"; c.font = `400 34px ${arial}`; c.textBaseline = "alphabetic"
      c.fillText("Format Picture", PX + 32, PY + 62)
      c.strokeStyle = "#6b6b6b"; c.lineWidth = 2.5
      c.beginPath(); c.moveTo(PX + PW - 54, PY + 38); c.lineTo(PX + PW - 34, PY + 58); c.moveTo(PX + PW - 34, PY + 38); c.lineTo(PX + PW - 54, PY + 58); c.stroke()
      // the row of tabs: fill, effects, size, picture (selected)
      const tabs = PY + 96
      for (let i = 0; i < 4; i++) {
        const x = PX + 36 + i * 62
        c.strokeStyle = i === 3 ? SELECT : "#8a8a8a"; c.lineWidth = 2.5
        if (i === 0) { c.beginPath(); c.moveTo(x + 6, tabs + 30); c.lineTo(x + 20, tabs + 4); c.lineTo(x + 34, tabs + 30); c.closePath(); c.stroke() }
        else if (i === 1) { c.beginPath(); c.moveTo(x + 20, tabs + 2); c.lineTo(x + 36, tabs + 18); c.lineTo(x + 20, tabs + 34); c.lineTo(x + 4, tabs + 18); c.closePath(); c.stroke() }
        else if (i === 2) { c.strokeRect(x + 5, tabs + 5, 30, 26); c.beginPath(); c.moveTo(x + 5, tabs + 14); c.lineTo(x + 35, tabs + 14); c.stroke() }
        else { c.strokeRect(x + 4, tabs + 4, 32, 28); c.beginPath(); c.moveTo(x + 6, tabs + 28); c.lineTo(x + 16, tabs + 16); c.lineTo(x + 23, tabs + 23); c.lineTo(x + 28, tabs + 18); c.lineTo(x + 34, tabs + 28); c.stroke() }
      }
      c.fillStyle = SELECT; c.fillRect(PX + 36 + 3 * 62 - 2, tabs + 44, 44, 4)
      c.fillStyle = "#d6d6d6"; c.fillRect(PX, tabs + 48, PW, 1.5)
      c.fillStyle = "#1f1f1f"; c.font = `700 24px ${arial}`
      c.fillText("▾  Picture Corrections", PX + 32, PY + 204)
      // two idle sliders, then the one that matters
      const row = (name: string, y: number, at: number, live: boolean) => {
        c.fillStyle = live ? "#1f1f1f" : "#8a8a8a"; c.font = `400 24px ${arial}`
        c.fillText(name, PX + 40, y - 26)
        c.fillStyle = "#c9c9c9"; c.fillRect(TR0, y - 2, TR1 - TR0, 4)
        if (live) {
          c.fillStyle = SELECT; c.fillRect(TR0, y - 2, at - TR0, 4)
          c.fillStyle = "#7a7a7a"
          for (let n = 0; n <= 5; n++) c.fillRect(mix(TR0, TR1, n / 5) - 1, y + 14, 2, n === 0 || n === 5 ? 14 : 9)
          c.font = `400 19px ${arial}`; c.fillStyle = "#5c5c5c"
          c.textAlign = "left"; c.fillText("1", TR0 - 4, y + 52)
          c.textAlign = "right"; c.fillText("100,000", TR1 + 4, y + 52)
          c.textAlign = "center"; c.fillText("log scale", (TR0 + TR1) / 2, y + 52)
          c.textAlign = "left"
        }
        c.beginPath(); c.arc(at, y, live && held ? 13 : 11, 0, 7)
        c.fillStyle = live ? "#ffffff" : "#ededed"; c.fill()
        c.strokeStyle = live ? SELECT : "#9a9a9a"; c.lineWidth = live ? 3 : 2; c.stroke()
      }
      row("Sharpness", PY + 276, mix(TR0, TR1, 0.5), false)
      row("Brightness", PY + 352, mix(TR0, TR1, 0.5), false)
      row("Contrast", TRY, tx, true)
      // the value box
      c.strokeStyle = "#a9a9a9"; c.lineWidth = 1.5; c.fillStyle = "#ffffff"
      c.beginPath(); c.roundRect(TR1 - 150, TRY - 54, 150, 36, 4); c.fill(); c.stroke()
      c.fillStyle = "#1f1f1f"; c.font = `400 22px ${arial}`; c.textAlign = "right"
      c.fillText(`× ${label}`, TR1 - 12, TRY - 28)
      c.textAlign = "left"
      c.fillStyle = "#8a8a8a"; c.font = `400 20px ${arial}`
      c.fillText("Reset", PX + 40, PY + PH - 34)
      c.restore()
      // pointer
      c.globalAlpha = clamp(pop * 2) * (1 - clamp(go * 1.5 - 0.5))
      c.translate(cx, cy)
      c.shadowColor = "rgba(0,0,0,0.4)"; c.shadowBlur = 6; c.shadowOffsetY = 2
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(7.5, 23); c.lineTo(13, 35); c.lineTo(17.5, 33); c.lineTo(12, 21.5); c.lineTo(22, 21.5); c.closePath()
      c.fillStyle = "#ffffff"; c.fill(); c.shadowColor = "transparent"; c.strokeStyle = "#111111"; c.lineWidth = 2; c.stroke()
    })
  }

  return {
    cues,
    update,
    // everything this scene draws, so the engine compiles both halves before the first is shown
    warm: () => [
      ...(cardsLo ? [{ scene: volLo, camera: cam1, target: cardsLo }] : []),
      { scene: vol, camera: cam1, target: stage },
      ...(shaftPass && shaftLo ? [{ pass: shaftPass, target: shaftLo }] : []),
      { pass: rays, target: post1 },
      { scene: room, camera: cam2, target: stage },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      if (!st.room) {
        if (cardsLo) {
          r.setClearColor(0x000000, 0)
          r.setRenderTarget(cardsLo)
          r.render(volLo, cam1)
          const up = ctx.scratch(FULL)
          ctx.upsample(cardsLo.texture, up)
          tCards.value = up.texture
          r.setClearColor(0x000000, 1)
        }
        r.setRenderTarget(stage)
        r.render(vol, cam1)
        const w = st.wall
        if (shaftPass && shaftLo) {
          shaftPass.render(shaftLo)
          const up = ctx.scratch(FULL)
          ctx.upsample(shaftLo.texture, up)
          RU.tS.value = up.texture
        }
        rays.render(post1)
        POST1.exposure = mix(0.82, 1.15, 1 - w) + 0.9 * st.flash
        POST1.bloom = mix(0.4, 0.8, 1 - w) + st.flash
        POST1.bloomThresh = mix(1.25, 0.9, 1 - w)
        POST1.contrast = mix(1.16, 1.22, 1 - w)
        POST1.vignette = mix(0.3, 0.2, 1 - w)
        ctx.finish(post1.texture, POST1)
      } else {
        r.setRenderTarget(stage)
        r.render(room, cam2)
        const d = st.drag
        POST2.exposure = 1.05 + 0.5 * st.flash
        POST2.bloom = 0.42 + 0.3 * st.flash + 0.14 * d
        POST2.bloomThresh = mix(0.92, 0.8, d)
        POST2.sat = mix(1.05, 1.18, d)
        ctx.finish(stage.texture, POST2)
      }
    },
    type(g, s) {
      const dark = st.room || s.beat === 1
      titles(g, s, ctx.def, { color: "#fff7ec", shadow: dark ? "rgba(0,0,0,0.6)" : "rgba(70,22,0,0.75)", delay: [1.3, 0.35, 1.2, 0.3], maxLine: 40, subAlpha: 0.9, heads: ["For 380,000 years,\nlight gets nowhere."] })
      if (s.beat === 3) {
        // the plate is a picture on a slide: select it, then open its format panel
        const a = s.k(3, 0.3, 0.5, E.out3)
        const pad = 16 + 2.5 * Math.sin(s.time * 2.1) + 46 * (1 - s.k(3, 0.3, 0.62, E.outBack))
        g.selbox(st.sel[0] - pad, st.sel[1] - pad, st.sel[2] + pad * 2, st.sel[3] + pad * 2, a, SELECT)
        panel(g, s)
      }
    },
    hud: (s: State) => (s.beat === 0 ? HUD0 : HUD1),
    portal: () => (st.room ? port : null),
    dispose() {
      disposeTree(vol)
      disposeTree(volLo)
      disposeTree(room)
      cardMat.dispose()
      for (const g of geos) g.dispose()
      for (const t of texs) t.dispose()
    },
  }
}
