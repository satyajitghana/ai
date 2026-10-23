"use client"

// Carbon-X's DNA tokenizer, re-implemented line for line from the released
// tokenizer.py (HuggingFaceBio/Carbon-X, HybridDNATokenizer with k = 6 and
// tail = "pad_n"):
//   - the sequence is cut into non-overlapping 6-mers from its first base;
//   - a 6-mer containing anything but A/C/G/T becomes one <oov> token;
//   - the last 1-5 bases become a tail token padded with N ("CT" -> "CTNNNN").
// I ran the real tokenizer on CPU and checked these rules against it: every
// length from 1 to 13 round-trips, an N costs a whole 6-mer, and a one-base
// insertion in a 600-base sequence rewrites 52 token ids.
//
// The reference is the 55-base HBB fragment from the model card's own usage
// example; its variant there is A>T at base 20 (index 19).

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

const REF = "ATGGTGCATCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGG"
const K = 6

type Edit = "snv" | "ins1" | "del1" | "ins3" | "ins6" | "n"

const EDITS: { id: Edit; label: string; note: string }[] = [
  { id: "snv", label: "SNV", note: "one base swapped" },
  { id: "n", label: "N base", note: "one base unknown" },
  { id: "ins1", label: "+1 insertion", note: "one base added" },
  { id: "del1", label: "−1 deletion", note: "one base removed" },
  { id: "ins3", label: "+3 insertion", note: "three bases added" },
  { id: "ins6", label: "+6 insertion", note: "six bases added" },
]

function tokenize(seq: string): string[] {
  const out: string[] = []
  const full = Math.floor(seq.length / K)
  for (let i = 0; i < full; i++) {
    const kmer = seq.slice(i * K, i * K + K)
    out.push(/^[ACGT]+$/.test(kmer) ? kmer : "<oov>")
  }
  const rest = seq.slice(full * K)
  if (rest) out.push(/^[ACGT]+$/.test(rest) ? rest + "N".repeat(K - rest.length) : "<oov>")
  return out
}

function swap(base: string): string {
  return base === "A" ? "T" : base === "T" ? "A" : base === "C" ? "G" : "C"
}

function apply(edit: Edit, pos: number): string {
  const b = REF[pos]
  switch (edit) {
    case "snv":
      return REF.slice(0, pos) + swap(b) + REF.slice(pos + 1)
    case "n":
      return REF.slice(0, pos) + "N" + REF.slice(pos + 1)
    case "ins1":
      return REF.slice(0, pos) + "G" + REF.slice(pos)
    case "del1":
      return REF.slice(0, pos) + REF.slice(pos + 1)
    case "ins3":
      return REF.slice(0, pos) + "GGG" + REF.slice(pos)
    case "ins6":
      return REF.slice(0, pos) + "GGGCCC" + REF.slice(pos)
  }
}

// A variant token counts as "kept" when it is the reference token at the same
// slot, or (for slots after the edit) the reference token shifted by the
// change in token count. That is how a 6-base insertion keeps every
// downstream 6-mer: it just moves them one slot to the right.
function keptMask(ref: string[], alt: string[], editSlot: number): boolean[] {
  const d = alt.length - ref.length
  return alt.map((t, i) => {
    if (i < ref.length && ref[i] === t) return true
    if (i > editSlot && i - d >= 0 && i - d < ref.length && ref[i - d] === t) return true
    return false
  })
}

function Chip({ tok, state }: { tok: string; state: "same" | "new" | "plain" }) {
  const isTail = tok.length === K && tok.includes("N") && tok !== "<oov>" && /^[ACGT]/.test(tok)
  const real = isTail ? tok.replace(/N+$/, "") : tok
  const pad = isTail ? tok.slice(real.length) : ""
  const cls =
    state === "new"
      ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
      : tok === "<oov>"
        ? "border-red-400 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
        : "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
  return (
    <span className={"inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] leading-5 " + cls}>
      {real}
      {pad ? <span className="opacity-40">{pad}</span> : null}
    </span>
  )
}

export function KmerFrame() {
  const [edit, setEdit] = useState<Edit>("snv")
  const [pos, setPos] = useState(19)

  const { refToks, altToks, kept, alt } = useMemo(() => {
    const a = apply(edit, pos)
    const r = tokenize(REF)
    const t = tokenize(a)
    return { refToks: r, altToks: t, kept: keptMask(r, t, Math.floor(pos / K)), alt: a }
  }, [edit, pos])

  const changed = kept.filter((k) => !k).length
  const slot = Math.floor(pos / K) + 1
  const offset = (pos % K) + 1
  const meta = EDITS.find((e) => e.id === edit) ?? EDITS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        hybrid tokenizer · 6-mer frame · same rules as the released tokenizer.py
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {EDITS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEdit(e.id)}
            aria-pressed={e.id === edit}
            className={
              "rounded border px-2 py-1 text-xs " +
              (e.id === edit ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="space-y-1 border-b px-3 py-2">
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="w-28 shrink-0 font-mono">base {pos + 1} of 55</span>
          <Range
            min={0}
            max={REF.length - 1}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Position of the edit"
            className="w-full"
          />
        </label>
        <div className="font-mono text-xs text-muted-foreground">
          {meta.note} at base {pos + 1}: token slot {slot}, offset {offset} of 6
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            reference · {REF.length} bases · {refToks.length} DNA tokens
          </div>
          <div className="flex flex-wrap gap-1">
            {refToks.map((t, i) => (
              <Chip key={i} tok={t} state="plain" />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            variant · {alt.length} bases · {altToks.length} DNA tokens
          </div>
          <div className="flex flex-wrap gap-1">
            {altToks.map((t, i) => (
              <Chip key={i} tok={t} state={kept[i] ? "same" : "new"} />
            ))}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">
          {changed} of {altToks.length}
        </span>{" "}
        variant tokens are new ids the model has to read past.{" "}
        {edit === "snv" || edit === "n"
          ? "A substitution stays inside its own 6-mer."
          : edit === "ins6"
            ? "Six bases is a whole token: everything downstream keeps its id, one slot later."
            : "The reading frame shifts, so every 6-mer after the edit is a different token."}{" "}
        Faded N is tail padding; red is an out-of-vocabulary 6-mer.
      </figcaption>
    </figure>
  )
}
