// 23 → 24. Trace.
//
// The picture goes through a waveform monitor: the oscilloscope a television engineer reads a
// picture with. Every pixel of the frame becomes a spot of light; on a waveform display a spot
// keeps its place across the screen and rises to its own brightness, so the picture collapses into
// its waveform, a glowing band of trace. Not a television (that is `scanline`, a curved raster
// tube): a flat face with its graticule etched inside, no scan lines, no grille, no pull-back, and
// a P7 phosphor: the spot writes blue-white and leaves a long yellow-green afterglow. It reads the
// outgoing picture only by colour and brightness, so it works from any frame.
//
//   0.00–0.10  the frame becomes the scope face: the graticule's scale lamps come up and the
//              picture is taken over by 57,600 spots of light, one per pixel of a 320×180 grid.
//   0.08–0.30  the spots fall and rise to their brightness, row after row from the top: the
//              picture collapses into its waveform; the sweep writes across it, leaving afterglow.
//   0.30–0.44  the signal flattens: every spot goes to the centre line.
//   0.42–0.53  one flat line across the graticule; the lens punches in on it.
//   0.53       the trigger: one pulse runs along the line.
//   0.55–0.66  the line opens into the incoming picture's waveform.
//   0.62–0.74  each spot leaves its brightness for its place in the picture, row after row: the
//              incoming frame assembles out of the trace.
//   0.74       lock (TRACE_IN): the flash, the incoming scene's first beat.
//   0.74–1.00  the spots melt into the plain frame; lamps and graticule go out.
//
// Everything is closed-form in linear progress; the beam's clock is progress × duration, never the
// wall. Lines, ticks and spots are sized in screen pixels (no line under 1.5 px at 1280×720).

