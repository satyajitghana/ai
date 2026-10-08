"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Score versus speed, from JetBrains' own numbers only.
//   scores: the Mellum2.1-12B-A2.5B-Thinking model card's evaluation table
//           (all four models run by JetBrains through one pipeline, thinking mode)
//   speed:  the blog's "Model comparison" chart (vLLM, FP8, one H200,
//           2,304 tokens in / 256 out). Mellum2 has no bar there; the blog says
//           the architecture is unchanged and 2.1 "is as fast as Mellum2", so it
//           is drawn at Mellum2.1's no-draft speed, hollow, and only in the
//           no-draft modes.
// A model is on the frontier when no other model is at least as fast AND at
// least as good on the chosen benchmark. Pure arithmetic, SSR-safe.

type Model = "m21" | "m2" | "qwen" | "gemma"

const MODELS: { id: Model; name: string; color: string }[] = [
  { id: "m21", name: "Mellum2.1", color: "oklch(0.62 0.17 245)" },
  { id: "m2", name: "Mellum2", color: "oklch(0.55 0.08 250)" },
  { id: "qwen", name: "Qwen3.5-9B", color: "oklch(0.64 0.15 35)" },
  { id: "gemma", name: "Gemma 4 E4B", color: "oklch(0.62 0.14 150)" },
]

type Bench = { key: string; name: string; group: string; s: Record<Model, number> }

const BENCHES: Bench[] = [
  { key: "swev", name: "SWE-bench Verified", group: "Agentic", s: { m21: 47.0, m2: 2.0, gemma: 23.0, qwen: 50.0 } },
  { key: "tb", name: "Terminal-Bench 2.1", group: "Agentic", s: { m21: 17.4, m2: 0.6, gemma: 3.4, qwen: 21.7 } },
  { key: "swep", name: "SWE-bench Pro", group: "Agentic", s: { m21: 28.0, m2: 0.0, gemma: 4.0, qwen: 38.0 } },
  { key: "lcb", name: "LiveCodeBench v6", group: "Coding", s: { m21: 82.0, m2: 69.4, gemma: 69.4, qwen: 75.4 } },
  { key: "he", name: "HumanEval+", group: "Coding", s: { m21: 91.5, m2: 90.9, gemma: 89.1, qwen: 89.6 } },
  { key: "mbpp", name: "MBPP+", group: "Coding", s: { m21: 79.4, m2: 75.4, gemma: 70.9, qwen: 69.8 } },
  { key: "aime", name: "AIME 25/26", group: "Math", s: { m21: 83.3, m2: 60.1, gemma: 45.0, qwen: 86.7 } },
  { key: "gsm", name: "GSM-Plus", group: "Math", s: { m21: 88.3, m2: 87.1, gemma: 87.4, qwen: 91.4 } },
  { key: "bfcl", name: "BFCL v4", group: "Tool use", s: { m21: 62.3, m2: 49.6, gemma: 52.5, qwen: 58.5 } },
  { key: "wb", name: "WorkBench", group: "Tool use", s: { m21: 44.6, m2: 45.1, gemma: 46.1, qwen: 39.7 } },
  { key: "th", name: "ToolHop", group: "Tool use", s: { m21: 49.1, m2: 46.7, gemma: 39.9, qwen: 52.0 } },
  { key: "ife", name: "IFEval", group: "Chat", s: { m21: 90.6, m2: 79.5, gemma: 90.8, qwen: 92.4 } },
  { key: "gpqa", name: "GPQA Diamond", group: "Knowledge", s: { m21: 64.6, m2: 51.0, gemma: 53.1, qwen: 77.8 } },
  { key: "mmlu", name: "MMLU-Redux", group: "Knowledge", s: { m21: 87.8, m2: 86.0, gemma: 84.9, qwen: 89.5 } },
  { key: "mix", name: "MixEval-Hard", group: "Knowledge", s: { m21: 46.4, m2: 41.6, gemma: 41.4, qwen: 50.3 } },
]

type Mode = "sync" | "syncDraft" | "tput" | "tputDraft"

// output tokens/s from the blog chart; null = not measured in that mode
const SPEED: Record<Mode, { label: string; axis: string; v: Record<Model, number | null> }> = {
  sync: {
    label: "one request",
    axis: "output tokens/s, one request at a time",
    v: { m21: 339, m2: 339, qwen: 241, gemma: 232 },
  },
  syncDraft: {
    label: "one request + drafts",
    axis: "output tokens/s, one request, MTP or drafter on",
    v: { m21: 557, m2: null, qwen: 426, gemma: 607 },
  },
  tput: {
    label: "saturated",
    axis: "output tokens/s, server saturated",
    v: { m21: 7969, m2: 7969, qwen: 4347, gemma: 6099 },
  },
  tputDraft: {
    label: "saturated + drafts",
    axis: "output tokens/s, saturated, MTP or drafter on",
    v: { m21: 8533, m2: null, qwen: 4373, gemma: 6618 },
  },
}

const VW = 640
const VH = 360
const PL = 52
const PR = 24
const PT = 18
const PB = 46

