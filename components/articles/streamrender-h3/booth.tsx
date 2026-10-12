"use client"

// StreamRender-H3's latency as a projection booth, drawn with the vendored
// isometric-figures skill (Anatomy) through the site's port of its kit. The
// schedule is booth-model.ts, the same rules ChunkClock simulates; this figure
// shows where the frames physically are. Each tick reads the model at one
// instant and writes paths and transforms through refs, so React renders once.
// The live loop follows the skill's references/motion.md: dt from rAF clamped
// to 1/30 s, exponential follow, an idle tour, stop when offscreen, and one
// still frame under reduced motion.

import * as React from "react"
import { mexp } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { SolidPaths } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { FPS, LAST_T, SCHEDULES, boothAt, lagText, type Booth, type Mode } from "./booth-model"
import {
  ART,
  BELT_CARD,
  BELT_INLAY,
  BELT_Z,
  CT,
  DEC_X,
  DEC_Z,
  DIE_Z,
  HEIGHT,
  KNOB_X,
  LANE_DY,
  LEADER,
  LEADER_END,
  MAG_X,
  MAG_Z,
  P,
  PLATEN_Z,
  PRESS_X,
  SCREEN_EDGE,
  WIDTH,
  markSeam,
  needleAt,
  packOf,
  packRing,
  picture,
  sprocketTeeth,
  stackOf,
  type Item,
} from "./booth-geometry"

