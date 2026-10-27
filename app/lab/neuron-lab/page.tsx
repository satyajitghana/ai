import type { Metadata } from "next"
import Link from "next/link"
import type { WebApplication, WithContext } from "schema-dts"

import { NeuronLabApp } from "@/components/neuron-lab/app"
import { JsonLd } from "@/lib/jsonld"
import { seo } from "@/lib/seo"
import { absoluteUrl } from "@/lib/site"

const PATH = "/lab/neuron-lab"
const TITLE = "Neuron lab: steer a language model's neurons in your browser"
const DESC =
  "An interactive map of every MLP neuron in Qwen3-0.6B. Search a word to see which neurons write it, pick one, push it up or down, and watch the model's text change, all running in this tab."

export const metadata: Metadata = seo(PATH, TITLE, DESC)

const app: WithContext<WebApplication> = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Neuron lab",
  url: absoluteUrl(PATH),
  description: DESC,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any modern browser",
  isAccessibleForFree: true,
  author: { "@id": `${absoluteUrl("/")}#person` },
}

export default function NeuronLabPage() {
  return (
    <>
      <JsonLd data={app} />
      <NeuronLabApp />
      {/* The same account in plain markup, for readers and crawlers that do not run the app. */}
      <main className="mx-auto max-w-prose px-6 py-12">
        <h1 className="text-2xl font-bold">Neuron lab</h1>
        <p className="mt-3 leading-7">
          Qwen3-0.6B has 28 layers of 3,072 MLP neurons each. Each neuron writes a fixed direction into the model&apos;s residual stream when it fires. Steering adds that direction by hand, at a dose measured in typical residual lengths, so the same dose means the same thing in every layer. This page lets you search neurons by the words they promote, inspect them, and run the model with a recipe of up to four steered neurons, entirely in your browser. There is no AI agent and no server: the model is fetched from Hugging Face the first time you press load and kept in the browser.
        </p>
        <p className="mt-3 leading-7">
          How it works and what we measured: <Link href="/articles/neuron-lab">the neuron lab article</Link> and <Link href="/articles/neuron-steering">the neuron steering article</Link>.
        </p>
      </main>
    </>
  )
}
