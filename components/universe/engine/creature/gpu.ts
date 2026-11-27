// The creature toolkit, part 4: the GPU side. A bone palette in a float texture (one row per
// drawn animal), the vertex-stage skinning that reads it, and the herd: per-animal frustum
// culling, level of detail by size on screen, and one instanced draw per part type per level.
//
// Why a palette of quaternion + translation and not matrices, and not three's SkinnedMesh:
// SkinnedMesh cannot be instanced; a mat4 per bone is four texels where a rigid bone needs two;
// and every rest frame here is the model's own axes, so a bone's whole skinning transform is
// "rotate the scaled rest position, add a translation". Eight texel loads per vertex, on both
// backends (texelFetch on WebGL 2, textureLoad on WebGPU).

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp, cross, dot, float, floor, Fn, If, instanceIndex, length, max, min, sign, sin, smoothstep, step, int, ivec2, normalGeometry, normalize, positionGeometry, texture, uniform, vec3, vec4 } from "three/tsl"

import type { F, V3, V4 } from "../tsl"
import { buildCreature, type Built } from "./build"
import { HEADER, makeDrive, makeRig, paletteWidth, type Drive, type Path, type Rig } from "./rig"
import { MAT, type CreatureSpec } from "./spec"

export type Palette = { tex: THREE.DataTexture; data: Float32Array; width: number; rows: number }

/** Allocated once at its full size, float, nearest: the texture a material first sees is the one it keeps. */
export function makePalette(bones: number, rows: number): Palette {
  const width = paletteWidth(bones)
  const data = new Float32Array(width * rows * 4)
  const tex = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat, THREE.FloatType)
  tex.minFilter = tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return { tex, data, width, rows }
}

/** What a creature material is built from: the skinned vertex and everything the fragment stage wants interpolated. */
export type SkinNodes = {
  /** Clip-space position: set as the material's `vertexNode`. */
  clip: THREE.Node<"vec4">
  /** World position and normal, per vertex. */
  world: V3
  /** Varyings for the fragment stage. */
  vW: V3
  vN: V3
  /** Rest-pose position and normal (model space): procedural patterns live here, so they do not swim when the animal moves. */
  vRest: V3
  vRestN: V3
  /** (v along the part, turn round it 0..1, material id, row + random) and (thinness, occlusion, breath mask, v). */
  vBody: V4
  vAux: V4
  /** Per animal: tint, seed, cycle count, blink 0..1, eye offset. */
  tint: V3
  seed: F
  cycle: F
  blink: F
  eye: THREE.Node<"vec2">
  /** The part's own axis in rest space (the direction "along" it): wrinkles ring it, grain runs with it. */
  vTan: V3
  /** 0..1: how far the joint under this vertex is bent away from its rest pose (0 away from joints). Folds deepen with it. */
  flex: F
  /** Per animal: (cos, sin) of its heading in the world, so a world direction can be taken into rest space. */
  heading: THREE.Node<"vec2">
  /** The trunk as an ellipsoid in rest space (centre, radii), or null if the caller did not supply one. */
  trunk: { c: [number, number, number]; r: [number, number, number] } | null
  /** Contact occlusion 0.. (spec.occlusion), per vertex; absent when the spec has none. */
  occ?: F
}

/**
 * A held object the skin flattens against (soft tissue squashed by a stone or a haft): an
 * ellipsoid in world space, as uniforms the scene moves every frame (`c` centre, `q` its rotation
 * as a quaternion, `r` radii, `amt` 0..1). Vertices inside it are moved onto its surface.
 */
export type Press = { c: THREE.UniformNode<"vec3", THREE.Vector3>; q: THREE.UniformNode<"vec4", THREE.Vector4>; r: THREE.UniformNode<"vec3", THREE.Vector3>; amt: THREE.UniformNode<"float", number> }
/** Uniforms for `HerdOpts.press`, starting switched off. */
export const makePress = (): Press => ({ c: uniform(new THREE.Vector3()), q: uniform(new THREE.Vector4(0, 0, 0, 1)), r: uniform(new THREE.Vector3(1, 1, 1)), amt: uniform(0) })

export type OccCaps = { gates: [number, number, number, number][]; caps: { bone: number; a: readonly number[]; b: readonly number[]; r: number }[]; strength: number }

const qrot = (q: V4, v: V3): V3 => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2)) as V3

