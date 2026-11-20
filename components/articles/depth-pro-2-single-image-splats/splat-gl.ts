// The renderer behind <SplatViewer>, loaded only after the reader clicks "View in 3D".
// three.js draws the scene; Spark (@sparkjsdev/spark, MIT) sorts and splats the Gaussians.
//
// Frames. SHARP writes its Gaussians in the OpenCV camera frame of the photo: x right, y down,
// z forward, metres, the camera at the origin. Turning the mesh half a turn about x puts it in
// three.js's frame (y up, the camera looking down -z), so the input view is a camera at the
// origin looking at -z, with the photo's own field of view. The orbit pivot sits on the optical
// axis at the scene's median depth, and every limit (how far the camera may swing, how close it
// may come) is a fraction of that depth, because a single photo only holds near its own view.

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark"

export type SceneGeom = {
  /** photo size in pixels and its focal length in pixels (the one SHARP was given) */
  w: number
  h: number
  fPx: number
  /** median depth of the front layer, metres: where the orbit pivot sits */
  depth: number
  /** how far the camera may swing about the pivot, degrees (yaw, pitch) */
  yaw: number
  pitch: number
}

export type View = {
  load(bytes: Uint8Array, geom: SceneGeom): Promise<void>
  /** start (or restart) the slow arc around the input view */
  arc(on: boolean): void
  /** back to the input view: the photo's own camera */
  home(): void
  /** the number of splats in the loaded scene */
  count(): number
  dispose(): void
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function createView(canvas: HTMLCanvasElement, opts: { onUser?: () => void; onArcEnd?: () => void; reduced?: boolean }): View {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x0b0b0c, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 2000)
  const spark = new SparkRenderer({ renderer })
  scene.add(spark)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.6

  let mesh: SplatMesh | null = null
  let geom: SceneGeom | null = null
  let arcOn = false
  let arcT0 = 0
  let disposed = false

  const pivot = new THREE.Vector3()
  const spherical = new THREE.Spherical()

  // the photo "covers" the canvas, exactly as the <img> does with object-fit: cover, so the input
  // view of the splat lines up with the photo and the depth map drawn over it
  const fitCamera = () => {
    const box = canvas.parentElement ?? canvas
    const cw = Math.max(1, box.clientWidth)
    const ch = Math.max(1, box.clientHeight)
    renderer.setSize(cw, ch, false)
    camera.aspect = cw / ch
    if (geom) {
      const photoAspect = geom.w / geom.h
      const halfV = Math.atan(geom.h / 2 / geom.fPx)
      const halfH = Math.atan(geom.w / 2 / geom.fPx)
      const v = camera.aspect > photoAspect ? Math.atan(Math.tan(halfH) / camera.aspect) : halfV
      camera.fov = THREE.MathUtils.radToDeg(2 * v)
    }
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(fitCamera)
  ro.observe(canvas.parentElement ?? canvas)

  const limits = () => {
    if (!geom) return
    const d = geom.depth
    controls.target.copy(pivot)
    controls.minDistance = d * 0.45
    controls.maxDistance = d * 1.12
    controls.minAzimuthAngle = -THREE.MathUtils.degToRad(geom.yaw)
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(geom.yaw)
    controls.minPolarAngle = Math.PI / 2 - THREE.MathUtils.degToRad(geom.pitch)
    controls.maxPolarAngle = Math.PI / 2 + THREE.MathUtils.degToRad(geom.pitch)
  }

  const home = () => {
    if (!geom) return
    camera.position.set(0, 0, 0)
    camera.up.set(0, 1, 0)
    camera.lookAt(pivot)
    controls.update()
  }

  // the arc: out to one edge of what the photo supports, a pause there, across to the other edge,
  // back to the photo's own view, with a slight dolly in on the way; 14 s in all
  const ARC = 14
  const arcPose = (t: number) => {
    if (!geom) return
    const yaw = THREE.MathUtils.degToRad(geom.yaw) * 0.96
    const pitch = THREE.MathUtils.degToRad(geom.pitch) * 0.5
    const k = t / ARC
    let a: number
    if (k < 0.2) a = ease(k / 0.2) * yaw
    else if (k < 0.3) a = yaw
    else if (k < 0.6) a = yaw - 2 * yaw * ease((k - 0.3) / 0.3)
    else if (k < 0.7) a = -yaw
    else a = -yaw + yaw * ease((k - 0.7) / 0.3)
    const p = Math.sin(k * Math.PI * 2) * pitch
    const dist = geom.depth * (1 - 0.18 * Math.sin(k * Math.PI))
    spherical.set(dist, Math.PI / 2 - p, a)
    camera.position.setFromSpherical(spherical).add(pivot)
    camera.lookAt(pivot)
  }

  const user = () => {
    if (arcOn) {
      arcOn = false
      controls.enabled = true
      opts.onUser?.()
    }
  }
  canvas.addEventListener("pointerdown", user)
  canvas.addEventListener("wheel", user, { passive: true })

  renderer.setAnimationLoop((now) => {
    if (disposed) return
    if (arcOn) {
      const t = (now - arcT0) / 1000
      if (t >= ARC) {
        arcOn = false
        controls.enabled = true
        home()
        opts.onArcEnd?.()
      } else arcPose(t)
    } else controls.update()
    renderer.render(scene, camera)
  })

  return {
    async load(bytes, g) {
      if (mesh) {
        scene.remove(mesh)
        mesh.dispose()
        mesh = null
      }
      geom = g
      pivot.set(0, 0, -g.depth)
      fitCamera()
      limits()
      const m = new SplatMesh({ fileBytes: bytes, fileName: "scene.spz" })
      // OpenCV (y down, z forward) to three.js (y up, z back): half a turn about x
      m.quaternion.set(1, 0, 0, 0)
      await m.initialized
      if (disposed) {
        m.dispose()
        return
      }
      mesh = m
      scene.add(m)
      home()
    },
    arc(on) {
      if (on && !opts.reduced && geom) {
        arcOn = true
        controls.enabled = false
        arcT0 = performance.now()
      } else {
        arcOn = false
        controls.enabled = true
      }
    },
    home() {
      arcOn = false
      controls.enabled = true
      home()
    },
    count() {
      return mesh?.packedSplats?.numSplats ?? 0
    },
    dispose() {
      disposed = true
      renderer.setAnimationLoop(null)
      canvas.removeEventListener("pointerdown", user)
      canvas.removeEventListener("wheel", user)
      ro.disconnect()
      controls.dispose()
      if (mesh) {
        scene.remove(mesh)
        mesh.dispose()
      }
      spark.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
