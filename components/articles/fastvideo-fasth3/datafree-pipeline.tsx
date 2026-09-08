"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The actual training recipe, read from FastH3's own checkpoint_metadata.json
// (published alongside the weights) and the blog's "How FastH3 works" section
// -- not inferred from the "DataFree" name.
//
// Three networks, ALL initialized from the same MiniMax-H3 checkpoint:
//   - teacher: frozen, dense (FLASH_ATTN) attention, never updated.
//   - critic ("fake_score" in DMD2's own terminology): trainable, dense
//     attention, continuously updated to track the student's current output
//     distribution.
//   - student: trainable, VIDEO_SPARSE_ATTN_H3 attention, the thing being
//     distilled into a 4-step generator.
// generator_update_interval: 5 in the real config -- the student updates once
// for every 5 critic updates.
//
// preprocessed_data_type is literally "text_only" in the checkpoint's own
// training config for the recommended (Data-Free) run: every data path listed
// feeds through as prompts alone. rollout_mode: "simulate" / rollout_sample_type
// "ode" is DMD2's backward simulation -- the student generates its own 4-step
// rollout starting from noise, and the teacher/critic score THAT self-generated
// sample. No real or synthetic target video is ever loaded for this recipe.
// The blog names the alternative directly: "the synthetic-video runs instead
// start from forward-noised Base-H3 video-and-audio latents" -- a separate,
// non-default ablation that DOES touch Base-H3-generated video, toggled here
// for contrast.

const TEACHER = "oklch(0.62 0.03 250)"
const CRITIC = "oklch(0.60 0.15 255)"
const STUDENT = "oklch(0.55 0.16 155)"
const INPUT = "oklch(0.68 0.13 85)"

const STEPS = [999, 749, 500, 250]

