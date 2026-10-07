"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What an index of EmbeddingGemma 2 vectors costs in Qdrant, by width, bits per
// dimension and corpus size. The byte counts are Qdrant's: its EmbeddingGemma 2
// blog gives 3,072 bytes for a 768-d float32 vector and 104, 72 and 40 bytes for
// 1-bit TurboQuant at 768, 512 and 256 dimensions. Those are d/8 bytes of bits
// plus 8 bytes per vector, so a quantized vector here is d * bits / 8 + 8. The
// 8 bytes are per-vector scalars (Qdrant's TurboQuant write-up names an L2
// length and a renormalisation factor); I infer the size from the three counts.
//
// Retention is the blog's own chart: nDCG@10 as a share of exact 768-d float32
// search, averaged over five BEIR sets (SciFact, NFCorpus, ArguAna, SCIDOCS,
// FiQA), with 4x oversampling when rescoring. The 128-d 4-bit figure is from
// the blog's prose, which does not say whether it was rescored. Everything else
// is unmeasured and shown as such.
//
// The graph estimate is mine, not Qdrant's: HNSW with m = 16 keeps up to 2m = 32
// neighbour ids of 4 bytes at layer 0, an upper bound of 128 bytes a vector.
//
// Arithmetic is +, -, *, / and toFixed only, so SSR and the browser agree.

const DIMS = [768, 512, 256, 128] as const
const KINDS = [
  { k: "float32", bits: 32, quant: false },
  { k: "float16", bits: 16, quant: false },
  { k: "4-bit", bits: 4, quant: true },
  { k: "2-bit", bits: 2, quant: true },
  { k: "1-bit", bits: 1, quant: true },
] as const
const SIZES = [1, 2, 5, 10, 20, 50, 100] // millions of vectors
const OVERHEAD = 8
const BASE = 768 * 4
const GRAPH = 128

// [dims, kind] -> [no rescoring, rescoring]; null = not measured
const MEASURED: Record<string, [number | null, number | null]> = {
  "768/float32": [100, 100],
  "768/1-bit": [99.0, 99.7],
  "512/1-bit": [97.3, 98.8],
  "256/1-bit": [88.1, 94.5],
  "128/4-bit": [84.0, 84.0],
}

const C = {
  vec: "oklch(0.55 0.2 275)",
  graph: "oklch(0.7 0.12 160)",
  disk: "oklch(0.75 0.03 260)",
  warn: "oklch(0.63 0.19 25)",
}

function gb(bytes: number) {
  const g = bytes / 1e9
  return g >= 10 ? g.toFixed(1) : g.toFixed(2)
}

export function VectorRam() {
  const [di, setDi] = useState(2)
  const [ki, setKi] = useState(4)
  const [si, setSi] = useState(3)
  const [rescore, setRescore] = useState(true)

  const d = DIMS[di]
  const kind = KINDS[ki]
  const n = SIZES[si] * 1e6
  const per = kind.quant ? (d * kind.bits) / 8 + OVERHEAD : (d * kind.bits) / 8
  const ram = n * per
  const graph = n * GRAPH
  const originals = kind.quant && rescore ? n * d * 4 : 0
  const ratio = BASE / per
  const bitsOnly = kind.quant ? BASE / ((d * kind.bits) / 8) : ratio

  const key = `${d}/${kind.k}`
  const m = MEASURED[key]
  const kept = m ? (rescore && kind.quant ? m[1] : m[0]) : null
  const note128 = key === "128/4-bit"

  const scale = Math.max(ram + graph, n * BASE + graph)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">an index of EmbeddingGemma 2 vectors in Qdrant</span>
        <span className="font-mono text-[10px] text-muted-foreground">bytes and retention from Qdrant&apos;s blog, graph estimate mine</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-2">
        <div className="space-y-3 font-mono text-[11px]">
          <Pills label="dimensions kept (Matryoshka)" items={DIMS.map(String)} active={di} onPick={setDi} />
          <Pills label="storage per dimension" items={KINDS.map((x) => x.k)} active={ki} onPick={setKi} />
          <Pills label="vectors" items={SIZES.map((s) => `${s}M`)} active={si} onPick={setSi} />
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 text-muted-foreground",
              !kind.quant && "cursor-not-allowed opacity-50",
            )}
          >
            <input type="checkbox" checked={rescore} disabled={!kind.quant} onChange={(e) => setRescore(e.target.checked)} />
            rescore 4x oversampled candidates with the originals
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">RAM, against the 768-d float32 index</div>
            <Bar label="this index" parts={[{ v: ram, c: C.vec }, { v: graph, c: C.graph }]} scale={scale} />
            <Bar label="768 float32" parts={[{ v: n * BASE, c: C.vec }, { v: graph, c: C.graph }]} scale={scale} />
            <div className="mt-1 flex gap-3 font-mono text-[9.5px] text-muted-foreground">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: C.vec }} />vectors</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: C.graph }} />HNSW links, m = 16, at most</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <Cell label="bytes per vector" value={String(per)} sub={kind.quant ? `${(d * kind.bits) / 8} of bits + ${OVERHEAD} of scalars` : "no per-vector overhead"} />
            <Cell label="vector RAM" value={`${gb(ram)} GB`} sub={`${ratio.toFixed(1)}x less than 768 float32${kind.quant ? `; ${bitsOnly.toFixed(0)}x for the bits alone` : ""}`} />
            <Cell label="graph links" value={`${gb(graph)} GB`} sub="excluded from the blog's RAM figure" />
            <Cell
              label="originals for rescoring"
              value={originals > 0 ? `${gb(originals)} GB` : "none"}
              sub={originals > 0 ? `${d}-d float32, on disk, read per query` : "nothing to keep"}
            />
          </div>

          <div className="rounded-lg border bg-muted/15 px-3 py-2 font-mono text-[10px]">
            <div className="text-muted-foreground">nDCG@10 kept, five BEIR sets</div>
            <div className="mt-0.5 text-sm tabular-nums" style={{ color: kept === null ? C.warn : undefined }}>
              {kept === null ? "not measured" : `${kept.toFixed(1)}%`}
            </div>
            <div className="text-[9.5px] text-muted-foreground">
              {kept === null
                ? "Qdrant tested 1-bit at 768, 512 and 256, and 4-bit at 128"
                : note128
                  ? "from the blog's text; it does not say whether this was rescored"
                  : "text retrieval only; the corpora are far smaller than ten million"}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        At 256 dimensions and 1 bit, ten million vectors take 0.40 GB, which is the 77x. The eight bytes of
        per-vector scalars are a fifth of each 40-byte vector; without them the ratio would be 96x. The graph
        Qdrant searches over is left out of that figure, and at m = 16 it can be three times the size of the
        vectors it links.
      </p>
    </figure>
  )
}

function Pills({ label, items, active, onPick }: { label: string; items: string[]; active: number; onPick: (i: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={active === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] tabular-nums transition-colors",
              active === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bar({ label, parts, scale }: { label: string; parts: { v: number; c: string }[]; scale: number }) {
  const total = parts.reduce((a, p) => a + p.v, 0)
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">{label}</span>
      <div className="relative flex h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/40">
        {parts.map((p, i) => (
          <div key={i} className="h-full" style={{ width: `${((p.v / scale) * 100).toFixed(3)}%`, background: p.c, opacity: 0.85 }} />
        ))}
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{gb(total)} GB</span>
    </div>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}
