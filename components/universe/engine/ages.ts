// The rule of ages: the one running measure of Acts III and IV (scenes 12 to 26). A length of the
// steel rule from `inflation` lies along the foot of every scene, in that scene's own light. This
// file is the part every scene shares, so fifteen scenes stage the same device the same way:
//
//   ruleState(scene, p)        pure layout for one frame: spans, ticks, pips, readout, fold, clicks
//   ruleTiming / ruleArrival   the one clock the picture, the card and the sounds all run on
//   paintRule / ruleFace       the engraved face as a Canvas 2D texture (repaints on a signature)
//   ruleGeometry / placeRule   a bevelled bar with face UVs, held on one screen rect by any camera
//   ruleLabels                 the face's print as `labels(s)` entries for the label review tool
//   steelRuleMaterial          an example TSL material (one light); scenes may replace it
//   ageCard / ruleCues         the title card on the type layer, and the sounds
//
// What the data supports, and what it does not (decisions, all reported to the owner):
//
// 1. Two zones. A window that spans the current age and a past that shrinks to hairlines cannot
//    be one linear map: zooming in on a shorter age makes the earlier, longer ages larger, not
//    smaller (at `tablet` the Stone Age is about five hundred rules long). So the face has two
//    zones. Right of an engraved break mark the WINDOW is a true linear timeline at the current
//    denomination, at every frame. Left of the break is the STACK, captioned "earlier ages": every
//    earlier age as a sliver, oldest first, each half the width of the next. The stack is
//    ORDERING-ONLY (`toScale: false`): its widths state rank, never duration.
// 2. The squeeze is staged, the zoom is true. When an age opens, the last scene's whole window is
//    FOLDED leftward into the stack (a staged move: `state.fold`), and then the new window arrives.
//    Where the denomination drops, it arrives as a true zoom held on its right end: it starts
//    10^clicks wider, so the new age really is a hairline at the end of the old one, and each
//    click is exactly ×10. Where it does not drop, it is a true pan from the old window.
// 3. Overlaps. The ages overlap (Stone/farming, print/scientific revolution, and the last three),
//    so an earlier age that reaches into the window is drawn there to scale on a second, thinner
//    lane instead of being clipped to make the spans tile.
// 4. The classical age has no sourced span. It has no fill and no window of its own: the rule holds
//    the Bronze and Iron Ages' window and engraves the name alone, flagged to that scene's milestone.
// 5. Year resolution. Dates are read from the script's own strings, to the year: some carry a
//    month and some do not, and mixing the two put the 1947 milestone before an age that starts in
//    "December 1947". BC and "years ago" are converted with the script's own reference (the year
//    of the last milestone row, and the offset in "3000 BC, which is 5,025 years ago").
// 6. Three separate events. The WINDOW changes when an age opens (AGE_CARDS). The ×10 CLICKS are
//    the drop in the power of ten of the window age's span: only `tablet` (3), `press` (1) and
//    `footprint` (1) have any. The READOUT changes on every RULE_MILESTONES row that carries a
//    gap; `die` and `question` carry none and hold the last value, though both open an age and
//    move the window; `press` shows the one rise; `horizon` drops the readout and sets `axis`.
//
// No number is drawn that is not in AGE_CARDS or RULE_MILESTONES, except the power of ten one
// long tick is worth. Print obeys the in-world label floor (`LABEL_MIN`): the readout's value at
// 24 px cap height or more on a 720-high frame, captions and names at 13 or more.

import * as THREE from "three/webgpu"
import { attribute, cameraPosition, dot, Fn, max, mix as mixN, normalize, normalWorld, positionWorld, pow, texture, uniform, uv, vec2, vec3, vec4 } from "three/tsl"

import { AGE_CARDS, RULE_MILESTONES, type SceneDef } from "../script"
import { clamp, E, mix, ramp, rng, smooth } from "./ease"
import { canvasTex, LABEL_MIN, labelFloor } from "./stage"
import { H, type Pos } from "./synth"
import { DH, DW, type FontKey, type Type2D } from "./text"
import { TYPE, wrap } from "./titles"
import { vnoise } from "./tsl"
import type { Cue, LabelInfo, State } from "./types"
import { SELECT } from "./ui"

// ---------------------------------------------------------------- where it sits, and how long things take

/**
 * The rule's face on the 1920×1080 stage: the same in every scene. A ninth of the frame's
 * height, nearly its whole width; its foot stops just above the scene label at the bottom left
 * (TYPE_ZONES), which stays readable under it.
 */
export const RULE_RECT = { x: 64, y: 884, w: 1792, h: 120 } as const
/** Face texture size: the rect's aspect, about 1.4 texels per pixel at 1920 wide. */
export const RULE_TEX = { w: 2560, h: 171 } as const

/** Layout constants, in rule units (0..1 along the face). Not data: they place things, they state nothing. */
const ZONE = 0.12 // width of the stack zone once there is a past
const STACK = 0.84 // fraction of the zone the slivers may fill; the break mark sits at 0.93
const HAIR = 0.0015 // a sliver thinner than this is a hairline (1.8 px at 1280 wide)
const GAP = 0.0025 // between slivers
const PAD = 0.03 // the window is the age's span plus this much of it at each end
const MIN_TICK = 0.0045 // ticks closer together than this are not drawn

/** Face rows, in 120ths of the face height (top = 0), and the cap heights of its print. */
const ROW = { scribe: 4, base: 50, lane: 60, laneH: 32, thin: 95, thinH: 4.5, pip: 99.5, pipH: 7.5, tick: 108, H: 120 }
const CAP = { value: 38, caption: 21 } // 25 px and 14 px on a 720-high frame at RULE_RECT

/** Fractions of the arrival when an age opens: the fold, the zoom and its clicks, the pip, the readout, the card's box. */
export const ARRIVE = { fold0: 0.04, fold1: 0.34, zoom0: 0.3, zoom1: 0.62, pip0: 0.6, pip1: 0.7, roll0: 0.62, roll1: 0.92, box0: 0.6, box1: 0.8, out: 0.84 } as const
/** The same, for a scene that opens no age: only the pip and the readout move. */
const STEP = { pip0: 0.1, pip1: 0.32, roll0: 0.15, roll1: 0.8 } as const
const CLICK_R = 0.915 // every click takes this fraction of the one before (inflation's ratio)
const CARD_DUR = 1.9 // the first card, in seconds: under two
const CARD_R = 0.92 // each card is this fraction of the one before
const STEP_DUR = 1.1
const STEP_R = 0.94

// ---------------------------------------------------------------- reading the script's own strings

const num = (s: string) => Number(s.replace(/,/g, ""))
const LAST = RULE_MILESTONES[RULE_MILESTONES.length - 1]
/** The reference year: the year of the last milestone row. */
const REF = num(/\b(\d{4})\b/.exec(LAST?.date ?? "")?.[1] ?? "0")
/** Years to add to a BC year to get years ago, from the script's own worked example. */
const BC_OFF = (() => {
  for (const c of AGE_CARDS) {
    const m = /([\d,]+) BC, which is ([\d,]+) years ago/.exec(c.how)
    if (m) return num(m[2]) - num(m[1])
  }
  return REF - 1 // no year zero: the rule the script states in its comment
})()

/**
 * A date string to a position on the one linear axis: minus the years before the reference year
 * (so later is larger and the reference year is 0). The earliest date in the string wins; `null`
 * when it holds none. Year resolution only (see the header, 5).
 */
export function parseWhen(s: string): number | null {
  let at = Infinity
  let v: number | null = null
  const take = (re: RegExp, f: (n: number) => number) => {
    const m = re.exec(s)
    if (m && m.index < at) {
      at = m.index
      v = f(num(m[1]))
    }
  }
  take(/([\d,]+) years ago/, (n) => -n)
  take(/([\d,]+) BC/, (n) => -(n + BC_OFF))
  take(/AD (\d+)/, (n) => -(REF - n))
  take(/\b(\d{4})\b(?! BC)/, (n) => -(REF - n))
  return v
}

type Age = { name: string; span: string; opens: string; t0: number; t1: number; has: boolean; exp: number }
type Plan = {
  scene: string
  i: number
  age: number
  opens: boolean
  /** An age opens after another: the old window folds into the stack and the new one arrives. */
  turns: boolean
  /** Window before and after the arrival, tick zero, unit exponent before and after. */
  a0: number
  b0: number
  a1: number
  b1: number
  anchor: number
  k0: number
  k1: number
  clicks: number
  z0: number
  z1: number
  n0: number
  n1: number
  /** This scene's milestone, and the one its gap is measured from. */
  t: number
  from: number
  counted: boolean
  prev: string
  cur: string
  changes: boolean
  rose: boolean
  axis: boolean
  dur: number
}

