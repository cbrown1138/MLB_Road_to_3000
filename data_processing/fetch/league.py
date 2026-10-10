"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

League-wide hitting stats for Road to 3000.
"""
from statistics import mean

import statsapi as mlb

# American League ID: 103, National League ID: 104
LEAGUES = {"American League": 103, "National League": 104}


def fetch_hits_by_season(seasons) -> dict:
    """Mean and max hits among each season's top-200 hits leaders per league."""
    data = {
        'all_qualified_hitters_mean_season': [],
        'all_qualified_hitters_max_season': [],
    }
    for season in seasons:
        hits = []
        for league_id in LEAGUES.values():
            # We use force=True to inject the explicit limit and leagueId parameters
            raw_data = mlb.get(
                "stats_leaders",
                {
                    "leaderCategories": "hits",
                    "season": season,
                    "statGroup": "hitting",
                    "leagueId": league_id,
                    "limit": 200
                },
                force=True
            )
            # Extract the individual leaders from the returned payload
            league_leaders = raw_data.get("leagueLeaders", [{}])[0].get("leaders", [])
            hits.extend(int(player.get("value")) for player in league_leaders)

        if not hits:
            print(f"--- no hits leaders for {season} ---")
            continue
        data['all_qualified_hitters_mean_season'].append({"Season": season, "Hits_Mean": mean(hits)})
        data['all_qualified_hitters_max_season'].append({"Season": season, "Hits_Max": max(hits)})

    return data


def merge_hits_by_season(existing: dict | None, new: dict) -> dict:
    """Append new season entries to existing data; a season already present is updated in place."""
    merged = {k: list(v) for k, v in (existing or {}).items()}
    for key, entries in new.items():
        rows = merged.setdefault(key, [])
        for entry in entries:
            for i, row in enumerate(rows):
                if row.get('Season') == entry['Season']:
                    rows[i] = entry
                    break
            else:
                rows.append(entry)
        rows.sort(key=lambda r: r['Season'])
    return merged


def fetch_qualified_hitters(season: int) -> list[dict]:
    """Return [{'id': player_id, 'name': full_name}] for qualified MLB hitters in a season."""
    data = mlb.get('stats', {
        'stats': 'season',
        'group': 'hitting',
        'playerPool': 'qualified',  # 3.1 PA per team game
        'season': season,
        'sportId': 1,
        'limit': 1000,
    })
    splits = data['stats'][0]['splits']
    return [{'id': s['player']['id'], 'name': s['player']['fullName']} for s in splits]
