"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where "up to 9.5x" comes from, from the paper's own tables (arXiv 2610.42148,
// one H200, bfloat16, every prefix cache emptied before each level).
//
// Tokens: a request is a state of P tokens and n questions of mean length q.
//   one sequence per question:  n * (P + q)      (Table 2 "Sequences")
//   one flat stream:            P + n * q        (Table 2 "Stream")
// q is backed out of Table 2 as (Stream - State) / n.
//
// Latency: Table 3, Qwen3.5 instruct models, median latency of one request from
// a single client, Flide against the faster of vLLM and SGLang. "1.2k" style
// cells are the paper's rounding.
//
// Tokens computed: Table 13, Qwen3.5-0.8B, one request alone, behind each
// engine's endpoint. Only DI, QuALITY-all and MultiRC are in that table.

type Row = { lat: [number, number, number]; tag?: [string, string, string] }
type W = {
  id: string
  label: string
  state: number
  n: number
  stream: number
  seqs: number
  sizes: Record<string, Row> // [vLLM, SGLang, Flide]
  t13?: { vllm: number; sglang: number; flide: number; msV: number; msS: number; msF: number }
}

const WORK: W[] = [
  {
    id: "race1", label: "RACE, 1 question", state: 250, n: 1, stream: 325, seqs: 325,
    sizes: { "0.8B": { lat: [19.9, 27.0, 6.2] }, "4B": { lat: [24.6, 31.6, 10.9] }, "9B": { lat: [24.7, 32.6, 13.7] }, "27B": { lat: [48.2, 55.9, 41.2] } },
  },
  {
    id: "ql1", label: "QuALITY, 1 question", state: 3355, n: 1, stream: 3443, seqs: 3443,
    sizes: { "0.8B": { lat: [35.1, 35.3, 17.9] }, "4B": { lat: [68.6, 75.3, 62.3] }, "9B": { lat: [106, 117, 102] }, "27B": { lat: [337, 363, 340] } },
  },
  {
    id: "di", label: "Decision Index", state: 323, n: 5.4, stream: 1349, seqs: 3387,
    sizes: { "0.8B": { lat: [23.2, 28.6, 7.1] }, "4B": { lat: [27.7, 34.8, 11.9] }, "9B": { lat: [26.0, 33.2, 14.3] }, "27B": { lat: [48.7, 57.1, 41.1] } },
    t13: { vllm: 2098, sglang: 3268, flide: 1357, msV: 26.7, msS: 28.6, msF: 6.6 },
  },
  {
    id: "raceall", label: "RACE, all questions", state: 255, n: 4.0, stream: 546, seqs: 1283,
    sizes: { "0.8B": { lat: [47.3, 31.0, 7.2] }, "4B": { lat: [57.6, 37.4, 14.1] }, "9B": { lat: [60.1, 50.9, 20.4] }, "27B": { lat: [140, 134, 66.1] } },
  },
  {
    id: "qlall", label: "QuALITY, all questions", state: 5835, n: 18.1, stream: 7454, seqs: 107085,
    sizes: {
      "0.8B": { lat: [362, 359, 37.7] },
      "4B": { lat: [476, 727, 141] },
      "9B": { lat: [562, 1100, 232], tag: ["562", "1.1k", "232"] },
      "27B": { lat: [1200, 3300, 781], tag: ["1.2k", "3.3k", "781"] },
    },
    t13: { vllm: 12448, sglang: 30826, flide: 7460, msV: 537, msS: 359, msF: 38.1 },
  },
  {
    id: "mrc", label: "MultiRC", state: 327, n: 47.6, stream: 2663, seqs: 17808,
    sizes: {
      "0.8B": { lat: [154, 130, 16.8] },
      "4B": { lat: [281, 272, 50.3] },
      "9B": { lat: [308, 416, 81.1] },
      "27B": { lat: [656, 1100, 270], tag: ["656", "1.1k", "270"] },
    },
    t13: { vllm: 17314, sglang: 13358, flide: 2668, msV: 154, msS: 130, msF: 17.7 },
  },
]

const SIZES = ["0.8B", "4B", "9B", "27B"]
const BASE = "oklch(0.66 0.13 60)"
const FLIDE = "oklch(0.58 0.16 255)"
const NAIVE = "oklch(0.60 0.17 25)"

const f1 = (x: number) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(1))

