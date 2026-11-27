// TSL shared by every full-screen pass and available to scene materials. This is the old GLSL
// `LIB`, function for function, written in three's shading language so the same graph compiles to
// WGSL (WebGPU) and to GLSL ES 3 (the WebGL 2 fallback). Raw `glslFn` / `wgslFn` code only runs on
// one backend each, so nothing here (and nothing in a scene) may use them.
//
// Conventions a porter needs:
//  - `UV` is the full-screen uv with the origin at the bottom left (y up), as `vUv` was.
//  - A render target is sampled with y down: use `sampleRT(node, uv)` / `rtUV(uv)`. A canvas or
//    image texture is sampled with `UV` as it is. (three flips render-target lookups on WebGL 2
//    only, so "y down" is what gives the same picture on both backends.)
//  - GLSL `out` parameters do not exist: `voronoi` returns vec3(distance, cell.xy).
//  - `rot(p, a)` is GLSL's `rot(a) * p`; for `p * rot(a)` pass `-a`.

import type { Node, TextureNode } from "three/webgpu"
import { clamp, cos, dot, float, floor, Fn, fract, length, log2, Loop, max, min, mix, positionGeometry, pow, sin, step, vec2, vec3, vec4 } from "three/tsl"

export type F = Node<"float">
export type V2 = Node<"vec2">
export type V3 = Node<"vec3">
export type V4 = Node<"vec4">

export const PI = 3.14159265359
export const TAU = 6.28318530718

/** Clip-space position of the engine's full-screen triangle (set as `vertexNode`). */
export const FS_VERTEX = /*@__PURE__*/ vec4(positionGeometry.xy, 0, 1)
/** Full-screen uv, origin bottom-left, y up: what `vUv` was in the GLSL engine. */
export const UV: V2 = /*@__PURE__*/ positionGeometry.xy.mul(0.5).add(0.5).toVarying("vUv")

/** A y-up uv turned into the lookup for a render target. */
export const rtUV = (uv: V2): V2 => vec2(uv.x, uv.y.oneMinus())
/** Mip level 0, for `.level(L0)`: a lookup that needs no derivatives, so it is legal inside any branch or loop. */
export const L0 = /*@__PURE__*/ float(0)
/** Sample a render target's texture node at a y-up uv (level 0: targets have no mips). */
export const sampleRT = (t: TextureNode, uv: V2 = UV): V4 => t.sample(rtUV(uv)).level(L0) as V4

export const sat = (x: F): F => clamp(x, 0, 1)

export const hash11 = /*@__PURE__*/ Fn(([p_]: [F]) => {
  const p = fract(p_.mul(0.1031)).toVar()
  p.mulAssign(p.add(33.33))
  p.mulAssign(p.add(p))
  return fract(p)
}).setLayout({ name: "hash11", type: "float", inputs: [{ name: "p", type: "float" }] })

export const hash21 = /*@__PURE__*/ Fn(([p]: [V2]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar()
  p3.addAssign(dot(p3, p3.yzx.add(33.33)))
  return fract(p3.x.add(p3.y).mul(p3.z))
}).setLayout({ name: "hash21", type: "float", inputs: [{ name: "p", type: "vec2" }] })

export const hash22 = /*@__PURE__*/ Fn(([p]: [V2]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.103, 0.0973))).toVar()
  p3.addAssign(dot(p3, p3.yzx.add(33.33)))
  return fract(p3.xx.add(p3.yz).mul(p3.zy))
}).setLayout({ name: "hash22", type: "vec2", inputs: [{ name: "p", type: "vec2" }] })

export const hash33 = /*@__PURE__*/ Fn(([p_]: [V3]) => {
  const p = fract(p_.mul(vec3(0.1031, 0.103, 0.0973))).toVar()
  p.addAssign(dot(p, p.yxz.add(33.33)))
  return fract(p.xxy.add(p.yxx).mul(p.zyx))
}).setLayout({ name: "hash33", type: "vec3", inputs: [{ name: "p", type: "vec3" }] })

export const vnoise = /*@__PURE__*/ Fn(([p]: [V2]) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const u = f.mul(f).mul(f.mul(-2).add(3)).toVar()
  return mix(mix(hash21(i), hash21(i.add(vec2(1, 0))), u.x), mix(hash21(i.add(vec2(0, 1))), hash21(i.add(vec2(1, 1))), u.x), u.y)
}).setLayout({ name: "vnoise", type: "float", inputs: [{ name: "p", type: "vec2" }] })

export const vnoise3 = /*@__PURE__*/ Fn(([p]: [V3]) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const u = f.mul(f).mul(f.mul(-2).add(3)).toVar()
  const n = i.x.add(i.y.mul(57)).add(i.z.mul(113)).toVar()
  return mix(
    mix(mix(hash11(n), hash11(n.add(1)), u.x), mix(hash11(n.add(57)), hash11(n.add(58)), u.x), u.y),
    mix(mix(hash11(n.add(113)), hash11(n.add(114)), u.x), mix(hash11(n.add(170)), hash11(n.add(171)), u.x), u.y),
    u.z,
  )
}).setLayout({ name: "vnoise3", type: "float", inputs: [{ name: "p", type: "vec3" }] })

