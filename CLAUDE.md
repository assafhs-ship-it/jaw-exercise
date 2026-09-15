# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**תרגילי לסת** — a Hebrew (RTL) jaw-exercise web app meant to be added to an iPhone Home Screen (Safari → Share → Add to Home Screen). Static site, no build step, no framework, no dependencies.

Deployed via GitHub Pages from the `main` branch root. To publish changes: `git push origin main`.

## Files

- `index.html` — two screens: `#list-screen` (exercise list) and `#exercise-screen` (image, steps, Counter, timer, reset)
- `script.js` — `EXERCISES` data array at the top, then state, rendering, counter/timer, routing
- `styles.css` — design tokens on `:root`, dark-mode overrides in `@media (prefers-color-scheme: dark)`
- `manifest.json`, `icons/` — Home Screen name and icons (`apple-touch-icon.png` is what iOS uses)
- `images/` — one illustration per exercise (SVG, 4:3); can be swapped for photos by changing `image` in `EXERCISES`

## Architecture notes

- **Exercises are data-driven.** Add/edit/remove entries in `EXERCISES` (`id`, `title`, `image`, `timer`, `steps`). `timer: true` makes the first Counter tap start a count-up timer.
- **Routing** is by URL hash (`#chin-tuck`), so a reload stays on the same exercise.
- **State** (count + timer start time per exercise) is saved in `localStorage` under `jaw-exercise-state-v1`, because iOS kills Home Screen apps in the background. The timer stores a start timestamp, not a tick count, so it stays correct after the app is suspended.
- **Screen Wake Lock** is requested while a timer runs; failures are ignored.
- Images inside fixed containers use `width: 100%; height: 100%; object-fit: cover` (never `auto` + `max-*`).
