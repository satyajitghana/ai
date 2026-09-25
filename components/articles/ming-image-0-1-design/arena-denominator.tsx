import { cn } from "@/lib/utils"
import { mpow } from "@/lib/dmath"

// The "#1 among open-weight models" claim with its denominators put back.
//
// Every number is Artificial Analysis's own, read on 23 September 2026 from
// the data embedded in artificialanalysis.ai/text-to-image/arena/leaderboard-text:
// a per-category array of { elo, ciDelta, appearances, openWeightsUrl }. The
// ratings are Bradley-Terry maximum-likelihood fits rescaled to an Elo range and
// anchored at FLUX.2 [dev] = 1000 in every view, so FLUX.2 [dev] shows a zero
// interval by construction. ci is the published 95% half-width.
//
// The expected head-to-head rate is the Elo logistic, 1 / (1 + 10^(-d/400)).
// That is what a Bradley-Terry rating difference means, not a separate
// measurement; the pow goes through lib/dmath so server and client agree.
//
// Server-rendered, zero JS.

type Entry = { rank: number; name: string; elo: number; ci: number; n: number; ow: boolean; note?: string }

const UIUX: Entry[] = [
  { rank: 1, name: "GPT Image 2.5 Flare (max)", elo: 1228.03, ci: 27, n: 1288, ow: false },
  { rank: 2, name: "GPT Image 2.5 Sunburst (max)", elo: 1219.46, ci: 27, n: 1306, ow: false },
  { rank: 3, name: "GPT Image 2 (high)", elo: 1204.01, ci: 26, n: 1500, ow: false },
  { rank: 4, name: "Grok Imagine Image 2.0", elo: 1180.45, ci: 33, n: 604, ow: false },
  { rank: 5, name: "MAI-Image-2.6", elo: 1167.79, ci: 29, n: 821, ow: false },
  { rank: 6, name: "Nano Banana 2", elo: 1166.51, ci: 24, n: 1707, ow: false },
  { rank: 7, name: "MAI-Image-2.6-Flash", elo: 1148.24, ci: 28, n: 562, ow: false },
  { rank: 8, name: "Nano Banana Pro", elo: 1135.92, ci: 24, n: 1603, ow: false },
  { rank: 9, name: "Muse Image", elo: 1134.09, ci: 29, n: 705, ow: false },
  { rank: 10, name: "MAI-Image-2.5-Pro", elo: 1131.15, ci: 24, n: 1231, ow: false },
  { rank: 11, name: "Nano Banana 2 Lite", elo: 1118.8, ci: 24, n: 1610, ow: false },
  { rank: 12, name: "GPT Image 1.5 (high)", elo: 1117.49, ci: 24, n: 1481, ow: false },
  { rank: 13, name: "Seedream 5.0 Pro", elo: 1098.69, ci: 24, n: 1221, ow: false },
  { rank: 14, name: "MAI-Image-2.5", elo: 1095.08, ci: 24, n: 1499, ow: false },
  { rank: 15, name: "Qwen-Image-3.0-Pro", elo: 1091.95, ci: 28, n: 648, ow: false },
  { rank: 16, name: "Ming-Image-0.1-Design", elo: 1083.44, ci: 22, n: 2095, ow: true },
  { rank: 17, name: "Qwen-Image-3.0", elo: 1082.82, ci: 29, n: 544, ow: false },
  { rank: 18, name: "grok-imagine-image-quality", elo: 1067.51, ci: 22, n: 1681, ow: false },
  { rank: 19, name: "FLUX.2 [flex]", elo: 1066.53, ci: 27, n: 551, ow: false },
  { rank: 20, name: "Wan 2.7", elo: 1065.13, ci: 26, n: 553, ow: false },
  { rank: 21, name: "Ideogram 4.0 (Quality)", elo: 1050.38, ci: 23, n: 1122, ow: true, note: "non-commercial licence" },
  { rank: 30, name: "Ideogram 4.0", elo: 1016.34, ci: 24, n: 944, ow: true, note: "non-commercial licence" },
  { rank: 42, name: "FLUX.2 [dev]", elo: 1000, ci: 0, n: 1944, ow: true, note: "the anchor" },
  { rank: 62, name: "Z-Image Turbo", elo: 948.02, ci: 25, n: 755, ow: true, note: "Ming's DiT's sibling" },
  { rank: 84, name: "Z-Image Base", elo: 839.64, ci: 31, n: 265, ow: true, note: "Ming's DiT's parent" },
]

