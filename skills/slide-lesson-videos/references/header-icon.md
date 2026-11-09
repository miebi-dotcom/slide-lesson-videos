# Header icon and subtopic line

Every slide header has, from left to right: a **small lesson icon**, the **subtopic line** (the course or topic name), a rule under both, and the publisher's logo at the far right. The logo is the same in every lesson and is left alone. The icon and the subtopic line belong to the lesson.

## Why this needs its own step
The animator's template carries a stand-in icon from whichever lesson it was made for (for example a megaphone). It looks right, so it is easy to leave in place; it is wrong for every other lesson. The PDF is the only source of the correct icon.

## Steps
1. `python scripts/extract_icon.py <slides.pdf> _build/icons` saves `icon_pNN.png` per page (transparent PNG) and `icons.json`. Look at one dark and one light version.
2. `python scripts/plan_lesson.py _build/lesson.json` writes `header_icons.json` (scene name -> PNG) once `icons/icons.json` exists. Gate 1 fails if icons were never extracted.
3. `header_icon.jsx` with `header_icons.json`. It measures the template's icon, puts the PDF's picture in the same place at the same size (named `Header Icon (PDF)`), copies the in/out points, label and parent, and removes the stand-in. Run it again after rebuilding any slide.
4. Gate 2 (`precheck_ae.py`) reports a slide whose icon layer is not `Header Icon (PDF)`, and one whose picture is not the file expected for that page (a light/dark mix-up).
5. Zoom into the header of a rendered frame and look (workflow.md, step 7b).

## Edge cases
- **No icon on page 1** (the intro): normal, the intro has none.
- **A different icon on the last page**: possible; `icons.json` groups pages by picture, and each page uses its own.
- **Vector icon** (`kind: "vector"` in `icons.json`): the script saved a 300 dpi crop of the page, with the page background in it. Do not use that crop as the icon. Rebuild the icon from shape layers (stroke width and colour copied from the stand-in, round caps and joins) in the same box, and name the layer `Header Icon (PDF)`. `headericon.jsx` shows how one design was redrawn.
- **The icon is baked into the page background** (no separate image or vector): crop it from a page render and ask the user for the original artwork.
- **The stand-in animates in** (opacity or scale keys): the replacement is static. If the template's entrance matters, copy the keys to the new layer.

## The subtopic line
It is client wording and styling: it keeps its capitals, spelling and punctuation exactly as the PDF has them ("Introduction to Sustainable Gardening" stays in title case). `text_rules.py` returns it unchanged (kind `keep`), the planner copies it from the spec as is, and gate 2 fails if the text in a slide differs from `course` in the spec.
