"use client"

import { useState, type ReactNode } from "react"

// Fewer tokens and fewer bits on one axis. For one user decoding one answer, a
// dense model is bound by memory bandwidth: each generated token streams every
// decoder weight (and the LM head) through the chip once. So the floor on the
// time to an answer is
//
//   t = N tokens  x  B bytes read per token  /  W bytes per second
//
// N comes from BottleCap's own table (mean total tokens, thinking plus answer,
// base vs ThinkingCap, xhigh). B is what streams per decoded token, summed from
// the safetensors headers: the 24,326,963,200 decoder linear weights at each
// build's width, plus the LM head, plus norms and the narrow GDN gates. The
// embedding table is a lookup (one row per token) and is left out, as are the
// vision tower and the MTP head. W is the vendor's spec bandwidth.
//
// It is a roofline, not a benchmark: it ignores KV-cache and recurrent-state
// reads, prefill, batching and MTP. Measured single-request decode lands at
// 62-75% of it on BottleCap's own RTX PRO 6000 numbers. Only arithmetic below
// (x and /), so server and client render identical bytes.

type Tok = "base" | "tc"

type Build = {
  id: string
  name: string
  fmt: string
  tok: Tok
  gbPerToken: number // GB streamed per decoded token
  diskGB: number // weights resident (for the fit check)
  hypo?: boolean
  note?: string
}

const BUILDS: Build[] = [
  { id: "base", name: "Qwen3.8-27B", fmt: "BF16", tok: "base", gbPerToken: 51.25, diskGB: 55.56 },
  {
    id: "orca",
    name: "OrcaSAQ-2",
    fmt: "EXL3, 3.21 bpw",
    tok: "base",
    gbPerToken: 10.79,
    diskGB: 12.27,
    note: "no token counts published; base counts assumed",
  },
  { id: "tc", name: "ThinkingCap", fmt: "BF16", tok: "tc", gbPerToken: 51.25, diskGB: 55.56 },
  { id: "tcfp8", name: "ThinkingCap", fmt: "FP8", tok: "tc", gbPerToken: 26.93, diskGB: 31.24 },
  { id: "tcmlx", name: "ThinkingCap", fmt: "MLX 4-bit DWQ", tok: "tc", gbPerToken: 19.76, diskGB: 22.54 },
  { id: "tcnv", name: "ThinkingCap", fmt: "NVFP4", tok: "tc", gbPerToken: 16.28, diskGB: 20.59 },
  {
    id: "both",
    name: "ThinkingCap tokens at OrcaSAQ-2 bytes",
    fmt: "not shipped",
    tok: "tc",
    gbPerToken: 10.79,
    diskGB: 12.27,
    hypo: true,
    note: "hypothetical: nobody has built this",
  },
]

const WORKLOADS = [
  { id: "avg", label: "12-benchmark mean", base: 17450, tc: 13900 },
  { id: "mmlupro", label: "MMLU-Pro", base: 3729, tc: 1595 },
  { id: "gpqa", label: "GPQA-Diamond", base: 12776, tc: 7271 },
  { id: "aime", label: "AIME 2026", base: 15673, tc: 10943 },
  { id: "lcb", label: "LiveCodeBench v6", base: 28894, tc: 23125 },
  { id: "tbench", label: "Terminal-Bench 2.1 (whole episode)", base: 90557, tc: 83763 },
] as const

const HARDWARE = [
  { id: "h200", label: "H200", bw: 4800, mem: 141 as number | null },
  { id: "pro6000", label: "RTX PRO 6000 Blackwell", bw: 1792, mem: 96 as number | null },
  { id: "rtx5080", label: "RTX 5080", bw: 960, mem: 16 as number | null },
  { id: "m4max", label: "M4 Max (16-core CPU)", bw: 546, mem: null as number | null },
] as const

const ACCENT_TOK = "oklch(0.62 0.15 160)"
const ACCENT_BIT = "oklch(0.60 0.16 265)"
const ACCENT_BOTH = "oklch(0.66 0.15 55)"

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US")

function fmtTime(s: number) {
  if (s >= 120) {
    const m = Math.floor(s / 60)
    const r = Math.round(s - m * 60)
    return `${m} min ${r.toString().padStart(2, "0")} s`
  }
  return `${s.toFixed(s < 10 ? 2 : 1)} s`
}

function colorFor(b: Build) {
  if (b.hypo) return ACCENT_BOTH
  if (b.tok === "tc" && b.gbPerToken < 51) return ACCENT_BOTH
  if (b.tok === "tc") return ACCENT_TOK
  if (b.gbPerToken < 51) return ACCENT_BIT
  return "oklch(0.60 0.02 250)"
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors " +
        (active
          ? "border-foreground/40 bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/40")
      }
    >
      {children}
    </button>
  )
}

