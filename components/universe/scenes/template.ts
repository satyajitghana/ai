// Scene 1, template: "A Brief History of Everything."
//
// Idea. The trap: the default white deck. Arial, a blue footer, a spreadsheet chart with
// "Series 1" in its legend. On the third click it starts arguing with itself in the margin, picks
// the full stop at the end of its own title, and leaves through it.
//
// Story parameter. Seconds into beat 3 (`t2`). Everything on the third beat is a row of the
// timetable `T` below: select the empty row, the reviewer's two comments, the push back to the
// title, select the full stop, "Start here.", the dive. While the hand-off to the next scene runs
// the dive is carried on by `s.exit`, so it ends in the same place whenever "next" was pressed.
//
// World rule. Everything is vector. The page is Canvas 2D drawn through the type layer's
// zoomable view and re-rasterised at the zoom, so the push-in stays sharp; the paper and the
// full stop itself are one small TSL pass in the same coordinates, which is where the ink's edge
// gets its fibre once the zoom passes about 8×. At slide scale the paper is exact white: no
// grain, no vignette, no tone map.
//
// Camera. A 2D view about the dot: zoom = exp(ln 25 · in2) inside the beat, then on to DOT_Z1
// during the hand-off, while the dot drifts to DOT_AIM, where the next scene's spark is.
//
// How a scene is laid out (this is the first one, so it doubles as the example):
//   create(ctx)  builds targets, uniforms, passes and constants once
//   update(s)    turns State into this frame's numbers, in one preallocated struct (`V`)
//   type(g, s)   describes the Canvas 2D layer from `V`
//   render(s)    draws from `V` and ends with ctx.finish
//   portal(s)    reports the frame-within-the-frame from `V`
// Nothing is remembered between frames, so seek, back and live play give the same picture.

import * as THREE from "three/webgpu"
import { abs, clamp as clampN, cos, dFdx, dFdy, dot, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, sin, smoothstep, step, uniform, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, smooth } from "../engine/ease"
import { H, type Pos } from "../engine/synth"
import { DH, DW, type Type2D } from "../engine/text"
import { fbm, hash22, smoothstepRev, type F, type V2 } from "../engine/tsl"
import type { Ctx, Cue, Portal, SceneInstance, State } from "../engine/types"
import { comment, SELECT } from "../engine/ui"
import { DOT_AIM, DOT_FALL, DOT_Z0, DOT_Z1 } from "../transitions/dot"

// ---------------------------------------------------------------- the slide master
const INK = "#000000"
const GREY = "#7f7f7f"
const BODY = "#262626"
const CHART = "#404040"
const BLUE = "#4472c4" // the spreadsheet's first series colour
const RULE = "#b4c7e7"
const GRID = "#d9d9d9"
const TITLE_SIZE = 96
const TITLE_Y = 470
const DOT_R = 5.7 // the full stop, drawn round, in design px

// ---------------------------------------------------------------- the chart (beat 2)
// Rows and values restate the beat's own line in script.ts; the axis runs 0 to 14 billion years.
const ROWS: { name: string; v: number; label: string }[] = [
  { name: "Universe", v: 13.8, label: "13.8" },
  { name: "Earth", v: 4.54, label: "4.54" },
  { name: "Life", v: 3.7, label: "3.7" },
  { name: "Animals", v: 0.57, label: "0.57" },
  { name: "Humans", v: 0, label: "0.0003" },
]
const BULLETS = ["The universe", "Earth", "Life", "Animals", "Humans", "Questions"]
const CH = { x: 900, y: 236, w: 900, h: 640, x0: 1100, x1: 1740, top: 336, row: 84, bar: 44 }
const rowY = (i: number) => CH.top + CH.row * i + CH.row / 2

