"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { COLS, MONTHS } from "./data"

// What a query against tiktok-5.6B-videos actually downloads.
//
// A Parquet reader over HTTP fetches three things: the footer of every file it
// opens, and, for every row group it cannot rule out, the column chunks the
// query names. Everything else in the file is never requested. So the cost of
// a query is arithmetic on the footer metadata, and data.ts holds that
// metadata for all 148 monthly files, measured by range-reading each footer.
//
// Two layouts of the same query are offered. "Name the files" lists the
// monthly files in FROM, so only their footers are read. "Glob + WHERE" points
// at data/*.parquet and filters on posted_at: the reader then opens all 148
// footers, rules out every row group whose posted_at min/max misses the range,
// and must read posted_at itself for the row groups it keeps.
//
// Pure arithmetic on committed numbers; renders identically on the server.

const POSTED = COLS.indexOf("posted_at")
const TOTAL_SIZE = MONTHS.reduce((a, m) => a + m.size, 0)
const ALL_FOOTERS = MONTHS.reduce((a, m) => a + m.footer, 0)
// Measured: DuckDB 1.5.6 read 184.7 MiB in 26.7 s from huggingface.co for
// SELECT count(*), sum(views) over data/2026-09.parquet.
const MEASURED_BPS = (184.7 * 1048576) / 26.7

const PRESETS: { label: string; cols: string[]; from: string; to: string }[] = [
  { label: "card's hashtag top 20", cols: ["hashtags"], from: "2026-09", to: "2026-09" },
  { label: "views trend, all months", cols: ["posted_at", "views"], from: "2014-07", to: "2026-10" },
  { label: "AI-flag share, 2026", cols: ["is_ai_generated"], from: "2026-01", to: "2026-10" },
  { label: "caption search, 2025", cols: ["caption"], from: "2025-01", to: "2025-12" },
  { label: "SELECT *, one month", cols: [...COLS], from: "2026-09", to: "2026-09" },
]

function fmtBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} kB`
  return `${b} B`
}

function fmtTime(s: number): string {
  if (s < 90) return `${s.toFixed(0)} s`
  if (s < 5400) return `${(s / 60).toFixed(0)} min`
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`
  return `${(s / 86400).toFixed(1)} days`
}

function idx(m: string): number {
  const i = MONTHS.findIndex((x) => x.m === m)
  return i < 0 ? 0 : i
}

