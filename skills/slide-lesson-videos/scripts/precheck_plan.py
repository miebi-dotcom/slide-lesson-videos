"""QA gate 1 - before anything is built. Checks the lesson spec and the files plan_lesson.py wrote.

    python precheck_plan.py lesson.json [--slides slides.json] [--palette palette.json]

  --slides   OUT_DIR/slides.json from extract_slides.py (checks page count and titles against the PDF)
  --palette  OUT_DIR/palette.json from pdf_palette.py (checks text contrast and that every colour in the spec comes from the PDF)

Prints ERROR lines (fix before building) and WARN lines (look at them), then a summary. Exit code 1 when there are errors.
Cheap to run: run it after every edit of lesson.json. Everything it finds here would otherwise show up as a rework after the build.
"""
import difflib
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text_rules as TR  # noqa: E402

AVG_CHAR = 0.54            # average glyph width of Manrope, in em (measured on the template's body text)
BULLET_W = 840             # the template's highlight bar and bullet box width, px
MAX_BULLETS = 7            # five template slots plus the two style_scenes.jsx adds
LIMIT_Y, START_Y = 955, 495


def lines_needed(text, size):
    return max(1, math.ceil(len(text) * AVG_CHAR * size / BULLET_W))


def fits(items, size, header_lines):
    y = START_Y + header_lines * 44 + (32 if header_lines else 0)
    for it in items:
        y += lines_needed(it, size) * round(size * 1.55) + round(size * 0.4)
    return y <= LIMIT_Y


