"use client"

import { useState } from "react"
import {
  CheckIcon,
  LinkSimpleIcon,
  LinkedinLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"

import { absoluteUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

// Share row for content detail pages. `path` is the page's own path; we build
// the absolute URL so the links work in production regardless of host.
export function ShareButtons({
  path,
  title,
  className,
}: {
  path: string
  title: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const url = absoluteUrl(path)

  // X: the documented web-intent endpoint is /intent/tweet (works on x.com and
  // twitter.com). /intent/post is not a reliable path.
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title
  )}&url=${encodeURIComponent(url)}&via=thesudoer_`
  // LinkedIn share-offsite takes only a url and scrapes the page's Open Graph
  // tags — so the page must be publicly reachable (works once deployed).
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url
  )}`
  // Hacker News submitlink: prefills the submit form with the url + title.
  const hn = `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(
    url
  )}&t=${encodeURIComponent(title)}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-print-hidden
      className={cn(
        "flex items-center gap-3 font-mono text-xs text-muted-foreground",
        className
      )}
    >
      <span className="select-none">share</span>
      <a
        href={x}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on X"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <XLogoIcon size={14} weight="fill" />
      </a>
      <a
        href={linkedin}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on LinkedIn"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <LinkedinLogoIcon size={14} weight="fill" />
      </a>
      <a
        href={hn}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Hacker News"
        title="Share on Hacker News"
        className="group flex items-center transition-colors"
      >
        <span
          aria-hidden
          className="flex h-3.5 w-3.5 items-center justify-center rounded-[2px] text-[9px] font-bold leading-none text-white opacity-70 transition-opacity group-hover:opacity-100"
          style={{ background: "#ff6600" }}
        >
          Y
        </span>
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
      >
        {copied ? (
          <>
            <CheckIcon size={14} weight="bold" /> copied
          </>
        ) : (
          <>
            <LinkSimpleIcon size={14} weight="bold" /> copy link
          </>
        )}
      </button>
    </div>
  )
}
