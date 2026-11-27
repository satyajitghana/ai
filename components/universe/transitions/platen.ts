// 16 → 17. Platen.
//
// The outgoing frame is the forme. At p = 0 it fills the lens from straight above; the camera drops
// back and round to a low three-quarter view of a wooden screw press and the picture is a relief in
// type metal on the bed. The tympan's damp sheet swings down on its hinge at the far edge. The bar
// is pulled, the screw turns and the platen comes down out of the top of the frame: the slam, at
// PLATEN_IN, which is the incoming scene's clock zero (shake, a zoom ring, one pressure ripple, dust
// off the bed, the bar recoiling on a spring as the platen lifts). The bite then shows through the
// back of the damp sheet on a noisy front that starts at the centre of pressure and takes the
// paper's tooth and the darkest ink first. The tympan swings back up on its hinge with the sheet on
// it, the frisket lifts off, and the sheet is taken off by its near corner (the far side trailing
// and hanging from it, not rolled): its face carries the incoming scene as a black print, and it
// turns to the lens and fills the frame, where the ink resolves into the scene itself.
//
// What crosses the cut is the picture, as a print. Everything is closed-form in linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dot, exp, float, Fn, length, max, mix, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, select, sin, step, uniform, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, rng, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, hash21, luma, sampleRT, toSRGB, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const PLATEN_DUR = 2.6
/** The slam: `press`'s clock zero. */
export const PLATEN_IN = 0.5

const FOV = 30
const D0 = 1 / Math.tan((FOV * Math.PI) / 360) // a sheet of half-height 1 fills the frame from here
const REST = 5.4 // the platen's height at rest: above the lens's first position
const HO = 0.06 // the tympan's hinge stands this far beyond the sheet's far edge

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

/** A squared timber along x, its arrises chamfered by `c`. */
function beam(L: number, h: number, d: number, c = Math.min(h, d) * 0.09) {
  const s = new THREE.Shape()
  const a = d / 2 - c, b = h / 2 - c
  s.moveTo(-a, -b)
  s.lineTo(a, -b)
  s.lineTo(a, b)
  s.lineTo(-a, b)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(L - 2 * c, 1e-5), bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1, steps: 1, curveSegments: 1 })
  g.translate(0, 0, -(L - 2 * c) / 2)
  g.rotateY(Math.PI / 2)
  return g
}

