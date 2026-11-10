# The template, and traps found on earlier lessons

## Contents
- How the animator's template is built
- Wipe stacking
- Expressions that drive the slides
- Traps: template
- Traps: scripting (ExtendScript)
- Traps: process

## How the animator's template is built
(From an example template; confirm each point on yours with `probe_project.jsx` and `inspect_presets.jsx`.)
- **Slide comps** (`Slide 2 - Blue Card`, `Slide 3 - Red Card`, `Slide 4 - Tan`, `Slide 5 - Red Outline Card`): title, course name, card header, bullets B1-B5 (text, arrow, highlight each), a card with its track, a picture slot (a nested `IMG S#` comp holding a placeholder video), header icon, header line (static rule plus moving progress bar), and a nested background.
- **Backgrounds** (`BG Navy`, `BG Beige`): nested comps shared by several slides. Change a shared comp and every slide changes: duplicate it.
- **Intro** (`Intro - Title Card`: title, course name, play button, play ring, picture) and **outro** (`Outro - Thank You`).
- **Wipe**: a coloured band comp and a matte (alpha) comp.
- **Demo comp** (`... DEMO (assembled)`): the animator's own finished sequence; the reference for how layers stack.
- Slide comps are 15 s long; the template's own bullet times are spaced for narration.

## Wipe stacking
Per cut, top to bottom in the main comp: wipe band, wipe matte (hidden), the incoming slide with an alpha track matte from the matte layer. The outgoing slide lies below and runs 1.1 s past the incoming slide's start so the band covers it. `place_wipes.jsx` removes and rebuilds all of them, latest slide on top.

## Expressions that drive the slides
- Bullet text positions stack by measured line count (a line `var L=..,G=..,HL=44` sets line pitch and gap): changing text size means changing those numbers (`style_scenes.jsx` does).
- Arrows and highlights read their bullet's layer **by name**, quoted with double quotes: `thisComp.layer("B5 Text")`. A string replace on `'B5 Text'` silently does nothing. Duplicating a bullet needs the bare token `B5 Text` replaced everywhere.
- Exit fades use `thisComp.duration - 1.71` and `- 1.08`: everything fades out 0.6 s before the wipe starts. `nofade.jsx` moves them past the end of each comp.
- Highlight rectangles differ per bullet in some templates (bullet 1 of the outline-card slide is 131 px tall, the rest 73). `fix_highlights.jsx` resets every bar to 840 x 73 before sizing.

## Traps: template
| Symptom | Cause | Fix |
|---|---|---|
| Video slot shows a blue gradient | `replaceSource` keeps the placeholder's Gradient Ramp effect | remove the effects on the video layer |
| Picture changes on several slides | image comp shared | duplicate the nested image comp per slide |
| Two background colours on one slide, or template navy at the end | background layers locked and 15 s long; the slide was lengthened | unlock, extend to the comp end, relock (`fix_durations.jsx`) |
| Custom slide cut off early | custom comp is 15 s | extend the comp and its layer, then rerun `place_wipes.jsx` |
| Title or play icon vanishes before the wipe | the template exit fade | `nofade.jsx` |
| Extra bullets still follow B5 | expression names not replaced (quoting) | replace the bare name |
| Header icon invisible after replacing | new shape layers centre in the comp; the template's icon sat at 0,0 | set Position [0,0] (`headericon_fix.jsx`) |
| Intro title clipped by the picture | one long line | more lines, 92 pt |
| Red line moving along the header rule | the template's "Progress" shape in `Header Line`; the user does not want it in any video | `staticline.jsx`, then `fix_rule.jsx` (rerun after any scene rebuild) |
| Header rule white on beige / invisible navy on navy | background swapped but the rule kept the preset's colour | `fix_rule.jsx` |
| Faint text in the logo, or title/course name invisible | background swapped but logo comp, title and course colours stayed the preset's | swap the nested logo (`Logo - on beige` / `on navy`) and set title and course colours by background |
| Card fading in over red looks purple | the template's rise over a coloured background | left as is |
| Highlight covers one line of a two-line bullet | fixed 73 px bar | size from measured text height |
| Music level read -48 dB after a rerun | read the level while the fade keys existed | use a fixed base of 0 dB (the script does) |

## Traps: scripting (ExtendScript)
- ES3 only. No `let`, arrow functions, template strings, JSON.
- Joining an array into a string with `+` throws "invalid numeric result": use `.join(",")`. An Error object cannot be concatenated: use `e.message`.
- `setTemporalEaseAtKey` wants an array whose length matches the property (1 for opacity, 1-3 for position, 3 for scale): try each length (`easeAt` in `build_custom.jsx`).
- A box-text layer's position is its anchor: set the anchor to `[-w/2, -h/2]` so position equals the top-left corner.
- A locked layer ignores `outPoint` changes: unlock, change, relock.
- `TextDocument.allCaps` and `smallCaps` are **read-only**; assigning them throws, and a surrounding try/catch hides it. Switch caps off with `td.fontCapsOption = FontCapsOption.FONT_NORMAL_CAPS`. The template's titles are caps-formatted, so sentence case does not show until this is done.
- `TextDocument.characterRange(start, end).font = ...` bolds part of a text layer (needs the font's PostScript name).
- Reserved words as object keys (`{in: 1}`), chained ternaries and ES3 future-reserved words (`final`, `int`...) trigger a blocking syntax-error dialog in After Effects: `ae_run.ps1` lints for them.
- Footage placeholders in image comps are not always FileSource: match any non-text source layer.

## Traps: process
- **Audio**: always add the background music (`music.jsx`). It is a bed; do not transcribe or beat-match it (Whisper invents sentences from music) and do not time slides to it. A track far longer than the video is trimmed.
- **Pacing**: with no narration the reading time sets every length. A fixed 15 s per slide looks wrong at both ends.
- **One decision at a time**: one lesson used red as a video-wide background. That was that lesson's decision; this skill reads colours from the PDF each time.
- **Repeat checks on later frames**: highlights fine at the settled moment but wrong at the start, or text fading at the very end, were found only on screenshots from later times.
- **After a user correction, fix the class not the instance**: "the highlight is too big on slide 2" meant every slide's bars; "the title vanished before the wipe" meant every slide's exit fades.
- **Reverting**: a user asked to roll back highlight sizing that hugged the text. Keep the previous state easy to restore (one script, one number).
- **Never save** the project; never run the template organiser on a finished lesson (it can break wipe mattes).
