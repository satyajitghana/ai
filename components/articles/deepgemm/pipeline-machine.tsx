"use client"

// DeepGEMM's SM90 mainloop as a small workshop, drawn with the site's port of
// the isometric-figures (Anatomy) kit. A carriage (TMA) ferries tiles from a
// rack (global memory) into three bins (shared-memory stages); one press (the
// tensor core) strokes four times per 128-element block, each stroke a WGMMA
// over 32 of K, and then moves to the other station (the second math
// warpgroup) while the first pulls its lever: the partial sum leaves the
// 14-bit accumulator for an FP32 register, scaled on the way.
//
// Everything that moves reads poseAt(t) in pipeline-model.ts. The server
// renders the rest pose at REST_T; the loop starts in an effect, writes
// attributes through refs, stops offscreen, and does not autoplay under
// reduced motion.

import * as React from "react"
import { mexp } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { SolidPaths } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { ART, BIN_TILE_Y, BIN_X, CARRIAGE_TILE, HEAD, HEIGHT, P, PAD, RACK_X, STATION_X, TILE_Z, WIDTH, leverAt, needleAt, padBottom, ramAt, tileSolid, type Item, type Part } from "./pipeline-geometry"
import { ACC_BITS, BLOCK_K, FP32_BITS, REST_T, WGMMA_K, nextStep, poseAt, prevStep, type Pose } from "./pipeline-model"

const PARTS: { id: Part; name: string; does: string }[] = [
  { id: "rack", name: "Rack", does: "Global memory. The A and B tiles of the GEMM live here. A copy only reads them, so the rack never empties." },
  {
    id: "tma",
    name: "Carriage",
    does: "The TMA copy engine. One thread of one TMA warp issues asynchronous copies into shared memory ahead of the maths. Those warps get 40 registers.",
  },
  { id: "bins", name: "Bins", does: "Shared-memory stages. Each holds the next 128 elements of K, and is refilled only after both warpgroups have used it." },
  {
    id: "press",
    name: "Press",
    does: `The tensor core. Each stroke is one WGMMA over ${WGMMA_K} elements of K, so four strokes are one ${BLOCK_K}-element block. It serves one warpgroup at a time.`,
  },
  {
    id: "narrow",
    name: "Small dial",
    does: `The WGMMA accumulator, about ${ACC_BITS} bits. The needle counts how often the running sum has doubled past one product: 5 after one stroke, 7 after four. That many bits sit above every new product and never see it.`,
  },
  {
    id: "lever",
    name: "Lever",
    does: "Promotion, on the CUDA cores: the block's partial sum is multiplied by the activation scale times the weight scale and added into FP32. The small dial goes back to zero.",
  },
  {
    id: "wide",
    name: "Large dial",
    does: `The FP32 running sum, ${FP32_BITS} bits, in the math warps' registers (232 or 248 each). It keeps climbing across the whole K loop, slowly, on a far wider scale.`,
  },
]

const PART_CSS = PARTS.map(({ id }) => `.dgm[data-sel="${id}"] [data-part="${id}"]`).join(",")

