// The creature toolkit, part 5: surfaces. TSL node-material factories that a scene lights with
// its own uniforms: skin (soft, a wrapped terminator that bleeds warm, rim), chitin (hard
// specular, a clear coat, segment bands), scales (cells with relief and a highlight stretched
// along the body), feathers (cards with a strand sheen), and an underwater dressing for any of
// them (wetness, a caustics hook, an absorption hook).
//
// Detail is pixel-aware: every pattern measures its own footprint (cells per pixel) and fades its
// colour variation and its relief out before it can alias, and skips the work once it has.
// Patterns live in rest space (the unposed model), so they do not swim as the animal moves, and a
// limb's pattern meets the body's without a seam because both read the same 3D field.

import * as THREE from "three/webgpu"
import { abs, cameraPosition, clamp, cross, dFdx, dFdy, dot, exp, faceDirection, float, floor, Fn, fract, If, length, max, min, mix, normalize, pow, reflect, sign, sin, smoothstep, step, vec2, vec3, vec4 } from "three/tsl"

import { fbm3, hash21, sat, vnoise3, voronoi, type F, type V2, type V3 } from "../tsl"
import type { SkinNodes } from "./gpu"
import { MAT, type Vec3 } from "./spec"

/**
 * A patch of colour laid on the skin in rest space (so it stays put): a scalp's stubble, clay or
 * ochre on the hands, a wrap painted round the hips. An ellipsoid (or, with `box`, a block) at `at`
 * with radii `r`, in model units.
 */
export type Paint = {
  at: Vec3
  r: Vec3
  color: THREE.ColorRepresentation
  /** 0..1 (default 1). */
  amt?: number
  /** A block instead of an ellipsoid (a wrap between two heights). */
  box?: boolean
  /** Also on the other side (z mirrored). */
  mirror?: boolean
  /** Softness of the edge as a fraction of the radius (default 0.25), how ragged it is (0..1) and the size of the raggedness (model units). */
  edge?: number
  rag?: number
  ragSize?: number
  /** 0..1: how far it stops being skin (no bleed, less shine, rougher): cloth, dried clay, hair. */
  matte?: number
  /** Value variation inside the patch, 0..1, at `ragSize`. */
  vary?: number
}

/** The scene's light, as nodes (uniforms it animates). Directions point toward the light. */
export type Lights = {
  key: V3
  keyCol: V3
  /** Ambient from above and from below (ground or sea-floor bounce). */
  sky: V3
  bounce: V3
  /** 0..1 shadowing of the key light at a world point (a cloud, a canopy, the animal ahead). */
  shadow?: (p: V3) => F
}

export type Water = {
  /** 0..1: darkens the albedo and adds a wet clear coat. */
  wet?: number
  /** Caustics hook: light multiplier (around 1) at a world point; applied to up-facing key light. */
  caustics?: (p: V3) => F
  /** Absorption hook: the finished colour, the world point and the distance to the eye in, the colour through the water out. */
  absorb?: (c: V3, p: V3, dist: F) => V3
}

export type Look = {
  base: THREE.ColorRepresentation
  /** Countershading: the colour of the underside (default: base, lightened). */
  belly?: THREE.ColorRepresentation
  /** Colour of blotches, stripes and feature scales. */
  accent?: THREE.ColorRepresentation
  /** Horn, beak, claw, spine colour (MAT.horn) and its tip colour. */
  horn?: THREE.ColorRepresentation
  hornTip?: THREE.ColorRepresentation
  /** Shell or carapace plates (MAT.shell). */
  shell?: THREE.ColorRepresentation
  eye?: THREE.ColorRepresentation
  /** A faceted compound eye instead of an iris and pupil. */
  compoundEye?: boolean
  /** Cell pattern: size of a scale in model units, how proud it stands (model units), how much its colour varies. */
  cell?: number
  relief?: number
  cellVary?: number
  /** Larger feature scales scattered among the small ones: their size as a multiple of `cell` (0 = none). */
  feature?: number
  /** Low-frequency blotching: strength 0..1 and size in model units; `stripes` turns blotches into bands across the body. */
  blotch?: number
  blotchSize?: number
  stripes?: number
  /** Segment bands for an arthropod: [from, to, count] along the body, matching `body.segments`. */
  bands?: [number, number, number]
  rough?: number
  spec?: number
  /** Wrapped diffuse 0..1 (skin about 0.4, chitin 0.1) and the colour that bleeds through the terminator. */
  wrap?: number
  bleed?: THREE.ColorRepresentation
  rim?: number
  /** Clear coat 0..1: a second, tight highlight and a sky reflection (chitin, wet skin). */
  coat?: number
  /** Highlight stretched along the body 0..1 (overlapping scales, feather barbs). */
  aniso?: number
  water?: Water
  /** Colour along the back (the dark half of countershading; `belly` is the light half). */
  back?: THREE.ColorRepresentation
  /** 0..1: mid-scale unevenness of the hide's value, a quarter of `blotchSize` across, so no stretch of skin is one flat colour. */
  mottle?: number
  /**
   * Folds and creases: strength 0..1, and the spacing between folds in model units. They ring every
   * part (round a leg, down a flank), break up along their length, and deepen where a joint is bent
   * (`foldFlex` times as deep at a fully bent joint, default 2.5) and in the lee of a junction.
   */
  fold?: number
  foldSize?: number
  foldFlex?: number
  /** How much of the folding shows on skin that is not bent at all (default 1; 0.15 for a hand, whose creases are at its joints). */
  foldBase?: number
  /** Dust or dried mud: its colour, the height (model units above the feet) it fades out at, and how much, 0..1. A little also settles on up-facing skin. */
  dust?: THREE.ColorRepresentation
  dustTo?: number
  dustAmt?: number
  /** 0..1: ambient light lost under the belly and on the faces of the limbs that look at each other. */
  occlude?: number
  /** 0..1: the trunk's shadow on the animal's own limbs, tail and head (a ray against the trunk's ellipsoid, in rest space). */
  selfShadow?: number
  /** Colour of a held object (MAT.prop): matte, mottled, no skin effects. */
  prop?: THREE.ColorRepresentation
  /** A fixed catchlight in the eye so it reads alive from any angle (default on for a simple eye). */
  catchlight?: boolean
  /**
   * A forward-facing eye with lids (a human, an owl, a cat): the eyeball's axis is the model's +x,
   * a white (`sclera`) shows round the iris (`eye`), and the lids are drawn on the ball itself as an
   * almond opening that the blink closes. Without it the eye looks out sideways, as a grazer's does.
   */
  eyeForward?: boolean
  sclera?: THREE.ColorRepresentation
  /** Colours of MAT.lip, MAT.hair and MAT.hide parts. */
  lip?: THREE.ColorRepresentation
  hair?: THREE.ColorRepresentation
  hide?: THREE.ColorRepresentation
  /** Patches of colour on the skin, in rest space (see Paint). */
  paints?: Paint[]
  /** Strength of light coming through thin parts (finger edges, ears) as a multiple of the default (1). */
  glow?: number
  /**
   * 0..1 subsurface scattering of skin: the wrap is wider for red than for green and blue, so the
   * terminator goes warm and soft the way light under skin does. 0 (default) leaves the shading as it was.
   */
  sss?: number
  /**
   * The macro hand's surface (hand.ts writes it: `handLook`, or `humanLook` for a figure): where the
   * hand is in rest space and how its skin reads. Draws palm and finger creases, knuckle wrinkles,
   * fingerprint ridges, extensor tendons, dorsal veins, forearm hair, a paler palm and redder
   * knuckles and fingertips, clay or dust in the creases; every feature fades by its footprint.
   */
  hand?: HandShade
  /** MAT.horn parts are fingernails: a pink bed, a lunula, a white free edge, glossy. */
  nails?: boolean
  /** How glossy MAT.shell and MAT.horn are, 0..1 (defaults 0.35 and 0.45): 0 for a matte carapace or a dull hoof. */
  shellGloss?: number
  hornGloss?: number
  /** The colour of the cards geometry (feathers, bristles, setae) instead of the countershaded hide colour. */
  card?: THREE.ColorRepresentation
}

