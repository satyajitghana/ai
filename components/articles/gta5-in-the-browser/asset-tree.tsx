"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ASSET_TREE, type AssetNode } from "./asset-tree-data"

// The game folder the port serves, as its own manifest lists it: 5,814 files under /game/,
// 20.9 GB. Each row is a folder; the bar is its share of its parent, and the green part is
// what the recorded boot read set (bootset.json) touches before the world is up. Click a
// folder to open it. Nothing here is fetched from the site: the tree was generated from the
// two JSON files and is static.

const ACCENT = "oklch(0.62 0.15 150)"
const MUTED = "oklch(0.62 0.03 250)"

const fmt = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

export function AssetTree() {
  const [path, setPath] = useState<AssetNode[]>([ASSET_TREE])
  const node = path[path.length - 1]
  const kids = node.k ?? []

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-xs">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <button
              type="button"
              onClick={() => setPath(path.slice(0, i + 1))}
              className={cn(i === path.length - 1 ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {p.n}
            </button>
          </span>
        ))}
        <span className="ml-auto text-muted-foreground">
          {fmt(node.s)} · {node.c.toLocaleString("en-US")} files · boot set reads {fmt(node.b)}
        </span>
      </div>
      <div className="divide-y">
        {kids.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">No deeper breakdown kept for this folder.</div>
        )}
        {kids.map((k) => {
          const share = node.s ? (k.s / node.s) * 100 : 0
          const boot = k.s ? (k.b / k.s) * share : 0
          const open = !!k.k
          return (
            <button
              key={k.n}
              type="button"
              disabled={!open}
              onClick={() => open && setPath([...path, k])}
              className={cn("block w-full px-4 py-2 text-left", open ? "hover:bg-muted/40" : "cursor-default")}
            >
              <div className="flex justify-between gap-3 font-mono text-xs">
                <span className={cn(open ? "text-foreground" : "text-muted-foreground")}>
                  {k.n}
                  {open ? "/" : ""}
                </span>
                <span className="text-muted-foreground">
                  {fmt(k.s)} · {k.c.toLocaleString("en-US")} files
                  {k.b > 0 ? ` · boot ${fmt(k.b)}` : ""}
                </span>
              </div>
              <div className="relative mt-1 h-2 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${share.toFixed(2)}%`, background: MUTED, opacity: 0.55 }} />
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${boot.toFixed(2)}%`, background: ACCENT }} />
              </div>
            </button>
          )
        })}
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        From the site&apos;s <code>data/manifest.json</code> and <code>data/bootset.json</code>. Grey: the folder&apos;s
        share of its parent. Green: the part the boot read set fetches before the world is up. Below the ten largest
        entries of a folder, the rest are lumped into one row.
      </figcaption>
    </figure>
  )
}
