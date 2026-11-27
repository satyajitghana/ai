// 15 → 16. Teeth rise out of the metal. The outgoing frame is cut, along a bright seam, into
// fifteen toothed wheels of the mechanism's own tooth counts (one instanced gear, the count a
// per-instance number), each still carrying its piece of the old picture. They lift out of the
// plate, the plate falls away, they pull apart and spin freely, then close up along the train: one
// joint after another drops into mesh, and from then on each wheel is turned by its neighbour at
// the true ratio of their teeth. The last pair (the 188 on the 224) engages at `inAt` and the
// whole train runs; the lens pushes into the 224, which greens, slows and seizes exactly where the
// next scene's four-spoked wheel is.
//
// Everything is closed-form in the transition's linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp, cos, dot, float, Fn, length, max, mix, normalize, positionGeometry, pow, sin, smoothstep, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4, instanceIndex } from "three/tsl"

import { H, type Pos } from "../engine/synth"
import { luma, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const MESH_DUR = 2.8
export const MESH_IN = 0.6
/** Where the big wheel ends: centre (uv, y up), tip radius in frame heights, and its resting turn. */
export const MESH_WHEEL = { cx: 0.56, cy: 0.5, r: 0.455, teeth: 224, rot: 0.21 }

const TAU = Math.PI * 2
const MOD = 0.6 / 112 // every wheel has the same pitch, or they could not mesh: the 224 is 0.6 of a half-frame in radius
const sm = (a: number, b: number, v: number) => {
  const q = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return q * q * (3 - 2 * q)
}

/** The train: teeth, the wheel that drives it (-1 for the first), where it sits from that wheel (degrees), when the joint closes. */
const TRAIN: [number, number, number, number][] = [
  [53, -1, 0, 0],
  [96, 0, 35, 0.36],
  [188, 1, -30, 0.42],
  [224, 2, -8, MESH_IN], // the last pair
  [127, 3, 20, 0.38],
  [96, 4, -60, 0.41],
  [53, 5, 20, 0.44],
  [64, 4, 75, 0.47],
  [38, 7, 150, 0.5],
  [64, 2, 250, 0.44],
  [48, 9, 200, 0.46],
  [96, 2, 95, 0.48],
  [53, 3, 265, 0.4],
  [38, 12, 180, 0.45],
  [64, 3, 100, 0.5],
]
const NW = TRAIN.length
const BIG = 3
const ROOT_AT: [number, number] = [-1.679, 0.205]
const GAP = 0.085 // how far a joint stands open
const TH = 0.22 // a wheel's thickness, in the lens's units of height

type Wheel = { n: number; rp: number; par: number; dir: [number, number]; al: number; e: number; rest: number; x0: number; y0: number; spin: number; off: number; lift: number }
const WHEELS: Wheel[] = TRAIN.map(([n, par, deg, e], k) => ({ n, rp: (MOD * n) / 2, par, dir: [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)], al: (deg * Math.PI) / 180, e, rest: 0, x0: 0, y0: 0, spin: (k % 2 ? -1 : 1) * (0.9 + ((k * 37) % 10) / 9), off: 0, lift: 0.35 + ((k * 53) % 7) / 9 }))
/** The driver's turn (radians) at progress p: it starts, doubles when the last pair engages, and runs down as the train seizes. */
const RAMP: [number, number, number][] = [[0.2, 0.34, 2.0], [MESH_IN, MESH_IN + 0.05, 3.4], [0.72, 0.9, -5.4]]
const driverAt = (p: number) =>
  RAMP.reduce((s, r) => {
    if (p <= r[0]) return s
    const x = Math.min(1, (p - r[0]) / (r[1] - r[0]))
    return s + r[2] * MESH_DUR * ((r[1] - r[0]) * (x * x * x - (x * x * x * x) / 2) + Math.max(0, p - r[1]))
  }, 0)
