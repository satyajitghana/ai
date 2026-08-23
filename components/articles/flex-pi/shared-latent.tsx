"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The architecture, and the training trick that makes the runtime flags possible.
//
// Three visual streams enter one shared latent space. RGB frames and 3D pointmaps
// go through the SAME frozen Wan-2.2 VAE — not a geometry encoder alongside a
// visual one, the same weights — because a VAE trained only on RGB already
// encodes depth well enough to reconstruct a pointmap at 31.1 dB PSNR and 4.9 cm
// z-RMSE. DINOv3 semantics come from a separate frozen encoder, projected in by a
// linear adapter. Proprioception and the language instruction condition every
// stream.
//
// Actions are generated jointly with latent futures under shared self-attention,
// so the policy reads its own predicted future without ever decoding it.
//
// Per-stream dropout is what makes a stream droppable at inference. Cross-modality
// forcing is what makes the shared space actually shared: the model is trained to
// predict each modality's future EVEN WHEN THAT STREAM IS MISSING from the input,
// which is worth 47% relative on RoboTwin. Requiring each modality to be
// predictable from the others is what stops the backbone from splitting into three
// weakly-coupled channels.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Mode = "arch" | "dropout" | "forcing"

const MODES: { key: Mode; label: string; note: string }[] = [
  {
    key: "arch",
    label: "the shared space",
    note: "RGB and the 3D pointmap go through the same frozen Wan-2.2 VAE — the same weights, not a parallel geometry encoder — because a video VAE trained only on RGB already encodes depth well enough to reconstruct a pointmap at 31.1 dB PSNR and 4.9 cm z-RMSE. DINO semantics come from a separate frozen encoder and are projected in by a linear adapter. Actions are generated jointly with the latent futures under shared self-attention, so the policy reads its predicted future without decoding it.",
  },
  {
    key: "dropout",
    label: "per-stream dropout",
    note: "During training, streams are dropped at random from both the input and the output side. That is what turns the stream set into a runtime mask rather than an architecture: the model has already been trained on every combination it will be asked to run, which is why all 56 are deployable from one checkpoint with no fine-tuning.",
  },
  {
    key: "forcing",
    label: "cross-modality forcing",
    note: "The model is trained to predict each modality's future even when that stream is missing from the input — worth 47% relative on RoboTwin on its own. Robustness to a missing sensor is the by-product, not the goal: requiring each modality to be reconstructible from the others is what keeps the shared backbone from quietly splitting into three weakly-coupled channels, and pushes it toward a representation where appearance, geometry and semantics are mutually predictive.",
  },
]

const STREAMS = [
  { key: "v", l: "RGB", enc: "frozen Wan-2.2 VAE", c: MUTED },
  { key: "p", l: "Pointmap", enc: "the same frozen VAE", c: ACCENT },
  { key: "d", l: "DINO", enc: "frozen DINOv3 + linear adapter", c: GOOD },
]

