"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// EARR as the released code actually implements it.
//
// Every constant here is read out of recurrent_reasoning/recurrent_reasoning.py
// in github.com/Taichu-AI/ZDTaichu5.0-9B: the default layer block "12,13,14,15",
// MAX_ITERS=1, THRESHOLD=1.0 nats, KL_THRESHOLD=1e-4, and the one line that
// defines the "damped update":
//
//     max_candidate_n = RECURRENT_REASONING_MAX_ITERS + 1
//     damping_weight  = 1.0 / max_candidate_n
//     reasoning_hidden_states = ((1.0 - damping_weight) * base_input_hidden_states
//                                + damping_weight * base_output_hidden_states)
//
// So the damping strength is not a free knob — it is 1/(MAX_ITERS+1), which at
// the documented default is a plain 50/50 average of the block's input and
// output. Raise MAX_ITERS to allow more iterations and each iteration's step
// gets proportionally smaller.
//
// Arithmetic is division and multiplication only (exact per IEEE-754), so no
// lib/dmath wrapper is needed; ENTROPY_UNIFORM is precomputed offline, not
// evaluated in the browser.

const LAYERS_TOTAL = 32
const BLOCK = [12, 13, 14, 15]
const THRESHOLD = 1.0
const ENTROPY_UNIFORM = 12.4224 // ln(248320), the Qwen3.5 vocabulary, precomputed

type Step = { n: number; label: string; note: string; state: "run" | "maybe" | "off" }

export function EntropyGate() {
  const [h, setH] = useState(1.6)
  const [maxIters, setMaxIters] = useState(1)

  const fires = h > THRESHOLD
  const maxCandidateN = maxIters + 1
  const w = 1 / maxCandidateN
  const extraLayerPasses = maxIters * BLOCK.length
  const depthShare = (extraLayerPasses * 100) / LAYERS_TOTAL

  const steps: Step[] = [
    {
      n: 1,
      label: "N=1",
      note: "the ordinary forward pass — always runs",
      state: "run",
    },
    ...Array.from({ length: maxIters }, (_, i) => ({
      n: i + 2,
      label: `N=${i + 2}`,
      note:
        i === 0
          ? "re-runs layers 12-15 on the damped blend; kept only if entropy drops"
          : "kept only if entropy drops again and KL ≥ 1e-4",
      state: (fires ? "maybe" : "off") as Step["state"],
    })),
  ]

  return (
    <figure
      className="my-8 rounded-md border"
      data-entropy-gate={fires ? "fires" : "skipped"}
      aria-label="Entropy gate and damping weight as implemented in the released EARR code"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            H(logits) at the last position — nats
          </span>
          <input
            type="range"
            min={0}
            max={4}
            step={0.05}
            value={h}
            onChange={(e) => setH(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="output entropy in nats"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            H = {h.toFixed(2)}{" "}
            <span className="text-muted-foreground">
              (threshold {THRESHOLD.toFixed(1)}; uniform over the 248,320-token
              vocabulary would be {ENTROPY_UNIFORM.toFixed(2)})
            </span>
          </span>
        </label>

        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            RECURRENT_REASONING_MAX_ITERS
          </span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={maxIters}
            onChange={(e) => setMaxIters(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="maximum extra iterations"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            MAX_ITERS = {maxIters}{" "}
            <span className="text-muted-foreground">
              (shipped default 1{maxIters === 0 ? "; 0 disables EARR entirely" : ""})
            </span>
          </span>
        </label>
      </div>

      <div className="px-4 py-4">
        <p
          className={cn(
            "my-0 font-mono text-sm",
            fires ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {fires
            ? `H > ${THRESHOLD.toFixed(1)} → gate fires on this token`
            : `H ≤ ${THRESHOLD.toFixed(1)} → gate does not fire; the ordinary logits are emitted`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {steps.map((s) => (
            <div
              key={s.n}
              className={cn(
                "min-w-[9rem] flex-1 rounded-sm border px-3 py-2",
                s.state === "run" && "border-foreground/60",
                s.state === "maybe" && "border-dashed",
                s.state === "off" && "border-dashed opacity-40"
              )}
            >
              <span className="block font-mono text-sm font-semibold">{s.label}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {s.note}
              </span>
            </div>
          ))}
          {maxIters === 0 ? (
            <div className="text-muted-foreground min-w-[9rem] flex-1 rounded-sm border border-dashed px-3 py-2 text-xs">
              no candidates — the mixin returns the ordinary forward pass
            </div>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground font-mono text-xs">
              damping weight w = 1/(MAX_ITERS+1)
            </dt>
            <dd className="mt-0.5 ml-0 font-mono text-lg tabular-nums">
              {w.toFixed(4)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-mono text-xs">
              extra decoder-layer applications
            </dt>
            <dd className="mt-0.5 ml-0 font-mono text-lg tabular-nums">
              {extraLayerPasses}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-mono text-xs">
              as a share of the 32-layer stack
            </dt>
            <dd className="mt-0.5 ml-0 font-mono text-lg tabular-nums">
              {depthShare.toFixed(1)}%
            </dd>
          </div>
        </dl>

        <pre className="mt-4 overflow-x-auto rounded-sm border px-3 py-2 font-mono text-xs leading-relaxed">
          <code>
            {`h' = ${(1 - w).toFixed(4)} * h_in(layer ${BLOCK[0]}) + ${w.toFixed(4)} * h_out(layer ${BLOCK[BLOCK.length - 1]})`}
          </code>
        </pre>
      </div>

      <figcaption className="text-muted-foreground border-t px-4 py-3 font-mono text-xs">
        Constants read from recurrent_reasoning.py in the GitHub repo. The gate reads
        raw entropy in nats at one position, batch size 1, and the block is the
        four layers named by RECURRENT_REASONING_LAYER_INDICES.
      </figcaption>
    </figure>
  )
}
