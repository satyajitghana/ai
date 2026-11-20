// The demo's renderer. Loaded only after the reader presses "Run it": this module is the
// one that pulls in three.js, OrbitControls and the meshoptimizer WASM.
//
// One cluster DAG, built here from a procedural rock, shared by every copy of the rock.
// Each frame, for each copy, the cut is chosen on the CPU with the flat form of Nanite's
// rule (a cluster is drawn when its producing group's projected error is at most tau and
// its consuming group's is above tau). The chosen (copy, cluster) pairs are written into a
// pool of BatchedMesh instances through three's public API, and three draws them with one
// WEBGL_multi_draw call where the browser has the extension.

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { MeshoptClusterizer } from "meshoptimizer/clusterizer"
import { MeshoptSimplifier } from "meshoptimizer/simplifier"
import { makeRock } from "./mesh"
import { buildDag, type Dag } from "./dag"
import { LEVEL_COLORS } from "./palette"

export type Mode = "shaded" | "clusters" | "levels"

export type DemoStats = {
  tris: number // triangles in this frame's cut, all copies
  clusters: number
  sourceTris: number // triangles in the scene at full detail
  frameMs: number // smoothed time between animation frames
  cutMs: number // smoothed time to choose the cut
  capped: boolean // the draw list hit the instance pool
  multiDraw: boolean
}

export type DemoInfo = {
  rockTris: number
  copies: number
  clusters: number
  groups: number
  levels: number
  rootTris: number
  buildMs: number
}

export type Demo = {
  setTau: (px: number) => void
  setMode: (m: Mode) => void
  setFrozen: (f: boolean) => void
  resize: () => void
  setActive: (on: boolean) => void
  dispose: () => void
  info: DemoInfo
}

const POOL = 65536
const GRID = 5
const SPACING = 3.2

function clusterColor(c: number, out: THREE.Color) {
  let h = Math.imul(c + 1, 2654435761) >>> 0
  h ^= h >>> 15
  out.setHSL((h & 1023) / 1023, 0.55 + ((h >>> 10) & 63) / 300, 0.5 + ((h >>> 16) & 63) / 400)
  return out
}


