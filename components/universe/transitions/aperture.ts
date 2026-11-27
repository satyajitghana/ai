// 17 → 18. Aperture.
//
// A nine-bladed brass iris, pivoted on a ring that lies outside the frame, closes on the picture.
// The blades are geometry: each is an arc of sheet brass, instanced, tilted so that it lies over
// the next one all the way round (which is how a real iris stacks and why it can be depth-sorted),
// brushed along its length, with a bevel on its inner edge and the contact shadow of the blade
// above it, computed from that blade's own arc. A blade turns about its pivot by `alpha`; the arc's
// centre then sits 2·Rp·sin(alpha/2) from the axis, so the opening's radius is known in closed form
// and the blades are driven from the radius the picture needs.
//
// Seen through the opening, the old picture is stopped down like an image in a lens: it shrinks
// toward the axis, gathers its light and gains a colour fringe. Closed, there is darkness and one
// point of light with the eighteen diffraction spikes nine straight edges throw. That point is
// the climax and APERTURE_IN: the incoming scene's clock starts there, and its first frame puts a
// planet on APERTURE_AT, so when the blades swing open again the point is a star in an eyepiece.
//
// Everything is closed-form in linear progress.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, clamp as clampN, cos, exp, float, Fn, length, max, mix, positionGeometry, pow, sin, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { sampleRT, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const APERTURE_DUR = 2.8
export const APERTURE_IN = 0.5
/** Where the iris closes to, as a y-up uv: the incoming scene puts its point of light here. */
export const APERTURE_AT: [number, number] = [0.56, 0.5]

const BLADES = 9
const RP = 1.25 // pivot radius, in units of the open radius
const R1 = 3.0 // outer edge of a blade
const TH0 = -0.3, TH1 = 2.05 // a blade's arc, radians about its own centre (the pivot is at 0)
const CLOSE = 0.4, OPEN = 0.6 // the hold is between them
const R_POINT = 0.0045 // the opening left at the climax, in units of the open radius

