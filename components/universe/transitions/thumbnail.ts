// thumbnail: calendar → here. The last scene becomes a print on the summary slide.
//
// Medium: a photographic print and the white slide's paper. The outgoing frame lifts off the
// screen as a print: a white mat grows round it, a shadow opens under it and it tips a little in
// depth. It flies on an arc to its slot on the incoming slide (the slot the scene reports as its
// portal, or a centred default, so it works from any picture), falls the last stretch with its
// shadow closing faster and faster, and lands at THUMB_IMPACT: a thud, the page shudders
// (`thumbJolt`, which the scene applies to its own view so the two stay locked), the print
// squashes and settles. At THUMB_LAND (`inAt`) the slot accepts it and the frame crossfades to
// the scene, whose print in that slot is the engine's own snapshot of the scene just left.
//
//   0    – .16   lift: the frame shrinks to 0.88, the mat and the shadow come in
//   .06  – .64   flight: size in log space, an arc, a tilt that peaks mid-way and lies flat again;
//                the height (shadow offset and blur) drops as a fall, accelerating
//   .64          impact: thud, a squash and two small bounces, the paper shudders
//   .74  – .82   the slot accepts it; crossfade to the incoming scene
//
// One full-screen pass: the print is a homography of the outgoing frame (box-filtered as it
// shrinks), the mat and keyline are drawn in the print's own uv, and the shadow is a soft box on
// the incoming frame. Corners are computed on the CPU every frame from the progress.

import * as THREE from "three/webgpu"
import { abs, clamp, fwidth, length, max, min, mix, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp as cl, E } from "../engine/ease"
import { portalMatrix, quadTex, quadUV } from "../engine/quad"
import { H } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { sampleRT, type F, type V2 } from "../engine/tsl"
import type { Portal, TransArgs, TransitionDef } from "../engine/types"

export const THUMB_DUR = 2.4
/** Linear progress at which the print hits the paper. */
export const THUMB_IMPACT = 0.64
/** Linear progress at which the slot has it: the incoming scene's first beat starts here. */
export const THUMB_LAND = 0.74
/** The print's white mat, as a fraction of the picture's width (4 px on a 228 px print). */
export const THUMB_MAT = 4 / 228
/** Its grey keyline, the same way. */
export const THUMB_KEY = 1.2 / 228

/** The paper's shudder when the print lands, in design px on screen (y down), at linear progress `pl`. */
export function thumbJolt(pl: number) {
  const t = (pl - THUMB_IMPACT) * THUMB_DUR
  if (t <= 0) return 0
  return 3.2 * Math.exp(-t * 9) * Math.sin(t * 38)
}

/** Where the print lands when the incoming scene has no portal: centred, a third of the frame. */
const DEFAULT_TARGET = { x: DW / 2, y: DH / 2, w: DW * 0.34, h: DW * 0.34 * (9 / 16) }
const FOCAL = 1900 // design px: how strongly a tilt foreshortens

type Frame = { cx: number; cy: number; pw: number; ph: number; mat: number; rx: number; ry: number; rz: number; h: number; lift: number; blend: number }

/** The print's pose at linear progress `pl`, flying from full screen to the target picture rect. */
function pose(pl: number, tg: { x: number; y: number; w: number; h: number }, out: Frame) {
  const lift = E.out3(cl(pl / 0.16))
  const f = E.io3(cl((pl - 0.06) / (THUMB_IMPACT - 0.06)))
  const fall = cl((pl - 0.06) / (THUMB_IMPACT - 0.06))
  const tb = Math.max(0, (pl - THUMB_IMPACT) * THUMB_DUR)
  // after the impact: a squash that rings down, and two small hops of the shadow
  const squash = tb > 0 ? 1 - 0.035 * Math.exp(-tb * 8) * Math.sin(tb * 26 + 0.6) : 1
  const hop = tb > 0 ? 0.07 * Math.exp(-tb * 7) * Math.abs(Math.sin(tb * 17)) : 0
  const w0 = DW * (1 - 0.12 * lift)
  const pw = Math.exp(Math.log(w0) + (Math.log(tg.w) - Math.log(w0)) * f) * squash
  const h0 = DH * (1 - 0.12 * lift)
  const ph = Math.exp(Math.log(h0) + (Math.log(tg.h) - Math.log(h0)) * f) * squash
  const arc = Math.sin(Math.PI * f)
  out.cx = DW / 2 + (tg.x - DW / 2) * f - 40 * arc * lift
  out.cy = DH / 2 + (tg.y - DH / 2) * f - 90 * arc * lift + (tb > 0 ? thumbJolt(pl) : 0)
  out.pw = pw
  out.ph = ph
  out.mat = pw * THUMB_MAT * lift
  out.ry = 0.3 * arc * lift
  out.rx = -0.2 * arc * lift
  out.rz = (-0.05 * arc + 0.018 * (1 - f)) * lift
  out.h = lift * (1 - fall * fall * fall) + hop
  out.lift = lift
  out.blend = E.io2(cl((pl - THUMB_LAND) / 0.08))
  return out
}

