"use client"

import { useState } from "react"

// The architecture the card actually describes, which is more sensible than the
// model claims around it.
//
// Taimi-14B-Med is positioned as the "text brain": service robots handle scene
// capture, visual acquisition and physical data acquisition, dedicated vision
// tools like YOLO turn that into structured medical data, and the language model
// reasons over the structured output rather than over raw pixels.
//
// Keeping perception in purpose-built tools and language in a language model is
// the right decomposition, and it is the one a 14B model can plausibly hold up.
// The four downstream applications are the card's own list — and they are not
// equivalent in risk, which is the thing the diagram makes visible and the card
// does not.
//
// The memory panel is measured, not specified: the card gives 12,537 MiB of
// 16,303 on an RTX 5080, dated 2026-08-14, with gpu-memory-utilization 0.85 and
// an fp8 KV cache at 4,096 context.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const APPS = [
  { l: "medical indicator Q&A", risk: "assistive", c: GOOD, note: "Answering a question about a value someone is already looking at. The lowest-stakes of the four and the one the benchmarks resemble most." },
  { l: "nursing guidance", risk: "assistive", c: GOOD, note: "Advice a clinician reads and can override. Still assistive, but the CMDD row — where the model sits about ten points below physician reference answers on relevance, safety and refusal — is the one that matters here, not the exam scores." },
  { l: "abnormal indicator alerting", risk: "consequential", c: WARM, note: "A missed alert and a false alert have very different costs, and neither is captured by accuracy on a multiple-choice exam. Nothing in the published evaluation measures alerting behaviour at all." },
  { l: "automated nursing record registration", risk: "regulated", c: WARM, note: "Writing into a patient record is a regulated act in most jurisdictions. The card lists it alongside Q&A without distinction, which is the single place I would want the scoping to be explicit." },
]

const VRAM = [
  { l: "model weights, AWQ 4-bit", mib: 10557, c: ACCENT, note: "10.31 GB on disk" },
  { l: "fp8 KV cache + runtime, 4,096 ctx", mib: 1980, c: GOOD, note: "--kv-cache-dtype fp8, --max-num-seqs 16" },
  { l: "headroom under the 0.85 cap", mib: 3766, c: MUTED, note: "16,303 MiB total on the RTX 5080" },
]
const TOTAL_MIB = 16303
const USED_MIB = 12537

export function RobotStack() {
  const [sel, setSel] = useState(0)
  const a = APPS[sel]

  const W = 720
  const H = 150

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the text brain — perception stays in purpose-built tools
        </span>
        <span className="font-mono text-[10px]" style={{ color: a.c }}>
          {a.risk}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              A left-to-right pipeline: a service robot captures the scene and physical data, dedicated vision
              tools such as YOLO convert it into structured medical data, and the language model reasons over that
              structured output to produce four downstream applications.
            </title>
            {[
              { x: 8, w: 150, t: "service robot", s: "scene capture · visual and physical data acquisition", c: MUTED },
              { x: 174, w: 150, t: "vision tools (YOLO)", s: "→ structured medical data", c: MUTED },
              { x: 340, w: 170, t: "Taimi-14B-Med", s: "the text brain · 14.7B, AWQ 4-bit", c: ACCENT },
            ].map((b, i) => (
              <g key={b.t}>
                <rect x={b.x} y={40} width={b.w} height={52} rx={7} fill={b.c} fillOpacity={i === 2 ? 0.2 : 0.09} stroke={b.c} strokeOpacity={i === 2 ? 1 : 0.45} strokeWidth={i === 2 ? 1.75 : 1} />
                <text x={b.x + b.w / 2} y={62} fontSize={11} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  {b.t}
                </text>
                <text x={b.x + b.w / 2} y={78} fontSize={8.5} fill="currentColor" fillOpacity={0.55} textAnchor="middle" fontFamily="ui-monospace, monospace">
                  {b.s}
                </text>
                {i < 2 ? (
                  <polygon points={`${b.x + b.w + 14},66 ${b.x + b.w + 4},61 ${b.x + b.w + 4},71`} fill="currentColor" fillOpacity={0.35} />
                ) : null}
              </g>
            ))}
            <line x1={158} y1={66} x2={172} y2={66} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
            <line x1={324} y1={66} x2={338} y2={66} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />

            {APPS.map((app, i) => (
              <g key={app.l} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <rect
                  x={540}
                  y={12 + i * 32}
                  width={172}
                  height={26}
                  rx={5}
                  fill={app.c}
                  fillOpacity={i === sel ? 0.24 : 0.08}
                  stroke={app.c}
                  strokeOpacity={i === sel ? 1 : 0.35}
                  strokeWidth={i === sel ? 1.75 : 1}
                />
                <text x={626} y={29 + i * 32} fontSize={9} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  {app.l}
                </text>
                <line x1={512} y1={66} x2={534} y2={25 + i * 32} stroke={app.c} strokeOpacity={i === sel ? 0.8 : 0.22} strokeWidth={i === sel ? 1.5 : 1} />
              </g>
            ))}
            <text x={626} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.45} textAnchor="middle" fontFamily="ui-monospace, monospace">
              click an application
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: a.c }}>
            {a.l} · {a.risk}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{a.note}</div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            measured on an RTX 5080, 2026-08-14 — {USED_MIB.toLocaleString()} MiB of {TOTAL_MIB.toLocaleString()},
            77% utilization
          </div>
          <div className="mt-2 flex h-6 overflow-hidden rounded-sm">
            {VRAM.map((v) => (
              <div
                key={v.l}
                className="h-6"
                style={{ width: `${(v.mib / TOTAL_MIB) * 100}%`, background: v.c, opacity: v.c === MUTED ? 0.2 : 0.85 }}
                title={`${v.l} — ~${v.mib.toLocaleString()} MiB`}
              />
            ))}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {VRAM.map((v) => (
              <div key={v.l} className="flex flex-wrap items-baseline gap-2 font-mono text-[9px]">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: v.c, opacity: v.c === MUTED ? 0.35 : 0.85 }} />
                <span className="w-56 shrink-0 text-foreground">{v.l}</span>
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground">~{v.mib.toLocaleString()} MiB</span>
                <span className="text-muted-foreground">{v.note}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            plus ~6.1 GB system RAM and a 45–90 s load. The weights row is the card&rsquo;s stated 10.31 GB; the
            split between cache and runtime is inferred from the measured total, not published separately.
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Strip the model claims and this is a sensible decomposition. Perception stays in tools built for it, the
          language model reasons over structured output rather than raw pixels, and{" "}
          <span className="text-foreground">a 14B model is a plausible size for the job it is actually given</span>
          . Most medical-AI framing does the opposite and asks one model to do everything.
          <br />
          <br />
          The four applications on the right are the card&rsquo;s own list, presented as a set. They are not one
          risk category. Answering a question about an indicator and writing into a patient record differ by
          regulation, not by degree, and a card that scopes deployment to healthcare institutions is the right
          place to say which of the four it considers assistive and which it does not.
        </p>
      </div>
    </figure>
  )
}
