import Link from "next/link"

import { AgentChip } from "@/components/site/agent-chip"
import { breadcrumbJsonLd, JsonLd } from "@/lib/jsonld"
import { absoluteMediaUrl } from "@/lib/media"
import {
  DISCIPLINE_ACCENTS,
  KIND_LABEL,
  MATH_ARTICLE,
  MATH_COLLECTION,
  MATH_REPO,
  mathCounts,
  mathResults,
  wallTiles,
} from "@/lib/math-wall"
import { DISCIPLINES } from "@/components/articles/openai-math/catalogue-data"
import { seo } from "@/lib/seo"
import { absoluteUrl, siteUrl } from "@/lib/site"

import { MathWall } from "./math-wall"

const TITLE = MATH_COLLECTION
const DESCRIPTION =
  "Mathematics produced or claimed by AI systems: a short narrated video for each of the 372 result families in OpenAI's openai/math release. Each comes with the claim as we read it, our verdict, its Lean status and its manuscripts, from claimed landmarks to technical lemmas."

export const metadata = seo("/math", TITLE, DESCRIPTION)

// ISO 8601 duration for a video's VideoObject.
const iso = (s: number) => `PT${Math.round(s)}S`

export default function Page() {
  const counts = mathCounts()
  const results = mathResults()

  // An ItemList of every family: a CreativeWork (the claimed result), or a
  // VideoObject where its reel has been rendered. Name and URL only for a
  // family without a reel: the list is serialized twice (HTML and the RSC
  // payload), and the claims are at /api/math, which the page links.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/math"),
    url: absoluteUrl("/math"),
    name: `${TITLE}: openai/math, one short video per claimed result`,
    description: DESCRIPTION,
    isPartOf: { "@id": `${siteUrl}/#website` },
    author: { "@id": `${siteUrl}/#person` },
    about: { "@type": "SoftwareSourceCode", name: "openai/math", codeRepository: MATH_REPO },
    isBasedOn: absoluteUrl(MATH_ARTICLE),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: results.length,
      itemListElement: results.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": r.reel ? "VideoObject" : "CreativeWork",
          url: absoluteUrl(r.url),
          name: `${r.id}. ${r.title}`,
          ...(r.reel
            ? {
                description: r.claim,
                genre: r.discipline,
                contentUrl: absoluteMediaUrl(`/films/math/${r.id}.mp4`),
                thumbnailUrl: absoluteMediaUrl(`/films/math/${r.id}-poster.webp`),
                uploadDate: r.reel.date,
                ...(r.reel.duration ? { duration: iso(r.reel.duration) } : {}),
                encodingFormat: "video/mp4",
              }
            : {}),
        },
      })),
    },
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-4 sm:px-6">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
          { name: "openai/math", path: MATH_ARTICLE },
          { name: TITLE, path: "/math" },
        ])}
      />
      <header className="mb-8 max-w-3xl">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
            {TITLE}
          </h1>
          <AgentChip json="/api/math" />
        </div>
        <p className="mt-3 leading-7 text-muted-foreground">
          Mathematics produced or claimed by AI systems: one short narrated video for every result family in OpenAI&apos;s{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href={MATH_REPO}>
            openai/math
          </a>{" "}
          release. Every tile is a <strong className="font-semibold text-foreground">claim</strong>, not a
          refereed theorem: the grades and verdicts are ours, and{" "}
          <Link className="underline underline-offset-4 hover:text-foreground" href={MATH_ARTICLE}>
            the article
          </Link>{" "}
          explains what the Lean library does and does not certify.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>families</dt>
            <dd className="text-foreground tabular-nums">{counts.families}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>manuscripts</dt>
            <dd className="text-foreground tabular-nums">{counts.manuscripts}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Lean: main theorem</dt>
            <dd className="text-foreground tabular-nums">{counts.leanMain}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Lean: part</dt>
            <dd className="text-foreground tabular-nums">{counts.leanPart}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>videos so far</dt>
            <dd className="text-foreground tabular-nums">{counts.reels}</dd>
          </div>
        </dl>
      </header>
      <MathWall
        tiles={wallTiles()}
        disciplines={[...DISCIPLINES]}
        accents={DISCIPLINE_ACCENTS}
        kinds={KIND_LABEL}
      />
    </main>
  )
}
