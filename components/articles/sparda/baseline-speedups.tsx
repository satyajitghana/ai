"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Real numbers, not illustrative -- Table 4 (decode throughput, tok/s, NVIDIA
// H100, MiniCPM4.1-8B, 128K context, batch size 4-128). "-" = OOM, reproduced
// verbatim. This component exists because the paper's three headline
// multipliers (1.25x prefill, 1.7x decode, 5.3x throughput) are measured
// against two DIFFERENT baselines and conflating them overstates the result:
//
//  - "same-batch" toggle: SparDA vs Sparse-with-offload AT THE SAME BATCH
//    SIZE. Max ratio is 471.2/279.5 = 1.686x at B8 -- the paper's "up to
//    1.7x decode speedup over the sparse-attention offload baseline."
//  - "peak-feasible" toggle: Sparse WITHOUT offload (Sparse-dagger) OOMs
//    past B4 at this context length, so its best throughput is capped at
//    189.5 tok/s. SparDA's offload lets it keep scaling to B64 (1000.1
//    tok/s) before it too OOMs at B128. 1000.1/189.5 = 5.28x -- the paper's
//    "up to 5.3x higher decode throughput than the non-offload sparse
//    baseline," reached only because larger batches become feasible at all,
//    not because any single batch runs 5.3x faster.

const BATCH = [4, 8, 16, 32, 64, 128] as const
const SPARSE_NO_OFFLOAD = [189.5, null, null, null, null, null]
const SPARSE_OFFLOAD = [167.8, 279.5, 447.9, 618.6, 788.9, null]
const SPARDA = [240.2, 471.2, 705.3, 899.2, 1000.1, null]

const OFFLOAD = "oklch(0.62 0.03 250)"
const SPARDA_C = "oklch(0.55 0.16 155)"
const NOOFF = "oklch(0.62 0.19 25)"

type View = "same" | "peak"

