"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { MIB, RECORD_BYTES, STATE_BYTES, drawAccept, mulberry32, ringInit, ringStep, type Cell, type RingState } from "./sim"

// The replay buffer under speculative decoding, step by step. Each press runs
// one verification step of the paper's Algorithm 2 with T tokens: append T input
// records behind the h committed ones, flush the committed prefix into the
// checkpoint if h + T > L, return the outputs, then commit the accepted prefix
// by moving h. Rejected records are left where they are and overwritten next
// time. Bytes are per layer per sequence at the Nemotron-3-Super Mamba-2 shape
// (one FP32 state 4 MiB, one record 18,944 B), counted the way the paper's
// Appendix A counts them: vLLM's snapshot path reads one state and writes T.

type Log = { step: number; flush: boolean; folded: number; a: number; T: number }

const chip = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const cellClass: Record<Cell, string> = {
  empty: "border-dashed border-border bg-transparent",
  committed: "border-sky-600/60 bg-sky-500/25 dark:border-sky-400/60",
  accepted: "border-emerald-600/70 bg-emerald-500/30 dark:border-emerald-400/70",
  rejected: "border-border bg-muted/60 opacity-60 [background-image:repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(127,127,127,.35)_3px,rgba(127,127,127,.35)_5px)]",
}

const fmt = (b: number) => (b / MIB).toFixed(2)

