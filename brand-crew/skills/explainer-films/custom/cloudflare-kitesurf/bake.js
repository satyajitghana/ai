// cloudflare-kitesurf / bake
//
// Where each piece of a page's JavaScript runs in Kitesurf, from the article's reading of
// the source (eval/script-bundle.ts, eval/learned-scripts.ts, page-script inserted-scripts.ts
// and eval-helpers.ts): scripts found in the HTML at navigate are fetched and baked into the
// module the page's Dynamic Worker is created from, so V8 runs them; a script the page inserts
// later, and any source sent over CDP (page.evaluate), runs on Boa, an interpreter compiled to
// Wasm; on a later page of the same session a learned insert is baked too.
// No numbers: every string is a storyboard string, positions are geometry.
//
// steps: 0 the page's script tags · 1 baked into the Worker, V8 runs them ·
//        2 a runtime insert goes to Boa · 3 an evaluate from the agent goes to Boa ·
//        4 next page: the learned insert is baked
// params: { page, tags[3], insert, agent, v8, v8sub, boa, boasub, worker, next }
BESPOKE.define((() => {
  const PX = 130, PW = 420            // the page card
  const LX = 620, LW = 760            // the two lanes
  const TAG_H = 74, TAG_G = 24

  function geo(k) {
    const top = Math.max(k.top + 30, 240)
    return {
      top,
      pageY: top + 50,
      v8Y: top + 30,
      boaY: top + 400,
      laneH: 250,
    }
  }

  // where tag j sits inside the page card, and where it lands in a lane
  const tagAt = (G, j) => [PX + 30, G.pageY + 80 + j * (TAG_H + TAG_G)]
  const slotIn = (G, lane, j) => [LX + 30 + j * 182, (lane === 'v8' ? G.v8Y : G.boaY) + 160]

  function chip(k, key, x, y, w, label, fill, a) {
    if (a <= 0) return
    k.push(); k.alpha(a)
    k.seed(key); k.shape(k.rrect(x, y, w, TAG_H - 8, 10), { fill, op: .9, sw: .7 })
    k.text(label, x + w / 2, y + 43, { role: 'mono', size: 28, min: 9, maxW: w - 16, lines: 1, align: 'center', col: k.textOn(fill) })
    k.pop()
  }

  return {
    plan: () => ({
      min: [3.4, 4.2, 3.8, 3.8, 4.2],
      events: [
        { step: 0, at: .3, type: 'ticks', n: 3, span: .9 },
        { step: 1, at: .4, type: 'pop' }, { step: 1, at: 1.6, type: 'ding' },
        { step: 2, at: .4, type: 'pop' },
        { step: 3, at: .4, type: 'pop' },
        { step: 4, at: .5, type: 'ding' },
      ],
      motion: [{ step: 1, from: 0, to: 2.4 }, { step: 2, from: .2, to: 2.0 }, { step: 3, from: .2, to: 2.0 }, { step: 4, from: .2, to: 2.2 }],
    }),
    stampAt: k => [PX + 10, geo(k).boaY + 300],
    draw(k) {
      const p = k.params, i = k.step, G = geo(k)
      const tags = p.tags || []
      const tagW = PW - 60
      const chipW = 170

      // the page card
      const pageH = 80 + 4 * (TAG_H + TAG_G) + 20
      k.seed('page'); k.shape(k.rrect(PX, G.pageY, PW, pageH, 18), { fill: k.paper, op: .5, sw: .9 })
      k.text(p.page || '', PX + 24, G.pageY + 52, { role: 'label', size: 30, maxW: PW - 48, col: k.dim })
      // the tags' places stay marked once they have left
      for (let j = 0; j < 4; j++) {
        if (j === 3 && i < 2 && !k.thumb) continue
        const [tx, ty] = tagAt(G, j)
        k.seed('slot' + j); k.line(k.rrect(tx, ty, PW - 60, TAG_H - 8, 10), .4, k.dim, { closed: true, dash: [8, 7] })
      }

      // the two lanes
      const laneTone = { v8: k.tone('a'), boa: k.tone('b') }
      ;[['v8', G.v8Y, p.v8, p.v8sub], ['boa', G.boaY, p.boa, p.boasub]].forEach(([id, y, head, sub]) => {
        const on = k.thumb ? 1 : id === 'v8' ? (i >= 1 ? 1 : .35) : (i >= 2 ? 1 : .35)
        k.push(); k.alpha(on)
        k.seed('lane' + id); k.line(k.rrect(LX, y, LW, G.laneH, 20), .9, laneTone[id], { closed: true })
        const hr = k.text(head || '', LX + 28, y + 56, { role: 'head', size: 40, min: 12, maxW: LW - 56, lines: 2 })
        const extra = Math.max(0, (hr && hr.h ? hr.h : 0) - (hr && hr.px ? hr.px * 1.3 : 0))
        k.text(sub || '', LX + 28, y + 100 + extra, { role: 'body', size: 28, min: 10, maxW: LW - 56, lines: 1, col: k.dim })
        k.pop()
      })
      // the worker frame around the V8 lane, once the bundle is baked
      if (i >= 1 || k.thumb) {
        const wk = k.thumb ? 1 : i === 1 ? k.easeOut(k.p(1, .8, 1.4)) : 1
        k.push(); k.alpha(wk)
        k.seed('worker'); k.line(k.rrect(LX - 16, G.v8Y - 16, LW + 32, G.laneH + 32, 26), .5, k.dim, { closed: true, dash: [10, 8] })
        k.text(p.worker || '', LX + LW + 16, G.v8Y + G.laneH + 56, { role: 'label', size: 24, min: 10, maxW: LW, lines: 1, align: 'right', col: k.dim })
        k.pop()
      }

      // the parser-found tags: highlighted at step 0, travel into the V8 lane at step 1
      const travel = k.thumb ? 1 : i < 1 ? 0 : i === 1 ? k.ease(k.p(1, 1.4, .3)) : 1
      tags.forEach((label, j) => {
        const from = tagAt(G, j), to = slotIn(G, 'v8', j)
        const t = k.clamp(travel * 1.3 - j * .15, 0, 1)
        const [x, y] = t <= 0 ? from : t >= 1 ? to : k.arc(from, to, 90, t)
        const w = k.lerp(tagW, chipW, t)
        if (i === 0 && !k.thumb) k.hl(from[0] - 6, from[1] - 4, tagW + 12, TAG_H, k.P.hi, k.clamp(k.p(0, 1.2, .3) * 3 - j, 0, 1))
        chip(k, 'tag' + j, x, y, w, label, t >= 1 ? laneTone.v8 : k.tone('light'), 1)
      })

      // a script the page inserts at runtime: appears in the page, goes to Boa;
      // at step 4 the learned copy is baked into the V8 lane
      if (i >= 2 || k.thumb) {
        const from = tagAt(G, 3), boa = slotIn(G, 'boa', 0), v8 = slotIn(G, 'v8', 3)
        const appear = k.thumb ? 1 : i === 2 ? k.easeOut(k.p(2, .5, .2)) : 1
        const go = k.thumb ? 1 : i === 2 ? k.ease(k.p(2, 1.2, .8)) : 1
        const [x, y] = go >= 1 ? boa : k.arc(from, boa, 70, go)
        chip(k, 'ins', x, y, k.lerp(tagW, chipW, go), p.insert || '', laneTone.boa, appear)
        if (i >= 4 || k.thumb) {
          const lt = k.thumb ? 1 : k.ease(k.p(4, 1.3, .4))
          const [lx, ly] = lt >= 1 ? v8 : k.arc(boa, v8, 120, lt)
          chip(k, 'learned', lx, ly, chipW, p.insert || '', lt >= 1 ? laneTone.v8 : k.tone('light'), lt > 0 ? 1 : 0)
          const nk = k.thumb ? 1 : k.easeOut(k.p(4, .6, 1.6))
          k.push(); k.alpha(nk)
          k.text(p.next || '', PX, G.pageY + pageH + 46, { role: 'body', size: 30, min: 18, maxW: PW + 40, lines: 2 })
          k.pop()
        }
      }

      // an evaluate sent over CDP by the agent: from the left edge, straight to Boa
      if (i >= 3 || k.thumb) {
        const from = [PX, G.boaY + G.laneH + 40], to = slotIn(G, 'boa', 1)
        const go = k.thumb ? 1 : i === 3 ? k.ease(k.p(3, 1.2, .4)) : 1
        const [x, y] = go >= 1 ? to : k.arc(from, to, 60, go)
        chip(k, 'cdp', x, y, chipW, p.agent || '', laneTone.boa, k.thumb ? 1 : i === 3 ? k.easeOut(k.p(3, .4, .1)) : 1)
      }

      k.point = i === 0 ? [PX + PW, G.pageY + 150]
        : i === 1 ? [LX + 300, G.v8Y + 140]
          : i <= 3 ? [LX + 300, G.boaY + 140]
            : [LX + 600, G.v8Y + 140]
      k.mood = i === 1 ? 'happy' : i === 3 ? 'thinking' : 'neutral'
    },
  }
})())
