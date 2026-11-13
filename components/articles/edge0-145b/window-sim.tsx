"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One verify window of edge0-strata, as four lanes that start together and end
// at the slowest. The lane model is the one this site built for upstream
// Strata (components/articles/strata-engine/window-timeline.tsx), extended
// with an SSD lane for the --resident-budget-gib / --mmap-experts modes and a
// unified-memory mode.
//
//   X      = U(4) · 480 · record           distinct expert bytes a 4-token window routes to
//   hV, hR = Zipf(s) share of the top nV, nV+nR experts of each layer's 512
//   gpu    = (D + hV·X + pcie) / (B_gpu · eff)
//   pcie   = f · hR · X / B_pcie           (f = --pcie-frac 0.1, edge0's model.json)
//   cpu    = ((1 − f) · hR · X + ssd) / B_cpu
//   ssd    = (1 − hV − hR) · X / B_ssd
//   t      = max(gpu, pcie, cpu, ssd) + fix,   tok/s = L / t
// Unified memory: t = (D + X) / (B · eff) + fix (everything resident, one bus).
//
// Constants: U(4) = 3.05 (Strata include/strata/core/verify.hpp), fix 6.3 ms
// and eff 0.5 (Strata's paper, as read in the strata-engine article), B_cpu =
// B_pcie = 25 GB/s (same source). D = 5,305,126,400 B of skeleton read per
// window + the D/U file (3,743,416,320 q8 / 1,415,577,600 q4). Expert-cache
// sizes per machine are my reconstruction from the README's residency
// readings. The skew s is NOT measured: profile.bin ships a ranking without
// counts. s = 0.8 is the value at which this model lands on three of the
// published rows; treat it as a fit, not a fact.

type Build = { id: string; label: string; record: number; du: number }

const BUILDS: Build[] = [
  { id: "145q3", label: "145B · Q3_K", record: 1_630_720, du: 3_743_416_320 },
  { id: "145fp4", label: "145B · NVFP4", record: 1_935_376, du: 3_743_416_320 },
  { id: "120q3", label: "120B · Q3_K", record: 1_164_800, du: 1_415_577_600 },
]

type Preset = {
  id: string
  label: string
  unified: boolean
  bg: number
  vram: number
  ram: number
  ssd: number
  published: Record<string, string>
}

const PRESETS: Preset[] = [
  { id: "5090", label: "RTX 5090 D, all resident", unified: false, bg: 1792, vram: 11.9, ram: 64, ssd: 7, published: { "145q3": "README: 99.7 chat · 121.2 agent", "145fp4": "README: 79.6 chat · 98.3 agent", "120q3": "README: 130.2 chat · 144.6 agent" } },
  { id: "budget", label: "16 GiB + 20 GiB cap", unified: false, bg: 1792, vram: 4.7, ram: 12, ssd: 7, published: { "145q3": "README: 36.8 chat · 44.9 agent", "145fp4": "no published run", "120q3": "README: 62.4 chat · 73.3 agent" } },
  { id: "nvme", label: "24 GB card + NVMe only", unified: false, bg: 1008, vram: 11.9, ram: 0, ssd: 7, published: { "145q3": "no published run", "145fp4": "no published run", "120q3": "no published run" } },
  { id: "spark", label: "RTX Spark (unified)", unified: true, bg: 301, vram: 0, ram: 0, ssd: 7, published: { "145q3": "README: 37.7 chat · 36.7 agent", "145fp4": "README: 40.1 chat · 46.0 agent", "120q3": "README: 47.2 chat · 68.4 agent" } },
  { id: "m2u", label: "M2 Ultra (unified)", unified: true, bg: 800, vram: 0, ram: 0, ssd: 7, published: { "145q3": "README: 60.9 chat · 57.0 agent", "145fp4": "no published run", "120q3": "README: 60.4 chat · 63.0 agent" } },
]

const GIB = 1024 * 1024 * 1024
const SKELETON_READ = 5_305_126_400
const U4 = 3.05
const FIX = 6.3
const BC = 25
const BP = 25
const PF = 0.1
const TARGET = 75

