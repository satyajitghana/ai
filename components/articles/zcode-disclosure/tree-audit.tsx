// What a clone of the published repository actually answers. Server-rendered,
// zero JS.
//
// Every row is a command run against github.com/zai-org/ZCode at the tip of
// main on 2026-09-22, and its literal result. The point is not that the greps
// come back empty -- of course they do, the announcement says the workflow was
// removed -- but that the repository's shape decides which questions it can
// answer at all. Two commits means the history is not there to read, so the
// repo establishes what the client does now and nothing about what it did.
//
// The NOTICE.md row is the one that carries weight. It is a 27 KB enumeration
// of every outbound request path in the project, written by the vendor, and a
// workspace-snapshot upload is not among the seventeen business scenarios it
// lists. An omission from an exhaustive self-description is a stronger signal
// than an empty grep.

type Row = {
  cmd: string
  result: string
  tells: string
  tone: "yes" | "no" | "note"
}

const ROWS: Row[] = [
  {
    cmd: "cat package.json | jq -r .version",
    result: "3.14.0",
    tells: "The published tree is the remediated client, not a pre-incident snapshot.",
    tone: "yes",
  },
  {
    cmd: "git log --oneline | wc -l",
    result: "2",
    tells: '"Initial commit" (20 Sep) and "feat: open source" (21 Sep). There is no development history to read.',
    tone: "note",
  },
  {
    cmd: "grep -rniE 'repo.?wiki' --include='*.ts*' --include='*.md' .",
    result: "0 matches",
    tells: "The removed feature leaves no trace in the tree — not a stub, not a flag, not a dead import.",
    tone: "no",
  },
  {
    cmd: "grep -rn 'repoSnapshot|encryptedSizeBytes|captureBeforePrompt' src",
    result: "0 matches",
    tells: "None of the identifiers named in the public disclosure exist here.",
    tone: "no",
  },
  {
    cmd: "grep -rn 'zcode-prod|PostObject|aliyuncs' --include='*.ts*' .",
    result: "0 matches",
    tells: "The only surviving Aliyun strings are four DashScope API endpoints in config/provider — a model provider, not storage.",
    tone: "no",
  },
  {
    cmd: "sed -n '/## 二、上传接口/,/## 三、/p' NOTICE.md",
    result: "17 outbound scenarios",
    tells: "A vendor-written enumeration of every path that leaves the machine. A workspace-snapshot upload is not one of the seventeen.",
    tone: "yes",
  },
  {
    cmd: "grep -n 'update-ref|commit-tree' services/src/git/repo/gitCheckpointRepo.ts",
    result: "4 matches",
    tells: "The replacement checkpoint is a hidden git ref in the user's own repository.",
    tone: "yes",
  },
]

const TONE: Record<Row["tone"], string> = {
  yes: "oklch(0.55 0.15 155)",
  no: "oklch(0.60 0.02 250)",
  note: "oklch(0.62 0.13 95)",
}

export function TreeAudit() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what a clone answers — zai-org/ZCode, main, 2026-09-22
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Apache-2.0 · 3,896 TypeScript files
        </span>
      </div>

      <div className="divide-y">
        {ROWS.map((r) => (
          <div key={r.cmd} className="grid gap-1 p-3 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-4">
            <code className="font-mono text-[11px] break-words text-foreground">{r.cmd}</code>
            <span
              className="font-mono text-[11px] sm:text-right"
              style={{ color: TONE[r.tone] }}
            >
              {r.result}
            </span>
            <p className="mt-0 mb-0 font-mono text-[10.5px] leading-relaxed text-muted-foreground sm:col-span-2">
              {r.tells}
            </p>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Commands are shortened for width; paths are relative to the repository
        root. Every one of these is cheap to re-run, which is the whole value of
        open-sourcing a client — and every one of them describes the present
        tree, which is the whole limit of it.
      </figcaption>
    </figure>
  )
}
