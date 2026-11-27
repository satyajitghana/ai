// Scene 6, "A galaxy assembles". Clumps that sit on the ripples fall together, the mess turns into
// a puffy old disk, a thin blue disk settles inside it and winds up into arms, and we pick one
// ordinary star about halfway out.
//
// World rule. One position function, `starAt(seed, spin, tau)`: every one of the 150,000 stars is a
// closed-form blend, in polar coordinates about the centre, from an orbit inside its home clump to
// an orbit in the disk. `spin` 0..1 is the assembly, `tau` is galactic time (how far things have
// turned). It runs once per star in a compute pass (one vec4 out) and has a JS twin, `starJS`,
// which places the marker, the camera and the selection box. Units are thousands of light-years.
//
// The disk is a kinematic density wave: a star rides an oval of size `a` whose long axis is turned
// by psi(a) = psi0 + OMP tau - k(spin) ln(a / A_BAR) outside the bar and not at all inside it, so the
// ovals crowd into two trailing arms that leave the ends of a bar. The star goes round at
// omega(a) = 10 / sqrt(a^2 + 16) (a flat rotation curve), the pattern at omega(A_SUN): stars drift
// through the arms, except near the marker's radius, which is why the box stays in its arm.
// Seen from +y (galactic north) the disk turns clockwise and the arms trail; `create` asserts it.
//
// Drawing. Stars: one instanced draw of camera-facing capsules (a disc, or an arc while the skip
// runs), additive, into a half-float target; size and brightness are pixel-aware and the circle of
// confusion comes from the real distance. Dust: `dustAt` dims and reddens every star whose sight
// line crosses the plane inside a lane, and the same lanes are laid over the glow as multiplied
// sprites. A full-screen pass adds the ripple gas in the plane (the plate's blotches) and lays the
// caliper, drawn into the MSAA stage, on top.

import * as THREE from "three/webgpu"
import { abs, atan, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dot, exp, float, Fn, fwidth, If, instancedArray, instanceIndex, length, log, max, min, mix as mixN, mod, normalize, positionGeometry, positionLocal, positionWorld, normalWorld, pow, select, sign, sin, smoothstep, sqrt, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { SCENES } from "../script"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { projectPortal } from "../engine/quad"
import { disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos, type Pos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles } from "../engine/titles"
import { hash11, sampleRT, sat, smoothstepRev, vnoise, type F, type V2, type V4 } from "../engine/tsl"
import type { Ctx, Cue, Portal, PostOpts, SceneInstance, State } from "../engine/types"
import { RIPPLE_VIEW, ripples, SELECT } from "../engine/ui"

// ---------------------------------------------------------------- the galaxy's numbers

const N = 150_000
const KLY = 30 // world units per ripple unit: the plate's frame is 160 x 90 kly
const A_BAR = 13 // half-length of the bar
const A_SUN = 26.5 // the marker's orbit, and the pattern's corotation radius
const R_DISK = 50 // what the caliper closes on
const KMAX = 3.6 // twist of the ovals: pitch = atan(1 / k), about 15 degrees
const PSI0 = 0.55
const E_BAR = 0.4
const E_ARM = 0.095
const E_ARM4 = 0.026
const PH4 = 1.0
// where tau stops: the marker then sits at azimuth MARK_AZ (near side, right of centre)
const MARK_AZ = 0.95
const MARK_M0 = PSI0 - KMAX * Math.log(A_SUN / A_BAR) + (-Math.PI / 2 - PH4) / 4 + Math.PI / 2
const TAU_STOP = (MARK_AZ - MARK_M0 + 6.2831853 * 3) / (10 / Math.sqrt(A_SUN * A_SUN + 16))
const SKIP0 = 0.45
const SKIP1 = 3.3
const BOX_AT = 3.55
const omega = (a: number) => 10 / Math.sqrt(a * a + 16)
const OMP = omega(A_SUN)
// populations
const THIN = 0, THICK = 1, BULGE = 2, HALO = 3, GLOB = 4, GSE = 5, STREAM = 6
const STREAM_INC = 1.36, STREAM_NODE = -0.5, STREAM_A = 46, STREAM_M0 = 2.2

// ---------------------------------------------------------------- the ripple field, in JS (clumps sit on its maxima)

const fr = (x: number) => x - Math.floor(x)
function h21(x: number, y: number) {
  let a = fr(x * 0.1031), b = fr(y * 0.1031), c = fr(x * 0.1031)
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d; b += d; c += d
  return fr((a + b) * c)
}
function vn(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  return mix(mix(h21(ix, iy), h21(ix + 1, iy), ux), mix(h21(ix, iy + 1), h21(ix + 1, iy + 1), ux), uy)
}
function fbmJS(x: number, y: number) {
  let a = 0.5, s = 0
  for (let i = 0; i < 5; i++) {
    s += a * vn(x, y)
    const nx = 1.6 * x - 1.2 * y
    y = 1.2 * x + 1.6 * y
    x = nx
    a *= 0.5
  }
  return s
}
function ripplesJS(x: number, y: number) {
  x += 13.1; y += 7.7
  const a = fbmJS(x * 1.3, y * 1.3)
  const b = fbmJS(x * 2.9 + a * 1.7 + 4.2, y * 2.9 + a * 1.7 + 4.2)
  return clamp((a - 0.47) * 1.5 + (b - 0.47) * 0.9 + 0.5)
}

type Clump = { th: number; r: number; tf: number; sig: number; m: number }

function findClumps(): Clump[] {
  const W = (RIPPLE_VIEW * 16) / 9 * 0.56, Hh = RIPPLE_VIEW * 0.56
  const cand: { x: number; y: number; v: number }[] = []
  for (let j = 0; j <= 60; j++)
    for (let i = 0; i <= 106; i++) {
      const x = (i / 106 - 0.5) * 2 * W, y = (j / 60 - 0.5) * 2 * Hh
      if (Math.hypot(x, y) < 0.42) continue
      cand.push({ x, y, v: ripplesJS(x, y) })
    }
  cand.sort((p, q) => q.v - p.v)
  const out: Clump[] = []
  const pts: { x: number; y: number }[] = []
  for (const c of cand) {
    if (out.length >= 14) break
    if (pts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 0.66)) continue
    pts.push(c)
    const x = c.x * KLY, z = -c.y * KLY
    const r = Math.hypot(x, z)
    const m = 0.35 + 2.2 * Math.max(0, c.v - 0.55)
    out.push({ th: Math.atan2(z, x), r, tf: clamp(0.2 + 0.0052 * r + 0.06 * Math.sin(out.length * 2.4), 0.2, 0.7), sig: 2.3 + 2.6 * m, m })
  }
  return out
}

// ---------------------------------------------------------------- seeds

type Seeds = { A: Float32Array; B: Float32Array; C: Float32Array; clumps: Clump[]; home: number; marker: number }

