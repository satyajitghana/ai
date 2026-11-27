// 3 → 4. Steam comes off the cooling pot, spreads up and out across the frame, and thickens
// until there is nothing else; by then it has taken the colour of the fog it turns into. The
// forge reports the pot's mouth as its portal, so the plume starts where the pot really is.
// Nothing is simulated: the steam is warped noise advected along the plume, its density a
// function of progress and of distance from the mouth.

import * as THREE from "three/webgpu"
import { abs, clamp, cos, dot, exp, float, floor, fract, If, length, Loop, max, mix, pow, sin, smoothstep, sqrt, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { fbm, hash11, hash21, sampleRT, sat, toLinear, toSRGB, voronoi, type F, type V2, type V3 } from "../engine/tsl"
import { H } from "../engine/synth"
import type { TransitionDef } from "../engine/types"

type Num = number | F
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** GLSL `smoothstep(e0, e1, x)` with e0 > e1 (a falling edge), for edges that are nodes. */
const ssr = (e0: Num, e1: Num, x: Num): F => {
  const t = clamp(fl(e0).sub(x).div(fl(e0).sub(e1)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

type Snd0 = NonNullable<TransitionDef["snd"]>[number]
/** The beads forming on the lens: [progress, x, y, harmonic]. */
const BEADS: [number, number, number, number][] = [
  [0.33, -0.5, 0.3, 72], [0.385, 0.4, -0.2, 84], [0.43, 0.1, 0.5, 78], [0.465, -0.7, -0.4, 96], [0.495, 0.6, 0.35, 90],
  [0.52, -0.2, -0.1, 108], [0.542, 0.75, -0.5, 84], [0.562, -0.4, 0.6, 102], [0.58, 0.2, 0.1, 120], [0.596, -0.65, 0.05, 96],
]

const t: TransitionDef = {
  id: "steam",
  dur: 3.0,
  inAt: 0.62,
  ease: (x) => x,
  // Sound (sheet: beats/sound-steam.md), on the transition's own progress. Home harmonic 5 going to 6.
  snd: [
    // the plume comes off the pot, where the pot is
    { s: "hiss", o: { dur: 2.2, g: 0.6, pos: [0.32, -0.2, 0.2] } },
    // the nearer layer goes past the lens
    { s: "whoosh", p: 0.2, o: { f: H(5), dur: 1.5, g: 0.4 } },
    // a light inside the steam before there is anything else of the next scene
    { s: "shimmer", p: 0.36, o: { f: H(48), dur: 2, g: 0.22 } },
    // the lens mists over and beads: drops landing on the glass, right in front of the listener, faster and faster
    ...BEADS.map(([p, x, y, n]): Snd0 => ({ s: "tick", p, o: { f: H(n), g: 0.3, wet: 2.5, pos: [x, y, -0.25] } })),
    { s: "glass", p: 0.5, o: { f: H(96), g: 0.07, pos: [-0.3, 0.2, -0.2] } },
    { s: "glass", p: 0.58, o: { f: H(108), g: 0.07, pos: [0.4, -0.1, -0.2] } },
    // .62: the steam is the fog, and the fog's clock starts: its home
    { s: "pad", p: 0.62, o: { f: H(6), dur: 6, g: 0.5 } },
  ],
  create(ctx) {
    // an 8-bit target of the kind the two frames arrive in: the inputs start on it, and the pass is compiled for it
    const like = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = { tA: uniformTexture(like.texture), tB: uniformTexture(like.texture), p: uniform(0), uMouth: uniform(new THREE.Vector3(0.66, 0.4, 0.12)) }
    const pass = ctx.pass(({ uv, res, time }) => {
      const p = U.p
      const out = sampleRT(U.tA, uv).toVar()
      If(p.greaterThan(0), () => {
        const asp = res.x.div(res.y).toVar()
        const q = uv.sub(0.5).mul(vec2(asp, 1)).toVar()
        const m = U.uMouth.xy.sub(0.5).mul(vec2(asp, 1)).toVar()
        const mw = U.uMouth.z.mul(asp).toVar()
        const dens = (q_: V2): F => {
          const d = q_.sub(m).toVar()
          // a plume that leans and opens as it climbs, then stops being a plume at all
          const open = smoothstep(0, 0.75, p).toVar()
          const rise = d.y
          const lean = d.x.sub(rise.mul(0.12)).toVar()
          const up = max(rise, 0).toVar()
          const wide = mw.mul(open.mul(1.2).add(0.7)).add(up.mul(open.mul(2.6).add(0.55))).add(open.mul(open).mul(open).mul(2.4)).toVar()
          const inPl = ssr(wide, wide.mul(0.25) as F, abs(lean)).mul(smoothstep(mw.mul(-0.6).sub(open.mul(open).mul(2)), mw.mul(0.2), rise))
          const reach = ssr(p.mul(3.4).add(0.15) as F, p.mul(2.2).sub(0.1) as F, rise)
          const sp = vec2(lean.div(up.mul(0.9).add(0.35).add(open)), rise.mul(1.6).sub(time.mul(0.5).add(p.mul(1.6)))).toVar()
          const n = fbm(sp.mul(1.9).add(fbm(sp.mul(1.1).add(vec2(time.mul(0.07), 0))).mul(1.9))).toVar()
          const n2 = fbm(q_.mul(3.1).add(vec2(0, time.mul(-0.3))).add(n.mul(1.5)))
          const body = inPl.mul(reach).toVar()
          const fill = smoothstep(0.42, 1, p).toVar() // the whole frame goes
          const a = smoothstep(float(0.62).sub(body.mul(0.5)).sub(fill.mul(0.75)), float(0.98).sub(body.mul(0.3)).sub(fill.mul(0.75)), n.mul(0.7).add(n2.mul(0.3)).add(body.mul(0.25)))
          return sat(a.mul(smoothstep(0, 0.1, p)).mul(body.mul(1.15).add(fill.mul(1.4))))
        }
        const a = dens(q).toVar()
        // a nearer, bigger, faster layer going past the lens: the parallax is what makes it a volume
        const nq = q.mul(0.55).add(vec2(0.3, time.mul(-0.5).sub(p.mul(1.4)))).toVar()
        const near = smoothstep(0.5, 0.85, fbm(nq.mul(1.6).add(fbm(nq.mul(0.9).add(4)).mul(1.8)))).mul(smoothstep(0.2, 0.7, p)).mul(smoothstep(0.86, 1, p).oneMinus()).toVar()
        // lit from the side: the gradient of the density is its shading, with a bright edge
        const ax = dens(q.add(vec2(0.02, 0.012)) as V2)
        const shade = sat(a.sub(ax).mul(2.2).add(0.6)).toVar()
        const edge = smoothstep(0.05, 0.4, a).mul(smoothstep(0.4, 0.9, a).oneMinus())
        // the lens mists over, then beads; each bead is a little lens of its own
        const mist = smoothstep(0.3, 0.6, p).mul(smoothstep(0.7, 0.86, p).oneMinus()).toVar()
        const vo = voronoi(q.mul(13).add(vec2(0, p.mul(0.6).mul(hash11(floor(q.x.mul(13))))))).toVar()
        const bsz = hash21(vo.yz).mul(0.28).add(0.2).toVar()
        const born = hash21(vo.yz.add(7))
        const bead = ssr(bsz, bsz.mul(0.6) as F, vo.x).mul(step(born, mist.mul(1.5))).mul(mist).toVar()
        const cellUv = fract(q.mul(13)).sub(0.5).toVar()
        const bn = cellUv.mul(bead)
        // the kitchen wavers behind it, and through the beads it is upside down and small
        const w = vec2(fbm(q.mul(5).add(time.mul(0.4))), fbm(q.mul(5).add(9).sub(time.mul(0.4)))).sub(0.5)
        const ua = uv.add(w.mul(0.02).mul(smoothstep(0, 0.4, a)).mul(p.oneMinus())).sub(bn.mul(0.09))
        const A = toLinear(sampleRT(U.tA, clamp(ua, 0, 1) as V2).rgb).toVar()
        const B = toLinear(sampleRT(U.tB, uv).rgb).toVar()
        // the fog's own colour, blurred: what the steam warms toward, and its brightest point (the photon) first of all
        const Bm = vec3(0).toVar()
        const Bx = vec3(0).toVar()
        Loop(12, ({ i }) => {
          const an = float(i).mul(2.39996)
          const rr = sqrt(float(i).add(0.5).div(12))
          const tap = toLinear(sampleRT(U.tB, clamp(uv.add(vec2(cos(an), sin(an)).mul(vec2(0.1, 0.15)).mul(rr)), 0, 1) as V2).rgb).toVar()
          Bm.addAssign(tap)
          Bx.assign(max(Bx, tap))
        })
        Bm.divAssign(12)
        const warm = smoothstep(0.3, 0.82, p).toVar()
        const cool = vec3(0.36, 0.39, 0.45).mul(shade.mul(0.75).add(0.45)).add(A.mul(0.25)).add(vec3(0.5, 0.55, 0.62).mul(edge).mul(0.35))
        const st = mix(cool, Bm.mul(shade.mul(0.5).add(0.72)), warm).toVar()
        // the pot's last glow, seen through it
        const e = q.sub(m).div(vec2(1, 0.55)).toVar()
        const pg = exp(dot(e, e).negate().div(U.uMouth.z.mul(U.uMouth.z).mul(asp).mul(asp).mul(1.6)))
        st.addAssign(vec3(1, 0.16, 0.03).mul(pg).mul(0.5).mul(a).mul(smoothstep(0.45, 0.8, p).oneMinus()))
        // a light inside the steam before there is anything else of the next scene
        st.addAssign(pow(Bx, vec3(3)).mul(smoothstep(0.36, 0.7, p)).mul(0.5))
        const c = mix(A, st, a).toVar()
        c.assign(mix(c, mix(vec3(0.5, 0.54, 0.6), Bm.mul(1.2), warm).mul(shade.mul(0.5).add(0.6)), near.mul(0.75)))
        c.assign(mix(c, c.mul(0.82).add(vec3(0.2, 0.22, 0.26).mul(warm.oneMinus())).add(Bm.mul(0.2).mul(warm)), mist.mul(0.55).mul(bead.oneMinus())))
        c.addAssign(vec3(0.9).mul(bead).mul(ssr(0.25, 0.05, length(cellUv.sub(vec2(-0.12, 0.14))))).mul(0.4))
        // and then the steam is the fog
        const into = smoothstep(0.62, 1, p).mul(smoothstep(0.2, 0.9, a.add(smoothstep(0.85, 1, p))))
        c.assign(mix(c, B, into))
        out.assign(vec4(toSRGB(c as V3), 1))
      })
      return out
    }, U)
    return {
      render(a) {
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        const m = U.uMouth.value
        const c = a.pa?.c
        if (c) m.set((c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 8 + 0.5, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 8 + 0.5, (Math.abs(c[2][0] - c[3][0]) + Math.abs(c[1][0] - c[0][0])) / 8)
        else m.set(0.66, 0.4, 0.12)
        pass.render(a.out)
      },
      warm: () => [{ pass, target: like }],
      dispose: () => pass.dispose(),
    }
  },
}
export default t
