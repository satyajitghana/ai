"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why a "complete" connectome still leaves most detected connections unusable.
// A synaptic connection is only analysable when the neuron on BOTH sides of it
// is proofread. If a fraction p of presynapses and a fraction q of postsynapses
// sit on proofread neurons, and the two are roughly independent, about p x q of
// connections are usable. The paper says connection completeness is
// "approximately equivalent to the product" and reports 94% / 42% / 40.1% for
// the male CNS. Only + - * / and Math.round are used, which are exact in
// IEEE 754, so the server render and the client agree to the last digit.

const DETECTED_POST_MILLIONS = 312 // postsynapses detected (Berg et al., Cell 2026)

type Cell = "both" | "pre" | "post" | "none"

const COLORS: Record<Cell, string> = {
  both: "oklch(0.62 0.15 205)",
  pre: "oklch(0.72 0.15 75)",
  post: "oklch(0.62 0.19 10)",
  none: "var(--muted)",
}

const LABELS: Record<Cell, string> = {
  both: "both sides proofread: usable",
  pre: "presynaptic side only",
  post: "postsynaptic side only",
  none: "neither side",
}

export function CompletenessGrid() {
  const [pre, setPre] = useState(94)
  const [post, setPost] = useState(42)

  const both = Math.round((pre * post) / 100)
  const preOnly = Math.round((pre * (100 - post)) / 100)
  const postOnly = Math.round(((100 - pre) * post) / 100)
  const none = 100 - both - preOnly - postOnly
  const counts: [Cell, number][] = [
    ["both", both],
    ["pre", preOnly],
    ["post", postOnly],
    ["none", none],
  ]
  const cells: Cell[] = counts.flatMap(([c, n]) => Array.from({ length: Math.max(0, n) }, () => c))

  const product = (pre * post) / 100
  const usableMillions = Math.round((DETECTED_POST_MILLIONS * pre * post) / 1000) / 10
  const isPaper = pre === 94 && post === 42

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        100 detected connections: how many can you actually use?
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-[auto_1fr]">
        <div
          className="grid w-[210px] grid-cols-10 gap-[3px] self-start"
          role="img"
          aria-label={`${both} of 100 connections usable, ${preOnly} with only the presynaptic side proofread, ${postOnly} with only the postsynaptic side, ${none} with neither`}
        >
          {cells.map((c, i) => (
            <span key={i} className="aspect-square rounded-[3px]" style={{ background: COLORS[c] }} />
          ))}
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="flex justify-between font-mono text-[12px]">
              <span className="text-muted-foreground">presynaptic completeness</span>
              <span className="tabular-nums text-foreground">{pre}%</span>
            </span>
            <Range
              min={50}
              max={100}
              step={1}
              value={pre}
              onChange={(e) => setPre(Number(e.target.value))}
              aria-label="presynaptic completeness, percent"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[12px]">
              <span className="text-muted-foreground">postsynaptic completeness</span>
              <span className="tabular-nums text-foreground">{post}%</span>
            </span>
            <Range
              min={10}
              max={100}
              step={1}
              value={post}
              onChange={(e) => setPost(Number(e.target.value))}
              aria-label="postsynaptic completeness, percent"
              className="mt-1 w-full"
            />
          </label>

          <ul className="space-y-1 font-mono text-[11px]">
            {counts.map(([c, n]) => (
              <li key={c} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm border" style={{ background: COLORS[c] }} aria-hidden />
                <span className="text-muted-foreground">{LABELS[c]}</span>
                <span className="ml-auto tabular-nums text-foreground">{n}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-md bg-muted/60 px-3 py-2 font-mono text-[12px] leading-5">
            <div>
              connection completeness &asymp; {pre}% &times; {post}% ={" "}
              <span className="font-medium text-foreground">{product.toFixed(1)}%</span>
            </div>
            <div className="text-muted-foreground">
              of 312M detected postsynapses, about {usableMillions.toFixed(1)}M land between two proofread neurons
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPre(94)
              setPost(42)
            }}
            aria-pressed={isPaper}
            className={cn(
              "cursor-pointer rounded px-2 py-1 font-mono text-[11px] transition-colors",
              isPaper ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"
            )}
          >
            the male CNS: 94% and 42%
          </button>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground">
        The product is an approximation the paper itself uses. Measured directly, the male CNS reports
        40.1% connection completeness and 124.2M connections between proofread neurons; 94% &times; 42%
        gives 39.5% and about 123M. The paper&rsquo;s explanation for the gap between the sides:
        presynapses sit on larger-calibre neurites, which segmentation and proofreading merge more easily.
      </figcaption>
    </figure>
  )
}
