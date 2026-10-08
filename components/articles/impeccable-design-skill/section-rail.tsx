"use client"

import { useEffect, useRef, useState } from "react"

// The running head: on a wide screen, the article's sections listed in the
// outer margin with the one being read marked, the way a magazine's running
// foot says where you are. It is wayfinding, not a second table of contents:
// it appears only once the reader is inside the body, steps aside while a
// full-bleed band (a plate, the run log, the spread) passes behind it, and
// renders nothing a reader without JavaScript would miss, since every section
// heading is in the column. Styled by layout-css.ts ("The running head").

type Section = { id: string; title: string }

export function SectionRail() {
  const [sections, setSections] = useState<Section[]>([])
  const [current, setCurrent] = useState(-1)
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const body = document.querySelector<HTMLElement>(".imx-body")
    const end = document.querySelector<HTMLElement>(".imx-end")
    if (!body) return
    const heads = [...body.querySelectorAll<HTMLHeadingElement>(":scope > h2[id]")]
    let listed = false
    // Anything wider than the body's margins: the opener (it spans the whole
    // frame) and the full-bleed bands.
    const bands = [
      ...document.querySelectorAll<HTMLElement>(".imx-hero"),
      ...body.querySelectorAll<HTMLElement>(":scope > .imx-fig--plate, :scope > .imx-log, :scope > .imx-spread"),
    ]

    let frame = 0
    const update = () => {
      frame = 0
      if (!listed) {
        listed = true
        setSections(heads.map((h) => ({ id: h.id, title: h.textContent ?? "" })))
        // Measure again once the list has rendered and has a size.
        frame = requestAnimationFrame(update)
        return
      }
      const line = window.innerHeight * 0.3
      let at = -1
      heads.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= line) at = i
      })
      setCurrent(at)
      const rail = ref.current?.getBoundingClientRect()
      const top = body.getBoundingClientRect().top
      const endTop = end ? end.getBoundingClientRect().top : Infinity
      let clear = top < window.innerHeight && endTop > window.innerHeight * 0.6
      if (clear && rail && rail.height) {
        clear = !bands.some((b) => {
          const r = b.getBoundingClientRect()
          return r.top < rail.bottom + 16 && r.bottom > rail.top - 16
        })
      }
      setShown(clear)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  if (!sections.length) return null
  return (
    <nav ref={ref} className="imx-rail" aria-label="Sections of this article" data-shown={shown ? "" : undefined}>
      <ol>
        {sections.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={i === current ? "location" : undefined}>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
