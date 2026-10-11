"use client"

// Anatomy, drawn by Anatomy. A bench of nine stations, one per stage of the
// skill's workflow, with a carriage that carries the one-line prompt past
// them. Built by following wheresryan22/anatomy's SKILL.md as if it had been
// invoked: geometry once in geometry.ts with a port of the kit, solids painted
// back to front, a card with fig/title/hint/readout, one lit accent, a calm
// time-based loop with an idle tour, and one WebGL layer between a back and a
// front SVG (plasma.ts). The live loop follows references/motion.md: dt from
// rAF clamped to 1/30 s, exponential follow and the kit's sub-stepped spring,
// stop when offscreen or settled, jump to targets under reduced motion.

import * as React from "react"
import { mexp } from "@/lib/dmath"
import * as k from "./iso-kit"
import {
  ART,
  BLOCK_MAX,
  CARDS,
  CHAMBER,
  GATE_X,
  HEIGHT,
  P,
  PEGS,
  PLASMA_BOX,
  PLASMA_FALLBACK,
  STATIONS,
  STATION_X,
  WIDTH,
  blockAt,
  cardSolid,
  needleAt,
  RIDER,
  type Item,
} from "./geometry"
import { plasmaLayer, type PlasmaLayer } from "./plasma"

const CSS = `
.anm{
  --a-card:#fbfbfa;--a-paper:#fbfbfa;--a-top:#ffffff;
  --a-s0:#dcdcd9;--a-s1:#e5e5e2;--a-s2:#ededea;--a-s3:#f4f4f1;
  --a-lit-top:#ffffff;--a-lit-shade:#eeeeeb;
  --a-hi0:#26262a;--a-mid0:#8a8a8f;--a-lo0:#b4b4b8;--a-faint0:#d4d4d6;--a-lit0:#000000;
  --a-halo:#8a8a80;--a-halo-o:.32;--a-dot:#3a3a3e;--a-text:#57575a;--a-muted:#8c8c90;
  --a-plasma:#8a2be2;
  --a-hi:var(--a-hi0);--a-mid:var(--a-mid0);--a-lo:var(--a-lo0);--a-faint:var(--a-faint0);
  --a-sh0:var(--a-s0);--a-sh1:var(--a-s1);--a-sh2:var(--a-s2);--a-sh3:var(--a-s3);--a-tp:var(--a-top);
}
.dark .anm{
  --a-card:#131313;--a-paper:#131313;--a-top:#1c1c1c;
  --a-s0:#0f0f0f;--a-s1:#121212;--a-s2:#151515;--a-s3:#181818;
  --a-lit-top:#262626;--a-lit-shade:#1d1d1d;
  --a-hi0:#d4d4d4;--a-mid0:#6a6a6a;--a-lo0:#3e3e3e;--a-faint0:#2a2a2a;--a-lit0:#ffffff;
  --a-halo:#050505;--a-halo-o:.9;--a-dot:#e6e6e6;--a-text:#a3a3a3;--a-muted:#6e6e6e;
  --a-plasma:#c58bff;
}
.anm[data-focus] .anm-st:not([data-on]){--a-hi:var(--a-mid0);--a-mid:var(--a-lo0);--a-lo:var(--a-faint0)}
.anm .anm-st[data-on]{--a-hi:var(--a-lit0);--a-mid:var(--a-hi0);--a-tp:var(--a-lit-top);--a-sh0:var(--a-lit-shade);--a-sh1:var(--a-lit-shade);--a-sh2:var(--a-lit-shade);--a-sh3:var(--a-lit-shade)}
.anm-plate{position:relative;padding:44px 16px 46px;background:var(--a-card);box-shadow:0 0 0 1px var(--a-mid0)}
.anm-corner{position:absolute;color:var(--a-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.anm-corner[data-c="fig"]{top:16px;left:16px;color:var(--a-text)}
.anm-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.anm-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.anm-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--a-text);font-variant-numeric:tabular-nums}
.anm-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer}
.anm-stage:focus-visible{outline:1px solid var(--a-muted);outline-offset:6px}
.anm-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.anm-stage>.anm-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.dark .anm-gl{mix-blend-mode:screen}
.anm-stage[data-gl] .anm-fallback{display:none}
.anm svg path,.anm svg circle{vector-effect:non-scaling-stroke}
.anm .f{fill:var(--a-paper);stroke:none}
.anm .s0{fill:var(--a-sh0)}.anm .s1{fill:var(--a-sh1)}.anm .s2{fill:var(--a-sh2)}.anm .s3{fill:var(--a-sh3)}
.anm .tp{fill:var(--a-tp)}
.anm .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.anm .t-hi{stroke:var(--a-hi)}.anm .t-mid{stroke:var(--a-mid)}.anm .t-lo{stroke:var(--a-lo)}.anm .t-faint{stroke:var(--a-faint)}.anm .t-lit{stroke:var(--a-lit0)}
.anm .dt circle{fill:var(--a-dot);stroke:none}
.anm .dt.t-hi circle{opacity:.85}.anm .dt.t-mid circle{opacity:.45}.anm .dt.t-lo circle{opacity:.22}
.anm .halo{fill:var(--a-halo);stroke:none;filter:blur(9px);opacity:var(--a-halo-o);transform:translateY(3px)}
.anm-fallback{fill:none;stroke:var(--a-plasma);stroke-width:1.6px;stroke-linecap:round}
.anm-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.anm-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
@media (max-width:560px){.anm-list{grid-template-columns:repeat(2,minmax(0,1fr))}.anm-plate{padding:40px 6px 64px}.anm-corner[data-c="hint"]{bottom:36px}}
.anm-btn{display:flex;gap:6px;align-items:baseline;text-align:left;padding:4px 6px;border:1px solid transparent;border-radius:4px;color:inherit;opacity:.72;font-size:12.5px;line-height:1.3}
.anm-btn:hover{opacity:1}
.anm-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.anm-btn span:first-child{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
.anm-detail{min-height:5.5em}
.anm-detail code{font-size:12px}
@media (prefers-reduced-motion:reduce){.anm-btn{transition:none}}
`

