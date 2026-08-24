"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The optimization log, and the part of it that failed.
//
// Both halves are in the repository's own README. The failures are the more
// useful half: each one names a plausible idea, the measurement that killed it,
// and why — which is the thing almost nobody publishes.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const WINS = [
  { l: "baseline scalar C", v: "0.64 / 0.59 tok/s", w: 6, note: "prefill / decode, before any of the below." },
  { l: "dual-core split", v: "~1.8×", w: 34, note: "matvec split by rows, attention split by KV heads." },
  { l: "skip the logits head during prefill", v: "+10% prefill", w: 40, note: "8192×512 — nothing reads it until the last prefill position." },
  { l: "byte-LUT decode + quad-row kernel", v: "+18%", w: 48, note: "four rows share each activation load." },
  { l: "hot scratch into internal SRAM", v: "+5%", w: 52, note: "42 KB moved off PSRAM." },
  { l: "opportunistic PSRAM weight cache", v: "+8%", w: 58, note: "copy the hottest matrices at boot if there is room." },
  { l: "TIE728 vector loads + 2-row kernel", v: "5.272 → 3.781 ms", w: 74, note: "512×512 matvec, single core; 2.700 → 1.960 ms dual-core." },
  { l: "cross-operator scheduling", v: "−5.9% cold", w: 80, note: "mHC/Sinkhorn and gate work run during independent core-0 work." },
  { l: "request-sized PSRAM weight tier", v: "−2.3% warm", w: 84, note: "ordered by profiled projection cost; releases itself before KV resizing." },
  { l: "shipped default, one fixed tool", v: "2.11 / 1.73 tok/s", w: 92, note: "32.770 s cold, 14.914 s warm." },
  { l: "KV prefix cache", v: "8.2× end-to-end", w: 100, note: "Costs ~20% raw throughput to afford a bigger ring, and wins anyway." },
]

const FAILURES = [
  {
    l: "dense int16 PIE path",
    result: "0.32× — three times slower",
    bad: true,
    note: "Written in Xtensa assembly with ee.vmulas.s16.accx, eight MACs per instruction, and an int16 activation path. Numerically correct: self-test relative error 5.5e-5. It lost because unpacking 2-bit weights into int16 lanes dominates runtime and PIE has no 2-bit unpack instruction — the multiply-accumulates it accelerates were never the bottleneck. Kept behind -DNEEDLE_PIE, off by default.",
  },
  {
    l: "int16 arithmetic on the host",
    result: "2.3× slower than float",
    bad: true,
    note: "The compiler auto-vectorizes the float loops. SIMD wins depend on data layout and instruction coverage, not on the width of the type.",
  },
  {
    l: "linear-space Sinkhorn",
    result: "underflows to NaN",
    bad: true,
    note: "Mathematically equivalent to the log-space version, and numerically useless. Keep the log-space one.",
  },
  {
    l: "two-token blocked CQ2 kernel",
    result: "1.11× — not worth the state",
    bad: true,
    note: "Reusing each packed weight load across two activation vectors was correct but only 11% faster on the paired matvec, and a full blocked path would have added substantial state and causal-attention work. The prototype was removed.",
  },
]

export function SpeedLog() {
  const [tab, setTab] = useState<"wins" | "failures">("wins")
  const [sel, setSel] = useState(10)
  const [fsel, setFsel] = useState(0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured on hardware, 240 MHz ESP32-S3</span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          0.64 → 2.11 tok/s prefill
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["wins", "what worked"],
              ["failures", "what did not"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "wins" ? (
          <>
            <div className="mt-3 space-y-1">
              {WINS.map((x, i) => (
                <button
                  key={x.l}
                  type="button"
                  onClick={() => setSel(i)}
                  aria-pressed={i === sel}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                    i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  )}
                >
                  <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${x.w}%`, background: i === WINS.length - 1 ? GOOD : ACCENT }} />
                  </div>
                  <span className="w-32 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{x.v}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground">
              <span className="font-mono text-[11px] text-foreground">{WINS[sel].l}</span> — {WINS[sel].note}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              The bar is a rough cumulative sense of the journey, not an additive scale — these interact. The one
              worth reading twice is the last: the prefix cache{" "}
              <span className="text-foreground">gives up about 20% of raw throughput</span>{" "}to afford a larger
              ring, and still wins 8.2× end to end. Local throughput and end-to-end latency are different
              quantities, and optimizing the first can cost you the second.
            </p>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-1">
              {FAILURES.map((x, i) => (
                <button
                  key={x.l}
                  type="button"
                  onClick={() => setFsel(i)}
                  aria-pressed={i === fsel}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                    i === fsel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  )}
                >
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: WARM }} />
                  <span className="flex-1 truncate font-mono text-[11px] text-foreground">{x.l}</span>
                  <span className="shrink-0 font-mono text-[10px]" style={{ color: WARM }}>
                    {x.result}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
              {FAILURES[fsel].note}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              The PIE result is the one I would put in a talk. Hand-written vector assembly, eight
              multiply-accumulates per instruction, verified correct to 5.5e-5 — and{" "}
              <span className="text-foreground">three times slower than the C it replaced</span>, because the
              instruction set accelerated the wrong half of the loop. The unpack was the bottleneck and PIE has no
              unpack. Nothing about that is visible until you build it and measure.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
