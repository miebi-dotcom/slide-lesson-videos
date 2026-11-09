# Workflow: every step, with commands and rerun rules

All commands run from the lesson folder. `K` = `${CLAUDE_SKILL_DIR}/scripts`. `AE` = `powershell -NoProfile -ExecutionPolicy Bypass -File K/ae_run.ps1 -Script K/jsx/<x>.jsx -DataFile _build/<x>.json`.

## Contents
- Step 0 Probe
- Step 1 Read the PDF
- Step 2-3 Spec, plan, gate 1
- Step 4 Build and style
- Step 5 Custom slides and consistency fixes
- Step 6 Wipes and music
- Step 7 Gates 2 and 3
- Rerun order
- Covering template gaps

## Step 0: Probe
- `probe_project.jsx` (no data): comps, footage, `lessonType` (should say "slides"), intro/outro comps, wipe comps (`transitionComps`), the template's own demo comp (`demoComps`; it shows how the animator stacks a finished sequence).
- `inspect_presets.jsx` `{"ids":[...]}` for each slide comp: text layer indices, image slots, timing. Slot indices differ between templates: **never assume them**; if they differ from the defaults in `plan_lesson.py` (title 24, course 26, header 5, bullets 10/9/8/7/6) put the real ones in `spec.slots`.
- `new_main_comp.jsx` `{"name": "<code> MAIN", "likeId": <demo comp id>, "duration": <plan total + 5>}` if the template has no main comp yet. Returns `mainId`.

## Step 1: Read the PDF
- `python K/extract_slides.py <pdf> _build/slides` -> `slides.md`, `slides.json`, `page_XX.png`.
- `python K/pdf_palette.py <pdf> _build` -> `palette.json` (and a table). Check the card colours against the renders; a picture behind a card gives an average. Page contrast under 4.5 is flagged (large text passes at 3:1).
- `python K/extract_icon.py <pdf> _build/icons` -> `icons/icon_pNN.png` (transparent) and `icons/icons.json`: the small lesson icon beside the subtopic line. Expect one design in two colours (dark on light pages, light on dark pages). Page 1 (the intro) usually has none. A vector icon is saved as a page crop: see references/header-icon.md.
- Page 1 is normally the intro (lesson title), the last page the outro. A page with no body text, or numbered "01 02 03" cards, is a custom slide (below).

## Step 2-3: Spec, plan, gate 1
1. Write `_build/lesson.json` (references/spec-format.md). Page text: paste from `slides.md` as written, after fixing dropped letters. Do **not** pre-apply the text rules by hand: `plan_lesson.py` does it and logs every edit.
2. `python K/plan_lesson.py _build/lesson.json` writes into `work`: `scenes.json`, `style.json`, `colors.json`, `custom.json`, `highlights.json`, `durations.json`, `music.json`, `wipes.json`, `timeline.json`, `text_changes.md`.
3. Read `text_changes.md`. Show the user anything that needs judgement. Add real proper nouns to `text.proper_nouns` and rerun.
4. `python K/precheck_plan.py _build/lesson.json --slides _build/slides/slides.json --palette _build/palette.json` -> 0 errors before building.

