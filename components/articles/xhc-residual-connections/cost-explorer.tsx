"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What N streams cost, from the paper's own formulas with N and k left free.
//
// Parameters per Transformer layer (two sublayers), in units of the hidden
// size C, from Appendix C (Eqs. 25 and 26):
//   mHC(N)    = (4N^2 + 2N^3) C
//   xHC(N, k) = (4N^2 + 2k^3 + k^2 + k^2 K_r + sum(kappa)) C,  K_r = 4, kappa = {4, 8, 12}
// The 4N^2 term is the read map plus the write map in mHC, and the router plus
// the read map in xHC; 2N^3 (or 2k^3) is the generator of the mixing matrix.
//
// Memory traffic per sublayer, in units of C, from Table 4's rows (leading
// C terms only, as the paper's totals are), averaged over attention (K_r = 1)
// and MLP (K_r = 4, plus the conv's 1 read and 3 writes):
//   vanilla      3
//   mHC(N)       (5N + 1) reads + (3N + 1) writes          -> 34 at N = 4
//   xHC(N, k)    (2N + 5k + 3) reads + (4k + 2.5) writes   -> 73.5 at 16, 4
//   xHC-Flash    (N + 4k + 4) reads + (3k + 3) writes      -> 51 at 16, 4
// xHC-Flash-4sub is shown only at the paper's own point (40 at N = 16, k = 4),
// because Table 4 does not give its rows in a form that generalizes.

const KR = 4
const KAPPA = 4 + 8 + 12

type Seg = { label: string; v: number; color: string }
type Bar = { label: string; segs: Seg[]; note?: string }

const C_MAP = "oklch(0.62 0.12 250)"
const C_MIX = "oklch(0.62 0.2 28)"
const C_POST = "oklch(0.66 0.13 155)"
const C_CONV = "oklch(0.75 0.13 85)"
const C_R = "oklch(0.6 0.13 250)"
const C_W = "oklch(0.7 0.12 60)"

function paramBars(N: number, k: number): Bar[] {
  return [
    {
      label: "mHC, N = 4",
      segs: [
        { label: "read + write maps", v: 4 * 16, color: C_MAP },
        { label: "mixing generator", v: 2 * 64, color: C_MIX },
      ],
      note: "the production setting",
    },
    {
      label: `mHC, N = ${N}`,
      segs: [
        { label: "read + write maps", v: 4 * N * N, color: C_MAP },
        { label: "mixing generator", v: 2 * N * N * N, color: C_MIX },
      ],
    },
    {
      label: `xHC, N = ${N}, k = ${k}`,
      segs: [
        { label: "router + read map", v: 4 * N * N, color: C_MAP },
        { label: "mixing generator", v: 2 * k * k * k, color: C_MIX },
        { label: "write maps", v: k * k + k * k * KR, color: C_POST },
        { label: "causal convs", v: KAPPA, color: C_CONV },
      ],
    },
  ]
}

function ioBars(N: number, k: number): Bar[] {
  const bars: Bar[] = [
    {
      label: "plain residual",
      segs: [
        { label: "reads", v: 2, color: C_R },
        { label: "writes", v: 1, color: C_W },
      ],
    },
    {
      label: "mHC, N = 4",
      segs: [
        { label: "reads", v: 21, color: C_R },
        { label: "writes", v: 13, color: C_W },
      ],
      note: "the production setting",
    },
    {
      label: `mHC, N = ${N}`,
      segs: [
        { label: "reads", v: 5 * N + 1, color: C_R },
        { label: "writes", v: 3 * N + 1, color: C_W },
      ],
    },
    {
      label: `xHC, N = ${N}, k = ${k}`,
      segs: [
        { label: "reads", v: 2 * N + 5 * k + 3, color: C_R },
        { label: "writes", v: 4 * k + 2.5, color: C_W },
      ],
    },
    {
      label: `xHC-Flash, N = ${N}, k = ${k}`,
      segs: [
        { label: "reads", v: N + 4 * k + 4, color: C_R },
        { label: "writes", v: 3 * k + 3, color: C_W },
      ],
    },
  ]
  if (N === 16 && k === 4)
    bars.push({
      label: "xHC-Flash-4sub, 16, 4",
      segs: [
        { label: "reads", v: 26.5, color: C_R },
        { label: "writes", v: 13.5, color: C_W },
      ],
      note: "paper's value",
    })
  return bars
}