const LO = 800
const HI = 1260
const x = (elo: number) => ((elo - LO) * 100) / (HI - LO)

const MING = 1083.44
const winRate = (d: number) => 1 / (1 + mpow(10, -d / 400))

type View = { label: string; rank: number; of: number; owRank: number; owOf: number; elo: number; ci: number; n: number }

const VIEWS: View[] = [
  { label: "overall (all prompts)", rank: 45, of: 161, owRank: 6, owOf: 52, elo: 993.65, ci: 8, n: 21276 },
  { label: "UI/UX Design", rank: 16, of: 129, owRank: 1, owOf: 42, elo: 1083.44, ci: 22, n: 2095 },
  { label: "Layout", rank: 19, of: 121, owRank: 1, owOf: 38, elo: 1072.02, ci: 22, n: 2328 },
  { label: "Text Rendering", rank: 23, of: 121, owRank: 1, owOf: 37, elo: 1001.25, ci: 21, n: 2374 },
  { label: "Productivity & Knowledge Work", rank: 21, of: 121, owRank: 2, owOf: 38, elo: 1041.79, ci: 22, n: 2130 },
  { label: "Reasoning", rank: 43, of: 97, owRank: 4, owOf: 31, elo: 1016.05, ci: 20, n: 2320 },
  { label: "Knowledge", rank: 39, of: 111, owRank: 4, owOf: 35, elo: 1013.86, ci: 21, n: 2362 },
  { label: "Retail & E-commerce", rank: 37, of: 120, owRank: 4, owOf: 36, elo: 995.08, ci: 22, n: 2152 },
  { label: "Marketing & Advertising", rank: 43, of: 161, owRank: 5, owOf: 52, elo: 998.96, ci: 24, n: 2137 },
  { label: "Animation & Gaming", rank: 39, of: 161, owRank: 6, owOf: 52, elo: 1016.45, ci: 22, n: 2135 },
  { label: "Human Anatomy", rank: 46, of: 151, owRank: 7, owOf: 50, elo: 1000.43, ci: 23, n: 2409 },
  { label: "Complex Compositions", rank: 50, of: 134, owRank: 7, owOf: 42, elo: 1003.91, ci: 22, n: 2388 },
  { label: "Social Media & Creator", rank: 53, of: 91, owRank: 12, owOf: 28, elo: 982.96, ci: 22, n: 2075 },
  { label: "Architecture & Real Estate", rank: 56, of: 134, owRank: 12, owOf: 43, elo: 965.14, ci: 21, n: 2118 },
  { label: "Frontier", rank: 61, of: 88, owRank: 13, owOf: 26, elo: 965.84, ci: 21, n: 2038 },
  { label: "Lighting", rank: 59, of: 103, owRank: 13, owOf: 32, elo: 952.45, ci: 21, n: 2348 },
  { label: "Consumer", rank: 66, of: 161, owRank: 14, owOf: 52, elo: 963.16, ci: 22, n: 2191 },
  { label: "Material", rank: 65, of: 112, owRank: 15, owOf: 36, elo: 947.11, ci: 21, n: 2375 },
  { label: "Physics", rank: 70, of: 100, owRank: 15, owOf: 31, elo: 942.1, ci: 21, n: 2343 },
  { label: "Live-Action Film", rank: 78, of: 161, owRank: 17, owOf: 52, elo: 938.91, ci: 21, n: 2123 },
]

const HEAD2HEAD = [
  { vs: "GPT Image 2.5 Flare (max), #1 overall in UI/UX", elo: 1228.03 },
  { vs: "Ideogram 4.0 (Quality), #2 open-weight, non-commercial", elo: 1050.38 },
  { vs: "HiDream-O1-Image, the next MIT or Apache model", elo: 985.18 },
  { vs: "Z-Image Turbo", elo: 948.02 },
  { vs: "Z-Image Base, the DiT's initialisation", elo: 839.64 },
]

