// paint.js — a Canvas2D painter with ClaudeAnimationBase's drawing API.
//
// The base (brand-crew/skills/claude-animation-base) paints with p5.brush on
// WebGL. On a machine with no GPU that runs in software, and a frame with a few
// watercolour fills took 44-91 s here. This file keeps the base's API — paint(),
// inkLine(), rectPts(), glow(), boilSeed(), push/translate/… — but paints in
// Canvas2D. (The watercolour style does use real p5.brush, through
// brushbake.js, which paints each shape once and reuses the painting; these
// washes are its fallback when there is no WebGL.)
//
//   wash       flat pigment, opaque
//   fill       watercolour: the outline deformed a dozen times at low opacity
//              and glazed, so layers pool at the edges
//   hatch      rough parallel strokes clipped to the shape
//   ink        a tapered ribbon along the path with ragged edges and a
//              pressure curve; 'dry' is five broken bristle lines instead
//
// Randomness is the base's: jit()/random() read a stream reseeded twelve times
// a second (boil). Watercolour deformation is seeded from the shape itself, so a
// wash that doesn't move doesn't re-boil — which is also what keeps a painted
// film small enough to ship.
//
// World coordinates are the base's 1920x1080; the canvas is 1280x720. A style
// (styles.js) owns what is under the world (paper, a chalkboard, a blueprint
// grid) and what is over it (grain, dust), and may paint the whole frame at a
// lower resolution and scale it up with hard edges (the pixel style).
const W = 1920, H = 1080, OUT_W = 1280, OUT_H = 720;
let SCALE = OUT_W / W;
const PROJECT = window.PROJECT || { bpm: 120, offset: 0, duration: 30 };
const BPM = PROJECT.bpm, BEAT = 60 / BPM, OFF = PROJECT.offset || 0, BOIL = 12;
let DUR = PROJECT.duration;
const TAU = Math.PI * 2;
const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', clayDk: '#A84D33', clayLt: '#F2A283',
  night: '#1F2550', indigo: '#2F3C7A', rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58',
  teal: '#3A9C98', violet: '#7B5CA8', cream: '#FFF5E2', sky: '#8EC3E6'
};

// ---------- the base's helpers, verbatim in behaviour ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); if (x === 0 || x === 1) return x; const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bpOf = t => (t - OFF) / BEAT;
const jit = a => (random() * 2 - 1) * a;
let BOILN = 0;
const boilSeed = key => { let h = 2166136261; for (const c of key + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619); randomSeed(h >>> 0); };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const easeIn = x => Math.pow(clamp(x), 3);
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const ring = (t, evs, k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);
const onTwos = t => Math.floor(t * 12 + 1e-6) / 12;
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
function jump(t, t0, t1, h = 3) {
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
function take(t, t0, amt = 1) {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
function stroll(t, t0, t1, x0, x1, u) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: d, view: moving ? 'q' : 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .5 : 0 };
}

// ---------- seeded randomness (p5's random/randomSeed, as the base uses them) ----------
let _s = 1;
function randomSeed(n) { _s = (n >>> 0) || 1; }
function random(a, b) {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[Math.floor(r * a.length)];
  if (b === undefined) return r * a;
  return a + r * (b - a);
}
function noiseSeed() {}
function seededRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// a shape's own seed: stays put while the shape stays put
function shapeSeed(pts, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < pts.length; i += Math.max(1, pts.length >> 3)) {
    h = Math.imul(h ^ Math.round(pts[i][0] * 2), 16777619); h = Math.imul(h ^ Math.round(pts[i][1] * 2), 16777619);
  }
  return h >>> 0;
}

// ---------- canvas and the p5 transform calls ----------
let CV = null, G = null, paperC = null, grainC = null, glowC = null;
function push() { G.save(); }
function pop() { G.restore(); }
function translate(x, y) { G.translate(x, y); }
function rotate(a) { G.rotate(a); }
function scale(x, y) { G.scale(x, y === undefined ? x : y); }
function resetMatrix() { G.setTransform(SCALE, 0, 0, SCALE, 0, 0); }

let CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y) {
  if (!CAM) return [x, y];
  const c = Math.cos(CAM.rot), s = Math.sin(CAM.rot), dx = (x - CAM.cx) * CAM.zoom, dy = (y - CAM.cy) * CAM.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- geometry (the base's) ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
          [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
          [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 28, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  const p = [], sg = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= sg; i++) { const a = a0 + i / sg * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}
function starPts(cx, cy, r, inner = .38, n = 4, rot = -Math.PI / 2) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p;
}
function through(P, n = 6) {
  if (P.length < 3) return P.slice();
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
// closed Catmull-Rom through a polygon
function throughClosed(P, n = 5) {
  if (P.length < 3) return P.slice();
  const out = [], L = P.length;
  for (let i = 0; i < L; i++) {
    const p0 = P[(i - 1 + L) % L], p1 = P[i], p2 = P[(i + 1) % L], p3 = P[(i + 2) % L];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  return out;
}
function ribbon(P, w0, w1 = w0) {
  const C = through(P), n = C.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / Math.max(1, n - 1)) / 2;
    Lp.push([C[i][0] - dy / d * w, C[i][1] + dx / d * w]); Rp.push([C[i][0] + dy / d * w, C[i][1] - dx / d * w]);
  }
  return Lp.concat(Rp.reverse());
}
function heartPts(cx, cy, r, n = 22) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push([cx + r * .062 * 16 * Math.pow(Math.sin(a), 3), cy - r * .062 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]); }
  return p;
}

// ---------- the painting itself ----------
function hexA(col, a) {
  if (col[0] !== '#') return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}
