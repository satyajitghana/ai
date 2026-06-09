"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Copies an arbitrary string to the clipboard — used to copy snippet code from
// the /snippets index without a per-snippet detail route.
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "cursor-pointer font-mono text-[10px] tracking-wide text-muted-foreground transition-colors hover:text-foreground",
        copied && "text-foreground"
      )}
      title="Copy code to clipboard"
    >
      {copied ? "copied ✓" : (label ?? "copy")}
    </button>
  )
}