export function ArenaDenominator() {
  const firsts = VIEWS.filter((v) => v.owRank === 1).length
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-arena-denominator={UIUX.length}
      aria-label="Artificial Analysis UI/UX Design leaderboard with 95% confidence intervals, and Ming-Image-0.1-Design's rank in all twenty leaderboard views"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        Artificial Analysis text-to-image arena, UI/UX Design &mdash; all 129 models, top 21 plus four reference rows &mdash; 23 Sep 2026
      </div>

      <div className="space-y-1 px-4 py-4">
        {UIUX.map((e, i) => {
          const gap = i > 0 && e.rank - UIUX[i - 1].rank > 1
          const ming = e.name === "Ming-Image-0.1-Design"
          return (
            <div key={e.name}>
              {gap ? <div className="py-0.5 pl-8 font-mono text-[10px] text-muted-foreground">&hellip;</div> : null}
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {e.rank}
                </span>
                <span
                  className={cn(
                    "w-24 shrink-0 truncate font-mono text-[11px] sm:w-52",
                    ming ? "font-semibold text-sky-700 dark:text-sky-400" : e.ow ? "text-foreground" : "text-muted-foreground"
                  )}
                  title={e.note ? `${e.name} — ${e.note}` : e.name}
                >
                  {e.name}
                  {e.ow && !ming ? <span className="text-muted-foreground"> &middot; open</span> : null}
                </span>
                <div className="relative h-4 flex-1">
                  <div className="absolute inset-y-[7px] right-0 left-0 bg-muted/60" />
                  <div className="absolute inset-y-0 w-px bg-foreground/20" style={{ left: `${x(1000)}%` }} />
                  <div
                    className={cn("absolute inset-y-[5px] rounded-full", ming ? "bg-sky-500/40" : "bg-foreground/15")}
                    style={{ left: `${x(e.elo - e.ci)}%`, width: `${x(e.elo + e.ci) - x(e.elo - e.ci)}%` }}
                  />
                  <div
                    className={cn(
                      "absolute top-0.5 h-3 w-1 -translate-x-1/2 rounded-sm",
                      ming ? "bg-sky-600" : e.ow ? "bg-foreground/80" : "bg-foreground/40"
                    )}
                    style={{ left: `${x(e.elo)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums">
                  {e.elo.toFixed(0)}
                  <span className="text-muted-foreground"> &plusmn;{e.ci}</span>
                </span>
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0" />
          <span className="w-24 shrink-0 sm:w-52" />
          <div className="relative h-4 flex-1 font-mono text-[10px] text-muted-foreground">
            <span className="absolute left-0">{LO}</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${x(1000)}%` }}>
              1000
            </span>
            <span className="absolute right-0">{HI}</span>
          </div>
          <span className="w-20 shrink-0" />
        </div>
      </div>

      <div className="border-t px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          what a rating gap means: expected share of UI/UX votes Ming wins, head to head
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-[1fr_auto]">
          {HEAD2HEAD.map((h) => {
            const d = MING - h.elo
            return (
              <div key={h.vs} className="contents">
                <dt className="text-muted-foreground">
                  vs {h.vs} ({d > 0 ? "+" : ""}
                  {d.toFixed(1)})
                </dt>
                <dd className="my-0 tabular-nums">{(winRate(d) * 100).toFixed(1)}%</dd>
              </div>
            )
          })}
        </dl>
      </div>

      <div className="border-t px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          the same model in all 20 views &mdash; rank among all models, then among open-weight models
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="my-0 w-full min-w-[460px] border-collapse text-left font-mono text-[11px]">
            <tbody>
              {VIEWS.map((v) => (
                <tr key={v.label} className={cn("border-b last:border-b-0", v.owRank === 1 && "bg-sky-500/10")}>
                  <td className="py-1 pr-2">{v.label}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {v.rank}
                    <span className="text-muted-foreground">/{v.of}</span>
                  </td>
                  <td className={cn("py-1 pr-2 text-right tabular-nums", v.owRank === 1 && "font-semibold")}>
                    {v.owRank}
                    <span className="font-normal text-muted-foreground">/{v.owOf} open</span>
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {v.elo.toFixed(0)}
                    <span className="text-muted-foreground"> &plusmn;{v.ci}</span>
                  </td>
                  <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">{v.n.toLocaleString("en-US")} appearances</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        First among open-weight models in {firsts} of 20 views, and in two of those
        three the lead is inside the noise: +7.0 Elo in Layout, +1.25 in Text
        Rendering, against intervals of &plusmn;21&ndash;23. Only the UI/UX lead,
        +33.1, is about two standard errors wide. Artificial Analysis does not tag
        Z-Image Base as open weights; it is, under Apache-2.0, and adding it would
        not change any rank above it.
      </figcaption>
    </figure>
  )
}