const AGES: Age[] = AGE_CARDS.map((c) => {
  // "A to B: arithmetic". Anything after the first colon is commentary and may hold other numbers.
  const parts = c.how.split(":")[0].split(" to ")
  const t0 = c.span && parts.length > 1 ? parseWhen(parts[0]) : null
  const t1 = c.span && parts.length > 1 ? parseWhen(parts[1]) : null
  const has = t0 !== null && t1 !== null && t1 > t0
  return { name: c.age, span: c.span, opens: c.opens, t0: has ? t0 : 0, t1: has ? t1 : 0, has, exp: has ? Math.floor(Math.log10(t1 - t0) + 1e-9) : 0 }
})

/** Stack layouts: STACKS[n] holds x0, x1 for each of n slivers, oldest first, in units of the zone. */
const STACKS: number[][] = Array.from({ length: AGES.length + 1 }, (_, n) => {
  const out: number[] = []
  if (!n) return out
  const avail = ZONE * STACK - (n - 1) * GAP
  const w: number[] = []
  let sum = 0
  for (let i = 0; i < n; i++) {
    w[i] = Math.max(HAIR, (avail * 2 ** i) / (2 ** n - 1))
    sum += w[i]
  }
  w[n - 1] -= sum - avail // the floor on the hairlines is paid for by the widest
  let x = 0
  for (let i = 0; i < n; i++) {
    out.push(x / ZONE, (x + w[i]) / ZONE)
    x += w[i] + GAP
  }
  return out
})
const rawSliver = (n: number, i: number) => ((ZONE * STACK - (n - 1) * GAP) * 2 ** i) / (2 ** n - 1)

const PLANS: Plan[] = (() => {
  const out: Plan[] = []
  let age = -1
  let win = -1 // the age whose span the window shows (the last one that has a span)
  let lastGap = ""
  let lastGapN = 0
  let lastCounted = 0
  RULE_MILESTONES.forEach((row, i) => {
    const prev = out[i - 1]
    const card = AGES.findIndex((a) => a.opens === row.scene)
    const opens = card >= 0
    if (opens) age = card
    if (opens && AGES[card].has) win = card
    const W = AGES[Math.max(0, win)]
    const pad = (W.t1 - W.t0) * PAD
    const t = parseWhen(row.date) ?? 0
    const changes = row.gap !== ""
    const gapN = changes ? num(/[\d,]+/.exec(row.gap)?.[0] ?? "0") : 0
    const axis = i === RULE_MILESTONES.length - 1
    const a1 = W.t0 - pad
    const b1 = W.t1 + pad
    const z1 = age > 0 ? ZONE : 0
    const ageIdx = Math.max(0, age)
    out.push({
      scene: row.scene,
      i,
      age: ageIdx,
      opens,
      turns: opens && !!prev,
      a0: prev ? prev.a1 : a1,
      b0: prev ? prev.b1 : b1,
      a1,
      b1,
      anchor: W.t0,
      k0: prev ? prev.k1 : W.exp,
      k1: W.exp,
      clicks: prev ? Math.max(0, prev.k1 - W.exp) : 0,
      z0: prev ? prev.z1 : z1,
      z1,
      n0: prev ? prev.n1 : ageIdx,
      n1: ageIdx,
      t,
      from: lastCounted,
      counted: changes || i === 0,
      prev: lastGap,
      cur: changes ? row.gap : axis ? "" : lastGap,
      changes: changes || (axis && lastGap !== ""),
      rose: changes && lastGapN > 0 && gapN > lastGapN,
      axis,
      dur: opens ? CARD_DUR * CARD_R ** ageIdx : STEP_DUR * STEP_R ** i,
    })
    if (changes) {
      lastGap = row.gap
      lastGapN = gapN
    }
    if (changes || i === 0) lastCounted = t
  })
  return out
})()
const PLAN_OF = new Map(PLANS.map((p) => [p.scene, p]))

/** The scenes that carry the rule, in order. */
export const RULE_SCENES: readonly string[] = PLANS.map((p) => p.scene)

// ---------------------------------------------------------------- the clock

export type RuleTiming = {
  /** Position in the procession, 0..14; -1 for a scene that does not carry the rule. */
  index: number
  /** Seconds the arrival takes (the card's length when the scene opens an age). All times here are from the arrival's `start`. */
  dur: number
  opensAge: boolean
  /** Seconds over which the last window folds into the stack, or null when no age opens after another. */
  fold: [number, number] | null
  /** Seconds at which each ×10 click starts. Empty for most scenes. */
  clicks: number[]
  /** Seconds at which the readout starts to change, or null when it holds. */
  readoutAt: number | null
  /** Seconds at which the card's selection box starts to draw, or null without a card or a span. */
  boxAt: number | null
  /** Seconds at which the card has cleared and the scene's own headline may start. */
  clear: number
}

/** When click `j` of `n` starts, as a fraction of the arrival: inflation's geometric schedule. */
const clickP = (n: number, j: number) => ARRIVE.zoom0 + ((ARRIVE.zoom1 - ARRIVE.zoom0) * (1 - CLICK_R ** j)) / (1 - CLICK_R ** n)

const TIMINGS = new Map<string, RuleTiming>(
  PLANS.map((p) => [
    p.scene,
    {
      index: p.i,
      dur: p.dur,
      opensAge: p.opens,
      fold: p.turns ? [p.dur * ARRIVE.fold0, p.dur * ARRIVE.fold1] : null,
      clicks: Array.from({ length: p.clicks }, (_, j) => p.dur * clickP(p.clicks, j)),
      readoutAt: p.changes ? p.dur * (p.opens ? ARRIVE.roll0 : STEP.roll0) : null,
      boxAt: p.opens && AGES[p.age].has ? p.dur * ARRIVE.box0 : null,
      clear: p.opens ? p.dur * 0.94 : 0,
    },
  ]),
)
const NO_TIMING: RuleTiming = { index: -1, dur: 0, opensAge: false, fold: null, clicks: [], readoutAt: null, boxAt: null, clear: 0 }

/** The closed-form schedule of a scene's arrival. Do not mutate the result. */
export const ruleTiming = (sceneId: string): RuleTiming => TIMINGS.get(sceneId) ?? NO_TIMING

/**
 * Arrival progress 0..1 from seconds into beat 0: `ruleArrival(def.id, s.at(0), START)`. Before
 * `start` it is 0 and the rule shows the last scene's settled state, so it is continuous across
 * the cut; after `start + dur` it is 1 for the rest of the scene. Everything the rule does on
 * arrival (the fold into the stack, the zoom and its clicks, the pip, the readout) is a pure
 * function of this one number, so a scene may also drive it from its own story parameter.
 *
 * `start` matters: a scene's beat clock reaches 0 at its transition's `inAt` (half-way by
 * default), not when the transition ends, so with `start` 0 the card and the clicks play under
 * the hand-off. Pass the seconds of your transition that are left then, `dur * (1 - inAt)`, and
 * pass the same value to `ageCard`, `ageCardClear` and `ruleCues`.
 */
export const ruleArrival = (sceneId: string, t0: number, start = 0) => {
  const d = PLAN_OF.get(sceneId)?.dur
  return d ? clamp((t0 - start) / d) : 1
}

// ---------------------------------------------------------------- one frame of the rule, as data

export type RuleSpan = {
  /** Index into AGE_CARDS. */
  age: number
  name: string
  /** Rule units, 0..1 along the face. */
  x0: number
  x1: number
  current: boolean
  /** Too thin to be more than one engraved line: draw it at the minimum line width. */
  hairline: boolean
  /** True in the window (a real linear position); false in the stack and for a nameless age (ordering only). */
  toScale: boolean
  /** No sourced span: in the window, the name alone flagged at x0; in the stack, an outline. */
  unsourced: boolean
  /** 0 = the current age's lane (tall, carries the name), 1 = the thin lane of an earlier age that overlaps. */
  lane: number
  /** 0..1: how far the engraving has arrived. */
  ink: number
  /** The span runs on past the window's end on that side. */
  openL: boolean
  openR: boolean
}
export type RuleTick = { x: number; /** 1 = a whole unit, shorter for its tenths and hundredths. */ len: number; a: number }
export type RulePip = { x: number; scene: string; current: boolean; /** False for a milestone the readout does not count (`die`, `question`, `horizon`). */ counted: boolean; a: number }

