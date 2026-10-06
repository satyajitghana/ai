"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A LoRA budget calculator for the two base models in this article.
//
// A rank-r LoRA on a linear layer W (d_out x d_in) stores A (r x d_in) and
// B (d_out x r): r * (d_in + d_out) parameters. Sum that over every targeted
// layer in every block and you have the file.
//
// Every shape below is measured, from safetensors headers read over HTTP range
// requests:
// - LTX-2.3: the base transformer header (ltx-2.3-22b-distilled-1.1), which
//   gives the six attention modules per block and their shapes, and two
//   ungated IC-LoRA headers (Lightricks' Union-Control at rank 64 and
//   DoctorDiffusion's Colorizer at rank 32), which give the FFN shapes.
// - Qwen-Image-2.1: the RunningHub relight LoRA header, rank 32 on seven
//   layers per block, and ausboss's outpaint LoRA (fused gate_up).
//
// The "reference files" are files whose parameter count this calculator
// reproduces exactly. All but the restore LoRA are measured headers; the
// restore LoRA is gated, so its row is reasoned from its byte size.
//
// Arithmetic is integer + and * only, exact, so no lib/dmath wrapper.

type Layer = { name: string; dIn: number; dOut: number }
type Group = { id: string; label: string; layers: Layer[] }
type RefFile = {
  name: string
  rank: number
  groups: string[]
  params: number
  label: "measured" | "reasoned"
}
type Model = {
  id: string
  label: string
  blocks: number
  base: number
  groups: Group[]
  refs: RefFile[]
  start: { rank: number; groups: string[] }
}

const sq = (n: string, d: number): Layer => ({ name: n, dIn: d, dOut: d })

const LTX: Model = {
  id: "ltx",
  label: "LTX-2.3 22B (restore)",
  blocks: 48,
  base: 21005004544,
  groups: [
    {
      id: "attn1",
      label: "video self-attention",
      layers: [sq("to_q", 4096), sq("to_k", 4096), sq("to_v", 4096), sq("to_out.0", 4096)],
    },
    {
      id: "attn2",
      label: "video to text cross-attention",
      layers: [sq("to_q", 4096), sq("to_k", 4096), sq("to_v", 4096), sq("to_out.0", 4096)],
    },
    {
      id: "a2v",
      label: "audio to video attention",
      layers: [
        { name: "to_q", dIn: 4096, dOut: 2048 },
        sq("to_k", 2048),
        sq("to_v", 2048),
        { name: "to_out.0", dIn: 2048, dOut: 4096 },
      ],
    },
    {
      id: "aattn1",
      label: "audio self-attention",
      layers: [sq("to_q", 2048), sq("to_k", 2048), sq("to_v", 2048), sq("to_out.0", 2048)],
    },
    {
      id: "aattn2",
      label: "audio to text cross-attention",
      layers: [sq("to_q", 2048), sq("to_k", 2048), sq("to_v", 2048), sq("to_out.0", 2048)],
    },
    {
      id: "v2a",
      label: "video to audio attention",
      layers: [
        sq("to_q", 2048),
        { name: "to_k", dIn: 4096, dOut: 2048 },
        { name: "to_v", dIn: 4096, dOut: 2048 },
        sq("to_out.0", 2048),
      ],
    },
    {
      id: "ff",
      label: "video feed-forward",
      layers: [
        { name: "ff.net.0.proj", dIn: 4096, dOut: 16384 },
        { name: "ff.net.2", dIn: 16384, dOut: 4096 },
      ],
    },
  ],
  refs: [
    {
      name: "Restore IC-LoRA (gated)",
      rank: 128,
      groups: ["attn1", "attn2", "a2v", "aattn1", "aattn2", "v2a"],
      params: 855638016,
      label: "reasoned",
    },
    {
      name: "Union-Control IC-LoRA",
      rank: 64,
      groups: ["attn1", "attn2", "ff"],
      params: 327155712,
      label: "measured",
    },
    {
      name: "community Colorizer IC-LoRA",
      rank: 32,
      groups: ["attn1", "attn2", "ff"],
      params: 163577856,
      label: "measured",
    },
  ],
  start: { rank: 128, groups: ["attn1", "attn2", "a2v", "aattn1", "aattn2", "v2a"] },
}

const QWEN: Model = {
  id: "qwen",
  label: "Qwen-Image-2.1 (relight)",
  blocks: 32,
  base: 7115124736,
  groups: [
    {
      id: "attn",
      label: "attention q, k, v, out",
      layers: [sq("to_q", 4096), sq("to_k", 4096), sq("to_v", 4096), sq("to_out.0", 4096)],
    },
    {
      id: "split",
      label: "MLP in, as two layers",
      layers: [
        { name: "img_mlp.gate_layer", dIn: 4096, dOut: 12288 },
        { name: "img_mlp.proj", dIn: 4096, dOut: 12288 },
      ],
    },
    {
      id: "fused",
      label: "MLP in, fused gate_up",
      layers: [{ name: "img_mlp.gate_up", dIn: 4096, dOut: 24576 }],
    },
    {
      id: "out",
      label: "MLP out",
      layers: [{ name: "img_mlp.out", dIn: 12288, dOut: 4096 }],
    },
  ],
  refs: [
    {
      name: "RunningHub relight LoRA",
      rank: 32,
      groups: ["attn", "split", "out"],
      params: 83886080,
      label: "measured",
    },
    {
      name: "ausboss outpaint LoRA",
      rank: 32,
      groups: ["attn", "fused", "out"],
      params: 79691776,
      label: "measured",
    },
  ],
  start: { rank: 32, groups: ["attn", "split", "out"] },
}

