// painted.js — Receipts, painted. The same storyboards as the riso cut, drawn
// with paint.js (watercolour, boiling ink, paper) and performed by Clawd, the
// character from brand-crew/skills/claude-animation-base, loaded unchanged.
//
// Every scene type has three parts:
//   plan(sc, voice)  its length: the longer of what the viewer must read and
//                    what the narrator must say (voice = seconds of speech)
//   say(sc)          the narration line, generated from the storyboard's own
//                    words (a scene's `say` field overrides it)
//   draw(t, lt, sc)  the painting at scene time lt; pure in t
// and plan() also lists sound cues (sc._ev) at scene times, so the score lands
// on the picture: a stamp thunks when it hits, cells tick as they fill.
(() => {
  const M = 110                                   // outer margin, world px
  const WPS = 4.0
  const words = s => String(s || '').split(/\s+/).filter(Boolean).length
  const readT = s => (s ? .35 + words(s) / WPS : 0)
  const snap = x => Math.ceil(x / (BEAT / 2) - 1e-6) * (BEAT / 2)
  const HAND = '"Permanent Marker", cursive', SANS = 'Hanken', MONOF = 'Plex'

  // palettes: the riso names, re-mixed as watercolour
  const PALS = {
    'pink-blue':    { a: '#E27A92', b: '#3B4E9A', light: '#F7D9DF', wash: '#DCE6F4', hi: '#F2C94C', mood: 'rose' },
    'orange-fblue': { a: '#D97757', b: '#3B4E9A', light: '#F9DECF', wash: '#DDE3F0', hi: '#F2C94C', mood: 'clay' },
    'red-marine':   { a: '#C8553D', b: '#23737A', light: '#F4D5CC', wash: '#D4EAE8', hi: '#F2C94C', mood: 'clay' },
    'green-pink':   { a: '#6E9F58', b: '#D96A86', light: '#DFEDD3', wash: '#F6DFE5', hi: '#F2C94C', mood: 'sap' },
    'purple-sun':   { a: '#7B5CA8', b: '#E8AA38', light: '#E6DCF2', wash: '#F8EACB', hi: '#8FD3C9', mood: 'violet' },
    'teal-flame':   { a: '#3A9C98', b: '#D97757', light: '#D2ECE9', wash: '#F9DECF', hi: '#F2C94C', mood: 'teal' },
    'blue-orange':  { a: '#4674BB', b: '#E8AA38', light: '#D8E4F5', wash: '#F8EACB', hi: '#F2C94C', mood: 'sky' },
    'flame-grape':  { a: '#D9625B', b: '#6B5B8C', light: '#F6D6D2', wash: '#E4DEEE', hi: '#F2C94C', mood: 'rose' },
  }
  let P = PALS['pink-blue'], SB = null

  // ---------- text on the painting ----------
  function fontOf(w, px, fam) { return fam === HAND ? `${px}px ${HAND}` : `${w} ${px}px ${fam}` }
  function measure(txt, f, ls = 0) { G.save(); G.font = f; G.letterSpacing = ls + 'px'; const w = G.measureText(txt).width; G.restore(); return w }
  function wrap(text, f, maxW, ls = 0) {
    const ws = String(text).split(/\s+/).filter(Boolean), sp = measure(' ', f, ls), lines = []
    let cur = [], cw = 0
    for (const w of ws) {
      const ww = measure(w, f, ls)
      if (cur.length && cw + sp + ww > maxW) { lines.push(cur); cur = []; cw = 0 }
      cur.push({ text: w, w: ww }); cw += (cur.length > 1 ? sp : 0) + ww
    }
    if (cur.length) lines.push(cur)
    return lines.map(l => { let x = 0; for (const w of l) { w.x = x; x += w.w + sp } return { text: l.map(w => w.text).join(' '), width: x - sp, words: l } })
  }
  function fit(text, w, fam, maxPx, minPx, maxW, maxLines, lsK = 0) {
    for (let px = maxPx; px >= minPx; px -= 3) {
      const f = fontOf(w, px, fam), ls = lsK * px, lines = wrap(text, f, maxW, ls)
      if (lines.length <= maxLines && lines.every(l => l.width <= maxW)) return { px, f, ls, lines }
    }
    const f = fontOf(w, minPx, fam); return { px: minPx, f, ls: lsK * minPx, lines: wrap(text, f, maxW, lsK * minPx) }
  }
  function text(str, x, y, f, col, o = {}) {
    G.save(); G.font = f; G.letterSpacing = (o.ls || 0) + 'px'; G.textAlign = o.align || 'left'; G.textBaseline = o.base || 'alphabetic'
    if (o.alpha != null) G.globalAlpha = clamp(o.alpha)
    if (o.shadow) { G.fillStyle = o.shadow; G.fillText(str, x + (o.sx ?? 5), y + (o.sy ?? 6)) }
    G.fillStyle = col; G.fillText(str, x, y); G.restore()
  }
  // lines revealed left to right, like a brush pass
  function wipeLines(lt, b, x, y, lh, t0, gap, col, o = {}) {
    b.lines.forEach((line, i) => {
      const k = easeOut(seg(lt, t0 + i * gap, t0 + i * gap + .3)); if (k <= 0) return
      const lx = o.align === 'center' ? x - line.width / 2 : x
      G.save(); G.beginPath(); G.rect(lx - 30, y + i * lh - b.px * 1.1, (line.width + 60) * k, b.px * 1.6); G.clip()
      text(line.text, lx, y + i * lh, b.f, col, { ls: b.ls, shadow: o.shadow, sx: o.sx, sy: o.sy }); G.restore()
    })
  }
  function phraseBoxes(b, phrase, x, y, lh) {
    if (!phrase) return []
    const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, '')
    const target = String(phrase).split(/\s+/).map(norm).filter(Boolean), flat = []
    b.lines.forEach((l, li) => l.words.forEach(w => flat.push({ ...w, li })))
    for (let i = 0; i + target.length <= flat.length; i++) {
      let ok = true
      for (let j = 0; j < target.length; j++) if (norm(flat[i + j].text) !== target[j]) { ok = false; break }
      if (!ok) continue
      const bx = {}
      for (let j = 0; j < target.length; j++) { const w = flat[i + j], q = bx[w.li] || (bx[w.li] = { x0: 1e9, x1: -1e9, li: w.li }); q.x0 = Math.min(q.x0, w.x); q.x1 = Math.max(q.x1, w.x + w.w) }
      return Object.values(bx).map(q => ({ x: x + q.x0, y: y + q.li * lh - b.px * .8, w: q.x1 - q.x0, h: b.px }))
    }
    return []
  }

  // ---------- narration grammar ----------
  // one sentence: capitalised, ending in exactly one stop
  const sent = s => { s = String(s || '').trim().replace(/[\s.]+$/, ''); if (!s) return ''; s = s[0].toUpperCase() + s.slice(1); return /[!?]$/.test(s) ? s : s + '.' }
  const codeLike = v => /[\[\]{}()<>=]/.test(v)
  // a number and what it counts: "166,691 neurons in…" when the label carries on
  // from the number, "The label: 14." when it is its own clause, and the label
  // alone when the value is code nobody should hear read aloud
  const spokenStat = (value, label) => codeLike(value) ? sent(label) : /^[a-z]/.test(label) ? sent(`${value} ${label}`) : sent(`${label.replace(/[:.]\s*$/, '')}: ${value}`)

  // ---------- painted pieces ----------
  const STAMPS = { measured: 'MEASURED', reported: 'REPORTED', reasoned: 'REASONED', holds: 'HOLDS', 'does not hold': 'DOES NOT HOLD', 'half true': 'HALF TRUE' }
  const stampLabel = s => STAMPS[s] || String(s || '').toUpperCase()
  // Clawd's reaction to a verdict stamp
  const MOODS = { holds: 'happy', 'does not hold': 'suspicious', 'half true': 'confused', measured: 'proud', reported: 'thinking', reasoned: 'idea' }
  const stampW = (label, px) => measure(label, fontOf(0, px, HAND)) + px * 1.1
  // a stamp is read at a glance, so a light palette colour (sun yellow, pink)
  // is darkened toward the ink until it holds up on cream paper
  const luma = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 }
  function stamp(lt, t0, label, x, y, px, rot, col) {
    if (lt < t0) return
    if (luma(col) > .6) col = mixCol(col, PAL.ink, .45)
    const k = seg(lt, t0, t0 + .15), s = lerp(1.8, 1, easeIn(k)) * (1 + .05 * spring(lt, t0 + .15, 10, 30))
    const f = fontOf(0, px, HAND), w = stampW(label, px), h = px * 1.55
    push(); translate(x, y); rotate(rot); scale(s, s)
    G.globalAlpha = clamp(k * 3)
    boilSeed('stamp' + label)
    paint(rrPts(-w / 2, -h / 2, w, h, px * .25, 3), { ink: col, sw: 1.6, br: 'ink', fill: col, fillOp: 26, bleed: .02, tex: .2 })
    inkLine(rrPts(-w / 2 + 12, -h / 2 + 10, w - 24, h - 20, px * .18, 2), .7, col, 'dry', 0)
    text(label, 0, px * .36, f, col, { align: 'center' })
    pop()
  }
  function folio(lt) {
    const a = easeOut(seg(lt, .05, .35))
    text(SB.kicker.toUpperCase(), M, 78, fontOf(600, 26, MONOF), PAL.ink, { ls: 3, alpha: a })
    text('ai.thesatyajit.com', W - M, 78, fontOf(500, 26, MONOF), PAL.ink, { align: 'right', alpha: a })
    boilSeed('folio'); inkLine([[M, 98], [M + 60 * a, 97]], 1.2, P.a, 'ink', 0)
  }
  // the floor Clawd stands on, and a soft wash of sky above it
  function set(lt, key, o = {}) {
    boilSeed('set' + key)
    paint(rectPts(-60, -60, W + 120, (o.horizon || 880) + 60, 0), { fill: o.sky || P.wash, fillOp: o.skyOp ?? 150, bleed: .12, tex: .6, ink: null })
    paint([[-60, o.horizon || 880], [W * .3, (o.horizon || 880) - 18], [W * .7, (o.horizon || 880) + 12], [W + 60, (o.horizon || 880) - 8], [W + 60, H + 60], [-60, H + 60]], { fill: o.floor || P.light, fillOp: 210, bleed: .06, tex: .4, ink: PAL.ink, sw: .9, curv: .5 })
  }
  function magnifier(u, sw) {
    inkLine([[0, 0], [u * 1.4, -u * .5]], sw * 1.6, PAL.clayDk, 'ink', 0)
    paint(ellPts(u * 2.5, -u * .95, u * 1.15, u * 1.15, 26), { fill: '#DDEFF6', fillOp: 110, bleed: .02, tex: .1, ink: PAL.ink, sw })
  }

  // ======================================================================
  const PUNCH = .36
  const TITLE = {
    say: sc => `${sent(sc.headline)} ${sent(sc.sub)}`.trim(),
    plan(sc, voice) {
      const n = words(sc.headline), pe = (sc.punch || []).length * PUNCH
      sc._t = { pe, hStart: pe + .1, gap: .08, clawd: pe + .45 }
      const hDone = sc._t.hStart + (n - 1) * sc._t.gap + .25
      sc._t.subAt = hDone + .2
      sc._ev = (sc.punch || []).map((_, i) => ({ t: i * PUNCH, type: 'pop' })).concat([{ t: sc._t.clawd + .15, type: 'boing' }])
      const visual = sc._t.subAt + .2 + readT(sc.sub) * .85 + .6
      const dur = snap(Math.max(3, visual, pe + .3 + voice + .5))
      sc._t.poster = Math.min(dur - .1, sc._t.subAt + 1.2)
      sc._t.voiceAt = pe + .25
      return dur
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      if (lt < T_.pe) {
        const i = Math.min(sc.punch.length - 1, Math.floor(lt / PUNCH)), pl = lt - i * PUNCH
        const bg = [P.a, P.b, P.light][i % 3], dark = i % 3 !== 2
        boilSeed('punchbg' + i)
        paint(rectPts(-80, -80, W + 160, H + 160, 0), { wash: bg, fill: mixCol(bg, '#000000', .12), fillOp: 90, bleed: .1, tex: .8, ink: null })
        const b = fit(sc.punch[i], 0, HAND, 400, 120, (W - 200) / 1.12, 2)
        const s = lerp(1.12, 1, easeOut(seg(pl, 0, PUNCH))), lh = b.px * .95
        push(); translate(W / 2, H / 2); scale(s); rotate((i % 2 ? 1 : -1) * .02); translate(-W / 2, -H / 2)
        b.lines.forEach((l, li) => text(l.text, W / 2, H / 2 + b.px * .35 - (b.lines.length - 1) * lh / 2 + li * lh, b.f, dark ? PAL.cream : PAL.ink, { align: 'center', shadow: dark ? PAL.ink : P.a, sx: 10, sy: 12 }))
        pop()
        return
      }
      const l2 = lt - T_.pe
      // a sunburst, turning slowly behind everything
      const cx = 1560, cy = 760, R = 1300, rot = l2 * .05
      for (let i = 0; i < 16; i++) {
        const a0 = rot + i / 16 * TAU, a1 = a0 + TAU / 32
        boilSeed('ray' + i)
        paint([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], { fill: i % 2 ? P.light : P.wash, fillOp: 200, bleed: .03, tex: .3, ink: null })
      }
      boilSeed('sun'); paint(ellPts(cx, cy, 250 * backOut(seg(l2, 0, .45)), 250 * backOut(seg(l2, 0, .45)), 36, 2), { fill: P.a, fillOp: 190, bleed: .06, tex: .5, ink: PAL.ink, sw: 1.1 })
      boilSeed('floor'); paint([[-60, 900], [700, 880], [1300, 905], [W + 60, 885], [W + 60, H + 60], [-60, H + 60]], { fill: P.light, fillOp: 230, bleed: .05, tex: .4, ink: PAL.ink, sw: .9, curv: .5 })
      // kicker, typed
      const kick = SB.kicker.toUpperCase(), kn = Math.floor(kick.length * seg(l2, 0, .4))
      text(kick.slice(0, kn), M, 170, fontOf(600, 34, MONOF), PAL.ink, { ls: 3 })
      // the headline, slammed word by word
      const hb = fit(sc.headline, 0, HAND, 150, 70, 1180, 3), lh = hb.px * 1.02, top = 250 + hb.px * .8
      let i = 0
      hb.lines.forEach((line, li) => line.words.forEach(w => {
        const k = seg(lt, T_.hStart + i * T_.gap, T_.hStart + i * T_.gap + .25); i++
        if (k <= 0) return
        const s = lerp(1.6, 1, backOut(k))
        push(); translate(M + w.x + w.w / 2, top + li * lh - hb.px * .35); scale(s)
        text(w.text, -w.w / 2, hb.px * .35, hb.f, PAL.ink, { shadow: P.a, sx: 6, sy: 7, alpha: k * 3 })
        pop()
      }))
      if (sc.sub) {
        const sb = fit(sc.sub, 600, SANS, 50, 36, 1050, 2, -.01), sy = top + (hb.lines.length - 1) * lh + hb.px * .45 + sb.px * 1.3
        wipeLines(lt, sb, M, sy, sb.px * 1.2, T_.subAt, .15, PAL.ink)
      }
      // Clawd pops up to present it
      const c0 = T_.clawd, u = 32
      if (lt > c0 - .2) {
        const j = jump(lt, c0, c0 + .5, 5)
        clawd(1560, 1000, u, { ...emotions(lt, [[c0, 'excited'], [c0 + 1.6, 'happy']]), dy: j.dy + 8 * (1 - easeOut(seg(lt, c0 - .2, c0))), sq: j.sq, aR: 1.1 + .25 * Math.sin(lt * 7), aL: -.4, boilKey: 'host' })
      }
    },
  }

  // ======================================================================
  const CLAIM = {
    say: sc => `${sc.label || 'The claim'}${sc.source ? ', from ' + sc.source : ''}: ${sent(sc.quote)}${({ holds: ' It holds.', 'does not hold': ' It does not hold.', 'half true': ' It is half true.' })[sc.stamp] || ''}`,
    layout(sc) {
      const inner = 1180, qb = fit(sc.quote, 700, SANS, 92, 46, inner, 4, -.015), lh = qb.px * 1.18
      const h = 110 + qb.lines.length * lh + 40
      return { qb, lh, h, w: inner + 120 }
    },
    plan(sc, voice) {
      const L = CLAIM.layout(sc)
      const reveal = .5 + (L.qb.lines.length - 1) * .13 + .3
      sc._t = { reveal, markAt: Math.max(reveal + .2 + words(sc.quote) / WPS * .75, Math.min(voice * .7, reveal + 4)) }
      sc._t.stampAt = sc._t.markAt + (sc.mark ? .6 : 0)
      sc._ev = [{ t: .05, type: 'slide' }, { t: sc._t.markAt, type: 'scratch' }].concat(sc.stamp ? [{ t: sc._t.stampAt, type: 'thunk' }] : [])
      sc._t.voiceAt = .3
      return snap(Math.max(3.5, sc._t.stampAt + (sc.stamp ? 1 : .4) + .5, .3 + voice + .6))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t, L = CLAIM.layout(sc)
      set(lt, 'claim', { horizon: 900 })
      folio(lt)
      const enter = backOut(seg(lt, .03, .5)), x = 90, y = Math.max(140, (920 - L.h) / 2 + 30) + (1 - enter) * 800
      push(); translate(x + L.w / 2, y + L.h / 2); rotate(lerp(-.08, -.015, enter)); translate(-(x + L.w / 2), -(y + L.h / 2))
      boilSeed('cardsh'); paint(rrPts(x + 18, y + 22, L.w, L.h, 24, 0), { wash: PAL.ink, washOp: 40, ink: null })
      boilSeed('card'); paint(rrPts(x, y, L.w, L.h, 24, 2), { wash: PAL.cream, ink: PAL.ink, sw: 1.2 })
      text((sc.label || 'The claim').toUpperCase(), x + 60, y + 70, fontOf(700, 30, MONOF), PAL.ink, { ls: 3 })
      if (sc.source) text(sc.source, x + L.w - 60, y + 70, fontOf(500, 30, MONOF), PAL.ink, { align: 'right' })
      boilSeed('rule'); inkLine([[x + 60, y + 92], [x + L.w - 60, y + 94]], .6, PAL.ink, 'inkfine', 0)
      const qx = x + 60, qy = y + 110 + L.qb.px * .95
      if (sc.mark) {
        const boxes = phraseBoxes(L.qb, sc.mark, qx, qy, L.lh), mk = seg(lt, T_.markAt, T_.markAt + .5)
        boxes.forEach((b, i) => {
          const k = clamp(mk * boxes.length - i); if (k <= 0) return
          boilSeed('hl' + i)
          paint(rectPts(b.x - 10, b.y + b.h * .1, (b.w + 20) * k, b.h * .9, 4), { fill: P.hi, fillOp: 170, bleed: .04, tex: .3, ink: null })
        })
      }
      wipeLines(lt, L.qb, qx, qy, L.lh, .5, .13, PAL.ink)
      if (sc.mark && lt > T_.markAt) {
        const boxes = phraseBoxes(L.qb, sc.mark, qx, qy, L.lh)
        if (boxes.length === 1) {
          const b = boxes[0], k = seg(lt, T_.markAt, T_.markAt + .5), n = Math.max(3, Math.floor(40 * k))
          const pts = []; for (let i = 0; i <= n; i++) { const a = -2.2 + i / 40 * TAU * 1.12; pts.push([b.x + b.w / 2 + Math.cos(a) * (b.w / 2 + 30), b.y + b.h / 2 + Math.sin(a) * (b.h / 2 + 22)]) }
          boilSeed('loop'); inkLine(pts, 1.4, P.a, 'ink', .5)
        }
      }
      pop()
      if (sc.stamp) stamp(lt, T_.stampAt, stampLabel(sc.stamp), x + L.w - 230, y + L.h + 14, 70, -.12, P.a)
      // Clawd inspects it
      const mood = MOODS[sc.stamp] || 'thinking'
      clawd(1680, 1010, 29, { ...emotions(lt, [[0, 'suspicious', { lookX: -1 }], [T_.stampAt + .1, mood, { lookX: -.4 }]]), aR: .5 + .08 * Math.sin(lt * 3), armR: magnifier, flip: true, boilKey: 'host' })
    },
  }

  // ======================================================================
  const STAT = {
    say: sc => `${spokenStat(sc.value, sc.label)} ${sent(sc.note)}`.trim(),
    plan(sc, voice) {
      sc._t = { land: .85, labelAt: .5, stampAt: 1.1 }
      sc._ev = [{ t: .2, type: 'count' }, { t: sc._t.land, type: 'boing' }].concat(sc.stamp ? [{ t: sc._t.stampAt, type: 'thunk' }] : [])
      sc._t.voiceAt = .3
      return snap(Math.max(2.8, sc._t.labelAt + .2 + readT(sc.label) + .4 + readT(sc.note) * .6, .3 + voice + .6))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      set(lt, 'stat')
      folio(lt)
      // Permanent Marker is capitals only: a value whose case matters (code, units) is set in the sans
      const caseMatters = /[a-z]/.test(sc.value)
      const vb = caseMatters ? fit(sc.value, 900, SANS, 300, 100, 1180, 1, -.03) : fit(sc.value, 0, HAND, 330, 110, 1180, 1), lb = fit(sc.label, 600, SANS, 60, 40, 1150, 2, -.012)
      const vy = 180 + vb.px * .82, vw = measure(sc.value, vb.f)
      boilSeed('blob'); paint(ellPts(M + vw / 2, vy - vb.px * .3, vw / 2 + 120, vb.px * .55, 30, 6), { fill: P.a, fillOp: 120 * easeOut(seg(lt, 0, .4)), bleed: .12, tex: .6, ink: null })
      const k = seg(lt, .15, T_.land), shown = window.RF_COUNT ? RF_COUNT(sc.value, k) : sc.value
      const pop_ = 1 + .06 * spring(lt, T_.land, 8, 26)
      push(); translate(M, vy); scale(pop_)
      text(shown, 0, 0, vb.f, PAL.ink, { shadow: P.b, sx: 8, sy: 10, alpha: easeOut(seg(lt, .1, .3)) })
      pop()
      wipeLines(lt, lb, M, vy + 60 + lb.px, lb.px * 1.18, T_.labelAt, .14, PAL.ink)
      if (sc.stamp) {
        // clear of the value's right edge at its largest (the landing pop and the shadow)
        const lab = stampLabel(sc.stamp), sw = stampW(lab, 50), right = M + vw * 1.06 + 10, room = right + 60 + sw < 1480
        stamp(lt, T_.stampAt, lab, room ? right + 60 + sw / 2 : 1560 - sw / 2, room ? vy - vb.px * .55 : 150, 50, -.14, P.b)
      }
      if (sc.note) text('— ' + sc.note, M, 1000, fontOf(500, 30, MONOF), PAL.ink, { alpha: easeOut(seg(lt, T_.stampAt + .3, T_.stampAt + .6)) })
      const tk = take(lt, T_.land, 1)
      clawd(1620, 1000, 31, { ...emotions(lt, [[0, 'neutral', { lookX: -.8 }], [T_.land, 'surprised', { lookX: -.6 }], [T_.land + 1.2, MOODS[sc.stamp] || 'proud']]), dy: tk.dy, sq: tk.sq, boilKey: 'host' })
    },
  }

  // ======================================================================
  const VERSUS = {
    say: sc => [sent(sc.label), sent(`${sc.a.label}, ${sc.a.value}${sc.unit || ''}; ${sc.b.label}, ${sc.b.value}${sc.unit || ''}`), sc.ratio ? sent(`that is ${sc.ratio}`) : '', sent(sc.note)].filter(Boolean).join(' '),
    plan(sc, voice) {
      sc._t = { barAt: .5 + readT(sc.label) * .5, gap: .35 }
      sc._t.ratioAt = sc._t.barAt + sc._t.gap + .9
      sc._ev = [{ t: sc._t.barAt, type: 'grow' }, { t: sc._t.barAt + sc._t.gap, type: 'grow' }].concat(sc.ratio ? [{ t: sc._t.ratioAt, type: 'boing' }] : []).concat(sc.stamp ? [{ t: sc._t.ratioAt + .45, type: 'thunk' }] : [])
      sc._t.voiceAt = .3
      return snap(Math.max(3.8, sc._t.ratioAt + (sc.ratio ? 1 : .3) + 1, .3 + voice + .6))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      set(lt, 'versus', { horizon: 940 })
      folio(lt)
      const hb = fit(sc.label, 700, SANS, 62, 40, 1500, 2, -.015), hy = 190 + hb.px * .8
      wipeLines(lt, hb, M, hy, hb.px * 1.12, .12, .14, PAL.ink)
      const vals = [sc.a, sc.b].map(r => Number(String(r.value).replace(/[^\d.\-]/g, ''))), max = Math.max(...vals)
      const maxW = 1150, top = hy + (hb.lines.length - 1) * hb.px * 1.12 + 110
      ;[sc.a, sc.b].forEach((r, i) => {
        const y = top + i * 250, t0 = T_.barAt + i * T_.gap, k = easeOut(seg(lt, t0, t0 + .8)), bw = Math.max(16, maxW * vals[i] / max)
        // not uppercased: a label may be code (?enemies=300) where case is meaning
        text(String(r.label), M, y, fontOf(600, 34, MONOF), PAL.ink, { ls: 1, alpha: easeOut(seg(lt, t0 - .3, t0)) })
        if (k > 0) { boilSeed('bar' + i); paint(rectPts(M, y + 24, bw * k, 140, 5), { fill: i ? P.b : P.a, fillOp: 215, bleed: .05, tex: .5, ink: PAL.ink, sw: 1 }) }
        const final = String(r.value) + (sc.unit || ''), shown = window.RF_COUNT ? RF_COUNT(final, seg(lt, t0, t0 + .8)) : final
        const vfam = /[a-z]/.test(final) ? SANS : HAND, vw_ = vfam === SANS ? 900 : 0
        let vf = fontOf(vw_, 96, vfam); if (measure(final, vf) > 1650 - (M + bw + 30)) vf = fit(final, vw_, vfam, 96, 50, Math.max(260, bw - 50), 1).f
        const inside = M + bw + 30 + measure(final, vf) > 1650
        if (k > .02) text(shown, inside ? M + bw * k - 30 : M + bw * k + 30, y + 130, vf, inside ? PAL.cream : PAL.ink, { align: inside ? 'right' : 'left', shadow: inside ? PAL.ink : null, sx: 4, sy: 5, alpha: clamp(k * 4) })
      })
      if (sc.ratio && lt > T_.ratioAt) {
        const s = backOut(seg(lt, T_.ratioAt, T_.ratioAt + .3)), cx = 1680, cy = 330
        push(); translate(cx, cy); scale(s); rotate(-.1)
        boilSeed('burst'); paint(starPts(0, 0, 150, .78, 12, 0), { fill: P.a, fillOp: 230, bleed: .03, tex: .3, ink: PAL.ink, sw: 1.1 })
        const rb = /[a-z]/.test(sc.ratio) ? fit(sc.ratio, 900, SANS, 100, 44, 210, 1) : fit(sc.ratio, 0, HAND, 110, 50, 210, 1)
        text(sc.ratio, 0, rb.px * .35, rb.f, PAL.cream, { align: 'center', shadow: PAL.ink, sx: 4, sy: 5 })
        pop()
      }
      if (sc.stamp) stamp(lt, T_.ratioAt + .45, stampLabel(sc.stamp), 1560, 1010, 40, .06, PAL.ink)
      if (sc.note) text('— ' + sc.note, M, 1030, fontOf(500, 28, MONOF), PAL.ink, { alpha: easeOut(seg(lt, T_.ratioAt, T_.ratioAt + .4)) })
      const tk = take(lt, T_.ratioAt, .8)
      clawd(1700, 1010, 25, { ...emotions(lt, [[0, 'thinking', { lookX: -1 }], [T_.ratioAt, 'surprised'], [T_.ratioAt + 1, MOODS[sc.stamp] || 'smug']]), dy: tk.dy, sq: tk.sq, boilKey: 'host' })
    },
  }

  // ======================================================================
  const TALLY = {
    say: sc => [sent(sc.label), ...sc.rows.map(r => sent(`${r.n} of ${sc.of}: ${r.label}`)), sent(sc.note)].filter(Boolean).join(' '),
    grid(of, maxW, maxH) {
      let best = null
      for (let cols = 1; cols <= of; cols++) { const rows = Math.ceil(of / cols), cell = Math.min(maxW / cols, maxH / rows, 190); if (!best || cell > best.cell + 1e-9 || (Math.abs(cell - best.cell) < 1e-9 && rows < best.rows)) best = { cols, rows, cell } }
      return best
    },
    plan(sc, voice) {
      sc._t = { rowAt: [], fill: Math.min(1.1, .3 + sc.of * .03) }
      let at = .45 + readT(sc.label) * .55
      sc._ev = []
      sc.rows.forEach(r => { sc._t.rowAt.push(at); sc._ev.push({ t: at, type: 'ticks', n: Math.min(r.n, 24), span: sc._t.fill }); at += sc._t.fill + .3 + readT(r.label) * .55 })
      sc._t.stampAt = at - .2
      if (sc.stamp) sc._ev.push({ t: sc._t.stampAt, type: 'thunk' })
      sc._t.voiceAt = .3
      return snap(Math.max(3.8, at + .5 + readT(sc.note) * .6, .3 + voice + .6))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      set(lt, 'tally', { horizon: 960 })
      folio(lt)
      const hb = fit(sc.label, 700, SANS, 62, 40, 1500, 2, -.015), hy = 190 + hb.px * .8
      wipeLines(lt, hb, M, hy, hb.px * 1.12, .12, .14, PAL.ink)
      const top = hy + (hb.lines.length - 1) * hb.px * 1.12 + 70, n = sc.rows.length, rowH = (930 - top) / n
      const G_ = TALLY.grid(sc.of, 1000, rowH - 30), cols = [P.a, P.b, PAL.ink]
      sc.rows.forEach((r, i) => {
        const gh = Math.ceil(sc.of / G_.cols) * G_.cell, y = top + i * rowH + Math.max(0, (rowH - 30 - gh) / 2), t0 = T_.rowAt[i]
        const filled = Math.round(r.n * easeOut(seg(lt, t0, t0 + T_.fill)))
        const a = easeOut(seg(lt, t0 - .4, t0 - .1))
        for (let c = 0; c < sc.of; c++) {
          const cx = M + (c % G_.cols) * G_.cell, cy = y + Math.floor(c / G_.cols) * G_.cell, s = G_.cell * .8
          boilSeed('cell' + i + '_' + c)
          if (c < filled) paint(rectPts(cx + G_.cell * .1, cy + G_.cell * .1, s, s, Math.min(4, s * .05)), { fill: cols[i % 3], fillOp: 225, bleed: .02, tex: .3, ink: PAL.ink, sw: Math.min(.8, s / 60) })
          else if (a > 0 && G_.cell > 14) { G.save(); G.globalAlpha = a * .7; inkLine(rectPts(cx + G_.cell * .1, cy + G_.cell * .1, s, s, 0).concat([[cx + G_.cell * .1, cy + G_.cell * .1]]), Math.min(.5, s / 90), PAL.ink, 'HB', 0); G.restore() }
          else if (a > 0) { G.save(); G.globalAlpha = a * .4; G.strokeStyle = PAL.ink; G.lineWidth = 1; G.strokeRect(cx + G_.cell * .1, cy + G_.cell * .1, s, s); G.restore() }
        }
        const lx = M + Math.min(G_.cols, sc.of) * G_.cell + 50, cy0 = y + Math.min(gh, rowH - 30) / 2
        const rb = fit(r.label, 600, SANS, 44, 28, Math.max(300, 1480 - lx), 2, -.01)
        text(`${filled} of ${sc.of}`, lx, cy0 - 10, fontOf(0, 92, HAND), PAL.ink, { shadow: cols[i % 3], sx: 5, sy: 6, alpha: easeOut(seg(lt, t0 - .2, t0 + .1)) })
        rb.lines.forEach((l, li) => text(l.text, lx, cy0 + 40 + li * rb.px * 1.15, rb.f, PAL.ink, { alpha: easeOut(seg(lt, t0, t0 + .3)) }))
      })
      if (sc.stamp) stamp(lt, T_.stampAt, stampLabel(sc.stamp), 1560, 1020, 40, .06, PAL.ink)
      if (sc.note) text('— ' + sc.note, M, 1035, fontOf(500, 28, MONOF), PAL.ink, { alpha: easeOut(seg(lt, T_.stampAt, T_.stampAt + .4)) })
      const bouncing = lt > T_.rowAt[0] && lt < T_.stampAt
      clawd(1730, 1010, 23, { ...(bouncing ? move('bounce', lt) : {}), ...emotions(lt, [[0, 'neutral', { lookX: -1 }], [T_.rowAt[0], 'excited'], [T_.stampAt, MOODS[sc.stamp] || 'proud']]), boilKey: 'host' })
    },
  }

  // ======================================================================
  const LIST = {
    say: sc => [sent(sc.label), ...sc.items.map(i => sent(i.text))].filter(Boolean).join(' '),
    plan(sc, voice) {
      sc._t = { at: [] }
      let at = .4 + readT(sc.label) * .6
      sc._ev = []
      sc.items.forEach(it => { sc._t.at.push(at); sc._ev.push({ t: at, type: it.mark === 'no' ? 'scratch' : 'tick' }); at += .4 + words(it.text) / WPS })
      sc._t.voiceAt = .3
      return snap(Math.max(3, at + .5, .3 + voice + .6))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      set(lt, 'list', { horizon: 960 })
      folio(lt)
      let y = 170
      if (sc.label) { const hb = fit(sc.label, 700, SANS, 62, 40, 1500, 2, -.015); wipeLines(lt, hb, M, y + hb.px * .8, hb.px * 1.12, .12, .14, PAL.ink); y += hb.lines.length * hb.px * 1.12 + 60 }
      const n = sc.items.length, rowH = Math.min(230, (930 - y) / n)
      sc.items.forEach((it, i) => {
        const t0 = T_.at[i]; if (lt < t0 - .05) return
        let ib; for (let mx = 78; ; mx -= 4) { ib = fit(it.text, 700, SANS, mx, 40, 1180, 2, -.014); if (ib.lines.length * ib.px * 1.1 <= rowH - 40 || mx <= 44) break }
        const iy = y + i * rowH + (rowH - (ib.lines.length - 1) * ib.px * 1.1) / 2 + ib.px * .3
        const next = T_.at[i + 1], dim = next != null ? lerp(1, .4, easeOut(seg(lt, next, next + .3))) : 1
        const bk = backOut(seg(lt, t0, t0 + .3)), bx = M + 50, by = iy - ib.px * .34 - (ib.lines.length - 1) * ib.px * .55
        G.save(); G.globalAlpha = dim
        boilSeed('badge' + i); paint(ellPts(bx, by, 48 * bk, 48 * bk, 24, 1.5), { fill: it.mark === 'no' ? PAL.ink : P.a, fillOp: 230, bleed: .03, tex: .3, ink: PAL.ink, sw: .9 })
        if (bk > .5) {
          boilSeed('mark' + i)
          if (it.mark === 'yes') inkLine([[bx - 20, by + 2], [bx - 6, by + 18], [bx + 22, by - 18]], 1.5, PAL.cream, 'ink', 0)
          else if (it.mark === 'no') { inkLine([[bx - 16, by - 16], [bx + 16, by + 16]], 1.4, PAL.cream, 'ink', 0); inkLine([[bx + 16, by - 16], [bx - 16, by + 16]], 1.4, PAL.cream, 'ink', 0) }
          else text(String(i + 1), bx, by + 16, fontOf(0, 46, HAND), PAL.cream, { align: 'center' })
        }
        G.restore()
        wipeLines(lt, ib, M + 130, iy, ib.px * 1.1, t0 + .12, .12, mixCol(PAL.ink, PAL.paper, 1 - dim))
      })
      clawd(1720, 1010, 25, { ...emotions(lt, [[0, 'determined', { lookX: -1 }]]), aR: .2 + .9 * T_.at.reduce((s, a) => s + Math.exp(-6 * Math.max(0, lt - a)) * (lt > a ? 1 : 0), 0), boilKey: 'host' })
    },
  }

  // ======================================================================
  const VERDICT = {
    say: sc => sent(sc.text),
    plan(sc, voice) {
      const n = words(sc.text)
      sc._t = { markAt: .5 + n / WPS * .75 }
      sc._t.stampAt = sc._t.markAt + (sc.mark ? .6 : .2)
      sc._ev = [{ t: sc._t.markAt, type: 'ding' }].concat(sc.stamp ? [{ t: sc._t.stampAt, type: 'thunk' }] : [])
      sc._t.voiceAt = .3
      return snap(Math.max(3.2, .4 + n / WPS + 1.1 + (sc.stamp ? .5 : 0), .3 + voice + .8))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t
      set(lt, 'verdict', { sky: P.light, floor: P.wash, horizon: 960 })
      folio(lt)
      const vb = fit(sc.text, 800, SANS, 124, 60, 1250, 4, -.025), lh = vb.px * 1.06
      const y0 = Math.max(250, (940 - vb.lines.length * lh) / 2 + vb.px * .75)
      if (sc.mark) {
        const boxes = phraseBoxes(vb, sc.mark, M, y0, lh), mk = seg(lt, T_.markAt, T_.markAt + .5)
        boxes.forEach((b, i) => { const k = clamp(mk * boxes.length - i); if (k <= 0) return; boilSeed('vhl' + i); paint(rectPts(b.x - 14, b.y + b.h * .12, (b.w + 28) * k, b.h * .92, 5), { fill: P.hi, fillOp: 190, bleed: .05, tex: .4, ink: null }) })
      }
      wipeLines(lt, vb, M, y0, lh, .25, .16, PAL.ink)
      if (sc.stamp) stamp(lt, T_.stampAt, stampLabel(sc.stamp), 1600, 200, 44, .1, P.a)
      clawd(1640, 1030, 36, { ...emotions(lt, [[0, 'thinking', { lookX: -1 }], [T_.markAt, 'proud']]), boilKey: 'host' })
    },
  }

  // ======================================================================
  // END — the receipt prints up from the bottom of the frame, and Clawd
  // presents it
  const END = {
    say: () => 'Every number here is from the full article, with its sources, at ai.thesatyajit.com.',
    layout() {
      const items = SB.receipt || [], w = 720, rowH = 48
      const kb = fit(SB.kicker.toUpperCase(), 600, MONOF, 28, 20, w - 100, 2)
      const tb = SB.total ? fit(SB.total, 700, MONOF, 30, 22, w - 100, 3) : null
      // a long label wraps onto a second line rather than shrinking past reading size
      const rows = items.map(([lab, val]) => {
        const vf = fontOf(700, 30, MONOF), lb = fit(lab, 500, MONOF, 28, 24, w - 100 - measure(val, vf) - 36, 2)
        return { val, vf, lb, h: rowH + (lb.lines.length - 1) * lb.px * 1.15 }
      })
      const h = 160 + kb.lines.length * 34 + rows.reduce((a, r) => a + r.h, 0) + 40 + (tb ? 48 + tb.lines.length * tb.px * 1.3 : 0) + 140
      return { items, rows, w, rowH, kb, tb, h }
    },
    plan(sc, voice) {
      const L = END.layout()
      sc._t = { print: .8 + L.items.length * .18 }
      sc._ev = [{ t: .3, type: 'print', span: sc._t.print }, { t: .3 + sc._t.print + .1, type: 'boing' }]
      sc._t.voiceAt = .5
      return snap(Math.max(sc._t.print + 2.4, .5 + voice + .8))
    },
    draw(t, lt, sc, dur) {
      const T_ = sc._t, L = END.layout()
      set(lt, 'end', { sky: P.wash, floor: P.light, horizon: 990 })
      const cx = 1120, x = cx - L.w / 2, top = Math.max(40, (1040 - L.h) / 2)
      const p = easeOut(seg(lt, .3, .3 + T_.print)), y = lerp(H + 20, top, p)
      push(); translate(cx, y); rotate(-.012 + .006 * Math.sin(lt * 2)); translate(-cx, -y)
      boilSeed('rcptsh'); paint(rectPts(x + 16, y + 20, L.w, L.h, 0), { wash: PAL.ink, washOp: 38, ink: null })
      boilSeed('rcpt')
      const zz = []; for (let i = 0; i <= 24; i++) zz.push([x + L.w * i / 24, y + (i % 2 ? 0 : 12)])
      paint(zz.concat([[x + L.w, y + L.h], [x, y + L.h]]), { wash: '#FFFDF7', ink: PAL.ink, sw: .8 })
      let yy = y + 88
      text('RECEIPTS', cx, yy, fontOf(0, 58, HAND), PAL.ink, { align: 'center' }); yy += 50
      L.kb.lines.forEach(l => { text(l.text, cx, yy, L.kb.f, PAL.ink, { align: 'center', ls: 2 }); yy += 34 })
      if (SB.date) { text(SB.date, cx, yy, fontOf(500, 24, MONOF), PAL.ink, { align: 'center' }); yy += 30 }
      const dash = q => { G.save(); G.setLineDash([10, 10]); G.lineWidth = 2; G.strokeStyle = PAL.ink; G.beginPath(); G.moveTo(x + 50, q); G.lineTo(x + L.w - 50, q); G.stroke(); G.restore() }
      dash(yy); yy += 54
      L.rows.forEach(r => {
        r.lb.lines.forEach((l, i) => text(l.text, x + 50, yy + i * r.lb.px * 1.15, r.lb.f, PAL.ink))
        text(r.val, x + L.w - 50, yy, r.vf, PAL.ink, { align: 'right' }); yy += r.h
      })
      dash(yy - 20); yy += 30
      if (L.tb) { text('VERDICT', x + 50, yy, fontOf(700, 26, MONOF), PAL.ink, { ls: 3 }); yy += 42; L.tb.lines.forEach(l => { text(l.text, x + 50, yy, L.tb.f, PAL.ink); yy += L.tb.px * 1.3 }); yy += 8 }
      const r = seededRng(hashStr(SB.slug)); let bx = x + 90
      G.fillStyle = PAL.ink; while (bx < x + L.w - 90) { const bw = 2 + Math.floor(r() * 5); if (r() > .35) G.fillRect(bx, yy, bw, 60); bx += bw + 2 + Math.floor(r() * 3) }
      yy += 98; text('ai.thesatyajit.com', cx, yy, fontOf(600, 30, MONOF), PAL.ink, { align: 'center' })
      pop()
      const a = easeOut(seg(lt, .4, .8))
      text('the full article,', 110, 400, fontOf(0, 72, HAND), PAL.ink, { alpha: a, shadow: P.a, sx: 4, sy: 5 })
      text('with sources:', 110, 486, fontOf(0, 72, HAND), PAL.ink, { alpha: a, shadow: P.a, sx: 4, sy: 5 })
      text('ai.thesatyajit.com', 110, 580, fontOf(700, 54, SANS), PAL.ink, { alpha: easeOut(seg(lt, .7, 1.1)) })
      const done = .3 + T_.print, tk = take(lt, done + .1, .7)
      clawd(1690, 1010, 27, { ...emotions(lt, [[0, 'happy', { lookX: -1 }], [done + .1, 'proud', { lookX: -.8 }]]), aL: .9 + .15 * Math.sin(lt * 5), aR: -.3, dy: tk.dy, sq: tk.sq, boilKey: 'host' })
    },
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

  // the odometer: intermediate values keep the target's decimals and grouping
  window.RF_COUNT = (str, k) => {
    const m = String(str).match(/^([^\d\-]*)(-?[\d,]*\.?\d+)(.*)$/)
    if (!m || k >= 1) return str
    const raw = m[2], dec = raw.includes('.') ? raw.split('.')[1].length : 0, v = parseFloat(raw.replace(/,/g, '')) * easeOut(k)
    let s = v.toFixed(dec)
    if (raw.includes(',')) { const [i, d] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '') }
    return m[1] + s + m[3]
  }

  const SCENES = { title: TITLE, claim: CLAIM, stat: STAT, versus: VERSUS, tally: TALLY, list: LIST, verdict: VERDICT, end: END }

  // ---------- the film ----------
  let TL = null
  const WIPE = .6
  function lines(sb) { return sb.scenes.map(sc => sc.say || SCENES[sc.type].say(sc)) }
  function load(sb, voice) {
    voice = voice || sb._voice || []
    SB = sb; P = PALS[sb.palette] || PALS['pink-blue']
    let t = 0
    const scenes = sb.scenes.map((sc, i) => {
      const s = { ...sc, _i: i }, dur = SCENES[s.type].plan(s, voice[i] || 0)
      const out = { sc: s, start: t, dur, trans: i === 0 ? 'none' : (i % 3 === 2 ? 'cut' : 'wipe') }
      t += dur; return out
    })
    DUR = t
    const events = []
    scenes.forEach((s, i) => {
      if (s.trans === 'wipe') events.push({ t: s.start - .25, type: 'whoosh' })
      for (const e of s.sc._ev || []) events.push({ ...e, t: +(s.start + e.t).toFixed(3) })
    })
    TL = { scenes, duration: t }
    return {
      duration: t, posterT: scenes[0].sc._t.poster,
      scenes: scenes.map(s => ({ type: s.sc.type, start: +s.start.toFixed(3), dur: +s.dur.toFixed(3), trans: s.trans, voiceAt: +(s.start + (s.sc._t.voiceAt || .3)).toFixed(3) })),
      events: events.sort((a, b) => a.t - b.t), lines: lines(sb),
    }
  }
  function progress(t) {
    const S = TL.scenes.slice(1); if (t < S[0].start) return
    const x0 = 110, w = W - 220, gap = 12, sw = (w - gap * (S.length - 1)) / S.length
    S.forEach((s, j) => {
      const k = clamp((t - s.start) / s.dur), x = x0 + j * (sw + gap)
      G.save(); G.globalAlpha = .18; G.fillStyle = PAL.ink; G.fillRect(x, H - 26, sw, 6); G.globalAlpha = 1
      if (k > 0) G.fillRect(x, H - 26, sw * k, 6); G.restore()
    })
  }
  function frame(t) {
    t = Math.max(0, Math.min(t, TL.duration - 1e-4))
    paintFrame(t, tt => {
      let i = TL.scenes.length - 1; while (i > 0 && tt < TL.scenes[i].start) i--
      const s = TL.scenes[i], lt = tt - s.start
      const next = TL.scenes[i + 1]
      SCENES[s.sc.type].draw(tt, lt, s.sc, s.dur)
      flushLetters()
      // brush wipes: cover at the end of one scene, uncover at the start of the next
      const cols = [P.a, mixCol(P.a, PAL.ink, .25)]
      if (next && next.trans === 'wipe' && lt > s.dur - WIPE / 2) brushWipe((lt - (s.dur - WIPE / 2)) / WIPE, cols)
      if (s.trans === 'wipe' && lt < WIPE / 2) brushWipe(.5 + lt / WIPE, cols)
      progress(tt)
    })
  }
  // the base's brush wipe (timeline.js), fat strokes that cover then drag off
  function brushWipe(p, cols) {
    if (p <= 0 || p >= 1) return
    const [c1, c2] = cols, n = 5, bh = (H + 420) / n + 40
    push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2)
    for (let i = 0; i < n; i++) {
      const y0 = -230 + i * (H + 420) / n, d = [0, .14, .06, .18, .1][i]
      const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)))
      const x0 = p < .5 ? -300 : lerp(-300, W + 400, q), x1 = p < .5 ? lerp(-300, W + 400, q) : W + 400
      if (x1 - x0 < 30) continue
      const pts = [], rag = k => 40 + 50 * hash(i * 31 + k) + jit(12)
      boilSeed('wipe' + i)
      for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14 + jit(5)])
      for (let k = 1; k < 9; k++) pts.push([x1 + rag(k) - 40, y0 + bh * k / 9])
      for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14 + jit(5)])
      if (p >= .5) for (let k = 8; k > 0; k--) pts.push([x0 - rag(k + 20) + 40, y0 + bh * k / 9])
      paint(pts, { wash: i % 2 ? c1 : c2, washOp: 255, fill: i % 2 ? c2 : c1, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null })
    }
    pop()
  }

  window.FILM = { load, frame, lines, get duration() { return TL ? TL.duration : 0 } }
})()
