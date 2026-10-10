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

Currently tracked: Jose Altuve, Mookie Betts, Freddie Freeman, Manny Machado, Mike Trout, Bryce Harper, Juan Soto, Jose Ramirez, Francisco Lindor, Xander Bogaerts ([players.py](data_processing/players.py)).

## Data pipeline

[data_processing/](data_processing) is a Python package, organized by what the code does:

```
data_processing/
  players.py      # player ID lists by group (tracked, retired_3000, retired_2000)
  config.py       # data paths, storage keys, local_today()
  storage.py      # read_json / write_json: site/data/ locally, S3 when DATA_BUCKET is set
  fetch/          # pull from statsapi.mlb.com and compute stats; no I/O
    player_active.py, player_retired.py, league.py, common.py
  jobs/           # entry points: decide what to fetch and write it
    daily.py              # tracked players + current-season league hits (AWS Lambda)
    backfill_retired.py   # retired players, run by hand, committed to git
    backfill_league.py    # historic seasons of league hits
    backfill_qualified.py # this season's qualified hitters (+ their stats with --players)
```

[lambda_handler.py](lambda_handler.py) calls `jobs.daily.run()`. Locally every job saves under `site/data/`; in Lambda it writes the same keys to S3 (plus a dated copy under `history/`), and CodeBuild syncs the bucket into `site/data/` at build time:

```
site/data/
  players/index.json          # {group: [{id, name}]}, generated from players.py
  players/<id>.json           # one file per player, by MLBAM id
  league/hits_by_season.json  # league mean/max hits per season (merged, one row per season)
  league/qualified_hitters.json
```

[site/lib/players.ts](site/lib/players.ts) reads these at build time — the Next.js site itself never calls the MLB API directly.

### Player JSON

Active ([fetch/player_active.py](data_processing/fetch/player_active.py)) and retired ([fetch/player_retired.py](data_processing/fetch/player_retired.py)) players share field names wherever the stat is the same.

| Field | Meaning |
|---|---|
| `player_id`, `first_name`, `last_name`, `full_name` | Identity (accents stripped) |
| `age`, `birth_date`, `birth_city`, `birth_country`, `position` | Bio |
| `debut_date`, `debut_age` | MLB debut; retired players also have `final_date` |
| `<split>_hits`, `_games`, `_PA`, `_AB`, `_AVG`, `_games_pace`, `_PA_pace`, `_AB_pace` | Stats per split. Splits: `career`, `last30games`, `last15games`, `best30games`, `worst30games` (the last two also have `_start_date`/`_end_date`); active players add `season` and `last120PA` |
| `games_per_season`, `hits_per_season`, `PA_per_season`, `AB_per_season`, `hits_season_cumulative`, `age_per_season` | Keyed by season year |
| Active only: `today`, `season`, `current_team`, `remaining_hits` | Snapshot date and current-season context |
| Retired only: `game_logs_complete` | False when the API lacks game logs for part of the career (pre-1901); game-log splits are then omitted |

## Site stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Statically exported (`output: "export"` in [site/next.config.ts](site/next.config.ts)) — no server runtime needed, deployable to plain static hosting (see [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md))
- Data loading is filesystem reads at build time, not client-side fetching — see [lib/players.ts](site/lib/players.ts)

## Local development

```bash
# refresh player data (requires MLB-StatsAPI installed; run from the repo root)
python -m data_processing.jobs.daily
python -m data_processing.jobs.backfill_retired  # retired_3000 by default

# run the site
cd site
npm install
npm run dev
```

## Docs

- [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md) — S3 hosting + daily Lambda data refresh plan
