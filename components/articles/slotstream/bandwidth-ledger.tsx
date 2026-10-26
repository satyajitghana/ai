"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The bandwidth ledger for one decoded token. Every size below is read from the checkpoint's safetensors headers
// (range requests), every rate is one the slotstream repo or its reporters published, and the hit-rate curve is a
// SIMULATION: slotstream's CLOCK victim scan, ported to Python, run on a synthetic routing trace whose locality was
// fitted to the repo's own M1 trace (CLOCK 0.557 at 30 experts per layer, LRU 0.568 and 0.707 at 30 and 60).
//
//   expert record        2,764,800 B   (3 matrices x (819,200 B 4-bit weights + 102,400 B scales and biases))
//   routed per token     48 layers x 10 = 480 records = 1,327.1 MB
//   dense bytes a token reads from unified memory: 2.209 GB layers + 0.358 GB output head = 2.567 GB
//                                      (+ the 1.327 GB of routed experts = 3.894 GB)
//
// Simulated hit rate of the shared CLOCK pool by experts per layer (1,500 steps, 300 of warm-up, mean of two seeds):
const CURVE: [number, number][] = [
  [20, 0.4082],
  [30, 0.5512],
  [45, 0.6708],
  [60, 0.7469],
  [80, 0.8137],
  [100, 0.8583],
  [120, 0.8896],
  [156, 0.9263],
  [200, 0.9526],
  [256, 0.97],
  [320, 0.9802],
  [400, 0.9855],
  [512, 1],
]
// Where the synthetic trace is kind. At 156 experts per layer the October 5 receipts (original pack, 7,509 slots)
// logged expertHitRate 0.898 / 0.959 / 0.804 for the three workloads, a mean miss rate near 11% against the
// simulation's 7.4%: a miss multiplier of about 1.5. And the 64 GB M4 Max reported 15.93 tok/s from its
// internal SSD and 2.98 from a drive that read 0.9 GB/s, at ~119 experts per layer. Attributing the whole
// 272.8 ms difference to reading the misses at 0.9 GB/s gives a ~20% miss rate there, against the simulation's
// ~11%: a miss multiplier of about 1.8.
const REC_MB = 2.7648
const USES = 480
const DENSE_GB = 2.567
const UMA_MEASURED = 235.1 // GB/s, repo M0.6 (bf16 add over 537 MB arrays)

function hitAt(n: number, mult: number): number {
  let h = 1
  if (n <= CURVE[0][0]) h = CURVE[0][1]
  else
    for (let k = 1; k < CURVE.length; k++) {
      if (n <= CURVE[k][0]) {
        const [x0, y0] = CURVE[k - 1]
        const [x1, y1] = CURVE[k]
        h = y0 + ((y1 - y0) * (n - x0)) / (x1 - x0)
        break
      }
    }
  return Math.max(0, 1 - (1 - h) * mult)
}

const MEASURED = [
  { w: "short prompt", tps: 20.91, hit: 0.898, mb: 53.8, io: 17 },
  { w: "longer context", tps: 23.69, hit: 0.959, mb: 29.2, io: 11 },
  { w: "coding answer", tps: 21.65, hit: 0.804, mb: 112.1, io: 30 },
]

const C_SSD = "oklch(0.60 0.17 30)"
const C_HIT = "oklch(0.62 0.15 150)"
const C_UMA = "oklch(0.62 0.15 285)"