/** See `Look.hand`. Hand-local frame: origin at the wrist, x to the fingers, y out of the back of the hand, z to the little finger; `v` per digit row: [PIP or IP v, DIP v, length] (thumb first). */
export type HandShade = {
  o: Vec3; x: Vec3; y: Vec3; z: Vec3; s: number; mirror?: boolean; v: [number, number, number?][]
  palm?: THREE.ColorRepresentation
  clay?: number
  clayCol?: THREE.ColorRepresentation
  dust?: number
  hair?: number
  veins?: number
  callus?: number
}

// hand-local polylines (x, z) of a right hand, metres: the palm's three major creases and the dorsal veins
const CREASES: [number, number][][] = [
  [[0.087, -0.039], [0.072, -0.025], [0.056, -0.0175], [0.038, -0.012], [0.02, -0.0085], [0.004, -0.0065]], // thenar crease, round the ball of the thumb
  [[0.087, -0.039], [0.079, -0.021], [0.071, -0.004], [0.064, 0.013], [0.059, 0.026]], // proximal transverse
  [[0.071, 0.045], [0.078, 0.03], [0.083, 0.014], [0.088, -0.002], [0.095, -0.018]], // distal transverse
]
const VEINS: [number, number][][] = [
  [[0.079, -0.021], [0.061, -0.019], [0.045, -0.017]],
  [[0.077, 0.0], [0.058, 0.003], [0.043, 0.004]],
  [[0.072, 0.02], [0.057, 0.024], [0.045, 0.026]],
  [[0.028, -0.034], [0.045, -0.017], [0.043, 0.004], [0.045, 0.026], [0.033, 0.04]], // the dorsal venous arch
  [[0.028, -0.034], [0.008, -0.032], [-0.05, -0.031], [-0.15, -0.025], [-0.27, -0.021]], // cephalic, up the thumb side of the forearm
  [[0.033, 0.04], [0.0, 0.037], [-0.08, 0.034], [-0.2, 0.03]], // basilic
  [[0.064, -0.049], [0.044, -0.041], [0.028, -0.034]], // from the thumb
]
const KNUCK: [number, number][] = [[0.0985, -0.0305], [0.1015, -0.0102], [0.0975, 0.0102], [0.0885, 0.0292]]

/** Distance from p to a polyline of constant points. */
const polyD = (p: V2, pts: [number, number][]): F => {
  let d: F | null = null
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const bx = b[0] - a[0], bz = b[1] - a[1], bb = bx * bx + bz * bz
    const pa = p.sub(vec2(a[0], a[1]))
    const h = clamp(pa.x.mul(bx).add(pa.y.mul(bz)).div(bb), 0, 1)
    const e = length(pa.sub(vec2(bx, bz).mul(h)))
    d = d ? min(d, e) : e
  }
  return d as F
}
/** Pick per-row constants by the row index (0 .. n-1). */
const byRow = (row: F, vals: number[]): F => {
  let r: F = float(vals[0])
  for (let i = 1; i < vals.length; i++) r = r.add(step(i - 0.5, row).mul(vals[i] - vals[i - 1])) as F
  return r
}

const col = (c: THREE.ColorRepresentation | undefined, fallback: V3): V3 => {
  if (c === undefined) return fallback
  const k = new THREE.Color(c)
  return vec3(k.r, k.g, k.b) as V3
}

/** Cells on three planes of rest space, blended by the rest normal: vec3(distance to cell centre, cell random, 0). */
const triCells = /*@__PURE__*/ Fn(([p, n]: [V3, V3]) => {
  const w = pow(abs(n), vec3(6)).toVar()
  w.divAssign(w.x.add(w.y).add(w.z).add(1e-5))
  const a = voronoi(p.yz).toVar(), b = voronoi(p.xz.add(17.3)).toVar(), c = voronoi(p.xy.add(41.7)).toVar()
  const d = a.x.mul(w.x).add(b.x.mul(w.y)).add(c.x.mul(w.z))
  // the random of whichever plane dominates, so a scale has one colour
  const r = mix(mix(hash21(a.yz), hash21(b.yz.add(7)), step(w.x, w.y)), hash21(c.yz.add(13)), step(max(w.x, w.y), w.z))
  return vec2(d, r)
}).setLayout({ name: "creatureCells", type: "vec2", inputs: [{ name: "p", type: "vec3" }, { name: "n", type: "vec3" }] })

const is = (m: F, id: number): F => float(1).sub(step(0.5, abs(m.sub(id)))) as F

