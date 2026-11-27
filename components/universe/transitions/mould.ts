// 14 → 15. Mould.
//
// `tablet` ends on a clay tablet in a hand. Here the frame itself is the clay: its picture becomes
// a relief in the face of a slab, the slab is drawn out, stood upright and set down as the far
// valve of a two-part mould, in the workshop that is already there behind it. The second valve
// comes in from the right lying open (its inner face carries the mirror of the relief) and swings
// shut on its long edge. It seats at MOULD_SEAT: dust from the seam, the frame shudders. The pair
// then gives way to the scene's own bound and wrapped mould on the same spot (same MOULD, same
// PRE_CAM), which the scene cuts open; at MOULD_IN the metal lands in the cup: the scene's clock zero.
//
// What crosses the cut is the clay. Everything is closed-form in the linear progress.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, positionWorld, cameraViewMatrix, dFdx, dFdy, dot, exp, float, Fn, max, mix, normalize, normalLocal, normalWorld, positionGeometry, positionLocal, smoothstep, step, uniform, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, rng } from "../engine/ease"
import { H } from "../engine/synth"
import { aces, fbm, luma, sampleRT, toLinear, toSRGB, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const MOULD_DUR = 3.2
/** The metal lands in the cup: metal's clock zero. */
export const MOULD_IN = 0.72
/** The second valve seats. */
export const MOULD_SEAT = 0.5
/** The mould in the scene's world (metres): centre x, foot y, and one inner valve's width, height and depth. The parting plane is z = 0. */
export const MOULD = { x: 0.12, y0: -0.04, w: 0.15, h: 0.62, d: 0.05 }
/** The lens the scene holds until the pour: square on to the parting plane. */
export const PRE_CAM = { fov: 30, pos: [0.12, 0.36, 1.773] as const, look: [0.12, 0.36, 0] as const }

/** A box with rounded edges, centred, from a subdivided cube (normals included). */
export function roundBox(w: number, h: number, d: number, r: number, seg = 5): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.round((w / r) * 0.5) + seg), Math.max(2, Math.round((h / r) * 0.5) + seg), Math.max(2, Math.round((d / r) * 0.5) + seg))
  const p = g.attributes.position as THREE.BufferAttribute
  const n = g.attributes.normal as THREE.BufferAttribute
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const ix = clamp(x, -hx, hx), iy = clamp(y, -hy, hy), iz = clamp(z, -hz, hz)
    let dx = x - ix, dy = y - iy, dz = z - iz
    const l = Math.hypot(dx, dy, dz)
    if (l < 1e-9) continue
    dx /= l
    dy /= l
    dz /= l
    p.setXYZ(i, ix + dx * r, iy + dy * r, iz + dz * r)
    n.setXYZ(i, dx, dy, dz)
  }
  return g
}

const ss = (a: number, b: number, x: F): F => smoothstep(a, b, x) as F
const NDUST = 170

