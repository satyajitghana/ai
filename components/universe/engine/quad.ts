// Portals. A scene can say where a frame-within-the-frame is, as four clip-space corners; a
// linked transition then maps a whole scene into that quad (or out of it) with a homography.

import * as THREE from "three/webgpu"
import { clamp, dFdx, dFdy, float, Fn, fwidth, If, length, Loop, max, vec2, vec3 } from "three/tsl"

import { sampleRT, toLinear, toSRGB, type F, type V2, type V3 } from "./tsl"
import type { Portal } from "./types"

type P2 = [number, number]

/** Unit square (u,v) → quad. Corners in order BL, BR, TR, TL. Returns a row-major 3×3. */
function squareToQuad(p0: P2, p1: P2, p2: P2, p3: P2): number[] {
  const dx1 = p1[0] - p2[0]
  const dx2 = p3[0] - p2[0]
  const dy1 = p1[1] - p2[1]
  const dy2 = p3[1] - p2[1]
  const sx = p0[0] - p1[0] + p2[0] - p3[0]
  const sy = p0[1] - p1[1] + p2[1] - p3[1]
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9
  const g = (sx * dy2 - dx2 * sy) / den
  const h = (dx1 * sy - sx * dy1) / den
  return [p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0], p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1], g, h, 1]
}

/**
 * The matrix a shader needs: clip (x, y, 1) → (u·w, v·w, w), with uv 0..1 and v up.
 * `c` is the quad's corners in clip space, in order TL, TR, BR, BL.
 */
export function portalMatrix(c: Portal["c"], out: THREE.Matrix3) {
  const m = squareToQuad(c[3], c[2], c[1], c[0])
  out.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]).invert()
  // keep w positive at the quad's centre so the shader can reject the mirrored half-plane
  const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4
  const cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4
  const e = out.elements
  if (e[2] * cx + e[5] * cy + e[8] < 0) out.multiplyScalar(-1)
  return out
}

export const FULL: Portal["c"] = [[-1, 1], [1, 1], [1, -1], [-1, -1]]

/** A portal from an axis-aligned rectangle in uv (origin bottom-left). */
export function rectPortal(x: number, y: number, w: number, h: number, a = 1, shade = 1): Portal {
  const x0 = x * 2 - 1
  const x1 = (x + w) * 2 - 1
  const y0 = y * 2 - 1
  const y1 = (y + h) * 2 - 1
  return { c: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]], a, shade }
}

/** Project four world-space points (TL, TR, BR, BL) through a camera into a portal quad. */
export function projectPortal(pts: THREE.Vector3[], cam: THREE.Camera, a = 1, shade = 1): Portal {
  const v = new THREE.Vector3()
  const c = pts.map((p) => {
    v.copy(p).project(cam)
    return [v.x, v.y] as P2
  }) as Portal["c"]
  return { c, a, shade }
}

/** Interpolate two quads corner by corner. */
export function mixPortal(a: Portal["c"], b: Portal["c"], t: number): Portal["c"] {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]) as Portal["c"]
}

/**
 * For transitions: where this fragment falls inside the quad whose inverse homography is `H`.
 * Returns vec3(u, v, coverage): uv inside the quad (y up) and an anti-aliased edge 0..1.
 * (The GLSL version returned the uv and wrote coverage to an `out` parameter.)
 */
export const quadUV = /*@__PURE__*/ Fn(([H, uv]: [THREE.Node<"mat3">, V2]) => {
  const q = H.mul(vec3(uv.mul(2).sub(1), 1)).toVar()
  const t = q.xy.div(q.z).toVar()
  const g = max(fwidth(t), vec2(1e-6)).toVar()
  const a = clamp(t.div(g).add(0.5), 0, 1).mul(clamp(t.oneMinus().div(g).add(0.5), 0, 1)).toVar()
  return vec3(t, q.z.greaterThan(0).select(a.x.mul(a.y), 0))
})

/**
 * A minified scene, box-filtered over its footprint so a shrinking slide does not shimmer.
 * `tex` is a finished scene (a render target, sRGB values), `t` a y-up uv, `resY` the height in
 * pixels of the target being drawn into.
 */
export const quadTex = (tex: THREE.TextureNode, t: V2, resY: F): V3 =>
  Fn(() => {
    const dx = dFdx(t).toVar()
    const dy = dFdy(t).toVar()
    const m = max(length(dx), length(dy)).mul(resY)
    const c = vec3(0).toVar()
    If(m.lessThan(1.2), () => {
      c.assign(sampleRT(tex, t).rgb)
    }).Else(() => {
      Loop({ type: "int", start: 0, end: 4 }, { type: "int", start: 0, end: 4 }, ({ i, j }) => {
        const o = vec2(float(i), float(j)).add(0.5).div(4).sub(0.5)
        c.addAssign(toLinear(sampleRT(tex, t.add(dx.mul(o.x)).add(dy.mul(o.y))).rgb))
      })
      c.assign(toSRGB(c.div(16)))
    })
    return c
  })() as V3
