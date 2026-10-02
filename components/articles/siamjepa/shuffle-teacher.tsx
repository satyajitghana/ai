"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Random Shuffle Teacher (RST), made tangible. Built from the method as the
// paper describes it and the code implements it:
//
//   models_siamjepa.py  forward_encoder():
//     x = x + self.pos_embed[:, 1:, :]        # position added FIRST
//     if self.shuffle_teacher:
//         x, _, _ = self.random_masking(x, mask_ratio=0.0)   # permute, keep all
//     ... transformer blocks ...
//
//   forward():
//     src_z, _, _ = self.ema_model.forward_encoder(src_imgs, mask_ratio=0)   # teacher = full image
//     loss_sim2 = (2 - 2 * cos(student_pred[i], teacher_z[i]))  on masked slots
//
// The target the student is scored against is the teacher's token sitting at
// slot i. With RST on, the teacher's tokens were permuted *after* their true
// positional embedding was added, so slot i now holds some other patch's
// representation -- a different patch on every forward pass. The widget shows
// why that changes what each token has to encode: with an ordered teacher a
// model can win by learning a fixed position -> content map (a spatial
// shortcut); once the target is scrambled, the only stable way to predict it
// is for each token to be recognisable by WHAT it is, not WHERE it sits.
//
// The two position-decodability numbers (~94% without RST, ~19% with it) are
// the paper's own measured probe (Table 3, ViT-B/16, KL=0.01, wd=0.1,
// mask_ratio=0.75); chance is 1/196 ~ 0.51%. They are from the pre-bug-fix RST
// run, so the magnitudes are provisional -- the direction is the mechanism.

// A tiny 6x6 "image": a single foreground object on background.
// 0 = background, 1 = object body, 2 = object centre.
const GRID = 6
const N = GRID * GRID
const IMAGE: number[] = [
  0, 0, 1, 1, 0, 0,
  0, 1, 2, 2, 1, 0,
  1, 2, 2, 2, 2, 1,
  1, 2, 2, 2, 2, 1,
  0, 1, 2, 2, 1, 0,
  0, 0, 1, 1, 0, 0,
]

const FILL: Record<number, string> = {
  0: "oklch(0.80 0.07 230)", // background (sky)
  1: "oklch(0.74 0.14 70)", //  object body (amber)
  2: "oklch(0.56 0.16 45)", //  object centre (burnt amber)
}
const CONTENT_NAME: Record<number, string> = { 0: "background", 1: "object edge", 2: "object centre" }

// A deterministic starting permutation, so server and client render the same
// grid (no Math.random at render time). A fixed step-13 rotation (gcd(13,36)=1)
// is a full-cycle scramble that is reproducible.
function initialPerm(): number[] {
  return Array.from({ length: N }, (_, i) => (i * 13 + 7) % N)
}

function randomPerm(): number[] {
  const p = Array.from({ length: N }, (_, i) => i)
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return p
}

type Mode = "ordered" | "shuffled"

