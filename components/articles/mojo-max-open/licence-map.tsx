"use client"

// Which licence covers which part of github.com/modular/modular, and what each
// lets you do.
//
// Line counts are measured from the repository at da0db31 (2026-10-23): every
// tracked .mojo/.py/.cpp/.h/.c/.td/.mlir/.rs/.cu file, classified by the
// licence named in its own header (the first ~2.5 KB), which is what Modular's
// launch post says governs ("Each source file includes a header identifying
// the license that applies to it"). Files with no header at all are almost
// entirely MLIR lit tests; they are shown as "no header". Tests, docs and
// examples directories are left out of the rows below; the totals in the
// article include them.
//
// The verdicts are read from the MAX License text (Last Modified 2026-10-21)
// and Apache-2.0 with LLVM Exceptions. They are a reading, not legal advice.

import { useState } from "react"

type Lic = "apache" | "max" | "none"
type Row = {
  name: string
  path: string
  what: string
  lines: Partial<Record<Lic, number>>
}

const ROWS: Row[] = [
  { name: "MAX kernels", path: "max/kernels", what: "Mojo compute kernels: matmul, attention, MoE", lines: { apache: 1078917, none: 195 } },
  { name: "MAX Python framework + serving", path: "max/python/max", what: "graph API, pipelines, OpenAI-style server", lines: { apache: 512284, max: 15479 } },
  { name: "Mojo compiler", path: "Mojo/lib, include, tools", what: "parser, KGEN and POP dialects, elaborator, LLVM lowering", lines: { apache: 330903 } },
  { name: "Mojo standard library", path: "Mojo/stdlib", what: "SIMD, collections, memory, algorithm", lines: { apache: 196851 } },
  { name: "Graph compiler", path: "GraphCompiler", what: "RMO, MO, MAP, MOGG, MGP dialects; fusion", lines: { max: 146198, none: 67569 } },
  { name: "MLRT runtime", path: "MLRT", what: "GraphRT, Driver, Core", lines: { max: 67117, none: 2400 } },
  { name: "MAX GPU programming in Mojo", path: "max/mojo", what: "layouts, tiles, GPU intrinsics", lines: { apache: 59338 } },
  { name: "Support libraries", path: "Support", what: "shared C++ utilities", lines: { apache: 55998, max: 1415, none: 1607 } },
  { name: "Driver, Mojo side", path: "max/driver", what: "device and buffer API", lines: { max: 16548 } },
  { name: "AsyncRT", path: "AsyncRT", what: "thread pool, async values", lines: { apache: 14838, none: 54 } },
  { name: "Hardware plugins", path: "Target", what: "CPU, CUDA, HIP, Metal", lines: { max: 13739 } },
  { name: "HAL C API", path: "SDK/include/HAL", what: "the interface a vendor plugin implements", lines: { max: 1911 } },
]

type Verdict = "yes" | "no" | "if"
type Action = {
  id: string
  label: string
  apache: Verdict
  max: Verdict
  note: string
}

const ACTIONS: Action[] = [
  {
    id: "read",
    label: "Read it, point an agent at it",
    apache: "yes",
    max: "yes",
    note: "The MAX License says outright that it does not restrict using AI tools to read, analyze, improve or explain MAX.",
  },
  {
    id: "ship",
    label: "Ship it inside a commercial product",
    apache: "yes",
    max: "if",
    note: "MAX parts go out in object code only, with a copy of the licence, inside an application with material additional functionality.",
  },
  {
    id: "host",
    label: "Sell hosted inference on it",
    apache: "yes",
    max: "if",
    note: "A legal entity selling MAX as a hosted service must carry the Modular Accelerated mark, and needs Modular's written approval for the materials.",
  },
  {
    id: "anyhw",
    label: "Run it on any number of accelerators",
    apache: "yes",
    max: "yes",
    note: "The pre-August Community License capped commercial use at eight non-NVIDIA accelerators. Neither current text has a cap.",
  },
  {
    id: "pr",
    label: "Fork it on GitHub to send a fix",
    apache: "yes",
    max: "yes",
    note: "Section 1.3 is the new clause: modified source may be published in a fork of the official repository, to contribute back.",
  },
  {
    id: "publish",
    label: "Publish a modified version elsewhere",
    apache: "yes",
    max: "no",
    note: "Outside a contribution fork, modified MAX-License source may not be published. A long-lived vendor fork is what the alliance tier is for.",
  },
  {
    id: "reimpl",
    label: "Feed it to a model to build a replacement",
    apache: "yes",
    max: "no",
    note: "MAX-License code may not be training, fine-tuning or input data for software that reimplements or substitutes for MAX.",
  },
]

