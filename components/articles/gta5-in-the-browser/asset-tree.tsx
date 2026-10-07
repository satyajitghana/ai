"use client"

import { useMemo, useState } from "react"
import { FileDashedIcon, FolderIcon, FolderOpenIcon } from "@phosphor-icons/react/dist/ssr"

import { ASSET_TREE, type AssetNode } from "./asset-tree-data"
import { TreeView, type TreeItem } from "./tree-view"

// The game folder the port serves, as its own manifest lists it: 5,814 files under /game/,
// 20.9 GB. Each row is a folder; the bar is its share of its parent, and the green part is
// what the recorded boot read set (bootset.json) touches before the world is up. Nothing here
// is fetched from the site: the tree was generated from the two JSON files and is static.

const ACCENT = "oklch(0.62 0.15 150)"
const MUTED = "oklch(0.62 0.03 250)"
const FOLDER = "oklch(0.7 0.12 75)"

const fmt = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

type Index = Map<string, { node: AssetNode; path: AssetNode[] }>

function build(node: AssetNode, parent: AssetNode | null, path: AssetNode[], id: string, index: Index): TreeItem {
  const here = [...path, node]
  index.set(id, { node, path: here })
  const share = parent && parent.s ? (node.s / parent.s) * 100 : 100
  const boot = node.s ? (node.b / node.s) * share : 0
  const lumped = /^\d+ more$/.test(node.n)
  return {
    id,
    label: lumped ? node.n : `${node.n}/`,
    dim: lumped,
    icon: lumped ? (
      <FileDashedIcon className="size-3.5 text-muted-foreground" />
    ) : (
      <FolderIcon weight={node.k ? "fill" : "regular"} className="size-3.5" style={{ color: FOLDER }} />
    ),
    meta: `${fmt(node.s)} · ${node.c.toLocaleString("en-US")}`,
    below: parent ? (
      <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${share.toFixed(2)}%`, background: MUTED, opacity: 0.55 }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${boot.toFixed(2)}%`, background: ACCENT }} />
      </div>
    ) : undefined,
    children: node.k?.map((k) => build(k, node, here, `${id}/${k.n}`, index)),
  }
}

export function AssetTree() {
  const { items, index } = useMemo(() => {
    const index: Index = new Map()
    return { items: [build(ASSET_TREE, null, [], ASSET_TREE.n, index)], index }
  }, [])
  const [sel, setSel] = useState(`${ASSET_TREE.n}/x64`)
  const cur = index.get(sel) ?? index.get(ASSET_TREE.n)!

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b px-3 py-2 font-mono text-xs">
        <FolderOpenIcon weight="fill" aria-hidden className="mr-1 size-3.5" style={{ color: FOLDER }} />
        {cur.path.map((p, i) => (
          <span key={i} className={i === cur.path.length - 1 ? "text-foreground" : "text-muted-foreground"}>
            {i > 0 && <span className="text-muted-foreground">/ </span>}
            {p.n}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground tabular-nums">
          {fmt(cur.node.s)} · {cur.node.c.toLocaleString("en-US")} files · boot set reads {fmt(cur.node.b)}
        </span>
      </div>
      <div className="max-h-[30rem] overflow-y-auto py-1">
        <TreeView
          items={items}
          label="The game folder, by size"
          selected={sel}
          onSelect={setSel}
          defaultExpanded={[ASSET_TREE.n, `${ASSET_TREE.n}/x64`, `${ASSET_TREE.n}/x64/levels`]}
        />
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        From the site&apos;s <code>data/manifest.json</code> and <code>data/bootset.json</code>. Each row shows size
        and file count. Grey: the folder&apos;s share of its parent. Green: the part the boot read set fetches before
        the world is up. Below the ten largest entries of a folder, the rest are lumped into one row. Arrow keys move
        and open folders.
      </figcaption>
    </figure>
  )
}
