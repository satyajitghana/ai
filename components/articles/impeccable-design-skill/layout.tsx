import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Bodoni_Moda, Fragment_Mono, Jost } from "next/font/google"

import type { ArticleLayoutProps } from "@/components/articles/layouts"
import { CSS } from "@/components/articles/impeccable-design-skill/layout-css"
import { SectionRail } from "@/components/articles/impeccable-design-skill/section-rail"
import { Zoomable } from "@/components/mdx/zoomable"
import { RepoCard } from "@/components/mdx/repo-card"
import { AgentChip } from "@/components/site/agent-chip"
import { ArticleFilm } from "@/components/site/article-film"
import { RubricDots, SCORING_PATH } from "@/components/site/article-rating"
import { WhyReadThis } from "@/components/site/why-read-this"
import { profile } from "@/data/profile"
import { displayTags, topicById } from "@/data/taxonomy"
import type { Article } from "@/lib/content"
import { highlights, practicalFacts, tierBand } from "@/lib/content/rating"
import { articleScores, getArticleScore } from "@/lib/content/signals"
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
  "Paul Bakaus’s design skill for coding agents sells itself as the missing design vocabulary. Opened up, it is about 60,000 words of instructions and a 212,000-line Rust linter, and the linter is where most of the new work is."

// The phrase in the title that carries the verdict, set as the one marked
// passage on the page.
const VERDICT = "a linter with opinions"

// The one paragraph of the body set as a spread: the article's answer to the
// question it opens with. Matched on its first words so the MDX stays prose.
const THESIS = "That answers the question I came with."

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

// ---- Punctuation ---------------------------------------------------------------
// The MDX is written with typewriter quotes. On this page they are set as
// typographer's quotes: a quote mark opens after a space, an opening bracket,
// a dash or another opening quote, and closes everywhere else; an apostrophe
// is a closing single quote. Code is never touched, and the scan carries the
// last character across element boundaries, so `"SERVICE"` around a code span
// or a link still pairs correctly.