const CSS = `
.srb{
  --a-card:#fbfbfa;--a-paper:#fbfbfa;--a-top:#ffffff;
  --a-s0:#dcdcd9;--a-s1:#e5e5e2;--a-s2:#ededea;--a-s3:#f4f4f1;
  --a-hi:#26262a;--a-mid:#8a8a8f;--a-lo:#b4b4b8;--a-faint:#d4d4d6;--a-lit:#000000;
  --a-halo:#8a8a80;--a-halo-o:.32;--a-dot:#3a3a3e;--a-text:#57575a;--a-muted:#8c8c90;
  --sr-road:rgb(128,64,128);--sr-grass:rgb(107,142,35);--sr-barrier:rgb(250,150,30);--sr-car:rgb(230,20,20);--sr-rival:rgb(0,0,230);
  --sr-film:#3b3b40;--sr-film-top:#55555b;
  --sr-off:#2a2a2e;--sr-sky:#c9d6e0;--sr-verge:#8f9a78;--sr-asphalt:#5c5d61;--sr-dash:#efefea;--sr-body:#c3c6cc;--sr-roof:#7d8189;--sr-wheel:#1d1d20;
  --sr-tint:12%;
}
.dark .srb{
  --a-card:#131313;--a-paper:#131313;--a-top:#1c1c1c;
  --a-s0:#0f0f0f;--a-s1:#121212;--a-s2:#151515;--a-s3:#181818;
  --a-hi:#d4d4d4;--a-mid:#6a6a6a;--a-lo:#3e3e3e;--a-faint:#2a2a2a;--a-lit:#ffffff;
  --a-halo:#050505;--a-halo-o:.9;--a-dot:#e6e6e6;--a-text:#a3a3a3;--a-muted:#6e6e6e;
  --sr-road:rgb(110,55,110);--sr-grass:rgb(86,114,30);--sr-barrier:rgb(205,125,30);--sr-car:rgb(205,30,30);--sr-rival:rgb(40,40,205);
  --sr-film:#09090a;--sr-film-top:#2b2b30;
  --sr-off:#050506;--sr-sky:#6f7f8c;--sr-verge:#4f573f;--sr-asphalt:#303135;--sr-dash:#bdbdb6;--sr-body:#9a9ea6;--sr-roof:#4e525a;--sr-wheel:#000000;
  --sr-tint:28%;
}
.srb-plate{position:relative;padding:44px 16px 46px;background:var(--a-card);box-shadow:0 0 0 1px var(--a-mid)}
.srb-corner{position:absolute;color:var(--a-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.srb-corner[data-c="fig"]{top:16px;left:16px;color:var(--a-text)}
.srb-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.srb-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.srb-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--a-text);font-variant-numeric:tabular-nums}
.srb-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer}
.srb-stage:focus-visible{outline:1px solid var(--a-muted);outline-offset:6px}
.srb-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.srb svg path,.srb svg circle{vector-effect:non-scaling-stroke}
.srb .f{fill:var(--a-paper);stroke:none}
.srb .s0{fill:var(--a-s0)}.srb .s1{fill:var(--a-s1)}.srb .s2{fill:var(--a-s2)}.srb .s3{fill:var(--a-s3)}
.srb .tp{fill:var(--a-top)}
.srb [data-paint] .s0{fill:color-mix(in oklab,var(--pc) 72%,var(--a-hi) 28%)}
.srb [data-paint] .s1{fill:color-mix(in oklab,var(--pc) 80%,var(--a-hi) 20%)}
.srb [data-paint] .s2{fill:color-mix(in oklab,var(--pc) 88%,var(--a-hi) 12%)}
.srb [data-paint] .s3{fill:color-mix(in oklab,var(--pc) 94%,var(--a-hi) 6%)}
.srb [data-paint] .tp{fill:var(--pc)}
.srb [data-paint="road"]{--pc:var(--sr-road)}.srb [data-paint="grass"]{--pc:var(--sr-grass)}.srb [data-paint="barrier"]{--pc:var(--sr-barrier)}
.srb [data-paint="car"]{--pc:var(--sr-car)}.srb [data-paint="rival"]{--pc:var(--sr-rival)}
.srb [data-paint="film"]{--pc:var(--sr-film)}.srb [data-paint="film"] .tp{fill:var(--sr-film-top)}
.srb .ar-road{fill:var(--sr-road)}.srb .ar-grass{fill:var(--sr-grass)}.srb .ar-car{fill:var(--sr-car)}
.srb .ar-screen{fill:var(--sr-off)}
.srb .pic-sky{fill:var(--sr-sky)}.srb .pic-verge{fill:var(--sr-verge)}.srb .pic-road{fill:var(--sr-asphalt)}.srb .pic-dash{fill:var(--sr-dash)}
.srb .pic-body{fill:var(--sr-body)}.srb .pic-roof{fill:var(--sr-roof)}.srb .pic-wheel{fill:var(--sr-wheel)}
.srb .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.srb .t-hi{stroke:var(--a-hi)}.srb .t-mid{stroke:var(--a-mid)}.srb .t-lo{stroke:var(--a-lo)}.srb .t-faint{stroke:var(--a-faint)}
.srb .t-lit{stroke:var(--a-lit);stroke-width:1.2px}
.srb [data-lit] .ln.edge{stroke:var(--a-lit);stroke-width:1.1px}
.srb .dt circle{fill:var(--a-dot);stroke:none}
.srb .dt.t-hi circle{opacity:.85}.srb .dt.t-mid circle{opacity:.45}.srb .dt.t-lo circle{opacity:.22}
.srb .halo{fill:var(--a-halo);stroke:none;filter:blur(9px);opacity:var(--a-halo-o);transform:translateY(3px)}
.srb .bezel{fill:none;stroke:var(--a-lit);stroke-width:1.4px;opacity:0;transition:opacity .25s}
.srb .bezel[data-on]{opacity:1}
.srb-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.srb-modes{display:flex;flex-wrap:wrap;gap:6px}
.srb-btn{background:transparent;padding:4px 9px;border:1px solid var(--a-faint);border-radius:999px;color:inherit;font-family:ui-monospace,monospace;font-size:11.5px;line-height:1.3;opacity:.75;cursor:pointer}
.srb-btn:hover{opacity:1}
.srb-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.srb-keys{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 16px;font-size:12.5px}
.srb-keys b{font-weight:500;color:var(--a-text)}
@media (max-width:560px){.srb-plate{padding:40px 6px 64px;overflow:hidden}.srb-stage>svg{width:110%;margin-left:-5%}.srb-corner[data-c="hint"]{bottom:36px}.srb-keys{grid-template-columns:1fr}}
`

function solid(paths: SolidPaths, tone: string, crease: string) {
  return (
    <>
      <path className="f" d={paths.fill} />
      {paths.shades.map((d, shade) => (d ? <path key={shade} className={`s${shade}`} d={d} /> : null))}
      <path className="tp" d={paths.top} />
      {crease !== "none" && paths.crease ? <path className={`ln t-${crease}`} d={paths.crease} /> : null}
      {crease !== "none" && paths.bevel ? <path className={`ln t-${crease}`} d={paths.bevel} /> : null}
      <path className={`ln edge t-${tone}`} d={paths.outline} />
    </>
  )
}

