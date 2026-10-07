import type { Film } from "@/lib/films"

import { FilmPlayer } from "./film-player"

// The article's explainer film, at the top of the page: the site's player
// (components/site/film-player.tsx) in a figure, with a caption and the
// transcript, which carries every word the narrator says.
//
// `source` names the page the film belongs to in its caption: an article's by
// default, or an architecture doc's.
export function ArticleFilm({ film, title, source = "article" }: { film: Film; title: string; source?: string }) {
  const clock = (s: number) => {
    const t = Math.max(0, Math.floor(s))
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
  }
  return (
    <figure className="mt-8">
      <FilmPlayer
        src={film.src}
        poster={film.poster}
        captions={film.captions}
        duration={film.duration}
        width={film.width}
        height={film.height}
        pixel={film.pixel}
        title={title}
        describedBy="film-transcript"
      />
      <figcaption className="mt-3 text-sm text-muted-foreground">
        <p>
          A {clock(film.duration)} narrated explainer, drawn in code. Every number and picture in it is
          this {source}&apos;s own; the sources are below.
        </p>
        <details className="group/tx mt-1.5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-xs select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="transition-transform group-open/tx:rotate-90">›</span> transcript
          </summary>
          <p id="film-transcript" className="mt-2 max-w-prose border-l-2 pl-3 text-sm leading-relaxed">
            {film.transcript}
          </p>
        </details>
      </figcaption>
    </figure>
  )
}
