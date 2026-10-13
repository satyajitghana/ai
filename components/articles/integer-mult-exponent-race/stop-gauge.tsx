"use client"

// The kappa race as a bench stop gauge, drawn with the vendored Anatomy skill
// (brand-crew/skills/isometric-figures) through the site's dmath port of its
// kit. Two collars on two rods hold each network's certified saving; a
// carriage pulled by a constant-force band rests on the nearer one, because
// the assembly only ever sees the weaker network. The lit collar is the wall.
// Numbers come from stop-gauge-model.ts, which holds the article's values.
//
// Live loop per references/motion.md: dt from rAF clamped to 1/30 s, the
// collars eased toward their targets, the carriage at the nearer collar every
// frame (it cannot pass either), stop when settled or offscreen, jump under
// reduced motion. The server render is the rest pose (#467).

import * as React from "react"
import { mexp } from "@/lib/dmath"
import { ART, HEIGHT, WIDTH, bandAt, moveTo, needleAt, xOf, type Item } from "./stop-gauge-geometry"
import { MILESTONES, REST_INDEX, bindingOf, kappaText, mainText, per1e4, sideText, type Milestone, type Side } from "./stop-gauge-model"

const CSS = `
.kgx{
  --a-card:#fbfbfa;--a-paper:#fbfbfa;--a-top:#ffffff;
  --a-s0:#dcdcd9;--a-s1:#e5e5e2;--a-s2:#ededea;--a-s3:#f4f4f1;
  --a-lit-top:#ffffff;--a-lit-shade:#eeeeeb;
  --a-hi0:#26262a;--a-mid0:#8a8a8f;--a-lo0:#b4b4b8;--a-faint0:#d4d4d6;--a-lit0:#000000;
  --a-halo:#8a8a80;--a-halo-o:.32;--a-dot:#3a3a3e;--a-text:#57575a;--a-muted:#8c8c90;
  --a-hi:var(--a-hi0);--a-mid:var(--a-mid0);--a-lo:var(--a-lo0);--a-faint:var(--a-faint0);
  --a-sh0:var(--a-s0);--a-sh1:var(--a-s1);--a-sh2:var(--a-s2);--a-sh3:var(--a-s3);--a-tp:var(--a-top);
}
.dark .kgx{
  --a-card:#131313;--a-paper:#131313;--a-top:#1c1c1c;
  --a-s0:#0f0f0f;--a-s1:#121212;--a-s2:#151515;--a-s3:#181818;
  --a-lit-top:#262626;--a-lit-shade:#1d1d1d;
  --a-hi0:#d4d4d4;--a-mid0:#6a6a6a;--a-lo0:#3e3e3e;--a-faint0:#2a2a2a;--a-lit0:#ffffff;
  --a-halo:#050505;--a-halo-o:.9;--a-dot:#e6e6e6;--a-text:#a3a3a3;--a-muted:#6e6e6e;
}
.kgx .kgx-stop[data-on]{--a-hi:var(--a-lit0);--a-mid:var(--a-hi0);--a-tp:var(--a-lit-top);--a-sh0:var(--a-lit-shade);--a-sh1:var(--a-lit-shade);--a-sh2:var(--a-lit-shade);--a-sh3:var(--a-lit-shade)}
.kgx .kgx-stop[data-on] .ln{stroke-width:.9px}
.kgx-plate{position:relative;padding:44px 16px 46px;background:var(--a-card);box-shadow:0 0 0 1px var(--a-mid0)}
.kgx-corner{position:absolute;color:var(--a-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.kgx-corner[data-c="fig"]{top:16px;left:16px;color:var(--a-text)}
.kgx-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.kgx-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.kgx-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--a-text);font-variant-numeric:tabular-nums}
.kgx-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer}
.kgx-stage:focus-visible{outline:1px solid var(--a-muted);outline-offset:6px}
.kgx-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.kgx svg path,.kgx svg circle{vector-effect:non-scaling-stroke}
.kgx .f{fill:var(--a-paper);stroke:none}
.kgx .s0{fill:var(--a-sh0)}.kgx .s1{fill:var(--a-sh1)}.kgx .s2{fill:var(--a-sh2)}.kgx .s3{fill:var(--a-sh3)}
.kgx .tp{fill:var(--a-tp)}
.kgx .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.kgx .t-hi{stroke:var(--a-hi)}.kgx .t-mid{stroke:var(--a-mid)}.kgx .t-lo{stroke:var(--a-lo)}.kgx .t-faint{stroke:var(--a-faint)}.kgx .t-lit{stroke:var(--a-lit0)}
.kgx .dt circle{fill:var(--a-dot);stroke:none}
.kgx .dt.t-hi circle{opacity:.85}.kgx .dt.t-mid circle{opacity:.45}.kgx .dt.t-lo circle{opacity:.22}
.kgx .halo{fill:var(--a-halo);stroke:none;filter:blur(9px);opacity:var(--a-halo-o);transform:translateY(3px)}
.kgx-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.kgx-keys{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px}
.kgx-keys span{display:inline-flex;align-items:center;gap:6px}
.kgx-keys i{display:inline-block;width:10px;height:10px;border:1px solid currentColor;border-radius:2px;opacity:.7}
.kgx-keys i[data-k="lit"]{background:currentColor;opacity:1}
.kgx-keys i[data-k="pin"]{border-radius:50%;width:7px;height:7px}
.kgx-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
@media (max-width:560px){.kgx-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kgx .kgx-stop[data-on] .ln{stroke-width:.9px}
.kgx-plate{padding:40px 6px 64px}.kgx-corner[data-c="hint"]{bottom:36px}}
.kgx-btn{display:flex;gap:6px;align-items:baseline;text-align:left;padding:4px 6px;border:1px solid transparent;border-radius:4px;color:inherit;opacity:.72;font-size:12.5px;line-height:1.3}
.kgx-btn:hover{opacity:1}
.kgx-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.kgx-btn span:first-child{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
.kgx-detail{min-height:6.2em}
`

