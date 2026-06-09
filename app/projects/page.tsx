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
      <ul className="space-y-10">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/projects/${p.slug}`} className="group block">
              {p.cover ? (
                <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-md border bg-muted">
                  <Image
                    src={p.cover}
                    alt={`${p.title} screenshot`}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover transition-opacity group-hover:opacity-90"
                  />
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {p.title}
                  {p.featured ? (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      ★
                    </span>
                  ) : null}
                </h2>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {p.stack.slice(0, 4).join(" · ")}
                </span>
              </div>
              <p className="mt-1 leading-7 text-muted-foreground">
                {p.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