/** The frame's four corners (TL, TR, BR, BL) in clip space, after the tilt and a perspective divide. */
function corners(F: Frame, out: Portal["c"]) {
  const W = F.pw + 2 * F.mat
  const Hh = F.ph + 2 * F.mat
  const cy = Math.cos(F.ry), sy = Math.sin(F.ry)
  const cx = Math.cos(F.rx), sx = Math.sin(F.rx)
  const cz = Math.cos(F.rz), sz = Math.sin(F.rz)
  const lp = 1 + 0.05 * F.h // nearer the lens while it is lifted
  const L: [number, number][] = [[-W / 2, -Hh / 2], [W / 2, -Hh / 2], [W / 2, Hh / 2], [-W / 2, Hh / 2]]
  for (let i = 0; i < 4; i++) {
    const x0 = L[i][0], y0 = L[i][1]
    // turn about y, then x, then in the plane
    const x1 = x0 * cy
    let z = x0 * sy
    const y1 = y0 * cx
    z += y0 * sx
    const x2 = x1 * cz - y1 * sz
    const y2 = x1 * sz + y1 * cz
    const k = (FOCAL / (FOCAL + z)) * lp
    const X = F.cx + x2 * k
    const Y = F.cy + y2 * k
    out[i][0] = (X / DW) * 2 - 1
    out[i][1] = 1 - (Y / DH) * 2
  }
  return out
}

