"use client"

import { Fragment, useState, type ReactNode } from "react"
import {
  BinaryIcon,
  BracketsCurlyIcon,
  FileCodeIcon,
  FileHtmlIcon,
  FileJsIcon,
  FolderIcon,
  GlobeIcon,
  ImageIcon,
  TextAaIcon,
  CloudArrowDownIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

import { EXCERPTS, WASM, type Excerpt } from "./file-explorer-data"
import { SITE, type FileEntry, type Kind } from "./file-explorer-tree"
import { TreeView, type TreeItem } from "./tree-view"

// The files playgta5.com served, as an IDE-style tree, with the same excerpts the article
// quotes. game.wasm is shown from its section headers and name section only.

const ICON_COLOR: Record<Kind, string> = {
  folder: "oklch(0.7 0.12 75)",
  html: "oklch(0.64 0.17 35)",
  js: "oklch(0.72 0.14 95)",
  wasm: "oklch(0.58 0.16 285)",
  json: "oklch(0.62 0.12 200)",
  shader: "oklch(0.6 0.14 150)",
  font: "oklch(0.6 0.05 250)",
  image: "oklch(0.62 0.13 330)",
  endpoint: "oklch(0.6 0.05 250)",
}

function KindIcon({ kind, className = "size-3.5" }: { kind: Kind; className?: string }) {
  const style = { color: ICON_COLOR[kind] }
  switch (kind) {
    case "folder":
      return <FolderIcon weight="fill" className={className} style={style} />
    case "html":
      return <FileHtmlIcon weight="duotone" className={className} style={style} />
    case "js":
      return <FileJsIcon weight="duotone" className={className} style={style} />
    case "wasm":
      return <BinaryIcon weight="bold" className={className} style={style} />
    case "json":
      return <BracketsCurlyIcon weight="bold" className={className} style={style} />
    case "shader":
      return <FileCodeIcon weight="duotone" className={className} style={style} />
    case "font":
      return <TextAaIcon weight="bold" className={className} style={style} />
    case "image":
      return <ImageIcon weight="duotone" className={className} style={style} />
    case "endpoint":
      return <CloudArrowDownIcon weight="bold" className={className} style={style} />
  }
}

type Found = { entry: FileEntry; path: FileEntry[] }
const INDEX = new Map<string, Found>()
function toItems(entries: FileEntry[], path: FileEntry[]): TreeItem[] {
  return entries.map((e) => {
    INDEX.set(e.id, { entry: e, path: [...path, e] })
    return {
      id: e.id,
      label: e.name,
      icon: <KindIcon kind={e.kind} />,
      meta: e.size,
      dim: e.virtual,
      children: e.children ? toItems(e.children, [...path, e]) : undefined,
    }
  })
}
const ITEMS = toItems(SITE, [])

const fmtBytes = (n: number) => n.toLocaleString("en-US")

// Dim a trailing // comment (outside quotes) so the code reads like an editor, without a highlighter.
function splitComment(line: string): [string, string] {
  let q: string | null = null
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i]
    if (q) {
      if (c === "\\") i++
      else if (c === q) q = null
    } else if (c === "'" || c === '"' || c === "`") q = c
    else if (c === "/" && line[i + 1] === "/") return [line.slice(0, i), line.slice(i)]
  }
  return [line, ""]
}

