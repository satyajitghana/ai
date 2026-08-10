// Deterministic math for anything whose result reaches the DOM.
//
// The ECMAScript spec does not require exp, log, pow, the trig family, hypot or
// atan2 to be correctly rounded — it only asks for an "implementation-dependent
// approximation". Node and Chrome can therefore disagree by one unit in the last
// place, and React stringifies numbers verbatim into SVG attributes, so a value
// computed during SSR can serialize as "56.515249336140094" while the same
// expression in the browser produces "56.51524933614009". React sees different
// attribute strings and reports a hydration mismatch.
//
// The fix is to round the transcendental result once, at the point it is
// produced. Everything downstream — +, -, *, /, sqrt, Math.round, comparisons —
// is exact per IEEE-754 and identical on every engine, so pinning the source is
// enough; there is no need to round every coordinate at the point of use.
//
// 12 significant digits is far more precision than any rendered geometry needs
// and comfortably below a double's ~15.95, so it swallows ULP noise while
// changing nothing visible. toPrecision is exactly specified (unlike the
// functions above), which is what makes this deterministic rather than merely
// shorter.

const det = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(12)) : v)

export const mexp = (x: number): number => det(Math.exp(x))
export const mexpm1 = (x: number): number => det(Math.expm1(x))
export const mlog = (x: number): number => det(Math.log(x))
export const mlog2 = (x: number): number => det(Math.log2(x))
export const mlog10 = (x: number): number => det(Math.log10(x))
export const mlog1p = (x: number): number => det(Math.log1p(x))
export const mpow = (x: number, y: number): number => det(Math.pow(x, y))
export const mcbrt = (x: number): number => det(Math.cbrt(x))
export const mhypot = (...xs: number[]): number => det(Math.hypot(...xs))

export const msin = (x: number): number => det(Math.sin(x))
export const mcos = (x: number): number => det(Math.cos(x))
export const mtan = (x: number): number => det(Math.tan(x))
export const masin = (x: number): number => det(Math.asin(x))
export const macos = (x: number): number => det(Math.acos(x))
export const matan = (x: number): number => det(Math.atan(x))
export const matan2 = (y: number, x: number): number => det(Math.atan2(y, x))

export const msinh = (x: number): number => det(Math.sinh(x))
export const mcosh = (x: number): number => det(Math.cosh(x))
export const mtanh = (x: number): number => det(Math.tanh(x))
export const masinh = (x: number): number => det(Math.asinh(x))
export const macosh = (x: number): number => det(Math.acosh(x))
export const matanh = (x: number): number => det(Math.atanh(x))