export function ShuffleTeacher() {
  const [mode, setMode] = useState<Mode>("shuffled")
  const [perm, setPerm] = useState<number[]>(initialPerm)
  const [slot, setSlot] = useState<number>(14) // a centre patch by default

  // identity for the ordered teacher, the scramble for RST
  const identity = useMemo(() => Array.from({ length: N }, (_, i) => i), [])
  const active = mode === "ordered" ? identity : perm

  // which source patch the teacher is showing at the selected slot
  const sourcePatch = active[slot]
  const sameContent = IMAGE[sourcePatch] === IMAGE[slot]

  const Cell = ({
    contentId,
    label,
    on,
    ring,
    onClick,
  }: {
    contentId: number
    label?: string
    on: boolean
    ring: boolean
    onClick?: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={onClick ? `slot ${label}, showing ${CONTENT_NAME[contentId]}` : undefined}
      className={cn(
        "relative aspect-square rounded-[3px]",
        onClick && "cursor-pointer transition-transform hover:scale-[1.08]"
      )}
      style={{
        background: FILL[contentId],
        opacity: on ? 1 : 0.9,
        boxShadow: ring ? "0 0 0 2px var(--foreground)" : "inset 0 0 0 1px oklch(0 0 0 / 0.08)",
      }}
    >
      {label ? (
        <span className="absolute bottom-[1px] right-[2px] font-mono text-[7px] leading-none text-black/45">
          {label}
        </span>
      ) : null}
    </button>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Random Shuffle Teacher &mdash; what each token must encode
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["ordered", "Ordered teacher"],
              ["shuffled", "Shuffled teacher (RST)"],
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

      <div className="p-3 sm:p-5">
        <div className="flex flex-wrap items-start justify-center gap-5 sm:gap-8">
          {/* The image, at true positions */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">image patches (true grid)</span>
            <div className="grid w-[150px] grid-cols-6 gap-[3px] sm:w-[168px]">
              {IMAGE.map((c, i) => (
                <Cell
                  key={i}
                  contentId={c}
                  label={String(i)}
                  on={true}
                  ring={i === slot}
                  onClick={() => setSlot(i)}
                />
              ))}
            </div>
            <span className="max-w-[168px] text-center text-[10px] text-muted-foreground">
              click a patch to pick slot <span className="font-mono text-foreground">{slot}</span>
            </span>
          </div>

          <div className="hidden select-none self-center font-mono text-xl text-muted-foreground sm:block">
            &rarr;
          </div>

          {/* The teacher target grid */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              teacher target {mode === "ordered" ? "(ordered)" : "(shuffled)"}
            </span>
            <div className="grid w-[150px] grid-cols-6 gap-[3px] sm:w-[168px]">
              {active.map((src, i) => (
                <Cell key={i} contentId={IMAGE[src]} on={true} ring={i === slot} onClick={() => setSlot(i)} />
              ))}
            </div>
            {mode === "shuffled" ? (
              <button
                type="button"
                onClick={() => setPerm(randomPerm())}
                className="cursor-pointer rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                new sample &mdash; re-shuffle
              </button>
            ) : (
              <span className="max-w-[168px] text-center text-[10px] text-muted-foreground">
                slot i carries patch i, every sample
              </span>
            )}
          </div>
        </div>

        {/* Readout */}
        <div className="mx-auto mt-5 max-w-[560px] rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <p className="mb-1.5">
            <span className="font-mono text-xs text-muted-foreground">target at slot {slot}:</span>{" "}
            teacher is showing{" "}
            <span className="font-medium" style={{ color: FILL[IMAGE[sourcePatch]] }}>
              {CONTENT_NAME[IMAGE[sourcePatch]]}
            </span>{" "}
            {mode === "ordered" ? (
              <>from patch {slot} itself.</>
            ) : (
              <>from patch {sourcePatch} &mdash; a different patch than the one at slot {slot}.</>
            )}
          </p>
          {mode === "ordered" ? (
            <p className="text-muted-foreground">
              Position {slot} always carries the same content. A model can minimise the loss with a fixed
              position-to-content lookup &mdash; a spatial shortcut. Each token only has to encode{" "}
              <span className="font-medium text-foreground">where it sits</span>.
            </p>
          ) : (
            <p className="text-muted-foreground">
              {sameContent ? (
                <>
                  This sample happened to land matching content here, but that will not hold next sample.{" "}
                </>
              ) : null}
              No stable position-to-content map exists: the target at slot {slot} changes every forward
              pass. The only way to predict it is for each token to be recognisable by{" "}
              <span className="font-medium text-foreground">what it is</span> &mdash; object-level
              semantics, not position.
            </p>
          )}
        </div>

        {/* Position-decodability bar (paper, Table 3) */}
        <div className="mx-auto mt-4 flex max-w-[560px] items-center gap-3">
          <span className="w-[150px] shrink-0 font-mono text-[10px] text-muted-foreground">
            patch-token position decodable
          </span>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: mode === "ordered" ? "94%" : "19%",
                background: mode === "ordered" ? "oklch(0.62 0.15 150)" : "oklch(0.60 0.17 30)",
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">
            {mode === "ordered" ? "~94%" : "~19%"}
          </span>
        </div>
        <p className="mx-auto mt-1.5 max-w-[560px] text-center text-[10px] text-muted-foreground">
          probe of a frozen token&rsquo;s own grid position, chance 0.51% (paper, Table 3; pre-fix RST, provisional)
        </p>
      </div>
    </figure>
  )
}
