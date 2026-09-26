"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One head, five schemas, measured.
//
// Every vector below is a real response from Fastino's own public playground
// (huggingface.co/spaces/fastino/gliner25-decide-playground, which runs
// fastino/GLiNER2.5-Decide on CPU through gliner2's Classifier with the
// independent decoder), fetched on 2026-09-26. Each request was sent twice and
// came back identical to the last digit, so nothing here is sampling noise.
//
// The texts are the model card's own examples. The card prints "urgency: high"
// for the compliance email and "sentiment: mixed" for the laptop review, as
// "potential outputs". Run as the card writes them, the email returns critical
// and the review returns positive at 0.998.
//
// What changes between rows is only the schema: the order of the labels, which
// other heads share the call, which labels are offered. The text never changes.
// Probabilities are as the endpoint returns them, rounded to three places.

type Variant = {
  id: string
  name: string
  schema: string
  probs: [string, number][]
}

type Case = {
  id: string
  title: string
  text: string
  card: string
  variants: Variant[]
}

const CASES: Case[] = [
  {
    id: "email",
    title: "compliance email · urgency",
    text: "From: compliance@group.example · Subject: Protocol update — action required today · Please confirm the new retention rule is applied before Friday's audit.",
    card: "high",
    variants: [
      {
        id: "alone",
        name: "urgency alone",
        schema: "{urgency: [low, normal, high, critical]}",
        probs: [
          ["low", 0.122],
          ["normal", 0.157],
          ["high", 0.386],
          ["critical", 0.334],
        ],
      },
      {
        id: "rev",
        name: "labels reversed",
        schema: "{urgency: [critical, high, normal, low]}",
        probs: [
          ["low", 0.12],
          ["normal", 0.153],
          ["high", 0.417],
          ["critical", 0.31],
        ],
      },
      {
        id: "two",
        name: "+ intent head",
        schema: "{intent: […6], urgency: [low, normal, high, critical]}",
        probs: [
          ["low", 0.112],
          ["normal", 0.141],
          ["high", 0.398],
          ["critical", 0.349],
        ],
      },
      {
        id: "three",
        name: "+ intent + route (the card's call)",
        schema: "{intent: […6], urgency: [low, normal, high, critical], route: […6]}",
        probs: [
          ["low", 0.108],
          ["normal", 0.134],
          ["high", 0.346],
          ["critical", 0.412],
        ],
      },
      {
        id: "drop",
        name: "critical not offered",
        schema: "{urgency: [low, normal, high]}",
        probs: [
          ["low", 0.17],
          ["normal", 0.227],
          ["high", 0.603],
        ],
      },
    ],
  },
  {
    id: "review",
    title: "laptop review · sentiment",
    text: "Battery dies before lunch, but the keyboard and the screen are the best I have used on a laptop.",
    card: "mixed",
    variants: [
      {
        id: "card",
        name: "the card's labels",
        schema: "{sentiment: [positive, negative, mixed, neutral]}",
        probs: [
          ["positive", 0.998],
          ["negative", 0.0],
          ["mixed", 0.001],
          ["neutral", 0.001],
        ],
      },
      {
        id: "rev",
        name: "labels reversed",
        schema: "{sentiment: [neutral, mixed, negative, positive]}",
        probs: [
          ["positive", 0.999],
          ["negative", 0.0],
          ["mixed", 0.0],
          ["neutral", 0.0],
        ],
      },
      {
        id: "aspect",
        name: "+ aspect head",
        schema: "{sentiment: […4], aspect: [battery, keyboard, screen, …]}",
        probs: [
          ["positive", 0.999],
          ["negative", 0.0],
          ["mixed", 0.0],
          ["neutral", 0.0],
        ],
      },
      {
        id: "drop",
        name: "positive not offered",
        schema: "{sentiment: [negative, mixed, neutral]}",
        probs: [
          ["negative", 0.105],
          ["mixed", 0.301],
          ["neutral", 0.594],
        ],
      },
    ],
  },
]

const PICK = "oklch(0.62 0.16 45)"
const BAR = "oklch(0.60 0.15 255)"

export function SchemaProbe() {
  const [caseId, setCaseId] = useState(CASES[0].id)
  const c = CASES.find((x) => x.id === caseId) ?? CASES[0]
  const [variantId, setVariantId] = useState(c.variants[0].id)
  const v = c.variants.find((x) => x.id === variantId) ?? c.variants[0]

  const top = v.probs.reduce((a, b) => (b[1] > a[1] ? b : a))
  const matchesCard = top[0] === c.card

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same text, different schema · measured
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          the card prints: {c.card}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CASES.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === caseId}
              onClick={() => {
                setCaseId(x.id)
                setVariantId(x.variants[0].id)
              }}
              className={pill(x.id === caseId)}
            >
              {x.title}
            </button>
          ))}
        </div>

        <p className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {c.text}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.variants.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === v.id}
              onClick={() => setVariantId(x.id)}
              className={pill(x.id === v.id)}
            >
              {x.name}
            </button>
          ))}
        </div>

        <div className="mt-2 font-mono text-[10px] text-muted-foreground">{v.schema}</div>

        <ul className="mt-3 space-y-1.5">
          {v.probs.map(([label, p]) => {
            const isTop = label === top[0]
            return (
              <li key={label} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2">
                <span
                  className="truncate font-mono text-[11px]"
                  style={{ color: isTop ? PICK : undefined }}
                >
                  {label}
                </span>
                <span className="relative h-3 overflow-hidden rounded-sm bg-muted/40">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${Math.round(p * 1000) / 10}%`,
                      background: isTop ? PICK : BAR,
                      opacity: isTop ? 0.85 : 0.45,
                    }}
                  />
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums">
                  {p.toFixed(3)}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="mt-3 font-mono text-[11px] leading-relaxed">
          <span style={{ color: PICK }}>argmax: {top[0]}</span>
          <span className="text-muted-foreground">
            {" "}
            · {matchesCard ? "matches" : "does not match"} the card&apos;s potential output
          </span>
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured on 2026-09-26 against Fastino&apos;s public playground Space, which
        serves <code>fastino/GLiNER2.5-Decide</code> on CPU with the independent
        decoder. Each request was sent twice; both replies were identical. The texts
        and label sets are the model card&apos;s own examples. FluidInference&apos;s
        conversion report, run locally on the same weights, records the same{" "}
        <code>critical</code> at 0.412 for the three-head call.
      </figcaption>
    </figure>
  )
}
