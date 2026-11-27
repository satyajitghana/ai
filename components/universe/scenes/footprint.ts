// Scene 20, footprint: "Off the ground". Flight on film, faster and faster, then one still photograph.
//
// Staging. Beat 0: a locked lens on a projector gate. A 35 mm strip runs down through it: four
// perforations a frame, black frame lines, clear key marks on the edge, steel runners, a lamp behind
// the aperture so only the frame in the gate is lit through. Its frames are small drawn worlds, shot
// on black-and-white stock: the 1903 Flyer a few feet over the sand, the Trinity fireball growing
// frame by frame as t^(2/5), Sputnik over the Earth's limb, a launch. The frame rate climbs from 2 a
// second (each pulldown a visible jerk, the shutter darkening the gate) to 40, a blur, with grain, weave,
// a running scratch, dust and changeover cue dots. Beat 1: it stops dead on a frame of grey ground
// with the 5 x 5 reseau crosses of a surface Hasselblad frame, and the lens goes through the gate into
// colour: Aldrin's bootprint in the regolith in hard, low sunlight. Then a slow tilt that widens as
// it rises, past the horizon into a black sky with no stars, to a small blue Earth almost 60 degrees up.
//
// Story parameter. `fps` (the frame in the gate is the closed-form integral of a rising rate over
// beat 0's clock), then `still`.
// World rule. Beat 0, `gateLit`: one lamp behind the aperture; the shutter dims it during each
// pulldown. Beat 1, `sunLit`: one sun 15 degrees up behind the lens, no sky light, shadows marched
// against the heightfield with the sun's own half-degree penumbra, regolith by Lommel-Seeliger with
// an opposition surge; the Earth's phase from the same sun vector.
// Beat sheet and sources: R/beats/footprint.md.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalize, normalWorld, pow, sin, sqrt, step, texture, uniform, uniformTexture, uv as uvAttr, vec2, vec3, vec4, Discard } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, smooth } from "../engine/ease"
import { disposeTree, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, hash22, luma, sampleRT, vnoise, voronoi, type F, type V2, type V3 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { edgeMarks, FILM, filmGrain, frameOf, imageMask, perfSD, scratch, SPLICE_DUR, SPLICE_IN, sstep } from "../transitions/splice"

const START = SPLICE_DUR * (1 - SPLICE_IN)

// ---------------------------------------------------------------- the film's clock

const R0 = 2.0 // frames a second at the start
const TAU = 2.7 // seconds per e-fold of the rate
const RMAX = 24 // a projector's own speed: a held beat keeps running at it instead of washing into a blur
const T_CAP = TAU * Math.log(RMAX / R0)
const N_CAP = R0 * TAU * (Math.exp(T_CAP / TAU) - 1)
/** Frames through the gate after t seconds of beat 0: the integral of the rate. */
const framesAt = (t: number) => (t < 0 ? R0 * t : t < T_CAP ? R0 * TAU * (Math.exp(t / TAU) - 1) : N_CAP + RMAX * (t - T_CAP))
const rateAt = (t: number) => (t < 0 ? R0 : Math.min(RMAX, R0 * Math.exp(t / TAU)))
/** When frame n entered the gate (n >= 0, before the cap). */
const timeOf = (n: number) => TAU * Math.log(1 + n / (R0 * TAU))
/** The shots, by frame: 1903 to 2.6 s, 1945 to 4.0 s, 1957 to 5.0 s, 1961 to 5.9 s, then all of them at once. */
const SHOT_T = [0, 2.6, 4.0, 5.0, 5.9]
const SHOT_N = SHOT_T.map((t) => Math.round(framesAt(t)))
const N_STOP = 4000
const WRAP = 600 // frames: past here a hold wraps the flurry // the frame the film stops on (beat 1): grey ground
const CUES_AT = [Math.round(framesAt(5.35)), Math.round(framesAt(6.3))] // changeover cue dots: four frames each

/** Where the strip is in the gate, in frames: intermittent at low rates (the claw pulls it down in the last 30% of each period), continuous once it blurs. */
function gatePos(t: number) {
  const N = framesAt(t)
  const f = N - Math.floor(N)
  const inter = Math.floor(N) + smooth(0.78, 1, f)
  return mix(inter, N, smooth(18, 32, rateAt(t)))
}

// ---------------------------------------------------------------- the Moon: geometry of the stage (metres; the print at the origin)

const SUN = new THREE.Vector3(-0.5 * Math.cos((15 * Math.PI) / 180), Math.sin((15 * Math.PI) / 180), 0.866 * Math.cos((15 * Math.PI) / 180)).normalize()
const EARTH_EL = (58 * Math.PI) / 180, EARTH_AZ = (25 * Math.PI) / 180
const EARTH = new THREE.Vector3(Math.sin(EARTH_AZ) * Math.cos(EARTH_EL), Math.sin(EARTH_EL), -Math.cos(EARTH_AZ) * Math.cos(EARTH_EL))
const EARTH_R = (0.95 * Math.PI) / 180 // angular radius: geometry (6,371 km at 384,400 km), never printed
const CAM = new THREE.Vector3(0.04, 1.05, 0.8)
const MOON_R = 1737400
const PRINT_ROT = 0.22 // the print's heading, radians from -z
const SOLE = { pitch: 0.0185, groove: 0.0042 }

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const r2 = (p: V2, a: number): V2 => vec2(p.x.mul(Math.cos(a)).sub(p.y.mul(Math.sin(a))), p.x.mul(Math.sin(a)).add(p.y.mul(Math.cos(a)))) as V2
const sdRBox = (p: V2, b: [number, number], r: number): F => {
  const d = abs(p).sub(vec2(b[0] - r, b[1] - r))
  return length(max(d, 0)).add(min(max(d.x, d.y), 0)).sub(r) as F
}
const smin = (a: F, b: F, k: number): F => {
  const h = clampN(b.sub(a).div(k).mul(0.5).add(0.5), 0, 1)
  return mixN(b, a, h).sub(h.mul(h.oneMinus()).mul(k)) as F
}

/** The overshoe's sole, signed distance in metres; q: x across (right), y along (toe +). */
const soleSD = Fn(([q_]: [V2]) => {
  const q = vec2(q_).toVar()
  // the waist pinches the outline a little
  q.x.mulAssign(float(1).add(exp(q.y.add(0.035).div(0.04).pow(2).negate()).mul(0.06)))
  const heel = sdRBox(q.sub(vec2(0, -0.105)) as V2, [0.049, 0.055], 0.034)
  const fore = sdRBox(q.sub(vec2(0.004, 0.045)) as V2, [0.058, 0.105], 0.04)
  return smin(heel, fore, 0.03)
}).setLayout({ name: "soleSD", type: "float", inputs: [{ name: "q", type: "vec2" }] })

/** Height (m) of one print in local coordinates: the floor with the bars as grooves, near-vertical walls, a cracked rim. `fresh` 1 for Aldrin's, less for an older scuffed one. */
const printH = Fn(([q, fresh, full, px]: [V2, F, F, F]) => {
  const d = soleSD(q).toVar()
  const h = float(0).toVar()
  If(d.lessThan(0.045), () => {
    // the floor: deeper under the heel and the ball, compacted smooth
    const floorH = float(-0.017).sub(exp(q.y.add(0.1).div(0.05).pow(2).negate()).mul(0.006)).sub(exp(q.y.sub(0.055).div(0.05).pow(2).negate()).mul(0.004))
    // the sole's straight bars pressed in as grooves, edge to edge
    const a = abs(fract(q.y.div(SOLE.pitch)).sub(0.5)).mul(SOLE.pitch)
    const bar = sstep(SOLE.groove + 0.0007, SOLE.groove - 0.0007, a).mul(0.0055).mul(sstep(0.0045, 0.0025, px))
    const fl0 = floorH.sub(bar.mul(fresh)).mul(fresh.mul(0.45).add(0.55))
    // the wall: dry angular grains interlock and hold it nearly vertical
    const wall = sstep(px.negate().sub(0.0024), px.add(0.0006), d.add(fresh.oneMinus().mul(-0.004))).toVar()
    // the rim: soil pushed up and out, broken into crust plates
    const plate = float(0).toVar()
    If(full.greaterThan(0.5).and(d.greaterThan(0)).and(d.lessThan(0.03)), () => {
      const vor = voronoi(q.mul(85).add(7.3))
      plate.assign(hash21(vor.yz).sub(0.5).mul(0.003).mul(sstep(0.03, 0.002, d)))
    })
    const berm = sstep(0, 0.0035, d).mul(exp(d.mul(-1).div(0.011))).mul(0.0048).mul(float(1).add(q.y.mul(3).max(0)))
    h.assign(mixN(fl0, berm.add(plate).mul(fresh.mul(0.6).add(0.4)), wall))
  })
  return h
}).setLayout({ name: "printH", type: "float", inputs: [{ name: "q", type: "vec2" }, { name: "fresh", type: "float" }, { name: "full", type: "float" }, { name: "px", type: "float" }] })

/** Craters in cells of size S (one per cell at most, never across a cell's edge). */
const craters = (p: V2, S: number, density: number, keep: F): F => {
  const c = floor(p.div(S))
  const h = hash22(c.add(S * 1.37))
  const h2 = hash22(c.add(19.1 + S))
  const R = h.y.mul(0.24).add(0.1).mul(S)
  const ctr = c.add(h2.mul(0.5).add(0.25)).mul(S)
  const x = length(p.sub(ctr)).div(R)
  const inner = x.mul(x).sub(1).mul(R.mul(0.19)).add(R.mul(0.04))
  const outer = exp(x.sub(1).mul(-3.2)).mul(R.mul(0.04))
  return mixN(inner, outer, step(1, x)).mul(step(h.x, density)).mul(keep) as F
}

/** The Moon's ground in metres: undulation, craters at four scales, Aldrin's print, a line of older prints. Without `detail`, what casts shadows. */
const groundH = Fn(([p, full, px]: [V2, F, F]) => {
  const r0 = length(p)
  const near = sstep(2.2, 3.6, r0)
  const h = vnoise(p.mul(0.035)).sub(0.5).mul(0.45).add(vnoise(p.mul(0.11).add(5)).sub(0.5).mul(0.14)).add(vnoise(p.mul(0.4).add(3)).sub(0.5).mul(0.05)).mul(sstep(2.5, 12, r0)).toVar()
  h.addAssign(craters(p, 0.7, 0.35, near))
  h.addAssign(craters(p, 4.5, 0.45, sstep(5, 9, r0)))
  h.addAssign(craters(p.add(vec2(11, 3)), 28, 0.55, sstep(30, 60, r0)))
  h.addAssign(craters(p.add(vec2(40, 70)), 190, 0.5, sstep(150, 300, r0)))
  // Aldrin's print
  h.addAssign(printH(r2(p, PRINT_ROT).mul(vec2(-1, -1)) as V2, float(1), full, px))
  // the older line of prints across the middle distance: step 0.72 m, left and right of a line
  const A = vec2(-3.4, -1.3), d = normalize(vec2(1, -0.42)), n = vec2(d.y.negate(), d.x)
  const ql0 = p.sub(A)
  If(abs(dot(ql0, n)).lessThan(0.4).and(r0.lessThan(30)), () => {
    const s = dot(ql0, d)
    const k = clampN(floor(s.div(0.72).add(0.5)), 0, 11)
    const side = fract(k.mul(0.5)).mul(4).sub(1)
    const o = A.add(d.mul(k.mul(0.72))).add(n.mul(side.mul(0.11)))
    const ql = p.sub(o)
    const q = vec2(dot(ql, n), dot(ql, d))
    h.addAssign(printH(q as V2, float(0.55), float(0), px))
  })
  return h
}).setLayout({ name: "groundH", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "full", type: "float" }, { name: "px", type: "float" }] })