const CSS = `
.dgm{
  --d-card:#fbfbfa;--d-paper:#fbfbfa;--d-top:#ffffff;
  --d-s0:#dcdcd9;--d-s1:#e5e5e2;--d-s2:#ededea;--d-s3:#f4f4f1;
  --d-lit-top:#ffffff;--d-lit-shade:#eeeeeb;
  --d-hi0:#26262a;--d-mid0:#8a8a8f;--d-lo0:#b4b4b8;--d-faint0:#d4d4d6;--d-lit0:#000000;
  --d-halo:#8a8a80;--d-halo-o:.32;--d-dot:#3a3a3e;--d-text:#57575a;--d-muted:#8c8c90;
  --d-hi:var(--d-hi0);--d-mid:var(--d-mid0);--d-lo:var(--d-lo0);--d-faint:var(--d-faint0);
  --d-sh0:var(--d-s0);--d-sh1:var(--d-s1);--d-sh2:var(--d-s2);--d-sh3:var(--d-s3);--d-tp:var(--d-top);
}
.dark .dgm{
  --d-card:#131313;--d-paper:#131313;--d-top:#1c1c1c;
  --d-s0:#0f0f0f;--d-s1:#121212;--d-s2:#151515;--d-s3:#181818;
  --d-lit-top:#262626;--d-lit-shade:#1d1d1d;
  --d-hi0:#d4d4d4;--d-mid0:#6a6a6a;--d-lo0:#3e3e3e;--d-faint0:#2a2a2a;--d-lit0:#ffffff;
  --d-halo:#050505;--d-halo-o:.9;--d-dot:#e6e6e6;--d-text:#a3a3a3;--d-muted:#6e6e6e;
}
.dgm .lit{--d-hi:var(--d-lit0);--d-mid:var(--d-hi0);--d-tp:var(--d-lit-top);--d-sh0:var(--d-lit-shade);--d-sh1:var(--d-lit-shade);--d-sh2:var(--d-lit-shade);--d-sh3:var(--d-lit-shade)}
.dgm[data-sel] [data-part]{--d-hi:var(--d-mid0);--d-mid:var(--d-lo0);--d-lo:var(--d-faint0)}
${PART_CSS}{--d-hi:var(--d-lit0);--d-mid:var(--d-hi0);--d-lo:var(--d-lo0);--d-tp:var(--d-lit-top);--d-sh0:var(--d-lit-shade);--d-sh1:var(--d-lit-shade);--d-sh2:var(--d-lit-shade);--d-sh3:var(--d-lit-shade)}
.dgm-plate{position:relative;padding:44px 16px 46px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-mid0)}
.dgm-corner{position:absolute;color:var(--d-muted);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.dgm-corner[data-c="fig"]{top:16px;left:16px;color:var(--d-text)}
.dgm-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.1em}
.dgm-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.1em}
.dgm-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--d-text);font-variant-numeric:tabular-nums}
.dgm-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer}
.dgm-stage:focus-visible{outline:1px solid var(--d-muted);outline-offset:6px}
.dgm-stage>svg{display:block;width:100%;height:auto;overflow:visible}
.dgm svg path,.dgm svg circle{vector-effect:non-scaling-stroke}
.dgm .f{fill:var(--d-paper);stroke:none}
.dgm .s0{fill:var(--d-sh0)}.dgm .s1{fill:var(--d-sh1)}.dgm .s2{fill:var(--d-sh2)}.dgm .s3{fill:var(--d-sh3)}
.dgm .tp{fill:var(--d-tp)}
.dgm .ln{fill:none;stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round}
.dgm .t-hi{stroke:var(--d-hi)}.dgm .t-mid{stroke:var(--d-mid)}.dgm .t-lo{stroke:var(--d-lo)}.dgm .t-faint{stroke:var(--d-faint)}.dgm .t-lit{stroke:var(--d-lit0)}
.dgm .dt circle{fill:var(--d-dot);stroke:none}
.dgm .dt.t-hi circle{opacity:.85}.dgm .dt.t-mid circle{opacity:.45}.dgm .dt.t-lo circle{opacity:.22}
.dgm .needle{stroke:var(--d-hi);stroke-width:1.1px}
.dgm .arm{stroke:var(--d-hi);stroke-width:1.8px}
.dgm .knob{fill:var(--d-paper);stroke:var(--d-hi);stroke-width:.6px}
.dgm .halo{fill:var(--d-halo);stroke:none;filter:blur(9px);opacity:var(--d-halo-o);transform:translateY(3px)}
.dgm-legend{display:grid;gap:10px;margin-top:12px;font-size:13px;line-height:1.55}
.dgm-row{display:flex;flex-wrap:wrap;gap:4px}
.dgm-btn{display:inline-flex;gap:6px;align-items:baseline;padding:3px 8px;border:1px solid transparent;border-radius:4px;color:inherit;opacity:.72;font-size:12.5px;line-height:1.3}
.dgm-btn:hover{opacity:1}
.dgm-btn[aria-pressed="true"]{opacity:1;border-color:currentColor}
.dgm-ctl{font-family:ui-monospace,monospace;font-size:11.5px;border-color:var(--d-lo0)}
.dgm-detail{min-height:4.7em}
@media (max-width:560px){.dgm-plate{padding:40px 6px 62px}.dgm-corner[data-c="hint"]{bottom:36px}}
`

function Solid({ item, k: key }: { item: Extract<Item, { kind: "solid" }>; k: string }) {
  const { paths, tone, crease = "faint", part } = item
  return (
    <g key={key} data-part={part}>
      <path className="f" d={paths.fill} />
      {paths.shades.map((d, shade) => (d ? <path key={shade} className={`s${shade}`} d={d} /> : null))}
      <path className="tp" d={paths.top} />
      {crease !== "none" && paths.crease ? <path className={`ln t-${crease}`} d={paths.crease} /> : null}
      {crease !== "none" && paths.bevel ? <path className={`ln t-${crease}`} d={paths.bevel} /> : null}
      <path className={`ln t-${tone}`} d={paths.outline} />
    </g>
  )
}

