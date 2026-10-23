"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One request through DeepSeek's V4.1-Flash serving system, stage by stage.
// Every "holds" and "does" line is taken from the DeepInfer repository: the
// engine code (csrc/engine/*.hpp, deepinfer/worker/cache_engine.py,
// deepinfer/engine/llm_engine.py) or doc/inference_deployment_qa.md. The badge
// says whether the stage's code is in the 20 October release or only described.

type Stage = {
  id: string
  label: string
  sub: string
  released: "yes" | "engine" | "no"
  holds: string
  does: string
  code: string
}

const STAGES: Stage[] = [
  {
    id: "recipe",
    label: "Recipe",
    sub: "JSON to tokens",
    released: "yes",
    holds: "The conversation, and the position of every special token it inserted.",
    does: "Turns a Chat Completions, Responses or Messages request into one conversation format, renders the prompt and encodes the text between special tokens in parallel. User text that spells a control token is encoded as ordinary tokens.",
    code: "deepseek-recipe (Rust, Python bindings, MIT)",
  },
  {
    id: "entry",
    label: "Entrypoint",
    sub: "prefix match",
    released: "no",
    holds: "Metadata only: a hash-chain index of what the KV store holds, and a directory of which machine has each SWA state.",
    does: "Computes the cache hit before routing. The hit is capped at L - 134; the block cache gives L1, and if no SWA state exists between L1 - 128 and L1 it backs off one block.",
    code: "described in the Q&A; not in the repository",
  },
  {
    id: "plb",
    label: "Prefill LB",
    sub: "4 length tiers",
    released: "no",
    holds: "A compute quota per tier: under 16K, 16K to 64K, 64K to 256K, and 256K or more.",
    does: "Engines pull work by remaining quota, with no prefix affinity, since any engine can read any prefix from 3FS. Inside a DP group each request goes to the rank with the lowest quota load.",
    code: "described in the Q&A; not in the repository",
  },
  {
    id: "prefill",
    label: "Prefill engine",
    sub: "EP2 to EP8",
    released: "engine",
    holds: "Paged block KV in HBM (compressed main KV and indexer keys, FP4), and one fixed state slot per sequence: a 134-token SWA ring per layer at 528 bytes a token, plus compression state.",
    does: "Swaps cached KV in layer by layer while the forward runs, sizes each chunk from a fitted cost model under a 32,768-token cap, runs the encoder layers over the new suffix and the decoder layers over only the last 140 tokens.",
    code: "EngineType::PROMPT in csrc/engine/scheduler.hpp; cache_engine.py",
  },
  {
    id: "xfer",
    label: "KV transfer",
    sub: "P to D",
    released: "no",
    holds: "The request's block KV and its SWA state, which share one transfer path.",
    does: "Moves both from the prefill machine to a decode machine. The Q&A budgets about 400 Gbps of interconnect per 8 GPUs.",
    code: "only empty hooks: init_pd_split, pe_do_save_kvcache",
  },
  {
    id: "dlb",
    label: "Decode LB",
    sub: "count and length",
    released: "no",
    holds: "Per GPU: running requests and total KV length.",
    does: "Routes across every GPU of every decode instance, sending short requests to GPUs with few requests but long total KV, and long requests to GPUs with short total KV.",
    code: "described in the Q&A; not in the repository",
  },
  {
    id: "decode",
    label: "Decode engine",
    sub: "EP64 to EP128",
    released: "engine",
    holds: "The same block KV and state slot, an MTP slot for the draft tokens, a shard of the Engram tables in a DeepEP buffer, and 7 experts per GPU at EP64.",
    does: "DSpark drafts 5 tokens, a confidence head scores them, the scheduler picks how many to verify, and the CPU schedules step N+1 while the GPU runs step N. KV is still written back to 3FS at 128-token boundaries.",
    code: "EngineType::COMPLETION; csrc/engine/mtp_varlen.hpp; zos.cpp",
  },
]