export type RuleState = {
  scene: string
  /** False for a scene that does not carry the rule: nothing to draw. */
  known: boolean
  index: number
  p: number
  /** Index into AGE_CARDS of the current age. */
  age: number
  opensAge: boolean
  /** The last scene: the rule swings up and becomes the chart's axis. Staging is the scene's. */
  axis: boolean
  /** Width of the stack zone; the window is [zone, 1]. */
  zone: number
  /** The stack's extent and how far its "earlier ages" caption has arrived. */
  stack: { x0: number; x1: number; a: number }
  /**
   * The squeeze: while `a` > 0 the last scene's window (`from`, its settled state; draw its
   * marks from `from.zone` to 1 without their print) is pressed into [x0, x1] on its way to
   * becoming the newest sliver. `c` is 0..1 through it. Staged, not to scale.
   */
  fold: { c: number; x0: number; x1: number; a: number; from: RuleState | null }
  /** Stack slivers first (oldest first), then window spans (earlier ages, then the current one). */
  spans: RuleSpan[]
  ticks: RuleTick[]
  /** Milestones inside the window, in scene order. */
  pips: RulePip[]
  /** What one long tick is worth. `pop` is 1 at the instant of a click and decays to 0. */
  unit: { exp: number; label: string; pop: number; /** One long division, in rule units. */ w: number }
  redenom: { /** ×10 clicks on arrival into this scene. */ clicks: number; /** How many have started. */ done: number; /** 0..1 through the new window's zoom or pan. */ u: number; active: boolean }
  readout: {
    /** False while there is nothing to read (the first scene). */
    show: boolean
    label: string
    prev: string
    cur: string
    /** 0 = `prev` shown, 1 = `cur` shown. */
    roll: number
    /** The row carries no gap: the last value is held (`die`, `question`). */
    held: boolean
    /** This gap is larger than the last one (`press`). It is real. */
    rose: boolean
  }
  /** The gap the readout states, as a dimension line between two pips (clipped to the window). */
  bracket: { x0: number; x1: number; a: number; openL: boolean }
}

export const READOUT_LABEL = "since the last milestone:"
export const STACK_LABEL = "earlier ages"

const mkSpan = (): RuleSpan => ({ age: 0, name: "", x0: 0, x1: 0, current: false, hairline: false, toScale: true, unsourced: false, lane: 0, ink: 1, openL: false, openR: false })
const mkTick = (): RuleTick => ({ x: 0, len: 0, a: 0 })
const mkPip = (): RulePip => ({ x: 0, scene: "", current: false, counted: true, a: 1 })
type Pools = { spans: RuleSpan[]; ticks: RuleTick[]; pips: RulePip[]; fold: RuleState | null }
const POOLS = new WeakMap<RuleState, Pools>()

/** A state object to hand back to `ruleState` every frame, so nothing is allocated per frame. */
export function makeRuleState(): RuleState {
  const s: RuleState = {
    scene: "",
    known: false,
    index: -1,
    p: 1,
    age: 0,
    opensAge: false,
    axis: false,
    zone: 0,
    stack: { x0: 0, x1: 0, a: 0 },
    fold: { c: 1, x0: 0, x1: 0, a: 0, from: null },
    spans: [],
    ticks: [],
    pips: [],
    unit: { exp: 0, label: "", pop: 0, w: 0 },
    redenom: { clicks: 0, done: 0, u: 1, active: false },
    readout: { show: false, label: READOUT_LABEL, prev: "", cur: "", roll: 1, held: false, rose: false },
    bracket: { x0: 0, x1: 0, a: 0, openL: false },
  }
  POOLS.set(s, { spans: [], ticks: [], pips: [], fold: null })
  return s
}

const UNIT_LABELS = new Map<number, string>()
/** "1,000 years" for 3. Powers of ten only. */
function unitLabel(exp: number) {
  let s = UNIT_LABELS.get(exp)
  if (!s) {
    s = exp >= 0 ? `${(10 ** exp).toLocaleString("en-US")} ${exp === 0 ? "year" : "years"}` : `1/${(10 ** -exp).toLocaleString("en-US")} year`
    UNIT_LABELS.set(exp, s)
  }
  return s
}

function ticksInto(S: RuleState, pool: Pools, anchor: number, a: number, b: number, zone: number, k: number, alpha: number) {
  if (alpha <= 0.01) return
  const W = b - a
  const sc = (1 - zone) / W
  const top = Math.floor(Math.log10(W)) + 1
  for (let e = top; e > top - 5; e--) {
    const step = 10 ** e
    const sx = step * sc
    if (sx < MIN_TICK) break
    const al = alpha * smooth(MIN_TICK, MIN_TICK * 3, sx)
    const d = k - e
    const m1 = Math.floor((b - anchor) / step + 1e-9)
    for (let m = Math.ceil((a - anchor) / step - 1e-9); m <= m1; m++) {
      if (e < top && m % 10 === 0) continue // drawn by the level above
      if (S.ticks.length >= 400) return
      const n = S.ticks.length
      const t = (pool.ticks[n] ??= mkTick())
      t.x = zone + (anchor + m * step - a) * sc
      t.len = d <= 0 ? 1 : d === 1 ? (m % 5 === 0 ? 0.68 : 0.5) : m % 5 === 0 ? 0.36 : 0.26
      t.a = al
      S.ticks.push(t)
    }
  }
}

const SHARED = makeRuleState()

/**
 * Everything the rule shows in scene `sceneId` at arrival progress `p` (0 = the last scene's
 * settled state, 1 = this scene's). A pure function of its arguments. Pass your own `out` (from
 * `makeRuleState()`) and it is refilled in place; without one a shared object is returned, valid
 * until the next call.
 */