const t: TransitionDef = {
  id: "mould",
  dur: MOULD_DUR,
  inAt: MOULD_IN,
  ease: E.lin,
  snd: [
    { s: "squelch", p: 0.02, o: { g: 0.5, pos: [0, 0, 0.1] } },
    { s: "scratch", p: 0.1, o: { f: 160, dur: 0.5, g: 0.2, pos: [0, 0.1, 0.3] } },
    { s: "whoosh", p: 0.36, o: { f: 150, dur: 0.42, g: 0.4, pos: [0.55, 0, -0.1] } },
    { s: "thud", p: MOULD_SEAT, o: { f: 74, g: 1, pos: [0.02, -0.05, 0.15] } },
    { s: "sub", p: MOULD_SEAT, o: { g: 0.7 } },
    { s: "knap", p: MOULD_SEAT + 0.006, o: { f: H(9), g: 0.5, pos: [0.02, -0.05, 0.15] } },
    { s: "scratch", p: 0.6, o: { f: 420, dur: 0.3, g: 0.22, pos: [0.02, 0.3, 0.2] } },
    { s: "riser", p: MOULD_IN - 0.45 / MOULD_DUR, o: { dur: 0.45, g: 0.22 } },
  ],
  create(ctx) {
    const layer = ctx.target({ hdr: false, depth: true, samples: 4 })
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(PRE_CAM.fov, 16 / 9, 0.05, 20)
    cam.position.set(...PRE_CAM.pos)
    cam.lookAt(...PRE_CAM.look)
    const U = { tA: uniformTexture(hold.texture), tB: uniformTexture(hold.texture), tL: uniformTexture(layer.texture), p: uniform(0), clay: uniform(0), dark: uniform(0), shake: uniform(new THREE.Vector2()), seam: uniform(0), sprue: uniform(0), zoom: uniform(0) }
    const SUN = new THREE.Vector3(-0.5, 0.62, 0.6).normalize()

    /** Clay with the old frame pressed into its face. `mirror`: the other valve's inner face (it looks along -z and reads reversed). */
    const clayMat = (mirror: boolean) => {
      const m = new THREE.NodeMaterial()
      m.fragmentNode = Fn(() => {
        const pl = positionLocal
        const fu = mirror ? vec2(pl.y.add(0.5), pl.x.add(0.5)) : vec2(pl.x.add(0.5), pl.y.add(0.5))
        const A = sampleRT(U.tA, fu as V2).rgb.toVar()
        const face = (mirror ? ss(-0.5, -0.9, normalLocal.z as F) : ss(0.5, 0.9, normalLocal.z as F)).toVar()
        // the picture is the height: dark is deep
        const o = float(0.006)
        const As = luma(A).add(luma(sampleRT(U.tA, fu.add(vec2(o, 0)) as V2).rgb)).add(luma(sampleRT(U.tA, fu.sub(vec2(o, 0)) as V2).rgb)).add(luma(sampleRT(U.tA, fu.add(vec2(0, o)) as V2).rgb)).add(luma(sampleRT(U.tA, fu.sub(vec2(0, o)) as V2).rgb)).div(5)
        const hgt = As.mul(face).toVar()
        const N = normalize(normalWorld.add(vec3(dFdx(hgt), dFdy(hgt), 0).mul(mirror ? 7 : -7).mul(U.clay))).toVar()
        const g = fbm(pl.xy.mul(vec2(46, 30)).add(pl.z.mul(9))).toVar()
        const alb = mix(vec3(0.5, 0.39, 0.28), vec3(0.66, 0.55, 0.42), g).mul(mix(float(1), hgt.mul(0.5).add(0.62), face)).toVar()
        const ndl = max(dot(N, vec3(SUN.x, SUN.y, SUN.z)), 0)
        // daylight where the tablet was; by the time it is a valve it stands in the workshop's dark, lit by the furnace on its right
        // in the workshop: the furnace behind it on the right, its glow wrapping round the edges; the doorway's cold from the left
        const toF = vec3(0.66, 0.42, -0.38).sub(positionWorld).toVar()
        const fire = max(dot(N, normalize(toF)).add(0.35).div(1.35), 0).div(dot(toF, toF).mul(2.2).add(0.15)).mul(3.2)
        const cold = max(dot(N, vec3(-0.75, 0.2, 0.62)), 0).mul(0.05)
        const day = vec3(1.5, 1.4, 1.22).mul(ndl).add(vec3(0.3, 0.34, 0.42).mul(N.y.mul(0.3).add(0.7)))
        const lit = alb.mul(mix(day, vec3(0.9, 0.42, 0.13).mul(fire).add(vec3(0.5, 0.62, 0.85).mul(cold)).add(vec3(1.0, 0.55, 0.2).mul(max(dot(N, vec3(0.25, 0.55, 0.8)), 0)).mul(ss(0.25, 0.5, U.p)).mul(0.08)).add(vec3(0.012, 0.014, 0.02)).mul(hgt.mul(0.6).add(0.55).mul(face).add(face.oneMinus())), U.dark))
        const clay = toSRGB(aces(lit) as V3)
        // the slam: light squeezed out along the seam, then the glow of the crucible above in the sprue
        const seamZ = mirror ? ss(-0.36, -0.5, pl.z as F) : ss(0.36, 0.5, pl.z as F)
        const rim = seamZ.mul(face.oneMinus()).mul(U.seam)
        const cup = ss(0.3, 0.5, pl.y as F).mul(ss(0.32, 0.0, abs(pl.x) as F)).mul(U.sprue)
        const glow = vec3(1.0, 0.6, 0.22).mul(rim.mul(2.4).add(cup.mul(0.9)))
        return vec4(mirror ? clay.add(glow) : mix(A, clay.add(glow), max(U.clay, face.oneMinus())), 1)
      })()
      return m
    }
    const unit = roundBox(1, 1, 1, 0.07, 8)
    const matA = clayMat(false), matB = clayMat(true)
    const slabA = new THREE.Mesh(unit, matA)
    const pivot = new THREE.Group()
    const slabB = new THREE.Mesh(unit, matB)
    slabB.scale.set(MOULD.w, MOULD.h, MOULD.d)
    slabB.position.set(-MOULD.w / 2, 0, MOULD.d / 2)
    pivot.add(slabB)
    scene.add(slabA, pivot)

    // dust squeezed out of the seam when the valves meet
    const dq = new THREE.InstancedBufferGeometry()
    dq.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    dq.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    dq.setIndex([0, 1, 2, 0, 2, 3])
    const R = rng(1500)
    const dP = new Float32Array(NDUST * 4), dV = new Float32Array(NDUST * 4)
    for (let i = 0; i < NDUST; i++) {
      const side = i % 3 // left edge, right edge, top
      const u = R()
      const x = side === 2 ? (u - 0.5) * MOULD.w : (side ? 1 : -1) * MOULD.w * 0.5
      const y = side === 2 ? MOULD.h : u * MOULD.h
      dP.set([MOULD.x + x, MOULD.y0 + y, 0.01, R()], i * 4)
      const a = side === 2 ? 1.57 + (R() - 0.5) * 1.6 : (side ? 0 : Math.PI) + (R() - 0.5) * 1.2
      const sp = 0.7 + R() * 1.6
      dV.set([Math.cos(a) * sp, Math.sin(a) * sp + 0.1, (R() - 0.3) * 0.5, 0.02 + R() * 0.05], i * 4)
    }
    dq.setAttribute("aP", new THREE.InstancedBufferAttribute(dP, 4))
    dq.setAttribute("aV", new THREE.InstancedBufferAttribute(dV, 4))
    dq.instanceCount = NDUST
    const uAge = uniform(-1)
    const dustMat = new THREE.NodeMaterial()
    {
      const aP = attribute("aP", "vec4"), aV = attribute("aV", "vec4")
      const age = max(uAge.sub(aP.w.mul(0.06)), 0)
      const k = float(1).sub(exp(age.mul(-5))).div(5)
      const c = aP.xyz.add(aV.xyz.mul(k)).add(vec3(0, age.mul(age).mul(-0.25), 0))
      const sz = aV.w.mul(age.mul(3.5).add(0.9)).mul(1.15)
      dustMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(c.add(vec3(positionGeometry.xy.mul(sz), 0)), 1))
      const a = age.mul(2.6).oneMinus().max(0).mul(step(0.0001, uAge)).toVarying()
      dustMat.fragmentNode = Fn(() => {
        const d = uvAttr().sub(0.5).length().mul(2)
        const al = smoothstep(1, 0.0, d).pow(1.6).mul(a).mul(0.32)
        return vec4(vec3(0.62, 0.42, 0.26).mul(al), al)
      })()
      dustMat.transparent = true
      dustMat.depthWrite = false
      dustMat.blending = THREE.CustomBlending
      dustMat.blendSrc = THREE.OneFactor
      dustMat.blendDst = THREE.OneMinusSrcAlphaFactor
    }
    const dust = new THREE.Mesh(dq, dustMat)
    dust.frustumCulled = false
    scene.add(dust)

    const pass = ctx.pass(({ uv }) => {
      const p = U.p
      const q = uv.sub(0.5).mul(float(1).sub(U.zoom)).add(0.5).add(U.shake).toVar() as V2
      const aS = sampleRT(U.tA, uv).rgb
      const bS = sampleRT(U.tB, q).rgb
      // the workshop is there behind the slab as it is drawn out of the frame
      const col = mix(toSRGB(toLinear(sampleRT(U.tA, q).rgb as V3).mul(ss(0.3, 0.0, p).mul(0.6).add(0.4)) as V3), bS, ss(0.05, 0.3, p)).toVar()
      const L = sampleRT(U.tL, q)
      const on = ss(MOULD_SEAT + 0.07, MOULD_SEAT + 0.03, p)
      col.assign(col.mul(L.a.mul(on).oneMinus()).add(L.rgb.mul(on)))
      // the rule of ages lies over everything in both scenes: carried straight across
      const inRule = step(64 / 1920 - 0.004, uv.x).mul(step(uv.x, 1856 / 1920 + 0.004)).mul(step(1 - 1004 / 1080 - 0.006, uv.y)).mul(step(uv.y, 1 - 884 / 1080 + 0.006))
      col.assign(mix(col, mix(aS, sampleRT(U.tB, uv).rgb, ss(0.22, 0.4, p)), inRule))
      // the seat: a breath of light as the dust goes up
      // the slam: a flash of the furnace's light caught in the dust, falling off from the seam outward
      const slam = exp(max(p.sub(MOULD_SEAT), 0).mul(-22)).mul(step(MOULD_SEAT - 0.004, p))
      const fromSeam = exp(abs(uv.x.sub(0.5)).mul(-6))
      col.addAssign(vec3(0.26, 0.16, 0.08).mul(slam).mul(fromSeam.mul(0.7).add(0.3)))
      return vec4(mix(col, sampleRT(U.tB, uv).rgb, ss(MOULD_IN - 0.06, MOULD_IN, p)), 1)
    }, U)

    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), qx = new THREE.Quaternion()
    const X = new THREE.Vector3(1, 0, 0)
    return {
      render(a) {
        const { w, h } = ctx.size()
        const pl = a.pl
        cam.aspect = w / h
        cam.updateProjectionMatrix()
        // the slab: from the frame itself to the far valve, upright on its spot
        const k = E.io3(clamp(pl / 0.34))
        const d1 = 1.1
        const fh = 2 * d1 * Math.tan((PRE_CAM.fov * Math.PI) / 360)
        slabA.scale.set(fh * cam.aspect + (MOULD.h - fh * cam.aspect) * k, fh + (MOULD.w - fh) * k, 0.02 + (MOULD.d - 0.02) * k)
        slabA.position.set(PRE_CAM.pos[0] + (MOULD.x - PRE_CAM.pos[0]) * k, PRE_CAM.pos[1] + (MOULD.y0 + MOULD.h / 2 - PRE_CAM.pos[1]) * k + 0.05 * Math.sin(Math.PI * k), PRE_CAM.pos[2] - d1 + (-MOULD.d / 2 - (PRE_CAM.pos[2] - d1)) * k)
        slabA.quaternion.copy(q0).slerp(q1, k).multiply(qx.setFromAxisAngle(X, -0.5 * Math.sin(Math.PI * k)))
        U.clay.value = E.io2(clamp((pl - 0.02) / 0.2))
        U.dark.value = E.io2(clamp((pl - 0.06) / 0.26))
        // the second valve: slides in lying open, swings shut, rebounds a hair
        const kin = E.out3(clamp((pl - 0.2) / 0.16))
        const sw = E.in3(clamp((pl - 0.33) / (MOULD_SEAT - 0.33)))
        const after = Math.max(pl - MOULD_SEAT, 0)
        pivot.position.set(MOULD.x + MOULD.w / 2 + (1 - kin) * 1.3, MOULD.y0 + MOULD.h / 2 + (1 - kin) * 0.1, 0.002)
        pivot.rotation.y = (1 - sw) * 2.75 + (pl >= MOULD_SEAT ? 0.07 * Math.exp(-after * 70) * Math.abs(Math.cos(after * 150)) : 0)
        pivot.visible = pl > 0.2
        uAge.value = pl >= MOULD_SEAT ? after * MOULD_DUR : -1
        const sh = pl >= MOULD_SEAT ? Math.exp(-after * 30) * 0.012 : 0
        U.shake.value.set(sh * Math.sin(after * 260), sh * Math.cos(after * 310))
        // the slam: a ring of light along the seam, a punch of the lens, and the glow of the pour above
        U.seam.value = pl >= MOULD_SEAT ? Math.exp(-after * 18) : E.in3(clamp((pl - 0.44) / 0.06)) * 0.35
        U.zoom.value = pl >= MOULD_SEAT ? 0.035 * Math.exp(-after * 22) : 0
        U.sprue.value = E.io2(clamp((pl - MOULD_SEAT) / 0.15))
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = pl
        const r = ctx.renderer
        r.setClearColor(0x000000, 0)
        r.setRenderTarget(layer)
        if (pl < MOULD_SEAT + 0.12) r.render(scene, cam)
        else r.clear()
        U.tL.value = layer.texture
        pass.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: layer },
        { pass, target: hold },
      ],
      dispose() {
        pass.dispose()
        unit.dispose()
        dq.dispose()
        matA.dispose()
        matB.dispose()
        dustMat.dispose()
      },
    }
  },
}
export default t
