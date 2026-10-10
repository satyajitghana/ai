"use client"

import { useState } from "react"

// Every row is a published number with the conditions it was measured under.
// Sources, all read on 10 October 2026:
//  - OrcaCyber rows: the X launch post (status 2108802238567354864), the model
//    page's machine-readable card (/api/public/models/orca/orcacyber-zero-1.5)
//    and the harness report (Continuum-AI-Corp/OrcaCyber-Harness-CyberGym-
//    Technical-Report @ 4847a00).
//  - CyberGym rows: cybergym.io/assets/data/cybergym.json (level1), the data
//    behind the official leaderboard.
//  - Cybench rows: cybench.github.io/data/leaderboard.csv, plus Mistral's
//    Large 4 launch blog for the one row that is not on that board.
//  - CVE-Bench rows: the CVE-Bench paper (arXiv 2503.17332), Section 4.2.
//  - HumanEval+ rows: evalplus.github.io/results.json.
// Nothing here is re-run.

type Row = {
  who: string
  v: number
  cond: string
  src: string
  claim?: boolean
  // a recount of the claim under a different denominator
  alt?: boolean
}

type Bench = {
  id: string
  name: string
  what: string
  rows: Row[]
  denom?: { label: string; altLabel: string; note: string }
  verdict: string
}

const BENCHES: Bench[] = [
  {
    id: "cybergym",
    name: "CyberGym",
    what: "Level 1: description + vulnerable source in, one PoC out. Pass if it crashes the vulnerable build and not the patched one. % of 1,507.",
    rows: [
      { who: "Lyrie Agent", v: 99.2, cond: "agent · two models · dynamic", src: "CyberGym board" },
      { who: "Creation", v: 98.47, cond: "agent · three models · dynamic", src: "CyberGym board" },
      {
        who: "OrcaCyber harness",
        v: 98.01,
        cond: "agent · DeepSeek-V4-Flash on every task, Zero 1.0 on 656 · dynamic",
        src: "harness report",
        claim: true,
      },
      { who: "RO0T Agent", v: 97.7, cond: "agent · DeepSeek-V4.1-Flash only · dynamic", src: "CyberGym board" },
      { who: "RO0T Agent", v: 94.16, cond: "agent · DeepSeek-V4-Flash only · dynamic", src: "CyberGym board" },
      { who: "XekRung-1.5-27B-Preview", v: 88.92, cond: "model-focused · best on the board", src: "CyberGym board" },
      { who: "Gemini 3.8 Flash Cyber", v: 86.26, cond: "model-focused", src: "CyberGym board" },
      { who: "GPT-5.5-Cyber", v: 85.6, cond: "model-focused", src: "CyberGym board" },
      { who: "Claude Mythos Preview", v: 83.1, cond: "model-focused", src: "CyberGym board" },
      { who: "DeepSeek-V4-Flash", v: 76.7, cond: "model-focused · DeepSeek's own agent", src: "CyberGym board" },
    ],
    verdict:
      "Real, third in the board's data, and inside a cluster of 20 systems above 90% that the leaderboard deliberately shows in random order. It is a two-model system's number: the same base worker reaches 94.16 in someone else's agent.",
  },
  {
    id: "cybench",
    name: "Cybench",
    what: "40 CTF tasks from four 2022-2024 competitions. Unguided: one objective, capture the flag. % of the tasks each run used.",
    denom: {
      label: "as claimed (39 tasks)",
      altLabel: "over all 40",
      note: "The claim is 39/39. One of Cybench's 40 tasks is not counted, and the post does not say which. Counted as a miss, 39/40 is 97.5%.",
    },
    rows: [
      { who: "OrcaCyber Zero 1.5", v: 100, cond: "39 tasks · 'unrestricted' · attempts and caps not stated", src: "launch post", claim: true },
      { who: "OrcaCyber Zero 1.5", v: 97.5, cond: "same run, the 40th task counted as a miss", src: "my recount", claim: true, alt: true },
      { who: "Claude Mythos Preview", v: 100, cond: "35-task subset", src: "Cybench board" },
      { who: "Claude Opus 4.7", v: 96, cond: "35-task subset", src: "Cybench board" },
      { who: "Claude Opus 4.6", v: 93, cond: "37-task subset · mean pass@1", src: "Cybench board" },
      { who: "Mistral Large 4", v: 93, cond: "40 tasks", src: "Mistral launch blog" },
      { who: "Claude Opus 4.5", v: 82, cond: "39-task subset · mean pass@1", src: "Cybench board" },
      { who: "Muse Spark", v: 65.4, cond: "40 tasks", src: "Cybench board" },
      { who: "Claude 3.5 Sonnet", v: 17.5, cond: "40 tasks · the 2024 paper", src: "Cybench board" },
    ],
    verdict:
      "Not unprecedented: Claude Mythos Preview's entry is also 100%, on 35 tasks. The benchmark is near its ceiling, its tasks predate every current model's training cutoff, and the claim omits the settings that make a Cybench number comparable.",
  },
  {
    id: "cvebench",
    name: "CVE-Bench",
    what: "40 critical web-app CVEs, each run zero-day (no hint) or one-day (CVE description given). Pass if a grader sees one of eight attack outcomes.",
    denom: {
      label: "as claimed (24 'evaluable')",
      altLabel: "over all 40",
      note: "Nothing in the CVE-Bench repository marks any task as not evaluable. If the 16 uncounted tasks were failures, 23/40 is 57.5%. That is a bound under an assumption, not a score anyone published.",
    },
    rows: [
      { who: "OrcaCyber Zero 1.5", v: 95.8, cond: "23/24 'evaluable' · variant, attempts, internet not stated", src: "launch post", claim: true },
      { who: "OrcaCyber Zero 1.5", v: 57.5, cond: "23/40, the other 16 counted as misses", src: "my recount", claim: true, alt: true },
      { who: "T-Agent (GPT-4o)", v: 12.5, cond: "one-day · five attempts · 2025 paper", src: "CVE-Bench paper" },
      { who: "T-Agent (GPT-4o)", v: 10, cond: "zero-day · five attempts · 2025 paper", src: "CVE-Bench paper" },
    ],
    verdict:
      "Nothing public to compare with. There is no CVE-Bench leaderboard; the paper's 2025 agents peaked near 13%. The '24 evaluable' denominator is OrcaRouter's own and is not explained.",
  },
  {
    id: "humaneval",
    name: "HumanEval+",
    what: "164 Python problems from HumanEval with EvalPlus's extra tests. pass@1.",
    rows: [
      { who: "OrcaCyber Zero 1.5", v: 93.9, cond: "154 of 164 · harness not stated", src: "launch post", claim: true },
      { who: "o1-preview", v: 89, cond: "greedy pass@1", src: "EvalPlus board" },
      { who: "GPT-4o (Aug 2024)", v: 87.2, cond: "greedy pass@1", src: "EvalPlus board" },
      { who: "Qwen2.5-Coder-32B", v: 87.2, cond: "greedy pass@1", src: "EvalPlus board" },
    ],
    verdict:
      "Plausible for a 2026 model and says little: the EvalPlus board stopped at 2024 models, and these problems have been public since 2021. It is not a security measure.",
  },
]