export function ruleState(sceneId: string, p: number, out: RuleState = SHARED): RuleState {
  const S = out
  let pool = POOLS.get(S)
  if (!pool) POOLS.set(S, (pool = { spans: [], ticks: [], pips: [], fold: null }))
  const P = PLAN_OF.get(sceneId)
  S.scene = sceneId
  S.spans.length = 0
  S.ticks.length = 0
  S.pips.length = 0
  S.known = !!P
  S.fold.a = 0
  S.fold.from = null
  if (!P) return S
  p = clamp(p)
  S.p = p
  S.index = P.i
  S.age = P.age
  S.opensAge = P.opens
  S.axis = P.axis

  // 1. the fold: the last window is pressed into the stack
  const c = P.turns ? E.io2(ramp(p, ARRIVE.fold0, ARRIVE.fold1)) : 1
  const zone = mix(P.z0, P.z1, c)
  S.zone = zone
  S.fold.c = c
  if (P.turns && c < 1) {
    const slot = STACKS[P.n1]
    const j = P.n1 - 1
    const F = (pool.fold ??= makeRuleState())
    ruleState(PLANS[P.i - 1].scene, 1, F)
    S.fold.from = F
    S.fold.x0 = mix(P.z0, slot[j * 2] * P.z1, c)
    S.fold.x1 = mix(1, slot[j * 2 + 1] * P.z1, c)
    S.fold.a = 1 - ramp(c, 0.82, 1)
  }

  // 2. the new window arrives: `clicks` ratchets of ×10 on inflation's schedule, or one eased pan
  let u = 1
  let done = P.clicks
  let pop = 0
  if (P.turns && p < ARRIVE.zoom1) {
    if (P.clicks > 0) {
      done = 0
      while (done < P.clicks && p >= clickP(P.clicks, done)) done++
      if (!done) u = 0
      else {
        const c0 = clickP(P.clicks, done - 1)
        const f = (p - c0) / (clickP(P.clicks, done) - c0)
        u = (done - 1 + E.out3(Math.min(1, f / 0.6))) / P.clicks
        pop = 1 - clamp(f / 0.5)
      }
    } else u = E.io3(ramp(p, ARRIVE.zoom0, ARRIVE.zoom1))
  }
  const W0 = P.b0 - P.a0
  const W1 = P.b1 - P.a1
  let a = P.a1
  let W = W1
  if (u < 1) {
    if (P.clicks > 0) {
      // a true zoom held on the window's right end: it starts 10^clicks wider, where the new age is a hairline
      W = W1 * 10 ** (P.clicks * (1 - u))
      a = P.b1 - W
    } else {
      // a true pan (and what zoom there is) from the old window: the new centre travels to the middle
      W = W0 * (W1 / W0) ** u
      const c1 = (P.a1 + P.b1) / 2
      a = c1 - mix((c1 - P.a0) / W0, 0.5, u) * W
    }
  }
  const b = a + W
  const sc = (1 - zone) / W
  const X = (t: number) => zone + (t - a) * sc
  // the new window's marks come up as the fold lands
  const winA = P.turns ? smooth(ARRIVE.zoom0 - 0.05, ARRIVE.zoom0 + 0.05, p) : 1
  S.redenom.clicks = P.clicks
  S.redenom.done = done
  S.redenom.u = u
  S.redenom.active = P.turns && p > ARRIVE.zoom0 && p < ARRIVE.zoom1
  const k = P.k1 + (P.clicks - done)
  S.unit.exp = k
  S.unit.label = unitLabel(k)
  S.unit.pop = pop
  S.unit.w = 10 ** k * sc

  // the stack: ordering only. Each earlier age is a sliver; the newest is what the fold becomes.
  const L0 = STACKS[P.n0]
  const L1 = STACKS[P.n1]
  for (let j = 0; j < P.n1; j++) {
    const isNew = j >= P.n0
    if (isNew && c < 0.82) continue // still the folding window
    const sp = (pool.spans[S.spans.length] ??= mkSpan())
    sp.age = j
    sp.name = AGES[j].name
    sp.x0 = (isNew ? L1[j * 2] : mix(L0[j * 2], L1[j * 2], c)) * (isNew ? P.z1 : zone)
    sp.x1 = (isNew ? L1[j * 2 + 1] : mix(L0[j * 2 + 1], L1[j * 2 + 1], c)) * (isNew ? P.z1 : zone)
    sp.current = false
    sp.toScale = false
    sp.unsourced = !AGES[j].has
    sp.hairline = (c >= 1 ? rawSliver(P.n1, j) : sp.x1 - sp.x0) < HAIR * 1.01
    sp.lane = 0
    sp.ink = isNew ? ramp(c, 0.82, 1) : 1
    sp.openL = sp.openR = false
    S.spans.push(sp)
  }
  S.stack.x0 = 0
  S.stack.x1 = STACK * zone
  S.stack.a = P.n1 > 0 ? (P.n0 > 0 ? 1 : ramp(c, 0.7, 1)) : 0

  // the window: to scale. Earlier ages that reach into it, then the current one.
  const inkNew = P.turns ? winA : P.opens ? smooth(0.1, 0.5, p) : 1
  for (let j = 0; j <= P.age; j++) {
    const A = AGES[j]
    const cur = j === P.age
    if (!A.has) {
      if (!cur) continue
      // No sourced span (header, 4): the name alone, at this scene's milestone. Ordering only.
      const sp = (pool.spans[S.spans.length] ??= mkSpan())
      sp.age = j
      sp.name = A.name
      sp.x0 = sp.x1 = clamp(X(P.t), zone, 1)
      sp.current = true
      sp.toScale = false
      sp.unsourced = true
      sp.hairline = false
      sp.lane = 0
      sp.ink = smooth(ARRIVE.zoom0, ARRIVE.zoom1, p)
      sp.openL = sp.openR = false
      S.spans.push(sp)
      continue
    }
    const x0 = X(A.t0)
    const x1 = X(A.t1)
    if (x1 <= zone || x0 >= 1) continue
    const sp = (pool.spans[S.spans.length] ??= mkSpan())
    sp.age = j
    sp.name = A.name
    sp.x0 = Math.max(zone, x0)
    sp.x1 = Math.min(1, x1)
    sp.current = cur
    sp.toScale = true
    sp.unsourced = false
    sp.hairline = sp.x1 - sp.x0 < HAIR
    sp.lane = cur ? 0 : 1
    sp.ink = cur ? inkNew : winA
    sp.openL = x0 < zone
    sp.openR = x1 > 1
    S.spans.push(sp)
  }

  // ticks: zero at the window age's start
  ticksInto(S, pool, P.anchor, a, b, zone, k, winA)

  // milestones in the window
  const stamp = P.opens ? smooth(ARRIVE.pip0, ARRIVE.pip1, p) : smooth(STEP.pip0, STEP.pip1, p)
  for (let j = 0; j <= P.i; j++) {
    const Q = PLANS[j]
    const x = X(Q.t)
    if (x < zone - 1e-6 || x > 1 + 1e-6) continue
    const pp = (pool.pips[S.pips.length] ??= mkPip())
    pp.x = x
    pp.scene = Q.scene
    pp.current = j === P.i
    pp.counted = Q.counted
    pp.a = j === P.i ? stamp : winA
    S.pips.push(pp)
  }

  // the readout
  const R = S.readout
  const roll = !P.changes ? 1 : P.opens ? E.io3(ramp(p, ARRIVE.roll0, ARRIVE.roll1)) : E.io3(ramp(p, STEP.roll0, STEP.roll1))
  R.prev = P.prev
  R.cur = P.cur
  R.roll = roll
  R.held = !P.changes && !P.axis && P.cur !== ""
  R.rose = P.rose
  R.show = P.prev !== "" || P.cur !== ""
  // the gap as a line between two pips. Where no age opens, the last scene's line holds until
  // this scene's milestone is stamped (when one opens, the old line leaves with the fold).
  const B = S.bracket
  const Q = !P.turns && stamp < 0.5 ? PLANS[P.i - 1] : P
  if (Q && Q.changes && !Q.axis && X(Q.t) >= zone) {
    const x0 = X(Q.from)
    B.x0 = Math.max(zone, x0)
    B.x1 = clamp(X(Q.t), zone, 1)
    B.openL = x0 < zone
    B.a = Q !== P ? 1 - stamp * 2 : P.turns ? stamp : stamp * 2 - 1
  } else B.a = 0
  return S
}

/**
 * A string that changes exactly when the picture does. The state is a pure function of the scene
 * and `p`, so that is all it holds: compare it before calling `ruleState` and `paintRule`.
 */
export const ruleSig = (sceneId: string, p: number, style?: RuleStyle) =>
  `${sceneId}:${Math.round(clamp(p) * 4000)}${style ? `:${style.treatment ?? ""}:${style.ink ?? ""}:${style.accent ?? ""}:${style.light ?? ""}:${style.face ?? ""}:${style.px ?? ""}:${style.fonts?.name ?? ""}:${style.debug ? 1 : 0}` : ""}`

// ---------------------------------------------------------------- the face, painted

export type RuleTreatment = "steel" | "inked" | "blackened" | "worn" | "illuminated" | "phosphor"
export type RuleStyle = {
  /**
   * How the marks are cut. `steel`: dark filled grooves with a light lower edge. `inked`: flat
   * ink, no edge (clay, parchment). `blackened`: bright cuts with a dark edge, for a dark face.
   * `worn`: grooves with the fill rubbed out in places. `illuminated`: ink, with the current age
   * in a second colour and a gilt edge. `phosphor`: glowing lines, no edge.
   */
  treatment?: RuleTreatment
  /** Colour of the engraving. */
  ink?: string
  /** Colour of the lower edge of a groove ("" for none). */
  light?: string
  /** The current age's fill in `illuminated`; the rise marker everywhere. */
  accent?: string
  /** Paint an opaque face under the marks. Left out, the canvas stays transparent and alpha is the engraving mask. */
  face?: string
  /** CSS font families for names and captions, and for figures: pass `ctx.fonts.sans` (or `fell`, `typer`...) and `ctx.fonts.mono`. */
  fonts?: { name: string; mono: string }
  /**
   * Screen pixels per texel where the rule is drawn smallest. No mark is painted thinner than
   * 1.5 screen pixels. Default: the face at RULE_RECT in a 1280-wide frame.
   */
  px?: number
  /** `ctx.debugLabels`: paint the label plates flat magenta for `tools/labels.mjs` (and show them unlit). */
  debug?: boolean
}

const TREAT: Record<RuleTreatment, { ink: string; light: string; accent: string; glow: number }> = {
  steel: { ink: "#0b0c0f", light: "rgba(255,255,255,0.5)", accent: "#0b0c0f", glow: 0 },
  inked: { ink: "#1b1310", light: "", accent: "#7a1f14", glow: 0 },
  blackened: { ink: "#eadfc6", light: "rgba(0,0,0,0.6)", accent: "#eadfc6", glow: 0 },
  worn: { ink: "#23201b", light: "rgba(255,255,255,0.28)", accent: "#23201b", glow: 0 },
  illuminated: { ink: "#1b1410", light: "#c9a227", accent: "#b3261a", glow: 0 },
  phosphor: { ink: "#8dffb0", light: "", accent: "#eaffef", glow: 1 },
}

/** A box on the face, in face units (x0, y0, x1, y1; y down). Empty when x1 <= x0. */
export type RuleBox = [number, number, number, number]
/** Where the face's print landed: the readout's value, its caption, and the current age's name. Cap-height boxes. */
export type RuleBoxes = { value: RuleBox; caption: RuleBox; name: RuleBox }
export const makeRuleBoxes = (): RuleBoxes => ({ value: [0, 0, 0, 0], caption: [0, 0, 0, 0], name: [0, 0, 0, 0] })

const CAPS = new Map<string, number>()
/** Cap height of a face as a fraction of its size, measured once. */
function capRatio(c: CanvasRenderingContext2D, family: string, weight: number) {
  const key = `${weight} ${family}`
  let r = CAPS.get(key)
  if (!r) {
    c.font = `${weight} 100px ${family}`
    const m = c.measureText("H")
    r = clamp((m.actualBoundingBoxAscent || 70) / 100, 0.5, 0.9)
    if (typeof document === "undefined" || document.fonts.check(`${weight} 100px ${family}`)) CAPS.set(key, r)
  }
  return r
}
/** "3,232,200 years (arithmetic)" into the value and the note in brackets. */
const noteAt = (s: string) => (s.indexOf(" (") < 0 ? s.length : s.indexOf(" ("))

