"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What is in the public tree at commit 80ee8b8 (2026-10-26 13:28 UTC) and what is not. Evidence labels:
// read = I read it in the tree; reported = stated by Rivet; absent = searched for and not found.

type Item = { id: string; tier: string; label: string; ev: "read" | "reported" | "absent"; note: string }

const ITEMS: Item[] = [
  { id: "hot", tier: "Public tree", label: "Hot tier in UniversalDB", ev: "read", note: "depot docs: Depot stores SQLite pages in UDB, and UDB is the durable source of truth. UDB has Postgres and RocksDB drivers in engine/packages/universaldb." },
  { id: "wal", tier: "Public tree", label: "Delta, shard, page index", ev: "read", note: "A commit writes LTX DELTA chunks plus a PIDX row per page; compaction folds them into 64-page (256 KiB) SHARD images. Commits never publish shards." },
  { id: "cmp", tier: "Public tree", label: "Workflow compaction", ev: "read", note: "One manager plus hot and reclaim companions per database branch; deletes re-check pins and coverage inside the delete transaction." },
  { id: "cold", tier: "Enterprise only", label: "S3 cold tier", ev: "read", note: "docs-internal/engine/oss-to-ee-upgrade.md: the cold storage subsystem is Enterprise-only. The tree keeps its key schema and codecs, constants such as a 64 MiB upload cap, and tests that import a cold_tier module the crate does not declare." },
  { id: "s3only", tier: "Enterprise only", label: "S3 as the only dependency", ev: "absent", note: "The README at this commit says to use Postgres or FoundationDB for persistence and tiered storage to S3. One binary plus a bucket is the 3.0 claim." },
  { id: "az", tier: "3.0 post", label: "Majority ack on disks in 3 zones", ev: "reported", note: "From the post. A grep of the tree for warpdrive finds nothing, and no code path writes a replicated local-disk log." },
  { id: "lat", tier: "3.0 post", label: "0.69 ms write, 0.20 ms read, 689 ms cold wake", ev: "reported", note: "From the post. No benchmark harness for these is in the tree; the 689 ms is for a 47 MiB database and the query is not named." },
  { id: "fs", tier: "3.0 post", label: "Filesystem instead of an object store", ev: "reported", note: "The FAQ says Rivet can offload to a filesystem. The tree's FilesystemColdTier is imported by tests but its source is not in the tree." },
]

const EV: Record<Item["ev"], string> = { read: "oklch(0.62 0.15 150)", reported: "oklch(0.70 0.15 85)", absent: "oklch(0.60 0.17 30)" }
const TIERS = ["Public tree", "Enterprise only", "3.0 post"]

export function TierMap() {
  const [sel, setSel] = useState("cold")
  const it = ITEMS.find((i) => i.id === sel) ?? ITEMS[0]
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {TIERS.map((t) => (
          <div key={t}>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{t}</div>
            <div className="flex flex-col gap-2">
              {ITEMS.filter((i) => i.tier === t).map((i) => (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={sel === i.id}
                  onClick={() => setSel(i.id)}
                  className={cn(
                    "flex items-start gap-2 rounded border px-2 py-2 text-left text-xs",
                    sel === i.id ? "border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: EV[i.ev] }} aria-hidden />
                  <span>
                    {i.label}
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">({i.ev})</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-xs" aria-live="polite">
        {it.note}
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Tree: rivet-dev/rivet at commit 80ee8b8, 26 October 2026. Green: I read it. Amber: Rivet says it, I could not check it. Red: searched for, not found.
      </figcaption>
    </figure>
  )
}
