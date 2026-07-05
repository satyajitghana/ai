"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The paper's central evidence for decoupling, as a composed SVG scene. Three ways to build a
// block-diffusion model from the same backbone, and how much quality each keeps versus the AR
// baseline (average of the general / code / math degradations in Table 2), drawn as a bar chart
// with a matching architecture sketch. The entangled single-tower — one weight set doing both
// context and denoising — loses the most. A separate trainable denoiser reading a FROZEN AR context
// tower keeps the most. Cycles through the three; click to pin. Real numbers from Table 2.

// retained = 100 - mean(gen, code, math degradation) vs AR baseline
const OPTS = [
  {
    key: "tied",
    name: "single tower (tied)",
    retained: 75.5,
    drops: "−26 / −21 / −26",
    note: "The default in existing diffusion LMs. One weight set is pulled toward causal context representation and bidirectional denoising at once — and does neither well.",
  },
  {
    key: "continued",
    name: "continued AR training",
    retained: 87.8,
    drops: "−10 / −8 / −18",
    note: "Better, but the single backbone still has to serve both roles; math especially suffers (−18%).",
  },
  {
    key: "twotower",
    name: "TwoTower (frozen + trained)",
    retained: 90.7,
    drops: "−6 / −11 / −11",
    note: "Decoupled. The frozen tower keeps the pretrained backbone's context ability intact; the denoiser specializes in refinement. Neither role compromises the other.",
  },
] as const

const GREEN = "oklch(0.72 0.15 150)"
const WARN = "oklch(0.7 0.13 40)"

// scene geometry
const W = 720
const H = 208
const TRACK_X = 14
const TRACK_W = 300
const ROW_H = 62
const ROW_Y0 = 26
const BAR_H = 20
const SKETCH_X = 372

