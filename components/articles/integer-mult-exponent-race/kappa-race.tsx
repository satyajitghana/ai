"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// log2(kappa) against time for every exponent claim in CrocSwap/integer-mult-bounds.
//
// Sources (all read on 2026-10-08):
//   Colkitt's checkpoints: commit times from `git log` on main / release/ternary-30
//     (5cf29ec, 52ce3be, bcd4ebd, 6e56487, 1c09a58, 1a74950), converted to UTC.
//   Community PRs: `created_at` from the GitHub REST API, kappa from each PR title or
//     body (the exact rationals are in the PR descriptions). #11 and #26 claim no
//     kappa and are omitted, as is #45 (a Lean audit, no kappa). #46 to #48 were added
//     on a second pass at 15:24 UTC, #49 on a third at 15:46 UTC.
//   The merge: GitHub marks PR #39 merged at 15:18:18 UTC, when main moved to 0605a24
//     ("Publish audited community bound with contributor attribution"). The merge commit
//     itself, fd8c563, was made on integration/community at 13:23 UTC; main stayed at the
//     2^-30 checkpoint until the audit (c9fca20, 15:12 UTC) and the release commit landed.
//     kappa on main is 971668963/25000000000000, the PR #39 witness, unchanged.
//   Swapnil Jain's parallel track (github.com/Swapnil-jain/integer-mult-kappa): times are
//     his six X posts (fxtwitter mirror), kappa the exact witness in the commit each post
//     announced. Rounds five and six have their moment and assembly arithmetic checked by
//     Lean's kernel (lean/Round5.lean, lean/Round6.lean, decide / decide +kernel, no
//     native_decide); everything else on the chart is an exact-rational Python certificate.
//   The 2^-182 origin sits at 22:19 UTC on Oct 6, the time Julian Schiavo's chart
//     labels it with; I did not verify that time independently.
// "Extrapolation" is my straight line in log2(kappa) through Colkitt's two announcement
// posts that preceded Julian's first chart: 2^-78 at 13:56 UTC and 2^-59 at 19:35 UTC
// on Oct 7. It reaches kappa = 1 at about 13:08 UTC on Oct 8.
// x is hours after 2026-10-06 22:00 UTC; y is log2(kappa), precomputed.

type Pt = {
  pr?: number
  who: string
  h: number
  l2: number
  k: string
  note?: string
  lean?: boolean
  merged?: boolean
  url?: string
}

const ORIGIN: Pt = { who: "OpenAI", h: 0.317, l2: -182, k: "2^-182", note: "original manuscript (family 109)" }

const COLKITT: Pt[] = [
  { who: "Colkitt", h: 4.367, l2: -107.088, k: "5.8e-33", note: "5cf29ec · parameters only" },
  { who: "Colkitt", h: 15.583, l2: -78, k: "2^-78", note: "52ce3be · direct axis routing" },
  { who: "Colkitt", h: 21.45, l2: -59, k: "2^-59", note: "bcd4ebd · paired circuits" },
  { who: "Colkitt", h: 26.45, l2: -33.488, k: "8.3e-11", note: "6e56487 · compact controls" },
  { who: "Colkitt", h: 27.167, l2: -31, k: "2^-31", note: "1c09a58 · complex compression" },
  { who: "Colkitt", h: 39.167, l2: -30, k: "2^-30", note: "1a74950 · ternary checkpoint" },
]

