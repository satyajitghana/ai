"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Agents-A1's three-stage training recipe, one stage at a time — what each does and
// why it's there. The arc: broaden the base, specialize per domain, then fold every
// specialist back into one deployable student via on-policy distillation. Auto-advances;
// click a stage to inspect it. Degrades to a static list with no JS.

const STAGES = [
  {
    key: "sft",
    name: "1 · full-domain SFT",
    what: "Supervised fine-tune the 35B base on agentic trajectories from every domain at once.",
    why: "Aligns the base model with broad agent behaviors — planning, tool calls, reading observations — so later stages have a competent generalist to sharpen, not a blank slate.",
  },
  {
    key: "teachers",
    name: "2 · domain teachers",
    what: "Train a separate expert model for each domain (search, engineering, science, instructions, tools).",
    why: "One model pulled toward six specialties dilutes each. Specialist teachers go deep where a generalist can't, giving the next stage stronger, more varied supervision than any single model could.",
  },
  {
    key: "distill",
    name: "3 · multi-teacher distillation",
    what: "Distill all domain teachers into one student on the student's own rollouts, routing each trajectory to the right teacher.",
    why: "On-policy (student-sampled) distillation kills exposure bias; domain routing picks the teacher that owns each task; salient-vocabulary alignment focuses the loss on the tokens that carry the capability. Six specialists collapse into one deployable 35B.",
  },
] as const

export function ThreeStage() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>training recipe · base → teachers → student</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((st, k) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setI(k)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all",
                  k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40"
                )}
                style={k === i ? { background: "oklch(0.72 0.15 195)" } : undefined}
              >
                {st.name}
              </button>
              {k < STAGES.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
            </span>
          ))}
        </div>

        <div className="mt-4 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 border-foreground/30 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <div className="font-mono text-xs text-foreground">{st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span>{" "}
                <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span>{" "}
                <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
