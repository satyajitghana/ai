"use client"

// The AES S-box as a relay bench, drawn with the vendored isometric-figures
// (Anatomy) skill through the site's dmath port of its kit. Eight slide
// switches set the input byte; four relay trays hold one relay per gate of the
// Boyar–Peralta layout, split as Table 2 of Jain's paper splits it (Top, MUL1,
// Inverter, Bottom; square cans are ANDs, round cans XORs); eight lamps show
// S(x); a dial with forty divisions counts gate levels as the signal ripples
// through. The selector racks one of three circuits: the 113-gate baseline,
// the 110 the walks reached and the 106 from the representation sweep. The 32
// AND relays never move, XOR relays leave the trays, and the dial reads 27,
// 38 and 34. All numbers come from relay-cabinet-model.ts.
//
// Loop per the skill's references/motion.md: dt from rAF clamped to 1/30 s,
// exponential follow, stop when offscreen or settled, idle tour after 1.4 s,
// resume 3.6 s after the last touch, targets jump under reduced motion.

import * as React from "react"
import { mexp } from "@/lib/dmath"
import { ART, HEIGHT, HUB, SELECT_ANGLES, WIDTH, knobOffset, needleAt, pointerAt, relayLift, type Item } from "./relay-cabinet-geometry"
import { BLOCKS, INPUTS, LEVEL_SECONDS, ROWS, bitOf, hex, sbox } from "./relay-cabinet-model"

const CSS = `
.rcb{
  --a-card:#fbfbfa;--a-paper:#fbfbfa;--a-top:#ffffff;
  --a-s0:#dcdcd9;--a-s1:#e5e5e2;--a-s2:#ededea;--a-s3:#f4f4f1;
  --a-lit-top:#ffffff;--a-lit-shade:#eeeeeb;
  --a-hi0:#26262a;--a-mid0:#8a8a8f;--a-lo0:#b4b4b8;--a-faint0:#d4d4d6;--a-lit0:#000000;
  --a-halo:#8a8a80;--a-halo-o:.32;--a-dot:#3a3a3e;--a-text:#57575a;--a-muted:#8c8c90;
  --a-hi:var(--a-hi0);--a-mid:var(--a-mid0);--a-lo:var(--a-lo0);--a-faint:var(--a-faint0);
  --a-sh0:var(--a-s0);--a-sh1:var(--a-s1);--a-sh2:var(--a-s2);--a-sh3:var(--a-s3);--a-tp:var(--a-top);
}
.dark .rcb{
  --a-card:#131313;--a-paper:#131313;--a-top:#1c1c1c;
  --a-s0:#0f0f0f;--a-s1:#121212;--a-s2:#151515;--a-s3:#181818;
  --a-lit-top:#262626;--a-lit-shade:#1d1d1d;
  --a-hi0:#d4d4d4;--a-mid0:#6a6a6a;--a-lo0:#3e3e3e;--a-faint0:#2a2a2a;--a-lit0:#ffffff;
  --a-halo:#050505;--a-halo-o:.9;--a-dot:#e6e6e6;--a-text:#a3a3a3;--a-muted:#6e6e6e;
}
.rcb[data-focus] .rcb-bay:not([data-on]){--a-hi:var(--a-mid0);--a-mid:var(--a-lo0);--a-lo:var(--a-faint0)}
.rcb .rcb-bay[data-on]{--a-hi:var(--a-lit0);--a-mid:var(--a-hi0);--a-tp:var(--a-lit-top);--a-sh0:var(--a-lit-shade);--a-sh1:var(--a-lit-shade);--a-sh2:var(--a-lit-shade);--a-sh3:var(--a-lit-shade)}
.rcb .and .tp{fill:var(--a-sh0)}
.rcb .rcb-lamp[data-lit] .tp{fill:var(--a-lit0)}
.rcb .rcb-lamp[data-lit] .ln{stroke:var(--a-lit0)}
.rcb-plate{position:relative;padding:44px 16px 46px;background:var(--a-card);box-shadow:0 0 0 1px var(--a-mid0)}
.rcb-corner{position:absolute;color:var(--a-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.rcb-corner[data-c="fig"]{top:16px;left:16px;color:var(--a-text)}
.rcb-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.rcb-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.rcb-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--a-text);font-variant-numeric:tabular-nums}
.rcb-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer;overflow:hidden}
.rcb-stage:focus-visible{outline:1px solid var(--a-muted);outline-offset:6px}
.rcb-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.rcb svg path,.rcb svg circle{vector-effect:non-scaling-stroke}
.rcb .f{fill:var(--a-paper);stroke:none}
.rcb .s0{fill:var(--a-sh0)}.rcb .s1{fill:var(--a-sh1)}.rcb .s2{fill:var(--a-sh2)}.rcb .s3{fill:var(--a-sh3)}
.rcb .tp{fill:var(--a-tp)}
.rcb .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.rcb .t-hi{stroke:var(--a-hi)}.rcb .t-mid{stroke:var(--a-mid)}.rcb .t-lo{stroke:var(--a-lo)}.rcb .t-faint{stroke:var(--a-faint)}.rcb .t-lit{stroke:var(--a-lit0)}
.rcb .dt circle{fill:var(--a-dot);stroke:none}
.rcb .dt.t-hi circle{opacity:.85}.rcb .dt.t-mid circle{opacity:.45}.rcb .dt.t-lo circle{opacity:.22}
.rcb .halo{fill:var(--a-halo);stroke:none;filter:blur(9px);opacity:var(--a-halo-o);transform:translateY(3px)}
.rcb-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.rcb-row{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
.rcb-row>span{font-family:ui-monospace,monospace;font-size:11px;opacity:.7;margin-right:4px}
.rcb-btn{padding:3px 7px;border:1px solid transparent;border-radius:4px;color:inherit;opacity:.72;font-size:12.5px;line-height:1.3;font-variant-numeric:tabular-nums}
.rcb-btn:hover{opacity:1}
.rcb-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.rcb-detail{min-height:4.7em}
@media (max-width:560px){.rcb-plate{padding:40px 6px 60px}.rcb-corner[data-c="hint"]{bottom:34px}.rcb-stage>svg{width:116%;margin:0 -8%}}
`

