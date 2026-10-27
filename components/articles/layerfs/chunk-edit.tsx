"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two real files from this repository, chunked with a Python port of LayerFS's frozen GEAR chunker (8 KiB minimum, 16 KiB target,
// 32 KiB maximum). Each edit was applied to the middle of the file (the append, to its end) and the file chunked again; a chunk
// counts as rewritten when its SHA-256 is not among the original file's. Cell widths are equal, not to scale.
type Edit = "insert" | "overwrite" | "append"
type Case = {
  file: string
  bytes: number
  chunks: number
  edits: Record<Edit, { changed: number[]; bytes: number; chunks: number }>
}

const CASES: Case[] = [
  {
    file: "night-shift-photos.js",
    bytes: 1_695_701,
    chunks: 88,
    edits: {
      insert: { changed: [41, 42, 43, 44], bytes: 74_492, chunks: 88 },
      overwrite: { changed: [41], bytes: 22_538, chunks: 88 },
      append: { changed: [87], bytes: 4_540, chunks: 88 },
    },
  },
  {
    file: "p5-2.3.3.min.js",
    bytes: 990_517,
    chunks: 49,
    edits: {
      insert: { changed: [25], bytes: 21_797, chunks: 49 },
      overwrite: { changed: [25], bytes: 21_697, chunks: 49 },
      append: { changed: [48], bytes: 16_187, chunks: 49 },
    },
  },
]

const LABEL: Record<Edit, string> = {
  insert: "insert 100 bytes",
  overwrite: "overwrite 100 bytes",
  append: "append 100 bytes",
}

export function ChunkEdit() {
  const [c, setC] = useState(0)
  const [e, setE] = useState<Edit>("insert")
  const cs = CASES[c]
  const ed = cs.edits[e]
  const set = new Set(ed.changed)
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a small edit to a large file · measured with a port of the chunker, cell widths equal
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {CASES.map((x, k) => (
          <button
            key={x.file}
            type="button"
            onClick={() => setC(k)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              c === k ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.file}
          </button>
        ))}
        <span className="mx-1 text-muted-foreground">/</span>
        {(Object.keys(LABEL) as Edit[]).map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setE(x)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              e === x ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {LABEL[x]}
          </button>
        ))}
      </div>
      <div className="px-4 py-4">
        <div
          className="flex h-8 gap-px"
          role="img"
          aria-label={`${cs.file} is ${cs.chunks} chunks. After the edit ${ed.changed.length} of them are new.`}
        >
          {Array.from({ length: cs.chunks }, (_, k) => (
            <div
              key={k}
              className="h-full flex-1 rounded-[1px]"
              style={{ background: set.has(k) ? "oklch(0.60 0.17 30)" : "oklch(0.62 0.10 150)" }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>start of file</span>
          <span>end of file</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">file</div>
            <div className="text-lg tabular-nums">{(cs.bytes / 1e6).toFixed(2)} MB</div>
            <div className="text-[10px] text-muted-foreground">{cs.chunks} chunks</div>
          </div>
          <div>
            <div className="text-muted-foreground">new chunks</div>
            <div className="text-lg tabular-nums">
              {ed.changed.length} <span className="text-xs">of {cs.chunks}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">red cells</div>
          </div>
          <div>
            <div className="text-muted-foreground">bytes stored again</div>
            <div className="text-lg tabular-nums">{(ed.bytes / 1e3).toFixed(1)} KB</div>
            <div className="text-[10px] text-muted-foreground">{((ed.bytes / cs.bytes) * 100).toFixed(1)}% of the file, before compression</div>
          </div>
        </div>
      </div>
    </figure>
  )
}
