// 2 → 3. The white-hot frame loses its stiffness: it sags, necks into a stream and runs down
// into the crucible, whose mouth the forge reports as its portal. Behind the glass is the kitchen,
// dark until the pot fills. The sheet is a height field (thick in the middle, thin at the edge),
// shaded as hot glass: it refracts what is behind it, carries the old picture stretched along the
// flow, and glows hottest where it is thickest.

import * as THREE from "three/webgpu"
import { abs, clamp, cos, dot, exp, float, Fn, If, length, Loop, max, min, mix, normalize, pow, sin, smoothstep, sqrt, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { fbm, hash11, PI, sampleRT, sat, smoothstepRev, toLinear, toSRGB, type F, type V2, type V3 } from "../engine/tsl"
import { H, type Pos } from "../engine/synth"
import type { TransitionDef } from "../engine/types"

const DUR = 3.2
const IMPACT = 0.72 // the last of the glass lands; the forge's first beat starts on it

/** The crucible's mouth as the listener hears it (the centre `uMouth` starts on). */
const MOUTH: Pos = [0, -0.16, 0.2]

const t: TransitionDef = {
  id: "pour",
  dur: DUR,
  inAt: IMPACT,
  ease: (x) => x,
  // Sound (sheet: beats/sound-pour.md), on the transition's own progress. Home harmonic 4 going to 5.
  snd: [
    // the frame loses its stiffness and sags
    { s: "rumble", o: { f: H(2), dur: 2.4, g: 0.7 } },
    { s: "whoosh", p: 0.06, o: { f: H(4), dur: 1.8, g: 0.5 } },
    // .3: the stream has reached the mouth and spits on the iron
    { s: "sizzle", p: 0.28, o: { dur: 1, g: 0.5, pos: MOUTH } },
    // the two thinner runs either side let go
    { s: "squelch", p: 0.52, o: { f: H(10), g: 0.5, pos: [-0.3, 0.1, 0.1] } },
    { s: "squelch", p: 0.6, o: { f: H(8), g: 0.5, pos: [0.3, 0.05, 0.1] } },
    // .72: the last of it lands (the forge's clock starts here): the splash, its weight, the crown of drops
    { s: "splash", p: IMPACT, o: { f: H(10), dur: 0.7, g: 0.9, pos: MOUTH } },
    { s: "sub", p: IMPACT, o: { f: H(2), g: 0.7, lfe: 1, pos: MOUTH } },
    { s: "thud", p: IMPACT, o: { f: H(5), g: 0.6, pos: MOUTH } },
    { s: "hiss", p: IMPACT + 0.015, o: { dur: 1.5, g: 0.8 } },
    { s: "crackle", p: IMPACT + 0.05, o: { dur: 0.7, g: 0.5, pos: [-0.35, -0.3, 0] } },
    { s: "crackle", p: IMPACT + 0.08, o: { dur: 0.6, g: 0.45, pos: [0.4, -0.35, 0] } },
    // the kitchen: the next scene's home
    { s: "pad", p: IMPACT + 0.03, o: { f: H(10), dur: 6, g: 0.4 } },
  ],
  // the stream as a bed: running from when it reaches the mouth until its tail has fallen in
  sound(pl, _prev, synth) {
    const run = Math.min(1, Math.max(0, (pl - 0.1) / 0.2)) * (1 - Math.min(1, Math.max(0, (pl - 0.6) / 0.135)))
    if (run > 0) synth.bed("water", 0.8 * run)
  },
  create(ctx) {
    // An 8-bit target of the same kind as the two frames: what the inputs start on, and what the pass is compiled for.
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      p: uniform(0),
      uDur: uniform(DUR),
      uMouth: uniform(new THREE.Vector3(0.5, 0.42, 0.3)), // centre (uv) and half-width
    }
    const p = U.p

    const smin = (a: F, b: F, k: number): F => {
      const h = sat(b.sub(a).div(k).mul(0.5).add(0.5) as F).toVar()
      return mix(b, a, h).sub(h.mul(h.oneMinus()).mul(k)) as F
    }
    const caps = Fn(([q, a, b, r]: [V2, V2, V2, F]) => {
      const pa = q.sub(a).toVar()
      const ba = b.sub(a).toVar()
      const h = clamp(dot(pa, ba).div(max(dot(ba, ba), 1e-5)), 0, 1).toVar()
      return length(pa.sub(ba.mul(h))).sub(r.mul(mix(1.35, 1, h)))
    }).setLayout({ name: "pourCaps", type: "float", inputs: [{ name: "q", type: "vec2" }, { name: "a", type: "vec2" }, { name: "b", type: "vec2" }, { name: "r", type: "float" }] })

    // signed distance to the glass (negative inside), in units of the frame's height.
    // M is the mouth's centre and mw its half-width in those units; pv is the progress.
    const glass = Fn(([q, M, mw, pv]: [V2, V2, F, F]) => {
      const s = pow(smoothstep(0.05, 0.7, pv), 0.8).toVar() // how much has run out
      const c = mix(vec2(0, smoothstep(0, 0.3, pv).mul(-0.1)), M.add(vec2(0, 0.16)), s).toVar()
      const r = mix(vec2(1.65), vec2(mw.mul(0.5), 0.05), s).mul(smoothstep(0.66, 0.745, pv).oneMinus()).toVar()
      const w = q.sub(c).toVar()
      w.addAssign(vec2(fbm(q.mul(2.1).add(pv.mul(1.9))), fbm(q.mul(2.1).add(7).sub(pv.mul(1.4)))).sub(0.5).mul(0.3).mul(smoothstep(0, 0.22, pv)).mul(s.oneMinus().mul(0.75).add(0.25)))
      // a hanging drop: full at the bottom, drawn out at the top
      const tt = clamp(w.y.div(r.y).mul(0.5).add(0.5), 0, 1)
      w.x.divAssign(mix(1, mix(1.25, 0.62, tt), smoothstep(0.08, 0.5, pv).mul(s.mul(-0.6).add(1))))
      const d = length(w.div(max(r, vec2(1e-4)))).sub(1).mul(min(r.x, r.y)).add(smoothstep(0.7, 0.75, pv).mul(0.2)).toVar()
      // the stream: reaches the mouth early, feeds until the body is gone, then its tail falls in
      const reach = smoothstep(0.1, 0.3, pv)
      const tail = smoothstep(0.6, 0.735, pv).toVar()
      const low = mix(c.y.sub(r.y.mul(0.6)), M.y, reach)
      const high = mix(c.y, M.y, tail)
      const sway = sin(q.y.mul(9).sub(pv.mul(16))).mul(0.018).mul(smoothstep(M.y, M.y.add(0.5), q.y))
      const wr = mw.mul(sin(pv.mul(23)).mul(0.05).add(0.2)).mul(tail.oneMinus()).mul(smoothstep(0.08, 0.2, pv))
      const st = caps(q.sub(vec2(sway, 0)), vec2(c.x, high), vec2(M.x, low), wr).toVar()
      // two thinner runs either side that let go sooner
      const a1 = smoothstep(0.16, 0.36, pv)
      const e1 = smoothstep(0.44, 0.6, pv).toVar()
      st.assign(min(st, caps(q, vec2(c.x.sub(r.x.mul(0.55)), mix(c.y, M.y, e1)), vec2(M.x.sub(mw.mul(0.42)), mix(c.y.sub(r.y.mul(0.5)), M.y.add(0.03), a1)), mw.mul(0.07).mul(e1.oneMinus()))))
      const a2 = smoothstep(0.22, 0.44, pv)
      const e2 = smoothstep(0.5, 0.66, pv).toVar()
      st.assign(min(st, caps(q, vec2(c.x.add(r.x.mul(0.6)), mix(c.y, M.y, e2)), vec2(M.x.add(mw.mul(0.36)), mix(c.y.sub(r.y.mul(0.5)), M.y.add(0.02), a2)), mw.mul(0.09).mul(e2.oneMinus()))))
      d.assign(smin(d as F, st as F, 0.09))
      // above the pot it necks into a funnel that feeds the mouth; below, it can only be inside the mouth
      const k = mix(16, 0.16, pow(smoothstep(0.03, 0.46, pv), 0.55)).toVar()
      const up = max(q.y.sub(M.y), 0).toVar()
      const wob = fbm(vec2(q.y.mul(3.3).sub(pv.mul(4)), 3)).sub(0.5).mul(0.12).mul(smoothstep(0, 0.5, up))
      const fun = abs(q.x.sub(M.x).add(wob)).sub(mw.mul(0.8)).sub(k.mul(pow(up, 1.35))).div(sqrt(k.mul(k).add(1))).toVar()
      fun.assign(max(fun, M.y.sub(q.y).mul(0.9)))
      const k2 = mix(7, 1, smoothstep(0.03, 0.4, pv)).toVar()
      const rim = length(q.sub(M).sub(vec2(0, mw.mul(0.03))).div(vec2(mw.mul(0.86), mw.mul(0.4)).mul(k2))).sub(1).mul(mw).mul(0.4).mul(k2)
      return max(d, smin(fun as F, rim as F, 0.03))
    }).setLayout({ name: "pourGlass", type: "float", inputs: [{ name: "q", type: "vec2" }, { name: "M", type: "vec2" }, { name: "mw", type: "float" }, { name: "pv", type: "float" }] })

    const pass = ctx.pass(({ uv, res }) => {
      const out = sampleRT(U.tA, uv).rgb.toVar()
      If(p.greaterThan(0), () => {
        const asp = res.x.div(res.y).toVar()
        const M = U.uMouth.xy.sub(0.5).mul(vec2(asp, 1)).toVar()
        const mw = U.uMouth.z.mul(asp).toVar()
        const q = uv.sub(0.5).mul(vec2(asp, 1)).toVar()
        const g1 = (x: V2) => glass(x, M, mw, p)
        const d = g1(q as V2).toVar()
        const back = toLinear(sampleRT(U.tB, uv).rgb)
        const live = smoothstep(0.7, 0.78, p).oneMinus()
        const hot = smoothstep(0, 0.3, p).toVar()
        const dp = max(d, 0)
        // what the glass throws on the kitchen around it
        const c = back.add(vec3(1, 0.36, 0.07).mul(exp(dp.mul(-9)).mul(0.55).add(exp(dp.mul(-2.2)).mul(0.12))).mul(hot).mul(live)).toVar()
        If(d.lessThan(0.004), () => {
          const e = 0.006
          const g = vec2(g1(q.add(vec2(e, 0)) as V2).sub(g1(q.sub(vec2(e, 0)) as V2)), g1(q.add(vec2(0, e)) as V2).sub(g1(q.sub(vec2(0, e)) as V2))).div(2 * e).toVar()
          const h = clamp(d.div(-0.2), 0, 1).toVar() // thickness
          // striations drawn out along the flow
          const flow = fbm(vec2(q.x.mul(26).add(fbm(q.mul(3)).mul(4)), q.y.mul(2.2).add(p.mul(5))))
          const body = clamp(h.add(flow.sub(0.5).mul(0.5).mul(h).mul(h.mul(-0.6).add(1))), 0, 1).toVar()
          const hotc = mix(vec3(0.75, 0.09, 0.01), vec3(1, 0.36, 0.03), smoothstep(0, 0.25, body)).toVar()
          hotc.assign(mix(hotc, vec3(1, 0.72, 0.2), smoothstep(0.2, 0.6, body)))
          hotc.assign(mix(hotc, vec3(1, 0.95, 0.78), smoothstep(0.55, 1, body)))
          // the old picture rides in it, stretched as the body shrinks, until the heat takes over
          const s = pow(smoothstep(0.05, 0.7, p), 0.8)
          const src = uv.add(vec2(0, smoothstep(0, 0.3, p).mul(0.1))).add(uv.sub(U.uMouth.xy).mul(s).mul(0.8)).sub(g.mul(0.02).mul(hot))
          const pic = toLinear(sampleRT(U.tA, clamp(src, 0.002, 0.998) as V2).rgb).toVar()
          const gl = mix(pic, hotc.mul(pic.mul(0.5).add(0.85)), hot.mul(smoothstep(0.12, 0.5, p).mul(0.65).add(0.35))).toVar()
          // seen through where it is thin
          const thru = toLinear(sampleRT(U.tB, clamp(uv.add(g.mul(0.035)), 0, 1) as V2).rgb)
          gl.assign(mix(gl, thru.mul(vec3(1, 0.55, 0.25)).add(hotc.mul(0.5)), smoothstep(0, 0.45, h).oneMinus().mul(0.6).mul(hot)))
          // a hot bead along the edge, a dark line inside it, and a moving highlight
          gl.addAssign(vec3(1, 0.6, 0.2).mul(smoothstepRev(0.03, 0, abs(d.add(0.012)))).mul(0.55).mul(hot))
          gl.mulAssign(smoothstepRev(0.03, 0, abs(d.add(0.04))).mul(hot).mul(-0.25).add(1))
          const n = normalize(vec3(g.negate().mul(smoothstepRev(0.5, 0, h)).mul(1.4), 1))
          const L = new THREE.Vector3(-0.35, 0.55, 0.75).normalize()
          gl.addAssign(pow(clamp(dot(n, vec3(L.x, L.y, L.z)), 0, 1), 28).mul(0.35).mul(hot).mul(h.mul(-0.7).add(1)))
          c.assign(mix(c, gl, smoothstepRev(0.004, -0.004, d).mul(smoothstep(0.73, 0.76, p).oneMinus())))
        })
        // the last of it lands: a crown of glowing drops thrown out of the pot on ballistic arcs
        const ts = p.sub(IMPACT).mul(U.uDur).toVar()
        If(ts.greaterThan(0), () => {
          const sp = vec3(0).toVar()
          Loop({ type: "int", start: 0, end: 26 }, ({ i }) => {
            const fi = float(i).toVar()
            const a = hash11(fi.mul(1.7).add(0.3)).mul(PI * 0.9).add(PI * 0.05).toVar()
            const v = hash11(fi.mul(3.1).add(2)).mul(0.9).add(0.55)
            const v0 = vec2(cos(a).mul(0.8), sin(a).mul(1.25).add(0.25)).mul(v).mul(mw).mul(2.6).toVar()
            const life = hash11(fi.mul(5.3)).mul(0.4).add(0.45)
            const u = ts.div(life).toVar()
            If(u.lessThanEqual(1), () => {
              const pos = M.add(vec2(cos(a).mul(mw).mul(0.45), 0.03)).add(v0.mul(ts)).sub(vec2(0, 1.55).mul(ts).mul(ts))
              const vel = v0.sub(vec2(0, 3.1).mul(ts)).toVar()
              const dir = normalize(vel).toVar()
              const e = q.sub(pos).toVar()
              const along = dot(e, dir).toVar()
              const across = dot(e, vec2(dir.y.negate(), dir.x))
              const sz = mw.mul(hash11(fi.mul(7.7)).mul(0.05).add(0.035)).mul(u.mul(-0.6).add(1))
              // a drop with a short tail behind it
              const tail = clamp(along.negate(), 0, length(vel).mul(0.05))
              const dd = length(vec2(across, along.add(tail))).div(sz).toVar()
              const core = smoothstepRev(1, 0.55, dd).toVar()
              const halo = exp(dd.mul(dd).mul(-0.35)).mul(0.25)
              sp.addAssign(mix(vec3(1, 0.35, 0.04), vec3(1, 0.9, 0.6), core.mul(u.oneMinus())).mul(core.add(halo)).mul(u.mul(u).oneMinus()))
            })
          })
          // a flash on the mouth and a ring running out across the counter
          const rr = length(q.sub(M).div(vec2(1, 0.45))).div(mw).toVar()
          const flash = exp(ts.mul(-7)).mul(exp(rr.mul(rr).mul(-0.5))).mul(1.2)
          const ro = rr.sub(1).sub(ts.mul(5))
          const ring = exp(ro.mul(ro).mul(-5)).mul(exp(ts.mul(-4))).mul(0.5)
          c.addAssign(sp.add(vec3(1, 0.62, 0.25).mul(flash.add(ring))))
        })
        out.assign(toSRGB(c as V3))
      })
      return vec4(out, 1)
    }, U)
    pass.mat.name = "pour" // (pipeline errors name the material)

    const m = U.uMouth.value
    return {
      render(a) {
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        const c = a.pb?.c
        if (c) m.set((c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 8 + 0.5, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 8 + 0.5, (Math.abs(c[2][0] - c[3][0]) + Math.abs(c[1][0] - c[0][0])) / 8)
        else m.set(0.5, 0.42, 0.3)
        pass.render(a.out)
      },
      warm: () => [{ pass, target: hold }],
      dispose: () => pass.dispose(),
    }
  },
}
export default t