function render(items: Item[], prefix: string) {
  return items.map((item, index) => {
    const key = `${prefix}-${index}`
    if (item.kind === "halo") return <path key={key} className="halo" d={item.d} />
    if (item.kind === "area") return <path key={key} className={`ar-${item.paint}`} d={item.d} />
    if (item.kind === "line") return item.d ? <path key={key} className={`ln t-${item.tone}`} d={item.d} data-free={item.free ? "" : undefined} /> : null
    if (item.kind === "dots")
      return (
        <g key={key} className={`dt t-${item.tone}`}>
          {item.points.map(([x, y], i) => (
            <circle key={i} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={item.size} />
          ))}
        </g>
      )
    return (
      <g key={key} data-paint={item.paint}>
        {solid(item.paths, item.tone, item.crease ?? "faint")}
      </g>
    )
  })
}

// A solid whose shape changes: eight paths written in place each frame.
const SOLID_KEYS = ["fill", "s0", "s1", "s2", "s3", "top", "crease", "outline"] as const
function solidDs(paths: SolidPaths | null) {
  if (!paths) return SOLID_KEYS.map(() => "")
  return [paths.fill, ...paths.shades, paths.top, paths.crease, paths.outline]
}
const LIVE_CLASSES = (tone: string) => ["f", "s0", "s1", "s2", "s3", "tp", "ln t-faint", `ln edge t-${tone}`]
function writeSolid(g: SVGGElement | null, paths: SolidPaths | null) {
  if (!g) return
  const ds = solidDs(paths)
  const kids = g.children
  for (let i = 0; i < kids.length && i < ds.length; i++) {
    const d = ds[i]!
    if (kids[i]!.getAttribute("d") !== d) kids[i]!.setAttribute("d", d)
  }
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-3 ? target : next
}

// The player's lane at engine frame f: each pull of the lever flips it, and
// the car takes five frames to cross.
function laneAt(f: number, pulls: number[]) {
  let from = 0
  let target = 0
  let m0 = 0
  const seg = (x: number) => from + (target - from) * smooth((x - m0) / 5)
  for (const m of pulls) {
    if (f < m) break
    from = seg(m)
    target = 1 - target
    m0 = m
  }
  return seg(f)
}

// Model seconds per wall-clock second: a quarter speed, so 24 fps can be followed.
const SPEED = 0.25
const LOOP_T = 6.4
const TOUR_PULLS = [48, 96]
const REST_T = 4.14
const REST_PULLS = [72]
const TOUR_DELAY = 1.4
const RESUME = 3.6

interface Frame {
  b: Booth
  car: string
  knob: string
  card: { transform: string; opacity: number; lit: boolean; over: boolean } | null
  hopper: ReturnType<typeof stackOf> | null
  travel: { stack: ReturnType<typeof stackOf>; inPress: boolean; x: number; z: number } | null
  platen: string
  hold: ReturnType<typeof stackOf> | null
  marks: { hopper: string; press: string; hold: string; pack: string }
  teeth: string
  pic: ReturnType<typeof picture> | null
}

