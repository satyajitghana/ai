"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where Mach-2 Additive Medium's bits go, three ways.
//
// Every number is read off the shipped files, not the model card:
//   * parameters and bytes per group come from the safetensors headers of
//     SyzygyResearch/Mach-2-Additive-Medium @ b0234bb (HTTP range reads of all
//     132 .safetensors files: packed/experts, packed/ne, packed/head, extras,
//     packed/table). They sum to 125,743,653,795 parameters in 26,717,083,816
//     tensor bytes = 1.6998 bits per weight; MANIFEST.json says 125,743,653,760
//     and 26,717,634,752 (it counts file headers too).
//   * the n-gram table is 128 BF16 shards of [2,500,012, 160]:
//     51,200,245,760 parameters, 102,400,491,520 bytes.
//   * "read per token" is decode with one token: 10 of 512 routed experts in
//     each of 48 layers (num_experts_per_tok in config.json) at the experts'
//     mean 1.565 bits, plus every non-expert matrix, the head, the int8
//     hyper-connection mixers and the BF16 extras (router, norms, GDN scalars) plus one embedding row, plus 16 table rows of 160
//     BF16 values. My arithmetic from those files; it ignores KV cache reads.
//   * the bandwidth ceilings divide a device's memory bandwidth by the bytes
//     per token. They are upper bounds, not predictions.

const C = {
  experts: "oklch(0.62 0.15 250)",
  spine: "oklch(0.7 0.14 70)",
  other: "oklch(0.66 0.12 160)",
  table: "oklch(0.6 0.02 270)",
}

type Group = {
  id: string
  label: string
  color: string
  params: number
  bytes: number
  perToken: number
  how: string
}

const GROUPS: Group[] = [
  {
    id: "experts",
    label: "Routed experts",
    color: C.experts,
    params: 120_795_955_200,
    bytes: 23_638_548_480,
    perToken: 461_625_754,
    how: "trellis codes, 1.0 to 2.0 bits each, mean 1.57",
  },
  {
    id: "spine",
    label: "Attention, linear attention, shared experts",
    color: C.spine,
    params: 2_909_798_400,
    bytes: 1_456_811_536,
    perToken: 1_456_811_536,
    how: "trellis codes, 4.0 bits",
  },
  {
    id: "other",
    label: "Head, embedding, mixers, router, norms",
    color: C.other,
    params: 125_743_653_795 - 120_795_955_200 - 2_909_798_400,
    bytes: 357_580_800 + 417_177_600 + 690_217_600 + 156_747_800,
    perToken: 417_177_600 + 690_217_600 + 156_747_800 + 1_440,
    how: "int4, int5, int8 and BF16",
  },
  {
    id: "table",
    label: "N-gram embedding table",
    color: C.table,
    params: 51_200_245_760,
    bytes: 102_400_491_520,
    perToken: 5_120,
    how: "BF16, untouched",
  },
]

const DEVICES = [
  { id: "m4pro", label: "M4 Pro, 273 GB/s", bw: 273e9 },
  { id: "m4max", label: "M4 Max, 546 GB/s", bw: 546e9 },
  { id: "rtx5090", label: "RTX 5090, 1,792 GB/s", bw: 1792e9 },
  { id: "a100", label: "A100 80 GB, 2,039 GB/s", bw: 2039e9 },
]

const BF16_TEXT_BYTES = 125_743_653_795 * 2

type Mode = "params" | "bytes" | "token"

const fmtB = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${(n / 1e3).toFixed(1)} KB`)
const fmtP = (n: number) => `${(n / 1e9).toFixed(2)}B`

export function BitLedger() {
  const [mode, setMode] = useState<Mode>("bytes")
  const [withTable, setWithTable] = useState(false)
  const [dev, setDev] = useState("m4pro")

  const groups = GROUPS.filter((g) => withTable || g.id !== "table")
  const val = (g: Group) => (mode === "params" ? g.params : mode === "bytes" ? g.bytes : g.perToken)
  const total = groups.reduce((s, g) => s + val(g), 0)
  const params = groups.reduce((s, g) => s + g.params, 0)
  const bytes = groups.reduce((s, g) => s + g.bytes, 0)
  const bpw = (bytes * 8) / params
  const baseBytes = BF16_TEXT_BYTES + (withTable ? GROUPS[3].bytes : 0)
  const ratio = baseBytes / bytes
  const perTok = groups.reduce((s, g) => s + g.perToken, 0)
  const bw = DEVICES.find((d) => d.id === dev)!.bw

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">bit ledger · Mach-2 Additive Medium</span>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["params", "parameters"],
              ["bytes", "stored bytes"],
              ["token", "read per token"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mode === id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <label className="mb-3 flex cursor-pointer items-center gap-2 font-mono text-xs text-muted-foreground">
          <input type="checkbox" checked={withTable} onChange={(e) => setWithTable(e.target.checked)} />
          count the 102.4 GB n-gram table (the card leaves it out)
        </label>

        <div
          className="flex h-8 w-full overflow-hidden rounded-md"
          role="img"
          aria-label={groups.map((g) => `${g.label}: ${((val(g) / total) * 100).toFixed(1)}%`).join(", ")}
        >
          {groups.map((g) => {
            const pct = (val(g) / total) * 100
            return (
              <div
                key={g.id}
                className="flex items-center justify-center overflow-hidden transition-all duration-300"
                style={{ width: `${pct}%`, background: g.color }}
              >
                {pct > 9 ? (
                  <span className="px-1 font-mono text-[10px] font-semibold text-white/95">{pct.toFixed(1)}%</span>
                ) : null}
              </div>
            )
          })}
        </div>

        <dl className="mt-4 space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: g.color }} />
              <dt className="text-foreground">{g.label}</dt>
              <dd className="text-muted-foreground">
                {mode === "params" ? fmtP(g.params) : fmtB(val(g))} · {((val(g) / total) * 100).toFixed(1)}%
                <span className="text-muted-foreground/70"> · {g.how}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid gap-2 rounded-lg border bg-muted/20 p-3 font-mono text-xs sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground">bits per weight</div>
            <div className="text-base text-foreground">{bpw.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">smaller than BF16 by</div>
            <div className="text-base text-foreground">{ratio.toFixed(2)}x</div>
          </div>
          <div>
            <div className="text-muted-foreground">read per token</div>
            <div className="text-base text-foreground">{fmtB(perTok)}</div>
          </div>
        </div>

        {mode === "token" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>bandwidth ceiling on</span>
            <select
              value={dev}
              onChange={(e) => setDev(e.target.value)}
              className="rounded border bg-background px-1.5 py-0.5 text-foreground"
            >
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <span>
              ≈ <span className="text-foreground">{(bw / perTok).toFixed(0)} tokens/s</span>, one token per step, if
              every byte crossed the bus at full speed
            </span>
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "params"
            ? "By parameters the model is nearly all routed experts, which is why squeezing the experts is the whole game for the headline number."
            : mode === "bytes"
              ? withTable
                ? "Count the table and the same files average 5.84 bits per weight, and the ratio against BF16 falls from 9.41x to 2.74x."
                : "Stored, the experts are 88% of the 26.7 GB. Everything that is not an expert costs 4 bits or more per weight."
              : "Decoding one token reads every non-expert matrix but only 10 experts per layer, so the cheap experts are a small slice of the traffic and the 4-bit spine is the big one."}
        </p>
      </div>
    </figure>
  )
}
