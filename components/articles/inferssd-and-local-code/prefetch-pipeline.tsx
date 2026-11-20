"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One decode layer (and the start of the next) in InferSSD's CPU sink, built up
// one mechanism at a time. The order of events is the code's
// (engine/ggml/src/ggml-cpu/ssd/cpu-sink.cpp at ca8db2e):
//   - io_issue(): with role_major, every miss's up and gate reads are queued
//     before any down read, "so early-up-gate can overlap the CPU work with the
//     streamed down reads";
//   - a RAM-cache hit needs no read at all (host/expert-cache.h, count_decay2);
//   - after a layer's own reads end, the I/O thread reads the experts the next
//     layer is predicted to pick into that layer's RAM slots until the next
//     layer's call starts (the decode prefetch, prefetch.depth).
// The prediction is the NEXT layer's router applied to this layer's FFN input
// (build_moe_prefetch_hint in engine/src/llama-graph.cpp).
//
// Durations are toy units chosen to make the shape visible. They are not
// measured on any machine. The worth calculator below the timeline is the
// real rule, ssd::place::prefetch_read_value in place/runtime-policy.h, for one
// read issued when the gap opens.

type Lane = "gpu" | "ssd" | "cpu"
type Kind = "gpu" | "gu" | "dn" | "pf" | "cpu" | "hit"
type Block = { lane: Lane; s: number; e: number; label: string; kind: Kind }

type Step = { id: string; label: string; blurb: string; blocks: Block[]; doneL: number; doneNext?: number }

const g = (s: number, e: number, label: string): Block => ({ lane: "gpu", s, e, label, kind: "gpu" })
const rd = (s: number, e: number, label: string, kind: Kind = "gu"): Block => ({ lane: "ssd", s, e, label, kind })
const c = (s: number, e: number, label: string, kind: Kind = "cpu"): Block => ({ lane: "cpu", s, e, label, kind })

const STEPS: Step[] = [
  {
    id: "serial",
    label: "1 · read, then compute",
    blurb:
      "The router for layer L picks four experts. None is in memory. Read all of them, gate, up and down, then compute. The CPU waits for the drive and the drive waits for the router.",
    blocks: [
      g(0, 2, "attn + router L"),
      rd(2, 3, "e1 g+u"), rd(3, 3.6, "d", "dn"), rd(3.6, 4.6, "e2 g+u"), rd(4.6, 5.2, "d", "dn"),
      rd(5.2, 6.2, "e3 g+u"), rd(6.2, 6.8, "d", "dn"), rd(6.8, 7.8, "e4 g+u"), rd(7.8, 8.4, "d", "dn"),
      c(8.4, 11.2, "e1-e4 math"),
      g(11.2, 12, "L+1"),
    ],
    doneL: 11.2,
  },
  {
    id: "rolemajor",
    label: "2 · gate/up first",
    blurb:
      "Queue every expert's gate and up reads before any down read. Each expert's first half of the math (x·gate, x·up, SwiGLU) starts the moment its two matrices land, while the down matrices are still streaming.",
    blocks: [
      g(0, 2, "attn + router L"),
      rd(2, 3, "e1 g+u"), rd(3, 4, "e2 g+u"), rd(4, 5, "e3 g+u"), rd(5, 6, "e4 g+u"),
      rd(6, 6.6, "d1", "dn"), rd(6.6, 7.2, "d2", "dn"), rd(7.2, 7.8, "d3", "dn"), rd(7.8, 8.4, "d4", "dn"),
      c(3, 3.4, "1"), c(4, 4.4, "2"), c(5, 5.4, "3"), c(6, 6.4, "4"),
      c(6.6, 6.9, "d"), c(7.2, 7.5, "d"), c(7.8, 8.1, "d"), c(8.4, 8.7, "d"),
      g(8.7, 10.7, "attn + router L+1"),
    ],
    doneL: 8.7,
  },
  {
    id: "cache",
    label: "3 · a RAM cache",
    blurb:
      "Two of the four experts were used recently and still sit in the RAM cache, so they cost no read and their math starts at once. Only two reads go to the drive. Then look at the drive after its last read: it idles while the GPU runs layer L+1's attention.",
    blocks: [
      g(0, 2, "attn + router L"),
      c(2, 2.7, "e1 hit", "hit"), c(2.7, 3.4, "e2 hit", "hit"),
      rd(2, 3, "e3 g+u"), rd(3, 4, "e4 g+u"), rd(4, 4.6, "d3", "dn"), rd(4.6, 5.2, "d4", "dn"),
      c(3.4, 3.8, "3"), c(4, 4.4, "4"), c(4.6, 4.9, "d"), c(5.2, 5.5, "d"),
      g(5.5, 7.5, "attn + router L+1"),
      rd(7.5, 8.5, "g+u"), rd(8.5, 9.5, "g+u"), rd(9.5, 10.1, "d", "dn"), rd(10.1, 10.7, "d", "dn"),
      c(8.5, 8.9, "1"), c(9.5, 9.9, "2"), c(10.1, 10.4, "d"), c(10.7, 11, "d"),
    ],
    doneL: 5.5,
    doneNext: 11,
  },
  {
    id: "prefetch",
    label: "4 · read ahead into the gap",
    blurb:
      "Layer L's graph also ran layer L+1's router on L's input, a guess at what L+1 will pick. The drive spends its idle gap reading the likeliest guesses into L+1's RAM slots. One lands before L+1's router runs; the second is still in flight and finishes early. L+1 finishes about two units sooner.",
    blocks: [
      g(0, 2, "attn + router L"),
      c(2, 2.7, "e1 hit", "hit"), c(2.7, 3.4, "e2 hit", "hit"),
      rd(2, 3, "e3 g+u"), rd(3, 4, "e4 g+u"), rd(4, 4.6, "d3", "dn"), rd(4.6, 5.2, "d4", "dn"),
      c(3.4, 3.8, "3"), c(4, 4.4, "4"), c(4.6, 4.9, "d"), c(5.2, 5.5, "d"),
      g(5.5, 7.5, "attn + router L+1"),
      rd(5.2, 6.8, "guess 1", "pf"), rd(6.8, 8.4, "guess 2", "pf"),
      c(7.5, 8.2, "hit", "hit"), c(8.4, 9.1, "lands", "hit"),
    ],
    doneL: 5.5,
    doneNext: 9.1,
  },
]