export function BaselineSpeedups() {
  const [view, setView] = useState<View>("same")

  const W = 700
  const H = 260
  const PL = 46
  const PB = 26
  const PT = 16
  const PR = 12
  const maxY = 1080
  const n = BATCH.length
  const x = (i: number) => PL + (i / (n - 1)) * (W - PL - PR)
  const y = (v: number) => PT + (1 - v / maxY) * (H - PT - PB)

  const path = (vals: (number | null)[]) => {
    let d = ""
    vals.forEach((v, i) => {
      if (v == null) return
      d += `${d ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    })
    return d.trim()
  }

  const ratioAt = (i: number) => {
    const a = SPARDA[i]
    const b = SPARSE_OFFLOAD[i]
    return a != null && b != null ? a / b : null
  }
  const bestIdx = 1 // B8, where the ratio peaks at 1.686x
  const peakRatio = (SPARDA[4]! / SPARSE_NO_OFFLOAD[0]!).toFixed(2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">decode throughput vs batch · H100, MiniCPM4.1-8B, 128K</span>
        <div className="flex gap-1.5">
          {(
            [
              ["same", "same batch (1.7×)"],
              ["peak", "peak feasible (5.3×)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={view === "same" ? "SparDA vs offloaded Sparse at matching batch sizes; the gap peaks near 1.7x at batch 8" : "SparDA's largest feasible batch vs non-offload Sparse's largest feasible batch; SparDA reaches 5.3x higher throughput because offload lets it run a much bigger batch before running out of GPU memory"}>
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1={PL} x2={W - PR} y1={y(g * maxY)} y2={y(g * maxY)} stroke="currentColor" className="text-border" strokeWidth={1} />
            ))}
            {[0, 0.5, 1].map((g) => (
              <text key={g} x={PL - 6} y={y(g * maxY) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
                {Math.round(g * maxY)}
              </text>
            ))}

            {BATCH.map((b, i) => (
              <text key={b} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                B{b}
              </text>
            ))}

            {view === "same" ? (
              <>
                <path d={path(SPARSE_OFFLOAD)} fill="none" stroke={OFFLOAD} strokeWidth={2.2} strokeLinecap="round" />
                <path d={path(SPARDA)} fill="none" stroke={SPARDA_C} strokeWidth={2.2} strokeLinecap="round" />
                {SPARSE_OFFLOAD.map((v, i) => (v == null ? null : <circle key={`o${i}`} cx={x(i)} cy={y(v)} r={3} fill={OFFLOAD} stroke="var(--background)" strokeWidth={1.2} />))}
                {SPARDA.map((v, i) => (v == null ? null : <circle key={`s${i}`} cx={x(i)} cy={y(v)} r={3} fill={SPARDA_C} stroke="var(--background)" strokeWidth={1.2} />))}

                <line x1={x(bestIdx)} x2={x(bestIdx)} y1={y(SPARDA[bestIdx]!)} y2={y(SPARSE_OFFLOAD[bestIdx]!)} stroke={SPARDA_C} strokeWidth={1.2} strokeDasharray="2 2" />
                <text x={x(bestIdx) + 6} y={(y(SPARDA[bestIdx]!) + y(SPARSE_OFFLOAD[bestIdx]!)) / 2} className="font-mono" fontSize={10} fill={SPARDA_C} fontWeight={600}>
                  {ratioAt(bestIdx)?.toFixed(2)}×
                </text>
              </>
            ) : (
              <>
                <path d={path(SPARSE_OFFLOAD)} fill="none" stroke={OFFLOAD} strokeWidth={1.4} strokeOpacity={0.35} strokeLinecap="round" />
                <path d={path(SPARDA)} fill="none" stroke={SPARDA_C} strokeWidth={1.4} strokeOpacity={0.35} strokeLinecap="round" />

                <circle cx={x(0)} cy={y(SPARSE_NO_OFFLOAD[0]!)} r={4} fill={NOOFF} stroke="var(--background)" strokeWidth={1.3} />
                <text x={x(0)} y={y(SPARSE_NO_OFFLOAD[0]!) - 8} textAnchor="middle" className="font-mono" fontSize={9} fill={NOOFF}>
                  Sparse† peak: {SPARSE_NO_OFFLOAD[0]}
                </text>
                <text x={x(0)} y={y(SPARSE_NO_OFFLOAD[0]!) + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
                  OOMs past B4
                </text>

                <circle cx={x(4)} cy={y(SPARDA[4]!)} r={4} fill={SPARDA_C} stroke="var(--background)" strokeWidth={1.3} />
                <text x={x(4)} y={y(SPARDA[4]!) - 8} textAnchor="middle" className="font-mono" fontSize={9} fill={SPARDA_C}>
                  SparDA peak: {SPARDA[4]}
                </text>

                <line x1={x(0)} x2={x(4)} y1={y(SPARSE_NO_OFFLOAD[0]!)} y2={y(SPARDA[4]!)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
                <text x={(x(0) + x(4)) / 2} y={(y(SPARSE_NO_OFFLOAD[0]!) + y(SPARDA[4]!)) / 2 - 6} textAnchor="middle" className="font-mono" fontSize={11} fill={SPARDA_C} fontWeight={600}>
                  {peakRatio}×
                </text>
              </>
            )}
          </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: OFFLOAD }} /> Sparse + offload</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: SPARDA_C }} /> SparDA</span>
          {view === "peak" ? <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: NOOFF }} /> Sparse, no offload (†)</span> : null}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {view === "same" ? (
            <>
              At matching batch sizes, both configurations are offloading the KV cache — the only difference is
              whether the fetch is hidden. The gap is real but modest and{" "}
              <span className="text-foreground">batch-dependent</span>, peaking at{" "}
              <span style={{ color: SPARDA_C }}>1.69× near B8</span>{" "}where prefetch and layer execution are roughly
              balanced, and narrowing at B64 as the GPU itself becomes the bottleneck. This is the &ldquo;1.7×
              decode speedup&rdquo; number.
            </>
          ) : (
            <>
              Non-offload Sparse (Sparse†) keeps the whole KV cache on GPU, so it simply runs out of memory past
              batch 4 at 128K context — <span style={{ color: NOOFF }}>189.5 tok/s is its ceiling</span>, full stop.
              SparDA&rsquo;s offload frees that memory, so it can keep scaling batch size up to{" "}
              <span style={{ color: SPARDA_C }}>1,000.1 tok/s at B64</span>{" "}before it too runs out. The 5.3×
              here is almost entirely &ldquo;a bigger batch became possible,&rdquo; not a per-request speedup — a
              different claim from the 1.7× on the left, even though both appear in the same abstract.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
