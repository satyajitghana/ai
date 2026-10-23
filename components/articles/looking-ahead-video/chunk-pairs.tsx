"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Future Chunk Prediction's supervision pairs, built from the release's own configs
// (TencentARC/Looking-Ahead @ 210794c, configs/fcp_*.yaml) and its chunk layout code
// (src/utils/predictive_multi_chunk_config.py: PredictiveChunkLayout).
//
// - image_or_video_shape gives 22 latent frames for Wan2.1-1.3B (85 RGB frames at 16 fps)
//   and 31 for Wan2.2-5B (121 RGB frames at 24 fps). independent_first_frame: true keeps
//   the first latent frame (the conditioning image) out of the chunks; num_frame_per_block
//   is 3, so the 1.3B clip has 7 regular chunks and the 5B clip has 10.
// - valid_pair_count(offset) = num_regular_chunks - offset; every pair (k, k + offset)
//   with k + offset inside the clip is trained, once from the clean stream and once from
//   the noisy stream (source_context.streams: [clean, noisy]).
// - future_offsets: {1,2,3} for 1.3B, {1,2,3,4,5} for 5B; offset_loss_weights 0.5 each.
// - A latent frame covers 4 RGB frames (Wan's temporal VAE stride), so a chunk of 3 latent
//   frames is 12 RGB frames: 0.75 s at 16 fps, 0.5 s at 24 fps.
// - Auxiliary branch parameters are counted from PredictiveMultiChunkBranch
//   (src/utils/predictive_causal_model.py) with the backbone widths in Table 5 of the paper;
//   the totals match the size difference between the released FCP and TF checkpoints
//   divided by four bytes to within 0.01%.
//
// "Chained" is the alternative the paper rejects (its Figure 2a, Table 2 rows c and e,
// Table 4 row f): each predictor also receives the previous predictor's hidden states,
// which were computed from a noisy copy of the chunk in between.

type Cfg = {
  id: "1.3b" | "5b"
  name: string
  chunks: number
  fps: number
  offsets: number[]
  branchParams: number
  genParams: number
}

const CFGS: Cfg[] = [
  { id: "1.3b", name: "Wan2.1-1.3B", chunks: 7, fps: 16, offsets: [1, 2, 3], branchParams: 194.19, genParams: 1419 },
  { id: "5b", name: "Wan2.2-5B", chunks: 10, fps: 24, offsets: [1, 2, 3, 4, 5], branchParams: 710.02, genParams: 5000 },
]

const C_SEEN = "oklch(0.62 0.12 250)"
const C_SRC = "oklch(0.55 0.16 265)"
const C_HIDDEN = "oklch(0.75 0.01 260)"
const C_TARGET = "oklch(0.64 0.15 150)"
const C_LEAK = "oklch(0.6 0.2 25)"

const W = 720
const CELL_GAP = 4

