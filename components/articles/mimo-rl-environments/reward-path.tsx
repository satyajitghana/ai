"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One rollout through each of the five graders in XiaomiMiMo/MiMo-V2.6-RL-oss,
// and then through GRPO. Every rule below is transcribed from the released code,
// read on 2026-09-26; nothing here runs a model or a grader.
//
//   code    mimoagent  environments/datasets/opensource_code.py  (reset, git apply, exit code)
//   cyber   mimoagent  environments/datasets/arvo.py + resources/server_arvo.py
//   general dataset    general/envs/s3k_0000_accounting_audit_tax_en_t1_rl_008/
//                      verify.py (_grade_sc) + verifier_meta.json — the six items
//                      and their weights are that environment's own
//   webdev  verl fork  recipes/design/grader_service/.../group_pick.py (reward_one)
//   music   verl fork  recipes/design/music/scorer/pipeline.py + score.py
//
// GRPO: the code, cyber and general arms set norm_adv_by_std_in_grpo=false, so
// the advantage is r - mean(r). The web-dev and music configs leave verl's
// default, which also divides by the group's standard deviation (torch.std,
// unbiased, plus 1e-6). The seven sibling rewards are illustrative values that
// each grader can actually return; click one to change it.

type Domain = "code" | "cyber" | "general" | "webdev" | "music"
type CodeOutcome = "pass" | "fail" | "noapply"

type State = {
  domain: Domain
  code: CodeOutcome
  cyber: { crash: boolean; func: boolean; type: boolean }
  general: { items: boolean[]; judge: boolean }
  webdev: { votes: number; query: number; runtime: boolean }
  music: { gates: boolean[]; band: number; hist: number }
  siblings: Record<Domain, number[]>
}

const DOMAINS: { k: Domain; label: string; rows: string }[] = [
  { k: "code", label: "Code", rows: "2,698" },
  { k: "cyber", label: "Cyber", rows: "1,000" },
  { k: "general", label: "General", rows: "989" },
  { k: "webdev", label: "Web dev", rows: "2,093" },
  { k: "music", label: "Music", rows: "1,000" },
]

const ABOUT: Record<Domain, { gets: string; acts: string; graded: string }> = {
  code: {
    gets: "A GitHub-style issue, median 1,603 characters, and a repository in the container.",
    acts: "Its own image per task: 2,698 of them, median 3.1 GB. No test is on disk while the agent works.",
    graded:
      "Reset every path the test patch touches, git apply the hidden tests, run one command with a 1,800 s limit. Exit 0 is 1.0; anything else is 0.0.",
  },
  cyber: {
    gets: "One line: sanitizer, bug type, function and file of a known OSS-Fuzz crash.",
    acts: "Its own image per vulnerability, with the source and the instrumented binary. The agent submits a proof-of-concept input to a grading server that runs as root.",
    graded:
      "The last submission only. 1.0 if the binary crashes, the topmost project frame is the named function, and the sanitizer and bug type match. A crash anywhere else is 0.0.",
  },
  general: {
    gets: "A business brief over a workspace of documents, spreadsheets and slides. 504 environments are in English, 421 in Chinese.",
    acts: "Two containers: the agent's, holding the workspace, and a sidecar serving 3 to 18 mock enterprise systems as MCP servers over SQLite.",
    graded:
      "A rubric of pass/fail items. An LLM judge reads the final answer for most; Python checks read the databases for the rest. Score = Σ w·s / Σ w.",
  },
  webdev: {
    gets: "A website brief, median 825 characters.",
    acts: "One image shared by all 2,093 tasks. The agent writes a static site; the pod screenshots it.",
    graded:
      "A grading service shows all 8 siblings' screenshots to a vision model, 8 times in a Williams order, and asks which are clearly better and clearly worse. Then it subtracts for missed requirements.",
  },
  music: {
    gets: "A brief naming key, tempo, meter, length and instruments; the answer is ABC notation.",
    acts: "No environment. One turn of text.",
    graded:
      "abc2midi renders the score, four gates reject broken ones, and the rest is scored for resemblance to human music on 18 features. Nothing reads the brief.",
  },
}

