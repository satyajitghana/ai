// 13 → 14. Clay.
//
// `hands` ends on a pale cave wall of ochre stencils. Here the rock softens: the frame's own
// picture becomes a relief in a slab of wet clay (its luminance is the height, lit by a low sun),
// and two hands smooth it flat. Each lands at the far side and is drawn back across the slab,
// heel down: where it has passed the old relief is gone, the fingers leave their shallow tracks,
// clay is pushed up into a lip along the band's edges, and the surface is wet and bright for a
// moment and then dulls. Four sweeps, three rows and then one long last one along the line where
// the first furrow will go. The slab is blank. A point goes in at the left (CLAY_IN, the incoming
// scene's clock zero) and is dragged right: the first furrow. `tablet` opens with its newest
// furrow being cut on the same line (CLAY_CUT), so the end is a cross-fade of detail on a matched
// line, spreading outward from the cut.
//
// What crosses the cut is the clay. Everything is closed-form in the linear progress.
//
// The hands are the creature toolkit's macro hands (hand.ts), the same person's as in `tablet`.
// They are built by `tablet`'s chunk and handed over through `provideClayHands`, so this file (which
// is bundled with the engine) never imports the toolkit.

import * as THREE from "three/webgpu"
import { abs, cos, dFdx, dFdy, dot, exp, float, If, max, min, mix, normalize, pow, sin, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4, clamp as clampN } from "three/tsl"

import { H } from "../engine/synth"
import { aces, fbm, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const CLAY_DUR = 3.0
/** The first cut goes in here: tablet's clock zero. */
export const CLAY_IN = 0.74
/** The first furrow's line on screen (uv, y up), and how far along it the point has got at linear progress `pl`. */
export const CLAY_CUT = { y: 0.42, u: (pl: number) => -0.06 + 1.2 * Math.min(1, Math.max(0, (pl - CLAY_IN) / 0.22)) }

// ---------------------------------------------------------------- the hands (built in the scene's chunk)

/** One hand on the slab this frame (centimetres, world): which side, where the middle of its palm is, the way its fingers point and the back of the hand faces, and how far the fingers spread. */
export type ClayHand = { on: boolean; side: 1 | -1; at: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; time: number; spread: number }
export type ClayHands = { group: THREE.Object3D; update(cam: THREE.PerspectiveCamera, hands: ClayHand[]): void; dispose(): void }
/** Writes the hands in display values (the layer is composited over the finished slab), lit by `sun` (toward the sun). */
export type ClayHandsMaker = (o: { sun: THREE.Vector3 }) => ClayHands
let MAKER: ClayHandsMaker | null = null
/**
 * `tablet` registers its hand builder here when its chunk loads. The transition only ever runs
 * with that scene loaded (it is the incoming scene), and this way the creature toolkit stays in the
 * scene's chunk instead of the engine's.
 */
export function provideClayHands(m: ClayHandsMaker) {
  MAKER = m
}

// ---------------------------------------------------------------- the four sweeps

const FH = 50 // the slab is this many centimetres from the top of the frame to its foot (a hand is a quarter of it)
// row (uv y), where the hand lands (uv x), where it leaves, start and end progress, which hand (1 right, -1 left)
type Sweep = { y: number; x0: number; x1: number; t0: number; t1: number; hand: 1 | -1 }
const SWEEPS: Sweep[] = [
  { y: 0.8, x0: 0.2, x1: 1.24, t0: 0.1, t1: 0.28, hand: 1 },
  { y: 0.5, x0: 0.8, x1: -0.24, t0: 0.21, t1: 0.41, hand: -1 },
  { y: 0.2, x0: 0.2, x1: 1.24, t0: 0.35, t1: 0.54, hand: 1 },
  { y: CLAY_CUT.y, x0: 0.86, x1: -0.3, t0: 0.5, t1: 0.71, hand: -1 },
]
const BAND = 0.215 // half the width of a sweep, in frame heights
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
/** Where a sweep's palm is (uv x) at progress p, and how high the hand is off the clay (cm). */
const palmAt = (s: Sweep, p: number): [number, number] => {
  const k = Math.min(1, (p - s.t0) / (s.t1 - s.t0))
  // it comes in over the slab, lands, is drawn back, and leaves
  const reach = ease((p - (s.t0 - 0.1)) / 0.1)
  const x = k < 0 ? s.x0 + s.hand * 1.3 * (1 - reach) : s.x0 + (s.x1 - s.x0) * (0.12 * k + 0.88 * k * k * (3 - 2 * k))
  const lift = k < 0 ? 7 * (1 - reach) * (1 - reach) : k > 0.86 ? ((k - 0.86) / 0.14) ** 2 * 3 : 0
  return [x, lift]
}

const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "rumble", o: { f: H(2), dur: 0.9, g: 0.22 } },
  { s: "hiss", o: { dur: 0.5, g: 0.16, f: 900 }, p: 0.02 },
]
SWEEPS.forEach((s, i) => {
  const last = i === SWEEPS.length - 1
  const pan = (s.x0 - 0.5) * 1.5
  snd.push(
    { s: "squelch", o: { g: last ? 1 : 0.75, f: H(3 + i), pos: [pan, s.y * 2 - 1, 0] }, p: s.t0 },
    { s: "thud", o: { f: H(2), g: last ? 0.5 : 0.28, pos: [pan, s.y * 2 - 1, 0] }, p: s.t0 },
    { s: "whoosh", o: { f: 140 + i * 30, dur: (s.t1 - s.t0) * CLAY_DUR * 0.9, g: last ? 0.42 : 0.3, pos: [-pan * 0.4, s.y * 2 - 1, 0.1] }, p: s.t0 + 0.01 },
    { s: "squelch", o: { g: 0.3, f: H(5 + i), pos: [-pan, s.y * 2 - 1, 0], dur: 0.2 }, p: s.t0 + (s.t1 - s.t0) * 0.6 },
  )
})
// the first cut: a point pushed into the blank slab, then dragged
snd.push(
  { s: "squelch", o: { g: 1, f: H(2), pos: [-0.9, CLAY_CUT.y * 2 - 1, 0] }, p: CLAY_IN },
  { s: "thud", o: { f: H(1.5), g: 0.8, pos: [-0.9, -0.16, 0] }, p: CLAY_IN },
  { s: "sub", o: { g: 0.55 }, p: CLAY_IN },
  { s: "scratch", o: { f: 180, g: 0.5, dur: 0.5, pos: [-0.4, -0.16, 0] }, p: CLAY_IN + 0.03 },
  { s: "scratch", o: { f: 150, g: 0.42, dur: 0.5, pos: [0.3, -0.16, 0] }, p: CLAY_IN + 0.11 },
)

