// 9 → 10. The thaw.
//
// strata ends on a cliff seen through a cracked, half-melted pane of frost. Here the ice goes: it
// thins from a network of cracks outward, the cleared glass beads up, the beads swell and the heavy
// ones let go and run (a stick-slip fall with a trail, eating what is in their way), and every bead
// is a lens with the old frame upside-down inside it. Where the water reaches the foot of the frame
// it soaks upward into paper: a ragged front climbing along the fibres with a dark tide line, the
// next scene's sheet wet under it and drying to cream behind it. One column of glass is left, with
// the last big bead hanging in it. It lets go, runs, and lands (the climax, and cambrian's clock
// zero) at THAW_HIT, where the scene has a blot waiting and pulls its first stroke out of it.
//
// What crosses the cut is the water. Everything is closed-form in the transition's linear
// progress: the melt radius, each bead's birth, each runner's fall (`fall`, with the same table on
// the CPU for the drips' sound), the soak front (`frontY`).

import * as THREE from "three/webgpu"
import { abs, atan, clamp, cos, dot, exp, float, floor, Fn, If, length, Loop, max, min, mix, mod, pow, sin, smoothstep, sqrt, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { rng } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, hash21, hash22, sampleRT, smoothstepRev, toLinear, toSRGB, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

const DUR = 3.3
/** Where the last bead lands, in the frame (uv, origin bottom-left): scenes/cambrian.ts starts its first stroke there. */
export const THAW_HIT: [number, number] = [0.6, 0.16]
const LAND = 0.74 // the last bead lands: cambrian's first beat starts
const LETGO = 0.6
const BIG_Y = 0.66 // where the last bead hangs
const BIG_R = 0.074 // its radius, in frame heights
const SOAK: [number, number] = [0.2, 0.95] // the front's virtual travel, from under the frame to well above it

// ---- the runners: nine columns, each with a start time, a height, a size (uv x, start p, start y, radius)
const NS = 9
const RUN: [number, number, number, number][] = (() => {
  const R = rng(910)
  const out: [number, number, number, number][] = []
  for (let i = 0; i < NS; i++) {
    let x = (i + 0.2 + R() * 0.6) / NS
    if (Math.abs(x - THAW_HIT[0]) < 0.07) x += x < THAW_HIT[0] ? -0.06 : 0.06 // the last bead's column is its own
    out.push([x, 0.13 + 0.36 * ((i * 0.618 + R() * 0.2) % 1), 0.5 + R() * 0.5, 0.02 + R() * 0.017])
  }
  return out
})()
/** How far a runner has fallen `tau` of the transition after letting go: it sticks, slips, and gathers speed. */
const fallJS = (tau: number) => (tau <= 0 ? 0 : 1.5 * tau + 7 * tau * tau - 0.022 * Math.sin(tau * 46) * Math.min(1, tau * 8))
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const baseJS = (p: number) => -0.22 + 2.5 * sm(SOAK[0], SOAK[1], p) ** 1.25

const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "hiss", o: { dur: 1.5, g: 0.5 } },
  // the ice ticking as it gives
  { s: "crack", o: { f: 2600, g: 0.22, at: 0.05, pan: -0.4 } },
  { s: "crack", o: { f: 2100, g: 0.18, at: 0.33, pan: 0.3 } },
  { s: "glass", o: { f: H(60), g: 0.16, at: 0.52, pan: -0.1 } },
  { s: "glass", o: { f: H(48), g: 0.14, at: 0.83, pan: 0.5 } },
  // the paper drinking
  { s: "whoosh", o: { f: 150, dur: 1.9, g: 0.4, at: DUR * 0.22 } },
  { s: "hiss", o: { dur: 1.2, g: 0.3, at: DUR * 0.45 } },
  // the last bead: a creak as it lets go, then the landing
  { s: "tick", o: { f: 1800, g: 0.5, at: DUR * LETGO } },
  { s: "whoosh", o: { f: 900, dur: DUR * (LAND - LETGO), g: 0.3, at: DUR * LETGO, pan: 0.2 } },
  { s: "thud", o: { f: 130, g: 0.9, at: DUR * LAND, pan: 0.2 } },
  { s: "splash", o: { g: 0.7, at: DUR * LAND, pan: 0.2 } },
  { s: "glass", o: { f: H(24), g: 0.4, at: DUR * LAND, pan: 0.2 } },
  { s: "boom", o: { f: 58, dur: 1.6, g: 0.3, at: DUR * LAND } },
  { s: "marimba", o: { f: H(8), g: 0.5, at: DUR * LAND + 0.02, pan: 0.2 } },
]
// a drip for every runner, when it reaches the water line
for (const [x, ts, y0] of RUN) {
  let p = ts
  while (p < 0.95 && y0 - fallJS(p - ts) > Math.max(0, baseJS(p))) p += 0.004
  if (p < LETGO + 0.05) snd.push({ s: "marimba", o: { f: H(40 + Math.round(x * 16)), g: 0.16, at: DUR * p, pan: x * 1.6 - 0.8, dur: 0.2 } }, { s: "tick", o: { f: 5200, g: 0.16, at: DUR * p, pan: x * 1.6 - 0.8 } })
}

