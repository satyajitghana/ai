"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Code2Skill's funnel with every count I could find, and the counts nobody
// published left as visible gaps.
//
// Sources, per row:
//   reported  the paper (arXiv 2609.05571v1) or the dataset's own
//             metadata/statistics.json
//   measured  counted by me from the released parquet files
//             (ant-intl/DeveloperSkills-Code2Skill, release dated 2026-08-14):
//             all 19 edges shards and all 16 cards shards
//   missing   the paper describes the stage but gives no count
//
// Repositories and records are different units, so they get separate scales.
// The record rows can be read on a log axis because the pattern tier is 0.36%
// of the cards and disappears on a linear one. mlog10 comes from lib/dmath:
// these widths are serialised into the DOM during SSR.

type Src = "reported" | "measured" | "missing"

interface Row {
  k: string
  label: string
  n: number | null
  unit: string
  src: Src
  note: string
}

const REPOS: Row[] = [
  {
    k: "pool",
    label: "Source pool",
    n: 19769,
    unit: "repositories",
    src: "reported",
    note: "Every GitHub repository available by 14 April 2026 with more than 500 stars, after fork expansion and deduplication. This is the number in the headline, and it is a count of repositories scanned, not of repositories that produced a skill.",
  },
  {
    k: "contrib",
    label: "Repos in the release",
    n: 7399,
    unit: "repositories, at least",
    src: "measured",
    note: "Distinct owner and repository pairs among the provenance examples on the 750,748 released cards. The examples cover 918,083 of the 945,993 mapped records, so this is a lower bound: at least 37% of the pool.",
  },
  {
    k: "owners",
    label: "Owners in the release",
    n: 6103,
    unit: "GitHub owners",
    src: "measured",
    note: "Distinct values of repo_name in the edges table, which holds the owner (NVIDIA, alibaba), not the repository. No owner has more than 448 records, including alibaba with 31 repositories and 246 records.",
  },
]

const RECORDS: Row[] = [
  {
    k: "units",
    label: "Units parsed, tagged, extracted",
    n: null,
    unit: "not reported",
    src: "missing",
    note: "The paper describes a parser, an LLM tagger with a selection gate and a per-repository cap, and an extractor with a value threshold. It gives no count for any of them, and no split between direct accepts, adjudicated accepts and rejects. The reference code writes all of these to decisions.jsonl; the release does not include one.",
  },
  {
    k: "accepted",
    label: "Accepted records",
    n: 1006822,
    unit: "records",
    src: "reported",
    note: "Records that passed the round trip, directly or after adjudication. The release's statistics check that this equals the mapped records plus the low-value drops below, and it does, to the record.",
  },
  {
    k: "dropped",
    label: "Dropped as low value",
    n: 60829,
    unit: "records",
    src: "reported",
    note: "A deterministic regex filter: 60,552 boilerplate_or_trivial, 270 representation_only, 7 getter_setter_like. The dataset's metadata says these rows ship as a config called dropped. The files are not in the repository.",
  },
  {
    k: "edges",
    label: "Mapped to a purpose card",
    n: 945993,
    unit: "records",
    src: "measured",
    note: "Rows in the edges table, one per surviving record. 642,283 atomic, 303,440 composite, 270 pattern, by the extractor's own label.",
  },
  {
    k: "cards",
    label: "Purpose cards",
    n: 750748,
    unit: "cards",
    src: "measured",
    note: "Records grouped by the key (task_family, intent_action, intent_target), one existing record chosen as representative. No embeddings, no LLM. The largest card, readArguments, has 761 members from 398 owners.",
  },
  {
    k: "review",
    label: "Sent to pattern review",
    n: 14539,
    unit: "cards",
    src: "measured",
    note: "Cards that cleared the deterministic gates for a recurring pattern and were reviewed by a proposer, a sceptical verifier and an adjudicator, all DeepSeek-V4-Flash-0731. This pass is in the dataset, not in the paper.",
  },
  {
    k: "patterns",
    label: "Confirmed patterns",
    n: 3600,
    unit: "cards",
    src: "measured",
    note: "A pattern needs composite instances from at least two repositories, a stable sequence of phases and a parameterisable variation. 3,600 of 750,748 cards qualify. It is the third skill type in the paper's taxonomy.",
  },
]