export function ScoreSpeedFrontier() {
  const [bk, setBk] = useState("swev")
  const [mode, setMode] = useState<Mode>("tput")
  const bench = BENCHES.find((b) => b.key === bk) ?? BENCHES[0]
  const sp = SPEED[mode]

  const pts = MODELS.flatMap((m) => {
    const x = sp.v[m.id]
    if (x === null) return []
    return [{ ...m, x, y: bench.s[m.id] }]
  })

  const onFrontier = (p: (typeof pts)[number]) =>
    !pts.some((q) => q.id !== p.id && q.x >= p.x && q.y >= p.y && (q.x > p.x || q.y > p.y))

  const xMax = Math.max(...pts.map((p) => p.x)) * 1.15
  const yLo = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.y)) - 8) / 10) * 10)
  const yHi = Math.min(100, Math.ceil((Math.max(...pts.map((p) => p.y)) + 6) / 10) * 10)
  const sx = (x: number) => PL + (x / xMax) * (VW - PL - PR)
  const sy = (y: number) => PT + ((yHi - y) / (yHi - yLo)) * (VH - PT - PB)

  const xStep = xMax > 4000 ? 2000 : xMax > 400 ? 100 : 50
  const xTicks: number[] = []
  for (let t = 0; t <= xMax; t += xStep) xTicks.push(t)
  const yTicks: number[] = []
  for (let t = yLo; t <= yHi; t += 10) yTicks.push(t)

  const front = pts.filter(onFrontier).sort((a, b) => a.x - b.x)
  // staircase through the frontier: from the fastest-best down to the slowest
  let stair = ""
  front.forEach((p, i) => {
    if (i === 0) stair += `M ${sx(0)} ${sy(p.y)} L ${sx(p.x)} ${sy(p.y)}`
    else stair += ` L ${sx(front[i - 1].x)} ${sy(p.y)} L ${sx(p.x)} ${sy(p.y)}`
    if (i === front.length - 1) stair += ` L ${sx(p.x)} ${sy(yLo)}`
  })

  const m21 = pts.find((p) => p.id === "m21")
  const best = pts.reduce((a, b) => (b.y > a.y ? b : a))
  const fastest = pts.reduce((a, b) => (b.x > a.x ? b : a))

  const groups = Array.from(new Set(BENCHES.map((b) => b.group)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>score vs speed · JetBrains&apos; numbers</span>
        <span className="text-muted-foreground/50">1x H200 · FP8</span>
      </div>

      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
          {groups.map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 font-mono text-[10px] text-muted-foreground">{g}</span>
              {BENCHES.filter((b) => b.group === g).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={bk === b.key}
                  onClick={() => setBk(b.key)}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors",
                    bk === b.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">speed</span>
          {(Object.keys(SPEED) as Mode[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors",
                mode === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {SPEED[k].label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${bench.name} score against ${sp.axis}`}
        >
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={PL} x2={VW - PR} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.55}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={`x${t}`}
              x={sx(t)}
              y={VH - PB + 14}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.55}
            >
              {t.toLocaleString("en-US")}
            </text>
          ))}
          <text x={(PL + VW - PR) / 2} y={VH - 8} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
            {sp.axis}
          </text>
          <text
            x={12}
            y={(PT + VH - PB) / 2}
            textAnchor="middle"
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.7}
            transform={`rotate(-90 12 ${(PT + VH - PB) / 2})`}
          >
            {bench.name} (%)
          </text>

          <path d={stair} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />

          {pts.map((p) => {
            const f = onFrontier(p)
            const hollow = p.id === "m2"
            return (
              <g key={p.id}>
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={p.id === "m21" ? 8 : 6.5}
                  fill={hollow ? "var(--background)" : p.color}
                  stroke={p.color}
                  strokeWidth={hollow ? 2 : f ? 2.5 : 1}
                  fillOpacity={f || hollow ? 1 : 0.45}
                />
                <text
                  x={sx(p.x) + (sx(p.x) > VW - 150 ? -12 : 12)}
                  y={sy(p.y) + (p.id === "m2" ? 14 : -8)}
                  textAnchor={sx(p.x) > VW - 150 ? "end" : "start"}
                  fontSize={11}
                  fill="currentColor"
                  fillOpacity={f ? 0.95 : 0.6}
                >
                  {p.name} · {p.y.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          On <span className="text-foreground">{bench.name}</span>, measured {sp.label}:{" "}
          {best.id === "m21" ? (
            <>Mellum2.1 has the top score outright.</>
          ) : (
            <>
              the top score is {best.name}&apos;s{" "}
              <span className="font-mono text-foreground">{best.y.toFixed(1)}</span>
              {m21 ? (
                <>
                  , and Mellum2.1 sits{" "}
                  <span className="font-mono text-foreground">{(best.y - m21.y).toFixed(1)}</span> points under it.
                </>
              ) : (
                <>.</>
              )}
            </>
          )}{" "}
          {fastest.id === "m21" ? (
            <>Mellum2.1 is the fastest point. </>
          ) : (
            <>{fastest.name} is the fastest point. </>
          )}
          On the dashed staircase (nothing both faster and better):{" "}
          <span className="text-foreground">{front.map((p) => p.name).join(", ")}</span>.
          {mode === "syncDraft" || mode === "tputDraft" ? (
            <> Mellum2.1&apos;s MTP head is not in the released weights yet, so these two points are not reproducible today.</>
          ) : null}
        </p>
      </div>
    </figure>
  )
}
