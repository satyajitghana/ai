"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Every number here is copied from BENCHMARKS.md's per-repo sections (24 Aug
// 2026 sweep at commit 82b88a1) — the "At a glance" table's Avg-per-query
// columns for ripgrep and tgrep, plus the "Index build time" / "Index size"
// lines each repo section states separately. BENCHMARKS.md never puts these
// two kinds of number in the same table; this component is what that
// combination looks like.
//
// breakEvenQueries = buildMs / (ripgrepPerQueryMs - tgrepPerQueryMs) is
// arithmetic on those disclosed numbers, not a number BENCHMARKS.md or the
// README states anywhere. It answers the question neither document asks:
// how many queries against a freshly-built index does it take before tgrep's
// one-time index build has paid for itself against ripgrep's zero-setup cold
// scan? Below that many queries in a session, ripgrep's "just scan, no setup"
// is cheaper; above it, tgrep wins on every subsequent query, including the
// ones already run.

type Cell = {
  repo: string
  short: string
  files: string
  platform: "Windows" | "macOS" | "Linux"
  buildMs: number
  rgMs: number
  tgMs: number
  indexMb: number
}

const DATA: Cell[] = [
  { repo: "chromium/chromium", short: "chromium", files: "504K", platform: "Linux", buildMs: 52_000, rgMs: 2404.2, tgMs: 631.4, indexMb: 2584 },
  { repo: "chromium/chromium", short: "chromium", files: "504K", platform: "Windows", buildMs: 73_000, rgMs: 24575.8, tgMs: 1396.1, indexMb: 2584 },
  { repo: "chromium/chromium", short: "chromium", files: "504K", platform: "macOS", buildMs: 248_000, rgMs: 41806.2, tgMs: 2643.1, indexMb: 2584 },
  { repo: "mozilla/gecko-dev", short: "gecko-dev", files: "388K", platform: "Linux", buildMs: 35_000, rgMs: 1194.9, tgMs: 162.4, indexMb: 1952 },
  { repo: "mozilla/gecko-dev", short: "gecko-dev", files: "388K", platform: "Windows", buildMs: 58_000, rgMs: 17841.2, tgMs: 462.6, indexMb: 1952 },
  { repo: "mozilla/gecko-dev", short: "gecko-dev", files: "388K", platform: "macOS", buildMs: 165_000, rgMs: 33401.8, tgMs: 643.0, indexMb: 1952 },
  { repo: "torvalds/linux", short: "linux", files: "96K", platform: "Linux", buildMs: 21_000, rgMs: 426.9, tgMs: 45.5, indexMb: 1000 },
  { repo: "torvalds/linux", short: "linux", files: "96K", platform: "Windows", buildMs: 26_000, rgMs: 3280.0, tgMs: 94.2, indexMb: 1000 },
  { repo: "torvalds/linux", short: "linux", files: "96K", platform: "macOS", buildMs: 37_000, rgMs: 5390.3, tgMs: 256.1, indexMb: 1000 },
  { repo: "rust-lang/rust", short: "rust", files: "62K", platform: "Linux", buildMs: 4_000, rgMs: 144.2, tgMs: 89.4, indexMb: 199 },
  { repo: "rust-lang/rust", short: "rust", files: "62K", platform: "Windows", buildMs: 6_000, rgMs: 1489.4, tgMs: 193.7, indexMb: 199 },
  { repo: "rust-lang/rust", short: "rust", files: "62K", platform: "macOS", buildMs: 8_000, rgMs: 654.6, tgMs: 243.6, indexMb: 199 },
  { repo: "kubernetes/kubernetes", short: "kubernetes", files: "31K", platform: "Linux", buildMs: 4_000, rgMs: 94.4, tgMs: 101.8, indexMb: 215 },
  { repo: "kubernetes/kubernetes", short: "kubernetes", files: "31K", platform: "Windows", buildMs: 7_000, rgMs: 1342.3, tgMs: 189.5, indexMb: 215 },
  { repo: "kubernetes/kubernetes", short: "kubernetes", files: "31K", platform: "macOS", buildMs: 5_000, rgMs: 285.9, tgMs: 101.9, indexMb: 215 },
  { repo: "golang/go", short: "go", files: "16K", platform: "Linux", buildMs: 2_000, rgMs: 44.1, tgMs: 34.1, indexMb: 113 },
  { repo: "golang/go", short: "go", files: "16K", platform: "Windows", buildMs: 3_000, rgMs: 591.7, tgMs: 78.6, indexMb: 113 },
  { repo: "golang/go", short: "go", files: "16K", platform: "macOS", buildMs: 3_000, rgMs: 204.6, tgMs: 65.6, indexMb: 113 },
]

const REPOS = ["chromium", "gecko-dev", "linux", "rust", "kubernetes", "go"] as const
const PLATFORMS = ["Windows", "macOS", "Linux"] as const

const RG = "oklch(0.62 0.03 250)"
const TG = "oklch(0.55 0.16 155)"
const LOSE = "oklch(0.58 0.19 27)"

const W = 640
const H = 260
const PL = 46
const PB = 28
const PT = 16
const PR = 14

function fmtS(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : `${ms.toFixed(0)}ms`
}

