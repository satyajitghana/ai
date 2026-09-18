"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// #331, drawn as the arithmetic that makes it unfixable by configuration.
//
// `MatMul4Bit.forward` stashes the packed weight on `ctx` as a plain attribute
// (`ctx.tensors = (None, B)`) instead of through `save_for_backward`. Gradient
// checkpointing discards and recomputes *saved* tensors, so it cannot see this one:
// the reference taken in the forward survives, it ALIASES the pooled buffer, and the
// backward reads that slot after it has been refilled with a different layer.
//
// With `stream_buffers = n`, exactly the last n layers loaded are still in the pool
// when the backward starts — so exactly n layers' references are still live and the
// other 32 - n read someone else's bytes. That is the whole shape of the defect, and
// it is why raising n is not a fix: reaching 128/128 that way needs n = 32, i.e. one
// buffer per layer, i.e. the entire model resident, i.e. layer streaming deleted.
//
// Chips = the synthetic 32-layer / hidden 5120 / intermediate 27648 NF4 model the
// project used to reproduce it in about a minute (241 MiB per layer, 7.7 GB total).
// LoRA on q_proj and v_proj gives 4 gradient tensors per layer, hence 128.
// Sources: src/soup_cli/utils/layer_stream_runtime.py:178-215 (the docstring and the
// repair), :845 (`slot_for` = idx % n), :880-897 (`wait`'s ownership tripwire), and
// benchmarks/gate-h100-validation.md STEP 8 / "What the real fix would cost".

const N_LAYERS = 32
const TENSORS_PER_LAYER = 4 // LoRA r on q_proj + v_proj => lora_A, lora_B, twice
const TOTAL_TENSORS = N_LAYERS * TENSORS_PER_LAYER

const GREEN = "oklch(0.64 0.13 160)"
const RED = "oklch(0.62 0.2 25)"

