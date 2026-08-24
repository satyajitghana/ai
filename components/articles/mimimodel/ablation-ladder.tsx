"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The whole argument of the project, in one table.
//
// MimiModel and the official Cactus engine run byte-identical weights — same
// 13,737,807 bytes, same SHA-256. So every point of the 20.4-point gap between
// them was engine-side, and the repository closes it with paired ablations that
// name which decision bought which rows.
//
// Numbers are from docs/official-engine-accuracy-gap.md, scored on all 961
// google/mobile-actions rows with ordered strict exact match. The percentages
// reproduce from the raw counts, which is how I know I am reading the same
// metric they are.

const TOTAL = 961

type Step = {
  id: string
  label: string
  strict: number
  names: number
  delta: string
  note: string
  kind: "baseline" | "step" | "crosscheck" | "shipped" | "official"
}

const LADDER: Step[] = [
  {
    id: "baseline",
    label: "recent 256 · reasoning cap 90 · segmented decoder",
    strict: 469,
    names: 759,
    delta: "baseline",
    kind: "baseline",
    note: "Where the engine started. The failure was not diffuse floating-point drift: on paired rows the official engine alone passed 244 and this one alone passed 48, and the 196-row net difference decomposes into call count (103), tool selection (16) and arguments (77).",
  },
  {
    id: "reasoning",
    label: "reasoning cap 90 → 256",
    strict: 513,
    names: 839,
    delta: "+44",
    kind: "step",
    note: "The old loop gave the model 90 reasoning tokens and then forced its JSON decoder open whether or not <tool_call> had appeared. With the full prefix present, 139 of 961 rows had not opened the marker by token 90. At 256, 960 do. It costs nothing in the median case, because generation stops the moment the marker appears — this is a pure bug fix wearing a hyperparameter's clothes.",
  },
  {
    id: "crosscheck",
    label: "full prefix sink · reasoning cap 90",
    strict: 516,
    names: 792,
    delta: "cross-check",
    kind: "crosscheck",
    note: "Run to prove the two fixes are not the same fix. Context alone, with the short cap still in place, buys 47 rows — a different 47, since applying context after the cap raise buys 63 more. Ablations that only ever run in one order cannot tell you this.",
  },
  {
    id: "prefix",
    label: "full prefix sink · reasoning cap 256",
    strict: 576,
    names: 877,
    delta: "+63",
    kind: "step",
    note: "The sliding window was evicting the system instructions and the head of the tool block during decode. Protecting the prompt prefix as an attention sink keeps them addressable the whole way through.",
  },
  {
    id: "grammar",
    label: "+ continuous byte grammar",
    strict: 672,
    names: 876,
    delta: "+96",
    kind: "step",
    note: "The largest single win, and the least like a hyperparameter. Instead of teacher-forcing JSON structure in separate decoder steps, every candidate token is validated byte-by-byte against one grammar compiled from the active tool schemas. Output is schema-valid without disturbing the model's natural token history.",
  },
  {
    id: "shipped",
    label: "160-token sink (what fits on the ESP32)",
    strict: 669,
    names: 873,
    delta: "−3",
    kind: "shipped",
    note: "The configuration that actually ships. Capping the sink at 160 tokens keeps the int8 KV cache at 416 physical rows — the same allocation the old ring used — and costs exactly three rows against an unbounded prefix. This is the number to quote.",
  },
  {
    id: "official",
    label: "official Cactus engine 2.0.2",
    strict: 665,
    names: 943,
    delta: "reference",
    kind: "official",
    note: "The reference, and the reason to be careful with the headline. Strict accuracy is now marginally above it — but tool-name accuracy is 98.1% against 90.8%, and the two engines do not fail on the same rows. Beating a baseline on one metric while losing badly on another is not the same as being better.",
  },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const colorFor = (k: Step["kind"]) =>
  k === "shipped" ? GOOD : k === "official" ? MUTED : k === "crosscheck" ? WARM : ACCENT

export function AblationLadder() {
  const [sel, setSel] = useState(5)
  const [metric, setMetric] = useState<"strict" | "names">("strict")
  const cur = LADDER[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          google/mobile-actions · 961 rows · ordered strict exact match
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          identical weights throughout
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["strict", "strict exact match"],
              ["names", "tool-name accuracy"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {LADDER.map((s, i) => {
            const v = metric === "strict" ? s.strict : s.names
            const pct = (100 * v) / TOTAL
            const c = colorFor(s.kind)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                  i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  s.kind === "crosscheck" && "opacity-70",
                )}
              >
                <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">
                  {s.label}
                </span>
                <div className="h-5 flex-1 rounded-sm bg-muted/40">
                  <div className="h-5 rounded-sm" style={{ width: `${pct}%`, background: c }} />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {v}/{TOTAL}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: c }}>
                  {pct.toFixed(1)}%
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {metric === "strict" ? s.delta : ""}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: colorFor(cur.kind) }}>
            {cur.label} · {metric === "strict" ? cur.strict : cur.names}/{TOTAL}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{cur.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The arithmetic closes exactly:{" "}
          <span className="font-mono text-foreground">469 + 44 + 63 + 96 − 3 = 669</span>. Every recovered row is
          attributed to a named decision, and the decisions were tested in both orders to show they are not the
          same decision twice. Nothing about the model changed across this entire table — the weights are
          byte-identical to the official engine&rsquo;s, same 13,737,807 bytes, same SHA-256. That is{" "}
          <span className="text-foreground">20.8 points of accuracy that lived in the decode loop</span>, not in
          the parameters.
        </p>
      </div>
    </figure>
  )
}
