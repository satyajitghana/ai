// story2/stage.js — the scene types only Story v2 has.
//
// Loaded after story2/explainer.js, scenes.js and bespoke.js; reads the
// engine's internals from window.STORY like they do, and emits only the sound
// cues audio.py already synthesizes (audio.py is shared with every film and
// stays as it is).
//
//   footage  a clip or a still the article itself shows, played full-frame
//            (or large, in a painted frame) with the narration over it: each
//            step plays its own span of the clip, retimed to its line, or
//            moves slowly across a still (a Ken Burns move between regions);
//            captions are lower-thirds; the host is off, or small in a corner
//   split    two to four clips or stills side by side, playing in step: the
//            same view of three things, a before and an after; a step may
//            widen one pane or cut every pane to another moment
//   pan      a wide canvas of stations the camera travels along without
//            stopping, a marker running the path ahead of it
//   sort     a counted set of dots that regroup: every dot travels its own
//            arc from the bin it was in to the bin it belongs to next (a bin
//            marked `rest` holds the remainder and shows no count)
//
// Every digit these draw is the storyboard's (a station's value, a bin's
// count), and the checker holds those fields to the article. A clip's own
// pixels are its source's, as a figure's are.
(() => {
  const K = window.STORY
  const { SCENES, M, readT, snap, bgCol, tone, textOn, focus, beatTimes, beatOf, host, hop, folio, heading, headBottom, note, picture, lazyFrame, MEDIA, along, lenOf, partial } = K
  const P = () => STYLE.P
  const ink2 = () => (STYLE.dark ? P().a : STYLE.ink)
  const TONES = ['a', 'b', 'hi', 'light']

  // ---------- shared: steps that may be silent, clips that follow their line ----------
  // A step with `say` is a beat; one without is a hold: picture, no voice, for
  // `hold` seconds (or its clip's own length). sc._s / sc._sd are every step's
  // start and length; sc._b only the spoken ones', which is what the voice,
  // the captions track and the lower-thirds are timed to.
  const spoken = sc => sc.steps.filter(s => s.say)
  function planSteps(sc, v, lead = .45, gap = .38) {
    let t = lead, k = 0
    sc._s = []; sc._sd = []; sc._b = []
    for (const s of sc.steps) {
      const span = s.clip ? s.clip[1] - s.clip[0] : 0
      let d
      if (s.say) { sc._b.push(t); d = Math.max((v[k] || 0) + gap, 1.6 + readT(s.caption) * .6) + (s.hold || 0); k++ }
      else d = Math.max(.6, s.hold || span || 2)
      sc._s.push(t); sc._sd.push(d); t += d
    }
    return t
  }
  const stepAt = (sc, lt) => { let i = 0; while (i + 1 < sc._s.length && lt >= sc._s[i + 1]) i++; return i }
  const spokenIndex = (sc, j) => sc.steps.slice(0, j + 1).filter(s => s.say).length - 1

  // the frame of `src` to show at second `pos` of the clip (a still has one)
  const frameOf = (src, pos) => { const m = MEDIA[src]; return m ? lazyFrame(src, m.n > 1 ? pos * m.fps : 0) : null }
  // Where a step is in its clip. A step with `clip: [a, b]` plays that span,
  // retimed a little (0.6x to 1.7x) so it ends as its line does, then holds;
  // `at` freezes one moment; a step with neither carries on from where the
  // step before it stopped, at the clip's own speed.
  function clipPos(sc, j, x) {
    const s = sc.steps[j]
    if (s.at != null) return s.at
    if (s.clip) { const span = s.clip[1] - s.clip[0], rate = clamp(span / Math.max(.3, sc._sd[j] - .25), .6, 1.7); return s.clip[0] + Math.min(span, Math.max(0, x) * rate) }
    if (j === 0) return Math.max(0, x)
    return clipPos(sc, j - 1, sc._sd[j - 1]) + Math.max(0, x)
  }
  // a region of the picture ([x, y, w, h] in percent), widened to the shape it is shown in and kept inside it
  function crop(m, f, A) {
    let rw = f[2] / 100 * m.w, rh = f[3] / 100 * m.h
    const mx = (f[0] + f[2] / 2) / 100 * m.w, my = (f[1] + f[3] / 2) / 100 * m.h
    if (rw / rh < A) rw = rh * A; else rh = rw / A
    if (rw > m.w) { rw = m.w; rh = rw / A } if (rh > m.h) { rh = m.h; rw = rh * A }
    return [clamp(mx - rw / 2, 0, m.w - rw), clamp(my - rh / 2, 0, m.h - rh), rw, rh]
  }
  const FULL = [0, 0, 100, 100]
  // the framing at step j, x seconds in: a slow move from the last framing to
  // this one. On a still it takes the whole step and never quite stops (a
  // Ken Burns move); on a clip it reframes in a second and lets the clip play.
  function framing(sc, j, x, still) {
    const s = sc.steps[j], to = s.focus || FULL
    const from = s.from || (j > 0 ? sc.steps[j - 1].focus || FULL : (sc.steps[0].from || to))
    const d = sc._sd[j]
    let k
    if (K.THUMB) k = 1
    else if (still || s.drift) { const u = clamp(x / d); k = .35 * u + .65 * ease(u) }
    else k = ease(clamp(x / 1.1))
    const f = from.map((a, i) => lerp(a, to[i], k))
    // a still that is not asked to move still breathes: a slow push of a few percent
    if ((still || s.drift) && from.every((a, i) => a === to[i]) && !K.THUMB) { const z = .045 * clamp(x / d), w = f[2] * (1 - z), h = f[3] * (1 - z); return [f[0] + (f[2] - w) / 2, f[1] + (f[3] - h) / 2, w, h] }
    return f
  }
  // a lower-third over a picture: a paper plate with the style's accent bar
  function caption(lt, str, t0, t1, y = 936, x0 = 70) {
    if (!str || K.THUMB || K.MINI) return
    const kin = expoOut(seg(lt, t0, t0 + .45)), kout = 1 - easeIn(seg(lt, t1 - .3, t1)), k = Math.min(kin, kout)
    if (k <= 0) return
    const b = fitR('body', str, 40, 28, 1380, 2), lh = b.px * 1.18, w = Math.max(...b.lines.map(l => l.width)) + 76, h = b.lines.length * lh + 34
    const x = x0 - (1 - kin) * 70, top = y - h
    push(); G.globalAlpha *= clamp(k * 1.6)
    STYLE.flat(rectPts(x, top, w, h), bgCol(), .93)
    STYLE.flat(rectPts(x, top, 12, h), ink2(), 1)
    G.save(); G.beginPath(); G.rect(x, top - 6, w * clamp(seg(lt, t0 + .1, t0 + .55) * 1.15), h + 12); G.clip()
    b.lines.forEach((l, i) => write(l.text, x + 40, top + 17 + b.px * .82 + i * lh, b.f, STYLE.ink))
    G.restore()
    pop()
  }
  // a small label on a picture: what it is, or whose
  function chip(str, x, y, col, k = 1, align = 'left', size = 30) {
    if (!str || k <= 0) return 0
    const f = F('label', size), lab = caps('label', str), w = measure(lab, f) + 36, h = size * 1.7, xx = align === 'right' ? x - w : x
    push(); G.globalAlpha *= clamp(k * 2); translate(0, (1 - expoOut(k)) * -24)
    STYLE.flat(rectPts(xx, y, w, h), col, .96)
    write(lab, xx + 18, y + h / 2 + size * .36, f, textOn(col))
    pop()
    return w
  }
  const credit = (str, x, y, k, align = 'right') => { if (!str || K.THUMB) return; const f = F('mono', 22), lab = caps('mono', str), w = measure(lab, f) + 24; push(); G.globalAlpha *= clamp(k) * .92; STYLE.flat(rectPts(align === 'right' ? x - w : x, y, w, 36), bgCol(), .82); write(lab, align === 'right' ? x - w + 12 : x + 12, y + 26, f, STYLE.dim); pop() }

  // ======================================================================
  // FOOTAGE: the real thing, full-frame. The article's own clip or picture
  // fills the frame (layout "full", cropped to fit) or sits large in a frame
  // drawn in the film's medium (layout "frame", nothing cropped); the narrator
  // talks over it and the steps cut it to what each line is about.
  const FOOTAGE = {
    stage: 'off', ownCam: true, plain: true,
    beats: sc => spoken(sc).map(s => s.say),
    voiced: sc => spoken(sc).map(s => s.voice),
    terms: sc => spoken(sc).map(s => s.term || null),
    plan(sc, v) {
      const end = planSteps(sc, v)
      sc._ev = [{ t: .05, type: 'slide' }].concat(sc.steps.slice(1).flatMap((s, i) => (s.clip || s.at != null || s.focus ? [{ t: sc._s[i + 1], type: 'tick' }] : [])))
      const dur = snap(end + .3)
      sc._win = [[0, dur, 1]]          // every frame painted: a clip plays, a still drifts
      return dur
    },
    draw(t, lt, sc) {
      const m = MEDIA[sc.src]
      push(); translate(-K.SHIFT, 0)
      const j = K.THUMB ? sc.steps.length - 1 : stepAt(sc, lt), x = K.THUMB ? sc._sd[j] : lt - sc._s[j], s = sc.steps[j]
      const still = !m || m.n <= 1
      const kin = K.THUMB ? 1 : expoOut(seg(lt, 0, .6))
      // the window the picture is shown in
      let R
      if ((sc.layout || 'full') === 'full' || !m) R = [0, 0, W, H]
      else {
        const corner = K.STAGE === 'corner', top = sc.title ? 168 : 110, aw = W - 2 * 96 - (corner ? 170 : 0), ah = 968 - top, A0 = m.w / m.h, f0 = sc.steps.find(q => q.focus)
        // a framed picture keeps its own shape unless the steps crop into it, when the frame is the room's
        const A = sc.shape ? sc.shape[0] / sc.shape[1] : f0 ? Math.min(aw / ah, Math.max(A0, 1.5)) : A0
        const w = Math.min(aw, ah * A), h = w / A
        // a corner host stands at the right: the frame gives it room
        R = [corner ? Math.max(96, (W - 170 - w) / 2) : (W - w) / 2, top + (ah - h) / 2, w, h]
      }
      if (m) {
        const f = framing(sc, j, x, still), [sx, sy, sw, sh] = crop(m, f, R[2] / R[3])
        const img = frameOf(sc.src, clipPos(sc, j, x))
        push(); G.globalAlpha *= clamp(kin * 1.5)
        if (R[2] < W) { translate(0, (1 - kin) * 50); STYLE.flat(rectPts(R[0] + 12, R[1] + 16, R[2], R[3]), '#000000', .18) }
        keepClear(R[0], R[1], R[2], R[3], 0)
        if (img) picture(img, sx, sy, sw, sh, R[0], R[1], R[2], R[3])
        else STYLE.flat(rectPts(...R), '#888888', 1)
        if (R[2] < W) { boilSeed('footage-frame'); STYLE.line(rectPts(R[0] - 5, R[1] - 5, R[2] + 10, R[3] + 10), 1.2, STYLE.ink, { closed: true, curv: 0 }) }
        pop()
      }
      // a framed picture with a heading has no folio: the two would share the top of the frame
      if (R[2] < W) { if (sc.title) heading(lt, sc.title, .1, 128); else folio(lt) }
      else if (sc.title) chip(sc.title, 70, 64, sc.tone ? tone(sc.tone) : ink2(), K.THUMB ? 1 : seg(lt, .25, .7), 'left', 34)
      credit(sc.credit ? 'Source: ' + sc.credit : null, R[2] < W ? R[0] + R[2] : W - 40, R[2] < W ? R[1] + R[3] + 14 : H - 84, kin)
      if (s.caption) caption(lt, s.caption, sc._s[j] + .25, sc._s[j] + sc._sd[j] - .05, R[2] < W ? R[1] + R[3] - 26 : 936, R[2] < W ? R[0] + 26 : 70)
      pop()
      host(t, { mood: j === sc.steps.length - 1 ? 'happy' : 'thinking', look: -.7, ...(s.say ? hop(lt, sc._s[j], 14) : {}) })
    },
  }

  // ======================================================================
  // SPLIT: the same thing two, three or four ways, side by side and in step.
  // Panes share one clock: every clip plays from its own start as the scene
  // runs, a step with `seek` cuts all of them to that second, and a step with
  // `solo` widens one pane while the line is about it.
  const SPLIT = {
    stage: 'off', ownCam: true, plain: true,
    beats: sc => spoken(sc).map(s => s.say),
    voiced: sc => spoken(sc).map(s => s.voice),
    terms: sc => spoken(sc).map(s => s.term || null),
    plan(sc, v) {
      const end = planSteps(sc, v)
      sc._ev = [{ t: .05, type: 'slide' }].concat(sc.steps.slice(1).map((s, i) => ({ t: sc._s[i + 1], type: s.seek != null ? 'tick' : 'whoosh' })))
      const dur = snap(end + .3)
      sc._win = [[0, dur, 1]]
      return dur
    },
    draw(t, lt, sc) {
      push(); translate(-K.SHIFT, 0)
      const n = sc.panes.length, j = K.THUMB ? sc.steps.length - 1 : stepAt(sc, lt), s = sc.steps[j]
      // the clock the panes share: seconds since the last cut
      let cut = 0, base = 0
      for (let i = 0; i <= j; i++) if (sc.steps[i].seek != null) { cut = sc._s[i]; base = sc.steps[i].seek }
      const pos = base + Math.max(0, (K.THUMB ? sc._s[j] + sc._sd[j] : lt) - cut)
      // widths: equal, or one pane wider while a step solos it
      const wt = i => { const w = q => (sc.steps[q] && sc.steps[q].solo === i ? 1.9 : sc.steps[q] && sc.steps[q].solo != null ? .72 : 1); return K.THUMB ? w(j) : lerp(w(j - 1), w(j), ease(seg(lt, sc._s[j], sc._s[j] + .7))) }
      const two = n === 4, gut = 10, top = sc.title ? 150 : 0
      const cells = []
      if (two) { const w = (W - gut) / 2, h = (H - top - gut) / 2; for (let i = 0; i < 4; i++) cells.push([(i % 2) * (w + gut), top + Math.floor(i / 2) * (h + gut), w, h]) }
      else { const ws = sc.panes.map((_, i) => wt(i)), tot = ws.reduce((a, b) => a + b, 0), room = W - gut * (n - 1); let x = 0; ws.forEach(w => { const pw = room * w / tot; cells.push([x, top, pw, H - top]); x += pw + gut }) }
      sc.panes.forEach((p, i) => {
        const m = MEDIA[p.src], c = cells[i], k = K.THUMB ? 1 : expoOut(seg(lt, .05 + i * .12, .65 + i * .12))
        if (k <= 0) return
        push(); G.globalAlpha *= clamp(k * 1.5); translate(0, (1 - k) * (i % 2 ? 70 : -70))
        keepClear(c[0], c[1], c[2], c[3], 0)
        if (m) {
          const a = p.clip ? p.clip[0] : 0, b = p.clip ? p.clip[1] : (m.n - 1) / m.fps
          const img = frameOf(p.src, p.at != null ? p.at : Math.min(b, a + pos))
          const [sx, sy, sw, sh] = crop(m, p.focus || FULL, c[2] / c[3])
          if (img) picture(img, sx, sy, sw, sh, c[0], c[1], c[2], c[3])
        }
        // a pane the step is not about steps back
        const dimmed = s.solo != null && s.solo !== i ? (K.THUMB ? 1 : ease(seg(lt, sc._s[j], sc._s[j] + .5))) : 0
        if (dimmed > 0) STYLE.flat(rectPts(c[0], c[1], c[2], c[3]), bgCol(), .42 * dimmed)
        chip(p.label, c[0] + 26, c[1] + 28, tone(p.tone || TONES[i % 3]), 1, 'left', 32)
        pop()
      })
      if (sc.title) { STYLE.flat(rectPts(0, 0, W, top), bgCol(), 1); heading(lt, sc.title, .1, 104) }
      credit(sc.credit ? 'Source: ' + sc.credit : null, W - 40, H - 84, K.THUMB ? 0 : seg(lt, .4, .9))
      if (s.caption) caption(lt, s.caption, sc._s[j] + .25, sc._s[j] + sc._sd[j] - .05)
      pop()
      host(t, { mood: 'thinking', look: -.7, ...(s.say ? hop(lt, sc._s[j], 14) : {}) })
    },
  }

  // ======================================================================
  // PAN: a wide canvas, and a camera that travels it without stopping. The
  // stations stand along a path; each step sends the camera on to one, a
  // marker running the path ahead of it, and between arrivals the camera
  // keeps drifting, so the scene reads as one move, not as slides.
  const PITCH = 860
  const stX = i => 700 + i * PITCH, stY = i => 560 + (i % 2 ? 74 : -58)
  const PAN = {
    stage: 'corner', ownCam: true,
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const bt = beatTimes(v, sc.steps.map(s => 2.6 + readT(s.note) * .7), .6, .4)
      sc._b = bt.at
      sc._ev = [{ t: .1, type: 'draw' }].concat(sc.steps.map((_, i) => ({ t: bt.at[i] + .5, type: 'pop' })))
      const dur = snap(bt.end + .4)
      sc._win = [[0, dur, 1]]
      sc._end = dur
      return dur
    },
    draw(t, lt, sc) {
      push(); translate(-K.SHIFT, 0)
      const n = sc.stations.length, bi = K.THUMB ? sc.steps.length - 1 : beatOf(sc, lt)
      // where the marker is along the stations (a fractional index), and the camera a little behind it
      const posAt = time => {
        let p = sc.steps[0].at
        for (let i = 0; i < sc.steps.length; i++) {
          const a = sc._b[i], prev = i ? sc.steps[i - 1].at : Math.max(0, sc.steps[0].at - .55)
          const next = sc._b[i + 1] ?? sc._end
          if (time < a) break
          // most of the way in the first 1.5 s, the rest spread over the whole beat
          const u = clamp((time - a) / 1.5), w = clamp((time - a) / Math.max(1.6, next - a))
          p = lerp(prev, sc.steps[i].at, .86 * ease(u) + .14 * w)
        }
        return p
      }
      const p = K.THUMB ? sc.steps[bi].at : posAt(lt), pc = K.THUMB ? Math.min(p, n - 1.4) : posAt(lt - .22)
      const wx = q => 700 + q * PITCH
      const camX = K.THUMB ? Math.max(W / 2, wx(pc) + 60) : wx(pc) + 60 + 26 * Math.sin(lt * .5)
      const pts = through(sc.stations.map((_, i) => [stX(i), stY(i) + 250]), 10)
      push(); translate(W / 2 - camX, 0)
      // ground marks at half speed behind the path: depth, and something for the eye to measure the move by
      push(); translate((camX - W / 2) * .5, 0)
      for (let i = -2; i < n * 3 + 4; i++) { boilSeed('pan-tick' + i); STYLE.line([[i * 300, 930], [i * 300 + 120, 930]], .7, STYLE.dim, { curv: 0 }) }
      pop()
      const L = lenOf(pts), frac = clamp((p + .0) / Math.max(1, n - 1))
      boilSeed('pan-path'); STYLE.line(pts, .8, STYLE.dim, { curv: 0 })
      const done = partial(pts, clamp(frac))
      if (done.length > 1) { boilSeed('pan-done'); STYLE.line(done, 1.8, ink2(), { curv: 0 }) }
      sc.stations.forEach((st, i) => {
        const reached = sc.steps.findIndex(s => s.at === i), t0 = reached >= 0 ? sc._b[reached] + .35 : 0
        const k = K.THUMB ? (reached >= 0 && reached <= bi ? 1 : .0) : reached >= 0 ? expoOut(seg(lt, t0, t0 + .6)) : expoOut(seg(lt, .2, .8))
        const x = stX(i), y = stY(i), w = 600, h = st.value ? 330 : 250, now = sc.steps[bi].at === i
        // the stop on the path under every station, there from the start
        boilSeed('pan-stop' + i); STYLE.shape(ellPts(x, y + 250, 16, 16, 16), { fill: k > 0 ? tone(st.tone || 'a') : bgCol(), op: .9, sw: 1 })
        if (k <= 0) return
        push(); translate(x, y - (1 - k) * 60); G.globalAlpha *= clamp(k * 2); focus(k * 1.2, 10)
        boilSeed('pan-card' + i)
        STYLE.shape(rrPts(-w / 2, -h / 2, w, h, 20), { fill: tone(st.tone || (now ? 'hi' : 'light')), op: now ? .7 : .4, sw: now ? 1.5 : 1 })
        boilSeed('pan-stem' + i); STYLE.line([[0, h / 2], [0, 250 - 18]], .9, STYLE.dim, { curv: 0 })
        let yy = -h / 2 + 56
        write(caps('label', st.label), -w / 2 + 36, yy, F('label', 30), STYLE.dim, { ls: 1.5 })
        if (st.value) { const vb = fitR('head', st.value, 104, 54, w - 72, 1); yy += vb.px * .98 + 18; write(vb.lines[0].text, -w / 2 + 36, yy, vb.f, STYLE.ink, { ls: vb.ls }) }
        if (st.sub) { const sb = fitR('body', st.sub, 36, 26, w - 72, 3); yy += sb.px * 1.5; sb.lines.forEach((l, li) => write(l.text, -w / 2 + 36, yy + li * sb.px * 1.18, sb.f, STYLE.ink)) }
        pop()
      })
      // the marker
      const mp = along(pts, L * clamp(frac))
      boilSeed('pan-marker'); STYLE.shape(ellPts(mp[0], mp[1], 26, 26, 20), { fill: P().hi, op: .95, sw: 1.4 })
      if (STYLE.dark) glow(mp[0], mp[1], 90, P().hi, .5)
      pop()
      if (sc.title) heading(lt, sc.title)
      folio(lt)
      note(lt, sc.steps[bi].note, sc._b[bi] + .4)
      pop()
      host(t, { mood: bi === sc.steps.length - 1 ? 'happy' : 'excited', look: -.7, ...hop(lt, sc._b[bi] + .4, 16) })
    },
  }

  // ======================================================================
  // SORT: a counted set, regrouped. `of` dots stand in bins; each state names
  // the bins and how many dots each holds, and between states every dot
  // travels its own arc to where it belongs next. The counts are the
  // storyboard's (so the article's); the engine only moves the dots.
  function sortLayout(sc, si) {
    const st = sc.states[si], nb = st.bins.length, x0 = 130, x1 = 1370, gap = 46
    const bw = (x1 - x0 - gap * (nb - 1)) / nb, top = (sc.title ? headBottom(sc.title) : 150) + 150, bot = 830
    const most = Math.max(...sc.states.flatMap(s => s.bins.map(b => b.n)), 1)
    // a dot size that fits the fullest bin of the narrowest state
    const minBw = Math.min(...sc.states.map(s => (x1 - x0 - gap * (s.bins.length - 1)) / s.bins.length))
    let r = 22
    for (; r > 4; r -= 1) { const cols = Math.min(Math.floor((minBw - 30) / (r * 2.5)), Math.ceil(Math.sqrt(most * 2.6))); if (cols > 0 && Math.ceil(most / cols) * r * 2.5 <= bot - top - 20) break }
    const pos = [], tops = []
    st.bins.forEach((b, bi) => {
      // a block a little wider than it is tall, however wide the bin
      const bx = x0 + bi * (bw + gap), cols = Math.max(1, Math.min(Math.floor((bw - 30) / (r * 2.5)), Math.ceil(Math.sqrt(Math.max(1, b.n) * 2.6)))), used = Math.min(cols, b.n) * r * 2.5
      for (let q = 0; q < b.n; q++) pos.push({ x: bx + (bw - used) / 2 + r * 1.25 + (q % cols) * r * 2.5, y: bot - 24 - r - Math.floor(q / cols) * r * 2.5, bin: bi })
      // where the bin's count sits: just over its dots
      tops.push(bot - 24 - Math.ceil(b.n / cols) * r * 2.5)
    })
    return { pos, r, bw, gap, x0, top, bot, tops }
  }
  const SORT = {
    beats: sc => sc.states.map(s => s.say),
    voiced: sc => sc.states.map(s => s.voice),
    terms: sc => sc.states.map(s => s.term || null),
    plan(sc, v) {
      const bt = beatTimes(v, sc.states.map(s => 3 + readT(s.note) * .7), .6, .42)
      sc._b = bt.at
      sc._L = sc.states.map((_, i) => sortLayout(sc, i))
      sc._ev = [{ t: .2, type: 'ticks', n: Math.min(24, sc.of), span: .9 }].concat(sc.states.slice(1).flatMap((_, i) => [{ t: bt.at[i + 1] + .2, type: 'whoosh' }, { t: bt.at[i + 1] + 1.5, type: 'ding' }]))
      sc._win = sc.states.map((_, i) => [bt.at[i] + (i ? .1 : -.3), bt.at[i] + 2.2, 1])
      return snap(bt.end + .45)
    },
    draw(t, lt, sc) {
      heading(lt, sc.title); folio(lt)
      const si = K.THUMB ? sc.states.length - 1 : beatOf(sc, lt), L = sc._L[si], prev = si ? sc._L[si - 1] : null, st = sc.states[si], t0 = sc._b[si]
      const N = L.pos.length, T = 1.0, lag = Math.min(.8 / Math.max(1, N), .03)
      // the bins: a floor line, the label under it, the count over the dots
      st.bins.forEach((b, bi) => {
        const bx = L.x0 + bi * (L.bw + L.gap), k = K.THUMB ? 1 : easeOut(seg(lt, t0 + (si ? .15 : .1), t0 + .6))
        push(); G.globalAlpha *= k
        boilSeed('sort-floor' + si + bi); STYLE.line([[bx, L.bot], [bx + L.bw, L.bot]], 1.4, STYLE.ink, { curv: 0 })
        const lb = fitR('body', b.label, 38, 26, L.bw - 10, 2)
        lb.lines.forEach((l, li) => write(l.text, bx + L.bw / 2, L.bot + 52 + li * lb.px * 1.15, lb.f, STYLE.ink, { align: 'center' }))
        pop()
        // the count lands when the dots have
        const kc = K.THUMB ? 1 : seg(lt, t0 + (si ? T + lag * N * .6 : .9), t0 + (si ? T + lag * N * .6 : .9) + .3)
        // a bin marked `rest` holds whatever is left: its dots are drawn, its count is not a figure the article gives
        if (kc > 0 && !b.rest) { push(); translate(bx + L.bw / 2, L.tops[bi] - 34); scale(lerp(1.5, 1, backOut(kc))); focus(kc * 1.4, 8); write(String(b.n), 0, 0, F('head', 92), b.tone === 'hi' || b.hl ? ink2() : STYLE.ink, { align: 'center', alpha: clamp(kc * 3) }); pop() }
      })
      // the dots: each on its own arc from where it stood
      for (let i = 0; i < N; i++) {
        const to = L.pos[i], from = prev ? prev.pos[i] : { x: to.x, y: to.y - 420 - (i % 7) * 26, bin: to.bin }
        const d = i * lag, k = K.THUMB ? 1 : ease(seg(lt, t0 + .15 + d, t0 + .15 + d + T))
        const lift = prev ? 90 + ((i * 37) % 80) : 0
        const x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k) - lift * 4 * k * (1 - k)
        const col = tone(st.bins[to.bin].tone || TONES[to.bin % 3]), was = prev ? tone(sc.states[si - 1].bins[from.bin].tone || TONES[from.bin % 3]) : col
        if (!prev && k <= 0) continue
        boilSeed('sort-dot' + i)
        STYLE.shape(ellPts(x, y, L.r, L.r, 14), { fill: k < 1 && was !== col ? mixCol(was, col, k) : col, op: .92, sw: .8 })
      }
      if (sc.unit && !K.THUMB) write(caps('mono', `${sc.of} ${sc.unit}`), 130, L.top - 96, F('mono', 26), STYLE.dim, { alpha: easeOut(seg(lt, .2, .6)) })
      note(lt, st.note, t0 + .5)
      const hot = st.bins.reduce((a, b, i) => (b.n > st.bins[a].n ? i : a), 0)
      host(t, { point: [L.x0 + hot * (L.bw + L.gap) + L.bw / 2, L.top + 60], mood: si ? 'surprised' : 'thinking', look: -.7, ...hop(lt, t0 + (si ? T + .3 : .5), 22) })
    },
  }

  SCENES.footage = FOOTAGE; SCENES.split = SPLIT; SCENES.pan = PAN; SCENES.sort = SORT
  K.MECH.push('pan', 'sort')
  K.STAGE2 = { planSteps, stepAt, clipPos, crop, framing, caption, chip, frameOf }
})()