function Editor({ title, start, code, lang }: { title: string; start: number; code: string; lang: string }) {
  const lines = code.split("\n")
  const end = start + lines.length - 1
  const gutter = String(end).length
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        <span className="truncate text-foreground">{title}</span>
        <span className="shrink-0">
          :{start}
          {end > start ? `-${end}` : ""}
        </span>
        <span className="ml-auto shrink-0 uppercase">{lang}</span>
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${title}, lines ${start} to ${end}`}>
        <pre className="m-0 min-w-max bg-transparent p-0 py-2 font-mono text-[11.5px] leading-[1.6]">
          <code>
            {lines.map((l, i) => {
              const [body, comment] = splitComment(l)
              return (
                <div key={i} className="flex">
                  <span
                    aria-hidden
                    className="sticky left-0 shrink-0 border-r bg-background pr-3 pl-3 text-right text-muted-foreground/70 select-none"
                    style={{ width: `${gutter + 2.5}ch` }}
                  >
                    {start + i}
                  </span>
                  <span className="pr-4 pl-3 whitespace-pre">
                    {body}
                    {comment && <span className="text-muted-foreground italic">{comment}</span>}
                  </span>
                </div>
              )
            })}
          </code>
        </pre>
      </div>
    </div>
  )
}

function ExcerptBlock({ ex }: { ex: Excerpt }) {
  return (
    <div className="flex flex-col gap-2">
      <Editor title={ex.file} start={ex.start} code={ex.code} lang={ex.lang} />
      <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{ex.why}</p>
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{children}</div>
}

function WasmView() {
  const total = WASM.sections.reduce((a, s) => a + (s[1] as number), 0)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>sections, 63,201,802 bytes in all</Label>
        <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="game.wasm sections">
          <table className="m-0 w-full border-collapse font-mono text-[11.5px]">
            <tbody>
              {WASM.sections.map(([name, bytes, note]) => {
                const pct = ((bytes as number) / total) * 100
                return (
                  <tr key={name as string} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5">
                      <span className="whitespace-nowrap">{name}</span>
                      {note && (
                        <span className="block font-sans text-[12px] leading-snug text-muted-foreground">{note}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right align-top whitespace-nowrap tabular-nums">{fmtBytes(bytes as number)}</td>
                    <td className="w-1/4 min-w-12 py-1.5 pr-3 align-top">
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(pct, 0.4).toFixed(2)}%`, background: ICON_COLOR.wasm }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <Label>imports: 86, grouped</Label>
        <div className="divide-y rounded-lg border">
          {WASM.imports.map(([mod, group, count, what]) => (
            <div key={group} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-3 py-2 text-[13px]">
              <span className="text-right font-mono tabular-nums">{count}</span>
              <span>
                <span className="font-mono text-[11.5px] text-muted-foreground">{mod}</span> · {group}
                <span className="block text-muted-foreground">{what}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>exports</Label>
        <p className="m-0 text-[13px] leading-relaxed">{WASM.exports}</p>
      </div>
      <div>
        <Label>14 of the 91,111 names</Label>
        <div className="overflow-x-auto rounded-lg border bg-background" tabIndex={0} role="region" aria-label="Sample function names">
          <ul className="m-0 min-w-max list-none p-0 py-2 font-mono text-[11.5px] leading-[1.7]">
            {WASM.names.map((n) => (
              <li key={n} className="m-0 px-3 whitespace-pre">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Detail({ found }: { found: Found }) {
  const { entry: e, path } = found
  const crumbs = path.map((p) => p.name.replace(/\/$/, "")).filter((n) => n !== "/")
  return (
    <div className="flex flex-col gap-4 p-4" aria-live="polite">
      <nav aria-label="Path" className="flex flex-wrap items-center gap-x-1 font-mono text-[11px] text-muted-foreground">
        <GlobeIcon aria-hidden className="size-3.5" />
        <span>playgta5.com</span>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <span>/</span>
            <span className={i === crumbs.length - 1 ? "text-foreground" : undefined}>{c}</span>
          </Fragment>
        ))}
      </nav>
      <div className="flex items-start gap-2.5">
        <KindIcon kind={e.kind} className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold break-all">{e.name}</div>
          <div className="text-[13px] text-muted-foreground">
            {e.role}
            {e.size ? ` · ${e.size}` : ""}
            {e.virtual ? " · an endpoint, not a file" : ""}
          </div>
        </div>
      </div>
      {e.about && <p className="m-0 text-sm leading-relaxed">{e.about}</p>}
      {e.talks && (
        <div>
          <Label>talks to the others through</Label>
          <p className="m-0 text-sm leading-relaxed">{e.talks}</p>
        </div>
      )}
      {e.facts && (
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[13px]">
          {e.facts.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="m-0 font-mono text-[12px] tabular-nums">{v}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {e.sample && <Editor title={`${e.name} · ${e.sample.label}`} start={1} code={e.sample.code} lang={e.sample.lang} />}
      {e.wasm && <WasmView />}
      {e.excerpts?.map((id) => <ExcerptBlock key={id} ex={EXCERPTS[id]} />)}
      {e.children && (
        <div>
          <Label>contains</Label>
          <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
            {e.children.map((c) => (
              <li key={c.id} className="m-0 flex items-center gap-2 p-0">
                <KindIcon kind={c.kind} />
                <span className="font-mono text-[12px]">{c.name}</span>
                <span className="truncate text-muted-foreground">{c.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const [sel, setSel] = useState("loader")
  const found = INDEX.get(sel) ?? INDEX.get("loader")!
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <GlobeIcon aria-hidden className="size-3.5" />
        <span className="text-foreground">playgta5.com</span>
        <span className="ml-auto">as served on 6 October 2026</span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="max-h-[26rem] overflow-y-auto border-b py-1 md:max-h-[44rem] md:border-r md:border-b-0">
          <TreeView
            items={ITEMS}
            label="Files the site served"
            selected={sel}
            onSelect={setSel}
            defaultExpanded={["root", "build", "data"]}
          />
        </div>
        <div className={cn("min-w-0 md:max-h-[44rem] md:overflow-y-auto")}>
          <Detail found={found} />
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Every excerpt is the file&apos;s own lines, numbered as in the file (game.js from a formatted copy, since it
        ships as one line); the same excerpts appear in the text below. game.wasm is described from its section
        headers and name section only. Arrow keys move through the tree, Enter opens.
      </figcaption>
    </figure>
  )
}
