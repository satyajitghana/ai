"use client"

// What Xiryn's vault_fill actually checks before it types a saved value into
// the agent's browser, scenario by scenario.
//
// Every check below is a line in the repository at commit ae9ad97:
//   lib/agent/tools.ts:387-424   vault_fill.execute
//   lib/vault.ts:589-607         activeApproval (thread + item + approved + unexpired)
//   lib/vault.ts:531             APPROVAL_MS = 20 minutes
//   lib/vault.ts:610-615         hostMatches (same host, or a subdomain of it)
//   lib/workstation.ts:489-517   currentPage (window title matched against CDP targets)
// "not checked" rows are things the code does not look at, not things it gets wrong.

import { useState } from "react"

type Verdict = "pass" | "fail" | "none"

type Check = { label: string; code: string; verdict: Verdict; note: string }

type Scenario = {
  id: string
  title: string
  setup: string
  checks: Check[]
  result: "types it" | "refuses" | "no gate"
  moral: string
}

const SCENARIOS: Scenario[] = [
  {
    id: "login-ok",
    title: "Saved login, right site",
    setup: "Login saved for swiggy.com; the focused tab is www.swiggy.com.",
    checks: [
      {
        label: "item exists",
        code: "getVaultItem(id)",
        verdict: "pass",
        note: "the id came from vault_list",
      },
      {
        label: "login on its own site",
        code: "hostMatches(where.host, item.site)",
        verdict: "pass",
        note: "www. is stripped, so swiggy.com = swiggy.com",
      },
    ],
    result: "types it",
    moral: "The value goes in through xdotool on stdin, then xiryn-mask paints the field as dots.",
  },
  {
    id: "login-lookalike",
    title: "Saved login, look-alike domain",
    setup: "Login saved for swiggy.com; a page redirected the tab to swiggy.com.login-help.example.",
    checks: [
      { label: "item exists", code: "getVaultItem(id)", verdict: "pass", note: "" },
      {
        label: "login on its own site",
        code: "hostMatches(where.host, item.site)",
        verdict: "fail",
        note: "the host must equal swiggy.com or end in .swiggy.com; this one ends in .example",
      },
    ],
    result: "refuses",
    moral: "This is the phishing check the README advertises, and it works: suffix match on a dot boundary, not a substring.",
  },
  {
    id: "card-none",
    title: "Card, nobody approved",
    setup: "Visa ···· 4242 in the vault; the agent is on a checkout page and tries to fill.",
    checks: [
      { label: "item exists", code: "getVaultItem(id)", verdict: "pass", note: "" },
      {
        label: "approval for this thread and card",
        code: "activeApproval(threadId, item.id)",
        verdict: "fail",
        note: "no approved, unexpired row",
      },
    ],
    result: "refuses",
    moral: "The tool error tells the model to call request_payment_approval, which ends the turn and asks you.",
  },
  {
    id: "card-twice",
    title: "Card, approved, filled a second time",
    setup: "You approved ₹19,062 on makemytrip.com 12 minutes ago. The first payment failed; the agent fills the card again on the same site.",
    checks: [
      { label: "item exists", code: "getVaultItem(id)", verdict: "pass", note: "" },
      {
        label: "approval for this thread and card",
        code: "activeApproval(threadId, item.id)",
        verdict: "pass",
        note: "approved 12 min ago, the window is 20",
      },
      {
        label: "still on the approved site",
        code: "hostMatches(where.host, approval.host)",
        verdict: "pass",
        note: "same host",
      },
      {
        label: "approval used up",
        code: "(nothing)",
        verdict: "none",
        note: "a fill never marks the approval spent; it stays live until it expires",
      },
      {
        label: "amount matches",
        code: "(nothing)",
        verdict: "none",
        note: "the amount is shown to you, never compared with the page",
      },
    ],
    result: "types it",
    moral: "An approval is a 20-minute licence for one card on one site, not a token for one payment.",
  },
  {
    id: "card-gateway",
    title: "Card, payment moved to a bank page",
    setup: "Approved on makemytrip.com; the checkout hands off to a bank's 3-D Secure page on another domain.",
    checks: [
      { label: "item exists", code: "getVaultItem(id)", verdict: "pass", note: "" },
      {
        label: "approval for this thread and card",
        code: "activeApproval(threadId, item.id)",
        verdict: "pass",
        note: "",
      },
      {
        label: "still on the approved site",
        code: "hostMatches(where.host, approval.host)",
        verdict: "fail",
        note: "the bank's host is not makemytrip.com",
      },
    ],
    result: "refuses",
    moral: "The instructions tell the agent to ask again on the new site. This is the check that forces it.",
  },
  {
    id: "card-nohost",
    title: "Card, approved while no page was detected",
    setup: "The agent asked for approval when currentPage() returned null (the debugging port timed out, or no http tab was focused).",
    checks: [
      { label: "item exists", code: "getVaultItem(id)", verdict: "pass", note: "" },
      {
        label: "approval for this thread and card",
        code: "activeApproval(threadId, item.id)",
        verdict: "pass",
        note: "you approved it; the card showed no site",
      },
      {
        label: "still on the approved site",
        code: "approval.host && !hostMatches(…)",
        verdict: "none",
        note: "approval.host is null, so the whole condition is skipped",
      },
    ],
    result: "types it",
    moral: "Reasoned from the code, not run: with no host recorded, the site lock is off for that approval.",
  },
  {
    id: "readback",
    title: "After any fill: the agent reads it back",
    setup: "The value is now in a form field. The same agent has a shell in the same container, and Chromium listens on 127.0.0.1:9222.",
    checks: [
      {
        label: "anything between the shell and the page",
        code: "--remote-debugging-port=9222",
        verdict: "none",
        note: "Runtime.evaluate on the page can return field values; xiryn-mask itself uses this port",
      },
    ],
    result: "no gate",
    moral: "The vault keeps values out of the model's context by default. It does not stop an agent that decides to look. SECURITY.md says exactly this.",
  },
]

