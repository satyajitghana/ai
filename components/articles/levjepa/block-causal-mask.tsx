"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Built from the released checkpoint's own modeling code
// (galilai-group/LeVJEPA-VideoMix-Large/modeling_levjepa.py, read via the HF
// API), not from the paper's prose alone -- the source is more precise about
// one detail than either the paper text or the project page's own demo.
//
// LeVJEPAModel.forward: `attn_mask = None; if self.attn_mode ==
// "block_causal": attn_mask = build_block_causal_mask(...)`. So "bidirectional"
// (attn_mode="full", the ablation in the paper's Table 2) is not a milder
// version of the causal mask -- it is NO mask at all: every token, patches
// and [cls] alike, attends to every other token symmetrically.
//
// build_block_causal_mask, read directly:
//   frame_ids = ids // tokens_per_frame
//   mask = frame_ids.unsqueeze(-1) >= frame_ids.unsqueeze(-2)   # patches only
//   full[:, :p, :] = True       # the [cls] row: attends to everything
//   full[:, p:, p:] = mask      # patches: bidirectional within frame,
//                               #          causal across frames
// The [cls] column for patch rows is left False (never set True) -- so under
// block-causal specifically, patches never attend to [cls] at all. The
// function's own docstring calls this out directly: "[cls] is the readout
// register: its row is all-True so it sees the whole clip, but its column is
// False for patches. Letting patches attend to it would route layer-l
// information about the last frame into a first-frame token at layer l+1,
// which is exactly the leak the mask exists to prevent."
//
// So [cls] is a read-only sink under block-causal, and ONLY under
// block-causal -- under "full" mode patches attend to [cls] like anything
// else, since there is no mask to exclude it. This piece's diagram makes that
// mode-dependence explicit because it's easy to assume the [cls] asymmetry is
// a fixed property of the architecture rather than something the causal mask
// specifically introduces.
//
// The accuracy numbers are the paper's own Table 2 (frozen attentive probe,
// tau=1, rho=0.95, V=4, uniform random dropping): Bidirectional 50.7, Block-
// causal 51.2 -- and config.json on the released checkpoint sets
// attn_mode: "block_causal" as the shipped default, not just a paper ablation.

type Mode = "full" | "causal"
type Query = "cls" | number // number = frame index, 0-based

const N_FRAMES = 5

function attendedFrames(mode: Mode, query: Query): Set<number> {
  if (mode === "full") return new Set(Array.from({ length: N_FRAMES }, (_, i) => i))
  if (query === "cls") return new Set(Array.from({ length: N_FRAMES }, (_, i) => i))
  const q = query
  return new Set(Array.from({ length: q + 1 }, (_, i) => i))
}

function attendsCls(mode: Mode, query: Query): boolean {
  if (mode === "full") return true
  return query === "cls" // patches never attend to [cls] under block-causal
}

const ATTEND = "oklch(0.60 0.15 255)"
const SKIP = "oklch(0.55 0 0)"
const CLS_COLOR = "oklch(0.70 0.17 40)"

export function BlockCausalMask() {
  const [mode, setMode] = useState<Mode>("causal")
  const [query, setQuery] = useState<Query>(2)

  const attended = useMemo(() => attendedFrames(mode, query), [mode, query])
  const clsAttended = attendsCls(mode, query)

  const queryLabel = query === "cls" ? "[cls]" : `frame ${query + 1} (patch token)`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          attention mask, from the checkpoint&rsquo;s own <code>build_block_causal_mask</code>
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["full", "Bidirectional"],
              ["causal", "Block-causal"],
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
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">query:</span>
          <button
            type="button"
            onClick={() => setQuery("cls")}
            aria-pressed={query === "cls"}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors",
              query === "cls" ? "border-foreground/40 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
            style={query === "cls" ? { boxShadow: `inset 0 0 0 1px ${CLS_COLOR}`, color: CLS_COLOR } : undefined}
          >
            [cls]
          </button>
          {Array.from({ length: N_FRAMES }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setQuery(i)}
              aria-pressed={query === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors",
                query === i ? "border-foreground/40 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
              style={query === i ? { boxShadow: `inset 0 0 0 1px ${ATTEND}`, color: ATTEND } : undefined}
            >
              frame {i + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg border-2 px-3 py-2"
            style={{
              borderColor: clsAttended ? CLS_COLOR : "var(--border)",
              opacity: clsAttended ? 1 : 0.35,
            }}
          >
            <span className="font-mono text-[9px] text-muted-foreground">token</span>
            <span className="font-mono text-[11px] font-medium" style={{ color: CLS_COLOR }}>
              [cls]
            </span>
          </div>

          <span className="shrink-0 font-mono text-sm text-muted-foreground">|</span>

          {Array.from({ length: N_FRAMES }, (_, i) => {
            const isAttended = attended.has(i)
            const isQuery = query === i
            return (
              <div key={i} className="flex shrink-0 flex-col items-center gap-1">
                <div
                  className="grid grid-cols-2 gap-0.5 rounded-lg border-2 p-2"
                  style={{
                    borderColor: isQuery ? "var(--foreground)" : isAttended ? ATTEND : "var(--border)",
                    opacity: isAttended || isQuery ? 1 : 0.3,
                  }}
                >
                  {Array.from({ length: 4 }, (_, j) => (
                    <span
                      key={j}
                      className="block h-2.5 w-2.5 rounded-sm"
                      style={{ background: isAttended ? ATTEND : SKIP, opacity: isAttended ? 0.85 : 0.25 }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  t{i + 1}
                  {isQuery ? " ←" : ""}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <p className="font-mono text-[11px]" style={{ color: mode === "causal" ? ATTEND : CLS_COLOR }}>
            query = {queryLabel}, {mode === "causal" ? "block-causal" : "bidirectional"} &rarr; attends to{" "}
            {mode === "full"
              ? "all 5 frames and [cls]"
              : query === "cls"
                ? "all 5 frames (its row is unconditionally true)"
                : `frames 1–${query + 1} only, never [cls]`}
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Toggle the mode and the query wanders: in{" "}
          <span style={{ color: CLS_COLOR }}>bidirectional</span> mode there is no mask object at all in the
          checkpoint&rsquo;s code — every token, <code>[cls]</code> included, attends to every other token. Switch
          to <span style={{ color: ATTEND }}>block-causal</span> and two rules appear at once: a patch query only
          ever sees frames up to and including its own, and — a detail that doesn&rsquo;t show up in the paper
          figure — no patch token attends to <code>[cls]</code> in either direction, while <code>[cls]</code>{" "}
          itself always sees the whole clip. The comment in the checkpoint&rsquo;s own source explains why: letting
          patches read <code>[cls]</code> would leak information about the last frame into a first-frame
          token&rsquo;s next-layer representation, defeating the point of the mask. None of this costs accuracy —
          Table 2 of the paper has block-causal at 51.2% ImageNet-1K attentive-probing top-1 against
          bidirectional&rsquo;s 50.7%, and <code>config.json</code> on the released checkpoint ships{" "}
          <code>attn_mode: &quot;block_causal&quot;</code> as the default, not an ablation you have to opt into.
        </p>
      </div>
    </figure>
  )
}
