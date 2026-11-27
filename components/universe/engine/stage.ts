// Small things most scenes need: a lit-geometry target, a deterministic camera shake, canvas
// textures for props that carry print, and typing cues.

import * as THREE from "three/webgpu"

import type { Snd } from "./synth"
import type { Ctx, Cue } from "./types"

/** The usual scene target: linear half-float colour, depth, 4× MSAA. */
export const stageTarget = (ctx: Ctx) => ctx.target({ hdr: true, depth: true, samples: 4 })

/** A hand-held wobble that is a pure function of time: sums of incommensurate sines. */
export function shake(time: number, amp = 1, freq = 1): [number, number, number] {
  const t = time * freq
  return [
    amp * (Math.sin(t * 7.13) * 0.5 + Math.sin(t * 12.71 + 1.3) * 0.3 + Math.sin(t * 23.9 + 4.1) * 0.2),
    amp * (Math.sin(t * 8.31 + 2.1) * 0.5 + Math.sin(t * 14.37 + 0.4) * 0.3 + Math.sin(t * 27.1 + 3.3) * 0.2),
    amp * (Math.sin(t * 6.07 + 5.2) * 0.5 + Math.sin(t * 11.3 + 2.2) * 0.5),
  ]
}

/** A texture painted once with Canvas 2D (labels, dials, printed paper). Colour is sRGB. */
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  const c = cv.getContext("2d")!
  draw(c, w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** One key click per character typed between `from` and `to` seconds of beat `b`. */
export function typeCues(b: number, from: number, to: number, chars: number, s: Snd = "key"): Cue[] {
  const out: Cue[] = []
  for (let i = 0; i < chars; i++) out.push({ b, at: from + ((to - from) * i) / Math.max(1, chars), s, o: { g: 0.7 + ((i * 37) % 10) / 30, f: 1700 + ((i * 53) % 9) * 60 } })
  return out
}

/**
 * Dispose every geometry and material under an Object3D, and any texture held directly as a
 * material property. A texture that only lives inside a TSL node graph (`texture(tex)`) cannot be
 * found from here: dispose the textures you create yourself.
 */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const mat of mats) {
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}

/** Minimum on-screen sizes for print that belongs to an object in the world, in pixels of a 720-high frame. */
export const LABEL_MIN = { number: 24, unit: 13, caption: 13 }

const _lp = new THREE.Vector3()
const _lu = new THREE.Vector3()

/**
 * The pixel-size floor for in-world labels (tags, plaques, engraved numerals, a caliper's scale).
 * Given where a label is, how tall its glyphs are in world units and the smallest they may be on
 * screen, returns the factor to scale the label by so it never drops below that size, whatever
 * the camera does. 1 means it is already big enough. `minPx` is measured on a 720-pixel-high
 * frame, so the floor holds at any render size. Pure: call it every frame.
 */
export function labelFloor(at: THREE.Vector3, glyphHeight: number, cam: THREE.PerspectiveCamera, minPx: number): number {
  cam.getWorldDirection(_lu)
  const depth = _lp.copy(at).sub(cam.position).dot(_lu)
  if (depth <= cam.near) return 1
  // world height that one pixel of a 720-high frame covers at that depth
  const perPx = (2 * depth * Math.tan((cam.fov * Math.PI) / 360)) / 720
  const px = glyphHeight / perPx
  return px >= minPx ? 1 : minPx / Math.max(px, 1e-6)
}

/** The on-screen height in pixels (of a 720-high frame) of something `height` world units tall at `at`. */
export function screenPx(at: THREE.Vector3, height: number, cam: THREE.PerspectiveCamera): number {
  cam.getWorldDirection(_lu)
  const depth = Math.max(cam.near, _lp.copy(at).sub(cam.position).dot(_lu))
  return height / ((2 * depth * Math.tan((cam.fov * Math.PI) / 360)) / 720)
}

/** Where the deck's own type sits, in clip space, so in-world labels can keep out of it. */
export const TYPE_ZONES: [number, number, number, number][] = [
  [-1, 0.42, 0.34, 1], //   headline and source line (top left)
  [0.45, 0.8, 1, 1], //     the corner clock (top right)
  [-1, -1, 0.2, -0.86], //  the scene label (bottom left)
]

const _lc = new THREE.Vector3()

/**
 * Screen-space check for one label, from its four world-space corners: how tall it is on a
 * 720-high frame, how much of it is inside the frame, and how much of it sits under the deck's
 * own type. Occlusion by scene geometry is not known here: a scene must place its labels proud of
 * whatever they are attached to (stood off on a pin or a leader line), and `tools/labels.mjs`
 * measures the truth. In development a label that fails is reported once a second.
 */
export function labelReport(id: string, corners: THREE.Vector3[], cam: THREE.Camera, out: { px: number; inFrame: number; underType: number; clip: [number, number][] }) {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (let i = 0; i < 4; i++) {
    _lc.copy(corners[i]).project(cam)
    out.clip[i][0] = _lc.x
    out.clip[i][1] = _lc.y
    x0 = Math.min(x0, _lc.x)
    x1 = Math.max(x1, _lc.x)
    y0 = Math.min(y0, _lc.y)
    y1 = Math.max(y1, _lc.y)
  }
  const area = Math.max(1e-9, (x1 - x0) * (y1 - y0))
  const ix = Math.max(0, Math.min(x1, 1) - Math.max(x0, -1))
  const iy = Math.max(0, Math.min(y1, 1) - Math.max(y0, -1))
  out.px = ((y1 - y0) / 2) * 720
  out.inFrame = (ix * iy) / area
  let under = 0
  for (const z of TYPE_ZONES) {
    const zx = Math.max(0, Math.min(x1, z[2]) - Math.max(x0, z[0]))
    const zy = Math.max(0, Math.min(y1, z[3]) - Math.max(y0, z[1]))
    under += zx * zy
  }
  out.underType = Math.min(1, under / area)
  if (process.env.NODE_ENV !== "production" && (out.inFrame < 0.97 || out.underType > 0.03)) {
    const now = Date.now()
    if (now - lastLabelWarn > 1000) {
      lastLabelWarn = now
      console.warn(`[universe] label "${id}": ${Math.round(out.inFrame * 100)}% in frame, ${Math.round(out.underType * 100)}% under the deck's type`)
    }
  }
  return out
}
let lastLabelWarn = 0
