"use client"

import Link from "next/link"
import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The nine shipped tiers of peculiar-ragdoll/Tiel-Coder-35B-A3B-GGUF, sized
// against a VRAM budget.
//
// Every number below is read out of the GGUF files themselves. `bytes` is the
// file size from https://huggingface.co/api/models/peculiar-ragdoll/
// Tiel-Coder-35B-A3B-GGUF/tree/main?recursive=true. `exps` is the sum over the
// `blk.N.ffn_{gate,up,down}_exps.weight` tensors, computed from each tensor's
// declared shape and ggml type in the GGUF tensor-info block (fetched with an
// HTTP Range request over the first 32 MB of each file — the header is at the
// start). Summing every tensor plus the 11,010,605-byte header reproduces the
// published file size to within 19 bytes of alignment padding on all nine, and
// the element count comes to 34,660,610,688 on all nine, which is exactly the
// `gguf.total` the Hub reports for this repo.
//
// The MoE twist: the routed-expert tensors are 86-93% of the file but only
// 8/256 of them run per token, so they are the part you can leave in system RAM
// (llama.cpp `--n-cpu-moe`, or `-ot "exps=CPU"`) and stream. Everything else —
// the 30 gated-delta blocks, the 10 full-attention blocks, the shared expert,
// the router, the output head — is touched on every single token and wants to
// be resident.
//
// KV: config.json gives num_key_value_heads = 2, head_dim = 256, and a
// layer_types list with exactly 10 `full_attention` entries out of 40. So
// 10 layers x 2 heads x 256 dims x 2 (K and V) x 2 bytes = 20,480 bytes per
// token at fp16. The other 30 layers are linear attention: a constant
// 32 x 128 x 128 fp32 recurrent state each, ~64 MiB total, folded into the
// runtime overhead below because it does not grow with context.

const HOT = "oklch(0.60 0.15 255)"
const EXP = "oklch(0.68 0.13 85)"
const VIS = "oklch(0.55 0.16 155)"
const KVC = "oklch(0.62 0.03 250)"
const BAD = "oklch(0.58 0.19 27)"

const GIB = 1024 * 1024 * 1024
const KV_PER_TOKEN = 20480
const MMPROJ = 902822016 // mmproj-BF16.gguf, one file shared by every tier
const OVERHEAD = 0.9 * GIB // llama.cpp compute buffers + the ~64 MiB SSM state

type Tier = { tier: string; bytes: number; exps: number; bpw: number }

const TIERS: Tier[] = [
  { tier: "Q2_K_XL", bytes: 12290649152, exps: 10527703040, bpw: 2.837 },
  { tier: "IQ3_XXS", bytes: 13211176000, exps: 11108614144, bpw: 3.049 },
  { tier: "Q3_K_XL", bytes: 16845532224, exps: 14279507968, bpw: 3.888 },
  { tier: "IQ4_XS", bytes: 17730530368, exps: 15164506112, bpw: 4.092 },
  { tier: "Q4_K_S", bytes: 20893035584, exps: 18327011328, bpw: 4.822 },
  { tier: "Q4_K_XL", bytes: 22360476736, exps: 19671285760, bpw: 5.161 },
  { tier: "Q5_K_XL", bytes: 26592529472, exps: 23903338496, bpw: 6.138 },
  { tier: "Q6_K_XL", bytes: 31843798080, exps: 29154607104, bpw: 7.35 },
  { tier: "Q8_K_XL", bytes: 38451203136, exps: 35735470080, bpw: 8.875 },
]

const CARDS = [8, 12, 16, 24, 32, 48]

const W = 700
const X0 = 130
const X1 = 566
const SCALE = 52 // GiB across the plot
const ROW = 26
const TOP = 30

const px = (bytes: number) => (bytes / GIB / SCALE) * (X1 - X0)
const gib = (b: number) => b / GIB

