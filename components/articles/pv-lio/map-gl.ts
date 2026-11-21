// The renderer behind <MapViewer>, imported only after the reader asks for 3D.
// The .glb files are the shootout harness's map exports (harness/eval/map.py): one POINTS
// primitive, int16 positions under KHR_mesh_quantization (node.scale holds the unit), RGBA8
// height colours, already in glTF's y-up axes and centred on the reference trajectory's mean, so
// two systems' maps of one sequence share a frame and can be swapped in place.

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

export type MapView = {
  show(bytes: ArrayBuffer, key: string): Promise<number>
  setSize(px: number): void
  home(): void
  /** a new sequence: drop what is shown and frame the next map afresh */
  reset(): void
  dispose(): void
}

export function createMapView(canvas: HTMLCanvasElement): MapView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x0b0b0c, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 2000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8

  const loader = new GLTFLoader()
  const cache = new Map<string, THREE.Object3D>()
  let current: THREE.Object3D | null = null
  let pointPx = 1.6
  let radius = 10
  let homed = false
  let disposed = false

  const fit = () => {
    const box = canvas.parentElement ?? canvas
    const cw = Math.max(1, box.clientWidth)
    const ch = Math.max(1, box.clientHeight)
    renderer.setSize(cw, ch, false)
    camera.aspect = cw / ch
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(fit)
  ro.observe(canvas.parentElement ?? canvas)
  fit()

  const styleMaterials = (o: THREE.Object3D) => {
    o.traverse((c) => {
      const pts = c as THREE.Points
      if (!pts.isPoints) return
      const old = pts.material as THREE.Material
      pts.material = new THREE.PointsMaterial({ size: pointPx, sizeAttenuation: false, vertexColors: true })
      old.dispose()
    })
  }

  const home = () => {
    const r = radius
    camera.position.set(r * 0.55, r * 0.75, r * 0.85)
    controls.target.set(0, 0, 0)
    camera.near = Math.max(0.02, r / 500)
    camera.far = r * 20
    camera.updateProjectionMatrix()
    controls.maxDistance = r * 4
    controls.update()
  }

  renderer.setAnimationLoop(() => {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
  })

  return {
    async show(bytes, key) {
      let obj = cache.get(key)
      if (!obj) {
        const gltf = await loader.parseAsync(bytes, "")
        obj = gltf.scene
        styleMaterials(obj)
        cache.set(key, obj)
      }
      if (current) scene.remove(current)
      current = obj
      scene.add(obj)
      let n = 0
      obj.traverse((c) => {
        const pts = c as THREE.Points
        if (pts.isPoints) n += pts.geometry.getAttribute("position").count
      })
      if (!homed) {
        const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere())
        radius = Math.max(2, sphere.radius)
        home()
        homed = true
      }
      return n
    },
    setSize(px) {
      pointPx = px
      for (const o of cache.values()) {
        o.traverse((c) => {
          const pts = c as THREE.Points
          if (pts.isPoints) (pts.material as THREE.PointsMaterial).size = px
        })
      }
    },
    home,
    reset() {
      if (current) scene.remove(current)
      current = null
      homed = false
    },
    dispose() {
      disposed = true
      ro.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      for (const o of cache.values()) {
        o.traverse((c) => {
          const pts = c as THREE.Points
          if (pts.isPoints) {
            pts.geometry.dispose()
            ;(pts.material as THREE.Material).dispose()
          }
        })
      }
      renderer.dispose()
    },
  }
}