/** What casts the shadows the march can see (it reaches 24 cm toward the sun): Aldrin's print, the clods, the smallest craters. */
const castH = Fn(([p]: [V2]) => {
  return printH(r2(p, PRINT_ROT).mul(vec2(-1, -1)) as V2, float(1), float(0), float(0)).add(clodH(p)).add(craters(p, 0.7, 0.35, sstep(2.2, 3.6, length(p))))
}).setLayout({ name: "castH", type: "float", inputs: [{ name: "p", type: "vec2" }] })

/** What the regolith adds at the scale of grains and clasts (for normals; fades with the footprint `px`, metres per pixel). */
const detailH = Fn(([p, px]: [V2, F]) => {
  const h = float(0).toVar()
  If(px.lessThan(0.02), () => {
  // clumpy dust, two octaves of it
  h.addAssign(vnoise(p.mul(60)).sub(0.5).mul(0.0018).mul(sstep(0.005, 0.002, px)))
  h.addAssign(vnoise(p.mul(230).add(3.1)).sub(0.5).mul(0.0006).mul(sstep(0.003, 0.0012, px)))
  // angular clasts, centimetres, half buried, flat-faceted
  // (one per cell at most, kept inside its cell, so no neighbours are searched)
  const g = p.mul(24)
  const cell = floor(g)
  const hh = hash22(cell.add(5.5))
  const h3 = hash22(cell.add(17.2))
  const rc = hh.x.mul(0.22).add(0.1)
  const lc = g.sub(cell).sub(h3.mul(0.4).add(0.3))
  const cone = max(rc.sub(length(lc.mul(vec2(1, h3.y.mul(0.6).add(0.7))))), 0).mul(0.042)
  const facet = dot(lc, normalize(hh.sub(0.5).add(0.001))).mul(0.007).add(rc.mul(0.014))
  h.addAssign(min(cone, max(facet, 0)).mul(step(hh.y, 0.07)).mul(sstep(0.004, 0.0018, px)))
  h.addAssign(vnoise(p.mul(95).add(4.4)).sub(0.5).mul(0.0008).mul(sstep(0.006, 0.002, px)))
  })
  return h
}).setLayout({ name: "detailH", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "px", type: "float" }] })

/** Clods: the dust is lumpy at a few centimetres. Cheap enough to cast shadows with. */
const clodH = (p: V2, px: Num = 0): F => vnoise(p.mul(22).add(9.1)).sub(0.5).mul(0.0024).mul(sstep(0.012, 0.005, fl(px))).add(vnoise(p.mul(7).add(2.3)).sub(0.5).mul(0.003).mul(sstep(0.04, 0.015, fl(px)))) as F

// ---------------------------------------------------------------- the frames: small worlds on black-and-white stock

/** Millimetres of strip the lens sees top to bottom in beat 0. */
const VIS = 20.5
const AT_W = 768, AT_H = 432, ROWS = 5

/** Distance-based ink with a pixel of antialiasing in frame units. */
const ink = (d: F, w: Num, px: F): F => sstep(fl(w).add(px), fl(w).sub(px), d) as F
const seg = (p: V2, a: V2, b: V2): F => {
  const pa = p.sub(a), ba = b.sub(a)
  const h = clampN(dot(pa, ba).div(dot(ba, ba)), 0, 1)
  return length(pa.sub(ba.mul(h))) as F
}

/** A standing man in a coat and cap, signed distance; p from between his feet, in units of his height. */
const sdMan = (p: V2): F => {
  const cap = (a: [number, number], b: [number, number], r: number): F => seg(p, vec2(a[0], a[1]), vec2(b[0], b[1])).sub(r) as F
  let d: F = cap([-0.075, 0.0], [-0.025, 0.46], 0.04)
  const add = (e: F) => (d = min(d, e) as F)
  add(cap([0.1, 0.01], [0.035, 0.46], 0.04))
  add(cap([-0.1, 0.0], [-0.05, 0.0], 0.03)) // boots
  add(cap([0.08, 0.01], [0.135, 0.01], 0.03))
  add(cap([0.0, 0.47], [0.02, 0.79], 0.085)) // the body, in a jacket
  add(cap([-0.04, 0.5], [0.06, 0.5], 0.075)) // its skirt at the hips
  add(cap([-0.06, 0.77], [-0.15, 0.6], 0.032)) // arms a little out, as he watched it go
  add(cap([-0.15, 0.6], [-0.13, 0.47], 0.028))
  add(cap([0.09, 0.77], [0.19, 0.62], 0.032))
  add(cap([0.19, 0.62], [0.24, 0.55], 0.028))
  add(length(p.sub(vec2(0.025, 0.885))).sub(0.06) as F) // head
  add(sdRBox(p.sub(vec2(0.045, 0.94)) as V2, [0.075, 0.016], 0.008)) // the cap and its peak
  return d
}

/** Period lenses: the corners fall off, the frame's density wanders a little from frame to frame. */
const periodLook = (lum: F, q: V2, n: F): F => {
  const v = q.sub(vec2(0.889, 0.5)).mul(vec2(0.62, 1))
  const fall = float(1).sub(dot(v, v).mul(0.95)).clamp(0.25, 1)
  return lum.mul(fall).mul(hash21(vec2(n, 1.3)).sub(0.5).mul(0.08).add(1)) as F
}

