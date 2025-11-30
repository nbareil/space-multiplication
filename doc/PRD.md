# Spaced Repetition Multiplication Trainer – PRD

## Background & Goal
- Help a 7-year-old practice 1–10 multiplication independently using spaced repetition so mistakes recur until mastered.
- Keep the experience playful, encouraging, and simple enough for solo use.

## Target User
- Primary: 7-year-old child learning multiplication facts (1–10).
- Secondary: Parent/grandparent who sets it up and reviews progress.

## Scope
- Web app (desktop/tablet/phone) running locally in the browser; no backend.
- Focus on multiplication facts up to 10; initial drills can target a single times table, then mix.
- Immediate feedback, encouragement, and a score summary at the end of a session.

## Success Metrics
- Child completes a short session without adult help.
- Accuracy improves within a session (fewer repeats of the same mistake).
- Time to first answer stays low (fast start, minimal setup).

## User Stories
- As a child, I can pick or be given a table (e.g., 7s) and answer quick questions.
- As a child, when I miss an answer, I immediately see the correct one and get to try it again later.
- As a child, I can see how many I got right and a friendly score at the end.
- As a caregiver, I can start a session quickly and know it works offline.

## Experience Flow
1) Landing: short intro and a big “Start” button (optionally preselect a table or choose random).
2) Question screen: shows prompt (e.g., `3 × 7 = ?`), a large input, and a confirm button; keyboard is primary input.
3) Feedback: on submit, instant correct/incorrect message; if wrong, show the right answer briefly.
4) Spaced repetition queue: wrong items re-enter the queue with higher priority; occasional correct items resurface later.
5) Session end: show score (correct, incorrect, accuracy), encouraging message, and a “Play again” option.

## Core Features
- Multiplication drills 1–10, supporting single-table mode and mixed mode.
- Spaced repetition queue that reorders misses to reappear soon, while mixing in new items.
- Immediate feedback with minimal reading required (colors/icons + short words).
- Session summary with score and encouragement.
- Lightweight persistence (localStorage) for recent performance to bias future sessions.

## Spaced Repetition Logic (MVP)
- Maintain a deck of problem cards; each card tracks streak and next-due weight.
- Start with selected table(s); enqueue each fact once.
- On incorrect answer: reset streak, add multiple copies of the card near the front of the queue.
- On correct answer: increase streak; reduce its weight so it appears less often but still occasionally.
- Shuffle within small windows to avoid predictable order; ensure every queued miss is retried before session end.
- Optionally cap session length (e.g., 15–20 questions) to keep it short.

## Content & Difficulty
- Facts: 1×1 through 10×10, with UI affordance to pick a table (e.g., 7s) or random mix.
- Keep numbers visually big; avoid clutter; support keyboard entry; single-step submission.

## UX/UI Principles (Kid-Friendly)
- Bold, high-contrast colors; large tap targets; minimal text.
- One primary action per screen; simple states (question, feedback, summary).
- Encouraging tone; gentle animations; no timers on screen to reduce pressure.
- Works on touch and keyboard; fits small screens.

## Data & Persistence
- Store recent misses and per-fact streaks in `localStorage` to influence the next session order.
- No accounts; all data stays local; provide a “reset progress” option later.

## Non-Goals (For Now)
- Division/addition/subtraction facts.
- Multi-user profiles or cloud sync.
- Long-term spaced repetition scheduling across days (focus is within-session repetition).

## Constraints & Tech
- Pure client-side HTML/CSS/JS; no build step required.
- Offline-first; no network calls.

## Risks & Assumptions
- Child attention span favors short sessions; too many repeats may frustrate.
- Assumes device allows keyboard or on-screen input; ensure big buttons for submit.

## Open Questions
- Should sessions be time-boxed or question-count based by default?
- Do caregivers want a simple progress view across sessions?
