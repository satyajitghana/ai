import { cn } from "@/lib/utils"

// What "XGEN releases JING and DAO" actually cashes out to, item by item.
// Server-rendered, zero JS — this is a fixed fact table, not something a
// reader needs to interact with. Sourced from the GitHub repo, the HF repo
// (?blobs=true), and the xgenlabs.ai/research page as read on 2026-09-18.

type Row = {
  item: string
  jing: { ok: "yes" | "no" | "partial"; note: string }
  dao: { ok: "yes" | "no" | "partial"; note: string }
}

const ROWS: Row[] = [
  {
    item: "Model weights",
    jing: { ok: "yes", note: "~66.9 GB, 15 safetensors shards (HF)" },
    dao: { ok: "no", note: "none published" },
  },
  {
    item: "Inference code",
    jing: { ok: "partial", note: "bidirectional pipeline only — causal model “coming soon”" },
    dao: { ok: "no", note: "none published" },
  },
  {
    item: "Technical paper",
    jing: { ok: "no", note: "arXiv badge reads “coming soon”" },
    dao: { ok: "no", note: "no paper" },
  },
  {
    item: "WBench-evaluated variant ships",
    jing: { ok: "partial", note: "Bidirectional (rank 1) does; 4-step AR (rank 2) doesn't" },
    dao: { ok: "no", note: "not applicable — DAO isn't a WBench entrant" },
  },
  {
    item: "What you can run yourself",
    jing: { ok: "yes", note: "6-GPU script, offline batch from a JSON script" },
    dao: { ok: "no", note: "a hand-scripted panorama demo on the site, not an engine" },
  },
]

const MARK: Record<Row["jing"]["ok"], { glyph: string; cls: string }> = {
  yes: { glyph: "✓", cls: "text-emerald-600 dark:text-emerald-400" },
  no: { glyph: "✗", cls: "text-muted-foreground/70" },
  partial: { glyph: "△", cls: "text-amber-600 dark:text-amber-400" },
}

function Cell({ ok, note }: { ok: Row["jing"]["ok"]; note: string }) {
  const m = MARK[ok]
  return (
    <div className="flex items-start gap-1.5">
      <span aria-hidden className={cn("mt-0.5 shrink-0 font-mono text-xs", m.cls)}>
        {m.glyph}
      </span>
      <span className="text-xs leading-5 text-muted-foreground">{note}</span>
    </div>
  )
}

export function ReleaseLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what actually ships</span>
        <span className="text-muted-foreground/50">as of 2026-09-18</span>
      </div>

      <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-x-4 gap-y-3 p-4 sm:grid">
        <span />
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">JING</span>
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">DAO</span>
        {ROWS.map((r) => (
          <div key={r.item} className="col-span-3 grid grid-cols-[1fr_1.3fr_1.3fr] gap-x-4 border-t pt-3 first:border-t-0 first:pt-0">
            <span className="text-xs font-medium text-foreground">{r.item}</span>
            <Cell {...r.jing} />
            <Cell {...r.dao} />
          </div>
        ))}
      </div>

      {/* mobile: stacked */}
      <div className="grid gap-3 p-4 sm:hidden">
        {ROWS.map((r) => (
          <div key={r.item} className="border-t pt-3 first:border-t-0 first:pt-0">
            <div className="text-xs font-medium text-foreground">{r.item}</div>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground uppercase">jing</span>
                <Cell {...r.jing} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground uppercase">dao</span>
                <Cell {...r.dao} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        △ marks a partial: something real ships, but not the thing the announcement's headline
        claim rests on. Both released-code rows belong to JING; DAO does not have a column with a
        single ✓ in it.
      </p>
    </figure>
  )
}
