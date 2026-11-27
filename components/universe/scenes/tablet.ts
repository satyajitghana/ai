// Scene 14, tablet: "Clay". Farming, the first cities and writing.
//
// Idea. A furrow in a field and a mark in a tablet are the same gesture: a line pressed into earth
// so that it is still there later. So the scene is one material, pale alluvial silt, at two scales
// exactly 1 : 100 apart, under the same low sun.
//
// Staging. Beat 0: straight down on a field being ploughed with an ard (a symmetrical scratch,
// spoil to both sides), one continuous pull upward in log height: crumbs and clods, seed in the
// troughs, a bare footprint and an ox's, shoots coming up along the oldest rows, water let in from
// the head ditch, then the plot among other plots, baulks, mud-brick walls and a canal. The plot
// is 9.5 x 6.6 m with twelve furrows; the tablet is 9.5 x 6.6 cm with twelve ruled lines, and both
// worlds are drawn with one camera in their own units, so the stripes are the ruled lines by
// construction and the hand-over is a cross-fade of detail by pixel footprint.
// Beat 1: a low macro across the tablet in a hand: a reed draws a sign (planted, then pulled: a
// groove with a lip, a burr and the reed's fibre lines) and presses round number marks with its
// butt end; the clay dries from the rim inward.
//
// Story parameter. `scale` (log of the frame's height), then `marks` (strokes in the clay).
//
// World rule. `clayLit`: one sun, a sky fill, a shadow marched through the height field; wet is
// darker and glossy, dry is paler and matt. Ground, tablet and the rule of ages all use it.
// Both grounds are a screen-projected grid displaced by an analytic height field (real relief at
// every scale, detail faded by its footprint).

