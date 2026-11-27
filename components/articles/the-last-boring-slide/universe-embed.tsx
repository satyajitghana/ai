"use client"

import { useState } from "react"

import { UniverseDeck } from "@/components/universe/deck"

// The /universe deck, embedded. It starts only when asked, so the article does not load three.js
// or compile shaders for a reader who scrolls past. Keys work while the deck has focus (click it).
export function UniverseEmbed() {
  const [on, setOn] = useState(false)
  return (
    <figure className="not-prose my-8">
      {on ? (
        <UniverseDeck mode="embed" />
      ) : (
        <button
          type="button"
          onClick={() => setOn(true)}
          className="grid aspect-video w-full place-content-center rounded-lg border border-border bg-white text-center text-black"
        >
          <span className="font-[Arial,Helvetica,sans-serif] text-2xl sm:text-4xl">A Brief History of Everything.</span>
          <span className="mt-2 font-[Arial,Helvetica,sans-serif] text-sm text-neutral-500 sm:text-lg">An Overview. Click to start.</span>
        </button>
      )}
      <figcaption className="mt-2 text-sm text-muted-foreground">
        A deck built the way this article describes, for this site: twenty-eight staged scenes, each with its own set, camera and way of arriving, type in Canvas 2D, sound synthesized in the page, a speaker note per beat. Click it, then use the arrow keys; <kbd>A</kbd> plays it by itself, <kbd>N</kbd> shows notes, <kbd>S</kbd> sources, <kbd>M</kbd> sound, <kbd>F</kbd> full screen. Full page: <a className="underline" href="/universe">/universe</a>.
      </figcaption>
    </figure>
  )
}