/**
 * Paint the rule's face for `state` into `c` (w × h pixels, the aspect of RULE_RECT). Vector
 * marks only; the canvas is cleared first and left transparent unless `style.face` is set, so
 * alpha is the engraving mask and rgb its colour (the lower edge of each groove is `style.light`).
 * `boxes`, if given, is filled with where the print landed.
 */
export function paintRule(c: CanvasRenderingContext2D, w: number, h: number, state: RuleState, style: RuleStyle = {}, boxes?: RuleBoxes) {
  const tr = style.treatment ?? "steel"
  const T = TREAT[tr]
  const ink = style.ink ?? T.ink
  const light = style.light ?? T.light
  const accent = style.accent ?? T.accent
  const fName = style.fonts?.name ?? "ui-sans-serif, system-ui, sans-serif"
  const fMono = style.fonts?.mono ?? "ui-monospace, Menlo, monospace"
  const k = h / ROW.H
  const px = style.px ?? (RULE_RECT.w * (1280 / DW)) / w
  const ml = 1.5 / px // the thinnest mark, in texels
  if (boxes) boxes.value[2] = boxes.value[0] = boxes.caption[2] = boxes.caption[0] = boxes.name[2] = boxes.name[0] = 0
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalAlpha = 1
  c.globalCompositeOperation = "source-over"
  c.clearRect(0, 0, w, h)
  if (style.face) {
    c.fillStyle = style.face
    c.fillRect(0, 0, w, h)
  }
  if (!state.known) {
    c.restore()
    return
  }
  const fontName = `600 ${(CAP.caption * k) / capRatio(c, fName, 600)}px ${fName}`
  const fontCap = `500 ${(CAP.caption * k) / capRatio(c, fName, 500)}px ${fName}`
  const fontUnit = `500 ${(CAP.caption * k) / capRatio(c, fMono, 500)}px ${fMono}`
  const fontValue = `500 ${(CAP.value * k) / capRatio(c, fMono, 500)}px ${fMono}`
  if (T.glow) {
    c.shadowColor = ink
    c.shadowBlur = 5 * k
  }
  c.textBaseline = "alphabetic"
  /** A filled groove: the cut, then the light catching its lower edge. */
  const groove = (x: number, y: number, gw: number, gh: number, a = 1, col = ink) => {
    if (a <= 0.01) return
    c.globalAlpha = a
    if (light) {
      c.fillStyle = light
      c.fillRect(x, y + gh, gw, ml)
    }
    c.fillStyle = col
    c.fillRect(x, y, gw, gh)
  }
  const text = (s: string, x: number, y: number, a = 1, col = ink) => {
    if (a <= 0.01 || !s) return
    c.globalAlpha = a
    if (light) {
      c.fillStyle = light
      c.fillText(s, x, y + ml * 0.6) // an offset copy, not a line: the glyph's own strokes set its weight
    }
    c.fillStyle = col
    c.fillText(s, x, y)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, a = 1, lw = ml) => {
    c.globalAlpha = a
    c.strokeStyle = ink
    c.lineWidth = lw
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    c.stroke()
  }
  const setBox = (b: RuleBox | undefined, x0: number, x1: number, base: number, cap: number) => {
    if (!b) return
    b[0] = x0 / w
    b[1] = (base - cap) / h
    b[2] = x1 / w
    b[3] = base / h
  }
  const base = ROW.base * k
  const laneY = ROW.lane * k
  const stackH = (ROW.thin + ROW.thinH - ROW.lane) * k

  /**
   * The marks of a window: spans, the gap line, pips and ticks. `sx` is how far the context is
   * squeezed along x (1 = not at all): upright strokes are widened to keep their weight, and a
   * squeezed window is drawn without print or its finer marks.
   */
  const marks = (st: RuleState, sx: number, am: number) => {
    const vw = ml / sx
    const full = sx > 0.999
    c.font = fontName
    for (const sp of st.spans) {
      if (!sp.toScale && !sp.current) continue
      const a = sp.ink * am
      const x = sp.x0 * w
      const sw = Math.max(vw, (sp.x1 - sp.x0) * w)
      const ly = mix(ROW.lane, ROW.thin, sp.lane) * k
      const lh = mix(ROW.laneH, ROW.thinH, sp.lane) * k
      const col = sp.current && tr === "illuminated" ? accent : ink
      const nb = laneY + (ROW.laneH * k + CAP.caption * k) / 2
      if (sp.unsourced) {
        if (!full) continue
        // name only, on a flag to the milestone it is known by
        const tw = c.measureText(sp.name).width
        const tx = sp.x0 > 0.55 ? x - tw - 14 * k : x + 14 * k
        text(sp.name, tx, nb, a)
        groove(sp.x0 > 0.55 ? x - 10 * k : x, nb - CAP.caption * k * 0.5, 10 * k, ml, a)
        groove(x - ml / 2, nb - CAP.caption * k * 0.5, ml, (ROW.pip - ROW.lane) * k - (ROW.laneH * k - CAP.caption * k) / 2, a)
        if (sp.current) setBox(boxes?.name, tx, tx + tw, nb, CAP.caption * k)
        continue
      }
      // a glowing fill would swallow its own name: there the current age is an outline
      const hollow = T.glow > 0 && sp.lane < 0.5 && sw > vw * 6
      if (hollow) {
        groove(x, ly, sw, lh, a * 0.16, col)
        c.globalAlpha = a
        c.strokeStyle = col
        c.lineWidth = ml
        c.strokeRect(x + vw / 2, ly + ml / 2, sw - vw, lh - ml)
      } else groove(x, ly, sw, lh, a * (sp.lane > 0.5 ? 0.8 : 1), col)
      // the ends: a cut that stands a little proud of the lane, or none where the span runs off the rule
      if (!sp.openL) groove(x, ly - 4 * k, vw, lh + 4 * k, a, col)
      if (!sp.openR && sw > vw * 2) groove(x + sw - vw, ly - 4 * k, vw, lh + 4 * k, a, col)
      if (full && sp.lane < 0.5) {
        const tw = c.measureText(sp.name).width
        let tx = x + 14 * k
        if (tw + 28 * k < sw) {
          if (hollow) text(sp.name, tx, nb, a)
          else {
            // the name is the metal showing through the fill
            c.save()
            c.shadowBlur = 0
            c.globalAlpha = a
            if (style.face) c.fillStyle = style.face
            else c.globalCompositeOperation = "destination-out"
            c.fillText(sp.name, tx, nb)
            c.restore()
          }
        } else {
          // too narrow to hold it yet: beside the span, on whichever side has room
          tx = x + sw + tw + 16 * k < w ? x + sw + 12 * k : x - tw - 12 * k
          text(sp.name, tx, nb, a)
        }
        if (sp.current) setBox(boxes?.name, tx, tx + tw, nb, CAP.caption * k)
      }
    }
    // milestones, and the gap the readout states drawn between two of them
    const py = ROW.pip * k
    const ph = ROW.pipH * k
    const B = st.bracket
    if (B.a > 0.01 && B.x1 - B.x0 > 0) {
      groove(B.x0 * w, py + ph * 0.55 - ml / 2, (B.x1 - B.x0) * w, ml, B.a * 0.9 * am)
      if (B.openL && full) {
        line(B.x0 * w + 6 * k, py, B.x0 * w, py + ph * 0.55, B.a * am)
        line(B.x0 * w + 6 * k, py + ph, B.x0 * w, py + ph * 0.55, B.a * am)
      }
    }
    if (sx > 0.3)
      for (const pp of st.pips) {
        if (pp.a <= 0.01) continue
        const x = pp.x * w
        const r = ((pp.current ? 6.5 : 5) * k) / sx
        c.globalAlpha = pp.a * am
        c.beginPath()
        c.moveTo(x, py - (pp.current ? 2 * k : 0))
        c.lineTo(x + r, py + ph)
        c.lineTo(x - r, py + ph)
        c.closePath()
        if (pp.counted) {
          c.fillStyle = ink
          c.fill()
        } else {
          c.strokeStyle = ink
          c.lineWidth = ml
          c.stroke()
        }
      }
    // ticks on the bevel: the long ones last longest under the squeeze
    const tb = ROW.H * k
    const tl = (ROW.H - ROW.tick) * k
    if (sx > 0.06) for (const t of st.ticks) if (t.len >= (sx > 0.6 ? 0 : sx > 0.25 ? 0.6 : 1)) groove(t.x * w - vw / 2, tb - tl * t.len, vw, tl * t.len, t.a * am)
  }

  const zx = state.zone * w

  // the scribed line along the back edge
  groove(0, ROW.scribe * k, w, ml, 0.8)

  // the stack, its caption and its break mark
  for (const sp of state.spans) {
    if (sp.toScale || sp.current) continue
    const x = sp.x0 * w
    const sw = Math.max(ml, (sp.x1 - sp.x0) * w)
    if (sp.unsourced && sw > ml * 5) {
      // no sourced span: an outline, not a fill
      c.globalAlpha = sp.ink
      c.strokeStyle = ink
      c.lineWidth = ml
      c.strokeRect(x + ml / 2, laneY + ml / 2, sw - ml, stackH - ml)
    } else groove(x, laneY, sw, stackH, sp.ink * (sp.hairline ? 0.85 : 1))
  }
  if (state.stack.a > 0.01) {
    const a = state.stack.a
    const x0 = state.stack.x0 * w
    const x1 = state.stack.x1 * w
    c.font = fontCap
    const tw = c.measureText(STACK_LABEL).width
    text(STACK_LABEL, x0 + Math.max(0, (x1 - x0 - tw) / 2), base - 9 * k, a)
    // a bracket gathering the slivers under the caption
    const by = base - 2 * k
    groove(x0, by, x1 - x0, ml, a)
    groove(x0, by, ml, 6 * k, a)
    groove(x1 - ml, by, ml, 6 * k, a)
    const bx = zx * 0.93
    line(bx - 4 * k, laneY + stackH + 4 * k, bx + 1 * k, laneY - 4 * k, a, ml * 1.2)
    line(bx + 2 * k, laneY + stackH + 4 * k, bx + 7 * k, laneY - 4 * k, a, ml * 1.2)
  }

  // the last window, pressed into the stack
  const F = state.fold
  if (F.a > 0.01 && F.from) {
    const sx = (F.x1 - F.x0) / (1 - F.from.zone)
    c.save()
    c.beginPath()
    c.rect(F.x0 * w, 0, (F.x1 - F.x0) * w, h)
    c.clip()
    c.translate(F.x0 * w, 0)
    c.scale(sx, 1)
    c.translate(-F.from.zone * w, 0)
    marks(F.from, sx, F.a)
    c.restore()
  }

  // the window
  marks(state, 1, 1)

  // what one long tick is worth: a division drawn out, and its unit
  {
    c.font = fontUnit
    const x = zx + 16 * k
    const iw = 26 * k
    const ih = CAP.caption * k
    groove(x, base - ih, ml, ih, 1)
    groove(x + iw - ml, base - ih, ml, ih, 1)
    groove(x, base - ih / 2 - ml / 2, iw, ml, 1)
    const z = 1 + state.unit.pop * 0.22
    c.save()
    c.translate(x + iw + 10 * k, base)
    c.scale(z, z)
    text(state.unit.label, 0, 0, 1)
    c.restore()
  }

  // the readout: caption, value, note. The caption holds; the value rolls.
  const R = state.readout
  if (R.show) {
    const pi = noteAt(R.prev)
    const ci = noteAt(R.cur)
    const pv = R.prev.slice(0, pi)
    const cv = R.cur.slice(0, ci)
    const pn = R.prev.slice(pi + 1)
    const cn = R.cur.slice(ci + 1)
    const gap = 14 * k
    const xr = w - 16 * k
    c.font = fontCap
    const wnp = pn ? c.measureText(pn).width + gap : 0
    const wnc = cn ? c.measureText(cn).width + gap : 0
    const wn = mix(wnp, wnc, R.roll)
    if (pn === cn) text(cn, xr - wnc + gap, base, 1)
    else {
      text(pn, xr - wnp + gap, base, 1 - R.roll)
      text(cn, xr - wnc + gap, base, R.roll)
    }
    c.font = fontValue
    const wp = pv ? c.measureText(pv).width : 0
    const wc = cv ? c.measureText(cv).width : 0
    const vw = mix(wp, wc, R.roll)
    const xv = xr - wn
    const rise = R.rose ? 30 * k * R.roll : 0
    c.save()
    c.beginPath()
    c.rect(xv - Math.max(wp, wc) - 6 * k, (ROW.scribe + 3) * k, Math.max(wp, wc) + 12 * k, (ROW.base - ROW.scribe + 4) * k)
    c.clip()
    const dy = (ROW.base - ROW.scribe + 2) * k
    if (pv && R.roll < 0.999) text(pv, xv - wp, base - R.roll * dy, 1 - R.roll)
    if (cv && R.roll > 0.001) text(cv, xv - wc, base + (1 - R.roll) * dy, R.roll)
    c.restore()
    const on = R.roll > 0.5 ? cv : pv
    if (on) setBox(boxes?.value, xv - (R.roll > 0.5 ? wc : wp), xv, base, CAP.value * k)
    if (rise > 0.5) {
      // larger than the gap before it: an engraved wedge pointing up
      c.globalAlpha = R.roll
      c.fillStyle = accent
      c.beginPath()
      c.moveTo(xv - vw - rise + 4 * k, base)
      c.lineTo(xv - vw - 8 * k, base)
      c.lineTo(xv - vw - rise / 2 - 2 * k, base - 20 * k)
      c.closePath()
      c.fill()
    }
    c.font = fontCap
    const lw = c.measureText(READOUT_LABEL).width
    const la = !R.prev ? R.roll : !R.cur ? 1 - R.roll : 1
    const lx = xv - vw - rise - gap - lw
    text(READOUT_LABEL, lx, base, la)
    if (la > 0.5) setBox(boxes?.caption, lx, lx + lw, base, CAP.caption * k)
  }

  if (tr === "worn") {
    // the fill rubbed out of the grooves in places: the same places every time
    const r = rng(1203)
    c.globalCompositeOperation = "destination-out"
    c.shadowBlur = 0
    for (let i = 0; i < 380; i++) {
      c.globalAlpha = 0.2 + r() * 0.45
      c.fillRect(r() * w, r() * h, (1.5 + r() * 9) * k, (0.6 + r() * 1.2) * k)
    }
  }
  if (style.debug && boxes) {
    c.globalCompositeOperation = "source-over"
    c.shadowBlur = 0
    c.globalAlpha = 1
    c.fillStyle = "#ff00ff"
    // The plates are solid (they are filled after every glyph), but the bar is held to the rect
    // in perspective (`lean`) and sampled with filtering, so a plate's edge lands up to a pixel
    // off the flat quad `ruleLabels` reports, and the tool read that edge row as hidden: readout
    // 96%, caption 92% (one row of 25 and of 14) in every scene. Each plate overhangs its box by
    // the thinnest mark, 1.5 px on screen; the box itself, and so the reported size, is unchanged.
    for (const b of [boxes.value, boxes.caption, boxes.name]) if (b[2] > b[0]) c.fillRect(b[0] * w - ml, b[1] * h - ml, (b[2] - b[0]) * w + 2 * ml, (b[3] - b[1]) * h + 2 * ml)
  }
  c.restore()
}

