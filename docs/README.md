# docs/ — the course website

Static, no-build-step site serving the course. Published by GitHub Pages from
this folder (`main` branch, `/docs`) at:

**https://roryquarrier.github.io/igcse-english-refresher/**

| File | Role |
|---|---|
| `index.html` | app shell |
| `styles.css` | all styling (mobile-first, light/dark, print) |
| `app.js` | nav, hash routing, search, progress (vanilla JS) |
| `content.js` | **generated** — every section as pre-rendered HTML |
| `build.py` | regenerates `content.js` from `../course/` + `../README.md` |

## Editing the course
1. Edit the markdown in `../course/` (or `../README.md` for the overview).
2. Regenerate and publish:

```bash
cd docs && python3 build.py
git add -A && git commit -m "content: update" && git push
```

`.nojekyll` stops GitHub's Jekyll build from touching the files.

## Interactive quizzes
Multiple-choice questions live in `course/quizzes.json`, keyed by section id.
`build.py` attaches them to each section as `quiz` in `content.js`; `app.js`
renders them under the reading. Each question gives instant ✅/❌ feedback with
an explanation, locks once answered, and the section's best score is recorded.

To add or edit questions:

```jsonc
"module-04": {
  "title": "Reading quick check",
  "questions": [
    { "q": "What happens at midnight?", "options": ["A", "B", "C"], "answer": 0, "why": "Because…" }
  ]
}
```
`answer` is the 0-based index of the correct option. Then `python3 build.py`.

## Student progress system
Everything is stored in `localStorage` under `igcse-english.progress.v2`:

```jsonc
{ "v": 2, "name": "Ah Ming",
  "done":    { "module-02": true },
  "doneAt":  { "module-02": "2026-11-11T10:24:00Z" },
  "quiz":    { "module-02": { "answers": {"0":1}, "best": 10, "last": 10,
                              "total": 10, "attempts": 1, "sig": "…", "lastAt": "…" } } }
```

The **📈 My Progress** dashboard shows sections complete, quiz questions correct,
quizzes tried and quiz mastery %, plus a per-section table. **Export progress**
downloads that JSON so a teacher can collect it; **Import progress** restores it
on any device. `sig` de-duplicates attempts so revisiting a page does not
inflate the attempt count.
