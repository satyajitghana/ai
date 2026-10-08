"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Resolution x frames -> latent tokens -> attention cost and memory, for
// Wan2.1-T2V-1.3B with full attention and with T3-Video's window attention.
//
// Every factor is read from the released code, not assumed:
//   VAE: 8x spatial (wan_video_vae.py:1077 upsampling_factor = 8), 4x temporal
//        with the first frame kept ((num_frames - 1) // 4 + 1,
//        wan_video_new.py:495), 16 latent channels (wan_video_vae.py:1060).
//   DiT: patch (1, 2, 2), dim 1536, ffn 8960, 12 heads, 30 layers
//        (wan_video_dit.py:636-650).
//   T3:  five layer types cycled through the depth (wan_video_dit.py:199-212),
//        each running two branches (close + remote) whose outputs are averaged
//        (wan_video_dit.py:242-272).
// MACs use the paper's own accounting (Section 3.2): attention = 2*L*Lb*C per
// branch, projections 4*L*C^2, FFN 2*L*C*C_ffn. At 2176x3840x81 this
// reproduces Table 1 exactly: 43,299.3T full vs 1,006.8T T3.

const C = 1536
const CFFN = 8960
const LAYERS = 30
const GROUPS = LAYERS / 5
// "Rest" in Table 1 (text/time embeddings + cross-attention) scales linearly in L:
// 97.7T at 685,440 tokens.
const REST_PER_TOKEN = 97.7e12 / 685440

type Preset = { id: string; h: number; w: number; paper?: { full: number; t3: number; allFull: number; allT3: number; dit50Full: number; dit50T3: number } }

// Table 1 (MACs, T) and Table 2 (DiT seconds for 50 steps, one CFG branch, H20).
const PRESETS: Preset[] = [
  { id: "480p", h: 480, w: 832, paper: { full: 98.9, t3: 4.5, allFull: 140.0, allT3: 45.5, dit50Full: 131.1, dit50T3: 50.4 } },
  { id: "720p", h: 720, w: 1280, paper: { full: 526.7, t3: 17.0, allFull: 621.4, allT3: 111.7, dit50Full: 572.1, dit50T3: 123.0 } },
  { id: "1080p", h: 1088, w: 1920, paper: { full: 2706.2, t3: 77.5, allFull: 2920.7, allT3: 291.9, dit50Full: 2653.7, dit50T3: 310.3 } },
  { id: "4K", h: 2176, w: 3840, paper: { full: 43299.3, t3: 1006.8, allFull: 44157.1, allT3: 1864.5, dit50Full: 39661.7, dit50T3: 1857.4 } },
]

const FULL = "oklch(0.64 0.17 35)"
const T3 = "oklch(0.62 0.14 200)"
const DEDUP = "oklch(0.66 0.15 140)"

function fmtT(macs: number) {
  const t = macs / 1e12
  if (t >= 1000) return `${Math.round(t).toLocaleString("en-US")}T`
  if (t >= 10) return `${t.toFixed(1)}T`
  return `${t.toFixed(2)}T`
}

