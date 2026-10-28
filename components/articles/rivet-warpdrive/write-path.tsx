"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { WRITE } from "./data"

// Write path of the toy (toy.py): 6,000 commits at 100/s, 3.0 pages each, on a 47 MiB database of 188 shards.
// Object-store latencies are ASSUMED (swept 25/40/80 ms median PUT); the three-AZ ack is a MODEL; PUT price is the S3
// Standard list price as I recall it ($0.005 per 1,000), not re-checked against a bill. Request counts are exact for the seeded run.

const MEDS = ["25", "40", "80"]
const WINDOWS = ["1", "5", "30", "60"]
const C_DIRECT = "oklch(0.60 0.17 30)"
const C_WAL = "oklch(0.62 0.15 150)"

function Seg(props: { label: string; opts: string[]; value: string; onChange: (v: string) => void; unit: string }) {
  const { label, opts, value, onChange, unit } = props
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="w-40 shrink-0 font-mono text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={cn(
              "rounded border px-2 py-1 font-mono tabular-nums",
              o === value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {o} {unit}
          </button>
        ))}
      </div>
    </div>
  )
}

function Row(props: { name: string; ack: string; puts: number; usd: number; mb: number; color: string; pct: number }) {
  const { name, ack, puts, usd, mb, color, pct } = props
  return (
    <div className="grid grid-cols-[1fr] gap-1 border-t border-border py-2 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-3">
      <div className="font-mono text-xs">{name}</div>
      <div className="flex items-center gap-2">
        <div className="h-3 flex-1 overflow-hidden rounded bg-muted" role="img" aria-label={`${name}: ${puts} PUT requests`}>
          <div className="h-full" style={{ width: `${Math.max(0.8, pct).toFixed(1)}%`, background: color }} />
        </div>
      </div>
      <div className="font-mono text-[11px] tabular-nums text-muted-foreground sm:text-right">
        ack {ack} ms · {puts.toLocaleString("en-US")} PUTs · ${usd.toFixed(2)}/M · {mb.toFixed(0)} MB up
      </div>
    </div>
  )
}

export function WritePath() {
  const [med, setMed] = useState("40")
  const [win, setWin] = useState("5")
  const t = WRITE[med]
  const d = t["direct-delta"]
  const s = t["direct-shard"]
  const wp = t[`wal+fold${win}s/per-shard`]
  const wk = t[`wal+fold${win}s/packed`]
  const top = Math.max(d.puts, s.puts, wp.puts, wk.puts)
  const pct = (n: number) => (n / top) * 100
  const f = (r: { p50: number; p99: number }) => `${r.p50.toFixed(r.p50 < 10 ? 2 : 0)} / ${r.p99.toFixed(r.p99 < 10 ? 2 : 0)}`
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Seg label="S3 PUT median (assumed)" opts={MEDS} value={med} onChange={setMed} unit="ms" />
        <Seg label="fold window" opts={WINDOWS} value={win} onChange={setWin} unit="s" />
      </div>
      <div className="mt-3">
        <Row name="PUT per commit" ack={f(d)} puts={d.puts} usd={d.usd} mb={d.mb} color={C_DIRECT} pct={pct(d.puts)} />
        <Row name="rewrite shard per commit" ack={f(s)} puts={s.puts} usd={s.usd} mb={s.mb} color={C_DIRECT} pct={pct(s.puts)} />
        <Row name={`WAL, fold ${win}s, 1 object/shard`} ack={f(wp)} puts={wp.puts} usd={wp.usd} mb={wp.mb} color={C_WAL} pct={pct(wp.puts)} />
        <Row name={`WAL, fold ${win}s, packed segment`} ack={f(wk)} puts={wk.puts} usd={wk.usd} mb={wk.mb} color={C_WAL} pct={pct(wk.puts)} />
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Simulated, not measured against S3: 6,000 commits, 3.0 pages each, 188 shards of 256 KiB. Ack is p50 / p99 in ms. The WAL rows ack from a modelled
        majority of three zones, so they do not move with the PUT median. The 1 s window uploads more bytes than the commits carried
        because a shard image is rewritten whole.
      </figcaption>
    </figure>
  )
}
