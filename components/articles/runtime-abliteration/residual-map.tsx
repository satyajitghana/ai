"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where the 129 sites actually sit, and what the strength knob actually does --
// both taken straight from bonsai_abliterate/ablation.py and the pack's own
// config.json (fetched from the Hub, not guessed): 64 layers, laid out
// full_attention every 4th index (verified against text_config.layer_types),
// each layer writing the residual stream twice -- once from its attention
// block's out-projection, once from its MLP's down-projection -- plus one more
// write from the token embedding. Wrapping only self_attn.o_proj would miss
// every linear-attention layer's write entirely, which is the mistake the
// repo's README calls out by name.
//
// The alpha math is exact, not illustrative: install()'s Ablated module computes
// y' = y - alpha*(y.r)*r. Decompose y = y_par + y_perp along r: y' = y_perp +
// (1-alpha)*y_par. So "% of the parallel component retained" below is
// (1-alpha)*100, read directly off the formula -- and past alpha=1 that
// coefficient goes negative, which is a real, checkable property (the
// component flips to point against r) and not something the README states.

const LAYER_TYPES: ("linear" | "full")[] = Array.from({ length: 64 }, (_, i) =>
  i % 4 === 3 ? "full" : "linear",
)
const RANGE_EXAMPLE = [20, 21, 22, 23] // the exact --layers example from the README

const LINEAR = "oklch(0.60 0.15 255)"
const FULL = "oklch(0.62 0.16 35)"
const HOOK = "oklch(0.72 0.15 195)"
const EMBED = "oklch(0.55 0.16 155)"

type Scope = "all" | "range"

function wrappedLayers(scope: Scope): number[] {
  return scope === "all" ? LAYER_TYPES.map((_, i) => i) : RANGE_EXAMPLE
}

