"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What the three --hicache-storage-prefetch-policy values do when a request
// whose prefix sits in L3 reaches the front of the queue before its read is
// done. The decision is UnifiedRadixCache._can_terminate_prefetch:
//   best_effort   -> terminate now, keep whatever has landed in host memory
//   wait_complete -> never terminate; the request waits for the whole read
//   timeout       -> terminate once the wait passes
//                    prefetch_timeout_base + pages * prefetch_timeout_per_page
//                    = 1.0 s + 0.25 s per 1,024 tokens (the defaults, set in
//                    storage_attachment.py from prefetch_timeout_per_ki_token)
// A prefix shorter than storage_prefetch_threshold (256 tokens) is not
// prefetched at all.
// The timing model is deliberately plain: reads stream at a fixed rate,
// prefill costs a fixed time per token, and the Host -> GPU load is ignored.

const NEW_TOKENS = 4096
const TIMEOUT_BASE = 1.0
const TIMEOUT_PER_KI = 0.25
const THRESHOLD = 256

type Row = { name: string; wait: number; reused: number; recompute: number; ttft: number }

export function PrefetchPolicy() {
  const [prefixK, setPrefixK] = useState(32)
  const [readK, setReadK] = useState(20)
  const [prefillK, setPrefillK] = useState(10)
  const [head, setHead] = useState(0.5)

  const X = prefixK * 1024
  const read = readK * 1000
  const prefill = prefillK * 1000
  const landedAt = (t: number) => Math.min(X, Math.floor((t * read) / 64) * 64)
  const needWait = Math.max(0, X / read - head)
  const limit = TIMEOUT_BASE + TIMEOUT_PER_KI * (X / 1024)

  const row = (name: string, wait: number): Row => {
    const reused = X < THRESHOLD ? 0 : landedAt(head + wait)
    const recompute = X - reused + NEW_TOKENS
    return { name, wait, reused, recompute, ttft: wait + recompute / prefill }
  }
  const rows: Row[] = [
    row("best_effort", 0),
    row("wait_complete", needWait),
    row("timeout", Math.min(needWait, limit)),
  ]
  const fastest = Math.min(...rows.map((r) => r.ttft))
  const maxT = Math.max(...rows.map((r) => r.ttft))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          prefix in L3, request reaches the head of the queue
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          timeout limit here: {limit.toFixed(2)} s
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">cached prefix in L3: {prefixK}K tokens</span>
          <Range min={1} max={128} step={1} value={prefixK} onChange={(e) => setPrefixK(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">L3 read rate: {readK}K tokens/s</span>
          <Range min={2} max={200} step={2} value={readK} onChange={(e) => setReadK(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">prefill rate: {prefillK}K tokens/s</span>
          <Range min={2} max={100} step={1} value={prefillK} onChange={(e) => setPrefillK(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            prefetch head start while queued: {head.toFixed(1)} s
          </span>
          <Range min={0} max={5} step={0.1} value={head} onChange={(e) => setHead(Number(e.target.value))} />
        </label>
      </div>
      <div className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
            <span className="font-mono text-[11px]">{r.name}</span>
            <div>
              <div className="flex h-4 w-full overflow-hidden rounded bg-muted/40">
                <div
                  title="waiting for L3"
                  style={{ width: `${((r.wait / maxT) * 100).toFixed(2)}%`, background: "oklch(0.72 0.12 85)" }}
                />
                <div
                  title="prefill"
                  style={{ width: `${(((r.ttft - r.wait) / maxT) * 100).toFixed(2)}%`, background: "oklch(0.58 0.15 255)" }}
                />
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                wait {r.wait.toFixed(2)} s · reuse {(r.reused / 1024).toFixed(1)}K · prefill{" "}
                {(r.recompute / 1024).toFixed(1)}K · first token at {r.ttft.toFixed(2)} s
                {r.ttft === fastest ? " · fastest" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Yellow is waiting for storage, blue is prefill of whatever was not reused plus a 4K-token new
        turn. A toy timing model with SGLang&apos;s default timeout constants; real reads arrive in
        batches and the Host-to-GPU load overlaps with compute layer by layer.
      </figcaption>
    </figure>
  )
}
