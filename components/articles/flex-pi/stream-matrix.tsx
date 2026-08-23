"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One checkpoint, fifty-six deployable configurations.
//
// Flex-pi carries three visual streams — RGB appearance, 3D pointmap geometry,
// and DINO object semantics — through one shared backbone, and what it *reads*
// and what it *generates* are independent runtime flags rather than architecture.
// Seven non-empty input subsets times eight output subsets (the empty one being
// action-only) is 56, and the README's `infer_present_*` / `infer_joint_*` flags
// are literally that product.
//
// The two corners of the grid are the interesting ones. Generate nothing and you
// get a VLA: no future visual stream is read, so none is computed, and the model
// runs at 60 ms per call. Generate all three and you get a world-action model at
// 193 ms. Same weights.
//
// The latency table is the README's, measured on an RTX 5090 at four denoise
// steps. TensorRT is optional and only applies to the joint path.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const STREAMS = [
  { key: "v", label: "RGB", sub: "appearance · frozen Wan-2.2 VAE", color: "oklch(0.62 0.03 250)" },
  { key: "p", label: "Pointmap", sub: "3D geometry · the same frozen VAE", color: ACCENT },
  { key: "d", label: "DINO", sub: "object semantics · frozen DINOv3", color: GOOD },
] as const

type K = (typeof STREAMS)[number]["key"]

const LATENCY = [
  { stack: "eager PyTorch", joint: 447, action: 132 },
  { stack: "torch.compile — the default", joint: 360, action: 60 },
  { stack: "+ TensorRT joint engine", joint: 230, action: null },
  { stack: "+ TensorRT KV-split engines", joint: 193, action: null },
]

export function StreamMatrix() {
  const [obs, setObs] = useState<K[]>(["v", "p", "d"])
  const [gen, setGen] = useState<K[]>([])

  const flip = (set: K[], setter: (v: K[]) => void, k: K, minOne: boolean) => {
    const has = set.includes(k)
    if (has && minOne && set.length === 1) return
    setter(has ? set.filter((x) => x !== k) : [...set, k])
  }

  const actionOnly = gen.length === 0
  const fullJoint = gen.length === 3 && obs.length === 3
  const latency = actionOnly ? 60 : fullJoint ? 193 : null

  // 7 non-empty observed subsets x 8 generated subsets
  const index =
    (obs.reduce((a, k) => a + (k === "v" ? 1 : k === "p" ? 2 : 4), 0) - 1) * 8 +
    gen.reduce((a, k) => a + (k === "v" ? 1 : k === "p" ? 2 : 4), 0) +
    1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          configuration {index} of 56 · one 6B checkpoint, no retraining
        </span>
        <span className="font-mono text-[10px]" style={{ color: latency ? GOOD : WARM }}>
          {actionOnly ? "action-only · 60 ms" : fullJoint ? "full joint · 193 ms" : "an intermediate point"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["observed — what it encodes as input", obs, setObs, true],
              ["generated — what futures it predicts", gen, setGen, false],
            ] as const
          ).map(([title, set, setter, minOne]) => (
            <div key={title}>
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{title}</div>
              <div className="mt-1.5 space-y-1">
                {STREAMS.map((s) => {
                  const on = (set as K[]).includes(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => flip(set as K[], setter as (v: K[]) => void, s.key, minOne as boolean)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                        on ? "border-foreground/30 bg-muted/40" : "border-border hover:bg-muted/20",
                      )}
                    >
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: on ? s.color : "transparent", border: on ? "none" : "1px solid currentColor", opacity: on ? 1 : 0.3 }}
                      />
                      <span className="font-mono text-[11px] text-foreground">{s.label}</span>
                      <span className="truncate font-mono text-[9px] text-muted-foreground">{s.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {actionOnly ? (
            <>
              <span className="font-mono text-[11px]" style={{ color: GOOD }}>
                the fast path.
              </span>{" "}
              No future visual stream is read, so none is computed. This is the cheapest point on the frontier and
              it recovers VLA latency — 60 ms per call on an RTX 5090 — while still scoring{" "}
              <span className="text-foreground">76.4%</span>{" "}task completion, 18.4 points above the strongest
              baseline.
            </>
          ) : fullJoint ? (
            <>
              <span className="font-mono text-[11px]" style={{ color: ACCENT }}>
                full joint generation.
              </span>{" "}
              Every action chunk is produced alongside a predicted latent future in all three streams, under shared
              self-attention, so the policy reads its own predicted future without ever decoding it. 193 ms and{" "}
              <span className="text-foreground">83.0%</span>.
            </>
          ) : (
            <>
              An intermediate configuration. The paper reports the two endpoints; everything between them is
              deployable from the same weights and is what the flexibility is <em>for</em>{" "}— you pick the
              operating point at deployment, on the machine you actually have, rather than at training time.
            </>
          )}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            training-free latency · ms per call, RTX 5090, four denoise steps
          </div>
          <div className="mt-2 space-y-1">
            {LATENCY.map((l) => (
              <div key={l.stack} className="flex items-center gap-2">
                <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{l.stack}</span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="h-4 rounded-sm" style={{ width: `${(l.joint / 447) * 100}%`, background: ACCENT, opacity: 0.85 }} />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                  {l.joint}
                </span>
                <div className="h-4 w-24 shrink-0 rounded-sm bg-muted/40">
                  {l.action != null ? (
                    <div className="h-4 rounded-sm" style={{ width: `${(l.action / 132) * 100}%`, background: GOOD, opacity: 0.85 }} />
                  ) : null}
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: GOOD }}>
                  {l.action ?? "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: ACCENT }} />
              full joint
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: GOOD }} />
              action only
            </span>
            <span>TensorRT is optional and applies to the joint path only</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The design decision underneath all of this is that RGB and the 3D pointmap go through{" "}
          <span className="text-foreground">the same frozen video-generation VAE</span>. Not a geometry encoder
          bolted alongside a visual one — the same weights, because a VAE trained only on RGB already encodes
          depth well enough to reconstruct a pointmap at 31.1 dB PSNR and 4.9 cm z-RMSE. DINO semantics come from
          a separate frozen encoder and are projected in by a linear adapter.
          <br />
          <br />
          Which is why the flags can be independent at all. Three streams sharing one latent space means dropping
          one at inference is a masking operation, not a different model — and the 2.3× training-free speedup in
          the table below applies to whichever configuration you picked.
        </p>
      </div>
    </figure>
  )
}