const BADGE: Record<Stage["released"], { text: string; cls: string }> = {
  yes: { text: "released", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  engine: { text: "in the release", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  no: { text: "described, not released", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
}

// layout: a U through the frame, viewBox units
const W = 560
const H = 230
const BW = 112
const BH = 46
const POS: Record<string, [number, number]> = {
  recipe: [20, 18],
  entry: [158, 18],
  plb: [296, 18],
  prefill: [428, 18],
  xfer: [428, 160],
  dlb: [290, 160],
  decode: [152, 160],
}
const EDGES: [string, string, boolean?][] = [
  ["recipe", "entry"],
  ["entry", "plb"],
  ["plb", "prefill"],
  ["prefill", "xfer"],
  ["xfer", "dlb"],
  ["dlb", "decode"],
]

function centre(id: string): [number, number] {
  const [x, y] = POS[id]
  return [x + BW / 2, y + BH / 2]
}

function edgePath(a: string, b: string): string {
  const [ax, ay] = centre(a)
  const [bx, by] = centre(b)
  if (ay === by) {
    const dir = bx > ax ? 1 : -1
    return `M ${ax + (dir * BW) / 2} ${ay} L ${bx - (dir * BW) / 2 - dir * 4} ${by}`
  }
  return `M ${ax} ${ay + BH / 2} L ${bx} ${by - BH / 2 - 4}`
}

export function RequestLifecycle() {
  const [sel, setSel] = useState(3)
  const s = STAGES[sel]
  const badge = BADGE[s.released]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">one request through the V4.1-Flash serving system</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSel((sel + STAGES.length - 1) % STAGES.length)}
            className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
            aria-label="previous stage"
          >
            prev
          </button>
          <button
            type="button"
            onClick={() => setSel((sel + 1) % STAGES.length)}
            className="cursor-pointer rounded-md bg-foreground px-2 py-1 text-background"
            aria-label="next stage"
          >
            next
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Seven stages: Recipe, Entrypoint, Prefill load balancer, Prefill engine, KV transfer, Decode load balancer, Decode engine. The stages in green are in the DeepInfer release; the others are described but not released."
        >
          <defs>
            <marker id="rl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-muted-foreground" />
            </marker>
          </defs>
          {EDGES.map(([a, b]) => (
            <path
              key={`${a}-${b}`}
              d={edgePath(a, b)}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth={1.4}
              fill="none"
              markerEnd="url(#rl-arrow)"
            />
          ))}
          {/* tokens go back out through the entrypoint and recipe */}
          <path
            d={`M ${POS.decode[0]} ${POS.decode[1] + BH / 2} L 60 ${POS.decode[1] + BH / 2} L 60 ${POS.recipe[1] + BH + 4}`}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1.2}
            strokeDasharray="4 3"
            fill="none"
            markerEnd="url(#rl-arrow)"
          />
          <text x={66} y={128} fontSize={9} className="fill-muted-foreground font-mono">
            tokens back out
          </text>
          <text x={POS.prefill[0] + BW / 2 + 6} y={128} fontSize={9} className="fill-muted-foreground font-mono">
            KV + state
          </text>
          {STAGES.map((st, i) => {
            const [x, y] = POS[st.id]
            const on = i === sel
            const rel = st.released !== "no"
            return (
              <g
                key={st.id}
                role="button"
                tabIndex={0}
                aria-label={`${st.label}: ${BADGE[st.released].text}`}
                onClick={() => setSel(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSel(i)
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x}
                  y={y}
                  width={BW}
                  height={BH}
                  rx={8}
                  strokeWidth={on ? 2.4 : 1.2}
                  strokeDasharray={rel ? undefined : "5 3"}
                  className={cn(
                    rel ? "fill-emerald-500/10 stroke-emerald-600 dark:stroke-emerald-400" : "fill-amber-500/10 stroke-amber-600 dark:stroke-amber-400",
                    on && "fill-foreground/10",
                  )}
                />
                <text x={x + BW / 2} y={y + 20} textAnchor="middle" fontSize={11.5} fontWeight={600} className="fill-foreground">
                  {st.label}
                </text>
                <text x={x + BW / 2} y={y + 35} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
                  {st.sub}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 rounded-lg border bg-background/60 p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {sel + 1}. {s.label}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", badge.cls)}>{badge.text}</span>
          </div>
          <dl className="grid gap-1.5 sm:grid-cols-[5.5rem_1fr]">
            <dt className="font-mono text-xs text-muted-foreground">holds</dt>
            <dd>{s.holds}</dd>
            <dt className="font-mono text-xs text-muted-foreground">does</dt>
            <dd>{s.does}</dd>
            <dt className="font-mono text-xs text-muted-foreground">code</dt>
            <dd className="font-mono text-xs">{s.code}</dd>
          </dl>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Solid boxes are stages whose code ships in DeepInfer or deepseek-recipe; dashed boxes are described in the repository&apos;s
        Q&amp;A but not released. Click a stage, or use prev and next.
      </figcaption>
    </figure>
  )
}
