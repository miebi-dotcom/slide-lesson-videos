"""Read the colours of every slide from the slide PDF, so nothing is guessed from the template.

    python pdf_palette.py SLIDES.pdf OUT_DIR

Writes OUT_DIR/palette.json and prints a table:
  pages[n].bg       background colour of the page (sampled along the page edge, majority vote)
  pages[n].card     card fill colour, or null when the page has no filled card (outline cards, plain pages)
  pages[n].text     colour of the body text (the colour with most characters, title excluded)
  pages[n].title    colour of the title
  backgrounds       the distinct background colours, each with the pages that use it
  text_colors       the distinct body-text colours, each with the pages that use it
  contrast          WCAG contrast ratio of body text on the card (or on the page when there is no card); under 4.5 is flagged

The lesson spec takes its colours from here: bgIds / textColors / cardColor.  Colours are 0-255 RGB.
Cards are sampled just above the body text, so check the table against the page_XX.png renders before trusting a card colour
(a picture behind the text, or a gradient, gives an average).
"""
import json
import os
import sys
from collections import Counter



def rgb_int(c):
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255]


def close(a, b, tol=14):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def vote(samples, tol=10):
    """Most common colour among samples (grouping near-equal colours)."""
    groups = []
    for s in samples:
        for g in groups:
            if close(g[0], s, tol):
                g[1] += 1
                break
        else:
            groups.append([s, 1])
    groups.sort(key=lambda g: -g[1])
    return groups[0][0] if groups else None


def analyse(doc):
    pages = {}
    for i, page in enumerate(doc, 1):
        pm = page.get_pixmap(dpi=40)
        w, h = pm.width, pm.height
        px = lambda x, y: list(pm.pixel(min(max(int(x), 0), w - 1), min(max(int(y), 0), h - 1)))[:3]
        edge = [px(x, 3) for x in range(0, w, max(1, w // 12))] + [px(x, h - 4) for x in range(0, w, max(1, w // 12))] + \
               [px(3, y) for y in range(0, h, max(1, h // 8))]
        bg = vote(edge)
        spans = []
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            for ln in b["lines"]:
                for sp in ln["spans"]:
                    if sp["text"].strip():
                        spans.append((sp["size"], rgb_int(sp["color"]), len(sp["text"].strip()), sp["bbox"]))
        title_col = text_col = None
        card = None
        if spans:
            big = max(s[0] for s in spans)
            tcount = Counter()
            bcount = Counter()
            for size, col, n, bb in spans:
                (tcount if size >= big - 0.5 else bcount)[tuple(col)] += n
            title_col = list(tcount.most_common(1)[0][0]) if tcount else None
            text_col = list(bcount.most_common(1)[0][0]) if bcount else title_col
            scale = 40 / 72
            cs = []
            for size, col, n, bb in spans:
                if size >= big - 0.5:
                    continue
                cs.append(px(bb[0] * scale + 4, bb[1] * scale - 3))
                cs.append(px(bb[0] * scale + 4, bb[3] * scale + 3))
            c = vote(cs, 6) if cs else None
            if c and not close(c, bg, 12):
                card = c
        ref = card or bg
        pages[i] = {"bg": bg, "card": card, "text": text_col, "title": title_col,
                    "contrast": contrast(text_col, ref) if text_col and ref else None}
    return pages


def main(pdf, out):
    import pymupdf   # imported here so precheck_ae.py can use contrast() without PyMuPDF installed
    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(pdf)
    pages = analyse(doc)
    bgs, txts = [], []
    for n, p in pages.items():
        for lst, key in ((bgs, "bg"), (txts, "text")):
            if p[key] is None:
                continue
            for g in lst:
                if close(g["rgb"], p[key], 12):
                    g["pages"].append(n)
                    break
            else:
                lst.append({"rgb": p[key], "pages": [n]})
    res = {"pages": pages, "backgrounds": bgs, "text_colors": txts,
           "warnings": ["page %d: text contrast %.1f is under 4.5" % (n, p["contrast"]) for n, p in pages.items() if p["contrast"] and p["contrast"] < 4.5]}
    json.dump(res, open(os.path.join(out, "palette.json"), "w"), indent=1)
    print("page  background        card              text              contrast")
    for n, p in pages.items():
        f = lambda c: ("%3d,%3d,%3d" % tuple(c)) if c else "   (none)   "
        print("%4d  %s   %s   %s   %s" % (n, f(p["bg"]), f(p["card"]), f(p["text"]), p["contrast"]))
    print("\nbackgrounds:", [(g["rgb"], g["pages"]) for g in bgs])
    print("text colours:", [(g["rgb"], g["pages"]) for g in txts])
    for w in res["warnings"]:
        print("WARNING", w)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