export function QueryCost() {
  const [sel, setSel] = useState<string[]>(["hashtags"])
  const [lo, setLo] = useState(idx("2026-09"))
  const [hi, setHi] = useState(idx("2026-09"))
  const [glob, setGlob] = useState(false)
  const [oneDay, setOneDay] = useState(false)

  const a = Math.min(lo, hi)
  const b = Math.max(lo, hi)
  const inRange = MONTHS.slice(a, b + 1)
  const colIdx = sel.map((c) => COLS.indexOf(c as (typeof COLS)[number])).filter((i) => i >= 0)
  const day = oneDay && a === b
  const needPosted = (glob || day) && !colIdx.includes(POSTED)
  const readIdx = needPosted ? [...colIdx, POSTED] : colIdx

  const colBytes = inRange.reduce(
    (acc, m) => acc + readIdx.reduce((s, j) => s + m.bytes[j], 0) * (day ? m.day : 1),
    0
  )
  const footers = glob ? ALL_FOOTERS : inRange.reduce((s, m) => s + m.footer, 0)
  const read = colBytes + footers
  const download = inRange.reduce((s, m) => s + m.size, 0)
  const rows = inRange.reduce((s, m) => s + m.rows, 0)
  const rgsAll = inRange.reduce((s, m) => s + m.rgs, 0)
  const rgs = day ? Math.round(inRange[0].rgs * inRange[0].day) : rgsAll
  const share = read / TOTAL_SIZE
  const shareOfRange = download > 0 ? read / download : 0

  const toggle = (c: string) =>
    setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))

  const fromA = MONTHS[a].m
  const fromB = MONTHS[b].m
  const base = "hf://datasets/datasocial/tiktok-5.6B-videos/data/"
  const list = sel.length === 0 ? "count(*)" : sel.length > 6 ? "*" : sel.join(", ")
  const nextMonth = (() => {
    const [y, mo] = fromB.split("-").map(Number)
    const ny = mo === 12 ? y + 1 : y
    const nm = mo === 12 ? 1 : mo + 1
    return `${ny}-${String(nm).padStart(2, "0")}-01`
  })()
  const dayWhere = `WHERE posted_at >= TIMESTAMP '${fromA}-02'\n  AND posted_at <  TIMESTAMP '${fromA}-03'\n-- cost shown: the month's median day`
  const sql = day
    ? `SELECT ${list}\nFROM '${base}${glob ? "*" : fromA}.parquet'\n${dayWhere};`
    : glob
    ? `SELECT ${list}\nFROM '${base}*.parquet'\nWHERE posted_at >= TIMESTAMP '${fromA}-01'\n  AND posted_at <  TIMESTAMP '${nextMonth}';`
    : a === b
      ? `SELECT ${list}\nFROM '${base}${fromA}.parquet';`
      : `SELECT ${list}\nFROM read_parquet([\n  '${base}${fromA}.parquet',\n  -- … one entry per month …\n  '${base}${fromB}.parquet'\n]);`

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <p className="my-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        presets
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setSel(p.cols)
              setLo(idx(p.from))
              setHi(idx(p.to))
            }}
            className="rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        columns the query names ({sel.length} of {COLS.length})
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {COLS.map((c) => {
          const on = sel.includes(c)
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              aria-pressed={on}
              className={
                "rounded border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors " +
                (on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted")
              }
            >
              {c}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block font-mono text-[11px]">
          <span className="text-muted-foreground">first month</span> {MONTHS[lo].m}
          <Range
            min={0}
            max={MONTHS.length - 1}
            value={lo}
            onChange={(e) => setLo(Number(e.target.value))}
            aria-label="First month in the query range"
            className="mt-1 w-full"
          />
        </label>
        <label className="block font-mono text-[11px]">
          <span className="text-muted-foreground">last month</span> {MONTHS[hi].m}
          <Range
            min={0}
            max={MONTHS.length - 1}
            value={hi}
            onChange={(e) => setHi(Number(e.target.value))}
            aria-label="Last month in the query range"
            className="mt-1 w-full"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
        {[
          { v: false, t: "name the files in FROM" },
          { v: true, t: "glob data/*.parquet + WHERE posted_at" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setGlob(o.v)}
            aria-pressed={glob === o.v}
            className={
              "rounded border px-2 py-1 transition-colors " +
              (glob === o.v
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted")
            }
          >
            {o.t}
          </button>
        ))}
      </div>

      <label className="mt-2 flex items-center gap-2 font-mono text-[11px]">
        <input
          type="checkbox"
          checked={oneDay}
          disabled={a !== b}
          onChange={(e) => setOneDay(e.target.checked)}
        />
        <span className={a !== b ? "text-muted-foreground" : ""}>
          narrow to one day of the month (single month only)
        </span>
      </label>

      <pre className="mt-3 overflow-x-auto rounded border bg-background p-2 font-mono text-[11px] leading-5">
        {sql}
      </pre>

      <div className="mt-3">
        <svg
          viewBox="0 0 400 22"
          className="h-auto w-full"
          role="img"
          aria-label={`The query reads ${fmtBytes(read)} of the ${fmtBytes(TOTAL_SIZE)} dataset.`}
        >
          <rect x={0} y={4} width={400} height={14} rx={2} fill="var(--border)" />
          <rect
            x={0}
            y={4}
            width={Math.max(400 * (download / TOTAL_SIZE), 0.5)}
            height={14}
            rx={2}
            fill="oklch(0.70 0.08 255)"
            opacity={0.45}
          />
          <rect
            x={0}
            y={4}
            width={Math.max(400 * share, 0.8)}
            height={14}
            rx={2}
            fill="oklch(0.58 0.16 35)"
          />
        </svg>
        <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
          Orange: bytes the reader fetches. Pale blue: the files in the range,
          if you downloaded them. Grey: the whole 460 GB dataset.
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">bytes fetched</dt>
          <dd className="my-0">{fmtBytes(read)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">of the files in range</dt>
          <dd className="my-0">{(shareOfRange * 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">footers read</dt>
          <dd className="my-0">
            {glob ? MONTHS.length : inRange.length} · {fmtBytes(footers)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">at 7.3 MB/s</dt>
          <dd className="my-0">{fmtTime(read / MEASURED_BPS)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">rows in range</dt>
          <dd className="my-0">{rows.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">row groups kept</dt>
          <dd className="my-0">
            {day ? "≈ " : ""}
            {rgs.toLocaleString("en-US")} of {rgsAll.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">download instead</dt>
          <dd className="my-0">{fmtBytes(download)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">posted_at added</dt>
          <dd className="my-0">{needPosted ? "yes, for the filter" : "no"}</dd>
        </div>
      </dl>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        Every number is computed from the 148 footers this article read by
        range request. It counts column chunks plus footers and leaves out
        bloom filters, which only help an equality filter. The one-day option
        uses, for that month, the median over its days of the share of
        row-group bytes whose posted_at min/max overlaps the day. Some row
        groups span the whole month and can never be skipped, which is why a
        day costs far more than a thirtieth of a month. The transfer time
        uses the rate DuckDB achieved here for one measured query, so it is
        an estimate.
      </figcaption>
    </figure>
  )
}
