"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// "<1% of Llama-3.2-3B's pretraining FLOPs", recomputed as C = 6 * N * D under
// the choices that move it. Defaults reproduce the Rigel blog's own accounting:
// non-embedding parameters, Rigel's 4,096-context pretraining only, and
// Llama-3.2-3B charged for Llama-3.1-8B's 15T-token run (the 3B was pruned and
// distilled from it). Parameter counts: Rigel from its safetensors header,
// Llama from the published configs. Token counts: Rigel's from its batch size
// and step count (725,000 steps and 25,000 long-context steps of 4,718,592
// tokens), Llama's as Meta reports them.

const RIGEL = {
  nonEmb: 260_998_464,
  withHead: 363_758_912, // + the tied 100,352 x 1,024 embedding, which is also the output matmul
  dPre: 3_420_979_200_000,
  dLong: 117_964_800_000,
}
const LLAMA_3B = { nonEmb: 2_818_747_392, withHead: 3_212_749_824, d: 9e12 } // tied embeddings
const LLAMA_8B = { nonEmb: 6_979_588_096, withHead: 7_504_924_672, d: 15e12 } // untied: count lm_head once

type Run = "teacher" | "own" | "both"

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" }
function sci(x: number, digits = 2) {
  const [m, e] = x.toExponential(digits).split("e")
  const exp = String(Number(e))
    .split("")
    .map((c) => SUP[c] ?? c)
    .join("")
  return `${m} × 10${exp}`
}

const RUN_LABEL: Record<Run, string> = {
  teacher: "Llama-3.1-8B's 15T run (the blog's choice)",
  own: "Llama-3.2-3B's own 9T run",
  both: "both runs (the lineage)",
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export function FlopsLedger() {
  const [run, setRun] = useState<Run>("teacher")
  const [head, setHead] = useState(false)
  const [longCtx, setLongCtx] = useState(false)

  const nR = head ? RIGEL.withHead : RIGEL.nonEmb
  const dR = RIGEL.dPre + (longCtx ? RIGEL.dLong : 0)
  const cR = 6 * nR * dR

  const c3 = 6 * (head ? LLAMA_3B.withHead : LLAMA_3B.nonEmb) * LLAMA_3B.d
  const c8 = 6 * (head ? LLAMA_8B.withHead : LLAMA_8B.nonEmb) * LLAMA_8B.d
  const cL = run === "teacher" ? c8 : run === "own" ? c3 : c8 + c3

  const ratio = cL / cR
  const share = (cR / cL) * 100
  const isDefault = run === "teacher" && !head && !longCtx

  const rows = [
    { key: "rigel", label: "Rigel", value: cR, color: "oklch(0.60 0.15 255)" },
    { key: "llama", label: "Llama side", value: cL, color: "oklch(0.58 0.13 40)" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>pretraining compute · C = 6 · N · D</span>
        <span className="text-muted-foreground/60">reasoned from reported counts</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">charge Llama for</span>
            {(["teacher", "own", "both"] as Run[]).map((r) => (
              <Toggle key={r} on={run === r} onClick={() => setRun(r)}>
                {RUN_LABEL[r]}
              </Toggle>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">count N as</span>
            <Toggle on={!head} onClick={() => setHead(false)}>
              non-embedding (the blog)
            </Toggle>
            <Toggle on={head} onClick={() => setHead(true)}>
              + output head, both sides
            </Toggle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Rigel tokens</span>
            <Toggle on={!longCtx} onClick={() => setLongCtx(false)}>
              4,096-context pretraining
            </Toggle>
            <Toggle on={longCtx} onClick={() => setLongCtx(true)}>
              + long-context phase
            </Toggle>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                <span className="text-foreground">{r.label}</span>
                <span className="text-muted-foreground">{sci(r.value)} FLOPs</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${Math.max(0.4, (r.value / cL) * 100).toFixed(2)}%`, background: r.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="font-mono text-[10px] text-muted-foreground">Llama / Rigel</div>
            <div className="font-mono text-lg font-semibold">{ratio.toFixed(1)}×</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="font-mono text-[10px] text-muted-foreground">Rigel share</div>
            <div className="font-mono text-lg font-semibold">{share.toFixed(2)}%</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="font-mono text-[10px] text-muted-foreground">&quot;under 1%&quot;</div>
            <div className={cn("font-mono text-lg font-semibold", share < 1 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
              {share < 1 ? "holds" : "does not"}
            </div>
          </div>
        </div>

        <div className="mt-3 font-mono text-[10px] leading-5 text-muted-foreground">
          Rigel: 6 × {nR.toLocaleString("en-US")} × {dR.toLocaleString("en-US")}
          <br />
          {run !== "own" && (
            <>
              Llama-3.1-8B: 6 × {(head ? LLAMA_8B.withHead : LLAMA_8B.nonEmb).toLocaleString("en-US")} × 15T
              <br />
            </>
          )}
          {run !== "teacher" && <>Llama-3.2-3B: 6 × {(head ? LLAMA_3B.withHead : LLAMA_3B.nonEmb).toLocaleString("en-US")} × 9T</>}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isDefault
            ? "These defaults reproduce the blog's 117× exactly. Switch the Llama side to the 3B's own run and Rigel's share becomes about 4%; count the output head on both sides and the blog's own comparison lands at 1.1%."
            : "The defaults (8B run, non-embedding, pretraining only) reproduce the blog's 117×. Every other setting is a different, defensible question; none of them makes the gap small."}
        </p>
      </div>
    </figure>
  )
}
