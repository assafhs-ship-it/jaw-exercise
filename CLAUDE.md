# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**תרגילי לסת** — a Hebrew (RTL) jaw-exercise web app meant to be added to an iPhone Home Screen (Safari → Share → Add to Home Screen). Static site, no build step, no framework, no dependencies (Google Fonts only).

Deployed via GitHub Pages from the `main` branch root (https://assafhs-ship-it.github.io/jaw-exercise/). To publish changes: `git push origin main`.

**Always bump the `?v=` number on `styles.css` and `script.js` in `index.html` when changing either file.** GitHub Pages serves with `max-age=600`, and iPhone Safari will otherwise pair a fresh `index.html` with a stale cached `script.js` (this broke the "Let's Start" button once).

## Files

- `index.html` — three screens: `#welcome-screen` (time-of-day greeting, date, today's progress, "Let's Start", app version), `#list-screen` (Home, date, daily progress, "Clear All", exercise cards) and `#exercise-screen` (back, Home, hero image, description, Counter with progress ring, timer cards, fixed action bar with איפוס / Done)
- `script.js` — `EXERCISES` data array at the top, then state, list rendering, exercise rendering, counter/hold timer/done, bell sound, wake lock, routing
- `styles.css` — design tokens on `:root`, dark-mode overrides in `@media (prefers-color-scheme: dark)`
- `manifest.json`, `icons/` — Home Screen name and icons (`apple-touch-icon.png` is what iOS uses)
- `images/` — one line-art illustration per exercise (SVG, 400×300). Green arrows = jaw movement, gold = resistance/hand/time.

## Exercise config (`EXERCISES`)

- `kind: 'counter'` — opens a detail screen. `kind: 'check'` — list-only step, not openable; its Done pill sits on the card.
- `hold: 10` — each Counter tap increments and starts a count-up timer that stops at `hold` seconds and rings a bell; taps are ignored while it runs.
- `holds: [{ label, seconds }]` + `holdGap` — several timers in sequence instead of one (exercise 6: שמאל 10s, 1s gap, ימין 10s). Rendered as side-by-side cards, left-to-right. `holdPhases(ex)` normalizes `hold`/`holds` into `[{ label, seconds, start, end }]` — use it rather than reading `hold` directly.
- `goal: 10` — shows "מתוך 10" under the count and drives the progress ring (for non-hold exercises).
- `counterLabel` — text on the Counter button (default "Counter").

## Architecture notes

- **Version**: `APP_VERSION` at the top of `script.js` (shown on the welcome screen). Bump it with each release, alongside the `?v=` cache-busting numbers.
- **State** lives in `localStorage` under `jaw-exercise-v2`: `{ day, items: { [id]: { count, holdStart, bellsDone, done } } }`. `bellsDone` counts phases whose end bell was already handled. It resets automatically on a new calendar day (checked on load and when the app returns to the foreground).
- **Hold timer** stores a start timestamp, not a tick count; each phase's progress is derived from it. One global `tick()` ends phases and holds, so a hold still finishes after leaving the screen or backgrounding. If several phases ended while away, only the latest rings.
- **Sounds** are synthesized with Web Audio and **queued on the audio clock when the hold starts** (`scheduleBells`): a soft tick (`playTick`) every second and a bell (`ringBell`, inharmonic partials) at the end of each phase instead of that phase's last tick. A throttled `setInterval` therefore can't delay or skip them. When a phase ends, `bellDue(id, phase)` rings immediately unless its queued bell already fired, and `cancelBells(id)` stops queued bells and ticks on reset/Clear All — so each phase rings exactly once. iOS suspends the audio clock in the background, so `visibilitychange` resumes it and re-queues the remaining bells and ticks of any running hold. `BELL_GRACE_MS` (60s) stops a long-finished hold ringing on return. iPhone silent mode still mutes all sounds, hence the `chime` pulse on each timer card as a visual cue.
- **Clear All** (list screen) takes two taps: the first turns the button into a confirm state that expires after `CLEAR_CONFIRM_MS`; the second resets every count, hold and done mark for the day.
- **Welcome** shows on every launch (any hash is cleared at startup) and via the Home buttons (`[data-home]` → `goHome()`, which leaves running timers going). Greeting: בוקר טוב 05–12, צהריים טובים 12–17, ערב טוב otherwise. `route()` does nothing until `start()` sets `started`.
- **Done** is disabled until the count reaches `DONE_AT` (10); a done mark can always be undone. Marking done on the detail screen returns to the list after 450ms.
- **Routing** is by URL hash (`#open-wide`); `check` exercises are not routable.
- `ring` is an SVG element — toggle its `hidden` attribute, not the `.hidden` property.
- Images inside fixed containers use `width: 100%; height: 100%; object-fit: cover` (never `auto` + `max-*`).
