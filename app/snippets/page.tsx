import type { Metadata } from "next"

import { CopyButton } from "@/components/site/copy-button"
import { PageShell } from "@/components/site/page-shell"
import { getSnippets } from "@/lib/content"

export const metadata: Metadata = {
  title: "Snippets",
  description:
    "Small, copy-paste-able code snippets — CUDA, PyTorch, and systems tricks.",
}

// Pull the intro prose and the first fenced code block out of a snippet body.
// Snippets are authored as: a short intro paragraph + exactly one ``` block.
function splitSnippet(body: string): { intro: string; code: string } {
  const fence = body.indexOf("```")
  if (fence === -1) return { intro: body.trim(), code: "" }

  const intro = body.slice(0, fence).trim()
  const rest = body.slice(fence)
  const match = rest.match(/^```[^\n]*\n([\s\S]*?)\n```/)
  return { intro, code: match ? match[1] : "" }
}

export default function SnippetsPage() {
  const snippets = getSnippets()

  return (
    <PageShell
      title="Snippets"
      lede="Small, correct, copy-paste-able pieces of code."
      agentPath={{ json: "/api/snippets" }}
    >
      <ul className="space-y-12">
        {snippets.map((snippet) => {
          const { intro, code } = splitSnippet(snippet.body)
          return (
            <li key={snippet.slug}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-heading text-lg font-semibold text-balance">
                  {snippet.title}
                </h2>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {snippet.lang} · {snippet.date}
                </span>
              </div>

              {snippet.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {snippet.description}
                </p>
              ) : null}

              {intro ? (
                <p className="mt-3 max-w-prose leading-7">{intro}</p>
              ) : null}

              {code ? (
                <div className="mt-4 rounded-md border">
                  <div className="flex items-center justify-between border-b px-3 py-1.5">
                    <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                      {snippet.lang}
                    </span>
                    <CopyButton text={code} />
                  </div>
                  <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                    <code>{code}</code>
                  </pre>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}
