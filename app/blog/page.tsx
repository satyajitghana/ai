import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getBlogPosts } from "@/lib/content"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Technical writing on deep learning, 3D perception, CUDA, and systems.",
  alternates: { canonical: "/blog" },
}

export default function Page() {
  const posts = getBlogPosts()

  return (
    <PageShell
      title="Blog"
      lede="Deep learning, 3D perception, CUDA, and the systems that ship them."
      agentPath={{ json: "/api/posts" }}
    >
      <ul className="space-y-8" data-stagger>
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {p.title}
                </h2>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {p.date}
                </span>
              </div>
              <p className="mt-1 leading-7 text-muted-foreground">
                {p.description}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {p.readingTimeMins} min
                {p.tags.length ? ` · ${p.tags.join(" · ")}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
