import { paperLinks, type PaperEntry } from "@/lib/content/schema"
import { cn } from "@/lib/utils"

export function PaperCard({ paper }: { paper: PaperEntry }) {
  const links = paperLinks(paper.arxivId)

  return (
    <article
      className={cn(
        "rounded-md border p-4",
        paper.standout && "border-foreground/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading font-semibold text-balance">
          {paper.standout ? <span title="standout">★ </span> : null}
          {paper.title}
        </h3>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {paper.arxivId.replace(/v\d+$/, "")}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {paper.authors.slice(0, 4).join(", ")}
        {paper.authors.length > 4 ? " et al." : ""}
        {paper.categories.length ? ` · ${paper.categories.join(" ")}` : ""}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
        {paper.abstract}
      </p>
      <p className="mt-3 border-l-2 border-foreground/30 pl-3 text-sm leading-6">
        <span className="font-mono text-xs text-muted-foreground">take · </span>
        {paper.take}
      </p>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        <a
          href={links.abs}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          abs
        </a>{" "}
        ·{" "}
        <a
          href={links.pdf}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          pdf
        </a>{" "}
        ·{" "}
        <a
          href={links.html}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          html
        </a>{" "}
        ·{" "}
        <a
          href={links.ar5iv}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          ar5iv
        </a>
      </p>
    </article>
  )
}
