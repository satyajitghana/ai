// Scene 2, inflation: "First, space itself inflates."
//
// Idea. A machinist's steel rule on a black bench, its zero at a spark. The spark swells, and the
// rule keeps having to change its units: twenty-six clicks of ×10. Then it stops, the wall of
// fire goes past the lens, and what is left is hot gas with faint ripples in it.
//
// Story parameter. `n`, decades of growth, 0 to 26, from a closed-form click schedule (CLICK_T):
// every click is a little quicker than the one before. Then `hot`, 0 to 1, in the second beat.
// The light, the camera shake, the counter, the sound and the motion smear all read `n` and its
// rate; nothing is accumulated, so any moment can be rendered cold.
//
// World rule (TSL functions inside create(), with a JS twin where the CPU needs one).
//   Scaled space: the dome is kept the same size on screen and the units slip instead.
//   The mark for 10^k sits at x = X1 · 10^(k − 1 − m), where m is `n` less the first click (that
//   one is spent letting the spark itself swell to the first mark, so a click is seen for what
//   it is before the units start to move). Rule ticks, plaques, bench dust and motes all use it.
//   One light: the dome. `lightAt` lights the rule, the plaques, the bench and the dust;
//   `fire` is the dome itself and its mirror image in the bench and the steel; `airlight` is the
//   glow of the dusty air between the lens and everything, by the closed form for a point light.
//
// Camera. Above and beside the rule, the dome on the left third (its centre is held on DOT_AIM,
// where the template's full stop ended up), the rule running away to its vanishing point on the
// right. Shake follows the rate of growth. It is thrown back when the wall passes.
//
// The second beat stays in the same place: once the wall has passed the lens (`uIn`), the bench,
// the rule (now glowing and settling) and the last plaque are still there, inside the gas.
//
// The ripples. The gas is three depths of the shared field from engine/ui.ts. The far one, which
// is held still, is `ripples(p)` with p = (uv − .5) · vec2(16/9, 1) · RIPPLE_VIEW; scenes 4, 5 and
// 6 draw that same field. The two nearer depths are `ripples3` in world space, for parallax.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraProjectionMatrix, cameraViewMatrix, ceil, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, exp2, float, floor, Fn, fract, fwidth, If, length, log, Loop, max, min, mix as mixN, mod, normalGeometry, normalize, positionGeometry, pow, reflect, select, sin, smoothstep, sqrt, step, texture, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos, type Pos } from "../engine/synth"
import { DH, DW, type Type2D } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, fbm3, hash21, sampleRT, vnoise, voronoi, type F, type V2, type V3 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { RIPPLE_VIEW, ripples, ripples3, SELECT } from "../engine/ui"
import { DOT_AIM } from "../transitions/dot"

// ---------------------------------------------------------------- the click schedule
const N = 26
const T0 = 1.7 // the first click
const A0 = 0.58 // its length in seconds
const RR = 0.915 // every click takes this fraction of the one before
const clickT = (i: number) => T0 + (A0 * (1 - RR ** i)) / (1 - RR)
const CLICK_T = Array.from({ length: N + 1 }, (_, i) => clickT(i))
const T_END = CLICK_T[N]

/** Decades of growth at `t` seconds into the first beat. Early clicks ratchet; late ones run together. */
function decades(t: number) {
  if (t <= T0) return 0
  if (t >= T_END) return N
  const tau = Math.log(1 - ((t - T0) * (1 - RR)) / A0) / Math.log(RR)
  const i = Math.floor(tau)
  const u = tau - i
  return i + mix(E.out3(Math.min(1, u / 0.6)), u, smooth(3, 12, tau))
}
/** How many clicks have begun: the number the counter shows. */
function clicks(t: number) {
  if (t < T0) return 0
  if (t >= T_END) return N
  return Math.min(N, Math.floor(Math.log(1 - ((t - T0) * (1 - RR)) / A0) / Math.log(RR)) + 1)
}

// ---------------------------------------------------------------- the world's measurements
const X1 = 1.3 // where the mark that is "now" stands, in dome radii
const RULE_W = 1.1
const RULE_H = 0.055
const PLAQ = { hw: 0.36, top: 0.46, foot: 0.045, thick: 0.03, grow: 0.22 }
const CAM = { fov: 40, az: 45, el: 17, dist: 5.3 }
const ATLAS = { cols: 8, rows: 4, cw: 256, ch: 160 }
const MOTES = 1600

// the same measurements under the names the shaders use
const LN10 = 2.302585
const RW = RULE_W
const PW = PLAQ.hw
const PH = PLAQ.top
const FOOT = PLAQ.foot

