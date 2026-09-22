"use client"

import { useState } from "react"

import { mpow } from "@/lib/dmath"

// The per-case grid, transcribed from Aikido's own "Recall by vulnerability
// type" figure and converted back to runs.
//
// Each published cell is the share of three runs that found the case: 0, 33, 67
// or 100. Multiplying by 3 recovers the integer run count. The transcription is
// checkable end to end, because the mean of the 32 cells reproduces each
// model's published headline exactly:
//   Altar          sum 1934 / 32 = 60.44%  -> reported 60.4%
//   GLM-5.3 AWQ    sum 1968 / 32 = 61.50%  -> reported 61.5%
//   GLM-5.3 BF16   sum 2099 / 32 = 65.59%  -> reported 65.6%
// An arbitrary misreading would not land on all three.
//
// Because the same 32 cases were run against every model, this is a paired
// design, and the paired view is far sharper than the three averages. The
// headline "approximately one percentage point less average recall" than the
// AWQ parent is, exactly, one run on one case.

type Case = { name: string; altar: number; awq: number; bf16: number } // runs of 3

const CASES: Case[] = [
  { name: "Improper Authentication 1", altar: 3, awq: 3, bf16: 3 },
  { name: "Signature Verification 1", altar: 3, awq: 3, bf16: 3 },
  { name: "Improper Authentication 2", altar: 3, awq: 3, bf16: 3 },
  { name: "SSRF 1", altar: 3, awq: 3, bf16: 3 },
  { name: "External Initialization", altar: 3, awq: 3, bf16: 3 },
  { name: "Path Traversal 1", altar: 3, awq: 3, bf16: 3 },
  { name: "Improper Authentication 3", altar: 3, awq: 3, bf16: 3 },
  { name: "Cross-site Scripting 1", altar: 3, awq: 3, bf16: 3 },
  { name: "Path Traversal 2", altar: 3, awq: 3, bf16: 3 },
  { name: "Cross-site Scripting 2", altar: 2, awq: 2, bf16: 2 },
  { name: "Signature Verification 2", altar: 3, awq: 3, bf16: 3 },
  { name: "Path Traversal 3", altar: 3, awq: 3, bf16: 3 },
  { name: "Code Injection 1", altar: 2, awq: 2, bf16: 3 },
  { name: "Out-of-bounds Read", altar: 3, awq: 3, bf16: 3 },
  { name: "Missing Authorization 1", altar: 3, awq: 3, bf16: 3 },
  { name: "Code Injection 2", altar: 1, awq: 2, bf16: 1 },
  { name: "Fail Open", altar: 2, awq: 2, bf16: 2 },
  { name: "Path Canonicalization", altar: 3, awq: 3, bf16: 3 },
  { name: "Missing Authorization 2", altar: 1, awq: 1, bf16: 1 },
  { name: "Incorrect Authorization 1", altar: 0, awq: 0, bf16: 1 },
  { name: "Improper Authentication 4", altar: 1, awq: 1, bf16: 1 },
  { name: "Unrestricted File Upload", altar: 3, awq: 3, bf16: 3 },
  { name: "Path Traversal 4", altar: 2, awq: 2, bf16: 3 },
  { name: "Deserialization", altar: 2, awq: 2, bf16: 3 },
  { name: "Config Injection", altar: 0, awq: 0, bf16: 0 },
  { name: "Path Traversal 5", altar: 0, awq: 0, bf16: 0 },
  { name: "IDOR", altar: 0, awq: 0, bf16: 0 },
  { name: "Improper Access Control", altar: 0, awq: 0, bf16: 0 },
  { name: "Incorrect Authorization 2", altar: 0, awq: 0, bf16: 1 },
  { name: "SSRF 2", altar: 0, awq: 0, bf16: 0 },
  { name: "Host Confusion", altar: 0, awq: 0, bf16: 0 },
  { name: "Request Smuggling", altar: 0, awq: 0, bf16: 0 },
]

type Against = "awq" | "bf16"

const OPPONENT: Record<Against, { label: string; sub: string; color: string }> = {
  awq: {
    label: "GLM-5.3, AWQ INT4",
    sub: "488.2 GB — quantised, not pruned",
    color: "oklch(0.64 0.13 280)",
  },
  bf16: {
    label: "GLM-5.3, BF16",
    sub: "1,506.7 GB — the full-precision parent",
    color: "oklch(0.55 0.17 280)",
  },
}