/** 1903: the Flyer a few feet over the sand, flying left to right, its pusher propellers a blur. */
const shotFlyer = (q: V2, lt: F, px: F): F => {
  const hz = float(0.33)
  const c = vec3(0).toVar()
  const sky = mixN(float(0.86), float(0.64), q.y).add(fbm(q.mul(vec2(2.2, 7)).add(vec2(lt.mul(0.004), 0))).sub(0.5).mul(0.1))
  const dune = hz.add(exp(q.x.sub(0.32).div(0.24).pow(2).negate()).mul(0.075)).add(exp(q.x.sub(1.5).div(0.4).pow(2).negate()).mul(0.02))
  const sand = float(0.74).sub(hz.sub(q.y).mul(0.5)).add(fbm(q.mul(vec2(5, 40))).sub(0.5).mul(0.07)).add(vnoise(q.mul(vec2(90, 300))).sub(0.5).mul(0.04))
  const lum = mixN(sky, mixN(float(0.58), sand, step(q.y, hz)), step(q.y, dune)).toVar()
  // the launching rail along the sand
  lum.assign(mixN(lum, float(0.22), ink(seg(q, vec2(0.05, 0.15), vec2(1.2, 0.27)), 0.0025, px).mul(step(q.y, hz))))
  // the machine
  const P = vec2(lt.mul(0.052).add(0.18), sin(lt.mul(0.55)).mul(0.012).add(0.47))
  const l = q.sub(P).div(1.35).toVar()
  const droop = l.x.div(0.36).pow(2).mul(0.012)
  const span = step(abs(l.x), 0.36)
  const wingU = ink(abs(l.y.sub(0.034).add(droop)), 0.0058, px).mul(span)
  const wingL = ink(abs(l.y.add(0.03).add(droop)), 0.0058, px).mul(span)
  const strutX = abs(fract(l.x.div(0.072).add(0.5)).sub(0.5)).mul(0.072)
  const struts = ink(strutX, 0.0012, px).mul(step(abs(l.y.add(droop).sub(0.002)), 0.032)).mul(span)
  const elev = ink(abs(l.y.sub(0.012)), 0.0035, px).add(ink(abs(l.y.add(0.006)), 0.0035, px)).mul(step(abs(l.x.sub(0.26)), 0.045))
  const booms = ink(seg(l as V2, vec2(0.08, 0.03), vec2(0.22, 0.012)), 0.0012, px).add(ink(seg(l as V2, vec2(0.08, -0.028), vec2(0.22, -0.006)), 0.0012, px))
  const rud = ink(abs(l.x.add(0.31)), 0.003, px).add(ink(abs(l.x.add(0.335)), 0.003, px)).mul(step(abs(l.y.sub(0.004)), 0.036))
  const rboom = ink(seg(l as V2, vec2(-0.1, 0.03), vec2(-0.31, 0.01)), 0.0011, px).add(ink(seg(l as V2, vec2(-0.1, -0.028), vec2(-0.31, -0.01)), 0.0011, px))
  const pilot = ink(length(l.sub(vec2(0.0, -0.02)).mul(vec2(1, 2.4))), 0.012, px)
  const skid = ink(seg(l as V2, vec2(-0.05, -0.052), vec2(0.18, -0.045)), 0.0018, px)
  const sil = clampN(wingU.add(wingL).add(struts).add(elev).add(booms).add(rud).add(rboom).add(pilot).add(skid), 0, 1)
  // two pusher propellers behind the wings, a translucent blur
  const prop = sstep(0.034, 0.028, length(l.sub(vec2(-0.075, 0.002)).mul(vec2(3.2, 1)))).add(sstep(0.034, 0.028, length(l.sub(vec2(0.065, 0.002)).mul(vec2(3.2, 1)))))
  lum.assign(mixN(lum, lum.mul(0.72), clampN(prop, 0, 1)))
  lum.assign(mixN(lum, float(0.17), sil))
  // muslin: the wings' undersides catch the sky between the ribs
  const ribs = sstep(0.3, 0.5, abs(fract(l.x.div(0.018)).sub(0.5)).mul(2))
  lum.assign(mixN(lum, float(0.34), wingU.add(wingL).clamp(0, 1).mul(ribs).mul(0.55)))
  // Wilbur, who had run alongside holding the wing, standing on the sand to the right
  const man = sdMan(q.sub(vec2(1.2, hz.sub(0.105))).div(0.15) as V2).mul(0.15)
  lum.assign(mixN(lum, float(0.1), ink(man as F, 0, px)))
  lum.mulAssign(float(1).sub(sstep(0.03, 0.0, length(q.sub(vec2(1.25, hz.sub(0.107))).mul(vec2(0.5, 6))).sub(0.02)).mul(0.25)))
  // the bench the wing rested on, left behind by the rail
  lum.assign(mixN(lum, float(0.14), ink(seg(q, vec2(0.12, 0.2), vec2(0.2, 0.2)), 0.004, px).add(ink(seg(q, vec2(0.13, 0.2), vec2(0.13, 0.165)), 0.002, px)).add(ink(seg(q, vec2(0.19, 0.2), vec2(0.19, 0.165)), 0.002, px)).clamp(0, 1)))
  // its shadow on the sand
  const sh = sstep(0.06, 0.0, length(q.sub(vec2(P.x.add(0.05), hz.sub(0.13))).mul(vec2(0.55, 5))).sub(0.12))
  lum.mulAssign(sh.mul(-0.3).add(1))
  c.assign(vec3(lum))
  return lum
}

/** 1945: the fireball over the desert before dawn. Its radius grows as t^(2/5) (Taylor's blast wave). */
const shotTrinity = (q: V2, lt: F, px: F): F => {
  const R = pow(lt.add(0.7).div(22), 0.4).mul(0.46)
  const C = vec2(0.92, R.mul(0.62).add(0.21))
  const d = length(q.sub(C).mul(vec2(1, 1.08)))
  const glow = exp(max(d.sub(R), 0).mul(-7)).toVar()
  const ridge = float(0.27).add(fbm(vec2(q.x.mul(3.5), 1.3)).mul(0.08))
  const lum = float(0.03).add(glow.mul(0.55)).toVar()
  // mountains in silhouette, their faces lit by it
  lum.assign(mixN(lum, float(0.02).add(glow.mul(0.18)), step(q.y, ridge)))
  // the plain, lit from the fireball, and its shadows
  const plain = float(0.05).add(exp(abs(q.x.sub(C.x)).mul(-2.6)).mul(0.6).mul(sstep(0.0, 0.21, q.y))).add(fbm(q.mul(vec2(8, 30))).sub(0.5).mul(0.05))
  lum.assign(mixN(lum, plain, step(q.y, 0.205)))
  // the fireball: overexposed, mottled at its edge, a skirt of dust at its foot
  const mott = fbm(q.sub(C).div(R).mul(4).add(lt.mul(0.15)))
  const ball = float(1.45).sub(sstep(0.45, 1.0, d.div(R)).mul(mott).mul(0.75))
  lum.assign(mixN(lum, ball, ink(d, R, px.mul(2))))
  const skirt = sstep(0.05, 0.0, length(q.sub(vec2(C.x, 0.215)).div(vec2(R.mul(1.5), 0.045))).sub(1).mul(0.05))
  lum.assign(mixN(lum, float(0.55).add(fbm(q.mul(30)).mul(0.3)), skirt.mul(0.9)))
  // the skin of the ball: dark convection cells on the overexposed dome, strongest toward its edge
  const cell = voronoi(q.sub(C).div(R).mul(5.5).add(lt.mul(0.05)))
  lum.assign(mixN(lum, lum.mul(0.55), sstep(0.06, 0.0, cell.x.sub(0.02)).mul(sstep(0.3, 0.95, d.div(R))).mul(ink(d, R, px.mul(2)))))
  // the rope tricks: guy wires flashed to vapour, bright spikes below the dome
  for (const [o, w] of [[-0.62, 0.006], [-0.36, 0.004], [0.41, 0.005], [0.7, 0.006]] as [number, number][]) {
    const x = C.x.add(R.mul(o))
    const yTop = C.y.sub(sqrt(max(float(1).sub(o * o), 0.01)).mul(R).mul(0.93))
    const sp = sstep(fl(w).add(px), fl(w).mul(0.3), abs(q.x.sub(x)).add(yTop.sub(q.y).mul(-0.04)).sub(0.002)).mul(step(q.y, yTop)).mul(step(0.2, q.y))
    lum.assign(max(lum, sp.mul(1.2)))
  }
  // creosote bush along the foreground, black against the lit plain
  const bush = float(0.02).add(pow(fbm(vec2(q.x.mul(22), 2.1)), 2.2).mul(0.16)).add(vnoise(vec2(q.x.mul(140), 0.7)).mul(0.012))
  lum.assign(mixN(lum, float(0.015).add(glow.mul(0.03)), sstep(px, px.negate(), q.y.sub(bush))))
  return lum
}

