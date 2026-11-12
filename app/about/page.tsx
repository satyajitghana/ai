import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { profile } from "@/data/profile"

// Articles on this site that sit closest to the capture-to-BIM work.
const related = [
  { slug: "3dgs-capture-pipelines", label: "Gaussian-splat capture from a 360 camera" },
  { slug: "gofish-fisheye-gaussian-splatting", label: "GOFish: splats on whole fisheye images" },
  { slug: "kolc-3dgs-bim", label: "KOLC+: Gaussian splats inside BIM" },
  { slug: "spatiallm", label: "SpatialLM: a room scan in, a floor plan out" },
  { slug: "debim", label: "debim: a YAML building language and IFC" },
] as const

export const metadata: Metadata = {
  title: "About",
  description: profile.tagline,
  alternates: { canonical: "/about" },
}

const timeline = [
  {
    period: "2023 →",
    what: "Head of Engineering · Inkers Technology",
    detail:
      "Kaël, Inkers' AI-native PMC platform: architecture, agent backend, frontend and research; reality capture from 360° and fisheye site walks; point-cloud-to-BIM. Earlier: 3D perception, LiDAR pipelines and structural-defect analysis. Two USPTO patents pending.",
  },
  {
    period: "2021 – 23",
    what: "Deep Learning Engineer · Inkers Technology",
    detail:
      "Custom neural networks, deployment pipelines, high-performance C++/gRPC services.",
  },
  {
    period: "2020 – 22",
    what: "MLOps Instructor · The School of AI",
    detail: "Designed and taught EMLO 2.0; contributed to EVA 4.0.",
  },
  {
    period: "2021",
    what: "B.Tech · M.S. Ramaiah University of Applied Sciences",
    detail: "CGPA 9.78/10 — Silver Medalist.",
  },
] as const

export default function Page() {
  return (
    <PageShell
      title="About"
      lede={profile.tagline}
      agentPath={{ md: "/about.md", json: "/api/profile" }}
    >
      <section className="space-y-4">
        {profile.bio.map((para) => (
          <p key={para.slice(0, 24)} className="max-w-prose leading-7">
            {para}
          </p>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground">
          ~/work
        </h2>
        <ul className="space-y-6">
          {profile.work.map((w) => (
            <li key={w.name}>
              <p className="font-medium">
                {w.url ? (
                  <a
                    href={w.url}
                    className="underline underline-offset-4 hover:text-muted-foreground"
                  >
                    {w.name}
                  </a>
                ) : (
                  w.name
                )}{" "}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {w.kind === "inkers" ? "at Inkers" : "indie"} · {w.status}
                </span>
              </p>
              <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
                {w.what}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {w.stack.join(" · ")}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-sm leading-6 text-muted-foreground">
          Related reading here:{" "}
          {related.map((r, i) => (
            <span key={r.slug}>
              <Link
                href={`/articles/${r.slug}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {r.label}
              </Link>
              {i < related.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground">
          ~/timeline
        </h2>
        <ul className="space-y-6">
          {timeline.map((t) => (
            <li key={t.what} className="flex gap-4">
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                {t.period}
              </span>
              <div>
                <p className="font-medium">{t.what}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground">
          ~/elsewhere
        </h2>
        <p className="font-mono text-sm leading-7">
          <a href={profile.links.github} className="underline underline-offset-4 hover:text-muted-foreground">github</a> ·{" "}
          <a href={profile.links.linkedin} className="underline underline-offset-4 hover:text-muted-foreground">linkedin</a> ·{" "}
          <a href={profile.links.x} className="underline underline-offset-4 hover:text-muted-foreground">x</a> ·{" "}
          <a href={profile.links.medium} className="underline underline-offset-4 hover:text-muted-foreground">medium</a> ·{" "}
          <a href={profile.links.scholar} className="underline underline-offset-4 hover:text-muted-foreground">scholar</a> ·{" "}
          <a href={profile.links.website} className="underline underline-offset-4 hover:text-muted-foreground">satyajit.si</a>
        </p>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground">
          ~/this-site
        </h2>
        <p className="max-w-prose leading-7 text-muted-foreground">
          This site is dual-native: every page is a human document and a
          machine-readable artifact, and the whole thing is maintained by a
          crew of Claude agents. Read how it works in the{" "}
          <Link
            href="/colophon"
            className="underline underline-offset-4 hover:text-foreground"
          >
            colophon
          </Link>
          .
        </p>
      </section>
    </PageShell>
  )
}