const t: TransitionDef = {
  id: "platen",
  dur: PLATEN_DUR,
  inAt: PLATEN_IN,
  ease: E.lin,
  snd: [
    { s: "page", p: 0.11, o: { g: 0.5, pos: [0, 0.5, 0.4] } },
    { s: "flap", p: 0.33, o: { g: 0.4, f: 180, pos: [0, -0.1, 0.2] } },
    { s: "gear", p: 0.36, o: { g: 0.5, dur: 0.3, f: H(5), pos: [0.5, 0.6, 0.2] } },
    { s: "whoosh", p: 0.37, o: { g: 0.35, f: 160, dur: 0.4 } },
    { s: "thump", p: PLATEN_IN, o: { g: 1, pos: [0, -0.1, 0] } },
    { s: "sub", p: PLATEN_IN, o: { g: 0.9 } },
    { s: "thud", p: PLATEN_IN + 0.01, o: { g: 0.6, f: H(2), pos: [0, -0.3, 0] } },
    { s: "gear", p: PLATEN_IN + 0.05, o: { g: 0.3, dur: 0.35, f: H(7), pos: [0.6, 0.5, 0.2] } },
    { s: "scratch", p: 0.67, o: { g: 0.3, f: 260, dur: 0.5, pos: [-0.5, -0.4, 0] } },
    { s: "page", p: 0.84, o: { g: 0.7, pos: [0, 0, -0.2] } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(rt.texture),
      p: uniform(0),
      asp: uniform(16 / 9),
      h: uniform(REST), // the platen's underside
      alpha: uniform(1.9), // the tympan's angle
      fly: uniform(0),
      front: uniform(0), // radius of the ink front
      wet: uniform(0),
      camP: uniform(new THREE.Vector3()),
      camR: uniform(new THREE.Vector3(1, 0, 0)),
      camU: uniform(new THREE.Vector3(0, 0, -1)),
      camF: uniform(new THREE.Vector3(0, -1, 0)),
      u: uniform(-1), // seconds since the slam
    }
    const KEY = normalize(vec3(-0.5, 0.78, 0.36))
    const KEYC = vec3(0.96, 1.0, 1.1).mul(1.5)
    const AMB = vec3(0.105, 0.085, 0.07)
    const E1 = normalize(cross(KEY, vec3(0, 0, 1)))
    const E2 = cross(KEY, E1)
    /** The window: a leaded casement up and to the left. Its light falls as a pool crossed by the shadows of its bars. */
    const windowAt = (P: V3): F => {
      const a = dot(P, E1).add(0.2), b = dot(P, E2).sub(0.3)
      const pane = sstep(3.3, 2.5, abs(a)).mul(sstep(3.9, 3.0, abs(b)))
      const bar = (x: F): F => sstep(0.1, 0.2, abs(x.div(1.45).fract().sub(0.5)).mul(1.45)) as F
      return pane.mul(bar(a as F).mul(bar(b.add(0.5) as F)).mul(0.8).add(0.2)).mul(0.96).add(0.04) as F
    }
    /** How much of the sky the platen leaves a point on the bed: the gap darkens from the rim inward. */
    const occ = (P: V3): F => {
      const foot = sstep(0.25, -0.15, abs(P.x).sub(U.asp)).mul(sstep(0.25, -0.15, abs(P.z).sub(1)))
      return float(1).sub(foot.mul(0.86).mul(exp(max(U.h.sub(P.y), 0).mul(-1.5))).mul(step(P.y, U.h.add(0.01)))) as F
    }
    const lit = (alb: V3, N: V3, P: V3, gloss: Num = 0): V3 => {
      const o = occ(P)
      const w = windowAt(P)
      const V = normalize(U.camP.sub(P))
      const sp = pow(max(dot(N, normalize(KEY.add(V))), 0), 60).mul(gloss)
      return alb.mul(KEYC.mul(max(dot(N, KEY), 0)).mul(o).mul(w).add(AMB.mul(N.y.mul(0.35).add(0.65)).mul(o.mul(0.8).add(0.2)))).add(KEYC.mul(sp).mul(o).mul(w)) as V3
    }
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 80)
    const wide: THREE.Object3D[] = [] // scaled to the frame's aspect in x

    // ---- oak: bed, cheeks, head, platen, screw, bar, floor
    const oak = (tone: [number, number, number], axis: "x" | "y" | "z", thread = false) => {
      const m = new THREE.NodeMaterial()
      m.fragmentNode = Fn(() => {
        const q = positionLocal
        const along = axis === "x" ? q.x : axis === "y" ? q.y : q.z
        const across = axis === "x" ? vec2(q.y, q.z) : axis === "y" ? vec2(q.x, q.z) : vec2(q.x, q.y)
        const g = vnoise(vec2(along.mul(0.7), across.x.mul(13).add(across.y.mul(17)))).mul(0.55).add(vnoise(vec2(along.mul(3), across.x.mul(140).add(across.y.mul(110)))).mul(0.3)).add(sin(across.x.mul(31).add(across.y.mul(27)).add(vnoise(vec2(along.mul(0.9), across.x.mul(3))).mul(9))).mul(0.075).add(0.075))
        const alb = vec3(...tone).mul(g.mul(0.6).add(0.62)).toVar()
        const N = normalize(normalWorld).toVar()
        if (thread) {
          // a square thread cut in the wood: lit on its upper flank
          const th = sin(q.y.mul(26).add(q.x.atan(q.z).mul(2)))
          alb.mulAssign(sstep(-0.9, -0.2, th).mul(0.6).add(0.4))
          N.assign(normalize(N.add(vec3(0, th.mul(0.5), 0))))
        }
        return vec4(toSRGB(lit(alb as V3, N as V3, positionWorld as V3, 0.08)), 1)
      })()
      return m
    }
    /** Wrought iron: forge scale, rust where the damp sits, a polish where hands and the screw's nut have worn it. */
    const metal = (tone: [number, number, number]) => {
      const m = new THREE.NodeMaterial()
      m.fragmentNode = Fn(() => {
        const q = positionLocal
        const sc = fbm(vec2(q.x.add(q.z).mul(9), q.y.mul(9)))
        const rust = sstep(0.6, 0.78, fbm(vec2(q.x.add(q.z).mul(3), q.y.mul(3)).add(4)))
        const alb = mix(vec3(...tone).mul(sc.mul(0.6).add(0.65)), vec3(0.2, 0.085, 0.035), rust.mul(0.8))
        return vec4(toSRGB(lit(alb as V3, normalize(normalWorld) as V3, positionWorld as V3, mix(float(0.45), float(0.05), rust))), 1)
      })()
      return m
    }
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, isWide = false) => {
      const b = new THREE.Mesh(g, m)
      b.position.set(x, y, z)
      parent.add(b)
      if (isWide) wide.push(b)
      return b
    }
    const OAK: [number, number, number] = [0.3, 0.19, 0.1]
    const oakX = oak(OAK, "x"), oakY = oak([0.26, 0.16, 0.085], "y"), oakDark = oak([0.2, 0.125, 0.07], "x")
    const iron = metal([0.07, 0.068, 0.07])
    add(beam(2.5, 3, 2.9, 0.06), oakX, 0, -1.56, 0, scene, true) // the bed
    add(new THREE.BoxGeometry(200, 0.2, 200), oak([0.085, 0.06, 0.04], "z"), 0, -3.1, 0) // the floor
    add(new THREE.BoxGeometry(80, 40, 0.5), oak([0.07, 0.05, 0.035], "y"), 0, 12, -16) // the shop's far wall, panelled dark
    // the cheeks, each with the head's tenon through it, wedged, pegged, and an iron strap round the head beside it
    const cheeks = [-1, 1].map((sx) => {
      const g = new THREE.Group()
      scene.add(g)
      add(beam(12, 0.42, 0.7, 0.04).rotateZ(Math.PI / 2), oakY, 0, 3, -0.2, g)
      add(beam(0.32, 0.56, 0.46, 0.03), oakDark, sx * 0.36, 7.6, -0.2, g)
      add(beam(0.9, 0.07, 0.15, 0.012).rotateZ(Math.PI / 2), oakY, sx * 0.43, 7.6, -0.2, g)
      for (const y of [7.4, 7.8]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12).rotateX(Math.PI / 2), oakY, 0, y, 0.17, g)
      add(beam(0.08, 0.93, 0.93, 0.01), iron, -sx * 0.4, 7.6, -0.2, g)
      return g
    })
    add(beam(2.9, 0.9, 0.9, 0.06), oakDark, 0, 7.6, -0.2, scene, true) // the head
    add(beam(3.3, 0.3, 1.0, 0.04), oakDark, 0, 8.35, -0.2, scene, true) // the cap
    const platen = add(beam(2.02, 0.45, 2.06, 0.04), oakDark, 0, REST, 0, scene, true)
    const spindle = new THREE.Group()
    // the hose round the spindle, iron-banded; the screw, iron with a square thread; the bar, iron with an oak handle
    add(beam(1.1, 0.42, 0.42, 0.03).rotateZ(Math.PI / 2), oakY, 0, 0.78, 0, spindle)
    for (const y of [0.4, 1.15]) add(beam(0.06, 0.45, 0.45, 0.005).rotateZ(Math.PI / 2), iron, 0, y, 0, spindle)
    add(new THREE.CylinderGeometry(0.15, 0.15, 9, 20, 1), iron, 0, 4.9, 0, spindle)
    {
      const pts = Array.from({ length: 30 * 16 + 1 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        return new THREE.Vector3(Math.cos(a) * 0.17, 1.4 + (i / (30 * 16)) * 7.8, Math.sin(a) * 0.17)
      })
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1200, 0.05, 5, false), iron, 0, 0, 0, spindle)
    }
    const bar = new THREE.Group()
    add(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 10).rotateZ(Math.PI / 2), iron, 1.1, 0, 0, bar)
    add(new THREE.CylinderGeometry(0.085, 0.075, 1.1, 12).rotateZ(Math.PI / 2), oakY, 2.75, 0, 0, bar)
    add(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 16), iron, 0, 0, 0, bar)
    bar.position.y = 1.45
    spindle.add(bar)
    scene.add(spindle)
    // the chase: an iron frame round the forme
    const chase = [add(beam(2.14, 0.07, 0.07, 0.01), iron, 0, 0, -1.035, scene, true), add(beam(2.14, 0.07, 0.07, 0.01), iron, 0, 0, 1.035, scene, true), add(beam(2.14, 0.07, 0.07, 0.01).rotateY(Math.PI / 2), iron, 0, 0, 0), add(beam(2.14, 0.07, 0.07, 0.01).rotateY(Math.PI / 2), iron, 0, 0, 0)]
    // the tympan: an oak frame on a hinge at the far end, iron at its corners; the frisket hinged on its free end
    const tymp = new THREE.Group()
    tymp.position.set(0, 0.022, -1 - HO)
    scene.add(tymp)
    const tympSide = [-1, 1].map(() => add(beam(2 + 2 * HO + 0.16, 0.06, 0.1, 0.012).rotateY(Math.PI / 2), oakX, 0, 0.03, 1 + HO, tymp))
    const tympEnd = [-0.05, 2 + HO + 0.07].map((z) => add(beam(2, 0.06, 0.1, 0.012), oakX, 0, 0.03, z, tymp))
    const frisk = new THREE.Group()
    frisk.position.set(0, -0.012, 2 + HO + 0.06)
    tymp.add(frisk)
    const parch = oak([0.62, 0.55, 0.42], "x")
    const friskSide = [-1, 1].map(() => add(beam(2.12, 0.012, 0.04, 0.004).rotateY(Math.PI / 2), iron, 0, 0, -1.06, frisk))
    const friskEnd = [0, -2.12].map((z) => add(beam(2, 0.012, 0.05, 0.004), iron, 0, 0, z, frisk))
    const friskPaper = add(new THREE.BoxGeometry(2, 0.004, 0.12), parch, 0, 0.004, -0.07, frisk)
    // ---- the forme: the old picture, turning into a relief in type metal
    const formeMat = new THREE.NodeMaterial()
    formeMat.fragmentNode = Fn(() => {
      const st = uvAttr()
      const a = sampleRT(U.tA, st).rgb.toVar()
      const e = 0.0016
      const hx = luma(sampleRT(U.tA, st.add(vec2(e, 0)) as V2).rgb).sub(luma(sampleRT(U.tA, st.sub(vec2(e, 0)) as V2).rgb))
      const hy = luma(sampleRT(U.tA, st.add(vec2(0, e)) as V2).rgb).sub(luma(sampleRT(U.tA, st.sub(vec2(0, e)) as V2).rgb))
      const l = luma(a).toVar()
      const N = normalize(vec3(hx.mul(-5), 1, hy.mul(5)))
      // lead: grey, a little blue, bright where it stands proud; inked black and glossy on the high faces
      const metal = vec3(0.34, 0.35, 0.38).mul(l.mul(0.9).add(0.35)).mul(vnoise(st.mul(vec2(260, 150))).mul(0.2).add(0.9))
      const ink = sstep(0.3, 0.62, l).mul(U.wet)
      const alb = mix(metal, vec3(0.012, 0.012, 0.014), ink)
      const k = sstep(0.02, 0.24, U.p)
      const leadC = toSRGB(lit(alb as V3, N as V3, positionWorld as V3, ink.mul(1.6).add(0.25)))
      return vec4(mix(a, leadC, k), 1)
    })()
    const forme = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), formeMat)
    scene.add(forme)
    wide.push(forme)

    // ---- the sheet
    const sheetP = (st: V2): V3 => {
      const x = st.x.sub(0.5).mul(2).mul(U.asp)
      const r = st.y.oneMinus().mul(2).add(HO)
      // on the tympan: a rigid frame turning on its hinge at the far end
      const peeled = vec3(x, r.mul(sin(U.alpha)).add(0.022), r.mul(cos(U.alpha)).sub(1 + HO))
      // off the bed and round to the lens, the lifted corner leading
      // the print stands upside down on the tympan: on its way to the lens it turns about its own normal as it comes
      const n0 = vec3(0, cos(U.alpha).negate(), sin(U.alpha))
      const rc = float(1 + HO)
      const c0 = vec3(0, rc.mul(sin(U.alpha)).add(0.022), rc.mul(cos(U.alpha)).sub(1 + HO))
      const c1 = U.camP.add(U.camF.mul(D0))
      const end = U.camP.add(U.camF.mul(D0)).add(U.camR.mul(float(0.5).sub(st.x).mul(2).mul(U.asp))).add(U.camU.mul(st.y.sub(0.5).mul(2)))
      const k = sstep(0, 1, U.fly.mul(1.25).sub(length(st.sub(vec2(0, 0))).mul(0.12)))
      // taken off by the corner: the far side trails and hangs from it
      const lift = vec3(0, sin(k.mul(3.14159)).mul(0.5).sub(sin(U.fly.mul(3.14159)).mul(dot(st, st)).mul(0.35)), 0)
      const o0 = peeled.sub(c0)
      const ang = sstep(0.02, 0.85, U.fly).mul(3.14159)
      const turned = o0.mul(cos(ang)).add(cross(n0, o0).mul(sin(ang))).add(n0.mul(dot(n0, o0)).mul(float(1).sub(cos(ang))))
      const carried = mix(c0, c1, k).add(turned)
      return mix(carried, end, sstep(0.55, 1, k)).add(lift) as V3
    }
    const sheetMat = new THREE.NodeMaterial()
    const sheetW = Fn(() => sheetP(uvAttr() as V2))()
    const sheetN = Fn(() => {
      const st = uvAttr()
      const e = 0.004
      const p0 = sheetP(st as V2)
      return normalize(cross(sheetP(st.add(vec2(e, 0)) as V2).sub(p0), sheetP(st.add(vec2(0, e)) as V2).sub(p0)))
    })()
    sheetMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(sheetW, 1))
    sheetMat.side = THREE.DoubleSide
    sheetMat.fragmentNode = Fn(() => {
      const st = uvAttr().toVar()
      const P = sheetW.toVarying()
      const Nv = normalize(sheetN.toVarying()).toVar()
      const V = normalize(U.camP.sub(P))
      const back = step(0, dot(Nv, V)) // 1: the side that faced the platen
      const N = mix(Nv.negate(), Nv, back).toVar()
      // rag paper: long fibres, a cloudier formation, darker while damp
      const fib = vnoise(st.mul(vec2(420, 90))).mul(0.5).add(vnoise(st.mul(vec2(70, 610)).add(3.1)).mul(0.5))
      const cloud = fbm(st.mul(vec2(9, 6)))
      const paper = vec3(0.7, 0.64, 0.5).mul(fib.mul(0.1).add(cloud.mul(0.12)).add(0.84)).toVar()
      // the print is the incoming picture: the sheet lands on the lens mirrored in x
      const bst = vec2(st.x.oneMinus(), st.y).toVar()
      const b = sampleRT(U.tB, bst as V2).rgb.toVar()
      const lb = luma(b).toVar()
      const tooth = fbm(st.mul(vec2(16, 9)).add(7.7)).mul(0.6).add(fib.mul(0.4))
      const ink = sstep(0.5, 0.1, lb.add(tooth.sub(0.5).mul(0.1))).toVar()
      const col = vec3(0).toVar()
      // ---- the back: the old picture ghosting through the wet sheet, then the bite coming through
      const ghost = luma(sampleRT(U.tA, st as V2).rgb)
      const cen = st.sub(0.5).mul(vec2(U.asp, 1))
      const reach = sstep(0.0, 0.14, U.front.sub(length(cen)).sub(tooth.mul(0.5)).sub(ink.oneMinus().mul(0.45)).add(0.3))
      const bite = ink.mul(reach)
      const e2 = vec2(0.002, 0)
      const gx = luma(sampleRT(U.tB, bst.add(e2) as V2).rgb).sub(luma(sampleRT(U.tB, bst.sub(e2) as V2).rgb))
      const gy = luma(sampleRT(U.tB, bst.add(e2.yx) as V2).rgb).sub(luma(sampleRT(U.tB, bst.sub(e2.yx) as V2).rgb))
      const laid = sstep(0.5, 0.0, U.alpha)
      const backAlb = paper.mul(mix(float(1), ghost.mul(0.3).add(0.72), laid.mul(reach.oneMinus()))).mul(bite.mul(0.5).oneMinus())
      const Nb = normalize(N.add(vec3(gx.negate(), 0, gy).mul(reach).mul(2.5)))
      const backC = lit(backAlb as V3, Nb as V3, P as V3, 0.03)
      // ---- the face: black ink, squashed to a darker rim at every edge, glossy while wet
      const rim = ink.mul(ink.oneMinus()).mul(4)
      const faceAlb = mix(paper.mul(1.08), vec3(0.015, 0.013, 0.012), clampN(ink.mul(0.9).add(rim.mul(0.35)), 0, 1))
      const faceC = lit(faceAlb as V3, N as V3, P as V3, ink.mul(0.9)).toVar()
      col.assign(mix(faceC, backC, back))
      const outc = toSRGB(col as V3).toVar()
      // the ink resolves into the scene as the sheet squares up to the lens
      outc.assign(mix(outc, b, back.oneMinus().mul(sstep(0.45, 0.98, U.fly))))
      return vec4(outc, 1)
    })()
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 120, 72), sheetMat)
    sheet.frustumCulled = false
    scene.add(sheet)

    // ---- dust knocked off the bed by the slam
    const ND = 520
    const dustGeo = new THREE.InstancedBufferGeometry()
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    dustGeo.setIndex([0, 1, 2, 0, 2, 3])
    {
      const R = rng(1455)
      const a = new Float32Array(ND * 4)
      for (let i = 0; i < ND; i++) a.set([R() * 4, R(), R(), R()], i * 4)
      dustGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(a, 4))
      dustGeo.instanceCount = ND
    }
    const dustMat = new THREE.NodeMaterial()
    const aD = attribute("aD", "vec4")
    const dustA = Fn(() => {
      // a point on the platen's rim, thrown outward and up, slowed by the air
      const side = aD.x.floor()
      const tt = aD.x.fract().mul(2).sub(1)
      const ex = select(side.lessThan(2), tt.mul(U.asp), select(side.lessThan(3), U.asp.negate(), U.asp))
      const ez = select(side.lessThan(1), float(-1), select(side.lessThan(2), float(1), tt))
      const out = normalize(vec2(ex, ez).add(vec2(aD.y.sub(0.5), aD.z.sub(0.5))))
      const u = max(U.u, 0)
      // squirted out flat from under the platen's rim, fast, then hanging and drifting up in the window's light
      const puff = step(aD.w, 0.25)
      const run = float(1).sub(exp(u.mul(-6.5))).mul(aD.w.mul(1.8).add(0.35)).mul(puff.mul(-0.45).add(1))
      const rise = run.mul(aD.z.mul(0.35)).add(u.mul(aD.y.mul(0.25)))
      const c = vec3(ex.add(out.x.mul(run)), float(0.04).add(rise).sub(u.mul(u).mul(0.05).mul(puff.oneMinus())).max(0.02), ez.add(out.y.mul(run)))
      const sz = mix(aD.y.mul(0.035).add(0.012), aD.y.mul(0.3).add(0.18), puff).mul(u.mul(mix(float(1.2), float(2.4), puff)).add(1))
      return c.add(U.camR.mul(positionGeometry.x.mul(sz))).add(U.camU.mul(positionGeometry.y.mul(sz)))
    })()
    dustMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(dustA, 1))
    dustMat.fragmentNode = Fn(() => {
      const r = length(positionGeometry.xy.toVarying())
      const puff = step(aD.w, 0.25).toVarying()
      const u = max(U.u, 0)
      const a = mix(sstep(1, 0.25, r).mul(0.42), sstep(1, 0.0, r).mul(sstep(1, 0.0, r)).mul(0.07), puff).mul(exp(u.mul(mix(float(-4.2), float(-3.2), puff)))).mul(sstep(0, 0.03, U.u))
      return vec4(vec3(1.0, 0.92, 0.78).mul(a).mul(1.2), a)
    })()
    Object.assign(dustMat, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    const dust = new THREE.Mesh(dustGeo, dustMat)
    dust.frustumCulled = false
    dust.renderOrder = 5
    scene.add(dust)

    // ---- the lens: shake, a punch and a smear at the hit; then exactly the incoming frame
    const pass = ctx.pass(({ uv }) => {
      const u = max(U.u, 0)
      const hit = step(0, U.u)
      const c = uv.sub(0.5).mul(vec2(U.asp, 1)).toVar()
      const r = length(c)
      // the hit: a punch in (the lens knocked toward the bed) that rings out, a shake that is mostly vertical, and for a tenth of a second a radial smear
      const zoom = float(1).sub(exp(u.mul(-7)).mul(cos(u.mul(24))).mul(0.06).mul(hit))
      const sh = vec2(sin(u.mul(37)).mul(0.006), cos(u.mul(45)).mul(0.018)).mul(exp(u.mul(-5))).mul(hit)
      const q = c.mul(zoom).div(vec2(U.asp, 1)).add(0.5).add(sh)
      const smear = exp(u.mul(-16)).mul(hit).mul(0.05)
      const s = vec3(0).toVar()
      for (let i = 0; i < 6; i++) s.addAssign(sampleRT(U.tS, clampN(q.sub(0.5).mul(float(1).sub(smear.mul(i / 5))).add(0.5), 0.001, 0.999) as V2).rgb.mul(1 / 6))
      // the flash of the hit: the window's light caught in the dust
      s.mulAssign(float(1).add(exp(u.mul(-11)).mul(0.28).mul(hit)))
      // grain of the hit: one frame's flash of dust in the light
      s.addAssign(hash21(uv.mul(vec2(640, 360)).floor()).sub(0.5).mul(0.03).mul(exp(u.mul(-9))).mul(hit))
      const end = sstep(0.93, 0.992, U.p)
      // the shop is dark beyond the window's pool
      s.mulAssign(float(1).sub(r.mul(r).mul(0.3).mul(sstep(0.03, 0.3, U.p)).mul(sstep(0.95, 0.8, U.p))))
      return vec4(mix(mix(sampleRT(U.tA, uv).rgb, s, sstep(0.0, 0.012, U.p)), sampleRT(U.tB, uv).rgb, end), 1)
    }, U)

    const tgt = new THREE.Vector3()
    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = p
        U.asp.value = asp
        const u = (p - PLATEN_IN) * PLATEN_DUR
        U.u.value = u
        // the platen: down into frame as the bar comes round, slowly, then the last of it all at once; a bounce on the packing, then up
        const near = 2.4
        const h = u < 0 ? (p < 0.46 ? REST + (near - REST) * E.io2(smooth(0.28, 0.46, p)) : near + (0.03 - near) * E.in3(clamp((p - 0.46) / (PLATEN_IN - 0.46)))) : 0.03 + 0.05 * Math.exp(-u * 22) * Math.abs(Math.sin(u * 55)) + (REST - 0.03) * smooth(0.16, 0.66, u)
        U.h.value = h - 0.225
        platen.position.y = h
        spindle.position.y = h
        // the bar: hauled through its arc, then thrown back by the spring of the packing and the frame, ringing out
        spindle.rotation.y = u < 0 ? -1.5 + 1.7 * E.io2(smooth(0.28, 0.46, p)) + 0.5 * E.in3(clamp((p - 0.46) / (PLATEN_IN - 0.46))) : 0.7 - 1.6 * (1 - Math.exp(-u * 3.5) * Math.cos(u * 13)) * smooth(0, 0.1, u)
        // the frame takes the blow: the cheeks spring and ring
        const ring = u >= 0 ? Math.exp(-u * 7) * Math.sin(u * 48) : 0
        cheeks[0].rotation.z = 0.01 * ring
        cheeks[1].rotation.z = -0.01 * ring
        // the tympan: down onto the forme with the sheet; after the pull, up again on its hinge; the frisket lifts off the sheet
        U.alpha.value = p < 0.6 ? 1.95 * (1 - E.outBounce(clamp((p - 0.08) / 0.27)) * 0.999) : 1.75 * E.out3(smooth(0.64, 0.78, p))
        tymp.rotation.x = -U.alpha.value
        frisk.rotation.x = 2.6 * smooth(0.74, 0.82, p) * (1 - smooth(0.9, 0.97, p))
        U.wet.value = smooth(0.12, 0.3, p)
        U.front.value = u < 0 ? -1 : 2.6 * (1 - Math.exp(-u * 3.4))
        U.fly.value = smooth(0.79, 0.955, p)
        // the lens: from straight above, back and round to the front of the press; in and low for the blow; up again to see the bite and the tympan
        const th = 0.92 * smooth(0, 0.3, p) + 0.2 * smooth(0.3, 0.48, p) - 0.42 * smooth(0.53, 0.72, p)
        const D = D0 * (1 + 1.45 * smooth(0, 0.32, p) - 0.7 * smooth(0.3, 0.48, p) + 0.6 * smooth(0.53, 0.72, p) - 0.35 * smooth(0.72, 0.9, p))
        const kn = u >= 0 ? Math.exp(-u * 6) : 0
        cam.aspect = asp
        cam.position.set(0.5 * Math.sin(th * 1.4) + 0.03 * Math.sin(a.time * 0.7), D * Math.cos(th), D * Math.sin(th) * 1.0)
        cam.up.set(0, Math.sin(th) + 1e-3, -Math.cos(th))
        tgt.set(0, 0.55 * smooth(0, 0.3, p) * (1 - 0.5 * smooth(0.6, 0.9, p)) + 0.35 * smooth(0.3, 0.48, p) * (1 - smooth(0.52, 0.66, p)) - kn * 0.08 * Math.cos(u * 41), 0)
        cam.lookAt(tgt)
        cam.updateProjectionMatrix()
        cam.updateMatrixWorld()
        const e = cam.matrixWorld.elements
        U.camP.value.copy(cam.position)
        U.camR.value.set(e[0], e[1], e[2])
        U.camU.value.set(e[4], e[5], e[6])
        U.camF.value.set(-e[8], -e[9], -e[10])
        for (const w of wide) w.scale.x = asp
        cheeks[0].position.x = -(asp * 1.25 + 0.3)
        cheeks[1].position.x = asp * 1.25 + 0.3
        chase[2].position.x = -(asp + 0.035)
        chase[3].position.x = asp + 0.035
        tympSide[0].position.x = -(asp + 0.09)
        tympSide[1].position.x = asp + 0.09
        for (const m of tympEnd) m.scale.x = asp + 0.14
        friskSide[0].position.x = -(asp + 0.03)
        friskSide[1].position.x = asp + 0.03
        for (const m of friskEnd) m.scale.x = asp + 0.05
        friskPaper.scale.x = asp
        const r = ctx.renderer
        r.setClearColor(0x0a0806, 1)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tS.value = rt.texture
        pass.render(a.out)
      },
      warm: () => [{ scene, camera: cam, target: rt }, { pass, target: hold }],
      dispose() {
        scene.traverse((o) => {
          const m = o as THREE.Mesh
          m.geometry?.dispose?.()
          ;(m.material as THREE.Material | undefined)?.dispose?.()
        })
      },
    }
  },
}
export default t
