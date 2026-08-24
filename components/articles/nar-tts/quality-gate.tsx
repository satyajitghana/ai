"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// The inference-time quality gate, priced.
//
// Nar's default flow generates two candidates, verifies them, and expands to four
// only when the gate fails. The gate checks speaker similarity, CER, duration,
// clipping, silence and repetition, with Whisper doing the ASR verification
// independently of the Qwen3-ASR used as the training reward. It writes the
// winning WAV, every candidate, and a machine-readable JSON report.
//
// The arithmetic of "two, then four if needed" against "always four" is worth
// doing, because it is the whole argument for adaptive best-of-N:
//
//   E[candidates] = 2 + 2 * (1-p)^2       success = 1 - (1-p)^4
//
// where p is the chance a single candidate clears the gate. Both schemes reach
// the same success rate — the second pair is generated exactly when it is needed
// — but the adaptive one pays for it only on the requests that need it. At a 0.8
// pass rate that is 2.08 candidates instead of 4.
//
// p is not published, and it depends on the checkpoint, the reference audio and
// the text. The slider is the point: the saving is large wherever the gate mostly
// passes, and the scheme degrades to always-four exactly where it does not.
//
// mpow because these powers reach the DOM.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const CHECKS = [
  { l: "CER", note: "Whisper — a different ASR family from the training reward" },
  { l: "speaker similarity", note: "does it still sound like the reference speaker" },
  { l: "duration", note: "against the reference" },
  { l: "clipping", note: "signal diagnostic" },
  { l: "silence", note: "signal diagnostic" },
  { l: "repetition", note: "the characteristic autoregressive TTS failure" },
]

export function QualityGate() {
  const [p, setP] = useState(80)
  const pp = p / 100

  const bothFail = mpow(1 - pp, 2)
  const expected = 2 + 2 * bothFail
  const success = 1 - mpow(1 - pp, 4)
  const single = pp
  const saving = 1 - expected / 4

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two candidates · four only when the gate fails · every candidate kept, with a JSON report
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {expected.toFixed(2)} candidates for {(success * 100).toFixed(2)}% success
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="w-40 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            one candidate clears the gate
          </span>
          <Range
            min={10}
            max={98}
            step={1}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            className="flex-1"
            aria-label="probability that a single candidate passes the quality gate"
            accent={ACCENT}
          />
          <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{p}%</span>
        </div>

        <div className="mt-3 space-y-1">
          {[
            { l: "no gate — take the first candidate", cands: 1, ok: single, c: WARM },
            { l: "adaptive — two, then two more if needed", cands: expected, ok: success, c: GOOD },
            { l: "always four", cands: 4, ok: success, c: ACCENT },
          ].map((row) => (
            <div key={row.l} className="flex items-center gap-2">
              <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{row.l}</span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(row.cands / 4) * 100}%`, background: row.c, opacity: 0.85 }} />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: row.c }}>
                {row.cands.toFixed(2)} gen
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {(row.ok * 100).toFixed(1)}%
              </span>
            </div>
          ))}
          <div className="pl-2 font-mono text-[9px] text-muted-foreground">
            bar and first value are generations per request · last column is the chance the request ends with an
            output that passes
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">the gate fires</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {(bothFail * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">of requests need the second pair</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">against always-four</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: saving > 0.3 ? GOOD : WARM }}>
              −{(saving * 100).toFixed(0)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">same success rate, less compute</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what the gate buys</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              +{((success - single) * 100).toFixed(1)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">points over taking the first candidate</div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what the gate checks</div>
          <div className="mt-1.5 space-y-0.5">
            {CHECKS.map((c) => (
              <div key={c.l} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
                <span className="w-32 shrink-0 text-right text-foreground">{c.l}</span>
                <span className="text-muted-foreground">{c.note}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Adaptive best-of-N reaches exactly the same success rate as always generating four, because the second
          pair is produced precisely when it is needed — but it only pays for it on the requests that need it. At
          a gate pass rate of 80% that is{" "}
          <span className="text-foreground">2.08 generations instead of 4</span>, and the scheme degrades
          gracefully: as the pass rate falls, it converges on always-four rather than failing.
          <br />
          <br />
          The pass rate is not published and it depends on the checkpoint, the reference clip and the text — which
          is why the report matters more than the number. Nar writes the winning WAV, every candidate, and a
          machine-readable JSON report including a real-time factor, so the pass rate is something you measure on
          your own data rather than a parameter you inherit. That is the difference between best-of-N as a quality
          feature and best-of-N as a cost you cannot account for.
        </p>
      </div>
    </figure>
  )
}
