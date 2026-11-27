// dot: template → inflation. Falling into the title's full stop.
//
// Medium: ink on paper. The template scene keeps pushing into its own full stop, faster and
// faster (it is told how far through `s.exit`), and reports the dot's exact rectangle as its
// portal. What crosses the cut is the dot: it becomes the dark the spark is lit in.
//
// The fall, in fractions of the transition:
//   0    – .22  the paper streaks past (a zoom blur about the dot), the ink has a wet rim and a
//               meniscus highlight, flecks of ink fly past the lens
//   .22  – .55  the ink has closed over the frame: a beat of black with a last few glints in it
//   .55         the climax: the spark ignites (DOT_IGNITE). A flash and a ring of light from
//               DOT_AIM, and the boom. The incoming scene's first beat starts its clock here
//               (`inAt`), lights its bench and shudders its camera.
//   .55  – 1    the flash dies away and what is left is exactly the incoming scene
//
// The ink's fibrous edge itself is drawn by the template's paper shader; this pass only adds what
// is in front of it. With no portal (the engine's warm-up render) it is a plain mix.

import { abs, clamp, cos, dot as dotN, exp, float, If, length, Loop, max, mix, normalize, pow, sign, sin, smoothstep, vec2, vec3 } from "three/tsl"

import { hash11, hash21, hash22, luma, vnoise, type F, type V2 } from "../engine/tsl"
import { H, type Pos } from "../engine/synth"
import type { TransitionDef } from "../engine/types"

/** Where the dot ends up and the spark sits, in uv (origin bottom-left). */
export const DOT_AIM: [number, number] = [0.33, 0.44]
/** Zoom the template has reached when the hand-off starts, and when it ends (log space). */
export const DOT_Z0 = 25
export const DOT_Z1 = 6000
export const DOT_DUR = 3
/** Fraction of the transition by which the template has finished falling. */
export const DOT_FALL = 0.42
/** Fraction at which the spark ignites: the incoming scene's clock starts here. */
export const DOT_IGNITE = 0.55

/** DOT_AIM as the listener hears it. */
const AIM: Pos = [DOT_AIM[0] * 2 - 1, DOT_AIM[1] * 2 - 1, 0]