const FILL: Record<Lic, string> = {
  apache: "var(--color-chart-2, #2a9d8f)",
  max: "var(--color-chart-5, #e76f51)",
  none: "var(--color-muted-foreground, #888)",
}

const LABEL: Record<Lic, string> = {
  apache: "Apache-2.0 with LLVM Exceptions",
  max: "MAX License",
  none: "no header (mostly MLIR tests)",
}

const fmt = (n: number) => n.toLocaleString("en-US")
const total = (r: Row) => (r.lines.apache ?? 0) + (r.lines.max ?? 0) + (r.lines.none ?? 0)
const MAXT = Math.max(...ROWS.map(total))

function mark(v: Verdict) {
  if (v === "yes") return { t: "yes", cls: "text-emerald-600 dark:text-emerald-400" }
  if (v === "if") return { t: "with conditions", cls: "text-amber-600 dark:text-amber-400" }
  return { t: "no", cls: "text-rose-600 dark:text-rose-400" }
}

export function LicenceMap() {
  const [act, setAct] = useState<string>("publish")
  const a = ACTIONS.find((x) => x.id === act) ?? ACTIONS[0]

  const verdictFor = (r: Row): Verdict => {
    const hasMax = (r.lines.max ?? 0) > 0
    const hasApache = (r.lines.apache ?? 0) > 0
    if (hasMax && !hasApache) return a.max
    if (!hasMax) return a.apache
    // mixed component: the stricter verdict applies to its MAX-License part
    return a.max
  }

  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        github.com/modular/modular at <code>da0db31</code> &middot; lines of code by the licence in each file&apos;s header &middot; pick something you want to do
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
        {ACTIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setAct(x.id)}
            aria-pressed={x.id === act}
            className={
              "rounded-full border px-2.5 py-1 text-xs transition-colors " +
              (x.id === act
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 text-sm">
        <span className="font-medium">{a.label}.</span>{" "}
        Apache parts: <span className={mark(a.apache).cls}>{mark(a.apache).t}</span>.{" "}
        MAX-License parts: <span className={mark(a.max).cls}>{mark(a.max).t}</span>.{" "}
        <span className="text-muted-foreground">{a.note}</span>
      </div>

      <div className="space-y-1.5 px-3 pb-3">
        {ROWS.map((r) => {
          const v = verdictFor(r)
          const m = mark(v)
          const t = total(r)
          return (
            <div key={r.path} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,15rem)_1fr_7.5rem]">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{r.path}</div>
              </div>
              <div className="flex h-4 min-w-0 items-center" title={`${fmt(t)} lines: ${r.what}`}>
                {(["apache", "max", "none"] as Lic[]).map((k) =>
                  r.lines[k] ? (
                    <div
                      key={k}
                      style={{
                        width: `${((r.lines[k] as number) / MAXT) * 100}%`,
                        minWidth: 2,
                        background: FILL[k],
                        opacity: k === "none" ? 0.45 : 0.9,
                      }}
                      className="h-full first:rounded-l-sm last:rounded-r-sm"
                    />
                  ) : null,
                )}
                <span className="ml-1.5 shrink-0 font-mono text-[10px] text-muted-foreground">{fmt(t)}</span>
              </div>
              <div className={"text-right font-mono text-[11px] " + m.cls}>{m.t}</div>
            </div>
          )
        })}
      </div>

      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
        {(["apache", "max", "none"] as Lic[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FILL[k], opacity: k === "none" ? 0.45 : 0.9 }} />
            {LABEL[k]}
          </span>
        ))}
        <span>A mixed row takes the MAX-License verdict for its MAX-License files. My reading of the two texts, not legal advice.</span>
      </figcaption>
    </figure>
  )
}
