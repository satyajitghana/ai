import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react"
import { Newsreader } from "next/font/google"

import type { ArticleLayoutProps } from "@/components/articles/layouts"
import { CSS } from "@/components/articles/impeccable-design-skill/layout-css"
import { Zoomable } from "@/components/mdx/zoomable"
import { AgentChip } from "@/components/site/agent-chip"
import { ArticleFilm } from "@/components/site/article-film"
import { WhyReadThis } from "@/components/site/why-read-this"
import { displayTags } from "@/data/taxonomy"
import { mediaUrl } from "@/lib/media"

// The page shell for impeccable-design-skill, set by following Impeccable's
// own references (pbakaus/impeccable at d98b0be) rather than the site default.
// mode-read.md:7 is the brief: the world owns the frame (title, section
// openers, quotes, figures, the run log) and the reading column stays calm.
// The world here is a proof sheet: blue-black ink on white, and the
// detector overlay's yellow as the one mark (colorize.md:42).
//
// Reading face: Newsreader, loaded here and nowhere else. typeset.md:57 allows
// a second family only for a role it alone performs; the site's grotesk stays
// the display and interface face, the serif takes the long reading column.
// preload is off because this module is imported by the shared article route:
// a preload would make every other article fetch a font it never uses. The
// @font-face rules alone fetch nothing until this page's class asks for them.
const readingFace = Newsreader({
  subsets: ["latin"],
  variable: "--font-imx-read",
  display: "swap",
  preload: false,
  axes: ["opsz"],
})

const DEK =
  "Paul Bakaus's design skill for coding agents sells itself as the missing design vocabulary. Opened up, it is about 60,000 words of instructions and a 212,000-line Rust linter, and the linter is where most of the new work is."

// The phrase in the title that carries the verdict, set as the one marked
// passage on the page.
const VERDICT = "a linter with opinions"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

function Title({ title }: { title: string }) {
  const i = title.indexOf(": ")
  const name = i > 0 ? title.slice(0, i) : null
  const rest = i > 0 ? title.slice(i + 2) : title
  const j = rest.lastIndexOf(VERDICT)
  return (
    <h1 className="imx-h1">
      {name ? (
        <span className="imx-h1-name">
          {name}
          <span className="imx-sr">: </span>
        </span>
      ) : null}
      <span className="imx-h1-rest">
        {j >= 0 ? (
          <>
            {rest.slice(0, j)}
            <mark>{VERDICT}</mark>
            {rest.slice(j + VERDICT.length)}
          </>
        ) : (
          rest
        )}
      </span>
    </h1>
  )
}

// What each rule asked for, as this page answers it. The values are the
// stylesheet's (layout-css.ts); the measure was counted on a render.
const COLOPHON: [string, ReactNode][] = [
  ["Reading face", <>Newsreader, 19px, for the column only</>],
  ["Display face", <>Hanken Grotesk, the site&rsquo;s own</>],
  ["Measure", <>63 to 73 characters a line (<code>mode-read.md:15</code>)</>],
  ["Scale", <>14, 16, 19, 22, 26, 40, 44 and 96px; four times the space above a heading as below (<code>craft-floor.md:11</code>)</>],
  ["Colour", <>Ink on white, both tinted blue; yellow marks findings and nothing else (<code>colorize.md:42</code>)</>],
  ["Refused", <>Eyebrows, side stripes, nested cards, gradient text (<code>craft-floor.md:25-35</code>)</>],
]

// ---- MDX overrides, used only on this page ----------------------------------

function SectionHeading(props: ComponentPropsWithoutRef<"h2">) {
  return <h2 {...props} className="imx-h2" />
}

type PElement = ReactElement<{ children?: ReactNode }>

// Every quote in the article is one paragraph ending in its source, written
// `"…" (\`file:line\`)`. Split that into the quote and a source line so the
// quote can be set large and the path set as data; anything else renders as
// written.
function PullQuote({ children }: { children?: ReactNode }) {
  const kids = Children.toArray(children)
  let at = kids.length - 1
  while (at >= 0 && !isValidElement(kids[at])) at--
  const p = at >= 0 ? (kids[at] as PElement) : null
  const inner = p ? Children.toArray(p.props.children) : []
  const n = inner.length
  const tail = inner[n - 1]
  const code = inner[n - 2]
  const lead = inner[n - 3]
  if (
    n >= 3 &&
    tail === ")" &&
    isValidElement<{ children?: ReactNode }>(code) &&
    typeof code.props.children === "string" &&
    typeof lead === "string" &&
    /\s\($/.test(lead)
  ) {
    const body: ReactNode[] = [...inner.slice(0, n - 3), lead.replace(/"?\s\($/, "")]
    if (typeof body[0] === "string") body[0] = (body[0] as string).replace(/^"/, "")
    return (
      <blockquote className="imx-pq">
        <p className="imx-pq-text">
          <span className="imx-pq-open" aria-hidden="true">
            &ldquo;
          </span>
          {body}
          <span aria-hidden="true">&rdquo;</span>
        </p>
        <p className="imx-pq-src">
          <code>{code.props.children}</code>
        </p>
      </blockquote>
    )
  }
  return <blockquote className="imx-pq">{children}</blockquote>
}

// How each figure sits. col: in the reading column, caption in the margin on
// wide screens. wide: across the column and both margins. plate: a full-bleed
// band, for the two screenshots of other people's pages.
const FIGURE_SET: Record<string, "col" | "wide" | "plate"> = {
  "fig1.png": "col",
  "fig2.png": "plate",
  "fig3.jpg": "plate",
  "fig5.png": "wide",
  "fig6.png": "wide",
}

function PlateFigure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const set = FIGURE_SET[src.split("/").pop() ?? ""] ?? "wide"
  const img = (
    <Zoomable label="figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(src)} alt={alt} loading="lazy" decoding="async" />
    </Zoomable>
  )
  return (
    <figure className={`imx-fig imx-fig--${set}`}>
      {set === "plate" ? (
        <div className="imx-plate">
          {img}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </div>
      ) : (
        <>
          {img}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </>
      )}
    </figure>
  )
}

const OVERRIDES = {
  h2: SectionHeading,
  blockquote: PullQuote,
  Figure: PlateFigure,
}

// ---- The page ----------------------------------------------------------------

export function ImpeccableLayout({ article, film, Body, endMatter, jsonLd }: ArticleLayoutProps) {
  const tags = displayTags(article.tags)
  return (
    <main className={`imx flex-1 ${readingFace.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {jsonLd}
      <article>
        <header className="imx-hero imx-grid">
          <Title title={article.title} />
          <div className="imx-hero-foot">
            <div>
              <p className="imx-dek">{DEK}</p>
              <p className="imx-meta">
                <time dateTime={article.date}>{longDate(article.date)}</time>
                <span>{article.readingTimeMins} min read</span>
                {tags.length ? <span>{tags.join(", ")}</span> : null}
              </p>
              <div className="imx-chip">
                <AgentChip md={`/articles/${article.slug}.md`} json="/api/articles" />
              </div>
            </div>
            <section className="imx-colo" aria-labelledby="imx-colo-t">
              <h2 id="imx-colo-t" className="imx-colo-t">
                How this page is set
              </h2>
              <dl>
                {COLOPHON.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          {film ? (
            <div className="imx-film">
              <ArticleFilm film={film} title={article.title} />
            </div>
          ) : null}
          <div className="imx-why">
            <WhyReadThis article={article} />
          </div>
        </header>
        <div className="imx-body imx-grid">
          <Body components={OVERRIDES} />
        </div>
      </article>
      <div className="imx-end">{endMatter}</div>
    </main>
  )
}
