"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// An isometric stack of the checks the port's page runs before it asks for the
// engine. The layers and their conditions are transcribed from the public
// /game page source (fetched 2026-10-27); the profiles are REASONED by reading
// that code, not by running these browsers. Geometry uses +, - and * only, so
// nothing here can differ between the server render and the browser.

type Status = "pass" | "fallback" | "fail" | "skipped" | "blocked"

type Layer = { id: string; short: string; label: string; source: string; why: string }

const LAYERS: Layer[] = [
  { id: "ctx", short: "secure + isolated", label: "Secure context and cross-origin isolation", source: "launcher script: !isSecureContext || !crossOriginIsolated throws; capcheck.js tests crossOriginIsolated", why: "The engine's worker threads share one memory. Browsers only hand out SharedArrayBuffer to a page served with COOP and COEP headers." },
  { id: "sab", short: "SharedArrayBuffer", label: "SharedArrayBuffer and wasm threads", source: "capcheck.js: typeof SharedArrayBuffer !== \"function\"; engine-select.js wasm32Ready() validates a shared-memory module", why: "The renderer, the job workers and the I/O helper communicate through shared memory instead of copying messages." },
  { id: "m64", short: "memory64", label: "64-bit WebAssembly (memory64)", source: "engine-select.js noMemory64(): validates the bytes of (module (memory i64 0)); capcheck.js memory64()", why: "A 248 MB module with a game's heap wants more than 4 GiB of address space. Without i64 memory the page tries a separate wasm32 bundle." },
  { id: "gpu", short: "WebGPU adapter", label: "WebGPU with an adapter", source: "capcheck.js: !navigator.gpu, then requestAdapter() resolving to null or rejecting", why: "The renderer is a WebGPU backend. There is no WebGL path in the page." },
  { id: "t1", short: "texture-formats-tier1", label: "WebGPU feature texture-formats-tier1", source: "capcheck.js [tier1]/[notier1]: panel unless the device has the feature, or (64-bit engine) float32-filterable so storage formats can be rewritten", why: "The engine writes packed and 8/16-bit formats from compute shaders. Without the feature, the page rewrites those storage formats to core ones." },
  { id: "bun", short: "engine bundle", label: "Engine bundle chosen by hash", source: "engine-select.js: site default, ?io=classic|shared|stream, or the wasm32 bundle for iPhone-class browsers", why: "The page does not request one engine; it picks a content-hashed build and forwards its parameters to the workers." },
]

type Profile = { id: string; label: string; note: string; status: Record<string, Status>; outcome: string }

const P: Profile[] = [
  { id: "desk", label: "Desktop Chromium, current", note: "Chrome, Edge or Brave with WebGPU and the tier1 feature.", status: { ctx: "pass", sab: "pass", m64: "pass", gpu: "pass", t1: "pass", bun: "pass" }, outcome: "Boots the 64-bit site-default bundle (aecc73a0…) with its streaming parameters." },
  { id: "ios", label: "iPhone or iPad Safari", note: "No memory64, but shared memory, isolation and WebGPU are present.", status: { ctx: "pass", sab: "pass", m64: "fallback", gpu: "pass", t1: "skipped", bun: "pass" }, outcome: "Boots the separate wasm32 bundle (64651401…) with the mem=ios parameter set. The tier1 check exempts iOS." },
  { id: "nogpu", label: "Isolated tab, no WebGPU", note: "Everything but navigator.gpu.", status: { ctx: "pass", sab: "pass", m64: "pass", gpu: "fail", t1: "blocked", bun: "blocked" }, outcome: "Panel: “WebGPU isn’t available in this browser.” No engine script is requested." },
  { id: "noiso", label: "Not cross-origin isolated", note: "A tab without COOP/COEP.", status: { ctx: "fail", sab: "fail", m64: "blocked", gpu: "blocked", t1: "blocked", bun: "blocked" }, outcome: "Panel: “This browser or tab can’t use shared memory.”" },
  { id: "t1fb", label: "No tier1, has float32-filterable", note: "A WebGPU device without the packed-format feature but with filterable float32.", status: { ctx: "pass", sab: "pass", m64: "pass", gpu: "pass", t1: "fallback", bun: "pass" }, outcome: "No panel on the 64-bit engine: shader and bind-group storage formats are rewritten to core ones (see the next widget)." },
  { id: "t1no", label: "No tier1, no float32-filterable", note: "Neither the feature nor the fallback's prerequisite.", status: { ctx: "pass", sab: "pass", m64: "pass", gpu: "pass", t1: "fail", bun: "blocked" }, outcome: "Panel: “This browser version is too old for the game.”" },
]

