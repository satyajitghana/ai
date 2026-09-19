// How a spreadsheet becomes something a transformer can attend over, in TabFM.
//
// The point of the picture is that there are two different token grids, not one.
// Stage 1-2 make one token per CELL (T x H of them) and attend over columns and
// rows alternately. Stage 3 throws that grid away and keeps 8 learned CLS slots
// per row, concatenated into a single 2048-d vector. Stage 4 — 98.8% of the
// weights — is an ordinary transformer over ONE token per row, and it never sees
// a cell.
//
// Every number here is read from classification/config.json on the Hugging Face
// checkpoint and from tabfm/src/pytorch/model.py. Server-rendered SVG, zero JS;
// all coordinates are integer arithmetic, so there is no Math.* to disagree
// between Node and the browser.

const HEAD = ["age", "job", "income"]
const RAW: string[][] = [
  ["34", "eng", "80k"],
  ["51", "mgr", "—"],
  ["29", "eng", "62k"],
  ["44", "?", "97k"],
]
const ENC: string[][] = [
  ["34", "0", "80000"],
  ["51", "1", "79667"],
  ["29", "0", "62000"],
  ["44", "-1", "97000"],
]
const Y = ["0", "1", "0", "?"]

export function TableToTokens() {
  const W = 880
  const H = 612
  const cw = 46
  const rh = 22
  const tx = 20
  const ty = 42

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        TabFM v1.0.0 · from a spreadsheet to one token per row
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Four stages. Stage zero: a four-row table with columns age, job and income is encoded outside the model — the categorical column job becomes integers by order of first appearance with unknown mapped to minus one, and the missing income value is mean-imputed. Stage one: each cell is grouped with the cells zero, one and three columns to its right, each of the three is expanded by thirty-two learned Fourier frequencies into sine and cosine pairs, projected to two hundred fifty-six dimensions by one of two linear maps chosen by whether the cell is categorical, and summed, giving one 256-dimensional vector per cell. Stage two: the cell grid is attended over twice along the column axis, where a column is an unordered set of rows attending through two hundred fifty-six induced points, and twice along the row axis with rotary position embeddings running over the columns. Stage three: eight learned CLS slots per row are concatenated into a single 2048-dimensional row vector, discarding the cell grid. Stage four: a twenty-four block transformer of width 2048 attends over one token per row, where every row attends only to the labelled context rows, and a two-layer head reads out ten class logits."
      >
        {/* ---------------- band 0: the table ---------------- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={tx} y={20}>0 · OUTSIDE THE MODEL — scikit-learn wrapper</text>
          <text x={tx + 300} y={20}>ordinal by first appearance · mean-impute · z-clip at 4</text>
        </g>

        {/* raw table */}
        <g>
          {HEAD.map((h, j) => (
            <text
              key={h}
              x={tx + j * cw + 6}
              y={ty - 6}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {h}
            </text>
          ))}
          <text x={tx + 3 * cw + 8} y={ty - 6} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            y
          </text>
          {RAW.map((r, i) => (
            <g key={i}>
              {r.map((v, j) => (
                <g key={j}>
                  <rect
                    x={tx + j * cw}
                    y={ty + i * rh}
                    width={cw - 3}
                    height={rh - 3}
                    rx={3}
                    className={
                      j === 1 ? "fill-muted/60 stroke-border" : "fill-background stroke-border"
                    }
                    strokeWidth={1}
                  />
                  <text
                    x={tx + j * cw + 8}
                    y={ty + i * rh + 13}
                    className="fill-foreground font-mono"
                    style={{ fontSize: 10 }}
                  >
                    {v}
                  </text>
                </g>
              ))}
              <rect
                x={tx + 3 * cw + 4}
                y={ty + i * rh}
                width={cw - 12}
                height={rh - 3}
                rx={3}
                className={i === 3 ? "fill-background stroke-foreground/40" : "fill-muted/40 stroke-border"}
                strokeWidth={i === 3 ? 1.5 : 1}
              />
              <text
                x={tx + 3 * cw + 16}
                y={ty + i * rh + 13}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {Y[i]}
              </text>
            </g>
          ))}
          <text x={tx} y={ty + 4 * rh + 14} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            3 context rows + 1 query row
          </text>
        </g>

        {/* arrow */}
        <line x1={tx + 200} y1={ty + 42} x2={tx + 238} y2={ty + 42} className="stroke-border" strokeWidth={1.5} />

        {/* encoded table */}
        <g>
          {ENC.map((r, i) => (
            <g key={i}>
              {r.map((v, j) => (
                <g key={j}>
                  <rect
                    x={tx + 250 + j * cw}
                    y={ty + i * rh}
                    width={cw - 3}
                    height={rh - 3}
                    rx={3}
                    className={
                      j === 1 ? "fill-muted/60 stroke-border" : "fill-background stroke-border"
                    }
                    strokeWidth={1}
                  />
                  <text
                    x={tx + 250 + j * cw + 5}
                    y={ty + i * rh + 13}
                    className="fill-foreground font-mono"
                    style={{ fontSize: 10 }}
                  >
                    {v}
                  </text>
                </g>
              ))}
            </g>
          ))}
          <text x={tx + 250} y={ty + 4 * rh + 14} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            cat_mask = [F, T, F] · d = 3
          </text>
        </g>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 452} y={ty + 14}>“eng”→0, “mgr”→1, “?”→−1 (unknown and missing share a code)</text>
          <text x={tx + 452} y={ty + 30}>the model never sees NaN: numerics are mean-imputed first,</text>
          <text x={tx + 452} y={ty + 46}>and any NaN that survives is mapped to the sentinel −100.0</text>
          <text x={tx + 452} y={ty + 68}>done 32 times with different column orders, label rotations</text>
          <text x={tx + 452} y={ty + 84}>and normalisers — that is the “single forward pass”</text>
        </g>

        <line x1={tx} y1={148} x2={W - 20} y2={148} className="stroke-border" strokeWidth={1} />

        {/* ---------------- band 1: cell embedding ---------------- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={tx} y={170}>1 · CELL EMBEDDER — 36,032 parameters, the only part that reads a cell</text>
        </g>

        {/* the feature group */}
        <g>
          {["x[t,h]", "x[t,h+1]", "x[t,h+3]"].map((lbl, i) => (
            <g key={lbl}>
              <rect
                x={tx}
                y={186 + i * 26}
                width={86}
                height={22}
                rx={3}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <text x={tx + 8} y={186 + i * 26 + 15} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                {lbl}
              </text>
              <line
                x1={tx + 86}
                y1={186 + i * 26 + 11}
                x2={tx + 130}
                y2={186 + i * 26 + 11}
                className="stroke-border"
                strokeWidth={1.5}
              />
            </g>
          ))}
          <text x={tx} y={182} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            offsets 2^i − 1, taken mod d
          </text>
        </g>

        {/* fourier */}
        <rect x={tx + 130} y={186} width={128} height={74} rx={4} className="fill-muted/40 stroke-border" strokeWidth={1} />
        <g className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 139} y={206}>sin(g·ω), cos(g·ω)</text>
          <text x={tx + 139} y={222}>ω: 32 learned freqs</text>
          <text x={tx + 139} y={238}>→ 64 dims each</text>
          <text x={tx + 139} y={254}>cats: a 2nd ω set</text>
        </g>
        <line x1={tx + 258} y1={222} x2={tx + 296} y2={222} className="stroke-border" strokeWidth={1.5} />

        <rect x={tx + 296} y={198} width={116} height={48} rx={4} className="fill-background stroke-foreground/40" strokeWidth={1.5} />
        <g className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 305} y={216}>Linear[64→256]</text>
          <text x={tx + 305} y={232}>sum over the 3</text>
        </g>
        <line x1={tx + 412} y1={222} x2={tx + 448} y2={222} className="stroke-border" strokeWidth={1.5} />

        <rect x={tx + 448} y={204} width={96} height={36} rx={4} className="fill-muted/60 stroke-border" strokeWidth={1} />
        <text x={tx + 457} y={226} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          cell → 256-d
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 580} y={190}>A cell&rsquo;s embedding is a fixed 3-way</text>
          <text x={tx + 580} y={205}>cross with columns h+1 and h+3.</text>
          <text x={tx + 580} y={220}>Move a column and every cell in</text>
          <text x={tx + 580} y={235}>the table changes. Nothing here is</text>
          <text x={tx + 580} y={250}>indexed by name — only by position.</text>
          <text x={tx + 580} y={268}>label: Embedding[10, 256], context</text>
          <text x={tx + 580} y={283}>rows only</text>
        </g>

        <line x1={tx} y1={282} x2={W - 20} y2={282} className="stroke-border" strokeWidth={1} />

        {/* ---------------- band 2: alternating attention ---------------- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={tx} y={304}>2 · ALTERNATING ATTENTION — 19.5M parameters total, 1.2% of the model</text>
        </g>

        {[
          { t: "col ×3", s: "a column as a set of rows", n: "256 induced pts · no positions", w: 148 },
          { t: "row ×3", s: "a row across its columns", n: "RoPE over the COLUMN axis", w: 148 },
          { t: "col ×3", s: "again, after row mixing", n: "masked to context rows", w: 148 },
          { t: "row ×3", s: "again; keep 8 CLS slots", n: "output 8 × 256", w: 158 },
        ].map((b, i) => {
          const x = tx + i * 166
          return (
            <g key={i}>
              <rect x={x} y={318} width={b.w} height={62} rx={5} className="fill-background stroke-border" strokeWidth={1.5} />
              <text x={x + 10} y={336} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {b.t}
              </text>
              <text x={x + 10} y={352} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {b.s}
              </text>
              <text x={x + 10} y={366} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {b.n}
              </text>
              {i < 3 ? (
                <line x1={x + b.w} y1={349} x2={x + 166} y2={349} className="stroke-border" strokeWidth={1.5} />
              ) : null}
            </g>
          )
        })}

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 676} y={332}>grid: [T, H, 256]</text>
          <text x={tx + 676} y={348}>T = every row,</text>
          <text x={tx + 676} y={364}>context and query</text>
        </g>

        <line x1={tx} y1={398} x2={W - 20} y2={398} className="stroke-border" strokeWidth={1} />

        {/* ---------------- band 3: row compression + ICL ---------------- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={tx} y={420}>3 · ROW COMPRESSION, then 4 · THE 1.62-BILLION-PARAMETER PART</text>
        </g>

        {/* CLS slots */}
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={tx + i * 20}
              y={436}
              width={17}
              height={17}
              rx={3}
              className="fill-muted/60 stroke-border"
              strokeWidth={1}
            />
          ))}
          <text x={tx} y={470} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            8 CLS slots per row
          </text>
          <text x={tx} y={484} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            concat → 2048-d
          </text>
        </g>
        <line x1={tx + 166} y1={444} x2={tx + 204} y2={444} className="stroke-border" strokeWidth={1.5} />

        {/* row vectors going into ICL */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x={tx + 204}
              y={430 + i * 24}
              width={92}
              height={19}
              rx={3}
              className={i === 3 ? "fill-background stroke-foreground/40" : "fill-muted/40 stroke-border"}
              strokeWidth={i === 3 ? 1.5 : 1}
            />
            <text x={tx + 211} y={430 + i * 24 + 13} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
              {i === 3 ? "query row" : `context ${i + 1}`}
            </text>
            <line
              x1={tx + 296}
              y1={430 + i * 24 + 9}
              x2={tx + 340}
              y2={430 + i * 24 + 9}
              className="stroke-border"
              strokeWidth={1.2}
            />
          </g>
        ))}

        <rect x={tx + 340} y={424} width={186} height={104} rx={5} className="fill-background stroke-foreground/40" strokeWidth={1.5} />
        <g className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 350} y={444}>24 blocks · d = 2048</text>
          <text x={tx + 350} y={460}>8 heads (head dim 256)</text>
          <text x={tx + 350} y={476}>SwiGLU ff 8192 · no RoPE</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          <text x={tx + 350} y={496}>mask is key-side only: every row</text>
          <text x={tx + 350} y={509}>attends to the context rows and</text>
          <text x={tx + 350} y={522}>nothing else — query rows never</text>
        </g>
        <text x={tx + 340} y={542} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          see each other, so this is not transductive
        </text>

        <line x1={tx + 526} y1={476} x2={tx + 566} y2={476} className="stroke-border" strokeWidth={1.5} />
        <rect x={tx + 566} y={452} width={128} height={48} rx={4} className="fill-muted/40 stroke-border" strokeWidth={1} />
        <g className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 575} y={470}>MLP[2048→4096→10]</text>
          <text x={tx + 575} y={488}>10 logits, hard cap</text>
        </g>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx + 706} y={438}>1,619,925,002</text>
          <text x={tx + 706} y={454}>of the model&rsquo;s</text>
          <text x={tx + 706} y={470}>1,639,444,522</text>
          <text x={tx + 706} y={486}>parameters live</text>
          <text x={tx + 706} y={502}>in this box, and</text>
          <text x={tx + 706} y={518}>none of them has</text>
          <text x={tx + 706} y={534}>ever seen a cell.</text>
        </g>

        <line x1={tx} y1={558} x2={W - 20} y2={558} className="stroke-border" strokeWidth={1} />
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={tx} y={578}>
            Shapes and counts read from classification/config.json and the safetensors header of
            google/tabfm-1.0.0-pytorch on 2026-09-19;
          </text>
          <text x={tx} y={594}>
            the staging is read from tabfm/src/pytorch/model.py, whose forward() runs
            cell → col → row → col → row → ICL in that order.
          </text>
        </g>
      </svg>
    </figure>
  )
}
