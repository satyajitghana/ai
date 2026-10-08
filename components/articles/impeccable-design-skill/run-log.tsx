import type { ReactNode } from "react"

// The passes I ran on this page, in the order they ran. Each entry names the
// Impeccable command, when it ran and the reference line it acted on; its
// children are the article's own prose. Styled by the page shell (layout-css.ts,
// "The run log"); the order is information the reader needs, so it is an <ol>
// and the command name, not a number, labels each step (craft-floor.md:28).

export function RunLog({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="imx-log" aria-label={title}>
      <div className="imx-log-in">
        <div className="imx-log-top">
          <p className="imx-log-t">{title}</p>
          {note ? <p className="imx-log-note">{note}</p> : null}
        </div>
        <ol>{children}</ol>
      </div>
    </section>
  )
}

export function Pass({
  cmd,
  when,
  cite,
  children,
}: {
  cmd: string
  when?: string
  cite?: string
  children: ReactNode
}) {
  return (
    <li className="imx-pass">
      <div className="imx-pass-head">
        <span className="imx-cmd">{cmd}</span>
        {when ? <span className="imx-pass-when">{when}</span> : null}
        {cite ? <span className="imx-pass-cite">{cite}</span> : null}
      </div>
      <div className="imx-pass-body">{children}</div>
    </li>
  )
}
