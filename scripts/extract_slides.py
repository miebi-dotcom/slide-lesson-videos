"""Read a slide-deck PDF (one slide per page, e.g. a Google Vids / Slides export) into per-slide text.

    python extract_slides.py SLIDES.pdf OUT_DIR

Writes:
  OUT_DIR/slides.md      one block per page: title, then every other text block in reading order
                         (with font size and bold), word count, embedded image count. Read this to plan scenes.
  OUT_DIR/slides.json    the same, machine-readable.
  OUT_DIR/page_XX.png    page renders (60 dpi): look at them to see card colours, backgrounds and layout.

Text fixes: ligature characters (fi, fl, ff, ffi, ffl) are expanded. Some exports also DROP "tt"/"ff"/"fi"
without a ligature character ("maer" for "matter"): those cannot be detected reliably, so compare the text
with the page render and fix words by eye. Requires PyMuPDF:  pip install --user pymupdf
"""
import json
import os
import sys

import pymupdf

BULLETS = "▶►•▪●–➢→"
LIG = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}


def clean(s):
    for k, v in LIG.items():
        s = s.replace(k, v)
    return " ".join(s.replace(" ", " ").split())


def page_blocks(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        lines, sizes, bold = [], [], False
        for ln in b["lines"]:
            t = clean("".join(sp["text"] for sp in ln["spans"]))
            if t:
                lines.append(t)
            for sp in ln["spans"]:
                if sp["text"].strip():
                    sizes.append(sp["size"])
                    bold = bold or bool(sp["flags"] & 16) or "Bold" in sp["font"] or "SemiBold" in sp["font"]
        if lines:
            x0, y0, x1, y1 = b["bbox"]
            out.append({"text": "\n".join(lines), "size": round(max(sizes), 1), "bold": bold,
                        "bbox": [round(x0), round(y0), round(x1), round(y1)]})
    out.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))
    # Exports often split one wrapped paragraph or bullet into a block per line: join a block to the one above
    # when it has the same size, sits right under it and does not start a new bullet ("bold" then means
    # the block starts bold, e.g. a "Liberal:" lead-in).
    merged = []
    for b in out:
        b["text"] = b["text"].replace("\n", " ")
        bullet = b["text"][:1] in BULLETS
        if bullet:
            b["text"] = "• " + b["text"][1:].strip()
        p = merged[-1] if merged else None
        if (p and not bullet and p["size"] == b["size"]
                and 0 <= b["bbox"][1] - p["bbox"][3] < 0.8 * b["size"] and abs(b["bbox"][0] - p["bbox"][0]) < 3 * b["size"]):
            p["text"] += " " + b["text"]
            p["bbox"] = [min(p["bbox"][0], b["bbox"][0]), p["bbox"][1], max(p["bbox"][2], b["bbox"][2]), b["bbox"][3]]
        else:
            merged.append(b)
    return merged


def main(pdf, outdir):
    os.makedirs(outdir, exist_ok=True)
    doc = pymupdf.open(pdf)
    slides, md = [], ["# Slides: %s (%d pages)\n" % (os.path.basename(pdf), len(doc))]
    for i, page in enumerate(doc, 1):
        blocks = page_blocks(page)
        title = max(blocks, key=lambda b: b["size"]) if blocks else None
        rest = [b for b in blocks if b is not title]
        words = sum(len(b["text"].split()) for b in blocks)
        imgs = len(page.get_images(full=True))
        page.get_pixmap(dpi=60).save(os.path.join(outdir, "page_%02d.png" % i))
        slides.append({"page": i, "title": title["text"] if title else "", "blocks": rest, "words": words, "images": imgs})
        md.append("## Page %d: %s" % (i, (title["text"] if title else "(no text)").replace("\n", " / ")))
        md.append("words %d | embedded images %d" % (words, imgs))
        for b in rest:
            md.append("- [%s%s] %s" % (b["size"], " bold" if b["bold"] else "", b["text"].replace("\n", " / ")))
        md.append("")
    with open(os.path.join(outdir, "slides.json"), "w", encoding="utf-8") as f:
        json.dump(slides, f, ensure_ascii=False, indent=1)
    with open(os.path.join(outdir, "slides.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print("%d pages -> %s" % (len(doc), os.path.join(outdir, "slides.md")))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
