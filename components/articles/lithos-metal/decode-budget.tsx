"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The decode-time budget for Qwen3.8-27B + DSpark on a 40-core M5 Max.
//
// This is a model, not a measurement. It combines two kinds of input:
//
// 1. Measured round times, copied from lithos-metal's own research notes
//    (docs/research/m5max-27b-dspark-refinement.md at commit 46b2bc4):
//    a "round" is one target pass over the anchor + seven proposals, the
//    acceptance/commit, and the next draft block. BF16 draft: paired medians
//    at all five context tiers. NVFP4 draft: refined endpoint recipes, measured
//    only at 128 and 32K.
//
// 2. A bandwidth floor I computed from the checkpoint headers:
//    - target weights read per pass: 17.608 GB (64 decoder layers + the NVFP4
//      vocabulary head, summed from the safetensors headers of
//      nvidia/Qwen3.8-27B-NVFP4; embeddings and the vision tower excluded)
//    - GDN recurrent state, read and written once per pass:
//      2 x 48 layers x 48 heads x 128 x 128 x 4 bytes = 0.302 GB
//    - target KV: 16 layers x 4 KV heads x 256 dims x (K,V) x 2 bytes =
//      65,536 bytes per token of context (BF16, monolith/nn/attention.py:89)
//    - NVFP4 draft head: 1.939 GB per round (its safetensors minus the gathered
//      Markov W1, plus six extra reads of Markov W2, plus the shared target
//      head); BF16 draft: 5.218 GB, Lithos's own count
//    - draft KV: 5 layers x 8 KV heads x 128 x 2 x 2 bytes = 20,480 bytes/token
//    - Apple's 614.4 GB/s (614GB/s on Apple's spec page; 614.4 in the repo's
//      m5_max_40c/config.json)
//
// tokens/s = tokens committed per round / round time. A round commits the
// accepted proposals plus one bonus token from the target, so it is 1 to 8.

const BW = 614.4
const TARGET_W = 17.608
const GDN_STATE_RW = 0.302
const KV_PER_TOKEN = 65536e-9
const DRAFT_KV_PER_TOKEN = 20480e-9

type Ctx = 128 | 4096 | 8192 | 16384 | 32768
type Draft = "nvfp4" | "bf16"

const CONTEXTS: { ctx: Ctx; label: string }[] = [
  { ctx: 128, label: "128" },
  { ctx: 4096, label: "4K" },
  { ctx: 8192, label: "8K" },
  { ctx: 16384, label: "16K" },
  { ctx: 32768, label: "32K" },
]

// [full round, draft span] in ms, Lithos's medians.
const ROUNDS: Record<Draft, Partial<Record<Ctx, [number, number]>>> = {
  bf16: {
    128: [47.921, 9.424],
    4096: [49.989, 9.906],
    8192: [51.967, 10.424],
    16384: [55.979, 11.273],
    32768: [62.905, 12.795],
  },
  nvfp4: {
    128: [42.611, 4.186],
    32768: [57.472, 7.467],
  },
}

const DRAFT_W: Record<Draft, number> = { nvfp4: 1.939, bf16: 5.218 }

const PRESETS = [
  { label: "their 4 prompts", value: 3.39 },
  { label: "LiveCodeBench", value: 3.35 },
  { label: "HumanEval", value: 3.85 },
  { label: "projection", value: 6 },
  { label: "all 7 accepted", value: 8 },
]

const ACCENT = "oklch(0.56 0.15 200)"
const FLOOR = "oklch(0.55 0.02 260)"
const WARN = "oklch(0.6 0.18 40)"

const W = 760
const H = 330
const L = 50
const R = 150
const T = 22
const B = 44
const PW = W - L - R
const PH = H - T - B
const Y_MAX = 260

const px = (tau: number) => L + ((tau - 1) / 7) * PW
const py = (v: number) => T + PH - (Math.min(v, Y_MAX) / Y_MAX) * PH