const ALTAR_C = "oklch(0.60 0.13 200)"
const LOSS_C = "oklch(0.58 0.18 27)"

export function PairedRuns() {
  const [against, setAgainst] = useState<Against>("awq")
  const opp = OPPONENT[against]

  const rows = CASES.map((c) => ({ ...c, other: c[against], d: c.altar - c[against] }))
  const losses = rows.filter((r) => r.d < 0)
  const wins = rows.filter((r) => r.d > 0)
  const ties = rows.length - losses.length - wins.length

  const altarRuns = CASES.reduce((s, c) => s + c.altar, 0)
  const otherRuns = CASES.reduce((s, c) => s + c[against], 0)

  const discordant = losses.length + wins.length
  // Exact two-sided sign test on the discordant pairs, all of which fall the
  // same way in both comparisons here. 2 * 0.5^k, capped at 1.
  const p = Math.min(1, 2 * mpow(0.5, discordant))

  const W = 700
  const L = 196
  const R = 150
  const rowH = 17
  const H = rows.length * rowH + 40
  const cell = (W - L - R) / 3

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          runs that found the case, out of three — paired, 32 cases
        </span>
        <span className="font-mono text-[10px]" style={{ color: LOSS_C }}>
          {losses.length} loss{losses.length === 1 ? "" : "es"} · {wins.length} win
          {wins.length === 1 ? "" : "s"} · {ties} tied
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(OPPONENT) as Against[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAgainst(k)}
              aria-pressed={against === k}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                (against === k
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              Altar vs {OPPONENT[k].label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[620px]"
            role="img"
            aria-label={`Per-case comparison of Altar against ${opp.label}. Altar found ${altarRuns} of 96 runs, ${opp.label} found ${otherRuns}. They differ on ${discordant} of the 32 cases, all in ${opp.label}'s favour.`}
          >
            <text x={L + cell * 0.5} y={12} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
              Altar
            </text>
            <text x={L + cell * 1.5} y={12} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
              {against === "awq" ? "AWQ INT4" : "BF16"}
            </text>

            {rows.map((r, i) => {
              const y = 22 + i * rowH
              const diff = r.d !== 0
              return (
                <g key={r.name}>
                  <text
                    x={L - 8}
                    y={y + 8}
                    textAnchor="end"
                    className={diff ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                    style={{ fontSize: 8.5 }}
                  >
                    {r.name}
                  </text>
                  {[r.altar, r.other].map((v, col) => (
                    <g key={col}>
                      {[0, 1, 2].map((k) => (
                        <rect
                          key={k}
                          x={L + col * cell + k * 15}
                          y={y}
                          width={12}
                          height={11}
                          rx={1.5}
                          fill={
                            k < v
                              ? col === 0
                                ? ALTAR_C
                                : opp.color
                              : "transparent"
                          }
                          className={k < v ? "" : "stroke-foreground/15"}
                          strokeWidth={k < v ? 0 : 1}
                        />
                      ))}
                    </g>
                  ))}
                  {diff ? (
                    <text
                      x={L + 2 * cell + 8}
                      y={y + 9}
                      className="font-mono"
                      fill={LOSS_C}
                      style={{ fontSize: 8.5 }}
                    >
                      {r.d > 0 ? `+${r.d}` : r.d} run{Math.abs(r.d) === 1 ? "" : "s"}
                    </text>
                  ) : null}
                </g>
              )
            })}

            <text
              x={L}
              y={H - 16}
              className="fill-foreground font-mono"
              style={{ fontSize: 9.5 }}
            >
              {altarRuns} / 96 runs vs {otherRuns} / 96 — a gap of{" "}
              {Math.abs(altarRuns - otherRuns)} run
              {Math.abs(altarRuns - otherRuns) === 1 ? "" : "s"}
            </text>
            <text
              x={L}
              y={H - 4}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 8.5 }}
            >
              exact two-sided sign test on {discordant} discordant case
              {discordant === 1 ? "" : "s"}: p = {p.toFixed(4)}
            </text>
          </svg>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Transcribed from Aikido&apos;s published per-case figure; the 32-cell
        mean reproduces all three of their headline averages to the decimal,
        which is the check that the transcription is right. The sign test treats
        each case as one paired trial and is the weakest defensible test on this
        data — it ignores the size of each per-case difference, all of which are
        one run.
      </figcaption>
    </figure>
  )
}
