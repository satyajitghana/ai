"use client"

import { useState } from "react"

// The data loop from docs/quality.md, drawn — because the thing that makes it
// worth drawing is that it closes.
//
//   raw manifest -> audit-data -> codec-check -> encode-expressive
//     -> SFT -> GRPO -> independent evaluation + listening test
//     -> hard cases / distill -> next SFT or GRPO round
//
// The step to steal is `distill`. The inference-time quality gate is already
// computing, for every request, whether an output cleared every threshold — so
// the gate that protects production doubles as a hard-example miner for the next
// training round, at no additional cost. Winning best-of-N samples that passed
// everything get added to the SFT manifest tagged `hard_case=true`, and can then
// be sampled more frequently during GRPO.
//
// Most projects run those as two separate systems and pay for both.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Node = {
  key: string
  l: string
  cmd?: string
  c: string
  note: string
}

const NODES: Node[] = [
  {
    key: "audit",
    l: "audit-data",
    cmd: "nar-tts audit-data",
    c: MUTED,
    note: "Separates corrupt and duplicate recordings, plus anything with excessive silence, clipping, or a suspicious text-to-duration ratio. The last one is the clever check: a transcript that does not plausibly take that long to say is either mislabelled or mis-segmented, and both poison training the same way.",
  },
  {
    key: "codec",
    l: "codec-check",
    cmd: "nar-tts codec-check",
    c: MUTED,
    note: "Verifies the Mimi round trip before anything is trained on it. If the codec cannot reconstruct your audio, no amount of model quality recovers it — and finding that out after a training run is an expensive way to learn it.",
  },
  {
    key: "encode",
    l: "encode-expressive",
    cmd: "nar-tts encode-expressive",
    c: ACCENT,
    note: "Produces the Parquet the trainer reads. Alongside input_ids it retains speaker, emotion, event, source and licence fields — licence being the one most pipelines drop at the first transformation and then cannot reconstruct.",
  },
  {
    key: "sft",
    l: "SFT",
    c: ACCENT,
    note: "Supervised fine-tuning on the encoded corpus, with both neutral and expressive recordings included. Splits are made without speaker or text leakage between the two.",
  },
  {
    key: "grpo",
    l: "GRPO",
    c: GOOD,
    note: "Six active rewards, normalized within each prompt group: intelligibility at 0.60, speaker similarity 0.15, technical quality 0.08, speaker drift 0.07, duration 0.05, prosody 0.05. Emotion and event rewards are implemented and held at zero.",
  },
  {
    key: "eval",
    l: "independent eval + listening test",
    c: GOOD,
    note: "Deliberately not scored with the ASR used as the training reward. An independent ASR family, speaker-drift checks, multi-dimensional quality metrics, and blinded human A/B tests for naturalness, emotion and speaker identity.",
  },
  {
    key: "distill",
    l: "hard cases / distill",
    cmd: "nar-tts distill",
    c: WARM,
    note: "The step worth stealing. Only the winning best-of-N samples that passed every threshold are added to the new SFT manifest, tagged hard_case=true so they can be sampled more frequently during GRPO. The inference-time quality gate was already computing this for every request — so the gate that protects production is also the hard-example miner, for free.",
  },
]

export function DataLoop() {
  const [sel, setSel] = useState("distill")
  const n = NODES.find((x) => x.key === sel) ?? NODES[0]

  const W = 720
  const H = 138
  const BW = 92
  const GAP = 12

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          raw manifest → … → hard cases → the next round
        </span>
        <span className="font-mono text-[10px]" style={{ color: n.c }}>
          {n.cmd ?? n.l}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[680px] max-w-full">
            <title>
              A seven-stage data loop from raw manifest through auditing, codec checking, encoding, supervised
              fine-tuning, GRPO and independent evaluation, with hard cases feeding back into the next training
              round.
            </title>
            <text x={6} y={16} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              raw manifest
            </text>
            {NODES.map((nd, i) => {
              const x = 6 + i * (BW + GAP)
              const on = nd.key === sel
              return (
                <g key={nd.key} onClick={() => setSel(nd.key)} style={{ cursor: "pointer" }}>
                  <rect
                    x={x}
                    y={26}
                    width={BW}
                    height={48}
                    rx={6}
                    fill={nd.c}
                    fillOpacity={on ? 0.24 : 0.09}
                    stroke={nd.c}
                    strokeOpacity={on ? 1 : 0.42}
                    strokeWidth={on ? 1.75 : 1}
                  />
                  <foreignObject x={x + 3} y={32} width={BW - 6} height={38}>
                    <div
                      style={{
                        fontSize: "8.5px",
                        lineHeight: "11px",
                        textAlign: "center",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {nd.l}
                    </div>
                  </foreignObject>
                  {i < NODES.length - 1 ? (
                    <polygon points={`${x + BW + 9},50 ${x + BW + 2},46 ${x + BW + 2},54`} fill="currentColor" fillOpacity={0.35} />
                  ) : null}
                </g>
              )
            })}

            {/* the closing arc: hard cases back to SFT and GRPO */}
            <path
              d={`M${6 + 6 * (BW + GAP) + BW / 2},74 L${6 + 6 * (BW + GAP) + BW / 2},96 L${6 + 3 * (BW + GAP) + BW / 2},96 L${6 + 3 * (BW + GAP) + BW / 2},76`}
              fill="none"
              stroke={WARM}
              strokeWidth={1.75}
            />
            <polygon points={`${6 + 3 * (BW + GAP) + BW / 2},78 ${6 + 3 * (BW + GAP) + BW / 2 - 4},86 ${6 + 3 * (BW + GAP) + BW / 2 + 4},86`} fill={WARM} />
            <line x1={6 + 4 * (BW + GAP) + BW / 2} y1={96} x2={6 + 4 * (BW + GAP) + BW / 2} y2={76} stroke={WARM} strokeWidth={1.75} />
            <polygon points={`${6 + 4 * (BW + GAP) + BW / 2},78 ${6 + 4 * (BW + GAP) + BW / 2 - 4},86 ${6 + 4 * (BW + GAP) + BW / 2 + 4},86`} fill={WARM} />
            <text x={6 + 5 * (BW + GAP)} y={112} fontSize={9} fill={WARM} textAnchor="middle" fontFamily="ui-monospace, monospace">
              hard_case=true — sampled more often next round
            </text>
            <text x={6} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              click a stage
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: n.c }}>
            {n.l}
            {n.cmd ? <span className="ml-2 text-[9px] text-muted-foreground">{n.cmd}</span> : null}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{n.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The arc at the bottom is what makes this a loop rather than a pipeline, and the step it comes from is
          the one worth taking to another project. The inference-time quality gate is{" "}
          <span className="text-foreground">already computing, for every single request, whether an output
          cleared every threshold</span>. So the gate that protects production is also, at zero additional cost, a
          miner for exactly the examples the next training round should see more of.
          <br />
          <br />
          Only winners that passed everything are added, tagged{" "}
          <span className="font-mono text-[11px] text-foreground">hard_case=true</span>, and those rows can then
          be oversampled during GRPO. Most projects build a serving quality gate and a training data pipeline as
          two independent systems, and pay for both.
        </p>
      </div>
    </figure>
  )
}
