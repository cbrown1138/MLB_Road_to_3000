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

Currently tracked: Jose Altuve, Mookie Betts, Freddie Freeman, Manny Machado ([data_player_run_all.py](data_player_run_all.py)).

## Data pipeline

[data_player_run_all.py](data_player_run_all.py) runs [data_player_get_stats.py](data_player_get_stats.py) once per player (by MLB Stats API player ID). Each run pulls from `statsapi.mlb.com` — career hitting totals, current-season hitting totals, and full career game logs — computes the derived stats below, and writes one file:

```
site/data/latest_stats_<LastName>.json
```

[site/lib/players.ts](site/lib/players.ts) reads every `latest_stats_*.json` in that folder at build time — the Next.js site itself never calls the MLB API directly.

### JSON schema

| Field | Meaning |
|---|---|
| `today` | Date the snapshot was generated |
| `season` | Current MLB season year |
| `player_lastName`, `player_fullName` | Player identity; `lastName` also drives the URL slug and the JSON filename |
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
| `games_30_hits_max`, `games_30_hits_max_date`, `games_30_hits_max_pace` | Best 30-game rolling window across the player's entire career, and when it ended |
| `games_30_hits_min`, `games_30_hits_min_date`, `games_30_hits_min_pace` | Worst 30-game rolling window across the player's entire career, and when it ended |

The canonical type is [`PlayerSnapshot`](site/lib/players.ts) — if the Python job's field names ever drift from this table, that's the type to check first.



## Site stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Statically exported (`output: "export"` in [site/next.config.ts](site/next.config.ts)) — no server runtime needed, deployable to plain static hosting (see [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md))
- Data loading is filesystem reads at build time, not client-side fetching — see [lib/players.ts](site/lib/players.ts)

## Local development

```bash
# refresh player data (requires `statsapi` installed)
python data_player_run_all.py

# run the site
cd site
npm install
npm run dev
```

## Docs

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — data sources, metrics, and hosting options
- [WEBAPP_PLAN.md](WEBAPP_PLAN.md) — frontend component breakdown
- [AWS_DEPLOYMENT_PLAN.md](AWS_DEPLOYMENT_PLAN.md) — S3 hosting + daily Lambda data refresh plan
