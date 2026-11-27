// A full-screen pass: one triangle, a NodeMaterial whose fragment is a TSL node, and a `render`
// that points the renderer at a target and draws it. Kept apart from the deck so it can be driven
// on its own (the engine's tests do).

import * as THREE from "three/webgpu"
import { Fn, uniform } from "three/tsl"

import { FS_VERTEX, UV, type F, type V2 } from "./tsl"
import type { Pass, PassBuild, Uniforms } from "./types"

export type PassEnv = {
  renderer: THREE.WebGPURenderer
  /** The deck's ambient clock, shared by every pass. */
  time: THREE.UniformNode<"float", number>
  /** Size of the canvas, for passes drawn straight to it. */
  size(): { w: number; h: number }
}

const cam = /*@__PURE__*/ new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
let tri: THREE.BufferGeometry | null = null

/** The camera every pass is drawn with (and must be compiled with). */
export const PASS_CAMERA = cam

/**
 * The mesh carries the full-screen vertex node permanently (three's own QuadMesh swaps it in per
 * render), so `renderer.compileAsync(pass.mesh, PASS_CAMERA)` builds the very pipeline that
 * `render` will use.
 */
export function createPass<U extends Uniforms = Uniforms>(env: PassEnv, build: PassBuild, uniforms?: U): Pass<U> {
  tri ??= new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const res = uniform(new THREE.Vector2(1, 1))
  const mat = new THREE.NodeMaterial()
  mat.vertexNode = FS_VERTEX
  // A builder runs inside Fn, so it may use toVar / assign / If / Loop directly.
  mat.fragmentNode = typeof build === "function" ? Fn(() => build({ uv: UV, res: res as unknown as V2, time: env.time as unknown as F }))() : build
  mat.depthTest = false
  mat.depthWrite = false
  const mesh = new THREE.Mesh(tri, mat)
  mesh.frustumCulled = false
  return {
    u: (uniforms ?? {}) as U,
    mat,
    mesh,
    render: (target) => {
      if (target) res.value.set(target.width, target.height)
      else {
        const s = env.size()
        res.value.set(s.w, s.h)
      }
      env.renderer.setRenderTarget(target)
      env.renderer.render(mesh, cam)
    },
    dispose: () => mat.dispose(),
  }
}
