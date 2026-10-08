"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One frozen LLM, two jobs. Ten toy chunks each carry two pooled key vectors
// (the paper's L_p = 7, shrunk to 2) in a five-dimensional toy space, and the
// question becomes two pooled query vectors (the paper's G = 4, shrunk to 2).
// Scores are MaxSim: for each query vector, the best dot product against the
// chunk's vectors, summed. Every vector here is invented to make the mechanism
// visible; none is read from a model.
//
// The BM25 toggle reproduces the shape of the paper's biggest ablation: with
// the top BM25 chunks in front of the question, the retrieval tokens can see
// the bridge entity (Ansel Moore) and the second hop ranks; without them the
// query is about lighthouses and instruments in general, and a violin wins.
//
// The cost panel uses real constants: hidden sizes from each backbone's
// config.json, L_p = 7 and 21M chunks from the paper, and the break-even
// lengths of the paper's Table 6. Arithmetic is + - * / and toFixed only.

type Vec = [number, number, number, number, number] // lighthouse, Moore, music, sea, town

const CHUNKS: { id: string; text: string; keys: [Vec, Vec]; gold?: boolean }[] = [
  { id: "c1", text: "The lighthouse on Kell Point is kept by Ansel Moore.", keys: [[0.9, 0.5, 0, 0.1, 0], [0.3, 0.8, 0, 0, 0.1]], gold: true },
  { id: "c2", text: "Mira Moore, Ansel's sister, plays the cello in the harbour band.", keys: [[0, 0.8, 0.3, 0, 0], [0, 0.2, 0.9, 0, 0.1]], gold: true },
  { id: "c3", text: "The harbour band rehearses on Thursdays.", keys: [[0, 0, 0.6, 0.2, 0.4], [0, 0, 0.1, 0.3, 0.5]] },
  { id: "c4", text: "Kell Point's lighthouse was painted red in spring.", keys: [[0.9, 0, 0, 0.1, 0.3], [0.2, 0, 0, 0, 0.6]] },
  { id: "c5", text: "A ferry crosses to the mainland twice a day.", keys: [[0, 0, 0, 0.9, 0.2], [0, 0, 0, 0.2, 0.3]] },
  { id: "c6", text: "Ansel repairs fishing nets in winter.", keys: [[0, 0.6, 0, 0.4, 0], [0, 0.1, 0, 0.5, 0.2]] },
  { id: "c7", text: "The bakery on Quay Street sells rye bread.", keys: [[0, 0, 0, 0, 0.9], [0, 0, 0, 0, 0.4]] },
  { id: "c8", text: "A violin was found in the old customs house.", keys: [[0, 0, 1.05, 0, 0.3], [0, 0, 0.1, 0.2, 0.5]] },
  { id: "c9", text: "Storms close the ferry for a week each March.", keys: [[0, 0, 0, 0.8, 0.1], [0, 0, 0, 0.2, 0.2]] },
  { id: "c10", text: "The school choir sings at the lighthouse fete.", keys: [[0.5, 0, 0.5, 0, 0.2], [0.1, 0, 0.2, 0, 0.4]] },
]

const QUESTION = "What instrument does the lighthouse keeper's sister play?"

// Query vectors read at the retrieval-token positions. With BM25 context the
// tokens have already seen "Ansel Moore", so both groups lean on the name.
const Q_PLAIN: [Vec, Vec] = [[0.8, 0.1, 0.1, 0, 0], [0.1, 0.15, 0.8, 0, 0]]
const Q_BM25: [Vec, Vec] = [[0.6, 0.6, 0, 0, 0], [0, 0.6, 0.7, 0, 0]]
// BM25 over the question's words: "lighthouse" is the only rare term that matches.
const BM25_TOP = ["c1", "c4"]

const BACKBONES = [
  { name: "Qwen3.5-4B", d: 2560, attn: 8, star5: 0, star10: 0 },
  { name: "Qwen3.5-35B-A3B", d: 2048, attn: 10, star5: 4117, star10: 5569 },
  { name: "Nemotron-3.5-Lightning", d: 2688, attn: 6, star5: 6321, star10: 8471 },
  { name: "Muse-Glimmer-30B", d: 6656, attn: 13, star5: 13049, star10: 17437 },
]

