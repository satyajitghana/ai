"use client"

import { useState } from "react"

import { ATT, FigureCard, GLOBAL, IDX, Legend, Segmented, WARM } from "./shared"

// PagedAttention (Kwon 2023, vLLM). The KV cache of a sequence lives in fixed-size
// blocks that need NOT be contiguous — a per-sequence block table maps logical block →
// physical block, exactly like OS virtual memory. Two wins over reserving a contiguous
// max-length buffer per sequence: (1) near-zero fragmentation — allocate a block only
// when a token needs it; (2) two sequences can SHARE physical blocks for a common prefix
// (copy-on-write). Flip contiguous ↔ paged and grow sequence A to watch blocks allocate.

const BSIZE = 4 // tokens per KV block
const POOL = 12 // physical blocks in the pool (2 rows × 6)
const A_PHYS = [3, 6, 1, 9, 4] // paged: scattered physical blocks for A
const B_PHYS_TAIL = 8 // B's own (non-shared) block
const MAXBLK = 5 // contiguous mode reserves this many blocks per sequence

const W = 720
const H = 300
// physical grid
const PGX = 250
const PGY = 150
const PCW = 74
const PCH = 54
const pcol = (idx: number) => idx % 6
const prow = (idx: number) => Math.floor(idx / 6)
const px = (idx: number) => PGX + pcol(idx) * PCW
const py = (idx: number) => PGY + prow(idx) * PCH
// logical block chips
const lx = (k: number) => 250 + k * 66

type Mode = "paged" | "contiguous"

