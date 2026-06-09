import { ImageResponse } from "next/og"

import { profile } from "@/data/profile"

// Shared 1200×630 OG image renderer for per-route opengraph-image.tsx files.
// Editorial × terminal: dark card, mono kicker, big grotesk-ish title.
export const ogSize = { width: 1200, height: 630 }
export const ogContentType = "image/png"

export function renderOgImage({
  kicker,
  title,
  subtitle,
  footerLeft = profile.name,
}: {
  kicker: string
  title: string
  subtitle?: string
  footerLeft?: string
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, color: "#a3a3a3" }}>
          $ {kicker}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 48 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 28, color: "#a3a3a3" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#737373",
          }}
        >
          <div style={{ display: "flex" }}>{footerLeft}</div>
          <div style={{ display: "flex" }}>ai.thesatyajit.com</div>
        </div>
      </div>
    ),
    ogSize
  )
}
