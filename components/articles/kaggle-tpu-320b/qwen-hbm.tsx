"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One TPU v5e chip serving Qwen3.8-27B in bf16 at tensor parallelism 8, as
// kaggle-tpu-lab's qwen38-27b recipe does (serve_qwen38.py: --tensor-parallel-size 8).
//
// Weights are exact: model.safetensors.index.json's total_size, 55,562,855,904
// bytes, every tensor BF16 (18 shard headers read by range request), divided
// evenly over 8 chips. That assumes nothing is replicated; norms are, but they
// are tiny, and if the 0.46B-parameter vision tower were replicated it would add
// about 0.8 GB a chip.
//
// KV cache from config.json: 16 full-attention layers (full_attention_interval
// 4 of 64), 4 KV heads, head_dim 256, bf16 -> 16 * 2 * 4 * 256 * 2 = 65,536 bytes
// a token for the whole model. With TP = 8 and only 4 KV heads, a runtime either
// splits them (8,192 B a token a chip) or gives every chip a copy of one head
// (16,384 B), which is what vLLM does on GPUs. I have not checked which one
// tpu-inference does, so both are offered.
//
// Gated-DeltaNet state: 48 linear-attention layers x 48 value heads x 128 x 128
// in float32 (mamba_ssm_dtype), plus the conv state (10,240 channels x 3 x bf16),
// 153.9 MB a sequence, sharded over 8 chips. With MTP k = 3 the repo's rollback
// patch keeps a full checkpoint per draft position; I count 4.
//
// 16.9 GB is what the GLM engine's hbm() reported as bytes_limit on chip 0.
// Only +, -, *, / and toFixed are used, so SSR and the browser agree.

const GB = 1e9
const LIMIT = 16.9 * GB
const WEIGHTS = 55_562_855_904 / 8
const KV_TOKEN_SPLIT = 8_192
const KV_TOKEN_REPL = 16_384
const GDN_SEQ = (150_994_944 + 2_949_120) / 8
const CTX = [32_768, 65_536, 131_072, 262_144]

const C = {
  weights: "#0369a1",
  kv: "#b45309",
  gdn: "#7c3aed",
  over: "oklch(0.63 0.19 25)",
}

const gb = (b: number) => (b / GB).toFixed(2)
const k = (n: number) => `${n / 1024}k`

export function QwenHbm() {
  const [ci, setCi] = useState(3)
  const [streams, setStreams] = useState(1)
  const [repl, setRepl] = useState(true)
  const [mtp, setMtp] = useState(true)

  const ctx = CTX[ci]
  const kv = streams * ctx * (repl ? KV_TOKEN_REPL : KV_TOKEN_SPLIT)
  const gdn = streams * GDN_SEQ * (mtp ? 4 : 1)
  const used = WEIGHTS + kv + gdn
  const left = LIMIT - used
  const scale = Math.max(used, LIMIT)

  const segs = [
    { label: "bf16 weights, 1/8 of 55.56 GB", v: WEIGHTS, c: C.weights },
    { label: `KV cache, ${streams} x ${k(ctx)} tokens`, v: kv, c: C.kv },
    { label: `DeltaNet state${mtp ? ", 4 checkpoints each" : ""}`, v: gdn, c: C.gdn },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.8-27B bf16 &middot; one v5e chip of eight &middot; 16.9 GB usable
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">from config.json and the safetensors index</span>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="relative flex h-10 w-full overflow-hidden rounded-md border"
          role="img"
          aria-label={`Per chip: ${segs.map((s) => `${s.label} ${gb(s.v)} GB`).join("; ")}. ${
            left >= 0 ? `${gb(left)} GB left` : `${gb(-left)} GB over`
          } of 16.9.`}
        >
          {segs.map((s) => (
            <div key={s.label} className="h-full" style={{ width: `${((s.v / scale) * 100).toFixed(3)}%`, background: s.c, opacity: 0.8 }} />
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${((LIMIT / scale) * 100).toFixed(3)}%` }} />
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {segs.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm" style={{ background: s.c, opacity: 0.8 }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="font-mono tabular-nums">{gb(s.v)} GB</span>
            </div>
          ))}
          <div className="flex items-baseline gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm bg-foreground/10" />
            <span className="min-w-0 flex-1 truncate">left for activations and XLA</span>
            <span className="font-mono tabular-nums" style={{ color: left < 1.5 * GB ? C.over : undefined }}>
              {left >= 0 ? `${gb(left)} GB` : `${gb(-left)} GB over`}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-md border bg-background/60 p-3 font-mono text-[11px] sm:grid-cols-2">
          <div>
            <div className="mb-1 text-muted-foreground">tokens held per stream</div>
            <div className="flex flex-wrap gap-1.5">
              {CTX.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={ci === i}
                  onClick={() => setCi(i)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] tabular-nums transition-colors",
                    ci === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k(c)}
                </button>
              ))}
            </div>
          </div>
          <label htmlFor="qwen-streams">
            <span className="flex justify-between text-muted-foreground">
              <span>streams holding that much</span>
              <span className="tabular-nums text-foreground">{streams}</span>
            </span>
            <input
              id="qwen-streams"
              type="range"
              min={1}
              max={16}
              step={1}
              value={streams}
              onChange={(e) => setStreams(Number(e.target.value))}
              className="mt-2 w-full accent-amber-600"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={repl} onChange={(e) => setRepl(e.target.checked)} />
            each chip holds a copy of one KV head (4 heads, 8 chips)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={mtp} onChange={(e) => setMtp(e.target.checked)} />
            MTP on, so the state is checkpointed per draft position
          </label>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          One request at the full 262,144 tokens needs 4.29 GB of KV cache a chip if the four KV heads are
          copied across eight chips, 2.15 GB if they are split. Either way it fits beside 6.95 GB of
          weights. Four requests at full length do not fit with copied heads, and only barely without;
          the runtime does not reserve that much, it shares one pool between whatever is running.
        </p>
      </div>
    </figure>
  )
}
