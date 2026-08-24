"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The core mechanism of Section 3.3: at each step the policy either REPLAYS a
// retrieved memory verbatim, or RECONSTRUCTS it — critiques the retrieved
// experience e_i against its source state o_i^src and the current state o_t,
// then emits state-grounded guidance g_t. If nothing applies, g_t = <EMPTY>
// and the fallback is the agent's own reasoning, p_self.
//
// This is a toy, illustrative walkthrough (one ALFWorld-style task, one memory
// entry) — the point is the STRUCTURE of the pipeline, not measured numbers.
// The paper's actual accept/adapt/reject rates are in the mechanism-probe
// component below this one in the article, cited to Table 4.
//
// SSR-safe: fixed strings, one integer toggle, no timers/randomness.

const ACC = "oklch(0.72 0.15 195)" // reconstruct / success
const BAD = "oklch(0.58 0.19 25)" // replay failure

type SceneId = "match" | "edit" | "empty"

const SCENES: {
  id: SceneId
  tab: string
  state: string
  replayOut: string
  replayTag: string
  replayOk: boolean
  reconOut: string
  reconTag: string
  reconOk: boolean
}[] = [
  {
    id: "match",
    tab: "state matches",
    state: "current: fridge is empty (same as the memory's source state)",
    replayOut: "“open the fridge, place the apple on the middle shelf”",
    replayTag: "unchanged",
    replayOk: true,
    reconOut: "“open the fridge, place the apple on the middle shelf”",
    reconTag: "pass-through",
    reconOk: true,
  },
  {
    id: "edit",
    tab: "state edited",
    state: "current: fridge already holds 3 items, middle shelf full",
    replayOut: "“open the fridge, place the apple on the middle shelf”",
    replayTag: "stale — shelf is full",
    replayOk: false,
    reconOut: "“middle shelf is full — place the apple on the top shelf instead”",
    reconTag: "adapted",
    reconOk: true,
  },
  {
    id: "empty",
    tab: "no relevant memory",
    state: "retrieval returns nothing applicable to this task",
    replayOut: "(nothing to inject — context is silently missing guidance)",
    replayTag: "no signal",
    replayOk: false,
    reconOut: "g_t = <EMPTY> → falls back to p_self: reason from the observation alone",
    reconTag: "explicit fallback",
    reconOk: true,
  },
]

export function ReplayVsReconstruct() {
  const [i, setI] = useState(0)
  const s = SCENES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>reconstruct vs. replay · one decision step</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">task</span>: put a clean apple in the fridge &middot;{" "}
          <span className="text-foreground">retrieved memory</span>{" "}(source state: fridge was empty): &ldquo;open the fridge, place the apple on the middle shelf&rdquo;
        </div>

        {/* scene tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SCENES.map((sc, idx) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setI(idx)}
              aria-pressed={i === idx}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === idx ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={i === idx ? { background: ACC } : undefined}
            >
              {sc.tab}
            </button>
          ))}
        </div>

        <div className="mt-2 font-mono text-[11px] text-muted-foreground">{s.state}</div>

        {/* pipeline */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {["retrieve", "critique + compare o_t vs oᵢˢʳᶜ", "act on g̃ₜ"].map((label, idx) => (
            <div key={idx} className="rounded-lg border bg-muted/20 px-2 py-2">
              <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide">stage {idx + 1}</div>
              <div className="mt-0.5 font-mono text-[10px] text-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* replay vs reconstruct outcomes */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: s.replayOk ? "var(--border)" : BAD }}>
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>REPLAY (verbatim)</span>
              <span className="font-semibold" style={{ color: s.replayOk ? "var(--muted-foreground)" : BAD }}>
                {s.replayTag}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] leading-5 text-foreground">{s.replayOut}</div>
          </div>
          <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: ACC }}>
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>RECONSTRUCT (MemHarness)</span>
              <span className="font-semibold" style={{ color: ACC }}>
                {s.reconTag}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] leading-5 text-foreground">{s.reconOut}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Replay injects whatever the memory bank returns and never looks at whether it still fits. When the state{" "}
          <span className="text-foreground">matches</span>{" "}the memory&rsquo;s source, that costs nothing — both paths agree. Once the state has{" "}
          <span style={{ color: BAD }}>drifted</span>, replay keeps repeating the stale instruction while reconstruction rewrites the target to the shelf that is actually free. And when nothing retrieved applies, reconstruction can say so explicitly —{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">&lt;EMPTY&gt;</code> — and drop back to the agent&rsquo;s own reasoning, instead of forcing a bad match into the context.
        </p>
      </div>
    </figure>
  )
}
