import { cn } from "@/lib/utils"

// Every project this article could actually read code for, placed on the
// decision slot it occupies in a pipeline — not the slot the launch pitch
// implied. Status is what the repo itself reports, checked directly:
// "measured" means real numbers from a run; "partial" means one timing or
// anecdote, not a benchmark; "none" means real code, zero reported numbers;
// "unverified" means the repo returned 404 on direct access and everything
// below is secondhand. Server-rendered <details> — no JS needed to read it.

type Status = "measured" | "partial" | "none" | "unverified"

type Entry = {
  name: string
  repo: string
  desc: string
  status: Status
  statusNote: string
}

const STATUS_LABEL: Record<Status, string> = {
  measured: "reports real numbers",
  partial: "one timing, not a benchmark",
  none: "no numbers reported",
  unverified: "could not access directly",
}

const STATUS_DOT: Record<Status, string> = {
  measured: "oklch(0.72 0.15 195)",
  partial: "oklch(0.68 0.13 85)",
  none: "oklch(0.62 0.02 260)",
  unverified: "oklch(0.65 0.19 25)",
}

const SLOTS: { key: string; label: string; blurb: string; entries: Entry[] }[] = [
  {
    key: "select",
    label: "Select",
    blurb: "pick one next action or element from a short, code-built menu — the browser/mobile/desktop shape",
    entries: [
      { name: "jev-ultrafast", repo: "browser-use/jev-ultrafast", desc: "browser agent: operation + target element, one call, per step", status: "measured", statusNote: "7.07s Zürich→London flight search, 25% latency cut — covered in full in the companion piece" },
      { name: "typesafe-computer-use", repo: "awlevin/typesafe-computer-use", desc: "Mac agent: OCR + accessibility tree, no screenshot to a big model", status: "measured", statusNote: "155x cheaper, 14–40x faster per decision, real cost table" },
      { name: "mobile-jev", repo: "droidrun/mobile-jev", desc: "Android agent via the Mobilerun API, studio + CLI + execution traces", status: "partial", statusNote: "21s / 9 actions to reach payment; \"a completed booking is not demonstrated\"" },
      { name: "jevlike", repo: "vinnylarouge/jevlike", desc: "train your own one-pass chooser: text menus, Doom buttons, chess moves", status: "measured", statusNote: "98% synthetic, 26–29% Wikispeedia — but see the open issue on its control" },
      { name: "typesafe-snake", repo: "sorrycc/typesafe-snake", desc: "Jev picks a move from code-computed legal moves + flood-fill facts, per tick", status: "none", statusNote: "small, real, no benchmark — it's a toy by design" },
      { name: "jev-browser", repo: "vlad-terin/jev-browser", desc: "element selection for existing computer-use tools (per its own listing)", status: "unverified", statusNote: "github.com/vlad-terin/jev-browser and its renamed jev-use both 404 on direct clone/fetch" },
    ],
  },
  {
    key: "route",
    label: "Route",
    blurb: "one cheap call decides which expensive path handles this turn",
    entries: [
      { name: "jev-router", repo: "gargpratyush/jev-router", desc: "per-turn model tier for Claude Code / Codex — fast/balanced/strong/long", status: "none", statusNote: "one example decision shown (94% confidence); no accuracy/latency benchmark" },
      { name: "jevlogs", repo: "reachjalil/jevlogs", desc: "score OTel logs before they reach a reasoning model; retain vs. analyze", status: "none", statusNote: "own docs: \"not yet independently validated for this project\"" },
    ],
  },
  {
    key: "rank",
    label: "Rank",
    blurb: "score every candidate against a query — reranking without embeddings",
    entries: [
      { name: "jev-search", repo: "superagents-lab/jev-search", desc: "Noul relevance per result across 10 engines; Choice/Noul picks sources & window first", status: "none", statusNote: "\"relevance percentages are model judgments, not verified accuracy\" (own README)" },
      { name: "jev-mcp — jev_find", repo: "jkudish/jev-mcp", desc: "rank candidate ids by meaning, no index; also verifies claims and screens text", status: "partial", statusNote: "3 anecdotes with confidences 0.99–1.0 in the README, not a benchmark" },
    ],
  },
  {
    key: "classify",
    label: "Classify",
    blurb: "a repeated typed judgment on one item — the volume workhorse",
    entries: [
      { name: "jev-trader", repo: "jarrodwatts/jev-trader", desc: "buy/sell every ~300ms on Kuru MON-USDC, defaults to dry-run", status: "partial", statusNote: "real read/loop latency (p50 18ms/100ms), no P&L or accuracy claim of any kind" },
      { name: "HA-Jev", repo: "AboveColin/HA-Jev", desc: "Home Assistant sensors/actions from Choice/Score/Noul over your entities", status: "none", statusNote: "own README: \"confidence has no published calibration evidence\"" },
      { name: "jev-curate", repo: "AkashPriyadarshii/jev-curate", desc: "Rust/PyO3 dataset row filter: Noul/Score gates on Parquet & JSONL", status: "partial", statusNote: "self-reported throughput/cost in a promotional README; real Rust source, no reproducible harness shown" },
      { name: "open-jev", repo: "pngwn/system-one-qwen3.5-4b-scorer-v2b", desc: "Qwen3.5-4B LoRA scorer + temperature scaling — see the section above", status: "measured", statusNote: "committed metrics.json: accuracy, ECE and Brier, before and after calibration" },
    ],
  },
  {
    key: "verify",
    label: "Verify",
    blurb: "check a claim, a diff, or a generated answer against evidence",
    entries: [
      { name: "jev-review", repo: "devagrawal09/jev-review", desc: "Noul risk matrix → Choice/Score file profiles → severity → reviewer routing", status: "none", statusNote: "own docs: \"findings are review prompts, not proof of a defect\"" },
      { name: "jev-mcp — jev_verify", repo: "jkudish/jev-mcp", desc: "check each claim in a report against the evidence it cites", status: "partial", statusNote: "caught one contradicted claim at confidence 1.0 in real use — one example, not a suite" },
    ],
  },
]

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: STATUS_DOT[status] }}
    />
  )
}

export function DecisionSlotMap() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>15 repos, 5 decision slots — click a row for what it actually does</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StatusDot status={s} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-sm font-semibold">{slot.label}</span>
              <span className="text-xs text-muted-foreground">— {slot.blurb}</span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {slot.entries.map((e, i) => (
                <details key={e.repo} className={cn("group", i > 0 && "border-t")}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30">
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusDot status={e.status} />
                      <span className="truncate font-mono text-xs font-medium">{e.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground group-open:hidden">
                      {e.repo}
                    </span>
                  </summary>
                  <div className="border-t bg-muted/10 px-3 py-2.5">
                    <p className="text-xs leading-5">{e.desc}</p>
                    <p className="mt-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
                      {e.statusNote}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                      github.com/{e.repo}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </figure>
  )
}
