"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Two Tencent sources, transcribed by hand:
//  - CHART: the 12-panel bar chart attached to @TencentHunyuan's launch post
//    (2026-11-04). Bar labels read directly; GLM 5.3 has no OSWorld bar.
//  - TABLE: the "Agentic Coding" block of Tencent's comparison table (13 rows).
//    Many competitor cells hold two figures, "a / b*". Following the preview
//    model card's notation, the starred figure is Tencent's own run; the other
//    is the figure published elsewhere. The chart plots the starred one.
// Nothing here is measured by this site: these are Tencent's reported numbers,
// and the widget only counts them.

type Pair = [number | null, number | null] // [other figure, Tencent's run*]
type Opp = "glm" | "ds" | "kimi" | "gpt" | "claude"
type Row = { name: string; internal: boolean; preview: number | null; hy4: number; c: Record<Opp, Pair> }

const n = null
const s = (v: number): Pair => [n, v]

const CHART: Row[] = [
  { name: "ProgramBench", internal: false, preview: 17.5, hy4: 30.0, c: { glm: s(18.0), ds: s(29.0), kimi: s(24.5), gpt: s(46.0), claude: s(56.5) } },
  { name: "FrontierCode 2.0", internal: false, preview: n, hy4: 31.0, c: { glm: s(21.6), ds: s(28.5), kimi: s(25.5), gpt: s(40.6), claude: s(46.4) } },
  { name: "3DArena-Modeling", internal: true, preview: 23.4, hy4: 37.1, c: { glm: s(23.0), ds: s(32.3), kimi: s(36.1), gpt: s(41.8), claude: s(43.4) } },
  { name: "Terminal Bench 4.0", internal: false, preview: 26.3, hy4: 44.4, c: { glm: s(42.9), ds: s(40.0), kimi: s(66.8), gpt: s(55.5), claude: s(66.4) } },
  { name: "Agents' Last Exam v1.1", internal: false, preview: n, hy4: 41.0, c: { glm: s(26.2), ds: s(35.3), kimi: s(43.4), gpt: s(40.2), claude: s(43.4) } },
  { name: "AutomationBench v1.0.6", internal: false, preview: n, hy4: 56.2, c: { glm: s(54.1), ds: s(54.3), kimi: s(65.6), gpt: s(51.4), claude: s(58.8) } },
  { name: "E-Bench 2.0", internal: true, preview: n, hy4: 70.0, c: { glm: s(50.3), ds: s(66.8), kimi: s(50.0), gpt: s(65.3), claude: s(80.0) } },
  { name: "Hy-BrowseComp 2.0", internal: true, preview: n, hy4: 59.9, c: { glm: s(49.3), ds: s(55.1), kimi: s(59.3), gpt: s(61.7), claude: s(60.7) } },
  { name: "PostTrainBench v1.2", internal: false, preview: n, hy4: 35.2, c: { glm: s(31.6), ds: s(29.4), kimi: s(36.2), gpt: s(38.2), claude: s(44.2) } },
  { name: "Terminal Bench Science 0.1", internal: false, preview: n, hy4: 19.8, c: { glm: s(10.0), ds: s(13.7), kimi: s(41.7), gpt: s(60.9), claude: s(56.2) } },
  { name: "TenureTrail", internal: true, preview: n, hy4: 53.6, c: { glm: s(46.0), ds: s(50.1), kimi: s(51.3), gpt: s(57.6), claude: s(59.0) } },
  { name: "OSWorld 2.1", internal: false, preview: n, hy4: 78.9, c: { glm: [n, n], ds: s(68.4), kimi: s(79.6), gpt: s(75.2), claude: s(81.8) } },
]

