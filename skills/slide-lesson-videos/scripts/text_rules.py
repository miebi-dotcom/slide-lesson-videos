"""House text rules for slide-lesson videos: British English, sentence case, full punctuation.

Used three ways:
  1. imported by plan_lesson.py, which runs every block of slide text through fix() before anything is built;
  2. python text_rules.py fix  in.json out.json   - in.json is a list of {"id", "kind", "text"}; out.json adds "fixed"
     and "changes" (every edit, so a human can reverse the ones that are wrong: proper nouns, quotations);
  3. python text_rules.py check dump.json          - dump.json is the text dump written by precheck.jsx (what is actually
     in After Effects); lists every layer whose text breaks a rule.  Exit code 1 when anything is found.

Block kinds (the rules differ):
  keep    the course / subtopic line beside the header icon: left EXACTLY as the PDF has it (no spelling, case or punctuation
          change at all). fix() returns it unchanged.
  topic   the lesson topic at the top of a slide, and the intro title: stays in CAPITALS (British spelling only), NO closing full stop
  title   course name, outro line, card titles: sentence case, NO closing full stop (a "?" is kept)
  header  card header / lead-in line ("A good action plan includes:"): sentence case, ends in . ? ! or :
  bullet  bullet or paragraph: sentence case, ends in . ? ! (a trailing : is kept when the block introduces a list)

Sentence case here is strict: only the first letter of a sentence is a capital. A word keeps its capital only when it is
  - a protected proper noun or phrase (cfg["proper_nouns"], e.g. "Paris Agreement", "World Bank"),
  - an acronym (cfg["acronyms"], an all-caps word in mixed text, or an all-caps word in brackets such as "(NASA)"),
  - a word with a capital inside it (pH, iPhone, mRNA), or the word "I".
The letter after a colon is lower case unless cfg["cap_after_colon"] is true.  Text typed in capitals is lower-cased first.
"""
import json
import re
import sys

