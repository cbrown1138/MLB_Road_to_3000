# Road to 3,000 — Altuve Hit Tracker: Project Plan

A Next.js site tracking José Altuve's (MLBAM ID `514888`, Houston Astros, team ID `117`) progress toward 3,000 career hits. Updated daily, shows hits remaining and an estimated number of games needed to reach the milestone.

## 1. Goals & Scope

- Single-player tracker (Altuve), not a generalized multi-player system for v1.
- Daily update after each Astros game (box scores finalize a few hours post-game).
- Core outputs: career hits, hits remaining to 3,000, season pace, estimated games remaining, projected milestone date.
- Public, read-only, no auth needed.


## 2. Data Sources

**MLB Stats API** (`statsapi.mlb.com`), via the `statsapi`/`MLB-StatsAPI` package already used in [altuve.py](altuve.py) — no key required.

- `people/514888?hydrate=stats(group=hitting,type=career)` — authoritative career hit total (the "3,000" counter).
- `people/514888/stats?stats=season&group=hitting&season=2026` — current-season hits/AB/games, for pace.
- `schedule?sportId=1&teamId=117&startDate=...&endDate=...` — Astros' remaining schedule, to translate "games remaining" into calendar dates and opponents.
- `schedule?gamePk=...` — per-game confirmation once a game is final (you're already calling `mlb.schedule(game_id=...)` in `altuve.py`).

Cross-check for the season-opening career total (bar for "hits needed" resets each year): Baseball-Reference, manual spot check only.

## 3. Metrics to Compute and Display

Source of truth is the live schema produced by the daily job, [altuve_latest.json](altuve_latest.json). Grouped below by what each field feeds in the UI (component names per [WEBAPP_PLAN.md](WEBAPP_PLAN.md)).

### Snapshot metadata — `SnapshotMeta`

| JSON field | Meaning |
|---|---|
| `today` | Date the snapshot was generated |
| `season` | Current MLB season year |

### Headline counter — `HeroCounter`

| JSON field | Calculation |
|---|---|
| `career_hits` | `statsapi` career hydrate |
| `career_games_played` | `statsapi` career hydrate |
| `remaining_hits` | `3000 - career_hits` |

### Pace comparison grid — `PaceGrid` (4 cards: career / season / last-30 / last-15)

| JSON field | Calculation |
|---|---|
| `career_pace` | `career_hits / career_games_played` |
| `season_pace` | `season_hits / season_games_played` | 
| `games30_pace` | trailing 30-game rolling window; `games30_hits / 30` |
| `games15_pace` | trailing 15-game rolling window; `games15_hits / 15` |
| `career_pace_remaining`, `career_pace_remaining_date` | `remaining_hits / career_pace` games; date projected from `today` at that pace |
| `season_pace_remaining`, `season_pace_remaining_date` | `remaining_hits / season_pace` games; date projected at that pace |
| `games30_pace_remaining`, `games30_pace_remaining_date` | `remaining_hits / games30_pace` games; date projected at that pace |
| `games15_pace_remaining`, `games15_pace_remaining_date` | `remaining_hits / games15_pace` games; date projected at that pace |

**Known limitation:** the `*_remaining_date` fields are currently naive pace projections (`today` + N games at ~1 game/day), not mapped to the Astros' actual remaining schedule — they land 2–3 years out. This is because we don't know the schedule in the future beyond 2027.

### Hot/cold band — `HotColdBand`

| JSON field | Calculation |
|---|---|
| `max_hits_rolling_30`, `max_date` | Best 30-game rolling window in career history, and the date it ended |
| `max_hits_rolling_30_pace`, `max_pace_remaining_date` | `max_hits_rolling_30 / 30`; hypothetical remaining-date if he sustained that hot streak |
| `min_hits_rolling_30`, `min_date` | Worst 30-game rolling window in career history, and the date it ended |
| `min_hits_rolling_30_pace`, `min_pace_remaining_date` | `min_hits_rolling_30 / 30`; hypothetical remaining-date if he sustained that cold streak |

Together `max_pace_remaining_date` / `min_pace_remaining_date` frame the optimistic/conservative bounds referenced in §4's projected-timeline chart, until a true schedule-aware model replaces them.


## 4. Suggested Visualizations

1. **Hero counter** — "X hits to 3,000", radial gauge or progress bar (career hits / 3,000).
2. **Milestone progress bar** — 0 → 3,000 track with markers at 2,500 / 2,750 / 2,900 / 2,950 / 3,000.
3. **Career hits by season** — cumulative line chart across Altuve's career, showing the long climb into context (also nice for "here's where he's been" storytelling).
4. **Rolling hit rate** — sparkline/line of trailing 15-game hits-per-game, to show hot/cold streaks.
5. **Projected timeline** — line/scatter over the remaining Astros schedule, cumulative-hits projection with an optimistic/conservative shaded band, and a horizontal line at 3,000 marking where the projection crosses it.
6. **Next-game hit probability** — small card showing the model's P(hit) for tonight's/next game against the probable opposing pitcher (direct payoff from the existing prediction model).
7. **Games remaining card** — "~14 games remaining at current model-projected pace, likely around [date] vs. [opponent]."
8. Stretch: calendar heatmap of hits per game for the season (GitHub-contributions style).

Use **Recharts** for charts — React-native, works well with Next.js App Router/server components, sufficient for these chart types without D3's overhead.

## 5. Architecture

```
┌───────────────────────────┐
│ Daily cron job              │  fetch statsapi career/season/schedule
│ (Vercel Cron → API route,   │  + run existing hit-prediction model
│  or GitHub Actions)         │  on upcoming schedule → compute metrics
└──────────────┬───────────────┘
               │
               ▼
┌───────────────────────────┐
│ Storage: data/latest.json   │  latest snapshot + appended history.jsonl
│ + data/history.jsonl         │  (v1: no DB needed — single player, one
│ (Vercel Blob/KV, or committed│   row/day)
│  to repo)                    │
└──────────────┬───────────────┘
               │
               ▼
┌───────────────────────────┐
│ Next.js (App Router, TS)    │  ISR / static generation, Recharts
└───────────────────────────┘
```

**Model execution note:** the hit-prediction model in [altuve.py](altuve.py) is Python (sklearn-adjacent feature engineering). Two options:
- **A (recommended for v1):** keep the daily job as a standalone Python script (reuses your existing `statsapi`/pandas code almost as-is), run via GitHub Actions on a schedule, writes `latest.json`/`history.jsonl`, commits or pushes to Vercel Blob. Next.js stays pure TypeScript/React, just reads the JSON.
- **B:** port the projection logic to TypeScript and run entirely inside a Vercel Cron → API route. Cleaner single-stack, but throws away the working Python model code for a rewrite — not worth it for v1 given the model already exists and works.

Go with **A**: minimal new code, reuses what's already built in this repo.

### Daily job steps
1. Pull Altuve's updated career + season hitting stats via `statsapi`.
2. Pull Astros' remaining schedule + probable pitchers.
3. Run the existing per-game hit-probability model against the upcoming schedule (may need probable-pitcher features to be fetchable in advance — check data availability a day or two out; fall back to season-average pace for games where opposing pitcher/park features aren't yet resolvable).
4. Compute hits remaining, projected games remaining, projected date, optimistic/conservative band.
5. Append to `history.jsonl`, overwrite `latest.json`.
6. Commit/push → triggers Vercel redeploy or ISR revalidation.

Schedule the job for the morning after game day (e.g., 9am ET) so the prior night's box score is final.

## 6. Suggested Hosting & Infra

### Option A: Vercel (recommended for v1 — simplest)

- **Hosting:** Vercel — native Next.js support, free tier covers this traffic, built-in Cron.
- **Storage:** Vercel Blob or KV for `latest.json`/`history.jsonl` (no DB needed for one player). If you later generalize to multiple players, move to Neon (serverless Postgres, free tier).
- **Scheduling:** GitHub Actions (since the update job is Python, reusing `altuve.py`-style code) — push results to Vercel Blob via API, or commit JSON to the repo and let Vercel's git integration redeploy.
- **Domain:** custom domain via any registrar → Vercel (free SSL).
- **Alerting:** simple failure notification (Slack/email webhook) if the GitHub Action fails, since a missed update is easy to miss otherwise (during the season, silence for >48h should be treated as broken, not "off day").

### Option B: AWS

Worth considering if you'd rather consolidate on AWS (e.g., already have an account/billing, or want more control over the daily Python job than a GitHub Actions runner gives you).

- **Hosting:** Next.js on **AWS Amplify Hosting** (closest to Vercel's DX — git-push deploys, SSR/ISR support out of the box) or **App Runner** for a containerized Next.js app if you want more infra control. Avoid raw S3+CloudFront for this — Next.js SSR/ISR needs a Node runtime, not pure static hosting, unless you go fully static export and give up ISR.
- **Daily update job:** **AWS Lambda** running the Python script (reuse `altuve.py`-style code directly, package `statsapi`/`pandas` as a Lambda layer or container image), triggered by **EventBridge Scheduler** (cron, e.g. daily at 9am ET) instead of GitHub Actions.
- **Storage:** **S3** for `latest.json`/`history.jsonl` (simplest, mirrors the Vercel Blob approach) or **DynamoDB** if you want per-game rows and query flexibility from day one. Move to **RDS/Aurora Postgres** only if you generalize to multiple players and need relational queries.
- **CDN/domain:** **CloudFront** in front of Amplify/App Runner, **Route 53** for the domain, **ACM** for free SSL.
- **Alerting:** **CloudWatch Alarms** on Lambda failures → **SNS** topic → email/Slack webhook.
- **Trade-off vs. Option A:** more moving parts and IAM/config overhead (Lambda packaging, EventBridge rule, S3 bucket policy, Amplify build settings) for a single-player site that doesn't need AWS-scale infra. Pick AWS only if you have a reason beyond "just to use AWS" — Vercel + GitHub Actions gets you the same daily-update-to-live-site pipeline with far less setup.

## 7. Stack Summary

- Next.js 14+ (App Router, TypeScript), Tailwind CSS, Recharts
- Daily update job: Python (`statsapi`, pandas — reusing [altuve.py](altuve.py) logic), scheduled via GitHub Actions
- Storage: Vercel Blob/KV (JSON snapshot + history), no DB for v1
- Data source: MLB Stats API (no key), pybaseball for periodic model retraining only

## 8. Build Order

1. **Extract a clean daily-metrics script** from `altuve.py`: career hits, season pace, hits remaining — no charts/exploration cruft, just JSON out. Validate manually against Baseball-Reference.
2. **Static page**: hardcode one day's JSON, build hero counter + progress bar in Next.js.
3. **Charts**: cumulative career-hits chart, rolling pace chart via Recharts.
4. **Automate**: wire the script into GitHub Actions, write to Vercel Blob, confirm a full daily cycle end-to-end.
5. **Wire in the prediction model**: adapt the existing per-game hit-probability model to run against the *upcoming* schedule (currently it looks backward for training features — check what's available pre-game vs. post-game) and produce the schedule-aware projection + next-game P(hit) card.
6. **Projected timeline chart** using the model output, with optimistic/conservative bands.
7. **Polish**: responsive layout, stale-data/off-day states, OG image for sharing as the milestone gets close.
8. **Retrain cadence**: decide how often the hit-prediction model itself gets retrained (e.g., monthly) vs. the daily job just scoring new games against the existing model.
