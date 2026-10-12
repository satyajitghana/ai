"use client"

// PersonaPlex's KV ring drawn as a loop deck, with the isometric-figures skill
// (wheresryan22/anatomy, vendored in brand-crew/skills/isometric-figures) and
// its kit as ported in components/articles/anatomy-machine-skill/iso-kit.ts.
// The platter is the temporal transformer's 3,000-frame cache; the stepping
// switch is the 16-step depth transformer. Every number on the card comes from
// loop-model.ts. The server renders the rest pose (the call has just begun);
// the client moves the platter, the wiper and the chip through refs, with dt
// from rAF clamped to 1/30 s, an idle tour, stop-when-offscreen, and jumps to
// targets under reduced motion (references/motion.md).

import * as React from "react"
import { mexp } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import { ART, CHIP_FLOOR, CHIP_FROM, HEIGHT, P, WIDTH, chipAt, tapeAt, wiperAt, type Item } from "./loop-geometry"
import { DEP_Q, FRAME_MS, REST_STOP, STOPS } from "./loop-model"

const CSS = `
.lpd{
  --a-card:#fbfbfa;--a-paper:#fbfbfa;--a-top:#ffffff;
  --a-s0:#dcdcd9;--a-s1:#e5e5e2;--a-s2:#ededea;--a-s3:#f4f4f1;
  --a-lit-top:#ffffff;--a-lit-shade:#eeeeeb;
  --a-hi0:#26262a;--a-mid0:#8a8a8f;--a-lo0:#b4b4b8;--a-faint0:#d4d4d6;--a-lit0:#000000;
  --a-halo:#8a8a80;--a-halo-o:.32;--a-dot:#3a3a3e;--a-text:#57575a;--a-muted:#8c8c90;
  --a-voice:#6a6a70;--a-call:#e4e4e0;--a-sine:#46464b;
  --a-hi:var(--a-hi0);--a-mid:var(--a-mid0);--a-lo:var(--a-lo0);--a-faint:var(--a-faint0);
  --a-sh0:var(--a-s0);--a-sh1:var(--a-s1);--a-sh2:var(--a-s2);--a-sh3:var(--a-s3);--a-tp:var(--a-top);
  --a-prompt:var(--a-lit0);
}
.dark .lpd{
  --a-card:#131313;--a-paper:#131313;--a-top:#1c1c1c;
  --a-s0:#0f0f0f;--a-s1:#121212;--a-s2:#151515;--a-s3:#181818;
  --a-lit-top:#262626;--a-lit-shade:#1d1d1d;
  --a-hi0:#d4d4d4;--a-mid0:#6a6a6a;--a-lo0:#3e3e3e;--a-faint0:#2a2a2a;--a-lit0:#ffffff;
  --a-halo:#050505;--a-halo-o:.9;--a-dot:#e6e6e6;--a-text:#a3a3a3;--a-muted:#6e6e6e;
  --a-voice:#9a9a9e;--a-call:#2c2c2c;--a-sine:#c8c8c8;
}
.lpd[data-depth]{--a-prompt:var(--a-hi0)}
.lpd[data-depth] .lpd-tape{--a-voice:var(--a-mid0)}
.lpd[data-depth] .lpd-sw{--a-hi:var(--a-lit0);--a-mid:var(--a-hi0);--a-tp:var(--a-lit-top);--a-sh0:var(--a-lit-shade);--a-sh1:var(--a-lit-shade);--a-sh2:var(--a-lit-shade);--a-sh3:var(--a-lit-shade)}
.lpd-plate{position:relative;padding:44px 16px 46px;background:var(--a-card);box-shadow:0 0 0 1px var(--a-mid0)}
.lpd-corner{position:absolute;color:var(--a-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.lpd-corner[data-c="fig"]{top:16px;left:16px;color:var(--a-text)}
.lpd-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.lpd-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.lpd-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--a-text);font-variant-numeric:tabular-nums}
.lpd-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer}
.lpd-stage:focus-visible{outline:1px solid var(--a-muted);outline-offset:6px}
.lpd-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.lpd svg path,.lpd svg circle{vector-effect:non-scaling-stroke}
.lpd .f{fill:var(--a-paper);stroke:none}
.lpd .s0{fill:var(--a-sh0)}.lpd .s1{fill:var(--a-sh1)}.lpd .s2{fill:var(--a-sh2)}.lpd .s3{fill:var(--a-sh3)}
.lpd .tp{fill:var(--a-tp)}
.lpd .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.lpd .t-hi{stroke:var(--a-hi)}.lpd .t-mid{stroke:var(--a-mid)}.lpd .t-lo{stroke:var(--a-lo)}.lpd .t-faint{stroke:var(--a-faint)}.lpd .t-lit{stroke:var(--a-lit0)}
.lpd .dt circle{fill:var(--a-dot);stroke:none}
.lpd .dt.t-hi circle{opacity:.85}.lpd .dt.t-mid circle{opacity:.45}.lpd .dt.t-lo circle{opacity:.22}
.lpd .halo{fill:var(--a-halo);stroke:none;filter:blur(9px);opacity:var(--a-halo-o);transform:translateY(3px)}
.lpd .tape-call{fill:var(--a-call);stroke:none}
.lpd .tape-voice{fill:var(--a-voice);stroke:none}
.lpd .tape-text{fill:var(--a-prompt);stroke:none}
.lpd .tape-sine{fill:var(--a-sine);stroke:none}
.lpd .tape-index{stroke:var(--a-hi);stroke-width:1px;fill:none;stroke-linecap:round}
.lpd .wiper{stroke-width:1.3px}
.lpd-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.lpd-list{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
@media (max-width:640px){.lpd-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.lpd-plate{padding:40px 4px 64px}.lpd-corner[data-c="hint"]{bottom:36px}.lpd-stage>svg{width:112%;margin-left:-6%}.lpd-plate{overflow:hidden}}
.lpd-btn{display:flex;gap:6px;align-items:baseline;text-align:left;padding:4px 6px;border:1px solid transparent;border-radius:4px;color:inherit;opacity:.72;font-size:12.5px;line-height:1.3}
.lpd-btn:hover{opacity:1}
.lpd-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.lpd-btn span:first-child{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
.lpd-keys{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px}
.lpd-keys span{display:inline-flex;align-items:center;gap:6px}
.lpd-keys i{display:inline-block;width:14px;height:6px;border-radius:1px}
.lpd-detail{min-height:4.8em}
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

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-3 ? target : next
}

const DEPTH_STOP = STOPS.findIndex((s) => s.depth)
const TOUR_DELAY = 1.4
const RESUME = 3.6
const DWELL = 3.4
const SLOT = 0.3 // seconds the wiper spends on each contact
const SWEEP = DEP_Q * SLOT
const RETURN = 0.6
const CYCLE = SWEEP + RETURN
const FALL = 0.16
const GRAVITY = (2 * (CHIP_FROM[2] - CHIP_FLOOR)) / (FALL * FALL)
const TURNING = `turning · one frame per ${FRAME_MS} ms`
const REST_WRITTEN = STOPS[REST_STOP]!.written
const REST_TAPE = tapeAt(REST_WRITTEN)
const REST_WIPER = wiperAt(0)
const CHIP = chipAt(CHIP_FROM[0], CHIP_FROM[1], CHIP_FROM[2])
const CHIP_ART = render([{ kind: "solid", paths: CHIP, tone: "hi", crease: "lo" }], "chip")

// The wiper's step position and the chip's drop height at time `age` into the
// depth stop. Steps 0 to 7 feed the head; at 8 to 15 a chip falls in the bin.
function depthAt(age: number) {
  const u = age % CYCLE
  if (u >= SWEEP) return { position: (DEP_Q - 1) * (1 - smooth((u - SWEEP) / RETURN)), drop: -1, fade: 0 }
  const step = Math.floor(u / SLOT)
  const t = u - step * SLOT
  const position = step < DEP_Q - 1 ? step + smooth((t / SLOT - 0.62) / 0.38) : step
  if (step < 8) return { position, drop: -1, fade: 0 }
  const z = Math.max(CHIP_FLOOR, CHIP_FROM[2] - 0.5 * GRAVITY * t * t)
  const fade = smooth(t / 0.04) * (1 - smooth((t - SLOT + 0.09) / 0.08))
  return { position, drop: CHIP_FROM[2] - z, fade }
}

interface Tween {
  from: number
  to: number
  at: number
  dur: number
}

interface Live {
  sel: number
  age: number
  clock: number
  written: number
  tween: Tween | null
  wiper: number
  touring: boolean
  tourAt: number
  holdUntil: number
  inside: boolean
  focused: boolean
}

export function LoopDeck() {
  const [selected, setSelected] = React.useState(REST_STOP)
  const [announce, setAnnounce] = React.useState("")
  const stage = React.useRef<HTMLDivElement>(null)
  const voiceRef = React.useRef<SVGPathElement>(null)
  const textRef = React.useRef<SVGPathElement>(null)
  const callRef = React.useRef<SVGPathElement>(null)
  const sineRef = React.useRef<SVGPathElement>(null)
  const indexRef = React.useRef<SVGPathElement>(null)
  const screwRefs = React.useRef<(SVGCircleElement | null)[]>([])
  const wiperRef = React.useRef<SVGPathElement>(null)
  const tipRef = React.useRef<SVGCircleElement>(null)
  const chipRef = React.useRef<SVGGElement>(null)
  const readout = React.useRef<HTMLSpanElement>(null)
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    sel: REST_STOP,
    age: 0,
    clock: 0,
    written: REST_WRITTEN,
    tween: null,
    wiper: 0,
    touring: false,
    tourAt: TOUR_DELAY,
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
      s.age = 0
      const to = STOPS[index]!.written
      if (to !== s.written) {
        const span = Math.abs(to - s.written)
        s.tween = { from: s.written, to, at: s.clock, dur: 0.7 + 1.9 * Math.min(1, span / 3000) }
      }
      setSelected(index)
      if (byHand) setAnnounce(`${STOPS[index]!.name}. ${STOPS[index]!.readout}`)
    }
    kickRef.current()
  }, [])

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0
    let drawn = REST_WRITTEN

    const drawTape = (written: number) => {
      if (written === drawn) return
      drawn = written
      const t = tapeAt(written)
      voiceRef.current?.setAttribute("d", t.voice)
      textRef.current?.setAttribute("d", t.text)
      callRef.current?.setAttribute("d", t.call)
      sineRef.current?.setAttribute("d", t.sine)
      indexRef.current?.setAttribute("d", t.index)
      t.screws.forEach(([x, y], i) => {
        const c = screwRefs.current[i]
        if (c) {
          c.setAttribute("cx", (Math.round(x * 10) / 10).toString())
          c.setAttribute("cy", (Math.round(y * 10) / 10).toString())
        }
      })
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
      const dwell = s.sel === DEPTH_STOP ? CYCLE + 0.4 : DWELL
      if (s.touring && !s.tween && s.clock - s.tourAt >= dwell) {
        s.tourAt = s.clock
        choose((s.sel + 1) % STOPS.length, false)
      }
      const tw = s.tween
      if (tw) {
        const p = calm ? 1 : (s.clock - tw.at) / tw.dur
        s.written = tw.from + (tw.to - tw.from) * smooth(p)
        if (p >= 1) {
          s.written = tw.to
          s.tween = null
          if (s.touring) s.tourAt = s.clock
        }
      }
      drawTape(Math.round(s.written * 4) / 4)

      const depth = s.sel === DEPTH_STOP
      let drop = -1
      let fade = 0
      if (depth && !calm) {
        const d = depthAt(s.age)
        s.wiper = d.position
        drop = d.drop
        fade = d.fade
      } else s.wiper = follow(s.wiper, depth ? 11 : 0, dt, 0.18, calm)
      const w = wiperAt(s.wiper)
      wiperRef.current?.setAttribute("d", w.d)
      tipRef.current?.setAttribute("cx", (Math.round(w.tip[0] * 10) / 10).toString())
      tipRef.current?.setAttribute("cy", (Math.round(w.tip[1] * 10) / 10).toString())
      const chip = chipRef.current
      if (chip) {
        if (drop < 0 || fade <= 0.001) chip.setAttribute("opacity", "0")
        else {
          chip.setAttribute("opacity", fade.toFixed(3))
          chip.setAttribute("transform", k.translateAlong(P, [0, 0, -drop]))
        }
      }

      if (readout.current) {
        const text = s.tween ? TURNING : STOPS[s.sel]!.readout
        if (readout.current.textContent !== text) readout.current.textContent = text
      }
      const moving = s.touring || Boolean(s.tween) || (depth && !calm) || s.wiper !== (depth ? 11 : 0)
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
    }
  }, [choose])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const from = live.current.sel
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(STOPS.length - 1, from + 1)
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, from - 1)
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = STOPS.length - 1
    if (next < 0) return
    event.preventDefault()
    choose(next, true)
  }

  const stop = STOPS[selected]!
  const depth = selected === DEPTH_STOP

  return (
    <figure className="lpd not-prose my-8" data-depth={depth ? "" : undefined}>
      <style>{CSS}</style>
      <div className="lpd-plate">
        <span className="lpd-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="lpd-corner" data-c="title" aria-hidden="true">
          The prompt on a loop
        </span>
        <span className="lpd-corner" data-c="hint" aria-hidden="true">
          Tap or ← →
        </span>
        <span className="lpd-corner" data-c="readout" ref={readout} aria-hidden="true">
          {STOPS[REST_STOP]!.readout}
        </span>
        <div
          ref={stage}
          className="lpd-stage"
          tabIndex={0}
          role="slider"
          aria-label="PersonaPlex's KV cache as a loop deck. Arrow keys step through the call: the voice prompt, the role text, the start of the call, the head coming round to the start of the loop, the prompt gone, and the depth steps."
          aria-valuemin={1}
          aria-valuemax={STOPS.length}
          aria-valuenow={selected + 1}
          aria-valuetext={`${stop.name}: ${stop.readout}`}
          onPointerDown={() => choose((live.current.sel + 1) % STOPS.length, true)}
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
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="An isometric deck on four feet. A platter with seventeen concentric tracks turns under a record head on an arm; the outer track is the agent's text, the next eight its audio codebooks, the inner eight the user's. Near the head a short band of the tracks holds the prompt: a voice sample on the agent's audio, the role text on the text track, and a dotted sine on the user's tracks. Wires run to the head from a microphone and from a sixteen-contact stepping switch, whose second eight contacts feed a spout over a bin of discarded chips."
            focusable="false"
          >
            <g key="base">{render(ART.base, "b")}</g>
            <g key="wires">{render(ART.wires, "w")}</g>
            <g key="motor">{render(ART.motor, "m")}</g>
            <g key="platter">{render(ART.platter, "p")}</g>
            <g key="tape" className="lpd-tape">
              <path ref={callRef} className="tape-call" d={REST_TAPE.call} />
              <path ref={voiceRef} className="tape-voice" d={REST_TAPE.voice} />
              <path ref={textRef} className="tape-text" d={REST_TAPE.text} />
              <path ref={sineRef} className="tape-sine" d={REST_TAPE.sine} />
            </g>
            <g key="tracks">{render(ART.tracks, "t")}</g>
            <path key="index" ref={indexRef} className="tape-index" d={REST_TAPE.index} />
            <g key="hub">{render(ART.hub, "h")}</g>
            <g key="screws" className="dt t-mid">
              {REST_TAPE.screws.map(([x, y], i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    screwRefs.current[i] = el
                  }}
                  cx={Math.round(x * 10) / 10}
                  cy={Math.round(y * 10) / 10}
                  r={0.45}
                />
              ))}
            </g>
            <g key="cap">{render(ART.hubCap, "hc")}</g>
            <g key="sw" className="lpd-sw">
              {render(ART.stepper, "s")}
              <path ref={wiperRef} className="ln t-hi wiper" d={REST_WIPER.d} />
              <g className="dt t-hi">
                <circle ref={tipRef} cx={Math.round(REST_WIPER.tip[0] * 10) / 10} cy={Math.round(REST_WIPER.tip[1] * 10) / 10} r={0.7} />
              </g>
            </g>
            <g key="head">{render(ART.head, "hd")}</g>
            <g key="binb">{render(ART.binBack, "bb")}</g>
            <g key="pile">{render(ART.pile, "pl")}</g>
            <g key="spout">{render(ART.spout, "sp")}</g>
            <g key="chip" ref={chipRef} opacity={0}>
              {CHIP_ART}
            </g>
            <g key="binf">{render(ART.binFront, "bf")}</g>
            <g key="mic">{render(ART.mic, "mc")}</g>
          </svg>
        </div>
      </div>
      <figcaption className="lpd-legend text-muted-foreground">
        <div className="lpd-keys" aria-hidden="true">
          <span>
            <i style={{ background: "var(--a-voice)" }} />
            voice prompt
          </span>
          <span>
            <i style={{ background: "var(--a-prompt)" }} />
            role text
          </span>
          <span>
            <i style={{ background: "radial-gradient(circle, var(--a-sine) 40%, transparent 45%) 0 0 / 4px 6px" }} />
            440 Hz sine
          </span>
          <span>
            <i style={{ background: "var(--a-call)", boxShadow: "inset 0 0 0 1px var(--a-lo0)" }} />
            the call
          </span>
        </div>
        <div className="lpd-list" role="group" aria-label="Moments in the call">
          {STOPS.map((st, i) => (
            <button key={st.id} type="button" className="lpd-btn" aria-pressed={selected === i} onClick={() => choose(i, true)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <span>{st.name}</span>
            </button>
          ))}
        </div>
        <div className="lpd-detail">
          <strong className="text-foreground">{stop.name}.</strong> {stop.does}
        </div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </figcaption>
    </figure>
  )
}