const PRS: Pt[] = [
  { pr: 1, who: "Paureel", h: 22.979, l2: -58.985, k: "1.752e-18" },
  { pr: 2, who: "Bortlesboat", h: 24.333, l2: -58.913, k: "1.843e-18" },
  { pr: 3, who: "eumemic", h: 28.385, l2: -30.659, k: "5.9e-10" },
  { pr: 4, who: "dleen", h: 28.888, l2: -30.656, k: "5.91e-10" },
  { pr: 5, who: "eumemic", h: 30.153, l2: -29.333, k: "1.479e-9" },
  { pr: 6, who: "eumemic", h: 31.39, l2: -29.198, k: "1.624e-9" },
  { pr: 7, who: "jacklightChen", h: 32.201, l2: -27.998, k: "3.73e-9" },
  { pr: 8, who: "rohanarun", h: 33.557, l2: -30.659, k: "5.9e-10" },
  { pr: 9, who: "rohanarun", h: 34.121, l2: -27.971, k: "3.8e-9" },
  { pr: 10, who: "icekylinx", h: 34.44, l2: -22.955, k: "1.23e-7" },
  { pr: 12, who: "rohanarun", h: 34.67, l2: -22.914, k: "1.265e-7" },
  { pr: 13, who: "eumemic", h: 35.023, l2: -20.309, k: "7.699e-7" },
  { pr: 14, who: "rohanarun", h: 35.281, l2: -20.071, k: "9.08e-7" },
  { pr: 15, who: "eumemic", h: 35.439, l2: -19.825, k: "1.077e-6" },
  { pr: 16, who: "jacklightChen", h: 35.607, l2: -19.961, k: "9.799e-7" },
  { pr: 17, who: "rohanarun", h: 35.894, l2: -19.612, k: "1.248e-6" },
  { pr: 18, who: "icekylinx", h: 36.028, l2: -19.017, k: "1.885e-6" },
  { pr: 19, who: "rohanarun", h: 36.322, l2: -18.866, k: "2.093e-6" },
  { pr: 20, who: "hipotures", h: 36.344, l2: -19.709, k: "1.167e-6" },
  { pr: 21, who: "jacklightChen", h: 36.413, l2: -17.472, k: "5.499e-6" },
  { pr: 22, who: "DominikScholz", h: 36.582, l2: -17.418, k: "5.711e-6" },
  { pr: 23, who: "jacklightChen", h: 36.732, l2: -16.473, k: "1.099e-5" },
  { pr: 24, who: "icekylinx", h: 36.775, l2: -17.35, k: "5.986e-6" },
  { pr: 25, who: "rohanarun", h: 36.867, l2: -16.415, k: "1.145e-5" },
  { pr: 27, who: "DominikScholz", h: 36.959, l2: -16.35, k: "1.197e-5" },
  { pr: 28, who: "rohanarun", h: 37.166, l2: -16.316, k: "1.226e-5" },
  { pr: 29, who: "jacklightChen", h: 37.336, l2: -15.974, k: "1.554e-5" },
  { pr: 30, who: "DominikScholz", h: 37.35, l2: -16.231, k: "1.3e-5" },
  { pr: 31, who: "rohanarun", h: 37.49, l2: -15.943, k: "1.588e-5" },
  { pr: 32, who: "icekylinx", h: 37.559, l2: -16.285, k: "1.252e-5" },
  { pr: 33, who: "DominikScholz", h: 37.599, l2: -15.898, k: "1.638e-5" },
  { pr: 34, who: "jamesyc", h: 38.168, l2: -15.897, k: "1.639e-5" },
  { pr: 35, who: "DominikScholz", h: 38.457, l2: -15.876, k: "1.663e-5" },
  { pr: 36, who: "icekylinx", h: 38.458, l2: -14.666, k: "3.846e-5" },
  { pr: 37, who: "rohanarun", h: 38.664, l2: -14.664, k: "3.851e-5" },
  { pr: 38, who: "DominikScholz", h: 38.822, l2: -14.651, k: "3.886e-5" },
  { pr: 39, who: "rohanarun", h: 38.979, l2: -14.651, k: "3.887e-5" },
  { pr: 40, who: "rohanarun", h: 39.266, l2: -14.639, k: "3.919e-5" },
  { pr: 41, who: "hipotures", h: 39.551, l2: -14.597, k: "4.034e-5" },
  { pr: 42, who: "rohanarun", h: 39.86, l2: -14.574, k: "4.099e-5" },
  { pr: 43, who: "chafreaky", h: 39.931, l2: -14.574, k: "4.1e-5" },
  { pr: 44, who: "rohanarun", h: 40.406, l2: -14.574, k: "4.101e-5" },
  { pr: 46, who: "chafreaky", h: 40.734, l2: -14.574, k: "4.1006e-5" },
  { pr: 47, who: "rohanarun", h: 40.943, l2: -14.572, k: "4.1051e-5" },
  { pr: 48, who: "chafreaky", h: 41.248, l2: -14.567, k: "4.1186e-5" },
  { pr: 49, who: "rohanarun", h: 41.616, l2: -14.566, k: "4.1239e-5" },
]

