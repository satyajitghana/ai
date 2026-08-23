"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Three scales, and what each one is competing against.
//
// The flagship result gets the headlines, but the release is more interesting
// read as a ladder, because the same training loop is applied at 397B, 35B-A3B
// and 9B dense and the comparison set changes completely at each rung.
//
// The 35B is the one that rewards attention. It activates 3B parameters per token
// and beats dense models an order of magnitude larger in activated compute — and
// on four benchmarks it beats Qwen3.5-397B, a model eleven times its total size.
//
// All numbers are the project page's own tables, averaged over five runs.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Cmp = { l: string; sub: string; v: number; c: string }
type Rung = {
  key: string
  label: string
  active: string
  sub: string
  rows: { b: string; self: number; others: Cmp[] }[]
  note: string
}

const RUNGS: Rung[] = [
  {
    key: "397",
    label: "Ornith-1.5-397B",
    active: "MoE flagship",
    sub: "against the frontier, open and closed",
    rows: [
      {
        b: "Terminal-Bench 2.1",
        self: 86.1,
        others: [
          { l: "Claude Opus 4.8", sub: "closed", v: 85.0, c: WARM },
          { l: "GLM-5.2", sub: "753B", v: 81.0, c: MUTED },
          { l: "Kimi K3", sub: "2.8T", v: 88.3, c: MUTED },
        ],
      },
      {
        b: "SWE-bench Verified",
        self: 86.0,
        others: [
          { l: "Claude Opus 4.8", sub: "closed", v: 85.8, c: WARM },
          { l: "GLM-5.2", sub: "753B", v: 83.0, c: MUTED },
          { l: "Kimi K3", sub: "2.8T", v: 86.2, c: MUTED },
        ],
      },
      {
        b: "HLE (no tools)",
        self: 44.6,
        others: [
          { l: "Claude Opus 4.8", sub: "closed", v: 49.8, c: WARM },
          { l: "GLM-5.2", sub: "753B", v: 40.5, c: MUTED },
          { l: "Kimi K3", sub: "2.8T", v: 43.5, c: MUTED },
        ],
      },
    ],
    note: "Beats GLM-5.2 — nearly twice its size — on nine of ten reported rows, and trades with Claude Opus 4.8. The honest counterweight is Kimi K3 at 2.8T, which leads on Terminal-Bench, DeepSWE and BrowseComp.",
  },
  {
    key: "35",
    label: "Ornith-1.5-35B-A3B",
    active: "3B active per token",
    sub: "against its own size class, and one model eleven times larger",
    rows: [
      {
        b: "Terminal-Bench 2.1",
        self: 68.5,
        others: [
          { l: "Qwen3.6-35B-A3B", sub: "same shape", v: 49.2, c: ACCENT },
          { l: "Muse-Glimmer-30B", sub: "dense", v: 51.7, c: MUTED },
          { l: "Gemma-4-31B", sub: "dense", v: 43.4, c: MUTED },
          { l: "Qwen3.5-397B", sub: "11× larger", v: 48.6, c: WARM },
        ],
      },
      {
        b: "SWE-bench Verified",
        self: 79.0,
        others: [
          { l: "Qwen3.6-35B-A3B", sub: "same shape", v: 73.4, c: ACCENT },
          { l: "Muse-Glimmer-30B", sub: "dense", v: 76.0, c: MUTED },
          { l: "Gemma-4-31B", sub: "dense", v: 52.0, c: MUTED },
          { l: "Qwen3.5-397B", sub: "11× larger", v: 76.4, c: WARM },
        ],
      },
      {
        b: "SWE Atlas – QnA",
        self: 39.8,
        others: [
          { l: "Qwen3.6-35B-A3B", sub: "same shape", v: 15.5, c: ACCENT },
          { l: "Qwen3.5-397B", sub: "11× larger", v: 20.4, c: WARM },
        ],
      },
    ],
    note: "The rung that most rewards attention. Same parameter count and same active count as Qwen3.6-35B-A3B, and it leads every coding and agentic benchmark reported — several by more than fifteen points. It also beats Qwen3.5-397B on Terminal-Bench, SWE-bench Pro, NL2Repo and SWE Atlas QnA.",
  },
  {
    key: "9",
    label: "Ornith-1.5-9B",
    active: "dense · phone-deployable",
    sub: "against models three times its size",
    rows: [
      {
        b: "Terminal-Bench 2.1",
        self: 46.2,
        others: [
          { l: "Qwen3.5-9B", sub: "same size", v: 21.3, c: ACCENT },
          { l: "Gemma-4-31B", sub: "3.4× larger", v: 42.1, c: MUTED },
          { l: "Qwen3.6-35B-A3B", sub: "3.9× larger", v: 52.5, c: WARM },
        ],
      },
      {
        b: "SWE-bench Verified",
        self: 70.6,
        others: [
          { l: "Qwen3.5-9B", sub: "same size", v: 53.2, c: ACCENT },
          { l: "Gemma-4-31B", sub: "3.4× larger", v: 52.0, c: MUTED },
          { l: "Qwen3.6-35B-A3B", sub: "3.9× larger", v: 73.4, c: WARM },
        ],
      },
      {
        b: "GPQA Diamond",
        self: 86.4,
        others: [
          { l: "Qwen3.5-9B", sub: "same size", v: 81.7, c: ACCENT },
          { l: "Gemma-4-31B", sub: "3.4× larger", v: 84.3, c: MUTED },
          { l: "Qwen3.6-35B-A3B", sub: "3.9× larger", v: 86.0, c: WARM },
        ],
      },
    ],
    note: "Matches or exceeds models three times its size on most rows, and ships a quantized Mobile build for iPhone and Android. It lands just short of Qwen3.6-35B-A3B on the coding rows, which is the right comparison to lose.",
  },
]

