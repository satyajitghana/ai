"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Seven of the paper's instantiations, read from arXiv 2609.20800v1 Table 2
// (adapter, backbone, d; K x r), Tables 3, 4, 6, 9 and Figures 3, 4, 6 (the
// reported metric against the matched monolithic JEPA), plus what this site
// found in the released checkpoints on the Hugging Face dataset
// Gen-Verse/jepa-anything (file sizes from the Hub API, tensor shapes and
// condition numbers read from the pickles without executing them).
// The OPF block in the middle is drawn identically for every domain on
// purpose: it is the only part the paper claims is shared.

const ACCENT = "oklch(0.58 0.14 285)"
const SHARED = "oklch(0.62 0.12 160)"

type Domain = {
  key: string
  tab: string
  raw: string
  adapter: string
  encoder: string
  target: string
  opf: string
  k: number
  readout: string
  metric: string
  base: string
  ours: string
  better: "lower" | "higher"
  release: string
}

const DOMAINS: Domain[] = [
  {
    key: "vision", tab: "vision",
    raw: "MuJoCo scenes", adapter: "patches + 2-D position", encoder: "DINOv3 ViT-S",
    target: "masked patch states", opf: "384; 4×96", k: 4, readout: "binding probe",
    metric: "INJ held-out-cell accuracy (Table 3)", base: ".572", ours: ".581", better: "higher",
    release: "Shapes3D checkpoints, a 192-wide ViT on 64×64 images, 13.4 MB: not the Table 3 backbones",
  },
  {
    key: "cell", tab: "single cell",
    raw: "sparse expression", adapter: "gene id + binned value", encoder: "scGPT",
    target: "complete cell state", opf: "512; 4×128", k: 4, readout: "cluster / decode",
    metric: "PBMC zero-shot AvgBIO vs Cell-JEPA (Table 4)", base: "0.7194", ours: "0.7752", better: "higher",
    release: "Norman perturbation checkpoint, 419.2 MB",
  },
  {
    key: "clinical", tab: "clinical",
    raw: "patient records", adapter: "timed events + labs", encoder: "GPT-2 small",
    target: "future patient state", opf: "768; 4×192", k: 4, readout: "risk decoder",
    metric: "mean PRAUC over 1,000+ events (Figure 3)", base: "0.711", ours: "0.718", better: "higher",
    release: "no checkpoint yet; the dataset card lists it as a progressive release",
  },
  {
    key: "pong", tab: "interventions",
    raw: "Pong frames", adapter: "pixels + intervention", encoder: "MLP, 4,096 inputs",
    target: "next state", opf: "160; 5×32", k: 5, readout: "pixel decoder",
    metric: "single-intervention MSE (Figure 4)", base: "0.009541", ours: "0.006218", better: "lower",
    release: "five-seed six-step checkpoints; their card reports 0.00952107 vs 0.00682598",
  },
  {
    key: "fields", tab: "fields + weather",
    raw: "gridded field", adapter: "flattened field", encoder: "3-layer MLP",
    target: "next field", opf: "128; 4×32", k: 4, readout: "field decoder",
    metric: "PDEBench Burgers step-1 MSE (Table 6)", base: "0.001830", ours: "0.001101", better: "lower",
    release: "WeatherBench2: 6,144-number input, 3.5M online parameters, 20.8 MB",
  },
  {
    key: "loco", tab: "locomotion",
    raw: "state + action", adapter: "17-d state", encoder: "MLP to 32-d",
    target: "future control state", opf: "32; 4×8", k: 4, readout: "CEM planner",
    metric: "paired CEM return difference (Figure 6)", base: "Hopper −1.24", ours: "HalfCheetah +10.26", better: "higher",
    release: "HalfCheetah checkpoint, 2.9 MB, projector orthogonal to float precision",
  },
  {
    key: "mol", tab: "molecules",
    raw: "atoms + velocities", adapter: "species + positions", encoder: "O(3)-equivariant",
    target: "future configuration", opf: "64; 4×16", k: 4, readout: "100-step rollout",
    metric: "paracetamol 100-step RMSD, Å (Table 9)", base: "1.868", ours: "1.776", better: "lower",
    release: "a 3.1 MB TiTo/PaiNN checkpoint, not the TrajCast-style backbone of Table 9",
  },
]

function Node({ x, y, w, title, sub, stroke }: { x: number; y: number; w: number; title: string; sub: string; stroke: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={56} rx={9} fill="var(--background)" stroke={stroke} strokeWidth={1.5} filter="url(#da-soft)" />
      <text x={x + w / 2} y={y + 23} textAnchor="middle" className="fill-foreground text-[12px] font-medium">{title}</text>
      <text x={x + w / 2} y={y + 41} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">{sub}</text>
    </g>
  )
}