export type RuleFace = {
  /** sRGB colour, alpha = the engraving mask. Map it with the geometry's own `uv`. */
  tex: THREE.CanvasTexture
  canvas: HTMLCanvasElement
  /** The state last painted. */
  state: RuleState
  /** Where the print landed in the last paint. */
  boxes: RuleBoxes
  /** Repaint if scene, progress or style changed. Returns true when the texture was updated. */
  update(sceneId: string, p: number, style?: RuleStyle): boolean
  /** A face that arrived after the first paint: paint again. */
  refont(): void
  dispose(): void
}

/** The face texture and its repaint-on-change loop: `face.update(def.id, ruleArrival(def.id, s.at(0), START), style)`. */
export function ruleFace(o: { w?: number; h?: number } = {}): RuleFace {
  const w = o.w ?? RULE_TEX.w
  const h = o.h ?? RULE_TEX.h
  const tex = canvasTex(w, h, () => {})
  const canvas = tex.image as HTMLCanvasElement
  const c = canvas.getContext("2d")!
  const state = makeRuleState()
  const boxes = makeRuleBoxes()
  let last = ""
  return {
    tex,
    canvas,
    state,
    boxes,
    update(sceneId, p, style) {
      const sig = ruleSig(sceneId, p, style ?? {})
      if (sig === last) return false
      last = sig
      paintRule(c, w, h, ruleState(sceneId, p, state), style, boxes)
      tex.needsUpdate = true
      return true
    },
    refont() {
      CAPS.clear()
      last = ""
    },
    dispose: () => tex.dispose(),
  }
}

const LABEL_IDS = ["rule readout", "rule caption", "rule age"] as const
const LABELS: LabelInfo[] = LABEL_IDS.map((id) => ({ id, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }))
const LABELS_OUT: LabelInfo[] = []

/**
 * The rule's print for `labels(s)`: the readout's value, its caption and the current age's name
 * as clip-space quads (TL, TR, BR, BL), from where the last paint put them on the rect the bar is
 * held to. Spread it into your own list: `labels: () => [...ruleLabels(face), ...mine]`. The
 * objects are reused.
 */
