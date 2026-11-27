// Scene 28, here: "You are here."
//
// Idea. The template is back, and it is made of callbacks. The white slide of scene 1 (Arial,
// the blue footer, a page number) titled "Summary", and on it the talk itself: a print of every
// scene the viewer saw, the engine's own snapshot of the frame each one was showing when it was
// left, laid along the steel rule of scene 2 as a timeline. The cursor deletes "Summary" and types
// "You are here." with today's date under it; the full stop the talk dived into at the start
// turns pale blue and its twin is set into the rule at the last tick. Then the view draws back
// past the edge of the slide into blank paper, where the next slide is a dashed empty frame, and
// the reviewer asks the last question. The corner clock counts real seconds the whole time.
//
// Story parameter. The edit: seconds into beat 1 (`TT`) and beat 2 (`TB`), and one 2D view
// (`V`: the design point at the centre of the screen and the zoom).
//
// World rule. One view for everything. The type layer draws the vector slide through `g.view`, and
// an orthographic camera is set from the same numbers, so the lit objects on the page (the steel
// rule, the prints, their shadows) move with the type as one sheet. The paper is exact white.
//
// Layout. 28 slots along the rule, one per scene, 61.5 px apart. A print is 228×128 with a 4 px
// mat, wider than a slot, so the prints sit in four rows by `i % 4` (near above, near below, far
// above, far below) and each has a stem to its own tick; the far stems run through the 10 px gaps
// of the near rows. Slot 28 is this slide: no print, a pale-blue dot in the steel. Nothing is
// engraved after it. A scene the viewer never reached is a dashed empty frame.

import * as THREE from "three/webgpu"
import { abs, attribute, clamp, dFdx, dFdy, exp, float, Fn, fwidth, If, length, Loop, max, min, mix, normalize, normalWorld, positionWorld, smoothstep, step, fract, texture, uniform, uniformTexture, uv, vec2, vec3, vec4 } from "three/tsl"

import { ruleGeometry } from "../engine/ages"
import { clamp as cl, E, mix as mx, ramp } from "../engine/ease"
import { stageTarget, canvasTex, disposeTree } from "../engine/stage"
import { H, type Pos } from "../engine/synth"
import { DH, DW, type Type2D } from "../engine/text"
import { sampleRT, toLinear, vnoise } from "../engine/tsl"
import type { Ctx, Cue, Portal, SceneInstance } from "../engine/types"
import { comment, SELECT } from "../engine/ui"
import { SCENES } from "../script"
import { THUMB_DUR, THUMB_IMPACT, THUMB_LAND, thumbJolt } from "../transitions/thumbnail"

// ---------------------------------------------------------------- the slide master (scene 1's)
const INK = "#000000"
const GREY = "#7f7f7f"
const BLUE = "#4472c4"
const RULE_C = "#b4c7e7"
const PALE = [134, 182, 255] as const // the pale blue the full stop turns
const HILITE = "#c5d9f5" // selected text
const TITLE = { x: 128, y: 166, size: 96 }
const SUB = { x: 130, y: 240, size: 40 }

// ---------------------------------------------------------------- the timeline
const X0 = 120
const SP = 61.5
const slotX = (i: number) => X0 + (i + 0.5) * SP
const N = 27 // scenes before this one
const HERE = 27 // this slide's slot
const NEXT = 28 // the next slide's
const PW = 228
const PH = 128.25
const MAT = 4
const OW = PW + 2 * MAT
const OH = PH + 2 * MAT
const KEY = 1.2 // keyline, design px
// row centres by i % 4: near above, near below, far above, far below
const ROW_Y = [534, 786, 384, 936]
const RULE_Y = 660
const RW = 56 // face height
const RX0 = 80
const RX1 = 1850
const RL = RX1 - RX0
const rowY = (i: number) => ROW_Y[i % 4]
const above = (i: number) => i % 4 === 0 || i % 4 === 2

// ---------------------------------------------------------------- the views
const Z0 = 2.4 // where the print lands: calendar's slot, this big
const LAND_SCREEN: [number, number] = [900, 430] // and here on screen
const PUSH = { cx: 562.5, cy: 266.6, z: 1.45 } // beat 1: the title
const WIDE = { cx: 1290, cy: 455, z: 0.7 } // beat 2: the slide and the blank paper past it
// beat 1's hold: down onto the strip, close enough that every print reads (about 240 px wide on a
// 720-line screen), and along it from the first scene to "here", the way the talk went
const DRIFT = { z: 1.55, cy: RULE_Y, x0: RX0 - 30 + DW / 2 / 1.55, x1: RX1 + 60 - DW / 2 / 1.55, down: [8.2, 9.4], pan: [9.4, 14.2] }
/** Beat 1's view at `t` seconds, after the edit has pulled back to the whole slide. */
function driftView(t: number, out: { cx: number; cy: number; z: number }) {
  const d = E.io3(cl((t - DRIFT.down[0]) / (DRIFT.down[1] - DRIFT.down[0])))
  const p = E.io2(cl((t - DRIFT.pan[0]) / (DRIFT.pan[1] - DRIFT.pan[0])))
  const x = mx(DRIFT.x0, DRIFT.x1, p)
  out.z = Math.exp(Math.log(DRIFT.z) * d)
  out.cx = mx(DW / 2, x, d)
  out.cy = mx(DH / 2, DRIFT.cy, d)
  return out
}
const END1 = driftView(1e3, { cx: 0, cy: 0, z: 1 }) // where beat 1 leaves the view, and beat 2 picks it up

