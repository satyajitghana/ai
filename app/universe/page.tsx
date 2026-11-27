import type { Metadata } from "next"
import Link from "next/link"
import type { WebApplication, WithContext } from "schema-dts"

import { SCENES, sceneSources } from "@/components/universe/script"
import { UniverseDeck } from "@/components/universe/deck"
import { JsonLd } from "@/lib/jsonld"
import { seo } from "@/lib/seo"
import { absoluteUrl, PERSON_ID } from "@/lib/site"

const PATH = "/universe"
const TITLE = "A history of everything, from the Big Bang to today"
const DESC =
  "A talk that runs in the browser: twenty-eight staged scenes from inflation to today. A ruler that gives up, a five-minute kitchen, fog that lifts, the first star, the Moon's impact, an ink plate of Cambrian animals, one bad day, the ages of people from a struck stone to a silicon die, AI on a log axis, and a calendar where we arrive at 23:48 on December 31. Arrow keys to move, A to play by itself, N for speaker notes, S for sources, M for sound."

export const metadata: Metadata = seo(PATH, TITLE, DESC)

const app: WithContext<WebApplication> = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "A history of everything",
  url: absoluteUrl(PATH),
  description: DESC,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any modern browser with WebGPU or WebGL 2",
  isAccessibleForFree: true,
  author: { "@id": PERSON_ID },
}

export default function UniversePage() {
  return (
    <>
      <JsonLd data={app} />
      <UniverseDeck mode="page" />
      {/* The whole talk in plain markup: for readers without WebGPU or WebGL 2, for agents and crawlers. */}
      {/* The whole talk in plain markup: for readers without WebGPU or WebGL 2, for agents and crawlers. */}
      <main id="text-version" className="mx-auto max-w-prose px-6 py-12">
        <h1 className="text-2xl font-bold">A history of everything, from the Big Bang to today</h1>
        <p className="mt-3 leading-7">
          The deck above is a talk in twenty-eight scenes, each one staged on the GPU (WebGPU, or WebGL 2 where a browser lacks it) with its own set, camera and way of arriving, with the type drawn in Canvas 2D and the sound synthesized in the page. There are no images or recordings in it. Arrow keys, space or a click move it on; <kbd>A</kbd> plays it by itself, <kbd>N</kbd> shows the speaker notes, <kbd>S</kbd> the sources, <kbd>M</kbd> turns the sound on, <kbd>F</kbd> goes full screen. The corner of each slide prints a clock in place of a page number. Scenes marked &ldquo;illustration&rdquo; are staged drawings of an idea, not measurements. It was made after{" "}
          <Link href="/articles/the-last-boring-slide">The Last Boring Slide</Link>, to test how a deck like that is built. What follows is every line and every speaker note, in order.
        </p>
        <ol className="mt-8 space-y-8">
          {SCENES.map((sc) => (
            <li key={sc.id} id={`text-${sc.id}`}>
              <h2 className="text-lg font-semibold">
                {sc.title} <span className="font-normal text-muted-foreground">· {sc.when}</span>
              </h2>
              {sc.beats.map((b, i) => (
                <div key={i} className="mt-3">
                  <p className="font-medium">
                    {b.head}
                    {b.ill && <span className="ml-2 text-xs uppercase text-muted-foreground">illustration</span>}
                  </p>
                  {b.sub && <p className="text-muted-foreground">{b.sub}</p>}
                  <p className="mt-1 leading-7">{b.note}</p>
                </div>
              ))}
              {sceneSources(sc).length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Sources:{" "}
                  {sceneSources(sc).map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && "; "}
                      <a href={s.url} className="underline" rel="noreferrer">
                        {s.label}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ol>
      </main>
    </>
  )
}
