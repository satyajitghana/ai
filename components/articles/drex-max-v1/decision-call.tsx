"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The answer() arithmetic from the repo's drex_max/model.py, written again here
// from reading it, run on the probabilities a readout gives. Choice: confidence is
// (p_best - 1/n) / (1 - 1/n). Score: the expected level, and a confidence that
// is 1 minus the mean distance from the best level over the same distance for a
// flat distribution. Noul: the probability of "true". The README example's
// printed values are in the first preset so the replay can be checked by eye.

type Kind = "choice" | "score" | "noul"

const PRESETS: { id: string; label: string; kind: Kind; keys: string[]; p: number[]; readme: Record<string, string> }[] = [
  {
    id: "team",
    label: "README: team",
    kind: "choice",
    keys: ["billing", "technical", "other"],
    p: [0.9988, 0.0003, 0.0009],
    readme: { confidence: "0.9982" },
  },
  {
    id: "urgency",
    label: "README: urgency",
    kind: "score",
    keys: ["0 Routine", "1 Soon", "2 Urgent"],
    p: [0.0152, 0.3173, 0.6674],
    readme: { score: "1.6522", confidence: "0.4783" },
  },
  {
    id: "refund",
    label: "README: refund",
    kind: "noul",
    keys: ["false", "true"],
    p: [0.0026, 0.9974],
    readme: { noul: "0.9974" },
  },
]

function normalise(p: number[]) {
  const z = p.reduce((a, b) => a + b, 0)
  return p.map((x) => x / z)
}

function answer(kind: Kind, raw: number[]) {
  const p = normalise(raw)
  const n = p.length
  let best = 0
  for (let i = 1; i < n; i++) if (p[i] > p[best]) best = i
  if (kind === "noul") return { best, p, noul: p[1] }
  if (kind === "choice") {
    const conf = n === 1 ? 1 : (p[best] - 1 / n) / (1 - 1 / n)
    return { best, p, confidence: Math.max(0, Math.min(1, conf)) }
  }
  const mid = (n - 1) / 2
  let distn = 0
  let base = 0
  for (let i = 0; i < n; i++) {
    distn += p[i] * Math.abs(i - best)
    base += Math.abs(i - mid) / n
  }
  let score = 0
  for (let i = 0; i < n; i++) score += i * p[i]
  return { best, p, score, confidence: Math.max(0, Math.min(1, 1 - distn / base)) }
}

const f4 = (x: number) => x.toFixed(4)

export function DecisionCall() {
  const [pi, setPi] = useState(0)
  const [custom, setCustom] = useState(false)
  const [w, setW] = useState([6, 3, 1])
  const preset = PRESETS[pi]
  const raw = custom ? w : preset.p
  const kind: Kind = custom ? "choice" : preset.kind
  const keys = custom ? ["A", "B", "C"] : preset.keys
  const out = answer(kind, raw)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 font-mono text-xs">
        {PRESETS.map((pr, i) => (
          <button
            key={pr.id}
            type="button"
            onClick={() => {
              setPi(i)
              setCustom(false)
            }}
            className={cn(
              "rounded border px-2 py-0.5",
              !custom && pi === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {pr.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={cn("rounded border px-2 py-0.5", custom ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}
        >
          your own three options
        </button>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div className="grid content-start gap-2 font-mono text-[11px]">
          {custom
            ? keys.map((k, i) => (
                <label key={k} className="flex items-center gap-2">
                  <span className="w-24 shrink-0">
                    option {k}: {w[i]}
                  </span>
                  <Range min={0} max={10} step={1} value={w[i]} onChange={(e) => setW(w.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
                </label>
              ))
            : keys.map((k, i) => (
                <div key={k} className="grid gap-0.5">
                  <div className="flex justify-between">
                    <span>{k}</span>
                    <span>{f4(out.p[i])}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className={cn("h-2 rounded", i === out.best ? "bg-sky-600" : "bg-muted-foreground/50")} style={{ width: `${(out.p[i] * 100).toFixed(2)}%` }} />
                  </div>
                </div>
              ))}
          {custom && (
            <p className="text-muted-foreground">
              Weights are normalised to probabilities here; the real readout gives probabilities from a softmax over the 255 logits, cut to the options.
            </p>
          )}
        </div>
        <div className="grid content-start gap-1 font-mono text-[11px]">
          <div>
            type: <b>{kind}</b>
            {kind !== "noul" && <> | best: <b>{keys[out.best]}</b></>}
          </div>
          {"confidence" in out && (
            <div>
              confidence = {kind === "choice" ? "(p_best - 1/n) / (1 - 1/n)" : "1 - mean distance / flat distance"} = <b>{f4(out.confidence ?? 0)}</b>
            </div>
          )}
          {"score" in out && (
            <div>
              score = sum i * p_i = <b>{f4(out.score ?? 0)}</b>
            </div>
          )}
          {"noul" in out && (
            <div>
              noul = p(true) = <b>{f4(out.noul ?? 0)}</b>
            </div>
          )}
          {!custom && (
            <div className="mt-1 text-muted-foreground">
              README prints:{" "}
              {Object.entries(preset.readme)
                .map(([k, v]) => `${k} ${v}`)
                .join(", ")}
              . The probabilities are rounded to four places, so the last digit can differ.
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}
