"""Turn a lesson spec (lesson.json) into the data files every After Effects step reads.

    python plan_lesson.py lesson.json [pages, comma list]      (default: every page in the spec)

Reads   lesson.json   see assets/lesson-spec.example.json and references/spec-format.md
Writes  (into spec["work"]):
    scenes.json       for build_scenes.jsx
    style.json        for style_scenes.jsx (bullets, backgrounds, card fills, video slot)
    colors.json       for fix_textcolor.jsx
    custom.json       for build_custom.jsx (slides with no picture slot) and fix_durations.jsx
    header_icons.json for header_icon.jsx (needs <work>/icons/icons.json from extract_icon.py);  highlights.json for fix_highlights.jsx;  durations.json for fix_durations.jsx;  music.json for music.jsx;  wipes.json for place_wipes.jsx
    timeline.json     page, start, length for every slide, and the outro start
    text_changes.md   every edit the text rules made, for a human to review (proper nouns, quotations)

Every block of slide text goes through text_rules.fix() first: British spelling, sentence case, full stops.
The pacing is by reading time, because a slide lesson has no narration to time against.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text_rules as TR  # noqa: E402

WIPE_OVERLAP = 1.1          # the outgoing slide runs this long past the next slide's start, so the wipe covers it
INTRO_LEN, OUTRO_LEN = 10.1, 7.5
DEFAULT_SLOTS = {           # layer indices of the animator's slide template (read them again with inspect_presets.jsx)
    "title": 24, "course": 26, "header": 5,
    "bullets": [[10, 15, 20], [9, 14, 19], [8, 13, 18], [7, 12, 17], [6, 11, 16]],   # text, arrow, highlight per bullet
    "videoNested": {"4": {"images": {"3": "{video}"}}},
    "intro": {"title": "7", "course": "6", "videoNested": {"5": {"images": {"3": "{video}"}}}},
    "outro": {"title": "2"},
}


def words(*parts):
    return sum(len(re.findall(r"\S+", p)) for p in parts)


class Plan:
    def __init__(self, spec):
        self.spec = spec
        self.slots = dict(DEFAULT_SLOTS, **spec.get("slots", {}))
        pac = spec.get("pacing", {})
        self.first = pac.get("first", 2.6)          # the title is read alone before the first bullet
        self.lo, self.hi = pac.get("gap_min", 2.0), pac.get("gap_max", 3.6)
        self.per_word = pac.get("per_word", 0.2)
        self.hold_min, self.hold_per_word = pac.get("hold_min", 4.0), pac.get("hold_per_word", 0.1)
        self.min_len = pac.get("slide_min", 11.0)
        self.custom = {int(k): v for k, v in spec.get("custom", {}).items()}   # page -> length in s (null = work it out)
        self.auto_len = {}
        self.changes, self.review = [], []
        self.text_cfg = dict(spec.get("text", {}))
        self.pages = {}
        self._prepare_text()

    # ---- text -----------------------------------------------------------------------------------------------
    def _prepare_text(self):
        raw = []
        for pg, p in self.spec["pages"].items():
            raw += [p.get("title", ""), p.get("header", "")] + [b.lstrip("~") for b in p.get("bullets", [])]
        learned = TR.learn_acronyms(raw)
        self.text_cfg["acronyms"] = sorted(set(self.text_cfg.get("acronyms", [])) | set(learned))
        self.text_cfg["suggested_proper_nouns"] = TR.suggest_proper_nouns(raw)
        for pg, p in self.spec["pages"].items():
            n = int(pg)
            title = self._fix(n, "title", p.get("title", ""), "topic")
            header = self._fix(n, "header", p.get("header", ""), "header") if p.get("header") else ""
            items = []
            for i, b in enumerate(p.get("bullets", []), 1):
                plain = b.startswith("~")
                t = self._fix(n, "bullet %d" % i, b.lstrip("~"), "bullet")
                items.append(("~" if plain else "") + t)
            q = dict(p)
            q.update(title=title, header=header, bullets=items)
            if p.get("cards"):
                q["cards"] = self._custom_cards(n, p)
            self.pages[n] = q
        self.course = self.spec.get("course", "")      # the subtopic line is never touched: verbatim from the PDF
        intro = self.spec.get("intro")
        self.intro_title = self._fix_broken(intro.get("title", ""), "intro title") if intro else ""
        outro = self.spec.get("outro")
        self.outro_title = self._fix(99, "outro", outro.get("title", "Thank you"), "title") if outro is not None else ""

    def _gap(self, text):
        return min(self.hi, max(self.lo, 1.0 + self.per_word * len(text.split())))

    def _custom_cards(self, n, p):
        """Slides with no picture slot (two cards of bullets, or four numbered cards): fix the text, then time it by reading
        order unless the spec already gives times ("t" on a card or item)."""
        cards = json.loads(json.dumps(p["cards"]))
        kind = p.get("kind", "two")
        t = self.first
        if kind == "two":
            for i, c in enumerate(cards):
                if c.get("header"):
                    c["header"] = self._fix(n, "card %d header" % (i + 1), c["header"], "header")
                for it in c.get("items", []):
                    it["text"] = self._fix(n, "card %d bullet" % (i + 1), it["text"], "bullet")
                c.setdefault("t", round(0.4 + 0.3 * i, 2))
                if c.get("header"):
                    c.setdefault("th", 1.8)
            seq = []
            for k in range(max(len(c.get("items", [])) for c in cards)):
                for c in cards:
                    if k < len(c.get("items", [])):
                        seq.append(c["items"][k])
            for it in seq:
                if "t" not in it:
                    it["t"] = round(t + 0.4, 2)
                t = it["t"] + self._gap(it["text"])
            last = max(it["t"] for it in seq) if seq else t
        else:
            for i, c in enumerate(cards):
                if c.get("title"):
                    c["title"] = self._fix(n, "card %d title" % (i + 1), c["title"], "title")
                c["text"] = self._fix(n, "card %d text" % (i + 1), c["text"], "bullet")
                if "t" not in c:
                    c["t"] = round(t, 2)
                t = c["t"] + self._gap(c["text"])
            last = max(c["t"] for c in cards)
        total_words = words(p.get("title", ""), json.dumps(cards))
        self.auto_len[n] = round(max(self.min_len, last + 1.4 + max(self.hold_min, self.hold_per_word * total_words / 2)), 2)
        return cards

    def _fix(self, pg, label, text, kind):
        if not text:
            return text
        new, ch = TR.fix(text, kind, self.text_cfg)
        for c in ch:
            self.changes.append((pg, label, c))
        for n in TR.review_notes(new):
            self.review.append((pg, label, n))
        return new

    def _fix_broken(self, text, label):
        """Intro title: '|' marks where the lines break; the rules run on the whole sentence, the breaks go back after."""
        counts = [len(seg.split()) for seg in text.split("|")]
        flat = " ".join(seg.strip() for seg in text.split("|"))
        new = self._fix(0, label, flat, "topic")
        ws = new.split()
        out, i = [], 0
        for c in counts:
            out.append(" ".join(ws[i:i + c]))
            i += c
        return "\r".join(s for s in out if s)

    # ---- pacing ---------------------------------------------------------------------------------------------
    def rels(self, pg):
        """Bullet start times (seconds into the slide): paced by the words of the previous bullet."""
        out, t = [], self.first
        for it in self.pages[pg]["bullets"]:
            out.append(round(t, 2))
            t += min(self.hi, max(self.lo, 1.0 + self.per_word * len(it.split())))
        return out

    def duration(self, pg):
        p = self.pages[pg]
        r = self.rels(pg)
        hold = max(self.hold_min, self.hold_per_word * words(p["header"], *p["bullets"]))
        return round(max(self.min_len, (r[-1] if r else self.first) + 1.4 + hold), 2)

    def length(self, pg):
        if pg in self.custom:
            if self.custom[pg]:
                return self.custom[pg]
            if pg not in self.auto_len:
                raise ValueError("page %d is a custom slide with no length and no cards: give spec.custom a length or add cards" % pg)
            return self.auto_len[pg]
        return self.duration(pg)

    # ---- build ----------------------------------------------------------------------------------------------
    def build(self, only=None):
        spec, slots = self.spec, self.slots
        videodir = spec.get("videoDir", "").rstrip("/") + "/"
        t = spec.get("firstSlideAt", 9.0)
        timeline = []
        for pg in sorted(set(self.pages) | set(self.custom)):
            d = self.length(pg)
            timeline.append((pg, round(t, 2), d))
            t += d
        out_t = t
        scenes, style, colors, custom = [], [], [], []
        for pg, t0, d in timeline:
            p = self.pages[pg]
            n = len(p["bullets"])
            name = "S%02d %s" % (pg, p["title"].rstrip("?.").title()[:34])
            if pg in self.custom:
                custom.append({"name": name, "page": pg, "title": p["title"], "t": t0, "D": round(d + WIPE_OVERLAP, 2),
                               "kind": p.get("kind", "two"), "cards": p.get("cards", []), "bg": p.get("bg")})
                continue
            if only and pg not in only:
                continue
            texts = {str(slots["title"]): p["title"], str(slots["course"]): self.course, str(slots["header"]): p["header"]}
            disable, retime = [], []
            rl = self.rels(pg)
            for k in range(1, 6):
                ti, ai, hi = slots["bullets"][k - 1]
                if k <= n:
                    texts[str(ti)] = p["bullets"][k - 1].lstrip("~")
                    retime.append([ti, ti, rl[k - 1]])
                else:
                    disable += [ti, ai, hi]
            sc = {"name": name, "preset": spec["presets"][p["preset"]], "t": t0, "D": round(d + WIPE_OVERLAP, 2), "texts": texts,
                  "retime": retime, "disable": disable, "fitWidth": {str(slots["title"]): spec.get("titleMaxWidth", 1480)},
                  "fit": {"mode": "extend"}}
            if p.get("video"):
                sc["nested"] = json.loads(json.dumps(slots["videoNested"]).replace("{video}", (videodir + p["video"]).replace("\\", "/")))
            scenes.append(sc)
            style.append({"name": name, "page": pg, "bg": p.get("bg"), "cardFill": p.get("cardFill"),
                          "items": [i.lstrip("~") for i in p["bullets"]],
                          "plain": [i for i, x in enumerate(p["bullets"]) if x.startswith("~")], "hasHeader": bool(p["header"]),
                          "video": bool(p.get("video")), "rels": rl, "t": t0, "D": round(d + WIPE_OVERLAP, 2)})
            colors.append({"name": name, "n": n, "color": p.get("textColor")})
        intro = spec.get("intro")
        if intro and (not only or 1 in only):
            tx = {slots["intro"]["title"]: self.intro_title, slots["intro"]["course"]: self.course}
            sc = {"name": "S01 Intro", "preset": spec["presets"]["intro"], "t": 0, "D": INTRO_LEN, "texts": tx, "fit": {"mode": "extend"}}
            if intro.get("video"):
                sc["nested"] = json.loads(json.dumps(slots["intro"]["videoNested"]).replace("{video}", (videodir + intro["video"]).replace("\\", "/")))
            scenes.append(sc)
            style.append({"name": "S01 Intro", "page": 1, "bg": intro.get("bg"), "intro": True, "video": bool(intro.get("video")), "t": 0, "D": INTRO_LEN})
        outro = spec.get("outro")
        if outro is not None and (not only or 20 in only):
            scenes.append({"name": "S20 Thank you", "preset": spec["presets"]["outro"], "t": round(out_t, 2), "D": OUTRO_LEN,
                           "texts": {str(slots["outro"]["title"]): self.outro_title}, "fit": {"mode": "extend"}})
            style.append({"name": "S20 Thank you", "page": 20, "bg": outro.get("bg"), "outro": True, "video": False, "t": round(out_t, 2), "D": OUTRO_LEN})
        return scenes, style, colors, custom, timeline, out_t

    def write(self, only=None):
        spec = self.spec
        work = spec["work"].rstrip("/") + "/"
        os.makedirs(work, exist_ok=True)
        scenes, style, colors, custom, timeline, out_t = self.build(only)

        def j(name, obj):
            if spec.get("project") and isinstance(obj, dict):
                obj = dict({"project": spec["project"]}, **obj)   # the runner refuses to run this on any other open project
            json.dump(obj, open(work + name, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        folder = spec.get("scenesFolder", spec["code"] + " scenes")
        j("scenes.json", {"mainId": spec["mainId"], "scenesFolder": folder,
                           "assetsFolder": spec.get("assetsFolder", spec["code"] + " assets"),
                           "holdersFolder": spec.get("holdersFolder", spec["code"] + " image holders"), "scenes": scenes})
        j("style.json", {"bgIds": spec.get("bgIds", {}), "limit": spec.get("bulletLimit", 925), "boldFont": spec.get("boldFont"),
                         "trackColor": spec.get("trackColor"), "scenes": style})
        j("colors.json", {"palette": spec.get("textColors", {}), "scenes": colors})
        j("custom.json", {"mainId": spec["mainId"], "course": self.course, "bgIds": spec.get("bgIds", {}),
                          "baseId": spec.get("customBaseId"), "scenesFolder": folder, "cardColor": spec.get("cardColor"),
                          "textColor": (spec.get("textColors", {}).get(spec.get("customTextColor"), spec.get("customTextColor"))
                                        if isinstance(spec.get("customTextColor"), str) else spec.get("customTextColor")),
                          "slides": custom})
        n_of = {x["name"]: len(x["items"]) for x in style if x.get("items")}
        j("highlights.json", {"scenes": [{"name": k, "n": v} for k, v in n_of.items()]})
        j("durations.json", {"mainId": spec["mainId"], "custom": [{"name": c["name"], "D": c["D"]} for c in custom]})
        j("music.json", {"mainId": spec["mainId"], "audioPrefix": spec.get("audioPrefix", ""), "fadeIn": spec.get("musicFadeIn", 2.5),
                         "fadeOut": spec.get("musicFadeOut", 5)})
        j("wipes.json", {"mainId": spec["mainId"], "bandId": spec.get("wipe", {}).get("bandId"), "matteId": spec.get("wipe", {}).get("matteId")})
        icons_json = work + "icons/icons.json"
        icon_scenes = []
        if os.path.exists(icons_json):
            ic = json.load(open(icons_json, encoding="utf-8"))["pages"]
            for pg, t0, d in timeline:
                if str(pg) in ic:
                    p = self.pages[pg]
                    icon_scenes.append({"name": "S%02d %s" % (pg, p["title"].rstrip("?.").title()[:34]), "file": ic[str(pg)]["file"]})
            if "20" in ic and spec.get("outro") is not None:
                icon_scenes.append({"name": "S20 Thank you", "file": ic["20"]["file"]})
        j("header_icons.json", {"assetsFolder": spec.get("assetsFolder", spec["code"] + " assets"), "scenes": icon_scenes})
        j("timeline.json", {"timeline": timeline, "outT": out_t, "total": round(out_t + OUTRO_LEN, 2)})
        md = ["# Text edits made by the text rules", "", "Review these: proper nouns and quotations are the usual mistakes.", ""]
        for pg, label, c in self.changes:
            md.append("- page %s, %s: %s  %r -> %r" % (pg, label, c[0], c[1], c[2]))
        md += ["", "# Needs a human look", ""]
        for pg, label, n in self.review:
            md.append("- page %s, %s: %s" % (pg, label, n))
        md += ["", "Suggested proper nouns (capitals in the middle of a sentence; add to spec text.proper_nouns if real):",
               ", ".join(self.text_cfg["suggested_proper_nouns"]) or "(none)"]
        open(work + "text_changes.md", "w", encoding="utf-8").write("\n".join(md))
        return timeline, out_t


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    only = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else None
    plan = Plan(spec)
    tl, out_t = plan.write(only)
    print([(p, t, d) for p, t, d in tl])
    print("outro at %.1f, total %.1f s; %d text edits -> %s" % (out_t, out_t + OUTRO_LEN, len(plan.changes), spec["work"] + "/text_changes.md"))