// ---------------------------------------------------------------- the timetable of beat 3
const C1 = "Where is the last bar?"
const C2 = "It is there. It is about 0.002% of the axis."
const C3 = "Start here."
const CPS = 19
const T = {
  sel1: 0.35, // the empty row is selected
  c1: 0.9, c1out: 3.2,
  c2: 4.0, c2out: 7.95,
  c2pause: 0.8, // "It is there." Then the reviewer stops, and the selection shows where
  shrink: [5.0, 5.75], // the selection closes on where the bar would be
  sel1out: 8.8,
  push: [9.15, 9.65], // back to the title slide
  sel2: 9.85, // the full stop is selected
  c3: 10.15, c3out: 11.2,
  sel2out: 11.45,
  dive: [11.6, 13.6],
}
const typedAt = (t0: number, n: number) => t0 + 0.25 + n / CPS
const C2A = C2.indexOf(".") + 1 // the first sentence of the second comment
/** The reviewer's clock for one comment: an optional pause while typing, and deleting at twice the speed. */
function reviewer(t: number, out: number, pauseAt = Infinity, pause = 0) {
  let u = t < pauseAt ? t : t < pauseAt + pause ? pauseAt : t - pause
  const o = pauseAt < out ? out - pause : out
  if (u > o) u = o + (u - o) * 2
  return u
}

// the pointer: [seconds, x, y]; it eases from each stop to the next
const HUMAN_Y = rowY(4)
type Stop = [number, number, number]