function render(items: Item[], prefix: string) {
  return items.map((item, index) => {
    const key = `${prefix}-${index}`
    if (item.kind === "halo") return <path key={key} className="halo" d={item.d} />
    if (item.kind === "line") return item.d ? <path key={key} className={`ln t-${item.tone}`} d={item.d} style={item.width ? { strokeWidth: item.width } : undefined} /> : null
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

const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-4 ? target : next
}

const DWELL = 3.6
const TOUR_DELAY = 1.4
const RESUME = 3.6

const SIDE_NAME: Record<Side, string> = { bit: "bit", complex: "complex" }
const readoutOf = (m: Milestone) => `${m.name} · ${SIDE_NAME[bindingOf(m)]} binds · κ ${kappaText(m)}`
const valueText = (m: Milestone) =>
  `${m.name}, ${m.when}. Bit network ${sideText(m, "bit")}, complex network ${sideText(m, "complex")}. The ${bindingOf(m)} side binds, and κ = ${m.assembly} = ${kappaText(m)}. main ${mainText(m)}.`

const REST_M = MILESTONES[REST_INDEX]!
const xAt = (value: number) => xOf(per1e4(value))
const REST = {
  bit: xAt(REST_M.bit),
  complex: xAt(REST_M.complex),
  main: xAt(REST_M.main),
}
const REST_CARRIAGE = Math.min(REST.bit, REST.complex)
const REST_BAND = bandAt(REST_CARRIAGE)
const turnOf = (x: number) => {
  const v = (x - xOf(0)) / (xOf(1) - xOf(0))
  return v - Math.floor(v)
}

interface Live {
  sel: number
  clock: number
  bit: number
  complex: number
  main: number
  wall: Side
  touring: boolean
  tourAt: number
  holdUntil: number
  inside: boolean
  focused: boolean
}

export function StopGauge() {
  const [selected, setSelected] = React.useState(REST_INDEX)
  const [announce, setAnnounce] = React.useState("")
  const stage = React.useRef<HTMLDivElement>(null)
  const carriageRef = React.useRef<SVGGElement>(null)
  const topRef = React.useRef<SVGGElement>(null)
  const needleRef = React.useRef<SVGPathElement>(null)
  const bandRef = React.useRef<SVGGElement>(null)
  const stopRefs = React.useRef<Record<Side, SVGGElement | null>>({ bit: null, complex: null })
  const pinRef = React.useRef<SVGGElement>(null)
  const readout = React.useRef<HTMLSpanElement>(null)
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    sel: REST_INDEX,
    clock: 0,
    bit: REST.bit,
    complex: REST.complex,
    main: REST.main,
    wall: bindingOf(REST_M),
    touring: false,
    tourAt: 0,
    holdUntil: 0,
    inside: false,
    focused: false,
  })

  const choose = React.useCallback((index: number, byHand: boolean) => {
    const s = live.current
    if (byHand) {
      s.touring = false
      s.holdUntil = s.clock + RESUME
    }
    if (index !== s.sel) {
      s.sel = index
      setSelected(index)
      if (byHand) setAnnounce(valueText(MILESTONES[index]!))
    }
    kickRef.current()
  }, [])

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0
    const bandPaths = bandRef.current ? Array.from(bandRef.current.querySelectorAll("path")) : []

    const draw = (s: Live) => {
      const xc = Math.min(s.bit, s.complex)
      const move = moveTo(xc)
      carriageRef.current?.setAttribute("transform", move)
      topRef.current?.setAttribute("transform", move)
      needleRef.current?.setAttribute("d", needleAt(turnOf(xc)))
      stopRefs.current.bit?.setAttribute("transform", moveTo(s.bit))
      stopRefs.current.complex?.setAttribute("transform", moveTo(s.complex))
      pinRef.current?.setAttribute("transform", moveTo(s.main))
      if (bandPaths.length === 8) {
        const paths = bandAt(xc)
        const ds = [paths.fill, ...paths.shades, paths.top, paths.crease, paths.outline]
        bandPaths.forEach((path, i) => path.setAttribute("d", ds[i] ?? ""))
      }
      const wall: Side = s.bit <= s.complex ? "bit" : "complex"
      if (wall !== s.wall) {
        s.wall = wall
        for (const side of ["bit", "complex"] as Side[]) {
          const g = stopRefs.current[side]
          if (!g) continue
          if (side === wall) g.setAttribute("data-on", "")
          else g.removeAttribute("data-on")
        }
      }
    }

    const tick = (now: number) => {
      const s = live.current
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = still.matches
      s.clock += dt
      if (!calm && !s.touring && !s.inside && !s.focused && s.clock >= s.holdUntil && s.clock >= TOUR_DELAY) {
        s.touring = true
        s.tourAt = s.clock
        s.sel = 0
        setSelected(0)
      }
      if (s.touring && s.clock - s.tourAt >= DWELL) {
        s.tourAt = s.clock
        const next = (s.sel + 1) % MILESTONES.length
        s.sel = next
        setSelected(next)
      }
      const m = MILESTONES[s.sel]!
      const target = { bit: xAt(m.bit), complex: xAt(m.complex), main: xAt(m.main) }
      s.bit = follow(s.bit, target.bit, dt, 0.42, calm)
      s.complex = follow(s.complex, target.complex, dt, 0.42, calm)
      s.main = follow(s.main, target.main, dt, 0.5, calm)
      draw(s)
      const settled = s.bit === target.bit && s.complex === target.complex && s.main === target.main
      if (readout.current) {
        // the reading belongs to the selected milestone; the collars ease toward it
        const text = readoutOf(m)
        if (readout.current.textContent !== text) readout.current.textContent = text
      }
      const waiting = !calm && !s.touring && s.clock < Math.max(s.holdUntil, TOUR_DELAY) + 0.1
      frame.current = visible && (s.touring || !settled || waiting) ? requestAnimationFrame(tick) : 0
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
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const s = live.current
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(MILESTONES.length - 1, s.sel + 1)
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, s.sel - 1)
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = MILESTONES.length - 1
    if (next < 0) return
    event.preventDefault()
    choose(next, true)
  }

  const m = MILESTONES[selected]!
  const restWall = bindingOf(REST_M)

  return (
    <figure className="kgx not-prose my-8">
      <style>{CSS}</style>
      <div className="kgx-plate">
        <span className="kgx-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="kgx-corner" data-c="title" aria-hidden="true">
          Weaker network stops κ
        </span>
        <span className="kgx-corner" data-c="hint" aria-hidden="true">
          Tap or ← →
        </span>
        <span className="kgx-corner" data-c="readout" ref={readout} aria-hidden="true">
          {readoutOf(REST_M)}
        </span>
        <div
          ref={stage}
          className="kgx-stage"
          tabIndex={0}
          role="slider"
          aria-label="Stop gauge for the κ race. Arrow keys step through ten witnesses from 9 to 13 October."
          aria-valuemin={1}
          aria-valuemax={MILESTONES.length}
          aria-valuenow={selected + 1}
          aria-valuetext={valueText(m)}
          onPointerDown={() => choose((live.current.sel + 1) % MILESTONES.length, true)}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return
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
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="An isometric bench stop gauge. Two parallel rods run between end brackets, the bit network's rod in front and the complex network's behind. Each rod carries a clamp collar set at that network's certified saving. A carriage rides both rods, pulled toward larger savings by a steel band from a spring drum, and rests against the nearer collar, which is lit. An index foot on the carriage reads the saving on a ruler marked in units of 10 to the minus 4, with a long line at 10 to the minus 3, and a pin on the ruler marks main."
            focusable="false"
          >
            <g key="base">{render(ART.base, "b")}</g>
            <g key="pin" ref={pinRef} transform={moveTo(REST.main)}>
              {render(ART.mainPin, "p")}
            </g>
            <g key="lb">{render(ART.leftBracket, "lb")}</g>
            <g key="br">{render(ART.backRod, "br")}</g>
            <g key="dl">{render(ART.drumLower, "dl")}</g>
            <g key="band" ref={bandRef}>
              <path className="f" d={REST_BAND.fill} />
              {REST_BAND.shades.map((d, shade) => (
                <path key={shade} className={`s${shade}`} d={d} />
              ))}
              <path className="tp" d={REST_BAND.top} />
              <path className="ln t-faint" d={REST_BAND.crease} />
              <path className="ln t-mid" d={REST_BAND.outline} />
            </g>
            <g key="du">{render(ART.drumUpper, "du")}</g>
            <g key="fr">{render(ART.frontRod, "fr")}</g>
            <g key="cb" ref={carriageRef} transform={moveTo(REST_CARRIAGE)}>
              {render(ART.carriageBody, "cb")}
            </g>
            {(["complex", "bit"] as Side[]).map((side) => (
              <g
                key={side}
                className="kgx-stop"
                data-on={restWall === side ? "" : undefined}
                ref={(el) => {
                  stopRefs.current[side] = el
                }}
                transform={moveTo(REST[side])}
              >
                {render(ART.stops[side], side)}
              </g>
            ))}
            <g key="rb">{render(ART.rightBracket, "rb")}</g>
            <g key="ct" ref={topRef} transform={moveTo(REST_CARRIAGE)}>
              {render(ART.carriageTop, "ct")}
              <path ref={needleRef} className="ln t-hi" d={needleAt(turnOf(REST_CARRIAGE))} style={{ strokeWidth: 1.1 }} />
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="kgx-legend text-muted-foreground">
        <div className="kgx-keys" aria-hidden="true">
          <span>
            <i data-k="lit" />
            the wall: the collar holding the carriage
          </span>
          <span>
            <i />
            front rod: bit network · back rod: complex network
          </span>
          <span>
            <i data-k="pin" />
            pin on the ruler: main at that moment
          </span>
        </div>
        <div className="kgx-list" role="group" aria-label="Witnesses">
          {MILESTONES.map((w, i) => (
            <button key={w.id} type="button" className="kgx-btn" aria-pressed={selected === i} onClick={() => choose(i, true)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <span>{w.name}</span>
            </button>
          ))}
        </div>
        <div className="kgx-detail">
          <strong className="text-foreground">{m.name}</strong> <span>({m.when}).</span> {m.note}
          <br />
          Bit {sideText(m, "bit")}, complex {sideText(m, "complex")}; κ = {m.assembly} = {kappaText(m)}; main {mainText(m)}.
        </div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </figcaption>
    </figure>
  )
}