// PR #39 opened at 12:58 UTC; merged into main at 15:18 UTC after the maintainer's audit.
const MERGED: Pt = {
  who: "Colkitt",
  h: 41.305,
  l2: -14.651,
  k: "3.886675852e-5",
  note: "PR #39 (Rohan Arun) merged into main · 0605a24 · maintainer-audited, still conditional on the manuscript",
  merged: true,
  url: "https://github.com/CrocSwap/integer-mult-bounds/pull/39",
}
const PR39 = { h: 38.979, l2: -14.651 }

const JAIN_REPO = "https://github.com/Swapnil-jain/integer-mult-kappa"
const JAIN: Pt[] = [
  { who: "Jain", h: 33.339, l2: -27.581, k: "4.98e-9", note: "round 1 · ε → 1 stack", url: "https://x.com/SJ_Swapnil_Jain/status/2108095135024304240" },
  { who: "Jain", h: 34.266, l2: -26.991, k: "7.499e-9", note: "round 2 · recentred Gaussian inverse", url: "https://x.com/SJ_Swapnil_Jain/status/2108109123774796281" },
  { who: "Jain", h: 36.098, l2: -17.865, k: "4.188e-6", note: "round 3 · batched two-stage bit side", url: "https://x.com/SJ_Swapnil_Jain/status/2108136796886548867" },
  { who: "Jain", h: 37.167, l2: -16.35, k: "1.1972e-5", note: "round 4 · PR #24's bit network", url: "https://x.com/SJ_Swapnil_Jain/status/2108152926959284315" },
  { who: "Jain", h: 38.665, l2: -15.979, k: "1.5479e-5", note: "round 5 · flag basis · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108175552549118371" },
  { who: "Jain", h: 40.055, l2: -14.735, k: "3.6666e-5", note: "round 6 · copied centres · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108196538568851574" },
]

const PALETTE: Record<string, string> = {
  OpenAI: "oklch(0.55 0 0)",
  Colkitt: "oklch(0.55 0.2 25)",
  eumemic: "oklch(0.62 0.16 150)",
  jacklightChen: "oklch(0.62 0.15 260)",
  rohanarun: "oklch(0.70 0.15 70)",
  icekylinx: "oklch(0.60 0.17 320)",
  DominikScholz: "oklch(0.62 0.12 200)",
}
const JAIN_COLOUR = "oklch(0.45 0.2 295)"
const OTHER = "oklch(0.60 0.04 260)"
const colour = (who: string) => (who === "Jain" ? JAIN_COLOUR : (PALETTE[who] ?? OTHER))

const W = 680
const H = 340
const L = 48
const R = 14
const T = 14
const B = 34
const H_MAX = 42.5
const Y_MIN = -190

const EXTRA_A = { h: 15.933, l2: -78 }
const EXTRA_B = { h: 21.583, l2: -59 }
const SLOPE = (EXTRA_B.l2 - EXTRA_A.l2) / (EXTRA_B.h - EXTRA_A.h)
const HIT_ONE = EXTRA_B.h - EXTRA_B.l2 / SLOPE

const x = (h: number) => L + (h / H_MAX) * (W - L - R)
const y = (l2: number) => T + (l2 / Y_MIN) * (H - T - B)

function stamp(h: number) {
  const mins = Math.round(h * 60) + 22 * 60
  const day = 6 + Math.floor(mins / (24 * 60))
  const m = mins % (24 * 60)
  const hh = String(Math.floor(m / 60)).padStart(2, "0")
  const mm = String(m % 60).padStart(2, "0")
  return `Oct ${day}, ${hh}:${mm} UTC`
}