function harmonic(n: number, s: number) {
  let h = 0
  for (let i = 1; i <= n; i++) h += 1 / mpow(i, s)
  return h
}

function topShare(n: number, s: number) {
  const k = Math.max(0, Math.min(512, Math.floor(n)))
  if (k === 0) return 0
  return harmonic(k, s) / harmonic(512, s)
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function WindowSim() {
  const [buildId, setBuildId] = useState("145q3")
  const [presetId, setPresetId] = useState("5090")
  const [vram, setVram] = useState(11.9)
  const [ram, setRam] = useState(64)
  const [skew, setSkew] = useState(0.8)
  const [ssd, setSsd] = useState(7)
  const [tokens, setTokens] = useState(3.2)
  const [eff, setEff] = useState(0.5)

  const b = BUILDS.find((x) => x.id === buildId) ?? BUILDS[0]
  const p = PRESETS.find((x) => x.id === presetId) ?? PRESETS[0]

  const pick = (x: Preset) => {
    setPresetId(x.id)
    setVram(x.vram)
    setRam(x.ram)
    setSsd(x.ssd)
  }

  const X = U4 * 480 * b.record // bytes
  const D = SKELETON_READ + b.du
  const perLayer = (gib: number) => (gib * GIB) / b.record / 48

  let hV = 1
  let hR = 0
  let lanes: { key: string; label: string; ms: number }[]
  if (p.unified) {
    const ms = ((D + X) / (p.bg * 1e9 * eff)) * 1000
    lanes = [{ key: "bus", label: "one bus: dense + experts", ms }]
  } else {
    hV = topShare(perLayer(vram), skew)
    hR = Math.max(0, topShare(perLayer(vram + ram), skew) - hV)
    const hS = Math.max(0, 1 - hV - hR)
    const pcie = PF * hR * X
    const cpu = (1 - PF) * hR * X + hS * X
    lanes = [
      { key: "gpu", label: "GPU: dense + cached experts", ms: ((D + hV * X + pcie) / (p.bg * 1e9 * eff)) * 1000 },
      { key: "pcie", label: "PCIe: 10% of RAM misses", ms: (pcie / (BP * 1e9)) * 1000 },
      { key: "cpu", label: "CPU: misses in place", ms: (cpu / (BC * 1e9)) * 1000 },
      { key: "ssd", label: "SSD: experts not in RAM", ms: ((hS * X) / (ssd * 1e9)) * 1000 },
    ]
  }
  const slow = Math.max(...lanes.map((l) => l.ms))
  const t = slow + FIX
  const tps = tokens / (t / 1000)
  const hS = p.unified ? 0 : Math.max(0, 1 - hV - hR)

  // the largest share of a window's experts the SSD may serve for 75 tok/s
  const budgetMs = (tokens / TARGET) * 1000 - FIX
  const ssdMax = Math.max(0, Math.min(1, ((budgetMs / 1000) * ssd * 1e9) / X))
  // the VRAM hit rate the CPU lane needs for 75 tok/s if RAM holds every miss
  const cpuMiss = Math.max(0, Math.min(1, ((budgetMs / 1000) * BC * 1e9) / ((1 - PF) * X)))

  const scale = Math.max(slow + FIX, 60)
  const w = (ms: number) => `${r2(Math.min(100, (ms / scale) * 100))}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one verify window, four lanes</span>
        <span className="font-mono text-[10px] text-muted-foreground">model, not a measurement</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="build">
            {BUILDS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setBuildId(x.id)}
                aria-pressed={x.id === buildId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === buildId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="machine">
            {PRESETS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => pick(x)}
                aria-pressed={x.id === presetId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === presetId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {!p.unified && (
            <>
              <label className="block font-mono text-[11px] text-muted-foreground">
                VRAM for experts: <span className="text-foreground">{r1(vram)} GiB</span> ·{" "}
                {Math.round((vram * GIB) / b.record)} experts
                <Range min={0} max={20} step={0.1} value={vram} onChange={(e) => setVram(Number(e.target.value))} />
              </label>
              <label className="block font-mono text-[11px] text-muted-foreground">
                RAM for experts: <span className="text-foreground">{r1(ram)} GiB</span>
                <Range min={0} max={64} step={0.5} value={ram} onChange={(e) => setRam(Number(e.target.value))} />
              </label>
              <label className="block font-mono text-[11px] text-muted-foreground">
                routing skew s (Zipf, fitted): <span className="text-foreground">{r2(skew)}</span>
                <Range min={0.3} max={1.5} step={0.05} value={skew} onChange={(e) => setSkew(Number(e.target.value))} />
              </label>
              <label className="block font-mono text-[11px] text-muted-foreground">
                SSD: <span className="text-foreground">{r1(ssd)} GB/s</span>
                <Range min={1} max={14} step={0.5} value={ssd} onChange={(e) => setSsd(Number(e.target.value))} />
              </label>
            </>
          )}
          <label className="block font-mono text-[11px] text-muted-foreground">
            tokens kept per window: <span className="text-foreground">{r2(tokens)}</span>
            <Range min={1} max={4} step={0.05} value={tokens} onChange={(e) => setTokens(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            share of bus bandwidth reached: <span className="text-foreground">{r2(eff)}</span>
            <Range min={0.3} max={1} step={0.05} value={eff} onChange={(e) => setEff(Number(e.target.value))} />
          </label>
        </div>

        <div className="mt-5 space-y-2">
          {lanes.map((l) => (
            <div key={l.key} className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-2 sm:grid-cols-[13rem_1fr_4rem]">
              <span className="font-mono text-[10px] text-muted-foreground">{l.label}</span>
              <div className="h-4 overflow-hidden rounded bg-muted/30">
                <div
                  className={cn("h-full", l.ms === slow ? "bg-sky-600" : "bg-sky-300 dark:bg-sky-800")}
                  style={{ width: w(l.ms) }}
                />
              </div>
              <span className="text-right font-mono text-[10px] text-foreground">{r1(l.ms)} ms</span>
            </div>
          ))}
          <div className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-2 sm:grid-cols-[13rem_1fr_4rem]">
            <span className="font-mono text-[10px] text-muted-foreground">drafting, commit, other</span>
            <div className="h-4 overflow-hidden rounded bg-muted/30">
              <div className="h-full bg-slate-400" style={{ width: w(FIX) }} />
            </div>
            <span className="text-right font-mono text-[10px] text-foreground">{FIX} ms</span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[
            ["decode", `${r1(tps)} tok/s`, p.published[b.id] ?? ""],
            [
              "experts served by",
              p.unified ? "one pool" : `${Math.round(hV * 100)} / ${Math.round(hR * 100)} / ${Math.round(hS * 100)}%`,
              p.unified ? "everything resident" : "VRAM / RAM / SSD",
            ],
            ["SSD share allowed for 75", `${r1(ssdMax * 100)}%`, `of ${r2(X / 1e9)} GB a window`],
            ["VRAM hit needed for 75", `${Math.round((1 - cpuMiss) * 100)}%`, "if RAM holds every miss"],
          ].map(([a, v, c]) => (
            <div key={a} className="rounded-md border bg-muted/20 px-2.5 py-2">
              <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{a}</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{v}</dd>
              <dd className="font-mono text-[9px] text-muted-foreground">{c}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The cache sizes are reconstructed from the README&rsquo;s residency readings and the skew is fitted, so
          read the shape, not the decimals. With every expert in VRAM or RAM the CPU lane sets the pace. Take
          the RAM tier away and the SSD lane takes over: at 7 GB/s it can serve about a tenth of a window&rsquo;s
          experts if the 145B is to keep 75 tok/s. On a unified machine nothing is cached or missed; the window
          is the dense read plus the experts over one bus. The M2 Ultra preset overshoots the README by half: that Metal path is limited by its kernels, not by its 800 GB/s.
        </p>
      </div>
    </figure>
  )
}