export function AliasedWeight() {
  const [n, setN] = useState(2)
  const [repaired, setRepaired] = useState(false)

  const live = repaired ? N_LAYERS : n
  const stale = N_LAYERS - live
  const exact = live * TENSORS_PER_LAYER

  const W = 720
  const PAD = 20
  const gap = 2
  const chipW = (W - PAD * 2 - (N_LAYERS - 1) * gap) / N_LAYERS
  const chipY = 30
  const chipH = 26
  const chipX = (i: number) => PAD + i * (chipW + gap)
  const rowEnd = PAD + N_LAYERS * (chipW + gap) - gap
  const H = 148

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">#331 · which captured weight the backward actually read</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "as shipped" },
            { v: true, label: "after v0.73.0" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setRepaired(o.v)}
              aria-pressed={repaired === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                repaired === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            repaired
              ? `After the v0.73.0 repair: all ${N_LAYERS} layers hold a live weight reference and all ${TOTAL_TENSORS} gradient tensors are bit-exact, at any number of stream buffers.`
              : `At stream_buffers = ${n}, only the last ${live} of ${N_LAYERS} layers still hold a live weight reference; the other ${stale} alias a buffer slot that has been refilled, so ${exact} of ${TOTAL_TENSORS} gradient tensors are bit-exact.`
          }
        >
          <text x={PAD} y={16} className="fill-muted-foreground font-mono" fontSize={9.5}>
            at the start of the backward · 32 decoder layers, each holding the weight reference its forward captured
          </text>

          {Array.from({ length: N_LAYERS }, (_, i) => {
            const isLive = i >= stale
            return (
              <rect
                key={i}
                x={chipX(i)}
                y={chipY}
                width={chipW}
                height={chipH}
                rx={2.5}
                fill={isLive ? GREEN : RED}
                opacity={isLive ? 0.9 : 0.75}
                className="transition-all duration-200"
              />
            )
          })}
          <text x={PAD} y={chipY + chipH + 12} className="fill-muted-foreground font-mono" fontSize={8.5}>
            layer 0
          </text>
          <text x={rowEnd} y={chipY + chipH + 12} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
            layer 31
          </text>

          {/* bracket under the stale span */}
          {stale > 0 ? (
            <g>
              <path
                d={`M ${chipX(0)} ${chipY + chipH + 18} v 5 H ${chipX(stale - 1) + chipW} v -5`}
                fill="none"
                stroke={RED}
                strokeWidth={1.25}
              />
              <text x={chipX(0)} y={chipY + chipH + 38} className="font-mono" fill={RED} fontSize={9.5} fontWeight={600}>
                {stale} layers · slot refilled, the backward reads another layer&rsquo;s bytes
              </text>
            </g>
          ) : null}

          {/* bracket under the live span */}
          <g>
            <path
              d={`M ${chipX(stale)} ${chipY + chipH + 18} v 5 H ${rowEnd} v -5`}
              fill="none"
              stroke={GREEN}
              strokeWidth={1.25}
            />
            <text x={rowEnd} y={chipY + chipH + 38} textAnchor="end" className="font-mono" fill={GREEN} fontSize={9.5} fontWeight={600}>
              {repaired ? "every layer · recomputed inside the checkpointed region" : `${live} still in the pool · reference live`}
            </text>
          </g>

          {/* exactness bar */}
          <text x={PAD} y={H - 24} className="fill-muted-foreground font-mono" fontSize={9}>
            gradient tensors bit-exact vs a resident NF4 reference
          </text>
          <rect x={PAD} y={H - 18} width={W - PAD * 2} height={12} rx={3} fill="var(--muted)" opacity={0.35} />
          <rect
            x={PAD}
            y={H - 18}
            width={Math.max(((exact / TOTAL_TENSORS) * (W - PAD * 2)), 3)}
            height={12}
            rx={3}
            fill={exact === TOTAL_TENSORS ? GREEN : RED}
            opacity={0.9}
            className="transition-all duration-200"
          />
          <text
            x={W - PAD - 6}
            y={H - 9}
            textAnchor="end"
            className="font-mono"
            fill={exact === TOTAL_TENSORS ? "var(--background)" : "var(--foreground)"}
            fontSize={9}
            fontWeight={600}
          >
            {exact} / {TOTAL_TENSORS}
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          <span className="text-foreground">stream_buffers = {n}</span>
          <span>slot = layer index mod {n}</span>
          <span>{repaired ? "correctness no longer depends on this number" : `resident weight bytes: ${n} × 241 MiB`}</span>
        </div>
        <Range
          min={2}
          max={N_LAYERS}
          step={1}
          value={n}
          onChange={(e) => setN(parseInt(e.target.value))}
          className="mt-1 w-full cursor-pointer"
          aria-label="stream_buffers, the number of pre-allocated VRAM layer buffers"
          accent={repaired ? GREEN : RED}
        />

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="control · as shipped" value="8 / 128" sub="849.6 tok/s · 1,132 MiB peak" bad />
          <Stat label="de-alias by cloning" value="128 / 128" sub="1.06× slower · 9,070 MiB peak" />
          <Stat label="stream_pin: false" value="128 / 128" sub="7.41× slower · 1,129 MiB peak" />
          <Stat label="v0.73.0 repair, real 32B" value="256 / 256" sub="−4.8% throughput · +2.9% peak" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {repaired ? (
            <>
              The repair never lets the streamed weight into that autograd <code>Function</code> at all: it
              dequantises inside the checkpointed region and calls <code>F.linear</code>, which saves the dense
              tensor through the ordinary mechanism — the one checkpointing{" "}
              <span className="text-foreground">does</span> discard and recompute. The transient lives only
              inside the recomputed block, so the cost is O(window) rather than O(model), and exactness stops
              being a function of <code>stream_buffers</code> at all.
            </>
          ) : (
            <>
              Exactly <span className="text-foreground">stream_buffers</span> layers survive, because exactly
              that many are still in the pool when the backward starts — which is why the measured
              8 / 128 here, 8 / 256 on real 32B and 8 / 320 on real 72B are all the same number, two layers, at{" "}
              <code>stream_buffers = 2</code>. Drag it to 32 and the bar does reach 128 / 128: one buffer per
              layer, all 7.7 GB of them resident at once, which is layer streaming deleted. That is the argument
              the two middle cards make quantitatively — cloning to de-alias costs 6% time but{" "}
              <span className="text-foreground">8× peak VRAM</span>, and turning pinning off costs 7.41×
              throughput. Neither is a fix; both were measured before being rejected.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] leading-snug text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground" style={bad ? { color: RED } : undefined}>
        {value}
      </div>
      {sub ? <div className="text-[10px] leading-snug text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
