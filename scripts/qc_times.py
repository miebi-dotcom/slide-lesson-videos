"""List the frames to render for QC: the moments where slides go wrong, not just the settled one.

    python qc_times.py lesson.json OUT.json [--comp-id 2543]

Reads <work>/style.json and timeline.json. For every slide writes four times (main-comp seconds):
  early    just after the title has been read and bullet 1 has landed   (catches the first highlight, title clipping)
  middle   just after bullet 2 lands                                      (catches highlights that overlap or lag)
  full     every bullet in, a moment later                                (catches overflow, bullets too close to the header line)
  late     the last moment before the wipe covers the slide               (catches exit fades that run too early, anything that vanishes)
and for every cut, the frame half a second into the incoming slide (catches wipe and background colour mistakes).
OUT.json is the DATA for jsx/qc_frames.jsx, one entry per slide in "batches"; run it once per batch, then contact_sheet.py.
"""
import json
import sys

spec = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
comp = int(sys.argv[sys.argv.index("--comp-id") + 1]) if "--comp-id" in sys.argv else spec["mainId"]
work = spec["work"].rstrip("/") + "/"
style = json.load(open(work + "style.json", encoding="utf-8"))["scenes"]
tl = json.load(open(work + "timeline.json", encoding="utf-8"))["timeline"]
batches = []
for s in style:
    t0, D, rels = s["t"], s["D"], s.get("rels") or []
    if rels:
        times = [t0 + rels[0] + 1.2, t0 + (rels[1] if len(rels) > 1 else rels[0]) + 1.2, t0 + rels[-1] + 1.8, t0 + D - 1.1 - 0.15]
    else:
        times = [t0 + 3, t0 + D / 2, t0 + D - 1.1 - 0.15]
    batches.append({"compId": comp, "prefix": s["name"][:3], "outDir": spec["work"].rstrip("/") + "/qc/" + s["name"][:3],
                    "times": [round(t, 2) for t in times]})
cuts = [round(t + 0.5, 2) for _, t, _ in tl]
batches.append({"compId": comp, "prefix": "CUTS", "outDir": spec["work"].rstrip("/") + "/qc/cuts", "times": cuts})
json.dump({"batches": batches}, open(out, "w"), indent=1)
print("%d batches, %d frames" % (len(batches), sum(len(b["times"]) for b in batches)))
