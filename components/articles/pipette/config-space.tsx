"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// "How fast is this model on-device?" is not a question with an answer.
//
// The thing a spec sheet reports as one number is a point in a five-dimensional
// space — model, quantization, runtime, device, context length — and the number
// is only meaningful with all five pinned. Pipette's launch dataset is 1,000+
// such points across 30+ models, and the whole design of the project is a
// refusal to collapse them.
//
// The axis values below are Pipette's actual launch coverage. The counting is
// arithmetic on the chip counts you pick.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const AXES = [
  {
    k: "model",
    label: "model",
    colour: ACCENT,
    values: ["LFM2.5-350M", "LFM2.5-8B-A1B", "Qwen3.5-4B", "Granite-4.0-H-350M", "Ministral-3-8B", "Gemma 4 E4B"],
    note: "30+ in the launch dataset",
  },
  {
    k: "quant",
    label: "quantization",
    colour: WARM,
    values: ["Q4_0", "Q4_K_M", "Q5_K_M", "Q8_0", "IQ1_M"],
    note: "not every model ships every format",
  },
  {
    k: "runtime",
    label: "runtime path",
    colour: GOOD,
    values: ["llama.cpp / Metal", "llama.cpp / CPU", "llama.cpp / Windows"],
    note: "Android is CPU; iOS is Metal",
  },
  {
    k: "device",
    label: "device",
    colour: "oklch(0.55 0.10 300)",
    values: ["iPhone 17 Pro", "Galaxy S26 Ultra", "MacBook Pro M5 Max"],
    note: "AMD Ryzen AI Max+ 395 coming",
  },
  {
    k: "context",
    label: "input tokens",
    colour: "oklch(0.60 0.12 200)",
    values: ["256", "512", "1,024", "2,048", "4,096", "8,192"],
    note: "throughput is not flat across these",
  },
] as const

export function ConfigSpace() {
  const [sel, setSel] = useState<Record<string, number>>({
    model: 1,
    quant: 1,
    runtime: 1,
    device: 1,
    context: 3,
  })
  const [breadth, setBreadth] = useState(100)

  // how much of each axis a hypothetical benchmark actually covers. The model
  // column shows six of the 30+ in the launch set, so the count is scaled up by
  // that ratio to land in the right order of magnitude.
  const MODEL_SCALE = 30 / AXES[0].values.length
  const countAt = (pct: number) =>
    Math.round(
      AXES.map((a) => Math.max(1, Math.round((a.values.length * pct) / 100))).reduce((x, y) => x * y, 1) *
        MODEL_SCALE,
    )
  const scaled = countAt(breadth)
  const atFull = countAt(100)

  const config = AXES.map((a) => a.values[sel[a.k]]).join(" · ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what a single tokens-per-second figure silently fixes
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          ≈ {scaled.toLocaleString()} configurations at this breadth
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-5">
          {AXES.map((a) => (
            <div key={a.k} className="rounded-lg border bg-muted/15 p-2">
              <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: a.colour }}>
                {a.label}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {a.values.map((v, i) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSel((s) => ({ ...s, [a.k]: i }))}
                    aria-pressed={sel[a.k] === i}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-[3px] text-left font-mono text-[9.5px] transition-colors",
                      sel[a.k] === i
                        ? "bg-muted/70 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30",
                    )}
                    style={sel[a.k] === i ? { boxShadow: `inset 2px 0 0 ${a.colour}` } : undefined}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="mt-1 font-mono text-[8.5px] text-muted-foreground">{a.note}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            one configuration
          </div>
          <div className="font-mono text-[11px] text-foreground">{config}</div>
          <div className="mt-1 font-mono text-[9.5px] text-muted-foreground">
            change any one of the five and the measured throughput changes — sometimes by more than
            changing the model does
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            coverage breadth
          </span>
          <Range
            min={20}
            max={100}
            step={5}
            value={breadth}
            onChange={(e) => setBreadth(Number(e.target.value))}
            className="flex-1"
            aria-label="how much of each axis a benchmark actually measures"
            accent={GOOD}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {breadth}%
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "axes pinned by one number", v: "5", c: WARM },
            { l: "configurations at full breadth", v: `≈ ${atFull.toLocaleString()}`, c: ACCENT },
            { l: "Pipette's launch dataset", v: "1,000+", c: GOOD },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every on-device speed claim you have read fixed all five of those and told you about none
          of them. That is not usually dishonesty — it is that there was nowhere to put the other
          four, so the number got quoted with its conditions stripped and then compared against
          another number whose conditions were different.
          <br />
          <br />
          The reason it matters more here than in datacenter benchmarking is that on a phone{" "}
          <span className="text-foreground">the conditions move the answer as much as the model does</span>.
          The same GGUF at Q4_0 and Q8_0 is two different deployments. The same quantization on
          Metal and on an Android CPU path is two different deployments. And, as the next control
          shows, two models of the identical parameter count can behave completely differently as
          the context grows — which means even &ldquo;350M on a Galaxy S26 Ultra at Q4_K_M&rdquo; is
          still not enough to pin a number down.
        </p>
      </div>
    </figure>
  )
}
