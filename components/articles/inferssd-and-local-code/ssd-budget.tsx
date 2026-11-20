"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decode speed when routed experts come off the SSD, in the form InferSSD's own
// pre-launch estimator uses (framework/src/inferssd/strategy/estimate.py at
// commit ca8db2e):
//
//   hit      = routing_hit(cache / experts, hot_fraction, traffic_fraction)
//   drive_s  = (1 - hit) * routed_bytes_per_token / drive_Bps
//   serial   = 1 / (other_s + drive_s)              estimate.py's central figure
//   overlap  = 1 / max(other_s, drive_s)            its "perfect overlap" scenario
//
// routing_hit is estimate.py's two-zone model: the hot experts (a fraction of the
// store carrying a fraction of the traffic) are cached first. The four patterns
// are estimate.py's ROUTING_PATTERNS, which its own comment calls "illustrative
// hypotheses, NOT a learned distribution".
//
// Model bytes are from the GGUF headers, read by HTTP range request:
//   Qwen3.6-35B-A3B UD-Q4_K_XL: 40 layers x 8 of 256 experts, 1,921,024 B mean
//     per expert-layer -> 614,727,680 B a token; 19,671,285,760 B of experts.
//   Qwen3.8-Flash-Next IQ4_XS: 48 x 10 of 512, 2,662,400 B each -> 1,277,952,000 B
//     a token; 65,431,142,400 B of experts.
//   DeepSeek-V4.1-Flash-1017 Q8_0: 40 x 6 of 384, MXFP4 experts repacked without
//     requantization -> 4.51 GB a token and 288.78 GB of experts (the
//     deepseek-v4-1-flash-1017 article's header counts).
// "Everything else" (dense layers, attention, the expert arithmetic itself) is a
// slider, because it depends on the machine; estimate.py prices it from the
// machine profile.
//
// Only + - * / and Math.round/min/max reach the DOM: no lib/dmath needed.

type Model = { id: string; label: string; perToken: number; experts: number }

const MODELS: Model[] = [
  { id: "q36", label: "Qwen3.6-35B-A3B Q4_K_XL", perToken: 614_727_680, experts: 19_671_285_760 },
  { id: "fn", label: "Qwen3.8 Flash Next IQ4_XS", perToken: 1_277_952_000, experts: 65_431_142_400 },
  { id: "ds", label: "DeepSeek V4.1 Flash Q8_0", perToken: 4_510_000_000, experts: 288_780_000_000 },
]

type Pattern = { id: string; label: string; hot: number; traffic: number }

const PATTERNS: Pattern[] = [
  { id: "uniform", label: "uniform", hot: 1, traffic: 1 },
  { id: "h50", label: "50% of experts get 75%", hot: 0.5, traffic: 0.75 },
  { id: "h20a", label: "20% get 80%", hot: 0.2, traffic: 0.8 },
  { id: "h20b", label: "20% get 95%", hot: 0.2, traffic: 0.95 },
]

function routingHit(capacity: number, hot: number, traffic: number) {
  const c = Math.max(0, Math.min(1, capacity))
  if (c <= hot) return (traffic * c) / hot
  return traffic + ((1 - traffic) * (c - hot)) / (1 - hot)
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function SsdBudget() {
  const [modelId, setModelId] = useState("ds")
  const [patternId, setPatternId] = useState("h20a")
  const [cacheGB, setCacheGB] = useState(56)
  const [ssd, setSsd] = useState(7)
  const [otherMs, setOtherMs] = useState(60)
  const [overlap, setOverlap] = useState(false)

  const m = MODELS.find((x) => x.id === modelId) ?? MODELS[0]
  const p = PATTERNS.find((x) => x.id === patternId) ?? PATTERNS[0]
  const expertsGB = m.experts / 1e9
  const cache = Math.min(cacheGB, expertsGB)
  const hit = routingHit(cache / expertsGB, p.hot, p.traffic)
  const readGB = ((1 - hit) * m.perToken) / 1e9
  const driveMs = (readGB / ssd) * 1000
  const totalMs = overlap ? Math.max(otherMs, driveMs) : otherMs + driveMs
  const tps = totalMs > 0 ? 1000 / totalMs : 0
  const coldTps = 1000 / ((overlap ? Math.max(otherMs, (m.perToken / 1e9 / ssd) * 1000) : otherMs + (m.perToken / 1e9 / ssd) * 1000))
  const scale = Math.max(otherMs + driveMs, 1)
  const w = (ms: number) => `${r2((ms / scale) * 100)}%`

  const pickModel = (x: Model) => {
    setModelId(x.id)
    setCacheGB(Math.round(Math.min(cacheGB, x.experts / 1e9)))
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">decode speed when experts live on the SSD</span>
        <span className="font-mono text-[10px] text-muted-foreground">estimate.py&apos;s model, not a measurement</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="model">
            {MODELS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => pickModel(x)}
                aria-pressed={x.id === modelId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === modelId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="routing pattern">
            {PATTERNS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setPatternId(x.id)}
                aria-pressed={x.id === patternId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === patternId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            RAM + VRAM expert cache: <span className="text-foreground">{Math.round(cache)} GB</span> of{" "}
            {r1(expertsGB)} GB of experts
            <Range
              min={0}
              max={Math.ceil(expertsGB)}
              step={1}
              value={Math.min(cacheGB, Math.ceil(expertsGB))}
              onChange={(e) => setCacheGB(Number(e.target.value))}
            />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            SSD random-read rate: <span className="text-foreground">{r1(ssd)} GB/s</span>
            <Range min={0.5} max={15} step={0.5} value={ssd} onChange={(e) => setSsd(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            everything else per token: <span className="text-foreground">{Math.round(otherMs)} ms</span>
            <Range min={5} max={400} step={5} value={otherMs} onChange={(e) => setOtherMs(Number(e.target.value))} />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setOverlap((v) => !v)}
              aria-pressed={overlap}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                overlap ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {overlap ? "reads hidden behind compute" : "reads then compute (serial)"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-1.5" aria-hidden="true">
          <div className="flex h-6 w-full overflow-hidden rounded bg-muted/30">
            <div className="h-full bg-sky-500/70" style={{ width: w(otherMs) }} />
            <div className={cn("h-full bg-amber-500/80", overlap && "opacity-40")} style={{ width: w(driveMs) }} />
          </div>
          <div className="flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500/70" />
              compute and dense {Math.round(otherMs)} ms
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-500/80" />
              SSD reads {r1(driveMs)} ms{overlap ? " (overlapped)" : ""}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">expert lookups served from cache</dt>
            <dd className="text-base text-foreground">{Math.round(hit * 100)}%</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">read from SSD per token</dt>
            <dd className="text-base text-foreground">{r2(readGB)} GB</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">decode</dt>
            <dd className="text-base text-foreground">{r1(tps)} tok/s</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">with no cache at all</dt>
            <dd className="text-base text-foreground">{r2(coldTps)} tok/s</dd>
          </div>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Bytes per token are counted from each GGUF&apos;s tensor headers. The hit rate is InferSSD&apos;s own two-zone
        routing hypothesis from <code>strategy/estimate.py</code>, not a measured distribution, and &quot;everything
        else&quot; is a guess you set. Halve the miss rate and the SSD term halves; that is the whole game.
      </figcaption>
    </figure>
  )
}
