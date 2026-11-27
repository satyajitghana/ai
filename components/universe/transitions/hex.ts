// 5 → 6. The telescope's mirror re-points, one segment at a time. The 18 gold segments in the
// outgoing picture become 18 real hexagonal prisms laid exactly over it (through the outgoing
// scene's portal quad, so the first frame is the still). Each swings out on its actuators, its
// reflection sliding off as it turns, a glint crossing the gold at the top of the swing; when it
// comes back, overshooting and settling like a sprung mass, it is a window on the next scene.
// Inner ring first, then the outer ring going round. When the last one locks, light runs out
// through the seams, the seams weld shut and the lens goes through the mirror.
//
// Everything is closed-form in the transition's linear progress: segment k starts at T_K(k), swings
// for SWING, and the last lock lands on `inAt`, where the galaxy's first beat starts.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp, cos, dot, exp, float, Fn, length, max, mix, normalGeometry, normalize, positionGeometry, pow, screenUV, select, sin, smoothstep, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { portalMatrix } from "../engine/quad"
import { H, type Pos, type Synth } from "../engine/synth"
import { sampleRT, sat, toLinear, toSRGB, type F, type V2, type V3 } from "../engine/tsl"
import type { Portal, TransitionDef } from "../engine/types"

const DUR = 3.3
const LOCK = 0.72 // the last segment locks; the galaxy's clock starts
const SWING = 0.3 // of the transition, per segment
const T_FIRST = 0.03
const PEAK = 0.42 // of a swing: the top, where the reflection changes
const T_K = (k: number) => T_FIRST + (LOCK - SWING - T_FIRST) * (k / 17) ** 0.88

/**
 * The mirror: 18 flat-topped hexagons of circumradius 1 in columns of 3, 4, 4, 4, 3 (rings 1 and 2
 * of a hex grid, the centre missing), in the order they move. `HEX_BOX` is the half-size of the
 * rectangle a scene should report as its portal for the segments to land on its picture.
 */
export const HEX_BOX: [number, number] = [4.2, 2.5 * Math.sqrt(3) + 0.2]
export const HEX_LAYOUT: { x: number; y: number; ring: number }[] = (() => {
  const out: { x: number; y: number; ring: number; a: number }[] = []
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))
      if (d < 1 || d > 2) continue
      const x = 1.5 * q, y = Math.sqrt(3) * (r + q / 2)
      out.push({ x, y, ring: d, a: (Math.atan2(y, x) + Math.PI * 2.5) % (Math.PI * 2) })
    }
  return out.sort((p, q) => p.ring - q.ring || p.a - q.a)
})()
/** Where the mirror is taken to be when the outgoing scene reports no portal (uv: centre, half-height). */
const FALLBACK = { cx: 0.62, cy: 0.48, hh: 0.33 }

// Sound (sheet: beats/sound-hex.md), all on the transition's own progress. Home harmonic 7 going
// to 8. Each segment is three sounds where it stands on the mirror: its actuators letting go, the
// glint at the top of its swing (a harmonic above the last), and its lock.
const snd: NonNullable<TransitionDef["snd"]> = [{ s: "whoosh", o: { f: H(7), dur: 2.2, g: 0.4 } }]
for (let k = 0; k < 18; k++) {
  // (the mirror where FALLBACK has it: 0.082 of the frame's half-width per unit across, 0.146 up)
  const pos: Pos = [0.24 + HEX_LAYOUT[k].x * 0.082, -0.04 + HEX_LAYOUT[k].y * 0.146, 0.2]
  snd.push({ s: "tick", p: T_K(k), o: { f: H(56 + k), g: 0.35, pos } })
  snd.push({ s: "glass", p: T_K(k) + SWING * PEAK, o: { f: H(21 + k), g: 0.2 + k * 0.012, pos } })
  if (k < 17) snd.push({ s: "knap", p: T_K(k) + SWING, o: { f: H(48 + k * 2), g: 0.22 + k * 0.008, pos } })
}
// the last one locks: light runs out through the seams, they weld shut, and the lens goes through the mirror
snd.push(
  { s: "knap", p: LOCK, o: { f: H(96), g: 0.5, pos: [0.24, -0.04, 0.2] } },
  { s: "bell", p: LOCK, o: { f: H(16), g: 0.7, pos: [0.24, -0.04, 0.2] } },
  { s: "sub", p: LOCK, o: { f: H(2), dur: 2, g: 0.7, lfe: 1 } },
  { s: "sizzle", p: LOCK + 0.01, o: { dur: 0.9, g: 0.45, pos: [0.24, -0.04, 0.1] } },
  { s: "shimmer", p: LOCK + 0.02, o: { f: H(48), dur: 2, g: 0.3 } },
  { s: "whoosh", p: LOCK + 0.03, o: { f: H(4), dur: 1.1, g: 0.6 } },
  { s: "pad", p: LOCK + 0.04, o: { f: H(8), dur: 6, g: 0.45 } },
)
/** The actuators' hum as a bed: on while segments are moving, off at the weld. */
function sound(pl: number, _prev: number, synth: Synth) {
  const on = Math.min(1, pl / 0.08) * (1 - Math.min(1, Math.max(0, (pl - LOCK) / 0.06)))
  if (on > 0) synth.bed("hum", 0.6 * on)
}

