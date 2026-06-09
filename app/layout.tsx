import type { Metadata } from "next"
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google"

import "./globals.css"
import "katex/dist/katex.min.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { TerminalOverlay } from "@/components/terminal/terminal-overlay"
import { cn } from "@/lib/utils"
import { JsonLd, personJsonLd, websiteJsonLd } from "@/lib/jsonld"
import { siteUrl } from "@/lib/site"

// Grotesk for display + body (unified, minimal), IBM Plex Mono as the accent.
const fontSans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
})

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
})

const SITE_TITLE = "Satyajit Ghana"
const SITE_DESCRIPTION =
  "Satyajit Ghana — Head of Engineering at Inkers. Deep learning, 3D perception, CUDA, and high-performance systems. An AI-native, agent-readable homepage with projects, curated AI articles, a daily arXiv digest, and a downloadable resume."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_TITLE} — Head of Engineering, AI & 3D Perception`,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  authors: [{ name: SITE_TITLE, url: siteUrl }],
  creator: SITE_TITLE,
  publisher: SITE_TITLE,
  keywords: [
    "Satyajit Ghana",
    "deep learning engineer",
    "3D perception",
    "LiDAR",
    "point clouds",
    "CUDA",
    "computer vision",
    "MLOps",
    "Inkers",
    "PyTorch",
    "AI articles",
    "arXiv digest",
  ],
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/feed.xml",
      "text/plain": "/llms.txt",
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: `${SITE_TITLE} — Head of Engineering, AI & 3D Perception`,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_TITLE} — AI & 3D Perception`,
    description: SITE_DESCRIPTION,
    creator: "@thesudoer_",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable)}
    >
      <body className="flex min-h-svh flex-col">
        <JsonLd data={personJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <ThemeProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <TerminalOverlay />
        </ThemeProvider>
      </body>
    </html>
  )
}