export function PagedKv() {
  const [mode, setMode] = useState<Mode>("paged")
  const [lenA, setLenA] = useState(10) // tokens in sequence A

  const nA = Math.max(1, Math.ceil(lenA / BSIZE))
  const nB = 3

  // physical assignment
  const aPhys = mode === "paged" ? A_PHYS.slice(0, nA) : Array.from({ length: nA }, (_, k) => k)
  const bPhys =
    mode === "paged"
      ? [aPhys[0], aPhys[1] ?? aPhys[0], B_PHYS_TAIL].slice(0, nB) // shares A's prefix
      : [MAXBLK, MAXBLK + 1, MAXBLK + 2] // its own contiguous run
  const shared = new Set(mode === "paged" ? aPhys.filter((p) => bPhys.includes(p)) : [])

  // owner of each physical block
  const owner = new Map<number, "A" | "B" | "shared" | "resA" | "resB" | "free">()
  for (let i = 0; i < POOL; i++) owner.set(i, "free")
  if (mode === "contiguous") {
    for (let i = 0; i < MAXBLK; i++) owner.set(i, i < nA ? "A" : "resA")
    for (let i = 0; i < MAXBLK; i++) owner.set(MAXBLK + i, i < nB ? "B" : "resB")
  } else {
    aPhys.forEach((p) => owner.set(p, "A"))
    bPhys.forEach((p) => owner.set(p, shared.has(p) ? "shared" : "B"))
  }

  const usedPaged = new Set([...aPhys, ...bPhys]).size
  const reserved = mode === "contiguous" ? 2 * MAXBLK : usedPaged
  const wasted = mode === "contiguous" ? 2 * MAXBLK - (nA + nB) : 0

  const fill = (o: string) =>
    o === "A" ? ATT : o === "B" ? IDX : o === "shared" ? GLOBAL : o === "resA" || o === "resB" ? WARM : "var(--muted)"

  return (
    <FigureCard label="PagedAttention · KV cache as pages">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${mode} KV memory. Sequence A uses ${nA} blocks, sequence B uses ${nB}. In paged mode blocks are non-contiguous and the shared prefix reuses physical blocks; in contiguous mode each sequence reserves ${MAXBLK} blocks and wastes ${wasted}.`}
      >
        <defs>
          <pattern id="pk-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={WARM} opacity={0.12} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={WARM} strokeWidth="2" opacity={0.5} />
          </pattern>
        </defs>

        {/* logical sequences */}
        <text x={80} y={44} className="fill-muted-foreground font-mono" fontSize={10}>
          logical blocks
        </text>
        <text x={80} y={62} className="font-mono" fontSize={11} fontWeight={600} fill={ATT}>
          seq A
        </text>
        {Array.from({ length: nA }, (_, k) => (
          <g key={k}>
            <rect x={lx(k)} y={48} width={52} height={24} rx={4} fill={ATT} opacity={0.85} />
            <text x={lx(k) + 26} y={64} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill="var(--background)">
              L{k}
            </text>
          </g>
        ))}
        <text x={80} y={102} className="font-mono" fontSize={11} fontWeight={600} fill={IDX}>
          seq B
        </text>
        {Array.from({ length: nB }, (_, k) => {
          const isShared = mode === "paged" && k < 2
          return (
            <g key={k}>
              <rect x={lx(k)} y={88} width={52} height={24} rx={4} fill={isShared ? GLOBAL : IDX} opacity={0.85} />
              <text x={lx(k) + 26} y={104} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill="var(--background)">
                L{k}
              </text>
            </g>
          )
        })}

        {/* block-table arrows: logical → physical */}
        {aPhys.map((p, k) => (
          <line
            key={`a${k}`}
            x1={lx(k) + 26}
            y1={72}
            x2={px(p) + PCW / 2 - 8}
            y2={py(p)}
            stroke={ATT}
            strokeWidth={1}
            opacity={0.3}
            className="transition-all duration-300"
          />
        ))}
        {bPhys.map((p, k) => (
          <line
            key={`b${k}`}
            x1={lx(k) + 26}
            y1={112}
            x2={px(p) + PCW / 2 + 8}
            y2={py(p)}
            stroke={shared.has(p) ? GLOBAL : IDX}
            strokeWidth={1}
            opacity={0.3}
            className="transition-all duration-300"
          />
        ))}

        {/* physical KV memory grid */}
        <text x={PGX} y={PGY - 12} className="fill-muted-foreground font-mono" fontSize={10}>
          physical KV blocks (the pool)
        </text>
        {Array.from({ length: POOL }, (_, idx) => {
          const o = owner.get(idx)!
          const isRes = o === "resA" || o === "resB"
          return (
            <g key={idx}>
              <rect
                x={px(idx) + 3}
                y={py(idx) + 3}
                width={PCW - 6}
                height={PCH - 8}
                rx={5}
                fill={isRes ? "url(#pk-hatch)" : fill(o)}
                opacity={o === "free" ? 0.35 : isRes ? 1 : 0.85}
                stroke={o === "shared" ? GLOBAL : "transparent"}
                strokeWidth={1.5}
                className="transition-all duration-300"
              />
              <text x={px(idx) + PCW / 2} y={py(idx) + PCH / 2} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill={o === "free" || isRes ? "var(--muted-foreground)" : "var(--background)"}>
                {o === "free" ? "·" : o === "resA" || o === "resB" ? "reserved" : o === "shared" ? "shared" : o}
              </text>
              <text x={px(idx) + 6} y={py(idx) + 13} className="fill-muted-foreground/60 font-mono" fontSize={7}>
                {idx}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">layout</span>
          <Segmented
            value={mode}
            color={mode === "paged" ? ATT : WARM}
            onChange={setMode}
            options={[
              { id: "paged", label: "paged (vLLM)" },
              { id: "contiguous", label: "contiguous" },
            ]}
          />
        </div>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>seq A length</span>
            <span className="tabular-nums text-foreground">{lenA} tok · {nA} blk</span>
          </span>
          <input
            type="range"
            min={1}
            max={MAXBLK * BSIZE}
            value={lenA}
            onChange={(e) => setLenA(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: ATT }}
          />
        </label>
        <div className="ml-auto font-mono text-[10px] text-muted-foreground">
          reserved <span className="text-foreground">{reserved}</span> blk · wasted{" "}
          <span style={{ color: wasted > 0 ? WARM : ATT }}>{wasted}</span>
        </div>
      </div>

      <Legend
        items={[
          { color: ATT, label: "seq A block" },
          { color: IDX, label: "seq B block" },
          { color: GLOBAL, label: "shared prefix (COW)" },
          { color: WARM, label: "reserved / wasted" },
          { color: "var(--muted)", label: "free" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Before paging, a serving engine reserved one contiguous buffer per request, sized to the maximum output length —
        so a short generation left most of its reservation <span style={{ color: WARM }}>wasted</span> (internal
        fragmentation), and two requests could not share anything. <span style={{ color: ATT }}>PagedAttention</span>{" "}
        breaks the cache into fixed blocks and a block table, so memory is handed out one block at a time and a common
        prompt prefix maps to the <span style={{ color: GLOBAL }}>same physical blocks</span> via copy-on-write. This is
        the memory manager, not the math — the same attention runs on top, but a GPU now fits many more concurrent
        sequences.
      </p>
    </FigureCard>
  )
}