function render(items: Item[], prefix: string) {
  return items.map((item, index) => {
    const key = `${prefix}-${index}`
    if (item.kind === "halo") return <path key={key} className="halo" d={item.d} />
    if (item.kind === "line") return item.d ? <path key={key} className={`ln t-${item.tone}`} d={item.d} /> : null
    if (item.kind === "dots")
      return (
        <g key={key} className={`dt t-${item.tone}`}>
          {item.points.map(([x, y], i) => (
            <circle key={i} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={item.size} />
          ))}
        </g>
      )
    const { paths, tone, crease = "faint" } = item
    return (
      <g key={key}>
        <path className="f" d={paths.fill} />
        {paths.shades.map((d, shade) => (d ? <path key={shade} className={`s${shade}`} d={d} /> : null))}
        <path className="tp" d={paths.top} />
        {crease !== "none" && paths.crease ? <path className={`ln t-${crease}`} d={paths.crease} /> : null}
        {crease !== "none" && paths.bevel ? <path className={`ln t-${crease}`} d={paths.bevel} /> : null}
        <path className={`ln t-${tone}`} d={paths.outline} />
      </g>
    )
  })
}

// The kit's spring (kit/react/live.tsx:101): sub-stepped at 240 Hz, critically
// damped under reduced motion, snapped once error and rate fall below 5e-4.
interface Spring {
  at: number
  rate: number
}
function spring(state: Spring, target: number, dt: number, stiffness: number, damping: number, calm: boolean) {
  if (calm) {
    state.at = target
    state.rate = 0
    return true
  }
  const steps = Math.max(Math.ceil(dt * 240), 1)
  const slice = dt / steps
  for (let step = 0; step < steps; step++) {
    state.rate += (target - state.at) * stiffness * slice - state.rate * damping * slice
    state.at += state.rate * slice
  }
  if (Math.abs(target - state.at) < 5e-4 && Math.abs(state.rate) < 5e-4) {
    state.at = target
    state.rate = 0
  }
  return state.at === target && state.rate === 0
}
const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-3 ? target : next
}
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

const DWELL = 2.8
const TOUR_DELAY = 1.4
const RESUME = 3.6
const NAMES = ["Figure", "Hero", "Epic"]
const BLOCK_X = STATION_X[4]!
const RACK_X = STATION_X[5]!
const GATE_CX = STATION_X[1]!
const DIAL_CX = STATION_X[2]!
const CHAMBER_X = STATION_X[6]!

