"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The TurboQuant pipeline, one stage at a time — what each step does and why. The
// clever part is the last two: an MSE-optimal quantizer is biased when you use it to
// estimate inner products (which is all attention does), so TurboQuant quantizes the
// residual with a 1-bit Quantized-JL transform to cancel the bias. Auto-advances.

const STAGES = [
  {
    key: "rotate",
    name: "1 · rotate",
    what: "Multiply the key/value vector by a random orthogonal matrix (a Hadamard/QR rotation).",
    why: "It spreads energy evenly across coordinates, so each coordinate follows the same known Beta distribution — no outliers, no per-vector surprises.",
  },
  {
    key: "quantize",
    name: "2 · scalar-quantize",
    what: "Apply a per-coordinate optimal (Lloyd-Max) scalar quantizer at b−1 bits.",
    why: "Because the post-rotation distribution is known analytically, the optimal quantizer is precomputed once — data-free, no calibration set. This is the “online” property.",
  },
  {
    key: "residual",
    name: "3 · 1-bit QJL on the residual",
    what: "Take what the MSE quantizer missed (the residual) and store just its sign under a random projection — 1 bit per dimension.",
    why: "An MSE-optimal quantizer is *biased* for inner products. The 1-bit Quantized-JL residual is exactly the correction that cancels that bias.",
  },
  {
    key: "estimate",
    name: "4 · unbiased inner product",
    what: "Reconstruct scores as the MSE estimate plus the QJL correction term.",
    why: "Attention is inner products through a softmax — a biased score systematically warps the attention weights. Unbiasedness keeps the attention distribution faithful, which is why quality holds at 3.5 bits/channel.",
  },
] as const

export function Pipeline() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2800)
    return () => clearInterval(id)
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>TurboQuant · rotate → quantize → correct</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((st, k) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setI(k)}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all", k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40")}
                style={k === i ? { background: "oklch(0.72 0.15 195)" } : undefined}
              >
                {st.name}
              </button>
              {k < STAGES.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
            </span>
          ))}
        </div>

        <div className="mt-4 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 border-foreground/30 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <div className="font-mono text-xs text-foreground">{st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span> <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span> <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
