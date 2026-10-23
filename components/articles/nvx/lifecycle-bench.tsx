"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// NVX's own CI history, one vCPU, 128 MiB shell guest for the lifecycle metrics.
// Source: microsoft/nvx at 1f9e0c7, data/<series>-microvm-v2-1vcpu.csv and the
// 2/4/8-vCPU files. Each CSV row is the p50 of one CI run at one commit; there
// are 288 commits per series. "latest" is the last commit's p50 (2971c63831);
// lo / med / hi are the minimum, median and maximum of those 288 p50 values.
// All three series run on Azure Standard_D8s_v5 virtual machines, so every
// number is a nested-virtualization number. Nothing here was run by me.

type Stat = { latest: number; med: number; lo: number; hi: number }
type Series = {
  id: string
  label: string
  host: string
  cold: Stat
  restore: Stat
  teardown: Stat
  generation: Stat
  rssCold: Stat
  rssRestore: Stat
  vcpu: [number, number, number, number]
}

const SERIES: Series[] = [
  {
    id: "kvm",
    label: "Linux / KVM",
    host: "Xeon Platinum 8370C, kernel 6.6 (Azure Linux 3)",
    cold: { latest: 278.0, med: 273.8, lo: 258.1, hi: 288.2 },
    restore: { latest: 61.5, med: 59.4, lo: 29.7, hi: 72.2 },
    teardown: { latest: 63.3, med: 64.9, lo: 54.8, hi: 81.3 },
    generation: { latest: 1.2, med: 1.2, lo: 1.0, hi: 1.3 },
    rssCold: { latest: 80.0, med: 77.3, lo: 74.7, hi: 80.1 },
    rssRestore: { latest: 35.5, med: 34.6, lo: 33.2, hi: 36.1 },
    vcpu: [62.6, 52.2, 65.4, 72.1],
  },
  {
    id: "mshv",
    label: "Linux / MSHV",
    host: "Xeon Platinum 8573C, kernel 6.18 mshv",
    cold: { latest: 225.3, med: 226.9, lo: 198.1, hi: 241.7 },
    restore: { latest: 33.0, med: 34.8, lo: 27.9, hi: 39.5 },
    teardown: { latest: 21.4, med: 23.2, lo: 18.8, hi: 47.3 },
    generation: { latest: 4.6, med: 4.2, lo: 3.1, hi: 5.6 },
    rssCold: { latest: 81.1, med: 80.2, lo: 77.1, hi: 81.6 },
    rssRestore: { latest: 61.4, med: 59.6, lo: 55.4, hi: 61.9 },
    vcpu: [41.1, 47.1, 45.0, 52.3],
  },
  {
    id: "whp",
    label: "Windows / WHP",
    host: "Xeon Platinum 8370C, Windows build 26100",
    cold: { latest: 536.4, med: 477.2, lo: 412.9, hi: 623.2 },
    restore: { latest: 154.7, med: 124.2, lo: 108.1, hi: 200.5 },
    teardown: { latest: 60.2, med: 50.3, lo: 42.0, hi: 67.9 },
    generation: { latest: 1041.2, med: 1020.5, lo: 742.0, hi: 1270.4 },
    rssCold: { latest: 76.4, med: 76.0, lo: 73.8, hi: 76.5 },
    rssRestore: { latest: 18.7, med: 18.5, lo: 18.1, hi: 19.1 },
    vcpu: [145.8, 171.7, 157.8, 164.0],
  },
]

const MS_MAX = 1300
const MIB_MAX = 90

function pct(v: number, max: number) {
  return `${Math.min(100, (v / max) * 100).toFixed(2)}%`
}

function Bar({ name, s, max, unit, tone }: { name: string; s: Stat; max: number; unit: string; tone: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 text-xs sm:grid-cols-[10rem_1fr_5rem]">
      <span className="text-muted-foreground">{name}</span>
      <div className="relative h-4 rounded bg-muted/40">
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full opacity-40"
          style={{ left: pct(s.lo, max), width: `calc(${pct(s.hi, max)} - ${pct(s.lo, max)})`, background: tone }}
          title={`range over 288 commits: ${s.lo}–${s.hi} ${unit}`}
        />
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: pct(s.latest, max), background: tone, opacity: 0.75 }} />
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: pct(s.med, max) }} title={`median ${s.med} ${unit}`} />
      </div>
      <span className="text-right font-mono tabular-nums">
        {s.latest} {unit}
      </span>
    </div>
  )
}

export function LifecycleBench() {
  const [id, setId] = useState("kvm")
  const s = SERIES.find((x) => x.id === id) ?? SERIES[0]
  const ratio = (s.cold.latest / s.restore.latest).toFixed(1)
  const vmax = 180

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">NVX CI · 1 vCPU · p50 per commit · nested VMs</span>
        <div className="flex gap-1">
          {SERIES.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === id}
              onClick={() => setId(x.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                x.id === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latency, ms (0 to {MS_MAX})</div>
          <Bar name="cold start" s={s.cold} max={MS_MAX} unit="ms" tone="oklch(0.62 0.14 40)" />
          <Bar name="snapshot restore" s={s.restore} max={MS_MAX} unit="ms" tone="oklch(0.58 0.13 200)" />
          <Bar name="exit + teardown" s={s.teardown} max={MS_MAX} unit="ms" tone="oklch(0.58 0.06 260)" />
          <Bar name="snapshot generation" s={s.generation} max={MS_MAX} unit="ms" tone="oklch(0.55 0.12 320)" />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">OpenVMM peak RSS, MiB (0 to {MIB_MAX})</div>
          <Bar name="cold-started VM" s={s.rssCold} max={MIB_MAX} unit="MiB" tone="oklch(0.62 0.14 40)" />
          <Bar name="restored VM" s={s.rssRestore} max={MIB_MAX} unit="MiB" tone="oklch(0.58 0.13 200)" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            512 MiB shell restore by vCPU count, latest p50 (ms)
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 4, 8].map((n, i) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="relative h-20 w-full max-w-12 rounded bg-muted/40">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded"
                    style={{ height: pct(s.vcpu[i], vmax), background: "oklch(0.58 0.13 200)", opacity: 0.75 }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums">{s.vcpu[i]}</span>
                <span className="text-[11px] text-muted-foreground">
                  {n} vCPU
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {s.label} on {s.host}, Azure Standard_D8s_v5. Solid bar: latest commit&apos;s p50. Black tick: median of 288 per-commit p50s.
        Faint band: their range. Cold start over restore at the latest commit: {ratio}× (reasoned). Reported by NVX&apos;s CI in{" "}
        <code>data/*.csv</code>; not re-run here.
      </figcaption>
    </figure>
  )
}
