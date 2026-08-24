"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Four public function-calling benchmarks, one narrow question: which model
// executes tool calls correctly within an on-device budget.
//
// Scoring throughout is ordered strict exact match — a row passes only if the
// function names, the call order, and every argument value match. Needle is
// measured end-to-end through the shipped C++ binary in production configuration:
// CQ2-bit weights, tool retrieval on, 256-token sliding KV window, window
// eviction included. Baselines run released checkpoints under vLLM at full
// context, at f16.
//
// Cactus states both asymmetries themselves, and they point in opposite
// directions. The baselines stay at f16 because post-hoc 2-bit quantization
// collapses models that were never trained for it — that favours the baselines.
// Needle is trained only for agentic tool calling while every baseline carries
// chat, prose and world knowledge — that favours Needle.
//
// The pattern across the four is the argument for fine-tuning, whether or not it
// was meant that way: Needle wins where the tool surface resembles its training
// distribution and loses where it does not, by margins that track distance rather
// than size.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Entry = { m: string; acc: number; extra: string; needle?: boolean }

const BENCH = [
  {
    key: "mobile",
    label: "Mobile Actions",
    sub: "961 rows · Google's consumer device actions — Needle's home distribution",
    rows: [
      { m: "LFM2.5 230M (f16)", acc: 69.1, extra: "name acc. 93.0 · 1-call 76.1 · 2-call 55.0" },
      { m: "FunctionGemma 270M (f16)", acc: 64.0, extra: "name acc. 87.3 · 1-call 73.0 · 2-call 46.2" },
      { m: "Needle 2 (CQ2-bit)", acc: 63.7, extra: "name acc. 98.3 · 1-call 71.3 · 2-call 48.4", needle: true },
      { m: "Apple FM (on-device)", acc: 57.6, extra: "name acc. 94.2 · 1-call 64.5 · 2-call 43.8" },
    ] as Entry[],
    take: "Third of four on strict accuracy — and first by five points on picking the right function at all, at 98.3%. It knows what to call and loses rows on arguments, which is the failure mode fine-tuning on your own schemas is best placed to fix.",
  },
  {
    key: "droid",
    label: "DroidCall",
    sub: "200 rows · Android intent-style calls",
    rows: [
      { m: "FunctionGemma 270M (f16)", acc: 17.5, extra: "name acc. 37.5 · non-empty 59.5" },
      { m: "Needle 2 (CQ2-bit)", acc: 17.0, extra: "name acc. 36.5 · non-empty 47.5", needle: true },
      { m: "LFM2.5 230M (f16)", acc: 11.0, extra: "name acc. 21.5 · non-empty 22.5" },
    ] as Entry[],
    take: "Everything is bad here — nobody clears 18% and every model scores zero on the two-call rows. A benchmark where the whole size class fails together says more about the benchmark's difficulty than about any model on it.",
  },
  {
    key: "sealid",
    label: "Seal-Tools in-domain",
    sub: "700 rows · large candidate tool lists, mostly multi-call",
    rows: [
      { m: "Needle 2 (CQ2-bit)", acc: 32.6, extra: "name acc. 64.9 · 1-call 63.0 · 4+-call 14.6", needle: true },
      { m: "LFM2.5 230M (f16)", acc: 26.9, extra: "name acc. 45.4 · 1-call 54.5 · 4+-call 10.4" },
      { m: "FunctionGemma 270M (f16)", acc: 16.3, extra: "name acc. 56.0 · 1-call 47.0 · 4+-call 2.1" },
    ] as Entry[],
    take: "First by six points, and by twenty over a model six times larger. Long candidate lists and multi-call rows are exactly where tool retrieval and a grammar-constrained decoder earn their place.",
  },
  {
    key: "sealood",
    label: "Seal-Tools out-of-domain",
    sub: "654 rows · entire tool domains held out of training",
    rows: [
      { m: "Needle 2 (CQ2-bit)", acc: 28.7, extra: "name acc. 58.7 · 1-call 56.4 · 4+-call 15.4", needle: true },
      { m: "LFM2.5 230M (f16)", acc: 17.0, extra: "name acc. 35.0 · 1-call 42.6 · 4+-call 9.8" },
      { m: "FunctionGemma 270M (f16)", acc: 15.6, extra: "name acc. 48.9 · 1-call 50.0 · 4+-call 6.3" },
    ] as Entry[],
    take: "The widest margin in the whole evaluation, on the test designed to measure schema generalization: 28.7 against 17.0, holding 87% of its in-domain score where LFM2.5 keeps 63%.",
  },
  {
    key: "bfcl",
    label: "BFCL v4 single-turn",
    sub: "3,641 rows · general-purpose and enterprise APIs, including Java and JavaScript SDKs",
    rows: [
      { m: "Apple FM (on-device)", acc: 61.7, extra: "Python simple 86.8 · well-formed 95.0" },
      { m: "LFM2.5 230M (f16)", acc: 60.8, extra: "Python simple 85.5 · well-formed 94.2" },
      { m: "FunctionGemma 270M (f16)", acc: 46.1, extra: "Python simple 62.3 · well-formed 100.0" },
      { m: "Needle 2 (CQ2-bit)", acc: 42.6, extra: "Python simple 61.2 · well-formed 93.4", needle: true },
    ] as Entry[],
    take: "Last, and the page says why without being asked: Needle's corpus is consumer device actions plus structured extraction, and BFCL's enterprise API surfaces sit entirely outside it. On Python simple calls it lands within a point of FunctionGemma; the gap concentrates in Java, JavaScript and parallel multi-call — categories its training data has never seen.",
  },
]

