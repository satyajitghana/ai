"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The Model Factory as a flywheel. Poolside's claim isn't a single architecture trick;
// it's that model development is an *industrial process* — a tightly-versioned loop
// where data, training, evaluation, and inference are one integrated system, and each
// turn of the loop makes the next one faster and more reproducible. Auto-advances
// through the four stages; click a stage to inspect it. The ↻ is the whole point.

const STAGES = [
  {
    key: "data",
    name: "versioned data",
    what: "Every dataset is content-addressed and versioned, so any model's exact inputs are reproducible.",
    why: "Reproducibility is the substrate of an industrial process — you can't iterate reliably on training data you can't pin down.",
  },
  {
    key: "train",
    name: "training",
    what: "Train the models from scratch, end-to-end, with runs tied to specific data versions.",
    why: "Because the data is pinned, a training run is a repeatable experiment, not a one-off — the thing that lets you improve systematically.",
  },
  {
    key: "eval",
    name: "evaluation",
    what: "Continuous, integrated evaluation — agentic software-engineering benchmarks gate progress, not just perplexity.",
    why: "For a coding model the target is resolving real tasks, so the eval has to run the agent, not score next-token loss. It's the fitness function of the whole loop.",
  },
  {
    key: "infer",
    name: "inference",
    what: "Serving and quantization — and the deployed model's real traces become signal.",
    why: "Inference isn't the end of the line; it feeds the next turn. What the model does in the wild versions the next round of data.",
  },
] as const

export function ModelFactory() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const s = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>the Model Factory · model development as a flywheel</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* cyclic stage chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((st, k) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setI(k)}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all", k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40")}
                style={k === i ? { background: "oklch(0.72 0.15 195)" } : undefined}
              >
                {st.name}
              </button>
              <span className="text-muted-foreground/40">→</span>
            </span>
          ))}
          <span className="font-mono text-[11px] text-muted-foreground/60">↻ loop</span>
        </div>

        {/* grid-stack every stage in one cell so the box is always as tall as the
            tallest stage — the active one fades in, so the page below never shifts */}
        <div className="mt-4 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 border-foreground/30 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <div className="font-mono text-xs text-foreground">{k + 1}. {st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span> <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span> <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
