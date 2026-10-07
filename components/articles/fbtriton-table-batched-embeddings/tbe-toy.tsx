"use client"

import { useMemo, useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A table-batched embedding at toy scale, laid out the way the Triton TBE in
// torchrec/distributed/triton_tbe/triton_table_batched_embeddings.py lays it
// out, so every index below means what it means in the kernel:
//
//   indices   one flat int array holding every bag of every feature
//   offsets   T*B + 1 entries, FEATURE-MAJOR: bag (t, b) is
//             indices[offsets[t*B + b] : offsets[t*B + b + 1]]
//             (forward kernel: `b_t = t * B + b`, then two loads of offsets)
//   output    [B, sum(D_t)]; feature t's pooled row lands at column
//             embedding_offset[t] of row b (`b * total_embedding_dim + ...`)
//   linear    hash_size_cumsum[t] + row, the key the backward sorts on
//             (FBGEMM's transpose_embedding_input linearizes, sorts, and
//             run-length encodes; each run is one unique (table, row))
//
// The backward tiers follow triton_tbe_backward_config.py: a run with
// segment length SL below the threshold is owned by one program and written
// with a plain store; at or above it, the run is cut into threshold-sized
// chunks whose partials are accumulated and applied once. The production
// threshold is 256 (CUDA TBE escalates at 32); here it is a slider over toy
// sizes so the split is visible.
//
// All arithmetic is integer. Nothing here reaches a transcendental, so the
// server and the browser render identical strings.

type Table = { name: string; rows: number; dim: number; tone: Tone }
type Tone = "sky" | "amber" | "emerald"

const TABLES: Table[] = [
  { name: "clicked_items", rows: 6, dim: 4, tone: "sky" },
  { name: "ad_id", rows: 5, dim: 2, tone: "amber" },
  { name: "country", rows: 4, dim: 3, tone: "emerald" },
]
const B = 3
const T = TABLES.length

// embedding_offset[t]: where feature t's pooled vector starts in an output row
const EMB_OFF = TABLES.reduce<number[]>((acc, _t, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + TABLES[i - 1].dim)
  return acc
}, [])
const TOTAL_D = EMB_OFF[T - 1] + TABLES[T - 1].dim
// hash_size_cumsum[t]: row-space offset of table t in the linearized key
const HASH_CUM = TABLES.reduce<number[]>((acc, _t, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + TABLES[i - 1].rows)
  return acc
}, [])

// Deterministic small-integer weights, so pooled sums stay readable.
function weight(t: number, r: number, d: number) {
  return ((r * 3 + d * 2 + t * 5 + 1) % 7) - 3
}
// Upstream gradient of sample b: every column of its output row is b + 1.
function dout(b: number) {
  return b + 1
}

type Bags = number[][][] // [t][b] -> list of row ids

const PRESETS: { key: string; label: string; bags: Bags; note: string }[] = [
  {
    key: "typical",
    label: "Typical batch",
    note: "Some bags are long, one is empty, and every sample shares a country.",
    bags: [
      [[1, 4, 1], [2], [4, 5]],
      [[0], [3, 3], []],
      [[2], [2], [2]],
    ],
  },
  {
    key: "hot",
    label: "One hot row",
    note: "Item 3 is in every sample's history, sometimes twice: a popular item.",
    bags: [
      [[3, 3, 0, 3], [3, 1], [3, 5, 3]],
      [[1], [4], [2]],
      [[0], [1], [3]],
    ],
  },
  {
    key: "distinct",
    label: "No duplicates",
    note: "Every lookup hits a different row. Rare in practice.",
    bags: [
      [[0, 1], [2, 3], [4, 5]],
      [[0], [1], [2]],
      [[0], [1], [2]],
    ],
  },
]

const TONE: Record<Tone, { chip: string; soft: string; text: string; ring: string }> = {
  sky: {
    chip: "bg-sky-500/20 border-sky-500/50",
    soft: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500",
  },
  amber: {
    chip: "bg-amber-500/20 border-amber-500/50",
    soft: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500",
  },
  emerald: {
    chip: "bg-emerald-500/20 border-emerald-500/50",
    soft: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500",
  },
}

type Mode = "forward" | "scatter" | "runs"