export function BenchmarkMatrix() {
  const [sel, setSel] = useState("sealood")
  const b = BENCH.find((x) => x.key === sel) ?? BENCH[0]
  const max = Math.max(...b.rows.map((r) => r.acc))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          ordered strict exact match · names, order and every argument must match
        </span>
        <span className="font-mono text-[10px]" style={{ color: b.rows[0].needle ? GOOD : WARM }}>
          Needle {b.rows.findIndex((r) => r.needle) + 1} of {b.rows.length}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCH.map((x) => (
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
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{b.sub}</div>

        <div className="mt-3 space-y-1.5">
          {b.rows.map((r) => (
            <div key={r.m}>
              <div className="flex items-center gap-2">
                <span
                  className="w-44 shrink-0 truncate text-right font-mono text-[10px]"
                  style={{ color: r.needle ? GOOD : "inherit" }}
                >
                  {r.m}
                </span>
                <div className="h-5 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-5 rounded-sm"
                    style={{ width: `${(r.acc / max) * 100}%`, background: r.needle ? GOOD : MUTED, opacity: r.needle ? 0.95 : 0.5 }}
                  />
                </div>
                <span
                  className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: r.needle ? GOOD : "inherit" }}
                >
                  {r.acc.toFixed(1)}
                </span>
              </div>
              <div className="pl-2 font-mono text-[9px] text-muted-foreground">{r.extra}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {b.take}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click through all five and a shape appears that the individual tables do not show. Needle wins by twelve
          points where entire tool domains are held out, and loses by nineteen where the tool surface is
          enterprise Java SDKs.{" "}
          <span className="text-foreground">The margin tracks distance from its training distribution, not model
          size</span>{" "}— it beats a 270M model on one benchmark and loses to it on another, at 2 bits against
          f16 in both.
          <br />
          <br />
          Which is the whole case for fine-tuning stated as an evaluation result. A generic 45M checkpoint is
          competitive on the tool vocabulary it was trained for and mediocre outside it. Your product does not
          have a generic tool vocabulary; it has a fixed, small, specific one — and a model this size is cheap
          enough to retrain on exactly that.
        </p>
      </div>
    </figure>
  )
}