export function Decouple() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % OPTS.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const o = OPTS[i]
  const best = o.key === "twotower"
  const c = best ? GREEN : WARN
  const barW = (v: number) => (v / 100) * TRACK_W

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>why decouple · quality kept vs the AR baseline</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {OPTS.map((op, k) => {
            const oc = op.key === "twotower" ? GREEN : WARN
            return (
              <button
                key={op.key}
                type="button"
                onClick={() => setI(k)}
                aria-pressed={k === i}
                className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
                style={k === i ? { borderColor: oc, background: oc, color: "var(--background)" } : undefined}
              >
                {op.name}
              </button>
            )
          })}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Quality retained vs the AR baseline: single tower ${OPTS[0].retained}%, continued AR ${OPTS[1].retained}%, TwoTower ${OPTS[2].retained}%. Architecture sketch of ${o.name}.`}>
          <defs>
            <marker id="dc-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={c} strokeWidth={1.5} />
            </marker>
            <marker id="dc-arr-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} />
            </marker>
            <filter id="dc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* bars */}
          {OPTS.map((op, k) => {
            const active = k === i
            const oc = op.key === "twotower" ? GREEN : WARN
            const ny = ROW_Y0 + k * ROW_H
            const by = ny + 16
            return (
              <g key={op.key} className="transition-opacity duration-300" opacity={active ? 1 : 0.5}>
                <text x={TRACK_X} y={ny + 8} className="font-mono" fontSize={11} fill={active ? "var(--foreground)" : "var(--muted-foreground)"}>{op.name}</text>
                <rect x={TRACK_X} y={by} width={TRACK_W} height={BAR_H} rx={5} fill="var(--muted)" opacity={0.4} />
                <rect x={TRACK_X} y={by} width={barW(op.retained)} height={BAR_H} rx={5} fill={oc} opacity={active ? 0.95 : 0.55} filter={active ? "url(#dc-soft)" : undefined} className="transition-all duration-300" />
                <text x={TRACK_X + barW(op.retained) + 8} y={by + BAR_H / 2 + 4} className="font-mono tabular-nums" fontSize={12} fontWeight={600} fill={active ? oc : "var(--muted-foreground)"}>{op.retained}%</text>
              </g>
            )
          })}
          <text x={TRACK_X} y={H - 6} className="font-mono" fontSize={9} fill="var(--muted-foreground)">avg quality retained vs AR baseline →</text>

          {/* divider */}
          <line x1={SKETCH_X - 20} y1={18} x2={SKETCH_X - 20} y2={H - 20} stroke="var(--border)" strokeWidth={1} />

          {/* architecture sketch of the active option */}
          <Sketch optKey={o.key} color={c} />
        </svg>

        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          gen / code / math degradation: <span style={{ color: c }}>{o.drops}</span>
        </div>

        <div className="mt-3 grid">
          {OPTS.map((op, k) => (
            <p
              key={op.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {op.note}
            </p>
          ))}
        </div>
      </div>
    </figure>
  )
}

// small architecture sketch drawn in the right region of the scene (x ≈ 372…706)
function Sketch({ optKey, color }: { optKey: (typeof OPTS)[number]["key"]; color: string }) {
  const cx = 540
  const cy = 96
  const node = (x: number, y: number, w: number, h: number, label: string, snow = false) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="var(--background)" stroke={color} strokeWidth={1.5} filter="url(#dc-soft)" />
      {snow ? <SnowGlyph x={x + 12} y={y + h / 2} color={color} /> : null}
      <text x={snow ? x + w / 2 + 6 : x + w / 2} y={y + h / 2 + 4} textAnchor="middle" className="font-mono" fontSize={10.5} fontWeight={600} fill={color}>{label}</text>
    </g>
  )

  if (optKey === "twotower") {
    return (
      <g>
        <text x={cx} y={40} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--muted-foreground)">frozen context + trainable denoiser</text>
        {node(430, 74, 92, 40, "frozen AR", true)}
        {node(596, 74, 92, 40, "denoiser")}
        {/* layer-aligned cross-attention */}
        <path d={`M 522 94 C 559 76, 559 76, 596 94`} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#dc-arr)" />
        <text x={559} y={64} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">cross-attn</text>
        <text x={476} y={132} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">no gradient</text>
        <text x={642} y={132} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">trained</text>
      </g>
    )
  }

  if (optKey === "continued") {
    return (
      <g>
        <text x={cx} y={40} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--muted-foreground)">one net, kept training on diffusion loss</text>
        {node(cx - 66, 78, 132, 40, "shared net")}
        {/* training self-loop */}
        <path d={`M ${cx + 66} 90 C ${cx + 120} 74, ${cx + 120} 122, ${cx + 66} 106`} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#dc-arr)" />
        <text x={cx + 96} y={140} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">diffusion loss</text>
        <text x={cx} y={140} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">context + denoise</text>
      </g>
    )
  }

  // tied
  return (
    <g>
      <text x={cx} y={40} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--muted-foreground)">one weight set, both jobs at once</text>
      {/* two roles converging into one shared node */}
      <rect x={cx - 96} y={56} width={70} height={20} rx={5} fill="var(--muted)" opacity={0.5} />
      <text x={cx - 61} y={70} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">context</text>
      <rect x={cx + 26} y={56} width={70} height={20} rx={5} fill="var(--muted)" opacity={0.5} />
      <text x={cx + 61} y={70} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">denoise</text>
      <path d={`M ${cx - 61} 76 C ${cx - 61} 92, ${cx} 90, ${cx} 100`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#dc-arr-m)" />
      <path d={`M ${cx + 61} 76 C ${cx + 61} 92, ${cx} 90, ${cx} 100`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#dc-arr-m)" />
      {node(cx - 66, 102, 132, 40, "shared net")}
      <text x={cx} y={162} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">does neither well</text>
    </g>
  )
}

function SnowGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g stroke={color} strokeWidth={1.1} strokeLinecap="round" transform={`translate(${x} ${y})`}>
      <line x1={0} y1={-4} x2={0} y2={4} />
      <line x1={-3.5} y1={-2} x2={3.5} y2={2} />
      <line x1={-3.5} y1={2} x2={3.5} y2={-2} />
    </g>
  )
}