# ---------------------------------------------------------------------------------------------------------------
# British spelling
# ---------------------------------------------------------------------------------------------------------------
# word -> British word (lower case; case is copied from the original at replace time)
WORDS = {
    # -or / -our
    "color": "colour", "colors": "colours", "colored": "coloured", "coloring": "colouring", "colorful": "colourful",
    "behavior": "behaviour", "behaviors": "behaviours", "behavioral": "behavioural", "favor": "favour", "favors": "favours",
    "favorite": "favourite", "favorable": "favourable", "neighbor": "neighbour", "neighbors": "neighbours",
    "neighborhood": "neighbourhood", "neighborhoods": "neighbourhoods", "harbor": "harbour", "harbors": "harbours",
    "labor": "labour", "honor": "honour", "honors": "honours", "flavor": "flavour", "flavors": "flavours",
    "humor": "humour", "rumor": "rumour", "vapor": "vapour", "odor": "odour", "odors": "odours", "rigor": "rigour",
    "vigor": "vigour", "savior": "saviour", "endeavor": "endeavour", "endeavors": "endeavours", "armor": "armour",
    "clamor": "clamour", "glamor": "glamour", "parlor": "parlour", "tumor": "tumour", "tumors": "tumours",
    # -er / -re
    "center": "centre", "centers": "centres", "centered": "centred", "centering": "centring", "meter": "metre",
    "meters": "metres", "kilometer": "kilometre", "kilometers": "kilometres", "centimeter": "centimetre",
    "centimeters": "centimetres", "millimeter": "millimetre", "millimeters": "millimetres", "liter": "litre",
    "liters": "litres", "milliliter": "millilitre", "milliliters": "millilitres", "fiber": "fibre", "fibers": "fibres",
    "theater": "theatre", "theaters": "theatres", "caliber": "calibre", "somber": "sombre", "luster": "lustre",
    "specter": "spectre", "sepulcher": "sepulchre", "meager": "meagre", "maneuver": "manoeuvre",
    "maneuvers": "manoeuvres",
    # -se / -ce
    "defense": "defence", "defenses": "defences", "offense": "offence", "offenses": "offences", "license": "licence",
    "licenses": "licences", "pretense": "pretence", "practise": "practise",
    # -ogue
    "catalog": "catalogue", "catalogs": "catalogues", "dialog": "dialogue", "dialogs": "dialogues",
    "analog": "analogue", "monolog": "monologue", "epilog": "epilogue", "prolog": "prologue",
    # doubled l
    "traveling": "travelling", "traveled": "travelled", "traveler": "traveller", "travelers": "travellers",
    "labeled": "labelled", "labeling": "labelling", "modeling": "modelling", "modeled": "modelled",
    "canceled": "cancelled", "canceling": "cancelling", "cancelation": "cancellation", "fueling": "fuelling",
    "fueled": "fuelled", "counselor": "counsellor", "counselors": "counsellors", "counseling": "counselling",
    "signaling": "signalling", "signaled": "signalled", "leveled": "levelled", "leveling": "levelling",
    "marshaling": "marshalling", "totaled": "totalled", "totaling": "totalling", "channeled": "channelled",
    "channeling": "channelling", "tunneling": "tunnelling", "tunneled": "tunnelled", "quarreled": "quarrelled",
    "enrollment": "enrolment", "enrollments": "enrolments", "fulfillment": "fulfilment", "skillful": "skilful",
    "installment": "instalment", "installments": "instalments", "appall": "appal", "enroll": "enrol",
    "enrolled": "enrolled", "distill": "distil", "willful": "wilful", "instill": "instil",
    # ae / oe
    "pediatric": "paediatric", "pediatrics": "paediatrics", "anesthesia": "anaesthesia", "anesthetic": "anaesthetic",
    "esthetic": "aesthetic", "esthetics": "aesthetics", "diarrhea": "diarrhoea", "fetus": "foetus", "fetal": "foetal",
    "hemoglobin": "haemoglobin", "hemorrhage": "haemorrhage", "leukemia": "leukaemia", "anemia": "anaemia",
    "anemic": "anaemic", "orthopedic": "orthopaedic", "gynecology": "gynaecology", "encyclopedia": "encyclopaedia",
    "paleontology": "palaeontology", "archeology": "archaeology", "archeological": "archaeological",
    "medieval": "medieval", "estrogen": "oestrogen", "edema": "oedema", "ameba": "amoeba",
    # misc
    "gray": "grey", "grays": "greys", "aging": "ageing", "mold": "mould", "molds": "moulds", "moldy": "mouldy",
    "skeptic": "sceptic", "skeptics": "sceptics", "skeptical": "sceptical", "skepticism": "scepticism",
    "sulfur": "sulphur", "sulfate": "sulphate", "sulfates": "sulphates", "sulfide": "sulphide", "aluminum": "aluminium",
    "artifact": "artefact", "artifacts": "artefacts", "plow": "plough", "plowing": "ploughing", "curb": "kerb",
    "tire": "tyre", "tires": "tyres", "jewelry": "jewellery", "mustache": "moustache", "pajamas": "pyjamas",
    "cozy": "cosy", "donut": "doughnut", "draft": "draft", "check": "check", "program": "programme",
    "programs": "programmes", "ax": "axe", "cookie": "cookie", "story": "story", "airplane": "aeroplane",
    "airplanes": "aeroplanes", "analyze": "analyse", "analyzes": "analyses", "analyzed": "analysed",
    "analyzing": "analysing", "analyzer": "analyser", "paralyze": "paralyse", "catalyze": "catalyse",
    "hydrolyze": "hydrolyse", "breathalyze": "breathalyse", "offence": "offence", "judgement": "judgement",
    "acknowledgment": "acknowledgement", "fulfil": "fulfil", "inquiry": "enquiry", "inquiries": "enquiries",
    "inquire": "enquire", "gauge": "gauge", "tidbit": "titbit", "aluminium": "aluminium", "cesium": "caesium",
    "fossil fuel": "fossil fuel", "sanitization": "sanitisation", "pretext": "pretext", "whiskey": "whisky",
    "yogurt": "yoghurt", "pizzazz": "pizzazz", "carburetor": "carburettor", "disk": "disc", "ton": "tonne",
}
# words in WORDS that must NOT be rewritten automatically (kept in the table only as documentation of a decision):
# "program" is "programme" for a plan or schedule but "program" for software; "disk" and "ton" depend on context;
# "check" and "draft" are the same in British English. They are reported by flag_words() for a human to decide.
CONTEXT_WORDS = {"program", "programs", "disk", "ton", "license", "licenses"}
SAME = {w for w, b in WORDS.items() if w == b}