const OPENS_AFTER = /[\s([{—–“‘/-]/

type Scan = { prev: string }

function curl(text: string, scan: Scan): string {
  let out = ""
  for (const ch of text) {
    if (ch === '"' || ch === "'") {
      const opening = scan.prev === "" || OPENS_AFTER.test(scan.prev)
      out += ch === '"' ? (opening ? "“" : "”") : opening ? "‘" : "’"
    } else {
      out += ch
    }
    scan.prev = out.slice(-1)
  }
  return out
}

function Code(props: ComponentPropsWithoutRef<"code">) {
  return <code {...props} />
}

function isCode(n: ReactElement): boolean {
  return n.type === "code" || n.type === "pre" || n.type === Code
}

function smarten(node: ReactNode, scan: Scan): ReactNode {
  if (typeof node === "string") return curl(node, scan)
  if (typeof node === "number") {
    scan.prev = String(node).slice(-1)
    return node
  }
  if (Array.isArray(node)) return node.map((n) => smarten(n, scan))
  if (!isValidElement<{ children?: ReactNode }>(node)) return node
  if (isCode(node)) {
    // A code span reads as a word: a quote straight after it closes.
    scan.prev = "x"
    return node
  }
  if (node.props.children === undefined) return node
  const kids = Children.toArray(node.props.children).map((c) => smarten(c, scan))
  return cloneElement(node, undefined, ...kids)
}

const smart = (children: ReactNode): ReactNode => smarten(Children.toArray(children), { prev: "" })

const textOf = (n: ReactNode): string =>
  typeof n === "string" || typeof n === "number"
    ? String(n)
    : Array.isArray(n)
      ? n.map(textOf).join("")
      : isValidElement<{ children?: ReactNode }>(n)
        ? textOf(Children.toArray(n.props.children))
        : ""

// ---- The opener ------------------------------------------------------------------

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

// The rating, set as a review's verdict box instead of the site's "Why read
// this" card: the tier in the Didone and the pink, the editor's one line, what
// the page gives a reader, and the scoring behind a disclosure. The facts and
// the links are the same ones WhyReadThis prints; an unrated article falls
// back to it.
function Verdict({ article }: { article: Article }) {
  const s = getArticleScore(article.slug)
  const rating = article.rating
  if (!rating || !s.tier || s.score === null) {
    return (
      <div className="imx-why">
        <WhyReadThis article={article} />
      </div>
    )
  }
  const band = tierBand(s.tier.id)
  const rated = [...articleScores().values()].filter((x) => x.rank !== null).length
  const topic = article.topic ? topicById(article.topic) : undefined
  const hs = highlights(rating, article.runsOn)
  const facts = practicalFacts({
    runsOn: article.runsOn,
    licence: article.licence,
    level: article.level,
    kind: article.articleKind,
  }).filter((f) => !hs.some((h) => h.text === f))
  return (
    <section className="imx-verdict" aria-labelledby="why-read-this">
      <div className="imx-verdict-head">
        <h2 id="why-read-this" className="imx-verdict-h">
          The verdict
        </h2>
        <p className="imx-verdict-tier">
          <Link href={`${SCORING_PATH}#tiers`}>{s.tier.label}</Link>
        </p>
        <p className="imx-verdict-band">
          {band.long.charAt(0).toUpperCase() + band.long.slice(1)}
        </p>
      </div>
      <div className="imx-verdict-body">
        <p className="imx-verdict-why">{smart(rating.why)}</p>
        {hs.length ? (
          <ul className="imx-verdict-list" aria-label="Highlights">
            {hs.map((h) => (
              <li key={h.key}>{h.text}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="imx-verdict-facts">
        <p>
          {topic ? (
            <>
              <Link href={`/articles?topic=${topic.id}`}>{topic.label}</Link>
              {facts.length ? <span aria-hidden="true"> · </span> : null}
            </>
          ) : null}
          {facts.join(" · ")}
        </p>
        <details className="imx-verdict-score">
          <summary>How this was scored</summary>
          <RubricDots rating={rating} className="imx-rubric" />
          <p>
            Score {Math.round(s.score)} of 100, ranked {s.rank} of {rated} rated articles. Each
            question is answered 0&ndash;3 by hand, and a 3 is rare.{" "}
            <Link href={SCORING_PATH}>How articles are scored</Link>
          </p>
        </details>
      </div>
    </section>
  )
}

// ---- MDX overrides, used only on this page ----------------------------------

function SectionHeading({ children, ...props }: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2 {...props} className="imx-h2">
      {smart(children)}
    </h2>
  )
}

function Para({ children, ...props }: ComponentPropsWithoutRef<"p">) {
  const kids = smart(children)
  if (textOf(children).startsWith(THESIS)) {
    return (
      <p {...props} className="imx-spread">
        <span className="imx-spread-in">{kids}</span>
      </p>
    )
  }
  return <p {...props}>{kids}</p>
}

function Item({ children, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li {...props}>{smart(children)}</li>
}

type PElement = ReactElement<{ children?: ReactNode }>

const textLength = (n: ReactNode): number => textOf(n).length

// Every quote in the article is one paragraph ending in its source, written
// `"…" (\`file:line\`)`. Split that into the quote and a source line so the
// quote can be set large and the path set as data; anything else renders as
// written.
function PullQuote({ children }: { children?: ReactNode }) {
  const kids = Children.toArray(children)
  let at = kids.length - 1
  while (at >= 0 && !isValidElement(kids[at])) at--
  const p = at >= 0 ? (kids[at] as PElement) : null
  // The paragraph inside is MDX's own element (Para has not run yet), so its
  // children are the raw text, typewriter quotes included.
  const inner = p ? Children.toArray(p.props.children) : []
  const n = inner.length
  const tail = inner[n - 1]
  const code = inner[n - 2]
  const lead = inner[n - 3]
  if (
    n >= 3 &&
    typeof tail === "string" &&
    tail.trim() === ")" &&
    isValidElement<{ children?: ReactNode }>(code) &&
    typeof code.props.children === "string" &&
    typeof lead === "string" &&
    /\s\($/.test(lead)
  ) {
    const body: ReactNode[] = [...inner.slice(0, n - 3), lead.replace(/["”]?\s\($/, "")]
    if (typeof body[0] === "string") body[0] = (body[0] as string).replace(/^["“]/, "")
    // A short sentence is set at display size beside the column, hung into
    // one margin; a long passage stays in the column at a reading size.
    const length = body.reduce<number>((t, b) => t + textLength(b), 0)
    return (
      <blockquote className={`imx-pq ${length > 200 ? "imx-pq--long" : "imx-pq--short"}`}>
        <p className="imx-pq-text">
          <span className="imx-pq-open" aria-hidden="true">
            &ldquo;
          </span>
          {smart(body)}
          <span aria-hidden="true">&rdquo;</span>
        </p>
        <p className="imx-pq-src">
          <code>{code.props.children}</code>
        </p>
      </blockquote>
    )
  }
  return <blockquote className="imx-pq imx-pq--long">{children}</blockquote>
}

// How each figure sits. On wide screens every caption is a side-note: "right"
// sets the image across the left margin and the column with the caption in
// the right margin, "left" the mirror of that, and "plate" a full-bleed band
// with the caption beside the image, for the two screenshots of other
// people's pages. Below 64rem every caption sits under its image.
const FIGURE_SET: Record<string, "right" | "left" | "plate"> = {
  "fig1.png": "right",
  "fig2.png": "plate",
  "fig3.jpg": "plate",
  "fig5.png": "left",
  "fig6.png": "right",
}

function PlateFigure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const set = FIGURE_SET[src.split("/").pop() ?? ""] ?? "right"
  const cap = caption ? <figcaption>{smart(caption)}</figcaption> : null
  const img = (
    <div className="imx-fig-img">
      <Zoomable label="figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(src)} alt={alt} loading="lazy" decoding="async" />
      </Zoomable>
    </div>
  )
  return (
    <figure className={`imx-fig imx-fig--${set}`}>
      {set === "plate" ? (
        <div className="imx-plate">
          {img}
          {cap}
        </div>
      ) : (
        <>
          {img}
          {cap}
        </>
      )}
    </figure>
  )
}

// The repo card is the site's own; wrapped so the page can set it as a fact
// file without reaching into every other article's copy.
function FactFile(props: ComponentPropsWithoutRef<typeof RepoCard>) {
  return (
    <div className="imx-repo">
      <RepoCard {...props} />
    </div>
  )
}

const OVERRIDES = {
  h2: SectionHeading,
  p: Para,
  li: Item,
  code: Code,
  blockquote: PullQuote,
  Figure: PlateFigure,
  RepoCard: FactFile,
}

// ---- The page ----------------------------------------------------------------

export function ImpeccableLayout({ article, film, Body, endMatter, jsonLd }: ArticleLayoutProps) {
  const tags = displayTags(article.tags)
  const topic = article.topic ? topicById(article.topic) : undefined
  const faces = `${displayFace.variable} ${textFace.variable} ${codeFace.variable}`
  return (
    <main className={`imx flex-1 ${faces}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {jsonLd}
      <article>
        <header className="imx-hero">
          <p className="imx-folio">
            <span>
              <span className="imx-folio-kind">Review</span>
              {topic ? (
                <>
                  <span aria-hidden="true"> · </span>
                  {topic.label}
                </>
              ) : null}
            </span>
            <time dateTime={article.date}>{longDate(article.date)}</time>
          </p>
          <Title title={article.title} />
          <p className="imx-stand">{DEK}</p>
          <div className="imx-aside">
            <p className="imx-byline">
              By <span className="imx-byline-name">{profile.name}</span>
            </p>
            <p className="imx-aside-meta">
              {article.readingTimeMins} min read
              {tags.length ? (
                <>
                  <span aria-hidden="true"> · </span>
                  filed under {tags.join(", ")}
                </>
              ) : null}
            </p>
            <p className="imx-chip">
              <span className="imx-chip-l">For agents</span>{" "}
              <AgentChip md={`/articles/${article.slug}.md`} json="/api/articles" />
            </p>
            <Credits />
          </div>
          {film ? (
            <div className="imx-film">
              <ArticleFilm film={film} title={article.title} />
            </div>
          ) : null}
          <Verdict article={article} />
        </header>
        <div className="imx-body imx-grid">
          <Body components={OVERRIDES} />
        </div>
      </article>
      <SectionRail />
      <div className="imx-end">{endMatter}</div>
    </main>
  )
}
