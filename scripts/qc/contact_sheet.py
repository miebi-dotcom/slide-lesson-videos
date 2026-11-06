"""Tile QC frames into one labelled contact sheet so a whole scene can be checked in one image.

    python contact_sheet.py OUT.png frame1.png frame2.png ... [--cols 3] [--width 1536]

Labels each tile with its file name (qc_frames.jsx names files by time, e.g. S03_0002392.png = 23.92 s).
Requires Pillow (pip install --user pillow).
"""
import argparse
import os
from PIL import Image, ImageDraw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("frames", nargs="+")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--width", type=int, default=1536)
    a = ap.parse_args()
    frames = [f for f in a.frames if os.path.exists(f)]
    if not frames:
        raise SystemExit("no frames found")

    def frame_time(f):
        try:
            return int(os.path.splitext(os.path.basename(f))[0].rsplit("_", 1)[1])
        except (IndexError, ValueError):
            return 0
    frames.sort(key=frame_time)
    cols = min(a.cols, len(frames))
    tw = a.width // cols
    first = Image.open(frames[0])
    th = round(tw * first.height / first.width)
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols, th * rows), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    import time
    for i, f in enumerate(frames):
        for attempt in range(20):   # a frame may still be flushing to disk
            try:
                im = Image.open(f).convert("RGBA")
                break
            except OSError:
                time.sleep(0.5)
        else:
            print("skipped unreadable frame: " + f)
            continue
        bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(bg, im).convert("RGB").resize((tw, th))
        x, y = (i % cols) * tw, (i // cols) * th
        sheet.paste(im, (x, y))
        label = os.path.splitext(os.path.basename(f))[0]
        try:
            secs = int(label.rsplit("_", 1)[1]) / 100
            label = f"{label.rsplit('_', 1)[0]} {secs:.2f}s"
        except (IndexError, ValueError):
            pass
        draw.rectangle([x, y, x + 8 * len(label) + 8, y + 18], fill=(0, 0, 0))
        draw.text((x + 4, y + 3), label, fill=(255, 255, 0))
    sheet.save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
