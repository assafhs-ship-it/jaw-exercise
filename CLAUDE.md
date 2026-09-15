# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**תרגילי לסת** — a Hebrew (RTL) jaw-exercise web app meant to be added to an iPhone Home Screen (Safari → Share → Add to Home Screen). Static site, no build step, no framework, no dependencies (Google Fonts only).

Deployed via GitHub Pages from the `main` branch root. To publish changes: `git push origin main`.

## Files

- `index.html` — two screens: `#list-screen` (date, daily progress, exercise cards) and `#exercise-screen` (hero image, description, Counter with progress ring, hold timer, fixed action bar with איפוס / Done)
- `script.js` — `EXERCISES` data array at the top, then state, list rendering, exercise rendering, counter/hold timer/done, bell sound, wake lock, routing
- `styles.css` — design tokens on `:root`, dark-mode overrides in `@media (prefers-color-scheme: dark)`
- `manifest.json`, `icons/` — Home Screen name and icons (`apple-touch-icon.png` is what iOS uses)
- `images/` — one line-art illustration per exercise (SVG, 400×300). Green arrows = jaw movement, gold = resistance/hand/time.

## Exercise config (`EXERCISES`)

- `kind: 'counter'` — opens a detail screen. `kind: 'check'` — list-only step, not openable; its Done pill sits on the card.
- `hold: 10` — each Counter tap increments and starts a count-up timer that stops at `hold` seconds and rings a bell; taps are ignored while it runs.
- `goal: 10` — shows "מתוך 10" under the count and drives the progress ring (for non-hold exercises).
- `counterLabel` — text on the Counter button (default "Counter").

## Architecture notes

- **State** lives in `localStorage` under `jaw-exercise-v2`: `{ day, items: { [id]: { count, holdStart, done } } }`. It resets automatically on a new calendar day (checked on load and when the app returns to the foreground).
- **Hold timer** stores a start timestamp, not a tick count. One global `tick()` ends every running hold, so a hold still finishes after leaving the screen or backgrounding; the bell only rings if the hold ended < 3s ago.
- **Bell** is synthesized with Web Audio (inharmonic sine partials). iOS requires an unlocking tap, done in `unlockAudio()` on each Counter tap. iPhone silent mode mutes it.
- **Done** toggles; marking done on the detail screen returns to the list after 450ms.
- **Routing** is by URL hash (`#open-wide`); `check` exercises are not routable.
- `ring` is an SVG element — toggle its `hidden` attribute, not the `.hidden` property.
- Images inside fixed containers use `width: 100%; height: 100%; object-fit: cover` (never `auto` + `max-*`).
