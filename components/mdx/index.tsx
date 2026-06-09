import type { MDXComponents } from "mdx/types"
import type { ComponentPropsWithoutRef } from "react"

import { AttentionMatrix } from "@/components/mdx/attention-matrix"
import { CoroutineStepper } from "@/components/mdx/coroutine-stepper"
import { Diagram } from "@/components/mdx/diagram"
import { Plot } from "@/components/mdx/plot"
import { StepThrough } from "@/components/mdx/step-through"
import { cn } from "@/lib/utils"

// Editorial × terminal element styling for MDX-rendered markdown.
// Headings use the grotesk (font-heading), code/inline-mono use IBM Plex.
// The interactive explainer kit (Callout, Figure, …) is registered here too;
// richer interactive components (AttentionMatrix, StepThrough, Plot) land in
// their own files under components/mdx/ and get added to `mdxComponents`.

function Callout({
  type = "note",
  children,
}: {
  type?: "note" | "warn" | "tip"
  children: React.ReactNode
}) {
  const label = { note: "note", warn: "warning", tip: "tip" }[type]
  return (
    <aside
      data-callout={type}
      className={cn(
        "my-6 border-l-2 pl-4",
        type === "warn" ? "border-destructive" : "border-foreground/30"
      )}
    >
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="mt-1 [&>p]:my-0">{children}</div>
    </aside>
  )
}

function Figure({
  src,
  alt,
  caption,
}: {
  src: string
  alt: string
  caption?: string
}) {
  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full rounded-md border" />
      {caption ? (
        <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

export const mdxComponents: MDXComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="font-heading mt-10 mb-4 scroll-mt-24 text-3xl font-bold tracking-tight text-balance"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="font-heading mt-10 mb-3 scroll-mt-24 text-2xl font-semibold tracking-tight"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="font-heading mt-8 mb-2 scroll-mt-24 text-xl font-semibold"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-7" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 list-disc space-y-1 pl-6" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 list-decimal space-y-1 pl-6" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-6 border-l-2 border-foreground/20 pl-4 text-muted-foreground italic"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="font-mono text-[0.9em] [:not(pre)>&]:rounded [:not(pre)>&]:bg-muted [:not(pre)>&]:px-1.5 [:not(pre)>&]:py-0.5"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="my-6 overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-sm"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border" />,
  // GFM tables — remark-gfm emits real <table> markup; style it to match.
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<"thead">) => (
    <thead className="border-b" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="px-3 py-2 text-left font-mono text-xs font-medium tracking-wide text-muted-foreground"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-t px-3 py-2 align-top" {...props} />
  ),
  Callout,
  Figure,
  // Interactive explainer kit — every component degrades to meaningful static
  // output (SSR/no-JS), and the .md agent variants carry the raw prose anyway.
  AttentionMatrix,
  CoroutineStepper,
  Diagram,
  Plot,
  StepThrough,
}