const KIND: Record<Kind, string> = {
  gpu: "fill-sky-500/60",
  gu: "fill-amber-500/80",
  dn: "fill-amber-300/80",
  pf: "fill-violet-500/70",
  cpu: "fill-emerald-500/70",
  hit: "fill-emerald-300/80",
}

const LANES: { id: Lane; label: string; y: number }[] = [
  { id: "gpu", label: "GPU", y: 8 },
  { id: "ssd", label: "SSD", y: 44 },
  { id: "cpu", label: "CPU", y: 80 },
]

const X0 = 44
const W = 620
const T = 12
const x = (t: number) => X0 + (t / T) * W

function worth(p: number, gap: number, read: number) {
  // prefetch_read_value for one window, read issued and started when the gap opens
  if (gap >= read) return p
  if (gap > 0) return p - (read - gap) / read
  return 0
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function PrefetchPipeline() {
  const [i, setI] = useState(0)
  const [p, setP] = useState(0.6)
  const [gap, setGap] = useState(1.2)
  const step = STEPS[i]
  const read = 1.6
  const v = worth(p, gap, read)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode layer in the CPU sink</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy time units; order of events from the code</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="mechanism">
          {STEPS.map((s, k) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              className={cn(
                "rounded px-2 py-1 font-mono text-xs transition-colors",
                k === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox="0 0 680 128" className="w-full min-w-[520px]" role="img" aria-label={step.blurb}>
            {LANES.map((l) => (
              <g key={l.id}>
                <text x={4} y={l.y + 18} className="fill-muted-foreground font-mono text-[10px]">
                  {l.label}
                </text>
                <line x1={X0} x2={X0 + W} y1={l.y + 30} y2={l.y + 30} className="stroke-border" />
              </g>
            ))}
            {step.blocks.map((b, k) => {
              const lane = LANES.find((l) => l.id === b.lane) ?? LANES[0]
              const bw = x(b.e) - x(b.s)
              return (
                <g key={`${step.id}-${k}`}>
                  <rect x={x(b.s) + 0.5} y={lane.y + 4} width={Math.max(1, bw - 1)} height={24} rx={3} className={KIND[b.kind]} />
                  {bw > 18 && (
                    <text x={x(b.s) + bw / 2} y={lane.y + 20} textAnchor="middle" className="fill-foreground font-mono text-[8px]">
                      {b.label}
                    </text>
                  )}
                </g>
              )
            })}
            <line x1={x(step.doneL)} x2={x(step.doneL)} y1={4} y2={116} className="stroke-foreground" strokeDasharray="3 3" />
            <text x={x(step.doneL) + 3} y={124} className="fill-foreground font-mono text-[9px]">
              L done
            </text>
            {step.doneNext !== undefined && (
              <>
                <line x1={x(step.doneNext)} x2={x(step.doneNext)} y1={4} y2={116} className="stroke-foreground" strokeDasharray="1 3" />
                <text x={x(step.doneNext) + 3} y={124} className="fill-foreground font-mono text-[9px]">
                  L+1 done
                </text>
              </>
            )}
          </svg>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{step.blurb}</p>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-mono text-[11px] text-muted-foreground">
            is one speculative read worth issuing? <span className="text-foreground">prefetch_read_value</span>
          </div>
          <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <label className="block font-mono text-[11px] text-muted-foreground">
              chance L+1 uses this guess, p: <span className="text-foreground">{r2(p)}</span>
              <Range min={0.05} max={1} step={0.05} value={p} onChange={(e) => setP(Number(e.target.value))} />
            </label>
            <label className="block font-mono text-[11px] text-muted-foreground">
              idle gap, as a share of one read: <span className="text-foreground">{r2(gap / read)}</span>
              <Range min={0} max={2} step={0.05} value={gap / read} onChange={(e) => setGap(Number(e.target.value) * read)} />
            </label>
          </div>
          <p className="mt-2 font-mono text-xs">
            {gap >= read
              ? `the read finishes inside the gap: worth p = ${r2(v)} of a read`
              : gap > 0
                ? `the gap ends with ${r2((read - gap) / read)} of the read left: worth p - r = ${r2(v)}`
                : "the gap is gone before the read is issued: dropped, worth 0"}
            <span className={cn("ml-2", v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {v > 0 ? "issue it" : "skip it"}
            </span>
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Amber: demand reads (dark gate and up, light down). Violet: read-ahead for layer L+1. Green: CPU expert math
        (light when the weights came from the RAM cache). The worth rule is InferSSD&apos;s: a read that the next router
        overtakes costs the next layer the share still unread, so it pays only when p beats that share.
      </figcaption>
    </figure>
  )
}
