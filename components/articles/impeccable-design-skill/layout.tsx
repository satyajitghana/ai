import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react"
import { Bodoni_Moda, Fragment_Mono, Jost } from "next/font/google"

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
// mode-read.md:7 is the brief: the world owns the frame (masthead, section
// openers, quotes, figures, the run log) and the reading column stays calm.
//
// The world is a fashion magazine's front of book. "Impeccable" is a word from
// that trade, and the article is a review of taste written down as rules, so
// the frame borrows the trade's own tools: a Didone masthead at cover scale, a
// geometric sans for the text, and one shocking pink.
//
// None of the three faces is on new-work.md:67's list of training-data
// defaults (Fraunces, Playfair, Newsreader, IBM Plex, Space Grotesk, ...) or on
// the detector's overused-font list (crates/foundation/src/constants.rs:85).
// The page's previous design used Newsreader and IBM Plex Mono; both are named.
//
// preload is off because this module is imported by the shared article route:
// a preload would make every other article fetch fonts it never uses. The
// @font-face rules alone fetch nothing until this page's class asks for them.

// Display: masthead, section openers, pull quotes. The optical-size axis is
// the point: the 96 master's hairlines at cover size, a sturdier cut lower down.
const displayFace = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-imx-display",
  style: ["normal"],
  axes: ["opsz"],
  display: "swap",
  preload: false,
})

// Text and interface: the column, captions, controls, the widgets.
const textFace = Jost({
  subsets: ["latin"],
  variable: "--font-imx-text",
  style: ["normal"],
  display: "swap",
  preload: false,
})

// Code, file paths and rule ids only (craft-floor.md:38). One weight.
const codeFace = Fragment_Mono({
  subsets: ["latin"],
  variable: "--font-imx-code",
  weight: "400",
  style: ["normal"],
  display: "swap",
  preload: false,
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
        <span className="imx-mast">
          {name}
          <span className="imx-sr">: </span>
        </span>
      ) : null}
      <span className="imx-claim">
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

// The credits: a magazine says what the cover is wearing in one run-on line,
// so the page says what it is set in the same way, instead of a spec table.
function Credits() {
  return (
    <p className="imx-credits">
      <b>Masthead</b> Bodoni Moda, at its 96-point optical size.{" "}
      <b>Text</b> Jost, 19px, about 66 characters a line.{" "}
      <b>Code</b> Fragment Mono.{" "}
      <b>Colour</b> Ink on white, or white on aubergine, and one shocking pink for the verdict, links
      and findings.{" "}
      <b>Left out</b> Every face on Impeccable&rsquo;s list of training-data defaults, eyebrows, italic
      display, side stripes and cream.
    </p>
  )
}

// ---- MDX overrides, used only on this page ----------------------------------

function SectionHeading(props: ComponentPropsWithoutRef<"h2">) {
  return <h2 {...props} className="imx-h2" />
}

type PElement = ReactElement<{ children?: ReactNode }>

const textLength = (n: ReactNode): number =>
  typeof n === "string"
    ? n.length
    : isValidElement<{ children?: ReactNode }>(n)
      ? Children.toArray(n.props.children).reduce<number>((t, c) => t + textLength(c), 0)
      : 0

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
    // A short sentence is set at display size across the column and its
    // margins; a long passage stays in the column at a reading size.
    const length = body.reduce<number>((t, b) => t + textLength(b), 0)
    return (
      <blockquote className={`imx-pq${length > 200 ? " imx-pq--long" : ""}`}>
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
  const faces = `${displayFace.variable} ${textFace.variable} ${codeFace.variable}`
  return (
    <main className={`imx flex-1 ${faces}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {jsonLd}
      <article>
        <header className="imx-hero">
          <p className="imx-meta">
            <time dateTime={article.date}>{longDate(article.date)}</time>
            <span>{article.readingTimeMins} min read</span>
            {tags.length ? <span>{tags.join(", ")}</span> : null}
          </p>
          <Title title={article.title} />
          <div className="imx-hero-foot">
            <div>
              <p className="imx-dek">{DEK}</p>
              <div className="imx-chip">
                <AgentChip md={`/articles/${article.slug}.md`} json="/api/articles" />
              </div>
            </div>
            <Credits />
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
