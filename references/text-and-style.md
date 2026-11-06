# Text rules, pacing, hierarchy and colour

## Contents
- The three text rules
- Reviewing the edits
- Extending the rules
- Pacing
- Hierarchy and highlights
- Colour

## The three text rules
Implemented in `scripts/text_rules.py`; `plan_lesson.py` applies them, `precheck_plan.py` and `precheck_ae.py` re-check them (the second one on the text actually inside After Effects, so a hand edit in the project is caught too).

1. **British English.** A table of about 200 American spellings plus the `-ize`/`-yze` families (organize -> organise, analyze -> analyse). Case is kept (Color -> Colour, COLOR -> COLOUR). `size`, `seize`, `prize`, `capsize`, `citizen` and similar are protected. Context words (program, license, disk, ton) are *flagged*, not changed: "programme" is right for a plan, "program" for software. Leave a word alone with `text.keep_spelling`.
2. **Sentence case.**
   - First letter of a sentence is a capital; everything else is lower case. This covers headers, bullets, card titles, the outro line and the course name (not the lesson topic: see below).
   - Text typed in capitals is lower-cased first.
   - Kept: acronyms (all-caps words in mixed text, words in brackets such as "(NASA)", and `text.acronyms`), protected phrases (`text.proper_nouns`, e.g. "Paris Agreement", "World Bank"), words with an inner capital (pH, mRNA), the word "I".
   - After a colon the next letter is lower case ("Pollution: air, water, soil."). Set `text.cap_after_colon` to true if the client wants the other way.
   - "e.g." and "i.e." do not end a sentence.
3. **Punctuation.** Bullets and headers end with `.`, `?`, `!`, or `:` when they introduce lines that follow. The full stop goes after a closing bracket or quotation mark ("(e.g., a contaminated site)."). Titles lose a trailing full stop but keep `?`. Doubled marks, spaces before punctuation, and missing spaces after commas are fixed.

Block kinds: `topic` (the lesson topic at the top of every slide, and the intro title: **stays in capitals**, only British spelling and the closing full stop are touched), `title` (course name, outro line, card titles: sentence case, no full stop), `header`, `bullet`. Card numbers ("01") are skipped. The template shows topics in caps through formatting, so keep that formatting on for them (`apply_text.jsx` sets it for kind `topic`; `precheck.jsx` leaves the layers named `Title` and `Lesson Title` alone). The rules also leave dashes as typed: an em dash in "CASE STUDY — THE PARIS AGREEMENT" stays an em dash.

## Reviewing the edits
`text_changes.md` lists every edit. Look for:
- **Proper nouns that were lower-cased** (a country, organisation, standard). Add them to `text.proper_nouns` and rerun. The "suggested proper nouns" line lists capitalised mid-sentence words as candidates.
- **Quotations**: the letter after an opening quote is lower-cased by the strict rule. If the quote is a full sentence the client may want a capital: add the phrase to `proper_nouns`.
- **Program / license / disk / ton** flags.
- **a/an before a plural** ("an ecologists"): a probable mistake in the source. Do not fix silently: tell the author, keep the source text, and list it in the report.
The rules never rewrite wording. A spelling the table does not know is not caught: read each slide once.

## Extending the rules
Add spellings to `WORDS` in `text_rules.py`, then run `python -I -m unittest discover -s scripts/tests` from the skill folder; add a test for the new case. A new rule must be idempotent (running the rules on their own output changes nothing): `test_idempotent` checks it, and gate 2 relies on it.

## Pacing (reading time, because there is no audio)
- Title read alone first: the first bullet starts at 2.6 s.
- Gap after a bullet: `1.0 s + 0.2 s per word` of the bullet just shown, clamped to 2.0-3.6 s.
- Hold after the last bullet: `max(4 s, 0.1 s per word of the slide)` plus 1.4 s for the build to settle; a slide is at least 11 s.
- Wipe about 1.5 s; the outgoing slide runs 1.1 s past the next slide's start.
- Intro about 9 s before the first wipe; outro builds and holds 6-8 s.
- Text-heavy slides get the long end; say which slides you lengthened. The user can override with `pacing` or `custom`.
These came from a finished lesson (about 12 s per slide) and the first rebuild; they are defaults, not rules.

## Hierarchy and highlights
- The lead-in before a colon ("Pollution:") is bold, the explanation regular, so a slide reads term first.
- Plain lines (`~`) have no arrow or highlight; they introduce the lines below.
- Bullets fit by size: from 34 pt down by 2 pt until the last bullet ends above y 925. Under 28 pt gets a warning: shorten the text instead if you can.
- One highlight bar per bullet, full card width with 40 px padding, wiping in with its bullet and fading out before the next starts, so two bars are never on screen. Do not shrink bars to hug the text.

## Colour
- **From the PDF** (`pdf_palette.py`): page background, card fill and text colour per page. Pages alternate; text colour follows the card (white on dark cards, navy on light).
- Text colour must match on the main slide and in the animation: the template's own text colour differs from the PDF's, so `fix_textcolor.jsx` sets it on text, header and arrows.
- `pdf_palette.py` reports the background it sees along the page edge: on patterned pages that is a light spot of the pattern (230,59,49 here), not the base colour of the template's background comp (207,53,43). Compare the two on a rendered frame before recolouring a background.
- Contrast: body text on its card (or the page) at least 4.5:1, large text 3:1. Anything that falls below is flagged at gate 1; the fix is the client's (change the PDF colour), not a silent recolour.
- Header line: one static rule that contrasts with the background (light on dark pages, dark on light pages). The animated progress bar is switched off.
- Elements that would vanish into the background (a play disc the same colour as the background) are recoloured to contrast.
- A card fading in over a coloured background briefly looks tinted. It is the template's rise and was left as is; mention it if asked.
