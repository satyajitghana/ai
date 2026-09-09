"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// The two numbers this whole paper turns on: d = 16 and N = 2000 per second of
// audio, both for FLA-SepReformer-B's global attention module. Both are stated
// in the paper's own text ("d=16 and N=2000 for 1 second of audio") and both
// check out against the released configuration.json: relative_positional_encoding
// .maxlen = 2000, global_blocks.num_mha_heads = 8 with in_channels = 128 — and
// 128 / 8 = 16.
//
// Softmax attention over one head: build the N×N score matrix, O(N²d) multiply
// -adds, O(N²) floats resident in memory for that matrix alone. Linear attention
// reorders (QK)V to Q(KV): the K,V product is a fixed d×d matrix regardless of
// N, so cost is O(Nd²) and the *attention-specific* memory is O(d²) — constant
// in sequence length.
//
// This is deliberately scoped to one head, one layer, no batch — the smallest
// unit where the O(N²)→O(N) swap is visible. The paper's own measured, whole
// -model numbers (1.91× faster, 20.9% memory, for FLA-SepReformer-B at 30s) are
// far smaller than the ratios below, because most of the network — the local
// transformer, the down/up convs, the Gated MLP itself — is untouched by FLA
// and costs the same either way. That gap IS the point; see the prose below.

const D_HEAD = 16 // per-head channel dim, FLA-SepReformer-B (paper §2.2; config: 128/8)
const RATE = 2000 // sequence positions per second of audio, in the global attention module

const DURATIONS = [1, 5, 10, 20, 30, 45, 57, 90] // 57s: the paper's own SepReformer-L OOM point

// GPU memory references worth crossing, in bytes
const REFS = [
  { bytes: 24e9, label: "24 GB · common workstation GPU" },
  { bytes: 80e9, label: "80 GB · the RTX A800 / H100 class this paper trained on" },
]

function fmtBytes(b: number): string {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`
  return `${(b / 1e9).toFixed(1)} GB`
}

// log10-scaled bar position, clamped to a fixed [minExp, maxExp] window
const MIN_EXP = 3 // 1 KB
const MAX_EXP = 12 // 1 TB
function barPct(bytes: number): number {
  const e = mlog10(Math.max(bytes, 1))
  return Math.min(100, Math.max(0, ((e - MIN_EXP) / (MAX_EXP - MIN_EXP)) * 100))
}

export function SequenceCost() {
  const [idx, setIdx] = useState(5) // default: 45s

  const seconds = DURATIONS[idx]
  const N = RATE * seconds
  const softmaxOps = N * N * D_HEAD
  const flaOps = N * D_HEAD * D_HEAD
  const softmaxBytes = N * N * 4 // one fp32 score matrix, one head
  const flaBytes = D_HEAD * D_HEAD * 4 // the KV state matrix — constant in N
  const opsRatio = softmaxOps / flaOps // = N / D_HEAD exactly

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one attention head · d = {D_HEAD} · N = {RATE.toLocaleString()}/s
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          FLA-SepReformer-B&rsquo;s own dimensions
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
            audio length
          </span>
          <Range
            min={0}
            max={DURATIONS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums">
            {seconds}s
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {DURATIONS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setIdx(i)}
              aria-pressed={i === idx}
              className={
                "cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors " +
                (i === idx
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {s}s
            </button>
          ))}
        </div>

        <div className="mt-4 font-mono text-[11px] text-muted-foreground">
          N = {RATE.toLocaleString()} × {seconds}s ={" "}
          <span className="text-foreground">{N.toLocaleString()}</span> sequence positions
        </div>

        <div className="mt-4 space-y-3">
          {/* softmax bar */}
          <div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">softmax · N² score matrix</span>
              <span className="tabular-nums" style={{ color: "oklch(0.62 0.19 25)" }}>
                {fmtBytes(softmaxBytes)}
              </span>
            </div>
            <div className="relative h-4 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${Math.max(barPct(softmaxBytes), 0.5)}%`, background: "oklch(0.62 0.19 25)" }}
              />
              {REFS.map((r) => (
                <div
                  key={r.label}
                  className="absolute inset-y-0 w-px bg-foreground/40"
                  style={{ left: `${barPct(r.bytes)}%` }}
                  title={r.label}
                />
              ))}
            </div>
          </div>

          {/* FLA bar */}
          <div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">focused linear · d×d state (constant in N)</span>
              <span className="tabular-nums" style={{ color: "oklch(0.60 0.15 155)" }}>
                {fmtBytes(flaBytes)}
              </span>
            </div>
            <div className="relative h-4 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${Math.max(barPct(flaBytes), 0.5)}%`, background: "oklch(0.60 0.15 155)" }}
              />
            </div>
          </div>

          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>1 KB</span>
            <span>1 MB</span>
            <span>1 GB</span>
            <span>1 TB</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              multiply-adds, softmax
            </div>
            <div className="font-mono text-sm tabular-nums">{softmaxOps.toExponential(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              multiply-adds, FLA
            </div>
            <div className="font-mono text-sm tabular-nums">{flaOps.toExponential(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              ratio = N / d
            </div>
            <div className="font-mono text-sm tabular-nums" style={{ color: "oklch(0.60 0.15 155)" }}>
              {opsRatio.toLocaleString()}×
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is the cost of <em>one head, one layer</em>, not the whole network — and it is the
          upper bound on what Focused Linear Attention can possibly save. At {seconds}s the ratio
          is {opsRatio.toLocaleString()}×, because the swap is exactly N² → N with d fixed at{" "}
          {D_HEAD}, so the saving <em>is</em> N/d and grows with the audio. The paper&rsquo;s own
          measured, whole-model number at 30s is <span className="text-foreground">1.91×</span>,
          not 3,750× — the difference is everything else in FLA-SepReformer-B that this component
          doesn&rsquo;t touch: the local transformer, the down/up convolutions, the Gated MLP
          itself. That untouched remainder is the real story behind why the speedup shrinks as the
          model scales up; see below.
        </p>
      </div>
    </figure>
  )
}