export function ResidualMap() {
  const [scope, setScope] = useState<Scope>("all")
  const [includeEmbed, setIncludeEmbed] = useState(true)
  const [alphaPct, setAlphaPct] = useState(100) // 0..130, alpha = alphaPct/100

  const alpha = alphaPct / 100
  const retained = 1 - alpha // coefficient on the parallel component, per the formula
  const layers = wrappedLayers(scope)
  const total = layers.length * 2 + (includeEmbed ? 1 : 0)

  // 64-cell grid geometry
  const COLS = 16
  const ROWS = 4
  const GW = 660
  const GAP = 3
  const CELL = (GW - GAP * (COLS - 1)) / COLS
  const GH = ROWS * CELL + (ROWS - 1) * GAP

  const inScope = (i: number) => layers.includes(i)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          residual writers · Ternary Bonsai 2 27B, 64 layers
        </span>
        <div className="flex gap-1">
          {(["all", "range"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              aria-pressed={scope === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                scope === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "all" ? "all layers" : "--layers 20,21,22,23"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* one layer, unrolled: where the hook sits relative to attention and MLP */}
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 700 118"
            width={700}
            height={118}
            role="img"
            className="min-w-[560px] max-w-full"
          >
            <title>
              One layer&rsquo;s residual stream, left to right: the attention
              block&rsquo;s out-projection writes in, then the MLP&rsquo;s
              down-projection writes in. The ablation hook sits on each write, right
              where its output rejoins the stream -- not inside the projection, and
              not on q/k/v or the MLP&rsquo;s gate/up projections, which never touch
              the residual stream directly.
            </title>
            {/* residual rail */}
            <line x1={24} y1={70} x2={676} y2={70} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
            <text x={24} y={92} fontSize={10} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">h_in</text>
            <text x={676} y={92} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">h_out</text>

            {/* attention branch */}
            <g>
              <line x1={150} y1={70} x2={150} y2={38} stroke={LINEAR} strokeWidth={1.6} />
              <rect x={95} y={14} width={110} height={26} rx={5} fill={LINEAR} fillOpacity={0.14} stroke={LINEAR} strokeWidth={1.2} />
              <text x={150} y={31} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill="currentColor">o_proj / out_proj</text>
              <circle cx={150} cy={52} r={6} fill="var(--background)" stroke={HOOK} strokeWidth={2} />
              <line x1={150} y1={58} x2={150} y2={70} stroke={LINEAR} strokeWidth={1.6} />
              <circle cx={150} cy={70} r={3.5} fill="currentColor" />
            </g>

            {/* MLP branch */}
            <g>
              <line x1={480} y1={70} x2={480} y2={38} stroke={FULL} strokeWidth={1.6} />
              <rect x={425} y={14} width={110} height={26} rx={5} fill={FULL} fillOpacity={0.14} stroke={FULL} strokeWidth={1.2} />
              <text x={480} y={31} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill="currentColor">mlp.down_proj</text>
              <circle cx={480} cy={52} r={6} fill="var(--background)" stroke={HOOK} strokeWidth={2} />
              <line x1={480} y1={58} x2={480} y2={70} stroke={FULL} strokeWidth={1.6} />
              <circle cx={480} cy={70} r={3.5} fill="currentColor" />
            </g>

            <text x={150} y={105} textAnchor="middle" fontSize={9} fill={HOOK} fontFamily="ui-monospace, monospace">hook 1</text>
            <text x={480} y={105} textAnchor="middle" fontSize={9} fill={HOOK} fontFamily="ui-monospace, monospace">hook 2</text>
            <text x={315} y={105} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">y ← y − α·(y·r)·r, both marks</text>
          </svg>
        </div>

        {/* 64-layer grid */}
        <div className="mt-4 flex items-start gap-3 overflow-x-auto">
          <div className="shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => setIncludeEmbed((v) => !v)}
              aria-pressed={includeEmbed}
              className="flex flex-col items-center gap-1"
              title="model.embed_tokens -- toggled separately from layers by install()'s include_embedding argument"
            >
              <span
                className="block h-[16px] w-[16px] rounded-[3px] border transition-opacity"
                style={{ background: EMBED, opacity: includeEmbed ? 0.9 : 0.15, borderColor: EMBED }}
              />
              <span className="font-mono text-[8px] text-muted-foreground">embed</span>
            </button>
          </div>
          <svg viewBox={`0 0 ${GW} ${GH}`} width={GW} height={GH} role="img" className="min-w-[560px] max-w-full">
            <title>
              Sixty-four layer cells. Linear-attention layers (48) in blue, full-attention layers
              (16, every fourth) in orange. In &ldquo;--layers 20,21,22,23&rdquo; scope, only those four
              are highlighted; the rest dim to show they keep their original, unwrapped behavior.
            </title>
            {LAYER_TYPES.map((t, i) => {
              const col = i % COLS
              const row = Math.floor(i / COLS)
              const x = col * (CELL + GAP)
              const y = row * (CELL + GAP)
              const active = inScope(i)
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={t === "linear" ? LINEAR : FULL}
                  fillOpacity={active ? 0.85 : 0.12}
                />
              )
            })}
          </svg>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-0.5">
          {[
            ["linear-attention layer (48) · linear_attn.out_proj + mlp.down_proj", LINEAR],
            ["full-attention layer (16) · self_attn.o_proj + mlp.down_proj", FULL],
            ["model.embed_tokens (1)", EMBED],
          ].map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colour }} />
              {label}
            </span>
          ))}
        </div>

        {/* live count */}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs">
          <span className="text-muted-foreground">
            {layers.length} layer{layers.length === 1 ? "" : "s"} × 2 writers
            {includeEmbed ? " + 1 embedding" : ""}
          </span>
          <span className="text-base font-semibold" style={{ color: HOOK }}>
            = {total} wrapped
          </span>
          {scope === "all" && includeEmbed ? (
            <span className="text-muted-foreground">matches the README&rsquo;s and selfcheck.py&rsquo;s expected 129</span>
          ) : null}
        </div>

        {/* strength control */}
        <div className="mt-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>strength α</span>
            <div className="flex gap-1">
              {[0, 50, 70, 90, 100, 120].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAlphaPct(p)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                    alphaPct === p
                      ? "border-foreground/40 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  {(p / 100).toFixed(p % 10 ? 2 : 1)}
                </button>
              ))}
            </div>
          </div>
          <Range
            min={0}
            max={130}
            step={1}
            value={alphaPct}
            onChange={(e) => setAlphaPct(Number(e.target.value))}
            className="w-full"
            aria-label="ablation strength alpha"
            accent={HOOK}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">α</div>
              <div className="mt-0.5 text-lg tabular-nums" style={{ color: HOOK }}>{alpha.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">parallel component removed</div>
              <div className="mt-0.5 text-lg tabular-nums text-foreground">{(alpha * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-muted-foreground">retained coefficient (1−α)</div>
              <div
                className="mt-0.5 text-lg tabular-nums"
                style={{ color: retained < 0 ? FULL : "var(--foreground)" }}
              >
                {retained.toFixed(2)}
                {retained < 0 ? " (flipped)" : ""}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Decompose a write <span className="font-mono">y</span> into a part along <span className="font-mono">r</span>{" "}
          and a part perpendicular to it: the hook leaves the perpendicular part alone and rescales the parallel part
          by <span className="font-mono">(1−α)</span>. At <span className="text-foreground">α=0</span>{" "}
          that&rsquo;s 1 — untouched — and <span className="font-mono">run.py</span>{" "}
          {" "}doesn&rsquo;t even call <span className="font-mono">install()</span> in that case, so it isn&rsquo;t
          just a no-op math-wise, the wrapping never happens. At <span className="text-foreground">α=1</span>{" "}
          the parallel part is gone, matching a full weight edit exactly. Push past{" "}
          <span className="text-foreground">α=1</span> and <span className="font-mono">(1−α)</span>{" "}
          goes negative — the surviving component doesn&rsquo;t just shrink further, it flips to point{" "}
          <em>against</em> <span className="font-mono">r</span>, which is what the README&rsquo;s own
          &ldquo;may degrade model quality&rdquo; warning is quietly describing.
        </p>
      </div>
    </figure>
  )
}