function pathOf(pts, closed) {
  G.beginPath(); G.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) G.lineTo(pts[i][0], pts[i][1]);
  if (closed) G.closePath();
}
function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
// midpoint displacement, the watercolour trick (after Tyler Hobbs)
function deform(pts, depth, amp, r) {
  let P = pts;
  for (let d = 0; d < depth; d++) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      out.push(a);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const g = (r() + r() + r() - 1.5) * .8;   // roughly gaussian
      const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      const m = amp * g * Math.min(1, len / 60);
      out.push([(a[0] + b[0]) / 2 + nx * m, (a[1] + b[1]) / 2 + ny * m]);
    }
    P = out; amp *= .55;
  }
  return P;
}
function watercolour(pts, col, op, bleed, tex, border) {
  const bb = bbox(pts), size = Math.max(40, Math.min(bb.w, bb.h, 900));
  const r = seededRng(shapeSeed(pts, 7));
  const base = deform(pts, 2, size * (.06 + bleed * .5), r);
  const layers = size > 500 ? 7 : 10;
  // layers glaze with normal blending: they converge on the pigment's own
  // colour instead of multiplying it darker with every pass
  const a = 1 - Math.pow(1 - clamp(op / 255), 1 / (layers * .72));
  G.save();
  for (let l = 0; l < layers; l++) {
    const P = deform(base, 3, size * (.03 + bleed * .35), r);
    pathOf(P, true);
    G.fillStyle = hexA(col, a); G.fill();
    if (border > 0) { G.lineWidth = 2.5 + size * .006; G.strokeStyle = hexA(col, a * border * 1.4); G.stroke(); }
  }
  // pigment texture: a few pale blooms inside the wash
  if (tex > .05) {
    G.globalCompositeOperation = 'screen';
    pathOf(base, true); G.clip();
    const n = Math.round(tex * 10);
    for (let i = 0; i < n; i++) {
      const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h, rr = size * (.08 + r() * .22);
      const gr = G.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(255,250,240,${.07 * tex})`); gr.addColorStop(1, 'rgba(255,250,240,0)');
      G.fillStyle = gr; G.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
  G.restore();
}
function hatchFill(pts, h) {
  const bb = bbox(pts), d = h.d || 10, ang = h.a || .8, c = h.c || PAL.ink, w = h.w || 1;
  G.save(); pathOf(pts, true); G.clip();
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, R = Math.hypot(bb.w, bb.h) / 2 + d;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let o = -R; o <= R; o += d) {
    const x0 = cx + ca * -R - sa * o, y0 = cy + sa * -R + ca * o, x1 = cx + ca * R - sa * o, y1 = cy + sa * R + ca * o;
    strokePath([[x0, y0], [(x0 + x1) / 2 + jit(1.5), (y0 + y1) / 2 + jit(1.5)], [x1, y1]], false, w * .55, c, 'inkfine', 0);
  }
  G.restore();
}
// brushes: width per unit of sw, pressure start→end, edge raggedness, opacity
const BR = {
  ink: { w: 4.6, p: [1.15, .75], rag: .22, op: .93 },
  inkfine: { w: 2.5, p: [1.1, .8], rag: .15, op: .92 },
  dry: { w: 11, p: [1, .6], rag: .5, op: .45, dry: true },
  marker: { w: 5, p: [1, 1], rag: .08, op: .9 },
  HB: { w: 1.6, p: [1, .8], rag: .1, op: .75 }, '2B': { w: 2.2, p: [1, .8], rag: .12, op: .8 },
  charcoal: { w: 4, p: [1, .7], rag: .4, op: .6, dry: true }, pen: { w: 1.8, p: [1, 1], rag: .05, op: .95 },
  cpencil: { w: 2.2, p: [1, .8], rag: .2, op: .7 }, rotring: { w: 1.6, p: [1, 1], rag: .02, op: 1 }, spray: { w: 6, p: [1, 1], rag: .6, op: .3, dry: true },
};
function resample(P, closed, step) {
  const Q = closed ? P.concat([P[0]]) : P, out = [Q[0]];
  let carry = 0;
  for (let i = 1; i < Q.length; i++) {
    const a = Q[i - 1], b = Q[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= L) { const k = d / L; out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); d += step; }
    carry = L - (d - step);
  }
  if (!closed) out.push(Q[Q.length - 1]);
  return out;
}
function strokePath(pts, closed, sw, col, brName = 'ink', curv = 0) {
  if (!pts || pts.length < 2) return;
  const B = BR[brName] || BR.ink;
  let P = curv > 0 ? (closed ? throughClosed(pts, 5) : through(pts, 6)) : pts;
  P = resample(P, closed, 3);
  const n = P.length;
  if (n < 2) return;
  const base = B.w * sw;
  if (B.dry) {
    // bristles: broken parallel lines
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) / 2 * base * .45 + jit(base * .08);
      G.lineWidth = Math.max(.7, base * (.12 + random() * .12)); G.lineCap = 'round';
      G.strokeStyle = hexA(col, B.op * (.6 + random() * .4));
      G.beginPath(); let on = false;
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        const x = P[i][0] - dy / d * off, y = P[i][1] + dx / d * off;
        if (random() < .08) { on = false; continue; }
        if (!on) { G.moveTo(x, y); on = true; } else G.lineTo(x, y);
      }
      G.stroke();
    }
    return;
  }
  const L = [], R = [];
  let wob = 0;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    wob = wob * .7 + (random() - .5) * B.rag;
    const press = closed ? lerp(B.p[0], B.p[1], .5 + .5 * Math.sin(u * TAU)) : lerp(B.p[0], B.p[1], u) * (closed ? 1 : Math.min(1, u * 8 + .35, (1 - u) * 8 + .35));
    const w = Math.max(.6, base * press * (1 + wob)) / 2;
    L.push([P[i][0] - dy / d * w, P[i][1] + dx / d * w]); R.push([P[i][0] + dy / d * w, P[i][1] - dx / d * w]);
  }
  G.beginPath();
  G.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) G.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) G.lineTo(R[i][0], R[i][1]);
  G.closePath();
  G.fillStyle = hexA(col, B.op); G.fill();
}

// paint(pts, o): the base's one call per painted shape
function paint(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const shape = o.curv ? throughClosed(pts, 5) : pts;
  if (o.fill) watercolour(shape, o.fill, o.fillOp ?? 170, o.bleed ?? .1, o.tex ?? .4, o.border ?? .35);
  if (o.wash) { G.save(); pathOf(shape, true); G.fillStyle = hexA(o.wash, (o.washOp ?? 255) / 255); G.fill(); G.restore(); }
  if (o.hatch) hatchFill(shape, { d: o.hatch.d, a: o.hatch.a, c: o.hatch.c, w: o.hatch.w });
  if (o.ink !== null) strokePath(pts, true, o.sw ?? 1, o.ink || PAL.ink, o.br || 'ink', o.curv || 0);
}
function inkLine(pts, sw = 1, col = PAL.ink, br = 'ink', curv = .5) { strokePath(pts, false, sw, col, br, curv); }

// ---------- light and full-frame effects ----------
function glow(x, y, r, col = '#FFC766', a = 1) {
  if (a <= 0 || r < 1) return;
  const rr = r * (1 + jit(.03));
  G.save(); G.globalCompositeOperation = 'lighter';
  const gr = G.createRadialGradient(x, y, 0, x, y, rr);
  [[0, 1], [.18, .8], [.45, .32], [.75, .08], [1, 0]].forEach(([s, al]) => gr.addColorStop(s, hexA(col, al * .6 * clamp(a))));
  G.fillStyle = gr; G.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  G.restore();
}
function flash(k, col = '#FFFDF6') { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }
function irisShape(pts, col = PAL.ink) {
  G.save(); G.beginPath(); G.rect(-200, -200, W + 400, H + 400);
  G.moveTo(pts[0][0], pts[0][1]); for (let i = pts.length - 1; i >= 0; i--) G.lineTo(pts[i][0], pts[i][1]); G.closePath();
  G.fillStyle = col; G.fill('evenodd'); G.restore();
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, ink: null }); else irisShape(ellPts(cx, cy, r, r, 40), col); }

// ---------- lettering ----------
let LETTERS = [];
function letter(txt, x, y, size, color, o = {}) {
  if (CAM && !o.screen) { [x, y] = toScreen(x, y); size *= CAM.zoom; o = { ...o, rot: (o.rot || 0) + CAM.rot }; if (o.font) o.font = o.font.replace(/(\d+(\.\d+)?)px/, (m, v) => (v * CAM.zoom) + 'px'); }
  LETTERS.push({ txt, x, y, size, color, ...o });
}
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  letter(txt, x, y, size, color, { pop: age * 5, rot: (o.rot ?? -.08) + Math.sin(age * 20) * .03 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), ...o });
}
function drawLetters(c) {
  for (const L of LETTERS) {
    const k = L.pop != null ? backOut(L.pop) : 1; if (k <= .01) continue;
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot || 0); c.scale(k, k); c.globalAlpha = L.alpha ?? 1;
    c.font = L.font || `${L.size}px "Permanent Marker", cursive`;
    c.textAlign = L.align || 'center'; c.textBaseline = L.base || 'middle';
    c.letterSpacing = (L.ls || 0) + 'px';
    if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = L.size * .12; c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    if (L.ink !== false) { c.fillStyle = L.shadow || PAL.ink; c.fillText(L.txt, L.size * .045, L.size * .055); }
    c.fillStyle = L.color; c.fillText(L.txt, 0, 0);
    c.restore();
  }
}
function flushBrush() {}
function flushLetters() {
  if (!LETTERS.length) return;
  G.save(); G.setTransform(SCALE, 0, 0, SCALE, 0, 0); drawLetters(G); G.restore(); LETTERS = [];
}

// ---------- frame ----------
let T = 0, MAIN = null, LO = null;
function paintInit(canvas) {
  CV = canvas; CV.width = OUT_W; CV.height = OUT_H;
  MAIN = G = CV.getContext('2d');
}
function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// paintFrame(t, world, S): the style's ground, the world, the letters, the
// style's overlay; at S.lowres, all of it on a small canvas scaled up hard-edged
function paintFrame(t, world, S) {
  T = t; LETTERS = []; CAM = null;
  let w = OUT_W, h = OUT_H
  if (S.lowres) {
    if (!LO || LO.width !== S.lowres[0]) { LO = document.createElement('canvas'); LO.width = S.lowres[0]; LO.height = S.lowres[1] }
    G = LO.getContext('2d'); w = LO.width; h = LO.height
  } else G = MAIN
  SCALE = w / W
  G.setTransform(1, 0, 0, 1, 0, 0); G.globalCompositeOperation = 'source-over'; G.globalAlpha = 1; G.imageSmoothingEnabled = true
  S.ground(G, w, h)
  G.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  BOILN = Math.floor(t * BOIL + 1e-6); boilSeed('frame');
  world(t);
  flushLetters();
  G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1
  S.over(G, w, h)
  G.globalCompositeOperation = 'source-over';
  if (S.lowres) {
    if (S.quantize) S.quantize(G, w, h)
    MAIN.setTransform(1, 0, 0, 1, 0, 0); MAIN.imageSmoothingEnabled = false
    MAIN.drawImage(LO, 0, 0, OUT_W, OUT_H); G = MAIN; SCALE = OUT_W / W
  }
}
