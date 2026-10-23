"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Measured on a shared 4-core cloud VM, CPU only, load average 13-15 during the runs:
// cua SDK 0.7.0 (Python, embedded) -> cua-spacesd 0.7.0 on 127.0.0.1 -> Xvfb 1280x800 +
// matchbox + Chromium. 20 timed calls per action after one warm-up; median and p10-p90.
// "default": cua-driver's stock 800 ms post-action window watch.
// "100 ms": the same binary with CUA_DRIVER_WINDOW_CHANGE_TIMEOUT_MS=100 on the daemon.
// Fan-out: one scripted UI job per Space (find window, read AX tree, select the text area,
// type, re-read, press Save, screenshot, shell), run one Space after another or all at
// once with asyncio.gather. Medians of 5 rounds (2 Spaces) and 4 rounds (3 Spaces).

type Row = { label: string; d: [number, number, number]; f: [number, number, number] }

// [median, p10, p90] in ms; d = default, f = 100 ms override
const ROWS: Row[] = [
  { label: "screenshot (gRPC)", d: [8.4, 7.7, 9.1], f: [50.2, 11.5, 163.3] },
  { label: "bash true", d: [109.8, 35.7, 146.2], f: [33.7, 7.0, 78.8] },
  { label: "list_windows", d: [462.8, 383.3, 569.7], f: [325.1, 212.8, 583.8] },
  { label: "get_window_state, tree", d: [645.1, 500.5, 989.7], f: [1225.4, 937.2, 1486.5] },
  { label: "get_window_state, pixels", d: [689.6, 346.0, 1026.9], f: [497.8, 348.2, 651.3] },
  { label: "get_desktop_state", d: [770.2, 568.5, 1472.7], f: [783.8, 555.2, 978.3] },
  { label: "click (foreground)", d: [1347.1, 1221.6, 2491.3], f: [659.3, 488.8, 1114.2] },
  { label: "type_text, 10 chars", d: [1369.8, 1230.0, 2206.0], f: [600.1, 497.9, 915.0] },
  { label: "press_key", d: [1213.7, 1100.0, 2700.1], f: [550.3, 440.5, 702.8] },
]

const FAN = [
  { n: 2, seq: 15077, con: 8037 },
  { n: 3, seq: 22176, con: 8933 },
]

const X0 = 210
const W = 720 // px for MAX ms
const MAX = 2800
const px = (ms: number) => Math.round((ms * W) / MAX)

export function LatencyChart() {
  const [tab, setTab] = useState<"actions" | "fanout">("actions")
  const [mode, setMode] = useState<"d" | "f" | "both">("d")

  const rowH = mode === "both" ? 34 : 26
  const h = 40 + ROWS.length * rowH + 30

  return (
    <figure className="my-8 rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        {(["actions", "fanout"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "rounded border px-2 py-1 font-mono",
              tab === t ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "actions" ? "per action" : "fan-out"}
          </button>
        ))}
        {tab === "actions" ? (
          <span className="ml-auto flex flex-wrap gap-2">
            {(
              [
                ["d", "stock 800 ms watch"],
                ["f", "watch cut to 100 ms"],
                ["both", "both"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn(
                  "rounded border px-2 py-1 font-mono",
                  mode === k ? "border-sky-600 text-sky-700 dark:text-sky-300" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        {tab === "actions" ? (
          <svg
            viewBox={`0 0 1000 ${h}`}
            className="w-full min-w-[640px]"
            role="img"
            aria-label="Median latency per action with p10 to p90 whiskers. A gRPC screenshot takes about 8 milliseconds; reading the accessibility tree takes 0.6 to 1.2 seconds; a foreground click, typing ten characters and a key press each take about 1.2 to 1.4 seconds with the stock 800 millisecond window watch, and about 0.55 to 0.66 seconds with it cut to 100 milliseconds."
          >
            {[0, 500, 1000, 1500, 2000, 2500].map((t) => (
              <g key={t}>
                <line x1={X0 + px(t)} y1={28} x2={X0 + px(t)} y2={h - 26} className="stroke-border" strokeWidth={1} />
                <text x={X0 + px(t)} y={h - 10} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                  {t === 0 ? "0" : `${t / 1000} s`}
                </text>
              </g>
            ))}
            {ROWS.map((r, i) => {
              const y = 40 + i * rowH
              const series: { k: "d" | "f"; v: [number, number, number] }[] =
                mode === "both" ? [{ k: "d", v: r.d }, { k: "f", v: r.f }] : [{ k: mode, v: mode === "d" ? r.d : r.f }]
              return (
                <g key={r.label}>
                  <text x={X0 - 10} y={y + (mode === "both" ? 16 : 12)} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 12 }}>
                    {r.label}
                  </text>
                  {series.map((s, j) => {
                    const yy = y + j * 14
                    const cls = s.k === "d" ? "fill-sky-600/80 dark:fill-sky-400/80" : "fill-emerald-600/80 dark:fill-emerald-400/80"
                    return (
                      <g key={s.k}>
                        <rect x={X0} y={yy + 2} width={Math.max(px(s.v[0]), 2)} height={12} rx={2} className={cls} />
                        <line x1={X0 + px(s.v[1])} y1={yy + 8} x2={X0 + px(s.v[2])} y2={yy + 8} className="stroke-foreground/70" strokeWidth={1.5} />
                        <line x1={X0 + px(s.v[1])} y1={yy + 4} x2={X0 + px(s.v[1])} y2={yy + 12} className="stroke-foreground/70" strokeWidth={1.5} />
                        <line x1={X0 + px(s.v[2])} y1={yy + 4} x2={X0 + px(s.v[2])} y2={yy + 12} className="stroke-foreground/70" strokeWidth={1.5} />
                        <text x={X0 + px(s.v[2]) + 6} y={yy + 12} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                          {s.v[0] < 100 ? `${s.v[0]} ms` : `${Math.round(s.v[0])} ms`}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        ) : (
          <svg
            viewBox="0 0 1000 200"
            className="w-full min-w-[640px]"
            role="img"
            aria-label="One scripted job per Space. Two Spaces: 15.1 seconds one after another, 8.0 seconds at once. Three Spaces: 22.2 seconds one after another, 8.9 seconds at once."
          >
            {FAN.map((f, i) => {
              const y = 30 + i * 80
              const s = (ms: number) => Math.round((ms * 700) / 24000)
              return (
                <g key={f.n}>
                  <text x={20} y={y + 26} className="fill-foreground font-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {`${f.n} Spaces`}
                  </text>
                  <rect x={160} y={y} width={s(f.seq)} height={20} rx={3} className="fill-muted-foreground/50" />
                  <text x={166 + s(f.seq)} y={y + 15} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
                    {`one after another ${(f.seq / 1000).toFixed(1)} s`}
                  </text>
                  <rect x={160} y={y + 26} width={s(f.con)} height={20} rx={3} className="fill-sky-600/80 dark:fill-sky-400/80" />
                  <text x={166 + s(f.con)} y={y + 41} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
                    {`all at once ${(f.con / 1000).toFixed(1)} s`}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <figcaption className="border-t px-3 py-2 text-sm text-muted-foreground">
        {tab === "actions"
          ? "Measured: 20 calls per action, median bar, p10 to p90 whisker, shared 4-core VM under load. The input actions lose about 0.7 s each when the post-action window watch drops from 800 ms to 100 ms; the reads do not, and their spread is load noise."
          : "Measured: the job spends its time waiting on the driver's own settle and watch windows, not on CPU, so concurrent jobs overlap almost completely."}
      </figcaption>
    </figure>
  )
}
