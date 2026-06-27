// Looping, muted, inline video for explainers — for real captured animations
// (model outputs, physical demos) that a static figure can't carry. Server-
// rendered <video> with mp4 + webm sources and a poster, so it autoplays where
// supported and degrades to the poster image (and the prose) with no JS / in
// print / for agents. Use for genuine footage; prefer SVG/canvas components for
// things we can draw ourselves.
export function Video({
  src,
  poster,
  alt,
  caption,
}: {
  src: string // path without extension; expects `${src}.mp4` and `${src}.webm`
  poster?: string
  alt?: string
  caption?: string
}) {
  return (
    <figure className="my-8">
      <video
        className="w-full rounded-md border"
        autoPlay
        loop
        muted
        playsInline
        poster={poster}
        aria-label={alt}
      >
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
        {poster ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={poster} alt={alt ?? ""} className="w-full rounded-md border" />
        ) : null}
      </video>
      {caption ? (
        <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
