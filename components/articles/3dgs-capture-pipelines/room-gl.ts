// The renderer behind <RoomViewer>, imported only after the reader clicks "View in 3D".
// three.js draws the scene; Spark (@sparkjsdev/spark, MIT) sorts and splats the Gaussians.
//
// Frame. The .spz was written already in three.js's frame: y up (gravity from the cameras, turned
// right way up, since FIORD's frames are stored upside down), x along one pair of walls, metres at
// about 0.6 m per SfM unit, the origin on the floor under the middle of the tripod path. So the
// mesh needs no rotation. The orbit pivots at the middle of the camera path, 1.3 m up, and the
// camera may not leave the room: the walls are about 6.7 m and 5.4 m apart.

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark"

export type RoomView = {
  load(bytes: Uint8Array): Promise<void>
  home(): void
  count(): number
  dispose(): void
}

const PIVOT = new THREE.Vector3(0.36, 1.3, 1.12)
const HOME = new THREE.Vector3(1.4, 1.6, -0.9)

export function createRoomView(canvas: HTMLCanvasElement): RoomView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x0b0b0c, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 1, 0.02, 200)
  const spark = new SparkRenderer({ renderer })
  scene.add(spark)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.6
  controls.minDistance = 0.4
  controls.maxDistance = 2.8
  controls.minPolarAngle = THREE.MathUtils.degToRad(35)
  controls.maxPolarAngle = THREE.MathUtils.degToRad(120)
  controls.target.copy(PIVOT)

  let mesh: SplatMesh | null = null
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
    camera.position.copy(HOME)
    camera.up.set(0, 1, 0)
    controls.target.copy(PIVOT)
    camera.lookAt(PIVOT)
    controls.update()
  }
  home()

  renderer.setAnimationLoop(() => {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
  })

  return {
    async load(bytes) {
      const m = new SplatMesh({ fileBytes: bytes, fileName: "room.spz" })
      await m.initialized
      if (disposed) {
        m.dispose()
        return
      }
      mesh = m
      scene.add(m)
      home()
    },
    home,
    count() {
      return mesh?.packedSplats?.numSplats ?? 0
    },
    dispose() {
      disposed = true
      renderer.setAnimationLoop(null)
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
