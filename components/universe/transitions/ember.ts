// 11 → 12. The ember.
//
// lastday ends grey: ash coming down, bare trunks, a small bird. Here the ash keeps falling in
// front of that frame (1,500 flakes with their own depths, each drawn as large and as soft as its
// distance from the plane of focus makes it) while the day behind them goes out, and the flakes
// thin. One mote is still alight. It drifts toward the lens on a slow curve; the ash near it is
// lit by it (inverse square, in the flakes' own space), and it is the only light there is. As it
// comes it leaves the plane of focus and swells into a soft disc; where its light falls the next
// frame begins to show, a stone and a hand in ember light. At LAND the lens racks: the disc
// collapses to a point exactly where scenes/spark.ts lands its first blow, and it is no longer an
// ember but the low sun glinting on a fresh fracture face. A ring of daylight opens from that
// point and the ash that is left is blown outward by the blow.
//
// What crosses the cut is the mote. Everything is closed-form in the transition's linear progress.
// Knapping throws no sparks: the mote becomes a glint, never a spark.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp, dot, exp, float, Fn, fract, length, max, mix, positionGeometry, pow, sin, smoothstep, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { rng } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

/** Seconds, and the fraction at which the ember meets the stone: scenes/spark.ts lands its first blow there. */
export const EMBER_DUR = 3.0
export const EMBER_LAND = 0.72
/** Where the first blow lands in the frame (uv, origin bottom-left). scenes/spark.ts keeps it current. */
export const EMBER_HIT = { x: 0.6, y: 0.5 }

const ASH = 1500
const START: [number, number] = [0.235, 0.258] // the coal still alight on the bank in lastday's last frame (2:12.5)
/** The ember's place in the frame and its depth (1 far .. 0 at the lens) at progress p. */
function emberAt(p: number, out: [number, number, number]) {
  const q = Math.min(1, p / EMBER_LAND)
  const e = q * q * (3 - 2 * q)
  // a lazy S: it sinks, is carried left, then comes round to the stone
  out[0] = START[0] + (EMBER_HIT.x - START[0]) * e - 0.11 * Math.sin(q * Math.PI) * (1 - q) + 0.012 * Math.sin(q * 17)
  out[1] = START[1] + (EMBER_HIT.y - START[1]) * e - 0.07 * Math.sin(q * Math.PI * 2) * (1 - q) + 0.01 * Math.sin(q * 13 + 1)
  out[2] = 0.92 - 0.8 * q * q
  return out
}

