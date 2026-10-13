// remark plugin: load each article's interactive widgets on demand.
//
// An article's MDX imports its widgets directly:
//
//   import { QuadtreeDial } from "@/components/articles/budgetpix/quadtree-dial"
//
// The MDX is a server component, and /articles/[slug] imports every article
// through one template-literal import(). Next does not code-split client
// components imported by a server component, so the route's client entry held
// every widget of every article (6 MB, about 1.6 MB gzipped) and each article
// page downloaded all of it. This rewrites such an import into
//
//   const QuadtreeDial = (props) =>
//     createElement(LazyWidget, { ...props, __w: "budgetpix/quadtree-dial#QuadtreeDial" })
//
// where LazyWidget (components/mdx/lazy-widget.tsx) is one small client
// component that imports the module from a generated registry with React.lazy,
// so each widget is its own chunk and a page fetches only the ones it renders.
// Static generation waits for them, so the prerendered HTML is unchanged.
//
// Only imports of "use client" modules under components/articles/ are touched
// (lib/mdx/widgets.mjs decides); everything else in the MDX is left as written.

import { PREFIX, isLazyWidget } from "./widgets.mjs"

const id = (name) => ({ type: "Identifier", name })
const lit = (value) => ({ type: "Literal", value, raw: JSON.stringify(value) })

function importOf(names, source) {
  return {
    type: "ImportDeclaration",
    specifiers: names.map(([imported, local]) => ({ type: "ImportSpecifier", imported: id(imported), local: id(local) })),
    source: lit(source),
    attributes: [],
  }
}

function wrapper(local, key) {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: id(local),
        init: {
          type: "ArrowFunctionExpression",
          params: [id("props")],
          expression: true,
          async: false,
          generator: false,
          body: {
            type: "CallExpression",
            callee: id("__lwCreateElement"),
            optional: false,
            arguments: [
              id("__LazyWidget"),
              {
                type: "ObjectExpression",
                properties: [
                  { type: "SpreadElement", argument: id("props") },
                  {
                    type: "Property",
                    key: id("__w"),
                    value: lit(key),
                    kind: "init",
                    method: false,
                    shorthand: false,
                    computed: false,
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  }
}

export default function remarkLazyWidgets() {
  const root = process.cwd()
  return (tree) => {
    let injected = false
    for (const node of tree.children ?? []) {
      if (node.type !== "mdxjsEsm" || !node.data?.estree) continue
      const body = []
      for (const stmt of node.data.estree.body) {
        const source = stmt.type === "ImportDeclaration" ? stmt.source.value : null
        const rel = typeof source === "string" && source.startsWith(PREFIX) ? source.slice(PREFIX.length) : null
        if (!rel || !stmt.specifiers.every((s) => s.type === "ImportSpecifier") || !isLazyWidget(root, rel)) {
          body.push(stmt)
          continue
        }
        if (!injected) {
          body.unshift(
            importOf([["createElement", "__lwCreateElement"]], "react"),
            importOf([["LazyWidget", "__LazyWidget"]], "@/components/mdx/lazy-widget"),
          )
          injected = true
        }
        for (const s of stmt.specifiers) {
          const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value
          body.push(wrapper(s.local.name, `${rel}#${imported}`))
        }
      }
      node.data.estree.body = body
    }
  }
}
