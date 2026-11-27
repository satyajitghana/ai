// 18 → 19. Ticker.
//
// The outgoing picture is paper. At p = 0 it fills the lens, flat: sixteen narrow register tapes
// laid edge to edge, which is what it turns out to be. A brass comb of styli (the register's
// embossing bar) crosses it from the left in three bursts, one sounder click pair each, and behind
// it the picture is a halftone in dots and dashes: three tracks to a tape, each mark as long as the
// picture was dark there (a black frame survives as solid dashes with a paper margin; the bright
// spectrum is a field of dots). The lens draws back and round: the tapes part, each a ribbon paid
// off its own small reel on a common spindle at the left, round a guide post, past the register
// and through the feed rollers at the right, over a mahogany base. Behind them, through the gaps,
// is the incoming scene (the engine house, still at rest). The clockwork runs: the ribbons stream
// right, fluttering, faster and faster; the picture slides off them as a block. One by one, top
// first and crowding toward the end, the reels run out: each tail snaps free with a click and
// whips across the frame. The last one is TICKER_IN: the last clack, the lens pushes through where
// the ribbons were into the engine house, whose first stroke starts on the snap.
//
// What crosses the cut is the picture, as a message. Everything is closed-form in linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, dot, exp, float, floor, Fn, fract, length, max, min, mix, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, sin, sqrt, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, hash21, luma, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const TICKER_DUR = 2.2
/** The last clack, and the last tape snapping free of its reel: `engine`'s clock zero. */
export const TICKER_IN = 0.7

const FOV = 30
const D0 = 1 / Math.tan((FOV * Math.PI) / 360) // the picture (height 2) fills the frame from here
const NT = 16 // tapes
const TW = 2 / NT // a tape's width
const LEN = 15 // paper on the last reel beyond the picture
const SPAN = 17 // the drawn length of each tape, from its reel
const R_FULL = 0.55, R_CORE = 0.1, ZR = -0.6
const GAP = 1.0 // how far apart the tapes stand once parted, in tape widths
const NR = 48 // styli: tracks of marks across the picture (three to a tape)
const BURSTS = [0.03, 0.09, 0.15]
/** When each tape's tail leaves its reel: the top one first, crowding toward the last. */
const SNAP: number[] = Array.from({ length: NT }, (_, j) => TICKER_IN - 0.27 * Math.pow(1 - j / (NT - 1), 1.7))
/** The paper each reel holds, so that its tail leaves at its SNAP. Index by tape, 0 at the bottom. */
const LENK: number[] = Array.from({ length: NT }, (_, k) => LEN * E.in2((SNAP[NT - 1 - k] - 0.2) / (TICKER_IN - 0.2)))
const PK: number[] = Array.from({ length: NT }, (_, k) => SNAP[NT - 1 - k])

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

/** How far the tapes have run (material units), as a function of linear progress. */
const scrollAt = (p: number) => {
  if (p < 0.2) return 0
  if (p < TICKER_IN) return LEN * E.in2((p - 0.2) / (TICKER_IN - 0.2))
  // the rollers keep pulling, a little faster with nothing to drag
  return LEN + ((2 * LEN) / (TICKER_IN - 0.2)) * 1.25 * (p - TICKER_IN)
}
const speedAt = (p: number) => (scrollAt(Math.min(1, p + 0.004)) - scrollAt(Math.max(0, p - 0.004))) / 0.008 / TICKER_DUR // units a second
const radiusAt = (s: number, len: number) => Math.sqrt(R_CORE * R_CORE + ((R_FULL * R_FULL - R_CORE * R_CORE) / len) * Math.max(0, len - s))
/** A reel's turn: the integral of ds / R(s) in closed form until it empties; then it coasts down. */
const reelTurn = (p: number, len: number, pk: number) => {
  const K = (R_FULL * R_FULL - R_CORE * R_CORE) / len
  const s = Math.min(scrollAt(p), len)
  const th = (2 / K) * (Math.sqrt(R_CORE * R_CORE + K * len) - Math.sqrt(R_CORE * R_CORE + K * (len - s)))
  if (p <= pk) return th
  const age = (p - pk) * TICKER_DUR
  const w = speedAt(pk - 0.001) / R_CORE
  return th + w * 0.3 * (1 - Math.exp(-age / 0.3))
}

