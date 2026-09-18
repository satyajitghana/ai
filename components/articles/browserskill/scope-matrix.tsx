"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a BrowserSkill session may do to a given tab, by where that tab lives.
//
// The "your own window" column is not inferred: every row was run against a
// real Chromium 153 with the repo's own 0.3.0 extension build loaded and a real
// bsk daemon on protocol 1.3, at commit d1356fd. The fixture tab sat in the
// window a human was using and was never borrowed. Six commands answered; the
// other thirteen returned permission_denied with reason agent_window_scope and
// exit code 1.
//
// The "Agent Window" column is the design contract, and the four rows marked
// `checked` are the ones I exercised there in the same run (navigate, observe,
// snapshot, get-html all succeed once the tab is the session's own).
//
// The remote column comes from executing BrowserSkill's own guard functions —
// apps/extension/src/tools/shared.ts, unmodified, imported and called with a
// fake chrome.tabs — because standing up a paired remote server was out of
// scope for one afternoon. That distinction is stated in the article.

type Verdict = "allowed" | "denied"

type Row = {
  cmd: string
  effect: "passive_read" | "transient_input" | "browser_mutation"
  userWindow: Verdict
  agentWindow: Verdict
  remote: Verdict
  detail: string
  checkedInAgentWindow?: boolean
}

