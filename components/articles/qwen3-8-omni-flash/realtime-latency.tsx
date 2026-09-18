// Qwen's own "Throughput & Latency" table for the Qwen3.8-Omni-Flash-Realtime
// API (qwen.ai/blog?id=qwen3.8-omni-flash), reproduced verbatim and split into
// the two things a voice turn actually costs: the wait for the first *text*
// token, and the extra wait after that before the first *audio* packet comes
// back. Qwen publishes both columns but never subtracts them; the gap is the
// only part of the wait that the Talker/vocoder stage adds on top of prefill.
//
// SSR, zero JS: every width is an exact ratio (only / and *), so there is no
// transcendental math here and nothing for lib/dmath to pin.

type Row = {
  label: string
  tps: number // text output tokens/s
  ttft: number // time to first token, ms
  tfap: number // time to first audio packet, ms
  rtf: number // audio generation real-time factor
}

// Verbatim from the blog's table — no rounding, no re-derivation.
const ROWS: Row[] = [
  { label: "Audio 6s", tps: 84.87, ttft: 591.26, tfap: 978.36, rtf: 0.1538 },
  { label: "Audio 12s", tps: 83.18, ttft: 604.8, tfap: 982.74, rtf: 0.1537 },
  { label: "Audio 20s", tps: 81.06, ttft: 617.98, tfap: 1026.39, rtf: 0.1538 },
  { label: "Audio-visual 6s", tps: 84.89, ttft: 837.96, tfap: 1214.73, rtf: 0.1524 },
  { label: "Audio-visual 12s", tps: 84.33, ttft: 911.85, tfap: 1268.07, rtf: 0.1527 },
  { label: "Audio-visual 20s", tps: 83.0, ttft: 981.01, tfap: 1350.49, rtf: 0.1528 },
]

const MAX_MS = 1500
const PREFILL = "oklch(0.62 0.02 260)" // neutral — prefill + first text token
const TALKER = "oklch(0.68 0.16 205)" // cyan — the extra wait for audio

const gaps = ROWS.map((r) => r.tfap - r.ttft)
const gapMin = Math.min(...gaps)
const gapMax = Math.max(...gaps)
const tpsMin = Math.min(...ROWS.map((r) => r.tps))
const tpsMax = Math.max(...ROWS.map((r) => r.tps))

export function RealtimeLatency() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.8-Omni-Flash-Realtime — one voice turn, in milliseconds
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Qwen&rsquo;s own published measurements
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PREFILL }} />
            to first text token
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TALKER }} />
            extra wait for first audio packet
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {ROWS.map((r) => {
            const gap = r.tfap - r.ttft
            return (
              <div key={r.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr]">
                <span className="font-mono text-[10px] text-foreground sm:text-[11px]">{r.label}</span>
                <div>
                  <div className="relative h-5 rounded-sm bg-muted/30">
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-sm"
                      style={{ width: `${(r.ttft / MAX_MS) * 100}%`, background: PREFILL, opacity: 0.55 }}
                    />
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: `${(r.ttft / MAX_MS) * 100}%`,
                        width: `${(gap / MAX_MS) * 100}%`,
                        background: TALKER,
                      }}
                    />
                    <span
                      className="absolute inset-y-0 flex items-center pl-1.5 font-mono text-[10px] tabular-nums text-muted-foreground"
                      style={{ left: `${(r.tfap / MAX_MS) * 100}%` }}
                    >
                      {Math.round(r.tfap)}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] tabular-nums text-muted-foreground">
                    {Math.round(r.ttft)} ms to text{" "}
                    <span style={{ color: TALKER }}>+{Math.round(gap)} ms to audio</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 border-t pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Across all six conditions the time to the first <em>text</em> token rises{" "}
          {Math.round(ROWS[5].ttft - ROWS[0].ttft)} ms (591 &rarr; 981), while the extra wait the audio
          stage adds on top stays inside {Math.round(gapMin)}&ndash;{Math.round(gapMax)} ms. Text output
          holds at {tpsMin.toFixed(1)}&ndash;{tpsMax.toFixed(1)} tok/s; audio generation RTF
          0.1524&ndash;0.1538, i.e. speech is synthesised about 6.5&times; faster than it plays.
        </div>
      </div>
    </figure>
  )
}
