"use client"

import { useEffect, useRef, useState } from "react"

import type { Film } from "@/lib/films"

// The article's explainer film, at the top of the page.
//
// Two ways to watch it, because they want opposite things:
//   ambient   muted and looping, playing only while it is on screen — the
//             painted on-screen text carries the argument without sound
//   sound on  the reader asked for the narration: restart from the top, play
//             once, show the captions, and stop at the end rather than loop
// It never starts on its own for a reader who asked for reduced motion, and
// anything that moves for more than five seconds needs a way to stop it
// (WCAG 2.2.2), so there is always a pause. With no JavaScript it is a plain
// video with native controls, the poster and a captions track, and the
// transcript below carries every word the narrator says.
export function ArticleFilm({ film, title }: { film: Film; title: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const held = useRef(false) // the reader paused it: don't restart on scroll
  const [hydrated, setHydrated] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)

  useEffect(() => {
    setHydrated(true)
    const v = ref.current
    if (!v) return
    const track = v.textTracks[0]
    if (track) track.mode = "hidden"
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) v.pause()
        else if (!held.current && v.muted) v.play().catch(() => {})
      },
      { threshold: 0.5 }
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  const setCaptions = (on: boolean) => {
    const track = ref.current?.textTracks[0]
    if (track) track.mode = on ? "showing" : "hidden"
  }

  const togglePlay = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      held.current = false
      v.play().catch(() => {})
    } else {
      held.current = true
      v.pause()
    }
  }

  const toggleSound = () => {
    const v = ref.current
    if (!v) return
    if (!sound) {
      v.muted = false
      v.loop = false
      v.currentTime = 0
      setCaptions(true)
      setSound(true)
      held.current = false
      v.play().catch(() => {})
    } else {
      v.muted = true
      v.loop = true
      setCaptions(false)
      setSound(false)
    }
  }

  const secs = Math.round(film.duration)
  const btn =
    "rounded border bg-background/85 px-2 py-0.5 font-mono text-xs text-foreground backdrop-blur-sm hover:bg-background"
  return (
    <figure className="mt-6">
      <div className="relative">
        <video
          ref={ref}
          className={`aspect-video w-full rounded-md border bg-muted${film.pixel ? " [image-rendering:pixelated]" : ""}`}
          width={film.width}
          height={film.height}
          poster={film.poster}
          muted
          loop
          playsInline
          preload="none"
          controls={!hydrated}
          aria-label={`${secs}-second narrated summary film: ${title}`}
          aria-describedby="film-transcript"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            // a narrated viewing plays once; afterwards it goes back to ambient
            const v = ref.current
            if (!v) return
            v.muted = true
            v.loop = true
            setCaptions(false)
            setSound(false)
            held.current = true
          }}
        >
          <source src={film.src} type="video/mp4" />
          <track kind="captions" src={film.captions} srcLang="en" label="English" />
        </video>
        {hydrated ? (
          <div className="absolute right-2 bottom-3 flex gap-1.5">
            <button type="button" onClick={toggleSound} aria-pressed={sound} className={btn}>
              {sound ? "sound off" : "sound on"}
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause the film" : "Play the film"}
              className={btn}
            >
              {playing ? "pause" : "play"}
            </button>
          </div>
        ) : null}
      </div>
      <figcaption className="mt-2 font-mono text-xs text-muted-foreground">
        A {secs}-second narrated explainer, drawn in code. Every figure in it is
        this article&apos;s own; the sources are below.
        <details className="mt-1">
          <summary className="cursor-pointer select-none">transcript</summary>
          <p id="film-transcript" className="mt-1 font-sans text-sm leading-relaxed">
            {film.transcript}
          </p>
        </details>
      </figcaption>
    </figure>
  )
}