type Lookup = { pos: number; t: number; b: number; r: number; lin: number }
type Run = { lin: number; t: number; r: number; samples: number[]; grad: number }

function layout(bags: Bags) {
  const indices: Lookup[] = []
  const offsets: number[] = [0]
  for (let t = 0; t < T; t++) {
    for (let b = 0; b < B; b++) {
      for (const r of bags[t][b]) {
        indices.push({ pos: indices.length, t, b, r, lin: HASH_CUM[t] + r })
      }
      offsets.push(indices.length)
    }
  }
  return { indices, offsets }
}

function pooled(bags: Bags) {
  // out[b][col], a B x TOTAL_D matrix
  const out: number[][] = []
  for (let b = 0; b < B; b++) {
    const row = new Array<number>(TOTAL_D).fill(0)
    for (let t = 0; t < T; t++) {
      for (const r of bags[t][b]) {
        for (let d = 0; d < TABLES[t].dim; d++) row[EMB_OFF[t] + d] += weight(t, r, d)
      }
    }
    out.push(row)
  }
  return out
}

function runsOf(indices: Lookup[]): Run[] {
  // Sort by linearized key, stable on original position (radix sort is stable),
  // then run-length encode.
  const sorted = [...indices].sort((a, z) => a.lin - z.lin || a.pos - z.pos)
  const runs: Run[] = []
  for (const l of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.lin === l.lin) {
      last.samples.push(l.b)
      last.grad += dout(l.b)
    } else {
      runs.push({ lin: l.lin, t: l.t, r: l.r, samples: [l.b], grad: dout(l.b) })
    }
  }
  return runs
}