const LENGTHS = [8, 16, 32, 64, 128, 256] // thousands of tokens
const CHUNK_TOKENS = 141

function dot(a: Vec, b: Vec) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4]
}

function maxsim(q: [Vec, Vec], k: [Vec, Vec]) {
  let s = 0
  for (const qq of q) {
    const a = dot(qq, k[0])
    const b = dot(qq, k[1])
    s += a > b ? a : b
  }
  return s
}

function commas(n: number) {
  const s = String(Math.round(n))
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ","
    out += s[i]
  }
  return out
}

const ACCENT = "oklch(0.58 0.13 150)"
const WARN = "oklch(0.6 0.15 40)"

export function SelectorExplorer() {
  const [mode, setMode] = useState<"corpus" | "context">("corpus")
  const [bm25, setBm25] = useState(true)
  const [n, setN] = useState(2)
  const [bb, setBb] = useState(2)
  const [lenIdx, setLenIdx] = useState(4)

  const q = bm25 ? Q_BM25 : Q_PLAIN
  const scored = CHUNKS.map((c, i) => ({ ...c, i, s: maxsim(q, c.keys) }))
  const ranked = [...scored].sort((a, b) => b.s - a.s || a.i - b.i)
  const picked = new Set(ranked.slice(0, n).map((c) => c.id))
  const goldFound = CHUNKS.filter((c) => c.gold && picked.has(c.id)).length
  // Corpus mode hands chunks to the generator in score order; the paper's
  // long-context setting reassembles them in original document order.
  const handed = mode === "corpus" ? ranked.slice(0, n) : scored.filter((c) => picked.has(c.id))
  const maxS = ranked[0].s

  const B = BACKBONES[bb]
  const params = 65 * B.d + B.attn
  const perChunkKB = (7 * B.d * 2) / 1024
  const indexGB = (21e6 * 7 * B.d * 2) / 1e9
  const ctxK = LENGTHS[lenIdx]
  const ctxTokens = ctxK * 1024
  const nChunks = ctxTokens / CHUNK_TOKENS
  const genTokens = n * CHUNK_TOKENS
  const star = n <= 5 ? B.star5 : B.star10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one frozen model, two scales of selection</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy vectors; the cost panel uses real constants</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          {(["corpus", "context"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                mode === m ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground",
              )}
            >
              {m === "corpus" ? "corpus index" : "in-context selection"}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => setBm25(!bm25)}
            aria-pressed={bm25}
            className={cn(
              "rounded-md border px-2.5 py-1 transition-colors",
              bm25 ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-dashed text-muted-foreground",
            )}
          >
            BM25 context C0: {bm25 ? "on" : "off"}
          </button>
          <label className="ml-auto flex items-center gap-2 text-muted-foreground">
            top-n <span className="w-3 tabular-nums text-foreground">{n}</span>
            <Range min={1} max={5} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} accent={ACCENT} className="w-28" aria-label="number of chunks selected" />
          </label>
        </div>

        <div className="rounded-lg border bg-background/60 p-3 font-mono text-[11px] leading-5">
          <div className="text-muted-foreground">retrieval input, one forward pass through all layers</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {bm25 &&
              BM25_TOP.map((id) => (
                <span key={id} className="rounded border border-dashed px-1.5 text-muted-foreground">
                  BM25 {id}
                </span>
              ))}
            <span className="rounded border px-1.5">{QUESTION}</span>
            <span className="rounded px-1.5 text-white" style={{ background: ACCENT }}>
              ρ1 … ρ64
            </span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            read the residual stream at the 64 ρ positions in every full-attention layer, mix the layers with α, pool into
            groups: here 2 toy query vectors
          </div>
        </div>

        <div className="grid gap-1.5">
          {scored.map((c) => {
            const on = picked.has(c.id)
            const w = maxS > 0 ? (c.s / maxS) * 100 : 0
            return (
              <div
                key={c.id}
                className={cn(
                  "grid grid-cols-[2.2rem_1fr_3.2rem] items-center gap-2 rounded-md border px-2 py-1 text-[11.5px] sm:grid-cols-[2.2rem_1fr_9rem_3.2rem]",
                  on ? "border-foreground/40" : "opacity-70",
                )}
                style={on ? { boxShadow: `inset 3px 0 0 ${ACCENT}` } : undefined}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {c.id}
                  {c.gold ? "*" : ""}
                </span>
                <span className={cn(on ? "text-foreground" : "text-muted-foreground")}>{c.text}</span>
                <span className="hidden h-2 rounded bg-muted sm:block">
                  <span className="block h-2 rounded" style={{ width: `${w.toFixed(1)}%`, background: on ? ACCENT : "var(--muted-foreground)" }} />
                </span>
                <span className="text-right font-mono tabular-nums">{c.s.toFixed(2)}</span>
              </div>
            )
          })}
          <div className="font-mono text-[10px] text-muted-foreground">
            * the two chunks a complete answer needs. Score = MaxSim over each chunk&apos;s 2 pooled key vectors, read
            {mode === "corpus" ? " once, offline, from the stored index" : " just now, each chunk encoded alone, then thrown away"}.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3 font-mono text-[11px] leading-5">
            <div className="text-muted-foreground">second pass: what the generator is given</div>
            <div className="mt-1 space-y-0.5">
              {handed.map((c) => (
                <div key={c.id}>
                  <span className="text-muted-foreground">{c.id} </span>
                  {c.text}
                </div>
              ))}
              <div className="text-muted-foreground">{QUESTION}</div>
            </div>
            <div className="mt-2 text-[10px]" style={{ color: goldFound === 2 ? ACCENT : WARN }}>
              {goldFound === 2
                ? "complete evidence: both hops are in the prompt"
                : `incomplete evidence: ${goldFound} of 2 hops selected; complete-evidence recall scores this a miss`}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {mode === "corpus"
                ? "order: by score, as retrieved"
                : "order: original document order, as the paper reassembles long-context chunks"}
            </div>
          </div>

          <div className="rounded-lg border p-3 font-mono text-[11px] leading-5">
            <div className="flex flex-wrap items-center gap-1">
              {BACKBONES.map((b, i) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBb(i)}
                  aria-pressed={bb === i}
                  className={cn(
                    "rounded border px-1.5 text-[10px]",
                    bb === i ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground",
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div className="mt-2 text-muted-foreground">
              trainable: (64 + 1) x {B.d} + {B.attn} = <span className="text-foreground">{commas(params)}</span>
            </div>
            {mode === "corpus" ? (
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                <div>
                  per chunk: 7 x {B.d} in bf16 = <span className="text-foreground">{perChunkKB.toFixed(1)} KB</span>
                </div>
                <div>
                  21M Wikipedia chunks: <span className="text-foreground">{commas(indexGB)} GB</span>
                </div>
                <div>a 1,024-wide single vector: 43 GB for the same corpus</div>
                <div>scored exhaustively, no approximate index</div>
              </div>
            ) : (
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                <label className="flex items-center gap-2">
                  prompt <span className="w-10 text-foreground tabular-nums">{ctxK}K</span>
                  <Range min={0} max={LENGTHS.length - 1} step={1} value={lenIdx} onChange={(e) => setLenIdx(Number(e.target.value))} accent={ACCENT} className="w-24" aria-label="prompt length" />
                </label>
                <div>
                  ≈ <span className="text-foreground">{commas(nChunks)}</span> chunks of 141 tokens, encoded alone
                </div>
                <div>
                  generator re-reads <span className="text-foreground">{commas(genTokens)}</span> tokens, not {commas(ctxTokens)}
                </div>
                <div>
                  {star > 0 ? (
                    <>
                      FLOP break-even (Table 6, n = {n <= 5 ? 5 : 10}): {commas(star)} tokens,{" "}
                      <span style={{ color: ctxTokens > star ? ACCENT : WARN }}>
                        {ctxTokens > star ? "UNREAL does less work" : "full context is cheaper"}
                      </span>
                    </>
                  ) : (
                    "not in the paper's Table 6"
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        Switch modes and the ranking does not change: same weights, same 64 retrieval tokens, same layer mix, same MaxSim.
        What changes is where the keys come from and what it costs. Turn BM25 off with top-n at 2 and the violin chunk
        beats the sister, because the query never learned the keeper&apos;s name. That is the toy version of the paper&apos;s
        largest ablation.
      </p>
    </figure>
  )
}