function render(items: Item[], prefix: string) {
  return items.map((item, index) => {
    const key = `${prefix}-${index}`
    if (item.kind === "halo") return <path key={key} className="halo" d={item.d} />
    if (item.kind === "line") return item.d ? <path key={key} data-part={item.part} data-free={item.free ? "" : undefined} className={`ln t-${item.tone}`} d={item.d} /> : null
    if (item.kind === "dots")
      return (
        <g key={key} data-part={item.part} className={`dt t-${item.tone}`}>
          {item.points.map(([x, y], i) => (
            <circle key={i} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={item.size} />
          ))}
        </g>
      )
    return <Solid key={key} k={key} item={item} />
  })
}

// A solid whose shape changes: eight fixed paths whose d is rewritten.
const dsOf = (p: SolidPaths) => [p.fill, ...p.shades, p.top, p.crease, p.outline]
function LiveSolid({ paths, tone, gref }: { paths: SolidPaths; tone: string; gref: React.Ref<SVGGElement> }) {
  const ds = dsOf(paths)
  return (
    <g ref={gref}>
      <path className="f" d={ds[0]} />
      {[1, 2, 3, 4].map((i) => (
        <path key={i} className={`s${i - 1}`} d={ds[i]} />
      ))}
      <path className="tp" d={ds[5]} />
      <path className="ln t-lo" d={ds[6]} />
      <path className={`ln t-${tone}`} d={ds[7]} />
    </g>
  )
}

const CARRIAGE_STOPS = [RACK_X, ...BIN_X]
const carriageX = (index: number) => {
  const at = Math.min(CARRIAGE_STOPS.length - 1, Math.max(0, index + 1))
  const i = Math.min(CARRIAGE_STOPS.length - 2, Math.floor(at))
  return CARRIAGE_STOPS[i]! + (CARRIAGE_STOPS[i + 1]! - CARRIAGE_STOPS[i]!) * (at - i)
}
const pressX = (x: number) => STATION_X[0]! + (STATION_X[1]! - STATION_X[0]!) * x
const DROP = 8

const REST: Pose = poseAt(REST_T)
const BIN_TILES = BIN_X.map((cx) => tileSolid(cx, BIN_TILE_Y, TILE_Z))
const PAD_ART = render([{ kind: "solid", paths: PAD, tone: "hi", crease: "lo", part: "press" }], "pad")
const HEAD_ART = render(HEAD, "head")
const CARRIAGE_ART = render(ART.carriage, "car")
const tileArt = (t: { body: SolidPaths; seam: string }, key: string) =>
  render(
    [
      { kind: "solid", paths: t.body, tone: "hi", crease: "lo", part: "bins" },
      { kind: "line", d: t.seam, tone: "faint", part: "bins" },
    ],
    key,
  )

const follow = (current: number, target: number, dt: number, seconds: number, calm: boolean) => {
  if (calm) return target
  const next = current + (target - current) * (1 - mexp(-dt / seconds))
  return Math.abs(target - next) < 1e-3 ? target : next
}

type Mode = "auto" | "play" | "pause"
const subscribeStill = (on: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", on)
  return () => query.removeEventListener("change", on)
}
const stillNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

interface Live {
  t: number
  target: number | null
  mode: Mode
  needles: number[] // narrow0, wide0, narrow1, wide1
}