const SRC_STYLE: Record<Src, { label: string; color: string }> = {
  reported: { label: "reported", color: "oklch(0.62 0.12 250)" },
  measured: { label: "measured", color: "oklch(0.6 0.14 155)" },
  missing: { label: "not reported", color: "oklch(0.66 0.13 60)" },
}

const REC_MAX = 1006822
const LOG_LO = 3

function width(n: number, max: number, log: boolean): number {
  if (!log) return (n / max) * 100
  const hi = mlog10(max) - LOG_LO
  return Math.max(0, ((mlog10(n) - LOG_LO) / hi) * 100)
}

function Bar({
  r,
  max,
  log,
  active,
  onPick,
}: {
  r: Row
  max: number
  log: boolean
  active: boolean
  onPick: () => void
}) {
  const s = SRC_STYLE[r.src]
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "grid w-full cursor-pointer grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors sm:grid-cols-[minmax(0,12rem)_1fr]",
        active ? "bg-muted/45" : "hover:bg-muted/25",
      )}
    >
      <span className="truncate font-mono text-[10px] text-foreground sm:text-[11px]">{r.label}</span>
      <span className="flex items-center gap-2">
        <span className="relative h-4 flex-1 rounded-sm bg-muted/40">
          {r.n == null ? (
            <span
              className="absolute inset-0 rounded-sm border border-dashed"
              style={{ borderColor: s.color }}
            />
          ) : (
            <span
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{
                width: `${Math.max(0.6, width(r.n, max, log)).toFixed(2)}%`,
                background: s.color,
                opacity: 0.85,
              }}
            />
          )}
        </span>
        <span className="w-[4.6rem] shrink-0 text-right font-mono text-[10px] tabular-nums sm:text-[11px]">
          {r.n == null ? "?" : r.n.toLocaleString("en-US")}
        </span>
      </span>
    </button>
  )
}

export function SkillFunnel() {
  const [sel, setSel] = useState("contrib")
  const [log, setLog] = useState(false)
  const all = [...REPOS, ...RECORDS]
  const s = all.find((x) => x.k === sel) ?? all[0]
  const st = SRC_STYLE[s.src]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          19,769 repositories &rarr; 1,006,822 records &rarr; 750,748 cards
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">paper + release parquet</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(SRC_STYLE) as Src[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SRC_STYLE[k].color }} />
              {SRC_STYLE[k].label}
            </span>
          ))}
        </div>

        <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">repositories</div>
        <div className="mt-1 space-y-0.5">
          {REPOS.map((r) => (
            <Bar key={r.k} r={r} max={19769} log={false} active={r.k === sel} onPick={() => setSel(r.k)} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">records and cards</span>
          <div className="flex gap-1">
            {[
              { v: false, l: "linear" },
              { v: true, l: "log" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setLog(o.v)}
                aria-pressed={log === o.v}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                  log === o.v
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 space-y-0.5">
          {RECORDS.map((r) => (
            <Bar key={r.k} r={r} max={REC_MAX} log={log} active={r.k === sel} onPick={() => setSel(r.k)} />
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: st.color }}>
            {s.label} &middot; {s.n == null ? "no count" : `${s.n.toLocaleString("en-US")} ${s.unit}`} &middot;{" "}
            {st.label}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.note}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The dashed row is the finding. The paper names five model stages between the source pool and the bank
          and reports the survivors of none of them, so the question &ldquo;what fraction of candidates
          survive&rdquo; has no answer in the paper. What the release does let you count is the other end:
          its provenance names 7,399 of the 19,769 pool repositories, and the third skill type, recurring
          patterns, is under half a percent of the cards.
        </p>
      </div>
    </figure>
  )
}