// verifier_meta.json of s3k_0000_accounting_audit_tax_en_t1_rl_008. The sixth
// item carries no weight, and _grade_sc defaults a missing weight to 1.0.
const RUBRIC: { id: string; w: number; how: "judge" | "rule"; what: string }[] = [
  { id: "current_recommended_structure", w: 0.2, how: "judge", what: "names the current installment deal, excludes superseded ones" },
  { id: "documentary_tax_components", w: 0.2, how: "judge", what: "county $9,141.00 + city $37,395.00 = $46,536.00" },
  { id: "protection_statuses", w: 0.25, how: "judge", what: "sorts the closing protections into approved and unresolved" },
  { id: "controlled_payment_split_and_fallback", w: 0.2, how: "judge", what: "the approved payment split and the all-cash fallback" },
  { id: "readiness_conclusion", w: 0.15, how: "judge", what: "not ready to close unconditionally, and why" },
  { id: "source_data_present", w: 1, how: "rule", what: "the databases still hold the anchor records (no weight set)" },
]

const GATES = [
  "abc2midi printed an Error line",
  "10 or more bar-length warnings",
  "a blank line inside the score",
  "a MIDI channel changes instrument",
]

// Rewards each grader can return, for the illustrative siblings.
const CYCLE: Record<Domain, number[]> = {
  code: [0, 1],
  cyber: [0, 1],
  general: [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  webdev: [0, 0.0667, 0.5833, 0.6, 0.6667, 0.75, 0.8333, 1],
  music: [0, 0.55, 0.62, 0.68, 0.71, 0.74, 0.8],
}

const INITIAL: State = {
  domain: "general",
  code: "pass",
  cyber: { crash: true, func: false, type: true },
  general: { items: [false, false, false, false, false, true], judge: true },
  webdev: { votes: 3, query: 15, runtime: true },
  music: { gates: [false, false, false, false], band: 70, hist: 60 },
  siblings: {
    code: [0, 1, 0, 0, 1, 0, 0],
    cyber: [0, 0, 0, 1, 0, 0, 0],
    general: [0.5, 0.7, 0.9, 0.5, 0.6, 1, 0.8],
    webdev: [0.6667, 0.75, 0.5833, 0.6, 0.8333, 0, 0.6667],
    music: [0.62, 0, 0.71, 0.55, 0.68, 0.74, 0],
  },
}

const ACC = "oklch(0.62 0.14 250)"
const POS = "oklch(0.64 0.13 150)"
const NEG = "oklch(0.6 0.19 27)"

const QUERY_DEDUCT: [number, number][] = [
  [0.9, 0],
  [0.6, 0.2],
  [0.4, 0.4],
  [0.2, 0.8],
]

function webdevParts(v: State["webdev"]) {
  const net = Math.abs(v.votes) <= 1 ? 0 : v.votes
  const pick = net / 8
  const q = v.query / 20
  let deduct: number | null = null
  for (const [lo, d] of QUERY_DEDUCT) {
    if (q >= lo - 1e-9) {
      deduct = d
      break
    }
  }
  let reward: number
  let why: string
  if (!v.runtime) {
    reward = 0
    why = "runtime gate failed: floor, 0.0"
  } else if (deduct === null) {
    reward = 0
    why = "query score below 0.2: floor, 0.0"
  } else {
    reward = Math.round(((pick - deduct + 2) / 3) * 10000) / 10000
    why = `(${fmtSigned(pick, 3)} − ${deduct.toFixed(1)} + 2) ÷ 3`
  }
  return { net, pick, q, deduct, reward, why }
}

function rewardOf(s: State): { r: number | null; why: string } {
  switch (s.domain) {
    case "code":
      if (s.code === "pass") return { r: 1, why: "test command exited 0" }
      if (s.code === "fail") return { r: 0, why: "test command exited non-zero" }
      return { r: null, why: "git apply failed: testbed corrupted, rollout masked" }
    case "cyber": {
      const { crash, func, type } = s.cyber
      if (!crash) return { r: 0, why: "no crash" }
      if (func && type) return { r: 1, why: "crash in the named function, right bug type" }
      return { r: 0, why: func ? "right function, wrong sanitizer or bug type" : "crash in the wrong function" }
    }
    case "general": {
      if (!s.general.judge) return { r: null, why: "judge unreachable: no reward written, rollout masked" }
      let num = 0
      let den = 0
      RUBRIC.forEach((it, i) => {
        den += it.w
        if (s.general.items[i]) num += it.w
      })
      const r = Math.round((num / den) * 10000) / 10000
      return { r, why: `${num.toFixed(2)} ÷ ${den.toFixed(2)}` }
    }
    case "webdev": {
      const p = webdevParts(s.webdev)
      return { r: p.reward, why: p.why }
    }
    case "music": {
      if (s.music.gates.some(Boolean)) return { r: 0, why: "rejected by a gate" }
      const total = 0.85 * s.music.band + 0.15 * s.music.hist
      const r = Math.round(total * 10) / 1000
      return { r, why: `(0.85 × ${s.music.band} + 0.15 × ${s.music.hist}) ÷ 100` }
    }
  }
}

// Half a unit in the last printed place, so a value that rounds to zero prints
// as 0 rather than as −0.00. A table, not 10 ** -d: no pow on a DOM path.
const HALF_ULP = [0.5, 0.05, 0.005, 0.0005]

function fmtSigned(x: number, d = 2) {
  const v = Math.abs(x) < HALF_ULP[d] ? 0 : x
  if (v === 0) return (0).toFixed(d)
  return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(d)
}

function advantages(rs: (number | null)[], byStd: boolean) {
  const valid = rs.filter((r): r is number => r !== null)
  const n = valid.length
  const mean = n ? valid.reduce((a, b) => a + b, 0) / n : 0
  let std = 0
  if (byStd && n > 1) {
    const ss = valid.reduce((a, b) => a + (b - mean) * (b - mean), 0)
    std = Math.sqrt(ss / (n - 1))
  }
  const flat = n > 0 && valid.every((r) => Math.abs(r - valid[0]) < 1e-9)
  const adv = rs.map((r) => (r === null ? null : byStd ? (r - mean) / (std + 1e-6) : r - mean))
  return { mean, std, flat, adv }
}

const pill = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

type Setter = (f: (s: State) => State) => void

function CodeControls({ s, set }: { s: State; set: Setter }) {
  const opts: [CodeOutcome, string][] = [
    ["pass", "hidden tests pass (exit 0)"],
    ["fail", "hidden tests fail"],
    ["noapply", "test patch will not apply"],
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={s.code === k} className={pill(s.code === k)} onClick={() => set((p) => ({ ...p, code: k }))}>
          {label}
        </button>
      ))}
    </div>
  )
}

