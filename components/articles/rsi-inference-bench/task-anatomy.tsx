"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcbrt } from "@/lib/dmath"

// One real task, end to end: tasks/regression_fp8_decode_throughput in
// apple-aiml-research/ml-rsi-inference-bench at a6b10af (2026-10-16).
// Every fact below is read from that directory (measured): instruction.md,
// task.toml, environment/Dockerfile, environment/deidentify_engine_version.py,
// solution/, tests/_bench_rounds.py, tests/verify_regression_real.py and
// tests/_verifier_lib/regression_scoring.py. The per-agent results are the
// leaderboard snapshot 2026-10-12T05:39Z shipped in docs/leaderboard.html.

type Tab = "brief" | "snapshot" | "verifier" | "reward"

const TABS: { id: Tab; label: string }[] = [
  { id: "brief", label: "1 · Brief" },
  { id: "snapshot", label: "2 · Sealed snapshot" },
  { id: "verifier", label: "3 · Verifier" },
  { id: "reward", label: "4 · Reward" },
]

const SHAPES = [
  { id: "c2048", label: "2,048 in flight", oracle: 1.168 },
  { id: "c4096", label: "4,096 in flight", oracle: 1.239 },
  { id: "c8196", label: "8,196 in flight", oracle: 1.213 },
]
const ORACLE = 1.206
const NOISE = 1.03
const GUARD_MIN = 0.95

// Board value per agent on this task. gate = why a value was replaced by 1.00.
const RESULTS: { a: string; v: number; raw?: number; gate?: string }[] = [
  { a: "GPT-6.1-Sol", v: 1.526 },
  { a: "Opus-5.5", v: 1.468 },
  { a: "GPT-6-Astra", v: 1.423 },
  { a: "Fable-5.1", v: 1.337 },
  { a: "GLM-5.3", v: 1.314 },
  { a: "Opus-5", v: 1.306 },
  { a: "DeepSeek-V4.1-Flash", v: 1.288 },
  { a: "GPT-6-Sol", v: 1.285 },
  { a: "Sonnet-5.5", v: 1.254 },
  { a: "Opus-4.8", v: 1.133 },
  { a: "Gemini-3.7-Flash", v: 1.005, gate: "below noise floor" },
  { a: "Gemini-3.8-Flash", v: 1.0, raw: 0.884, gate: "guard regressed" },
]

const ACCENT = "oklch(0.58 0.17 255)"
const GOOD = "oklch(0.62 0.14 155)"
const BAD = "oklch(0.6 0.19 25)"
const REST = "oklch(0.68 0.02 260)"

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b border-dashed py-1.5 last:border-b-0">
      <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  )
}