export function ruleLabels(face: RuleFace, rect: { x: number; y: number; w: number; h: number } = RULE_RECT): LabelInfo[] {
  LABELS_OUT.length = 0
  const bs = [face.boxes.value, face.boxes.caption, face.boxes.name]
  for (let i = 0; i < 3; i++) {
    const b = bs[i]
    if (b[2] <= b[0]) continue
    const x0 = ((rect.x + b[0] * rect.w) / DW) * 2 - 1
    const x1 = ((rect.x + b[2] * rect.w) / DW) * 2 - 1
    const y0 = 1 - ((rect.y + b[1] * rect.h) / DH) * 2
    const y1 = 1 - ((rect.y + b[3] * rect.h) / DH) * 2
    const L = LABELS[i]
    L.corners[0][0] = L.corners[3][0] = x0
    L.corners[1][0] = L.corners[2][0] = x1
    L.corners[0][1] = L.corners[1][1] = y0
    L.corners[2][1] = L.corners[3][1] = y1
    LABELS_OUT.push(L)
  }
  return LABELS_OUT
}

// ---------------------------------------------------------------- the bar

/**
 * The rule as a bevelled bar, in inflation's proportions. Unit length along x (-0.5..0.5); the
 * engraved surface (flat top and bevel together) spans z = ∓width/2 with its flat at y = 0, the
 * far edge at -z and the bevel falling away toward +z. `uv` covers that surface exactly as
 * `paintRule` lays it out (u along the length, v = 1 at the far edge, the ticks on the bevel), and
 * the float attribute `face` is 1 there and 0 on the sides, ends and underside.
 * `userData.width` is the surface width for a unit length.
 */