const COLOR: Record<Status, { top: string; side: string; stroke: string; text: string }> = {
  pass: { top: "#22c55e", side: "#16a34a", stroke: "#15803d", text: "pass" },
  fallback: { top: "#f59e0b", side: "#d97706", stroke: "#b45309", text: "fallback" },
  fail: { top: "#ef4444", side: "#dc2626", stroke: "#b91c1c", text: "fails here" },
  skipped: { top: "#94a3b8", side: "#64748b", stroke: "#475569", text: "skipped" },
  blocked: { top: "#cbd5e1", side: "#94a3b8", stroke: "#64748b", text: "not reached" },
}

const CX = 230
const HW = 120
const HH = 60
const TH = 12
const STEP = 50
const BASE = 320

function plate(level: number) {
  const y = BASE - level * STEP
  const top = `M${CX},${y - HH} L${CX + HW},${y} L${CX},${y + HH} L${CX - HW},${y} Z`
  const left = `M${CX - HW},${y} L${CX},${y + HH} L${CX},${y + HH + TH} L${CX - HW},${y + TH} Z`
  const right = `M${CX + HW},${y} L${CX},${y + HH} L${CX},${y + HH + TH} L${CX + HW},${y + TH} Z`
  return { y, top, left, right }
}

export function BootStack() {
  const [pid, setPid] = useState("desk")
  const [sel, setSel] = useState("m64")
  const prof = P.find((p) => p.id === pid) ?? P[0]
  const layer = LAYERS.find((l) => l.id === sel) ?? LAYERS[0]
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">What the page checks before it requests the engine, bottom to top</div>
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        {P.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPid(p.id)}
            className={cn("rounded-full border px-3 py-1 text-xs", pid === p.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
        <svg viewBox="0 0 460 390" className="w-full" role="img" aria-label="Isometric stack of six checks the page makes: secure context, shared memory, memory64, WebGPU, texture-formats-tier1 and the engine bundle. Each plate is coloured by whether the selected browser profile passes it.">
          {LAYERS.map((l, i) => {
            const g = plate(i)
            const st = prof.status[l.id]
            const c = COLOR[st]
            const on = sel === l.id
            return (
              <g key={l.id} onClick={() => setSel(l.id)} onMouseEnter={() => setSel(l.id)} style={{ cursor: "pointer" }}>
                <path d={g.left} fill={c.side} stroke={c.stroke} strokeWidth={on ? 2 : 1} />
                <path d={g.right} fill={c.stroke} stroke={c.stroke} strokeWidth={on ? 2 : 1} />
                <path d={g.top} fill={c.top} stroke={c.stroke} strokeWidth={on ? 2.5 : 1} />
                <text x={CX} y={g.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0f172a">{l.short}</text>
              </g>
            )
          })}
        </svg>
        <div className="border-t border-border p-4 text-sm lg:border-l lg:border-t-0">
          <div className="font-medium">{layer.label}</div>
          <p className="mt-1 text-muted-foreground">{layer.why}</p>
          <p className="mt-2 text-xs"><span className="font-medium">In the page source:</span> {layer.source}</p>
          <p className="mt-3 text-xs"><span className="font-medium">{prof.label}:</span> {prof.note}</p>
          <p className="mt-2 text-xs"><span className="font-medium">Result:</span> {prof.outcome}</p>
        </div>
      </div>
      <table className="w-full border-t border-border text-xs">
        <thead>
          <tr className="text-left text-muted-foreground"><th className="px-4 py-2">Check</th><th className="px-4 py-2">{prof.label}</th></tr>
        </thead>
        <tbody>
          {LAYERS.map((l) => (
            <tr key={l.id} className="border-t border-border"><td className="px-4 py-1.5">{l.label}</td><td className="px-4 py-1.5">{COLOR[prof.status[l.id]].text}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Reasoned from reading the page&apos;s own scripts, fetched 2026-10-27. I did not run these browsers against the port; the conditions are the page&apos;s, the profiles are my reading of them.</p>
    </div>
  )
}