function makeSeeds(): Seeds {
  const R = rng(60606)
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4), C = new Float32Array(N * 4)
  const g = () => Math.sqrt(-2 * Math.log(1 - R() * 0.999999)) * Math.cos(6.2831853 * R())
  const clumps = findClumps()
  // the camera starts in the heaviest clump that is neither at the edge nor at the middle
  let home = 0, best = -1
  clumps.forEach((c, i) => {
    const s = c.m * (c.r > 26 && c.r < 62 ? 1 : 0.3)
    if (s > best) { best = s; home = i }
  })
  clumps[home].m *= 1.5
  const cum: number[] = []
  let tot = 0
  for (const c of clumps) { tot += c.m; cum.push(tot) }
  const pick = () => {
    const x = R() * tot
    for (let i = 0; i < cum.length; i++) if (x <= cum[i]) return i
    return cum.length - 1
  }
  // 40 globular clusters: old, tight, in a round halo
  const GC: number[][] = []
  for (let i = 0; i < 40; i++) GC.push([7 + 62 * R() ** 1.7, R() * 6.2831853, Math.acos(2 * R() - 1), R() * 6.2831853, 0.16 + 0.22 * R()])
  const nThin = 72_000, nThick = 40_000, nBulge = 24_000, nHalo = 3_000, nGlob = 2_800, nGse = 4_200
  for (let i = 0; i < N; i++) {
    const o = i * 4
    let pop: number
    if (i < nThin) pop = THIN
    else if (i < nThin + nThick) pop = THICK
    else if (i < nThin + nThick + nBulge) pop = BULGE
    else if (i < nThin + nThick + nBulge + nHalo) pop = HALO
    else if (i < nThin + nThick + nBulge + nHalo + nGlob) pop = GLOB
    else if (i < nThin + nThick + nBulge + nHalo + nGlob + nGse) pop = GSE
    else pop = STREAM
    const u = R()
    A[o + 3] = pop
    C[o + 3] = u
    if (pop <= BULGE) {
      // an exponential disk (the thick one shorter), or the bar
      let a: number
      if (pop === THIN) {
        do a = R() < 0.42 ? R_DISK * R() ** 0.62 : -14 * Math.log(1 - R() * 0.9995)
        while (a < 2.5 || a > 66)
        // the faint outskirts thin out past the rim the caliper closes on
        if (a > R_DISK && R() < 0.86) a = 5 + 45 * Math.sqrt(R())
      } else if (pop === THICK) {
        do a = -8.5 * Math.log(1 - R() * 0.9995)
        while (a < 1 || a > 46)
      } else a = 0.25 + (A_BAR * 1.02) * R() ** 1.55
      const hz = pop === THIN ? 0.32 * (1 + a / 90) : pop === THICK ? 1.0 * (1 + a / 60) : 0.95 * Math.exp(-a / 22) + 0.35
      A[o] = a
      A[o + 2] = hz * g() * 0.8
      if (pop === THIN) {
        A[o + 1] = R() * 6.2831853
        // born inside-out, as the thin disk settles (beat 2)
        B[o + 3] = clamp(0.5 + 0.0085 * a + 0.1 * R(), 0, 0.985)
      } else {
        const c = clumps[pick()]
        B[o] = c.th
        B[o + 1] = c.r
        B[o + 2] = c.tf
        B[o + 3] = pop === BULGE ? c.tf * (0.55 + 0.4 * R()) : Math.min(0.9, c.tf * (0.7 + 0.45 * R()) + 0.004 * a)
        const k = R() ** 0.7
        C[o] = c.sig * k * g() * 0.75
        C[o + 1] = c.sig * k * g() * 0.45
        C[o + 2] = c.sig * k * g() * 0.75
        // once in the disk it is anywhere up to a turn ahead of where its clump was: phase mixing
        A[o + 1] = c.th + R() * 6.2831853
      }
    } else if (pop === HALO || pop === GLOB) {
      if (pop === GLOB) {
        const c = GC[i % GC.length]
        A[o] = c[0]; A[o + 1] = c[1]; B[o] = c[2]; B[o + 1] = c[3]
        const k = R() ** 0.6
        C[o] = c[4] * k * g(); C[o + 1] = c[4] * k * g(); C[o + 2] = c[4] * k * g()
        B[o + 2] = 0.3
        B[o + 3] = -1
      } else {
        A[o] = pop === HALO ? 12 + 100 * R() ** 2.4 : 6 + 34 * R() ** 1.3
        A[o + 1] = R() * 6.2831853
        B[o] = Math.acos(2 * R() - 1)
        B[o + 1] = R() * 6.2831853
        B[o + 2] = 0.3
        B[o + 3] = -1
      }
    } else {
      // the two satellites: one orbit each (the first shallow and close, the second over the poles),
      // every star a little ahead of or behind the middle (C.w carries how much)
      const first = pop === GSE
      const n = g() * 0.5
      A[o] = first ? 30 : STREAM_A
      A[o + 1] = first ? 0.6 : STREAM_M0
      B[o] = first ? 0.5 : STREAM_INC; B[o + 1] = first ? 3.6 : STREAM_NODE; B[o + 2] = first ? 0.5 : 0.36; B[o + 3] = -1
      C[o] = 1.2 * g(); C[o + 1] = 1.2 * g(); C[o + 2] = 1.2 * g()
      C[o + 3] = n
    }
  }
  // the marker: an ordinary thin-disk star at corotation, in the minor arm between the two main
  // ones (its phase in the wave is fixed because it turns at the pattern's speed), just above the plane
  const marker = 4321
  const mo = marker * 4
    A[mo] = A_SUN
  A[mo + 1] = MARK_M0
  A[mo + 2] = 0.07
  B[mo + 3] = 0.6
  C[mo + 3] = 0.3141
  return { A, B, C, clumps, home, marker }
}

// ---------------------------------------------------------------- starAt, the JS twin

type Story = { spin: number; tau: number; k: number; bar: number; arm: number }

const storyOf = (spin: number, tau: number, o: Story, wind = 1): Story => {
  o.spin = spin
  o.tau = tau
  o.k = KMAX * smooth(0.3, 1, spin) * (0.68 + 0.32 * wind)
  o.bar = smooth(0.5, 0.95, spin)
  o.arm = smooth(0.35, 0.9, spin)
  return o
}

