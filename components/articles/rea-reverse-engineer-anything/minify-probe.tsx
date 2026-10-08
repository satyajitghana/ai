"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// My run of `rea analyze-javascript-application <dir> --json` (rea-agents 6.0.0, Node 24.13)
// on four versions of the same five-file Electron app I wrote. Counts are copied from each
// result's normalized_result.summary and semantic_graph.unknowns.

type Variant = {
  id: string
  label: string
  preload: string
  main: string
  counts: { windows: number; bridge: number; ipc: number; handlers: number; paired: number; unknowns: number }
  note: string
}

const VARIANTS: Variant[] = [
  {
    id: "readable",
    label: "readable",
    preload: 'const { contextBridge, ipcRenderer } = require("electron");\ncontextBridge.exposeInMainWorld("notes", {\n  search: (query) => ipcRenderer.invoke("notes:search", query),\n});',
    main: 'const { app, BrowserWindow, ipcMain } = require("electron");\n…\nipcMain.handle("notes:search", (_event, query) => searchNotes(query));',
    counts: { windows: 1, bridge: 1, ipc: 2, handlers: 1, paired: 1, unknowns: 45 },
    note: "The whole chain, each edge with a source range: package.json loads main.js, a BrowserWindow loads preload.js, preload exposes the notes API and invokes notes:search, and main.js line 12 handles it.",
  },
  {
    id: "namespace",
    label: "minified, namespace import",
    preload: 'const e=require("electron");e.contextBridge.exposeInMainWorld("notes",{search:q=>e.ipcRenderer.invoke("notes:search",q)});',
    main: 'const e=require("electron"),p=require("path");…e.ipcMain.handle("notes:search",(n,q)=>[q]);…',
    counts: { windows: 1, bridge: 1, ipc: 2, handlers: 1, paired: 1, unknowns: 33 },
    note: "One-letter names do not matter while the Electron API is reached through a property path: the matcher accepts any callee ending in .contextBridge.exposeInMainWorld or .ipcMain.handle.",
  },
  {
    id: "alias",
    label: "minified, aliased destructuring",
    preload: 'const {contextBridge:c,ipcRenderer:r}=require("electron");c.exposeInMainWorld("notes",{search:q=>r.invoke("notes:search",q)});',
    main: 'const {app,BrowserWindow,ipcMain}=require("electron"),…;ipcMain.handle("notes:search",(n,q)=>[q]);…',
    counts: { windows: 1, bridge: 0, ipc: 1, handlers: 1, paired: 0, unknowns: 34 },
    note: "Rename contextBridge to c and ipcRenderer to r and the bridge and the renderer side of the IPC disappear. main.js kept its names, so its handler is still found, now unpaired.",
  },
  {
    id: "esbuild",
    label: "esbuild --minify",
    preload: 'var{contextBridge:n,ipcRenderer:r}=require("electron");n.exposeInMainWorld("notes",{search:e=>r.invoke("notes:search",e)});',
    main: 'var{app:d,BrowserWindow:h,ipcMain:u}=require("electron"),…;function w(){new h({webPreferences:{preload:…}}).loadFile("index.html")}u.handle("notes:search",(n,e)=>p(e));…',
    counts: { windows: 0, bridge: 0, ipc: 0, handlers: 0, paired: 0, unknowns: 47 },
    note: "What a real bundler emits. Every Electron count drops to zero. The result still says it parsed every file without failures, and none of its 47 unknowns says that an IPC channel or a context bridge might be hiding behind a renamed binding.",
  },
]

const COLS: { k: keyof Variant["counts"]; label: string }[] = [
  { k: "windows", label: "BrowserWindows" },
  { k: "bridge", label: "contextBridge APIs" },
  { k: "ipc", label: "IPC operations" },
  { k: "handlers", label: "main handlers" },
  { k: "paired", label: "paired sends" },
  { k: "unknowns", label: "unknowns" },
]

export function MinifyProbe() {
  const [id, setId] = useState("readable")
  const v = VARIANTS.find((x) => x.id === id) ?? VARIANTS[0]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">rea analyze-javascript-application · my test app</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Variant">
          {VARIANTS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={x.id === id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 text-xs transition-colors",
                x.id === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4" aria-live="polite">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">preload.js</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-xs leading-relaxed">{v.preload}</pre>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">main.js</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-xs leading-relaxed">{v.main}</pre>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COLS.map((c) => {
            const n = v.counts[c.k]
            const base = VARIANTS[0].counts[c.k]
            const lost = c.k !== "unknowns" && n < base
            return (
              <div key={c.k} className={cn("rounded-lg border px-2 py-1.5", lost && "border-red-500/60")}>
                <div className={cn("font-mono text-lg", lost && "text-red-600 dark:text-red-400")}>{n}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{c.label}</div>
              </div>
            )
          })}
        </div>
        <p className="text-sm leading-relaxed">{v.note}</p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        My measurement, not REA&apos;s: the same app in four spellings, run through the published 6.0.0 CLI. Red marks a count
        lower than the readable version&apos;s.
      </figcaption>
    </figure>
  )
}
