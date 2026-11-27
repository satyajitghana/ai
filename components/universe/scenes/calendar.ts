// Scene 27, calendar: "Now squeeze all of it into one year."
//
// Staging. Night, one desk lamp. A mid-century office desk: battleship linoleum (grey-green, jaspé
// mottle, polished pale where hands rest, a coffee ring, pencil scratches, dust) with an oak edge.
// In the lamp's pool, a page-a-day tear-off pad: 365 sheets of newsprint stapled under a red cloth
// binding on a leaning card back, and to its right a black split-flap clock (HH MM SS, and a row of
// eight letter flaps under the digits, like a departures board). Torn sheets fall on the desk and
// stay there, so the year piles up.
//
// Story parameter. `P(b, t)`, pages torn (0 = January 1 on top, 364 = December 31). Then `S`, the
// clock's seconds of the day. World rule: `pageAt(i, P)` puts every sheet somewhere (on the pad,
// peeling, in flight, on the desk); the clock's six drums read `S = frac(P) * 86400` while pages
// run, and the same drums take the last day in beats 2 and 3, the last twelve seconds in real time.
// One lamp lights everything (`lamp()`), and the pad and the clock shade the desk from it.
//
// Every date and count on screen is in script.ts: the stop pages (January 1, September 1, December
// 17, December 30, December 31), 23:48, 23:59:33 (27 s), 23:59:48 (about 12 s), under one second.
// The late-September sheet carries a red LIFE block, marked ahead on the pad; the race does not stop
// there, so it flashes past and lands on the desk, and no day of late September is held on screen.
// uncovered, so no day of late September is printed on screen.
// Beat sheet: R/beats/calendar.md.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraPosition, clamp as clampN, cos, cross, dot, exp, float, floor, Fn, fract, frontFacing, fwidth, max, min, mix as mixN, modelWorldMatrix, normalize, normalWorld, positionGeometry, positionView, positionWorld, pow, select, sin, step, texture, uniform, uv as uvAttr, uniformTexture, vec2, vec3, vec4, If, Loop, sqrt, length } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { SCENES } from "../script"
import { TEAROFF_DUR, TEAROFF_IN } from "../transitions/tearoff"

// ---------------------------------------------------------------- the calendar of the year

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DAYS: [number, number][] = []
MLEN.forEach((n, m) => {
  for (let d = 1; d <= n; d++) DAYS.push([m, d])
})
// the stop pages (day index from January 1 = 0): the arithmetic is 13.787 billion years over 365 days
const SEP1 = 243, LIFE = 267, DEC17 = 350, DEC30 = 363, DEC31 = 364
{
  const ok = DAYS.length === 365 && DAYS[SEP1].join() === "8,1" && DAYS[DEC17].join() === "11,17" && DAYS[DEC30].join() === "11,30" && DAYS[DEC31].join() === "11,31" && DAYS[LIFE][0] === 8 && DAYS[LIFE][1] > 20
  if (!ok) throw new Error("calendar: page table is wrong")
}
/** Which stamp a page carries: 1 the Sun, 2 life (a solid block over the numeral), 3 Cambrian, 4 dinosaurs. */
const STAMP_OF: Record<number, number> = { [SEP1]: 1, [LIFE]: 2, [DEC17]: 3, [DEC30]: 4 }

// ---------------------------------------------------------------- the story clock

const START = TEAROFF_DUR * (1 - TEAROFF_IN)
const BEAT_LEN = [10.5, 13.5, 10, 16]
const herm = (p0: number, p1: number, m0: number, m1: number, u: number) => {
  const u2 = u * u, u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1
}
/** A run from p0 to p1 over [t0, t1] with slopes v0, v1 (pages per second). */
const run = (t: number, t0: number, t1: number, p0: number, p1: number, v0: number, v1: number) => herm(p0, p1, v0 * (t1 - t0), v1 * (t1 - t0), clamp((t - t0) / (t1 - t0)))

const B0_GO = 4.8, B0_END = 10.5, B0_P = 90, B0_V = 30
// beat 1 stops: September 1, the life stamp, December 17, December 30
const T_SUN = 2.0, T_GO2 = 3.6, T_CAMB = 7.3, T_GO3 = 8.2, T_DINO = 9.6
// beat 2: the last tear, then the clock takes the day
const T_TEAR0 = 0.5, T_TEAR1 = 1.5, T_ROLL0 = 1.9, T_ROLL1 = 5.4
// beat 3: farming, writing, then the real seconds
const S_SAP = 23 * 3600 + 48 * 60, S_FARM = 86400 - 27, S_WRIT = 86400 - 12
const T_FARM0 = 0.2, T_FARM = 1.3, T_WRIT0 = 1.8, T_WRIT = 2.6, T_MID = T_WRIT + 12
const T_SPUT = T_MID - 69 / 437.18 // Sputnik, 1957: 69 years before 2026 at 437 years a second (arithmetic)

/** Pages torn: a pure function of the beat and its clock. */
function pagesAt(b: number, t: number): number {
  if (b <= 0) return t < B0_GO ? 0 : Math.min(B0_P, B0_P * Math.pow(clamp((t - B0_GO) / (B0_END - B0_GO)), 1.9))
  if (b === 1) {
    if (t < T_SUN) return run(t, 0, T_SUN, B0_P, SEP1, B0_V, 0)
    if (t < T_GO2) return SEP1
    if (t < T_CAMB) return run(t, T_GO2, T_CAMB, SEP1, DEC17, 0, 0)
    if (t < T_GO3) return DEC17
    return run(t, T_GO3, T_DINO, DEC17, DEC30, 0, 0)
  }
  if (b === 2) return t < T_TEAR0 ? DEC30 : DEC30 + E.io2(clamp((t - T_TEAR0) / (T_TEAR1 - T_TEAR0)))
  return DEC31
}
/** The clock's seconds of the day (86400 is midnight, shown as 00:00:00). */
function secondsAt(b: number, t: number): number {
  if (b < 2) return (pagesAt(b, t) % 1) * 86400
  if (b === 2) {
    if (t < T_TEAR1) return (pagesAt(b, t) % 1) * 86400
    return S_SAP * E.out3(clamp((t - T_ROLL0) / (T_ROLL1 - T_ROLL0)))
  }
  if (t < T_FARM) return run(t, T_FARM0, T_FARM, S_SAP, S_FARM, 0, 0)
  if (t < T_WRIT0) return S_FARM
  if (t < T_WRIT) return run(t, T_WRIT0, T_WRIT, S_FARM, S_WRIT, 0, 1)
  return Math.min(86400, S_WRIT + (t - T_WRIT))
}

/** When page i came free (detached) and in which beat: precomputed by walking each beat's clock. */
const TEAR: { b: number; t: number }[] = Array.from({ length: 365 }, () => ({ b: -1, t: 0 }))
{
  for (let b = 0; b < 3; b++) {
    let prev = pagesAt(b, 0)
    for (let k = 1; k <= BEAT_LEN[b] * 2000; k++) {
      const t = k / 2000
      const p = pagesAt(b, t)
      for (let i = Math.floor(prev); i < Math.floor(p + 1e-9) && i < 365; i++) if (TEAR[i].b < 0) TEAR[i] = { b, t }
      prev = p
    }
  }
  // pages torn before beat 1 starts on a cold seek into beat 1 or later: anything left unassigned below the start
  for (let i = 0; i < 365; i++) if (TEAR[i].b < 0) TEAR[i] = { b: 99, t: 0 }
}

/** Letter row: the words and when each starts to flip in. */
const WORDS: { b: number; t: number; w: string }[] = [
  { b: 2, t: T_ROLL1 - 0.25, w: "SAPIENS" },
  { b: 3, t: T_FARM - 0.2, w: "FARMING" },
  { b: 3, t: T_WRIT - 0.25, w: "WRITING" },
  { b: 3, t: T_SPUT - 0.3, w: "SPUTNIK" },
]
const CHARS = "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const CYCLE = " ABCDEFGHIJKLMNOPQRSTUVWXYZ" // a letter flap's own order

// ---------------------------------------------------------------- the set (metres; y up, the lens at +z)

const TH = 0.24 // the card leans back this far
const EX = new THREE.Vector3(1, 0, 0)
const EY = new THREE.Vector3(0, Math.cos(TH), -Math.sin(TH))
const EZ = new THREE.Vector3(0, Math.sin(TH), Math.cos(TH))
const PAD_O = new THREE.Vector3(0, 0.004, 0.012)
const PW = 0.12, PH = 0.15 // a sheet
const PB0 = 0.016 // sheet bottom, along the card
const PT = 0.00008 // newsprint
const PADW = 0.15, CARDH = 0.205, BIND0 = PB0 + PH, BIND1 = BIND0 + 0.019
const padAt = (u: number, v: number, w: number, out: THREE.Vector3) => out.copy(PAD_O).addScaledVector(EX, u).addScaledVector(EY, v).addScaledVector(EZ, w)
const CLK = { x: 0.31, z: 0.035, yaw: -0.3, w: 0.27, h: 0.135, d: 0.095 }
const LAMP = new THREE.Vector3(0.2, 0.39, 0.1) // the bulb
const LAMP_AIM = new THREE.Vector3(0.0, 0, 0.0)
const FOV = 32
const FLIGHT = 1.0

// ---------------------------------------------------------------- TSL helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const qrot = (q: THREE.Node<"vec4">, v: V3): V3 => {
  const u = q.xyz
  return v.add(cross(u, cross(u, v).add(v.mul(q.w))).mul(2)) as V3
}