function render(items: Item[], prefix: string) {
  return items.map((item, index) => {
    const key = `${prefix}-${index}`
    if (item.kind === "halo") return <path key={key} className="halo" d={item.d} />
    if (item.kind === "line") return item.d ? <path key={key} className={`ln t-${item.tone}`} d={item.d} data-free={item.free ? "" : undefined} /> : null
    if (item.kind === "dots")
      return (
        <g key={key} className={`dt t-${item.tone}`}>
          {item.points.map(([x, y], i) => (
            <circle key={i} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={item.size} />
          ))}
        </g>
      )
    const { paths, tone, crease = "faint", className } = item
    return (
      <g key={key} className={className}>
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

const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-3 ? target : next
}

const REST_ROW = 2
const REST_INPUT = 0
const TOUR: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [0, 2],
  [1, 3],
]
const DWELL = 3.6
const TOUR_DELAY = 1.4
const RESUME = 3.6
const STAGGER = 0.035

const present = (row: number, block: number, xorIndex: number) => xorIndex < 0 || xorIndex < ROWS[row]!.xor[block]!
const outOf = (input: number) => sbox(INPUTS[input]!)
const settledText = (row: number, input: number) => {
  const r = ROWS[row]!
  return `${r.gates} gates · depth ${r.depth} · S(${hex(INPUTS[input]!)}) = ${hex(outOf(input))}`
}
const bayText = (row: number, b: number) => {
  const block = BLOCKS[b]!
  const xor = ROWS[row]!.xor[b]!
  return block.and ? `${block.name} · ${block.and} AND + ${xor} XOR` : `${block.name} · ${xor} XOR`
}

interface Live {
  row: number
  input: number
  bay: number
  clock: number
  presence: number[][]
  due: number[][]
  knobs: number[]
  angle: number
  needle: number
  ripple: "reset" | "count" | "done"
  rippleAt: number
  lit: number
  touring: boolean
  tourAt: number
  tourStep: number
  holdUntil: number
  inside: boolean
  focused: boolean
}

const REST_NEEDLE = needleAt(ROWS[REST_ROW]!.depth)
const REST_POINTER = pointerAt(SELECT_ANGLES[REST_ROW]!)

export function RelayCabinet() {
  const [row, setRow] = React.useState(REST_ROW)
  const [input, setInput] = React.useState(REST_INPUT)
  const [bay, setBay] = React.useState(-1)
  const [announce, setAnnounce] = React.useState("")
  const stage = React.useRef<HTMLDivElement>(null)
  const readout = React.useRef<HTMLSpanElement>(null)
  const needleRef = React.useRef<SVGPathElement>(null)
  const pointerRef = React.useRef<SVGPathElement>(null)
  const relayRefs = React.useRef<(SVGGElement | null)[][]>(ART.relays.map((list) => list.map(() => null)))
  const knobRefs = React.useRef<(SVGGElement | null)[]>([])
  const lampRefs = React.useRef<(SVGGElement | null)[]>([])
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    row: REST_ROW,
    input: REST_INPUT,
    bay: -1,
    clock: 0,
    presence: ART.relays.map((list, b) => list.map((r) => (present(REST_ROW, b, r.xorIndex) ? 1 : 0))),
    due: ART.relays.map((list) => list.map(() => 0)),
    knobs: Array.from({ length: 8 }, (_, i) => bitOf(INPUTS[REST_INPUT]!, i)),
    angle: SELECT_ANGLES[REST_ROW]!,
    needle: ROWS[REST_ROW]!.depth,
    ripple: "done",
    rippleAt: 0,
    lit: outOf(REST_INPUT),
    touring: false,
    tourAt: TOUR_DELAY,
    tourStep: -1,
    holdUntil: 0,
    inside: false,
    focused: false,
  })

  // Change the racked circuit and/or the input byte; restart the ripple.
  const apply = React.useCallback((nextRow: number, nextInput: number) => {
    const s = live.current
    if (nextRow !== s.row) {
      let order = 0
      ART.relays.forEach((list, b) =>
        list.forEach((r, i) => {
          if (present(nextRow, b, r.xorIndex) !== present(s.row, b, r.xorIndex)) s.due[b]![i] = s.clock + STAGGER * order++
        }),
      )
      s.row = nextRow
      setRow(nextRow)
    }
    if (nextInput !== s.input) {
      s.input = nextInput
      setInput(nextInput)
    }
    s.ripple = "reset"
    s.rippleAt = s.clock
    kickRef.current()
  }, [])

  const takeOver = React.useCallback(() => {
    const s = live.current
    s.touring = false
    s.holdUntil = s.clock + RESUME
  }, [])

  const chooseRow = React.useCallback(
    (next: number) => {
      takeOver()
      apply(next, live.current.input)
      const r = ROWS[next]!
      setAnnounce(`${r.gates} gates, depth ${r.depth}`)
    },
    [apply, takeOver],
  )
  const chooseInput = React.useCallback(
    (next: number) => {
      takeOver()
      apply(live.current.row, next)
      setAnnounce(`input ${hex(INPUTS[next]!)}, output ${hex(outOf(next))}`)
    },
    [apply, takeOver],
  )
  const chooseBay = React.useCallback((next: number) => {
    const s = live.current
    if (s.bay === next) return
    s.bay = next
    setBay(next)
    kickRef.current()
  }, [])

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0

    const tick = (now: number) => {
      const s = live.current
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = still.matches
      s.clock += dt
      if (!calm && !s.touring && !s.inside && !s.focused && s.clock >= s.holdUntil && s.clock >= TOUR_DELAY) {
        s.touring = true
        s.tourAt = s.clock - DWELL
      }
      if (s.touring && s.clock - s.tourAt >= DWELL) {
        s.tourAt = s.clock
        s.tourStep = (s.tourStep + 1) % TOUR.length
        const [r, i] = TOUR[s.tourStep]!
        apply(r, i)
      }
      const r = ROWS[s.row]!
      let moving = false

      ART.relays.forEach((list, b) =>
        list.forEach((relay, i) => {
          const target = present(s.row, b, relay.xorIndex) ? 1 : 0
          const p = s.presence[b]![i]!
          if (p === target) return
          if (!calm && s.clock < s.due[b]![i]!) {
            moving = true
            return
          }
          const next = follow(p, target, dt, 0.16, calm)
          s.presence[b]![i] = next
          if (next !== target) moving = true
          const g = relayRefs.current[b]?.[i]
          if (!g) return
          if (next >= 1) {
            g.removeAttribute("transform")
            g.removeAttribute("opacity")
          } else {
            g.setAttribute("transform", relayLift(1 - next))
            g.setAttribute("opacity", next.toFixed(3))
          }
        }),
      )

      const bits = INPUTS[s.input]!
      s.knobs.forEach((k0, i) => {
        const target = bitOf(bits, i)
        if (k0 === target) return
        const next = follow(k0, target, dt, 0.12, calm)
        s.knobs[i] = next
        if (next !== target) moving = true
        knobRefs.current[i]?.setAttribute("transform", knobOffset(next))
      })

      const angle = follow(s.angle, SELECT_ANGLES[s.row]!, dt, 0.14, calm)
      if (angle !== s.angle) {
        s.angle = angle
        pointerRef.current?.setAttribute("d", pointerAt(angle))
        if (angle !== SELECT_ANGLES[s.row]) moving = true
      }

      // The ripple: the needle runs back to zero, then counts one level per
      // LEVEL_SECONDS up to the circuit's depth; the lamps light at the end.
      let needle = s.needle
      if (calm) {
        needle = r.depth
        s.ripple = "done"
      } else if (s.ripple === "reset") {
        needle = follow(needle, 0, dt, 0.08, false)
        if (needle < 0.05) {
          needle = 0
          s.ripple = "count"
          s.rippleAt = s.clock
        }
      } else if (s.ripple === "count") {
        needle = Math.min(r.depth, (s.clock - s.rippleAt) / LEVEL_SECONDS)
        if (needle >= r.depth) s.ripple = "done"
      } else needle = follow(needle, r.depth, dt, 0.1, false)
      if (s.ripple !== "done" || needle !== r.depth) moving = true
      if (needle !== s.needle) {
        s.needle = needle
        needleRef.current?.setAttribute("d", needleAt(needle))
      }
      const lit = s.ripple === "done" ? outOf(s.input) : -1
      if (lit !== s.lit) {
        s.lit = lit
        lampRefs.current.forEach((g, i) => {
          if (!g) return
          if (lit >= 0 && bitOf(lit, i)) g.setAttribute("data-lit", "")
          else g.removeAttribute("data-lit")
        })
      }

      if (readout.current) {
        const text = s.bay >= 0 ? bayText(s.row, s.bay) : s.ripple === "done" ? settledText(s.row, s.input) : `rippling · depth ${r.depth}`
        if (readout.current.textContent !== text) readout.current.textContent = text
      }

      const waiting = !calm && !s.touring && s.clock < Math.max(s.holdUntil, TOUR_DELAY) + 0.1
      frame.current = visible && (moving || s.touring || waiting) ? requestAnimationFrame(tick) : 0
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
    }
  }, [apply])

  const partOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-part]")
    return el ? el.getAttribute("data-part") : null
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    const part = partOf(event.target)
    chooseBay(part?.startsWith("bay") ? Number(part.slice(3)) : -1)
  }
  const onPointerDown = (event: React.PointerEvent) => {
    const part = partOf(event.target)
    if (part === "input") chooseInput((live.current.input + 1) % INPUTS.length)
    else if (part === "select") chooseRow((live.current.row + 1) % ROWS.length)
    else if (part?.startsWith("bay")) {
      takeOver()
      chooseBay(Number(part.slice(3)))
    }
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const s = live.current
    if (event.key === "ArrowRight") chooseRow(Math.min(ROWS.length - 1, s.row + 1))
    else if (event.key === "ArrowLeft") chooseRow(Math.max(0, s.row - 1))
    else if (event.key === "Home") chooseRow(0)
    else if (event.key === "End") chooseRow(ROWS.length - 1)
    else if (event.key === "ArrowDown") chooseInput((s.input + 1) % INPUTS.length)
    else if (event.key === "ArrowUp") chooseInput((s.input + INPUTS.length - 1) % INPUTS.length)
    else if (event.key === "Escape") chooseBay(-1)
    else return
    event.preventDefault()
  }

  const r = ROWS[row]!
  const block = bay >= 0 ? BLOCKS[bay]! : null

  return (
    <figure className="rcb not-prose my-8" data-focus={bay >= 0 ? "" : undefined}>
      <style>{CSS}</style>
      <div className="rcb-plate">
        <span className="rcb-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="rcb-corner" data-c="title" aria-hidden="true">
          The S-box as a relay bench
        </span>
        <span className="rcb-corner" data-c="hint" aria-hidden="true">
          Hover, tap or ← → ↑ ↓
        </span>
        <span className="rcb-corner" data-c="readout" ref={readout} aria-hidden="true">
          {settledText(REST_ROW, REST_INPUT)}
        </span>
        <div
          ref={stage}
          className="rcb-stage"
          tabIndex={0}
          role="slider"
          aria-label="The AES S-box as a relay bench. Left and right arrows rack a different circuit; up and down change the input byte."
          aria-valuemin={1}
          aria-valuemax={ROWS.length}
          aria-valuenow={row + 1}
          aria-valuetext={`${r.gates} gates, depth ${r.depth}. Input ${hex(INPUTS[input]!)} gives ${hex(outOf(input))}.`}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerEnter={() => {
            live.current.inside = true
            live.current.touring = false
          }}
          onPointerLeave={() => {
            live.current.inside = false
            live.current.holdUntil = live.current.clock + RESUME
            chooseBay(-1)
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
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="An isometric bench on four feet. From left to right: a bank of eight slide switches, four relay trays joined by bus strips, a bank of eight lamps and a dial gauge with forty divisions. A rotary selector sits in front of the trays. Square relays are AND gates and round relays XOR gates."
            focusable="false"
          >
            <g key="base">{render(ART.base, "b")}</g>
            <g key="input" data-part="input">
              {render(ART.input, "in")}
              {ART.knobs.map((knob, i) => (
                <g
                  key={`k${i}`}
                  ref={(el) => {
                    knobRefs.current[i] = el
                  }}
                  transform={knobOffset(bitOf(INPUTS[REST_INPUT]!, i))}
                >
                  {render([knob], `k${i}`)}
                </g>
              ))}
            </g>
            {ART.trays.map((tray, b) => (
              <React.Fragment key={`unit${b}`}>
                <g>{render(ART.buses[b]!, `bus${b}`)}</g>
                <g className="rcb-bay" data-part={`bay${b}`} data-on={bay === b ? "" : undefined}>
                  {render(tray, `t${b}`)}
                  {ART.relays[b]!.map((relay, i) => {
                    const on = present(REST_ROW, b, relay.xorIndex)
                    return (
                      <g
                        key={`r${relay.socket}`}
                        ref={(el) => {
                          relayRefs.current[b]![i] = el
                        }}
                        transform={on ? undefined : relayLift(1)}
                        opacity={on ? undefined : 0}
                      >
                        {render([relay.item, relay.cap], `r${b}-${relay.socket}`)}
                      </g>
                    )
                  })}
                </g>
              </React.Fragment>
            ))}
            <g key="bus-out">{render(ART.buses[ART.trays.length]!, "busout")}</g>
            <g key="lamps">
              {render(ART.lampBank, "lb")}
              {ART.lamps.map((lamp, i) => (
                <g
                  key={`l${i}`}
                  className="rcb-lamp"
                  ref={(el) => {
                    lampRefs.current[i] = el
                  }}
                  data-lit={bitOf(outOf(REST_INPUT), i) ? "" : undefined}
                >
                  {render([lamp.bezel, lamp.lens], `l${i}`)}
                </g>
              ))}
            </g>
            <g key="gauge">
              {render(ART.gauge, "g")}
              <path ref={needleRef} className="ln t-lit" d={REST_NEEDLE} style={{ strokeWidth: 1.1 }} />
              <path className="ln t-hi" d={HUB} />
            </g>
            <g key="select" data-part="select">
              {render(ART.selector, "sel")}
              <path ref={pointerRef} className="ln t-hi" d={REST_POINTER} style={{ strokeWidth: 1.1 }} />
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="rcb-legend text-muted-foreground">
        <div className="rcb-row" role="group" aria-label="Circuit">
          <span>circuit</span>
          {ROWS.map((row0, i) => (
            <button key={row0.key} type="button" className="rcb-btn" aria-pressed={row === i} onClick={() => chooseRow(i)}>
              {row0.name}
            </button>
          ))}
        </div>
        <div className="rcb-row" role="group" aria-label="Input byte">
          <span>input</span>
          {INPUTS.map((x, i) => (
            <button key={x} type="button" className="rcb-btn" aria-pressed={input === i} onClick={() => chooseInput(i)}>
              {hex(x)}
            </button>
          ))}
        </div>
        <div className="rcb-detail">
          {block ? (
            <>
              <strong className="text-foreground">{block.name}</strong> {block.does}{" "}
              {block.and ? `${block.and} ANDs in every circuit; XORs ` : "XORs "}
              {ROWS.map((row0) => row0.xor[bay]!).join(" → ")} across the 113, the 110 and the 106.
            </>
          ) : (
            <>
              <strong className="text-foreground">{r.gates} gates</strong> ({r.source}). The same 32 ANDs as the others; the first AND fires at level {r.firstAnd}, and the
              output settles at depth {r.depth}. Hover a tray to see its split.
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
