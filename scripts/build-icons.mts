/**
 * build-icons — rasterises the brand mark into the icon files browsers want.
 *
 * `app/icon.svg` is the single source of truth. It is deliberately an outlined
 * path rather than a <text> element: an SVG that names a font it does not embed
 * renders in whatever the viewer happens to have, which for "Hanken Grotesk" is
 * nothing, so the mark would silently fall back to Helvetica everywhere it was
 * shown. Outlining costs ~600 bytes and makes it exact.
 *
 * Two outputs, and they are shaped differently on purpose:
 *
 *   app/favicon.ico   the rounded mark, at six sizes in one container. Browsers
 *                     draw this as-is in a tab, so it keeps its own corners.
 *                     Also what link-preview scrapers fall back to.
 *   app/apple-icon.png  full-bleed square, no rounding. iOS masks a touch icon
 *                     with its own superellipse, so a pre-rounded source gets
 *                     rounded twice and shows white slivers at the corners.
 *
 * ICO is a tiny container format: a 6-byte header, one 16-byte directory entry
 * per image, then the images themselves. Embedding PNGs rather than BMPs has
 * been supported since Vista and is what every modern generator emits, so there
 * is no need for a dependency here beyond the `sharp` the project already has.
 *
 *   pnpm build:icons
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import sharp from "sharp"

const ROOT = join(import.meta.dirname, "..")
const SRC = join(ROOT, "app", "icon.svg")

// 16 and 32 are the tab and bookmark sizes; 48 is Windows; 64/128/256 are what
// scrapers and OS-level previews pick up.
const ICO_SIZES = [16, 32, 48, 64, 128, 256]
const APPLE_SIZE = 180

function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(images.length, 4)

  const DIR_ENTRY = 16
  let offset = header.length + images.length * DIR_ENTRY
  const entries: Buffer[] = []

  for (const { size, png } of images) {
    const e = Buffer.alloc(DIR_ENTRY)
    // 256 is stored as 0 — the field is one byte, so 256 does not fit.
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2) // palette size: 0 = truecolour
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

async function main() {
  const svg = readFileSync(SRC)

  const images = []
  for (const size of ICO_SIZES) {
    // `density` matters: sharp rasterises SVG through librsvg at a DPI, and the
    // default 72 renders a 512-unit document into 512px before resizing, which
    // softens the small sizes. Scaling density with the target keeps the curves
    // of the S crisp at 16px.
    const png = await sharp(svg, { density: Math.max(72, Math.round((size / 512) * 72 * 8)) })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    images.push({ size, png })
  }
  writeFileSync(join(ROOT, "app", "favicon.ico"), buildIco(images))

  // The Apple variant: same mark, square. Dropping rx/ry is enough — the rect
  // already covers the full viewBox.
  const square = svg.toString().replace(/\s+rx="112"\s+ry="112"/, "")
  if (square === svg.toString()) throw new Error("icon.svg no longer has the rx/ry the Apple variant strips")
  await sharp(Buffer.from(square), { density: 288 })
    .resize(APPLE_SIZE, APPLE_SIZE)
    .flatten({ background: "#141414" })
    .png({ compressionLevel: 9 })
    .toFile(join(ROOT, "app", "apple-icon.png"))

  const total = images.reduce((a, i) => a + i.png.length, 0)
  console.log(`✓ app/favicon.ico — ${ICO_SIZES.join(", ")}px (${Math.round(total / 1024)}KB of PNG)`)
  console.log(`✓ app/apple-icon.png — ${APPLE_SIZE}×${APPLE_SIZE}, square, #141414`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
