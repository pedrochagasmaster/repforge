"""Semantic-similarity rating (Maier et al. 2025, App. A.4.3) on the panel's free-text answers.

pmf_r ∝ cos(anchor_r, response) − min_r cos(anchor_r, response); averaged over six anchor sets.
Deviation from the paper: local bge-small-en-v1.5 embeddings instead of OpenAI text-embedding-3-small,
and anchors rewritten for adoption / payment intent.
"""
import json, sys
import numpy as np
from fastembed import TextEmbedding

HERE = sys.argv[1]
USE = [
    ["It's very unlikely I'd use it.", "I probably wouldn't use it.", "I'm not sure whether I'd use it or not.", "I'd probably use it.", "It's very likely I'd use it."],
    ["I definitely would not start using this.", "I doubt I would start using this.", "I might or might not start using this.", "I think I would start using this.", "I would definitely start using this."],
    ["No, this is not for me.", "Probably not for me.", "Maybe, I'm undecided.", "Yes, I'd probably give it a go.", "Yes, absolutely, I'd use it."],
    ["I have no interest in switching to it.", "I have little interest in switching to it.", "I'm on the fence about switching to it.", "I'm fairly interested in switching to it.", "I'm very keen to switch to it."],
    ["I would not try it.", "I'm unlikely to try it.", "I could take it or leave it.", "I'm likely to try it.", "I will certainly try it and keep using it."],
    ["Not likely at all.", "Not very likely.", "Somewhat likely, somewhat unlikely.", "Quite likely.", "Extremely likely."],
]
PAY = [
    ["It's very unlikely I'd pay for it.", "I probably wouldn't pay for it.", "I'm not sure whether I'd pay for it or not.", "I'd probably pay for it.", "It's very likely I'd pay for it."],
    ["I definitely would not subscribe.", "I doubt I would subscribe.", "I might or might not subscribe.", "I think I would subscribe.", "I would definitely subscribe."],
    ["No, I won't pay for this.", "Probably not worth paying for.", "Maybe, I'm undecided about paying.", "Yes, I'd probably pay.", "Yes, absolutely, I'd pay."],
    ["I have no interest in the paid version.", "I have little interest in the paid version.", "I'm on the fence about the paid version.", "I'm fairly interested in the paid version.", "I'm very keen on the paid version."],
    ["I would never buy it.", "I'm unlikely to buy it.", "I could take it or leave it.", "I'm likely to buy it.", "I will certainly buy it."],
    ["Not likely at all.", "Not very likely.", "Somewhat likely, somewhat unlikely.", "Quite likely.", "Extremely likely."],
]

model = TextEmbedding(sys.argv[2] if len(sys.argv) > 2 else "BAAI/bge-small-en-v1.5")
def emb(texts):
    v = np.array(list(model.embed(texts)))
    return v / np.linalg.norm(v, axis=1, keepdims=True)

def ssr(texts, sets):
    t = emb(texts)
    pmfs = []
    for s in sets:
        sim = t @ emb(s).T                      # (n, 5)
        d = sim - sim.min(axis=1, keepdims=True)
        pmfs.append(d / d.sum(axis=1, keepdims=True))
    return np.mean(pmfs, axis=0)

res = json.load(open(f"{HERE}/results.json"))
personas = {p["id"]: p for p in json.load(open(f"{HERE}/personas.json"))}
R = np.arange(1, 6)
pu = ssr([r["intent_text"] for r in res], USE)
pp = ssr([r["pay_text"] for r in res], PAY)
for r, a, b in zip(res, pu, pp):
    r.update(personas[r["id"]])
    r["ssr_intent_pmf"] = [round(float(x), 4) for x in a]
    r["ssr_intent"] = round(float(a @ R), 3)
    r["ssr_pay_pmf"] = [round(float(x), 4) for x in b]
    r["ssr_pay"] = round(float(b @ R), 3)
json.dump(res, open(f"{HERE}/scored.json", "w"), ensure_ascii=False, indent=1)

def dist(vals):
    return [round(sum(1 for v in vals if v == k) / len(vals), 3) for k in R]
di = [r["direct_intent"] for r in res]; dp = [r["direct_pay"] for r in res]
print("n", len(res))
print("intent  SSR mean %.2f  pmf %s" % (pu.mean(0) @ R, np.round(pu.mean(0), 3).tolist()))
print("intent  DLR mean %.2f  dist %s" % (np.mean(di), dist(di)))
print("pay     SSR mean %.2f  pmf %s" % (pp.mean(0) @ R, np.round(pp.mean(0), 3).tolist()))
print("pay     DLR mean %.2f  dist %s" % (np.mean(dp), dist(dp)))
print("corr SSR~DLR respondent level: intent %.2f pay %.2f" % (
    np.corrcoef([r["ssr_intent"] for r in res], di)[0, 1], np.corrcoef([r["ssr_pay"] for r in res], dp)[0, 1]))
segs = {}
for r in res: segs.setdefault(r["segment"], []).append(r)
rows = []
for s, rs in segs.items():
    rows.append((s, len(rs), np.mean([r["ssr_intent"] for r in rs]), np.mean([r["direct_intent"] for r in rs]),
                 np.mean([r["ssr_pay"] for r in rs]), np.mean([r["direct_pay"] for r in rs])))
print("corr SSR~DLR segment means: intent %.2f pay %.2f" % (
    np.corrcoef([x[2] for x in rows], [x[3] for x in rows])[0, 1], np.corrcoef([x[4] for x in rows], [x[5] for x in rows])[0, 1]))
print("%-22s %3s %6s %6s %6s %6s" % ("segment", "n", "useSSR", "useDLR", "paySSR", "payDLR"))
for x in sorted(rows, key=lambda x: -x[3]):
    print("%-22s %3d %6.2f %6.2f %6.2f %6.2f" % x)
for key, name in (("incomeIdx", "income"), ("market", "market"), ("gender", "gender")):
    g = {}
    for r in res: g.setdefault(r[key], []).append(r)
    print(name, {k: (len(v), round(float(np.mean([r["direct_intent"] for r in v])), 2), round(float(np.mean([r["direct_pay"] for r in v])), 2)) for k, v in sorted(g.items(), key=lambda kv: str(kv[0]))})
ages = [(18, 24), (25, 34), (35, 49), (50, 99)]
print("age", {f"{a}-{b}": (sum(1 for r in res if a <= r["age"] <= b), round(float(np.mean([r["direct_intent"] for r in res if a <= r["age"] <= b])), 2)) for a, b in ages})