## Step 4: Build and style
1. Backgrounds the template lacks: `setup_bg.jsx` `{"fromId": <template bg comp>, "folderId": <its folder>, "name": "BG Red", "rgb": [..], "shade": [..]}` (rgb from `palette.json`, shade a darker tone). It returns `bgId`: put it in `spec.bgIds`, and the comp's name in `spec.bgNames`. It duplicates, so the template's shared solids are untouched.
2. `build_scenes.jsx` with `scenes.json`: duplicates the preset per slide, fills text, places on the main comp, retimes bullets. Scenes are named `S<page> <title>`. Rerunning replaces a scene of the same name.
3. `style_scenes.jsx` with `style.json`: background swap, card fill, bullets 6 and 7 (the template has five slots), plain lines (no arrow/highlight), bullet size fitting, bold lead-ins ("Term:"), and the video slot (removes the placeholder's gradient, hides label/icon, freezes the last frame, mutes the clip, slow push-in).
4. **Build 2-3 slides first** (`plan_lesson.py ... 2,3,4` writes only those pages), render frames (step 7 commands), fix, then build the rest.

## Step 5: Slides without a picture slot, and consistency fixes
- Custom slides (`custom.json`): `build_custom.jsx` builds two-card or four-card slides from the base comp (cards rise 90 px, text rises 30 px with ease, a play-triangle bullet, a highlight wiping in). Colours come from `cardColor` / `customTextColor` in the spec, i.e. from the PDF.
- Intro title clipped by the picture: `fix_intro.jsx` `{"scene":"S01 Intro","text":"...\r...","size":92}`; break the title over more lines before shrinking it.
- A slide with a missing video that needs a picture: `fix_still.jsx` `{"scene": "S17 ...", "file": "<png>", "push": 0.07, "assetsFolder": "...", "holdersFolder": "..."}` (the picture from the PDF, in its own copy of the image comp).
- `header_icon.jsx` with `header_icons.json` (written by `plan_lesson.py` once `icons/icons.json` exists): replaces the template's stand-in icon on every slide with the PDF's own, same place and size, named `Header Icon (PDF)`. **Always run it, then zoom into the header of a rendered frame** (references/header-icon.md).
- `fix_durations.jsx` with `durations.json`: lengthens custom comps and extends every scene's background (and any layer still ending at the template's 15 s) to the comp end. **Run after any change of slide length.**
- `fix_highlights.jsx` with `highlights.json`: every highlight bar starts from one 840 x 73 shape, takes its height from the measured text, and fades out before the next bar starts. Bars are full width with 40 px padding: the user rejected bars hugging the text.
- `fix_textcolor.jsx` with `colors.json`: text, header and arrows take the PDF colour.
- **The client's PDF changed after the build?** Do not rebuild. Run `pdf_palette.py` on the new PDF, diff it against the old (text per page, embedded-image hashes per page, palette per page), then `recolor.jsx` (card fills, text, arrows, highlight bars, and switching off the card's progress line) and `apply_text.jsx` + `style_scenes.jsx` with `refitOnly` (changed wording), and check gate 2 and gate 3. Only a changed picture or layout needs a rebuild of that slide.
- `nofade.jsx` (no data): removes the template's exit fade so titles, icons and cards stay until the wipe has covered them.
- **Mandatory, every lesson:** `staticline.jsx` (data `{"project": ...}`; switches off the red moving progress bar over the header line) then `fix_rule.jsx` (rule colour from each slide's background: white on navy, navy on beige). The user does not want the red line in any video. Check a zoomed header on a beige and a navy slide.
- Optional polish asked for on an earlier lesson (do them only when the PDF differs from the template): `headericon.jsx` + `headericon_fix.jsx` (swap the template's header icon for the PDF's: the shapes in the script are that lesson's briefcase-with-plus, redraw them for another icon), `playbtn.jsx` `{"scene","disc","glyph","ring"}` (the intro play button must contrast with the intro background).

## Step 6: Wipes and music
- `place_wipes.jsx` with `wipes.json`: one wipe per cut, stacked as the template's demo comp does (band, matte hidden, incoming slide with an alpha matte; the outgoing slide runs 1.1 s past the next start). Needs `spec.wipe.bandId` and `matteId` (probe: `transitionComps`).
- `music.jsx` with `music.json`: fades in 2.5 s, out over the last 5 s, level at 0 dB, cut at the video end. The music layer must already be in the main comp (the user adds it). If the track is longer than the video it is trimmed, not stretched.

## Step 7: Gates 2 and 3
```
AE precheck.jsx  {"out": "_build/ae_dump.json", "mainId": <id>, "audioPrefix": "<music layer name>", "fixCaps": true}
python K/precheck_ae.py _build/lesson.json _build/ae_dump.json --palette _build/palette.json
python K/qc_times.py _build/lesson.json _build/qc.json
```
Fix every error, rerun `precheck.jsx`, repeat until clean. Then run `qc_frames.jsx` once per batch in `qc.json` (`compId`, `times`, `outDir`, `prefix`) and tile each batch with `python K/qc/contact_sheet.py <out.png> <frames...> --cols 4`. Look at every sheet (references/qa-gates.md lists what to look for).

## Step 7b: last look at the header
Render one frame of a light slide, a dark slide and the outro, crop the header (top left, the icon and the subtopic line) and enlarge it. Check: the icon is the lesson's own (compare with the PDF page render), it sits level with the subtopic text and is neither tiny nor blurry, it is the right colour for its background, and the subtopic line reads exactly as the PDF has it.

## Rerun order
`extract_icon` -> `plan_lesson` -> (`setup_bg`) -> `build_scenes` -> `style_scenes` -> `build_custom` -> `fix_still` / `fix_intro` -> `header_icon` -> `fix_durations` -> `fix_highlights` -> `fix_textcolor` -> `nofade` -> `staticline` -> `fix_rule` -> (`headericon`, `playbtn`) -> `place_wipes` -> `music` -> gate 2 -> gate 3.
`build_scenes` and `build_custom` replace by scene name, which discards styling on those scenes: after rebuilding a scene, rerun everything from `style_scenes` down for it. `place_wipes` removes and rebuilds all wipes, so it is always safe to rerun and must be rerun after any start or length change.

## Covering template gaps
| Gap | Cover it by |
|---|---|
| Background colour the template lacks | `setup_bg.jsx` from the PDF colour |
| More bullets than slots | `style_scenes.jsx` adds B6 and B7 by duplicating B5 (more than 7: split the slide or ask) |
| A bullet that is a lead-in or note | prefix it `~` in the spec: no arrow or highlight |
| No card header | leave `header` empty: the slot hides and bullets move up |
| Two-card or four-card layouts, or no picture | custom slide (`kind` two / four) |
| No video for a slide | the PDF picture via `fix_still.jsx`, and say so in the report |
| Colour of text on a card | `colors.json` from the PDF |
