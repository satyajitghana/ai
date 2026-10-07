"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Compression-ratio calculator for Squeeze3D (arXiv 2506.07932v2).
// Sources, all from the paper unless noted:
//   original sizes  - Tables 2, 3, 4 (6.43 MB mesh, 117 KB point cloud, 58.07 MB radiance field)
//   code widths d_C - Table 11 (770 / 1024 / 1024 for meshes, 512-8192 for point clouds, 24000 for RF)
//   shared storage  - Table 24 (frozen decoder + reverse mapping network)
//   codec rows      - Tables 2, 3, 4 (compression ratio and one quality metric each)
//   binary PLY      - this site: 2048 points x 3 float32 = 24,576 bytes, the payload of the
//                     ASCII PLY files in the repo's assets/pc/ (each declares 2048 vertices)
//   RF skip tensor  - this site, from squeeze3d/models/mlp.py:704-733 and the released
//                     rf_nerfmae.safetensors shapes: the decoder adds an encoder feature map of
//                     384 x 20 x 20 x 20 = 3,072,000 values that never passes through the code.
// Units are binary (1 MB = 1024 KB = 1,048,576 bytes), which is what reproduces the
// paper's 58.5x and, to rounding, its 2187x.

const KB = 1024
const MB = 1024 * 1024
const GB = 1024 * MB

type Codec = { name: string; cr: number; quality: string }
type Pair = { name: string; dc: number; shared: number; note?: string }
type Format = {
  key: string
  label: string
  originals: { label: string; bytes: number }[]
  pairs: Pair[]
  dcChoices?: number[]
  codecs: Codec[]
  metric: string
  ours: string
}

const FORMATS: Format[] = [
  {
    key: "mesh",
    label: "Textured mesh",
    originals: [{ label: "paper's average Objaverse mesh, 6.43 MB", bytes: 6.43 * MB }],
    pairs: [
      { name: "MeshAnything → InstantMesh", dc: 770, shared: 3.43 * GB },
      { name: "MeshAnything → OpenLRM", dc: 1024, shared: 2.79 * GB },
      { name: "MeshAnything → Shap-E", dc: 1024, shared: 2.89 * GB },
    ],
    codecs: [
      { name: "Draco (4-bit)", cr: 6.92, quality: "0.2437" },
      { name: "Draco (14-bit)", cr: 6.2, quality: "0.0004" },
      { name: "Neural Subdivision", cr: 11.28, quality: "0.1513" },
      { name: "NGF", cr: 42.87, quality: "0.0054" },
      { name: "Corto", cr: 45.93, quality: "0.1374" },
      { name: "DeepSDF", cr: 131.22, quality: "0.3704" },
      { name: "3DShape2VecSet", cr: 342.5, quality: "0.1582" },
    ],
    metric: "LPIPS, lower is better",
    ours: "0.0274 (InstantMesh)",
  },
  {
    key: "pc",
    label: "Point cloud",
    originals: [
      { label: "paper's file, 117 KB (ASCII PLY)", bytes: 117 * KB },
      { label: "same 2048 points as binary float32, 24 KB", bytes: 2048 * 12 },
    ],
    pairs: [{ name: "PointNet++ → LION", dc: 512, shared: 312.25 * MB }],
    dcChoices: [512, 1024, 2048, 4096, 8192],
    codecs: [
      { name: "Draco (11-bit)", cr: 15.64, quality: "0.9722" },
      { name: "Draco (14-bit)", cr: 22.41, quality: "0.9535" },
      { name: "SparsePCGC", cr: 34.37, quality: "0.1909" },
      { name: "G-PCC", cr: 37.21, quality: "0.9331" },
      { name: "V-PCC", cr: 50.17, quality: "0.9437" },
    ],
    metric: "PointSSIM, higher is better",
    ours: "0.4484 (d_C = 512)",
  },
  {
    key: "rf",
    label: "Radiance field",
    originals: [{ label: "paper's NeRF-MAE grid, 58.07 MB", bytes: 58.07 * MB }],
    pairs: [{ name: "NeRF-MAE → NeRF-MAE", dc: 24000, shared: 478.92 * MB }],
    codecs: [
      { name: "VQRF", cr: 40.25, quality: "0.0618" },
      { name: "SparsePCGC", cr: 78.92, quality: "0.1400" },
    ],
    metric: "LPIPS, lower is better",
    ours: "0.0743",
  },
]

const PRECISIONS = [
  { label: "fp32 (what the paper stores)", bytes: 4 },
  { label: "fp16 (not tested)", bytes: 2 },
  { label: "int8 (not tested)", bytes: 1 },
]

const OBJECT_COUNTS = [1, 10, 100, 500, 1000, 10000, 100000]

const SKIP_VALUES = 384 * 20 * 20 * 20

function fmtBytes(b: number) {
  if (b >= GB) return `${(b / GB).toFixed(2)} GB`
  if (b >= MB) return `${(b / MB).toFixed(2)} MB`
  if (b >= KB) return `${(b / KB).toFixed(2)} KB`
  return `${b.toFixed(0)} B`
}

function fmtRatio(r: number) {
  if (r >= 100) return `${r.toFixed(0)}×`
  return `${r.toFixed(1)}×`
}