/** Vertex-stage skinning from a palette. `rowBase` is the first row of this mesh's animals (one uniform per level of detail). */
/**
 * The parametric alternative to bones for a row of flaps or lobes: a metachronal ripple computed in
 * the vertex stage from the animal's cycle count, the flap's row and how far out along it the
 * vertex is. No CPU work per flap. Small-angle (it lifts, it does not rotate), so it is for far animals.
 */
export type Ripple = { amp: number; lag: number; rate: number; tipLag: number; z0: number }

export function skinNodes(pal: Palette, rowBase: { value: number } & THREE.Node, ripple?: Ripple, trunk?: number[], opts?: { dq?: boolean; occ?: OccCaps; press?: Press }): SkinNodes {
  const T = texture(pal.tex)
  const row = int(instanceIndex).add(int(rowBase as unknown as F))
  const ld = (x: THREE.Node<"int"> | number) => T.load(ivec2(x as THREE.Node<"int">, row)) as unknown as V4
  const I = attribute("aSkinI", "vec4") as V4
  const Wt = attribute("aSkinW", "vec4") as V4
  const aBody = attribute("aBody", "vec4") as V4
  const aAux = attribute("aAux", "vec4") as V4
  const h0 = ld(0), h1 = ld(1), h2 = ld(2)
  // breathing swells the flanks along the rest normal before the bones move them
  let rest = positionGeometry.add(normalGeometry.mul(aAux.z.mul(h2.x.mul(0.5).add(0.5)))) as V3
  if (ripple) {
    const mem = float(1).sub(step(0.5, abs(aBody.z.sub(MAT.membrane))))
    const ph = h1.x.mul(ripple.rate).sub(floor(aBody.w).mul(ripple.lag)).sub(aAux.w.mul(ripple.tipLag)).mul(6.2831853)
    const out = max(abs(positionGeometry.z).sub(ripple.z0), 0)
    rest = rest.add(vec3(0, out.mul(Math.tan(ripple.amp)).mul(aAux.w.mul(0.7).add(0.6)).mul(sin(ph)).mul(mem), 0)) as V3
  }
  const Is = [I.x, I.y, I.z, I.w], Ws = [Wt.x, Wt.y, Wt.z, Wt.w]
  let P: V3 = vec3(0) as V3
  let N: V3 = vec3(0) as V3
  const qs: V4[] = []
  if (opts?.dq) {
    // dual quaternions: blend rotation and translation as one rigid motion, then apply it
    let Rq: V4 = vec4(0) as V4
    let Dq: V4 = vec4(0) as V4
    let sc: F = float(1)
    for (let k = 0; k < 4; k++) {
      const b = int(Is[k]).mul(2).add(HEADER)
      const q = ld(b).toVar(), t = ld(b.add(1)).toVar()
      qs.push(q)
      if (k === 0) sc = t.w
      const w = k === 0 ? Ws[0] : Ws[k].mul(sign(dot(qs[0], q).add(1e-6)))
      const d = vec4(t.xyz.mul(q.w).add(cross(t.xyz, q.xyz)).mul(0.5), dot(t.xyz, q.xyz).mul(-0.5))
      Rq = Rq.add(q.mul(w)) as V4
      Dq = Dq.add(d.mul(w)) as V4
    }
    const il = float(1).div(max(length(Rq), 1e-6)).toVar()
    const R = Rq.mul(il).toVar() as V4, D = Dq.mul(il).toVar() as V4
    const tr = R.w.mul(D.xyz).sub(D.w.mul(R.xyz)).add(cross(R.xyz, D.xyz)).mul(2)
    P = qrot(R, rest.mul(sc) as V3).add(tr) as V3
    N = qrot(R, normalGeometry as V3)
  } else
  for (let k = 0; k < 4; k++) {
    const b = int(Is[k]).mul(2).add(HEADER)
    const q = ld(b), t = ld(b.add(1))
    qs.push(q)
    P = P.add(qrot(q, rest.mul(t.w) as V3).add(t.xyz).mul(Ws[k])) as V3
    N = N.add(qrot(q, normalGeometry as V3).mul(Ws[k])) as V3
  }
  if (opts?.press) {
    const pr = opts.press
    const qc = vec4(pr.q.xyz.negate(), pr.q.w) as V4
    const l = qrot(qc, P.sub(pr.c) as V3).div(pr.r).toVar()
    const ll = max(length(l), 1e-5)
    const inside = float(1).sub(step(1, ll)).mul(pr.amt)
    P = P.add(qrot(pr.q as unknown as V4, l.div(ll).sub(l).mul(pr.r) as V3).mul(inside)) as V3
  }
  // contact occlusion: each capsule, posed by its bone, darkens the skin that faces it (a sphere-occluder estimate at its nearest point)
  let occ: F | undefined
  if (opts?.occ) {
    const O = opts.occ
    let gate: F = float(0)
    for (const g of O.gates) gate = max(gate, step(length(positionGeometry.sub(vec3(g[0], g[1], g[2]))), float(g[3]))) as F
    const Nn = normalize(N)
    const Pw = P
    occ = Fn(() => {
    const sum = float(0).toVar()
    If(gate.greaterThan(0.5), () => {
    for (const c of O.caps) {
      const b = int(c.bone * 2 + HEADER)
      const q = ld(b), t = ld(b.add(1))
      const A = qrot(q, vec3(c.a[0], c.a[1], c.a[2]).mul(t.w) as V3).add(t.xyz), Bp = qrot(q, vec3(c.b[0], c.b[1], c.b[2]).mul(t.w) as V3).add(t.xyz)
      const ab = Bp.sub(A)
      const h = clamp(dot(Pw.sub(A), ab).div(max(dot(ab, ab), 1e-10)), 0, 1)
      const d = A.add(ab.mul(h)).sub(Pw)
      const d2 = max(dot(d, d), 1e-10)
      const rr = t.w.mul(c.r).mul(t.w.mul(c.r))
      // (a vertex inside or against the capsule is its own finger or a neighbour's root: fade it out rather than black it)
      const dl = d2.sqrt()
      sum.addAssign(min(rr.div(d2), 0.55).mul(clamp(dot(Nn, d).div(dl), 0, 1)).mul(smoothstep(t.w.mul(c.r * 0.9), t.w.mul(c.r * 1.6), dl)))
    }
    })
    return sum.mul(O.strength)
    })().toVarying() as F
  }
  // every rest frame is the model's axes, so two bones that share a vertex differ by exactly the joint's bend: sin^2 of half of it
  const qd = dot(qs[0], qs[1])
  const flex = clamp(float(1).sub(qd.mul(qd)).mul(4), 0, 1).mul(clamp(Wt.y.mul(2.5), 0, 1))
  return {
    vTan: (attribute("aTan", "vec3") as V3).toVarying() as V3,
    flex: flex.toVarying() as F,
    heading: h2.yz.toVarying() as THREE.Node<"vec2">,
    trunk: trunk ? { c: [trunk[0], trunk[1], trunk[2]], r: [trunk[3], trunk[4], trunk[5]] } : null,
    clip: cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(P, 1)) as THREE.Node<"vec4">,
    world: P,
    vW: P.toVarying() as V3,
    vN: normalize(N).toVarying() as V3,
    vRest: positionGeometry.toVarying() as V3,
    vRestN: normalGeometry.toVarying() as V3,
    vBody: aBody.toVarying() as V4,
    vAux: aAux.toVarying() as V4,
    tint: h0.xyz.toVarying() as V3,
    seed: h0.w.toVarying() as F,
    cycle: h1.x.toVarying() as F,
    blink: h1.y.toVarying() as F,
    eye: h1.zw.toVarying() as THREE.Node<"vec2">,
    ...(occ ? { occ } : {}),
  }
}

