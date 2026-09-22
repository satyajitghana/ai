"use client"

import { useState } from "react"

// The half of the confusion matrix a rediscovery benchmark cannot contain.
//
// Aikido's benchmark is 32 repositories-with-a-known-CVE, three runs each. Every
// case carries a planted positive, so a run can be scored TP or FN. There is no
// case whose correct answer is "nothing here", so there is no TN cell, and a run
// that reports the real vulnerability plus five imagined ones scores exactly the
// same as a run that reports only the real one. FP is not measured low; it is
// not measured.
//
// The slider input is therefore explicitly NOT a measurement of Altar. It is the
// quantity that decides whether a detector is deployable, and the point of the
// widget is the shape of the curve, which is steep everywhere a scanner
// actually operates. Same argument, same arithmetic, as the base-rate dial in
// /articles/confidence-gated-fraud-detection -- this is the supply side of it.

const REPOS = 30
const TRUE_VULNS = 32
const RUNS = 3
const RECALL = 0.604

const TP_C = "oklch(0.55 0.15 155)"
const FN_C = "oklch(0.60 0.12 60)"
const FP_C = "oklch(0.58 0.18 27)"
const NULL_C = "oklch(0.60 0.02 250)"

export function MissingHalf() {
  const [fpPerRepo, setFpPerRepo] = useState(1)

  const runsTotal = TRUE_VULNS * RUNS // 96
  const tpRuns = Math.round(runsTotal * RECALL) // 58
  const fnRuns = runsTotal - tpRuns

  // Per single pass over the 30 repositories.
  const tp = TRUE_VULNS * RECALL
  const fp = REPOS * fpPerRepo
  const precision = fp + tp > 0 ? tp / (tp + fp) : 1
  const perTrue = tp > 0 ? fp / tp : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the benchmark&apos;s confusion matrix, drawn honestly
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          96 runs · every case a planted positive
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              measured
            </div>
            <div className="mt-2 space-y-2">
              {[
                { label: "true positive", sub: "found the planted CVE", v: tpRuns, c: TP_C },
                { label: "false negative", sub: "completed, found nothing", v: fnRuns, c: FN_C },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between font-mono text-[11px]">
                    <span className="text-foreground">{r.label}</span>
                    <span className="text-muted-foreground">{r.v} runs</span>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-sm bg-foreground/5">
                    <div
                      className="h-2.5 rounded-sm"
                      style={{ width: `${(100 * r.v) / runsTotal}%`, background: r.c }}
                    />
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{r.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              structurally absent
            </div>
            <div className="mt-2 space-y-2">
              {[
                { label: "false positive", sub: "reported something that was not there" },
                { label: "true negative", sub: "no case has 'nothing here' as its answer" },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between font-mono text-[11px]">
                    <span className="text-foreground">{r.label}</span>
                    <span style={{ color: NULL_C }}>not scored</span>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-sm border border-dashed border-foreground/20" />
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{r.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <label className="block font-mono text-xs text-muted-foreground">
            if the agent also reports{" "}
            <span className="text-foreground">{fpPerRepo}</span> finding
            {fpPerRepo === 1 ? "" : "s"} per repository that turn out to be nothing —{" "}
            <em>an input, not a measurement</em>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={fpPerRepo}
              onChange={(e) => setFpPerRepo(Number(e.target.value))}
              className="mt-2 block w-full accent-foreground"
              aria-label="false findings per repository per pass"
            />
          </label>

          <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="mt-3 h-6 w-full" role="img" aria-label={`Precision ${(precision * 100).toFixed(0)} percent at ${fpPerRepo} false findings per repository.`}>
            <rect x={0} y={0} width={100} height={8} rx={1} className="fill-foreground/5" />
            <rect x={0} y={0} width={precision * 100} height={8} rx={1} fill={TP_C} />
            <rect
              x={precision * 100}
              y={0}
              width={100 - precision * 100}
              height={8}
              fill={FP_C}
              opacity={0.75}
            />
          </svg>

          <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div>
              <div className="text-muted-foreground">real findings</div>
              <div className="text-foreground">{tp.toFixed(1)} of 32</div>
            </div>
            <div>
              <div className="text-muted-foreground">false alerts</div>
              <div className="text-foreground">{fp}</div>
            </div>
            <div>
              <div className="text-muted-foreground">precision</div>
              <div className="text-foreground">{(precision * 100).toFixed(0)}%</div>
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {fpPerRepo === 0
              ? "At zero false findings precision is 100% — and zero is the one value the benchmark also cannot rule out. It is not evidence; it is the absence of a measurement."
              : `${perTrue.toFixed(1)} false alert${perTrue === 1 ? "" : "s"} for every real one, across 30 repositories. A triage queue at that ratio is a human cost that scales with the fleet, and none of it appears in a recall number.`}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Left panel is Aikido&apos;s data. Right panel is the part their benchmark
        design cannot produce, whatever the model does. The slider is a what-if
        with no measured value behind it — which is the finding, not a criticism
        of the arithmetic.
      </figcaption>
    </figure>
  )
}