export function ScaleLadder() {
  const [sel, setSel] = useState("35")
  const r = RUNGS.find((x) => x.key === sel) ?? RUNGS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one training loop, three scales · every number averaged over five independent runs
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          MIT · FP8, GGUF, MLX, NVFP4
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {RUNGS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} · {x.active}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{r.sub}</div>

        <div className="mt-3 space-y-3">
          {r.rows.map((row) => {
            const max = Math.max(row.self, ...row.others.map((o) => o.v))
            return (
              <div key={row.b}>
                <div className="font-mono text-[10px] text-foreground">{row.b}</div>
                <div className="mt-1 space-y-[3px]">
                  <div className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-right font-mono text-[10px]" style={{ color: GOOD }}>
                      {r.label}
                    </span>
                    <div className="h-[10px] flex-1 rounded-sm bg-muted/30">
                      <div className="h-[10px] rounded-sm" style={{ width: `${(row.self / max) * 100}%`, background: GOOD }} />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: GOOD }}>
                      {row.self.toFixed(1)}
                    </span>
                  </div>
                  {row.others.map((o) => (
                    <div key={o.l} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                        {o.l} <span className="opacity-60">· {o.sub}</span>
                      </span>
                      <div className="h-[10px] flex-1 rounded-sm bg-muted/30">
                        <div className="h-[10px] rounded-sm" style={{ width: `${(o.v / max) * 100}%`, background: o.c, opacity: 0.55 }} />
                      </div>
                      <span
                        className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                        style={{ color: o.v > row.self ? WARM : "inherit" }}
                      >
                        {o.v.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{r.note}</div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Select the 35B and look at the SWE Atlas QnA row.{" "}
          <span className="text-foreground">39.8 against 15.5</span>{" "}for a model with the identical parameter
          count and identical active count — Qwen3.6-35B-A3B is not a weaker architecture, it is the same
          architecture without this training loop. And 39.8 against 20.4 for Qwen3.5-397B, a model eleven times
          larger.
          <br />
          <br />
          That comparison is the one that carries the release&rsquo;s actual argument, more than the flagship
          matching Claude Opus 4.8 does. A flagship result at 397B could be a scale result. A same-shape model
          doubling its peer on an agentic benchmark cannot be.
        </p>
      </div>
    </figure>
  )
}
