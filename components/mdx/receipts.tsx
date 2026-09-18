import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { cn } from "@/lib/utils"

// Published evidence for a claim. The article says a number; this renders that
// number's provenance AND links the raw dataset it came from, so a reader can
// check the arithmetic instead of trusting it.
//
// The table is generated from the committed JSON at build time — the same file
// the download link serves. Prose can drift from its evidence; a table read out
// of the artifact cannot. A missing or malformed file is a build failure by
// design (same posture as the Zod content layer): evidence that isn't there
// should stop the build, not degrade quietly to an empty box.
//
// Server-rendered, zero JS. `src` is a public path (`/articles/<slug>/data/x.json`).

type Align = "left" | "right"

interface Column {
  key: string
  label: string
  align?: Align
  mono?: boolean
}

interface Dataset {
  claim: string
  method?: string
  source?: string
  captured?: string
  note?: string
  columns: Column[]
  rows: Record<string, string | number | boolean | null>[]
}

function load(src: string): { data: Dataset; bytes: number } {
  if (!src.startsWith("/")) {
    throw new Error(`<Receipts src> must be an absolute public path, got "${src}"`)
  }
  const file = join(process.cwd(), "public", src)
  let raw: string
  try {
    raw = readFileSync(file, "utf8")
  } catch {
    throw new Error(
      `<Receipts src="${src}"> — no such file at public${src}. ` +
        `Commit the dataset next to the article before citing it.`
    )
  }
  let data: Dataset
  try {
    data = JSON.parse(raw) as Dataset
  } catch (e) {
    throw new Error(`<Receipts src="${src}"> — invalid JSON: ${(e as Error).message}`)
  }
  if (!data.claim) throw new Error(`<Receipts src="${src}"> — missing "claim".`)
  if (!Array.isArray(data.columns) || data.columns.length === 0) {
    throw new Error(`<Receipts src="${src}"> — "columns" must be a non-empty array.`)
  }
  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    throw new Error(`<Receipts src="${src}"> — "rows" must be a non-empty array.`)
  }
  return { data, bytes: statSync(file).size }
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function cell(value: string | number | boolean | null): string {
  if (value === null) return "—"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (typeof value === "number") return value.toLocaleString("en-US")
  return value
}

export function Receipts({ src }: { src: string }) {
  const { data, bytes } = load(src)

  return (
    <figure
      data-receipts={src}
      className="my-8 rounded-md border bg-muted/20 px-4 py-3"
    >
      <div className="flex items-baseline justify-between gap-3 border-b pb-2">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          receipts
        </span>
        {data.captured ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            captured {data.captured}
          </span>
        ) : null}
      </div>

      <p className="mt-3 mb-3 text-sm leading-6">{data.claim}</p>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {data.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-2 py-1.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground",
                    c.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-t border-border/60">
                {data.columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-1.5 align-top",
                      c.align === "right" ? "text-right" : "text-left",
                      c.mono !== false && c.align === "right" ? "font-mono" : ""
                    )}
                  >
                    {cell(row[c.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.note ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{data.note}</p>
      ) : null}

      <figcaption className="mt-3 space-y-1 border-t pt-2 font-mono text-[11px] leading-5 text-muted-foreground">
        {data.method ? (
          <div className="break-words">
            <span className="text-foreground/70">method</span> {data.method}
          </div>
        ) : null}
        {data.source ? (
          <div className="break-words">
            <span className="text-foreground/70">source</span>{" "}
            <a
              href={data.source}
              className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
            >
              {data.source}
            </a>
          </div>
        ) : null}
        <div>
          <span className="text-foreground/70">data</span>{" "}
          <a
            href={src}
            download
            className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
          >
            {src}
          </a>{" "}
          ({data.rows.length} rows, {human(bytes)})
        </div>
      </figcaption>
    </figure>
  )
}
