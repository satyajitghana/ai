"use client"

import { useState } from "react"

import { ACCENT, Frame, GREEN, STREAM, VIOLET } from "./viz"

// The explorer repository's data flow, from reading its code and README
// (reported). File sizes are the cached files in explorer/cache/ as shipped
// at commit e566e83 (bytes from the clone). Model: Qwen3.5-4B, 32 layers x
// 9,216 MLP neurons.

type Node = { id: string; col: number; title: string; sub: string; detail: string; tone: string }

const NODES: Node[] = [
  { id: "W", col: 0, title: "weights", sub: "Qwen3.5-4B · 32 x 9,216 = 294,912 neurons", tone: STREAM,
    detail: "Every layer has a down_proj of 2,560 x 9,216; each of its columns is one neuron's write direction. Everything in the left half of the pipeline is a function of these matrices." },
  { id: "C", col: 0, title: "10,000 web tokens", sub: "reference text for activation ranges", tone: STREAM,
    detail: "build_act_scale runs about 10k tokens of web text through the model and keeps each neuron's typical largest positive and negative activation, with the first token left out because it is the attention sink." },
  { id: "P", col: 0, title: "prompts and doses", sub: "who · snake · orange · free", tone: STREAM,
    detail: "The sweep's design 'main_rel' pushes every neuron by doses of -0.7, +0.5 and +0.8 of the median residual norm on three short prompts, and +3 on a free prompt, plus one unsteered baseline per prompt." },
  { id: "LI", col: 1, title: "logit lens index", sub: "build_lens_index · minutes", tone: GREEN,
    detail: "For every neuron: normalise its down column, multiply by the unembedding, keep the 12 tokens it promotes and the 12 it suppresses." },
  { id: "SL", col: 1, title: "steer lens", sub: "sweep/steer_lens.py · 111 s per layer on a 4090", tone: GREEN,
    detail: "Push each neuron by plus and minus 0.8 of the residual norm on four short contexts, average the change in next-token log-probability, keep the top 12 tokens and the KL per sign. It sees more than the direct path." },
  { id: "CN", col: 1, title: "connections", sub: "build_connections · about 5 min on a 4090", tone: GREEN,
    detail: "For each pair of layers, one product per neuron pair: the gate row and up row of the later neuron against the earlier neuron's down column (through the later layer's norm weight). Keep each neuron's 24 strongest links per side." },
  { id: "LY", col: 1, title: "writes layout", sub: "UMAP of down columns, snapped to 96 x 96", tone: GREEN,
    detail: "Per layer, neurons with similar down columns are placed next to each other on a 96 x 96 sheet. The log's own check: neighbour recall 12.9 percent against 0.7 percent for index order at layer 22." },
  { id: "AS", col: 1, title: "activation scale", sub: "build_act_scale", tone: GREEN,
    detail: "Turns a raw activation into a score: activation over the neuron's typical maximum (or minimum), so 'fires' can rank neurons across layers." },
  { id: "SW", col: 1, title: "steering sweep", sub: "vLLM fork on a GPU pod · hours", tone: ACCENT,
    detail: "Every neuron of a layer, pushed up and down on a few prompts; every rollout kept with token ids, logprobs and the top five alternatives. About 95,000 rollouts per full layer." },
  { id: "RK", col: 1, title: "ranking", sub: "rank.py · word-cluster mass", tone: ACCENT,
    detail: "Words that appear in a neuron's rollouts and not in the baselines, weighted by how rare they are across neurons, summed over a unit's top five, and z-scored against 256 random-direction controls." },
  { id: "lens_index", col: 2, title: "lens_index.npz", sub: "28.3 MB", tone: GREEN, detail: "int32 arrays up[32, 9216, 12] and down[32, 9216, 12]: token ids only; strings come from vocab.json (4.1 MB)." },
  { id: "steer_index", col: 2, title: "steer_index.npz", sub: "30.7 MB", tone: GREEN, detail: "The steer lens: top tokens and KL per sign, per neuron." },
  { id: "connections", col: 2, title: "connections.npz", sub: "54.3 MB", tone: GREEN, detail: "Top-24 direct-path links per neuron and side: layer (int8), neuron (int16), z (float16), sign (int8)." },
  { id: "layout", col: 2, title: "layout_writes.npz", sub: "0.6 MB", tone: GREEN, detail: "Grid coordinates per neuron for the 'writes' sheet view." },
  { id: "act_scale", col: 2, title: "act_scale.npz", sub: "2.4 MB", tone: GREEN, detail: "Typical positive and negative extremes per neuron." },
  { id: "rollouts", col: 2, title: "rollouts + units", sub: "runs/ (not shipped)", tone: ACCENT, detail: "jsonl of every rollout, and a ranked unit list per layer. Produced by the sweep; the explorer reads them from runs/." },
  { id: "map", col: 3, title: "3D map + hover", sub: "layers in perspective", tone: VIOLET, detail: "A point per neuron on a sheet per layer. Hover shows the steer lens and the logit lens; the selected neuron's links are drawn as lines to the neurons it connects to." },
  { id: "search", col: 3, title: "lens search", sub: "substring over 12-token lists", tone: VIOLET, detail: "Find the vocabulary entries that contain the query, then test every neuron's 12 up and 12 down tokens against that set with one array lookup. No model is loaded for this." },
  { id: "fires", col: 3, title: "fires", sub: "your text, every neuron", tone: VIOLET, detail: "Runs your text through the live model, keeps each neuron's max and min over the tokens, and divides by act_scale. Needs the model loaded." },
  { id: "list", col: 3, title: "ranked list", sub: "units by cluster mass", tone: VIOLET, detail: "The layer's neurons sorted by how far their steered rollouts move words from the random controls." },
  { id: "panel", col: 3, title: "neuron panel", sub: "three-column steered chat", tone: VIOLET, detail: "Examples from the sweep, plus a live chat: one prompt, three rows decoded greedily in one batch (pushed up, unsteered, pushed down)." },
  { id: "agent", col: 3, title: "Claude via MCP", sub: "tools over the same endpoints", tone: VIOLET, detail: "The explorer exposes its endpoints as tools (neuron, rollouts, cone, search_lens, steer, activations, compare, logprobs, top_firing, camera, ...) to a locally installed Claude CLI. It needs that CLI and a login." },
]

