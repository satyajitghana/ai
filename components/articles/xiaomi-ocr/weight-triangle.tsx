"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { matan2 } from "@/lib/dmath"

import { WEIGHTS } from "./data"

const GROUP: Record<string, string> = { language: "language", vision: "vision", mtp: "MTP head" }

// Three checkpoints, one tensor at a time. Distances are relative L2 between the same tensor in two checkpoints.
export function WeightTriangle() {
  const [i, setI] = useState(0)
  const w = WEIGHTS[i]
  const a = w.post
  const c = w.xiaomi
  const d = w.xiaomiPost
  const frozen = a === 0

  const cos = frozen ? 0 : (a * a + c * c - d * d) / (2 * a * c)
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos))
  const angle = frozen ? 0 : (matan2(sin, cos) * 180) / Math.PI
  const ifFromPost = frozen ? 0 : a / c
  const predicted = Math.sqrt(a * a + c * c)

  const bx = 46
  const by = 226
  const s = 190 / c
  const px = bx + a * s
  const xx = bx + c * cos * s
  const xy = by - c * sin * s
  const gx = bx + c * ifFromPost * s
  const gy = by - c * Math.sqrt(1 - ifFromPost * ifFromPost) * s

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        which checkpoint did Xiaomi start from? · measured on 13 sampled tensors, bf16, over HTTP range requests
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {WEIGHTS.map((r, k) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setI(k)}
            aria-pressed={k === i}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              k === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,22rem)_1fr]">
        <svg viewBox="0 0 340 250" role="img" aria-label={`Distance triangle for ${w.label}`} className="w-full">
          <line x1={bx} y1={by} x2={px} y2={by} stroke="oklch(0.62 0.16 40)" strokeWidth="2.5" />
          <line x1={bx} y1={by} x2={xx} y2={xy} stroke="oklch(0.6 0.15 175)" strokeWidth="2.5" />
          {!frozen && (
            <>
              <line x1={px} y1={by} x2={xx} y2={xy} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
              <line x1={px} y1={by} x2={gx} y2={gy} stroke="oklch(0.62 0.16 40)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
              <line x1={bx} y1={by} x2={gx} y2={gy} stroke="oklch(0.62 0.16 40)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx={gx} cy={gy} r="4" fill="none" stroke="oklch(0.62 0.16 40)" strokeWidth="1.5" />
              <text x={gx + 8} y={gy + 3} fontSize="10" fill="oklch(0.62 0.16 40)">
                if it had started here
              </text>
            </>
          )}
          <circle cx={bx} cy={by} r="4.5" fill="currentColor" />
          <text x={bx - 4} y={by + 16} fontSize="11" fill="currentColor">
            Qwen3.5-0.8B-Base
          </text>
          {!frozen && (
            <>
              <circle cx={px} cy={by} r="4.5" fill="oklch(0.62 0.16 40)" />
              <text x={px + 6} y={by + 16} fontSize="11" fill="currentColor">
                Qwen3.5-0.8B (post-trained)
              </text>
            </>
          )}
          <circle cx={xx} cy={xy} r="5" fill="oklch(0.6 0.15 175)" />
          <text x={Math.min(xx + 10, 214)} y={xy + 4} fontSize="11" fill="currentColor">
            Xiaomi-OCR-0
          </text>
        </svg>
        <div className="space-y-2 font-mono text-[11px]">
          {frozen ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Qwen left this tensor bit-identical between its Base and post-trained checkpoints (distance 0.0000), so there is no post-training step to
              compare against. Xiaomi changed it by <b className="text-foreground">{c.toFixed(4)}</b>: the vision tower was trained here, not
              frozen.
            </p>
          ) : (
            <>
              <Row k="Qwen post-training moved it by" v={a.toFixed(4)} />
              <Row k="Xiaomi moved it from Base by" v={c.toFixed(4)} />
              <Row k="Xiaomi is from the post-trained one by" v={d.toFixed(4)} />
              <Row k="right-angle prediction √(a²+c²)" v={predicted.toFixed(4)} />
              <Row k="angle at Base between the two moves" v={`${angle.toFixed(1)}°`} strong />
              <Row k="cosine, measured" v={cos.toFixed(4)} strong />
              <Row k="cosine if it had started from the post-trained model (a/c)" v={ifFromPost.toFixed(4)} />
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                The two training runs moved this {GROUP[w.group]} tensor in nearly perpendicular directions. If Xiaomi had begun from Qwen&apos;s
                post-trained weights, Qwen&apos;s step would still be inside its change and the cosine would sit near the last row.
              </p>
            </>
          )}
        </div>
      </div>
    </figure>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("tabular-nums", strong && "font-semibold text-foreground")}>{v}</span>
    </div>
  )
}
