// 25 → 26. Axis.
//
// The rule of ages becomes the chart's axis. The outgoing picture above the rule's top edge tips
// backwards about that edge like a board falling flat onto a table (it accelerates as it falls and
// slaps down), and the blank top sheet of horizon's chart pad is behind it. Then the rule itself, a
// slab skinned with the outgoing frame's own RULE_RECT strip (so it is the rule in loom's light,
// whatever loom drew), lifts off the foot and pivots about its left end: it comes up toward the
// lens, turns a quarter turn with a glint running down its bevel, and recedes to stand on end on
// the chart's left margin. It lands at AXIS_IN, which is horizon's clock zero, with a clang, a
// shudder of the whole frame and a short steel ring (a damped wobble about the pivot). Horizon
// draws its own rule from that instant at exactly AXIS_LAND, and the slab's face crossfades into
// it before the slab is gone.
//
// What crosses the cut is the rule, carried bodily. Closed form in linear progress; works from
// any picture.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp as clampN, cos, dot, exp, float, Fn, max, mix, normalize, pow, screenUV, sin, step, uniform, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { RULE_RECT } from "../engine/ages"
import { clamp, E, mix as lerp, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const AXIS_DUR = 1.4
/** The landing: horizon's clock zero. */
export const AXIS_IN = 0.78
/**
 * Where the rule stands when it lands, in design pixels (1920×1080): the centre line's x, its foot
 * and its top. Horizon frames its first camera so its own rule covers exactly this.
 */
export const AXIS_LAND = { x: 330, y0: 995, y1: 150 } as const
/** The landed rule's width in design pixels (the rule keeps its proportions). */
export const AXIS_LAND_W = ((AXIS_LAND.y0 - AXIS_LAND.y1) * RULE_RECT.h) / RULE_RECT.w

// schedule, in linear progress
const FALL0 = 0.02, FALL1 = 0.4 // the picture tips back and slaps flat
const LIFT0 = 0.36 // the rule leaves the foot
const BAND0 = 0.3, BAND1 = 0.6 // the strip under the hinge turns from the old frame to the new
const XF0 = 0.84, XF1 = 0.96 // the slab's face becomes horizon's own rule
const OUT0 = 0.95, OUT1 = 0.995

const FOV = 30
const D0 = 1 / Math.tan((FOV * Math.PI) / 360) // a plane of half-height 1 fills the frame from here

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

/** Design pixels to the z = 0 frame plane (y up, half-height 1). */
const px2x = (px: number, asp: number) => ((px / DW) * 2 - 1) * asp
const px2y = (py: number) => 1 - (py / DH) * 2

/** The sheet's tip angle (radians) at linear progress p: falls under gravity, slaps, bounces once. */
function tipAngle(p: number) {
  const u = clamp((p - FALL0) / (FALL1 - FALL0))
  const fall = E.in2(u) * (Math.PI / 2) * 1.02
  const after = Math.max(0, p - FALL1) * AXIS_DUR
  const bounce = p > FALL1 ? Math.abs(Math.sin(after * 26)) * Math.exp(-after * 16) * 0.09 : 0
  return Math.min(fall, (Math.PI / 2) * 1.02) - bounce
}

const t: TransitionDef = {
  id: "axis",
  dur: AXIS_DUR,
  inAt: AXIS_IN,
  ease: E.lin,
  snd: [
    { s: "whoosh", p: FALL0 + 0.04, o: { g: 0.22, f: 150, dur: 0.45 } },
    { s: "page", p: FALL1, o: { g: 0.7, pos: [0, 0.1, 0.6] } },
    { s: "thud", p: FALL1, o: { g: 0.55, f: H(3), pos: [0, -0.1, 0.5] } },
    { s: "scratch", p: LIFT0, o: { g: 0.22, f: 1400, dur: 0.12 } },
    { s: "whoosh", p: LIFT0 + 0.04, o: { g: 0.3, f: 320, dur: 0.42 } },
    { s: "riser", p: LIFT0 + 0.08, o: { g: 0.18, dur: (AXIS_IN - LIFT0 - 0.08) * AXIS_DUR } },
    // the landing: steel on the board, a shudder under it, and the rule ringing
    { s: "anvil", p: AXIS_IN, o: { g: 0.85, f: H(24), pos: [-0.76, -0.1, 0.15] } },
    { s: "thump", p: AXIS_IN, o: { g: 0.8, pos: [-0.76, -0.2, 0.15] } },
    { s: "sub", p: AXIS_IN, o: { g: 0.8 } },
    { s: "glass", p: AXIS_IN + 0.01, o: { g: 0.3, f: H(48), pos: [-0.76, 0.3, 0.2] } },
    { s: "glass", p: AXIS_IN + 0.02, o: { g: 0.16, f: H(61), pos: [-0.76, 0.5, 0.2] } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(rt.texture),
      tip: uniform(0), // the sheet's angle, for its light
      xf: uniform(0), // the slab's face: old rule to horizon's rule
      band: uniform(0),
      slabA: uniform(1),
      glint: uniform(0), // where along the slab the bevel's glint is (0..1), and how strong
      glintA: uniform(0),
      shock: uniform(-1), // seconds since the landing
      land: uniform(new THREE.Vector2(0, 0)), // the landing point, y-up frame uv
      asp: uniform(16 / 9),
      rx0: uniform(0), // RULE_RECT in frame uv (y up): x0, x1, y0 (bottom), y1 (top)
      rx1: uniform(1),
      ry0: uniform(0),
      ry1: uniform(1),
    }
    U.rx0.value = RULE_RECT.x / DW
    U.rx1.value = (RULE_RECT.x + RULE_RECT.w) / DW
    U.ry0.value = 1 - (RULE_RECT.y + RULE_RECT.h) / DH
    U.ry1.value = 1 - RULE_RECT.y / DH
    const hingeUV = 1 - RULE_RECT.y / DH

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 40)
    const KEY = normalize(vec3(-0.35, 0.62, 0.7))

    // ---- the outgoing picture above the hinge: a board that tips back onto the table
    const sheetGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)
    const sheetMat = new THREE.NodeMaterial()
    sheetMat.side = THREE.DoubleSide
    sheetMat.fragmentNode = Fn(() => {
      const st = uvAttr()
      const fuv = vec2(st.x, mix(float(hingeUV), float(1), st.y))
      const c = toLinear(sampleRT(U.tA, clampN(fuv, 0.001, 0.999) as V2).rgb)
      // its face turns from the lens toward the ceiling: exact at 0, a soft glint on the way, then dark
      const N = vec3(0, sin(U.tip), cos(U.tip))
      const ndl = max(dot(N, KEY), 0)
      const shade = ndl.div(dot(vec3(0, 0, 1), KEY)).min(1.15).mul(float(1).sub(sstep(1.2, 1.6, U.tip as F).mul(0.6)))
      const Hh = normalize(KEY.add(vec3(0, 0, 1)))
      const sp = pow(max(dot(N, Hh), 0), 40).mul(sstep(0.05, 0.4, U.tip as F)).mul(0.35)
      // the board's edge and a soft contact shade along the hinge as it nears flat
      const edge = sstep(0.0, 0.012, st.y as F).mul(0.4).add(0.6).mul(sstep(0.2, 1.4, U.tip as F)).add(float(1).sub(sstep(0.2, 1.4, U.tip as F)))
      return vec4(toSRGB(c.mul(shade).mul(edge).add(vec3(1, 0.96, 0.9).mul(sp)) as V3), 1)
    })()
    const sheet = new THREE.Mesh(sheetGeo, sheetMat)
    sheet.frustumCulled = false
    scene.add(sheet)

    // ---- the rule: a steel slab whose top face is the old frame's rule, pivoting about its left end
    const slabGeo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, -0.5)
    const slabMat = new THREE.NodeMaterial()
    slabMat.depthTest = false
    slabMat.depthWrite = false
    slabMat.transparent = true
    {
      const nG = attribute("normal", "vec3")
      slabMat.fragmentNode = Fn(() => {
        const st = uvAttr().toVar()
        const front = step(0.5, nG.z)
        // the old face: the strip of the outgoing frame where the rule was
        const fuv = vec2(mix(U.rx0, U.rx1, st.x), mix(U.ry0, U.ry1, st.y))
        const old = toLinear(sampleRT(U.tA, fuv as V2).rgb).toVar()
        // horizon's own rule, where the slab now stands on the frame
        const here = vec2(screenUV.x, screenUV.y.oneMinus())
        const neu = toLinear(sampleRT(U.tB, clampN(here, 0.001, 0.999) as V2).rgb)
        const face = mix(old, neu, U.xf).toVar()
        // the glint running down the bevel as it turns, and the light on the ground edges
        const g = exp(abs(st.x.sub(U.glint)).mul(-14)).mul(U.glintA).mul(sstep(0.05, 0.3, st.y as F).oneMinus().mul(0.6).add(0.4))
        face.addAssign(vec3(1, 0.97, 0.92).mul(g).mul(float(1).sub(U.xf)))
        const br = vnoise(vec2(st.x.mul(400), st.y.mul(6))).mul(0.12).add(0.82)
        const side = vec3(0.42, 0.43, 0.45).mul(br).mul(max(dot(normalize(nG), KEY), 0).mul(0.6).add(0.4))
        const col = mix(side, face, front)
        return vec4(toSRGB(col as V3), U.slabA)
      })()
    }
    const slab = new THREE.Mesh(slabGeo, slabMat)
    slab.renderOrder = 10
    slab.frustumCulled = false
    scene.add(slab)

    // ---- the frame: the new picture behind, the old band under the hinge until the rule leaves, the 3D on top
    const pass = ctx.pass(({ uv }) => {
      const u = U.shock
      const hit = step(0, u)
      // the shudder of the landing: a short decaying jolt and a dust-light flash at the foot of the rule
      const sh = vec2(exp(u.mul(-16)).mul(sin(u.mul(70))).mul(0.0025), exp(u.mul(-13)).mul(cos(u.mul(55))).mul(0.006)).mul(hit)
      const q = clampN(uv.add(sh), 0.001, 0.999) as V2
      const b = toLinear(sampleRT(U.tB, q).rgb)
      const a = toLinear(sampleRT(U.tA, q).rgb)
      const under = step(q.y, float(hingeUV))
      const base = mix(b, mix(a, b, U.band), under).toVar()
      const s = sampleRT(U.tS, q)
      const col = mix(base, toLinear(s.rgb), s.a).toVar()
      const d = q.sub(U.land).mul(vec2(U.asp, 1))
      col.addAssign(vec3(1, 0.95, 0.86).mul(exp(dot(d, d).mul(-60))).mul(exp(u.mul(-12))).mul(hit).mul(0.25))
      return vec4(toSRGB(col as V3), 1)
    }, U)

    const v = new THREE.Vector3()
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion()
    const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0)

    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        U.asp.value = asp
        cam.aspect = asp
        cam.position.set(0, 0, D0)
        cam.lookAt(0, 0, 0)
        cam.updateProjectionMatrix()
        cam.updateMatrixWorld()

        // the sheet
        const tip = tipAngle(p)
        U.tip.value = tip
        const hy = px2y(RULE_RECT.y)
        sheet.position.set(0, hy, 0)
        sheet.scale.set(2 * asp, 1 - hy, 1)
        sheet.rotation.set(-tip, 0, 0)
        sheet.visible = p < FALL1 + 0.12

        // the rule: from the foot to standing on the chart's margin
        const L0 = (RULE_RECT.w / DH) * 2 // its length on the frame plane at the start
        const W0 = (RULE_RECT.h / DH) * 2
        const sc1 = ((AXIS_LAND.y0 - AXIS_LAND.y1) / RULE_RECT.w) // apparent scale once landed
        const z1 = D0 * (1 - 1 / sc1) // that scale is a true distance
        const u = clamp((p - LIFT0) / (AXIS_IN - LIFT0))
        const ue = E.io3(u)
        // the pivot (the rule's left end, middle of its width) on the frame plane, then pushed back
        const px0 = px2x(RULE_RECT.x, asp), py0 = px2y(RULE_RECT.y + RULE_RECT.h / 2)
        const px1 = px2x(AXIS_LAND.x, asp), py1 = px2y(AXIS_LAND.y0)
        const lift = Math.sin(Math.PI * u) // it comes toward the lens on the way up
        const z = lerp(0, z1, E.io2(u)) + 0.9 * lift
        const k = (D0 - z) / D0
        v.set(lerp(px0, px1, ue) * k, (lerp(py0, py1, ue) + 0.18 * lift) * k, z)
        // the quarter turn, a little over, then the ring of the landing about the pivot
        const after = Math.max(0, p - AXIS_IN) * AXIS_DUR
        const ring = p > AXIS_IN ? Math.sin(after * 48) * Math.exp(-after * 13) * 0.02 : 0
        const phi = (Math.PI / 2) * (u < 1 ? E.outBack(E.in2(u) * 0.35 + u * 0.65) : 1) + ring
        const roll = 0.55 * Math.sin(Math.PI * u) // it turns on its long axis as it swings: the bevel flashes
        qa.setFromAxisAngle(Z, phi)
        qb.setFromAxisAngle(X, roll)
        slab.quaternion.copy(qa).multiply(qb)
        slab.position.copy(v)
        // the slab's top face is at local z = 0 (the box is pushed back by half its depth)
        slab.scale.set(L0, W0, 0.02)
        U.glint.value = clamp(u * 1.3 - 0.15)
        U.glintA.value = Math.sin(Math.PI * u) * 0.9
        U.xf.value = smooth(XF0, XF1, p)
        U.slabA.value = 1 - smooth(OUT0, OUT1, p)
        U.band.value = smooth(BAND0, BAND1, p)
        U.shock.value = (p - AXIS_IN) * AXIS_DUR
        U.land.value.set(AXIS_LAND.x / DW, 1 - AXIS_LAND.y0 / DH)

        const r = ctx.renderer
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tS.value = rt.texture
        pass.render(a.out)
      },
      warm: () => [{ scene, camera: cam, target: rt }, { pass, target: hold }],
      dispose() {
        sheetGeo.dispose()
        sheetMat.dispose()
        slabGeo.dispose()
        slabMat.dispose()
      },
    }
  },
}
export default t
