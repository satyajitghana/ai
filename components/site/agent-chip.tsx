"use client"

import { useState } from "react"

import { siteUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

// The signature dual-native affordance: every page advertises its own
// machine-readable variants. `md` / `json` link to the agent surfaces;
// `prompt` copies a ready-to-paste instruction for any LLM.
export function AgentChip({ md, json }: { md?: string; json?: string }) {
  const [copied, setCopied] = useState(false)

  const copyPrompt = async () => {
    const target = md ? `${siteUrl}${md}` : siteUrl
    await navigator.clipboard.writeText(
      `Read ${target} (markdown). Site index for agents: ${siteUrl}/llms.txt — MCP endpoint: ${siteUrl}/api/mcp/mcp`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span
      data-print-hidden
      className="inline-flex shrink-0 items-center gap-2 rounded border px-2 py-1 font-mono text-[10px] text-muted-foreground select-none"
    >
      {md ? (
        <a href={md} className="transition-colors hover:text-foreground">
          md
        </a>
      ) : null}
      {json ? (
        <a href={json} className="transition-colors hover:text-foreground">
          json
        </a>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint for agents, not a page */}
      <a href="/api/mcp/mcp" className="transition-colors hover:text-foreground">
        mcp
      </a>
      <button
        type="button"
        onClick={copyPrompt}
        className={cn(
          "cursor-pointer transition-colors hover:text-foreground",
          copied && "text-foreground"
        )}
        title="Copy a prompt that points an AI agent at this page"
      >
        {copied ? "copied ✓" : "copy↗ai"}
      </button>
    </span>
  )
}