function floorMs(ctx: Ctx, draft: Draft) {
  const target = TARGET_W + GDN_STATE_RW + KV_PER_TOKEN * ctx
  const drafter = DRAFT_W[draft] + DRAFT_KV_PER_TOKEN * ctx
  return ((target + drafter) / BW) * 1000
}

function plainCeiling(ctx: Ctx) {
  return BW / (TARGET_W + GDN_STATE_RW + KV_PER_TOKEN * ctx)
}

export function DecodeBudget() {
  const [ctx, setCtx] = useState<Ctx>(128)
  const [draft, setDraft] = useState<Draft>("nvfp4")
  const [tau, setTau] = useState(3.39)

  const measured = ROUNDS[draft][ctx]
  const floor = floorMs(ctx, draft)
  const plain = plainCeiling(ctx)

  const round = measured ? measured[0] : null
  const draftMs = measured ? measured[1] : null
  const rate = round ? (tau / round) * 1000 : null
  const floorRate = (tau / floor) * 1000
  const tauFor200 = round ? (200 * round) / 1000 : null

  const pickDraft = (d: Draft) => {
    setDraft(d)
    if (!ROUNDS[d][ctx]) setCtx(ctx < 16384 ? 128 : 32768)
  }

  const scaleMax = 66
  const bx = (ms: number) => (ms / scaleMax) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decode budget · Qwen3.8-27B + DSpark · 40-core M5 Max · a model built
        from measured rounds and checkpoint bytes
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pt-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">draft head</span>
          {(["nvfp4", "bf16"] as Draft[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pickDraft(d)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono",
                draft === d ? "border-foreground bg-muted" : "text-muted-foreground",
              )}
            >
              {d === "nvfp4" ? "NVFP4" : "BF16"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">context</span>
          {CONTEXTS.map((c) => {
            const ok = Boolean(ROUNDS[draft][c.ctx])
            return (
              <button
                key={c.ctx}
                type="button"
                disabled={!ok}
                onClick={() => setCtx(c.ctx)}
                title={ok ? undefined : "NVFP4 was measured only at 128 and 32K"}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono",
                  ctx === c.ctx ? "border-foreground bg-muted" : "text-muted-foreground",
                  !ok && "cursor-not-allowed opacity-40",
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-3 pt-3 text-xs">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-muted-foreground">
            tokens committed per round (accepted proposals + 1 bonus)
          </span>
          <span className="font-mono">{tau.toFixed(2)}</span>
        </div>
        <Range
          min={1}
          max={8}
          step={0.01}
          value={tau}
          accent={ACCENT}
          onChange={(e) => setTau(Number(e.target.value))}
          className="w-full"
          aria-label="Tokens committed per speculative round"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTau(p.value)}
              className={cn(
                "rounded border px-2 py-0.5",
                tau === p.value ? "border-foreground bg-muted" : "text-muted-foreground",
              )}
            >
              {p.label} · {p.value}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pt-3 sm:px-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Tokens per second against tokens committed per speculative round. One line uses Lithos's measured round time for the chosen context and draft head; a second, steeper line uses the round time a perfectly bandwidth-bound engine would need for the same bytes. A dashed line marks 200 tokens per second and a dotted line marks the plain-decode ceiling with no draft."
        >
          {[0, 50, 100, 150, 200, 250].map((v) => (
            <g key={v}>
              <line
                x1={L}
                y1={py(v)}
                x2={L + PW}
                y2={py(v)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={L - 8}
                y={py(v) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {v}
              </text>
            </g>
          ))}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((a) => (
            <text
              key={a}
              x={px(a)}
              y={py(0) + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {a}
            </text>
          ))}
          <text
            x={L + PW / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            tokens committed per round
          </text>
          <text
            x={12}
            y={T + PH / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${T + PH / 2})`}
            className="fill-muted-foreground"
            fontSize={11}
          >
            tokens / s
          </text>

          {/* 200 tok/s line */}
          <line x1={L} y1={py(200)} x2={L + PW} y2={py(200)} stroke={WARN} strokeWidth={1.4} strokeDasharray="6 4" />
          <text x={L + PW + 6} y={py(200) + 4} fontSize={11} fill={WARN}>
            200 tok/s
          </text>

          {/* plain decode ceiling */}
          <line x1={L} y1={py(plain)} x2={L + PW} y2={py(plain)} stroke={FLOOR} strokeWidth={1.2} strokeDasharray="1 3" />
          <text x={L + PW + 6} y={py(plain) + 4} fontSize={11} className="fill-muted-foreground">
            no draft, {plain.toFixed(1)}
          </text>

          {/* bandwidth floor line */}
          <line
            x1={px(1)}
            y1={py((1 / floor) * 1000)}
            x2={px(8)}
            y2={py((8 / floor) * 1000)}
            stroke={FLOOR}
            strokeWidth={1.6}
          />
          <text x={px(8) + 6} y={py((8 / floor) * 1000) + 4} fontSize={11} className="fill-muted-foreground">
            bandwidth floor
          </text>

          {/* measured line */}
          {round && (
            <>
              <line
                x1={px(1)}
                y1={py((1 / round) * 1000)}
                x2={px(8)}
                y2={py((8 / round) * 1000)}
                stroke={ACCENT}
                strokeWidth={2.6}
              />
              <text x={px(8) + 6} y={py((8 / round) * 1000) + 4} fontSize={11} fill={ACCENT}>
                measured round
              </text>
              <circle cx={px(tau)} cy={py(rate ?? 0)} r={5.5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
              <circle cx={px(tau)} cy={py(floorRate)} r={4} fill={FLOOR} stroke="var(--background)" strokeWidth={1.5} />
            </>
          )}
        </svg>
      </div>

      <div className="px-3 pb-1 text-xs">
        <div className="mb-1 text-muted-foreground">one round, ms (bar) against the bytes it must move (tick)</div>
        {round && draftMs && (
          <div className="relative h-5 w-full rounded bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-l"
              style={{ width: `${bx(round - draftMs)}%`, background: ACCENT, opacity: 0.85 }}
              title="target verification + accept/commit"
            />
            <div
              className="absolute inset-y-0"
              style={{ left: `${bx(round - draftMs)}%`, width: `${bx(draftMs)}%`, background: ACCENT, opacity: 0.4 }}
              title="draft block"
            />
            <div
              className="absolute -inset-y-1 w-0.5"
              style={{ left: `${bx(floor)}%`, background: "var(--foreground)" }}
            />
          </div>
        )}
        <div className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-[11px] text-muted-foreground">
          <span>verify + commit {round && draftMs ? (round - draftMs).toFixed(1) : "–"}</span>
          <span>draft {draftMs ? draftMs.toFixed(1) : "–"}</span>
          <span>floor {floor.toFixed(1)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t px-3 py-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">measured round</dt>
          <dd className="font-mono text-sm">{round ? `${round.toFixed(2)} ms` : "not measured"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">at this τ</dt>
          <dd className="font-mono text-sm" style={{ color: ACCENT }}>
            {rate ? `${rate.toFixed(0)} tok/s` : "–"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">floor share of round</dt>
          <dd className="font-mono text-sm">{round ? `${((floor / round) * 100).toFixed(0)}%` : "–"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">τ needed for 200</dt>
          <dd className="font-mono text-sm" style={{ color: tauFor200 && tauFor200 > 8 ? WARN : undefined }}>
            {tauFor200 ? (tauFor200 > 8 ? `${tauFor200.toFixed(2)}, past the max of 8` : tauFor200.toFixed(2)) : "–"}
          </dd>
        </div>
      </dl>

      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        Round times are Lithos&apos;s medians (refined recipes, all seven proposals
        accepted on their timing fixture). The floor is my arithmetic: checkpoint
        bytes for target and draft, GDN state, BF16 KV, at 614.4 GB/s, and it
        ignores activations and pack padding. Presets: Lithos&apos;s own four-prompt
        run, RadixArk&apos;s acceptance lengths for this drafter (measured on GPUs at
        temperature 1.0), the README&apos;s six-token assumption, and a round where
        everything is accepted.
      </figcaption>
    </figure>
  )
}
