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
