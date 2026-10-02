"use client"

import { useState } from "react"

// Peak instruction-qualified speedup vs cuBLAS on B200, read off PTXBench's
// Figure 2 (the Fast^Inst_p curves, B200 row). These are the dashed-line peak
// values the paper prints next to each model. 1.0x is cuBLAS itself; a bar that
// does not reach it is a kernel slower than the library it is allowed no header
// from. On GEMM one model crosses the line. On backward-causal attention nothing
// does. "-" is a model that never produced an instruction-qualified kernel for
// that workload. All numbers are the paper's (reported); nothing here is re-run.

type Row = { name: string; gemm: number; bwd: number }

const ROWS: Row[] = [
  { name: "Claude Opus 4.8", gemm: 1.012, bwd: 0 },
  { name: "Gemini 3.1 Pro", gemm: 0.892, bwd: 0 },
  { name: "GPT-5.6 Sol", gemm: 0.818, bwd: 0.339 },
  { name: "GLM-5.2", gemm: 0.632, bwd: 0 },
  { name: "Qwen3.6-27B (base)", gemm: 0, bwd: 0 },
]

const WORKLOADS = [
  { key: "gemm" as const, label: "GEMM" },
  { key: "bwd" as const, label: "MHA-Bwd-Causal" },
]

const AXIS_MAX = 1.1
const ACCENT = "oklch(0.60 0.15 255)"
const CROSS = "oklch(0.55 0.15 150)"

export function SpeedupLine() {
  const [w, setW] = useState<"gemm" | "bwd">("gemm")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          peak speedup vs cuBLAS on B200, vendor libraries banned
        </span>
        <div className="inline-flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Workload">
          {WORKLOADS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setW(x.key)}
              aria-pressed={w === x.key}
              className={
                "rounded-md px-3 py-1 font-mono transition-colors " +
                (w === x.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="relative">
          {/* 1.0x cuBLAS reference line */}
          <div
            className="pointer-events-none absolute top-0 bottom-6 z-10 border-l border-dashed"
            style={{ left: `${(1 / AXIS_MAX) * 100}%`, borderColor: CROSS }}
            aria-hidden
          >
            <span
              className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[10px]"
              style={{ color: CROSS }}
            >
              1.0&times; cuBLAS
            </span>
          </div>

          <div className="space-y-2.5 pt-4">
            {ROWS.map((r) => {
              const v = r[w]
              const crosses = v >= 1
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:w-40">
                    {r.name}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded transition-[width] duration-200"
                      style={{
                        width: `${Math.min(100, (v / AXIS_MAX) * 100).toFixed(2)}%`,
                        background: crosses ? CROSS : ACCENT,
                      }}
                    />
                  </div>
                  <span
                    className="w-14 shrink-0 font-mono text-xs tabular-nums"
                    style={{ color: crosses ? CROSS : undefined }}
                  >
                    {v > 0 ? `${v.toFixed(3)}×` : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {w === "gemm" ? (
            <>
              On a single matrix multiply, one model reaches{" "}
              <span className="text-foreground">1.012&times; cuBLAS</span> &mdash; a hair
              past the library. Everyone else lands under it, and the base Qwen3.6-27B
              writes no correct GEMM kernel at all.
            </>
          ) : (
            <>
              On backward attention with a causal mask &mdash; the hardest workload &mdash;
              the whole field collapses. The best any model manages is{" "}
              <span className="text-foreground">0.339&times;</span>, three times slower than
              the library it may not call.
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Peak instruction-qualified Fast_p values, PTXBench Figure 2 (B200 row). Reported, not
        re-run; a dash is a model with no instruction-qualified kernel for the workload.
      </figcaption>
    </figure>
  )
}