const TABLE: Row[] = [
  { name: "DeepSWE v1.1", internal: false, preview: 64.3, hy4: 74.9, c: { glm: [66.9, 68.1], ds: [77.0, 73.8], kimi: [75.5, 76.3], gpt: [75.2, 72.7], claude: [74.2, 72.6] } },
  { name: "SWE-Marathon v1.1", internal: false, preview: 31.9, hy4: 43.8, c: { glm: [42.5, 35.6], ds: s(46.3), kimi: [51.7, 53.8], gpt: [42.5, 39.4], claude: [46.3, 44.4] } },
  { name: "ProgramBench", internal: false, preview: 17.5, hy4: 30.0, c: { glm: [19.0, 18.0], ds: [29.1, 29.0], kimi: [31.5, 24.5], gpt: [46.0, 46.0], claude: [65.0, 56.5] } },
  { name: "Terminal-Bench 4.0", internal: false, preview: 26.3, hy4: 44.4, c: { glm: s(42.9), ds: [42.3, 40.0], kimi: [65.7, 66.8], gpt: [55.9, 55.5], claude: [66.4, 66.4] } },
  { name: "FrontierCode 2.0", internal: false, preview: n, hy4: 31.0, c: { glm: [21.6, n], ds: [28.5, n], kimi: [25.5, n], gpt: [40.6, n], claude: [46.4, n] } },
  { name: "Hy-CompanyBench 2.0", internal: true, preview: 62.4, hy4: 78.8, c: { glm: s(64.5), ds: s(79.5), kimi: s(70.0), gpt: s(70.2), claude: s(72.3) } },
  { name: "Hy-SWE Max Verified 2.0", internal: true, preview: 39.2, hy4: 45.4, c: { glm: s(37.7), ds: s(44.3), kimi: s(41.3), gpt: s(45.1), claude: s(56.9) } },
  { name: "Hy-Backend 3.0", internal: true, preview: 23.3, hy4: 45.1, c: { glm: s(29.1), ds: s(37.3), kimi: s(39.8), gpt: s(44.0), claude: s(48.4) } },
  { name: "WebCraftBench", internal: true, preview: 52.7, hy4: 78.9, c: { glm: s(55.4), ds: s(76.1), kimi: s(83.1), gpt: s(85.5), claude: s(78.8) } },
  { name: "GameFix Bench 2.0", internal: true, preview: 65.5, hy4: 68.4, c: { glm: s(63.3), ds: s(67.5), kimi: s(66.3), gpt: s(74.0), claude: s(74.8) } },
  { name: "3DArena-Modeling", internal: true, preview: 23.4, hy4: 37.1, c: { glm: s(23.0), ds: s(32.3), kimi: s(36.1), gpt: s(41.8), claude: s(43.4) } },
  { name: "Goal2Repo", internal: true, preview: 18.1, hy4: 23.2, c: { glm: s(15.2), ds: s(20.3), kimi: s(21.0), gpt: s(58.0), claude: s(74.0) } },
  { name: "AutoCatBench", internal: true, preview: n, hy4: 57.2, c: { glm: s(51.9), ds: s(58.1), kimi: s(62.6), gpt: s(65.8), claude: s(72.4) } },
]

const OPP_LABEL: Record<Opp, string> = {
  glm: "GLM-5.3",
  ds: "DeepSeek-V4.1-Flash",
  kimi: "Kimi K3.1 Pro",
  gpt: "GPT-6.1 Sol",
  claude: "Claude Opus 5.5",
}
const OPEN: Opp[] = ["glm", "ds", "kimi"]
const ALL: Opp[] = ["glm", "ds", "kimi", "gpt", "claude"]

type Source = "chart" | "rerun" | "other"
type Versus = "ds" | "open" | "all"

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

