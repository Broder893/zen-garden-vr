import json, re
NJ = json.load(open('narr/narr.json'))
# clip, ss, dur, speed, narration [(id, at)], caption?
P = [
 ('v01-open', 0, 8, 1.0, [('n01', 2.4)], False),
 ('v02-look-around', 1.5, 8.5, 1.0, [('n02', 0.6)], True),
 ('v03-plant', 0, 11, 1.2, [('n03', 0.8)], True),
 ('v04-water-grow', 0, 16, 1.6, [('n04', 1.0)], True),
 ('v05b-prune-close', 3, 13, 1.0, [('n05', 1.0)], True),
 ('v06-bloom', 4, 11, 1.25, [('n06', 3.5)], True),
 ('v15a-overwater', 0, 20, 1.6, [('n07', 2.5)], True),
 ('v15b-wrong-cut', 4, 11, 1.0, [('n08', 3.0)], True),
 ('v15c-recover', 0, 14, 1.3, [('n09', 1.5)], True),
 ('v07-breath-break', 0, 12.5, 1.25, [('n10', 1.0)], True),
 ('v07-breath-break', 36.5, 7.7, 1.0, [('n11', 2.0)], True),
 ('v08-season-spring', 1.5, 3.2, 1.0, [('n12', 0.4)], True),
 ('v09-season-summer', 1.5, 3.2, 1.0, [], False),
 ('v10-season-autumn', 1.5, 3.2, 1.0, [], False),
 ('v11-season-winter', 1.5, 3.2, 1.0, [], False),
 ('v12-night-rain', 1.5, 4.0, 1.0, [], False),
 ('v13-comfort', 0, 28, 2.0, [('n13', 0.8)], True),
 ('v14-onehand-gaze', 4, 6.5, 1.0, [('n14', 1.0)], True),
 ('v16-return', 0, 10, 1.25, [('n15', 1.0)], True),
 ('v17-shared-tree', 2, 8, 1.0, [('n16', 1.0)], True),
]
def caps_for(nid, at, seglen):
    text, dur = NJ[nid]['text'], NJ[nid]['sec']
    parts = [p.strip() for p in re.split(r'(?<=[.?!])\s+', text) if p.strip()]
    # merge very short first sentences into the next ("Care matters." + ...)
    merged = []
    for p in parts:
        if merged and len(merged[-1]) < 16: merged[-1] += ' ' + p
        else: merged.append(p)
    tot = sum(len(p) for p in merged); t = at; out = []
    for k, p in enumerate(merged):
        d = dur * len(p) / tot
        last = k == len(merged) - 1
        out.append([round(max(0.05, t - 0.1), 2), round(min(seglen - 0.05, t + d + (0.35 if last else -0.12)), 2), p]); t += d
    return out
SEG = []
for clip, ss, dur, sp, nar, cap in P:
    seglen = dur / sp
    caps = []
    if cap:
        for nid, at in nar: caps += caps_for(nid, at, seglen)
    SEG.append([clip, ss, dur, sp, caps, [list(x) for x in nar]])
# the seasons line runs over spring into summer: carry its caption across the dissolve
sp_caps = SEG[11][4]
over = [[0.05, round(c[1] - 3.2 + 0.9, 2), c[2]] for c in caps_for('n12', 0.4, 99) if c[1] > 3.2 - 0.9]
SEG[11][4] = [[a, min(b, 3.15), t] for a, b, t in sp_caps]
SEG[12][4] = [[a, max(a + 0.5, b), t] for a, b, t in over]
json.dump(SEG, open('seg3.json', 'w'), indent=1)
json.dump([11, 12, 13, 14, 15], open('seg3_seasons.json', 'w'))
for s in SEG: print(s[0], round(s[2] / s[3], 2), s[4], s[5])