const t: TransitionDef = {
  id: "ember",
  dur: EMBER_DUR,
  inAt: EMBER_LAND,
  ease: (x) => x,
  snd: [
    { s: "hiss", o: { dur: 1.6, g: 0.22 } },
    // the mote: a thin high tone that comes closer
    { s: "shimmer", o: { g: 0.2, dur: EMBER_DUR * EMBER_LAND, at: 0.25, pos: [-0.1, 0.3, 1.6] } },
    { s: "glass", o: { f: H(72), g: 0.1, at: 0.5, pos: [-0.2, 0.3, 1.2] } },
    { s: "glass", o: { f: H(64), g: 0.12, at: 1.15, pos: [-0.25, 0.1, 0.6] } },
    { s: "riser", o: { dur: 1.1, g: 0.5, at: EMBER_DUR * EMBER_LAND - 1.1 } },
    // the landing: the scene supplies the knap itself, on its own clock
    { s: "sub", o: { g: 0.8 }, p: EMBER_LAND },
    { s: "whoosh", o: { f: 420, dur: 0.7, g: 0.3 }, p: EMBER_LAND },
    { s: "bell", o: { f: H(48), g: 0.16, pos: [0.2, 0, 0] }, p: EMBER_LAND },
  ],
  sound(pl, _prev, synth) {
    synth.bed("wind", Math.max(0, 0.6 - pl * 1.4))
    synth.bed("air", Math.min(1, pl * 1.5) * 0.4)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      p: uniform(0),
      uRes: uniform(new THREE.Vector2(1280, 720)),
      uE: uniform(new THREE.Vector3(0.5, 0.5, 1)), // the ember: uv and depth
      uHit: uniform(new THREE.Vector2(0.6, 0.5)),
      uT: uniform(0),
    }
    const p = U.p
    const asp = U.uRes.x.div(U.uRes.y)
    const land = p.sub(EMBER_LAND).toVar()
    // after the landing: 0..1
    const after = clamp(land.div(1 - EMBER_LAND), 0, 1)
    /** How far out of focus the ember is: 0 sharp. It leaves focus as it nears the lens and snaps back on the blow. */
    const blur = smoothstep(0.3, 0.68, p).mul(smoothstep(EMBER_LAND + 0.012, EMBER_LAND - 0.03, p))
    const emberR = mix(0.0035, 0.008, smoothstep(0, 0.4, p)).mul(smoothstep(EMBER_LAND + 0.05, EMBER_LAND, p).mul(0.75).add(0.25))
    const emberB = blur.mul(0.085)
    /** The ember's light on something `d` away from it in the frame (aspect-corrected). */
    const emberLight = (d: F): F => {
      const reach = mix(0.05, 0.42, smoothstep(0.1, EMBER_LAND, p))
      return float(1).div(d.div(reach).pow(2).add(1)).mul(smoothstep(0.02, 0.2, p)) as F
    }

    // ---- behind the ash: the day going out, the next frame coming up in the ember's light, the ember
    const bgMat = new THREE.NodeMaterial()
    bgMat.vertexNode = vec4(positionGeometry.xy, 0, 1)
    bgMat.fragmentNode = Fn(() => {
      const uv = positionGeometry.xy.mul(0.5).add(0.5).toVarying("emUV") as V2
      const A = sampleRT(U.tA, uv).rgb.toVar()
      const B = sampleRT(U.tB, uv).rgb.toVar()
      const q = uv.sub(U.uE.xy).mul(vec2(asp, 1)).toVar()
      const d = length(q).toVar()
      // the old frame loses its light from the top down, to a blue-black
      const dark = smoothstep(0.0, 0.42, p.add(uv.y.sub(0.5).mul(0.12))).toVar()
      const lumA = dot(A, vec3(0.3, 0.6, 0.1))
      const night = mix(A, vec3(lumA).mul(vec3(0.5, 0.62, 0.9)), dark.mul(0.8)).mul(pow(dark.oneMinus(), 1.7))
      const eL = emberLight(d).toVar()
      // trunks and the branch catch the ember as silhouettes with a warm edge while there is anything left of them
      const c = night.add(A.mul(vec3(1, 0.5, 0.2)).mul(eL).mul(0.5).mul(smoothstep(0.62, 0.3, p))).toVar()
      // the new frame, where the ember's light reaches; then a ring of its own daylight opens from the blow
      const dh = length(uv.sub(U.uHit).mul(vec2(asp, 1)))
      const ring = after.mul(1.9).add(smoothstep(EMBER_LAND - 0.02, EMBER_LAND, p).mul(0.04))
      const open = smoothstep(ring, ring.sub(0.22).sub(after.mul(0.25)), dh.add(fbm(uv.mul(5)).sub(0.5).mul(0.1))).mul(step(EMBER_LAND - 0.02, p)).toVar()
      const lumB = dot(B, vec3(0.3, 0.6, 0.1))
      const byEmber = mix(vec3(lumB), B, 0.55).mul(vec3(1.15, 0.6, 0.28)).mul(eL).mul(smoothstep(0.4, 0.66, p)).mul(1.5)
      c.assign(mix(c.add(byEmber), B, open))
      // the edge of the ring is warm and bright for a moment
      c.addAssign(vec3(1, 0.62, 0.3).mul(smoothstep(0.12, 0, abs(dh.sub(ring).add(0.1))).mul(after.oneMinus().pow(2)).mul(0.3).mul(step(EMBER_LAND, p))))
      // ---- the ember itself: a coal with a crust when sharp, a disc with a brighter rim when not
      const R = emberR.add(emberB).toVar()
      const soft = max(emberB.mul(0.3), 0.0016)
      const disc = smoothstep(R, R.sub(soft), d).toVar()
      const crust = fbm(q.div(emberR).mul(1.3).add(U.uT.mul(0.3))).toVar()
      const sharp = blur.oneMinus()
      const flick = sin(U.uT.mul(23)).mul(0.08).add(sin(U.uT.mul(9.7)).mul(0.07)).add(0.9)
      const rim = smoothstep(R.mul(0.55), R, d).mul(0.3).mul(blur)
      const body = mix(vec3(1.0, 0.78, 0.42), vec3(1.0, 0.36, 0.07), smoothstep(0.35, 0.75, crust).mul(sharp).mul(0.8)).mul(flick).mul(mix(float(1.25), float(0.7), blur).add(rim))
      const halo = vec3(1, 0.42, 0.12).mul(exp(d.div(R.mul(2.4).add(0.004)).negate()).mul(0.55).add(float(0.1).div(d.div(R.mul(7).add(0.02)).pow(2).add(1))))
      const live = smoothstep(EMBER_LAND + 0.1, EMBER_LAND + 0.01, p)
      const born = smoothstep(0.0, 0.07, p)
      c.assign(mix(c, body, disc.mul(live).mul(born)).add(halo.mul(live).mul(born).mul(flick)))
      // ---- the blow: for an instant the point is a glint, four short rays and a breath of light over everything
      const hq = uv.sub(U.uHit).mul(vec2(asp, 1))
      const tl = max(land, 0)
      const fade = exp(tl.mul(-22)).mul(step(0, land))
      const star = exp(abs(hq.x).mul(-18)).mul(exp(abs(hq.y).mul(-260))).add(exp(abs(hq.y).mul(-22)).mul(exp(abs(hq.x).mul(-260)))).add(exp(length(hq).mul(-60)).mul(1.5))
      c.addAssign(vec3(1, 0.86, 0.62).mul(star).mul(fade).mul(1.6).add(vec3(1, 0.7, 0.4).mul(fade).mul(0.16)))
      return vec4(c, 1)
    })()
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0

    // ---- the ash: flakes with depth
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    {
      const r = rng(1112)
      const a = new Float32Array(ASH * 4), b = new Float32Array(ASH * 4)
      for (let i = 0; i < ASH; i++) {
        // more of them far than near; x across the frame and beyond, a phase down it
        a.set([r() * 1.3 - 0.15, r(), 0.1 + 0.9 * Math.sqrt(r()), r()], i * 4)
        b.set([r() * 6.283, 0.5 + r(), r() * 6.283, r()], i * 4)
      }
      geo.setAttribute("aG", new THREE.InstancedBufferAttribute(a, 4))
      geo.setAttribute("aH", new THREE.InstancedBufferAttribute(b, 4))
      geo.instanceCount = ASH
    }
    const aG = attribute("aG", "vec4") as V4, aH = attribute("aH", "vec4") as V4
    const G = (() => {
      const z = aG.z
      const tt = p.mul(EMBER_DUR)
      // falling at its own pace (near flakes cross the frame faster), sidling and tumbling
      const y0 = fract(aG.y.sub(tt.mul(aH.y).mul(0.045).div(z))).toVar()
      const x0 = aG.x.add(sin(tt.mul(0.7).mul(aH.y).add(aH.x)).mul(0.012).div(z))
      // the blow pushes what is left of them outward from the stone
      const from = vec2(x0, y0).sub(U.uHit).toVar()
      const push = float(1).sub(exp(max(land, 0).mul(-9))).mul(0.22).div(z.add(0.3)).mul(step(0, land))
      const c = vec2(x0, y0).add(from.div(length(from).add(0.05)).mul(push)).toVar()
      // the plane of focus follows the ember in; a flake is as big as it is near and as soft as it is out of focus
      const zf = U.uE.z
      const coc = abs(float(1).div(z).sub(float(1).div(zf))).mul(0.0028)
      const rad = float(0.0022).div(z).mul(aG.w.mul(0.7).add(0.65)).add(coc).toVar()
      const tumble = sin(tt.mul(2.2).mul(aH.y).add(aH.z)).mul(0.35).add(0.65)
      // they thin: each has its own moment to be gone
      const gone = smoothstep(0.08, 0.7, p).mul(1.02)
      const keep = smoothstep(gone, gone.add(0.05), aH.w.mul(0.86).add(0.1)).mul(smoothstep(0, 0.06, p)).mul(after.oneMinus().pow(1.5))
      // light: the last of the day, and the ember (in the flakes' own space: frame x and y, and depth)
      const de = vec3(c.sub(U.uE.xy).mul(vec2(asp, 1)), z.sub(zf).mul(0.55))
      const eL = float(0.012).div(dot(de, de).add(0.006)).mul(smoothstep(0.03, 0.2, p)).mul(smoothstep(EMBER_LAND + 0.08, EMBER_LAND, p))
      const day = pow(smoothstep(0.45, 0.0, p), 1.5)
      const q = positionGeometry.xy
      const clip = vec4(c.add(q.mul(vec2(rad.div(asp), rad.mul(tumble.mul(0.5).add(0.5))))).mul(2).sub(1), 0, 1)
      return { clip, vQ: q.toVarying("emQ"), vK: vec4(keep, eL, day, rad.div(coc.add(0.0006))).toVarying("emK"), vS: vec2(aH.w, z).toVarying("emS") }
    })()
    const ashMat = new THREE.NodeMaterial()
    ashMat.vertexNode = G.clip
    ashMat.fragmentNode = Fn(() => {
      const q = G.vQ as V2
      const k = G.vK as V4
      const d = length(q)
      // sharp when in focus, a soft disc when not; light spread over a bigger disc is dimmer
      const edge = clamp(float(1.6).div(k.w), 0.08, 0.9)
      const disc = smoothstep(1, float(1).sub(edge), d)
      const dim = clamp(k.w.mul(0.16), 0.12, 1)
      const grey = vec3(0.66, 0.66, 0.68).mul(vnoise(q.mul(3).add((G.vS as V2).x.mul(40))).mul(0.3).add(0.8))
      const col = grey.mul(k.z.mul(0.9)).add(vec3(1, 0.5, 0.17).mul(k.y)) as V3
      const a = disc.mul(k.x).mul(dim).mul(clamp(k.z.mul(0.85).add(k.y.mul(1.4)), 0, 1))
      return vec4(col.mul(a), a.mul(clamp(k.z.add(0.25), 0, 1)))
    })()
    Object.assign(ashMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    const ash = new THREE.Mesh(geo, ashMat)
    ash.frustumCulled = false
    ash.renderOrder = 1

    const scene = new THREE.Scene()
    scene.add(bg, ash)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const e: [number, number, number] = [0, 0, 1]

    return {
      render(a) {
        const { w, h } = ctx.size()
        U.uRes.value.set(w, h)
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        U.uT.value = a.pl * EMBER_DUR
        emberAt(a.pl, e)
        U.uE.value.set(e[0], e[1], e[2])
        U.uHit.value.set(EMBER_HIT.x, EMBER_HIT.y)
        const r = ctx.renderer
        r.setRenderTarget(a.out)
        r.render(scene, cam)
      },
      warm: () => [{ scene, camera: cam, target: hold }],
      dispose() {
        geo.dispose()
        bg.geometry.dispose()
        bgMat.dispose()
        ashMat.dispose()
      },
    }
  },
}
export default t
