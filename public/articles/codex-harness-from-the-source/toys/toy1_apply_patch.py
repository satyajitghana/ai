"""Toy 1: a Python port of Codex's apply_patch matching and apply loop, run on 18 test patches.

Ported from (openai/codex @ 67f0994b, paths under codex-rs/apply-patch/src):
  seek_sequence.rs:12-104  four passes: exact, rstrip, trim, Unicode-normalised trim
  file_update.rs:63-155    compute_replacements (context seek, no-old-lines append, trailing-empty retry)
  streaming_parser.rs      chunk grammar: '@@ ctx', ' ' context, '+' new, '-' old, empty line = context, EOF marker
  invocation.rs            verify step: every Update hunk is derived (read + matched) BEFORE any write
  lib.rs:438               apply loop: per hunk, derive then write; a write error leaves earlier hunks applied
Our re-implementation, not the Rust code; line endings are LF only.
"""
import json, re, sys

PASS_NAMES = ["exact", "rstrip", "trim", "unicode-normalised trim"]

def _norm(s):
    out = []
    for c in s.strip():
        if c in "‐‑‒–—―−": out.append("-")
        elif c in "‘’‚‛": out.append("'")
        elif c in "“”„‟": out.append('"')
        elif c in "            　": out.append(" ")
        else: out.append(c)
    return "".join(out)

def seek_sequence(lines, pattern, start, eof):
    """Returns (index, pass_number) or (None, None). Passes scan the WHOLE remaining file each."""
    if not pattern: return start, 0
    if len(pattern) > len(lines): return None, None
    search_start = max(len(lines) - len(pattern), start) if eof and len(lines) >= len(pattern) else start
    last = len(lines) - len(pattern)
    cmps = [lambda a, b: a == b, lambda a, b: a.rstrip() == b.rstrip(), lambda a, b: a.strip() == b.strip(), lambda a, b: _norm(a) == _norm(b)]
    for pnum, cmp in enumerate(cmps):
        for i in range(search_start, last + 1):
            if all(cmp(lines[i + k], pattern[k]) for k in range(len(pattern))):
                return i, pnum
    return None, None

class Chunk:
    def __init__(self, ctx=None):
        self.ctx, self.old, self.new, self.ctx_idx, self.eof = ctx, [], [], [], False
    def push_ctx(self, s):
        self.ctx_idx.append((len(self.old), len(self.new))); self.old.append(s); self.new.append(s)

class ParseError(Exception): pass

def parse_patch(text, lenient=True):
    lines = text.split("\n")
    if lenient and len(lines) >= 4 and re.match(r"^<<['\"]?\w+['\"]?$", lines[0]) and lines[-1].strip() in ("EOF", "") :
        # heredoc wrapper: <<'EOF' ... EOF
        inner = lines[1:]
        while inner and inner[-1].strip() == "": inner.pop()
        if inner and inner[-1].strip() == "EOF": inner.pop()
        lines = inner
    elif not lenient and lines[0].startswith("<<"):
        raise ParseError("The first line of the patch must be '*** Begin Patch'")
    while lines and lines[-1] == "": lines.pop()
    if not lines or lines[0].strip() != "*** Begin Patch": raise ParseError("The first line of the patch must be '*** Begin Patch'")
    if lines[-1].strip() != "*** End Patch": raise ParseError("The last line of the patch must be '*** End Patch'")
    hunks, i = [], 1
    while i < len(lines) - 1:
        l = lines[i]
        if l.startswith("*** Add File: "):
            path, body = l[len("*** Add File: "):], []
            i += 1
            while i < len(lines) - 1 and lines[i].startswith("+"): body.append(lines[i][1:]); i += 1
            hunks.append(("add", path, "\n".join(body) + "\n"))
        elif l.startswith("*** Delete File: "):
            hunks.append(("delete", l[len("*** Delete File: "):])); i += 1
        elif l.startswith("*** Update File: "):
            path, move, chunks = l[len("*** Update File: "):], None, []
            i += 1
            if i < len(lines) - 1 and lines[i].startswith("*** Move to: "): move = lines[i][len("*** Move to: "):]; i += 1
            while i < len(lines) - 1 and not lines[i].startswith("*** "):
                u = lines[i]
                if u == "@@": chunks.append(Chunk())
                elif u.startswith("@@ "): chunks.append(Chunk(u[3:]))
                elif u == "":
                    if not chunks: chunks.append(Chunk())
                    chunks[-1].push_ctx("")
                elif u[0] == " ":
                    if not chunks: chunks.append(Chunk())
                    chunks[-1].push_ctx(u[1:])
                elif u[0] == "+":
                    if not chunks: chunks.append(Chunk())
                    chunks[-1].new.append(u[1:])
                elif u[0] == "-":
                    if not chunks: chunks.append(Chunk())
                    chunks[-1].old.append(u[1:])
                else: raise ParseError(f"Unexpected line in update hunk: {u!r}")
                i += 1
            if i < len(lines) - 1 and lines[i] == "*** End of File":
                chunks[-1].eof = True; i += 1
            hunks.append(("update", path, move, chunks))
        else: raise ParseError(f"Unexpected hunk header: {l!r}")
    return hunks