function CyberControls({ s, set }: { s: State; set: Setter }) {
  const rows: ["crash" | "func" | "type", string][] = [
    ["crash", "the binary crashed"],
    ["func", "topmost project frame = the named function"],
    ["type", "sanitizer and bug type match the summary line"],
  ]
  return (
    <div className="space-y-1.5">
      {rows.map(([k, label]) => {
        const disabled = k !== "crash" && !s.cyber.crash
        return (
          <label key={k} className={cn("flex items-center gap-2 text-xs", disabled ? "text-muted-foreground/60" : "")}>
            <input
              type="checkbox"
              checked={s.cyber[k]}
              disabled={disabled}
              onChange={(e) => set((p) => ({ ...p, cyber: { ...p.cyber, [k]: e.target.checked } }))}
            />
            <span>{label}</span>
          </label>
        )
      })}
    </div>
  )
}

function GeneralControls({ s, set }: { s: State; set: Setter }) {
  return (
    <div className="space-y-1.5">
      {RUBRIC.map((it, i) => (
        <label key={it.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={s.general.items[i]}
            onChange={(e) =>
              set((p) => {
                const items = p.general.items.slice()
                items[i] = e.target.checked
                return { ...p, general: { ...p.general, items } }
              })
            }
          />
          <span>
            <span className="font-mono text-[10px] text-muted-foreground">{it.how === "judge" ? "judge · " : "rule · "}</span>
            {it.what}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">w {it.w.toFixed(2)}</span>
        </label>
      ))}
      <label className="mt-2 flex items-center gap-2 border-t pt-2 text-xs">
        <input
          type="checkbox"
          checked={s.general.judge}
          onChange={(e) => set((p) => ({ ...p, general: { ...p.general, judge: e.target.checked } }))}
        />
        <span>the judge endpoint answered</span>
      </label>
    </div>
  )
}

function WebdevControls({ s, set }: { s: State; set: Setter }) {
  const p = webdevParts(s.webdev)
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="font-mono text-[11px] text-muted-foreground">
          net votes over 8 rounds (good +1, bad −1):{" "}
          <span className="tabular-nums text-foreground">{fmtSigned(s.webdev.votes, 0)}</span>
          {p.net === 0 && s.webdev.votes !== 0 ? " · inside the ±1 dead zone, counted as 0" : ""}
        </span>
        <Range
          min={-8}
          max={8}
          step={1}
          value={s.webdev.votes}
          accent={ACC}
          aria-label="net pick votes"
          className="mt-2 w-full"
          onChange={(e) => {
            const v = Number(e.target.value)
            set((q) => ({ ...q, webdev: { ...q.webdev, votes: v } }))
          }}
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] text-muted-foreground">
          query-fit score: <span className="tabular-nums text-foreground">{p.q.toFixed(2)}</span>
          {p.deduct === null ? " · floor" : ` · deduct ${p.deduct.toFixed(1)}`}
        </span>
        <Range
          min={0}
          max={20}
          step={1}
          value={s.webdev.query}
          accent={ACC}
          aria-label="query-fit score"
          className="mt-2 w-full"
          onChange={(e) => {
            const v = Number(e.target.value)
            set((q) => ({ ...q, webdev: { ...q.webdev, query: v } }))
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={s.webdev.runtime}
          onChange={(e) => set((q) => ({ ...q, webdev: { ...q.webdev, runtime: e.target.checked } }))}
        />
        <span>page loads without a script error</span>
      </label>
    </div>
  )
}

function MusicControls({ s, set }: { s: State; set: Setter }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {GATES.map((g, i) => (
          <label key={g} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={s.music.gates[i]}
              onChange={(e) =>
                set((p) => {
                  const gates = p.music.gates.slice()
                  gates[i] = e.target.checked
                  return { ...p, music: { ...p.music, gates } }
                })
              }
            />
            <span>{g}</span>
          </label>
        ))}
      </div>
      {(
        [
          ["band", "feature bands: 18 features inside the human percentile bands"],
          ["hist", "histograms: pitch, interval and duration agreement"],
        ] as const
      ).map(([k, label]) => (
        <label key={k} className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            {label}: <span className="tabular-nums text-foreground">{s.music[k]}</span> / 100
          </span>
          <Range
            min={0}
            max={100}
            step={5}
            value={s.music[k]}
            accent={ACC}
            aria-label={label}
            className="mt-2 w-full"
            onChange={(e) => {
              const v = Number(e.target.value)
              set((p) => ({ ...p, music: { ...p.music, [k]: v } }))
            }}
          />
        </label>
      ))}
      <p className="my-0 font-mono text-[10px] text-muted-foreground">
        not read by the scorer: the brief&rsquo;s key, tempo, meter, bar count and voices
      </p>
    </div>
  )
}