// ---------------------------------------------------------------- the herd

export type LodSpec = {
  /** Mesh detail for this level (1 = hero). */
  detail: number
  /** Use this level while the animal's bounding sphere covers at least this fraction of the frame height. The last level takes the rest. */
  cover: number
}

export type HerdOpts = {
  spec: CreatureSpec
  count: number
  /** Default: hero (detail 1) above 0.3 of the frame height, reduced (0.45) above 0.07, a far stand-in (0.15) below that. */
  lods?: LodSpec[]
  /** Make the material for one level's skin (`kind` "hide") or cards. Called once per level and kind. */
  material(n: SkinNodes, lod: number, kind: "hide" | "cards"): THREE.NodeMaterial
  /**
   * First level that is posed "lite": no per-flap bone motion on the CPU; the flap rows ripple in the
   * vertex stage instead (see Ripple). Default: the last level when the spec has a metachronal row
   * (a "side" motion with a lag), otherwise never.
   */
  lite?: number
  path: Path
  /** A held object the skin flattens against (see Press): give the same uniforms to every level. */
  press?: Press
  /** Called once per drawn animal, right after it is posed (`rig.q`, `rig.p`, `rig.bone(name)` are its world pose): hang a prop on a bone, place dust under a foot. Keep it allocation-free. */
  after?(i: number, rig: Rig): void
}