class ApplyError(Exception): pass

def compute_replacements(orig, path, chunks, trace):
    reps, line_index = [], 0
    for ch in chunks:
        if ch.ctx is not None:
            idx, p = seek_sequence(orig, [ch.ctx], line_index, False)
            if idx is None: raise ApplyError(f"Failed to find context '{ch.ctx}' in {path}")
            trace.append(("context", PASS_NAMES[p], idx)); line_index = idx + 1
        if not ch.old:
            reps.append((len(orig), 0, list(ch.new))); continue
        pattern, new = list(ch.old), list(ch.new)
        found, p = seek_sequence(orig, pattern, line_index, ch.eof)
        if found is None and pattern and pattern[-1] == "":
            pattern = pattern[:-1]
            if new and new[-1] == "": new = new[:-1]
            found, p = seek_sequence(orig, pattern, line_index, ch.eof)
        if found is None:
            raise ApplyError(f"Failed to find expected lines in {path}:\n" + "\n".join(ch.old))
        trace.append(("old-lines", PASS_NAMES[p], found))
        old_start = new_start = 0
        for oc, nc in ch.ctx_idx:
            if oc >= len(pattern) or nc >= len(new): break
            if old_start != oc or new_start != nc:
                reps.append((found + old_start, oc - old_start, new[new_start:nc]))
            old_start, new_start = oc + 1, nc + 1
        if old_start != len(pattern) or new_start != len(new):
            reps.append((found + old_start, len(pattern) - old_start, new[new_start:]))
        line_index = found + len(pattern)
    return reps

def derive(content, path, chunks, trace):
    orig = content.split("\n")
    if orig and orig[-1] == "": orig.pop()
    reps = compute_replacements(orig, path, chunks, trace)
    new = list(orig)
    for start, n_old, new_lines in sorted(reps, key=lambda r: r[0], reverse=True):
        new[start:start + n_old] = new_lines
    if not new or new[-1] != "": new.append("")
    return "\n".join(new)

class FS:
    def __init__(self, files, fail_writes=()): self.files, self.fail = dict(files), set(fail_writes); self.log = []
    def write(self, p, c):
        if p in self.fail: raise OSError(f"write failed: {p}")
        self.files[p] = c; self.log.append(("write", p))
    def remove(self, p): del self.files[p]; self.log.append(("remove", p))

def apply_patch(text, fs, verified=True, lenient=True):
    trace = []
    hunks = parse_patch(text, lenient)
    paths = [h[1] for h in hunks]
    if verified and len(set(paths)) != len(paths): raise ApplyError("multiple operations target the same path")
    if verified:   # invocation.rs: derive every update hunk first, so match errors surface before any write
        for h in hunks:
            if h[0] == "update": derive(fs.files[h[1]], h[1], h[3], [])
    for h in hunks:
        if h[0] == "add": fs.write(h[1], h[2])
        elif h[0] == "delete": fs.remove(h[1])
        else:
            _, path, move, chunks = h
            new = derive(fs.files[path], path, chunks, trace)
            if move: fs.write(move, new); fs.remove(path)
            else: fs.write(path, new)
    return trace