const total = (b: Bar) => b.segs.reduce((s, x) => s + x.v, 0)
// Thousands separators by hand: Intl output is not guaranteed identical on the
// server and in every browser.
const num = (v: number) =>
  Number.isInteger(v) ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : v.toFixed(1)

function Pills<V extends number | string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: { v: V; label: string; disabled?: boolean }[]
  onChange: (v: V) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 font-mono text-[11px] text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-30",
            value === o.v
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CostExplorer() {
  const [N, setN] = useState(16)
  const [k, setK] = useState(4)
  const [metric, setMetric] = useState<"params" | "io">("params")

  const kk = Math.min(k, N)
  const bars = metric === "params" ? paramBars(N, kk) : ioBars(N, kk)
  const max = Math.max(...bars.map(total))
  const xhcP = paramBars(N, kk)[2]
  const share = (4 * N * N) / total(xhcP)
  const vsDense = (4 * N * N + 2 * N * N * N) / total(xhcP)
  const vsProd = total(xhcP) / 192

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what N streams cost, per the paper&apos;s formulas</span>
        <span className="font-mono text-[10px] text-muted-foreground">units of the hidden size C · reasoned from Eqs. 25–26, Table 4</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2">
          <Pills
            label="measure"
            value={metric}
            onChange={setMetric}
            options={[
              { v: "params" as const, label: "parameters per layer" },
              { v: "io" as const, label: "memory traffic per sublayer" },
            ]}
          />
          <Pills
            label="streams N"
            value={N}
            onChange={(v) => setN(v)}
            options={[4, 8, 16, 32].map((v) => ({ v, label: String(v) }))}
          />
          <Pills
            label="active k"
            value={kk}
            onChange={setK}
            options={[2, 4, 8].map((v) => ({ v, label: String(v), disabled: v > N }))}
          />
        </div>

        <div className="space-y-2.5" role="list">
          {bars.map((b) => {
            const t = total(b)
            return (
              <div key={b.label} role="listitem">
                <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span>
                    {b.label}
                    {b.note ? <span className="text-muted-foreground"> · {b.note}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{num(t)} C</span>
                </div>
                <div className="mt-1 flex h-3 w-full overflow-hidden rounded-sm bg-muted/40">
                  {b.segs.map((s) => (
                    <div
                      key={s.label}
                      title={`${s.label}: ${num(s.v)} C`}
                      style={{ width: `${((s.v / max) * 100).toFixed(3)}%`, background: s.color }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(metric === "params"
            ? [
                { c: C_MAP, l: "read/write maps, or router + read map" },
                { c: C_MIX, l: "mixing generator (N³ or k³)" },
                { c: C_POST, l: "xHC write maps" },
                { c: C_CONV, l: "causal convs" },
              ]
            : [
                { c: C_R, l: "reads" },
                { c: C_W, l: "writes" },
              ]
          ).map((x) => (
            <span key={x.l} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: x.c }} /> {x.l}
            </span>
          ))}
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground">
          {metric === "params" ? (
            <>
              At N = {N}, k = {kk}, xHC carries {num(total(xhcP))} C parameters per layer:{" "}
              {vsDense.toFixed(1)}x fewer than dense mHC at the same N and {vsProd.toFixed(1)}x more than mHC at
              N = 4. {(share * 100).toFixed(0)}% of it is the router and read map, which still grow as N².
            </>
          ) : (
            <>
              Traffic is what the step time pays for: the state is N·C wide, and both the mixing generator and
              the dense read have to stream all of it. xHC updates only k streams but still reads all N twice per
              sublayer; xHC-Flash shares those two full reads across a block.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