const EDGES: [string, string][] = [
  ["W", "LI"], ["W", "SL"], ["P", "SL"], ["W", "CN"], ["W", "LY"], ["W", "AS"], ["C", "AS"], ["W", "SW"], ["P", "SW"], ["SW", "RK"],
  ["LI", "lens_index"], ["SL", "steer_index"], ["CN", "connections"], ["LY", "layout"], ["AS", "act_scale"], ["SW", "rollouts"], ["RK", "rollouts"],
  ["lens_index", "map"], ["steer_index", "map"], ["connections", "map"], ["layout", "map"], ["lens_index", "search"], ["steer_index", "search"],
  ["act_scale", "fires"], ["rollouts", "list"], ["rollouts", "panel"], ["connections", "panel"], ["lens_index", "panel"],
  ["lens_index", "agent"], ["connections", "agent"], ["rollouts", "agent"],
]

function reach(id: string, forward: boolean): Set<string> {
  const seen = new Set<string>([id])
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const [a, b] of EDGES) {
      const [from, to] = forward ? [a, b] : [b, a]
      if (from === cur && !seen.has(to)) {
        seen.add(to)
        stack.push(to)
      }
    }
  }
  return seen
}

function related(id: string): Set<string> {
  return new Set([...reach(id, true), ...reach(id, false)])
}

const COLS = ["inputs", "builders", "cached files", "views"]

export function PipelineFlow() {
  const [sel, setSel] = useState("lens_index")
  const hot = related(sel)
  const node = NODES.find((n) => n.id === sel)!
  return (
    <Frame
      label="neuron-explorer: from weights to views · read from the repository (reported)"
      note="Select a box to light everything upstream and downstream of it. Orange boxes are the steering sweep, which needs a GPU pod and is not rerun by the explorer; green boxes are cheap functions of the weights."
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {COLS.map((c, ci) => (
          <div key={c} className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{c}</p>
            {NODES.filter((n) => n.col === ci).map((n) => {
              const on = hot.has(n.id)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSel(n.id)}
                  aria-pressed={sel === n.id}
                  className="w-full cursor-pointer rounded-md border px-2 py-1.5 text-left transition-opacity"
                  style={{
                    borderColor: on ? n.tone : undefined,
                    background: sel === n.id ? `color-mix(in oklch, ${n.tone} 18%, transparent)` : undefined,
                    opacity: on ? 1 : 0.35,
                  }}
                >
                  <span className="block font-mono text-[11px] text-foreground">{n.title}</span>
                  <span className="block font-mono text-[9.5px] leading-snug text-muted-foreground">{n.sub}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2.5 text-[13px] leading-relaxed">
        <span className="font-mono text-xs" style={{ color: node.tone }}>
          {node.title}
        </span>
        <p className="mt-1 text-muted-foreground">{node.detail}</p>
      </div>
    </Frame>
  )
}