# -ize / -yze families: prioritize -> prioritise, organization -> organisation.  Stems that really end in -ize.
IZE_KEEP = {"size", "sizes", "sized", "sizing", "seize", "seizes", "seized", "seizing", "prize", "prizes", "prized",
            "capsize", "capsizes", "capsized", "resize", "resizes", "resized", "resizing", "downsize", "downsized",
            "downsizing", "oversize", "oversized", "upsize", "upsized", "baize", "maize", "cognizant", "cognizance",
            "bizarre", "ritzy", "glitz", "pizza", "citizen", "citizens", "citizenship", "horizon", "horizons"}
IZE_RE = re.compile(r"\b([A-Za-z]{2,}?)(iz)(e|es|ed|ing|er|ers|ation|ations|able|ability)\b", re.I)
YZE_RE = re.compile(r"\b([A-Za-z]{2,}?)(yz)(e|es|ed|ing|er|ers)\b", re.I)


def _match_case(src, dst):
    if src.isupper() and len(src) > 1:
        return dst.upper()
    if src[:1].isupper():
        return dst[:1].upper() + dst[1:]
    return dst


def british(text, changes=None, keep=()):
    """Return text in British spelling. Every replacement is appended to changes as (old, new)."""
    keep = {k.lower() for k in keep}

    def swap(old, new):
        if changes is not None and old != new:
            changes.append(("spelling", old, new))
        return new

    def word(m):
        w = m.group(0)
        lw = w.lower()
        if lw in keep or lw in CONTEXT_WORDS or lw in SAME:
            return w
        if lw in WORDS:
            return swap(w, _match_case(w, WORDS[lw]))
        return w

    out = re.sub(r"[A-Za-z]+", word, text)

    def ize(m):
        w = m.group(0)
        if w.lower() in IZE_KEEP or w.lower() in keep:
            return w
        return swap(w, m.group(1) + _match_case(m.group(2), "is") + m.group(3))

    def yze(m):
        w = m.group(0)
        if w.lower() in keep:
            return w
        return swap(w, m.group(1) + _match_case(m.group(2), "ys") + m.group(3))

    out = IZE_RE.sub(ize, out)
    out = YZE_RE.sub(yze, out)
    return out


def flag_words(text):
    """Words that may or may not be American depending on meaning: reported for a human, never changed."""
    return sorted({w for w in re.findall(r"[A-Za-z]+", text) if w.lower() in CONTEXT_WORDS})


# ---------------------------------------------------------------------------------------------------------------
# Sentence case
# ---------------------------------------------------------------------------------------------------------------
ABBREV = {"e.g.", "i.e.", "etc.", "vs.", "approx.", "no.", "mr.", "mrs.", "ms.", "dr.", "cf.", "fig.", "al."}
TERMINATORS = ".?!"
OPENERS = "(“‘\"'["
CLOSERS = ")”’\"']"


def is_shouting(text):
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 4:
        return False
    # a one-word block counts as shouting only when it is long enough not to be an acronym: "SUMMARY" yes, "UNESCO" no
    # (list real acronyms in the spec); an acronym in mixed-case text is never treated as shouting
    return sum(c.isupper() for c in letters) / len(letters) > 0.8 and (len(text.split()) >= 2 or len(letters) >= 7)


