"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Mixture-of-Agents, drawn as the network it is. MoA stacks L layers; each layer runs n
// agents as "proposers", and every agent in a layer reads ALL outputs of the previous
// layer through an Aggregate-and-Synthesize prompt — so the connectors are genuinely
// all-to-all between rows. Add layers and watch the fan-in deepen and the synthesized
// answer sharpen: the paper's "collaborativeness" effect (models improve when shown
// peers' answers, even weaker ones). Illustrative trace of one factual question; the
// quality meter is a stand-in for AlpacaEval-style win rate.

const PROPOSERS = ["Qwen-110B", "WizardLM-8x22B", "Llama-3-70B", "Mixtral-8x22B"]
const ACCENT = "oklch(0.72 0.15 195)"
const QUAL = "oklch(0.70 0.15 150)"

// hand-authored synthesized answer + a stand-in quality at each depth
const STAGES = [
  {
    label: "single model",
    answer:
      "The Kuiper Belt is past Neptune. It has icy bodies. Pluto is one of them.",
    quality: 57,
    note: "One model, one pass — fluent but thin, and it drops the scattered disc entirely.",
  },
  {
    label: "1 MoA layer",
    answer:
      "Beyond Neptune (~30–50 AU) lies the Kuiper Belt of icy bodies — Pluto, Haumea, Makemake — the source of short-period comets, distinct from the more distant scattered disc.",
    quality: 65,
    note: "The aggregator reads all four proposers at once: one supplied the AU range, another the dwarf planets, a third the comet link. Synthesis keeps the parts each got right.",
  },
  {
    label: "2 MoA layers",
    answer:
      "Beyond Neptune (~30–50 AU) lies the Kuiper Belt — a torus of icy planetesimals left from planet formation. It hosts dwarf planets (Pluto, Haumea, Makemake), feeds the short-period comets, and grades outward into the dynamically hotter scattered disc; not to be confused with the far more distant Oort cloud.",
    quality: 70,
    note: "A second layer re-aggregates the first layer's syntheses — errors that survived one round get cross-checked again, and the Oort-cloud confusion is caught.",
  },
]

// scene geometry (viewBox units)
const W = 720
const H = 384
const NW = 132 // proposer node width
const NH = 38
const AW = 208 // aggregator width
const GY_TOP = 44
const GY_BOT = 300 // graph vertical span for prompt..aggregator
const QY = 348 // quality meter track y
const nodeXs = PROPOSERS.map((_, i) => 96 + i * 176) // 4 evenly spread centers

