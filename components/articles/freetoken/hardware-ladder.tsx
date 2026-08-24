"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Six machines, and the two numbers that decide how each one should be served.
//
// Every row pairs Table 1 (measured B_P and B_H, not spec-sheet figures) with the
// W2 coding-agent decode rates of Figure 5. The pairing is the point: the machine
// that wants 91% of its misses filled over PCIe and the machine that wants 25%
// are three rows apart, and no amount of tuning a fixed offloading rule covers
// both.
//
// The two 5090 rows are the control. Same GPU silicon, same link generation,
// different host — and the engines separate by how much of their decode work
// they had parked on the CPU.
//
// The 33 tok/s reference line is the median decode speed of Codex measured in
// production traces, quoted in the paper's Figure 1.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = {
  key: string
  label: string
  gpu: string
  pcie: string
  bp: number
  host: string
  bh: number
  model: string
  ft: number
  kt: number | null
  lcpp: number
  ollama: number | null
  note: string
}

const ROWS: Row[] = [
  {
    key: "4060",
    label: "4060 laptop",
    gpu: "RTX 4060 Laptop · 8 GB",
    pcie: "4.0 ×8",
    bp: 11.8,
    host: "Core i9-13900H · LPDDR5 32 GiB",
    bh: 47.5,
    model: "Qwen3.6-35B-A3B · NVFP4",
    ft: 39.3,
    kt: null,
    lcpp: 22.3,
    ollama: 18.1,
    note: "An 8 GB laptop GPU on half a link, serving a 35B model at 39.3 tok/s — 92% of what the RTX 4090 sustains, and above the 33 tok/s median decode speed measured for Codex in production. The link is the scarce resource here, so three misses in four are computed in place.",
  },
  {
    key: "3090",
    label: "3090",
    gpu: "RTX 3090 · 24 GB",
    pcie: "4.0 ×16",
    bp: 25.3,
    host: "2× Xeon Gold 6330 · DDR4 180 GiB",
    bh: 56.7,
    model: "Qwen3.6-35B-A3B · BF16",
    ft: 36.2,
    kt: 27.4,
    lcpp: 22.1,
    ollama: 18.2,
    note: "The oldest card in the set, and the narrowest margin: 1.3× over KTransformers. A PCIe 4.0 link against 56.7 GB/s of host bandwidth is the balance that suits a CPU-heavy design best, so this is where the competition is closest.",
  },
  {
    key: "4090",
    label: "4090",
    gpu: "RTX 4090 · 24 GB",
    pcie: "4.0 ×16",
    bp: 25.1,
    host: "2× Xeon Platinum 8358P · DDR4 240 GiB",
    bh: 63.2,
    model: "Qwen3.6-35B-A3B · BF16",
    ft: 42.9,
    kt: 31.8,
    lcpp: 25.8,
    ollama: 14.1,
    note: "Same link class as the 3090 with more host bandwidth behind it, which is why the split tips further toward the CPU — 40% fill against the 3090's 45% — even though the GPU is much faster.",
  },
  {
    key: "5090s",
    label: "5090 server",
    gpu: "RTX 5090 · 32 GB",
    pcie: "5.0 ×16",
    bp: 52.7,
    host: "2× Xeon Gold 6459C · DDR5 180 GiB",
    bh: 77.3,
    model: "Qwen3.6-35B-A3B · BF16",
    ft: 76.7,
    kt: 35.5,
    lcpp: 41.1,
    ollama: 32.6,
    note: "The reference machine for every other experiment in the paper. A rented dual-socket box, capped at 6 CPU threads and NUMA-pinned so it behaves like an edge host rather than a server.",
  },
  {
    key: "5090d",
    label: "5090 desktop",
    gpu: "RTX 5090 · 32 GB",
    pcie: "5.0 ×16",
    bp: 49.0,
    host: "Ryzen 9 9950X3D · DDR5 192 GiB",
    bh: 53.8,
    model: "Qwen3.6-35B-A3B · BF16",
    ft: 73.8,
    kt: 34.8,
    lcpp: 33.0,
    ollama: 24.9,
    note: "The control. Identical GPU silicon to the row above; the only change is a real consumer host with two DDR5 channels instead of a server's many. FreeToken gives up 4% of its rate. llama.cpp keeps 80% of its, because its CPU-resident experts are now reading through a much narrower straw.",
  },
  {
    key: "pro6000",
    label: "PRO 6000",
    gpu: "RTX PRO 6000 · 96 GB",
    pcie: "5.0 ×16",
    bp: 51.5,
    host: "Xeon Platinum 8559C · DDR5 512 GiB",
    bh: 178,
    model: "GLM-5.2 · 753B-A40B · NVFP4",
    ft: 14.9,
    kt: null,
    lcpp: 7.3,
    ollama: null,
    note: "A different tier and a different question: not how fast, but whether at all. A 753B-parameter model, a 433 GB checkpoint, on one workstation GPU — twice llama.cpp's rate on bit-identical expert weights, with comparable mean TTFT (7.5 s against 7.8 s). KTransformers has no servable path: its GLM-5.2 methods want 753 GB to 1.5 TB of host-resident experts against the box's 512 GiB.",
  },
]

