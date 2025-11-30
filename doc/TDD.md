# Technical Design Document – Space Times Trainer

## Overview
Browser-based multiplication practice app for kids (1–10 tables) with two modes (single table, mixed set), lightweight spaced repetition within sessions, discreet feedback sounds, persistence, and multi-player selection stored locally (no backend).

## Architecture
- **Frontend only**: Plain HTML/CSS/JavaScript; no build tooling.
- **State management**: In-memory session state for current queue, score, and feedback; persistent state per player in `localStorage`.
- **Audio**: Short built-in audio assets (base64 or small files) triggered on correct/incorrect answers with volume controls; must be optional/muted toggle.
- **Data persistence**:
  - Players stored as small records keyed by ID: `{ id, name, lastSessionAt, stats, factStreaks }`.
  - `factStreaks` map key `a|b` (e.g., `3|7`) to `streak` and `recentMisses` count.
  - Session summary stored as last-run snapshot for the player to bias future queues.
- **Queue/spaced repetition**:
  - Session deck contains fact cards with fields: `a`, `b`, `streak`, `dueWeight`, `seen`, `lastResult`.
  - Wrong answers: reset streak, push multiple copies near front; adjust `dueWeight` lower index.
  - Correct answers: increment streak, reduce frequency; still occasionally resurfaced by shuffling a tail window.
  - Mixed mode uses all 1–10 combinations; single mode fixes the table (e.g., `x7`).
  - Session length configurable; default to e.g., 15–20 prompts or “run until stop” with cap.

## Components / Screens
- **Login/Player select**: Dropdown of existing players, add-new input, continue button; shows current active player chip.
- **Mode select**: Radio for `Single table` with slider (1–10) and `Mixed set`.
- **Play screen**: Prompt text (e.g., `3 × 7 = ?`), large input and keypad, feedback line, progress (current question/total), score tally, mode label.
- **Summary**: Correct/incorrect counts, accuracy, encouragement, buttons to play again or switch player.
- **Controls**: Mute/unmute for sounds, optional reset data per player (later/hidden in MVP).

## Data Structures
- `Player`: `{ id: string, name: string, factStreaks: Record<factKey, FactStats>, lastSession?: SessionSummary }`
- `FactStats`: `{ streak: number, misses: number }`
- `Card`: `{ a: number, b: number, streak: number, dueWeight: number, seen: number, lastResult?: 'correct' | 'wrong' }`
- `SessionState`: `{ mode: 'single' | 'mixed', table: number | null, queue: Card[], asked: number, correct: number, incorrect: number, history: Attempt[] }`
- `Attempt`: `{ a: number, b: number, answer: number, correctAnswer: number, result: 'correct' | 'wrong' }`
- `Storage shape`: `{ players: Player[], activePlayerId?: string, settings: { soundOn: boolean } }`

## Algorithms
- **Initialize deck**:
  - Single: generate `a` from 1–10 with fixed `b = selectedTable`.
  - Mixed: generate all 1–10 pairs or a sampled subset (e.g., 20 cards) shuffling.
  - Seed streaks from player `factStreaks` to set initial `dueWeight` (higher streak → lower weight).
- **Next card selection**:
  - Maintain queue array; after each answer, modify queue:
    - Wrong: insert 2 copies of the card within next 3 positions; set `dueWeight` low.
    - Correct: increase streak; reinsert at tail if session continues beyond base length, else discard when mastered for this session.
  - Every turn, shuffle a small tail window (e.g., last 4–6 items) to reduce predictability.
  - Stop when `asked` reaches session target or queue empty (if run-short mode).
- **Scoring**:
  - `score = correct`; accuracy displayed as `correct / asked`.
  - Summary builds from session state.
- **Persistence update**:
  - After session, update player `factStreaks`: correct increments streak, wrong resets streak and increments misses.
  - Store last session summary and active player selection in `localStorage`.

## Audio Handling
- Two short sounds (correct/incorrect) loaded once; play only if `settings.soundOn` and respecting user gesture requirement (play after first input).
- Provide mute toggle; default to on at low volume.

## UX Details
- Big text and buttons; single primary action; keypad for touch.
- Subtle feedback colors (green/red) with short text; no flashing.
- Progress label `Q X/Y`; score label live.
- Accessible: support Enter key submission; focus management on card change.

## Validation / Testing
- Manual flows:
  - Add player, select, start single table, answer correct/wrong, ensure wrong repeats soon.
  - Mixed mode queue feels varied; cap respected.
  - Sounds toggle works and is quiet.
  - Refresh page: player list persists, active player remembered, streaks influence queue (missed facts appear sooner).
  - Summary shows counts; play again reuses preferences.
- No automated tests planned for MVP; keep logic modular in `script.js` for later testing.

## Open Items
- Exact session length default (propose 15).
- Whether to show a gentle “pause/stop” during session.
- Potential “reset player data” control placement.
