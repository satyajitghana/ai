// Scene 17, press: "Print". One page becomes millions.
//
// Staging. Beat 0: a wooden screw press in a north window's light. On its stone lies a forme: two
// columns of 42 lines of lead sorts locked in an iron chase, every sort a cast body with a nick
// across its belly, a groove in its foot and a mirrored blackletter face. A macro travels along the
// last lines while the compositor's hand sets the last three sorts from the stick; two leather ink
// balls beat the type glossy black; the damp sheet swings down on its hinge; the platen comes down
// (the pull); the sheet is peeled from a corner and the print is right-reading, squashed dark at
// every edge, with a blank left for the rubricator. Beat 1: the red initial is painted in, the
// sheet goes up on a drying line, and it is no longer one: lines fill, then tens of thousands of
// instanced pages (one draw, placed in the vertex stage from the beat clock) leave the press, fold
// once in the air, thicken into quires and land as books on a wall of shelves that the camera
// cranes up and back from, under a counter that slams on the script's two figures.
//
// Story parameter. `copies`: page i is born when a doubling count passes i.
// World rule. `shopLit`: one cool window key with its glazing bars, a warm bounce off oak, and one
// occlusion term (platen, ink balls, hand). Wet ink is the only glossy thing in the shop.
// Beat sheet and sources: R/beats/press.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalGeometry, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, select, sign, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { makeAim, makeHerd, skinMaterial, type Drive, type Lights } from "../engine/creature"
import * as HM from "../engine/creature/hand"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { PLATEN_DUR, PLATEN_IN } from "../transitions/platen"

// ---------------------------------------------------------------- layout (metres)

const COLS = 34, LINES = 42 // characters to a column, lines to a column: two columns
const CW = 0.0025, LH = 0.0069 // set width and body: 8.5 cm columns, 29 cm of text
const GUT = 0.02
const TW = 2 * COLS * CW + GUT // the text block's width, 0.19
const TH = LINES * LH
const TYPE_H = 0.0233 // type-high
const SW = 0.29, SH = 0.42 // the sheet
const NG = 28 // letterforms in the fount drawn here
const FOV = 32
const START = PLATEN_DUR * (1 - PLATEN_IN)
/** Toward the window: high, to the left and a little behind the bench. */
const KEY = /*@__PURE__*/ new THREE.Vector3(-0.62, 0.66, 0.3).normalize()
// the blank left for the rubricator: right-hand column of the print, lines 38 and 39, three characters
const GAP = { col: 1, c0: 0, n: 3, l0: 37, lines: 2 }
// where the last three sorts go: the end of the last line
const LAST = [COLS - 3, COLS - 2, COLS - 1].map((c) => ({ c, l: LINES - 1 }))
const SET_T = [2.0, 2.6, 3.2] // seconds of beat 0 at which each is seated
// times of beat 0
const T_INK = 3.75, T_LAY = 5.6, T_PULL = 7.1
// after the pull: the tympan opens, the frisket lifts off the sheet, the sheet is taken off by its corner and laid on the bank
const T_OPEN = 7.8, T_FRISK = 8.2, T_LIFT = 8.75, LIFT_D = 0.95
const AL_UP = 1.72, AL_OPEN = 1.86
// the peel: corner, direction, curl radius, how far the crease travels
// beat 1
const T_HANG = 1.0, T_STORM = 1.5, T_STOP = 9.2
const NP = 36000 // pages
const HUNG = 112 // of which the first hang on the lines
const DOUBLINGS = 15
const WALL = { z: -15, cols: 544, pw: 0.1, ph: 0.5, y0: 0.35 }
const WALL_ROWS = Math.ceil((NP - HUNG) / WALL.cols)
const LINE0 = { y: 1.98, z: -0.85 }
const WW = WALL.cols * WALL.pw, WHt = WALL_ROWS * WALL.ph
const LINES_N = 8, PER_LINE = HUNG / LINES_N
const lineAt = (n: number): [number, number] => [2.12 + n * 0.13, -1.6 - n * 0.85]
const Y_SHEET = TYPE_H + 0.0004
/** The tympan's hinge stands this far beyond the sheet's far edge. */
const HINGE_OFF = 0.012
/** The bank beside the press, where the pulled sheet is laid face up. */
const BANK = { x: -0.64, y: 0.0016, z: 0.22, yaw: 0.06 }
/** Lamps along the wall of shelves: one to a bay, one to every six shelves. */
const LAMP = { dx: 3.4, dy: 3.0, z: 1.3 }
const lampXY = (i: number, j: number): [number, number] => [-WW / 2 + (i + 0.5) * LAMP.dx, WALL.y0 + (j + 0.62) * LAMP.dy]

/** Metal x of character c in column col (the forme is the page's mirror image), and z of line l. */
const sortX = (col: number, c: number) => TW / 2 - (col * (COLS * CW + GUT) + (c + 0.5) * CW)
const sortZ = (l: number) => -TH / 2 + (l + 0.5) * LH

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F
/** Rotate v by the unit quaternion q. */
const qrot = (q: V4, v: V3): V3 => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2)) as V3

// ---------------------------------------------------------------- the fount: a drawn textura (minims and diamonds), not text

function drawFount(c: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(1454)
  const cw = w / 8, ch = h / 4
  c.fillStyle = "#000"
  c.fillRect(0, 0, w, h)
  c.filter = "blur(2.2px)"
  c.fillStyle = "#fff"
  c.strokeStyle = "#fff"
  for (let g = 0; g < 32; g++) {
    const ox = (g % 8) * cw, oy = Math.floor(g / 8) * ch
    const X = (u: number) => ox + u * cw, Y = (v: number) => oy + v * ch
    const top = 0.33, base = 0.78
    const n = g < 5 ? 1 : g < 24 ? 2 : 3
    const us = n === 1 ? [0.5] : n === 2 ? [0.27, 0.73] : [0.17, 0.5, 0.83]
    const bw = n === 3 ? 0.19 : 0.27
    const tall = R() < 0.3 ? Math.floor(R() * n) : -1, deep = tall < 0 && R() < 0.22 ? Math.floor(R() * n) : -1
    const diamond = (u: number, v: number, k = 1) => {
      c.beginPath()
      c.moveTo(X(u - bw * 0.95 * k), Y(v))
      c.lineTo(X(u), Y(v - 0.075 * k))
      c.lineTo(X(u + bw * 0.95 * k), Y(v))
      c.lineTo(X(u), Y(v + 0.075 * k))
      c.fill()
    }
    us.forEach((u, i) => {
      const t0 = i === tall ? 0.1 : top, b0 = i === deep ? 0.96 : base
      c.fillRect(X(u - bw / 2), Y(t0), bw * cw, (b0 - t0) * ch)
      // the pen's entry and exit: a diamond at the head, one at the foot (none under a descender)
      diamond(u - bw * 0.25, t0 + 0.02)
      if (i !== deep) diamond(u + bw * 0.25, b0 - 0.02)
      else diamond(u - bw * 0.2, b0, 0.6)
    })
    // hairlines and bars that tie the minims into a letter
    c.lineWidth = cw * 0.085
    for (let i = 0; i + 1 < n; i++) {
      const k = R()
      c.beginPath()
      if (k < 0.45) {
        c.moveTo(X(us[i]), Y(top + 0.03))
        c.lineTo(X(us[i + 1]), Y(top - 0.015))
      } else if (k < 0.8) {
        c.moveTo(X(us[i]), Y(base + 0.015))
        c.lineTo(X(us[i + 1]), Y(base - 0.03))
      } else {
        c.moveTo(X(us[i]), Y(0.56))
        c.lineTo(X(us[i + 1]), Y(0.54))
      }
      c.stroke()
      if (k > 0.3 && k < 0.6) {
        c.beginPath()
        c.moveTo(X(us[i]), Y(base + 0.015))
        c.lineTo(X(us[i + 1]), Y(base - 0.03))
        c.stroke()
      }
    }
    if (n === 1 && R() < 0.5) c.fillRect(X(0.5), Y(0.5), 0.3 * cw, 0.035 * ch)
  }
  c.filter = "none"
}
/** The rubricator's initial: a Lombardic capital, two bowls on a stem, with a hairline flourish. */
function drawInitial(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = "#000"
  c.fillRect(0, 0, w, h)
  c.filter = "blur(2px)"
  c.fillStyle = "#fff"
  c.strokeStyle = "#fff"
  c.lineCap = "round"
  const bowl = (cy: number, r: number) => {
    c.beginPath()
    c.ellipse(w * 0.4, cy, r * 1.25, r, 0, -Math.PI / 2, Math.PI / 2)
    c.ellipse(w * 0.4, cy, r * 0.62, r * 0.72, 0, Math.PI / 2, -Math.PI / 2, true)
    c.fill()
  }
  c.beginPath()
  c.moveTo(w * 0.24, h * 0.14)
  c.quadraticCurveTo(w * 0.34, h * 0.5, w * 0.24, h * 0.86)
  c.lineTo(w * 0.42, h * 0.86)
  c.quadraticCurveTo(w * 0.36, h * 0.5, w * 0.42, h * 0.14)
  c.fill()
  bowl(h * 0.32, h * 0.18)
  bowl(h * 0.68, h * 0.18)
  c.fillRect(w * 0.16, h * 0.12, w * 0.36, h * 0.045)
  c.fillRect(w * 0.16, h * 0.835, w * 0.36, h * 0.045)
  c.lineWidth = w * 0.018
  c.beginPath()
  c.moveTo(w * 0.2, h * 0.88)
  c.bezierCurveTo(w * 0.05, h * 0.98, w * 0.5, h * 1.0, w * 0.9, h * 0.93)
  c.stroke()
  c.filter = "none"
}

// ---------------------------------------------------------------- one sort: body, shoulder, nick, groove, foot

function sortGeometry() {
  // the profile across the body (x here is the body's depth, the nick on its belly side), extruded along the set width
  const s = new THREE.Shape()
  const P: [number, number][] = [[-0.5, 0], [-0.17, 0], [-0.11, 0.05], [0.11, 0.05], [0.17, 0], [0.5, 0], [0.5, 0.2], [0.37, 0.225], [0.37, 0.275], [0.5, 0.3], [0.5, 0.935], [0.41, 1], [-0.41, 1], [-0.5, 0.935]]
  P.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, steps: 1 })
  g.translate(0, 0, -0.5)
  g.rotateY(-Math.PI / 2) // extrusion along x; the profile's x is now z
  return g
}