export function ChunkPairs() {
  const [cfgId, setCfgId] = useState<Cfg["id"]>("1.3b")
  const cfg = CFGS.find((c) => c.id === cfgId) ?? CFGS[0]
  const maxOff = cfg.offsets[cfg.offsets.length - 1]
  const [kRaw, setK] = useState(2)
  const [offRaw, setOff] = useState(3)
  const [chained, setChained] = useState(false)

  const off = Math.min(offRaw, maxOff)
  // the source chunk must leave room for the chosen offset
  const k = Math.min(kRaw, cfg.chunks - off)

  const secPerChunk = 12 / cfg.fps
  const ahead = off * secPerChunk
  const pairsThis = cfg.chunks - off
  const pairsAll = cfg.offsets.reduce((s, d) => s + (cfg.chunks - d), 0)
  const auxTotal = cfg.branchParams * cfg.offsets.length

  // strip geometry: one image cell + N chunks
  const n = cfg.chunks + 1
  const x0 = 24
  const cw = (W - 2 * x0 - (n - 1) * CELL_GAP) / n
  const cx = (i: number) => x0 + i * (cw + CELL_GAP)
  const stripY = 34
  const ch = 46

  const role = (i: number): "img" | "seen" | "src" | "hidden" | "target" | "later" => {
    if (i === 0) return "img"
    if (i < k) return "seen"
    if (i === k) return "src"
    if (i < k + off) return "hidden"
    if (i === k + off) return "target"
    return "later"
  }

  // predictor branches
  const brY = 168
  const bw = 78
  const bGap = cfg.offsets.length > 3 ? 22 : 46
  const bx0 = W - 24 - cfg.offsets.length * bw - (cfg.offsets.length - 1) * bGap
  const bx = (j: number) => bx0 + j * (bw + bGap)
  const hX = 60
  const hW = 92

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          source chunk k → h_k → one predictor per offset Δ → chunk k+Δ
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CFGS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCfgId(c.id)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
                c.id === cfgId ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 px-4 pt-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-mono text-muted-foreground">
            source chunk k = {k}
          </span>
          <Range min={1} max={cfg.chunks - off} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} accent={C_SRC} />
        </label>
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-mono text-muted-foreground">offset Δ (chunks)</span>
          <div className="flex flex-wrap gap-1">
            {cfg.offsets.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setOff(d)}
                className={cn(
                  "min-w-7 rounded border px-1.5 py-0.5 font-mono text-xs",
                  d === off ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-mono text-muted-foreground">predictor wiring</span>
          <div className="flex gap-1">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setChained(v)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-xs",
                  v === chained ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {v ? "chained" : "parallel (FCP)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 290`} className="mt-2 w-full" role="img" aria-label={`Chunk strip for ${cfg.name}: source chunk ${k}, target chunk ${k + off}, ${off - 1} chunks in between withheld.`}>
        <defs>
          <pattern id="lah-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={C_HIDDEN} strokeWidth="2" />
          </pattern>
          <marker id="lah-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
          <marker id="lah-arr-leak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={C_LEAK} />
          </marker>
        </defs>

        <text x={x0} y={22} fontSize="11" className="fill-muted-foreground font-mono">
          one training clip · {cfg.chunks} chunks of 3 latent frames ({secPerChunk.toFixed(2)} s each at {cfg.fps} fps)
        </text>

        {Array.from({ length: n }, (_, i) => {
          const r = role(i)
          const fill =
            r === "img" ? "transparent" :
            r === "seen" ? C_SEEN :
            r === "src" ? C_SRC :
            r === "hidden" ? "url(#lah-hatch)" :
            r === "target" ? C_TARGET : "transparent"
          const op = r === "seen" ? 0.45 : r === "later" ? 1 : 0.9
          return (
            <g key={i}>
              <rect x={cx(i)} y={stripY} width={cw} height={ch} rx={5} fill={fill} fillOpacity={op}
                stroke={r === "src" ? C_SRC : r === "target" ? C_TARGET : "currentColor"} strokeOpacity={r === "later" || r === "img" ? 0.35 : 0.8}
                strokeWidth={r === "src" || r === "target" ? 2 : 1} strokeDasharray={r === "img" ? "3 3" : undefined} />
              <text x={cx(i) + cw / 2} y={stripY + ch / 2 + 4} textAnchor="middle" fontSize="12" className={cn("font-mono", r === "src" || r === "target" ? "fill-white" : "fill-foreground")}>
                {i === 0 ? "img" : i}
              </text>
            </g>
          )
        })}

        {/* legend under the strip */}
        {[
          { c: C_SEEN, t: "history (visible)" },
          { c: C_SRC, t: "source k" },
          { c: "url(#lah-hatch)", t: "withheld" },
          { c: C_TARGET, t: "target k+Δ" },
        ].map((l, i) => (
          <g key={l.t} transform={`translate(${x0 + i * 150}, ${stripY + ch + 14})`}>
            <rect width="12" height="12" rx="2" fill={l.c} fillOpacity={0.8} stroke="currentColor" strokeOpacity={0.3} />
            <text x="18" y="10" fontSize="11" className="fill-muted-foreground">{l.t}</text>
          </g>
        ))}

        {/* source representation */}
        <rect x={hX} y={brY} width={hW} height={40} rx={6} fill={C_SRC} fillOpacity={0.15} stroke={C_SRC} />
        <text x={hX + hW / 2} y={brY + 17} textAnchor="middle" fontSize="12" className="fill-foreground font-mono">h_k</text>
        <text x={hX + hW / 2} y={brY + 32} textAnchor="middle" fontSize="10" className="fill-muted-foreground">clean + noisy</text>
        <line x1={cx(k) + cw / 2} y1={stripY + ch} x2={hX + hW / 2} y2={brY} stroke={C_SRC} strokeOpacity={0.6} strokeDasharray="4 3" />

        {cfg.offsets.map((d, j) => {
          const active = d === off
          const valid = k + d <= cfg.chunks
          const x = bx(j)
          return (
            <g key={d} opacity={valid ? 1 : 0.3}>
              <rect x={x} y={brY} width={bw} height={40} rx={6}
                fill={active ? C_TARGET : "transparent"} fillOpacity={active ? 0.2 : 0}
                stroke={active ? C_TARGET : "currentColor"} strokeOpacity={active ? 1 : 0.5} />
              <text x={x + bw / 2} y={brY + 17} textAnchor="middle" fontSize="11" className="fill-foreground font-mono">Δ = {d}</text>
              <text x={x + bw / 2} y={brY + 32} textAnchor="middle" fontSize="10" className="fill-muted-foreground">3 DiT blocks</text>
              {/* parallel feed from h_k: a bus under the branches */}
              {(!chained || j === 0) && (
                <path d={`M ${hX + hW} ${brY + 20} L ${hX + hW + 14} ${brY + 20} L ${hX + hW + 14} ${brY + 62} L ${x + bw / 2} ${brY + 62} L ${x + bw / 2} ${brY + 42}`}
                  fill="none" stroke="currentColor" strokeOpacity={0.55} markerEnd="url(#lah-arr)" />
              )}
              {chained && j > 0 && (
                <line x1={bx(j - 1) + bw} y1={brY + 20} x2={x - 2} y2={brY + 20} stroke={C_LEAK} strokeWidth={1.8} markerEnd="url(#lah-arr-leak)" />
              )}
              {/* noisy future input from below, prediction up */}
              <text x={x + bw / 2} y={brY + 84} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
                {valid ? `noisy ${k + d}` : "past end"}
              </text>
              <line x1={x + bw / 2} y1={brY + 74} x2={x + bw / 2} y2={brY + 44} stroke="currentColor" strokeOpacity={0.3} />
            </g>
          )
        })}

        <text x={24} y={brY + 106} fontSize="11" className="fill-muted-foreground">
          {off === 1
            ? `Δ=1 has nothing in between: it is next-chunk prediction, but from h_${k} alone, with no text.`
            : chained
              ? `Chained: branch Δ=${off} also reads hidden states built from noisy chunk ${k + off - 1}, so a withheld chunk leaks in (red).`
              : `Parallel: every branch reads only h_${k}. ${off === 2 ? `Chunk ${k + 1} never reaches` : `Chunks ${k + 1} to ${k + off - 1} never reach`} branch Δ=${off}.`}
        </text>
      </svg>

      <div className="grid gap-2 border-t px-4 py-3 text-xs sm:grid-cols-4">
        <Stat label="looks ahead" value={`${ahead.toFixed(2)} s`} sub={`${off} × ${secPerChunk.toFixed(2)} s`} />
        <Stat label={`pairs at Δ=${off}`} value={`${pairsThis}`} sub={`${cfg.chunks} − ${off}, ×2 streams`} />
        <Stat label="pairs per clip" value={`${pairsAll * 2}`} sub={`${pairsAll} pairs × clean, noisy`} />
        <Stat label="aux params (training only)" value={`${(auxTotal / 1000).toFixed(2)} B`} sub={`${cfg.offsets.length} × ${cfg.branchParams.toFixed(0)} M, ${((auxTotal / cfg.genParams) * 100).toFixed(0)}% of generator`} />
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Chunk layout, offsets and branch structure from the released configs and code; parameter counts reasoned from the code and matched to checkpoint sizes. All of it is dropped at inference.
      </figcaption>
    </figure>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-base">{value}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{sub}</span>
    </div>
  )
}