function surface(n: SkinNodes, L: Lights, k: Look, cards: boolean): THREE.Node {
  const base = col(k.base, vec3(0.3) as V3)
  const belly = col(k.belly, base.mul(1.5).add(0.03) as V3)
  const accent = col(k.accent, base.mul(0.45) as V3)
  const horn = col(k.horn, vec3(0.42, 0.36, 0.27) as V3)
  const hornTip = col(k.hornTip, horn.mul(0.35) as V3)
  const shell = col(k.shell, base.mul(0.8) as V3)
  const eyeC = col(k.eye, vec3(0.25, 0.14, 0.04) as V3)
  const bleed = col(k.bleed, vec3(0.55, 0.16, 0.08) as V3)
  const wet = k.water?.wet ?? 0
  const back = col(k.back, base)
  const dust = col(k.dust, vec3(0.5, 0.42, 0.32) as V3)
  const prop = col(k.prop, vec3(0.3, 0.29, 0.27) as V3)
  const cell = k.cell ?? 0
  return Fn(() => {
    const N = normalize(n.vN).mul(faceDirection).toVar()
    const V = normalize(cameraPosition.sub(n.vW)).toVar()
    const m = n.vBody.z
    const mHorn = is(m, MAT.horn).toVar(), mEye = is(m, MAT.eye).toVar(), mMem = is(m, MAT.membrane).toVar(), mShell = is(m, MAT.shell).toVar(), mMouth = is(m, MAT.mouth).toVar()
    const mProp = is(m, MAT.prop).toVar()
    const mLip = is(m, MAT.lip), mHair = is(m, MAT.hair), mHide = is(m, MAT.hide)
    const cloth = k.hair !== undefined || k.hide !== undefined
    const mSkin = (cloth ? float(1).sub(mHorn).sub(mEye).sub(mMem).sub(mShell).sub(mMouth).sub(mProp).sub(mHair).sub(mHide) : float(1).sub(mHorn).sub(mEye).sub(mMem).sub(mShell).sub(mMouth).sub(mProp)).toVar()
    const matte = float(0).toVar()
    const rest = n.vRest
    const rn = normalize(n.vRestN).toVar()
    const along = n.vAux.w
    const rnd = fract(n.vBody.w)
    // ---- colour: countershading, blotches, per-animal tint
    const under = smoothstep(0.15, -0.75, rn.y)
    const alb = mix(base, belly, under.mul(mSkin.add(mMem))).toVar()
    if (k.back !== undefined) alb.assign(mix(alb, back, smoothstep(0.3, 0.95, rn.y).mul(mSkin)))
    if (k.blotch) {
      const bs = 1 / (k.blotchSize ?? 1)
      const q = rest.mul(vec3(k.stripes ? bs * 3 : bs, k.stripes ? bs * 0.35 : bs, bs)).add(n.seed.mul(31.7))
      const b = smoothstep(0.42, 0.62, fbm3(q))
      alb.assign(mix(alb, accent, b.mul(k.blotch).mul(mSkin).mul(under.oneMinus())))
    }
    if (k.mottle) {
      const q = rest.div((k.blotchSize ?? 1) * 0.23).add(n.seed.mul(17.1)).add(3.7)
      alb.mulAssign(mix(float(1), vnoise3(q).mul(0.65).add(vnoise3(q.mul(2.7)).mul(0.35)).mul(2 * k.mottle).add(1 - k.mottle), mSkin))
    }
    alb.assign(mix(alb, mix(horn, hornTip, smoothstep(0.35, 1, along)), mHorn))
    If(mProp.greaterThan(0.5), () => {
      alb.assign(prop.mul(fbm3(rest.mul(9 / Math.max(1e-6, k.blotchSize ?? 1))).mul(0.5).add(0.75)))
    })
    alb.assign(mix(alb, shell, mShell))
    if (k.lip !== undefined) alb.assign(mix(alb, col(k.lip, base), mLip.mul(0.8)))
    if (k.paints)
      for (const pt of k.paints) {
        const q0 = vec3(rest.x, rest.y, pt.mirror ? abs(rest.z) : rest.z).sub(vec3(...pt.at)).div(vec3(...pt.r)).toVar()
        const dd = pt.box ? max(max(abs(q0.x), abs(q0.y)), abs(q0.z)) : length(q0)
        const nz = pt.rag || pt.vary ? vnoise3(rest.div(pt.ragSize ?? 0.03)).mul(0.6).add(vnoise3(rest.div((pt.ragSize ?? 0.03) * 0.31)).mul(0.4)).toVar() : null
        const mk = float(1).sub(smoothstep(1 - (pt.edge ?? 0.25), 1, nz && pt.rag ? dd.add(nz.sub(0.5).mul(pt.rag)) : dd)).mul(pt.amt ?? 1).mul(mSkin).toVar()
        const pc = col(pt.color, base)
        alb.assign(mix(alb, nz && pt.vary ? pc.mul(nz.sub(0.5).mul(2 * pt.vary).add(1)) : pc, mk))
        if (pt.matte) matte.assign(max(matte, mk.mul(pt.matte)))
      }
    if (cloth) {
      const g = fbm3(rest.mul(vec3(60, 22, 60))).toVar()
      alb.assign(mix(alb, col(k.hair, vec3(0.03, 0.025, 0.02) as V3).mul(g.mul(0.9).add(0.55)), mHair))
      alb.assign(mix(alb, col(k.hide, vec3(0.2, 0.14, 0.09) as V3).mul(fbm3(rest.mul(31)).mul(0.7).add(0.65)), mHide))
      matte.assign(max(matte, mHair.add(mHide)))
    }
    alb.assign(mix(alb, vec3(0.16, 0.03, 0.03), mMouth))
    alb.assign(mix(alb, alb.mul(mix(0.82, 1.12, rnd)), mMem.add(mShell).mul(0.8)))
    if (cards && k.card !== undefined) alb.assign(col(k.card, base).mul(mix(float(0.85), float(1.15), rnd)))
    alb.mulAssign(n.tint)
    const rough = float(k.rough ?? 0.6).toVar()
    const relief = float(0).toVar()
    const cav = float(1).toVar()
    // ---- scales: cells in rest space, faded by their footprint
    if (cell > 0) {
      const p = rest.div(cell).toVar()
      const foot = max(length(dFdx(p)), length(dFdy(p)))
      const fade = smoothstep(0.34, 0.1, foot).mul(mSkin.add(mShell.mul(0.5))).toVar()
      If(fade.greaterThan(0.01), () => {
        const c = triCells(p, rn).toVar()
        const h = float(1).sub(c.x.mul(c.x).mul(1.9)).toVar()
        if (k.feature) {
          const big = triCells(p.div(k.feature).add(5.3), rn).toVar()
          const on = step(0.62, big.y).mul(smoothstep(0.55, 0.3, big.x))
          h.assign(max(h, on.mul(float(1.6).sub(big.x.mul(2.2)))))
          alb.assign(mix(alb, mix(alb, accent, 0.35), on.mul(fade)))
        }
        alb.mulAssign(mix(float(1), mix(float(1).sub(k.cellVary ?? 0.25), float(1).add(k.cellVary ?? 0.25), c.y), fade))
        cav.assign(mix(float(1), smoothstep(-0.25, 0.5, h).mul(0.45).add(0.55), fade))
        relief.assign(h.mul(fade))
        rough.addAssign(c.y.sub(0.5).mul(0.2).mul(fade))
      })
    }
    // ---- folds: creases ringing each part, broken along their length, deeper where a joint is bent
    const foldH = float(0).toVar()
    if (k.fold) {
      const fs = k.foldSize ?? 0.2
      const x = dot(rest, normalize(n.vTan)).div(fs).add(vnoise3(rest.div(fs * 3.2)).mul(1.5)).toVar()
      const fw = max(abs(dFdx(x)), abs(dFdy(x)))
      const fade = float(1).sub(smoothstep(0.22, 0.55, fw)).mul(mSkin).toVar()
      If(fade.greaterThan(0.01), () => {
        const g = abs(fract(x).sub(0.5)).mul(2)
        const crease = float(1).sub(smoothstep(0.0, 0.42, g))
        const gate = smoothstep(0.3, 0.7, vnoise3(rest.div(fs * 0.9).add(7.7)))
        const amt = clamp(float(k.fold).mul(gate.mul(0.7).add(0.3)).mul(n.flex.mul(k.foldFlex ?? 2.5).add(k.foldBase ?? 1).add(float(1).sub(n.vAux.y).mul(1.2))), 0, 1.1).mul(fade)
        foldH.assign(crease.mul(amt).negate())
        cav.mulAssign(float(1).sub(crease.mul(amt).mul(0.3)))
      })
    }
    // ---- dust: dried mud up the legs and under the belly, a film on what faces the sky
    if (k.dust !== undefined || k.dustTo !== undefined) {
      const to = k.dustTo ?? 1
      const low = float(1).sub(smoothstep(0, to, rest.y.add(vnoise3(rest.mul(5.3 / to)).sub(0.5).mul(to * 0.7))))
      const dm = clamp(low.add(sat(rn.y as F).mul(0.22)), 0, 1).mul(k.dustAmt ?? 0.6).mul(mSkin.add(mHorn.mul(0.5)).add(mShell.mul(0.7)))
      alb.assign(mix(alb, dust.mul(n.tint), dm))
      rough.addAssign(dm.mul(0.15))
    }
    // ---- the macro hand: creases, wrinkles, ridges, veins, tendons, hair, palm and nails (hand.ts)
    const handH = float(0).toVar()
    if (k.hand) {
      const Hd = k.hand
      const X = vec3(...Hd.x), Y = vec3(...Hd.y), Z = vec3(...Hd.z)
      const sgz = Hd.mirror ? sign(rest.z.add(1e-6)) : float(1)
      const r0 = Hd.mirror ? vec3(rest.x, rest.y, abs(rest.z)) : rest
      const rnm = Hd.mirror ? vec3(rn.x, rn.y, rn.z.mul(sgz)) : rn
      const d0 = r0.sub(vec3(...Hd.o))
      const q = vec3(dot(d0, X), dot(d0, Y), dot(d0, Z)).div(Hd.s).toVar()
      const qn = vec3(dot(rnm, X), dot(rnm, Y), dot(rnm, Z)).toVar()
      // metres of hand per pixel: every feature fades out before it is thinner than a couple of pixels
      const px = max(length(dFdx(rest)), length(dFdy(rest))).div(Hd.s).toVar()
      const vis = (w: number) => smoothstep(w * 0.75, w * 0.28, px)
      const mDig = is(m, MAT.digit).toVar()
      const region = smoothstep(-0.31, -0.27, q.x).mul(float(1).sub(smoothstep(0.24, 0.26, q.x))).mul(step(abs(q.z), 0.1)).mul(step(abs(q.y), 0.08)).mul(mSkin).toVar()
      If(region.greaterThan(0.01), () => {
        const tint = vec3(1).toVar()
        // the few noises everything below shares: fine (skin-scale) and coarse (vein-scale)
        const nA = vnoise3(rest.mul(700)).toVar(), nB = vnoise3(q.mul(16)).toVar(), nB2 = vnoise3(q.mul(16).add(4.1)).toVar()
        const crease = float(0).toVar()
        // which side: from the rest normal on the palm and forearm, from the turn round the part on a digit (the thumb faces sideways)
        const around = fract(n.vBody.y)
        const pa = float(1).sub(abs(around.mul(2).sub(1)))
        // (the thumb's metacarpal lies in the palm's own surface: judge it as the palm is judged, so the two meet without a seam of colour)
        const byPart = mDig.mul(float(1).sub(float(1).sub(step(0.5, floor(n.vBody.w))).mul(float(1).sub(smoothstep(0.3, 0.44, n.vBody.x))))).toVar()
        const palmar = mix(smoothstep(0.05, 0.55, qn.y.negate()), smoothstep(0.55, 0.8, pa), byPart).toVar()
        const dorsal = mix(smoothstep(0.0, 0.5, qn.y), smoothstep(0.45, 0.22, pa), byPart).toVar()
        const onPalm = float(1).sub(mDig).mul(smoothstep(-0.016, -0.006, q.x)).toVar()
        const inHand = sat(onPalm.add(mDig) as F).toVar() // palm and digits, not the forearm
        // -- digits: creases at the joints, wrinkles over the knuckles, ridges, a redder tip
        const row = floor(n.vBody.w)
        const vs = Hd.v
        const v1 = byRow(row, vs.map((a) => a[0])), v2 = byRow(row, vs.map((a) => a[1])), Ld = byRow(row, vs.map((a) => a[2] ?? 0.09))
        const v = n.vBody.x
        const dP = v.sub(v1).mul(Ld).toVar(), dD = v.sub(v2).mul(Ld).toVar(), dR = v.mul(Ld).toVar()
        const lat = min(around, float(1).sub(around)).mul(0.056).toVar() // metres round from the dorsal line
        const latP = abs(around.sub(0.5)).mul(0.056).toVar() // metres round from the palmar line
        const thumb = float(1).sub(step(0.5, row))
        const g = (x: F, w: number) => exp(x.div(w).mul(x.div(w)).negate())
        const dc = g(dP.sub(0.0004), 0.00042).add(g(dP.sub(0.0019), 0.0004).mul(0.8)).add(g(dD.sub(0.0003), 0.00045))
          .add(g(dR.sub(0.0205), 0.0005).add(g(dR.sub(0.0232), 0.00045).mul(0.6)).mul(float(1).sub(thumb)))
          .add(g(dR.sub(0.0035), 0.0006).mul(0)) // (the thumb's MCP crease is the IP-style double above, at its own joint)
        crease.addAssign(dc.mul(palmar).mul(smoothstep(0.32, 0.12, latP).add(0.15)).mul(mDig).mul(n.flex.mul(1.6).add(0.6)))
        // dorsal skin over the PIP and DIP knuckles: slack rings when the finger is straight, gone when it bends
        // (transverse lines that bow toward the tip at the sides, inside an oval over the joint)
        const bow = lat.mul(lat).mul(60)
        const rrP = length(vec2(dP.sub(0.0008).div(fract(row.mul(0.618).add(0.31)).mul(0.0025).add(0.0042)), lat.div(0.0062))), rrD = length(vec2(dD.sub(0.0004).div(0.0034), lat.div(0.005)))
        // (spacing, depth and reach vary per finger and along each line, so the rings are not ripples)
        const rv = fract(row.mul(0.618).add(0.31))
        const wrP = sin(dP.add(bow).div(nB.mul(0.0005).add(0.00085).add(rv.mul(0.0003))).mul(6.2832).add(nA.mul(3.4))).mul(0.5).add(0.5)
        const wrD = sin(dD.add(bow).div(nB2.mul(0.0004).add(0.00062).add(rv.mul(0.0002))).mul(6.2832).add(nA.mul(3.8))).mul(0.5).add(0.5)
        const slack = float(1).sub(n.flex.mul(0.85))
        const kn = pow(wrP, 4).mul(float(1).sub(smoothstep(0.5, 1, rrP))).add(pow(wrD, 4).mul(float(1).sub(smoothstep(0.5, 1, rrD))).mul(0.7))
          .mul(smoothstep(0.2, 0.55, nA).mul(0.8).add(0.35))
        handH.subAssign(kn.mul(dorsal).mul(mDig).mul(slack).mul(0.00016).mul(vis(0.0009)))
        tint.mulAssign(float(1).sub(kn.mul(dorsal).mul(mDig).mul(slack).mul(0.3).mul(vis(0.0009))))
        cav.mulAssign(float(1).sub(kn.mul(dorsal).mul(mDig).mul(slack).mul(0.25).mul(vis(0.0009))))
        tint.mulAssign(mix(vec3(1), vec3(1.07, 0.9, 0.88), g(dP, 0.0045).add(g(dD, 0.0035).mul(0.7)).mul(dorsal).mul(mDig).mul(0.8)))
        // the pulp and the nail folds flush red; the whole tip a little
        const tipR = smoothstep(0.0, 0.016, dD).mul(mDig)
        tint.mulAssign(mix(vec3(1), vec3(1.12, 0.86, 0.84), tipR.mul(0.6)))
        // -- the palm: three major creases, the wrist's, and a fine net of minor ones
        const p2 = q.xz.toVar()
        If(palmar.mul(onPalm).greaterThan(0.01), () => {
        const cd = min(min(polyD(p2, CREASES[0]), polyD(p2, CREASES[1])), polyD(p2, CREASES[2])).toVar()
        const wrist = g(q.x.sub(0.0015), 0.0006).add(g(q.x.add(0.009), 0.0006).mul(0.6)).mul(smoothstep(0.03, 0.02, abs(q.z)))
        crease.addAssign(g(cd, 0.0009).add(wrist).mul(palmar).mul(onPalm).mul(float(1).sub(smoothstep(0.1, 0.112, q.x))))
        })
        const minor = float(1).sub(smoothstep(0.0, 0.045, abs(vnoise3(q.mul(vec3(95, 60, 140))).sub(0.5)))).mul(palmar).mul(inHand).mul(0.35)
        handH.subAssign(crease.mul(0.00045).mul(vis(0.0016)).add(minor.mul(0.00001).mul(vis(0.0008))))
        tint.mulAssign(float(1).sub(crease.mul(0.34).mul(vis(0.0012)).add(minor.mul(0.06).mul(vis(0.0008)))))
        // (palmar skin has ridges, not the back's pebbled pores: quieten the pores there)
        relief.mulAssign(float(1).sub(palmar.mul(inHand).mul(0.75)))
        // -- dermal ridges on every palmar surface: transverse on the digits, a whorl on each pad, flowing on the palm
        const padC = length(vec2(dD.sub(mix(float(0.0115), float(0.014), thumb)), latP.mul(0.85)))
        const pad = float(1).sub(smoothstep(0.006, 0.0095, padC)).mul(mDig).mul(step(0.0, dD))
        // (ridges flow: a slow warp over centimetres, a little jitter, so they run in sweeps and loops rather than ruled lines)
        const rc = mix(mix(q.x.mul(0.62).add(q.z.mul(0.78)).add(nB.sub(0.5).mul(0.006)), dR.add(nB.sub(0.5).mul(0.0015)), mDig), padC.add(nB2.sub(0.5).mul(0.0012)), pad).add(nA.mul(0.00012))
        const ridge = pow(sin(rc.div(0.00048).mul(6.2832)).mul(0.5).add(0.5), 0.7)
        handH.subAssign(ridge.mul(palmar).mul(inHand).mul(0.00003).mul(vis(0.0011)))
        cav.mulAssign(float(1).sub(ridge.oneMinus().mul(palmar).mul(inHand).mul(0.22).mul(vis(0.0011))))
        // -- the back of the hand: tendons to the knuckles, veins over them, slack rings at the MCP knuckles
        If(float(1).sub(mDig).mul(smoothstep(-0.35, 0.15, qn.y)).greaterThan(0.01), () => {
        const wob0 = (p: V2) => p.add(vec2(0, nB.sub(0.5).mul(0.0018)))
        let tn: F = float(0)
        for (const kk of KNUCK) tn = max(tn, g(polyD(wob0(p2), [[0.014, kk[1] * 0.42], [kk[0] - 0.006, kk[1]]]), 0.0026)) as F
        handH.addAssign(tn.mul(dorsal).mul(onPalm).mul(smoothstep(0.008, 0.035, q.x)).mul(smoothstep(0.095, 0.075, q.x)).mul(0.0003).mul(vis(0.003)))
        let vd: F = float(1)
        const wob = p2.add(vec2(nB.sub(0.5), nB2.sub(0.5)).mul(0.012))
        for (const ln of VEINS) vd = min(vd, polyD(wob, ln)) as F
        const vr = mix(float(0.0026), float(0.0034), smoothstep(0.02, -0.05, q.x)).mul(nB2.mul(0.6).add(0.7))
        const vx = smoothstep(1, 0, vd.div(vr))
        const vein = vx.mul(vx).mul(float(3).sub(vx.mul(2))).mul(smoothstep(-0.35, 0.15, qn.y)).mul(float(1).sub(mDig)).mul(Hd.veins ?? 0.6).mul(smoothstep(0.3, 0.7, nB).mul(0.6).add(0.4)).toVar()
        handH.addAssign(vein.mul(0.00018).mul(vis(0.004)))
        tint.mulAssign(mix(vec3(1), vec3(0.86, 0.91, 1.0), vein.mul(0.5)))
        let kd: F = float(1)
        for (const kk of KNUCK) kd = min(kd, length(p2.sub(vec2(kk[0] + 0.002, kk[1])).mul(vec2(1, 0.8)))) as F
        let kw: F = float(0)
        for (const kk of KNUCK) {
          const dx = q.x.sub(kk[0] + 0.002), dz = q.z.sub(kk[1])
          const lines = pow(sin(dx.add(dz.mul(dz).mul(30)).div(0.0013).mul(6.2832).add(nA.mul(2.6))).mul(0.5).add(0.5), 4)
          kw = max(kw, lines.mul(float(1).sub(smoothstep(0.5, 1, length(vec2(dx.div(0.008), dz.div(0.0075))))))) as F
        }
        handH.subAssign(kw.mul(dorsal).mul(onPalm).mul(0.00014).mul(vis(0.001)))
        cav.mulAssign(float(1).sub(kw.mul(dorsal).mul(onPalm).mul(0.2).mul(vis(0.001))))
        tint.mulAssign(float(1).sub(kw.mul(dorsal).mul(onPalm).mul(0.15).mul(vis(0.001))))
        tint.mulAssign(mix(vec3(1), vec3(1.08, 0.9, 0.88), float(1).sub(smoothstep(0.003, 0.011, kd)).mul(dorsal).mul(onPalm).mul(0.7)))
        })
        // -- skin texture on the back and the forearm: a fine rhomboid net
        const nz = nA.mul(0.18)
        const l1 = abs(fract(q.x.mul(0.62).add(q.z.mul(0.78)).div(0.00095).add(nz)).sub(0.5))
        const l2 = abs(fract(q.x.mul(0.62).sub(q.z.mul(0.78)).div(0.0012).add(nz)).sub(0.5))
        handH.subAssign(smoothstep(0.12, 0.0, l1).add(smoothstep(0.1, 0.0, l2).mul(0.7)).mul(dorsal.mul(0.8).add(0.2)).mul(palmar.oneMinus()).mul(0.000009).mul(vis(0.0011)))
        // -- hair: short dark strands on the forearm, sparse on the back of the hand and the first phalanges
        const dens = (mix(smoothstep(-0.35, 0.1, qn.y).mul(mix(float(1), float(0.35), smoothstep(-0.01, 0.02, q.x))).mul(float(1).sub(smoothstep(0.075, 0.09, q.x))).mul(onPalm.add(smoothstep(-0.016, -0.006, q.x).oneMinus())), dorsal.mul(g(dR.sub(0.022), 0.009)).mul(0.35).mul(float(1).sub(thumb)), mDig).mul(Hd.hair ?? 0.6) as F).toVar()
        If(dens.greaterThan(0.001), () => {
        const hv = voronoi(vec2(q.x.mul(0.94).add(q.z.mul(0.34)).div(0.011), q.z.mul(0.94).sub(q.x.mul(0.34)).div(0.0013)))
        const strand = float(1).sub(smoothstep(0.05, 0.14, hv.x)).mul(step(hash21(hv.yz), dens)).mul(vis(0.0006))
        alb.assign(mix(alb, alb.mul(vec3(0.42, 0.34, 0.28)), strand.mul(hash21(hv.yz.add(3.3)).mul(0.4).add(0.3)).mul(smoothstep(0.25, 0.8, float(1).sub(abs(dot(N, V)))).mul(0.85).add(0.15))))
        })
        // -- colour: a paler palm, the tints above, clay or dust in the creases and on the pads
        alb.assign(mix(alb, col(Hd.palm, alb as V3).mul(n.tint), palmar.mul(onPalm.add(mDig)).mul(0.8)))
        alb.mulAssign(tint)
        if (Hd.clay || Hd.dust) {
          const amt = (Hd.clay ?? 0) + (Hd.dust ?? 0) * 0.35
          const blot = smoothstep(0.45, 0.85, vnoise3(q.mul(520)).mul(0.5).add(vnoise3(q.mul(140)).mul(0.3)).add(vnoise3(q.mul(40)).mul(0.2)))
          const cm = sat(crease.mul(0.9).add(palmar.mul(0.35)).add(blot.mul(0.45)).add(tipR.mul(0.3)) as F).mul(amt)
          alb.assign(mix(alb, col(Hd.clayCol, vec3(0.42, 0.36, 0.28) as V3), cm.mul(0.85)))
          matte.assign(max(matte, cm.mul(0.7)))
          rough.addAssign(cm.mul(0.25))
        }
        rough.addAssign(palmar.mul(0.14).sub(dorsal.mul(0.12)).sub(tipR.mul(0.04)))
        // pigment at several scales: blotches over centimetres, freckle-scale flecks; and a sheen that breaks up
        alb.mulAssign(vec3(1).add(vec3(0.06, -0.01, -0.035).mul(nB.sub(0.5).mul(2))).add(nA.sub(0.5).mul(0.07)))
        rough.addAssign(nA.sub(0.5).mul(0.14).add(nB2.sub(0.5).mul(0.1)))
        if (Hd.callus) {
          // calluses: the pads and the palm under the knuckles thicken, yellow, go matte and stand up a little
          const under = smoothstep(0.075, 0.088, q.x).mul(float(1).sub(smoothstep(0.1, 0.112, q.x))).mul(onPalm)
          const cal = pad.add(under).add(smoothstep(0.003, 0.012, dD).mul(mDig).mul(0.5)).mul(palmar).mul(Hd.callus).mul(smoothstep(0.3, 0.7, nA).mul(0.5).add(0.6))
          alb.assign(mix(alb, alb.mul(vec3(1.06, 1.0, 0.8)).add(0.02), sat(cal as F).mul(0.7)))
          rough.addAssign(cal.mul(0.18))
          handH.addAssign(cal.mul(0.00008).mul(vis(0.002)))
        }
      })
    }
    const nailFree = float(0).toVar()
    if (k.nails) {
      // a fingernail (MAT.horn) is a clear plate over pink flesh: the bed shows the skin through it, pinker; a
      // pale lunula at the root under a thin dry cuticle; the plate's sides sink into their folds (darker); a
      // white-ivory free edge with a line of grime under it on a working hand; fine lengthwise ridges
      const v = n.vBody.x, y = fract(n.vBody.y)
      const lat = abs(y.sub(0.5)).mul(2).oneMinus() // 0 on the midline of the plate's top, 1 at its sides (top ~ y 0)
      const topm = abs(y.mul(2).sub(1))
      const bed = mix(base.mul(vec3(1.12, 0.84, 0.84)), horn, 0.45)
      const lun = float(1).sub(smoothstep(0.13, 0.2, v.add(lat.mul(lat).mul(0.12)))).mul(0.45)
      const cut = float(1).sub(smoothstep(0.03, 0.07, v)).mul(0.6)
      const free = smoothstep(0.93, 0.995, v).mul(0.7)
      const grime = float((k.hand?.clay ?? 0) + (k.hand?.dust ?? 0) * 0.8).mul(smoothstep(0.88, 0.92, v).mul(float(1).sub(smoothstep(0.93, 0.96, v))))
      const band = float(0)
      const side = smoothstep(0.55, 0.95, lat)
      const nailC = mix(mix(mix(bed, bed.mul(1.12).add(vec3(0.05, 0.045, 0.045)), lun), base.mul(1.05), cut), hornTip, free)
        .mul(float(1).sub(band.mul(0.12))).mul(float(1).sub(side.mul(0.35))).mul(topm.mul(0.2).add(0.8)).mul(float(1).sub(grime.mul(0.75)))
      alb.assign(mix(alb, nailC.mul(n.tint), mHorn))
      // a slightly dull bloom over the gloss, and the lengthwise ridges every nail has
      rough.assign(mix(rough, float(0.16).add(free.mul(0.22)).add(cut.mul(0.35)).add(vnoise3(rest.mul(900)).mul(0.16)), mHorn))
      handH.addAssign(sin(y.mul(6.2832 * 34).add(vnoise3(rest.mul(2500)).mul(1.5))).mul(0.0000022).mul(mHorn).div(k.hand?.s ?? 1))
      nailFree.assign(free.mul(mHorn))
    }
    // ---- segment bands (arthropod tergites): each plate lighter at its rear edge, dark in the groove
    if (k.bands) {
      const [b0, b1, bn] = k.bands
      const x = n.vBody.x.sub(b0).div(b1 - b0).mul(bn)
      const fw = max(abs(dFdx(x)), abs(dFdy(x)))
      const f = fract(x)
      const inside = step(b0, n.vBody.x).mul(step(n.vBody.x, b1)).mul(mSkin.add(mShell))
      const groove = smoothstep(0.14, 0.0, f).add(smoothstep(0.9, 1, f).mul(0.5)).mul(smoothstep(0.5, 0.15, fw))
      alb.mulAssign(mix(float(1), mix(float(0.78), float(1.18), f).mul(float(1).sub(groove.mul(0.6))), inside.mul(smoothstep(0.6, 0.2, fw))))
      cav.mulAssign(float(1).sub(groove.mul(inside).mul(0.5)))
    }
    // ---- horn grain and membrane rays: fine lines along the part, faded by footprint
    {
      const u = n.vBody.y.mul(mix(float(46), float(34), mMem))
      const fw = max(abs(dFdx(u)), abs(dFdy(u)))
      const line = sin(u.mul(6.2832)).mul(0.5).add(0.5).mul(smoothstep(0.45, 0.12, fw))
      alb.mulAssign(float(1).sub(line.mul(mHorn.mul(0.18).add(mMem.mul(0.22)))))
    }
    // ---- relief into the normal (screen-space gradient of the height field)
    if ((cell > 0 && (k.relief ?? 0) > 0) || k.fold || k.hand) {
      const dpx = dFdx(n.vW), dpy = dFdy(n.vW)
      const r1 = cross(dpy, N), r2 = cross(N, dpx)
      const det = dot(dpx, r1)
      const hh0 = k.fold ? relief.mul(k.relief ?? 0).add(foldH.mul((k.foldSize ?? 0.2) * 0.16)) : relief.mul(k.relief ?? 0)
      const hh = k.hand ? hh0.add(handH.mul(k.hand.s)) : hh0
      const g = r1.mul(dFdx(hh)).add(r2.mul(dFdy(hh)))
      N.assign(normalize(N.mul(abs(det)).sub(g.mul(sign(det)))))
    }
    // ---- eye
    const lid = float(0).toVar()
    If(mEye.greaterThan(0.5), () => {
      const axis = normalize(vec3(n.eye.x.mul(0.6), n.eye.y.mul(0.6), sign(rest.z)))
      const d = dot(rn, axis)
      if (k.eyeForward) {
        // a forward eye: gaze along +x, turned by the animal's eye offsets; the lids are an almond opening drawn on the ball
        const gaze = normalize(vec3(1, n.eye.y.mul(0.42), n.eye.x.mul(0.42)))
        const g = dot(rn, gaze)
        const lz = rn.z.mul(sign(rest.z))
        const sc = col(k.sclera, vec3(0.72, 0.66, 0.6) as V3)
        const ir = mix(eyeC.mul(0.35), eyeC, smoothstep(0.995, 0.93, g)).mul(smoothstep(0.9, 0.93, g).mul(0.6).add(0.4))
        alb.assign(mix(sc.mul(smoothstep(-0.2, 0.75, g).mul(0.6).add(0.4)), ir, smoothstep(0.9, 0.912, g)))
        alb.assign(mix(alb, vec3(0.003), smoothstep(0.982, 0.988, g)))
        const span = max(float(1).sub(lz.add(0.06).div(0.74).mul(lz.add(0.06).div(0.74))), 0)
        const bot = span.mul(-0.2).sub(0.02)
        const top = mix(span.mul(0.2).add(lz.mul(0.04)), bot, n.blink)
        const open = smoothstep(bot.sub(0.03), bot.add(0.01), rn.y).mul(float(1).sub(smoothstep(top.sub(0.01), top.add(0.03), rn.y))).mul(step(0.3, rn.x))
        lid.assign(float(1).sub(open))
        // the lid: skin, darker along the lash line and in the crease above it
        const lash = smoothstep(top.add(0.16), top.add(0.02), rn.y).mul(step(top, rn.y))
        const crease = float(1).sub(smoothstep(0.0, 0.07, abs(rn.y.sub(top.add(0.3).add(span.mul(0.1))))))
        alb.assign(mix(alb, base.mul(n.tint).mul(float(1).sub(lash.mul(0.72)).sub(crease.mul(0.3))), lid))
        // the upper lid shades the top of the ball
        alb.mulAssign(mix(float(1), smoothstep(top.sub(0.3), top, rn.y).oneMinus().mul(0.65).add(0.35), lid.oneMinus()))
        rough.assign(mix(float(0.08), float(0.6), lid))
      } else if (k.compoundEye) {
        const fc = vec2(n.vBody.y.mul(64), n.vBody.x.mul(22))
        const fw = max(length(dFdx(fc)), length(dFdy(fc)))
        const v = voronoi(fc)
        alb.assign(eyeC.mul(mix(float(1), float(1.25).sub(v.x.mul(1.1)), smoothstep(0.6, 0.2, fw))).add(vec3(0.02, 0.1, 0.12).mul(pow(sat(dot(N, V).oneMinus() as F), 2))))
      } else {
        alb.assign(mix(eyeC.mul(0.45), eyeC, smoothstep(0.5, 0.8, d)))
        alb.assign(mix(alb, vec3(0.004), smoothstep(0.9, 0.93, d)))
      }
      // the lid comes down over it
      if (!k.eyeForward) {
        lid.assign(step(float(1).sub(n.blink.mul(2.2)), rn.y))
        alb.assign(mix(alb, base.mul(0.8).mul(n.tint), lid))
        rough.assign(mix(float(0.08), float(0.6), lid))
      }
    })
    const gloss = mEye.mul(lid.oneMinus()).add(mHorn.mul(k.hornGloss ?? 0.45)).add(mShell.mul(k.shellGloss ?? 0.35)).toVar()
    rough.assign(clamp(rough.sub(gloss.mul(0.4)).sub(wet * 0.3), 0.04, 1))
    alb.mulAssign(1 - wet * 0.3)
    // ---- light
    let sh: F = L.shadow ? L.shadow(n.vW) : float(1)
    if (k.selfShadow && n.trunk) {
      const C = vec3(...n.trunk.c), Rr = vec3(...n.trunk.r)
      const hc = n.heading.x, hs = n.heading.y
      const Lr = vec3(L.key.x.mul(hc).add(L.key.z.mul(hs)), L.key.y, L.key.z.mul(hc).sub(L.key.x.mul(hs)))
      const o0 = rest.sub(C).div(Rr)
      const o = rest.add(rn.mul(n.trunk.r[1] * 0.05)).sub(C).div(Rr.mul(0.92)).toVar()
      const dd = Lr.div(Rr.mul(0.92)).toVar()
      const tca = dot(o, dd).negate().div(dot(dd, dd))
      const cp = o.add(dd.mul(max(tca, 0)))
      const hit = float(1).sub(smoothstep(0.7, 1.2, dot(cp, cp))).mul(step(0, tca)).mul(smoothstep(0.95, 1.35, dot(o0, o0)))
      sh = sh.mul(float(1).sub(hit.mul(k.selfShadow))) as F
    }
    const ndl = dot(N, L.key).toVar()
    const wrap = mix(float(k.wrap ?? 0.35), float(0.6), mMem)
    const dif = sat(ndl.add(wrap).div(wrap.add(1)) as F)
    // subsurface: red light wraps further round than green and blue (skin only)
    const wv = k.sss ? wrap.mul(vec3(1 + 0.4 * k.sss, 1 - 0.08 * k.sss, 1 - 0.22 * k.sss)) : null
    const difC = wv ? mix(vec3(dif), clamp(vec3(ndl).add(wv).div(wv.add(1)), 0, 1), mSkin) : null
    let keyL: V3 = L.keyCol.mul(sh) as V3
    if (k.water?.caustics) keyL = keyL.mul(mix(float(1), k.water.caustics(n.vW), sat(N.y.mul(0.6).add(0.5) as F))) as V3
    let ao: F = n.vAux.y.mul(cav) as F
    if (k.occlude) {
      const ty = n.trunk ? n.trunk.c[1] : 1
      const inner = sat(rn.z.mul(sign(rest.z)).negate() as F).mul(float(1).sub(smoothstep(ty * 0.5, ty * 1.1, rest.y)))
      ao = ao.mul(float(1).sub(clamp(sat(rn.y.negate() as F).mul(0.55).add(inner.mul(0.7)), 0, 1).mul(k.occlude))) as F
    }
    let keyAo: F = float(1)
    if (n.occ) {
      const oc = float(1).sub(clamp(n.occ, 0, 0.85)).toVar()
      ao = ao.mul(oc) as F
      keyAo = mix(float(1), oc, 0.55) as F
    }
    const amb = mix(L.bounce, L.sky, N.y.mul(0.5).add(0.5)).mul(ao)
    // light bleeding through the terminator, and straight through thin parts
    const term = sat(ndl.add(wrap) as F).mul(sat(wrap.sub(ndl) as F)).mul(mSkin.add(mMem))
    const thin = n.vAux.x
    const through = thin.mul(sat(ndl.negate() as F).mul(0.3).add(pow(sat(dot(V, L.key).negate() as F), 3).mul(0.45))).mul(k.glow ?? 1)
    const kd = difC ? keyL.mul(difC) : keyL.mul(dif)
    const c = alb.mul((n.occ ? kd.mul(keyAo) : kd).add(amb)).toVar()
    c.addAssign(keyL.mul(bleed).mul(alb.add(0.15)).mul(term.mul(k.wrap ?? 0.35).mul(1.4).add(through)).mul(matte.oneMinus()))
    if (k.nails) {
      // the free edge is a thin slab of keratin: light comes through it from behind
      c.addAssign(keyL.mul(hornTip).mul(nailFree).mul(pow(sat(dot(V, L.key).negate() as F), 2).mul(0.6).add(0.06)))
    }
    if (k.sss && k.hand) {
      // light through the skin at a silhouette with the key behind it: a red edge on a backlit finger
      const back = pow(sat(dot(V, L.key).negate() as F), 1.5).mul(pow(float(1).sub(abs(dot(N, V))), 2.5))
      c.addAssign(keyL.mul(vec3(1.0, 0.32, 0.18)).mul(alb.add(0.1)).mul(back).mul(k.sss * 0.9).mul(mSkin).mul(matte.oneMinus()))
    }
    // speculars: one broad lobe from roughness, stretched along the body if asked; a tight coat lobe
    const H = normalize(L.key.add(V)).toVar()
    const nh = sat(dot(N, H) as F).toVar()
    const fres = pow(sat(dot(N, V) as F).oneMinus(), 5).toVar()
    const shin = mix(float(260), float(6), rough.sqrt())
    const lobe = pow(nh, shin).mul(shin.add(8).div(40)).toVar()
    if (k.aniso || cards) {
      // direction along the part on the surface, from the gradient of the "along" coordinate
      const dpx = dFdx(n.vW), dpy = dFdy(n.vW)
      const T = normalize(cross(dpy, N).mul(dFdx(along)).add(cross(N, dpx).mul(dFdy(along))).add(vec3(1e-6, 0, 0)))
      const th = dot(T, H)
      const strand = pow(sat(float(1).sub(th.mul(th)) as F).sqrt(), shin.mul(0.5).add(4)).mul(0.5)
      lobe.assign(mix(lobe, strand, cards ? 0.85 : (k.aniso ?? 0)))
    }
    const specAmt = float(k.spec ?? 0.25).mul(mix(float(1), float(2.2), gloss)).mul(mix(float(1), float(0.3), mMem)).mul(1 + wet * 0.8).mul(matte.mul(0.75).oneMinus())
    const coat = clamp(float(k.coat ?? 0).mul(mSkin.add(mShell)).add(gloss.mul(0.7)).add(wet * 0.6), 0, 1).mul(mix(float(1), float(0.25), mMem))
    const tight = pow(nh, 420).mul(5)
    const lit = sat(ndl.mul(4) as F)
    c.addAssign(keyL.mul(lit).mul(lobe.mul(specAmt).mul(mix(float(0.04), float(1), fres).add(0.25)).mul(ao).add(tight.mul(coat))))
    if (!k.compoundEye && k.catchlight !== false) c.addAssign(L.keyCol.add(L.sky).mul(pow(sat(dot(N, normalize(V.add(L.key.mul(0.5)).add(vec3(0, 0.45, 0)))) as F), 220).mul(1.6)).mul(mEye).mul(lid.oneMinus()))
    const R = reflect(V.negate(), N)
    const env = mix(L.bounce, L.sky, smoothstep(-0.3, 0.5, R.y))
    c.addAssign(env.mul(coat).mul(mix(float(0.05), float(1), fres)).mul(ao))
    // rim: the grazing edge picks up the sky, more on the lit side
    c.addAssign(L.sky.add(keyL.mul(sat(ndl.add(0.4) as F)).mul(0.3)).mul(alb.add(0.2)).mul(pow(sat(dot(N, V) as F).oneMinus(), 4)).mul((k.rim ?? 0.25) * 2.5).mul(ao).mul(mEye.oneMinus()))
    const out = k.water?.absorb ? k.water.absorb(c as V3, n.vW, length(cameraPosition.sub(n.vW)) as F) : c
    return vec4(out, 1)
  })()
}