/** 1957: a polished sphere with four whip aerials, over the curve of the Earth. */
const shotSputnik = (q: V2, lt: F, px: F): F => {
  const E0 = vec2(0.5, -2.05)
  const de = length(q.sub(E0)).sub(2.33)
  const lum = float(0.0).toVar()
  const sw = q.add(vec2(fbm(q.mul(6).add(1.1)), fbm(q.mul(6).add(7.7))).sub(0.5).mul(0.12))
  const cloudE = sstep(0.48, 0.7, fbm(sw.mul(vec2(5, 11)).add(3.3))).mul(0.62).add(sstep(0.55, 0.8, fbm(sw.mul(vec2(14, 26)))).mul(0.25))
  const dayE = sstep(0.15, 1.2, q.x) // the terminator: day on the right, the night side going dark to the left
  const earth = float(0.1).add(cloudE).mul(dayE.mul(0.9).add(0.05))
  lum.assign(mixN(lum, earth, ink(de, 0, px)))
  lum.addAssign(exp(abs(de).mul(-90)).mul(0.5).mul(dayE.add(0.1)))
  const C = vec2(lt.mul(-0.006).add(1.18), 0.64)
  const l = q.sub(C).toVar()
  const r = float(0.052)
  const dd = length(l)
  // the aerials: two pairs swept back, turning slowly
  const a0 = lt.mul(0.03).add(2.6)
  const al = float(0).toVar()
  for (const [o, L] of [[0, 0.36], [0.22, 0.36], [0.6, 0.29], [0.83, 0.29]] as [number, number][]) {
    const a = a0.add(o * 0.5)
    al.assign(max(al, ink(seg(l as V2, vec2(cos(a), sin(a)).mul(r), vec2(cos(a), sin(a)).mul(L)), 0.0014, px)))
  }
  lum.assign(mixN(lum, float(0.62), al))
  // the sphere: sunlit from the left, the Earth's light from below, a seam
  const n = vec3(l.div(r), sqrt(max(float(1).sub(dd.div(r).pow(2)), 0)))
  const sun = max(dot(n, normalize(vec3(-0.6, 0.45, 0.66))), 0)
  const spec = pow(max(dot(n, normalize(vec3(-0.3, 0.25, 1))), 0), 40)
  const sph = sun.mul(0.75).add(max(n.y.negate(), 0).mul(0.35)).add(spec.mul(1.2)).add(0.03).mul(float(1).sub(ink(abs(n.y.sub(0.05)), 0.03, px.mul(10)).mul(0.5)))
  lum.assign(mixN(lum, sph, ink(dd, r, px)))
  return lum
}

/** 1961: a launch. A core with four tapered boosters, the service arms falling back, the plume and its cloud. */
const shotLaunch = (q_: V2, lt: F): F => {
  const q = vec2(q_.x.sub(0.89).div(1.45).add(0.89), q_.y.sub(0.2).div(1.45).add(0.2))
  const y0 = lt.mul(lt).mul(0.00035).add(lt.mul(0.002)).add(0.24)
  const lum = mixN(float(0.34), float(0.12), q.y).add(fbm(q.mul(vec2(2, 6))).sub(0.5).mul(0.05)).toVar()
  const X = q.x.sub(0.89)
  // the pad and the ground
  lum.assign(mixN(lum, float(0.05).add(fbm(q.mul(20)).mul(0.05)).add(exp(abs(X).mul(-8)).mul(0.5)), step(q.y, 0.2)))
  // service masts, swinging back as it rises
  const swing = sstep(0, 14, lt).mul(0.5)
  for (const s of [-1, 1]) {
    const base = vec2(0.89 + s * 0.11, 0.2)
    const dir = vec2(sin(swing.mul(s)), cos(swing))
    const along = dot(q.sub(base), dir)
    const across = abs(dot(q.sub(base), vec2(dir.y, dir.x.negate())))
    const truss = step(across, 0.012).mul(step(0, along)).mul(step(along, 0.42)).mul(float(0.4).add(step(0.5, fract(along.mul(70).add(across.mul(70)))).mul(0.6)))
    lum.assign(mixN(lum, float(0.03), truss.mul(0.9)))
  }
  // the rocket
  const ry = q.y.sub(y0)
  const core = step(abs(X), 0.017).mul(step(0, ry)).mul(step(ry, 0.5))
  // the third stage and the Vostok's shroud above the core: a step in, then the long ogive
  const nose = step(abs(X), float(0.015).mul(sat1(float(0.66).sub(ry).div(0.1)))).mul(step(0.5, ry)).mul(step(ry, 0.66))
  const boost = step(abs(X), float(0.04).sub(ry.mul(0.14))).mul(step(0, ry)).mul(step(ry, 0.19))
  const body = clampN(core.add(nose).add(boost), 0, 1)
  const shade = float(0.95).sub(X.add(0.035).mul(13).clamp(0, 1).mul(0.75)).add(sstep(0.1, 0.0, ry).mul(0.4))
  lum.assign(mixN(lum, shade, body))
  // the plume: white-hot under it, and the cloud rolling out over the pad
  const pl = sstep(0.06, 0.0, abs(X).sub(y0.sub(q.y).mul(0.12).add(0.02))).mul(step(q.y, y0)).mul(step(0.19, q.y))
  lum.assign(mixN(lum, float(1.5), pl))
  // shock diamonds in the core of the exhaust, and its glare on the smoke
  const dia = sstep(0.5, 0.0, abs(fract(y0.sub(q.y).div(0.035)).sub(0.5)).mul(2).add(abs(X).mul(60))).mul(step(q.y, y0)).mul(step(y0.sub(0.18), q.y))
  lum.addAssign(dia.mul(0.6))
  // the exhaust driven out of the flame pit to both sides, rolling
  for (const sd of [-1, 1]) {
    const cx = float(sd).mul(lt.mul(0.012).add(0.16))
    const lobe = sstep(0.55, 0.25, length(vec2(X.sub(cx).div(lt.mul(0.012).add(0.13)), q.y.sub(0.22).div(0.075))).sub(fbm(q.mul(11).add(lt.mul(0.04 * sd))).mul(0.55)))
    lum.assign(mixN(lum, float(0.82).sub(fbm(q.mul(18)).mul(0.4)).add(exp(abs(X).mul(-10)).mul(0.3)), lobe.mul(step(0.13, q.y)).mul(0.95)))
  }
  const cloud = sstep(0.62, 0.4, length(vec2(X.div(lt.mul(0.025).add(0.12)), q.y.sub(0.21).div(0.1))).sub(fbm(q.mul(9).add(lt.mul(0.05))).mul(0.6)))
  lum.assign(mixN(lum, float(0.95).sub(fbm(q.mul(14)).mul(0.35)), cloud.mul(step(0.15, q.y))))
  return lum
}

