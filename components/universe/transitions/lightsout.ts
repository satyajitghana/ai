// 4 → 5. Lights out.
//
// The lamp is switched off. The room drops to black and the only light left is the plate itself,
// which is hot: the false-colour map turns into heat and cools like a filament, the blue parts
// first, the red cores last. While it cools the camera closes on the plate until the oval stands
// in the frame. Then the plate is drawn aside on its rail, and the glow does not go with it: it
// was never on the glass. It hangs in the dark as grains of gas, and when the carriage hits its
// stop (the climax, and the next scene's clock zero) the grains are knocked into their depth.
//
// How. fog reports the plate as its portal quad. The quad is walked to the place where the oval is
// inscribed in the frame, which is where dark's flat web stands at its first frame, so plate
// coordinates are ripple coordinates all the way: the heat picture here is `ripples` itself, and
// dark's motes were drawn from the same field (their JS twin), so one lies on the other. The pane,
// its rim and the dust on it are analytic, in plate coordinates, lit by the glow they stand in.

import * as THREE from "three/webgpu"
import { abs, clamp, exp, float, Fn, fwidth, length, max, mix, smoothstep, sqrt, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { E } from "../engine/ease"
import { H } from "../engine/synth"
import { portalMatrix } from "../engine/quad"
import { hash21, luma, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { Portal, TransitionDef } from "../engine/types"
import { RIPPLE_VIEW, ripples } from "../engine/ui"

const DUR = 3.2
/** How hot the embers are when the hand-off lands: scenes/dark.ts starts its motes on the same ramp. */
export const EMBER_T = 0.53
const LAND = 0.62 // the carriage hits its stop
const PUSH: [number, number] = [0.0, 0.46]
const GRAIN: [number, number] = [0.34, 0.47] // the glow turns out to be grains
const SLIDE: [number, number] = [0.47, LAND]
// fog's portal is the plate's rectangle with this much margin (scenes/fog.ts `plateCorners`)
const MX = 1.07
const MY = 1.12
// if fog has no portal to give (it always does in the room), a quad about where the plate stands
const FALLBACK: Portal["c"] = [[-0.69, 0.3], [0.33, 0.3], [0.33, -0.76], [-0.69, -0.76]]

type Snd0 = NonNullable<TransitionDef["snd"]>[number]
/** The plate cooling: [progress, harmonic, how far off-centre it still is]. The gaps lengthen; the last note is the next scene's. */
const COOL: [number, number, number][] = [[0.07, 48, -0.2], [0.13, 42, -0.16], [0.2, 36, -0.12], [0.28, 30, -0.07], [0.37, 24, -0.03], [0.45, 21, 0]]

const t: TransitionDef = {
  id: "lightsout",
  dur: DUR,
  inAt: LAND,
  ease: (x) => x,
  // Sound (sheet: beats/sound-lightsout.md), on the transition's own progress. Home harmonic 6 going to 7.
  snd: [
    // the lamp is switched off: the switch (up and to the right, where the lamp is), and the room dropping away
    { s: "telegraph", o: { f: H(48), dur: 0.05, g: 1, pos: [0.55, 0.6, 0.3] } },
    { s: "thud", p: 0.006, o: { f: H(3), g: 0.4 } },
    // the plate ticking as it cools: slower and lower each time, coming to the middle as the camera closes on it
    ...COOL.map(([p, n, x], i): Snd0 => ({ s: "glass", p, o: { f: H(n), g: 0.3 - i * 0.03, pos: [x, x, 0.3 - i * 0.05] } })),
    ...COOL.map(([p, n, x], i): Snd0 => ({ s: "tick", p, o: { f: H(n * 2), g: 0.5 - i * 0.05, wet: 2, pos: [x, x, 0.3 - i * 0.05] } })),
    // the glow turns out to be grains
    { s: "shimmer", p: GRAIN[0], o: { f: H(48), dur: 1.2, g: 0.16 } },
    // the plate is drawn aside on its rail: the carriage's ratchet, running off to the right
    { s: "gear", p: SLIDE[0], o: { f: H(28), dur: DUR * (SLIDE[1] - SLIDE[0]) - 0.06, g: 0.5, pos: [0.15, -0.25, 0] } },
    { s: "whoosh", p: SLIDE[0], o: { f: H(7), dur: 0.55, g: 0.4, pos: [0.5, -0.1, 0] } },
    // .62: the carriage hits its stop, and the grains are knocked into their depth
    { s: "thump", p: LAND, o: { f: H(2), g: 0.9, pos: [0.85, -0.25, 0] } },
    { s: "knap", p: LAND, o: { f: H(56), g: 0.4, pos: [0.85, -0.25, 0] } },
    { s: "sub", p: LAND, o: { f: H(2), dur: 2.2, g: 0.5, lfe: 1 } },
    { s: "shimmer", p: LAND + 0.02, o: { f: H(48), dur: 1.8, g: 0.2 } },
  ],
  create(ctx) {
    const like = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(like.texture),
      tB: uniformTexture(like.texture),
      p: uniform(0),
      uHq: uniform(new THREE.Matrix3()), // clip → the moving quad's uv
      uHa: uniform(new THREE.Matrix3()), // that uv → clip in the outgoing frame
      uSlide: uniform(0), // how far the pane has gone, in plate half-widths
      uKnock: uniform(new THREE.Vector2()),
      uFit: uniform(1), // (16/9) / aspect
    }
    const heat = Fn(([t_]: [F]) => {
      const tt = clamp(t_, 0, 1.5).toVar()
      const t2 = tt.mul(tt).toVar()
      return vec3(1, tt.mul(0.14).add(t2.mul(0.5)), t2.mul(0.05).add(t2.mul(t2).mul(0.25))).mul(t2)
    }).setLayout({ name: "loHeat", type: "vec3", inputs: [{ name: "t", type: "float" }] })

    const pass = ctx.pass(({ uv }) => {
      const p = U.p
      const ndc = uv.add(U.uKnock).mul(2).sub(1).toVar()
      const h = U.uHq.mul(vec3(ndc, 1)).toVar()
      const uq = h.xy.div(max(h.z, 1e-4)).toVar()
      const pc = uq.mul(2).sub(1).mul(vec2(MX, MY)).toVar() // plate coordinates: the oval is the unit circle
      // the outgoing frame, seen through the same move
      const ha = U.uHa.mul(vec3(uq, 1)).toVar()
      const uvA = ha.xy.div(max(ha.z, 1e-4)).mul(0.5).add(0.5).toVar()
      const inA = smoothstep(0, 0.004, uvA.x).mul(smoothstep(0, 0.004, uvA.y)).mul(smoothstep(0, 0.004, uvA.x.oneMinus())).mul(smoothstep(0, 0.004, uvA.y.oneMinus()))
      const A = toLinear(sampleRT(U.tA, clamp(uvA, 0, 1) as V2).rgb).mul(inA).toVar()
      // the incoming frame, in plate coordinates (once the push is done this is the frame itself)
      const uvB = vec2(pc.x.mul(U.uFit), pc.y).mul(0.5).add(0.5).toVar()
      const B = toLinear(sampleRT(U.tB, clamp(uvB, 0, 1) as V2).rgb).toVar()

      // ---- how hot
      const cool = smoothstep(0.05, 0.56, p).toVar()
      const v = ripples(vec2(pc.x, pc.y.mul(0.5)).mul(vec2((RIPPLE_VIEW * 8) / 9, RIPPLE_VIEW)) as V2).toVar()
      // white-hot everywhere at first; it ends at the temperature dark's embers start from
      const T = mix(v.mul(0.75).add(0.62), v.mul(EMBER_T), sqrt(cool)).toVar()
      const grainy = hash21(uv.mul(vec2(1280, 720)).floor()).mul(0.5).add(vnoise(pc.mul(vec2(150, 75))).mul(0.5))
      const hp = heat(T).mul(mix(1.5, 3.6, cool)).mul(mix(1, grainy.mul(1.5).add(0.25), smoothstep(0.2, 0.45, p))).toVar()
      // as it cools the dim parts drop out altogether: what is left is where the gas is thick (dark's density law)
      const dens = smoothstep(0.4, 0.9, v).toVar()
      hp.mulAssign(mix(float(1), dens.mul(dens).mul(dens.add(0.35)).mul(2.2), smoothstep(0.12, 0.5, p)))
      hp.assign(hp.div(hp.mul(0.3).add(1)))
      // the light the plate gives the room and its own frame
      const glow = heat(mix(float(1.08), float(EMBER_T * 0.8), sqrt(cool)) as F).mul(mix(1, 0.45, cool)).toVar()

      // ---- the pane and its rim, wherever the carriage has taken them
      const pp = vec2(pc.x.add(U.uSlide), pc.y).toVar()
      const r = length(pp).toVar()
      const aa = max(fwidth(r), 1e-4).toVar()
      const inPane = smoothstep(r.sub(aa), r.add(aa), float(1)).toVar()
      const rr = r.sub(1.045).div(0.05).toVar()
      const inRim = smoothstep(abs(rr).sub(aa.mul(20)), abs(rr).add(aa.mul(20)), float(1)).toVar()
      const nz = sqrt(max(rr.mul(rr).oneMinus(), 0)).toVar()

      // the room: the lamp's filament dies in a few frames; after that it is lit by the plate alone
      const lamp = exp(p.mul(-46)).toVar()
      const spill = exp(max(length(pc).sub(1), 0).mul(-1.5)).mul(0.5).mul(smoothstep(1.0, 1.12, length(pc))).mul(smoothstep(0.28, 0.5, p).oneMinus())
      const room = A.mul(lamp).add(vec3(luma(A)).mul(glow).mul(spill).mul(lamp.oneMinus()).mul(1.1)).toVar()
      // uncovered by the pane, the gas is simply there
      const bare = B.mul(smoothstep(0.5, 0.62, p)).toVar()
      const col = room.add(bare).toVar()

      // inside the glass: the map, then heat, then the grains of the next scene seen through it
      const through = B.mul(vec3(0.7, 0.74, 0.66)).toVar()
      const dust = vnoise(pp.mul(vec2(95, 48))).mul(vnoise(pp.mul(vec2(23, 12)).add(4)))
      const sh0 = pp.x.add(pp.y.mul(0.6)).add(0.3).div(0.22)
      const sheen = exp(sh0.mul(sh0).negate()).mul(0.03).add(dust.mul(dust).mul(0.12))
      const glass = mix(mix(A, hp, smoothstep(0.015, 0.11, p)), through, smoothstep(GRAIN[0], GRAIN[1], p)).toVar()
      glass.addAssign(glow.mul(sheen).mul(smoothstep(0.06, 0.3, p)))
      // its ground edge
      glass.addAssign(glow.mul(vec3(0.5, 0.9, 0.6)).mul(smoothstep(0.955, 0.995, r)).mul(0.22).mul(smoothstep(0.06, 0.3, p)))
      col.assign(mix(col, glass, inPane))

      // the brass: a tube lit from inside the oval by what the plate is giving off
      const brass = vec3(0.95, 0.6, 0.22)
      const facing = max(nz.mul(0.35).sub(rr.mul(0.75)), 0)
      const sp0 = rr.add(0.35).div(0.16)
      const spec = exp(sp0.mul(sp0).negate()).mul(1.6)
      const rim = brass.mul(glow).mul(facing.mul(0.5).add(spec)).mul(0.6).add(vec3(0.004, 0.003, 0.003))
      // (fog's own frame until the lamp is out, then this one)
      col.assign(mix(col, mix(A, rim, smoothstep(0.02, 0.14, p)), inRim.mul(inPane.oneMinus())))

      // ---- and then it is the next scene
      const Bx = toLinear(sampleRT(U.tB, clamp(uv.add(U.uKnock), 0, 1) as V2).rgb)
      col.assign(mix(col, Bx, smoothstep(LAND + 0.02, LAND + 0.1, p)))
      return vec4(toSRGB(col as V3), 1)
    }, U)

    const quad: Portal["c"] = [[0, 0], [0, 0], [0, 0], [0, 0]]
    const m3 = new THREE.Matrix3()
    return {
      render(a) {
        const pl = a.pl
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = pl
        const { w, h } = ctx.size()
        const fit = 16 / 9 / (w / h)
        U.uFit.value = fit
        // the push: fog's quad walks to where the oval is inscribed in the frame
        const from = a.pa?.c ?? FALLBACK
        const e = E.io3(Math.min(1, Math.max(0, (pl - PUSH[0]) / (PUSH[1] - PUSH[0]))))
        const sx = [-MX * fit, MX * fit, MX * fit, -MX * fit]
        const sy = [MY, MY, -MY, -MY]
        for (let i = 0; i < 4; i++) {
          quad[i][0] = from[i][0] + (sx[i] - from[i][0]) * e
          quad[i][1] = from[i][1] + (sy[i] - from[i][1]) * e
        }
        portalMatrix(quad, U.uHq.value)
        portalMatrix(from, m3)
        U.uHa.value.copy(m3).invert()
        // the pane leaves along its rail, slowly and then all at once
        const s = Math.min(1, Math.max(0, (pl - SLIDE[0]) / (SLIDE[1] - SLIDE[0])))
        U.uSlide.value = 2.6 * fit * s * s * (0.4 + 0.6 * s)
        // the stop
        const k = pl - LAND
        const amp = k > 0 ? 0.013 * Math.exp(-k * DUR * 6) : 0
        U.uKnock.value.set(amp * Math.cos(k * DUR * 38), amp * 0.5 * Math.sin(k * DUR * 31))
        pass.render(a.out)
      },
      warm: () => [{ pass, target: like }],
      dispose: () => pass.dispose(),
    }
  },
}
export default t
