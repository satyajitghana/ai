"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The leaked 27B as an isometric layer stack, every slab coloured by what we
// can actually say about it.
//
//   measured     read in code or in the text of the merged PR itself
//   reasoned     carried over from Qwen3.8-27B's config by arithmetic that
//                the PR text is consistent with, but does not state
//   unconfirmed  nothing public says
//
// The projection is a fixed 30-degree isometric: the two multipliers below are
// cos 30 and sin 30 written as constants, so no trig reaches the DOM and the
// server and the browser serialise identical coordinates.

type Status = "measured" | "reasoned" | "unconfirmed"

const COLOR: Record<Status, string> = {
  measured: "oklch(0.60 0.15 155)",
  reasoned: "oklch(0.72 0.15 75)",
  unconfirmed: "oklch(0.62 0.02 260)",
}
const LABEL: Record<Status, string> = {
  measured: "Measured",
  reasoned: "Reasoned",
  unconfirmed: "Unconfirmed",
}

type Part = {
  id: string
  name: string
  status: Status
  value: string
  why: string
}

const PARTS: Part[] = [
  {
    id: "head",
    name: "MTP draft head, replayed",
    status: "measured",
    value: "draft = 4 tokens, batch 1",
    why: "The PR text says it covers “MTP draft=4/B1”. Qwen3.8-27B ships one MTP layer (mtp_num_hidden_layers 1), so four drafts means that one layer is run four times: reasoned. The draft count itself is read straight from the PR.",
  },
  {
    id: "lm",
    name: "LM head",
    status: "reasoned",
    value: "5,120 → 248,320",
    why: "Both numbers are Qwen3.8-27B's config.json. Nothing in the PR text names a vocabulary, so this is carried over, not read.",
  },
  {
    id: "qsa",
    name: "QSA attention (1 layer in 4)",
    status: "measured",
    value: "Q12 / KV2 per rank at TP2",
    why: "The PR text adds a versioned local Q12/KV2 path for Qwen4 at TP2 and keeps the older Q3 and Q6 paths. Q12/KV2 per rank is 24 query and 4 KV heads in total, exactly Qwen3.8-27B. The selector constants (block size 4, budget 2,048, 4 index heads of width 128) are measured from Flash-Next's config and vLLM's tests, and only reasoned for the 27B.",
  },
  {
    id: "gdn",
    name: "Gated DeltaNet (3 layers in 4)",
    status: "measured",
    value: "BA 96 at TP1, 48 at TP2",
    why: "The PR text names GDN projections and BA48/96 paths. Qwen3.8-27B has 48 value heads, so its b and a projections are 96 wide at TP1 and 48 at TP2: the leaked numbers fit, which is reasoned, not stated.",
  },
  {
    id: "mlp",
    name: "Dense MLP",
    status: "reasoned",
    value: "5,120 → 17,408 → 5,120",
    why: "The post says dense. The PR text says “dense” too. The intermediate width is Qwen3.8-27B's, carried over.",
  },
  {
    id: "hc",
    name: "Hyper-connection lanes",
    status: "measured",
    value: "H5120 with HC",
    why: "The PR text lists “Qwen4 H5120/dense HC” with FP8 dual projections. Flash-Next's config has hc_count 4 and hc_lowrank 320, and vLLM's HC kernel tests hard-code four. That the dense model also has four lanes is reasoned.",
  },
  {
    id: "emb",
    name: "Token embedding",
    status: "reasoned",
    value: "248,320 × 5,120",
    why: "Carried over from Qwen3.8-27B. Flash-Next also has a 51B-parameter N-gram table; whether the dense model does is unconfirmed.",
  },
  {
    id: "rel",
    name: "Release, name, layer count",
    status: "unconfirmed",
    value: "64 layers? Qwen4?",
    why: "No public source gives a release date, a final name or a layer count for a dense Qwen4-27B. 64 is Qwen3.8-27B's. The PR is titled qwen4-27b; the vLLM code calls the architecture Qwen4Exp and ships it as Qwen3.8-Flash-Next.",
  },
]

const COS = 0.866
const SIN = 0.5

type P = [number, number, number]
const proj = ([x, y, z]: P, s: number, ox: number, oy: number): string => {
  const sx = (x - y) * COS * s + ox
  const sy = (x + y) * SIN * s - z * s + oy
  return `${Math.round(sx * 100) / 100},${Math.round(sy * 100) / 100}`
}

// An axis-aligned box as three visible faces.
function Slab({
  x,
  y,
  z,
  w,
  d,
  h,
  color,
  dashed,
  s,
  ox,
  oy,
  active,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  color: string
  dashed?: boolean
  s: number
  ox: number
  oy: number
  active: boolean
}) {
  const top = [
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ] as P[]
  const left = [
    [x, y + d, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x, y + d, z],
  ] as P[]
  const right = [
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x + w, y, z],
  ] as P[]
  const pts = (f: P[]) => f.map((p) => proj(p, s, ox, oy)).join(" ")
  const common = {
    stroke: active ? "var(--foreground)" : "var(--border)",
    strokeWidth: active ? 1.6 : 0.8,
    strokeDasharray: dashed ? "3 2" : undefined,
  }
  return (
    <g>
      <polygon points={pts(left)} fill={color} fillOpacity={0.55} {...common} />
      <polygon points={pts(right)} fill={color} fillOpacity={0.4} {...common} />
      <polygon points={pts(top)} fill={color} fillOpacity={0.85} {...common} />
    </g>
  )
}

