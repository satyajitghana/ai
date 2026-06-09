import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"

export const metadata: Metadata = {
  title: "Colophon",
  description:
    "How this site is built — the dual-native thesis, the stack, and the Claude agent crew that maintains it.",
}

function CommandHeader({ cmd }: { cmd: string }) {
  return (
    <h2 className="font-mono mt-12 mb-4 text-xs tracking-wide text-muted-foreground">
      <span className="text-foreground/70">$</span> {cmd}
    </h2>
  )
}

export default function ColophonPage() {
  return (
    <PageShell
      title="Colophon"
      lede="What this site is, how it is built, and who maintains it."
    >
      <CommandHeader cmd="cat thesis.md" />
      <div className="max-w-prose space-y-4 leading-7">
        <p>
          This site is <span className="font-medium">dual-native</span>: every
          page is built to be read by humans and by machines at the same time.
          Humans get a quiet, editorial single column. Agents get the same
          content as structured data — append{" "}
          <span className="font-mono text-sm">.md</span> to any page for clean
          markdown, read{" "}
          <a
            href="/llms.txt"
            className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            /llms.txt
          </a>{" "}
          for the index, query{" "}
          <span className="font-mono text-sm">/api/*</span> for JSON, follow the
          JSON-LD embedded in each page, or call the{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint for agents, not a page */}
          <a
            href="/api/mcp/mcp"
            className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            MCP endpoint
          </a>
          . No separate API to maintain — the website is the API.
        </p>
      </div>

      <CommandHeader cmd="cat stack.md" />
      <ul className="max-w-prose space-y-2 leading-7">
        <li>
          <span className="font-medium">Next.js 16</span> — App Router, React
          Server Components.
        </li>
        <li>
          <span className="font-medium">Tailwind CSS v4</span> with shadcn
          design tokens.
        </li>
        <li>
          <span className="font-medium">MDX</span> for long-form content, with a{" "}
          <span className="font-medium">Zod</span> content layer that validates
          every file&apos;s frontmatter at build time.
        </li>
        <li>
          <span className="font-medium">Hanken Grotesk</span> for headings,{" "}
          <span className="font-medium">IBM Plex Mono</span> for dates, tags, and
          labels.
        </li>
      </ul>

      <CommandHeader cmd="cat crew.md" />
      <div className="max-w-prose space-y-4 leading-7">
        <p>
          The site is authored and maintained by a crew of{" "}
          <span className="font-medium">Claude agents</span>, each a skill with a
          narrow remit — content, profile, paper-scouting, stats, and more.
          Nothing lands on a whim: every change ships as a pull request and has to
          clear the validation gates (typecheck, content-schema validation, lint)
          before it merges.
        </p>
        <p>
          The source is open. Read it, fork it, or watch the agents work in the
          commit history.
        </p>
      </div>

      <p className="mt-12 font-mono text-xs text-muted-foreground">
        <a
          href="https://github.com/satyajitghana/ai"
          className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
        >
          github.com/satyajitghana/ai ↗
        </a>
      </p>
    </PageShell>
  )
}
