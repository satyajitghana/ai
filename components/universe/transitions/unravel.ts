// 24 → 25. Unravel.
//
// The outgoing picture turns out to have been cloth all along. It is 420 vertical threads, each one
// a column of the picture, set so close that they read as the frame. The threads loosen, and
// slack runs up them as travelling waves. Then they are pulled, one end down past the lens and the
// other back to a single line far off, into the straight warp of a loom. The picture's colours
// ride the threads and give way to undyed linen from the near end. The tension rises and the waves
// die out. At the lock the warp snaps taut: every thread rings once, a short decaying vibration,
// and the loom is under it. It reads the outgoing frame only as colour per column, so it works from
// any picture.
//
//   0.00–0.10  the frame is the picture; a fine column grain comes up (twist, the gaps between ends)
//   0.06–0.38  slack: each thread narrows to a yarn and waves, the waves travelling up it; gaps open
//              onto the dark room behind
//   0.34–0.66  the pull: the threads run straight into perspective, fanning wide at the bottom and
//              converging on the back beam; linen replaces the picture from the near end
//   0.66–0.70  the tension: the last few millimetres, the threads thinning as they stretch
//   0.70       SNAP (UNRAVEL_IN): every thread rings; the loom comes up under the warp
//   0.70–1.00  the rope-light of the snap decays, the transition's threads hand over to the scene's
//
// Everything is closed-form in linear progress. Sizes are in screen pixels (no line under 1.5 px).