def acronyms_in(text):
    """All-caps words (2-6 letters) that sit in mixed-case text, or in brackets: safe to learn as acronyms."""
    found = set()
    for m in re.finditer(r"\(([A-Z]{2,6}s?)\)", text):
        found.add(m.group(1))
    if not is_shouting(text):
        for m in re.finditer(r"\b([A-Z]{2,6})\b", text):
            found.add(m.group(1))
    return found


def sentence_case(text, cfg=None):
    cfg = cfg or {}
    acr = {a.upper() for a in cfg.get("acronyms", [])}
    cap_colon = cfg.get("cap_after_colon", False)
    shout = is_shouting(text)
    parts = re.split(r"(\s+)", text)
    out, cap_next, first = [], True, True
    for part in parts:
        if not part or part.isspace():
            out.append(part)
            continue
        lead = ""
        while part and part[0] in OPENERS:
            lead += part[0]
            part = part[1:]
        trail = ""
        while part and part[-1] in CLOSERS + TERMINATORS + ",;:":
            trail = part[-1] + trail
            part = part[:-1]
        core = part
        if core:
            letters = re.sub(r"[^A-Za-z]", "", core)
            keep = False
            if core == "I" or re.fullmatch(r"I['’](m|ll|d|ve)", core):
                keep = True
            elif letters.upper() in acr and letters.isupper():
                keep = True
            elif letters.upper() in acr and core.upper() == core:
                keep = True
            elif re.search(r"[a-z][A-Z]|[A-Z][a-z]*[A-Z][a-z]*s?$", core) and not core.istitle() and not core.isupper():
                keep = True            # pH, iPhone, mRNA: a capital inside the word
            elif core.isupper() and len(letters) >= 2 and not shout:
                keep = True            # an acronym in mixed-case text
            if not keep:
                core = core.lower()
            if cap_next and letters:
                m = re.search(r"[A-Za-z]", core)
                if m:
                    core = core[:m.start()] + core[m.start()].upper() + core[m.start() + 1:]
                cap_next = False
        out.append(lead + core + trail)
        full = (lead + core + trail).lower()
        full_stripped = full.rstrip(CLOSERS)
        if trail and full_stripped.endswith(tuple(TERMINATORS)) and full_stripped not in ABBREV and \
                not re.search(r"\b(e\.g|i\.e|etc|vs|approx|cf|fig|al)\.$", full_stripped):
            cap_next = True
        elif cap_colon and full_stripped.endswith(":"):
            cap_next = True
        first = False
    result = "".join(out)
    for phrase in cfg.get("proper_nouns", []):
        result = re.sub(r"(?<![A-Za-z])" + re.escape(phrase) + r"(?![A-Za-z])", phrase, result, flags=re.I)
    return result


# ---------------------------------------------------------------------------------------------------------------
# Punctuation
# ---------------------------------------------------------------------------------------------------------------
def tidy_spacing(text):
    t = text.replace(" ", " ")
    t = re.sub(r"[ \t]+", " ", t).strip()
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)                      # no space before punctuation
    t = re.sub(r"([,;])(?=[A-Za-z])", r"\1 ", t)                # a space after , and ;
    t = re.sub(r"(?<=[a-z]):(?=[A-Za-z])", ": ", t)            # a space after a colon (not 10:30)
    t = re.sub(r"(?<![.])\.\.(?![.])", ".", t)                  # ".." -> "."  ("..." is left alone)
    t = re.sub(r"([?!])\.", r"\1", t)
    t = re.sub(r",\.", ".", t)
    return t


def end_punctuation(text, kind):
    t = text.rstrip()
    if not t:
        return t
    closers = ""
    while t and t[-1] in CLOSERS:
        closers = t[-1] + closers
        t = t[:-1]
    core = t
    if kind in ("title", "topic"):
        core = core.rstrip(".;,:")
        return core + closers
    if core and core[-1] in TERMINATORS:
        return core + closers
    if core and core[-1] == ":":
        return core + closers                       # introduces a list or the lines that follow
    if core and core[-1] in ",;":
        core = core[:-1]
    return core + closers + "." if closers else core + "."


KINDS = ("keep", "topic", "title", "header", "bullet")