const MODELS = [LTX, QWEN]
const RANKS = [4, 8, 16, 32, 64, 128, 256]

const fmt = (n: number) => n.toLocaleString("en-US")
const perLayer = (l: Layer, r: number) => r * (l.dIn + l.dOut)
const groupParams = (g: Group, r: number, blocks: number) =>
  g.layers.reduce((s, l) => s + perLayer(l, r), 0) * blocks

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

export function LoraBudget() {
  const [mi, setMi] = useState(0)
  const model = MODELS[mi]
  const [rankIdx, setRankIdx] = useState(RANKS.indexOf(model.start.rank))
  const [on, setOn] = useState<string[]>(model.start.groups)
  const rank = RANKS[rankIdx]

  const pick = (i: number) => {
    setMi(i)
    setRankIdx(RANKS.indexOf(MODELS[i].start.rank))
    setOn(MODELS[i].start.groups)
  }
  const toggle = (id: string) => {
    setOn((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      // the fused and split MLP inputs are the same weights; pick one
      const next = [...cur, id]
      if (id === "fused") return next.filter((x) => x !== "split")
      if (id === "split") return next.filter((x) => x !== "fused")
      return next
    })
  }

  const rows = model.groups.map((g) => ({
    g,
    params: groupParams(g, rank, model.blocks),
    active: on.includes(g.id),
  }))
  const total = rows.reduce((s, r) => s + (r.active ? r.params : 0), 0)
  const maxRow = Math.max(...rows.map((r) => r.params))
  const bytes = total * 2
  const share = total / model.base
  const match = model.refs.find((f) => f.rank === rank && sameSet(f.groups, on))

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="LoRA budget calculator: parameters per targeted layer group for LTX-2.3 and Qwen-Image-2.1"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <div>
          <span className="font-mono text-xs text-muted-foreground">base model</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODELS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(i)}
                aria-pressed={mi === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  mi === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 mb-0 font-mono text-xs text-muted-foreground">
            {model.blocks} blocks · {fmt(model.base)} base parameters
          </p>
        </div>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">rank r</span>
          <Range
            min={0}
            max={RANKS.length - 1}
            step={1}
            value={rankIdx}
            onChange={(e) => setRankIdx(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="LoRA rank"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">r = {rank}</span>
        </label>
      </div>

      <div className="px-4 py-4">
        <p className="mt-0 mb-3 font-mono text-xs text-muted-foreground">
          tick the layer groups the adapter targets; each bar is r x (d_in + d_out), summed over the
          group&apos;s layers and all {model.blocks} blocks
        </p>
        <ul className="m-0 list-none space-y-2 p-0">
          {rows.map(({ g, params, active }) => (
            <li key={g.id} className="m-0 p-0">
              <label className="grid cursor-pointer grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[auto_14rem_minmax(0,1fr)_7rem]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(g.id)}
                  aria-label={`target ${g.label}`}
                />
                <span className={cn("text-sm", active ? "text-foreground" : "text-muted-foreground")}>
                  {g.label}
                </span>
                <span className="relative block h-3 overflow-hidden rounded-sm bg-muted/60">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 block",
                      active ? "bg-sky-500/70" : "bg-foreground/15"
                    )}
                    style={{ width: `${((params / maxRow) * 100).toFixed(2)}%` }}
                  />
                </span>
                <span className="col-start-2 font-mono text-xs tabular-nums text-muted-foreground sm:col-start-auto sm:text-right">
                  {fmt(params)}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
          <span className="text-muted-foreground">LoRA parameters</span>
          <span className="tabular-nums">{fmt(total)}</span>
          <span className="text-muted-foreground">BF16 file, tensors only</span>
          <span className="tabular-nums">
            {fmt(bytes)} bytes{" "}
            <span className="text-muted-foreground">({(bytes / 1048576).toFixed(1)} MiB)</span>
          </span>
          <span className="text-muted-foreground">share of the base</span>
          <span className="tabular-nums">{(share * 100).toFixed(2)}%</span>
        </div>

        <div className="mt-4 rounded-sm border px-3 py-2 text-xs">
          {match ? (
            <span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400">match</span>{" "}
              this is the {match.name}: {fmt(match.params)} parameters ({match.label})
            </span>
          ) : (
            <span className="text-muted-foreground">
              No shipped file uses this configuration. Reference files:{" "}
              {model.refs.map((f, i) => (
                <span key={f.name}>
                  {i > 0 ? "; " : ""}
                  {f.name} at r = {f.rank}, {fmt(f.params)} ({f.label})
                </span>
              ))}
              .
            </span>
          )}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Layer shapes measured from safetensors headers. The calculator reproduces the measured headers
        exactly; the Restore row is reasoned, because its file is gated and only its byte size is
        public. On Qwen-Image-2.1 the MLP input is either two 12,288-wide layers or one fused
        24,576-wide layer; they are the same weights, so ticking one clears the other.
      </figcaption>
    </figure>
  )
}
