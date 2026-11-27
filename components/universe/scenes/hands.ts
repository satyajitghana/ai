// Scene 13, "A hand on a wall." The second Stone Age scene: "I was here", said by a hand.
//
// A pale limestone wall in the light of one carried brand. A left hand is pressed to the rock and
// red ochre is blown round it through a tube (the sourced method); the hand peels off and the
// negative is left, wet, then drying matt. The torch is walked along the wall: more hands, one
// with a finger retouched to a claw (Sulawesi), the oldest as a faint patch under cave popcorn,
// then the story panel as the script's own source describes it (a red pig in outline with painted
// infill and three human-like figures), then a panel where half the hands lack finger segments,
// seen in a pull back, with charcoal torch smears above. Beat sheet: R/beats/hands.md.
//
// One world rule: `torchAt`. Every surface is lit by the one flame (inverse square, flicker, a
// blue-grey fill that never reaches black) and tests its ray to it against two occluders: the
// wall's own baked height field (a short march) and the hand's capsules.
//
// The wall is a baked height field (a GPU pass, once): the mesh is displaced by it, so ledges and
// scallops parallax, and the fragment stage marches it toward the flame for relief shadows. The
// paint is two canvases (a 4096 atlas of every stencil, and the hero's own negative at 1.7 px/mm),
// drawn from the same finger table that builds the 3D hand, its shadow and the spray's mask.

import * as THREE from "three/webgpu"
import {
  abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, If, int, length, Loop, max, min, mix as mixN, normalize, normalWorld,
  positionGeometry, positionWorld, pow, select, sign, sin, smoothstep, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4,
} from "three/tsl"

import { placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, steelRuleMaterial } from "../engine/ages"
import { makeAim, makeDrive, makeHerd, makePress, skinMaterial, type Drive, type Lights, type SkinNodes } from "../engine/creature"
import * as HM from "../engine/creature/hand"
import { SPARK_PEOPLE } from "../engine/people"
import { clamp, E, mix, rng } from "../engine/ease"
import { disposeTree, shake, stageTarget, typeCues } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles } from "../engine/titles"
import { fbm, hash21, L0, rtUV, sampleRT, sat, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { comment, SELECT } from "../engine/ui"
import { makeBrand, TORCH_DUR, TORCH_LAND } from "../transitions/torch"

// ---------------------------------------------------------------- the wall's extent, and what is where on it (metres)

const WX0 = -2.6
const WW = 14.4
const WY0 = -1.5
const WH = 3.6
const FLOOR_Y = -1.28
const ATLAS_W = 4096
const ATLAS_H = 1024
const KA = ATLAS_W / WW // atlas pixels per metre

/** The hero hand: wrist on the rock, tilt of the fingers from vertical (radians, toward -x). */
const HAND_W: [number, number] = [0.1, -0.085]
const TILT = 0.14
const HERO_SIZE = 0.6
/** The pressed hand: its axis this far off the rock at the wrist (the heel and pads sink a little and are flattened by the press), fingers leaning this much into it. */
const PALM_OFF = 0.0195
const PITCH = 0.05
/** How far the wrist is bent back while the hand is on the rock (radians). */
const BEND = 0.92
/** Wrist deviation of the pressed hand (the `wristDev` channel). */
const DEV: number = 0.6
/** The rock's face at the hero (the bake is smoothed to within a couple of millimetres of 0 there). */
const WALL_Z = 0
const CT = Math.cos(TILT)
const ST = Math.sin(TILT)
/** Hand-local (lateral, along) to world on the wall. */
const handToWall = (lx: number, ly: number): [number, number] => [HAND_W[0] + lx * CT - ly * ST, HAND_W[1] + lx * ST + ly * CT]
const HERO_C = handToWall(0, 0.095)
const HERO_X0 = HERO_C[0] - HERO_SIZE / 2
const HERO_Y0 = HERO_C[1] - HERO_SIZE / 2
const COR: [number, number] = [3.3, 0.16] // the coralloid cluster over the oldest hands
const STORY: [number, number] = [4.95, 0.1] // centre of the pig
const PANEL: [number, number] = [8.1, 0.22] // centre of the last panel
/** The hand the selection box lands on. */
const SEL = { x: 8.62, y: -0.06, s: 1.04, rot: 0.1 }

// ---------------------------------------------------------------- one hand, as numbers (a left hand from the back: thumb toward +lateral)

type Finger = { name: string; at: [number, number]; len: [number, number, number]; r: number; splay: number }
/** `at` is (lateral, along) of the knuckle from the wrist, `splay` radians from "along" toward +lateral. */
const FINGERS: Finger[] = [
  { name: "thumb", at: [0.03, 0.02], len: [0.046, 0.033, 0.027], r: 0.0112, splay: 0.8 },
  { name: "index", at: [0.028, 0.096], len: [0.043, 0.025, 0.02], r: 0.0094, splay: 0.17 },
  { name: "middle", at: [0.006, 0.102], len: [0.047, 0.029, 0.02], r: 0.0097, splay: 0.0 },
  { name: "ring", at: [-0.015, 0.097], len: [0.043, 0.027, 0.02], r: 0.009, splay: -0.15 },
  { name: "little", at: [-0.034, 0.085], len: [0.033, 0.02, 0.017], r: 0.008, splay: -0.36 },
]
/** Joints of a finger in hand-local 2D: knuckle, two joints, tip. */
const fingerPts = (f: Finger, short = 3): [number, number][] => {
  const out: [number, number][] = [[f.at[0], f.at[1]]]
  let d = 0
  for (let k = 0; k < short; k++) {
    d += f.len[k]
    out.push([f.at[0] + Math.sin(f.splay) * d, f.at[1] + Math.cos(f.splay) * d])
  }
  return out
}
/** The palm and forearm as capsules (ax, ay, bx, by, r), hand-local 2D. */
const PALM: [number, number, number, number, number][] = [
  [-0.012, 0.022, -0.013, 0.078, 0.03],
  [0.012, 0.024, 0.01, 0.082, 0.031],
  [0.016, 0.012, 0.028, 0.036, 0.022],
  [0, 0.0, -0.004, -0.2, 0.031],
]

type Stencil = { x: number; y: number; s: number; rot: number; mirror: boolean; short: number[]; claw: number; ch: 0 | 1; dens: number; patch?: boolean; seed: number }

/** Local (lateral, along) to canvas pixels, for a stencil at world (cx, cy). */
function setLocal(c: CanvasRenderingContext2D, k: number, x0: number, yTop: number, cx: number, cy: number, rot: number, sx: number, sy: number) {
  const cs = Math.cos(rot), sn = Math.sin(rot)
  c.setTransform(k * sx * cs, -k * sx * sn, -k * sy * sn, -k * sy * cs, k * (cx - x0), k * (yTop - cy))
}

/** The hand's silhouette: what the rock under it was hidden by. `grow` widens it (the soft under-spray margin). */
function drawHand(c: CanvasRenderingContext2D, short: number[], claw: number, grow: number) {
  c.lineCap = "round"
  c.lineJoin = "round"
  for (const p of PALM) {
    c.lineWidth = (p[4] + grow) * 2
    c.beginPath()
    c.moveTo(p[0], p[1])
    c.lineTo(p[2], p[3])
    c.stroke()
  }
  FINGERS.forEach((f, i) => {
    const pts = fingerPts(f, short[i] ?? 3)
    for (let k = 0; k + 1 < pts.length; k++) {
      const w = f.r * (1.06 - 0.1 * k) + grow
      if (i === claw && k >= 1) {
        // retouched to a claw: the finger narrows to a point from its first joint
        const a = pts[1], b = pts[pts.length - 1]
        const nx = -(b[1] - a[1]), ny = b[0] - a[0]
        const l = Math.hypot(nx, ny) || 1
        c.beginPath()
        c.moveTo(a[0] + (nx / l) * w, a[1] + (ny / l) * w)
        c.lineTo(b[0] + (b[0] - a[0]) * 0.12, b[1] + (b[1] - a[1]) * 0.12)
        c.lineTo(a[0] - (nx / l) * w, a[1] - (ny / l) * w)
        c.closePath()
        c.fill()
        break
      }
      c.lineWidth = w * 2
      c.beginPath()
      c.moveTo(pts[k][0], pts[k][1])
      c.lineTo(pts[k + 1][0], pts[k + 1][1])
      c.stroke()
    }
  })
}

/** One sprayed stencil into a scratch canvas (alpha only), then added to one channel of the atlas. */
function sprayStencil(atlas: CanvasRenderingContext2D, scratch: HTMLCanvasElement, st: Stencil) {
  const R = rng(st.seed)
  const N = scratch.width
  const c = scratch.getContext("2d")!
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalCompositeOperation = "source-over"
  c.clearRect(0, 0, N, N)
  const half = N / 2 / KA
  const col = st.ch === 0 ? "255,0,0" : "0,255,0"
  setLocal(c, KA, -half, half, 0, 0, st.rot, st.mirror ? -st.s : st.s, st.s)
  const blob = (x: number, y: number, r: number, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${col},${a})`)
    g.addColorStop(0.55, `rgba(${col},${a * 0.55})`)
    g.addColorStop(1, `rgba(${col},0)`)
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r, 0, 6.2832)
    c.fill()
  }
  const d = st.dens
  blob(0, 0.085, 0.21, 0.6 * d)
  FINGERS.forEach((f, i) => {
    const pts = fingerPts(f, st.short[i] ?? 3)
    const t = pts[pts.length - 1]
    blob(t[0] + (R() - 0.5) * 0.01, t[1] + 0.008, 0.06 + R() * 0.02, 0.7 * d)
  })
  for (let i = 0; i < 9; i++) blob((R() - 0.5) * 0.22, 0.0 + R() * 0.19, 0.06 + R() * 0.05, 0.4 * d)
  // spatter: coarse drops, more of them toward the edge of the cloud
  c.fillStyle = `rgba(${col},${0.75 * d})`
  for (let i = 0; i < 260; i++) {
    const a = R() * 6.2832, rr = 0.05 + Math.pow(R(), 0.6) * 0.2
    c.beginPath()
    c.arc(Math.cos(a) * rr * 0.85, 0.085 + Math.sin(a) * rr, 0.0014 + R() * R() * 0.0034, 0, 6.2832)
    c.fill()
  }
  c.globalCompositeOperation = "destination-out"
  c.strokeStyle = c.fillStyle = "rgba(0,0,0,0.5)"
  drawHand(c, st.short, st.claw, 0.0035)
  c.strokeStyle = c.fillStyle = "rgba(0,0,0,1)"
  drawHand(c, st.short, st.claw, 0)
  if (st.patch) {
    // the oldest: all that is left is a patch of pigment with part of the fingers and the palm beside them
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalCompositeOperation = "destination-in"
    const g = c.createRadialGradient(N / 2 - 0.01 * KA, N / 2 - 0.1 * KA, 0, N / 2 - 0.01 * KA, N / 2 - 0.1 * KA, 0.085 * KA)
    g.addColorStop(0, "rgba(0,0,0,1)")
    g.addColorStop(0.7, "rgba(0,0,0,0.9)")
    g.addColorStop(1, "rgba(0,0,0,0)")
    c.fillStyle = g
    c.fillRect(0, 0, N, N)
  }
  atlas.setTransform(1, 0, 0, 1, 0, 0)
  atlas.globalCompositeOperation = "lighter"
  atlas.drawImage(scratch, (st.x - WX0) * KA - N / 2, (WY0 + WH - st.y) * KA - N / 2)
}

/** Brushed red line: a polyline laid down in overlapping dabs, so it breaks as a dry brush does on rock. */
function brush(c: CanvasRenderingContext2D, R: () => number, raw: [number, number][], w: number, a: number) {
  // (a Catmull-Rom curve through the points, so a back is a curve and not a row of facets)
  const pts: [number, number][] = []
  for (let i = 0; i + 1 < raw.length; i++) {
    const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)]
    for (let j = 0; j < 5; j++) {
      const t = j / 5, t2 = t * t, t3 = t2 * t
      pts.push([0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)])
    }
  }
  pts.push(raw[raw.length - 1])
  c.lineCap = "round"
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (w * 0.9)))
    for (let j = 0; j < n; j++) {
      if (R() < 0.1) continue
      const u0 = j / n, u1 = (j + 0.9 + R() * 0.4) / n
      c.strokeStyle = `rgba(255,0,0,${a * (0.55 + R() * 0.45)})`
      c.lineWidth = w * (0.7 + R() * 0.5)
      c.beginPath()
      c.moveTo(ax + (bx - ax) * u0 + (R() - 0.5) * w * 0.3, ay + (by - ay) * u0 + (R() - 0.5) * w * 0.3)
      c.lineTo(ax + (bx - ax) * u1, ay + (by - ay) * u1)
      c.stroke()
    }
  }
}

/** Every stencil on the wall but the hero. Deterministic. */
function layout(): Stencil[] {
  const out: Stencil[] = []
  const full = [3, 3, 3, 3, 3]
  const S = (x: number, y: number, s: number, rot: number, mirror: boolean, o: Partial<Stencil> = {}) => out.push({ x, y, s, rot, mirror, short: full, claw: -1, ch: 0, dens: 1, seed: 100 + out.length * 17, ...o })
  // left of the hero, for the wide frame of the hand-off
  S(-0.72, 0.34, 0.96, 0.25, false, { dens: 0.7 })
  S(-1.3, -0.12, 0.9, -0.2, true, { dens: 0.6 })
  // along the track
  S(0.95, 0.27, 1.0, 0.1, false)
  S(1.36, -0.16, 0.64, -0.12, false, { dens: 0.9 }) // a child's
  S(1.78, 0.36, 1.04, -0.22, true)
  S(2.22, 0.04, 0.98, 0.06, false, { claw: 1 }) // the narrowed fingertip
  S(2.58, 0.44, 0.95, 0.3, false, { dens: 0.85 })
  S(2.7, 0.3, 1.0, -0.05, false, { dens: 0.8 })
  // the oldest, under the popcorn: faint, partial
  S(COR[0] - 0.12, COR[1] + 0.05, 1.0, 0.12, false, { ch: 1, patch: true, dens: 1 })
  S(COR[0] + 0.24, COR[1] - 0.1, 0.97, -0.25, false, { ch: 1, dens: 0.9 })
  S(3.98, 0.5, 0.92, 0.2, true, { dens: 0.8 })
  // the last panel: sizes, sides, overlaps, and folded fingers on about half
  const R = rng(771)
  const pts: [number, number, number][] = [[SEL.x, SEL.y, SEL.s]]
  out.push({ x: SEL.x, y: SEL.y, s: SEL.s, rot: SEL.rot, mirror: false, short: [3, 3, 3, 1, 1], claw: -1, ch: 0, dens: 1, seed: 9001 })
  let tries = 0
  while (pts.length < 46 && tries++ < 4000) {
    const child = R() < 0.16
    const x = PANEL[0] + (R() - 0.5) * 3.5
    const y = child ? -0.6 + R() * 0.45 : -0.48 + R() * 1.45 + 0.1 * Math.sin(x * 1.7)
    const s = child ? 0.6 + R() * 0.1 : 0.84 + R() * 0.24
    let ok = true
    for (const p of pts) {
      const min = p === pts[0] ? 0.29 : 0.14 + 0.09 * R()
      if (Math.hypot(p[0] - x, (p[1] - y) * 1.1) < min) ok = false
    }
    if (!ok) continue
    pts.push([x, y, s])
    const short = [3, 3, 3, 3, 3]
    if (R() < 0.5) {
      // one to four of the fingers end at a joint; the thumb is whole
      const n = 1 + Math.floor(R() * R() * 4)
      const from = 1 + Math.floor(R() * (5 - n))
      for (let k = 0; k < n; k++) short[from + k] = R() < 0.6 ? 1 : 2
    }
    out.push({ x, y, s, rot: (R() - 0.5) * 0.8, mirror: R() < 0.28, short, claw: -1, ch: 0, dens: 0.8 + R() * 0.4, seed: 5000 + pts.length * 31 })
  }
  return out
}

function paintAtlas(): THREE.CanvasTexture {
  const cv = document.createElement("canvas")
  cv.width = ATLAS_W
  cv.height = ATLAS_H
  const c = cv.getContext("2d")!
  c.fillStyle = "#000"
  c.fillRect(0, 0, ATLAS_W, ATLAS_H)
  const scratch = document.createElement("canvas")
  scratch.width = scratch.height = 192
  for (const st of layout()) sprayStencil(c, scratch, st)
  // ---- the story panel (Oktaviana et al. 2024): a red pig in profile, outline and painted infill, mouth partly open,
  //      and three human-like figures. Sizes are the paper's; where each stands is illustration.
  const R = rng(4242)
  c.globalCompositeOperation = "lighter"
  const at = (cx: number, cy: number) => setLocal(c, KA, WX0, WY0 + WH, cx, cy, 0, 1, 1)
  at(STORY[0], STORY[1])
  const pig: [number, number][] = [
    [-0.45, 0.04], [-0.43, 0.12], [-0.34, 0.17], [-0.2, 0.19], [-0.04, 0.185], [0.09, 0.175], [0.17, 0.19], [0.22, 0.17], [0.235, 0.215], [0.265, 0.165], [0.3, 0.13], [0.34, 0.085], [0.4, 0.05], [0.455, 0.04], [0.47, 0.015],
    [0.44, 0.0], [0.385, -0.002], [0.44, -0.02], [0.445, -0.04], [0.39, -0.05], [0.32, -0.06], [0.27, -0.09], [0.235, -0.12], [0.235, -0.19], [0.225, -0.225], [0.19, -0.225], [0.175, -0.15],
    [0.08, -0.16], [-0.06, -0.165], [-0.17, -0.15], [-0.215, -0.18], [-0.22, -0.225], [-0.255, -0.225], [-0.275, -0.16], [-0.34, -0.1], [-0.42, -0.05], [-0.45, 0.04],
  ]
  brush(c, R, pig, 0.022, 1)
  // the crest of bristles along the neck and back, and the far legs
  for (let i = 0; i < 16; i++) brush(c, R, [[0.24 - i * 0.03, 0.172 + 0.008 * Math.sin(i)], [0.225 - i * 0.03, 0.2 + 0.012 * R()]], 0.007, 0.8)
  brush(c, R, [[0.12, -0.155], [0.115, -0.215]], 0.018, 0.8)
  brush(c, R, [[-0.13, -0.155], [-0.145, -0.215]], 0.018, 0.8)
  brush(c, R, [[-0.44, 0.05], [-0.5, 0.0]], 0.009, 0.7)
  for (let i = 0; i < 46; i++) {
    // the infill: short strokes laid along the body
    const x = -0.36 + R() * 0.62, y = -0.09 + R() * 0.22
    if (Math.abs(y - 0.02) > 0.135 - 0.1 * Math.abs(x / 0.5)) continue
    const l = 0.03 + R() * 0.04, a = (R() - 0.5) * 0.7
    brush(c, R, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.011, 0.6)
  }
  const dot = (x: number, y: number, r: number) => {
    c.fillStyle = "rgba(255,0,0,0.8)"
    c.beginPath()
    c.arc(x, y, r, 0, 6.2832)
    c.fill()
  }
  // H1: both arms out, no legs, a rod with a knob at each end in its left hand
  at(STORY[0] - 0.2, STORY[1] + 0.36)
  brush(c, R, [[0, -0.13], [0, 0.07]], 0.02, 0.8)
  brush(c, R, [[-0.2, 0.03], [0, 0.045], [0.2, 0.05]], 0.012, 0.8)
  dot(0, 0.105, 0.026)
  brush(c, R, [[0.2, -0.03], [0.2, 0.12]], 0.008, 0.75)
  dot(0.2, -0.035, 0.012)
  dot(0.2, 0.125, 0.012)
  // H2: straight in front of the pig, its head beside the snout
  at(STORY[0] + 0.62, STORY[1] - 0.02)
  brush(c, R, [[0, -0.09], [0.015, 0.06]], 0.018, 0.8)
  brush(c, R, [[-0.12, 0.03], [0.01, 0.035], [0.13, 0.02]], 0.011, 0.8)
  brush(c, R, [[-0.07, -0.125], [0, -0.09], [0.08, -0.125]], 0.011, 0.75)
  dot(0.02, 0.095, 0.024)
  // H3: upside-down, legs up and splayed
  at(STORY[0] - 0.64, STORY[1] - 0.0)
  brush(c, R, [[0, 0.07], [0, -0.13]], 0.012, 0.75)
  brush(c, R, [[-0.024, 0.175], [0, 0.07], [0.024, 0.175]], 0.009, 0.7)
  dot(0, -0.155, 0.016)
  // ---- torch smears above the last panel: charcoal rubbed off a brand, with crumbs under each
  const B = rng(31)
  for (let i = 0; i < 6; i++) {
    at(PANEL[0] - 1.7 + i * 0.66 + B() * 0.2, 1.02 + B() * 0.25)
    const a = 0.5 + B() * 1.2
    for (let j = 0; j < 5; j++) {
      const l = 0.05 + B() * 0.09, o = (B() - 0.5) * 0.03
      c.strokeStyle = `rgba(0,0,255,${0.35 + B() * 0.4})`
      c.lineWidth = 0.008 + B() * 0.014
      c.lineCap = "round"
      c.beginPath()
      c.moveTo(o * Math.sin(a), -o * Math.cos(a))
      c.lineTo(o * Math.sin(a) + Math.cos(a) * l, -o * Math.cos(a) + Math.sin(a) * l)
      c.stroke()
    }
    c.fillStyle = "rgba(0,0,255,0.8)"
    for (let j = 0; j < 26; j++) {
      c.beginPath()
      c.arc((B() - 0.3) * 0.1, -B() * B() * 0.22, 0.0018 + B() * 0.003, 0, 6.2832)
      c.fill()
    }
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 8
  return tex
}

/** The hero's spray: G = coarse drops by arrival, B = grain. (R is unused: the hand's mask is rendered from the mesh.) */
function paintHero(): THREE.CanvasTexture {
  const N = 1024
  const cv = document.createElement("canvas")
  cv.width = cv.height = N
  const c = cv.getContext("2d")!
  const R = rng(67800)
  const img = c.createImageData(N, N)
  for (let i = 0; i < N * N; i++) {
    const g = R()
    img.data[i * 4] = 255
    img.data[i * 4 + 1] = 0
    img.data[i * 4 + 2] = Math.floor(255 * g * g)
    img.data[i * 4 + 3] = 255
  }
  c.putImageData(img, 0, 0)
  const k = N / HERO_SIZE
  setLocal(c, k, HERO_X0, HERO_Y0 + HERO_SIZE, HAND_W[0], HAND_W[1], TILT, 1, 1)
  c.globalCompositeOperation = "lighter"
  for (let i = 0; i < 1500; i++) {
    const a = R() * 6.2832, rr = 0.03 + Math.pow(R(), 0.7) * 0.24
    const v = Math.floor(60 + 195 * R())
    c.fillStyle = `rgb(0,${v},0)`
    c.beginPath()
    c.arc(Math.cos(a) * rr * 0.9, 0.09 + Math.sin(a) * rr, 0.0005 + R() * R() * R() * 0.0032, 0, 6.2832)
    c.fill()
  }
  // (the hand itself is not drawn here: its mask is the pressed mesh, seen square to the rock; see `maskRT`)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------------------------------------------------------------- timings

const START = TORCH_DUR * (1 - TORCH_LAND) // the hand-off ends this long into beat 0
const PRE = TORCH_DUR * (TORCH_LAND - 0.5) // seconds before the thrust at which the flame is at the lens
const PUFF_T = [1.0, 1.85, 2.7, 3.55, 4.35]
const PUFF_D = 0.6
/** Where each breath is aimed (hand-local) and how wide it lands. */
const PUFF_AIM: [number, number, number][] = [[0.012, 0.19, 0.085], [-0.066, 0.13, 0.078], [0.074, 0.112, 0.078], [-0.052, 0.012, 0.085], [0.064, 0.004, 0.085]]
const LIFT = 5.3
/** Where the blower's right hand pinches the tube, metres from its mouth. */
const GRIP_AT = 0.16
const SPRAY_N = 7200
const SEL_T = 3.3
const SAY_T = 3.9
const SAY = "Who?"
const hash1 = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 40)
  const texs: THREE.Texture[] = []
  const atlas = paintAtlas()
  const hero = paintHero()
  texs.push(atlas, hero)

  // ---- uniforms of the world rule
  const W = {
    uTorch: uniform(new THREE.Vector3(-0.5, 0.1, 0.3)),
    uTorchCol: uniform(new THREE.Vector3(1, 0.5, 0.2)),
    uFill: uniform(new THREE.Vector3(0.012, 0.015, 0.022)),
    uT: uniform(0),
    uHandOn: uniform(0),
    /** The flame's own view of the hand (view-projection), for its shadow on the rock. */
    uShVP: uniform(new THREE.Matrix4()),
    /** Per breath: how much has landed, and how wet it still is. */
    uPuff: uniformArray(PUFF_T.map(() => new THREE.Vector4()), "vec4"),
    uSpray: uniform(0),
    uClock: uniform(-10),
  }
  const aimW = PUFF_AIM.map((a) => handToWall(a[0], a[1]))
  const tipW = aimW.map((a) => new THREE.Vector3(a[0] + 0.19, a[1] - 0.075, 0.14))
  const uAim = uniformArray(aimW.map((a, i) => new THREE.Vector4(a[0], a[1], 0, PUFF_AIM[i][2])), "vec4")
  const uTip = uniformArray(tipW.map((t, i) => new THREE.Vector4(t.x, t.y, t.z, PUFF_T[i])), "vec4")

  // ---------------------------------------------------------------- the wall: bake its height once
  const bakeH = ctx.target({ hdr: true, fixed: [2048, 512] })
  const bakeN = ctx.target({ hdr: true, fixed: [2048, 512] })
  const gauss = (p: V2, c: [number, number], r: number): F => exp(dot(p.sub(vec2(c[0], c[1])), p.sub(vec2(c[0], c[1]))).div(-r * r)) as F
  /** vec4(height in metres, calcite, damp, knob) at a point of the wall. */
  const heightAt = Fn(([p]: [V2]) => {
    const warp = vec2(fbm(p.mul(1.3).add(3.7)), fbm(p.mul(1.3).add(vec2(9.2, 1.4)))).sub(0.5).toVar()
    const macro = fbm(p.mul(vec2(0.55, 0.8)).add(11.3)).sub(0.5).mul(0.3).add(fbm(p.mul(1.9).add(5.1)).sub(0.5).mul(0.1))
    // people chose smooth rock: the painted panels are quieter
    const qp = max(gauss(p, STORY, 0.8), gauss(p.mul(vec2(0.4, 1)), [PANEL[0] * 0.4, PANEL[1]], 0.85)).mul(0.8).toVar()
    // dissolution scallops: cups with sharp crests between them
    const sc = voronoi(p.mul(vec2(8.5, 6.2)).add(warp.mul(1.6))).toVar()
    const scM = smoothstep(0.36, 0.58, fbm(p.mul(0.45).add(3.1)))
    const scallop = sc.x.mul(sc.x).mul(0.034).mul(scM)
    // flowstone: rounded ribs running down where calcite has flowed over the rock
    const flowM = smoothstep(0.5, 0.66, fbm(vec2(p.x.mul(0.7).add(9), p.y.mul(0.16).add(2)))).toVar()
    const rib = sin(p.x.mul(38).add(warp.x.mul(9)).add(fbm(vec2(p.x.mul(3), p.y.mul(0.6))).mul(12))).mul(0.5).add(0.5)
    const flow = flowM.mul(rib.mul(rib).mul(0.012).add(0.05)).mul(qp.mul(0.8).oneMinus())
    // joints: thin grooves
    const cr = abs(fbm(p.mul(vec2(1.1, 0.55)).add(31.7)).sub(0.5))
    const crack = smoothstep(0.007, 0.0, cr).mul(0.02).mul(smoothstep(0.5, 0.62, fbm(p.mul(0.33).add(77))))
    // coralloids (cave popcorn): clusters of knobs
    const zone = sat(max(gauss(p, COR, 0.42).mul(1.5), smoothstep(0.64, 0.76, fbm(p.mul(1.7).add(21))).mul(qp.mul(1.2).oneMinus().max(0))) as F)
    const kv = voronoi(p.mul(44)).toVar()
    const on = step(0.32, hash21(kv.yz)).mul(smoothstep(0.25, 0.6, zone.add(hash21(kv.yz.add(3.1)).sub(0.5).mul(0.5)))).toVar()
    const kn = sqrt(max(float(1).sub(kv.x.div(0.5).pow(2)), 0)).mul(on).toVar()
    // a bedding ledge low on the wall, the ceiling rolling over, the foot flaring out
    const yl = fbm(vec2(p.x.mul(0.6), 2.3)).sub(0.5).mul(0.3).sub(0.8)
    const ledge = smoothstep(yl.add(0.035), yl.sub(0.05), p.y).mul(0.11)
    const ceil = max(p.y.sub(1.2), 0).pow(2).mul(1.2)
    const skirt = max(float(-1.05).sub(p.y), 0).mul(0.8)
    // people chose smooth rock: the painted panels are quieter
    const dh = length(p.sub(vec2(HERO_C[0], HERO_C[1])))
    const qh = float(1).sub(smoothstep(0.17, 0.42, dh)).toVar()
    const fine = fbm(p.mul(13)).sub(0.5).mul(0.0035).add(fbm(p.mul(5.3).add(2)).sub(0.5).mul(0.012).mul(qh.oneMinus()))
    const h = macro.mul(qh.oneMinus()).add(scallop.mul(qh.oneMinus()).mul(qp.mul(0.7).oneMinus())).add(flow.mul(qh.oneMinus())).sub(crack.mul(qh.oneMinus())).add(kn.mul(0.009)).add(ledge).add(ceil).add(skirt).add(fine)
    const calcite = sat(flowM.mul(0.8).add(kn.mul(1.2)).add(smoothstep(0.56, 0.76, fbm(p.mul(2.3).add(40))).mul(0.5)) as F)
    const damp = smoothstep(0.6, 0.78, fbm(vec2(p.x.mul(4), p.y.mul(0.45)).add(50))).mul(qh.oneMinus()).mul(smoothstep(0.3, 0.6, fbm(p.mul(0.8).add(70))))
    return vec4(h, calcite, damp, kn)
  }).setLayout({ name: "handsHeight", type: "vec4", inputs: [{ name: "p", type: "vec2" }] })
  const toWall = (uv: V2): V2 => vec2(uv.x.mul(WW).add(WX0), uv.y.mul(WH).add(WY0)) as V2
  const wuv = (p: V2): V2 => vec2(p.x.sub(WX0).div(WW), p.y.sub(WY0).div(WH)) as V2
  const passH = ctx.pass(({ uv }) => heightAt(toWall(uv)), {})
  const tH = texture(bakeH.texture)
  const tN = texture(bakeN.texture)
  const Hs = (p: V2): V4 => tH.sample(rtUV(wuv(p))).level(L0) as V4
  const passN = ctx.pass(({ uv }) => {
    const p = toWall(uv)
    const ex = WW / 2048, ey = WH / 512
    const h0 = Hs(p).x
    const gx = Hs(p.add(vec2(ex, 0)) as V2).x.sub(Hs(p.sub(vec2(ex, 0)) as V2).x).div(2 * ex)
    const gy = Hs(p.add(vec2(0, ey)) as V2).x.sub(Hs(p.sub(vec2(0, ey)) as V2).x).div(2 * ey)
    // cavity: how far below its surroundings a point is (pits hold dust and miss the spray)
    const avg = float(0).toVar()
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) avg.addAssign(Hs(p.add(vec2(ox * 0.03, oy * 0.03)) as V2).x)
    return vec4(gx, gy, avg.div(8).sub(h0), 1)
  }, {})
  let baked = false

  // ---------------------------------------------------------------- the world rule
  // The hand's shadow: the flame's own view of the hand and the tube, drawn white into a small mask every frame.
  // (Twenty capsules tested per pixel cost 18 ms of GPU time; this costs nothing and is the true silhouette.)
  const shadowRT = ctx.target({ hdr: false, fixed: [512, 512] })
  // the pressed hand seen square to the rock (drawn once, from the mesh): what the spray could not reach
  const maskRT = ctx.target({ hdr: false, fixed: [1024, 1024] })
  const tM = texture(maskRT.texture)
  const tSh = texture(shadowRT.texture)
  const handShadow = (P: V3): F => {
    const c = W.uShVP.mul(vec4(P, 1))
    const q = c.xy.div(max(c.w, 1e-4)).mul(0.5).add(0.5).toVar()
    const inside = step(0.001, c.w).mul(step(0, q.x)).mul(step(q.x, 1)).mul(step(0, q.y)).mul(step(q.y, 1))
    const m = float(0).toVar()
    // a small disc of taps: the penumbra
    for (const [ox, oy] of [[0, 0], [1, 0.3], [-0.3, 1], [-1, -0.3], [0.3, -1]]) m.addAssign(tSh.sample(rtUV(q.add(vec2(ox * 0.006, oy * 0.006)) as V2)).level(L0).x)
    return float(1).sub(m.mul(0.2).mul(inside).mul(W.uHandOn)) as F
  }
  /** The flame at P: vec4(unit direction to it, 1 / (d² + a little)). */
  const torchDir = (P: V3) => {
    const d = W.uTorch.sub(P)
    const d2 = dot(d, d)
    return { L: d.div(sqrt(d2)) as V3, att: float(1).div(d2.add(0.09)) as F, dist: sqrt(d2) as F }
  }

  // depth of field: every opaque surface writes its circle of confusion to alpha (signed: near < 0), the rule writes 8
  const DF = { uFocus: uniform(0.9), uAp: uniform(0.4), uMax: uniform(0.011) }
  const coc = (P: V3): F => {
    const d = max(length(P.sub(cameraPosition)), 0.05)
    return clampN(d.sub(DF.uFocus).div(d).mul(DF.uAp), -1, 1) as F
  }

  // ---------------------------------------------------------------- the wall mesh
  const wallGeo = new THREE.PlaneGeometry(WW, WH, 480, 120)
  wallGeo.translate(WX0 + WW / 2, WY0 + WH / 2, 0)
  const wallMat = new THREE.NodeMaterial()
  {
    const pxy = positionGeometry.xy
    const hv = tH.sample(rtUV(wuv(pxy as V2))).level(L0)
    const world = vec3(pxy, hv.x)
    wallMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
    const vP = world.toVarying() as V3
    wallMat.fragmentNode = Fn(() => {
      const p = vP.xy as V2
      const uvw = wuv(p)
      const hb = tH.sample(rtUV(uvw)).level(L0).toVar()
      // (the mesh is coarser than the bake: light the baked surface itself, so the march starts on it)
      const P = vec3(p, hb.x).toVar() as V3
      const nb = tN.sample(rtUV(uvw)).level(L0).toVar()
      const foot = max(length(dFdx(p)), length(dFdy(p))).toVar() // metres per pixel
      // ---- fine relief the bake cannot hold: grain and pits, faded by footprint
      const fMid = smoothstep(0.012, 0.003, foot)
      const fFine = smoothstep(0.0022, 0.0006, foot)
      const g1 = fbm(p.mul(63)).toVar()
      const g2 = vnoise(p.mul(420)).toVar()
      const pv = voronoi(p.mul(95)).toVar()
      const pit = smoothstep(0.34, 0.08, pv.x.div(hash21(pv.yz.add(1.3)).mul(0.8).add(0.3))).mul(step(0.74, hash21(pv.yz.add(5.5)))).toVar()
      const hm = g1.mul(0.0016).mul(fMid).add(g2.mul(0.0004).mul(fFine)).sub(pit.mul(0.0012).mul(fMid))
      const N0 = normalize(vec3(nb.x.negate(), nb.y.negate(), 1)).toVar()
      const dpx = dFdx(P), dpy = dFdy(P)
      const r1 = cross(dpy, N0), r2 = cross(N0, dpx)
      const det = dot(dpx, r1)
      const N = normalize(N0.mul(abs(det)).sub(r1.mul(dFdx(hm)).add(r2.mul(dFdy(hm))).mul(sign(det)))).toVar()
      const V = normalize(cameraPosition.sub(P)).toVar()
      const cav = sat(nb.z.mul(60).add(pit.mul(0.3).mul(fMid)) as F).toVar()
      const calc = hb.y.toVar()
      const damp = hb.z.toVar()

      // ---- the rock
      const tone = fbm(p.mul(1.7).add(60)).toVar()
      const alb = mixN(vec3(0.6, 0.55, 0.47), vec3(0.47, 0.37, 0.26), smoothstep(0.42, 0.7, tone)).toVar()
      alb.mulAssign(g1.mul(0.3).add(0.85))
      alb.assign(mixN(alb, vec3(0.3, 0.29, 0.28), smoothstep(0.7, 0.9, vnoise(p.mul(31).add(3))).mul(0.35))) // manganese specks
      alb.assign(mixN(alb, vec3(0.82, 0.8, 0.74), calc.mul(0.75)))
      alb.mulAssign(cav.mul(0.45).oneMinus()) // dust in the recesses
      const gloss = calc.mul(0.35).add(damp.mul(0.9)).toVar()

      // ---- paint
      const A = texture(atlas, uvw).toVar()
      const relief = smoothstep(-0.3, 0.45, g1.sub(0.5).mul(2).mul(fMid).sub(pit.mul(1.4).mul(fMid)).sub(cav.mul(0.8))).mul(0.6).add(0.4).toVar()
      // close up the atlas is coarser than the pixel (3.5 mm a texel): rebuild the spray at the pixel from its density,
      // a crisp edge broken by grain and a scatter of droplets where it thins, faded in by footprint
      const near = smoothstep(0.004, 0.0016, foot).toVar()
      const gr = vnoise(p.mul(620)).sub(0.5).add(vnoise(p.mul(1900)).sub(0.5).mul(0.6)).toVar()
      const edge = smoothstep(0.34, 0.56, A.x.add(gr.mul(0.32))).mul(A.x.mul(0.3).add(0.7))
      const dv = voronoi(p.mul(1100)).toVar()
      const drops = step(hash21(dv.yz), A.x.mul(1.6).sub(0.12)).mul(smoothstep(0.36, 0.18, dv.x.div(hash21(dv.yz.add(2.7)).mul(0.6).add(0.5))))
      const ochre = mixN(A.x, max(edge, drops.mul(0.85)), near).mul(relief).toVar()
      const wet = float(0).toVar()
      // the hero's negative: deposit from the five breaths, masked by the hand
      const hu = p.sub(vec2(HERO_X0, HERO_Y0)).div(HERO_SIZE).toVar()
      const Hh = texture(hero, hu).toVar()
      If(hu.x.greaterThan(0).and(hu.x.lessThan(1)).and(hu.y.greaterThan(0)).and(hu.y.lessThan(1)), () => {
        const D = float(0).toVar(), Wt = float(0).toVar()
        Loop(PUFF_T.length, ({ i }) => {
          const a = (uAim.element(i) as unknown as V4).toVar()
          const st = (W.uPuff.element(i) as unknown as V4).toVar()
          // the tube is below and to the right, so the cloud lands a little long up and to the left
          const q = p.sub(a.xy).toVar()
          const along = q.x.mul(-0.6).add(q.y.mul(0.5))
          const g = exp(dot(q, q).sub(along.mul(along).mul(0.35)).div(a.w.mul(a.w)).negate())
          D.addAssign(g.mul(st.x))
          Wt.addAssign(g.mul(st.x).mul(st.y))
        })
        const dens = float(1).sub(exp(D.mul(Hh.z.mul(1.5).add(0.5)).mul(-3.1))).toVar()
        const drop = step(float(1.02).sub(W.uSpray.mul(0.85)), Hh.y).mul(smoothstep(0.02, 0.2, D.add(W.uSpray.mul(0.05))))
        // under the hand nothing lands; a hair of pigment got under its edge (a soft margin, a little wider at the thin fingertips)
        const mk = tM.sample(rtUV(hu)).level(L0).x.mul(0.36).toVar()
        for (const [ox, oy] of [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]]) {
          mk.addAssign(tM.sample(rtUV(hu.add(vec2(ox * 0.0024, oy * 0.0024)) as V2)).level(L0).x.mul(0.075))
          mk.addAssign(tM.sample(rtUV(hu.add(vec2(oy * 0.0055, ox * 0.0055)) as V2)).level(L0).x.mul(0.032))
        }
        const unc = smoothstep(0.9, 0.3, mk.add(Hh.z.sub(0.5).mul(0.12)))
        const dep = max(dens, drop.mul(0.9)).mul(unc)
        ochre.assign(max(ochre, dep.mul(relief.mul(0.5).add(0.5))))
        wet.assign(sat(Wt.mul(2.2) as F).mul(dep))
      })
      alb.assign(mixN(alb, vec3(0.4, 0.105, 0.055), sat(ochre.mul(1.4) as F)))
      alb.mulAssign(mixN(float(1), float(0.5), wet))
      gloss.assign(max(gloss, wet.mul(1.4)))
      // the oldest: faint, and only where no knob has grown over it
      const ghost = A.y.mul(hb.w.oneMinus()).mul(smoothstep(0.3, 0.6, fbm(p.mul(9).add(13)))).mul(relief)
      alb.assign(mixN(alb, vec3(0.4, 0.17, 0.11), ghost.mul(0.55)))
      // charcoal catches on the high points
      const coal = A.z.mul(smoothstep(0.3, 0.62, g1.add(pit.negate().mul(0.4)))).mul(calc.mul(0.5).oneMinus())
      alb.assign(mixN(alb, vec3(0.018, 0.017, 0.018), sat(coal.mul(1.3) as F)))
      alb.mulAssign(mixN(float(1), float(0.58), damp))

      // ---- the flame
      const T = torchDir(P)
      const ndl = dot(N, T.L).toVar()
      // relief shadow: march the height field toward the flame
      const occ = float(0).toVar()
      If(dot(N0, T.L).greaterThan(-0.2), () => {
        const reach = min(T.dist.mul(0.9), 0.6)
        Loop(8, ({ i }) => {
          const tt = float(i).add(1).div(8).pow(1.7).mul(reach).toVar()
          const q = P.add(T.L.mul(tt)).toVar()
          const hq = tH.sample(rtUV(wuv(q.xy as V2))).level(L0).x
          occ.assign(max(occ, hq.sub(q.z).sub(0.001).div(tt.mul(0.085).add(0.0035))))
        })
      })
      const sh = float(1).sub(sat(occ as F)).toVar()
      sh.mulAssign(handShadow(P))
      const key = W.uTorchCol.mul(T.att).mul(sh).toVar()
      const dif = max(ndl, 0)
      const fill = W.uFill.mul(N.y.mul(0.25).add(0.75)).add(W.uTorchCol.mul(T.att).mul(0.035)).mul(cav.mul(0.6).oneMinus())
      const c = alb.mul(key.mul(dif).add(fill)).toVar()
      // sheen of damp rock and wet paint, and the calcite's crystals glinting one by one
      const Hv = normalize(T.L.add(V)).toVar()
      const nh = max(dot(N, Hv), 0).toVar()
      c.addAssign(key.mul(pow(nh, 90)).mul(gloss).mul(0.5).mul(step(0, ndl)))
      const cell = floor(p.mul(520))
      const fac = normalize(vec3(hash21(cell).sub(0.5), hash21(cell.add(17.3)).sub(0.5), 0.55)).toVar()
      const glint = pow(max(dot(normalize(N.add(fac.mul(0.9))), Hv), 0), 260).mul(smoothstep(0.45, 0.9, calc)).mul(smoothstep(0.0035, 0.0012, foot)).mul(step(0, ndl))
      c.addAssign(key.mul(glint).mul(1.0))
      return vec4(c, coc(P))
    })()
  }
  const wall = new THREE.Mesh(wallGeo, wallMat)
  wall.frustumCulled = false
  scene.add(wall)

  // ---- the floor: gravel and silt
  const floorMat = new THREE.NodeMaterial()
  floorMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const v = voronoi(P.xz.mul(38)).toVar()
    const v2 = voronoi(P.xz.mul(9).add(3)).toVar()
    const hgt = max(float(0.5).sub(v.x), 0).mul(0.6).add(max(float(0.55).sub(v2.x), 0))
    const N = normalize(vec3(dFdx(hgt).mul(-22), 1, dFdy(hgt).mul(22)))
    const alb = mixN(vec3(0.2, 0.17, 0.14), vec3(0.42, 0.38, 0.32), hash21(v.yz)).mul(v.x.oneMinus().mul(0.6).add(0.4))
    const T = torchDir(P as V3)
    return vec4(alb.mul(W.uTorchCol.mul(T.att).mul(max(dot(N, T.L), 0)).add(W.uFill)), coc(P as V3))
  })()
  const floorGeo = new THREE.PlaneGeometry(WW, 5)
  floorGeo.rotateX(-Math.PI / 2)
  floorGeo.translate(WX0 + WW / 2, FLOOR_Y, 2.4)
  scene.add(new THREE.Mesh(floorGeo, floorMat))

  // ---------------------------------------------------------------- the hand
  // The toolkit's macro left forearm and hand (hand.ts), in the knapper's skin from spark (engine/people.ts,
  // with the options spark's left hand uses): same person, same hand. It is placed by its palm frame on
  // the rock (fingers up the wall, leaning TILT, the back of the hand to the lens) with the wrist bent back
  // so the forearm comes off the rock toward the blower. The rock is a Press: skin that would sink into it
  // is laid on it, so the pads and the heel flatten where they bear.
  const knapper = SPARK_PEOPLE[0]
  const HL = HM.makeHand({ side: "L", mass: 1.08 })
  const look = HM.handLook(HL, { skin: knapper.look.skin, dust: 0.85, hair: 0.6, veins: 0.55, callus: 0.5 })
  const WRIST_X = HL.anchors.wrist[0]
  // where a point of the skin was while the hand was on the rock (rest space to the wall), for the ochre on it
  const uPressX = uniform(new THREE.Vector3()), uPressY = uniform(new THREE.Vector3()), uPressZ = uniform(new THREE.Vector3()), uPressO = uniform(new THREE.Vector3())
  const pressW = makePress()
  const aim = makeAim()
  let hn: SkinNodes | null = null
  const herd = makeHerd({
    spec: HL.spec, count: 1, path: aim, lods: [{ detail: 1, cover: 0 }], press: pressW,
    material: (n) => {
      hn = n
      const T = torchDir(n.vW)
      const Lt: Lights = { key: T.L, keyCol: W.uTorchCol.mul(T.att) as V3, sky: W.uFill.mul(1.2) as V3, bounce: W.uTorchCol.mul(T.att).mul(vec3(0.07, 0.045, 0.03)) as V3 }
      const m = skinMaterial(n, Lt, look)
      const skin = m.fragmentNode as unknown as V4
      m.fragmentNode = Fn(() => {
        const rest = n.vRest
        const rn = normalize(n.vRestN).toVar()
        // ochre on the skin, where the breaths landed: on the back of the hand and the sides of the fingers
        const pw = uPressO.add(uPressX.mul(rest.x)).add(uPressY.mul(rest.y)).add(uPressZ.mul(rest.z)).toVar()
        const D = float(0).toVar(), Wt = float(0).toVar()
        Loop(PUFF_T.length, ({ i }) => {
          const a = (uAim.element(i) as unknown as V4).toVar()
          const st = (W.uPuff.element(i) as unknown as V4).toVar()
          const q = pw.xy.sub(a.xy)
          const gq = exp(dot(q, q).div(a.w.mul(a.w)).negate())
          D.addAssign(gq.mul(st.x))
          Wt.addAssign(gq.mul(st.x).mul(st.y))
        })
        // (only the forearm near the wrist was in the cloud)
        const onHand = smoothstep(WRIST_X - 0.09, WRIST_X - 0.02, rest.x)
        const facing = smoothstep(-0.15, 0.5, rn.y.add(rn.z.mul(0.35)).sub(rn.x.mul(0.2)))
        const dep = float(1).sub(exp(D.mul(vnoise(rest.xz.mul(900)).mul(1.4).add(0.5)).mul(-2.3))).mul(facing).mul(onHand).toVar()
        const wet = sat(Wt.mul(2) as F).mul(dep)
        // the pigment's own light: matt, then glossy while wet
        const N = normalize(n.vN)
        const V = normalize(cameraPosition.sub(n.vW))
        const ndl = dot(N, T.L)
        const key = W.uTorchCol.mul(T.att)
        const och = vec3(0.46, 0.11, 0.05).mul(mixN(float(1), float(0.6), wet))
        const lit = och.mul(key.mul(max(ndl, 0).mul(0.85).add(0.05)).add(W.uFill.mul(2))).toVar()
        lit.addAssign(key.mul(pow(max(dot(N, normalize(T.L.add(V))), 0), 90)).mul(wet).mul(0.5).mul(step(0, ndl)))
        return vec4(mixN(skin.rgb, lit, dep.mul(0.92)), coc(n.vW))
      })()
      return m
    },
  })
  herd.group.traverse((o) => (o.frustumCulled = false))
  scene.add(herd.group)
  const hNodes = hn as unknown as SkinNodes
  const handGeo = herd.built[0].hide
  const PALM_BONE = herd.rig.bone("arm.2")
  const qBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)))
  qBase.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), TILT))
  // pressed: the fingers lean a few degrees into the rock (pivoting at the wrist) so the pads bear as the heel does
  const qPress = qBase.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -PITCH))
  const qHand = new THREE.Quaternion(), qT = new THREE.Quaternion()
  const wrist = new THREE.Vector3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3()
  const ZM = new THREE.Vector3(0, 0, 1)
  const PRESS_O = new THREE.Vector3(HAND_W[0], HAND_W[1], PALM_OFF)
  const PIVOT = new THREE.Vector3(0.185, 0, 0)
  {
    // rest space -> wall, for the hand on the rock: hand-local is rest minus the wrist, turned by qPress
    uPressX.value.set(1, 0, 0).applyQuaternion(qPress)
    uPressY.value.set(0, 1, 0).applyQuaternion(qPress)
    uPressZ.value.set(0, 0, 1).applyQuaternion(qPress)
    uPressO.value.copy(PRESS_O).addScaledVector(uPressX.value, -WRIST_X)
    // the rock as a press: a very flat ellipsoid whose face is the wall at the hand
    pressW.c.value.set(HERO_C[0], HERO_C[1], WALL_Z - 0.3)
    pressW.r.value.set(3, 3, 0.3)
    pressW.amt.value = 1
  }
  // the wrist's bend, measured once: the rotation the channel `wristFlex` = 1 gives the palm bone, in model space
  const hs = { roll: 0, time: 0, ch: {} as Record<string, number>, elbow: new THREE.Vector3(), X: new THREE.Vector3(1, 0, 0) }
  const e3 = [0, 0, 0], d3 = [1, 0, 0]
  const fill = (_i: number, dr: Drive) => {
    dr.dist = 0
    dr.lane = 0
    dr.rise = 0
    dr.time = hs.time
    dr.scale = 1
    dr.seed = knapper.seed + 0.2
    dr.look = null
    for (const k in dr.ch) dr.ch[k] = 0
    for (const k in hs.ch) dr.ch[k] = hs.ch[k]
    dr.roll = hs.roll
  }
  const md = makeDrive(aim)
  const rq = (out: THREE.Quaternion) => out.set(herd.rig.q[PALM_BONE * 4], herd.rig.q[PALM_BONE * 4 + 1], herd.rig.q[PALM_BONE * 4 + 2], herd.rig.q[PALM_BONE * 4 + 3])
  const rp = (out: THREE.Vector3) => out.set(herd.rig.p[PALM_BONE * 3], herd.rig.p[PALM_BONE * 3 + 1], herd.rig.p[PALM_BONE * 3 + 2])
  const flexAx = new THREE.Vector3(0, 0, 1)
  let flexK = 1
  {
    aim.set([0, 0, 0], [1, 0, 0])
    hs.roll = 0
    hs.ch = { wristFlex: 1 }
    fill(0, md)
    herd.rig.pose(md)
    rq(qT)
    // axis and angle of a unit flex (the arm's own frame is the model's at roll 0 and heading +x)
    const s = Math.sqrt(Math.max(1e-12, 1 - qT.w * qT.w))
    flexAx.set(qT.x / s, qT.y / s, qT.z / s)
    flexK = 2 * Math.acos(clamp(qT.w, -1, 1))
  }
  const Rf = new THREE.Quaternion(), Qm = new THREE.Quaternion(), mX = new THREE.Vector3(), mY = new THREE.Vector3(), r0 = new THREE.Vector3(), u0 = new THREE.Vector3()
  /** Put the palm bone at `at` with the hand's frame `q` (hand-local: +x fingers, +y the back, +z the thumb's side), the wrist bent back by `bend` radians. */
  function placeHand(q: THREE.Quaternion, at: THREE.Vector3, bend: number) {
    // the forearm's frame is the hand's with the bend taken out; the sign that brings the elbow off the rock
    hs.ch.wristFlex = -bend
    // and deviated toward the thumb, so the forearm runs out toward the lower-left corner, not straight down onto the rule
    hs.ch.wristDev = DEV
    if (DEV !== 0) {
      // the palm's turn under both channels, measured on the rig (heading +x, roll 0): the forearm's frame is the hand's without it
      aim.set([0, 0, 0], [1, 0, 0])
      const r = hs.roll
      hs.roll = 0
      fill(0, md)
      herd.rig.pose(md)
      hs.roll = r
      rq(Rf)
    } else Rf.setFromAxisAngle(flexAx, -bend * flexK)
    Qm.copy(q).multiply(Rf.invert())
    mX.set(1, 0, 0).applyQuaternion(Qm)
    mY.set(0, 1, 0).applyQuaternion(Qm)
    r0.set(-mX.z, 0, mX.x).normalize()
    u0.crossVectors(r0, mX)
    hs.roll = Math.atan2(mY.dot(r0), mY.dot(u0))
    hs.X.copy(mX)
    hs.elbow.copy(at).addScaledVector(mX, -WRIST_X)
    // one correction: where the rig actually puts the wrist (the path's own offsets), moved onto the target
    for (let k = 0; k < 2; k++) {
      e3[0] = hs.elbow.x
      e3[1] = hs.elbow.y
      e3[2] = hs.elbow.z
      d3[0] = mX.x
      d3[1] = mX.y
      d3[2] = mX.z
      aim.set(e3, d3)
      fill(0, md)
      herd.rig.pose(md)
      rp(v1)
      hs.elbow.add(v0.subVectors(at, v1))
    }
    e3[0] = hs.elbow.x
    e3[1] = hs.elbow.y
    e3[2] = hs.elbow.z
    aim.set(e3, d3)
  }
  /** Pose the hand: `peel` 0..1 (heel off the rock, fingertips still on it), `away` 0..1 (gone), `relax` (curl), `tremor`. */
  function poseHand(peel: number, away: number, relax: number, bend: number, tremor: number, spread: number) {
    qHand.copy(qPress).multiply(qT.setFromAxisAngle(ZM, -peel * 0.42 - away * 0.5))
    // pivot on the fingertips while it peels
    v0.copy(PIVOT).applyQuaternion(qPress).add(PRESS_O)
    wrist.copy(v0).sub(v1.copy(PIVOT).applyQuaternion(qHand))
    wrist.x += -0.22 * away + tremor * 0.0006
    wrist.y += -0.8 * away * away - 0.05 * away
    wrist.z += 0.3 * away + 0.012 * peel
    hs.ch.flat = clamp(1 - relax * 1.3)
    hs.ch.splay = clamp(0.75 + spread * 0.25 - relax * 0.6)
    hs.ch.curl = relax * 0.55
    placeHand(qHand, wrist, bend)
  }
  const bakeCam = new THREE.PerspectiveCamera(40, 1, 0.05, 5)
  bakeCam.position.set(HERO_C[0], HERO_C[1], 1.2)
  bakeCam.lookAt(HERO_C[0], HERO_C[1], 0)
  bakeCam.updateMatrixWorld()
  // the hand's mask on the rock: the pressed hand seen square to the wall, nearer the rock = more covered
  const maskScene = new THREE.Scene()
  const maskCam = new THREE.OrthographicCamera(-HERO_SIZE / 2, HERO_SIZE / 2, HERO_SIZE / 2, -HERO_SIZE / 2, 0.05, 3)
  maskCam.position.set(HERO_C[0], HERO_C[1], 1.5)
  maskCam.lookAt(HERO_C[0], HERO_C[1], 0)
  maskCam.updateMatrixWorld()
  const maskMat = new THREE.NodeMaterial()
  maskMat.vertexNode = hNodes.clip
  maskMat.fragmentNode = vec4(sat(float(1).sub(hNodes.vW.z.sub(WALL_Z).div(0.03)) as F), 0, 0, 1)
  maskMat.side = THREE.DoubleSide
  // (the nearest skin to the rock wins, front or back face: a max, not a depth test)
  maskMat.depthTest = false
  maskMat.depthWrite = false
  maskMat.blending = THREE.CustomBlending
  maskMat.blendEquation = THREE.MaxEquation
  maskMat.blendSrc = THREE.OneFactor
  maskMat.blendDst = THREE.OneFactor
  const maskMesh = new THREE.Mesh(handGeo, maskMat)
  maskMesh.frustumCulled = false
  maskScene.add(maskMesh)
  let masked = false

  // ---------------------------------------------------------------- the tube
  const TUBE_L = 0.62
  const tubeGeo = new THREE.CylinderGeometry(0.0049, 0.0057, TUBE_L, 14, 1, true) // a bird's long bone, about a centimetre across
  tubeGeo.translate(0, -TUBE_L / 2, 0) // its mouth (the end the pigment leaves) is the origin; it runs down -y to the blower
  const tubeMat = new THREE.NodeMaterial()
  tubeMat.side = THREE.DoubleSide
  tubeMat.fragmentNode = Fn(() => {
    const P = positionWorld as V3
    const st = uvAttr()
    const N = normalize(normalWorld).toVar()
    const T = torchDir(P)
    const a = st.y // 1 at the mouth
    const grain = vnoise(vec2(st.x.mul(40), st.y.mul(900))).mul(0.5).add(vnoise(vec2(st.x.mul(9), st.y.mul(60))).mul(0.5))
    const bone = mixN(vec3(0.62, 0.55, 0.42), vec3(0.78, 0.72, 0.6), grain).toVar()
    bone.assign(mixN(bone, vec3(0.42, 0.1, 0.045), smoothstep(0.88, 0.99, a.add(grain.mul(0.06))).mul(W.uSpray.mul(0.8).add(0.2))))
    const ndl = abs(dot(N, T.L))
    const V = normalize(cameraPosition.sub(P))
    const c = bone.mul(W.uTorchCol.mul(T.att).mul(ndl.mul(0.8).add(0.2)).add(W.uFill)).toVar()
    c.addAssign(W.uTorchCol.mul(T.att).mul(pow(max(dot(N, normalize(T.L.add(V))), 0), 40)).mul(0.25))
    return vec4(c, coc(P))
  })()
  const tube = new THREE.Mesh(tubeGeo, tubeMat)
  tube.frustumCulled = false
  scene.add(tube)

  // ---- the blower's right hand on the tube: the same person, holding it like a reed stylus (hand.ts HELD.stylus, a tripod
  // pinch) a third of the way down, steering each breath
  const HR = HM.makeHand({ side: "R", mass: 1.08 })
  const lookR = HM.handLook(HR, { skin: knapper.look.skin, dust: 0.85, hair: 0.6, veins: 0.55, callus: 0.8 })
  const aimR = makeAim()
  let hnR: SkinNodes | null = null
  const herdR = makeHerd({
    spec: HR.spec, count: 1, path: aimR, lods: [{ detail: 1, cover: 0 }],
    material: (n) => {
      hnR = n
      const T = torchDir(n.vW)
      // (out at the frame's edge it is far from the flame: the lit rock it hangs over is its bounce, and a
      // little more of the cave's fill, so it reads as a hand and not a dark shape)
      const m = skinMaterial(n, { key: T.L, keyCol: W.uTorchCol.mul(T.att).mul(1.35) as V3, sky: W.uFill.mul(2.2) as V3, bounce: W.uTorchCol.mul(T.att.add(0.25)).mul(vec3(0.16, 0.11, 0.075)) as V3 }, lookR)
      m.fragmentNode = vec4((m.fragmentNode as unknown as V4).rgb, coc(n.vW))
      return m
    },
  })
  herdR.group.traverse((o) => (o.frustumCulled = false))
  scene.add(herdR.group)
  const PALM_R = herdR.rig.bone("arm.2")
  const STY_A = new THREE.Vector3(...HR.anchors.stylus[0]), STY_B = new THREE.Vector3(...HR.anchors.stylus[1])
  const hsR = { roll: 0, time: 0, ch: { pinch: 1 } as Record<string, number> }
  const fillR = (_i: number, dr: Drive) => {
    dr.dist = 0
    dr.lane = 0
    dr.rise = 0
    dr.time = hsR.time
    dr.scale = 1
    dr.seed = knapper.seed
    dr.look = null
    for (const k in dr.ch) dr.ch[k] = 0
    for (const k in hsR.ch) dr.ch[k] = hsR.ch[k]
    dr.roll = hsR.roll
  }
  const mdR = makeDrive(aimR)
  // the stylus's frame in the model: along it (toward the tip), and the back of the hand square to it
  const sM = new THREE.Vector3().subVectors(STY_A, STY_B).normalize()
  const yM = new THREE.Vector3(0, 1, 0).addScaledVector(sM, -sM.y).normalize()
  const mBasis = new THREE.Matrix4().makeBasis(sM, yM, new THREE.Vector3().crossVectors(sM, yM))
  const mBasisT = mBasis.clone().transpose()
  const wB = new THREE.Matrix4(), qR = new THREE.Quaternion(), rX = new THREE.Vector3(), rY = new THREE.Vector3(), rU = new THREE.Vector3(), rZ = new THREE.Vector3(), rE = new THREE.Vector3(), rW = new THREE.Vector3()
  const eR = [0, 0, 0], dR = [1, 0, 0]
  /** Pinch the tube: the stylus's point at `grip`, its length along `dir` (toward the rock), the back of the hand toward `up`. */
  function placeR(grip: THREE.Vector3, dir: THREE.Vector3, up: THREE.Vector3) {
    rU.copy(up).addScaledVector(dir, -up.dot(dir)).normalize()
    wB.makeBasis(dir, rU, rZ.crossVectors(dir, rU))
    qR.setFromRotationMatrix(wB.multiply(mBasisT))
    rX.set(1, 0, 0).applyQuaternion(qR)
    rY.set(0, 1, 0).applyQuaternion(qR)
    r0.set(-rX.z, 0, rX.x).normalize()
    u0.crossVectors(r0, rX)
    hsR.roll = Math.atan2(rY.dot(r0), rY.dot(u0))
    rE.copy(STY_A).applyQuaternion(qR)
    rE.subVectors(grip, rE)
    // the wrist where it should be, and where the rig puts it: one correction
    rW.set(WRIST_X, 0, 0).applyQuaternion(qR).add(rE)
    for (let k = 0; k < 2; k++) {
      eR[0] = rE.x
      eR[1] = rE.y
      eR[2] = rE.z
      dR[0] = rX.x
      dR[1] = rX.y
      dR[2] = rX.z
      aimR.set(eR, dR)
      fillR(0, mdR)
      herdR.rig.pose(mdR)
      v1.set(herdR.rig.p[PALM_R * 3], herdR.rig.p[PALM_R * 3 + 1], herdR.rig.p[PALM_R * 3 + 2])
      rE.add(v0.subVectors(rW, v1))
    }
    eR[0] = rE.x
    eR[1] = rE.y
    eR[2] = rE.z
    aimR.set(eR, dR)
  }
  const hnRn = hnR as unknown as SkinNodes

  // ---- what the flame sees of the hand and the tube (the shadow mask)
  const shScene = new THREE.Scene()
  const shCam = new THREE.PerspectiveCamera(80, 1, 0.02, 4)
  shCam.up.set(0, 0, 1)
  const white = new THREE.NodeMaterial()
  white.vertexNode = hNodes.clip
  white.fragmentNode = vec4(1, 1, 1, 1)
  white.side = THREE.DoubleSide
  const shHand = new THREE.Mesh(handGeo, white)
  shHand.frustumCulled = false
  const white2 = new THREE.NodeMaterial()
  white2.fragmentNode = vec4(1, 1, 1, 1)
  white2.side = THREE.DoubleSide
  const shTube = new THREE.Mesh(tubeGeo, white2)
  shTube.frustumCulled = false
  const white3 = new THREE.NodeMaterial()
  white3.vertexNode = hnRn.clip
  white3.fragmentNode = vec4(1, 1, 1, 1)
  white3.side = THREE.DoubleSide
  const shHandR = new THREE.Mesh(herdR.built[0].hide, white3)
  shHandR.frustumCulled = false
  shScene.add(shHand, shTube, shHandR)

  // ---------------------------------------------------------------- the spray: every droplet a pure function of the clock
  const sprayGeo = new THREE.InstancedBufferGeometry()
  {
    const q = new THREE.PlaneGeometry(1, 1)
    sprayGeo.index = q.index
    sprayGeo.setAttribute("position", q.getAttribute("position"))
    sprayGeo.setAttribute("uv", q.getAttribute("uv"))
    const R = rng(1977)
    const a = new Float32Array(SPRAY_N * 4), b = new Float32Array(SPRAY_N * 4)
    for (let i = 0; i < SPRAY_N * 4; i++) {
      a[i] = R()
      b[i] = R()
    }
    sprayGeo.setAttribute("aR", new THREE.InstancedBufferAttribute(a, 4))
    sprayGeo.setAttribute("aQ", new THREE.InstancedBufferAttribute(b, 4))
    sprayGeo.instanceCount = SPRAY_N
  }
  const uRight = uniform(new THREE.Vector3(1, 0, 0)), uUp = uniform(new THREE.Vector3(0, 1, 0))
  const sprayMat = new THREE.NodeMaterial()
  {
    const aR = attribute("aR", "vec4") as V4, aQ = attribute("aQ", "vec4") as V4
    const q = positionGeometry
    const j = int(floor(aR.x.mul(PUFF_T.length)))
    const tip = (uTip.element(j) as unknown as V4).toVar()
    const aim = (uAim.element(j) as unknown as V4).toVar()
    // most leave in the first half of the breath
    const born = tip.w.add(aR.y.mul(aR.y).mul(PUFF_D * 0.9))
    const mist = step(0.8, aQ.z)
    const posAt = (age: F): V3 => {
      const axis = normalize(vec3(aim.xy, 0).sub(tip.xyz)).toVar()
      const su = normalize(cross(axis, vec3(0, 0, 1))).toVar()
      const sv = cross(su, axis)
      const th = sqrt(aR.z).mul(0.36).add(mist.mul(0.12))
      const ph = aR.w.mul(6.2832)
      const dir = normalize(axis.add(su.mul(ph.cos()).add(sv.mul(ph.sin())).mul(th))).toVar()
      const reach = tip.z.sub(aQ.x.mul(0.014)).div(max(dir.z.negate(), 0.08)).mul(mixN(float(1), aQ.w.mul(0.3).add(0.6), mist))
      const kd = aQ.y.mul(7).add(7)
      const s = reach.mul(float(1).sub(exp(max(age, 0).mul(kd).negate())))
      // the fines hang, lift on the flame's heat and drift back off the rock
      const hang = max(age.sub(0.12), 0).mul(mist)
      return tip.xyz.add(dir.mul(s)).add(vec3(sin(aR.w.mul(40).add(age.mul(5))).mul(0.012), hang.mul(0.05), hang.mul(0.07)).mul(hang.mul(4).min(1))).sub(vec3(0, age.mul(age).mul(0.16), 0)) as V3
    }
    const age = W.uClock.sub(born).toVar()
    const c0 = posAt(age as F), c1 = posAt(age.sub(0.006) as F)
    const sz = aQ.x.mul(aQ.x).mul(0.0022).add(0.0009).mul(mixN(float(1), float(0.7), mist))
    // a short smear along its path (a 180-degree shutter's worth, held to a few droplet widths: at 1080p a
    // full frame's travel drew every drop as a line), centred on where it is
    const dv = c0.sub(c1).toVar()
    const sl = length(dv).toVar()
    const smear = dv.mul(min(sz.mul(2.2), sl).div(max(sl, 1e-6))).toVar()
    const c = c0.add(smear.mul(q.y))
    const world = c.add(uRight.mul(q.x.mul(sz))).add(uUp.mul(q.y.mul(sz)))
    const kd = aQ.y.mul(7).add(7)
    const landed = float(1).sub(exp(max(age, 0).mul(kd).negate()))
    const alive = step(0, age).mul(mixN(smoothstep(0.995, 0.93, landed), smoothstep(1.1, 0.25, age), mist)).toVarying()
    sprayMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world.mul(step(0.001, alive)), 1))
    const vP = c0.toVarying() as V3
    const vM = mist.toVarying()
    sprayMat.fragmentNode = Fn(() => {
      const d = length(uvAttr().sub(0.5).mul(2))
      const T = torchDir(vP)
      const a = smoothstep(1, 0.3, d).mul(alive).mul(mixN(float(0.85), float(0.3), vM))
      const lit = vec3(0.6, 0.15, 0.06).mul(W.uTorchCol.mul(T.att).mul(0.8).add(W.uFill.mul(2)))
      return vec4(lit.mul(a), a)
    })()
    sprayMat.transparent = true
    sprayMat.depthWrite = false
    sprayMat.blending = THREE.CustomBlending
    sprayMat.blendSrc = THREE.OneFactor
    sprayMat.blendDst = THREE.OneMinusSrcAlphaFactor
    // (alpha carries the focus: the spray leaves it as it found it)
    sprayMat.blendSrcAlpha = THREE.ZeroFactor
    sprayMat.blendDstAlpha = THREE.OneFactor
    sprayMat.side = THREE.DoubleSide
  }
  const spray = new THREE.Mesh(sprayGeo, sprayMat)
  spray.frustumCulled = false
  spray.renderOrder = 15
  scene.add(spray)

  // ---------------------------------------------------------------- the brand, and the rule of ages
  const brand = makeBrand({ coc })
  scene.add(brand.group)
  const face = ruleFace()
  const steel = steelRuleMaterial(face.tex, { base: [0.74, 0.6, 0.38], gloss: 0.7, debugLabels: ctx.debugLabels })
  const rule = new THREE.Mesh(ruleGeometry(), steel.mat)
  // (alpha 8: the rule is rigid to the lens and never blurred, nor blurred into; 8 so a multisampled edge pixel still reads above 1)
  steel.mat.fragmentNode = vec4((steel.mat.fragmentNode as unknown as V4).rgb, 8)
  steel.mat.blending = THREE.NoBlending
  steel.mat.depthTest = false
  steel.mat.transparent = true // (sorted with the transparent things, so the flame and the spray never draw over it)
  rule.renderOrder = 40
  rule.frustumCulled = false
  scene.add(rule)
  const ruleStyle = { treatment: "steel" as const, debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }

  // ---------------------------------------------------------------- depth of field: a gather over the circle of confusion each surface left in alpha
  // (rings of taps, rotated per pixel; near things spread over what is behind them, far things only over things as soft)
  const hdrOut = ctx.target({})
  const DU = { tS: uniformTexture(stage.texture), uMax: DF.uMax }
  const RINGS: [number, number][] = [[6, 0.36], [10, 0.7], [14, 1]]
  const dof = ctx.pass(({ uv: st, res }) => {
    const c0 = sampleRT(DU.tS, st).toVar()
    const out = vec3(c0.rgb).toVar()
    If(c0.a.lessThan(1.02), () => {
      const a0 = abs(c0.a).toVar()
      const acc = vec3(c0.rgb).toVar()
      const w = float(1).toVar()
      const asp = res.x.div(res.y)
      const spin = hash21(floor(st.mul(res))).mul(6.2832).toVar()
      for (const [n, rr] of RINGS) {
        for (let k = 0; k < n; k++) {
          const an = spin.add((k / n) * 6.2832 + rr * 1.7)
          const sm = sampleRT(DU.tS, st.add(vec2(cos(an), sin(an)).mul(rr).mul(DU.uMax).div(vec2(asp, 1))) as V2).toVar()
          const as = abs(sm.a)
          const lim = select(sm.a.lessThan(0), as, select(c0.a.lessThan(0), max(as, a0), min(as, a0)))
          const kw = smoothstep(rr - 0.08, rr + 0.08, lim).mul(step(sm.a, 1.02)).toVar()
          acc.addAssign(sm.rgb.mul(kw))
          w.addAssign(kw)
        }
      }
      out.assign(acc.div(w))
    })
    return vec4(out, 1)
  }, DU)

  // ---------------------------------------------------------------- the story: one place where every clock is read
  const V = {
    cam: new THREE.Vector3(), look: new THREE.Vector3(), torch: new THREE.Vector3(), torchPrev: new THREE.Vector3(), lean: new THREE.Vector3(), handle: new THREE.Vector3(0.25, -1, 0.45).normalize(),
    flick: 1, power: 1, burst: 0, expo: 1, sel: [0, 0, 0, 0] as [number, number, number, number], handOn: false, pop: 0,
  }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3()
  const kk = (t: number, a: number, b: number, e: (x: number) => number = E.io2) => e(clamp((t - a) / (b - a)))
  /** Camera position and aim at beat clocks (t0, t1, t2), without the hand-held layer. */
  function camAt(t0: number, t1: number, t2: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const push = kk(t0, -0.2, 1.1, E.out3), arc = kk(t0, 1, 5.1), punch = kk(t0, LIFT - 0.1, LIFT + 1.1, E.outBack), near = kk(t0, 6.3, 8.2)
    const tr = kk(t1, 0.35, 4.3), out = kk(t1, 0.2, 3.6), settle = kk(t1, 3.6, 7.6)
    const tr2 = kk(t2, 0, 1.7), pull = kk(t2, 1.5, 4.3, E.io3), drift = clamp((t2 - 4.3) / 3.4)
    const x = 0.34 + 0.1 * push + 0.14 * arc - 0.36 * punch + 4.73 * tr + 2.5 * tr2 + 0.55 * pull + 0.06 * drift
    const y = 0.08 - 0.05 * push + 0.03 * punch + 0.2 * out - 0.14 * tr2 + 0.2 * pull
    // (held back while the hand is on the rock, so it is a third of the frame; in on the negative once it has gone)
    const z = 1.4 - 0.48 * push - 0.05 * arc - 0.25 * punch - 0.06 * near + 1.78 * out - 0.08 * settle - 0.9 * tr2 + 2.05 * pull + 0.2 * drift
    pos.set(x, y, z)
    // look a little ahead while moving along the wall
    const lead = 0.34 * Math.sin(Math.PI * tr) + 0.3 * Math.sin(Math.PI * tr2)
    look.set(0.0 + 0.09 * push - 0.02 * punch + 4.86 * tr + 2.55 * tr2 + 0.72 * pull + lead, 0.03 + 0.02 * punch + 0.265 * out - 0.2 * tr2 + 0.06 * pull, 0)
  }
  /** Where the flame is (the head of the brand). */
  function torchAt(t0: number, t1: number, t2: number, time: number, out: THREE.Vector3) {
    camAt(t0, t1, t2, tmpA, tmpB)
    // the hand-off: from beside the lens, thrust at the rock, drawn back
    const thrust = E.in2(clamp((t0 + PRE + 0.1) / (PRE + 0.1)))
    const back = kk(t0, 0, 0.9, E.out3), near = kk(t0, 6.3, 7.8)
    out.set(tmpA.x - 0.36, tmpA.y - 0.1, tmpA.z - 0.5).lerp(tmpC.set(-0.3, 0.05, 0.13), thrust)
    out.x += -0.2 * back + 0.16 * near
    out.y += 0.04 * back + 0.05 * near
    out.z += 0.06 * back - 0.03 * near
    // beat 2: carried past the lens, then ahead of it along the wall
    const cross = kk(t1, 0, 1.0), lift = kk(t1, 4.4, 7.4)
    if (t1 > 0) {
      const u = cross
      // (it leads until the story panel, where the bearer stops short and the lens walks on past)
      const stop = kk(t1, 2.3, 4.3)
      const p1x = tmpA.x - 0.05, lx = mix(tmpA.x + 0.3 + 0.3 * kk(t1, 0.6, 2.4), STORY[0] - 0.72 + 0.16 * lift, stop)
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u
      out.set(a * out.x + b * p1x + c * lx, a * out.y + b * -0.1 + c * (0.08 - 0.1 * stop + 0.3 * lift), a * out.z + b * (tmpA.z - 0.16) + c * (0.42 + 0.48 * stop))
    }
    if (t2 > 0) {
      const lead = kk(t2, 0, 1.1), walk = kk(t2, 1.5, 4.4), drift = clamp((t2 - 4.3) / 3.4)
      // the bearer sets off again, passes the lens, and walks on into the panel
      tmpC.set(tmpA.x + 0.7, 0.1, 0.45)
      out.lerp(tmpC, lead)
      out.lerp(tmpC.set(PANEL[0] - 0.5 + 0.12 * drift, 0.0, 0.72), walk)
    }
    // a hand holds it: it is never still
    out.x += 0.012 * Math.sin(time * 1.7) + 0.006 * Math.sin(time * 4.3 + 1)
    out.y += 0.014 * Math.sin(time * 1.31 + 2) + 0.005 * Math.sin(time * 5.1)
    out.z += 0.01 * Math.sin(time * 1.13 + 4)
    return out
  }

  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    // the breaths, at the tube's mouth
    ...PUFF_T.map((t, i): Cue => ({ b: 0, at: t, s: "hiss", o: { dur: PUFF_D + 0.1, g: 0.42 + 0.05 * (i % 2), f: 2600 + i * 180 }, pos: () => listenerPos(tipW[i], camera, 0.8) })),
    { b: 0, at: 0.02, s: "crackle", o: { g: 0.6, dur: 0.5 }, pos: [-0.7, 0, 0.3] },
    { b: 0, at: 2.2, s: "glass", o: { f: H(56), g: 0.1, wet: 2.5 }, pos: [0.8, -0.3, 1.6] },
    { b: 0, at: LIFT + 0.05, s: "scratch", o: { f: 300, g: 0.14, dur: 0.25 }, pos: [0.1, 0, 0.4] },
    { b: 0, at: LIFT + 1.0, s: "pad", o: { f: H(4), g: 0.3, dur: 3.2 } },
    { b: 0, at: 6.9, s: "glass", o: { f: H(44), g: 0.09, wet: 2.5 }, pos: [-0.9, -0.2, 1.8] },
    // the torch passes the lens; footsteps on gravel
    { b: 1, at: 0.25, s: "whoosh", o: { f: 210, dur: 0.9, g: 0.4 }, pos: [0, 0, -0.1] },
    { b: 1, at: 0.4, s: "crackle", o: { g: 0.7, dur: 0.5 }, pos: [0.1, 0, -0.1] },
    ...Array.from({ length: 8 }, (_, i): Cue[] => [
      { b: 1, at: 0.5 + i * 0.5, s: "scratch", o: { f: 190 + (i % 3) * 30, g: 0.2, dur: 0.14 }, pos: [i % 2 ? 0.35 : -0.25, -0.8, 0.15] },
      { b: 1, at: 0.52 + i * 0.5, s: "thud", o: { f: 62, g: 0.16 }, pos: [i % 2 ? 0.35 : -0.25, -0.8, 0.15] },
    ]).flat(),
    { b: 1, at: 2.6, s: "glass", o: { f: H(60), g: 0.08, wet: 2.5 }, pos: [-0.8, 0.2, 1.7] },
    { b: 1, at: 3.8, s: "pad", o: { f: H(6), g: 0.32, dur: 3.5 } },
    { b: 1, at: 5.6, s: "glass", o: { f: H(40), g: 0.08, wet: 2.5 }, pos: [0.7, -0.4, 1.9] },
    // the bearer walks on into the panel; the box; the question
    ...Array.from({ length: 7 }, (_, i): Cue[] => [
      { b: 2, at: 0.3 + i * 0.52, s: "scratch", o: { f: 200 + (i % 3) * 25, g: 0.17 - i * 0.012, dur: 0.14 }, pos: [0.3 + i * 0.05, -0.7, 0.3 + i * 0.12] },
      { b: 2, at: 0.32 + i * 0.52, s: "thud", o: { f: 60, g: 0.13 - i * 0.01 }, pos: [0.3 + i * 0.05, -0.7, 0.3 + i * 0.12] },
    ]).flat(),
    { b: 2, at: 2.0, s: "pad", o: { f: H(5), g: 0.3, dur: 4 } },
    { b: 2, at: SEL_T, s: "select" },
    ...typeCues(2, SAY_T + 0.25, SAY_T + 0.25 + SAY.length / 9, SAY.length, "type"),
    { b: 2, at: 5.4, s: "glass", o: { f: H(52), g: 0.08, wet: 2.5 }, pos: [-0.6, 0.1, 1.9] },
  ]

  const POST: PostOpts = { tone: "aces", exposure: 1.1, bloom: 0.5, bloomThresh: 1.0, bloomRadius: 1, halation: 0.5, vignette: 0.3, ca: 0.0009, sat: 1.04, contrast: 1.07, grain: 0.03, lift: [0.004, 0.006, 0.011], gain: [1.02, 1.0, 0.97] }
  const HUD = { color: "#f4e7d3", shadow: "rgba(0,0,0,0.7)" }
  const TITLES = { color: "#fbf1e2", shadow: "rgba(8,4,2,0.85)", delay: [0.55, 0.35, 0.35] }
  let lastPop = -1

  let lastS: State | null = null
  function update(s: State) {
    lastS = s
    const t0 = s.at(0), t1 = s.at(1), t2 = s.at(2)
    camera.aspect = s.w / s.h
    camera.updateProjectionMatrix()

    // ---- the lens: on a shoulder, with the walker's bob on the track
    camAt(t0, t1, t2, V.cam, V.look)
    const walking = kk(t1, 0.3, 0.9) * (1 - kk(t1, 3.9, 4.6)) + kk(t2, 0, 0.3) * (1 - kk(t2, 1.3, 1.9))
    const sh = shake(s.time, 1, 0.22)
    const step = Math.abs(Math.sin(Math.PI * (s.time / 0.5)))
    // the thrust lands: the lens flinches
    const jolt = t0 > 0 ? Math.exp(-t0 * 7) * Math.sin(t0 * 46) * 0.012 : 0
    camera.position.set(V.cam.x + sh[0] * 0.006 + s.mouse.x * 0.02, V.cam.y + sh[1] * 0.006 + 0.014 * step * walking + jolt + s.mouse.y * 0.012, V.cam.z + sh[2] * 0.005 + jolt * 0.6)
    camera.lookAt(V.look.x + sh[1] * 0.004, V.look.y + sh[0] * 0.004 - 0.012 * step * walking, V.look.z)
    camera.rotateZ(sh[2] * 0.004 + 0.006 * Math.sin(s.time * 0.5) * walking)
    camera.updateMatrixWorld()
    // focus: on the rock where the lens is looking
    DF.uFocus.value = V.look.distanceTo(camera.position)
    const e = camera.matrixWorld.elements
    uRight.value.set(e[0], e[1], e[2])
    uUp.value.set(e[4], e[5], e[6])

    // ---- the flame
    torchAt(t0, t1, t2, s.time, V.torch)
    const dtp = 0.04
    torchAt(t0 - dtp, t1 > 0 ? t1 - dtp : t1, t2 > 0 ? t2 - dtp : t2, s.time - dtp, V.torchPrev)
    V.lean.copy(V.torchPrev).sub(V.torch).multiplyScalar(1.4)
    if (V.lean.length() > 0.17) V.lean.setLength(0.17)
    V.lean.x += 0.012 * Math.sin(s.time * 0.9)
    const tt = s.time
    V.flick = 1 + 0.09 * Math.sin(tt * 11.3) + 0.06 * Math.sin(tt * 17.9 + 1) + 0.045 * Math.sin(tt * 31.7 + 2) + 0.11 * (mix(hash1(Math.floor(tt * 13)), hash1(Math.floor(tt * 13) + 1), tt * 13 - Math.floor(tt * 13)) - 0.5)
    // the thrust: the fire flares as it is pushed at the rock, and throws sparks
    const flare = t0 > -0.3 && s.beat === 0 ? Math.exp(-Math.max(t0, 0) * 3.2) * clamp((t0 + 0.3) / 0.3) : 0
    V.burst = flare
    V.power = 1 + 0.35 * flare
    // thrust: the stick points back at the carrier beside the lens; held: it hangs from a raised fist
    const th = 1 - kk(t0, -0.1, 1.0)
    V.handle.set(0.25 + 0.2 * th, -1 + 0.45 * th, 0.45 + 0.6 * th).normalize()
    brand.set(V.torch, V.handle, V.lean, camera, s.time, V.power, V.burst)
    W.uTorch.value.copy(brand.light)
    W.uTorch.value.x += 0.007 * Math.sin(tt * 23.1)
    W.uTorch.value.y += 0.01 * Math.sin(tt * 19.3 + 1) + 0.006 * Math.sin(tt * 41 + 2)
    const wide = kk(t2, 1.5, 4.3)
    const I = (0.2 - 0.03 * kk(t1, 0.2, 1.4) + 0.43 * kk(t1, 2.3, 4.3) - 0.28 * kk(t2, 0, 1.2) + 0.42 * wide) * V.flick * V.power
    // before the thrust the cave is night: the brand is beside the lens and its light has not reached the rock
    // (the brand is still beside the lens: its light rakes the near rock and the hand already on it; the lens is open wide for the dark)
    const lit = s.beat === 0 && t0 < 0 ? 0.45 + 0.55 * E.in3(clamp((t0 + 0.45) / 0.45)) : 1
    const dark = s.beat === 0 && t0 < 0 ? clamp(-t0 / 0.5) : 0
    W.uTorchCol.value.set(1.0 * I * lit, 0.6 * I * lit, 0.27 * I * lit)
    W.uFill.value.set(0.011, 0.014, 0.021).multiplyScalar(1 + 0.8 * wide)
    W.uT.value = s.time
    V.expo = (1.05 + 0.12 * kk(t1, 0.2, 1.4) + 0.1 * wide) * (1 + 1.6 * dark)

    // ---- the breaths
    let sprayed = 0
    for (let i = 0; i < PUFF_T.length; i++) {
      const a = kk(t0, PUFF_T[i] + 0.1, PUFF_T[i] + PUFF_D + 0.25, E.out2)
      const dry = kk(t0, PUFF_T[i] + 1.2, PUFF_T[i] + 4.6, E.io2)
      ;(W.uPuff.array[i] as THREE.Vector4).set(a, 1 - 0.94 * dry, 0, 0)
      sprayed += a / PUFF_T.length
    }
    W.uSpray.value = sprayed
    W.uClock.value = t0
    spray.visible = t0 > PUFF_T[0] - 0.1 && t0 < PUFF_T[PUFF_T.length - 1] + PUFF_D + 1.6

    // ---- the tube: slides in along its own line, aims breath by breath, leaves
    const tin = kk(t0, 0.45, 0.95, E.out3) * (1 - kk(t0, 5.0, 5.5, E.in2))
    tube.visible = tin > 0.001 && s.beat === 0
    if (tube.visible) {
      // between breaths it travels to the next aim
      let fi = 0
      for (let i = 0; i + 1 < PUFF_T.length; i++) fi += kk(t0, PUFF_T[i] + PUFF_D, PUFF_T[i + 1] - 0.02)
      const i0 = Math.min(PUFF_T.length - 1, Math.floor(fi)), i1 = Math.min(PUFF_T.length - 1, i0 + 1), f = fi - i0
      tmpA.copy(tipW[i0]).lerp(tipW[i1], f)
      tmpB.set(mix(aimW[i0][0], aimW[i1][0], f), mix(aimW[i0][1], aimW[i1][1], f), 0)
      tmpC.copy(tmpA).sub(tmpB).normalize() // from the rock back toward the blower
      // the breath kicks it a millimetre
      let kick = 0
      for (const pt of PUFF_T) kick += Math.exp(-Math.max(t0 - pt, 0) * 9) * (t0 > pt ? 1 : 0)
      tube.position.copy(tmpA).addScaledVector(tmpC, (1 - tin) * 0.5 + 0.004 * kick)
      tube.quaternion.setFromUnitVectors(tmpB.set(0, -1, 0), tmpC)
    }

    // ---- the blower's hand on it, a third of the way down, steering
    herdR.group.visible = tube.visible
    if (herdR.group.visible) {
      hsR.time = s.time
      tmpB.set(0, -1, 0).applyQuaternion(tube.quaternion) // toward the blower
      tmpA.copy(tube.position).addScaledVector(tmpB, GRIP_AT)
      placeR(tmpA, tmpB.negate(), tmpC.set(0.35, 0.55, 0.75).normalize())
      herdR.update(camera, fillR)
    }
    shHandR.visible = herdR.group.visible
    shTube.visible = tube.visible
    shTube.position.copy(tube.position)
    shTube.quaternion.copy(tube.quaternion)

    // ---- the hand
    const away = kk(t0, LIFT + 0.3, LIFT + 1.25, E.in2)
    V.handOn = s.beat === 0 && away < 0.999
    W.uHandOn.value = V.handOn ? 1 - kk(t0, LIFT + 0.9, LIFT + 1.25) : 0
    hs.time = s.time
    if (V.handOn) {
      const peel = kk(t0, LIFT, LIFT + 0.55)
      const relax = kk(t0, LIFT + 0.15, LIFT + 1.0)
      // it flinches at the first breath, the fingers work a little under the cold spray, the weight shifts from heel to pads and back
      const flinch = Math.exp(-Math.max(t0 - PUFF_T[0], 0) * 6) * (t0 > PUFF_T[0] ? 1 : 0)
      const shift = Math.sin(s.time * 0.9) * 0.6 + Math.sin(s.time * 2.3 + 1) * 0.4
      poseHand(peel + 0.025 * (shift + 1) * (1 - peel), away, relax + 0.04 * (0.5 + 0.5 * Math.sin(s.time * 1.9)), BEND - 0.4 * away - 0.25 * peel + 0.03 * shift, Math.sin(s.time * 31), flinch * 0.6 + 0.25 * Math.sin(s.time * 0.8))
    }
    herd.group.visible = V.handOn
    if (herd.group.visible) {
      herd.update(camera, fill)
      // the flame's view of it: aimed at the knuckles, wide enough for the forearm
      shCam.position.copy(W.uTorch.value)
      shCam.lookAt(tmpA.set(0.06, 0, 0).applyQuaternion(qHand).add(wrist))
      shCam.updateMatrixWorld()
      W.uShVP.value.multiplyMatrices(shCam.projectionMatrix, shCam.matrixWorldInverse)
    }
    shHand.visible = herd.group.visible

    // ---- the rule of ages, in the flame's light
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    placeRule(rule, camera, { dist: 3 })
    // (the flame may be beside the lens or far along the wall: keep its light raking the bar from above, and never let the bar sink)
    tmpA.copy(W.uTorch.value).sub(rule.position)
    const rd = tmpA.length()
    tmpA.normalize().applyQuaternion(qT.copy(camera.quaternion).invert())
    tmpA.y = Math.max(tmpA.y, 0.45)
    tmpA.z = Math.max(tmpA.z, 0.35)
    tmpA.normalize().applyQuaternion(camera.quaternion)
    steel.u.lightDir.value.copy(tmpA)
    const rI = clamp(1.5 / (0.5 + rd * 0.5), 0.75, 1.6) * V.flick
    steel.u.lightCol.value.set(1.25 * rI, 0.86 * rI, 0.5 * rI)
    steel.u.ambient.value.set(0.2, 0.17, 0.14)

    // ---- the selection box rides the hand
    if (s.beat === 2) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const [dx, dy] of [[-0.12, -0.04], [0.11, -0.04], [0.11, 0.22], [-0.12, 0.22]]) {
        tmpA.set(SEL.x + dx, SEL.y + dy, 0.02).project(camera)
        const px = (tmpA.x * 0.5 + 0.5) * DW, py = (1 - (tmpA.y * 0.5 + 0.5)) * DH
        x0 = Math.min(x0, px)
        x1 = Math.max(x1, px)
        y0 = Math.min(y0, py)
        y1 = Math.max(y1, py)
      }
      // (held to whole pixels pairs, so the type layer is not repainted for every tremor of the lens)
      V.sel[0] = Math.round(x0 / 3) * 3
      V.sel[1] = Math.round(y0 / 3) * 3
      V.sel[2] = Math.round((x1 - x0) / 3) * 3
      V.sel[3] = Math.round((y1 - y0) / 3) * 3
    }

    if (s.live) {
      // the fire is a bed that follows how near the flame is, and pops where the flame is
      const dist = brand.light.distanceTo(camera.position)
      const near = clamp(1.1 / (0.4 + dist))
      ctx.synth.bed("fire", 0.25 + 0.6 * near)
      ctx.synth.bed("crackle", 0.2 + 0.55 * near)
      ctx.synth.bed("air", 0.18)
      const n = Math.floor(s.time / 0.83)
      if (lastPop >= 0 && n > lastPop && s.dt > 0) ctx.synth.play("crackle", { g: 0.22 + 0.2 * near, dur: 0.22, pos: listenerPos(brand.light, camera, 1.2) })
      lastPop = n
    } else lastPop = -1
  }

  return {
    cues,
    update,
    warm: () => [
      { pass: passH, target: bakeH },
      { pass: passN, target: bakeN },
      { scene: shScene, camera: shCam, target: shadowRT },
      { scene: maskScene, camera: maskCam, target: maskRT },
      { scene, camera, target: stage },
      { pass: dof, target: hdrOut },
    ],
    render() {
      const r = ctx.renderer
      if (!baked) {
        passH.render(bakeH)
        passN.render(bakeN)
        baked = true
      }
      if (!masked && lastS) {
        // the hand's mask on the rock, once, from the pressed pose; then this frame's pose again
        poseHand(0, 0, 0, BEND, 0, 0)
        herd.update(bakeCam, fill)
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(maskRT)
        r.render(maskScene, maskCam)
        masked = true
        update(lastS)
      }
      if (V.handOn) {
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(shadowRT)
        r.render(shScene, shCam)
      }
      r.setClearColor(0x030304, 1)
      r.setRenderTarget(stage)
      r.render(scene, camera)
      DU.tS.value = stage.texture
      dof.render(hdrOut)
      POST.exposure = V.expo
      // (the label tool counts flat magenta: glow from the bar beside a plate is not occlusion)
      POST.bloom = ctx.debugLabels ? 0 : 0.5 + 0.25 * V.burst
      if (ctx.debugLabels) POST.ca = POST.halation = 0
      ctx.finish(hdrOut.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 2) {
        const on = s.k(2, SEL_T, SEL_T + 0.25, E.lin)
        if (on > 0) {
          const pop = mix(1.6, 1, E.outBack(s.k(2, SEL_T, SEL_T + 0.36, E.lin)))
          const w = V.sel[2] * pop, h = V.sel[3] * pop
          const cx = V.sel[0] + V.sel[2] / 2, cy = V.sel[1] + V.sel[3] / 2
          g.selbox(cx - w / 2, cy - h / 2, w, h, on, SELECT)
          comment(g, SAY, cx + w / 2 - 14, cy - h / 2 - 8, s.t, { t0: SAY_T, cps: 9, w: 240 })
        }
      }
    },
    hud: () => HUD,
    labels: () => ruleLabels(face),
    dispose() {
      face.dispose()
      brand.dispose()
      disposeTree(scene)
      white.dispose()
      white2.dispose()
      white3.dispose()
      herdR.dispose()
      herd.dispose()
      passH.dispose()
      passN.dispose()
      dof.dispose()
      maskMat.dispose()
      for (const t of texs) t.dispose()
    },
  }
}