def fix(text, kind="bullet", cfg=None):
    """Apply all rules to one block of text. Returns (new_text, changes)."""
    cfg = cfg or {}
    changes = []
    if kind == "keep":                       # never touched: the subtopic line is the client's own wording and styling
        return text, changes
    t = tidy_spacing(text)
    t = british(t, changes, cfg.get("keep_spelling", []))
    if kind == "topic":                      # the topic is shown in capitals: only spelling and the closing full stop are touched
        s = t.upper()
        if s != t:
            changes.append(("caps", t, s))
        p = end_punctuation(s, "title")
        if p != s:
            changes.append(("punctuation", s[-12:], p[-12:]))
        return p, changes
    s = sentence_case(t, cfg)
    if s != t:
        changes.append(("case", t, s))
    t = s
    p = end_punctuation(t, kind)
    if p != t:
        changes.append(("punctuation", t[-12:], p[-12:]))
    t = p
    if text.strip() != t and not changes:
        changes.append(("spacing", text, t))
    return t, changes


def review_notes(text):
    """Things a person should look at after the rules have run."""
    notes = []
    if re.search(r"[“”\"]", text):
        notes.append("quoted text: check the capital letter inside the quotation marks")
    for w in flag_words(text):
        notes.append("'%s': programme/program, licence/license, disk/disc, ton/tonne depend on meaning" % w)
    for m in re.finditer(r"\b(a|an) ([A-Za-z]{3,}ists|[A-Za-z]{3,}[^su\W]s)\b", text, re.I):
        notes.append("'%s': a/an before what looks like a plural, possibly a mistake in the source (the rules never change wording)" % m.group(0))
    caps = re.findall(r"\b[A-Z]{2,6}s?\b", text)
    if caps:
        notes.append("kept as acronyms: " + ", ".join(sorted(set(caps))))
    return notes


def learn_acronyms(blocks):
    found = set()
    for b in blocks:
        found |= acronyms_in(b)
    return sorted(found)


def suggest_proper_nouns(blocks):
    """Capitalised words in the middle of a sentence that are not acronyms: candidates for cfg['proper_nouns']."""
    cand = set()
    for b in blocks:
        if is_shouting(b):
            continue
        words = re.findall(r"[A-Za-z][A-Za-z'’-]*", b)
        for i, w in enumerate(words):
            if i and w[0].isupper() and not w.isupper():
                cand.add(w)
    return sorted(cand)


def check_text(text, kind, cfg=None):
    """Does the text already obey the rules? Returns the list of problems (empty when it is clean)."""
    fixed, ch = fix(text, kind, cfg)
    return [c for c in ch] if fixed != text.strip() else []


def _main(argv):
    if len(argv) < 3 or argv[1] not in ("fix", "check"):
        sys.exit(__doc__)
    cfg = {}
    args = argv[2:]
    if "--cfg" in args:
        i = args.index("--cfg")
        cfg = json.load(open(args[i + 1], encoding="utf-8"))
        del args[i:i + 2]
    data = json.load(open(args[0], encoding="utf-8"))
    if argv[1] == "fix":
        out = []
        for d in data:
            fixed, ch = fix(d["text"], d.get("kind", "bullet"), cfg)
            out.append(dict(d, fixed=fixed, changes=ch, review=review_notes(fixed)))
        json.dump(out, open(args[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("%d blocks, %d changed" % (len(out), sum(1 for d in out if d["fixed"] != d["text"])))
        return 0
    bad = 0
    for d in data:
        probs = check_text(d["text"], d.get("kind", "bullet"), cfg)
        if probs:
            bad += 1
            fixed, _ = fix(d["text"], d.get("kind", "bullet"), cfg)
            print("%s [%s]\n   now:   %s\n   fixed: %s\n   (%s)" % (d.get("id", "?"), d.get("kind", "bullet"), d["text"], fixed,
                                                                 ", ".join(sorted({p[0] for p in probs}))))
    print("%d of %d blocks break the text rules" % (bad, len(data)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv))