import * as THREE from "three/webgpu"
import { abs, attribute, exp, float, Fn, fract, length, max, mix as mixN, positionGeometry, sin, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { hash11, sampleRT, vnoise, type F, type V2 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const UNRAVEL_DUR = 1.6
export const UNRAVEL_IN = 0.7

const N = 420 // threads across
const SEG = 96 // segments along a thread
const P = { grain0: 0.0, grain1: 0.1, slack0: 0.06, slack1: 0.38, pull0: 0.34, pull1: 0.66, snap: UNRAVEL_IN, out0: 0.74, out1: 0.97 }
/** Where the warp's far end converges, in clip space (the back beam seen along the warp). */
const VP = { x: 0.02, y: 0.36, spread: 0.46 }

const ss = (e0: number, e1: number, x: F): F => smoothstep(float(e0), float(e1), x) as F

const t: TransitionDef = {
  id: "unravel",
  dur: UNRAVEL_DUR,
  inAt: UNRAVEL_IN,
  ease: E.lin,
  snd: [
    // the cloth gives: a dry fibrous scratch as the columns part, then threads sliding
    { s: "scratch", p: 0.05, o: { g: 0.16, f: 2400, dur: 0.5 } },
    { s: "hiss", p: 0.12, o: { g: 0.08, dur: 0.5 } },
    { s: "whoosh", p: P.pull0, o: { g: 0.2, f: 300, dur: 0.5 } },
    { s: "riser", p: P.pull0 + 0.06, o: { g: 0.16, dur: (P.snap - P.pull0 - 0.06) * UNRAVEL_DUR } },
    // the snap: a struck warp rings as a chord of plucks, with the beam's thud under it
    { s: "pluck", p: P.snap, o: { g: 0.5, f: H(24), pos: [-0.5, 0, 0.3] } },
    { s: "pluck", p: P.snap, o: { g: 0.45, f: H(30), pos: [0.5, 0, 0.3] } },
    { s: "pluck", p: P.snap + 0.012, o: { g: 0.4, f: H(36), pos: [0, 0.3, 0.6] } },
    { s: "thud", p: P.snap, o: { g: 0.8, f: H(4) } },
    { s: "sub", p: P.snap, o: { g: 0.45 } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      pl: uniform(0),
      grain: uniform(0), //  the column grain on the still picture
      slack: uniform(0), //  how loose the threads are
      thin: uniform(0), //   column → yarn
      pull: uniform(0), //   straight into the warp
      linen: uniform(0), //  picture → linen along the threads
      ring: uniform(0), //   the snap's vibration envelope
      ringT: uniform(0), //  seconds since the snap
      fade: uniform(0), //   the threads hand over
      room: uniform(0), //   B coming up behind
      flash: uniform(0),
      res: uniform(new THREE.Vector2(1280, 720)),
    }

    // ---- behind the threads: the dark room, then the loom
    const back = ctx.pass(({ uv }) => {
      const a = sampleRT(U.tA, uv).rgb
      const b = sampleRT(U.tB, uv).rgb
      // a warm dark with a faint window glow up left: the weaving room before the loom is lit
      const glow = exp(length(uv.sub(vec2(0.2, 0.85)).mul(vec2(1.0, 1.6))).mul(-3.5)).mul(0.05)
      const room = vec3(0.028, 0.022, 0.017).add(vec3(0.55, 0.45, 0.33).mul(glow))
      const behind = mixN(room, b, U.room)
      // until the threads open, what shows through is the picture itself
      return vec4(mixN(a, behind, ss(0.02, 0.12, U.thin as F)), 1)
    }, U)

    // ---- the threads: a strip per thread, SEG long, its own column of the picture
    const geo = new THREE.InstancedBufferGeometry()
    {
      const pos: number[] = []
      const idx: number[] = []
      for (let j = 0; j <= SEG; j++) {
        const v = j / SEG
        pos.push(-1, v, 0, 1, v, 0)
        if (j < SEG) {
          const k = j * 2
          idx.push(k, k + 1, k + 3, k, k + 3, k + 2)
        }
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      geo.setIndex(idx)
      const a = new Float32Array(N * 2)
      for (let i = 0; i < N; i++) a.set([(i + 0.5) / N, i], i * 2)
      geo.setAttribute("aT", new THREE.InstancedBufferAttribute(a, 2))
    }
    geo.instanceCount = N
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

    const aT = attribute("aT", "vec2") as unknown as V2
    const u0 = aT.x
    const seed = hash11(aT.y.add(3.7)).toVar()
    const side = positionGeometry.x
    const v = positionGeometry.y
    const px = vec2(2, 2).div(U.res) // one pixel in clip units
    // the column's own width in clip units, then a yarn about 2 px wide with a little variation
    const colW = float(1 / N)
    const yarn = px.x.mul(seed.mul(0.5).add(0.85))
    // the pull: straight lines from a wide near end to the far beam; threads stretch thinner with depth
    const xNear = u0.sub(0.5).mul(2.7)
    const xFar = u0.sub(0.5).mul(VP.spread * 2).add(VP.x)
    const wv = ss(0, 1, v as F)
    const persp = mixN(float(1.5), float(0.55), v) // nearer is wider
    const halfW = mixN(colW, yarn.mul(mixN(float(1), persp, U.pull)), U.thin).mul(float(1).sub(U.ring.mul(0.15)))
    // slack: travelling waves up the thread, growing from the bottom where it was let go first
    const ph = seed.mul(6.283)
    const wave = sin(v.mul(9.0).sub(U.pl.mul(26)).add(ph)).mul(0.6).add(sin(v.mul(23.0).sub(U.pl.mul(41)).add(ph.mul(2.3))).mul(0.25))
    const slackAmp = U.slack.mul(float(1).sub(U.pull)).mul(0.018).mul(v.mul(0.6).add(0.4))
    // the pluck: a standing wave between the beams, decaying, its pitch by thread
    const ringW = sin(v.mul(3.14159)).mul(sin(U.ringT.mul(seed.mul(30).add(70))).mul(U.ring)).mul(px.x.mul(5))
    const xs = u0.mul(2).sub(1).add(wave.mul(slackAmp)).add(ringW)
    const ys = v.mul(2).sub(1).sub(U.slack.mul(float(1).sub(U.pull)).mul(0.015).mul(sin(ph.add(v.mul(3)))))
    const xp = mixN(xNear, xFar, wv).add(ringW)
    const yp = mixN(float(-1.12), float(VP.y), wv)
    const k = U.pull
    const cx = mixN(xs, xp, k).add(side.mul(halfW))
    const cy = mixN(ys, yp, k)
    const geoMat = new THREE.NodeMaterial()
    geoMat.vertexNode = vec4(cx, cy, 0.5, 1)
    const vU = u0.add(side.mul(colW.mul(0.5))).toVarying("uvU")
    const vV = v.toVarying("uvV")
    const vSide = side.toVarying("uvS")
    const vSeed = seed.toVarying("uvSeed")
    const vPx = halfW.div(px.x).toVarying("uvPx") // the yarn's half width in pixels
    geoMat.fragmentNode = Fn(() => {
      const pic = sampleRT(U.tA, vec2(vU, vV) as V2).rgb.toVar()
      // undyed linen: grey-buff, a little variation per end, lighter where it catches the light
      const lin = vec3(0.74, 0.66, 0.52).mul(vSeed.mul(0.16).add(0.86)).toVar()
      const toLinen = ss(0, 1, U.linen.mul(1.6).sub(vV.mul(0.6)) as F)
      const col = mixN(pic, lin, toLinen).toVar()
      // a round yarn: shading across it, and the twist: S-twist stripes running diagonally
      const across = abs(vSide)
      const round = float(1).sub(across.mul(across).mul(0.55))
      const twist = fract(vV.mul(720).add(vSide.mul(0.6)).add(vSeed.mul(9)))
      const tw = smoothstep(float(0.0), float(0.5), twist).mul(smoothstep(float(1.0), float(0.5), twist))
      const show = ss(0.0, 1.0, U.grain.add(U.thin) as F)
      const yarnLook = round.mul(tw.mul(0.22).add(0.8))
      col.mulAssign(mixN(float(1), yarnLook, show))
      // fuzz: stray fibres break the yarn's edge, more when it is slack
      const fz = vnoise(vec2(vV.mul(900), vSeed.mul(77)))
      const edge = smoothstep(float(1.0), float(0.55), across.add(fz.mul(0.35).mul(U.thin)))
      // the gaps between ends, while the picture is still whole: a hairline per column
      const gap = mixN(float(1), smoothstep(float(1.0), float(0.7), across), U.grain.mul(float(1).sub(U.thin)))
      // tension light: the snap sends a glint along every thread
      const glint = U.flash.mul(exp(abs(vV.sub(U.ringT.mul(4).fract())).mul(-14)).add(0.4))
      const a = mixN(float(1), edge, U.thin).mul(gap).mul(float(1).sub(U.fade)).mul(max(ss(0.25, 0.9, vPx.mul(2) as F), float(1).sub(U.thin)))
      return vec4(col.add(vec3(1.0, 0.92, 0.78).mul(glint).mul(0.6)).mul(a), a)
    })()
    Object.assign(geoMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    const mesh = new THREE.Mesh(geo, geoMat)
    mesh.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(mesh)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    return {
      render(a) {
        const pl = clamp(a.pl)
        const { w, h } = ctx.size()
        U.res.value.set(w, h)
        U.tA.value = a.A
        U.tB.value = a.B
        U.pl.value = pl
        U.grain.value = smooth(P.grain0, P.grain1, pl)
        U.thin.value = E.io2(smooth(P.slack0, P.slack1 - 0.08, pl))
        U.slack.value = smooth(P.slack0, P.slack1, pl)
        // the pull accelerates into the snap and stops dead on it
        U.pull.value = E.in3(smooth(P.pull0, P.snap, pl))
        U.linen.value = smooth(P.pull0 - 0.04, P.snap, pl)
        const ts = (pl - P.snap) * UNRAVEL_DUR
        U.ringT.value = Math.max(0, ts)
        U.ring.value = ts > 0 ? Math.exp(-ts * 9) : 0
        U.flash.value = ts > -0.02 ? Math.exp(-Math.abs(ts) * 14) : 0
        U.room.value = smooth(P.snap - 0.02, P.snap + 0.06, pl)
        U.fade.value = smooth(P.out0, P.out1, pl)
        const r = ctx.renderer
        back.render(a.out)
        r.setRenderTarget(a.out)
        r.autoClear = false
        r.render(scene, cam)
        r.autoClear = true
      },
      warm: () => [
        { pass: back, target: hold },
        { scene, camera: cam, target: hold },
      ],
      dispose() {
        back.dispose()
        geo.dispose()
        geoMat.dispose()
      },
    }
  },
}

export default t
