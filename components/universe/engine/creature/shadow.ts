// The creature toolkit, part 6: ground shadows. Without one an animal floats, however good its gait.
//
// The whole herd is drawn once more, flattened onto the ground along the light: a real silhouette
// (horns, frill, each leg, the gap under the belly), touching every planted foot exactly. Two
// draws per herd, whatever the head count:
//
//   1. the silhouettes, from a low-detail mesh on the same bone palette, write ONE number into the
//      target's alpha where they land and leave its colour alone. Overlapping triangles (the two
//      sides of a leg, a leg over the belly's shadow, one animal over another) write the same
//      number, so darkness cannot pile up;
//   2. one quad lying on the ground multiplies colour by that alpha and sets alpha back to 1.
//
// What the scene must do: draw its ground before these (give the ground a `renderOrder` below
// -2), write alpha 1 from its ground material, and keep the light direction in a uniform.
// Not done: a penumbra (the edge is as soft as the target's MSAA), shadows on anything but the
// ground, and an animal's shadow on another animal.

import * as THREE from "three/webgpu"
import { cameraPosition, cameraProjectionMatrix, cameraViewMatrix, float, max, positionGeometry, uniform, vec3, vec4 } from "three/tsl"

import type { F, V2, V3 } from "../tsl"
import { buildCreature } from "./build"
import { skinNodes, type Herd } from "./gpu"

export type ShadowOpts = {
  /** Direction toward the light, world space: the same uniform your `Lights.key` is. */
  light: V3
  /** How dark: 0 none, 1 black (default 0.55). A number, or a uniform to animate. */
  strength?: number | F
  /** Height of the ground: a number, or a TSL function of world xz for terrain (the same field your ground mesh and `drive.ground` use). */
  ground?: number | ((xz: V2) => F)
  /** Mesh detail of the silhouettes (default 0.22: a couple of thousand triangles; small parts with a higher `minDetail` cast nothing). */
  detail?: number
  /** Half-size of the quad that applies the shadows, in world units, centred under the camera (default 400 herd radii). */
  extent?: number
  /** Draw order of the two meshes (default -2 and -1: after a ground at -3 or below, before the animals at 0). */
  order?: number
}

export type Shadow = { group: THREE.Group; strength: { value: number } | null; dispose(): void }

/** Ground shadows for a herd. Add `group` to the scene; nothing to update (it follows the herd's own `update`). */
export function makeShadow(herd: Herd, o: ShadowOpts): Shadow {
  const built = buildCreature(herd.spec, o.detail ?? 0.22)
  const geo = built.hide as THREE.InstancedBufferGeometry
  geo.instanceCount = 0
  herd.follow.push(geo)
  const n = skinNodes(herd.palette, uniform(0) as unknown as { value: number } & THREE.Node, undefined, undefined, herd.spec.skinning === "dq" ? { dq: true } : undefined)
  const su = typeof o.strength === "object" ? null : uniform(o.strength ?? 0.55)
  const k = float(1).sub((su ?? o.strength) as F) as F
  const lift = herd.rig.radius * 0.0015
  const gy = (xz: V2): F => (typeof o.ground === "function" ? o.ground(xz) : float(o.ground ?? 0)) as F
  // slide each skinned vertex down the light ray to the ground (twice over terrain: the second pass corrects for the slope)
  const Ld = vec3(o.light.x, max(o.light.y, 0.12), o.light.z) as V3
  const drop = (P: V3, g: F): V3 => P.sub(Ld.mul(max(P.y.sub(g), 0).div(Ld.y))) as V3
  let Q = drop(n.world, gy(n.world.xz as V2))
  if (typeof o.ground === "function") Q = drop(n.world, gy(Q.xz as V2))
  const flat = vec3(Q.x, gy(Q.xz as V2).add(lift), Q.z)
  const cut: THREE.MaterialParameters = { transparent: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation }
  const sm = new THREE.NodeMaterial()
  sm.setValues({ ...cut, depthTest: true, side: THREE.DoubleSide, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor })
  sm.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(flat, 1))
  sm.fragmentNode = vec4(0, 0, 0, k)
  sm.polygonOffset = true
  sm.polygonOffsetFactor = -1
  sm.polygonOffsetUnits = -4
  const sil = new THREE.Mesh(geo, sm)
  sil.frustumCulled = false
  sil.renderOrder = o.order ?? -2
  sil.name = `${herd.spec.name}-shadow`
  // the quad that turns the alpha into darkness: on the ground, so nothing above the horizon or in front of the ground is touched
  const terrain = typeof o.ground === "function"
  const ext = o.extent ?? herd.rig.radius * 400
  const qg = new THREE.PlaneGeometry(2, 2, terrain ? 160 : 1, terrain ? 160 : 1)
  const am = new THREE.NodeMaterial()
  am.setValues({ ...cut, depthTest: true, side: THREE.DoubleSide, blendSrc: THREE.ZeroFactor, blendDst: THREE.DstAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor })
  const axz = positionGeometry.xy.mul(ext).add(cameraPosition.xz) as V2
  am.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(axz.x, gy(axz).add(lift * 2), axz.y, 1))
  am.fragmentNode = vec4(0, 0, 0, 1)
  am.polygonOffset = true
  am.polygonOffsetFactor = -2
  am.polygonOffsetUnits = -8
  const apply = new THREE.Mesh(qg, am)
  apply.frustumCulled = false
  apply.renderOrder = (o.order ?? -2) + 1
  apply.name = `${herd.spec.name}-shadow-apply`
  const group = new THREE.Group()
  group.add(sil, apply)
  return {
    group,
    strength: su as unknown as { value: number } | null,
    dispose() {
      const at = herd.follow.indexOf(geo)
      if (at >= 0) herd.follow.splice(at, 1)
      geo.dispose()
      built.cards?.dispose()
      qg.dispose()
      sm.dispose()
      am.dispose()
    },
  }
}
