"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Colibri's dual-SSD mode, and why it is a hash rather than a RAID.
//
// Decode here is disk-bound, and expert reads are read-only — so a second drive
// holding a second copy of the model is pure additional bandwidth. The catch is
// that naive mirroring caches everything twice and sends the prefetch and the
// demand read to different drives.
//
// Colibri instead routes each expert to one drive by a deterministic hash,
// weighted by the two drives' measured bandwidth (or by COLI_DISK_WEIGHTS).
// Readahead and the demand read therefore always land on the same drive, and
// nothing is cached twice. Aggregate bandwidth is the sum.
//
// The 9 + 3 GB/s example and the ~33% figure are the README's own; everything
// else here is arithmetic on the two sliders. A partial mirror is a supported
// case: the README notes divergent or missing files silently stay on the
// primary, so a smaller second drive holding some shards still helps.

const PRIMARY = "oklch(0.60 0.15 255)"
const MIRROR = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const BYTES_PER_TOKEN = 11 // GB pulled across NVMe for a cold token

export function DiskStriping() {
  const [fast, setFast] = useState(90) // tenths of a GB/s
  const [slow, setSlow] = useState(30)
  const [coverage, setCoverage] = useState(100) // % of the model the mirror holds

  const A = fast / 10
  const B = (slow / 10) * (coverage / 100) // a partial mirror serves proportionally less
  const total = A + B
  const gain = total / A

  const soloSec = BYTES_PER_TOKEN / A
  const dualSec = BYTES_PER_TOKEN / total

  // deterministic hash split, weighted by bandwidth
  const shareA = A / total

  const W = 700
  const BAR = W - 132
  const X0 = 120

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          streaming experts from two drives at once
        </span>
        <span className="font-mono text-[10px]" style={{ color: MIRROR }}>
          {total.toFixed(1)} GB/s aggregate · {((gain - 1) * 100).toFixed(0)}% faster than the primary alone
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 128`} width={W} height={128} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two bandwidth bars: a primary drive at ${A.toFixed(1)} GB/s and a mirror contributing ${B.toFixed(1)} GB/s, for ${total.toFixed(1)} GB/s aggregate. Experts are split between them by a weighted deterministic hash, ${(shareA * 100).toFixed(0)} percent to the primary.`}
            </title>

            {[
              { l: "primary SSD", v: A, c: PRIMARY, y: 8, sub: `${(shareA * 100).toFixed(0)}% of experts routed here` },
              { l: "mirror SSD", v: B, c: MIRROR, y: 44, sub: coverage < 100 ? `holds ${coverage}% of the model` : "full second copy" },
            ].map((b) => (
              <g key={b.l}>
                <text x={X0 - 10} y={b.y + 14} fontSize={9} textAnchor="end" fill={b.c} fontFamily="ui-monospace, monospace">
                  {b.l}
                </text>
                <text x={X0 - 10} y={b.y + 25} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {b.sub}
                </text>
                <rect x={X0} y={b.y} width={BAR} height={20} rx={3} fill="currentColor" fillOpacity={0.05} />
                <rect
                  x={X0}
                  y={b.y}
                  width={Math.max(2, (b.v / 20) * BAR)}
                  height={20}
                  rx={3}
                  fill={b.c}
                  fillOpacity={0.8}
                />
                <text x={X0 + (b.v / 20) * BAR + 7} y={b.y + 14} fontSize={9} fill={b.c} fontFamily="ui-monospace, monospace">
                  {b.v.toFixed(1)} GB/s
                </text>
              </g>
            ))}

            <line x1={X0} y1={80} x2={X0 + BAR} y2={80} stroke="currentColor" strokeOpacity={0.15} />
            <text x={X0 - 10} y={100} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              one cold token
            </text>
            <text x={X0} y={100} fontSize={9} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              ~{BYTES_PER_TOKEN} GB read →{" "}
              <tspan fill={PRIMARY}>{soloSec.toFixed(2)}s</tspan> on one drive,{" "}
              <tspan fill={MIRROR}>{dualSec.toFixed(2)}s</tspan> on two
            </text>
            <text x={X0} y={116} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
              bandwidth is the whole story here — the arithmetic is just bytes ÷ GB/s
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["primary", fast, setFast, 10, 200, 5, PRIMARY, "primary drive bandwidth, in tenths of a gigabyte per second", (v: number) => `${(v / 10).toFixed(1)}`],
              ["mirror", slow, setSlow, 0, 200, 5, MIRROR, "mirror drive bandwidth, in tenths of a gigabyte per second", (v: number) => `${(v / 10).toFixed(1)}`],
              ["mirror holds", coverage, setCoverage, 0, 100, 5, MUTED, "how much of the model the second drive has room for", (v: number) => `${v}%`],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria, fmt]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {fmt(v)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              ["9 + 3 GB/s — the README's example", 90, 30, 100],
              ["two matched 7 GB/s drives", 70, 70, 100],
              ["small second drive, 40% of the model", 90, 70, 40],
              ["no mirror", 90, 0, 100],
            ] as const
          ).map(([label, f, s, c]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFast(f)
                setSlow(s)
                setCoverage(c)
              }}
              aria-pressed={fast === f && slow === s && coverage === c}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fast === f && slow === s && coverage === c
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          If the bottleneck really is disk bandwidth, and expert reads really are read-only, then a
          second drive is not a cache strategy — it is simply more bandwidth, and the gain is
          arithmetic. The README&rsquo;s own example is a 9 GB/s primary paired with a 3 GB/s
          secondary reading experts <span className="text-foreground">about 33% faster</span>{" "}than
          the fast drive alone, which is exactly 12 over 9.
          <br />
          <br />
          The design detail that makes it work is that this is{" "}
          <span className="text-foreground">not a RAID mirror</span>. Each expert is routed to one
          drive by a deterministic hash weighted by measured bandwidth, so the prefetch and the
          demand read always land on the same drive and nothing is cached twice. Divergent or missing
          files silently stay on the primary, which is why the third slider matters: a second SSD too
          small for the whole model still contributes, in proportion to what it holds.
          <br />
          <br />
          And the honest note the project attaches to it: the bandwidth model is sound and the
          routing is validated, but{" "}
          <span style={{ color: MUTED }}>
            cold-cache one-drive versus two-drive runs on genuinely independent controllers are
            listed as an experiment still needed
          </span>
          . Two drives hanging off one saturated controller add nothing, and the README says so
          rather than letting you find out.
        </p>
      </div>
    </figure>
  )
}
