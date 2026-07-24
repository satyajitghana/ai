"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MAI's two in-house tracks — an image model (MAI-Image-2.5-Pro) and a fast voice
// model (MAI-Voice-2-Flash) — drawn as a deployment fan into Microsoft's own product
// surface. Curved bezier connectors run from each model only to the products it
// actually ships in; edge/target labels carry the self-reported efficiency win.
// Toggle the track to spotlight one fan; hover a product to isolate its edge.
// All coordinates static — SSR-safe.

const IMG = "oklch(0.58 0.17 285)" // image track (violet)
const VOICE = "oklch(0.68 0.13 195)" // voice track (teal)

type Track = "image" | "voice"
type Mode = Track | "both"

type Target = { track: Track; name: string; stat: string; y: number }

const TARGETS: Target[] = [
  { track: "image", name: "Bing Image Creator", stat: "100% in-house", y: 28 },
  { track: "image", name: "PowerPoint image-to-image", stat: "−84% GPU cost vs GPT-Image-2", y: 90 },
  { track: "image", name: "OneDrive editing", stat: "2.5× efficiency · −25% P95", y: 152 },
  { track: "voice", name: "Dynamics 365 Contact Center", stat: "−89% GPU cost", y: 250 },
  { track: "voice", name: "Azure Voice Live", stat: "real-time voice agents", y: 312 },
]

// scene geometry (viewBox units)
const W = 720
const H = 372
const TW = 250 // target pill width
const TH = 46
const TX = 448 // target left edge
const SRC_X = 208 // model node right edge (source anchor)
const MIDX = (SRC_X + TX) / 2
const col = (t: Track) => (t === "image" ? IMG : VOICE)

// model nodes: [x, y, w, h]
const NODE = {
  image: { x: 20, y: 58, w: 188, h: 70, cy: 93 },
  voice: { x: 20, y: 250, w: 188, h: 70, cy: 285 },
}

function curve(sy: number, ty: number) {
  return `M ${SRC_X} ${sy} C ${MIDX} ${sy}, ${MIDX} ${ty}, ${TX} ${ty}`
}

export function DeployMap() {
  const [mode, setMode] = useState<Mode>("both")
  const [hover, setHover] = useState<number | null>(null)

  const trackActive = (t: Track) => mode === "both" || mode === t

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MAI ships its own models · image + voice</span>
        <span className="text-muted-foreground/50">self-reported</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Two Microsoft AI models — MAI-Image-2.5-Pro and MAI-Voice-2-Flash — fan out to the Microsoft products they power: Bing Image Creator, PowerPoint, OneDrive, Dynamics 365 Contact Center and Azure Voice Live, each labelled with its self-reported cost or latency win."
        >
          <defs>
            <marker id="dm-arrow-img" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={IMG} strokeWidth={1.5} />
            </marker>
            <marker id="dm-arrow-voice" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={VOICE} strokeWidth={1.5} />
            </marker>
            <filter id="dm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* column labels */}
          <text x={20} y={20} className="fill-muted-foreground font-mono" fontSize={11}>
            MAI models
          </text>
          <text x={TX} y={20} className="fill-muted-foreground font-mono" fontSize={11}>
            Microsoft product surface →
          </text>

          {/* connectors (behind nodes) */}
          {TARGETS.map((t, i) => {
            const active = trackActive(t.track)
            const isHover = hover === i
            const dim = hover !== null && !isHover
            const sy = NODE[t.track].cy
            const op = !active ? 0.1 : dim ? 0.22 : isHover ? 0.95 : 0.55
            return (
              <path
                key={`e-${i}`}
                d={curve(sy, t.y + TH / 2)}
                fill="none"
                stroke={col(t.track)}
                strokeWidth={isHover ? 2 : 1.5}
                markerEnd={`url(#dm-arrow-${t.track})`}
                opacity={op}
                className="transition-all duration-300"
              />
            )
          })}

          {/* model nodes */}
          {(["image", "voice"] as Track[]).map((t) => {
            const n = NODE[t]
            const active = trackActive(t)
            const label = t === "image" ? "MAI-Image-2.5-Pro" : "MAI-Voice-2-Flash"
            const sub = t === "image" ? "hero images · edits · text" : "fast speech · 2× MAI-Voice-2"
            const preview = t === "image" ? "preview · $106 / 1M img out" : "preview · $15 / 1M chars"
            return (
              <g key={t} opacity={active ? 1 : 0.4} className="transition-opacity duration-300">
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={10}
                  fill="var(--background)"
                  stroke={col(t)}
                  strokeWidth={1.5}
                  filter="url(#dm-soft)"
                />
                <text x={n.x + 14} y={n.y + 24} className="fill-foreground font-mono" fontSize={12.5} fontWeight={600}>
                  {label}
                </text>
                <text x={n.x + 14} y={n.y + 42} className="fill-muted-foreground font-mono" fontSize={9}>
                  {sub}
                </text>
                <text x={n.x + 14} y={n.y + 57} className="fill-muted-foreground/70 font-mono" fontSize={8.5}>
                  {preview}
                </text>
              </g>
            )
          })}

          {/* target pills */}
          {TARGETS.map((t, i) => {
            const active = trackActive(t.track)
            const isHover = hover === i
            const dim = hover !== null && !isHover
            const c = col(t.track)
            return (
              <g
                key={`t-${i}`}
                opacity={!active ? 0.35 : dim ? 0.55 : 1}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-opacity duration-300"
              >
                <rect
                  x={TX}
                  y={t.y}
                  width={TW}
                  height={TH}
                  rx={9}
                  fill={isHover && active ? c : "var(--muted)"}
                  fillOpacity={isHover && active ? 0.16 : 0.5}
                  stroke={active ? c : "var(--border)"}
                  strokeWidth={1.5}
                  filter={isHover && active ? "url(#dm-soft)" : undefined}
                />
                <text x={TX + 14} y={t.y + 20} className="fill-foreground font-mono" fontSize={11} fontWeight={500}>
                  {t.name}
                </text>
                <text x={TX + 14} y={t.y + 35} className="font-mono" fontSize={9} fill={active ? c : "var(--muted-foreground)"}>
                  {t.stat}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">track</span>
            {(["both", "image", "voice"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: IMG }} /> image
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: VOICE }} /> voice
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both tracks are Microsoft's <span className="text-foreground">own</span> models, and the story is where they
          land: swapped into Microsoft's product surface in place of third-party models, each with a self-reported
          serving win — <span style={{ color: IMG }}>−84% GPU cost</span> in PowerPoint versus GPT-Image-2,{" "}
          <span style={{ color: VOICE }}>−89%</span> in Dynamics 365. Hover a product to trace its model; toggle a track
          to isolate the fan.
        </p>
      </div>
    </figure>
  )
}
