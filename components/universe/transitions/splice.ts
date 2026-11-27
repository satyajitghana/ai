// 19 → 20. Splice.
//
// The outgoing picture is a frame of 35 mm film. At p = 0 it fills the lens; the lens draws back and
// round, and it is one frame on a strip bent through a projector gate: four perforations a frame,
// black frame lines, clear key marks on the black edge, the neighbouring frames dimmer above and
// below (only the aperture is lit through), steel runners either side, the lamp coming through the
// holes. The film loses its loop and jumps the gate (the frame line stutters across the aperture,
// the weave grows), then runs away: the end of the old reel, a tape splice with its own punched
// holes, a few frames of leader. The thick splice jams in the gate. The lamp, which has nowhere to
// put its heat, burns the stuck frame: it browns, blisters into bubbles, a hole opens with a glowing
// edge, and white light floods the lens: the climax, at SPLICE_IN, which is footprint's clock zero.
// The next reel comes up out of the white with a decaying flicker, already running.
//
// What crosses the cut is the medium: the picture becomes film, and the next scene is film.
// Everything is closed-form in linear progress. The film's look (perforations, edge marks, grain,
// scratches) is exported for footprint, which shows the same strip in the same gate.

import * as THREE from "three/webgpu"
import { abs, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, fract, If, length, max, min, mix, normalize, select, positionGeometry, positionWorld, pow, sin, step, uniform, uniformTexture, vec2, vec3, vec4, Discard, modelWorldMatrix, cameraProjectionMatrix, cameraViewMatrix } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, hash21, sampleRT, toLinear, toSRGB, vnoise, voronoi, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const SPLICE_DUR = 2.0
/** White: the burn breaks through. footprint's clock zero. */
export const SPLICE_IN = 0.72

// ---------------------------------------------------------------- 35 mm, in millimetres (exported: footprint shows the same strip)

/** Strip width, frame pitch (four perforations), image half-size (full aperture, 16:9), perforation pitch, half-size, corner, centre line. */
export const FILM = { w: 35, pitch: 19, iw: 12.45, ih: 7.0, pp: 4.75, phx: 1.4, phy: 0.99, pr: 0.5, px: 14.09 } as const

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** smoothstep that also takes a falling edge. */
export const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

/** Signed distance (mm) to the nearest perforation; `P` in strip millimetres (x across, y along). */
export const perfSD = (P: V2): F => {
  const q = vec2(abs(P.x).sub(FILM.px), fract(P.y.div(FILM.pp)).sub(0.5).mul(FILM.pp))
  const d = abs(q).sub(vec2(FILM.phx - FILM.pr, FILM.phy - FILM.pr))
  return length(max(d, 0)).add(min(max(d.x, d.y), 0)).sub(FILM.pr) as F
}

/** Which frame a point of the strip is on, and where on it: vec3(index, local x, local y) with y up. */
export const frameOf = (P: V2): V3 => {
  const k = floor(P.y.div(FILM.pitch).add(0.5))
  return vec3(k, P.x, P.y.sub(k.mul(FILM.pitch))) as V3
}

/** 1 inside the picture area of a frame (with a 1-pixel soft edge from `aa` mm), 0 on the frame line and the edges. */
export const imageMask = (lx: F, ly: F, aa: F): F => sstep(FILM.iw, FILM.iw - 0.06, abs(lx).sub(aa)).mul(sstep(FILM.ih, FILM.ih - 0.06, abs(ly).sub(aa))) as F

/**
 * The clear marks a lab prints on the black edge of a positive between the perforations and the
 * strip's edge: a dash and a dot each frame, no numbers (the deck prints none it cannot source).
 */
export const edgeMarks = (P: V2, k: F): F => {
  const x = abs(P.x).sub(16.45)
  const ly = P.y.sub(k.mul(FILM.pitch))
  const dash = step(abs(x), 0.32).mul(step(abs(ly.sub(2.1)), 1.1))
  const dot = step(length(vec2(x, ly.add(3.9))), 0.34)
  // only on the left edge, and not every frame (the key marks run every foot)
  const on = step(P.x, 0).mul(step(0.45, hash21(vec2(k, 7))))
  return dash.add(dot).mul(on) as F
}

