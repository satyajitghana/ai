import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getNotes } from "@/lib/content"

export const metadata: Metadata = {
  title: "Notes",
  description:
    "A digital garden of evergreen, interlinked notes on 3D perception, CUDA, and systems.",
}

export default function NotesPage() {
  const notes = getNotes()

  return (
    <PageShell
      title="Notes"
      lede="A digital garden — evergreen notes, interlinked with wikilinks."
      agentPath={{ json: "/api/notes" }}
    >
      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.slug}>
            <Link
              href={`/notes/${note.slug}`}
              className="group flex items-baseline justify-between gap-4"
            >
              <span className="underline-offset-4 group-hover:underline">
                {note.title}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {note.date}
              </span>
            </Link>
            {note.tags.length > 0 ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {note.tags.map((t) => `#${t}`).join(" ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
