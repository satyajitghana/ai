// The renderer behind <MapViewer>, imported only after the reader asks for the 3D view.
// three.js loads a .glb whose one mesh is a POINTS primitive with per-vertex colour (height),
// written by the shootout harness from a Voxel-SLAM map, already y-up and centred.

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

export type MapView = {
  load(bytes: ArrayBuffer): Promise<number>
  home(): void
  setPointSize(px: number): void
  dispose(): void
}

export function createMapView(canvas: HTMLCanvasElement): MapView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x0b0b0c, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 5000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = true

  let cloud: THREE.Object3D | null = null
  const materials: THREE.PointsMaterial[] = []
  let radius = 10
  const centre = new THREE.Vector3()
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

  const home = () => {
    // oblique, from above one corner
    camera.position.set(centre.x + radius * 0.9, centre.y + radius * 0.85, centre.z + radius * 0.9)
    controls.target.copy(centre)
    camera.near = Math.max(0.02, radius / 500)
    camera.far = radius * 20
    camera.updateProjectionMatrix()
    camera.lookAt(centre)
    controls.minDistance = radius * 0.05
    controls.maxDistance = radius * 4
    controls.update()
  }

  renderer.setAnimationLoop(() => {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
  })

  const clear = () => {
    if (!cloud) return
    scene.remove(cloud)
    cloud.traverse((o) => {
      const m = o as THREE.Points
      if (m.geometry) m.geometry.dispose()
    })
    for (const m of materials) m.dispose()
    materials.length = 0
    cloud = null
  }

  return {
    async load(bytes) {
      const gltf = await new GLTFLoader().parseAsync(bytes, "")
      if (disposed) return 0
      clear()
      let n = 0
      gltf.scene.traverse((o) => {
        const p = o as THREE.Points
        if (!(p as unknown as { isPoints?: boolean }).isPoints) return
        const hasColour = !!p.geometry.getAttribute("color")
        const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: hasColour, color: hasColour ? 0xffffff : 0x9ca3af })
        p.material = mat
        materials.push(mat)
        n += p.geometry.getAttribute("position").count
      })
      cloud = gltf.scene
      scene.add(cloud)
      const box = new THREE.Box3().setFromObject(cloud)
      box.getCenter(centre)
      radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2)
      home()
      return n
    },
    home,
    setPointSize(px) {
      for (const m of materials) m.size = px
    },
    dispose() {
      disposed = true
      renderer.setAnimationLoop(null)
      ro.disconnect()
      controls.dispose()
      clear()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
