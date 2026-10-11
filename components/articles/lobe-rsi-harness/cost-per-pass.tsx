"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// FrontierHarness prices every run at one frozen Kimi K3 card (pricing.json,
// version kimi-k3-2026-08-20): $3.00 per million fresh input tokens, $0.30 per
// million cached input tokens, $15.00 per million output tokens. Its cost
// metric, effective_cost_per_pass, is every dollar spent on all 30 tasks
// divided by the tasks that passed. This calculator does that arithmetic for a
// hypothetical run, and adds the one knob the benchmark forbids: extra
// attempts per task, with the option of billing or hiding the discarded ones.
// The defaults land near LobeHub's $1.68; they are a back-solve, not data.

const FRESH = 3.0
const CACHED = 0.3
const OUTPUT = 15.0
const TASKS = 30

const C_FRESH = "oklch(0.60 0.19 25)"
const C_CACHED = "oklch(0.62 0.12 230)"
const C_OUT = "oklch(0.66 0.15 80)"

function Slider({
  label,
  value,
  shown,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  shown: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{shown}</span>
      </div>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
        aria-label={label}
      />
    </label>
  )
}

export function CostPerPass() {
  const [inputM, setInputM] = useState(1.4)
  const [hit, setHit] = useState(86.2)
  const [outK, setOutK] = useState(17)
  const [passes, setPasses] = useState(21)
  const [attempts, setAttempts] = useState(1)
  const [billRetries, setBillRetries] = useState(true)

  const h = hit / 100
  const fresh = inputM * (1 - h) * FRESH
  const cached = inputM * h * CACHED
  const out = (outK / 1000) * OUTPUT
  const perAttempt = fresh + cached + out

  const billedAttempts = billRetries ? TASKS * attempts : TASKS
  const total = perAttempt * billedAttempts
  const perPass = passes > 0 ? total / passes : 0

  // Same run with one honest attempt per task, for contrast.
  const single = (perAttempt * TASKS) / Math.max(passes, 1)

  const parts = [
    { label: "fresh input", v: fresh, c: C_FRESH },
    { label: "cached input", v: cached, c: C_CACHED },
    { label: "output", v: out, c: C_OUT },
  ]

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          Where a dollar per pass comes from
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          Kimi K3 card: $3 / $0.30 / $15 per M
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Slider
            label="input tokens per attempt"
            value={inputM}
            shown={`${inputM.toFixed(1)} M`}
            min={0.2}
            max={6}
            step={0.1}
            onChange={setInputM}
          />
          <Slider
            label="cache hit rate (token share)"
            value={hit}
            shown={`${hit.toFixed(1)}%`}
            min={20}
            max={99}
            step={0.1}
            onChange={setHit}
          />
          <Slider
            label="output tokens per attempt"
            value={outK}
            shown={`${outK} K`}
            min={2}
            max={60}
            step={1}
            onChange={setOutK}
          />
          <Slider
            label="tasks passed"
            value={passes}
            shown={`${passes} / ${TASKS}`}
            min={10}
            max={30}
            step={1}
            onChange={setPasses}
          />
          <Slider
            label="attempts per task (mean)"
            value={attempts}
            shown={attempts.toFixed(1)}
            min={1}
            max={3}
            step={0.1}
            onChange={setAttempts}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={billRetries}
              onChange={(e) => setBillRetries(e.target.checked)}
            />
            <span>bill the attempts that were thrown away</span>
          </label>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-muted-foreground">one attempt costs</div>
            <div className="mt-1 flex h-5 w-full overflow-hidden rounded">
              {parts.map((p) => (
                <div
                  key={p.label}
                  style={{
                    width: `${perAttempt > 0 ? (p.v / perAttempt) * 100 : 0}%`,
                    background: p.c,
                  }}
                  title={`${p.label}: $${p.v.toFixed(2)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
              {parts.map((p) => (
                <span key={p.label}>
                  <span style={{ color: p.c }}>■</span> {p.label} ${p.v.toFixed(2)}
                </span>
              ))}
            </div>
            <div className="mt-2 text-sm">
              ${perAttempt.toFixed(2)} per attempt; the{" "}
              {(100 - hit).toFixed(1)}% of input that misses the cache is{" "}
              {perAttempt > 0 ? ((fresh / perAttempt) * 100).toFixed(0) : 0}% of the bill.
            </div>
          </div>

          <div className="rounded-md border border-dashed p-3">
            <div className="font-mono text-xs text-muted-foreground">
              cost per pass = {billedAttempts.toFixed(0)} attempts x $
              {perAttempt.toFixed(2)} / {passes}
            </div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: C_FRESH }}>
              ${perPass.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {attempts > 1 && !billRetries
                ? `Hiding the discarded attempts drops ${(perAttempt * TASKS * (attempts - 1)).toFixed(2)} dollars of spend; billed honestly this run costs $${((perAttempt * TASKS * attempts) / Math.max(passes, 1)).toFixed(2)} per pass.`
                : attempts > 1
                  ? `With one attempt per task and the same pass count it would be $${single.toFixed(2)}.`
                  : "One attempt per task, every attempt billed: the benchmark's own rule."}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