const dot: TransitionDef = {
  id: "dot",
  dur: DOT_DUR,
  inAt: DOT_IGNITE,
  ease: (x) => x,
  // Sound (sheet: beats/sound-dot.md). Everything is on the transition's own progress, so it stays
  // on its picture if a key press hurries the fall. Home harmonic 3 going to 4.
  snd: [
    // the fall: the air over the page, and a low body under it
    { s: "whoosh", o: { f: H(3), dur: 0.9, g: 0.8 } },
    { s: "rumble", o: { f: H(2), dur: 1.6, g: 0.6 } },
    // .22: the ink closes over the frame, wet, where the dot was going
    { s: "squelch", p: 0.21, o: { f: H(8), g: 0.9, pos: AIM } },
    { s: "thud", p: 0.22, o: { f: H(3), g: 0.5, pos: AIM, lfe: 0.3 } },
    // the black: a last few glints, far off, and nothing else
    { s: "glass", p: 0.3, o: { f: H(48), g: 0.16, pos: [0.5, 0.3, 1.2] } },
    { s: "glass", p: 0.38, o: { f: H(64), g: 0.12, pos: [-0.6, -0.2, 1.6] } },
    { s: "glass", p: 0.46, o: { f: H(54), g: 0.1, pos: [0.1, 0.45, 2] } },
    // .55: the spark ignites, where it is
    { s: "crack", p: DOT_IGNITE, o: { f: H(32), g: 0.45, pos: AIM } },
    { s: "sub", p: DOT_IGNITE, o: { f: H(2), g: 0.8, pos: AIM, lfe: 1 } },
    { s: "boom", p: DOT_IGNITE, o: { f: H(2), dur: 3, g: 0.5 } },
    { s: "bell", p: DOT_IGNITE + 0.01, o: { f: H(16), g: 0.22, pos: AIM } },
    // the ring of light running out over the bench, and the room it lights: the next scene's home
    { s: "shimmer", p: DOT_IGNITE + 0.03, o: { f: H(48), dur: 1.6, g: 0.35 } },
    { s: "pad", p: DOT_IGNITE + 0.06, o: { f: H(4), dur: 5, g: 0.55 } },
  ],
  // the rush of the fall as a bed: up as the paper streaks, gone once the ink has closed
  sound(pl, _prev, synth) {
    const fall = Math.min(1, pl / 0.1) * (1 - Math.min(1, Math.max(0, (pl - 0.2) / 0.16)))
    if (fall > 0) synth.bed("wind", 0.9 * fall)
  },
  trans: ({ uv, res, time, a, b, p, pl, HA, PA }) => {
    const sq = (x: F) => x.mul(x)
    // GLSL smoothstep with e0 > e1 (a falling edge), which WGSL leaves undefined
    const fallStep = (e0: F, e1: F, x: F) => {
      const t = clamp(x.sub(e0).div(e1.sub(e0)), 0, 1).toVar()
      return t.mul(t).mul(t.mul(-2).add(3))
    }
    const out = vec3(0).toVar()
    If(PA.x.lessThan(0.5), () => {
      out.assign(mix(a(), b(), p))
    }).Else(() => {
      // the dot's rectangle: t = t0 + uv*k inside the quad, so its centre and size follow
      const q0 = HA.mul(vec3(-1, -1, 1)).toVar()
      const q1 = HA.mul(vec3(1, 1, 1)).toVar()
      const t0 = q0.xy.div(q0.z).toVar()
      const k0 = q1.xy.div(q1.z).sub(t0).toVar()
      const k = sign(k0).mul(max(abs(k0), vec2(1e-6))).toVar()
      const size = vec2(1).div(k).toVar()
      const c = t0.oneMinus().sub(0.5).mul(size).toVar() // (.5 - t0)*size
      const asp = res.x.div(res.y).toVar()
      const R = max(abs(size.y).mul(0.5), 1e-4).toVar() // dot radius, in frame heights
      const d = uv.sub(c).mul(vec2(asp, 1)).toVar()
      const r = length(d).div(R).toVar() // 1 on the dot's edge
      const nd = d.div(max(length(d), 1e-6)).toVar()
      const fall = smoothstep(0, 0.2, pl).toVar()

      // the paper rushing past: a zoom blur about the dot, longer the faster we fall
      const blur = fall.mul(0.22).mul(smoothstep(0.3, 0.45, pl).oneMinus()).toVar()
      const jit = hash21(uv.mul(res).add(time)).sub(0.5).toVar()
      const A = vec3(0).toVar()
      Loop(10, ({ i }) => {
        const f = blur.mul(float(i).add(0.5).add(jit)).div(10).oneMinus()
        A.addAssign(a(c.add(uv.sub(c).mul(f)) as V2))
      })
      A.divAssign(10)
      const ink = luma(A).oneMinus().toVar()
      const outside = max(r.sub(1), 0).mul(R).toVar() // distance outside the dot, in frame heights
      const col = vec3(A).toVar()
      // paper that has drunk a little: a damp grey fringe just outside the edge
      col.mulAssign(fall.mul(0.22).mul(exp(outside.mul(-38))).mul(ink.oneMinus()).oneMinus())
      // the ink stands proud of the paper: a meniscus that catches the room's light on one side
      const band = exp(sq(r.sub(0.955).div(0.02) as F).negate())
      const spec = pow(max(dotN(nd, normalize(vec2(-0.55, 0.83))), 0), 5).add(pow(max(dotN(nd, normalize(vec2(0.7, -0.6))), 0), 9).mul(0.25))
      col.addAssign(vec3(0.62, 0.66, 0.74).mul(band).mul(spec).mul(fall).mul(ink).mul(smoothstep(0.3, 0.4, pl).oneMinus()))
      // flecks of ink thrown past the lens, out of focus and getting larger as they come
      const pc = uv.sub(0.5).mul(vec2(asp, 1)).toVar()
      const aim = vec2(DOT_AIM[0] - 0.5, DOT_AIM[1] - 0.5).mul(vec2(asp, 1)).toVar()
      Loop(22, ({ i }) => {
        const fi = float(i).toVar()
        const h = hash22(vec2(fi.mul(7.31), 3.7)).toVar()
        const h2 = hash11(fi.mul(3.17).add(1)).toVar()
        const age = pl.sub(h.x.mul(0.3).add(0.03)).toVar()
        If(age.greaterThan(0), () => {
          const an = h.y.mul(6.2832).toVar()
          const pos = aim.add(vec2(cos(an), sin(an)).mul(age.mul(age).mul(2.6).add(age.mul(0.5)).add(0.05)).mul(h2.mul(0.8).add(0.6))).toVar()
          const sz = age.mul(0.11).mul(h2.add(0.5)).add(0.006).toVar()
          const m = fallStep(sz, sz.mul(0.35) as F, length(pc.sub(pos))).toVar()
          // black against the paper; a faint wet glint once everything behind is ink
          col.assign(mix(col, vec3(0.004), m.mul(0.8).mul(smoothstep(0, 0.05, age))))
          col.addAssign(vec3(0.05, 0.055, 0.07).mul(m).mul(fallStep(sz.mul(0.8) as F, sz.mul(0.2) as F, length(pc.sub(pos).sub(sz.mul(0.3))))).mul(ink).mul(smoothstep(0.42, 0.54, pl).oneMinus()))
        })
      })
      // inside the ink is the next scene, which is dark until its spark is lit
      const lip = vnoise(nd.mul(2.5).add(3) as V2).sub(0.5).mul(0.04).add(0.9).add(vnoise(nd.mul(9).add(7) as V2).sub(0.5).mul(0.02)).toVar()
      const aa = float(1.5).div(R.mul(res.y)).toVar()
      const hole = smoothstep(lip.sub(0.05).sub(aa), lip.add(aa), r).oneMinus()
      col.assign(mix(col, b(), max(hole, smoothstep(0.4, 0.47, pl))))
      // the ignition: a flash from where the spark is, and a ring of light running out over the bench
      const pf = pl.sub(DOT_IGNITE).toVar()
      If(pf.greaterThan(0), () => {
        const dl = length(uv.sub(vec2(DOT_AIM[0], DOT_AIM[1])).mul(vec2(asp, 1))).toVar()
        const flash = exp(pf.mul(-9))
        col.addAssign(vec3(1, 0.86, 0.62).mul(flash).mul(exp(dl.mul(dl).mul(pf.mul(60).add(5)).negate()).mul(1.1).add(0.3)))
        const ring = exp(sq(dl.sub(pf.mul(2.6)).div(pf.mul(0.12).add(0.02)) as F).negate()).mul(exp(pf.mul(-5.5)))
        col.addAssign(vec3(1, 0.6, 0.25).mul(ring).mul(0.5))
      })
      out.assign(clamp(col, 0, 1))
    })
    return out
  },
}
export default dot