const ROWS: Row[] = [
  {
    cmd: "tab list --scope user",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "allowed",
    detail: "Returns tab_id, title and url for every tab in your own windows. This is the step that turns 'the agent cannot name your tabs' into 'the agent can name your tabs', and PRIVACY.md does disclose it.",
  },
  {
    cmd: "get-html",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Returned the fixture's full outerHTML, canary string included. No borrow, no prompt, no notification.",
    checkedInAgentWindow: true,
  },
  {
    cmd: "snapshot",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Returned the accessibility tree and minted @e1 for the page's button — an actionable ref on a tab the session may not act on.",
    checkedInAgentWindow: true,
  },
  {
    cmd: "screenshot",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Wrote a 9,923-byte PNG of the page. That image is fig3 in this article.",
  },
  {
    cmd: "console",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Buffered console, log and exception entries for that tab.",
  },
  {
    cmd: "network",
    effect: "passive_read",
    userWindow: "allowed",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Buffered network responses and failures for that tab.",
  },
  {
    cmd: "observe",
    effect: "transient_input",
    userWindow: "denied",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Denied on a user tab, and correctly so: observe can hover-probe the live page, which is input. It is the one read command classified transient_input rather than passive_read.",
    checkedInAgentWindow: true,
  },
  { cmd: "click", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "\"click can only act on tabs inside the Agent Window … borrow it first\"." },
  { cmd: "fill", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal, same reason code." },
  { cmd: "press", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal, same reason code." },
  { cmd: "hover", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal, same reason code." },
  { cmd: "scroll-to", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal, same reason code." },
  {
    cmd: "navigate",
    effect: "browser_mutation",
    userWindow: "denied",
    agentWindow: "allowed",
    remote: "denied",
    detail: "Same refusal. Inside the Agent Window it navigated and reported tab=1117016030 reached=load.",
    checkedInAgentWindow: true,
  },
  { cmd: "reload", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal, same reason code." },
  { cmd: "evaluate", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Same refusal. Arbitrary JavaScript never reaches a tab outside the Agent Window." },
  {
    cmd: "screenshot --full-page",
    effect: "browser_mutation",
    userWindow: "denied",
    agentWindow: "allowed",
    remote: "denied",
    detail: "The strictest path in the codebase: window scope, then an unconditional per-tab claim, then both re-checked before every scroll step. A full-page capture scrolls the page, so it is a mutation.",
  },
  { cmd: "emulate", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Device emulation changes the tab's viewport and user agent, so it is gated like any other write." },
  { cmd: "download", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Denied on a user tab. Remote sessions cannot transfer files at all, in either direction." },
  { cmd: "request-help", effect: "browser_mutation", userWindow: "denied", agentWindow: "allowed", remote: "denied", detail: "Asking the human for help is itself scoped to the Agent Window — it focuses and activates the tab, which is input." },
]

type Col = "userWindow" | "agentWindow" | "remote"

const COLS: { key: Col; label: string; sub: string; provenance: string }[] = [
  {
    key: "userWindow",
    label: "a tab in your own window",
    sub: "local session, tab never borrowed",
    provenance: "measured — Chromium 153, bsk 0.3.0, protocol 1.3, 2026-09-18",
  },
  {
    key: "agentWindow",
    label: "a tab in the Agent Window",
    sub: "created by the session, or borrowed and moved in",
    provenance: "the design contract; navigate, observe, snapshot and get-html checked in the same run",
  },
  {
    key: "remote",
    label: "the same tab, remote mode",
    sub: "agent on a server, browser paired over WSS",
    provenance: "from executing shared.ts's own guard functions, not a live paired deployment",
  },
]

const EFFECT_LABEL: Record<Row["effect"], string> = {
  passive_read: "passive_read",
  transient_input: "transient_input",
  browser_mutation: "browser_mutation",
}

export function ScopeMatrix() {
  const [col, setCol] = useState<Col>("userWindow")
  const [open, setOpen] = useState<string | null>("get-html")

  const active = COLS.find((c) => c.key === col) ?? COLS[0]
  const allowed = ROWS.filter((r) => r[col] === "allowed")
  const denied = ROWS.filter((r) => r[col] === "denied")
  const detail = ROWS.find((r) => r.cmd === open) ?? null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          19 commands · one target tab · three places that tab can be
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {allowed.length} allowed / {denied.length} denied
        </span>
      </div>

      <div className="flex flex-col gap-1.5 border-b p-3 sm:flex-row sm:p-4">
        {COLS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCol(c.key)}
            aria-pressed={c.key === col}
            className={cn(
              "min-w-0 flex-1 cursor-pointer rounded-md border px-2.5 py-2 text-left transition-colors",
              c.key === col
                ? "border-foreground/30 bg-muted/40"
                : "border-transparent bg-muted/10 hover:bg-muted/25",
            )}
          >
            <div className="font-mono text-[11px] text-foreground">{c.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.sub}</div>
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 font-mono text-[10px] leading-5 text-muted-foreground">
          {active.provenance}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Group
            title={`allowed (${allowed.length})`}
            color="oklch(0.68 0.13 85)"
            rows={allowed}
            open={open}
            setOpen={setOpen}
          />
          <Group
            title={`denied (${denied.length})`}
            color="oklch(0.58 0.02 250)"
            rows={denied}
            open={open}
            setOpen={setOpen}
          />
        </div>

        {detail ? (
          <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
                bsk {detail.cmd}
              </code>
              <span className="font-mono text-[10px] text-muted-foreground">
                {EFFECT_LABEL[detail.effect]}
              </span>
              <span
                className="font-mono text-[10px]"
                style={{
                  color:
                    detail[col] === "allowed"
                      ? "oklch(0.68 0.13 85)"
                      : "oklch(0.58 0.02 250)",
                }}
              >
                {detail[col]}
              </span>
              {col === "agentWindow" && detail.checkedInAgentWindow ? (
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                  ran it
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 mb-0 text-sm leading-6 text-muted-foreground">{detail.detail}</p>
          </div>
        ) : null}

        <p className="mt-4 mb-0 text-sm leading-6 text-muted-foreground">
          The middle column is the promise on the tin, and it is kept: nothing that dispatches input
          reaches a tab you are using. The left column is the same session, the same tab, and the
          read half of the same tool set — and there the boundary is the window, not a grant. Switch
          to the right-hand column and the per-tab grant appears, because a remote agent is outside
          the trust boundary and a local one, by BrowserSkill&rsquo;s reckoning, already isn&rsquo;t.
        </p>
      </div>
    </figure>
  )
}

function Group({
  title,
  color,
  rows,
  open,
  setOpen,
}: {
  title: string
  color: string
  rows: Row[]
  open: string | null
  setOpen: (v: string) => void
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 font-mono text-[10px] tracking-widest uppercase" style={{ color }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed px-2 py-3 text-center font-mono text-[10px] text-muted-foreground">
          none
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {rows.map((r) => (
            <button
              key={r.cmd}
              type="button"
              onClick={() => setOpen(r.cmd)}
              aria-pressed={r.cmd === open}
              className={cn(
                "cursor-pointer rounded border px-1.5 py-1 font-mono text-[10px] transition-colors",
                r.cmd === open
                  ? "border-foreground/40 bg-muted/50 text-foreground"
                  : "border-border/70 bg-muted/15 text-muted-foreground hover:bg-muted/30",
              )}
            >
              {r.cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
