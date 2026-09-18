"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every link from a seed to a released checkpoint, colored by whether the
// public audit infrastructure actually covers it today, or whether it is
// "auditable" only in the open-recipe sense (code and data are named, but
// nothing chains them to the weights).
//
// Sourced from open1b-tech-report.pdf (S2-S3, S6, Appendix B), the live
// manifest/coverage/ledger at open1b.gensyn.ai (fetched 2026-09-18), and
// gensyn-ai/open-transformers (src/pretrain/train/state_hash.py,
// docs/audit-replay-usage.md, docs/midtraining_math.md). The GCS bucket
// listing (storage.googleapis.com/gensyn-open-1b) has exactly one hash log --
// logs/state_hashes.jsonl, for the base pretraining run -- and no midtrain or
// SFT equivalent, which is what the chain-break below is drawn from.

const HASHED = "oklch(0.55 0.16 155)"
const RECIPE = "oklch(0.68 0.13 85)"

type Tier = "hashed" | "recipe"

type Link = {
  id: string
  label: string
  sub: string
  tier: Tier
  detail: string
}

const LINKS: Link[] = [
  {
    id: "seed",
    label: "seed + config",
    sub: "seed 42, declared recipe",
    tier: "hashed",
    detail:
      "Step 0 has no checkpoint to load. The audit tool regenerates the initial weights from seed 42 and the published config and compares the result to an init hash Gensyn committed before any audit ran.",
  },
  {
    id: "corpus",
    label: "public corpus",
    sub: "4 sources · 450B raw tokens",
    tier: "hashed",
    detail:
      "DCLM-Baseline, FineWeb-Edu, Stack v2 and Proof-Pile-2, drawn into one canonical stream that is a pure function of the seed and the corpus manifest -- not of cluster size. Every batch's actual bytes are folded into that step's hash, so a document outside the published corpus cannot appear in an accepted replay.",
  },
  {
    id: "cluster",
    label: "cluster execution",
    sub: "48× H100 · RepOps kernels",
    tier: "hashed",
    detail:
      "One fixed reduction order, one FMA convention, subnormals flushed identically everywhere, a counter-based RNG. The entire point is that one commodity device can later redo, one virtual rank at a time, whatever the 48 GPUs did together for a single step.",
  },
  {
    id: "hash",
    label: "per-step state hash",
    sub: "chained blake2b, every step",
    tier: "hashed",
    detail:
      "A digest over the post-update weights, the Adam moments, that step's gradients, and a rolling hash of every batch consumed -- recomputed by the auditor's own tool and compared to a value published before the audit began. It does not cover the RNG position, the data-stream cursor, spike-skip state, or the run's descriptor flags: those ride in an unhashed meta.json a continuation still takes on faith.",
  },
  {
    id: "ckpt",
    label: "checkpoints ×810",
    sub: "every 100 steps",
    tier: "hashed",
    detail:
      "Gensyn published a checkpoint every 100 steps, 810 of them. The other 99 steps inside a segment have no Gensyn-published checkpoint at all -- an auditor hands an intermediate checkpoint to the next one, relay-style, exactly as sequential as the training was parallel.",
  },
  {
    id: "base",
    label: "open-1b-base",
    sub: "step 80,957 · 400B tokens",
    tier: "hashed",
    detail:
      "The last point the public hash log reaches. Its own state_hash.txt is a documented write-off from a since-fixed writer bug -- the correct target is logs/state_hashes.jsonl -- a detail the audit tooling's own docs have to warn readers about for this exact checkpoint.",
  },
  {
    id: "midtrain",
    label: "midtrain",
    sub: "93B tok · Dolma3-Dolmino anneal",
    tier: "recipe",
    detail:
      "Branches from the base checkpoint and anneals the learning rate to zero over AI2's Dolma3-Dolmino mixture. The repo's own docs say this branch ‘starts its own chain’ -- a new hash sequence exists in the training code -- but no midtrain hash log is published, and the audit site has no segment, coverage, or ledger entry for it.",
  },
  {
    id: "sft",
    label: "SFT",
    sub: "Tulu-3 mixture",
    tier: "recipe",
    detail:
      "Instruction tuning on allenai/tulu-3-sft-olmo-2-mixture-0225. There is a training script, the same as any open-recipe release -- no hash log, no ledger, no segment on open1b.gensyn.ai.",
  },
  {
    id: "released",
    label: "open-1b-sft",
    sub: "the released instruct checkpoint",
    tier: "recipe",
    detail:
      "The checkpoint most people will actually download and run. Getting here from open-1b-base costs two more training runs the ‘first model you don’t have to trust’ claim doesn’t reach -- for this half of the release, you're back to trusting the recipe.",
  },
]