export function create(ctx: Ctx): SceneInstance {
  const beats = ctx.def.beats
  const title = beats[0].head.replace(/\.$/, "")
  const sub = beats[0].sub ?? ""
  const arial = ctx.fonts.arial

  // Measure the title once, so the full stop's exact place is known to the shader and the portal.
  const mc = document.createElement("canvas").getContext("2d")!
  mc.font = `400 ${TITLE_SIZE}px ${arial}`
  const wFull = mc.measureText(title + ".").width
  const wBody = mc.measureText(title).width
  const X0 = DW / 2 - wFull / 2
  const DX = X0 + wBody + (wFull - wBody) * 0.5
  const DY = TITLE_Y - DOT_R + 0.4
  // the title in three pieces, so a deep zoom only rasterises the glyph that is still in frame
  const cut1 = title.lastIndexOf(" ") + 1
  const SEG = [title.slice(0, cut1), title.slice(cut1, -1), title.slice(-1)]
  const SEGX = [X0, X0 + mc.measureText(SEG[0]).width, X0 + mc.measureText(title.slice(0, -1)).width]
  const SEGCULL = [5, 16, 95] // zoom past which each piece has left the frame

  const AIMX = DOT_AIM[0] * DW
  const AIMY = (1 - DOT_AIM[1]) * DH
  const LN0 = Math.log(DOT_Z0)
  const LN1 = Math.log(DOT_Z1)

  const CURSOR: Stop[] = [
    [0, 1420, 930], [T.sel1 - 0.05, 1330, HUMAN_Y + 8], [T.shrink[0], 1330, HUMAN_Y + 8], [T.shrink[1], CH.x0 + 8, HUMAN_Y + 10],
    [T.push[0], CH.x0 + 8, HUMAN_Y + 10], [T.sel2 - 0.05, DX + 5, DY + 7], [T.sel2out, DX + 5, DY + 7], [T.dive[0] + 0.3, DX + 190, DY + 150],
  ]

  // This frame's numbers. Filled by update(), read by type(), render() and portal().
  const V = {
    t2: -1, // seconds into beat 3 (forced past the comments once the hand-off has begun)
    z: 1, sx: DX, sy: DY, rot: 0, // the view: the dot is drawn at (sx, sy), everything scaled by z and turned by rot about it
    push: 0, // 0 = agenda page, 1 = title page (beat 3 only)
    titleX: 0, agendaX: DW, // horizontal offset of each page while one pushes the other out
    titleOn: true, agendaOn: false,
  }

  // The paper and the full stop. Coordinates are design px measured from the dot's centre, so
  // the shader keeps its precision at any zoom.
  const sheet = ctx.target({})
  const U = {
    uDot: uniform(new THREE.Vector3(DX, DY, 1)), // where the dot's centre is on screen (design px, y down), and the zoom
    uR: uniform(DOT_R),
    uInk: uniform(1),
    uFib: uniform(0),
  }
  // one layer of paper fibre: a short curled strand in every unit cell
  const strands = Fn(([p, aa]: [V2, F]) => {
    const i = floor(p).toVar()
    const f = fract(p).toVar()
    const a = float(0).toVar()
    Loop({ type: "int", start: -1, end: 1, condition: "<=" }, { type: "int", start: -1, end: 1, condition: "<=" }, ({ i: y, j: x }) => {
      const g = vec2(float(x), float(y)).toVar()
      const h = hash22(i.add(g)).toVar()
      const ang = h.x.sub(0.5).mul(2.4).add(step(0.82, h.y).mul(1.3)).toVar() // mostly along the machine direction
      const dir = vec2(cos(ang), sin(ang)).toVar()
      const v = f.sub(g).sub(hash22(i.add(g).add(17.3))).toVar()
      const along = dot(v, dir).toVar()
      const across = dot(v, vec2(dir.y.negate(), dir.x)).add(sin(along.mul(4.5).add(h.x.mul(20))).mul(0.1)).toVar()
      const len = h.y.mul(0.5).add(0.5).toVar()
      const w = h.x.mul(0.035).add(0.03).toVar()
      const m = smoothstep(w, w.add(aa), abs(across)).oneMinus().mul(smoothstep(len.sub(0.15), len, abs(along)).oneMinus())
      a.assign(max(a, m.mul(h.y.mul(0.5).add(0.5))))
    })
    return a
  }).setLayout({ name: "strands", type: "float", inputs: [{ name: "p", type: "vec2" }, { name: "aa", type: "float" }] })

  const paper = ctx.pass(
    ({ uv, res }) => {
      const fd = vec2(uv.x, uv.y.oneMinus()).mul(vec2(1920, 1080))
      const q = fd.sub(U.uDot.xy).div(U.uDot.z).toVar() // design px from the dot's centre
      const ppx = res.x.div(1920).mul(U.uDot.z).toVar() // screen px per design px
      // Deep inside the ink the answer is black whatever the paper does: nothing below can move the
      // edge by more than 0.7 design px. Once the dot fills the frame (the hand-off) that is every pixel.
      const out = vec3(0).toVar()
      If(length(q).sub(U.uR).greaterThan(-1).or(U.uInk.lessThan(1)), () => {
        const col = vec3(1).toVar()
        const l1 = float(0).toVar()
        const l2 = float(0).toVar()
        const l3 = float(0).toVar()
        If(U.uFib.greaterThan(0), () => {
          // three sizes of fibre, each let in once its cells are a few pixels across
          const c1 = 1.15
          const c2 = 0.31
          const c3 = 0.085
          // (a layer whose cells are under 5 px has weight 0: it is not evaluated at all)
          l1.assign(strands(q.div(c1).add(11), float(1.3).div(ppx.mul(c1))).mul(smoothstep(5, 15, ppx.mul(c1))))
          If(ppx.mul(c2).greaterThan(5), () => {
            l2.assign(strands(q.div(c2).add(37), float(1.3).div(ppx.mul(c2))).mul(smoothstep(5, 15, ppx.mul(c2))))
          })
          If(ppx.mul(c3).greaterThan(5), () => {
            l3.assign(strands(q.div(c3).add(71), float(1.3).div(ppx.mul(c3))).mul(smoothstep(5, 15, ppx.mul(c3))))
          })
          const relief = l1.add(l2.mul(0.7)).add(l3.mul(0.5)).toVar()
          const lit = dFdx(relief).sub(dFdy(relief)) // a low light from the top left
          const tone = float(1)
            .sub(U.uFib.mul(fbm(q.mul(0.8).add(3)).sub(0.5).mul(0.05).add(0.05)))
            .add(U.uFib.mul(l1.mul(0.045).add(l2.mul(0.035)).add(l3.mul(0.025))))
            .add(U.uFib.mul(clampN(lit.mul(0.5), -0.06, 0.04)))
          col.assign(min(vec3(tone).mul(mixN(vec3(1), vec3(1, 0.992, 0.972), U.uFib)), 1))
        })
        // the full stop: a disc at slide scale, ink that has run along the fibres up close
        const d = length(q).sub(U.uR).toVar()
        // (the edge only roughens past 2x zoom; below that the three fbm calls are skipped, not multiplied by zero)
        If(U.uDot.z.greaterThan(2), () => {
          const rough = smoothstep(2, 12, U.uDot.z)
          d.addAssign(rough.mul(fbm(q.mul(2.1).add(5)).sub(0.5).mul(0.36).add(fbm(q.mul(8).add(9)).sub(0.5).mul(0.13)).add(fbm(q.mul(34).add(2)).sub(0.5).mul(0.04))))
        })
        d.subAssign(U.uFib.mul(l1.mul(0.26).add(l2.mul(0.11)).add(l3.mul(0.04))).mul(smoothstepRev(0.5, -0.25, d)))
        const soft = max(float(0.75).div(ppx), 0.012).toVar()
        const ink = smoothstep(soft.negate(), soft, d).oneMinus()
        const bleed = smoothstep(-0.05, 0.45, d).oneMinus().mul(U.uFib) // a grey halo where a little dye got further
        col.mulAssign(bleed.mul(0.16).mul(max(l1, l2).mul(0.6).add(0.4)).oneMinus())
        col.mulAssign(ink.mul(U.uInk).oneMinus())
        out.assign(col)
      })
      return vec4(out, 1)
    },
    U,
  )
  const uDot = U.uDot.value

  const port: Portal = { c: [[0, 0], [0, 0], [0, 0], [0, 0]], a: 1, shade: 1 }

  // ---------------------------------------------------------------- the pages
  function titlePage(g: Type2D) {
    for (let i = 0; i < 3; i++) if (V.z < SEGCULL[i]) g.text(SEG[i], SEGX[i], TITLE_Y, { size: TITLE_SIZE, font: "arial", color: INK, style: "none" })
    if (V.z < 8) g.text(sub, DW / 2, 590, { size: 44, font: "arial", color: GREY, align: "center", style: "none" })
  }

  function agendaPage(g: Type2D, t1: number) {
    g.text("Agenda", 130, 176, { size: 80, font: "arial", color: INK, style: "none" })
    // bullets "fly in" from the bottom edge, one after another
    BULLETS.forEach((b, i) => {
      const p = E.out3(clamp((t1 - (0.35 + i * 0.3)) / 0.5))
      if (p <= 0) return
      const y = 350 + i * 92
      g.text("•   " + b, 150, y + (1 - p) * (DH + 60 - y), { size: 44, font: "arial", color: BODY, style: "none" })
    })
    // the chart object appears, then its bars wipe in from the axis
    const a = clamp((t1 - 1.7) / 0.3)
    if (a <= 0) return
    g.rect(CH.x, CH.y, CH.w, CH.h, { stroke: GRID, lw: 1.5, alpha: a })
    g.text("Project timeline (to scale)", CH.x + CH.w / 2, CH.y + 58, { size: 32, font: "arial", color: CHART, align: "center", style: "none", alpha: a })
    const bottom = CH.top + CH.row * ROWS.length
    for (let v = 0; v <= 14; v += 2) {
      const x = mix(CH.x0, CH.x1, v / 14)
      g.line(x, CH.top, x, bottom + (v % 14 === 0 ? 8 : 0), { color: v === 0 ? "#8c8c8c" : GRID, lw: v === 0 ? 2 : 1.5, alpha: a })
    }
    g.text("0", CH.x0, bottom + 38, { size: 24, font: "arial", color: CHART, align: "center", style: "none", alpha: a })
    g.text("14", CH.x1, bottom + 38, { size: 24, font: "arial", color: CHART, align: "center", style: "none", alpha: a })
    g.text("Billion years", (CH.x0 + CH.x1) / 2, bottom + 40, { size: 22, font: "arial", color: GREY, align: "center", style: "none", alpha: a })
    g.rect(CH.x + CH.w / 2 - 70, CH.y + CH.h - 44, 16, 16, { fill: BLUE, alpha: a })
    g.text("Series 1", CH.x + CH.w / 2 - 44, CH.y + CH.h - 29, { size: 22, font: "arial", color: CHART, style: "none", alpha: a })
    ROWS.forEach((r, i) => {
      const y = rowY(i)
      g.text(r.name, CH.x0 - 18, y + 9, { size: 26, font: "arial", color: CHART, align: "right", style: "none", alpha: a })
      const t0 = 2.3 + i * 0.3
      const w = (r.v / 14) * (CH.x1 - CH.x0) * E.io2(clamp((t1 - t0) / 0.65))
      if (w > 0.5) g.rect(CH.x0, y - CH.bar / 2, w, CH.bar, { fill: BLUE })
      const la = clamp((t1 - t0 - 0.65) / 0.2)
      // a label inside the bar when it fits, beside it when it does not
      const inside = (r.v / 14) * (CH.x1 - CH.x0) > 110
      g.text(r.label, inside ? CH.x0 + w - 12 : CH.x0 + w + 12, y + 8, { size: 22, font: "arial", color: inside ? "#ffffff" : CHART, align: inside ? "right" : "left", style: "none", alpha: la })
    })
  }

  function master(g: Type2D, s: State) {
    if (V.z >= 8) return
    // (drawn past the slide's edges, so the camera drawing back never shows where they end)
    g.rect(-DW, DH - 50, DW * 3, 5, { fill: RULE })
    g.rect(-DW, DH - 22, DW * 3, 60, { fill: BLUE })
    // a slide number changes without ceremony
    g.text(beats[s.beat].page, DW - 72, DH - 66, { size: 24, font: "arial", color: GREY, align: "right", style: "none" })
  }

  function pointer(g: Type2D, t: number) {
    if (t < 0 || t > T.dive[0] + 0.3) return
    let i = 0
    while (i < CURSOR.length - 2 && t > CURSOR[i + 1][0]) i++
    const a = CURSOR[i]
    const b = CURSOR[i + 1]
    // it leaves each stop just in time to arrive: the last 0.55 s before the next one
    const u = E.io3(clamp((t - Math.max(a[0], b[0] - 0.55)) / Math.min(0.55, b[0] - a[0] || 1)))
    const x = mix(a[1], b[1], u)
    const y = mix(a[2], b[2], u)
    const alpha = clamp(t / 0.25) * (1 - clamp((t - T.dive[0]) / 0.3))
    if (alpha <= 0) return
    g.custom(`ptr${Math.round(x * 4)},${Math.round(y * 4)},${Math.round(alpha * 50)}`, (c) => {
      c.globalAlpha = alpha
      c.translate(x, y)
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(0, 30)
      c.lineTo(7.5, 23.5)
      c.lineTo(12.5, 35)
      c.lineTo(17.5, 32.8)
      c.lineTo(12.6, 21.6)
      c.lineTo(22, 21.6)
      c.closePath()
      c.shadowColor = "rgba(0,0,0,0.3)"
      c.shadowBlur = 5
      c.shadowOffsetY = 2
      c.fillStyle = "#ffffff"
      c.fill()
      c.shadowColor = "transparent"
      c.lineWidth = 2
      c.strokeStyle = "#111111"
      c.stroke()
    })
  }

  /** A selection box that pops in at `t0` (overshoots, settles) and fades at `out`. */
  function select(g: Type2D, t: number, t0: number, out: number, x: number, y: number, w: number, h: number) {
    const alpha = clamp((t - t0) / 0.1) * (1 - clamp((t - out) / 0.25))
    if (alpha <= 0) return
    const pop = mix(0.6, 1, E.outBack(clamp((t - t0) / 0.3)))
    g.selbox(x + (w * (1 - pop)) / 2, y + (h * (1 - pop)) / 2, w * pop, h * pop, alpha, SELECT)
  }

  // ---------------------------------------------------------------- sound (sheet: beats/sound-template.md)
  // Home harmonic 3. A meeting room: nothing but the clicker, the reviewer's keys and the selection
  // box, each where it is on the page (the slide is the picture plane, so z = 0), until the dive.
  const scr = (px: number, py: number): Pos => [(px / DW) * 2 - 1, 1 - (py / DH) * 2, 0]
  /** One `type` per character of `text[i0..i1)`, at the caret, spaces lower; `bx` is the note's left edge. */
  const typed = (text: string, from: number, to: number, bx: number, y: number, i0 = 0, i1 = text.length): Cue[] =>
    Array.from({ length: i1 - i0 }, (_, k): Cue => {
      const i = i0 + k
      return { b: 2, at: from + ((to - from) * k) / Math.max(1, i1 - i0), s: "type", o: { f: H(text[i] === " " ? 36 : 44 + ((i * 5) % 7)), g: 1.3 + ((i * 37) % 10) / 25, wet: 0.6 }, pos: scr(bx + 24 + i * 15.5, y) }
    })
  /** The note deleting itself at twice the speed: one `delete` for every two characters, running back to its left edge. */
  const erased = (text: string, from: number, bx: number, y: number): Cue[] =>
    Array.from({ length: Math.ceil(text.length / 2) }, (_, k): Cue => ({ b: 2, at: from + (k * 2) / 68, s: "delete", o: { f: H(30 - (k % 3)), g: 1.5, wet: 0.6 }, pos: scr(bx + 24 + (text.length - k * 2) * 15.5, y) }))
  const NOTE_Y = HUMAN_Y - 34 - 44 // the text line of a note that points at the empty row
  const B1 = CH.x0 + 40 + 26
  const B2 = CH.x0 + 10 + 26
  const B3 = DX + 4 + 26
  const dotPos = () => scr(V.sx + V.titleX, V.sy)
  const cues: Cue[] = [
    // the clicker: one dry key per slide (a cue at exactly 0 never fires on a beat entered by "next")
    { b: 1, at: 0.02, s: "key", o: { f: H(52), g: 0.8 } },
    { b: 2, at: 0.02, s: "key", o: { f: H(52), g: 0.8 } },
    // the empty row is selected
    { b: 2, at: T.sel1, s: "select", o: { f: H(24), g: 0.7 }, pos: scr((CH.x0 + CH.x1) / 2, HUMAN_Y) },
    { b: 2, at: T.c1, s: "select", o: { f: H(18), g: 0.4 }, pos: scr(B1, NOTE_Y) },
    ...typed(C1, T.c1 + 0.25, typedAt(T.c1, C1.length), B1, NOTE_Y),
    ...erased(C1, T.c1out, B1, NOTE_Y),
    { b: 2, at: T.c2, s: "select", o: { f: H(18), g: 0.4 }, pos: scr(B2, NOTE_Y) },
    ...typed(C2, T.c2 + 0.25, typedAt(T.c2, C2A), B2, NOTE_Y, 0, C2A),
    // "It is there." The selection closes on where the bar would be
    { b: 2, at: T.shrink[0] + 0.1, s: "select", o: { f: H(27), g: 0.45 }, pos: scr(CH.x0 + 200, HUMAN_Y) },
    { b: 2, at: T.shrink[1], s: "select", o: { f: H(30), g: 0.5 }, pos: scr(CH.x0, HUMAN_Y) },
    ...typed(C2, typedAt(T.c2, C2A) + T.c2pause, typedAt(T.c2, C2.length) + T.c2pause, B2, NOTE_Y, C2A),
    ...erased(C2, T.c2out, B2, NOTE_Y),
    // back to the title slide, and the full stop is selected
    { b: 2, at: T.push[0], s: "key", o: { f: H(52), g: 0.8 } },
    { b: 2, at: T.sel2, s: "select", o: { f: H(36), g: 0.6 }, pos: () => dotPos() },
    { b: 2, at: T.c3, s: "select", o: { f: H(18), g: 0.4 }, pos: scr(B3, DY - 28 - 44) },
    ...typed(C3, T.c3 + 0.25, typedAt(T.c3, C3.length), B3, DY - 28 - 44),
    ...erased(C3, T.c3out, B3, DY - 28 - 44),
    // the big moment: the dive. A swell that ends where the beat does, and the air over the page, at the dot
    { b: 2, at: T.dive[0], s: "riser", o: { f: H(6), dur: T.dive[1] - T.dive[0], g: 0.45 } },
    { b: 2, at: T.dive[0] + 0.25, s: "whoosh", o: { f: H(3), dur: 2.2, g: 0.6 }, pos: () => dotPos() },
  ]

  return {
    cues,

    // what this scene draws, so the engine can compile it before it is shown
    warm: () => [{ pass: paper, target: sheet }],

    update(s) {
      const leaving = s.exit > 0
      // once the hand-off has begun the argument is over, whenever "next" was pressed
      V.t2 = leaving ? Math.max(s.at(2), T.sel2out + 0.3) : s.at(2)
      // (the push back to the title arrives a little hot and settles)
      const pu = clamp((V.t2 - T.push[0]) / (T.push[1] - T.push[0]))
      V.push = s.beat < 2 ? 0 : leaving ? 1 : mix(E.io3(pu), E.outBack(pu), 0.3)
      V.titleOn = s.beat === 0 || V.push > 0
      V.agendaOn = s.beat === 1 || (s.beat === 2 && V.push < 1)
      V.titleX = s.beat === 2 ? (V.push - 1) * DW : 0
      V.agendaX = s.beat === 2 ? V.push * DW : 0
      // the dive, in log space: to DOT_Z0 on the beat's own clock, on to DOT_Z1 on the hand-off's
      // It is a camera move, not a scale: it draws back a touch first, rolls as it goes in, and
      // the fall keeps accelerating until the ink has closed over the frame (DOT_FALL).
      let ln = s.beat < 2 ? 0 : LN0 * E.in2(clamp((V.t2 - T.dive[0]) / (T.dive[1] - T.dive[0])))
      if (s.beat === 2 && !leaving) ln -= 0.05 * Math.sin(Math.PI * clamp((V.t2 - (T.dive[0] - 0.4)) / 0.75))
      if (leaving) {
        const u = clamp(s.exit / DOT_FALL)
        ln = mix(ln, LN1, 0.74 * u + 0.26 * u * u)
      }
      V.z = Math.exp(ln)
      V.rot = -0.075 * Math.sin(Math.PI * clamp(ln / Math.log(14)))
      const c = 0.84 * E.io2(clamp(ln / LN0)) + 0.16 * smooth(0, 0.2, s.exit)
      V.sx = mix(DX, AIMX, c)
      V.sy = mix(DY, AIMY, c)
      // sound: room tone, barely there, that swells as the page gives way
      // (and is cut off when the ink closes over the frame, part-way through the hand-off)
      if (s.live) ctx.synth.bed("hum", (0.1 + 0.9 * clamp(ln / LN0)) * (1 - smooth(0.12, 0.3, s.exit)))
    },

    type(g, s) {
      const view = { x: DX, y: DY, z: V.z, sx: V.sx, sy: V.sy, rot: V.rot }
      if (V.titleOn && V.z < SEGCULL[2]) {
        g.view({ ...view, sx: V.sx + V.titleX })
        titlePage(g)
      }
      if (V.agendaOn) {
        g.view(V.agendaX ? { x: 0, y: 0, z: 1, sx: V.agendaX, sy: 0 } : null)
        agendaPage(g, s.at(1))
      }
      g.view(V.z !== 1 ? view : null)
      master(g, s)
      if (s.beat !== 2 || V.z > 1.5) return
      g.view(null)
      const t = V.t2
      // the reviewer picks the row with no bar in it, then closes in on where the bar would be
      const k = E.io3(clamp((t - T.shrink[0]) / (T.shrink[1] - T.shrink[0])))
      const rx = mix(CH.x0 - 140, CH.x0 - 5, k)
      const rw = mix(CH.x1 - CH.x0 + 160, 10, k)
      select(g, t, T.sel1, T.sel1out, rx, HUMAN_Y - 30, rw, 60)
      select(g, t, T.sel2, T.sel2out, DX - 24, DY - 24, 48, 48)
      comment(g, C1, CH.x0 + 40, HUMAN_Y - 34, reviewer(t, T.c1out), { t0: T.c1, out: T.c1out, cps: CPS })
      comment(g, C2, CH.x0 + 10, HUMAN_Y - 34, reviewer(t, T.c2out, typedAt(T.c2, C2A), T.c2pause), { t0: T.c2, out: T.c2out - T.c2pause, cps: CPS })
      comment(g, C3, DX + 4, DY - 28, reviewer(t, T.c3out), { t0: T.c3, out: T.c3out, cps: CPS, w: 236 })
      pointer(g, t)
    },

    render() {
      uDot.set(V.sx + V.titleX, V.sy, V.z)
      paper.u.uInk.value = V.titleOn ? 1 : 0
      paper.u.uFib.value = smooth(Math.log(6), Math.log(22), Math.log(V.z))
      paper.render(sheet)
      // flat on purpose: no tone map, no bloom, no vignette, no grain, exact white
      ctx.finish(sheet.texture, { tone: "none" })
    },

    // The full stop's own rectangle (uv, y up): the next scene opens out of it.
    portal() {
      const hw = (DOT_R * V.z) / DW
      const hh = (DOT_R * V.z) / DH
      const cx = ((V.sx + V.titleX) / DW) * 2 - 1
      const cy = 1 - (V.sy / DH) * 2
      const c = port.c
      c[0][0] = c[3][0] = cx - hw * 2
      c[1][0] = c[2][0] = cx + hw * 2
      c[0][1] = c[1][1] = cy + hh * 2
      c[2][1] = c[3][1] = cy - hh * 2
      return port
    },

    // The template prints its own Arial slide number, so the engine's clock stays out of it.
    hud: () => ({ color: GREY, hide: true }),
  }
}