/** Where star `i` is. Mirrors the TSL `starAt` below line for line (disk populations only). */
function starJS(sd: Seeds, i: number, st: Story, out: THREE.Vector3) {
  const o = i * 4
  const a = sd.A[o], M0 = sd.A[o + 1], hz = sd.A[o + 2], pop = sd.A[o + 3]
  const u = sd.C[o + 3]
  const om = omega(a)
  const M = M0 + om * st.tau
  const la = Math.log(Math.max(a, A_BAR) / A_BAR)
  const al = M - (PSI0 + OMP * st.tau - st.k * la)
  const hot = pop === THIN ? 1 : pop === THICK ? 0.45 : 1
  const eb = st.bar * E_BAR * (1 - smooth(A_BAR * 0.72, A_BAR * 1.12, a))
  const env = smooth(A_BAR * 0.8, A_BAR * 1.35, a) * (1 - smooth(40, 60, a))
  const e = (eb + st.arm * E_ARM * env) * hot
  const e4 = pop === THIN ? st.arm * E_ARM4 * env : 0
  const rd = a * (1 - e * Math.cos(2 * al) - e4 * Math.cos(4 * al + PH4) + 0.018 * Math.sin(1.9 * M + u * 50))
  const thd = M + 0.9 * e * Math.sin(2 * al)
  let yd = hz * Math.sin(1.7 * M + u * 40)
  if (pop === BULGE) yd *= 0.7 + 0.8 * Math.sin(al) ** 2 * clamp(a / A_BAR)
  yd += 4.5 * clamp((rd - 36) / 22) ** 2 * Math.sin(thd - 0.8)
  let r = rd, th = thd, y = yd
  if (pop !== THIN) {
    const th0 = sd.B[o], r0 = sd.B[o + 1], tf = sd.B[o + 2], ts = sd.B[o + 3]
    const g = clamp(st.spin / tf), gs = g * g * (3 - 2 * g)
    const Rc = r0 * (1 - 0.9 * gs)
    const thc = th0 + omega(r0) * 0.5 * st.tau + 2.4 * gs
    const ph = st.spin * 7 + u * 3
    const or = (sd.C[o] * Math.cos(ph) - sd.C[o + 2] * Math.sin(ph)) * (1 - 0.5 * gs)
    const ot = (sd.C[o] * Math.sin(ph) + sd.C[o + 2] * Math.cos(ph)) * (1 + 3 * gs)
    const rs = Math.hypot(Rc + or, ot), ths = thc + Math.atan2(ot, Rc + or)
    const w = smooth(ts - 0.14, ts, st.spin)
    r = mix(rs, rd, w); th = mix(ths, thd, w); y = mix(sd.C[o + 1] * (1 - 0.5 * gs), yd, w)
  }
  return out.set(r * Math.cos(th), y, r * Math.sin(th))
}

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const sd = makeSeeds()
  const stars = ctx.target({})
  const stage = stageTarget(ctx)
  const post = ctx.target({})
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 4000)
  const TANF = Math.tan((15 * Math.PI) / 180)

  // the sense of the winding, checked where it is defined: stars go round with +theta (clockwise
  // from +y) and the arm's crest falls back in theta as it goes out, so the arms trail
  {
    const s0 = storyOf(1, 0, { spin: 0, tau: 0, k: 0, bar: 0, arm: 0 }), s1 = storyOf(1, 0.01, { spin: 0, tau: 0, k: 0, bar: 0, arm: 0 })
    const p0 = starJS(sd, sd.marker, s0, new THREE.Vector3()), p1 = starJS(sd, sd.marker, s1, new THREE.Vector3())
    const dth = Math.atan2(p1.z, p1.x) - Math.atan2(p0.z, p0.x)
    const dpsi = -s0.k // d psi / d ln a
    if (!(dth > 0 && dpsi < 0)) console.error("[universe] galaxy: arms are not trailing")
  }

  // ---- story uniforms
  const uSpin = uniform(0), uTau = uniform(0), uPsi = uniform(PSI0), uK = uniform(0), uBar = uniform(0), uArm = uniform(0)
  const uStreak = uniform(0), uGain = uniform(1), uFocus = uniform(10), uAper = uniform(0.02), uPx = uniform(1000), uDust = uniform(0), uDbg = uniform(0), uKick = uniform(0), uBul = uniform(0.15)
  const uRes = uniform(new THREE.Vector2(1280, 720))

  const sA = instancedArray(sd.A, "vec4"), sB = instancedArray(sd.B, "vec4"), sC = instancedArray(sd.C, "vec4")
  const oPos = instancedArray(N, "vec4")

  const omN = (a: F): F => float(10).div(sqrt(a.mul(a).add(16))) as F
  const sm = (e0: number | F, e1: number | F, x: F): F => smoothstep(e0 as number, e1 as number, x) as F

  /** The world rule. xyz, and in w how deep in an arm the star is (0..1.6). */
  const starAt = Fn(([A, B, C]: [V4, V4, V4]) => {
    const a = A.x, M0 = A.y, hz = A.z, pop = A.w, u = C.w
    const P = vec3(0).toVar()
    const armv = float(0).toVar()
    If(pop.lessThan(2.5), () => {
      const om = omN(a as F)
      const M = M0.add(om.mul(uTau)).toVar()
      const la = log(max(a, A_BAR).div(A_BAR)).toVar()
      const al = M.sub(uPsi.sub(uK.mul(la))).toVar()
      const thin = step(pop, 0.5).toVar()
      const hot = mixN(select(pop.lessThan(1.5), 0.45, 1), 1, thin)
      const eb = uBar.mul(E_BAR).mul(sm(A_BAR * 0.72, A_BAR * 1.12, a as F).oneMinus())
      const env = sm(A_BAR * 0.8, A_BAR * 1.35, a as F).mul(sm(40, 60, a as F).oneMinus()).toVar()
      const e = eb.add(uArm.mul(E_ARM).mul(env)).mul(hot).toVar()
      const e4 = thin.mul(uArm).mul(E_ARM4).mul(env)
      const rd = a.mul(float(1).sub(e.mul(cos(al.mul(2)))).sub(e4.mul(cos(al.mul(4).add(PH4)))).add(sin(M.mul(1.9).add(u.mul(50))).mul(0.018))).toVar()
      const thd = M.add(e.mul(0.9).mul(sin(al.mul(2)))).toVar()
      const yd = hz.mul(sin(M.mul(1.7).add(u.mul(40)))).toVar()
      const sa = sin(al)
      yd.mulAssign(mixN(1, sa.mul(sa).mul(0.8).mul(sat(a.div(A_BAR) as F)).add(0.7), step(1.5, pop)))
      const wp = sat(rd.sub(36).div(22) as F)
      yd.addAssign(wp.mul(wp).mul(4.5).mul(sin(thd.sub(0.8))))
      const r = rd.toVar(), th = thd.toVar(), y = yd.toVar()
      If(thin.lessThan(0.5), () => {
        const th0 = B.x, r0 = B.y, tf = B.z, ts = B.w
        const g = sat(uSpin.div(tf) as F).toVar()
        const gs = g.mul(g).mul(g.mul(-2).add(3)).toVar()
        const Rc = r0.mul(gs.mul(-0.9).add(1))
        const thc = th0.add(omN(r0 as F).mul(0.5).mul(uTau)).add(gs.mul(2.4))
        const ph = uSpin.mul(7).add(u.mul(3)).toVar()
        const cp = cos(ph).toVar(), sp = sin(ph).toVar()
        const or = C.x.mul(cp).sub(C.z.mul(sp)).mul(gs.mul(-0.5).add(1))
        const ot = C.x.mul(sp).add(C.z.mul(cp)).mul(gs.mul(3).add(1))
        const rs = length(vec2(Rc.add(or), ot))
        const ths = thc.add(atan(ot, Rc.add(or)))
        const w = smoothstep(ts.sub(0.14), ts, uSpin).toVar()
        r.assign(mixN(rs, rd, w))
        th.assign(mixN(ths, thd, w))
        y.assign(mixN(C.y.mul(gs.mul(-0.5).add(1)), yd, w))
      })
      P.assign(vec3(r.mul(cos(th)), y, r.mul(sin(th))))
      // where in the wave: the ovals crowd at sin 2a = -1 (and the minor pair at sin(4a + PH4) = -1)
      const c2 = sat(sin(al.mul(2).sub(0.25)).mul(-0.5).add(0.5) as F)
      const c4 = sat(sin(al.mul(4).add(PH4)).mul(-0.5).add(0.5) as F)
      armv.assign(c2.mul(c2).mul(c2).add(c4.mul(c4).mul(c4).mul(0.55)).mul(env).mul(uArm))
    }).Else(() => {
      // halo, globular clusters and the two satellites: a rosette in a tilted plane
      const stream = step(4.5, pop).toVar()
      const first = stream.mul(step(pop, 5.5)).toVar()
      const sp = uSpin as unknown as F
      const n = C.w.mul(stream)
      // it comes in from far out, and the tide draws it along its own orbit: those ahead run ahead
      const far = mixN(sm(0.25, 0.62, sp), sm(0.06, 0.42, sp), first).oneMinus().mul(stream).toVar()
      const aa = a.mul(n.mul(0.1).add(1)).mul(far.mul(2.6).add(1)).toVar()
      const stretch = mixN(sm(0.45, 1, sp).mul(2.6), sm(0.3, 0.8, sp).mul(5.5), first).add(0.05).add(uTau.mul(mixN(float(0.012), 0.03, first)))
      const M = A.y.add(omN(a as F).mul(0.7).mul(uTau)).sub(n.mul(stretch)).toVar()
      const rr = aa.mul(float(1).sub(B.z.mul(cos(M.mul(1.38)))))
      const x1 = rr.mul(cos(M)), z1 = rr.mul(sin(M)).toVar()
      const ci = cos(B.x), si = sin(B.x), cn = cos(B.y).toVar(), sn = sin(B.y).toVar()
      const z2 = z1.mul(ci).toVar()
      const orb = vec3(x1.mul(cn).sub(z2.mul(sn)), z1.mul(si), x1.mul(sn).add(z2.mul(cn)))
      P.assign(orb.add(C.xyz.mul(mixN(1, far.mul(0.6).add(0.45).add(sm(0.5, 1, sp).mul(0.5)), stream))))
    })
    return vec4(P, armv)
  }).setLayout({ name: "galaxyStarAt", type: "vec4", inputs: [{ name: "A", type: "vec4" }, { name: "B", type: "vec4" }, { name: "C", type: "vec4" }] })

  const write = Fn(() => {
    oPos.element(instanceIndex).assign(starAt(sA.element(instanceIndex), sB.element(instanceIndex), sC.element(instanceIndex)))
  })().compute(N)

  // ---- dust: one density function, in the pattern's frame
  const DUST_PH = 0.6
  const dustAt = Fn(([p]: [V2]) => {
    const r = length(p).toVar()
    const th = atan(p.y, p.x).toVar()
    const al = th.sub(uPsi.sub(uK.mul(log(max(r, A_BAR).div(A_BAR))))).toVar()
    const l2 = sat(sin(al.mul(2).add(DUST_PH)).mul(-0.5).add(0.5) as F)
    const l4 = sat(sin(al.mul(4).add(PH4 + DUST_PH)).mul(-0.5).add(0.5) as F)
    const lane = pow(l2, 6).add(pow(l4, 6).mul(0.5))
    const env = smoothstep(A_BAR * 0.8, A_BAR * 1.5, r).mul(smoothstep(40, 56, r).oneMinus())
    const pf = th.sub(uPsi)
    const n = vnoise(vec2(cos(pf), sin(pf)).mul(r).mul(0.42) as V2).toVar()
    return lane.mul(n.mul(n).mul(1.5).add(0.3)).add(n.mul(n).mul(0.16)).mul(env)
  }).setLayout({ name: "galaxyDustAt", type: "float", inputs: [{ name: "p", type: "vec2" }] })

  // ---- the stars: one instanced draw
  const starMat = new THREE.NodeMaterial()
  {
    const P4 = oPos.toAttribute() as V4
    const SA = sA.toAttribute() as V4, SB = sB.toAttribute() as V4
    const id = float(instanceIndex)
    const h1 = hash11(id), h2 = hash11(id.add(200003))
    const pop = SA.w
    const thin = step(pop, 0.5)
    const isDisk = step(pop, 2.5)
    // the landing of the mirror's last segment shoves the near stars outward, and it rings down
    const away = P4.xyz.sub(cameraPosition)
    const P = P4.xyz.add(normalize(away).mul(uKick).mul(exp(length(away).mul(-0.12))))
    const rr = length(P.xz)
    const dth = min(omN(rr as F).mul(uStreak).mul(0.5), 0.6).mul(isDisk)
    const cs = cos(dth), sn = sin(dth)
    const Pa = vec3(P.x.mul(cs).add(P.z.mul(sn)), P.y, P.z.mul(cs).sub(P.x.mul(sn)))
    const Pb = vec3(P.x.mul(cs).sub(P.z.mul(sn)), P.y, P.z.mul(cs).add(P.x.mul(sn)))
    const VP = cameraProjectionMatrix.mul(cameraViewMatrix)
    const ca = VP.mul(vec4(Pa, 1)), cb = VP.mul(vec4(Pb, 1))
    const d = max(ca.w, 1e-3)
    const dpx = cb.xy.div(max(cb.w, 1e-3)).sub(ca.xy.div(d)).mul(uRes).mul(0.5)
    const Lpx = min(length(dpx), 400)
    const dir = select(Lpx.greaterThan(0.5), dpx.div(max(length(dpx), 1e-4)), vec2(1, 0))
    // what kind of star
    const blob = step(mod(id, 36), 0.5).mul(isDisk)
    const arm = P4.w
    const young = thin.mul(step(0.32, h2)).mul(sat(arm.mul(1.25) as F))
    const hii = thin.mul(step(0.986, h2)).mul(sat(arm.mul(1.4) as F))
    const born = mixN(1, smoothstep(SB.w.sub(0.03), SB.w.add(0.03), uSpin), thin)
    const lum = pow(h1, 7).mul(11).add(0.22).mul(young.mul(3.2).add(1)).mul(mixN(1, uBul, step(1.5, pop).mul(step(pop, 2.5)))).mul(mixN(1, 1.7, step(4.5, pop))).mul(mixN(1, smoothstep(1.5, 11, rr).mul(0.62).add(0.38), isDisk))
    const warm = mixN(vec3(1, 0.74, 0.46), vec3(1, 0.9, 0.74), h2)
    const cOld = mixN(vec3(1, 0.66, 0.34), warm, sat(float(2).sub(pop).mul(0.6).add(thin.mul(0.5)) as F))
    const cPop = mixN(mixN(cOld, vec3(1, 0.8, 0.56), step(2.5, pop)), mixN(vec3(0.62, 0.84, 1.35), vec3(1.3, 0.72, 0.7), step(5.5, pop)), step(4.5, pop))
    const colS = mixN(mixN(cPop, vec3(0.42, 0.66, 1.9), young.mul(0.95)), vec3(1.5, 0.42, 0.6), hii)
    // dust on the sight line: only for a star on the far side of the plane from the lens
    const toC = cameraPosition.sub(P)
    const side = sign(cameraPosition.y)
    const f = sat(float(0.5).sub(P.y.mul(side).div(0.7)) as F)
    const X = P.add(toC.mul(clampN(P.y.negate().div(toC.y), 0, 1)))
    const tauD = dustAt(X.xz as V2).mul(uDust).mul(f).div(max(abs(normalize(toC).y), 0.22))
    const ext = exp(vec3(1, 1.45, 2.1).mul(tauD.negate()).mul(1.9))
    // size on screen: never under a pixel and a bit, a real disc up close, a bokeh disc out of focus
    const R0 = 1.15
    const sizeW = mixN(mixN(lum.mul(0.0011).add(0.0028), 0.16, hii), 2.3, blob)
    const rs = sizeW.mul(uPx).div(d)
    const coc = uAper.mul(abs(float(1).div(d).sub(float(1).div(uFocus)))).mul(uPx).mul(blob.oneMinus())
    const R = min(sqrt(rs.mul(rs).add(coc.mul(coc)).add(R0 * R0)), mixN(float(64), 92, blob))
    const prox = min(pow(uFocus.div(d), 2), 30)
    const inten = mixN(lum, mixN(float(15), 1.6, step(1.5, pop)), blob).mul(uGain).mul(prox).mul((R0 * R0)).div(R.mul(R)).mul(born).div(Lpx.div(R.mul(1.6)).add(1)).mul(smoothstep(48, 100, rs).mul(blob).oneMinus())
    const dbg = step(abs(id.sub(sd.marker)), 0.5).mul(uDbg)
    const col = mixN(mixN(colS, mixN(cPop, vec3(0.6, 0.78, 1.5), sat(arm as F).mul(thin).mul(0.7)), blob).mul(ext).mul(inten), vec3(0, 40, 0), dbg)
    const corner = positionGeometry.xy.mul(2)
    const base = select(corner.x.lessThan(0), ca, cb)
    const Rq = R.mul(2)
    const off = dir.mul(corner.x).add(vec2(dir.y.negate(), dir.x).mul(corner.y)).mul(Rq)
    const clip = vec4(base.xy.add(off.mul(2).div(uRes).mul(base.w)), base.z, base.w)
    starMat.vertexNode = select(ca.w.lessThan(0.06).or(inten.lessThan(1e-5).and(dbg.lessThan(0.5))), vec4(2, 2, 2, 1), clip)
    const vL = vec2(corner.x.mul(Lpx.mul(0.5).add(Rq)), corner.y.mul(Rq)).toVarying()
    const vK = vec3(Lpx, R, smoothstep(2.5, 7, coc)).toVarying()
    const vCol = col.toVarying()
    starMat.fragmentNode = Fn(() => {
      const q = length(vec2(max(abs(vL.x).sub(vK.x.mul(0.5)), 0), vL.y)).div(vK.y).toVar()
      const gauss = exp(q.mul(q).mul(-1.9))
      const disc = smoothstepRev(1.32, 1.02, q).mul(q.mul(q).mul(0.4).add(0.5)).mul(0.62)
      return vec4(vCol.mul(mixN(gauss, disc, vK.z)), 1)
    })()
  }
  Object.assign(starMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor })
  const starMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), starMat)
  starMesh.count = N
  starMesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(starMesh)

  // ---- dust lanes: sprites lying in the plane on the inner edge of each arm, multiplied over the glow
  const ND = 3400
  const dA = new Float32Array(ND * 4)
  {
    const R = rng(7707)
    for (let i = 0; i < ND; i++) {
      const lane = R() < 0.78
      const a = A_BAR * 0.95 + (50 - A_BAR) * R() ** 0.85
      // along a lane (in one of four), or a feather somewhere between
      const four = R() < 0.3
      const al = lane ? (four ? (-Math.PI / 2 - PH4 - DUST_PH) / 4 + (Math.floor(R() * 4) * Math.PI) / 2 : (-Math.PI / 2 - DUST_PH) / 2 + Math.floor(R() * 2) * Math.PI) + (R() - 0.5) * 0.16 : R() * 6.2831853
      dA[i * 4] = a
      dA[i * 4 + 1] = al
      dA[i * 4 + 2] = (lane ? 1 : 0.55) * (0.7 + 0.9 * R()) * (four && lane ? 0.7 : 1)
      dA[i * 4 + 3] = R()
    }
  }
  const sD = instancedArray(dA, "vec4")
  const dustMat = new THREE.NodeMaterial()
  {
    const D = sD.toAttribute() as V4
    const a = D.x
    const th = uPsi.sub(uK.mul(log(a.div(A_BAR)))).add(D.y)
    const c = positionGeometry.xy.mul(2)
    // long axis along the arm: a log spiral's tangent is (radial 1, azimuthal -k)
    const kk = max(uK, 0.3)
    const tn = normalize(vec2(1, kk.negate()))
    const len = D.z.mul(3.6), wid = D.z.mul(1.15)
    const lr = c.x.mul(len).mul(tn.x).sub(c.y.mul(wid).mul(tn.y))
    const lt = c.x.mul(len).mul(tn.y).add(c.y.mul(wid).mul(tn.x))
    const r = a.add(lr)
    const t2 = th.add(lt.div(a))
    const W = vec3(r.mul(cos(t2)), 0, r.mul(sin(t2)))
    dustMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(W, 1))
    const vC = vec3(c, D.w).toVarying()
    const vS = D.z.toVarying()
    dustMat.fragmentNode = Fn(() => {
      const q = vC.xy.toVar()
      const n = vnoise(q.mul(vec2(3.2, 1.6)).add(vC.z.mul(91)) as V2).mul(0.65).add(vnoise(q.mul(vec2(8, 4)).add(vC.z.mul(37)) as V2).mul(0.35))
      const body = smoothstepRev(1, 0.25, length(q.mul(vec2(1, 1)))).mul(smoothstep(0.28, 0.72, n))
      const al = sat(body.mul(0.5).mul(vS).mul(uDust) as F)
      return vec4(mixN(vec3(1), vec3(0.42, 0.3, 0.22), al), 1)
    })()
  }
  Object.assign(dustMat, { transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor })
  const dustMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dustMat)
  dustMesh.count = ND
  dustMesh.frustumCulled = false
  dustMesh.renderOrder = 2
  scene.add(dustMesh)

  // ---- the caliper: a beam along x on the near side, a fixed jaw on one rim, a sliding jaw
  const calScene = new THREE.Scene()
  const cal = new THREE.Group()
  calScene.add(cal)
  const slider = new THREE.Group()
  cal.add(slider)
  const BEAM_Z = 57 // world z of the beam's inner edge
  const JAW = 60 // how far the jaws reach from it, toward the centre
  const uLit = uniform(1)
  const calMat = (kind: number) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const n = normalize(normalWorld).toVar()
      const W = positionWorld
      const Lc = positionLocal
      const v = normalize(cameraPosition.sub(W)).toVar()
      // lit by the galaxy itself: the warm bulge as a point light, the disk as a wide soft one
      const toB = vec3(0, 3, 0).sub(W).toVar()
      const lb = normalize(toB)
      const fall = float(2600).div(dot(toB, toB).add(900))
      const dif = sat(dot(n, lb) as F).mul(fall)
      const hv = normalize(lb.add(v))
      const spec = pow(sat(dot(n, hv) as F), 36).mul(fall).mul(1.6)
      const fres = pow(sat(float(1).sub(dot(n, v)) as F), 4)
      // brushed steel: the grain runs along the beam
      const brush = vnoise(vec2(Lc.x.mul(0.35), Lc.y.mul(26)) as V2).mul(0.5).add(vnoise(vec2(Lc.x.mul(1.3), Lc.y.mul(70)) as V2).mul(0.5)).toVar()
      const alb = vec3(0.4, 0.41, 0.44).mul(brush.mul(0.55).add(0.62)).toVar()
      // warm from the bulge's side, blue from the arms above and around
      const l2 = vec3(0.19, 0.86, 0.47)
      const h2 = normalize(l2.add(v))
      const c = alb.mul(vec3(1, 0.78, 0.52).mul(dif).mul(1.7).add(vec3(0.42, 0.55, 0.9).mul(n.y.mul(0.06).add(0.07))).add(vec3(0.5, 0.6, 0.85).mul(sat(dot(n, l2) as F)).mul(0.3)).add(vec3(1, 0.8, 0.55).mul(fall).mul(0.16))).toVar()
      c.addAssign(vec3(1, 0.8, 0.55).mul(spec).mul(brush.mul(0.8).add(0.6)))
      c.addAssign(vec3(0.6, 0.72, 1).mul(pow(sat(dot(n, h2) as F), 40)).mul(brush.mul(0.5).add(0.1)).mul(0.5))
      c.addAssign(vec3(0.25, 0.4, 0.9).mul(fres).mul(0.55))
      // engraving, filled white, on the faces that look up: a scale on the beam (unnumbered), a
      // vernier of ten divisions in nine on the slider
      const up = smoothstep(0.92, 0.99, n.y).toVar()
      const tick = (x: F, period: number, wdt: number) => {
        const g = abs(mod(x.div(period).add(0.5), 1).sub(0.5)).mul(period)
        const aa = max(fwidth(x), 1e-4)
        // never thinner than a pixel and a half; a scale too fine to draw goes away
        return smoothstepRev(1, 0, g.sub(max(float(wdt), aa.mul(0.75))).div(aa)).mul(smoothstepRev(period * 0.3, period * 0.14, aa)) as F
      }
      const s = Lc.y // across the beam (shape space y = toward the galaxy)
      let ink: F
      if (kind === 0) {
        const t1 = tick(Lc.x as F, 1, 0.1).mul(step(-2.2, s))
        const t5 = tick(Lc.x as F, 5, 0.14).mul(step(-3.6, s))
        const t10 = tick(Lc.x as F, 10, 0.2).mul(step(-5.4, s))
        ink = max(max(t1, t5), t10).mul(step(s, -0.25)).mul(step(-8.8, s)) as F
      } else {
        const t9 = tick(Lc.x.sub(0.0) as F, 0.9, 0.06).mul(step(s, 1.1)).mul(step(0.1, s)).mul(step(Lc.x, 9.05)).mul(step(-0.05, Lc.x))
        ink = t9 as F
      }
      c.assign(mixN(c, c.mul(0.05), ink.mul(up)))
      return vec4(c.mul(uLit), 1)
    })()
    return m
  }
  const ex = (pts: [number, number][], y0: number, y1: number, bevel = 0.14) => {
    const sh = new THREE.Shape()
    pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])))
    sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 4 })
    g.translate(0, 0, y0 + bevel)
    return g
  }
  // (shape space: x along the beam, y toward the galaxy, z up; the group turns it into the world)
  const beamM = calMat(0), slideM = calMat(1)
  const beam = new THREE.Mesh(ex([[-61, -16], [98, -16], [98, 0], [-61, 0]], 0, 1.1, 0.3), beamM)
  const jawL = new THREE.Mesh(ex([[-58, 0], [-R_DISK, 0], [-R_DISK, JAW], [-R_DISK - 1.5, JAW - 7], [-58, 9]], 0.1, 1.0), slideM)
  const jawR = new THREE.Mesh(ex([[0, -17.4], [0, JAW], [1.5, JAW - 7], [8, 9], [8, 1.4], [17, 1.4], [17, -17.4]], -0.5, 1.6), slideM)
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 1, 36), slideM)
  thumb.rotation.x = Math.PI / 2
  thumb.position.set(12, -18.2, 0.55)
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.3, 20), slideM)
  lock.rotation.x = Math.PI / 2
  lock.position.set(12, -8.5, 2.1)
  slider.add(jawR, thumb, lock)
  cal.add(beam, jawL)
  cal.rotation.x = -Math.PI / 2 // shape y -> world -z, shape z -> world y
  cal.visible = false

  // ---- the air: ripple gas in the plane, and the caliper laid over
  const U = {
    tS: uniformTexture(stars.texture),
    tC: uniformTexture(stage.texture),
    uCam: uniform(new THREE.Vector3()),
    uRt: uniform(new THREE.Vector3()),
    uUp: uniform(new THREE.Vector3()),
    uFw: uniform(new THREE.Vector3()),
    uGas: uniform(1),
    uWind: uniform(0),
    uCal: uniform(0),
  }
  const air = ctx.pass(({ uv }) => {
    const c = sampleRT(U.tS, uv).rgb.toVar()
    If(U.uGas.greaterThan(0.002), () => {
      const rd = normalize(U.uFw.add(U.uRt.mul(uv.x.mul(2).sub(1))).add(U.uUp.mul(uv.y.mul(2).sub(1)))).toVar()
      // two sheets, so it has depth when the lens moves
      const sheet = (h: number, wgt: number) => {
        const t = float(h).sub(U.uCam.y).div(min(rd.y, -1e-4))
        const p = U.uCam.xz.add(rd.xz.mul(t)).toVar()
        const r = length(p)
        // the gas winds up with the disk: inner parts lead
        const an = U.uWind.mul(float(10).div(sqrt(r.mul(r).add(260))))
        const cs = cos(an), sn = sin(an)
        const q = vec2(p.x.mul(cs).add(p.y.mul(sn)), p.y.mul(cs).sub(p.x.mul(sn)))
        const g = ripples(vec2(q.x, q.y.negate()).div(KLY) as V2)
        const dens = pow(sat(g.sub(0.3).mul(1.45) as F), 2.4)
        return dens.mul(exp(r.mul(-0.011))).mul(wgt).mul(smoothstep(0, 0.02, rd.y.negate())).mul(sat(t.mul(0.5) as F))
      }
      const gs = sheet(0, 0.6).add(sheet(-7, 0.4))
      c.addAssign(vec3(0.09, 0.15, 0.36).mul(gs).mul(U.uGas))
    })
    // a feathered darkening under the headline and its source line, so nothing bright sits behind the type
    const sd2 = length(uv.sub(vec2(0.25, 0.835)).div(vec2(0.36, 0.2)))
    c.mulAssign(smoothstepRev(1, 0.3, sd2).mul(0.86).oneMinus())
    If(U.uCal.greaterThan(0.001), () => {
      const k = sampleRT(U.tC, uv)
      c.assign(c.mul(k.a.mul(U.uCal).oneMinus()).add(k.rgb.mul(U.uCal)))
    })
    return vec4(c, 1)
  }, U)

  // ---------------------------------------------------------------- per-frame state

  const st = storyOf(0, 0, { spin: 0, tau: 0, k: 0, bar: 0, arm: 0 })
  const vMark = new THREE.Vector3(), vT = new THREE.Vector3(), vP = new THREE.Vector3(), v0 = new THREE.Vector3()
  const right = new THREE.Vector3(), upv = new THREE.Vector3(), fwd = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const home = sd.clumps[sd.home]
  const vHome = new THREE.Vector3(home.r * Math.cos(home.th), 0, home.r * Math.sin(home.th))
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const F = { box: 0, boxPx: [0, 0, 0, 0], cal: 0, lock: 0, num: [0, 0, 0, 0], kick: 0, flash: 0, roll: 0, rollV: 0, dist: 10 }
  const POST: PostOpts = { tone: "agx", exposure: 1, bloom: 0.36, bloomThresh: 0.9, bloomRadius: 0.85, halation: 0.22, contrast: 1.12, sat: 1.12, vignette: 0.3, grain: 0.03, ca: 0.0012, lift: [0.004, 0.006, 0.013], gain: [1.0, 1.0, 1.03] }
  const HUD = { color: "#dfe7ff", shadow: "rgba(0,0,0,0.6)" }
  const HUD_OWN = { color: "#dfe7ff", hide: true }
  const TITLES = { color: "#f3f1ff", shadow: "rgba(2,3,10,0.75)", delay: [1.5, 0.5, 0.25], maxLine: 30 }

  function update(s: State) {
    const t0 = s.at(0), t2 = s.at(2)
    const arriving = s.beat === 0 && t0 < 0
    // ---- story
    // (the creep and the slow pull through the first hold are bounded functions of the ambient clock, so the next beat starts from wherever they got to)
    const held = Math.max(0, s.time - 8.6)
    const spin = mix(0.62 * s.k(0, 0.3, 9, E.io2) + 0.05 * (1 - Math.exp(-held / 9)), 1, s.k(1, 0.1, 6.6, E.io2))
    const xs = s.beat === 2 ? clamp((t2 - SKIP0) / (SKIP1 - SKIP0)) : 0
    const after = s.beat === 2 ? Math.max(0, t2 - SKIP1) : 0
    // the skip, with the stop rocking back a little
    const wob = after > 0 ? -0.5 * Math.exp(-after * 5) * Math.sin(after * 8) : 0
    // it gathers speed all the way and stops dead: tau goes as x^2.5
    const fx = Math.pow(xs, 2.5)
    const rate = xs > 0 && xs < 1 ? ((TAU_STOP - 12) * 2.5 * Math.pow(xs, 1.5)) / (SKIP1 - SKIP0) : 0
    const live = 0.11 * s.time + 6.5 * s.k(0, 0.2, 9, E.out2) + 2.6 * s.k(1, 0, 7, E.io2)
    // the skip ends on a fixed tau, so the marker stops in the same place on every run
    const tau = s.beat === 2 ? mix(live, TAU_STOP + 0.11 * (t2 - SKIP1), fx) + wob : live
    storyOf(Math.min(1, spin), tau, st, s.beat === 2 ? fx : 0)
    uSpin.value = st.spin
    uTau.value = tau
    uPsi.value = PSI0 + OMP * tau
    uK.value = st.k
    uBar.value = st.bar
    uArm.value = st.arm
    uStreak.value = rate / 30
    const bump = (c: number, w: number) => Math.exp(-(((st.spin - c) / w) ** 2))
    uBul.value = 0.1 + 0.05 * smooth(0.3, 0.46, st.spin) + 0.05 * smooth(0.5, 0.66, st.spin) + 0.13 * bump(0.44, 0.05) + 0.13 * bump(0.62, 0.035)
    uDust.value = smooth(0.5, 0.95, st.spin)
    starJS(sd, sd.marker, st, vMark)

    // ---- camera: in the home clump, back and up in log distance, down to three-quarters, then at the marker
    const pull = s.k(0, 0.25, 8.4, E.io3)
    const tilt = s.k(1, 0.1, 3.4, E.io3)
    const dive = s.k(2, BOX_AT + 0.2, 7, E.io3)
    const ex2 = E.in2(s.exit)
    const D0 = Math.exp(mix(Math.log(1.7), Math.log(150), pull))
    let D = D0
    const drift = 0.3 * (1 - Math.exp(-held / 11))
    D *= Math.exp(drift * (1 - tilt) + 0.56 * tilt) * (1 + 0.07 * fx)
    const push = s.k(2, 7, 16, E.out2)
    D = Math.exp(mix(Math.log(D * (1 + 0.05 * tilt)), Math.log(84), dive)) * Math.exp(-1.1 * ex2) * (1 - 0.13 * push)
    let el = mix(Math.PI / 2, 0.6, tilt)
    el = mix(el + 0.07 * fx, 0.6, dive)
    // it turns with the galaxy as it backs away, squares up to the caliper, and for the dive comes round to the marker's side
    let az = 0.95 * (1 - pull) + 0.35 * (1 - tilt) + 0.33 - 0.02 * s.time
    az = mix(az, Math.atan2(vMark.x, vMark.z) + 2.95, dive)
    az += s.mouse.x * 0.03
    el = Math.min(Math.PI / 2, el + s.mouse.y * 0.02)
    const ce = Math.cos(el), se = Math.sin(el)
    fwd.set(-ce * Math.sin(az), -se, -ce * Math.cos(az))
    right.set(Math.cos(az), 0, -Math.sin(az))
    upv.crossVectors(right, fwd)
    // what it looks at: its own clump, then the centre, then the marker; the subject is held right of the title column
    {
      const g = clamp(st.spin / home.tf), gs = g * g * (3 - 2 * g)
      const thc = home.th + omega(home.r) * 0.5 * tau + 2.4 * gs
      vHome.set(Math.cos(thc), 0, Math.sin(thc)).multiplyScalar(home.r * (1 - 0.9 * gs))
    }
    vT.copy(vHome).multiplyScalar(1 - clamp(D0 / 148) ** 1.3)
    vT.lerp(vMark, dive)
    const fw = D * TANF
    // (during the skip the polar stream loops up over the disk, and in the dive the outer disk rises
    // behind the type: so from the skip on the subject sits lower and further right, and the dive comes in
    // shallower, which keeps the disk's far edge under the source line)
    const low = s.k(2, 0, 1.2, E.io2)
    vT.addScaledVector(right, -fw * (s.w / s.h) * mix(mix(0.3, 0.16 + 0.08 * low, tilt) * smooth(0.3, 1, pull), 0.25, dive)).addScaledVector(upv, fw * mix(mix(0.28, 0.1 + 0.2 * low, tilt) * smooth(0.3, 1, pull), 0.3, dive))
    const dr = 0.006 * D
    vT.x += dr * (Math.sin(s.time * 0.31) + 0.5 * Math.sin(s.time * 0.73 + 1))
    vT.z += dr * (Math.sin(s.time * 0.27 + 2) + 0.5 * Math.sin(s.time * 0.61))
    const kick = t0 >= 0 && s.beat === 0 ? Math.exp(-t0 * 3.2) * Math.cos(t0 * 15) : 0
    const stop = s.beat === 2 && after > 0 ? Math.exp(-after * 6) : 0
    cam.position.copy(vT).addScaledVector(fwd, -D * (1 + 0.035 * kick - 0.03 * stop * Math.cos(after * 22))).addScaledVector(right, 0.012 * D * stop * Math.sin(after * 31))
    v0.copy(fwd).negate()
    basis.makeBasis(right, upv, v0)
    cam.quaternion.setFromRotationMatrix(basis)
    cam.aspect = s.w / s.h
    cam.near = Math.max(0.03, D * 0.01)
    cam.far = D * 6 + 600
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    F.dist = D
    uRes.value.set(s.w, s.h)
    uPx.value = s.h / 2 / TANF
    uFocus.value = D
    uAper.value = 0.0055 * D * (1 + 0.5 * dive)
    uGain.value = 0.25 * Math.pow(215 / D, 1.12) * (1 + 0.5 * tilt) * (1 - 0.3 * dive) * (1 - 0.45 * smooth(60, 150, D0) * (1 - tilt))
    uKick.value = 0.5 * kick
    F.kick = t0 >= 0 && s.beat === 0 ? Math.exp(-t0 * 2.4) : arriving ? smooth(0.6, 1, s.enter) * 0.5 : 0
    // the pass's rays
    U.uCam.value.copy(cam.position)
    U.uFw.value.copy(fwd)
    U.uRt.value.copy(right).multiplyScalar(TANF * cam.aspect)
    U.uUp.value.copy(upv).multiplyScalar(TANF)
    U.uGas.value = (1 - smooth(0.25, 0.85, st.spin)) * (0.12 + 0.88 * smooth(0.25, 0.75, pull))
    U.uWind.value = st.spin * 9

    // ---- the caliper
    const inn = s.k(1, 1.5, 2.5, E.out3)
    const out = s.k(2, 0, 0.8, E.in2)
    const close = E.outBack(s.k(1, 2.0, 3.6, E.lin))
    F.cal = s.beat >= 1 ? inn * (1 - out) : 0
    F.lock = s.k(1, 3.42, 3.6, E.out3)
    cal.visible = F.cal > 0.001
    if (cal.visible) {
      const jx = R_DISK + 88 * (1 - close) + 70 * out
      slider.position.x = jx
      thumb.rotation.y = jx * 0.5
      cal.position.set(0, 1.6 + 26 * (1 - inn) + 30 * out, BEAM_Z + 60 * (1 - inn) + 90 * out)
      uLit.value = F.cal
      // where the numerals sit: over the beam, between the jaws
      const nx = (jx - R_DISK) * 0.5 + 4
      vP.set(nx, cal.position.y + 1.2, cal.position.z + 14).project(cam)
      F.num[0] = (vP.x * 0.5 + 0.5) * DW
      F.num[1] = (0.5 - vP.y * 0.5) * DH
      v0.set(nx + 30, cal.position.y + 1.2, cal.position.z + 14).project(cam)
      F.num[2] = Math.atan2(-(v0.y - vP.y) * DH, (v0.x - vP.x) * DW)
      v0.set(nx, cal.position.y + 1.2, cal.position.z + 6.6).project(cam)
      F.num[3] = Math.hypot((v0.x - vP.x) * 0.5 * DW, (v0.y - vP.y) * 0.5 * DH)
    }
    U.uCal.value = F.cal > 0.001 ? 1 : 0

    // ---- the box: a camera-facing 16:9 quad about the marker, sized in fractions of the frame
    const pop = s.k(2, BOX_AT, BOX_AT + 0.42, E.lin)
    F.box = pop
    const dm = v0.copy(vMark).sub(cam.position).dot(fwd)
    const frac = (mix(0.068, 0.092, dive) + 0.02 * push + 0.25 * ex2) * (pop > 0 ? 1 + 0.9 * (1 - E.outBack(pop)) : 1)
    const hw = frac * dm * TANF * cam.aspect, hh = (hw * 9) / 16
    corners[0].copy(vMark).addScaledVector(right, -hw).addScaledVector(upv, hh)
    corners[1].copy(vMark).addScaledVector(right, hw).addScaledVector(upv, hh)
    corners[2].copy(vMark).addScaledVector(right, hw).addScaledVector(upv, -hh)
    corners[3].copy(vMark).addScaledVector(right, -hw).addScaledVector(upv, -hh)
    vP.copy(corners[0]).project(cam)
    v0.copy(corners[2]).project(cam)
    F.boxPx[0] = (vP.x * 0.5 + 0.5) * DW
    F.boxPx[1] = (0.5 - vP.y * 0.5) * DH
    F.boxPx[2] = (v0.x - vP.x) * 0.5 * DW
    F.boxPx[3] = (vP.y - v0.y) * 0.5 * DH
    F.roll = xs
    F.rollV = rate
    F.flash = s.beat === 2 && after > 0 ? Math.exp(-after * 5) : 0
    // sound: the air follows how fast things are turning, the hum how far the disk has assembled
    if (s.live) {
      ctx.synth.bed("air", clamp(0.06 + 0.1 * (1 - pull) + rate * 0.03))
      // (the hum waits for the hand-off to land: until then it is the mirror's actuators)
      if (s.enter >= 1) ctx.synth.bed("hum", clamp(0.05 + 0.25 * st.spin))
      if (s.beat === 2 && rate > 0) ctx.synth.bed("wind", clamp(rate * 0.02))
    }
  }

  // ---------------------------------------------------------------- sound

  // Sheet: beats/sound-galaxy.md. Home harmonic 8 (the octave the act has been climbing to).
  const jaw = { x: 0, y: 0, z: 0 }
  /** The sliding jaw, wherever the caliper has it. */
  const atJaw = (): Pos => {
    jaw.x = slider.position.x
    jaw.y = cal.position.y
    jaw.z = cal.position.z
    return listenerPos(jaw, cam)
  }
  const atBox = (): Pos => [((F.boxPx[0] + F.boxPx[2] / 2) / DW) * 2 - 1, 1 - ((F.boxPx[1] + F.boxPx[3] / 2) / DH) * 2, 0.2]
  const CLOCK: Pos = [0.85, 0.86, 0] // the corner clock
  const cues: Cue[] = [
    // the pull back out of the mirror, over a low pad
    { b: 0, at: 0.05, s: "pad", o: { f: H(2), dur: 9, g: 0.9 } },
    { b: 0, at: 0.3, s: "whoosh", o: { f: H(2), dur: 4.5, g: 0.5 } },
    { b: 0, at: 4.6, s: "pad", o: { f: H(4), dur: 7, g: 0.6 } },
    // the two satellites arrive, one from each side
    { b: 0, at: 5.5, s: "sub", o: { f: H(2), dur: 1.6, g: 0.45, lfe: 0.8 }, pos: [-0.45, 0.1, 0.5] },
    { b: 0, at: 5.5, s: "pluck", o: { f: H(16), g: 0.5 }, pos: [-0.45, 0.1, 0.5] },
    { b: 0, at: 5.52, s: "glass", o: { f: H(64), g: 0.1 }, pos: [-0.45, 0.1, 0.5] },
    { b: 0, at: 7.9, s: "sub", o: { f: H(2), dur: 1.8, g: 0.5, lfe: 0.8 }, pos: [0.45, -0.1, 0.5] },
    { b: 0, at: 7.9, s: "pluck", o: { f: H(24), g: 0.5 }, pos: [0.45, -0.1, 0.5] },
    { b: 0, at: 7.92, s: "glass", o: { f: H(96), g: 0.1 }, pos: [0.45, -0.1, 0.5] },
    // a spiral: the caliper slides in along the near edge
    { b: 1, at: 0.1, s: "pad", o: { f: H(8), dur: 8, g: 0.6 } },
    { b: 1, at: 1.5, s: "whoosh", o: { f: H(8), dur: 1.2, g: 0.5 }, pos: [0.3, -0.5, -0.2] },
    // the lock: the jaw seats on the rim, the click, the thumb-screw, and the number
    { b: 1, at: 3.44, s: "thud", o: { f: H(4), g: 0.7 }, pos: atJaw },
    { b: 1, at: 3.46, s: "knap", o: { f: H(64), g: 0.5 }, pos: atJaw },
    { b: 1, at: 3.5, s: "gear", o: { f: H(40), dur: 0.14, g: 0.35 }, pos: atJaw },
    { b: 1, at: 3.62, s: "bell", o: { f: H(24), g: 0.3 }, pos: [0, -0.45, 0] },
    // the caliper opens and withdraws; then the skip, a swell that ends where the turning stops
    { b: 2, at: 0.05, s: "knap", o: { f: H(48), g: 0.4 }, pos: atJaw },
    { b: 2, at: SKIP0, s: "riser", o: { f: H(8), dur: SKIP1 - SKIP0, g: 0.5 } },
    { b: 2, at: SKIP0, s: "rumble", o: { f: H(2), dur: 3.2, g: 0.6 } },
    // the big moment: eight billion years on, it stops, and the clock lands
    { b: 2, at: SKIP1 - 0.02, s: "thud", o: { f: H(4), g: 0.8 }, pos: CLOCK },
    { b: 2, at: SKIP1, s: "sub", o: { f: H(2), dur: 2.2, g: 0.8, lfe: 1 } },
    // one ordinary star is selected, and the dive toward it begins
    { b: 2, at: BOX_AT, s: "select", o: { f: H(48), g: 1.2 }, pos: atBox },
    { b: 2, at: BOX_AT + 0.05, s: "glass", o: { f: H(64), g: 0.5 }, pos: atBox },
    { b: 2, at: BOX_AT + 0.2, s: "whoosh", o: { f: H(2), dur: 3.2, g: 0.4 } },
  ]
  // a thud as each of the big clumps reaches the middle, from the side it came in on, lower each time
  {
    const big = sd.clumps.map((c) => c).sort((p, q) => q.m - p.m).slice(0, 6).sort((p, q) => p.tf - q.tf)
    big.forEach((c, i) => {
      // invert spin = .62 io2((t - .3) / 8.7)
      const x = clamp(c.tf / 0.62)
      const u = x < 0.5 ? Math.sqrt(x / 2) : 1 - Math.sqrt((1 - x) / 2)
      const from = { x: Math.cos(c.th) * 5, y: 0, z: Math.sin(c.th) * 5 }
      cues.push({ b: 0, at: 0.3 + 8.7 * u, s: "thud", o: { f: H(8 - i), g: 0.3 + 0.08 * i }, pos: () => listenerPos(from, cam) })
    })
  }
  // the ratchet as the jaw closes, at the jaw, climbing; and the clock's wheels during the skip, at the clock, running down
  for (let i = 0; i < 14; i++) cues.push({ b: 1, at: 2.0 + 1.25 * (i / 14) ** 1.6, s: "tick", o: { f: H(64 + i * 2), g: 0.3 }, pos: atJaw })
  for (let i = 0; i < 30; i++) cues.push({ b: 2, at: SKIP0 + 0.15 + (SKIP1 - SKIP0 - 0.2) * (i / 30), s: "tick", o: { f: H(88 - i), g: 0.22 + 0.2 * Math.sin((i / 30) * Math.PI) }, pos: CLOCK })
  // the fall as it settles: harmonics stepping down to the home
  ;[32, 24, 16, 12, 8, 4].forEach((n, i) => cues.push({ b: 2, at: 2.3 + i * 0.36, s: "pad", o: { f: H(n), dur: 2.4, g: 0.5 } }))

  // ---------------------------------------------------------------- type

  const idx = SCENES.findIndex((d) => d.id === ctx.def.id)
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US")

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stars },
      { scene: calScene, camera: cam, target: stage },
      { pass: air, target: post },
    ],
    warmCompute: () => [write],
    render(s) {
      const r = ctx.renderer
      ctx.compute(write)
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stars)
      r.render(scene, cam)
      if (cal.visible) {
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(stage)
        r.render(calScene, cam)
        r.setClearColor(0x000000, 1)
      }
      U.tS.value = stars.texture
      U.tC.value = stage.texture
      air.render(post)
      POST.exposure = 1 + 0.9 * F.kick + 0.35 * F.flash
      POST.bloom = 0.36 + 0.5 * F.kick + 0.25 * F.rollV * 0.03 + 0.3 * F.flash
      POST.fade = s.exit > 0 ? 0 : 0
      ctx.finish(post.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      const fadeOut = 1 - clamp(s.exit * 2)
      // the measure's numerals, pinned to the beam
      if (s.beat === 1 || (s.beat === 2 && s.t < 0.6)) {
        const a = F.cal * (s.beat === 2 ? 1 - clamp(s.t / 0.3) : 1)
        const p = s.beat === 1 ? clamp((s.t - 3.46) / 0.5) : 1
        if (a > 0 && p > 0) {
          const x = F.num[0], y = F.num[1], rot = F.num[2]
          // printed on the steel: dark, sized to the beam as the lens sees it
          const sz = F.num[3] * 1.28
          const o = { rot, color: "#0b0c10", alpha: a * 0.94 }
          const wN = g.measure("100,000", { size: sz, font: "tall" })
          g.text("more than", x - wN / 2 - sz * 0.2, y, { ...o, size: sz * 0.27, font: "mono", weight: 600, align: "right", style: "blur", by: "line", p: clamp(p * 1.4 - 0.4), track: 0.06 })
          g.text("100,000", x, y, { ...o, size: sz, font: "tall", align: "center", style: "slam", by: "glyph", stagger: 0.25, p })
          g.text("light-years", x + wN / 2 + sz * 0.2, y, { ...o, size: sz * 0.5, font: "serif", italic: true, align: "left", style: "rise", by: "word", p: clamp(p * 1.3 - 0.3) })
        }
      }
      // the box
      if (s.beat === 2 && F.box > 0) {
        const a = clamp(F.box * 4) * (1 - clamp(s.exit * 1.6))
        const [bx, by, bw, bh] = F.boxPx
        const cx = bx + bw / 2, cy = by + bh / 2
        g.rect(bx - 2, by - 2, bw + 4, bh + 4, { stroke: "rgba(0,0,0,0.6)", lw: 7, alpha: a })
        g.selbox(bx, by, bw, bh, a)
        // the marker: four ticks about the star, and what the script says happens here
        const q = clamp((s.t - BOX_AT - 0.3) / 0.35)
        for (let i = 0; i < 4; i++) {
          const dx = [1, 0, -1, 0][i], dy = [0, 1, 0, -1][i]
          const r0 = 9 + 14 * (1 - E.outBack(q)), r1 = r0 + 13
          g.line(cx + dx * r0, cy + dy * r0, cx + dx * r1, cy + dy * r1, { color: SELECT, lw: 3, alpha: a * q })
        }
        const lp = clamp((s.t - BOX_AT - 0.5) / 0.9)
        if (lp > 0) {
          g.line(bx + bw + 8, cy, bx + bw + 8 + 46 * clamp(lp * 3), cy, { color: SELECT, lw: 2, alpha: a })
          g.text("a cloud collapses", bx + bw + 66, cy + 13, { size: 38, font: "mono", weight: 700, color: "#ffffff", style: "type", by: "glyph", p: lp, alpha: a, shadow: { color: "rgba(0,0,0,0.9)", blur: 14 } })
        }
      }
      // this beat the scene keeps the corner itself: the clock rolls through the skip
      if (s.beat === 2) {
        const o = { size: 22, font: "mono" as const, weight: 500, color: HUD.color, align: "right" as const, track: 0.02, shadow: { color: HUD.shadow, blur: 12 } }
        const X = DW - 64, Y = 76
        const x = F.roll
        if (x <= 0) g.text(ctx.def.beats[1].page, X, Y, { ...o, style: "none", alpha: 0.75 * fadeOut })
        else if (x >= 1) g.text(ctx.def.beats[2].page, X, Y, { ...o, style: "none", alpha: 0.75 * fadeOut })
        else {
          // digits that are moving are smeared down their wheels; only the two ends can be read
          const v = mix(11e9, 4.6e9, Math.pow(x, 2.5))
          const str = fmt(v) + " years ago"
          const sp = 1
          let keep = ""
          for (let i = 0; i < str.length; i++) {
            const ch = str[i]
            const digit = ch >= "0" && ch <= "9"
            // which wheel: units turn fastest
            const place = digit ? str.slice(i + 1).replace(/[^0-9]/g, "").length : -1
            const moving = digit && sp > 0.02 + place * 0
            keep += moving ? " " : ch
            if (moving) {
              const cx = X - g.measure(str.slice(i + 1), o) - g.measure(ch, o) * 0.5 - 22 * 0.02 * 0
              const ph = fr(v / Math.pow(10, Math.max(place, 7)) )
              for (let j = -2; j <= 2; j++) g.text(String((+ch + j + 10) % 10), cx, Y + (j + ph - 0.5) * 9, { ...o, align: "center", style: "none", alpha: 0.2 * (1 - Math.abs(j) / 3) * fadeOut })
            }
          }
          g.text(keep, X, Y, { ...o, style: "none", alpha: 0.75 * fadeOut })
        }
        const n = String(idx + 1).padStart(2, "0")
        g.text(`${n} / ${SCENES.length}   ${ctx.def.title.toUpperCase()}${ctx.def.beats[2].ill ? "   ·   ILLUSTRATION" : ""}`, 64, DH - 52, { ...o, align: "left", size: 17, track: 0.12, alpha: 0.5 * fadeOut, style: "none" })
      }
    },
    hud: (s) => (s.beat === 2 ? HUD_OWN : HUD),
    portal: (s) => (s.beat === 2 && F.box > 0 ? (projectPortal(corners, cam, 1, 1) as Portal) : null),
    dispose() {
      disposeTree(scene)
      disposeTree(calScene)
      for (const n of [write, sA, sB, sC, sD, oPos]) (n as unknown as { dispose?: () => void }).dispose?.()
    },
  }
}