const TOKS = [
  { t: "20.91", v: 20.91, n: "short prompt" },
  { t: "21.59", v: 21.59, n: "coding answer" },
  { t: "23.69", v: 23.69, n: "longer context" },
]
const SSDS = [
  { t: "0.9 USB", v: 0.9 },
  { t: "3.7 M4 Pro", v: 3.7 },
  { t: "12 engine", v: 12 },
  { t: "17.3 raw", v: 17.3 },
]

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  accent?: string
}) {
  const { label, value, min, max, step, fmt, onChange, accent } = props
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-36 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        accent={accent}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
      <span className="w-24 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

function Bar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded bg-muted" role="img" aria-label={label}>
        <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`, background: color }} />
      </div>
      <span className={cn("w-12 text-right font-mono text-[11px] tabular-nums", pct > 100 && "text-foreground")}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

export function BandwidthLedger() {
  const [tps, setTps] = useState(21.59)
  const [per, setPer] = useState(156)
  const [ssd, setSsd] = useState(12)
  const [mult, setMult] = useState(1.5)

  const gbCache = (per * 48 * REC_MB) / 1000
  const hit = hitAt(per, mult)
  const allMissGB = (USES * REC_MB) / 1000
  const needAll = allMissGB * tps
  const missRecords = USES * (1 - hit)
  const missGB = (missRecords * REC_MB) / 1000
  const needMiss = missGB * tps
  const floorHit = Math.max(0, 1 - ssd / needAll)
  const ioMs = (missGB / ssd) * 1000
  const budgetMs = 1000 / tps
  const uma = ((allMissGB + DENSE_GB) * tps) / UMA_MEASURED

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the ledger for one token · sizes measured from the headers, rates reported, hit rate simulated
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">speed</span>
        {TOKS.map((s) => (
          <button
            key={s.t}
            type="button"
            title={s.n}
            onClick={() => setTps(s.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              tps === s.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.t}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">SSD</span>
        {SSDS.map((s) => (
          <button
            key={s.t}
            type="button"
            onClick={() => setSsd(s.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              ssd === s.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.t}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">misses</span>
        {[
          { t: "x1.0 synthetic", v: 1 },
          { t: "x1.5 Oct 5 receipts", v: 1.5 },
          { t: "x1.8 M4 Max", v: 1.8 },
        ].map((s) => (
          <button
            key={s.t}
            type="button"
            onClick={() => setMult(s.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              mult === s.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 px-4 pt-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">
              SSD bandwidth a token needs, as a share of the SSD you picked
            </div>
            <Bar
              pct={(needAll / ssd) * 100}
              color={C_SSD}
              label={`If every one of the 480 experts were read from the SSD, ${needAll.toFixed(1)} GB per second would be needed, ${((needAll / ssd) * 100).toFixed(0)} percent of ${ssd} GB per second.`}
            />
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              all 480 read: {allMissGB.toFixed(3)} GB x {tps.toFixed(2)} = {needAll.toFixed(1)} GB/s
            </div>
            <div className="mt-2">
              <Bar
                pct={(needMiss / ssd) * 100}
                color={C_HIT}
                label={`With the cache's misses only, ${needMiss.toFixed(1)} GB per second, ${((needMiss / ssd) * 100).toFixed(0)} percent of ${ssd} GB per second.`}
              />
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              misses only: {missRecords.toFixed(0)} records = {(missGB * 1000).toFixed(0)} MB a token = {needMiss.toFixed(2)} GB/s
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">
              unified memory: experts + dense weights the GPU reads, against the 235.1 GB/s the repo measured
            </div>
            <Bar
              pct={uma * 100}
              color={C_UMA}
              label={`The GPU reads ${(allMissGB + DENSE_GB).toFixed(2)} GB a token, ${(uma * 100).toFixed(0)} percent of the measured 235.1 GB per second.`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">expert cache</div>
            <div className="text-xl tabular-nums">{gbCache.toFixed(1)} GB</div>
            <div className="text-[10px] text-muted-foreground">{per * 48} slots, {((per / 512) * 100).toFixed(0)}% of records</div>
          </div>
          <div>
            <div className="text-muted-foreground">hit rate (simulated)</div>
            <div className="text-xl tabular-nums">{(hit * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">CLOCK pool, miss rate x {mult}</div>
          </div>
          <div>
            <div className="text-muted-foreground">hit rate it must exceed</div>
            <div className="text-xl tabular-nums">{(floorHit * 100).toFixed(0)}%</div>
            <div className="text-[10px] text-muted-foreground">if the SSD were the only cost</div>
          </div>
          <div>
            <div className="text-muted-foreground">read time a token</div>
            <div className="text-xl tabular-nums">
              {ioMs.toFixed(1)} <span className="text-xs">of {budgetMs.toFixed(1)} ms</span>
            </div>
            <div className="text-[10px] text-muted-foreground">bandwidth only, no read latency</div>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        <div className="mb-1">logged by the October 5 runs at 156 experts a layer (reported, decoded from the run record)</div>
        <table className="w-full tabular-nums">
          <thead>
            <tr className="text-left">
              <th className="font-normal">workload</th>
              <th className="font-normal">tok/s</th>
              <th className="font-normal">pool hit</th>
              <th className="font-normal">MB read a token</th>
              <th className="font-normal">waiting on reads</th>
            </tr>
          </thead>
          <tbody>
            {MEASURED.map((m) => (
              <tr key={m.w}>
                <td>{m.w}</td>
                <td>{m.tps.toFixed(2)}</td>
                <td>{(m.hit * 100).toFixed(1)}%</td>
                <td>{m.mb.toFixed(1)}</td>
                <td>{m.io}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
        <Slider label="tokens per second" value={tps} min={3} max={34} step={0.01} fmt={(v) => `${v.toFixed(2)}`} onChange={setTps} />
        <Slider
          label="experts per layer"
          value={per}
          min={20}
          max={400}
          step={1}
          fmt={(v) => `${v} (${((v * 48 * REC_MB) / 1000).toFixed(0)} GB)`}
          onChange={setPer}
          accent={C_HIT}
        />
        <Slider label="SSD read rate" value={ssd} min={0.5} max={18} step={0.1} fmt={(v) => `${v.toFixed(1)} GB/s`} onChange={setSsd} accent={C_SSD} />
        <Slider label="miss multiplier" value={mult} min={1} max={2.5} step={0.05} fmt={(v) => `x ${v.toFixed(2)}`} onChange={setMult} />
      </div>
    </figure>
  )
}
