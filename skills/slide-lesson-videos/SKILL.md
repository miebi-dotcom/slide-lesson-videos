---
name: slide-lesson-videos
description: Builds a slide-style lesson video (Google Vids style, no tutor on screen, narration added later) in Adobe After Effects from the animator's template. A slide-deck PDF plus the animator's images and videos become animated slides with title, cards, bullets and highlights, timed to reading time, with wipes between slides, background music and a thank-you outro. Colours come from the PDF, text is put into British English, sentence case and full punctuation, and three quality gates catch mistakes before the final QA. Use this whenever someone wants to build, rebuild, fix or hand over a slide lesson, a Google Vids deck, a "Slide 2 / Slide 3" template lesson, or says things like "build the lesson video from this PDF", "the audio is added later", "turn this deck into an AE video", "colour the slides from the PDF", "check the text before QA" - even if they do not name the skill. Do NOT use it for lessons with a tutor recording (use building-lesson-videos).
---

# Slide lesson videos in After Effects

A slide lesson is a PDF deck rebuilt as animated slides in the animator's After Effects template. Nothing is narrated: the audio (or a soft music bed) is added after the video, so every timing comes from **reading time**, not from a recording. The work is a pipeline of small scripts run inside the user's open After Effects, driven by one data file per lesson (`lesson.json`). Your job: read the PDF, make the creative decisions the template cannot, run the steps in order, and **check every step before the user's own QA** - the three gates below exist because every rework on the first lesson was something a cheap check could have caught.

## Requirements
- Windows, After Effects 2023+ **open with the lesson project** (the animator's template saved into the lesson folder). Python 3 with `pymupdf pillow`; Node.js optional.
- First time on a machine: `powershell -NoProfile -ExecutionPolicy Bypass -File ${CLAUDE_SKILL_DIR}/scripts/setup_check.ps1` (add `-Install` after asking). In After Effects tick *Preferences > Scripting & Expressions > Allow Scripts to Write Files*.
- Keep all working files in `<lesson folder>/_build/` so any step can be rerun. **Never save the project** unless the user asks; every script uses one undo group.
- Run Python scripts that read the PDF **without** `-I` (isolated mode hides user-installed pymupdf). `text_rules.py` and the planners have no dependencies.

## Running After Effects scripts
**Check which project is open first.** People keep several lessons open, and a script that writes to the wrong one changes someone else's work (this happened once: a script landed in another lesson's intro and had to be undone). Look at the After Effects title bar, set `project` in `lesson.json`, and put `"project": "<file>.aep"` in every data file you write by hand. The runner refuses to run when that project is not the one open.

```
powershell -NoProfile -ExecutionPolicy Bypass -File ${CLAUDE_SKILL_DIR}/scripts/ae_run.ps1 -Script ${CLAUDE_SKILL_DIR}/scripts/jsx/<name>.jsx -DataFile <input.json> [-Timeout 300]
```
The JSON file arrives in the script as `DATA`; the result is a `toSource` object with `done`, `warnings`, `errors`. Act on every warning and error. A timeout with no result means After Effects is blocked by a dialog: ask the user to click OK. Address comps by **id** (templates reuse names); `probe_project.jsx` lists them. Each script's header documents its `DATA`; read it before use. Write scripts with the Write/Edit tools, never with shell text substitution (a sed edit broke a script's syntax once).

## The pipeline
```
- [ ] 0. Inputs: PDF, template, images/videos, audio. Ask what the audio is. Probe the template.
- [ ] 1. Read the PDF: text, page renders, COLOURS (pdf_palette.py) and the header ICON (extract_icon.py)
- [ ] 2. Write lesson.json (text from the PDF, colours from the PDF, presets from the template)
- [ ] 3. Plan: plan_lesson.py -> text rules applied -> GATE 1 (precheck_plan.py) until 0 errors
- [ ] 4. Build 2-3 slides, QC them, then the rest (build_scenes, style_scenes)
- [ ] 5. Slides with no picture slot, intro, outro, consistency fixes; REMOVE THE RED HEADER-LINE BAR (staticline.jsx + fix_rule.jsx), set title/course/logo/rule colours by background
- [ ] 6. Wipes between slides, music
- [ ] 7. GATE 2 (precheck.jsx + precheck_ae.py) until 0 errors, then GATE 3 (QC frames, every slide)
- [ ] 7b. LOOK AT THE HEADER one last time: the lesson's own icon, and the subtopic line exactly as the PDF has it
- [ ] 8. Report
```
Full commands, data shapes and the rerun order are in [references/workflow.md](references/workflow.md). Read it before step 0.