/** Five octaves of value noise, each turned and scaled by 2 (GLSL: m = mat2(1.6, 1.2, -1.2, 1.6)). */
export const fbm = /*@__PURE__*/ Fn(([p_]: [V2]) => {
  const p = vec2(p_).toVar()
  const a = float(0.5).toVar()
  const s = float(0).toVar()
  Loop(5, () => {
    s.addAssign(a.mul(vnoise(p)))
    p.assign(vec2(p.x.mul(1.6).sub(p.y.mul(1.2)), p.x.mul(1.2).add(p.y.mul(1.6))))
    a.mulAssign(0.5)
  })
  return s
}).setLayout({ name: "fbm", type: "float", inputs: [{ name: "p", type: "vec2" }] })

export const fbm3 = /*@__PURE__*/ Fn(([p_]: [V3]) => {
  const p = vec3(p_).toVar()
  const a = float(0.5).toVar()
  const s = float(0).toVar()
  Loop(4, () => {
    s.addAssign(a.mul(vnoise3(p)))
    p.assign(p.mul(2.03).add(vec3(7.1, 3.3, 5.7)))
    a.mulAssign(0.5)
  })
  return s
}).setLayout({ name: "fbm3", type: "float", inputs: [{ name: "p", type: "vec3" }] })

/** Cellular noise. Returns vec3(distance to the nearest point, that point's cell.xy). */
export const voronoi = /*@__PURE__*/ Fn(([p]: [V2]) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const d = float(8).toVar()
  const cell = vec2(i).toVar()
  // (nested loops name their counters i and j: here i is y and j is x, as in the GLSL)
  Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
    const g = vec2(float(x), float(y)).toVar()
    const e = length(g.add(hash22(i.add(g))).sub(f)).toVar()
    const near = e.lessThan(d)
    cell.assign(mix(cell, i.add(g), float(near)))
    d.assign(min(d, e))
  })
  return vec3(d, cell)
}).setLayout({ name: "voronoi", type: "vec3", inputs: [{ name: "p", type: "vec2" }] })

/** GLSL `rot(a) * p`, with rot(a) = mat2(c, -s, s, c). */
export const rot = /*@__PURE__*/ Fn(([p, a]: [V2, F]) => {
  const c = cos(a).toVar()
  const s = sin(a).toVar()
  return vec2(c.mul(p.x).add(s.mul(p.y)), c.mul(p.y).sub(s.mul(p.x)))
}).setLayout({ name: "rot", type: "vec2", inputs: [{ name: "p", type: "vec2" }, { name: "a", type: "float" }] })

export const luma = /*@__PURE__*/ Fn(([c]: [V3]) => dot(c, vec3(0.2126, 0.7152, 0.0722))).setLayout({ name: "luma", type: "float", inputs: [{ name: "c", type: "vec3" }] })

export const toSRGB = /*@__PURE__*/ Fn(([c]: [V3]) => mix(c.mul(12.92), pow(max(c, 0), vec3(1 / 2.4)).mul(1.055).sub(0.055), step(vec3(0.0031308), c))).setLayout({ name: "toSRGB", type: "vec3", inputs: [{ name: "c", type: "vec3" }] })

export const toLinear = /*@__PURE__*/ Fn(([c]: [V3]) => mix(c.div(12.92), pow(max(c.add(0.055).div(1.055), 0), vec3(2.4)), step(vec3(0.04045), c))).setLayout({ name: "toLinear", type: "vec3", inputs: [{ name: "c", type: "vec3" }] })

export const aces = /*@__PURE__*/ Fn(([x]: [V3]) => clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1)).setLayout({ name: "aces", type: "vec3", inputs: [{ name: "x", type: "vec3" }] })

/** AgX (the deck's own fit, not three's `agxToneMapping`, which uses a different contrast curve). */
export const agx = /*@__PURE__*/ Fn(([c_]: [V3]) => {
  // inM * c and outM * c with the matrices written out column by column
  const i = vec3(0.842479, 0.0423282, 0.0423756).mul(c_.x).add(vec3(0.0784336, 0.878468, 0.0784336).mul(c_.y)).add(vec3(0.0792237, 0.0791661, 0.879142).mul(c_.z))
  const c = clamp(log2(max(i, 1e-10)).add(12.47393).div(16.5), 0, 1).toVar()
  const c2 = c.mul(c).toVar()
  const c4 = c2.mul(c2).toVar()
  const v = c4.mul(c2).mul(15.5).sub(c4.mul(c).mul(40.14)).add(c4.mul(31.96)).sub(c2.mul(c).mul(6.868)).add(c2.mul(0.4298)).add(c.mul(0.1191)).sub(0.00232).toVar()
  const o = vec3(1.19687, -0.0528968, -0.0529716).mul(v.x).add(vec3(-0.0980208, 1.1519, -0.0980434).mul(v.y)).add(vec3(-0.0990297, -0.0989611, 1.15107).mul(v.z))
  return pow(max(o, 0), vec3(2.2))
}).setLayout({ name: "agx", type: "vec3", inputs: [{ name: "c", type: "vec3" }] })

/**
 * GLSL `smoothstep(e0, e1, x)` written with e0 > e1 (a falling edge). WGSL leaves that case
 * undefined, so the port spells it out: 1 at x <= e1, 0 at x >= e0.
 */
export const smoothstepRev = (e0: number, e1: number, x: Node<"float">): F => {
  const t = clamp(float(e0).sub(x).div(e0 - e1), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
