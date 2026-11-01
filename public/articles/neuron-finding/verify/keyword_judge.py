"""Local OpenAI-compatible /chat/completions stand-in for neuron-finder's LLM judge: the SAME keyword rules as
finder_toy.py. trait_clear = keyword rule fires; gibberish = False (the tool already drops degenerate replies
before calling the judge). Listens on 127.0.0.1 only; sends nothing anywhere."""
import json, re, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
RULES = {
 "written in French": (r"\b(le|la|les|un|une|des|est|et|je|vous|nous|pour|dans|que|qui|pas|avec|mon|ma|sur)\b", 3),
 "outer space": (r"\b(space|planets?|stars?|galax\w+|orbit\w*|nebula\w*|universe|cosmos|cosmic|telescope\w*|astronom\w+|moon|solar)\b", 1),
 "focused on food": (r"\b(cook\w*|recipes?|bak(e|ing|ed)|sauce|flour|ingredients?|oven|simmer\w*|chef|dish(es)?|kitchen|delicious|flavou?r\w*|food|eat\w*|pasta)\b", 1),
}
calls = {"n": 0, "replies": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        user = body["messages"][-1]["content"]
        head, *reps = re.split(r"\n\nREPLY \d+:\n", user)
        rx, need = next(v for k, v in RULES.items() if k in head)
        grades = [dict(trait_clear=len(re.findall(rx, r, re.I)) >= need, gibberish=False) for r in reps]
        calls["n"] += 1; calls["replies"] += len(reps)
        out = {"choices": [{"message": {"content": json.dumps({"grades": grades})}}]}
        d = json.dumps(out).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(d))); self.end_headers(); self.wfile.write(d)
HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