/** GLSL `smoothstep(e0, e1, x)` with e0 > e1 (a falling edge) and node edges: WGSL leaves that case undefined. */
const fallStep = (e0: F, e1: F, x: F): F => {
  const t = clampN(x.sub(e0).div(e1.sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(CAM.fov, 16 / 9, 0.2, 4000)
  cam.rotation.order = "YXZ"
  const TAN0 = Math.tan((CAM.fov * Math.PI) / 360)
  let tanV = TAN0
  let tanH = (tanV * 16) / 9

  // ---------------------------------------------------------------- plaque print: "10" and a raised exponent
  const atlas = canvasTex(ATLAS.cols * ATLAS.cw, ATLAS.rows * ATLAS.ch, (c) => {
    c.fillStyle = "#000"
    c.fillRect(0, 0, ATLAS.cols * ATLAS.cw, ATLAS.rows * ATLAS.ch)
    c.fillStyle = "#fff"
    c.textBaseline = "alphabetic"
    for (let k = 1; k <= N; k++) {
      const x = ((k - 1) % ATLAS.cols) * ATLAS.cw
      const y = Math.floor((k - 1) / ATLAS.cols) * ATLAS.ch
      const ex = String(k)
      c.font = `400 104px ${ctx.fonts.tall}`
      const wb = c.measureText("10").width
      c.font = `400 60px ${ctx.fonts.tall}`
      const we = c.measureText(ex).width
      const x0 = x + (ATLAS.cw - (wb + 6 + we)) / 2
      c.font = `400 104px ${ctx.fonts.tall}`
      c.fillText("10", x0, y + 124)
      c.font = `400 60px ${ctx.fonts.tall}`
      c.fillText(ex, x0 + wb + 6, y + 78)
    }
  })
  atlas.colorSpace = THREE.NoColorSpace
  atlas.generateMipmaps = true
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  const tAtlas = texture(atlas)

  // Uniforms every material shares (the same nodes, so one write reaches them all).
  const U = {
    uM: uniform(0), // decades the units have slipped
    uRd: uniform(0.1), // radius of the dome
    uGlow: uniform(1), // its brightness: the scene's one emissive
    uT: uniform(0), // scene time
    uRate: uniform(0), // decades per second, for motion smear
    uLight: uniform(new THREE.Vector3()), // what the dome sends out
    uCam: uniform(new THREE.Vector3()),
    uIn: uniform(0), // 0 outside the dome, 1 once its wall has passed the lens
    uKeep: uniform(0), // second beat: the last plaque is left standing
    uRipK: uniform(0), // how far the ripples have come up
    // the lens, for rays through a full-screen triangle: forward, and right and up scaled by the field of view
    uCR: uniform(new THREE.Vector3()),
    uCU: uniform(new THREE.Vector3()),
    uCF: uniform(new THREE.Vector3()),
  }
  const { uM, uRd, uGlow, uT, uRate, uLight, uCam, uIn, uKeep, uRipK } = U

  // ---------------------------------------------------------------- the world rule, in TSL
  // (Only the pure functions carry a layout. With a layout on the ones that read a uniform, the
  // shaders of this scene failed to compile on three 0.187 ("nodeUniformN: undeclared identifier"
  // inside the emitted function), so anything that reads a uniform is inlined instead.)
  const NP = vec3(-0.78, 0, 0.62578) // a plaque faces the fire, turned a little to the lens
  const TP = vec3(0.62578, 0, 0.78)

  // scaled space: where the mark for 10^k stands, how big its plaque is, where the plaque's foot is
  const decadeX = Fn(([k]: [F]) => pow(10, clampN(k.sub(1).sub(uM), -3, 3.6)).mul(X1))
  const plaqueS = Fn(([x]: [F]) => pow(max(x, 0.05).div(X1), PLAQ.grow)).setLayout({ name: "plaqueS", type: "float", inputs: [{ name: "x", type: "float" }] })
  // on the bench, on the lens side of the rule
  const plaqueC = (x: F, s: F): V3 => vec3(x, 0, s.mul(0.3).add(RW * 0.5 + 0.16)) as V3
  const plaqueLive = Fn(([k, x]: [F, F]) => {
    const c = plaqueC(x, plaqueS(x) as F)
    const wall = smoothstep(0.8, 1.08, length(c.xz).div(uRd)).mul(smoothstep(0.3, 0.7, x.div(uRd)))
    return max(uKeep.mul(step(N - 0.5, k)), wall).mul(step(k.sub(1).sub(uM), 3.5)).mul(step(0.5, k)).mul(step(k, N + 0.5))
  })
  const atlasUV = (uv_: V2, k: F): V2 => {
    const i = k.sub(1)
    const cell = vec2(mod(i, ATLAS.cols), floor(i.div(ATLAS.cols)))
    const uv = clampN(uv_, 0.01, 0.99)
    return vec2(cell.x.add(uv.x).div(ATLAS.cols), cell.y.add(1).sub(uv.y).div(ATLAS.rows).oneMinus()) as V2
  }

  // one light
  // (the dome is a wide lamp, so it is placed part-way up, and it falls off a little slower than a point would)
  const lampPos = vec3(0, uRd.mul(0.55), 0)
  const lightAt = Fn(([P]: [V3]) => {
    const d = lampPos.sub(P).toVar()
    return uLight.div(pow(dot(d, d), 0.8).add(uRd.mul(uRd).mul(0.3)))
  })
  const heatCol = Fn(([t_]: [F]) => {
    const t = clampN(t_, 0, 1.5).toVar()
    const t2 = t.mul(t).toVar()
    return vec3(1, t.mul(0.14).add(t2.mul(0.5)), t2.mul(0.05).add(t2.mul(t2).mul(0.25)))
  }).setLayout({ name: "heatCol", type: "vec3", inputs: [{ name: "t", type: "float" }] })

  // the gas the lens ends up inside. "far" is the far depth of the ripple field (the caller frames it);
  // two nearer depths come from the same field in world space, and shafts fan out from where the spark was
  const gasCol = Fn(([T]: [F]) => heatCol(T).mul(T.mul(T).mul(1.9).add(0.45))).setLayout({ name: "gasCol", type: "vec3", inputs: [{ name: "T", type: "float" }] })
  const sparkDir = normalize(vec3(0, 0.4, 0).sub(uCam))
  const gasT = Fn(([rd, far]: [V3, F]) => {
    const od = sparkDir.toVar()
    const c = dot(rd, od).toVar()
    const b1 = normalize(cross(od, vec3(0, 1, 0))).toVar()
    const b2 = cross(od, b1).toVar()
    const e0 = vec2(dot(rd, b1), dot(rd, b2)).toVar()
    const e = e0.div(max(length(e0), 1e-4)).toVar()
    const sh = vnoise(e.mul(4).add(vec2(uT.mul(0.03), 1.7)) as V2).mul(0.6).add(vnoise(e.mul(11).add(vec2(4, uT.mul(-0.05))) as V2).mul(0.4)).toVar()
    const shaft = sh.mul(sh).mul(exp(c.oneMinus().mul(-2.4)))
    const near = ripples3(uCam.mul(0.12).add(rd.mul(1.1)).add(vec3(uT.mul(0.012), 0, 0)) as V3)
    const mid = ripples3(uCam.mul(0.05).add(rd.mul(2.1)).add(5) as V3)
    const T = uRipK.mul(far.sub(0.5).mul(0.55).add(mid.sub(0.5).mul(0.4)).add(near.sub(0.5).mul(0.28))).add(0.4).add(shaft.mul(0.8)).add(exp(c.oneMinus().mul(-9)).mul(0.45))
    return T
  })
  const gasSky = (rd: V3, far: F): V3 => gasCol(gasT(rd, far) as F) as V3
  const inGas = (col: V3, V: V3, dist: F): V3 =>
    mixN(col, gasCol(exp(dot(V, sparkDir).oneMinus().mul(-6)).mul(0.4).add(0.4) as F), uIn.mul(exp(dist.mul(-0.024)).oneMinus())) as V3
  // the rule after the wall has passed: white where the fire stood, red further out, breathing
  const ruleHeat = (x: F): V3 => gasCol(mixN(1.15, 0.26, smoothstep(0, 6, x)).add(sin(uT.mul(0.7).add(x.mul(0.6))).mul(0.05)) as F).mul(1.5).mul(uIn) as V3

  // the dome, seen along a ray: emission (premultiplied) and opacity. The bench cuts it at y = 0.
  const fire = Fn(([ro, rd]: [V3, V3]) => {
    const res = vec4(0).toVar()
    const R = uRd
    const b = dot(ro, rd).toVar()
    const h2 = b.mul(b).sub(dot(ro, ro).sub(R.mul(R))).toVar()
    // (once the wall has passed the lens the result is weighted by zero: the whole body is skipped)
    If(h2.greaterThan(0).and(uIn.lessThan(1)), () => {
      const h = sqrt(h2).toVar()
      const t0 = max(b.negate().sub(h), 0).toVar()
      const t1 = h.sub(b).toVar()
      If(rd.y.lessThan(0).and(ro.y.greaterThan(0)), () => {
        t1.assign(min(t1, ro.y.negate().div(rd.y)))
      })
      If(t1.greaterThan(t0), () => {
        const chord = t1.sub(t0).div(R.mul(2)).toVar()
        const pe = ro.add(rd.mul(t0)).div(R).toVar()
        const pm = ro.add(rd.mul(t0.add(t1)).mul(0.5)).div(R).toVar()
        const core = clampN(length(pm), 0, 1).oneMinus().toVar()
        // a boiling skin: warped noise rising and turning over
        const q = pe.mul(2.3).add(vec3(0, uT.mul(-0.42), uT.mul(0.13))).toVar()
        const n1 = fbm3(q.add(fbm3(q.mul(1.7).add(vec3(uT.mul(0.21))) as V3).mul(1.3)) as V3).toVar()
        const n2 = fbm3(pe.mul(7.5).add(vec3(uT.mul(0.5), uT.mul(-1.1), 0)) as V3).toVar()
        const dens = chord.mul(n1.mul(1.25).add(0.5)).add(n2.sub(0.5).mul(0.3).mul(chord)).toVar()
        // cells with dark lanes between them, filaments, and a brighter foot where it meets the bench
        const n3 = fbm3(pe.mul(4.2).add(vec3(0, uT.mul(-0.6), uT.mul(0.2))).add(n1.mul(2)) as V3).toVar()
        const lane = pow(max(abs(n3.mul(2).sub(1)).oneMinus(), 0), 3)
        const fil = pow(max(abs(n2.mul(2).sub(1)).oneMinus(), 0), 6)
        const foot = exp(max(pe.y, 0).mul(-7)).mul(step(0.001, t0))
        const heat = clampN(core.mul(1.05).add(n1.sub(0.5).mul(0.8)).sub(lane.mul(0.34)).add(fil.mul(0.3)).add(foot.mul(0.4)).add(0.16), 0, 1.4).toVar()
        // tongues: the skin is thinner in places, so the limb is ragged and never a clean circle
        const limb = smoothstep(0, 0.5, chord)
        dens.mulAssign(mixN(smoothstep(0.3, 0.7, n2.add(n1.sub(0.5).mul(0.4))).mul(1.5).add(0.25), 1, limb))
        const a = exp(dens.mul(dens).mul(-8)).oneMinus().toVar()
        const col = heatCol(heat).mul(heat.mul(heat).mul(heat).mul(10).add(1.1)).mul(uGlow)
        res.assign(vec4(col.mul(a), a).mul(uIn.oneMinus()))
      })
    })
    return res
  })

  // the glow of dusty air along a ray of length tEnd: the closed form for a point light in fog
  const airlight = Fn(([ro, rd, tEnd]: [V3, V3, F]) => {
    const a = vec3(0, uRd.mul(0.3), 0).sub(ro).toVar()
    const t0 = dot(a, rd).toVar()
    const h = sqrt(max(dot(a, a).sub(t0.mul(t0)), 0)).add(uRd.mul(0.4)).toVar()
    return uLight.mul(atan(tEnd.sub(t0).div(h)).add(atan(t0.div(h)))).div(h).mul(0.0065)
  })

  // the room: a dim cool wash from above, so that shadows are blue-grey and never black
  const room = Fn(([d]: [V3]) => {
    const up = smoothstep(-0.05, 0.7, d.y)
    const panel = smoothstep(0.72, 0.97, dot(d, normalize(vec3(0.35, 1, 0.3))))
    return vec3(0.012, 0.016, 0.026).mul(up.mul(0.65).add(0.35)).add(vec3(0.1, 0.13, 0.19).mul(panel)).mul(min(uGlow, 1))
  })

  // the shadows the standing plaques throw away from the fire, on any point below their tops
  const plaqueShadow = Fn(([P]: [V3]) => {
    const Lp = lampPos.toVar()
    const sh = float(1).toVar()
    const k0 = max(ceil(uM.add(0.585)), 1).toVar()
    Loop(4, ({ i }) => {
      const k = k0.add(float(i)).toVar()
      const x = decadeX(k).toVar()
      const s = plaqueS(x).toVar()
      const live = plaqueLive(k, x).toVar()
      If(live.greaterThan(0), () => {
        const c = plaqueC(x, s).toVar()
        const t = dot(c.sub(P), NP).div(dot(Lp.sub(P), NP)).toVar()
        If(t.greaterThan(0).and(t.lessThan(1)), () => {
          const Q = P.add(Lp.sub(P).mul(t)).toVar()
          const pen = length(Q.sub(P)).mul(0.09).add(0.012).toVar()
          const across = fallStep(s.mul(PW).add(pen) as F, s.mul(PW).sub(pen) as F, abs(dot(Q.sub(c), TP)) as F)
          const up = fallStep(s.mul(PH).add(pen) as F, s.mul(PH).sub(pen) as F, Q.y.sub(c.y) as F)
          sh.mulAssign(live.mul(0.94).mul(across).mul(up).mul(step(c.y.sub(0.01), Q.y)).oneMinus())
        })
      })
    })
    return sh
  })

  // satin steel under the one light
  const steel = Fn(([P, Nn, V, base, gloss]: [V3, V3, V3, V3, F]) => {
    const L = normalize(lampPos.sub(P)).toVar()
    const Li = lightAt(P).toVar()
    const ndl = max(dot(Nn, L), 0).toVar()
    const spec = pow(max(dot(Nn, normalize(L.sub(V))), 0), 60).mul(gloss)
    return base
      .mul(Li)
      .mul(ndl.mul(0.85).add(0.05))
      .add(Li.mul(spec).mul(ndl))
      .add(base.mul(room(Nn)).mul(1.6))
      .add(room(reflect(V, Nn)).mul(gloss).mul(0.5))
      .add(base.mul(gasCol(float(0.5))).mul(0.3).mul(uIn).mul(Nn.y.mul(0.4).add(0.6)))
  })
  // a plaque's face: black-filled engraving on brushed plate
  const plaqueFace = Fn(([uv, ink, P, V]: [V2, F, V3, V3]) => {
    const e = min(uv, uv.oneMinus()).toVar()
    const edge = min(e.x.mul(1.45), e.y)
    const frame = smoothstep(0.006, 0.016, abs(edge.sub(0.07))).oneMinus()
    const plate = vec3(0.6, 0.61, 0.64).mul(vnoise(vec2(uv.x.mul(5), uv.y.mul(230))).mul(0.32).add(0.8))
    const base = mixN(plate, vec3(0.014), max(ink, frame.mul(0.85)))
    return steel(P, NP, V, base, ink.oneMinus().mul(0.8))
  })

  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (vertex: THREE.Node | null, fragment: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }

  // ---------------------------------------------------------------- backdrop: only the glow in the air
  const camR = U.uCR.value
  const camU = U.uCU.value
  const camF = U.uCF.value
  const vNdc = positionGeometry.xy.toVarying("vNdc")
  // The gas behind everything is three layers of noise per pixel and has no detail finer than a few
  // pixels, so its temperature is drawn at half resolution (one channel) and only the colour ramp,
  // which is what bloom and the tone map see, is evaluated at full resolution.
  const skyRT = ctx.target({ scale: 0.5 })
  const tSky = uniformTexture(skyRT.texture)
  const sky = ctx.pass(({ uv }) => {
    const ndc = uv.mul(2).sub(1).toVar()
    const V = normalize(U.uCF.add(U.uCR.mul(ndc.x)).add(U.uCU.mul(ndc.y))).toVar()
    return vec4(gasT(V, ripples(ndc.mul(0.5).mul(vec2(16 / 9, 1)).mul(RIPPLE_VIEW) as V2)), 0, 0, 1)
  }, U)
  const bg = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)),
    mat(
      vec4(positionGeometry.xy, 1, 1),
      Fn(() => {
        const V = normalize(U.uCF.add(U.uCR.mul(vNdc.x)).add(U.uCU.mul(vNdc.y))).toVar()
        const col = vec3(0).toVar()
        // (below the horizon the bench is drawn over every pixel of this, so nothing is worked out there)
        If(V.y.greaterThan(-0.02), () => {
          col.assign(airlight(uCam, V, float(300)))
          col.addAssign(room(V).mul(0.45).mul(smoothstep(-0.02, 0.03, V.y))) // the room, barely
          If(uIn.greaterThan(0), () => {
            col.assign(mixN(col, gasCol(sampleRT(tSky, vNdc.mul(0.5).add(0.5) as V2).r), uIn))
          })
        })
        return vec4(col, 1)
      })(),
      { depthTest: false, depthWrite: false },
    ),
  )
  bg.frustumCulled = false
  bg.renderOrder = -10
  scene.add(bg)

  // ---------------------------------------------------------------- the bench
  // specks of dust that keep their look while the scale slips: octaves slide down in size and are replaced
  const dust = Fn(([p]: [V2]) => {
    const f = fract(uM.mul(3.321928)).toVar()
    const acc = float(0).toVar()
    Loop(5, ({ i }) => {
      const e = float(i).add(f).toVar()
      const w = sin(e.mul(3.14159 / 5)).toVar()
      const v = voronoi(p.mul(exp2(e.add(2.1))) as V2).toVar()
      acc.addAssign(w.mul(w).mul(fallStep(float(0.13), float(0.02), v.x)).mul(step(0.62, hash21(v.yz))))
    })
    return acc
  })

  const benchGeo = new THREE.PlaneGeometry(6000, 6000)
  benchGeo.rotateX(-Math.PI / 2)
  const benchW = positionGeometry.toVarying("vBenchW")
  const bench = new THREE.Mesh(
    benchGeo,
    mat(
      viewProj.mul(vec4(positionGeometry, 1)),
      Fn(() => {
        const P = vec3(benchW.x, 0, benchW.z).toVar()
        const Vv = P.sub(uCam).toVar()
        const dist = length(Vv).toVar()
        const V = Vv.div(dist).toVar()
        const rho = length(P.xz).toVar()
        const sp = dust(P.xz).mul(exp(dist.mul(-0.06))).toVar()
        // lacquer that is not quite flat: reflections run in streaks towards the lens
        const wob = vec2(vnoise(P.xz.mul(5)).sub(0.5), vnoise(P.xz.mul(5).add(31)).sub(0.5))
          .add(vec2(vnoise(P.xz.mul(23)).sub(0.5), vnoise(P.xz.mul(23).add(9)).sub(0.5)).mul(0.5))
          .toVar()
        const Nn = normalize(vec3(wob.x.mul(0.05), 1, wob.y.mul(0.022))).toVar()
        // the dome as an area light on the bench
        const hl = uRd.mul(0.55).toVar()
        const Ein = uLight.mul(hl).div(pow(rho.mul(rho).add(hl.mul(hl)), 1.5)).mul(1.7).toVar()
        const R = reflect(V, Nn).toVar()
        const sh = plaqueShadow(P).toVar()
        const mirA = float(0).toVar()
        const mir = vec3(0).toVar()
        const k0 = max(ceil(uM.add(0.585)), 1).toVar()
        Loop(4, ({ i }) => {
          const k = k0.add(float(i)).toVar()
          const x = decadeX(k).toVar()
          const s = plaqueS(x).toVar()
          const live = plaqueLive(k, x).toVar()
          If(live.greaterThan(0), () => {
            const c = plaqueC(x, s).toVar()
            const hw = s.mul(PW).toVar()
            const hh = s.mul(PH).toVar()
            // its mirror image
            const tr = dot(c.sub(P), NP).div(dot(R, NP)).toVar()
            If(tr.greaterThan(0).and(mirA.lessThan(0.01)), () => {
              const Q = P.add(R.mul(tr)).toVar()
              const a = dot(Q.sub(c), TP).toVar()
              const qy = Q.y.sub(c.y).toVar()
              const m = fallStep(hw.add(s.mul(0.012)) as F, hw.sub(s.mul(0.012)) as F, abs(a) as F)
                .mul(step(0, qy))
                .mul(fallStep(hh.add(s.mul(0.01)) as F, hh.sub(s.mul(0.01)) as F, qy))
                .toVar()
              If(m.greaterThan(0), () => {
                const uv = vec2(a.div(hw).mul(0.5).add(0.5), qy.sub(s.mul(FOOT)).div(hh.sub(s.mul(FOOT)))).toVar()
                const ink = select(uv.y.greaterThan(0), tAtlas.sample(atlasUV(uv, k)).level(float(1.2)).r, 0)
                mir.assign(plaqueFace(uv, ink, Q, R).mul(live))
                mirA.assign(m.mul(live).mul(exp(qy.div(s).mul(-0.9))))
              })
            })
          })
        })
        // the rule keeps the light off the bench beside it
        const ao = select(P.x.greaterThan(-0.04), smoothstep(-0.01, 0.16, abs(P.z).sub(RW * 0.5)), 1).toVar()
        sh.mulAssign(ao.mul(0.7).add(0.3))
        const f = fire(P.add(vec3(0, 0.002, 0)), R).toVar()
        const sky = airlight(P, R, float(60)).add(room(R).mul(0.45)).toVar()
        If(uIn.greaterThan(0), () => {
          sky.addAssign(gasSky(R, ripples(R.xz.mul(2).add(3) as V2)).mul(uIn))
        })
        const refl = f.rgb.add(f.a.oneMinus().mul(mixN(sky, mir, mirA)))
        const fr = pow(max(dot(V.negate(), Nn), 0).oneMinus(), 5).mul(0.96).add(0.04)
        const base = vec3(0.085, 0.088, 0.1)
        const col = base
          .mul(Ein)
          .mul(sh)
          .mul(sp.mul(5).add(1))
          .add(refl.mul(fr).mul(min(sp, 1).mul(0.6).oneMinus()).mul(ao.mul(0.55).add(0.45)))
          .toVar()
        // the hot rule lights the bench beside it
        col.addAssign(ruleHeat(P.x).mul(exp(max(abs(P.z).sub(RW * 0.5), 0).mul(-3.2))).mul(sp.mul(0.25).add(0.05)).mul(step(-0.04, P.x)))
        col.addAssign(airlight(uCam, V, dist))
        return vec4(inGas(col, V, dist), 1)
      })(),
      { depthTest: false, depthWrite: false },
    ),
  )
  bench.frustumCulled = false
  bench.renderOrder = -5
  scene.add(bench)

  // ---------------------------------------------------------------- the rule: a bevelled bar, x from under the dome to the horizon
  const ruleGeo = (() => {
    const w = RULE_W / 2
    const th = RULE_H
    const lip = 0.012
    const bev = 0.24
    // cross-section (z, y) and each face's normal (z, y)
    const pts: [number, number][] = [[-w, 0], [-w, th], [w - bev, th], [w, lip], [w, 0]]
    const bl = Math.hypot(bev, th - lip)
    const nrm: [number, number][] = [[-1, 0], [0, 1], [(th - lip) / bl, bev / bl], [1, 0]]
    // stations along its length, closer together near the zero, so it can settle when it is hot
    const xs = [-0.04]
    for (let x = 0.12; x < 900; x *= 1.14) xs.push(x)
    xs.push(900)
    const pos: number[] = []
    const nor: number[] = []
    const idx: number[] = []
    for (let f = 0; f < 4; f++) {
      const a = pts[f]
      const b = pts[f + 1]
      const o = pos.length / 3
      for (const x of xs) {
        pos.push(x, a[1], a[0], x, b[1], b[0])
        nor.push(0, nrm[f][1], nrm[f][0], 0, nrm[f][1], nrm[f][0])
      }
      for (let i = 0; i < xs.length - 1; i++) idx.push(o + i * 2, o + i * 2 + 2, o + i * 2 + 3, o + i * 2, o + i * 2 + 3, o + i * 2 + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setIndex(idx)
    return g
  })()
  // hot, it softens: it settles into the bench and creeps a little out of true
  const ruleP = (() => {
    const p = positionGeometry
    const sg = uIn.mul(smoothstep(0, 0.8, p.x))
    const y = p.y.mul(sg.mul(sin(p.x.mul(1.7)).mul(0.2).add(0.4)).oneMinus())
    const z = p.z
      .mul(sg.mul(0.07).mul(sin(p.x.mul(1.3).add(2))).add(1))
      .add(sg.mul(min(p.x.mul(0.25), 1)).mul(sin(p.x.mul(0.9).add(1)).mul(0.07).add(sin(p.x.mul(2.3)).mul(0.03))))
    return vec3(p.x, y, z)
  })()
  const ruleW = ruleP.toVarying("vRuleW")
  const ruleN = normalGeometry.toVarying("vRuleN")
  // coverage of an engraved line of half-width w at distance d, for a pixel footprint fw
  // (a line thinner than a pixel and a half is drawn that wide and fainter, never thinner)
  const tick = Fn(([d, w, fw]: [F, F, F]) => {
    const ww = max(w, fw.mul(0.75)).toVar()
    return clampN(ww.sub(d).div(fw).add(0.5), 0, 1).mul(min(1, w.mul(1.5).div(ww)))
  }).setLayout({ name: "tick", type: "float", inputs: [{ name: "d", type: "float" }, { name: "w", type: "float" }, { name: "fw", type: "float" }] })
  const rule = new THREE.Mesh(
    ruleGeo,
    mat(
      viewProj.mul(vec4(ruleP, 1)),
      Fn(() => {
        const P = ruleW
        const Nn = normalize(ruleN).toVar()
        const Vv = P.sub(uCam).toVar()
        const dist = length(Vv).toVar()
        const V = Vv.div(dist).toVar()
        const x = max(P.x, 1e-3).toVar()
        const u = log(x.div(X1)).div(LN10).add(1).add(uM).toVar() // decades along the rule: whole numbers are the plaques
        // footprint of a pixel along the rule, plus what the shutter smears while the units slip
        const fw = max(length(vec2(dFdx(P.x), dFdy(P.x))), 1e-5).add(abs(uRate).mul(x).mul(LN10 * 0.0035)).toVar()
        const v = pow(10, fract(u)).toVar() // mantissa, 1 to 10
        const sc = x.div(v).toVar() // metres per unit of mantissa
        const zq = P.z.negate().add(RW * 0.5).div(RW).toVar() // 0 on the bevelled edge, 1 at the back
        const fz = fwidth(zq).add(1e-5).toVar()
        const reach = (len: F) => smoothstep(len.sub(fz), len.add(fz), zq).oneMinus()
        const m = float(0).toVar()
        If(Nn.y.greaterThan(0.3), () => {
          // whole numbers, the decade mark longest
          const iv = floor(v.add(0.5)).toVar()
          const d = abs(v.sub(iv)).mul(sc)
          const dec = iv.lessThan(1.5).or(iv.greaterThan(9.5))
          const five = abs(iv.sub(5)).lessThan(0.5)
          const t1 = tick(d, select(dec, float(0.075), select(five, float(0.05), float(0.04))), fw)
          m.assign(t1.mul(max(reach(select(dec, float(0.82), select(five, float(0.6), float(0.48))) as F), select(dec, reach(float(0.9)).oneMinus(), float(0)))))
          // tenths, then hundredths, each only where it has room
          const s1 = sc.mul(0.1).toVar()
          const i1 = floor(v.mul(10).add(0.5)).toVar()
          m.assign(max(m, smoothstep(2.2, 4, s1.div(max(fw, 0.026))).mul(tick(abs(v.mul(10).sub(i1)).mul(s1), float(0.024), fw)).mul(reach(select(mod(i1, 5).lessThan(0.5), float(0.4), float(0.3)) as F))))
          const s2 = sc.mul(0.01).toVar()
          const i2 = floor(v.mul(100).add(0.5)).toVar()
          m.assign(max(m, smoothstep(2.2, 4, s2.div(max(fw, 0.013))).mul(tick(abs(v.mul(100).sub(i2)).mul(s2), float(0.012), fw)).mul(reach(select(mod(i2, 5).lessThan(0.5), float(0.22), float(0.15)) as F))))
          // a scribed line along the back edge
          m.assign(max(m, tick(abs(zq.sub(0.955)).mul(RW), float(0.006), fz.mul(RW))))
        })
        // brushed along its length; the grain rides with the ticks
        const grain = vnoise(vec2(u.mul(240), P.z.mul(60))).mul(0.6).add(vnoise(vec2(u.mul(820), P.z.mul(230))).mul(0.4)).toVar()
        const base = mixN(vec3(0.7, 0.71, 0.74).mul(grain.mul(0.4).add(0.8)), vec3(0.008, 0.008, 0.01), m).toVar()
        const Nb = normalize(Nn.add(vec3(0, 0, grain.sub(0.5).mul(0.42)))).toVar()
        const col = steel(P, Nb, V, base, m.oneMinus().mul(0.55)).mul(mixN(0.25, 1, plaqueShadow(P))).toVar()
        // the fire, mirrored in the polished face
        const R = reflect(V, Nb).toVar()
        const f = fire(P.add(Nn.mul(0.002)), R).toVar()
        const fr = pow(max(dot(V.negate(), Nn), 0).oneMinus(), 4).mul(0.78).add(0.22)
        col.addAssign(f.rgb.mul(0.4).add(f.a.oneMinus().mul(airlight(P, R, float(40)).add(room(R).mul(0.4)))).mul(fr).mul(m.oneMinus()).mul(grain.mul(0.8).add(0.6)))
        // it runs into the fire and glows where it does
        const near = fallStep(float(1.5), float(0.98), x.div(uRd) as F).toVar()
        col.addAssign(heatCol(near.mul(0.5).add(0.35)).mul(near).mul(near).mul(2.4).mul(uGlow).mul(uIn.oneMinus()))
        // inside the gas it glows of itself, and the engraving stays dark on it
        col.assign(mixN(col, col.mul(0.25).add(ruleHeat(x).mul(grain.mul(0.6).add(0.7)).mul(m.mul(0.8).oneMinus()).mul(Nn.y.mul(0.45).add(0.55))), uIn))
        col.addAssign(airlight(uCam, V, dist))
        return vec4(inGas(col, V, dist), 1)
      })(),
      { side: THREE.DoubleSide },
    ),
  )
  // (static geometry with a true bounding sphere, so it is the one mesh here that can be culled;
  // everything else is placed in the vertex stage and must not be)
  scene.add(rule)

  // ---------------------------------------------------------------- plaques: one per decade, instanced
  const plaqueGeo = (() => {
    const plate = new THREE.BoxGeometry(PLAQ.hw * 2, PLAQ.top - PLAQ.foot, PLAQ.thick)
    plate.translate(0, (PLAQ.top + PLAQ.foot) / 2, 0)
    const foot = new THREE.BoxGeometry(PLAQ.hw * 1.5, PLAQ.foot, 0.2)
    foot.translate(0, PLAQ.foot / 2, 0)
    const g = new THREE.InstancedBufferGeometry()
    const pos: number[] = []
    const nor: number[] = []
    const idx: number[] = []
    for (const b of [plate, foot]) {
      const o = pos.length / 3
      pos.push(...(b.getAttribute("position").array as Float32Array))
      nor.push(...(b.getAttribute("normal").array as Float32Array))
      for (const i of b.getIndex()!.array as Uint16Array) idx.push(i + o)
      b.dispose()
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setIndex(idx)
    g.setAttribute("aK", new THREE.InstancedBufferAttribute(Float32Array.from({ length: N }, (_, i) => i + 1), 1))
    g.instanceCount = N
    return g
  })()
  const PQ = (() => {
    const aK = attribute("aK", "float") as F
    const x = decadeX(aK) as F
    const s = plaqueS(x) as F
    const live = plaqueLive(aK, x)
    const p = positionGeometry.mul(s).mul(vec3(1, live.mul(0.9).add(0.1), 1)) // it slumps as the wall takes it
    const w = plaqueC(x, s).add(TP.mul(p.x)).add(vec3(0, p.y, 0)).add(NP.mul(p.z))
    const n = TP.mul(normalGeometry.x).add(vec3(0, normalGeometry.y, 0)).add(NP.mul(normalGeometry.z))
    return {
      clip: select(live.greaterThan(0.03), viewProj.mul(vec4(w, 1)), vec4(2, 2, 2, 1)),
      vW: w.toVarying("vPlaqW"),
      vN: n.toVarying("vPlaqN"),
      vL: positionGeometry.toVarying("vPlaqL"),
      vNl: normalGeometry.toVarying("vPlaqNl"),
      vK: aK.toVarying("vPlaqK"),
      vLive: live.toVarying("vPlaqLive"),
    }
  })()
  const plaques = new THREE.Mesh(
    plaqueGeo,
    mat(
      PQ.clip,
      Fn(() => {
        const { vW, vN, vL, vNl, vK, vLive } = PQ
        const Vv = vW.sub(uCam).toVar()
        const dist = length(Vv).toVar()
        const V = Vv.div(dist).toVar()
        const col = vec3(0).toVar()
        const uv = vec2(vL.x.div(2 * PW).add(0.5), vL.y.sub(FOOT).div(PH - FOOT)).toVar()
        const ink = tAtlas.sample(atlasUV(uv, vK as F)).r.toVar()
        const face = vNl.z.greaterThan(0.5).toVar()
        If(face.and(vL.y.greaterThan(FOOT)), () => {
          col.assign(plaqueFace(uv, ink, vW, V))
        }).Else(() => {
          col.assign(steel(vW, normalize(vN), V, vec3(0.42, 0.43, 0.46), float(0.4)))
        })
        const inkOn = ink.mul(step(0.5, vNl.z)).toVar()
        // it heats from the foot as the wall comes
        const near = fallStep(float(1.55), float(0.95), vW.x.div(uRd) as F).toVar()
        col.addAssign(heatCol(near.mul(0.6).add(0.3)).mul(near).mul(near).mul(vL.y.div(PH).oneMinus().mul(2.5).add(0.5)).mul(uGlow).mul(inkOn.mul(0.9).oneMinus()).mul(uIn.oneMinus()))
        col.assign(mixN(heatCol(float(0.7)).mul(2.5).mul(uGlow), col, vLive))
        // inside the gas: a dark plate against the glow, hot along its edges and at its foot
        const e2 = min(uv, uv.oneMinus()).toVar()
        const edge = exp(max(min(e2.x.mul(1.45), e2.y), 0).mul(-24)).add(exp(max(vL.y, 0).div(PH).mul(-7)).mul(0.5))
        col.assign(mixN(col, col.mul(0.07).add(gasCol(float(0.95)).mul(2.2).mul(edge).mul(sin(uT.mul(0.9)).mul(0.15).add(0.85)).mul(inkOn.mul(0.8).oneMinus())), uIn))
        col.addAssign(airlight(uCam, V, dist))
        return vec4(inGas(col, V, dist), 1)
      })(),
    ),
  )
  plaques.frustumCulled = false
  scene.add(plaques)

  // ---------------------------------------------------------------- the dome
  const domeW = positionGeometry.mul(uRd).mul(1.03)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    mat(viewProj.mul(vec4(domeW, 1)), fire(uCam, normalize(domeW.toVarying("vDomeW").sub(uCam))), {
      side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  )
  dome.frustumCulled = false
  dome.renderOrder = 5
  scene.add(dome)

  // ---------------------------------------------------------------- motes: dust in the air, drawn into the fire
  const moteGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const r = rng(2026)
    const seed = new Float32Array(MOTES * 4)
    for (let i = 0; i < seed.length; i++) seed[i] = r()
    g.setAttribute("aS", new THREE.InstancedBufferAttribute(seed, 4))
    g.instanceCount = MOTES
    return g
  })()
  const MT = (() => {
    const aS = attribute("aS", "vec4")
    // 3.4 decades of radius, wrapped: a mote that reaches the fire comes back in at the horizon
    const u = mod(aS.x.mul(3.4).sub(uM), 3.4).sub(0.25)
    const rho = pow(10, u)
    const th = aS.y.mul(6.28318).add(sin(uT.mul(0.17).add(aS.z.mul(40))).mul(0.2))
    const hgt = aS.z.mul(aS.z).mul(aS.z).mul(1.1).add(0.02).mul(pow(rho, 0.85)).add(rho.mul(0.03).mul(sin(uT.mul(aS.w.mul(0.5).add(0.2)).add(aS.x.mul(60)))))
    const c = vec3(rho.mul(cos(th)), hgt, rho.mul(sin(th)))
    const size = aS.w.mul(aS.w).mul(0.008).add(0.0035).mul(pow(rho, 0.8))
    const vc0 = cameraViewMatrix.mul(vec4(c, 1))
    // stretched along its path into the fire by the shutter
    const dir = normalize(cameraViewMatrix.mul(vec4(normalize(c.add(1e-4)), 0)).xy.add(vec2(1e-5, 0)))
    const perp = vec2(dir.y.negate(), dir.x)
    const smear = abs(uRate).mul(rho).mul(LN10 * 0.012)
    const q = positionGeometry.xy
    const off = dir.mul(dot(q, dir)).mul(size.add(smear)).add(perp.mul(dot(q, perp)).mul(size))
    const vc = vec4(vc0.xy.add(off), vc0.z, vc0.w)
    const far = fallStep(float(3.1), float(2.4), u as F)
    const keep = mixN(smoothstep(0.85, 1.2, rho.div(uRd)).mul(far), far.mul(smoothstep(0.2, 0.6, length(vc.xyz))), uIn)
    // outside they are dust in the dome's light; inside the gas they are embers
    const vC = mixN(lightAt(c).mul(1.3), gasCol(float(1.05)).mul(sin(uT.mul(aS.z.mul(3).add(1)).add(aS.x.mul(90))).mul(0.8).add(1.2)), uIn)
      .mul(aS.w.add(0.5))
      .mul(keep)
      .mul(size)
      .div(size.add(smear))
    return { clip: cameraProjectionMatrix.mul(vc), vQ: q.toVarying("vMoteQ"), vC: vC.toVarying("vMoteC") }
  })()
  const motes = new THREE.Mesh(
    moteGeo,
    mat(MT.clip, vec4(MT.vC.mul(max(exp(dot(MT.vQ, MT.vQ).mul(-3.2)).sub(0.04), 0)), 1), {
      depthTest: true, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    }),
  )
  motes.frustumCulled = false
  motes.renderOrder = 6
  scene.add(motes)

  // ---------------------------------------------------------------- the last pass: the wall goes by and leaves hot gas
  const G = { tA: uniformTexture(stage.texture), uWash: uniform(0), uT2: uniform(0), uAim: uniform(new THREE.Vector2(DOT_AIM[0], DOT_AIM[1])) }
  const gas = ctx.pass(({ uv, res }) => {
    const st = sampleRT(G.tA, uv).rgb.toVar()
    const o = vec3(st).toVar()
    If(G.uWash.greaterThan(0), () => {
      // while the wall is going by, flame streams outward from where the dome stood
      const away = uv.sub(G.uAim).mul(vec2(res.x.div(res.y), 1)).toVar()
      const rush = fbm(away.mul(3.2).div(length(away).add(0.25)).sub(normalize(away.add(1e-4)).mul(G.uT2).mul(1.6)).add(7) as V2).sub(0.5)
      const T = exp(dot(away, away).mul(-1.6)).mul(0.4).add(0.82).add(rush.mul(0.8)).toVar()
      o.assign(mixN(st, heatCol(T).mul(T.mul(T).mul(2.6).add(0.9)), G.uWash))
    })
    return vec4(o, 1)
  }, G)

  // ---------------------------------------------------------------- this frame's numbers
  const W = {
    n: 0, rate: 0, m: 0, rd: 0.1, ign: 1, hot: 0, gasMix: 0, t0: 0,
    selX: 0, selY: 0, selW: 0, selH: 0,
  }
  const tmp = new THREE.Vector3()
  const AX0 = DOT_AIM[0] * 2 - 1
  const AY0 = DOT_AIM[1] * 2 - 1
  const AIM1 = [-0.69, -0.6] // where the dome's centre goes once it is too big to see whole
  const WHIP = [-1.0, -0.62] // ...after the whip to the last plaque
  const REST = [-0.6, -0.42] // ...and inside the gas, framed on the hot rule

  /** Point the camera so that world point (0, ty, 0) lands on clip point (AX, AY), with no roll. */
  function aim(ty: number, AX: number, AY: number) {
    const UL = Math.hypot(AX * tanH, AY * tanV, 1)
    const dx = -cam.position.x
    const dy = ty - cam.position.y
    const dz = -cam.position.z
    const L = Math.hypot(dx, dy, dz)
    const xc = (L * AX * tanH) / UL
    const zc = Math.sqrt(Math.max(1e-6, dx * dx + dz * dz - xc * xc))
    const yaw = Math.atan2(dx, -dz) - Math.atan2(xc, zc)
    const pitch = Math.atan2(dy, zc) - Math.atan2(AY * tanV, 1)
    cam.rotation.set(pitch, -yaw, 0)
  }

  // reused every frame: the post settings, the title options and the corner clock's colour
  const LIFT: [number, number, number] = [0, 0, 0]
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.62, bloomThresh: 0.95, bloomRadius: 0.9, halation: 0.55, vignette: 0.34, ca: 0.0012, sat: 1.08, contrast: 1.1, lift: LIFT, gain: [1.02, 1, 0.975], grain: 0.03 }
  const TITLES: TitleOpts = { color: "#ffffff", shadow: "rgba(0,0,0,0.75)", delay: [0.35, 2.6] }
  const HUD = { color: "#ffffff", shadow: "rgba(0,0,0,0.6)" }

  const softplus = (x: number) => (x > 6 ? x : Math.log(1 + Math.exp(6 * x)) / 6)

  // ---------------------------------------------------------------- sound (sheet: beats/sound-inflation.md)
  // Home harmonic 4. Every click is heard at the plaque the fire is swallowing (in scaled space
  // that is always the one at the dome's edge, beside the rule), one harmonic above the last.
  const edge = { x: 1, y: 0.2, z: RULE_W * 0.5 + 0.46 }
  const atEdge = (): Pos => {
    edge.x = clamp(W.rd, 0.05, 1.05)
    return listenerPos(edge, cam)
  }
  const atBox = (): Pos => [((W.selX + W.selW / 2) / DW) * 2 - 1, 1 - ((W.selY + W.selH / 2) / DH) * 2, 0.15]
  const cues: Cue[] = [
    ...CLICK_T.slice(0, N).flatMap((at, i): Cue[] => [
      { b: 0, at, s: "tick", o: { f: H(60 + i), g: 0.5 + i * 0.012, wet: 1 + i * 0.06 }, pos: atEdge },
      { b: 0, at, s: "marimba", o: { f: H(6 + i), g: 0.32 + i * 0.008 }, pos: atEdge },
    ]),
    // the big moment: it stops. The deep drop on the LFE, the last plaque rung once, then quiet
    { b: 0, at: T_END + 0.02, s: "sub", o: { f: H(2), dur: 2.4, g: 1, lfe: 1 }, pos: atEdge },
    { b: 0, at: T_END + 0.02, s: "thud", o: { f: H(3), g: 0.5 }, pos: atEdge },
    { b: 0, at: T_END + 0.04, s: "bell", o: { f: H(32), g: 0.25 }, pos: atEdge },
    // the whip to the mark it stopped at, and the deck's selection box landing on it
    { b: 0, at: T_END + 0.1, s: "whoosh", o: { f: H(8), dur: 0.5, g: 0.35 } },
    { b: 0, at: T_END + 0.5, s: "select", o: { f: H(32), g: 1.2 }, pos: atBox },
    // second beat: the dome is let go and its wall goes past the lens (it peaks at 1.9 s)
    { b: 1, at: 0.5, s: "rumble", o: { f: H(2), dur: 3, g: 0.9 } },
    { b: 1, at: 1.1, s: "whoosh", o: { f: H(3), dur: 1.7, g: 0.9 } },
    { b: 1, at: 1.88, s: "sub", o: { f: H(2), dur: 1.4, g: 0.45, lfe: 0.8 } },
    // the gas, and the ripples coming up in it
    { b: 1, at: 2.4, s: "shimmer", o: { f: H(48), dur: 3, g: 0.35 } },
    { b: 1, at: 2.6, s: "pad", o: { f: H(4), dur: 7, g: 0.75 } },
    { b: 1, at: 2.6, s: "pad", o: { f: H(6), dur: 7, g: 0.45 } },
  ]

  function update(s: State) {
    const t0 = clamp(s.at(0), -10, 100)
    W.t0 = t0
    W.n = decades(t0)
    W.rate = (decades(t0 + 0.02) - decades(t0 - 0.06)) / 0.08
    W.m = softplus(W.n - 1)
    // second beat: the dome is let go
    W.hot = s.k(1, 0.5, 2.5, E.in3)
    W.rd = Math.pow(10, W.n - 1 - W.m) * Math.exp(W.hot * Math.log(70))
    // the spark lights part-way through the hand-off out of the full stop
    // the spark lights when this beat's clock starts: the hand-off lands its ignition there (inAt)
    W.ign = smooth(-0.03, 0.03, t0)
    const flash = t0 >= 0 ? Math.exp(-t0 * 4) : 0

    const flick = 1 + 0.06 * Math.sin(s.time * 31) * Math.sin(s.time * 7.7) + 0.04 * Math.sin(s.time * 53)
    const pulse = Math.min(W.rate, 14) * 0.05
    const glow = W.ign * flick * (0.8 + pulse + 2.4 * flash + 0.25 * smooth(0, 1, W.n)) * (1 + 0.5 * s.k(0, T_END, T_END + 0.12, E.out2) * (1 - s.k(0, T_END + 0.12, T_END + 1.4, E.out2)))
    U.uGlow.value = glow
    U.uLight.value.set(1, 0.5, 0.2).multiplyScalar(7.5 * glow * clamp(W.rd * 0.55 + 0.45, 0, 2.5))
    U.uM.value = W.m
    U.uRd.value = W.rd
    U.uT.value = s.time
    U.uRate.value = W.rate

    // camera, one move per phase:
    //   a push toward the spark as it lights; back as the dome fills out; then closing in until the
    //   dome is cropped by the frame, with the lens going wide as the clicks run together (a dolly
    //   zoom: the dome holds its size and the rule's far end rushes away); a whip to the plaque it
    //   stopped at; thrown back by the wall; then a slow push along the hot rule for as long as
    //   the slide is held.
    const grow = smooth(0, 2.2, W.n)
    const big = smooth(1.2, 8, W.n)
    const t1 = clamp(s.at(1), 0, 60)
    const settle = s.k(1, 0.6, 3.2, E.io3)
    const fov = mix(mix(CAM.fov, 58, smooth(8, 24, W.n)), 46, settle)
    tanV = Math.tan((fov * Math.PI) / 360)
    tanH = (tanV * 16) / 9
    cam.fov = fov
    cam.updateProjectionMatrix()
    const push = mix(4.95, 4.35, E.out3(clamp(t0 / 1.6)))
    const dist = (mix(mix(push, CAM.dist, grow), 2.95, big) * TAN0) / tanV + 2.0 * s.k(1, 0.6, 3, E.io2) - 0.02 * t1
    const az = ((CAM.az - 3.5 * (W.n / N)) * Math.PI) / 180 + s.mouse.x * 0.02 + 0.006 * Math.sin(s.time * 0.31) + 0.004 * Math.sin(s.time * 0.53 + 1)
    const el = (CAM.el * Math.PI) / 180 + s.mouse.y * 0.012 + 0.004 * Math.sin(s.time * 0.37 + 2)
    cam.position.set(-dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az))
    const whip = s.k(0, T_END + 0.1, T_END + 0.62, E.outBack)
    const ax = mix(mix(mix(AX0, AIM1[0], big), WHIP[0], whip), REST[0], settle)
    const ay = mix(mix(mix(AY0, AIM1[1], big), WHIP[1], whip), REST[1], settle)
    aim(0.04, ax, ay)
    const wall = s.k(1, 0.9, 1.9, E.in2) * (1 - s.k(1, 1.9, 3.4, E.out2))
    const amp = 0.0007 + 0.0011 * Math.min(W.rate, 14) + 0.014 * flash + 0.02 * wall + 0.012 * s.k(0, T_END, T_END + 0.05) * (1 - s.k(0, T_END + 0.05, T_END + 0.9, E.out3))
    // (engine/stage.ts `shake(s.time, amp, 2.6)`, written out so no array is made each frame)
    const ts = s.time * 2.6
    cam.rotation.x += amp * (Math.sin(ts * 7.13) * 0.5 + Math.sin(ts * 12.71 + 1.3) * 0.3 + Math.sin(ts * 23.9 + 4.1) * 0.2)
    cam.rotation.y += amp * (Math.sin(ts * 8.31 + 2.1) * 0.5 + Math.sin(ts * 14.37 + 0.4) * 0.3 + Math.sin(ts * 27.1 + 3.3) * 0.2)
    cam.rotation.z = amp * (Math.sin(ts * 6.07 + 5.2) * 0.5 + Math.sin(ts * 11.3 + 2.2) * 0.5) * 0.5
    cam.updateMatrixWorld()
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    U.uCam.value.copy(cam.position)
    const e = cam.matrixWorld.elements
    camR.set(e[0], e[1], e[2]).multiplyScalar(tanH)
    camU.set(e[4], e[5], e[6]).multiplyScalar(tanV)
    camF.set(-e[8], -e[9], -e[10])

    // the wall passing the lens
    W.gasMix = smooth(0.75 * dist, 1.3 * dist, W.rd)
    U.uIn.value = W.gasMix
    // once the wall has passed, the dome draws nothing (fire() is weighted by 1 - uIn)
    dome.visible = W.gasMix < 1
    U.uKeep.value = s.beat >= 1 ? 1 : 0
    // the ripples come up, then go on growing very slowly for as long as the slide is held
    U.uRipK.value = s.k(1, 2.4, 5, E.io3) * (1 + 0.3 * smooth(5, 50, t1))
    gas.u.uAim.value.set(ax * 0.5 + 0.5, ay * 0.5 + 0.5)

    // the selection box on the plaque the growth stopped at (a JS twin of plaqueC)
    const cx = X1 * Math.pow(10, clamp(N - 1 - W.m, -3, 3.6))
    const sc = Math.pow(Math.max(cx, 0.05) / X1, PLAQ.grow)
    const cz = RULE_W * 0.5 + 0.16 + 0.3 * sc
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (let i = 0; i < 4; i++) {
      const a = (i & 1 ? 1 : -1) * PLAQ.hw * sc
      tmp.set(cx + 0.62578 * a, i & 2 ? PLAQ.top * sc : 0, cz + 0.78 * a).project(cam)
      const px = (tmp.x * 0.5 + 0.5) * DW
      const py = (0.5 - tmp.y * 0.5) * DH
      x0 = Math.min(x0, px)
      x1 = Math.max(x1, px)
      y0 = Math.min(y0, py)
      y1 = Math.max(y1, py)
    }
    W.selX = x0 - 14
    W.selY = y0 - 14
    W.selW = x1 - x0 + 28
    W.selH = y1 - y0 + 28

    // sound: the dome is a bed that follows the rate of growth (silent until the spark lights, and
    // falling away when the growth stops), with its pops over it; the wall passing is the wind
    if (s.live) {
      const r = Math.min(W.rate, 16) / 16
      ctx.synth.bed("fire", clamp(W.ign * (0.12 + 0.75 * r) + W.hot * 0.8 * (1 - 0.6 * s.k(1, 2.5, 6)) + 0.2 * s.k(1, 2, 5)))
      ctx.synth.bed("crackle", clamp(W.ign * (0.08 + 0.6 * r) * (1 - W.hot)))
      // (only while the wall is passing: on the way in, the wind belongs to the fall through the full stop)
      if (wall > 0) ctx.synth.bed("wind", clamp(0.7 * wall))
    }
  }

  /** The hero counter: "× 10" with a raised exponent that slams on every click. */
  function counter(g: Type2D, s: State) {
    const show = s.k(0, 0.9, 1.5, E.out3) * (1 - s.k(1, 0.2, 1.1, E.io2))
    if (show <= 0) return
    const e = clicks(W.t0)
    const since = e > 0 ? W.t0 - CLICK_T[e - 1] : 1
    const bx = DW - 340
    const by = DH - 150
    const color = "#fff3e2"
    const shadow = { color: "rgba(0,0,0,0.55)", blur: 30 }
    g.text("× 10", bx, by, { size: 210, font: "tall", color, align: "right", style: "rise", by: "line", p: s.k(0, 0.9, 1.5, E.out3), alpha: show, shadow })
    // the slam is short when the clicks are fast
    const p = e === 0 ? s.k(0, 1.05, 1.5, E.lin) : clamp(since / Math.min(0.22, A0 * RR ** (e - 1) * 0.8))
    g.text(String(e), bx + 14, by - 92, { size: 112, font: "tall", color, style: "slam", by: "line", ease: E.outBack, p, alpha: show, shadow })
  }

  return {
    cues,
    update,

    // what this scene draws, so the engine can compile it before it is shown
    warm: () => [{ pass: sky, target: skyRT }, { scene, camera: cam, target: stage }, { pass: gas, target: out }],

    render(s) {
      if (W.gasMix > 0) sky.render(skyRT)
      ctx.renderer.setRenderTarget(stage)
      ctx.renderer.render(scene, cam)
      // the wash is a copy of the stage whenever its weight is zero: then the stage goes straight to post
      const wash = s.k(1, 1.1, 1.9, E.in2) * (1 - s.k(1, 1.9, 3.3, E.io2))
      if (wash > 0) {
        gas.u.uWash.value = wash
        gas.u.uT2.value = s.time
        gas.render(out)
      }
      const rate = Math.min(W.rate, 14)
      const hot = W.gasMix
      POST.exposure = mix(1, 0.92, hot) + 0.22 * s.k(1, 1.2, 1.9, E.in2) * (1 - s.k(1, 1.9, 2.8, E.out2))
      POST.bloom = mix(0.62 + rate * 0.02, 0.5, hot)
      POST.bloomThresh = mix(0.95, 1.25, hot)
      POST.vignette = mix(0.34, 0.26, hot)
      POST.ca = 0.0012 + rate * 0.0003
      POST.contrast = mix(1.1, 1.06, hot)
      // blue-grey in the shadows once there is light; none before, so the frame meets the ink
      LIFT[0] = 0.002 * W.ign
      LIFT[1] = 0.004 * W.ign
      LIFT[2] = 0.009 * W.ign
      POST.grain = 0.03 * W.ign
      ctx.finish(wash > 0 ? out.texture : stage.texture, POST)
    },

    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      counter(g, s)
      // the deck's own selection box, on the mark where it stopped
      const a = s.k(0, T_END + 0.5, T_END + 0.62, E.lin) * (1 - s.k(1, 0, 0.3, E.lin))
      if (a > 0) {
        const pop = mix(0.86, 1, E.outBack(s.k(0, T_END + 0.5, T_END + 0.76, E.lin)))
        g.selbox(W.selX + (W.selW * (1 - pop)) / 2, W.selY + (W.selH * (1 - pop)) / 2, W.selW * pop, W.selH * pop, a, SELECT)
      }
    },

    // The clock stays out of the frame until the spark has lit, so the hand-off starts on plain black.
    hud: () => {
      HUD.color = W.ign >= 1 ? "#ffffff" : `rgba(255,255,255,${W.ign.toFixed(3)})`
      return HUD
    },

    dispose() {
      disposeTree(scene)
      atlas.dispose()
    },
  }
}