export function BreakevenChart() {
  const [repo, setRepo] = useState<(typeof REPOS)[number]>("linux")
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Linux")

  const cell = useMemo(() => DATA.find((d) => d.short === repo && d.platform === platform)!, [repo, platform])

  const diff = cell.rgMs - cell.tgMs
  const breakeven = diff > 0 ? cell.buildMs / diff : null
  const neverWins = diff <= 0

  const maxN = useMemo(() => {
    const suggested = breakeven ? Math.ceil(breakeven * 2.4) : 60
    return Math.min(500, Math.max(20, suggested))
  }, [breakeven])

  const [n, setN] = useState(() => Math.max(1, Math.round(breakeven ?? 20)))
  const clampedN = Math.min(n, maxN)

  const rgAt = (k: number) => k * cell.rgMs
  const tgAt = (k: number) => cell.buildMs + k * cell.tgMs

  const yMax = Math.max(rgAt(maxN), tgAt(maxN))
  const x = (k: number) => PL + (k / maxN) * (W - PL - PR)
  const y = (ms: number) => PT + (1 - ms / yMax) * (H - PT - PB)

  const api = rgAt(clampedN)
  const paw = tgAt(clampedN)
  const ratio = paw > 0 ? api / paw : 0

  const gapPath = `M ${x(0)} ${y(rgAt(0))} L ${x(clampedN)} ${y(rgAt(clampedN))} L ${x(clampedN)} ${y(tgAt(clampedN))} L ${x(0)} ${y(tgAt(0))} Z`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">cumulative wall time · index build + N queries vs. N cold scans</span>
        <div className="flex flex-wrap gap-1.5">
          {REPOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRepo(r)}
              aria-pressed={repo === r}
              className={`cursor-pointer rounded-full border px-2 py-1 font-mono text-[10px] transition-colors ${
                repo === r ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                aria-pressed={platform === p}
                className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  platform === p ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {cell.repo} · {cell.files} files · index build {fmtS(cell.buildMs)} · {cell.indexMb.toLocaleString()} MB on disk
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">queries run so far</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{clampedN}</div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: RG }}>ripgrep, N cold scans</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: RG }}>{fmtS(api)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: neverWins ? LOSE : TG }}>tgrep, build + N queries</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: neverWins ? LOSE : TG }}>{fmtS(paw)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">tgrep is</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {ratio >= 1 ? `${ratio.toFixed(1)}×` : `${(1 / ratio).toFixed(1)}×`}
                <span className="text-xs text-muted-foreground">{ratio >= 1 ? " cheaper" : " pricier"}</span>
              </div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${clampedN} queries on ${cell.repo} (${platform}), ripgrep totals ${fmtS(api)} and tgrep totals ${fmtS(paw)} including its one-time index build`}>
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={PL} x2={W - PR} y1={y(g * yMax)} y2={y(g * yMax)} stroke="currentColor" className="text-border" strokeWidth={1} />
          ))}
          {[0, 0.5, 1].map((g) => (
            <text key={g} x={PL - 6} y={y(g * yMax) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
              {fmtS(g * yMax)}
            </text>
          ))}

          {breakeven !== null && breakeven <= maxN && (
            <>
              <line x1={x(breakeven)} x2={x(breakeven)} y1={PT} y2={H - PB} stroke="currentColor" className="text-border" strokeDasharray="3 3" strokeWidth={1} />
              <text x={x(breakeven) + 4} y={PT + 10} className="fill-muted-foreground font-mono" fontSize={9}>
                break-even ≈ {breakeven < 10 ? breakeven.toFixed(1) : Math.round(breakeven)} queries
              </text>
            </>
          )}

          <path d={gapPath} fill={neverWins ? LOSE : TG} opacity={0.08} />

          <path d={`M ${x(0)} ${y(rgAt(0))} L ${x(maxN)} ${y(rgAt(maxN))}`} fill="none" stroke={RG} strokeWidth={2.5} strokeLinecap="round" />
          <path d={`M ${x(0)} ${y(tgAt(0))} L ${x(maxN)} ${y(tgAt(maxN))}`} fill="none" stroke={neverWins ? LOSE : TG} strokeWidth={2.5} strokeLinecap="round" />

          <circle cx={x(clampedN)} cy={y(api)} r={4} fill={RG} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={x(clampedN)} cy={y(paw)} r={4} fill={neverWins ? LOSE : TG} stroke="var(--background)" strokeWidth={1.5} />
          <line x1={x(clampedN)} x2={x(clampedN)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/20" strokeWidth={1} />

          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            queries run in this session →
          </text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">queries run</span>
          <Range min={1} max={maxN} value={clampedN} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer" accent={neverWins ? LOSE : TG} />
        </label>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {neverWins ? (
            <>
              On <span className="text-foreground">{cell.repo}</span> ({platform}), tgrep&rsquo;s own per-query cost
              here (<span style={{ color: LOSE }}>{fmtS(cell.tgMs)}</span>) is already higher than{" "}
              <span style={{ color: RG }}>ripgrep&rsquo;s cold scan</span> ({fmtS(cell.rgMs)}) — the index never earns
              back its {fmtS(cell.buildMs)} build, and every additional query only widens the loss. This is the one
              cell in BENCHMARKS.md&rsquo;s 18-cell sweep where that happens.
            </>
          ) : (
            <>
              Every query on <span className="text-foreground">{cell.repo}</span> ({platform}) already costs less
              through <span style={{ color: TG }}>tgrep</span> than through a{" "}
              <span style={{ color: RG }}>cold ripgrep scan</span>, so the lines cross once the flat {fmtS(cell.buildMs)}{" "}
              index build has been paid back — at roughly{" "}
              <span className="text-foreground">{breakeven! < 10 ? breakeven!.toFixed(1) : Math.round(breakeven!)} queries</span> in this
              session. Past that point the gap only widens, and every query already run before it counts toward
              paying it off.
            </>
          )}{" "}
          Neither BENCHMARKS.md nor the README states this number — it only reports steady-state per-query latency
          with the index already built. This is that same data, just not thrown away.
        </p>
      </div>
    </figure>
  )
}
