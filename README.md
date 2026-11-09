# slide-lesson-videos

A [Claude Code](https://claude.com/claude-code) skill that builds slide-style lesson videos (the "Google Vids" look, no tutor on screen, narration added later) in **Adobe After Effects** from an animator's template, a slide-deck PDF, and the animator's images and videos.

What it does:
- Rebuilds each PDF page as an animated slide (title, cards, bullets, highlights), timed to reading time, with wipes between slides, a music bed and an outro.
- **Reads colours from the PDF** (page background, card fill, text colour) instead of guessing.
- Applies house text rules automatically: **British English**, **sentence case** (the lesson topic stays in capitals) and **full punctuation**. Every edit is logged for review.
- Runs three quality gates before manual QA: a plan check, a project check inside After Effects, and sampled frames.

## Install
This repository is a Claude Code plugin marketplace with one plugin. In Claude Code:

```
/plugin marketplace add miebi-dotcom/slide-lesson-videos
/plugin install slide-lesson-videos@slide-lesson-videos
```

On Claude Code 2.1.275 or later one line does both:

```
/plugin install slide-lesson-videos --marketplace miebi-dotcom/slide-lesson-videos
```

Prefer to install by hand? Copy the folder `skills/slide-lesson-videos` into your skills folder, for example `~/.claude/skills/slide-lesson-videos`. Then ask Claude to build a slide lesson; the skill loads by itself.

Requirements: Windows, After Effects 2023 or newer open with the lesson project, and Python 3 with `pymupdf` and `pillow`. Run `skills/slide-lesson-videos/scripts/setup_check.ps1` to check a machine. In After Effects enable *Preferences > Scripting & Expressions > Allow Scripts to Write Files*.

## Layout
- `.claude-plugin/`: the marketplace and plugin manifests.
- `skills/slide-lesson-videos/SKILL.md`: the entry point Claude reads (pipeline, rules, gates).
- `skills/slide-lesson-videos/references/`: workflow, spec format, text and style rules, quality gates, template notes and gotchas.
- `skills/slide-lesson-videos/scripts/`: Python tools (`extract_slides.py`, `pdf_palette.py`, `plan_lesson.py`, `text_rules.py`, `precheck_plan.py`, `precheck_ae.py`, `qc_times.py`), the After Effects scripts in `skills/slide-lesson-videos/scripts/jsx/`, and tests in `skills/slide-lesson-videos/scripts/tests/`.
- `skills/slide-lesson-videos/assets/lesson-spec.example.json`: an invented example of the per-lesson spec.

Run the tests with `python -I -m unittest discover -s skills/slide-lesson-videos/scripts/tests`.

The After Effects scripts expect the layer names of the animator's template (see `references/template-and-gotchas.md`); a different template needs its slot indices set in the spec.

## Licence
MIT.