def main(argv):
    if not argv:
        sys.exit(__doc__)
    spec = json.load(open(argv[0], encoding="utf-8"))
    opt = {argv[i]: argv[i + 1] for i in range(1, len(argv) - 1, 2) if argv[i].startswith("--")}
    errors, warns = [], []
    E, W = errors.append, warns.append
    work = spec["work"].rstrip("/") + "/"

    for k in ("code", "course", "mainId", "work", "presets", "pages"):
        if k not in spec:
            E("spec is missing '%s'" % k)
    if errors:
        return report(errors, warns)

    # --- files ---------------------------------------------------------------------------------------------
    vdir = spec.get("videoDir", "").rstrip("/") + "/"
    for pg, p in spec["pages"].items():
        if p.get("video") and not os.path.exists(vdir + p["video"]):
            E("page %s: video not found: %s" % (pg, vdir + p["video"]))
        if p.get("preset") and p["preset"] not in spec["presets"]:
            E("page %s: preset '%s' is not in spec.presets" % (pg, p["preset"]))
        if not p.get("video") and int(pg) not in [int(c) for c in spec.get("custom", {})]:
            W("page %s: no video and not a custom slide: the picture slot will show the template placeholder" % pg)
    if spec.get("intro", {}).get("video") and not os.path.exists(vdir + spec["intro"]["video"]):
        E("intro video not found: " + vdir + spec["intro"]["video"])
    for name in ("scenes.json", "style.json", "colors.json", "custom.json", "timeline.json"):
        if not os.path.exists(work + name):
            E("%s is missing: run plan_lesson.py first" % name)
    if errors:
        return report(errors, warns)

    # --- PDF -----------------------------------------------------------------------------------------------
    if "--slides" in opt:
        sl = json.load(open(opt["--slides"], encoding="utf-8"))
        total_pdf = len(sl)
        pages = sorted(int(p) for p in spec["pages"])
        extra = [p for p in range(2, total_pdf) if p not in pages and p not in [int(c) for c in spec.get("custom", {})]]
        if extra:
            E("PDF pages not in the spec (no slide will be built for them): %s" % extra)
        customs = [int(c) for c in spec.get("custom", {})]
        ignore = set(re.findall(r"[a-z]{4,}", spec["course"].lower())) | {"slide", "course"}
        for pg in pages:
            if pg in customs:
                continue
            if pg > total_pdf:
                E("page %d is not in the PDF (%d pages)" % (pg, total_pdf))
                continue
            pdf_title = sl[pg - 1]["title"].lower()
            mine = spec["pages"][str(pg)].get("title", "").lower()
            if mine and pdf_title and difflib.SequenceMatcher(None, mine, pdf_title).ratio() < 0.6:
                W("page %d: title '%s' does not look like the PDF's '%s'" % (pg, spec["pages"][str(pg)]["title"], sl[pg - 1]["title"]))
            # bullet content: every word of the PDF page should appear in the spec (catches a dropped bullet)
            pdf_words = set(re.findall(r"[a-z]{4,}", " ".join([sl[pg - 1]["title"]] + [b["text"] for b in sl[pg - 1]["blocks"]]).lower()))
            have = set(re.findall(r"[a-z]{4,}", json.dumps(spec["pages"][str(pg)]).lower()))
            missing = sorted(w for w in pdf_words - have if w not in ignore)
            if len(missing) > 3:
                W("page %d: %d words on the PDF page are not in the spec (e.g. %s): a bullet may be missing" % (pg, len(missing), ", ".join(missing[:5])))

    # --- text ----------------------------------------------------------------------------------------------
    sc = json.load(open(work + "scenes.json", encoding="utf-8"))["scenes"]
    st = json.load(open(work + "style.json", encoding="utf-8"))
    cfg = dict(spec.get("text", {}))
    cfg["acronyms"] = sorted(set(cfg.get("acronyms", [])) | set(TR.learn_acronyms([t for s in sc for t in s["texts"].values()])))
    seen = {}
    for s in sc:
        for slot, text in s["texts"].items():
            if not text:
                continue
            sl = spec.get("slots", {})
            if s["name"] == "S01 Intro":
                if slot == str(sl.get("intro", {}).get("title", 7)):
                    kind = "topic"
                elif slot == str(sl.get("intro", {}).get("course", 6)):
                    kind = "keep"             # the subtopic line is never touched
                else:
                    kind = "title"
            elif s["name"] == "S20 Thank you":
                kind = "title"
            elif slot == str(sl.get("title", 24)):
                kind = "topic"            # the lesson topic stays in capitals
            elif slot == str(sl.get("course", 26)):
                kind = "keep"             # the subtopic line is never touched
            else:
                kind = "header" if slot == str(sl.get("header", 5)) else "bullet"
            flat = text.replace("\r", " ")
            fixed, ch = TR.fix(flat, kind, cfg)
            if fixed != flat:
                E("%s slot %s breaks the text rules: %r -> %r" % (s["name"], slot, flat, fixed))
            if kind != "keep" and slot != str(spec.get("slots", {}).get("course", 26)) and s["name"] not in ("S01 Intro", "S20 Thank you"):
                seen.setdefault(flat.lower(), []).append(s["name"])
    for t, names in seen.items():
        if len(names) > 1 and len(t) > 25:
            W("same text on %d slides (%s): %r" % (len(names), ", ".join(n[:3] for n in names), t[:50]))

    # --- layout --------------------------------------------------------------------------------------------
    for x in st["scenes"]:
        items = x.get("items")
        if not items:
            continue
        if len(items) > MAX_BULLETS:
            E("%s has %d bullets: the template takes at most %d. Split the slide or ask the user." % (x["name"], len(items), MAX_BULLETS))
        hl = 2 if x["hasHeader"] else 0
        for s in range(34, 20, -2):
            if fits(items, s, hl):
                if s < 28:
                    W("%s: bullets will be fitted down to about %d pt, small for a video: consider shortening the text" % (x["name"], s))
                break
        else:
            E("%s: the bullets do not fit the card even at 22 pt (about %d characters): shorten them" % (x["name"], sum(len(i) for i in items)))
        long = [i for i in items if len(i) > 110]
        if long:
            W("%s: %d bullet(s) over 110 characters: hard to read in the time given" % (x["name"], len(long)))
    # --- header icon (the small lesson icon beside the subtopic line) ---------------------------------------
    icons = work + "icons/icons.json"
    if not os.path.exists(icons):
        E("no header icons: run extract_icon.py on the PDF into %sicons (the template's icon is a stand-in and must be replaced)" % work)
    else:
        ic = json.load(open(icons, encoding="utf-8"))
        have = {int(k) for k in ic["pages"]}
        need = {int(p) for p in spec["pages"]} | ({20} if spec.get("outro") is not None else set())
        gone = sorted(need - have)
        if gone:
            W("no header icon found in the PDF for pages %s: look at those page renders" % gone)
        for k, v in ic["pages"].items():
            if v["kind"] == "vector":
                W("page %s: the icon is vector art, not a picture: rebuild it from shape layers (see references/header-icon.md)" % k)
                break
        if len(ic["groups"]) > 2:
            W("%d different icon pictures: expected one design in two colours; check the PDF renders" % len(ic["groups"]))
    tl = json.load(open(work + "timeline.json", encoding="utf-8"))
    for pg, t0, d in tl["timeline"]:
        if d > 25:
            W("page %d is %.1f s long: long for one slide" % (pg, d))
    if tl["total"] > 600:
        W("the video is %.0f s: check the pacing settings" % tl["total"])

    # --- colours -------------------------------------------------------------------------------------------
    names = set(spec.get("textColors", {}))
    bgs = set(spec.get("bgIds", {}))
    nobg = {}
    for pg, p in spec["pages"].items():
        if p.get("textColor") not in names:
            E("page %s: textColor '%s' is not in spec.textColors" % (pg, p.get("textColor")))
        if p.get("bg") not in bgs:
            nobg.setdefault(p.get("bg"), []).append(pg)
    for bg, pgs in nobg.items():
        W("background '%s' (pages %s) has no comp in spec.bgIds: use the template's own comp id, or build one with setup_bg.jsx" % (bg, ", ".join(pgs)))
    if "--palette" in opt:
        pal = json.load(open(opt["--palette"], encoding="utf-8"))
        pcols = [tuple(g["rgb"]) for g in pal["text_colors"]]
        for nm, rgb in spec.get("textColors", {}).items():
            if not any(all(abs(a - b) <= 14 for a, b in zip(rgb, c)) for c in pcols):
                W("textColors.%s %s is not a text colour found in the PDF" % (nm, rgb))
        for pg, v in pal["pages"].items():
            if v["contrast"] and v["contrast"] < 3:
                E("page %s: text contrast %.1f is under 3:1 even for large text" % (pg, v["contrast"]))
            elif v["contrast"] and v["contrast"] < 4.5:
                W("page %s: text contrast %.1f (large text passes at 3:1, small text needs 4.5)" % (pg, v["contrast"]))
    return report(errors, warns)


def report(errors, warns):
    for e in errors:
        print("ERROR", e)
    for w in warns:
        print("WARN ", w)
    print("\nprecheck_plan: %d errors, %d warnings" % (len(errors), len(warns)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