export type Herd = {
  /** Add to your scene. World space: leave its transform alone. */
  group: THREE.Group
  rig: Rig
  built: Built[]
  /** Per-animal tint (r, g, b), seeded variation of the base colour: write it once. */
  tint: Float32Array
  /**
   * Pose and place every animal for this frame. `fill(i, drive)` sets the drive for animal i
   * (dist, time, scale, lane, seed, look ...): it is called up to twice per animal and must be pure.
   */
  update(camera: THREE.PerspectiveCamera, fill: (i: number, d: Drive) => void): void
  /** After update(): how many animals each level drew, how many were culled, and the CPU milliseconds of the last update. */
  stats: { drawn: number[]; culled: number; ms: number; overreach: number }
  /** Triangles in one animal at each level. */
  tris: number[]
  /** The bone palette every level reads (rows 0 .. total drawn - 1 are this frame's animals, level by level) and the spec: for things that draw the herd again (shadow.ts). */
  palette: Palette
  spec: CreatureSpec
  /** Geometries whose `instanceCount` update() keeps equal to the number of animals drawn this frame. */
  follow: THREE.InstancedBufferGeometry[]
  dispose(): void
}

const _fr = new THREE.Frustum()
const _m = new THREE.Matrix4()
const _ps = new Float32Array(6)

/** The spec's occluders with their bones resolved (capsules whose bone is missing are dropped). */
export function occCaps(spec: CreatureSpec, rig: Rig): OccCaps | undefined {
  const O = spec.occlusion
  if (!O) return undefined
  const caps = O.caps.map((c) => ({ bone: rig.bone(c.bone), a: c.a, b: c.b, r: c.r })).filter((c) => c.bone >= 0)
  return { gates: O.gates, caps, strength: O.strength ?? 1 }
}

