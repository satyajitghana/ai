// Scene 26, horizon: "How long a task can it finish alone?", "Same data. Log axis.",
// "Solid where measured. Dashed where not."
//
// Staging. The top sheet of a pad of engineering graph paper on a cork wall, under a north window.
// The steel rule of ages arrives through `axis` and stands on end on the left margin: it is the y
// axis. Beat 0: its hour scale is cut into it (linear, 0 to 20 h), the eighteen frontier points of
// METR's Time Horizon 1.1 are pinned in release order, faster and faster, and a red cotton thread is
// wound pin to pin: everything sits on the floor until the last few, which are a wall. The camera
// cranes down to look up the wall; the reviewer asks for a log axis. Beat 1: the rule re-denominates
// in seven ×10 clicks (the offset of its log scale falls tenfold each time, so the axis turns from
// linear to logarithmic and every pin is re-pinned at its new height, leaving its old hole); METR's
// 95% intervals rise out of the paper as blued wires; the line is nearly straight. Beat 2: the two
// pooled TH1.1 + TH2 estimates are pinned with hollow brass heads, their intervals running off the
// top, and red-pencil dashes run from the last measured pin to METR's naive extrapolation, 200 h in
// July 2027. The camera rides the thread at grazing height, faster and faster, and stops dead on the
// last pin. Then nothing moves. The template's to-scale bar chart is pinned in the corner.
//
// Story parameter. Beat 1's denomination `k` (0 linear .. 7 log: y = log(1 + h/c) / log(1 + T/c),
// c = 2000 h / 10^k); beat 2's `ride` along the thread.
// World rule. One north-window key from the upper left and the paper's bounce: `lit()` shades every
// surface, and the paper's shader casts every pin, thread, wire, tag and the rule along that key from
// the same arrays that place them. Beat sheet and sources: R/beats/horizon.md.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraPosition, clamp as clampN, cos, dot, exp, float, floor, Fn, fract, fwidth, If, int, length, log, Loop, max, min, mix as mixN, normalize, normalWorld, positionView, positionWorld, pow, round, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ruleArrival, ruleCues, ruleFace, ruleGeometry, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, LABEL_MIN, labelFloor, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, sampleRT, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { comment } from "../engine/ui"
import { AXIS_DUR, AXIS_IN, AXIS_LAND } from "../transitions/axis"

// ---------------------------------------------------------------- the record
// METR, Time Horizon 1.1 (benchmark_results_1_1.yaml): the 18 models the file marks as state of the
// art at release, with release date, 50% horizon and 95% interval, as acts-facts §15 lists them.
// Units as published: s, min or h.
type Raw = [name: string, date: string, v: number, lo: number, hi: number, unit: "s" | "min" | "h"]
const RAW: Raw[] = [
  ["GPT-2", "2019-02-14", 3.2, 0.6, 8.5, "s"],
  ["GPT-3", "2020-05-28", 8.6, 5.6, 13.3, "s"],
  ["GPT-3.5", "2022-03-15", 36, 15, 67, "s"],
  ["GPT-4", "2023-03-14", 3.99, 1.93, 8.0, "min"],
  ["GPT-4 (Nov 2023)", "2023-11-06", 4.04, 1.87, 8.44, "min"],
  ["GPT-4o", "2024-05-13", 6.99, 4.0, 12.9, "min"],
  ["Claude 3.5 Sonnet (June)", "2024-06-20", 11.4, 5.49, 22.4, "min"],
  ["o1-preview", "2024-09-12", 20.3, 11.7, 33.4, "min"],
  ["Claude 3.5 Sonnet (new)", "2024-10-22", 20.5, 10.1, 40.8, "min"],
  ["o1", "2024-12-05", 38.8, 21.2, 65.0, "min"],
  ["Claude 3.7 Sonnet", "2025-02-24", 1.01, 0.55, 1.74, "h"],
  ["o3", "2025-04-16", 2.0, 1.24, 3.18, "h"],
  ["GPT-5", "2025-08-07", 3.38, 1.88, 6.76, "h"],
  ["Gemini 3 Pro", "2025-11-18", 3.74, 2.33, 6.32, "h"],
  ["Claude Opus 4.5", "2025-11-24", 4.88, 2.7, 10.4, "h"],
  ["GPT-5.2", "2025-12-11", 5.87, 3.3, 13.6, "h"],
  ["Claude Opus 4.6", "2026-02-05", 11.98, 5.28, 60.6, "h"],
  ["Claude Mythos Preview", "2026-04-07", 17.4, 8.48, 55.1, "h"],
]
const toH = (v: number, u: Raw[5]) => (u === "s" ? v / 3600 : u === "min" ? v / 60 : v)
const decYear = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let doy = d - 0.5
  for (let i = 0; i < m - 1; i++) doy += days[i]
  return y + doy / (leap ? 366 : 365)
}
type Pt = { name: string; t: number; h: number; lo: number; hi: number; pooled: boolean }
const PTS: Pt[] = RAW.map(([name, date, v, lo, hi, u]) => ({ name, t: decYear(date), h: toH(v, u), lo: toH(lo, u), hi: toH(hi, u), pooled: false }))
// METR, 20 November 2026 update, appendix: "Pooled TH1.1 + TH2 50% time horizon (95% CI) ... GPT-6
// Astra 40 h (13–2645) ... Opus 5.5 39 h (12–1253)". METR does not print their release month; they
// are placed at September 2026 as the site's own article and its chart do (reported to the owner).
const POOLED: Pt[] = [
  { name: "GPT-6 Astra", t: 2026 + 8.5 / 12, h: 40, lo: 13, hi: 2645, pooled: true },
  { name: "Opus 5.5", t: 2026 + 8.5 / 12 + 0.05, h: 39, lo: 12, hi: 1253, pooled: true },
]
/** METR's naive extrapolation: 200 hours in July 2027. Drawn dashed, from the last measured pin. */
const PROJ = { t: 2027 + 6.5 / 12, h: 200 }
{
  // the record must be what the sources say
  const ok = PTS.length === 18 && PTS.every((p, i) => i === 0 || p.t > PTS[i - 1].t) && PTS[17].name === "Claude Mythos Preview" && PTS[17].h === 17.4 && PTS.every((p) => p.lo < p.h && p.h < p.hi)
  if (!ok) throw new Error("horizon: the METR record is wrong")
}
const NP = PTS.length
const NALL = NP + POOLED.length

// ---------------------------------------------------------------- the axis: one family from linear to log

const LOG10 = Math.LN10
const KMAX = 7
/** The scale's offset (hours) and top (hours) at denomination k (0 = linear, KMAX = log). */
const cOf = (k: number) => 2000 * 10 ** -k
const tOf = (k: number) => 20 * 50 ** smooth(0, KMAX, k)
/** Height on the plot, 0..1, of h hours at denomination k. */
const yOf = (h: number, k: number) => {
  const c = cOf(k)
  return Math.log(1 + Math.max(h, 0) / c) / Math.log(1 + tOf(k) / c)
}

// ---------------------------------------------------------------- layout (metres; the board is z = 0, +z toward the room)

const FOV0 = 30
const TAN = Math.tan((FOV0 * Math.PI) / 360)
/** The landing camera stands square-on this far from the board, so the rule fills AXIS_LAND exactly. */
const RULE_L = 0.4
/** The chart's own layout frame (the wide shot): the rule stands here in it. */
const LAYOUT = { x: 230, y0: 980, y1: 400 }
const D0 = (RULE_L * (DH / 2)) / ((LAYOUT.y0 - LAYOUT.y1) * TAN)
const HH = D0 * TAN // half the frame's height on the board from there
const bx = (px: number) => ((px - DW / 2) / (DH / 2)) * HH
const by = (py: number) => ((DH / 2 - py) / (DH / 2)) * HH
const RULE = { x: bx(LAYOUT.x), y0: by(LAYOUT.y0), y1: by(LAYOUT.y1), w: (RULE_L * 120) / 1792 }
/** The landing camera: square-on and close enough that the rule covers AXIS_LAND, where `axis` puts it down. */
const DL = (RULE_L * (DH / 2)) / ((AXIS_LAND.y0 - AXIS_LAND.y1) * TAN)
const HL = DL * TAN
const CL_POS: [number, number, number] = [RULE.x - ((AXIS_LAND.x - DW / 2) / (DH / 2)) * HL, (RULE.y0 + RULE.y1) / 2 + ((AXIS_LAND.y0 + AXIS_LAND.y1) / 2 - DH / 2) / (DH / 2) * HL, DL]
const RULE_TH = RULE.w * 0.05 // the bar's thickness (ruleGeometry's own proportion)
const PLOT = { x0: RULE.x + RULE.w / 2 + 0.15, x1: bx(1800), y0: by(925), y1: by(410), t0: 2018.85, t1: 2027.75 }
const px = (t: number) => PLOT.x0 + ((t - PLOT.t0) / (PLOT.t1 - PLOT.t0)) * (PLOT.x1 - PLOT.x0)
const py = (ny: number) => PLOT.y0 + ny * (PLOT.y1 - PLOT.y0)
const PAD = { x0: -0.7, x1: 0.625, y0: -0.36, y1: 0.47, th: 0.012 }
const KEY = /*@__PURE__*/ new THREE.Vector3(-0.45, 0.55, 0.7).normalize()
const SH_DIR = { x: -KEY.x / KEY.z, y: -KEY.y / KEY.z } // where a point's shadow falls per metre of height

// heights above the paper
const Z_THREAD = 0.0035
/** The spare pins' row in the foot margin, and the spool the thread comes from. */
const SPARE = { x0: -0.33, dx: 0.0265, y: -0.327 }
const SPOOL = { x: -0.395, y: -0.326 }
const Z_BAR = 0.0045
const Z_HEAD = 0.012
const R_HEAD = 0.0032
const Z_TAG = 0.02
const RULE_LIFT = 0.005 // the rule stands on two brass clips, proud of the paper
const RULE_Z = RULE_TH + RULE_LIFT
const Z_TAB = 0.017

// ---------------------------------------------------------------- the schedule (seconds into each beat)