### Step 0-1: inputs and colours
1. List the lesson folder. Match each video to its slide by the number in its file name, then by title words; list anything unmatched and ask. Do not take pictures from the PDF when the animator supplied videos (one exception: a slide with no video, see workflow.md).
2. **Background music is always part of the build.** The animator supplies a music file (often several lengths: pick the one the user names, and ask if unclear). Set `audioFile` (full path) and `audioPrefix` (start of the file name) in `lesson.json`; `music.jsx` imports it, puts it at the bottom of the main comp, fades it in and out and trims it to the video. Never finish a build without the music layer. The music is only a bed: **do not analyse, transcribe or beat-match it, and do not time slides to it.** Slides are paced by reading time. Tracks are usually much longer than the video; trimming is correct. Only if the user says a file is narration is it a different job.
3. `python ${CLAUDE_SKILL_DIR}/scripts/extract_slides.py <pdf> _build/slides` then read `slides.md` and look at `page_XX.png`. Exports drop letters ("a ected" for "affected"): fix them against the renders.
4. `python ${CLAUDE_SKILL_DIR}/scripts/pdf_palette.py <pdf> _build` gives each page's background, card fill and text colour. **Colours come from the PDF, never from the template and never from memory.** Pages alternate between two or three backgrounds; the template may have a comp for only some of them (build the missing ones with `setup_bg.jsx`).
5. `python ${CLAUDE_SKILL_DIR}/scripts/extract_icon.py <pdf> _build/icons` saves the **lesson icon** from the PDF: the small icon beside the subtopic line in the header (top left, not the publisher's logo at top right). Every lesson has its own, and the template only carries a stand-in, so it must be replaced on every build (see "Header icon and subtopic line" below).
6. Probe the template (`probe_project.jsx`, `inspect_presets.jsx`) and note its gaps against the deck: a layout the deck uses that the template lacks (two cards, four numbered cards, no-picture slides, a background colour), more bullets than slots. Decide how each is covered (workflow.md) or ask.

### Step 2-3: the spec and the first gate
Fill `lesson.json` from [references/spec-format.md](references/spec-format.md) (a complete example is in `assets/lesson-spec.example.json`). Then:
```
python ${CLAUDE_SKILL_DIR}/scripts/plan_lesson.py _build/lesson.json
python ${CLAUDE_SKILL_DIR}/scripts/precheck_plan.py _build/lesson.json --slides _build/slides/slides.json --palette _build/palette.json
```
`plan_lesson.py` runs every block of text through the house text rules and writes `text_changes.md`: **read it and show the user the edits that need judgement** (proper nouns, quotations, "program"). Do not build until `precheck_plan.py` reports 0 errors, and say what each warning means for the slides.

## Header icon and subtopic line (check these at the end of every build)
The header of every slide has the publisher's logo at the right (leave it) and, at the left, a **small lesson icon followed by the subtopic line** (the course or topic name, e.g. "Introduction to Sustainable Gardening").
- **The icon is the lesson's own.** Whatever icon the template shows is a stand-in from another lesson. After building, run `header_icon.jsx` with the PNGs from `extract_icon.py` so every slide carries the PDF's icon, then **look at a frame zoomed into the header** to confirm. Gate 2 fails a slide whose icon is still the template's, or is the wrong colour version for that page (dark on light pages, light on dark pages). Details: [references/header-icon.md](references/header-icon.md).
- **The subtopic line is never touched.** Not its capitals, spelling, punctuation or wording: it stays exactly as the PDF has it, on every slide including the intro. The text rules skip it, and gate 2 fails if it differs from `course` in the spec (which is copied from the PDF as is).

## Things the skill never changes
- The subtopic line beside the header icon (verbatim).
- The lesson topic's capitals: it stays in CAPITALS (only British spelling applies).
- The publisher's logo, and the wording of the slides (the rules fix spelling, case and punctuation only; suspected mistakes in the source are flagged to the author, never silently changed).

## Header line: no red progress bar (mandatory, user decision)
The template's header line is a static rule with a **moving red progress bar** drawn over it. It does nothing useful in a lesson video, so **it must not be in the finished video, on any slide**. Every build:
1. Run `staticline.jsx` (switches off every "Progress..." shape of each `Header Line` layer, leaving the static rule). Data file: just `{"project": "<file>.aep"}`.
2. Run `fix_rule.jsx` with `{"project", "scenes": [{"name", "bg": "navy"|"beige"}]}` so the remaining rule is **white on navy, navy on beige**. Slides whose background was swapped otherwise keep the preset's rule colour (white rule on beige, or an invisible navy rule on navy).
3. Zoom into the header of one beige and one navy slide: one thin line, no red on it. (The progress line inside the card is a separate element.)
Rerun both after any scene rebuild (`build_scenes` brings the red bar back). Likewise after a background swap set the title, course-name and logo (`Logo - on navy`/`on beige`) by background.

## House text rules (applied automatically, checked at every gate)
1. **British English.** Any American spelling is changed (organize, color, center, analyze, behavior, defense...). Words whose spelling depends on meaning (program/programme, license/licence, disk/disc, ton/tonne) are flagged for a person, not changed.
2. **Sentence case, except the lesson topic.** Only the first letter of a sentence is a capital in headers, bullets, card titles, the course name and the outro line. **The lesson topic at the top of each slide, and the intro title, stay in CAPITALS** (British spelling only, no full stop); they are never converted to sentence case. Kept capitals: acronyms (NASA, UN, SMART), protected proper nouns (`text.proper_nouns` in the spec), words with an inner capital (pH, mRNA). The letter after a colon is lower case. The template may have all-caps switched on: gate 2 checks and can switch it off.
3. **Every sentence is punctuated.** Bullets and headers end in a full stop (or `?`, `!`, or `:` when the line introduces a list); titles end with no full stop; spacing around punctuation is tidied.
The rules never change wording, and they never touch the subtopic line. A suspected source mistake ("an ecologists") is flagged for the author. Details and how to extend the rules: [references/text-and-style.md](references/text-and-style.md).

## Quality gates (run them; do not wait for the user's QA)
| Gate | When | What it catches | Command |
|---|---|---|---|
| 1 Plan | after `plan_lesson.py`, before any build | missing files, wrong preset or colour name, dropped PDF content, text that breaks the rules, bullets that cannot fit, low contrast | `precheck_plan.py` |
| 2 Project | after the build, before QC frames | template text left behind, text off-margin or in the wrong colour, all-caps on, broken expressions, layers that stop early, wrong background, slide timing off plan, wrong number of wipes, music not cut | `precheck.jsx` then `precheck_ae.py` |
| 3 Frames | last | what only eyes can see: highlight alignment, overlap, vanishing elements, wipe look | `qc_times.py`, `qc_frames.jsx`, `contact_sheet.py` |
Gate 2 must be run again after *any* fix and after any change of slide length. Gate 3 samples four moments per slide (after bullet 1, after bullet 2, all bullets in, last moment before the wipe) and the frame after every cut; a single settled frame hid most of an earlier lesson's problems. Details: [references/qa-gates.md](references/qa-gates.md).

## Rules that save rework
- Change nothing shared: duplicate the template's background and image comps before editing (a shared comp changes every slide).
- After any change of slide length: `fix_durations.jsx`, then `place_wipes.jsx`, then gate 2.
- Build 2-3 slides, look at them with the user's eye, then build the rest.
- Do not run the template organiser on a finished lesson: it can break the wipe mattes.
- Ask before replacing anything the user placed; report anything you changed outside the plan.
- A fade that "feels right" in the template (every element fades 0.6 s before the wipe) makes titles and icons vanish early here: `nofade.jsx` removes it.

## Report
End with: slides built (page -> comp), text edits that need a human decision, template gaps and how each was covered, gate results (errors fixed, warnings left and why), what the user still has to do (add narration if it is wanted; any slide with a missing video; anything flagged in the source text), and that the project is **not saved**.

## References
- [references/workflow.md](references/workflow.md): every step with commands, data shapes, rerun order.
- [references/spec-format.md](references/spec-format.md): the `lesson.json` fields.
- [references/text-and-style.md](references/text-and-style.md): text rules, pacing, hierarchy, highlights, colour.
- [references/header-icon.md](references/header-icon.md): the lesson icon and the subtopic line.
- [references/qa-gates.md](references/qa-gates.md): the three gates and the manual checklist.
- [references/template-and-gotchas.md](references/template-and-gotchas.md): how the template is built, and traps found on earlier lessons.