import * as THREE from "three/webgpu"
import { abs, atan, attribute, dFdx, dFdy, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, Discard, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalize, normalWorld, positionGeometry, pow, select, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { featherMaterial, makeAim, makeHerd, makeShadow, skinMaterial, solveGrip, type Drive, type Herd, type Lights, type PartSpec, type Pose, type SkinNodes } from "../engine/creature"
import * as HM from "../engine/creature/hand"
import * as HU from "../engine/creature/human"
import { aces, fbm, hash21, hash22, sampleRT, toSRGB, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { CLAY_CUT, CLAY_DUR, CLAY_IN, provideClayHands, type ClayHand, type ClayHands } from "../transitions/clay"

// ---------------------------------------------------------------- layout (units: metres in the field, centimetres in the hand)

const PW = 4.75, PH = 3.3 // half the plot, half the tablet
const ROWS = 12
const SP = (2 * PH) / ROWS // furrow spacing 0.55 m; ruled-line spacing 5.5 mm
const CELL: [number, number] = [2 * PW + 0.8, 2 * PH + 0.8] // plots are laid out on this lattice, a baulk between
const ROWZ = (r: number) => -PH + (r + 0.5) * SP
const HERO = ROWS - 1 // the newest furrow: the one being cut as the scene opens
const FOV = 30
const TANH = Math.tan((FOV * Math.PI) / 360)
/** Toward the sun: low, from the upper left of the frame, across the lines. */
const SUN = /*@__PURE__*/ new THREE.Vector3(-0.38, 0.52, -0.76).normalize()
const SUN_H = /*@__PURE__*/ Math.hypot(SUN.x, SUN.z)
const TAN_E = SUN.y / SUN_H // rise of a sun ray per unit of ground
const LD: [number, number] = [SUN.x / SUN_H, SUN.z / SUN_H]
const START = CLAY_DUR * (1 - CLAY_IN)
// frame heights (m, or cm in the hand) along the pull
const F0 = 0.46, F_CARD = 0.86, F_END = 25
const MIX0 = Math.log(15.5), MIX1 = Math.log(24) // the hand-over, in log frame height
// the compound's walls and room (centre x, z, half x, half z), with heights
const BOXES: [number, number, number, number, number][] = [
  [-11.6, -10.9, 5.6, 0.28, 2.1],
  [-11.6, -3.9, 5.6, 0.28, 2.1],
  [-17.0, -7.4, 0.28, 3.5, 2.1],
  [-6.2, -8.6, 0.28, 2.3, 2.1],
  [-13.9, -8.9, 2.6, 1.8, 2.9],
  [-9.2, -5.6, 1.5, 1.3, 2.5],
  [3.6, 12.6, 2.3, 1.7, 2.7],
]
const CANAL_X = 13.4
const YARD: [number, number, number, number] = [-11.6, -7.4, 6.0, 3.9] // the compound's yard: nothing is ploughed there

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** smoothstep whose edges may be nodes and may fall (WGSL leaves e0 > e1 undefined). */
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sq = (x: F): F => x.mul(x) as F
const gauss = (x: F, w: number): F => exp(sq(x.div(w) as F).negate()) as F
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const sdBox = (p: V2, bx: number, by: number): F => {
  const q = abs(p).sub(vec2(bx, by)).toVar()
  return length(max(q, 0)).add(min(max(q.x, q.y), 0)) as F
}
const hash01 = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const isK = (k: F, n: number): F => step(n - 0.5, k).mul(step(k, n + 0.5)) as F


// ---------------------------------------------------------------- the hands (the toolkit's macro hand, metres, drawn in centimetres)

/** The writer's hands, in this scene and in `clay` (the same person): skin, and how much clay is on them. */
const HAND_SKIN = 0x67503f
const HS = 100
/** The wrist bent back as a hand presses flat with the forearm raised (radians; the sign is the rig's). */
const WRIST_BACK = -0.55
type HandSlot = { on: boolean; elbow: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; Z: THREE.Vector3; roll: number; ch: Record<string, number>; time: number; seed: number }
type HandSet = {
  H: HM.HandModel
  herd: Herd
  slots: HandSlot[]
  /** Aim the slot's forearm: fingers along X, the back of the hand along Y (the wrist straight). */
  orient(s: HandSlot, X: THREE.Vector3, Y: THREE.Vector3): void
  /** Put the model-space point `local` (an anchor) at `at`, with that frame. */
  place(s: HandSlot, at: THREE.Vector3, local: readonly number[], X: THREE.Vector3, Y: THREE.Vector3): void
  update(cam: THREE.PerspectiveCamera): void
  /** A model-space point of the last posed hand, in the world (after update; count 1). */
  ride(local: readonly number[], out: THREE.Vector3): THREE.Vector3
  /** The world head of one of the last posed hand's bones. */
  joint(name: string, out: THREE.Vector3): THREE.Vector3
}
/** The upper arm, so no elbow ends in the frame: a part on the forearm's stub body, the elbow a little bent toward the body (model -z for a right hand). */
const upperArm = (zs: number): PartSpec => ({
  name: "upper", on: "body", origin: [0, 0, 0], path: [[-0.07, 0.02, -zs * 0.004], [-0.16, 0.09, -zs * 0.016], [-0.28, 0.22, -zs * 0.035]],
  up: [0, 1, 0], sect: [{ at: 0, w: 0.04, up: 0.038, dn: 0.04, n: 2.2 }, { at: 0.18, w: 0.044, up: 0.04, dn: 0.042, n: 2.2 }, { at: 0.55, w: 0.05, up: 0.046, dn: 0.044, n: 2.2 }, { at: 1, w: 0.052, up: 0.05, dn: 0.046, n: 2.2 }],
  bulges: [{ at: 0.03, len: 0.06, around: 0, arc: 50, h: 0.006 }], rings: 30, sides: 28, cap: "round", cap0: "round", fillet: 0, flare: 0, bones: 0,
})
function handSet(side: "R" | "L", count: number, material: (n: SkinNodes, H: HM.HandModel) => THREE.NodeMaterial, o: { upper?: boolean; extra?: (H: HM.HandModel) => Record<string, Pose> } = {}): HandSet {
  const H0 = HM.makeHand({ side })
  const zs = side === "L" ? -1 : 1
  const spec = { ...H0.spec, parts: o.upper ? [...H0.spec.parts, upperArm(zs)] : H0.spec.parts, poses: o.extra ? { ...H0.spec.poses, ...o.extra(H0) } : H0.spec.poses }
  const H: HM.HandModel = { ...H0, spec }
  const aims = Array.from({ length: count }, () => makeAim())
  const slots: HandSlot[] = aims.map((_, i) => ({ on: false, elbow: new THREE.Vector3(), X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1), roll: 0, ch: {}, time: 0, seed: 0.37 + i * 0.21 }))
  const herd = makeHerd({ spec, count, path: aims[0], lods: [{ detail: 1, cover: 0 }], material: (n) => material(n, H) })
  herd.group.traverse((m) => (m.frustumCulled = false))
  const bone = herd.rig.bone("arm.2")
  const head = herd.built[0].skel.head
  const r0 = new THREE.Vector3(), u0 = new THREE.Vector3(), tmp = [0, 0, 0], e = [0, 0, 0], d = [1, 0, 0]
  const fill = (i: number, dr: Drive) => {
    const s = slots[i]
    dr.path = aims[i]
    dr.dist = 0
    dr.lane = 0
    // (a hand that is off is put far below the ground, where the herd culls it)
    dr.rise = s.on ? 0 : -1e6
    dr.time = s.time
    dr.scale = HS
    dr.seed = s.seed
    dr.look = null
    for (const k in dr.ch) dr.ch[k] = 0
    for (const k in s.ch) dr.ch[k] = s.ch[k]
    dr.roll = s.roll
  }
  const set: HandSet = {
    H, herd, slots,
    orient(s, X, Y) {
      s.X.copy(X).normalize()
      s.Y.copy(Y).addScaledVector(s.X, -s.Y.dot(s.X)).normalize()
      s.Z.crossVectors(s.X, s.Y)
      // the rig's frame for a heading: right = horizontal, up = right x heading; roll turns up toward right
      r0.set(-s.X.z, 0, s.X.x).normalize()
      u0.crossVectors(r0, s.X)
      s.roll = Math.atan2(s.Y.dot(r0), s.Y.dot(u0))
    },
    place(s, at, local, X, Y) {
      set.orient(s, X, Y)
      s.elbow.copy(at).addScaledVector(s.X, -local[0] * HS).addScaledVector(s.Y, -local[1] * HS).addScaledVector(s.Z, -local[2] * HS)
    },
    update(cam) {
      slots.forEach((s, i) => {
        e[0] = s.elbow.x
        e[1] = s.elbow.y
        e[2] = s.elbow.z
        d[0] = s.X.x
        d[1] = s.X.y
        d[2] = s.X.z
        aims[i].set(e, d)
      })
      herd.update(cam, fill)
    },
    ride(local, out) {
      HU.ride(herd.rig, bone, head, local as [number, number, number], HS, tmp)
      return out.set(tmp[0], tmp[1], tmp[2])
    },
    joint(name, out) {
      const b = herd.rig.bone(name)
      return b < 0 ? out.set(0, 0, 0) : out.set(herd.rig.p[b * 3], herd.rig.p[b * 3 + 1], herd.rig.p[b * 3 + 2])
    },
  }
  return set
}

/** The hands that smooth the slab in `clay` (built here, in this chunk: see transitions/clay.ts). */
function makeClayHands(o: { sun: THREE.Vector3 }): ClayHands {
  const sun = uniform(o.sun.clone())
  const look = (H: HM.HandModel) => HM.handLook(H, { skin: HAND_SKIN, clay: 0.9, clayCol: 0x8c7658, hair: 0.5, veins: 0.5, callus: 0.3 })
  const mat = (n: SkinNodes, H: HM.HandModel) => {
    const Lt: Lights = { key: sun as unknown as V3, keyCol: vec3(1.0, 0.84, 0.62).mul(3.0) as V3, sky: vec3(0.34, 0.44, 0.62).mul(0.5) as V3, bounce: vec3(0.5, 0.38, 0.25).mul(0.3) as V3 }
    const m = skinMaterial(n, Lt, look(H))
    const c = m.fragmentNode as unknown as V4
    // display values: this layer is composited over the finished slab
    m.fragmentNode = vec4(toSRGB(aces(c.rgb.mul(0.9) as V3) as V3), 1)
    return m
  }
  const sets = { R: handSet("R", 2, mat, { upper: true }), L: handSet("L", 2, mat, { upper: true }) }
  const group = new THREE.Group()
  group.add(sets.R.herd.group, sets.L.herd.group)
  return {
    group,
    update(cam: THREE.PerspectiveCamera, hands: ClayHand[]) {
      const used = { R: 0, L: 0 }
      for (const s of [...sets.R.slots, ...sets.L.slots]) s.on = false
      for (const h of hands) {
        if (!h.on) continue
        const k = h.side > 0 ? "R" : "L"
        const set = sets[k]
        const s = set.slots[used[k]++]
        if (!s) continue
        s.on = true
        s.time = h.time
        set.place(s, h.at, set.H.anchors.palm, h.X, h.Y)
        for (const c in s.ch) s.ch[c] = 0
        s.ch.flat = 1 - h.spread
        s.ch.splay = h.spread
        // the forearm rises off the slab and the wrist is bent back, so the palm lies flat
        s.ch.wristFlex = WRIST_BACK
      }
      sets.R.update(cam)
      sets.L.update(cam)
    },
    dispose() {
      sets.R.herd.dispose()
      sets.L.herd.dispose()
    },
  }
}
provideClayHands(makeClayHands)

export function create(ctx: Ctx): SceneInstance {
  // ---------------------------------------------------------------- uniforms shared by both worlds

  const U = {
    pos: uniform(new THREE.Vector3(0, 1, 0)), // camera
    fwd: uniform(new THREE.Vector3(0, -1, 0)),
    right: uniform(new THREE.Vector3(1, 0, 0)), // scaled by tan(fov/2) * aspect
    up: uniform(new THREE.Vector3(0, 0, -1)), //   scaled by tan(fov/2)
    px: uniform(0.001), // world size of a pixel at the ground
    cut: uniform(-10), // where the ard's share is, along the newest furrow
    wetT: uniform(-1), // seconds since the water was let in
    grow: uniform(0), // seconds since the first shoots
    time: uniform(0),
    sun: uniform(SUN.clone()),
    boxes: uniformArray(BOXES.map((b) => new THREE.Vector4(b[0], b[1], b[2], b[3])), "vec4"),
    boxH: uniformArray(BOXES.map((b) => b[4]), "float"),
  }
  const SUNC = vec3(1.0, 0.84, 0.62).mul(3.3)
  const SKYC = vec3(0.36, 0.45, 0.62).mul(0.8)
  const LDn = vec2(LD[0], LD[1])
  /** 1 while a feature of this size is larger than a few pixels, 0 once it is under one. */
  const lodP = (size: number, px: F): F => sstep(size * 0.3, size * 0.1, px)
  const lod = (size: number): F => lodP(size, U.px as unknown as F)
  /** What the height functions need from the frame: (pixel size, where the share is). Real shader functions cannot see uniforms from both stages, so it is passed in. */
  const PAR = vec2(U.px, U.cut) as V2

  /** Cellular noise, both nearest distances: vec2(F1, F2). Cracks are where they meet. */
  const vor2 = Fn(([q]: [V2]) => {
    const i = floor(q).toVar()
    const f = q.sub(i).toVar()
    const d = vec2(8, 8).toVar()
    Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
      const g = vec2(float(x), float(y)).toVar()
      const e = length(g.add(hash22(i.add(g))).sub(f)).toVar()
      If(e.lessThan(d.x), () => {
        d.assign(vec2(e, d.x))
      }).ElseIf(e.lessThan(d.y), () => {
        d.y.assign(e)
      })
    })
    return d
  }).setLayout({ name: "tabletVor2", type: "vec2", inputs: [{ name: "q", type: "vec2" }] })

  // ---------------------------------------------------------------- the field's height (metres)

  /** One plot's furrow profile across a row: v in -0.5..0.5, 0 at the trough. An ard scratches; spoil lies on both sides. */
  const furrow = (v: F): F => gauss(v, 0.15).mul(-0.07).add(gauss(abs(v).sub(0.31) as F, 0.1).mul(0.04)) as F
  /** Which plot a point is in, what grows there, and where it is across the rows. */
  const plotAt = (p: V2) => {
    const cid = floor(p.div(vec2(CELL[0], CELL[1])).add(0.5)).toVar()
    const lp = p.sub(cid.mul(vec2(CELL[0], CELL[1]))).toVar()
    const hero = step(abs(cid.x).add(abs(cid.y)), 0.5).toVar()
    const kh = hash21(cid.add(vec2(7.3, 1.9))).toVar()
    // 0 ploughed along x, 1 ploughed along z, 2 fallow crust, 3 young crop, 4 flooded
    const kind = mixN(step(0.3, kh).add(step(0.46, kh)).add(step(0.66, kh)).add(step(0.87, kh)), 0, hero).toVar()
    const dl = sdBox(lp as V2, PW, PH).toVar()
    const rc = select(isK(kind as F, 1).greaterThan(0.5), lp.x.div((2 * PW) / 17).add(8.5), lp.y.add(PH).div(SP)).toVar()
    const v = fract(rc).sub(0.5).toVar()
    const row = floor(rc).toVar()
    const yard = sstep(0.9, 0.3, sdBox(p.sub(vec2(YARD[0], YARD[1])) as V2, YARD[2], YARD[3])).toVar()
    const amp = isK(kind as F, 0).add(isK(kind as F, 1)).add(isK(kind as F, 3).mul(0.5)).add(isK(kind as F, 4).mul(0.3)).mul(yard.oneMinus()).toVar()
    // the canal takes its strip of land
    const dc = abs(p.x.sub(CANAL_X).sub(sin(p.y.mul(0.06)).mul(1.4))).toVar()
    const land = sstep(3.1, 3.7, dc as F).toVar()
    return { cid, lp, hero, kind: kind as F, dl, v: v as F, row: row as F, amp: amp as F, dc: dc as F, land, yard: yard as F, kh: kh as F }
  }
  /** How much of a furrow exists here: the headland is left, and the newest one stops at the share. */
  const cutMask = (p: V2, q: ReturnType<typeof plotAt>, cut: F): F => {
    const head = sstep(-0.12, -0.42, q.dl)
    const newest = q.hero.mul(isK(q.row, HERO))
    return head.mul(newest.mul(sstep(cut.sub(0.05), cut.add(0.01), p.x)).oneMinus()) as F
  }
  /** Clods on the hero plot's spoil: one per cell of a jittered lattice, kept inside its own cell. (Only the hero plot is ever close enough to show them.) */
  const clodsF = Fn(([p, par]: [V2, V2]) => {
    const px = par.x as F
    const h = float(0).toVar()
    const lc = lodP(0.05, px).toVar()
    If(lc.greaterThan(0), () => {
      const rc = p.y.add(PH).div(SP)
      const v = fract(rc).sub(0.5)
      const on = sstep(-0.12, -0.42, sdBox(p, PW, PH)).mul(isK(floor(rc) as F, HERO).mul(sstep(par.y.sub(0.05), par.y.add(0.01), p.x)).oneMinus()).toVar()
      const ridge = sstep(0.1, 0.26, abs(v) as F).toVar()
      const c = floor(p.div(0.13)).toVar()
      const hh = hash22(c).toVar()
      const R = sq(hh.x).mul(0.03).add(0.018)
      const g = p.sub(c.add(0.32).add(hash22(c.add(5.5)).mul(0.36)).mul(0.13)).toVar()
      const a = hh.y.mul(17)
      // an irregular lump: longer one way, its outline and its top broken by noise
      const ge = vec2(g.x.mul(cos(a)).add(g.y.mul(sin(a))), g.y.mul(cos(a)).sub(g.x.mul(sin(a))).mul(hh.y.mul(0.7).add(1.1)))
      const nz = vnoise(p.mul(46)).toVar()
      const d = length(ge).div(R).add(nz.sub(0.5).mul(0.7))
      h.addAssign(R.mul(0.75).mul(sstep(1.0, 0.3, d as F)).mul(nz.mul(0.5).add(0.72)).mul(step(0.5, fract(hh.x.mul(7.7).add(hh.y.mul(3.3))))).mul(ridge.mul(0.9).add(0.1)).mul(on).mul(lc))
      const ls = lodP(0.018, px).toVar()
      If(ls.greaterThan(0), () => {
        const c2 = floor(p.div(0.045)).toVar()
        const h2 = hash22(c2.add(11.1)).toVar()
        const R2 = h2.x.mul(0.009).add(0.006)
        const g2 = p.sub(c2.add(0.3).add(fract(h2.yx.mul(5.3)).mul(0.4)).mul(0.045))
        const d2 = length(g2.mul(vec2(1, h2.y.mul(0.8).add(0.9)))).div(R2).add(nz.sub(0.5).mul(0.6))
        h.addAssign(R2.mul(0.8).mul(sstep(1.0, 0.25, d2 as F)).mul(step(0.55, fract(h2.x.mul(9.1)))).mul(ridge.mul(0.7).add(0.3)).mul(on).mul(ls))
      })
    })
    return h
  }).setLayout({ name: "tabletClods", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "par", type: "vec2" }] })
  const fieldHf = Fn(([p, par]: [V2, V2]) => {
    const px = par.x as F
    const cut = par.y as F
    const q = plotAt(p)
    const h = float(0).toVar()
    // the baulk between plots: a low flat bank people walk on
    h.addAssign(sstep(-0.05, 0.2, q.dl).mul(0.1).mul(q.yard.oneMinus()))
    const on = cutMask(p, q, cut).mul(q.amp).toVar()
    If(on.greaterThan(0.001), () => {
      h.addAssign(furrow(q.v).mul(on).mul(vnoise(p.mul(5.3)).mul(0.5).add(0.75)))
      h.addAssign(clodsF(p, par).mul(q.hero))
    })
    // prints along the crests between the newest rows, out in the sun: a bare foot, and one crest up an ox's
    const lf = lodP(0.09, px).mul(q.hero).toVar()
    If(lf.greaterThan(0), () => {
      // the person: steps 0.33 m apart, left and right of the trough's line, walking +x
      const zH = p.y.sub(ROWZ(HERO) - SP / 2)
      const i = floor(p.x.div(0.33)).toVar()
      const sd = fract(i.mul(0.5)).mul(4).sub(1) // -1, +1
      const f = vec2(p.x.sub(i.add(0.5).mul(0.33)), zH.sub(sd.mul(0.055))).toVar()
      // sole: heel, a narrower arch on the outer side, the ball; five toes ahead of it
      const heel = length(f.sub(vec2(-0.075, 0)).mul(vec2(0.9, 1.15))).sub(0.033)
      const ball = length(f.sub(vec2(0.045, sd.mul(-0.004))).mul(vec2(0.78, 1))).sub(0.042)
      const arch = length(vec2(max(abs(f.x.add(0.015)).sub(0.045), 0), f.y.sub(sd.mul(0.012)))).sub(0.021)
      const sole = min(min(heel, ball), arch)
      // (the heel and the ball go deepest)
      const pr = sstep(0.014, -0.014, sole as F).mul(sstep(0.03, -0.03, min(heel, ball) as F).mul(0.45).add(0.55)).toVar()
      Loop(5, ({ i: k }) => {
        const kf = float(k)
        const tc = vec2(kf.mul(-0.0075).add(0.112), sd.mul(kf.mul(0.0195).sub(0.04)))
        pr.assign(max(pr, sstep(0.005, -0.005, length(f.sub(tc)).sub(kf.mul(-0.0014).add(0.0115)) as F).mul(0.8)))
      })
      const along = sstep(PW - 0.3, PW - 0.7, abs(p.x) as F)
      h.subAssign(pr.mul(0.03).mul(along).mul(lf))
      // the ox: cloven prints, two toes with a slot between, 0.5 m apart
      const zO = p.y.sub(ROWZ(HERO - 1) - SP / 2)
      const j = floor(p.x.div(0.25)).toVar()
      const so = fract(j.mul(0.5)).mul(4).sub(1)
      const g = vec2(p.x.sub(j.add(0.5).mul(0.25)).sub(hash21(vec2(j, 3.3)).sub(0.5).mul(0.05)), zO.sub(so.mul(0.07))).toVar()
      const toe = length(vec2(g.x.mul(0.55), abs(g.y).sub(0.027).add(g.x.mul(0.1)))).sub(0.021).add(g.x.mul(0.09))
      h.subAssign(sstep(0.012, -0.012, toe as F).mul(0.032).mul(along).mul(lf))
    })
    // the head ditch that feeds the hero plot, cut into the baulk on its left
    h.subAssign(gauss(p.x.add(PW + 0.4) as F, 0.11).mul(0.12).mul(sstep(CELL[1] * 1.5 + 0.2, CELL[1] * 1.5 - 0.2, abs(p.y.add(CELL[1])) as F)))
    h.assign(h.mul(q.land))
    // the canal: water below, spoil banks beside it
    h.addAssign(sstep(1.7, 1.1, q.dc).mul(-0.75).add(gauss(q.dc.sub(2.35) as F, 0.55).mul(0.5)))
    return h
  }).setLayout({ name: "tabletFieldH", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "par", type: "vec2" }] })

  /** The field's height with the walls and rooms on it (they only exist once they can be in frame). */
  const fieldH = (p: V2): F => {
    const h = fieldHf(p, PAR).toVar()
    If(U.px.greaterThan(0.004), () => {
      Loop(BOXES.length, ({ i }) => {
        const b = U.boxes.element(i) as unknown as V4
        const e = max(abs(p.x.sub(b.x)).sub(b.z), abs(p.y.sub(b.y)).sub(b.w))
        h.assign(max(h, sstep(0.04, -0.04, e as F).mul(U.boxH.element(i) as unknown as F)))
      })
    })
    return h as F
  }

  /** Relief too fine to cast a shadow of its own: crumb, grit, and the cracked crust of unploughed silt. */
  const fieldMicroF = Fn(([p, par]: [V2, V2]) => {
    const px = par.x as F
    const q = plotAt(p)
    const on = cutMask(p, q, par.y as F).mul(q.amp)
    const m = float(0).toVar()
    const l1 = lodP(0.08, px).toVar()
    If(l1.greaterThan(0), () => {
      m.addAssign(vnoise(p.mul(9)).sub(0.5).mul(0.02).add(vnoise(p.mul(23).add(4.1)).sub(0.5).mul(0.012)).mul(on.mul(0.8).add(0.2)).mul(l1))
    })
    const l2 = lodP(0.012, px).toVar()
    If(l2.greaterThan(0), () => {
      m.addAssign(vnoise(p.mul(70)).sub(0.5).mul(0.006).add(vnoise(p.mul(230)).sub(0.5).mul(0.002)).mul(l2))
    })
    // polygons of dried silt wherever nothing has been turned: plates a hand across, edges curled up
    const crust = on.oneMinus().mul(q.land).mul(lodP(0.1, px)).toVar()
    If(crust.greaterThan(0.01), () => {
      const w = p.mul(3.6).add(vec2(vnoise(p.mul(1.9)), vnoise(p.mul(1.9).add(9.1))).mul(1.5)).toVar()
      const e = vor2(w).toVar()
      const edge = e.y.sub(e.x)
      // each plate is dished: its rim lifts toward the crack, and the crack is a dark slot
      m.addAssign(sstep(0.4, 0.07, edge as F).mul(0.01).mul(crust).sub(sstep(max(float(0.04), px.mul(11)), 0.008, edge as F).mul(0.03).mul(crust).mul(lodP(0.03, px))))
      If(lodP(0.02, px).greaterThan(0), () => {
        const e2 = vor2(w.mul(3.1).add(4.4)).toVar()
        m.subAssign(sstep(0.05, 0.0, e2.y.sub(e2.x) as F).mul(0.008).mul(crust).mul(lodP(0.02, px)))
      })
    })
    return m
  }).setLayout({ name: "tabletFieldMicro", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "par", type: "vec2" }] })

  const fieldMicro = (p: V2): F => fieldMicroF(p, PAR) as F

  // ---------------------------------------------------------------- the projected grid

  const GX = 208, GY = 118
  const gridGeo = new THREE.PlaneGeometry(2.24, 2.24, GX, GY)
  gridGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
  // the tablet's grid is drawn finer toward the middle of the frame, where the macro looks
  const gridGeoT = new THREE.PlaneGeometry(2, 2, 372, 210)
  {
    const pos = gridGeoT.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i)
      pos.setXY(i, Math.sign(x) * (0.45 * Math.abs(x) + 0.67 * Math.abs(x) ** 2.2), Math.sign(y) * (0.45 * Math.abs(y) + 0.67 * Math.abs(y) ** 2.2))
    }
    gridGeoT.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
  }
  /** Where this grid vertex's view ray meets the plane y = 0. */
  const gridHit = (): V2 => {
    const dir = U.fwd.add(U.right.mul(positionGeometry.x)).add(U.up.mul(positionGeometry.y))
    const t = U.pos.y.negate().div(min(dir.y, -1e-4))
    return U.pos.xz.add(dir.xz.mul(t)) as V2
  }
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)

  /** The surface normal of a height field from one evaluation: its slope across the pixel, turned back into world axes. */
  const slopeN = (p: V2, h: F): V3 => {
    const ax = dFdx(p).toVar(), ay = dFdy(p).toVar()
    const hx = dFdx(h).toVar(), hy = dFdy(h).toVar()
    const det = ax.x.mul(ay.y).sub(ax.y.mul(ay.x)).toVar()
    const inv = select(det.lessThan(0), float(-1), float(1)).div(max(abs(det), 1e-14))
    const gx = hx.mul(ay.y).sub(hy.mul(ax.y)).mul(inv)
    const gz = hy.mul(ax.x).sub(hx.mul(ay.x)).mul(inv)
    return normalize(vec3(gx.negate(), 1, gz.negate())) as V3
  }

  // ---------------------------------------------------------------- the world rule

  /** Sun, sky and a wet sheen on clay. `sh` is the marched shadow, `ao` the sky's share. */
  const clayLit = (alb: V3, N: V3, V: V3, sh: F, ao: F, wet: F): V3 => {
    const L = U.sun
    const ndl = max(dot(N, L), 0)
    const Hh = normalize(L.add(V))
    const spec = pow(max(dot(N, Hh), 0), 90).mul(wet).mul(2.2).add(pow(max(dot(N, Hh), 0), 12).mul(wet).mul(0.12))
    // the sky in a film of water, more at a glancing angle
    const fres = pow(sat1(dot(N, V).oneMinus() as F), 3).mul(0.5).add(0.06).mul(wet)
    const bounce = vec3(0.5, 0.36, 0.22).mul(sat1(N.y.oneMinus().mul(1.4) as F)).mul(0.35)
    return alb.mul(SUNC.mul(ndl).mul(sh).add(SKYC.mul(N.y.mul(0.4).add(0.6)).mul(ao)).add(bounce.mul(ao))).add(SUNC.mul(spec).mul(sh)).add(SKYC.mul(fres).mul(1.6)) as V3
  }
  /** Is the sun hidden from a point at height `h0`? A short march up the sun's ray through `H`. */
  const marched = (H: (p: V2) => F, p: V2, h0: F, reach: Num): F => {
    const sh = float(1).toVar()
    const s = fl(reach).mul(0.03).toVar()
    Loop(6, () => {
      const c = H(p.add(LDn.mul(s)) as V2).sub(h0).sub(s.mul(TAN_E))
      sh.assign(min(sh, sat1(c.div(s.mul(0.16)) as F).oneMinus()))
      s.mulAssign(1.8)
    })
    return sh as F
  }
  /** The long shadows of the walls (the march does not reach that far). */
  const boxShadow = (p: V2, h0: F): F => {
    const sh = float(1).toVar()
    Loop(BOXES.length, ({ i }) => {
      const b = U.boxes.element(i) as unknown as V4
      const hgt = (U.boxH.element(i) as unknown as F).sub(h0)
      const o = p.sub(b.xy).toVar()
      // slabs: where the ray toward the sun is over the box's footprint
      const t1 = b.zw.negate().sub(o).div(LDn)
      const t2 = b.zw.sub(o).div(LDn)
      const tn = max(min(t1.x, t2.x), min(t1.y, t2.y))
      const tf = min(max(t1.x, t2.x), max(t1.y, t2.y))
      const hit = step(tn, tf).mul(step(0, tf))
      const edge = sat1(hgt.sub(max(tn, 0).mul(TAN_E)).div(max(tn, 0.2).mul(0.05)) as F)
      sh.assign(min(sh, hit.mul(edge).oneMinus()))
    })
    return sh as F
  }

  // ---------------------------------------------------------------- the field: ground

  const fieldScene = new THREE.Scene()
  const fieldWorld = Fn(() => {
    const xz = gridHit()
    return vec3(xz.x, fieldHf(xz, PAR), xz.y)
  })()
  const groundMat = new THREE.NodeMaterial()
  groundMat.vertexNode = viewProj.mul(vec4(fieldWorld, 1))
  groundMat.fragmentNode = Fn(() => {
    const P = fieldWorld.toVarying()
    const p = P.xz.toVar()
    const h0 = fieldH(p).toVar()
    const m0 = fieldMicro(p).toVar()
    const N = slopeN(p as V2, h0.add(m0) as F).toVar()
    const V = normalize(U.pos.sub(vec3(p.x, h0, p.y))).toVar()
    const q = plotAt(p)
    const on = cutMask(p, q, U.cut as unknown as F).mul(q.amp).toVar()
    const trough = gauss(q.v, 0.17).mul(on).toVar()

    // ---- what the ground is made of
    const tone = fbm(p.mul(0.9)).mul(0.5).add(vnoise(p.mul(7)).mul(0.5)).toVar()
    const dry = vec3(0.6, 0.5, 0.37).mul(tone.mul(0.3).add(0.84)).mul(mixN(float(1), q.kh.mul(0.34).add(0.8), q.hero.oneMinus())).toVar()
    // turned soil is damp and darker; the older the row, the more it has dried back
    const age = mixN(float(0.55), sstep(0, HERO, q.row).mul(0.75).add(0.25), q.hero)
    const damp = vec3(0.33, 0.245, 0.17)
    const alb = mixN(dry, damp, on.mul(age).mul(trough.mul(0.55).add(0.45))).toVar()
    // straw and chaff in the fallow crust, pale flecks on the baulk's worn path
    const fleck = step(0.93, vnoise(p.mul(vec2(60, 190)))).mul(lod(0.02)).mul(on.oneMinus())
    alb.assign(mixN(alb, vec3(0.74, 0.66, 0.46), fleck.mul(0.5)))
    alb.mulAssign(mixN(float(1), float(1.12), sstep(0.05, 0.3, q.dl)))
    // the slots between the crust's plates are dark all the way down
    alb.mulAssign(sstep(-0.006, -0.02, m0).mul(0.6).oneMinus())
    // young crop: green along the rows; flooded plot: dark, wet
    const crop = isK(q.kind, 3).mul(sstep(-0.1, -0.4, q.dl)).mul(gauss(q.v, 0.2)).mul(vnoise(p.mul(9)).mul(0.5).add(0.6))
    alb.assign(mixN(alb, vec3(0.2, 0.34, 0.1), sat1(crop as F).mul(0.85)))
    const wet = float(0).toVar()
    const flood = isK(q.kind, 4).mul(sstep(-0.05, -0.3, q.dl)).mul(sstep(0.03, -0.02, h0.sub(fbm(p.mul(0.6)).mul(0.05)) as F))
    wet.assign(max(wet, flood))
    // seed in the troughs of the rows sown but not yet up: barley grains, pale and long
    const ls = lod(0.03).mul(q.hero).mul(sstep(5.5, 6.5, q.row)).mul(sstep(float(HERO).add(0.5), float(HERO).sub(0.5), q.row)).toVar()
    If(ls.greaterThan(0), () => {
      const c = floor(p.div(vec2(0.03, 0.024))).toVar()
      const hh = hash22(c.add(3.7)).toVar()
      const g = p.sub(c.add(0.3).add(hash22(c.add(8.1)).mul(0.4)).mul(vec2(0.03, 0.024))).toVar()
      const a = hh.x.mul(6.283)
      const gr = vec2(g.x.mul(cos(a)).add(g.y.mul(sin(a))), g.y.mul(cos(a)).sub(g.x.mul(sin(a))))
      const grain = sstep(1.0, 0.6, length(gr.div(vec2(0.0055, 0.0026))) as F).mul(step(0.45, hh.y)).mul(gauss(q.v, 0.1)).mul(ls)
      alb.assign(mixN(alb, vec3(1.25, 0.95, 0.42).mul(gr.y.div(0.0026).mul(0.25).add(0.9)), grain))
    })
    // shoots, once they are too small to be geometry: a green thread along the oldest rows
    const up = sstep(0, 2.5, U.grow.sub(q.row.mul(0.9)) as F).mul(q.hero).mul(sstep(5.6, 5.4, q.row))
    alb.assign(mixN(alb, vec3(0.2, 0.38, 0.1), up.mul(gauss(q.v, 0.06)).mul(sstep(0.004, 0.02, U.px)).mul(sstep(-0.3, -0.5, q.dl)).mul(0.8)))
    // ---- water let in from the head ditch: down the ditch, then along each trough in turn
    const zr = q.row.add(0.5).mul(SP).sub(PH)
    const tRow = zr.add(PH + 0.6).div(1.25)
    const front = U.wetT.sub(tRow).mul(q.row.mul(0.37).sin().mul(0.25).add(1.5)).sub(PW).add(vnoise(p.mul(vec2(2.3, 9))).mul(0.5))
    const inRow = q.hero.mul(sstep(8.6, 8.4, q.row)).mul(sstep(front, front.sub(0.3), p.x)).mul(sstep(0.1, 0.5, on))
    const soak = inRow.mul(sstep(sat1(U.wetT.sub(tRow).mul(0.02).add(0.2) as F), 0.03, abs(q.v) as F))
    const film = inRow.mul(sstep(max(float(0.075), U.px.mul(2.2 / SP)), 0.045, abs(q.v) as F)).toVar()
    const ditch = gauss(p.x.add(PW + 0.4) as F, 0.1).mul(sstep(U.wetT.mul(1.25).sub(PH + 0.6), U.wetT.mul(1.25).sub(PH + 1.1), p.y)).mul(step(-CELL[1] * 2.4, p.y))
    film.assign(max(film, sstep(0.3, 0.7, ditch as F)))
    alb.assign(mixN(alb, alb.mul(vec3(0.4, 0.34, 0.3)), sat1(soak.add(ditch) as F)))
    alb.assign(mixN(alb, vec3(0.1, 0.08, 0.055), film.mul(0.8)))
    wet.assign(max(wet, max(soak.mul(0.35), film)))
    // the canal: silty water, reeds on the banks
    const water = sstep(1.55, 1.25, q.dc).toVar()
    alb.assign(mixN(alb, vec3(0.13, 0.15, 0.1), water))
    const reed = gauss(q.dc.sub(1.85) as F, 0.3).mul(step(0.45, vnoise(p.mul(vec2(5, 2.2)))))
    alb.assign(mixN(alb, vec3(0.16, 0.24, 0.08).mul(vnoise(p.mul(31)).mul(0.6).add(0.6)), reed.mul(0.85)))
    wet.assign(max(wet, water))
    // standing water is flat, with a breeze on it
    const rip = vec2(vnoise(p.mul(7).add(vec2(U.time.mul(0.4), 0))), vnoise(p.mul(7).add(vec2(3.1, U.time.mul(0.33))))).sub(0.5).mul(0.1)
    const flat = max(max(film, water), flood).toVar()
    N.assign(normalize(mixN(N, vec3(rip.x, 1, rip.y), flat)))
    // walls and roofs: mud plaster, the roofs a shade darker
    const wall = sstep(0.4, 0.9, h0).toVar()
    alb.assign(mixN(alb, vec3(0.62, 0.5, 0.36).mul(vnoise(p.mul(2.1)).mul(0.14).add(0.9)).mul(mixN(float(1), float(0.86), sstep(2.3, 2.6, h0))), wall))

    // ---- light
    // furrows shade themselves in closed form: the two ridges up-sun of this point, each with the line its shadow falls along
    const sh = float(1).toVar()
    If(on.greaterThan(0.01), () => {
      const k1 = isK(q.kind, 1)
      const sp = mixN(float(SP), float((2 * PW) / 17), k1)
      const te = float(TAN_E).div(mixN(float(-LD[1]), float(-LD[0]), k1)) // rise of the sun's ray per unit across the rows
      const a = q.v.mul(sp)
      const rag = vnoise(p.mul(vec2(5.3, 5.3))).mul(0.5).add(0.75).add(vnoise(p.mul(31)).sub(0.5).mul(0.3).mul(lod(0.06)))
      const peak = float(0.04).mul(on).mul(rag)
      const soft = U.px.mul(te).mul(1.2)
      for (const at of [-0.31, -0.69, -1.31]) {
        const line = peak.sub(a.sub(sp.mul(at)).mul(te))
        sh.assign(min(sh, sstep(soft.negate().sub(0.01), soft.add(0.004), line.sub(h0) as F).mul(step(sp.mul(at), a)).oneMinus()))
      }
    })
    // clods throw their own: three short steps up the sun's ray
    If(lod(0.05).mul(q.hero).greaterThan(0), () => {
      const base = h0.sub(clodsF(p, PAR))
      for (const st2 of [0.014, 0.034, 0.075]) {
        const pp = p.add(LDn.mul(st2))
        const c = clodsF(pp, PAR).add(base).sub(h0).sub(st2 * TAN_E)
        sh.assign(min(sh, sat1(c.div(st2 * 0.2) as F).oneMinus()))
      }
    })
    If(U.px.greaterThan(0.004), () => {
      sh.assign(min(sh, boxShadow(p as V2, h0 as F)))
    })
    const ao = sat1(h0.mul(3.2).add(0.92).add(wall) as F)
    const col = clayLit(alb as V3, N as V3, V as V3, sh as F, ao as F, wet as F).toVar()
    col.addAssign(vec3(0.42, 0.56, 0.78).mul(0.5).mul(max(film, water.mul(0.35))).mul(rip.x.mul(3).add(1)))
    return vec4(col, 1)
  })()
  const ground = new THREE.Mesh(gridGeo, groundMat)
  ground.frustumCulled = false
  fieldScene.add(ground)

  // ---------------------------------------------------------------- the field: shoots (two leaves each, and their shadows)

  const SH_ROWS = 6, SH_PER = 150
  const shootGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    const pos: number[] = []
    const idx: number[] = []
    const SEG = 5
    for (let b = 0; b < 2; b++)
      for (let i = 0; i <= SEG; i++)
        for (const sd of [-1, 1]) pos.push(sd, i / SEG, b)
    for (let b = 0; b < 2; b++)
      for (let i = 0; i < SEG; i++) {
        const o = b * (SEG + 1) * 2 + i * 2
        idx.push(o, o + 1, o + 3, o, o + 3, o + 2)
      }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const R = rng(1414)
    const a: number[] = []
    for (let r = 0; r < SH_ROWS; r++)
      for (let i = 0; i < SH_PER; i++) {
        const x = -PW + 0.5 + ((i + R() * 0.8) / SH_PER) * (2 * PW - 1.0)
        a.push(x, ROWZ(r) + (R() - 0.5) * 0.07, R(), r + R() * 0.9)
      }
    g.setAttribute("aS", new THREE.InstancedBufferAttribute(new Float32Array(a), 4))
    g.instanceCount = SH_ROWS * SH_PER
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  })()
  const shootMat = (shadow: boolean) => {
    const m = new THREE.NodeMaterial()
    const aS = attribute("aS", "vec4") as unknown as V4
    const t = positionGeometry.y
    const blade = positionGeometry.z
    const g = sstep(0, 2.6, U.grow.sub(aS.w.mul(0.9)) as F).toVar()
    const world = Fn(() => {
      const base = vec2(aS.x, aS.y).toVar()
      const y0 = fieldH(base)
      const len = g.mul(aS.z.mul(0.07).add(0.075))
      const az = aS.z.mul(47.1).add(blade.mul(3.14159)).add(sin(aS.x.mul(13)).mul(0.5))
      const dir = vec2(cos(az), sin(az))
      const sway = sin(U.time.mul(2.1).add(aS.x.mul(3.1)).add(aS.y.mul(5))).mul(0.008).mul(t.mul(t))
      const out = t.pow(1.7).mul(len).mul(blade.mul(0.25).add(0.5))
      const rise = t.sub(t.mul(t).mul(0.3)).mul(len)
      const wid = max(t.oneMinus().mul(t.add(0.25)).mul(0.012).mul(g), U.px.mul(0.7).mul(t.oneMinus()))
      const xz = base.add(dir.mul(out.add(sway))).add(vec2(dir.y.negate(), dir.x).mul(wid).mul(positionGeometry.x))
      const p3 = vec3(xz.x, y0.add(rise), xz.y).toVar()
      if (shadow) {
        // laid along the sun's ray onto the ground under it
        const d = rise.div(TAN_E)
        const s2 = p3.xz.sub(LDn.mul(d))
        p3.assign(vec3(s2.x, fieldH(s2).add(0.003), s2.y))
      }
      return p3
    })()
    m.vertexNode = viewProj.mul(vec4(world, 1))
    const fade = sstep(0.03, 0.012, U.px)
    if (shadow) {
      m.fragmentNode = vec4(vec3(0.02, 0.025, 0.04).mul(0.5), float(0.5).mul(fade).mul(g))
      m.transparent = true
      m.depthWrite = false
      m.blending = THREE.CustomBlending
      m.blendSrc = THREE.OneFactor
      m.blendDst = THREE.OneMinusSrcAlphaFactor
    } else {
      const tv = t.toVarying()
      const sv = positionGeometry.x.toVarying()
      m.fragmentNode = Fn(() => {
        // a midrib, a paler tip, light through the blade
        const c = mixN(vec3(0.1, 0.26, 0.045), vec3(0.34, 0.52, 0.12), tv).mul(abs(sv).mul(0.35).add(0.75))
        const lit = c.mul(SUNC.mul(0.62).add(SKYC.mul(1.2)))
        return vec4(lit, 1)
      })()
      m.side = THREE.DoubleSide
    }
    return m
  }
  const shoots = new THREE.Mesh(shootGeo, shootMat(false))
  const shootSh = new THREE.Mesh(shootGeo, shootMat(true))
  shoots.frustumCulled = shootSh.frustumCulled = false
  shootSh.renderOrder = 1
  shoots.renderOrder = 2
  fieldScene.add(shootSh, shoots)
  ground.renderOrder = -3 // (before the people's shadows: makeShadow draws at -2 and -1)

  // ---------------------------------------------------------------- the far view: date palms on the canal's banks and in the yard

  // Date palms (Phoenix dactylifera): a trunk 7 to 11 m tall, scaled with old leaf bases, and a crown of about twenty
  // fronds, each 3 to 4 m of rachis with stiff leaflets in a V, the youngest standing up, the oldest hanging. All
  // geometry: one strip per frond, the leaflets cut out of it in the fragment stage; the shadow is the same geometry
  // laid down the sun's ray onto the ground (as the shoots' are).
  const PALMS: [number, number, number][] = []
  {
    const R = rng(1607)
    for (let z = -27; z < 27; z += 3.2 + R() * 2.6) {
      for (const side of [-1, 1]) {
        if (R() < 0.3) continue
        const x = CANAL_X + Math.sin(z * 0.06) * 1.4 + side * (2.5 + R() * 1.4)
        PALMS.push([x, z + (R() - 0.5) * 1.2, 7 + R() * 4])
      }
    }
    // a few in the compound's yard and by its gate
    PALMS.push([-16.2, -9.6, 7.4], [-17.4, -5.6, 8.2])
  }
  const FRONDS = 20, FSEG = 14
  const palmGeo = (() => {
    const g = new THREE.InstancedBufferGeometry()
    const pos: number[] = [], idx: number[] = []
    // the trunk: 8 sides, 10 rings, unit height (z = -1 marks a trunk vertex)
    for (let r = 0; r <= 10; r++)
      for (let k = 0; k <= 8; k++) pos.push(k / 8, r / 10, -1)
    for (let r = 0; r < 10; r++)
      for (let k = 0; k < 8; k++) {
        const a = r * 9 + k
        idx.push(a, a + 9, a + 1, a + 1, a + 9, a + 10)
      }
    // fronds: (across -1..1, along 0..1, frond index)
    for (let f = 0; f < FRONDS; f++) {
      const o = pos.length / 3
      for (let i = 0; i <= FSEG; i++) for (const sd of [-1, 1]) pos.push(sd, i / FSEG, f)
      for (let i = 0; i < FSEG; i++) {
        const a = o + i * 2
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
      }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(new Float32Array(PALMS.flatMap(([x, z, h], i) => [x, z, h, hash01(i)])), 4))
    g.instanceCount = PALMS.length
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  })()
  const palmMat = (shadow: boolean) => {
    const m = new THREE.NodeMaterial()
    const aP = attribute("aP", "vec4") as unknown as V4
    const gx = positionGeometry.x, gy = positionGeometry.y, gz = positionGeometry.z
    const trunk = step(gz, -0.5)
    const N3 = Fn(() => {
      const base = vec3(aP.x, fieldH(aP.xy as V2), aP.y).toVar()
      const H = aP.z
      // the trunk leans a little and bows; its top is the crown's centre
      const lean = vec2(cos(aP.w.mul(40)), sin(aP.w.mul(40))).mul(0.07)
      const top = base.add(vec3(lean.x.mul(H), H, lean.y.mul(H))).toVar()
      const out = vec3(0).toVar()
      If(trunk.greaterThan(0.5), () => {
        const a = gx.mul(6.2832)
        const rad = mixN(float(0.3), float(0.21), gy).mul(sin(gy.mul(140).add(aP.w.mul(9))).mul(0.06).add(1))
        const bow = sin(gy.mul(3.1416)).mul(H).mul(0.03)
        out.assign(mixN(base, top, gy).add(vec3(cos(a).mul(rad).add(lean.y.mul(bow)), 0, sin(a).mul(rad).sub(lean.x.mul(bow)))))
      }).Else(() => {
        // frond f: its azimuth on a golden spiral, its rise from up (young) to drooping (old), and its length
        const f = gz
        const age = fract(f.mul(0.6180339).add(aP.w)).toVar()
        const az = f.mul(2.39996).add(aP.w.mul(6.28))
        const dir = vec2(cos(az), sin(az))
        const rise = mixN(float(1.15), float(-0.55), age) // radians above the horizontal at the base
        const L = mixN(float(2.6), float(3.8), sin(age.mul(3.1416))).mul(H.mul(0.03).add(0.75))
        const t = gy
        // the rachis arches: its angle falls along it, more for an old frond
        const ang = rise.sub(t.mul(t).mul(mixN(float(0.6), float(1.4), age)))
        const sAng = rise.mul(t).sub(t.mul(t).mul(t).mul(mixN(float(0.6), float(1.4), age)).div(3))
        // (integrated along the frond: horizontal reach and height)
        const reach = L.mul(t).mul(cos(sAng.div(max(t, 0.001)).mul(0.5).add(ang.mul(0.5))))
        const up = L.mul(t).mul(sin(sAng.div(max(t, 0.001)).mul(0.5).add(ang.mul(0.5))))
        const side = vec2(dir.y.negate(), dir.x)
        const wid = sin(t.mul(3.1416)).pow(0.6).mul(0.55).mul(gx)
        // leaflets stand up in a V: the strip's sides lift
        const sway = sin(U.time.mul(1.3).add(aP.w.mul(20)).add(f)).mul(0.05).mul(t)
        const xz = top.xz.add(dir.mul(reach)).add(side.mul(wid.add(sway)))
        out.assign(vec3(xz.x, top.y.add(up).add(abs(wid).mul(0.35)), xz.y))
      })
      if (shadow) {
        const d = out.y.sub(fieldH(out.xz as V2)).div(TAN_E)
        const s2 = out.xz.sub(LDn.mul(d))
        out.assign(vec3(s2.x, fieldH(s2 as V2).add(0.02), s2.y))
      }
      return vec4(out, 0)
    })
    const wv = N3()
    m.vertexNode = viewProj.mul(vec4(wv.xyz, 1))
    const tv = gy.toVarying(), sv = gx.toVarying(), kv = trunk.toVarying(), wsd = aP.w.toVarying(), fv = gz.toVarying()
    const vis = U.px.greaterThan(0.004).select(float(1), float(0))
    // the leaflets: stiff, in pairs along the rachis, each a narrow blade; the rachis itself
    const leaf = (): F => {
      const along = tv.mul(46).add(abs(sv).mul(2.2)).add(fv.mul(0.37))
      const blade = sstep(0.42, 0.22, abs(fract(along).sub(0.5)) as F)
      const rach = sstep(0.12, 0.05, abs(sv) as F)
      const tip = sstep(1.0, 0.75, abs(sv).add(tv.mul(0.3)) as F)
      return max(blade.mul(tip), rach).mul(step(0.08, tv)) as F
    }
    if (shadow) {
      m.fragmentNode = Fn(() => {
        const a = max(kv, leaf()).mul(0.5).mul(vis)
        If(a.lessThan(0.01), () => {
          Discard()
        })
        return vec4(vec3(0.02, 0.025, 0.04).mul(a), a)
      })()
      m.transparent = true
      m.depthWrite = false
      m.blending = THREE.CustomBlending
      m.blendSrc = THREE.OneFactor
      m.blendDst = THREE.OneMinusSrcAlphaFactor
    } else {
      m.fragmentNode = Fn(() => {
        If(kv.lessThan(0.5).and(leaf().lessThan(0.5)), () => {
          Discard()
        })
        If(vis.lessThan(0.5), () => {
          Discard()
        })
        // fronds: grey-green, paler toward the tip, light through them; the trunk: grey-brown, scaled
        const fr = mixN(vec3(0.16, 0.2, 0.11), vec3(0.3, 0.33, 0.2), tv.mul(0.6).add(hash21(vec2(fv, wsd)).mul(0.4))).toVar()
        const scales = sin(tv.mul(160)).mul(0.5).add(0.5)
        const tr = vec3(0.33, 0.27, 0.2).mul(scales.mul(0.35).add(0.6))
        const alb = mixN(fr, tr, kv)
        const lit = alb.mul(SUNC.mul(mixN(float(0.55), float(0.45), kv)).add(SKYC.mul(0.9)))
        return vec4(lit, 1)
      })()
      m.side = THREE.DoubleSide
    }
    return m
  }
  const palms = new THREE.Mesh(palmGeo, palmMat(false))
  const palmSh = new THREE.Mesh(palmGeo, palmMat(true))
  palms.frustumCulled = palmSh.frustumCulled = false
  palmSh.renderOrder = 1
  palms.renderOrder = 3
  fieldScene.add(palmSh, palms)

  // ---------------------------------------------------------------- the far view: people working the neighbouring plots

  // The toolkit's people (human.ts), one body type, small at this distance: what reads from straight above is the
  // head and shoulders and the long shadow. All well away from the newest furrow and out of the plot being ploughed.
  type Folk = { x: number; z: number; face: number; pose: "crouch" | "stoop" | "stand"; seed: number; scale: number }
  const FOLK: Folk[] = [
    { x: -9.0, z: 1.6, face: 0.3, pose: "crouch", seed: 0.11, scale: 1.0 },
    { x: -11.4, z: 2.3, face: -2.6, pose: "crouch", seed: 0.47, scale: 0.96 },
    { x: 2.6, z: 8.6, face: 1.4, pose: "stoop", seed: 0.73, scale: 1.03 },
    { x: 6.3, z: -6.0, face: 2.8, pose: "stand", seed: 0.29, scale: 0.98 },
  ]
  const folkH = HU.makeHuman(HU.adultA)
  const folkLook = { ...HU.humanLook(folkH, { skin: 0x5e4535, hair: 0x15100c, garment: "wrap", hide: 0x9c8a6c, dust: 0.8 }), rough: 0.85, spec: 0.07 }
  const folkAims = FOLK.map((f) => makeAim([f.x, 0, f.z], [Math.cos(f.face), 0, Math.sin(f.face)]))
  const folkL: Lights = { key: U.sun as unknown as V3, keyCol: SUNC.mul(0.8) as V3, sky: SKYC.mul(0.6) as V3, bounce: vec3(0.5, 0.38, 0.25).mul(0.35) as V3 }
  const folk = makeHerd({
    spec: folkH.spec, count: FOLK.length, path: folkAims[0], lods: [{ detail: 0.5, cover: 0 }],
    material: (n, _l, kind) => (kind === "cards" ? featherMaterial(n, folkL, { ...folkLook, base: 0x15100c, belly: 0x15100c, rough: 0.8, spec: 0.06, wrap: 0.3, rim: 0.05, bleed: 0x050403 }) : skinMaterial(n, folkL, folkLook)),
  })
  folk.group.traverse((o) => (o.frustumCulled = false))
  FOLK.forEach((f, i) => folk.tint.set([1 - 0.04 * i, 1 - 0.02 * i, 1], i * 3))
  const folkSh = makeShadow(folk, { light: U.sun as unknown as V3, ground: (xz) => fieldHf(xz, PAR) as F, strength: 0.62 })
  fieldScene.add(folk.group, folkSh.group)
  const folkT = { time: 0 }
  const fTarget = [0, 0, 0]
  const folkFill = (i: number, d: Drive) => {
    const f = FOLK[i]
    d.path = folkAims[i]
    d.dist = 0
    d.lane = 0
    d.rise = 0
    d.scale = f.scale
    d.seed = f.seed
    d.time = folkT.time + f.seed * 7
    fTarget[0] = f.x + Math.cos(f.face) * 0.55
    fTarget[1] = 0.02
    fTarget[2] = f.z + Math.sin(f.face) * 0.55
    if (f.pose === "crouch") HU.crouch(folkH, d, d.time, { look: fTarget, lookAt: -10 })
    else if (f.pose === "stoop") HU.reachTo(folkH, d, d.time, { target: fTarget, w: 0.55 + 0.45 * Math.sin(d.time * 1.4) })
    else HU.stand(folkH, d, d.time, { look: [f.x - 6, 1.5, f.z + 2], lookAt: -10 })
  }

  // ---------------------------------------------------------------- the rule of ages: sun-baked steel, dusted with silt

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "inked", debug: ctx.debugLabels, fonts: { name: ctx.fonts.fell, mono: ctx.fonts.mono }, ink: "#150f0a" }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const brush = vnoise(vec2(st.x.mul(60), st.y.mul(190))).mul(0.6).add(vnoise(vec2(st.x.mul(210), st.y.mul(640))).mul(0.4)).toVar()
    const metal = vec3(0.6, 0.6, 0.6).mul(brush.mul(0.3).add(0.85))
    // silt: settled toward the bevel and the ends, a thumb's smear of dried slip, grains in the brushing
    const dn = fbm(st.mul(vec2(46, 5))).toVar()
    const dust = sat1(sstep(0.42, 0.72, dn.add(st.y.oneMinus().mul(0.28)).add(abs(st.x.sub(0.5)).mul(0.25)) as F).mul(0.75).add(sstep(0.55, 0.9, vnoise(st.mul(vec2(900, 60)))).mul(0.25)) as F).toVar()
    const smear = gauss(st.x.sub(0.415).add(st.y.mul(0.012)) as F, 0.02).mul(vnoise(vec2(st.x.mul(30), st.y.mul(300))).mul(0.7).add(0.3)).mul(0.55)
    const silt = vec3(0.7, 0.59, 0.43)
    const base = mixN(metal, silt, max(dust.mul(0.45), smear)).toVar()
    // the cuts stay dark: dust has been wiped out of them
    const col = mixN(base, cut.rgb, on).toVar()
    const lit = col.mul(SKYC.mul(0.9).add(SUNC.mul(0.3))).add(SUNC.mul(pow(brush, 3)).mul(0.035).mul(on.oneMinus()).mul(dust.oneMinus()))
    return vec4(ctx.debugLabels ? mixN(lit, cut.rgb.mul(4), on) : lit, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const ruleGeo = ruleGeometry()
  const ruleF = new THREE.Mesh(ruleGeo, ruleMat)
  ruleF.renderOrder = 10
  ruleF.frustumCulled = false
  fieldScene.add(ruleF)

  // ---------------------------------------------------------------- the tablet: what is written, and when

  // Three entries, each a drawn sign (an ear of grain: a stalk, then paired side strokes, each
  // planted and pulled) and then round impressions with the reed's butt end. Times are seconds of
  // beat 1. A mark is (kind, ax, az, bx, bz, t0, t1, size): kind 0 a drawn stroke, 1 an impression.
  type Mark = { kind: 0 | 1; a: [number, number]; b: [number, number]; t0: number; t1: number; size: number }
  const MARKS: Mark[] = []
  const ENTRY_END: number[] = []
  {
    const R = rng(3350)
    let t = 2.5
    const counts = [3, 5, 4]
    for (let k = 0; k < 3; k++) {
      const sp = [1, 1.35, 1.8][k] // each entry is written faster than the last
      const zc = -PH + (k + 3) * SP // the middle of a ruled row
      const x0 = -3.55 + (R() - 0.5) * 0.1
      // the stalk, top to bottom
      const top: [number, number] = [x0 + 0.03, zc - 0.21], bot: [number, number] = [x0 - 0.02, zc + 0.215]
      MARKS.push({ kind: 0, a: top, b: bot, t0: t, t1: t + 0.4 / sp, size: 1.5 })
      t += 0.52 / sp
      // three pairs of side strokes, from the stalk outward and upward
      for (let j = 0; j < 3; j++)
        for (const sd of [-1, 1]) {
          const y = zc - 0.07 + j * 0.105 + (R() - 0.5) * 0.015
          const a: [number, number] = [x0 + sd * 0.012, y]
          const b: [number, number] = [x0 + sd * (0.2 + R() * 0.02), y - 0.125 - R() * 0.02]
          MARKS.push({ kind: 0, a, b, t0: t, t1: t + 0.17 / sp, size: 1.15 })
          t += 0.26 / sp
        }
      t += 0.42 / sp // the reed is turned end for end
      for (let j = 0; j < counts[k]; j++) {
        const x = x0 + 0.7 + j * 0.43 + (R() - 0.5) * 0.03
        MARKS.push({ kind: 1, a: [x, zc + (R() - 0.5) * 0.03], b: [x, zc], t0: t, t1: t + 0.24 / sp, size: 0.15 })
        t += 0.36 / sp
      }
      ENTRY_END.push(t)
      t += 0.5 / sp
    }
  }
  const T_DONE = MARKS[MARKS.length - 1].t1
  // the window of the tablet the marks are drawn into (cm): x, z of its corner, and its size
  const MW: [number, number, number, number] = [-4.3, -2.1, 6.4, 2.0]
  const marksRT = ctx.target({ hdr: true, fixed: [2048, 640] })
  marksRT.texture.minFilter = marksRT.texture.magFilter = THREE.LinearFilter
  const uMT = uniform(-1) // seconds of beat 1
  const marksScene = new THREE.Scene()
  const marksCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const A = new Float32Array(MARKS.length * 4), B = new Float32Array(MARKS.length * 4)
    MARKS.forEach((m, i) => {
      A.set([m.a[0], m.a[1], m.b[0], m.b[1]], i * 4)
      B.set([m.t0, m.t1, m.kind, m.size], i * 4)
    })
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 4))
    g.instanceCount = MARKS.length
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const m = new THREE.NodeMaterial()
    const aA = attribute("aA", "vec4") as unknown as V4
    const aB = attribute("aB", "vec4") as unknown as V4
    const PADc = 0.34
    // a quad round the mark, in tablet centimetres
    const lo = min(aA.xy, aA.zw).sub(PADc)
    const hi = max(aA.xy, aA.zw).add(PADc)
    const pc = mixN(lo, hi, positionGeometry.xy.mul(0.5).add(0.5))
    m.vertexNode = vec4(pc.x.sub(MW[0]).div(MW[2]).mul(2).sub(1), pc.y.sub(MW[1]).div(MW[3]).mul(2).sub(1), 0, 1)
    const pv = pc.toVarying()
    const vA = aA.toVarying()
    const vB = aB.toVarying()
    m.fragmentNode = Fn(() => {
      const k = sat1(uMT.sub(vB.x).div(vB.y.sub(vB.x)) as F).toVar()
      const fresh = exp(max(uMT.sub(vB.y), 0).mul(-0.3)).mul(step(0.001, k))
      const outv = vec4(0).toVar()
      If(vB.z.lessThan(0.5), () => {
        // ---- a drawn stroke: the reed's cut end is planted at `a` (deepest, widest) and pulled toward `b`
        const ab = vA.zw.sub(vA.xy)
        const L = length(ab)
        const dir = ab.div(L)
        const rel = pv.sub(vA.xy)
        const sAl = dot(rel, dir).toVar()
        const c = dot(rel, vec2(dir.y.negate(), dir.x)).toVar()
        const len = L.mul(k)
        const u = sat1(sAl.div(L) as F)
        const w = float(0.03).mul(vB.w).mul(u.mul(-0.5).add(1))
        const D = float(0.05).mul(vB.w).mul(u.mul(-0.55).add(1))
        // a capsule from the plant to where the reed is now; it ends square where the reed stands
        const dCap = length(vec2(min(sAl, 0), c))
        const across = sqrt(sq(c).add(sq(dCap)))
        const inside = sstep(len.add(0.006), len.sub(0.004), sAl)
        // the reed's fibres score the floor of the groove along its length
        const fibre = sin(c.mul(520)).mul(0.1).add(sin(c.mul(1310).add(1.7)).mul(0.06)).add(1)
        const groove = D.mul(pow(sat1(sq(across.div(w) as F).oneMinus() as F), 0.7)).mul(inside).mul(fibre)
        // clay goes to one side, the side the reed leans away from, and piles up ahead of it
        const lipS = gauss(c.sub(w.mul(1.5)) as F, 0.016).mul(0.017).add(gauss(c.add(w.mul(1.5)) as F, 0.012).mul(0.005))
        const lip = lipS.mul(vB.w).mul(sstep(-0.03, 0.02, sAl)).mul(sstep(len.add(0.02), len.sub(0.01), sAl))
        const burr = gauss(length(rel.sub(dir.mul(len.add(w.mul(1.2)))).mul(vec2(1, 1))) as F, 0.022).mul(0.02).mul(vB.w).mul(step(0.001, k))
        outv.assign(vec4(groove, max(lip, burr), fresh.mul(sstep(0.09, 0.02, across as F)).mul(inside), 1))
      }).Else(() => {
        // ---- a round impression: the butt end pressed in a little off the vertical, so one side is deeper
        const rel = pv.sub(vA.xy)
        const r = length(rel)
        const R = vB.w
        const press = sat1(k.mul(2.2) as F)
        const floorT = rel.x.div(R).mul(0.22).add(rel.y.div(R).mul(-0.12)).add(0.82)
        const dep = float(0.06).mul(press).mul(floorT).mul(sstep(R, R.mul(0.8), r))
        const ring = gauss(r.sub(R.mul(1.22)) as F, 0.022).mul(0.016).mul(rel.x.div(R).mul(-0.35).add(0.75)).mul(press)
        outv.assign(vec4(dep, ring, fresh.mul(sstep(R.mul(1.3), R, r)), 1))
      })
      return outv
    })()
    Object.assign(m, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.MaxEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor })
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    marksScene.add(mesh)
  }
  const tMarks = uniformTexture(marksRT.texture)
  /** What the reed has done to the clay at `p`: (groove depth, lip height, freshness). */
  const marksAt = (p: V2): V3 => {
    const uvm = vec2(p.x.sub(MW[0]).div(MW[2]), p.y.sub(MW[1]).div(MW[3])).toVar()
    const inW = step(0.002, uvm.x).mul(step(uvm.x, 0.998)).mul(step(0.002, uvm.y)).mul(step(uvm.y, 0.998))
    return sampleRT(tMarks, clampN(uvm, 0.002, 0.998) as V2).rgb.mul(inW) as V3
  }

  // ---------------------------------------------------------------- the tablet's height (centimetres)

  const TU = {
    dry: uniform(0.1), tpx: uniform(0.03), reedA: uniform(new THREE.Vector3()), reedB: uniform(new THREE.Vector3()), reedOn: uniform(0),
    // the writing hand's shadow: the hand (the pads to the middle of the palm) and the forearm, as capsules
    hA: uniform(new THREE.Vector3()), hB: uniform(new THREE.Vector3()), fA: uniform(new THREE.Vector3()), fB: uniform(new THREE.Vector3()),
  }
  /** The reed: 11 cm, 9 mm thick in the grip and whittled to 4 mm at its ends; the grip is 4.3 cm from the cut end, so 6.7 from the butt. */
  const REED_L = 11, REED_R = 0.45, REED_END = 0.2, EXT_CUT = 4.3, EXT_BUTT = REED_L - EXT_CUT
  const RIM = 0.55
  const LINE_OFF = 0.068 // the ruled cut sits where the furrow's shadow is darkest, so the two pictures agree to the pixel
  const sdRound = (p: V2): F => {
    const q = abs(p).sub(vec2(PW - RIM, PH - RIM)).toVar()
    return length(max(q, 0)).add(min(max(q.x, q.y), 0)).sub(RIM) as F
  }
  /** The slab itself: a pillow with a rolled rim, twelve ruled lines, the marks of being shaped. */
  const tabBase = Fn(([p, px]: [V2, F]) => {
    const m = sdRound(p).negate().toVar() // distance in from the edge
    const h = sq(p.x.div(PW) as F).oneMinus().mul(sq(p.y.div(PH) as F).oneMinus()).mul(0.2).toVar()
    const k = sat1(m.div(0.5).oneMinus() as F)
    h.subAssign(sqrt(max(sq(k).oneMinus(), 0)).oneMinus().mul(0.95))
    // patted flat with the palm: broad shallow facets
    h.addAssign(fbm(p.mul(0.55).add(3.1)).sub(0.5).mul(0.05))
    // the ruled lines: a narrow cut with its lip on the far side from the sun, stopping short of the rim
    const rc = p.y.add(PH + LINE_OFF).div(SP)
    const dz = fract(rc).sub(0.5).mul(SP).add(sin(p.x.mul(1.1).add(floor(rc).mul(2.1))).mul(0.012).mul(sstep(0.02, 0.008, px))).toVar()
    const lineOn = sstep(0.32, 0.55, m).mul(vnoise(p.mul(vec2(2.3, 0.4))).mul(0.5).add(0.72))
    const lw = max(float(0.026), px.mul(1.3))
    h.addAssign(exp(sq(dz.div(lw) as F).negate()).mul(-0.03).add(exp(sq(dz.sub(lw.mul(1.9)).div(lw) as F).negate()).mul(0.01)).mul(lineOn))
    // fingerprints on the rim and the corners of the face: friction ridges about half a millimetre apart
    const lf = sstep(0.02, 0.007, px).toVar()
    If(lf.greaterThan(0), () => {
      const c = floor(p.div(1.5)).toVar()
      const hh = hash22(c.add(4.2)).toVar()
      const ctr = c.add(0.25).add(hh.mul(0.5)).mul(1.5)
      const rel = p.sub(ctr).toVar()
      const rr = length(rel.mul(vec2(1, 0.72)))
      const warp = vnoise(p.mul(2.7)).mul(0.5)
      const ridges = sin(rr.add(warp).mul(6.2832 / 0.05).add(rel.x.mul(9)))
      const patch = sstep(0.62, 0.34, rr as F).mul(sstep(1.25, 0.75, m).add(step(0.86, hash21(c.add(1.7))))).mul(vnoise(p.mul(6)).mul(0.8).add(0.3))
      h.addAssign(ridges.mul(0.0024).mul(sat1(patch as F)).mul(lf))
    })
    // grit and chaff in the clay
    const lg = sstep(0.03, 0.01, px).toVar()
    If(lg.greaterThan(0), () => {
      h.addAssign(vnoise(p.mul(23)).sub(0.5).mul(0.006).sub(sstep(0.83, 0.93, vnoise(p.mul(41).add(7.7))).mul(0.012)).mul(lg))
    })
    return h
  }).setLayout({ name: "tabletBase", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "px", type: "float" }] })
  const markH = (mk: V3): F => mk.y.mul(sat1(mk.x.mul(70) as F).oneMinus()).sub(mk.x) as F
  /** What casts shadows on the tablet: the rim's roll, the ruled lines and the marks (not the grain). */
  const tabShadeH = (p: V2): F => {
    const m = sdRound(p).negate()
    const k = sat1(m.div(0.5).oneMinus() as F)
    const dz = fract(p.y.add(PH + LINE_OFF).div(SP)).sub(0.5).mul(SP)
    const lw = max(float(0.026), TU.tpx.mul(1.3))
    return sqrt(max(sq(k).oneMinus(), 0)).oneMinus().mul(-0.95).add(exp(sq(dz.div(lw) as F).negate()).mul(-0.03).add(exp(sq(dz.sub(lw.mul(1.9)).div(lw) as F).negate()).mul(0.01)).mul(sstep(0.32, 0.55, m))).add(markH(marksAt(p))) as F
  }
  const tabH = (p: V2): F => tabBase(p, TU.tpx as unknown as F).add(markH(marksAt(p))) as F

  // ---------------------------------------------------------------- the tablet in the hand

  const tabScene = new THREE.Scene()
  const tabWorld = Fn(() => {
    const hit = gridHit().toVar()
    // keep every vertex on the slab: what falls outside is pulled to its rounded edge
    const sg = vec2(select(hit.x.lessThan(0), -1, 1), select(hit.y.lessThan(0), -1, 1))
    const q = abs(hit).sub(vec2(PW - RIM, PH - RIM)).toVar()
    const qc = max(q, 0).toVar()
    const l = length(qc)
    const inCorner = step(0.0001, qc.x).mul(step(0.0001, qc.y))
    const corner = vec2(PW - RIM, PH - RIM).add(qc.div(max(l, 1e-5)).mul(min(l, RIM - 0.002)))
    const boxed = min(abs(hit), vec2(PW - 0.002, PH - 0.002))
    const xz = mixN(boxed, corner, inCorner).mul(sg).toVar()
    return vec3(xz.x, tabH(xz as V2), xz.y)
  })()
  const viewDepth = (P: V3): F => dot(P.sub(U.pos), normalize(U.fwd)) as F
  const tabMat = new THREE.NodeMaterial()
  tabMat.vertexNode = viewProj.mul(vec4(tabWorld, 1))
  tabMat.fragmentNode = Fn(() => {
    const P = tabWorld.toVarying()
    const p = P.xz.toVar()
    const px = TU.tpx as unknown as F
    const mk = marksAt(p as V2).toVar()
    const h0 = tabBase(p, px).add(markH(mk as V3)).toVar()
    const e = max(px.mul(1.2), 0.0012).toVar()
    const s0 = tabShadeH(p as V2).toVar()
    const gx = tabShadeH(p.add(vec2(e, 0)) as V2).sub(s0).div(e)
    const gz = tabShadeH(p.add(vec2(0, e)) as V2).sub(s0).div(e)
    const Ng = slopeN(p as V2, h0.sub(s0) as F)
    const N = normalize(vec3(gx.negate().sub(clampN(Ng.x.div(Ng.y), -1.5, 1.5).negate()), 1, gz.negate().sub(clampN(Ng.z.div(Ng.y), -1.5, 1.5).negate()))).toVar()
    const V = normalize(U.pos.sub(vec3(p.x, h0, p.y))).toVar()
    const m = sdRound(p as V2).negate().toVar()
    // ---- it dries from the rim inward: paler, matt, and at the edge it starts to craze
    const dn = fbm(p.mul(1.3)).sub(0.5).mul(1.1)
    const dryK = sstep(TU.dry.mul(4.4).add(0.35), TU.dry.mul(4.4).sub(0.45), m.add(dn) as F).toVar()
    const tone = fbm(p.mul(2.1)).mul(0.6).add(fbm(p.mul(13)).mul(0.4)).toVar()
    const wetC = vec3(0.47, 0.37, 0.25).mul(tone.mul(0.26).add(0.86))
    const dryC = vec3(0.69, 0.6, 0.45).mul(tone.mul(0.2).add(0.9))
    const alb = mixN(wetC, dryC, dryK).toVar()
    // temper: dark and pale grains, a void where a straw burnt out or fell out
    const grit = vnoise(p.mul(57))
    alb.mulAssign(mixN(float(1), float(0.72), sstep(0.8, 0.9, grit).mul(sstep(0.04, 0.012, px))))
    alb.assign(mixN(alb, vec3(0.78, 0.72, 0.6), sstep(0.13, 0.07, grit).mul(sstep(0.04, 0.012, px)).mul(0.5)))
    // fresh cuts are darker and wet; their floors hold the light less
    alb.mulAssign(mixN(float(1), float(0.8), sat1(mk.x.mul(30) as F).mul(dryK.oneMinus().mul(0.6).add(0.4))))
    const craze = float(0).toVar()
    const lc = sstep(0.05, 0.02, px).mul(sstep(0.5, 0.95, dryK)).mul(sstep(1.7, 0.6, m.add(dn.mul(0.6)) as F)).toVar()
    If(lc.greaterThan(0.01), () => {
      const ee = vor2(p.mul(2.4).add(vec2(fbm(p.mul(1.9)), fbm(p.mul(1.9).add(5.5))).mul(1.2))).toVar()
      craze.assign(sstep(max(float(0.045), px.mul(4)), 0.008, ee.y.sub(ee.x) as F).mul(lc))
    })
    alb.mulAssign(craze.mul(0.7).oneMinus())
    const wet = dryK.oneMinus().mul(0.42).add(mk.z.mul(0.5)).mul(craze.oneMinus()).toVar()
    const sh = marched(tabShadeH, p as V2, s0 as F, max(px.mul(50), 0.3)).toVar()
    // the reed's, the hand's and the forearm's shadows: each a capsule, its two ends laid down the sun's ray onto the clay, soft where it is high
    If(TU.reedOn.greaterThan(0.5), () => {
      const cap = (A: V3, B: V3, r: number, dark: number) => {
        const a2 = A.xz.sub(LDn.mul(max(A.y.sub(h0), 0).div(TAN_E)))
        const b2 = B.xz.sub(LDn.mul(max(B.y.sub(h0), 0).div(TAN_E)))
        const ab = b2.sub(a2)
        const tt = sat1(dot(p.sub(a2), ab).div(max(dot(ab, ab), 1e-4)) as F)
        const dd = length(p.sub(a2.add(ab.mul(tt))))
        const hgt = max(mixN(A.y, B.y, tt).sub(h0), 0)
        const soft = hgt.mul(0.1).add(0.012)
        sh.assign(min(sh, sstep(float(r).sub(soft), float(r).add(soft), dd as F).mul(dark).add(1 - dark)))
      }
      cap(TU.reedA as unknown as V3, TU.reedB as unknown as V3, 0.32, 0.9)
      cap(TU.hA as unknown as V3, TU.hB as unknown as V3, 1.9, 0.92)
      cap(TU.fA as unknown as V3, TU.fB as unknown as V3, 2.7, 0.92)
    })
    const ao = sat1(mk.x.mul(-9).add(1).sub(sat1(m.div(0.5).oneMinus() as F).mul(0.25)) as F)
    const col = clayLit(alb as V3, N as V3, V as V3, sh as F, ao as F, wet as F)
    return vec4(col, viewDepth(vec3(p.x, h0, p.y) as V3))
  })()
  const tabMesh = new THREE.Mesh(gridGeoT, tabMat)
  tabMesh.frustumCulled = false
  tabScene.add(tabMesh)

  // the floor far under the hand: swept silt, out of focus
  const FLOOR_Y = -24
  const floorMat = new THREE.NodeMaterial()
  floorMat.fragmentNode = Fn(() => {
    const P = attribute("position", "vec3").toVarying() as unknown as V3
    const p = P.xy.mul(0.11).toVar()
    const ee = vor2(p.mul(2.2).add(fbm(p.mul(1.3)).mul(1.5))).toVar()
    const crack = sstep(0.05, 0.01, ee.y.sub(ee.x) as F).mul(0.5)
    const alb = vec3(0.52, 0.43, 0.31).mul(fbm(p.mul(1.1)).mul(0.5).add(0.72)).mul(crack.mul(0.6).oneMinus())
    // the shade of whoever is holding the tablet falls across it
    const shade = sstep(-30, 22, P.x.mul(0.55).add(P.y))
    const lit = alb.mul(SUNC.mul(0.5).mul(shade.oneMinus().mul(0.85).add(0.15)).add(SKYC.mul(0.9)))
    return vec4(lit, viewDepth(vec3(P.x, FLOOR_Y, P.y.negate()) as V3))
  })()
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), floorMat)
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.position.y = FLOOR_Y
  tabScene.add(floorMesh)

  // ---------------------------------------------------------------- the reed

  const reedGeo = (() => {
    const g = new THREE.CylinderGeometry(1, 1, REED_L, 28, 64, false)
    const pos = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i)
      // round and 9 mm thick where it is held, whittled toward both ends
      const r = REED_END + (REED_R - REED_END) * smooth(0.2, 3.4, REED_L / 2 - Math.abs(y))
      const x = pos.getX(i) * r
      pos.setX(i, x)
      pos.setZ(i, pos.getZ(i) * r)
      // the writing end is cut at an angle, leaving an edge and a corner
      const cutY = -REED_L / 2 + (x + REED_END) * 1.3
      if (y < cutY) y = cutY
      pos.setY(i, y)
    }
    g.computeVertexNormals()
    return g
  })()
  const reedU = { m: uniform(new THREE.Matrix4()) }
  const reedPos = Fn(() => (reedU.m.mul(vec4(positionGeometry, 1)) as unknown as V4).xyz)() as V3
  const reedMat = new THREE.NodeMaterial()
  reedMat.fragmentNode = Fn(() => {
    const L = attribute("position", "vec3").toVarying() as unknown as V3
    const Nw = normalize((reedU.m.mul(vec4(attribute("normal", "vec3"), 0)) as unknown as V4).xyz.toVarying()) as V3
    const P = reedPos.toVarying() as V3
    const ang = atan(L.z, L.x)
    // straw-yellow cane: long fibres, a node, clay on both ends
    const fib = vnoise(vec2(ang.mul(9), L.y.mul(0.9))).mul(0.5).add(vnoise(vec2(ang.mul(31), L.y.mul(3))).mul(0.5))
    const cane = mixN(vec3(0.62, 0.48, 0.2), vec3(0.8, 0.68, 0.36), fib).toVar()
    cane.mulAssign(gauss(L.y.sub(1.2) as F, 0.07).mul(0.45).oneMinus())
    // the whittled ends: knife facets along them, and clay on both
    cane.mulAssign(sin(ang.mul(7).add(L.y.mul(0.4))).mul(0.06).mul(sstep(3.0, 4.6, abs(L.y) as F)).add(1))
    const endK = max(sstep(-(REED_L / 2 - 1.4), -(REED_L / 2 - 0.35), L.y.add(vnoise(vec2(ang.mul(3), 1)).mul(0.5)) as F), sstep(REED_L / 2 - 0.9, REED_L / 2 - 0.2, L.y.add(vnoise(vec2(ang.mul(3), 7)).mul(0.4)) as F))
    const alb = mixN(cane, vec3(0.47, 0.37, 0.25), endK.mul(0.85))
    // the pith shows pale on the cut and on the butt
    const cutFace = sstep(0.75, 0.4, length(attribute("normal", "vec3").toVarying().xz) as F)
    const a2 = mixN(alb, vec3(0.74, 0.66, 0.5).mul(sstep(0.05, 0.2, length(L.xz) as F).mul(0.5).add(0.5)), cutFace.mul(endK.mul(0.6).oneMinus()))
    const V = normalize(U.pos.sub(P))
    const col = clayLit(a2 as V3, Nw, V as V3, float(1), float(1), endK.mul(0.5).add(0.12) as F)
    return vec4(col, viewDepth(P))
  })()
  const reed = new THREE.Mesh(reedGeo, reedMat)
  reed.frustumCulled = false
  tabScene.add(reed)
  // ---------------------------------------------------------------- the two hands (the toolkit's macro hand, the same person's as in `clay`)

  /** Under the tablet the sun does not reach. */
  const underTablet = (P: V3): F => {
    const s = max(float(-0.5).sub(P.y), 0).div(TAN_E)
    const q = P.xz.add(LDn.mul(s))
    return sstep(-0.25, 0.15, sdRound(q as V2)).max(step(-0.4, P.y)) as F
  }
  const handMat = (clay: number, shadow?: (P: V3) => F) => (n: SkinNodes, H: HM.HandModel) => {
    // the sun, the sky, and the clay's own pale light from below
    const Lt: Lights = { key: U.sun as unknown as V3, keyCol: SUNC.mul(0.85) as V3, sky: SKYC.mul(1.3) as V3, bounce: vec3(0.66, 0.55, 0.42).mul(1.6) as V3, shadow }
    const m = skinMaterial(n, Lt, HM.handLook(H, { skin: HAND_SKIN, clay, clayCol: 0x8c7658, hair: 0.5, veins: 0.5, callus: 0.3 }))
    const c = m.fragmentNode as unknown as V4
    m.fragmentNode = vec4(c.rgb, viewDepth(n.vW))
    return m
  }
  // the left hand, palm up, the forearm coming from the writer's side: the tablet lies on the palm, the fingers run
  // under it and close up round its far edge (solved on a capsule the thickness of the tablet's rim, so they wrap
  // the rim and stop short of the written face), the thumb along its left edge
  const RIM_C = [0.152, -0.0232] as const
  const TAB_C = [RIM_C[0] + 0.011 - PH / 100, RIM_C[1], 0] as const
  const holder = handSet("L", 1, handMat(0.55, underTablet), {
    extra: (H) => {
      const opts = { wrap: true, gap: 0.0004, slack: 0.15 }
      const fingers = solveGrip(H.spec, { kind: "capsule", a: H.map.p([RIM_C[0], RIM_C[1], -0.07]), b: H.map.p([RIM_C[0], RIM_C[1], 0.07]), r: 0.0108 }, { ...opts, max: [1.25, 1.6, 1.05], only: ["index", "middle", "ring", "little"] })
      // the thumb along the tablet's left side, its pad on the rim
      const zl = -(PW / 100 + 0.004)
      const thumb = solveGrip(H.spec, { kind: "capsule", a: H.map.p([TAB_C[0] - 0.03, RIM_C[1], zl]), b: H.map.p([TAB_C[0] + 0.035, RIM_C[1], zl]), r: 0.0108 }, { ...opts, max: [0.8, 0.7, 0.45], only: ["thumb"], pre: { thumb: [0.15, 0.5, 0] } })
      return { tab: { ...fingers, ...thumb } as Pose }
    },
  })
  // the right hand in a tripod on the reed (the toolkit's `pinch`, solved for a 9 mm shaft)
  const writer = handSet("R", 1, handMat(0.45))
  tabScene.add(holder.herd.group, writer.herd.group)
  const TAB_AT = holder.H.map.p(TAB_C as unknown as [number, number, number])
  const STY = writer.H.anchors.stylus
  // the hand's own frame against the stylus it was solved for: the stylus (toward its writing end) and the fingers' direction square to it
  const S_M = new THREE.Vector3(...STY[0]).sub(new THREE.Vector3(...STY[1])).normalize()
  const X_M = new THREE.Vector3(1, 0, 0).addScaledVector(S_M, -S_M.x).normalize()
  const M_T = new THREE.Matrix4().makeBasis(S_M, X_M, new THREE.Vector3().crossVectors(S_M, X_M)).transpose()
  /** The way the writer's fingers point, roughly: to the left and a little toward the lens, the forearm going off to the right and away (so the hand stays at the frame's edge, not in front of the lens). */
  const X_HINT = new THREE.Vector3(-0.85, -0.3, 0.35).normalize()

  // ---------------------------------------------------------------- the ard's share, finishing the newest furrow as the scene opens

  const ard = new THREE.Group()
  {
    const wood = new THREE.NodeMaterial()
    wood.fragmentNode = Fn(() => {
      const lp3 = attribute("position", "vec3").toVarying() as unknown as V3
      const N = normalize(normalWorld) as V3
      const g = vnoise(vec2(lp3.x.mul(40), lp3.y.mul(3))).mul(0.5).add(vnoise(vec2(lp3.z.mul(60), lp3.y.mul(9))).mul(0.5))
      const alb = mixN(vec3(0.035, 0.026, 0.02), vec3(0.09, 0.066, 0.045), g)
      const lit = alb.mul(SUNC.mul(max(dot(N, U.sun), 0)).add(SKYC.mul(N.y.mul(0.4).add(0.7))))
      return vec4(lit, 1)
    })()
    // share: a fire-hardened point; sole and beam; the stilt the ploughman holds
    const share = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.36, 9, 4), wood)
    share.rotation.z = -Math.PI / 2 - 0.3
    share.position.set(-0.13, 0.02, 0)
    const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.9, 8, 4), wood)
    stilt.rotation.z = 0.32
    stilt.position.set(-0.4, 0.42, 0)
    ard.add(share, stilt)
    fieldScene.add(ard)
  }

  const ruleT = new THREE.Mesh(ruleGeo, ruleMat)
  ruleT.renderOrder = 10
  ruleT.frustumCulled = false
  tabScene.add(ruleT)

  // ---------------------------------------------------------------- targets, focus, the hand-over, the camera

  const stageF = stageTarget(ctx)
  const stageT = stageTarget(ctx)
  const tabB = ctx.target({})
  const out = ctx.target({})
  const D = { tT: uniformTexture(stageT.texture), blur: uniform(0), focus: uniform(10), asp: uniform(16 / 9) }
  // depth of field for the macro: view depth rides in the stage's alpha; a tap may not smear what is sharper than itself
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.01)).mul(step(0, d)) as F)
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0007), () => {
      Loop(18, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(18))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.4).add(step(c0.a, t.a)) as F)
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    return vec4(acc.rgb.div(acc.a), 1)
  }, D)
  const C = {
    tF: uniformTexture(stageF.texture),
    tT: uniformTexture(tabB.texture),
    w: uniform(0), // 0 field, 1 tablet
    shade: uniform(0), // a soft shadow behind the headline
    asp: uniform(16 / 9),
  }
  const comp = ctx.pass(({ uv }) => {
    const col = vec3(0).toVar()
    If(C.w.lessThan(0.999), () => {
      col.assign(sampleRT(C.tF, uv).rgb)
    })
    If(C.w.greaterThan(0.001), () => {
      // where this pixel's ray meets the ground: inside the plot the two pictures agree line for line,
      // so they simply cross; outside it the hand's world spreads outward from the tablet's edge
      const dir = U.fwd.add(U.right.mul(uv.x.mul(2).sub(1))).add(U.up.mul(uv.y.mul(2).sub(1)))
      const p = U.pos.xz.add(dir.xz.mul(U.pos.y.negate().div(min(dir.y, -1e-4)))).toVar()
      const dOut = max(sdBox(p as V2, PW, PH), 0)
      const k = sat1(C.w.mul(3.3).sub(dOut.div(8.5)).sub(0.7).add(fbm(p.mul(0.3)).sub(0.5).mul(0.9)) as F)
      const w = mixN(mixN(k, C.w, step(dOut, 0.0001)), 1, sstep(0.9, 1, C.w))
      col.assign(mixN(col, sampleRT(C.tT, uv).rgb, sstep(0, 1, w as F)))
    })
    // a cloud's edge over the corner where the type sits
    // (the type is white over pale clay: shade the corner it sits in, broad and soft, so it reads without a plate)
    const d = length(uv.sub(vec2(0.2, 0.86)).mul(vec2(C.asp.mul(0.5), 1.6)))
    col.mulAssign(mixN(float(1), float(0.33), C.shade.mul(sstep(0.85, 0.05, d as F))))
    // the rule lies on the ground: its shadow, away from the sun
    return vec4(col, 1)
  }, C)

  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 100)
  const st = { lnF: Math.log(F0), frame: F0, knock: 0, w: 0, tip: new THREE.Vector3() }
  const POST: PostOpts = { tone: "aces", exposure: 0.9, bloom: 0.12, bloomThresh: 1.3, bloomRadius: 0.6, contrast: 1.1, sat: 1.02, vignette: 0.22, grain: 0.02, ca: 0.0008, lift: [0.004, 0.006, 0.012], gain: [1.03, 1.0, 0.95] }
  const CLEAR = ageCardClear(ctx.def.id, START)
  const TITLES: TitleOpts = { color: "#fffaf0", delay: [CLEAR + 0.1, 0.5], shadow: "rgba(20,12,4,0.55)", maxLine: 26 }
  const HUD = { color: "#fffaf0", shadow: "rgba(20,12,4,0.6)" }
  const vR = new THREE.Vector3()
  const vU = new THREE.Vector3()
  const vF = new THREE.Vector3()
  const vT = new THREE.Vector3()
  const vA = new THREE.Vector3()
  const qA = new THREE.Quaternion()
  const qB = new THREE.Quaternion()
  const mW = new THREE.Matrix4()
  const YAX = new THREE.Vector3(0, 1, 0)
  const vX = new THREE.Vector3(), vY = new THREE.Vector3(), vP = new THREE.Vector3(), vQ = new THREE.Vector3(), vD = new THREE.Vector3(), vJ = new THREE.Vector3(), vK = new THREE.Vector3(), vG = new THREE.Vector3()
  const DRAW_AX = new THREE.Vector3(0.5, 0.8, -0.22).normalize()
  const PRESS_AX = new THREE.Vector3(0.3, 0.92, -0.15).normalize()

  /** Where the reed's working end is at `t` seconds of beat 1 (into `tip`). Returns how far it is turned to its butt end; `rs` gets the mark and the pressure. */
  const rs = { press: 0, mark: -1 }
  function reedAt(t: number, tip: THREE.Vector3) {
    let i = -1
    for (let j = 0; j < MARKS.length; j++) if (t >= MARKS[j].t0) i = j
    const ground = (x: number, z: number, lift: number) => tip.set(x, 0.2 * (1 - (x / PW) ** 2) * (1 - (z / PH) ** 2) + lift, z)
    const at = (m: Mark, k: number) => ground(mix(m.a[0], m.b[0], m.kind ? 0 : k), mix(m.a[1], m.b[1], m.kind ? 0 : k), m.kind ? -0.06 * Math.sin(Math.PI * clamp(k * 1.15)) ** 0.6 : -0.035)
    let press = 0
    let butt = 0
    if (i < 0) {
      // coming in from the right, high
      const k = smooth(0.7, MARKS[0].t0, t)
      at(MARKS[0], 0)
      tip.x += (1 - k) * 9
      tip.y += (1 - k) * 5 + 0.5 * Math.sin(Math.PI * k)
      tip.z += (1 - k) * 4
    } else {
      const m = MARKS[i]
      const n = MARKS[i + 1]
      butt = m.kind
      if (t <= m.t1) {
        at(m, E.io2((t - m.t0) / (m.t1 - m.t0)))
        press = 1
      } else if (n) {
        // a hop to the next mark; between a sign and its numbers the reed is turned end for end
        const k = E.io2(clamp((t - m.t1) / (n.t0 - m.t1)))
        const ex = m.kind ? m.a[0] : m.b[0], ez = m.kind ? m.a[1] : m.b[1]
        ground(mix(ex, n.a[0], k), mix(ez, n.a[1], k), 0.3 * Math.sin(Math.PI * k) * (1 + (n.t0 - m.t1) * 1.6))
        butt = m.kind === n.kind ? m.kind : m.kind ? 1 - k : k
      } else {
        const k = smooth(m.t1, m.t1 + 1.6, t)
        ground(m.a[0] + k * 8, m.a[1] + k * 5, 0.2 * Math.sin(Math.PI * Math.min(k * 3, 0.5)) + k * 6)
      }
    }
    rs.press = press
    rs.mark = i
    return butt
  }
  const tA = new THREE.Vector3()
  const tB = new THREE.Vector3()
  const tC = new THREE.Vector3()

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    // ---- beat 0, the pull: frame height in log space. A creep under the card, then one move, then a settle.
    const a = s.k(0, -0.6, CLEAR + 0.4, E.io2)
    const b = 0.78 * s.k(0, CLEAR - 0.3, 15.4, E.lin) + 0.22 * s.k(0, CLEAR - 0.3, 15.4, E.io3)
    let lnF = mix(Math.log(F0), Math.log(F_CARD), a)
    lnF = mix(lnF, Math.log(F_END), b)
    // arrive with a little too much, and come back
    lnF += 0.05 * Math.sin(Math.PI * s.k(0, 14.6, 16.6, E.out2)) + 0.03 * s.k(0, 15.5, 40, E.lin) * (1 - s.k(1, 0, 1.5, E.io2))
    lnF += 0.004 * Math.sin(s.time * 0.31)
    // centred on the newest furrow at first (it lies on the transition's cut line), then on the plot
    const toPlot = smooth(Math.log(1.1), Math.log(9.5), lnF)
    const land = Math.max(0, t0)
    const knock = t0 >= 0 && s.beat === 0 ? Math.exp(-land * 6) : 0
    const roll = 0.012 * Math.sin(s.time * 0.21) + 0.03 * (1 - toPlot) * (1 - a) + 0.02 * Math.sin(Math.PI * b)

    // ---- beat 1, the macro: down and round to a low look across the clay, following the reed
    // (the look-at point trails the reed, averaged over the last second so it glides while the reed hops)
    reedAt(clamp(t1 - 0.25, MARKS[0].t0, T_DONE), tA)
    reedAt(clamp(t1 - 0.6, MARKS[0].t0, T_DONE), tB)
    reedAt(clamp(t1 - 0.95, MARKS[0].t0, T_DONE), tC)
    const butt = reedAt(t1, st.tip)
    const dive = s.k(1, 0.1, 2.5, E.io3)
    const back = s.k(1, T_DONE + 0.5, T_DONE + 4.6, E.io3)
    // (a little up the reed from its tip, so the hand on it is in the frame)
    const fx = (tA.x + tB.x + tC.x) / 3 - 0.1
    const fz = (tA.z + tB.z + tC.z) / 3 - 0.7
    st.w = smooth(MIX0, MIX1, lnF)
    lnF = mix(lnF, Math.log(10.5) + 0.08 * Math.sin(t1 * 0.4), dive)
    lnF = mix(lnF, Math.log(11.5), back)
    lnF += 0.05 * s.k(1, T_DONE + 4.6, 40, E.lin)
    const frame = Math.exp(lnF)
    const dist = frame / (2 * TANH)
    const tilt = mix(0, 0.98, dive) - 0.42 * back + 0.02 * Math.sin(s.time * 0.23) * dive // from the vertical
    let cx = mix(mix(1.3, 0, toPlot), fx, dive), cz = mix(mix(ROWZ(HERO) - (0.5 - CLAY_CUT.y) * frame, 0, toPlot), fz, dive)
    cx = mix(cx, -2.6, back)
    cz = mix(cz, -1.4, back)
    // a smoothed version of the follow, so the camera does not step with the hops
    cx += frame * (0.004 * (Math.sin(s.time * 0.37) + 0.5 * Math.sin(s.time * 0.83 + 1)) + s.mouse.x * 0.01)
    cz += frame * (0.004 * (Math.sin(s.time * 0.29 + 2) + 0.5 * Math.sin(s.time * 0.67)) - s.mouse.y * 0.008 + knock * 0.012 * Math.sin(land * 41))
    const az = -0.32 * dive + 0.14 * back // the low camera stands a little to the left of the hand
    cam.aspect = s.w / s.h
    cam.near = dist * 0.03
    cam.far = dist * 8 + 80 * dive
    const sT = Math.sin(tilt), cT = Math.cos(tilt)
    cam.position.set(cx + dist * sT * Math.sin(az), dist * cT * (1 - knock * 0.02 * Math.cos(land * 33)), cz + dist * sT * Math.cos(az))
    cam.up.set(Math.sin(roll), 0, -Math.cos(roll))
    cam.lookAt(cx + frame * 0.012 * Math.sin(s.time * 0.17), 0, cz + frame * 0.01 * Math.cos(s.time * 0.13))
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    cam.matrixWorld.extractBasis(vR, vU, vF)
    U.pos.value.copy(cam.position)
    U.fwd.value.copy(vF).negate()
    U.right.value.copy(vR).multiplyScalar(TANH * cam.aspect)
    U.up.value.copy(vU).multiplyScalar(TANH)
    U.px.value = frame / s.h
    TU.tpx.value = frame / s.h
    U.time.value = s.time
    st.lnF = lnF
    st.frame = frame
    st.knock = knock

    // ---- the newest furrow is still being cut as we arrive: the share is where the transition's point is
    const pl = CLAY_IN + t0 / CLAY_DUR
    const inFrame = cx + (CLAY_CUT.u(pl) - 0.5) * frame * cam.aspect
    U.cut.value = t0 < -CLAY_DUR * CLAY_IN + 0.01 ? -99 : Math.min(PW - 0.3, Math.max(inFrame, cx + 0.62 * frame * cam.aspect * clamp((t0 - 0.6) / 0.4) + (t0 - 0.66) * 1.1))
    // ---- time-lapse: shoots, oldest rows first; then the water
    U.grow.value = (t0 - 4.2) * 0.95
    U.wetT.value = (t0 - 6.2) * 0.8

    // ---- the reed and what it has written
    uMT.value = t1
    const bk = E.io2(clamp(butt))
    const lean = vA.copy(DRAW_AX).lerp(PRESS_AX, bk).normalize()
    lean.x += 0.05 * Math.sin(t1 * 2.3)
    lean.z += 0.03 * Math.sin(t1 * 1.7 + 1)
    lean.normalize()
    const show = s.beat === 1 && t1 > 0.5
    reed.visible = show
    TU.reedOn.value = show ? 1 : 0
    // ---- the writing hand: turned so the stylus its tripod was solved for runs down `lean`, then moved so the
    // reed's working end is on the tip. The reed is read back off the hand, so it is always in the grip.
    {
      const W = writer.slots[0]
      W.on = show
      W.time = s.time
      const dW = vF.copy(lean).negate()
      vR.copy(X_HINT).addScaledVector(dW, -X_HINT.dot(dW)).normalize()
      mW.makeBasis(dW, vR, vU.crossVectors(dW, vR)).multiply(M_T)
      const X = vX.set(1, 0, 0).transformDirection(mW)
      const Y = vY.set(0, 1, 0).transformDirection(mW)
      for (const k in W.ch) W.ch[k] = 0
      W.ch.pinch = 1
      // life in the wrist and the two free fingers: each stroke is pulled from the wrist; the ring and little fingers settle
      const stroke = rs.press * (rs.mark >= 0 && MARKS[rs.mark].kind === 0 ? 1 : 0.4)
      W.ch.wristFlex = 0.06 * Math.sin(t1 * 1.9) - 0.08 * stroke
      W.ch.wristDev = 0.05 * Math.sin(t1 * 1.3 + 0.7)
      W.ch.curl = 0.04 + 0.04 * Math.sin(s.time * 1.1)
      writer.place(W, st.tip, STY[0], X, Y)
      writer.update(cam)
      const A = writer.ride(STY[0], vP), B = writer.ride(STY[1], vQ)
      const d = vD.copy(A).sub(B).normalize()
      // the grip: where the index's last joint and the thumb's meet the axis, a pad's length on
      const proj = (j: THREE.Vector3) => j.sub(B).dot(d)
      const g = (proj(writer.joint("index.2", vJ)) + proj(writer.joint("thumb.2", vJ))) / 2 + 1.0
      const ext = mix(EXT_CUT, EXT_BUTT, bk)
      // the working end now, and where it must be (lifted while the reed is turned end for end)
      vJ.copy(B).addScaledVector(d, g + ext)
      vK.copy(st.tip).addScaledVector(YAX, Math.sin(Math.PI * bk) * 1.2).sub(vJ)
      W.elbow.add(vK)
      writer.update(cam)
      vG.copy(B).addScaledVector(d, g).add(vK) // the grip point, in the world
      // the reed: its cut end down the axis from the grip; turned end for end about the line across the pads (fingers' side), swinging away from the palm
      qA.setFromUnitVectors(YAX, vT.copy(d).negate())
      vT.crossVectors(d, X).normalize()
      qB.setFromAxisAngle(vT, Math.PI * bk)
      reed.quaternion.copy(qB).multiply(qA)
      reed.position.copy(d).multiplyScalar(EXT_CUT - REED_L / 2).applyQuaternion(qB).add(vG)
      reed.updateMatrixWorld()
      reedU.m.value.copy(reed.matrixWorld)
      TU.reedA.value.set(0, -REED_L / 2, 0).applyMatrix4(reed.matrixWorld)
      TU.reedB.value.set(0, REED_L / 2, 0).applyMatrix4(reed.matrixWorld)
      // the hand's and the forearm's shadows
      writer.ride(writer.H.anchors.palm, TU.hB.value)
      TU.hA.value.copy(vG)
      writer.ride(writer.H.anchors.wrist, TU.fA.value)
      TU.fB.value.copy(W.elbow)
    }
    // ---- the holding hand: the tablet on its palm and fingers; it breathes, and gives a little under each press
    {
      const Hh = holder.slots[0]
      Hh.on = st.w > 0.001
      Hh.time = s.time
      for (const k in Hh.ch) Hh.ch[k] = 0
      Hh.ch.tab = 1
      Hh.ch.flat = 0.03 + 0.03 * Math.sin(s.time * 0.7)
      Hh.ch.wristDev = 0.03 * Math.sin(s.time * 0.53)
      vP.set(0.2, -0.9 + 0.025 * Math.sin(s.time * 1.3) - 0.03 * rs.press * (show ? 1 : 0), 0)
      holder.place(Hh, vP, TAB_AT, vX.set(0.2, 0.006 * Math.sin(s.time * 0.9), -1), vY.set(0.02 * Math.sin(s.time * 0.6), -1, 0))
      holder.update(cam)
    }
    ard.position.set(U.cut.value, -0.06, ROWZ(HERO))
    ard.visible = t0 < 3 && U.cut.value > -50

    // drying: a little at the rim from the start, the rest once the reed has gone
    TU.dry.value = 0.06 + 0.1 * s.k(1, 2, T_DONE, E.lin) + 0.86 * s.k(1, T_DONE + 0.8, T_DONE + 5.4, E.io2)

    // ---- focus
    D.asp.value = cam.aspect
    D.focus.value = dist
    D.blur.value = mix(0.03, 0.007, dive) + 0.004 * back

    // the rule is in both pictures while they cross, so it never thins
    placeRule(ruleF, cam, { dist: dist * 0.3 })
    placeRule(ruleT, cam, { dist: dist * 0.3 })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    shoots.visible = shootSh.visible = U.px.value < 0.03 && U.grow.value > 0
    // the far view's people, once they can be in frame
    const farOn = U.px.value > 0.004 && st.w < 0.999
    folk.group.visible = folkSh.group.visible = farOn
    if (farOn) {
      folkT.time = s.time
      folk.update(cam, folkFill)
    }
    C.shade.value = ctx.debugLabels ? 0 : s.k(0, CLEAR - 0.2, CLEAR + 1.2, E.io2) * (1 - 0.15 * st.w)
    C.asp.value = cam.aspect
    C.w.value = st.w
    if (s.live) {
      ctx.synth.bed("water", 0.45 * smooth(0, 1.5, U.wetT.value) * (1 - smooth(Math.log(9), Math.log(20), lnF)) * (s.beat === 0 ? 1 : 0))
      ctx.synth.bed("air", 0.22 * dive)
    }
    if (s.live) ctx.synth.bed("wind", clamp(0.12 + 0.5 * smooth(Math.log(1), Math.log(F_END), lnF) * (1 - dive)) * (t0 < 0 ? s.enter : 1))
  }

  // ---------------------------------------------------------------- sound: every mark is heard where it is made

  const lp: [number, number, number] = [0, 0, 0]
  const atTip = () => listenerPos(st.tip, cam, cam.position.length(), lp)
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    // the ard dragging through the silt, and the ox ahead of it, off to the right
    { b: 0, at: 0.06, s: "scratch", o: { f: 150, g: 0.4, dur: 0.5 }, pos: [-0.3, -0.16, 0] },
    { b: 0, at: 0.36, s: "scratch", o: { f: 130, g: 0.34, dur: 0.5 }, pos: [0.4, -0.16, 0] },
    { b: 0, at: 0.3, s: "hiss", o: { f: 240, dur: 0.55, g: 0.26, wet: 0.4 }, pos: [1.3, 0.1, -0.2] },
    { b: 0, at: 0.74, s: "scratch", o: { f: 115, g: 0.26, dur: 0.6 }, pos: [1.1, -0.16, 0.1] },
    { b: 0, at: 1.9, s: "hiss", o: { f: 210, dur: 0.7, g: 0.2, wet: 0.5 }, pos: [1.4, 0.2, 0.2] },
    // shoots, a row at a time; the water let in
    ...Array.from({ length: SH_ROWS }, (_, r): Cue => ({ b: 0, at: 4.2 + (r * 0.9 + 0.5) / 0.95, s: "marimba", o: { f: H(12 + r * 2), g: 0.2 }, pos: [-0.2 + r * 0.08, 0.7 - r * 0.2, 0.2] })),
    { b: 0, at: 6.25, s: "splash", o: { g: 0.3 }, pos: [-0.8, 0.6, 0.3] },
    // the stripes are ruled lines: it lands in the palm
    { b: 0, at: 13.3, s: "pad", o: { f: H(4), dur: 3.2, g: 0.3 } },
    { b: 0, at: 15.3, s: "thud", o: { f: H(3), g: 0.4 }, pos: [0, -0.2, 0] },
    { b: 0, at: 15.34, s: "shimmer", o: { g: 0.16 } },
    // the macro
    { b: 1, at: 0.15, s: "whoosh", o: { f: 300, dur: 2, g: 0.22 } },
    { b: 1, at: T_DONE + 2.4, s: "crack", o: { f: 3100, g: 0.1 }, pos: [-0.5, 0.3, 0] },
    { b: 1, at: T_DONE + 3.7, s: "crack", o: { f: 2500, g: 0.08 }, pos: [0.5, -0.2, 0] },
    { b: 1, at: T_DONE + 1, s: "pad", o: { f: H(6), dur: 4, g: 0.22 } },
  ]
  {
    let n = 0
    for (const m of MARKS) {
      if (m.kind === 0) cues.push({ b: 1, at: m.t0, s: "scratch", o: { f: 520 + 60 * m.size, g: 0.22 + 0.1 * m.size, dur: Math.max(0.12, m.t1 - m.t0) }, pos: atTip })
      else {
        // a count: each impression a step up the harmonic series
        cues.push({ b: 1, at: m.t0 + 0.02, s: "squelch", o: { f: H(4 + n), g: 0.6, dur: 0.16 }, pos: atTip }, { b: 1, at: m.t0 + 0.05, s: "marimba", o: { f: H(8 + n), g: 0.16 }, pos: atTip })
        n++
      }
    }
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: fieldScene, camera: cam, target: stageF },
      { scene: marksScene, camera: marksCam, target: marksRT },
      { scene: tabScene, camera: cam, target: stageT },
      { pass: dof, target: tabB },
      { pass: comp, target: out },
    ],
    render() {
      const r = ctx.renderer
      if (st.w < 0.999) {
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(stageF)
        r.render(fieldScene, cam)
      }
      if (st.w > 0.001) {
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(marksRT)
        r.render(marksScene, marksCam)
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(stageT)
        r.render(tabScene, cam)
        D.tT.value = stageT.texture
        dof.render(tabB)
      }
      C.tF.value = stageF.texture
      C.tT.value = tabB.texture
      comp.render(out)
      POST.exposure = 0.9 + 0.15 * st.knock
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(20,12,4,0.6)", color: "#fffaf0" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      reedGeo.dispose()
      folk.dispose()
      folkSh.dispose()
      palmGeo.dispose()
      holder.herd.dispose()
      writer.herd.dispose()
      disposeTree(fieldScene)
      disposeTree(tabScene)
      disposeTree(marksScene)
    },
  }
}

