// 6 → 7. The dive. The galaxy ends with the selection box on one ordinary star and reports the box
// as its portal. The lens falls into it: the outgoing frame is zoomed about the box on an
// accelerating curve and every star in it smears along its radius by exactly the zoom it has just
// gone through. Inside the box is where that star came from: a dark cloud core, turning, flattening
// into a disk as it falls in on itself, its centre going from dull red to bright. Dust streams out
// past the lens (instanced grains in a perspective tunnel, drawn out into streaks by the speed).
// Then the star lights: a flat white burn with a lens streak. Under the burn the picture changes to
// the incoming scene, whose own camera is already falling toward the plain (scenes/impact.ts runs
// its clock from -dur * inAt); the smear here follows that fall and is gone when it lands. The
// landing is `inAt`: from there the scene answers on its own clock (a spring, dust, a flare).
//
// What crosses the cut: the selected star, then its dust, and the dust is what we land on.
// Everything is closed-form in the transition's linear progress.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, clamp, cos, exp, float, Fn, If, length, Loop, max, mix, normalize, positionGeometry, screenUV, sin, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { H } from "../engine/synth"
import { fbm, hash21, sampleRT, sat, toLinear, toSRGB, type F, type V2 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

const DUR = 3.3
const LAND = 0.8 // the lens hits the ground: the next scene's clock zero
const LIGHT = 0.5 // the star lights
const N_GRAIN = 900
/** If the galaxy reports no portal: a 16:9 box 15 % of the frame wide, right of centre (uv). */
const FALLBACK = { cx: 0.6, cy: 0.5, h: 0.075 }

const sm = (a: number, b: number, v: number) => {
  const q = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return q * q * (3 - 2 * q)
}
const ssr = (e0: number, e1: number, x: THREE.Node<"float">): F => {
  const t = clamp(float(e0).sub(x).div(e0 - e1), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

const t: TransitionDef = {
  id: "dive",
  dur: DUR,
  inAt: LAND,
  ease: (x) => x,
  snd: [
    { s: "select", o: { g: 0.6 } },
    { s: "whoosh", o: { f: 140, dur: DUR * LIGHT, g: 0.8 } },
    { s: "riser", o: { dur: DUR * LIGHT, g: 0.8 } },
    { s: "rumble", o: { f: 60, dur: DUR * LIGHT * 1.1, g: 0.5 } },
    // the star lights
    { s: "bell", o: { f: H(16), g: 0.7 }, p: LIGHT },
    { s: "thud", o: { f: 110, g: 0.8 }, p: LIGHT },
    { s: "shimmer", o: { f: H(40), g: 0.3 }, p: LIGHT + 0.01 },
    // the fall
    { s: "whoosh", o: { f: 500, dur: DUR * (LAND - LIGHT), g: 0.7 }, p: LIGHT + 0.02 },
    { s: "hiss", o: { dur: DUR * (LAND - LIGHT), g: 0.5 }, p: LIGHT + 0.03 },
    // (the landing's thud and sub are the scene's own first cues)
  ],
  sound(pl, _prev, synth) {
    synth.bed("wind", pl < LAND ? Math.min(1, pl / LIGHT) * 0.8 : 0)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tM: uniformTexture(rt.texture),
      uAsp: uniform(16 / 9),
      uRes: uniform(new THREE.Vector2(1280, 720)),
      uC: uniform(new THREE.Vector2(0.5, 0.5)), // the box's centre (uv)
      uPh: uniform(new THREE.Vector2(0.075, 0.075)), // its half-size (uv)
      uZ: uniform(1), // zoom of the outgoing frame about the box
      uBlurA: uniform(0),
      uHole: uniform(0),
      uNs: uniform(0.05), // the cloud's size (frame heights)
      uFlat: uniform(1),
      uSpin: uniform(0),
      uCore: uniform(0.1),
      uToB: uniform(0),
      uBlurB: uniform(0),
      uFlash: uniform(0),
      // grains
      uTravel: uniform(0),
      uStreak: uniform(0.01),
      uGrain: uniform(0),
      uLit: uniform(0),
      uGC: uniform(new THREE.Vector2()), // the tunnel's vanishing point (clip)
    }
    const uvS = vec2(screenUV.x, screenUV.y.oneMinus())
    const cl = (q: V2): V2 => clamp(q, 0.001, 0.999) as V2

    // ---- the cloud that the star came from, seen down its axis and then from inside
    const cloud = Fn(([n_]: [V2]) => {
      const n = vec2(n_.x, n_.y.div(U.uFlat)).toVar()
      const r = length(n).toVar()
      const ang = atan(n.y, n.x).add(U.uSpin.div(r.add(0.35)))
      const sw = vec2(cos(ang), sin(ang)).mul(r).toVar()
      const dens = fbm(sw.mul(2.3).add(vec2(3.1, 1.7))).toVar()
      const lanes = fbm(sw.mul(5.5).add(dens.mul(2.2)).add(9.4)).toVar()
      const body = ssr(1.5, 0.15, r.add(dens.sub(0.5).mul(0.8))).mul(dens.mul(1.2).add(0.25))
      const core = exp(r.mul(r).div(U.uCore.mul(U.uCore)).negate())
      const light = U.uCore.mul(U.uCore).mul(6).div(r.mul(r).add(0.02))
      const coreCol = mix(vec3(1.0, 0.16, 0.03), vec3(1.0, 0.86, 0.66), sat(U.uCore.mul(2.2).sub(0.25) as F))
      const dust = vec3(0.3, 0.15, 0.085).mul(body).mul(lanes.mul(0.85).oneMinus()).mul(light.add(0.035))
      return dust.mul(coreCol.add(0.25)).add(coreCol.mul(core).mul(U.uCore.mul(6).add(0.4)))
    })

    const bgMat = new THREE.NodeMaterial()
    bgMat.vertexNode = vec4(positionGeometry.xy.mul(2), 0.999, 1)
    bgMat.fragmentNode = Fn(() => {
      const uv = uvS
      const col = vec3(0).toVar()
      const jit = hash21(uv.mul(U.uRes).floor())
      If(U.uToB.lessThan(0.5), () => {
        // the outgoing frame, zoomed about the box, smeared by the zoom it has just been through
        const d = uv.sub(U.uC).toVar()
        const acc = vec3(0).toVar()
        Loop(14, ({ i }) => {
          const k = float(i).add(jit).div(14)
          const z = U.uZ.mul(k.mul(U.uBlurA).oneMinus())
          acc.addAssign(toLinear(sampleRT(U.tA, cl(U.uC.add(d.div(z)) as V2)).rgb))
        })
        col.assign(acc.div(14))
        // inside the box: the cloud
        const b = abs(d).div(U.uPh.mul(U.uZ)).toVar()
        const e = max(b.x, b.y)
        const inside = ssr(1.0, 0.9, e).mul(U.uHole)
        const n = d.mul(vec2(U.uAsp, 1)).div(U.uNs)
        col.assign(mix(col, cloud(n as V2), inside))
      }).Else(() => {
        // the incoming frame, already falling: smeared up and away from where it will land
        const cB = vec2(0.5, 0.36)
        const d = uv.sub(cB).toVar()
        const acc = vec3(0).toVar()
        Loop(12, ({ i }) => {
          const k = float(i).add(jit).div(12)
          acc.addAssign(toLinear(sampleRT(U.tB, cl(cB.add(d.div(k.mul(U.uBlurB).add(1))) as V2)).rgb))
        })
        col.assign(acc.div(12))
      })
      // the star lights: a flat burn and a streak across the lens
      const fy = uv.y.sub(mix(U.uC.y, float(0.5), U.uToB))
      const streak = exp(abs(fy).mul(-38)).add(exp(abs(fy).mul(-7)).mul(0.25))
      const f = U.uFlash.mul(U.uFlash.mul(0.9).add(streak.mul(0.9)))
      col.assign(mix(col, vec3(1.0, 0.97, 0.9), sat(f as F)))
      return vec4(toSRGB(col), 1)
    })()
    Object.assign(bgMat, { depthTest: false, depthWrite: false })
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0

    // ---- dust grains in a tunnel: where each is now and where it was a moment ago
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    {
      const a = new Float32Array(N_GRAIN * 4)
      let s = 90210
      const R = () => {
        s = (s * 16807) % 2147483647
        return s / 2147483647
      }
      for (let i = 0; i < N_GRAIN; i++) a.set([R() * Math.PI * 2, 0.22 + Math.pow(R(), 0.7) * 1.9, R(), R()], i * 4)
      geo.setAttribute("aG", new THREE.InstancedBufferAttribute(a, 4))
    }
    geo.instanceCount = N_GRAIN
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const aG = attribute("aG", "vec4")
    const z1 = aG.z.sub(U.uTravel).fract().mul(7).add(0.12)
    const z2 = z1.add(U.uStreak)
    const dir = vec2(cos(aG.x), sin(aG.x)).mul(aG.y)
    const asp2 = vec2(U.uAsp, 1)
    const p1 = dir.div(z1), p2 = dir.div(z2)
    const along = normalize(p1.sub(p2).add(dir.mul(1e-4)))
    const u = positionGeometry.x.mul(0.5).add(0.5)
    const wdt = aG.w.mul(aG.w).mul(0.009).add(0.0025).div(z1)
    const pos = mix(p2, p1, u).add(vec2(along.y.negate(), along.x).mul(wdt).mul(positionGeometry.y)).add(along.mul(wdt).mul(positionGeometry.x))
    const vG = vec4(positionGeometry.xy, smoothstep(0.12, 0.5, z1).mul(ssr(7.1, 4, z1)), aG.w).toVarying("dvG")
    const grainMat = new THREE.NodeMaterial()
    grainMat.vertexNode = vec4(pos.div(asp2).add(U.uGC), 0.5, 1)
    grainMat.fragmentNode = Fn(() => {
      const a = exp(vG.y.mul(vG.y).mul(-3)).mul(vG.x.mul(0.35).add(0.65)).mul(vG.z).mul(U.uGrain).toVar()
      // a silhouette until the star lights, then a lit speck
      const lit = vec3(1.0, 0.72, 0.42).mul(U.uLit).mul(vG.w.mul(0.8).add(0.4))
      const dark = vec3(0.05, 0.028, 0.018)
      return vec4(mix(dark, lit, sat(U.uLit as F)).mul(a), a.mul(mix(float(0.8), 0.35, sat(U.uLit as F))))
    })()
    Object.assign(grainMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    const grains = new THREE.Mesh(geo, grainMat)
    grains.frustumCulled = false
    grains.renderOrder = 1

    const scene = new THREE.Scene()
    scene.add(bg, grains)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const blit = ctx.pass(({ uv }) => vec4(sampleRT(U.tM, uv).rgb, 1), U)

    return {
      render(a) {
        const { w, h } = ctx.size()
        U.uAsp.value = w / h
        U.uRes.value.set(w, h)
        const c = a.pa?.c
        if (c) {
          U.uC.value.set(((c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4) * 0.5 + 0.5, ((c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4) * 0.5 + 0.5)
          U.uPh.value.set(Math.max(0.01, Math.abs(c[1][0] - c[0][0]) * 0.25), Math.max(0.01, Math.abs(c[0][1] - c[3][1]) * 0.25))
        } else {
          U.uC.value.set(FALLBACK.cx, FALLBACK.cy)
          U.uPh.value.set(FALLBACK.h, FALLBACK.h)
        }
        const pl = a.pl
        const x = Math.min(pl / LIGHT, 1)
        const Z = Math.exp(4.4 * x * x)
        U.uZ.value = Z
        U.uBlurA.value = Math.min(0.55, 1.6 * x * x)
        U.uHole.value = sm(0.02, 0.13, pl)
        U.uNs.value = U.uPh.value.y * Z * (0.75 + 3.2 * x * x)
        U.uFlat.value = 1 - 0.68 * sm(0.08, 0.4, pl)
        U.uSpin.value = 0.5 + 5.5 * x * x
        U.uCore.value = 0.07 + 0.5 * x * x * x
        const after = pl - LIGHT
        U.uFlash.value = pl < LIGHT ? Math.pow(sm(LIGHT - 0.055, LIGHT, pl), 2) * 1.2 : 1.2 * Math.exp(-after * 13) * (1 - sm(LAND - 0.1, LAND, pl))
        U.uToB.value = pl >= LIGHT ? 1 : 0
        U.uBlurB.value = 0.45 * Math.pow(1 - sm(LIGHT, LAND, pl), 1.5) * (pl < LAND ? 1 : 0)
        // the grains: faster and faster, then braking into the ground
        const v = pl < LIGHT ? 9 * x : 9 * Math.max(0, 1 - after / (LAND - LIGHT))
        U.uTravel.value = pl < LIGHT ? 2.25 * x * x : 2.25 + 9 * (after - (after * after) / (2 * (LAND - LIGHT))) * (after < LAND - LIGHT ? 1 : 0) + (after >= LAND - LIGHT ? 4.5 * (LAND - LIGHT) : 0)
        U.uStreak.value = 0.012 + v * 0.022
        U.uGrain.value = sm(0.1, 0.24, pl) * (1 - sm(LIGHT + 0.06, LAND - 0.06, pl))
        U.uLit.value = pl < LIGHT ? sm(LIGHT - 0.03, LIGHT, pl) * 2 : 0.35 + 1.6 * Math.exp(-after * 16)
        const toB = sm(LIGHT - 0.02, LIGHT + 0.12, pl)
        U.uGC.value.set((U.uC.value.x * 2 - 1) * (1 - toB), (U.uC.value.y * 2 - 1) * (1 - toB) + -0.28 * toB)
        U.tA.value = a.A
        U.tB.value = a.B
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
        bgMat.dispose()
        grainMat.dispose()
        blit.dispose()
      },
    }
  },
}
export default t
