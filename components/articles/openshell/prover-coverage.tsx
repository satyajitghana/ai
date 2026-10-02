"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the boundary check actually models, and where it stops. The five modeled
// domains are the DOMAINS array in openshell-prover/src/containment.rs; the
// "returns unsupported" items are the validate_supported_* guards in the same
// file (protocol, mcp, graphql, json_rpc, credentials, middleware) plus the
// path-by-path filesystem rule documented in docs/how-it-works/policies/prover.
// Clicking a row shows the reason the prover hands back instead of guessing.

const GREEN = "oklch(0.55 0.14 150)"
const SLATE = "oklch(0.55 0.02 260)"

type Item = { name: string; note: string }

const MODELED: Item[] = [
  { name: "filesystem", note: "read and write access, compared path by path" },
  { name: "network L4", note: "which binaries can reach which hosts, ports, and IP ranges" },
  { name: "network REST", note: "allowed HTTP methods and paths on an inspected endpoint" },
  { name: "process", note: "run_as_user and run_as_group identity" },
  { name: "Landlock", note: "the compatibility setting (best_effort vs hard_requirement)" },
]

const UNSUPPORTED: Item[] = [
  { name: "GraphQL", note: "uses protocol 'graphql'; only L4 TCP and REST are modeled" },
  { name: "MCP", note: "endpoint carries an MCP rule the model does not cover" },
  { name: "JSON-RPC", note: "endpoint carries a json_rpc rule" },
  { name: "WebSocket / credential rewrite", note: "authority outside the initial model" },
  { name: "credential signing", note: "signing service / region / binding is not modeled" },
  { name: "network middleware", note: "uses network middleware controls" },
  { name: "nested FS paths", note: "write /tmp/cache under boundary /tmp → a symlink in the image could escape" },
  { name: "UID remap (1500→1600)", note: "the prover cannot look up accounts in the sandbox image" },
]

function Chips({
  items,
  color,
  selName,
  onSelect,
}: {
  items: Item[]
  color: string
  selName: string | null
  onSelect: (it: Item) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const active = selName === it.name
        return (
          <button
            key={it.name}
            type="button"
            onClick={() => onSelect(it)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              active ? "text-white" : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={active ? { background: color, borderColor: color } : undefined}
          >
            {it.name}
          </button>
        )
      })}
    </div>
  )
}

export function ProverCoverage() {
  const [sel, setSel] = useState<Item | null>(MODELED[0])
  const selIsUnsupported = sel ? UNSUPPORTED.includes(sel) : false

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">openshell-prover · boundary check coverage</span>
        <span className="font-mono text-[10px] text-muted-foreground">within_boundary only passes for what it models</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: GREEN }}>
            modeled — the check compares these
          </div>
          <Chips items={MODELED} color={GREEN} selName={sel?.name ?? null} onSelect={setSel} />
        </div>
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: SLATE }}>
            returns unsupported — refuses to guess
          </div>
          <Chips items={UNSUPPORTED} color={SLATE} selName={sel?.name ?? null} onSelect={setSel} />
        </div>
      </div>

      {sel ? (
        <div className="px-3 pb-4 sm:px-4">
          <div
            className="rounded-md border-l-2 p-2 pl-3 text-[12px] leading-5"
            style={{ borderColor: selIsUnsupported ? SLATE : GREEN }}
          >
            <span className="font-mono text-[11px] text-foreground">{sel.name}</span>
            {" — "}
            <span className="text-muted-foreground">{sel.note}</span>
          </div>
        </div>
      ) : null}
    </figure>
  )
}