const thumbnail: TransitionDef = {
  id: "thumbnail",
  dur: THUMB_DUR,
  inAt: THUMB_LAND,
  ease: (x) => x,
  // Sound: everything on the transition's own progress, so it stays on its picture if hurried.
  snd: [
    // the print lifts off the screen: a paper leaf and the air under it
    { s: "page", p: 0.04, o: { g: 0.55, pos: [0, 0, -0.2] } },
    { s: "whoosh", p: 0.08, o: { f: H(4), dur: 1.1, g: 0.32 } },
    // the fall: a breath of air that closes as the shadow does
    { s: "hiss", p: 0.42, o: { f: H(24), dur: 0.5, g: 0.12 } },
    // impact on the paper, where the slot is (the middle of the frame)
    { s: "thud", p: THUMB_IMPACT, o: { f: H(5), g: 0.5, pos: [-0.06, 0.2, 0.1], lfe: 0.2 } },
    { s: "tick", p: THUMB_IMPACT + 0.004, o: { f: H(40), g: 0.35, pos: [-0.06, 0.2, 0.1] } },
    // the slot accepts it
    { s: "select", p: THUMB_LAND, o: { f: H(24), g: 0.5, pos: [-0.06, 0.2, 0] } },
  ],
  create(ctx) {
    // placeholders of the same kind as the frames they stand for: 8-bit render targets
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      uH: uniform(new THREE.Matrix3()),
      // picture inset in the frame's uv (x, y), keyline width (x, y)
      uM: uniform(new THREE.Vector4()),
      // shadow box centre and half size (uv)
      uS: uniform(new THREE.Vector4()),
      // shadow blur (frame heights), shadow opacity, light on the print, blend to the incoming frame
      uK: uniform(new THREE.Vector4()),
    }
    const pass = ctx.pass(({ uv, res }) => {
      const asp = res.x.div(res.y)
      const B = sampleRT(U.tB, uv).rgb.toVar()
      // the print's shadow on the page: a soft box, blue-grey (it takes more red than blue)
      const p = uv.sub(U.uS.xy).mul(vec2(asp, 1)).toVar()
      const hs = U.uS.zw.mul(vec2(asp, 1))
      const qd = abs(p).sub(hs).toVar()
      const d = length(max(qd, vec2(0))).add(min(max(qd.x, qd.y), 0)).toVar()
      const sh = smoothstep(U.uK.x.negate(), U.uK.x, d).oneMinus().mul(U.uK.y).toVar()
      const page = B.mul(vec3(1).sub(vec3(0.82, 0.74, 0.6).mul(sh))).toVar()
      // the print itself
      const q = quadUV(U.uH, uv).toVar()
      const t = q.xy.toVar()
      const ins = U.uM.xy
      const pu = t.sub(ins).div(vec2(1).sub(ins.mul(2))).toVar() as V2
      const pic = quadTex(U.tA, pu, res.y).toVar()
      const fw = max(fwidth(t), vec2(1e-6)).toVar()
      const inX = min(t.x.sub(ins.x), ins.x.oneMinus().sub(t.x)).div(fw.x)
      const inY = min(t.y.sub(ins.y), ins.y.oneMinus().sub(t.y)).div(fw.y)
      const inPic = clamp(min(inX, inY).add(0.5), 0, 1) as F
      const edX = min(t.x, t.x.oneMinus()).sub(U.uM.z).div(fw.x)
      const edY = min(t.y, t.y.oneMinus()).sub(U.uM.w).div(fw.y)
      const key = clamp(min(edX, edY).add(0.5), 0, 1).oneMinus() as F
      const mat = mix(vec3(0.985), vec3(0.8), key)
      const print = mix(mat, pic, inPic).mul(U.uK.z)
      const col = mix(page, print, q.z).toVar()
      return vec4(clamp(mix(col, B, U.uK.w), 0, 1), 1)
    }, U)

    const fr: Frame = { cx: 0, cy: 0, pw: 0, ph: 0, mat: 0, rx: 0, ry: 0, rz: 0, h: 0, lift: 0, blend: 0 }
    const C: Portal["c"] = [[0, 0], [0, 0], [0, 0], [0, 0]]
    const tg = { ...DEFAULT_TARGET }

    return {
      warm: () => [{ pass, target: hold }],
      render(a: TransArgs) {
        U.tA.value = a.A
        U.tB.value = a.B
        // the target: the incoming scene's portal (the picture of its empty slot) in design px
        if (a.pb) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
          for (const c of a.pb.c) {
            const X = ((c[0] + 1) / 2) * DW
            const Y = ((1 - c[1]) / 2) * DH
            x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y)
          }
          tg.x = (x0 + x1) / 2; tg.y = (y0 + y1) / 2; tg.w = Math.max(8, x1 - x0); tg.h = Math.max(4.5, y1 - y0)
          // the scene's portal already rides the shudder; take it out so it is not applied twice
          tg.y -= thumbJolt(a.pl)
        } else Object.assign(tg, DEFAULT_TARGET)
        pose(a.pl, tg, fr)
        portalMatrix(corners(fr, C), U.uH.value)
        const W = fr.pw + 2 * fr.mat
        const Hh = fr.ph + 2 * fr.mat
        U.uM.value.set(fr.mat / W, fr.mat / Hh, (fr.pw * THUMB_KEY) / W, (fr.pw * THUMB_KEY) / Hh)
        // the shadow falls down and right of the print (light from the top left), wider and softer the higher it is
        const off = fr.h
        const spread = 1 + 0.06 * off
        U.uS.value.set((fr.cx + 30 * off + 5) / DW, 1 - (fr.cy + 44 * off + 7) / DH, ((W / 2) * spread) / DW, ((Hh / 2) * spread) / DH)
        U.uK.value.set((4 + 56 * off) / DH, 0.3 * fr.lift * (1 - 0.4 * off), 1 + 0.2 * fr.ry - 0.12 * fr.rx, fr.blend)
        pass.render(a.out)
      },
    }
  },
}
export default thumbnail