export function QuantLadder() {
  const [cap, setCap] = useState(24)
  const [ctxK, setCtxK] = useState(64)
  const [offload, setOffload] = useState(false)
  const [vision, setVision] = useState(false)

  const capBytes = cap * GIB
  const kv = ctxK * 1024 * KV_PER_TOKEN
  const fixed = kv + OVERHEAD + (vision ? MMPROJ : 0)

  const rows = TIERS.map((t) => {
    const hot = t.bytes - t.exps
    const resident = hot + (offload ? 0 : t.exps) + fixed
    const spare = capBytes - resident
    // the largest context this tier can serve on this card
    const maxCtx = Math.max(
      0,
      Math.floor((capBytes - hot - (offload ? 0 : t.exps) - OVERHEAD - (vision ? MMPROJ : 0)) / KV_PER_TOKEN),
    )
    return { ...t, hot, resident, spare, fits: spare >= 0, maxCtx: Math.min(maxCtx, 262144) }
  })

  const nFit = rows.filter((r) => r.fits).length
  const best = rows.filter((r) => r.fits).at(-1)
  const capX = X0 + px(capBytes)
  const H = TOP + TIERS.length * ROW + 22

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          nine tiers · {cap} GiB card · {ctxK}k context{offload ? " · experts in RAM" : ""}
          {vision ? " · vision on" : ""}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: nFit === 0 ? BAD : nFit >= 6 ? VIS : EXP }}
        >
          {nFit} of 9 fit{best ? ` · best is ${best.tier}` : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {CARDS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCap(c)}
              aria-pressed={cap === c}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                cap === c
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c} GiB
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          {(
            [
              ["experts in system RAM", offload, setOffload],
              ["load vision projector", vision, setVision],
            ] as const
          ).map(([label, on, set]) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!on)}
              aria-pressed={on}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Nine quantization tiers stacked against a ${cap} GiB budget at ${ctxK}k context. ${nFit} of 9 fit${
                best ? `, the largest being ${best.tier} at ${gib(best.bytes).toFixed(1)} GiB` : ""
              }. Routed experts are ${offload ? "held in system RAM and do not count" : "resident in VRAM"}.`}
            </title>

            {[0, 10, 20, 30, 40, 50].map((g) => (
              <g key={g}>
                <line
                  x1={X0 + (g / SCALE) * (X1 - X0)}
                  y1={TOP - 6}
                  x2={X0 + (g / SCALE) * (X1 - X0)}
                  y2={H - 20}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={X0 + (g / SCALE) * (X1 - X0)}
                  y={TOP - 10}
                  fontSize={7}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontFamily="ui-monospace, monospace"
                >
                  {g}
                </text>
              </g>
            ))}
            <text
              x={X0 - 8}
              y={TOP - 10}
              fontSize={7}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.4}
              fontFamily="ui-monospace, monospace"
            >
              GiB
            </text>

            <line x1={capX} y1={TOP - 6} x2={capX} y2={H - 20} stroke={BAD} strokeOpacity={0.75} strokeDasharray="4 3" />
            <text
              x={cap >= 40 ? capX - 5 : capX + 5}
              y={TOP - 10}
              fontSize={8}
              textAnchor={cap >= 40 ? "end" : "start"}
              fill={BAD}
              fontFamily="ui-monospace, monospace"
            >
              {cap} GiB
            </text>

            {rows.map((r, i) => {
              const y = TOP + i * ROW
              const segs: { w: number; c: number; label: string }[] = []
              segs.push({ w: r.hot, c: 0, label: "always resident" })
              if (!offload) segs.push({ w: r.exps, c: 1, label: "routed experts" })
              if (vision) segs.push({ w: MMPROJ, c: 2, label: "vision" })
              segs.push({ w: kv, c: 3, label: "KV cache" })
              segs.push({ w: OVERHEAD, c: 4, label: "runtime" })
              const COL = [HOT, EXP, VIS, KVC, "currentColor"]
              let cur = X0
              return (
                <g key={r.tier}>
                  <text
                    x={X0 - 8}
                    y={y + 9}
                    fontSize={9}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={r.fits ? 0.9 : 0.45}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.tier}
                  </text>
                  <text
                    x={X0 - 8}
                    y={y + 19}
                    fontSize={7}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.4}
                    fontFamily="ui-monospace, monospace"
                  >
                    {gib(r.bytes).toFixed(1)} GiB · {r.bpw.toFixed(2)} bpw
                  </text>

                  {segs.map((s) => {
                    const w = Math.max(0.7, px(s.w))
                    const x = cur
                    cur += w
                    return (
                      <rect
                        key={s.label}
                        x={x}
                        y={y + 3}
                        width={w}
                        height={14}
                        fill={COL[s.c]}
                        fillOpacity={s.c === 4 ? 0.16 : r.fits ? 0.82 : 0.28}
                      />
                    )
                  })}

                  {offload ? (
                    <rect
                      x={cur + 3}
                      y={y + 3}
                      width={Math.max(1, px(r.exps))}
                      height={14}
                      fill={EXP}
                      fillOpacity={0.1}
                      stroke={EXP}
                      strokeOpacity={0.55}
                      strokeDasharray="3 2"
                    />
                  ) : null}

                  <text
                    x={W - 8}
                    y={y + 14}
                    fontSize={8}
                    textAnchor="end"
                    fill={r.fits ? VIS : BAD}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.fits
                      ? `+${gib(r.spare).toFixed(1)} GiB spare`
                      : `over by ${gib(-r.spare).toFixed(1)} GiB`}
                  </text>
                </g>
              )
            })}

            <g transform={`translate(${X0}, ${H - 8})`}>
              {(
                [
                  ["always resident", HOT],
                  ["routed experts", EXP],
                  ...(vision ? ([["vision", VIS]] as [string, string][]) : []),
                  ["KV cache", KVC],
                  ["runtime", "currentColor"],
                ] as [string, string][]
              ).map(([label, colour], i) => (
                <g key={label} transform={`translate(${i * 108}, 0)`}>
                  <rect x={0} y={-7} width={7} height={7} fill={colour} fillOpacity={colour === "currentColor" ? 0.16 : 0.82} />
                  <text x={11} y={0} fontSize={7} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            context
          </span>
          <Range
            min={4}
            max={256}
            step={4}
            value={ctxK}
            onChange={(e) => setCtxK(Number(e.target.value))}
            className="flex-1"
            aria-label="context length in thousands of tokens"
            accent={KVC}
          />
          <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {ctxK}k tok
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          KV is {KV_PER_TOKEN / 1024} KB/token — only 10 of 40 blocks do full attention, and those
          have 2 KV heads. {best ? `${best.tier} on ${cap} GiB tops out near ${Math.floor(best.maxCtx / 1024)}k tokens.` : ""}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things fall out of the real byte counts. First, the ladder is almost entirely a{" "}
          <span style={{ color: EXP }}>routed-expert</span>{" "}ladder: the blue block barely moves
          between tiers, because everything that is not an expert sits at Q8_0 in every tier from
          3-bit upward. Second, that blue block is small — 1.64 GiB at the bottom of the ladder,
          2.53 GiB at the top — and it is the only part that must be hot.
          <br />
          <br />
          Turn on <span className="font-mono text-[11px] text-foreground">experts in system RAM</span>{" "}
          and every tier fits a 12 GiB card, because 8 of 256 experts per block are all that run for
          a given token. You then pay for it in bandwidth rather than capacity — the same trade{" "}
          <Link className="underline underline-offset-2" href="/articles/freetoken">
            FreeToken
          </Link>{" "}
          measures per machine instead of guessing at.
        </p>
      </div>
    </figure>
  )
}
