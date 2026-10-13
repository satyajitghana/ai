"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// The Artificial Analysis Intelligence Index v4.3.2, rebuilt from its parts.
//
// Weights and normalisation: artificialanalysis.ai/methodology/intelligence-benchmarking
// (fetched 2026-10-13). Ten evaluations in four categories; AA-Omniscience is split
// into accuracy (10%) and 1 - hallucination rate (5%). The two Elo evaluations
// (AA-Briefcase, GDPval-AA) enter as clamp((Elo - 500) / 2000).
//
// Per-model scores: the model objects embedded in artificialanalysis.ai/models/*
// pages (fields intelligenceIndexEvaluations, omniscienceAccuracy,
// omniscienceHallucinationRate), fetched 2026-10-13. Recomputing from them gives
// 55.80 for Muse Wonder Full and 52.39 for Muse Wonder, exactly AA's published
// figures. Older models come out up to 0.17 points off because AA freezes an Elo
// at the time a model is added and the page carries today's Elo.

type Key =
  | "briefcase"
  | "gdpval"
  | "automation"
  | "tb4"
  | "scicode"
  | "omniAcc"
  | "omniHall"
  | "hle"
  | "gdppdf"
  | "critpt"
  | "lcr"

type Comp = {
  key: Key
  name: string
  cat: "Agents" | "Coding" | "General" | "Science"
  w: number
  unit: "Elo" | "%"
  priv: boolean
  // index points contributed by a raw score
  pts: (v: number) => number
  // nudge range in the raw unit
  span: number
  note: string
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

const COMPS: Comp[] = [
  { key: "briefcase", name: "AA-Briefcase", cat: "Agents", w: 15, unit: "Elo", priv: true, pts: (v) => 15 * clamp01((v - 500) / 2000), span: 200, note: "133 Elo moves the index 1 point" },
  { key: "gdpval", name: "GDPval-AA", cat: "Agents", w: 10, unit: "Elo", priv: false, pts: (v) => 10 * clamp01((v - 500) / 2000), span: 200, note: "200 Elo moves the index 1 point" },
  { key: "automation", name: "AutomationBench-AA", cat: "Agents", w: 5, unit: "%", priv: true, pts: (v) => 0.05 * v, span: 20, note: "20 points of score move the index 1 point" },
  { key: "tb4", name: "Terminal-Bench 4.0", cat: "Coding", w: 10, unit: "%", priv: false, pts: (v) => 0.1 * v, span: 20, note: "66 tasks: one task is about 0.15 index points" },
  { key: "scicode", name: "SciCode", cat: "Coding", w: 10, unit: "%", priv: false, pts: (v) => 0.1 * v, span: 20, note: "10 points of score move the index 1 point" },
  { key: "omniAcc", name: "Omniscience accuracy", cat: "General", w: 10, unit: "%", priv: true, pts: (v) => 0.1 * v, span: 25, note: "share of 6,000 questions answered right" },
  { key: "omniHall", name: "Omniscience hallucination", cat: "General", w: 5, unit: "%", priv: true, pts: (v) => 0.05 * (100 - v), span: 25, note: "lower is better; enters as 1 minus the rate" },
  { key: "gdppdf", name: "GDP.pdf", cat: "General", w: 10, unit: "%", priv: false, pts: (v) => 0.1 * v, span: 20, note: "all-pass rate over 100 tasks" },
  { key: "lcr", name: "AA-LCR", cat: "General", w: 5, unit: "%", priv: false, pts: (v) => 0.05 * v, span: 20, note: "long-context reasoning, 100 questions" },
  { key: "hle", name: "Humanity's Last Exam", cat: "Science", w: 10, unit: "%", priv: false, pts: (v) => 0.1 * v, span: 20, note: "2,158 questions, no tools" },
  { key: "critpt", name: "CritPt", cat: "Science", w: 10, unit: "%", priv: true, pts: (v) => 0.1 * v, span: 20, note: "70 problems: one is about 0.14 index points" },
]

type Model = { id: string; name: string; aa: number; s: Record<Key, number> }

const MODELS: Model[] = [
  { id: "muse-wonder-full", name: "Muse Wonder Full", aa: 55.8, s: { briefcase: 1729.32, gdpval: 1857.09, automation: 71.33, tb4: 57.07, scicode: 62.62, omniAcc: 43.22, omniHall: 23.01, hle: 53.61, gdppdf: 32.6, critpt: 32.86, lcr: 83.67 } },
  { id: "muse-wonder", name: "Muse Wonder", aa: 52.39, s: { briefcase: 1658.65, gdpval: 1770.34, automation: 68.09, tb4: 52.02, scicode: 60.3, omniAcc: 41.1, omniHall: 26.51, hle: 50.09, gdppdf: 30.6, critpt: 28.29, lcr: 80.67 } },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", aa: 57.62, s: { briefcase: 1807.05, gdpval: 1866.27, automation: 69.54, tb4: 59.6, scicode: 66.9, omniAcc: 66.22, omniHall: 58.61, hle: 61.35, gdppdf: 26.2, critpt: 31.71, lcr: 84.67 } },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", aa: 56.0, s: { briefcase: 1823, gdpval: 1837.82, automation: 71.77, tb4: 63.64, scicode: 61.0, omniAcc: 53.95, omniHall: 47.01, hle: 54.96, gdppdf: 25.8, critpt: 31.43, lcr: 82.67 } },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", aa: 53.35, s: { briefcase: 1674.62, gdpval: 1756.22, automation: 59.38, tb4: 52.02, scicode: 63.08, omniAcc: 67.23, omniHall: 72.58, hle: 59.13, gdppdf: 26.2, critpt: 29.71, lcr: 85.33 } },
  { id: "gpt-6-astra", name: "GPT-6 Astra", aa: 52.67, s: { briefcase: 1571.12, gdpval: 1571.66, automation: 68.49, tb4: 59.09, scicode: 56.48, omniAcc: 62.6, omniHall: 51.34, hle: 54.68, gdppdf: 31.0, critpt: 31.71, lcr: 80.67 } },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", aa: 52.56, s: { briefcase: 1488.47, gdpval: 1623.83, automation: 77.51, tb4: 57.07, scicode: 61.81, omniAcc: 49.9, omniHall: 15.07, hle: 57.09, gdppdf: 21.8, critpt: 27.14, lcr: 79.67 } },
  { id: "muse-spark-1-3", name: "Muse Spark 1.3", aa: 48.09, s: { briefcase: 1581.34, gdpval: 1680.99, automation: 57.85, tb4: 33.33, scicode: 58.8, omniAcc: 43.58, omniHall: 32.94, hle: 48.7, gdppdf: 26.6, critpt: 24.86, lcr: 83.0 } },
]