function GroupCell({
  label,
  r,
  adv,
  scale,
  mine,
  onClick,
}: {
  label: string
  r: number | null
  adv: number | null
  scale: number
  mine: boolean
  onClick?: () => void
}) {
  const h = adv === null ? 0 : Math.min(1, Math.abs(adv) / scale) * 36
  const up = adv !== null && adv > 0
  const body = (
    <>
      <span className="font-mono text-[9px] text-muted-foreground">{label}</span>
      <span className="relative block h-[76px] w-full">
        <span className="absolute left-0 right-0 top-[38px] border-t border-border" />
        {adv !== null ? (
          <span
            className="absolute left-1/2 w-3 -translate-x-1/2 rounded-sm"
            style={{
              height: `${h.toFixed(1)}px`,
              top: up ? `${(38 - h).toFixed(1)}px` : "38px",
              background: up ? POS : NEG,
            }}
          />
        ) : (
          <span className="absolute left-0 right-0 top-[30px] text-center font-mono text-[9px] text-muted-foreground">masked</span>
        )}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-foreground">{r === null ? "—" : r.toFixed(2)}</span>
      <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{adv === null ? "no grad" : fmtSigned(adv)}</span>
    </>
  )
  const cls = cn("flex flex-col items-center gap-0.5 rounded-md border px-0.5 py-1", mine ? "border-foreground/40 bg-muted/40" : "border-border")
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={cn(cls, "cursor-pointer hover:bg-muted/30")} aria-label={`sibling ${label}, reward ${r === null ? "masked" : r.toFixed(2)}; click to change`}>
      {body}
    </button>
  )
}