let ROOT_PH = 0
const freeSpin = (p: number) => sm(0.16, 0.3, p) * Math.max(0, p - 0.16) * MESH_DUR
/** Tooth meets gap: the driven wheel's turn from its driver's. */
const meshed = (w: Wheel, parAngle: number) => {
  const a = WHEELS[w.par]
  return w.al + Math.PI - (a.n / w.n) * (parAngle + Math.PI / a.n - w.al)
}
const ANG = new Float64Array(NW)
/** Every wheel's turn at p. Until its joint closes a wheel spins on its own; then its driver has it. */
function angles(p: number, out = ANG) {
  for (let k = 0; k < NW; k++) {
    const w = WHEELS[k]
    if (w.par < 0) {
      out[k] = ROOT_PH + driverAt(p)
      continue
    }
    const free = w.rest + w.spin * freeSpin(p)
    out[k] = mix1(free, meshed(w, out[w.par]) + w.off, sm(w.e - 0.07, w.e, p))
  }
  return out
}
const mix1 = (a: number, b: number, t: number) => a + (b - a) * t
// ---- solve the layout once: rest positions and turns (the cut is the train at rest, already in mesh), then the
// driver's phase that leaves the 224 where the next scene's wheel is, then each joint's nearest tooth
{
  const place = () => {
    for (const w of WHEELS) {
      if (w.par < 0) {
        w.x0 = ROOT_AT[0]
        w.y0 = ROOT_AT[1]
        w.rest = ROOT_PH
        continue
      }
      const a = WHEELS[w.par]
      w.x0 = a.x0 + w.dir[0] * (a.rp + w.rp)
      w.y0 = a.y0 + w.dir[1] * (a.rp + w.rp)
      w.rest = meshed(w, a.rest)
    }
  }
  place()
  // the 224's last turn is linear in the driver's phase: move the phase by the fraction of a tooth that is wanted
  const end = (ph: number) => {
    ROOT_PH = ph
    place()
    let a = ph + driverAt(1)
    const chain = [1, 2, 3]
    for (const k of chain) a = meshed(WHEELS[k], a)
    return a
  }
  const f0 = end(0), slope = end(1) - f0
  const pitch = TAU / MESH_WHEEL.teeth
  let need = (MESH_WHEEL.rot - f0) % pitch
  if (need > pitch / 2) need -= pitch
  if (need < -pitch / 2) need += pitch
  end(need / slope)
  // each joint closes on the tooth nearest to where the free wheel happens to be
  const order = WHEELS.map((_, k) => k).filter((k) => WHEELS[k].par >= 0).sort((a, b) => WHEELS[a].e - WHEELS[b].e)
  for (const k of order) {
    const w = WHEELS[k]
    const a = angles(w.e)
    const free = w.rest + w.spin * freeSpin(w.e)
    const pc = TAU / w.n
    w.off = -Math.round((meshed(w, a[w.par]) - free) / pc) * pc
  }
}

// Sound: every joint is a ratchet where it closes; the last is the hit. Then the train's own clatter, slowing.
const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "hiss", p: 0.01, o: { f: 2400, dur: 0.5, g: 0.22 } },
  { s: "scratch", p: 0.02, o: { f: 700, dur: 0.45, g: 0.3 } },
  { s: "whoosh", p: 0.14, o: { f: H(6), dur: 0.9, g: 0.3 } },
]
WHEELS.forEach((w, k) => {
  if (w.par < 0 || k === BIG) return
  const pos: Pos = [w.x0 / 1.78, w.y0, 0.15]
  snd.push({ s: "gear", p: w.e - 0.02, o: { f: H(26 + (k % 7) * 2), g: 0.3, dur: 0.1, pos } })
})
snd.push(
  { s: "gear", p: MESH_IN - 0.03, o: { f: H(16), g: 0.7, dur: 0.14, pos: [0.1, 0, 0.1] } },
  { s: "anvil", p: MESH_IN, o: { f: H(12), g: 0.5, pos: [0.1, 0, 0.1] } },
  { s: "sub", p: MESH_IN, o: { f: H(2), dur: 1.4, g: 0.6 } },
  { s: "whoosh", p: MESH_IN + 0.02, o: { f: H(4), dur: 1.0, g: 0.4 } },
)
for (let i = 0; i < 9; i++) {
  // the 224's teeth going by, slower and slower
  const p = MESH_IN + 0.04 + 0.26 * (i / 8) ** 0.75
  snd.push({ s: "gear", p, o: { f: H(22 - i), g: 0.34 - i * 0.02, dur: 0.1, pos: [0.1, -0.1, 0.05] } })
}
snd.push({ s: "thud", p: 0.9, o: { f: H(3), g: 0.5 } }, { s: "crack", p: 0.905, o: { f: 1500, g: 0.2, pos: [0.3, 0.2, 0] } })

