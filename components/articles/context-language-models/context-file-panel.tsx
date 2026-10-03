"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// A deep-research task streamed as a fixed sequence of operations, replayed
// two ways: a fixed "summarize at a threshold" harness that can only append or
// compact wholesale, and a CLM that treats its context as a file and edits it
// in place (prune, offload, note). At each step we show the live context, a
// running token count, and a running "prefix-reuse compute" number computed
// with a small cost model (documented below, matched to the article's prose) —
// it is an illustration of the mechanism, not a reproduction of the paper's
// measured BrowseComp-Plus numbers.
//
// Cost model (per turn): the server reuses the longest matching prefix, so it
// re-prefills only the tokens after the first edit (`reprefill`), decodes the
// generated tokens, and pays attention over the live context. We charge
//   cost = TOK * (reprefill + gen) + ATTN * live
// in illustrative units. A summarize edits near the start, so `reprefill` is
// large; an in-place CLM edit keeps the live context small, so both terms stay
// small. Only +, -, *, / and Math.round/min/max are used — all exact, so no
// lib/dmath wrappers are needed (see CLAUDE.md).

const FIX = "oklch(0.63 0.19 25)" // red — the fixed harness
const CLM = "oklch(0.60 0.15 255)" // blue — the CLM

const TOK = 1 // per re-prefilled / generated token
const ATTN = 0.08 // per live token, each turn (attention is paid over all of it)

type Lane = {
  // live context tokens after this op
  live: number
  // tokens re-prefilled this op (after the first edit point)
  reprefill: number
  // tokens generated this op
  gen: number
  // one-line description of what happened to the file
  act: string
  // the context file after this op, as a few short lines
  file: string[]
  // does the live context still hold the needle (docid 58939)?
  needle: boolean
}

type Op = {
  name: string
  incoming: string
  fix: Lane
  clm: Lane
}

// The needle — the exact id the final answer needs — is buried in the first
// search results (op 1). Both lanes have it at first. The fixed harness keeps
// it verbatim until it crosses its 8K budget and summarizes, at which point the
// gist drops the exact id. The CLM extracts it into a one-line note on op 1 and
// never loses it.
const OPS: Op[] = [
  {
    name: "task arrives",
    incoming: "Find who won the 2011 Kader Asmal Excellence Award.",
    fix: {
      live: 120, reprefill: 0, gen: 40, act: "append",
      file: ["[task] find 2011 Kader Asmal winner"],
      needle: false,
    },
    clm: {
      live: 120, reprefill: 0, gen: 60, act: "create context.md",
      file: ["[task] find 2011 Kader Asmal winner", "[notes] (empty)"],
      needle: false,
    },
  },
  {
    name: "search → 8 long results",
    incoming: "8 result blocks, ~3,000 tokens; the answer is buried in result 6.",
    fix: {
      live: 3120, reprefill: 0, gen: 120, act: "append all 8",
      file: ["[task] …", "[search] 8 full result blocks (~3,000 tok)", "  …result 6: James Gallagher, docid 58939…"],
      needle: true,
    },
    clm: {
      live: 300, reprefill: 180, gen: 220, act: "loop: prune 8 → 1 line, note the hit",
      file: ["[task] …", "[search] 8 results → 1 line each", "[notes] candidate: James Gallagher, docid 58939"],
      needle: true,
    },
  },
  {
    name: "get_document → 9,000-token page",
    incoming: "A full source page, ~9,000 tokens, needed only to confirm one date.",
    fix: {
      live: 12120, reprefill: 0, gen: 120, act: "append (now over 8K budget)",
      file: ["[task] …", "[search] 3,000 tok", "[page] 9,000-token document", "  …docid 58939…"],
      needle: true,
    },
    clm: {
      live: 360, reprefill: 60, gen: 180, act: "offload page → doc1.md, keep a pointer",
      file: ["[task] …", "[search] pruned", "[notes] James Gallagher, docid 58939", "[ref] see doc1.md for the page"],
      needle: true,
    },
  },
  {
    name: "budget hit → compact, then search again",
    incoming: "Live context exceeded 8K, so the harness must make room before the next search.",
    fix: {
      live: 3900, reprefill: 900, gen: 160, act: "summarize everything before the last turn",
      file: ["[summary] searched the award; a 2011 recipient exists; see sources", "[search] 8 new results (~3,000 tok)"],
      needle: false,
    },
    clm: {
      live: 520, reprefill: 180, gen: 200, act: "loop: prune the new results too",
      file: ["[task] …", "[notes] James Gallagher, docid 58939", "[ref] doc1.md", "[search] pruned to 1 line each"],
      needle: true,
    },
  },
  {
    name: "answer",
    incoming: "Report the recipient and the docid that grounds it.",
    fix: {
      live: 4100, reprefill: 0, gen: 90, act: "answer from a lossy summary",
      file: ["[summary] a 2011 recipient exists; exact id not retained", "[answer] name uncertain — docid lost in compaction"],
      needle: false,
    },
    clm: {
      live: 600, reprefill: 0, gen: 90, act: "answer from the note",
      file: ["[notes] James Gallagher, docid 58939", "[answer] James Gallagher (docid 58939)"],
      needle: true,
    },
  },
]