function fmtBytes(b: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let v = b
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

export function TokenCost() {
  const [pi, setPi] = useState(3)
  const [frames, setFrames] = useState(81)
  const [dedup, setDedup] = useState(false)

  const p = PRESETS[pi]
  const T = Math.floor((frames - 1) / 4) + 1
  const Hl = p.h / 16
  const Wl = p.w / 16
  const L = T * Hl * Wl
  const perFrame = Hl * Wl

  // window token counts per layer type, from the released 4K config:
  // type 0: one whole latent frame; types 1-2 span every latent frame;
  // types 3-4 span 7 and 3 latent frames.
  const lb = [
    perFrame,
    T * 8 * 8,
    T * 17 * 6,
    Math.min(7, T) * 8 * 30,
    Math.min(3, T) * 17 * 40,
  ].map((v) => Math.min(v, L))

  const fullAttn = LAYERS * 2 * L * L * C
  const t3Attn = GROUPS * lb.reduce((s, v, k) => s + (k === 0 && dedup ? 1 : 2) * 2 * L * v * C, 0)
  const proj = LAYERS * 4 * L * C * C
  const ffn = LAYERS * 2 * L * C * CFFN
  const rest = REST_PER_TOKEN * L
  const allFull = fullAttn + proj + ffn + rest
  const allT3 = t3Attn + proj + ffn + rest

  // memory, bf16
  const scoresFull = L * L * 2 * 12 // one layer, all 12 heads, if materialised
  const scoresT3 = 2 * L * lb[1] * 2 * 12 // a small-window layer, both branches
  const act = L * C * 2
  const ffnHidden = L * CFFN * 2

  const showPaper = frames === 81 && p.paper
  const exact = pi === 3

  const maxLog = mlog10(allFull)
  const minLog = mlog10(1e12)
  const bar = (v: number) => `${Math.max(2, ((mlog10(Math.max(v, 1e12)) - minLog) / (maxLog - minLog)) * 100).toFixed(1)}%`

  const rows: { label: string; v: number; color: string; sub: string }[] = [
    { label: "full attention", v: fullAttn, color: FULL, sub: "30 layers x 2·L²·C" },
    { label: dedup ? "T3, duplicate branch dropped" : "T3 window attention", v: t3Attn, color: dedup ? DEDUP : T3, sub: dedup ? "per-frame layers run once" : "both branches, as shipped" },
    { label: "projections + FFN + rest", v: proj + ffn + rest, color: "oklch(0.6 0.02 260)", sub: "identical in both models" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>tokens and attention cost · Wan2.1-1.3B vs T3-Video</span>
        <span className="text-muted-foreground/60">one DiT forward, MACs</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">resolution</span>
          {PRESETS.map((q, k) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={pi === k}
              onClick={() => setPi(k)}
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors"
              style={pi === k ? { background: T3, color: "oklch(0.15 0 0)", borderColor: T3 } : undefined}
            >
              {q.id} <span className={pi === k ? "" : "text-muted-foreground"}>{q.w}x{q.h}</span>
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-[11px]">
            <input type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} />
            <span>run the per-frame layers once</span>
          </label>
        </div>

        <label className="block">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>frames: <span className="text-foreground">{frames}</span></span>
            <span>{T} latent frames</span>
          </span>
          <Range min={17} max={161} step={4} value={frames} onChange={(e) => setFrames(Number(e.target.value))} className="mt-1 w-full cursor-pointer" accent={T3} />
        </label>

        <div className="grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-muted-foreground">latent grid T x H x W</div>
            <div className="text-lg font-semibold tabular-nums">{T} x {Hl} x {Wl}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">tokens L</div>
            <div className="text-lg font-semibold tabular-nums">{L.toLocaleString("en-US")}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">attention saving</div>
            <div className="text-lg font-semibold tabular-nums" style={{ color: dedup ? DEDUP : T3 }}>{(fullAttn / t3Attn).toFixed(1)}x</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">whole-DiT saving</div>
            <div className="text-lg font-semibold tabular-nums text-foreground">{(allFull / allT3).toFixed(1)}x</div>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between font-mono text-[11px]">
                <span>
                  {r.label} <span className="text-muted-foreground">· {r.sub}</span>
                </span>
                <span className="tabular-nums">{fmtT(r.v)}</span>
              </div>
              <div className="mt-1 h-2.5 w-full rounded-full bg-muted/40">
                <div className="h-2.5 rounded-full" style={{ width: bar(r.v), background: r.color }} />
              </div>
            </div>
          ))}
          <div className="font-mono text-[10px] text-muted-foreground">bars on a log scale from 1T</div>
        </div>

        {showPaper && p.paper ? (
          <div className="rounded-lg border px-3 py-2 font-mono text-[11px] leading-5">
            <div className="text-muted-foreground">paper, Tables 1 and 2, at {p.id} x 81 frames</div>
            <div>
              attention {p.paper.full.toLocaleString("en-US")}T vs {p.paper.t3.toLocaleString("en-US")}T ({(p.paper.full / p.paper.t3).toFixed(1)}x) ·
              whole DiT {p.paper.allFull.toLocaleString("en-US")}T vs {p.paper.allT3.toLocaleString("en-US")}T ({(p.paper.allFull / p.paper.allT3).toFixed(1)}x)
            </div>
            <div>
              measured DiT time, 50 steps on one H20: {p.paper.dit50Full.toLocaleString("en-US")}s vs {p.paper.dit50T3.toLocaleString("en-US")}s ({(p.paper.dit50Full / p.paper.dit50T3).toFixed(1)}x)
            </div>
            {!exact && !dedup ? (
              <div className="text-muted-foreground">
                The paper&apos;s lower-resolution T3 rows used window sizes that are not in the released code, so the T3 line above (the 4K windows, held fixed) runs higher than the table.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-[10px] text-muted-foreground">attention scores, one layer, 12 heads, bf16, if written out</div>
            <div>
              full: <span style={{ color: FULL }}>{fmtBytes(scoresFull)}</span> · T3 small-window layer: <span style={{ color: T3 }}>{fmtBytes(scoresT3)}</span>
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-[10px] text-muted-foreground">what flash attention leaves you holding, bf16</div>
            <div>
              one L x 1536 tensor: {fmtBytes(act)} · FFN hidden: {fmtBytes(ffnHidden)}
            </div>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Wan2.1&apos;s VAE divides each side by 8 and time by 4, and the DiT patches 2 x 2 more, so one token stands for a
          16 x 16 pixel square over four frames. At this setting that is <span className="text-foreground">{L.toLocaleString("en-US")}</span>{" "}
          tokens. Full attention costs {fmtT(fullAttn)} MACs per forward pass; T3&apos;s windows cost {fmtT(t3Attn)}.
          The projections and FFN, {fmtT(proj + ffn + rest)}, do not shrink at all, which is why the whole-DiT saving is
          smaller than the attention saving.
        </p>
      </div>
    </figure>
  )
}