APP = """def load(path):
    with open(path) as f:
        return f.read()

def save(path, data):
    with open(path, "w") as f:
        f.write(data)

# TODO – handle errors
def main():
    data = load("in.txt")
    save("out.txt", data.upper())
"""
DUP = """def first():
    x = compute()
    return None

def second():
    y = compute()
    return None
"""
SHADOW = """def a():
    x = 1 
    return x

def b():
    x = 1
    return x
"""
TABS = """class K:
    def run(self):
        if self.ok:
            return value
        return value
"""
Q = 'print(“hi”)\nprint("done")\n'
P = lambda *ls: "\n".join(ls) + "\n"

CASES = [
 ("exact match", {"app.py": APP},
  P("*** Begin Patch","*** Update File: app.py","@@ def load(path):","-        return f.read()","+        return f.read().strip()","*** End Patch"),
  {"app.py": APP.replace("return f.read()", "return f.read().strip()")}),
 ("trailing whitespace in file", {"app.py": APP.replace("def main():", "def main():  ")},
  P("*** Begin Patch","*** Update File: app.py","@@","-def main():",'-    data = load("in.txt")',"+def main():",'+    data = load("input.txt")',"*** End Patch"),
  {"app.py": APP.replace("def main():", "def main():  ").replace('load("in.txt")','load("input.txt")').replace("def main():  ","def main():")}),
 ("indent differs (2 vs 4 spaces)", {"app.py": APP},
  P("*** Begin Patch","*** Update File: app.py","@@ def load(path):","-  with open(path) as f:","+  with open(path, encoding='utf-8') as f:","*** End Patch"),
  {"app.py": APP.replace("with open(path) as f:", "with open(path, encoding='utf-8') as f:")}),
 ("en dash in file, hyphen in patch", {"app.py": APP},
  P("*** Begin Patch","*** Update File: app.py"," # TODO - handle errors","-def main():","+def main() -> None:","*** End Patch"),
  {"app.py": APP.replace("def main():", "def main() -> None:")}),
 ("curly quotes in file", {"q.py": Q},
  P("*** Begin Patch","*** Update File: q.py",'-print("hi")','+print("bye")',"*** End Patch"),
  {"q.py": 'print("bye")\nprint("done")\n'}),
 ("two identical lines, no context", {"d.py": DUP},
  P("*** Begin Patch","*** Update File: d.py","-    return None","+    return 0","*** End Patch"),
  {"d.py": DUP.replace("y = compute()\n    return None", "y = compute()\n    return 0")}),
 ("two identical lines, @@ context", {"d.py": DUP},
  P("*** Begin Patch","*** Update File: d.py","@@ def second():","-    return None","+    return 0","*** End Patch"),
  {"d.py": DUP.replace("y = compute()\n    return None", "y = compute()\n    return 0")}),
 ("exact elsewhere beats fuzzy here", {"s.py": SHADOW},
  P("*** Begin Patch","*** Update File: s.py","@@ def a():","-    x = 1","+    x = 2","*** End Patch"),
  {"s.py": SHADOW.replace("    x = 1 \n", "    x = 2\n")}),
 ("same trim, different nesting", {"t.py": TABS},
  P("*** Begin Patch","*** Update File: t.py","@@ def run(self):","-return value","+return value + 1","*** End Patch"),
  {"t.py": TABS.replace("        return value\n", "        return value + 1\n")}),
 ("context line absent", {"app.py": APP},
  P("*** Begin Patch","*** Update File: app.py","@@ def missing():","-pass","+pass","*** End Patch"), None),
 ("old lines absent", {"app.py": APP},
  P("*** Begin Patch","*** Update File: app.py","@@ def load(path):","-        return g.read()","+        return f.read()","*** End Patch"), None),
 ("end-of-file hunk", {"d.py": DUP},
  P("*** Begin Patch","*** Update File: d.py","-    return None","+    return 0","*** End of File","*** End Patch"),
  {"d.py": DUP.replace("y = compute()\n    return None", "y = compute()\n    return 0")}),
 ("add + delete + move", {"app.py": APP, "old.txt": "x\n"},
  P("*** Begin Patch","*** Add File: notes.md","+# notes","*** Delete File: old.txt","*** Update File: app.py","*** Move to: lib/app.py","@@ def load(path):","-        return f.read()","+        return f.read().strip()","*** End Patch"),
  {"notes.md": "# notes\n", "lib/app.py": APP.replace("return f.read()", "return f.read().strip()"), "old.txt": None, "app.py": None}),
 ("heredoc-wrapped patch (lenient)", {"app.py": APP},
  "<<'EOF'\n" + P("*** Begin Patch","*** Update File: app.py","@@ def load(path):","-        return f.read()","+        return f.read().strip()","*** End Patch") + "EOF\n",
  {"app.py": APP.replace("return f.read()", "return f.read().strip()")}),
 ("two files, second hunk mismatches (verified)", {"a.txt": "one\n", "b.txt": "two\n"},
  P("*** Begin Patch","*** Update File: a.txt","-one","+ONE","*** Update File: b.txt","-nope","+NOPE","*** End Patch"), None),
 ("two files, second hunk mismatches (apply loop alone)", {"a.txt": "one\n", "b.txt": "two\n"},
  P("*** Begin Patch","*** Update File: a.txt","-one","+ONE","*** Update File: b.txt","-nope","+NOPE","*** End Patch"), None),
 ("two files, second write fails", {"a.txt": "one\n", "b.txt": "two\n"},
  P("*** Begin Patch","*** Update File: a.txt","-one","+ONE","*** Update File: b.txt","-two","+TWO","*** End Patch"), None),
 ("same path twice", {"a.txt": "one\n"},
  P("*** Begin Patch","*** Update File: a.txt","-one","+two","*** Update File: a.txt","-two","+three","*** End Patch"), None),
]

