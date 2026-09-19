import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TierAxes } from "@/components/articles/three-tiers/tier-axes"
import { StanleyRoute } from "@/components/articles/three-tiers/stanley-route"
import { RelationSupply } from "@/components/articles/three-tiers/relation-supply"

console.log(JSON.stringify({
  "tier-axes": renderToStaticMarkup(<TierAxes />),
  "stanley-route": renderToStaticMarkup(<StanleyRoute />),
  "relation-supply": renderToStaticMarkup(<RelationSupply />),
}))
