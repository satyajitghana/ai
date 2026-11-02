"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Byte arithmetic for a vector index, one row per thing that has to sit on disk.
//   vectors   N x d x 4 B                      (fp32; this is what LEANN throws away)
//   HNSW graph  N x (2M neighbour slots x 4 B)  (faiss pads level 0 to 2M ids per node whether or not they are used)
//   LEANN graph N x (average degree x 4 B)      (CSR: only the edges that exist, plus an offsets array)
//   PQ table    N x pqBytes                     (the paper's second component; the shipped hnsw backend does not build one)
// Reported by the paper for 60M chunks of 768-d Contriever vectors: HNSW 188 GB = 173 vectors + 15 graph,
// LEANN 4 GB = 2 graph + 2 PQ. Measured by me on 20,000 chunks of 384-d MiniLM vectors: see data.ts.

const PRESETS = [
  { id: "mine", label: "My run", n: 20_000, d: 384 },
  { id: "dpr", label: "DPR, 2.1M", n: 2_100_000, d: 768 },
  { id: "wiki", label: "Wiki, 60M", n: 60_000_000, d: 768 },
] as const

const GB = 1e9

function fmt(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes >= 10 * GB ? 0 : 1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function Row(props: { label: string; bytes: number; max: number; color: string; note: string }) {
  const { label, bytes, max, color, note } = props
  const pct = Math.min(100, Math.max(0.4, (bytes / max) * 100))
  return (
    <div className="grid grid-cols-[7.5rem_1fr_5rem] items-center gap-2 text-xs">
      <span className="font-mono text-muted-foreground">{label}</span>
      <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={`${label}: ${fmt(bytes)}. ${note}`}>
        <div className="h-full" style={{ width: `${pct.toFixed(2)}%`, background: color }} />
      </div>
      <span className="text-right font-mono tabular-nums">{fmt(bytes)}</span>
    </div>
  )
}

export function StorageLedger() {
  const [pid, setPid] = useState<(typeof PRESETS)[number]["id"]>("wiki")
  const [m, setM] = useState(32)
  const [deg, setDeg] = useState(9)
  const [pq, setPq] = useState(33)
  const p = PRESETS.find((x) => x.id === pid) ?? PRESETS[2]

  const vectors = p.n * p.d * 4
  const hnswGraph = p.n * 2 * m * 4
  const leannGraph = p.n * deg * 4
  const leannPq = p.n * pq
  const hnsw = vectors + hnswGraph
  const leann = leannGraph + leannPq
  const max = hnsw

  return (
    <figure className="not-prose my-8 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Corpus size">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPid(x.id)}
            aria-pressed={pid === x.id}
            className={`rounded border px-2.5 py-1 font-mono text-xs ${pid === x.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mb-4 grid gap-2">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">HNSW M</span>
          <Range min={8} max={64} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="HNSW M" className="w-full" />
          <span className="w-12 text-right font-mono tabular-nums">{m}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">LEANN average degree</span>
          <Range min={4} max={32} step={1} value={deg} onChange={(e) => setDeg(Number(e.target.value))} aria-label="Average degree" className="w-full" />
          <span className="w-12 text-right font-mono tabular-nums">{deg}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">PQ bytes per vector</span>
          <Range min={0} max={96} step={1} value={pq} onChange={(e) => setPq(Number(e.target.value))} aria-label="PQ bytes per vector" className="w-full" />
          <span className="w-12 text-right font-mono tabular-nums">{pq}</span>
        </label>
      </div>
      <div className="grid gap-1.5">
        <Row label="vectors" bytes={vectors} max={max} color="oklch(0.62 0.15 30)" note="N x d x 4 bytes" />
        <Row label="HNSW graph" bytes={hnswGraph} max={max} color="oklch(0.62 0.12 250)" note="N x 2M x 4 bytes" />
        <Row label="= HNSW total" bytes={hnsw} max={max} color="oklch(0.45 0.05 250)" note="vectors plus graph" />
        <Row label="LEANN graph" bytes={leannGraph} max={max} color="oklch(0.62 0.15 150)" note="N x degree x 4 bytes" />
        <Row label="LEANN PQ" bytes={leannPq} max={max} color="oklch(0.62 0.15 285)" note="N x PQ bytes" />
        <Row label="= LEANN total" bytes={leann} max={max} color="oklch(0.45 0.08 150)" note="graph plus PQ" />
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        LEANN is {((leann / hnsw) * 100).toFixed(1)}% of the HNSW total here, a saving of {((1 - leann / hnsw) * 100).toFixed(1)}%. Set PQ to 0 to see the
        graph-only index the released hnsw backend builds. Sizes are decimal bytes; the files that hold the passage text are not counted on either side.
      </figcaption>
    </figure>
  )
}
