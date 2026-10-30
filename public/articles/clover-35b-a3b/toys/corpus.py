# Picks 60 paragraphs (90-170 words, prose only) from this site's own articles, seed 11. Run from the repository root.
import re, glob, random, json
random.seed(11)
files=sorted(glob.glob('content/articles/*.mdx'))
random.shuffle(files)
paras=[]
for f in files:
    t=open(f).read()
    t=t.split('---',2)[-1]
    t=re.sub(r'```.*?```','',t,flags=re.S)
    t=re.sub(r'<[^>]+>','',t); t=re.sub(r'import .*','',t)
    for p in re.split(r'\n\s*\n',t):
        p=re.sub(r'[`*_#>\[\]]','',p); p=re.sub(r'\(https?://[^)]*\)','',p); p=re.sub(r'\$[^$]*\$','',p); p=re.sub(r'\s+',' ',p).strip()
        w=p.split()
        if 90<=len(w)<=170 and re.match(r'^[A-Z]',p) and p.count('|')==0 and sum(c.isdigit() for c in p)<25: paras.append(p)
    if len(paras)>=60: break
paras=paras[:60]
json.dump(paras,open('paras.json','w'),ensure_ascii=False)
print(len(paras), sum(len(p.split()) for p in paras)//len(paras))
print(paras[0][:300])
