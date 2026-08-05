# Road to 3,000 — Next.js Web App Plan

Plan for the React/Next.js frontend that visualizes [altuve_latest.json](altuve_latest.json), the daily snapshot produced by the Python pipeline. Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md), which covers the daily data job and hosting; this doc is scoped to the app itself.

## 1. Current Data Contract

`altuve_latest.json` today is a **flat single-day snapshot**, no time series:

```json
{
  "today": "2026-08-01",
  "season": 2026,
  "career_hits": 2466,
  "career_games_played": 2063,
  "career_pace": 1.195,
  "season_hits": 78,
  "season_games_played": 87,
  "season_pace": 0.897,
  "games30_hits": 27,
  "games30_pace": 0.9,
  "games15_hits": 13,
  "games15_pace": 0.867,
  "remaining_hits": 534,
  "career_pace_remaining": 447,
  "career_pace_remaining_date": "2029-06-10",
  "season_pace_remaining": 596,
  "season_pace_remaining_date": "2030-05-26",
  "games30_pace_remaining": 593,
  "games30_pace_remaining_date": "2030-05-23",
  "games15_pace_remaining": 616,
  "games15_pace_remaining_date": "2030-06-17",
  "max_hits_rolling_30": 59,
  "max_date": "2017-08-11",
  "max_hits_rolling_30_pace": 1.967,
  "max_pace_remaining_date": "2028-05-28",
  "min_hits_rolling_30": 19,
  "min_date": "2025-09-15",
  "min_hits_rolling_30_pace": 0.633,
  "min_pace_remaining_date": "2031-09-02"
}
```

**Gap for v1:** every projected date (`career_pace_remaining_date`, `max_pace_remaining_date`, etc.) is a naive `today + N games * 365/games-per-season` type calculation, not mapped to the Astros' actual remaining schedule — dates land 2–3 years out. 


## 2. App Scope (v1)

A single-page dashboard, statically generated, rebuilt on each daily data push. No routing complexity needed — one player, one page.

## 3. Component Breakdown

- **`HeroCounter`** — `remaining_hits` (534) as the headline number, with `career_hits / 3000` as a progress bar/radial gauge.
- **`PaceGrid`** — 4 stat cards, one per pace method (career / season / last-30 / last-15), each showing `*_hits`, `*_pace`, `*_pace_remaining` (games), `*_pace_remaining_date`. Lets the viewer compare "if he keeps his career pace" vs. "at his hot last-15 pace" side by side — this is the most information-dense part of the current data and the core payoff of the page.
- **`HotColdBand`** — `max_hits_rolling_30`/`max_date` vs. `min_hits_rolling_30`/`min_date` as a best-case/worst-case pair (e.g., "hottest 30-game stretch: 59 hits in Aug 2017 — at that pace, 3,000 by May 2028; coldest: 19 hits — Sept 2025, pace would push it to 2031").
- **`SnapshotMeta`** — small footer/header line: "as of `today`, `season` season, `career_games_played` games played."


## 4. Data Loading

Static JSON, no API needed for v1:

- Put `altuve_latest.json` in the Next.js build can read it — either committed into the repo under `/data` and read via `fs.readFileSync` in a Server Component, or fetched from wherever the daily job publishes it (Vercel Blob URL, per [PROJECT_PLAN.md](PROJECT_PLAN.md)).
- Use a Server Component (`app/page.tsx`) to read the JSON at request/build time — no client-side fetching needed, keeps it simple and fast.
- Define a TypeScript type matching the schema above (`AltuveSnapshot`) so a future field rename in the Python job surfaces as a type error in the app rather than a silent `undefined`.

```ts
type AltuveSnapshot = {
  today: string;
  season: number;
  career_hits: number;
  career_games_played: number;
  career_pace: number;
  season_hits: number;
  season_games_played: number;
  season_pace: number;
  games30_hits: number;
  games30_pace: number;
  games15_hits: number;
  games15_pace: number;
  remaining_hits: number;
  career_pace_remaining: number;
  career_pace_remaining_date: string;
  season_pace_remaining: number;
  season_pace_remaining_date: string;
  games30_pace_remaining: number;
  games30_pace_remaining_date: string;
  games15_pace_remaining: number;
  games15_pace_remaining_date: string;
  max_hits_rolling_30: number;
  max_date: string;
  max_hits_rolling_30_pace: number;
  max_pace_remaining_date: string;
  min_hits_rolling_30: number;
  min_date: string;
  min_hits_rolling_30_pace: number;
  min_pace_remaining_date: string;
};
```

## 5. Stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS for the stat card / progress bar layout
- No database, no client-side data fetching, no auth

## 6. Build Order

1. `npx create-next-app` (TypeScript, Tailwind, App Router), copy `altuve_latest.json` into `/data`.
2. Define `AltuveSnapshot` type, write a server-side loader (`getSnapshot()`) that reads and parses the JSON.
3. Build `HeroCounter` + progress bar with real data — confirms the data plumbing works end to end.
4. Build `PaceGrid` (4 cards) and `HotColdBand`.
5. Style pass: responsive layout (mobile card stack → desktop grid), dark mode via Tailwind's `dark:` variant.
6. Wire to the real daily-updated JSON source (Vercel Blob URL or repo path per hosting plan) instead of a locally copied file.
7. Deploy to Vercel, confirm a full daily-job → redeploy → updated numbers cycle.
