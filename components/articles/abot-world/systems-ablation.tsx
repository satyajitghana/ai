"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 2 of the paper: the systems ablation that gets ABot-World-0 from "doesn't
// run" to 720p/16fps on one desktop GPU. The honest part is the order -- Base and
// +SageAttention2 both OOM at batch 1. A faster attention kernel alone is not
// enough; the VAE swap (LightVAE) is what makes the model fit at all, and only
// after that do FP8, Fast-RoPE, and a final low-bit DiT variant (MXFP6 or MXFP4)
// compound into the deployable configuration.

type Step =
  | { key: string; label: string; type: "oom" }
  | { key: string; label: string; type: "ok"; fps: number; vram: number; dit: number; vae: number }

const FPS_MAX = 18
const VRAM_MAX = 22
const FPS_COLOR = "oklch(0.66 0.15 165)"
const VRAM_COLOR = "oklch(0.68 0.14 55)"

const STEPS: Step[] = [
  { key: "base", label: "Base", type: "oom" },
  { key: "sage", label: "+Sage2", type: "oom" },
  { key: "lightvae", label: "+LightVAE", type: "ok", fps: 9.117, vram: 20.491, dit: 1191.081, vae: 78.276 },
  { key: "fp8", label: "+FP8", type: "ok", fps: 12.405, vram: 15.925, dit: 845.18, vae: 75.98 },
  { key: "rope", label: "+FastRoPE", type: "ok", fps: 13.269, vram: 19.281, dit: 786.871, vae: 71.73 },
]

const VARIANTS: Record<"mxfp6" | "mxfp4", Step> = {
  mxfp6: { key: "mxfp6", label: "+MXFP6", type: "ok", fps: 14.098, vram: 18.287, dit: 718.281, vae: 85.994 },
  mxfp4: { key: "mxfp4", label: "+MXFP4", type: "ok", fps: 15.831, vram: 17.148, dit: 638.843, vae: 72.957 },
}

const W = 720
const H = 236
const CL = 20
const CR = W - 20
const CT = 40
const CB = 176

export function SystemsAblation() {
  const [step, setStep] = useState(4)
  const [variant, setVariant] = useState<"mxfp6" | "mxfp4">("mxfp4")

  const full: Step[] = [...STEPS, VARIANTS[variant]]
  const n = full.length
  const groupW = (CR - CL) / n
  const barW = (groupW - 16) / 2
  const scale = (v: number, max: number) => (v / max) * (CB - CT)

  const cur = full[step]
  const firstFeasible = full[2] // LightVAE, always feasible
  const speedup =
    cur.type === "ok" && firstFeasible.type === "ok" ? Math.round((cur.fps / firstFeasible.fps) * 100) / 100 : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>systems ablation · 1280x704, batch 1, single gpu</span>
        <span className="flex items-center gap-3 text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: FPS_COLOR }} />
            fps
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: VRAM_COLOR }} />
            vram (gib)
          </span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Systems ablation: Base and plus SageAttention2 both run out of memory; feasibility begins at plus LightVAE, and FPS rises while VRAM falls (with one increase) through FP8, Fast-RoPE, and a final low-bit variant."
        >
          {full.map((c, i) => {
            const gx = CL + i * groupW
            const isSel = i === step
            return (
              <g key={c.key} onClick={() => setStep(i)} className="cursor-pointer">
                <rect
                  x={gx + 2}
                  y={CT - 8}
                  width={groupW - 4}
                  height={CB - CT + 8}
                  rx={6}
                  fill={isSel ? "var(--muted)" : "transparent"}
                  opacity={isSel ? 0.5 : 0}
                />
                {c.type === "oom" ? (
                  <>
                    <rect
                      x={gx + groupW / 2 - barW - 4}
                      y={CB - 30}
                      width={barW * 2 + 8}
                      height={30}
                      rx={5}
                      fill="none"
                      stroke="oklch(0.62 0.19 25)"
                      strokeDasharray="3 3"
                      strokeWidth={1.4}
                    />
                    <text
                      x={gx + groupW / 2}
                      y={CB - 11}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize={10}
                      fontWeight={700}
                      fill="oklch(0.62 0.19 25)"
                    >
                      OOM
                    </text>
                  </>
                ) : (
                  <>
                    {(() => {
                      const fh = scale(c.fps, FPS_MAX)
                      const x = gx + groupW / 2 - barW - 3
                      return (
                        <g>
                          <rect x={x} y={CB - fh} width={barW} height={fh} rx={3} fill={FPS_COLOR} opacity={isSel ? 1 : 0.75} className="transition-all duration-300" />
                          <text x={x + barW / 2} y={CB - fh - 5} textAnchor="middle" className="font-mono fill-foreground" fontSize={9.5}>
                            {c.fps}
                          </text>
                        </g>
                      )
                    })()}
                    {(() => {
                      const vh = scale(c.vram, VRAM_MAX)
                      const x = gx + groupW / 2 + 3
                      return (
                        <g>
                          <rect x={x} y={CB - vh} width={barW} height={vh} rx={3} fill={VRAM_COLOR} opacity={isSel ? 1 : 0.75} className="transition-all duration-300" />
                          <text x={x + barW / 2} y={CB - vh - 5} textAnchor="middle" className="font-mono fill-foreground" fontSize={9.5}>
                            {c.vram}
                          </text>
                        </g>
                      )
                    })()}
                  </>
                )}
                <line x1={gx} y1={CB} x2={gx + groupW} y2={CB} stroke="var(--border)" strokeWidth={1} />
                <text
                  x={gx + groupW / 2}
                  y={CB + 16}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9.5}
                  fontWeight={isSel ? 700 : 500}
                  fill={isSel ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {c.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {full.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setStep(i)}
              aria-pressed={step === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                step === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            final variant
            {(["mxfp6", "mxfp4"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                aria-pressed={variant === v}
                className={cn(
                  "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                  variant === v ? "bg-muted text-foreground" : "hover:text-foreground"
                )}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 p-3 font-mono text-xs">
          {cur.type === "oom" ? (
            <span className="text-foreground">
              {cur.label}: out of memory at batch 1 -- doesn&apos;t run, regardless of how fast the attention kernel
              is.
            </span>
          ) : (
            <span className="text-foreground">
              {cur.label}: {cur.fps} fps · {cur.vram} GiB peak VRAM · DiT {cur.dit} ms/chunk · VAE {cur.vae} ms/chunk
              {speedup ? <span className="text-muted-foreground"> · {speedup}x the FPS of the first feasible config</span> : null}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both <span className="text-foreground">Base</span>{" "}and{" "}
          <span className="text-foreground">+SageAttention2</span>{" "}run out of memory before they produce a single
          frame -- a faster attention kernel changes nothing if the model doesn&apos;t fit. Feasibility starts only once
          the VAE decoder is replaced (LightVAE), and FPS keeps climbing through FP8 and Fast-RoPE while VRAM mostly
          falls (Fast-RoPE actually costs 3.4 GiB more than FP8 alone -- not every step is a pure win). The final
          low-bit variant is a choice, not a further stack: MXFP4 reaches 15.831 fps at 17.148 GiB; MXFP6 trades some
          of both for a smaller VAE-time increase. The paper&apos;s real-time claim is a systems result built from five
          separate, individually-necessary changes, not one clever kernel.
        </p>
      </div>
    </figure>
  )
}