export function ruleGeometry(o: { aspect?: number; segments?: number } = {}) {
  const W = o.aspect ?? RULE_RECT.h / RULE_RECT.w
  const seg = Math.max(1, o.segments ?? 1)
  const w = W / 2
  const th = W * 0.05
  const lip = W * 0.011
  const bev = W * (1 - ROW.tick / ROW.H) // the tick row is the bevel
  // cross-section (z, y): far side, top, bevel, near lip, underside
  const pts: [number, number][] = [[-w, -th], [-w, 0], [w - bev, 0], [w, lip - th], [w, -th]]
  const pos: number[] = []
  const nor: number[] = []
  const uvs: number[] = []
  const face: number[] = []
  const idx: number[] = []
  const tri = (a: number, b: number, c: number, nx: number, ny: number, nz: number) => {
    // wind every triangle so its front is the side its normal is on
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az
    const d = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz
    if (d >= 0) idx.push(a, b, c)
    else idx.push(a, c, b)
  }
  for (let f = 0; f < 5; f++) {
    const A = pts[f]
    const Bp = pts[(f + 1) % 5]
    const dz = Bp[0] - A[0]
    const dy = Bp[1] - A[1]
    const l = Math.hypot(dz, dy)
    // a normal to the section edge, in (z, y), turned to point away from the section's middle
    let nz = -dy / l
    let ny = dz / l
    const mz = (A[0] + Bp[0]) / 2
    const my = (A[1] + Bp[1]) / 2 + th / 2
    if (nz * mz + ny * my < 0) {
      nz = -nz
      ny = -ny
    }
    const on = f === 1 || f === 2 ? 1 : 0
    const o0 = pos.length / 3
    for (let i = 0; i <= seg; i++) {
      const x = i / seg - 0.5
      for (const q of [A, Bp]) {
        pos.push(x, q[1], q[0])
        nor.push(0, ny, nz)
        uvs.push(i / seg, (w - q[0]) / W)
        face.push(on)
      }
    }
    for (let i = 0; i < seg; i++) {
      const p0 = o0 + i * 2
      tri(p0, p0 + 2, p0 + 3, 0, ny, nz)
      tri(p0, p0 + 3, p0 + 1, 0, ny, nz)
    }
  }
  for (const sx of [-1, 1]) {
    const o0 = pos.length / 3
    for (const q of pts) {
      pos.push(sx * 0.5, q[1], q[0])
      nor.push(sx, 0, 0)
      uvs.push(sx < 0 ? 0 : 1, (w - q[0]) / W)
      face.push(0)
    }
    for (let i = 1; i < 4; i++) tri(o0, o0 + i, o0 + i + 1, sx, 0, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute("face", new THREE.Float32BufferAttribute(face, 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  g.userData.width = W
  return g
}

export type RulePlace = {
  /** World units from the camera to the middle of the face (default 4). Pick it so the bar is in front of your set. */
  dist?: number
  /** How far the face leans back from facing the lens, in radians: 0 = flat to the lens, more = lying down (default 0.18). Type near the ends of the bar shears with it. */
  lean?: number
  /** A different rect. If it is too small for the label floor, the bar is enlarged about the middle of its foot until the readout's value reaches it. */
  rect?: { x: number; y: number; w: number; h: number }
}

const _q = /*@__PURE__*/ new THREE.Quaternion()
const _v = /*@__PURE__*/ new THREE.Vector3()
const _X = /*@__PURE__*/ new THREE.Vector3(1, 0, 0)

/**
 * Put a `ruleGeometry()` mesh where its engraved surface covers RULE_RECT on screen, for this
 * camera, now. Call it every frame after moving the camera (the mesh must be a child of the scene
 * root, unscaled). The bar is rigid to the lens, like a title: same place in every scene. Its
 * print is held to the label floor with `labelFloor`: at the default rect that is already met
 * (the value at 25 px cap height on a 720-high frame, captions and names at 14). Returns the mesh.
 * Perspective cameras only.
 */
export function placeRule<M extends THREE.Object3D>(mesh: M, camera: THREE.PerspectiveCamera, o: RulePlace = {}): M {
  const r0 = o.rect ?? RULE_RECT
  const d = o.dist ?? 4
  const lean = o.lean ?? 0.18
  const t = Math.tan((camera.fov * Math.PI) / 360) / camera.zoom
  const hw = t * camera.aspect
  const cs = Math.cos(lean)
  const sn = Math.sin(lean)
  const gw = ((mesh as unknown as THREE.Mesh).geometry?.userData?.width as number | undefined) ?? RULE_RECT.h / RULE_RECT.w
  camera.updateMatrixWorld()
  let f = 1
  for (let pass = 0; pass < 2; pass++) {
    // the rect, enlarged about the middle of its foot when the print would fall under the floor
    const rw = Math.min(DW, r0.w * f)
    const rh = r0.h * f
    const rx = clamp(r0.x + r0.w / 2 - rw / 2, 0, DW - rw)
    const ry = r0.y + r0.h - rh
    // target edges in tangent space (y up), and the bar's length at distance d
    const yTop = (1 - (ry / DH) * 2) * t
    const yBot = (1 - ((ry + rh) / DH) * 2) * t
    const len = (rw / DW) * 2 * hw * d
    const cx = (((rx + rw / 2) / DW) * 2 - 1) * hw * d
    // the surface runs from its far edge (up the screen, further away) to its near edge:
    // (0, -cos lean, sin lean) in camera space. Solve for the two edge points on their view rays.
    let hgt = (yTop - yBot) * d
    let cy = ((yTop + yBot) / 2) * d
    for (let i = 0; i < 4; i++) {
      const zf = d + (hgt * sn) / 2
      const zn = d - (hgt * sn) / 2
      hgt = (yTop * zf - yBot * zn) / cs
      cy = (yTop * zf + yBot * zn) / 2
    }
    mesh.position.copy(camera.localToWorld(_v.set(cx, cy, -d)))
    // geometry: surface normal +y, near edge +z. Facing the lens is a quarter turn about x; lean back from there.
    mesh.quaternion.copy(camera.getWorldQuaternion(_q)).multiply(_q.setFromAxisAngle(_X, Math.PI / 2 - lean))
    mesh.scale.set(len, len, hgt / gw)
    if (pass) break
    // the value's cap height in the world, seen square on
    f = labelFloor(mesh.position, (CAP.value / ROW.H) * hgt * cs, camera, LABEL_MIN.number)
    if (f <= 1.001) break
  }
  mesh.updateMatrixWorld()
  return mesh
}

/** Design-space x of a rule position (0..1), for anything the type layer draws on the rule. */
export const ruleX = (x: number, rect: { x: number; w: number } = RULE_RECT) => rect.x + x * rect.w
/** Where a point of the rule is for the listener (`Cue.pos`). */
export const rulePos = (x: number): Pos => [((RULE_RECT.x + x * RULE_RECT.w) / DW) * 2 - 1, 1 - ((RULE_RECT.y + RULE_RECT.h / 2) / DH) * 2, 0.12]

/**
 * An example material: brushed steel under one light, with the face texture's alpha as the
 * engraving. Set `u.lightDir` (world space, toward the light), `u.lightCol` and `u.ambient` from
 * your scene every frame, or write your own: the scene owns the rule's light and surface. Keep
 * the engraving dark against the metal (or bright against a dark one): the print has to read.
 * `debugLabels` (pass `ctx.debugLabels`, and `debug` in the face's style) shows the cuts unlit.
 */
export function steelRuleMaterial(face: THREE.Texture, o: { base?: [number, number, number]; gloss?: number; debugLabels?: boolean } = {}) {
  const u = {
    lightDir: uniform(new THREE.Vector3(-0.35, 0.8, 0.45)),
    lightCol: uniform(new THREE.Vector3(1, 0.97, 0.92)),
    ambient: uniform(new THREE.Vector3(0.1, 0.105, 0.12)),
  }
  const base = o.base ?? [0.7, 0.71, 0.74]
  const m = new THREE.NodeMaterial()
  m.fragmentNode = Fn(() => {
    const N = normalize(normalWorld).toVar()
    const V = normalize(cameraPosition.sub(positionWorld)).toVar()
    const L = normalize(u.lightDir).toVar()
    const st = uv().toVar()
    const cut = texture(face, st).toVar()
    // brushed along its length
    const grain = vnoise(vec2(st.x.mul(46), st.y.mul(140))).mul(0.6).add(vnoise(vec2(st.x.mul(170), st.y.mul(520))).mul(0.4)).toVar()
    const metal = vec3(base[0], base[1], base[2]).mul(grain.mul(0.4).add(0.8))
    // the face attribute is 1 on the engraved surface: the sides and ends stay bare
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const col = mixN(metal, cut.rgb, on).toVar()
    const ndl = max(dot(N, L), 0).toVar()
    const spec = pow(max(dot(N, normalize(L.add(V))), 0), 70).mul(o.gloss ?? 0.9).mul(grain.mul(0.7).add(0.3)).mul(on.oneMinus())
    const fres = pow(max(dot(N, V), 0).oneMinus(), 4)
    const lit = col.mul(u.ambient.add(u.lightCol.mul(ndl.mul(0.9)))).add(u.lightCol.mul(spec).mul(ndl)).add(u.ambient.mul(fres).mul(on.oneMinus()).mul(1.5))
    return vec4(o.debugLabels ? mixN(lit, cut.rgb, on) : lit, 1)
  })()
  return { mat: m, u }
}

// ---------------------------------------------------------------- the age card

export type AgeCardOpts = {
  color?: string
  /** Shadow colour under the type, for a busy first frame. */
  shadow?: string
  x?: number
  /** Baseline of the name's first line (default 500). */
  y?: number
  size?: number
  font?: FontKey
  /** Seconds into beat 0 at which the card starts: what is left of your transition then (see `ruleArrival`). */
  start?: number
  /** Draw the selection box on the rule (default true). */
  box?: boolean
  rect?: { x: number; y: number; w: number; h: number }
}
export type AgeCardOut = {
  /** True while the card is on screen. */
  active: boolean
  /** Its length in seconds (0 when this scene opens no age). */
  dur: number
  /** Seconds into beat 0 at which it has cleared (`start` included): pass it to `titles(..., { delay: [clear] })`. */
  clear: number
  /** 0..1 through the card. */
  q: number
}
const NO_CARD: AgeCardOut = { active: false, dur: 0, clear: 0, q: 1 }
const CARD_OUT: AgeCardOut = { active: false, dur: 0, clear: 0, q: 0 }
const CARD_STATE = makeRuleState()

/**
 * The card that opens an age: the name by glyph in the serif face, its span in mono (the name
 * alone where none could be sourced), and the selection box drawing the age's span on the rule.
 * Call it from `type(g, s)` in every scene; it draws only over the first seconds of beat 0 of a
 * scene that opens an age. The returned object is reused: read it, do not keep it.
 */
export function ageCard(g: Type2D, s: State, def: SceneDef, o: AgeCardOpts = {}): AgeCardOut {
  const P = PLAN_OF.get(def.id)
  if (!P || !P.opens) return NO_CARD
  const out = CARD_OUT
  const start = o.start ?? 0
  out.dur = P.dur
  out.clear = start + P.dur * 0.94
  const t = s.beat === 0 ? s.t - start : s.beat > 0 ? Infinity : -1
  out.q = clamp(t / P.dur)
  out.active = t >= 0 && t < P.dur
  if (!out.active) return out
  const q = out.q
  const A = AGES[P.age]
  const color = o.color ?? "#ffffff"
  const shadow = o.shadow ? { color: o.shadow, blur: 30 } : undefined
  const size = o.size ?? 150
  const x = o.x ?? TYPE.x
  const y = o.y ?? 500
  const alpha = 1 - E.in2(ramp(q, ARRIVE.out, 0.94))
  const name = wrap(A.name, 20)
  const lines = name.split("\n").length
  g.text(name, x, y, { size, font: o.font ?? "serif", color, by: "glyph", style: "rise", stagger: 0.05, p: ramp(q, 0, 0.36), alpha, lh: 0.98, track: -0.012, shadow })
  if (A.span) g.text(A.span, x + 6, y + (lines - 1) * size * 0.98 + 74, { size: 34, font: "mono", color, by: "line", style: "blur", p: ramp(q, 0.2, 0.46), alpha: alpha * 0.86, track: 0.01, shadow })
  if (o.box !== false && A.has) {
    const r = o.rect ?? RULE_RECT
    const st = ruleState(def.id, q, CARD_STATE)
    const u = r.h / ROW.H
    for (const sp of st.spans) {
      if (!sp.current || !sp.toScale) continue
      const grow = E.out3(ramp(q, ARRIVE.box0, ARRIVE.box1))
      if (grow > 0) g.selbox(r.x + sp.x0 * r.w, r.y + (ROW.lane - 6) * u, (sp.x1 - sp.x0) * r.w * grow, (ROW.laneH + 12) * u, alpha, SELECT)
    }
  }
  return out
}

/** Seconds into beat 0 before a scene's own headline should start (0 when it opens no age). */
export const ageCardClear = (sceneId: string, start = 0) => {
  const T = ruleTiming(sceneId)
  return T.opensAge ? start + T.clear : 0
}

// ---------------------------------------------------------------- sound

/**
 * The rule's sounds for a scene, on beat 0: a breath as the last window folds into the stack, a
 * tick and a marimba note at the unit mark for each ×10 click (one harmonic up per click, as in
 * inflation), the selection box landing on the span, and the readout changing. Everything is a
 * harmonic of D1 and one step higher per scene, so the pulse climbs through the acts. `die` and
 * `question` get the fold and the box alone; the one rising gap gets a low thud under its note.
 * Spread it into your `cues`, with the same `start` you give `ruleArrival`.
 */
export function ruleCues(sceneId: string, o: { gain?: number; start?: number } = {}): Cue[] {
  const P = PLAN_OF.get(sceneId)
  if (!P) return []
  const T = ruleTiming(sceneId)
  const g = o.gain ?? 1
  const t0 = o.start ?? 0
  const i = P.i
  const out: Cue[] = []
  const unitAt = rulePos(P.z1 + 0.04)
  if (T.fold) out.push({ b: 0, at: t0 + T.fold[0], s: "whoosh", o: { f: H(8 + i), dur: T.fold[1] - T.fold[0], g: 0.22 * g }, pos: rulePos(0.3) })
  T.clicks.forEach((at, j) => {
    out.push({ b: 0, at: t0 + at, s: "tick", o: { f: H(60 + i + j), g: 0.5 * g, wet: 1 + j * 0.06 }, pos: unitAt })
    out.push({ b: 0, at: t0 + at, s: "marimba", o: { f: H(8 + i + j), g: 0.3 * g }, pos: unitAt })
  })
  if (T.boxAt !== null) {
    const A = AGES[P.age]
    const mid = P.z1 + (((A.t0 + A.t1) / 2 - P.a1) / (P.b1 - P.a1)) * (1 - P.z1)
    out.push({ b: 0, at: t0 + T.boxAt, s: "select", o: { f: H(24 + i), g: 1.1 * g }, pos: rulePos(mid) })
  }
  if (T.readoutAt !== null) {
    const at = t0 + T.readoutAt + 0.02
    out.push({ b: 0, at, s: "tick", o: { f: H(64 + i), g: 0.45 * g }, pos: rulePos(0.9) })
    out.push({ b: 0, at, s: "marimba", o: { f: H(8 + i), g: 0.34 * g }, pos: rulePos(0.9) })
    if (P.rose) out.push({ b: 0, at: at + 0.03, s: "thud", o: { f: H(3), g: 0.4 * g }, pos: rulePos(0.9) })
  }
  return out
}