export function SharedLatent() {
  const [mode, setMode] = useState<Mode>("arch")
  const m = MODES.find((x) => x.key === mode) ?? MODES[0]

  const W = 720
  const H = 200
  const SY = [30, 74, 118]
  const SH = 34
  const BX = 268
  const BW = 170

  // Which streams are shown as dropped, per mode.
  const dropIn = mode === "dropout" ? ["p"] : mode === "forcing" ? ["p"] : []
  const dropOut = mode === "dropout" ? ["p"] : []

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          three streams, one backbone, one latent space — 6B parameters
        </span>
        <span className="font-mono text-[10px]" style={{ color: mode === "forcing" ? GOOD : ACCENT }}>
          {mode === "forcing" ? "+47% relative on RoboTwin" : mode === "dropout" ? "56 combinations, one checkpoint" : "no geometry-specific encoder"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setMode(x.key)}
              aria-pressed={mode === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[680px] max-w-full">
            <title>
              Three visual streams — RGB, pointmap and DINO semantics — encoded into one shared latent space by
              frozen encoders, denoised jointly with the action by a single backbone, and decoded back into three
              predicted futures plus an action chunk.
            </title>

            {STREAMS.map((s, i) => {
              const dropped = dropIn.includes(s.key)
              return (
                <g key={s.key}>
                  <rect
                    x={8}
                    y={SY[i]}
                    width={112}
                    height={SH}
                    rx={5}
                    fill={s.c}
                    fillOpacity={dropped ? 0.05 : 0.14}
                    stroke={s.c}
                    strokeOpacity={dropped ? 0.3 : 0.6}
                    strokeDasharray={dropped ? "4 3" : undefined}
                  />
                  <text x={64} y={SY[i] + 15} fontSize={10} fill="currentColor" fillOpacity={dropped ? 0.4 : 1} textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {s.l}
                  </text>
                  <foreignObject x={12} y={SY[i] + 17} width={104} height={16}>
                    <div style={{ fontSize: "7px", lineHeight: "9px", textAlign: "center", fontFamily: "ui-monospace, monospace", opacity: dropped ? 0.3 : 0.55 }}>
                      {s.enc}
                    </div>
                  </foreignObject>
                  {dropped ? (
                    <text x={64} y={SY[i] - 4} fontSize={8} fill={WARM} textAnchor="middle" fontFamily="ui-monospace, monospace">
                      dropped
                    </text>
                  ) : null}
                  <line
                    x1={120}
                    y1={SY[i] + SH / 2}
                    x2={BX}
                    y2={SY[i] + SH / 2}
                    stroke={s.c}
                    strokeOpacity={dropped ? 0.15 : 0.6}
                    strokeWidth={1.5}
                    strokeDasharray={dropped ? "3 3" : undefined}
                  />
                </g>
              )
            })}

            {/* conditioning */}
            <text x={64} y={172} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              proprioception + language
            </text>
            <line x1={120} y1={168} x2={BX} y2={150} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 2" />
            <text x={BX + BW / 2} y={186} fontSize={8.5} fill="currentColor" fillOpacity={0.45} textAnchor="middle" fontFamily="ui-monospace, monospace">
              conditions every stream
            </text>

            {/* the shared backbone */}
            <rect x={BX} y={22} width={BW} height={132} rx={9} fill={ACCENT} fillOpacity={0.16} stroke={ACCENT} strokeOpacity={0.9} strokeWidth={1.75} />
            <text x={BX + BW / 2} y={72} fontSize={11} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              one shared
            </text>
            <text x={BX + BW / 2} y={87} fontSize={11} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              latent space
            </text>
            <text x={BX + BW / 2} y={104} fontSize={8.5} fill="currentColor" fillOpacity={0.55} textAnchor="middle" fontFamily="ui-monospace, monospace">
              joint flow matching
            </text>
            <text x={BX + BW / 2} y={116} fontSize={8.5} fill="currentColor" fillOpacity={0.55} textAnchor="middle" fontFamily="ui-monospace, monospace">
              shared self-attention
            </text>

            {/* outputs */}
            {STREAMS.map((s, i) => {
              const dropped = dropOut.includes(s.key)
              return (
                <g key={`out-${s.key}`}>
                  <line
                    x1={BX + BW}
                    y1={SY[i] + SH / 2}
                    x2={W - 132}
                    y2={SY[i] + SH / 2}
                    stroke={s.c}
                    strokeOpacity={dropped ? 0.15 : 0.6}
                    strokeWidth={1.5}
                    strokeDasharray={dropped ? "3 3" : undefined}
                  />
                  <rect
                    x={W - 132}
                    y={SY[i]}
                    width={124}
                    height={SH}
                    rx={5}
                    fill={s.c}
                    fillOpacity={dropped ? 0.05 : 0.14}
                    stroke={s.c}
                    strokeOpacity={dropped ? 0.3 : 0.6}
                    strokeDasharray={dropped ? "4 3" : undefined}
                  />
                  <text x={W - 70} y={SY[i] + 15} fontSize={10} fill="currentColor" fillOpacity={dropped ? 0.4 : 1} textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {s.l} future
                  </text>
                  <text x={W - 70} y={SY[i] + 27} fontSize={7.5} fill="currentColor" fillOpacity={dropped ? 0.3 : 0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
                    latent — never decoded
                  </text>
                </g>
              )
            })}

            {/* the action chunk */}
            <line x1={BX + BW} y1={162} x2={W - 132} y2={162} stroke={WARM} strokeOpacity={0.85} strokeWidth={2} />
            <rect x={W - 132} y={148} width={124} height={28} rx={5} fill={WARM} fillOpacity={0.2} stroke={WARM} strokeOpacity={0.9} />
            <text x={W - 70} y={166} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              action chunk
            </text>

            {mode === "forcing" ? (
              <>
                <path
                  d={`M${W - 132},${SY[1] + SH / 2 + 12} L${BX + BW + 14},${SY[1] + SH / 2 + 12}`}
                  stroke={GOOD}
                  strokeWidth={0}
                />
                <text x={BX + BW / 2} y={44} fontSize={8.5} fill={GOOD} textAnchor="middle" fontFamily="ui-monospace, monospace">
                  predict the missing stream anyway
                </text>
              </>
            ) : null}

            <text x={8} y={16} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              observed
            </text>
            <text x={W - 8} y={16} fontSize={9} fill="currentColor" fillOpacity={0.45} textAnchor="end" fontFamily="ui-monospace, monospace">
              generated
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: mode === "forcing" ? GOOD : ACCENT }}>
            {m.label}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{m.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things in this picture are doing the work that everything else depends on. The first is that RGB and
          the pointmap share an encoder —{" "}
          <span className="text-foreground">the same frozen video VAE, not a parallel geometry model</span>{" "}—
          which is only viable because a VAE trained on RGB turns out to already encode enough depth to
          reconstruct a pointmap.
          <br />
          <br />
          The second is that the futures are <em>latents</em>, never decoded. Actions are generated jointly with
          them under shared self-attention, so the policy reads its own predicted future without paying to render
          it. That is what makes joint generation 193 ms rather than a video-model latency, and it is why dropping
          a stream at inference removes real compute instead of just masking an output.
        </p>
      </div>
    </figure>
  )
}