const t: TransitionDef = {
  id: "clay",
  dur: CLAY_DUR,
  inAt: CLAY_IN,
  ease: (x) => x,
  snd,
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const handRT = ctx.target({ hdr: false, depth: true, samples: 4 })
    const SUN = new THREE.Vector3(-0.38, 0.52, -0.76).normalize()
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tH: uniformTexture(handRT.texture),
      p: uniform(0),
      asp: uniform(16 / 9),
      // per sweep: (row y, landing x, palm x now, direction); (start p, end p, lift, 0)
      sw: uniformArray(SWEEPS.map(() => new THREE.Vector4()), "vec4"),
      st: uniformArray(SWEEPS.map(() => new THREE.Vector4()), "vec4"),
      cut: uniform(-1), // how far the first furrow has been cut (uv x)
    }
    const p = U.p
    const fl = (x: F | number): F => (typeof x === "number" ? float(x) : x)
    const ss = (e0: F | number, e1: F | number, x: F): F => {
      const k = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
      return k.mul(k).mul(k.mul(-2).add(3)) as F
    }
    const gs = (x: F, w: number): F => exp(x.div(w).mul(x.div(w)).negate()) as F
    const lum = (c: V3): F => dot(c, vec3(0.2126, 0.7152, 0.0722)) as F

    /** What the sweeps have done at a point (frame heights): x = relief left (1..0), y = height added (lips, finger tracks), z = how wet it still is. */
    const swept = (q: V2): V3 => {
      const keep = float(1).toVar()
      const add = float(0).toVar()
      const wet = float(0).toVar()
      for (let i = 0; i < SWEEPS.length; i++) {
        const s = U.sw.element(i) as unknown as V4
        const tt = U.st.element(i) as unknown as V4
        If(p.greaterThan(tt.x.sub(0.005)), () => {
          const dirx = s.w
          // along: distance from where the fingertips landed, in the direction the hand is drawn
          const lat = q.y.sub(s.x).add(sin(q.x.mul(2.2).add(i * 1.7)).mul(0.012)).toVar()
          const from = s.y.mul(U.asp).sub(dirx.mul(0.52))
          const to = s.z.mul(U.asp).add(dirx.mul(0.2))
          const al = q.x.sub(from).mul(dirx).toVar()
          const span = to.sub(from).mul(dirx)
          const edge = vnoise(vec2(q.x.mul(7), i * 7.3)).sub(0.5).mul(0.035)
          const inBand = ss(BAND, BAND - 0.035, abs(lat).add(edge) as F)
          const done = ss(-0.03, 0.02, al).mul(ss(span.add(0.02), span.sub(0.03), al)).mul(inBand).toVar()
          keep.mulAssign(done.oneMinus())
          add.mulAssign(done.mul(0.92).oneMinus())
          // four finger tracks and the heel's broad one, running the way the hand went; clay heaped along both edges
          const tracks = cos(lat.mul(6.2832 / 0.085)).mul(0.0012).add(vnoise(vec2(lat.mul(260), q.x.mul(3).add(i))).sub(0.5).mul(0.0014))
          const lip = gs(abs(lat).add(edge).sub(BAND + 0.006) as F, 0.012).mul(0.0065).mul(ss(-0.03, 0.02, al)).mul(ss(span.add(0.02), span.sub(0.03), al)).mul(vnoise(vec2(q.x.mul(14), i * 3.1)).mul(0.8).add(0.5))
          add.addAssign(tracks.mul(done).add(lip))
          // wet where the hand has just been; it dulls behind it
          const since = span.sub(al).div(max(span, 0.05))
          wet.assign(max(wet, done.mul(exp(since.mul(-2.2))).mul(ss(tt.y.add(0.16), tt.y.add(0.02), p))))
        })
      }
      return vec3(keep, add, wet) as V3
    }
    /** The first furrow, in the incoming scene's own proportions (it opens 0.46 m of field to the frame). */
    const furrowH = (q: V2): F => {
      const dy = q.y.sub(CLAY_CUT.y)
      const prof = gs(dy as F, 0.179).mul(-0.152).add(gs(abs(dy).sub(0.37) as F, 0.12).mul(0.087))
      const head = ss(U.cut.mul(U.asp).add(0.01), U.cut.mul(U.asp).sub(0.1), q.x)
      return prof.mul(head).mul(vnoise(q.mul(vec2(6.3, 2))).mul(0.4).add(0.8)) as F
    }
    /** The relief alone, for the shadow march: how much of the old picture is left at a point. */
    const keepAt = (q: V2): F => {
      const keep = float(1).toVar()
      for (let i = 0; i < SWEEPS.length; i++) {
        const s = U.sw.element(i) as unknown as V4
        const dirx = s.w
        const from = s.y.mul(U.asp).sub(dirx.mul(0.52))
        const to = s.z.mul(U.asp).add(dirx.mul(0.2))
        const al = q.x.sub(from).mul(dirx)
        const span = to.sub(from).mul(dirx)
        const done = ss(-0.03, 0.02, al as F).mul(ss(span.add(0.02), span.sub(0.03), al as F)).mul(ss(BAND, BAND - 0.035, abs(q.y.sub(s.x)) as F)).mul(step((U.st.element(i) as unknown as V4).x.sub(0.005), p))
        keep.mulAssign(done.oneMinus())
      }
      return keep as F
    }
    const reliefH = (uv: V2): F => {
      const noRule = step(uv.y, 1 - 1004 / 1080 - 0.012).add(step(1 - 884 / 1080 + 0.012, uv.y)).min(1)
      return lum(toLinear(sampleRT(U.tA, uv).rgb) as V3).sub(0.35).mul(RELIEF).mul(keepAt(uv.mul(vec2(U.asp, 1)) as V2)).mul(noRule) as F
    }
    const RELIEF = 0.03
    const height = (uv: V2): F => {
      const q = uv.mul(vec2(U.asp, 1)).toVar()
      const a = lum(toLinear(sampleRT(U.tA, uv).rgb) as V3)
      const s = swept(q as V2)
      const noRule = step(uv.y, 1 - 1004 / 1080 - 0.012).add(step(1 - 884 / 1080 + 0.012, uv.y)).min(1)
      const h = a.sub(0.35).mul(RELIEF).mul(s.x).mul(noRule).add(s.y).toVar()
      If(U.cut.greaterThan(-0.5), () => {
        h.addAssign(furrowH(q as V2))
      })
      return h as F
    }

    const pass = ctx.pass(({ uv, res }) => {
      const q = uv.mul(vec2(U.asp, 1)).toVar()
      const aS = sampleRT(U.tA, uv).rgb.toVar()
      const soft = ss(0.0, 0.13, p).toVar()
      const e = float(1).div(res.y).toVar()
      const h0 = height(uv).toVar()
      // world: x right, z down the frame, y toward the lens (one evaluation: the slope across the pixel)
      const N = normalize(vec3(dFdx(h0).negate(), e, dFdy(h0))).toVar()
      const s = swept(q as V2).toVar()
      const r0 = reliefH(uv).toVar()
      const L = vec3(SUN.x, SUN.y, SUN.z)
      // the sun's ray climbs away up and to the left: is anything in its way?
      const sh = float(1).toVar()
      const ld = vec2(SUN.x, -SUN.z).div(Math.hypot(SUN.x, SUN.z))
      const tanE = SUN.y / Math.hypot(SUN.x, SUN.z)
      const st = float(0.006).toVar()
      for (let i = 0; i < 5; i++) {
        const c = reliefH(uv.add(ld.mul(st).div(vec2(U.asp, 1))) as V2).sub(r0).sub(st.mul(tanE))
        sh.assign(min(sh, clampN(c.div(st.mul(0.18)), 0, 1).oneMinus()))
        st.mulAssign(2.1)
      }
      // clay: wet buff, keeping a ghost of the old picture's colour until a hand has been over it
      const aL = toLinear(aS).toVar()
      const tone = fbm(q.mul(3.1)).mul(0.5).add(fbm(q.mul(17)).mul(0.5))
      const buff = vec3(0.5, 0.4, 0.27).mul(tone.mul(0.24).add(0.88))
      const ghost = mix(buff, aL.mul(vec3(1.05, 0.9, 0.72)).add(buff.mul(0.3)), s.x.mul(0.5))
      const alb = mix(ghost, buff.mul(0.94), s.z.mul(0.5))
      const wet = s.z.mul(0.9).add(0.22)
      const V = vec3(0, 1, 0)
      const ndl = max(dot(N, L), 0)
      const Hh = normalize(L.add(V))
      const sunC = vec3(1.0, 0.84, 0.62).mul(3.3)
      const skyC = vec3(0.34, 0.44, 0.62).mul(0.62)
      const spec = pow(max(dot(N, Hh), 0), 90).mul(wet).mul(2.2).add(pow(max(dot(N, Hh), 0), 12).mul(wet).mul(0.12))
      // the hands' shadow on the slab, thrown down the frame and to the right; softer the higher the hand
      const hsh = float(0).toVar()
      for (let i = 0; i < 5; i++) {
        const o = vec2(0.012 + i * 0.006, -0.02 - i * 0.011)
        hsh.addAssign(sampleRT(U.tH, uv.add(o.div(vec2(U.asp, 1))) as V2).a)
      }
      const handSh = hsh.div(5).mul(0.85).oneMinus()
      const lit = alb.mul(sunC.mul(ndl).mul(sh).mul(handSh).add(skyC.mul(N.y.mul(0.4).add(0.6)).mul(h0.mul(4).add(1)))).add(sunC.mul(spec).mul(sh).mul(handSh)).add(skyC.mul(0.06).mul(wet))
      const clay = toSRGB(aces(lit.mul(0.9)) as V3)
      const col = mix(aS, clay, soft).toVar()
      // the hands over it
      const hand = sampleRT(U.tH, uv)
      col.assign(mix(col, hand.rgb, hand.a))
      // the rule of ages lies over everything, in both scenes: it is carried straight across
      const inRule = step(64 / 1920 - 0.004, uv.x).mul(step(uv.x, 1856 / 1920 + 0.004)).mul(step(1 - 1004 / 1080 - 0.006, uv.y)).mul(step(uv.y, 1 - 884 / 1080 + 0.006))
      // the field takes over from the cut outward
      const hw = pow(ss(CLAY_IN + 0.02, 0.97, p), 1.6).mul(1.4).add(0.07)
      const wB = ss(hw, hw.mul(0.55), abs(uv.y.sub(CLAY_CUT.y)).add(fbm(q.mul(5)).sub(0.5).mul(0.12)) as F).mul(ss(CLAY_IN + 0.004, CLAY_IN + 0.04, p))
      col.assign(mix(col, sampleRT(U.tB, uv).rgb, max(wB, ss(0.95, 0.995, p))))
      col.assign(mix(col, mix(aS, sampleRT(U.tB, uv).rgb, ss(CLAY_IN - 0.035, CLAY_IN + 0.035, p)), inRule))
      return vec4(col, 1)
    }, U)

    // the hands: the scene's builder, made the first time it is there (it always is once `tablet` has loaded)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(36, 16 / 9, 5, 900)
    // (a near lens: an arm rising off the slab toward it swings out to the frame's edge)
    const CAM_D = FH / 2 / Math.tan((18 * Math.PI) / 180)
    cam.position.set(0, CAM_D, 0)
    cam.up.set(0, 0, -1)
    cam.lookAt(0, 0, 0)
    let hands: ClayHands | null = null
    const need = () => {
      if (!hands && MAKER) {
        hands = MAKER({ sun: SUN })
        scene.add(hands.group)
      }
      return hands
    }
    need()
    const HL: ClayHand[] = SWEEPS.map((s) => ({ on: false, side: s.hand, at: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(), time: 0, spread: 0 }))

    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        const pl = a.pl
        U.asp.value = asp
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = pl
        U.cut.value = pl >= CLAY_IN ? CLAY_CUT.u(pl) : -1
        let any = false
        SWEEPS.forEach((s, i) => {
          const [x, lift] = palmAt(s, pl)
          ;(U.sw.array[i] as THREE.Vector4).set(s.y, s.x0, Math.min(Math.max(x, -1), 2), s.hand)
          ;(U.st.array[i] as THREE.Vector4).set(s.t0, s.t1, lift, 0)
          const h = HL[i]
          h.on = pl > s.t0 - 0.1 && pl < s.t1 + 0.01
          if (!h.on) return
          any = true
          // a right hand comes in from the right with its fingers pointing left (and a little up the slab, toward the far side), a left hand the other way
          const k = (pl - s.t0) / (s.t1 - s.t0)
          const yaw = 0.14 + 0.1 * Math.sin(k * 3.1 + i)
          h.X.set(-s.hand * Math.cos(yaw), -0.55 - lift * 0.02, -Math.sin(yaw)).normalize()
          h.Y.set(s.hand * (0.06 + lift * 0.015) * Math.sin(k * 5 + i) - s.hand * 0.3, 1, 0.04).normalize()
          h.at.set((x - 0.5) * FH * asp, lift, (0.5 - s.y) * FH)
          h.time = pl * CLAY_DUR
          // the fingers spread as the hand lands and close a little as it is drawn back
          h.spread = 0.35 * Math.exp(-Math.max(0, k) * 3) + 0.1 + 0.08 * Math.sin(k * 9 + i)
        })
        cam.aspect = asp
        cam.updateProjectionMatrix()
        const r = ctx.renderer
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(handRT)
        const hs = need()
        if (any && hs) {
          hs.update(cam, HL)
          r.render(scene, cam)
        } else r.clear()
        U.tH.value = handRT.texture
        pass.render(a.out)
      },
      warm: () => {
        need()
        return [
          { scene, camera: cam, target: handRT },
          { pass, target: hold },
        ]
      },
      dispose() {
        pass.dispose()
        hands?.dispose()
      },
    }
  },
}

export default t
