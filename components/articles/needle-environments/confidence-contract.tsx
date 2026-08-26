"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The confidence gate in run_tests(), evaluated the way Python evaluates it.
//
// needle-environments/*.py (byte-identical in all six):
//
//   def run_tests(min_confidence=0.0, verbose=True):
//       """... The default scores raw model output; passing e.g.
//       min_confidence=0.4 applies the production contract (act on a call only
//       at or above the threshold, otherwise treat it as a refusal)."""
//       ...
//       if got and response.get("confidence", 0.0) < min_confidence:
//           got = []
//
//   if __name__ == "__main__":
//       sys.exit(0 if run_tests() else 1)
//
// cactus-needle 2.0.10, needle/__init__.py:
//
//   if weights:
//       warnings.warn("finetuning does not update the confidence head, so
//                      scores are uncalibrated for tuned weights; this agent
//                      reports confidence as None", stacklevel=2)
//   ...
//   if self._weights:
//       response["confidence"] = None
//
// Two consequences, both mechanical:
//
// 1. The shipped entry point runs the default, min_confidence=0.0. Nothing is
//    ever `< 0.0`, so the filter is dead code on every run that decides the
//    exit status. The suite that gates a release deliberately does not apply
//    the contract the product would ship.
//
// 2. dict.get(key, default) returns the default only when the key is ABSENT.
//    needle sets confidence to None, so .get("confidence", 0.0) returns None,
//    and `None < 0.0` raises TypeError. With fine-tuned weights the suite dies
//    on the first case that produces a call — which, in smart_home.py, is case
//    1 of 32, "turn on the kitchen lights".

const OK = "oklch(0.55 0.16 155)"
const DEAD = "oklch(0.62 0.03 250)"
const BOOM = "oklch(0.58 0.19 27)"
const NOTE = "oklch(0.68 0.13 85)"

type Weights = "base" | "tuned"

export function ConfidenceContract() {
  const [w, setW] = useState<Weights>("tuned")
  const [thr, setThr] = useState(0) // hundredths

  const t = thr / 100
  const conf = w === "tuned" ? "None" : "0.71"

  const crashes = w === "tuned"
  const dead = !crashes && t === 0

  const status = crashes ? "TypeError" : dead ? "filter is dead code" : "contract applied"
  const colour = crashes ? BOOM : dead ? DEAD : OK

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          run_tests(min_confidence={t.toFixed(2)}) · {w === "tuned" ? "your fine-tuned" : "the base"}{" "}
          weights
        </span>
        <span className="font-mono text-[10px]" style={{ color: colour }}>
          {status}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["base", "the shipped base model"],
              ["tuned", "weights you fine-tuned"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setW(k)}
              aria-pressed={w === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                w === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-2 w-28 shrink-0 font-mono text-[10px] text-muted-foreground">
            min_confidence
          </span>
          <Range
            min={0}
            max={100}
            step={5}
            value={thr}
            onChange={(e) => setThr(Number(e.target.value))}
            className="min-w-[120px] flex-1"
            aria-label="the min_confidence argument passed to run_tests"
            accent={NOTE}
          />
          <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {t.toFixed(2)}
          </span>
        </div>

        <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
          {`response = agent.complete(case["query"])
got      = response.get("function_calls") or []          # ["control_lights", ...]
`}
          <span style={{ color: crashes ? BOOM : undefined }}>
            {`if got and response.get("confidence", 0.0) < min_confidence:
    got = []`}
          </span>
          {`

# response["confidence"] is `}
          <span style={{ color: crashes ? BOOM : OK }}>{conf}</span>
          {crashes
            ? `  — needle sets it to None for tuned weights, and .get()
#                              returns its default only when the key is ABSENT`
            : `  — so the branch evaluates ${conf} < ${t.toFixed(2)}, which is ${
                Number(conf) < t ? "True" : "False"
              }`}
        </pre>

        {crashes ? (
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[color-mix(in_oklch,oklch(0.58_0.19_27)_45%,transparent)] bg-[color-mix(in_oklch,oklch(0.58_0.19_27)_8%,transparent)] p-3 font-mono text-[10.5px] leading-5">
            <span style={{ color: BOOM }}>
              {`Traceback (most recent call last):
  File "smart_home.py", line 160, in run_tests
    if got and response.get("confidence", 0.0) < min_confidence:
                                                 ^
TypeError: '<' not supported between instances of 'NoneType' and 'float'`}
            </span>
            <br />
            <span className="text-muted-foreground">
              {`# case 1 of 32 — "turn on the kitchen lights". The first one that returns a call.`}
            </span>
          </pre>
        ) : (
          <div
            className="mt-2 rounded-lg border px-3 py-2.5 font-mono text-[10.5px] leading-5"
            style={{ color: dead ? DEAD : OK }}
          >
            {dead
              ? "Nothing is ever < 0.00, so the branch never fires. This is the default, and the default is what the shipped __main__ block runs to decide the exit status."
              : `Calls scoring under ${t.toFixed(2)} are discarded and the case is scored as a refusal. The docstring calls this "the production contract" — and it is not what the release gate runs.`}
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The whole pitch of this repository is that you take an environment, swap the enum values
          for your product&rsquo;s, fine-tune on it, and ship.{" "}
          <span className="text-foreground">
            Select the fine-tuned weights and the suite raises on the first test case.
          </span>{" "}
          Not on a hard one — on{" "}
          <em>turn on the kitchen lights</em>, the first of thirty-two, because it is the first that
          returns a call at all. The engine reports{" "}
          <code className="font-mono text-[11px] text-foreground">confidence: None</code> for tuned
          weights on purpose (the confidence head is not updated by fine-tuning, and{" "}
          <code className="font-mono text-[11px] text-foreground">needle</code> warns about it), and{" "}
          <code className="font-mono text-[11px] text-foreground">dict.get(k, default)</code> hands
          back the stored <code className="font-mono text-[11px] text-foreground">None</code>,
          because the key is present. One-line fix; nobody has run the path.
          <br />
          <br />
          The second thing the slider shows is quieter and matters more. The shipped entry point is{" "}
          <code className="font-mono text-[11px] text-foreground">
            sys.exit(0 if run_tests() else 1)
          </code>{" "}
          — the default, <span style={{ color: DEAD }}>min_confidence=0.0</span>, where the branch is
          unreachable. The function&rsquo;s own docstring says a threshold like 0.4 is what{" "}
          <span className="text-foreground">&ldquo;applies the production contract&rdquo;</span>. So
          the gate that decides whether an environment passes is explicitly the one that does{" "}
          <em>not</em> model the product. A confidence-gated model evaluated with its confidence gate
          switched off is being graded on a contract it will never run under.
        </p>
      </div>
    </figure>
  )
}
