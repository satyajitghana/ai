// Scene 7, impact: "Dust becomes a planet."
//
// Idea. You are standing on the young Earth when something the size of Mars comes over the horizon.
// A magma plain under a black sky; a second world rises, huge, and hits beyond the horizon; a wall
// of light crosses the plain and throws the camera; then the debris overhead gathers into the Moon.
//
// Story parameters. `theia` 0..1 (the approach, ending on contact), then `ring` 0..1 (accretion).
// Around them `front` (where the shock is on the plain), `molten` and `cool` (how much crust there
// is). Nothing is accumulated: every frame is drawn from the beat clock.
//
// World rule: one sky light. `uKeyDir`/`uKeyCol` is whatever is brightest in the sky (nothing, then
// Theia's sunlit limb, then the flash, the wall, the vapour, the new Moon) and `uAmb`/`uHaze` the
// glow of the air; `sky()` is its JS twin. They light the crust, the slabs and the shadows the slabs
// throw, the ash and the dust. The magma lights itself. One Sun (`SUN`, below our horizon: this is
// the night side) lights Theia, the ring and the Moon, and gives the Earth the shadow the ring
// passes through.
//
// Two scales. The plain is in metres, more or less (eye height 1.5). The sky is in Earth radii and
// is drawn at its true angular size as seen from latitude 40 N looking south, with the ring in the
// equatorial plane: Theia at contact, 50 degrees of arc away, is 54 degrees wide with its centre on
// the horizon; the Moon, formed just outside the Roche limit, is ten degrees across. Sky things are
// hung on the camera at a fixed distance and drawn before the ground, so the horizon cuts them.
//
// Big sets are placed in the vertex stage from seeds (ash, fountain drops, ejecta, 64,000 ring
// fragments on Kepler orbits, the surge's four ranks, the plates it lifts); small sets (meteors,
// fountains, moonlets, slabs) come from JS tables. The cones' shadows are a half-size mask the plain reads.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalGeometry, normalize, instanceIndex, positionGeometry, pow, reflect, screenUV, sign, sin, smoothstep, sqrt, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, shake, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { titles, TYPE, type TitleOpts } from "../engine/titles"
import { fbm, hash22, L0, rot, sampleRT, sat, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"

// ---------------------------------------------------------------- the clock
const T_HIT = 5.4 // beat 2: contact
const T_BURN = 0.45 // after contact: the held instant ends
const T_WALL = 0.8 // the wall starts across the plain
const T_ARR = 2.3 // it reaches the lens (and so does the sound)
const RING0 = 1.0 // beat 3: accretion starts
const RING1 = 7.4
const DEG = Math.PI / 180

// ---------------------------------------------------------------- the sky's geometry (Earth radii)
const LAT = 40 * DEG
const SKY_S = 3000 // plain units per Earth radius, for things hung on the camera
const ROCHE = 2.9
const ACO = 2.33 // corotation radius for a five-hour day
const KEP = (a: number) => Math.pow(a, -1.5)
const OMEGA = KEP(ACO)
const E1: [number, number, number] = [0, Math.cos(LAT), -Math.sin(LAT)] // in the ring's plane, up the meridian
const AX: [number, number, number] = [0, Math.sin(LAT), Math.cos(LAT)] // the spin axis
const SUN = new THREE.Vector3(-0.86, -0.1, -0.5).normalize()
const AZ_HIT = 0.36 // where on the horizon it happens (radians right of ahead)
const R_MOON = 0.27
const NML = 9 // moonlets

/** A point of the ring's plane (radius a, angle th from the meridian, eastward; z off the plane) as seen from where we stand. */
function skyAt(a: number, th: number, z: number, out: THREE.Vector3) {
  const c = a * Math.cos(th), s = a * Math.sin(th)
  return out.set(-s + AX[0] * z, E1[1] * c + AX[1] * z - 1, E1[2] * c + AX[2] * z)
}

// ---------------------------------------------------------------- sizes
const N_ASH = 2600
const N_DROP = 3500
const N_EJ = 3200
const N_RING = 64000
const N_MET = 14
const N_FOUNT = 7
const N_FUME = 90
const N_SLAB = 44
const N_DUST = 260
const CELL = 4.6 // a raft of crust
const BIG = 44 // the rifts between fields of rafts

const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } as const
const OVER = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } as const
const sq = (x: F): F => x.mul(x) as F
type Num = number | THREE.Node<"float">
const fl = (x: Num) => (typeof x === "number" ? float(x) : x)
/** A falling smoothstep (1 at x <= e1, 0 at x >= e0): WGSL leaves smoothstep with e0 > e1 undefined. */
const ssr = (e0: Num, e1: Num, x: Num): F => {
  const t = clampN(fl(e0).sub(x).div(fl(e0).sub(e1)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

/** Incandescent rock: dull red, orange, yellow, white. t about 0.3 to 2. */
const heat = /*@__PURE__*/ Fn(([t_]: [F]) => {
  const t = max(t_, 0).toVar()
  const chroma = mixN(mixN(vec3(1, 0.07, 0.0), vec3(1, 0.34, 0.045), sat(t.sub(0.3).div(0.7) as F)), vec3(1, 0.88, 0.66), sat(t.sub(1).div(1.1) as F))
  return chroma.mul(t.mul(t).mul(1.5))
}).setLayout({ name: "impHeat", type: "vec3", inputs: [{ name: "t", type: "float" }] })

/** Two octaves of value noise: where five would be lost in haze or distance. */
const fbm2 = (p: V2): F => vnoise(p).mul(0.64).add(vnoise(p.mul(2.3).add(vec2(5.1, 2.7))).mul(0.36)) as F

/** Cells whose points wander: vec4(offset to the nearest point, offset to the second nearest). */
const vor = /*@__PURE__*/ Fn(([p, t]: [V2, F]) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const d1 = float(8).toVar()
  const d2 = float(8).toVar()
  const o1 = vec2(0).toVar()
  const o2 = vec2(0).toVar()
  Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
    const g = vec2(float(x), float(y)).toVar()
    const h = hash22(i.add(g)).toVar()
    const o = sin(h.mul(6.2831).add(t.mul(h.yx.add(0.5)))).mul(0.5).add(0.5)
    const r = g.add(o).sub(f).toVar()
    const d = dot(r, r).toVar()
    If(d.lessThan(d1), () => {
      d2.assign(d1)
      o2.assign(o1)
      d1.assign(d)
      o1.assign(r)
    }).ElseIf(d.lessThan(d2), () => {
      d2.assign(d)
      o2.assign(r)
    })
  })
  return vec4(o1, o2)
}).setLayout({ name: "impVor", type: "vec4", inputs: [{ name: "p", type: "vec2" }, { name: "t", type: "float" }] })

/** Craters: vec4(offset to the nearest centre, its distance, a hash). */
const vorC = /*@__PURE__*/ Fn(([p]: [V2]) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const d1 = float(8).toVar()
  const o1 = vec2(0).toVar()
  const h1 = float(0).toVar()
  Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
    const g = vec2(float(x), float(y)).toVar()
    const h = hash22(i.add(g)).toVar()
    const r = g.add(h).sub(f).toVar()
    const d = dot(r, r).toVar()
    If(d.lessThan(d1), () => {
      d1.assign(d)
      o1.assign(r)
      h1.assign(fract(h.x.mul(7.31).add(h.y)))
    })
  })
  return vec4(o1, sqrt(d1), h1)
}).setLayout({ name: "impVorC", type: "vec4", inputs: [{ name: "p", type: "vec2" }] })

