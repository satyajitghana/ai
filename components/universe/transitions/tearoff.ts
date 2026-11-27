// 26 → 27. Tear-off.
//
// The outgoing picture is the top sheet of a pad. A row of perforations punches through it near the
// top of the frame. The sheet is taken by its top right corner: the tear starts there and runs right
// to left along the perforations, a ragged line with fibres standing out of both edges and the white
// core of the paper showing where it parted. The freed part lifts toward the lens round a curl
// whose axis pivots on the tear front, so it grows in perspective and shows its back (the picture
// reversed and faint through the paper), and its shadow falls on the page beneath. At `TEAROFF_IN`
// the last fibre lets go: the sheet is yanked away past the lens, chads from the perforations
// scatter, and the page beneath is January 1 of the tear-off calendar, which takes the knock. The
// ragged stub left under the binding fades into the calendar's own.
//
// It works from any picture: the paper is made from its own cues (perforations, torn core, fibres,
// back face, curl, shadow), not from what the outgoing scene shows. Everything is closed-form in the
// linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, cos, cross, dot, Discard, float, floor, Fn, fract, frontFacing, max, min, mix, normalize, positionGeometry, select, sin, smoothstep, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, rng } from "../engine/ease"
import { H } from "../engine/synth"
import { hash21, luma, sampleRT, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const TEAROFF_DUR = 2.6
/** The rip: the calendar's clock zero. */
export const TEAROFF_IN = 0.55

const FOV = 30
const DZ = 1 / Math.tan((FOV * Math.PI) / 360) // the frame's plane fills the lens from here
const YP = 0.76 // the perforations, in frame units (y from -1 to 1)
const T0 = 0.07, T1 = TEAROFF_IN // the tear runs between these
const NCHAD = 40

const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a))