/** A mask canvas (white on black), linear, mipmapped. */
function maskTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  const c = cv.getContext("2d")!
  c.fillStyle = "#000"
  c.fillRect(0, 0, w, h)
  c.fillStyle = "#fff"
  c.strokeStyle = "#fff"
  draw(c)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 30)
  const dbg = ctx.debugLabels

  // ---- print: months, day numerals, stamps (2048 square)
  const AT = 2048
  const atlas = maskTex(AT, AT, (c) => {
    c.textAlign = "center"
    c.textBaseline = "alphabetic"
    MONTHS.forEach((m, i) => {
      const x = (i % 4) * 512, y = Math.floor(i / 4) * 128
      c.font = `400 92px ${ctx.fonts.tall}`
      const w = c.measureText(m).width
      c.save()
      c.translate(x + 256, y + 104)
      c.scale(Math.min(1, 470 / w), 1)
      c.fillText(m, 0, 0)
      c.restore()
    })
    for (let d = 1; d <= 31; d++) {
      const i = d - 1, x = (i % 8) * 256, y = 384 + Math.floor(i / 8) * 288
      c.font = `400 262px ${ctx.fonts.tall}`
      const w = c.measureText(String(d)).width
      c.save()
      c.translate(x + 128, y + 270)
      c.scale(Math.min(1, 236 / w), 1)
      c.fillText(String(d), 0, 0)
      c.restore()
    }
    // the life stamp: a solid block with the word knocked out (the spare cell at col 7, row 3)
    {
      const x = 7 * 256, y = 384 + 3 * 288
      c.fillRect(x + 10, y + 16, 236, 256)
      c.fillStyle = "#000"
      c.fillRect(x + 22, y + 28, 212, 232)
      c.fillStyle = "#fff"
      c.fillRect(x + 30, y + 36, 196, 216)
      c.fillStyle = "#000"
      c.font = `400 104px ${ctx.fonts.typer}`
      c.fillText("LIFE", x + 128, y + 182)
      c.fillStyle = "#fff"
    }
    const stamp = (i: number, text: string, size: number) => {
      const x = (i % 2) * 1024, y = 1536 + Math.floor(i / 2) * 256
      c.lineWidth = 12
      c.strokeRect(x + 26, y + 28, 972, 200)
      c.lineWidth = 4
      c.strokeRect(x + 46, y + 48, 932, 160)
      c.font = `400 ${size}px ${ctx.fonts.typer}`
      const w = c.measureText(text).width
      c.save()
      c.translate(x + 512, y + 128 + size * 0.34)
      c.scale(Math.min(1, 880 / w), 1)
      c.fillText(text, 0, 0)
      c.restore()
    }
    stamp(0, "THE SUN FORMS", 108)
    stamp(1, "CAMBRIAN ANIMALS", 100)
    stamp(2, "DINOSAURS GONE", 104)
  })
  // ---- the clock's cards: 37 characters, 128 x 176 cells, white on black
  const CA = 1024
  const flapTex = maskTex(CA, CA, (c) => {
    c.textAlign = "center"
    c.textBaseline = "middle"
    for (let i = 0; i < CHARS.length; i++) {
      const x = (i % 8) * 128, y = Math.floor(i / 8) * 176
      const ch = CHARS[i]
      c.font = i < 10 ? `700 150px ${ctx.fonts.sans}` : `700 118px ${ctx.fonts.sans}`
      const w = c.measureText(ch).width
      c.save()
      c.translate(x + 64, y + 92)
      c.scale(Math.min(1, 108 / Math.max(w, 1)), 1)
      c.fillText(ch, 0, 0)
      c.restore()
    }
  })

  // ---- uniforms
  const U = {
    lamp: uniform(LAMP.clone()),
    aim: uniform(LAMP_AIM.clone().sub(LAMP).normalize()),
    lampOn: uniform(1),
    ink: uniform(new THREE.Vector4(0, 0, 0, 0)), // stamp slam per stamp 0..1
    topPage: uniform(new THREE.Vector4(0, 1, 0, 0)), // month, day, stamp, pageIndex of the page lying on top
    padBox: uniform(new THREE.Vector4(0, 0, 0, 0)), // stack depth (ez) for the shadow
    clkC: uniform(new THREE.Vector3()),
    clkX: uniform(new THREE.Vector3(1, 0, 0)),
    clkZ: uniform(new THREE.Vector3(0, 0, 1)),
    dbg: uniform(dbg ? 1 : 0),
    flicker: uniform(1),
  }
  const LCOL = vec3(1.0, 0.72, 0.44).mul(0.42)
  const ROOM = vec3(0.012, 0.014, 0.02)
  /** The lamp: a spot from the shade, inverse square, a wide soft cone and a little spill. */
  const lampAt = (P: V3): V3 => {
    const d = U.lamp.sub(P)
    const r2 = dot(d, d)
    const L = d.div(sqrt(r2))
    const cone = sstep(0.3, 0.84, dot(L.negate(), U.aim) as F).mul(0.92).add(0.08)
    return LCOL.mul(cone).mul(U.flicker).div(r2.add(0.01)) as V3
  }
  /** Soft shadow of the pad and the clock from four points on the bulb: ray-box slabs. */
  const occl = (P: V3): F => {
    const lit = float(0).toVar()
    const offs = [[0.02, 0.0, 0.015], [-0.02, 0.01, -0.012], [0.008, -0.01, -0.02], [-0.01, 0.0, 0.02]]
    for (const o of offs) {
      const Lp = U.lamp.add(vec3(o[0], o[1], o[2]))
      const d = Lp.sub(P).toVar()
      const len = sqrt(dot(d, d))
      const dir = d.div(len)
      const box = (c: V3, ax: V3, ay: V3, az: V3, h: V3): F => {
        const o2 = P.sub(c)
        const ro = vec3(dot(o2, ax), dot(o2, ay), dot(o2, az))
        const rd = vec3(dot(dir, ax), dot(dir, ay), dot(dir, az))
        const inv = vec3(1).div(rd.add(vec3(1e-6)))
        const t1 = h.negate().sub(ro).mul(inv), t2 = h.sub(ro).mul(inv)
        const tmin = max(max(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z))
        const tmax = min(min(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z))
        return step(max(tmin, 0.0005), tmax).mul(step(tmin, len)) as F
      }
      // the pad: card plus stack as one leaning box
      const pc = vec3(PAD_O.x, PAD_O.y, PAD_O.z).add(vec3(EY.x, EY.y, EY.z).mul(CARDH / 2)).add(vec3(EZ.x, EZ.y, EZ.z).mul(U.padBox.x.mul(0.5)))
      const hitPad = box(pc as V3, vec3(1, 0, 0) as V3, vec3(EY.x, EY.y, EY.z) as V3, vec3(EZ.x, EZ.y, EZ.z) as V3, vec3(PADW / 2, CARDH / 2, U.padBox.x.mul(0.5).add(0.002)) as V3)
      const hitClk = box(U.clkC as unknown as V3, U.clkX as unknown as V3, vec3(0, 1, 0) as V3, U.clkZ as unknown as V3, vec3(CLK.w / 2, CLK.h / 2, CLK.d / 2) as V3)
      lit.addAssign(float(1).sub(max(hitPad, hitClk)))
    }
    return lit.mul(0.25) as F
  }
  /** The world rule: the lamp, its shadow, the dim room. */
  const shade = (alb: V3, N: V3, P: V3, o: { spec?: Num; shin?: number; sh?: Num; ao?: Num; wrap?: number; trans?: Num }): V3 => {
    const V = normalize(cameraPosition.sub(P))
    const L = normalize(U.lamp.sub(P))
    const Li = lampAt(P).mul(fl(o.sh ?? 1))
    const w = o.wrap ?? 0
    const ndl = max(dot(N, L).add(w).div(1 + w), 0)
    const Hh = normalize(L.add(V))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5).mul(0.96).add(0.04)
    const sp = pow(max(dot(N, Hh), 0), o.shin ?? 30).mul(fl(o.spec ?? 0.1)).mul(fres.mul(6).min(1)).mul(float((o.shin ?? 30) + 8).div(25))
    const back = max(dot(N, L).negate(), 0).mul(fl(o.trans ?? 0))
    const amb = ROOM.mul(N.y.mul(0.3).add(0.7)).add(vec3(0.05, 0.035, 0.022).mul(max(N.y.negate(), 0).add(0.15)).mul(0.5)).mul(fl(o.ao ?? 1))
    return alb.mul(Li.mul(ndl.add(back)).add(amb)).add(Li.mul(sp)) as V3
  }
  const depthA = (): F => positionView.z.negate() as F
  const magenta = vec3(1, 0, 1)

  // ---- the desk: battleship linoleum with an oak edge band
  const DESK = { x0: -0.95, x1: 0.95, z0: -0.62, z1: 0.42 }
  const deskMat = new THREE.NodeMaterial()
  deskMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    const fw = fwidth(P.x).toVar()
    const top = step(0.5, N.y)
    // jaspé: streaks drawn out along x, a fine burlap-backed tooth
    const j = fbm(vec2(P.x.mul(7), P.z.mul(38))).toVar()
    const j2 = vnoise(vec2(P.x.mul(30), P.z.mul(160))).toVar()
    const lino = vec3(0.105, 0.13, 0.118).mul(j.mul(0.35).add(0.8)).mul(j2.mul(0.12).add(0.94)).toVar()
    // wear: polished paler where forearms rest, along the front edge
    const wear = sstep(0.12, 0.38, P.z as F).mul(sstep(0.62, 0.15, abs(P.x.add(0.05)) as F)).mul(fbm(P.xz.mul(5)).mul(0.6).add(0.5))
    lino.assign(mixN(lino, lino.mul(1.25).add(vec3(0.012, 0.012, 0.008)), wear.mul(0.7)))
    // a coffee ring: a dried rim darker than its middle
    const cr = vec2(0.17, 0.27)
    const rd = length(P.xz.sub(cr)).toVar()
    const ring = exp(rd.sub(0.034).div(0.0018).pow(2).negate()).mul(0.6).add(sstep(0.036, 0.03, rd as F).mul(0.12)).mul(vnoise(P.xz.mul(300)).mul(0.4).add(0.6))
    lino.mulAssign(mixN(vec3(1), vec3(0.62, 0.52, 0.42), ring))
    // scratches: short straight pale strokes in a few directions
    const scr = float(0).toVar()
    const fade = sstep(0.0016, 0.0005, fw)
    for (let k = 0; k < 3; k++) {
      const a = 0.4 + k * 1.1
      const q = vec2(P.x.mul(Math.cos(a)).add(P.z.mul(Math.sin(a))), P.z.mul(Math.cos(a)).sub(P.x.mul(Math.sin(a)))).mul(55).add(k * 7.3)
      const cell = floor(q)
      const h = hash21(cell.add(k * 3.1))
      const line = sstep(0.035, 0.0, abs(fract(q.y).sub(h)) as F).mul(step(0.86, hash21(cell.add(19.7 + k)))).mul(sstep(0.0, 0.25, fract(q.x) as F)).mul(sstep(1.0, 0.7, fract(q.x) as F))
      scr.assign(max(scr, line))
    }
    lino.assign(mixN(lino, vec3(0.2, 0.22, 0.2), scr.mul(fade).mul(0.5)))
    // dust: a pale bloom away from the worn zone
    lino.addAssign(vec3(0.02, 0.019, 0.017).mul(vnoise(P.xz.mul(900)).pow(6)).mul(fade))
    // the oak edge band on the front and sides
    const oakG = fbm(vec2(P.x.mul(4), P.y.mul(160))).toVar()
    const oak = vec3(0.32, 0.19, 0.09).mul(oakG.mul(0.5).add(0.7)).mul(sin(P.x.mul(900).add(oakG.mul(12))).mul(0.06).add(0.94))
    const edgeBand = step(DESK.z1 - 0.025, P.z).max(step(DESK.x1 - 0.025, abs(P.x)))
    const alb = mixN(mixN(lino, oak, edgeBand), oak.mul(0.8), top.oneMinus())
    // contact occlusion under the pad and the clock
    const pc = P.xz.sub(vec2(0, 0.0)).toVar()
    const aoPad = sstep(0.09, 0.0, max(abs(pc.x).sub(PADW / 2), abs(pc.y.sub(-0.012)).sub(0.03)) as F).mul(0.5)
    const cq = P.xz.sub(U.clkC.xz).toVar()
    const cl = vec2(dot(cq, U.clkX.xz), dot(cq, U.clkZ.xz))
    const aoClk = sstep(0.05, 0.0, max(abs(cl.x).sub(CLK.w / 2), abs(cl.y).sub(CLK.d / 2)) as F).mul(0.6)
    const ao = float(1).sub(max(aoPad, aoClk))
    const sh = occl(P as V3)
    const gloss = mixN(float(0.18), float(0.35), wear).mul(float(1).sub(ring.mul(0.6)))
    const col = shade(alb as V3, N as V3, P as V3, { spec: gloss.mul(top), shin: 55, sh: sh.mul(ao), ao })
    return vec4(col, depthA())
  })()
  const desk = new THREE.Mesh(new THREE.BoxGeometry(DESK.x1 - DESK.x0, 0.03, DESK.z1 - DESK.z0), deskMat)
  desk.position.set((DESK.x0 + DESK.x1) / 2, -0.015, (DESK.z0 + DESK.z1) / 2)
  scene.add(desk)

  // ---- the wall: distempered plaster, warm from the lamp's back-spill. The shade is open at the
  // top, so a soft fan of light lands on the wall above the head; lower down the lit desk throws a
  // warm bounce up it. Distemper is chalky and patchy, laid on with a wide brush: blotches, vertical
  // brush drag, a hairline crack, and a dado rail with its own shadow line.
  const wallMat = new THREE.NodeMaterial()
  wallMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const blot = fbm(P.xy.mul(2.2)).toVar()
    const drag = vnoise(vec2(P.x.mul(90), P.y.mul(5))).mul(0.5).add(vnoise(vec2(P.x.mul(260), P.y.mul(12))).mul(0.5)).toVar()
    const grit = vnoise(P.xy.mul(420)).toVar()
    const alb = vec3(0.42, 0.37, 0.29).mul(blot.mul(0.32).add(0.78)).mul(drag.mul(0.1).add(0.95)).mul(grit.mul(0.08).add(0.96)).toVar()
    // a hairline crack wandering down from the top
    const cx = P.x.add(0.42).add(fbm(vec2(P.y.mul(3), 1.7)).sub(0.5).mul(0.12)).add(vnoise(vec2(P.y.mul(40), 4.1)).sub(0.5).mul(0.008))
    const crack = sstep(0.0016, 0.0, abs(cx) as F).mul(sstep(0.55, 0.85, P.y as F))
    alb.mulAssign(float(1).sub(crack.mul(0.5)))
    // the dado rail: a moulding at 0.82 m with a shadow under its lip
    const ry = P.y.sub(0.82)
    const rail = sstep(0.012, 0.004, abs(ry.sub(0.008)) as F)
    const railSh = sstep(-0.016, 0.0, ry as F).mul(sstep(0.004, -0.004, ry as F))
    alb.assign(mixN(alb, vec3(0.36, 0.3, 0.22), rail.mul(0.6)))
    // light: the fan above the shade's open top, the lamp's own cone where it grazes, the desk's bounce
    const fan = exp(length(P.xy.sub(vec2(LAMP.x + 0.02, LAMP.y + 0.32)).mul(vec2(1.0, 0.75))).mul(-3.2)).mul(0.13)
    const graze = lampAt(P as V3).mul(0.35)
    const bounce = exp(length(P.xy.sub(vec2(0.05, 0.0)).mul(vec2(0.8, 1.6))).mul(-2.6)).mul(0.07)
    const light = vec3(1.0, 0.74, 0.48).mul(fan.add(bounce)).add(graze).add(ROOM.mul(0.8))
    const col = alb.mul(light).mul(float(1).sub(railSh.mul(0.45))).mul(float(1).sub(rail.mul(0.15)))
    // a skirting shadow where the wall meets the desk
    return vec4(col.mul(sstep(0.0, 0.08, P.y as F).mul(0.6).add(0.4)), depthA())
  })()
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), wallMat)
  wall.position.set(0, 0.95, DESK.z0)
  scene.add(wall)
  // below the desk's edge: the dark knee hole
  const voidMat = new THREE.NodeMaterial()
  voidMat.fragmentNode = vec4(vec3(0.004, 0.004, 0.005), depthA())
  const voidM = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), voidMat)
  voidM.position.set(0, -1.03, DESK.z0)
  scene.add(voidM)

  // ---- page print: the page's own face from the atlas (uv: v up)
  const cell = (col: F | number, row: F | number, cw: number, ch: number, y0: number, lu: V2): V2 => {
    const x = fl(col).mul(cw).add(lu.x.mul(cw)).div(AT)
    const yc = fl(row).mul(ch).add(y0).add(float(1).sub(lu.y).mul(ch))
    return vec2(x, float(1).sub(yc.div(AT))) as V2
  }
  const inBox = (q: V2): F => step(0, q.x).mul(step(q.x, 1)).mul(step(0, q.y)).mul(step(q.y, 1)) as F
  const PAPER = vec3(0.78, 0.745, 0.655)
  const INK = vec3(0.022, 0.02, 0.022)
  const RED = vec3(0.5, 0.045, 0.035)
  const STAMPRED = vec3(0.62, 0.05, 0.07)
  /** Albedo of a page and, in w, how much of it is a label plate (for ?labels). */
  const pagePrint = (uv: V2, m: F, d: F, st: F, ink: F, seed: F) => {
    const fibre = vnoise(uv.mul(vec2(180, 220)).add(seed.mul(13))).mul(0.06).add(vnoise(uv.mul(30).add(seed)).mul(0.05)).toVar()
    const paper = PAPER.mul(fibre.add(0.92)).toVar()
    // yellowing toward the exposed edges, darker on the long-exposed top page
    const edge = min(min(uv.x, uv.y), min(float(1).sub(uv.x), float(1).sub(uv.y)))
    paper.mulAssign(mixN(vec3(0.88, 0.8, 0.66), vec3(1), sstep(0.0, 0.05, edge as F)))
    // month header
    const qm = vec2(uv.x.sub(0.2).div(0.6), uv.y.sub(0.83).div(0.12))
    const mk = texture(atlas, cell(m.mod(4), floor(m.div(4)), 512, 128, 0, clampN(qm, 0, 1) as V2)).r.mul(inBox(qm as V2))
    // the numeral
    const qd = vec2(uv.x.sub(0.211).div(0.578), uv.y.sub(0.27).div(0.52))
    const di = d.sub(1)
    const dk = texture(atlas, cell(di.mod(8), floor(di.div(8)), 256, 288, 384, clampN(qd, 0, 1) as V2)).r.mul(inBox(qd as V2))
    // rules above and below, and the perforation dots under the binding
    const rule = sstep(0.004, 0.0015, abs(uv.y.sub(0.815)) as F).add(sstep(0.003, 0.001, abs(uv.y.sub(0.245)) as F)).mul(step(0.08, uv.x)).mul(step(uv.x, 0.92))
    const perf = sstep(0.0045, 0.002, length(vec2(fract(uv.x.mul(48)).sub(0.5).div(48), uv.y.sub(0.985))) as F)
    const col = mixN(paper, RED, mk.mul(0.92)).toVar()
    col.assign(mixN(col, INK, max(dk.mul(0.95), rule.mul(0.8))))
    col.assign(mixN(col, paper.mul(0.35), perf))
    // the stamp: rubber ink, uneven, with a darker rim, slammed in
    const stI = st.sub(1)
    const blot = vnoise(uv.mul(70).add(seed.mul(5))).mul(0.55).add(vnoise(uv.mul(400)).mul(0.45)).toVar()
    const take = sstep(0.18, 0.42, blot as F)
    const sCol = float(0).toVar()
    const sBox = float(0).toVar()
    If(st.greaterThan(0.5), () => {
      If(abs(st.sub(2)).lessThan(0.1), () => {
        // the life block over the numeral, turned a few degrees
        const c0 = uv.sub(vec2(0.5, 0.53))
        const a = 0.12
        const r = vec2(c0.x.mul(Math.cos(a)).sub(c0.y.mul(Math.sin(a) * 1.25)), c0.x.mul(Math.sin(a) / 1.25).add(c0.y.mul(Math.cos(a))))
        const q = vec2(r.x.div(0.7).add(0.5), r.y.div(0.58).add(0.5))
        sCol.assign(texture(atlas, cell(7, 3, 256, 288, 384, clampN(q, 0, 1) as V2)).r.mul(inBox(q as V2)))
        sBox.assign(inBox(q as V2))
      }).Else(() => {
        const c0 = uv.sub(vec2(0.5, 0.14))
        const a = -0.07
        const r = vec2(c0.x.mul(Math.cos(a)).sub(c0.y.mul(Math.sin(a) * 1.25)), c0.x.mul(Math.sin(a) / 1.25).add(c0.y.mul(Math.cos(a))))
        const q = vec2(r.x.div(0.9).add(0.5), r.y.div(0.18).add(0.5))
        const k = select(stI.lessThan(1.5), float(0), select(stI.lessThan(2.5), float(1), float(2)))
        sCol.assign(texture(atlas, cell(k.mod(2), floor(k.div(2)), 1024, 256, 1536, clampN(q, 0, 1) as V2)).r.mul(inBox(q as V2)))
        sBox.assign(inBox(q as V2))
      })
    })
    const inkA = sCol.mul(take.mul(0.75).add(0.25)).mul(ink).mul(0.88)
    col.assign(mixN(col, mixN(STAMPRED, STAMPRED.mul(0.55), blot.mul(0.6)), inkA))
    // label plates: the numeral's box and the stamp's box
    const plate = max(inBox(qd as V2), sBox.mul(step(0.5, ink)))
    return { col, plate: plate as F }
  }

  // ---- the stack, the card, the binding
  const padGroup = new THREE.Group()
  scene.add(padGroup)
  // the card back: chipboard, plain on the back, its front only shows round the pad
  const cardMat = new THREE.NodeMaterial()
  cardMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const n = vnoise(P.xy.mul(400).add(P.z.mul(300))).mul(0.25).add(fbm(P.xy.mul(30)).mul(0.25))
    const alb = vec3(0.24, 0.2, 0.15).mul(n.add(0.8))
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.04, shin: 8, sh: occl(P as V3).mul(0.6).add(0.4) }), depthA())
  })()
  const card = new THREE.Mesh(new THREE.BoxGeometry(PADW, CARDH, 0.0025), cardMat)
  padAt(0, CARDH / 2, -0.00125, card.position)
  card.rotation.x = -TH
  padGroup.add(card)
  // the easel strut behind it
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.002), cardMat)
  strut.position.set(0, 0.075, -0.07)
  strut.rotation.x = 0.55
  padGroup.add(strut)
  // the remaining sheets: a box whose sides are paper edges
  const stackMat = new THREE.NodeMaterial()
  stackMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    const w = dot(P.sub(vec3(PAD_O.x, PAD_O.y, PAD_O.z)), vec3(EZ.x, EZ.y, EZ.z))
    const lines = sin(w.div(PT).mul(Math.PI * 2)).mul(0.5).add(0.5).mul(sstep(0.0002, 0.00006, fwidth(w) as F))
    const uneven = vnoise(vec2(w.mul(3000), P.x.mul(80).add(P.y.mul(80)))).mul(0.12)
    const alb = PAPER.mul(vec3(0.95, 0.9, 0.8)).mul(float(0.9).add(lines.mul(0.08)).sub(uneven))
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.02, shin: 6, sh: occl(P as V3).mul(0.5).add(0.5), wrap: 0.3 }), depthA())
  })()
  const stack = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stackMat)
  stack.rotation.x = -TH
  padGroup.add(stack)
  // the stubs under the binding: torn ragged edges, full height whatever is left
  const stubMat = new THREE.NodeMaterial()
  stubMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const w = dot(P.sub(vec3(PAD_O.x, PAD_O.y, PAD_O.z)), vec3(EZ.x, EZ.y, EZ.z))
    const rag = vnoise(vec2(P.x.mul(900), w.mul(5000))).mul(0.3)
    const alb = PAPER.mul(vec3(0.92, 0.86, 0.74)).mul(rag.add(0.75))
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.0, shin: 4, wrap: 0.4 }), depthA())
  })()
  const stub = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.004, 1), stubMat)
  stub.rotation.x = -TH
  padGroup.add(stub)
  // the binding: red bookcloth over card, two staples
  const bindMat = new THREE.NodeMaterial()
  bindMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const weave = sin(P.x.mul(5200)).mul(sin(P.y.mul(5200).add(P.z.mul(5200)))).mul(0.5).add(0.5).mul(sstep(0.0005, 0.0002, fwidth(P.x) as F))
    const alb = vec3(0.34, 0.035, 0.03).mul(weave.mul(0.18).add(0.86)).mul(fbm(P.xy.mul(80)).mul(0.3).add(0.85))
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.08, shin: 14, sh: 1, wrap: 0.2 }), depthA())
  })()
  const binding = new THREE.Mesh(new THREE.BoxGeometry(PADW + 0.004, BIND1 - BIND0, 1), bindMat)
  binding.rotation.x = -TH
  padGroup.add(binding)
  const stapleMat = new THREE.NodeMaterial()
  stapleMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(shade(vec3(0.5, 0.5, 0.52) as V3, N as V3, P as V3, { spec: 1.2, shin: 90 }), depthA())
  })()
  const staples: THREE.Mesh[] = []
  for (const sx of [-0.04, 0.04]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.0014, 0.0008), stapleMat)
    st.rotation.x = -TH
    st.userData.x = sx
    padGroup.add(st)
    staples.push(st)
  }

  // ---- the page on top (flat, on the stack)
  const topMat = new THREE.NodeMaterial()
  topMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const stp = U.topPage.z
    const inkK = select(stp.lessThan(1.5), U.ink.x, select(stp.lessThan(2.5), U.ink.y, select(stp.lessThan(3.5), U.ink.z, U.ink.w)))
    const pg = pagePrint(st as V2, U.topPage.x as F, U.topPage.y as F, stp as F, inkK.mul(step(0.5, stp)) as F, U.topPage.w as F)
    const col = shade(pg.col as V3, N as V3, P as V3, { spec: 0.03, shin: 10, wrap: 0.25, sh: occl(P as V3).mul(0.4).add(0.6) })
    return vec4(mixN(col, magenta, pg.plate.mul(U.dbg)), depthA())
  })()
  const topPage = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), topMat)
  topPage.rotation.x = -TH
  padGroup.add(topPage)

  // ---- the torn sheets: peeling, in flight, on the desk (one instanced draw, 365 sheets)
  const sheetBase = new THREE.PlaneGeometry(1, 1, 10, 16)
  const sheetGeo = new THREE.InstancedBufferGeometry()
  sheetGeo.index = sheetBase.index
  sheetGeo.setAttribute("position", sheetBase.getAttribute("position"))
  sheetGeo.setAttribute("uv", sheetBase.getAttribute("uv"))
  const aPage = new Float32Array(365 * 4)
  const iPos = new Float32Array(365 * 4), iQ = new Float32Array(365 * 4), iBend = new Float32Array(365 * 4)
  const LAND: { x: number; z: number; yaw: number; side: number }[] = []
  {
    const R = rng(2701)
    for (let i = 0; i < 365; i++) {
      const [m, d] = DAYS[i]
      aPage.set([m, d, STAMP_OF[i] ?? 0, R()], i * 4)
      // where it lands: left of the pad, clear of the lamp's foot and of the lens-to-pad line
      let x = 0, z = 0
      for (let k = 0; k < 20; k++) {
        x = -0.2 - R() * 0.42
        z = -0.3 + R() * 0.42
        if (x > -1) break
      }
      LAND.push({ x, z, yaw: (R() - 0.5) * 2.4, side: R() < 0.5 ? -1 : 1 })
    }
  }
  sheetGeo.setAttribute("aPage", new THREE.InstancedBufferAttribute(aPage, 4))
  const attrPos = new THREE.InstancedBufferAttribute(iPos, 4)
  const attrQ = new THREE.InstancedBufferAttribute(iQ, 4)
  const attrB = new THREE.InstancedBufferAttribute(iBend, 4)
  for (const a of [attrPos, attrQ, attrB]) a.setUsage(THREE.DynamicDrawUsage)
  sheetGeo.setAttribute("iPos", attrPos)
  sheetGeo.setAttribute("iQ", attrQ)
  sheetGeo.setAttribute("iBend", attrB)
  sheetGeo.instanceCount = 365
  sheetGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
  const sheetMat = new THREE.NodeMaterial()
  sheetMat.side = THREE.DoubleSide
  const sheetShMat = new THREE.NodeMaterial()
  const uPileTop = uniform(0.0006)
  {
    const ip = attribute("iPos", "vec4"), iq = attribute("iQ", "vec4"), ib = attribute("iBend", "vec4"), ap = attribute("aPage", "vec4")
    // sheet coords: x across, y from the hinge (0) down to -PH, z out of the printed face
    const bendAt = (x: F, y: F): V3 => {
      const yf = ib.x.add(x.mul(ib.z)) // the fold line, tilted so one corner leads
      const s = max(yf.sub(y), 0)
      const r = float(0.012)
      const al = ib.y
      const th = min(s.div(r), al)
      const arcL = r.mul(al)
      const onArc = s.lessThan(arcL)
      const ya = select(onArc, yf.sub(r.mul(sin(th))), yf.sub(r.mul(sin(al))).sub(s.sub(arcL).mul(cos(al))))
      const za = select(onArc, r.mul(float(1).sub(cos(th))), r.mul(float(1).sub(cos(al))).add(s.sub(arcL).mul(sin(al))))
      const yy = select(y.lessThan(yf), ya, y)
      const zz = select(y.lessThan(yf), za, float(0))
      // flutter in flight, and the bow of a sheet lying on the desk (ends up)
      const fl2 = sin(y.mul(34).add(x.mul(14)).add(ip.w.mul(17))).mul(ib.w).mul(0.006)
      const bow = y.add(PH / 2).div(PH / 2).pow(2).add(x.div(PW / 2).pow(2).mul(0.4)).mul(select(ip.w.greaterThan(1.5), float(0.0022), float(0)))
      return vec3(x, yy, zz.add(fl2).add(bow)) as V3
    }
    const g = positionGeometry
    const x0 = g.x.mul(PW), y0 = g.y.sub(0.5).mul(PH)
    const pl = bendAt(x0 as F, y0 as F)
    const e = 0.002
    const px = bendAt(x0.add(e) as F, y0 as F), py = bendAt(x0 as F, y0.add(e) as F)
    const nl = normalize(cross(px.sub(pl), py.sub(pl)))
    const visible = step(0.5, ip.w)
    sheetMat.positionNode = qrot(iq, pl).add(ip.xyz).mul(visible).add(vec3(0, visible.oneMinus().mul(-50), 0))
    const vN = qrot(iq, nl as V3).toVarying("csN")
    const vUV = uvAttr().toVarying("csUV")
    const vPg = ap.toVarying("csPg")
    sheetMat.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const Nf = normalize(vN).toVar()
      const front = frontFacing
      const N = select(front, Nf, Nf.negate())
      const stp = vPg.z
      const inkK = select(stp.lessThan(1.5), U.ink.x, select(stp.lessThan(2.5), U.ink.y, select(stp.lessThan(3.5), U.ink.z, U.ink.w)))
      const pg = pagePrint(vUV as V2, vPg.x as F, vPg.y as F, stp as F, inkK.mul(step(0.5, stp)) as F, vPg.w as F)
      // the back: blank newsprint, the next day's numeral faint and mirrored through it
      const ghost = vec3(1).sub(PAPER.sub(pg.col).mul(0.12))
      const backCol = PAPER.mul(vnoise(vUV.mul(vec2(180, 220))).mul(0.06).add(0.92)).mul(ghost)
      const alb = select(front, pg.col, backCol)
      const low = sstep(0.05, 0.0, P.y as F) // near the desk: the pad's and clock's shadows reach it
      const sh = mixN(float(1), occl(P as V3), low)
      const col = shade(alb as V3, N as V3, P as V3, { spec: 0.03, shin: 10, wrap: 0.3, trans: 0.35, sh })
      return vec4(mixN(col, magenta, pg.plate.mul(U.dbg).mul(0)), depthA())
    })()
    // Their shadows. Each sheet is flattened along the lamp's rays onto a plane just under it (a
    // sheet on the pile: under itself, so it darkens the sheets below it and the desk; a sheet in the
    // air: just over the top of the pile, so it darkens all of it), and drawn as a dimming overlay:
    // soft at the edges by how high the paper stands, fainter the higher it flies.
    const W = qrot(iq, pl).add(ip.xyz)
    const landed = ip.w.greaterThan(1.5)
    const yP = select(landed, ip.y.sub(0.000018), uPileTop)
    const dL = W.sub(U.lamp)
    const k = yP.sub(U.lamp.y).div(min(dL.y, -1e-4))
    const S = U.lamp.add(dL.mul(k))
    const hgt = max(W.y.sub(yP), 0)
    sheetShMat.positionNode = vec3(S.x, yP, S.z).mul(visible).add(vec3(0, visible.oneMinus().mul(-50), 0))
    const vH = hgt.toVarying("csH")
    const vSU = uvAttr().toVarying("csSU")
    const vS = S.toVarying("csS")
    sheetShMat.fragmentNode = Fn(() => {
      const e = min(min(vSU.x, vSU.x.oneMinus()).mul(PW), min(vSU.y, vSU.y.oneMinus()).mul(PH))
      const soft = sstep(0.0, vH.mul(0.28).add(0.0025), e as F)
      const lit = sat1(length(lampAt(vS as V3)).mul(0.9) as F) // only where the lamp reaches is there a shadow to see
      return vec4(0, 0, 0, soft.mul(exp(vH.mul(-4.5))).mul(0.62).mul(lit))
    })()
  }
  const sheets = new THREE.Mesh(sheetGeo, sheetMat)
  sheets.frustumCulled = false
  scene.add(sheets)
  Object.assign(sheetShMat, {
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending,
    // darken the colour by the overlay's alpha; leave the target's alpha (the depth the focus pass reads) alone
    blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  })
  const sheetShadows = new THREE.Mesh(sheetGeo, sheetShMat)
  sheetShadows.frustumCulled = false
  sheetShadows.renderOrder = 5
  scene.add(sheetShadows)

  // ---- the lamp: weighted foot, sprung double arm, steel cone shade, a bulb
  const lampGroup = new THREE.Group()
  scene.add(lampGroup)
  const enamel = new THREE.NodeMaterial()
  enamel.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const chip = step(0.82, vnoise(P.xy.mul(400).add(P.z.mul(331))))
    const alb = mixN(vec3(0.03, 0.032, 0.03), vec3(0.18, 0.17, 0.16), chip.mul(0.5))
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.9, shin: 70, sh: occl(P as V3).mul(0.5).add(0.5) }), depthA())
  })()
  const steel = new THREE.NodeMaterial()
  steel.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    return vec4(shade(vec3(0.45, 0.44, 0.42) as V3, N as V3, P as V3, { spec: 1.6, shin: 120 }), depthA())
  })()
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.03, 48), enamel)
  foot.position.set(0.47, 0.015, -0.2)
  lampGroup.add(foot)
  const pivot = new THREE.Vector3(0.47, 0.05, -0.2)
  const elbow = new THREE.Vector3(0.58, 0.36, -0.12)
  const head = new THREE.Vector3(0.25, 0.43, 0.13)
  const rod = (a: THREE.Vector3, b: THREE.Vector3, off: number, r: number, mat: THREE.Material) => {
    const d = new THREE.Vector3().subVectors(b, a)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 12), mat)
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.position.z += off
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    lampGroup.add(m)
  }
  rod(new THREE.Vector3(0.47, 0.03, -0.2), pivot, 0, 0.012, enamel)
  for (const off of [-0.012, 0.012]) {
    rod(pivot, elbow, off, 0.0045, enamel)
    rod(elbow, head, off, 0.0045, enamel)
  }
  // springs: close-wound helices beside the arms
  const spring = (a: THREE.Vector3, b: THREE.Vector3, off: number) => {
    const d = new THREE.Vector3().subVectors(b, a)
    const L = d.length()
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 600; i++) {
      const u = i / 600
      const ang = u * L * 900
      pts.push(new THREE.Vector3(Math.cos(ang) * 0.0045, u * L, Math.sin(ang) * 0.0045))
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.0008, 5)
    const m = new THREE.Mesh(geo, steel)
    m.position.copy(a)
    m.position.x += off
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    lampGroup.add(m)
  }
  spring(pivot.clone().add(new THREE.Vector3(-0.02, 0.03, 0.02)), elbow.clone().add(new THREE.Vector3(-0.02, -0.06, 0.02)), 0)
  spring(elbow.clone().add(new THREE.Vector3(-0.03, 0.0, 0.02)), head.clone().add(new THREE.Vector3(0.08, -0.02, 0.02)), 0)
  // the shade: a lathe cone with a rolled rim, aimed at the pad
  const prof: THREE.Vector2[] = [[0.012, 0.0], [0.02, 0.0], [0.024, -0.02], [0.045, -0.06], [0.072, -0.11], [0.078, -0.118], [0.076, -0.122], [0.07, -0.112]].map(([r, y]) => new THREE.Vector2(r, y))
  const shadeMat = new THREE.NodeMaterial()
  shadeMat.side = THREE.DoubleSide
  shadeMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const Nn = normalize(normalWorld).toVar()
    const inside = frontFacing.not()
    const N = select(inside, Nn.negate(), Nn)
    const outer = shade(vec3(0.04, 0.045, 0.04) as V3, N as V3, P as V3, { spec: 1.0, shin: 60 })
    // the inside: white enamel, lit by the bulb itself
    const dd = P.sub(U.lamp).length()
    const inner = vec3(1.0, 0.75, 0.5).mul(U.flicker).mul(float(0.05).div(dd.mul(dd).add(0.0012)).mul(0.02))
    return vec4(select(inside, inner, outer), depthA())
  })()
  const lampShade = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), shadeMat)
  lampShade.position.copy(head)
  lampShade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), LAMP_AIM.clone().sub(head).normalize())
  lampGroup.add(lampShade)
  LAMP.copy(head).addScaledVector(LAMP_AIM.clone().sub(head).normalize(), 0.055)
  U.lamp.value.copy(LAMP)
  U.aim.value.copy(LAMP_AIM).sub(LAMP).normalize()
  const bulbMat = new THREE.NodeMaterial()
  bulbMat.fragmentNode = vec4(vec3(9, 6.2, 3.6).mul(U.flicker), depthA())
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), bulbMat)
  bulb.position.copy(LAMP)
  lampGroup.add(bulb)

  // ---- the split-flap clock
  const clock = new THREE.Group()
  clock.position.set(CLK.x, 0, CLK.z)
  clock.rotation.y = CLK.yaw
  scene.add(clock)
  const caseMat = new THREE.NodeMaterial()
  caseMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const n = vnoise(P.xy.mul(600).add(P.z.mul(500))).mul(0.12).add(0.94)
    const alb = vec3(0.022, 0.021, 0.02).mul(n)
    return vec4(shade(alb as V3, N as V3, P as V3, { spec: 0.7, shin: 80 }), depthA())
  })()
  const body = new THREE.Mesh(new THREE.BoxGeometry(CLK.w, CLK.h, CLK.d), caseMat)
  body.position.set(0, CLK.h / 2 + 0.008, 0)
  clock.add(body)
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.008, 16), caseMat)
    f.position.set(sx * (CLK.w / 2 - 0.02), 0.004, 0)
    clock.add(f)
  }
  // the window bezel: a dark recess the flaps sit in
  const recessMat = new THREE.NodeMaterial()
  recessMat.fragmentNode = vec4(vec3(0.004, 0.004, 0.004), depthA())
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(CLK.w - 0.02, CLK.h - 0.024), recessMat)
  recess.position.set(0, CLK.h / 2 + 0.008, CLK.d / 2 + 0.0004)
  clock.add(recess)
  // flap units: 6 digits and 8 letters, three cards each (upper rest, lower rest, the falling flap)
  const DIGW = 0.031, DIGH = 0.06, LETW = 0.021, LETH = 0.031
  const units: { x: number; y: number; w: number; h: number }[] = []
  const zf = CLK.d / 2 + 0.004
  const cy = CLK.h / 2 + 0.008
  const digitX = [-0.104, -0.07, -0.017, 0.017, 0.07, 0.104]
  for (const x of digitX) units.push({ x, y: cy + 0.017, w: DIGW, h: DIGH })
  for (let k = 0; k < 7; k++) units.push({ x: 0.0425 + (k - 3) * (LETW + 0.0025), y: cy - 0.04, w: LETW, h: LETH })
  const NU = units.length
  const flapBase = new THREE.PlaneGeometry(1, 0.5, 1, 4).translate(0, 0.25, 0)
  const flapGeo = new THREE.InstancedBufferGeometry()
  flapGeo.index = flapBase.index
  flapGeo.setAttribute("position", flapBase.getAttribute("position"))
  const fU = new Float32Array(NU * 3 * 4), fK = new Float32Array(NU * 3 * 4), fC = new Float32Array(NU * 3 * 4)
  units.forEach((u, i) => {
    for (let k = 0; k < 3; k++) {
      fU.set([u.x, u.y, u.w, u.h], (i * 3 + k) * 4)
      fK.set([k, i < 6 ? 0 : 1, i, 0], (i * 3 + k) * 4)
    }
  })
  flapGeo.setAttribute("fU", new THREE.InstancedBufferAttribute(fU, 4))
  flapGeo.setAttribute("fK", new THREE.InstancedBufferAttribute(fK, 4))
  const attrC = new THREE.InstancedBufferAttribute(fC, 4)
  attrC.setUsage(THREE.DynamicDrawUsage)
  flapGeo.setAttribute("fC", attrC)
  flapGeo.instanceCount = NU * 3
  flapGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5)
  const flapMat = new THREE.NodeMaterial()
  flapMat.side = THREE.DoubleSide
  {
    const fu = attribute("fU", "vec4"), fk = attribute("fK", "vec4"), fc = attribute("fC", "vec4")
    const g = positionGeometry // x -0.5..0.5, y 0..0.5 (above the hinge)
    const kind = fk.x
    const phi = select(kind.greaterThan(1.5), fc.z, select(kind.greaterThan(0.5), float(Math.PI), float(0)))
    // a card's own sag and the gap at the hinge
    const yy = g.y.mul(fu.w).mul(0.985).add(0.0006)
    const lp = vec3(g.x.mul(fu.z).mul(0.94), yy.mul(cos(phi)), yy.mul(sin(phi)).add(select(kind.greaterThan(1.5), float(0.0012), float(0))))
    flapMat.positionNode = vec3(fu.x, fu.y, zf).add(lp)
    const nl = vec3(0, sin(phi).negate(), cos(phi))
    const vN = modelWorldMatrix.mul(vec4(nl, 0)).xyz.toVarying("cfN")
    const vQ = vec2(g.x.add(0.5), g.y.mul(2)).toVarying("cfQ") // across, and 0 at the hinge to 1 at the card's far edge
    const vC = fc.toVarying("cfC")
    const vK = fk.toVarying("cfK")
    flapMat.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const Nn = normalize(vN).toVar()
      const front = frontFacing
      const k = vK.x
      // which character and which half this face shows
      const showNext = select(k.lessThan(0.5), float(1), select(k.lessThan(1.5), float(0), select(front, float(0), float(1))))
      const ch = select(showNext.greaterThan(0.5), vC.y, vC.x)
      const upper = select(k.lessThan(0.5), float(1), select(k.lessThan(1.5), float(0), select(front, float(1), float(0))))
      const cv = select(upper.greaterThan(0.5), float(0.5).add(vQ.y.mul(0.5)), float(0.5).sub(vQ.y.mul(0.5)))
      const lu = vec2(vQ.x, cv)
      const cx = ch.mod(8), cr = floor(ch.div(8))
      const tu = vec2(cx.mul(128).add(lu.x.mul(128)).div(CA), float(1).sub(cr.mul(176).add(float(1).sub(lu.y).mul(176)).div(CA)))
      const glyph = texture(flapTex, tu).r.toVar()
      // a blurred drum: the cards smear into grey streaks
      const blur = vC.w
      const streak = vnoise(vec2(vQ.x.mul(40), P.y.mul(10))).mul(0.4).add(0.25)
      glyph.assign(mixN(glyph, streak, blur))
      const cardCol = vec3(0.028, 0.028, 0.03)
      const glyphCol = vec3(0.92, 0.9, 0.84)
      const alb = mixN(cardCol, glyphCol, glyph).toVar()
      // rounded corners and the stack of cards showing under the lower half's edge
      const edge = min(min(vQ.x, float(1).sub(vQ.x)), float(1).sub(vQ.y))
      alb.mulAssign(sstep(0.0, 0.03, edge as F).mul(0.6).add(0.4))
      const stackLines = select(k.greaterThan(0.5).and(k.lessThan(1.5)), sstep(0.85, 1.0, vQ.y as F).mul(sin(vQ.y.mul(220)).mul(0.5).add(0.5)), float(0))
      alb.addAssign(vec3(0.06).mul(stackLines))
      // the falling flap shades the lower card as it comes over
      const fallSh = select(k.greaterThan(0.5).and(k.lessThan(1.5)), sstep(Math.PI * 0.5, Math.PI, vC.z as F).mul(sstep(Math.PI, Math.PI * 0.8, vC.z as F)).mul(0.6), float(0))
      const N = select(front, Nn, Nn.negate())
      const col = shade(alb as V3, N as V3, P as V3, { spec: 0.35, shin: 40, sh: float(1).sub(fallSh) }).add(glyphCol.mul(glyph).mul(0.05))
      const plate = step(0.02, vQ.x).mul(step(vQ.x, 0.98))
      return vec4(mixN(col, magenta, plate.mul(U.dbg).mul(vK.w)), depthA())
    })()
  }
  const flaps = new THREE.Mesh(flapGeo, flapMat)
  flaps.frustumCulled = false
  clock.add(flaps)
  // colons between the pairs
  const dotMat = new THREE.NodeMaterial()
  dotMat.fragmentNode = Fn(() => vec4(shade(vec3(0.7, 0.68, 0.62) as V3, normalize(normalWorld) as V3, positionWorld as V3, { spec: 0.3, shin: 30 }), depthA()))()
  for (const x of [-0.0435, 0.0435]) {
    for (const dy of [-0.011, 0.011]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 16), dotMat)
      d.position.set(x, cy + 0.017 + dy, zf)
      clock.add(d)
    }
  }
  // the glass front: only its reflection of the lamp and the room
  const glassMat = new THREE.NodeMaterial()
  Object.assign(glassMat, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
  glassMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld)
    const V = normalize(cameraPosition.sub(P))
    const R = V.negate().sub(N.mul(dot(V.negate(), N).mul(2)))
    const toL = normalize(U.lamp.sub(P))
    const glint = pow(max(dot(R, toL), 0), 600).mul(6).add(pow(max(dot(R, toL), 0), 20).mul(0.05))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5).mul(0.9).add(0.04)
    const smudge = fbm(P.xy.mul(60)).mul(0.5).add(0.5)
    const env = vec3(0.03, 0.025, 0.02).mul(fres).mul(smudge)
    return vec4(vec3(1.0, 0.8, 0.55).mul(glint).mul(fres.mul(4).min(1)).add(env), 0)
  })()
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(CLK.w - 0.018, CLK.h - 0.022), glassMat)
  glass.position.set(0, cy, CLK.d / 2 + 0.009)
  glass.renderOrder = 5
  clock.add(glass)

  // ---------------------------------------------------------------- targets and focus

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(1), asp: uniform(16 / 9), shade: uniform(1) }
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.001)).mul(step(0, d)) as F)
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0006), () => {
      Loop(24, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(24))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.4).add(step(c0.a, t.a)) as F).mul(step(0, t.a))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    const col = acc.rgb.div(acc.a).toVar()
    // a soft shade behind the headline
    col.mulAssign(float(1).sub(D.shade.mul(sstep(0.62, 0.0, length(uv.sub(vec2(0.18, 0.82)).mul(vec2(1.0, 1.8))) as F)).mul(0.5)))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- camera keys

  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3()
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), up = new THREE.Vector3()
  const pageCtr = new THREE.Vector3()
  const ENTRY_D = 0.335
  const WIDE = { p: new THREE.Vector3(0.02, 0.5, 1.12), t: new THREE.Vector3(0.03, 0.13, -0.05) }
  const PUSH = { p: new THREE.Vector3(0.07, 0.2, 0.47), t: new THREE.Vector3(-0.06, 0.125, -0.01) }
  const RACK = { p: new THREE.Vector3(0.07, 0.21, 0.62), t: new THREE.Vector3(0.19, 0.115, 0.0) }
  const YAX = new THREE.Vector3(0, 1, 0), CLKO = new THREE.Vector3(CLK.x, 0, CLK.z)
  const clockPt = (lx: number, ly: number, lz: number, o: THREE.Vector3) => o.set(lx, ly, lz).applyAxisAngle(YAX, CLK.yaw).add(CLKO)
  const MACRO = { p: new THREE.Vector3(), t: new THREE.Vector3() }
  {
    // square on to the clock face, close on MM:SS and the letter row's right half
    const nrm = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), CLK.yaw)
    clockPt(-0.006, cy + 0.014, zf, MACRO.t)
    MACRO.p.copy(MACRO.t).addScaledVector(nrm, 0.29).add(new THREE.Vector3(0, 0.012, 0))
  }
  const st = { P: 0, S: 0, rate: 0, dist: 1 }
  const POST: PostOpts = { tone: "agx", exposure: 1.05, bloom: 0.35, bloomThresh: 1.3, bloomRadius: 0.8, vignette: 0.3, grain: 0.026, contrast: 1.08, sat: 0.95, lift: [0.006, 0.006, 0.01], gain: [1.04, 1.0, 0.94], halation: 0.2, ca: 0.0006 }
  const TITLES: TitleOpts = { color: "#f4ecdf", shadow: "rgba(6,5,4,0.8)", delay: [3.2, 0.3, 0.3, 0.3] }
  const HUD = { color: "#efe6d6", shadow: "rgba(0,0,0,0.6)" }

  // ---------------------------------------------------------------- pageAt and the clock drums

  const qF = new THREE.Quaternion()
  const qTmp = new THREE.Quaternion(), q0 = new THREE.Quaternion(), qL = new THREE.Quaternion(), qT = new THREE.Quaternion()
  const mTmp = new THREE.Matrix4()
  q0.setFromRotationMatrix(mTmp.makeBasis(EX, EY, EZ))
  const hinge = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3()
  const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(0, 1, 0)

  /** Seconds since page i came free, or -1 if it has not. */
  const sinceTear = (i: number, s: State) => {
    const T = TEAR[i]
    if (T.b === 99) return s.beat >= 1 ? 99 : -1
    if (s.beat < T.b) return -1
    if (s.beat === T.b) return s.t >= T.t ? s.t - T.t : -1
    // torn in an earlier beat: carry the clock across the boundary so nothing pops on auto-play
    let acc = BEAT_LEN[T.b] - T.t
    for (let b = T.b + 1; b < s.beat; b++) acc += BEAT_LEN[b]
    return acc + Math.max(0, s.t)
  }

  function placeSheets(s: State, P: number, nLeft: number) {
    const top = Math.floor(P)
    const peel = P - top
    let pile = -1
    for (let i = 0; i < 365; i++) {
      const o = i * 4
      const a = sinceTear(i, s)
      if (i === top && peel > 1e-4 && a < 0) {
        // peeling: the sheet's lower part lifts off toward the lens, one corner leading
        padAt(0, BIND0, nLeft * PT + 0.0002, hinge)
        iPos.set([hinge.x, hinge.y, hinge.z, 1], o)
        iQ.set([q0.x, q0.y, q0.z, q0.w], o)
        const b = E.io2(peel)
        iBend.set([-PH + b * PH * 0.88, b * 2.0, 0.25 * b * (LAND[i].side), 0], o)
        continue
      }
      if (a < 0) {
        iPos.set([0, 0, 0, 0], o)
        continue
      }
      const L = LAND[i]
      const u = clamp(a / FLIGHT)
      padAt(0, BIND0, (364 - i) * PT + 0.0002, hinge) // where its hinge was when it came free
      // the path: up and back over the binding (so the race never stands between the lens and the
      // pad's face for long), then away to the left and a drifting fall onto its spot
      pA.copy(hinge)
      pB.copy(hinge).add(v1.set(-0.06 - 0.04 * L.side, 0.3, -0.2))
      pC.set(L.x + 0.05 * L.side, 0.2, L.z - 0.04)
      pD.set(L.x, 0.0006 + i * 0.000035, L.z)
      const e = E.io2(u)
      const ie = 1 - e
      v1.copy(pA).multiplyScalar(ie * ie * ie).addScaledVector(pB, 3 * ie * ie * e).addScaledVector(pC, 3 * ie * e * e).addScaledVector(pD, e * e * e)
      // falling-leaf sway, damped to nothing on landing
      const sw = Math.sin(a * 7.5 + L.yaw * 3) * 0.035 * Math.sin(Math.PI * u)
      v1.x += sw * Math.cos(L.yaw)
      v1.z += sw * Math.sin(L.yaw)
      // the hinge point is the top edge: offset so the sheet's centre lands on the spot
      const cY = Math.cos(L.yaw), sY = Math.sin(L.yaw)
      bx.set(cY, 0, sY)
      by.set(sY, 0, -cY)
      qL.setFromRotationMatrix(mTmp.makeBasis(bx, by, bz))
      const land = u >= 1
      v2.copy(by).multiplyScalar(PH / 2 * e) // centre the sheet on its spot as it settles
      v1.add(v2)
      // first the sheet flips up over its own hinge, toward the lens and on over the binding, so it
      // stands clear of the pad's face within a fifth of a second; then it turns into its fall
      const flip = Math.PI * 0.88 * E.out2(clamp(a / 0.2))
      qF.setFromAxisAngle(EX, -flip).multiply(q0)
      qTmp.copy(qF).slerp(qL, E.io3(clamp((u - 0.12) / 0.88)))
      // tumble: rock about the sheet's long axis while it falls
      const rock = 1.1 * Math.sin(Math.PI * u) * Math.sin(a * 6.1 + L.yaw * 5)
      qT.setFromAxisAngle(v3.set(0, 1, 0), rock)
      qTmp.multiply(qT)
      iPos.set([v1.x, v1.y, v1.z, land ? 2 : 1], o)
      if (land) pile = Math.max(pile, i)
      iQ.set([qTmp.x, qTmp.y, qTmp.z, qTmp.w], o)
      // the curl relaxes in flight; the flutter rides it
      const relax = Math.exp(-a * 9)
      iBend.set([-PH + PH * 0.88 * relax, 2.0 * relax, 0.25 * L.side * relax, land ? 0 : Math.sin(Math.PI * u) * 1.0], o)
    }
    uPileTop.value = 0.0006 + Math.max(0, pile) * 0.000035 + 0.0024 // over the pile and its bowed ends
    attrPos.needsUpdate = true
    attrQ.needsUpdate = true
    attrB.needsUpdate = true
  }

  /** A digit drum: the char the falling flap carries (or the char shown), the char arriving, the flap's angle, its blur. */
  const PLACE = [3600, 3600, 600, 60, 10, 1]
  const pm = (n: number, m: number) => ((n % m) + m) % m
  const drum = (k: number, S: number, rate: number, since: number, out: number[]) => {
    const Sw = S >= 86400 ? 0 : S
    const place = PLACE[k]
    const N = Math.floor(Sw / place + 1e-9)
    const dig = (n: number) => (k === 0 ? Math.floor(pm(n, 24) / 10) : k === 1 ? pm(n, 24) % 10 : k === 2 || k === 4 ? pm(n, 6) : pm(n, 10))
    const c = dig(N), prev = dig(N - 1)
    // real seconds since this drum last changed: from the story rate, or given (after midnight)
    const ago = since >= 0 ? since : rate > 1e-6 ? (Sw - N * place) / rate : 1e9
    const fall = clamp(ago / 0.09)
    const falling = fall < 1 && prev !== c
    out[0] = falling ? prev : c
    out[1] = c
    out[2] = falling ? Math.PI * E.in2(fall) : 0
    out[3] = clamp((rate / place - 2.5) / 5)
  }
  const dTmp = [0, 0, 0, 0]
  const letterState = (k: number, s: State, out: number[]) => {
    // the last word change at or before now, and the word before it
    let prev = "       ", cur = "       ", tc = -1e9
    for (const w of WORDS) {
      const since = s.beat > w.b ? 1e6 : s.beat === w.b ? s.t - w.t : -1
      if (since >= 0) {
        prev = cur
        cur = w.w.padEnd(7)
        tc = -since
      }
    }
    const a = CYCLE.indexOf(prev[k]), b = CYCLE.indexOf(cur[k])
    const steps = (b - a + 27) % 27
    const v = Math.min(steps, Math.max(0, (-tc - k * 0.03) * 32))
    const n = Math.floor(v)
    const moving = v < steps
    out[0] = CHARS.indexOf(CYCLE[moving ? (a + n) % 27 : b])
    out[1] = CHARS.indexOf(CYCLE[moving ? (a + n + 1) % 27 : b])
    out[2] = moving ? Math.PI * (v - n) : 0
    out[3] = 0
  }

  function setFlaps(s: State, S: number, rate: number) {
    const since = s.beat === 3 && s.t >= T_MID ? s.t - T_MID : -1
    const shown = s.beat >= 2 ? 1 : 0
    for (let i = 0; i < NU; i++) {
      if (i < 6) {
        drum(i, S, rate, since, dTmp)
        for (let k = 0; k < 3; k++) fC.set([dTmp[0], dTmp[1], dTmp[2], dTmp[3]], (i * 3 + k) * 4)
      } else {
        letterState(i - 6, s, dTmp)
        for (let k = 0; k < 3; k++) fC.set([dTmp[0], dTmp[1], dTmp[2], 0], (i * 3 + k) * 4)
      }
      // label plates: the digits from beat 2, the letters while a word is up
      const lab = i < 6 ? (shown && (s.beat === 2 ? i < 4 : i >= 2) ? 1 : 0) : s.beat >= 2 && dTmp[0] !== 10 ? 1 : 0
      for (let k = 0; k < 3; k++) fK[(i * 3 + k) * 4 + 3] = lab
    }
    attrC.needsUpdate = true
    ;(flapGeo.getAttribute("fK") as THREE.InstancedBufferAttribute).needsUpdate = true
  }

  // ---------------------------------------------------------------- the corner clock follows the pad

  const TITLE_M = MONTHS.map((m) => m[0] + m.slice(1).toLowerCase())
  const dayName = (i: number) => `${TITLE_M[DAYS[i][0]]} ${DAYS[i][1]}`
  const hms = (S: number) => {
    const x = Math.min(86399, Math.max(0, Math.floor(S + 1e-6)))
    const two = (n: number) => String(n).padStart(2, "0")
    return `${two(Math.floor(x / 3600))}:${two(Math.floor(x / 60) % 60)}:${two(x % 60)}`
  }
  const CK = { text: "", prev: undefined as string | undefined, since: 9 }
  /**
   * The corner clock reads the pad while the race runs (the top sheet's own date, as calendar print),
   * and the script's string for the beat whenever the scene settles: January 1, 00:00:00 before the
   * first tear; September 1 to December 30 once the last stop of beat 1 has landed; then the time of
   * the last day off the drums. A pure function of the beat clock.
   */
  function clockText(s: State) {
    const b = Math.min(3, Math.max(0, s.beat))
    const t = s.t
    const page = ctx.def.beats[b].page
    // the page showing on the pad: the one under the sheet that is peeling, if one is
    const at = (tt: number) => {
      const P = pagesAt(b, Math.max(0, tt))
      const top = Math.floor(P + 1e-9)
      return dayName(Math.min(364, top + (P - top > 1e-4 ? 1 : 0)))
    }
    CK.prev = undefined
    CK.since = 9
    if (b === 0) {
      CK.text = t < B0_GO ? page : at(t)
    } else if (b === 1) {
      const settle = T_DINO + 0.9
      CK.text = t < settle ? at(t) : page
      // a stop lands: the date rises in like a beat change
      for (const tt of [T_SUN, T_CAMB, T_DINO]) if (t >= tt && t < tt + 0.9) { CK.prev = at(tt - 0.25); CK.since = t - tt }
      if (t >= settle) { CK.prev = at(T_DINO); CK.since = t - settle }
    } else if (b === 2) {
      // December 30 until the last sheet goes, then the last day on the drums, landing on 23:48
      CK.text = t < T_TEAR1 ? "December 30" : t < T_ROLL0 ? "December 31, 00:00:00" : t < T_ROLL1 ? `December 31, ${hms(secondsAt(2, t)).slice(0, 5)}` : page
      if (t >= T_TEAR1 && t < T_TEAR1 + 0.9) { CK.prev = "December 30"; CK.since = t - T_TEAR1 }
      if (t >= T_ROLL1 && t < T_ROLL1 + 0.9) { CK.prev = `December 31, ${hms(secondsAt(2, T_ROLL1 - 0.01)).slice(0, 5)}`; CK.since = t - T_ROLL1 }
    } else {
      CK.text = `December 31, ${hms(secondsAt(3, t))}`
    }
    if (CK.prev === CK.text) CK.prev = undefined
    return CK
  }

  // ---------------------------------------------------------------- update

  const labelPts: [number, number][][] = []
  const projectRect = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): [[number, number], [number, number], [number, number], [number, number]] => {
    const r: [number, number][] = []
    for (const p of [a, b, c, d]) {
      v3.copy(p).project(cam)
      r.push([v3.x, v3.y])
    }
    return r as [[number, number], [number, number], [number, number], [number, number]]
  }
  void labelPts
  const LBL: LabelInfo[] = []
  const lc = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]

  function update(s: State) {
    const b = Math.min(3, Math.max(0, s.beat))
    const t = s.t
    const P = pagesAt(b, b === 0 ? Math.max(0, t) : t)
    const S = secondsAt(b, b === 0 ? Math.max(0, t) : t)
    const S2 = secondsAt(b, (b === 0 ? Math.max(0, t) : t) + 0.004)
    const rate = Math.abs(S2 - S) / 0.004 // story seconds per real second
    const P2 = pagesAt(b, (b === 0 ? Math.max(0, t) : t) + 0.004)
    st.P = P
    st.S = S
    st.rate = (P2 - P) / 0.004

    // ---- the pad: what is left of it
    const top = Math.floor(P + 1e-9)
    const peeling = P - top > 1e-4
    const below = Math.min(364, top + (peeling ? 1 : 0))
    const nLeft = 365 - top - (peeling ? 1 : 0) // sheets lying flat on the stack, the top one included
    const depth = Math.max(PT, nLeft * PT)
    stack.scale.set(PW, PH, depth)
    padAt(0, PB0 + PH / 2, depth / 2, stack.position)
    stub.scale.set(1, 1, 365 * PT)
    padAt(0, BIND0 + 0.0015, (365 * PT) / 2, stub.position)
    binding.scale.set(1, 1, 365 * PT + 0.003)
    padAt(0, (BIND0 + BIND1) / 2 + 0.002, (365 * PT + 0.003) / 2, binding.position)
    staples.forEach((m) => padAt(m.userData.x as number, (BIND0 + BIND1) / 2 + 0.002, 365 * PT + 0.0036, m.position))
    padAt(0, PB0 + PH / 2, depth + 0.00012, topPage.position)
    // the page lying on top, flat (under the one peeling, if one is)
    const [tm, td] = DAYS[below]
    U.topPage.value.set(tm, td, STAMP_OF[below] ?? 0, aPage[below * 4 + 3])
    U.padBox.value.set(365 * PT + 0.003, 0, 0, 0)
    // the pad takes the tear's yank on entry: a shudder in the top sheet
    const yank = s.enter < 1 || (b === 0 && t < 0.8) ? Math.exp(-Math.max(0, t) * 7) * Math.sin(Math.max(0, t) * 40) * 0.25 : 0
    topPage.rotation.x = -TH + yank * 0.02
    placeSheets(s, P, nLeft)

    // ---- stamps: each slams in when its page stops
    const slam = (bb: number, tt: number) => {
      const x = s.beat > bb ? 1e3 : s.beat === bb ? t - tt : -1
      return x < 0 ? 0 : x > 0.25 ? 1 : 0.6 + 0.4 * E.outBack(x / 0.25)
    }
    U.ink.value.set(slam(1, T_SUN + 0.2), s.beat >= 1 ? 1 : 0, slam(1, T_CAMB + 0.2), slam(1, T_DINO + 0.2))

    // ---- clock
    setFlaps(s, S, rate)
    clockPt(0, CLK.h / 2 + 0.008, 0, v1)
    U.clkC.value.copy(v1)
    U.clkX.value.set(Math.cos(CLK.yaw), 0, -Math.sin(CLK.yaw))
    U.clkZ.value.set(Math.sin(CLK.yaw), 0, Math.cos(CLK.yaw))
    U.flicker.value = 1 + 0.004 * Math.sin(s.time * 100 * Math.PI) // mains ripple on the filament

    // ---- camera
    padAt(0, 0.096, 365 * PT, pageCtr)
    const tb0 = b === 0 ? t : 99
    const pull = E.io3(clamp((tb0 - START - 0.15) / 3.4))
    camTgt.copy(pageCtr)
    camPos.copy(pageCtr).addScaledVector(EZ, ENTRY_D)
    up.copy(EY)
    if (pull > 0) {
      camTgt.lerp(WIDE.t, pull)
      v1.copy(camPos).lerp(WIDE.p, pull)
      v1.y += Math.sin(Math.PI * pull) * 0.06
      camPos.copy(v1)
      up.lerp(v2.set(0, 1, 0), pull).normalize()
    }
    // beat 1: push to the block, settling on each stop
    const push = b >= 1 ? E.io3(clamp(b > 1 ? 1 : t / 2.2)) : 0
    if (push > 0) {
      camPos.lerp(PUSH.p, push)
      camTgt.lerp(PUSH.t, push)
      if (b === 1) {
        // creep in during the holds
        const creep = 0.02 * smooth(T_SUN, T_DINO + 2, t)
        camPos.addScaledVector(v2.subVectors(PUSH.t, PUSH.p).normalize(), creep)
      }
    }
    // beat 2: dolly right and rack to the clock
    const rk = b >= 2 ? E.io3(clamp(b > 2 ? 1 : (t - 1.0) / 2.6)) : 0
    if (rk > 0) {
      camPos.lerp(RACK.p, rk)
      camTgt.lerp(RACK.t, rk)
    }
    // beat 3: macro on the seconds
    const mc = b >= 3 ? E.io3(clamp(t / 1.6)) : 0
    if (mc > 0) {
      camPos.lerp(MACRO.p, mc)
      camTgt.lerp(MACRO.t, mc)
      // the slow creep while the clock does the work
      camPos.lerp(MACRO.t, 0.1 * smooth(T_WRIT, T_MID + 1, t))
    }
    // stamps knock the lens, a hand-held drift on top
    let knock = 0
    for (const tt of [T_SUN + 0.2, T_CAMB + 0.2, T_DINO + 0.2]) if (b === 1 && t > tt) knock += Math.exp(-(t - tt) * 10) * Math.sin((t - tt) * 50)
    const [hx, hy, hz] = shake(s.time, 0.0012 * (1 - mc * 0.6), 0.3)
    camTgt.x += hx + s.mouse.x * 0.004
    camTgt.y += hy + knock * 0.0015 - s.mouse.y * 0.003
    camTgt.z += hz
    camPos.y += knock * 0.001
    cam.position.copy(camPos)
    cam.up.copy(up)
    cam.lookAt(camTgt)
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    st.dist = camPos.distanceTo(camTgt)

    // ---- focus: the page, the block, then the clock
    D.asp.value = cam.aspect
    const fPage = camPos.distanceTo(pageCtr)
    clockPt(0, cy, zf, v1)
    const fClk = camPos.distanceTo(v1)
    const rackF = smooth(1.3, 3.2, b === 2 ? t : b > 2 ? 99 : -1)
    D.focus.value = mix(fPage, fClk, rackF)
    D.blur.value = (b === 0 ? mix(0.004, 0.006, pull) : b === 1 ? 0.012 : b === 2 ? 0.016 : 0.022) * (dbg ? 0 : 1)
    D.shade.value = dbg ? 0 : b === 0 ? smooth(START, START + 2.5, t) : 1

    if (s.live) {
      ctx.synth.bed("hum", 0.1)
      ctx.synth.bed("air", clamp(Math.abs(st.rate) / 60) * 0.5)
    }

    // ---- labels the viewer is meant to read now
    LBL.length = 0
    const pageLabel = (id: string, u0: number, v0: number, u1: number, v1_: number) => {
      const w = depth + 0.00012
      padAt(-PW / 2 + u0 * PW, PB0 + v0 * PH, w, lc[0])
      padAt(-PW / 2 + u1 * PW, PB0 + v0 * PH, w, lc[1])
      padAt(-PW / 2 + u1 * PW, PB0 + v1_ * PH, w, lc[2])
      padAt(-PW / 2 + u0 * PW, PB0 + v1_ * PH, w, lc[3])
      LBL.push({ id, corners: projectRect(lc[3], lc[2], lc[1], lc[0]) })
    }
    const lastGo = below > 0 ? sinceTear(below - 1, s) : 99
    const still = Math.abs(st.rate) < 0.05 && !peeling && (lastGo < 0 || lastGo > 0.3)
    if (b <= 1 && still && (b > 0 || (t > START && P === 0))) {
      if (STAMP_OF[below] !== 2) pageLabel("numeral", 0.3, 0.3, 0.7, 0.76)
      const sid = STAMP_OF[below]
      if (sid && sid !== 2 && U.ink.value.getComponent(sid - 1) > 0.9) pageLabel("stamp", 0.13, 0.085, 0.87, 0.195)
      if (sid === 2 && U.ink.value.y > 0.9) pageLabel("stamp", 0.24, 0.36, 0.76, 0.7)
    }
    const unitLabel = (id: string, i: number) => {
      const u = units[i]
      clockPt(u.x - u.w * 0.45, u.y - u.h * 0.48, zf, lc[0])
      clockPt(u.x + u.w * 0.45, u.y - u.h * 0.48, zf, lc[1])
      clockPt(u.x + u.w * 0.45, u.y + u.h * 0.48, zf, lc[2])
      clockPt(u.x - u.w * 0.45, u.y + u.h * 0.48, zf, lc[3])
      LBL.push({ id, corners: projectRect(lc[3], lc[2], lc[1], lc[0]) })
    }
    if (b === 2 && t > T_ROLL1) for (let i = 0; i < 4; i++) unitLabel("digit" + i, i)
    if (b === 3 && t > 1.6) for (let i = 2; i < 6; i++) unitLabel("digit" + i, i)
    if (b >= 2) for (let i = 6; i < NU; i++) if (fK[(i * 3) * 4 + 3] > 0 && fC[(i * 3) * 4] !== 10 && fC[(i * 3) * 4 + 2] === 0) unitLabel("letter" + (i - 6), i)
  }

  // ---------------------------------------------------------------- sound

  const lp: [number, number, number] = [0, 0, 0]
  const sp = new THREE.Vector3()
  const padPos = () => listenerPos(padAt(0, 0.1, 0.03, sp), cam, st.dist, lp)
  const clkPos = () => listenerPos(clockPt(0.03, cy, zf, sp), cam, st.dist, lp)
  const cues: Cue[] = []
  // page tears: one leaf each while they are slow, riffles once they run together
  for (let b = 0; b < 3; b++) {
    const ts = TEAR.filter((x) => x.b === b).map((x) => x.t).sort((a, c) => a - c)
    let last = -1, bunch = 0, bunchT = 0
    for (const t of ts) {
      if (t - last > 0.11) {
        if (bunch > 0) cues.push({ b, at: bunchT, s: "cards", o: { g: 0.4, dur: Math.min(30, bunch) }, pos: padPos })
        bunch = 0
        cues.push({ b, at: t, s: "page", o: { g: 0.7 }, pos: padPos })
        last = t
      } else {
        if (bunch === 0) bunchT = t
        bunch++
        if (t - bunchT > 0.25) {
          cues.push({ b, at: bunchT, s: "cards", o: { g: 0.45, dur: Math.min(30, bunch) }, pos: padPos })
          bunch = 0
          last = t
        }
      }
    }
    if (bunch > 0) cues.push({ b, at: bunchT, s: "cards", o: { g: 0.4, dur: Math.min(30, bunch) }, pos: padPos })
  }
  // the stamps
  for (const [tt, n] of [[T_SUN + 0.2, 8], [T_CAMB + 0.2, 10], [T_DINO + 0.2, 12]]) {
    cues.push({ b: 1, at: tt, s: "thump", o: { g: 0.8 }, pos: padPos })
    cues.push({ b: 1, at: tt + 0.005, s: "thud", o: { f: H(n), g: 0.45 }, pos: padPos })
  }
  // the entry: the pad settles after the yank
  cues.push({ b: 0, at: 0.02, s: "flap", o: { g: 0.8 }, pos: [0, 0.2, 0.1] })
  // beat 2: the last tear, the long roll of the drums
  cues.push({ b: 2, at: T_TEAR0 + 0.1, s: "page", o: { g: 0.9, dur: 0.6 }, pos: padPos })
  cues.push({ b: 2, at: T_TEAR1 - 0.1, s: "scratch", o: { g: 0.5 }, pos: padPos })
  for (let k = 0; k < 14; k++) {
    const u = k / 14
    cues.push({ b: 2, at: T_ROLL0 + (T_ROLL1 - T_ROLL0) * (1 - Math.pow(1 - u, 1 / 3)) * 0.98, s: "gear", o: { g: 0.35 + 0.2 * (1 - u), dur: Math.max(2, Math.round(10 * (1 - u))), f: H(30) }, pos: clkPos })
  }
  // letter rows riffle in
  for (const w of WORDS) cues.push({ b: w.b, at: w.t, s: "cards", o: { g: 0.5, dur: 14 }, pos: clkPos })
  // beat 3: the roll to farming, the dash to writing, then one clack a second
  for (let k = 0; k < 8; k++) cues.push({ b: 3, at: T_FARM0 + (T_FARM - T_FARM0) * (k / 8) ** 0.6, s: "gear", o: { g: 0.3, dur: 4, f: H(32) }, pos: clkPos })
  cues.push({ b: 3, at: T_FARM, s: "flap", o: { g: 1.0, f: H(40) }, pos: clkPos })
  for (let k = 0; k < 15; k++) cues.push({ b: 3, at: T_WRIT0 + (T_WRIT - T_WRIT0) * (k / 15), s: "flap", o: { g: 0.6, f: H(44) }, pos: clkPos })
  for (let k = 1; k <= 12; k++) {
    cues.push({ b: 3, at: T_WRIT + k, s: "flap", o: { g: k === 12 ? 1.2 : 0.85, f: H(42) }, pos: clkPos })
    cues.push({ b: 3, at: T_WRIT + k, s: "tick", o: { g: 0.35, f: H(84) } })
  }
  cues.push({ b: 3, at: T_MID + 0.02, s: "bell", o: { f: H(16), g: 1.0 }, pos: clkPos })
  cues.push({ b: 3, at: T_MID + 0.02, s: "bell", o: { f: H(24), g: 0.6 }, pos: clkPos })
  cues.push({ b: 3, at: T_MID + 0.05, s: "pad", o: { f: H(8), g: 0.35, dur: 3 } })

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x030303, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      if (dbg) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      // Leaving, this frame becomes the print that flies to the summary slide, and the slot it lands
      // in shows the engine's snapshot taken as the talk left: so the frame holds still as it was
      // (headline, clock, selection box), instead of fading its type and popping back on landing.
      titles(g, s.exit > 0 ? { ...s, exit: 0 } : s, ctx.def, TITLES)
      if (s.exit > 0) {
        // the deck's corner clock and footer, as the engine draws them, at full strength
        const ck = clockText(s)
        const o = { size: 22, font: "mono" as const, weight: 500, color: HUD.color, align: "right" as const, track: 0.02, shadow: { color: HUD.shadow, blur: 12 }, style: "none" as const }
        g.text(ck.text, DW - 64, 76, { ...o, alpha: 0.75 })
        const beat = ctx.def.beats[Math.min(3, Math.max(0, s.beat))]
        const n = String(SCENES.findIndex((d) => d.id === ctx.def.id) + 1).padStart(2, "0")
        g.text(`${n} / ${SCENES.length}   ${ctx.def.title.toUpperCase()}${beat.ill ? "   ·   ILLUSTRATION" : ""}`, 64, DH - 52, { ...o, align: "left", size: 17, track: 0.12, alpha: 0.5 })
      }
      // beat 3: the selection box takes the seconds as midnight arrives
      if (s.beat === 3) {
        const a = smooth(T_MID - 1.2, T_MID - 0.8, s.t)
        if (a > 0) {
          const p0 = clockPt(units[4].x - DIGW * 0.62, units[4].y - DIGH * 0.56, zf, v1).project(cam)
          const p1 = clockPt(units[5].x + DIGW * 0.62, units[5].y + DIGH * 0.56, zf, v2).project(cam)
          const x0 = (Math.min(p0.x, p1.x) * 0.5 + 0.5) * DW, x1 = (Math.max(p0.x, p1.x) * 0.5 + 0.5) * DW
          const y0 = (0.5 - Math.max(p0.y, p1.y) * 0.5) * DH, y1 = (0.5 - Math.min(p0.y, p1.y) * 0.5) * DH
          g.selbox(x0, y0, x1 - x0, y1 - y0, a)
        }
      }
    },
    hud: (s) => ({ ...HUD, hide: s.exit > 0, clock: clockText(s) }),
    labels: () => LBL,
    dispose() {
      atlas.dispose()
      flapTex.dispose()
      sheetBase.dispose()
      flapBase.dispose()
      disposeTree(scene)
    },
  }
}
