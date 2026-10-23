"use client"

// Why a part tree shortens the chain: sequential steps for a flat build versus
// a hierarchical one, on the four showcase assemblies Skyfall published.
//
// Inputs (REPORTED):
//   leaves / nodes / depth  skyfall.ai/sky-001 showcase ("One image. Every
//                           part."): Jaguar E-Type 103/139/5, jet engine
//                           70/96/5, FANUC ArcMate 100iB 35/55/4, Minitractor
//                           4x4 92/130/5.
//   ~100 steps per part     the blog's CAD benchmark: "Building one takes about
//                           100 drawing steps".
// Everything else is REASONED: a counting model of the blog's own argument
// ("the number of sequential steps grows with the depth of the design rather
// than its size"). It counts model calls on the critical path, not seconds, and
// it assumes every leaf costs the same number of steps, which no real assembly
// does. Skyfall published no timing breakdown to check it against.
//
// SSR-safe: integer arithmetic only, no effects, no browser APIs.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const ASSETS = [
  { key: "jaguar", label: "Jaguar E-Type", leaves: 103, nodes: 139, depth: 5 },
  { key: "jet", label: "Jet engine", leaves: 70, nodes: 96, depth: 5 },
  { key: "arcmate", label: "ArcMate 100iB", leaves: 35, nodes: 55, depth: 4 },
  { key: "tractor", label: "Minitractor 4x4", leaves: 92, nodes: 130, depth: 5 },
] as const

const ACCENT = "#2A6F97"
const FLAT = "#C0703A"

function fmt(n: number): string {
  return n.toLocaleString("en-US")
}

export function CriticalPath() {
  const [key, setKey] = useState<(typeof ASSETS)[number]["key"]>("jaguar")
  const [steps, setSteps] = useState(100)
  const [workers, setWorkers] = useState(128)

  const a = ASSETS.find((x) => x.key === key) ?? ASSETS[0]
  const internal = a.nodes - a.leaves
  // Flat: one chain that decides every split and builds every part in turn.
  const flat = internal + a.leaves * steps
  // Hierarchical: one round per level of the tree, then the leaves in batches
  // of `workers`, each batch as long as one part's build.
  const batches = Math.ceil(a.leaves / workers)
  const hier = a.depth + batches * steps
  const work = internal + a.leaves * steps
  const ratio = flat / hier
  const hierPct = (hier / flat) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sequential steps: flat chain vs part tree</span>
        <span className="text-muted-foreground/70">reasoned from Skyfall&apos;s tree sizes</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Assembly">
          {ASSETS.map((x) => {
            const on = x.key === key
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setKey(x.key)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-white" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {x.label}
              </button>
            )
          })}
        </div>

        <p className="font-mono text-[11px] text-muted-foreground">
          {a.label}: {a.leaves} parts, {a.nodes} nodes in all, {a.depth} levels deep (Skyfall&apos;s showcase).
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>steps to build one part</span>
              <span className="tabular-nums">{steps}</span>
            </span>
            <Range min={20} max={200} step={10} value={steps} onChange={(e) => setSteps(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>parts built at once</span>
              <span className="tabular-nums">{workers}</span>
            </span>
            <Range min={1} max={128} step={1} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
          </label>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
            <span className="font-mono text-[11px]">flat chain</span>
            <div className="flex items-center gap-2">
              <div className="h-4 flex-1 rounded bg-muted/50">
                <div className="h-full rounded" style={{ width: "100%", background: FLAT }} />
              </div>
              <span className="w-[5.5rem] shrink-0 text-right font-mono text-[11px] tabular-nums">{fmt(flat)}</span>
            </div>
          </div>
          <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
            <span className="font-mono text-[11px]">part tree</span>
            <div className="flex items-center gap-2">
              <div className="h-4 flex-1 rounded bg-muted/50">
                <div className="h-full rounded" style={{ width: `${Math.max(hierPct, 0.6).toFixed(2)}%`, background: ACCENT }} />
              </div>
              <span className="w-[5.5rem] shrink-0 text-right font-mono text-[11px] tabular-nums">{fmt(hier)}</span>
            </div>
          </div>
        </div>

        <p className="font-mono text-[11px] leading-5 text-muted-foreground">
          The tree&apos;s chain is {ratio.toFixed(1)}x shorter: {a.depth} rounds of splitting, then {batches}{" "}
          {batches === 1 ? "batch" : "batches"} of {steps} steps. Total model calls are the same {fmt(work)} either way.
        </p>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        A count of model calls in sequence, not seconds. Hierarchy shortens the wait when parts run side by side; it
        does not shrink the work. Drop &quot;parts built at once&quot; to 1 and the tree is barely faster than the chain.
      </figcaption>
    </figure>
  )
}