export function TbeToy() {
  const [preset, setPreset] = useState(0)
  const [mode, setMode] = useState<Mode>("forward")
  const [sel, setSel] = useState<[number, number]>([0, 0]) // (t, b)
  const [threshold, setThreshold] = useState(3)

  const bags = PRESETS[preset].bags
  const { indices, offsets } = useMemo(() => layout(bags), [bags])
  const out = useMemo(() => pooled(bags), [bags])
  const runs = useMemo(() => runsOf(indices), [indices])

  const [st, sb] = sel
  const segStart = offsets[st * B + sb]
  const segEnd = offsets[st * B + sb + 1]
  const selRows = bags[st][sb]
  const maxSL = runs.reduce((m, r) => Math.max(m, r.samples.length), 0)
  const collisions = runs.filter((r) => r.samples.length > 1)

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3 text-sm font-medium">
        A table-batched embedding at toy scale: {T} tables, batch of {B}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === i}
            onClick={() => setPreset(i)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              preset === i ? "border-foreground/60 bg-foreground/10 font-medium" : "border-border"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{PRESETS[preset].note}</p>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 text-xs">
        {(
          [
            ["forward", "Forward: pooled gather"],
            ["scatter", "Backward: naive scatter"],
            ["runs", "Backward: sort into runs"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5",
              mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The two arrays the kernel actually receives */}
      <div className="space-y-2 overflow-x-auto pb-1">
        <ArrayRow label="indices">
          {indices.map((l) => {
            const inSeg = mode === "forward" && l.pos >= segStart && l.pos < segEnd
            return (
              <Cell
                key={l.pos}
                tone={TABLES[l.t].tone}
                active={inSeg}
                dim={mode === "forward" && !inSeg}
                title={`indices[${l.pos}] = row ${l.r} of ${TABLES[l.t].name}, sample ${l.b}`}
              >
                {l.r}
              </Cell>
            )
          })}
        </ArrayRow>
        <ArrayRow label="offsets">
          {offsets.map((o, i) => {
            const t = Math.min(T - 1, Math.floor(i / B))
            const hit = mode === "forward" && (i === st * B + sb || i === st * B + sb + 1)
            return (
              <Cell
                key={i}
                tone={i === offsets.length - 1 ? undefined : TABLES[t].tone}
                active={hit}
                title={i < T * B ? `offsets[${i}]: start of bag (t=${t}, b=${i % B})` : "end sentinel"}
              >
                {o}
              </Cell>
            )
          })}
        </ArrayRow>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Feature-major: bag (t, b) is <code>indices[offsets[t·B+b] : offsets[t·B+b+1]]</code>.
        Colour is the table. {indices.length} lookups in {T * B} bags.
      </p>

      {mode === "forward" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Pick a bag:</span>
            {TABLES.map((tb, t) =>
              Array.from({ length: B }, (_, b) => (
                <button
                  key={`${t}-${b}`}
                  type="button"
                  aria-pressed={st === t && sb === b}
                  onClick={() => setSel([t, b])}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono",
                    TONE[tb.tone].chip,
                    st === t && sb === b ? "ring-2 " + TONE[tb.tone].ring : "opacity-70"
                  )}
                >
                  t{t}·b{b}
                </button>
              ))
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs">
                Table <span className={TONE[TABLES[st].tone].text}>{TABLES[st].name}</span>{" "}
                ({TABLES[st].rows} x {TABLES[st].dim})
              </div>
              <div className="space-y-0.5">
                {Array.from({ length: TABLES[st].rows }, (_, r) => {
                  const n = selRows.filter((x) => x === r).length
                  return (
                    <div key={r} className="flex items-center gap-2">
                      <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                        row {r}
                      </span>
                      <Vec
                        values={Array.from({ length: TABLES[st].dim }, (_, d) => weight(st, r, d))}
                        tone={n > 0 ? TABLES[st].tone : undefined}
                      />
                      {n > 0 && (
                        <span className="font-mono text-[11px] tabular-nums">x {n}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs">
                Output <code>[B={B}, ΣD={TOTAL_D}]</code>; bag lands at row {sb}, columns{" "}
                {EMB_OFF[st]} to {EMB_OFF[st] + TABLES[st].dim - 1}
              </div>
              <div className="space-y-0.5">
                {out.map((row, b) => (
                  <div key={b} className="flex items-center gap-2">
                    <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                      b{b}
                    </span>
                    <div className="flex gap-0.5">
                      {row.map((v, c) => {
                        const t = EMB_OFF.reduce((acc, off, i) => (c >= off ? i : acc), 0)
                        const on = b === sb && t === st
                        return (
                          <span
                            key={c}
                            className={cn(
                              "inline-flex h-6 w-7 items-center justify-center rounded border font-mono text-[11px] tabular-nums",
                              TONE[TABLES[t].tone].chip,
                              on ? "ring-2 " + TONE[TABLES[t].tone].ring : "opacity-45"
                            )}
                          >
                            {v}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {selRows.length === 0
                  ? "This bag is empty, so its slot stays zero. Jagged means a bag can hold any number of ids, including none."
                  : `Pooled sum of ${selRows.length} row${selRows.length > 1 ? "s" : ""}: ${selRows
                      .map((r) => `row ${r}`)
                      .join(" + ")}. A repeated id is simply added twice.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === "scatter" && (
        <div className="mt-4">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Run the forward in reverse: every lookup adds its sample&apos;s output gradient
            (here sample b sends b+1 to every column) into the row it read. One thread per
            lookup is the obvious kernel. Rows read more than once get several writers at
            the same address.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {TABLES.map((tb, t) => (
              <div key={t} className={cn("rounded-lg p-2", TONE[tb.tone].soft)}>
                <div className={cn("mb-1 text-xs font-medium", TONE[tb.tone].text)}>{tb.name}</div>
                {Array.from({ length: tb.rows }, (_, r) => {
                  const writers = indices.filter((l) => l.t === t && l.r === r)
                  const g = writers.reduce((s, l) => s + dout(l.b), 0)
                  return (
                    <div key={r} className="flex items-center gap-2 py-0.5 text-[11px]">
                      <span className="w-10 font-mono text-muted-foreground">row {r}</span>
                      <span className="flex flex-1 flex-wrap gap-0.5">
                        {writers.map((l) => (
                          <span
                            key={l.pos}
                            className={cn(
                              "rounded border px-1 font-mono",
                              writers.length > 1
                                ? "border-rose-500/60 bg-rose-500/15"
                                : "border-border bg-background/60"
                            )}
                          >
                            b{l.b}
                          </span>
                        ))}
                      </span>
                      <span
                        className={cn(
                          "w-14 text-right font-mono tabular-nums",
                          writers.length > 1 && "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {writers.length === 0 ? "untouched" : `g=${g}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {collisions.length === 0
              ? "No row has two writers, so a plain store per lookup would be correct. Real batches never look like this."
              : `${collisions.length} row${collisions.length > 1 ? "s have" : " has"} more than one writer (most: ${maxSL}). A plain store would keep one sample's gradient and drop the rest; atomicAdd gets the sum right but serializes on the hottest row, and an optimizer like Adagrad must run once on the finished sum, which a pile of independent atomics cannot tell you is finished.`}
          </p>
        </div>
      )}

      {mode === "runs" && (
        <div className="mt-4">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Linearize each lookup to <code>hash_size_cumsum[t] + row</code> (offsets{" "}
            {HASH_CUM.join(", ")}), sort, and run-length encode. Each run is one unique row
            and the samples that touched it. Its length is the segment length SL.
          </p>
          <label className="mb-3 flex items-center gap-3 text-xs">
            <span className="w-36 shrink-0 font-mono text-muted-foreground">long-run threshold</span>
            <Range
              min={2}
              max={6}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.currentTarget.value))}
              className="flex-1"
              aria-label="long-run threshold"
            />
            <span className="w-8 text-right font-mono tabular-nums">{threshold}</span>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">run</th>
                  <th className="py-1 pr-2 font-normal">key</th>
                  <th className="py-1 pr-2 font-normal">row</th>
                  <th className="py-1 pr-2 font-normal">samples</th>
                  <th className="py-1 pr-2 font-normal">SL</th>
                  <th className="py-1 pr-2 font-normal">grad</th>
                  <th className="py-1 font-normal">kernel</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => {
                  const sl = run.samples.length
                  const long = sl >= threshold
                  const chunks = Math.ceil(sl / threshold)
                  return (
                    <tr key={run.lin} className="border-b border-border/50 align-top">
                      <td className="py-1 pr-2 font-mono">{i}</td>
                      <td className="py-1 pr-2 font-mono tabular-nums">{run.lin}</td>
                      <td className={cn("py-1 pr-2 font-mono", TONE[TABLES[run.t].tone].text)}>
                        {TABLES[run.t].name}[{run.r}]
                      </td>
                      <td className="py-1 pr-2 font-mono">{run.samples.map((b) => `b${b}`).join(" ")}</td>
                      <td className="py-1 pr-2 font-mono tabular-nums">{sl}</td>
                      <td className="py-1 pr-2 font-mono tabular-nums">{run.grad}</td>
                      <td className="py-1">
                        {long ? (
                          <span className="text-violet-700 dark:text-violet-300">
                            long: {chunks} chunk{chunks > 1 ? "s" : ""} of ≤{threshold}, partials
                            summed, then one update
                          </span>
                        ) : (
                          <span>short: one program, plain store</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {indices.length} lookups became {runs.length} runs; the longest has SL {maxSL}. No two
            runs share a row, so a short run needs no atomics at all, and each row gets exactly
            one optimizer update. Only a run at or above the threshold is split, and only its
            chunks have to meet in a shared buffer. Production uses 256 here; CUDA TBE hands
            runs to its cooperative kernel from 32.
          </p>
        </div>
      )}
    </div>
  )
}

function ArrayRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">{children}</div>
    </div>
  )
}

function Cell({
  children,
  tone,
  active,
  dim,
  title,
}: {
  children: ReactNode
  tone?: Tone
  active?: boolean
  dim?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 font-mono text-[11px] tabular-nums",
        tone ? TONE[tone].chip : "border-border bg-muted/40",
        active && tone && "ring-2 " + TONE[tone].ring,
        active && !tone && "ring-2 ring-foreground/50",
        dim && "opacity-40"
      )}
    >
      {children}
    </span>
  )
}

function Vec({ values, tone }: { values: number[]; tone?: Tone }) {
  return (
    <span className="flex gap-0.5">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex h-6 w-7 items-center justify-center rounded border font-mono text-[11px] tabular-nums",
            tone ? TONE[tone].chip : "border-border bg-muted/30 text-muted-foreground"
          )}
        >
          {v}
        </span>
      ))}
    </span>
  )
}
