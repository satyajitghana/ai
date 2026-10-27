"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The byte budget of the engine download and the loader's stage weights. The
// sizes are the page's own loader config for bundle 430ea959... (the "classic"
// bundle the page embeds); the stage weights are from /game/loader.js. Time is
// bytes over bandwidth with no latency, no TLS and no decode, so it is a floor.

const FILES = [
  { id: "wasm", label: "engine .wasm", raw: 248252583, gz: 56561622 },
  { id: "data", label: "engine .data", raw: 5175666, gz: 2517479 },
  { id: "js", label: "engine .js", raw: null as number | null, gz: 144692 },
]

const STAGES = [
  { k: "Link", w: 3 },
  { k: "Engine", w: 40 },
  { k: "Compile", w: 10 },
  { k: "Archives", w: 7 },
  { k: "Shaders", w: 15 },
  { k: "World", w: 25 },
]

const BW = [1, 3, 10, 25, 100]

const mb = (n: number) => (n / 1e6).toFixed(1)

export function LoadBudget() {
  const [bw, setBw] = useState(10)
  const total = FILES.reduce((a, f) => a + f.gz, 0)
  const secs = total / (bw * 1e6)
  const sum = STAGES.reduce((a, s) => a + s.w, 0)
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">What the first visit has to move before any game data</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground"><th className="px-4 py-2">File</th><th className="px-4 py-2">Raw</th><th className="px-4 py-2">Gzipped</th><th className="px-4 py-2">Ratio</th></tr>
          </thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="px-4 py-1.5">{f.label}</td>
                <td className="px-4 py-1.5">{f.raw === null ? "not in the config" : `${mb(f.raw)} MB`}</td>
                <td className="px-4 py-1.5">{mb(f.gz)} MB</td>
                <td className="px-4 py-1.5">{f.raw === null ? "-" : `${(f.raw / f.gz).toFixed(2)}x`}</td>
              </tr>
            ))}
            <tr className="border-t border-border font-medium"><td className="px-4 py-1.5">Compressed total</td><td className="px-4 py-1.5" /><td className="px-4 py-1.5">{mb(total)} MB</td><td className="px-4 py-1.5" /></tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-xs">
        <span className="text-muted-foreground">Sustained bandwidth</span>
        {BW.map((b) => (
          <button key={b} type="button" onClick={() => setBw(b)} className={cn("rounded-full border px-3 py-1", bw === b ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>{b} MB/s</button>
        ))}
        <span className="ml-auto">Floor for the engine files: <span className="font-medium">{secs < 10 ? secs.toFixed(1) : Math.round(secs)} s</span></span>
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">The loader&apos;s progress bar is weighted, not timed</div>
        <div className="flex h-8 w-full overflow-hidden rounded-md border border-border text-[11px]">
          {STAGES.map((s, i) => {
            const left = STAGES.slice(0, i).reduce((a, x) => a + x.w, 0)
            return (
              <div key={s.k} style={{ width: `${(s.w / sum) * 100}%` }} className={cn("flex items-center justify-center border-r border-border last:border-r-0", i % 2 ? "bg-muted" : "bg-card")} title={`${s.k}: weight ${s.w} of ${sum}, bar ${left}-${left + s.w}%`}>
                {s.k} {s.w}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Weights 3 / 40 / 10 / 7 / 15 / 25 sum to {sum}. The bar sits at 43% once the engine bytes have landed, whatever the wall clock says. The loader&apos;s header says it is driven by real signals only: decoded wasm bytes, the instantiate promise, the archive manifest, the pipeline-cache count and the engine&apos;s own &ldquo;loading stage&rdquo; probe (N of 15).</p>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Sizes: read from the page&apos;s <code>cp2077LoaderConfig</code>. Time: computed here, a floor. Game archives are not in this table because the page does not state their size; they stream on demand.</p>
    </div>
  )
}