const t: TransitionDef = {
  id: "hex",
  dur: DUR,
  inAt: LOCK,
  ease: (x) => x,
  snd,
  sound,
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tM: uniformTexture(rt.texture),
      p: uniform(0),
      uAsp: uniform(16 / 9),
      uHf: uniform(new THREE.Matrix3()), // mirror uv (0..1 over HEX_BOX) → clip
      uCm: uniform(new THREE.Vector2()), // the mirror's centre, in units of half the frame's height
      uZoom: uniform(1),
      uShift: uniform(0),
      uWeld: uniform(0),
      uFlash: uniform(0),
      uRing: uniform(-1),
      uUnit: uniform(0.08), // one mirror unit, in the same units
    }
    const p = U.p

    // ---- one prism: a face, a bevel, six sides (non-indexed, flat normals; `aPart` 0 face, 1 bevel, 2 side)
    const pos: number[] = [], nrm: number[] = [], part: number[] = []
    const BEV = 0.9, ZB = -0.07, ZT = -0.36
    const hx = (i: number, r: number, z: number): [number, number, number] => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r, z]
    const tri = (a: number[], b: number[], c: number[], n: number[], pt: number) => {
      pos.push(...a, ...b, ...c)
      nrm.push(...n, ...n, ...n)
      part.push(pt, pt, pt)
    }
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6
      tri([0, 0, 0], hx(i, BEV, 0), hx(j, BEV, 0), [0, 0, 1], 0)
      const am = ((i + 0.5) * Math.PI) / 3
      const nb = [Math.cos(am) * 0.57, Math.sin(am) * 0.57, 0.82]
      tri(hx(i, BEV, 0), hx(i, 1, ZB), hx(j, 1, ZB), nb, 1)
      tri(hx(i, BEV, 0), hx(j, 1, ZB), hx(j, BEV, 0), nb, 1)
      const ns = [Math.cos(am), Math.sin(am), 0]
      tri(hx(i, 1, ZB), hx(i, 1, ZT), hx(j, 1, ZT), ns, 2)
      tri(hx(i, 1, ZB), hx(j, 1, ZT), hx(j, 1, ZB), ns, 2)
    }
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nrm), 3))
    geo.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(part), 1))
    const inst = new Float32Array(18 * 4)
    HEX_LAYOUT.forEach((h, k) => inst.set([h.x, h.y, T_K(k), k], k * 4))
    geo.setAttribute("aC", new THREE.InstancedBufferAttribute(inst, 4))
    geo.instanceCount = 18
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

    const aC = attribute("aC", "vec4"), aPart = attribute("aPart", "float")
    const asp2 = vec2(U.uAsp, 1)
    /** A point of the mirror plane (mirror units) → where it is on screen, in half-frame-heights. */
    const place = (m: V2): V2 => {
      const q = U.uHf.mul(vec3(m.div(vec2(HEX_BOX[0] * 2, HEX_BOX[1] * 2)).add(0.5), 1))
      return q.xy.div(q.z).mul(asp2) as V2
    }
    // the swing: out to the top, then back as a damped spring that overshoots flat and settles on it
    const x = sat(p.sub(aC.z).div(SWING) as F)
    const outp = sat(x.div(PEAK) as F)
    const u = sat(x.sub(PEAK).div(1 - PEAK) as F)
    const AMAX = 1.12
    const alpha = select(x.lessThan(PEAK), sin(outp.mul(Math.PI / 2)).mul(AMAX), exp(u.mul(-3.6)).mul(cos(u.mul(Math.PI * 2.5))).mul(AMAX).mul(smoothstep(0.82, 1, u).oneMinus()))
    const act = smoothstep(0, 0.05, x)
    const rhat = normalize(aC.xy)
    const axis = vec3(rhat.y.negate(), rhat.x, 0)
    const rod = (o: V3): V3 => {
      const c = cos(alpha), s = sin(alpha)
      return o.mul(c).add(axis.cross(o).mul(s)).add(axis.mul(dot(axis, o)).mul(c.oneMinus())) as V3
    }
    const prism = (scale: F, flat: boolean) => {
      const Sc = place(aC.xy as V2)
      const S = place(aC.xy.add(positionGeometry.xy.mul(scale)) as V2)
      const o = vec3(S.sub(Sc), positionGeometry.z.mul(U.uUnit))
      const q = flat ? vec3(S, U.uUnit.mul(ZT)) : vec3(Sc, 0).add(rod(o as V3))
      const xy = q.xy.sub(U.uCm).mul(U.uZoom).add(U.uCm.mul(U.uShift.oneMinus()))
      const w = float(3.2).sub(q.z.mul(U.uZoom)).div(3.2)
      return { clip: vec4(xy.div(w).div(asp2), float(0.5).sub(q.z.mul(0.25)), 1), rest: S.div(asp2).mul(0.5).add(0.5) }
    }
    const gapK = mix(0.97, 1.012, U.uWeld)
    const V = prism(gapK as F, false)
    const vRest = V.rest.toVarying()
    const vN = rod(normalGeometry as V3).toVarying()
    const vK = vec4(alpha, x, act, aPart).toVarying()
    const vR = vec4(rhat, length(aC.xy), aC.w).toVarying()
    const uvS = vec2(screenUV.x, screenUV.y.oneMinus())
    const cl = (q: V2): V2 => clamp(q, 0.002, 0.998) as V2
    const GOLD = vec3(1.0, 0.71, 0.29)

    const prismMat = new THREE.NodeMaterial()
    prismMat.vertexNode = V.clip
    prismMat.fragmentNode = Fn(() => {
      const al = vK.x, xx = vK.y, a = vK.z, pt = vK.w
      const n = normalize(vN).toVar()
      const a0 = toLinear(sampleRT(U.tA, uvS).rgb)
      const b0 = toLinear(sampleRT(U.tB, uvS).rgb).toVar()
      // a tilted mirror shows what is off to one side: the reflection slides along the tilt
      const sl = vR.xy.div(asp2).mul(al)
      const picA = toLinear(sampleRT(U.tA, cl(vRest.add(sl.mul(0.2)) as V2)).rgb)
      const picB = toLinear(sampleRT(U.tB, cl(uvS.add(sl.mul(0.16)) as V2)).rgb)
      const isB = step(PEAK, xx)
      const settled = smoothstep(0.8, 1, xx)
      const tint = mix(vec3(1), GOLD.mul(1.25), mix(float(0.15), 0.5, isB).mul(settled.mul(0.55).oneMinus()))
      // the glint: the sun crosses the face as the segment passes one angle, out and back
      const g = al.sub(0.7).div(0.1)
      const glint = exp(g.mul(g).negate()).mul(a)
      const L = normalize(vec3(-0.35, 0.5, 0.8))
      const ndl = sat(dot(n, L) as F)
      const face = mix(picA, picB, isB).mul(tint).mul(cos(al).mul(0.45).add(0.55)).add(GOLD.mul(glint).mul(1.5)).add(vec3(1, 0.95, 0.85).mul(pow(glint, 3)).mul(2.2))
      const flash = U.uFlash.mul(3.5)
      const bevel = GOLD.mul(pow(ndl, 6).mul(1.5).add(0.1).add(glint.mul(0.8)).add(flash))
      const side = vec3(0.1, 0.105, 0.115).mul(ndl.mul(0.9).add(0.12)).add(GOLD.mul(0.05))
      const sh = select(pt.lessThan(0.5), face, select(pt.lessThan(1.5), bevel, side)).toVar()
      // the lock: a ring of light runs out across the faces
      const rr = vR.z.add(dot(vRest.sub(0.5), vec2(0)))
      const ring = exp(pow(rr.sub(U.uRing).div(0.5), 2).negate()).mul(step(0, U.uRing)).mul(exp(U.uRing.mul(-0.4)))
      sh.addAssign(GOLD.mul(ring).mul(select(pt.lessThan(0.5), 0.3, 1.6)).mul(U.uWeld.oneMinus()))
      const c = mix(mix(a0, sh, a), b0, U.uWeld)
      return vec4(toSRGB(c), 1)
    })()
    // (transparent only so that it is drawn after the backplane: three draws opaque things first)
    Object.assign(prismMat, { transparent: true, depthTest: true, depthWrite: true })
    const prisms = new THREE.Mesh(geo, prismMat)
    prisms.frustumCulled = false
    prisms.renderOrder = 2

    // ---- what is behind a segment that has moved: the dark backplane
    const HV = prism(float(1.03), true)
    const holeMat = new THREE.NodeMaterial()
    holeMat.vertexNode = HV.clip
    const vH = vec2(act, aPart).toVarying()
    holeMat.fragmentNode = Fn(() => {
      const d = max(abs(positionGeometry.x), abs(positionGeometry.y)).toVarying()
      const c = vec3(0.004, 0.005, 0.008).add(vec3(0.02, 0.016, 0.01).mul(smoothstep(0.5, 1, d)))
      return vec4(toSRGB(c), vH.x.mul(U.uWeld.oneMinus()).mul(step(vH.y, 0.5)))
    })()
    Object.assign(holeMat, { transparent: true, depthTest: false, depthWrite: false })
    const holes = new THREE.Mesh(geo, holeMat)
    holes.frustumCulled = false
    holes.renderOrder = 1

    // ---- everything outside the mirror: the old frame, then the new one
    const bgMat = new THREE.NodeMaterial()
    bgMat.vertexNode = vec4(positionGeometry.xy.mul(2), 0.999, 1)
    bgMat.fragmentNode = Fn(() => {
      const k = smoothstep(LOCK - 0.06, 0.95, p)
      return vec4(mix(sampleRT(U.tA, uvS).rgb, sampleRT(U.tB, uvS).rgb, k), 1)
    })()
    Object.assign(bgMat, { depthTest: false, depthWrite: false })
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0
    const scene = new THREE.Scene()
    scene.add(bg, holes, prisms)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const blit = ctx.pass(({ uv }) => vec4(sampleRT(U.tM, uv).rgb, 1), U)
    const quad: Portal["c"] = [[0, 0], [0, 0], [0, 0], [0, 0]]
    const sm = (a: number, b: number, v: number) => {
      const q = Math.min(1, Math.max(0, (v - a) / (b - a)))
      return q * q * (3 - 2 * q)
    }

    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        // where the mirror is: the outgoing scene's portal, or the place its design gives
        let c = a.pa?.c
        if (!c) {
          const hw = (FALLBACK.hh * HEX_BOX[0]) / HEX_BOX[1] / asp
          const x0 = (FALLBACK.cx - hw) * 2 - 1, x1 = (FALLBACK.cx + hw) * 2 - 1, y0 = (FALLBACK.cy - FALLBACK.hh) * 2 - 1, y1 = (FALLBACK.cy + FALLBACK.hh) * 2 - 1
          quad[0][0] = x0; quad[0][1] = y1; quad[1][0] = x1; quad[1][1] = y1; quad[2][0] = x1; quad[2][1] = y0; quad[3][0] = x0; quad[3][1] = y0
          c = quad
        }
        portalMatrix(c, U.uHf.value).invert()
        const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4
        U.uCm.value.set(cx * asp, cy)
        U.uUnit.value = (Math.hypot((c[0][0] - c[3][0]) * asp, c[0][1] - c[3][1]) / (HEX_BOX[1] * 2))
        U.uAsp.value = asp
        U.tA.value = a.A
        U.tB.value = a.B
        const pl = a.pl
        U.p.value = pl
        // the lens creeps in while they turn, takes the knock of the lock, then goes through
        const after = Math.max(0, pl - LOCK) * DUR
        const go = sm(LOCK + 0.01, 1, pl)
        U.uZoom.value = 1 + 0.05 * sm(0, LOCK, pl) - (pl > LOCK ? 0.03 * Math.exp(-after * 7) * Math.cos(after * 16) : 0) + 2.4 * go * go
        U.uShift.value = go
        U.uWeld.value = sm(LOCK + 0.03, 0.94, pl)
        U.uFlash.value = pl > LOCK ? Math.exp(-after * 5) : 0
        U.uRing.value = pl > LOCK ? after * 9 : -1
        const r = ctx.renderer
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tM.value = rt.texture
        blit.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: rt },
        { pass: blit, target: hold },
      ],
      dispose() {
        geo.dispose()
        bg.geometry.dispose()
        prismMat.dispose()
        holeMat.dispose()
        bgMat.dispose()
        blit.dispose()
      },
    }
  },
}
export default t
