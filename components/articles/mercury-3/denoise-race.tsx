"use client"

import { useEffect, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Left-to-right autoregression against block diffusion, on the same 24-token
// answer, counted in forward passes.
//
// A toy, not Mercury: Inception has not published Mercury 3's sampler, block
// size or step count. The diffusion row follows the block-diffusion recipe the
// site's masked-diffusion explainer describes: the answer is cut into blocks,
// every masked slot in the current block is predicted on every pass, the k most
// confident predictions are committed, and the next block starts only when this
// one is full. The "confidence" is a fixed made-up number per slot, and a slot
// predicted before it is committed shows a draft that may be wrong (the
// marginals-not-joint problem), which is what Inception's `diffusing` stream
// mode shows a viewer. Arithmetic is + - * / and integer ops only, so server
// and client render the same markup.

const TOKENS = [
  "The", "model", "drafts", "a", "whole", "block", "of", "text", ",", "then",
  "refines", "it", "until", "no", "mask", "is", "left", ";", "the", "next",
  "block", "follows", ".", "[end]",
]
// Plausible-but-wrong drafts a slot shows before enough context is fixed.
const DRAFTS = [
  "A", "net", "writes", "the", "full", "line", "in", "code", ".", "and",
  "fixes", "them", "while", "each", "token", "was", "done", ",", "a", "last",
  "line", "starts", "!", "[end]",
]
const N = TOKENS.length

function lcg(seed: number, n: number): number[] {
  const out: number[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    out.push(s / 2147483648)
  }
  return out
}
// Punctuation and function words come out confident early; content words late.
const BASE = lcg(5, N)
const CONF = TOKENS.map((t, i) => {
  const easy = t.length <= 2 || t === "the" || t === "The" || t === "[end]"
  return (easy ? 0.6 : 0.1) + 0.4 * BASE[i]
})

type Slot = { state: "done" | "new" | "draft" | "mask" | "waiting"; text: string }

// Commit pass index for every slot under (block size B, k commits per pass).
function commitSchedule(B: number, k: number): { at: number[]; passes: number; blockOf: number[]; startOf: number[] } {
  const at = new Array<number>(N).fill(0)
  const blockOf = new Array<number>(N).fill(0)
  const startOf: number[] = []
  let pass = 0
  for (let b = 0; b * B < N; b++) {
    const lo = b * B
    const hi = Math.min(N, lo + B)
    startOf.push(pass + 1)
    const idx: number[] = []
    for (let i = lo; i < hi; i++) {
      idx.push(i)
      blockOf[i] = b
    }
    idx.sort((a, c) => CONF[c] - CONF[a])
    for (let j = 0; j < idx.length; j++) at[idx[j]] = pass + 1 + Math.floor(j / k)
    pass += Math.ceil(idx.length / k)
  }
  return { at, passes: pass, blockOf, startOf }
}

const BLOCKS = [4, 8, 12, 24]
const KS = [1, 2, 3, 4]

export function DenoiseRace() {
  const [B, setB] = useState(8)
  const [k, setK] = useState(2)
  const [pass, setPass] = useState(6)
  const [playing, setPlaying] = useState(false)

  const sched = useMemo(() => commitSchedule(B, k), [B, k])
  const maxPass = Math.max(N, sched.passes)
  const p = Math.min(pass, maxPass)

  const running = playing && p < maxPass

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setPass((v) => Math.min(v + 1, maxPass))
    }, 420)
    return () => window.clearInterval(id)
  }, [running, maxPass])

  const ar: Slot[] = TOKENS.map((t, i) => {
    if (i < p - 1) return { state: "done", text: t }
    if (i === p - 1) return { state: "new", text: t }
    return { state: "waiting", text: "" }
  })

  const activeBlock = (() => {
    for (let i = 0; i < N; i++) if (sched.at[i] > p) return sched.blockOf[i]
    return -1
  })()

  const diff: Slot[] = TOKENS.map((t, i) => {
    const at = sched.at[i]
    if (at < p) return { state: "done", text: t }
    if (at === p) return { state: "new", text: t }
    if (sched.blockOf[i] !== activeBlock) return { state: "waiting", text: "" }
    // In the active block: a draft once a pass has run on it. Early drafts of
    // low-confidence slots are wrong; they settle as their neighbours commit.
    const started = p >= sched.startOf[sched.blockOf[i]]
    if (!started) return { state: "mask", text: "" }
    const progress = (p - sched.startOf[sched.blockOf[i]] + 1) / Math.max(1, at - sched.startOf[sched.blockOf[i]] + 1)
    const right = CONF[i] + 0.5 * progress > 0.75
    return { state: "draft", text: right ? t : DRAFTS[i] }
  })

  const arDone = Math.min(p, N)
  const diffDone = sched.at.filter((a) => a <= p).length
  const perPass = N / sched.passes

  const reset = () => {
    setPlaying(false)
    setPass(0)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one answer, two ways to write it</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy sampler · not Mercury&apos;s, which is unpublished</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <Row label="autoregressive" sub="1 token per pass" slots={ar} />
        <Row label="block diffusion" sub={`${k} per pass, blocks of ${B}`} slots={diff} blockSize={B} />

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>forward passes so far</span>
              <span className="text-foreground">
                {p} of {maxPass}
              </span>
            </span>
            <Range
              min={0}
              max={maxPass}
              step={1}
              value={p}
              onChange={(e) => {
                setPlaying(false)
                setPass(Number(e.target.value))
              }}
              aria-label="Forward passes so far"
              className="mt-1.5 w-full"
            />
          </label>
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (running) {
                  setPlaying(false)
                  return
                }
                if (p >= maxPass) setPass(0)
                setPlaying(true)
              }}
              className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] hover:bg-muted/40"
            >
              {running ? "pause" : "play"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Chips label="block size" values={BLOCKS} value={B} onPick={(v) => setB(v)} />
          <Chips label="commits per pass" values={KS} value={k} onPick={(v) => setK(v)} />
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">passes to finish</div>
            <div className="text-base text-foreground">
              {N} <span className="text-[10px] text-muted-foreground">vs</span> {sched.passes}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">tokens per pass, diffusion</div>
            <div className="text-base text-foreground">{perPass.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">committed after pass {p}</div>
            <div className="text-foreground">
              AR {arDone} · diffusion {diffDone} of {N}
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Faint words are drafts: predictions for still-masked slots, shown before they are committed, and some are
          wrong. A pass here is not the same cost in both rows: the diffusion pass runs the whole block, but on a
          memory-bound GPU reading the weights once dominates either way. Block size 24 is one block, the whole answer.
        </p>
      </div>
    </figure>
  )
}

function Row({ label, sub, slots, blockSize }: { label: string; sub: string; slots: Slot[]; blockSize?: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{sub}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {slots.map((s, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex h-7 min-w-[2.1rem] items-center justify-center rounded-md border px-1.5 font-mono text-[11px] transition-colors",
              blockSize && i > 0 && i % blockSize === 0 && "ml-2",
              s.state === "done" && "border-foreground/20 bg-muted/40 text-foreground",
              s.state === "new" && "border-[oklch(0.62_0.15_170)] bg-[oklch(0.62_0.15_170_/_0.18)] text-foreground",
              s.state === "draft" && "border-dashed border-foreground/30 text-muted-foreground/70 italic",
              s.state === "mask" && "border-dashed border-foreground/30 text-muted-foreground/60",
              s.state === "waiting" && "border-dashed border-foreground/10 text-muted-foreground/30",
            )}
          >
            {s.state === "mask" ? "▒" : s.state === "waiting" ? "·" : s.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function Chips({ label, values, value, onPick }: { label: string; values: number[]; value: number; onPick: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          aria-pressed={value === v}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors",
            value === v
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
