"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 4's two mechanism probes, made explorable. Both are the paper's
// MEASURED numbers from controlled probes designed to isolate one thing:
// does reconstruction genuinely compare the current state against the
// memory's SOURCE state, rather than just pattern-matching on the retrieved
// text?
//
//  (a) Source-state ablation: remove o_i^src, or swap in a random one, and
//      watch rejection rate (RR) and success rate (SR) move.
//  (b) Counterfactual behavior: take real trajectories, minimally EDIT the
//      current state so the retrieved memory should no longer apply, and
//      classify the reconstruction output as unchanged / adapted / rejected.
//
// SSR-safe: static data, two small toggles, no timers/randomness.

const ACC = "oklch(0.72 0.15 195)" // unchanged / correct-source
const ADAPT = "oklch(0.72 0.15 60)" // adapted
const BAD = "oklch(0.58 0.19 25)" // reject / random-source

type Bench = "alf" | "web"

const SOURCE_DATA: Record<Bench, { label: string; rr: number; sr: number }[]> = {
  alf: [
    { label: "correct source", rr: 8.7, sr: 85.2 },
    { label: "no source", rr: 7.8, sr: 80.0 },
    { label: "random source", rr: 13.3, sr: 84.3 },
  ],
  web: [
    { label: "correct source", rr: 56.0, sr: 75.6 },
    { label: "no source", rr: 55.9, sr: 73.0 },
    { label: "random source", rr: 63.3, sr: 73.6 },
  ],
}

const CF_DATA: Record<Bench, { label: string; unchanged: number; adapted: number; reject: number }[]> = {
  alf: [
    { label: "match (s⁺)", unchanged: 46.0, adapted: 53.4, reject: 0.6 },
    { label: "edit (s⁻)", unchanged: 37.3, adapted: 56.3, reject: 6.4 },
  ],
  web: [
    { label: "match (s⁺)", unchanged: 0.0, adapted: 27.9, reject: 72.1 },
    { label: "edit (s⁻)", unchanged: 0.0, adapted: 21.2, reject: 78.8 },
  ],
}

const BENCH_LABEL: Record<Bench, string> = { alf: "ALFWorld", web: "WebShop" }

function ToggleRow<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o.id ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
          style={value === o.id ? { background: ACC } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MechanismProbe() {
  const [bench, setBench] = useState<Bench>("alf")
  const [view, setView] = useState<"source" | "counterfactual">("source")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mechanism probe · does reconstruction compare states?</span>
        <span className="text-muted-foreground/50">Table 4, measured</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleRow
            options={[
              { id: "source" as const, label: "source-state ablation" },
              { id: "counterfactual" as const, label: "counterfactual edit" },
            ]}
            value={view}
            onChange={setView}
          />
          <ToggleRow
            options={[
              { id: "alf" as const, label: "ALFWorld" },
              { id: "web" as const, label: "WebShop" },
            ]}
            value={bench}
            onChange={setBench}
          />
        </div>

        {view === "source" ? (
          <div className="mt-3 space-y-2.5">
            {SOURCE_DATA[bench].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">{row.label}</span>
                  <span className="tabular-nums">
                    RR <span className="font-semibold" style={{ color: row.label === "random source" ? BAD : "var(--foreground)" }}>{row.rr.toFixed(1)}%</span>
                    {"  ·  "}
                    SR <span className="font-semibold text-foreground">{row.sr.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mt-1 flex gap-1">
                  <div className="relative h-4 flex-1 rounded bg-muted/40">
                    <div className="absolute top-0 left-0 h-full rounded" style={{ width: `${Math.min(row.rr, 100)}%`, background: BAD, opacity: 0.75 }} />
                  </div>
                  <div className="relative h-4 flex-1 rounded bg-muted/40">
                    <div className="absolute top-0 left-0 h-full rounded" style={{ width: `${Math.min(row.sr, 100)}%`, background: ACC, opacity: 0.85 }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-4 font-mono text-[9px] text-muted-foreground">
              <span>◧ rejection rate (RR)</span>
              <span>◨ success rate (SR)</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {CF_DATA[bench].map((row) => (
              <div key={row.label}>
                <div className="font-mono text-[10px] text-foreground">{row.label}</div>
                <div className="mt-1 flex h-5 overflow-hidden rounded">
                  <div className="flex items-center justify-center font-mono text-[9px] text-background" style={{ width: `${row.unchanged}%`, background: "var(--muted-foreground)" }}>
                    {row.unchanged >= 8 ? `${row.unchanged.toFixed(0)}%` : ""}
                  </div>
                  <div className="flex items-center justify-center font-mono text-[9px] text-background" style={{ width: `${row.adapted}%`, background: ADAPT }}>
                    {row.adapted >= 8 ? `${row.adapted.toFixed(0)}%` : ""}
                  </div>
                  <div className="flex items-center justify-center font-mono text-[9px] text-background" style={{ width: `${row.reject}%`, background: BAD }}>
                    {row.reject >= 8 ? `${row.reject.toFixed(0)}%` : ""}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-4 font-mono text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--muted-foreground)" }} /> unchanged</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: ADAPT }} /> adapted</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: BAD }} /> rejected</span>
            </div>
          </div>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {view === "source" ? (
            <>
              On {BENCH_LABEL[bench]}, removing the source state entirely leaves rejection rate almost flat but{" "}
              <span className="text-foreground">success rate drops</span>{" "}— the agent accepts guidance it should have questioned. Swapping in a{" "}
              <span style={{ color: BAD }}>random</span>{" "}source state spikes rejection instead, because the model is actively comparing the current
              observation against that source, not just reading the retrieved text.
            </>
          ) : (
            <>
              Minimally editing the current state so a retrieved memory should no longer apply shifts {BENCH_LABEL[bench]} outputs away from{" "}
              <span className="text-foreground">unchanged</span>{" "}and toward{" "}
              <span style={{ color: ADAPT }}>adapted</span>{" "}and <span style={{ color: BAD }}>rejected</span>. WebShop rejects far more than ALFWorld in
              both conditions — its pages are long and heterogeneous, so a fuzzy match is riskier than a clean reject.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
