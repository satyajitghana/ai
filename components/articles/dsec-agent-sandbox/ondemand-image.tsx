"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// DSec — on-demand image loading, drawn as "what a sandbox actually reads".
//
// Table 3 of the report: for sampled container images, the fraction of image
// data touched at runtime, by language. Pulling the whole image moves and writes
// all of it; on-demand loading over 3FS fetches only the bytes a sandbox reads.
// `read = size * pct / 100` is my arithmetic on the paper's two columns (reasoned),
// shown to the tenth of a GB. Every input number is from the report.

const ACCENT = "oklch(0.62 0.17 28)"

type Row = { lang: string; sizeGB: number; pct: number }

// Table 3, DSec report (image size GB, accessed % at runtime).
const ROWS: Row[] = [
  { lang: "JavaScript", sizeGB: 9.6, pct: 4.2 },
  { lang: "Python", sizeGB: 6.0, pct: 6.0 },
  { lang: "C++", sizeGB: 4.9, pct: 8.7 },
  { lang: "Java", sizeGB: 12.1, pct: 9.2 },
  { lang: "Go", sizeGB: 4.1, pct: 13.3 },
]

const MAX = 12.1 // widest image, for the shared x-scale
const TRACK = 236 // px width of a full-size bar at MAX

export function OndemandImage() {
  const [sel, setSel] = useState(0)
  const row = ROWS[sel]
  const read = (row.sizeGB * row.pct) / 100
  const wasted = row.sizeGB - read

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>container image · bytes read at runtime vs bytes pulled</span>
        <span className="text-muted-foreground/50">DSec, Table 3</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 360 206"
          className="w-full"
          role="img"
          aria-label={`Per-language container image sizes with the fraction actually read at runtime. ${ROWS.map((r) => `${r.lang}: ${r.pct}% of ${r.sizeGB} gigabytes`).join("; ")}.`}
        >
          {ROWS.map((r, i) => {
            const y = 12 + i * 36
            const full = (r.sizeGB / MAX) * TRACK
            const readW = full * (r.pct / 100)
            const active = i === sel
            return (
              <g
                key={r.lang}
                onClick={() => setSel(i)}
                className="cursor-pointer"
                opacity={active ? 1 : 0.62}
              >
                <text x={0} y={y + 15} className="fill-foreground font-mono" fontSize={10}>
                  {r.lang}
                </text>
                {/* full image size */}
                <rect
                  x={74}
                  y={y + 4}
                  width={full}
                  height={16}
                  rx={3}
                  fill="var(--muted)"
                  stroke={active ? ACCENT : "var(--border)"}
                  strokeWidth={active ? 1.5 : 1}
                />
                {/* fraction actually read */}
                <rect x={74} y={y + 4} width={readW} height={16} rx={3} fill={ACCENT} opacity={0.9} />
                <text
                  x={74 + full + 6}
                  y={y + 16}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {r.sizeGB} GB · {r.pct}%
                </text>
              </g>
            )
          })}
        </svg>

        {/* language selector */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">image</span>
          {ROWS.map((r, i) => (
            <button
              key={r.lang}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                sel === i
                  ? "border-foreground/40 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.lang}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Cell label="pulled (eager)" value={`${row.sizeGB.toFixed(1)} GB`} />
          <Cell label="read (on demand)" value={`${read.toFixed(2)} GB`} hot />
          <Cell label="moved for nothing" value={`${wasted.toFixed(2)} GB`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A {row.lang} sandbox touches <span className="text-foreground">{row.pct}%</span> of its{" "}
          <span className="text-foreground">{row.sizeGB.toFixed(1)} GB</span> image, so eager pulling
          transfers and writes <span className="text-foreground">{wasted.toFixed(2)} GB</span> that
          no process ever reads. On-demand loading fetches the metadata locally and streams the{" "}
          <span className="text-foreground">{read.toFixed(2)} GB</span> that is actually used from
          3FS.
        </p>
      </div>
    </figure>
  )
}

function Cell({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/40 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-base font-semibold tabular-nums"
        style={hot ? { color: ACCENT } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