const t: TransitionDef = {
  id: "mesh",
  dur: MESH_DUR,
  inAt: MESH_IN,
  snd,
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tM: uniformTexture(rt.texture),
      p: uniform(0),
      asp: uniform(16 / 9),
      view: uniform(new THREE.Vector3(0, 0, 1)), // centre, zoom
      lit: uniform(0), // 0: the old picture untouched
      seam: uniform(0), // how far round each wheel the cut has run
      heat: uniform(0),
      tint: uniform(0), // the picture turning to bronze
      green: uniform(0),
      plate: uniform(0), // the plate between the wheels falling away
      xf: uniform(0),
      roll: uniform(0),
    }
    const dyn = Array.from({ length: NW }, () => new THREE.Vector4())
    const uD = uniformArray(dyn, "vec4") // centre x, y, turn, lift

    // ---- one wheel of 224 teeth: an instance with fewer folds the rest into its hub
    const KN: [number, number][] = [[0, 0], [0.07, 0.09], [0.455, 0.93], [0.5, 1], [0.545, 0.93], [0.93, 0.09], [1, 0]]
    const aP: number[] = [], aQ: number[] = [], idx: number[] = []
    const vtx = (tt: number, f: number, h: number, r: number, z: number, wall: number, f2: number, h2: number) => {
      aP.push(tt, f, h, r)
      aQ.push(z, wall, f2, h2)
      return aP.length / 4 - 1
    }
    for (let tt = 0; tt < 224; tt++)
      for (let j = 0; j < 6; j++) {
        const [f0, h0] = KN[j], [f1, h1] = KN[j + 1]
        const a = vtx(tt, f0, h0, 0, 1, 0, f1, h1), b = vtx(tt, f0, h0, 1, 1, 0, f1, h1), c = vtx(tt, f1, h1, 1, 1, 0, f0, h0), d = vtx(tt, f1, h1, 0, 1, 0, f0, h0)
        idx.push(a, b, c, a, c, d)
        // the wall under the outline: `wall` is +1 where the edge runs on from this vertex, -1 where it arrives
        const e = vtx(tt, f0, h0, 1, 0, 1, f1, h1), g = vtx(tt, f1, h1, 1, 0, -1, f0, h0), i2 = vtx(tt, f1, h1, 1, 1, -1, f0, h0), j2 = vtx(tt, f0, h0, 1, 1, 1, f1, h1)
        idx.push(e, g, i2, e, i2, j2)
      }
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((aP.length / 4) * 3), 3))
    geo.setAttribute("aP", new THREE.BufferAttribute(new Float32Array(aP), 4))
    geo.setAttribute("aQ", new THREE.BufferAttribute(new Float32Array(aQ), 4))
    geo.setIndex(idx)
    const iA = new Float32Array(NW * 4)
    WHEELS.forEach((w, k) => iA.set([w.x0, w.y0, w.n, w.rest], k * 4))
    geo.setAttribute("iA", new THREE.InstancedBufferAttribute(iA, 4))
    geo.instanceCount = NW
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

    const wheelMat = (shadow: boolean) => {
      const m = new THREE.NodeMaterial()
      const P = attribute("aP", "vec4") as unknown as V4
      const Q = attribute("aQ", "vec4") as unknown as V4
      const I = attribute("iA", "vec4") as unknown as V4
      const Dn = uD.element(instanceIndex) as unknown as V4
      const n = I.z
      const pitch = float(TAU).div(n)
      const rp = n.mul(MOD / 2)
      const hgt = pitch.mul(rp).mul(0.84)
      const alive = step(P.x, n.sub(0.5))
      const pt = (f: F, h: F, turn: F): V2 => {
        const a = P.x.add(f).mul(pitch).mul(alive).add(turn)
        const r = mix(rp.mul(0.04), rp.sub(hgt.mul(0.5)).add(h.mul(hgt)), P.w).mul(alive)
        return vec2(cos(a), sin(a)).mul(r) as V2
      }
      const loc = pt(P.y as F, P.z as F, Dn.z as F)
      const other = pt(Q.z as F, Q.w as F, Dn.z as F)
      const edge = other.sub(loc).mul(Q.y)
      const nrm = normalize(vec2(edge.y, edge.x.negate()).add(vec2(1e-6, 0)))
      // the face rides at the wheel's lift (so at rest it lies exactly in the old picture); the wall hangs below it
      const zh = shadow ? Dn.w.mul(0) : Dn.w.sub(Q.x.oneMinus().mul(TH))
      const wpos = Dn.xy.add(loc).add(shadow ? vec2(0.035, -0.05).mul(Dn.w) : vec2(0, 0))
      const persp = zh.mul(0.085).add(1)
      const s0 = wpos.sub(U.view.xy).mul(U.view.z).mul(persp)
      // the lens rolls a little as it goes in, and is level again when it arrives
      const sc = vec2(s0.x.mul(cos(U.roll)).sub(s0.y.mul(sin(U.roll))), s0.x.mul(sin(U.roll)).add(s0.y.mul(cos(U.roll))))
      m.vertexNode = vec4(sc.x.div(U.asp), sc.y, shadow ? float(0.95) : float(0.9).sub(zh.mul(0.2)), 1)
      if (shadow) {
        const vL = Dn.w.toVarying()
        m.fragmentNode = vec4(0, 0, 0, clamp(vL.mul(2.2), 0, 0.66))
        Object.assign(m, { transparent: true, depthWrite: false, depthTest: false })
        return m
      }
      // where this point of the wheel lay in the old picture
      const rest = I.xy.add(pt(P.y as F, P.z as F, I.w as F))
      const vUV = vec2(rest.x.div(U.asp).mul(0.5).add(0.5), rest.y.mul(0.5).add(0.5)).toVarying() as unknown as V2
      const vLoc = loc.toVarying() as unknown as V2
      const vWall = abs(Q.y).toVarying() as unknown as F
      const vN = nrm.toVarying() as unknown as V2
      const vR = P.w.toVarying() as unknown as F
      const vTooth = P.x.div(n).toVarying() as unknown as F
      const vK = float(instanceIndex).toVarying() as unknown as F
      const vRp = rp.toVarying() as unknown as F
      m.fragmentNode = Fn(() => {
        const A = toLinear(sampleRT(U.tA, vUV).rgb).toVar()
        const lum = luma(A)
        const bronze = vec3(0.84, 0.5, 0.23)
        const r = length(vLoc)
        // turned metal: fine rings, and the lamp as a streak across them
        const T = normalize(vec2(vLoc.y.negate(), vLoc.x))
        const th = dot(T, normalize(vec2(-0.55, 0.83)))
        const streak = pow(max(th.mul(th).oneMinus(), 0), 9)
        const rings = sin(r.mul(520)).mul(0.5).add(0.5)
        // (a floor under the picture's light: metal's last frame is a dark forge, and bronze still shines in it)
        const metal = bronze.mul(lum.mul(1.05).add(0.38)).mul(rings.mul(0.1).add(0.92)).add(vec3(1.0, 0.72, 0.4).mul(streak).mul(0.62))
        const top = mix(A, metal, U.tint).toVar()
        // the hub and the root circle, scribed
        top.mulAssign(float(1).sub(smoothstep(0.012, 0.0, abs(r.sub(vRp.mul(0.2)))).mul(0.4).mul(U.tint)))
        // the wall: lit from the upper left, still glowing where the cut has just run
        const nd = dot(vN, normalize(vec2(-0.55, 0.83))).mul(0.5).add(0.5)
        const hot = vec3(1.0, 0.42, 0.08).mul(2.2).mul(U.heat)
        const wall = bronze.mul(lum.mul(0.6).add(0.32)).mul(nd.mul(1.1).add(0.12)).add(hot)
        const col = mix(top, wall, step(0.5, vWall)).toVar()
        // the seam on the face, running round the wheel tooth by tooth
        const cutOn = step(vTooth, U.seam).mul(smoothstep(0.93, 1.0, vR)).mul(U.heat)
        col.assign(mix(col, vec3(1.0, 0.62, 0.25).mul(1.6), cutOn.mul(0.9)))
        // seizing: green from the teeth inward
        const g = vnoise(vLoc.mul(26).add(vK.mul(7.1))).mul(0.6).add(vnoise(vLoc.mul(90)).mul(0.4))
        const gr = smoothstep(1.0, 1.25, U.green.mul(1.5).add(vR.mul(0.35)).add(g.mul(0.5)))
        col.assign(mix(col, mix(vec3(0.2, 0.34, 0.28), vec3(0.55, 0.62, 0.55), g).mul(lum.mul(0.5).add(0.5)), gr.mul(0.9)))
        const flat = toLinear(sampleRT(U.tA, vUV).rgb)
        return vec4(toSRGB(mix(flat, col, U.lit)), 1)
      })()
      m.side = THREE.DoubleSide
      return m
    }
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const wheels = new THREE.Mesh(geo, wheelMat(false))
    const shadows = new THREE.Mesh(geo, wheelMat(true))
    wheels.frustumCulled = shadows.frustumCulled = false
    shadows.renderOrder = 1
    wheels.renderOrder = 2
    // ---- the plate the wheels were cut from: it drops back into the dark with their outlines still glowing in it
    const bgGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    const bgMat = new THREE.NodeMaterial()
    bgMat.vertexNode = vec4(positionGeometry.xy, 0.99, 1)
    const vS = positionGeometry.xy.toVarying() as unknown as V2
    bgMat.fragmentNode = Fn(() => {
      // the plate tips back from its top edge as it falls
      const d = U.plate
      const k = d.mul(0.55).add(1).add(vS.y.mul(d).mul(0.25))
      const q = vec2(vS.x.mul(k), vS.y.mul(k).add(d.mul(0.5)))
      const uv = q.mul(0.5).add(0.5)
      const inside = step(abs(q.x), 1).mul(step(abs(q.y), 1))
      const A = toLinear(sampleRT(U.tA, clamp(uv, 0, 1) as V2).rgb)
      // under it, the bench: dark boards in a pool of lamplight
      const bq = vec2(vS.x.mul(U.asp), vS.y).div(U.view.z).add(U.view.xy)
      const grain = vnoise(vec2(bq.x.mul(2.2), bq.y.mul(38))).mul(0.6).add(vnoise(vec2(bq.x.mul(9), bq.y.mul(150))).mul(0.4))
      const pool = smoothstep(2.2, 0.1, length(bq.sub(vec2(0.3, 0.1))))
      const dark = vec3(0.2, 0.105, 0.045).mul(grain.mul(0.6).add(0.5)).mul(pool.mul(0.55).add(0.05)).mul(float(1).sub(smoothstep(0.03, 0.0, abs(bq.y.mul(1.9).fract().sub(0.5))).mul(0.5)))
      const col = mix(dark, A.mul(d.mul(d).oneMinus().mul(0.9).add(0.1)), inside.mul(smoothstep(1, 0.75, d)))
      return vec4(toSRGB(mix(toLinear(sampleRT(U.tA, vS.mul(0.5).add(0.5) as V2).rgb), col, step(0.0005, d))), 1)
    })()
    bgMat.depthTest = false
    bgMat.depthWrite = false
    const bg = new THREE.Mesh(bgGeo, bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0
    scene.add(bg, shadows, wheels)
    const blit = ctx.pass(({ uv }) => vec4(mix(sampleRT(U.tM, uv).rgb, sampleRT(U.tB, uv).rgb, U.xf), 1), U)
    const A2 = new Float64Array(NW)
    const cx = new Float64Array(NW), cy = new Float64Array(NW)

    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        const p = a.pl
        U.asp.value = asp
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = p
        U.lit.value = sm(0.0, 0.1, p)
        U.seam.value = p / 0.15
        U.heat.value = sm(0.0, 0.03, p) * (1 - sm(0.16, 0.42, p))
        U.tint.value = 0.72 * sm(0.1, 0.5, p)
        U.green.value = sm(0.7, 0.93, p)
        U.plate.value = sm(0.1, 0.46, p) ** 1.5
        U.xf.value = sm(0.84, 1, p)
        U.roll.value = 0.09 * Math.sin(Math.PI * sm(0.12, 0.97, p)) * Math.sin(Math.PI * sm(0.12, 0.97, p))
        const ang = angles(p, A2)
        // joints stand open until they close; the wheels ride at different heights until then
        const open = sm(0.15, 0.3, p)
        for (let k = 0; k < NW; k++) {
          const wl = WHEELS[k]
          const shut = sm(wl.e - 0.16, wl.e, p)
          if (wl.par < 0) {
            cx[k] = wl.x0 - 0.1 * open * (1 - sm(0.3, 0.42, p))
            cy[k] = wl.y0
          } else {
            const d = WHEELS[wl.par].rp + wl.rp + GAP * open * (1 - shut) * (k === BIG ? 1.5 : 1)
            cx[k] = cx[wl.par] + wl.dir[0] * d
            cy[k] = cy[wl.par] + wl.dir[1] * d
          }
          const up = sm(0.05 + k * 0.008, 0.24 + k * 0.008, p)
          // the kick when the last pair meets
          const kick = p > MESH_IN ? 0.12 * Math.exp(-(p - MESH_IN) * MESH_DUR * 9) * Math.cos((p - MESH_IN) * MESH_DUR * 30 + k) : 0
          dyn[k].set(cx[k], cy[k], ang[k], up * mix1(wl.lift, 0.5, wl.par < 0 ? sm(0.3, 0.42, p) : shut) + kick)
        }
        // the lens: holds the whole train, then pushes into the 224 until it is the next scene's wheel
        const big = WHEELS[BIG]
        const z1 = (MESH_WHEEL.r * 2) / (big.rp * 1.0079 + 0.0005)
        const go = sm(MESH_IN - 0.02, 0.96, p)
        const z = 1 + 0.04 * sm(0, MESH_IN, p) + (z1 - 1.04) * go * go * (3 - 2 * go)
        const tx = (MESH_WHEEL.cx - 0.5) * 2 * asp, ty = (MESH_WHEEL.cy - 0.5) * 2
        const kx = cx[BIG] - tx / z1, ky = cy[BIG] - ty / z1
        const after = Math.max(0, p - MESH_IN) * MESH_DUR
        const jolt = p > MESH_IN ? 0.012 * Math.exp(-after * 8) * Math.sin(after * 41) : 0
        U.view.value.set(kx * go + jolt, ky * go - jolt * 0.6, z)
        const r = ctx.renderer
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tM.value = rt.texture
        blit.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: rt },
        { pass: blit, target: hold },
      ],
      dispose() {
        geo.dispose()
        bgGeo.dispose()
        wheels.material.dispose()
        shadows.material.dispose()
        bgMat.dispose()
        blit.dispose()
      },
    }
  },
}
export default t
