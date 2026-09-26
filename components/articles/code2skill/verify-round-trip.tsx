"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What "verified" means in Code2Skill, one model call at a time.
//
// Every visibility cell is from the paper's stage-interface table (Appendix C.2)
// and the SYSTEM/USER templates beneath it; the decision rules are the
// post-processing sentences under each template. Thresholds marked "reference
// config" are from config.example.json in ant-intl/Code2Skill at 7f384a5 — the
// paper says only "the configured selection gate" and "a per-repository cap".
//
// The human-annotation rates are Table 4. The paper does not give its sample
// sizes; every rate in the table is a multiple of 4%.

type Vis = "seen" | "hidden" | "absent"

const INPUTS = [
  { k: "src", label: "source body" },
  { k: "path", label: "repository and file path" },
  { k: "iface", label: "symbol and interface" },
  { k: "skill", label: "full skill JSON" },
  { k: "summary", label: "skill summary" },
  { k: "gen", label: "regenerated code" },
  { k: "reason", label: "the judge's reason" },
  { k: "tests", label: "tests, traces, type-checker" },
] as const

type InputKey = (typeof INPUTS)[number]["k"]

interface Stage {
  k: string
  name: string
  role: string
  vis: Record<InputKey, Vis>
  rule: string
  gap: string
}

const STAGES: Stage[] = [
  {
    k: "tag",
    name: "Tag",
    role: "LLM scores a parsed unit on six rubric axes",
    vis: { src: "seen", path: "seen", iface: "seen", skill: "absent", summary: "absent", gen: "absent", reason: "absent", tests: "hidden" },
    rule: "Keep if keep_for_extraction is true and the mean of six scores clears the gate, then take the top units per repository. Reference config: mean at least 0.5, cap 400.",
    gap: "Test files are excluded before this stage, so the one artefact that could execute the behaviour is removed first.",
  },
  {
    k: "extract",
    name: "Extract",
    role: "LLM writes the typed skill record",
    vis: { src: "seen", path: "seen", iface: "seen", skill: "absent", summary: "absent", gen: "absent", reason: "absent", tests: "hidden" },
    rule: "Drop if worth_extracting is false or skill_value_score is below 0.45. Summary under 80 words, at most 6 items per array, no source code quoted.",
    gap: "The paper never names the model. The five construction stages share one model configuration, unspecified.",
  },
  {
    k: "regen",
    name: "Regenerate",
    role: "LLM writes code from the record alone",
    vis: { src: "hidden", path: "hidden", iface: "seen", skill: "seen", summary: "seen", gen: "absent", reason: "absent", tests: "hidden" },
    rule: "No decision. Python output must parse; for other languages the check is that the output is non-empty. Either way it is stored as metadata only.",
    gap: "This is the source-body-blind step, and the only step where the source is hidden. Nothing here is executed.",
  },
  {
    k: "judge",
    name: "Judge",
    role: "LLM compares original and regenerated code",
    vis: { src: "seen", path: "hidden", iface: "seen", skill: "hidden", summary: "seen", gen: "seen", reason: "absent", tests: "hidden" },
    rule: "Direct accept exactly when equivalent is true. The confidence and risk_level fields impose no threshold.",
    gap: "Equivalence is a model's reading of two code units. Human annotators judged 84% of direct accepts to reconstruct correctly.",
  },
  {
    k: "adj",
    name: "Adjudicate",
    role: "LLM decides whether the skill survives a failed reconstruction",
    vis: { src: "seen", path: "hidden", iface: "seen", skill: "seen", summary: "seen", gen: "seen", reason: "seen", tests: "hidden" },
    rule: "Accept exactly when keep is true. The failed regenerated code is discarded; the record keeps accepted_stage = adjudication.",
    gap: "Every record this stage accepts has, by construction, a reconstruction the judge rejected. Annotators rated 0% of them correct and 88% of their descriptions accurate.",
  },
]

const OUTCOMES = [
  { k: "direct", label: "Direct accept", acc: 96, rec: 84 as number | null, ret: 76 },
  { k: "adj", label: "Adjudicated accept", acc: 88, rec: 0 as number | null, ret: 84 },
  { k: "rej", label: "Rejected", acc: 32, rec: 0 as number | null, ret: 28 },
  { k: "value", label: "Value-filtered", acc: 88, rec: null as number | null, ret: 0 },
]

const VIS_STYLE: Record<Vis, { label: string; cls: string }> = {
  seen: { label: "sees", cls: "border-emerald-600/40 bg-emerald-500/10 text-foreground" },
  hidden: { label: "hidden", cls: "border-rose-600/40 bg-rose-500/10 text-muted-foreground line-through decoration-rose-500/60" },
  absent: { label: "does not exist yet", cls: "border-dashed text-muted-foreground/60" },
}

export function VerifyRoundTrip() {
  const [sel, setSel] = useState("regen")
  const s = STAGES.find((x) => x.k === sel) ?? STAGES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          five model calls, one of them blind, none of them executes anything
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">paper App. C.2, Table 4</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-5 gap-1">
          {STAGES.map((x, i) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={x.k === sel}
              className={cn(
                "cursor-pointer rounded-lg border px-1.5 py-1.5 text-left transition-colors sm:px-2.5",
                x.k === sel ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/20",
              )}
            >
              <div className="font-mono text-[9px] text-muted-foreground">{i + 1}</div>
              <div className="truncate font-mono text-[10px] text-foreground sm:text-[11px]">{x.name}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 font-mono text-[10px] text-muted-foreground">{s.role}</div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {INPUTS.map((inp) => {
            const v = s.vis[inp.k]
            return (
              <li
                key={inp.k}
                className={cn("flex items-center justify-between gap-2 rounded-md border px-2 py-1", VIS_STYLE[v].cls)}
              >
                <span className="font-mono text-[10px]">{inp.label}</span>
                <span className="font-mono text-[9px] no-underline">{VIS_STYLE[v].label}</span>
              </li>
            )
          })}
        </ul>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted-foreground">decision rule</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.rule}</p>
          <p className="mt-2 border-l-2 border-foreground/20 pl-3 text-[13px] leading-6 text-foreground/80">{s.gap}</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] font-mono text-[10px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 text-left font-normal">human check, by outcome</th>
                <th className="px-1 py-1 text-right font-normal">accurate</th>
                <th className="px-1 py-1 text-right font-normal">rebuilds</th>
                <th className="py-1 pl-1 text-right font-normal">worth keeping</th>
              </tr>
            </thead>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o.k} className="border-t">
                  <td className="py-1 pr-2 text-foreground">{o.label}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{o.acc}%</td>
                  <td className="px-1 py-1 text-right tabular-nums">{o.rec == null ? "n/a" : `${o.rec}%`}</td>
                  <td className="py-1 pl-1 text-right tabular-nums">{o.ret}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Step through to stage three and the design is clear: the record has to carry enough to rebuild the
          function without seeing it, which is a real test of completeness. Stage five is the escape hatch. A
          record whose rebuild failed can still be kept if a model decides the fault was the rebuild&rsquo;s,
          and the annotators agree often enough (84% worth keeping) that the hatch is not obviously wrong. But
          nothing in the chain runs code, so &ldquo;verified&rdquo; means that two model calls agreed about
          a third.
        </p>
      </div>
    </figure>
  )
}