export function create(ctx: Ctx): SceneInstance {
  const fount = canvasTex(1024, 512, drawFount)
  const initial = canvasTex(256, 256, drawInitial)
  const tFount = texture(fount)
  const tInit = texture(initial)

  // ---------------------------------------------------------------- uniforms and the world rule

  // eight dabs, alternating balls, working down the forme
  const DABS = Array.from({ length: 8 }, (_, i) => ({ x: (i % 2 ? -1 : 1) * 0.052 + (i % 4 < 2 ? 0.006 : -0.006), z: -0.11 + Math.floor(i / 2) * 0.075, t: T_INK + 0.42 + i * 0.16 }))
  const U = {
    camP: uniform(new THREE.Vector3()),
    camF: uniform(new THREE.Vector3(0, 0, -1)),
    time: uniform(0),
    t0: uniform(-9), // seconds of beat 0
    t1: uniform(-9), // seconds of beat 1
    platen: uniform(1), // the platen's underside
    blobs: [uniform(new THREE.Vector4(0, 9, 0, 0.05)), uniform(new THREE.Vector4(0, 9, 0, 0.05)), uniform(new THREE.Vector4(0, 9, 0, 0.07))], // ink balls and the hand: xyz, radius
    dabs: uniformArray(DABS.map((d) => new THREE.Vector4(d.x, d.z, d.t, 0.078)), "vec4"), // x, z, time, radius
    printed: uniform(0),
    dryInk: uniform(0),
    red: uniform(0),
    alpha: uniform(AL_UP), // the tympan's angle on its hinge
    MA: uniform(new THREE.Matrix4()), // the lift: where the corner's side of the sheet is carried
    MB: uniform(new THREE.Matrix4()), // ... and the far side, a beat behind
    sag: uniform(0),
    hang: uniform(0),
    wallLit: uniform(0),
  }
  const KEYN = vec3(KEY.x, KEY.y, KEY.z)
  const KEYC = vec3(0.9, 0.97, 1.1).mul(2.5)
  const SKYC = vec3(0.2, 0.22, 0.27).mul(0.4)
  const BOUNCE = vec3(0.34, 0.2, 0.1).mul(0.3)
  const depthOf = (P: V3): F => dot(P.sub(U.camP), U.camF) as F
  /** The window's glazing bars across the bench: soft, and gone a few metres into the shop. */
  const bars = (P: V3): F => {
    const a = P.x.mul(0.55).add(P.z.mul(0.83)).add(P.y.mul(0.3)), b = P.z.mul(0.5).sub(P.x.mul(0.8)).add(P.y.mul(0.62))
    const bar = (x: F, pitch: number): F => sstep(0.012, 0.045, float(0.5).sub(abs(x.div(pitch).fract().sub(0.5))).mul(pitch)) as F
    const near = exp(length(P).mul(-0.5))
    return mixN(float(1), bar(a as F, 0.34).mul(bar(b.add(0.1) as F, 0.42)).mul(0.7).add(0.3), near) as F
  }
  /** What stands between a point and the sky: the platen over the bed, and soft blobs under the ink balls and the hand. */
  const occl = (P: V3): F => {
    const foot = sstep(0.05, -0.03, abs(P.x).sub(0.19)).mul(sstep(0.05, -0.03, abs(P.z).sub(0.25)))
    const o = float(1).sub(foot.mul(0.9).mul(exp(max(U.platen.sub(P.y), 0).mul(-7))).mul(step(P.y, U.platen.add(0.002)))).toVar()
    for (const bu of U.blobs) {
      const b = bu as unknown as V4
      const d = P.xz.sub(b.xz).sub(vec2(KEY.x, KEY.z).mul(b.y.sub(P.y)).mul(-0.9))
      const hgt = max(b.y.sub(P.y), 0)
      o.mulAssign(float(1).sub(exp(dot(d, d).div(b.w.mul(b.w).add(hgt.mul(0.02))).negate()).mul(0.72).mul(exp(hgt.mul(-9))).mul(step(P.y, b.y))))
    }
    return o as F
  }
  /** The shop's light on a surface. `gloss` is the height of the window's reflection (wet ink, polished metal). */
  const shopLit = (alb: V3, N: V3, P: V3, gloss: Num = 0, shine: Num = 70): V3 => {
    // the window's pool: brightest on the bench under it, falling away into the shop
    const pool = mixN(float(0.07), exp(dot(P.xz.add(vec2(0.25, -0.05)), P.xz.add(vec2(0.25, -0.05))).div(-0.9)).mul(0.95).add(0.22), exp(length(P).mul(-0.35)))
    const o = occl(P).mul(bars(P)).mul(pool.add(exp(dot(P.xz.add(vec2(0.6, 3.2)), P.xz.add(vec2(0.6, 3.2))).div(-26)).mul(0.5))).toVar()
    const V = normalize(U.camP.sub(P))
    const ndl = max(dot(N, KEYN), 0)
    const sp = pow(max(dot(N, normalize(KEYN.add(V))), 0), fl(shine)).mul(gloss)
    // a second, soft reflection: the pale wall opposite the window
    const sp2 = pow(max(dot(N, normalize(vec3(0.5, 0.6, 0.62).add(V))), 0), 14).mul(min(fl(gloss), 1)).mul(0.012)
    const amb = SKYC.mul(N.y.mul(0.5).add(0.5)).add(BOUNCE.mul(N.y.mul(-0.5).add(0.5))).mul(occl(P).mul(0.7).add(0.3))
    return alb.mul(KEYC.mul(ndl).mul(o).add(amb)).add(KEYC.mul(sp.add(sp2)).mul(o)) as V3
  }
  const done = (c: V3, P: V3): V4 => vec4(c, depthOf(P)) as V4
  /** The lamps along the wall of shelves: warm pools, four nearest lamps to a point, lit as the shelves fill. */
  const lampOn = (alb: V3, N: V3, P: V3): V3 => {
    const gx = P.x.add(WW / 2).div(LAMP.dx).sub(0.5), gy = P.y.sub(WALL.y0).div(LAMP.dy).sub(0.62)
    const acc = float(0).toVar()
    for (const ox of [0, 1])
      for (const oy of [0, 1]) {
        const li = floor(gx).add(ox), lj = floor(gy).add(oy)
        const L = vec3(li.add(0.5).mul(LAMP.dx).sub(WW / 2), lj.add(0.62).mul(LAMP.dy).add(WALL.y0), WALL.z + LAMP.z)
        const d = L.sub(P)
        const d2 = dot(d, d)
        // only some bays have a lantern lit: the rest stay in the dark
        const lit = step(li.mul(7).add(lj.mul(3)).mod(5), 2.5)
        acc.addAssign(max(dot(N, normalize(d)), 0).mul(0.8).add(0.2).div(d2.mul(d2).mul(0.35).add(0.25)).mul(lit))
      }
    // and the far end of the room falls away into darkness
    return alb.mul(vec3(1.0, 0.66, 0.34)).mul(acc.add(0.012)).mul(U.wallLit).mul(sstep(-6, -11, P.z)).mul(exp(depthOf(P).mul(-0.04))).mul(9) as V3
  }

  /** Which letter sits at character `cid` (column * 40 + index) of line `l`, and whether it is a space: (glyph, space). */
  const glyphOf = (cid: F, l: F): V2 => {
    const h = hash21(vec2(cid, l)).toVar()
    const gap = step(GAP.col * 40 - 0.5, cid).mul(step(cid, GAP.col * 40 + GAP.n - 0.5)).mul(step(GAP.l0 - 0.5, l)).mul(step(l, GAP.l0 + GAP.lines - 0.5))
    const last = step(40 + COLS - 3.5, cid).mul(step(LINES - 1.5, l))
    const space = max(step(h, 0.14).mul(last.oneMinus()), gap)
    return vec2(floor(hash21(vec2(cid.add(7), l.add(13))).mul(NG)), space) as V2
  }
  /** The fount at a glyph's own uv (u right, v down): the blurred drawing, 0.5 at the edge of a stroke. */
  const fountAt = (g: F, gu: F, gv: F): F => {
    const cx = g.mod(8), cy = floor(g.div(8))
    return tFount.sample(vec2(cx.add(clampN(gu, 0.02, 0.98)).div(8), float(1).sub(cy.add(clampN(gv, 0.02, 0.98)).div(4)))).r as F
  }

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 200)
  const vp = cameraProjectionMatrix.mul(cameraViewMatrix)

  // ---------------------------------------------------------------- sorts: the forme, the stick, the case, and the one in the hand

  const sortGeo = sortGeometry()
  /** aP: position of the foot's centre, and scale. aQ: orientation. aX: character id, line, seated-at (seconds of beat 0), random. */
  const sortBatch = (n: number) => {
    const g = new THREE.InstancedBufferGeometry()
    g.index = sortGeo.index
    g.setAttribute("position", sortGeo.getAttribute("position"))
    g.setAttribute("normal", sortGeo.getAttribute("normal"))
    const aP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    const aQ = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    const aX = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    g.setAttribute("aP", aP)
    g.setAttribute("aQ", aQ)
    g.setAttribute("aX", aX)
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
    return { g, aP, aQ, aX }
  }
  const sortMat = new THREE.NodeMaterial()
  {
    const aP = attribute("aP", "vec4") as unknown as V4
    const aQ = attribute("aQ", "vec4") as unknown as V4
    const aX = attribute("aX", "vec4") as unknown as V4
    const gs = glyphOf(aX.x as F, aX.y as F)
    // a space is a low sort: it carries no face and takes no ink
    const hgt = mixN(float(1), float(0.84), gs.y)
    // (seated-at above 50 means the opposite: a sort in the stick that leaves at that time minus 100)
    const seated = select(aX.z.greaterThan(50), step(U.t0, aX.z.sub(100)), step(aX.z, U.t0))
    const local = positionGeometry.mul(vec3(CW * 0.96, hgt.mul(TYPE_H), LH * 0.96)).mul(aP.w).mul(seated)
    const world = aP.xyz.add(qrot(aQ, local as V3))
    sortMat.vertexNode = vp.mul(vec4(world, 1))
    // how much ink this sort has taken: the ink balls' dabs, each a disc that lands at its time
    const inkV = Fn(() => {
      const k = float(0).toVar()
      Loop(8, ({ i }) => {
        const d = U.dabs.element(i) as unknown as V4
        const r = length(aP.xz.sub(d.xy)).add(aX.w.mul(0.012))
        k.assign(max(k, sstep(d.w, d.w.mul(0.72), r).mul(sstep(0, 0.07, U.t0.sub(d.z)))))
      })
      return k.mul(gs.y.oneMinus())
    })()
    sortMat.fragmentNode = Fn(() => {
      const P = world.toVarying()
      const lp = positionGeometry.toVarying()
      const Nl = normalGeometry.toVarying()
      const q = aQ.toVarying()
      const g = gs.toVarying()
      const rnd = aX.w.toVarying()
      const ink = inkV.toVarying()
      const N = normalize(qrot(q as V4, Nl as V3)).toVar()
      const top = step(0.9, Nl.y).mul(step(0.995, lp.y))
      // lead: bright where it has been dressed, greyer on the cast flanks, each sort a slightly different alloy
      const lead = vec3(0.46, 0.47, 0.5).mul(rnd.mul(0.22).add(0.86)).toVar()
      const cast = vnoise(vec2(lp.x.mul(9).add(lp.z.mul(7)), lp.y.mul(60))).mul(0.3).add(0.75)
      const alb = lead.mul(cast).mul(mixN(float(0.5), float(1), sstep(0.2, 0.95, lp.y))).toVar()
      const gloss = float(0.25).toVar()
      If(top.greaterThan(0.5), () => {
        // the face: the letter stands proud of the shoulder, the wrong way round
        const gu = float(0.5).sub(lp.x.div(0.96))
        const gv = lp.z.div(0.96).add(0.5)
        const a = fountAt(g.x as F, gu as F, gv as F).mul(g.y.oneMinus()).toVar()
        const e = 0.03
        const ax = fountAt(g.x as F, gu.add(e) as F, gv as F).sub(fountAt(g.x as F, gu.sub(e) as F, gv as F)).mul(g.y.oneMinus())
        const az = fountAt(g.x as F, gu as F, gv.add(e) as F).sub(fountAt(g.x as F, gu as F, gv.sub(e) as F)).mul(g.y.oneMinus())
        const w = max(abs(dFdx(a)).add(abs(dFdy(a))), 0.02)
        const face = sstep(float(0.5).sub(w), float(0.5).add(w), a).toVar()
        // the punch-cut flank between face and shoulder
        const flank = sstep(0.2, 0.45, a).mul(face.oneMinus())
        N.assign(normalize(N.add(qrot(q as V4, vec3(ax, 0, az.negate()) as V3).mul(flank).mul(2.2))))
        alb.assign(lead.mul(mixN(float(0.5), float(1.25), face)).mul(flank.mul(0.35).oneMinus()))
        // ink: black and wet on the face, a film dragged onto the flank, a breath on the shoulder
        const film = ink.mul(sstep(0.3, 0.55, vnoise(lp.xz.mul(9).add(rnd.mul(40))).mul(0.4).add(ink.mul(0.75))))
        const cover = sat1(face.mul(film).add(flank.mul(film).mul(0.7)).add(film.mul(vnoise(lp.xz.mul(5).add(rnd.mul(17))).mul(0.5).add(0.3))) as F)
        alb.assign(mixN(alb, vec3(0.008, 0.008, 0.01), cover))
        gloss.assign(mixN(face.mul(0.7).add(0.15), mixN(float(0.45), float(0.2), U.dryInk).mul(vnoise(lp.xz.mul(23).add(rnd.mul(90))).mul(0.9).add(0.35)), cover))
      })
      return done(shopLit(alb as V3, N as V3, P as V3, gloss as F, 220), P as V3)
    })()
  }
  const NF = 2 * COLS * LINES
  const formeB = sortBatch(NF)
  {
    const R = rng(42)
    let i = 0
    for (let col = 0; col < 2; col++)
      for (let l = 0; l < LINES; l++)
        for (let c = 0; c < COLS; c++, i++) {
          const li = col === 1 ? LAST.findIndex((k) => k.c === c && k.l === l) : -1
          formeB.aP.setXYZW(i, sortX(col, c), (R() - 0.5) * 0.00012, sortZ(l), 1)
          formeB.aQ.setXYZW(i, 0, 0, 0, 1)
          formeB.aX.setXYZW(i, col * 40 + c, l, li < 0 ? -99 : SET_T[li], R())
        }
  }
  const formeSorts = new THREE.Mesh(formeB.g, sortMat)
  formeSorts.frustumCulled = false
  scene.add(formeSorts)

  // the composing stick on the stone, with the line it still holds; the case behind, its boxes half full
  const STICK = { x: -0.062, z: 0.1665, n: 11, y: 0.0165 }
  const NL = STICK.n + 3 + 900
  const looseB = sortBatch(NL)
  const stickSlot = (k: number): [number, number, number] => [STICK.x + (k + 0.5) * CW, STICK.y + 0.003, STICK.z]
  const CASE = { x: 0.42, z: -0.2, w: 0.5, d: 0.34, nx: 8, nz: 5, tilt: 0.3 }
  const qT = new THREE.Quaternion(), eT = new THREE.Euler()
  {
    const R = rng(1377)
    // in the stick: on their feet in a row, a larger sort than the forme's so the nick reads (a display line)
    for (let k = 0; k < STICK.n + 3; k++) {
      const p = stickSlot(k)
      looseB.aP.setXYZW(k, p[0], p[1], p[2], 1)
      qT.setFromEuler(eT.set(0.0, 0, 0))
      looseB.aQ.setXYZW(k, qT.x, qT.y, qT.z, qT.w)
      // the last three leave for the forme: they are hidden once lifted (seated-at is reused as "leaves at" with a negative sign)
      looseB.aX.setXYZW(k, k >= STICK.n ? 40 + COLS - 3 + (k - STICK.n) : 40 + k, LINES - 1, k >= STICK.n ? 100 + SET_T[k - STICK.n] - 0.42 : -99, R())
    }
    // in the case: lying tumbled in their boxes (placed through the tray's own tilt)
    const qC = new THREE.Quaternion().setFromEuler(eT.set(-CASE.tilt, 0, 0))
    const vT = new THREE.Vector3()
    for (let k = STICK.n + 3; k < NL; k++) {
      const bx = Math.floor(R() * CASE.nx), bz = Math.floor(R() * CASE.nz)
      const fill = 0.35 + (0.65 * ((bx * 7 + bz * 3) % 5)) / 4
      vT.set(((bx + 0.15 + R() * 0.7) / CASE.nx - 0.5) * CASE.w, 0.002 + R() * 0.007, ((bz + 0.95 - R() * 0.75 * fill) / CASE.nz - 0.5) * CASE.d).applyQuaternion(qC)
      looseB.aP.setXYZW(k, CASE.x + vT.x, 0.02 + (CASE.d / 2) * Math.sin(CASE.tilt) + vT.y, CASE.z + vT.z, 1)
      qT.setFromEuler(eT.set(Math.PI / 2, R() * 6.28, 0)).premultiply(qC)
      looseB.aQ.setXYZW(k, qT.x, qT.y, qT.z, qT.w)
      looseB.aX.setXYZW(k, Math.floor(R() * 60), Math.floor(R() * 40), -99, R())
    }
  }
  const looseSorts = new THREE.Mesh(looseB.g, sortMat)
  looseSorts.frustumCulled = false
  scene.add(looseSorts)
  const heldB = sortBatch(1)
  heldB.aP.setUsage(THREE.DynamicDrawUsage)
  heldB.aQ.setUsage(THREE.DynamicDrawUsage)
  heldB.aX.setUsage(THREE.DynamicDrawUsage)
  const heldSort = new THREE.Mesh(heldB.g, sortMat)
  heldSort.frustumCulled = false
  scene.add(heldSort)

  // ---------------------------------------------------------------- the shop's carpentry: one material for oak, iron, brass, stone, cord, plaster, floor, paper
  //
  // Every timber is a chamfered beam carrying its own grain seed, its half-size and its kind in
  // attributes, so one shader can wear its arrises pale where hands go, darken its end grain, put
  // forge scale and rust on iron and lay ink where the work is done. A group's pieces merge into one draw.

  const K = { oak: 0, iron: 1, brass: 2, stone: 3, cord: 4, plaster: 5, floor: 6, paper: 7, lead: 8 } as const
  type T3 = [number, number, number]
  const OAK: T3 = [0.33, 0.2, 0.1], OAKD: T3 = [0.2, 0.122, 0.064], OAKY: T3 = [0.27, 0.165, 0.085], IRON: T3 = [0.075, 0.072, 0.074], BRASS: T3 = [0.5, 0.36, 0.14]
  const HEMP: T3 = [0.4, 0.32, 0.2], PARCH: T3 = [0.62, 0.55, 0.42]
  const qK = new THREE.Quaternion(), eK = new THREE.Euler(), mK = new THREE.Matrix4(), nK = new THREE.Matrix3(), vK = new THREE.Vector3(), sK = new THREE.Vector3(1, 1, 1)
  class Kit {
    pos: number[] = []
    nor: number[] = []
    aL: number[] = []
    aH: number[] = []
    aC: number[] = []
    n = 0
    /** Add a piece: `half` is its half-size in its own axes (grain along x), `ink` how much the work has stained it. */
    add(g0: THREE.BufferGeometry, half: T3, kind: number, tone: T3, at: T3, rot: T3 | THREE.Quaternion = [0, 0, 0], ink = 0) {
      const g = g0.index ? g0.toNonIndexed() : g0
      if (rot instanceof THREE.Quaternion) qK.copy(rot)
      else qK.setFromEuler(eK.set(rot[0], rot[1], rot[2]))
      mK.compose(vK.set(at[0], at[1], at[2]), qK, sK)
      nK.getNormalMatrix(mK)
      const P = g.getAttribute("position"), Nn = g.getAttribute("normal")
      const seed = ((this.n++ * 7.31) % 37) + 0.5
      for (let i = 0; i < P.count; i++) {
        vK.set(P.getX(i), P.getY(i), P.getZ(i))
        this.aL.push(vK.x, vK.y, vK.z, seed)
        vK.applyMatrix4(mK)
        this.pos.push(vK.x, vK.y, vK.z)
        vK.set(Nn.getX(i), Nn.getY(i), Nn.getZ(i)).applyMatrix3(nK).normalize()
        this.nor.push(vK.x, vK.y, vK.z)
        this.aH.push(half[0], half[1], half[2], kind)
        this.aC.push(tone[0], tone[1], tone[2], ink)
      }
      g.dispose()
      if (g !== g0) g0.dispose()
      return this
    }
    /** A rod from a to b (a cord, a hook, a bar). */
    link(a: T3, b: T3, r: number, kind: number, tone: T3, ink = 0, seg = 8) {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const L = d.length()
      return this.add(rod(r, L, seg), [L / 2, 1, 1], kind, tone, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize()), ink)
    }
    mesh(m: THREE.Material, parent: THREE.Object3D = scene) {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
      g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3))
      g.setAttribute("aL", new THREE.Float32BufferAttribute(this.aL, 4))
      g.setAttribute("aH", new THREE.Float32BufferAttribute(this.aH, 4))
      g.setAttribute("aC", new THREE.Float32BufferAttribute(this.aC, 4))
      const o = new THREE.Mesh(g, m)
      o.frustumCulled = false
      parent.add(o)
      return o
    }
  }
  /** A squared timber along x, its arrises chamfered by `c`. */
  const beam = (L: number, h: number, d: number, c = Math.min(h, d) * 0.09) => {
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
  const H3 = (L: number, h: number, d: number): T3 => [L / 2, h / 2, d / 2]
  /** A round rod along x (radius r1 at +x). */
  const rod = (r: number, L: number, seg = 12, r1 = r) => new THREE.CylinderGeometry(r1, r, L, seg).rotateZ(-Math.PI / 2)
  const VERT: T3 = [0, 0, Math.PI / 2] // a beam stood on end: its x becomes up
  const ACROSS: T3 = [0, Math.PI / 2, 0] // a beam turned to run along z

  const kitMat = new THREE.NodeMaterial()
  kitMat.fragmentNode = Fn(() => {
    const aL = attribute("aL", "vec4") as unknown as V4
    const aH = attribute("aH", "vec4") as unknown as V4
    const aC = attribute("aC", "vec4") as unknown as V4
    const q = aL.xyz.toVar()
    const seed = aL.w.toVar()
    const kind = aH.w.toVar()
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    // how far a point is from the nearest arris (the second-nearest face) and whether it is on an end
    const dd = aH.xyz.sub(abs(q)).toVar()
    const m1 = min(dd.x, min(dd.y, dd.z)), m3 = max(dd.x, max(dd.y, dd.z))
    const edge = dd.x.add(dd.y).add(dd.z).sub(m1).sub(m3).toVar()
    const endF = step(dd.x, 0.0008).mul(step(0.0012, min(dd.y, dd.z)))
    const alb = aC.rgb.toVar()
    const gloss = float(0.04).toVar()
    const shine = float(40).toVar()
    If(kind.lessThan(0.5), () => {
      // quarter-sawn oak: long grain, the rays as pale flecks, the plane's chatter across it
      const along = q.x.add(seed.mul(3.7)), ac = q.yz.add(seed.mul(1.3))
      const warp = vnoise(vec2(along.mul(2.2), ac.x.mul(9))).mul(7)
      const ring = sin(ac.x.mul(210).add(ac.y.mul(170)).add(warp)).mul(0.5).add(0.5)
      const grain = vnoise(vec2(along.mul(11), ac.x.mul(900).add(ac.y.mul(700)))).mul(0.5).add(vnoise(vec2(along.mul(1.6), ac.x.mul(60).add(ac.y.mul(47)))).mul(0.5))
      const ray = step(0.86, vnoise(vec2(along.mul(60), ac.x.mul(420).add(ac.y.mul(390)))))
      const chatter = sin(along.mul(41).add(vnoise(vec2(along.mul(3), seed)).mul(5))).mul(0.035).add(1)
      alb.mulAssign(grain.mul(0.55).add(0.55).mul(ring.mul(0.22).add(0.86)).add(ray.mul(0.16)).mul(chatter))
      // end grain: darker, the growth rings round a heart off the piece
      const heart = ac.sub(vec2(hash21(vec2(seed, 1)).sub(0.5).mul(0.3), hash21(vec2(seed, 2)).sub(0.5).mul(0.3)))
      const rings = sin(length(heart).mul(640).add(vnoise(heart.mul(70)).mul(5))).mul(0.5).add(0.5)
      alb.assign(mixN(alb, alb.mul(rings.mul(0.18).add(0.5)), endF))
      // the arrises: worn through the smoke and grime to pale wood, polished by hands
      const wear = sstep(0.011, 0.0015, edge).mul(vnoise(vec2(q.x.mul(70).add(q.y.mul(40)), q.z.mul(70).add(seed))).mul(0.7).add(0.45))
      alb.assign(mixN(alb.mul(0.9), alb.mul(1.5).add(vec3(0.03, 0.02, 0.01)), sat1(wear as F)))
      gloss.assign(grain.mul(0.18).add(wear.mul(0.4)))
    })
      .ElseIf(kind.lessThan(2.5), () => {
        // wrought iron and cast brass: forge scale, hammer pits, rust where water sits, polished on the edges
        const sc = fbm(vec2(q.x.mul(60).add(q.z.mul(40)), q.y.mul(60).add(seed)))
        const pit = vnoise(vec2(q.x.add(q.z), q.y).mul(700).add(seed))
        alb.mulAssign(sc.mul(0.6).add(0.65).mul(pit.mul(0.25).add(0.88)))
        const rust = sstep(0.6, 0.78, fbm(vec2(P.x.add(P.z), P.y).mul(19).add(seed.mul(5)))).mul(select(kind.lessThan(1.5), float(0.85), float(0.35)))
        const patina = select(kind.lessThan(1.5), vec3(0.21, 0.085, 0.035), vec3(0.12, 0.16, 0.1))
        alb.assign(mixN(alb, patina.mul(pit.mul(0.5).add(0.7)), rust))
        const polish = sstep(0.005, 0.0006, edge)
        alb.addAssign(vec3(polish.mul(0.03)))
        alb.mulAssign(0.75)
        gloss.assign(mixN(float(0.32), float(0.04), rust).add(polish.mul(0.35)).mul(select(kind.lessThan(1.5), float(1), float(1.6))))
        shine.assign(70)
      })
      .ElseIf(kind.lessThan(3.5), () => {
        // the press stone: fine limestone, ink-stained where formes have stood
        const st = fbm(P.xz.mul(14))
        alb.mulAssign(st.mul(0.25).add(0.8).mul(mixN(float(1), float(0.45), sstep(0.5, 0.75, fbm(P.xz.mul(5).add(3))))).add(vnoise(P.xz.mul(1400)).mul(0.06)))
        gloss.assign(0.12)
      })
      .ElseIf(kind.lessThan(4.5), () => {
        // hemp: the twist of the strands
        const tw = sin(q.x.mul(1500).add(atan(q.z, q.y).mul(2))).mul(0.5).add(0.5)
        alb.mulAssign(tw.mul(0.4).add(0.65).mul(vnoise(vec2(q.x.mul(90), seed)).mul(0.3).add(0.85)))
      })
      .ElseIf(kind.lessThan(5.5), () => {
        // limewash over plaster, greyed by smoke toward the ceiling and grimed at the foot
        alb.mulAssign(fbm(P.yz.mul(3).add(P.x)).mul(0.3).add(0.8).mul(mixN(float(0.55), float(1), sstep(-0.95, 0.3, P.y))).mul(vnoise(P.yz.mul(40)).mul(0.1).add(0.95)))
      })
      .ElseIf(kind.lessThan(6.5), () => {
        // the floor: oak boards along x, each its own tree, with dark seams; ink trodden in round the press
        const bz = P.z.div(0.23)
        const b = floor(bz)
        const h = hash21(vec2(b, 3.3))
        const along = P.x.add(h.mul(40)), ac = vec2(bz.sub(b).mul(0.23), b)
        const grain = vnoise(vec2(along.mul(5), ac.x.mul(300).add(ac.y.mul(7)))).mul(0.5).add(vnoise(vec2(along.mul(0.8), ac.x.mul(40).add(ac.y))).mul(0.5))
        const joint = sstep(0.006, 0.0, abs(fract(along.div(2.4).add(h)).sub(0.5)).mul(2.4).sub(1.19).abs())
        const seam = sstep(0.004, 0.0005, min(bz.sub(b), b.add(1).sub(bz)).mul(0.23))
        alb.mulAssign(h.mul(0.35).add(0.75).mul(grain.mul(0.4).add(0.7)).mul(seam.max(joint).mul(-0.75).add(1)))
        // a path worn pale between the press and the bench
        alb.mulAssign(float(1).add(exp(dot(P.xz.sub(vec2(0.4, 0.9)), P.xz.sub(vec2(0.4, 0.9))).div(-0.5)).mul(0.25)))
        gloss.assign(grain.mul(0.08))
      })
      .ElseIf(kind.lessThan(7.5), () => {
        // parchment and paper stock: fibres and cockle
        alb.mulAssign(fbm(vec2(q.x.add(q.z), q.y.add(seed)).mul(30)).mul(0.14).add(vnoise(q.xz.mul(900).add(q.y)).mul(0.06)).add(0.86))
        gloss.assign(0.02)
      })
      .Else(() => {
        // sorts heaped in a box of the case: lead glints in the dark of the compartment
        const g = vnoise(P.xz.mul(1100).add(P.y.mul(300)))
        alb.mulAssign(step(0.45, g).mul(0.9).add(0.25).mul(vnoise(P.xz.mul(140)).mul(0.4).add(0.7)))
        gloss.assign(step(0.6, g).mul(0.6))
        shine.assign(90)
      })
    // ink: blotches where the work is done, finger smudges, a spray of dots from the balls
    const inkN = fbm(vec2(P.x.mul(16).add(P.y.mul(6.1)), P.z.mul(16).sub(P.y.mul(4.3))).add(seed.mul(17)))
    const spray = step(0.955, vnoise(vec2(P.x.add(P.y.mul(0.7)), P.z).mul(520))).mul(0.5)
    const ink = sat1(sstep(0.8, 0.86, inkN.add(aC.a.mul(0.1))).mul(0.85).add(spray.mul(aC.a)).mul(step(0.001, aC.a)) as F)
    alb.assign(mixN(alb, vec3(0.014, 0.013, 0.014), ink.mul(0.92)))
    gloss.assign(mixN(gloss, float(0.5), ink))
    const c = shopLit(alb as V3, N as V3, P as V3, gloss as F, shine as F).toVar()
    c.addAssign(lampOn(alb as V3, N as V3, P as V3))
    return done(c as V3, P as V3)
  })()

  const kFrame = new Kit()
  // the bench: three boards on a pegged frame of legs, aprons and through-wedged stretchers
  for (let i = -1; i <= 1; i++) kFrame.add(beam(1.9, 0.07, 0.31, 0.006), H3(1.9, 0.07, 0.31), K.oak, i ? OAK : OAKY, [0.1, -0.056, -0.02 + i * 0.3155], [0, 0, 0], 0.45)
  const LEGX = [-0.75, 0.95], LEGZ = [-0.41, 0.37]
  for (const x of LEGX)
    for (const z of LEGZ) {
      kFrame.add(beam(0.84, 0.1, 0.1, 0.008), H3(0.84, 0.1, 0.1), K.oak, OAKD, [x, -0.53, z], VERT, 0.15)
      // pegs through the apron's tenons, standing a little proud of the leg
      for (const y of [-0.15, -0.22]) kFrame.add(rod(0.0085, 0.014, 10), [0.007, 1, 1], K.oak, OAKY, [x, y, z + Math.sign(z + 0.02) * 0.052], [0, -Math.PI / 2, 0])
    }
  for (const z of LEGZ) {
    kFrame.add(beam(1.62, 0.13, 0.04, 0.005), H3(1.62, 0.13, 0.04), K.oak, OAKD, [0.1, -0.185, z + Math.sign(z + 0.02) * 0.03], [0, 0, 0], 0.2)
    // the low stretcher runs through both legs and is wedged outside them
    kFrame.add(beam(1.92, 0.07, 0.05, 0.006), H3(1.92, 0.07, 0.05), K.oak, OAKD, [0.1, -0.79, z])
    for (const x of [-0.835, 1.035]) kFrame.add(beam(0.1, 0.014, 0.032, 0.002), H3(0.1, 0.014, 0.032), K.oak, OAKY, [x, -0.79, z], VERT)
  }
  for (const x of LEGX) kFrame.add(beam(0.7, 0.13, 0.04, 0.005), H3(0.7, 0.13, 0.04), K.oak, OAKD, [x + Math.sign(x - 0.1) * 0.03, -0.185, -0.02], ACROSS, 0.2)
  // the stone in its coffin: an oak frame with iron straps on its corners
  kFrame.add(beam(0.52, 0.06, 0.62, 0.004), H3(0.52, 0.06, 0.62), K.stone, [0.5, 0.47, 0.41], [0, -0.03, 0])
  for (const sx of [-1, 1]) kFrame.add(beam(0.74, 0.078, 0.05, 0.006), H3(0.74, 0.078, 0.05), K.oak, OAKD, [sx * 0.285, -0.033, 0], ACROSS, 0.9)
  for (const sz of [-1, 1]) kFrame.add(beam(0.52, 0.078, 0.05, 0.006), H3(0.52, 0.078, 0.05), K.oak, OAKD, [0, -0.033, sz * 0.345], [0, 0, 0], 0.9)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      kFrame.add(beam(0.09, 0.05, 0.004, 0.001), H3(0.09, 0.05, 0.004), K.iron, IRON, [sx * 0.265, -0.035, sz * 0.372])
      kFrame.add(beam(0.09, 0.05, 0.004, 0.001), H3(0.09, 0.05, 0.004), K.iron, IRON, [sx * 0.312, -0.035, sz * 0.325], ACROSS)
      for (const k of [0, 1]) kFrame.add(rod(0.0035, 0.003, 6), [0.0015, 1, 1], K.iron, IRON, [sx * (0.245 + k * 0.035), -0.035, sz * 0.3755], [0, -Math.PI / 2, 0])
    }
  // the press: two cheeks, the head and cap tenoned through them, wedged and pegged; an iron nut for the screw
  const CHX = [-0.44, 0.64]
  for (const x of CHX) {
    kFrame.add(beam(2.76, 0.11, 0.2, 0.012), H3(2.76, 0.11, 0.2), K.oak, OAKY, [x, 0.48, -0.06], VERT, 0.12)
    const out = Math.sign(x - 0.1)
    // the head's tenon through the cheek, and the wedge driven through the tenon
    kFrame.add(beam(0.075, 0.15, 0.13, 0.008), H3(0.075, 0.15, 0.13), K.oak, OAKD, [x + out * 0.085, 1.62, -0.06], [0, 0, 0])
    kFrame.add(beam(0.23, 0.018, 0.04, 0.003), H3(0.23, 0.018, 0.04), K.oak, OAKY, [x + out * 0.1, 1.62, -0.06], VERT)
    for (const y of [1.565, 1.675]) kFrame.add(rod(0.012, 0.016, 10), [0.008, 1, 1], K.oak, OAKY, [x, y, 0.046], [0, -Math.PI / 2, 0])
    // an iron strap round the head beside each cheek, nailed
    kFrame.add(beam(0.024, 0.232, 0.252, 0.002), H3(0.024, 0.232, 0.252), K.iron, IRON, [x - out * 0.1, 1.62, -0.06])
    for (const y of [1.56, 1.68]) kFrame.add(rod(0.005, 0.004, 6), [0.002, 1, 1], K.iron, IRON, [x - out * 0.1, y, 0.068], [0, -Math.PI / 2, 0])
  }
  kFrame.add(beam(1.3, 0.22, 0.24, 0.016), H3(1.3, 0.22, 0.24), K.oak, OAKD, [0.1, 1.62, -0.06], [0, 0, 0], 0.05)
  kFrame.add(beam(1.42, 0.08, 0.27, 0.01), H3(1.42, 0.08, 0.27), K.oak, OAKD, [0.1, 1.82, -0.06])
  kFrame.add(beam(0.22, 0.03, 0.2, 0.004), H3(0.22, 0.03, 0.2), K.iron, IRON, [0, 1.495, 0])
  // the case on the bench: a shallow tray of boxes, tilted toward the compositor
  const caseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-CASE.tilt, 0, 0))
  const caseAt = (x: number, y: number, z: number): T3 => {
    const v = new THREE.Vector3(x, y, z).applyQuaternion(caseQ)
    return [CASE.x + v.x, 0.02 + (CASE.d / 2) * Math.sin(CASE.tilt) + v.y, CASE.z + v.z]
  }
  kFrame.add(beam(CASE.w + 0.02, 0.008, CASE.d + 0.02, 0.002), H3(CASE.w + 0.02, 0.008, CASE.d + 0.02), K.oak, OAKD, caseAt(0, -0.004, 0), caseQ, 0.3)
  for (let i = 0; i <= CASE.nx; i++) kFrame.add(beam(CASE.d + 0.012, 0.028, 0.006, 0.0015), H3(CASE.d + 0.012, 0.028, 0.006), K.oak, OAKY, caseAt((i / CASE.nx - 0.5) * CASE.w, 0.012, 0), caseQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))), 0.3)
  for (let i = 0; i <= CASE.nz; i++) kFrame.add(beam(CASE.w + 0.012, 0.028, 0.006, 0.0015), H3(CASE.w + 0.012, 0.028, 0.006), K.oak, OAKY, caseAt(0, 0.012, (i / CASE.nz - 0.5) * CASE.d), caseQ, 0.3)
  // the chase, the furniture (oak sticks that fill the margin) and two quoins driven in at the foot
  const CH = { w: 0.33, d: 0.44, t: 0.016, h: 0.021 }
  for (const sz of [-1, 1]) kFrame.add(beam(CH.w, CH.h, CH.t, 0.002), H3(CH.w, CH.h, CH.t), K.iron, IRON, [0, CH.h / 2, (sz * CH.d) / 2], [0, 0, 0], 0.7)
  for (const sx of [-1, 1]) kFrame.add(beam(CH.d - CH.t, CH.h, CH.t, 0.002), H3(CH.d - CH.t, CH.h, CH.t), K.iron, IRON, [sx * (CH.w / 2 - CH.t / 2), CH.h / 2, 0], ACROSS, 0.7)
  const fy = 0.0165 / 2
  for (const sx of [-1, 1]) kFrame.add(beam(TH + 0.002, 0.0165, 0.047, 0.0015), H3(TH + 0.002, 0.0165, 0.047), K.oak, OAKY, [sx * (TW / 2 + 0.0255), fy, 0], ACROSS, 0.6)
  kFrame.add(beam(CH.w - 2 * CH.t - 0.002, 0.0165, 0.045, 0.0015), H3(CH.w - 2 * CH.t - 0.002, 0.0165, 0.045), K.oak, OAKY, [0, fy, -(TH / 2 + 0.0245)], [0, 0, 0], 0.6)
  kFrame.add(beam(CH.w - 2 * CH.t - 0.002, 0.0165, 0.027, 0.0015), H3(CH.w - 2 * CH.t - 0.002, 0.0165, 0.027), K.oak, OAKY, [0, fy, TH / 2 + 0.0155], [0, 0, 0], 0.6)
  kFrame.add(beam(TH, 0.0165, GUT - 0.0006, 0.001), H3(TH, 0.0165, GUT - 0.0006), K.oak, OAKY, [0, fy, 0], ACROSS, 0.6) // the gutter stick between the columns
  for (const sx of [-1, 1]) kFrame.add(beam(0.11, 0.0165, 0.0165, 0.002), H3(0.11, 0.0165, 0.0165), K.oak, OAKD, [sx * 0.07, fy, TH / 2 + 0.038], [0, sx * 0.035, 0], 0.4)
  // the composing stick: a brass tray with a back, a head and a slide
  const SL = (STICK.n + 9) * CW
  kFrame.add(beam(SL, 0.003, 0.012, 0.0005), H3(SL, 0.003, 0.012), K.oak, OAKY, [STICK.x + SL / 2, STICK.y + 0.0015, STICK.z])
  kFrame.add(beam(SL, 0.019, 0.0016, 0.0004), H3(SL, 0.019, 0.0016), K.oak, OAKY, [STICK.x + SL / 2, STICK.y + 0.0095, STICK.z - 0.0042])
  kFrame.add(beam(0.012, 0.019, 0.0016, 0.0004), H3(0.012, 0.019, 0.0016), K.oak, OAKY, [STICK.x - 0.0008, STICK.y + 0.0095, STICK.z], ACROSS)
  kFrame.add(beam(0.013, 0.021, 0.0022, 0.0005), H3(0.013, 0.021, 0.0022), K.brass, BRASS, [STICK.x + (STICK.n + 3) * CW + 0.0011, STICK.y + 0.0105, STICK.z], ACROSS)
  // the bank beside the press, where a pulled sheet is laid
  kFrame.add(beam(0.4, 0.02, 0.5, 0.004), H3(0.4, 0.02, 0.5), K.oak, OAKY, [BANK.x, -0.011, BANK.z], [0, BANK.yaw, 0], 0.35)

  // ---- the shop round the press
  kFrame.add(beam(240, 0.1, 240, 0.001), [1, 1, 1], K.floor, [0.2, 0.13, 0.075], [0, -0.95, 0])
  kFrame.add(beam(7, 4.6, 0.2, 0.01), [1, 1, 1], K.plaster, [0.2, 0.185, 0.16], [-3.4, 1.3, -0.5], [0, Math.PI / 2, 0])
  // the window: a deep oak frame, mullion and transom round the leaded lights, a stone sill
  {
    const wx = -3.28, wy = 1.25, wz = -0.3
    for (const dz of [-1, 1]) kFrame.add(beam(2.0, 0.12, 0.16, 0.012), H3(2.0, 0.12, 0.16), K.oak, OAKD, [wx, wy, wz + dz * 1.0], VERT)
    for (const dy of [-1, 1]) kFrame.add(beam(2.12, 0.12, 0.16, 0.012), H3(2.12, 0.12, 0.16), K.oak, OAKD, [wx, wy + dy * 0.91, wz], ACROSS)
    kFrame.add(beam(1.72, 0.07, 0.1, 0.01), H3(1.72, 0.07, 0.1), K.oak, OAKD, [wx, wy, wz], VERT)
    kFrame.add(beam(1.9, 0.06, 0.1, 0.01), H3(1.9, 0.06, 0.1), K.oak, OAKD, [wx, wy + 0.25, wz], ACROSS)
    kFrame.add(beam(2.3, 0.08, 0.34, 0.01), H3(2.3, 0.08, 0.34), K.stone, [0.42, 0.4, 0.36], [wx + 0.1, wy - 0.98, wz], ACROSS)
  }
  // the frame of cases behind the press: two pairs of cases on a sloping rack, their boxes full of sorts
  {
    const fx = 1.55, fz = -1.25, rot = -0.35
    const fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0))
    const at = (x: number, y: number, z: number): T3 => {
      const v = new THREE.Vector3(x, y, z).applyQuaternion(fq)
      return [fx + v.x, y, fz + v.z]
    }
    for (const x of [-0.5, 0.5]) for (const z of [-0.28, 0.28]) kFrame.add(beam(z < 0 ? 1.35 : 1.0, 0.06, 0.06, 0.006), H3(z < 0 ? 1.35 : 1.0, 0.06, 0.06), K.oak, OAKD, at(x, z < 0 ? -0.95 + 0.675 : -0.95 + 0.5, z), fq.clone().multiply(qK.setFromEuler(eK.set(0, 0, Math.PI / 2))), 0.2)
    for (const y of [-0.7, 0.05]) for (const z of [-0.28, 0.28]) kFrame.add(beam(1.06, 0.05, 0.05, 0.005), H3(1.06, 0.05, 0.05), K.oak, OAKD, at(0, y, z), fq)
    const slope = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, rot, 0, "YXZ"))
    for (const k of [0, 1]) {
      // a case: tray, rim and a lay of boxes (the lower case's are of different sizes)
      const cy = 0.18 + k * 0.17, cz = 0.12 - k * 0.27
      const tray = (x: number, y: number, z: number): T3 => {
        const v = new THREE.Vector3(x, y, z).applyQuaternion(slope)
        return [fx + v.x + new THREE.Vector3(0, 0, cz).applyQuaternion(fq).x, cy + v.y, fz + v.z + new THREE.Vector3(0, 0, cz).applyQuaternion(fq).z]
      }
      kFrame.add(beam(0.98, 0.012, 0.34, 0.002), H3(0.98, 0.012, 0.34), K.oak, OAKD, tray(0, 0, 0), slope, 0.3)
      kFrame.add(beam(0.96, 0.006, 0.32, 0.001), H3(0.96, 0.006, 0.32), K.lead, [0.34, 0.35, 0.37], tray(0, 0.006, 0), slope)
      const nx = k ? 14 : 9, nz = k ? 6 : 4
      for (let i = 0; i <= nx; i++) kFrame.add(beam(0.34, 0.03, 0.006, 0.0012), H3(0.34, 0.03, 0.006), K.oak, OAKY, tray(-0.48 + (0.96 * i) / nx + (i % 3 === 1 && !k ? 0.03 : 0), 0.015, 0), slope.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))), 0.3)
      for (let i = 0; i <= nz; i++) kFrame.add(beam(0.98, 0.03, 0.006, 0.0012), H3(0.98, 0.03, 0.006), K.oak, OAKY, tray(0, 0.015, -0.17 + (0.34 * i) / nz), slope, 0.3)
    }
  }
  // drying lines: hemp cords across the shop; on the nearest, blank stock hung to damp
  kFrame.add(beam(7, 0.005, 0.005, 0.001), [1, 1, 1], K.cord, HEMP, [0, LINE0.y + 0.001, LINE0.z])
  for (let n = 0; n < LINES_N; n++) kFrame.add(beam(7.4, 0.006, 0.006, 0.001), [1, 1, 1], K.cord, HEMP, [0, lineAt(n)[0] + 0.001, lineAt(n)[1]])
  {
    const R = rng(55)
    kFrame.add(beam(6, 0.006, 0.006, 0.001), [1, 1, 1], K.cord, HEMP, [-0.6, 2.32, -0.35])
    for (let i = 0; i < 9; i++) {
      const x = -2.9 + i * 0.36 + R() * 0.05
      for (const s of [-1, 1]) kFrame.add(beam(0.29, 0.21, 0.0015, 0.0004), H3(0.29, 0.21, 0.0015), K.paper, [0.66, 0.6, 0.48], [x, 2.32 - 0.105, -0.35 + s * 0.012], [s * 0.06, R() * 0.06, 0])
    }
  }
  kFrame.mesh(kitMat)

  // the platen on its hose, hung from it by cords at the corners; the screw and bar turn above it
  const platen = new THREE.Group()
  scene.add(platen)
  const kPlaten = new Kit()
  kPlaten.add(beam(0.36, 0.085, 0.48, 0.008), H3(0.36, 0.085, 0.48), K.oak, OAKD, [0, 0.0425, 0], [0, 0, 0], 0.55)
  kPlaten.add(beam(0.31, 0.012, 0.43, 0.002), H3(0.31, 0.012, 0.43), K.brass, [0.36, 0.27, 0.12], [0, 0.004, 0], [0, 0, 0], 0.5)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kPlaten.add(beam(0.07, 0.006, 0.07, 0.001), H3(0.07, 0.006, 0.07), K.iron, IRON, [sx * 0.145, 0.088, sz * 0.205])
    kPlaten.link([sx * 0.055, 0.15, sz * 0.055], [sx * 0.15, 0.092, sz * 0.21], 0.0045, K.cord, HEMP, 0.3)
  }
  kPlaten.add(beam(0.3, 0.11, 0.11, 0.01), H3(0.3, 0.11, 0.11), K.oak, OAKY, [0, 0.285, 0], VERT, 0.2)
  for (const y of [0.165, 0.405]) kPlaten.add(beam(0.016, 0.12, 0.12, 0.002), H3(0.016, 0.12, 0.12), K.iron, IRON, [0, y, 0], VERT)
  kPlaten.mesh(kitMat, platen)
  const spindle = new THREE.Group()
  platen.add(spindle)
  const kSpin = new Kit()
  {
    // the screw: an iron core with a square thread wound on it, coarse, four starts' worth in the visible length
    const helix = new THREE.CatmullRomCurve3(Array.from({ length: 21 * 16 + 1 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 0.04, 0.6 + (i / (21 * 16)) * 1.5, Math.sin(a) * 0.04)
    }))
    kSpin.add(rod(0.033, 1.67, 20).rotateZ(Math.PI / 2), [1, 1, 1], K.iron, IRON, [0, 1.265, 0])
    kSpin.add(new THREE.TubeGeometry(helix, 900, 0.011, 5, false), [1, 1, 1], K.iron, IRON, [0, 0, 0])
    // the eye and the bar: wrought iron, cranked, with a turned oak handle black with hands
    kSpin.add(rod(0.05, 0.07, 16).rotateZ(Math.PI / 2), [1, 1, 1], K.iron, IRON, [0, 0.47, 0])
    kSpin.add(rod(0.013, 0.56, 10), [0.28, 1, 1], K.iron, IRON, [0.3, 0.47, 0])
    kSpin.add(rod(0.019, 0.3, 12, 0.023), [0.15, 1, 1], K.oak, OAKY, [0.72, 0.47, 0], [0, 0, 0], 0.9)
    kSpin.add(rod(0.023, 0.012, 12), [0.006, 1, 1], K.iron, IRON, [0.578, 0.47, 0])
  }
  kSpin.mesh(kitMat, spindle)

  // the tympan, hinged at the far end of the coffin, with the frisket hinged on its free end
  const tympan = new THREE.Group()
  tympan.position.set(0, Y_SHEET, -SH / 2 - HINGE_OFF)
  scene.add(tympan)
  const frisket = new THREE.Group()
  frisket.position.set(0, -0.0016, SH + HINGE_OFF + 0.03)
  tympan.add(frisket)
  {
    const kT = new Kit(), zc = HINGE_OFF + SH / 2
    // an oak frame, its corners halved together and strapped with iron
    for (const sx of [-1, 1]) kT.add(beam(0.52, 0.014, 0.026, 0.003), H3(0.52, 0.014, 0.026), K.oak, OAKD, [sx * 0.18, 0.006, zc], ACROSS, 0.5)
    for (const z of [-0.022, SH + HINGE_OFF + 0.036]) kT.add(beam(0.386, 0.014, 0.026, 0.003), H3(0.386, 0.014, 0.026), K.oak, OAKD, [0, 0.0062, z], [0, 0, 0], 0.5)
    for (const sx of [-1, 1]) for (const z of [-0.022, SH + HINGE_OFF + 0.036]) kT.add(beam(0.05, 0.016, 0.03, 0.001), H3(0.05, 0.016, 0.03), K.iron, IRON, [sx * 0.18, 0.0062, z], [0, Math.PI / 4, 0])
    for (const sx of [-1, 1]) {
      kT.add(rod(0.0075, 0.05, 10), [0.025, 1, 1], K.iron, IRON, [sx * 0.12, 0.002, -0.022])
      // the points: two spikes that pierce the sheet for register
      kT.add(rod(0.0016, 0.006, 6, 0.0001).rotateZ(-Math.PI / 2), [1, 1, 1], K.iron, IRON, [sx * 0.165, -0.002, zc])
    }
    kT.mesh(kitMat, tympan)
    const kF = new Kit(), fl0 = -(SH + 0.05) / 2
    for (const sx of [-1, 1]) kF.add(beam(SH + 0.05, 0.003, 0.01, 0.001), H3(SH + 0.05, 0.003, 0.01), K.iron, IRON, [sx * 0.168, 0, fl0], ACROSS, 0.5)
    for (const z of [0, -(SH + 0.05)]) kF.add(beam(0.346, 0.003, 0.01, 0.001), H3(0.346, 0.003, 0.01), K.iron, IRON, [0, 0, z], [0, 0, 0], 0.5)
    // the frisket's paper: it masks the margins (cut out over the text), black where the forme's edges have inked it
    const mx = (SW - TW) / 2 + 0.008, mz = (SH - TH) / 2 + 0.008
    for (const sx of [-1, 1]) kF.add(beam(SH + 0.04, 0.0008, mx, 0.0001), H3(SH + 0.04, 0.0008, mx), K.paper, PARCH, [sx * (SW / 2 - mx / 2 + 0.01), 0.0005, fl0], ACROSS, 0.6)
    for (const sz of [-1, 1]) kF.add(beam(SW + 0.02, 0.0008, mz, 0.0001), H3(SW + 0.02, 0.0008, mz), K.paper, PARCH, [0, 0.0005, fl0 + sz * (SH / 2 - mz / 2 + 0.01)], [0, 0, 0], 0.6)
    kF.add(rod(0.006, 0.04, 8), [0.02, 1, 1], K.iron, IRON, [-0.1, 0, 0.004])
    kF.add(rod(0.006, 0.04, 8), [0.02, 1, 1], K.iron, IRON, [0.1, 0, 0.004])
    kF.mesh(kitMat, frisket)
  }

  // the ink balls: a turned handle, a wooden cup, and sheepskin stuffed with wool, gathered and tacked round the cup
  const ballGeo = (() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 0.5
      pts.push(new THREE.Vector2(0.064 * Math.sin(a) ** 0.7, 0.03 * (1 - Math.cos(a))))
    }
    pts.push(new THREE.Vector2(0.063, 0.036), new THREE.Vector2(0.058, 0.046), new THREE.Vector2(0.048, 0.052), new THREE.Vector2(0.034, 0.056))
    return new THREE.LatheGeometry(pts, 40)
  })()
  const leatherMat = new THREE.NodeMaterial()
  leatherMat.fragmentNode = Fn(() => {
    const q = positionLocal
    const P = positionWorld
    const N = normalize(normalWorld).toVar()
    const ang = atan(q.z, q.x)
    // taut over the wool on the face, gathered into radial folds where it is drawn up round the cup
    const gather = sstep(0.036, 0.054, q.y)
    const fold = sin(ang.mul(31).add(vnoise(vec2(ang.mul(6), q.y.mul(60))).mul(5))).mul(vnoise(vec2(ang.mul(11), 3)).mul(0.8).add(0.4)).toVar()
    const lump = vnoise(vec2(ang.mul(3), q.y.mul(30))).sub(0.5)
    N.assign(normalize(N.add(normalize(vec3(q.z.negate(), 0, q.x)).mul(fold.mul(0.5).mul(gather))).add(vec3(0, lump.mul(0.12), 0))))
    // the grain of sheepskin: fine, not pebbled; creased where it flexes
    const pore = vnoise(q.xz.mul(2600).add(q.y.mul(900))).mul(0.5).add(vnoise(q.xz.mul(620)).mul(0.5))
    const crease = sstep(0.04, 0.0, abs(vnoise(vec2(ang.mul(9), length(q.xz).mul(90))).sub(0.5))).mul(0.25)
    const alb = vec3(0.085, 0.05, 0.03).mul(pore.mul(0.1).add(0.92)).mul(crease.oneMinus()).mul(fold.mul(gather).mul(0.18).add(1)).toVar()
    // tacks round the cup
    const tack = sstep(0.0028, 0.0018, length(vec2(fract(ang.mul(14 / 6.2832)).sub(0.5).mul(6.2832 / 14).mul(0.058), q.y.sub(0.048))))
    // the face is black with ink, wet and glossy, worn to the leather where the ball is gripped
    const inked = sstep(0.026, 0.008, q.y.add(pore.mul(0.004)).add(vnoise(vec2(ang.mul(5), 1)).mul(0.008)))
    alb.assign(mixN(alb, vec3(0.008, 0.008, 0.01), inked))
    alb.assign(mixN(alb, vec3(0.12, 0.115, 0.11), tack))
    const gloss = mixN(float(0.1).add(gather.mul(0.06)), float(1.6), inked).add(tack.mul(0.6))
    return done(shopLit(alb as V3, N as V3, P as V3, gloss as F, 60), P as V3)
  })()
  const balls = [0, 1].map(() => {
    const g = new THREE.Group()
    const kH = new Kit()
    kH.add(new THREE.LatheGeometry([[0.036, 0.054], [0.038, 0.066], [0.02, 0.074], [0.014, 0.1], [0.018, 0.13], [0.0195, 0.16], [0.015, 0.183], [0.011, 0.19], [0, 0.193]].map(([x, y]) => new THREE.Vector2(x, y)), 18), [1, 1, 1], K.oak, OAKY, [0, 0, 0], [0, 0, 0], 0.7)
    kH.mesh(kitMat, g)
    g.add(new THREE.Mesh(ballGeo, leatherMat))
    scene.add(g)
    return g
  })

  // ---------------------------------------------------------------- the sheet: damp rag paper on a hinge, pulled, peeled, hung

  const sheetP = (st: V2): V3 => {
    const x = st.x.sub(0.5).mul(SW)
    const r = st.y.oneMinus().mul(SH).add(HINGE_OFF)
    // on the tympan: a rigid frame turning on its hinge at the coffin's far end
    const tym = vec3(x, r.mul(sin(U.alpha)).add(Y_SHEET), r.mul(cos(U.alpha)).sub(SH / 2 + HINGE_OFF))
    // taken off by its corner: the corner rides the hand, the far side follows a beat behind and hangs from it
    const d = length(vec2(st.x.mul(SW), st.y.mul(SH))).div(Math.hypot(SW, SH))
    const pa = U.MA.mul(vec4(tym, 1)).xyz, pb = U.MB.mul(vec4(tym, 1)).xyz
    const lifted = mixN(pa, pb, d).sub(vec3(0, U.sag.mul(d.mul(d)), 0))
    // over the drying line: folded across its middle, swaying
    const t = st.y.sub(0.5).mul(SH)
    const sway = sin(U.time.mul(1.3).add(x.mul(4))).mul(0.06).mul(abs(t))
    // (x negated: the sheet on the bank lies turned end for end, so it goes up without folding through itself)
    const hung = vec3(x.negate(), float(LINE0.y).sub(abs(t)), sign(t).mul(0.004).add(LINE0.z).add(sway))
    const k = sstep(0, 1, U.hang.mul(1.2).sub(st.y.mul(0.2)))
    return mixN(lifted, hung, k).add(vec3(0, sin(k.mul(3.14159)).mul(0.25), 0)) as V3
  }
  const sheetMat = new THREE.NodeMaterial()
  const sheetW = Fn(() => sheetP(uvAttr() as V2))()
  const sheetN = Fn(() => {
    const st = uvAttr()
    const p0 = sheetP(st as V2)
    return normalize(cross(sheetP(st.add(vec2(0.004, 0)) as V2).sub(p0), sheetP(st.add(vec2(0, 0.004)) as V2).sub(p0)))
  })()
  sheetMat.vertexNode = vp.mul(vec4(sheetW, 1))
  sheetMat.side = THREE.DoubleSide
  sheetMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const P = sheetW.toVarying()
    const Nv = normalize(sheetN.toVarying()).toVar()
    const V = normalize(U.camP.sub(P))
    const back = step(0, dot(Nv, V)) // 1: the side the platen pressed on
    const N = mixN(Nv.negate(), Nv, back).toVar()
    // where on the page: metres from the text block's left edge (reading), and the line
    const X = float(TW / 2).sub(st.x.sub(0.5).mul(SW)).toVar()
    const Lc = st.y.oneMinus().mul(SH).sub(SH / 2).add(TH / 2).div(LH).toVar()
    const colW = COLS * CW + GUT
    const col = step(colW, X)
    const xc = X.sub(col.mul(colW)).toVar()
    const inside = step(0, X).mul(step(xc, COLS * CW)).mul(step(0, Lc)).mul(step(Lc, LINES))
    const c = floor(xc.div(CW))
    const l = floor(Lc)
    const gs = glyphOf(col.mul(40).add(c) as F, l as F)
    const gu = fract(xc.div(CW)), gv = fract(Lc)
    const a = fountAt(gs.x as F, gu as F, gv as F).mul(gs.y.oneMinus()).mul(inside).toVar()
    // rag paper: long fibres both ways, a cloudy formation, the laid lines of the mould
    const fib = vnoise(st.mul(vec2(1900, 260))).mul(0.5).add(vnoise(st.mul(vec2(300, 2300)).add(3.1)).mul(0.5)).toVar()
    const cloud = fbm(st.mul(vec2(11, 15)))
    const laid = sin(st.y.mul(SH * 6283)).mul(0.012).mul(sstep(0.0009, 0.0003, abs(dFdy(st.y)).add(abs(dFdx(st.y))).mul(SH)))
    const damp = U.dryInk.oneMinus()
    const paper = vec3(0.74, 0.66, 0.5).mul(fib.mul(0.1).add(cloud.mul(0.14)).add(0.82).add(laid)).mul(damp.mul(-0.16).add(1)).toVar()
    const col3 = vec3(0).toVar()
    If(back.greaterThan(0.5), () => {
      // the back: the bite stands up through the sheet, lit from the window side; a breath of show-through
      const bx = fountAt(gs.x as F, gu.sub(0.08) as F, gv as F).sub(fountAt(gs.x as F, gu.add(0.08) as F, gv as F)).mul(gs.y.oneMinus()).mul(inside).mul(U.printed)
      const alb = paper.mul(bx.mul(0.5).add(1)).mul(sstep(0.35, 0.6, a).mul(0.07).mul(U.printed).oneMinus())
      col3.assign(shopLit(alb as V3, N as V3, P as V3, 0.02))
    }).Else(() => {
      // the face: ink squeezed to a darker rim at every edge, feathered a little along the fibres
      const w = max(abs(dFdx(a)).add(abs(dFdy(a))), 0.015)
      const edge = a.add(fib.sub(0.5).mul(0.085))
      const ink = sstep(float(0.5).sub(w), float(0.5).add(w), edge).toVar()
      const wick = sstep(0.36, 0.5, a.add(vnoise(st.mul(vec2(5200, 700))).sub(0.5).mul(0.26))).mul(0.22)
      const core = sstep(0.62, 0.8, a) // the middle of a stroke, where the ink was pressed thin
      const dens = max(ink.mul(core.mul(-0.1).add(1)), wick).mul(U.printed).toVar()
      const alb = mixN(paper.mul(1.05), vec3(0.012, 0.011, 0.012), dens).toVar()
      // the rubricator's initial, painted into the blank: top to bottom, wet behind the brush
      const iu = xc.div(GAP.n * CW), iv = Lc.sub(GAP.l0).div(GAP.lines)
      const inGap = col.mul(step(0, iu)).mul(step(iu, 1)).mul(step(0, iv)).mul(step(iv, 1.12))
      const ri = tInit.sample(vec2(clampN(iu, 0.01, 0.99), float(1).sub(clampN(iv, 0.0, 0.99)))).r.add(fib.sub(0.5).mul(0.06))
      const wr = max(abs(dFdx(ri)).add(abs(dFdy(ri))), 0.02)
      const reach = U.red.mul(1.3).sub(iv.mul(0.85).add(iu.mul(0.15)))
      const red = sstep(float(0.5).sub(wr), float(0.5).add(wr), ri).mul(inGap).mul(step(0, reach)).toVar()
      alb.assign(mixN(alb, vec3(0.6, 0.055, 0.03).mul(fib.mul(0.25).add(0.85)), red))
      const wetRed = red.mul(sstep(0.35, 0.0, reach))
      const gloss = dens.mul(mixN(float(0.16), float(0.04), U.dryInk)).mul(fib.mul(0.8).add(0.6)).add(wetRed.mul(0.5))
      col3.assign(shopLit(alb as V3, N as V3, P as V3, gloss as F, 160))
    })
    return done(col3 as V3, P as V3)
  })()
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 110, 150), sheetMat)
  sheet.frustumCulled = false
  scene.add(sheet)
  // the JS twins: the tympan's hinge, and the sheet laid face up on the bank (turned over end for end, so it reads)
  const mT1 = new THREE.Matrix4(), mT2 = new THREE.Matrix4()
  const hingeM = (al: number, out: THREE.Matrix4) => out.makeTranslation(0, Y_SHEET, -SH / 2 - HINGE_OFF).multiply(mT1.makeRotationX(-al)).multiply(mT2.makeTranslation(0, -Y_SHEET, SH / 2 + HINGE_OFF))
  const BANK_M = new THREE.Matrix4().makeTranslation(BANK.x, BANK.y, BANK.z).multiply(new THREE.Matrix4().makeRotationY(BANK.yaw)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, -Y_SHEET, 0))
  const HEAP_M = BANK_M.clone().multiply(hingeM(AL_OPEN, new THREE.Matrix4()).invert())
  const C0 = new THREE.Vector3(-SW / 2, Y_SHEET, SH / 2).applyMatrix4(hingeM(AL_OPEN, new THREE.Matrix4()))
  const C1 = C0.clone().applyMatrix4(HEAP_M)
  const QH = new THREE.Quaternion().setFromRotationMatrix(HEAP_M)
  const qL = new THREE.Quaternion(), vL = new THREE.Vector3(), mL = new THREE.Matrix4(), vM = new THREE.Vector3(1, 1, 1)
  /** The lift at progress k: the corner carried on an arc from the tympan to the bank, the sheet turning over under it. */
  const liftM = (k: number, out: THREE.Matrix4) => {
    const e = E.io2(clamp(k))
    qL.identity().slerp(QH, e)
    vL.lerpVectors(C0, C1, e)
    vL.y += 0.2 * Math.sin(Math.PI * e)
    vL.z += 0.12 * Math.sin(Math.PI * e)
    return out.compose(vL, qL, vM).multiply(mL.makeTranslation(-C0.x, -C0.y, -C0.z))
  }
  const GAP_BED: [number, number] = [sortX(GAP.col, GAP.c0 + 1), sortZ(GAP.l0) + LH / 2]

  // ---------------------------------------------------------------- the shop: drying lines, shelves, the window

  const BAYS = WALL.cols / 34, BAY = WW / BAYS
  {
    // shelves: a board under every row with a lipped front, an upright between bays, a boarded back
    const kW = new Kit()
    for (let r = 0; r <= WALL_ROWS; r++) {
      kW.add(beam(WW + 0.3, 0.04, 0.34, 0.008), H3(WW + 0.3, 0.04, 0.34), K.oak, OAKD, [0, WALL.y0 + r * WALL.ph - 0.02, WALL.z - 0.1])
      kW.add(beam(WW + 0.3, 0.06, 0.03, 0.006), H3(WW + 0.3, 0.06, 0.03), K.oak, OAKY, [0, WALL.y0 + r * WALL.ph - 0.03, WALL.z + 0.075])
    }
    for (let b = 0; b <= BAYS; b++) kW.add(beam(WHt + 0.1, 0.07, 0.38, 0.01), H3(WHt + 0.1, 0.07, 0.38), K.oak, OAKY, [-WW / 2 + b * BAY, WALL.y0 + WHt / 2, WALL.z - 0.1], VERT)
    kW.add(beam(WW + 0.4, WHt + 0.4, 0.05, 0.004), [1, 1, 1], K.oak, OAKD, [0, WALL.y0 + WHt / 2, WALL.z - 0.29])
    kW.mesh(kitMat)
  }
  // the lamps along the wall: a flame in a horn lantern, one to each pool of light
  const lampMat = new THREE.NodeMaterial()
  {
    const nx = Math.round(WW / LAMP.dx), ny = Math.floor(WHt / LAMP.dy)
    const g = new THREE.InstancedBufferGeometry()
    const sg = new THREE.SphereGeometry(0.06, 10, 8)
    g.index = sg.index
    g.setAttribute("position", sg.getAttribute("position"))
    g.setAttribute("normal", sg.getAttribute("normal"))
    const a = new Float32Array(nx * ny * 4)
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) a.set([...lampXY(i, j), (i * 7 + j * 3) % 5 < 3 ? WALL.z + LAMP.z : -999, (i * 7 + j * 13) % 11], (i * ny + j) * 4)
    g.setAttribute("aLamp", new THREE.InstancedBufferAttribute(a, 4))
    g.instanceCount = nx * ny
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
    const aLp = attribute("aLamp", "vec4") as unknown as V4
    const flick = sin(U.time.mul(7.3).add(aLp.w.mul(3.1))).mul(0.08).add(sin(U.time.mul(13.1).add(aLp.w)).mul(0.05)).add(1)
    const lw = aLp.xyz.add(positionGeometry.mul(vec3(0.7, 1.3, 0.7)))
    lampMat.vertexNode = vp.mul(vec4(lw, 1))
    lampMat.fragmentNode = Fn(() => {
      const c = vec3(1.0, 0.62, 0.26).mul(U.wallLit.mul(14)).mul(flick.toVarying())
      return done(c as V3, lw.toVarying() as V3)
    })()
    const lamps = new THREE.Mesh(g, lampMat)
    lamps.frustumCulled = false
    scene.add(lamps)
  }
  // the window: leaded glass, bright, in the wall to the left
  const winMat = new THREE.NodeMaterial()
  winMat.fragmentNode = Fn(() => {
    const st = uvAttr()
    const lead = min(abs(fract(st.x.mul(3)).sub(0.5)), abs(fract(st.y.mul(4)).sub(0.5)))
    const dia = abs(fract(st.x.mul(9).add(st.y.mul(12))).sub(0.5)).min(abs(fract(st.x.mul(9).sub(st.y.mul(12))).sub(0.5)))
    const glass = sstep(0.02, 0.05, lead).mul(sstep(0.02, 0.06, dia).mul(0.5).add(0.5))
    const sky = mixN(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.97, 0.9), st.y).mul(vnoise(st.mul(vec2(27, 36))).mul(0.3).add(0.85))
    return done(sky.mul(glass).mul(5.5).add(0.01) as V3, positionWorld as V3)
  })()
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7).rotateY(Math.PI / 2), winMat)
  win.position.set(-3.29, 1.25, -0.3)
  scene.add(win)

  // ---------------------------------------------------------------- the pages: one draw, every one placed from the beat clock

  const SPAN = T_STOP - 1.3 - T_STORM
  /** When page j leaves the press: the count doubles `DOUBLINGS` times over the span, so each doubling takes as long as the last. */
  const birth = (j: number) => (j < HUNG ? T_HANG + 0.25 + (2.1 * Math.log2(1 + j)) / Math.log2(1 + HUNG) : 0) || T_STORM + (SPAN * Math.log2(1 + (j * (2 ** DOUBLINGS - 1)) / NP)) / DOUBLINGS
  const pageGeo = new THREE.InstancedBufferGeometry()
  {
    const b = new THREE.BoxGeometry(1, 1, 1, 2, 1, 1)
    pageGeo.index = b.index
    pageGeo.setAttribute("position", b.getAttribute("position"))
    const aI = new Float32Array(NP * 4), aD = new Float32Array(NP * 4)
    const R = rng(1500)
    // the shelves, packed: each bay holds 34 books of their own thicknesses side by side, bound in runs
    // (a set in one leather, of one height), the run pushed in or out together; a few gaps where a book is out
    const slotX = new Float32Array(WALL_ROWS * WALL.cols), slotW = new Float32Array(WALL_ROWS * WALL.cols), slotH = new Float32Array(WALL_ROWS * WALL.cols), slotZ = new Float32Array(WALL_ROWS * WALL.cols)
    {
      const Q = rng(1501)
      const w = new Float32Array(34)
      for (let r = 0; r < WALL_ROWS; r++)
        for (let b = 0; b < BAYS; b++) {
          let run = 0, hue = 0, thick = 0, dz = 0, sum = 0
          for (let k = 0; k < 34; k++) {
            if (run-- <= 0) {
              run = 2 + Math.floor(Q() * Q() * 11)
              hue = Q()
              thick = 0.6 + Q() * 1.1
              dz = (Q() - 0.5) * 0.05
            }
            w[k] = thick * (0.85 + Q() * 0.3) * (Q() < 0.04 ? 1.8 : 1)
            const i = r * WALL.cols + b * 34 + k
            slotH[i] = Math.min(0.999, Math.max(0, hue + (Q() - 0.5) * 0.04))
            slotZ[i] = dz + Q() * 0.008
            sum += w[k]
          }
          const span = BAY - 0.09
          let x = -WW / 2 + b * BAY + 0.045
          for (let k = 0; k < 34; k++) {
            const i = r * WALL.cols + b * 34 + k
            const p = (w[k] / sum) * span
            slotX[i] = x + p / 2
            slotW[i] = p * (0.9 + Q() * 0.06)
            x += p
          }
        }
    }
    for (let j = 0; j < NP; j++) {
      aI.set([birth(j), R(), R(), R()], j * 4)
      if (j < HUNG) {
        // the lines fill from the middle outward, the nearest first
        const n = Math.floor(j / PER_LINE), k = j % PER_LINE
        const side = k % 2 ? 1 : -1
        aD.set([side * (Math.floor(k / 2) + 0.5) * 0.47 + (R() - 0.5) * 0.03, lineAt(n)[0], lineAt(n)[1], 0], j * 4)
      } else {
        // the wall fills from the bottom shelf up; along a shelf in no order
        const w = j - HUNG
        const row = Math.floor(w / WALL.cols), cc = (w * 197 + row * 61) % WALL.cols
        const i = Math.min(row, WALL_ROWS - 1) * WALL.cols + cc
        aI[j * 4 + 3] = slotH[i]
        aD.set([slotX[i], WALL.y0 + row * WALL.ph + SH / 2, WALL.z + 0.03 + slotZ[i], slotW[i]], j * 4)
      }
    }
    pageGeo.setAttribute("aI", new THREE.InstancedBufferAttribute(aI, 4))
    pageGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(aD, 4))
    pageGeo.instanceCount = NP
    pageGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  }
  const pageMat = new THREE.NodeMaterial()
  {
    const aI = attribute("aI", "vec4") as unknown as V4
    const aD = attribute("aD", "vec4") as unknown as V4
    const lp = positionGeometry
    const age = U.t1.sub(aI.x)
    const k = sat1(age.div(aI.y.mul(0.45).add(1.05)) as F).toVar()
    const e = k.mul(k).mul(k.mul(-2).add(3))
    const wall = step(0.0001, aD.w)
    const world = Fn(() => {
      const fold = sstep(0.18, 0.55, k).mul(mixN(float(2.95), float(3.1), wall))
      const th = mixN(float(0.0009), aD.w, sstep(0.7, 0.98, k).mul(wall))
      // local: x across the sheet (the fold on x = 0), y its thickness, z its height
      const X = lp.x.mul(SW), Y = lp.y.mul(th)
      const up = step(0.01, lp.x)
      const fx = mixN(X, X.mul(cos(fold)).sub(Y.mul(sin(fold))), up)
      const fy = mixN(Y, X.mul(sin(fold)).add(Y.mul(cos(fold))).add(th.mul(sstep(0.1, 0.6, k))), up)
      const lz = lp.z.mul(SH).mul(mixN(float(1), aI.w.mul(0.3).add(0.72), sstep(0.7, 0.98, k).mul(wall))).sub(aI.w.oneMinus().mul(0.3 * SH / 2).mul(sstep(0.7, 0.98, k)).mul(wall))
      // on the line: the fold over the cord, both halves hanging; on the shelf: the fold is the spine, out toward the room
      const off = mixN(vec3(lz, fx, fy), vec3(fy, lz, fx), wall).toVar()
      // tumbling in the air, square on arrival
      const ax = normalize(vec3(aI.y.sub(0.5), aI.z.sub(0.5), aI.w.sub(0.5)).add(0.001))
      const A = e.oneMinus().mul(aI.w.mul(7).add(3))
      off.assign(off.mul(cos(A)).add(cross(ax, off).mul(sin(A))).add(ax.mul(dot(ax, off)).mul(float(1).sub(cos(A)))))
      const s0 = vec3(0, 0.06, 0.03)
      const arc = sin(k.mul(3.14159))
      const reach = length(aD.xyz.sub(s0))
      const c = mixN(s0, aD.xyz, e).add(vec3(sin(k.mul(11).add(aI.z.mul(6.28))).mul(0.2), reach.mul(0.16).add(0.5), cos(k.mul(9).add(aI.w.mul(6.28))).mul(0.2)).mul(arc))
      // hung sheets sway on the line
      const sway = vec3(0, 0, sin(U.time.mul(1.2).add(aD.x.mul(3)).add(aD.z)).mul(0.05).mul(off.y.negate())).mul(wall.oneMinus()).mul(step(0.999, k))
      return c.add(off.mul(step(0, age))).add(sway)
    })()
    pageMat.vertexNode = vp.mul(vec4(world, 1))
    pageMat.fragmentNode = Fn(() => {
      const P = world.toVarying()
      const l = lp.toVarying()
      const rnd = aI.toVarying()
      const bk = sstep(0.72, 0.92, k).mul(wall).toVarying()
      const V = normalize(U.camP.sub(P))
      const n0 = cross(dFdx(P), dFdy(P))
      const N = normalize(n0.mul(sign(dot(n0, V)).add(0.0001))).toVar()
      // a printed sheet: two grey columns of lines on each half, until they are too fine to draw
      const zz = l.z.mul(LINES * 1.25)
      const fine = sstep(1.2, 0.4, abs(dFdx(zz)).add(abs(dFdy(zz))))
      const colm = step(abs(abs(l.x).sub(0.25)), 0.19).mul(step(abs(abs(abs(l.x).sub(0.25)).sub(0.1)), 0.08)).mul(step(abs(l.z), 0.38))
      const text = colm.mul(mixN(float(0.5), step(0.42, fract(zz)), fine))
      const paper = vec3(0.74, 0.69, 0.57).mul(rnd.z.mul(0.12).add(0.9)).mul(text.mul(0.55).oneMinus())
      // a bound book: calf, pigskin or vellum over boards, raised bands on the spine, the leaves' edges on top
      // a run of one binding: calf (most), red-dyed goat, alum-tawed pigskin, black, a little green; each book its own wear
      const hue = rnd.w
      const jit = hash21(vec2(rnd.x.mul(91), rnd.y.mul(37)))
      const calf = mixN(vec3(0.075, 0.04, 0.022), vec3(0.3, 0.17, 0.085), hue.mul(2))
      const leather = select(hue.lessThan(0.5), calf, select(hue.lessThan(0.64), vec3(0.3, 0.045, 0.03), select(hue.lessThan(0.8), vec3(0.58, 0.52, 0.4), select(hue.lessThan(0.87), vec3(0.035, 0.03, 0.028), select(hue.lessThan(0.91), vec3(0.08, 0.12, 0.07), vec3(0.15, 0.08, 0.04)))))).mul(jit.mul(0.35).add(0.8)).toVar()
      // the spine: raised bands over the cords, rubbed pale on their tops, a paper title on some
      const band = sstep(0.04, 0.012, abs(fract(l.z.mul(5).add(0.5)).sub(0.5)))
      leather.mulAssign(band.mul(0.5).add(0.72).mul(sstep(0.56, 0.2, l.z).mul(0.4).add(0.6)))
      const label = step(0.7, jit).mul(step(abs(l.z.sub(0.28)), 0.07))
      leather.assign(mixN(leather, vec3(0.6, 0.55, 0.44), label.mul(0.8)))
      const leaves = vec3(0.7, 0.64, 0.5).mul(fract(P.x.mul(700)).mul(0.2).add(0.8))
      // the sides of the boards in shadow, so book stands apart from book; the top of each compartment under the shelf above
      const side = abs(N.x)
      const under = sstep(0.42, 0.92, fract(P.y.sub(WALL.y0).div(WALL.ph)))
      const book = mixN(leather.mul(side.mul(-0.6).add(1)), leaves.mul(0.7), step(0.7, N.y)).mul(under.mul(-0.55).add(1))
      const alb = mixN(paper, book, bk)
      const c = shopLit(alb as V3, N as V3, P as V3, bk.mul(0.25), 30).toVar()
      // light through a sheet
      c.addAssign(paper.mul(KEYC).mul(max(dot(N, KEYN).negate(), 0)).mul(0.4).mul(bk.oneMinus()).mul(exp(length(P).mul(-0.25)).mul(0.8).add(0.2)))
      // the back of the shop is lit by its own lamps once there is something on the shelves
      c.addAssign(lampOn(alb as V3, N as V3, P as V3))
      return done(c as V3, P as V3)
    })()
  }
  const pages = new THREE.Mesh(pageGeo, pageMat)
  pages.frustumCulled = false
  scene.add(pages)

  // ---------------------------------------------------------------- hands: the compositor's, then the pressman's (the toolkit's macro forearm and hand)
  //
  // One right hand, `hand.makeHand`, in its tripod pinch. It is placed by the pinch: the point between
  // the pads on the pinch's axis is put where the sort (or the sheet's corner) is held, with that axis
  // pointing the way the held thing hangs and the fingers heading in from the worker's side. Framed at
  // a third of the frame or less, always moving, in the window's raking light; ink in the creases.
  const HMOD = HM.makeHand({ side: "R", mass: 1.05 })
  const HLOOK = HM.handLook(HMOD, { skin: 0x9a6a4e, hair: 0.45, veins: 0.5, callus: 0.45, clay: 0.4, clayCol: 0x17140f })
  const aim = makeAim()
  const herd = makeHerd({
    spec: HMOD.spec,
    count: 1,
    path: aim,
    lods: [{ detail: 1, cover: 0 }],
    material: (n) => {
      const L: Lights = { key: KEYN as unknown as V3, keyCol: KEYC.mul(0.85) as V3, sky: SKYC.mul(1.6) as V3, bounce: BOUNCE.mul(1.5) as V3, shadow: (q: V3) => bars(q) }
      const m = skinMaterial(n, L, HLOOK)
      const f = m.fragmentNode as unknown as V4
      m.fragmentNode = vec4(f.rgb, depthOf(n.vW))
      return m
    },
  })
  herd.group.traverse((o) => (o.frustumCulled = false))
  scene.add(herd.group)
  const STY = HMOD.anchors.stylus
  /** Where along the pinch's axis (tip end 0, knuckle end 1) the pads close. */
  const PIN_U = 0.5
  const PIN_L = new THREE.Vector3().lerpVectors(new THREE.Vector3(...STY[0]), new THREE.Vector3(...STY[1]), PIN_U)
  const S_L = new THREE.Vector3(...STY[0]).sub(new THREE.Vector3(...STY[1])).normalize() // down the pinch, toward the held thing's foot
  const XO_L = new THREE.Vector3(1, 0, 0).addScaledVector(S_L, -S_L.x).normalize()
  const BL = new THREE.Matrix4().makeBasis(S_L, XO_L, new THREE.Vector3().crossVectors(S_L, XO_L)).transpose()
  const hand = { on: false, grip: 0, roll: 0, elbow: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(), Z: new THREE.Vector3() }
  const hv0 = new THREE.Vector3(), hv1 = new THREE.Vector3(), hv2 = new THREE.Vector3(), hM = new THREE.Matrix4(), hE = [0, 0, 0], hD = [1, 0, 0]
  /** Put the pinch at `at`, its axis along `down`, the fingers heading along `heading` (made square to `down`). */
  const placeHand = (at: THREE.Vector3, down: THREE.Vector3, heading: THREE.Vector3) => {
    hv0.copy(heading).addScaledVector(down, -heading.dot(down)).normalize()
    hv1.crossVectors(down, hv0)
    hM.makeBasis(down, hv0, hv1).multiply(BL)
    hand.X.set(1, 0, 0).applyMatrix4(hM)
    hand.Y.set(0, 1, 0).applyMatrix4(hM)
    hand.Z.crossVectors(hand.X, hand.Y)
    // the rig's frame for a heading: right is horizontal, up is right x heading; roll turns up toward right
    hv2.set(-hand.X.z, 0, hand.X.x).normalize()
    hv0.crossVectors(hv2, hand.X)
    hand.roll = Math.atan2(hand.Y.dot(hv2), hand.Y.dot(hv0))
    hand.elbow.copy(at).addScaledVector(hand.X, -PIN_L.x).addScaledVector(hand.Y, -PIN_L.y).addScaledVector(hand.Z, -PIN_L.z)
  }
  const fillHand = (_i: number, d: Drive) => {
    d.dist = 0
    d.lane = 0
    d.rise = 0
    d.time = U.time.value
    d.scale = 1
    d.seed = 3
    d.look = null
    for (const k in d.ch) d.ch[k] = 0
    d.ch.pinch = hand.grip
    d.ch.curl = (1 - hand.grip) * 0.55
    d.roll = hand.roll
  }
  const poseHand = () => {
    hE[0] = hand.elbow.x
    hE[1] = hand.elbow.y
    hE[2] = hand.elbow.z
    hD[0] = hand.X.x
    hD[1] = hand.X.y
    hD[2] = hand.X.z
    aim.set(hE, hD)
    herd.update(cam, fillHand)
  }
  const pinch = new THREE.Vector3(0, 9, 0)
  const REST = new THREE.Vector3(0.12, 0.17, 0.34)
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3()
  const slotV = (i: number, out: THREE.Vector3) => out.set(sortX(1, LAST[i].c), TYPE_H * 0.85, sortZ(LAST[i].l))
  const stickV = (i: number, out: THREE.Vector3) => {
    const q = stickSlot(STICK.n + i)
    return out.set(q[0], q[1] + TYPE_H * 0.85, q[2])
  }
  /** The pinch's path: to the stick, then stick to forme three times, then away. Returns which sort is in it (-1 none) and how far through its carry. */
  const handAt = (t: number, out: THREE.Vector3) => {
    const hop = (a: THREE.Vector3, b: THREE.Vector3, k: number, lift: number) => out.lerpVectors(a, b, E.io2(k)).setY(mix(a.y, b.y, E.io2(k)) + lift * Math.sin(Math.PI * k))
    const lift0 = SET_T[0] - 0.42
    hand.on = t > lift0 - 0.75 && t < SET_T[2] + 0.85
    let held = -1, kk = 0
    if (t < lift0) {
      hop(REST, stickV(0, vA), clamp((t - (lift0 - 0.75)) / 0.7), 0.02)
      hand.grip = smooth(lift0 - 0.25, lift0, t)
    } else if (t >= SET_T[2]) {
      hop(slotV(2, vA), REST, clamp((t - SET_T[2] - 0.08) / 0.75), 0.03)
      hand.grip = 1 - smooth(SET_T[2], SET_T[2] + 0.2, t)
    } else
      for (let i = 0; i < 3; i++) {
        const a = SET_T[i] - 0.42
        if (t >= a && t < SET_T[i]) {
          kk = (t - a) / 0.42
          hop(stickV(i, vA), slotV(i, vB), kk, 0.028)
          held = i
          hand.grip = 1
        } else if (i < 2 && t >= SET_T[i] && t < SET_T[i + 1] - 0.42) {
          const k = (t - SET_T[i]) / (SET_T[i + 1] - 0.42 - SET_T[i])
          hop(slotV(i, vA), stickV(i + 1, vB), k, 0.02)
          hand.grip = 1 - 0.6 * Math.sin(Math.PI * k)
        }
      }
    return held + kk * 0.999
  }
  const HEAD_A = new THREE.Vector3(-0.55, 0, -0.83).normalize(), HEAD_B = new THREE.Vector3(-0.92, -0.1, -0.38).normalize()
  const DOWN = new THREE.Vector3()

  // ---------------------------------------------------------------- the rule of ages: a bar of type metal, its cuts full of ink, the age in printer's red

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "blackened", debug: ctx.debugLabels, fonts: { name: ctx.fonts.fell, mono: ctx.fonts.mono }, accent: "#e0452c" }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const brush = vnoise(vec2(st.x.mul(70), st.y.mul(260))).mul(0.6).add(vnoise(vec2(st.x.mul(300), st.y.mul(900))).mul(0.4)).toVar()
    // dressed lead: pale, with the planer's lines; ink wiped across it has stayed in the low places and along the bevel
    const metal = vec3(0.6, 0.61, 0.64).mul(brush.mul(0.25).add(0.86))
    const wipe = sstep(0.5, 0.85, fbm(st.mul(vec2(34, 3)).add(2.2)).add(st.y.oneMinus().mul(0.22))).mul(0.4)
    // the face has been inked like a forme: black and wet, the lead grinning through where the ball missed and along the bevel
    const bare = sstep(0.62, 0.9, fbm(st.mul(vec2(34, 3)).add(2.2)).add(attribute("face", "float").oneMinus().mul(0.5))).mul(0.5).add(wipe.mul(0))
    const base = mixN(vec3(0.012, 0.012, 0.014), metal.mul(0.6), bare).toVar()
    const col = mixN(base, cut.rgb, on).toVar()
    const N = normalize(normalWorld)
    const lit = col.mul(KEYC.mul(max(dot(N, KEYN), 0).mul(0.3).add(0.16)).add(SKYC.mul(1.4))).add(KEYC.mul(pow(brush, 2)).mul(0.035).mul(on.oneMinus()).mul(sstep(0.3, 0.9, st.y)))
    return vec4(ctx.debugLabels ? mixN(lit, cut.rgb, step(0.02, on)) : lit, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 10
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- targets, focus

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(1), asp: uniform(16 / 9), dust: uniform(0), shade: uniform(0) }
  // depth of field: view depth rides in the stage's alpha (negative: the rule, never blurred); a tap may not smear what is sharper than itself
  const dof = ctx.pass(({ uv, time }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.001)).mul(step(0, d)) as F)
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0006), () => {
      Loop(22, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(22))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.4).add(step(c0.a, t.a)) as F).mul(step(0, t.a))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    const col = acc.rgb.div(acc.a).toVar()
    // dust in the window's light, shaken out by the platen
    const q = uv.mul(vec2(D.asp, 1))
    const mote = (sc: number, sp: number): F => {
      const g = q.mul(sc).add(vec2(time.mul(sp), time.mul(-sp * 0.6)))
      const cell = floor(g)
      const h = hash21(cell)
      const d = length(fract(g).sub(0.5).sub(vec2(h, fract(h.mul(7.1))).sub(0.5).mul(0.6)))
      return sstep(0.09, 0.0, d).mul(step(0.72, h)) as F
    }
    const beam = sstep(0.1, 0.8, uv.x.oneMinus().add(uv.y).mul(0.5))
    col.addAssign(vec3(1.0, 0.95, 0.85).mul(mote(14, 0.05).add(mote(31, 0.08).mul(0.6))).mul(beam).mul(D.dust).mul(0.5))
    // a soft shade behind the headline, so it reads over pale paper and bright lead
    col.mulAssign(float(1).sub(D.shade.mul(sstep(0.62, 0.0, length(uv.sub(vec2(0.2, 0.8)).mul(vec2(1.0, 1.9)))).mul(0.5))))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- the story clock

  const TANH = Math.tan((FOV * Math.PI) / 360)
  const born = (t: number) => clamp((2 ** ((DOUBLINGS * (t - T_STORM)) / SPAN) - 1) / (2 ** DOUBLINGS - 1)) * NP
  const cp = new THREE.Vector3(), ct = new THREE.Vector3()
  const to = (k: number, px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
    cp.lerp(vA.set(px, py, pz), k)
    ct.lerp(vB.set(tx, ty, tz), k)
  }
  /** The rubricator's blank, on the sheet as it lies on the bank. */
  const flap = new THREE.Vector3(GAP_BED[0], Y_SHEET, GAP_BED[1]).applyMatrix4(BANK_M)
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mL2 = new THREE.Matrix4(), vM2 = new THREE.Vector3()
  const PARK = [new THREE.Vector3(0.52, 0.24, 0.2), new THREE.Vector3(0.62, 0.26, 0.32)]
  const MEET = [new THREE.Vector3(0.05, 0.16, 0.06), new THREE.Vector3(-0.045, 0.16, 0.06)]
  const ballK: { t: number; p: THREE.Vector3; dab: boolean }[][] = [0, 1].map((b) => [
    { t: T_INK - 0.35, p: PARK[b], dab: false },
    { t: T_INK + 0.12, p: MEET[b], dab: false },
    { t: T_INK + 0.3, p: MEET[b], dab: false },
    ...DABS.filter((_, i) => i % 2 === b).map((d) => ({ t: d.t, p: new THREE.Vector3(d.x, TYPE_H + 0.0005, d.z), dab: true })),
    { t: DABS[7].t + 0.75, p: PARK[b], dab: false },
  ])
  const st = { knock: 0, wide: 0, far: 0, dist: 1, count: 0 }
  const POST: PostOpts = { tone: "agx", exposure: 1, bloom: 0.5, bloomThresh: 1.1, bloomRadius: 0.8, vignette: 0.3, grain: 0.028, contrast: 1.08, sat: 1.02, lift: [0.004, 0.004, 0.008], gain: [1.02, 1, 0.97], halation: 0.25, ca: 0.0006 }
  const TITLES: TitleOpts = { color: "#fbf3e2", shadow: "rgba(8,5,3,0.75)", subs: [undefined, ctx.def.beats[1].sub?.replace(", then", ",\nthen")], delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.35] }
  const HUD = { color: "#f1e7d2", shadow: "rgba(0,0,0,0.6)" }
  const qH = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0)

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    U.t0.value = t0
    U.t1.value = t1
    U.time.value = s.time

    // ---- the ink balls: rocked together, then beating the type, turn and turn about
    for (let b = 0; b < 2; b++) {
      const K = ballK[b]
      let i = 0
      while (i < K.length - 2 && t0 > K[i + 1].t) i++
      const A = K[i], B = K[i + 1]
      const k = E.io2(clamp((t0 - A.t) / (B.t - A.t)))
      const g = balls[b]
      g.position.lerpVectors(A.p, B.p, k)
      const hopH = A.dab || B.dab ? 0.05 : 0.02
      g.position.y += hopH * Math.sin(Math.PI * k) * (A.dab && B.dab ? 1 : 0.5)
      // the pad gives as it lands
      let sq = 0
      for (const q of K) if (q.dab) sq = Math.max(sq, Math.exp(-(((t0 - q.t) / 0.05) ** 2)))
      g.scale.set(1 + 0.08 * sq, 1 - 0.22 * sq, 1 + 0.08 * sq)
      const meet = smooth(T_INK - 0.1, T_INK + 0.12, t0) * (1 - smooth(T_INK + 0.3, T_INK + 0.45, t0))
      g.rotation.set(0.12 * Math.sin(Math.PI * k), 0, (b ? -1 : 1) * (1.25 * meet + 0.2 * Math.sin(Math.PI * k) * (1 - meet)) + 0.3 * meet * Math.sin(t0 * 26))
      g.visible = t0 > T_INK - 0.35 && t0 < DABS[7].t + 0.75
      ;U.blobs[b].value.set(g.position.x, g.visible ? g.position.y + 0.02 : 9, g.position.z, 0.062)
    }

    // ---- the sheet: the tympan comes down with it, goes up again after the pull; the frisket lifts; the sheet is taken off by its corner
    const lay = clamp((t0 - T_LAY) / 1.0)
    const open = clamp((t0 - T_OPEN) / 0.55)
    U.alpha.value = t0 < T_OPEN ? AL_UP * (1 - (lay < 1 ? E.outBounce(lay * lay * (3 - 2 * lay)) : 1)) : AL_OPEN * (1 - (1 - open) ** 3) + 0.05 * Math.sin(open * Math.PI * 3) * (1 - open)
    tympan.rotation.x = -U.alpha.value
    // the frisket: open while the sheet is laid on, folded down onto it before the tympan comes down; lifted off it after the pull
    frisket.rotation.x = 2.6 * (1 - smooth(T_LAY - 0.75, T_LAY - 0.25, t0) + smooth(T_FRISK, T_FRISK + 0.45, t0))
    const kL = clamp((t0 - T_LIFT) / LIFT_D)
    U.MA.value.copy(liftM(Math.min(1, kL * 1.2), mA))
    U.MB.value.copy(liftM(Math.max(0, kL * 1.2 - 0.2), mB))
    U.sag.value = 0.14 * Math.sin(Math.PI * kL)
    U.hang.value = smooth(T_HANG - 0.1, T_HANG + 1.0, t1)
    U.printed.value = t0 >= T_PULL ? 1 : 0
    U.dryInk.value = smooth(0.4, 3, t1)
    U.red.value = s.k(1, 0.08, 0.9, E.io2)

    // ---- the pull: the bar round, the platen down its screw, a bounce on the packing, and up
    const pu = t0 - T_PULL
    const down = E.in2(clamp((pu + 0.5) / 0.5))
    const contact = Y_SHEET + 0.0008
    const ph = pu < 0 ? mix(0.5, contact, down) : contact + 0.004 * Math.exp(-pu * 26) * Math.abs(Math.sin(pu * 60)) + (0.5 - contact) * smooth(0.14, 0.72, pu)
    platen.position.y = ph
    U.platen.value = ph
    spindle.rotation.y = pu < 0 ? -1.0 + 1.6 * down : 0.6 - 1.6 * (1 - Math.exp(-pu * 7) * Math.cos(pu * 30)) * smooth(0, 0.1, pu)
    const knock = (t0 >= 0 ? Math.exp(-t0 * 6) * 0.6 : 0) + (pu >= 0 ? Math.exp(-pu * 6) : 0)
    st.knock = knock

    // ---- the camera
    // beat 0: along the type; up to the forme for the inking; low for the pull; in on the print
    cp.set(0.075, 0.05, 0.205)
    ct.set(0.0, 0.0225, 0.143)
    to(s.k(0, -0.4, 1.4, E.io2), 0.01, 0.062, 0.25, -0.088, 0.034, 0.165)
    // back from the type so the compositor's hand is a third of the frame, low, against the window's light
    to(s.k(0, 0.9, 2.0, E.io2), -0.25, 0.16, 0.39, -0.075, 0.035, 0.125)
    to(s.k(0, 3.3, 4.4, E.io3), 0.27, 0.36, 0.5, 0.0, 0.03, 0.01)
    to(s.k(0, 5.5, 6.7, E.io3), 0.52, 0.19, 0.6, 0.02, 0.1, 0.0)
    // the tympan opens: back and up to see the press, the frisket and the bank; then down onto the print
    const kW = s.k(0, 7.65, 8.45, E.io3)
    to(kW, 0.24, 0.7, 1.22, -0.2, 0.27, -0.12)
    // then with the corner as it is carried to the bank: close enough that the pressman's arm comes in from the edge
    const kT = s.k(0, 8.45, 9.0, E.io2)
    liftM(Math.min(1, clamp((t0 - T_LIFT) / LIFT_D) * 1.2), mL2)
    vM2.copy(C0).applyMatrix4(mL2)
    to(kT, vM2.x * 0.6 - 0.3, vM2.y * 0.5 + 0.46, vM2.z * 0.6 + 0.85, vM2.x * 0.75 - 0.3, vM2.y * 0.55 + 0.02, vM2.z * 0.6 + 0.05)
    const kD = s.k(0, 9.55, 10.9, E.io3)
    const push = s.k(0, 10.5, 14, E.out2)
    to(kD, flap.x + 0.012, flap.y + 0.105 - 0.035 * push, flap.z + 0.09 - 0.03 * push, flap.x, flap.y, flap.z - 0.006 * push)
    // beat 1: up with the sheet to the line; then the crane, which backs away as fast as the shelves fill
    const landed = born(t1 - 1.25)
    const hWall = (WALL.ph * landed) / WALL.cols
    const ty = 1.8 + (Math.min(hWall, 26) * 0.62 + 0.4 - 1.8) * smooth(1.5, 7, hWall)
    const need = (Math.min(hWall, 26) * 0.42 + 5) / (2 * TANH) + WALL.z
    const zc = 2.7 + Math.log(1 + Math.exp((need - 2.7) * 0.5)) / 0.5
    const kF = s.k(1, 0.7, 2.7, E.io3)
    to(kF, -0.6 + 0.3 * s.k(1, 2.2, 5, E.lin), 2.15, 1.45, 0.2, 1.9, -3.2)
    const kG = s.k(1, 3.3, 6.2, E.io3)
    // ending a little oblique, so the shelves read as shelves with depth, the lamps in rows going away
    const obl = smooth(4, 8.5, t1)
    const run = zc - WALL.z
    const drift = 0.012 * Math.max(0, t1 - 7)
    to(kG, 1.7 * (1 - obl) + (0.4 + drift) * obl * run, ty + 0.45, zc + 0.6 - 0.18 * obl * run, (0.06 + drift) * obl * run, ty, WALL.z)
    const dist = cp.distanceTo(ct)
    const sh = shake(s.time, 1, 0.14)
    const amp = dist * (0.004 + 0.02 * knock)
    cam.aspect = s.w / s.h
    cam.near = clamp(dist * 0.06, 0.004, 0.6)
    cam.far = 500
    cam.position.set(cp.x + sh[0] * amp + s.mouse.x * dist * 0.012, cp.y + sh[1] * amp + knock * dist * 0.02 * Math.cos((pu >= 0 ? pu : t0) * 38), cp.z + sh[2] * amp)
    cam.up.set(0.02 * Math.sin(s.time * 0.21) + 0.03 * knock * Math.sin(pu * 31), 1, 0)
    cam.lookAt(ct.x, ct.y - s.mouse.y * dist * 0.008, ct.z)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    U.camP.value.copy(cam.position)
    cam.getWorldDirection(U.camF.value)
    st.dist = dist
    st.far = kF
    st.count = landed

    // ---- the hands: the compositor setting the last sorts; then the pressman taking the sheet off by its corner
    const hvs = handAt(t0, pinch)
    const lift0 = T_LIFT - 0.5, lift1 = T_LIFT + LIFT_D
    const onB = t0 > lift0 && t0 < lift1 + 0.5
    if (onB) {
      // to the corner, with it on its arc, away
      hand.on = true
      vA.copy(C0).applyMatrix4(mA)
      if (t0 < T_LIFT) pinch.lerpVectors(vB.copy(C0).add(vC.set(0.3, 0.04, 0.12)), C0, E.out2(clamp((t0 - lift0) / 0.45)))
      else if (t0 < lift1) pinch.copy(vA)
      else pinch.lerpVectors(C1, vB.copy(C1).add(vC.set(0.34, 0.12, 0.1)), E.in2(clamp((t0 - lift1 - 0.05) / 0.45)))
      hand.grip = smooth(T_LIFT - 0.2, T_LIFT, t0) * (1 - smooth(lift1 - 0.05, lift1 + 0.1, t0))
      DOWN.set(0, -1, 0.35).normalize()
      placeHand(pinch, DOWN, HEAD_B)
    } else {
      const held = Math.floor(hvs), kk = hvs - held
      // the sort tips a little as it is carried, its foot trailing
      DOWN.set(0, -1, 0).addScaledVector(HEAD_A, held >= 0 ? -0.25 * Math.sin(Math.PI * kk) : 0).normalize()
      placeHand(pinch, DOWN, HEAD_A)
    }
    herd.group.visible = hand.on
    if (hand.on) poseHand()
    U.blobs[2].value.set(pinch.x + 0.02, hand.on ? pinch.y + 0.03 : 9, pinch.z + 0.03, 0.035)
    const held = onB ? -1 : Math.floor(hvs)
    if (held >= 0) {
      // the sort hangs in the pinch along its axis, the pads near its shoulder
      vD.copy(pinch).addScaledVector(DOWN, TYPE_H * 0.85)
      qH.setFromUnitVectors(UPV, vC.copy(DOWN).negate())
      heldB.aP.setXYZW(0, vD.x, vD.y, vD.z, 1)
      heldB.aQ.setXYZW(0, qH.x, qH.y, qH.z, qH.w)
      heldB.aX.setXYZW(0, 40 + LAST[held].c, LAST[held].l, -99, 0.5)
    } else heldB.aP.setXYZW(0, 0, -9, 0, 0)
    heldB.aP.needsUpdate = heldB.aQ.needsUpdate = heldB.aX.needsUpdate = true

    // ---- light, focus, the rule
    U.wallLit.value = 0.55 * smooth(4, 8.8, t1)
    D.asp.value = cam.aspect
    D.focus.value = dist
    D.blur.value = mix(mix(mix(0.03, 0.014, s.k(0, 0.9, 2.0, E.io2)), 0.012, s.k(0, 3.3, 4.4, E.io3)) * (1 - 0.6 * kW * (1 - kD)) + 0.004 * kD, 0.0015, kF)
    D.dust.value = ctx.debugLabels ? 0 : clamp(0.25 + knock) * (1 - kF)
    D.shade.value = ctx.debugLabels ? 0 : 1 - 0.6 * kF
    placeRule(rule, cam, { dist: cam.near * 5 })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    sheet.visible = t1 < 40
    if (s.live) {
      const roar = smooth(2.5, 8.6, t1) * (t1 < T_STOP ? 1 : 0)
      ctx.synth.bed("air", 0.1 + 0.75 * roar)
      ctx.synth.bed("wind", 0.5 * roar * roar)
      ctx.synth.bed("hum", t0 < 40 && s.beat === 0 ? 0.08 * (t0 < 0 ? s.enter : 1) : 0)
    }
  }
  // (the herd must be posed once so its palette exists before the first warm-up draw)
  herd.update(cam, (_i, d) => {
    d.dist = 0
  })

  // ---------------------------------------------------------------- sound

  const lp: [number, number, number] = [0, 0, 0]
  const atPinch = () => listenerPos(pinch, cam, st.dist, lp)
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    // sorts dropped into the line: lead on lead, each a harmonic up
    ...SET_T.map((t, i): Cue => ({ b: 0, at: t, s: "tick", o: { f: H(44 + i * 4), g: 0.7 }, pos: atPinch })),
    ...SET_T.map((t, i): Cue => ({ b: 0, at: t - 0.42, s: "tick", o: { f: H(60 + i * 2), g: 0.3 }, pos: atPinch })),
    // the ink balls: worked together, then eight dabs
    { b: 0, at: T_INK + 0.12, s: "squelch", o: { f: H(5), g: 0.5, dur: 0.3 }, pos: [0.1, 0.2, 0] },
    ...DABS.map((d, i): Cue => ({ b: 0, at: d.t, s: "squelch", o: { f: H(3 + (i % 2)), g: 0.55, dur: 0.12 }, pos: [d.x * 9, -0.1 - d.z * 3, 0.1] })),
    ...DABS.map((d): Cue => ({ b: 0, at: d.t + 0.01, s: "thud", o: { f: H(4), g: 0.22 }, pos: [d.x * 9, -0.2, 0.1] })),
    { b: 0, at: T_LAY + 0.05, s: "page", o: { g: 0.6 }, pos: [0, 0.4, 0.2] },
    { b: 0, at: T_LAY + 0.85, s: "flap", o: { g: 0.35, f: 170 }, pos: [0, -0.2, 0] },
    // the pull
    { b: 0, at: T_PULL - 0.5, s: "gear", o: { f: H(5), g: 0.5, dur: 0.45 }, pos: [0.4, 0.5, 0.1] },
    { b: 0, at: T_PULL, s: "thump", o: { g: 1 }, pos: [0, 0, 0] },
    { b: 0, at: T_PULL, s: "sub", o: { g: 0.7 } },
    { b: 0, at: T_PULL + 0.12, s: "gear", o: { f: H(7), g: 0.3, dur: 0.5 }, pos: [0.4, 0.5, 0.1] },
    // the peel: the ink lets go of the paper
    // the tympan up on its hinge, the frisket off, the sheet taken off and laid on the bank
    { b: 0, at: T_OPEN, s: "gear", o: { f: H(9), g: 0.22, dur: 0.35 }, pos: [0, 0.3, -0.2] },
    { b: 0, at: T_OPEN + 0.5, s: "thud", o: { f: H(6), g: 0.25 }, pos: [0, 0.4, -0.3] },
    { b: 0, at: T_FRISK + 0.3, s: "tick", o: { f: H(30), g: 0.3 }, pos: [0, 0.5, 0] },
    { b: 0, at: T_LIFT, s: "scratch", o: { f: 300, g: 0.22, dur: 0.35 }, pos: [-0.1, 0.4, 0] },
    { b: 0, at: T_LIFT + 0.2, s: "page", o: { g: 0.55 }, pos: [-0.3, 0.3, 0.1] },
    { b: 0, at: T_LIFT + LIFT_D - 0.05, s: "flap", o: { g: 0.35, f: 160 }, pos: [-0.6, -0.2, 0.1] },
    { b: 0, at: T_LIFT + LIFT_D + 0.6, s: "pad", o: { f: H(6), dur: 3.5, g: 0.22 } },
    { b: 0, at: T_LAY - 0.3, s: "tick", o: { f: H(26), g: 0.25 }, pos: [0, 0.3, -0.3] },
    // beat 1: the brush, the sheet up on the line
    { b: 1, at: 0.1, s: "scratch", o: { f: 700, g: 0.16, dur: 0.75 }, pos: [0.1, 0, 0] },
    { b: 1, at: T_HANG, s: "page", o: { g: 0.7 }, pos: [0, 0.2, 0] },
    { b: 1, at: 5.6, s: "bell", o: { f: H(12), g: 0.4 }, pos: [0.6, 0, 0] },
    { b: 1, at: 5.6, s: "thud", o: { f: H(3), g: 0.5 }, pos: [0.6, 0, 0] },
    // the hard stop
    { b: 1, at: T_STOP, s: "thump", o: { g: 1 }, pos: [0, 0, 0.4] },
    { b: 1, at: T_STOP, s: "boom", o: { g: 0.8 } },
    { b: 1, at: T_STOP, s: "sub", o: { g: 0.9 } },
    { b: 1, at: T_STOP + 0.02, s: "bell", o: { f: H(8), g: 0.45 }, pos: [0.6, 0, 0] },
  ]
  {
    // a leaf for every page while they can be told apart: the gap halves with every doubling, down to a rattle
    const R = rng(79)
    let gap = 0.5
    for (let t = T_HANG + 0.3; t < T_STOP - 0.04; t += Math.max(0.055, gap)) {
      gap = 0.5 * 2 ** (-(t - T_HANG - 0.3) / 0.85)
      const g = smooth(T_HANG, T_STOP, t)
      cues.push({ b: 1, at: t, s: gap > 0.08 || R() < 0.5 ? "page" : "flap", o: { g: 0.3 + 0.5 * g, vary: 1, f: 200 + R() * 400 }, pos: [(R() * 2 - 1) * (0.3 + g), R() * 1.2 * g - 0.1, R() * g] })
    }
  }

  // ---------------------------------------------------------------- the counter (a drawing between the script's two figures)

  const T_A = 5.6, T_B = 6.5
  const FIG = ["12.6 million", "79 million"]
  const fmt = (n: number) => (n < 1e6 ? Math.floor(n).toLocaleString("en-US") : (n / 1e6).toFixed(1) + " million")
  const counter = (t: number): [string, number] => {
    if (t >= T_STOP) return [FIG[1], clamp((t - T_STOP) / 0.45)]
    if (t >= T_B) {
      const n = 12.6e6 * (79 / 12.6) ** (((t - T_B) / (T_STOP - T_B)) ** 1.6)
      return [n >= 78.95e6 ? FIG[1] : n < 12.65e6 ? FIG[0] : fmt(n), 1]
    }
    if (t >= T_A) return [FIG[0], clamp((t - T_A) / 0.45)]
    const n = Math.exp(Math.log(12.6e6) * clamp((t - T_HANG) / (T_A - T_HANG)) ** 1.15)
    return [n >= 12.55e6 ? FIG[0] : fmt(n), 1]
  }

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x050403, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      POST.exposure = 1 + 0.12 * st.knock + 0.1 * st.far
      if (ctx.debugLabels) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
      POST.vignette = ctx.debugLabels ? 0 : 0.32 - 0.1 * st.far
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(8,5,3,0.7)", color: "#fbf3e2" })
      titles(g, s, ctx.def, TITLES)
      const t = s.at(1)
      if (s.beat === 1 && t > T_HANG) {
        const [str, p] = counter(t)
        const a = clamp((t - T_HANG) / 0.4) * (1 - s.exit * 1.5 < 0 ? 0 : 1 - s.exit * 1.5)
        const slam = t >= T_STOP || (t >= T_A && t < T_B)
        g.text(str, 1800, 700, { size: 168, font: "tall", align: "right", color: "#fbf3e2", alpha: a, style: slam ? "slam" : "none", by: "line", p, track: 0.005, shadow: { color: "rgba(5,3,2,0.8)", blur: 30 } })
        const second = t >= T_B
        const cap = second ? "in the next half century" : "printed books, Europe: the half century to 1500"
        g.text(cap, 1796, 752, { size: 26, font: "mono", align: "right", color: "#fbf3e2", alpha: a * 0.82, style: "blur", by: "line", p: clamp((t - (second ? T_B : T_HANG)) / 0.5), shadow: { color: "rgba(5,3,2,0.8)", blur: 16 } })
      }
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      fount.dispose()
      initial.dispose()
      herd.dispose()
      sortGeo.dispose()
      disposeTree(scene)
    },
  }
}
