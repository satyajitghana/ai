"use client"

// Twelve candidate proofs of one frozen statement, each run through the
// harness's own `verify_text` (program-files/lean/src/verify.rs at commit
// 80247afe) against a real Lean 4.33.1 with only Lean core, no Mathlib. The
// verdicts and times are what my probe printed on a shared 4-core cloud VM, CPU
// only (first of two runs). Nothing is computed in the browser.
//
// Dual-native: the prose section "The verifier, attacked" lists the same twelve
// candidates, the stage that stopped each, and the times.

import { useState } from "react"

const FROZEN = `def f (n : Nat) : Nat := n + n

theorem demo (n : Nat) : f n = 2 * n := by sorry`

const STAGES = [
  { k: "text", title: "Text rules", sub: "no Lean runs" },
  { k: "lean", title: "Lean elaborates", sub: "kernel checks the proof" },
  { k: "axioms", title: "#print axioms", sub: "only the trusted three" },
  { k: "type", title: "pp.all type", sub: "same theorem, character for character" },
  { k: "ok", title: "Accepted", sub: "score 1.0" },
]

type Cand = {
  id: string
  label: string
  code: string
  stage: number
  verdict: string
  ms: number | null
  why: string
}

const CANDS: Cand[] = [
  {
    id: "honest",
    label: "honest proof",
    code: "theorem demo (n : Nat) : f n = 2 * n := by unfold f; omega",
    stage: 4,
    verdict: "accepted, axioms propext, Quot.sound",
    ms: 504,
    why: "Passes every stage. omega leans on propext and Quot.sound, both on the trusted list.",
  },
  {
    id: "comment",
    label: "comment says sorry",
    code: "-- no sorry left here\ntheorem demo (n : Nat) : f n = 2 * n := by unfold f; omega",
    stage: 4,
    verdict: "accepted",
    ms: 252,
    why: "The text rules read code with comments and strings blanked, so a comment cannot trip them.",
  },
  {
    id: "classical",
    label: "uses Classical.choice",
    code: "... := by unfold f; exact Classical.byContradiction (fun h => h (by omega))",
    stage: 4,
    verdict: "accepted, axioms propext, Classical.choice, Quot.sound",
    ms: 252,
    why: "Classical logic is allowed: Classical.choice is one of the three trusted axioms.",
  },
  {
    id: "sorry",
    label: "sorry",
    code: "theorem demo (n : Nat) : f n = 2 * n := by sorry",
    stage: 0,
    verdict: "Forbidden(sorry)",
    ms: 0,
    why: "Refused before Lean starts.",
  },
  {
    id: "native",
    label: "native_decide",
    code: "... := by unfold f; native_decide",
    stage: 0,
    verdict: "Forbidden(native_decide)",
    ms: 0,
    why: "native_decide trusts compiled code instead of the kernel, so it is banned outright.",
  },
  {
    id: "axiom",
    label: "user axiom",
    code: "axiom cheat (n : Nat) : f n = 2 * n\ntheorem demo (n : Nat) : f n = 2 * n := cheat n",
    stage: 0,
    verdict: "Forbidden(axiom)",
    ms: 0,
    why: "Declaring an axiom is the oldest cheat. The word axiom is refused in code.",
  },
  {
    id: "sorryax",
    label: "sorryAx by name",
    code: "theorem demo (n : Nat) : f n = 2 * n := sorryAx _ false",
    stage: 0,
    verdict: "Forbidden(sorry)",
    ms: 0,
    why: "The sorry check is a substring test on code, so sorryAx never reaches Lean. #print axioms would have caught it anyway.",
  },
  {
    id: "debug",
    label: "skip the kernel",
    code: "set_option debug.skipKernelTC true in\ntheorem demo ...",
    stage: 0,
    verdict: "Forbidden(set_option debug)",
    ms: 0,
    why: "Every debug.* and pp.* option is banned: one turns off the kernel check, the other would change the type the last stage compares.",
  },
  {
    id: "redefine",
    label: "redefine f",
    code: "def f (n : Nat) : Nat := 2 * n\n\ntheorem demo (n : Nat) : f n = 2 * n := rfl",
    stage: 0,
    verdict: "PreambleMismatch",
    ms: 0,
    why: "The candidate must begin with the frozen preamble. Lean is then fed the frozen preamble itself, not the candidate's copy.",
  },
  {
    id: "weaker",
    label: "weaker statement",
    code: "theorem demo (n : Nat) : f n = n + n := rfl",
    stage: 0,
    verdict: "StatementMismatch",
    ms: 0,
    why: "The frozen theorem ... := line must appear verbatim.",
  },
  {
    id: "wrong",
    label: "wrong proof",
    code: "theorem demo (n : Nat) : f n = 2 * n := rfl",
    stage: 1,
    verdict: "Elaboration (Lean exit 1)",
    ms: 261,
    why: "n + n and 2 * n are not definitionally equal for a variable n, so Lean refuses the file.",
  },
  {
    id: "instance",
    label: "new * instance",
    code: "instance (priority := high) myMul : HMul Nat Nat Nat := ⟨fun _ b => b + b⟩\ntheorem demo (n : Nat) : f n = 2 * n := rfl",
    stage: 3,
    verdict: "TypeMismatch",
    ms: 306,
    why: "The surface text is verbatim and Lean accepts the proof, but 2 * n now means a different multiplication. The fully elaborated type names myMul instead of instMulNat.",
  },
]

