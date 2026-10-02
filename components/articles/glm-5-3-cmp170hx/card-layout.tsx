"use client"

import { useState } from "react"

// TP4 vs PP4 on four CMP 170HX cards. Both run the same W4A16 weights, the same
// DFlash2 drafter and the same sm_80 sparse-attention kernels; they differ only
// in how the 45-layer model is cut across the four cards, and that choice is
// decided by the PCIe link width.
//
// All numbers are REPORTED (self-measured by the recipe's author, release 1.6.0,
// structured workload, peer-to-peer off, 180 W/card, PCIe x16 links). Nothing
// here is re-run. See the README "Headline numbers" and docs/results.md.
//
// No transcendentals reach the DOM: the SVG is laid out with integer
// coordinates and + - * / only, identical on server and client.

type LayoutId = "tp4" | "pp4"

type Layout = {
  id: LayoutId
  name: string
  hold: string
  one: number // 1-user streaming decode, structured, tok/s
  eight: number // 8-user aggregate, structured, tok/s
  prefill: number // cold prefill, tok/s
  kv: number // KV pool at 262,144 context, tokens
  traffic: string
  links: string
}

const LAYOUTS: Record<LayoutId, Layout> = {
  tp4: {
    id: "tp4",
    name: "Tensor-parallel 4",
    hold: "a quarter of every layer",
    one: 394,
    eight: 798,
    prefill: 2669,
    kv: 1072150,
    traffic: "~9.4 MB per layer in prefill, ~100 small collectives per decode step",
    links: "needs PCIe x16",
  },
  pp4: {
    id: "pp4",
    name: "Pipeline-parallel 4",
    hold: "a quarter of the layers",
    one: 235,
    eight: 623,
    prefill: 6580,
    kv: 1914216,
    traffic: "activations only, once per stage",
    links: "built for x4 links",
  },
}

const C_CARD = "oklch(0.62 0.13 255)"
const C_KERNEL = "oklch(0.72 0.14 85)"
const C_BUS = "oklch(0.63 0.21 25)"
const C_FLOW = "oklch(0.68 0.13 165)"

// four card boxes in a row
const W = 640
const H = 196
const CARD_W = 118
const CARD_H = 72
const GAP = 24
const ROW_X = (W - (4 * CARD_W + 3 * GAP)) / 2
const CARD_Y = 44
const cx = (i: number) => ROW_X + i * (CARD_W + GAP)

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-base tabular-nums text-foreground">{value}</div>
      {sub ? <div className="font-mono text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export function CardLayout() {
  const [id, setId] = useState<LayoutId>("tp4")
  const L = LAYOUTS[id]
  const isTp = id === "tp4"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Four CMP 170HX cards, one 320B model: two ways to cut it
        </span>
        <div className="flex gap-1.5">
          {(["tp4", "pp4"] as LayoutId[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={id === k}
              onClick={() => setId(k)}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors " +
                (id === k
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40")
              }
            >
              {k === "tp4" ? "TP4" : "PP4"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${L.name}: each card holds ${L.hold}. The sm_80 sparse-attention kernel runs on every card. Traffic between cards is ${L.traffic}; ${L.links}.`}
        >
          <text x={ROW_X} y={24} fontSize={12} className="font-mono" fill="var(--foreground)">
            {L.name}
            <tspan fill="var(--muted-foreground)">{`  — each card holds ${L.hold}`}</tspan>
          </text>

          {/* the bus / pipeline between cards */}
          {isTp ? (
            <>
              <line
                x1={cx(0) + CARD_W / 2}
                x2={cx(3) + CARD_W / 2}
                y1={CARD_Y + CARD_H + 26}
                y2={CARD_Y + CARD_H + 26}
                stroke={C_BUS}
                strokeWidth={3}
              />
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1={cx(i) + CARD_W / 2}
                  x2={cx(i) + CARD_W / 2}
                  y1={CARD_Y + CARD_H}
                  y2={CARD_Y + CARD_H + 26}
                  stroke={C_BUS}
                  strokeWidth={2}
                />
              ))}
              <text
                x={W / 2}
                y={CARD_Y + CARD_H + 42}
                textAnchor="middle"
                fontSize={10.5}
                fill={C_BUS}
                className="font-mono"
              >
                all-reduce every layer — bus-bound without x16
              </text>
            </>
          ) : (
            <>
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <line
                    x1={cx(i) + CARD_W}
                    x2={cx(i + 1)}
                    y1={CARD_Y + CARD_H / 2}
                    y2={CARD_Y + CARD_H / 2}
                    stroke={C_FLOW}
                    strokeWidth={2.4}
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              ))}
              <defs>
                <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={C_FLOW} />
                </marker>
              </defs>
              <text
                x={W / 2}
                y={CARD_Y + CARD_H + 42}
                textAnchor="middle"
                fontSize={10.5}
                fill={C_FLOW}
                className="font-mono"
              >
                activations hop stage to stage — light on the bus
              </text>
            </>
          )}

          {/* the four cards */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={cx(i)}
                y={CARD_Y}
                width={CARD_W}
                height={CARD_H}
                rx={7}
                fill="var(--background)"
                stroke={C_CARD}
                strokeWidth={1.6}
              />
              <text
                x={cx(i) + CARD_W / 2}
                y={CARD_Y + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--foreground)"
                className="font-mono"
              >
                {isTp ? `GPU ${i}` : `stage ${i}`}
              </text>
              <text
                x={cx(i) + CARD_W / 2}
                y={CARD_Y + 33}
                textAnchor="middle"
                fontSize={9}
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {isTp ? "¼ of every layer" : "¼ of the layers"}
              </text>
              {/* sparse-attention kernel badge */}
              <rect
                x={cx(i) + 12}
                y={CARD_Y + CARD_H - 24}
                width={CARD_W - 24}
                height={16}
                rx={4}
                fill={C_KERNEL}
                opacity={0.9}
              />
              <text
                x={cx(i) + CARD_W / 2}
                y={CARD_Y + CARD_H - 12}
                textAnchor="middle"
                fontSize={8.5}
                fill="#1a1400"
                className="font-mono"
              >
                sm_80 sparse-MLA
              </text>
            </g>
          ))}
        </svg>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="1 user" value={`${L.one} tok/s`} sub="structured decode" />
          <Stat label="8 users" value={`${L.eight} tok/s`} sub="aggregate" />
          <Stat label="cold prefill" value={`${L.prefill.toLocaleString("en-US")} tok/s`} />
          <Stat label="KV pool" value={`${(L.kv / 1_000_000).toFixed(2)}M`} sub={`${L.kv.toLocaleString("en-US")} tok`} />
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">{L.links}.</span>{" "}
          Traffic between cards: {L.traffic}. TP4 gives one interactive user the fastest answer;
          PP4 reads prompts {(6580 / 2669).toFixed(1)}x faster and holds {(1914216 / 1072150).toFixed(2)}x the KV,
          so it wins for long prompts, many users and the stock x4 bus.
        </p>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        All figures reported (release 1.6.0, structured workload, peer-to-peer off, 180 W/card, x16
        links; measured by the recipe&rsquo;s author, not re-run here). PP4&rsquo;s numbers were taken on
        x16 cards; its x4 behaviour &mdash; the case it exists for &mdash; is not yet measured.
      </figcaption>
    </figure>
  )
}