const REST_BLOCK = 0.3
const REST = {
  carriage: k.translateAlong(P, [STATION_X[0]!, 0, 0]),
  rider: k.translateAlong(P, [GATE_CX + GATE_X[0]!, 0, 0]),
  needle: needleAt(DIAL_CX, 0),
  block: blockAt(BLOCK_X, REST_BLOCK),
}
const RIDER_ART = render([RIDER(0)], "rider")
const CARD_ART = CARDS.map((_, i) => render([cardSolid(RACK_X, i)], `card${i}`))
const FALLBACK_D = PLASMA_FALLBACK(CHAMBER_X)
const IDLE = `9 stations · ${ART.solids} solids`

function readoutFor(sel: number, s: Live, gl: boolean) {
  switch (sel) {
    case 0:
      return "01 · description matched"
    case 1: {
      const near = GATE_X.reduce((best, x, i) => (Math.abs(x - s.rider) < Math.abs(GATE_X[best]! - s.rider) ? i : best), 0)
      return `02 · gauge ${NAMES[near]} · ${ART.solids} solids`
    }
    case 2:
      return `03 · spring() · ${s.needle.at.toFixed(2)}`
    case 3:
      return `04 · ${PEGS} pegs · ${ART.solids} solids here`
    case 4:
      return `05 · extrude() · h ${s.block.at.toFixed(1)}`
    case 5:
      return `06 · depthOf · card ${s.dealt} of ${CARDS.length}`
    case 6:
      return `07 · glLayer · ${gl ? `arc ${Math.round(s.plasma * 100)}%` : "no WebGL, SVG arc"}`
    case 7:
      return "08 · iso() · az 58° · el 30°"
    case 8:
      return "09 · lines.mjs · line ends 0"
    default:
      return IDLE
  }
}

interface Live {
  sel: number
  age: number
  clock: number
  carriage: number
  rider: number
  needle: Spring
  block: Spring
  dealt: number
  plasma: number
  touring: boolean
  tourAt: number
  holdUntil: number
  inside: boolean
  focused: boolean
  shown: number
}

