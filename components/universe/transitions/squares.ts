// 22 → 23. Squares.
//
// The outgoing frame is cut into a board of square tiles, eight to the frame's height, each a slab
// with thickness. The seams open and the slabs rise a few millimetres off a matte slate bed while
// the lens tilts back to a raking view. Then the board's own rule plays out: the dark squares flip
// over together, a diagonal wave from the lower left, each turning about its own diagonal (walnut
// end grain flashing on the edge) to show the incoming picture on its back; then the light squares,
// a faster wave. In flight the picture is carried on the material, slate on the dark squares and
// maple on the light. Every tile then rises a hair and the whole board slams down level at
// SQUARES_IN, which is the incoming scene's clock zero (a crack, a shudder, a zoom punch); the lens
// swings back square, the seams close, and the frame is the next scene.
//
// What crosses the cut is the picture, on the backs of the squares. Nothing leaves its cell: two
// parity waves and one slam. Closed form in linear progress; it works from any picture.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp as clampN, cos, cross, dot, exp, float, Fn, fract, length, max, mix, normalGeometry, normalize, positionGeometry, positionLocal, pow, sin, step, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { fbm, luma, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const SQUARES_DUR = 1.6
/** The slam: `board`'s clock zero. */
export const SQUARES_IN = 0.72

const FOV = 30
const D0 = 1 / Math.tan((FOV * Math.PI) / 360) // a plane of half-height 1 fills the frame from here
const ROWS = 12, COLS = 22 // eight rows fill the frame; the rest are there for the tilted view
const CS = 2 / 8 // a square, in frame half-heights
const THICK = 0.06
const BED = -0.05

// schedule, in linear progress
const OPEN0 = 0.02, OPEN1 = 0.13
const DARK0 = 0.13, DARK_W = 0.25, DARK_D = 0.17
const LIGHT0 = 0.4, LIGHT_W = 0.14, LIGHT_D = 0.12
const RISE0 = 0.63

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
/** Rotate v about the unit axis a by angle th (Rodrigues). */
const rotA = (v: V3, a: V3, c: F, s: F): V3 => v.mul(c).add(cross(a, v).mul(s)).add(a.mul(dot(a, v)).mul(float(1).sub(c))) as V3

// sounds: a run of wooden clicks along each wave, accelerating, then the slam
const waveClicks = (p0: number, w: number, d: number, n: number, f: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1)
    return { s: "stone" as const, p: p0 + d * 0.85 + w * Math.sqrt(x), o: { g: 0.28 + 0.12 * x, f: H(f + (i % 3)), vary: 1, pos: [-0.8 + 1.6 * x, -0.5 + x, 0.1] as [number, number, number] } }
  })

