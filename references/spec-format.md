# lesson.json: the one data file per lesson

`assets/lesson-spec.example.json` is a complete, real example (ids in it belong to that lesson's project). Colours are 0-255 RGB and come from `palette.json`.

## Top level
| Key | Meaning |
|---|---|
| `code` | Lesson code, used in folder names |
| `course` | Course name shown on every slide (the text rules run on it) |
| `mainId` | Id of the main comp (from `probe_project.jsx`) |
| `work` | The `_build` folder; every generated file goes here |
| `videoDir` | Folder holding the animator's videos |
| `presets` | Name -> template comp id: `intro`, `outro`, and one per slide style (e.g. `outline`, `blue`, `redcard`, `tan`) |
| `slots` | Layer indices of the template's slide comp. Only set what differs from the defaults in `plan_lesson.py` |
| `bgIds` / `bgNames` | Background name (e.g. `red`) -> comp id / comp name. Colours not in the template are built with `setup_bg.jsx` |
| `textColors` | Name -> RGB of each text colour in the PDF (e.g. `navy`, `white`) |
| `cardColor`, `customTextColor`, `trackColor` | Card fill and text colour for custom slides; the track colour used on dark cards |
| `boldFont` | Font used for the bold lead-in ("Term:") of a bullet |
| `customBaseId` | Template comp copied to make custom slides |
| `wipe` | `{"bandId", "matteId"}` of the template's wipe comps |
| `audioPrefix` | Start of the music layer's name in the main comp |
| `text` | `proper_nouns` (phrases that keep their capitals), `acronyms` (extra ones; others are learned), `keep_spelling` (words to leave alone), `cap_after_colon` (default false) |
| `pacing` | Optional overrides: `first` 2.6, `gap_min` 2.0, `gap_max` 3.6, `per_word` 0.2, `hold_min` 4.0, `hold_per_word` 0.1, `slide_min` 11 |
| `custom` | Page -> length in seconds for custom slides; `null` works the length out from the card timings |
| `intro` / `outro` | `{"title": "Introduction\|to sustainable\|gardening", "video": "slide 1.mp4", "bg": "red"}`; `\|` marks where the intro title breaks lines |
| `firstSlideAt` | Start of page 2 in seconds (default 9.0: the intro length minus the wipe) |

## Pages
`pages` maps the page number (string) to:
```
"3": { "title": "TYPES OF SOIL",      as in the PDF; the rules change the case
       "header": "Optional card header:",                 empty or absent = no header
       "bullets": ["Pollution: Air, water, soil", "~Plain line: no arrow or highlight"],
       "preset": "redcard",  "bg": "red",
       "cardFill": [10,55,83] | absent,                   from palette.json; absent = the preset's own card
       "textColor": "white",                              a key of textColors
       "video": "Slide 3.mp4" | absent }
```
Custom slides (no picture slot) add `kind` and `cards`:
- `"kind": "two"`: `cards: [{"header": "...", "items": [{"text": "..."}]}, {...}]`
- `"kind": "four"`: `cards: [{"num": "01", "title": "...", "text": "...", "size": 30}, ...]`
Times (`t`, `th`) are filled in by reading order; give them only to override.

A bullet starting with `~` is a plain line. At most 7 bullets per slide.
