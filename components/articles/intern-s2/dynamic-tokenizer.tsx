"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Intern-S2's dynamic tokenizer, drawn as two divergent paths from one raw input.
// A standard BPE vocabulary was learned on natural-language text: hand it a SMILES
// string, a protein sequence, or a waveform and it shreds them into subword pieces
// that cross the boundaries that actually carry meaning (a benzene ring, a residue,
// a sample's magnitude). Intern-S2's tokenizer emits scientifically-meaningful units
// natively, so each atom / residue / sample stays a token the model can address.
// Pick a modality; the top node fans down to the two tokenizations. Illustrative.

const ACCENT = "oklch(0.62 0.14 165)"

type Key = "molecule" | "protein" | "seismic"

const MODALITIES: Record<
  Key,
  {
    label: string
    raw: string
    note: string
    native: string[]
    nativeNote: string
    bpe: string[]
    bpeNote: string
  }
> = {
  molecule: {
    label: "molecule",
    raw: "CC(=O)Oc1ccccc1C(=O)O",
    note: "aspirin · SMILES",
    native: ["C", "C", "(=O)", "O", "c1ccccc1", "C", "(=O)", "O"],
    nativeNote: "atoms, carbonyls and the benzene ring stay whole",
    bpe: ["CC", "(=", "O)O", "c1cc", "ccc", "1C(", "=O)", "O"],
    bpeNote: "the aromatic ring c1ccccc1 is split across 3 tokens",
  },
  protein: {
    label: "protein",
    raw: "MKTAYIAK",
    note: "amino-acid sequence",
    native: ["M", "K", "T", "A", "Y", "I", "A", "K"],
    nativeNote: "one token per residue — each stays addressable",
    bpe: ["MK", "TAY", "IA", "K"],
    bpeNote: "residues merge across boundaries; identity is lost",
  },
  seismic: {
    label: "seismic",
    raw: "0.02 -0.15 0.88 -1.20 0.34",
    note: "waveform samples",
    native: ["0.02", "-0.15", "0.88", "-1.20", "0.34"],
    nativeNote: "each sample is one value-aware token",
    bpe: ["0", ".", "02", " -", "0", ".", "15", " 0", ".", "88", "…"],
    bpeNote: "magnitude dissolves into digit-and-punctuation soup",
  },
}

// scene geometry (viewBox units)
const W = 720
const H = 244
const SRC_Y = 20
const SRC_H = 34
const LABEL_X = 18
const LABEL_W = 78
const PILL_X = LABEL_X + LABEL_W + 14
const PILL_H = 26
const NATIVE_Y = 120 // row center
const BPE_Y = 198 // row center
const GAP = 7

const pillW = (t: string) => Math.max(22, t.length * 7 + 14)

function layout(tokens: string[]) {
  let x = PILL_X
  return tokens.map((t) => {
    const w = pillW(t)
    const item = { t, x, w }
    x += w + GAP
    return item
  })
}

export function DynamicTokenizer() {
  const [key, setKey] = useState<Key>("molecule")
  const m = MODALITIES[key]

  const srcW = Math.max(150, m.raw.length * 6.9 + 26)
  const srcX = W / 2 - srcW / 2
  const fanX = W / 2
  const fanY = SRC_Y + SRC_H

  const nativePills = layout(m.native)
  const bpePills = layout(m.bpe)

  // fan from the source bottom to the right edge of each label pill; the deeper
  // target descends more vertically first so its curve tucks below the accent row
  const curve = (ty: number) =>
    `M ${fanX} ${fanY} C ${fanX} ${fanY + (ty - fanY) * 0.6}, ${LABEL_X + LABEL_W + 54} ${ty}, ${LABEL_X + LABEL_W + 2} ${ty}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">dynamic tokenizer · one input, two vocabularies</span>
        <div className="flex gap-1">
          {(Object.keys(MODALITIES) as Key[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              aria-pressed={key === k}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                key === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={key === k ? { background: ACCENT } : undefined}
            >
              {MODALITIES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${m.label} input tokenized natively into ${m.native.length} meaningful units by Intern-S2, versus ${m.bpe.length} subword fragments by a standard BPE tokenizer`}
        >
          <defs>
            <marker id="dt-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="dt-arr-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="dt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* fan connectors (behind nodes) */}
          <path d={curve(NATIVE_Y)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#dt-arr)" opacity={0.75} />
          <path d={curve(BPE_Y)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#dt-arr-m)" opacity={0.6} />

          {/* source node */}
          <rect x={srcX} y={SRC_Y} width={srcW} height={SRC_H} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#dt-soft)" />
          <text x={W / 2} y={SRC_Y + 15} textAnchor="middle" className="fill-foreground font-mono" fontSize={11.5} fontWeight={600}>{m.raw}</text>
          <text x={W / 2} y={SRC_Y + 28} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{m.note}</text>

          {/* native path */}
          <rect x={LABEL_X} y={NATIVE_Y - PILL_H / 2} width={LABEL_W} height={PILL_H} rx={7} fill={ACCENT} fillOpacity={0.14} stroke={ACCENT} strokeWidth={1.5} />
          <text x={LABEL_X + LABEL_W / 2} y={NATIVE_Y + 3.5} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill={ACCENT}>Intern-S2</text>
          {nativePills.map((p, i) => (
            <g key={`n${i}`}>
              <rect x={p.x} y={NATIVE_Y - PILL_H / 2} width={p.w} height={PILL_H} rx={6} fill={ACCENT} fillOpacity={0.9} stroke={ACCENT} strokeWidth={1.5} filter="url(#dt-soft)" />
              <text x={p.x + p.w / 2} y={NATIVE_Y + 3.5} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--background)">{p.t}</text>
            </g>
          ))}

          {/* bpe path */}
          <rect x={LABEL_X} y={BPE_Y - PILL_H / 2} width={LABEL_W} height={PILL_H} rx={7} fill="var(--muted)" fillOpacity={0.4} stroke="var(--border)" strokeWidth={1.5} />
          <text x={LABEL_X + LABEL_W / 2} y={BPE_Y + 3.5} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10} fontWeight={600}>BPE</text>
          {bpePills.map((p, i) => (
            <g key={`b${i}`}>
              <rect x={p.x} y={BPE_Y - PILL_H / 2} width={p.w} height={PILL_H} rx={6} fill="var(--muted)" fillOpacity={0.55} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
              <text x={p.x + p.w / 2} y={BPE_Y + 3.5} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>{p.t}</text>
            </g>
          ))}
        </svg>

        {/* readout */}
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Intern-S2 dynamic tokenizer</div>
            <div className="font-medium" style={{ color: ACCENT }}>{m.native.length} meaningful tokens</div>
            <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{m.nativeNote}</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">standard BPE tokenizer</div>
            <div className="font-medium text-foreground">{m.bpe.length} subword fragments</div>
            <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{m.bpeNote}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A BPE vocabulary learned on natural-language text has no reason to respect a
          chemical bond, a residue, or a sample&apos;s magnitude. It splits where its merge
          statistics say to split, so the units that carry scientific meaning end up{" "}
          <span className="text-foreground">smeared across token boundaries</span>. Intern-S2&apos;s
          tokenizer emits those units directly — the difference between a model that <em>sees</em> a
          molecule and one that sees a string that happens to look like one.
        </p>
      </div>
    </figure>
  )
}