export function KappaRace() {
  const [showPrs, setShowPrs] = useState(true)
  const [showLine, setShowLine] = useState(true)
  const [showJain, setShowJain] = useState(true)
  const [sel, setSel] = useState<Pt>(PRS[11])

  const frontier: Pt[] = []
  let best = -Infinity
  for (const p of [...PRS].sort((a, b) => a.h - b.h)) {
    if (p.l2 > best) {
      best = p.l2
      frontier.push(p)
    }
  }
  const path = frontier.map((p, i) => (i === 0 ? `M${x(p.h)},${y(p.l2)}` : `H${x(p.h)}V${y(p.l2)}`)).join("")

  const jainPath = JAIN.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.h)},${y(p.l2)}`).join("")

  const all = [ORIGIN, ...COLKITT, MERGED, ...(showPrs ? PRS : []), ...(showJain ? JAIN : [])]
  const who = sel.pr
    ? `PR #${sel.pr} by ${sel.who}`
    : sel.merged
      ? "main"
      : sel.who === "Jain"
        ? "Swapnil Jain (own repo)"
        : sel.who
  const ticksY = [-180, -150, -120, -90, -60, -30, 0]
  const ticksX = [
    { h: 2, label: "Oct 7 00:00" },
    { h: 14, label: "12:00" },
    { h: 26, label: "Oct 8 00:00" },
    { h: 38, label: "12:00" },
  ]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        log₂ κ against time · every checkpoint and PR, the merge into main, and Jain&apos;s six rounds, Oct 6 to Oct 8 (UTC)
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Scatter of log base 2 of kappa against time. OpenAI's 2 to the minus 182 at the left; Colkitt's checkpoints climb to 2 to the minus 30 by 13:10 UTC on October 8; community pull requests climb from 2 to the minus 31 to about 2 to the minus 14.6 and flatten after 12:30 UTC. A red square at 15:18 UTC on October 8 marks pull request 39, opened at 12:58 at 2 to the minus 14.65, being merged into main after the maintainer's audit; it is the first community witness on main. Swapnil Jain's separate track, six diamonds joined by a line, runs from 2 to the minus 27.6 at 07:20 UTC to 2 to the minus 14.7 at 14:03 UTC; its last two points are ringed as Lean-kernel-checked arithmetic. A straight-line extrapolation through 2 to the minus 78 and 2 to the minus 59 reaches kappa equals one at about 13:08 UTC on October 8."
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.2 : 0.6} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {t === 0 ? "κ=1" : `2^${t}`}
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <text key={t.h} x={x(t.h)} y={H - 12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            {t.label}
          </text>
        ))}
        {showLine ? (
          <g>
            <line
              x1={x(EXTRA_A.h)}
              y1={y(EXTRA_A.l2)}
              x2={x(HIT_ONE)}
              y2={y(0)}
              stroke="oklch(0.6 0.15 250)"
              strokeDasharray="3 4"
              strokeWidth={1.6}
            />
            <line x1={x(HIT_ONE)} y1={y(0)} x2={W - R} y2={y(0)} stroke="oklch(0.6 0.15 250)" strokeDasharray="3 4" strokeWidth={1.6} />
            <text x={x(HIT_ONE) - 6} y={y(0) + 14} textAnchor="end" fontSize={10} fill="oklch(0.6 0.15 250)" className="font-mono">
              extrapolated: κ=1 at {stamp(HIT_ONE)}
            </text>
          </g>
        ) : null}
        {showPrs ? <path d={path} fill="none" stroke="oklch(0.62 0.16 150)" strokeWidth={1.2} opacity={0.6} /> : null}
        <g>
          <line
            x1={x(PR39.h)}
            y1={y(PR39.l2)}
            x2={x(MERGED.h)}
            y2={y(MERGED.l2)}
            stroke={PALETTE.Colkitt}
            strokeDasharray="2 3"
            strokeWidth={1.4}
          />
          <line
            x1={x(MERGED.h)}
            y1={y(MERGED.l2) + 6}
            x2={x(MERGED.h)}
            y2={y(MERGED.l2) + 30}
            stroke={PALETTE.Colkitt}
            strokeWidth={0.8}
          />
          <text x={x(MERGED.h) - 4} y={y(MERGED.l2) + 38} textAnchor="end" fontSize={10} fill={PALETTE.Colkitt} className="font-mono">
            #39 merged into main
          </text>
        </g>
        {showJain ? <path d={jainPath} fill="none" stroke={JAIN_COLOUR} strokeWidth={1.2} opacity={0.7} /> : null}
        {all.map((p, i) => {
          const on = p === sel
          if (p.who === "Jain") {
            const r = on ? 6.5 : 4.6
            const cx = x(p.h)
            const cy = y(p.l2)
            return (
              <g key={i} style={{ cursor: "pointer" }} onClick={() => setSel(p)}>
                {p.lean ? <circle cx={cx} cy={cy} r={r + 3.6} fill="none" stroke={JAIN_COLOUR} strokeWidth={1.3} /> : null}
                <path
                  d={`M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`}
                  fill={JAIN_COLOUR}
                  stroke={on ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={on ? 2 : 1}
                />
              </g>
            )
          }
          if (p.merged) {
            const r = on ? 6.5 : 5
            const cx = x(p.h)
            const cy = y(p.l2)
            return (
              <rect
                key={i}
                x={cx - r}
                y={cy - r}
                width={2 * r}
                height={2 * r}
                fill={PALETTE.Colkitt}
                stroke={on ? "var(--foreground)" : "var(--background)"}
                strokeWidth={on ? 2 : 1}
                style={{ cursor: "pointer" }}
                onClick={() => setSel(p)}
              />
            )
          }
          return (
            <circle
              key={i}
              cx={x(p.h)}
              cy={y(p.l2)}
              r={on ? 6 : p.pr ? 3.4 : 4.6}
              fill={colour(p.who)}
              stroke={on ? "var(--foreground)" : "var(--background)"}
              strokeWidth={on ? 2 : 1}
              style={{ cursor: "pointer" }}
              onClick={() => setSel(p)}
            />
          )
        })}
      </svg>

      <div className="mt-2 rounded-md border border-border p-2 font-mono text-xs">
        <span style={{ color: colour(sel.who) }}>{sel.merged ? "■" : "●"}</span> {who} · {stamp(sel.h)} · κ = {sel.k} · log₂ κ = {sel.l2.toFixed(2)}
        {sel.note ? ` · ${sel.note}` : ""}
        {sel.merged ? (
          <>
            {" "}·{" "}
            <a className="underline" href={sel.url}>
              merged PR
            </a>
          </>
        ) : null}
        {sel.pr ? (
          <>
            {" "}·{" "}
            <a className="underline" href={`https://github.com/CrocSwap/integer-mult-bounds/pull/${sel.pr}`}>
              open PR
            </a>
          </>
        ) : null}
        {sel.url && !sel.merged ? (
          <>
            {" "}·{" "}
            <a className="underline" href={sel.url}>
              post
            </a>{" "}
            ·{" "}
            <a className="underline" href={JAIN_REPO}>
              repo
            </a>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowPrs((v) => !v)}
          aria-pressed={showPrs}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showPrs ? "border-foreground" : "border-border text-muted-foreground")}
        >
          community PRs
        </button>
        <button
          type="button"
          onClick={() => setShowLine((v) => !v)}
          aria-pressed={showLine}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showLine ? "border-foreground" : "border-border text-muted-foreground")}
        >
          straight-line extrapolation
        </button>
        <button
          type="button"
          onClick={() => setShowJain((v) => !v)}
          aria-pressed={showJain}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showJain ? "border-foreground" : "border-border text-muted-foreground")}
        >
          Jain&apos;s track
        </button>
        <label className="flex items-center gap-2 font-mono text-muted-foreground">
          step through
          <select
            className="rounded-md border border-border bg-background px-1 py-0.5"
            value={Math.max(0, all.indexOf(sel))}
            onChange={(e) => setSel(all[Number(e.target.value)] ?? ORIGIN)}
            aria-label="Select a checkpoint or pull request"
          >
            {all.map((p, i) => (
              <option key={i} value={i}>
                {p.pr
                  ? `#${p.pr} ${p.who}`
                  : p.merged
                    ? `main ${p.k} (#39 merged)`
                    : `${p.who} ${p.k}${p.lean ? " (Lean)" : ""}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {[...Object.keys(PALETTE), "others"].map((k) => (
          <span key={k}>
            <span style={{ color: k === "others" ? OTHER : PALETTE[k] }}>●</span> {k}
          </span>
        ))}
        <span>
          <span style={{ color: PALETTE.Colkitt }}>■</span> merged into main after the maintainer&apos;s audit
        </span>
        <span>
          <span style={{ color: JAIN_COLOUR }}>◆</span> Jain (own repo)
        </span>
        <span>
          <span style={{ color: JAIN_COLOUR }}>◎</span> arithmetic checked in Lean&apos;s kernel; the other checkpoints and PRs ship exact Python certificates
        </span>
      </div>
    </figure>
  )
}