/** Leader: clear base with a cross and a ring (no numbers). */
const shotLeader = (q: V2, px: F): F => {
  const l = q.sub(vec2(0.889, 0.5))
  const ring = ink(abs(length(l).sub(0.32)), 0.004, px).add(ink(abs(length(l).sub(0.4)), 0.004, px))
  const cross1 = ink(abs(l.x), 0.003, px).add(ink(abs(l.y), 0.003, px))
  return float(0.82).sub(clampN(ring.add(cross1), 0, 1).mul(0.7)) as F
}

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const atlas = ctx.target({ hdr: true, fixed: [AT_W, AT_H * ROWS] })

  // ---- the frames, drawn into the atlas: five rows, the frames from two before the gate to two after
  const A = { base: uniform(0), tMoon: uniformTexture(stage.texture), moonOn: uniform(0) }
  const shotOf = (n: F) => {
    // which world frame n shows, and its local clock (frames since that shot began)
    const fl0 = step(SHOT_N[4], n)
    const hsh = hash21(vec2(n, 3.7))
    const flurry = floor(hsh.mul(4))
    const seq = step(SHOT_N[1], n).add(step(SHOT_N[2], n)).add(step(SHOT_N[3], n))
    const id = mixN(seq, flurry, fl0)
    const n0 = mixN(mixN(mixN(float(SHOT_N[0]), float(SHOT_N[1]), step(0.5, seq)), float(SHOT_N[2]), step(1.5, seq)), float(SHOT_N[3]), step(2.5, seq))
    const lt = mixN(n.sub(n0), hash21(vec2(n, 9.1)).mul(14), fl0)
    return { id, lt }
  }
  const atlasPass = ctx.pass(({ uv }) => {
    const row = floor(uv.y.mul(ROWS))
    const fuv = vec2(uv.x, fract(uv.y.mul(ROWS)))
    const n = A.base.add(row).sub(2)
    const q = vec2(fuv.x.mul(16 / 9), fuv.y)
    const px = float(1.2 / AT_H)
    const lum = float(0).toVar()
    const s = shotOf(n)
    If(n.lessThan(0), () => {
      lum.assign(shotLeader(q as V2, px))
    })
      .ElseIf(n.greaterThanEqual(N_STOP + 0.5), () => {
        lum.assign(0.004)
      })
      .ElseIf(n.greaterThanEqual(N_STOP - 0.5).and(A.moonOn.greaterThan(0.5)), () => {
        lum.assign(luma(sampleRT(A.tMoon, fuv as V2).rgb).mul(1.25))
      })
      .ElseIf(s.id.lessThan(0.5), () => {
        lum.assign(shotFlyer(q as V2, s.lt as F, px))
      })
      .ElseIf(s.id.lessThan(1.5), () => {
        lum.assign(shotTrinity(q as V2, s.lt as F, px))
      })
      .ElseIf(s.id.lessThan(2.5), () => {
        lum.assign(shotSputnik(q as V2, s.lt as F, px))
      })
      .Else(() => {
        lum.assign(shotLaunch(q as V2, s.lt as F))
      })
    lum.assign(mixN(lum, periodLook(lum as F, q as V2, n), step(n, N_STOP - 1)))
    // a cut: the first frame of each shot flashes (the splice bump on the print)
    const first = step(abs(n.sub(SHOT_N[1])), 0.5).add(step(abs(n.sub(SHOT_N[2])), 0.5)).add(step(abs(n.sub(SHOT_N[3])), 0.5))
    lum.assign(mixN(lum, lum.mul(0.5).add(0.6), first.mul(0.6)))
    // changeover cue dots: a ring in the upper right of four frames, twice
    const cue = step(abs(n.sub(CUES_AT[0] + 1.5)), 2).add(step(abs(n.sub(CUES_AT[1] + 1.5)), 2)).mul(step(n, N_STOP - 1))
    const dc = length(q.sub(vec2(1.58, 0.86)))
    lum.assign(mixN(lum, float(0.02), sstep(0.04, 0.034, dc).mul(cue)))
    lum.assign(mixN(lum, float(0.95), sstep(0.028, 0.022, dc).mul(cue)))
    return vec4(lum, lum, lum, 1)
  }, A)

  // ---- the moon: ground (a polar grid dense at the print, out to the horizon), the Earth
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(20, 16 / 9, 0.05, 20000)
  cam.rotation.order = "YXZ"
  const U = {
    camP: uniform(new THREE.Vector3()),
    sun: uniform(SUN.clone()),
    sunI: uniform(6.4),
    camR: uniform(new THREE.Vector3(1, 0, 0)),
    camU: uniform(new THREE.Vector3(0, 1, 0)),
    camB: uniform(new THREE.Vector3(0, 0, 1)),
    pxK: uniform(0.001), // metres per pixel at one metre
    time: uniform(0),
  }
  const NR = 520, NS = 640, C0 = new THREE.Vector2(0, 0.35)
  {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array((NR + 1) * (NS + 1) * 3)
    // a linear core out to 12 cm (no slivers at the centre), then rings growing by a constant ratio to the horizon
    const CORE = 12, R1 = 0.12
    const gr = Math.pow(3600 / R1, 1 / (NR - CORE))
    let i = 0
    for (let a = 0; a <= NR; a++) {
      const r = a <= CORE ? (R1 * a) / CORE : R1 * Math.pow(gr, a - CORE)
      for (let b = 0; b <= NS; b++) {
        const th = (b / NS) * Math.PI * 2
        pos[i++] = C0.x + r * Math.cos(th)
        pos[i++] = 0
        pos[i++] = C0.y + r * Math.sin(th)
      }
    }
    const idx = new Uint32Array(NR * NS * 6)
    let j = 0
    for (let a = 0; a < NR; a++)
      for (let b = 0; b < NS; b++) {
        const p0 = a * (NS + 1) + b, p1 = p0 + 1, p2 = p0 + NS + 1, p3 = p2 + 1
        idx[j++] = p0; idx[j++] = p1; idx[j++] = p2
        idx[j++] = p1; idx[j++] = p3; idx[j++] = p2
      }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    const m = new THREE.NodeMaterial()
    const xz = attribute("position", "vec3").xz
    const curv = (p: V2): F => length(p.sub(vec2(CAM.x, CAM.z))).pow(2).div(2 * MOON_R) as F
    const world = vec3(xz.x, groundH(xz as V2, float(0), float(0)).add(clodH(xz as V2)).sub(curv(xz as V2)), xz.y)
    m.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
    const Pv = world.toVarying()
    m.fragmentNode = Fn(() => {
      const P = Pv
      const p = P.xz
      const dist = length(U.camP.sub(P))
      const px = dist.mul(U.pxK)
      // normal from the whole height field, sampled at about a pixel
      const e = max(px.mul(0.7), 0.0006)
      const hf = (q: V2): F => groundH(q, float(1), px).add(clodH(q, px)).add(detailH(q, px)) as F
      const h0 = hf(p as V2)
      const hx = hf(p.add(vec2(e, 0)) as V2)
      const hz = hf(p.add(vec2(0, e)) as V2)
      const N = normalize(vec3(h0.sub(hx), e, h0.sub(hz))).toVar()
      const L = U.sun
      const V = normalize(U.camP.sub(P))
      // the shadow: march toward the sun over what casts (the sun's half degree gives the only softness)
      const vis = float(1).toVar()
      If(dist.lessThan(14), () => {
        const y0 = castH(p as V2).add(0.0004)
        const tt = float(0.0012).toVar()
        Loop(10, () => {
          const q = p.add(L.xz.mul(tt))
          const hq = castH(q as V2)
          vis.assign(min(vis, sat1(y0.add(L.y.mul(tt)).sub(hq).div(tt.mul(0.0087)).add(0.5) as F)))
          tt.mulAssign(1.8)
        })
      })
      vis.assign(mixN(vis, float(1), sstep(5, 13, dist)))
      // Lommel-Seeliger with an opposition surge: bright away from the sun, no limb darkening
      const mu0 = max(dot(N, L), 0)
      const mu = max(dot(N, V), 0).add(0.3)
      const g = dot(V, L).clamp(-1, 1).acos()
      const phase = exp(g.mul(-0.9)).mul(float(1).add(exp(g.div(0.07).negate()).mul(0.4)))
      const ls = mu0.div(mu0.add(mu)).mul(2)
      const tone = vnoise(p.mul(1.2)).mul(0.1).add(vnoise(p.mul(0.23).add(4)).mul(0.14)).add(vnoise(p.mul(0.031)).mul(0.18)).add(0.8)
      const alb = vec3(0.118, 0.112, 0.104).mul(tone).toVar()
      // disturbed and compacted soil in and round the print is a shade darker
      const inPrint = sstep(0.01, -0.004, soleSD(r2(p as V2, PRINT_ROT).mul(vec2(-1, -1)) as V2))
      alb.mulAssign(float(1).sub(inPrint.mul(0.12)))
      const direct = alb.mul(U.sunI).mul(ls).mul(phase).mul(vis)
      // fill: only the sunlit ground around, from below the horizon of each facet; blue-grey
      const fill = alb.mul(vec3(0.075, 0.085, 0.11)).mul(N.y.mul(-0.4).add(0.7)).mul(U.sunI.mul(0.3))
      return vec4(direct.add(fill), 1)
    })()
    const ground = new THREE.Mesh(g, m)
    ground.frustumCulled = false
    scene.add(ground)
  }
  // the Earth: a quad facing the lens at its true direction and size, a sphere drawn on it
  const earthMat = new THREE.NodeMaterial()
  earthMat.transparent = true
  earthMat.depthWrite = false
  earthMat.fragmentNode = Fn(() => {
    const d = uvAttr().mul(2).sub(1)
    const r = length(d)
    const cov = sstep(1.0, 0.94, r)
    Discard(r.greaterThan(1.02))
    const n = vec3(d, sqrt(max(float(1).sub(r.mul(r)), 0)))
    // the sun in the quad's frame
    const Ls = vec3(dot(U.sun, U.camR), dot(U.sun, U.camU), dot(U.sun, U.camB))
    const lit = max(dot(n, Ls), 0).toVar()
    const tw = sstep(-0.05, 0.12, dot(n, Ls))
    // continents and cloud on the turning globe (illustration: no particular face)
    const m3 = vec3(n.x.mul(0.94).add(n.z.mul(0.34)), n.y, n.z.mul(0.94).sub(n.x.mul(0.34)))
    const land = sstep(0.53, 0.58, fbm(m3.xy.mul(1.7).add(vec2(m3.z.mul(1.3), 4.1))))
    const cloud = sstep(0.5, 0.75, fbm(m3.xy.mul(3.2).add(vec2(m3.z.mul(2.1).add(1.7), 0.3)))).add(sstep(0.62, 0.95, abs(n.y)).mul(0.8))
    const alb = mixN(mixN(vec3(0.012, 0.035, 0.12), vec3(0.11, 0.1, 0.06), land), vec3(0.85, 0.87, 0.9), clampN(cloud, 0, 1))
    const rim = pow(float(1).sub(n.z), 3).mul(vec3(0.25, 0.45, 1.0)).mul(tw)
    const c = alb.mul(lit).mul(U.sunI.mul(0.35)).add(rim.mul(U.sunI.mul(0.12)))
    return vec4(c.mul(cov), cov)
  })()
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), earthMat)
  earth.frustumCulled = false
  earth.renderOrder = 5
  scene.add(earth)

  // ---- the gate: the strip, the runners, the lamp; and the push through it into the colour picture
  const G = {
    tAtlas: uniformTexture(atlas.texture),
    tMoon: uniformTexture(stage.texture),
    asp: uniform(16 / 9),
    zoom: uniform(1),
    pos: uniform(0), // frames: where the strip is
    base: uniform(0),
    blur: uniform(0),
    weave: uniform(new THREE.Vector2()),
    lamp: uniform(1),
    still: uniform(0), // 1: the stopped frame shows the colour picture
    sepia: uniform(1),
    push: uniform(0), // 1: the picture is the frame
    reseau: uniform(0),
    flash: uniform(0),
    shade: uniform(0), // a soft dark behind the title column and the clock, over bright ground
    debug: uniform(ctx.debugLabels ? 1 : 0),
    halo: uniform(1),
  }
  const gate = ctx.pass(({ uv, res }) => {
    const col = vec3(0).toVar()
    If(G.push.greaterThanEqual(0.999), () => {
      col.assign(sampleRT(G.tMoon, uv).rgb)
    }).Else(() => {
      const uc = uv.sub(0.5).mul(vec2(G.asp, 1))
      const mmpp = float(VIS).div(G.zoom).div(res.y)
      const Pg = uc.mul(VIS).div(G.zoom)
      const P = Pg.add(G.weave).add(vec2(0, G.pos.mul(FILM.pitch))).toVar()
      const aa = mmpp.mul(0.8)
      // the frame's picture, as a transparency: one frame's worth of the atlas, smeared by the run
      const frameCol = (Q: V2): V3 => {
        const f = frameOf(Q)
        const k = f.x
        const row = k.sub(G.base).add(2)
        const fu = vec2(f.y.div(FILM.iw * 2).add(0.5), f.z.div(FILM.ih * 2).add(0.5))
        const at = sampleRT(G.tAtlas, vec2(fu.x, row.add(clampN(fu.y, 0.002, 0.998)).div(ROWS)) as V2).r
        // halation: light that went through the emulsion, bounced off the base and came back as a glow round the highlights
        const hal = float(0).toVar()
        If(G.halo.greaterThan(0), () => {
          for (let j = 0; j < 6; j++) {
            const a = (j / 6) * Math.PI * 2 + 0.4
            const o = vec2(Math.cos(a) * 0.022 * 0.5625, Math.sin(a) * 0.022)
            const tap = sampleRT(G.tAtlas, vec2(fu.x.add(o.x), row.add(clampN(fu.y.add(o.y), 0.002, 0.998)).div(ROWS)) as V2).r
            hal.addAssign(max(tap.sub(0.8), 0))
          }
        })
        const lum = at.add(hal.mul(G.halo).mul(0.22)).mul(step(-0.5, row)).mul(step(row, 4.5))
        // the stopped frame: the colour picture itself, toned like the stock until the push
        const isStop = step(abs(k.sub(N_STOP)), 0.5).mul(G.still)
        const mc = sampleRT(G.tMoon, fu as V2).rgb
        const sep = (l: F): V3 => {
          const t = clampN(l.div(1.3), 0, 1.6)
          const s = t.mul(t).mul(t.mul(-1.2).add(2.2))
          return vec3(s.mul(1.04), s.mul(0.93), s.mul(0.78)).mul(1.15) as V3
        }
        const mcol = mixN(mc.mul(1.3), sep(luma(mc).mul(1.25) as F), G.sepia)
        return mixN(sep(lum as F), mcol, isStop) as V3
      }
      const tr = frameCol(P as V2).toVar()
      If(G.blur.greaterThan(0.03), () => {
        const acc = vec3(0).toVar()
        Loop(8, ({ i }) => {
          const o = float(i).div(7).sub(0.5).mul(G.blur).mul(FILM.pitch)
          acc.addAssign(frameCol(P.add(vec2(0, o)) as V2))
        })
        tr.assign(acc.div(8))
      })
      const f = frameOf(P as V2)
      const k = f.x, lx = f.y, ly = f.z
      const img = imageMask(lx, ly, aa as F)
      // grain, dust, a long scratch
      tr.mulAssign(filmGrain(P as V2, k).mul(mixN(float(0.16), float(0.05), G.still)).add(1))
      const dust = step(0.993, hash21(floor(P.mul(3.2)).add(k.mul(7.7)))).mul(sstep(0.2, 0.08, length(fract(P.mul(3.2)).sub(0.5))))
      tr.mulAssign(dust.mul(-0.9).add(1))
      tr.addAssign(scratch(P as V2, 5.6, 0.05).mul(0.35).mul(float(1).sub(G.still)))
      // the reseau crosses of a surface Hasselblad frame, 5 x 5, on the stopped frame
      const rq = vec2(lx, ly).div(3.18)
      const rc = abs(rq.sub(floor(rq.add(0.5))))
      const inGrid = step(abs(lx), 6.9).mul(step(abs(ly), 6.9))
      const arm = step(rc.x.mul(3.18), 0.55).mul(step(rc.y.mul(3.18), aa.mul(0.9).add(0.03))).add(step(rc.y.mul(3.18), 0.55).mul(step(rc.x.mul(3.18), aa.mul(0.9).add(0.03))))
      tr.assign(mixN(tr, vec3(0.01), clampN(arm, 0, 1).mul(inGrid).mul(G.reseau).mul(step(abs(k.sub(N_STOP)), 0.5))))
      // positive print: the frame line and the edges are black; clear key marks on the edge
      const dens = mixN(vec3(0.005, 0.0047, 0.0042), tr, img).toVar()
      dens.addAssign(edgeMarks(P as V2, k).mul(0.5))
      // the lamp comes through the aperture only (fixed in the gate); the rest gets its spill
      const ap = sstep(FILM.iw + 0.3, FILM.iw + 0.05, abs(Pg.x)).mul(sstep(FILM.ih + 0.35, FILM.ih + 0.1, abs(Pg.y)))
      const lampHere = mixN(float(0.03), G.lamp, ap)
      const filmC = dens.mul(lampHere).add(vec3(0.004, 0.0037, 0.0034)).toVar()
      // the gate behind (through a perforation, and beyond the strip's edges): blued steel, a polished track, the lamp's warmth near the aperture
      const perf = step(perfSD(P as V2), 0).add(step(FILM.w / 2, abs(P.x)))
      const spill = exp(length(Pg.div(vec2(1.4, 1))).mul(-0.1)).mul(G.lamp)
      const brush = vnoise(vec2(Pg.x.mul(0.3), Pg.y.mul(60))).mul(0.3).add(vnoise(vec2(Pg.x.mul(2), Pg.y.mul(300))).mul(0.2)).add(0.5)
      const steel = vec3(0.05, 0.048, 0.05).mul(brush).mul(spill.mul(2.4).add(0.2)).add(vec3(0.6, 0.33, 0.1).mul(spill.mul(spill)).mul(0.5))
      // two polished runners beyond the strip's edges
      const rx = abs(Pg.x).sub(FILM.w / 2 + 1.9)
      const runner = step(abs(rx), 1.6)
      const band = exp(rx.mul(rx).mul(-3)).mul(0.25).add(0.02)
      const runC = vec3(0.4, 0.4, 0.42).mul(band).mul(spill.mul(0.6).add(0.4))
      const plate = mixN(steel, runC, runner)
      col.assign(mixN(filmC, plate, clampN(perf, 0, 1)))
      // the frame line drawn as the gate's own shadow at the aperture's edge
      col.mulAssign(float(1).sub(sstep(FILM.iw + 0.05, FILM.iw + 0.25, abs(Pg.x)).mul(sstep(FILM.ih + 0.6, FILM.ih, abs(Pg.y))).mul(0.3)))
      // the leader of the new reel comes up out of the white
      col.addAssign(vec3(1.0, 0.96, 0.88).mul(G.flash))
      col.assign(mixN(col, sampleRT(G.tMoon, uv).rgb, G.push.mul(G.push).mul(G.still)))
    })
    // over bright ground: a soft shade under the headline and the corner clock
    const sh = sstep(0.62, 0.0, length(uv.sub(vec2(0.2, 0.84)).mul(vec2(0.95, 2.1)))).mul(0.55).add(sstep(0.16, 0.0, length(uv.sub(vec2(0.95, 0.955)).mul(vec2(1.0, 2.2)))).mul(0.4))
    col.mulAssign(float(1).sub(G.shade.mul(sh)))
    return vec4(col, 1)
  }, G)

  // ---- the rule of ages: brushed steel with black cuts, in whichever light the scene has
  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "steel", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const RL = { key: uniform(new THREE.Vector3(0, 0.5, 1).normalize()), keyCol: uniform(new THREE.Vector3(1, 0.95, 0.85)), amb: uniform(new THREE.Vector3(0.08, 0.08, 0.09)) }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const brush = vnoise(vec2(st.x.mul(5), st.y.mul(400))).mul(0.5).add(vnoise(vec2(st.x.mul(40), st.y.mul(1600))).mul(0.5))
    const N = normalize(normalWorld)
    const diff = max(dot(N, RL.key), 0)
    const metal = vec3(0.5, 0.51, 0.53).mul(brush.mul(0.2).add(0.85))
    const lit = metal.mul(RL.keyCol.mul(diff.mul(0.8).add(0.2)).add(RL.amb)).toVar()
    const c = mixN(lit, cut.rgb.mul(RL.keyCol.mul(0.3).add(0.05)), on)
    return vec4(ctx.debugLabels ? mixN(c, cut.rgb, step(0.02, on)) : c, 1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 10
  rule.frustumCulled = false
  const ruleScene = new THREE.Scene()
  ruleScene.add(rule)
  const ruleCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100)

  // ---------------------------------------------------------------- the story clock

  const st = { tilt: 0, push: 0, still: 0, earthXY: [0, 0, 0] as [number, number, number], fps: 0, stopK: 0 }
  const POST: PostOpts = {}
  const TITLES: TitleOpts = { color: "#f6f1e8", shadow: "rgba(0,0,0,0.75)", delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.45] }
  const HUD = { color: "#efe9dd", shadow: "rgba(0,0,0,0.6)" }
  const v3 = new THREE.Vector3()
  const lnT0 = Math.log(Math.tan((12.5 * Math.PI) / 180)), lnT1 = Math.log(Math.tan((52 * Math.PI) / 180)), lnT2 = Math.log(Math.tan((47 * Math.PI) / 180))
  const PITCH0 = -Math.atan2(CAM.y, CAM.z) - 0.005
  const EARTH_Y = 0.82 // where the Earth sits in the last frame, as a fraction of the half-height above centre
  const CROUCH_Y = 0.55
  const YAW0 = 0.115, YAW1 = -EARTH_AZ + (17 * Math.PI) / 180

  function update(s: State) {
    const b1 = s.beat >= 1
    const t0 = s.at(0), t1 = s.at(1)
    U.time.value = s.time
    // ---- the film
    let pos: number, blur: number, lamp: number
    if (!b1) {
      // a long hold keeps running the flurry: wrap by whole frames, well short of the stop frame
      pos = gatePos(t0)
      if (pos > WRAP + 400) pos = WRAP + ((pos - WRAP) % 400)
      const v = (gatePos(t0 + 0.004) - gatePos(t0 - 0.004)) / 0.008
      // the pull-downs smear while the rate climbs; once it runs at speed (and through a held beat) the shutter hides them: it flickers, it does not smear
      blur = clamp(v / 120, 0, 1.0) * (1 - smooth(5.4, 6.2, t0))
      const N = framesAt(t0), f = N - Math.floor(N), r = rateAt(t0)
      // the shutter closes over each pulldown: at low rates you see the gate dim; past 24 a second a steady flicker
      const shut = smooth(0.74, 0.79, f) * (1 - smooth(0.98, 1, f))
      lamp = mix(1 - 0.85 * shut, 0.82 + 0.1 * Math.sin(s.time * 150), smooth(18, 32, r))
      st.fps = r
    } else {
      // stopped dead: a hair of bounce in the loop
      pos = N_STOP + 0.06 * Math.exp(-t1 * 26) * Math.sin(t1 * 70)
      blur = 0
      lamp = 1.05
      st.fps = 0
    }
    G.pos.value = pos
    G.base.value = Math.floor(pos + 0.5)
    A.base.value = Math.floor(pos + 0.5)
    G.blur.value = blur
    G.lamp.value = lamp * (1 + 1.5 * (1 - s.enter))
    G.flash.value = 0.6 * (1 - s.enter) * (1 - s.enter)
    const fr = Math.floor((b1 ? 0 : t0) * 24)
    const wv = b1 ? 0.03 * Math.exp(-t1 * 8) : 0.025 + 0.035 * smooth(2, 6, t0)
    G.weave.value.set(wv * Math.sin(fr * 2.37 + 0.3), wv * 0.7 * Math.sin(fr * 1.71 + 2.2))
    // the push through the gate into the photograph (beat 1): the frame grows to fill the lens exactly
    const push = b1 ? E.io3(clamp((t1 - 0.35) / 0.7)) : 0
    st.push = push
    const zFill = VIS / (FILM.ih * 2)
    G.zoom.value = b1 ? Math.exp(mix(0, Math.log(zFill), push)) : 1 + 0.07 * smooth(0, 7, t0)
    G.still.value = b1 ? 1 : 0
    G.halo.value = b1 ? 0 : 1
    G.sepia.value = b1 ? 1 - smooth(0.45, 1.05, t1) : 1
    G.reseau.value = b1 ? 1 - smooth(0.7, 1.3, t1) : 0
    G.push.value = push >= 0.999 ? 1 : push
    G.shade.value = ctx.debugLabels ? 0 : b1 ? smooth(0.3, 1.0, t1) * (1 - 0.7 * smooth(5.2, 6.2, t1)) : 0
    if (push > 0.995) G.weave.value.set(0, 0)
    A.moonOn.value = b1 ? 1 : 0
    // ---- the Moon's camera: the print, then the slow tilt up as the lens widens
    const k = b1 ? E.io3(clamp((t1 - 3.0) / 3.0)) : 0
    st.tilt = k
    const settle = b1 ? 0.012 * Math.exp(-Math.max(0, t1 - 6) * 3) * Math.sin(Math.max(0, t1 - 6) * 9) : 0
    // the last frame: ground across the lower third (the old line of prints crossing it), the horizon, the Earth high;
    // then a slow push on a longer lens, the Earth held at the same height in frame, so it reads
    const fin = b1 ? E.io2(clamp((t1 - 5.6) / 3.4)) : 0
    const tanH = Math.exp(mix(lnT0, lnT1 - fin * (lnT1 - lnT2), k)) * (1 - 0.06 * (b1 ? smooth(1, 3, t1) * (1 - k) : 0))
    const pitchEnd = EARTH_EL - Math.atan(EARTH_Y * tanH)
    cam.fov = (2 * Math.atan(tanH) * 180) / Math.PI
    cam.aspect = s.w / s.h
    const hh = 0.004 * Math.sin(s.time * 0.53) + 0.003 * Math.sin(s.time * 0.91 + 1)
    cam.position.copy(CAM)
    cam.position.y = mix(CAM.y, CROUCH_Y, E.io3(k)) // the lens comes down toward the ground as it tilts up
    cam.position.z = CAM.z + 1.2 * E.io3(k) // and back, so the print itself stands in the foreground of the last frame
    cam.rotation.set(mix(PITCH0, pitchEnd, k) + settle + hh + s.mouse.y * 0.004, mix(YAW0, YAW1, k) + 0.003 * Math.sin(s.time * 0.7) - s.mouse.x * 0.004, 0)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    U.camP.value.copy(cam.position)
    const e = cam.matrixWorld.elements
    U.camR.value.set(e[0], e[1], e[2])
    U.camU.value.set(e[4], e[5], e[6])
    U.camB.value.set(e[8], e[9], e[10])
    U.pxK.value = (2 * tanH) / Math.max(1, s.h)
    // the Earth, at its true direction and size, as far as the frustum allows
    const D = 9000
    earth.position.copy(cam.position).addScaledVector(EARTH, D)
    earth.quaternion.copy(cam.quaternion)
    const sz = 2 * D * Math.tan(EARTH_R)
    earth.scale.set(sz, sz, 1)
    v3.copy(earth.position).project(cam)
    st.earthXY = [((v3.x + 1) / 2) * DW, ((1 - v3.y) / 2) * DH, v3.z < 1 ? 1 : 0]
    // ---- the rule
    ruleCam.aspect = s.w / s.h
    ruleCam.updateProjectionMatrix()
    ruleCam.updateMatrixWorld()
    placeRule(rule, ruleCam, { dist: 4, lean: 0.2 })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    const sunK = smooth(0.4, 1.0, t1) * (b1 ? 1 : 0)
    RL.key.value.set(-0.25, 0.75, 0.6).normalize()
    RL.keyCol.value.set(mix(1.0, 1.25, sunK), mix(0.8, 1.22, sunK), mix(0.58, 1.15, sunK)).multiplyScalar(b1 ? 1 : 0.75 + 0.25 * lamp)
    RL.amb.value.set(mix(0.08, 0.04, sunK), mix(0.06, 0.045, sunK), mix(0.04, 0.06, sunK))
    // ---- post: film, then hard daylight
    const d = st.push
    Object.assign(POST, {
      tone: "aces",
      exposure: mix(1.05, 1.1, d) - 0.18 * st.tilt,
      bloom: mix(0.45, 0.12, d),
      bloomThresh: mix(0.9, 1.4, d),
      bloomRadius: 0.7,
      vignette: mix(0.34, 0.14, d),
      grain: mix(0.034, 0.014, d),
      contrast: mix(1.05, 1.12, d),
      sat: mix(0.9, 1.0, d),
      halation: mix(0.45, 0.0, d),
      lift: [0.006, 0.007, 0.012],
      gain: mix(1, 0, d) > 0 ? [1.03, 1.0, 0.95] : [1, 1, 1],
      ca: mix(0.0008, 0.0003, d),
    })
    if (ctx.debugLabels) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
    if (s.live) {
      ctx.synth.bed("projector", b1 ? 0 : 0.35 + 0.5 * clamp(st.fps / RMAX))
      ctx.synth.bed("air", b1 ? 0.04 : 0)
    }
  }

  // ---------------------------------------------------------------- sound

  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  // a click for each pulldown while they can still be told apart
  for (let n = 1; ; n++) {
    const t = timeOf(n)
    if (rateAt(t) > 16 || t > 6) break
    cues.push({ b: 0, at: t - 0.02, s: "tick", o: { f: H(48 + (n % 3)), g: 0.22 + 0.01 * n, vary: 0.4 }, pos: [0, 0, 0.2] })
  }
  // the cuts between shots: the splice bump and a shot's own sound, far off and thin as it would be on a print
  SHOT_T.slice(1).forEach((t, i) => cues.push({ b: 0, at: t, s: "flap", o: { f: 170 + 30 * i, g: 0.3 }, pos: [0, 0.1, 0.2] }))
  cues.push({ b: 0, at: SHOT_T[1] + 0.15, s: "rumble", o: { g: 0.45, dur: 1.2 }, pos: [0.3, 0, 1] })
  cues.push({ b: 0, at: SHOT_T[1] + 0.05, s: "sub", o: { g: 0.35 } })
  cues.push({ b: 0, at: SHOT_T[2] + 0.2, s: "telegraph", o: { g: 0.3, dur: 0.06 }, pos: [0.4, 0.3, 0.5] })
  cues.push({ b: 0, at: SHOT_T[2] + 0.7, s: "telegraph", o: { g: 0.3, dur: 0.06 }, pos: [0.4, 0.3, 0.5] })
  cues.push({ b: 0, at: SHOT_T[3] + 0.05, s: "rumble", o: { g: 0.5, dur: 1.4 }, pos: [0, -0.2, 0.6] })
  cues.push({ b: 0, at: 5.6, s: "riser", o: { g: 0.25, dur: 2.0 } })
  // the stop: the film halts, the projector is gone, one shutter, then nothing
  cues.push({ b: 1, at: 0, s: "thud", o: { f: H(3), g: 0.7 }, pos: [0, 0, 0] })
  cues.push({ b: 1, at: 0.01, s: "shutter", o: { g: 0.8 } })
  cues.push({ b: 1, at: 0.4, s: "whoosh", o: { g: 0.12, f: 200, dur: 0.6 } })
  cues.push({ b: 1, at: 3.1, s: "pad", o: { f: H(6), g: 0.18, dur: 4 } })
  cues.push({ b: 1, at: 6.05, s: "select", o: { g: 0.9 }, pos: [0.3, 0.7, 0.8] })
  cues.push({ b: 1, at: 6.1, s: "bell", o: { f: H(24), g: 0.28 }, pos: [0.3, 0.7, 1] })
  cues.push({ b: 1, at: 6.1, s: "glass", o: { f: H(48), g: 0.15 }, pos: [0.3, 0.7, 1] })

  // per-shot captions: the script's own words
  const CAPS = ["1903, Kitty Hawk", "1945, the Trinity test", "1957, Sputnik", "1961, Gagarin, 108 minutes"]

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: atlasPass, target: atlas },
      { pass: gate, target: out },
      { scene: ruleScene, camera: ruleCam, target: out },
    ],
    render(s) {
      const r = ctx.renderer
      const b1 = s.beat >= 1
      // the Moon is drawn only once the film has stopped on it
      if (b1) {
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(stage)
        r.render(scene, cam)
      }
      if (!b1 || st.push < 0.999) atlasPass.render(atlas)
      gate.render(out)
      const ac = r.autoClear
      r.autoClear = false
      r.setRenderTarget(out)
      r.render(ruleScene, ruleCam)
      r.autoClear = ac
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,0.7)", color: "#f6f1e8" })
      titles(g, s, ctx.def, TITLES)
      const ex = 1 - s.exit * 1.5 < 0 ? 0 : 1 - s.exit * 1.5
      if (s.beat === 0) {
        const t0 = s.t
        for (let i = 0; i < 4; i++) {
          const a = SHOT_T[i], b = SHOT_T[i + 1]
          if (t0 < a + 0.05 || t0 > b + 0.15) continue
          const p = clamp((t0 - a - 0.05) / 0.3)
          const fade = 1 - clamp((t0 - b) / 0.15)
          g.text(CAPS[i], 1796, 186, { size: 30, font: "mono", align: "right", color: "#f6f1e8", alpha: fade * ex, style: "slam", by: "line", p, track: 0.02, shadow: { color: "rgba(0,0,0,0.85)", blur: 18 } })
        }
      }
      if (s.beat === 1 && st.earthXY[2]) {
        const q = E.out3(clamp((s.t - 6.0) / 0.35))
        if (q > 0) {
          const [x, y] = st.earthXY
          const w = 54
          g.selbox(x - w / 2, y - w / 2, w, w, q * ex)
          g.text("Earth", x + w / 2 + 14, y + 9, { size: 26, font: "mono", color: "#f6f1e8", alpha: q * ex, style: "blur", by: "line", p: q, shadow: { color: "rgba(0,0,0,0.9)", blur: 14 } })
        }
      }
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      disposeTree(scene)
      disposeTree(ruleScene)
    },
  }
}