const STILL_TRUSTED = [
  "The harness's own source code -- you're trusting gensyn-ai/open-transformers is really what ran on the cluster.",
  "RepOps's cross-hardware bit-exactness is an empirical claim, re-tested by every replay that succeeds -- not a proof that holds for every future driver or library version.",
  "The four upstream datasets' own filtering and licensing. The audit proves the declared bytes were consumed, not that those bytes are unbiased or clean.",
  "Every ‘accepted’ submission today is self-reported: the server checks the reported loss against a value it withheld and the uploaded file's digest -- not the state hash itself.",
  "Continuing the relay means loading a stranger's checkpoint directory into your own process. The maintainers' own docs call that ‘not a read-only operation’ and recommend a sandbox.",
]

export function TrustChain() {
  const [selected, setSelected] = useState("hash")
  const active = LINKS.find((l) => l.id === selected) ?? LINKS[3]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>open-1b &middot; seed to released weights</span>
        <span className="text-muted-foreground/50">click a link in the chain</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* legend */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: HASHED }} />
            replayable &amp; hash-checked today
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: RECIPE }} />
            published &mdash; recipe only, not hash-chained
          </span>
        </div>

        {/* chain */}
        <div className="flex flex-wrap items-stretch gap-1.5">
          {LINKS.map((link, i) => {
            const isBreak = i === 6
            const color = link.tier === "hashed" ? HASHED : RECIPE
            return (
              <div key={link.id} className="flex items-stretch gap-1.5">
                {isBreak ? (
                  <div
                    aria-hidden
                    className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-foreground/25 px-1 text-center font-mono text-[8px] leading-tight text-muted-foreground/70 uppercase"
                    title="the public hash chain stops here"
                  >
                    <span>chain</span>
                    <span>ends</span>
                  </div>
                ) : i > 0 ? (
                  <span aria-hidden className="self-center text-muted-foreground/40">
                    &rarr;
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelected(link.id)}
                  aria-pressed={selected === link.id}
                  className={cn(
                    "min-w-[7.5rem] cursor-pointer rounded-md border px-2.5 py-2 text-left transition-colors",
                    selected === link.id
                      ? "border-foreground/40 bg-muted/40"
                      : "border-border hover:border-foreground/25 hover:bg-muted/20"
                  )}
                  style={{ borderTopColor: color, borderTopWidth: 2 }}
                >
                  <div className="font-mono text-[11px] font-semibold text-foreground">{link.label}</div>
                  <div className="mt-0.5 font-mono text-[9px] leading-tight text-muted-foreground">{link.sub}</div>
                </button>
              </div>
            )
          })}
        </div>

        {/* detail */}
        <div className="mt-3 min-h-[5.5rem] rounded-md border bg-muted/15 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: active.tier === "hashed" ? HASHED : RECIPE }}
            />
            {active.label}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{active.detail}</p>
        </div>

        {/* still resting on trust */}
        <div className="mt-4 border-t pt-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase">
            not shown as a link above -- true for every link at once
          </div>
          <ul className="mt-1.5 space-y-1">
            {STILL_TRUSTED.map((t) => (
              <li key={t} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                <span aria-hidden className="shrink-0 text-muted-foreground/50">
                  &middot;
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