export function MoANetwork() {
  const [stage, setStage] = useState(0)
  const layers = stage // 0, 1, or 2 MoA layers
  const s = STAGES[stage]

  // rows: prompt + `layers` proposer rows + aggregator, distributed vertically
  const rowCount = layers + 2
  const yOf = (r: number) => GY_TOP + (r * (GY_BOT - GY_TOP)) / (rowCount - 1)
  const promptY = yOf(0)
  const aggY = yOf(rowCount - 1)
  const layerY = (li: number) => yOf(li + 1)

  const link = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const qx0 = 60
  const qx1 = W - 60

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">mixture-of-agents · depth</span>
        <div className="flex gap-1">
          {STAGES.map((o, i) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setStage(i)}
              aria-pressed={stage === i}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                stage === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A mixture-of-agents network with ${layers} proposer layer${layers === 1 ? "" : "s"} of four agents each, all outputs feeding forward into a final aggregator; stand-in quality ${s.quality} percent`}>
          <defs>
            <marker id="mn-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mn-soft" x="-30%" y="-40%" width="160%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* connectors (behind nodes) */}
          {layers === 0 ? (
            <path d={link(W / 2, promptY + 15, W / 2, aggY - 22)} fill="none" stroke={ACCENT} strokeWidth={1.6} opacity={0.5} markerEnd="url(#mn-arrow)" />
          ) : (
            <>
              {/* prompt -> every node in layer 1 */}
              {nodeXs.map((x, j) => (
                <path key={`p-${j}`} d={link(W / 2, promptY + 15, x, layerY(0) - NH / 2)} fill="none" stroke={ACCENT} strokeWidth={1.4} opacity={0.32} markerEnd="url(#mn-arrow)" />
              ))}
              {/* all-to-all between consecutive proposer layers */}
              {Array.from({ length: layers - 1 }).flatMap((_, li) =>
                nodeXs.flatMap((x1, a) =>
                  nodeXs.map((x2, b) => (
                    <path key={`l-${li}-${a}-${b}`} d={link(x1, layerY(li) + NH / 2, x2, layerY(li + 1) - NH / 2)} fill="none" stroke={ACCENT} strokeWidth={1.2} opacity={0.22} markerEnd="url(#mn-arrow)" />
                  )),
                ),
              )}
              {/* last layer -> aggregator */}
              {nodeXs.map((x, j) => (
                <path key={`a-${j}`} d={link(x, layerY(layers - 1) + NH / 2, W / 2, aggY - 22)} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.42} markerEnd="url(#mn-arrow)" />
              ))}
            </>
          )}

          {/* prompt node */}
          <g>
            <rect x={W / 2 - 118} y={promptY - 15} width={236} height={30} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
            <text x={W / 2} y={promptY + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10.5}>prompt · &ldquo;What is the Kuiper Belt?&rdquo;</text>
          </g>

          {/* proposer layers */}
          {Array.from({ length: layers }).map((_, li) => (
            <g key={li}>
              <text x={24} y={layerY(li) + 3.5} className="fill-muted-foreground/70 font-mono" fontSize={8.5}>L{li + 1}</text>
              {PROPOSERS.map((p, pi) => (
                <g key={p}>
                  <rect x={nodeXs[pi] - NW / 2} y={layerY(li) - NH / 2} width={NW} height={NH} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.4} opacity={0.95} filter="url(#mn-soft)" />
                  <circle cx={nodeXs[pi] - NW / 2 + 13} cy={layerY(li)} r={3.5} fill={ACCENT} opacity={0.85} />
                  <text x={nodeXs[pi] + 6} y={layerY(li) + 3.5} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>{p}</text>
                </g>
              ))}
            </g>
          ))}

          {/* aggregator / single-model node */}
          <g>
            <rect x={W / 2 - AW / 2} y={aggY - 22} width={AW} height={44} rx={11} fill={ACCENT} stroke={ACCENT} strokeWidth={1.5} filter="url(#mn-soft)" />
            <text x={W / 2} y={aggY - 3} textAnchor="middle" className="font-mono" fontSize={11.5} fontWeight={600} fill="var(--background)">{layers === 0 ? "single model" : "final aggregator"}</text>
            <text x={W / 2} y={aggY + 12} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--background)" opacity={0.8}>{layers === 0 ? "Hermes 4 · one pass" : "Hermes 4 · synthesize → answer"}</text>
          </g>

          {/* quality meter */}
          <g>
            <text x={qx0} y={QY - 8} className="fill-muted-foreground font-mono" fontSize={9.5}>answer quality (stand-in win rate)</text>
            <text x={qx1} y={QY - 8} textAnchor="end" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>{s.quality}%</text>
            <rect x={qx0} y={QY} width={qx1 - qx0} height={9} rx={4.5} fill="var(--muted)" />
            <rect x={qx0} y={QY} width={((qx1 - qx0) * s.quality) / 100} height={9} rx={4.5} fill={QUAL} className="transition-all duration-500" />
          </g>
        </svg>

        {/* synthesized answer + note — grid-stacked so height = tallest variant (no layout shift) */}
        <div className="mt-3 grid">
          {STAGES.map((st, k) => (
            <div key={st.label} aria-hidden={k !== stage} className={cn("col-start-1 row-start-1 transition-opacity duration-300", k === stage ? "opacity-100" : "pointer-events-none opacity-0")}>
              <div className="rounded-md border-l-2 bg-muted/30 px-3 py-2.5" style={{ borderColor: ACCENT }}>
                <div className="font-mono text-[10px] text-muted-foreground">output · &ldquo;What is the Kuiper Belt?&rdquo;</div>
                <p className="mt-1 text-sm leading-6">{st.answer}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{st.note}</p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
