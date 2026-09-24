// explainer.js — the scenes and the film.
//
// A film explains how something works. Its storyboard is a list of scenes;
// each scene has one or more *beats*, and each beat is one line of narration
// the picture is timed to: a diagram builds node by node as the narrator
// names the parts, packets run along the edges while it describes the flow,
// the bunny hops to the next station of a process on the next line.
//
// Every scene type has
//   beats(sc)          its narration lines (authored `say`, or generated)
//   plan(sc, v)        its length, from the lines' spoken durations v[] and
//                      what the viewer must read; sets sc._b (beat starts)
//                      and sc._ev (sound cues), both in scene time
//   draw(t, lt, sc)    the frame at scene time lt; a pure function of time
(() => {
  const M = 110, READ = 3.6
  let SB = null, TL = null, THUMB = false
  const P = () => STYLE.P
  const readT = s => (s ? .4 + words(s) / READ : 0)
  const snap = x => Math.ceil(x * 12 - 1e-6) / 12
  const bgCol = () => (STYLE.dark ? P().bg : STYLE.paper)
  const tone = k => ({ a: P().a, b: P().b, hi: P().hi, light: P().light, ink: STYLE.ink }[k] || P().light)
  const luma = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 }
  // text colour on a filled shape: the style's ink, except where fills are opaque and bright
  const textOn = c => (STYLE.name === 'pixel' ? (luma(c) > .5 ? '#000000' : '#FFF1E8') : STYLE.ink)

  // beats laid end to end: each lasts its spoken line plus a breath, or its reading minimum
  function beatTimes(v, mins, lead = .35, gap = .5) {
    const at = []; let t = lead
    mins.forEach((m, i) => { at.push(t); t += Math.max((v[i] || 0) + gap, m) })
    return { at, end: t }
  }
  const beatOf = (sc, lt) => { let i = 0; while (i + 1 < sc._b.length && lt >= sc._b[i + 1]) i++; return i }

  // ---------- the host ----------
  function talkAt(t) {
    if (!TL) return 0
    for (const b of TL.beats) if (t >= b.t && t < b.t + b.d) { const x = t - b.t; return .3 + .7 * Math.abs(Math.sin(x * 15)) * (.55 + .45 * Math.sin(x * 4.3)) }
    return 0
  }
  // The host presents from the right of the frame, big, its feet below the
  // bottom edge: a presenter in shot, never a figure standing on a floor.
  // Scene content keeps left of x ~1400 to leave it room.
  const HOST = { x: 1660, u: 70 }
  function host(t, o = {}) {
    if (THUMB) o = { ...o, talk: 0, wave: false }
    const u = o.u || HOST.u, x = o.x ?? HOST.x
    mascot(x, H + .9 * u + (o.rise || 0), u, { t, talk: talkAt(t), key: 'host', ...o })
  }
  const hop = (lt, t0, h = 40) => { const j = jump(lt, t0, t0 + .45, h); return { dy: j.dy, sq: j.sq, earKick: lt > t0 && lt < t0 + .6 ? .25 * Math.sin((lt - t0) * 14) * (1 - (lt - t0) / .6) : 0 } }

  // ---------- chrome ----------
  function folio(lt) {
    if (THUMB) return
    const a = easeOut(seg(lt, .05, .35))
    write(caps('label', SB.kicker), M, 78, F('mono', 26), STYLE.dim, { ls: 2, alpha: a })
    write('ai.thesatyajit.com', W - M, 78, F('mono', 24), STYLE.dim, { align: 'right', alpha: a })
  }
  // where a scene heading's last line ends: one line or two, by the style's font
  const headBottom = str => { if (!str) return 150; const b = fitR('head', str, 64, 40, 1250, 2); return 190 + (b.lines.length - 1) * b.px * 1.1 + b.px * .25 }
  function heading(lt, str, t0 = .1, y = 190) {
    if (!str || THUMB) return null
    const b = fitR('head', str, 64, 40, 1250, 2)
    wipeLines(lt, b, M, y, b.px * 1.1, t0, .12, STYLE.ink, { dur: .45 })
    return b
  }
  function note(lt, str, t0) {
    if (!str || THUMB) return
    const b = fitR('body', str, 36, 26, 1250, 2)
    wipeLines(lt, b, M, 990 - (b.lines.length - 1) * b.px * 1.15, b.px * 1.15, t0, .1, STYLE.dim)
  }
  const STAMPS = { measured: 'Measured', reported: 'Reported', reasoned: 'Reasoned', holds: 'Holds', 'does not hold': 'Does not hold', 'half true': 'Half true' }
  function stamp(lt, t0, key, x, y) {
    if (!key || lt < t0) return
    const lab = caps('label', STAMPS[key] || key), f = F('label', 34), w = measure(lab, f) + 44, k = seg(lt, t0, t0 + .18), s = lerp(1.7, 1, easeIn(k))
    push(); translate(x, y); rotate(-.08); scale(s)
    G.globalAlpha *= clamp(k * 3)
    STYLE.shape(rrPts(-w / 2, -30, w, 60, 12), { fill: P().hi, op: .5, ink: STYLE.dark ? P().hi : STYLE.ink, sw: 1.1 })
    write(lab, 0, 12, f, textOn(P().hi), { align: 'center' })
    pop()
  }

  // ======================================================================
  // TITLE: the hook, the headline, and the bunny introducing itself
  const TITLE = {
    beats: sc => [sc.say || `Hi, I'm ${MASCOT.name}! ${sent(sc.headline)} ${sent(sc.sub)}`.trim()],
    plan(sc, v) {
      const pe = (sc.punch || []).length * .42
      const bt = beatTimes(v, [readT(sc.headline) + readT(sc.sub) + 1.4], pe + .45)
      sc._b = bt.at
      sc._t = { pe, h0: pe + .1, subAt: pe + .35 + words(sc.headline) * .09, bun: pe + .35 }
      sc._ev = (sc.punch || []).map((_, i) => ({ t: i * .42, type: 'punch' })).concat([{ t: sc._t.h0, type: 'write' }, { t: sc._t.bun + .05, type: 'boing' }])
      const dur = snap(Math.max(4.2, bt.end + .3))
      sc._t.poster = Math.min(dur - .1, sc._t.subAt + 1.6)
      return dur
    },
    draw(t, lt, sc) {
      const T_ = sc._t
      if (lt < T_.pe && !THUMB) {
        const i = Math.min(sc.punch.length - 1, Math.floor(lt / .42)), pl = lt - i * .42, bg = [P().a, P().b, STYLE.ink][i % 3]
        STYLE.flat(rectPts(-40, -40, W + 80, H + 80), bg, 1)
        const b = fitR('head', sc.punch[i], 330, 110, W - 260, 2), s = lerp(1.14, 1, easeOut(seg(pl, 0, .42))), lh = b.px * .98
        push(); translate(W / 2, H / 2); scale(s); rotate((i % 2 ? 1 : -1) * .02); translate(-W / 2, -H / 2)
        const fg = i % 3 === 2 ? bgCol() : (STYLE.dark ? P().bg : '#FFFFFF')
        b.lines.forEach((l, li) => write(l.text, W / 2, H / 2 + b.px * .36 - (b.lines.length - 1) * lh / 2 + li * lh, b.f, STYLE.name === 'pixel' ? textOn(bg) : fg, { align: 'center' }))
        pop()
        return
      }
      titleSet(lt - T_.pe, sc)
      const hb = fitR('head', sc.headline, 132, 64, 1180, 3), lh = hb.px * 1.04, top = 280 + hb.px * .8
      let i = 0
      if (!THUMB) write(caps('label', SB.kicker), M, 210, F('label', 34), P().a === '#FFE45C' ? STYLE.ink : (STYLE.dark ? P().a : STYLE.ink), { alpha: easeOut(seg(lt, T_.pe, T_.pe + .3)), ls: 2 })
      hb.lines.forEach((line, li) => line.words.forEach(w => {
        const k = THUMB ? 1 : seg(lt, T_.h0 + i * .09, T_.h0 + i * .09 + .28); i++
        if (k <= 0) return
        const s = lerp(1.45, 1, backOut(k))
        push(); translate(M + w.x + w.w / 2, top + li * lh - hb.px * .35); scale(s)
        write(w.text, -w.w / 2, hb.px * .35, hb.f, STYLE.ink, { alpha: k * 3 })
        pop()
      }))
      if (sc.sub && !THUMB) {
        const sb = fitR('body', sc.sub, 50, 34, 1100, 2), sy = top + (hb.lines.length - 1) * lh + hb.px * .5 + sb.px * 1.4
        wipeLines(lt, sb, M, sy, sb.px * 1.2, T_.subAt, .15, STYLE.dim)
      }
      const b0 = T_.bun, j = hop(lt, b0 + .1, 60)
      if (lt > b0 - .05 || THUMB) {
        const rise = THUMB ? 0 : 520 * (1 - easeOut(seg(lt, b0 - .05, b0 + .3)))
        host(t, { x: 1570, u: 94, mood: lt < b0 + 1.2 ? 'excited' : 'happy', wave: lt > b0 + .3, dy: j.dy, rise, sq: j.sq, earKick: j.earKick, look: -.4 })
      }
    },
  }
  // each style sets its own stage for the title
  function titleSet(l2, sc) {
    const S = STYLE.name, p = P()
    if (S === 'watercolour' || S === 'riso') {
      const cx = 1560, cy = 760, R = 1300, rot = l2 * .05
      for (let i = 0; i < 16; i++) {
        const a0 = rot + i / 16 * TAU, a1 = a0 + TAU / 32
        boilSeed('ray' + i)
        STYLE.shape([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], { fill: i % 2 ? p.light : p.wash, op: .6, ink: null })
      }
    } else if (S === 'chalkboard') {
      boilSeed('doodle')
      for (const [x, y, s] of [[1250, 250, 36], [1810, 330, 26], [1330, 610, 22]]) STYLE.line(starPts(x, y, s * easeOut(seg(l2, .2, .6)), .45, 5), 1.1, p.a, { closed: true, curv: 0 })
      STYLE.line([[1180, 820], [1320, 760], [1400, 820]], 1.4, p.b, { curv: .5 })
    } else if (S === 'blueprint') {
      const k = easeOut(seg(l2, .1, .6)), x0 = M, y0 = 840
      STYLE.line(rectPts(x0, y0, 620 * k + 1, 170), 1, STYLE.ink, { closed: true })
      if (k > .9) {
        STYLE.line([[x0, y0 + 56], [x0 + 620, y0 + 56]], .7); STYLE.line([[x0, y0 + 112], [x0 + 620, y0 + 112]], .7); STYLE.line([[x0 + 250, y0 + 56], [x0 + 250, y0 + 170]], .7)
        const f = F('mono', 22)
        write('DWG  ' + caps('label', SB.kicker), x0 + 16, y0 + 38, f, STYLE.dim)
        write('DRAWN BY', x0 + 16, y0 + 92, f, STYLE.dim); write(MASCOT.name.toUpperCase(), x0 + 266, y0 + 92, f, STYLE.ink)
        write('DATE', x0 + 16, y0 + 148, f, STYLE.dim); write(SB.date || '', x0 + 266, y0 + 148, f, STYLE.ink)
      }
    } else if (S === 'neon') {
      const on = l2 > .3 && !(l2 > .45 && l2 < .52) && !(l2 > .6 && l2 < .64)
      if (on || THUMB) STYLE.line(rrPts(60, 150, 1320, 820, 40), 1.1, p.a, { closed: true, curv: 0 })
    } else if (S === 'notebook') {
      write(`${SB.date || ''}`, W - M, 150, F('body', 34), STYLE.dim, { align: 'right' })
      boilSeed('nbd'); STYLE.line(starPts(1300, 280, 30, .45, 5), 1, STYLE.ink, { closed: true, curv: 0 })
    } else if (S === 'pixel') {
      const k = Math.floor(l2 * 2) % 2
      if (k === 0 || THUMB) write('> PRESS START', 1560, 180, F('label', 30), p.hi, { align: 'center' })
      for (let i = 0; i < 6; i++) { const x = 1250 + ((i * 173 + l2 * 90) % 600), y = 300 + (i * 97) % 380; STYLE.flat(rectPts(x, y, 12, 12), p.hi, .9) }
    }
  }

  // ======================================================================
  // IDEA: the one sentence that says what is new
  const IDEA = {
    beats: sc => [sc.say || sent(sc.text)],
    plan(sc, v) {
      const bt = beatTimes(v, [readT(sc.text) + 1.6], .35)
      sc._b = bt.at; sc._t = { markAt: bt.at[0] + Math.max(1, (v[0] || 2) * .55), bulb: .5 }
      sc._ev = [{ t: .2, type: 'write' }, { t: sc._t.bulb, type: 'ding' }]
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      folio(lt)
      if (!THUMB) write(caps('label', sc.label || 'The idea'), M, 230, F('label', 38), STYLE.dark ? P().a : STYLE.ink, { alpha: easeOut(seg(lt, 0, .3)), ls: 2 })
      const b = fitR('body', sc.text, 78, 44, 1180, 6, -.01), lh = b.px * 1.22, y = 350 + b.px * .8
      const k = THUMB ? 1 : easeOut(seg(lt, sc._t.markAt, sc._t.markAt + .45))
      for (const bx of phraseBoxes(b, sc.mark, M, y, lh)) STYLE.hl(bx.x, bx.y, bx.w, bx.h, P().hi, k)
      wipeLines(THUMB ? 99 : lt, b, M, y, lh, .15, .12, STYLE.ink)
      const bk = backOut(seg(lt, sc._t.bulb, sc._t.bulb + .35)), bx = 1660, by = 330
      if (bk > 0) {
        push(); translate(bx, by); scale(bk)
        if (STYLE.dark) glow(0, 0, 150, P().hi, .6 + .2 * Math.sin(lt * 5))
        STYLE.shape(ellPts(0, 0, 58, 58, 24), { fill: P().hi, op: .9, sw: 1.1 })
        STYLE.shape(rrPts(-28, 50, 56, 44, 8), { fill: '#9AA3AD', op: .9, sw: .9 })
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .42; STYLE.line([[Math.cos(a) * 82, Math.sin(a) * 82], [Math.cos(a) * 112, Math.sin(a) * 112]], 1, P().hi, { curv: 0 }) }
        pop()
      }
      host(t, { mood: lt < sc._t.bulb + .8 ? 'surprised' : 'excited', look: -.5, lookY: -.6, point: [1200, 520], ...hop(lt, sc._t.bulb, 30) })
    },
  }

  // ======================================================================
  // DIAGRAM: an architecture, built as it is described
  const AREA = { x0: 160, x1: 1260, y0: 300, y1: 890 }
  function layoutDiagram(sc) {
    if (sc._L) return sc._L
    const nodes = {}
    for (const n of sc.nodes) {
      const kind = n.kind || 'box', cx = AREA.x0 + n.at[0] / 100 * (AREA.x1 - AREA.x0), cy = AREA.y0 + n.at[1] / 100 * (AREA.y1 - AREA.y0)
      // an operator circle grows to hold its word
      if (kind === 'op') { const lb = fitR('head', n.label, 46, 26, 150, 1), r = Math.max(48, lb.lines[0].width / 2 + 20); nodes[n.id] = { ...n, kind, cx, cy, w: r * 2, h: r * 2, r, lb }; continue }
      // a sub-label may take two lines rather than being cut off
      // one line if it fits at any size, two only if it doesn't (no lone word on a second line)
      const lb = fitR('body', n.label, 32, 24, 250, 2)
      let sb = n.sub ? fitR('mono', n.sub, 25, 19, 300, 1) : null
      if (sb && sb.lines.length > 1) sb = fitR('mono', n.sub, 25, 19, 300, 2)
      let w = Math.max(150, Math.max(...lb.lines.map(l => l.width), ...(sb ? sb.lines.map(l => l.width) : [0])) + 60) + (kind === 'grid' ? 64 : 0)
      let h = lb.lines.length * lb.px * 1.15 + 44 + (sb ? sb.px * (.3 + sb.lines.length) : 0)
      if (kind === 'user') { w = Math.max(w - 40, 130); h += 70 }
      if (kind === 'db') h += 24
      nodes[n.id] = { ...n, kind, cx, cy, w, h, lb, sb }
    }
    const edges = (sc.edges || []).map(e => ({ ...e, key: e.from + '>' + e.to, A: nodes[e.from], B: nodes[e.to] })).filter(e => e.A && e.B)
    // when each thing appears: the step that first shows it
    const shown = {}, steps = sc.steps
    steps.forEach((s, i) => (s.show || []).forEach(id => { if (shown[id] === undefined) shown[id] = i }))
    if (!steps.some(s => s.show)) for (const id in nodes) shown[id] = 0
    for (const id in nodes) if (shown[id] === undefined) shown[id] = 0
    for (const e of edges) e.step = Math.max(shown[e.from], shown[e.to], shown[e.key] ?? 0)
    const groups = (sc.groups || []).map(g => ({ ...g, step: Math.min(...g.nodes.map(id => shown[id] ?? 0)) }))
    return (sc._L = { nodes, edges, shown, groups })
  }
  function edgePath(e) {
    const A = e.A, B = e.B, dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy) || 1
    const nx = -dy / L, ny = dx / L, bend = (e.bend || 0) * L * .35
    const C = [(A.cx + B.cx) / 2 + nx * bend, (A.cy + B.cy) / 2 + ny * bend]
    const clip = (n, tx, ty) => {
      const d = Math.hypot(tx, ty) || 1, ux = tx / d, uy = ty / d
      if (n.r) return n.r + 10
      return Math.min(Math.abs(ux) > 1e-6 ? (n.w / 2 + 12) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? (n.h / 2 + 12) / Math.abs(uy) : 1e9)
    }
    const ta = clip(A, C[0] - A.cx, C[1] - A.cy), tb = clip(B, C[0] - B.cx, C[1] - B.cy)
    const da = Math.hypot(C[0] - A.cx, C[1] - A.cy) || 1, db = Math.hypot(C[0] - B.cx, C[1] - B.cy) || 1
    const p0 = [A.cx + (C[0] - A.cx) / da * ta, A.cy + (C[1] - A.cy) / da * ta], p2 = [B.cx + (C[0] - B.cx) / db * tb, B.cy + (C[1] - B.cy) / db * tb]
    const pts = []
    for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([(1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * C[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * C[1] + u * u * p2[1]]) }
    return pts
  }
  const lenOf = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s }
  function along(pts, d) {
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l) { const k = d / (l || 1); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)] } d -= l }
    return pts[pts.length - 1]
  }
  function partial(pts, k) { const L = lenOf(pts) * k, out = [pts[0]]; let d = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d + l >= L) { out.push(along(pts, L)); break } out.push(pts[i]); d += l } return out }
  function arrowHead(pts, col, sw = 1) {
    const n = pts.length, a = pts[n - 1], b = pts[Math.max(0, n - 3)], ang = Math.atan2(a[1] - b[1], a[0] - b[0])
    STYLE.line([[a[0] - Math.cos(ang - .45) * 24, a[1] - Math.sin(ang - .45) * 24], a, [a[0] - Math.cos(ang + .45) * 24, a[1] - Math.sin(ang + .45) * 24]], sw, col, { curv: 0 })
  }
  function drawEdge(e, k, col, dashed) {
    const pts = partial(e._pts || (e._pts = edgePath(e)), k)
    if (pts.length < 2) return
    if (dashed) { const L = lenOf(pts); for (let d = 0; d < L; d += 36) { const seg_ = []; for (let q = d; q <= Math.min(L, d + 20); q += 5) seg_.push(along(pts, q)); if (seg_.length > 1) STYLE.line(seg_, .9, col, { curv: 0 }) } }
    else STYLE.line(pts, 1, col, { curv: 0 })
    if (k > .92) arrowHead(pts, col)
  }
  function drawNode(n, k, emph, lt) {
    if (k <= 0) return
    const s = lerp(.6, 1, backOut(k)), c = tone(n.tone || { box: 'light', pill: 'a', stack: 'b', db: 'hi', grid: 'b', doc: 'light', chip: 'a', user: 'hi', cloud: 'light' }[n.kind] || 'light')
    push(); translate(n.cx, n.cy); scale(s); G.globalAlpha *= clamp(k * 2.5)
    const w = n.w, h = n.h, ink = { sw: emph ? 1.5 : 1 }
    boilSeed('node' + n.id)
    if (emph && !THUMB) { const pad = 16 + 4 * Math.sin(lt * 6); STYLE.line(rrPts(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 26), 1.3, P().a, { closed: true, curv: 0 }); if (STYLE.dark) glow(0, 0, w * .7, P().a, .35) }
    const K = n.kind
    if (K === 'op') STYLE.shape(ellPts(0, 0, n.r, n.r, 28), { fill: c, ...ink })
    else if (K === 'pill') STYLE.shape(rrPts(-w / 2, -h / 2, w, h, h / 2), { fill: c, ...ink })
    else if (K === 'stack') {
      for (const o of [28, 14]) STYLE.shape(rrPts(-w / 2 + o, -h / 2 - o, w, h, 16), { fill: c, op: .5, ...ink })
      // the front card hides the cards behind it, even in a medium that glazes
      STYLE.flat(rrPts(-w / 2, -h / 2, w, h, 16), bgCol(), 1)
      STYLE.shape(rrPts(-w / 2, -h / 2, w, h, 16), { fill: c, ...ink })
    }
    else if (K === 'db') {
      const ry = 18, body = [[-w / 2, -h / 2 + ry]].concat(ellPts(0, h / 2 - ry, w / 2, ry, 20).filter(p => p[1] >= h / 2 - ry - .1).sort((a, b) => b[0] - a[0])).concat([[w / 2, -h / 2 + ry]])
      STYLE.shape([[-w / 2, -h / 2 + ry], [w / 2, -h / 2 + ry], [w / 2, h / 2 - ry], ...ellPts(0, h / 2 - ry, w / 2, ry, 24).filter(p => p[1] > h / 2 - ry).sort((a, b) => b[0] - a[0]), [-w / 2, h / 2 - ry]], { fill: c, ...ink })
      STYLE.shape(ellPts(0, -h / 2 + ry, w / 2, ry, 24), { fill: mixCol(c, '#FFFFFF', .3), ...ink })
      void body
    } else if (K === 'doc') STYLE.shape([[-w / 2, -h / 2], [w / 2 - 30, -h / 2], [w / 2, -h / 2 + 30], [w / 2, h / 2], [-w / 2, h / 2]], { fill: c, ...ink })
    else if (K === 'cloud') { const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; const r = 1 + .09 * Math.abs(Math.sin(a * 4)); pts.push([Math.cos(a) * (w / 2 + 16) * r, Math.sin(a) * (h / 2 + 12) * r]) } STYLE.shape(pts, { fill: c, ...ink }) }
    else if (K === 'user') {
      STYLE.shape(ellPts(0, -h / 2 + 34, 30, 30, 20), { fill: c, ...ink })
      STYLE.shape([[-48, -h / 2 + 118], [-40, -h / 2 + 76], [40, -h / 2 + 76], [48, -h / 2 + 118]], { fill: c, ...ink, curv: .4 })
    } else {
      STYLE.shape(rrPts(-w / 2, -h / 2, w, h, 16), { fill: c, ...ink })
      if (K === 'chip') for (let i = 0; i < 6; i++) { const x = -w / 2 + 24 + i * (w - 48) / 5; STYLE.line([[x, -h / 2 - 16], [x, -h / 2]], .8, STYLE.ink, { curv: 0 }); STYLE.line([[x, h / 2], [x, h / 2 + 16]], .8, STYLE.ink, { curv: 0 }) }
      if (K === 'grid') { const gx = -w / 2 + 22, gy = -24; for (let i = 0; i <= 3; i++) { STYLE.line([[gx + i * 16, gy], [gx + i * 16, gy + 48]], .5, textOn(c), { curv: 0 }); STYLE.line([[gx, gy + i * 16], [gx + 48, gy + i * 16]], .5, textOn(c), { curv: 0 }) } }
    }
    // label
    const tc = textOn(c), lb = n.lb, off = K === 'grid' ? 32 : 0
    if (K === 'user') { lb.lines.forEach((l, i) => write(l.text, 0, h / 2 - 6 - (lb.lines.length - 1 - i) * lb.px * 1.12, lb.f, STYLE.ink, { align: 'center' })) }
    else {
      const tot = lb.lines.length * lb.px * 1.15 + (n.sb ? n.sb.px * (.3 + n.sb.lines.length) : 0), y0 = -tot / 2 + lb.px * .85 + (K === 'db' ? 10 : 0)
      lb.lines.forEach((l, i) => write(l.text, off, y0 + i * lb.px * 1.15, lb.f, tc, { align: 'center' }))
      if (n.sb) n.sb.lines.forEach((l, i) => write(l.text, off, y0 + lb.lines.length * lb.px * 1.15 + n.sb.px * (.2 + i * 1.05), n.sb.f, STYLE.name === 'pixel' ? tc : (STYLE.subInk || STYLE.dim), { align: 'center' }))
    }
    pop()
  }
  const camOf = (sc, i) => {
    const s = sc.steps[i], L = sc._L
    if (!s || !s.focus || !s.focus.length || THUMB) return { cx: W / 2, cy: H / 2, z: 1 }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const id of s.focus) { const n = L.nodes[id]; if (!n) continue; x0 = Math.min(x0, n.cx - n.w / 2); x1 = Math.max(x1, n.cx + n.w / 2); y0 = Math.min(y0, n.cy - n.h / 2); y1 = Math.max(y1, n.cy + n.h / 2) }
    const z = clamp(Math.min(1300 / (x1 - x0 + 360), 700 / (y1 - y0 + 300)), 1, 1.55)
    return { cx: (x0 + x1) / 2 + 220 / z, cy: (y0 + y1) / 2 - 40 / z, z }
  }
  const DIAGRAM = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const L = layoutDiagram(sc)
      const mins = sc.steps.map(s => 1.8 + readT(s.note) * .7 + (s.flow ? 1.4 : 0))
      const bt = beatTimes(v, mins, .55, .42)
      sc._b = bt.at; sc._ev = []
      sc.steps.forEach((s, i) => {
        const t0 = bt.at[i], fresh = Object.keys(L.nodes).filter(id => L.shown[id] === i)
        fresh.forEach((id, j) => sc._ev.push({ t: t0 + j * .16, type: 'pop' }))
        if (L.edges.some(e => e.step === i)) sc._ev.push({ t: t0 + fresh.length * .16 + .15, type: 'draw' })
        if (s.flow) sc._ev.push({ t: t0 + .35, type: 'flow', span: (bt.at[i + 1] ?? bt.end) - t0 - .5 })
        if (s.highlight) sc._ev.push({ t: t0 + .1, type: 'ding' })
      })
      return snap(bt.end + .4)
    },
    draw(t, lt, sc, dur) {
      const L = layoutDiagram(sc), bi = THUMB ? sc.steps.length - 1 : beatOf(sc, lt), step = sc.steps[bi] || {}, t0 = sc._b[bi]
      const appear = id => { if (THUMB) return 1; const si = L.shown[id]; if (si > bi) return 0; const order = Object.keys(L.nodes).filter(x => L.shown[x] === si).indexOf(id); return seg(lt, sc._b[si] + Math.max(0, order) * .16, sc._b[si] + Math.max(0, order) * .16 + .35) }
      const hlSet = new Set(THUMB ? [] : (step.highlight || [])), dim = hlSet.size ? .35 + .65 * (1 - easeOut(seg(lt, t0, t0 + .3))) : 1
      // camera, eased between steps
      const c1 = camOf(sc, bi), c0 = camOf(sc, bi - 1), ck = ease(seg(lt, t0, t0 + .7))
      const cam = { cx: lerp(c0.cx, c1.cx, ck), cy: lerp(c0.cy, c1.cy, ck), z: lerp(c0.z, c1.z, ck) }
      heading(lt, sc.title)
      folio(lt)
      camBegin(cam.cx, cam.cy, cam.z)
      for (const g of L.groups) {
        const k = THUMB ? 1 : seg(lt, sc._b[g.step], sc._b[g.step] + .5); if (k <= 0) continue
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (const id of g.nodes) { const n = L.nodes[id]; if (!n) continue; x0 = Math.min(x0, n.cx - n.w / 2); x1 = Math.max(x1, n.cx + n.w / 2); y0 = Math.min(y0, n.cy - n.h / 2); y1 = Math.max(y1, n.cy + n.h / 2) }
        x0 -= 34; y0 -= 58; x1 += 34; y1 += 30
        G.save(); G.globalAlpha *= easeOut(k)
        const pts = rrPts(x0, y0, x1 - x0, y1 - y0, 26), per = []
        for (let i = 0; i < pts.length; i++) per.push(pts[i])
        STYLE.shape(pts, { fill: tone(g.tone || 'light'), op: .25, ink: null })
        const PL = per.concat([per[0]]), Ltot = lenOf(PL)
        for (let d = 0; d < Ltot; d += 30) { const q = []; for (let s = d; s <= Math.min(Ltot, d + 16); s += 4) q.push(along(PL, s)); if (q.length > 1) STYLE.line(q, .7, STYLE.dim, { curv: 0 }) }
        write(caps('label', g.label), x0 + 20, y0 + 36, F('label', 24), STYLE.dim)
        G.restore()
      }
      // edges, then packets, then nodes on top
      const flowKeys = new Set(THUMB ? [] : (step.flow || []))
      for (const e of L.edges) {
        const si = e.step; if (si > bi && !THUMB) continue
        const base = sc._b[si] + Object.keys(L.nodes).filter(x => L.shown[x] === si).length * .16 + .1
        const k = THUMB ? 1 : ease(seg(lt, base, base + .55)); if (k <= 0) continue
        const on = hlSet.has(e.from) || hlSet.has(e.to) || flowKeys.has(e.key)
        G.save(); if (!on) G.globalAlpha *= dim
        drawEdge(e, k, flowKeys.has(e.key) ? P().a : STYLE.ink, e.dashed)
        const f_ = F('mono', 24), lw = e.label ? measure(caps('mono', e.label), f_) : 0
        if (e.label && k > .9 && lw < lenOf(e._pts) - 40) {
          const pts = e._pts, m = along(pts, lenOf(pts) / 2), f = f_, w = lw
          STYLE.flat(rrPts(m[0] - w / 2 - 10, m[1] - 20, w + 20, 34, 8), bgCol(), .92)
          write(caps('mono', e.label), m[0], m[1] + 6, f, STYLE.dim, { align: 'center' })
        }
        G.restore()
      }
      if (flowKeys.size) {
        const path = []
        for (const key of step.flow) { const e = L.edges.find(x => x.key === key); if (e) path.push(...(e._pts || (e._pts = edgePath(e)))) }
        if (path.length > 1) {
          const Lp = lenOf(path), speed = 560, start = t0 + .35, end = (sc._b[bi + 1] ?? dur) - .1
          for (let s = start; s < end; s += .42) {
            const d = (lt - s) * speed; if (d < 0 || d > Lp) continue
            const [x, y] = along(path, d)
            if (STYLE.dark) glow(x, y, 40, P().a, .8)
            STYLE.shape(ellPts(x, y, 13, 13, 12), { fill: P().a, op: 1, sw: .8, ink: STYLE.dark ? P().a : STYLE.ink })
          }
        }
      }
      for (const id in L.nodes) {
        const n = L.nodes[id], on = hlSet.has(id)
        G.save(); if (!on) G.globalAlpha *= dim
        drawNode(n, appear(id), on, lt)
        G.restore()
      }
      camEnd()
      note(lt, step.note, t0 + .3)
      // the bunny points at what this beat is about
      const tgtId = (step.highlight && step.highlight[0]) || (step.focus && step.focus[0]) || (step.show && step.show[step.show.length - 1]) || Object.keys(L.nodes)[0]
      const tn = L.nodes[tgtId], tx = tn ? W / 2 + (tn.cx - cam.cx) * cam.z : 800, ty = tn ? H / 2 + (tn.cy - cam.cy) * cam.z : 500
      host(t, { point: [tx, ty], mood: step.highlight ? 'thinking' : step.flow ? 'happy' : 'neutral', look: -.7, ...hop(lt, t0, 18) })
    },
  }

  // ======================================================================
  // STACK: a model as layers, with the part that is new lit up
  const STACK = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const bt = beatTimes(v, sc.steps.map(s => 1.8 + readT(s.note) * .7 + (s.flow ? 1.4 : 0)), .5, .42)
      sc._b = bt.at; sc._ev = []
      sc.steps.forEach((s, i) => { sc._ev.push({ t: bt.at[i] + .05, type: s.flow ? 'flow' : s.highlight ? 'ding' : 'pop', span: 2 }) })
      return snap(bt.end + .4)
    },
    geo(sc) {
      // the top slab, and the output label above it, stay clear of the heading
      // however many lines it wraps to
      const n = sc.layers.length, th = 46, cx = 660, wSlab = 620, dx = 58, dy = -30
      const top = headBottom(sc.title) + (sc.output ? 236 : 120), gap = Math.min(100, (800 - top) / Math.max(1, n - 1))
      const ys = sc.layers.map((_, i) => 800 - i * gap)
      return { n, th, cx, wSlab, dx, dy, ys, gap }
    },
    draw(t, lt, sc, dur) {
      const bi = THUMB ? sc.steps.length - 1 : beatOf(sc, lt), step = sc.steps[bi] || {}, t0 = sc._b[bi], g = STACK.geo(sc)
      heading(lt, sc.title); folio(lt)
      let shownN = g.n
      for (let i = 0; i <= bi; i++) if (sc.steps[i].show != null) shownN = sc.steps[i].show
      const firstShow = sc.steps.findIndex(s => s.show != null) === bi || bi === 0
      const hl = new Set(THUMB ? [] : (step.highlight || []))
      const sideOn = THUMB ? !!sc.side : sc.side && sc.steps.slice(0, bi + 1).some(s => s.side)
      // input and output
      if (sc.input) { write(caps('mono', sc.input), g.cx, 925, F('mono', 26), STYLE.dim, { align: 'center' }); STYLE.line([[g.cx, 895], [g.cx, 850]], 1, STYLE.dim, { curv: 0 }); arrowHead([[g.cx, 895], [g.cx, 850]], STYLE.dim) }
      for (let i = 0; i < g.n; i++) {
        if (i >= shownN) continue
        const k = THUMB ? 1 : (firstShow && sc.steps[bi].show != null ? seg(lt, (sc._b[bi] || 0) + i * .12, (sc._b[bi] || 0) + i * .12 + .35) : 1)
        if (k <= 0) continue
        const y = g.ys[i] - (1 - easeOut(k)) * 60, L = sc.layers[i], on = hl.has(i) || (THUMB && L.hl), col = on ? P().a : tone(L.tone || (i % 2 ? 'light' : 'b'))
        G.save(); G.globalAlpha *= clamp(k * 2) * (hl.size && !on ? .45 : 1)
        const x0 = g.cx - g.wSlab / 2, x1 = g.cx + g.wSlab / 2
        boilSeed('slab' + i)
        STYLE.shape([[x0, y - g.th], [x1, y - g.th], [x1 + g.dx, y - g.th + g.dy], [x0 + g.dx, y - g.th + g.dy]], { fill: mixCol(col, '#FFFFFF', .35), sw: .9 })
        STYLE.shape([[x1, y - g.th], [x1 + g.dx, y - g.th + g.dy], [x1 + g.dx, y + g.dy], [x1, y]], { fill: mixCol(col, '#000000', .15), sw: .9 })
        STYLE.shape(rectPts(x0, y - g.th, g.wSlab, g.th), { fill: col, sw: on ? 1.4 : 1 })
        const lb = fitR('body', L.label, 28, 20, g.wSlab - 40, 1)
        write(lb.lines[0].text, g.cx, y - g.th / 2 + lb.px * .36, lb.f, textOn(col), { align: 'center' })
        if (on && STYLE.dark) glow(g.cx, y - g.th / 2, 260, P().a, .35)
        G.restore()
      }
      if (sc.output && shownN >= g.n) { const yt = g.ys[g.n - 1] - g.th + g.dy - 20; STYLE.line([[g.cx, yt], [g.cx, yt - 60]], 1, STYLE.dim, { curv: 0 }); arrowHead([[g.cx, yt], [g.cx, yt - 60]], STYLE.dim); write(caps('mono', sc.output), g.cx, yt - 80, F('mono', 26), STYLE.dim, { align: 'center' }) }
      if (sc.repeat && shownN >= g.n) {
        const a = g.ys[sc.repeat.from], b = g.ys[sc.repeat.to] - g.th, x = g.cx + g.wSlab / 2 + g.dx + 50
        STYLE.line([[x - 14, a], [x, a], [x, b], [x - 14, b]], 1, STYLE.ink, { curv: 0 })
        write(caps('head', sc.repeat.label), x + 24, (a + b) / 2 + 18, F('head', 52), STYLE.ink)
      }
      if (sideOn) {
        const si = sc.steps.findIndex(s => s.side), k = THUMB ? 1 : seg(lt, sc._b[si], sc._b[si] + .4), to = sc.side.to ?? 0
        const y = g.ys[to] - g.th / 2, bx = 1170, lb = fitR('body', sc.side.label, 32, 22, 280, 2), w = Math.max(...lb.lines.map(l => l.width)) + 60, h = lb.lines.length * lb.px * 1.15 + 44
        G.save(); G.globalAlpha *= clamp(k * 2)
        STYLE.shape(rrPts(bx - w / 2, y - h / 2, w, h, 16), { fill: P().hi, sw: 1.2 })
        lb.lines.forEach((l, i) => write(l.text, bx, y - h / 2 + 22 + lb.px * .85 + i * lb.px * 1.15, lb.f, textOn(P().hi), { align: 'center' }))
        const from = [bx - w / 2 - 12, y], toP = [g.cx + g.wSlab / 2 + g.dx * .5 + 18, y - 6]
        drawEdge({ _pts: partial([from, toP], 1), A: null, B: null }, easeOut(k), P().a)
        G.restore()
      }
      if (step.flow && !THUMB) {
        const path = [[g.cx, 900], ...g.ys.slice(0, shownN).map(y => [g.cx + 8 * Math.sin(y), y - g.th / 2]), [g.cx, g.ys[shownN - 1] - g.th - 90]], Lp = lenOf(path)
        for (let s = t0 + .3; s < (sc._b[bi + 1] ?? dur) - .1; s += .55) { const d = (lt - s) * 420; if (d < 0 || d > Lp) continue; const [x, y] = along(path, d); if (STYLE.dark) glow(x, y, 40, P().hi, .8); STYLE.shape(ellPts(x, y, 14, 14, 12), { fill: P().hi, op: 1, sw: .8 }) }
      }
      note(lt, step.note, t0 + .3)
      const tgt = hl.size ? g.ys[[...hl][0]] - g.th / 2 : sideOn ? g.ys[sc.side.to ?? 0] : g.ys[Math.max(0, shownN - 1)]
      host(t, { point: [hl.size ? g.cx + 200 : 1150, tgt], mood: hl.size ? 'thinking' : 'neutral', look: -.7, ...hop(lt, t0, 18) })
    },
  }

  // ======================================================================
  // STEPS: a process, station by station, with the bunny hopping along
  const STEPS = {
    beats: sc => (sc.say ? [sc.say] : []).concat(sc.items.map(it => it.say || sent(it.text))),
    plan(sc, v) {
      const intro = sc.say ? 1 : 0, mins = (intro ? [readT(sc.title) + .8] : []).concat(sc.items.map(it => 1.5 + readT(it.text) * .8))
      const bt = beatTimes(v, mins, .4, .42)
      sc._b = bt.at; sc._intro = intro
      sc._ev = sc.items.map((_, i) => ({ t: bt.at[i + intro], type: 'boing' })).concat(sc.items.map((_, i) => ({ t: bt.at[i + intro] + .35, type: 'pop' })))
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const n = sc.items.length, gap = 1000 / Math.max(1, n - 1), xs = sc.items.map((_, i) => 240 + i * gap), ys = sc.items.map((_, i) => 470 + (i % 2 ? 70 : -10)), tw = Math.min(300, gap - 24)
      const bi = THUMB ? sc._b.length - 1 : beatOf(sc, lt), cur = bi - sc._intro
      const road = []; for (let i = 0; i < n; i++) road.push([xs[i], ys[i]])
      const pk = THUMB ? 1 : ease(seg(lt, .1, .9))
      boilSeed('road'); if (n > 1) STYLE.line(partial(through([[110, ys[0] + 30], ...road, [1380, ys[n - 1] - 30]], 8), pk), 1.4, STYLE.dim, { curv: 0 })
      sc.items.forEach((it, i) => {
        const on = THUMB || i <= cur, k = THUMB ? 1 : seg(lt, sc._b[i + sc._intro] + .3, sc._b[i + sc._intro] + .7)
        const col = i === cur && !THUMB ? P().a : on ? P().b : tone('light')
        boilSeed('st' + i)
        STYLE.shape(ellPts(xs[i], ys[i], 44, 44, 24), { fill: col, op: on ? .9 : .4, sw: 1.1 })
        write(String(i + 1), xs[i], ys[i] + 16, F('head', 46), textOn(col), { align: 'center' })
        if (on && k > 0) {
          const b = fitR('body', it.text, 34, 24, tw, 3), y = ys[i] + 110
          wipeLines(THUMB ? 99 : lt, b, xs[i], y, b.px * 1.18, sc._b[i + sc._intro] + .3, .1, STYLE.ink, { align: 'center' })
          if (it.sub) { const sb = fitR('mono', it.sub, 25, 20, tw, 2); sb.lines.forEach((l, li) => write(l.text, xs[i], y + b.lines.length * b.px * 1.18 + 12 + li * sb.px * 1.15, sb.f, STYLE.dim, { align: 'center', alpha: k })) }
        }
      })
      const ci = clamp(cur, 0, n - 1), s0 = sc._b[bi]
      host(t, { point: cur < 0 ? [240, ys[0]] : [xs[ci], ys[ci]], mood: cur === n - 1 ? 'happy' : 'excited', look: -.8, ...hop(lt, s0, 22) })
    },
  }

  // ======================================================================
  // COMPARE: the usual way, then theirs
  const COMPARE = {
    beats: sc => [sc.left.say || sent(sc.left.title), sc.right.say || sent(sc.right.title)],
    plan(sc, v) {
      const r = s => 1.6 + readT([s.title, ...(s.items || [])].join(' ')) * .6
      const bt = beatTimes(v, [r(sc.left), r(sc.right)], .4, .42)
      sc._b = bt.at; sc._ev = [{ t: bt.at[0] + .1, type: 'slide' }, { t: bt.at[1] + .1, type: 'slide' }, { t: bt.at[1] + .5, type: 'ding' }]
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const card = (side, x, k, dimmed, col) => {
        if (k <= 0) return
        const y0 = sc.title ? 280 : 200, w = 590, h = 620
        push(); translate(x + (1 - easeOut(k)) * (side.key === 'l' ? -80 : 80), 0); G.globalAlpha *= clamp(k * 2) * (dimmed ? .55 : 1)
        boilSeed('card' + side.key)
        STYLE.shape(rrPts(x0(), y0, w, h, 24), { fill: col, op: .45, sw: 1.1 })
        const tb = fitR('label', side.title, 40, 28, w - 80, 2)
        tb.lines.forEach((l, i) => write(l.text, 40 + x0(), y0 + 70 + i * tb.px * 1.1, tb.f, STYLE.ink))
        let yy = y0 + 110 + tb.lines.length * tb.px * 1.1
        for (const it of side.items || []) {
          const b = fitR('body', it, 34, 24, w - 120, 3)
          STYLE.shape(ellPts(x0() + 56, yy - b.px * .3, 9, 9, 10), { fill: side.key === 'l' ? STYLE.dim : P().a, op: 1, ink: null })
          b.lines.forEach((l, i) => write(l.text, x0() + 82, yy + i * b.px * 1.15, b.f, STYLE.ink))
          yy += b.lines.length * b.px * 1.15 + 26
        }
        pop()
        function x0() { return 0 }
      }
      const kl = THUMB ? 1 : seg(lt, sc._b[0], sc._b[0] + .45), kr = THUMB ? 1 : seg(lt, sc._b[1], sc._b[1] + .45)
      push(); translate(110, 0); card({ ...sc.left, key: 'l' }, 0, kl, kr > .5 && !THUMB, tone('light')); pop()
      push(); translate(780, 0); card({ ...sc.right, key: 'r' }, 0, kr, false, P().a); pop()
      if (kr > 0) { const k = backOut(seg(lt, sc._b[1] + .3, sc._b[1] + .6)); push(); translate(745, 590); scale(k); write('→', 0, 22, F('head', 72), P().a, { align: 'center' }); pop() }
      host(t, { point: kr > 0 ? [1200, 560] : [600, 560], mood: kr > .5 ? 'happy' : 'thinking', look: -.8 })
    },
  }

  // ======================================================================
  // GRID: a matrix whose cells show a pattern (attention masks, cache pages,
  // sparse experts, quantization blocks)
  function patternCells(p, R, C, seed) {
    const [name, arg] = String(p || 'dense').split(':'), a = arg !== undefined ? arg.split(',').map(Number) : [], cells = []
    const r = seededRng(hashStr(seed + p))
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      let v = 0
      switch (name) {
        case 'dense': v = 1; break
        case 'none': v = 0; break
        case 'causal': v = j <= i ? 1 : 0; break
        case 'sliding': v = j <= i && i - j < (a[0] || 3) ? 1 : 0; break
        case 'block': { const b = a[0] || 2; v = Math.floor(i / b) === Math.floor(j / b) ? 1 : 0; break }
        case 'diagonal': v = i === j ? 2 : 0; break
        case 'sparse': v = r() < (a[0] || .25) ? 1 : 0; break
        case 'topk': v = 0; break
        case 'rows': v = a.includes(i) ? 2 : 1; break
        case 'cols': v = a.includes(j) ? 2 : 1; break
        case 'pages': { const pg = a[0] || 4; v = 1 + Math.floor(j / pg) % 3; break }
        case 'quant': { const x = r(); v = x < .06 ? 3 : x < .5 ? 1 : 2; break }
        default: v = 1
      }
      cells.push(v)
    }
    if (name === 'topk') for (let i = 0; i < R; i++) { const k = a[0] || 2, pick = new Set(); while (pick.size < Math.min(k, C)) pick.add(Math.floor(r() * C)); for (const j of pick) cells[i * C + j] = 2 }
    return cells
  }
  const GRID = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const bt = beatTimes(v, sc.steps.map(s => 1.8 + readT(s.note) * .7), .5, .42)
      sc._b = bt.at; sc._ev = sc.steps.map((s, i) => ({ t: bt.at[i] + .1, type: 'ticks', n: Math.min(24, sc.rows * sc.cols / 4), span: .6 }))
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const R = sc.rows, C = sc.cols, cell = Math.min(760 / C, 560 / R, 84), gw = cell * C, gh = cell * R, x0 = 170 + (760 - gw) / 2, y0 = 320 + (560 - gh) / 2
      const bi = THUMB ? sc.steps.length - 1 : beatOf(sc, lt), cur = patternCells(sc.steps[bi].pattern, R, C, SB.slug), prev = bi > 0 ? patternCells(sc.steps[bi - 1].pattern, R, C, SB.slug) : cur.map(() => 0)
      const cols = [null, P().b, P().a, P().hi]
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        const d = (i + j) / (R + C) * .6, k = THUMB ? 1 : seg(lt, sc._b[bi] + .2 + d, sc._b[bi] + .4 + d), v = k >= .5 ? cur[i * C + j] : prev[i * C + j]
        const x = x0 + j * cell, y = y0 + i * cell, pad = Math.max(2, cell * .08)
        if (v) STYLE.flat(rectPts(x + pad, y + pad, cell - pad * 2, cell - pad * 2), cols[v], STYLE.dark ? .85 : .8)
        else STYLE.flat(rectPts(x + pad, y + pad, cell - pad * 2, cell - pad * 2), STYLE.dim, .12)
      }
      boilSeed('gridframe'); STYLE.line(rectPts(x0, y0, gw, gh), 1, STYLE.ink, { closed: true, curv: 0 })
      if (sc.colLabel) write(caps('mono', sc.colLabel), x0 + gw / 2, y0 - 22, F('mono', 26), STYLE.dim, { align: 'center' })
      if (sc.rowLabel) { push(); translate(x0 - 30, y0 + gh / 2); rotate(-Math.PI / 2); write(caps('mono', sc.rowLabel), 0, 0, F('mono', 26), STYLE.dim, { align: 'center' }); pop() }
      if (sc.steps[bi].label && !THUMB) { const b = fitR('body', sc.steps[bi].label, 40, 28, 390, 5); wipeLines(lt, b, 990, 420, b.px * 1.2, sc._b[bi] + .3, .1, STYLE.ink) }
      note(lt, sc.steps[bi].note, sc._b[bi] + .4)
      host(t, { point: [x0 + gw * .9, y0 + gh * .5], mood: bi ? 'thinking' : 'neutral', look: -.7, ...hop(lt, sc._b[bi], 18) })
    },
  }

  // ======================================================================
  // EQUATION: a formula, one term at a time
  const EQUATION = {
    beats: sc => [sc.say || 'Here is the formula.'].concat(sc.parts.map(p => p.say || sent(p.note))),
    plan(sc, v) {
      const bt = beatTimes(v, [2].concat(sc.parts.map(p => 1.6 + readT(p.note) * .7)), .4, .42)
      sc._b = bt.at; sc._ev = [{ t: .3, type: 'write' }].concat(sc.parts.map((_, i) => ({ t: bt.at[i + 1] + .1, type: 'scratch' })))
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const f0 = fitR('mono', sc.text, 96, 40, 1240, 1), f = f0.f, tw = measure(sc.text, f), x0 = 740 - tw / 2, y = 470
      G.save(); G.beginPath(); G.rect(0, 0, x0 + tw * (THUMB ? 1 : easeOut(seg(lt, .2, 1))) + 20, H); G.clip()
      write(sc.text, x0, y, f, STYLE.ink); G.restore()
      const bi = THUMB ? -1 : beatOf(sc, lt) - 1
      sc.parts.forEach((p, i) => {
        if (i > bi) return
        const idx = sc.text.indexOf(p.match); if (idx < 0) return
        const px = x0 + measure(sc.text.slice(0, idx), f), pw = measure(p.match, f), k = seg(lt, sc._b[i + 1], sc._b[i + 1] + .4), cur = i === bi
        G.save(); G.globalAlpha *= cur ? 1 : .35
        STYLE.hl(px, y - f0.px * .8, pw, f0.px, P().hi, easeOut(k))
        write(p.match, px, y, f, STYLE.ink)
        if (cur) {
          STYLE.line([[px + pw / 2, y + 30], [px + pw / 2, y + 90]], 1, P().a, { curv: 0 })
          const b = fitR('body', p.note, 40, 28, 820, 3), nx = clamp(px + pw / 2, 530, 960)
          wipeLines(lt, b, nx, y + 150, b.px * 1.2, sc._b[i + 1] + .2, .1, STYLE.ink, { align: 'center' })
        }
        G.restore()
      })
      host(t, { point: [x0 + tw, y], mood: 'thinking', look: -.7 })
    },
  }

  // ======================================================================
  // numbers: STAT, BARS, TALLY
  const STAT = {
    beats: sc => [sc.say || (/^[a-z]/.test(sc.label) ? sent(`${sc.value} ${sc.label}`) : sent(`${sc.label.replace(/[:.]\s*$/, '')}: ${sc.value}`))],
    plan(sc, v) {
      const bt = beatTimes(v, [2.6 + readT(sc.label) + readT(sc.note) * .6], .3, .42)
      sc._b = bt.at; sc._t = { land: .85 }; sc._ev = [{ t: .2, type: 'count' }, { t: .85, type: 'boing' }].concat(sc.stamp ? [{ t: 1.2, type: 'thunk' }] : [])
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      folio(lt)
      const caseMatters = /[a-z]/.test(sc.value)
      const vb = fitR(caseMatters ? 'body' : 'head', sc.value, 290, 100, 1100, 1), vw = vb.lines[0].width, vy = 200 + vb.px * .82
      STYLE.shape(ellPts(M + vw / 2, vy - vb.px * .32, vw / 2 + 110, vb.px * .55, 30), { fill: P().a, op: .5 * easeOut(seg(lt, 0, .4)), ink: null })
      // the figure is written on left to right, never counted up: an odometer's
      // in-between frames are numbers nobody published
      const k = THUMB ? 1 : easeOut(seg(lt, .15, sc._t.land))
      push(); translate(M, vy); scale(1 + .06 * spring(lt, sc._t.land, 8, 26))
      G.save(); G.beginPath(); G.rect(-30, -vb.px * 1.3, (vw + 60) * k, vb.px * 1.8); G.clip()
      write(caps(caseMatters ? 'body' : 'head', sc.value), 0, 0, vb.f, STYLE.ink, { alpha: easeOut(seg(lt, .1, .3)) })
      G.restore(); pop()
      const lb = fitR('body', sc.label, 56, 36, 1120, 2)
      wipeLines(THUMB ? 99 : lt, lb, M, vy + 70 + lb.px, lb.px * 1.18, .5, .14, STYLE.ink)
      stamp(lt, 1.2, sc.stamp, Math.min(M + vw * 1.06 + 170, 1320), vy - vb.px * .55)
      note(lt, sc.note, 1.5)
      host(t, { mood: lt < sc._t.land + 1 ? 'surprised' : 'happy', look: -.7, ...hop(lt, sc._t.land, 45) })
    },
  }
  const BARS = {
    beats: sc => [sc.say || sent(sc.title)],
    plan(sc, v) {
      const n = sc.items.length, bt = beatTimes(v, [1.4 + n * .5 + readT(sc.title) + readT(sc.note) * .6], .3, .42)
      sc._b = bt.at; sc._ev = sc.items.map((_, i) => ({ t: .5 + i * .35, type: 'grow' })).concat(sc.stamp ? [{ t: .6 + n * .35, type: 'thunk' }] : [])
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const n = sc.items.length, vals = sc.items.map(it => parseFloat(String(it.value).replace(/,/g, ''))), mx = Math.max(...vals.map(Math.abs)) || 1
      const x0 = 520, wMax = 600, rowH = Math.min(130, 560 / n), y0 = 300
      sc.items.forEach((it, i) => {
        const y = y0 + i * rowH, k = THUMB ? 1 : easeOut(seg(lt, .5 + i * .35, 1.1 + i * .35)), w = Math.max(8, wMax * Math.abs(vals[i]) / mx * k)
        const lb = fitR('body', it.label, 32, 22, 370, 2)
        lb.lines.forEach((l, li) => write(l.text, x0 - 30, y + rowH * .5 - (lb.lines.length - 1) * lb.px * .55 + li * lb.px * 1.1 + lb.px * .35, lb.f, STYLE.ink, { align: 'right' }))
        const col = it.hl ? P().a : P().b
        boilSeed('bar' + i); STYLE.shape(rectPts(x0, y + rowH * .18, w, rowH * .64), { fill: col, op: .85, sw: 1 })
        write(String(it.value) + (sc.unit || ''), x0 + w + 20, y + rowH * .5 + 18, F('head', 48), STYLE.ink, { alpha: k })
      })
      stamp(lt, .6 + n * .35, sc.stamp, 1260, 250)
      note(lt, sc.note, 1 + n * .35)
      host(t, { mood: 'excited', point: [x0 + wMax, y0 + rowH * .5], look: -.7, ...hop(lt, .6 + (n - 1) * .35, 22) })
    },
  }
  const TALLY = {
    beats: sc => [sc.say || sent(`${sc.rows.map(r => `${r.n} of ${sc.of} ${r.label}`).join('; ')}`)],
    plan(sc, v) {
      const bt = beatTimes(v, [1.2 + sc.rows.length * 1.1 + readT(sc.label) + readT(sc.note) * .6], .3, .42)
      sc._b = bt.at; sc._ev = sc.rows.map((r, i) => ({ t: .5 + i * .9, type: 'ticks', n: r.n, span: .6 }))
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      heading(lt, sc.label); folio(lt)
      const perRow = Math.min(sc.of, sc.of > 60 ? 40 : 20), lines = Math.ceil(sc.of / perRow), rowsH = 560 / sc.rows.length
      const cs = Math.min(760 / perRow, (rowsH - 60) / lines)
      sc.rows.forEach((r, i) => {
        const y0 = 300 + i * rowsH, k = THUMB ? 1 : seg(lt, .5 + i * .9, 1.1 + i * .9), filled = Math.round(r.n * easeOut(k)), col = [P().a, P().b, P().hi][i % 3]
        for (let c = 0; c < sc.of; c++) { const x = M + (c % perRow) * cs, y = y0 + Math.floor(c / perRow) * cs; STYLE.flat(rectPts(x + 2, y + 2, cs - 4, cs - 4), c < filled ? col : STYLE.dim, c < filled ? .9 : .15) }
        write(`${filled} of ${sc.of}`, M + perRow * cs + 40, y0 + 44, F('head', 52), STYLE.ink, { alpha: clamp(k * 3) })
        const lb = fitR('body', r.label, 30, 22, 440, 2); lb.lines.forEach((l, li) => write(l.text, M + perRow * cs + 40, y0 + 90 + li * lb.px * 1.1, lb.f, STYLE.dim, { alpha: clamp(k * 3) }))
      })
      note(lt, sc.note, 1 + sc.rows.length * .9)
      host(t, { mood: 'excited', look: -.7, ...(lt > .5 && lt < .5 + sc.rows.length * .9 ? move('bounce', lt) : {}) })
    },
  }
  const move = (k, lt) => ({ dy: -Math.abs(Math.sin(lt * 9)) * 18 })

  // ======================================================================
  // QUOTE, TAKEAWAY, END
  const QUOTE = {
    beats: sc => [sc.say || `${sc.source ? sc.source + ' says' : 'The claim'}: ${sent(sc.quote)}`],
    plan(sc, v) {
      const bt = beatTimes(v, [readT(sc.quote) + 1.4], .35, .42)
      sc._b = bt.at; sc._t = { markAt: bt.at[0] + (v[0] || 2) * .6 }
      sc._ev = [{ t: .05, type: 'slide' }, { t: sc._t.markAt, type: 'scratch' }].concat(sc.stamp ? [{ t: sc._t.markAt + .6, type: 'thunk' }] : [])
      return snap(bt.end + .3)
    },
    draw(t, lt, sc) {
      folio(lt)
      const b = fitR('body', sc.quote, 58, 34, 1130, 6), lh = b.px * 1.22, w = 1230, h = b.lines.length * lh + 190, y0 = Math.max(170, 540 - h / 2), k = THUMB ? 1 : easeOut(seg(lt, 0, .4))
      push(); translate(0, (1 - k) * 60); G.globalAlpha *= k
      boilSeed('quote'); STYLE.shape(rrPts(M, y0, w, h, 22), { fill: tone('light'), op: .55, sw: 1.1 })
      write(caps('label', sc.label || 'The claim'), M + 50, y0 + 64, F('label', 28), STYLE.dim, { ls: 2 })
      if (sc.source) write(caps('mono', sc.source), M + w - 50, y0 + 64, F('mono', 24), STYLE.dim, { align: 'right' })
      const y = y0 + 130 + b.px * .6
      for (const bx of phraseBoxes(b, sc.mark, M + 50, y, lh)) STYLE.hl(bx.x, bx.y, bx.w, bx.h, P().hi, THUMB ? 1 : easeOut(seg(lt, sc._t.markAt, sc._t.markAt + .4)))
      b.lines.forEach((l, i) => write(l.text, M + 50, y + i * lh, b.f, STYLE.ink))
      pop()
      stamp(lt, sc._t.markAt + .6, sc.stamp, M + w - 150, y0 + h - 10)
      host(t, { mood: 'thinking', point: [M + w - 60, y0 + 160], look: -.7 })
    },
  }
  const TAKEAWAY = {
    beats: sc => [sc.say || sent(sc.text)],
    plan(sc, v) {
      const bt = beatTimes(v, [readT(sc.text) + 1.6], .35, .42)
      sc._b = bt.at; sc._t = { markAt: bt.at[0] + (v[0] || 2) * .55 }
      sc._ev = [{ t: sc._t.markAt, type: 'ding' }]
      return snap(bt.end + .4)
    },
    draw(t, lt, sc) {
      folio(lt)
      if (!THUMB) write(caps('label', sc.label || 'The takeaway'), M, 240, F('label', 36), STYLE.dark ? P().a : STYLE.ink, { ls: 2, alpha: easeOut(seg(lt, 0, .3)) })
      const b = fitR('body', sc.text, 84, 48, 1180, 5, -.012), lh = b.px * 1.14, y = 360 + b.px * .8
      for (const bx of phraseBoxes(b, sc.mark, M, y, lh)) STYLE.hl(bx.x, bx.y, bx.w, bx.h, P().hi, THUMB ? 1 : easeOut(seg(lt, sc._t.markAt, sc._t.markAt + .45)))
      wipeLines(THUMB ? 99 : lt, b, M, y, lh, .2, .14, STYLE.ink)
      const tk = hop(lt, sc._t.markAt, 45)
      host(t, { mood: lt < sc._t.markAt ? 'thinking' : 'proud', look: -.5, ...tk })
    },
  }
  const END = {
    beats: sc => [sc.say || `To recap: ${(sc.recap || []).map(r => String(r).replace(/[.]+$/, '')).join('; ')}.`, `Every source is in the full article. I'm ${MASCOT.name}. Bye!`],
    plan(sc, v) {
      const n = (sc.recap || []).length, bt = beatTimes(v, [1 + n * 1.2, 2.4], .4, .42)
      sc._b = bt.at; sc._ev = (sc.recap || []).map((_, i) => ({ t: .5 + i * .6, type: 'pop' })).concat([{ t: bt.at[1], type: 'boing' }])
      return snap(bt.end + .6)
    },
    draw(t, lt, sc) {
      folio(lt)
      write(caps('head', 'Recap'), M, 250, F('head', 96), STYLE.ink, { alpha: easeOut(seg(lt, 0, .3)) })
      let y = 360
      ;(sc.recap || []).forEach((r, i) => {
        const k = THUMB ? 1 : seg(lt, .5 + i * .6, .9 + i * .6); if (k <= 0) return
        const b = fitR('body', r, 46, 30, 1040, 2)
        push(); translate(M + 30, y); scale(lerp(.6, 1, backOut(k)))
        boilSeed('tick' + i); STYLE.line([[-18, -10], [-4, 6], [22, -26]], 1.6, P().a, { curv: 0 })
        pop()
        b.lines.forEach((l, li) => write(l.text, M + 80, y + li * b.px * 1.15, b.f, STYLE.ink, { alpha: clamp(k * 2) }))
        y += b.lines.length * b.px * 1.15 + 40
      })
      const k2 = THUMB ? 1 : easeOut(seg(lt, sc._b[1] - .2, sc._b[1] + .3))
      write('The full article, with every source:', M, 840, F('body', 38), STYLE.dim, { alpha: k2 })
      write('ai.thesatyajit.com', M, 915, F('head', 62), P().a === '#FFE45C' ? STYLE.ink : (STYLE.dark ? P().a : STYLE.ink), { alpha: k2 })
      const j = hop(lt, sc._b[1], 60)
      host(t, { x: 1610, u: 94, mood: 'happy', wave: lt > sc._b[1], look: -.3, ...j })
      if (k2 > 0) write(`— ${MASCOT.name}`, M, 1010, F('body', 34), STYLE.dim, { alpha: k2 })
    },
  }

  const SCENES = { title: TITLE, idea: IDEA, diagram: DIAGRAM, stack: STACK, steps: STEPS, compare: COMPARE, grid: GRID, equation: EQUATION, stat: STAT, bars: BARS, tally: TALLY, quote: QUOTE, takeaway: TAKEAWAY, end: END }
  const MECH = ['diagram', 'stack', 'steps', 'grid', 'equation', 'compare']

  // ---------- the film ----------
  const TW = .7   // transition window, centred on the cut
  function setup(sb) {
    if (SB && SB.slug !== sb.slug && typeof PB !== 'undefined') PB.clear()
    SB = sb; STYLE = STYLES[sb.style] || STYLES.watercolour
    const keys = Object.keys(STYLE.pals)
    STYLE.P = STYLE.pals[sb.palette] || STYLE.pals[keys[hashStr(sb.slug) % keys.length]]
    window.MASCOT = mascotFor(sb.slug, sb.mascot)
  }
  function lines(sb) { setup(sb); return sb.scenes.flatMap(sc => SCENES[sc.type].beats(sc)) }
  function load(sb, voice) {
    setup(sb)
    voice = voice || sb._voice || []
    let t = 0, k = 0
    const scenes = sb.scenes.map((sc, i) => {
      const s = { ...sc, _i: i }, nb = SCENES[s.type].beats(s).length, v = voice.slice(k, k + nb)
      const dur = SCENES[s.type].plan(s, v)
      const out = { sc: s, start: t, dur, trans: i === 0 ? 'none' : STYLE.trans, v, k0: k }
      t += dur; k += nb; return out
    })
    const beats = [], events = []
    for (const s of scenes) {
      s.sc._b.forEach((b, j) => beats.push({ t: +(s.start + b).toFixed(3), i: s.k0 + j, d: s.v[j] || 0 }))
      if (s.trans !== 'none') events.push({ t: +(s.start - .3).toFixed(3), type: 'whoosh' })
      for (const e of s.sc._ev || []) events.push({ ...e, t: +(s.start + e.t).toFixed(3) })
    }
    TL = { scenes, duration: t, beats }
    DUR = t
    return {
      duration: +t.toFixed(3), posterT: scenes[0].start + (scenes[0].sc._t?.poster || 2), style: STYLE.name, music: STYLE.music, bpm: STYLE.bpm, mascot: MASCOT,
      lowres: STYLE.lowres || null,
      scenes: scenes.map(s => ({ type: s.sc.type, start: +s.start.toFixed(3), dur: +s.dur.toFixed(3), trans: s.trans })),
      beats, events: events.sort((a, b) => a.t - b.t), lines: sb.scenes.flatMap(sc => SCENES[sc.type].beats(sc)),
    }
  }
  function progress(t) {
    if (THUMB) return
    const S = TL.scenes.slice(1); if (!S.length || t < S[0].start) return
    const x0 = M, w = W - 2 * M, gap = 12, sw = (w - gap * (S.length - 1)) / S.length
    S.forEach((s, j) => {
      const k = clamp((t - s.start) / s.dur), x = x0 + j * (sw + gap)
      STYLE.flat(rectPts(x, H - 24, sw, 6), STYLE.dim, .25)
      if (k > 0) STYLE.flat(rectPts(x, H - 24, sw * k, 6), STYLE.dark ? P().a : STYLE.ink, .9)
    })
  }
  function drawScene(s, tt) { SCENES[s.sc.type].draw(tt, clamp(tt - s.start, 0, s.dur - 1e-4), s.sc, s.dur); flushLetters() }
  function frame(t) {
    t = Math.max(0, Math.min(t, TL.duration - 1e-4))
    paintFrame(t, tt => {
      let i = TL.scenes.length - 1; while (i > 0 && tt < TL.scenes[i].start) i--
      const s = TL.scenes[i], next = TL.scenes[i + 1], lt = tt - s.start
      const inSlide = STYLE.trans === 'slide'
      if (inSlide && next && lt > s.dur - TW / 2) { const e = ease((lt - (s.dur - TW / 2)) / TW); push(); translate(-W * e, 0); drawScene(s, tt); pop(); push(); translate(W * (1 - e), 0); drawScene(next, next.start); pop() }
      else if (inSlide && s.trans === 'slide' && lt < TW / 2) { const prev = TL.scenes[i - 1], e = ease(.5 + lt / TW); push(); translate(-W * e, 0); drawScene(prev, s.start - 1e-3); pop(); push(); translate(W * (1 - e), 0); drawScene(s, tt); pop() }
      else drawScene(s, tt)
      const tr = TRANS[STYLE.trans]
      if (!inSlide) {
        if (next && lt > s.dur - TW / 2) tr((lt - (s.dur - TW / 2)) / TW)
        if (s.trans !== 'none' && lt < TW / 2) tr(.5 + lt / TW)
      }
      progress(tt)
    }, STYLE)
  }
  // a still for the article's thumbnail: the first mechanism scene, fully built
  function thumb(sb) {
    load(sb, [])
    const pick = sb.thumb?.scene ?? TL.scenes.findIndex(s => MECH.includes(s.sc.type))
    const s = TL.scenes[pick >= 0 ? pick : 0]
    THUMB = true
    try { paintFrame(s.start + s.dur - .05, tt => drawScene(s, tt), STYLE) } finally { THUMB = false }
    return { scene: s.sc.type, style: STYLE.name, mascot: MASCOT.name }
  }
  window.FILM = { load, frame, lines, thumb, get duration() { return TL ? TL.duration : 0 }, STYLES: Object.keys(STYLES), MASCOT_OPTS, SCENE_TYPES: Object.keys(SCENES) }
})()
