import json, os, time, resource
import torch
torch.set_num_threads(2)
from transformers import AutoModelForImageTextToText, AutoProcessor
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "results_pages.json")
MODEL = "xiaomi-research/Xiaomi-OCR-0"
P = {
 "doc": "Extract all information from the main body of the document image and represent it in markdown format, ignoring headers and footers. Tables should be expressed in OTSL format, formulas in the document should be represented using LATEX format, and the parsing should be organized according to the reading order.",
 "text": "Extract the text in the image.",
 "table": "Parse the table in the image into OTSL.",
 "formula": "Identify the formula in the image and represent it using LATEX format.",
}
JOBS = [("A_text.png", "text", 160), ("A_text.png", "doc", 200), ("B_table.png", "table", 200), ("C1_formula.png", "formula", 90), ("C2_formula.png", "formula", 90)]
t0 = time.time()
proc = AutoProcessor.from_pretrained(MODEL)
model = AutoModelForImageTextToText.from_pretrained(MODEL, dtype=torch.bfloat16).eval()
print(f"loaded {time.time()-t0:.0f}s rss {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e6:.2f} GB", flush=True)
res = json.load(open(OUT)) if os.path.exists(OUT) else {"model": MODEL, "runs": []}
done = {(r["image"], r["task"]) for r in res["runs"]}
from PIL import Image
for img, task, mx in JOBS:
    if (img, task) in done: continue
    im = Image.open(os.path.join(HERE, "pages", img)).convert("RGB")
    msgs = [{"role": "user", "content": [{"type": "image", "image": im}, {"type": "text", "text": P[task]}]}]
    inputs = proc.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")
    n_in = int(inputs["input_ids"].shape[1]); n_img = int((inputs["input_ids"] == model.config.image_token_id).sum())
    t1 = time.time()
    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=mx, do_sample=False)
    dt = time.time() - t1
    new = out[:, n_in:]; text = proc.batch_decode(new, skip_special_tokens=False)[0]
    res["runs"].append({"image": img, "task": task, "prompt_tokens": n_in, "image_tokens": n_img, "new_tokens": int(new.shape[1]), "sec": round(dt, 1), "text": text})
    json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)
    print(f"[{img} {task}] in={n_in} img_tok={n_img} new={new.shape[1]} {dt:.0f}s :: {text[:120]!r}", flush=True)
print("DONE rss", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, flush=True)