function frameOf(t: number, mode: Mode, pulls: number[], packN: number): Frame {
  const mark = pulls.length ? pulls[pulls.length - 1]! : -1
  const b = boothAt(t, mode, mark)
  const f = t * FPS
  const lane = laneAt(f, pulls)
  const car = k.translateAlong(P, [0, -LANE_DY * lane, 0])
  const knob = k.translateAlong(P, [(KNOB_X[1]! - KNOB_X[0]!) * lane, 0, 0])
  // the frame in flight from the camera to the magazine: it lands when drawn
  const next = Math.floor(f + 1e-9) + 1
  const p = f - Math.floor(f + 1e-9)
  let card: Frame["card"] = null
  if (next < SCHEDULES[mode]!.frames) {
    const slide = Math.min(1, p / 0.8)
    const x = -90 + slide * (MAG_X + 90)
    const drop = smooth((p - 0.8) / 0.2)
    const z = BELT_Z + (MAG_Z + b.hopper * CT - BELT_Z) * drop
    card = { transform: k.translateAlong(P, [x, 0, z]), opacity: Math.min(1, p / 0.12), lit: next === mark, over: z > MAG_Z + 19.5 }
  }
  const hopper = b.hopper > 0 ? stackOf(MAG_X, MAG_Z, b.hopper) : null
  let travel: Frame["travel"] = null
  let platen = ""
  if (b.chunkNo >= 0) {
    const tau = b.transfer
    const lift = smooth(tau / 0.3)
    const slide = smooth((tau - 0.3) / 0.7)
    const x = MAG_X + (PRESS_X - MAG_X) * slide
    const z = MAG_Z + (DIE_Z - MAG_Z) * lift
    travel = { stack: stackOf(x, z, b.press), inPress: x > MAG_X + 8.3, x, z }
    const travelZ = PLATEN_Z - (DIE_Z + b.press * CT) - 0.2
    platen = k.translateAlong(P, [0, 0, -travelZ * b.stroke])
  }
  const hold = b.hold > 0 ? stackOf(DEC_X, DEC_Z, b.hold) : null
  const marks = {
    hopper: b.mark === "hopper" ? markSeam(MAG_X, MAG_Z, b.markIndex) : "",
    press: b.mark === "press" && travel ? markSeam(travel.x, travel.z, b.markIndex) : "",
    hold: b.mark === "hold" ? markSeam(DEC_X, DEC_Z, b.markIndex) : "",
    pack: b.mark === "pack" && b.markIndex < packN ? packRing(b.markIndex) : "",
  }
  const first = SCHEDULES[mode]!.shown[0]!
  const teeth = sprocketTeeth(t >= first ? ((t - first) * FPS * Math.PI * 2) / 12 : 0)
  const pic = b.onScreen >= 0 ? picture(laneAt(b.onScreen, pulls), b.onScreen) : null
  return { b, car, knob, card, hopper, travel, platen, hold, marks, teeth, pic }
}

function readoutOf(b: Booth, mode: Mode) {
  let phase: string
  if (!b.screenOn) phase = b.chunkNo === 0 ? "painting the 30-frame bootstrap" : "collecting 30 frames · screen dark"
  else if (b.chunkNo > 0) phase = `painting ${b.press} frames`
  else phase = "collecting a chunk"
  if (!b.screenOn) return phase
  const S = SCHEDULES[mode]!
  const lag = S.shown[b.onScreen]! - b.onScreen / FPS
  return `lag ${lag.toFixed(2)} s · ${phase}`
}

const MODES: { label: string; says: string }[] = [
  { label: "As shipped", says: "The server plays at 24 fps from the first frame and never skips ahead, so the bootstrap's backlog stays on the platter for the whole session." },
  { label: "Re-sync once", says: "A server that skips ahead once after the bootstrap: the backlog is cut off the platter, and every later frame waits only as long as the chunk schedule needs." },
  { label: "…and no pair hold", says: "The same, with a decoder that releases each latent as soon as its chunk is painted instead of waiting for its partner in the next chunk." },
]

const REST = frameOf(REST_T, 0, REST_PULLS, boothAt(REST_T, 0, 72).pack)
const REST_PACK = packOf(REST.b.pack)
const REST_READOUT = readoutOf(REST.b, 0)
const REST_NEEDLE = needleAt(REST.b.markLag)

interface Live {
  t: number
  mode: Mode
  pulls: number[]
  pack: number
  needle: number
  clock: number
  touring: boolean
  holdUntil: number
  inside: boolean
  focused: boolean
}