export async function createDemo(
  host: HTMLElement,
  opts: { subdiv: number },
  onProgress: (msg: string, frac: number) => void,
  onStats: (s: DemoStats) => void,
  signal: { cancelled: boolean },
): Promise<Demo | null> {
  const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0))
  onProgress("loading meshoptimizer", 0.02)
  await Promise.all([MeshoptClusterizer.ready, MeshoptSimplifier.ready])
  if (signal.cancelled) return null

  onProgress("generating the rock", 0.05)
  await yieldFrame()
  const t0 = performance.now()
  const mesh = makeRock(opts.subdiv)
  const dag: Dag = await buildDag(mesh, MeshoptClusterizer, MeshoptSimplifier, async (msg, f) => {
    onProgress(msg, 0.08 + f * 0.8)
    await yieldFrame()
    if (signal.cancelled) throw new Error("cancelled")
  })
  const buildMs = performance.now() - t0
  if (signal.cancelled) return null

  // ---- three.js
  onProgress("uploading clusters", 0.9)
  await yieldFrame()
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const gl = renderer.getContext()
  const multiDraw = !!gl.getExtension("WEBGL_multi_draw")
  host.appendChild(renderer.domElement)
  renderer.domElement.style.display = "block"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  renderer.domElement.style.touchAction = "none"

  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#1b1f27")
  scene.add(new THREE.HemisphereLight("#cfd8e6", "#3a3128", 1.1))
  const sun = new THREE.DirectionalLight("#fff4e0", 2.4)
  sun.position.set(4, 7, 3)
  scene.add(sun)

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500)
  camera.position.set(3.2, 2.4, 9.5)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.minDistance = 0.6
  controls.maxDistance = 150

  // every cluster becomes one geometry of the batch, with its own compact vertex block
  const C = dag.clusterCount
  const local = new Int32Array(dag.positions.length / 3).fill(-1)
  let totalV = 0
  const vCount = new Uint32Array(C)
  for (let c = 0; c < C; c++) {
    const s = dag.cIdxStart[c], n = dag.cIdxCount[c]
    let nv = 0
    for (let k = s; k < s + n; k++) if (local[dag.cIndices[k]] !== c) { local[dag.cIndices[k]] = c; nv++ }
    vCount[c] = nv
    totalV += nv
  }
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0 })
  const batch = new THREE.BatchedMesh(POOL, totalV, dag.cIndices.length, material)
  batch.perObjectFrustumCulled = false // the cut below already culls, per copy and per cluster
  batch.sortObjects = false
  batch.frustumCulled = false
  local.fill(-1)
  for (let c = 0; c < C; c++) {
    const s = dag.cIdxStart[c], n = dag.cIdxCount[c]
    const pos = new Float32Array(vCount[c] * 3), nrm = new Float32Array(vCount[c] * 3), idx = new Uint32Array(n)
    let nv = 0
    const map = new Map<number, number>()
    for (let k = 0; k < n; k++) {
      const v = dag.cIndices[s + k]
      let l = map.get(v)
      if (l === undefined) {
        l = nv++
        map.set(v, l)
        pos.set(dag.positions.subarray(v * 3, v * 3 + 3), l * 3)
        nrm.set(dag.normals.subarray(v * 3, v * 3 + 3), l * 3)
      }
      idx[k] = l
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    batch.addGeometry(g)
    if ((c & 1023) === 1023) {
      onProgress(`uploading clusters: ${c + 1} of ${C}`, 0.9 + (0.08 * c) / C)
      await yieldFrame()
      if (signal.cancelled) {
        batch.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
        return null
      }
    }
  }
  for (let i = 0; i < POOL; i++) {
    batch.addInstance(0)
    batch.setVisibleAt(i, false)
  }
  batch.setColorAt(0, new THREE.Color("#c9b8a3"))
  scene.add(batch)

  // copies of the rock on a grid, each turned so they do not read as clones
  const copies: { m: THREE.Matrix4; inv: THREE.Matrix4 }[] = []
  for (let gx = 0; gx < GRID; gx++)
    for (let gz = 0; gz < GRID; gz++) {
      const i = gx * GRID + gz
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(((i * 37) % 7) * 0.4, ((i * 53) % 11) * 0.57, 0))
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((gx - (GRID - 1) / 2) * SPACING, 0, (gz - (GRID - 1) / 2) * SPACING),
        q,
        new THREE.Vector3(1, 1, 1),
      )
      copies.push({ m, inv: m.clone().invert() })
    }
  // the object's own bound, for culling whole copies
  let rockR = 0
  for (let v = 0; v < dag.positions.length; v += 3) {
    const d = dag.positions[v] ** 2 + dag.positions[v + 1] ** 2 + dag.positions[v + 2] ** 2
    if (d > rockR) rockR = d
  }
  rockR = Math.sqrt(rockR)

  // ---- per-frame state
  let tau = 1
  let mode: Mode = "shaded"
  let frozen = false
  let dirty = true
  let active = true
  const refine = new Uint8Array(dag.groupCount)
  const slotCopy = new Int32Array(POOL).fill(-1)
  const slotCluster = new Int32Array(POOL).fill(-1)
  let used = 0
  let colorsFor: Mode | null = null
  let capped = false
  const frustum = new THREE.Frustum()
  const pv = new THREE.Matrix4()
  const camL = new THREE.Vector3()
  const sph = new THREE.Sphere()
  const planes = new Float64Array(24)
  const tmpPlane = new THREE.Plane()
  const col = new THREE.Color()
  const lastCam = new THREE.Matrix4()
  let lastW = 0, lastH = 0
  let tris = 0, clusters = 0
  let cutMs = 0, frameMs = 16, lastT = 0
  let statsAt = 0

  const rock = new THREE.Color("#c9b8a3")
  const colorOf = (c: number) =>
    mode === "shaded" ? col.copy(rock)
      : mode === "clusters" ? clusterColor(c, col)
        : col.set(LEVEL_COLORS[Math.min(dag.cLevel[c], LEVEL_COLORS.length - 1)])

  const selectCut = () => {
    const t = performance.now()
    camera.updateMatrixWorld()
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(pv)
    const H = lastH // CSS pixels: tau means the same on a phone and a desktop
    const K = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
    let n = 0
    tris = 0
    clusters = 0
    capped = false
    for (let ci = 0; ci < copies.length && !capped; ci++) {
      const cp = copies[ci]
      sph.center.setFromMatrixPosition(cp.m)
      sph.radius = rockR
      if (!frustum.intersectsSphere(sph)) continue
      camL.copy(camera.position).applyMatrix4(cp.inv)
      for (let k = 0; k < 6; k++) {
        tmpPlane.copy(frustum.planes[k]).applyMatrix4(cp.inv)
        planes[k * 4] = tmpPlane.normal.x
        planes[k * 4 + 1] = tmpPlane.normal.y
        planes[k * 4 + 2] = tmpPlane.normal.z
        planes[k * 4 + 3] = tmpPlane.constant
      }
      // one decision per group, shared by every cluster that names it
      const gS = dag.gSphere, gE = dag.gError
      for (let g = 0; g < dag.groupCount; g++) {
        const o = g * 4
        const dx = gS[o] - camL.x, dy = gS[o + 1] - camL.y, dz = gS[o + 2] - camL.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - gS[o + 3]
        refine[g] = d <= 1e-6 || gE[g] * K > tau * d ? 1 : 0
      }
      const cS = dag.cSphere
      for (let c = 0; c < C; c++) {
        const s = dag.cSelf[c], p = dag.cParent[c]
        if (!((s < 0 || refine[s] === 0) && (p < 0 || refine[p] === 1))) continue
        const o = c * 4, x = cS[o], y = cS[o + 1], z = cS[o + 2], r = cS[o + 3]
        let vis = true
        for (let q = 0; q < 24; q += 4) if (planes[q] * x + planes[q + 1] * y + planes[q + 2] * z + planes[q + 3] < -r) { vis = false; break }
        if (!vis) continue
        if (n >= POOL) { capped = true; break }
        if (slotCopy[n] !== ci) { batch.setMatrixAt(n, cp.m); slotCopy[n] = ci }
        if (slotCluster[n] !== c) {
          batch.setGeometryIdAt(n, c)
          slotCluster[n] = c
          batch.setColorAt(n, colorOf(c))
        }
        if (n >= used) batch.setVisibleAt(n, true)
        n++
        clusters++
        tris += dag.cIdxCount[c] / 3
      }
    }
    for (let i = n; i < used; i++) batch.setVisibleAt(i, false)
    used = n
    cutMs = cutMs * 0.85 + (performance.now() - t) * 0.15
  }

  const recolor = () => {
    for (let i = 0; i < used; i++) batch.setColorAt(i, colorOf(slotCluster[i]))
    // idle slots keep their old colour; forget their cluster so the next fill recolours them
    slotCluster.fill(-1, used)
    colorsFor = mode
  }

  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight)
    if (w === lastW && h === lastH) return
    lastW = w
    lastH = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    dirty = true
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  controls.addEventListener("change", () => { dirty = true })

  let raf = 0
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    if (!active) { lastT = 0; return }
    if (lastT) frameMs = frameMs * 0.9 + (t - lastT) * 0.1
    lastT = t
    controls.update()
    if (!camera.matrixWorld.equals(lastCam)) { dirty = true; lastCam.copy(camera.matrixWorld) }
    if (colorsFor !== mode) recolor()
    if (dirty && !frozen) { selectCut(); dirty = false }
    renderer.render(scene, camera)
    if (t - statsAt > 200) {
      statsAt = t
      onStats({ tris, clusters, sourceTris: dag.leafTris * copies.length, frameMs, cutMs, capped, multiDraw })
    }
  }
  raf = requestAnimationFrame(loop)
  onProgress("ready", 1)

  return {
    info: {
      rockTris: dag.leafTris,
      copies: copies.length,
      clusters: dag.clusterCount,
      groups: dag.groupCount,
      levels: dag.levels,
      rootTris: dag.rootTris,
      buildMs,
    },
    setTau: (px) => { tau = px; dirty = true },
    setMode: (m) => { mode = m },
    setFrozen: (f) => { frozen = f; dirty = true },
    resize,
    setActive: (on) => { active = on },
    dispose: () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      batch.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