rows = []
for name, files, patch, intent in CASES:
    verified = "(apply loop alone)" not in name
    fs = FS(files, fail_writes=("b.txt",) if "write fails" in name else ())
    err, trace = None, []
    try: trace = apply_patch(patch, fs, verified=verified)
    except (ApplyError, ParseError, OSError) as e: err = f"{type(e).__name__}: {str(e).splitlines()[0]}"
    changed = sorted(p for p in set(fs.files) | set(files) if fs.files.get(p) != files.get(p))
    passes = sorted({t[1] for t in trace if t[0] != "context"} | {t[1] for t in trace if t[0] == "context" and t[1] != "exact"}, key=lambda x: PASS_NAMES.index(x))
    if err: verdict = "error, files changed: " + (", ".join(changed) if changed else "none")
    elif intent is None: verdict = "applied"
    else:
        same = all(fs.files.get(p) == c for p, c in intent.items()) and set(changed) == set(intent)
        verdict = "applied as intended" if same else "APPLIED, NOT AS INTENDED"
    if err and changed: verdict = "PARTIAL: error after writing " + ", ".join(changed)
    ex = None
    if verdict.startswith("APPLIED, NOT"):
        p0 = changed[0]
        ex = {"file": p0, "before": files.get(p0), "after": fs.files.get(p0), "intended": intent.get(p0), "patch": patch}
    rows.append({"case": name, "passes_used": passes or ["exact"], "result": verdict, "error": err,
                 "changed": changed, "verified_precheck": verified, "example": ex})

if "--verbose" in sys.argv:
    for name, files, patch, intent in CASES:
        pass
json.dump(rows, open("toy1_apply_patch.json", "w"), indent=1)
w = max(len(r["case"]) for r in rows)
for r in rows: print(f"{r['case']:{w}}  {'+'.join(r['passes_used']):28}  {r['result']}" + (f"   [{r['error']}]" if r['error'] else ""))
n_applied = sum(1 for r in rows if r["result"].startswith("applied") or r["result"].startswith("APPLIED"))
n_wrong = sum(1 for r in rows if r["result"].startswith("APPLIED, NOT"))
print(f"\n{len(rows)} patches: {n_applied} applied, of which {n_wrong} not as intended; "
      f"{sum(1 for r in rows if r['result'].startswith('PARTIAL'))} partial; "
      f"{sum(1 for r in rows if r['result'].startswith('error'))} clean errors")