/** Film grain on the strip (moves with the film): two lattices of clumps, signed, about +-1. */
export const filmGrain = (P: V2, k: F): F => {
  const g1 = hash21(floor(P.mul(38)).add(vec2(k.mul(17.3), k.mul(5.1)))).sub(0.5)
  const g2 = vnoise(P.mul(14).add(k.mul(3.7))).sub(0.5)
  return g1.mul(1.3).add(g2.mul(0.9)) as F
}

/** A base scratch that runs along the strip (bright on a positive), wandering a little; `x0` its place. */
export const scratch = (P: V2, x0: number, w: number): F => {
  const x = P.x.sub(x0).sub(sin(P.y.mul(0.021)).mul(0.35)).sub(vnoise(vec2(P.y.mul(0.05), x0)).mul(0.25))
  const broken = step(0.3, vnoise(vec2(P.y.mul(0.09), x0 * 3)))
  return sstep(w, 0, abs(x)).mul(broken) as F
}

// ---------------------------------------------------------------- the strip's motion

const FOV = 30
const D0 = FILM.ih / Math.tan((FOV * Math.PI) / 360) // the image area fills the lens from here
const SPLICE_K = 3 // the frame that carries the splice: it jams
const LEADER = [4, 5] // the head of the next reel
/** Frames run through the gate: a stutter, then a run, then the jam on the splice. */
function scroll(p: number) {
  // the loop is lost: slips of part of a frame, each a quick jerk with a little settle
  const slips: [number, number][] = [
    [0.21, 0.32],
    [0.255, 0.22],
    [0.29, -0.12],
    [0.325, 0.4],
    [0.36, 0.3],
    [0.39, 0.33],
  ]
  let s = 0
  for (const [at, d] of slips) {
    const u = (p - at) / 0.022
    if (u > 0) s += d * (u >= 1 ? 1 + 0.12 * Math.exp(-(u - 1) * 1.5) * Math.sin((u - 1) * 3) : E.in2(u))
  }
  // then it runs, accelerating, and stops dead on the splice
  const r = clamp((p - 0.42) / (0.55 - 0.42))
  const s0 = 1.45
  s = p < 0.42 ? s : s0 + (SPLICE_K - s0) * E.in3(r)
  if (p >= 0.55) s = SPLICE_K + 0.05 * Math.exp(-(p - 0.55) * 60) * Math.sin((p - 0.55) * 140)
  return s
}