export function TaskAnatomy() {
  const [tab, setTab] = useState<Tab>("brief")
  const [s, setS] = useState<number[]>([1.168, 1.239, 1.213])
  const [guard, setGuard] = useState(1.0)
  const [same, setSame] = useState(true)

  const geo = mcbrt(s[0] * s[1] * s[2])
  const guardOk = guard >= GUARD_MIN
  const above = geo >= NOISE
  const board = same && guardOk ? geo : 1
  const verdict = !same
    ? "outputs differ: the verifier fails it, and the board records 1.00x"
    : !guardOk
      ? "guard shape slower than the pinned tree: fails, recorded as 1.00x"
      : !above
        ? "passes the gates but sits under the 1.03 noise floor: flagged no_speedup"
        : geo >= ORACLE
          ? "beats the maintainer's own merged fix on this rig"
          : "a real gain, short of the maintainer's fix"

  const max = 1.6
  const pct = (v: number) => `${((Math.min(v, max) - 0.8) / (max - 0.8) * 100).toFixed(2)}%`

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">Anatomy of one task: regression_fp8_decode_throughput</div>
        <div className="font-mono text-xs text-muted-foreground">measured · read from the task directory</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{ background: on ? ACCENT : "transparent", borderColor: on ? ACCENT : undefined, color: on ? "white" : undefined }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "brief" && (
        <div className="space-y-3 text-sm">
          <blockquote className="border-l-2 pl-3 italic text-muted-foreground">
            This vLLM tree serves correctly, every request completes and the tokens are exactly right, but its mean
            time per output token is higher than the work accounts for.
          </blockquote>
          <Row k="model" v="nvidia/DeepSeek-R1-0528-NVFP4, MLA attention, FP8 KV cache" />
          <Row k="hardware" v="8x B200, data parallel 8 with expert parallelism" />
          <Row k="metric" v="mean TPOT (time per output token), lower is better" />
          <Row k="shapes" v="2-token prompts, 1,000 output tokens, 2,048 / 4,096 / 8,196 requests at once; guard at 64" />
          <Row k="told" v="a maintainer's repair exists and was measured on this rig; not what it changed or reached" />
          <Row k="budget" v="30,000 s for the agent (8.3 h), read from /app/.timer/remaining_secs" />
        </div>
      )}

      {tab === "snapshot" && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The agent gets the engine as it stood the day the slowdown shipped, with every route back to the fix
            closed off.
          </p>
          <Row k="engine pin" v="vLLM a4047d4, built from that commit's own wheel index" />
          <Row k="history" v="every .git directory deleted after checkout; repo/ is re-tagged inference_base" />
          <Row k="version" v="0.16.0rc2.dev369+ga4047d4ea scrubbed to 0.16.0rc2 in _version.py, METADATA, dist-info name" />
          <Row k="timestamps" v="every file's mtime reset to 2000-01-01" />
          <Row k="lockfile" v="deleted after install: it carried the engine pin" />
          <Row k="network" v="allow_internet = false; the brief also forbids upstream PRs, issues, release notes" />
          <Row k="box" v="64 CPUs, 1 TiB RAM, 8 B200s, Nsight Systems on PATH" />
          <Row k="oracle" v="upstream's merged fix for vllm-project/vllm#34900: two Python files, dynamic dims marked per argument" />
        </div>
      )}

      {tab === "verifier" && (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Build both trees on the same machine: the agent&apos;s <code>repo/</code> and the pristine pin.</li>
          <li>Decode fixed prompts on both and compare. Any difference scores zero, whatever the speed.</li>
          <li>
            Run one or more warmup benches on the pristine tree and discard them, until the readings plateau. A cold
            first bench read about ten percent faster on a byte-identical tree, more than the fix itself.
          </li>
          <li>Run scored rounds in rotated arm order, at least two per arm, one server per tree per shape.</li>
          <li>Per shape: the median of the per-round paired ratios, baseline TPOT over candidate TPOT.</li>
          <li>Score: the geometric mean over the three scored shapes. No cap.</li>
          <li>Guard at 64 in flight: if the candidate is under 0.95x in every round, the run fails.</li>
          <li>Under 1.03x is inside the rig&apos;s noise: the check fails and the result is flagged no_speedup.</li>
        </ol>
      )}

      {tab === "reward" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set what a candidate measured on each shape. Starts at the maintainer&apos;s own fix (1.168x, 1.239x,
            1.213x, geomean 1.206x).
          </p>
          <div className="space-y-2">
            {SHAPES.map((sh, i) => (
              <label key={sh.id} className="flex items-center gap-3">
                <span className="w-32 shrink-0 font-mono text-xs">{sh.label}</span>
                <Range
                  min={0.8}
                  max={2}
                  step={0.01}
                  value={s[i]}
                  accent={ACCENT}
                  onChange={(e) => {
                    const n = s.slice()
                    n[i] = Number(e.target.value)
                    setS(n)
                  }}
                  className="flex-1"
                  aria-label={`speed-up at ${sh.label}`}
                />
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{s[i].toFixed(2)}x</span>
              </label>
            ))}
            <label className="flex items-center gap-3">
              <span className="w-32 shrink-0 font-mono text-xs">guard, 64</span>
              <Range
                min={0.8}
                max={1.2}
                step={0.01}
                value={guard}
                accent={guardOk ? REST : BAD}
                onChange={(e) => setGuard(Number(e.target.value))}
                className="flex-1"
                aria-label="ratio at the guard shape"
              />
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{guard.toFixed(2)}x</span>
            </label>
            <label className="flex items-center gap-2 font-mono text-xs">
              <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />
              decoded tokens match the pinned tree
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-md border px-2.5 py-1 font-mono text-xs"
              onClick={() => {
                setS([1.168, 1.239, 1.213])
                setGuard(1)
                setSame(true)
              }}
            >
              maintainer fix
            </button>
            <button
              type="button"
              className="rounded-md border px-2.5 py-1 font-mono text-xs"
              onClick={() => {
                setS([1, 1, 1])
                setGuard(1)
                setSame(true)
              }}
            >
              no change
            </button>
            <button
              type="button"
              className="rounded-md border px-2.5 py-1 font-mono text-xs"
              onClick={() => {
                setS([1.6, 1.6, 1.6])
                setGuard(0.9)
                setSame(true)
              }}
            >
              fast, slows the guard
            </button>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="font-mono text-sm">
              geomean {geo.toFixed(3)}x → board {board.toFixed(3)}x
            </div>
            <div className="mt-1 text-sm" style={{ color: same && guardOk && above ? GOOD : BAD }}>
              {verdict}
            </div>
          </div>

          <div>
            <div className="mb-1.5 font-mono text-xs text-muted-foreground">
              what the 12 agents got on this task (board value; the dashed line is the maintainer fix)
            </div>
            <div className="space-y-1">
              {RESULTS.map((r) => (
                <div key={r.a} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-xs" title={r.a}>
                    {r.a}
                  </span>
                  <div className="relative h-3 flex-1 rounded-sm bg-muted">
                    <div
                      className="h-3 rounded-sm"
                      style={{ width: pct(r.v), background: r.gate ? BAD : r.v >= ORACLE ? GOOD : REST }}
                    />
                    <div className="absolute top-[-2px] h-4 border-l-2 border-dashed" style={{ left: pct(ORACLE), borderColor: ACCENT }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums" title={r.gate}>
                    {r.v.toFixed(3)}x{r.gate ? (r.raw ? ` (${r.raw.toFixed(3)})` : " *") : ""}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              axis 0.8x to 1.6x. Red: gated. Gemini-3.8-Flash measured 0.884x and failed the guard, so it was recorded as 1.00x; Gemini-3.7-Flash
              (*) is under the noise floor. Nine of twelve beat the merged fix.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
