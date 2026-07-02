"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, SnowflakeIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The paper's central evidence for decoupling. Three ways to build a block-diffusion
// model from the same backbone, and how much quality each keeps versus the AR baseline
// (average of the general / code / math degradations in Table 2). The entangled
// single-tower — one weight set doing both context and denoising — loses the most. A
// separate trainable denoiser reading a FROZEN AR context tower keeps the most. Cycles
// through the three; click to pin. Real numbers from Table 2.

// retained = 100 - mean(gen, code, math degradation) vs AR baseline
const OPTS = [
  {
    key: "tied",
    name: "single tower (tied)",
    retained: 75.5,
    drops: "−26 / −21 / −26",
    sketch: ["one shared network", "represents clean AND denoises"],
    note: "The default in existing diffusion LMs. One weight set is pulled toward causal context representation and bidirectional denoising at once — and does neither well.",
  },
  {
    key: "continued",
    name: "continued AR training",
    retained: 87.8,
    drops: "−10 / −8 / −18",
    sketch: ["one network", "kept training on the diffusion loss"],
    note: "Better, but the single backbone still has to serve both roles; math especially suffers (−18%).",
  },
  {
    key: "twotower",
    name: "TwoTower (frozen + trained)",
    retained: 90.7,
    drops: "−6 / −11 / −11",
    sketch: ["frozen AR tower + trainable denoiser", "cross-attention between them"],
    note: "Decoupled. The frozen tower keeps the pretrained backbone's context ability intact; the denoiser specializes in refinement. Neither role compromises the other.",
  },
] as const

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
  const c = best ? "oklch(0.72 0.15 150)" : "oklch(0.7 0.13 40)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>why decouple · quality kept vs the AR baseline</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {OPTS.map((op, k) => (
            <button
              key={op.key}
              type="button"
              onClick={() => setI(k)}
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
              style={k === i ? { borderColor: c, background: c, color: "var(--background)" } : undefined}
            >
              {op.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
          <div className="flex flex-col justify-center">
            <div className="mb-1 flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">avg quality retained vs AR</span>
              <span className="tabular-nums text-foreground">{o.retained}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted">
              <div className="h-full rounded transition-all duration-500" style={{ width: `${o.retained}%`, background: c }} />
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              gen / code / math degradation: <span style={{ color: c }}>{o.drops}</span>
            </div>
          </div>

          {/* mini sketch */}
          <div className="rounded-md border p-2.5" style={{ borderColor: `${c}55` }}>
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px]" style={{ color: c }}>
              {best ? <SnowflakeIcon size={11} weight="fill" /> : null}
              {o.name}
            </div>
            {o.sketch.map((line, j) => (
              <div key={j} className="font-mono text-[10px] text-muted-foreground">{line}</div>
            ))}
          </div>
        </div>

        <p className={cn("mt-4 text-sm leading-6 text-muted-foreground")}>{o.note}</p>
      </div>
    </figure>
  )
}
