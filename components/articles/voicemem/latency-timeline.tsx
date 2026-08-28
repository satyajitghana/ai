"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The four-stage streaming query, Section 3.3, Eq. (8)-(10) and Figure 3.
//
// Standard VAD fires at 500ms of silence. VOICEMEM does not wait for that to
// start working -- it runs three overlapping stages inside the same window:
//
//   (i)   Speech Tail    0-200ms   user still talking: streaming ASR, entity
//                                  and schema matching, emotion recognition
//   (ii)  Anticipation 200-400ms   200ms pause assumed -> embed the query,
//                                  expand both graphs (Eq. 1, 5)
//   (iii) Searching    400-500ms   MemSearch both brains, merge (Eq. 10)
//
// The paper's own number for stage (iii): "the dense dual-brain retrieval
// itself costs only 134ms" -- measured, and stated as flat from K=3 to K=100
// because schema routing bounds the candidate pool before ranking runs, so
// widening K does not widen how much is searched (Section 5.4, Fig. 6).
//
// For contrast, Section 1's own framing of the problem (O2): "conventional
// memory pipelines often require 2-3 seconds for retrieval and processing" --
// against the same 500ms budget.

const STAGE1 = "oklch(0.62 0.03 250)"
const STAGE2 = "oklch(0.60 0.15 255)"
const STAGE3 = "oklch(0.55 0.16 155)"
const DEADLINE = "oklch(0.58 0.19 27)"
const CONV = "oklch(0.68 0.13 85)"

const K_OPTIONS = [3, 5, 10, 30, 100] as const

const W = 700
const X0 = 14
const SCALE_MS = 3000
const TRACK_W = 672
const px = (ms: number) => X0 + (ms / SCALE_MS) * TRACK_W

export function LatencyTimeline() {
  const [k, setK] = useState<(typeof K_OPTIONS)[number]>(5)

  const deadlineX = px(500)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">time from end-of-utterance to reply</span>
        <span className="font-mono text-[10px]" style={{ color: STAGE3 }}>
          500ms VAD budget
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 158`} width={W} height={158} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two pipelines against a 500 millisecond voice-activity-detection deadline, drawn on the same 0 to 3000 millisecond scale. VoiceMem's three streaming stages finish inside 500 milliseconds, with the search phase measured at 134 milliseconds at K=${k}. The paper's own figure for conventional memory pipelines is 2000 to 3000 milliseconds, four to six times past the deadline.`}
            </title>

            {/* shared axis */}
            <line x1={X0} y1={20} x2={X0 + TRACK_W} y2={20} stroke="currentColor" strokeOpacity={0.15} />
            {[0, 500, 1000, 1500, 2000, 2500, 3000].map((t) => (
              <g key={t}>
                <line x1={px(t)} y1={16} x2={px(t)} y2={140} stroke="currentColor" strokeOpacity={t === 0 ? 0 : 0.08} />
                <text x={px(t)} y={12} fontSize={6.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {t}
                </text>
              </g>
            ))}

            {/* conventional pipeline row */}
            <text x={X0} y={38} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              conventional memory pipeline
            </text>
            <rect x={px(2000)} y={44} width={px(3000) - px(2000)} height={18} rx={3} fill={CONV} fillOpacity={0.35} />
            <text x={(px(2000) + px(3000)) / 2} y={57} textAnchor="middle" fontSize={7.5} fill={CONV} fontFamily="ui-monospace, monospace">
              2,000-3,000 ms
            </text>
            <text x={px(3000)} y={38} textAnchor="end" fontSize={7} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              4-6x the budget
            </text>

            {/* VoiceMem row, stacked stages */}
            <text x={X0} y={78} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              VoiceMem, three overlapped stages
            </text>
            <rect x={px(0)} y={84} width={px(200) - px(0)} height={18} rx={3} fill={STAGE1} fillOpacity={0.55} />
            <rect x={px(200)} y={84} width={px(400) - px(200)} height={18} rx={3} fill={STAGE2} fillOpacity={0.65} />
            <rect x={px(400)} y={84} width={px(500) - px(400)} height={18} rx={3} fill={STAGE3} fillOpacity={0.9} />

            {/* deadline marker across both rows */}
            <line x1={deadlineX} y1={30} x2={deadlineX} y2={110} stroke={DEADLINE} strokeDasharray="3 3" strokeWidth={1.3} />
            <text x={deadlineX + 5} y={30} fontSize={7} fill={DEADLINE} fontFamily="ui-monospace, monospace">
              reply must start
            </text>

            {/* zoomed callout of the 0-500 window */}
            <line x1={px(0)} y1={102} x2={px(0)} y2={118} stroke="currentColor" strokeOpacity={0.15} />
            <line x1={deadlineX} y1={102} x2={deadlineX} y2={118} stroke="currentColor" strokeOpacity={0.15} />

            <g transform="translate(14, 128)">
              <text fontSize={7} fill={STAGE1} fontFamily="ui-monospace, monospace">
                (i) speech tail 0-200
              </text>
              <text x={158} fontSize={7} fill={STAGE2} fontFamily="ui-monospace, monospace">
                (ii) anticipation 200-400
              </text>
              <text x={350} fontSize={7} fill={STAGE3} fontFamily="ui-monospace, monospace">
                (iii) searching 400-500, measured 134ms
              </text>
            </g>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">retrieved items K =</span>
          {K_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setK(opt)}
              aria-pressed={k === opt}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k === opt
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {opt}
            </button>
          ))}
          <span className="font-mono text-[10px]" style={{ color: STAGE3 }}>
            search stays ≈134 ms
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The three stages are not sequential slack added on top of listening — they overlap it.
          <span style={{ color: STAGE1 }}> Speech tail</span>{" "}runs streaming ASR, entity/schema
          matching, and emotion recognition while the user is still talking, so none of it is on the
          clock. Once VOICEMEM assumes a 200ms pause means a reply is coming,{" "}
          <span style={{ color: STAGE2 }}>anticipation</span>{" "}embeds the query and expands both
          graphs (Eq. 1 for the left brain, Eq. 5 for the right). Only{" "}
          <span style={{ color: STAGE3 }}>searching</span>{" "}is left, and the paper measures it at
          134ms regardless of which K button you press above — schema routing bounds the candidate
          pool before ranking starts, so a bigger K reranks the same small pool rather than a bigger
          one.
          <br />
          <br />
          The paper motivates the whole design against{" "}
          <span style={{ color: CONV }}>2-3 second retrieval</span>{" "}being normal for the memory
          systems it compares against — its own stated reason a bolt-on memory engine cannot sit in
          a live voice loop without the streaming rework.
        </p>
      </div>
    </figure>
  )
}
