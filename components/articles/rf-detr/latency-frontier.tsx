"use client"

import { useId, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// RF-DETR's published accuracy-latency frontier, read from the repo README's
// "Detection" benchmark table (github.com/roboflow/rf-detr, v1.11.1). Every
// COCO AP50:95 number here is measured in-house by Roboflow with pycocotools
// over the full 5,000-image val2017 split in their SAB harness, so RF-DETR and
// the two comparison points (D-FINE-X, YOLO26-X) are all directly comparable.
// Latency is milliseconds on an NVIDIA T4, TensorRT, FP16, batch size 1;
// params are deployment (fused) nn.Module parameter counts. The named N->2XL
// sizes are six points someone picked off one continuous weight-sharing-NAS
// Pareto curve, not six separately trained models. XL and 2XL ship under
// PML 1.0 (the rfdetr_plus extension); N through L are Apache-2.0.
//
// The prose carries every one of these numbers; this widget is the house
// explanation of the shape they make, not their only home.

type Point = {
  label: string
  ap: number // COCO AP50:95
  ms: number // T4, TensorRT, FP16, batch 1
  params: string
  res: string
  license: string
  family: "rfdetr" | "other"
}

const RFDETR: Point[] = [
  { label: "N", ap: 48.4, ms: 2.3, params: "30.5M", res: "384", license: "Apache-2.0", family: "rfdetr" },
  { label: "S", ap: 53.0, ms: 3.5, params: "32.1M", res: "512", license: "Apache-2.0", family: "rfdetr" },
  { label: "M", ap: 54.7, ms: 4.4, params: "33.7M", res: "576", license: "Apache-2.0", family: "rfdetr" },
  { label: "L", ap: 56.5, ms: 6.8, params: "33.9M", res: "704", license: "Apache-2.0", family: "rfdetr" },
  { label: "XL", ap: 58.6, ms: 11.5, params: "126.4M", res: "700", license: "PML 1.0", family: "rfdetr" },
  { label: "2XL", ap: 60.1, ms: 17.2, params: "126.9M", res: "880", license: "PML 1.0", family: "rfdetr" },
]

const OTHERS: Point[] = [
  { label: "D-FINE-X", ap: 59.3, ms: 11.5, params: "62.0M", res: "640", license: "Apache-2.0", family: "other" },
  { label: "YOLO26-X", ap: 56.9, ms: 9.6, params: "56.9M", res: "640", license: "AGPL-3.0", family: "other" },
]

const ALL = [...RFDETR, ...OTHERS]

// Plot geometry. Linear axes only — every coordinate below is +, -, * and /,
// which are exact in both Node and the browser, so the SVG serializes
// identically on server and client (no hydration drift, no need for lib/dmath).
const W = 640
const H = 430
const PADL = 46
const PADR = 18
const PADT = 20
const PADB = 46
const XMIN = 1.5
const XMAX = 18.5
const YMIN = 46
const YMAX = 61

const x = (ms: number) => PADL + ((ms - XMIN) / (XMAX - XMIN)) * (W - PADL - PADR)
const y = (ap: number) => PADT + ((YMAX - ap) / (YMAX - YMIN)) * (H - PADT - PADB)

const ACCENT = "oklch(0.58 0.2 295)" // RF-DETR (DINOv2 purple)
const OTHER = "oklch(0.64 0.17 45)" // comparison detectors
const SIXTY = "oklch(0.55 0.17 150)" // the 60 AP line

const BUDGETS = RFDETR.map((p) => p.ms)
const MIN_B = BUDGETS[0]
const MAX_B = BUDGETS[BUDGETS.length - 1]

export function LatencyFrontier() {
  const [budget, setBudget] = useState(MAX_B)
  const [active, setActive] = useState<string | null>("2XL")

  // Best RF-DETR size whose latency fits the budget (highest AP under the bar).
  const affordable = RFDETR.filter((p) => p.ms <= budget + 1e-9)
  const best = affordable.reduce<Point | null>((b, p) => (b && b.ap >= p.ap ? b : p), null)

  const line = RFDETR.map((p) => `${x(p.ms).toFixed(2)},${y(p.ap).toFixed(2)}`).join(" ")
  const activePt = ALL.find((p) => p.label === active) ?? null
  const gid = useId()

  const apTicks = [48, 50, 52, 54, 56, 58, 60]
  const msTicks = [2.5, 5, 7.5, 10, 12.5, 15, 17.5]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          COCO AP<sub>50:95</sub> vs latency — RF-DETR README (SAB, T4, TensorRT FP16, batch 1)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">drag the budget · tap a point</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Accuracy-latency scatter. RF-DETR's six sizes trace a frontier that sits above and to the left of D-FINE-X and YOLO26-X; only RF-DETR-2XL, at 17.2 milliseconds, crosses the 60 AP line."
        >
          {/* grid + axes */}
          {apTicks.map((t) => (
            <g key={`ay-${t}`}>
              <line x1={PADL} x2={W - PADR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PADL - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {t}
              </text>
            </g>
          ))}
          {msTicks.map((t) => (
            <text
              key={`ax-${t}`}
              x={x(t)}
              y={H - PADB + 14}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {t}
            </text>
          ))}
          <text
            x={(PADL + W - PADR) / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            latency (ms, T4 TensorRT FP16)
          </text>

          {/* the 60 AP milestone line */}
          <line x1={PADL} x2={W - PADR} y1={y(60)} y2={y(60)} stroke={SIXTY} strokeWidth={1.4} strokeDasharray="5 4" />
          <text x={W - PADR} y={y(60) - 5} textAnchor="end" className="font-mono text-[10px]" fill={SIXTY}>
            60 AP
          </text>

          {/* latency budget bar */}
          <line
            x1={x(budget)}
            x2={x(budget)}
            y1={PADT}
            y2={H - PADB}
            stroke="currentColor"
            strokeOpacity={0.28}
            strokeWidth={1.2}
            strokeDasharray="2 3"
          />
          <text x={x(budget)} y={PADT - 6} textAnchor="middle" className="fill-foreground font-mono text-[9px]">
            ≤ {budget.toFixed(1)} ms
          </text>

          {/* RF-DETR frontier polyline */}
          <polyline points={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeOpacity={0.55} />

          {/* comparison points */}
          {OTHERS.map((p) => (
            <g
              key={p.label}
              onMouseEnter={() => setActive(p.label)}
              onClick={() => setActive(p.label)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x(p.ms) - 4.5}
                y={y(p.ap) - 4.5}
                width={9}
                height={9}
                transform={`rotate(45 ${x(p.ms)} ${y(p.ap)})`}
                fill={active === p.label ? OTHER : "transparent"}
                stroke={OTHER}
                strokeWidth={1.6}
              />
            </g>
          ))}

          {/* RF-DETR points */}
          {RFDETR.map((p) => {
            const isBest = best?.label === p.label
            const affordablePt = p.ms <= budget + 1e-9
            return (
              <g
                key={p.label}
                onMouseEnter={() => setActive(p.label)}
                onClick={() => setActive(p.label)}
                style={{ cursor: "pointer" }}
              >
                {isBest && <circle cx={x(p.ms)} cy={y(p.ap)} r={9} fill="none" stroke={ACCENT} strokeWidth={1.4} />}
                <circle
                  cx={x(p.ms)}
                  cy={y(p.ap)}
                  r={active === p.label ? 6 : 4.5}
                  fill={ACCENT}
                  fillOpacity={affordablePt ? 1 : 0.25}
                  stroke="var(--background, #fff)"
                  strokeWidth={1}
                />
                <text
                  x={x(p.ms)}
                  y={y(p.ap) - 10}
                  textAnchor="middle"
                  className="font-mono text-[9.5px] font-semibold"
                  fill={ACCENT}
                  fillOpacity={affordablePt ? 1 : 0.35}
                >
                  {p.label}
                </text>
              </g>
            )
          })}

          {/* comparison labels */}
          {OTHERS.map((p) => (
            <text
              key={`l-${p.label}`}
              x={x(p.ms)}
              y={y(p.ap) + (p.label === "YOLO26-X" ? 16 : -10)}
              textAnchor="middle"
              className="font-mono text-[9px]"
              fill={OTHER}
            >
              {p.label}
            </text>
          ))}
          <g id={gid} />
        </svg>

        <div className="mt-2 px-1">
          <Range
            min={MIN_B}
            max={MAX_B}
            step={0.1}
            value={budget}
            accent={ACCENT}
            onChange={(e) => setBudget(Number(e.currentTarget.value))}
            aria-label="Latency budget in milliseconds"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">under {budget.toFixed(1)} ms, the best RF-DETR is</div>
            {best ? (
              <div className="mt-0.5 font-mono text-sm">
                <span className="font-semibold" style={{ color: ACCENT }}>
                  RF-DETR-{best.label}
                </span>{" "}
                — <span className="tabular-nums">{best.ap.toFixed(1)}</span> AP @{" "}
                <span className="tabular-nums">{best.ms.toFixed(1)}</span> ms{" "}
                <span className="text-muted-foreground">({best.license})</span>
              </div>
            ) : (
              <div className="mt-0.5 font-mono text-sm text-muted-foreground">nothing fits — raise the budget</div>
            )}
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {best && best.ap >= 60
                ? "clears 60 AP — the first real-time detector to do so"
                : "below the 60 AP line"}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">selected point</div>
            {activePt ? (
              <div className="mt-0.5 font-mono text-sm">
                <span className="font-semibold" style={{ color: activePt.family === "rfdetr" ? ACCENT : OTHER }}>
                  {activePt.family === "rfdetr" ? `RF-DETR-${activePt.label}` : activePt.label}
                </span>
                <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  <span className="tabular-nums text-foreground">{activePt.ap.toFixed(1)}</span> AP ·{" "}
                  <span className="tabular-nums text-foreground">{activePt.ms.toFixed(1)}</span> ms ·{" "}
                  <span className="tabular-nums">{activePt.params}</span> ·{" "}
                  {activePt.res}&times;{activePt.res} · {activePt.license}
                </div>
              </div>
            ) : (
              <div className="mt-0.5 font-mono text-sm text-muted-foreground">tap any point</div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: ACCENT }} /> RF-DETR (one NAS curve)
          </span>
          <span>
            <span className="inline-block h-2 w-2 rotate-45 align-middle" style={{ background: OTHER }} /> comparison detectors
          </span>
          <span style={{ color: SIXTY }}>— — 60 AP milestone</span>
        </div>
      </div>
    </figure>
  )
}