const t: TransitionDef = {
  id: "ticker",
  dur: TICKER_DUR,
  inAt: TICKER_IN,
  ease: E.lin,
  snd: [
    ...BURSTS.map((p, i) => ({ s: "telegraph" as const, p, o: { g: 0.75, dur: 0.07 + 0.03 * i, pos: [-0.6 + 0.55 * i, 0, 0.1] as [number, number, number] } })),
    { s: "gear", p: 0.2, o: { g: 0.4, dur: 1.1, f: H(9), pos: [-0.7, -0.2, 0.3] } },
    { s: "telegraph", p: 0.27, o: { g: 0.5, dur: 0.1, pos: [0.45, 0.25, 0.2] } },
    { s: "telegraph", p: 0.35, o: { g: 0.5, dur: 0.06, pos: [0.45, 0.25, 0.2] } },
    { s: "whoosh", p: 0.4, o: { g: 0.22, f: 220, dur: 0.6 } },
    // a tail leaving its reel: a click and a flick of paper, top to bottom, crowding together
    ...SNAP.slice(0, NT - 1).map((p, j) => ({ s: "telegraph" as const, p, o: { g: 0.4 + 0.03 * j, dur: Math.max(0.025, 0.09 - 0.004 * j), pos: [-0.7, 0.8 - (1.6 * j) / NT, 0.2] as [number, number, number] } })),
    ...SNAP.slice(0, NT - 1).filter((_, j) => j % 3 === 0).map((p, j) => ({ s: "flap" as const, p: p + 0.006, o: { g: 0.25 + 0.04 * j, f: 260, pos: [-0.2, 0.7 - 0.3 * j, 0.1] as [number, number, number] } })),
    { s: "gear", p: 0.55, o: { g: 0.35, dur: 0.5, f: H(12), pos: [-0.8, -0.2, 0.3] } },
    { s: "telegraph", p: TICKER_IN, o: { g: 1, dur: 0.03, pos: [0.3, -0.6, 0] } },
    { s: "crack", p: TICKER_IN, o: { g: 0.8, pos: [-0.7, -0.6, 0.1] } },
    { s: "flap", p: TICKER_IN + 0.01, o: { g: 0.6, f: 240, pos: [0.2, -0.4, -0.2] } },
    { s: "whoosh", p: TICKER_IN + 0.02, o: { g: 0.38, f: 150, dur: 0.55 } },
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
      scroll: uniform(0),
      speed: uniform(0),
      front: uniform(-99), // the embossing front, in tape units
      xr: uniform(-4.4),
      xg: uniform(-3.2),
      xo: uniform(3.0),
      m0: uniform(2.6), // where the picture starts on every tape
      tint: uniform(1),
      gap: uniform(0),
      pull: uniform(0),
      push: uniform(0),
      shake: uniform(new THREE.Vector2()),
    }
    const KEY = normalize(vec3(-0.45, 0.6, 0.66))
    const KEYC = vec3(1.0, 0.86, 0.66).mul(2.3)
    const AMB = vec3(0.07, 0.07, 0.085)
    const lit = (alb: V3, N: V3, P: V3, gloss: Num, shine = 60): V3 => {
      const V = normalize(vec3(0, 0, 8).sub(P))
      const sp = pow(max(dot(N, normalize(KEY.add(V))), 0), shine).mul(gloss)
      // a pool of lamplight on the instrument, falling off into the room
      const pool = exp(length(P.xy.sub(vec2(-1.2, 0.4))).mul(-0.13)).mul(0.8).add(0.2)
      return alb.mul(KEYC.mul(max(dot(N, KEY), 0)).mul(pool).add(AMB)).add(KEYC.mul(sp).mul(pool)) as V3
    }
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 80)
    const vp = cameraProjectionMatrix.mul(cameraViewMatrix)

    // ---- materials for the instrument: brass, mahogany, rubber, copper wire
    const solid = (kind: "brass" | "wood" | "rubber" | "copper" | "iron", tone: [number, number, number]) => {
      const m = new THREE.NodeMaterial()
      m.fragmentNode = Fn(() => {
        const q = positionLocal
        const P = positionWorld
        const N = normalize(normalWorld)
        const alb = vec3(...tone).toVar()
        const gloss = float(0.05).toVar()
        let shine = 70
        if (kind === "brass" || kind === "copper") {
          // turned brass: lathe rings, tarnish gone brown in the recesses, bright where hands and the tape rub it
          const tarn = fbm(vec2(q.y.mul(9).add(q.x.mul(3)), q.z.mul(11).add(q.x.mul(7)))).toVar()
          const rings = vnoise(vec2(q.y.mul(600), q.x.mul(3))).mul(0.25).add(0.85)
          const rub = sstep(0.55, 0.8, vnoise(vec2(q.y.mul(2.2), q.x.mul(1.3).add(q.z))))
          alb.mulAssign(tarn.mul(0.5).add(0.55).mul(rings))
          alb.assign(mix(alb, vec3(0.16, 0.1, 0.04), sstep(0.6, 0.85, tarn).mul(0.55)))
          alb.assign(mix(alb, vec3(0.85, 0.66, 0.32), rub.mul(0.6)))
          gloss.assign(tarn.oneMinus().mul(1.0).add(0.25).add(rub.mul(1.2)))
          if (kind === "copper") alb.mulAssign(vnoise(vec2(q.y.mul(900), q.x.mul(40))).mul(0.4).add(0.75)) // windings
        } else if (kind === "wood") {
          // quarter-sawn mahogany under French polish: growth rings in long bands, open pores, a ray fleck
          const warp = vnoise(vec2(P.x.mul(0.35), P.z.mul(1.3))).mul(5)
          const ring = sin(P.z.mul(34).add(warp).add(P.y.mul(9))).mul(0.5).add(0.5)
          const pore = step(0.8, vnoise(vec2(P.x.mul(30), P.z.mul(500))))
          const fleck = sstep(0.82, 0.95, vnoise(vec2(P.x.mul(6), P.z.mul(18))))
          alb.mulAssign(ring.mul(0.45).add(0.65).mul(pore.mul(-0.35).add(1)).add(fleck.mul(0.35)))
          alb.mulAssign(fbm(vec2(P.x.mul(0.6), P.z.mul(2))).mul(0.5).add(0.7))
          gloss.assign(float(0.5).sub(pore.mul(0.3)))
          shine = 40
        } else if (kind === "rubber") {
          gloss.assign(0.25)
        } else {
          alb.mulAssign(vnoise(q.xy.mul(80)).mul(0.4).add(0.7))
          gloss.assign(0.4)
        }
        return vec4(toSRGB(lit(alb as V3, N as V3, P as V3, gloss, shine)), 1)
      })()
      return m
    }
    const MB = solid("brass", [0.58, 0.4, 0.15]), MW = solid("wood", [0.11, 0.035, 0.018]), MR = solid("rubber", [0.025, 0.022, 0.02]), MC = solid("copper", [0.5, 0.2, 0.08]), MI = solid("iron", [0.06, 0.06, 0.065])
    const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = scene) => {
      const o = new THREE.Mesh(g, m)
      parent.add(o)
      return o
    }
    /** A tape's centre line height for tape k (0 at the bottom), with the tapes parted by `gap`. */
    const lane = (k: number, gap: number) => ((k + 0.5) * TW - 1) * (1 + GAP * gap)

    // ---- the tapes: sixteen ribbons in one draw, each bent along its own path in the vertex stage
    const tapeGeo = (() => {
      const g = new THREE.PlaneGeometry(1, 1, 520, 2)
      const n = g.getAttribute("position").count
      const pos = new Float32Array(n * 3 * NT), tk = new Float32Array(n * 4 * NT)
      const idx: number[] = []
      const src = g.getAttribute("position").array as Float32Array
      const si = g.index!.array
      for (let k = 0; k < NT; k++) {
        pos.set(src, k * n * 3)
        for (let i = 0; i < n; i++) tk.set([k, LENK[k], PK[k], 0], (k * n + i) * 4)
        for (let i = 0; i < si.length; i++) idx.push(si[i] + k * n)
      }
      g.dispose()
      const out = new THREE.BufferGeometry()
      out.setAttribute("position", new THREE.BufferAttribute(pos, 3))
      out.setAttribute("aT", new THREE.BufferAttribute(tk, 4))
      out.setIndex(idx)
      return out
    })()
    const aT = attribute("aT", "vec4") as unknown as V4
    const tapeMat = new THREE.NodeMaterial()
    const gx = positionGeometry.x.add(0.5)
    const gv = positionGeometry.y.add(0.5)
    const kk = aT.x
    const lenK = aT.y
    const Xraw = U.xr.add(gx.mul(SPAN))
    const xEnd = U.xr.add(U.scroll).sub(lenK)
    const Xe = max(max(Xraw, xEnd), U.xr).toVar()
    const m = Xe.sub(U.xr).sub(U.scroll)
    const spN = clampN(U.speed.div(30), 0, 1)
    const radius = sqrt(max(lenK.sub(U.scroll), 0).mul((R_FULL * R_FULL - R_CORE * R_CORE)).div(lenK).add(R_CORE * R_CORE))
    const tapeW = Fn(() => {
      // off the top of its reel, round the guide post, straight to the rollers, free beyond them
      const toG = clampN(Xe.sub(U.xr).div(U.xg.sub(U.xr)), 0, 1)
      const z = mix(radius.add(ZR), float(0), toG).toVar()
      const yc = kk.add(0.5).mul(TW).sub(1).mul(U.gap.mul(GAP).add(1))
      const y = yc.add(gv.sub(0.5).mul(TW)).toVar()
      const env = sin(clampN(Xe.sub(U.xg).div(U.xo.sub(U.xg)), 0, 1).mul(Math.PI))
      z.addAssign(env.mul(spN).mul(sin(Xe.mul(2.1).sub(U.scroll.mul(1.3)).add(kk.mul(1.7))).mul(0.12).add(sin(Xe.mul(5.7).add(U.scroll.mul(2.1)).add(kk)).mul(0.04))))
      // a ribbon twists as it flutters: its edges ride a little ahead of and behind its centre
      z.addAssign(gv.sub(0.5).mul(TW).mul(env).mul(spN).mul(sin(Xe.mul(1.3).sub(U.scroll).add(kk.mul(2.3))).mul(2.2)))
      const past = max(Xe.sub(U.xo), 0)
      z.addAssign(past.mul(sin(Xe.mul(1.7).sub(U.scroll.mul(0.9)).add(kk)).mul(0.12).mul(spN)))
      y.subAssign(past.mul(past).mul(0.02).mul(spN.mul(-0.6).add(1)))
      // the tail, free of the core: it whips, twists and lifts as it is dragged away
      const sTail = Xe.sub(xEnd)
      const age = U.p.sub(aT.z).mul(TICKER_DUR)
      const ag = max(age, 0)
      const w = exp(sTail.div(-1.0)).mul(step(0, age)).mul(float(1).sub(exp(ag.mul(-12))))
      z.addAssign(w.mul(sin(sTail.mul(3.4).sub(ag.mul(26))).mul(0.5).add(0.45).add(gv.sub(0.5).mul(sin(ag.mul(20))).mul(0.25))))
      y.addAssign(w.mul(sin(sTail.mul(2.1).sub(ag.mul(19))).mul(0.3)))
      return vec3(Xe, y, z)
    })()
    tapeMat.vertexNode = vp.mul(vec4(tapeW, 1))
    tapeMat.side = THREE.DoubleSide
    tapeMat.fragmentNode = Fn(() => {
      const mm = m.toVarying().toVar()
      const vt = gv.toVarying().toVar()
      const kf = kk.toVarying()
      const v = kf.add(vt).div(NT).toVar() // height in the picture
      const P = tapeW.toVarying()
      const a2 = U.asp.mul(2)
      const inPic = step(U.m0, mm).mul(step(mm, U.m0.add(a2))).toVar()
      const uA = vec2(mm.sub(U.m0).div(a2), v)
      const A = sampleRT(U.tA, clampN(uA, 0.0005, 0.9995) as V2).rgb.toVar()
      // the halftone: one track per stylus, marks whose length is the picture's darkness at their cell
      const rowH = float(2 / NR)
      const cw = rowH.mul(1.7)
      const rv = v.mul(NR)
      const row = floor(rv)
      const fy = fract(rv).sub(0.5).mul(rowH)
      const cu = mm.sub(U.m0).div(cw)
      const cell = floor(cu)
      const fx = fract(cu).sub(0.5).mul(cw)
      const cA = vec2(cell.add(0.5).mul(cw).div(a2), row.add(0.5).div(NR))
      const dPic = float(1).sub(pow(luma(sampleRT(U.tA, clampN(cA, 0.0005, 0.9995) as V2).rgb), 0.7))
      // elsewhere on the tape, the traffic: dots and dashes on every track
      const h = hash21(vec2(cell, row.add(7)))
      const dMsg = step(0.45, h).mul(mix(float(0.22), float(0.92), step(0.72, h)))
      const d = mix(dMsg, dPic, inPic).toVar()
      const rr = rowH.mul(0.27)
      const L = max(d.mul(cw).mul(0.47), rr)
      const q = vec2(max(abs(fx).sub(L.sub(rr)), 0), fy)
      const ql = length(q).toVar()
      const dist = ql.sub(rr).toVar()
      const aa = rowH.mul(0.07).add(U.pull.mul(0.012))
      const ink0 = sstep(aa, aa.negate(), dist).mul(step(0.05, d))
      // streaming, a track smears into a streak of its own mean
      const blur = clampN(U.speed.div(14), 0, 1)
      const streak = d.mul(0.75).mul(vnoise(vec2(mm.mul(2.5), row)).mul(0.6).add(0.7)).mul(sstep(0.48, 0.3, abs(fract(rv).sub(0.5))))
      const ink = mix(ink0, streak, blur).toVar()
      // the paper: rag, a little cockled, tinted by the picture it carried while that is fresh; the
      // slit edges of each ribbon catch a little shade once the ribbons part
      const fib = vnoise(vec2(mm.mul(90), vt.mul(4))).mul(0.5).add(vnoise(vec2(mm.mul(14), vt.mul(30)).add(kf.mul(3.1))).mul(0.5))
      const edge = sstep(0.0, 0.12, min(vt, vt.oneMinus())).mul(0.3).add(0.7)
      const paper = vec3(0.6, 0.54, 0.4).mul(fib.mul(0.14).add(0.86)).mul(mix(float(1), edge, U.gap)).toVar()
      const Al = toLinear(A)
      const hue = Al.div(max(max(Al.r, max(Al.g, Al.b)), 0.02))
      paper.assign(mix(paper, paper.mul(hue).mul(1.2), inPic.mul(U.tint).mul(0.85).mul(sstep(0.15, 0.7, luma(A)))))
      // embossed: the stylus raised a rim round every mark; the key rakes across it
      const rim = exp(dist.div(rr.mul(0.45)).pow(2).negate()).mul(float(1).sub(blur))
      const n2 = vec2(q.x.mul(step(0, fx).mul(2).sub(1)), q.y).div(max(ql, 1e-5))
      const N = normalize(vec3(n2.mul(rim).mul(0.9), 1)).toVar()
      const N0 = normalize(vec3(0, 0, 1))
      const done = step(mm, U.front)
      const conv = mix(done, float(1), float(1).sub(inPic))
      const alb = mix(Al.mul(0.92), mix(paper, vec3(0.018, 0.016, 0.022), ink), conv).toVar()
      const Nl = mix(N0, N, conv)
      const c = toSRGB(lit(alb as V3, Nl as V3, P as V3, ink.mul(0.5).add(0.05))).toVar()
      // at the first frame the tapes are exactly the old picture
      const flat = sstep(0.012, 0.0, U.p).mul(inPic)
      return vec4(mix(c, A, flat), 1)
    })()
    const tape = add(tapeGeo, tapeMat)
    tape.frustumCulled = false

    // ---- the reels: one small reel per tape on a common brass spindle
    const rollMat = new THREE.NodeMaterial()
    rollMat.fragmentNode = Fn(() => {
      const q = positionLocal
      const N = normalize(normalWorld)
      const r = length(q.xz)
      // the roll's face shows every turn of the tape as a ring; its edge, the outermost turn's traffic
      const rings = sin(r.mul(2600)).mul(0.5).add(0.5).mul(vnoise(vec2(r.mul(500), 1)).mul(0.5).add(0.5))
      const side = step(abs(N.y), 0.5)
      const a = q.z.atan(q.x)
      const row = floor(q.y.add(0.5).mul(3))
      const mark = step(0.55, hash21(vec2(floor(a.mul(40)), row))).mul(sstep(0.45, 0.25, abs(fract(q.y.add(0.5).mul(3)).sub(0.5))))
      const alb = mix(vec3(0.6, 0.54, 0.4).mul(rings.mul(0.35).add(0.6)), mix(vec3(0.6, 0.54, 0.4), vec3(0.02), mark.mul(0.85)), side)
      return vec4(toSRGB(lit(alb as V3, N as V3, positionWorld as V3, 0.05)), 1)
    })()
    const reels = Array.from({ length: NT }, (_, k) => {
      const g = new THREE.Group()
      scene.add(g)
      const roll = add(new THREE.CylinderGeometry(1, 1, TW * 0.98, 40, 1), rollMat, g)
      for (const y of [-TW * 0.52, TW * 0.52]) add(new THREE.CylinderGeometry(R_FULL + 0.05, R_FULL + 0.05, 0.012, 40).translate(0, y, 0), MB, g)
      const spokes = [0, 1, 2, 3].map((i) => {
        const s = add(new THREE.BoxGeometry(R_FULL + 0.02, 0.008, 0.035).translate((R_FULL + 0.02) / 2, TW * 0.53, 0), MB, g)
        s.rotation.y = (i / 4) * Math.PI * 2
        return s
      })
      add(new THREE.CylinderGeometry(R_CORE, R_CORE, TW, 20), MB, g)
      return { g, roll, spokes, k }
    })
    const spindle = add(new THREE.CylinderGeometry(0.035, 0.035, 1, 16), MB)
    const pillar = add(new THREE.CylinderGeometry(0.08, 0.14, 1, 24), MB)

    // ---- the guide post, the register (comb of styli under an electromagnet), the feed rollers, the base
    const guide = add(new THREE.CylinderGeometry(0.03, 0.03, 1, 16), MB)
    const comb = new THREE.Group()
    scene.add(comb)
    const combBar = new THREE.Group()
    comb.add(combBar)
    {
      add(new THREE.BoxGeometry(0.06, 2.08, 0.04).translate(0, 0, 0.09), MB, combBar)
      for (let i = 0; i < NR; i++) add(new THREE.CylinderGeometry(0.005, 0.01, 0.06, 6).rotateX(Math.PI / 2).translate(0, -1 + (i + 0.5) * (2 / NR), 0.04), MI, combBar)
    }
    const magnet = new THREE.Group()
    comb.add(magnet)
    {
      // the electromagnet over it, two coils on a yoke, and the armature that drives the bar
      for (const dx of [-0.11, 0.11]) add(new THREE.CylinderGeometry(0.085, 0.085, 0.32, 24).rotateX(Math.PI / 2).translate(dx, 0.2, 0.28), MC, magnet)
      add(new THREE.BoxGeometry(0.42, 0.06, 0.06).translate(0, 0.2, 0.1), MI, magnet)
      add(new THREE.BoxGeometry(0.04, 0.3, 0.04).translate(0, 0.04, 0.1), MB, magnet)
    }
    const armature = add(new THREE.BoxGeometry(0.5, 0.035, 0.05).translate(0.18, 0, 0), MI, magnet)
    armature.position.set(0, 0.02, 0.46)
    const rollers = [0, 1].map((i) => add(new THREE.CylinderGeometry(0.07, 0.07, 1, 28), i ? MB : MR))
    const posts = [0, 1].map(() => add(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), MB))
    const caps = [0, 1].map(() => add(new THREE.BoxGeometry(0.1, 0.05, 0.42), MB))
    const drum = add(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 40), MB) // the clockwork that pulls the tape
    const base = add(new THREE.BoxGeometry(1, 0.14, 3.4), MW)

    // ---- the lens: the instrument over the engine house, then the engine house alone
    const pass = ctx.pass(({ uv }) => {
      const s = sampleRT(U.tS, clampN(uv.add(U.shake), 0.001, 0.999) as V2).toVar()
      // the room behind: the next picture, further off, dimmed while the instrument holds the light
      const kb = float(1).add(U.pull.mul(0.16).mul(U.push.oneMinus()))
      const ub = uv.sub(0.5).mul(kb).add(0.5)
      const inB = sstep(0.0, 0.03, min(min(ub.x, ub.y), min(ub.x.oneMinus(), ub.y.oneMinus())))
      const dim = mix(float(1), float(0.5), U.pull.mul(U.push.oneMinus()))
      const bg = sampleRT(U.tB, clampN(ub, 0.001, 0.999) as V2).rgb.mul(inB).mul(dim)
      const col = mix(bg, s.rgb, s.a).toVar()
      const end = sstep(0.9, 0.975, U.p)
      const start = sstep(0.0, 0.004, U.p)
      return vec4(mix(mix(sampleRT(U.tA, uv).rgb, col, start), sampleRT(U.tB, uv).rgb, end), 1)
    }, U)

    const tgt = new THREE.Vector3()
    const CLICKS = [...BURSTS, 0.27, 0.35, ...SNAP]
    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = p
        U.asp.value = asp
        const xr = -asp - 2.0, xg = xr + 1.0, xo = asp + 1.25
        U.xr.value = xr
        U.xg.value = xg
        U.xo.value = xo
        U.m0.value = -asp - xr
        const scroll = scrollAt(p)
        U.scroll.value = scroll
        U.speed.value = speedAt(p)
        U.tint.value = 1 - 0.7 * smooth(0.2, 0.5, p)
        const gap = E.io3(smooth(0.16, 0.4, p))
        U.gap.value = gap
        const H2 = 1 + GAP * gap // the stack's half-height
        // the comb: off the left edge, across the picture in three jerks, then parked at the rollers
        let F = -asp - 0.35
        BURSTS.forEach((b, i) => {
          const k = E.out3(clamp((p - b) / 0.035))
          const x0 = i === 0 ? -asp - 0.35 : -asp + (i * 2 * asp) / 3
          const x1 = i === 2 ? asp + 0.3 : -asp + ((i + 1) * 2 * asp) / 3
          if (p >= b) F = x0 + (x1 - x0) * k
        })
        U.front.value = p < 0.2 ? F - 0.06 - xr : 1e4
        comb.position.set(F, 0, 0)
        combBar.scale.y = H2
        magnet.position.y = H2 + 0.12
        // the armature: a kick on each click, ringing out
        let kick = 0
        for (const c of CLICKS) if (p >= c) kick = Math.max(kick, Math.exp(-(p - c) * TICKER_DUR * 30))
        armature.rotation.z = -0.22 * kick
        combBar.position.z = 0.025 * kick
        // the reels empty and spin up; the rollers turn with the tape
        for (const r of reels) {
          const R = radiusAt(scroll, LENK[r.k])
          r.g.position.set(xr, lane(r.k, gap), ZR)
          r.roll.scale.set(R, 1, R)
          r.roll.visible = scroll < LENK[r.k] - 0.01
          r.g.rotation.y = reelTurn(p, LENK[r.k], PK[r.k])
        }
        spindle.position.set(xr, 0, ZR)
        spindle.scale.y = 2 * H2 + 0.1
        pillar.position.set(xr, -H2 - 0.18, ZR)
        pillar.scale.y = 0.3
        guide.position.set(xg, 0, -0.04)
        guide.scale.y = 2 * H2 + 0.1
        rollers[0].position.set(xo, 0, 0.075)
        rollers[1].position.set(xo, 0, -0.075)
        for (const r of rollers) r.scale.y = 2 * H2 + 0.05
        rollers[0].rotation.y = -scroll / 0.07
        rollers[1].rotation.y = scroll / 0.07
        posts.forEach((o, i) => {
          o.position.set(xo, 0, i ? -0.19 : 0.19)
          o.scale.y = 2 * H2 + 0.2
        })
        caps.forEach((o, i) => o.position.set(xo, (i ? -1 : 1) * (H2 + 0.12), 0))
        drum.position.set(xo + 0.7, -H2 + 0.15, -0.55)
        base.scale.x = xo - xr + 2.6
        base.position.set((xr + xo) / 2 + 0.1, -H2 - 0.33, -0.6)
        // the lens: flat on the picture, back and round to the whole instrument, creeping in, then through it
        const pull = E.io3(smooth(0.17, 0.42, p))
        const push = E.in3(smooth(TICKER_IN, 0.97, p))
        U.pull.value = pull
        U.push.value = push
        const creep = smooth(0.42, TICKER_IN, p)
        let D = D0 * (1 + 3.1 * pull) * (1 - 0.1 * creep)
        D = D + (D0 * 0.3 - D) * push
        const cx = ((xr + xo) / 2 + 0.6) * pull * (1 - push)
        const cy = -0.1 * pull * (1 - push)
        const age = (p - TICKER_IN) * TICKER_DUR
        const snap = age >= 0 ? Math.exp(-age * 7) : 0
        const yaw = 0.5 * pull * (1 - push)
        cam.aspect = asp
        cam.fov = FOV
        cam.position.set(cx + D * Math.sin(yaw) + 0.02 * Math.sin(a.time * 0.9) * pull, cy + 0.9 * pull * (1 - push) + 0.04 * snap * Math.sin(age * 55), D * Math.cos(yaw))
        tgt.set(cx - 0.3 * pull * (1 - push), cy, 0)
        cam.lookAt(tgt)
        cam.updateProjectionMatrix()
        U.shake.value.set(0.004 * snap * Math.sin(age * 61), 0.006 * snap * Math.cos(age * 47))
        const r = ctx.renderer
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tS.value = rt.texture
        pass.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: rt },
        { pass, target: hold },
      ],
      dispose() {
        scene.traverse((o) => {
          const mm = o as THREE.Mesh
          mm.geometry?.dispose?.()
          ;(mm.material as THREE.Material | undefined)?.dispose?.()
        })
      },
    }
  },
}
export default t
