import Link from "next/link"

import { models } from "@/data/models"
import { getArchitectureDocs } from "@/lib/content"
import { mathCounts } from "@/lib/math-wall"
import { mediaUrl } from "@/lib/media"

// The site's special pages: the ones that are tools or collections rather than
// a list of posts. Each card shows a screenshot of the page itself, taken at
// 1280px and cropped to its most telling region, from public/thumbs/pages/
// (in R2 like every thumbnail, so always through mediaUrl). A page that themes
// has a light and a dark capture; both are lazy, and the browser skips the one
// that is display:none, so a visitor fetches one image per card.
//
// Server component, no client JS. Stats are counts the build already has.

type Page = {
  href: string
  title: string
  blurb: string
  stat: string
  /** `<name>` for one image, or [light, dark] names. */
  shot: string | [string, string]
}

function pages(rated: number): Page[] {
  const math = mathCounts()
  return [
    {
      href: "/lab/neuron-lab",
      title: "Neuron lab",
      blurb:
        "Search Qwen3's MLP neurons by the words they write, then steer them and watch the text change, in your browser.",
      stat: "runs locally · no server",
      shot: "neuron-lab",
    },
    {
      href: "/models",
      title: "Models",
      blurb:
        "Frontier and open LLMs compared on intelligence, price, speed, latency and context.",
      stat: `${models.length} models`,
      shot: ["models-light", "models-dark"],
    },
    {
      href: "/math",
      title: "AI breakthroughs in mathematics",
      blurb:
        "Every result family in OpenAI's openai/math release, each with a narrated video, our verdict and its Lean status.",
      stat: `${math.families} results · ${math.reels} videos`,
      shot: ["math-light", "math-dark"],
    },
    {
      href: "/architectures",
      title: "Architectures",
      blurb:
        "The building blocks behind modern models, drawn as diagrams and rated on interest and uniqueness.",
      stat: `${getArchitectureDocs().length} full explainers`,
      shot: "architectures",
    },
    {
      href: "/articles/scoring",
      title: "How articles are scored",
      blurb:
        "The eight questions behind every rating, the 0–3 anchors, and how a score becomes a tier.",
      stat: rated ? `${rated} rated articles` : "eight questions, 0–3 each",
      shot: ["scoring-light", "scoring-dark"],
    },
    {
      href: "/developers",
      title: "Developers",
      blurb:
        "The site as an API: JSON endpoints, an MCP server, markdown twins and llms.txt.",
      stat: "no keys · no signup",
      shot: ["developers-light", "developers-dark"],
    },
  ]
}

// Decorative: the heading under each image names the page.
function Shot({ shot }: { shot: Page["shot"] }) {
  const img = (name: string, className: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={name}
      src={mediaUrl(`/thumbs/pages/${name}.jpg`)}
      alt=""
      width={800}
      height={420}
      loading="lazy"
      decoding="async"
      className={className}
    />
  )
  return typeof shot === "string"
    ? img(shot, "block")
    : [img(shot[0], "block dark:hidden"), img(shot[1], "hidden dark:block")]
}

/** `rated`: the number of published articles with a tier, which the home page already has. */
export function ExploreCards({ rated }: { rated: number }) {
  return (
    <section aria-labelledby="explore-heading">
      <div className="mt-16 mb-4">
        <h2
          id="explore-heading"
          className="font-mono text-xs tracking-wide text-muted-foreground"
        >
          ~/explore
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
        {pages(rated).map((p) => (
          <li key={p.href}>
            <Link href={p.href} prefetch={false} className="group block">
              <div className="aspect-[40/21] w-full overflow-hidden rounded-md border bg-muted [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition-opacity group-hover:[&_img]:opacity-90">
                <Shot shot={p.shot} />
              </div>
              <h3 className="mt-2 text-sm leading-snug font-medium underline-offset-4 group-hover:underline sm:text-base">
                {p.title}
              </h3>
              {/* Two columns on a phone leave no room for a blurb; the title and stat carry it. */}
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground max-sm:hidden">
                {p.blurb}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {p.stat}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
