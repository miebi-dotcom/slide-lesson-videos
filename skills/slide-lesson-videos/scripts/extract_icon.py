"""Pull the small lesson icon out of a slide PDF, so the video can show the same one.

    python extract_icon.py SLIDES.pdf OUT_DIR

Every slide has a small icon beside the lesson's subtopic line in the header (top left), separate from the publisher's logo at the
top right. It changes from lesson to lesson, and the animator's template carries a stand-in, so it must be checked and replaced
on every build.

Writes OUT_DIR/icon_pNN.png (transparent PNG, the icon as the PDF draws it) for each page, and OUT_DIR/icons.json:
  pages[n]   file, hash, rgb (average colour of the opaque pixels), bbox in PDF points, "kind": "image" or "vector"
  groups     pages that share the same icon (the icon is usually one design in two colours: dark on light pages, light on dark)
  missing    pages with no icon found
A vector icon (drawn from paths) cannot be pulled out as a picture: the script then saves a 300 dpi crop of the page instead
(kind "vector", with the page background in it): rebuild such an icon from shape layers, as headericon.jsx does for one design.
"""
import hashlib
import json
import os
import sys


def main(pdf, out):
    import pymupdf   # imported here so the rest of the skill needs no PyMuPDF
    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(pdf)
    pages, missing = {}, []
    for i, page in enumerate(doc, 1):
        w, h = page.rect.width, page.rect.height
        found = None
        for info in page.get_image_info(xrefs=True):
            x0, y0, x1, y1 = info["bbox"]
            if (x1 - x0) <= 0.1 * w and (y1 - y0) <= 0.1 * w and y0 < 0.2 * h and x0 < 0.25 * w and info.get("xref"):
                found = info
                break
        if found:
            xref = found["xref"]
            pix = pymupdf.Pixmap(doc, xref)
            if pix.colorspace and pix.colorspace.n > 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            smask = doc.extract_image(xref).get("smask")
            if smask:                                  # the PDF keeps the transparency in a separate mask image
                if pix.alpha:
                    pix = pymupdf.Pixmap(pix, 0)
                pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
            path = os.path.join(out, "icon_p%02d.png" % i)
            pix.save(path)
            opaque, n = [0, 0, 0], 0
            samples = pix.samples
            step = pix.n
            for k in range(0, len(samples), step):
                if step == 4 and samples[k + 3] < 128:
                    continue
                opaque = [opaque[0] + samples[k], opaque[1] + samples[k + 1], opaque[2] + samples[k + 2]]
                n += 1
            rgb = [round(c / n) for c in opaque] if n else None
            pages[i] = {"file": path.replace("\\", "/"), "kind": "image", "alpha": bool(smask or pix.alpha), "rgb": rgb,
                        "bbox": [round(v, 1) for v in found["bbox"]],
                        "hash": hashlib.md5(pix.samples).hexdigest()[:8]}
            continue
        # vector icon: look for drawings in the top-left corner
        dr = [d for d in page.get_drawings() if d["rect"].x0 > 0.02 * w and d["rect"].x1 < 0.13 * w and d["rect"].y0 > 0.04 * h and d["rect"].y1 < 0.22 * h]
        if dr:
            r = dr[0]["rect"]
            for d in dr:
                r = r | d["rect"]
            r = pymupdf.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
            path = os.path.join(out, "icon_p%02d.png" % i)
            page.get_pixmap(dpi=300, clip=r).save(path)
            pages[i] = {"file": path.replace("\\", "/"), "kind": "vector", "alpha": False, "rgb": None,
                        "bbox": [round(v, 1) for v in r], "hash": "vec%d" % len(dr)}
        else:
            missing.append(i)
    groups = {}
    for n, p in pages.items():
        groups.setdefault(p["hash"], []).append(n)
    res = {"pages": pages, "groups": [{"hash": h, "pages": v} for h, v in groups.items()], "missing": missing}
    json.dump(res, open(os.path.join(out, "icons.json"), "w"), indent=1)
    print("page  kind    colour          file")
    for n, p in pages.items():
        print("%4d  %-6s  %-14s  %s" % (n, p["kind"], p["rgb"], os.path.basename(p["file"])))
    print("\ndistinct icons (by pixels):", len(groups), [g["pages"] for g in res["groups"]][:6])
    if missing:
        print("NO ICON FOUND on pages", missing, ": look at the page renders")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