const t: TransitionDef = {
  id: "splice",
  dur: SPLICE_DUR,
  inAt: SPLICE_IN,
  ease: E.lin,
  snd: [
    { s: "shutter", p: 0.08, o: { g: 0.25, pos: [0, 0, 0.3] } },
    { s: "tick", p: 0.21, o: { f: H(40), g: 0.5, pos: [0, 0.3, 0.2] } },
    { s: "tick", p: 0.255, o: { f: H(36), g: 0.45, pos: [0.1, 0.2, 0.2] } },
    { s: "scratch", p: 0.29, o: { f: 420, g: 0.25, dur: 0.15, pos: [-0.2, 0, 0.2] } },
    { s: "tick", p: 0.325, o: { f: H(44), g: 0.55, pos: [0, 0.1, 0.2] } },
    { s: "tick", p: 0.36, o: { f: H(40), g: 0.5, pos: [0.1, 0, 0.2] } },
    { s: "gear", p: 0.4, o: { f: H(9), g: 0.35, dur: 0.25, pos: [0.3, 0.2, 0.3] } },
    { s: "whoosh", p: 0.43, o: { f: 300, g: 0.3, dur: 0.3 } },
    { s: "flap", p: 0.505, o: { f: 190, g: 0.5, pos: [0, 0.2, 0] } },
    { s: "thud", p: 0.55, o: { f: H(3), g: 0.6, pos: [0, 0, 0] } },
    { s: "shutter", p: 0.551, o: { g: 0.6, pos: [0, 0, 0] } },
    { s: "sizzle", p: 0.58, o: { g: 0.45, dur: 0.35, pos: [-0.15, 0.05, 0] } },
    { s: "crackle", p: 0.6, o: { g: 0.5, dur: 0.3, pos: [-0.1, 0.1, 0] } },
    { s: "riser", p: 0.57, o: { g: 0.4, dur: 0.3 } },
    { s: "crack", p: SPLICE_IN, o: { g: 0.7, pos: [0, 0, 0] } },
    { s: "shimmer", p: SPLICE_IN, o: { g: 0.45, f: H(16) } },
    { s: "sub", p: SPLICE_IN, o: { g: 0.5 } },
  ],
  /** The projector runs until the jam; the next reel's starts as the white clears. */
  sound(pl, _prev, synth) {
    const run = smooth(0.02, 0.2, pl) * (pl < 0.55 ? 1 + 0.6 * smooth(0.42, 0.55, pl) : 0) + (pl > SPLICE_IN ? smooth(SPLICE_IN, 0.9, pl) : 0)
    synth.bed("projector", 0.55 * run)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(hold.texture),
      s: uniform(0), // frames scrolled past the gate
      weave: uniform(new THREE.Vector2()),
      lamp: uniform(1),
      burn: uniform(0), // 0..1 through the burn
      blur: uniform(0), // frames of motion in one exposure
      white: uniform(0),
      bIn: uniform(0),
      flick: uniform(0),
      fx: uniform(0), // the film's own marks ramp in over the first moments, so p = 0 meets the picture
      after: uniform(0), // past the white: the next reel
      camP: uniform(new THREE.Vector3()),
    }
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 2000)

    // ---- the strip: a plane in the gate, flat over the aperture and bending back over the gate's curve above and below
    const BEND = 11.5, RAD = 26
    const stripGeo = new THREE.PlaneGeometry(FILM.w, 150, 1, 240)
    const stripMat = new THREE.NodeMaterial()
    stripMat.side = THREE.DoubleSide
    {
      const g = positionGeometry
      const ay = abs(g.y)
      const over = max(ay.sub(BEND), 0)
      const ang = over.div(RAD)
      const yb = select3(ay.greaterThan(BEND), float(BEND).add(sin(ang).mul(RAD)), ay).mul(sign1(g.y))
      const zb = cos(ang).oneMinus().mul(RAD).negate()
      const local = vec3(g.x.add(U.weave.x), yb, zb)
      const world = modelWorldMatrix.mul(vec4(local, 1)).xyz
      stripMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
      const film = vec2(g.x, g.y.add(U.s.mul(FILM.pitch)).add(U.weave.y)).toVarying()
      const flat = g.y.toVarying()
      const Pw = world.toVarying()
      stripMat.fragmentNode = Fn(() => {
        const P = film
        const aa = max(abs(dFdx(P.y)).add(abs(dFdy(P.y))), 0.004)
        // a perforation is a hole: what is behind it is the gate
        Discard(perfSD(P as V2).lessThan(0))
        const f = frameOf(P as V2)
        const k = f.x, lx = f.y, ly = f.z
        // where the lamp comes through: the aperture, a hair bigger than the picture
        const ap = sstep(FILM.iw + 0.4, FILM.iw + 0.1, abs(P.x)).mul(sstep(FILM.ih + 0.5, FILM.ih + 0.2, abs(flat.sub(U.weave.y))))
        const img = imageMask(lx, ly, aa)
        const uv = vec2(lx.div(FILM.iw * 2).add(0.5), ly.div(FILM.ih * 2).add(0.5))
        // the content of frame k, as a transparency (linear): the old reel, the splice, leader, the new reel
        const cA = toLinear(sampleRT(U.tA, uv as V2).rgb).toVar()
        const cB = toLinear(sampleRT(U.tB, uv as V2).rgb)
        // motion within one exposure: a vertical smear of the picture when the strip is running
        If(U.blur.greaterThan(0.02), () => {
          const acc = vec3(0).toVar()
          for (let i = 0; i < 5; i++) {
            const o = (i / 4 - 0.5) * 1
            acc.addAssign(toLinear(sampleRT(U.tA, vec2(uv.x, uv.y.add(U.blur.mul(o * 1.36))) as V2).rgb))
          }
          cA.assign(acc.div(5))
        })
        const tr = cA.toVar()
        const isB = step(LEADER[1] + 0.5, k)
        const isLeader = step(SPLICE_K + 0.5, k).mul(isB.oneMinus())
        tr.assign(mix(tr, cB, isB))
        tr.assign(mix(tr, vec3(0.012, 0.011, 0.01), isLeader))
        // the splice: a butt cut across frame 3, clear tape over it with its own row of holes
        const isS = step(abs(k.sub(SPLICE_K)), 0.5)
        const cut = sstep(0.06, 0.0, abs(ly.sub(2.2).add(lx.mul(0.04))))
        const tape = isS.mul(sstep(9.6, 9.3, abs(ly.sub(2.2))))
        const above = step(2.2, ly.add(lx.mul(0.04))).mul(isS)
        tr.assign(mix(tr, vec3(0.012, 0.011, 0.01), above))
        // grain, dust and a long scratch
        const gr = filmGrain(P as V2, k)
        tr.mulAssign(gr.mul(U.fx.mul(0.12)).add(1))
        const dust = step(0.985, hash21(floor(P.mul(1.6)).add(k.mul(13.1)))).mul(sstep(0.35, 0.1, length(fract(P.mul(1.6)).sub(0.5))))
        tr.mulAssign(dust.mul(U.fx.mul(-0.85)).add(1))
        tr.addAssign(scratch(P as V2, -4.3, 0.05).mul(U.fx.mul(U.fx).mul(0.45)))
        // the frame line and the edges are black on a positive; the key marks are clear
        const dens = mix(vec3(0.006, 0.0055, 0.005), tr, img).toVar()
        dens.addAssign(edgeMarks(P as V2, k).mul(0.6))
        // the burn: browning, blisters, a hole with a glowing lip (on the stuck frame only)
        const bc = vec2(lx.add(3.2), ly.sub(1.0))
        const wob = fbm(bc.mul(0.35).add(7.1)).sub(0.5).mul(5)
        const d = length(bc.mul(vec2(0.85, 1))).add(wob).toVar()
        const rB = U.burn.mul(16).add(U.burn.mul(U.burn).mul(18))
        const rH = max(U.burn.sub(0.6), 0).mul(50)
        const onS = isS
        const brown = sstep(rB, rB.mul(0.55), d).mul(onS)
        const vor = voronoi(P.mul(1.3).add(vec2(3.1, 0)))
        const blister = sstep(rB.mul(0.85), rB.mul(0.35), d).mul(sstep(0.25, 0.05, vor.x)).mul(onS)
        const charred = sstep(rH.add(2.2), rH.add(0.6), d).mul(onS)
        const lip = sstep(rH.add(0.9), rH, d).mul(onS)
        const hole = step(d, rH).mul(onS).mul(step(0.001, rH))
        dens.assign(mix(dens, dens.mul(vec3(0.85, 0.5, 0.2)).add(vec3(0.05, 0.022, 0.005)), brown))
        dens.assign(mix(dens, vec3(0.03, 0.02, 0.012), blister.mul(0.6)))
        dens.assign(mix(dens, vec3(0.004), charred))
        // the light that gets through: the lamp over the aperture, a trace of it elsewhere
        const lampHere = mix(float(0.035), U.lamp, ap)
        const through = dens.mul(lampHere).toVar()
        through.addAssign(vec3(3.2, 1.4, 0.35).mul(lip).mul(U.burn.mul(2).min(1)))
        through.assign(mix(through, vec3(6, 5.4, 4.6), hole))
        // the base catches the front spill: a soft sheen on both faces
        const n0 = cross(dFdx(Pw), dFdy(Pw))
        const V = normalize(U.camP.sub(Pw))
        const N = normalize(n0.mul(sign1(dot(n0, V))))
        const H2 = normalize(V.add(normalize(vec3(-0.4, 0.7, 0.6))))
        const sheen = pow(max(dot(N, H2), 0), 90).mul(0.18).add(pow(max(dot(N, H2), 0), 8).mul(0.006))
        const tape2 = tape.mul(0.06).add(1)
        const c = through.add(vec3(0.95, 0.9, 0.82).mul(sheen).mul(tape2))
        // the splice's tape: a faint milky film over the cut and a bright cut line
        c.addAssign(vec3(0.04, 0.04, 0.035).mul(tape).mul(lampHere.mul(2).add(0.3)))
        c.addAssign(vec3(0.3, 0.28, 0.25).mul(cut).mul(isS).mul(ap.add(0.15)))
        return vec4(toSRGB(clampN(mix(c, c.div(c.mul(0.12).add(1)).mul(1.12), U.fx), 0, 1) as V3), 1)
      })()
    }
    const strip = new THREE.Mesh(stripGeo, stripMat)
    scene.add(strip)

    // ---- the gate: a steel plate behind the film with the aperture cut in it; the lamp beyond; two polished runners in front
    const plateMat = new THREE.NodeMaterial()
    plateMat.fragmentNode = Fn(() => {
      const P = positionWorld
      const inAp = sstep(FILM.iw + 0.35, FILM.iw + 0.15, abs(P.x)).mul(sstep(FILM.ih + 0.45, FILM.ih + 0.25, abs(P.y)))
      const brush = vnoise(vec2(P.x.mul(2.5), P.y.mul(0.08))).mul(0.25).add(vnoise(vec2(P.x.mul(30), P.y.mul(0.5))).mul(0.15)).add(0.6)
      // the polished film track, worn bright where the edges run, darker blued steel elsewhere, a glow of lamp round the aperture
      const track = sstep(17.6, 17.2, abs(P.x)).mul(sstep(13.4, 13.8, abs(P.x)))
      const steel = mix(vec3(0.03, 0.032, 0.038), vec3(0.11, 0.105, 0.1), track).mul(brush)
      const spill = exp(length(P.xy.div(vec2(1.5, 1))).mul(-0.11)).mul(U.lamp).mul(2.2)
      const lit = steel.mul(spill.add(0.2)).mul(vec3(1.1, 1.0, 0.9)).add(vec3(0.5, 0.3, 0.12).mul(spill.mul(spill)).mul(0.08))
      const c = mix(lit, vec3(5.2, 4.4, 3.4).mul(U.lamp), inAp)
      return vec4(toSRGB(clampN(c.div(c.mul(0.12).add(1)).mul(1.12), 0, 1) as V3), 1)
    })()
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), plateMat)
    plate.position.z = -0.9
    scene.add(plate)
    const railMat = new THREE.NodeMaterial()
    railMat.fragmentNode = Fn(() => {
      const P = positionWorld
      const n0 = cross(dFdx(P), dFdy(P))
      const N = normalize(n0)
      const V = normalize(U.camP.sub(P))
      const L = normalize(vec3(-0.3, 0.8, 0.6))
      const spec = pow(max(dot(N, normalize(V.add(L))), 0), 60)
      const brush = vnoise(vec2(P.x.mul(40), P.y.mul(0.2))).mul(0.15).add(0.85)
      const band = pow(max(dot(N, normalize(V.add(vec3(0, 0.3, 1)))), 0), 8).mul(0.18)
      const c = vec3(0.022, 0.023, 0.026).mul(brush).add(vec3(0.6, 0.62, 0.66).mul(band)).add(vec3(1.4, 1.25, 1.05).mul(spec)).add(vec3(0.5, 0.35, 0.2).mul(U.lamp).mul(exp(abs(P.y).mul(-0.07))).mul(0.12))
      return vec4(toSRGB(clampN(c, 0, 1) as V3), 1)
    })()
    for (const x of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 60, 1.6), railMat)
      rail.position.set(x * (FILM.w / 2 + 1.9), 0, 0.3)
      scene.add(rail)
    }

    // ---- the composite: the gate, the white, and the next reel coming up out of it
    const pass = ctx.pass(({ uv }) => {
      const g = sampleRT(U.tS, uv).rgb
      const c = mix(g, vec3(1, 0.985, 0.95), U.white).toVar()
      // a little of the white blooms off the hole's edge before it takes the frame
      const b = sampleRT(U.tB, uv).rgb
      const fl2 = U.flick
      const nb = mix(vec3(1, 0.985, 0.95), b.mul(fl2.add(1)).add(vec3(0.06, 0.05, 0.03).mul(fl2.abs())), U.bIn)
      return vec4(mix(c, nb, U.after), 1)
    }, U)

    const tgt = new THREE.Vector3()
    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        const s = scroll(p)
        U.s.value = s
        // the strip's speed in frames per exposure (for the smear), from the scroll's slope
        const v = Math.abs(scroll(p + 0.004) - scroll(p - 0.004)) / 0.008 / SPLICE_DUR
        U.blur.value = clamp(v / 48, 0, 1.4)
        // weave grows as the loop is lost and holds while it runs
        U.fx.value = smooth(0, 0.08, p)
        const wv = (0.02 * smooth(0, 0.08, p)) + 0.12 * smooth(0.18, 0.4, p) * (p < 0.55 ? 1 : Math.exp(-(p - 0.55) * 30))
        const fr = Math.floor(p * SPLICE_DUR * 24)
        U.weave.value.set(wv * Math.sin(fr * 2.71 + 0.4) * (p > 0.02 ? 1 : 0), wv * 0.6 * Math.sin(fr * 1.93 + 1.7) * (p > 0.02 ? 1 : 0))
        // the lamp flickers with the shutter while running; at the jam it is steady, and hotter
        const run = p > 0.04 && p < 0.55
        U.lamp.value = (run ? 1 - 0.22 * (fr % 2) * smooth(0.04, 0.2, p) : 1) * (1 + 0.6 * smooth(0.55, 0.7, p))
        U.burn.value = smooth(0.56, SPLICE_IN, p)
        U.white.value = E.in3(smooth(0.67, SPLICE_IN, p))
        U.after.value = p >= SPLICE_IN ? 1 : 0
        U.bIn.value = p >= SPLICE_IN ? E.out2(smooth(SPLICE_IN, 0.97, p)) : 0
        const decay = 1 - smooth(SPLICE_IN, 0.97, p)
        U.flick.value = p >= SPLICE_IN ? 0.22 * decay * (Math.floor(p * SPLICE_DUR * 24) % 2 ? 1 : -0.6) : 0
        // the lens: back and round from the frame filling it, then in on the burn
        const back = smooth(0, 0.2, p)
        const inB = E.io2(smooth(0.5, SPLICE_IN, p))
        const D = D0 * (1 + 1.25 * back - 1.5 * inB)
        const yaw = 0.42 * back * (1 - inB)
        const pitch = -0.28 * back * (1 - inB)
        const kn = p > 0.55 ? Math.exp(-(p - 0.55) * 40) * Math.sin((p - 0.55) * 200) * 0.6 : 0
        cam.aspect = asp
        cam.position.set(D * Math.sin(yaw) * Math.cos(pitch) + 0.25 * Math.sin(a.time * 1.3) * back, D * Math.sin(pitch) + kn, D * Math.cos(yaw) * Math.cos(pitch))
        tgt.set(-3.2 * inB, 1.0 * inB - 2.5 * back * (1 - inB), 0)
        cam.lookAt(tgt)
        cam.updateProjectionMatrix()
        cam.updateMatrixWorld()
        U.camP.value.copy(cam.position)
        const r = ctx.renderer
        if (p < SPLICE_IN) {
          r.setClearColor(0x020202, 1)
          r.setRenderTarget(rt)
          r.render(scene, cam)
          U.tS.value = rt.texture
        }
        pass.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: rt },
        { pass, target: hold },
      ],
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

/** Pick a or b by a boolean node (both floats). */
function select3(c: THREE.Node<"bool">, a: F, b: F): F {
  return select(c, a, b) as F
}
/** sign without zero. */
function sign1(x: F): F {
  return step(0, x).mul(2).sub(1) as F
}
