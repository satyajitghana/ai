"""Builds corpus.txt for toy_train.py: ASCII text from this site's own article prose (frontmatter, imports, tags and code fences stripped),
the first ~2.5 MB in filename order. Usage: python build_corpus.py /path/to/content/articles corpus.txt"""
import glob, re, sys
out, n = [], 0
for f in sorted(glob.glob(sys.argv[1] + "/*.mdx")):
    s = open(f, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"^---.*?---", "", s, flags=re.S)
    s = re.sub(r"^import .*$", "", s, flags=re.M)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"```.*?```", "", s, flags=re.S)
    s = re.sub(r"\n{3,}", "\n\n", s)
    out.append(s); n += len(s)
    if n > 2_500_000:
        break
open(sys.argv[2], "w").write("".join(c for c in "".join(out) if ord(c) < 128))
