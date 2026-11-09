"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where the next agent turn can resume, and what it pays to get back to where
// the last one ended.
//
// A hybrid model resumes a prefix only from a recurrent checkpoint taken at an
// exact position. Stock vLLM takes those only at KV-cache block boundaries inside
// the prompt, never during decode and never at the end of a request (paper,
// Section 2.1), so the next turn falls back to the last boundary of the previous
// prompt and recomputes the tail of that prompt plus the whole previous output.
// ASC takes the checkpoint at the exact end of the request instead.
//
// Block sizes are vLLM's per model (paper, Table 2); 256 is SGLang's grid. The
// seconds come from the paper's fitted prefill cost model for GLM-5.3-Flash on
// two B200s (Appendix C): C(a,b) = d(b-a) + e(b^2-a^2)/2e5, d = 1.862e-5 s,
// e = 0.333e-5 s. It is the paper's model, not a measurement of mine.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.60 0.19 25)"
const GOOD = "oklch(0.55 0.16 155)"

const D = 1.862e-5
const E = 0.333e-5
const cost = (a: number, b: number) => (b <= a ? 0 : D * (b - a) + (E * (b * b - a * a)) / 2e5)

const BLOCKS = [
  { b: 256, l: "256 · SGLang grid" },
  { b: 3136, l: "3,136 · Qwen3.8-Flash-Next" },
  { b: 4352, l: "4,352 · GLM-5.3-Flash" },
  { b: 8320, l: "8,320 · Nemotron 3 Super" },
]

const k = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : v.toLocaleString())

export function ResumeGap() {
  const [logN, setLogN] = useState(17.1) // ~140K, the trace median prompt is 142K
  const [out, setOut] = useState(444) // trace median output
  const [offset, setOffset] = useState(0.62) // where the prompt ends inside its last block
  const [block, setBlock] = useState(4352)

  // prompt length: pick a block count from the slider, then place the end inside the last block
  const approx = Math.round(mpow(2, logN))
  const full = Math.max(1, Math.floor(approx / block))
  const n = full * block + Math.round(offset * (block - 1))
  const ideal = n + out
  const vllm = Math.floor(n / block) * block
  const gap = ideal - vllm
  const secV = cost(vllm, ideal)
  const meanGap = block / 2 + out

  // drawing: zoom on the last two blocks of the prompt and the output
  const W = 700
  const H = 168
  const X0 = 40
  const X1 = W - 30
  const lo = Math.max(0, vllm - block)
  const hi = ideal + Math.max(block * 0.15, 200)
  const x = (p: number) => X0 + ((p - lo) / (hi - lo)) * (X1 - X0)

  const bounds: number[] = []
  for (let p = lo; p <= hi; p += block) bounds.push(p)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          previous turn: {k(n)} prompt + {out.toLocaleString()} output
        </span>
        <span className="font-mono text-[10px]" style={{ color: gap > 2000 ? BAD : WARM }}>
          block-aligned resume recomputes {gap.toLocaleString()} tokens · {secV.toFixed(2)} s of prefill
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BLOCKS.map((o) => (
            <button
              key={o.b}
              type="button"
              onClick={() => setBlock(o.b)}
              aria-pressed={block === o.b}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                block === o.b
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`The end of the previous agent turn, zoomed to its last blocks. The prompt ends at token ${n.toLocaleString()} and the output at ${ideal.toLocaleString()}. Block-aligned checkpointing resumes the next turn at ${vllm.toLocaleString()} and recomputes ${gap.toLocaleString()} tokens; exact-end checkpointing resumes at ${ideal.toLocaleString()} and recomputes none.`}
            </title>

            {/* the context bar */}
            <rect x={x(lo)} y={44} width={x(n) - x(lo)} height={22} fill={ACCENT} fillOpacity={0.28} />
            <rect x={x(n)} y={44} width={x(ideal) - x(n)} height={22} fill={WARM} fillOpacity={0.75} />
            <rect x={x(ideal)} y={44} width={X1 - x(ideal)} height={22} fill="currentColor" fillOpacity={0.06} />
            <text x={x(lo) + 4} y={36} fontSize={8} fill={ACCENT} fontFamily="ui-monospace, monospace">
              prompt (cached KV)
            </text>
            <text x={Math.min(x(n) + 3, X1 - 60)} y={36} fontSize={8} fill={WARM} fontFamily="ui-monospace, monospace">
              output
            </text>
            <text x={X1 - 2} y={36} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              next turn&apos;s new tokens →
            </text>

            {bounds.map((p) => (
              <g key={p}>
                <line x1={x(p)} y1={40} x2={x(p)} y2={70} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 2" />
              </g>
            ))}

            {/* vLLM row */}
            <text x={X0 - 6} y={95} fontSize={8.5} textAnchor="end" fill={BAD} fontFamily="ui-monospace, monospace">
              vLLM
            </text>
            <circle cx={x(vllm)} cy={55} r={4} fill={BAD} />
            <rect x={x(vllm)} y={86} width={Math.max(1, x(ideal) - x(vllm))} height={12} fill={BAD} fillOpacity={0.75} rx={2} />
            <text x={x(vllm)} y={112} fontSize={8} fill={BAD} fontFamily="ui-monospace, monospace">
              resumes at {k(vllm)} (last block boundary of the prompt) · recomputes {gap.toLocaleString()}
            </text>

            {/* ASC row */}
            <text x={X0 - 6} y={140} fontSize={8.5} textAnchor="end" fill={GOOD} fontFamily="ui-monospace, monospace">
              ASC
            </text>
            <circle cx={x(ideal)} cy={55} r={4} fill={GOOD} />
            <line x1={x(ideal)} y1={70} x2={x(ideal)} y2={132} stroke={GOOD} strokeWidth={1.5} />
            <text x={Math.min(x(ideal) + 5, X1 - 230)} y={140} fontSize={8} fill={GOOD} fontFamily="ui-monospace, monospace">
              resumes at {k(ideal)} (exact end) · recomputes 0
            </text>
            <text x={X0} y={H - 4} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              dashed lines: KV-cache block boundaries every {block.toLocaleString()} tokens · averaged over where a prompt ends, the gap is block/2 + output = {Math.round(meanGap).toLocaleString()}
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-1.5">
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">prompt length</span>
            <Range min={13} max={19.9} step={0.05} value={logN} onChange={(e) => setLogN(Number(e.target.value))} accent={ACCENT} aria-label="Previous prompt length" />
            <span className="w-14 shrink-0 text-right font-mono text-[10px]">{k(n)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">end inside block</span>
            <Range min={0} max={1} step={0.01} value={offset} onChange={(e) => setOffset(Number(e.target.value))} accent={ACCENT} aria-label="Where the prompt ends inside its last block" />
            <span className="w-14 shrink-0 text-right font-mono text-[10px]">{Math.round(offset * 100)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">output tokens</span>
            <Range min={0} max={32768} step={64} value={out} onChange={(e) => setOut(Number(e.target.value))} accent={WARM} aria-label="Previous output length" />
            <span className="w-14 shrink-0 text-right font-mono text-[10px]">{out.toLocaleString()}</span>
          </label>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Defaults are the medians of the 98,827 requests in the SemiAnalysis Claude Code traces the paper replays (142K prompt, 444 output, my count). Seconds use the paper&apos;s fitted GLM-5.3-Flash prefill model on two B200s, so they are the paper&apos;s estimate, not a timing of mine. The math agent&apos;s 32K-token reasoning outputs are the far right of the output slider: vLLM recomputes the whole output every turn there.
      </figcaption>
    </figure>
  )
}
