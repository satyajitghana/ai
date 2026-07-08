"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// Multi-cluster RL, drawn as the weight-sync loop. RL decomposes across clusters: only the
// TRAINER needs one high-bandwidth cluster; rollout inference engines are self-contained and
// run anywhere with just the current weights. So Cognition spreads rollouts across 4
// datacenters on 3 continents (plus third-party inference from Fireworks) and keeps them in
// sync by streaming a COMPRESSED WEIGHT DELTA (XOR diff + zstd) through cloud object storage
// — the single source of truth for weight versions. A delta is >99% smaller than broadcasting
// the full ~1T model, so a cross-continental update lands in 1–2 min with only a 3–4s
// inference pause (KV cache intact). Faster sync = less trajectory staleness = room for more
// aggressive learning rates.
//
// SSR-safe: a fixed 4-phase cycle. First render is deterministic at phase 0; the advance
// timer runs only inside useEffect. No unbounded loops, no Math.random.

const TRAINER = "oklch(0.70 0.15 160)" // teal-green
const CLUSTER = "oklch(0.68 0.14 235)" // blue
const HOT = "oklch(0.72 0.16 60)" // active edge — amber

const PHASES = [
  { key: "step", label: "optimizer step", note: "trainer updates weights every K steps on its one high-bandwidth cluster" },
  { key: "upload", label: "compress + upload Δ", note: "XOR diff + zstd → >99% smaller than broadcasting the full ~1T model" },
  { key: "pull", label: "clusters pull Δ", note: "rollout clusters poll the manifest and download shards via tree broadcast" },
  { key: "apply", label: "apply in-place", note: "3–4s inference pause · KV cache intact · 1–2 min cross-continental end-to-end" },
] as const

const W = 760
const H = 250
const TX = 120 // trainer x
const SX = 380 // storage x
const CX = 640 // clusters x
const MY = 70 // top cluster y
const CGAP = 56
const CY = 125 // storage/trainer y-center

const CLUSTERS = ["US-East", "EU-West", "APAC"]