export function ReplayRing() {
  const [L, setL] = useState(16)
  const [T, setT] = useState(4)
  const [p, setP] = useState(0.8)
  const [s, setS] = useState<RingState>(() => ringInit(16, 4))
  const [log, setLog] = useState<Log[]>([])
  const [seed, setSeed] = useState(7)

  const reset = (nl: number, nt: number) => {
    setL(nl)
    setT(nt)
    setS(ringInit(nl, nt))
    setLog([])
    setSeed(7)
  }

  const step = (a: number) => {
    const next = ringStep(s, L, T, a)
    setS(next)
    setLog((g) => [{ step: next.steps, flush: next.lastFlush, folded: next.lastFolded, a: next.lastAccepted, T }, ...g].slice(0, 4))
  }

  const auto = (n: number) => {
    const rand = mulberry32(seed)
    let cur = s
    const entries: Log[] = []
    for (let i = 0; i < n; i++) {
      cur = ringStep(cur, L, T, drawAccept(rand, T, p))
      entries.unshift({ step: cur.steps, flush: cur.lastFlush, folded: cur.lastFolded, a: cur.lastAccepted, T })
    }
    setSeed((x) => x + 101)
    setS(cur)
    setLog((g) => [...entries, ...g].slice(0, 4))
  }

  const perTokReplay = s.tokens ? s.replayBytes / s.tokens : 0
  const perTokSnap = s.tokens ? s.snapBytes / s.tokens : 0
  const standard = 2 * STATE_BYTES // conventional standard decoding: one read, one write per token
  const maxBar = Math.max(perTokSnap, standard, perTokReplay, 1)
  const memSnap = T * STATE_BYTES
  const memReplay = STATE_BYTES + (L + T) * RECORD_BYTES

  const summary =
    s.steps === 0
      ? `Empty buffer of ${L} committed slots plus ${T} for the tokens being verified.`
      : `After ${s.steps} steps, ${s.tokens} tokens committed and ${s.flushes} flushes. ReplaySSM moved ${fmt(perTokReplay)} MiB of state traffic per committed token, vLLM's snapshots ${fmt(perTokSnap)} MiB.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the replay buffer under speculative decoding</span>
        <span className="text-muted-foreground/60">one Mamba-2 layer, one sequence, Nemotron-3-Super shape</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>window L:</span>
        {[8, 16].map((v) => (
          <button key={v} type="button" aria-pressed={L === v} onClick={() => reset(v, T)} className={chip(L === v)}>
            {v}
          </button>
        ))}
        <span>tokens verified per step T:</span>
        {[1, 2, 4, 8].map((v) => (
          <button key={v} type="button" aria-pressed={T === v} onClick={() => reset(L, v)} className={chip(T === v)}>
            {v}
          </button>
        ))}
        <button type="button" onClick={() => reset(L, T)} className={chip(false)}>
          reset
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-4 pt-2 font-mono text-[11px] text-muted-foreground">
        <span>verify one step, verifier accepts:</span>
        {Array.from({ length: T }, (_, i) => i + 1).map((a) => (
          <button key={a} type="button" onClick={() => step(a)} className={chip(false)}>
            a = {a}
          </button>
        ))}
        <span className="pl-2">or run 20 steps with draft acceptance</span>
        <select
          value={p}
          onChange={(e) => setP(Number(e.target.value))}
          className="rounded border bg-background px-1.5 py-0.5 text-foreground"
          aria-label="Per-draft acceptance probability"
          disabled={T === 1}
        >
          {[0.5, 0.8, 0.95].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => auto(20)} className={chip(false)}>
          +20 steps
        </button>
      </div>

      <div className="px-4 py-4" role="img" aria-label={summary}>
        <div className="flex items-stretch gap-3">
          <div
            className={cn(
              "flex w-20 shrink-0 flex-col items-center justify-center rounded-md border-2 px-1 py-2 text-center font-mono text-[10px] transition-colors",
              s.lastFlush ? "border-red-600/70 bg-red-500/15 dark:border-red-400/70" : "border-amber-700/50 bg-amber-500/15",
            )}
          >
            <span className="text-[11px] text-foreground">
              S<sub>ckpt</sub>
            </span>
            <span className="text-muted-foreground">4 MiB</span>
            <span className={s.lastFlush ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}>
              {s.lastFlush ? "written now" : "read only"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${L + T}, minmax(0, 1fr))` }}>
              {s.cells.map((c, i) => (
                <div
                  key={i}
                  className={cn("h-7 rounded-sm border transition-colors", cellClass[c])}
                  title={`slot ${i + 1}: ${c}`}
                />
              ))}
            </div>
            <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
              <span
                className="absolute -translate-x-1/2 text-sky-700 transition-all dark:text-sky-300"
                style={{ left: `${(s.h / (L + T)) * 100}%` }}
              >
                ▲ h = {s.h}
              </span>
              <span
                className="absolute -translate-x-1/2 text-muted-foreground/70"
                style={{ left: `${(L / (L + T)) * 100}%` }}
              >
                | L
              </span>
            </div>
            <p className="my-0 mt-1 font-mono text-[10px] text-muted-foreground">
              <span className="text-sky-700 dark:text-sky-300">blue</span> committed record,{" "}
              <span className="text-emerald-700 dark:text-emerald-300">green</span> accepted this step,{" "}
              hatched rejected (left in place, overwritten next step), dashed empty
            </p>
          </div>
        </div>

        <div className="mt-3 min-h-[4.5rem] space-y-0.5 font-mono text-[10.5px]">
          {log.length === 0 ? (
            <p className="my-0 text-muted-foreground">Press a button. Nothing has been verified yet.</p>
          ) : (
            log.map((g, i) => (
              <p key={g.step} className={cn("my-0", i === 0 ? "text-foreground" : "text-muted-foreground/70")}>
                step {g.step}: appended {g.T} record{g.T > 1 ? "s" : ""}
                {g.flush ? `; h + T > L, so the ${g.folded} committed record${g.folded === 1 ? "" : "s"} were folded into the checkpoint and it was written once` : "; no state written"}
                {g.T > 1 ? `; ${g.a} accepted, ${g.T - g.a} rejected by moving the pointer` : ""}
              </p>
            ))
          )}
        </div>

        <div className="mt-3 space-y-1.5 border-t pt-3 font-mono text-[10.5px]">
          <p className="my-0 text-muted-foreground">
            state traffic per committed token, MiB ({s.tokens} tokens, {s.steps} steps, {s.flushes} flushes)
          </p>
          {[
            { label: "vLLM snapshots, 1R + T·W", v: perTokSnap, cls: "bg-orange-500/60" },
            { label: "standard decode, 1R + 1W", v: standard, cls: "bg-foreground/30" },
            { label: "ReplaySSM", v: perTokReplay, cls: "bg-sky-500/60" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-44 shrink-0 truncate text-muted-foreground sm:w-52">{r.label}</span>
              <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                <div className={cn("absolute inset-y-0 left-0 rounded-sm", r.cls)} style={{ width: `${(r.v / maxBar) * 100}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums">{s.tokens || r.label.startsWith("standard") ? fmt(r.v) : "–"}</span>
            </div>
          ))}
          <p className="my-0 pt-1 text-muted-foreground">
            state memory each request holds: snapshots {fmt(memSnap)} MiB, ReplaySSM {fmt(memReplay)} MiB (checkpoint plus{" "}
            {L + T} records)
          </p>
        </div>
      </div>
    </figure>
  )
}
