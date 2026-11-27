// The deck's faces. Self-hosted by next/font and not preloaded: a visitor who never opens
// /universe never downloads them, and the deck waits for each one before it draws any type.
import { Anton, Geist, Geist_Mono, IM_Fell_English, Instrument_Serif, Special_Elite } from "next/font/google"

import type { FontMap } from "./engine/text"

const sans = Geist({ subsets: ["latin"], preload: false, display: "block" })
const mono = Geist_Mono({ subsets: ["latin"], preload: false, display: "block" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], preload: false, display: "block" })
const tall = Anton({ subsets: ["latin"], weight: "400", preload: false, display: "block" })
const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], preload: false, display: "block" })
const typer = Special_Elite({ subsets: ["latin"], weight: "400", preload: false, display: "block" })

export const FONTS: FontMap = {
  sans: sans.style.fontFamily,
  mono: mono.style.fontFamily,
  serif: serif.style.fontFamily,
  tall: tall.style.fontFamily,
  fell: fell.style.fontFamily,
  typer: typer.style.fontFamily,
  arial: "Arial, Helvetica, sans-serif",
}

/** Wait for every face and weight the deck draws with Canvas 2D. A face that fails falls back. */
export async function loadFonts() {
  const specs = [
    `400 32px ${FONTS.sans}`, `500 32px ${FONTS.sans}`, `600 32px ${FONTS.sans}`, `700 32px ${FONTS.sans}`,
    `400 32px ${FONTS.mono}`, `500 32px ${FONTS.mono}`,
    `400 32px ${FONTS.serif}`, `italic 400 32px ${FONTS.serif}`,
    `400 32px ${FONTS.tall}`,
    `400 32px ${FONTS.fell}`, `italic 400 32px ${FONTS.fell}`,
    `400 32px ${FONTS.typer}`,
  ]
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => [])))
}