const START = AXIS_DUR * (1 - AXIS_IN)
const B0 = { roll: START, back0: 0.9, back1: 2.2, axis0: 0.85, axis1: 1.4, tabs: 1.3, pin0: 1.3, pin1: 3.7, cam0: 2.9, cam1: 7.0, gptTag: 2.0, mythTag: 4.0, rev: 5.6, revOut: 9.3 }
const PIN_T: number[] = (() => {
  // geometric gaps that shrink: the pulse speeding up
  const n = NP, r = 0.86
  const g: number[] = []
  let sum = 0
  for (let i = 0; i < n - 1; i++) {
    g.push(r ** i)
    sum += r ** i
  }
  const out = [B0.pin0]
  for (let i = 0; i < n - 1; i++) out.push(out[i] + (g[i] / sum) * (B0.pin1 - B0.pin0))
  return out
})()
const B1 = { back1: 1.1, bars0: 4.6, bars1: 5.6, mythTag: 5.7, orb0: 5.9, orb1: 9.6 }
const CLICK_T: number[] = (() => {
  const out: number[] = []
  let t = 1.25
  for (let j = 0; j < KMAX; j++) {
    out.push(t)
    t += 0.62 * 0.88 ** j
  }
  return out
})()
const CLICK_D = 0.32
const B2 = { pool0: 0.3, pool1: 0.48, pbars: 0.75, ptags: 0.95, dash0: 0.85, dash1: 2.05, projTag: 1.95, lim0: 1.1, lim1: 1.7, ride0: 0.6, ride1: 5.4 }

/** Denomination at seconds `t1` into beat 1 (0 before it, KMAX once it is done). */
function denomAt(t1: number) {
  let k = 0
  for (let j = 0; j < KMAX; j++) k += E.outBack(clamp((t1 - CLICK_T[j]) / CLICK_D))
  return k
}

// ---------------------------------------------------------------- small TSL helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F
/** Distance from p to the segment ab. */
const segDist = (p: V2, a: V2, b: V2): F => {
  const pa = p.sub(a), ba = b.sub(a)
  const h = clampN(dot(pa, ba).div(dot(ba, ba).add(1e-12)), 0, 1)
  return length(pa.sub(ba.mul(h))) as F
}

// ---------------------------------------------------------------- tags: printed card, painted once

type TagSpec = { id: string; lines: { s: string; big?: boolean }[]; plate?: string; ink?: string }
/** World height of one line of big print on a tag (cap height is about 0.72 of it). */
const TAG_LINE = 0.016
const TAG_PAD = 40 // card margin around the print, in canvas px (a line is 96)

function paintTag(spec: TagSpec, fonts: Ctx["fonts"], debug: boolean) {
  const lineH = 96
  const pad = TAG_PAD
  const fontOf = (l: { big?: boolean }) => `${l.big ? 600 : 400} ${l.big ? lineH * 0.9 : lineH * 0.5}px ${l.big ? fonts.sans : fonts.mono}`
  // size the card to its print
  const meas = document.createElement("canvas").getContext("2d")!
  let tw = 0
  for (const l of spec.lines) {
    meas.font = fontOf(l)
    tw = Math.max(tw, meas.measureText(l.s).width)
  }
  const hpx = Math.round(pad * 1.6 + spec.lines.reduce((a, l) => a + (l.big ? lineH : lineH * 0.62), 0))
  const wpx = Math.round(tw + pad * 2)
  const tex = canvasTex(wpx, hpx, (c, w, h) => {
    c.fillStyle = debug ? "#ff00ff" : (spec.plate ?? "#f4f1ea")
    c.fillRect(0, 0, w, h)
    if (!debug) {
      // card stock: a faint tooth, a darker deckle at the edges
      const R = rng(spec.id.length * 97 + spec.lines.length)
      for (let i = 0; i < 900; i++) {
        c.fillStyle = `rgba(90,80,60,${0.02 + R() * 0.03})`
        c.fillRect(R() * w, R() * h, 1 + R() * 2, 1)
      }
      c.strokeStyle = "rgba(60,50,40,0.25)"
      c.lineWidth = 3
      c.strokeRect(1.5, 1.5, w - 3, h - 3)
    }
    let y = pad * 0.6
    for (const l of spec.lines) {
      c.font = fontOf(l)
      c.fillStyle = debug ? "#ff00ff" : (spec.ink ?? "#16171a")
      c.textBaseline = "alphabetic"
      y += l.big ? lineH : lineH * 0.62
      c.fillText(l.s, pad, y - (l.big ? lineH * 0.2 : lineH * 0.14))
    }
  })
  return { tex, aspect: wpx / hpx }
}

// ---------------------------------------------------------------- the template's chart, redrawn (bars only, no print)

function templateCard() {
  return canvasTex(960, 540, (c, w, h) => {
    c.fillStyle = "#ffffff"
    c.fillRect(0, 0, w, h)
    // the slide's thin blue rule at the foot, as printed
    c.fillStyle = "#4472c4"
    c.fillRect(0, h - 10, w, 10)
    c.strokeStyle = "#d9d9d9"
    c.lineWidth = 2
    const x0 = 230, x1 = 880, top = 90, row = 78
    for (let i = 0; i <= 7; i++) {
      const x = x0 + ((x1 - x0) * i) / 7
      c.beginPath()
      c.moveTo(x, top - 20)
      c.lineTo(x, top + row * 5)
      c.stroke()
    }
    // the five rows to scale on 0..14 billion years: the last is a hair
    const vals = [13.8, 4.54, 3.7, 0.57, 0.0003]
    c.fillStyle = "#4472c4"
    vals.forEach((v, i) => c.fillRect(x0, top + row * i + 14, Math.max(1, ((x1 - x0) * v) / 14), 44))
    // row names as grey bars of print (too small to read, so not print at all)
    c.fillStyle = "#a6a6a6"
    vals.forEach((_, i) => c.fillRect(x0 - 150 + i * 9, top + row * i + 30, 120 - i * 9, 12))
    c.fillRect(w / 2 - 180, 30, 360, 16)
  })
}

// ---------------------------------------------------------------- the print on the chart: the x axis