export function WeightDeltaSync() {
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1900)
    return () => clearInterval(id)
  }, [playing])

  const cur = PHASES[phase]
  const clusterY = (i: number) => MY + i * CGAP

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>multi-cluster weight sync · 4 datacenters · 3 continents</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="cursor-pointer transition-colors hover:text-foreground"
        >
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight sync phase: ${cur.label}. ${cur.note}`}>
          <defs>
            <marker id="wds-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="8" refY="0">
              <path d="M0,-4L7,0L0,4" fill="none" stroke={HOT} strokeWidth={1.5} />
            </marker>
            <marker id="wds-arrow-dim" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="8" refY="0">
              <path d="M0,-4L7,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} opacity={0.35} />
            </marker>
          </defs>

          {/* return path: scored trajectories clusters → trainer (active on step phase) */}
          {CLUSTERS.map((_, i) => {
            const active = phase === 0
            return (
              <path
                key={`ret${i}`}
                d={`M ${CX - 46} ${clusterY(i)} C ${SX} ${clusterY(i) + 30}, ${SX} ${CY + 60}, ${TX + 44} ${CY + 18}`}
                fill="none"
                stroke={active ? CLUSTER : "var(--muted-foreground)"}
                strokeWidth={1.2}
                strokeDasharray="3 4"
                opacity={active ? 0.5 : 0.14}
                className="transition-opacity duration-300"
              />
            )
          })}
          {phase === 0 ? (
            <text x={SX} y={CY + 74} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              scored trajectories → data buffer
            </text>
          ) : null}

          {/* trainer → storage edge (upload, phase 1) */}
          <line
            x1={TX + 46}
            y1={CY}
            x2={SX - 40}
            y2={CY}
            stroke={phase === 1 ? HOT : "var(--muted-foreground)"}
            strokeWidth={phase === 1 ? 2.2 : 1.4}
            opacity={phase === 1 ? 1 : 0.28}
            markerEnd={phase === 1 ? "url(#wds-arrow)" : "url(#wds-arrow-dim)"}
            className="transition-all duration-300"
          />
          <text x={(TX + SX) / 2} y={CY - 10} textAnchor="middle" className={cn("font-mono", phase === 1 ? "fill-foreground" : "fill-muted-foreground/50")} fontSize={9}>
            Δ weights
          </text>

          {/* storage → clusters edges (pull, phase 2) */}
          {CLUSTERS.map((_, i) => (
            <path
              key={`pull${i}`}
              d={`M ${SX + 40} ${CY} C ${(SX + CX) / 2} ${CY}, ${(SX + CX) / 2} ${clusterY(i)}, ${CX - 46} ${clusterY(i)}`}
              fill="none"
              stroke={phase === 2 ? HOT : "var(--muted-foreground)"}
              strokeWidth={phase === 2 ? 2.2 : 1.4}
              opacity={phase === 2 ? 1 : 0.28}
              markerEnd={phase === 2 ? "url(#wds-arrow)" : "url(#wds-arrow-dim)"}
              className="transition-all duration-300"
            />
          ))}

          {/* trainer node */}
          <g>
            <rect
              x={TX - 46}
              y={CY - 26}
              width={92}
              height={52}
              rx={9}
              fill="var(--background)"
              stroke={phase === 0 ? TRAINER : "var(--border)"}
              strokeWidth={phase === 0 ? 2.4 : 1.4}
              className="transition-all duration-300"
            />
            <text x={TX} y={CY - 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              trainer
            </text>
            <text x={TX} y={CY + 9} textAnchor="middle" style={{ fill: TRAINER }} className="font-mono" fontSize={9}>
              US · 1 HB cluster
            </text>
            <text x={TX} y={CY + 20} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>
              optimizer
            </text>
          </g>

          {/* object storage (cylinder-ish) */}
          <g>
            <rect
              x={SX - 40}
              y={CY - 30}
              width={80}
              height={60}
              rx={8}
              fill="var(--background)"
              stroke={phase === 1 || phase === 2 ? HOT : "var(--border)"}
              strokeWidth={phase === 1 || phase === 2 ? 2.2 : 1.4}
              className="transition-all duration-300"
            />
            <text x={SX} y={CY - 8} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
              object
            </text>
            <text x={SX} y={CY + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
              storage
            </text>
            <text x={SX} y={CY + 18} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>
              source of truth
            </text>
          </g>

          {/* rollout clusters */}
          {CLUSTERS.map((name, i) => {
            const active = phase === 2 || phase === 3
            return (
              <g key={name}>
                <rect
                  x={CX - 46}
                  y={clusterY(i) - 18}
                  width={92}
                  height={36}
                  rx={8}
                  fill="var(--background)"
                  stroke={active ? CLUSTER : "var(--border)"}
                  strokeWidth={phase === 3 ? 2.4 : 1.4}
                  opacity={active ? 1 : 0.7}
                  className="transition-all duration-300"
                />
                <text x={CX} y={clusterY(i) - 1} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                  {name}
                </text>
                <text x={CX} y={clusterY(i) + 11} textAnchor="middle" style={{ fill: CLUSTER }} className="font-mono" fontSize={8}>
                  rollout · Dynamo
                </text>
              </g>
            )
          })}
          <text x={CX} y={clusterY(2) + 32} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={8}>
            self-contained · run anywhere
          </text>
        </svg>

        {/* phase stepper */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {PHASES.map((ph, i) => (
            <button
              key={ph.key}
              type="button"
              onClick={() => {
                setPlaying(false)
                setPhase(i)
              }}
              aria-pressed={phase === i}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                phase === i ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {i + 1}. {ph.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)]">
          {PHASES.map((ph, i) => (
            <div
              key={ph.key}
              aria-hidden={i !== phase}
              className={cn(
                "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-2 transition-opacity duration-300",
                i === phase ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <span className="font-mono text-[11px] text-foreground">{ph.label}</span>
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">{ph.note}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only the <span style={{ color: TRAINER }}>trainer</span> needs one high-bandwidth cluster; the{" "}
          <span style={{ color: CLUSTER }}>rollout engines</span> are stateless given the current weights, so they run on
          whatever compute is available across three continents. The trick that makes it cheap is the{" "}
          <span className="text-foreground">compressed weight delta</span> through object storage: a{" "}
          <span className="text-foreground">&gt;99% smaller</span> transfer than a full broadcast, so weights stay fresh
          and trajectory staleness stays low — the same knob the async loop is trying to keep small.
        </p>
      </div>
    </figure>
  )
}
