"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What QSA changes, and what it costs.
//
// Sparse attention needs a selector, and DeepSeek-style DSA runs that selector
// at token granularity: score the query against every key, take the top-k. The
// attention that follows is cheap and flat, but the selector is linear in
// context, so at a million tokens the thing choosing the 2,048 positions costs
// more than reading them.
//
// QSA compresses the sequence into micro-blocks first — `indexer_compress_ratio`
// is 4 in the published config — scores importance per block, and selects
// regions. That divides both the scan and the indexer's own cache by four. It
// also does the compression independently in each layer rather than sharing
// indices across layers, which matters here specifically: in a hybrid where GDN
// and attention layers alternate, there is much less cross-layer attention
// similarity to exploit.
//
// The left panel is arithmetic on the config constants. The right panel is
// Tables 2 and 3 of the technical report, which is where it gets interesting —
// QSA is very slightly *worse* than full attention in the middle of the range
// and clearly better at the ends.

const TOKEN = "oklch(0.68 0.13 85)"
const BLOCK = "oklch(0.55 0.16 155)"
const ACCENT = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 27)"

const RATIO = 4 // indexer_compress_ratio
const BUDGET = 2048 // indexer_budget

// Table 3: RULER averaged over length bands, and 8-needle MRCR
const LONG = [
  { band: "≤128K", ruler: [99.84, 99.89], mrcr: [97.14, 95.98] },
  { band: "128–256K", ruler: [99.81, 99.62], mrcr: [94.2, 93.0] },
  { band: "256–512K", ruler: [97.65, 98.95], mrcr: [30.66, 40.53] },
  { band: "512K–1M", ruler: [90.08, 93.0], mrcr: [20.71, 26.44] },
]

const CTX = [4096, 16384, 65536, 262144, 1048576]

export function QsaIndexer() {
  const [bench, setBench] = useState<"ruler" | "mrcr">("mrcr")

  const W = 700
  const H = 200
  const X0 = 44
  const X1 = 320
  const Y0 = 18
  const Y1 = 150

  const scanned = (L: number, blocked: boolean) => (blocked ? L / RATIO : L)
  const maxScan = scanned(CTX[CTX.length - 1], false)
  const PX = (i: number) => X0 + (i / (CTX.length - 1)) * (X1 - X0)
  const PY = (v: number) => Y1 - (v / maxScan) * (Y1 - Y0)

  const line = (blocked: boolean) =>
    CTX.map((L, i) => `${i === 0 ? "M" : "L"} ${PX(i).toFixed(2)} ${PY(scanned(L, blocked)).toFixed(2)}`).join(" ")

  // right panel
  const RX0 = 400
  const rows = LONG.map((b) => ({ band: b.band, full: b[bench][0], qsa: b[bench][1] }))
  const RH = 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the selector, and what selecting differently costs in accuracy
        </span>
        <span className="font-mono text-[10px]" style={{ color: BLOCK }}>
          7.6× prefill · 4.9× decode, at 1M
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["mrcr", "8-needle MRCR"],
              ["ruler", "RULER"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setBench(k)}
              aria-pressed={bench === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                bench === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[680px] max-w-full">
            <title>
              {`Left: two curves of indexer entries scanned against context length, one linear in tokens and one a quarter of it. Right: ${bench === "mrcr" ? "8-needle MRCR" : "RULER"} scores for full attention against QSA in four length bands, showing QSA slightly behind below 256K and ahead beyond it.`}
            </title>

            {/* left: the scan */}
            <text x={X0 - 36} y={14} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              indexer entries scanned
            </text>
            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <path d={line(false)} fill="none" stroke={TOKEN} strokeWidth={2.2} />
            <path d={line(true)} fill="none" stroke={BLOCK} strokeWidth={2.4} />
            <text x={X1 - 4} y={PY(maxScan) + 14} fontSize={8} textAnchor="end" fill={TOKEN} fontFamily="ui-monospace, monospace">
              token-level (DSA) — 1.0M
            </text>
            <text x={X1 - 4} y={PY(maxScan / RATIO) - 7} fontSize={8} textAnchor="end" fill={BLOCK} fontFamily="ui-monospace, monospace">
              micro-block (QSA) — 262k
            </text>
            {CTX.map((L, i) => (
              <text key={L} x={PX(i)} y={Y1 + 13} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                {L >= 1048576 ? "1M" : L >= 1024 ? `${L / 1024}k` : L}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={H - 22} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              context length
            </text>
            <text x={(X0 + X1) / 2} y={H - 8} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
              attention itself reads a fixed {BUDGET} either way
            </text>

            {/* right: the measured quality */}
            <text x={RX0} y={14} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              {bench === "mrcr" ? "8-needle MRCR" : "RULER"} · full attention vs QSA
            </text>
            {rows.map((r, i) => {
              const y = 26 + i * RH
              const d = r.qsa - r.full
              const scale = 2.2
              return (
                <g key={r.band}>
                  <text x={RX0} y={y + 9} fontSize={8} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                    {r.band}
                  </text>
                  <text x={RX0 + 62} y={y + 9} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {r.full.toFixed(2)} → {r.qsa.toFixed(2)}
                  </text>
                  <line x1={RX0 + 172} y1={y + 4} x2={RX0 + 172} y2={y + 16} stroke="currentColor" strokeOpacity={0.25} />
                  <rect
                    x={d >= 0 ? RX0 + 172 : RX0 + 172 + d * scale}
                    y={y + 4}
                    width={Math.max(2, Math.abs(d) * scale)}
                    height={11}
                    rx={2}
                    fill={d >= 0 ? BLOCK : BAD}
                    fillOpacity={0.8}
                  />
                  <text
                    x={d >= 0 ? RX0 + 176 + Math.abs(d) * scale : RX0 + 168 + d * scale}
                    y={y + 13}
                    fontSize={7.5}
                    textAnchor={d >= 0 ? "start" : "end"}
                    fill={d >= 0 ? BLOCK : BAD}
                    fontFamily="ui-monospace, monospace"
                  >
                    {d >= 0 ? "+" : ""}
                    {d.toFixed(2)}
                  </text>
                </g>
              )
            })}
            <text x={RX0} y={H - 22} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              Table 3, technical report
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "compression ratio", v: `${RATIO}×`, c: BLOCK },
            { l: "selected budget", v: BUDGET.toLocaleString(), c: ACCENT },
            { l: "indexer heads", v: "4 · 1 KV head", c: ACCENT },
            { l: "MTP accepted length", v: "4.06 → 4.07", c: BLOCK },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The left panel is the whole idea in one line: attention reads a fixed 2,048 positions
          whatever the context, so the only term still growing is the selector, and QSA divides that
          term by four by scoring blocks instead of tokens. At a million tokens the indexer looks at
          262,144 entries instead of a million, and carries a quarter of the cache doing it.
          <br />
          <br />
          The right panel is the part I did not expect. On MRCR, QSA is{" "}
          <span style={{ color: BAD }}>behind full attention below 256K</span>{" "}— −1.16 and −1.20 —
          and then ahead by <span style={{ color: BLOCK }}>+9.87 at 512K and +5.73 at 1M</span>. A
          compressed index should lose information, and at moderate lengths it does. What it buys is
          that the surviving signal stays usable when the sequence gets long enough that full
          attention&rsquo;s own scores go soft.{" "}
          <span className="text-foreground">
            The efficiency argument and the quality argument point the same way here, which is not
            how sparse attention usually goes
          </span>{" "}
          — and it is worth being clear that the crossover is real, so a workload that lives at 128K
          is taking a small loss for the speed.
        </p>
      </div>
    </figure>
  )
}
