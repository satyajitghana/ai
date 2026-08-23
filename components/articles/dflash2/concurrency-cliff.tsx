"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What speculation costs when the batch fills up.
//
// Speculative decoding trades compute for memory traffic: it verifies k tokens in
// the pass that would otherwise have produced one. At batch size 1 the target
// model is memory-bound and that compute is free. As concurrency rises, batching
// is already amortizing the weight loads, arithmetic intensity climbs, and the
// extra verification work stops being free and starts being the bill.
//
// Every number here is from the Qwen3.8-27B model card: SGLang on one H200,
// FlashAttention 3, block size 8 (seven draft tokens per verification step),
// Qwen3.8's recommended sampling at xhigh reasoning effort, 4096 max new tokens.
//
// The row worth staring at is concurrency 32. Four of MTP's five tasks and four
// of DSpark's are BELOW plain autoregressive decoding — the speculation is
// actively losing throughput. DFlash 2 is the only one still above water
// everywhere, and it is above water because its acceptance length is a full token
// longer, so fewer of its verified tokens are wasted.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const TASKS = ["GSM8K", "MATH-500", "HumanEval", "MBPP", "MT-Bench"] as const

type Row = { ar: number; mtp: number; dspark: number; dflash2: number }

const DATA: Record<string, Row[]> = {
  "1": [
    { ar: 68.9, mtp: 178.5, dspark: 185.3, dflash2: 236.1 },
    { ar: 69.0, mtp: 172.8, dspark: 174.5, dflash2: 230.7 },
    { ar: 69.0, mtp: 151.9, dspark: 159.9, dflash2: 214.6 },
    { ar: 69.0, mtp: 153.1, dspark: 163.3, dflash2: 226.9 },
    { ar: 68.9, mtp: 134.9, dspark: 137.6, dflash2: 184.0 },
  ],
  "8": [
    { ar: 467.2, mtp: 1022.1, dspark: 1040.8, dflash2: 1328.7 },
    { ar: 480.0, mtp: 1023.5, dspark: 1025.8, dflash2: 1368.3 },
    { ar: 483.4, mtp: 934.2, dspark: 956.5, dflash2: 1291.5 },
    { ar: 478.0, mtp: 938.1, dspark: 974.1, dflash2: 1328.0 },
    { ar: 480.5, mtp: 835.2, dspark: 802.3, dflash2: 1090.2 },
  ],
  "32": [
    { ar: 1329.8, mtp: 1381.1, dspark: 1506.5, dflash2: 1922.5 },
    { ar: 1505.8, mtp: 1415.6, dspark: 1429.0, dflash2: 1951.8 },
    { ar: 1546.5, mtp: 1296.8, dspark: 1330.1, dflash2: 1799.0 },
    { ar: 1507.7, mtp: 1314.9, dspark: 1361.3, dflash2: 1886.8 },
    { ar: 1507.4, mtp: 1159.7, dspark: 1115.5, dflash2: 1525.3 },
  ],
}

// Per-request mean acceptance length on the same setup — the reason the
// concurrency-32 row separates the way it does.
const ACCEPT = { mtp: 4.28, dspark: 3.62, dflash2: 4.8 }

const num = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const METHODS = [
  { key: "mtp", label: "Qwen3.8's built-in MTP", color: MUTED },
  { key: "dspark", label: "community DSpark drafter", color: WARM },
  { key: "dflash2", label: "DFlash 2", color: ACCENT },
] as const

export function ConcurrencyCliff() {
  const [conc, setConc] = useState<"1" | "8" | "32">("32")
  const rows = DATA[conc]
  const losers = METHODS.flatMap((m) => rows.filter((r) => r[m.key] < r.ar).map(() => m.key)).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.8-27B · SGLang on one H200 · seven draft tokens per step
        </span>
        <span className="font-mono text-[10px]" style={{ color: losers > 0 ? WARM : GOOD }}>
          {losers > 0 ? `${losers} of 15 cells slower than no speculation` : "every method beats autoregressive"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["1", "8", "32"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConc(c)}
              aria-pressed={conc === c}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                conc === c
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              concurrency {c}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          {TASKS.map((t, i) => {
            const r = rows[i]
            const max = Math.max(r.ar, r.mtp, r.dspark, r.dflash2)
            return (
              <div key={t}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] text-foreground">{t}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    autoregressive {num(r.ar)} tok/s
                  </span>
                </div>
                <div className="relative mt-1">
                  {METHODS.map((m, j) => {
                    const v = r[m.key]
                    const sp = v / r.ar
                    const bad = sp < 1
                    return (
                      <div key={m.key} className="flex items-center gap-2">
                        <div className="relative h-[9px] flex-1 rounded-sm bg-muted/30">
                          <div
                            className="absolute left-0 h-[9px] rounded-sm"
                            style={{ width: `${(v / max) * 100}%`, background: m.color, opacity: m.key === "dflash2" ? 1 : 0.55 }}
                            title={`${m.label}: ${num(v)} tok/s`}
                          />
                          {j === 0 ? (
                            <div
                              className="absolute top-[-1px] h-[calc(3*11px)] border-l border-dashed"
                              style={{ left: `${(r.ar / max) * 100}%`, borderColor: GOOD, opacity: 0.6 }}
                            />
                          ) : null}
                        </div>
                        <span className="w-16 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                          {num(v)}
                        </span>
                        <span
                          className="w-12 shrink-0 text-right font-mono text-[9px] tabular-nums"
                          style={{ color: bad ? WARM : m.key === "dflash2" ? ACCENT : "inherit" }}
                        >
                          {sp.toFixed(2)}×
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {METHODS.map((m) => (
            <span key={m.key} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: m.color, opacity: m.key === "dflash2" ? 1 : 0.55 }}
              />
              {m.label} · accepts {ACCEPT[m.key].toFixed(2)}
            </span>
          ))}
          <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: GOOD }}>
            <span className="inline-block h-2 w-3 border-l border-dashed" style={{ borderColor: GOOD }} />
            no speculation at all
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Start at concurrency 1, where every speculative method looks like a straightforward win, then step to 32.
          Four of MTP&rsquo;s five tasks and four of DSpark&rsquo;s fall{" "}
          <span className="text-foreground">below the dashed line</span>: at that batch size the speculation is
          costing more compute than the memory traffic it saves, and turning it off would be faster. MT-Bench is
          the worst cell — MTP at 0.77×, DSpark at 0.74×.
          <br />
          <br />
          Nothing about that is a bug. Batching already amortizes the weight loads that speculation exists to
          amortize, so as arithmetic intensity climbs, verifying seven tokens to keep three or four is simply
          waste. Which is why acceptance length is not a leaderboard statistic but the thing that decides whether
          the technique still applies at all: DFlash 2 carries{" "}
          <span className="text-foreground">a full extra token per pass</span>{" "}over DSpark on this model, and that
          is the entire difference between staying above water at 32 and not.
        </p>
      </div>
    </figure>
  )
}
