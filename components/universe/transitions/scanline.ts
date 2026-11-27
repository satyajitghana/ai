// 20 → 21. Scanline.
//
// The picture is on the face of a cathode-ray tube, and the tube is switched off and on again.
// It never reads what the outgoing picture shows, so it works from any frame.
//
//   0.00–0.09  the frame becomes curved glass: the picture bulges into a rounded faceplate, the
//              aperture grille's stripes and the scan lines come up, the bezel shows round it.
//   0.08–0.26  the beam stops. Each line keeps the light it was last given and decays at the
//              phosphors' own rates (green lingers longest), top line first: the last field dies.
//   0.28       the relay thunk (`crt`). A dot in the middle of black glass, flickering with the buzz.
//   0.37–0.44  horizontal deflection comes up: the dot is thrown out into a line and overshoots.
//   0.44–0.50  vertical deflection: the line opens into an empty raster of glowing lines.
//   0.49–0.62  one field: the beam writes the incoming picture line by line, top to bottom, every
//              line flaring as it is struck and settling to its colour.
//   0.62       the field completes: the flash, and the incoming scene's first beat (SCANLINE_IN).
//   0.58–0.80  degauss: the coil's field swims the colour purity in blotches as the buzz dies.
//   0.70–1.00  the glass lets go: curvature, grille and scan lines relax into the plain frame.
//
// Everything is closed-form in linear progress. Grille stripes and scan lines are sized in
// screen pixels (at least 4.5 and 6 at 1280×720) so nothing is finer than the 1.5 px floor.

