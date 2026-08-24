"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The system-prompt finding, and how much of it is actually measured.
//
// Two prompts are reported. One carried a 400-line p5.brush API reference and
// produced "confident, well-formatted code that invented APIs that did not
// exist". The other, which GEPA converged on after 200 iterations against a
// taste-anchored 7-shot judge, carried a strict allowlist of eight brush
// methods, no API documentation and no examples — and was the first version to
// get three visible hibiscus blobs out of three generations.
//
// Two points on the axis, and no measurements between them. Worth drawing that
// way, because the generalisation the post draws from it ("long reference
// documentation made the models hallucinate APIs") is a claim about the whole
// curve. It is also confounded: GEPA rewrote the entire prompt over 200
// iterations, so dropping the reference is one edit inside a search, not an
// isolated A/B.
//
// The surface-area rectangles are illustrative. The two endpoints are not.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const ALLOWLIST = 8

// illustrative: how much surface the prompt describes, and how much the model
// behaves as though it has, at L lines of reference documentation
const described = (L: number) => ALLOWLIST + L * 0.3
const called = (L: number) => described(L) * (1 + (L / 400) * 0.9)

export function AllowlistVsReference() {
  const [lines, setLines] = useState(400)
  const [pinned, setPinned] = useState<"ref" | "allow" | null>("ref")

  const L = pinned === "ref" ? 400 : pinned === "allow" ? 0 : lines
  const measured = L === 0 || L === 400

  const d = described(L)
  const c = called(L)
  const invented = c - d

  const W = 700
  const H = 208
  const CX = 190
  const CY = 106
  const SCALE = 10

  // area-proportional squares: sqrt is exactly rounded per IEEE-754
  const sd = Math.sqrt(d) * SCALE
  const sc = Math.sqrt(c) * SCALE

  const tone = L > 200 ? WARM : L > 40 ? ACCENT : GOOD

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GEPA · 200 iterations · taste-anchored 7-shot judge · converged on {ALLOWLIST} brush methods
        </span>
        <span className="font-mono text-[10px]" style={{ color: measured ? GOOD : WARM }}>
          {measured ? "a reported configuration" : "between the two reported points"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ref", "400-line API reference"],
              ["allow", "8-method allowlist, no docs"],
              [null, "somewhere in between"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={l}
              type="button"
              onClick={() => setPinned(k)}
              aria-pressed={pinned === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pinned === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              Two concentric squares. The inner solid square is the API surface the system prompt describes; the
              outer dashed square is the surface the model writes code against. With a four-hundred-line reference
              the dashed square is much the larger, and the gap between them is labelled invented APIs. With the
              eight-method allowlist the two squares coincide.
            </title>

            <rect
              x={CX - sc / 2}
              y={CY - sc / 2}
              width={sc}
              height={sc}
              rx={4}
              fill={tone}
              fillOpacity={0.07}
              stroke={tone}
              strokeOpacity={0.6}
              strokeDasharray="4 3"
            />
            <rect
              x={CX - sd / 2}
              y={CY - sd / 2}
              width={sd}
              height={sd}
              rx={4}
              fill={ACCENT}
              fillOpacity={0.2}
              stroke={ACCENT}
              strokeOpacity={0.7}
            />

            <text x={CX} y={CY - 1} fontSize={10} textAnchor="middle" fill="currentColor" fontFamily="ui-monospace, monospace">
              described
            </text>
            <text x={CX} y={CY + 13} fontSize={9} textAnchor="middle" fill={ACCENT} fontFamily="ui-monospace, monospace">
              {d.toFixed(0)} calls
            </text>

            <line
              x1={CX + sd / 2}
              y1={CY - sc / 2 - 9}
              x2={CX + sc / 2}
              y2={CY - sc / 2 - 9}
              stroke={tone}
              strokeOpacity={0.7}
            />
            <text
              x={(CX + sd / 2 + CX + sc / 2) / 2}
              y={CY - sc / 2 - 13}
              fontSize={8.5}
              textAnchor="middle"
              fill={tone}
              fontFamily="ui-monospace, monospace"
            >
              {invented < 0.5 ? "no gap" : `≈ ${invented.toFixed(0)} invented`}
            </text>

            {/* the ledger */}
            <g fontFamily="ui-monospace, monospace">
              <text x={396} y={34} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                lines of API reference in the prompt
              </text>
              <text x={396} y={56} fontSize={17} fill={tone}>
                {L}
              </text>
              <text x={396} y={84} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                what the post reports here
              </text>
              <text x={396} y={102} fontSize={9.5} fill="currentColor" fillOpacity={0.85}>
                {L === 400 ? "invents APIs that do not exist" : L === 0 ? "3 of 3 visible hibiscus blobs" : "nothing"}
              </text>
              <text x={396} y={128} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                examples in the prompt
              </text>
              <text x={396} y={146} fontSize={9.5} fill="currentColor" fillOpacity={0.85}>
                {L === 0 ? "none — allowlist only" : "none"}
              </text>
              <text x={396} y={174} fontSize={8.5} fill={measured ? GOOD : WARM}>
                {measured ? "◆ measured" : "◇ interpolated — no run at this length"}
              </text>
            </g>

            <text x={8} y={H - 6} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              solid = what the prompt describes · dashed = what the model writes code against · area ∝ distinct
              calls, illustrative
            </text>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            reference length
          </span>
          <Range
            min={0}
            max={400}
            step={10}
            value={L}
            onChange={(e) => {
              setPinned(null)
              setLines(Number(e.target.value))
            }}
            className="flex-1"
            aria-label="lines of p5.brush API reference included in the system prompt"
            accent={tone}
          />
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {L} lines
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5" style={{ borderColor: `${WARM}44` }}>
            <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: WARM }}>
              400-line API reference
            </div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              &ldquo;Confident, well-formatted code that invented APIs that did not exist.&rdquo; Fluent output,
              nonexistent calls — the failure mode that costs the most debugging time because nothing about the
              code looks wrong.
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5" style={{ borderColor: `${GOOD}44` }}>
            <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: GOOD }}>
              {ALLOWLIST}-method allowlist, no docs, no examples
            </div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              The first version to produce three visible hibiscus blobs out of three generations — written after
              throwing the reference out entirely. The post does not name the eight methods.
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The finding is counterintuitive enough to be worth stating twice: giving the model{" "}
          <em>more</em>{" "}documentation about the library made it hallucinate <em>more</em>{" "}of the library. A long
          reference reads as a description of a large surface, and a model writing fluent code against a large
          surface will reach for the method that ought to exist.{" "}
          <span className="text-foreground">
            An allowlist is a different kind of statement — not &ldquo;here is what exists&rdquo; but &ldquo;here is
            what you may call&rdquo;
          </span>
          , and a call outside it is a visible violation rather than a plausible guess.
          <br />
          <br />
          The honest caveat is in the slider. Two prompts were run; the axis between them is empty. And GEPA rewrote
          the whole prompt across 200 iterations, so &ldquo;we removed the API reference&rdquo; is one edit inside a
          search over many, not a controlled ablation. The direction is convincing and the mechanism is plausible.
          The dose-response curve that the generalisation implies has two points on it.
        </p>
      </div>
    </figure>
  )
}
