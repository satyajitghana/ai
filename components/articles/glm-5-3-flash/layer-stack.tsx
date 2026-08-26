"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The stack, read straight out of config.json.
//
// `layer_types` in zai-org/GLM-5.3-Flash is a 45-entry list: 34 entries of
// "linear_attention" and 11 of "deepseek_sparse_attention", laid out three
// linear to one sparse. That ratio is the release in one number — the expensive
// token-mixer runs in under a quarter of the network, and the other three
// quarters carry a fixed-size recurrent state instead of a growing KV cache.
//
// The comparison row is GLM-4.5, which the blog names directly: a similar total
// parameter count reached with roughly twice the layers and twice the activated
// parameters. Depth is what got spent, not width.
//
// Every number below is from the published config or the announcement; nothing
// here is inferred.

const LINEAR = "oklch(0.60 0.15 255)"
const SPARSE = "oklch(0.62 0.16 35)"
const DENSE = "oklch(0.62 0.03 250)"
const GOOD = "oklch(0.55 0.16 155)"

type LayerKind = "linear" | "sparse" | "full"

type Spec = {
  k: string
  label: string
  layers: number
  total: string
  active: string
  hidden: number
  experts: string
  pattern: (i: number) => LayerKind
  dense: number
  note: string
}

// 3 linear : 1 sparse, which reproduces the 34/11 split over 45 layers
const glmPattern = (i: number): LayerKind => ((i + 1) % 4 === 0 ? "sparse" : "linear")

const SPECS: Spec[] = [
  {
    k: "flash",
    label: "GLM-5.3-Flash",
    layers: 45,
    total: "320B",
    active: "18B",
    hidden: 4096,
    experts: "288 routed · 8 active · 1 shared",
    pattern: glmPattern,
    dense: 3,
    note: "34 linear-attention layers, 11 sparse — from layer_types in config.json",
  },
  {
    k: "glm45",
    label: "GLM-4.5",
    layers: 92,
    total: "355B",
    active: "32B",
    hidden: 5120,
    experts: "160 routed · 8 active · 1 shared",
    pattern: (): LayerKind => "full",
    dense: 1,
    note: "every layer full attention — the shape GLM-5.3-Flash is measured against",
  },
]

export function LayerStack() {
  const [sel, setSel] = useState("flash")
  const s = SPECS.find((x) => x.k === sel)!

  const counts = { linear: 0, sparse: 0, full: 0 }
  const types = Array.from({ length: s.layers }, (_, i) => {
    const t = s.pattern(i)
    counts[t]++
    return t
  })

  const W = 700
  const COLS = 46
  const CELL = Math.floor((W - 20) / COLS)
  const rows = Math.ceil(s.layers / COLS)
  const H = rows * (CELL + 3) + 34

  const colourOf = (t: string, i: number) =>
    i < s.dense ? DENSE : t === "sparse" ? SPARSE : t === "full" ? SPARSE : LINEAR

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {s.layers} layers · hidden {s.hidden.toLocaleString()} · {s.total} total, {s.active} active
        </span>
        <span className="font-mono text-[10px]" style={{ color: sel === "flash" ? GOOD : SPARSE }}>
          {sel === "flash"
            ? `${counts.sparse} of ${s.layers} layers keep a KV cache`
            : `all ${s.layers} layers keep a KV cache`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SPECS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={sel === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`The ${s.layers}-layer stack of ${s.label}, one square per layer. ${
                sel === "flash"
                  ? `Thirty-four squares are linear-attention layers and eleven are sparse-attention layers, arranged three to one.`
                  : `Every square is a full-attention layer.`
              } The first ${s.dense} use a dense feed-forward block rather than the mixture of experts.`}
            </title>
            {types.map((t, i) => {
              const r = Math.floor(i / COLS)
              const c = i % COLS
              return (
                <rect
                  key={i}
                  x={10 + c * (CELL + 0.6)}
                  y={8 + r * (CELL + 3)}
                  width={CELL - 0.6}
                  height={CELL}
                  rx={2}
                  fill={colourOf(t, i)}
                  fillOpacity={i < s.dense ? 0.35 : t === "linear" ? 0.55 : 0.9}
                />
              )
            })}
            <text
              x={10}
              y={H - 12}
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              layer 1 → {s.layers} · {s.note}
            </text>
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["dense FFN (first 3)", DENSE, 0.35],
              [sel === "flash" ? "linear attention" : "—", LINEAR, 0.55],
              [sel === "flash" ? "sparse attention · keeps a KV cache" : "full attention · keeps a KV cache", SPARSE, 0.9],
            ] as const
          )
            .filter(([l]) => l !== "—")
            .map(([label, colour, op]) => (
              <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colour, opacity: op }} />
                {label}
              </span>
            ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "layers", v: String(s.layers) },
            { l: "activated params", v: s.active },
            { l: "total params", v: s.total },
            { l: "experts", v: s.experts },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums text-foreground">{x.v}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch between the two and the interesting change is not the total — 320B against 355B is
          nearly the same model budget. It is that GLM-5.3-Flash reaches it with{" "}
          <span className="text-foreground">half the depth and half the activated parameters</span>,
          and spends the savings on a much larger expert pool: 288 routed experts against 160, with
          the same eight firing per token.
          <br />
          <br />
          The colour split is the part that decides what serving costs. In the older shape every
          layer holds a KV cache that grows with the conversation. Here{" "}
          <span style={{ color: SPARSE }}>eleven layers</span>{" "}do, and the other thirty-four carry a
          fixed-size recurrent state instead. At a million tokens that distinction stops being an
          implementation detail and becomes the entire memory bill.
        </p>
      </div>
    </figure>
  )
}