const TONE: Record<Verdict, string> = {
  pass: "oklch(0.58 0.15 152)",
  fail: "oklch(0.6 0.19 25)",
  none: "oklch(0.62 0.15 85)",
}

const WORD: Record<Verdict, string> = { pass: "pass", fail: "fail", none: "not checked" }

export function FillGate() {
  const [id, setId] = useState(SCENARIOS[0].id)
  const scenario = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
  const resultTone =
    scenario.result === "refuses" ? TONE.fail : scenario.result === "types it" ? TONE.pass : TONE.none

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">vault_fill, check by check</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          lib/agent/tools.ts:387-424 · lib/vault.ts
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3" role="tablist" aria-label="Scenario">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === id}
            onClick={() => setId(s.id)}
            className={
              s.id === id
                ? "rounded-md border border-foreground/40 bg-muted px-2 py-1 text-[11px] text-foreground"
                : "rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            }
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="px-4 py-3">
        <p className="my-0 text-xs text-muted-foreground">{scenario.setup}</p>
        <ul className="mt-3 list-none space-y-2 pl-0">
          {scenario.checks.map((check) => (
            <li
              key={check.label}
              className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 border-l-2 pl-3"
              style={{ borderColor: TONE[check.verdict] }}
            >
              <span className="font-mono text-[11px]" style={{ color: TONE[check.verdict] }}>
                {WORD[check.verdict]}
              </span>
              <span className="text-[12px] text-foreground">{check.label}</span>
              <span />
              <span className="font-mono text-[10px] break-all text-muted-foreground">
                {check.code}
                {check.note ? ` · ${check.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t px-4 py-3">
        <span
          className="rounded-md border px-2 py-0.5 font-mono text-[11px]"
          style={{ borderColor: resultTone, color: resultTone }}
        >
          {scenario.result}
        </span>
        <span className="text-xs text-muted-foreground">{scenario.moral}</span>
      </div>
    </figure>
  )
}
