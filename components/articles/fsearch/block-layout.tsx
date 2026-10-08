"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { layout } from "./toy-disk"

// The toy disk laid out exactly as fsearch's Index::build orders entries
// (src/index.rs:202-252): entry 0 is "/", each folder's children form one
// sorted block, and blocks are emitted depth-first. A folder's whole subtree
// is then the single range dir_start..dir_end, which is how `in:` scopes a
// search with two numbers instead of a filter (src/query.rs:670-676).

const { entries, byDir } = layout()

const HI = "oklch(0.62 0.15 250)"
const BLOCK = "oklch(0.7 0.12 155)"

export function BlockLayout() {
  const [sel, setSel] = useState(entries.find((e) => e.name === "Developer")?.i ?? 0)
  const b = byDir.get(sel)
  const lo = b ? b.start : 0
  const hi = b ? b.end : 0
  const own = b ? [b.start, b.start + b.len] : [0, 0]
  const dirs = entries.filter((e) => e.dir)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        index.bin entry order · pick a folder to scope with <code>in:</code>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {dirs.map((e) => (
            <button
              key={e.i}
              type="button"
              onClick={() => setSel(e.i)}
              aria-pressed={sel === e.i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === e.i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {e.path}
            </button>
          ))}
        </div>
        <p className="mb-2 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">in:{entries[sel].path}</span> → entries{" "}
          <span style={{ color: HI }}>
            {lo}..{hi}
          </span>{" "}
          ({hi - lo} entries, one contiguous range); its own children are the block{" "}
          <span style={{ color: BLOCK }}>
            {own[0]}..{own[1]}
          </span>
        </p>
        <ol className="grid grid-cols-1 gap-x-3 gap-y-0.5 font-mono text-[10.5px] sm:grid-cols-2">
          {entries.map((e) => {
            const inRange = e.i >= lo && e.i < hi
            const inBlock = e.i >= own[0] && e.i < own[1]
            return (
              <li
                key={e.i}
                className="flex items-baseline gap-2 rounded px-1"
                style={{
                  background: inBlock ? "color-mix(in oklch, " + BLOCK + " 22%, transparent)" : inRange ? "color-mix(in oklch, " + HI + " 16%, transparent)" : undefined,
                }}
              >
                <span className="w-5 shrink-0 text-right text-muted-foreground">{e.i}</span>
                <span className={cn(inRange ? "text-foreground" : "text-muted-foreground")}>
                  {e.name}
                  {e.dir && e.i > 0 ? "/" : ""}
                </span>
                <span className="truncate text-[9.5px] text-muted-foreground">
                  in {e.parent === 0 && e.i > 0 ? "/" : entries[e.parent].path}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Order produced by a port of <code>Index::build</code>. Green: the folder&apos;s own block of sorted children (used to
        resolve a path by binary search). Blue: everything under it, which is always contiguous because blocks go out depth-first.
      </figcaption>
    </figure>
  )
}