const t: TransitionDef = {
  id: "thaw",
  dur: DUR,
  inAt: LAND,
  ease: (x) => x,
  snd,
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      p: uniform(0),
      uAsp: uniform(16 / 9),
      uRun: uniformArray(RUN.map((r) => new THREE.Vector4(r[0], r[1], r[2], r[3])), "vec4"),
    }
    const p = U.p

    /** Cellular noise with both nearest distances: vec2(F1, F2). The cracks are where they meet. */
    const vor2 = Fn(([q]: [V2]) => {
      const i = floor(q).toVar()
      const f = q.sub(i).toVar()
      const d = vec2(8, 8).toVar()
      Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
        const g = vec2(float(x), float(y)).toVar()
        const e = length(g.add(hash22(i.add(g))).sub(f)).toVar()
        If(e.lessThan(d.x), () => {
          d.assign(vec2(e, d.x))
        }).ElseIf(e.lessThan(d.y), () => {
          d.y.assign(e)
        })
      })
      return d
    }).setLayout({ name: "thawVor2", type: "vec2", inputs: [{ name: "q", type: "vec2" }] })

    /** Frost on the pane as crystals: six-armed dendrites with side branches at sixty degrees, one per cell. 0..1. */
    const fern = Fn(([q]: [V2]) => {
      const CS = 0.21
      const id0 = floor(q.div(CS)).toVar()
      const acc = float(0).toVar()
      Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
        const id = id0.add(vec2(float(x), float(y))).toVar()
        const h = hash22(id.add(5.3)).toVar()
        const c = id.add(0.2).add(h.mul(0.6)).mul(CS)
        const d = q.sub(c).toVar()
        const an = hash21(id.add(9.1)).mul(6.2832)
        const ca = cos(an), sa = sin(an)
        const pr = vec2(d.x.mul(ca).add(d.y.mul(sa)), d.y.mul(ca).sub(d.x.mul(sa))).toVar()
        const r = length(pr).toVar()
        const th = atan(pr.y, pr.x)
        const th2 = mod(th.add(Math.PI / 6), Math.PI / 3).sub(Math.PI / 6)
        const a = r.mul(cos(th2)).toVar()
        const b = abs(r.mul(sin(th2))).toVar()
        const R0 = h.x.mul(0.45).add(0.45).mul(CS)
        const arm = exp(b.div(-0.0035)).mul(step(a, R0))
        const P = 0.017
        const ar = a.sub(b.mul(0.57735))
        const s1 = abs(ar.sub(floor(ar.div(P).add(0.5)).mul(P))).mul(0.866)
        const side = exp(s1.div(-0.0026)).mul(step(b, R0.sub(a).mul(0.55))).mul(0.7)
        acc.assign(max(acc, max(arm, side).mul(step(r, R0))))
      })
      return acc
    }).setLayout({ name: "thawFern", type: "float", inputs: [{ name: "q", type: "vec2" }] })

    const fl = (x: F | number): F => (typeof x === "number" ? float(x) : x)
    const sstep = (e0: F | number, e1: F | number, x: F): F => {
      const k = clamp(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
      return k.mul(k).mul(k.mul(-2).add(3)) as F
    }
    const fall = (tau_: F): F => {
      const tau = max(tau_, 0)
      return tau.mul(1.5).add(tau.mul(tau).mul(7)).sub(sin(tau.mul(46)).mul(0.022).mul(min(tau.mul(8), 1))) as F
    }
    const base = (pp: F): F => pow(smoothstep(SOAK[0], SOAK[1], pp), 1.25).mul(2.5).sub(0.22) as F
    /** Height of the soak front at uv x (before its ragged edge): the column under the last bead lags. */
    const frontY = (x: F): F => {
      const b = base(p)
      const yN = mix(float(THAW_HIT[1]), b, smoothstep(LAND, LAND + 0.15, p))
      const g = exp(x.sub(THAW_HIT[0]).div(0.105).pow(2).negate())
      return b.sub(max(b.sub(yN), 0).mul(g)) as F
    }

    const pass = ctx.pass(({ uv, time }) => {
      const asp2 = vec2(U.uAsp, 1)
      const q = uv.mul(asp2).toVar() // frame heights
      const live = smoothstep(0.0, 0.07, p).toVar() // nothing is on the glass at p = 0
      const gone = smoothstepRev(0.9, LAND + 0.03, p).toVar() // and nothing is left on it at the end

      // ---------------- the paper side: the soak front
      const fy = frontY(uv.x).toVar()
      const rag = fbm(vec2(q.x.mul(2.3), p.mul(1.6))).sub(0.5).mul(0.2).add(fbm(vec2(q.x.mul(4.5), q.y.mul(46))).sub(0.5).mul(0.085)).add(vnoise(vec2(q.x.mul(30), q.y.mul(260))).sub(0.5).mul(0.012))
      const dF = fy.add(rag.mul(smoothstep(-0.25, 0.1, fy))).sub(uv.y).toVar() // > 0: the water has been here
      const soak = smoothstep(-0.003, 0.003, dF).toVar()
      const wet = smoothstepRev(0.8, 0.12, dF).mul(smoothstepRev(1.0, 0.9, p)).toVar()
      const tide = exp(dF.div(0.012).pow(2).negate()).mul(step(0, dF))
      const bLin = toLinear(sampleRT(U.tB, uv).rgb).toVar()
      // wet paper: darker, a little bluer, the fibres showing as darker threads; a brown line where the water stands
      const thread = vnoise(vec2(q.x.mul(60), q.y.mul(700))).mul(0.12).add(0.94)
      const wetCol = bLin.mul(mix(vec3(1), vec3(0.6, 0.6, 0.62).mul(thread), wet.mul(0.85))).mul(tide.mul(0.3).mul(wet.add(0.2)).oneMinus())

      // ---------------- the glass side: ice, melt, film
      const v = vor2(q.mul(4.6).add(vec2(fbm(q.mul(3)), fbm(q.mul(3).add(5))).mul(1.1)).add(vec2(7.3, 2.1))).toVar()
      const crack = v.y.sub(v.x) // 0 on a crack
      const fr = fern(q).toVar()
      const R = smoothstep(0.0, 0.3, p).mul(0.95).add(fbm(q.mul(9)).sub(0.5).mul(0.3)).sub(fr.mul(0.22)).sub(0.04)
      const melt = smoothstepRev(0.02, -0.02, crack.sub(R)).toVar() // 1 where the ice has gone: the arms go last

      // ---------------- the water on the glass: runners first (their trails clear the frost and eat the small beads)
      // best = the bead this pixel is inside (smallest normalised distance), as vec4(centre.xy, radius, stretch)
      const bd = float(9).toVar()
      const bc = vec4(0, 0, 1, 1).toVar()
      const trail = float(0).toVar()
      const cand = (c: V2, r: F, stretch: F | number) => {
        const dq = q.sub(c).toVar()
        // a running drop is a teardrop: its tail is drawn out above it
        const sy = mix(float(1), fl(stretch), step(0, dq.y))
        const d = length(vec2(dq.x, dq.y.div(sy))).div(max(r, 1e-4)).toVar()
        If(d.lessThan(bd).and(r.greaterThan(0.002)), () => {
          bd.assign(d)
          bc.assign(vec4(c, r, sy))
        })
      }
      Loop(NS, ({ i }) => {
        const s = (U.uRun.element(i) as unknown as V4).toVar()
        const tau = p.sub(s.y).toVar()
        If(tau.greaterThan(-0.12), () => {
          const y0 = s.z
          const yh = y0.sub(fall(tau)).toVar()
          const wob = (y: F): F => s.x.add(sin(y.mul(21).add(s.x.mul(60))).mul(0.008)).add(sin(y.mul(57).add(s.x.mul(31))).mul(0.003)) as F
          const xh = wob(yh as F).toVar()
          // it swells where it hangs, then goes; the paper takes it at the water line
          const swell = smoothstep(-0.12, 0, tau)
          const taken = sstep(0.0, 0.035, frontY(xh as F).sub(yh) as F)
          const r = s.w.mul(swell).mul(taken.oneMinus()).mul(gone).toVar()
          const speed = clamp(tau.mul(9), 0, 1)
          cand(vec2(xh.mul(U.uAsp), yh) as V2, r as F, speed.mul(0.9).add(1.1) as F)
          // the trail: a strip of cleared, wet glass narrowing upward, with beads left behind in it
          const inY = step(yh, uv.y).mul(step(uv.y, y0)).mul(step(0, tau))
          const tx = abs(q.x.sub(wob(uv.y as F).mul(U.uAsp)))
          const wT = s.w.mul(mix(0.3, 0.62, smoothstepRev(0.3, 0.0, uv.y.sub(yh))))
          trail.assign(max(trail, sstep(wT as F, wT.mul(0.55) as F, tx as F).mul(inY).mul(gone)))
          const cell = floor(uv.y.div(0.034)).toVar()
          const hy = hash21(vec2(cell, s.x.mul(91))).toVar()
          const by = cell.add(0.3).add(hy.mul(0.4)).mul(0.034).toVar()
          const left = step(yh.add(0.02), by).mul(step(by, y0)).mul(step(0.35, hy)).mul(step(0, tau))
          cand(vec2(wob(by as F).mul(U.uAsp).add(hy.sub(0.5).mul(0.006)), by) as V2, s.w.mul(hy.mul(0.22).add(0.1)).mul(left).mul(gone).mul(soak.oneMinus()) as F, 1.25)
        })
      })
      // the last bead: it gathers, trembles, lets go, runs, and lands at THAW_HIT
      const run = clamp(p.sub(LETGO).div(LAND - LETGO), 0, 1).toVar()
      const bigY = mix(float(BIG_Y).sub(smoothstep(0.3, LETGO, p).mul(0.035)), float(THAW_HIT[1]), pow(run, 2.3)).toVar()
      const bigX = float(THAW_HIT[0]).add(sin(bigY.mul(17)).mul(0.006).mul(run.mul(run.oneMinus()).mul(4))).toVar()
      const tremble = sin(time.mul(31)).mul(0.012).mul(smoothstep(LETGO - 0.12, LETGO, p)).mul(step(p, LETGO))
      const bigR = pow(smoothstep(0.2, LETGO - 0.04, p), 0.7).mul(BIG_R).mul(tremble.add(1)).mul(step(p, LAND + 0.004)).toVar()
      cand(vec2(bigX.mul(U.uAsp), bigY) as V2, bigR as F, run.mul(1.6).add(1.12) as F)
      {
        const inY = step(bigY, uv.y).mul(step(uv.y, BIG_Y - 0.03)).mul(step(LETGO, p))
        const tx = abs(q.x.sub(float(THAW_HIT[0]).add(sin(uv.y.mul(17)).mul(0.004)).mul(U.uAsp)))
        const wT = float(BIG_R).mul(mix(0.36, 0.7, smoothstepRev(0.3, 0.0, uv.y.sub(bigY))))
        trail.assign(max(trail, sstep(wT as F, wT.mul(0.6) as F, tx as F).mul(inY).mul(smoothstepRev(0.92, LAND, p))))
      }
      // the beads that stay where they formed: two sizes, each born at its own moment on cleared glass
      const clear = max(melt, trail).mul(live).toVar()
      for (const [cs, seed] of [[0.105, 3.1], [0.05, 17.7]] as const) {
        const id0 = floor(q.div(cs)).toVar()
        Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
          const id = id0.add(vec2(float(x), float(y))).toVar()
          const h = hash22(id.add(seed)).toVar()
          const h2 = hash22(id.add(seed + 40.3)).toVar()
          const c = id.add(0.22).add(h.mul(0.56)).mul(cs)
          const born = h2.x.mul(0.34).add(0.05)
          const r = h2.y.mul(h2.y).mul(0.3).add(0.1).mul(cs).mul(smoothstep(born, born.add(0.14), p)).mul(step(0.4, h.x.add(h.y).mul(0.5)))
          // (a bead only stands on cleared glass, is swallowed by a passing runner, and goes into the paper with the front)
          cand(c as V2, r.mul(clear).mul(trail.oneMinus()).mul(soak.oneMinus()).mul(gone) as F, 1.08)
        })
      }

      // ---------------- shade
      // the pane: the old frame, veiled where ice is left, a little bent where it runs with water
      const film = vec2(fbm(q.mul(5.5).add(vec2(0, p.mul(3)))).sub(0.5), fbm(q.mul(5.5).add(vec2(7.7, p.mul(3).add(2)))).sub(0.5)).mul(0.016).mul(clear)
      const aLin = toLinear(sampleRT(U.tA, uv.add(film.div(asp2)) as V2).rgb).toVar()
      // what is left of the frost: its crystals, lit from behind (arms bright, the ground between them thin)
      const frostN = vnoise(q.mul(140)).mul(0.5).add(0.5)
      const ice = live.mul(clear.oneMinus()).mul(fr.mul(0.42).add(frostN.mul(0.08)).add(0.05)).mul(smoothstepRev(LAND + 0.1, LAND - 0.05, p)).toVar()
      const rim = exp(crack.sub(R).div(0.012).pow(2).negate()).mul(live).mul(trail.oneMinus()).mul(smoothstepRev(0.42, 0.3, p))
      const glass = mix(aLin, vec3(0.78, 0.86, 0.95).mul(luma3(aLin).mul(0.5).add(0.62)), ice).add(vec3(0.5, 0.56, 0.62).mul(rim.mul(0.35))).toVar()
      // wet, cleared glass is a touch darker and richer than glass under ice
      glass.mulAssign(mix(float(1), float(0.9), clear.mul(live)))
      const col = mix(glass, wetCol, soak).toVar()
      // a bright meniscus where the water line stands against the glass
      col.addAssign(vec3(0.5, 0.55, 0.6).mul(exp(dF.div(0.004).pow(2).negate())).mul(0.35).mul(gone).mul(smoothstep(-0.2, 0.0, fy)))

      // a bead: the old frame upside-down in it, a dark upper rim, a bright lower crescent, the lamp
      If(bd.lessThan(1.25), () => {
        const dq = q.sub(bc.xy)
        const nxy = vec2(dq.x, dq.y.div(bc.w)).div(bc.z).toVar() // unit disc
        const d2 = min(dot(nxy, nxy), 1)
        const hgt = sqrt(d2.oneMinus())
        // a wide, inverted view: the whole pane fits in a drop
        const big = smoothstep(0.03, 0.07, bc.z)
        const ctr = mix(vec2(0.5, 0.5), bc.xy.div(asp2), 0.45)
        const suv = clamp(ctr.sub(nxy.mul(mix(0.3, 0.44, big)).div(asp2).mul(d2.mul(0.5).add(0.75))), 0.004, 0.996)
        const inner = toLinear(sampleRT(U.tA, suv as V2).rgb).toVar()
        inner.mulAssign(vec3(0.9, 0.96, 1.0).mul(hgt.mul(0.3).add(0.72)))
        inner.mulAssign(smoothstep(0.35, 1, d2).mul(max(nxy.y, 0)).mul(0.62).oneMinus()) // dark upper rim
        inner.addAssign(vec3(0.95, 0.97, 1.0).mul(smoothstep(0.45, 0.98, d2)).mul(max(nxy.y.negate(), 0)).mul(0.55)) // bright lower crescent
        const sp = nxy.sub(vec2(-0.34, 0.42))
        inner.addAssign(vec3(1.25, 1.2, 1.1).mul(exp(dot(sp, sp).div(-0.018))).mul(1.1)) // the lamp
        inner.addAssign(vec3(0.3).mul(exp(dot(sp.add(vec2(0.62, -0.74)), sp.add(vec2(0.62, -0.74))).div(-0.01))).mul(0.5)) // and the window behind us
        const edge = smoothstepRev(1.0, 0.94, bd)
        // (outside its edge a bead darkens the pane a little: its shadow and the bend of light at its foot)
        col.mulAssign(mix(float(1), float(0.72), smoothstepRev(1.25, 1.0, bd).mul(edge.oneMinus())))
        col.assign(mix(col, inner, edge))
      })

      // ---------------- the landing: a ring through the wet sheet
      If(p.greaterThan(LAND), () => {
        const u = p.sub(LAND).mul(DUR)
        const hq = q.sub(vec2(U.uAsp.mul(THAW_HIT[0]), THAW_HIT[1]))
        const rr = length(hq.mul(vec2(1, 1.25)))
        const ring = exp(rr.sub(float(0.03).add(exp(u.mul(-5)).oneMinus().mul(0.42))).div(0.018).pow(2).negate()).mul(exp(u.mul(-5.5)))
        col.mulAssign(ring.mul(0.28).oneMinus())
        col.addAssign(vec3(0.5, 0.52, 0.55).mul(ring).mul(0.1))
      })
      return vec4(toSRGB(sat3(col)), 1)
    }, U)

    return {
      render(a) {
        const { w, h } = ctx.size()
        U.uAsp.value = w / h
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        pass.render(a.out)
      },
      warm: () => [{ pass, target: hold }],
      dispose() {
        pass.dispose()
      },
    }
  },
}
const luma3 = (c: V3): F => dot(c, vec3(0.2126, 0.7152, 0.0722)) as F
const sat3 = (c: V3): V3 => clamp(c, 0, 1) as V3

export default t
