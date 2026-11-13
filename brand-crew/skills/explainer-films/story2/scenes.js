// story/scenes.js — the scene types only the story format has.
//
// Loaded after story/explainer.js, whose internals it reads from window.STORY.
// Each type has the same three parts as every other scene (beats, plan, draw;
// see the head of explainer.js), and emits only the sound cues audio.py
// already synthesizes (write, ding, pop, boing, whoosh, slide, draw, flow,
// ticks, scratch, thunk), because audio.py is shared with every legacy film
// and stays as it is.
//
//   chapter  a chapter card: the film's acts, named, with where we are among them
//   hook     the cold open: a concrete question, before the title
//   chart    a line or scatter plot that draws itself, axes and ticks as given
//   trace    a worked example: one concrete value walked through the stages
//            of the mechanism, changing at each
//   code     a few lines of the article's own code, highlighted in turn
//   inset    a diagram whose one node opens into a diagram of its own
//
// Every digit these draw comes from the storyboard, never from the engine:
// no computed tick, no counted-up value, no line number. The checker holds
// those fields to the article like any other.
(() => {
  const K = window.STORY
  const { SCENES, M, readT, snap, bgCol, tone, textOn, focus, beatTimes, beatOf, host, hop, folio, heading, headBottom, note, stamp, partial } = K
  const P = () => STYLE.P
  const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  const ink2 = () => (STYLE.dark ? P().a : STYLE.ink)

  // ======================================================================
  // CHAPTER: the film's acts, named. A long film needs signposts: where we
  // are, what this part is about, how much is left.
  const CHAPTER = {
    beats: sc => [sc.say || sent(sc.title)],
    plan(sc, v) {
      const bt = beatTimes(v, [readT(sc.title) + readT(sc.sub) + 1.5], .55, .42)
      sc._b = bt.at
      sc._ev = [{ t: .05, type: 'slide' }, { t: .45, type: 'write' }, { t: .75, type: 'ding' }]
      sc._win = [[0, 1.5, 5]]
      return snap(bt.end + .35)
    },
    draw(t, lt, sc) {
      const all = K.SB.scenes.filter(s => s.type === 'chapter'), idx = all.indexOf(K.SB.scenes[sc._i]), n = all.length
      const k0 = K.THUMB ? 1 : expoOut(seg(lt, 0, .55))
      // a band of the accent sweeps in under the heading's place
      push(); G.globalAlpha *= .9
      boilSeed('chband')
      STYLE.shape([[-60, 300], [lerp(-60, 1380, k0), 280], [lerp(-60, 1420, k0), 610], [-60, 640]], { fill: P().a, op: .28, ink: null })
      pop()
      // where we are: one dot per chapter, this one filled
      const dx = 46, x0 = M + 8
      for (let i = 0; i < n; i++) {
        const k = K.THUMB ? 1 : backOut(seg(lt, .15 + i * .06, .45 + i * .06)); if (k <= 0) continue
        push(); translate(x0 + i * dx, 330); scale(k)
        boilSeed('chdot' + i)
        if (i === idx) STYLE.shape(ellPts(0, 0, 14, 14, 16), { fill: ink2(), op: 1, sw: .9 })
        else STYLE.line(ellPts(0, 0, 11, 11, 16), .9, i < idx ? ink2() : STYLE.dim, { closed: true, curv: 0 })
        pop()
      }
      write(caps('label', `Chapter ${NUM[idx] || ''}`.trim()), x0 + n * dx + 18, 342, F('label', 34), STYLE.dim, { ls: 3, alpha: easeOut(seg(lt, .2, .5)) })
      // the chapter's name, set word by word, larger than a scene heading
      const hb = fitR('head', sc.title, 124, 64, 1180, 2), lh = hb.px * 1.04, top = 420 + hb.px * .8
      let i = 0
      hb.lines.forEach((line, li) => line.words.forEach(w => {
        const k = K.THUMB ? 1 : seg(lt, .35 + i * .08, .35 + i * .08 + .4); i++
        if (k <= 0) return
        push(); translate(M + w.x, top + li * lh - (1 - expoOut(k)) * 50); focus(k * 1.5, 12)
        write(w.text, 0, 0, hb.f, STYLE.ink, { ls: hb.ls, alpha: clamp(k * 3) })
        pop()
      }))
      const yU = top + (hb.lines.length - 1) * lh + hb.px * .3
      const wMax = Math.max(...hb.lines.map(l => l.width))
      boilSeed('chunder'); STYLE.line(partial([[M, yU], [M + wMax, yU + 6]], K.THUMB ? 1 : easeOut(seg(lt, .7, 1.3))), 1.6, P().a, { curv: 0 })
      if (sc.sub && !K.THUMB) { const sb = fitR('body', sc.sub, 46, 32, 1150, 2); wipeLines(lt, sb, M, yU + 40 + sb.px, sb.px * 1.2, .9, .14, STYLE.dim) }
      host(t, { mood: 'excited', look: -.6, point: [M + wMax * .8, top - hb.px * .3], ...hop(lt, .5, 50) })
    },
  }

  // ======================================================================
  // HOOK: the cold open. A concrete question or situation, before anyone has
  // said what the film is about; the score has not started yet.
  const HOOK = {
    beats: sc => [sc.say || sent(sc.text)],
    plan(sc, v) {
      const v0 = v[0] || readT(sc.text)
      const bt = beatTimes(v, [readT(sc.text) + readT(sc.sub) + 1.6], .5, .5)
      sc._b = bt.at
      // the words land as they are said, roughly: spread over the line's first 85%
      sc._t = { per: Math.max(.08, v0 * .85 / Math.max(1, words(sc.text))), markAt: .5 + v0 * .72 }
      sc._ev = [{ t: .45, type: 'write' }].concat(sc.mark ? [{ t: sc._t.markAt, type: 'ding' }] : [])
      sc._win = [[0, .9, 5]]
      return snap(bt.end + .5)
    },
    draw(t, lt, sc) {
      // a big question mark, painted behind everything
      const qk = K.THUMB ? 1 : easeOut(seg(lt, .1, .9))
      push(); translate(1240, 600); rotate(.12 + .02 * Math.sin(lt * .8)); scale(lerp(.85, 1, qk)); G.globalAlpha *= .22 * qk
      write('?', 0, 0, F('head', 640), P().a, { align: 'center' })
      pop()
      const b = fitR('head', sc.text, 92, 52, 1150, 4), lh = b.px * 1.12, y = 300 + b.px * .8
      const mk = K.THUMB ? 1 : easeOut(seg(lt, sc._t.markAt, sc._t.markAt + .45))
      for (const bx of phraseBoxes(b, sc.mark, M, y, lh)) STYLE.hl(bx.x, bx.y, bx.w, bx.h, P().hi, mk)
      let i = 0
      b.lines.forEach((line, li) => line.words.forEach(w => {
        const t0 = .5 + i * sc._t.per, k = K.THUMB ? 1 : seg(lt, t0, t0 + .35); i++
        if (k <= 0) return
        push(); translate(M + w.x, y + li * lh - (1 - expoOut(k)) * 30); focus(k * 1.6, 10)
        write(w.text, 0, 0, b.f, STYLE.ink, { ls: b.ls, alpha: clamp(k * 3) })
        pop()
      }))
      if (sc.sub && !K.THUMB) {
        const sb = fitR('body', sc.sub, 44, 30, 1100, 2), sy = y + (b.lines.length - 1) * lh + b.px * .6 + sb.px * 1.3
        wipeLines(lt, sb, M, sy, sb.px * 1.2, sc._t.markAt + .3, .12, STYLE.dim)
      }
      host(t, { mood: lt < sc._t.markAt ? 'thinking' : 'surprised', look: -.6, lookY: -.4, ...hop(lt, sc._t.markAt, 26) })
    },
  }

  // ======================================================================
  // CHART: a line or scatter plot that draws itself. Axes, ticks and tick
  // labels are exactly the storyboard's; each series traces in left to right
  // on the step that shows it, and a step may call out one point.
  const PLOT = { x0: 290, x1: 1080, y1: 800 }
  function chartGeo(sc) {
    if (sc._g) return sc._g
    const top = Math.max(330, headBottom(sc.title) + 90)
    const tr = ax => v => (ax.log ? Math.log10(Math.max(v, 1e-12)) : v)
    const fx = tr(sc.x), fy = tr(sc.y)
    const xs = sc.series.flatMap(s => s.points.map(p => p[0])).concat(sc.x.ticks || []), ys = sc.series.flatMap(s => s.points.map(p => p[1])).concat(sc.y.ticks || [])
    let [xa, xb] = [Math.min(...xs.map(fx)), Math.max(...xs.map(fx))], [ya, yb] = [Math.min(...ys.map(fy)), Math.max(...ys.map(fy))]
    if (sc.y.zero !== false && !sc.y.log) ya = Math.min(ya, 0)
    if (xb - xa < 1e-9) { xa -= 1; xb += 1 } if (yb - ya < 1e-9) { ya -= 1; yb += 1 }
    const padX = (xb - xa) * .04, padY = (yb - ya) * .06
    xa -= padX; xb += padX; yb += padY; if (sc.y.log || ya !== 0) ya -= padY
    const X = v => PLOT.x0 + (fx(v) - xa) / (xb - xa) * (PLOT.x1 - PLOT.x0), Y = v => PLOT.y1 - (fy(v) - ya) / (yb - ya) * (PLOT.y1 - top)
    // when each series first appears: the first step that lists it; none listed means all at once
    const shownAt = sc.series.map((_, i) => { const j = sc.steps.findIndex(s => (s.show || []).includes(i)); return j < 0 ? (sc.steps.some(s => s.show) ? sc.steps.length : 0) : j })
    return (sc._g = { top, X, Y, shownAt })
  }
  const seriesCol = (s, i) => (s.hl ? P().a : [P().b, STYLE.ink, P().hi, P().a][i % 4])
  const CHART = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const g = chartGeo(sc)
      const bt = beatTimes(v, sc.steps.map((s, i) => 2 + readT(s.note) * .7 + (g.shownAt.includes(i) ? 1.2 : 0)), .9, .42)
      sc._b = bt.at; sc._ev = [{ t: .15, type: 'draw' }]
      sc.steps.forEach((s, i) => {
        if (g.shownAt.includes(i)) sc._ev.push({ t: bt.at[i] + .15, type: 'scratch' })
        if (s.mark) sc._ev.push({ t: bt.at[i] + .55, type: 'pop' })
      })
      sc._win = [[0, 1, 5]].concat(sc.steps.flatMap((s, i) => g.shownAt.includes(i) ? [[bt.at[i], bt.at[i] + 1.6, 1]] : []))
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const g = chartGeo(sc), bi = K.THUMB ? sc.steps.length - 1 : beatOf(sc, lt), step = sc.steps[bi] || {}, t0 = sc._b[bi]
      // axes draw on, then their ticks and labels
      const ak = K.THUMB ? 1 : easeOut(seg(lt, .1, .7)), tk = K.THUMB ? 1 : easeOut(seg(lt, .5, .9))
      boilSeed('axes')
      STYLE.line(partial([[PLOT.x0, g.top - 20], [PLOT.x0, PLOT.y1], [PLOT.x1 + 30, PLOT.y1]], ak), 1.1, STYLE.ink, { curv: 0 })
      const fm = F('mono', 24)
      ;(sc.x.ticks || []).forEach((v, i) => {
        const x = g.X(v); STYLE.line([[x, PLOT.y1], [x, PLOT.y1 + 12]], .8, STYLE.ink, { curv: 0 })
        G.save(); G.globalAlpha *= .12 * tk; STYLE.flat(rectPts(x - 1, g.top - 10, 2, PLOT.y1 - g.top + 10), STYLE.ink, 1); G.restore()
        write(caps('mono', (sc.x.tickLabels || [])[i] ?? String(v)), x, PLOT.y1 + 46, fm, STYLE.dim, { align: 'center', alpha: tk })
      })
      ;(sc.y.ticks || []).forEach((v, i) => {
        const y = g.Y(v); STYLE.line([[PLOT.x0 - 12, y], [PLOT.x0, y]], .8, STYLE.ink, { curv: 0 })
        G.save(); G.globalAlpha *= .12 * tk; STYLE.flat(rectPts(PLOT.x0, y - 1, PLOT.x1 - PLOT.x0 + 30, 2), STYLE.ink, 1); G.restore()
        write(caps('mono', (sc.y.tickLabels || [])[i] ?? String(v)), PLOT.x0 - 24, y + 8, fm, STYLE.dim, { align: 'right', alpha: tk })
      })
      write(caps('mono', sc.x.label), (PLOT.x0 + PLOT.x1) / 2, PLOT.y1 + 92, F('mono', 26), STYLE.dim, { align: 'center', alpha: tk })
      push(); translate(PLOT.x0 - 140, (g.top + PLOT.y1) / 2); rotate(-Math.PI / 2); write(caps('mono', sc.y.label), 0, 0, F('mono', 26), STYLE.dim, { align: 'center', alpha: tk }); pop()
      // the series, each tracing in on its step
      const ends = []
      sc.series.forEach((s, si) => {
        const at = g.shownAt[si]; if (at > bi && !K.THUMB) return
        const pts = s.points.map(p => [g.X(p[0]), g.Y(p[1])]), col = seriesCol(s, si)
        const k = K.THUMB ? 1 : ease(seg(lt, sc._b[at] + .15, sc._b[at] + 1.45))
        const dim = step.mark && step.mark.series !== si && !K.THUMB ? .4 : 1
        G.save(); G.globalAlpha *= dim
        boilSeed('series' + si)
        const reach = pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) * k
        if (sc.kind !== 'scatter' && pts.length > 1) {
          const cut = [pts[0]]
          for (let j = 1; j < pts.length; j++) { if (pts[j][0] <= reach) cut.push(pts[j]); else { const a = pts[j - 1], b = pts[j], u = (reach - a[0]) / ((b[0] - a[0]) || 1); if (u > 0) cut.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]); break } }
          if (cut.length > 1) {
            if (s.dashed) { const L = K.lenOf(cut); for (let d = 0; d < L; d += 30) { const q = []; for (let e = d; e <= Math.min(L, d + 17); e += 4) q.push(K.along(cut, e)); if (q.length > 1) STYLE.line(q, s.hl ? 1.3 : 1, col, { curv: 0 }) } }
            else STYLE.line(cut, s.hl ? 1.5 : 1.1, col, { curv: 0 })
          }
        }
        pts.forEach((p, j) => {
          const pk = K.THUMB ? 1 : backOut(seg(lt, sc._b[at] + .15 + (p[0] - pts[0][0]) / ((pts[pts.length - 1][0] - pts[0][0]) || 1) * 1.3, sc._b[at] + .45 + (p[0] - pts[0][0]) / ((pts[pts.length - 1][0] - pts[0][0]) || 1) * 1.3))
          if (pk <= 0) return
          push(); translate(p[0], p[1]); scale(pk)
          boilSeed('pt' + si + '_' + j)
          STYLE.shape(ellPts(0, 0, sc.kind === 'scatter' ? 12 : 9, sc.kind === 'scatter' ? 12 : 9, 14), { fill: col, op: 1, sw: .8, ink: STYLE.dark ? col : STYLE.ink })
          pop()
        })
        // the series named at its end (direct labels, no legend to decode)
        const lk = K.THUMB ? 1 : seg(lt, sc._b[at] + 1.2, sc._b[at] + 1.6)
        if (lk > 0) ends.push({ y: pts[pts.length - 1][1], x: pts[pts.length - 1][0], s, col, lk, dim })
        G.restore()
      })
      // end labels, nudged apart vertically when two series finish close together
      ends.sort((a, b) => a.y - b.y)
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 74) ends[i].y = ends[i - 1].y + 74
      for (const e of ends) {
        const b = fitR('body', e.s.label, 30, 22, 250, 2)
        G.save(); G.globalAlpha *= e.lk * e.dim
        b.lines.forEach((l, li) => write(l.text, PLOT.x1 + 52, e.y + 10 - (b.lines.length - 1) * b.px * .55 + li * b.px * 1.1, b.f, e.s.hl ? STYLE.ink : STYLE.dim, { ls: b.ls }))
        STYLE.flat(rectPts(PLOT.x1 + 40 - 26, e.y - 2, 18, 4), e.col, 1)
        G.restore()
      }
      // the callout: a ring on one point and what it is
      let point = [PLOT.x1, g.top + 80]
      if (step.mark && sc.series[step.mark.series] && sc.series[step.mark.series].points[step.mark.point]) {
        const p = sc.series[step.mark.series].points[step.mark.point], x = g.X(p[0]), y = g.Y(p[1]), k = K.THUMB ? 1 : backOut(seg(lt, t0 + .5, t0 + .85))
        point = [x, y]
        if (k > 0) {
          push(); translate(x, y); scale(k); boilSeed('ring' + bi)
          STYLE.line(ellPts(0, 0, 30, 30, 22), 1.3, P().a, { closed: true, curv: 0 })
          pop()
          const lb = fitR('body', step.mark.label, 34, 24, 420, 2), w = Math.max(...lb.lines.map(l => l.width)) + 40, h = lb.lines.length * lb.px * 1.15 + 28
          const right = x > (PLOT.x0 + PLOT.x1) / 2, bx = clamp(right ? x - w - 50 : x + 50, PLOT.x0 + 20, 1330 - w), by = clamp(y + 50, g.top - 30, PLOT.y1 - h - 10)
          G.save(); G.globalAlpha *= clamp(k * 2)
          STYLE.flat(rrPts(bx, by, w, h, 10), bgCol(), .94)
          boilSeed('callout' + bi); STYLE.line(rrPts(bx, by, w, h, 10), .9, P().a, { closed: true, curv: 0 })
          lb.lines.forEach((l, li) => write(l.text, bx + 20, by + 14 + lb.px * .9 + li * lb.px * 1.15, lb.f, STYLE.ink, { ls: lb.ls }))
          G.restore()
        }
      } else if (ends.length) point = [ends[ends.length - 1].x, ends[ends.length - 1].y]
      if (sc.illustrative) stamp(lt, 1, 'Illustrative', 1250, g.top - 40)
      else stamp(lt, 1, sc.stamp, 1250, g.top - 40)
      note(lt, step.note, t0 + .4)
      host(t, { point, mood: step.mark ? 'surprised' : 'thinking', look: -.7, ...hop(lt, step.mark ? t0 + .55 : t0, 20) })
    },
  }

  // ======================================================================
  // TRACE: a worked example. One concrete thing (a query, a token, a block of
  // keys) walks through the stages of the mechanism; at each stage the card
  // under it says what it has become, in the article's own numbers. Stages
  // already passed keep their value underneath, so the whole computation is
  // on screen by the end.
  function traceGeo(sc) {
    if (sc._g) return sc._g
    const n = sc.stages.length, x0 = 130, x1 = 1320, gap = n > 4 ? 40 : 60, w = (x1 - x0 - gap * (n - 1)) / n
    const top = Math.max(290, headBottom(sc.title) + 70)
    const st = sc.stages.map((s, i) => {
      const lb = fitR('body', s.label, 38, 26, w - 30, 2), sb = s.sub ? fitR('mono', s.sub, 24, 18, w - 26, 2) : null
      return { ...s, cx: x0 + w / 2 + i * (w + gap), lb, sb, th: lb.lines.length * lb.px * 1.12 + (sb ? sb.lines.length * sb.px * 1.1 + 6 : 0) }
    })
    const h = Math.max(130, ...st.map(s => s.th + 44))
    return (sc._g = { n, w, gap, top, h, st, cardY: top + h + 170 })
  }
  // the card's value, as large as the room under the stages allows
  function valueFit(v, room) {
    let b = null
    for (let px = 72; px >= 30; px -= 4) { b = fitR('head', v, px, px, 640, 2); if (b.lines.length * b.px * 1.12 + 60 <= room) break }
    return b
  }
  const TRACE = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const bt = beatTimes(v, sc.steps.map(s => 2.2 + readT(s.value) * .6 + readT(s.note) * .7), .8, .42)
      sc._b = bt.at; sc._ev = [{ t: .1, type: 'pop' }]
      sc.steps.forEach((s, i) => {
        const moved = i > 0 && sc.steps[i - 1].at !== s.at
        if (moved) sc._ev.push({ t: bt.at[i] + .05, type: 'whoosh' })
        sc._ev.push({ t: bt.at[i] + (moved ? .55 : .25), type: i ? 'ticks' : 'pop', n: 5, span: .3 })
      })
      sc._win = [[0, 1.2, 5]].concat(sc.steps.map((s, i) => [bt.at[i] - .04, bt.at[i] + 1.1, 5]))
      return snap(bt.end + .45)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const g = traceGeo(sc), bi = K.THUMB ? sc.steps.length - 1 : Math.max(0, beatOf(sc, lt)), step = sc.steps[bi], t0 = sc._b[bi]
      const started = K.THUMB || lt >= sc._b[0] - .05
      // the last value each stage held, up to this beat
      const held = {}
      for (let i = 0; i < bi; i++) held[sc.steps[i].at] = sc.steps[i].value
      const visited = new Set(sc.steps.slice(0, bi + 1).map(s => s.at))
      // the card: slides under the current stage, its value changing as it lands
      const prevAt = bi > 0 ? sc.steps[bi - 1].at : step.at, mk = K.THUMB ? 1 : expoOut(seg(lt, t0, t0 + .6))
      const cxFrom = g.st[prevAt].cx, cxTo = g.st[step.at].cx
      // a packet runs the track from the last stage to this one
      if (prevAt !== step.at && !K.THUMB && mk < 1) {
        const x = lerp(cxFrom, cxTo, mk), y = g.top + g.h + 18
        if (STYLE.dark) glow(x, y, 40, P().a, .8)
        STYLE.shape(ellPts(x, y, 14, 14, 12), { fill: P().a, op: 1, sw: .8, ink: STYLE.dark ? P().a : STYLE.ink })
      }
      // stages and the track between them
      g.st.forEach((s, i) => {
        const k = K.THUMB ? 1 : expoOut(seg(lt, .1 + i * .1, .5 + i * .1)); if (k <= 0) return
        const cur = started && step.at === i, been = visited.has(i) && started
        const col = cur ? P().a : been ? tone('b') : tone('light')
        if (i > 0) {
          const a = [g.st[i - 1].cx + g.w / 2 + 8, g.top + g.h / 2], b = [s.cx - g.w / 2 - 8, g.top + g.h / 2]
          boilSeed('trk' + i); STYLE.line(partial([a, b], k), .9, STYLE.dim, { curv: 0 }); if (k > .9) K.arrowHead([a, b], STYLE.dim, .8)
        }
        push(); translate(s.cx, g.top + g.h / 2 + (1 - k) * 40); G.globalAlpha *= clamp(k * 2) * (been || !started ? 1 : .55); focus(k * 1.3, 10)
        boilSeed('stage' + i)
        STYLE.shape(rrPts(-g.w / 2, -g.h / 2, g.w, g.h, 16), { fill: col, op: cur ? .95 : .8, sw: cur ? 1.4 : 1 })
        const lbH = s.lb.lines.length * s.lb.px * 1.12, y0 = -s.th / 2
        s.lb.lines.forEach((l, li) => write(l.text, 0, y0 + s.lb.px * .85 + li * s.lb.px * 1.12, s.lb.f, textOn(col), { align: 'center', ls: s.lb.ls }))
        if (s.sb) s.sb.lines.forEach((l, li) => write(l.text, 0, y0 + lbH + 6 + s.sb.px * .85 + li * s.sb.px * 1.1, s.sb.f, textOn(col) === STYLE.ink ? (STYLE.subInk || STYLE.dim) : textOn(col), { align: 'center', ls: s.sb.ls }))
        pop()
        // what this stage held, once we have moved on from it
        if (held[i] !== undefined && !(started && step.at === i)) {
          const vb = fitR('mono', held[i], 28, 19, g.w + g.gap - 12, 2)
          vb.lines.forEach((l, li) => write(l.text, s.cx, g.top + g.h + 44 + li * vb.px * 1.15, vb.f, STYLE.ink, { align: 'center', alpha: .75, ls: vb.ls }))
        }
      })
      if (!started) { host(t, { point: [g.st[0].cx, g.top + g.h / 2], mood: 'neutral', look: -.7 }); return }
      const room = 925 - g.cardY + 40, vb = valueFit(step.value, room), cw = Math.max(...vb.lines.map(l => l.width)) + 80, ch = vb.lines.length * vb.px * 1.12 + 60
      const ccx = clamp(lerp(cxFrom, cxTo, mk), 150 + cw / 2, 1310 - cw / 2), cy = Math.max(g.cardY - 40 + ch / 2, Math.min(g.cardY + ch / 2, 925 - ch / 2))
      // the stem from the stage down to the card
      const sk = K.THUMB ? 1 : easeOut(seg(lt, t0 + .3, t0 + .7))
      boilSeed('stem' + bi); STYLE.line(partial([[cxTo, g.top + g.h + 10], [ccx, cy - ch / 2 - 10]], sk), 1, P().a, { curv: 0 })
      push(); translate(ccx, cy)
      STYLE.flat(rrPts(-cw / 2 + 10, -ch / 2 + 12, cw, ch, 18), '#000000', .12)
      boilSeed('card'); STYLE.shape(rrPts(-cw / 2, -ch / 2, cw, ch, 18), { fill: STYLE.dark ? mixCol(P().bg, '#FFFFFF', .08) : tone('light'), op: .95, sw: 1.2 })
      keepClear(-cw / 2, -ch / 2, cw, ch, 18)
      // the value: the old one lifts away, the new one wipes in
      const vk = K.THUMB ? 1 : seg(lt, t0 + (prevAt !== step.at ? .45 : .15), t0 + (prevAt !== step.at ? .9 : .6))
      if (bi > 0 && vk < 1 && !K.THUMB) {
        const ob = valueFit(sc.steps[bi - 1].value, room)
        G.save(); G.beginPath(); G.rect(-cw / 2, -ch / 2, cw, ch); G.clip()
        ob.lines.forEach((l, li) => write(l.text, 0, -ch / 2 + 30 + ob.px * .85 + li * ob.px * 1.12 - vk * 40, ob.f, STYLE.ink, { align: 'center', alpha: 1 - clamp(vk * 2.5), ls: ob.ls }))
        G.restore()
      }
      if (vk > 0) {
        const wk = K.THUMB || bi === 0 ? vk : seg(vk, .35, 1)
        G.save(); G.beginPath(); G.rect(-cw / 2, -ch / 2, cw * easeOut(wk), ch); G.clip()
        vb.lines.forEach((l, li) => write(l.text, 0, -ch / 2 + 30 + vb.px * .85 + li * vb.px * 1.12, vb.f, STYLE.ink, { align: 'center', ls: vb.ls }))
        G.restore()
      }
      pop()
      note(lt, step.note, t0 + .5)
      host(t, { point: [ccx + cw / 2 - 10, cy], mood: bi === sc.steps.length - 1 ? 'happy' : 'excited', look: -.7, ...hop(lt, t0 + .5, 20) })
    },
  }

  // ======================================================================
  // CODE: the article's own code, a few lines, highlighted range by range as
  // the narrator walks through it. No line numbers: they would be digits the
  // article never printed.
  const KW = /\b(def|return|for|in|if|elif|else|while|import|from|class|const|let|var|function|async|await|yield|lambda|with|as|not|and|or|None|True|False|null|true|false|new|struct|fn|pub|use|impl|self)\b/
  function tokens(line) {
    const out = [], re = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g
    let m
    while ((m = re.exec(line))) out.push({ s: m[0], kind: m[1] ? 'com' : m[2] ? 'str' : m[3] && KW.test(m[3]) && m[3].match(KW)[0] === m[3] ? 'kw' : 'txt' })
    return out
  }
  const CODE = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const bt = beatTimes(v, sc.steps.map(s => 2 + readT(s.note) * .7), .8, .42)
      sc._b = bt.at; sc._ev = [{ t: .1, type: 'slide' }, { t: .4, type: 'ticks', n: Math.min(24, sc.code.length * 2), span: .6 }].concat(sc.steps.map((_, i) => ({ t: bt.at[i] + .1, type: 'scratch' })))
      sc._win = [[0, 1.3, 5]].concat(sc.steps.map((_, i) => [bt.at[i] - .04, bt.at[i] + .7, 5]))
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const top = sc.title ? headBottom(sc.title) + 50 : 190, maxW = 1080, maxH = (sc.credit ? 880 : 920) - top
      const longest = sc.code.reduce((a, l) => (l.length > a.length ? l : a), '')
      let px = 40; const f = () => F('mono', px)
      while (px > 18 && (measure(longest, f()) > maxW - 80 || sc.code.length * px * 1.45 > maxH - 60)) px -= 1
      const lh = px * 1.45, cw = Math.min(maxW, measure(longest, f()) + 110), ch = sc.code.length * lh + 56, x0 = 150, y0 = top
      const k = K.THUMB ? 1 : expoOut(seg(lt, 0, .6))
      const paper = STYLE.dark ? mixCol(P().bg, '#000000', .35) : '#FFFFFF'
      push(); translate(0, (1 - k) * 60); G.globalAlpha *= clamp(k * 2); focus(k * 1.2, 10)
      STYLE.flat(rrPts(x0 + 10, y0 + 14, cw, ch, 14), '#000000', .14)
      STYLE.flat(rrPts(x0, y0, cw, ch, 14), paper, 1)
      boilSeed('codecard'); STYLE.line(rrPts(x0, y0, cw, ch, 14), .9, STYLE.dim, { closed: true, curv: 0 })
      keepClear(x0, y0, cw, ch, 14)
      const bi = K.THUMB ? -1 : beatOf(sc, lt), step = sc.steps[bi] || null, t0 = sc._b[Math.max(0, bi)]
      const [a, b] = step ? step.lines : [1, sc.code.length], hk = K.THUMB ? 0 : easeOut(seg(lt, t0, t0 + .45))
      if (step) STYLE.hl(x0 + 40, y0 + 28 + (a - 1) * lh + lh * .08, cw - 80, (b - a + 1) * lh - lh * .1, P().hi, hk)
      const inkCol = STYLE.dark ? STYLE.ink : '#1E1E24', dimCol = STYLE.dim
      sc.code.forEach((line, i) => {
        const lk = K.THUMB ? 1 : seg(lt, .3 + i * .05, .5 + i * .05); if (lk <= 0) return
        const on = !step || (i + 1 >= a && i + 1 <= b), y = y0 + 28 + i * lh + lh * .72
        G.save(); G.globalAlpha *= lk * (on ? 1 : lerp(1, .35, hk))
        let x = x0 + 56
        for (const tkn of tokens(line)) {
          if (!/^\s+$/.test(tkn.s)) write(tkn.s, x, y, f(), tkn.kind === 'com' ? dimCol : tkn.kind === 'kw' ? (STYLE.dark ? P().a : mixCol(P().a, '#000000', .35)) : tkn.kind === 'str' ? (STYLE.dark ? P().hi : mixCol(P().b, '#000000', .4)) : inkCol)
          x += measure(tkn.s, f())
        }
        G.restore()
      })
      // a chevron in the gutter at the lines being read
      if (step && hk > 0) { const y = y0 + 28 + ((a + b) / 2 - 1) * lh + lh * .5; boilSeed('chev' + bi); STYLE.line([[x0 + 16, y - 12], [x0 + 32, y], [x0 + 16, y + 12]], 1.2, P().a, { curv: 0 }) }
      pop()
      if (sc.credit) write(caps('mono', 'Source: ' + sc.credit), x0, y0 + ch + 44, F('mono', 24), STYLE.dim, { alpha: k })
      if (step) note(lt, step.note, t0 + .4)
      host(t, { point: [x0 + cw - 30, y0 + 28 + (step ? ((a + b) / 2 - 1) * lh + lh * .5 : ch / 2)], mood: 'thinking', look: -.7, ...hop(lt, t0, 16) })
    },
  }

  // ======================================================================
  // INSET: a diagram, and then one of its nodes opened up. The camera dives
  // into the node, the box becomes a frame, and inside it a second diagram
  // builds as the narrator explains the part; a later step can come back out.
  // Both diagrams are laid out in the usual diagram area (node centres in
  // percent), and timed like a diagram: a step builds what it shows.
  function insetParts(sc) {
    if (sc._parts) return sc._parts
    const outer = { nodes: sc.nodes, edges: sc.edges, groups: sc.groups, steps: sc.steps.map(s => (s.inner ? {} : s)) }
    const inner = { nodes: sc.inner.nodes, edges: sc.inner.edges, steps: sc.steps.map(s => (s.inner ? s : {})) }
    // an inner part with no step showing it appears when the inset opens
    const first = sc.steps.findIndex(s => s.inner)
    if (first >= 0 && !inner.steps.some(s => s.show)) inner.steps[first] = { ...inner.steps[first], show: sc.inner.nodes.map(n => n.id) }
    if (!outer.steps.some(s => s.show)) outer.steps[0] = { ...outer.steps[0], show: sc.nodes.map(n => n.id) }
    return (sc._parts = { outer, inner, Lo: K.layoutDiagram(outer), Li: K.layoutDiagram(inner) })
  }
  // how far into the inset we are at scene time lt: 0 outside, 1 inside
  function depth(sc, lt) {
    let d = 0
    sc.steps.forEach((s, i) => {
      const b = sc._b[i] - .05; if (lt < b) return
      const was = i > 0 && !!sc.steps[i - 1].inner ? 1 : 0, now = s.inner ? 1 : 0
      d = now === was ? now : lerp(was, now, ease(seg(lt, b, b + 1.1)))
    })
    return d
  }
  // the drawing of one diagram (groups, edges, packets, nodes) as DIAGRAM draws it
  function layer(sub, L, lt, bi, dur, alpha) {
    if (alpha <= 0) return
    const step = sub.steps[bi] || {}, t0 = sub._b[bi]
    const appear = id => { if (K.THUMB) return 1; const si = L.shown[id]; if (si > bi) return 0; const order = Object.keys(L.nodes).filter(x => L.shown[x] === si).indexOf(id); return seg(lt, sub._b[si] + Math.max(0, order) * .16, sub._b[si] + Math.max(0, order) * .16 + .35) }
    const hlSet = new Set(K.THUMB ? [] : (step.highlight || [])), dim = hlSet.size ? .35 + .65 * (1 - easeOut(seg(lt, t0, t0 + .3))) : 1
    G.save(); G.globalAlpha *= alpha
    for (const g of L.groups) {
      const k = K.THUMB ? 1 : seg(lt, sub._b[g.step], sub._b[g.step] + .5); if (k <= 0) continue
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      for (const id of g.nodes) { const n = L.nodes[id]; if (!n) continue; x0 = Math.min(x0, n.cx - n.w / 2); x1 = Math.max(x1, n.cx + n.w / 2); y0 = Math.min(y0, n.cy - n.h / 2); y1 = Math.max(y1, n.cy + n.h / 2) }
      x0 -= 34; y0 -= 58; x1 += 34; y1 += 30
      G.save(); G.globalAlpha *= easeOut(k)
      STYLE.shape(rrPts(x0, y0, x1 - x0, y1 - y0, 26), { fill: tone(g.tone || 'light'), op: .25, ink: null })
      write(caps('label', g.label), x0 + 20, y0 + 36, F('label', 24), STYLE.dim)
      G.restore()
    }
    const flowKeys = new Set(K.THUMB ? [] : (step.flow || []))
    for (const e of L.edges) {
      const si = e.step; if (si > bi && !K.THUMB) continue
      const base = sub._b[si] + Object.keys(L.nodes).filter(x => L.shown[x] === si).length * .16 + .1
      const k = K.THUMB ? 1 : ease(seg(lt, base, base + .55)); if (k <= 0) continue
      const on = hlSet.has(e.from) || hlSet.has(e.to) || flowKeys.has(e.key)
      G.save(); if (!on) G.globalAlpha *= dim
      K.drawEdge(e, k, flowKeys.has(e.key) ? P().a : STYLE.ink, e.dashed)
      const f_ = F('mono', 24), lw = e.label ? measure(caps('mono', e.label), f_) : 0
      if (e.label && k > .9 && lw < K.lenOf(e._pts) - 40) {
        const m = K.along(e._pts, K.lenOf(e._pts) / 2)
        STYLE.flat(rrPts(m[0] - lw / 2 - 10, m[1] - 20, lw + 20, 34, 8), bgCol(), .92)
        write(caps('mono', e.label), m[0], m[1] + 6, f_, STYLE.dim, { align: 'center' })
      }
      G.restore()
    }
    if (flowKeys.size) {
      const path = []
      for (const key of step.flow) { const e = L.edges.find(x => x.key === key); if (e) path.push(...(e._pts || (e._pts = K.edgePath(e)))) }
      if (path.length > 1) {
        const Lp = K.lenOf(path), start = t0 + .35, end = (sub._b[bi + 1] ?? dur) - .1
        for (let s = start; s < end; s += .42) {
          const d = (lt - s) * 560; if (d < 0 || d > Lp) continue
          const [x, y] = K.along(path, d)
          if (STYLE.dark) glow(x, y, 40, P().a, .8)
          STYLE.shape(ellPts(x, y, 13, 13, 12), { fill: P().a, op: 1, sw: .8, ink: STYLE.dark ? P().a : STYLE.ink })
        }
      }
    }
    for (const id in L.nodes) {
      const n = L.nodes[id], on = hlSet.has(id)
      G.save(); if (!on) G.globalAlpha *= dim
      K.drawNode(n, appear(id), on, lt)
      G.restore()
    }
    G.restore()
  }
  const INSET = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const { Lo, Li } = insetParts(sc)
      const bt = beatTimes(v, sc.steps.map((s, i) => 1.8 + readT(s.note) * .7 + (s.flow ? 1.4 : 0) + (!!s.inner !== !!(sc.steps[i - 1] || {}).inner ? 1.1 : 0)), .55, .42)
      sc._b = bt.at; sc._ev = []
      sc.steps.forEach((s, i) => {
        const L = s.inner ? Li : Lo, t0 = bt.at[i], turn = !!s.inner !== !!(sc.steps[i - 1] || {}).inner && i > 0
        if (turn) sc._ev.push({ t: t0, type: 'whoosh' })
        const fresh = Object.keys(L.nodes).filter(id => L.shown[id] === i), d = turn ? .9 : 0
        fresh.forEach((id, j) => sc._ev.push({ t: t0 + d + j * .16, type: 'pop' }))
        if (s.flow) sc._ev.push({ t: t0 + d + .35, type: 'flow', span: (bt.at[i + 1] ?? bt.end) - t0 - d - .5 })
        if (s.highlight) sc._ev.push({ t: t0 + .1, type: 'ding' })
      })
      sc._win = sc.steps.map((s, i) => [bt.at[i] - .05, bt.at[i] + 1.5, 5]).concat(sc.steps.flatMap((s, i) => s.flow ? [[bt.at[i] + .3, (bt.at[i + 1] ?? bt.end), 1]] : []))
      return snap(bt.end + .4)
    },
    draw(t, lt, sc, dur) {
      const { outer, inner, Lo, Li } = insetParts(sc)
      outer._b = inner._b = sc._b
      const bi = K.THUMB ? sc.steps.length - 1 : beatOf(sc, lt), step = sc.steps[bi] || {}, t0 = sc._b[bi]
      const d = K.THUMB ? (step.inner ? 1 : 0) : depth(sc, lt)
      // the inner diagram's beat timing is shifted by the dive, so its parts
      // arrive once the frame has opened
      const shift = (i) => (sc.steps[i] && sc.steps[i].inner && !(sc.steps[i - 1] || {}).inner && i > 0 ? .9 : 0)
      inner._b = sc._b.map((b, i) => b + shift(i))
      // the heading changes to the inside's own when the frame is mostly open
      const opened = sc.steps.findIndex(s => s.inner)
      if (d > .5 && sc.inner.title) heading(lt, sc.inner.title, sc._b[opened] + .5)
      else heading(lt, sc.title)
      folio(lt)
      const o = Lo.nodes[sc.open]
      const top = Math.max(250, headBottom(sc.inner.title || sc.title) + 18)
      const R1 = { x0: 110, y0: top, x1: 1330, y1: sc.steps.some(s => s.note) ? 870 : 915 }, R0 = { x0: o.cx - o.w / 2, y0: o.cy - o.h / 2, x1: o.cx + o.w / 2, y1: o.cy + o.h / 2 }
      const S = Math.min((R1.x1 - R1.x0) / o.w, (R1.y1 - R1.y0) / o.h), s = Math.pow(S, d)
      const c1 = [(R1.x0 + R1.x1) / 2, (R1.y0 + R1.y1) / 2], c = [lerp(o.cx, c1[0], d), lerp(o.cy, c1[1], d)]
      // outside: the outer diagram, the camera diving toward the open node
      if (d < 1) {
        push(); translate(c[0], c[1]); scale(s); translate(-o.cx, -o.cy)
        layer(outer, Lo, lt, bi, dur, 1 - clamp(d * 1.6))
        pop()
      }
      // the frame: the node's box, grown to hold the inside
      if (d > 0) {
        const r = { x0: lerp(R0.x0, R1.x0, d), y0: lerp(R0.y0, R1.y0, d), x1: lerp(R0.x1, R1.x1, d), y1: lerp(R0.y1, R1.y1, d) }
        const fill = tone(o.tone || { box: 'light', pill: 'a', stack: 'b', db: 'hi', grid: 'b', doc: 'light', chip: 'a', user: 'hi', cloud: 'light' }[o.kind] || 'light')
        STYLE.flat(rrPts(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 22), bgCol(), clamp(d * 3))
        G.save(); G.globalAlpha *= clamp(d * 2)
        STYLE.flat(rrPts(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 22), fill, .14)
        boilSeed('frame'); STYLE.line(rrPts(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 22), 1.2, P().a, { closed: true, curv: 0 })
        write(caps('label', 'Inside: ' + o.label), r.x0 + 26, r.y0 + 40, F('label', 26), STYLE.dim, { alpha: clamp(d * 2 - 1) })
        G.restore()
        // inside: the inner diagram, scaled with the frame
        const sIn = (r.x1 - r.x0) / (R1.x1 - R1.x0), rc = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]
        G.save(); G.beginPath(); G.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); G.clip()
        push(); translate(rc[0], rc[1]); scale(sIn); translate(-c1[0], -c1[1])
        layer(inner, Li, lt, bi, dur, clamp(d * 1.8 - .5))
        pop()
        G.restore()
      }
      note(lt, step.note, t0 + .3 + (step.inner && !(sc.steps[bi - 1] || {}).inner && bi > 0 ? .9 : 0))
      // the host points at the part this step is about, where it is on screen now
      const L = step.inner ? Li : Lo, tgtId = (step.highlight && step.highlight[0]) || (step.show && step.show[step.show.length - 1]) || (step.inner ? Object.keys(Li.nodes)[0] : sc.open)
      const tn = L.nodes[tgtId] || o
      let pt
      if (step.inner && d > 0) { const r0x = lerp(R0.x0, R1.x0, d), r1x = lerp(R0.x1, R1.x1, d), r0y = lerp(R0.y0, R1.y0, d), r1y = lerp(R0.y1, R1.y1, d), sIn = (r1x - r0x) / (R1.x1 - R1.x0); pt = [(r0x + r1x) / 2 + (tn.cx - c1[0]) * sIn, (r0y + r1y) / 2 + (tn.cy - c1[1]) * sIn] }
      else pt = [c[0] + (tn.cx - o.cx) * s, c[1] + (tn.cy - o.cy) * s]
      host(t, { point: [clamp(pt[0], 150, 1350), clamp(pt[1], 250, 950)], mood: d > 0 && d < 1 ? 'surprised' : step.highlight ? 'thinking' : 'neutral', look: -.7, ...hop(lt, t0, 18) })
    },
  }

  Object.assign(SCENES, { chapter: CHAPTER, hook: HOOK, chart: CHART, trace: TRACE, code: CODE, inset: INSET })
})()