export function RewardPath() {
  const [s, setS] = useState<State>(INITIAL)
  const set: Setter = (f) => setS(f)
  const d = s.domain
  const about = ABOUT[d]
  const mine = rewardOf(s)
  const sib = s.siblings[d]
  const byStd = d === "webdev" || d === "music"
  const rs: (number | null)[] = [mine.r, ...sib]
  const g = advantages(rs, byStd)
  const scale = byStd ? 2.5 : 1

  const cycle = (i: number) =>
    set((p) => {
      const cur = p.siblings[p.domain][i]
      const opts = CYCLE[p.domain]
      let k = opts.findIndex((v) => Math.abs(v - cur) < 1e-9)
      k = (k + 1) % opts.length
      const next = p.siblings[p.domain].slice()
      next[i] = opts[k]
      return { ...p, siblings: { ...p.siblings, [p.domain]: next } }
    })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">One rollout, five graders, one GRPO group</span>
        <span className="font-mono text-[10px] text-muted-foreground">rules read from the released code · nothing here runs</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">
        {DOMAINS.map((x) => (
          <button key={x.k} type="button" aria-pressed={d === x.k} className={pill(d === x.k)} onClick={() => set((p) => ({ ...p, domain: x.k }))}>
            {x.label} · {x.rows}
          </button>
        ))}
      </div>

      <div className="grid gap-px border-b bg-border sm:grid-cols-3">
        {(
          [
            ["the policy gets", about.gets],
            ["it acts in", about.acts],
            ["graded by", about.graded],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-background px-4 py-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
            <p className="my-0 text-xs leading-relaxed">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-[1fr_11rem]">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">this rollout</div>
          {d === "code" ? <CodeControls s={s} set={set} /> : null}
          {d === "cyber" ? <CyberControls s={s} set={set} /> : null}
          {d === "general" ? <GeneralControls s={s} set={set} /> : null}
          {d === "webdev" ? <WebdevControls s={s} set={set} /> : null}
          {d === "music" ? <MusicControls s={s} set={set} /> : null}
        </div>
        <div className="flex flex-col justify-center rounded-lg border px-3 py-3 text-center">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">reward</div>
          <div className="font-mono text-3xl tabular-nums" style={{ color: mine.r === null ? undefined : ACC }}>
            {mine.r === null ? "masked" : mine.r.toFixed(mine.r === 0 || mine.r === 1 ? 1 : 3)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{mine.why}</div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            its group of 8 · advantage = {byStd ? "(r − mean) ÷ std" : "r − mean"}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            mean {g.mean.toFixed(3)}
            {byStd ? ` · std ${g.std.toFixed(3)}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1">
          <GroupCell label="you" r={mine.r} adv={g.adv[0]} scale={scale} mine />
          {sib.map((r, i) => (
            <GroupCell key={i} label={`#${i + 2}`} r={r} adv={g.adv[i + 1]} scale={scale} mine={false} onClick={() => cycle(i)} />
          ))}
        </div>
        <p className="my-0 mt-3 text-xs text-muted-foreground">
          {g.flat
            ? "Every sibling earned the same reward, so every advantage is 0 and the group teaches nothing. The code and cyber arms drop such groups before the update (filter_groups)."
            : mine.r === null
              ? "A masked rollout is left out of the mean and contributes no gradient. That is the point of masking: a broken testbed or a missing judge should not read as a wrong answer."
              : d === "general" && mine.r >= 0.5 && !s.general.items.slice(0, 5).some(Boolean)
                ? "Every judged item failed and this rollout still scores 0.5, because the untouched databases carry weight 1.0. Inside a group where every sibling also left them alone, that half cancels in r − mean; it only bites a sibling that damaged them."
                : "Only the difference from the group mean moves the policy. The seven siblings are illustrative values these graders can return; click one to change it."}
        </p>
      </div>
    </figure>
  )
}
