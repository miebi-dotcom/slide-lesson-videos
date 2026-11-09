"""QA gate 2 - turns the dump from jsx/precheck.jsx into ERROR / WARN lines.

    python precheck_ae.py lesson.json ae_dump.json [--palette palette.json]

Checks, per slide: the text obeys the house rules (British spelling, sentence case, full stops), nothing from the template
is left behind, text sits inside the safe margins, text colour matches the PDF and contrasts with what is behind it,
all-caps is off, no expression is broken, no layer stops before its comp ends, the background is the planned one, no footage is missing.
Per video: every slide starts and ends where the plan says, one wipe per cut, music present and cut to length.
Exit code 1 when there are errors.  Fix them, rerun precheck.jsx, repeat until clean; only then render QC frames.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text_rules as TR  # noqa: E402
from pdf_palette import contrast  # noqa: E402

MARGIN_X, MARGIN_BOTTOM = 60, 1010
LEFTOVER = re.compile(r"lorem|your text|text here|placeholder|replace|bullet \d|type here|click to|sample", re.I)


def kind_of(layer):
    if layer.endswith("Number"):
        return None
    if layer in ("Title", "Lesson Title"):
        return "topic"                       # the lesson topic stays in capitals
    if layer == "Course Name":
        return "keep"                        # the subtopic line is never touched
    if layer == "Thank You" or layer.endswith(" Title"):
        return "title"
    if "Header" in layer:
        return "header"
    return "bullet"


def norm(s):
    return re.sub(r"\s+", " ", s.replace("\r", " ")).strip().lower()


def strings(o, acc):
    if isinstance(o, str):
        acc.add(norm(o))
    elif isinstance(o, dict):
        for v in o.values():
            strings(v, acc)
    elif isinstance(o, list):
        for v in o:
            strings(v, acc)
    return acc


def close(a, b, tol=22):
    return a and b and all(abs(x - y) <= tol for x, y in zip(a, b))


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    spec = json.load(open(argv[0], encoding="utf-8"))
    dump = json.load(open(argv[1], encoding="utf-8"))
    pal = json.load(open(argv[argv.index("--palette") + 1], encoding="utf-8")) if "--palette" in argv else None
    work = spec["work"].rstrip("/") + "/"
    # scenes are matched by their page tag (S02, S13...) so a renamed comp still matches its plan entry
    scenes_plan = {s["name"][:3]: s for s in json.load(open(work + "scenes.json", encoding="utf-8"))["scenes"]}
    custom_plan = {s["name"][:3]: s for s in json.load(open(work + "custom.json", encoding="utf-8"))["slides"]}
    tl = json.load(open(work + "timeline.json", encoding="utf-8"))
    errors, warns = [], []
    E, W = errors.append, warns.append

    allscene_text = [t["text"] for s in dump["scenes"] for t in s["texts"]]
    cfg = dict(spec.get("text", {}))
    cfg["acronyms"] = sorted(set(cfg.get("acronyms", [])) | set(TR.learn_acronyms([x.replace("\r", " ") for x in allscene_text])))
    bgnames = spec.get("bgNames", {})
    icon_file = {}
    hi = work + "header_icons.json"
    if os.path.exists(hi):
        for x in json.load(open(hi, encoding="utf-8"))["scenes"]:
            icon_file[x["name"][:3]] = os.path.basename(x["file"])
    else:
        W("header_icons.json is missing: the header icon cannot be checked against the PDF (run extract_icon.py, then plan_lesson.py)")
    pages_bg = {int(k): v.get("bg") for k, v in spec["pages"].items()}

    for s in dump["scenes"]:
        nm = s["name"]
        page = int(nm[1:3])
        plan_strings = strings(scenes_plan.get(nm[:3], {}).get("texts", {}), set()) | strings(custom_plan.get(nm[:3], {}), set())
        plan_strings.add(norm(spec.get("course", "")))
        pal_p = pal["pages"].get(str(page)) if pal else None
        for t in s["texts"]:
            txt = t["text"].replace("\r", " ").strip()
            if not txt:
                continue
            k = kind_of(t["layer"])
            tag = "%s / %s" % (nm, t["layer"])
            if k == "keep":
                if txt != spec.get("course", "").strip():
                    E("%s: the subtopic line was changed: %r, the PDF has %r (it must stay exactly as the PDF has it)" % (tag, txt, spec.get("course")))
                continue
            if k:
                fixed, ch = TR.fix(txt, k, cfg)
                if fixed != txt:
                    E("%s: text breaks the rules (%s): %r -> %r" % (tag, ", ".join(sorted({c[0] for c in ch})), txt, fixed))
            if LEFTOVER.search(txt):
                E("%s: looks like template text left behind: %r" % (tag, txt))
            elif plan_strings and norm(txt) not in plan_strings and not any(norm(txt) in p or p in norm(txt) for p in plan_strings if len(p) > 6):
                W("%s: text is not in the plan: %r" % (tag, txt[:60]))
            if (t["allCaps"] or t["smallCaps"]) and k != "topic":
                E("%s: all-caps / small-caps is on, so sentence case will not show (run precheck.jsx with fixCaps true)" % tag)
            if t["left"] < MARGIN_X or t["right"] > 1920 - MARGIN_X:
                E("%s: text runs outside the side margins (x %d to %d)" % (tag, t["left"], t["right"]))
            if t["bottom"] > MARGIN_BOTTOM:
                E("%s: text runs too low (bottom y %d, limit %d)" % (tag, t["bottom"], MARGIN_BOTTOM))
            if t["size"] < 24 and k in ("bullet", "header"):
                W("%s: text is only %d pt" % (tag, t["size"]))
            if pal_p and t["fill"] and t["layer"] != "Course Name":
                want = pal_p["title"] if t["layer"] in ("Title", "Lesson Title") else pal_p["text"]   # card titles and numbers follow the body text colour
                if want and not close(t["fill"], want):
                    E("%s: text colour %s is not the PDF's %s" % (tag, t["fill"], want))
                ref = pal_p["bg"] if k == "topic" else (pal_p["card"] or pal_p["bg"])   # the topic sits on the page, not on a card
                if ref and k != "title":
                    c = contrast(t["fill"], ref)
                    if c < 3:
                        E("%s: text contrast %.1f against %s is under 3:1" % (tag, c, ref))
        if s["bg"] and bgnames.get(pages_bg.get(page)) and s["bg"] != bgnames[pages_bg[page]]:
            E("%s: background is '%s', the plan says '%s'" % (nm, s["bg"], bgnames[pages_bg[page]]))
        if nm[:3] != "S01":
            ic = s.get("icon")
            want = icon_file.get(nm[:3])
            if not ic:
                W("%s: no header icon layer" % nm)
            elif ic["layer"] != "Header Icon (PDF)" or not ic["isPicture"]:
                E("%s: the header icon is still the template's stand-in: run header_icon.jsx with the icon from the PDF" % nm)
            elif want and ic["source"] != want:
                E("%s: header icon is %s, the PDF page uses %s" % (nm, ic["source"], want))
        for e in s["early"]:
            if e["layer"] == "BG":
                E("%s: background stops at %.1f s but the comp runs to %.1f s: the template colour will show" % (nm, e["outPoint"], s["duration"]))
            else:
                W("%s: layer '%s' stops at %.1f s, before the comp ends at %.1f s" % (nm, e["layer"], e["outPoint"], s["duration"]))
        for x in s["exprErrors"]:
            E("%s: broken expression at %s: %s" % (nm, x["where"], x["error"]))
        for mname in sorted(set(s["missing"])):
            E("%s: footage missing: %s" % (nm, mname))
    for mname in dump.get("missingFootage", []):
        E("project footage missing: %s" % mname)

    m = dump.get("main")
    if not m:
        E("main comp not found (mainId %s)" % spec["mainId"])
    else:
        plan_t = {n: (s["t"], s["D"]) for n, s in list(scenes_plan.items()) + list(custom_plan.items())}
        placed = {x["name"][:3]: x for x in m["scenes"]}
        for n, (t0, d) in plan_t.items():
            if n not in placed:
                E("main comp: scene '%s' is not placed" % n)
                continue
            x = placed[n]
            if abs(x["inPoint"] - t0) > 0.05:
                E("main comp: %s starts at %.2f, plan says %.2f" % (n, x["inPoint"], t0))
            if abs((x["outPoint"] - x["inPoint"]) - d) > 0.08:
                E("main comp: %s runs %.2f s, plan says %.2f s" % (n, x["outPoint"] - x["inPoint"], d))
        extra = [n for n in placed if n not in plan_t]
        if extra:
            W("main comp: scenes not in the plan: %s" % ", ".join(extra))
        cuts = max(0, len(m["scenes"]) - 1)
        if m["wipeBands"] != cuts or m["wipeMattes"] != cuts:
            E("main comp: %d scenes need %d wipes, found %d bands and %d mattes (rerun place_wipes.jsx after any length change)" % (len(m["scenes"]), cuts, m["wipeBands"], m["wipeMattes"]))
        if abs(m["duration"] - tl["total"]) > 0.5:
            W("main comp is %.1f s, the plan totals %.1f s" % (m["duration"], tl["total"]))
        if spec.get("audioPrefix"):
            a = m["audio"]
            if not a:
                W("no music layer named '%s' in the main comp" % spec["audioPrefix"])
            else:
                if abs(a["outPoint"] - m["duration"]) > 0.1:
                    E("music ends at %.1f s but the video ends at %.1f s (run music.jsx)" % (a["outPoint"], m["duration"]))
                if a["keys"] < 3:
                    W("music has %d level keys: no fade in/out yet (run music.jsx)" % a["keys"])
    for e in errors:
        print("ERROR", e)
    for w in warns:
        print("WARN ", w)
    print("\nprecheck_ae: %d errors, %d warnings, %d scene comps checked" % (len(errors), len(warns), len(dump["scenes"])))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
