// Inline video for explainers — for real captured animations (model outputs,
// physical demos) and drawn films that a static figure can't carry. Server-
// rendered <video> with mp4 + webm sources and a poster, so it degrades to the
// poster image (and the prose) with no JS / in print / for agents.
//
// Two modes, because they want opposite things:
//
//   default    silent, muted, autoplaying, looping. An ambient illustration
//              that costs the reader nothing and asks nothing of them.
//   narrated   has a voice track, so autoplay would be both useless (browsers
//              only autoplay muted) and rude. Gets controls and waits to be
//              started, and takes a `captions` VTT so the narration is
//              readable as well as audible.
export function Video({
  src,
  poster,
  alt,
  caption,
  narrated = false,
  captions,
}: {
  src: string // path without extension; expects `${src}.mp4` and `${src}.webm`
  poster?: string
  alt?: string
  caption?: string
  narrated?: boolean
  captions?: string // WebVTT track; only meaningful with `narrated`
}) {
  return (
    <figure className="my-8">
      <video
        className="w-full rounded-md border"
        autoPlay={!narrated}
        loop={!narrated}
        muted={!narrated}
        controls={narrated}
        preload={narrated ? "metadata" : undefined}
        playsInline
        poster={poster}
        aria-label={alt}
      >
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
        {captions ? (
          <track kind="captions" src={captions} srcLang="en" label="English" default />
        ) : null}
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