export function create(ctx: Ctx): SceneInstance {
  const def = ctx.def
  const B1 = def.beats[1].dur + def.beats[1].hold
  const B0 = def.beats[0].dur + def.beats[0].hold
  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const shadeT = ctx.target({ scale: 0.5, hdr: false }) // the shadows the cones throw, as a mask the plain reads
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.25, 90000)
  cam.rotation.order = "YXZ"
  const R = rng(7041)
  const R2 = rng(9173)

  const v3 = () => new THREE.Vector3()
  const v4s = (n: number) => Array.from({ length: n }, () => new THREE.Vector4())
  const fountV = v4s(N_FOUNT) // x, z, height, power
  const flashV = v4s(4) // x, z, intensity, radius of opened crust
  const mlV = v4s(NML) // a, angle, gathered 0..1, size
  const U = {
    uT: uniform(0), // ambient time (it nearly stops for the held instant)
    uFlow: uniform(new THREE.Vector2()),
    uCR: uniform(v3()), uCU: uniform(v3()), uCF: uniform(v3()),
    uPx: uniform(0.001), // one pixel at distance 1
    uKeyDir: uniform(new THREE.Vector3(0, 1, 0)), uKeyCol: uniform(v3()),
    uAmb: uniform(v3()), uHaze: uniform(v3()), uHazeK: uniform(0.0012),
    uShadow: uniform(0),
    uGrid: uniform(new THREE.Vector3(0, 4, 1)), // the plain's grid: centre x, z, scale
    uFront: uniform(-1e5), uFrontOn: uniform(0), uWave: uniform(0),
    uMolten: uniform(0), uCool: uniform(0), uHot: uniform(1),
    uLand: uniform(new THREE.Vector4(9, 0, 0, 0)), // seconds since the landing, amplitude
    uTide: uniform(new THREE.Vector4()), // amplitude, position along its travel, dir x, dir z
    uInside: uniform(0), uWallH: uniform(120), uSgD: uniform(6000), uFume: uniform(1),
    uFount: uniformArray(fountV, "vec4"), uFlash: uniformArray(flashV, "vec4"),
    // the sky
    uBand: uniform(9), uVap: uniform(0), uVapT: uniform(1.4), uGlowHit: uniform(0), uContact: uniform(0),
    uBodyDir: uniform(new THREE.Vector3(0, -1, 0)), uBodyX: uniform(new THREE.Vector3(1, 0, 0)), uBodyY: uniform(new THREE.Vector3(0, 1, 0)),
    uBodySin: uniform(0.1), uBodyOn: uniform(0), uBodyKind: uniform(0), uBodyHeat: uniform(0), uBodyCrust: uniform(0), uBodySpin: uniform(0), uShine: uniform(0),
    // the ring
    uTau: uniform(0), uRing: uniform(0), uPuff: uniform(1), uRingT: uniform(1.6), uRingOn: uniform(0), uDrain: uniform(0),
    uMl: uniformArray(mlV, "vec4"),
    // ejecta, ash, dust
    uTe: uniform(-1), uBlow: uniform(v3()), uDustT: uniform(9),
    // air
    tShade: uniformTexture(shadeT.texture),
    tS: uniformTexture(stage.texture), uHorY: uniform(0.4), uShim: uniform(1), uBurn: uniform(0), uAsp: uniform(16 / 9),
  }
  const SUNN = vec3(SUN.x, SUN.y, SUN.z)
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (vertex: THREE.Node | null, fragment: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }
  const quad = (n: number) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  }
  const add = (m: THREE.Mesh, order: number) => {
    m.frustumCulled = false
    m.renderOrder = order
    scene.add(m)
    return m
  }
  /** A camera-facing ribbon from `tail` to `head` (world), `w` wide; never thinner than `px` pixels. */
  const ribbon = (head: V3, tail: V3, w: F, px: number) => {
    const vh = cameraViewMatrix.mul(vec4(head, 1)).xyz.toVar()
    const vt = cameraViewMatrix.mul(vec4(tail, 1)).xyz.toVar()
    const u = positionGeometry.x.mul(0.5).add(0.5)
    const c = mixN(vt, vh, u).toVar()
    const along = vh.sub(vt).toVar()
    // (guarded: a ribbon seen end-on, along the line of sight, has no side; normalize(0) is NaN)
    const sx = cross(along.add(vec3(1e-4, 0, 0)), c).toVar()
    const side = sx.div(max(length(sx), 1e-6)).toVar()
    const ww = max(w, U.uPx.mul(px).mul(c.z.negate()))
    // (the ribbon is half a width longer at each end, so a still one is a round dot)
    const al = along.add(vec3(0, 1e-4, 0)).toVar()
    const ext = al.div(max(length(al), 1e-6)).mul(ww).mul(positionGeometry.x)
    return cameraProjectionMatrix.mul(vec4(c.add(side.mul(ww).mul(positionGeometry.y)).add(ext), 1))
  }

  // ---------------------------------------------------------------- the world rule: how the ground moves
  /** Height of the plain at a point: the crest of the shock, the first tide, the ring the landing leaves. */
  const dispY = Fn(([p]: [V2]) => {
    const y = float(0).toVar()
    If(U.uWave.greaterThan(0), () => {
      const L = max(float(8), abs(U.uFront).mul(0.11)).toVar()
      const x = p.y.sub(U.uFront).sub(L.mul(1.3)).div(L).toVar()
      const rough = vnoise(p.mul(0.19)).mul(0.7).add(0.5)
      y.addAssign(U.uWave.mul(exp(x.mul(x).negate())).mul(rough).mul(pow(L.div(8), 0.75)))
    })
    If(U.uTide.x.greaterThan(0), () => {
      const x = dot(p, U.uTide.zw).sub(U.uTide.y).div(70).toVar()
      y.addAssign(U.uTide.x.mul(exp(x.mul(x).negate())))
    })
    If(U.uLand.y.greaterThan(0), () => {
      const r = length(p.sub(vec2(0, 8)))
      const x = r.sub(U.uLand.x.mul(26)).div(2.4).toVar()
      y.addAssign(U.uLand.y.mul(exp(x.mul(x).negate())).mul(0.5))
    })
    return y
  })

  // ---------------------------------------------------------------- the sky
  const vNdc = positionGeometry.xy.toVarying("vNdc")
  /** The glow of the air along a ray: the magma's own haze, and after the hit the vapour. */
  const airGlow = Fn(([V]: [V3]) => {
    const up = max(V.y, 0).toVar()
    const az = atan(V.x, V.z.negate()).toVar()
    const smoke = fbm2(vec2(az.mul(2.6).add(U.uT.mul(0.012)), up.mul(9).sub(U.uT.mul(0.03))).mul(1.6) as V2).toVar()
    const band = exp(up.mul(U.uBand).negate()).mul(mixN(float(1), smoke.mul(1.5).add(0.25), sat(up.mul(14) as F)))
    const col = U.uHaze.mul(band).toVar()
    // smoke lit from below, a little higher up
    col.addAssign(U.uHaze.mul(vec3(0.5, 0.22, 0.14)).mul(sq(smoke as F)).mul(exp(up.mul(4.5).negate())).mul(0.35))
    // the place on the horizon where it will happen, and then has
    const da = az.sub(AZ_HIT)
    If(U.uGlowHit.greaterThan(0), () => {
      col.addAssign(heat(float(1.2)).mul(U.uGlowHit).mul(exp(da.mul(da).mul(-3.5))).mul(exp(up.mul(-16))).mul(0.25))
    })
    If(U.uContact.greaterThan(0), () => {
      // a white line opening along the horizon under the body: flat, not rays
      const wide = exp(da.mul(da).div(U.uContact.mul(0.5).add(0.02)).negate())
      col.addAssign(vec3(1, 0.95, 0.85).mul(U.uContact).mul(wide).mul(exp(up.mul(mixN(float(90), 9, U.uContact)).negate())).mul(26))
    })
    If(U.uVap.greaterThan(0), () => {
      const turb = fbm2(vec2(az.mul(3.4), up.mul(5).sub(U.uT.mul(0.22))).mul(1.6) as V2).toVar()
      const k = mixN(float(5.5), 1.1, U.uVap)
      const T = U.uVapT.mul(exp(up.mul(k).negate())).mul(turb.mul(0.9).add(0.55)).mul(exp(da.mul(da).mul(-0.18)).mul(0.5).add(0.5))
      col.addAssign(heat(T as F).mul(U.uVap).mul(0.55))
    })
    return col
  })
  /** The body in the sky (Theia, then the Moon): vec4(colour, coverage). */
  const body = Fn(([V]: [V3]) => {
    const D = float(1).div(U.uBodySin).toVar()
    const b = dot(V, U.uBodyDir).mul(D).toVar()
    const disc = b.mul(b).sub(D.mul(D).sub(1)).toVar()
    const edge = max(abs(dFdx(disc)).add(abs(dFdy(disc))), 1e-6)
    const cov = sat(disc.div(edge).add(0.5) as F).mul(step(0, b)).toVar()
    const col = vec3(0).toVar()
    If(cov.greaterThan(0), () => {
      const t = b.sub(sqrt(max(disc, 0)))
      const n = normalize(V.mul(t).sub(U.uBodyDir.mul(D))).toVar()
      const nb = vec3(dot(n, U.uBodyX), dot(n, U.uBodyY), dot(n, U.uBodyDir).negate()).toVar()
      const st = rot(nb.xy.div(nb.z.add(1.15)) as V2, U.uBodySpin).mul(3.1).toVar()
      const lim = sat(nb.z as F).toVar()
      const big = fbm(st.mul(1.35).add(vec2(4.2, 9.1))).toVar()
      // craters (Theia) or rafts (the new Moon), from the same cells
      const c1 = vorC(st.mul(2.6)).toVar()
      const c2 = vorC(st.mul(6.3).add(3.7)).toVar()
      const r1 = c1.w.mul(0.3).add(0.16).toVar()
      const x1 = c1.z.div(r1).toVar()
      const r2 = c2.w.mul(0.28).add(0.12).toVar()
      const x2 = c2.z.div(r2).toVar()
      // a bowl with a raised rim: slope along the line to the centre
      const bowl = (x: THREE.Node<"float">) => smoothstep(0.0, 0.85, x).mul(ssr(1.25, 0.95, x)).mul(1.6).sub(smoothstep(0.95, 1.1, x).mul(ssr(1.6, 1.1, x)).mul(0.9))
      const g2 = normalize(c1.xy.add(1e-5)).mul(bowl(x1)).add(normalize(c2.xy.add(1e-5)).mul(bowl(x2)).mul(0.7)).mul(U.uBodyKind.oneMinus())
      const rough = vec2(vnoise(st.mul(19)), vnoise(st.mul(19).add(31.7))).sub(0.5).mul(0.5)
      const gg = g2.negate().add(rough).toVar()
      const nn = normalize(n.add(U.uBodyX.mul(gg.x).add(U.uBodyY.mul(gg.y)).mul(0.55))).toVar()
      // Theia: grey-brown highlands, darker plains, bright young craters
      const fresh = smoothstep(0.82, 1, c2.w).mul(ssr(1.5, 0.2, x2))
      const albT = mixN(vec3(0.2, 0.17, 0.145), vec3(0.085, 0.075, 0.07), smoothstep(0.42, 0.6, big)).mul(vnoise(st.mul(40)).mul(0.25).add(0.88)).add(fresh.mul(0.12))
      // the Moon: a pale crust skinning over a magma ocean
      const pq = st.mul(2.2).toVar()
      const pl = vor(pq, U.uT.mul(0.04)).toVar()
      const pe = length(pl.zw).sub(length(pl.xy)).toVar()
      const skin = sat(U.uBodyCrust.mul(2.1).sub(hash22(floor(pq.add(pl.xy))).x.mul(0.35)).sub(big.mul(1.3)).add(0.25) as F).toVar()
      const openM = max(sat(skin.mul(1.5).oneMinus() as F), ssr(0.035, 0.014, pe)).toVar()
      const albM = vec3(0.3, 0.29, 0.28).mul(big.mul(0.5).add(0.72)).mul(skin)
      const alb = mixN(albT, albM, U.uBodyKind)
      // the Sun on it: a hard terminator, softened only by the relief
      const sun = smoothstep(-0.02, 0.1, dot(nn, SUNN)).mul(max(dot(nn, SUNN), 0)).mul(2.6)
      // planetshine: the molten Earth lights the side that faces it
      const toEarth = normalize(U.uBodyDir.negate().add(vec3(0, -0.8, 0)))
      const shine = max(dot(nn, toEarth), 0).mul(U.uShine)
      col.assign(alb.mul(vec3(1.0, 0.97, 0.92).mul(sun).add(vec3(1, 0.3, 0.09).mul(shine))))
      // Theia cracking under the tide as it closes: glowing fractures on the side that faces us
      const fq = st.mul(1.3).add(8.8).add(vec2(big, fbm(st.mul(2.1))).mul(1.4)).toVar()
      const frac = vor(fq, float(0)).toVar()
      const fe = length(frac.zw).sub(length(frac.xy))
      const tidal = U.uBodyHeat.mul(U.uBodyKind.oneMinus()).mul(smoothstep(0.2, 0.9, lim))
      col.addAssign(heat(float(0.8)).mul(exp(fe.div(0.02).negate())).mul(tidal).mul(0.22).mul(sat(tidal.mul(1.5).sub(hash22(floor(fq.add(frac.xy))).x) as F)))
      // the Moon's own heat
      const mh = U.uBodyHeat.mul(U.uBodyKind)
      col.addAssign(heat(mixN(mh.mul(0.45), mh.mul(vnoise(st.mul(5).add(U.uT.mul(0.1))).mul(0.3).add(0.85)), openM) as F).mul(U.uBodyKind).mul(lim.mul(0.4).add(0.6)))
    })
    return vec4(col, cov)
  })
  const skyMesh = add(
    new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)),
      mat(
        vec4(positionGeometry.xy, 1, 1),
        Fn(() => {
          const V = normalize(U.uCF.add(U.uCR.mul(vNdc.x)).add(U.uCU.mul(vNdc.y))).toVar()
          const col = vec3(0).toVar()
          // (below the horizon the plain is drawn over every pixel of this)
          If(V.y.greaterThan(-0.03), () => {
            If(U.uBodyOn.greaterThan(0), () => {
              const bd = body(V).toVar()
              // it stands behind our air: its foot sinks into the haze
              const veil = exp(max(V.y, 0).mul(-14)).mul(0.7)
              col.assign(bd.xyz.mul(bd.w).mul(U.uBodyOn).mul(veil.oneMinus()))
            })
            col.addAssign(airGlow(V))
            col.assign(mixN(col, heat(float(1.45)), U.uInside))
          })
          return vec4(col, 1)
        })(),
        { depthTest: false, depthWrite: false },
      ),
    ),
    -10,
  )

  // ---------------------------------------------------------------- the ring: fragments on Kepler orbits
  // Inside the Roche limit a fragment keeps its own orbit and drains inward. Outside it, it belongs
  // to a moonlet: it is drawn in along a trailing streamer, and the moonlets fall into one body.
  const ringGeo = quad(N_RING + NML)
  {
    const aO = new Float32Array((N_RING + NML) * 4) // a, angle (or angle off its moonlet), z, seed
    const aG = new Float32Array((N_RING + NML) * 4) // moonlet (-1: none), shear, delay (-1: the moonlet itself), size
    for (let i = 0; i < N_RING; i++) {
      const inner = R() < 0.55
      if (inner) {
        // ringlets: the sheet is denser in bands
        let a = 0
        do a = 1.22 + (ROCHE - 1.22) * Math.sqrt(R())
        while (R() > 0.3 + 0.7 * Math.pow(Math.sin(a * 21 + Math.sin(a * 5) * 2), 2))
        aO.set([a, R() * Math.PI * 2, (R() + R() + R() - 1.5) * 0.11, R()], i * 4)
        aG.set([-1, 0, 0, R()], i * 4)
      } else {
        const k = Math.floor(R() * NML)
        const ak = ML_A(k)
        const a = clamp(ak + (R() + R() - 1) * 0.62, ROCHE + 0.02, 5.4)
        aO.set([a, (R() * 2 - 1) * Math.PI, (R() + R() + R() - 1.5) * 0.16, R()], i * 4)
        aG.set([k, KEP(a) - KEP(ak), R() * 0.5, R()], i * 4)
      }
    }
    for (let k = 0; k < NML; k++) {
      aO.set([0, 0, 0, 0.5], (N_RING + k) * 4)
      aG.set([k, 0, -1, 1], (N_RING + k) * 4)
    }
    ringGeo.setAttribute("aO", new THREE.InstancedBufferAttribute(aO, 4))
    ringGeo.setAttribute("aG", new THREE.InstancedBufferAttribute(aG, 4))
  }
  const RG = (() => {
    const aO = attribute("aO", "vec4"), aG = attribute("aG", "vec4")
    const isOut = step(-0.5, aG.x)
    const isMl = step(aG.z, -0.5)
    const ml = (U.uMl.element(max(aG.x, 0).add(0.5).toInt()) as unknown as V4).toVar()
    const g = smoothstep(aG.z, aG.z.add(0.5), ml.z).mul(isOut).mul(isMl.oneMinus()).toVar()
    // inside: its own orbit, sinking
    const aI = aO.x.mul(U.uDrain.mul(aO.w.mul(0.5).add(0.12)).oneMinus())
    const thI = aO.y.add(pow(aI, -1.5).sub(OMEGA).mul(U.uTau))
    // outside: toward its moonlet, the offset winding up with the shear
    const lag = pow(g.oneMinus(), 1.7)
    const aX = mixN(aO.x, ml.x, g)
    const thX = ml.y.add(aO.y.add(aG.y.mul(U.uTau)).mul(lag))
    const a = mixN(mixN(aI, aX, isOut), ml.x, isMl).toVar()
    const th = mixN(mixN(thI, thX, isOut), ml.y, isMl).toVar()
    const z = aO.z.mul(U.uPuff).mul(g.oneMinus()).mul(isMl.oneMinus())
    const c = a.mul(cos(th)), s = a.mul(sin(th))
    const Pc = vec3(s.negate().add(z.mul(AX[0])), c.mul(E1[1]).add(z.mul(AX[1])), c.mul(E1[2]).add(z.mul(AX[2]))).toVar()
    const local = Pc.sub(vec3(0, 1, 0)).toVar()
    const dist = length(local)
    const vc = cameraViewMatrix.mul(vec4(cameraPosition.add(local.mul(SKY_S)), 1)).toVar()
    // in the Earth's shadow there is no sunlight to shine by
    const along = dot(Pc, SUNN)
    const lit = max(step(0, along), step(1, length(Pc.sub(SUNN.mul(along)))))
    // its own heat falls as the ring ages; the streamers are warmer where they close up
    const T = U.uRingT.mul(aO.w.mul(0.7).add(0.65)).add(g.mul(0.35)).add(isMl.mul(0.5))
    const hot = heat(T as F)
    const grey = vec3(0.62, 0.6, 0.57).mul(lit).mul(0.5)
    const fade = mixN(sat(aI.sub(1.04).mul(9) as F), ssr(1, 0.86, g), isOut).mul(step(-0.02, local.y))
    const bright = mixN(pow(aG.w, 3).mul(1.5).add(0.14), float(1), isMl).mul(mixN(fade, ml.w.greaterThan(0).select(float(1), 0), isMl)).mul(U.uRingOn)
    const size = mixN(pow(aG.w, 6).mul(0.004).add(0.0009), ml.w, isMl).mul(dist).mul(SKY_S)
    const px = max(size, U.uPx.mul(1.05).mul(vc.z.negate()))
    // a fragment smaller than a pixel is drawn a pixel wide and dimmer by the area it lost
    const gain = sq(size.div(px) as F)
    return {
      clip: cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(px).mul(step(1e-4, bright))), vc.z, 1)),
      vQ: positionGeometry.xy.toVarying("rgQ"),
      vC: hot.add(grey).mul(bright).mul(gain).toVarying("rgC"),
    }
  })()
  const ringMesh = add(new THREE.Mesh(ringGeo, mat(RG.clip, vec4(RG.vC.mul(max(exp(dot(RG.vQ, RG.vQ).mul(-3.2)).sub(0.04), 0)), 1), { ...ADD, depthTest: false })), -8)

  // ---------------------------------------------------------------- the plain
  // A polar grid that rides under the lens and scales with eye height, so its triangles keep their
  // size on screen: (direction x, radius, direction z) per vertex. Rings stay 8 % apart all the way
  // out (the crest of the shock needs them); far rings, which are slivers a pixel tall, get fewer
  // spokes. A grid fixed in the world put its hair-fine centre in front of the lens after the throw.
  const GRID_CAP = 60000
  const plainGeo = (() => {
    const rings: { r: number; n: number; at: number }[] = []
    const pos: number[] = [0, 0, 0]
    for (let r = 0.5, k = 0; r < 46000; r *= 1.08, k++) {
      const n = r < 48 ? 168 : r < 520 ? 84 : 42
      rings.push({ r, n, at: pos.length / 3 })
      for (let i = 0; i < n; i++) {
        const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2
        pos.push(Math.cos(a), r, Math.sin(a))
      }
    }
    const idx: number[] = []
    for (let i = 0; i < rings[0].n; i++) idx.push(0, rings[0].at + i, rings[0].at + ((i + 1) % rings[0].n))
    for (let k = 0; k < rings.length - 1; k++) {
      // stitch two rings of any two counts: step along whichever has the nearer next spoke
      const A = rings[k], B = rings[k + 1]
      const oa = (k % 2) * 0.5, ob = ((k + 1) % 2) * 0.5
      let i = 0, j = 0
      while (i < A.n || j < B.n) {
        const a = A.at + (i % A.n), b = B.at + (j % B.n)
        if (i < A.n && (j >= B.n || (i + 1 + oa) / A.n <= (j + 1 + ob) / B.n)) idx.push(a, b, A.at + (++i % A.n))
        else idx.push(a, b, B.at + (++j % B.n))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  const gXZ = positionGeometry.xz.mul(min(positionGeometry.y.mul(U.uGrid.z), GRID_CAP)).add(U.uGrid.xy).toVar()
  const vW = vec3(gXZ.x, dispY(gXZ as V2), gXZ.y).toVarying("plW")
  /** Light the plain gets from things on it: fountains, meteor strikes. */
  const localLight = Fn(([p]: [V2]) => {
    const l = vec3(0).toVar()
    Loop(N_FOUNT, ({ i }) => {
      const f = (U.uFount.element(i) as unknown as V4).toVar()
      const d = p.sub(f.xy)
      l.addAssign(heat(float(1.25)).mul(f.w).mul(float(1).div(dot(d, d).div(f.z.mul(f.z).mul(9)).add(1))))
    })
    Loop(4, ({ i }) => {
      const f = (U.uFlash.element(i) as unknown as V4).toVar()
      If(f.z.greaterThan(0), () => {
        const d = p.sub(f.xy)
        l.addAssign(vec3(1, 0.82, 0.6).mul(f.z).mul(float(1).div(dot(d, d).div(260).add(1))))
      })
    })
    return l
  })
  const plainFrag = Fn(() => {
    const P = vW
    const toC = cameraPosition.sub(P).toVar()
    const dist = length(toC).toVar()
    const Vv = toC.div(dist).toVar()
    const Ng0 = cross(dFdx(P), dFdy(P)).toVar()
    const Ng = normalize(Ng0.mul(sign(Ng0.y))).toVar()
    const xz = P.xz.toVar()
    const ax = dFdx(xz).toVar(), ay = dFdy(xz).toVar()
    const la = length(ax), lb = length(ay)
    const foot = mixN(min(la, lb), max(la, lb), 0.5).toVar() // metres a pixel covers
    const footM = max(la, lb).toVar() // and along its longer side (what fine relief has to fit in)
    const fc = foot.div(CELL).toVar()
    const lod = smoothstep(0.2, 0.75, fc).toVar() // a raft is a pixel: draw its mean
    const far = smoothstep(0.75, 1.5, fc).toVar() // rafts are smaller than a pixel: do not even look them up
    const lodB = smoothstep(0.012, 0.05, foot.div(BIG)).toVar()
    // where the shock has been, there is no crust
    const passed = sat(U.uFront.sub(P.z).div(16) as F).mul(U.uFrontOn)
    const crestL = max(float(10), abs(U.uFront).mul(0.11))
    const crest = exp(sq(P.z.sub(U.uFront).sub(crestL.mul(1.3)).div(crestL) as F).negate()).mul(U.uFrontOn).mul(step(0.01, U.uWave)).toVar()
    const molten = max(passed, U.uMolten).toVar()
    const cool = U.uCool
    const macro = fbm2(xz.mul(0.0136).add(vec2(3.1, 7.7)) as V2).toVar()
    const thin = smoothstep(0.5, 0.68, macro).toVar()
    // meteor strikes open the crust around them for a while
    const strike = float(0).toVar()
    Loop(4, ({ i }) => {
      const f = (U.uFlash.element(i) as unknown as V4).toVar()
      If(f.w.greaterThan(0), () => {
        const d = length(xz.sub(f.xy))
        strike.addAssign(f.w.mul(exp(sq(d.div(f.w.mul(14).add(1)) as F).negate())))
      })
    })
    const landR = length(xz.sub(vec2(0, 8)))
    const landFlare = U.uLand.y.mul(exp(sq(landR.sub(U.uLand.x.mul(26)).div(5) as F).negate())).toVar()
    const wb = thin.mul(0.008).add(0.0012).add(molten.mul(1.2)).mul(cool.mul(0.55).oneMinus()).toVar()
    const riverFar = sat(wb.div(0.42) as F)
    const flowN = vnoise(xz.mul(0.33).add(U.uFlow.mul(9))).toVar()
    const Triver = flowN.mul(0.3).add(0.7).add(molten.mul(0.35)).sub(cool.mul(0.42)).mul(U.uHot)
    const sea = float(0.5).toVar()
    If(molten.greaterThan(0), () => {
      sea.assign(fbm2(xz.mul(0.072).add(U.uFlow.mul(22)) as V2))
    })
    const seaW = molten.mul(max(sea.mul(2.6).sub(0.9), 0.06))
    const here = localLight(xz).toVar()
    const L = U.uKeyDir
    // what the near field hands on: the lit raft, how open the crust is, how fresh the melt, the rift
    const det1 = vec3(0).toVar()
    // (too far to tell one raft from the next: the mean of a raft's life stands in for it)
    const w = thin.mul(0.014).add(0.0595).add(strike.mul(0.5)).add(landFlare.mul(0.25)).add(crest.mul(0.45)).mul(cool.mul(0.6).oneMinus()).add(seaW).toVar()
    const fresh = float(0.5).toVar()
    const river = float(0).toVar()
    If(far.lessThan(1), () => {
      // ---- the rifts between fields of rafts: wide, open, flowing
      const eb = float(1).toVar()
      If(lodB.lessThan(1), () => {
        const vb = vor(xz.div(BIG).add(vec2(11.3, 4.7)), U.uT.mul(0.02)).toVar()
        eb.assign(length(vb.zw).sub(length(vb.xy)))
        river.assign(ssr(wb, wb.mul(0.5), eb))
      })
      const bank = mixN(exp(eb.div(0.07).negate()), float(0.1), smoothstep(0.035, 0.05, foot.div(BIG)))

      // ---- the rafts
      // plates of very different sizes (the grid is stretched and squeezed by a slow field), and
      // rifts that zigzag: a triangle wave across each boundary, as on every lava lake
      const q0 = xz.div(CELL).add(U.uFlow).add(vec2(vnoise(xz.mul(0.035)), vnoise(xz.mul(0.035).add(17.3))).mul(3.4)).toVar()
      const zig = abs(fract(q0.yx.mul(1.9).add(vnoise(q0.mul(0.7)).mul(2))).sub(0.5)).sub(0.25)
      const q = q0.add(zig.mul(0.11)).toVar()
      const v = vor(q, U.uT.mul(0.11)).toVar()
      const l1 = length(v.xy).toVar(), l2 = length(v.zw).toVar()
      const e = l2.sub(l1).toVar()
      const hh = hash22(floor(q.add(v.xy))).toVar()
      const h1 = hh.x, h2 = hh.y
      // a raft's life: a skin forms, thickens, and at the end it founders from its edges
      const age = fract(U.uT.div(mixN(float(24), 58, h1)).add(h2)).toVar()
      const skin = smoothstep(0, 0.2, age).toVar()
      const founder = smoothstep(0.88, 1, age)
      const wN = thin.mul(0.014).add(0.008).add(bank.mul(0.02)).add(founder.mul(0.45)).add(skin.oneMinus().mul(0.22)).add(strike.mul(0.5)).add(landFlare.mul(0.25)).add(crest.mul(vnoise(q.mul(3)).mul(0.9))).mul(cool.mul(0.6).oneMinus()).add(seaW).toVar()
      const open = ssr(wN, wN.mul(0.55), e).toVar()
      const freshN = vnoise(q.mul(1.3).add(U.uT.mul(0.06))).toVar()
      const Tm = mixN(freshN.mul(0.45).add(0.95), sea.mul(1.25).add(0.1).add(freshN.mul(0.18)), molten).add(strike.mul(0.5)).add(landFlare.mul(0.3)).sub(cool.mul(0.3)).mul(mixN(float(0.5), 1, max(sq(sat(e.div(wN).oneMinus() as F)), molten))).mul(mixN(U.uHot, float(1), molten))
      const off = max(e.sub(wN), 0).toVar()
      // youngest and hottest right beside the crack; then a paler, raised, cooled rim; then old dark crust
      const Tc = exp(off.div(0.022).negate()).mul(0.62).add(exp(off.div(0.09).negate()).mul(0.2)).add(skin.oneMinus().mul(0.5)).mul(molten.mul(0.45).oneMinus()).add(molten.mul(0.2)).mul(cool.mul(0.5).oneMinus()).mul(U.uHot)
      const rim = smoothstep(0, 0.05, off).mul(ssr(0.22, 0.07, off)).toVar()
      const oldness = smoothstep(0.02, 0.5, off).mul(skin).toVar()
      // relief: a plate stands a little proud of the melt, with a lip at its rim. The slope of the
      // edge distance is known exactly (it points from the second nearest point to the nearest).
      const ge = v.xy.div(max(l1, 1e-4)).sub(v.zw.div(max(l2, 1e-4))).toVar()
      const slope = smoothstep(0, 0.05, off).mul(ssr(0.11, 0.05, off)).mul(1.6).sub(smoothstep(0.1, 0.16, off).mul(ssr(0.26, 0.16, off)).mul(0.55))
      // The skin itself, in metres from the plate's own point and turned the way the plate is being
      // pushed: low hummocks everywhere; and where the skin has bunched, festoons of rope bowed
      // downstream (round backs, sharp creases between), each rope wrinkled again along its length.
      // Every scale comes in only when a pixel is small enough to hold it.
      const humK = ssr(0.9, 0.3, footM).toVar()
      const festK = ssr(0.2, 0.065, footM).toVar()
      const ropeK = ssr(0.055, 0.018, footM).toVar()
      const gp = vec2(0).toVar() // its slope, in the plate's own frame
      const crease = float(1).toVar()
      If(humK.greaterThan(0), () => {
        const pm = rot(v.xy.negate() as V2, h1.mul(6.283)).mul(CELL).toVar()
        const hp = pm.mul(1.3).add(h2.mul(13)).toVar()
        const h0 = vnoise(hp).toVar()
        gp.assign(vec2(vnoise(hp.add(vec2(0.2, 0))).sub(h0), vnoise(hp.add(vec2(0, 0.2))).sub(h0)).mul(0.585).mul(humK))
        If(festK.greaterThan(0), () => {
          const wob = vec2(vnoise(pm.mul(0.9).add(h2.mul(31))), vnoise(pm.mul(2.6).add(h1.mul(47)))).toVar()
          const bunched = smoothstep(0.3, 0.6, vnoise(pm.mul(0.5).add(h1.mul(19)))).mul(skin).toVar()
          const s1 = pm.y.add(pm.x.mul(pm.x).mul(0.2)).add(wob.x.mul(0.9)).toVar()
          const t1 = s1.mul(Math.PI / 0.6).toVar(), t2 = s1.add(wob.y.mul(0.1)).mul(Math.PI / 0.16).toVar()
          const n1 = sin(t1).toVar(), n2 = sin(t2).toVar()
          const f1 = abs(n1).oneMinus().toVar(), f2 = abs(n2).oneMinus().toVar()
          // height 1 - f^2 (a round back, a sharp crease where f = 1): its slope along the flow
          const d1 = f1.mul(sign(n1)).mul(cos(t1)).mul(2 * (Math.PI / 0.6) * 0.055)
          const d2 = f2.mul(sign(n2)).mul(cos(t2)).mul(2 * (Math.PI / 0.16) * 0.012)
          gp.addAssign(normalize(vec2(pm.x.mul(0.4), 1)).mul(bunched).mul(d1.mul(festK).add(d2.mul(ropeK))))
          crease.assign(mixN(float(1), mixN(float(0.5), 1.08, f1.mul(f1).oneMinus()).mul(mixN(float(1), f2.mul(f2).oneMinus().mul(0.35).add(0.72), ropeK)), bunched.mul(festK)))
        })
      })
      const gh = rot(gp as V2, h1.mul(-6.283))
      // each plate also lies a little off level and domes toward its middle, so no two catch the glow alike
      const lean = vec2(h2.sub(0.5), fract(h1.mul(7.31)).sub(0.5)).mul(0.09).add(ge.mul(ssr(0.45, 0, off)).mul(0.07))
      const g2 = ge.mul(slope).mul(0.5).add(lean).mul(lod.oneMinus()).add(gh).mul(open.oneMinus())
      const N = normalize(Ng.sub(vec3(g2.x, 0, g2.y))).toVar()
      const alb = mixN(float(0.05), 0.1, rim).mul(crease).mul(mixN(float(1), 0.42, oldness)).mul(skin.mul(0.6).add(0.4)).toVar()
      // the one sky light, and the air
      const ndl = max(dot(N, L), 0)
      const Rv = reflect(Vv.negate(), N).toVar()
      const fres = pow(max(dot(N, Vv), 0).oneMinus(), 5).toVar()
      const lightD = U.uKeyCol.mul(ndl).add(U.uAmb.mul(N.y.mul(0.6).add(0.4))).add(here.mul(0.6))
      const spec = U.uKeyCol.mul(pow(max(dot(Rv, L), 0), 60)).mul(0.5).add(U.uKeyCol.mul(pow(max(dot(Rv, L), 0), 9)).mul(0.03))
      const mirror = U.uHaze.add(U.uAmb).mul(fres.mul(1.5).add(0.05)).mul(mixN(float(1.3), 0.7, oldness)).add(here.mul(fres).mul(0.5))
      const crust = vec3(alb).mul(lightD).mul(vec3(1, 0.97, 0.93)).add(spec.mul(molten.mul(0.9).oneMinus()).add(mirror).mul(skin)).add(heat(Tc as F))
      // the rift lights the skin beside it, low and from the side: this is what the ropes catch
      const toRift = normalize(vec3(ge.x.negate(), 0.42, ge.y.negate()))
      const riftL = heat(float(1.05)).mul(U.uHot).mul(cool.mul(0.5).oneMinus()).mul(exp(off.div(0.24).negate())).mul(lod.oneMinus())
      const lit = crust.add(riftL.mul(vec3(alb).mul(max(dot(N, toRift), 0)).mul(2.4).add(pow(max(dot(Rv, toRift), 0), 12).mul(0.22).mul(skin))))
      det1.assign(mixN(lit, heat(Tm as F), open))
      w.assign(mixN(wN, w, far))
      fresh.assign(mixN(freshN, float(0.5), far))
    })
    // too far to see a raft: its mean
    const openFar = sat(w.div(0.34) as F)
    const fresG = pow(max(dot(Ng, Vv), 0).oneMinus(), 5)
    const mean = mixN(vec3(0.03).mul(U.uKeyCol.mul(max(dot(Ng, L), 0)).add(U.uAmb).add(here.mul(0.6))).add(U.uHaze.mul(fresG).mul(1.2)).add(U.uKeyCol.mul(pow(max(dot(reflect(Vv.negate(), Ng), L), 0), 60)).mul(0.06)).add(heat(float(0.3)).mul(U.uHot).mul(0.5)), heat(mixN(fresh.mul(0.2).add(0.62).sub(cool.mul(0.3)).mul(U.uHot), macro.mul(1.0).add(0.2), molten) as F), mixN(openFar.mul(0.55), float(0.72), molten))
    const col = mixN(det1, mean, lod).toVar()
    col.assign(mixN(col, heat(Triver as F), mixN(river, riverFar.mul(0.6), lodB).mul(molten.oneMinus())))
    // the crest itself: crust broken open and thrown up, white
    col.addAssign(heat(float(1.3)).mul(crest).mul(0.35))
    // Ahead of the surge: under its overhanging nose the ground is in its shadow, and beyond that
    // it is lit by the glowing foot (the leading edge is the head's own scalloped one)
    If(U.uFrontOn.greaterThan(0), () => {
      const edge = U.uFront.add(billow(vec2(P.x.div(U.uWallH.mul(1.9)), U.uT.mul(0.12)) as V2).mul(U.uWallH).mul(0.55))
      const ahead = P.z.sub(edge).div(U.uWallH).toVar()
      If(ahead.greaterThan(-0.5), () => {
        const a = max(ahead, 0)
        col.mulAssign(exp(a.div(0.28).negate()).mul(0.72).oneMinus())
        col.addAssign(heat(float(1.15)).mul(exp(a.div(1.6).negate())).mul(smoothstep(0.1, 0.6, a)).mul(0.16))
      })
    })
    // In a cone's shadow the light from the sky is gone. The crust there keeps only a cold remnant
    // of it (so the shadow is blue-grey, never black); the open melt, which shines by itself,
    // keeps most of its own.
    If(U.uShadow.greaterThan(0), () => {
      const shade = U.tShade.sample(screenUV).level(L0).r
      const lum = dot(col, vec3(0.3, 0.5, 0.2)).toVar()
      const kept = mixN(float(0.08), 0.42, smoothstep(2, 8, lum))
      col.assign(mixN(col, mixN(col, vec3(0.62, 0.8, 1.3).mul(lum), 0.6).mul(kept), shade))
    })
    // the air between
    const fog = exp(dist.mul(U.uHazeK).negate()).oneMinus()
    col.assign(mixN(col, U.uHaze, fog))
    col.assign(mixN(col, heat(float(1.45)), U.uInside))
    return vec4(col, 1)
  })()
  const plain = add(new THREE.Mesh(plainGeo, mat(viewProj.mul(vec4(vW, 1)), plainFrag, { side: THREE.DoubleSide })), 0)

  // ---------------------------------------------------------------- slabs of broken crust, and their shadows
  // One lumpy mound, built once: stood tall it is a spatter cone or a hornito with a vent, laid low
  // it is a rounded raft of thick crust riding half under the melt.
  const slabGeo = (() => {
    const SEG = 18, RING = 9
    const rr = rng(311)
    const lump = Array.from({ length: SEG }, () => rr())
    const pos: number[] = [0, 0.86, 0]
    for (let k = 0; k <= RING; k++) {
      const t = k / RING
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2
        const l = 0.82 + 0.3 * (lump[i] * 0.6 + lump[(i * 7 + k * 3) % SEG] * 0.4) + 0.08 * Math.sin(a * 5 + k * 1.7)
        // a crater lip at the top, a concave flank, a skirt under the surface
        const r = (0.13 + 0.87 * Math.pow(t, 0.72)) * l
        const y = k === RING ? -0.3 : Math.pow(1 - t, 1.35) + 0.035 * Math.sin(a * 3 + k * 2.3) * (1 - t)
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r * 0.86)
      }
    }
    const idx: number[] = []
    for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i)
    for (let k = 0; k < RING; k++)
      for (let i = 0; i < SEG; i++) {
        const a = 1 + k * SEG + i, b = 1 + k * SEG + ((i + 1) % SEG), c = a + SEG, d = b + SEG
        idx.push(a, b, c, b, d, c)
      }
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const aP = new Float32Array(N_SLAB * 4), aR = new Float32Array(N_SLAB * 4)
    // [x, z, size, turn, height]: beside the lens' path two rafts and a hornito; cones and ramparts further out
    const hero: number[][] = [[-5.4, -2.5, 2.3, 0.5, 0.2], [7.2, -10, 3.0, 2.4, 0.17], [-13, -24, 2.4, 1.2, 0.8], [3.8, 15, 2.0, 4.0, 0.2], [17, -44, 4.2, 0.3, 0.5], [-34, -70, 6.5, 2.0, 0.42]]
    for (let i = 0; i < N_SLAB; i++) {
      const h = hero[i]
      const z = h ? h[1] : -60 - Math.pow(R(), 1.5) * 900
      let x = h ? h[0] : (R() * 2 - 1) * (30 + Math.abs(z) * 0.6)
      if (!h && Math.abs(x) < 6) x += 12
      const cone = h ? h[4] > 0.5 : R() < 0.3
      const sc = h ? h[2] : (cone ? 3 + R() * 5 : 2 + R() * 4) + Math.abs(z) * (cone ? 0.03 : 0.012)
      aP.set([x, 0, z, sc], i * 4)
      aR.set([h ? h[3] : R() * 6.28, cone ? R() * 0.06 : R() * 0.1, h ? h[4] : cone ? 0.32 + R() * 0.4 : 0.1 + R() * 0.1, R()], i * 4)
    }
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    g.setAttribute("aR", new THREE.InstancedBufferAttribute(aR, 4))
    g.instanceCount = N_SLAB
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  const SL = (() => {
    const aP = attribute("aP", "vec4"), aR = attribute("aR", "vec4")
    const passed = sat(U.uFront.sub(aP.z).div(30) as F).mul(U.uFrontOn).toVar()
    const tilt = aR.y.add(passed.mul(aR.w.sub(0.3)).mul(1.6))
    const spin = (p: V3, nrm = false): V3 => {
      // (a normal is scaled by the inverse, so a flattened mound's normals stand up)
      const a = nrm ? vec3(p.x.mul(aR.z), p.y, p.z.mul(aR.z)) : vec3(p.x, p.y.mul(aR.z), p.z)
      const t = vec3(a.x, rot(a.yz as V2, tilt.negate())).toVar()
      const y = rot(t.xz as V2, aR.x.negate()).toVar()
      return vec3(y.x, t.y, y.y) as V3
    }
    const lift = dispY(aP.xz as V2).mul(1.4).sub(passed.mul(aP.w).mul(0.2))
    const W = spin(positionGeometry as V3).mul(aP.w).add(vec3(aP.x, lift, aP.z)).toVar()
    const N = spin(normalGeometry as V3, true)
    return { W, N, vW: W.toVarying("slW"), vN: N.toVarying("slN"), vS: vec4(aR.w, passed, positionGeometry.y, aR.z).toVarying("slS"), vL: positionGeometry.xz.toVarying("slL") }
  })()
  const slabFrag = Fn(() => {
    const P = SL.vW
    const hgt = SL.vS.z, tall = smoothstep(0.25, 0.4, SL.vS.w)
    const toC = cameraPosition.sub(P)
    const dist = length(toC)
    const Vv = toC.div(dist)
    // spatter is laid down in clots that weld: lumpy, layered, glassy where it is fresh
    const ang = atan(SL.vL.y, SL.vL.x)
    const lp = vec2(ang.mul(3.2), hgt.mul(9).add(SL.vS.x.mul(20))).toVar()
    const c1 = vnoise(lp.mul(1.7)).toVar(), c2 = vnoise(lp.mul(5.3).add(7.7)).toVar()
    const bump = vec3(vnoise(lp.mul(1.7).add(vec2(0.35, 0))).sub(c1), 0, vnoise(lp.mul(5.3).add(vec2(7.7, 8.05))).sub(c2)).mul(2.2)
    const N = normalize(normalize(SL.vN).add(bump)).toVar()
    const alb = mixN(float(0.025), 0.085, c1.mul(0.6).add(c2.mul(0.4))).mul(mixN(float(1), 0.6, smoothstep(0.3, 0.9, hgt)))
    const ndl = max(dot(N, U.uKeyDir), 0)
    const Rv = reflect(Vv.negate(), N)
    const here = localLight(P.xz as V2)
    const fres = pow(max(dot(N, Vv), 0).oneMinus(), 4)
    const col = vec3(alb).mul(U.uKeyCol.mul(ndl).add(U.uAmb.mul(N.y.mul(0.5).add(0.5))).add(here.mul(max(N.y.negate().add(0.6), 0)))).toVar()
    col.addAssign(U.uKeyCol.mul(pow(max(dot(Rv, U.uKeyDir), 0), 30)).mul(0.3).mul(c2))
    // rim light from the glow of the air behind it
    col.addAssign(U.uHaze.mul(fres).mul(0.55))
    // lit from underneath by what it stands in, and red-hot where it touches
    const low = exp(max(P.y, 0).mul(-0.9))
    col.addAssign(heat(float(0.95)).mul(alb).mul(max(N.y.negate().add(0.35), 0).mul(low).mul(2.2).add(low.mul(0.25))).mul(U.uHot))
    col.addAssign(heat(float(1.0).add(SL.vS.y.mul(0.15))).mul(exp(max(P.y, 0).div(mixN(float(0.07), 0.2, SL.vS.y)).negate())).mul(U.uHot).mul(U.uCool.mul(0.6).oneMinus()))
    // a cone's vent glows, and what has run down its flank is still dull red in the gullies
    const live = U.uHot.mul(U.uCool.oneMinus()).mul(tall)
    const pulse = sin(U.uT.mul(2.3).add(SL.vS.x.mul(40))).mul(0.2).add(0.85)
    col.addAssign(heat(pulse.mul(0.95) as F).mul(smoothstep(0.86, 0.95, hgt)).mul(live).mul(0.8))
    const gully = ssr(0.3, 0.12, abs(fract(ang.mul(0.95).add(SL.vS.x.mul(9))).sub(0.5)).add(c2.mul(0.16)))
    col.addAssign(heat(mixN(float(0.45), 1.0, sq(hgt as F)) as F).mul(gully).mul(smoothstep(0.5, 0.9, hgt)).mul(live).mul(0.25))
    const fog = exp(dist.mul(U.uHazeK).negate()).oneMinus()
    col.assign(mixN(col, U.uHaze, fog))
    col.assign(mixN(col, heat(float(1.45)), U.uInside))
    return vec4(col, 1)
  })()
  const slabs = add(new THREE.Mesh(slabGeo, mat(viewProj.mul(vec4(SL.vW, 1)), slabFrag)), 2)
  // What a mound hides from the key light, laid out on the plain: only its faces toward the light
  // (so the patch is one layer thick), strongest at the foot, soft where the mound's own outline
  // turns away from the light, and softer and fainter toward the tip as the shadow grows long.
  const shadeScene = new THREE.Scene()
  {
    const L = U.uKeyDir
    const aP = attribute("aP", "vec4")
    // how far this point's shadow reaches; a long one runs out softly at thirty radii
    const len = max(SL.W.y, 0).div(max(L.y, 0.02)).toVar()
    const cap = aP.w.mul(30)
    const k = cap.mul(exp(len.div(cap).negate()).oneMinus())
    const xz = SL.W.xz.sub(L.xz.div(max(length(L.xz), 0.2)).mul(k))
    const up = sat(positionGeometry.y as F)
    const a = smoothstep(0, mixN(float(0.12), 0.85, up), dot(normalize(SL.N), L)).mul(exp(len.div(cap).mul(-0.8)).mul(0.85).add(0.15)).mul(U.uShadow)
    const m = new THREE.Mesh(slabGeo, mat(viewProj.mul(vec4(xz.x, dispY(xz as V2).add(0.03), xz.y, 1)), vec4(vec3(a.toVarying("shA")), 1), { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneFactor }))
    m.frustumCulled = false
    shadeScene.add(m)
  }
  let shadeOn = false

  // ---------------------------------------------------------------- lava fountains: clots on ballistic arcs
  const FOUNT: [number, number, number][] = [[-150, -330, 20], [235, -480, 30], [-430, -700, 46], [-130, -1180, 70], [250, -900, 58], [560, -1500, 80], [-760, -1650, 90]]
  const dropGeo = quad(N_DROP)
  {
    const a = new Float32Array(N_DROP * 4)
    for (let i = 0; i < N_DROP; i++) a.set([i % N_FOUNT, R(), R(), R()], i * 4)
    dropGeo.setAttribute("aF", new THREE.InstancedBufferAttribute(a, 4))
  }
  const DR = (() => {
    const aF = attribute("aF", "vec4")
    const f = (U.uFount.element(aF.x.add(0.5).toInt()) as unknown as V4).toVar()
    const G = 32
    // most clots go up the middle of the column; a few are thrown wide and low
    const core = step(aF.w, 0.7)
    const vy = sqrt(f.z.mul(2 * G)).mul(mixN(aF.z.mul(0.6).add(0.25), aF.z.mul(0.3).add(0.72), core)).toVar()
    const life = vy.mul(2 / G).toVar()
    const age = fract(U.uT.div(life).add(aF.y)).mul(life).toVar()
    const ang = aF.w.mul(47.1)
    const sp = vy.mul(mixN(float(0.42), 0.09, core)).mul(fract(aF.w.mul(13.7)).mul(0.8).add(0.3))
    const at = (t: THREE.Node<"float">): V3 => vec3(f.x.add(cos(ang).mul(sp).mul(t)), max(vy.mul(t).sub(t.mul(t).mul(G / 2)), 0), f.y.add(sin(ang).mul(sp).mul(t))) as V3
    const on = step(0.02, f.w)
    const big = pow(fract(aF.w.mul(91.3)), 5)
    return {
      clip: ribbon(at(age), at(age.sub(0.05)), f.z.mul(big.mul(0.022).add(0.0045)).mul(on) as F, 1.1),
      vQ: positionGeometry.xy.toVarying("drQ"),
      // yellow-white as it leaves, orange at the top of its arc, dull red as it lands
      vC: heat(mixN(float(1.7), 0.5, pow(age.div(life), 0.8)) as F).mul(big.mul(1.2).add(0.4)).mul(f.w).mul(on).mul(U.uInside.oneMinus()).toVarying("drC"),
    }
  })()
  const drops = add(new THREE.Mesh(dropGeo, mat(DR.clip, vec4(DR.vC.mul(exp(dot(DR.vQ, DR.vQ).mul(-2.6))), 1), ADD)), 5)

  // fume: over each fountain and along the rifts, drifting across, lit from below
  const fumeGeo = quad(N_FUME)
  {
    const a = new Float32Array(N_FUME * 4), b = new Float32Array(N_FUME * 4)
    for (let i = 0; i < N_FUME; i++) {
      const onF = i < N_FOUNT * 5
      const f = FOUNT[i % N_FOUNT]
      const z = onF ? f[1] : -40 - Math.pow(R(), 1.4) * 1300
      a.set([onF ? f[0] : (R() * 2 - 1) * (40 + Math.abs(z) * 0.7), onF ? f[2] * 0.9 : 3 + Math.abs(z) * 0.012, z, R()], i * 4)
      b.set([R(), R(), onF ? 1 : 0, R()], i * 4)
    }
    fumeGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4))
    fumeGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4))
  }
  const FU = (() => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const life = fract(U.uT.mul(aB.y.mul(0.03).add(0.035)).add(aB.x)).toVar()
    const rise = aA.y.mul(life.mul(3.2).add(0.25))
    // it leans downwind as it rises
    const w = vec3(aA.x.add(rise.mul(0.9)).add(sin(life.mul(5).add(aA.w.mul(30))).mul(aA.y).mul(0.2)), rise, aA.z)
    const vc = cameraViewMatrix.mul(vec4(w, 1)).toVar()
    const size = aA.y.mul(life.mul(1.8).add(0.5))
    const a = smoothstep(0, 0.12, life).mul(sq(life.oneMinus() as F)).mul(mixN(float(0.3), 0.55, aB.z)).mul(U.uFume)
    const under = heat(float(0.95)).mul(exp(life.mul(-3.2))).mul(mixN(float(0.25), 1.1, aB.z)).mul(U.uHot)
    const fog = exp(vc.z.mul(U.uHazeK))
    return {
      clip: cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size).mul(step(1e-3, a))), vc.z, 1)),
      vQ: vec4(positionGeometry.xy, aA.w.mul(50), life).toVarying("fuQ"),
      vC: vec4(mixN(U.uHaze, vec3(0.05, 0.04, 0.036).mul(U.uAmb.mul(5).add(U.uKeyCol.mul(0.5))).add(under.mul(0.1)), fog), a).toVarying("fuC"),
      vU: under.mul(fog).toVarying("fuU"),
    }
  })()
  const fumeFrag = Fn(() => {
    const q = FU.vQ.xy.toVar()
    const n = vnoise(q.mul(1.6).add(vec2(FU.vQ.z, FU.vQ.w.mul(-2)))).mul(0.6).add(vnoise(q.mul(4.1).add(vec2(FU.vQ.z.mul(1.7), FU.vQ.w.mul(-4)))).mul(0.4)).toVar()
    const d = ssr(1, 0.25, length(q).add(n.sub(0.5).mul(0.7))).mul(FU.vC.w).toVar()
    // the underside of each billow catches the glow
    const lit = FU.vU.mul(sat(q.y.mul(-0.6).add(0.5) as F)).mul(n.mul(0.8).add(0.3)).mul(0.5)
    return vec4(FU.vC.xyz.add(lit).mul(d), d)
  })()
  const fume = add(new THREE.Mesh(fumeGeo, mat(FU.clip, fumeFrag, OVER)), 3)

  // ---------------------------------------------------------------- meteors (a JS table, written to a small buffer)
  type Met = { t: number; fly: number; from: THREE.Vector3; to: THREE.Vector3; big: number }
  const mets: Met[] = []
  {
    let t = 0.9
    while (t < B0 + T_HIT - 0.4) {
      const near = mets.length === 1
      const to = near ? new THREE.Vector3(16, 0, -34) : new THREE.Vector3((R() * 2 - 1) * 520, 0, -70 - Math.pow(R(), 1.5) * 1500)
      const fly = 0.9 + R() * 0.7
      const az = (R() - 0.3) * 1.6
      const from = new THREE.Vector3(to.x + Math.sin(az) * 900, 500 + R() * 400, to.z - Math.cos(az) * 900 - 300)
      mets.push({ t: near ? 2.2 : t, fly, from, to, big: near ? 1 : 0.35 + R() * 0.5 })
      // they come faster as the thing that is shedding them comes nearer
      t += (near ? 0.5 : 1.5) * (t > B0 ? 0.42 : 1) * (0.6 + R() * 0.8)
    }
  }
  const metGeo = quad(N_MET)
  const metH = new Float32Array(N_MET * 4), metT = new Float32Array(N_MET * 4)
  const aMH = new THREE.InstancedBufferAttribute(metH, 4), aMT = new THREE.InstancedBufferAttribute(metT, 4)
  aMH.setUsage(THREE.DynamicDrawUsage)
  aMT.setUsage(THREE.DynamicDrawUsage)
  metGeo.setAttribute("aH", aMH)
  metGeo.setAttribute("aT", aMT)
  const MT = (() => {
    const aH = attribute("aH", "vec4"), aT = attribute("aT", "vec4")
    return { clip: ribbon(aH.xyz as V3, aT.xyz as V3, aH.w as F, 1.6), vQ: positionGeometry.xy.toVarying("mtQ"), vI: aT.w.toVarying("mtI") }
  })()
  const metFrag = Fn(() => {
    // (interpolated, vQ.x can land a hair outside [-1, 1]: pow of a negative base is NaN, which the
    // additive blend then spreads over the whole head)
    const u = clampN(MT.vQ.x.mul(0.5).add(0.5), 0, 1).toVar()
    const across = exp(sq(MT.vQ.y as F).mul(-4))
    const tail = u.mul(u).mul(sqrt(u))
    const headGlow = exp(sq(u.oneMinus().div(0.035) as F).negate())
    return vec4(mixN(vec3(1, 0.34, 0.08), vec3(1, 0.9, 0.75), tail).mul(tail.mul(1.6).add(headGlow.mul(9))).mul(across).mul(MT.vI), 1)
  })()
  const meteors = add(new THREE.Mesh(metGeo, mat(MT.clip, metFrag, ADD)), 6)

  // ---------------------------------------------------------------- ejecta: ballistic arcs from beyond the horizon
  // Each bomb is drawn as a curved trail: a strip of EJ_SEG segments laid along its own parabola, so
  // the arc shows, with a compact white-hot head and a tail that cools to red and fades behind it.
  const EJ_SEG = 6
  const ejGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    const pos: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= EJ_SEG; i++) pos.push((i / EJ_SEG) * 2 - 1, -1, 0, (i / EJ_SEG) * 2 - 1, 1, 0)
    for (let i = 0; i < EJ_SEG; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1)
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.instanceCount = N_EJ
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  {
    const a = new Float32Array(N_EJ * 4), b = new Float32Array(N_EJ * 4)
    for (let i = 0; i < N_EJ; i++) {
      const late = R()
      // half of them come down far out on the plain: those show their whole arch over the horizon
      const far = i % 2 === 1
      const ax = (R() * 2 - 1) * (far ? 4200 : 1900) + 300
      const ay = far ? -2600 - R() * 4600 : -2200 + R() * 4200
      a.set([ax, ay, 1.6 + Math.pow(R(), 1.7) * 9, R()], i * 4)
      // (thrown from all along the rim of the blast, not from one point: the arcs fan across the sky)
      b.set([(R() * 2 - 1) * 7000, 0.5 + late * late * 9, 0.5 + Math.pow(R(), 4) * 9, R()], i * 4)
      // one in four is thrown fast and low: it is overhead while the surge is still coming
      if (i % 4 === 0) {
        a.set([(R2() * 2 - 1) * 1600, -350 + R2() * 1100, -(0.9 + R2() * 1.2)], i * 4)
        b.set([(R2() * 2 - 1) * 9000, 0.3 + R2() * 1.5, 0.8 + Math.pow(R2(), 3) * 6], i * 4)
      }
    }
    ejGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4))
    ejGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4))
  }
  const EJ = (() => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const G = 520
    const O = vec3(aB.x.add(Math.tan(AZ_HIT) * 9000), 0, -9000)
    const Lp = vec3(aA.x, 0, aA.y)
    // (a negative flight time marks one thrown fast: steeper, so it clears the surge)
    const fly = abs(aA.z).toVar()
    const steep = mixN(float(1), 20, step(aA.z, 0))
    const at = (u: THREE.Node<"float">): V3 => mixN(O, Lp, u).add(vec3(0, fly.mul(fly).mul(G / 2).mul(steep).mul(u).mul(u.oneMinus()), 0)) as V3
    const u = U.uTe.sub(aB.y).div(fly).toVar()
    const on = step(0, u).mul(step(u, 1)).mul(step(0, U.uTe))
    // the trail covers the last stretch of the flight: longer for the slow, high ones
    const span = min(float(2.4).div(fly), 0.45).mul(mixN(float(1), 0.3, step(aA.z, 0))).toVar()
    const s = positionGeometry.x.mul(0.5).add(0.5)
    const uu = u.sub(span.mul(s.oneMinus())).toVar()
    const vc = cameraViewMatrix.mul(vec4(at(uu), 1)).xyz.toVar()
    const tg = cameraViewMatrix.mul(vec4(at(uu.add(0.002)), 1)).xyz.sub(cameraViewMatrix.mul(vec4(at(uu.sub(0.002)), 1)).xyz).toVar()
    const sx = cross(tg.add(vec3(1e-4, 0, 0)), vc).toVar()
    const side = sx.div(max(length(sx), 1e-6))
    const tl = tg.div(max(length(tg), 1e-6))
    // the head is wider than the tail; never thinner than a pixel and a bit
    const w = aB.z.mul(on).mul(s.mul(0.7).add(0.3))
    const ww = max(w, U.uPx.mul(1.1).mul(vc.z.negate())).mul(on)
    // (a half-width past each end, so a bomb seen end-on is a round dot)
    const ext = tl.mul(ww).mul(step(0.999, s).sub(step(s, 0.001)))
    const T = mixN(float(1.9), 0.3, pow(sat(u as F), 0.5)).mul(aA.w.mul(0.3).add(0.85))
    return {
      clip: cameraProjectionMatrix.mul(vec4(vc.add(side.mul(ww).mul(positionGeometry.y)).add(ext), 1)),
      vQ: positionGeometry.xy.toVarying("ejQ"),
      vC: heat(T as F).mul(on).mul(aB.w.mul(aB.w).mul(0.9).add(0.1)).toVarying("ejC"),
    }
  })()
  const ejFrag = Fn(() => {
    // (clamped: interpolation can step a hair outside [0, 1])
    const s = clampN(EJ.vQ.x.mul(0.5).add(0.5), 0, 1).toVar()
    const across = exp(sq(EJ.vQ.y as F).mul(-3))
    const head = exp(sq(s.oneMinus().div(0.12) as F).negate())
    const tail = s.mul(s).mul(0.8)
    // the tail is what the head was a moment ago: cooler, redder
    const tint = mixN(vec3(1, 0.32, 0.12), vec3(1), s.mul(0.6).add(head.mul(0.4)))
    return vec4(EJ.vC.mul(tint).mul(tail.add(head.mul(2.2))).mul(across), 1)
  })()
  const ejecta = add(new THREE.Mesh(ejGeo, mat(EJ.clip, ejFrag, ADD)), 7)

  // ---------------------------------------------------------------- the surge
  // A base surge, built the way a density current is: a head with a raised, overhanging nose whose
  // leading edge is scalloped into lobes and clefts, cauliflower billows that roll down its face,
  // and behind it taller, slower ranks that the shear has torn loose and curled back. Each rank is
  // one opaque sheet (so ranks, cones and plain hide one another by depth, with no blending),
  // pushed out along its normal by the billows at its vertices for the outline and again per pixel
  // for the shading: the cloud is dark, sooty ash on its crowns, incandescent where a cleft opens
  // into it and where it rides the ground, lit from under by the melt and rimmed from behind.
  for (let i = 0; i < 990; i++) R() // (the old billow sprites drew these: the ash and dust after them stay where they were)
  const SG_NX = 200, SG_NY = 26, SG_RANKS = 4, SG_AMP = 0.62
  const surgeGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    const pos = new Float32Array((SG_NX + 1) * (SG_NY + 1) * 3)
    for (let j = 0; j <= SG_NY; j++) for (let i = 0; i <= SG_NX; i++) pos.set([(i / SG_NX) * 2 - 1, j / SG_NY, 0], (j * (SG_NX + 1) + i) * 3)
    const idx: number[] = []
    for (let j = 0; j < SG_NY; j++)
      for (let i = 0; i < SG_NX; i++) {
        const a = j * (SG_NX + 1) + i, b = a + 1, c = a + SG_NX + 1, d = c + 1
        idx.push(a, b, c, b, d, c)
      }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.instanceCount = SG_RANKS
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  /** 0 in a cleft (a sharp crease), rising to a round back. */
  const billow = (p: V2): F => abs(vnoise(p).mul(2).sub(1)) as F
  /** How far the cloud's skin stands out at (along the front, up the face): the two big octaves, which shape the outline too. */
  const sgSkin = (c: V2, roll: F): F => {
    const q = vec2(c.x.mul(1.2), c.y.mul(2.0).add(roll)).toVar()
    return billow(q.add(vnoise(q.mul(0.55).add(7.1)).mul(0.9)) as V2).mul(0.56).add(billow(q.mul(2.3).add(vec2(3.7, roll.mul(0.5))) as V2).mul(0.27)) as F
  }
  /** The smaller billows on those, each weighted by whether a pixel can hold it. The two finest are ridged
   *  only far off; close to they turn into round bumps (ridged at that size reads as worm-cast clay). */
  const sgFine = (c: V2, roll: F, k3: F, k4: F, k5: F, near: F): F => {
    const q = vec2(c.x.mul(1.2), c.y.mul(2.0).add(roll)).toVar()
    const soft = (n: F): F => mixN(abs(n.mul(2).sub(1)), n.mul(n).mul(n.mul(-2).add(3)), near) as F
    return billow(q.mul(5.1).add(vec2(1.3, roll.mul(0.9))) as V2).mul(0.11).mul(k3).add(soft(vnoise(q.mul(11.3).add(vec2(8.2, roll.mul(1.4)))) as F).mul(0.045).mul(k4)).add(soft(vnoise(q.mul(26).add(vec2(2.9, roll.mul(2)))) as F).mul(0.02).mul(k5).mul(near.oneMinus())) as F
  }
  const SG = (() => {
    const rank = float(instanceIndex).toVar()
    const H = U.uWallH.mul(rank.mul(0.85).add(1).add(rank.mul(rank).mul(0.22))).toVar()
    const back = U.uWallH.mul(rank.mul(1.5).add(rank.mul(rank).mul(0.55)))
    const seed = rank.mul(17.3)
    const v = positionGeometry.y
    // columns are spread evenly in angle from where we stand, so a lobe keeps its share of them
    const xw = max(U.uSgD.add(back), H.mul(2.2)).mul(positionGeometry.x.mul(1.2).tan()).toVar()
    const roll = U.uT.mul(rank.mul(-0.12).add(0.55)).add(seed)
    // the leading edge in plan: noses pushed out, clefts left behind (strongest at the ground)
    const nose = billow(vec2(xw.div(H.mul(1.9)).add(seed.mul(1.7)), U.uT.mul(0.12)) as V2).mul(H).mul(0.55)
    // its section: a nose that overhangs its own foot, a face that leans back to the top
    const prof = (t: THREE.Node<"float">) => sin(pow(t, 0.7).mul(Math.PI)).mul(0.62).mul(t.mul(-0.45).add(1)).sub(t.mul(t).mul(rank.mul(0.25).add(0.95)))
    const top = H.mul(vnoise(vec2(xw.div(H.mul(1.3)).add(seed), U.uT.mul(0.1).add(rank))).mul(0.45).add(billow(vec2(xw.div(H.mul(0.42)).add(seed.mul(2.3)), U.uT.mul(0.3)) as V2).mul(0.3)).add(0.62)).toVar()
    // torn loose and curled back: the ranks behind the head sway and trail
    const curl = sin(v.mul(6).sub(U.uT.mul(1.1)).add(xw.div(H.mul(0.8))).add(seed)).mul(v).mul(v).mul(H).mul(0.2).mul(min(rank, 1))
    const Pb = vec3(xw.add(curl), top.mul(v), U.uFront.sub(back).add(H.mul(prof(v))).add(nose.mul(v.mul(-0.55).add(1)))).toVar()
    const tz = H.mul(prof(v.add(0.03)).sub(prof(v))).sub(nose.mul(0.0165))
    const nb = normalize(vec3(0, max(tz.negate(), top.mul(-0.012)), top.mul(0.03))).toVar()
    const c = vec2(xw.div(H).add(seed), v).toVar()
    // (and the billows lift the outline too: the top is crenellated, never a smooth ridge)
    const skin = sgSkin(c as V2, roll as F).mul(H).mul(SG_AMP).toVar()
    const P = Pb.add(nb.mul(skin)).add(vec3(0, skin.mul(v).mul(0.8), 0))
    return { P, vP: Pb.toVarying("sgP"), vN: nb.toVarying("sgN"), vC: vec4(c, rank, H).toVarying("sgC"), vR: roll.toVarying("sgR") }
  })()
  const surgeFrag = Fn(() => {
    const c = SG.vC.xy.toVar(), rank = SG.vC.z, H = SG.vC.w
    const v = c.y
    // finer billows come in as a pixel gets small enough to hold them
    const fw = max(abs(dFdx(c.x)), abs(dFdy(c.x))).add(max(abs(dFdx(c.y)), abs(dFdy(c.y)))).toVar()
    const hc = sgSkin(c as V2, SG.vR as F).toVar()
    const nearC = ssr(H.mul(4), H.mul(1.5), length(cameraPosition.sub(SG.vP)))
    const h = hc.add(sgFine(c as V2, SG.vR as F, ssr(0.09, 0.03, fw), ssr(0.04, 0.013, fw), ssr(0.017, 0.006, fw), nearC)).toVar()
    // the skin's normal: the sheet's own, tipped by the slope of the billows across the screen
    const nb = normalize(SG.vN).toVar()
    const px = dFdx(SG.vP).toVar(), py = dFdy(SG.vP).toVar()
    const r1 = cross(py, nb), r2 = cross(nb, px)
    const det = dot(px, r1).toVar()
    const grad = r1.mul(dFdx(h)).add(r2.mul(dFdy(h))).mul(sign(det)).mul(H.mul(SG_AMP))
    const N = normalize(nb.mul(abs(det)).sub(grad)).toVar()
    const toC = cameraPosition.sub(SG.vP).toVar()
    const dist = length(toC).toVar()
    const Vv = toC.div(dist)
    const up = sat(v as F).toVar()
    // how deep in a crease: the clefts between the big billows open into the core, the small ones only a little
    const cleft = max(ssr(0.15, 0.03, hc), ssr(0.2, 0.06, h).mul(0.35)).toVar()
    const crown = smoothstep(0.16, 0.42, h).toVar()
    // soot and ash: neutral greys, darker up the face; it only ever reflects what is near it
    const alb = mixN(vec3(0.062, 0.057, 0.054), vec3(0.02, 0.019, 0.019), crown.mul(up.mul(0.5).add(0.5)))
    // (the melt lights every billow's belly and leaves its back dark: that is what makes them round)
    const under = heat(float(1.1)).mul(sat(N.y.mul(-1.3).add(0.12) as F)).mul(up.mul(-0.7).add(1)).mul(2.6)
    const lightD = U.uAmb.mul(N.y.mul(0.5).add(0.5)).mul(2.5).add(under).add(U.uHaze.mul(0.35))
    const ao = mixN(float(0.25), 1, smoothstep(0.04, 0.36, h))
    const col = alb.mul(lightD).mul(ao).mul(up.mul(-0.5).add(1)).toVar()
    // the fire is in the body of the flow, not in spots: incandescent at its foot, cooling and darkening up
    // to sooty crowns, broken by the billows' shade
    const body = heat(mixN(float(1.05), 0.35, pow(up, 0.6)) as F).mul(sq(up.oneMinus() as F).mul(0.85).add(0.06)).mul(ao.mul(0.7).add(0.3)).mul(crown.mul(-0.55).add(1))
    col.addAssign(body.mul(0.4))
    // lit from within: the hot core shows where a cleft opens into it, and all along the foot
    const Tin = mixN(float(0.6), 1.7, pow(cleft, 1.2)).sub(up.mul(0.45)).sub(rank.mul(0.12)).add(vnoise(c.mul(vec2(3.1, 5.7)).add(SG.vR.mul(0.7))).mul(0.25))
    col.addAssign(heat(Tin as F).mul(cleft.mul(0.9).add(0.012)))
    col.addAssign(heat(float(1.5)).mul(exp(SG.vP.y.div(H.mul(0.07)).negate())).mul(0.8))
    // lit from behind: light comes through where the cloud is thin, at the edges of every billow
    const rim = pow(sat(dot(N, Vv)).oneMinus(), 5)
    col.addAssign(heat(float(1.15)).mul(rim).mul(up.mul(0.7).add(0.3)).mul(0.45))
    // the ranks behind stand in the vapour the head has left
    col.assign(mixN(col, vec3(0.2, 0.055, 0.018), rank.mul(0.17)))
    // close to, a surge has no surface: the lens is already in its outer ash, a lit, turning murk
    const veil = ssr(H.mul(3.5), H.mul(0.6), dist).mul(vnoise(c.mul(vec2(2.2, 1.4)).add(vec2(SG.vR.mul(0.8), SG.vR.mul(-0.5)))).mul(0.5).add(0.45))
    const murk = mixN(vec3(0.05, 0.035, 0.028), heat(float(1.0)).mul(0.55), sq(vnoise(c.mul(vec2(4.1, 2.7)).add(vec2(SG.vR.mul(-0.6), SG.vR.mul(1.1)))) as F))
    col.assign(mixN(col, murk, veil.mul(0.45)))
    // (it is lit, and it is the nearest air to itself: the haze of the plain takes less of it)
    const fog = exp(dist.mul(U.uHazeK).mul(0.25).negate()).oneMinus()
    col.assign(mixN(col, U.uHaze.mul(0.6), fog))
    col.assign(mixN(col, heat(float(1.45)), U.uInside))
    return vec4(col, 1)
  })()
  const surge = add(new THREE.Mesh(surgeGeo, mat(viewProj.mul(vec4(SG.P, 1)), surgeFrag)), 3)

  // ---------------------------------------------------------------- the crust the shock lifts
  // Just ahead of the surge the ground wave breaks the skin into plates and throws them: each lies
  // in the crust until the crest reaches it, then lifts, tips and is flung toward us, its underside
  // still glowing, until the cloud takes it.
  const N_SHARD = 900
  const shardGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    const rr = rng(4127)
    const pos: number[] = []
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rr() * 0.5, r = 0.6 + rr() * 0.5
        pos.push(Math.cos(a) * r, k ? -0.09 : 0.09, Math.sin(a) * r)
      }
    const idx: number[] = []
    for (let i = 1; i < 5; i++) idx.push(0, i + 1, i, 6, 6 + i, 7 + i)
    for (let i = 0; i < 6; i++) idx.push(i, (i + 1) % 6, 6 + i, (i + 1) % 6, 6 + ((i + 1) % 6), 6 + i)
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const a = new Float32Array(N_SHARD * 4), b = new Float32Array(N_SHARD * 4)
    for (let i = 0; i < N_SHARD; i++) {
      const z = 30 - Math.pow(rr(), 1.3) * 3000
      a.set([(rr() * 2 - 1) * (40 + Math.abs(z) * 0.5), z, 0.6 + rr() * rr() * 2.2, rr()], i * 4)
      b.set([rr() * 6.283, rr(), rr(), rr()], i * 4)
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4))
    g.instanceCount = N_SHARD
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  const SD = (() => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const reach = max(float(10), abs(U.uFront).mul(0.11)).mul(2.6).toVar()
    const tau = U.uFront.add(reach).sub(aA.y).div(reach).toVar()
    const on = step(0, tau).mul(step(tau, 1.15)).mul(U.uFrontOn).mul(step(aA.y, U.uGrid.y.sub(26)))
    const size = aA.z.mul(abs(aA.y.sub(U.uGrid.y)).mul(0.008).add(1)).mul(on)
    // tip about a level axis, then turn that axis to its own heading
    const tip = tau.mul(aB.y.mul(2.6).add(0.9))
    const p = positionGeometry.mul(size).toVar()
    const t1 = vec3(p.x, rot(p.yz as V2, tip)).toVar()
    const t2 = rot(t1.xz as V2, aB.x).toVar()
    const base = vec2(aA.x, aA.y.add(reach.mul(0.4).mul(tau).mul(tau))).toVar()
    const lift = dispY(base as V2).add(size.mul(aB.z.mul(2.4).add(0.4)).mul(pow(max(tau, 0), 1.5)))
    const W = vec3(base.x.add(t2.x), lift.add(t1.y), base.y.add(t2.y)).toVar()
    return { W, vW: W.toVarying("sdW"), vS: vec3(positionGeometry.y, tau, aA.w).toVarying("sdS") }
  })()
  const shardFrag = Fn(() => {
    const P = SD.vW
    const n0 = cross(dFdx(P), dFdy(P)).toVar()
    const toC = cameraPosition.sub(P).toVar()
    const dist = length(toC)
    const N = normalize(n0.mul(sign(dot(n0, toC)))).toVar()
    // the top is old skin; the underside and the broken edge are what was melt a moment ago
    const hot = ssr(0.085, 0.02, SD.vS.x)
    const skin = vec3(0.045).mul(U.uAmb.mul(3).add(U.uKeyCol.mul(max(dot(N, U.uKeyDir), 0)).mul(0.6))).add(U.uHaze.mul(pow(sat(dot(N, toC.div(dist))).oneMinus(), 3)).mul(0.6))
    const col = mixN(skin, heat(mixN(float(1.05), 0.7, sat(SD.vS.y as F)).add(SD.vS.z.mul(0.15)) as F), hot).toVar()
    const fog = exp(dist.mul(U.uHazeK).negate()).oneMinus()
    col.assign(mixN(col, U.uHaze, fog))
    col.assign(mixN(col, heat(float(1.45)), U.uInside))
    return vec4(col, 1)
  })()
  const shards = add(new THREE.Mesh(shardGeo, mat(viewProj.mul(vec4(SD.W, 1)), shardFrag, { side: THREE.DoubleSide })), 2)

  // ---------------------------------------------------------------- ash, embers
  const ashGeo = quad(N_ASH)
  {
    const a = new Float32Array(N_ASH * 4)
    for (let i = 0; i < N_ASH; i++) a.set([R(), R(), R(), R()], i * 4)
    ashGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
  }
  const AS = (() => {
    const aS = attribute("aS", "vec4")
    const BOX = vec3(70, 26, 70)
    const drift = vec3(U.uT.mul(aS.w.mul(0.5).add(0.5)), U.uT.mul(aS.x.sub(0.25)).mul(0.5), U.uT.mul(0.3)).add(vec3(sin(U.uT.mul(0.7).add(aS.w.mul(40))), 0, cos(U.uT.mul(0.5).add(aS.x.mul(40)))).mul(0.5))
    const p = aS.xyz.mul(BOX).add(drift).add(U.uBlow).sub(cameraPosition)
    const wr = fract(p.div(BOX).add(0.5)).sub(0.5).mul(BOX).add(cameraPosition)
    const w = vec3(wr.x, fract(aS.y.add(drift.y.div(26))).mul(26), wr.z).toVar()
    const ember = step(0.94, aS.w)
    const vc = cameraViewMatrix.mul(vec4(w, 1)).toVar()
    const size = mixN(aS.z.mul(0.03).add(0.012), aS.z.mul(0.02).add(0.012), ember)
    const px = max(size, U.uPx.mul(1.1).mul(vc.z.negate()))
    const flick = sin(U.uT.mul(9).add(aS.x.mul(90))).mul(0.3).add(0.8)
    const lit = U.uAmb.mul(2.2).add(U.uKeyCol.mul(0.35)).add(heat(float(0.8)).mul(exp(w.y.mul(-0.25))).mul(0.35).mul(U.uHot))
    const near = smoothstep(0.3, 1.2, vc.z.negate()).mul(exp(vc.z.mul(0.045)))
    return {
      clip: cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(px)), vc.z, 1)),
      vQ: positionGeometry.xy.toVarying("asQ"),
      vC: vec4(mixN(vec3(0.16, 0.15, 0.14).mul(lit), heat(flick.mul(1.15) as F).mul(1.5), ember).mul(sq(size.div(px) as F)).mul(near), mixN(float(0.55), 0, ember).mul(near)).toVarying("asC"),
    }
  })()
  const ashFrag = Fn(() => {
    const d = ssr(1, 0.35, length(AS.vQ))
    return vec4(AS.vC.xyz.mul(d), AS.vC.w.mul(d))
  })()
  const ash = add(new THREE.Mesh(ashGeo, mat(AS.clip, ashFrag, OVER)), 8)

  // ---------------------------------------------------------------- the dust the landing kicks out
  const dustGeo = quad(N_DUST)
  {
    const a = new Float32Array(N_DUST * 4)
    for (let i = 0; i < N_DUST; i++) a.set([R() * 6.283, 0.35 + R(), R(), R()], i * 4)
    dustGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(a, 4))
  }
  const DU = (() => {
    const aD = attribute("aD", "vec4")
    const t = max(U.uDustT, 0).toVar()
    const r = exp(t.mul(-2.4)).oneMinus().mul(aD.y).mul(11).add(0.6)
    const w = vec3(cos(aD.x).mul(r), aD.z.mul(0.5).add(0.15).add(t.mul(aD.w).mul(0.9)), sin(aD.x).mul(r).add(8))
    const vc = cameraViewMatrix.mul(vec4(w, 1)).toVar()
    const size = aD.z.mul(0.5).add(0.35).mul(t.mul(1.6).add(0.4))
    const a = smoothstep(0, 0.08, U.uDustT).mul(sq(sat(t.div(2.6).oneMinus() as F))).mul(0.34)
    const lit = U.uAmb.mul(3).add(heat(float(0.9)).mul(0.25).mul(exp(w.y.mul(-0.8))))
    return {
      clip: cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size).mul(step(1e-3, a))), vc.z, 1)),
      vQ: positionGeometry.xy.toVarying("duQ"),
      vC: vec4(vec3(0.3, 0.26, 0.23).mul(lit), a).toVarying("duC"),
    }
  })()
  const dustFrag = Fn(() => {
    const d = sq(ssr(1, 0, length(DU.vQ)) as F).mul(DU.vC.w)
    return vec4(DU.vC.xyz.mul(d), d)
  })()
  const dust = add(new THREE.Mesh(dustGeo, mat(DU.clip, dustFrag, OVER)), 9)

  // ---------------------------------------------------------------- the air in front of the lens
  const air = ctx.pass(({ uv, time }) => {
    // heat shimmer: only in a band along the horizon, only where there is something hot under it
    const band = exp(sq(uv.y.sub(U.uHorY).div(0.07) as F).negate()).mul(U.uShim)
    const n = vec2(vnoise(vec2(uv.x.mul(70), uv.y.mul(130).sub(time.mul(2.3)))), vnoise(vec2(uv.x.mul(55).add(9), uv.y.mul(160).sub(time.mul(3.1))))).sub(0.5)
    const c = sampleRT(U.tS, uv.add(n.mul(band).mul(vec2(0.0016, 0.0045))) as V2).rgb.toVar()
    // the burn: a flat white that rises from the horizon line
    If(U.uBurn.greaterThan(0), () => {
      const d = abs(uv.y.sub(U.uHorY))
      const k = sat(U.uBurn.mul(2.2).sub(d.mul(mixN(float(3.2), 0, sat(U.uBurn.mul(1.5).sub(0.5) as F)))) as F)
      c.assign(mixN(c, vec3(1.0, 0.96, 0.9).mul(7), sq(k)))
    })
    return vec4(c, 1)
  }, U)

  // ---------------------------------------------------------------- the moonlets' table
  function ML_A(k: number) {
    return 3.25 + ((k * 0.618) % 1) * 1.5
  }
  const ML = Array.from({ length: NML }, (_, k) => ({ a: ML_A(k), th0: k === 0 ? -0.42 : ((k * 0.381 + 0.2) % 1) * 2.6 - 1.2, merge: k === 0 ? 0 : 0.52 + 0.4 * ((k - 1) / (NML - 2)) }))
  const MOON = { a0: ML[0].a, th0: ML[0].th0 }

  // ---------------------------------------------------------------- the frame's state (JS twin of the world rule)
  const W = {
    white: 0, theia: 0, tc: -1e3, bodyPx: [0, 0] as [number, number], bodyOn: 0, moonPx: [0, 0, 0] as [number, number, number], moonOn: 0, heat: 0, rum: 0, wind: 0,
  }
  const tmp = v3(), tmp2 = v3(), bodyDir = v3(), fwd = v3(), right = v3(), up = v3(), keyDir = v3()
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.5, bloomThresh: 0.95, bloomRadius: 0.8, halation: 0.5, vignette: 0.3, ca: 0.001, sat: 1.04, contrast: 1.08, lift: [0.003, 0.004, 0.008], gain: [1, 1, 1], grain: 0.028 }
  const TITLES: TitleOpts = { color: "#ffffff", delay: [0.7, 0.5, 0.8], maxLine: 30, skip: [1], shadow: "rgba(0,0,0,0.85)" }
  const HUD = { color: "#ffffff", shadow: "rgba(0,0,0,0.8)" }
  const bump = (x: number, a: number, b: number, c: number, d: number) => smooth(a, b, x) * (1 - smooth(c, d, x))

  function update(s: State) {
    const b = s.beat, t = s.t
    const t0 = b === 0 ? t : 1e3
    const t1 = b < 1 ? -1e3 : b === 1 ? t : B1 + t
    const tc = t1 - T_HIT
    const t2 = b < 2 ? -1e3 : t
    W.tc = tc
    // ambient time nearly stops for the held instant
    const tA = s.time - 0.92 * clamp(tc, 0, T_BURN)
    U.uT.value = tA
    U.uFlow.value.set(tA * 0.021, tA * 0.008)

    // ---- the story
    const theia = b < 1 ? 0 : Math.pow(clamp((t1 - 0.5) / (T_HIT - 0.5)), 1.2)
    W.theia = theia
    const u = (tc - T_WALL) / (T_ARR - T_WALL) // the wall's crossing, 0..1 (then on past the lens)
    const burn1 = bump(tc, T_BURN - 0.03, T_BURN + 0.22, T_BURN + 0.3, T_WALL + 0.35)
    const burn2 = tc < T_ARR ? smooth(T_ARR - 0.12, T_ARR, tc) : 1 - E.out2(clamp((tc - T_ARR) / 1.1))
    const thr = E.outBack(clamp((tc - T_ARR) / 1.35))
    const cool = b < 2 ? 0 : 0.9 * E.io2(clamp((t2 - 0.6) / 4)) + 0.08 * clamp((t2 - 4.6) / 8)
    const ring = b < 2 ? 0 : clamp((t2 - RING0) / (RING1 - RING0))
    const silent = tc > -0.05 && tc < T_ARR - 0.02

    // ---- camera
    const fall = t0 < 0 ? -t0 : 0
    const pushed = 7 * E.out2(clamp(t0 / 6)) + clamp((t0 - 6) / 4)
    const dolly = smooth(0.4, T_HIT, t1)
    const crane = b < 2 ? 0 : E.io3(clamp((t2 - 0.5) / 3.7))
    const cz = 8 - pushed + 6.5 * dolly + 26 * thr + 40 * fall
    let cy = 1.5 + 60 * fall * fall - 0.9 * Math.exp(-4.5 * Math.max(t0, 0)) * Math.sin(9 * Math.max(t0, 0)) * (t0 >= 0 ? 1 : 0)
    cy += 9 * thr + 0.22 * clamp(tc - T_ARR - 1.35, 0, 30)
    if (u > 0 && u < 1.6) cy += 1.3 * Math.exp(-Math.pow((cz - (u < 1 ? 8 - pushed + 6.5 - 6200 * Math.pow(1 - u, 3.2) : 8 - pushed + 6.5 + (u - 1) * 1700)) / 9, 2))
    cy = mix(cy, 2.6, crane) + (b === 2 ? 0.05 * Math.max(t2 - 4.2, 0) : 0)
    let pitch = 3.5 * DEG - 64 * DEG * smooth(0.0, 1.7, fall) + 5 * DEG * smooth(0.6, 4.6, t1)
    const ta = tc - T_ARR
    if (ta > 0) pitch += -11.5 * DEG * smooth(0, 1.2, ta) + 13 * DEG * Math.exp(-ta * 2.4) * Math.sin(ta * 5.2)
    pitch = mix(pitch, 15 * DEG, crane) + (b === 2 ? 0.1 * DEG * Math.max(t2 - 4.2, 0) : 0)
    let yaw = -7 * DEG * smooth(0.4, 4.4, t1) - 21 * DEG * crane
    let roll = ta > 0 ? 0.09 * Math.exp(-ta * 1.8) * Math.sin(ta * 4.1) : 0
    const fov = mix(mix(mix(50, 41, dolly), 52, clamp(thr)), 64, crane)
    // the hand, the tremor that rises with the approach, the knocks
    const trem = silent ? 0 : 0.035 * theia * theia + (ta > 0 ? 0.5 * Math.exp(-ta * 2.2) : 0) + (t0 >= 0 ? 0.16 * Math.exp(-t0 * 4) : 0)
    const sh = shake(s.time, 1, 2.6)
    const hh = shake(s.time, 1, 0.11)
    U.uGrid.value.set(0, cz, Math.max(cy, 0.9) / 1.5)
    cam.position.set(hh[0] * 0.12 + sh[0] * trem, cy + hh[1] * 0.06 + sh[1] * trem, cz + sh[2] * trem * 0.5)
    pitch += hh[2] * 0.004 + sh[1] * trem * 0.02 + s.mouse.y * 0.006
    yaw += hh[0] * 0.005 + sh[0] * trem * 0.012 - s.mouse.x * 0.01
    roll += sh[2] * trem * 0.012
    cam.rotation.set(pitch, yaw, roll)
    cam.fov = fov
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    const tf = Math.tan((fov * DEG) / 2)
    const e = cam.matrixWorld.elements
    right.set(e[0], e[1], e[2])
    up.set(e[4], e[5], e[6])
    fwd.set(-e[8], -e[9], -e[10])
    U.uCR.value.copy(right).multiplyScalar(tf * cam.aspect)
    U.uCU.value.copy(up).multiplyScalar(tf)
    U.uCF.value.copy(fwd)
    U.uPx.value = (2 * tf) / s.h
    U.uAsp.value = cam.aspect
    // where the horizon is on screen (for the shimmer and the burn)
    tmp.set(fwd.x, 0, fwd.z).normalize().multiplyScalar(1e5).add(cam.position).setY(0).project(cam)
    U.uHorY.value = tmp.y * 0.5 + 0.5

    // ---- the shock on the plain
    const camZ = 8 - pushed + 6.5
    const zf = u <= 0 ? -1e5 : u < 1 ? camZ - 6200 * Math.pow(1 - u, 3.2) : camZ + (u - 1) * 1700
    U.uFront.value = zf
    U.uFrontOn.value = u > 0 && b < 2 ? 1 : 0
    U.uWave.value = u > 0 ? 1.15 * (1 - smooth(1.05, 1.6, u)) : 0
    U.uMolten.value = clamp((u - 1.05) * 3) * (b === 2 ? 1 - E.io2(clamp(t2 / 3.4)) : 1)
    U.uWallH.value = 120
    U.uSgD.value = Math.max(cz - zf, 0)
    U.uCool.value = cool
    // (the murk closes in over the last strides, before the burn)
    U.uInside.value = tc < T_ARR ? (u > 0 ? 0.45 * (1 - smooth(30, 190, cz - zf)) : 0) : 0.6 * Math.exp(-(tc - T_ARR) * 2.6)
    surge.visible = shards.visible = u > 0 && u < 1.12
    // the landing
    U.uLand.value.set(Math.max(t0, 0), t0 >= 0 && t0 < 3 ? Math.exp(-t0 * 1.5) : 0, 0, 0)
    U.uDustT.value = t0
    dust.visible = t0 > 0 && t0 < 2.7
    // the first tide: a swell that follows the Moon across
    const tideOn = b === 2 ? smooth(4.2, 5.5, t2) : 0
    U.uTide.value.set(0.55 * tideOn, -260 + 46 * (t2 - 4.2), 0.8, 0.6)

    // ---- the sky: the body
    const moonUp = b === 2 && ring > 0.0
    let keyI = 0
    const kc = U.uKeyCol.value
    if (b === 1 || (b === 2 && !moonUp)) {
      const alpha = (27 * DEG) / (1 + 1.7 * (1 - theia))
      const el = (-11 + 64.2 * theia - 54.2 * theia * theia) * DEG
      const az = mix(0.62, AZ_HIT, theia)
      bodyDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
      U.uBodySin.value = Math.sin(alpha)
      U.uBodyOn.value = b === 1 ? 1 - smooth(T_BURN + 0.25, T_BURN + 0.45, tc) : 0
      U.uBodyKind.value = 0
      U.uBodyHeat.value = smooth(0.7, 1, theia) * 0.8
      U.uBodySpin.value = 0.4 + theia * 0.25
      U.uShine.value = 0.12 + 0.5 * theia * theia
      W.bodyOn = b === 1 && theia > 0.02 && tc < 0 ? 1 : 0
      // the top-left of the limb, for the label
      tmp.copy(bodyDir).addScaledVector(up, Math.sin(alpha) * 0.72).addScaledVector(right, -Math.sin(alpha) * 0.72).multiplyScalar(1000).add(cam.position).project(cam)
      W.bodyPx[0] = (tmp.x * 0.5 + 0.5) * 1920
      W.bodyPx[1] = (0.5 - tmp.y * 0.5) * 1080
      keyDir.copy(bodyDir).addScaledVector(SUN, 0.5).normalize()
      keyI = 0.35 * smooth(0.05, 0.5, theia) * (1 + 1.2 * theia) * U.uBodyOn.value
      kc.set(0.8, 0.88, 1.0).multiplyScalar(keyI)
    }
    // ---- the sky: ring and Moon
    const tau = b === 2 ? 0.25 * t2 : 0
    U.uTau.value = tau
    U.uRing.value = ring
    U.uRingOn.value = b === 2 ? smooth(0.2, 2.2, t2) : 0
    ringMesh.visible = b === 2
    U.uPuff.value = mix(1, 0.1, smooth(0, 0.6, ring))
    U.uRingT.value = mix(1.7, 0.42, E.out2(clamp(t2 / 9))) * (b === 2 ? 1 : 0)
    U.uDrain.value = b === 2 ? 0.34 * smooth(0.1, 1, ring) + 0.02 * Math.max(t2 - RING1, 0) : 0
    // the Moon's own elements: it grows where the first moonlet was, then recedes
    const rec = b === 2 ? smooth(0.82, 1, ring) * 0.5 + 0.09 * Math.max(t2 - RING1, 0) : 0
    const aM = MOON.a0 + rec
    const thM = MOON.th0 + (KEP(MOON.a0) - OMEGA) * tau
    let mass = 0
    for (let k = 0; k < NML; k++) {
      const m = ML[k]
      const gather = smooth(0.04 + 0.03 * k, m.merge > 0 ? m.merge - 0.1 : 0.5, ring)
      const fallIn = m.merge > 0 ? E.in2(clamp((ring - (m.merge - 0.13)) / 0.13)) : 1
      const th = m.th0 + (KEP(m.a) - OMEGA) * tau
      const v = mlV[k]
      v.set(k === 0 ? aM : mix(m.a, aM, fallIn), k === 0 ? thM : mix(th, thM, fallIn), gather, k === 0 || fallIn >= 1 ? 0 : 0.012 * gather * (1 - fallIn * 0.5))
      mass += k === 0 ? gather * 0.2 : fallIn >= 1 ? 0.1 : 0
    }
    if (moonUp) {
      skyAt(aM, thM, 0, tmp)
      const d = tmp.length()
      const rM = R_MOON * Math.pow(clamp(mass), 1 / 3)
      bodyDir.copy(tmp).divideScalar(d)
      U.uBodySin.value = Math.max(rM / d, 1e-3)
      U.uBodyOn.value = smooth(0.02, 0.12, ring)
      U.uBodyKind.value = 1
      const whole = smooth(0.9, 1, ring)
      U.uBodyHeat.value = mix(1.75, 0.5, E.out2(clamp((t2 - 2.5) / 7))) * (1 - 0.6 * smooth(RING1, RING1 + 5, t2))
      U.uBodyCrust.value = smooth(0.45, 1, ring) * 0.55 + 0.45 * smooth(RING1 - 0.5, RING1 + 4, t2)
      U.uBodySpin.value = 0.2 + tau * 0.1
      U.uShine.value = 0.5
      tmp2.copy(bodyDir).multiplyScalar(1000).add(cam.position).project(cam)
      W.moonPx[0] = (tmp2.x * 0.5 + 0.5) * 1920
      W.moonPx[1] = (0.5 - tmp2.y * 0.5) * 1080
      W.moonPx[2] = ((rM / d) / tf) * 540
      W.moonOn = whole
      keyDir.copy(bodyDir)
      keyI = 0.55 * U.uBodyOn.value * Math.pow(clamp(mass), 0.67)
      const hotM = clamp(U.uBodyHeat.value / 1.75)
      kc.set(1, mix(0.9, 0.62, hotM), mix(0.82, 0.3, hotM)).multiplyScalar(keyI)
    } else W.moonOn = 0
    // a basis on the body's face that does not depend on the camera
    tmp.set(0, 1, 0).cross(bodyDir).normalize()
    U.uBodyDir.value.copy(bodyDir)
    U.uBodyX.value.copy(tmp)
    U.uBodyY.value.crossVectors(bodyDir, tmp)

    // ---- the one sky light
    // the flash stands up off the horizon and sinks back into it, and then the brightest thing is
    // the wall, dead ahead: so the shadows lengthen, and swing as they do
    const hitAz = mix(AZ_HIT, 0.06, smooth(T_WALL - 0.2, T_ARR, tc))
    const hitDir = tmp.set(Math.sin(hitAz), mix(0.075, 0.028, E.out2(clamp(tc / (T_WALL + 0.9)))), -Math.cos(hitAz)).normalize()
    const contact = bump(tc, 0, 0.42, T_BURN + 0.5, T_WALL + 0.6)
    const wallLit = u > 0 && u < 1 ? 1 : 0
    if (contact > 0 || wallLit) {
      // the flash, then the wall: low, from where it happened; long shadows toward us
      const f = Math.max(contact * 5, wallLit * (0.9 + 1.5 * u * u))
      keyDir.lerp(hitDir, clamp(f * 2)).normalize()
      kc.lerp(tmp2.set(1.0, 0.86, 0.68).multiplyScalar(f), clamp(f * 2))
      keyI = Math.max(keyI, f)
    }
    const vap = b < 1 ? 0 : tc < T_BURN ? 0 : (b === 2 ? mix(0.7, 0.05, E.io2(clamp(t2 / 3.4))) : 0.28 * smooth(T_BURN, T_BURN + 0.5, tc) + 0.42 * smooth(T_ARR - 0.2, T_ARR + 0.3, tc))
    if (u >= 1) {
      // afterwards the whole sky is the lamp
      keyDir.set(0.25, 0.85, -0.45).normalize().lerp(b === 2 && moonUp ? bodyDir : keyDir, b === 2 ? smooth(0.5, 3, t2) : 0).normalize()
      const vI = 0.9 * vap
      kc.set(kc.x + vI, kc.y + vI * 0.55, kc.z + vI * 0.25)
    }
    if (keyDir.y < 0.026) keyDir.setY(0.026).normalize()
    U.uKeyDir.value.copy(keyDir)
    U.uShadow.value = clamp(keyI * 1.6) * 0.9 * (u >= 1 && b < 2 ? 0 : 1) * (b === 2 ? smooth(1.5, 4, t2) * 0.6 : 1)
    shadeOn = U.uShadow.value > 0.004
    if (!shadeOn) U.uShadow.value = 0
    // the air: the magma's own glow, more of it after the hit, draining as the crust comes back
    const hot = b < 1 ? 1 : silent && tc < T_BURN ? 1 : 1 + 0.25 * theia
    const after = u >= 1 ? 1 : 0
    const glow = mix(1, 1.7, after) * (1 - 0.74 * cool)
    U.uHot.value = hot
    U.uHaze.value.set(0.2 * glow, 0.058 * glow * (1 + 0.5 * after), 0.016 * glow * (1 + after))
    U.uAmb.value.set(0.11 * glow + keyI * 0.02, 0.04 * glow + keyI * 0.02, 0.016 * glow + keyI * 0.025)
    U.uHazeK.value = mix(0.0011, 0.0019, after * (1 - cool))
    U.uBand.value = mix(13, 4.5, after * (1 - cool))
    U.uVap.value = vap
    U.uVapT.value = mix(1.75, 1.05, clamp((tc - T_ARR) / 6))
    U.uGlowHit.value = b === 1 ? smooth(0.5, 1, theia) * (1 - contact) : 0
    U.uContact.value = b === 1 ? smooth(0, 0.4, tc) * (1 - smooth(T_BURN + 0.4, T_WALL + 0.4, tc)) : 0
    U.uBurn.value = Math.max(burn1, burn2 * 1.05)
    U.uShim.value = 1 - 0.5 * cool
    W.white = Math.max(burn1, burn2)

    // ---- fountains (they pulse; the shock puts them out)
    for (let i = 0; i < N_FOUNT; i++) {
      const f = FOUNT[i]
      const pulse = 0.55 + 0.45 * Math.sin(tA * (0.5 + i * 0.13) + i * 2.1) + 0.15 * Math.sin(tA * 3.1 + i)
      const alive = zf > f[1] ? 0 : 1
      fountV[i].set(f[0], f[1], f[2] * (0.75 + 0.25 * pulse), b === 2 ? 0 : alive * clamp(pulse))
    }
    drops.visible = b < 2 && zf < -300
    U.uFume.value = (b === 2 ? 0.5 * smooth(2, 6, t2) : 1 - clamp(u * 4)) * (t0 < 0 ? clamp(1 + t0 * 3) : 1)
    fume.visible = U.uFume.value > 0.01

    // ---- meteors: where each is now, and the last four strikes (on the beat clock, like their cues)
    const tm = b === 0 ? t : b === 1 ? B0 + t : 1e3
    let n = 0
    let nf = 0
    for (let i = 0; i < 4; i++) flashV[i].set(0, 0, 0, 0)
    if (b < 2 && tc < 0)
      for (let i = mets.length - 1; i >= 0; i--) {
        const m = mets[i]
        const dtm = tm - m.t
        if (dtm > -m.fly && dtm < 0.12 && n < N_MET) {
          const p = clamp(1 + dtm / m.fly)
          tmp.lerpVectors(m.from, m.to, p)
          tmp2.lerpVectors(m.from, m.to, Math.max(0, p - 0.22))
          metH.set([tmp.x, tmp.y, tmp.z, m.big === 1 ? 0.22 : 1.6 * m.big], n * 4)
          metT.set([tmp2.x, tmp2.y, tmp2.z, (0.5 + 1.5 * p) * m.big * (dtm > 0 ? 1 - dtm / 0.12 : 1)], n * 4)
          n++
        }
        if (dtm >= 0 && dtm < 5 && nf < 4) flashV[nf++].set(m.to.x, m.to.z, (m.big === 1 ? 1.6 : 9 * m.big) * Math.exp(-dtm * 9) + 0.5 * m.big * Math.exp(-dtm * 1.2), m.big * Math.exp(-dtm * 0.7))
      }
    for (let i = n; i < N_MET; i++) {
      metH.set([0, -100, 0, 0], i * 4)
      metT.set([0, -100, 0, 0], i * 4)
    }
    aMH.needsUpdate = true
    aMT.needsUpdate = true
    meteors.visible = n > 0

    // ---- ejecta, ash
    U.uTe.value = tc - T_BURN
    ejecta.visible = tc > T_BURN && tc < T_BURN + 21
    const blown = u > 1 ? 60 * (1 - Math.exp(-(u - 1) * 3)) : 0
    U.uBlow.value.set(0, 0, blown)

    // ---- post, sound
    W.heat = clamp(0.35 + 0.25 * theia + after * 0.6 - cool * 0.6)
    W.rum = silent ? 0 : b === 1 ? Math.pow(theia, 1.5) : 0
    W.wind = tc > T_ARR ? Math.exp(-(tc - T_ARR) * 0.5) : 0
    if (s.live) {
      ctx.synth.bed("fire", silent ? 0 : W.heat)
      ctx.synth.bed("crackle", silent ? 0 : W.heat * 0.6)
      if (W.rum > 0.01) ctx.synth.bed("hum", W.rum)
      if (W.wind > 0.02) ctx.synth.bed("wind", W.wind)
    }
    POST.exposure = 1 + 0.5 * (t0 >= 0 ? Math.exp(-t0 * 5) : 0) - 0.2 * after * (1 - cool) + 0.2 * cool
    POST.bloom = 0.5 + 0.3 * W.white + 0.12 * after * (1 - cool)
    POST.ca = 0.001 + 0.004 * trem
    POST.vignette = mix(0.3, 0.2, after * (1 - cool))
    // (the type goes dark over the burn, and over the pale murk that comes just before it)
    const pale = Math.max(W.white, tc < T_ARR ? U.uInside.value * 1.7 : 0) > 0.45
    TITLES.color = HUD.color = pale ? "#1a0e06" : "#ffffff"
    TITLES.shadow = HUD.shadow = pale ? "rgba(255,255,255,0)" : "rgba(0,0,0,0.85)"
    skyMesh.visible = plain.visible = slabs.visible = true
    ash.visible = true
  }

  // ---------------------------------------------------------------- sound
  const HITPOS: [number, number, number] = [0.35, -0.1, 1.6]
  const cues: Cue[] = [
    // the landing
    { b: 0, at: 0, s: "thud", o: { f: 62, g: 1 }, pos: [0, -0.6, 0] },
    { b: 0, at: 0.01, s: "sub", o: { g: 0.7 } },
    { b: 0, at: 0.05, s: "sizzle", o: { g: 0.6 }, pos: [0, -0.5, 0.1] },
    { b: 0, at: 0.12, s: "crackle", o: { dur: 1.2, g: 0.5 }, pos: [-0.3, -0.5, 0.2] },
    // the approach: a riser that ends on contact, then nothing
    { b: 1, at: T_HIT - 3.2, s: "riser", o: { dur: 3.2, g: 0.7 }, pos: HITPOS },
    { b: 1, at: T_HIT + 0.05, s: "shimmer", o: { f: H(72), g: 0.14 }, pos: HITPOS },
    // the wall arrives, and the sound with it: late, for the distance
    { b: 1, at: T_HIT + T_ARR, s: "sub", o: { g: 1, dur: 5.5 } },
    { b: 1, at: T_HIT + T_ARR + 0.02, s: "boom", o: { f: 34, dur: 5.5, g: 1 } },
    { b: 1, at: T_HIT + T_ARR + 0.04, s: "thud", o: { f: 48, g: 1 }, pos: [0.2, -0.3, 0] },
    { b: 1, at: T_HIT + T_ARR + 0.07, s: "crack", o: { f: 700, g: 0.9 }, pos: [0.3, 0, 0.1] },
    { b: 1, at: T_HIT + T_ARR + 0.1, s: "whoosh", o: { f: 90, dur: 2.6, g: 0.8 }, pos: [0, 0, -0.8] },
    { b: 1, at: T_HIT + T_ARR + 0.5, s: "rumble", o: { f: 70, dur: 5, g: 0.8 } },
    { b: 1, at: T_HIT + T_ARR + 0.6, s: "crackle", o: { dur: 2.5, g: 0.7 }, pos: [-0.5, -0.4, 0.3] },
    // the ring
    { b: 2, at: RING0, s: "pad", o: { f: H(3), dur: 7, g: 0.7 } },
    { b: 2, at: RING1, s: "bell", o: { f: H(12), g: 0.45 }, pos: [0.25, 0.7, 0.9] },
    { b: 2, at: RING1 + 0.05, s: "shimmer", o: { f: H(24), g: 0.25 }, pos: [0.25, 0.7, 0.9] },
  ]
  {
    for (const m of mets) {
      const x = clamp(m.to.x / 400, -1, 1)
      const far = clamp(1 - Math.abs(m.to.z) / 1600, 0.15, 1)
      const pos: [number, number, number] = [x, -0.2, 0.2 + (1 - far) * 1.6]
      cues.push(m.big === 1 ? { b: 0, at: m.t, s: "crack", o: { f: 500, g: 0.8 }, pos } : { b: m.t < B0 ? 0 : 1, at: m.t < B0 ? m.t : m.t - B0, s: "thud", o: { f: 70 + 40 * far, g: 0.3 * far * m.big }, pos })
    }
    // stones ticking down ahead of the thing
    for (let i = 0; i < 9; i++) cues.push({ b: 1, at: 1.2 + 4 * Math.pow(i / 9, 0.7), s: "knap", o: { g: 0.2 + i * 0.03 }, pos: [0.3 + ((i * 37) % 10) / 20, 0.1, 1.2 - i * 0.1] })
    // fragments ticking as they close up, wherever each moonlet is in the sky
    for (let k = 1; k < NML; k++) {
      const pos: [number, number, number] = [clamp(-ML[k].th0, -1, 1), 0.6, 1]
      cues.push({ b: 2, at: RING0 + (RING1 - RING0) * ML[k].merge, s: "stone", o: { f: H(6 + k), g: 0.5 }, pos }, { b: 2, at: RING0 + (RING1 - RING0) * ML[k].merge + 0.03, s: "marimba", o: { f: H(6 + k), g: 0.35 }, pos })
    }
  }

  return {
    update,
    cues,
    warm: () => [{ scene: shadeScene, camera: cam, target: shadeT }, { scene, camera: cam, target: stage }, { pass: air, target: out }],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      if (shadeOn) {
        r.setRenderTarget(shadeT)
        r.render(shadeScene, cam)
      }
      r.setRenderTarget(stage)
      r.render(scene, cam)
      U.tS.value = stage.texture
      air.render(out)
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      titles(g, s, def, TITLES)
      const fadeOut = 1 - clamp(s.exit * 1.5)
      // the second headline keeps its verb for the hit
      if (s.beat === 1 || (s.beat === 2 && s.t < 0.4)) {
        const a = s.beat === 2 ? 1 - E.out2(clamp(s.t / 0.4)) : fadeOut
        const t = s.beat === 1 ? s.t : 1e3
        const sh = { color: TITLES.shadow!, blur: 28 }
        g.text("Something the size\nof Mars", TYPE.x, TYPE.y, { size: TYPE.head, font: "serif", color: TITLES.color, by: "word", style: "rise", p: clamp((t - 0.5) / 1.5), alpha: a, lh: 1.02, shadow: sh, track: -0.01 })
        const wM = g.measure("of Mars ", { size: TYPE.head, font: "serif", track: -0.01 })
        g.text("hits.", TYPE.x + wM, TYPE.y + TYPE.head * 1.02, { size: TYPE.head, font: "serif", color: TITLES.color, by: "line", style: "slam", p: clamp((t - T_HIT) / 0.16), alpha: a, shadow: sh, track: -0.01 })
        const sub = def.beats[1].sub
        if (sub) g.text(sub, TYPE.x + 4, TYPE.y + TYPE.head * 1.02 + TYPE.gap, { size: TYPE.sub, font: "mono", color: TITLES.color, style: "blur", by: "line", p: clamp((t - T_HIT - 2.9) / 0.9), alpha: a * 0.78, shadow: sh, track: 0.01 })
      }
      // labels that ride what they name
      if (s.beat === 1 && W.bodyOn > 0) {
        const a = clamp((W.theia - 0.2) * 5) * (1 - clamp((W.theia - 0.9) * 10))
        const x = W.bodyPx[0], y = W.bodyPx[1]
        if (a > 0 && y > 190 && x > 1020) {
          g.line(x, y, x - 70, y - 50, { color: "#ffffff", lw: 1.5, alpha: a * 0.7 })
          g.text("Theia", x - 78, y - 56, { size: 32, font: "mono", color: "#ffffff", align: "right", style: "type", by: "glyph", p: clamp((W.theia - 0.2) * 4), alpha: a * 0.9, track: 0.06, caret: false, shadow: { color: "rgba(0,0,0,0.95)", blur: 14 } })
        }
      }
      if (s.beat === 2 && W.moonOn > 0) {
        const x = W.moonPx[0] + W.moonPx[2] * 0.75, y = W.moonPx[1] - W.moonPx[2] * 0.75
        g.line(x, y, x + 60, y - 44, { color: "#ffffff", lw: 1.5, alpha: W.moonOn * 0.7 * fadeOut })
        g.text("the Moon", x + 68, y - 48, { size: 32, font: "mono", color: "#ffffff", style: "type", by: "glyph", p: W.moonOn, alpha: 0.9 * fadeOut, track: 0.06, caret: false, shadow: { color: "rgba(0,0,0,0.95)", blur: 14 } })
      }
    },
    hud: () => HUD,
    dispose() {
      disposeTree(scene)
      disposeTree(shadeScene)
      air.dispose()
    },
  }
}
