"""Build the permissively licensed activation corpus: WikiText-2 raw (English Wikipedia, CC BY-SA 3.0)
+ small French/Spanish/German Wikipedia samples (wikimedia/wikipedia, CC BY-SA 3.0 / GFDL).
Output: $NL_SCRATCH/corpus.pt  {ids: LongTensor[N,128], lang: list[str]}  (position 0 of each chunk is a sink and is
excluded from every statistic).  Not committed; only the derived numbers are."""
import os, json, urllib.request, random, io
from data_common import *

CH = 128
random.seed(0)
tok, _ = None, None
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained(MODEL)


def get(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def chunks_from_text(texts, n_chunks):
    ids = []
    for t in texts:
        ids.extend(tok(t, add_special_tokens=False).input_ids)
    out = [ids[i:i + CH] for i in range(0, len(ids) - CH + 1, CH)]
    random.shuffle(out)
    return out[:n_chunks]


# English: WikiText-103 raw train rows via the datasets-server (Wikipedia, CC BY-SA 3.0)
paras = []
for off in range(0, 40000, 1000):  # 40 pages of 100 rows spread over the split
    u = f"https://datasets-server.huggingface.co/rows?dataset=Salesforce/wikitext&config=wikitext-103-raw-v1&split=train&offset={off*10}&length=100"
    try:
        rows = json.loads(get(u))["rows"]
    except Exception as e:
        print("skip", off, e); continue
    paras += [r["row"]["text"].strip() for r in rows if len(r["row"]["text"].strip()) > 300 and not r["row"]["text"].strip().startswith("=")]
print("paragraphs", len(paras))
random.shuffle(paras)
en = chunks_from_text(paras, 440)  # ~56k tokens

allc, lang = list(en), ["en"] * len(en)
for lg, cfg in (("fr", "20231101.fr"), ("es", "20231101.es"), ("de", "20231101.de")):
    txt = []
    for off in (0, 100, 200, 300):
        u = f"https://datasets-server.huggingface.co/rows?dataset=wikimedia/wikipedia&config={cfg}&split=train&offset={off}&length=100"
        try:
            rows = json.loads(get(u))["rows"]
        except Exception as e:
            print("skip", lg, off, e); continue
        txt += [r["row"]["text"][:6000] for r in rows]
    c = chunks_from_text(txt, 36)  # ~4.6k tokens each
    allc += c; lang += [lg] * len(c)
    print(lg, len(c))
ids = torch.tensor(allc)
print("chunks", ids.shape, "tokens", ids.numel(), "scored", ids.shape[0] * (CH - 1))
torch.save({"ids": ids, "lang": lang}, os.path.join(SCRATCH, "corpus.pt"))