const t: TransitionDef = {
  id: "tearoff",
  dur: TEAROFF_DUR,
  inAt: TEAROFF_IN,
  ease: (x) => x,
  snd: [
    { s: "page", p: 0.03, o: { g: 0.6, pos: [0.8, 0.7, 0] } },
    { s: "scratch", p: T0 + 0.01, o: { g: 0.7, pos: [0.85, 0.75, 0] } },
    { s: "scratch", p: 0.17, o: { g: 0.8, pos: [0.5, 0.75, 0] } },
    { s: "scratch", p: 0.27, o: { g: 0.85, pos: [0.15, 0.75, -0.1] } },
    { s: "scratch", p: 0.36, o: { g: 0.9, pos: [-0.2, 0.75, -0.2] } },
    { s: "scratch", p: 0.45, o: { g: 1.0, pos: [-0.55, 0.75, -0.3] } },
    { s: "page", p: 0.5, o: { g: 1.0, pos: [-0.8, 0.6, -0.3] } },
    // the rip and the yank
    { s: "crack", p: TEAROFF_IN - 0.005, o: { g: 0.35, pos: [-0.9, 0.7, -0.2] } },
    { s: "whoosh", p: TEAROFF_IN, o: { f: 300, dur: 0.7, g: 0.6, pos: [-0.6, -0.2, -0.8] } },
    { s: "thud", p: TEAROFF_IN + 0.01, o: { f: H(2), g: 0.7 } },
    { s: "sub", p: TEAROFF_IN + 0.01, o: { g: 0.35 } },
    { s: "flap", p: TEAROFF_IN + 0.06, o: { g: 0.7, pos: [0, 0.4, 0] } },
  ],
  sound(pl, _prev, synth) {
    synth.bed("air", 0.6 * Math.sin(Math.PI * clamp((pl - 0.2) / 0.6)) ** 2)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const shRT = ctx.target({ hdr: false, scale: 0.25 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(hold.texture),
      tM: uniformTexture(hold.texture),
      asp: uniform(16 / 9),
      xf: uniform(2), // the tear front (frame units)
      cb: uniform(new THREE.Vector4(0.8, 0.1, 0, 0.15)), // axis angle, curl angle, -, radius
      q: uniform(new THREE.Vector4(0, 0, 0, 1)), // the yank: rotation
      tr: uniform(new THREE.Vector3()), // and translation
      piv: uniform(new THREE.Vector3(0.4, 0.3, 0)),
      perf: uniform(0), // perforations punched in
      stub: uniform(1), // the stub fades into the calendar's binding
      jolt: uniform(new THREE.Vector2()), // the page beneath takes the knock
      pl: uniform(0),
      shade: uniform(0),
    }
    const LD = vec3(-0.42, 0.5, 0.76).normalize()
    const PAPER = vec3(0.93, 0.915, 0.88)

    /** The torn edge of the sheet, and the perforation row it follows. */
    const edge = (x: F): F => {
      const w = vnoise(vec2(x.mul(13), 3.1)).sub(0.5).mul(0.014).add(vnoise(vec2(x.mul(95), 7.7)).sub(0.5).mul(0.006))
      // the tear snaps through each hole: pulled toward the row there
      const hole = fract(x.div(0.034))
      const pin = smoothstep(0.35, 0.0, abs(hole.sub(0.5)))
      return float(YP).add(w.mul(float(1).sub(pin.mul(0.8)))) as F
    }
    const perfDots = (P: V2): F => {
      const q = vec2(fract(P.x.div(0.034)).sub(0.5).mul(0.034), P.y.sub(YP))
      return smoothstep(0.0058, 0.0042, q.length()).mul(U.perf) as F
    }
    /** Fibres standing out of a torn edge: thin, uneven, mostly short. */
    const fibres = (x: F, d: F): F => {
      // d: distance beyond the edge (0 at the edge)
      const col = floor(x.mul(900))
      const h = hash21(vec2(col, 1.7))
      const len = h.mul(h).mul(0.014).add(0.001)
      const thin = smoothstep(0.42, 0.1, abs(fract(x.mul(900)).sub(0.5)))
      return step(0.45, h).mul(thin).mul(smoothstep(len, len.mul(0.4), d)).mul(step(0, d)) as F
    }

    // ---- the frame's plane: the page beneath, the stub, the sheet's shadow
    const bgMat = new THREE.NodeMaterial()
    {
      const P = vec2(positionGeometry.x.mul(U.asp), positionGeometry.y)
      bgMat.positionNode = vec3(P, 0)
      const vP = P.toVarying("toBP")
      bgMat.fragmentNode = Fn(() => {
        const Pp = vP.toVar()
        const uvF = vec2(Pp.x.div(U.asp).mul(0.5).add(0.5), Pp.y.mul(0.5).add(0.5)).toVar()
        const b = sampleRT(U.tB, uvF.add(U.jolt) as V2).rgb.toVar()
        // the shadow of the lifted sheet: blurred a little
        const sh = float(0).toVar()
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
          sh.addAssign(sampleRT(U.tS, uvF.add(vec2(dx * 0.012, dy * 0.02)) as V2).r)
        }
        b.mulAssign(float(1).sub(sh.div(9).mul(0.55)))
        // the stub above the torn line, where the tear has passed: the old picture, with its own torn edge
        const torn = step(U.xf, Pp.x)
        const e = edge(Pp.x as F).add(torn.mul(0.0035))
        const d = Pp.y.sub(e) // above the stub's edge: positive
        const a = sampleRT(U.tA, uvF as V2).rgb.toVar()
        const core = smoothstep(0.0, 0.0012, d).mul(smoothstep(0.0042, 0.0022, d)).mul(torn)
        a.assign(mix(a, PAPER.mul(1.04), core.mul(0.9)))
        a.mulAssign(float(1).sub(perfDots(Pp as V2).mul(0.6)))
        const hang = fibres(Pp.x.add(0.31) as F, d.negate() as F).mul(torn)
        const stubA = step(0, d).mul(U.stub)
        const col = mix(b, a, stubA).toVar()
        col.assign(mix(col, PAPER, hang.mul(0.85).mul(U.stub)))
        // under the lifting sheet, the page beneath is a little darker until the sheet is gone
        return vec4(col, 1)
      })()
      Object.assign(bgMat, { depthTest: false, depthWrite: false })
    }
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0

    // ---- the sheet
    const sheetGeo = new THREE.PlaneGeometry(2, 1, 140, 80)
    const YTOP = YP + 0.03
    const flatOf = (): V2 => vec2(positionGeometry.x.mul(U.asp), positionGeometry.y.add(0.5).mul(YTOP + 1).sub(1)) as V2
    const deform = (P: V2): V3 => {
      const be = U.cb.x
      const n = vec2(sin(be), cos(be)), d = vec2(cos(be), sin(be).negate())
      const rel = P.sub(vec2(U.xf, YP))
      const s = dot(rel, n)
      const along = dot(rel, d)
      const r = U.cb.w, al = U.cb.y
      const th = min(max(s, 0).div(r), al)
      const arcL = r.mul(al)
      const onArc = s.lessThan(arcL)
      const off = select(onArc, r.mul(sin(th)), r.mul(sin(al)).add(s.sub(arcL).mul(cos(al))))
      const z = select(onArc, r.mul(float(1).sub(cos(th))), r.mul(float(1).sub(cos(al))).add(s.sub(arcL).mul(sin(al))))
      const p2 = vec2(U.xf, YP).add(d.mul(along)).add(n.mul(off))
      const curled = vec3(p2, z)
      const flat = vec3(P, 0)
      const p = select(s.greaterThan(0), curled, flat)
      // the yank: rotate about the pivot, then carry away
      const u = U.q.xyz
      const v = p.sub(U.piv)
      const rv = v.add(cross(u, cross(u, v).add(v.mul(U.q.w))).mul(2))
      return rv.add(U.piv).add(U.tr) as V3
    }
    const sheetMat = (shadow: boolean) => {
      const m = new THREE.NodeMaterial()
      m.side = THREE.DoubleSide
      const P = flatOf()
      const p = deform(P)
      const e = 0.004
      const px = deform(P.add(vec2(e, 0)) as V2), py = deform(P.add(vec2(0, e)) as V2)
      const N = normalize(cross(px.sub(p), py.sub(p)))
      if (shadow) {
        // flattened onto the plane along the light; how high it stands decides how dark
        const k = p.z.div(LD.z)
        m.positionNode = vec3(p.xy.sub(LD.xy.mul(k)), 0.001)
        const vz = p.z.toVarying("toSZ")
        const vF = P.toVarying("toSF")
        m.fragmentNode = Fn(() => {
          Discard(vF.y.greaterThan(edge(vF.x as F)))
          return vec4(vec3(smoothstep(0.0, 0.06, vz).mul(0.9)), 1)
        })()
        Object.assign(m, { depthTest: false, depthWrite: false })
        return m
      }
      m.positionNode = p
      const vN = N.toVarying("toN")
      const vF = P.toVarying("toF")
      const vZ = p.z.toVarying("toZ")
      m.fragmentNode = Fn(() => {
        const F = vF.toVar()
        const torn = step(U.xf, F.x)
        const e0 = edge(F.x as F)
        const d = F.y.sub(e0) // above the edge: positive
        // above the torn edge only fibres survive; untorn, the sheet stops at the row (the stub carries on)
        const fib = fibres(F.x as F, d as F).mul(torn)
        Discard(d.greaterThan(0).and(fib.lessThan(0.1)))
        const uvF = vec2(F.x.div(U.asp).mul(0.5).add(0.5), F.y.mul(0.5).add(0.5))
        const a = sampleRT(U.tA, clampUV(uvF) as V2).rgb.toVar()
        a.mulAssign(float(1).sub(perfDots(F as V2).mul(0.6)))
        // the white core where it parted
        const core = smoothstep(-0.0045, -0.0018, d).mul(torn)
        a.assign(mix(a, PAPER.mul(1.05), core.mul(0.92)))
        a.assign(mix(a, PAPER.mul(1.08), step(0, d)))
        const Nn = normalize(vN)
        const front = frontFacing
        const NL = dot(select(front, Nn, Nn.negate()), LD)
        // the back: the same paper, the picture faint through it (mirrored by the turn itself)
        const ghost = smoothstep(0.15, 0.85, float(0.9).sub(luma(a)))
        const grain = vnoise(F.mul(vec2(260, 300))).mul(0.04).add(0.96)
        const back = PAPER.mul(grain).mul(mix(vec3(1), vec3(0.82, 0.8, 0.78), ghost.mul(0.35)))
        const alb = select(front, a, back)
        // light: a flat sheet keeps its own picture exactly; a lifted one turns to and from the lamp
        const lift = smoothstep(0.0, 0.02, vZ)
        const lit = mix(float(1), abs(NL).mul(0.45).add(0.6), lift)
        const sheen = select(front, max(NL, 0).pow(24).mul(0.12).mul(lift), float(0))
        return vec4(alb.mul(lit).add(sheen), 1)
      })()
      return m
    }
    const clampUV = (u: V2): V2 => u.clamp(0.0005, 0.9995) as V2
    const sheet = new THREE.Mesh(sheetGeo, sheetMat(false))
    sheet.frustumCulled = false
    sheet.renderOrder = 2
    const sheetSh = new THREE.Mesh(sheetGeo, sheetMat(true))
    sheetSh.frustumCulled = false

    // ---- chads: punched paper flecks that let go as the tear passes their hole
    const chBase = new THREE.PlaneGeometry(1, 1)
    const chGeo = new THREE.InstancedBufferGeometry()
    chGeo.index = chBase.index
    chGeo.setAttribute("position", chBase.getAttribute("position"))
    const cA = new Float32Array(NCHAD * 4), cB = new Float32Array(NCHAD * 4)
    {
      const R = rng(2626)
      for (let i = 0; i < NCHAD; i++) {
        cA.set([R() * 2 - 1, R(), R(), R()], i * 4) // x along the row (fraction of the width), seeds
        cB.set([(R() - 0.5) * 0.5, 0.1 + R() * 0.5, 0.1 + R() * 0.6, 0.014 + R() * 0.01], i * 4) // vx, vy, vz, diameter (frame units; the hole is 0.01, a chad is cut a hair wider)
      }
    }
    chGeo.setAttribute("cA", new THREE.InstancedBufferAttribute(cA, 4))
    chGeo.setAttribute("cB", new THREE.InstancedBufferAttribute(cB, 4))
    chGeo.instanceCount = NCHAD
    /**
     * A chad: a round fleck of newsprint the size of its hole, cupped a little by the punch, tumbling
     * about its own axis as it falls toward the lens. Lit by the same lamp as the sheet (bright face,
     * grey edge-on, the back darker), and it throws a soft shadow on the page beneath, sharp while it
     * is close to the paper and gone once it has flown off.
     */
    const chadMat = (shadow: boolean) => {
      const m = new THREE.NodeMaterial()
      m.side = THREE.DoubleSide
      const ca = attribute("cA", "vec4"), cb = attribute("cB", "vec4")
      const x0 = ca.x.mul(U.asp)
      // released when the tear front passes it: its own clock in seconds
      const passAt = float(T0).add(float(U.asp).sub(x0).div(U.asp.mul(2).add(0.1)).mul(T1 - T0))
      const tau = U.pl.sub(passAt).mul(TEAROFF_DUR).max(0)
      const on = step(passAt, U.pl).mul(step(tau, 1.2))
      const pos = vec3(x0.add(cb.x.mul(tau)), float(YP).add(cb.y.mul(tau)).sub(tau.mul(tau).mul(2.2)), cb.z.mul(tau).add(0.004))
      // tumble: a fixed axis per chad, spinning faster the harder it was flicked
      const ax = normalize(vec3(ca.y.sub(0.5), ca.z.sub(0.5), ca.w.sub(0.5).mul(0.4)))
      const ang = ca.y.mul(6.28).add(tau.mul(ca.z.mul(14).add(7)))
      const rot = (v: V3): V3 => v.mul(cos(ang)).add(cross(ax, v).mul(sin(ang))).add(ax.mul(dot(ax, v)).mul(float(1).sub(cos(ang)))) as V3
      const g2 = positionGeometry.xy
      const cup = g2.dot(g2).mul(0.6).mul(cb.w) // the punch dishes it
      const local = vec3(g2.mul(cb.w), cup).mul(on)
      const p = pos.add(rot(local as V3))
      const vG = g2.toVarying(shadow ? "chSG" : "chG")
      if (shadow) {
        const k = p.z.div(LD.z)
        m.positionNode = vec3(p.xy.sub(LD.xy.mul(k)), 0.001)
        const vz = pos.z.toVarying("chSZ")
        m.fragmentNode = Fn(() => {
          Discard(vG.length().greaterThan(0.5))
          // dark and crisp near the page, fading as it climbs toward the lens
          return vec4(vec3(smoothstep(0.0, 0.01, vz).mul(smoothstep(0.35, 0.05, vz)).mul(0.9)), 1)
        })()
        Object.assign(m, { depthTest: false, depthWrite: false })
        return m
      }
      m.positionNode = p
      const vN = rot(vec3(0, 0, 1) as V3).toVarying("chN")
      const vSeed = ca.w.toVarying("chW")
      m.fragmentNode = Fn(() => {
        const r = vG.length()
        Discard(r.greaterThan(0.5))
        const Nn = normalize(vN)
        const NL = dot(select(frontFacing, Nn, Nn.negate()), LD)
        const fibre = vnoise(vG.mul(9).add(vSeed.mul(40))).mul(0.1).add(0.9)
        // printed side or blank back; a darker rim where the punch crushed the fibres
        const alb = select(frontFacing, PAPER.mul(0.96), PAPER.mul(0.86)).mul(fibre).mul(smoothstep(0.5, 0.36, r).mul(0.22).add(0.78))
        // newsprint is thin: the side away from the lamp still glows with what comes through it
        const lit = max(NL, 0).mul(0.6).add(abs(NL).mul(0.12)).add(0.46)
        const sheen = max(NL, 0).pow(18).mul(0.25)
        return vec4(alb.mul(lit).add(sheen), 1)
      })()
      return m
    }
    const chMat = chadMat(false)
    const chShMat = chadMat(true)
    const chads = new THREE.Mesh(chGeo, chMat)
    chads.frustumCulled = false
    chads.renderOrder = 3

    const scene = new THREE.Scene()
    scene.add(bg, sheet, chads)
    const shScene = new THREE.Scene()
    const chadSh = new THREE.Mesh(chGeo, chShMat)
    chadSh.frustumCulled = false
    shScene.add(sheetSh, chadSh)
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 30)
    cam.position.set(0, 0, DZ)
    const blit = ctx.pass(({ uv }) => vec4(sampleRT(U.tM, uv).rgb, 1), U)
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ax = new THREE.Vector3()

    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        const pl = a.pl
        cam.aspect = asp
        cam.updateProjectionMatrix()
        U.asp.value = asp
        U.pl.value = pl
        U.perf.value = E.out2(ramp(pl, 0, 0.07))
        // the tear front runs right to left, quick at first, then fighting the last of it
        const tr = ramp(pl, T0, T1)
        const xf = asp + 0.02 - (2 * asp + 0.08) * (0.55 * tr + 0.45 * E.in2(tr))
        U.xf.value = xf
        const be = 0.68 + 0.42 * tr
        const al = 0.25 + 1.75 * E.out2(tr)
        const r = 0.06 + 0.16 * tr
        U.cb.value.set(be, al, 0, r)
        // the yank, after the rip
        const k = ramp(pl, T1, 0.9)
        const ky = k * k
        ax.set(Math.cos(be), -Math.sin(be), 0)
        qa.setFromAxisAngle(ax, 1.4 * ky)
        qb.setFromAxisAngle(ax.set(0, 0, 1), 0.7 * k + 0.5 * ky)
        qa.premultiply(qb)
        U.q.value.set(qa.x, qa.y, qa.z, qa.w)
        U.tr.value.set(-0.9 * k - 1.8 * ky, -0.5 * k - 1.2 * ky, 2.2 * ky)
        U.piv.value.set(0.2, 0.2, 0.2)
        U.stub.value = 1 - E.io2(ramp(pl, 0.68, 0.97))
        // the knock on the page beneath
        const since = (pl - T1) * TEAROFF_DUR
        const j = since > 0 ? Math.exp(-since * 9) * Math.sin(since * 46) * 0.004 : 0
        U.jolt.value.set(j * 0.3, j)

        U.tA.value = a.A
        U.tB.value = a.B
        const rr = ctx.renderer
        rr.setClearColor(0x000000, 1)
        rr.setRenderTarget(shRT)
        rr.render(shScene, cam)
        U.tS.value = shRT.texture
        rr.setRenderTarget(rt)
        rr.render(scene, cam)
        U.tM.value = rt.texture
        blit.render(a.out)
      },
      warm: () => [
        { scene: shScene, camera: cam, target: shRT },
        { scene, camera: cam, target: rt },
        { pass: blit, target: hold },
      ],
      dispose() {
        sheetGeo.dispose()
        chBase.dispose()
        ;(bg.geometry as THREE.BufferGeometry).dispose()
        bgMat.dispose()
        ;(sheet.material as THREE.Material).dispose()
        ;(sheetSh.material as THREE.Material).dispose()
        chMat.dispose()
        chShMat.dispose()
        blit.dispose()
      },
    }
  },
}
export default t