export function EvidenceStack() {
  const [sel, setSel] = useState<string>("qsa")
  const [drafts, setDrafts] = useState(4)
  const [lanes, setLanes] = useState(4)

  const part = PARTS.find((p) => p.id === sel) ?? PARTS[0]
  const c = (id: string) => COLOR[(PARTS.find((p) => p.id === id) ?? PARTS[0]).status]
  const isU = (id: string) => (PARTS.find((p) => p.id === id) ?? PARTS[0]).status === "unconfirmed"

  const S = 10
  const OX = 330
  const OY = 40
  // One repeating unit (3 GDN + 1 QSA), shown once, with lane strips under it.
  const W = 22
  const D = 14
  const laneD = D / Math.max(lanes, 1)

  const slabs: { id: string; z: number; h: number; label: string }[] = [
    { id: "emb", z: 0, h: 1.2, label: "embedding" },
    { id: "gdn", z: 4, h: 1.2, label: "GDN" },
    { id: "gdn", z: 6.2, h: 1.2, label: "GDN" },
    { id: "gdn", z: 8.4, h: 1.2, label: "GDN" },
    { id: "qsa", z: 10.6, h: 1.6, label: "QSA" },
    { id: "lm", z: 15, h: 1.2, label: "LM head" },
  ]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {(Object.keys(COLOR) as Status[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: COLOR[k] }}
              aria-hidden
            />
            {LABEL[k]}
          </span>
        ))}
        <span className="text-muted-foreground">Click a slab or a name below.</span>
      </div>

      <svg
        viewBox="0 0 660 330"
        role="img"
        aria-label={`Isometric stack of the leaked 27B: embedding, one repeating unit of three Gated DeltaNet layers and one QSA layer with ${lanes} parallel residual lanes underneath, LM head, and an MTP head replayed ${drafts} times. Each slab is coloured by evidence status.`}
        className="h-auto w-full"
      >
        {/* residual lanes: a floor of parallel strips under the repeating unit */}
        {Array.from({ length: lanes }, (_, i) => (
          <g
            key={i}
            onClick={() => setSel("hc")}
            style={{ cursor: "pointer" }}
            data-lane={i}
          >
            <Slab
              x={0}
              y={i * laneD}
              z={2}
              w={W}
              d={laneD * 0.82}
              h={0.7}
              color={c("hc")}
              dashed={lanes !== 4}
              s={S}
              ox={OX}
              oy={OY + 110}
              active={sel === "hc"}
            />
          </g>
        ))}
        {slabs.map((sl, i) => (
          <g
            key={i}
            onClick={() => setSel(sl.id)}
            style={{ cursor: "pointer" }}
            opacity={sl.id === "emb" || sl.id === "lm" ? 1 : 1}
          >
            <Slab
              x={sl.id === "emb" || sl.id === "lm" ? 3 : 1.5}
              y={sl.id === "emb" || sl.id === "lm" ? 2 : 1}
              z={sl.z}
              w={sl.id === "emb" || sl.id === "lm" ? W - 6 : W - 3}
              d={sl.id === "emb" || sl.id === "lm" ? D - 4 : D - 2}
              h={sl.h}
              color={c(sl.id)}
              dashed={isU(sl.id)}
              s={S}
              ox={OX}
              oy={OY + 110}
              active={sel === sl.id}
            />
          </g>
        ))}
        {/* MTP draft head: one small slab, replayed as a column of copies */}
        {Array.from({ length: drafts }, (_, i) => (
          <g key={i} onClick={() => setSel("head")} style={{ cursor: "pointer" }}>
            <Slab
              x={24}
              y={3}
              z={i * 1.9 + 4}
              w={7}
              d={7}
              h={1.2}
              color={c("head")}
              s={S}
              ox={OX}
              oy={OY + 110}
              active={sel === "head"}
            />
          </g>
        ))}
        <text x={30} y={26} fontSize="11" fill="var(--muted-foreground)">
          x16 units in Qwen3.8-27B (64 layers)
        </text>
        <text x={30} y={42} fontSize="11" fill="var(--muted-foreground)">
          one unit drawn
        </text>
        <text x={500} y={300} fontSize="11" fill="var(--muted-foreground)">
          {`MTP layer x ${drafts}`}
        </text>
        <text x={210} y={300} fontSize="11" fill="var(--muted-foreground)">
          {`${lanes} residual lanes`}
        </text>
      </svg>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0">MTP drafts: {drafts}</span>
          <Range
            min={1}
            max={4}
            step={1}
            value={drafts}
            onChange={(e) => setDrafts(Number(e.target.value))}
            aria-label="MTP draft tokens"
          />
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0">Residual lanes: {lanes}</span>
          <Range
            min={1}
            max={4}
            step={1}
            value={lanes}
            onChange={(e) => setLanes(Number(e.target.value))}
            aria-label="Residual lanes"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p.id)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              sel === p.id ? "border-foreground bg-muted" : "border-border",
            )}
            style={{ borderLeft: `4px solid ${COLOR[p.status]}` }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div
        className="mt-3 rounded-lg border border-border p-3 text-sm"
        style={{ borderLeft: `4px solid ${COLOR[part.status]}` }}
      >
        <div className="font-medium">
          {part.name} <span className="text-muted-foreground">· {LABEL[part.status]}</span>
        </div>
        <div className="mt-0.5 font-mono text-xs">{part.value}</div>
        <p className="mt-1.5 leading-snug text-muted-foreground">{part.why}</p>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Slab heights are not to scale. The lanes under the unit are the
        hyper-connection streams; the right-hand column is the one MTP layer
        replayed once per draft token.
      </figcaption>
    </figure>
  )
}