function stepCost(lane: Lane): number {
  return TOK * (lane.reprefill + lane.gen) + ATTN * lane.live
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`
}

function LaneCard({
  title,
  color,
  lane,
  cumCost,
  peakLive,
}: {
  title: string
  color: string
  lane: Lane
  cumCost: number
  peakLive: number
}) {
  const barPct = Math.min(100, (lane.live / 12120) * 100)
  return (
    <div className="rounded-md border p-3" style={{ borderColor: color }}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {title}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px]",
            lane.needle ? "bg-foreground/10 text-foreground" : "bg-destructive/15 text-destructive"
          )}
        >
          docid 58939: {lane.needle ? "kept" : "lost"}
        </span>
      </div>

      <div className="mt-2 font-mono text-[11px] text-muted-foreground">{lane.act}</div>

      <div className="mt-2 space-y-0.5 rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-foreground/80">
        {lane.file.map((line, i) => (
          <div key={i} className="truncate">
            {line}
          </div>
        ))}
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>live context</span>
          <span className="text-foreground">{fmt(lane.live)} tok</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground">
        <div>
          peak live <span className="text-foreground">{fmt(peakLive)}</span>
        </div>
        <div className="text-right">
          cum. compute <span className="text-foreground">{fmt(cumCost)}</span> u
        </div>
      </div>
    </div>
  )
}

export function ContextFilePanel() {
  const [step, setStep] = useState(OPS.length - 1)

  const op = OPS[step]
  // cumulative compute and peak live up to and including the current step
  let fixCum = 0
  let clmCum = 0
  let fixPeak = 0
  let clmPeak = 0
  for (let i = 0; i <= step; i++) {
    fixCum += stepCost(OPS[i].fix)
    clmCum += stepCost(OPS[i].clm)
    fixPeak = Math.max(fixPeak, OPS[i].fix.live)
    clmPeak = Math.max(clmPeak, OPS[i].clm.live)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one deep-research task · context as a file vs a fixed harness</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 rounded-md border bg-muted/30 p-2.5 font-mono text-[11px]">
          <span className="text-muted-foreground">op {step + 1}/{OPS.length} · </span>
          <span className="font-semibold text-foreground">{op.name}</span>
          <div className="mt-1 text-muted-foreground">{op.incoming}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LaneCard title="fixed harness (summarize)" color={FIX} lane={op.fix} cumCost={fixCum} peakLive={fixPeak} />
          <LaneCard title="CLM (edits the file)" color={CLM} lane={op.clm} cumCost={clmCum} peakLive={clmPeak} />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>step through the task</span>
            <span className="text-foreground">op {step + 1}</span>
          </div>
          <Range
            min={0}
            max={OPS.length - 1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={CLM}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Step through the operations. The fixed harness can only append, then
          compact wholesale when it crosses its 8K budget — so its live context
          sawtooths up to <span className="text-foreground">12.1k</span> tokens,
          and the one summary it is forced to take drops the exact{" "}
          <code>docid 58939</code> the answer needs. The CLM treats the context
          as a file: it prunes eight search results to one line each, offloads
          the 9,000-token page to <code>doc1.md</code> behind a pointer, and
          writes the id into a note on the turn it first sees it. Its live
          context stays under <span className="text-foreground">600</span>{" "}
          tokens and the needle never leaves. Cumulative compute (illustrative
          units) tracks the same gap: re-prefilling a large summarized context
          costs far more than re-prefilling a short edited one.
        </p>
      </div>
    </figure>
  )
}
