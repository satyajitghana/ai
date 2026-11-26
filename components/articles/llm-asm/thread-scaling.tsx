"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { DECODE_BYTES, EPYC, I7 } from "./data"

// Decode tok/s against threads for llm.asm and llama.cpp. "GB/s" is my arithmetic:
// tok/s x the 633,491,456 weight bytes a decoded token streams (KV-cache reads not counted).
// "vs llama.cpp" divides each series by llama.cpp at the same thread count.

type View = "tps" | "gbs" | "ratio"
const W = 600
const H = 280
const PAD = { l: 48, r: 16, t: 14, b: 34 }
const COLORS: Record<string, string> = {
  fp32act: "text-slate-500",
  llama: "text-amber-600 dark:text-amber-400",
  llamanative: "text-rose-500 dark:text-rose-400",
  fastq8: "text-sky-600 dark:text-sky-400",
  os: "text-emerald-600 dark:text-emerald-400",
}

export function ThreadScaling() {
  const [view, setView] = useState<View>("tps")
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [set, setSet] = useState<"epyc" | "i7">("epyc")
  const D = set === "epyc" ? EPYC : I7
  const threads = D.threads as readonly number[]
  const llama = D.series.find((s) => s.key === "llama")!.values as readonly number[]
  const xMax = set === "epyc" ? 40 : 8

  const val = (v: number | null, i: number): number | null => {
    if (v === null) return null
    if (view === "gbs") return (v * DECODE_BYTES) / 1e9
    if (view === "ratio") return v / llama[i]
    return v
  }
  const all = D.series.flatMap((s) => (s.values as readonly (number | null)[]).map((v, i) => val(v, i))).filter((v): v is number => v !== null)
  const yMax = view === "ratio" ? 1.6 : Math.ceil((Math.max(...all) * 1.08) / 10) * 10
  const yMin = view === "ratio" ? 0.2 : 0
  const xOf = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r)
  const yOf = (v: number) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const ticks = view === "ratio" ? [0.4, 0.6, 0.8, 1, 1.2, 1.4] : Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i))
  const unit = view === "tps" ? "tok/s" : view === "gbs" ? "GB/s of weights" : "x llama.cpp"

  const tabs: [View, string][] = [
    ["tps", "tok/s"],
    ["gbs", "Weight bandwidth"],
    ["ratio", "vs llama.cpp"],
  ]

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">
        Decode speed against threads: {set === "epyc" ? "AMD EPYC 7642, the README's numbers" : "Intel i7-14700, my run on a busy box"}
      </figcaption>
      <div className="mb-2 flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={set}
          onChange={(e) => setSet(e.target.value as "epyc" | "i7")}
          aria-label="Machine"
        >
          <option value="epyc">EPYC 7642 (README)</option>
          <option value="i7">i7-14700 (my run)</option>
        </select>
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className={cn(
              "rounded-md border px-3 py-1 text-xs",
              view === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Decode ${unit} against thread count`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} className="stroke-border" strokeWidth={t === 1 && view === "ratio" ? 1.2 : 0.5} />
            <text x={PAD.l - 6} y={yOf(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {view === "ratio" ? t.toFixed(1) : t}
            </text>
          </g>
        ))}
        {threads.map((t) => (
          <text key={t} x={xOf(t)} y={H - 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {t}
          </text>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          threads
        </text>
        {D.series.map((s) => {
          if (hidden[s.key]) return null
          const pts: [number, number][] = []
          ;(s.values as readonly (number | null)[]).forEach((v, i) => {
            const y = val(v, i)
            if (y !== null) pts.push([threads[i], y])
          })
          const d = pts.map(([t, v], i) => `${i ? "L" : "M"}${xOf(t).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ")
          return (
            <g key={s.key} className={COLORS[s.key]}>
              <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={s.key === "fp32act" ? "4 3" : undefined} />
              {pts.map(([t, v]) => (
                <circle key={t} cx={xOf(t)} cy={yOf(v)} r={3} fill="currentColor">
                  <title>{`${s.label}, ${t} threads: ${view === "ratio" ? v.toFixed(2) + "x" : v.toFixed(view === "gbs" ? 1 : 2) + " " + unit}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {D.series.map((s) => (
          <li key={s.key}>
            <button
              onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
              className={cn("flex items-center gap-2 text-left text-xs", hidden[s.key] && "opacity-40")}
              aria-pressed={!hidden[s.key]}
            >
              <span className={cn("inline-block h-0.5 w-5 bg-current", COLORS[s.key])} />
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {set === "epyc" ? (
          <>
            From the repository README: 34 prompt and 64 generated tokens, three-run means. The OS column is a KVM guest on the
            same host and has no 40-thread run.
          </>
        ) : (
          <>
            My run, same prompt and lengths, on a machine with other work on it (load average 13 to 28). Both engines are slower
            at 8 threads than at 4 because of that load; read the ratios at 1 and 4. 16 and 28 threads are left out (see the
            article).
          </>
        )}{" "}
        Bandwidth is my arithmetic (tok/s times 633,491,456 weight bytes per token) and ignores the KV cache.
      </p>
    </figure>
  )
}
