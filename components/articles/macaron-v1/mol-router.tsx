"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Mixture of LoRA: a frozen base model plus four small adapters, with L0 acting
// as both the chat specialist and the router. The point the diagram has to make
// is the parameter asymmetry — 744B frozen, 4 GB of adapter — so the bar at the
// bottom is drawn to true scale (0.54% is genuinely almost invisible, which is
// the argument). Numbers from the Macaron-V1-Venti model card.

const ACCENT = "oklch(0.58 0.15 265)"
const BASE_B = 744
const ADAPTER_B = 1
const N_ADAPTERS = 4

type Spec = { key: string; tag: string; role: string; covers: string }

const SPECS: Spec[] = [
  { key: "l0", tag: "L0", role: "Chat", covers: "Conversational and instruction-following backbone — and the entry point that routes everything else." },
  { key: "l1", tag: "L1", role: "Agent", covers: "Personal-life agent tasks, heavy tool use, long-horizon planning, dynamic workflows." },
  { key: "l2", tag: "L2", role: "Coding", covers: "Code understanding, SWE tasks, terminal use, repository workflows." },
  { key: "l3", tag: "L3", role: "GenUI", covers: "UI4A rendering and UI-driven action — generating interactive UI from a natural-language need." },
]

const adapterTotal = N_ADAPTERS * ADAPTER_B
const pctAdapter = (adapterTotal / (BASE_B + adapterTotal)) * 100

export function MolRouter() {
  const [sel, setSel] = useState("l3")
  const spec = SPECS.find((s) => s.key === sel)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        mixture of lora · one frozen base, four 1b specialists
      </div>

      <div className="p-3 sm:p-4">
        {/* request → router → specialists */}
        <div className="flex items-stretch gap-2 sm:gap-3">
          <div className="flex w-20 shrink-0 flex-col justify-center rounded-lg border bg-muted/25 px-2 py-3 text-center sm:w-24">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">request</div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">new user turn</div>
          </div>

          <div className="flex shrink-0 items-center font-mono text-muted-foreground/50">&rarr;</div>

          <div className="flex w-20 shrink-0 flex-col justify-center rounded-lg border px-2 py-3 text-center sm:w-24" style={{ borderColor: ACCENT }}>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">router</div>
            <div className="mt-1 font-mono text-xs font-medium" style={{ color: ACCENT }}>L0</div>
          </div>

          <div className="flex shrink-0 items-center font-mono text-muted-foreground/50">&rarr;</div>

          <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
            {SPECS.map((s) => {
              const on = s.key === sel
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSel(s.key)}
                  aria-pressed={on}
                  className={cn(
                    "cursor-pointer rounded-lg border px-2 py-2.5 text-center transition-all",
                    on ? "border-transparent text-white shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                  style={on ? { background: ACCENT } : undefined}
                >
                  <div className="font-mono text-[10px] opacity-80">{s.tag}</div>
                  <div className="font-mono text-[11px] font-medium">{s.role}</div>
                  <div className="mt-0.5 font-mono text-[9px] opacity-70">1B</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]">
            <span style={{ color: ACCENT }}>{spec.tag} {spec.role}</span>
            <span className="text-muted-foreground"> — {spec.covers}</span>
          </div>
        </div>

        {/* true-scale parameter split */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
            <span>where the parameters live (to scale)</span>
            <span>
              744B frozen base · {adapterTotal}B adapters ={" "}
              <span style={{ color: ACCENT }}>{pctAdapter.toFixed(2)}%</span>
            </span>
          </div>
          <div className="flex h-7 overflow-hidden rounded-md border">
            <div
              className="flex items-center justify-center bg-muted/60"
              style={{ width: `${100 - pctAdapter}%` }}
            >
              <span className="font-mono text-[10px] text-muted-foreground">GLM-5.2 base — frozen</span>
            </div>
            <div style={{ width: `${pctAdapter}%`, background: ACCENT, minWidth: 3 }} />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          That sliver on the right is the entire specialization. The base is frozen and it is not
          Mind Lab&rsquo;s — it is GLM-5.2 — so everything Macaron adds rides in four 1B adapters, about half a percent
          of the artifact. This is the opposite trade from Mixture-of-Experts: MoE routes every{" "}
          <em>token</em> through experts baked in during pretraining, while MoL routes each{" "}
          <em>request</em>{" "}once, at the adapter level, on top of somebody else&rsquo;s frozen base. Ongoing
          reasoning and tool calls stay inside the chosen specialist; finished work is handed between them as
          summaries rather than shared state.
        </p>
      </div>
    </figure>
  )
}
