// 7 → 8. The molten frame is quenched and crystallises.
//
// Facets nucleate at 26 seeded points and grow. The growth is closed-form: a point freezes at
//   T(x) = min over seeds of  t_i + gauge_i(x - s_i) / v_i
// where gauge_i is a hexagonal gauge turned by the seed's own angle, so every front is a straight-
// sided polygon and two fronts meet in a sharp boundary (a Voronoi net with polygonal metrics).
// T is rescaled on the CPU (a JS twin over a coarse grid) so that the last pocket of melt closes
// exactly at LOCK, which is `inAt`: the incoming scene's clock starts on the ping.
//
// Each facet holds the old picture, refracted by its own tilt, and takes the colours of a thin
// section under crossed polarisers: per channel sin²(πΓ/λ) of its retardation Γ (which steps a
// little with every growth zone), times sin²(2θ) of its angle to the polarisers. The stage turns
// while it grows, so each facet goes dark four times a turn.
//
// After LOCK the polarisers uncross and every facet but one lets go of its neighbours: it loses
// its colour, shrinks about its own nucleus, rounds off and is a frosted grain of quartz sand,
// settling with a bounce, while the incoming scene's own grains come down on the glass. The facet
// that stays was seeded on the incoming scene's portal (the zircon's outline) and tightens onto it.

import * as THREE from "three/webgpu"
import { abs, clamp, cos, dot, exp, float, floor, int, length, Loop, max, mix, pow, sin, smoothstep, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { rng } from "../engine/ease"
import { H } from "../engine/synth"
import { hash21, hash22, luma, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

const DUR = 3.2
const LOCK = 0.6 // the last boundary closes
const T0 = 0.05 // the first nucleus
const NS = 26
const ASP = 16 / 9

type Seed = { x: number; y: number; t: number; iv: number; c: number; s: number; ax: number; th: number; tx: number; ty: number; ret: number; delay: number }
const SEEDS: Seed[] = (() => {
  const r = rng(4404)
  const out: Seed[] = []
  // seed 0 is the one that stays: its place and stretch are set from the incoming scene's portal
  out.push({ x: 0.2, y: -0.02, t: T0 + 0.02, iv: 0.2, c: 1, s: 0, ax: 2.6, th: 0.6, tx: 0.2, ty: 0.1, ret: 420, delay: 99 })
  const NX = 7
  const NY = 4
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      if (out.length >= NS) break
      if ((i === 0 && j === 0) || (i === NX - 1 && j === NY - 1) || (i === 3 && j === 1)) continue
      const a = r() * Math.PI
      const g = r() * 6.2832
      const m = 0.4 + 0.6 * r()
      out.push({
        x: ((i + 0.2 + 0.6 * r()) / NX - 0.5) * ASP,
        y: (j + 0.2 + 0.6 * r()) / NY - 0.5,
        t: T0 + 0.3 * r() * r() + 0.02 * out.length * 0.2,
        iv: 1 / (0.45 + 0.5 * r()),
        c: Math.cos(a), s: Math.sin(a),
        ax: 1 + 0.9 * r() * r(),
        th: r() * Math.PI,
        tx: Math.cos(g) * m, ty: Math.sin(g) * m,
        ret: 140 + 900 * r(),
        delay: 0.04 + 0.3 * r(),
      })
    }
  out[1].t = T0 // somebody has to be first
  return out
})()

/** The zircon's own outline in the frame: a prism closed by a pyramid at each end (S = the pyramid's share of the half-length). */
const ZS = 0.22
const ZIR = { c: 1, s: 0, L: 0.2, W: 0.06 }
const zirJS = (x: number, y: number) => {
  const dx = x - SEEDS[0].x, dy = y - SEEDS[0].y
  const a = Math.abs((ZIR.c * dx + ZIR.s * dy) / ZIR.L), b = Math.abs((-ZIR.s * dx + ZIR.c * dy) / ZIR.W)
  return Math.max(b, a + ZS * b)
}
const gaugeJS = (sd: Seed, x: number, y: number) => {
  if (sd === SEEDS[0]) return zirJS(x, y)
  const dx = x - sd.x
  const dy = y - sd.y
  const qx = (sd.c * dx + sd.s * dy) / sd.ax
  const qy = -sd.s * dx + sd.c * dy
  return Math.max(Math.abs(qx), Math.abs(0.5 * qx + 0.8660254 * qy), Math.abs(0.5 * qx - 0.8660254 * qy))
}
/** When the last pocket closes with these seeds, and where (before rescaling). */
function lastPocket() {
  let tm = 0
  let mx = 0
  let my = 0
  const area = new Array<number>(NS).fill(0)
  const GX = 64
  const GY = 36
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const x = ((i + 0.5) / GX - 0.5) * ASP
      const y = (j + 0.5) / GY - 0.5
      let t = 1e9
      let who = 0
      SEEDS.forEach((sd, k) => {
        const tk = sd.t + gaugeJS(sd, x, y) * sd.iv
        if (tk < t) {
          t = tk
          who = k
        }
      })
      area[who] += (ASP / GX) * (1 / GY)
      if (t > tm) {
        tm = t
        mx = x
        my = y
      }
    }
  return { tm, mx, my, rad: area.map((a) => Math.sqrt(Math.max(a, 0.002) / Math.PI)) }
}