export function GemmWorkshop() {
  const [sel, setSel] = React.useState<Part | null>(null)
  const [mode, setMode] = React.useState<Mode>("auto")
  const reduced = React.useSyncExternalStore(subscribeStill, stillNow, () => false)
  const playing = mode === "play" || (mode === "auto" && !reduced)
  const stage = React.useRef<HTMLDivElement>(null)
  const readout = React.useRef<HTMLSpanElement>(null)
  const pressRef = React.useRef<SVGGElement>(null)
  const ramRef = React.useRef<SVGGElement>(null)
  const padRef = React.useRef<SVGGElement>(null)
  const needleRefs = React.useRef<(SVGPathElement | null)[]>([])
  const armRefs = React.useRef<(SVGPathElement | null)[]>([])
  const knobRefs = React.useRef<(SVGCircleElement | null)[]>([])
  const tileRefs = React.useRef<(SVGGElement | null)[]>([])
  const carRef = React.useRef<SVGGElement>(null)
  const carTileRef = React.useRef<SVGGElement>(null)
  const frame = React.useRef(0)
  const kickRef = React.useRef<() => void>(() => {})
  const live = React.useRef<Live>({
    t: REST_T,
    target: null,
    mode: "auto",
    needles: [REST.stations[0].narrow, REST.stations[0].wide, REST.stations[1].narrow, REST.stations[1].wide],
  })

  React.useEffect(() => {
    const node = stage.current
    if (!node) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let last = 0
    const ramPaths = ramRef.current ? Array.from(ramRef.current.querySelectorAll("path")) : []

    const draw = (pose: Pose, s: Live) => {
      pressRef.current?.setAttribute("transform", k.translateAlong(P, [pressX(pose.pressX), 0, 0]))
      if (ramPaths.length === 8) {
        const ds = dsOf(ramAt(pose.ram))
        ramPaths.forEach((path, i) => path.setAttribute("d", ds[i] ?? ""))
      }
      padRef.current?.setAttribute("transform", k.translateAlong(P, [0, 0, padBottom(pose.ram) - padBottom(0)]))
      ;[0, 1].forEach((w) => {
        needleRefs.current[w * 2]?.setAttribute("d", needleAt(w, "narrow", s.needles[w * 2]!))
        needleRefs.current[w * 2 + 1]?.setAttribute("d", needleAt(w, "wide", s.needles[w * 2 + 1]!))
        const lever = leverAt(w, pose.stations[w]!.lever)
        armRefs.current[w]?.setAttribute("d", lever.arm)
        knobRefs.current[w]?.setAttribute("cx", lever.knob[0].toFixed(1))
        knobRefs.current[w]?.setAttribute("cy", lever.knob[1].toFixed(1))
      })
      pose.bins.forEach((bin, i) => {
        const g = tileRefs.current[i]
        if (!g) return
        g.setAttribute("transform", k.translateAlong(P, [0, 0, bin.drop * DROP]))
        g.setAttribute("opacity", bin.full.toFixed(3))
      })
      carRef.current?.setAttribute("transform", k.translateAlong(P, [carriageX(pose.carriage), 0, 0]))
      carTileRef.current?.setAttribute("opacity", pose.carrying.toFixed(3))
      if (readout.current && readout.current.textContent !== pose.readout) readout.current.textContent = pose.readout
    }

    const tick = (now: number) => {
      const s = live.current
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = still.matches
      if (s.target !== null) {
        s.t = follow(s.t, s.target, dt, 0.22, calm)
        if (s.t === s.target) s.target = null
      } else if (s.mode === "play" || (s.mode === "auto" && !calm)) s.t += dt
      const pose = poseAt(s.t)
      const goal = [pose.stations[0].narrow, pose.stations[0].wide, pose.stations[1].narrow, pose.stations[1].wide]
      let settling = false
      s.needles = s.needles.map((v, i) => {
        const next = follow(v, goal[i]!, dt, 0.14, calm)
        if (next !== goal[i]) settling = true
        return next
      })
      draw(pose, s)
      const moving = s.mode === "play" || (s.mode === "auto" && !calm) || s.target !== null || settling
      frame.current = visible && moving ? requestAnimationFrame(tick) : 0
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

  const setPlay = (on: boolean) => {
    const next: Mode = on ? "play" : "pause"
    live.current.mode = next
    live.current.target = null
    setMode(next)
    kickRef.current()
  }
  const step = (dir: 1 | -1) => {
    const s = live.current
    s.mode = "pause"
    setMode("pause")
    const from = s.target ?? s.t
    s.target = dir > 0 ? nextStep(from) : prevStep(from)
    kickRef.current()
  }
  const partOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-part]")
    return (el?.getAttribute("data-part") as Part | null) ?? null
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") setPlay(!playing)
    else if (event.key === "ArrowRight") step(1)
    else if (event.key === "ArrowLeft") step(-1)
    else if (event.key === "Escape") setSel(null)
    else return
    event.preventDefault()
  }

  const part = sel ? PARTS.find((p) => p.id === sel)! : null

  return (
    <figure className="dgm not-prose my-8" data-sel={sel ?? undefined}>
      <style>{CSS}</style>
      <div className="dgm-plate">
        <span className="dgm-corner" data-c="fig" aria-hidden="true">
          Fig 1
        </span>
        <span className="dgm-corner" data-c="title" aria-hidden="true">
          One SM, one tile
        </span>
        <span className="dgm-corner" data-c="hint" aria-hidden="true">
          Tap a part · ← → step
        </span>
        <span className="dgm-corner" data-c="readout" ref={readout} aria-hidden="true">
          {REST.readout}
        </span>
        <div
          ref={stage}
          className="dgm-stage"
          tabIndex={0}
          role="group"
          aria-roledescription="interactive figure"
          aria-label="DeepGEMM's FP8 mainloop as a workshop. Space pauses or plays, the arrow keys step one WGMMA at a time, Escape clears the selected part."
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse") return
            const p = partOf(event.target)
            if (p) setSel(p)
          }}
          onPointerDown={(event) => setSel(partOf(event.target))}
          onKeyDown={onKeyDown}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="An isometric workbench. Back left, a rack of tiles. In front of it a rail with a carriage that carries one tile at a time into one of three bins. On the right, a gantry with a single press that moves between two stations. Each station has a die, a small dial marked in 14 steps, a lever, and a larger dial marked in 24."
            focusable="false"
          >
            <g key="bench">{render(ART.bench, "b")}</g>
            <g key="rack">{render(ART.rack, "r")}</g>
            <g key="tray">{render(ART.tray, "t")}</g>
            {BIN_X.map((_, i) => (
              <g key={`bin${i}`}>
                {render(ART.binBack[i]!, `bb${i}`)}
                <g
                  ref={(el) => {
                    tileRefs.current[i] = el
                  }}
                  transform={k.translateAlong(P, [0, 0, REST.bins[i]!.drop * DROP])}
                  opacity={REST.bins[i]!.full}
                >
                  {tileArt(BIN_TILES[i]!, `bt${i}`)}
                </g>
                {render(ART.binFront[i]!, `bf${i}`)}
              </g>
            ))}
            <g key="anvils">{render(ART.anvils, "a")}</g>
            <g key="posts">{render(ART.posts, "p")}</g>
            <g key="press" ref={pressRef} transform={k.translateAlong(P, [pressX(REST.pressX), 0, 0])} data-part="press" className={sel ? undefined : "lit"}>
              <LiveSolid paths={ramAt(REST.ram)} tone="hi" gref={ramRef} />
              <g ref={padRef} transform={k.translateAlong(P, [0, 0, padBottom(REST.ram) - padBottom(0)])}>
                {PAD_ART}
              </g>
              {HEAD_ART}
            </g>
            <g key="beam">{render(ART.beam, "beam")}</g>
            {ART.stations.map((st, w) => (
              <g key={`st${w}`}>
                {render(st.narrow, `n${w}`)}
                <path
                  ref={(el) => {
                    needleRefs.current[w * 2] = el
                  }}
                  data-part="narrow"
                  className="ln needle"
                  d={needleAt(w, "narrow", REST.stations[w]!.narrow)}
                />
                {render(st.lever, `l${w}`)}
                <g data-part="lever">
                  <path
                    ref={(el) => {
                      armRefs.current[w] = el
                    }}
                    className="ln arm"
                    d={leverAt(w, REST.stations[w]!.lever).arm}
                  />
                  <circle
                    ref={(el) => {
                      knobRefs.current[w] = el
                    }}
                    className="knob"
                    r={2}
                    cx={leverAt(w, REST.stations[w]!.lever).knob[0].toFixed(1)}
                    cy={leverAt(w, REST.stations[w]!.lever).knob[1].toFixed(1)}
                  />
                </g>
                {render(st.wide, `w${w}`)}
                <path
                  ref={(el) => {
                    needleRefs.current[w * 2 + 1] = el
                  }}
                  data-part="wide"
                  className="ln needle"
                  d={needleAt(w, "wide", REST.stations[w]!.wide)}
                />
              </g>
            ))}
            <g key="rail">{render(ART.rail, "rl")}</g>
            <g key="car" ref={carRef} transform={k.translateAlong(P, [carriageX(REST.carriage), 0, 0])}>
              {CARRIAGE_ART}
              <g ref={carTileRef} opacity={REST.carrying}>
                {tileArt(CARRIAGE_TILE, "ct")}
              </g>
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="dgm-legend text-muted-foreground">
        <div className="dgm-row">
          <button type="button" className="dgm-btn dgm-ctl" onClick={() => setPlay(!playing)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="dgm-btn dgm-ctl" onClick={() => step(1)}>
            Step one WGMMA
          </button>
        </div>
        <div className="dgm-row" role="group" aria-label="Parts">
          {PARTS.map((p) => (
            <button key={p.id} type="button" className="dgm-btn" aria-pressed={sel === p.id} onClick={() => setSel(sel === p.id ? null : p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="dgm-detail" aria-live="polite">
          {part ? (
            <>
              <strong className="text-foreground">{part.name}.</strong> {part.does}
            </>
          ) : (
            <>
              Two stations share one press. While one is stamped four times, the other pulls its lever and moves its partial sum from the {ACC_BITS}-bit dial to the{" "}
              {FP32_BITS}-bit one, so the press never waits. {ART.solids} solids; pick a part to see what it stands for.
            </>
          )}
        </div>
      </figcaption>
    </figure>
  )
}