const ENGINES = [
  { key: "ft", label: "FreeToken", color: ACCENT },
  { key: "kt", label: "KTransformers", color: MUTED },
  { key: "lcpp", label: "llama.cpp", color: MUTED },
  { key: "ollama", label: "Ollama", color: MUTED },
] as const

const CODEX_MEDIAN = 33

export function HardwareLadder() {
  const [sel, setSel] = useState(4)
  const [metric, setMetric] = useState<"tps" | "policy">("tps")
  const cur = ROWS[sel]

  const maxTps = Math.max(...ROWS.map((r) => r.ft))
  const share = (r: Row) => r.bp / r.bh

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          W2 coding agent · SWE issue via OpenCode · bandwidths measured, not spec sheets
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          8 GB laptop → 96 GB workstation
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["tps", "decode tok/s"],
              ["policy", "what the machine wants"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-28 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{r.label}</span>

              {metric === "tps" ? (
                <>
                  <div className="relative h-9 flex-1">
                    {ENGINES.map((e, j) => {
                      const v = r[e.key] as number | null
                      return v == null ? (
                        <span
                          key={e.key}
                          className="absolute left-0 font-mono text-[9px] leading-none text-muted-foreground"
                          style={{ top: j * 8.5 }}
                          title={`${e.label}: cannot serve this model on this machine`}
                        >
                          ×
                        </span>
                      ) : (
                        <div
                          key={e.key}
                          className="absolute left-0 h-[7px] rounded-sm"
                          style={{
                            top: j * 8.5,
                            width: `${(v / maxTps) * 100}%`,
                            background: e.color,
                            opacity: e.key === "ft" ? 1 : 0.45 - j * 0.06,
                          }}
                          title={`${e.label}: ${v} tok/s`}
                        />
                      )
                    })}
                    <div
                      className="absolute top-0 h-9 border-l border-dashed"
                      style={{ left: `${(CODEX_MEDIAN / maxTps) * 100}%`, borderColor: GOOD, opacity: 0.55 }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                    {r.ft}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {(r.ft / Math.max(r.kt ?? 0, r.lcpp, r.ollama ?? 0)).toFixed(1)}×
                  </span>
                </>
              ) : (
                <>
                  <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-muted/40">
                    <div
                      className="h-5"
                      style={{ width: `${share(r) * 100}%`, background: WARM }}
                      title={`fill over PCIe — ${(share(r) * 100).toFixed(0)}%`}
                    />
                    <div
                      className="h-5"
                      style={{ width: `${(1 - share(r)) * 100}%`, background: GOOD, opacity: 0.75 }}
                      title={`compute in place on the CPU — ${((1 - share(r)) * 100).toFixed(0)}%`}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: WARM }}>
                    {(share(r) * 100).toFixed(0)}%
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                    {r.bp}/{r.bh}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {metric === "tps"
            ? ENGINES.map((e, j) => (
                <span key={e.key} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                  <span
                    className="inline-block h-2 w-3 rounded-sm"
                    style={{ background: e.color, opacity: e.key === "ft" ? 1 : 0.45 - j * 0.06 }}
                  />
                  {e.label}
                </span>
              ))
            : (
                [
                  ["fill over PCIe", WARM],
                  ["compute in place on the CPU", GOOD],
                ] as const
              ).map(([l, c]) => (
                <span key={l} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                  <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c }} />
                  {l}
                </span>
              ))}
          {metric === "tps" ? (
            <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: GOOD }}>
              <span className="inline-block h-2 w-3 border-l border-dashed" style={{ borderColor: GOOD }} />
              Codex median, 33 tok/s
            </span>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-foreground">{cur.gpu}</span>
            <span className="font-mono text-[9px] text-muted-foreground">
              PCIe {cur.pcie} · B_P {cur.bp} GB/s · {cur.host} · B_H {cur.bh} GB/s
            </span>
          </div>
          <div className="mt-1 font-mono text-[9px] text-muted-foreground">serving {cur.model}</div>
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{cur.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch to <em> what the machine wants</em>{" "}and read the top and bottom of the list together. The 4060
          laptop wants a quarter of its misses on the link; the 5090 desktop wants{" "}
          <span className="text-foreground">nine-tenths</span>. Those are not adjacent settings of one dial that a
          careful default could split the difference on — they are opposite designs, and both machines are ordinary
          consumer hardware someone actually owns.
          <br />
          <br />
          The two 5090 rows are the cleanest evidence in the paper. Identical GPU, identical link generation, only
          the host changes — and that alone costs llama.cpp a fifth of its decode rate while costing FreeToken 4%.
          A serving engine that decides where work goes at load time is, in effect, guessing at a number it could
          have measured in a second.
        </p>
      </div>
    </figure>
  )
}