// nucleation is heard: a tick per seed, rising, where it is in the frame
const P0 = lastPocket()
const K0 = (LOCK - T0) / (P0.tm - T0)
const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "sizzle", o: { g: 0.8, dur: 1.4 } },
  { s: "rumble", o: { f: 90, dur: 2, g: 0.4 } },
  ...SEEDS.map((sd, i) => ({ s: "knap" as const, p: T0 + (sd.t - T0) * K0, o: { f: H(30 + ((i * 7) % 24)), g: 0.3, pos: [sd.x / (ASP / 2), sd.y * 2, 0.3] as const } })),
  ...SEEDS.filter((_, i) => i % 3 === 0).map((sd, i) => ({ s: "glass" as const, p: T0 + (sd.t - T0) * K0 + 0.06, o: { f: H(40 + i * 4), g: 0.14, pos: [sd.x / (ASP / 2), sd.y * 2, 0.5] as const } })),
  { s: "riser", p: LOCK - 0.28, o: { dur: 0.28 * DUR, g: 0.5 } },
  // the last boundary snaps shut
  { s: "glass", p: LOCK, o: { f: H(64), g: 1, pos: [P0.mx / (ASP / 2), P0.my * 2, 0] } },
  { s: "glass", p: LOCK, o: { f: H(96), g: 0.5, pos: [P0.mx / (ASP / 2), P0.my * 2, 0] } },
  { s: "crack", p: LOCK, o: { f: 2400, g: 0.6 } },
  { s: "sub", p: LOCK, o: { g: 0.6 } },
  { s: "shimmer", p: LOCK + 0.01, o: { g: 0.5, dur: 1.6 } },
  // and everything else is sand
  { s: "hiss", p: LOCK + 0.04, o: { dur: 0.7, g: 0.6 } },
  ...SEEDS.slice(1).map((sd, i) => ({ s: "stone" as const, p: LOCK + (sd.delay + 0.22) / DUR, o: { f: H(40 + ((i * 5) % 20)), g: 0.22, pos: [sd.x / (ASP / 2), sd.y * 2, 0.2] as const } })),
]

