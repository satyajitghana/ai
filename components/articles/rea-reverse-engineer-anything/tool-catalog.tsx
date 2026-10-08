"use client"

import { useMemo, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import { TOOLS, type Tool } from "./catalog-data"

// Every MCP tool REA 6.0.0 registers, grouped by the kind of target it works on.
// The data is generated from the published npm package's TOOL_CONTRACTS (see
// catalog-data.ts); the grouping follows the contract files those arrays live in.

const DOMAINS: { id: string; label: string; blurb: string }[] = [
  { id: "native-core", label: "Native: disassembler primitives", blurb: "One operation each on the database Hopper, Ghidra or IDA has open: list, read, name, comment, xref." },
  { id: "native-composed", label: "Native: composed analysis", blurb: "Several primitives joined into one answer: the function dossier, feature traces, call paths, Objective-C and Swift metadata." },
  { id: "native-host", label: "Native: macOS host and runtime", blurb: "Mach-O, signatures, plists, accessibility trees, and LLDB call observation of a launched process." },
  { id: "native-offline", label: "Offline ELF and crash cores", blurb: "Caller-supplied pwntools (and optionally pwndbg) on Linux, without a disassembler database." },
  { id: "packages", label: "Packages and bundles", blurb: "ZIP, APK, IPA, MSIX, DMG and app-bundle inventories, extraction, Interface Builder files, asset catalogs, dylib resolution." },
  { id: "dotnet", label: ".NET assemblies", blurb: "REA's own PE/CLI metadata and CIL reader, cross-build comparison, and import of decompiler output you bring." },
  { id: "android", label: "Android APKs", blurb: "Headless JADX: manifest, class search, decompiled methods, references." },
  { id: "firmware", label: "Firmware", blurb: "Binwalk and Unblob regions and extraction, Linux only." },
  { id: "evm", label: "EVM bytecode", blurb: "Selectors, arguments and mutability from local bytecode through EVMole." },
  { id: "javascript", label: "JavaScript and Electron", blurb: "Static ASAR and directory analysis, source recovery through Wakaru, V8 Inspector and Electron observation." },
  { id: "web", label: "Websites and captures", blurb: "Attach to your own Chrome over CDP, Playwright scenarios, script export, source maps, HAR and mitmproxy captures." },
  { id: "workflows", label: "Cross-target workflows", blurb: "Feature tracing and version comparison over Evidence the other tools produced, plus reconstruction ledgers." },
  { id: "session", label: "Session, Evidence and unknowns", blurb: "Open and close targets, the Evidence bundle, comparisons, the unknowns register, reconstruction checks." },
]

const FX_LABEL: Record<string, string> = {
  launches: "launches a process",
  network: "talks to a local endpoint",
  edits: "changes the target or its database",
  writes: "writes files",
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-md border px-2 py-1 text-left text-xs transition-colors",
        active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Fields({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {items.length === 0 ? (
        <div className="font-mono text-xs text-muted-foreground">none</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((f) => (
            <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {f}
            </code>
          ))}
        </div>
      )}
    </div>
  )
}

export function ToolCatalog() {
  const [domain, setDomain] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string>("analyze_function")

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of TOOLS) c[t.g] = (c[t.g] ?? 0) + 1
    return c
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((t) => (domain === "all" || t.g === domain) && (!q || t.n.includes(q) || t.d.toLowerCase().includes(q)))
  }, [domain, query])

  const tool: Tool | undefined = TOOLS.find((t) => t.n === picked)
  const dom = DOMAINS.find((d) => d.id === (domain === "all" ? tool?.g : domain))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">rea-agents@6.0.0 · tools/list</span>
        <span className="font-mono text-xs text-muted-foreground">
          {shown.length} of {TOOLS.length} tools
        </span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Target type">
          <Chip active={domain === "all"} onClick={() => setDomain("all")}>
            All {TOOLS.length}
          </Chip>
          {DOMAINS.map((d) => (
            <Chip key={d.id} active={domain === d.id} onClick={() => setDomain(d.id)}>
              {d.label} <span className="opacity-70">{counts[d.id]}</span>
            </Chip>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter by name or description"
          aria-label="Filter tools"
          className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs"
        />
        {dom && <p className="text-xs text-muted-foreground">{dom.blurb}</p>}
        <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto rounded-md border p-2" role="listbox" aria-label="Tools">
          {shown.map((t) => (
            <button
              key={t.n}
              type="button"
              role="option"
              aria-selected={t.n === picked}
              onClick={() => setPicked(t.n)}
              className={cn(
                "cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                t.n === picked ? "bg-foreground text-background" : "bg-muted/60 hover:bg-muted",
              )}
            >
              {t.n}
            </button>
          ))}
          {shown.length === 0 && <span className="text-xs text-muted-foreground">no tool matches</span>}
        </div>
        {tool && (
          <div className="space-y-3 rounded-lg border bg-background/60 p-3" aria-live="polite">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <code className="font-mono text-sm font-semibold">{tool.n}</code>
              <span className="text-xs text-muted-foreground">{DOMAINS.find((d) => d.id === tool.g)?.label}</span>
            </div>
            <p className="text-sm">{tool.d}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Fields label="required input" items={tool.r} />
              <Fields label="optional input" items={tool.o} />
              <Fields label="output" items={tool.out} />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded border px-1.5 py-0.5 text-muted-foreground">
                {tool.ro ? "readOnlyHint: true" : "readOnlyHint: false"}
              </span>
              {tool.fx.map((f) => (
                <span key={f} className="rounded border border-amber-500/50 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                  {FX_LABEL[f]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Generated from the published package&apos;s own contracts. 126 of the 139 tools return{" "}
        <code>result</code>, <code>evidence_id</code> and <code>evidence</code>; only 5 declare themselves read-only, because
        recording Evidence counts as a change to the session.
      </figcaption>
    </figure>
  )
}