export function StreamBooth() {
  const [mode, setMode] = React.useState<Mode>(0)
  const [announce, setAnnounce] = React.useState("")
  const stage = React.useRef<HTMLDivElement>(null)
  // the live parts' DOM nodes, filled by callback refs and read only in effects
  const [nodes] = React.useState<Record<string, SVGGElement | SVGPathElement | null>>(() => ({}))
  const set = (name: string) => (el: SVGGElement | SVGPathElement | null) => {
    nodes[name] = el
  }
  const readout = React.useRef<HTMLSpanElement>(null)
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    t: REST_T,
    mode: 0,
    pulls: [...REST_PULLS],
    pack: REST.b.pack,
    needle: REST.b.markLag,
    clock: 0,
    touring: false,
    holdUntil: 0,
    inside: false,
    focused: false,
  })
  const drawRef = React.useRef<(calm: boolean, dt: number) => void>(() => {})

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0
    const r = nodes
    const attr = (name: string, key: string, value: string | null) => {
      const el = r[name]
      if (!el) return
      if (value === null) {
        if (el.hasAttribute(key)) el.removeAttribute(key)
      } else if (el.getAttribute(key) !== value) el.setAttribute(key, value)
    }
    let announced = -1

    const draw = (calm: boolean, dt: number) => {
      const s = live.current
      s.pack = follow(s.pack, boothAt(s.t, s.mode, -1).pack, dt, 0.12, calm)
      const F = frameOf(s.t, s.mode, s.pulls, s.pack)
      s.needle = follow(s.needle, F.b.markLag, dt, 0.08, calm)
      attr("car", "transform", F.car)
      attr("knob", "transform", F.knob)
      // above the posts' tops the card is drawn over them; between them, behind the front pair
      for (const [name, over] of [["cardIn", false], ["cardOver", true]] as const) {
        const show = F.card && F.card.over === over
        attr(name, "transform", F.card ? F.card.transform : null)
        attr(name, "opacity", show ? F.card!.opacity.toFixed(3) : "0")
        attr(name, "data-lit", show && F.card!.lit ? "" : null)
      }
      writeSolid(r.hopper as SVGGElement, F.hopper?.paths ?? null)
      attr("hopperSeams", "d", F.hopper?.seams ?? "")
      for (const part of ["grass", "road", "car"] as const) {
        attr(`hopperTop-${part}`, "d", F.hopper?.top[part] ?? "")
        attr(`holdTop-${part}`, "d", F.hold?.top[part] ?? "")
        attr(`magTop-${part}`, "d", F.travel && !F.travel.inPress ? F.travel.stack.top[part] : "")
        attr(`pressTop-${part}`, "d", F.travel && F.travel.inPress ? F.travel.stack.top[part] : "")
      }
      writeSolid(r.travelMag as SVGGElement, F.travel && !F.travel.inPress ? F.travel.stack.paths : null)
      writeSolid(r.travelPress as SVGGElement, F.travel && F.travel.inPress ? F.travel.stack.paths : null)
      attr("magSeams", "d", F.travel && !F.travel.inPress ? F.travel.stack.seams : "")
      attr("pressSeams", "d", F.travel && F.travel.inPress ? F.travel.stack.seams : "")
      attr("markMag", "d", F.travel && !F.travel.inPress ? F.marks.press : "")
      attr("markPress", "d", F.travel && F.travel.inPress ? F.marks.press : "")
      attr("platen", "transform", F.platen || null)
      writeSolid(r.hold as SVGGElement, F.hold?.paths ?? null)
      attr("holdSeams", "d", F.hold?.seams ?? "")
      attr("markHopper", "d", F.marks.hopper)
      attr("markHold", "d", F.marks.hold)
      writeSolid(r.pack as SVGGElement, packOf(s.pack))
      attr("markPack", "d", F.marks.pack)
      attr("teeth", "d", F.teeth)
      attr("needle", "d", needleAt(s.needle))
      attr("bezel", "data-on", F.b.mark === "screen" ? "" : null)
      attr("pic", "display", F.pic ? null : "none")
      if (F.pic) for (const part of ["sky", "verge", "road", "dashes", "body", "roof", "wheels"] as const) attr(`pic-${part}`, "d", F.pic[part])
      if (readout.current) {
        const text = readoutOf(F.b, s.mode)
        if (readout.current.textContent !== text) readout.current.textContent = text
      }
      const mark = s.pulls.length ? s.pulls[s.pulls.length - 1]! : -1
      if (F.b.markDone && mark !== announced && !s.touring) {
        announced = mark
        setAnnounce(F.b.mark === "cut" ? "That frame was cut at the re-sync." : `That frame reached the screen ${F.b.markLag.toFixed(2)} seconds after the engine drew it.`)
      }
    }
    drawRef.current = draw

    const tick = (now: number) => {
      const s = live.current
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = still.matches
      s.clock += dt
      if (!calm && !s.touring && !s.inside && !s.focused && s.clock >= Math.max(s.holdUntil, TOUR_DELAY)) s.touring = true
      if (!calm) {
        const before = s.t
        s.t += dt * SPEED
        if (s.touring) for (const m of TOUR_PULLS) if (before < (m - 0.5) / FPS && s.t >= (m - 0.5) / FPS && !s.pulls.includes(m)) s.pulls.push(m)
        const mark = s.pulls.length ? s.pulls[s.pulls.length - 1]! : -1
        const pending = mark >= 0 && !boothAt(s.t, s.mode, mark).markDone
        const end = pending ? LAST_T - 0.3 : LOOP_T
        if (s.t >= end || (!pending && s.t >= LOOP_T)) {
          s.t = 0
          s.pulls = []
        }
      }
      draw(calm, dt)
      frame.current = visible && !calm ? requestAnimationFrame(tick) : 0
    }
    const kick = () => {
      if (frame.current || !visible) return
      last = 0
      frame.current = requestAnimationFrame(tick)
    }
    kickRef.current = kick
    const observer = new IntersectionObserver(
      (entries) => {
        visible = Boolean(entries[entries.length - 1]?.isIntersecting)
        if (visible) kick()
        else {
          cancelAnimationFrame(frame.current)
          frame.current = 0
        }
      },
      { rootMargin: "120px 0px" },
    )
    observer.observe(node)
    const onScheme = () => {
      if (still.matches) {
        live.current.t = REST_T
        live.current.pulls = [...REST_PULLS]
      }
      draw(still.matches, 1)
      kick()
    }
    still.addEventListener("change", onScheme)
    if (still.matches) draw(true, 1)
    return () => {
      observer.disconnect()
      still.removeEventListener("change", onScheme)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [nodes])

  const takeOver = () => {
    const s = live.current
    s.touring = false
    s.holdUntil = s.clock + RESUME
  }
  const calmNow = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const pull = () => {
    const s = live.current
    takeOver()
    const m = Math.floor(s.t * FPS + 1e-9) + 1
    const S = SCHEDULES[s.mode]!
    if (calmNow()) {
      // no motion: jump to the moment the steered frame is on the screen
      let at = S.shown[m]
      if (!(at !== undefined && Number.isFinite(at) && at < LAST_T - 0.3)) {
        s.t = REST_T
        s.pulls = [...REST_PULLS]
      } else {
        s.pulls = [...s.pulls, m]
        at = Math.max(at, s.t)
        s.t = at + 0.01
      }
      drawRef.current(true, 1)
      return
    }
    if (m >= S.frames - 40) return
    s.pulls = [...s.pulls, m]
    setAnnounce("")
    kickRef.current()
  }
  const choose = (next: Mode) => {
    const s = live.current
    takeOver()
    s.mode = next
    setMode(next)
    if (calmNow()) {
      s.t = REST_T
      s.pulls = [...REST_PULLS]
      drawRef.current(true, 1)
    } else {
      s.t = 0
      s.pulls = []
      kickRef.current()
    }
    setAnnounce(`${MODES[next]!.label}. Frames reach the screen ${lagText(next).replace(" s", " seconds")} after the engine draws them.`)
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      pull()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      choose(((live.current.mode + 1) % 3) as Mode)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      choose(((live.current.mode + 2) % 3) as Mode)
    }
  }

  const topOf = (name: string, top: ReturnType<typeof stackOf>["top"] | undefined) => (
    <g key={name}>
      <path ref={set(`${name}-grass`)} className="ar-grass" d={top?.grass ?? ""} />
      <path ref={set(`${name}-road`)} className="ar-road" d={top?.road ?? ""} />
      <path ref={set(`${name}-car`)} className="ar-car" d={top?.car ?? ""} />
    </g>
  )
  const R = REST

  return (
    <figure className="srb not-prose my-8">
      <style>{CSS}</style>
      <div className="srb-plate">
        <span className="srb-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="srb-corner" data-c="title" aria-hidden="true">
          The projection booth
        </span>
        <span className="srb-corner" data-c="hint" aria-hidden="true">
          Tap to steer · ← → server
        </span>
        <span className="srb-corner" data-c="readout" ref={readout} aria-hidden="true">
          {REST_READOUT}
        </span>
        <div
          ref={stage}
          className="srb-stage"
          tabIndex={0}
          role="group"
          aria-label="The StreamRender-H3 pipeline as a projection booth. Space or Enter pulls the steering lever; the left and right arrows switch between the shipped server and two re-syncing servers."
          onPointerDown={pull}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return
            live.current.inside = true
            live.current.touring = false
          }}
          onPointerLeave={() => {
            live.current.inside = false
            live.current.holdUntil = live.current.clock + RESUME
          }}
          onFocus={() => {
            live.current.focused = true
            live.current.touring = false
          }}
          onBlur={() => {
            live.current.focused = false
            live.current.holdUntil = live.current.clock + RESUME
          }}
          onKeyDown={onKeyDown}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="An isometric bench. From left: a tray with flat-coloured blocks for road, grass, barriers and two cars, with a steering lever in front; a film camera aimed at it; a short belt into a magazine where frame cards stack up; a press with a platen over a stack of cards; a decoder box with two card slots; a round platter carrying a pack of film; a projector; and a cabinet whose front is a screen showing the painted road and car. A stopwatch on the bench is wired to the lever and to the screen."
            focusable="false"
          >
            <g key="base">{render(ART.base, "b")}</g>
            <g key="wires">{render(ART.wires, "w")}</g>
            <g key="stage">{render(ART.stage, "st")}</g>
            <g key="car" ref={set("car")} transform={R.car}>
              {render(ART.car, "car")}
            </g>
            <g key="stageFront">{render(ART.stageFront, "sf")}</g>
            <g key="camera">{render(ART.camera, "cam")}</g>
            <g key="gate">{render(ART.gate, "g")}</g>
            <g key="knob" ref={set("knob")} transform={R.knob}>
              {render(ART.knob, "kn")}
            </g>
            <g key="belt">{render(ART.belt, "be")}</g>
            <g key="magBack">{render(ART.magazineBack, "mb")}</g>
            <g key="hopper" ref={set("hopper")}>
              {LIVE_CLASSES("hi").map((c, i) => (
                <path key={i} className={c} d={solidDs(R.hopper?.paths ?? null)[i]} />
              ))}
            </g>
            <path key="hopperSeams" ref={set("hopperSeams")} className="ln t-faint" d={R.hopper?.seams ?? ""} />
            {topOf("hopperTop", R.hopper?.top)}
            <path key="markHopper" ref={set("markHopper")} className="ln t-lit" d={R.marks.hopper} />
            <g key="travelMag" ref={set("travelMag")}>
              {LIVE_CLASSES("hi").map((c, i) => (
                <path key={i} className={c} d={solidDs(R.travel && !R.travel.inPress ? R.travel.stack.paths : null)[i]} />
              ))}
            </g>
            <path key="magSeams" ref={set("magSeams")} className="ln t-faint" d={R.travel && !R.travel.inPress ? R.travel.stack.seams : ""} />
            {topOf("magTop", R.travel && !R.travel.inPress ? R.travel.stack.top : undefined)}
            <path key="markMag" ref={set("markMag")} className="ln t-lit" d={R.travel && !R.travel.inPress ? R.marks.press : ""} />
            <g
              key="cardIn"
              ref={set("cardIn")}
              transform={R.card?.transform}
              opacity={R.card && !R.card.over ? R.card.opacity.toFixed(3) : "0"}
              data-lit={R.card && !R.card.over && R.card.lit ? "" : undefined}
            >
              {solid(BELT_CARD, "hi", "none")}
              <path className="ar-grass" d={BELT_INLAY.grass} />
              <path className="ar-road" d={BELT_INLAY.road} />
              <path className="ar-car" d={BELT_INLAY.car} />
            </g>
            <g key="magFront">{render(ART.magazineFront, "mf")}</g>
            <g
              key="cardOver"
              ref={set("cardOver")}
              transform={R.card?.transform}
              opacity={R.card && R.card.over ? R.card.opacity.toFixed(3) : "0"}
              data-lit={R.card && R.card.over && R.card.lit ? "" : undefined}
            >
              {solid(BELT_CARD, "hi", "none")}
              <path className="ar-grass" d={BELT_INLAY.grass} />
              <path className="ar-road" d={BELT_INLAY.road} />
              <path className="ar-car" d={BELT_INLAY.car} />
            </g>
            <g key="pressBack">{render(ART.pressBack, "pb")}</g>
            <g key="travelPress" ref={set("travelPress")}>
              {LIVE_CLASSES("hi").map((c, i) => (
                <path key={i} className={c} d={solidDs(R.travel && R.travel.inPress ? R.travel.stack.paths : null)[i]} />
              ))}
            </g>
            <path key="pressSeams" ref={set("pressSeams")} className="ln t-faint" d={R.travel && R.travel.inPress ? R.travel.stack.seams : ""} />
            {topOf("pressTop", R.travel && R.travel.inPress ? R.travel.stack.top : undefined)}
            <path key="markPress" ref={set("markPress")} className="ln t-lit" d={R.travel && R.travel.inPress ? R.marks.press : ""} />
            <g key="platen" ref={set("platen")} transform={R.platen || undefined}>
              {render(ART.platen, "pl")}
            </g>
            <g key="pressFront">{render(ART.pressFront, "pf")}</g>
            <g key="decoder">{render(ART.decoder, "dc")}</g>
            <g key="hold" ref={set("hold")}>
              {LIVE_CLASSES("hi").map((c, i) => (
                <path key={i} className={c} d={solidDs(R.hold?.paths ?? null)[i]} />
              ))}
            </g>
            <path key="holdSeams" ref={set("holdSeams")} className="ln t-faint" d={R.hold?.seams ?? ""} />
            {topOf("holdTop", R.hold?.top)}
            <path key="markHold" ref={set("markHold")} className="ln t-lit" d={R.marks.hold} />
            <g key="platter">{render(ART.platterBack, "pt")}</g>
            <g key="pack" ref={set("pack")} data-paint="film">
              {LIVE_CLASSES("mid").map((c, i) => (
                <path key={i} className={c} d={solidDs(REST_PACK)[i]} />
              ))}
            </g>
            <path key="markPack" ref={set("markPack")} className="ln t-lit" d={R.marks.pack} />
            <g key="hub">{render(ART.hub, "hb")}</g>
            <g key="watch">{render(ART.stopwatch, "sw")}</g>
            <path key="needle" ref={set("needle")} className="ln t-lit" d={REST_NEEDLE} />
            <g key="projector">{render(ART.projector, "pj")}</g>
            <path key="teeth" ref={set("teeth")} className="ln t-lo" d={R.teeth} />
            <path key="leader" className="ln t-mid" d={LEADER} />
            <g key="leaderEnd" className="dt t-hi">
              <circle cx={LEADER_END[0]} cy={LEADER_END[1]} r={0.55} />
            </g>
            <g key="cabinet">{render(ART.cabinet, "cb")}</g>
            <g key="pic" ref={set("pic")} display={R.pic ? undefined : "none"}>
              <path ref={set("pic-sky")} className="pic-sky" d={R.pic?.sky ?? ""} />
              <path ref={set("pic-verge")} className="pic-verge" d={R.pic?.verge ?? ""} />
              <path ref={set("pic-road")} className="pic-road" d={R.pic?.road ?? ""} />
              <path ref={set("pic-dashes")} className="pic-dash" d={R.pic?.dashes ?? ""} />
              <path ref={set("pic-wheels")} className="pic-wheel" d={R.pic?.wheels ?? ""} />
              <path ref={set("pic-body")} className="pic-body" d={R.pic?.body ?? ""} />
              <path ref={set("pic-roof")} className="pic-roof" d={R.pic?.roof ?? ""} />
            </g>
            <path key="bezel" ref={set("bezel")} className="bezel" d={SCREEN_EDGE} data-on={R.b.mark === "screen" ? "" : undefined} />
          </svg>
        </div>
      </div>
      <figcaption className="srb-legend text-muted-foreground">
        <div className="srb-modes" role="group" aria-label="Server">
          <button type="button" className="srb-btn" onClick={pull}>
            Steer
          </button>
          {MODES.map((m, i) => (
            <button key={m.label} type="button" className="srb-btn" aria-pressed={mode === i} onClick={() => choose(i as Mode)}>
              {m.label} · {lagText(i as Mode)}
            </button>
          ))}
        </div>
        <div>{MODES[mode]!.says}</div>
        <div className="srb-keys">
          <span>
            <b>Tray and lever</b> the game engine and the player&apos;s steering; the lever never reaches the press
          </span>
          <span>
            <b>Camera and magazine</b> one flat-colour frame every 1/24 s, collected until a chunk is full
          </span>
          <span>
            <b>Press</b> the 33B streaming DiT, two strokes per chunk
          </span>
          <span>
            <b>Decoder</b> releases latents in pairs; an odd one waits in the left slot
          </span>
          <span>
            <b>Platter</b> painted frames not yet shown: the backlog
          </span>
          <span>
            <b>Projector and stopwatch</b> 24 fps from the first frame; the hand times the steered frame
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </figcaption>
    </figure>
  )
}