const t: TransitionDef = {
  id: "anneal",
  dur: DUR,
  inAt: LOCK,
  ease: (x) => x,
  snd,
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const sA = SEEDS.map((s) => new THREE.Vector4(s.x, s.y, s.t, s.iv))
    const sB = SEEDS.map((s) => new THREE.Vector4(s.c, s.s, s.ax, s.th))
    const sC = SEEDS.map((s) => new THREE.Vector4(s.tx, s.ty, s.ret, s.delay))
    const uA = uniformArray(sA, "vec4")
    const uB = uniformArray(sB, "vec4")
    const uC = uniformArray(sC, "vec4")
    const rad = P0.rad.slice()
    const uR = uniformArray(rad, "float")
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      p: uniform(0),
      uK: uniform(K0),
      uQ: uniform(new THREE.Vector2(P0.mx, P0.my)),
      // the crystal in the incoming frame: centre and long axis (cos, sin); its half-length and half-width
      uZ: uniform(new THREE.Vector4(0.2, 0, 1, 0)),
      uZs: uniform(new THREE.Vector2(0.2, 0.06)),
    }
    const sq = (x: F): F => x.mul(x) as F

    /** The zircon's gauge: 1 on its outline, a prism with a pyramid at each end; vec3(gauge, along, across) in units of its half-size. */
    const zirAt = (P: V2): V3 => {
      const d = P.sub(U.uZ.xy).toVar()
      const a = U.uZ.z.mul(d.x).add(U.uZ.w.mul(d.y)).div(U.uZs.x)
      const b = U.uZ.z.mul(d.y).sub(U.uZ.w.mul(d.x)).div(U.uZs.y)
      return vec3(max(abs(b), abs(a).add(abs(b).mul(ZS))), a, b) as V3
    }
    /** Which facet owns a point: vec4(when it froze, when the runner-up would have, id, gauge in its own facet). */
    const cellAt = (P: V2): V4 => {
      const gz = zirAt(P).x.toVar()
      const t1 = float(1e3).toVar()
      const t2 = float(1e3).toVar()
      const id = float(0).toVar()
      const g1 = float(0).toVar()
      Loop(NS, ({ i }) => {
        const a = (uA.element(i) as unknown as V4).toVar()
        const b = (uB.element(i) as unknown as V4).toVar()
        const d = P.sub(a.xy).toVar()
        const q = vec2(b.x.mul(d.x).add(b.y.mul(d.y)).div(b.z), b.x.mul(d.y).sub(b.y.mul(d.x))).toVar()
        const g = i.equal(0).select(gz, max(abs(q.x), max(abs(q.x.mul(0.5).add(q.y.mul(0.8660254))), abs(q.x.mul(0.5).sub(q.y.mul(0.8660254)))))).toVar()
        const tt = a.z.add(g.mul(a.w)).toVar()
        const near = tt.lessThan(t1)
        t2.assign(near.select(t1, tt.lessThan(t2).select(tt, t2)))
        id.assign(near.select(float(i), id))
        g1.assign(near.select(g, g1))
        t1.assign(near.select(tt, t1))
      })
      const sc = (x: F): F => x.sub(T0).mul(U.uK).add(T0) as F
      return vec4(sc(t1), sc(t2), id, g1) as V4
    }

    const pass = ctx.pass(({ uv, res, time }) => {
      const p = U.p
      const asp = res.x.div(res.y)
      const P0v = uv.sub(0.5).mul(vec2(asp, 1)).toVar()
      const A = (q: THREE.Node): V3 => sampleRT(U.tA, clamp(q as V2, 0.001, 0.999) as V2).rgb as V3
      const B = sampleRT(U.tB, uv).rgb.toVar()
      const tf = max(p.sub(LOCK), 0).mul(DUR).toVar() // seconds since the lock

      // ---- after the lock every facet shrinks about its own nucleus: pull this pixel back to where it was in the net
      const own = cellAt(P0v as V2).toVar()
      const ownI = int(own.z.add(0.5))
      const oa = (uA.element(ownI) as unknown as V4).toVar()
      const oc = (uC.element(ownI) as unknown as V4).toVar()
      const isKeep = step(own.z, 0.5)
      const u = max(tf.sub(oc.w), 0).div(0.5).toVar()
      // (a damped bounce in size: it lands, rebounds a little, settles)
      const kk = mix(float(0.46).add(exp(u.mul(-4.2)).mul(abs(cos(u.mul(5.2)))).mul(0.54)), 1, isKeep).toVar()
      const src = oa.xy.add(P0v.sub(oa.xy).div(kk)).toVar()
      const c = cellAt(src as V2).toVar()
      const idI = int(c.z.add(0.5))
      const sa = (uA.element(idI) as unknown as V4).toVar()
      const sb = (uB.element(idI) as unknown as V4).toVar()
      const scn = (uC.element(idI) as unknown as V4).toVar()
      const suv = src.div(vec2(asp, 1)).add(0.5).toVar()

      // ---- the melt, quenching: the glow drops and reddens, a skin wrinkles over it
      const quench = smoothstep(0, 0.14, p)
      const shim = vec2(vnoise(uv.mul(vec2(9, 30)).add(vec2(0, time.mul(1.3)))), vnoise(uv.mul(vec2(11, 26)).add(vec2(5, time.mul(-1.1))))).sub(0.5).mul(0.006).mul(quench)
      const a0 = A(uv.add(shim)).toVar()
      const skin = vnoise(uv.mul(vec2(70, 40))).mul(0.25).add(0.75)
      const melt = mix(a0, a0.mul(vec3(0.62, 0.42, 0.36)).mul(skin).add(vec3(0.05, 0.012, 0.0).mul(quench)), quench.mul(0.8)).toVar()

      // ---- the facet: the old picture held and bent, in interference colours
      const d = src.sub(sa.xy).toVar()
      const zone = floor(c.w.mul(26).add(vnoise(vec2(c.w.mul(9), c.z)).mul(2))) // growth zones: steps in thickness
      const ret = scn.z.add(dot(d, scn.xy).mul(520)).add(zone.mul(23)).toVar()
      const inter = vec3(sq(sin(ret.mul(Math.PI / 650)) as F), sq(sin(ret.mul(Math.PI / 550)) as F), sq(sin(ret.mul(Math.PI / 450)) as F))
      const stage = p.mul(1.5)
      const ext = sq(sin(sb.w.sub(stage).mul(2)) as F).toVar()
      const edge = c.y.sub(c.x).toVar() // 0 on a boundary
      const closed = step(c.y, p) // the neighbour has arrived too
      const bevel = smoothstep(0.0, 0.03, edge).oneMinus().mul(closed)
      const pic = A(suv.add(scn.xy.mul(0.022)).add(scn.xy.mul(bevel).mul(0.03))).toVar()
      const lum = luma(pic)
      const cross = pic.mul(0.35).add(inter.mul(ext).mul(lum.mul(1.1).add(0.34))).toVar()
      // the polarisers uncross: plain light, pale glass with only a breath of colour
      const unx = smoothstep(LOCK, LOCK + 0.14, p)
      const plain = mix(vec3(0.74, 0.75, 0.74), inter.mul(0.5).add(0.5), 0.22).mul(lum.mul(0.5).add(0.75))
      const facet = mix(cross, plain, unx.mul(0.85)).toVar()
      // the boundary: a dark line with a lit lip; never thinner than a pixel and a half
      const lw = max(float(0.004), float(2.2).div(res.y))
      const line = smoothstep(0, lw, edge).oneMinus().mul(closed)
      facet.mulAssign(float(1).sub(line.mul(0.8)))
      facet.addAssign(vec3(1.0, 0.95, 0.85).mul(smoothstep(lw, lw.mul(3), edge).oneMinus().mul(smoothstep(0, lw, edge)).mul(closed).mul(0.16)))
      // the growth front gives off its latent heat
      const front = exp(max(p.sub(c.x), 0).div(-0.018)).mul(step(c.x, p))
      facet.addAssign(vec3(1.0, 0.62, 0.22).mul(front).mul(0.9).add(vec3(1.0, 0.95, 0.8).mul(sq(sq(front) as F)).mul(0.6)))

      const col = mix(melt, facet, step(c.x, p)).toVar()

      // ---- the lock: light runs out along the boundaries from the last pocket
      const rq = length(src.sub(U.uQ))
      const ring = exp(sq(rq.sub(tf.mul(2.6)).div(0.09) as F).negate()).mul(exp(tf.mul(-2.4))).mul(step(LOCK, p))
      col.addAssign(vec3(1.0, 0.97, 0.9).mul(ring).mul(line.mul(2.2).add(0.22)))
      col.addAssign(vec3(1.0, 0.95, 0.85).mul(exp(sq(rq.div(0.06) as F).negate())).mul(exp(tf.mul(-7))).mul(step(LOCK, p)).mul(1.4))

      // ---- the zircon (the facet seeded on the crystal): zoned throughout, its zones parallel to its own faces
      const Z = zirAt(src as V2).toVar()
      const gz = Z.x
      const osc = sin(gz.mul(88).add(vnoise(vec2(gz.mul(11), 3.1)).mul(4))).toVar() // oscillatory growth zones
      const zline = smoothstep(0.82, 0.98, abs(osc))
      const core = smoothstep(0.2, 0.42, gz).oneMinus() // the cloudy, darker core (radiation damage)
      // in crossed polarisers: high-order colours stepping zone by zone, never quite extinct
      const retZ = gz.mul(460).add(osc.mul(55)).add(1180)
      const interZ = vec3(sq(sin(retZ.mul(Math.PI / 650)) as F), sq(sin(retZ.mul(Math.PI / 550)) as F), sq(sin(retZ.mul(Math.PI / 450)) as F))
      const crossZ = interZ.mul(ext.mul(0.6).add(0.4)).mul(float(1).sub(zline.mul(0.35))).mul(mix(float(1), 0.45, core)).add(vec3(0.05, 0.03, 0.02))
      // in plain light: honey at the rims, red-brown toward the core, the zones as faint bands
      const honey = mix(vec3(0.42, 0.13, 0.06), mix(vec3(0.93, 0.6, 0.3), vec3(1.0, 0.83, 0.52), smoothstep(0.4, 1.0, gz)), smoothstep(0.16, 0.46, gz))
      const plainZ = honey.mul(float(0.9).add(osc.mul(0.06))).mul(float(1).sub(zline.mul(0.12))).mul(lum.mul(0.25).add(0.82)).toVar()
      // its edges: the prism's top ridge, the shoulders where the pyramids begin, a bright lip inside the outline
      const zpx = float(1.6).div(res.y).div(U.uZs.y) // a pixel and a half, in units of its half-width
      const ridge = exp(sq(Z.z.div(0.12) as F).negate()).mul(step(abs(Z.y), float(1).sub(ZS)))
      const shoulder = smoothstep(0, zpx.mul(2), abs(abs(Z.y).sub(1 - ZS)).mul(U.uZs.x.div(U.uZs.y))).oneMinus().mul(step(abs(Z.z), 0.97))
      const lip = smoothstep(0, zpx.mul(4), abs(gz.sub(0.94))).oneMinus()
      plainZ.addAssign(vec3(1.0, 0.95, 0.82).mul(ridge.mul(0.22).add(shoulder.mul(0.3)).add(lip.mul(0.25))))
      const zirC = mix(crossZ, plainZ, unx).toVar()
      zirC.mulAssign(float(1).sub(smoothstep(0.99, 1.0, gz).mul(0.55))) // its outline
      col.assign(mix(col, zirC, step(c.z, 0.5).mul(step(c.x, p))))

      // ---- every other facet lets go and is a grain of sand: an irregular, sub-angular polygon of its own
      // (seven half-planes at seeded angles and distances), worn round as it settles. Most are frosted quartz,
      // some clear quartz (the slide seen bent through it, a dark rim of total reflection), a few small dark heavy minerals.
      const rr0 = (uR.element(ownI) as unknown as F).toVar()
      const gh = hash21(vec2(own.z.mul(1.37), 4.1)).toVar()
      const heavy = step(gh, 0.17)
      const clear = step(0.17, gh).mul(step(gh, 0.5))
      const frosted = float(1).sub(heavy).sub(clear)
      const rel = src.sub(oa.xy).div(rr0.mul(mix(float(1), 0.5, heavy))).toVar() // in its own mean radii
      const pg = float(0).toVar()
      const pk = float(0).toVar()
      Loop(7, ({ i }) => {
        const fi = float(i)
        const hh = hash22(vec2(own.z.mul(1.7).add(fi), 9.1))
        const an = fi.mul(6.2832 / 7).add(hh.x.sub(0.5).mul(0.75)).add(own.z.mul(2.1)).toVar()
        const dd = dot(rel, vec2(cos(an), sin(an))).div(hh.y.mul(0.38).add(0.78)).toVar()
        pk.assign(dd.greaterThan(pg).select(an, pk))
        pg.assign(max(pg, dd))
      })
      const rlen = length(rel)
      const round = smoothstep(0, 0.7, u)
      const rnd = mix(pg, rlen, mix(float(0.16), 0.38, frosted).mul(round)).toVar() // worn: frosted grains more than clear ones
      const lim = mix(float(4), 1, round)
      const aa = float(2).div(res.y).div(rr0.mul(kk))
      const inDisc = smoothstep(lim.sub(aa), lim, rnd).oneMinus()
      const same = step(abs(c.z.sub(own.z)), 0.5)
      const frostK = smoothstep(0.05, 0.6, u)
      // its facets: the outer band slopes away along the winning half-plane's normal; the top is flat
      const fn = vec2(cos(pk), sin(pk))
      const slope = smoothstep(0.5, 0.95, rnd.div(lim))
      const N = vec3(fn.mul(slope.mul(0.95)), 1).normalize().toVar()
      const Lr = vec3(-0.35, 0.5, 0.8).normalize()
      const dif = max(dot(N, Lr), 0).toVar()
      const spec = pow(max(dot(N, vec3(-0.25, 0.35, 0.9).normalize()), 0), 28)
      const rimK = smoothstep(0.78, 1.0, rnd.div(lim))
      // clear quartz: the glass behind, bent and a little grey, dark at the rim, a bright crescent where light leaves it
      const refr = sampleRT(U.tB, uv.add(fn.mul(slope).mul(-0.022).div(vec2(asp, 1))) as V2).rgb.mul(vec3(0.86, 0.88, 0.89))
      const crescent = smoothstep(0.55, 0.9, rnd.div(lim)).mul(max(dot(fn, vec2(0.6, -0.8)), 0)).mul(rimK.oneMinus().mul(0.6).add(0.4))
      const edgeC = smoothstep(0.9, 1.0, rnd.div(lim)) // a thin dark rim: light at a grazing face is reflected away
      const clearC = refr.mul(dif.mul(0.14).add(0.9)).mul(mix(float(1), 0.5, edgeC)).add(vec3(1.0, 0.99, 0.96).mul(crescent.mul(0.22).add(spec.mul(0.7)))).add(vec3(0.04).mul(slope))
      // frosted quartz: milky, lit through, sugary with pits, the facets still there under the frost
      const pit = vnoise(src.mul(48).add(own.z.mul(13))).mul(0.08).add(vnoise(src.mul(130)).mul(0.04)).add(0.9)
      const milk = mix(refr, vec3(0.86, 0.86, 0.84), 0.72) // a little of the glass comes through
      const frostC = milk.mul(mix(float(0.84), 1.06, dif)).mul(pit).mul(mix(float(1), 0.82, edgeC)).add(vec3(0.07).mul(rimK.mul(slope.oneMinus().add(0.5)))).add(vec3(0.3).mul(spec.mul(0.2)))
      // heavy minerals: near black, opaque, a metallic glint on the facet that faces the lamp
      const heavyC = vec3(0.045, 0.04, 0.037).add(vec3(0.03).mul(dif)).add(vec3(0.75, 0.77, 0.8).mul(spec.mul(1.2))).mul(mix(float(1), 0.6, rimK))
      const body = clearC.mul(clear).add(frostC.mul(frosted)).add(heavyC.mul(heavy))
      const grainC = mix(col, body, frostK)
      const fade = smoothstep(0.84, 0.97, p).oneMinus()
      const grainA = inDisc.mul(same).mul(mix(float(1), fade, step(0.0001, u)))
      // ---- the one that stays: its facet draws in to the crystal's own outline, and is the crystal
      const tight = smoothstep(LOCK + 0.01, 0.84, p)
      const loose = tight.oneMinus()
      const inZ = smoothstep(0, zpx, gz.sub(loose.mul(loose).mul(loose).mul(2.5).add(1))).oneMinus()
      const keepC = mix(col, B, smoothstep(LOCK + 0.1, 0.92, p))
      const keepA = inZ.mul(step(c.z, 0.5))
      // under a grain the glass is in its shade
      const shade = float(1).sub(smoothstep(lim.mul(0.95), lim.mul(1.3), rnd).oneMinus().mul(0.2).mul(frostK).mul(fade).mul(isKeep.oneMinus()))
      const outC = mix(B.mul(shade), mix(grainC, keepC, isKeep), mix(grainA, keepA, isKeep)).toVar()
      return vec4(mix(outC, B, smoothstep(0.975, 1, p)), 1)
    }, U)

    const fit = { cx: 9, cy: 9, ax: 0 }
    return {
      render(a) {
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        // seed 0 sits on the incoming scene's portal: an oriented quad round the crystal (TL, TR, BR, BL along its long axis)
        const c = a.pb?.c
        if (c) {
          const X = (k: number) => (c[k][0] / 2) * ASP
          const Y = (k: number) => c[k][1] / 2
          const cx = (X(0) + X(1) + X(2) + X(3)) / 4
          const cy = (Y(0) + Y(1) + Y(2) + Y(3)) / 4
          const ux = (X(1) + X(2) - X(0) - X(3)) / 4, uy = (Y(1) + Y(2) - Y(0) - Y(3)) / 4
          const vx = (X(0) + X(1) - X(2) - X(3)) / 4, vy = (Y(0) + Y(1) - Y(2) - Y(3)) / 4
          const L = Math.max(Math.hypot(ux, uy), 0.01)
          const W = Math.max(Math.hypot(vx, vy), 0.005)
          const ca = ux / L, sa = uy / L
          U.uZ.value.set(cx, cy, ca, sa)
          U.uZs.value.set(L, W)
          // (the net is re-solved only when the crystal has really moved, so the facets do not swim)
          if (Math.abs(cx - fit.cx) > 0.03 || Math.abs(cy - fit.cy) > 0.03 || Math.abs(Math.atan2(sa, ca) - fit.ax) > 0.08) {
            fit.cx = cx
            fit.cy = cy
            fit.ax = Math.atan2(sa, ca)
            Object.assign(ZIR, { c: ca, s: sa, L, W })
            const s0 = SEEDS[0]
            s0.x = cx
            s0.y = cy
            s0.iv = 0.2
            sA[0].set(s0.x, s0.y, s0.t, s0.iv)
            const lp = lastPocket()
            U.uK.value = (LOCK - T0) / (lp.tm - T0)
            U.uQ.value.set(lp.mx, lp.my)
            for (let i = 0; i < NS; i++) rad[i] = lp.rad[i]
          }
        }
        pass.render(a.out)
      },
      warm: () => [{ pass, target: hold }],
      dispose() {
        pass.dispose()
      },
    }
  },
}
export default t