// ---------------------------------------------------------------- the edit (beat 1)
const TT = {
  sel1: 0.85, del1: 1.15, typ1: 1.35, cps1: 13,
  sel2: 3.2, del2: 3.5, typ2: 3.7, cps2: 15,
  arrow: 4.95, selDot: 5.45, blue: [5.8, 6.5], selOut: 6.9,
  back: [6.6, 7.8], dot: 7.9,
}
// beat 2
const C1 = "Any questions?"
const C2 = "One. What happens next?"
const C2A = C2.indexOf(".") + 1
const TB = { wide: [0.15, 2.4], ghost: [1.6, 2.3], c1: 2.5, c1out: 4.4, c2: 5.0, pause: 0.8, cps: 17 }
const typedAt = (t0: number, n: number, cps: number) => t0 + 0.25 + n / cps

export function create(ctx: Ctx): SceneInstance {
  const beats = ctx.def.beats
  const arial = ctx.fonts.arial
  const sub0 = beats[0].sub ?? ""
  const T1 = beats[1].head // "You are here."
  const T1body = T1.replace(/\.$/, "")
  // Today's date, on the client (the one place the design allows the wall clock: BUILD.md).
  const DATE = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

  const mc = document.createElement("canvas").getContext("2d")!
  const meas = (s: string, size: number) => {
    mc.font = `400 ${size}px ${arial}`
    return mc.measureText(s).width
  }
  const wSummary = meas(beats[0].head, TITLE.size)
  const wBody = meas(T1body, TITLE.size)
  const wDot = meas(".", TITLE.size)
  const DOT = { x: TITLE.x + wBody + wDot * 0.5, y: TITLE.y - 7.5 } // the full stop's centre
  const wSub = meas(sub0, SUB.size)

  // ---------------------------------------------------------------- the view, this frame
  const V = { cx: DW / 2, cy: DH / 2, z: 1, j: 0, pull: 0 }
  /** Design point → screen design px. */
  const scrX = (x: number) => DW / 2 + (x - V.cx) * V.z
  const scrY = (y: number) => DH / 2 + V.j + (y - V.cy) * V.z
  const lis = (x: number, y: number, z = 0): Pos => [(scrX(x) / DW) * 2 - 1, 1 - (scrY(y) / DH) * 2, z]

  // ---------------------------------------------------------------- the page in 3D
  const stage = stageTarget(ctx)
  const hold = ctx.target({ hdr: false, fixed: [2, 2] }) // a placeholder of the snapshots' kind
  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(0, DW, 0, -DH, 1, 400)
  cam.position.set(0, 0, 200)

  // the paper: exact white
  const paperMat = new THREE.NodeMaterial()
  paperMat.fragmentNode = vec4(1, 1, 1, 1)
  paperMat.depthTest = false
  paperMat.depthWrite = false
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1e5, 1e5), paperMat)
  paper.position.z = -50
  paper.renderOrder = 0
  paper.frustumCulled = false
  scene.add(paper)

  /** A soft box shadow: a plane `w`×`h` plus `blur` each side, blue-grey, at most `op` dark. */
  function shadowMat(w: number, h: number, blur: number, op: number) {
    const m = new THREE.NodeMaterial()
    m.transparent = true
    m.depthTest = false
    m.depthWrite = false
    m.fragmentNode = Fn(() => {
      const p = uv().sub(0.5).mul(vec2(w + 2 * blur, h + 2 * blur)).toVar()
      const q = abs(p).sub(vec2(w / 2, h / 2)).toVar()
      const d = length(max(q, vec2(0))).add(min(max(q.x, q.y), 0))
      const a = smoothstep(-blur * 0.45, blur, d).oneMinus().mul(op)
      return vec4(0.17, 0.2, 0.27, a)
    })()
    return m
  }

  // the prints' shadows: one instanced draw, down and right of each print (light from the top left)
  const SB = 13
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(OW + 2 * SB, OH + 2 * SB), shadowMat(OW, OH, SB, 0.2), N)
  shadows.renderOrder = 2
  shadows.frustumCulled = false
  scene.add(shadows)
  const _m = new THREE.Matrix4()
  const _hide = new THREE.Matrix4().makeScale(0, 0, 0)
  const shadowOn: boolean[] = new Array(N).fill(false)
  for (let i = 0; i < N; i++) shadows.setMatrixAt(i, _hide)

  // the rule's own shadow: a soft one and a tight contact line
  const rsh1 = new THREE.Mesh(new THREE.PlaneGeometry(RL + 24, RW + 24), shadowMat(RL, RW, 12, 0.26))
  rsh1.position.set(RX0 + RL / 2 + 4, -RULE_Y - 7, -2)
  const rsh2 = new THREE.Mesh(new THREE.PlaneGeometry(RL + 6, RW + 6), shadowMat(RL, RW, 3, 0.35))
  rsh2.position.set(RX0 + RL / 2 + 1, -RULE_Y - 2, -1)
  rsh1.renderOrder = rsh2.renderOrder = 1
  scene.add(rsh1, rsh2)

  // ---------------------------------------------------------------- the steel rule (scene 2's bar)
  // Engraved: one long tick per scene, from the top edge for the prints above and the bottom for
  // those below, three graduations between, a scribed line along the far edge. Nothing after "here".
  const face = canvasTex(4096, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    c.fillStyle = "#0b0b0d"
    const px = w / RL
    const py = h / RW
    const X = (x: number) => ((x - RX0) / RL) * w
    const end = slotX(HERE)
    c.fillRect(X(RX0 + 14), 3.2 * py, X(end) - X(RX0 + 14) + 1.2 * px, 1.4 * py)
    for (let i = 0; i <= HERE; i++) {
      const x = X(slotX(i)) - 1.3 * px
      if (above(i)) c.fillRect(x, 3.2 * py, 2.6 * px, 26 * py)
      else c.fillRect(x, 25 * py, 2.6 * px, 26 * py)
      if (i < HERE)
        for (let j = 1; j < 4; j++) {
          const xm = X(slotX(i) + (j * SP) / 4) - 0.8 * px
          c.fillRect(xm, 3.2 * py, 1.6 * px, (j === 2 ? 13 : 8) * py)
        }
    }
    // the leading ticks before the first scene, a hand's width of graduation
    for (let j = 1; j < 4; j++) c.fillRect(X(slotX(0) - (j * SP) / 4) - 0.8 * px, 3.2 * py, 1.6 * px, (j === 2 ? 13 : 8) * py)
  })
  const uLX = uniform(620)
  const steel = new THREE.NodeMaterial()
  steel.transparent = true
  steel.depthTest = false
  steel.depthWrite = false
  steel.fragmentNode = Fn(() => {
    const st = uv().toVar()
    const cut = texture(face, st).toVar()
    const on = attribute("face", "float").toVar()
    const Nn = normalize(normalWorld).toVar()
    const wp = positionWorld.toVar()
    // brushed along its length: long streaks, finer ones, and the finest
    const g = vnoise(vec2(wp.x.mul(0.011), wp.y.mul(0.85)))
      .mul(0.5)
      .add(vnoise(vec2(wp.x.mul(0.045), wp.y.mul(2.9).add(7))).mul(0.3))
      .add(vnoise(vec2(wp.x.mul(0.2), wp.y.mul(9.3).add(3))).mul(0.2))
      .toVar()
    // the view is straight down z: what the steel shows is the room above it reflected
    const R = Nn.mul(Nn.z.mul(2)).sub(vec3(0, 0, 1)).toVar()
    // a long softbox over the top left, and a second, smaller one: they slide a little as the view moves
    const dx1 = wp.x.sub(uLX).div(560)
    const dx2 = wp.x.sub(uLX).sub(820).div(230)
    const room = float(0.42).add(exp(dx1.mul(dx1).negate()).mul(0.85)).add(exp(dx2.mul(dx2).negate()).mul(0.35)).toVar()
    // the bevel tips toward the paper and the near edge of the face catches the white page
    const down = smoothstep(0.04, 0.45, R.y.negate())
    const nearEdge = smoothstep(0.2, 0.1, st.y).mul(0.18)
    const env = mix(room.add(nearEdge), float(1.28), down).toVar()
    const F0 = vec3(0.56, 0.575, 0.6)
    // streaks: the brushing catches the light in fine lines along the bar
    const streak = vnoise(vec2(wp.x.mul(0.006), wp.y.mul(14.7))).toVar()
    const metal = F0.mul(env).mul(g.mul(0.42).add(0.74).add(streak.mul(streak).mul(streak).mul(0.5))).toVar()
    // the sides of the bar (no face) are in shade
    const col = mix(F0.mul(0.3), metal, on).toVar()
    // the cuts: dark, with a hairline of light on the lower lip of each
    const lip = texture(face, st.add(vec2(0, 0.012))).a.mul(cut.a.oneMinus()).mul(0.2)
    col.addAssign(vec3(lip).mul(on))
    col.assign(mix(col, vec3(0.03, 0.032, 0.037), cut.a.mul(on)))
    return vec4(col, 1)
  })()
  const rule = new THREE.Mesh(ruleGeometry({ aspect: RW / RL, segments: 4 }), steel)
  rule.rotation.x = Math.PI / 2 // its engraved surface faces the lens, the bevel at the bottom
  rule.scale.setScalar(RL)
  rule.position.set(RX0 + RL / 2, -RULE_Y, 0)
  rule.renderOrder = 3
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- the prints
  type Print = { mesh: THREE.Mesh; tex: ReturnType<typeof uniformTexture>; seen: THREE.UniformNode<"float", number> }
  const prints: Print[] = []
  const printGeo = new THREE.PlaneGeometry(OW, OH)
  for (let i = 0; i < N; i++) {
    const tex = uniformTexture(hold.texture)
    const seen = uniform(0)
    const m = new THREE.NodeMaterial()
    m.transparent = true
    m.depthTest = false
    m.depthWrite = false
    m.fragmentNode = Fn(() => {
      const p = uv().mul(vec2(OW, OH)).toVar()
      const fw = max(fwidth(p.x), 1e-4).toVar()
      const pu = p.sub(vec2(MAT)).div(vec2(PW, PH)).toVar()
      // the snapshot, box-filtered over this pixel's footprint (a 640×360 target has no mips)
      const dx = dFdx(pu).toVar()
      const dy = dFdy(pu).toVar()
      const foot = max(length(dx.mul(vec2(640, 360))), length(dy.mul(vec2(640, 360)))).toVar()
      const pic = vec3(0).toVar()
      If(seen.greaterThan(0.5), () => {
        If(foot.lessThan(1.3), () => {
          pic.assign(toLinear(sampleRT(tex, pu).rgb))
        }).Else(() => {
          Loop({ type: "int", start: 0, end: 4 }, { type: "int", start: 0, end: 4 }, ({ i: a, j: b }) => {
            const o = vec2(float(a), float(b)).add(0.5).div(4).sub(0.5)
            pic.addAssign(toLinear(sampleRT(tex, pu.add(dx.mul(o.x)).add(dy.mul(o.y))).rgb))
          })
          pic.divAssign(16)
        })
      })
      const inside = min(min(p.x.sub(MAT), float(OW - MAT).sub(p.x)), min(p.y.sub(MAT), float(OH - MAT).sub(p.y)))
      const inPic = clamp(inside.div(fw).add(0.5), 0, 1)
      const ex = min(p.x, float(OW).sub(p.x)).toVar()
      const ey = min(p.y, float(OH).sub(p.y)).toVar()
      const eo = min(ex, ey).toVar()
      const kw = max(float(KEY), fw).toVar()
      const key = clamp(kw.sub(eo).div(fw).add(0.5), 0, 1)
      const print = mix(mix(vec3(1), vec3(0.6), key), pic, inPic)
      // never shown: a dashed hairline where its print would be
      const along = ex.lessThan(ey).select(p.y, p.x)
      const dash = step(0.42, fract(along.div(10)))
      const lw = max(float(1.6), fw.mul(1.3)).toVar()
      const line = clamp(lw.sub(eo).div(fw).add(0.5), 0, 1).mul(dash).mul(0.75)
      return vec4(mix(vec3(0.5), print, seen), mix(line, float(1), seen))
    })()
    const mesh = new THREE.Mesh(printGeo, m)
    mesh.position.set(slotX(i), -rowY(i), 1)
    mesh.renderOrder = 4
    mesh.frustumCulled = false
    scene.add(mesh)
    prints.push({ mesh, tex, seen })
  }
  const ids = SCENES.slice(0, N).map((d) => d.id)
  const port: Portal = { c: [[0, 0], [0, 0], [0, 0], [0, 0]], a: 1, shade: 1 }

  // ---------------------------------------------------------------- the type layer
  function master(g: Type2D) {
    // drawn far past the slide's edges, so drawing back never shows where they end
    g.rect(-DW * 2, DH - 50, DW * 5, 5, { fill: RULE_C })
    g.rect(-DW * 2, DH - 22, DW * 5, 60, { fill: BLUE })
    g.text(beats[0].page, DW - 72, DH - 66, { size: 24, font: "arial", color: GREY, align: "right", style: "none" })
  }

  function blinkOn(t: number, idleFrom: number) {
    return t < idleFrom || Math.sin((t - idleFrom) * 7.5) > -0.35
  }

  function caret(g: Type2D, x: number, y: number, size: number) {
    g.rect(x + 3, y - size * 0.78, 3.5, size * 0.95, { fill: INK })
  }

  /** The title and the line under it, as the edit has left them at `t` seconds into beat 1. */
  function texts(g: Type2D, t: number, b2: boolean) {
    const blue = b2 ? 1 : E.io2(cl((t - TT.blue[0]) / (TT.blue[1] - TT.blue[0])))
    // title
    if (t < TT.del1) {
      if (t >= TT.sel1) g.rect(TITLE.x - 4, TITLE.y - 88, wSummary + 10, 110, { fill: HILITE })
      g.text(beats[0].head, TITLE.x, TITLE.y, { size: TITLE.size, font: "arial", color: INK, style: "none" })
    } else {
      const n = Math.min(T1.length, Math.floor(Math.max(0, t - TT.typ1) * TT.cps1 + 1e-6))
      const body = T1.slice(0, Math.min(n, T1body.length))
      if (body) g.text(body, TITLE.x, TITLE.y, { size: TITLE.size, font: "arial", color: INK, style: "none" })
      if (n > T1body.length) {
        const c = `rgb(${Math.round(PALE[0] * blue)},${Math.round(PALE[1] * blue)},${Math.round(PALE[2] * blue)})`
        g.text(".", TITLE.x + wBody, TITLE.y, { size: TITLE.size, font: "arial", color: c, style: "none" })
      }
      const typingEnd = TT.typ1 + T1.length / TT.cps1
      if (t < TT.sel2 && blinkOn(t, typingEnd + 0.3)) caret(g, TITLE.x + meas(T1.slice(0, n), TITLE.size), TITLE.y, TITLE.size)
    }
    // the line under it
    if (t < TT.del2) {
      if (t >= TT.sel2) g.rect(SUB.x - 4, SUB.y - 38, wSub + 10, 50, { fill: HILITE })
      g.text(sub0, SUB.x, SUB.y, { size: SUB.size, font: "arial", color: GREY, style: "none" })
    } else {
      const n = Math.min(DATE.length, Math.floor(Math.max(0, t - TT.typ2) * TT.cps2 + 1e-6))
      if (n > 0) g.text(DATE.slice(0, n), SUB.x, SUB.y, { size: SUB.size, font: "arial", color: GREY, style: "none" })
      const typingEnd = TT.typ2 + DATE.length / TT.cps2
      if (t < TT.arrow && blinkOn(t, typingEnd + 0.3)) caret(g, SUB.x + meas(DATE.slice(0, n), SUB.size) - 1, SUB.y, SUB.size)
    }
  }

  /** Stems from each print to its tick. */
  function stems(g: Type2D, seenN: boolean[]) {
    for (let i = 0; i < N; i++) {
      const x = slotX(i)
      const y0 = above(i) ? rowY(i) + OH / 2 : rowY(i) - OH / 2
      const y1 = above(i) ? RULE_Y - RW / 2 : RULE_Y + RW / 2
      g.line(x, y0, x, y1, { color: seenN[i] ? "#a6a6a6" : "#cfcfcf", lw: 1.6, dash: seenN[i] ? undefined : [4, 4] })
    }
  }

  /** The pale-blue twin of the full stop, set into the steel at "here". */
  function hereDot(g: Type2D, t: number) {
    if (t < 0) return
    const pop = E.outBack(cl(t / 0.35))
    const x = slotX(HERE)
    const y = RULE_Y - 2
    const ring = cl(t / 0.9)
    g.custom(`hd${Math.round(pop * 100)},${Math.round(ring * 60)}`, (c) => {
      if (ring < 1) {
        c.globalAlpha = (1 - ring) * 0.7
        c.strokeStyle = `rgb(${PALE.join(",")})`
        c.lineWidth = 2.5
        c.beginPath()
        c.arc(x, y, 10 + ring * 46, 0, Math.PI * 2)
        c.stroke()
      }
      c.globalAlpha = 1
      const r = 10 * pop
      if (r <= 0.2) return
      // a steel bezel, then pale-blue enamel with a highlight at the top left
      c.fillStyle = "#4b4f57"
      c.beginPath()
      c.arc(x, y, r + 1.8, 0, Math.PI * 2)
      c.fill()
      const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
      gr.addColorStop(0, "#e6f0ff")
      gr.addColorStop(0.35, `rgb(${PALE.join(",")})`)
      gr.addColorStop(1, "#4f7fd0")
      c.fillStyle = gr
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    })
  }

  /** The next slide: a dashed empty frame past the end of the rule, drawing itself. */
  function ghost(g: Type2D, q: number) {
    if (q <= 0) return
    const x0 = slotX(NEXT) - OW / 2
    const y0 = rowY(NEXT) - OH / 2
    const per = 2 * (OW + OH)
    let left = q * per
    const seg: [number, number, number, number][] = [[x0, y0, x0 + OW, y0], [x0 + OW, y0, x0 + OW, y0 + OH], [x0 + OW, y0 + OH, x0, y0 + OH], [x0, y0 + OH, x0, y0]]
    for (const [ax, ay, bx, by] of seg) {
      if (left <= 0) break
      const L = Math.hypot(bx - ax, by - ay)
      const u = Math.min(1, left / L)
      g.line(ax, ay, ax + (bx - ax) * u, ay + (by - ay) * u, { color: "#9a9a9a", lw: 2, dash: [7, 6] })
      left -= L
    }
    // its stem, down to where the rule would be and is not
    const st = cl((q - 0.6) / 0.4)
    if (st > 0) g.line(slotX(NEXT), y0 + OH, slotX(NEXT), y0 + OH + (RULE_Y - RW / 2 - y0 - OH) * st, { color: "#bdbdbd", lw: 1.6, dash: [4, 4] })
  }

  // ---------------------------------------------------------------- the pointer (screen space)
  type Stop = [number, number, number] // seconds, design x, design y (on the page)
  const P_SUM: [number, number] = [TITLE.x + wSummary * 0.55, TITLE.y - 30]
  const P_SUB: [number, number] = [SUB.x + wSub * 0.45, SUB.y - 14]
  const P_DOT: [number, number] = [DOT.x + 4, DOT.y + 4]
  const PATH1: Stop[] = [
    [0, ...P_SUM], [TT.sel1 + 1.2, ...P_SUM], [TT.sel2 - 0.2, ...P_SUB], [TT.arrow, ...P_SUB], [TT.selDot - 0.08, ...P_DOT], [6.3, ...P_DOT], [6.9, DOT.x + 220, DOT.y + 160],
  ]
  function along(path: Stop[], t: number): [number, number] {
    let i = 0
    while (i < path.length - 2 && t > path[i + 1][0]) i++
    const a = path[i]
    const b = path[i + 1]
    const u = E.io3(cl((t - Math.max(a[0], b[0] - 0.5)) / Math.min(0.5, b[0] - a[0] || 1)))
    return [mx(a[1], b[1], u), mx(a[2], b[2], u)]
  }
  function pointer(g: Type2D, x: number, y: number, beam: boolean, alpha: number) {
    if (alpha <= 0) return
    g.custom(`pt${Math.round(x * 4)},${Math.round(y * 4)},${beam ? 1 : 0},${Math.round(alpha * 50)}`, (c) => {
      c.globalAlpha = alpha
      c.translate(x, y)
      c.lineJoin = "round"
      c.beginPath()
      if (beam) {
        // the I-beam: a stem with two serifed bars, black with a white halo
        c.moveTo(-7, -17); c.lineTo(-2, -17); c.lineTo(0, -15); c.lineTo(2, -17); c.lineTo(7, -17)
        c.moveTo(0, -15); c.lineTo(0, 15)
        c.moveTo(-7, 17); c.lineTo(-2, 17); c.lineTo(0, 15); c.lineTo(2, 17); c.lineTo(7, 17)
        c.strokeStyle = "#ffffff"
        c.lineWidth = 5.5
        c.stroke()
        c.strokeStyle = "#111111"
        c.lineWidth = 2.2
        c.stroke()
      } else {
        c.moveTo(0, 0); c.lineTo(0, 31); c.lineTo(7.2, 24.4); c.lineTo(12.2, 35.6); c.lineTo(17.6, 33.2); c.lineTo(12.8, 22.4); c.lineTo(22.4, 22.4); c.closePath()
        c.shadowColor = "rgba(20,30,60,0.32)"
        c.shadowBlur = 6
        c.shadowOffsetY = 2
        c.fillStyle = "#ffffff"
        c.fill()
        c.shadowColor = "transparent"
        c.lineWidth = 2
        c.strokeStyle = "#111111"
        c.stroke()
      }
    })
  }

  // ---------------------------------------------------------------- sound
  // Home harmonic 3, like the template: a meeting room, keys and clicks placed where they happen.
  const typed = (b: number, text: string, from: number, cps: number, x0: number, y: number, size: number, i0 = 0, i1 = text.length, pause = 0, pauseAt = Infinity): Cue[] =>
    Array.from({ length: i1 - i0 }, (_, k): Cue => {
      const i = i0 + k
      const at = from + 0.25 + (i + 1) / cps + (i >= pauseAt ? pause : 0)
      const xc = x0 + meas(text.slice(0, i + 1), size)
      return { b, at, s: "type", o: { f: H(text[i] === " " ? 36 : 44 + ((i * 5) % 7)), g: 1.25 + ((i * 37) % 10) / 25, wet: 0.5 }, pos: () => lis(xc, y) }
    })
  const BX = slotX(NEXT) + OW / 2 // the bubble points at the next slide's top right corner
  const BY = rowY(NEXT) - OH / 2
  const cues: Cue[] = [
    { b: 0, at: 0.4, s: "whoosh", o: { f: H(3), dur: 2.4, g: 0.22, wet: 1.2 } },
    // beat 1: the clicker, then the edit
    { b: 1, at: 0.02, s: "key", o: { f: H(52), g: 0.8 } },
    { b: 1, at: TT.sel1 - 0.1, s: "tick", o: { f: H(40), g: 0.5 }, pos: () => lis(...P_SUM) },
    { b: 1, at: TT.sel1 - 0.02, s: "tick", o: { f: H(40), g: 0.5 }, pos: () => lis(...P_SUM) },
    { b: 1, at: TT.sel1, s: "select", o: { f: H(24), g: 0.45 }, pos: () => lis(...P_SUM) },
    { b: 1, at: TT.del1, s: "delete", o: { f: H(30), g: 1.6 }, pos: () => lis(TITLE.x, TITLE.y - 30) },
    ...typed(1, T1, TT.typ1 - 0.25, TT.cps1, TITLE.x, TITLE.y - 30, TITLE.size),
    { b: 1, at: TT.sel2 - 0.16, s: "tick", o: { f: H(40), g: 0.45 }, pos: () => lis(...P_SUB) },
    { b: 1, at: TT.sel2 - 0.08, s: "tick", o: { f: H(40), g: 0.45 }, pos: () => lis(...P_SUB) },
    { b: 1, at: TT.sel2, s: "tick", o: { f: H(40), g: 0.45 }, pos: () => lis(...P_SUB) },
    { b: 1, at: TT.sel2 + 0.02, s: "select", o: { f: H(27), g: 0.4 }, pos: () => lis(...P_SUB) },
    { b: 1, at: TT.del2, s: "delete", o: { f: H(30), g: 1.6 }, pos: () => lis(SUB.x, SUB.y - 14) },
    ...typed(1, DATE, TT.typ2 - 0.25, TT.cps2, SUB.x, SUB.y - 14, SUB.size),
    { b: 1, at: TT.selDot - 0.05, s: "tick", o: { f: H(40), g: 0.5 }, pos: () => lis(DOT.x, DOT.y) },
    { b: 1, at: TT.selDot, s: "select", o: { f: H(36), g: 0.6 }, pos: () => lis(DOT.x, DOT.y) },
    // the full stop turns pale blue: the one long pad of the scene
    { b: 1, at: TT.blue[0], s: "pad", o: { f: H(4), dur: 16, g: 0.5 } },
    // its twin set into the steel at "here"
    { b: 1, at: TT.dot, s: "marimba", o: { f: H(16), g: 0.5 }, pos: () => lis(slotX(HERE), RULE_Y) },
    { b: 1, at: TT.dot + 0.01, s: "tick", o: { f: H(48), g: 0.35 }, pos: () => lis(slotX(HERE), RULE_Y) },
    // beat 2: the clicker, the view drawing back, the next slide's frame, the reviewer
    { b: 2, at: 0.02, s: "key", o: { f: H(52), g: 0.8 } },
    { b: 2, at: TB.wide[0] + 0.05, s: "whoosh", o: { f: H(2), dur: 2.2, g: 0.28, wet: 1.4 } },
    { b: 2, at: TB.ghost[0], s: "scratch", o: { f: H(30), g: 0.18, dur: 0.6 }, pos: () => lis(slotX(NEXT), rowY(NEXT), 0.3) },
    { b: 2, at: TB.c1, s: "select", o: { f: H(18), g: 0.4 }, pos: () => lis(BX + 120, BY - 60) },
    ...typed(2, C1, TB.c1, 19, BX + 50, BY - 60, 30),
    ...Array.from({ length: Math.ceil(C1.length / 2) }, (_, k): Cue => ({ b: 2, at: TB.c1out + (k * 2) / 34, s: "delete", o: { f: H(30 - (k % 3)), g: 1.4, wet: 0.5 }, pos: () => lis(BX + 50 + meas(C1, 30) * (1 - (k * 2) / C1.length), BY - 60) })),
    { b: 2, at: TB.c2, s: "select", o: { f: H(18), g: 0.4 }, pos: () => lis(BX + 120, BY - 60) },
    ...typed(2, C2, TB.c2, TB.cps, BX + 50, BY - 60, 30, 0, C2.length, TB.pause, C2A),
  ]

  // ---------------------------------------------------------------- the frame's numbers
  const seenN: boolean[] = new Array(N).fill(false)
  let dotT = -1

  return {
    cues,
    warm: () => [{ scene, camera: cam, target: stage }],

    update(s) {
      // the view, beat by beat (each ends where the next begins)
      V.j = s.enter < 1 ? thumbJolt(s.enter) : 0
      if (s.beat === 0) {
        const u = cl((s.t - 0.35) / 2.65)
        const e = mx(E.io3(u), E.outBack(u), 0.28)
        const z = Math.exp(Math.log(Z0) * (1 - e))
        const ax = slotX(N - 1)
        const ay = rowY(N - 1)
        const sx = mx(LAND_SCREEN[0], ax, e)
        const sy = mx(LAND_SCREEN[1], ay, e)
        V.z = z
        V.cx = ax + (DW / 2 - sx) / z
        V.cy = ay + (DH / 2 - sy) / z
        V.pull = 0
      } else if (s.beat === 1) {
        const w = s.k(1, 0.2, 1.3, E.io3) * (1 - s.k(1, TT.back[0], TT.back[1], E.io3))
        V.z = Math.exp(Math.log(PUSH.z) * w)
        V.cx = mx(DW / 2, PUSH.cx, w)
        V.cy = mx(DH / 2, PUSH.cy, w)
        if (s.t > DRIFT.down[0]) driftView(s.t, V)
        V.pull = 0
      } else {
        const w = s.k(2, TB.wide[0], TB.wide[1], E.io3)
        const creep = 1 + 0.02 * E.io2(ramp(s.t, 3, 17))
        V.z = Math.exp(mx(Math.log(END1.z), Math.log(WIDE.z), w)) * creep
        V.cx = mx(END1.cx, WIDE.cx, w)
        V.cy = mx(END1.cy, WIDE.cy, w)
        V.pull = w
      }
      dotT = s.beat === 1 ? s.t - TT.dot : s.beat > 1 ? 10 : -1
      // the ortho camera from the same view
      cam.left = V.cx - DW / 2 / V.z
      cam.right = V.cx + DW / 2 / V.z
      cam.top = -(V.cy - (DH / 2 + V.j) / V.z)
      cam.bottom = -(V.cy + (DH / 2 - V.j) / V.z)
      cam.updateProjectionMatrix()
      // the light's reflection slides a little along the steel as the view moves
      uLX.value = 620 + 0.22 * (V.cx - DW / 2)
      // the prints: the engine's snapshots of every scene the viewer has left; calendar's waits for its print to land
      for (let i = 0; i < N; i++) {
        const snap = ctx.snapshot(ids[i])
        const landed = i !== N - 1 || s.enter >= THUMB_IMPACT
        const on = !!snap && landed
        seenN[i] = on
        prints[i].seen.value = on ? 1 : 0
        if (snap) prints[i].tex.value = snap
        prints[i].mesh.visible = landed
        if (on !== shadowOn[i]) {
          shadowOn[i] = on
          shadows.setMatrixAt(i, on ? _m.makeTranslation(slotX(i) + 6, -rowY(i) - 8, 0.5) : _hide)
          shadows.instanceMatrix.needsUpdate = true
        }
      }
      // the room: a little air that widens as the view draws back past the slide
      if (s.live) ctx.synth.bed("air", 0.06 + 0.22 * V.pull)
    },

    type(g, s) {
      const t1 = s.beat === 1 ? s.t : s.beat > 1 ? 1e3 : -1e3
      const t2 = s.beat === 2 ? s.t : -1e3
      g.view({ x: V.cx, y: V.cy, z: V.z, sx: DW / 2, sy: DH / 2 + V.j })
      master(g)
      texts(g, t1, s.beat >= 2)
      stems(g, seenN)
      hereDot(g, dotT)
      if (s.beat === 2) ghost(g, E.io2(cl((t2 - TB.ghost[0]) / (TB.ghost[1] - TB.ghost[0]))))
      // the deck's selection box on the full stop: scene 1's last selection, met again
      if (s.beat === 1) {
        const a = cl((t1 - TT.selDot) / 0.1) * (1 - cl((t1 - TT.selOut) / 0.25))
        if (a > 0) {
          const pop = mx(0.6, 1, E.outBack(cl((t1 - TT.selDot) / 0.3)))
          const w = 48 * pop
          g.selbox(DOT.x - w / 2, DOT.y - w / 2, w, w, a, SELECT)
        }
      }
      // the pointer and the corner clock live on the screen, not the page
      g.view(null)
      // the reviewer, at the next slide past the page's edge (on the screen, at full size, to be read)
      if (s.beat === 2) {
        const w = Math.max(meas(C1, 30), meas(C2, 30)) + 56
        const bx = scrX(BX)
        const by = scrY(BY)
        comment(g, C1, bx, by, t2, { t0: TB.c1, out: TB.c1out, cps: 19, w })
        let u = t2
        const pAt = typedAt(TB.c2, C2A, TB.cps)
        if (u > pAt) u = u < pAt + TB.pause ? pAt : u - TB.pause
        comment(g, C2, bx, by, u, { t0: TB.c2, cps: TB.cps, w })
      }
      if (s.beat === 0 && s.t > 5) {
        const u = E.io3(cl((s.t - 5) / 1.3))
        pointer(g, mx(DW * 0.78, scrX(P_SUM[0]), u), mx(DH * 0.9, scrY(P_SUM[1]), u), true, cl((s.t - 5) / 0.3))
      } else if (s.beat === 1 && t1 < 7) {
        const [px, py] = along(PATH1, t1)
        pointer(g, scrX(px), scrY(py), t1 < TT.arrow, 1 - cl((t1 - 6.4) / 0.5))
      }
      // the clock that has not stopped: seconds since the print landed. Beat 0 is read flat, as if
      // nothing happened, so it appears with the edit. (Live, the scene's clock started with the hand-off.)
      if (s.beat >= 1) {
        const sec = Math.max(0, Math.floor(s.live ? s.time - THUMB_DUR * THUMB_LAND : s.time))
        const txt = sec < 1 ? "now" : sec < 60 ? `now + ${sec} s` : `now + ${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`
        const q = s.beat === 1 ? cl(s.t / 0.6) : 1
        g.text(txt, DW - 64, 76, { size: 22, font: "mono", weight: 500, color: GREY, align: "right", track: 0.02, style: "none", alpha: 0.85 * q })
      }
    },

    render() {
      ctx.renderer.setRenderTarget(stage)
      ctx.renderer.render(scene, cam)
      // flat on purpose, like scene 1: no tone map, no bloom, no vignette, exact white
      ctx.finish(stage.texture, { tone: "none" })
    },

    // calendar's slot: the picture of the print the outgoing scene lands as (clip space, y up)
    portal() {
      const x = slotX(N - 1)
      const y = rowY(N - 1)
      const c = port.c
      const xl = (scrX(x - PW / 2) / DW) * 2 - 1
      const xr = (scrX(x + PW / 2) / DW) * 2 - 1
      const yt = 1 - (scrY(y - PH / 2) / DH) * 2
      const yb = 1 - (scrY(y + PH / 2) / DH) * 2
      c[0][0] = c[3][0] = xl
      c[1][0] = c[2][0] = xr
      c[0][1] = c[1][1] = yt
      c[2][1] = c[3][1] = yb
      return port
    },

    // the template prints its own page number; the corner clock is drawn above, counting
    hud: () => ({ color: GREY, hide: true }),

    dispose() {
      face.dispose()
      printGeo.dispose()
      disposeTree(scene)
    },
  }
}