const t: TransitionDef = {
  id: "squares",
  dur: SQUARES_DUR,
  inAt: SQUARES_IN,
  ease: E.lin,
  snd: [
    { s: "scratch", p: OPEN0, o: { g: 0.25, f: 520, dur: 0.25 } },
    { s: "knap", p: OPEN1 - 0.02, o: { g: 0.3, f: H(30), pos: [0, -0.2, 0.2] } },
    ...waveClicks(DARK0, DARK_W, DARK_D, 9, 7),
    ...waveClicks(LIGHT0, LIGHT_W, LIGHT_D, 9, 9),
    { s: "whoosh", p: RISE0, o: { g: 0.3, f: 180, dur: 0.25 } },
    { s: "crack", p: SQUARES_IN, o: { g: 0.85, pos: [0, -0.1, 0] } },
    { s: "thud", p: SQUARES_IN, o: { g: 0.9, f: H(2), pos: [0, -0.3, 0] } },
    { s: "boom", p: SQUARES_IN + 0.005, o: { g: 0.45 } },
    { s: "knap", p: SQUARES_IN + 0.03, o: { g: 0.25, f: H(26), pos: [-0.6, 0.2, 0.2] } },
    { s: "knap", p: SQUARES_IN + 0.055, o: { g: 0.2, f: H(29), pos: [0.6, -0.3, 0.2] } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(rt.texture),
      p: uniform(0),
      asp: uniform(16 / 9),
      open: uniform(0), // seams open (0..1)
      base: uniform(0), // every tile's height above the bed
      mat: uniform(0), // how much the picture is carried on the material
      u: uniform(-1), // seconds since the slam
      blendB: uniform(0),
      blendA: uniform(1),
    }
    const LD = normalize(vec3(-0.42, 0.55, 0.72))
    const VD = vec3(0, 0, 1)

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 30)

    // ---- the tiles
    const box = new THREE.BoxGeometry(1, 1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = box.index
    geo.setAttribute("position", box.getAttribute("position"))
    geo.setAttribute("normal", box.getAttribute("normal"))
    const at = new Float32Array(ROWS * COLS * 4)
    for (let j = 0, k = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++, k++) {
        const cx = (i - (COLS - 1) / 2) * CS, cy = (j - (ROWS - 1) / 2) * CS
        // eight rows centred: row 0 of the frame is the bottom rank; parity like a board (lower left dark)
        at.set([cx, cy, (i + j + COLS + ROWS) % 2, 0], k * 4)
      }
    geo.setAttribute("aT", new THREE.InstancedBufferAttribute(at, 4))
    geo.instanceCount = ROWS * COLS
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)

    const aT = attribute("aT", "vec4")
    const ctr = aT.xy
    const dark = aT.z
    // the wave: 0 at the lower left of the frame, 1 at the upper right
    const wv = clampN(ctr.x.div(U.asp).mul(0.5).add(0.5).add(ctr.y.mul(0.5).add(0.5)).mul(0.5), 0, 1)
    const s0 = mix(fl(LIGHT0).add(wv.mul(LIGHT_W)), fl(DARK0).add(wv.mul(DARK_W)), dark)
    const dd = mix(float(LIGHT_D), float(DARK_D), dark)
    const f = clampN(U.p.sub(s0).div(dd), 0, 1)
    const fe = f.mul(f).mul(f.mul(-2).add(3))
    // after it lands: a little bounce off the bed, decaying
    const since = max(U.p.sub(s0.add(dd)), 0).mul(1.6)
    const kick = exp(since.mul(-22)).mul(abs(sin(since.mul(48)))).mul(step(1, f)).mul(0.09)
    const th = fe.mul(Math.PI).sub(kick)
    // dark squares roll forward along the wave, light ones roll back
    const ax = normalize(vec3(mix(float(-1), float(1), dark), mix(float(1), float(-1), dark), 0).mul(0.7071))
    const cth = cos(th), sth = sin(th)
    const scl = float(1).sub(U.open.mul(0.07))
    const loc = positionGeometry.mul(vec3(CS, CS, THICK)).mul(vec3(scl, scl, 1))
    const lift = U.base.add(sin(fe.mul(Math.PI)).mul(CS * 0.78))
    const pos = rotA(loc as V3, ax as V3, cth, sth).add(vec3(ctr, lift.add(THICK / 2)))
    const tileMat = new THREE.NodeMaterial()
    tileMat.positionNode = pos
    const nG = normalGeometry
    const vN = rotA(nG as V3, ax as V3, cth, sth).toVarying()
    const vQ = positionGeometry.toVarying()
    const vC = ctr.toVarying()
    const vD = dark.toVarying()
    const vAx = ax.toVarying()
    const vF = sin(fe.mul(Math.PI)).toVarying()
    tileMat.fragmentNode = Fn(() => {
      const q = vQ.toVar()
      const N = normalize(vN).toVar()
      const a = normalize(vAx).xy
      const frontF = step(0.49, q.z), backF = step(q.z, -0.49)
      const edge = float(1).sub(frontF).sub(backF)
      // where on the frame this point of the face was (front) or will lie (back)
      const qf = q.xy
      const qb = a.mul(dot(a, qf)).mul(2).sub(qf)
      const wpos = vC.add(mix(qf, qb, backF).mul(CS))
      const fuv = vec2(wpos.x.div(U.asp).mul(0.5).add(0.5), wpos.y.mul(0.5).add(0.5)).toVar()
      const inside = step(0, fuv.x).mul(step(fuv.x, 1)).mul(step(0, fuv.y)).mul(step(fuv.y, 1))
      const cA = toLinear(sampleRT(U.tA, clampN(fuv, 0.001, 0.999) as V2).rgb)
      const cB = toLinear(sampleRT(U.tB, clampN(fuv, 0.001, 0.999) as V2).rgb)
      const pic = mix(cA, cB, backF).toVar()
      // the material the picture is carried on: slate on dark squares, maple on light
      const isD = step(0.5, vD)
      const g = fbm(wpos.mul(vec2(3, 26)).add(isD.mul(7))).toVar()
      const maple = vec3(0.62, 0.45, 0.26).mul(g.mul(0.35).add(0.8)).mul(sin(wpos.y.mul(260).add(g.mul(8))).mul(0.04).add(0.97))
      const slate = vec3(0.16, 0.17, 0.19).mul(vnoise(wpos.mul(90)).mul(0.25).add(0.85)).mul(fbm(wpos.mul(7)).mul(0.2).add(0.9))
      const surf = mix(maple, slate, isD)
      const l = luma(pic)
      const carried = mix(pic, surf.mul(l.mul(1.6).add(0.25)), U.mat.mul(0.42)).toVar()
      const face = mix(surf.mul(0.16), carried, inside)
      // end grain on the edges: walnut, with the rings showing
      const ring = sin(length(q.xy.mul(vec2(7, 3)).add(vD.mul(3))).mul(40)).mul(0.5).add(0.5)
      const grain = vec3(0.2, 0.11, 0.06).mul(ring.mul(0.25).add(0.75))
      const alb = mix(face, grain, edge).toVar()
      // one light: flat faces keep their value exactly, turned faces darken and glint
      const ndl = dot(N, LD)
      const shade = clampN(float(1).add(ndl.sub(dot(VD, LD)).mul(0.9)), 0.12, 1.25)
      const Hh = normalize(LD.add(VD))
      const sp = pow(max(dot(N, Hh), 0), 50).mul(vF).mul(0.35)
      const col = alb.mul(shade).add(vec3(1.0, 0.92, 0.8).mul(sp))
      return vec4(toSRGB(col as V3), 1)
    })()
    const tiles = new THREE.Mesh(geo, tileMat)
    tiles.frustumCulled = false
    scene.add(tiles)

    // ---- the slate bed, seen through the seams, darker under the tiles
    const bedMat = new THREE.NodeMaterial()
    bedMat.fragmentNode = Fn(() => {
      const P = positionLocal
      const s = vec3(0.07, 0.075, 0.085).mul(vnoise(P.xy.mul(60)).mul(0.25).add(0.8)).mul(fbm(P.xy.mul(5)).mul(0.3).add(0.8))
      // contact shade under the grid of tiles (strongest where tiles are lowest)
      const g = abs(fract(P.xy.div(CS)).sub(0.5)).mul(2)
      const seam = sstep(0.82, 1.0, max(g.x, g.y) as F)
      const occl = mix(float(0.25), float(1), seam.mul(0.5).add(sstep(0, 0.12, U.base).mul(0.5)))
      return vec4(toSRGB(s.mul(occl) as V3), 1)
    })()
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(COLS * CS * 1.4, ROWS * CS * 1.4), bedMat)
    bed.position.z = BED
    scene.add(bed)

    // ---- the frame: scene, with A at the very start and B at the very end, and the slam's punch
    const pass = ctx.pass(({ uv }) => {
      const c = uv.sub(0.5).mul(vec2(U.asp, 1))
      const u = U.u
      const hit = step(0, u)
      const zoom = float(1).sub(exp(u.mul(-9)).mul(cos(u.mul(30))).mul(0.03).mul(hit))
      const sh = vec2(sin(u.mul(41)).mul(0.006), cos(u.mul(53)).mul(0.012)).mul(exp(u.mul(-7))).mul(hit)
      const q = c.mul(zoom).div(vec2(U.asp, 1)).add(0.5).add(sh)
      const s = sampleRT(U.tS, clampN(q, 0.001, 0.999) as V2).rgb.toVar()
      // the slam's flash of dust in the light
      s.addAssign(vec3(0.05, 0.045, 0.04).mul(exp(u.mul(-14))).mul(hit))
      const withA = mix(s, sampleRT(U.tA, uv).rgb, U.blendA)
      return vec4(mix(withA, sampleRT(U.tB, uv).rgb, U.blendB), 1)
    }, U)

    const tgt = new THREE.Vector3()
    return {
      render(a) {
        const p = a.pl
        const asp = a.out.width / a.out.height
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = p
        U.asp.value = asp
        const u = (p - SQUARES_IN) * SQUARES_DUR
        U.u.value = u
        U.open.value = smooth(OPEN0, OPEN1, p) * (1 - smooth(SQUARES_IN, 0.93, p))
        // the board rises off the bed, rises a hair more before the slam, slams, bounces once
        const up0 = 0.035 * smooth(OPEN0, OPEN1, p)
        const rise = 0.05 * smooth(RISE0, SQUARES_IN - 0.02, p)
        const down = E.in3(clamp((p - (SQUARES_IN - 0.022)) / 0.022))
        U.base.value = u < 0 ? (up0 + rise) * (1 - down) : 0.004 * Math.exp(-u * 20) * Math.abs(Math.sin(u * 40))
        U.mat.value = smooth(0.08, 0.3, p) * (1 - smooth(0.62, SQUARES_IN, p))
        U.blendA.value = 1 - smooth(0.0, 0.015, p)
        U.blendB.value = smooth(0.9, 0.995, p)
        // the lens: tilts back and turns a little to rake the slabs, then swings square again
        const tilt = smooth(0.02, 0.3, p) * (1 - smooth(SQUARES_IN, 0.97, p))
        const phi = 0.62 * tilt, yaw = 0.2 * tilt
        const D = D0 * (1 + 0.42 * tilt)
        cam.aspect = asp
        cam.position.set(D * Math.cos(phi) * Math.sin(yaw), -D * Math.sin(phi), D * Math.cos(phi) * Math.cos(yaw))
        tgt.set(0.08 * tilt, 0.12 * tilt, 0)
        cam.up.set(0, 1, 0)
        cam.lookAt(tgt)
        cam.updateProjectionMatrix()
        cam.updateMatrixWorld()
        const r = ctx.renderer
        r.setClearColor(0x0a0a0b, 1)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tS.value = rt.texture
        pass.render(a.out)
      },
      warm: () => [{ scene, camera: cam, target: rt }, { pass, target: hold }],
      dispose() {
        geo.dispose()
        box.dispose()
        tileMat.dispose()
        bed.geometry.dispose()
        bedMat.dispose()
      },
    }
  },
}
export default t
