"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every figure here is quoted from Liquid AI's blog. I have not measured any of
// it, and the on-device numbers come with no stated quantization, batch size or
// prompt — so they are claims, reported as claims. The GPU numbers are better
// specified: vLLM 0.26, BF16, a 512x512 image plus 1,024 input tokens, up to
// 256 output tokens, median of 5 runs, single H100 SXM5.

type Device = {
  id: string
  name: string
  kind: "device" | "gpu"
  tps: number
  unit: string
  note: string
}

const DEVICES: Device[] = [
  {
    id: "m5",
    name: "Apple M5 Max",
    kind: "device",
    tps: 228,
    unit: "tok/s decode",
    note: "The fastest of the three local targets, and comfortably faster than a person reads. Liquid AI puts the whole model in about 3 GB, which is the number that decides whether this runs alongside everything else on a laptop or instead of it.",
  },
  {
    id: "ryzen",
    name: "AMD Ryzen AI Max+ 395",
    kind: "device",
    tps: 116,
    unit: "tok/s decode",
    note: "About half the Apple figure on x86. Still well above reading speed, and this is the class of chip showing up in mini-PCs and handhelds rather than datacenters.",
  },
  {
    id: "s26",
    name: "Galaxy S26 Ultra",
    kind: "device",
    tps: 20,
    unit: "tok/s decode",
    note: "The one that makes the point. 20 tok/s on a phone is slow enough to watch and fast enough to use — and a 3B vision model answering on-device means the image never leaves the handset.",
  },
  {
    id: "h100-ttft",
    name: "H100 · 5-frame clip",
    kind: "gpu",
    tps: 34,
    unit: "ms to first token",
    note: "Against roughly 200 ms for the Gemma models on the same input. Liquid AI credits the compact vision encoder and the fact that the model answers directly instead of reasoning — there is no thinking budget to spend before the first token.",
  },
  {
    id: "h100-thr",
    name: "H100 · sustained load",
    kind: "gpu",
    tps: 11000,
    unit: "tok/s output",
    note: "Roughly 2x the 4B-class models and ahead of the 2B-class ones, at high concurrency. Liquid AI works that out to nearly 1B output tokens per day from a single H100.",
  },
]

const DEV = "oklch(0.60 0.15 255)"
const GPU = "oklch(0.68 0.13 85)"

export function EdgeBudget() {
  const [sel, setSel] = useState("m5")
  const d = DEVICES.find((x) => x.id === sel)!

  // local decode rates share one scale; the GPU rows are their own units
  const localMax = 228

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where 3.1B parameters actually run</span>
        <span className="font-mono text-[10px] text-muted-foreground">~3 GB resident</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {DEVICES.filter((x) => x.kind === "device").map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              aria-pressed={sel === x.id}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
                sel === x.id ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-36 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                {x.name}
              </span>
              <span className="h-3.5 flex-1 rounded-sm bg-muted/40">
                <span
                  className="block h-3.5 rounded-sm"
                  style={{ width: `${(x.tps / localMax) * 100}%`, background: DEV }}
                />
              </span>
              <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {x.tps} {x.unit.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {DEVICES.filter((x) => x.kind === "gpu").map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              aria-pressed={sel === x.id}
              className={cn(
                "cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                sel === x.id ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
              )}
            >
              <div className="font-mono text-[10px] text-muted-foreground">{x.name}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: GPU }}>
                {x.tps.toLocaleString()} <span className="text-[10px] text-muted-foreground">{x.unit}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: d.kind === "gpu" ? GPU : DEV }}>
            {d.name} — {d.tps.toLocaleString()} {d.unit}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{d.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The GPU numbers are the well-specified ones — vLLM 0.26, BF16, a 512×512 image plus 1,024 input tokens,
          median of five runs on one H100 SXM5. The on-device figures come with no stated quantization, prompt or
          batch size, so they are worth reading as claims rather than measurements. Both sets point the same way:
          the design is spending its parameter budget on being answerable immediately rather than on being right
          after thinking, and time-to-first-token is where a non-reasoning model collects.
        </p>
      </div>
    </figure>
  )
}