export function makeHerd(o: HerdOpts): Herd {
  const lods = o.lods ?? [{ detail: 1, cover: 0.3 }, { detail: 0.45, cover: 0.07 }, { detail: 0.15, cover: 0 }]
  const built = lods.map((l) => buildCreature(o.spec, l.detail))
  const rig = makeRig(o.spec, built[0])
  const pal = makePalette(rig.bones, o.count)
  const group = new THREE.Group()
  const row = (o.spec.motions ?? []).find((m) => m.axis === "side" && (m.lag ?? 0) > 0 && !m.channel)
  const liteFrom = o.lite ?? (row ? lods.length - 1 : lods.length)
  let z0 = 0
  for (const r of built[0].part("body").rings) z0 = Math.max(z0, r.w)
  const ripple: Ripple | undefined = row ? { amp: (row.amp ?? 0) + (row.ampK ?? 0) * 0.5, lag: row.lag ?? 0, rate: row.rate ?? 1, tipLag: row.tipLag ?? 0, z0: z0 * 0.85 } : undefined
  const meshes: { hide: THREE.Mesh; cards: THREE.Mesh | null; base: { value: number } }[] = built.map((b, lod) => {
    const base = uniform(0)
    const oc = o.spec.occlusion && (lod < lods.length - 1 || lods.length === 1) ? occCaps(o.spec, rig) : undefined
    const n = skinNodes(pal, base, lod >= liteFrom ? ripple : undefined, built[0].trunk, o.spec.skinning === "dq" || oc || o.press ? { dq: o.spec.skinning === "dq", occ: oc, press: o.press } : undefined)
    const mk = (g: THREE.BufferGeometry, kind: "hide" | "cards") => {
      const m = new THREE.Mesh(g, o.material(n, lod, kind))
      m.frustumCulled = false // three's bounds know nothing of the palette: the herd culls per animal
      m.name = `${o.spec.name}-${kind}-lod${lod}`
      group.add(m)
      return m
    }
    return { hide: mk(b.hide, "hide"), cards: b.cards ? mk(b.cards, "cards") : null, base }
  })
  const drive = makeDrive(o.path)
  const lodOf = new Int8Array(o.count)
  const drawn = lods.map(() => 0)
  const next = lods.map(() => 0)
  const stats = { drawn, culled: 0, ms: 0, overreach: 0 }
  const tint = new Float32Array(o.count * 3).fill(1)
  const tv: [number, number, number] = [1, 1, 1]
  const R = (rig.radius + rig.excursion) * 1.08
  const follow: THREE.InstancedBufferGeometry[] = []

  function update(camera: THREE.PerspectiveCamera, fill: (i: number, d: Drive) => void) {
    const t0 = performance.now()
    camera.updateMatrixWorld()
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    // (the projection differs per backend: rebuilt every frame from the live camera, with its own depth convention)
    _fr.setFromProjectionMatrix(_m, camera.coordinateSystem, camera.reversedDepth)
    const pl = _fr.planes
    const ce = camera.matrixWorld.elements
    const tanH = Math.tan((camera.fov * Math.PI) / 360) / (camera.zoom || 1)
    for (let l = 0; l < drawn.length; l++) drawn[l] = 0
    stats.culled = 0
    stats.overreach = 0
    for (let i = 0; i < o.count; i++) {
      fill(i, drive)
      const sc = drive.scale
      drive.path.at(drive.dist + rig.centre[0] * sc, _ps)
      const hl = Math.hypot(_ps[3], _ps[5]) || 1
      const cx = _ps[0] - (_ps[5] / hl) * drive.lane, cz = _ps[2] + (_ps[3] / hl) * drive.lane
      const cy = (o.spec.gait ? (drive.ground ? drive.ground(cx, cz) : 0) : _ps[1]) + rig.centre[1] * sc + drive.rise
      const r = R * sc
      let lod = -1
      let inside = true
      for (let k = 0; k < 6 && inside; k++) inside = pl[k].normal.x * cx + pl[k].normal.y * cy + pl[k].normal.z * cz + pl[k].constant >= -r
      if (inside) {
        // size on screen, from distance along the view axis: a pure function of this frame (no hysteresis: seek must match play)
        const depth = -((cx - ce[12]) * ce[8] + (cy - ce[13]) * ce[9] + (cz - ce[14]) * ce[10])
        const cover = r / (Math.max(depth, 1e-3) * tanH)
        lod = lods.length - 1
        for (let l = 0; l < lods.length - 1; l++)
          if (cover >= lods[l].cover) {
            lod = l
            break
          }
        drawn[lod]++
      } else stats.culled++
      lodOf[i] = lod
    }
    let base = 0
    for (let l = 0; l < lods.length; l++) {
      next[l] = base
      meshes[l].base.value = base
      const g = meshes[l].hide.geometry as THREE.InstancedBufferGeometry
      // (an empty level stays visible with no instances: hiding it would keep it out of the scene's warm-up compile)
      g.instanceCount = drawn[l]
      const c = meshes[l].cards
      if (c) {
        ;(c.geometry as THREE.InstancedBufferGeometry).instanceCount = drawn[l]
      }
      base += drawn[l]
    }
    for (let k = 0; k < follow.length; k++) follow[k].instanceCount = base
    for (let i = 0; i < o.count; i++) {
      const lod = lodOf[i]
      if (lod < 0) continue
      fill(i, drive)
      rig.pose(drive, lod >= liteFrom)
      if (rig.info.overreach > stats.overreach) stats.overreach = rig.info.overreach
      tv[0] = tint[i * 3]
      tv[1] = tint[i * 3 + 1]
      tv[2] = tint[i * 3 + 2]
      rig.write(pal.data, next[lod]++, pal.width, tv)
      if (o.after) o.after(i, rig)
    }
    pal.tex.needsUpdate = true
    stats.ms = performance.now() - t0
  }

  return {
    palette: pal, spec: o.spec, follow,
    group, rig, built, tint, update, stats,
    tris: built.map((b) => b.tris),
    dispose() {
      for (const m of meshes) {
        m.hide.geometry.dispose()
        ;(m.hide.material as THREE.Material).dispose()
        m.cards?.geometry.dispose()
        ;(m.cards?.material as THREE.Material | undefined)?.dispose()
      }
      pal.tex.dispose()
    },
  }
}

