"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// PS5LM Plus's planner (ps5/app/model_plan.cpp), redone for Qwen3.8-27B.
//
//   total = weights + KV + state + reserve      must be ≤ GiB free
//   weights  the GGUF's file size
//   KV       kv_layers · head_count_kv · (key_len + value_len) · bytes/elem · ctx
//            = 16 · 4 · (256 + 256) · bytes/elem · ctx
//            bytes/elem: f16 2, q8_0 34/32, q4_0 18/32
//   state    the 48 Gated DeltaNet layers' f32 state:
//            48 · (6144·128 + 3·(6144 + 2·16·128)) · 4 B = 0.146 GiB
//   reserve  0.75 GiB + state (the planner counts the state twice, on purpose
//            or not; we copy it)
//
// The planner walks contexts from long to short (capped at 64k by default)
// and at each length tries q8_0 then q4_0 (f16 only up to 8k); the first that
// fits wins. Budgets: 11.44 GiB is the heap RADV reports; 11.01 GiB is what is
// free once the dashboard has taken its share (both reported in the repo).

const GIB = 1073741824
const STATE = (48 * (6144 * 128 + 3 * (6144 + 2 * 16 * 128)) * 4) / GIB
const RESERVE = 0.75 + STATE
const KV_ELEMS = 16 * 4 * (256 + 256)
const PER_ELEM: Record<string, number> = { f16: 2, q8_0: 34 / 32, q4_0: 18 / 32 }

const QUANTS = [
  { key: "iq2", label: "UD-IQ2_XXS", bytes: 7266070528 },
  { key: "q2k", label: "UD-Q2_K_XL", bytes: 9828981664 },
  { key: "q3k", label: "UD-Q3_K_XL", bytes: 13146393504 },
]
const CTXS = [4096, 8192, 16384, 32768, 65536, 131072]
const KVS = ["f16", "q8_0", "q4_0"]
const BUDGETS = [
  { v: 11.44, label: "heap 11.44" },
  { v: 11.01, label: "free 11.01" },
]

const kvGib = (ctx: number, t: string) => (KV_ELEMS * PER_ELEM[t] * ctx) / GIB

function plan(weights: number, budget: number, cap: number) {
  for (const ctx of [...CTXS].reverse()) {
    if (ctx > cap) continue
    for (const t of KVS) {
      if (t === "f16" && ctx > 8192) continue
      const total = weights + kvGib(ctx, t) + STATE + RESERVE
      if (total <= budget) return { ctx, t, total }
    }
  }
  return null
}

const COLORS = {
  weights: "oklch(0.62 0.14 70)",
  kv: "oklch(0.80 0.09 80)",
  state: "oklch(0.62 0.15 300)",
  reserve: "oklch(0.70 0.02 250)",
}

function Pills<T extends string | number>({
  items,
  value,
  onPick,
  fmt,
}: {
  items: T[]
  value: T
  onPick: (v: T) => void
  fmt: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={String(it)}
          type="button"
          onClick={() => onPick(it)}
          className={cn(
            "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
            it === value ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {fmt(it)}
        </button>
      ))}
    </div>
  )
}

export function PoolFit() {
  const [qk, setQk] = useState("iq2")
  const [ctx, setCtx] = useState(65536)
  const [kv, setKv] = useState("q8_0")
  const q = QUANTS.find((x) => x.key === qk) ?? QUANTS[0]
  const weights = q.bytes / GIB
  const kvg = kvGib(ctx, kv)
  const total = weights + kvg + STATE + RESERVE

  const segs = [
    { key: "weights", label: "weights", v: weights },
    { key: "kv", label: `KV cache (${kv})`, v: kvg },
    { key: "state", label: "DeltaNet state", v: STATE },
    { key: "reserve", label: "reserve", v: RESERVE },
  ] as const

  const W = 720
  const PL = 10
  const PW = W - 20
  const MAX = 16
  const x = (v: number) => PL + (v / MAX) * PW
  let acc = 0

  const picked = plan(weights, 11.01, 65536)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Fitting Qwen3.8-27B into the PS5&rsquo;s GPU heap · PS5LM Plus&rsquo;s planner formula, GiB
      </div>
      <div className="grid gap-2 border-b px-4 py-2.5 text-xs">
        <Pills items={QUANTS.map((s) => s.key)} value={qk} onPick={setQk} fmt={(k) => QUANTS.find((s) => s.key === k)?.label ?? k} />
        <Pills items={CTXS} value={ctx} onPick={setCtx} fmt={(c) => `${c / 1024}k`} />
        <Pills items={KVS} value={kv} onPick={setKv} fmt={(t) => t} />
      </div>

      <div className="px-2 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} 92`}
          className="w-full"
          role="img"
          aria-label={`${q.label} at ${ctx / 1024}k context with a ${kv} cache needs ${total.toFixed(2)} GiB: weights ${weights.toFixed(2)}, KV ${kvg.toFixed(2)}, state ${STATE.toFixed(2)}, reserve ${RESERVE.toFixed(2)}. The heap is 11.44 GiB and 11.01 GiB is free with the dashboard up.`}
        >
          {[0, 4, 8, 12, 16].map((v) => (
            <text key={v} x={x(v)} y={86} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
              {v}
            </text>
          ))}
          {segs.map((s) => {
            const x0 = x(acc)
            acc += s.v
            const w = Math.max(x(acc) - x0 - 1, 0.5)
            return <rect key={s.key} x={x0} y={22} width={w} height={34} rx={3} fill={COLORS[s.key]} fillOpacity={0.9} />
          })}
          {BUDGETS.map((b, i) => (
            <g key={b.label}>
              <line x1={x(b.v)} y1={14} x2={x(b.v)} y2={66} stroke="var(--foreground)" strokeWidth={1.2} strokeDasharray={i ? "3 3" : undefined} />
              <text x={x(b.v) + (i ? -4 : 4)} y={i ? 76 : 12} textAnchor={i ? "end" : "start"} className="fill-foreground font-mono" fontSize={10}>
                {b.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {segs.map((s) => (
            <span key={s.key}>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COLORS[s.key] }} />
              {s.label} {s.v.toFixed(2)}
            </span>
          ))}
        </div>
        <div className="mt-2">
          total <span className="text-foreground">{total.toFixed(2)} GiB</span>
          {" · "}
          {total <= 11.01 ? "fits with the dashboard up" : total <= 11.44 ? "fits the heap, not with the dashboard up" : "does not fit"}
        </div>
        <div className="mt-1">
          The planner&rsquo;s own pick for {q.label} (64k cap, 11.01 GiB free):{" "}
          <span className="text-foreground">
            {picked ? `${picked.ctx / 1024}k, ${picked.t}, ${picked.total.toFixed(2)} GiB` : "nothing fits"}
          </span>
        </div>
      </div>
    </figure>
  )
}
