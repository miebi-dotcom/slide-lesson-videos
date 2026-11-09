# Quality gates

The aim: the user's own QA should find almost nothing. Every item below was a real rework on an earlier lesson.

## Contents
- Gate 1: plan
- Gate 2: project
- Gate 3: frames
- Manual checklist
- Habits

## Gate 1: plan (before any build)
`python K/precheck_plan.py _build/lesson.json --slides _build/slides/slides.json --palette _build/palette.json`

| Finding | Meaning and fix |
|---|---|
| ERROR video not found | wrong `videoDir` or file name; ask the user |
| ERROR textColor / preset not in the spec | a name used on a page is missing from `textColors` / `presets` |
| ERROR text breaks the rules | the planner's output is not clean: a bug in the spec (e.g. `text.keep_spelling`) or a rule gap |
| ERROR bullets do not fit at 22 pt / more than 7 bullets | shorten, split the slide, or ask the user |
| ERROR contrast under 3:1 | the PDF's own colours fail; report it, do not recolour silently |
| ERROR PDF pages not in the spec | a slide would be missing from the video |
| WARN words on the PDF page not in the spec | a bullet may be missing, or the PDF dropped letters |
| WARN bullets fitted to a small size | text too long for the card |
| WARN same text on several slides | a copy-paste error |
| WARN background has no comp | build it with `setup_bg.jsx` |

## Gate 2: project (after the build, before frames)
```
AE precheck.jsx {"out":"_build/ae_dump.json","mainId":<id>,"audioPrefix":"<music>","fixCaps":true}
python K/precheck_ae.py _build/lesson.json _build/ae_dump.json --palette _build/palette.json
```
`precheck.jsx` reads every scene comp and the main comp and changes nothing (except switching all-caps off when `fixCaps` is true). `precheck_ae.py` reports:

| Finding | Usual cause and fix |
|---|---|
| text breaks the rules | text edited in AE, or a scene built before the rules; rebuild it from the spec |
| template text left behind | a bullet slot not disabled or filled; `disable` list or bullet count |
| text not in the plan | a stale scene or a hand edit |
| all-caps / small-caps on | the template titles are caps-formatted (`allCaps` cannot be assigned; the scripts use `fontCapsOption`): rerun `precheck.jsx` with `fixCaps` true |
| text outside margins / too low | text too long: shorten or `fitWidth`; rerun `style_scenes.jsx` with `"refitOnly": true` |
| text colour not the PDF's | rerun `fix_textcolor.jsx` |
| contrast under 3:1 | colour or card fill wrong for that page |
| broken expression | a template expression that references a renamed layer; fix the name or the expression (see gotchas) |
| background stops early | rerun `fix_durations.jsx` |
| background is not the planned one | `style_scenes.jsx` did not swap it; check `bgIds` |
| scene starts or runs differently from the plan | rerun `build_scenes` / `place_wipes` |
| header icon is still the template's stand-in / wrong icon for the page | run `header_icon.jsx` with the PNGs from `extract_icon.py` |
| the subtopic line was changed | restore the PDF's exact text; the rules never touch it |
| N scenes need N-1 wipes | rerun `place_wipes.jsx` |
| music ends after the video | rerun `music.jsx` |

Rerun gate 2 after every fix and after any change of length. Warnings are read, not ignored: say in the report why a remaining warning is acceptable.

## Gate 3: frames
```
python K/qc_times.py _build/lesson.json _build/qc.json
```
Render each batch with `qc_frames.jsx` (it writes PNGs named by time), then `python K/qc/contact_sheet.py <sheet.png> <frames> --cols 4` per slide. Four moments per slide plus the frame after each cut:

| Moment | Looks for |
|---|---|
| after bullet 1 | title clipped by the picture, first highlight too big or misaligned, wrong colours |
| after bullet 2 | highlights overlapping, highlight not on its own bullet, a bar left from the previous bullet |
| all bullets in | overflow into the header line or card edge, bullets too close, uneven spacing, small text |
| last moment before the wipe | title, icon, card or header already faded out, anything vanished early |
| header (zoom in) | the icon is the lesson's own and level with the subtopic line; the subtopic line is untouched |
| after each cut | wrong background colour, two colours on one slide, wipe not covering the old slide |

Also look at: the intro (title fit, play button contrast), the outro, one frame from each video (is it frozen on the right frame, muted), and the music fades by checking the layer, not by ear.

## Manual checklist (things no script can judge)
- [ ] Read every slide's text once for wording the rules cannot see (typos in the source, meaning).
- [ ] Highlights sit behind the right words and are the same size on every slide.
- [ ] Slides with the same layout look the same (card position, text size, spacing).
- [ ] No slide shows two background colours, and none shows the template's navy.
- [ ] Timing feels right: the reader finishes each bullet before the next arrives.
- [ ] **Header icon** is the lesson's own (not the template's stand-in), on every slide, in the right colour for its background; **subtopic line** is exactly as in the PDF. Zoom into the header of a rendered frame to check.
- [ ] Header icon, header line and play button match the PDF's look and contrast with their background.
- [ ] Nothing was saved: confirm the project is untouched on disk.

## Habits that make the gates work
- Run gate 1 after every edit of `lesson.json`, gate 2 after every AE change. They take seconds.
- Look at late frames of long slides, not only settled ones. Most early-fade and early-end problems only show there.
- When a check fails, find the cause before editing (a missing background extension was the cause of a "two colours" bug, not the colour).
- A user screenshot with a circle on it is the best QA there is: reproduce the exact frame, fix, and add the case to the gate if a script could have caught it.