function chartPrint(fonts: Ctx["fonts"], debug: boolean) {
  const W = 2800
  const Hp = Math.round((W * (PAD.y1 - PAD.y0)) / (PAD.x1 - PAD.x0))
  const sx = (x: number) => ((x - PAD.x0) / (PAD.x1 - PAD.x0)) * W
  const sy = (y: number) => ((PAD.y1 - y) / (PAD.y1 - PAD.y0)) * Hp
  const perM = W / (PAD.x1 - PAD.x0)
  const tex = canvasTex(W, Hp, (c) => {
    c.clearRect(0, 0, W, Hp)
    c.strokeStyle = "#1c1d20"
    c.fillStyle = "#1c1d20"
    c.lineWidth = 0.0011 * perM
    c.beginPath()
    c.moveTo(sx(PLOT.x0), sy(PLOT.y0))
    c.lineTo(sx(PLOT.x1), sy(PLOT.y0))
    c.stroke()
    for (let yr = 2019; yr <= 2027; yr++) {
      const x = sx(px(yr))
      c.lineWidth = 0.0008 * perM
      c.beginPath()
      c.moveTo(x, sy(PLOT.y0))
      c.lineTo(x, sy(PLOT.y0 - (yr % 2 ? 0.009 : 0.005)))
      c.stroke()
      if (yr % 2) {
        c.font = `500 ${0.035 * perM}px ${fonts.sans}`
        c.textAlign = "center"
        c.textBaseline = "alphabetic"
        if (debug) {
          // the label plate for the review tool: the numeral's cap box
          c.fillStyle = "#ff00ff"
          const w = 0.035 * 0.56 * 2 * perM
          c.fillRect(x - w / 2, sy(PLOT.y0 - 0.0385 + YEAR_CAP), w, YEAR_CAP * perM)
          c.fillStyle = "#ff00ff"
        }
        c.fillText(String(yr), x, sy(PLOT.y0 - 0.0385))
      }
    }
  })
  return tex
}
/** Where the year numerals sit (for labels): centre x, baseline y, cap height, width. */
const YEAR_CAP = 0.035 * 0.72
const YEARS = [2019, 2021, 2023, 2025, 2027]

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV0, 16 / 9, 0.004, 30)
  const debug = ctx.debugLabels

  const KEYD = vec3(KEY.x, KEY.y, KEY.z)
  const KEYC = vec3(1.0, 0.985, 0.96).mul(1.75)
  const SKY = vec3(0.3, 0.32, 0.36)
  /** The window's pool on the wall: brighter toward the upper left. */
  const pool = (P: V3): F => sstep(1.6, -0.3, length(P.xy.sub(vec2(-0.75, 0.6))) as F).mul(0.32).add(0.78) as F
  /** The world rule: one window key, the sky through it, and the paper's bounce. */
  const lit = (alb: V3, N: V3, P: V3, o: { spec: Num; shin: number; sh?: Num; ao?: Num; rim?: Num; env?: Num }): V3 => {
    const V = normalize(cameraPosition.sub(P))
    const pl = pool(P)
    const sh = fl(o.sh ?? 1)
    const ao = fl(o.ao ?? 1)
    const ndl = max(dot(N, KEYD), 0)
    const Hh = normalize(KEYD.add(V))
    const sp = pow(max(dot(N, Hh), 0), o.shin).mul(fl(o.spec)).mul(ndl.mul(4).min(1))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5)
    const bounce = vec3(0.16, 0.16, 0.15).mul(max(N.z, 0).mul(0.3).add(max(N.y.negate(), 0).mul(0.5)).add(max(N.x, 0).mul(0.2)))
    const amb = SKY.mul(N.y.mul(0.25).add(0.75)).add(bounce).mul(ao)
    const col = alb.mul(KEYC.mul(ndl).mul(sh).mul(pl).add(amb)).add(KEYC.mul(sp).mul(sh).mul(pl))
    // a sharp window in anything glossy: the reflection of the panes (env), and a cool rim
    const R = V.negate().sub(N.mul(dot(V.negate(), N).mul(2)))
    const pane = sstep(0.82, 0.9, dot(R, KEYD) as F).mul(step(0.12, abs(fract(R.x.mul(5).add(R.y.mul(2))).sub(0.5)) as F))
    return col.add(vec3(1, 0.99, 0.97).mul(pane).mul(fl(o.env ?? 0)).mul(sh)).add(SKY.mul(fres).mul(fl(o.rim ?? 0.4)).mul(ao)) as V3
  }
  const depthA = (): F => positionView.z.negate() as F

  // ---------------------------------------------------------------- shadow casters (the paper reads these)
  const pinArr = uniformArray(Array.from({ length: NALL }, () => new THREE.Vector4(0, 0, 0, 0)), "vec4") // x, y, head height, on
  const thrArr = uniformArray(Array.from({ length: NP - 1 }, () => new THREE.Vector4(0, 0, 0, 0)), "vec4") // x0, y0, x1, y1 (zero length = none)
  const barArr = uniformArray(Array.from({ length: NALL }, () => new THREE.Vector4(0, 0, 0, 0)), "vec4") // x, ylo, yhi, height
  const NTAGS = 12
  const tagArr = uniformArray(Array.from({ length: NTAGS }, () => new THREE.Vector4(0, 0, 0, 0)), "vec4") // cx, cy, hw, hh (0 = none)
  const holeArr = uniformArray(Array.from({ length: NP }, () => new THREE.Vector4(0, 0, 0, 0)), "vec4") // x, y, shown
  const U = {
    dash: uniform(0), // how much of the pencilled projection is drawn (0..1)
    d0: uniform(new THREE.Vector2()), // the dash from the last measured pin
    d1: uniform(new THREE.Vector2()), // to METR's 200 h, July 2027
    lim: uniform(0), // the 16 h line, pencilled (0..1)
    limY: uniform(0),
    // the rule
    face: uniform(0), // 0 = the ages face, 1 = the axis engraving (wipes bottom to top)
    ruleC: uniform(cOf(0)),
    ruleLT: uniform(Math.log(1 + tOf(0) / cOf(0))),
    logW: uniform(0), // 0 = hour ticks, 1 = the log scale's ticks
    flash: uniform(0), // a click's light running down the rule
    flashY: uniform(0),
    ruleOn: uniform(0),
  }
  const shadowAt = (P: V2): V2 => {
    // how much key light reaches the paper here past everything stood off it (x), and contact (y)
    const sh = float(1).toVar()
    const ao = float(1).toVar()
    const sd = vec2(SH_DIR.x, SH_DIR.y)
    Loop(NALL, ({ i }) => {
      const pc = pinArr.element(int(i)) as unknown as V4
      If(pc.w.greaterThan(0.01), () => {
        const tip = pc.xy.add(sd.mul(pc.z))
        const d = segDist(P, pc.xy as V2, tip as V2)
        sh.mulAssign(float(1).sub(sstep(0.0009, 0.0002, d).mul(0.55).mul(pc.w)))
        const dh = length(P.sub(tip))
        const soft = pc.z.mul(0.09).add(0.0006)
        sh.mulAssign(float(1).sub(sstep(R_HEAD + 0.0006, R_HEAD * 0.4, dh.sub(soft.mul(0.5)) as F).mul(0.62).mul(pc.w)))
        ao.mulAssign(float(1).sub(exp(dot(P.sub(pc.xy), P.sub(pc.xy)).div(1.2e-6).negate()).mul(0.5).mul(pc.w)))
      })
    })
    Loop(NP - 1, ({ i }) => {
      const s = thrArr.element(int(i)) as unknown as V4
      const off = sd.mul(Z_THREAD)
      const d = segDist(P, s.xy.add(off) as V2, s.zw.add(off) as V2)
      sh.mulAssign(float(1).sub(sstep(0.0014, 0.0004, d).mul(0.5).mul(step(1e-6, length(s.zw.sub(s.xy))))))
    })
    Loop(NALL, ({ i }) => {
      const b = barArr.element(int(i)) as unknown as V4
      If(b.w.greaterThan(0.0001), () => {
        const off = sd.mul(b.w)
        const d = segDist(P, vec2(b.x, b.y).add(off) as V2, vec2(b.x, b.z).add(off) as V2)
        sh.mulAssign(float(1).sub(sstep(0.0013, 0.0003, d).mul(0.5)))
      })
    })
    Loop(NTAGS, ({ i }) => {
      const tg = tagArr.element(int(i)) as unknown as V4
      If(tg.z.greaterThan(0.0001), () => {
        const q = abs(P.sub(tg.xy).sub(sd.mul(Z_TAG))).sub(tg.zw)
        const d = max(q.x, q.y)
        sh.mulAssign(float(1).sub(sstep(0.0022, -0.0012, d as F).mul(0.42)))
      })
    })
    // the rule's own shadow along its right edge, and its contact
    const rq = abs(P.sub(vec2(RULE.x, (RULE.y0 + RULE.y1) / 2)).sub(sd.mul(RULE_Z))).sub(vec2(RULE.w / 2, (RULE.y1 - RULE.y0) / 2))
    sh.mulAssign(float(1).sub(sstep(0.0026, -0.0012, max(rq.x, rq.y) as F).mul(0.5).mul(U.ruleOn)))
    // the window's jamb: a broad soft shadow edge across the right of the wall
    const jamb = sstep(-0.05, 0.12, P.x.sub(0.5).add(P.y.mul(0.55)) as F)
    sh.mulAssign(float(1).sub(jamb.mul(0.32)))
    return vec2(sh, ao)
  }

  // ---------------------------------------------------------------- the pad: graph paper, print, pencil
  const printTex = chartPrint(ctx.fonts, debug)
  const paperMat = new THREE.NodeMaterial()
  paperMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = vec3(0, 0, 1)
    const fw = max(fwidth(P.x), fwidth(P.y)).toVar()
    // the paper: a white wove with a faint fibre and cockle
    const fib = vnoise(P.xy.mul(vec2(1600, 1300))).mul(sstep(0.0011, 0.0003, fw)).toVar()
    const mott = fbm(P.xy.mul(7)).toVar()
    const alb = vec3(0.9, 0.895, 0.87).mul(mott.mul(0.05).add(0.97)).mul(fib.mul(0.05).add(0.975)).toVar()
    // engineering ruling: 1 mm, 5 mm, 10 mm, in a pale blue-green, aligned on the plot's origin
    const g = P.xy.sub(vec2(PLOT.x0, PLOT.y0)).toVar()
    const line = (pitch: number, w: number): F => {
      const q = abs(fract(g.div(pitch).add(0.5)).sub(0.5)).mul(pitch)
      const d = min(q.x, q.y)
      return sstep(fw.mul(0.8).add(w), float(w * 0.3), d as F).mul(sstep(pitch * 0.5, pitch * 0.18, fw)) as F
    }
    const inGrid = step(PAD.x0 + 0.03, P.x).mul(step(P.x, PAD.x1 - 0.03)).mul(step(PAD.y0 + 0.03, P.y)).mul(step(P.y, PAD.y1 - 0.06))
    const rul = max(max(line(0.001, 0.00006).mul(0.35), line(0.005, 0.0001).mul(0.6)), line(0.01, 0.00018)).mul(inGrid)
    alb.assign(mixN(alb, vec3(0.36, 0.6, 0.56), rul.mul(0.7)))
    // the chart's print: the x axis and its years
    const st = vec2(P.x.sub(PAD.x0).div(PAD.x1 - PAD.x0), P.y.sub(PAD.y0).div(PAD.y1 - PAD.y0))
    const pr = texture(printTex, st).toVar()
    alb.assign(mixN(alb, pr.rgb.mul(0.4), pr.a.mul(0.95)))
    // red pencil: the projection, as dashes, drawn from the last measured pin
    const dv = U.d1.sub(U.d0)
    const dl = length(dv)
    const along = dot(P.xy.sub(U.d0), dv).div(dl.mul(dl)).toVar()
    const across = abs(dot(P.xy.sub(U.d0), vec2(dv.y.negate(), dv.x)).div(dl))
    const dashOn = step(0.32, fract(along.mul(dl).div(0.009))).mul(step(0, along)).mul(step(along, U.dash))
    const grain = vnoise(P.xy.mul(vec2(2200, 1900))).mul(0.6).add(0.55)
    const pencil = sstep(0.00085, 0.0002, across as F).mul(dashOn).mul(grain).mul(step(0.001, U.dash))
    // its end: a pencilled ring at 200 h
    const ring = sstep(0.0009, 0.0002, abs(length(P.xy.sub(U.d1)).sub(0.0042)) as F).mul(sstep(0.97, 1.0, U.dash as F))
    alb.assign(mixN(alb, vec3(0.62, 0.07, 0.06), max(pencil, ring.mul(grain)).mul(0.85)))
    // graphite: METR's 16 h reliability limit, a light ruled line drawn left to right
    const limx = P.x.sub(PLOT.x0).div(PLOT.x1 - PLOT.x0)
    const gl = sstep(0.0007, 0.0001, abs(P.y.sub(U.limY)) as F).mul(step(limx, U.lim)).mul(step(0, limx)).mul(vnoise(P.xy.mul(2600)).mul(0.5).add(0.5))
    alb.assign(mixN(alb, vec3(0.26, 0.26, 0.28), gl.mul(0.6)))
    // pin holes: where a pin was before the axis changed (a dimple and a dark pore)
    Loop(NP, ({ i }) => {
      const hp = holeArr.element(int(i)) as unknown as V4
      If(hp.z.greaterThan(0.01), () => {
        const d = length(P.xy.sub(hp.xy))
        alb.mulAssign(float(1).sub(sstep(0.00055, 0.0002, d as F).mul(0.75).mul(hp.z)).sub(sstep(0.0016, 0.0004, d as F).mul(0.06).mul(hp.z)))
      })
    })
    const sa = shadowAt(P.xy as V2)
    const col = lit(alb as V3, N as V3, P as V3, { spec: 0.04, shin: 8, sh: sa.x, ao: sa.y, rim: 0 })
    return vec4(debug ? mixN(col, pr.rgb, step(0.5, pr.a).mul(step(0.5, pr.r)).mul(step(pr.g, 0.3))) : col, depthA())
  })()
  // the stack of sheets under it: edges striated by the leaves, the gummed binding along the top
  const edgeMat = new THREE.NodeMaterial()
  edgeMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const leaves = sin(P.z.mul(2 * Math.PI / 0.00011)).mul(0.5).add(0.5).mul(sstep(0.0004, 0.0001, fwidth(P.z) as F))
    const alb = vec3(0.8, 0.79, 0.76).mul(leaves.mul(0.12).add(0.86)).mul(vnoise(P.xy.mul(300)).mul(0.08).add(0.94))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.02, shin: 4 }), depthA())
  })()
  const pad = new THREE.Mesh(new THREE.BoxGeometry(PAD.x1 - PAD.x0, PAD.y1 - PAD.y0, PAD.th), [edgeMat, edgeMat, edgeMat, edgeMat, paperMat, edgeMat])
  pad.position.set((PAD.x0 + PAD.x1) / 2, (PAD.y0 + PAD.y1) / 2, -PAD.th / 2)
  scene.add(pad)
  const bindMat = new THREE.NodeMaterial()
  bindMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const weave = sin(P.x.mul(5200)).mul(sin(P.y.mul(5200))).mul(0.5).add(0.5).mul(sstep(0.0005, 0.0001, fwidth(P.x) as F))
    const alb = vec3(0.05, 0.05, 0.055).mul(weave.mul(0.3).add(0.85))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.12, shin: 20 }), depthA())
  })()
  const binding = new THREE.Mesh(new THREE.BoxGeometry(PAD.x1 - PAD.x0 + 0.004, 0.034, PAD.th + 0.004), bindMat)
  binding.position.set((PAD.x0 + PAD.x1) / 2, PAD.y1 - 0.015, -PAD.th / 2 + 0.001)
  scene.add(binding)

  // ---- the cork wall around it
  const corkMat = new THREE.NodeMaterial()
  corkMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = vec3(0, 0, 1)
    const cell = voronoi(P.xy.mul(520)).toVar()
    const gr = fbm(P.xy.mul(160)).toVar()
    const alb = vec3(0.44, 0.29, 0.16).mul(gr.mul(0.5).add(0.7)).mul(cell.x.mul(0.35).add(0.8)).toVar()
    // the pad's own shadow on the cork, and a darker pool where the board leaves the window
    const q = abs(P.xy.sub(vec2((PAD.x0 + PAD.x1) / 2, (PAD.y0 + PAD.y1) / 2)).sub(vec2(SH_DIR.x, SH_DIR.y).mul(PAD.th))).sub(vec2((PAD.x1 - PAD.x0) / 2, (PAD.y1 - PAD.y0) / 2))
    const sh = float(1).sub(sstep(0.004, -0.002, max(q.x, q.y) as F).mul(0.6))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.02, shin: 6, sh, rim: 0 }), depthA())
  })()
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), corkMat)
  cork.position.set(0, 0, -PAD.th - 0.0005)
  scene.add(cork)

  // ---------------------------------------------------------------- pins: steel shafts, black glass heads, brass rings for the pooled pair
  const shaftGeo = new THREE.CylinderGeometry(0.00032, 0.00032, 1, 8, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5)
  const steelMat = new THREE.NodeMaterial()
  steelMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(lit(vec3(0.5, 0.5, 0.52) as V3, N as V3, P as V3, { spec: 1.4, shin: 90, rim: 0.8, env: 0.8 }), depthA())
  })()
  const shafts = new THREE.InstancedMesh(shaftGeo, steelMat, NALL)
  shafts.frustumCulled = false
  scene.add(shafts)
  const headGeo = new THREE.SphereGeometry(R_HEAD, 24, 16)
  const glassMat = new THREE.NodeMaterial()
  glassMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    // black glass: almost no body colour, a hard window and a soft bloom of the room in the Fresnel
    return vec4(lit(vec3(0.012, 0.012, 0.014) as V3, N as V3, P as V3, { spec: 2.2, shin: 160, rim: 1.6, env: 2.4 }), depthA())
  })()
  const heads = new THREE.InstancedMesh(headGeo, glassMat, NP)
  heads.frustumCulled = false
  scene.add(heads)
  const ringGeo = new THREE.TorusGeometry(R_HEAD * 1.4, R_HEAD * 0.42, 14, 40)
  const brassMat = new THREE.NodeMaterial()
  brassMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(lit(vec3(0.7, 0.5, 0.2) as V3, N as V3, P as V3, { spec: 1.6, shin: 70, rim: 0.6, env: 1.2 }), depthA())
  })()
  const rings = new THREE.InstancedMesh(ringGeo, brassMat, POOLED.length)
  rings.frustumCulled = false
  scene.add(rings)

  // ---- the thread: red cotton, wound pin to pin
  const threadGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0)
  const threadMat = new THREE.NodeMaterial()
  threadMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const st = uvAttr()
    // the ply: a twist that runs along the thread whatever its length (world-space along it)
    const tw = sin(P.x.add(P.y).mul(5200).add(st.x.mul(Math.PI * 4))).mul(0.5).add(0.5).mul(sstep(0.0004, 0.0001, fwidth(P.x) as F))
    const alb = vec3(0.5, 0.028, 0.03).mul(tw.mul(0.35).add(0.75))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.18, shin: 14, rim: 0.9 }), depthA())
  })()
  const thread = new THREE.InstancedMesh(threadGeo, threadMat, NP - 1)
  const lead = new THREE.Mesh(threadGeo, threadMat)
  lead.matrixAutoUpdate = false
  lead.frustumCulled = false
  scene.add(lead)
  // the spool: a turned beech bobbin hung on a pin in the margin, red cotton wound on it
  const spool = new THREE.Group()
  {
    const beech = new THREE.NodeMaterial()
    beech.fragmentNode = Fn(() => {
      const P = positionWorld
      const N = normalize(normalWorld)
      const ring = sin(length(P.xy.sub(vec2(SPOOL.x, SPOOL.y))).mul(900)).mul(0.5).add(0.5)
      const alb = vec3(0.62, 0.45, 0.27).mul(ring.mul(0.12).add(0.88)).mul(vnoise(P.xy.mul(400)).mul(0.1).add(0.92))
      return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.25, shin: 24, rim: 0.5 }), depthA())
    })()
    const fl0 = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.003, 40).rotateX(Math.PI / 2), beech)
    fl0.position.z = 0.0015
    const fl1 = fl0.clone()
    fl1.position.z = 0.0235
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.019, 40, 1, true).rotateX(Math.PI / 2), threadMat)
    core.position.z = 0.0125
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 16, 12), steelMat)
    hub.position.z = 0.026
    spool.add(fl0, fl1, core, hub)
    spool.position.set(SPOOL.x, SPOOL.y, 0)
  }
  scene.add(spool)
  thread.frustumCulled = false
  scene.add(thread)

  // ---- the intervals: blued-steel wire stood off the paper, crossbar ends; the pooled pair's run off the top with arrowheads
  const wireGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0)
  const blueMat = new THREE.NodeMaterial()
  blueMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(lit(vec3(0.05, 0.07, 0.11) as V3, N as V3, P as V3, { spec: 1.2, shin: 60, rim: 1.0, env: 0.9 }), depthA())
  })()
  const wires = new THREE.InstancedMesh(wireGeo, blueMat, NALL)
  wires.frustumCulled = false
  scene.add(wires)
  const capGeo = new THREE.BoxGeometry(1, 1, 1)
  const caps = new THREE.InstancedMesh(capGeo, blueMat, NALL * 2)
  caps.frustumCulled = false
  scene.add(caps)
  const arrowGeo = new THREE.ConeGeometry(0.0022, 0.0065, 12).translate(0, 0.00325, 0)
  const arrows = new THREE.InstancedMesh(arrowGeo, brassMat, POOLED.length)
  arrows.frustumCulled = false
  scene.add(arrows)

  // ---------------------------------------------------------------- the rule: the axis
  const rface = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "steel", debug, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    const onFace = attribute("face", "float").toVar()
    const cut = texture(rface.tex, st).toVar()
    const br = vnoise(vec2(st.x.mul(80), st.y.mul(260))).mul(0.6).add(vnoise(vec2(st.x.mul(330), st.y.mul(900))).mul(0.4)).toVar()
    const metal = vec3(0.46, 0.47, 0.49).mul(br.mul(0.3).add(0.8))
    // where along the plot this point of the rule is, and what it reads in hours
    const ny = P.y.sub(PLOT.y0).div(PLOT.y1 - PLOT.y0).toVar()
    const hrs = U.ruleC.mul(exp(ny.mul(U.ruleLT)).sub(1)).toVar()
    const yOfH = (h: F): F => log(h.div(U.ruleC).add(1)).div(U.ruleLT) as F
    const dY = (n: F): F => abs(ny.sub(yOfH(n))).mul(PLOT.y1 - PLOT.y0) as F // metres from that tick
    const across = st.y // 1 = far edge (left), 0 = the bevel (right, toward the chart)
    // hour ticks: every hour, long at every five
    const hn = round(hrs).max(0)
    const hMaj = step(abs(fract(hn.div(5).add(0.5)).sub(0.5)), 0.01)
    const hLen = mixN(float(0.3), float(0.62), hMaj)
    const hW = mixN(float(0.00028), float(0.00045), hMaj)
    const hDense = sstep(0.0016, 0.0035, dY(hn.add(1) as F).sub(0).min(dY(hn.sub(1).max(0) as F)) as F) // fade when the hours crowd
    const hTick = sstep(hW.add(fwidth(ny).mul(0.3)), hW.mul(0.4), dY(hn as F)).mul(step(across, hLen)).mul(hDense).mul(step(-0.001, ny)).mul(step(ny, 1.001))
    // the log scale: 1 to 9 in every decade, long at each power of ten
    const lh = log(max(hrs, 1e-9)).div(LOG10).toVar()
    const e = floor(lh)
    const base = pow(float(10), e)
    const m = hrs.div(base)
    const n = clampN(round(m), 1, 10)
    const lMaj = step(abs(n.sub(1)), 0.01).max(step(abs(n.sub(10)), 0.01))
    const lLen = mixN(float(0.26), float(0.66), lMaj)
    const lW = mixN(float(0.00026), float(0.0005), lMaj)
    const nb = n.mul(base) as F
    const lDense = sstep(0.0012, 0.0028, dY(nb.add(base) as F).min(dY(max(nb.sub(base), base) as F)) as F).max(lMaj)
    const lTick = sstep(lW.add(fwidth(ny).mul(0.3)), lW.mul(0.4), dY(nb)).mul(step(across, lLen)).mul(lDense).mul(step(0.0005, hrs)).mul(step(ny, 1.001))
    const ticks = mixN(hTick, lTick, U.logW)
    // the axis engraving arrives from the foot up; the ages face goes the other way
    const wipe = sstep(U.face.mul(1.25).sub(0.25), U.face.mul(1.25).sub(0.05), st.x as F).oneMinus()
    const axisOn = wipe.mul(step(0.001, U.face))
    const engr = vec3(0.07, 0.07, 0.075)
    const faceCol = mixN(mixN(metal, cut.rgb.mul(0.35), cut.a.mul(onFace)), mixN(metal, engr, ticks.mul(onFace)), axisOn).toVar()
    // a click's light running along the bar
    const fl1 = exp(abs(ny.sub(U.flashY)).mul(-9)).mul(U.flash)
    const col = lit(faceCol as V3, N as V3, P as V3, { spec: 0.9, shin: 50, rim: 0.7, env: 0.5 }).add(vec3(1, 0.98, 0.95).mul(fl1).mul(0.6))
    return vec4(debug ? mixN(col, cut.rgb, step(0.02, cut.a.mul(onFace)).mul(axisOn.oneMinus())) : col, depthA())
  })()
  const ruleGeo = ruleGeometry()
  const tmpM0 = new THREE.Matrix4()
  const rule = new THREE.Mesh(ruleGeo, ruleMat)
  rule.frustumCulled = false
  // on end on the margin: its length up the board, its face toward the room, the bevel toward the chart
  rule.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)))
  rule.position.set(RULE.x, (RULE.y0 + RULE.y1) / 2, RULE_Z)
  rule.scale.set(RULE_L, RULE_L, RULE_L)
  scene.add(rule)
  // the two clips it stands on
  const clips = new THREE.InstancedMesh(new THREE.BoxGeometry(RULE.w * 1.5, 0.012, RULE_LIFT), brassMat, 2)
  for (let i = 0; i < 2; i++) {
    tmpM0.makeTranslation(RULE.x, mix(RULE.y0, RULE.y1, i ? 0.86 : 0.12), RULE_LIFT / 2)
    clips.setMatrixAt(i, tmpM0)
  }
  clips.frustumCulled = false
  scene.add(clips)

  // ---------------------------------------------------------------- tags and tabs (printed card; magenta under ?labels)
  type Tag = { id: string; mesh: THREE.Mesh; mat: THREE.NodeMaterial; tex: THREE.Texture; aspect: number; cap: number; minPx: number; alpha: number; hw: number; hh: number; slot: number }
  const tags: Tag[] = []
  const tagGeo = new THREE.PlaneGeometry(1, 1)
  const makeTag = (spec: TagSpec, minPx: number, slot = -1): Tag => {
    const { tex, aspect } = paintTag(spec, ctx.fonts, debug)
    const U2 = { a: uniform(0) }
    const m = new THREE.NodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.fragmentNode = Fn(() => {
      const c = texture(tex, uvAttr()).rgb
      if (debug) return vec4(c, U2.a)
      const P = positionWorld
      return vec4(lit(c as V3, vec3(0, 0, 1) as V3, P as V3, { spec: 0.03, shin: 6, rim: 0 }), U2.a)
    })()
    ;(m as unknown as { userData: { a: typeof U2.a } }).userData = { a: U2.a }
    const mesh = new THREE.Mesh(tagGeo, m)
    mesh.renderOrder = 5
    mesh.frustumCulled = false
    scene.add(mesh)
    const big = spec.lines.filter((l) => l.big).length
    const hTot = (spec.lines.reduce((a, l) => a + (l.big ? 1 : 0.62), 0) + (1.6 * TAG_PAD) / 96) * TAG_LINE
    const t: Tag = { id: spec.id, mesh, mat: m, tex, aspect, cap: (big ? 0.9 * 0.72 : 0.5 * 0.72) * TAG_LINE, minPx, alpha: 0, hw: (hTot * aspect) / 2, hh: hTot / 2, slot }
    mesh.scale.set(hTot * aspect, hTot, 1)
    tags.push(t)
    return t
  }
  const tagA = (t: Tag) => ((t.mat as unknown as { userData: { a: { value: number } } }).userData.a)
  // axis numerals: linear hours, then decades in human units (exact conversions of 0.001 h .. 1,000 h)
  const LIN_TABS = [0, 5, 10, 15, 20]
  const LOG_TABS: [number, string][] = [[0.001, "3.6 s"], [0.01, "36 s"], [0.1, "6 min"], [1, "1 h"], [10, "10 h"], [100, "100 h"], [1000, "1,000 h"]]
  const linTabs = LIN_TABS.map((h) => makeTag({ id: `axis ${h} h`, lines: [{ s: h === 0 ? "0" : `${h} h`, big: true }] }, LABEL_MIN.number))
  const logTabs = LOG_TABS.map(([, s]) => makeTag({ id: `axis ${s}`, lines: [{ s, big: true }] }, LABEL_MIN.number))
  let slot = 0
  const tGpt2 = makeTag({ id: "GPT-2 tag", lines: [{ s: "GPT-2", big: false }, { s: "about 3 s", big: true }] }, LABEL_MIN.number, slot++)
  const tMyth = makeTag({ id: "Mythos tag", lines: [{ s: "Claude Mythos Preview", big: false }, { s: "17.4 h", big: true }] }, LABEL_MIN.number, slot++)
  const tMythCI = makeTag({ id: "Mythos interval", lines: [{ s: "METR 95% interval", big: false }, { s: "8.48 to 55.1 h", big: true }] }, LABEL_MIN.number, slot++)
  const tAstra = makeTag({ id: "Astra tag", lines: [{ s: "GPT-6 Astra (13 to 2,645)", big: false }, { s: "40 h", big: true }] }, LABEL_MIN.number, slot++)
  const tOpus = makeTag({ id: "Opus 5.5 tag", lines: [{ s: "Opus 5.5 (12 to 1,253)", big: false }, { s: "39 h", big: true }] }, LABEL_MIN.number, slot++)
  const tPool = makeTag({ id: "pooled note", lines: [{ s: "hollow: two suites pooled", big: false }, { s: "(TH1.1 + TH2)", big: false }], plate: "#efe9da" }, LABEL_MIN.caption, slot++)
  const tProj = makeTag({ id: "projection tag", lines: [{ s: "naive extrapolation", big: false }, { s: "200 h · July 2027", big: true }], ink: "#7a120e" }, LABEL_MIN.number, slot++)
  const tLim = makeTag({ id: "16 h limit", lines: [{ s: "METR: above it, unreliable", big: false }, { s: "16 h", big: true }], plate: "#ece8de" }, LABEL_MIN.number, slot++)

  // ---- the template's chart, printed and pinned in the corner (a callback; no print to read)
  const cardTex = templateCard()
  const cardMat = new THREE.NodeMaterial()
  cardMat.fragmentNode = Fn(() => {
    const c = texture(cardTex, uvAttr()).rgb
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(lit(c.mul(0.93) as V3, N as V3, P as V3, { spec: 0.05, shin: 10 }), depthA())
  })()
  const cardGeo = new THREE.PlaneGeometry(0.16, 0.09, 12, 6)
  {
    // a printout that has been folded once and pinned: a soft bow and a lifted corner
    const pa = cardGeo.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i)
      pa.setZ(i, 0.0025 * Math.cos((x / 0.16) * Math.PI) + Math.max(0, (x - 0.04) * (-y - 0.01)) * 0.6)
    }
    cardGeo.computeVertexNormals()
  }
  const card = new THREE.Mesh(cardGeo, cardMat)
  card.position.set(0.555, 0.17, 0.0035)
  card.rotation.z = 0.045
  scene.add(card)
  const cardPin = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 20, 14), new THREE.NodeMaterial())
  ;(cardPin.material as THREE.NodeMaterial).fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(lit(vec3(0.42, 0.03, 0.025) as V3, N as V3, P as V3, { spec: 1.4, shin: 90, rim: 0.8, env: 1.2 }), depthA())
  })()
  cardPin.position.set(0.555 - 0.002, 0.17 + 0.036, 0.012)
  scene.add(cardPin)

  // ---------------------------------------------------------------- targets, depth of field
  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(1), asp: uniform(16 / 9) }
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.001)).mul(step(0, d)) as F)
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0005), () => {
      Loop(20, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(20))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.3).add(step(c0.a, t.a)) as F).mul(step(0, t.a))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    return vec4(acc.rgb.div(acc.a), 1)
  }, D)

  // ---------------------------------------------------------------- positions of everything, as a function of the denomination
  const pinPos = (i: number, k: number, out2: { x: number; y: number }) => {
    const p = i < NP ? PTS[i] : POOLED[i - NP]
    out2.x = px(p.t)
    out2.y = py(yOf(p.h, k))
    return out2
  }
  const P2 = { x: 0, y: 0 }
  const linY = PTS.map((p) => py(yOf(p.h, 0)))

  // ---- the ride: a smoothed path along the thread at k = KMAX, to the last pin
  const RIDE_N = 240
  const ridePts: THREE.Vector3[] = []
  {
    const poly: [number, number][] = [...PTS, POOLED[0]].map((p) => [px(p.t), py(yOf(p.h, KMAX))])
    const seg: number[] = [0]
    for (let i = 1; i < poly.length; i++) seg.push(seg[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]))
    const S = seg[seg.length - 1]
    const at = (s: number): [number, number] => {
      s = clamp(s, 0, S)
      let j = 1
      while (j < seg.length - 1 && seg[j] < s) j++
      const f = (s - seg[j - 1]) / (seg[j] - seg[j - 1] || 1)
      return [mix(poly[j - 1][0], poly[j][0], f), mix(poly[j - 1][1], poly[j][1], f)]
    }
    for (let i = 0; i <= RIDE_N; i++) {
      const s = (i / RIDE_N) * S
      // average over a window so the camera does not jerk at each pin
      let x = 0, y = 0
      for (let w = -6; w <= 6; w++) {
        const q = at(s + w * 0.006)
        x += q[0]
        y += q[1]
      }
      ridePts.push(new THREE.Vector3(x / 13, y / 13, 0))
    }
    // the last sample is the last pin itself, exactly
    ridePts[RIDE_N].set(poly[poly.length - 1][0], poly[poly.length - 1][1], 0)
  }
  const rideAt = (u: number, o: THREE.Vector3) => {
    const f = clamp(u) * RIDE_N
    const i = Math.min(RIDE_N - 1, Math.floor(f))
    return o.lerpVectors(ridePts[i], ridePts[i + 1], f - i)
  }
  /** The ride's progress at seconds `t2` into beat 2: away slowly, faster and faster, then a dead stop. */
  const rideU = (t2: number) => E.out4(clamp((t2 - B2.ride0) / (B2.ride1 - B2.ride0)) ** 1.7)
  // when the ride passes each pin (for the pulse): solve rideU = the pin's place on the path
  const passT: number[] = []
  {
    const v = new THREE.Vector3()
    for (let i = 2; i < NP; i++) {
      const x = px(PTS[i].t)
      let lo = B2.ride0, hi = B2.ride1
      for (let it = 0; it < 40; it++) {
        const m = (lo + hi) / 2
        rideAt(rideU(m), v)
        if (v.x < x - 0.03) lo = m
        else hi = m
      }
      if (hi < B2.ride1 - 0.05) passT.push(hi)
    }
  }

  // ---------------------------------------------------------------- the camera
  type Key = { p: [number, number, number]; t: [number, number, number]; fov: number }
  const C0: Key = { p: [0, 0.014, D0 * 1.02], t: [0, 0.014, 0], fov: FOV0 }
  const CWALL: Key = { p: [-0.06, -0.62, 0.82], t: [0.0, -0.035, 0], fov: 40 }
  const CL: Key = { p: CL_POS, t: [CL_POS[0], CL_POS[1], 0], fov: FOV0 }
  const C1: Key = { p: [0.06, -0.085, 1.24], t: [0.0, -0.025, 0], fov: 31 }
  const CSTOP: Key = { p: [0.47, -0.045, 0.31], t: [0.5, 0.05, 0], fov: 40 }
  const CRAKE: Key = { p: [0.4, -0.6, 1.08], t: [-0.03, -0.07, 0], fov: 34 }
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3()
  const ka = new THREE.Vector3(), kb = new THREE.Vector3(), kc = new THREE.Vector3(), kd = new THREE.Vector3()
  let camFov = FOV0
  const blend = (a: Key, b: Key, f: number) => {
    camPos.lerpVectors(ka.set(...a.p), kb.set(...b.p), f)
    camTgt.lerpVectors(kc.set(...a.t), kd.set(...b.t), f)
    camFov = mix(a.fov, b.fov, f)
  }

  // ---------------------------------------------------------------- the story clock

  const st = { k: 0, ride: 0, stopped: false, dist: D0, beat: 0 }
  const POST: PostOpts = { tone: "agx", exposure: 1.45, bloom: 0.06, bloomThresh: 2.8, bloomRadius: 0.6, vignette: 0.16, grain: 0.02, contrast: 1.06, sat: 1.0, lift: [0.01, 0.011, 0.015], gain: [1.0, 1.0, 0.985], halation: 0.0, ca: 0.0003 }
  const TITLES: TitleOpts = {
    color: "#1d1e22",
    delay: [START + 0.25, 0.3, 0.25],
    maxLine: 44,
    subs: [
      "From about 3 seconds (GPT-2, 2019) to 17.4 hours (Claude Mythos Preview,\nApril 2026), at 50% success (METR)",
      "Doubling about every seven months since 2019 (METR 2025). Every 3.61 months now,\n95% interval 2.08 to 4.94 (METR, November 2026)",
      "Latest: GPT-6 Astra 40 h (13 to 2645), Opus 5.5 39 h (12 to 1253),\ntwo suites pooled (METR, 20 November 2026)",
    ],
  }
  const HUD = { color: "#2a2c31" }
  const bubble = { x: 0, y: 0 }
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3()
  const YUP = new THREE.Vector3(0, 1, 0)
  const R = rng(26)
  const tilt = Array.from({ length: NALL }, () => [(R() - 0.5) * 0.16, (R() - 0.5) * 0.16, R() * Math.PI * 2])
  const pinIn = new Float32Array(NALL) // 0..1 pushed in
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), vDir = new THREE.Vector3(), vSide = new THREE.Vector3()

  /** Place a tag on the board at (x, y), stood off, scaled to the label floor; alpha a. */
  const placeTag = (t: Tag, x: number, y: number, z: number, a: number, anchor: "l" | "r" | "c" = "l") => {
    v1.set(x, y, z)
    const f = Math.max(1, labelFloor(v1, t.cap, cam, t.minPx))
    const w = t.hw * 2 * f, h = t.hh * 2 * f
    t.mesh.scale.set(w, h, 1)
    const ox = anchor === "l" ? w / 2 : anchor === "r" ? -w / 2 : 0
    t.mesh.position.set(x + ox, y, z)
    t.alpha = a
    tagA(t).value = a
    t.mesh.visible = a > 0.002
    if (t.slot >= 0) (tagArr.array[t.slot] as THREE.Vector4).set(x + ox, y, a > 0.5 ? w / 2 : 0, a > 0.5 ? h / 2 : 0)
  }

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1), t2 = s.at(2)
    st.beat = s.beat
    // ---- the denomination
    const k = s.beat === 0 ? 0 : s.beat === 1 ? denomAt(t1) : KMAX
    st.k = k
    const c = cOf(k), T = tOf(k)
    U.ruleC.value = c
    U.ruleLT.value = Math.log(1 + T / c)
    U.logW.value = smooth(0.35, 1.6, k)

    // ---- the rule: hidden until it lands; the readout rolls out; then the hour scale is cut
    rule.visible = t0 >= 0 || s.beat > 0
    clips.visible = rule.visible
    U.ruleOn.value = rule.visible ? 1 : 0
    rface.update(ctx.def.id, ruleArrival(ctx.def.id, t0, B0.roll), ruleStyle)
    U.face.value = s.beat > 0 ? 1 : smooth(B0.axis0, B0.axis1, t0)
    let flash = 0, flashY = 0
    for (let j = 0; j < KMAX; j++) {
      const d = t1 - CLICK_T[j]
      if (s.beat === 1 && d >= 0 && d < 0.5) {
        flash = Math.max(flash, Math.exp(-d * 9))
        flashY = 1 - d * 2.2
      }
    }
    U.flash.value = flash
    U.flashY.value = flashY

    // ---- pins: pushed in during beat 0 (TH1.1), beat 2 (the pooled pair)
    for (let i = 0; i < NALL; i++) {
      const tt = i < NP ? t0 - PIN_T[i] : t2 - (i === NP ? B2.pool0 : B2.pool1)
      const on = i < NP ? (s.beat > 0 ? 1 : clamp(tt / 0.14)) : s.beat === 2 ? clamp(tt / 0.14) : 0
      pinIn[i] = on
    }
    // the glide: how far each pin is lifted while it moves to its new height
    let glide = 0
    if (s.beat === 1) for (const ct of CLICK_T) glide = Math.max(glide, Math.sin(Math.PI * clamp((t1 - ct) / CLICK_D)))
    for (let i = 0; i < NALL; i++) {
      pinPos(i, k, P2)
      const on = pinIn[i]
      // the TH1.1 pins wait in a row in the sheet's foot margin and fly to their places one by one
      const spare = i < NP && s.beat === 0
      let drop = on < 1 ? (1 - E.in2(on)) * 0.05 : 0
      if (spare) {
        const fly = clamp((t0 - PIN_T[i] + 0.3) / 0.44)
        const fe = E.io2(fly)
        P2.x = mix(SPARE.x0 + i * SPARE.dx, P2.x, fe)
        P2.y = mix(SPARE.y, P2.y, fe)
        drop = Math.sin(Math.PI * fly) * 0.035
      }
      const vis = spare || on > 0
      const land = i < NP ? t0 - PIN_T[i] - 0.14 : t2 - (i === NP ? B2.pool0 : B2.pool1) - 0.14
      const bump = land > 0 && land < 0.3 && s.beat !== 1 ? Math.abs(Math.sin(land * 30)) * Math.exp(-land * 18) * 0.0015 : 0
      const lift = glide * 0.004
      const [ta, tb, tc] = tilt[i]
      tmpQ.setFromAxisAngle(v1.set(Math.cos(tc), Math.sin(tc), 0), Math.hypot(ta, tb))
      const zBase = drop + bump + lift
      tmpP.set(P2.x, P2.y, zBase - 0.004)
      tmpS.set(1, 1, Z_HEAD + 0.004)
      tmpM.compose(tmpP, tmpQ, tmpS)
      if (!vis) tmpM.makeScale(0, 0, 0)
      shafts.setMatrixAt(i, tmpM)
      v2.set(0, 0, Z_HEAD).applyQuaternion(tmpQ)
      tmpP.set(P2.x + v2.x, P2.y + v2.y, zBase + v2.z)
      if (i < NP) {
        tmpM.compose(tmpP, tmpQ, tmpS.set(1, 1, 1))
        if (!vis) tmpM.makeScale(0, 0, 0)
        heads.setMatrixAt(i, tmpM)
      } else {
        tmpM.compose(tmpP, tmpQ, tmpS.set(1, 1, 1))
        if (on <= 0) tmpM.makeScale(0, 0, 0)
        rings.setMatrixAt(i - NP, tmpM)
      }
      ;(pinArr.array[i] as THREE.Vector4).set(P2.x, P2.y, (Z_HEAD + zBase) * (vis ? 1 : 0), vis ? 1 : 0)
      // the old holes: once a pin has left where it was first pushed in
      if (i < NP) (holeArr.array[i] as THREE.Vector4).set(px(PTS[i].t), linY[i], s.beat >= 1 ? clamp(Math.abs(P2.y - linY[i]) / 0.003) : 0, 0)
    }
    shafts.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    rings.instanceMatrix.needsUpdate = true

    // ---- the thread: wound after each pin as it goes in
    for (let i = 0; i < NP - 1; i++) {
      const g = s.beat > 0 ? 1 : E.out2(clamp((t0 - PIN_T[i] - 0.1) / Math.max(0.06, PIN_T[i + 1] - PIN_T[i])))
      pinPos(i, k, P2)
      const ax = P2.x, ay = P2.y
      pinPos(i + 1, k, P2)
      const bx2 = mix(ax, P2.x, g), by2 = mix(ay, P2.y, g)
      const len = Math.hypot(bx2 - ax, by2 - ay)
      const zt = Z_THREAD + glide * 0.004
      if (len < 1e-5 || pinIn[i] <= 0) {
        tmpM.makeScale(0, 0, 0)
        ;(thrArr.array[i] as THREE.Vector4).set(0, 0, 0, 0)
      } else {
        v1.set(bx2 - ax, by2 - ay, 0).normalize()
        tmpQ.setFromUnitVectors(YUP, v1)
        tmpM.compose(tmpP.set(ax, ay, zt), tmpQ, tmpS.set(0.0009, len, 0.0009))
        ;(thrArr.array[i] as THREE.Vector4).set(ax, ay, bx2, by2)
      }
      thread.setMatrixAt(i, tmpM)
    }
    thread.instanceMatrix.needsUpdate = true
    // the thread's start, from the spool hung in the margin to the first pin
    {
      pinPos(0, k, P2)
      const g0 = s.beat > 0 ? 1 : clamp((t0 - PIN_T[0] - 0.14) / 0.2)
      const ex = mix(SPOOL.x, P2.x, g0), ey = mix(SPOOL.y, P2.y, g0)
      const len = Math.hypot(ex - SPOOL.x, ey - SPOOL.y)
      if (len < 1e-4 || s.beat === 2) tmpM.makeScale(0, 0, 0)
      else {
        v1.set(ex - SPOOL.x, ey - SPOOL.y, 0).normalize()
        tmpQ.setFromUnitVectors(YUP, v1)
        tmpM.compose(tmpP.set(SPOOL.x, SPOOL.y, Z_THREAD + 0.006), tmpQ, tmpS.set(0.0009, len, 0.0009))
      }
      lead.matrix.copy(tmpM)
      lead.matrixWorldNeedsUpdate = true
    }

    // ---- the intervals: rise out of the paper in beat 1 (TH1.1), beat 2 (pooled)
    for (let i = 0; i < NALL; i++) {
      const p = i < NP ? PTS[i] : POOLED[i - NP]
      const r = i < NP ? (s.beat === 1 ? E.outBack(clamp((t1 - B1.bars0 - (i / NP) * (B1.bars1 - B1.bars0 - 0.3)) / 0.3)) : s.beat > 1 ? 1 : 0) : s.beat === 2 ? E.outBack(clamp((t2 - B2.pbars - (i - NP) * 0.12) / 0.35)) : 0
      pinPos(i, k, P2)
      const top = Math.min(py(yOf(p.hi, k)), PLOT.y1 + 0.01)
      const bot = py(yOf(p.lo, k))
      const y0 = mix(P2.y, bot, r), y1 = mix(P2.y, top, r)
      const z = Z_BAR * clamp(r * 1.4)
      const x = P2.x + 0.0022 // the wire runs beside its pin, not through it
      if (r <= 0.001) {
        tmpM.makeScale(0, 0, 0)
        wires.setMatrixAt(i, tmpM)
        caps.setMatrixAt(2 * i, tmpM)
        caps.setMatrixAt(2 * i + 1, tmpM)
        ;(barArr.array[i] as THREE.Vector4).set(0, 0, 0, 0)
        if (i >= NP) arrows.setMatrixAt(i - NP, tmpM)
        continue
      }
      tmpM.compose(tmpP.set(x, y0, z), tmpQ.identity(), tmpS.set(0.0007, Math.max(1e-5, y1 - y0), 0.0007))
      wires.setMatrixAt(i, tmpM)
      tmpM.compose(tmpP.set(x, y0, z), tmpQ, tmpS.set(0.0052, 0.0007, 0.0007))
      caps.setMatrixAt(2 * i, tmpM)
      const pooledTop = i >= NP
      tmpM.compose(tmpP.set(x, y1, z), tmpQ, pooledTop ? tmpS.set(0, 0, 0) : tmpS.set(0.0052, 0.0007, 0.0007))
      caps.setMatrixAt(2 * i + 1, tmpM)
      if (pooledTop) {
        tmpM.compose(tmpP.set(x, y1, z), tmpQ, tmpS.set(1, r, 1))
        arrows.setMatrixAt(i - NP, tmpM)
      }
      ;(barArr.array[i] as THREE.Vector4).set(x, y0, y1, z)
    }
    wires.instanceMatrix.needsUpdate = true
    caps.instanceMatrix.needsUpdate = true
    arrows.instanceMatrix.needsUpdate = true

    // ---- pencil: the dash from the last measured pin to 200 h, July 2027; the 16 h line
    pinPos(NP - 1, KMAX, P2)
    U.d0.value.set(P2.x, P2.y)
    U.d1.value.set(px(PROJ.t), py(yOf(PROJ.h, KMAX)))
    U.dash.value = s.beat === 2 ? E.io2(clamp((t2 - B2.dash0) / (B2.dash1 - B2.dash0))) : 0
    U.limY.value = py(yOf(16, KMAX))
    U.lim.value = s.beat === 2 ? E.io2(clamp((t2 - B2.lim0) / (B2.lim1 - B2.lim0))) : 0

    // ---- the camera
    let fovPunch = 0
    if (s.beat === 0) {
      // the landing frame, a push onto the readout while it rolls out, the pull back to the chart, the crane to the wall
      if (t0 < B0.cam0) blend(CL, C0, E.io3(clamp((t0 - B0.back0) / (B0.back1 - B0.back0))))
      else blend(C0, CWALL, E.io3(clamp((t0 - B0.cam0) / (B0.cam1 - B0.cam0))))
      const f = smooth(B0.cam0, B0.cam1, t0)
      // the landing's shudder, carried on from the transition's own (it is over by START)
      const sh = t0 > 0 && t0 < 0.6 ? Math.exp(-t0 * 10) * 0.002 : 0
      camTgt.y += sh * Math.sin(t0 * 60)
      const [hx, hy] = shake(s.time, 0.0012 * f, 0.3)
      camTgt.x += hx
      camTgt.y += hy
    } else if (s.beat === 1) {
      blend(CWALL, C1, E.io3(clamp(t1 / B1.back1)))
      if (t1 > B1.orb0) {
        // an orbit about the plot's middle to rake along the line
        const f = E.io3(clamp((t1 - B1.orb0) / (B1.orb1 - B1.orb0)))
        blend(C1, CRAKE, f)
        camPos.add(v1.set(-0.2, 0.0, 0.25).multiplyScalar(Math.sin(Math.PI * f)))
      }
      for (const ct of CLICK_T) {
        const d = t1 - ct
        if (d >= 0 && d < 0.4) fovPunch = Math.max(fovPunch, Math.exp(-d * 12) * 0.9)
      }
      const [hx, hy] = shake(s.time, 0.001, 0.3)
      camTgt.x += hx
      camTgt.y += hy
    } else {
      // the ride, then nothing
      const u = rideU(t2)
      st.ride = u
      st.stopped = t2 >= B2.ride1
      const into = E.io2(clamp(t2 / B2.ride0))
      rideAt(Math.max(0, u - 0.03), v2)
      rideAt(Math.min(1, u + 0.03), v1)
      const dir = vDir.copy(v1).sub(v2)
      rideAt(u, v1)
      if (dir.lengthSq() < 1e-10) dir.set(0.8, 0.45, 0)
      dir.normalize()
      // behind and below the line, low over the paper, looking along it toward the pins ahead
      const side = vSide.set(dir.y, -dir.x, 0)
      ka.copy(v1).addScaledVector(dir, -0.07).addScaledVector(side, 0.04).add(kb.set(0, 0, 0.24))
      kc.copy(v1).addScaledVector(dir, 0.06).add(kd.set(0, 0, 0.0))
      // the last stretch eases onto the stop: the pair, the last measured pin and the dashes in one frame
      const settle = smooth(0.62, 1, u)
      ka.lerp(v2.set(...CSTOP.p), settle)
      kc.lerp(v2.set(...CSTOP.t), settle)
      camPos.lerpVectors(v2.set(...CRAKE.p), ka, into)
      camTgt.lerpVectors(vSide.set(...CRAKE.t), kc, into)
      camFov = mix(CRAKE.fov, 40, into)
    }
    if (s.beat < 2) {
      camTgt.x += s.mouse.x * 0.004
      camTgt.y += s.mouse.y * 0.003
    }
    cam.position.copy(camPos)
    cam.up.set(0, 1, 0)
    cam.lookAt(camTgt)
    cam.fov = camFov - fovPunch
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    st.dist = camPos.distanceTo(camTgt)

    // ---- tags and tabs
    const ruleRight = RULE.x + RULE.w / 2 + 0.006
    const tabIn = s.beat > 0 ? 1 : E.out3(clamp((t0 - B0.tabs) / 0.45))
    const linOut = s.beat === 0 ? 1 : 1 - smooth(CLICK_T[0], CLICK_T[0] + 0.2, t1)
    LIN_TABS.forEach((h, i) => placeTag(linTabs[i], ruleRight - (1 - tabIn) * 0.03, py(yOf(h, k)), Z_TAB, tabIn * linOut * (s.beat < 2 ? 1 : 0), "l"))
    LOG_TABS.forEach(([h], i) => {
      const y = py(yOf(h, k))
      // a decade's tab shows once it has room: its distance from the next decade on the rule
      const yn = i < LOG_TABS.length - 1 ? py(yOf(LOG_TABS[i + 1][0], k)) : Infinity
      const yp = i > 0 ? py(yOf(LOG_TABS[i - 1][0], k)) : -Infinity
      const room = Math.min(yn - y, y - yp)
      const inPlot = y <= PLOT.y1 + 0.002 && y >= PLOT.y0 - 0.002
      const a = s.beat === 0 ? 0 : smooth(0.022, 0.03, room) * (inPlot ? 1 : 0) * smooth(CLICK_T[0] + 0.1, CLICK_T[0] + 0.4, s.beat === 1 ? t1 : 99)
      placeTag(logTabs[i], ruleRight, y, Z_TAB, a, "l")
    })
    pinPos(0, k, P2)
    placeTag(tGpt2, P2.x + 0.008, P2.y + 0.028, Z_TAG, s.beat === 0 ? E.out3(clamp((t0 - B0.gptTag) / 0.3)) : s.beat === 1 ? 1 - smooth(CLICK_T[0] - 0.3, CLICK_T[0], t1) : 0)
    pinPos(NP - 1, k, P2)
    const myA = s.beat === 0 ? E.out3(clamp((t0 - B0.mythTag) / 0.3)) : s.beat === 1 ? 1 - smooth(CLICK_T[0] - 0.3, CLICK_T[0], t1) : 0
    placeTag(tMyth, P2.x - 0.012, P2.y + 0.004, Z_TAG, myA, "r")
    const ciA = s.beat === 1 ? E.out3(clamp((t1 - B1.mythTag) / 0.3)) : 0
    placeTag(tMythCI, P2.x - 0.012, P2.y - 0.03, Z_TAG, ciA, "r")
    pinPos(NP, KMAX, P2)
    const pA = s.beat === 2 ? E.out3(clamp((t2 - B2.ptags) / 0.3)) : 0
    placeTag(tAstra, P2.x - 0.01, P2.y + 0.024, Z_TAG, pA, "r")
    placeTag(tOpus, P2.x + 0.012, P2.y - 0.016, Z_TAG, pA, "l")
    placeTag(tPool, P2.x + 0.012, P2.y - 0.05, Z_TAG, s.beat === 2 ? E.out3(clamp((t2 - B2.ptags - 0.25) / 0.3)) : 0, "l")
    placeTag(tProj, U.d1.value.x + 0.01, U.d1.value.y + 0.012, Z_TAG, s.beat === 2 ? E.out3(clamp((t2 - B2.projTag) / 0.3)) : 0, "l")
    placeTag(tLim, PLOT.x0 + 0.012, U.limY.value + 0.018, Z_TAG, s.beat === 2 ? E.out3(clamp((t2 - B2.lim1) / 0.3)) : 0, "l")

    // ---- the reviewer points at the rule
    // at the wall: the last measured points standing straight up
    pinPos(NP - 4, 0, P2)
    v1.set(P2.x - 0.004, P2.y + 0.006, Z_HEAD).project(cam)
    bubble.x = (v1.x * 0.5 + 0.5) * DW
    bubble.y = (0.5 - v1.y * 0.5) * DH

    // ---- focus
    D.asp.value = cam.aspect
    if (s.beat === 2) {
      rideAt(Math.min(1, st.ride), v1)
      D.focus.value = cam.position.distanceTo(v1)
      D.blur.value = 0.01 * E.io2(clamp(t2 / B2.ride0)) * (1 - 0.7 * smooth(0.6, 1, st.ride))
    } else {
      D.focus.value = st.dist
      D.blur.value = s.beat === 1 ? 0.004 * smooth(B1.orb0, B1.orb1, t1) : 0.003 * smooth(B0.cam0, B0.cam1, t0)
    }
    if (debug) D.blur.value = 0

    // ---- beds: a room and the window; gone at the stop
    if (s.live && !(s.beat === 2 && st.stopped)) {
      const fade = s.beat === 2 ? 1 - smooth(B2.ride1 - 1.2, B2.ride1, t2) : 1
      ctx.synth.bed("air", (0.22 + (s.beat === 2 ? 0.25 * st.ride : 0)) * fade)
      ctx.synth.bed("hum", 0.1 * fade)
    }
  }

  // ---------------------------------------------------------------- sound
  const lp: [number, number, number] = [0, 0, 0]
  const sp = new THREE.Vector3()
  const at3 = (i: number, k: number) => {
    pinPos(i, k, P2)
    return sp.set(P2.x, P2.y, 0)
  }
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: B0.roll }),
    // the hour scale is cut into the rule
    { b: 0, at: B0.axis0, s: "scratch", o: { f: 2400, g: 0.2, dur: B0.axis1 - B0.axis0 }, pos: [-0.76, 0, 0.1] },
    { b: 0, at: B0.tabs, s: "cards", o: { g: 0.25, dur: 5 }, pos: [-0.85, 0, 0.1] },
    // the reviewer
    { b: 0, at: B0.rev, s: "select", o: { g: 0.35 } },
    // beat 1: back square-on
    { b: 1, at: 0.05, s: "whoosh", o: { g: 0.2, f: 160, dur: 0.9 } },
    // beat 2: the ride, and its stop
    { b: 2, at: B2.ride0, s: "whoosh", o: { g: 0.22, f: 120, dur: B2.ride1 - B2.ride0 } },
    { b: 2, at: B2.ride1, s: "thump", o: { g: 0.55 }, pos: [0, -0.1, 0.1] },
    { b: 2, at: B2.ride1, s: "sub", o: { g: 0.55 } },
    { b: 2, at: B2.ride1 + 0.02, s: "bell", o: { f: H(32), g: 0.14, wet: 1.6 } },
  ]
  // beat 0: each pin pushed in, one tick each, faster and faster: the pulse
  PTS.forEach((_, i) => {
    cues.push({ b: 0, at: PIN_T[i] + 0.14, s: "tick", o: { f: H(56 + (i % 4)), g: 0.4 + 0.3 * (i / NP) }, pos: () => listenerPos(at3(i, 0), cam, st.dist, lp) })
    cues.push({ b: 0, at: PIN_T[i] + 0.14, s: "thud", o: { f: H(9), g: 0.14 }, pos: () => listenerPos(at3(i, 0), cam, st.dist, lp) })
  })
  cues.push({ b: 0, at: PIN_T[1], s: "scratch", o: { f: 3200, g: 0.08, dur: PIN_T[NP - 1] - PIN_T[1] } })
  // beat 1: seven ×10 clicks, a harmonic up each time (as the rule clicks elsewhere), the rule ringing
  CLICK_T.forEach((ct, j) => {
    const ruleAt: [number, number, number] = [-0.76, -0.1 + j * 0.08, 0.1]
    cues.push({ b: 1, at: ct, s: "tick", o: { f: H(74 + j), g: 0.55 }, pos: ruleAt })
    cues.push({ b: 1, at: ct, s: "marimba", o: { f: H(22 + j), g: 0.34 }, pos: ruleAt })
    cues.push({ b: 1, at: ct + 0.01, s: "gear", o: { g: 0.18, dur: 3 }, pos: ruleAt })
  })
  // the wires: a plucked run
  for (let i = 0; i < NP; i += 2) cues.push({ b: 1, at: B1.bars0 + (i / NP) * (B1.bars1 - B1.bars0 - 0.3) + 0.12, s: "pluck", o: { f: H(16 + ((i / 2) % 6)), g: 0.22 }, pos: () => listenerPos(at3(i, KMAX), cam, st.dist, lp) })
  // beat 2: the pooled pair (brass), their wires, the pencil
  cues.push({ b: 2, at: B2.pool0 + 0.14, s: "thud", o: { f: H(7), g: 0.35 }, pos: () => listenerPos(at3(NP, KMAX), cam, st.dist, lp) })
  cues.push({ b: 2, at: B2.pool0 + 0.15, s: "glass", o: { f: H(40), g: 0.18 }, pos: () => listenerPos(at3(NP, KMAX), cam, st.dist, lp) })
  cues.push({ b: 2, at: B2.pool1 + 0.14, s: "thud", o: { f: H(7), g: 0.3 }, pos: () => listenerPos(at3(NP + 1, KMAX), cam, st.dist, lp) })
  cues.push({ b: 2, at: B2.pool1 + 0.15, s: "glass", o: { f: H(42), g: 0.15 }, pos: () => listenerPos(at3(NP + 1, KMAX), cam, st.dist, lp) })
  cues.push({ b: 2, at: B2.pbars + 0.1, s: "pluck", o: { f: H(12), g: 0.25 } })
  for (let j = 0; j < 9; j++) cues.push({ b: 2, at: B2.dash0 + ((B2.dash1 - B2.dash0) * j) / 9, s: "scratch", o: { f: 1700 + j * 40, g: 0.12, dur: 0.06 } })
  cues.push({ b: 2, at: B2.lim0, s: "scratch", o: { f: 900, g: 0.1, dur: B2.lim1 - B2.lim0 } })
  // the pulse at its fastest: one tick for each pin the ride passes; nothing after the stop
  passT.forEach((pt, j) => cues.push({ b: 2, at: pt, s: "tick", o: { f: H(60 + (j % 3)), g: 0.28 + 0.02 * j } }))

  // ---------------------------------------------------------------- labels
  const LBL: LabelInfo[] = []
  const lblPool = new Map<string, LabelInfo>()
  const corner = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const pushQuad = (id: string, pts: THREE.Vector3[]) => {
    let L = lblPool.get(id)
    if (!L) {
      L = { id, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }
      lblPool.set(id, L)
    }
    for (let i = 0; i < 4; i++) {
      v1.copy(pts[i]).project(cam)
      L.corners[i][0] = v1.x
      L.corners[i][1] = v1.y
    }
    LBL.push(L)
  }
  const QC: [number, number][] = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]
  function labels(s: State): LabelInfo[] {
    LBL.length = 0
    for (const t of tags) {
      if (t.alpha < 0.95 || !t.mesh.visible) continue
      // only what is in view: a tab or tag the camera has left behind is not meant to be read now
      v1.copy(t.mesh.position).project(cam)
      if (v1.z > 1 || Math.abs(v1.x) > 1 || Math.abs(v1.y) > 1) continue
      t.mesh.updateMatrixWorld()
      for (let i = 0; i < 4; i++) corner[i].set(QC[i][0], QC[i][1], 0).applyMatrix4(t.mesh.matrixWorld)
      pushQuad(t.id, corner)
    }
    // the printed years, when the board is seen square-on
    const square = (s.beat === 0 && s.t > B0.back1 && s.t < B0.cam0) || (s.beat === 1 && s.t > B1.back1 && s.t < B1.orb0)
    if (square)
      for (const yr of YEARS) {
        const x = px(yr), y = PLOT.y0 - 0.0385, w = 0.035 * 0.56 * 2
        corner[0].set(x - w / 2, y + YEAR_CAP, 0)
        corner[1].set(x + w / 2, y + YEAR_CAP, 0)
        corner[2].set(x + w / 2, y, 0)
        corner[3].set(x - w / 2, y, 0)
        pushQuad(`year ${yr}`, corner)
      }
    return LBL
  }

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x2a1d12, 1)
      r.setRenderTarget(stage)
      for (const t of tags) t.mesh.updateMatrixWorld()
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      if (debug) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 0) comment(g, "Log axis, please.", bubble.x, bubble.y, s.t, { t0: B0.rev, out: B0.revOut, side: "left" })
    },
    hud: () => HUD,
    labels,
    dispose() {
      rface.dispose()
      printTex.dispose()
      cardTex.dispose()
      for (const t of tags) t.tex.dispose()
      tagGeo.dispose()
      disposeTree(scene)
    },
  }
}
