import { cn } from "@/lib/utils"

// The only structural question in agent browser automation: which side of the
// machine holds each switch.
//
// The agent owns a shell. Anything it can type is not a permission — it is a
// default. BrowserSkill 0.3.0's actual contribution is a relocation: the two
// switches that decide whether a human is consulted moved out of CLI surface
// the agent controls and into browser-profile storage it does not.
//
// Every row below is read out of the 0.3.0 source at commit d1356fd:
//   crates/bsk-cli/src/cli/interaction_policy.rs   warn_legacy_override()
//   apps/extension/src/lib/interaction-preferences.ts  the store + normalizer
//   apps/extension/src/entrypoints/background.ts   autoAllow wiring
//   apps/extension/src/tools/shared.ts             enforceToolTargetScope()
//   docs/operation-audit.md                        audit default + disclaimer
//
// Server-rendered, zero JS.

type Side = "agent" | "browser"

type Control = {
  name: string
  note: string
  side: Side
  moved?: boolean
}

const CONTROLS: Control[] = [
  {
    name: "the shell itself",
    note: "the agent runs bsk, edits ~/.bsk, can start an older daemon, can read the profile on disk",
    side: "agent",
  },
  {
    name: "--unattended",
    note: "parsed, logged as deprecated, then discarded — warn_legacy_override() is its whole implementation",
    side: "agent",
    moved: true,
  },
  {
    name: "tab borrow --no-confirm",
    note: "same: the borrow still blocks for a human and times out without one",
    side: "agent",
    moved: true,
  },
  {
    name: "BSK_REQUEST_HELP=off",
    note: "same, in both the CLI and the daemon's inherited environment",
    side: "agent",
    moved: true,
  },
  {
    name: "operation audit",
    note: "off by default; written under ~/.bsk/audit on the daemon host, i.e. inside the agent's own reach",
    side: "agent",
  },
  {
    name: "Confirm before borrowing tabs",
    note: "chrome.storage.local in your browser profile; the extension re-reads it on every borrow",
    side: "browser",
    moved: true,
  },
  {
    name: "Allow requests for human help",
    note: "same store; re-checked four times through request_help's setup, so flipping it mid-flight takes effect",
    side: "browser",
    moved: true,
  },
  {
    name: "the borrow confirmation itself",
    note: "rendered in a window you own — Agent Windows boot on about:blank and have no content script to ask in",
    side: "browser",
  },
  {
    name: "the Agent Window boundary",
    note: "enforceAgentWindow(): every input-dispatching tool refuses a tab outside the session's own window",
    side: "browser",
  },
]

function Column({ side, title, sub }: { side: Side; title: string; sub: string }) {
  const rows = CONTROLS.filter((c) => c.side === side)
  const accent =
    side === "agent" ? "oklch(0.62 0.19 27)" : "oklch(0.58 0.13 165)"

  return (
    <div className="min-w-0 flex-1">
      <div className="border-b pb-2">
        <div className="font-mono text-[11px] tracking-wide" style={{ color: accent }}>
          {title}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      </div>
      <ul className="mt-2 list-none space-y-2 pl-0">
        {rows.map((c) => (
          <li key={c.name} className="my-0 rounded-md border bg-muted/20 px-2.5 py-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] break-all">
                {c.name}
              </code>
              {c.moved ? (
                <span
                  className="font-mono text-[9px] tracking-widest uppercase"
                  style={{ color: "oklch(0.68 0.13 85)" }}
                >
                  moved in 0.3.0
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{c.note}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AuthorityMap() {
  return (
    <figure className={cn("my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          where each switch physically lives
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          BrowserSkill 0.3.0 · d1356fd
        </span>
      </div>

      <div className="flex flex-col gap-5 p-3 sm:flex-row sm:gap-6 sm:p-4">
        <Column
          side="agent"
          title="the agent's side of the line"
          sub="same OS user, same filesystem, same process tree"
        />
        <Column
          side="browser"
          title="your side of the line"
          sub="browser profile storage and UI the CLI cannot write"
        />
      </div>

      <div className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        The three inputs marked{" "}
        <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "oklch(0.68 0.13 85)" }}>
          moved in 0.3.0
        </span>{" "}
        used to be how you turned confirmation off. They still parse. They now do nothing except print a
        warning on stderr, because the switch they used to flip is on the other side of the line.
      </div>
    </figure>
  )
}
