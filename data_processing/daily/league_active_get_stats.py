"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

Get individual MLB leauge stats for road to 3000


"""
import json
import os
import sys
from statistics import mean
from datetime import date, datetime
from zoneinfo import ZoneInfo
import statsapi as mlb

# The pipeline runs in UTC (Lambda), but "today" should be the site's local
# date: an evening Central run would otherwise stamp tomorrow's date.
SITE_TZ = ZoneInfo('America/Chicago')


def local_today() -> date:
    return datetime.now(SITE_TZ).date()


def fetch_league_stats() -> dict:
    # American League ID: 103, National League ID: 104
    leagues = {"American League": 103, "National League": 104}
    all_qualified_hitters = []
    all_qualified_hitters_mean_season = []
    all_qualified_hitters_max_season = []

    today = local_today()
    season = today.year
    for league_name, league_id in leagues.items():
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
        
        for player in league_leaders:
            rank = player.get("rank")
            name = player.get("person", {}).get("fullName")
            team = player.get("team", {}).get("name")
            value = player.get("value")
            
            all_qualified_hitters.append({
                "Season": season,
                "Rank": rank,
                "Name": name,
                "Team": team,
                "Hits": value
            })

    Hits_mean = mean(int(g['Hits']) for g in all_qualified_hitters if g['Season'] == season)
    all_qualified_hitters_mean_season.append({
        "Season": season,
        "Hits_Mean": Hits_mean
    })
        
    Hits_max = max(int(g['Hits']) for g in all_qualified_hitters if g['Season'] == season)
    all_qualified_hitters_max_season.append({
        "Season": season,
        "Hits_Max": Hits_max
    })

    data = {}
    data['all_qualified_hitters_mean_season'] = all_qualified_hitters_mean_season
    data['all_qualified_hitters_max_season'] = all_qualified_hitters_max_season

    return data



def merge_stats(existing: dict, new: dict) -> dict:
    """Append new season entries to existing data; a season already present is updated in place."""
    merged = {k: list(v) for k, v in existing.items()}
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


def save_local(data: dict) -> str:
    # this file lives in data_processing/daily/, so the repo root is two levels up
    script_dir = os.path.dirname(os.path.abspath(__file__))
    fileName = os.path.join(script_dir, '..', '..', 'site', 'data', 'stats_league.json')
    os.makedirs(os.path.dirname(fileName), exist_ok=True)
    existing = {}
    if os.path.exists(fileName):
        with open(fileName) as f:
            existing = json.load(f)
    with open(fileName, 'w') as f:
        json.dump(merge_stats(existing, data), f, indent=2)
    return fileName


def save_s3(data: dict, bucket: str) -> None:
    import boto3
    s3 = boto3.client('s3')
    latest_key = 'stats_league'+'.json'
    history_key = 'history/'+local_today().isoformat()+'/'+latest_key
    existing = {}
    try:
        existing = json.loads(s3.get_object(Bucket=bucket, Key=latest_key)['Body'].read())
    except s3.exceptions.NoSuchKey:
        pass
    body = json.dumps(merge_stats(existing, data), indent=2).encode('utf-8')
    s3.put_object(Bucket=bucket, Key=latest_key, Body=body, ContentType='application/json')
    s3.put_object(Bucket=bucket, Key=history_key, Body=body, ContentType='application/json')


def main():
    data = fetch_league_stats()

    data_bucket = os.environ.get('DATA_BUCKET')
    if data_bucket:
        save_s3(data, data_bucket)
    else:
        save_local(data)


if __name__ == '__main__':
    main()