export function RatioCalculator() {
  const [fKey, setFKey] = useState("mesh")
  const f = FORMATS.find((x) => x.key === fKey) ?? FORMATS[0]
  const [pairIdx, setPairIdx] = useState(0)
  const [origIdx, setOrigIdx] = useState(0)
  const [dcIdx, setDcIdx] = useState(0)
  const [precIdx, setPrecIdx] = useState(0)
  const [skip, setSkip] = useState(false)
  const [nIdx, setNIdx] = useState(OBJECT_COUNTS.length - 1)

  const pair = f.pairs[Math.min(pairIdx, f.pairs.length - 1)]
  const orig = f.originals[Math.min(origIdx, f.originals.length - 1)]
  const dc = f.dcChoices ? f.dcChoices[Math.min(dcIdx, f.dcChoices.length - 1)] : pair.dc
  const bytesPer = PRECISIONS[precIdx].bytes
  const codeBytes = dc * bytesPer
  const payload = codeBytes + (f.key === "rf" && skip ? SKIP_VALUES * bytesPer : 0)
  const ratio = orig.bytes / payload
  const n = OBJECT_COUNTS[nIdx]
  const amortised = (n * orig.bytes) / (pair.shared + n * payload)
  const bitsPerPoint = f.key === "pc" ? (payload * 8) / 2048 : null

  const pick = (k: string) => {
    setFKey(k)
    setPairIdx(0)
    setOrigIdx(0)
    setDcIdx(0)
    setSkip(false)
  }

  const rows = [...f.codecs.map((c) => ({ ...c, ours: false })), { name: "Squeeze3D, this setting", cr: ratio, quality: f.ours, ours: true }].sort(
    (a, b) => a.cr - b.cr
  )
  const maxCr = Math.max(...rows.map((r) => r.cr))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what the ratio is made of</span>
        <div className="flex flex-wrap gap-1 font-mono text-[11px]">
          {FORMATS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => pick(x.key)}
              aria-pressed={x.key === f.key}
              className={cn(
                "rounded border px-2 py-1 transition-colors",
                x.key === f.key ? "border-foreground bg-foreground text-background" : "hover:bg-muted/40"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
          {f.pairs.length > 1 ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-muted-foreground">encoder &rarr; generator</span>
              <select
                className="rounded border bg-background px-2 py-1"
                value={pairIdx}
                onChange={(e) => setPairIdx(Number(e.target.value))}
              >
                {f.pairs.map((p, i) => (
                  <option key={p.name} value={i}>
                    {p.name} (d_C = {p.dc})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {f.originals.length > 1 ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-muted-foreground">what the ratio is measured against</span>
              <select
                className="rounded border bg-background px-2 py-1"
                value={origIdx}
                onChange={(e) => setOrigIdx(Number(e.target.value))}
              >
                {f.originals.map((o, i) => (
                  <option key={o.label} value={i}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {f.dcChoices ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                code width d_C: <span className="tabular-nums text-foreground">{dc}</span>
                {dc === 512 ? " (no released checkpoint)" : ""}
              </span>
              <Range
                min={0}
                max={f.dcChoices.length - 1}
                step={1}
                value={dcIdx}
                onChange={(e) => setDcIdx(Number(e.target.value))}
                aria-label="code width"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-muted-foreground">number format of the code</span>
            <select
              className="rounded border bg-background px-2 py-1"
              value={precIdx}
              onChange={(e) => setPrecIdx(Number(e.target.value))}
            >
              {PRECISIONS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {f.key === "rf" ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
              <span>
                also count the U-Net skip tensor the released decoder reads ({SKIP_VALUES.toLocaleString("en-US")}{" "}
                values)
              </span>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-muted-foreground">
              objects sharing one decoder:{" "}
              <span className="tabular-nums text-foreground">{n.toLocaleString("en-US")}</span>
            </span>
            <Range
              min={0}
              max={OBJECT_COUNTS.length - 1}
              step={1}
              value={nIdx}
              onChange={(e) => setNIdx(Number(e.target.value))}
              aria-label="objects sharing one decoder"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border font-mono text-[11px] sm:grid-cols-4">
          {[
            ["stored per object", fmtBytes(payload), `${dc.toLocaleString("en-US")} numbers × ${bytesPer} B${f.key === "rf" && skip ? " + skip" : ""}`],
            ["ratio per object", fmtRatio(ratio), `against ${fmtBytes(orig.bytes)}`],
            [
              "ratio with decoder",
              fmtRatio(amortised),
              `${fmtBytes(pair.shared)} shared over ${n.toLocaleString("en-US")}`,
            ],
            bitsPerPoint !== null
              ? ["bits per point", bitsPerPoint.toFixed(2), "2048 points per cloud"]
              : ["quality (paper)", f.ours, f.metric],
          ].map(([k, v, s]) => (
            <div key={k} className="bg-background px-2.5 py-2">
              <div className="text-muted-foreground">{k}</div>
              <div className="tabular-nums text-foreground">{v}</div>
              <div className="text-[10px] text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
            compression ratio against the paper&rsquo;s baselines ({f.metric})
          </div>
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_7rem] items-center gap-2 text-[11px]">
                <span className={cn("truncate", r.ours ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {r.name}
                </span>
                <div className="h-3 rounded bg-muted/40">
                  <div
                    className={cn("h-3 rounded", r.ours ? "bg-[oklch(0.62_0.15_50)]" : "bg-[oklch(0.62_0.08_250)]")}
                    style={{ width: `${Math.max(0.6, (r.cr / maxCr) * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums">
                  {fmtRatio(r.cr)} <span className="text-muted-foreground">{r.ours ? "" : r.quality}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The ratio is the original file divided by the code, nothing else. The code&rsquo;s size is fixed
          by its width, so the ratio grows with whatever the original file wastes: switch the point cloud to
          binary and 58.5&times; becomes 12&times;. Half precision would double every ratio for free, which the
          paper never tries. Counting the shared decoder barely matters past a few thousand objects, and
          counting the radiance-field skip tensor matters enormously.
        </p>
      </div>
    </figure>
  )
}
