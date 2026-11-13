// story2/bespoke.js — bespoke scenes for Story v2: story/bespoke.js, plus a few
// motion helpers on the kit (arc, morph, travel, cam; see kit() below).
//
// story/bespoke.js — bespoke scenes: drawing code written for one film.
//
// A story storyboard may hold
//
//   { "type": "custom", "module": "buckets", "title": "...", "mechanism": true,
//     "params": { ... }, "steps": [ { "say": "...", ... }, ... ] }
//
// and its picture is drawn by brand-crew/skills/explainer-films/custom/<key>/<module>.js,
// a plain script the renderer loads into the page before the film (render.mjs
// prepMedia). The module calls BESPOKE.define({ plan?, draw }) once; draw(k) is
// handed a kit `k` (below) every frame. Its steps are beats like any other
// scene's: one `say` each, the picture timed to it.
//
// The rules the runtime enforces while a module draws:
//   - a module never makes a number that reaches the screen. Every string
//     drawn through write() (k.text, labels, the heading, the caption) is
//     audited: if it holds a digit, it must be a piece of one of the scene's
//     own strings (its title, a string in params, a step's note or term or any
//     other string a step carries), cut at word edges, never through a
//     number. The checker holds those strings to the article. So "45,056"
//     shows only if the storyboard wrote "45,056", and a counter ticking from
//     "8,192" to "45,056" cannot exist: values switch, they do not count.
//     Numbers in params are geometry (positions, sizes, how many dots), never
//     text.
//   - a scene whose params do not say "data": "article" is a simulation (toy
//     clusters, a synthetic trajectory), and is stamped Illustrative. With
//     "data": "article", every number in params must be one the article
//     prints (the checker enforces it), and there is no stamp.
//   - no Math.random: deterministic frames only. k.rng(seed) is seeded by the
//     film and the seed you give it.
(() => {
  const K = window.STORY
  const { SCENES, MECH, readT, snap, bgCol, tone, textOn, focus, beatTimes, beatOf, host, hop, folio, heading, note } = K
  const P = () => STYLE.P
  const DEFS = {}
  const SOUNDS = new Set(['pop', 'boing', 'whoosh', 'slide', 'scratch', 'write', 'draw', 'flow', 'ticks', 'ding', 'thunk', 'grow', 'count', 'tick', 'print'])
  const numTokens = s => (String(s).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, ''))

  window.BESPOKE = {
    loading: null,
    define(def) {
      if (!this.loading) throw new Error('BESPOKE.define: no module is loading (the renderer sets BESPOKE.loading)')
      if (typeof def?.draw !== 'function') throw new Error(`${this.loading}: a bespoke module needs draw(k)`)
      DEFS[this.loading] = def
    },
    has: id => !!DEFS[id],
  }
  const idOf = sc => `${K.SB.slug}/${sc.module}`
  const defOf = sc => { const d = DEFS[idOf(sc)]; if (!d) throw new Error(`custom scene: module ${idOf(sc)} is not loaded`); return d }

  // every string the storyboard gave the scene to show (not `say`, which is heard)
  function sources(sc) {
    if (sc._src) return sc._src
    const out = [], walk = (v, key) => { if (typeof v === 'string') { if (key !== 'say') out.push(v) } else if (Array.isArray(v)) v.forEach(x => walk(x, key)); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk)) }
    walk(sc.title, 'title'); walk(sc.params, 'params'); walk(sc.steps, 'steps')
    return (sc._src = out)
  }
  // a drawn string with a digit must be a piece of a source string, cut at
  // word edges and never through a number ("2,048" may not show as "048")
  const NUMCH = /[\d.,]/
  function declared(str, srcs) {
    // compared without case: a style may set a role in capitals
    const s = String(str).trim().toLowerCase()
    if (!/\d/.test(s)) return true
    for (const src0 of srcs) {
      const src = src0.toLowerCase()
      let i = src.indexOf(s)
      while (i >= 0) {
        const a = src[i - 1], b = src[i + s.length]
        const cutA = a !== undefined && (/\d/.test(a) || (NUMCH.test(a) && /\d/.test(src[i - 2] || '') && /\d/.test(s[0])))
        const cutB = b !== undefined && (/\d/.test(b) || (NUMCH.test(b) && /\d/.test(src[i + s.length + 1] || '') && /\d/.test(s[s.length - 1])))
        if (!cutA && !cutB) return true
        i = src.indexOf(s, i + 1)
      }
    }
    return false
  }

  // The kit a module draws with. Coordinates are the frame's: 1920x1080, the
  // host presenting from x ~1420 rightward, so content keeps to x 110-1380 and,
  // under a heading, y ~260-940 (the bottom strip is the caption's).
  function kit(t, lt, sc, dur) {
    const bi = K.THUMB ? sc.steps.length - 1 : beatOf(sc, lt)
    const at = i => sc._b[Math.max(0, Math.min(sc._b.length - 1, i))]
    const k = {
      t, lt, dur, step: bi, s: sc.steps[bi] || {}, steps: sc.steps, params: sc.params || {}, thumb: K.THUMB, mini: K.MINI,
      W: 1920, H: 1080, top: sc.title ? K.headBottom(sc.title) + 60 : 200,
      // time: when step i starts, how long since, eased progress over d seconds
      at, since: (i = bi) => lt - at(i),
      p: (i = bi, d = .6, delay = 0) => (K.THUMB ? (i <= bi ? 1 : 0) : clamp((lt - at(i) - delay) / d)),
      span: (a, b) => (K.THUMB ? 1 : seg(lt, a, b)),
      ease, easeOut, expoOut, backOut, lerp, clamp, seg,
      rng: seed => seededRng(hashStr(K.SB.slug + '|' + sc.module + '|' + seed)),
      // the style
      get P() { return P() }, ink: STYLE.ink, dim: STYLE.dim, paper: bgCol(), dark: !!STYLE.dark, pixel: STYLE.name === 'pixel',
      tone, textOn, mix: mixCol,
      // painting: the style's own brush, fills and type
      shape: (pts, o = {}) => STYLE.shape(pts, o),
      line: (pts, sw = 1, col = STYLE.ink, o = {}) => STYLE.line(pts, sw, col, { curv: 0, ...o }),
      flat: (pts, col, a = 1) => STYLE.flat(pts, col, a),
      hl: (x, y, w, h, col, kk) => STYLE.hl(x, y, w, h, col || P().hi, kk),
      glow: (x, y, r, col, a) => { if (STYLE.dark) glow(x, y, r, col || P().a, a ?? .6) },
      seed: key => boilSeed(sc.module + ':' + key),
      circle: (x, y, r, n = 24) => ellPts(x, y, r, r, n), ellipse: (x, y, rx, ry, n = 24) => ellPts(x, y, rx, ry, n),
      rect: (x, y, w, h) => rectPts(x, y, w, h), rrect: (x, y, w, h, r = 14) => rrPts(x, y, w, h, r),
      through: (pts, n = 6) => through(pts, n), partial: K.partial, along: K.along, lenOf: K.lenOf,
      arrow: (pts, col = STYLE.ink, sw = 1, kk = 1) => { const q = K.partial(pts, kk); if (q.length > 1) { STYLE.line(q, sw, col, { curv: 0 }); if (kk > .92) K.arrowHead(q, col, sw) } },
      push, pop, translate, rotate, scale, focus: (kk, px) => focus(kk, px),
      alpha: a => { G.globalAlpha *= clamp(a) },   // inside push()/pop()
      // type: fitted to a width, in a role (head, body, mono, label)
      text(str, x, y, o = {}) {
        const b = fitR(o.role || 'body', String(str), o.size || 34, o.min || Math.min(o.size || 34, 20), o.maxW || 1200, o.lines || 1)
        const lh = b.px * (o.lh || 1.15)
        b.lines.forEach((l, i) => write(l.text, x, y + i * lh, b.f, o.col || STYLE.ink, { align: o.align, alpha: o.alpha, ls: b.ls }))
        return { w: Math.max(...b.lines.map(l => l.width)), h: b.lines.length * lh, px: b.px }
      },
      measure: (str, o = {}) => { const b = fitR(o.role || 'body', String(str), o.size || 34, o.min || Math.min(o.size || 34, 20), o.maxW || 1200, o.lines || 1); return { w: Math.max(...b.lines.map(l => l.width)), h: b.lines.length * b.px * (o.lh || 1.15), px: b.px, lines: b.lines.length } },
      // the host: where it points, how it feels, whether it hops on this step
      point: null, mood: null, hop: true,
      // Story v2: motion a module can ask for by name.
      //   k.arc(p0, p1, lift, t)   where a thing is, t of the way from p0 to p1 along an arc `lift` px high
      //   k.morph(a, b, t, n)      a path t of the way from path a to path b (both resampled to n points),
      //                            so one shape can become another
      //   k.travel(pts, t, len)    the stretch of a path a traveller has just covered: its head at t,
      //                            a tail `len` px behind it (draw it with k.line; the head is the last point)
      //   k.cam(cx, cy, z)         inside push()/pop(): look at (cx, cy) of a canvas wider than the frame,
      //                            zoomed z; move it a little every frame and the scene is one continuous shot
      //   k.shift                  how far the engine has slid this scene's content for its staging
      arc: (p0, p1, lift, tt) => { const q = clamp(tt); return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - lift * 4 * q * (1 - q)] },
      morph: (a, b, tt, n = 48) => { const q = clamp(tt), La = K.lenOf(a), Lb = K.lenOf(b), out = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), pa = K.along(a, La * u), pb = K.along(b, Lb * u); out.push([lerp(pa[0], pb[0], q), lerp(pa[1], pb[1], q)]) } return out },
      travel: (pts, tt, len = 160) => { const L = K.lenOf(pts), d1 = L * clamp(tt), d0 = Math.max(0, d1 - len), out = []; for (let i = 0; i <= 12; i++) out.push(K.along(pts, lerp(d0, d1, i / 12))); return out },
      cam: (cx, cy, z = 1) => { translate(W / 2 - K.SHIFT, H / 2); scale(z); translate(-cx, -cy) },
      get shift() { return K.SHIFT }, get stage() { return K.STAGE },
      // the diagram engine, for a module that wants nodes and arrows
      STORY: K,
    }
    return k
  }

  const CUSTOM = {
    beats: sc => sc.steps.map(s => s.say),
    plan(sc, v) {
      const def = defOf(sc), pl = (def.plan && def.plan(sc.params || {}, sc.steps)) || {}
      const mins = sc.steps.map((s, i) => Math.max((pl.min && pl.min[i]) || 0, 2.2 + readT(s.note) * .7))
      const bt = beatTimes(v, mins, pl.lead ?? .7, .42)
      sc._b = bt.at
      const ev = (pl.events || sc.steps.map((_, i) => ({ step: i, at: .15, type: 'pop' })))
      sc._ev = ev.filter(e => SOUNDS.has(e.type)).map(e => ({ ...e, t: (bt.at[e.step || 0] || 0) + (e.at || 0), step: undefined, at: undefined }))
      const end = snap(bt.end + .45)
      // motion: arrivals smeared on every beat; 'all' paints the whole scene on ones
      sc._win = [[0, 1, 5]].concat(sc.steps.map((_, i) => [bt.at[i] - .04, bt.at[i] + 1.2, 5]))
      if (pl.motion === 'all') sc._win.push([0, end, 1])
      else for (const m of pl.motion || []) sc._win.push([(bt.at[m.step || 0] || 0) + (m.from || 0), (bt.at[m.step || 0] || 0) + (m.to ?? 2), m.samples || 1])
      return end
    },
    draw(t, lt, sc, dur) {
      const def = defOf(sc), k = kit(t, lt, sc, dur), srcs = sources(sc)
      if (sc.title) heading(lt, sc.title)
      folio(lt)
      // the audit: every string drawn while the module paints, and no dice
      const W0 = window.write, R0 = Math.random
      window.write = function (str, ...a) {
        if (!declared(str, srcs)) throw new Error(`custom scene ${sc.module}: drew "${str}", which is not a piece of any of the scene's strings. A module never makes a number: put the text in params or a step, where the checker holds it to the article`)
        return W0.call(this, str, ...a)
      }
      Math.random = () => { throw new Error(`custom scene ${sc.module}: Math.random; use k.rng(seed)`) }
      try { push(); def.draw(k); pop() } finally { window.write = W0; Math.random = R0 }
      if (k.s.note) note(lt, k.s.note, k.at(k.step) + .4)
      // a simulation says so
      if ((sc.params || {}).data !== 'article') { const [sx, sy] = typeof def.stampAt === 'function' ? def.stampAt(k) : def.stampAt || [1250, Math.max(250, k.top - 40)]; K.stamp(lt, .9, 'Illustrative', sx, sy) }
      if (def.host !== false) host(t, { point: k.point || [1000, 560], mood: k.mood || (k.step === sc.steps.length - 1 ? 'happy' : 'thinking'), look: -.7, ...(k.hop ? hop(lt, k.at(k.step), 18) : {}) })
    },
  }
  SCENES.custom = CUSTOM
  MECH.push('custom')
})()