function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return <path d={`M ${x1} ${y} C ${x1 + 10} ${y}, ${x2 - 10} ${y}, ${x2} ${y}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#da-arrow)" />
}

export function DomainAtlas() {
  const [key, setKey] = useState(DOMAINS[0].key)
  const d = DOMAINS.find((x) => x.key === key) ?? DOMAINS[0]
  const bars = Array.from({ length: d.k }, (_, i) => i)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one recipe, seven pipelines</span>
        <span className="font-mono text-[10px]">
          <span style={{ color: ACCENT }}>domain-specific</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span style={{ color: SHARED }}>shared OPF core</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Domain">
          {DOMAINS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === key}
              onClick={() => setKey(x.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                x.key === key && "bg-muted/40 text-foreground"
              )}>
              {x.tab}
            </button>
          ))}
        </div>

        <svg viewBox="0 0 760 210" className="w-full" role="img"
          aria-label={`Pipeline for ${d.tab}: ${d.raw} through ${d.adapter} and ${d.encoder} into the shared orthogonal predictive factorization core with ${d.opf}, then ${d.readout}.`}>
          <defs>
            <marker id="da-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="da-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <Node x={6} y={70} w={128} title="raw input" sub={d.raw} stroke={ACCENT} />
          <Arrow x1={136} x2={156} y={98} />
          <Node x={158} y={70} w={150} title="adapter A_δ" sub={d.adapter} stroke={ACCENT} />
          <Arrow x1={310} x2={330} y={98} />
          <Node x={332} y={70} w={128} title="encoder" sub={d.encoder} stroke={ACCENT} />
          <Arrow x1={462} x2={482} y={98} />

          {/* shared core */}
          <g>
            <rect x={484} y={20} width={140} height={156} rx={10} fill="var(--background)" stroke={SHARED} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={554} y={38} textAnchor="middle" className="text-[11px] font-medium" fill={SHARED}>OPF core</text>
            <text x={554} y={53} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">d; K×r = {d.opf}</text>
            {bars.map((i) => {
              const h = 92 / d.k - 4
              const y = 64 + i * (92 / d.k)
              return (
                <g key={`${d.key}-${i}`}>
                  <rect x={500} y={y} width={52} height={h} rx={3} fill={SHARED} opacity={0.18 + 0.12 * i} />
                  <text x={526} y={y + h / 2 + 3.5} textAnchor="middle" className="fill-foreground font-mono text-[9px]">q{i + 1}</text>
                  <path d={`M 554 ${y + h / 2} C 572 ${y + h / 2}, 580 120, 596 120`} fill="none" stroke={SHARED} strokeWidth={1} opacity={0.7} />
                </g>
              )
            })}
            <rect x={590} y={104} width={26} height={32} rx={4} fill="var(--background)" stroke={SHARED} strokeWidth={1.5} />
            <text x={603} y={124} textAnchor="middle" className="font-mono text-[9px]" fill={SHARED}>ẑ</text>
            <text x={554} y={168} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">EMA target · pinv synthesis</text>
          </g>

          <Arrow x1={626} x2={644} y={98} />
          <Node x={646} y={70} w={108} title="readout" sub={d.readout} stroke={ACCENT} />
          <text x={380} y={196} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            context → target: {d.target}
          </text>
        </svg>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="text-[12.5px] leading-5 text-muted-foreground">
            <span className="text-foreground">{d.metric}</span>
            <span className="ml-1 font-mono text-[10px]">({d.better} is better, reported)</span>
          </div>
          <div className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {d.key === "loco" ? "worst" : "matched JEPA"} <span className="text-foreground">{d.base}</span>
          </div>
          <div className="font-mono text-[12px] tabular-nums" style={{ color: ACCENT }}>
            {d.key === "loco" ? "best" : "JEPA-Anything"} {d.ours}
          </div>
        </div>
        <p className="mt-2 rounded-lg border bg-muted/10 px-3 py-2 text-[12.5px] leading-5 text-muted-foreground">
          <span className="font-mono text-[10px] text-foreground">released weights, measured:</span>{" "}
          {d.release}
        </p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Pick a domain. Everything drawn in purple changes: the input, the adapter that turns it into
          tokens, the encoder family, the readout. The green block is drawn the same every time
          because it is the paper&rsquo;s actual claim: an EMA target, K projectors, K small predictors and
          a pseudoinverse that stitches their outputs back into one state. Only its widths change. Every
          domain trains its own weights.
        </p>
      </div>
    </figure>
  )
}