function pick(p: Pair, source: Source): number | null {
  const [other, run] = p
  if (source === "other") return other ?? run
  return run ?? other
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function ClaimLedger() {
  const [source, setSource] = useState<Source>("chart")
  const [versus, setVersus] = useState<Versus>("ds")
  const [internal, setInternal] = useState(true)

  const rows = useMemo(() => {
    const base = source === "chart" ? CHART : TABLE
    return base
      .filter((r) => internal || !r.internal)
      .map((r) => {
        const pool = versus === "ds" ? (["ds"] as Opp[]) : versus === "open" ? OPEN : ALL
        let best: { who: Opp; v: number } | null = null
        for (const o of pool) {
          const v = pick(r.c[o], source)
          if (v === null) continue
          if (!best || v > best.v) best = { who: o, v }
        }
        const margin = best ? r.hy4 - best.v : 0
        return { ...r, best, margin, win: best !== null && margin > 0 }
      })
  }, [source, versus, internal])

  const wins = rows.filter((r) => r.win).length
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.margin)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">Tencent&rsquo;s own numbers, counted</span>
        <Pill on={source === "chart"} onClick={() => setSource("chart")}>launch chart (12)</Pill>
        <Pill on={source === "rerun"} onClick={() => setSource("rerun")}>coding table, Tencent runs*</Pill>
        <Pill on={source === "other"} onClick={() => setSource("other")}>coding table, other figure</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="mr-1 font-mono text-[10px] text-muted-foreground">Hy4 vs</span>
        <Pill on={versus === "ds"} onClick={() => setVersus("ds")}>DeepSeek-V4.1-Flash</Pill>
        <Pill on={versus === "open"} onClick={() => setVersus("open")}>best of 3 open</Pill>
        <Pill on={versus === "all"} onClick={() => setVersus("all")}>best of all 5</Pill>
        <span className="mx-1 h-4 w-px bg-border" />
        <Pill on={internal} onClick={() => setInternal(!internal)}>{internal ? "internal benchmarks: in" : "internal benchmarks: out"}</Pill>
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-3 font-mono text-sm">
          Hy4 ahead on{" "}
          <span className="font-bold" style={{ color: wins * 2 >= rows.length ? GOOD : BAD }}>
            {wins} of {rows.length}
          </span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse font-mono text-[10.5px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">benchmark</th>
                <th className="px-1.5 py-1 text-right font-normal">preview</th>
                <th className="px-1.5 py-1 text-right font-normal">Hy4</th>
                <th className="px-1.5 py-1 text-left font-normal">strongest rival here</th>
                <th className="w-[30%] px-1.5 py-1 text-left font-normal">margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-1 text-foreground">
                    {r.name}
                    {r.internal ? <span className="ml-1 text-muted-foreground">(int.)</span> : null}
                  </td>
                  <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.preview === null ? "-" : r.preview.toFixed(1)}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums text-foreground">{r.hy4.toFixed(1)}</td>
                  <td className="px-1.5 py-1 text-muted-foreground">
                    {r.best ? `${OPP_LABEL[r.best.who]} ${r.best.v.toFixed(1)}` : "no entry"}
                  </td>
                  <td className="px-1.5 py-1">
                    <div className="flex items-center gap-1.5">
                      <div className="relative h-2.5 flex-1 rounded-sm bg-muted/40">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                        <div
                          className="absolute inset-y-0 rounded-sm"
                          style={{
                            background: r.win ? GOOD : BAD,
                            left: r.margin >= 0 ? "50%" : `${50 - (Math.abs(r.margin) / maxAbs) * 50}%`,
                            width: `${(Math.abs(r.margin) / maxAbs) * 50}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums" style={{ color: r.win ? GOOD : BAD }}>
                        {r.margin >= 0 ? "+" : ""}
                        {r.margin.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every number is Tencent&rsquo;s. &ldquo;Tencent runs*&rdquo; uses the starred cell where the table
          gives two figures; &ldquo;other figure&rdquo; uses the unstarred one, which is not Tencent&rsquo;s
          run by the preview card&rsquo;s notation. Against DeepSeek-V4.1-Flash on the chart, Hy4 is ahead on
          all 12. Against the best of the three open models it is ahead on 6, and four of those six are
          Tencent-internal benchmarks. Against all five it leads none.
        </p>
      </div>
    </figure>
  )
}