export function DatafreePipeline() {
  const [mode, setMode] = useState<"datafree" | "synthetic">("datafree")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the recommended checkpoint&rsquo;s own training config</span>
        <div className="flex gap-1.5">
          {(
            [
              ["datafree", "Data-Free (recommended)"],
              ["synthetic", "Synthetic ablation"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 700 260" width={700} height={260} role="img" className="min-w-[600px] max-w-full">
            <title>
              {mode === "datafree"
                ? "Data-Free pipeline: a text prompt and pure noise feed the student, which runs a four-step backward-simulation rollout. The frozen teacher and the trainable critic both score the student's own generated samples; the difference between their scores updates the student, and the critic separately updates itself to keep tracking the student's current output distribution. No video, real or synthetic, is ever loaded."
                : "Synthetic ablation: a text prompt paired with a real Base H3-generated video is forward-noised and used as the student's rollout starting point instead of pure noise, before the same teacher/critic scoring and update loop runs."}
            </title>

            {/* input row */}
            <rect x={16} y={10} width={150} height={34} rx={6} fill={INPUT} fillOpacity={0.18} stroke={INPUT} strokeOpacity={0.5} />
            <text x={91} y={31} textAnchor="middle" fontSize={9} fill={INPUT} fontFamily="ui-monospace, monospace">
              text prompt only
            </text>

            {mode === "synthetic" && (
              <>
                <rect x={182} y={10} width={190} height={34} rx={6} fill={INPUT} fillOpacity={0.18} stroke={INPUT} strokeOpacity={0.5} />
                <text x={277} y={25} textAnchor="middle" fontSize={7.5} fill={INPUT} fontFamily="ui-monospace, monospace">
                  + Base H3-generated video,
                </text>
                <text x={277} y={36} textAnchor="middle" fontSize={7.5} fill={INPUT} fontFamily="ui-monospace, monospace">
                  forward-noised as start point
                </text>
              </>
            )}
            {mode === "datafree" && (
              <>
                <rect x={182} y={10} width={190} height={34} rx={6} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.2} />
                <text x={277} y={25} textAnchor="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  no video loaded —
                </text>
                <text x={277} y={36} textAnchor="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  pure noise start point
                </text>
              </>
            )}

            <line x1={91} y1={44} x2={91} y2={70} stroke="currentColor" strokeOpacity={0.3} markerEnd="url(#df-arrow)" />
            <line x1={277} y1={44} x2={277} y2={70} stroke="currentColor" strokeOpacity={0.3} markerEnd="url(#df-arrow)" />
            <defs>
              <marker id="df-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" fillOpacity={0.4} />
              </marker>
            </defs>

            {/* student box with 4-step rollout */}
            <rect x={16} y={72} width={356} height={54} rx={8} fill={STUDENT} fillOpacity={0.15} stroke={STUDENT} strokeOpacity={0.6} />
            <text x={30} y={92} fontSize={9.5} fill={STUDENT} fontFamily="ui-monospace, monospace">
              student (trainable, VSA-H3 sparse attention)
            </text>
            <text x={30} y={106} fontSize={7.5} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              backward-simulation rollout, 4 fixed steps:
            </text>
            <g fontFamily="ui-monospace, monospace" fontSize={7.5} fill={STUDENT}>
              {STEPS.map((s, i) => (
                <text key={s} x={280 + i * 22} y={106}>
                  {s}
                  {i < STEPS.length - 1 ? "→" : ""}
                </text>
              ))}
            </g>

            <line x1={194} y1={126} x2={194} y2={150} stroke="currentColor" strokeOpacity={0.3} markerEnd="url(#df-arrow)" />
            <text x={200} y={142} fontSize={7} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              student&rsquo;s own generated sample
            </text>

            {/* teacher + critic scoring row */}
            <rect x={16} y={152} width={168} height={44} rx={8} fill={TEACHER} fillOpacity={0.15} stroke={TEACHER} strokeOpacity={0.6} />
            <text x={100} y={170} textAnchor="middle" fontSize={9} fill={TEACHER} fontFamily="ui-monospace, monospace">
              teacher (frozen)
            </text>
            <text x={100} y={182} textAnchor="middle" fontSize={7} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              dense attention, real score
            </text>

            <rect x={204} y={152} width={168} height={44} rx={8} fill={CRITIC} fillOpacity={0.15} stroke={CRITIC} strokeOpacity={0.6} />
            <text x={288} y={170} textAnchor="middle" fontSize={9} fill={CRITIC} fontFamily="ui-monospace, monospace">
              critic (trainable)
            </text>
            <text x={288} y={182} textAnchor="middle" fontSize={7} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              dense attention, fake score
            </text>

            <line x1={100} y1={196} x2={194} y2={222} stroke={TEACHER} strokeOpacity={0.5} />
            <line x1={288} y1={196} x2={194} y2={222} stroke={CRITIC} strokeOpacity={0.5} />

            <rect x={94} y={224} width={200} height={30} rx={6} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.25} />
            <text x={194} y={243} textAnchor="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              score difference updates student
            </text>

            <path
              d="M 372 244 C 460 244, 460 99, 374 99"
              fill="none"
              stroke={STUDENT}
              strokeOpacity={0.4}
              strokeDasharray="3 3"
              markerEnd="url(#df-arrow)"
            />
            <text x={470} y={175} fontSize={7} fill={STUDENT} fillOpacity={0.7} fontFamily="ui-monospace, monospace" transform="rotate(90 470 175)">
              1 student update per 5 critic updates
            </text>

            <path
              d="M 372 174 C 430 174, 430 60, 372 60"
              fill="none"
              stroke={CRITIC}
              strokeOpacity={0.4}
              markerEnd="url(#df-arrow)"
            />
            <text x={560} y={100} fontSize={7} fill={CRITIC} fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              critic also retrains on
            </text>
            <text x={560} y={111} fontSize={7} fill={CRITIC} fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              the student&rsquo;s own samples,
            </text>
            <text x={560} y={122} fontSize={7} fill={CRITIC} fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              every step
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          All three networks — <span style={{ color: TEACHER }}>teacher</span>,{" "}
          <span style={{ color: CRITIC }}>critic</span>, and{" "}
          <span style={{ color: STUDENT }}>student</span> — start life as copies of the same
          MiniMax-H3 checkpoint. What makes the recommended checkpoint &ldquo;Data-Free&rdquo; is the
          top of the diagram, not the bottom: the training config&rsquo;s own{" "}
          <code>preprocessed_data_type</code> is literally <code>&quot;text_only&quot;</code> — every
          one of its training-data paths is reduced to prompts before training starts. The student
          generates its <em>own</em> four-step sample from noise (DMD2&rsquo;s &ldquo;backward
          simulation&rdquo;), and the teacher and critic score that self-generated sample, not a
          video anyone recorded or rendered. Toggle to the synthetic ablation and the only thing that
          changes is the starting point — a real Base-H3-generated clip, forward-noised — while the
          scoring loop underneath is identical. Neither path ever needs the H3-Base training corpus
          itself.
        </p>
      </div>
    </figure>
  )
}
