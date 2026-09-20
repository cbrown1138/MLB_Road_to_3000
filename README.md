# MLB Road to 3,000

https://roadto3000.click

Only 33 batters in MLB history have reached 3,000 career hits. This project tracks the small group of active players with a realistic shot at joining them, and publishes a daily-updated site showing how close each one is.

## What the site does

**Home page** (`/`) — every tracked player as a card, sorted by hits remaining (closest to 3,000 first). Each card shows position, team, age, MLB debut year, birthplace (with flag), career average/hits/games, and hits remaining.

**Player page** (`/players/<lastname>`) — clicking a card opens that player's detail page:
- **Hero counter** — photo, headline stats, and a progress bar (`career_hits / 3000`).
- **Pace comparison grid** — four cards (career pace, current season pace, last 30 games, last 15 games), each showing hits-per-game and, where applicable, how far above/below career pace that stretch is running.
- **Hot/cold band** — the best and worst 30-game rolling stretches of the player's career, with hits and the date each stretch ended.
- **Footer** — "data last updated" timestamp, sourced from the newest snapshot.

Currently tracked: Jose Altuve, Mookie Betts, Freddie Freeman, Manny Machado, Mike Trout, Bryce Harper, Juan Soto, Jose Ramirez, Francisco Lindor, Xander Bogaerts ([player_active.py](data_processing/daily/player_active.py)).

## Data pipeline

Scripts live in [data_processing/](data_processing), split by how often they run:

- **[daily/](data_processing/daily)** — everything here runs every day in AWS Lambda ([lambda_handler.py](lambda_handler.py)). Nothing else is packaged into the Lambda image.
  - [player_active.py](data_processing/daily/player_active.py) holds the tracked player IDs; [player_active_get_stats.py](data_processing/daily/player_active_get_stats.py) pulls each player's career totals, current-season totals, and full career game logs from `statsapi.mlb.com` and computes the derived stats below.
  - [league_active_get_stats.py](data_processing/daily/league_active_get_stats.py) adds the current season's league mean/max hits to `stats_league.json`, merging into the existing history.
- **[static/](data_processing/static)** — run by hand, output committed to git: retired 3,000-hit-club players ([player_club.py](data_processing/static/player_club.py) → `site/data/club/`) and historic league stats.

Locally each script saves under `site/data/`; in Lambda (`DATA_BUCKET` set) it writes to S3 instead, and CodeBuild syncs the bucket into `site/data/` at build time:

```
site/data/active/stats_<LastName><FirstName>.json   # one per active player
site/data/stats_league.json                          # league mean/max hits per season
site/data/club/stats_<LastName><FirstName>.json      # static, committed only
```

[site/lib/players.ts](site/lib/players.ts) reads `site/data/active/stats_*.json` at build time — the Next.js site itself never calls the MLB API directly.

### JSON schema

| Field | Meaning |
|---|---|
| `today` | Date the snapshot was generated |
| `season` | Current MLB season year |
| `player_firstName`, `player_lastName`, `player_fullName` | Player identity (accents stripped); `lastName` drives the URL slug, `lastName` + `firstName` the JSON filename |
| `player_age`, `player_birthDate`, `player_birthCity`, `player_birthCountry` | Bio fields |
| `player_Position` | Primary position abbreviation |
| `remaining_hits` | `3000 - career_hits` |
| `career_mlb_debut` | Debut date |
| `career_gamesPlayed`, `career_atBats`, `career_hits`, `career_avg` | Career hitting totals from the MLB Stats API |
| `career_pace` | `career_hits / career_gamesPlayed` |
| `career_pace_remaining` | Games needed at career pace to reach 3,000 |
| `season_current_team` | Current team name |
| `season_hits`, `season_games_played`, `season_pace`, `season_pace_remaining` | Same shape, scoped to the current season |
| `games30_hits`, `games30_pace`, `games30_pace_remaining` | Trailing 30-game rolling window |
| `games15_hits`, `games15_pace` | Trailing 15-game rolling window |
| `games_30_hits_max`, `games_30_hits_max_date_start`, `games_30_hits_max_date_end`, `games_30_hits_max_pace` | Best 30-game rolling window across the player's entire career, and when it started/ended |
| `games_30_hits_min`, `games_30_hits_min_date_start`, `games_30_hits_min_date_end`, `games_30_hits_min_pace` | Worst 30-game rolling window across the player's entire career, and when it started/ended |
| `games_per_season`, `hits_per_season` | Career games and hits keyed by season year |

The canonical type is [`PlayerSnapshot`](site/lib/players.ts) — if the Python job's field names ever drift from this table, that's the type to check first.



## Site stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Statically exported (`output: "export"` in [site/next.config.ts](site/next.config.ts)) — no server runtime needed, deployable to plain static hosting (see [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md))
- Data loading is filesystem reads at build time, not client-side fetching — see [lib/players.ts](site/lib/players.ts)

## Local development

```bash
# refresh player data (requires `statsapi` installed; run from the repo root)
python data_processing/daily/player_active.py
python data_processing/daily/league_active_get_stats.py

# run the site
cd site
npm install
npm run dev
```

## Docs

- [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md) — S3 hosting + daily Lambda data refresh plan