const META = "oklch(0.58 0.17 255)"
const OTHER = "oklch(0.62 0.15 40)"

const f2 = (n: number) => n.toFixed(2)
const sgn = (n: number) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "±") + Math.abs(n).toFixed(2)

function total(s: Record<Key, number>) {
  return COMPS.reduce((acc, c) => acc + c.pts(s[c.key]), 0)
}

export function IndexGap() {
  const [aId, setA] = useState("muse-wonder-full")
  const [bId, setB] = useState("claude-opus-5-5")
  const [nudgeKey, setNudgeKey] = useState<Key>("tb4")
  const [nudge, setNudge] = useState(0)

  const a = MODELS.find((m) => m.id === aId) ?? MODELS[0]
  const b = MODELS.find((m) => m.id === bId) ?? MODELS[2]
  const nc = COMPS.find((c) => c.key === nudgeKey) ?? COMPS[3]

  const aS = { ...a.s, [nudgeKey]: a.s[nudgeKey] + nudge }
  if (nc.unit === "%") aS[nudgeKey] = Math.min(100, Math.max(0, aS[nudgeKey]))

  const ta = total(aS)
  const ta0 = total(a.s)
  const tb = total(b.s)
  const gap = ta - tb
  const gap0 = ta0 - tb

  const rows = COMPS.map((c) => {
    const pa = c.pts(aS[c.key])
    const pb = c.pts(b.s[c.key])
    return { c, pa, pb, d: pa - pb }
  })
  const maxAbs = Math.max(2.5, ...rows.map((r) => Math.abs(r.d)))

  const privD = rows.filter((r) => r.c.priv).reduce((x, r) => x + r.d, 0)
  const pubD = rows.filter((r) => !r.c.priv).reduce((x, r) => x + r.d, 0)

  const W = 720
  const ROW = 26
  // "Omniscience hallucination *" is 27 mono glyphs at 11 px, ~182 px from x=4;
  // the weight is right-anchored at LABEL - 8, so LABEL leaves it ~25 px clear.
  const LABEL = 230
  const MID = LABEL + (W - LABEL - 70) / 2
  const HALF = (W - LABEL - 70) / 2 - 6
  const H = rows.length * ROW + 30

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>AA Intelligence Index v4.3.2, rebuilt from its ten evaluations</span>
        <span className="text-muted-foreground/60">scores from artificialanalysis.ai, 2026-10-13</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">A</span>
            <select
              value={aId}
              onChange={(e) => {
                setA(e.target.value)
                setNudge(0)
              }}
              className="rounded-md border bg-background px-2 py-1"
              style={{ color: META }}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-muted-foreground">vs</span>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">B</span>
            <select value={bId} onChange={(e) => setB(e.target.value)} className="rounded-md border bg-background px-2 py-1" style={{ color: OTHER }}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">A rebuilt</div>
            <div className="text-lg" style={{ color: META }}>{f2(ta)}</div>
            <div className="text-muted-foreground/70">AA shows {f2(a.aa)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">B rebuilt</div>
            <div className="text-lg" style={{ color: OTHER }}>{f2(tb)}</div>
            <div className="text-muted-foreground/70">AA shows {f2(b.aa)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">gap A minus B</div>
            <div className="text-lg">{sgn(gap)}</div>
            <div className="text-muted-foreground/70">{nudge !== 0 ? `was ${sgn(gap0)}` : "index points"}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">private / public evals</div>
            <div className="text-lg">
              {sgn(privD)} <span className="text-muted-foreground">/</span> {sgn(pubD)}
            </div>
            <div className="text-muted-foreground/70">45% vs 55% of the weight</div>
          </div>
        </div>

        {/* Phone: HTML rows, so names and values keep their real type size. */}
        <ul className="space-y-1 font-mono text-[11px] sm:hidden" aria-label={`Per-evaluation contribution difference between ${a.name} and ${b.name}`}>
          {rows.map((r) => {
            const pct = (Math.abs(r.d) / maxAbs) * 50
            const pos = r.d >= 0
            const hot = r.c.key === nudgeKey
            return (
              <li key={r.c.key}>
                <button
                  type="button"
                  onClick={() => {
                    setNudgeKey(r.c.key)
                    setNudge(0)
                  }}
                  aria-pressed={hot}
                  className={`w-full rounded-md px-1.5 py-1 text-left ${hot ? "bg-muted/60" : ""}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-foreground">
                      {`${r.c.name}${r.c.priv ? " *" : ""}`}{" "}
                      <span className="text-muted-foreground">{`${r.c.w}%`}</span>
                    </span>
                    <span className="shrink-0 text-foreground">{sgn(r.d)}</span>
                  </span>
                  <span className="relative mt-1 block h-2.5">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <span
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        left: pos ? "50%" : `${50 - pct}%`,
                        width: `max(1px, ${pct}%)`,
                        background: pos ? META : OTHER,
                        opacity: 0.85,
                      }}
                    />
                  </span>
                </button>
              </li>
            )
          })}
          <li className="flex justify-between gap-2 px-1.5 pt-1 text-[10px]">
            <span style={{ color: OTHER }}>{`← ${b.name} ahead`}</span>
            <span className="text-right" style={{ color: META }}>{`${a.name} ahead →`}</span>
          </li>
        </ul>

        <svg viewBox={`0 0 ${W} ${H}`} className="hidden w-full sm:block" role="img" aria-label={`Per-evaluation contribution difference between ${a.name} and ${b.name}. ${rows.map((r) => `${r.c.name} ${sgn(r.d)}`).join(", ")}. Total gap ${sgn(gap)} index points.`}>
          <line x1={MID} y1={4} x2={MID} y2={H - 22} stroke="var(--border)" strokeWidth={1} />
          <text x={MID - 8} y={H - 6} textAnchor="end" fontSize={10} className="font-mono" fill={OTHER}>
            {`← ${b.name} ahead`}
          </text>
          <text x={MID + 8} y={H - 6} textAnchor="start" fontSize={10} className="font-mono" fill={META}>
            {`${a.name} ahead →`}
          </text>
          {rows.map((r, i) => {
            const y = 6 + i * ROW
            const len = (Math.abs(r.d) / maxAbs) * HALF
            const pos = r.d >= 0
            const hot = r.c.key === nudgeKey
            return (
              <g key={r.c.key} onClick={() => { setNudgeKey(r.c.key); setNudge(0) }} style={{ cursor: "pointer" }}>
                <rect x={0} y={y - 2} width={W} height={ROW - 2} fill={hot ? "var(--muted)" : "transparent"} opacity={0.5} />
                <text x={4} y={y + 14} fontSize={11} className="fill-foreground font-mono">
                  {`${r.c.name}${r.c.priv ? " *" : ""}`}
                </text>
                <text x={LABEL - 8} y={y + 14} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
                  {`${r.c.w}%`}
                </text>
                <rect x={pos ? MID : MID - len} y={y + 4} width={Math.max(1, len)} height={ROW - 12} rx={2} fill={pos ? META : OTHER} opacity={0.85} />
                <text x={W - 4} y={y + 14} fontSize={11} textAnchor="end" className="fill-foreground font-mono">
                  {sgn(r.d)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 rounded-lg border px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <span>
              Nudge <span style={{ color: META }}>{a.name}</span> on{" "}
              <select
                value={nudgeKey}
                onChange={(e) => {
                  setNudgeKey(e.target.value as Key)
                  setNudge(0)
                }}
                className="rounded-md border bg-background px-1.5 py-0.5"
              >
                {COMPS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
            <span className="text-muted-foreground">
              {`${f2(a.s[nudgeKey])} → ${f2(aS[nudgeKey])} ${nc.unit}`}
            </span>
          </div>
          <Range
            min={-nc.span}
            max={nc.span}
            step={nc.unit === "Elo" ? 5 : 0.5}
            value={nudge}
            onChange={(e) => setNudge(Number(e.target.value))}
            accent={META}
            aria-label={`Change ${a.name}'s ${nc.name} score`}
            className="w-full"
          />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {nc.note}. Gap now {sgn(gap)} ({nudge === 0 ? "unchanged" : `${sgn(gap - gap0)} from the nudge`}).
          </p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each bar is how many index points one evaluation hands to one model over the other, after weighting. Evaluations marked * use a
          private test set. Click a row or pick it from the list, then drag the slider to see how far one benchmark has to move to close or
          flip the gap. The rebuild matches AA&apos;s figure exactly for both Muse models; for older models it can be off by up to 0.17,
          because AA freezes an Elo when a model is added and the page carries today&apos;s.
        </p>
      </div>
    </figure>
  )
}