export function AnatomyBench() {
  const [selected, setSelected] = React.useState(-1)
  const [announce, setAnnounce] = React.useState("")
  const stage = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const carriageRef = React.useRef<SVGGElement>(null)
  const riderRef = React.useRef<SVGGElement>(null)
  const needleRef = React.useRef<SVGPathElement>(null)
  const blockRef = React.useRef<SVGGElement>(null)
  const cardRefs = React.useRef<(SVGGElement | null)[]>([])
  const fallbackRef = React.useRef<SVGPathElement>(null)
  const readout = React.useRef<HTMLSpanElement>(null)
  const layer = React.useRef<PlasmaLayer | null>(null)
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    sel: -1,
    age: 0,
    clock: 0,
    carriage: STATION_X[0]!,
    rider: GATE_X[0]!,
    needle: { at: 0, rate: 0 },
    block: { at: REST_BLOCK, rate: 0 },
    dealt: CARDS.length,
    plasma: 0,
    touring: false,
    tourAt: TOUR_DELAY,
    holdUntil: 0,
    inside: false,
    focused: false,
    shown: -1,
  })

  const choose = React.useCallback((index: number, byHand: boolean) => {
    const s = live.current
    if (byHand) {
      s.touring = false
      s.holdUntil = s.clock + RESUME
    }
    if (index !== s.sel) {
      s.sel = index
      s.age = 0
      setSelected(index)
      if (byHand) setAnnounce(index >= 0 ? `${STATIONS[index]!.name}: ${STATIONS[index]!.object}. ${STATIONS[index]!.cite}` : "")
    }
    kickRef.current()
  }, [])

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0
    const block = blockRef.current
    const blockPaths = block ? Array.from(block.querySelectorAll("path")) : []

    if (canvas.current) {
      layer.current = plasmaLayer(canvas.current, P, [WIDTH, HEIGHT], [CHAMBER_X, -15, CHAMBER.gap[0]], [CHAMBER_X, -15, CHAMBER.gap[1]], PLASMA_BOX(CHAMBER_X))
      if (layer.current) node.setAttribute("data-gl", "")
    }

    const draw = (s: Live) => {
      carriageRef.current?.setAttribute("transform", k.translateAlong(P, [s.carriage, 0, 0]))
      riderRef.current?.setAttribute("transform", k.translateAlong(P, [GATE_CX + s.rider, 0, 0]))
      needleRef.current?.setAttribute("d", needleAt(DIAL_CX, s.needle.at))
      if (blockPaths.length === 8) {
        const paths = blockAt(BLOCK_X, s.block.at)
        const ds = [paths.fill, ...paths.shades, paths.top, paths.crease, paths.outline]
        blockPaths.forEach((path, i) => path.setAttribute("d", ds[i] ?? ""))
      }
      fallbackRef.current?.setAttribute("opacity", s.plasma.toFixed(3))
      if (readout.current) {
        const text = readoutFor(s.sel, s, Boolean(layer.current))
        if (readout.current.textContent !== text) readout.current.textContent = text
      }
    }

    const tick = (now: number) => {
      const s = live.current
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = still.matches
      s.clock += dt
      s.age += dt
      if (!calm && !s.touring && !s.inside && !s.focused && s.clock >= s.holdUntil && s.clock >= TOUR_DELAY) {
        s.touring = true
        s.tourAt = s.clock
      }
      if (s.touring && s.clock - s.tourAt >= (s.sel < 0 ? 0 : DWELL)) {
        s.tourAt = s.clock
        const next = (s.sel + 1) % STATIONS.length
        s.sel = next
        s.age = 0
        setSelected(next)
      }
      const sel = s.sel
      s.carriage = follow(s.carriage, STATION_X[Math.max(0, sel)]!, dt, 0.3, calm)
      const riderTarget = sel === 1 && !calm ? (s.age < 0.9 ? GATE_X[2]! : s.age < 1.6 ? GATE_X[1]! : GATE_X[0]!) : GATE_X[0]!
      s.rider = follow(s.rider, riderTarget, dt, 0.18, calm)
      const needleDone = spring(s.needle, sel === 2 ? 0.62 : 0, dt, 90, 7, calm)
      const blockDone = spring(s.block, sel === 4 ? BLOCK_MAX : REST_BLOCK, dt, 60, 11, calm)
      let dealing = false
      let dealt = 0
      CARDS.forEach((_, i) => {
        const p = sel === 5 && !calm ? smooth((s.age - 0.25 - i * 0.34) / 0.42) : 1
        if (p < 1) dealing = true
        if (p >= 1) dealt += 1
        const g = cardRefs.current[i]
        if (g) {
          if (p >= 1) {
            g.removeAttribute("transform")
            g.removeAttribute("opacity")
          } else {
            g.setAttribute("transform", k.translateAlong(P, [0, 0, (1 - p) * 14]))
            g.setAttribute("opacity", Math.min(1, p * 3).toFixed(3))
          }
        }
      })
      s.dealt = dealt
      s.plasma = follow(s.plasma, sel === 6 ? 1 : 0, dt, 0.35, calm)
      draw(s)
      const gl = layer.current
      if (gl) gl.draw(calm ? 3.7 : s.clock, s.plasma)
      const moving =
        s.touring || (sel === 1 && s.age < 1.8) || !needleDone || !blockDone || dealing || s.carriage !== STATION_X[Math.max(0, sel)] || s.rider !== riderTarget || (s.plasma > 0.002 && !calm) || (s.plasma !== (sel === 6 ? 1 : 0))
      const waiting = !calm && !s.touring && s.clock < Math.max(s.holdUntil, TOUR_DELAY) + 0.1
      frame.current = visible && (moving || waiting) ? requestAnimationFrame(tick) : 0
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
    const onScheme = () => kick()
    still.addEventListener("change", onScheme)
    return () => {
      observer.disconnect()
      still.removeEventListener("change", onScheme)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      layer.current?.dispose()
      layer.current = null
    }
  }, [])

  const stationOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-st]")
    return el ? Number(el.getAttribute("data-st")) : -1
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    const index = stationOf(event.target)
    if (index >= 0) choose(index, true)
  }
  const onPointerDown = (event: React.PointerEvent) => {
    const index = stationOf(event.target)
    if (index >= 0) choose(index, true)
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const s = live.current
    const from = Math.max(0, s.sel)
    let next = -2
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = s.sel < 0 ? 0 : Math.min(STATIONS.length - 1, from + 1)
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, from - 1)
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = STATIONS.length - 1
    else if (event.key === "Escape") next = -1
    if (next === -2) return
    event.preventDefault()
    choose(next, true)
  }

  const station = selected >= 0 ? STATIONS[selected]! : null

  return (
    <figure className="anm not-prose my-8" data-focus={selected >= 0 ? "" : undefined}>
      <style>{CSS}</style>
      <div className="anm-plate">
        <span className="anm-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="anm-corner" data-c="title" aria-hidden="true">
          Anatomy, by Anatomy
        </span>
        <span className="anm-corner" data-c="hint" aria-hidden="true">
          Hover, tap or ← →
        </span>
        <span className="anm-corner" data-c="readout" ref={readout} aria-hidden="true">
          {IDLE}
        </span>
        <div
          ref={stage}
          className="anm-stage"
          tabIndex={0}
          role="slider"
          aria-label="The Anatomy skill drawn as a bench of nine stations. Arrow keys move the carriage from station to station."
          aria-valuemin={1}
          aria-valuemax={STATIONS.length}
          aria-valuenow={selected >= 0 ? selected + 1 : 1}
          aria-valuetext={station ? `Station ${station.id} of 9: ${station.name}, ${station.object}. ${station.cite}` : "No station selected"}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerEnter={() => {
            live.current.inside = true
            live.current.touring = false
          }}
          onPointerLeave={() => {
            live.current.inside = false
            live.current.holdUntil = live.current.clock + RESUME
            kickRef.current()
          }}
          onFocus={() => {
            live.current.focused = true
            live.current.touring = false
          }}
          onBlur={() => {
            live.current.focused = false
            live.current.holdUntil = live.current.clock + RESUME
            kickRef.current()
          }}
          onKeyDown={onKeyDown}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="An isometric bench on four feet. Nine stations stand in a row behind a rail: a hopper, three gauge blocks, a dial gauge, a tray of forty pegs, an extrusion press, a rack of five cards, a glass plasma chamber, a copy stand over a framed card, and a loupe over a test card. A carriage carrying a card rides the rail in front of them." focusable="false">
            <g key="base">{render(ART.base, "b")}</g>
            {ART.stations.map((st, i) => (
              <g key={`st${i}`} className="anm-st" data-st={i} data-on={selected === i ? "" : undefined}>
                {render(st.back, `s${i}b`)}
                {i === 1 ? (
                  <g ref={riderRef} transform={REST.rider}>
                    {RIDER_ART}
                  </g>
                ) : null}
                {i === 2 ? <path ref={needleRef} className="ln t-hi" d={REST.needle} style={{ strokeWidth: 1.1 }} /> : null}
                {i === 4 ? (
                  <g ref={blockRef}>
                    <path className="f" d={REST.block.fill} />
                    {REST.block.shades.map((d, shade) => (
                      <path key={shade} className={`s${shade}`} d={d} />
                    ))}
                    <path className="tp" d={REST.block.top} />
                    <path className="ln t-lo" d={REST.block.crease} />
                    <path className="ln t-hi" d={REST.block.outline} />
                  </g>
                ) : null}
                {i === 5
                  ? CARD_ART.map((art, c) => (
                      <g
                        key={`card${c}`}
                        ref={(el) => {
                          cardRefs.current[c] = el
                        }}
                      >
                        {art}
                      </g>
                    ))
                  : null}
                {i === 6 ? <path ref={fallbackRef} className="anm-fallback" d={FALLBACK_D} opacity={0} /> : null}
                {render(st.front, `s${i}f`)}
              </g>
            ))}
            <g key="rail">{render(ART.rail, "r")}</g>
          </svg>
          <canvas ref={canvas} className="anm-layer anm-gl" aria-hidden="true" />
          <svg className="anm-layer" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
            <g className="anm-st" data-on={selected === 6 ? "" : undefined}>
              {render(ART.chamberFront, "cf")}
            </g>
            <g ref={carriageRef} transform={REST.carriage}>
              {render(ART.carriage, "c")}
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="anm-legend text-muted-foreground">
        <div className="anm-list" role="group" aria-label="Stations">
          {STATIONS.map((st, i) => (
            <button key={st.id} type="button" className="anm-btn" aria-pressed={selected === i} onClick={() => choose(selected === i ? -1 : i, true)}>
              <span>{String(st.id).padStart(2, "0")}</span>
              <span>{st.name}</span>
            </button>
          ))}
        </div>
        <div className="anm-detail">
          {station ? (
            <>
              <strong className="text-foreground">
                {String(station.id).padStart(2, "0")} {station.name}
              </strong>
              {" "}
              <span>({station.object}).</span>{" "}
              <code>{station.cite}</code>
              <br />
              {station.does}
            </>
          ) : (
            <>
              The skill as a machine: nine stations in the order SKILL.md works, and a carriage carrying the one-line prompt past them. {ART.solids} solids, all from a port of
              the skill&apos;s own kit. Pick a station to see which file and function it stands for.
            </>
          )}
        </div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </figcaption>
    </figure>
  )
}