import * as THREE from "three/webgpu"
import { abs, attribute, exp, float, Fn, fract, length, max, min, positionGeometry, select, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { luma, sampleRT, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const TRACE_DUR = 1.8
export const TRACE_IN = 0.74

const GX = 320 // spots across
const GY = 180 // spots down
const P = { face1: 0.07, fall0: 0.08, fall1: 0.3, flat0: 0.3, flat1: 0.44, punch0: 0.4, punch1: 0.47, trig: 0.53, open0: 0.55, open1: 0.66, rise0: 0.62, rise1: TRACE_IN, out0: 0.78, out1: 0.995 }
const SWEEP = 0.16 // seconds per sweep across the face
const WAVE = [0.14, 0.74] // the waveform's black and white levels on the face (y up)

const ss = (e0: number, e1: number, x: F): F => {
  const k = x.sub(e0).div(e1 - e0).clamp(0, 1)
  return k.mul(k).mul(k.mul(-2).add(3)) as F
}
const mixV = (a: V3, b: V3, k: F): V3 => a.mul(k.oneMinus()).add(b.mul(k)) as V3

const t: TransitionDef = {
  id: "trace",
  dur: TRACE_DUR,
  inAt: TRACE_IN,
  ease: E.lin,
  snd: [
    { s: "hiss", p: 0.03, o: { g: 0.1, dur: 0.7 } },
    { s: "whoosh", p: P.fall0, o: { g: 0.12, f: 500, dur: 0.35 } },
    { s: "tick", p: 0.2, o: { g: 0.3, f: H(60) } },
    { s: "tick", p: 0.2 + SWEEP / TRACE_DUR, o: { g: 0.22, f: H(60) } },
    { s: "pad", p: P.flat1 - 0.04, o: { g: 0.2, f: H(32), dur: 0.45 } },
    { s: "pluck", p: P.trig, o: { g: 0.55, f: H(48), pos: [0, 0, 0.2] } },
    { s: "whoosh", p: P.open0, o: { g: 0.14, f: 1400, dur: 0.3 } },
    { s: "riser", p: P.rise0, o: { g: 0.18, dur: (P.rise1 - P.rise0) * TRACE_DUR } },
    { s: "sub", p: P.rise1, o: { g: 0.5 } },
    { s: "boom", p: P.rise1, o: { g: 0.28 } },
    { s: "glass", p: P.rise1, o: { g: 0.4, f: H(36), pos: [0, 0, 0.3] } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture), // the plain frame under the face
      tS: uniformTexture(hold.texture), // the frame the spots read
      G: uniform(0), //       how much the frame is the scope face
      ghost: uniform(1), //   the plain picture showing (before the spots take over, and after)
      lamps: uniform(0), //   the graticule's scale illumination
      Z: uniform(1), //       the punch-in
      W: uniform(0), //       picture (0) to waveform (1), staggered by row
      flat: uniform(0), //    waveform to the flat centre line
      dots: uniform(0), //    how much the spots show
      now: uniform(0), //     beam clock, seconds
      pulse: uniform(-1), //  the trigger pulse's x (-1: none)
      flash: uniform(0),
      asp: uniform(16 / 9),
      res: uniform(new THREE.Vector2(1280, 720)),
      pxr: uniform(1), //     screen pixels per pixel of a 1280-wide frame
    }

    // ---- the face: glass, graticule, lamps, bezel corners
    const zq = (uv: V2): V2 => uv.sub(0.5).div(U.Z).add(0.5) as V2
    const face = ctx.pass(({ uv, res }) => {
      const plain = sampleRT(U.tA, uv).rgb.toVar()
      const q = zq(uv).toVar()
      const px = U.pxr
      const glass = vec3(0.045, 0.052, 0.064).toVar()
      glass.addAssign(vec3(0.75, 0.82, 0.95).mul(exp(length(q.sub(vec2(0.2, 0.88)).mul(vec2(1.0, 1.7))).mul(-3.4)).mul(0.08)))
      glass.mulAssign(float(1).sub(length(q.sub(0.5).mul(vec2(1.0, 1.25))).mul(0.5)))
      // a faint ghost of the phosphor's last picture, as a real face holds it
      const col = glass.add(vec3(luma(plain)).mul(vec3(0.5, 0.62, 0.3)).mul(0.05).mul(U.lamps)).toVar()
      // 10 × 8 divisions etched inside the face, fifths along the two centre lines
      const cw = res.x.mul(U.Z).div(10)
      const ch = res.y.mul(U.Z).div(8)
      const lw = px.mul(0.8)
      const dX = abs(fract(q.x.mul(10).add(0.5)).sub(0.5)).mul(cw)
      const dY = abs(fract(q.y.mul(8).add(0.5)).sub(0.5)).mul(ch)
      const grid = max(ss(1, 0, dX.div(lw) as F), ss(1, 0, dY.div(lw) as F)).toVar()
      const tick = px.mul(5)
      const nearV = select(abs(q.x.sub(0.5)).mul(res.x).mul(U.Z).lessThan(tick), float(1), float(0))
      const nearH = select(abs(q.y.sub(0.5)).mul(res.y).mul(U.Z).lessThan(tick), float(1), float(0))
      const tY = abs(fract(q.y.mul(40).add(0.5)).sub(0.5)).mul(ch).mul(0.2)
      const tX = abs(fract(q.x.mul(50).add(0.5)).sub(0.5)).mul(cw).mul(0.2)
      grid.assign(max(grid, max(ss(1, 0, tY.div(lw) as F).mul(nearV), ss(1, 0, tX.div(lw) as F).mul(nearH))))
      // the etched lines scatter a little room light, and glow amber when the scale lamps are on
      col.addAssign(vec3(0.06, 0.065, 0.07).mul(grid).add(vec3(0.95, 0.48, 0.16).mul(grid).mul(U.lamps).mul(0.5)))
      // the lamps' spill from the face's top and bottom edges
      const spill = exp(q.y.mul(-14)).add(exp(q.y.oneMinus().mul(-14)))
      col.addAssign(vec3(0.6, 0.28, 0.08).mul(U.lamps).mul(spill).mul(0.06))
      // the tube's rounded corners in a black bezel
      const cr = 0.035
      const qq = vec2(abs(q.x.sub(0.5)).mul(U.asp), abs(q.y.sub(0.5))).sub(vec2(U.asp.mul(0.5).sub(cr), 0.5 - cr))
      const sd = length(max(qq, vec2(0))).add(min(max(qq.x, qq.y), 0)).sub(cr)
      col.mulAssign(smoothstep(float(0.002), float(-0.002), sd).mul(0.98).add(0.02))
      const faced = mixV(col, plain, U.ghost as unknown as F)
      return vec4(mixV(plain, faced, U.G as unknown as F).add(vec3(0.72, 0.84, 1.0).mul(U.flash)), 1)
    }, U)

    // ---- the spots: one per cell of a 320 × 180 grid
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    {
      const a = new Float32Array(GX * GY * 2)
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) a.set([(i + 0.5) / GX, (j + 0.5) / GY], (j * GX + i) * 2)
      geo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 2))
    }
    geo.instanceCount = GX * GY
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const aS = attribute("aS", "vec2") as unknown as V2
    const src = sampleRT(U.tS, aS).rgb.toVar()
    const L = luma(src as V3)
    // rows from the top go first: a cascade, not a jump
    const rowLag = aS.y.oneMinus().mul(0.45)
    const w = U.W.mul(1.45).sub(rowLag).clamp(0, 1)
    const wE = w.mul(w).mul(w.mul(-2).add(3)).toVar()
    const yWave = L.mul(WAVE[1] - WAVE[0]).add(WAVE[0])
    const dx = aS.x.sub(U.pulse).div(0.012)
    const yFlat = float(0.5).add(exp(dx.mul(dx).negate()).mul(0.16).mul(select(U.pulse.greaterThan(-0.5), float(1), float(0))))
    const y = aS.y.mul(wE.oneMinus()).add(yWave.mul(wE)).mul(U.flat.oneMinus()).add(yFlat.mul(U.flat))
    const pos = vec2(aS.x, y).sub(0.5).mul(U.Z).add(0.5)
    // a spot fills its cell as a picture (sigma half a cell) and narrows to a crisp beam as a trace
    const cellPx = U.res.x.div(GX)
    // (wide along the sweep, so neighbouring spots run together into a line)
    const sigX = cellPx.mul(mixF(float(0.55), float(0.75), wE))
    const sigY = mixF(cellPx.mul(0.55), U.pxr.mul(0.85), wE)
    const clip = pos.mul(2).sub(1).add(positionGeometry.xy.mul(vec2(sigX, sigY)).mul(6).div(U.res))
    // the sweep: each spot is brightest just after the beam has passed its column
    const age = fract(U.now.sub(aS.x.mul(SWEEP)).div(SWEEP)).mul(SWEEP)
    const fast = exp(age.mul(-40)).mul(1.6)
    const slow = exp(age.mul(-5)).mul(0.6).add(0.4)
    const phos = vec3(0.72, 0.86, 1.0).mul(fast).add(vec3(0.62, 0.8, 0.22).mul(slow))
    // as a picture each spot is its pixel (normalised so the Gaussians sum to the pixel); as a trace
    // the many spots on one level pile up into a bright line
    const pictureGain = cellPx.mul(cellPx).div(sigX.mul(sigY).mul(6.2832))
    const traceGain = float(0.05)
    const c = mixV(src.mul(pictureGain), phos.mul(traceGain), wE.mul(0.92).add(U.flat.mul(0.08)).clamp(0, 1) as F).mul(U.dots)
    const vC = c.toVarying("trC")
    const dotMat = new THREE.NodeMaterial()
    dotMat.vertexNode = vec4(clip, 0.5, 1)
    dotMat.fragmentNode = Fn(() => {
      const r = positionGeometry.xy.mul(3)
      const g = exp(r.dot(r).mul(-0.5))
      return vec4(vC.mul(g), 0)
    })()
    Object.assign(dotMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor })
    const dots = new THREE.Mesh(geo, dotMat)
    dots.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(dots)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    return {
      render(a) {
        const pl = clamp(a.pl)
        const { w: W, h: Hh } = ctx.size()
        const toB = pl >= 0.5
        U.tA.value = toB ? a.B : a.A
        U.tS.value = toB ? a.B : a.A
        U.asp.value = W / Hh
        U.res.value.set(W, Hh)
        U.pxr.value = Math.max(1, W / 1280)
        U.G.value = smooth(0, P.face1, pl) * (1 - smooth(P.out0, P.out1, pl))
        // the plain picture gives way to its spots, and comes back once they have rebuilt the incoming one
        U.ghost.value = toB ? smooth(P.rise1 + 0.01, P.out0 + 0.06, pl) : 1 - smooth(0.01, P.fall0 + 0.02, pl)
        U.dots.value = (toB ? 1 - smooth(P.rise1 + 0.02, P.out0 + 0.08, pl) : smooth(0.0, P.fall0, pl)) * U.G.value
        U.lamps.value = smooth(0.02, 0.12, pl) * (1 - smooth(0.76, 0.95, pl))
        U.Z.value = 1 + 0.45 * E.io3(smooth(P.punch0, P.punch1, pl)) * (1 - E.io3(smooth(P.trig + 0.03, P.open1, pl)))
        U.W.value = toB ? 1 - smooth(P.rise0, P.rise1, pl) : smooth(P.fall0, P.fall1, pl)
        U.flat.value = toB ? 1 - E.out3(smooth(P.open0, P.open1, pl)) : E.in2(smooth(P.flat0, P.flat1, pl))
        U.now.value = pl * TRACE_DUR
        const pt = (pl - P.trig) / 0.05
        U.pulse.value = pt >= 0 && pt <= 1 ? -0.05 + pt * 1.1 : -1
        U.flash.value = 0.5 * Math.exp(-Math.abs(pl - P.rise1) * 45) * (pl > P.rise1 - 0.025 ? 1 : 0)
        const r = ctx.renderer
        face.render(a.out)
        r.setRenderTarget(a.out)
        r.autoClear = false
        r.render(scene, cam)
        r.autoClear = true
      },
      warm: () => [
        { pass: face, target: hold },
        { scene, camera: cam, target: hold },
      ],
      dispose() {
        face.dispose()
        geo.dispose()
        dotMat.dispose()
      },
    }
  },
}

function mixF(a: F, b: F, k: F): F {
  return a.mul(k.oneMinus()).add(b.mul(k)) as F
}

export default t
