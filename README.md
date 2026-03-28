# Space Times

Kid-friendly multiplication trainer (tables 1–10) built with plain HTML/CSS/JS. French-first UX, responsive, offline-only (no backend), spaced repetition for missed facts, optional per-question timer, keypad/keyboard input, optional browser-based text-to-speech and voice answers, and per-player local persistence (streaks, sessions, settings).

## GitHub Pages Deployment

- Branch `main` triggers the Pages workflow: `.github/workflows/pages.yml`.
- The workflow copies `index.html`, `style.css`, and `script.js` into `_site`, then deploys to GitHub Pages.
- You can also run it manually from *Actions* → **Deploy to GitHub Pages** → *Run workflow*.

## Local Development

Just open `index.html` in a modern browser—no build or backend required.

## Speech Features

- Prompt playback uses recorded assets from `tts_output/<lang>/` first when available for the current page language, then falls back to the browser Web Speech synthesis API.
- Voice answers use browser speech recognition support (`SpeechRecognition` / `webkitSpeechRecognition`) when available.
- Both features are disabled by default and stored per player.
- Browser support varies by device and browser; unsupported features are hidden automatically.