export function AnswerCost() {
  const [wid, setWid] = useState<(typeof WORKLOADS)[number]["id"]>("avg")
  const [hid, setHid] = useState<(typeof HARDWARE)[number]["id"]>("h200")
  const [sel, setSel] = useState("tcnv")

  const w = WORKLOADS.find((x) => x.id === wid) ?? WORKLOADS[0]
  const hw = HARDWARE.find((x) => x.id === hid) ?? HARDWARE[0]

  const rows = BUILDS.map((b) => {
    const tokens = b.tok === "base" ? w.base : w.tc
    const seconds = (tokens * b.gbPerToken) / hw.bw
    const fits = hw.mem === null ? null : b.diskGB <= hw.mem
    return { b, tokens, seconds, fits }
  })
  const maxS = Math.max(...rows.map((r) => r.seconds))
  const baseS = rows[0].seconds
  const picked = rows.find((r) => r.b.id === sel) ?? rows[0]

  const tokLever = w.tc / w.base
  const nvLever = 16.28 / 51.25
  const orcaLever = 10.79 / 51.25

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          seconds per answer = tokens × bytes per token ÷ bandwidth
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          batch-1 decode roofline · bytes from headers · tokens from BottleCap
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            workload
          </span>
          {WORKLOADS.map((x) => (
            <Pill key={x.id} active={x.id === wid} onClick={() => setWid(x.id)}>
              {x.label}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            hardware
          </span>
          {HARDWARE.map((x) => (
            <Pill key={x.id} active={x.id === hid} onClick={() => setHid(x.id)}>
              {x.label} · {fmtInt(x.bw)} GB/s
            </Pill>
          ))}
        </div>

        <div className="space-y-1.5 pt-1" role="group" aria-label="builds, seconds per answer">
          {rows.map(({ b, tokens, seconds, fits }) => {
            const pct = (100 * seconds) / maxS
            const c = colorFor(b)
            const active = b.id === sel
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSel(b.id)}
                aria-pressed={active}
                className={
                  "block w-full rounded-md px-2 py-1 text-left transition-colors " +
                  (active ? "bg-muted/50" : "hover:bg-muted/30")
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[11px]">
                  <span className="text-foreground">
                    {b.name}{" "}
                    <span className="text-muted-foreground">· {b.fmt}</span>
                  </span>
                  <span className="tabular-nums text-foreground">
                    {fmtTime(seconds)}{" "}
                    <span className="text-muted-foreground">
                      ({(baseS / seconds).toFixed(2)}× faster)
                    </span>
                  </span>
                </div>
                <div className="relative mt-1 h-3 w-full rounded-sm bg-muted/40">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${pct.toFixed(2)}%`,
                      background: b.hypo ? "transparent" : c,
                      border: b.hypo ? `1.5px dashed ${c}` : undefined,
                      opacity: fits === false ? 0.35 : 1,
                    }}
                  />
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {fmtInt(tokens)} tokens × {b.gbPerToken.toFixed(2)} GB
                  {fits === false ? (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}
                      · {b.diskGB.toFixed(2)} GB of weights does not fit in {hw.mem} GB
                    </span>
                  ) : null}
                  {b.note ? <span> · {b.note}</span> : null}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">{picked.b.name}</span> ({picked.b.fmt}) on {hw.label}:{" "}
          {fmtInt(picked.tokens)} tokens × {picked.b.gbPerToken.toFixed(2)} GB ÷ {fmtInt(hw.bw)} GB/s ={" "}
          <span className="text-foreground">{fmtTime(picked.seconds)}</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">tokens lever, this workload</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: ACCENT_TOK }}>
              ×{tokLever.toFixed(3)}
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">bits lever, NVFP4</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: ACCENT_BIT }}>
              ×{nvLever.toFixed(3)}
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">bits lever, OrcaSAQ-2</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: ACCENT_BIT }}>
              ×{orcaLever.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        A floor, not a forecast: one request, weights only, no KV-cache reads, no prefill,
        no speculative decoding. The two levers multiply. At batch 1 the bits lever is the
        bigger one on all twelve of BottleCap&apos;s benchmarks; MMMLU, at ×0.346, comes
        closest to NVFP4&apos;s ×0.318. On a busy server the weights are shared across the
        batch and the ranking changes; see the measured table below.
      </figcaption>
    </figure>
  )
}