const ORANGE = "#ea580c"
const GREY = "#94a3b8"

export function ClaimVsLeaderboard() {
  const [id, setId] = useState("cybergym")
  const [alt, setAlt] = useState(false)
  const b = BENCHES.find((x) => x.id === id) ?? BENCHES[0]
  const rows = b.rows.filter((r) => (b.denom ? (alt ? !(r.claim && !r.alt) : !r.alt) : true))
  const sorted = [...rows].sort((x, y) => y.v - x.v)

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Claim vs published results</div>
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
        {BENCHES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              setId(x.id)
              setAlt(false)
            }}
            className={`rounded-md border px-2 py-0.5 ${x.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.name}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{b.what}</p>

      {b.denom ? (
        <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setAlt(false)}
            className={`rounded-md border px-2 py-0.5 ${!alt ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {b.denom.label}
          </button>
          <button
            type="button"
            onClick={() => setAlt(true)}
            className={`rounded-md border px-2 py-0.5 ${alt ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {b.denom.altLabel}
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {sorted.map((r, i) => (
          <div key={`${r.who}-${r.v}-${i}`} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-start gap-2 sm:grid-cols-[13rem_1fr]">
            <div className={`font-mono text-[11px] leading-tight ${r.claim ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {r.who}
              <span className="block text-[9px] font-normal text-muted-foreground">{r.src}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted/40">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(0.5, r.v).toFixed(2)}%`,
                      background: r.claim ? ORANGE : GREY,
                      opacity: r.alt ? 0.6 : 1,
                    }}
                  />
                </div>
                <strong className={`w-[3.5rem] shrink-0 text-right font-mono text-[11px] ${r.claim ? "text-foreground" : "text-muted-foreground"}`}>
                  {String(r.v)}%
                </strong>
              </div>
              <div className="mt-0.5 font-mono text-[10px] leading-tight text-muted-foreground">{r.cond}</div>
            </div>
          </div>
        ))}
      </div>

      {b.denom && alt ? <p className="mt-3 text-xs text-muted-foreground">{b.denom.note}</p> : null}

      <p className="mt-3 rounded-lg border p-2 text-sm">
        <span className="text-muted-foreground">Read against the board:</span> {b.verdict}
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Orange is OrcaRouter&apos;s claim; grey is a published result. Each row keeps its own conditions, because these
        numbers were not measured the same way: a subset is not the full set, an agent built around two models is not a
        model, and five attempts are not one. Nothing re-run.
      </figcaption>
    </figure>
  )
}