function make(n: SkinNodes, L: Lights, k: Look, cards = false): THREE.NodeMaterial {
  const m = new THREE.NodeMaterial()
  m.vertexNode = n.clip
  m.fragmentNode = surface(n, L, k, cards)
  m.side = cards ? THREE.DoubleSide : THREE.FrontSide
  return m
}

/** Soft hide: a wrapped terminator that bleeds warm, rim light, optional scales and feature scales (`cell`, `feature`). */
export const skinMaterial = (n: SkinNodes, L: Lights, k: Look) => make(n, L, { wrap: 0.4, rough: 0.72, spec: 0.18, rim: 0.3, ...k })
/** Arthropod cuticle: hard specular under a clear coat, segment bands (`bands`), little wrap. */
export const chitinMaterial = (n: SkinNodes, L: Lights, k: Look) => make(n, L, { wrap: 0.12, rough: 0.34, spec: 0.5, coat: 0.5, rim: 0.2, ...k })
/** Overlapping scales: cells with relief and a highlight stretched along the body. Give it `cell`. */
export const scalesMaterial = (n: SkinNodes, L: Lights, k: Look) => make(n, L, { wrap: 0.2, rough: 0.45, spec: 0.45, aniso: 0.6, relief: (k.cell ?? 0.02) * 0.25, cellVary: 0.3, rim: 0.2, ...k })
/** For the cards geometry: feathers, bristles, setae. Two-sided, strand sheen along each card, light through it. */
export const featherMaterial = (n: SkinNodes, L: Lights, k: Look) => make(n, L, { wrap: 0.5, rough: 0.5, spec: 0.35, rim: 0.35, ...k }, true)
/** Any of the above under water: `base` picks the surface, `water` supplies wetness and the scene's caustics and absorption. */
export const underwaterMaterial = (n: SkinNodes, L: Lights, k: Look & { surface?: "skin" | "chitin" | "scales" | "feathers"; water: Water }) => {
  const f = k.surface === "skin" ? skinMaterial : k.surface === "scales" ? scalesMaterial : k.surface === "feathers" ? featherMaterial : chitinMaterial
  return f(n, L, { ...k, water: { wet: 0.7, ...k.water } })
}

/** A ready absorption hook: distance fog toward a water colour, red lost first. `density` per world unit. */
export const waterAbsorb = (water: V3, density: number) => (c: V3, _p: V3, dist: F): V3 => {
  const t = exp(dist.mul(vec3(density * 1.9, density * 1.05, density * 0.8)).negate())
  return mix(water, c, t) as V3
}
/** A ready caustics hook: two drifting cell fields multiplied, sharpened. `time` is the scene's clock uniform. */
export const waterCaustics = (time: F, scale = 1, strength = 0.8) => (p: V3): F => {
  const q = p.xz.div(scale) as V2
  const a = voronoi(q.add(vec2(time.mul(0.11), time.mul(0.07)))).x
  const b = voronoi(q.mul(1.37).add(vec2(time.mul(-0.09), time.mul(0.13))).add(9.1)).x
  return clamp(float(1).add(pow(a.mul(b).mul(1.9), 2).sub(0.3).mul(strength)), 0.55, 1.9) as F
}
