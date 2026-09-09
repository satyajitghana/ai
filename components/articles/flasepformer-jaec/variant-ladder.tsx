"use client"

import { useState } from "react"

// Five real rows out of the paper's own Table 1 and Table 2, walked as a path
// from the checkpoint ModelScope actually publishes to the checkpoint the
// announcement's number describes. Every SDRi/SI-SNRi pair below is quoted
// verbatim from the paper — nothing here is interpolated or estimated.
//
//   step 0 — FLA-SepReformer-B, Libri2Mix-100, no DM   → Table 2  (RELEASED)
//   step 1 — FLA-SepReformer-B,  WSJ0-2Mix,    no DM   → Table 1
//   step 2 — FLA-TFLocoformer-M, WSJ0-2Mix,    no DM   → Table 1  (~matched params)
//   step 3 — FLA-TFLocoformer-L, WSJ0-2Mix,    no DM   → Table 1
//   step 4 — FLA-TFLocoformer-L, WSJ0-2Mix,    +DM     → Table 1  (ANNOUNCED)

type Step = {
  tag?: "released" | "announced"
  model: string
  params: string
  dataset: string
  dm: string
  sisnri: number
  sdri: number
  change: string
}

const STEPS: Step[] = [
  {
    tag: "released",
    model: "FLA-SepReformer-B",
    params: "14.2M",
    dataset: "Libri2Mix-100",
    dm: "no DM",
    sisnri: 20.3,
    sdri: 20.7,
    change: "the checkpoint on ModelScope today",
  },
  {
    model: "FLA-SepReformer-B",
    params: "14.2M",
    dataset: "WSJ0-2Mix",
    dm: "no DM",
    sisnri: 23.5,
    sdri: 23.7,
    change: "same checkpoint, evaluated on a different, easier benchmark",
  },
  {
    model: "FLA-TFLocoformer-M",
    params: "15.1M",
    dataset: "WSJ0-2Mix",
    dm: "no DM",
    sisnri: 23.4,
    sdri: 23.5,
    change: "swap backbone at roughly matched size — within noise",
  },
  {
    model: "FLA-TFLocoformer-L",
    params: "22.6M",
    dataset: "WSJ0-2Mix",
    dm: "no DM",
    sisnri: 24.2,
    sdri: 24.3,
    change: "scale up 15.1M → 22.6M params",
  },
  {
    tag: "announced",
    model: "FLA-TFLocoformer-L",
    params: "22.6M",
    dataset: "WSJ0-2Mix",
    dm: "+ DM",
    sisnri: 24.8,
    sdri: 24.9,
    change: "add dynamic-mixing training augmentation",
  },
]

const LO = 19
const HI = 26

export function VariantLadder() {
  const [step, setStep] = useState(0)
  const cur = STEPS[step]
  const prev = step > 0 ? STEPS[step - 1] : null
  const delta = prev ? Math.round((cur.sdri - prev.sdri) * 10) / 10 : null

  const pct = (v: number) => ((v - LO) / (HI - LO)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          released → announced, one real table row at a time
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Table 1 &amp; Table 2, this paper
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {/* step selector */}
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-pressed={i === step}
              className={
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (i === step
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {i}
              {s.tag ? ` · ${s.tag}` : ""}
            </button>
          ))}
        </div>

        {/* SDRi track */}
        <div className="relative mt-5 h-8">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted/40" />
          {/* path travelled so far */}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
            style={{
              left: `${pct(STEPS[0].sdri)}%`,
              width: `${pct(cur.sdri) - pct(STEPS[0].sdri)}%`,
              background: "oklch(0.68 0.13 85)",
            }}
          />
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2"
              style={{
                left: `${pct(s.sdri)}%`,
                borderColor: i === step ? "oklch(0.60 0.15 155)" : "var(--border)",
                background: i <= step ? "oklch(0.68 0.13 85)" : "var(--background)",
              }}
              title={`${s.model} · ${s.dataset} · ${s.dm} — ${s.sdri} dB SDRi`}
            />
          ))}
          <span className="absolute top-full mt-1 text-[9px] font-mono text-muted-foreground" style={{ left: `${pct(STEPS[0].sdri)}%` }}>
            {STEPS[0].sdri} released
          </span>
          <span className="absolute top-full mt-1 -translate-x-full text-[9px] font-mono text-muted-foreground" style={{ left: `${pct(STEPS[STEPS.length - 1].sdri)}%` }}>
            announced {STEPS[STEPS.length - 1].sdri}
          </span>
        </div>

        {/* current step card */}
        <div className="mt-8 rounded-lg border bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-mono text-sm">
              {cur.model} <span className="text-muted-foreground">· {cur.params}</span>
            </div>
            <div className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
              <span>SI-SNRi {cur.sisnri} dB</span>
              <span className="text-foreground" style={{ fontWeight: 600 }}>
                SDRi {cur.sdri} dB
              </span>
              {delta !== null ? (
                <span style={{ color: delta >= 0 ? "oklch(0.55 0.16 155)" : "oklch(0.62 0.19 25)" }}>
                  {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {cur.dataset} · {cur.dm}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{cur.change}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Walk all five steps and the released number climbs{" "}
          <span className="text-foreground">+4.2 dB</span> to reach the announced one — but{" "}
          <span className="text-foreground">+3.0 dB</span> of that is step 1 alone: the same
          checkpoint, scored on WSJ0-2Mix instead of the harder Libri2Mix-100 it actually ships
          on. Step 2 — swapping SepReformer for TFLocoformer at roughly matched parameter count —
          is a wash, even slightly negative. Scale and training augmentation each buy about half a
          decibel. The dataset, not the architecture, is doing most of the work.
        </p>
      </div>
    </figure>
  )
}
