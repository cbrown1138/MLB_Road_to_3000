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
import statsapi as mlb


def fetch_league_stats() -> dict:
    # American League ID: 103, National League ID: 104
    leagues = {"American League": 103, "National League": 104}
    all_qualified_hitters = []
    all_qualified_hitters_mean_season = []
    all_qualified_hitters_max_season = []

    today = date.today()  # noqa: DTZ011
    season_current = today.year
    # loop all seasons in range
    for season in range(2005,season_current+1):
        # get leaders
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



def save_local(data: dict) -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    fileName = os.path.join(script_dir, 'site', 'data', 'league_stats'+'.json')
    with open(fileName, 'w') as f:
        json.dump(data, f, indent=2)
    return fileName


def save_s3(data: dict, bucket: str) -> None:
    import boto3
    s3 = boto3.client('s3')
    body = json.dumps(data, indent=2).encode('utf-8')
    latest_key = 'league_stats'+'.json'
    history_key = 'history/'+date.today().isoformat()+'/'+latest_key
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