export function VerifyGauntlet() {
  const [id, setId] = useState("instance")
  const c = CANDS.find((x) => x.id === id) ?? CANDS[0]

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="font-mono text-xs text-muted-foreground">
        frozen file (the standard every candidate is judged against)
      </div>
      <pre className="mt-1 overflow-x-auto rounded-md border bg-background/60 p-2 font-mono text-[11px] leading-4">
        {FROZEN}
      </pre>

      <div className="mt-3 font-mono text-xs text-muted-foreground">pick a candidate</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {CANDS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === id}
            onClick={() => setId(x.id)}
            className={`rounded-md border px-2 py-1 text-left text-xs ${
              x.stage === 4 ? "border-emerald-600/50" : "border-orange-500/50"
            } ${x.id === id ? "bg-background ring-2 ring-foreground/40" : "opacity-75 hover:opacity-100"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <pre className="mt-3 overflow-x-auto rounded-md border bg-background/60 p-2 font-mono text-[11px] leading-4">
        {c.code}
      </pre>

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-5" aria-label="verify stages">
        {STAGES.map((s, i) => {
          const passed = i < c.stage
          const here = i === c.stage
          const tone = here
            ? c.stage === 4
              ? "border-emerald-600 bg-emerald-600/15"
              : "border-orange-500 bg-orange-500/15"
            : passed
              ? "border-emerald-600/40 bg-emerald-600/5"
              : "opacity-40"
          return (
            <li key={s.k} className={`rounded-md border px-2 py-1.5 text-[11px] leading-4 ${tone}`}>
              <span className="block font-semibold">{s.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{s.sub}</span>
              <span className="mt-1 block font-mono text-[10px]">
                {here ? (c.stage === 4 ? "passed" : "stopped here") : passed ? "passed" : "not reached"}
              </span>
            </li>
          )
        })}
      </ol>

      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-[7rem_1fr] sm:gap-x-3">
        <dt className="font-mono text-muted-foreground">verdict</dt>
        <dd className="font-mono">{c.verdict}</dd>
        <dt className="font-mono text-muted-foreground">wall time</dt>
        <dd>
          {c.ms === 0 ? "0 ms, Lean never started" : `${c.ms} ms, one Lean run (core only, no Mathlib)`}
        </dd>
        <dt className="font-mono text-muted-foreground">why</dt>
        <dd>{c.why}</dd>
      </dl>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Measured: the harness&apos;s own verify_text on Lean 4.33.1, shared 4-core VM, CPU only. With
        Mathlib imported, each Lean run costs seconds more.
      </p>
    </div>
  )
}