export function SpeedupLedger() {
  const [wid, setWid] = useState("qlall")
  const [custom, setCustom] = useState(false)
  const [P, setP] = useState(2000)
  const [n, setN] = useState(16)
  const [q, setQ] = useState(40)

  const w = WORK.find((x) => x.id === wid) ?? WORK[0]
  const qbar = custom ? q : (w.stream - w.state) / w.n
  const st = custom ? P : w.state
  const nn = custom ? n : w.n
  const naive = nn * (st + qbar)
  const forked = st + nn * qbar
  const ratio = naive / forked
  const maxTok = Math.max(naive, forked, w.t13 && !custom ? Math.max(w.t13.vllm, w.t13.sglang) : 0)
  const bar = (v: number) => `${Math.max(0.6, (v / maxTok) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tokens a request costs, and what the paper measured</span>
        <span className="font-mono text-[10px] text-muted-foreground">Tables 2, 3 and 13 · Qwen3.5 · one H200</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-3 sm:px-4">
        {WORK.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => { setWid(x.id); setCustom(false) }}
            aria-pressed={!custom && wid === x.id}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              !custom && wid === x.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          aria-pressed={custom}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            custom ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          your own request
        </button>
      </div>

      {custom && (
        <div className="grid gap-3 px-3 pt-3 sm:grid-cols-3 sm:px-4">
          <label className="block font-mono text-[11px] text-muted-foreground">
            state P = {P.toLocaleString("en-US")} tokens
            <Range min={100} max={16000} step={100} value={P} onChange={(e) => setP(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            questions n = {n}
            <Range min={1} max={256} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            tokens per question q = {q}
            <Range min={5} max={300} step={5} value={q} onChange={(e) => setQ(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>
      )}

      <div className="space-y-2 p-3 font-mono text-[11px] sm:p-4">
        <div className="text-muted-foreground">
          P = {Math.round(st).toLocaleString("en-US")}, n = {nn}, q̄ = {qbar.toFixed(1)} · forking computes {ratio.toFixed(2)}x fewer tokens than one
          sequence per question
        </div>
        {[
          { l: "one sequence per question  n(P+q̄)", v: naive, c: NAIVE },
          ...(w.t13 && !custom
            ? [
                { l: "vLLM, measured (Table 13, 0.8B)", v: w.t13.vllm, c: BASE },
                { l: "SGLang, measured (Table 13, 0.8B)", v: w.t13.sglang, c: BASE },
              ]
            : []),
          { l: "one flat stream  P+nq̄", v: forked, c: FLIDE },
        ].map((r) => (
          <div key={r.l}>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>{r.l}</span>
              <span className="text-foreground">{Math.round(r.v).toLocaleString("en-US")}</span>
            </div>
            <div className="mt-0.5 h-2.5 rounded-sm bg-muted/40">
              <div className="h-2.5 rounded-sm" style={{ width: bar(r.v), background: r.c }} />
            </div>
          </div>
        ))}
        {w.t13 && !custom && (
          <div className="pt-1 text-muted-foreground">
            On 0.8B, one request alone: vLLM {w.t13.msV} ms, SGLang {w.t13.msS} ms, Flide {w.t13.msF} ms. Token ratio to Flide{" "}
            {(Math.min(w.t13.vllm, w.t13.sglang) / w.t13.flide).toFixed(1)}x; time ratio{" "}
            {(Math.min(w.t13.msV, w.t13.msS) / w.t13.msF).toFixed(1)}x. The gap between those two is front end, scheduling and launches,
            not arithmetic.
          </div>
        )}
      </div>

      {!custom && (
        <div className="border-t p-3 sm:p-4">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">
            median latency of one request, single client, ms (Table 3) · Flide&apos;s lead over the faster baseline
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SIZES.map((s) => {
              const r = w.sizes[s]
              const best = Math.min(r.lat[0], r.lat[1])
              const lead = best / r.lat[2]
              const top = Math.max(r.lat[0], r.lat[1], r.lat[2])
              const tag = r.tag ?? r.lat.map((x) => f1(x))
              return (
                <div key={s} className="rounded-md border px-2.5 py-2">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Qwen3.5-{s}</span>
                    <span style={{ color: lead >= 2 ? FLIDE : undefined }} className={lead < 2 ? "text-muted-foreground" : ""}>
                      {lead.toFixed(lead >= 10 ? 0 : 2)}x
                    </span>
                  </div>
                  {["vLLM", "SGLang", "Flide"].map((e, i) => (
                    <div key={e} className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span className="w-12 shrink-0">{e}</span>
                      <div className="h-2 flex-1 rounded-sm bg-muted/40">
                        <div className="h-2 rounded-sm" style={{ width: `${Math.max(1, (r.lat[i] / top) * 100).toFixed(2)}%`, background: i === 2 ? FLIDE : BASE }} />
                      </div>
                      <span className="w-10 shrink-0 text-right">{tag[i]}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            Cells the paper prints as 1.1k, 1.2k or 3.3k are taken at that rounding, so leads computed from them are approximate.
          </div>
        </div>
      )}
    </figure>
  )
}
