"use client"

import { useState } from "react"

// Table 3 and Table 4 of the paper (arXiv 2608.27395), reproduced exactly --
// both are the FLOP-matched protocol (Sec 5.1 "FLOP-matched comparison" and
// Sec 5.2), not the epoch-matched protocol of Figure 2. All ViT-B encoders,
// pretrained on the identical 20% K710 subsample, at equal total pretraining
// FLOPs; IN1K and SSv2 report frozen attentive-probing top-1, K400 reports
// linear probing on mean-pooled tokens (a strictly weaker adaptation, per the
// paper's own framing -- so the K400 numbers are, if anything, conservative).
//
// Table 3 (video baselines):
//   VideoMAEv2   IN1K 53.4   SSv2 43.6   K400 37.4
//   V-JEPA 2     IN1K 51.6   SSv2 42.5   K400 40.7
//   LeVJEPA      IN1K 61.0   SSv2 40.4   K400 44.6
//   -> LeVJEPA - VideoMAEv2 (the strongest IN1K baseline) = 61.0 - 53.4 = 7.6,
//      the paper's own headline number. On SSv2 specifically LeVJEPA is
//      *not* the leader: 40.4 vs VideoMAEv2's 43.6, a 3.2-point gap -- the
//      "remaining competitive" hedge in the abstract, made concrete.
//
// Table 4 (vs. DINOv2, image pretraining on frames of the same video data,
// same total FLOPs as the 240-epoch LeVJEPA ViT-B):
//   DINOv2    IN1K 53.8   SSv2 16.9
//   LeVJEPA   IN1K 50.7   SSv2 30.4
//   -> DINOv2 leads IN1K by 3.1 points; LeVJEPA's SSv2 accuracy is 30.4/16.9
//      = 1.80x DINOv2's, close to the paper's own "nearly doubling" phrasing.

type Method = { name: string; color: string; values: Record<string, number>; note?: string }
type Tab = {
  key: string
  label: string
  metrics: { key: string; label: string; sub: string }[]
  methods: Method[]
  bestBadge: string
}

const VIDEOMAE = "oklch(0.55 0.16 155)"
const VJEPA2 = "oklch(0.58 0.20 300)"
const LEVJEPA = "oklch(0.60 0.15 255)"
const DINO = "oklch(0.70 0.17 40)"

const TABS: Tab[] = [
  {
    key: "video",
    label: "vs. video baselines (Table 3)",
    metrics: [
      { key: "in1k", label: "IN1K", sub: "attentive probe" },
      { key: "ssv2", label: "SSv2", sub: "attentive probe" },
      { key: "k400", label: "K400", sub: "linear probe" },
    ],
    methods: [
      { name: "VideoMAEv2", color: VIDEOMAE, values: { in1k: 53.4, ssv2: 43.6, k400: 37.4 } },
      { name: "V-JEPA 2", color: VJEPA2, values: { in1k: 51.6, ssv2: 42.5, k400: 40.7 } },
      { name: "LeVJEPA", color: LEVJEPA, values: { in1k: 61.0, ssv2: 40.4, k400: 44.6 } },
    ],
    bestBadge: "best",
  },
  {
    key: "image",
    label: "vs. image pretraining (Table 4)",
    metrics: [
      { key: "in1k", label: "IN1K", sub: "attentive probe" },
      { key: "ssv2", label: "SSv2", sub: "attentive probe" },
    ],
    methods: [
      { name: "DINOv2", color: DINO, values: { in1k: 53.8, ssv2: 16.9 } },
      { name: "LeVJEPA", color: LEVJEPA, values: { in1k: 50.7, ssv2: 30.4 } },
    ],
    bestBadge: "best",
  },
]

export function FlopMatchedComparison() {
  const [tabKey, setTabKey] = useState<string>(TABS[0].key)
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">ViT-B, equal total pretraining FLOPs, frozen probes</span>
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTabKey(t.key)}
              aria-pressed={tabKey === t.key}
              className={
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (tabKey === t.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-5">
          {tab.metrics.map((m) => {
            const max = Math.max(...tab.methods.map((meth) => meth.values[m.key] ?? 0))
            const bestValue = max
            return (
              <div key={m.key}>
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className="text-foreground">{m.label}</span>
                  <span className="text-muted-foreground">{m.sub}</span>
                </div>
                <div className="space-y-1">
                  {tab.methods.map((meth) => {
                    const v = meth.values[m.key] ?? 0
                    const w = max > 0 ? (v / max) * 100 : 0
                    const isBest = v === bestValue
                    return (
                      <div key={meth.name} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground sm:w-24">
                          {meth.name}
                        </span>
                        <div className="h-4 flex-1 rounded bg-muted/20">
                          <div
                            className="h-4 rounded"
                            style={{ width: `${w}%`, background: meth.color, opacity: isBest ? 0.9 : 0.5 }}
                          />
                        </div>
                        <span
                          className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                          style={{ color: isBest ? meth.color : "currentColor" }}
                        >
                          {v.toFixed(1)}
                          {isBest ? " •" : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {tab.key === "video" ? (
            <>
              At equal total FLOPs, <span style={{ color: LEVJEPA }}>LeVJEPA</span> leads on the benchmark the
              headline number is about — 61.0 vs. <span style={{ color: VIDEOMAE }}>VideoMAEv2</span>&rsquo;s 53.4
              on IN1K, a 7.6-point gap — and on K400. It is not the leader on SSv2:{" "}
              <span style={{ color: VIDEOMAE }}>VideoMAEv2</span> holds that one, 43.6 vs. LeVJEPA&rsquo;s 40.4, a
              3.2-point gap. &ldquo;Remaining competitive on motion-centric benchmarks&rdquo; is this gap, not a
              tie — LeVJEPA trades a specific, bounded amount of motion accuracy for a larger appearance-accuracy
              win and a large compute reduction, rather than winning everywhere.
            </>
          ) : (
            <>
              Against <span style={{ color: DINO }}>DINOv2</span> trained on individual frames of the identical
              video data at the identical FLOP budget, <span style={{ color: LEVJEPA }}>LeVJEPA</span> trails by
              3.1 points on the appearance benchmark DINOv2 is built for (53.8 vs. 50.7) but reaches 30.4% on
              Something-Something-v2 against DINOv2&rsquo;s 16.9% — 1.80x, in line with the paper&rsquo;s
              &ldquo;nearly doubling&rdquo;. Video pretraining does not need to win on appearance to be the better
              general-purpose choice; it needs to be close enough on appearance while its motion advantage stays
              intact, which is the specific trade this table shows.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