const t: TransitionDef = {
  id: "aperture",
  dur: APERTURE_DUR,
  inAt: APERTURE_IN,
  ease: E.lin,
  snd: [
    { s: "gear", p: 0.02, o: { g: 0.35, dur: 0.5, f: H(9), pos: [0.7, 0.6, 0.1] } },
    { s: "whoosh", p: 0.1, o: { g: 0.3, f: 420, dur: 0.7 } },
    { s: "gear", p: 0.24, o: { g: 0.3, dur: 0.35, f: H(12), pos: [-0.7, -0.5, 0.1] } },
    { s: "shutter", p: CLOSE - 0.015, o: { g: 0.9, dur: 0.07 } },
    { s: "sub", p: CLOSE, o: { g: 0.5 } },
    { s: "glass", p: APERTURE_IN - 0.05, o: { g: 0.5, f: H(48), pos: [0.12, 0, 0.9] } },
    { s: "shimmer", p: APERTURE_IN, o: { g: 0.22, f: H(24) } },
    { s: "shutter", p: OPEN, o: { g: 0.7, dur: 0.11 } },
    { s: "gear", p: OPEN + 0.02, o: { g: 0.3, dur: 0.4, f: H(10), pos: [0.6, -0.6, 0.1] } },
    { s: "whoosh", p: OPEN + 0.04, o: { g: 0.22, f: 300, dur: 0.8 } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(rt.texture),
      asp: uniform(16 / 9),
      R0: uniform(2.3), // the open radius, in half-frame-heights
      r: uniform(1), //    the opening now, in units of R0
      alpha: uniform(0), // how far each blade has turned
      sw: uniform(0), //   0 the outgoing picture, 1 the incoming
      lit: uniform(1), //  light reaching the blades' faces (it comes through the opening)
      glow: uniform(0), // the point's glare on the blades' edges
      star: uniform(0), // the point itself
      lightA: uniform(0.9),
      time: uniform(0),
      C: uniform(new THREE.Vector2(0, 0)), // the axis, in half-frame-heights
    }
    const sq = (x: F): F => x.mul(x) as F

    // ---------------------------------------------------------------- the blades

    const geo = new THREE.InstancedBufferGeometry()
    {
      const SEG = 56
      const rows = [1, 1.012, 1.03, R1] // inner edge, bevel, body
      const pos: number[] = []
      const idx: number[] = []
      for (let i = 0; i <= SEG; i++)
        for (let j = 0; j < rows.length; j++) pos.push(rows[j], TH0 + ((TH1 - TH0) * i) / SEG, j)
      for (let i = 0; i < SEG; i++)
        for (let j = 0; j < rows.length - 1; j++) {
          const o = i * rows.length + j
          idx.push(o, o + rows.length, o + 1, o + 1, o + rows.length, o + rows.length + 1)
        }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      geo.setIndex(idx)
      const ph = new Float32Array(BLADES)
      for (let i = 0; i < BLADES; i++) ph[i] = (i / BLADES) * Math.PI * 2
      geo.setAttribute("aPhi", new THREE.InstancedBufferAttribute(ph, 1))
      geo.instanceCount = BLADES
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    }
    const rot2 = (p: V2, a: F): V2 => vec2(p.x.mul(cos(a)).sub(p.y.mul(sin(a))), p.x.mul(sin(a)).add(p.y.mul(cos(a)))) as V2
    const aPhi = attribute("aPhi", "float") as unknown as F
    const rho = positionGeometry.x as F
    const th = positionGeometry.y as F
    /** A blade's point, about the axis, in units of the open radius. */
    const bladeP = Fn(() => {
      const local = vec2(rho.mul(cos(th)), rho.mul(sin(th))).sub(vec2(RP, 0)) as V2
      const turned = rot2(local, U.alpha as unknown as F).add(vec2(RP, 0)) as V2
      return rot2(turned, aPhi)
    })()
    const bladeMat = new THREE.NodeMaterial()
    bladeMat.side = THREE.DoubleSide
    // each blade climbs along its own length, so its far end lies over the next blade's near end
    bladeMat.vertexNode = vec4(bladeP.x.mul(U.R0).add(U.C.x).div(U.asp), bladeP.y.mul(U.R0).add(U.C.y), float(0.5).sub(th.sub(0.9).mul(0.1)).add(rho.sub(1).mul(0.004)), 1)
    const vP = bladeP.toVarying()
    const vRho = rho.toVarying()
    const vTh = th.toVarying()
    const vPhi = aPhi.toVarying()
    bladeMat.fragmentNode = Fn(() => {
      const ang = vTh.add(U.alpha).add(vPhi).toVar() // direction of the arc's radius here; the grain runs across it
      // brushed sheet brass: fine lines along the arc, a slower mottling, a few scratches across
      const grain = vnoise(vec2(vRho.mul(520), vTh.mul(5).add(vPhi.mul(3.1)))).mul(0.55).add(vnoise(vec2(vRho.mul(140), vTh.mul(2.3).add(vPhi))).mul(0.45)).toVar()
      const mott = vnoise(vec2(vRho.mul(7).add(vPhi.mul(5)), vTh.mul(6))).toVar()
      const scr = smoothstep(0.86, 0.9, vnoise(vec2(vTh.mul(240).add(vRho.mul(30)), vRho.mul(6).add(vPhi.mul(9))))).mul(0.35)
      const brass = mix(vec3(0.5, 0.33, 0.11), vec3(0.95, 0.72, 0.33), grain.mul(0.5).add(mott.mul(0.3)).add(0.1)).toVar()
      // tarnish toward the hidden outer part and in blotches
      brass.mulAssign(mix(vec3(1, 1, 1), vec3(0.5, 0.42, 0.34), smoothstep(0.45, 0.8, mott).mul(0.5).add(smoothstep(1.2, 2.2, vRho).mul(0.4))))
      // anisotropic sheen: the highlight is a band where the grain is square to the light, so every blade sits at its own brightness
      const dA = cos(ang.sub(U.lightA))
      const sheen = pow(abs(dA), 5).mul(1.3).add(pow(max(dA, 0), 40).mul(grain).mul(2.2)).add(0.42)
      const face = brass.mul(sheen.add(scr)).mul(U.lit).toVar()
      // the blade lying over this one: the contact shadow of its inner edge, from its own arc
      const oc = rot2(vec2(float(RP).mul(cos(U.alpha).oneMinus()), float(RP).mul(sin(U.alpha)).negate()) as V2, vPhi.sub((Math.PI * 2) / BLADES) as F)
      const dAbove = length(vP.sub(oc)).sub(1)
      face.mulAssign(mix(float(1), float(0.22), smoothstep(-0.085, -0.004, dAbove).mul(smoothstep(0.02, -0.004, dAbove))))
      // the bevel on the inner edge catches whatever light there is, and the glare of the point
      const bev = smoothstep(1.014, 1.004, vRho).mul(smoothstep(1.0, 1.002, vRho))
      const edge = bev.mul(pow(abs(sin(ang.sub(U.lightA).mul(0.5).add(0.6))), 3).mul(2.4).add(0.35))
      face.addAssign(vec3(1.0, 0.86, 0.58).mul(edge).mul(U.lit.mul(0.9).add(0.02)))
      // near the axis the point lights the edges and a little of the faces round it
      const dC = length(vP)
      const near = exp(dC.mul(-9))
      face.addAssign(vec3(1.0, 0.88, 0.66).mul(U.glow).mul(near).mul(bev.mul(5).add(grain.mul(0.5)).add(0.12)))
      return vec4(face, 1)
    })()
    const blades = new THREE.Mesh(geo, bladeMat)
    blades.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(blades)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // ---------------------------------------------------------------- the picture through it, and the point

    const pass = ctx.pass(({ uv }) => {
      const q = vec2(uv.x.mul(2).sub(1).mul(U.asp), uv.y.mul(2).sub(1)).sub(U.C).toVar() // from the axis, half-heights
      const d = length(q).toVar()
      // stopped down: the picture is drawn in a little toward the axis (a lens racking as it closes) and gains lateral colour
      const sc = clampN(U.r, 0.0001, 1).oneMinus().mul(0.14).add(1).toVar()
      const pic = (k: number): V3 => {
        const w = q.div(sc.mul(float(1).add(sc.sub(1).mul(k * 0.05)))).add(U.C)
        const st = vec2(w.x.div(U.asp).mul(0.5).add(0.5), w.y.mul(0.5).add(0.5)).toVar()
        const inside = smoothstep(0, 0.004, st.x).mul(smoothstep(1, 0.996, st.x)).mul(smoothstep(0, 0.004, st.y)).mul(smoothstep(1, 0.996, st.y))
        return mix(sampleRT(U.tA, st as V2).rgb, sampleRT(U.tB, st as V2).rgb, U.sw).mul(inside) as V3
      }
      // lateral colour: red a little smaller than blue, more as it is stopped down
      const c = vec3(pic(-1).r, pic(0).g, pic(1).b).toVar()
      c.mulAssign(pow(clampN(U.r, 0, 1), 0.35).mul(0.75).add(0.25)) // less light through a smaller hole
      // the blades over it
      const b = sampleRT(U.tS, uv).toVar()
      c.assign(mix(c, b.rgb, b.a))
      // the point: a core, a halo, and two spikes square to each of the nine edges
      const a = atan(q.y, q.x).sub(U.alpha).toVar()
      const lobes = pow(abs(cos(a.mul(BLADES))), 26)
      const fine = pow(abs(cos(a.mul(BLADES).add(1.5708))), 60).mul(0.3)
      const tw = sin(U.time.mul(7.3)).mul(0.12).add(sin(U.time.mul(17.1)).mul(0.06)).add(1)
      const spike = lobes.add(fine).mul(exp(d.mul(-7.5))).mul(0.5)
      const core = exp(sq(d.div(0.012) as F).negate()).mul(3).add(exp(d.mul(-38)).mul(0.6)).add(exp(d.mul(-6)).mul(0.035))
      // the spikes disperse: blue runs further out than red
      const tint = mix(vec3(1.0, 0.86, 0.66), vec3(0.72, 0.84, 1.0), smoothstep(0.05, 0.5, d))
      c.addAssign(tint.mul(spike).add(vec3(1.0, 0.94, 0.84).mul(core)).mul(U.star).mul(tw))
      return vec4(c, 1)
    }, U)

    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        U.asp.value = asp
        U.time.value = a.time
        const cx = (APERTURE_AT[0] * 2 - 1) * asp, cy = APERTURE_AT[1] * 2 - 1
        U.C.value.set(cx, cy)
        U.R0.value = Math.hypot(asp + Math.abs(cx), 1 + Math.abs(cy)) * 1.03
        // closing: a stick-slip on the way and a last snap; opening: thrown past and settling
        let r: number
        if (p < CLOSE) {
          const k = p / CLOSE
          const e = E.io2(k) + 0.02 * Math.sin(k * 26) * k * (1 - k) * 4
          r = Math.max(R_POINT, 1 - e) * (1 - 0.6 * smooth(0.9, 1, k)) + R_POINT * smooth(0.9, 1, k)
        } else if (p < OPEN) r = R_POINT * (1 + 0.12 * Math.sin(a.time * 9.1))
        else {
          const k = (p - OPEN) / (1 - OPEN)
          r = R_POINT + (1 - R_POINT) * (1 - Math.exp(-k * 5.2) * Math.cos(k * 7.5)) / (1 - Math.exp(-5.2) * Math.cos(7.5))
        }
        U.r.value = r
        U.alpha.value = 2 * Math.asin(clamp((1 - r) / (2 * RP), -0.6, 1))
        U.sw.value = p < APERTURE_IN ? 0 : 1
        const open = clamp(r)
        U.lit.value = 0.02 + 0.98 * open ** 1.3
        const dark = smooth(0.14, 0.01, r)
        U.star.value = dark * (0.75 + 0.6 * Math.exp(-(((p - APERTURE_IN) / 0.035) ** 2)))
        U.glow.value = dark * 1.4 + 0.5 * smooth(0.5, 0.06, r)
        U.lightA.value = 0.9 + 1.7 * p
        const g = ctx.renderer
        g.setClearColor(0x000000, 0)
        g.setRenderTarget(rt)
        g.render(scene, cam)
        U.tS.value = rt.texture
        pass.render(a.out)
      },
      warm: () => [{ scene, camera: cam, target: rt }, { pass, target: hold }],
      dispose() {
        geo.dispose()
        bladeMat.dispose()
      },
    }
  },
}
export default t
