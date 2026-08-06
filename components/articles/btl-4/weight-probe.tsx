"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What BTL-4 actually changed relative to its declared base, Ornith-1.0-35B,
// measured without downloading either 70 GB checkpoint. Method: read each
// shard's safetensors header (first 8 bytes = header length, then that many
// bytes of JSON), which gives every tensor's dtype and byte offsets; then issue
// an HTTP Range request for the first N bytes of a chosen tensor in both repos
// and compare hashes.
//
// The trap, and the reason the "measured" tab exists: on the first pass every
// normalization weight looked CHANGED. It wasn't. BTL-4 stores norms as F32
// where Ornith stores BF16, so the byte comparison was between 8192 bytes of
// F32 and 4096 of BF16. Those rows are excluded, not counted. The whole
// file-size difference between the two checkpoints — 603,136 bytes — is exactly
// that upcast: 301,568 F32 params x 2 extra bytes each.

const CHANGED = "oklch(0.58 0.19 25)"
const SAME = "oklch(0.60 0.15 255)"
const SKIP = "oklch(0.62 0.03 250)"

type Verdict = "changed" | "same" | "skipped"

type Row = {
  group: string
  detail: string
  n: number
  verdict: Verdict
  covered: string
}

const ROWS: Row[] = [
  { group: "expert MLP · gate_proj", detail: "layers 0, 10, 20, 39", n: 4, verdict: "changed", covered: "256 KB of 2 MB" },
  { group: "expert MLP · down_proj", detail: "layers 0, 20, 39", n: 3, verdict: "changed", covered: "256 KB of 2 MB" },
  { group: "shared expert · up_proj", detail: "layers 0, 20, 39", n: 3, verdict: "changed", covered: "256 KB of 2 MB" },
  { group: "linear-attn · in_proj_qkv", detail: "layers 0, 20, 30", n: 3, verdict: "changed", covered: "256 KB of 32 MB" },
  { group: "full-attn · q_proj", detail: "layers 3, 39", n: 2, verdict: "changed", covered: "256 KB of 32 MB" },
  { group: "MoE router · mlp.gate", detail: "layers 0, 10, 20, 30, 39", n: 5, verdict: "same", covered: "256 KB of 1 MB" },
  { group: "linear-attn · A_log", detail: "layers 0, 10, 20, 30", n: 4, verdict: "same", covered: "all 64 bytes" },
  { group: "linear-attn · dt_bias", detail: "layers 0, 10, 20, 30", n: 4, verdict: "same", covered: "all 64 bytes" },
  { group: "vision tower", detail: "blocks 0, 13, 26 + merger", n: 4, verdict: "same", covered: "256 KB each" },
  { group: "embed_tokens + lm_head", detail: "both, 993 MB each", n: 2, verdict: "same", covered: "256 KB of 993 MB" },
  { group: "every normalization weight", detail: "F32 in BTL-4, BF16 in Ornith", n: 12, verdict: "skipped", covered: "not comparable" },
]

const LABEL: Record<Verdict, string> = { changed: "changed", same: "unchanged", skipped: "excluded" }
const COLOR: Record<Verdict, string> = { changed: CHANGED, same: SAME, skipped: SKIP }

export function WeightProbe() {
  const [tab, setTab] = useState<"result" | "method">("result")

  const changed = ROWS.filter((r) => r.verdict === "changed").reduce((a, r) => a + r.n, 0)
  const same = ROWS.filter((r) => r.verdict === "same").reduce((a, r) => a + r.n, 0)

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">BTL-4 vs Ornith-1.0-35B · tensor diff</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("result")} className={chip(tab === "result")}>
            what moved
          </button>
          <button type="button" onClick={() => setTab("method")} className={chip(tab === "method")}>
            how it was measured
          </button>
        </div>
      </div>

      {tab === "result" ? (
        <div className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
            {(["changed", "same", "skipped"] as Verdict[]).map((v) => (
              <span key={v} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[v] }} /> {LABEL[v]}
              </span>
            ))}
            <span className="ml-auto tabular-nums">
              {changed} changed · {same} unchanged
            </span>
          </div>

          <div className="space-y-1">
            {ROWS.map((r) => (
              <div
                key={r.group}
                className="grid grid-cols-1 items-center gap-x-3 gap-y-0.5 rounded-lg border bg-muted/15 px-3 py-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,11rem)_auto_1fr]"
              >
                <span className="truncate font-mono text-[11px] text-foreground">{r.group}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{r.detail}</span>
                <span
                  className="w-fit rounded-full px-2 py-0.5 font-mono text-[10px]"
                  style={{ background: COLOR[r.verdict], color: "white" }}
                >
                  {LABEL[r.verdict]}
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground/80">{r.covered}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Every projection matrix moved. Nothing else did. Routers, token embeddings, the output head, the entire
            27-layer vision tower, and the linear-attention decay parameters are byte-identical to Ornith&rsquo;s over
            every window sampled. That is not what a full fine-tune looks like — it is the exact target set a{" "}
            <span className="text-foreground">LoRA</span>{" "}adapts, merged back down. Which agrees with the two things
            BTL-4&rsquo;s own <span className="font-mono text-foreground">config.json</span>{" "}says out loud:{" "}
            <span className="font-mono text-foreground">unsloth_version</span>{" "}and a{" "}
            <span className="font-mono text-foreground">model_name</span>{" "}of{" "}
            <span className="font-mono text-foreground">/vol/merged/btl4-pilot</span>.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="space-y-2">
            {[
              {
                n: "1",
                t: "read the header, not the weights",
                d: "A safetensors file starts with 8 bytes of header length, then that many bytes of JSON listing every tensor's dtype, shape, and byte offsets. Two Range requests per shard — a few kilobytes — and you have the full layout of a 70 GB checkpoint.",
              },
              {
                n: "2",
                t: "range-request one tensor from each side",
                d: "The index file says which shard holds a given tensor; the header says where inside it. Ask for that byte span in both repos and hash what comes back. Nothing is downloaded except the bytes being compared.",
              },
              {
                n: "3",
                t: "refuse to compare across dtypes",
                d: "The first pass reported every norm as changed. They are stored F32 in BTL-4 and BF16 in Ornith, so the comparison was 8192 bytes against 4096 — a formatting difference read as a training signal. Those rows are excluded here rather than counted.",
              },
              {
                n: "4",
                t: "check the arithmetic closes",
                d: "The two checkpoints differ in total size by 603,136 bytes. BTL-4 reports exactly 301,568 F32 parameters and Ornith reports none. 301,568 x 2 extra bytes = 603,136. The whole size delta is the upcast, which is what makes step 3 a correction rather than a guess.",
              },
            ].map((s) => (
              <div key={s.n} className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border bg-muted/15 px-3 py-2.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-white"
                  style={{ background: SAME }}
                >
                  {s.n}
                </span>
                <div>
                  <div className="font-mono text-[11px] text-foreground">{s.t}</div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            What this method can and cannot show: a <em>difference</em>{" "}in any sampled window is conclusive — those
            weights changed. <em>Sameness</em>{" "}is only as strong as the window, and for the billion-parameter
            embedding and output tensors that window is the first 256 KB of 993 MB. The consistency of the pattern
            across ten independent groups is what makes it a finding rather than a coincidence.
          </p>
        </div>
      )}
    </figure>
  )
}
