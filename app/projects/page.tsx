import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getProjects } from "@/lib/content"

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected work — UI libraries, generative tools, 3D/WASM viz, and AI apps.",
  alternates: { canonical: "/projects" },
}

export default function Page() {
  const projects = getProjects()

  return (
    <PageShell
      title="Projects"
      lede="Things I've built — UI libraries, generative and creative tools, 3D/WASM visualizations, and AI apps."
      agentPath={{ json: "/api/projects" }}
    >
      <ul className="space-y-6" data-stagger>
        {projects.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/projects/${p.slug}`}
              className="group flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {p.title}
                  {p.featured ? (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      ★
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {p.stack.slice(0, 4).join(" · ")}
                </p>
                <p className="mt-1 line-clamp-2 leading-7 text-muted-foreground">
                  {p.description}
                </p>
              </div>
              {p.cover ? (
                <div className="relative w-24 shrink-0 overflow-hidden rounded border bg-muted aspect-[16/10] sm:w-32">
                  <Image
                    src={p.cover}
                    alt={`${p.title} screenshot`}
                    fill
                    sizes="112px"
                    className="object-cover transition-opacity group-hover:opacity-90"
                  />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