import { abs, clamp as clampN, dot, exp, float, fract, length, max, min, mix, select, sin, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, ramp, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { sampleRT, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const SCANLINE_DUR = 2.2
export const SCANLINE_IN = 0.62

const P = { glass: 0.09, dec0: 0.08, dec1: 0.26, thunk: 0.28, line0: 0.37, line1: 0.44, ras0: 0.44, ras1: 0.5, f0: 0.49, f1: SCANLINE_IN, dg0: 0.58, dg1: 0.8, out0: 0.7, out1: 0.995 }
/** smoothstep that also takes a falling edge (WGSL's is undefined for e0 > e1) */
const ss = (e0: F | number, e1: F | number, x: F): F => {
  const a = typeof e0 === "number" ? float(e0) : e0
  const b = typeof e1 === "number" ? float(e1) : e1
  const k = clampN(x.sub(a).div(b.sub(a)), 0, 1)
  return k.mul(k).mul(k.mul(-2).add(3)) as F
}
const sq = (x: F): F => x.mul(x) as F
const LINES = 120 // scan lines on the face: 6 px each at 720

const t: TransitionDef = {
  id: "scanline",
  dur: SCANLINE_DUR,
  inAt: SCANLINE_IN,
  ease: E.lin,
  snd: [
    { s: "hiss", p: P.dec0, o: { g: 0.12, dur: 0.4 } },
    { s: "crt", p: P.thunk, o: { g: 0.95, dur: 1.4 } },
    { s: "tick", p: P.line0, o: { g: 0.25, f: H(56) } },
    { s: "whoosh", p: P.ras0 - 0.02, o: { g: 0.12, f: 900, dur: 0.3 } },
    { s: "glass", p: P.f1, o: { g: 0.45, f: H(40), pos: [0, 0, 0.3] } },
    { s: "shimmer", p: P.f1, o: { g: 0.3, f: H(32) } },
    { s: "sub", p: P.f1, o: { g: 0.35 } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      asp: uniform(16 / 9),
      time: uniform(0),
      G: uniform(0), //      how much the frame is a tube (curvature, grille, lines, bezel)
      Z: uniform(1), //      the tube's size in the frame (it backs off a little mid-way)
      K: uniform(0), //      barrel of the faceplate
      decay: uniform(0), //  seconds since the beam stopped (scaled), for the outgoing picture
      showA: uniform(1),
      dot: uniform(0), //    the spot's brightness
      lineX: uniform(0), //  horizontal deflection, 0..1 of the width
      rasY: uniform(0), //   vertical deflection, 0..1 of the height
      raster: uniform(0), // the empty raster's glow
      beam: uniform(-1), //  how far down the field the beam is, 0 (top) .. 1 (bottom); -1 before
      fieldT: uniform(0), // seconds of the field so far (for each line's flare)
      fieldDur: uniform(0.3),
      flash: uniform(0),
      wob: uniform(0), //    degauss
      pxr: uniform(1), //    screen pixels per pixel of a 1280-wide frame
    }

    const pass = ctx.pass(({ uv, res }) => {
      const plain = mix(sampleRT(U.tA, uv).rgb, sampleRT(U.tB, uv).rgb, select(U.showA.greaterThan(0.5), float(0), float(1))).toVar()
      const col = vec3(0).toVar()
      const n0 = vec2(uv.x.mul(2).sub(1), uv.y.mul(2).sub(1)).div(U.Z).toVar() // -1..1 across the tube's face
      // the faceplate: the picture is laid on a sphere-ish glass, so its edges bulge toward the lens
      const nn = vec2(n0.x, n0.y.div(U.asp).mul(1.25)).toVar()
      const st = n0.mul(dot(nn, nn).mul(U.K).add(1)).toVar()
      // rounded mask in face units, corner radius in the aspect-corrected frame
      const cr = 0.07
      const q = vec2(abs(st.x).mul(U.asp), abs(st.y)).sub(vec2(U.asp.sub(cr), 1 - cr)).toVar()
      const sd = length(max(q, vec2(0))).add(min(max(q.x, q.y), 0)).sub(cr).toVar()
      const aa = float(2).div(res.y).mul(1.5)
      const inside = ss(aa, aa.negate(), sd).toVar()
      const pic = (tex: typeof U.tA, at: V2): V3 => sampleRT(tex, vec2(clampN(at.x, 0, 1), clampN(at.y, 0, 1)) as V2).rgb as V3
      const stUV = st.mul(0.5).add(0.5).toVar()

      // ---- the outgoing field, dying: each line decays from when it was last struck (the top first)
      const age = U.decay.add(st.y.oneMinus().mul(-0.025)).max(0).toVar()
      const kA = vec3(exp(age.mul(-34)), exp(age.mul(-14)), exp(age.mul(-46))).toVar() // red and blue go first, green lingers
      const A = pic(U.tA, stUV as V2).mul(kA).mul(U.showA)
      // a decaying picture greens toward the phosphor's own colour as it fades
      col.addAssign(A)

      // ---- the spot, the line, the raster
      const xh = U.lineX
      const lineD = vec2(max(abs(st.x).sub(xh), 0).mul(U.asp), abs(st.y)).toVar()
      const spot = exp(dot(lineD, lineD).mul(-9000)).mul(2.2).add(exp(length(lineD).mul(-60)).mul(0.25)).add(exp(length(lineD).mul(-9)).mul(0.04))
      const flick = sin(U.time.mul(314.16)).mul(0.18).add(0.86)
      const ph = vec3(0.62, 1.0, 0.7)
      col.addAssign(ph.mul(spot).mul(U.dot).mul(flick))
      // raster: the band the vertical deflection has opened, ruled into lines
      const vy = max(U.rasY, 0.0001)
      const band = ss(vy.add(0.004), vy.sub(0.004), abs(st.y)).mul(ss(1.003, 0.997, abs(st.x))).toVar()
      const lyr = vy.sub(st.y).div(vy.mul(2)).mul(LINES).toVar() // line coordinate from the top of the band
      const lineProf = exp(sq(fract(lyr).sub(0.5).mul(3.2)).negate()).toVar()
      col.addAssign(vec3(0.16, 0.24, 0.18).mul(band).mul(U.raster).mul(lineProf.mul(0.9).add(0.1)))

      // ---- the field: the beam writes the incoming picture line by line
      const rowI = st.y.oneMinus().mul(0.5).mul(LINES).floor().toVar()
      const beamRow = U.beam.mul(LINES).toVar()
      const struck = U.beam.greaterThanEqual(0).and(rowI.lessThan(beamRow.floor())).or(rowI.equal(beamRow.floor()).and(stUV.x.lessThan(fract(beamRow)))).toVar()
      // seconds since this point was struck, for its flare
      const hitAt = rowI.add(stUV.x).div(LINES).mul(U.fieldDur)
      const since = U.fieldT.sub(hitAt).max(0).toVar()
      const B = pic(U.tB, stUV as V2).toVar()
      const flare = exp(since.mul(-26)).toVar()
      const writ = B.mul(flare.mul(0.45).add(1)).add(ph.mul(flare).mul(0.2)).mul(select(struck, float(1), float(0))).mul(band)
      col.addAssign(writ)
      // the head of the beam: a hot dash on the line being written
      const headD = vec2(stUV.x.sub(fract(beamRow)).mul(U.asp).mul(5), rowI.add(0.5).sub(beamRow.floor().add(0.5)).div(LINES).mul(4)).toVar()
      const head = exp(dot(headD, headD).mul(-900)).mul(select(U.beam.greaterThanEqual(0).and(U.beam.lessThan(1)), float(1), float(0)))
      col.addAssign(ph.mul(head).mul(2.5))
      col.addAssign(B.mul(U.flash).mul(0.6).add(ph.mul(U.flash).mul(0.25)).mul(band))

      // ---- degauss: the colour purity swims in blotches
      const w1 = vnoise(st.mul(vec2(2.2, 1.6)).add(vec2(U.time.mul(1.7), U.time.mul(-1.3)))).sub(0.5).toVar()
      const w2 = vnoise(st.mul(vec2(1.4, 2.1)).add(vec2(U.time.mul(-1.1), U.time.mul(2.0))).add(7.3)).sub(0.5).toVar()
      const swim = vec3(w1.mul(1.6), w2.mul(1.2), w1.add(w2).mul(-1.2)).mul(U.wob).mul(sin(U.time.mul(9.0)).mul(0.4).add(0.8))
      col.assign(col.mul(swim.add(1)).max(0))

      // ---- the glass: aperture grille and scan lines, sized in pixels
      const gx = uv.x.mul(res.x).div(U.pxr.mul(4.5)).toVar()
      const stripe = vec3(fract(gx), fract(gx.add(0.333)), fract(gx.add(0.667))).toVar()
      const tri = exp(stripe.sub(0.5).mul(2.6).mul(stripe.sub(0.5).mul(2.6)).negate()).mul(1.55).toVar()
      const grille = mix(vec3(1), tri, U.G.mul(0.55))
      const slp = exp(sq(fract(st.y.oneMinus().mul(0.5).mul(LINES)).sub(0.5).mul(2.4)).negate()).mul(1.35)
      const scan = mix(float(1), slp, U.G.mul(0.6))
      col.mulAssign(grille.mul(scan))
      // black glass is not black: a grey-green face, a window's reflection, a highlight along the bulge
      const glassN = nn.mul(U.K.mul(3))
      const refl = exp(length(st.sub(vec2(-0.55, 0.62)).mul(vec2(1.6, 2.4))).mul(-2.2)).mul(0.07).add(smoothstep(0.92, 0.99, st.x.mul(-0.45).add(st.y.mul(0.9)).add(0.42)).mul(0.04))
      col.addAssign(vec3(0.028, 0.034, 0.032).mul(U.G).add(vec3(0.85, 0.9, 1.0).mul(refl).mul(U.G).mul(length(glassN).mul(2).add(0.6))))
      // the curved glass darkens toward its edges
      col.mulAssign(float(1).sub(dot(nn, nn).mul(0.22).mul(U.G)))
      // ---- the bezel round the face: moulded plastic with a lip that catches the light
      const lip = exp(abs(sd).mul(-90)).mul(0.09).mul(smoothstep(-0.3, 0.6, uv.y))
      const bez = vec3(0.05, 0.048, 0.045).mul(vnoise(uv.mul(res).mul(0.35)).mul(0.15).add(0.85)).mul(uv.y.mul(0.5).add(0.6)).add(lip)
      const tube = mix(bez, col, inside).toVar()
      return vec4(mix(plain, tube, U.G), 1)
    }, U)

    return {
      render(a) {
        const p = a.pl
        const { w } = ctx.size()
        U.tA.value = a.A
        U.tB.value = a.B
        U.asp.value = a.out.width / a.out.height
        U.time.value = a.time
        U.pxr.value = Math.max(1, (a.out.width || w) / 1280)
        const G = smooth(0, P.glass, p) * (1 - smooth(P.out0, P.out1, p))
        U.G.value = G
        U.Z.value = 1 - 0.1 * Math.sin(Math.PI * clamp(ramp(p, 0.02, 0.97))) ** 1.5
        U.K.value = 0.11 * G
        U.showA.value = p < P.thunk ? 1 : 0
        U.decay.value = Math.max(0, (p - P.dec0) * SCANLINE_DUR)
        // the spot: lit at the thunk, a moment's flicker, then thrown into the line
        const on = p >= P.thunk ? 1 : 0
        U.dot.value = on * (0.55 + 0.45 * smooth(P.thunk, P.thunk + 0.03, p)) * (1 - smooth(P.ras1, P.f0 + 0.06, p))
        U.lineX.value = E.outBack(ramp(p, P.line0, P.line1))
        U.rasY.value = E.outBack(ramp(p, P.ras0, P.ras1))
        U.raster.value = smooth(P.ras0, P.ras0 + 0.03, p) * (1 - smooth(P.f1, P.f1 + 0.1, p))
        const fd = (P.f1 - P.f0) * SCANLINE_DUR
        U.fieldDur.value = fd
        U.fieldT.value = (p - P.f0) * SCANLINE_DUR
        U.beam.value = p < P.f0 ? -1 : clamp((p - P.f0) / (P.f1 - P.f0), 0, 1.0001)
        U.flash.value = Math.exp(-(((p - P.f1) / 0.025) ** 2)) * 0.8
        U.wob.value = smooth(P.dg0, P.dg0 + 0.04, p) * (1 - smooth(P.dg0 + 0.06, P.dg1, p)) * 0.32
        pass.render(a.out)
      },
      warm: () => [{ pass, target: hold }],
    }
  },
}
export default t
