"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

Get individual MLB player stats for Road to 3000

Future will add predictions and season charts by hits and games

"""
import json
import os
import sys
import unicodedata
from datetime import date, datetime
import statsapi as mlb


def fetch_player_stats(player_id: int) -> dict:
    ##########  career imports ##########
    career_data = mlb.player_stat_data(player_id, group="hitting", type="career")
    career_mlb_debut = career_data['mlb_debut']
    career_mlb_final = career_data['last_played']

    career_gamesPlayed = career_data['stats'][0]['stats']['gamesPlayed']
    career_atBats = career_data['stats'][0]['stats']['atBats']
    career_hits = career_data['stats'][0]['stats']['hits']
    career_avg = career_data['stats'][0]['stats']['avg']

    ##########  bio imports ##########
    player_data = mlb.get('people', {'personIds': player_id})
    player_firstName = player_data["people"][0]["firstName"]
    player_lastName = player_data["people"][0]["lastName"]
    player_fullName = player_data["people"][0]["fullName"]
    player_age = player_data["people"][0]["currentAge"]
    player_birthDate = player_data["people"][0]["birthDate"]
    player_birthCity = player_data["people"][0]["birthCity"]
    player_birthCountry = player_data["people"][0]["birthCountry"]
    player_Position = player_data["people"][0]["primaryPosition"]['abbreviation']

    ##########  career games imports ##########
    # get all career games
    def get_game_log(season):
        data = mlb.get('people', {
            'personIds': player_id,
            'hydrate': f'stats(group=[hitting],type=[gameLog],season={season})'
        })
        # seasons with no games (military service, injury, suspension) have no 'stats' key
        stats = data['people'][0].get('stats', [])
        return stats[0]['splits'] if stats else []

    # season totals come from yearByYear, not game logs: the API has no game logs
    # before 1901 (Cap Anson has none; Lajoie and Wagner are missing early seasons).
    # A season split across teams has one row per team plus a combined row with
    # numTeams, so prefer the combined row.
    year_by_year = mlb.get('people', {
        'personIds': player_id,
        'hydrate': 'stats(group=[hitting],type=[yearByYear])'
    })
    season_rows = {}
    for s in year_by_year['people'][0]['stats'][0]['splits']:
        if s['season'] not in season_rows or 'numTeams' in s:
            season_rows[s['season']] = s
    # only seasons actually played, not every year from debut to final game:
    # careers have gap years, and some (e.g. Cap Anson) have no last_played date.
    seasons_played = sorted(season_rows, key=int)

    games_career_data = []
    for each in seasons_played:
        games_career_data.extend(get_game_log(each))
    games_career_data = sorted(games_career_data, key=lambda g: g['date'], reverse=True)

    # get last 30 games, and last 15 games
    games_30_data = games_career_data[:30]
    games_15_data = games_career_data[:15]

    ##########  calculate career ##########
    career_pace =  career_hits / career_gamesPlayed

    # game-log stats (last 30/15, streaks) are only meaningful when the logs cover
    # the whole career; otherwise leave them null
    game_logs_complete = len(games_career_data) == career_gamesPlayed

    ##########  calculate 30 game ##########
    games30_hits = sum(g['stat']['hits'] for g in games_30_data)
    games30_pace =  games30_hits / 30


    ##########  calculate 15 game ##########
    games15_hits = sum(g['stat']['hits'] for g in games_15_data)
    games15_pace =  games15_hits / 15

    if not game_logs_complete:
        games30_hits = games30_pace = games15_hits = games15_pace = None

    ##########  calculate best and worst 30 game streak ##########
    games_count = len(games_career_data)
    rolling = []
    # games are newest-first, so window games_career_data[i:i+30] ends at i
    for i in range(games_count-29):
        games_in_window = games_career_data[i:i+30]
        rolling.append({
            'date': games_in_window[0]['date'],
            'hits_rolling_30': sum(g['stat']['hits'] for g in games_in_window)
        })

    games_30_hits_max = games_30_hits_max_pace = games_30_hits_max_date = None
    games_30_hits_min = games_30_hits_min_pace = games_30_hits_min_date = None
    if game_logs_complete and rolling:
        best = max(rolling, key=lambda r: r['hits_rolling_30'])
        games_30_hits_max = best['hits_rolling_30']
        games_30_hits_max_pace = games_30_hits_max / 30
        games_30_hits_max_date = best['date']

        worst = min(rolling, key=lambda r: r['hits_rolling_30'])
        games_30_hits_min = worst['hits_rolling_30']
        games_30_hits_min_pace = games_30_hits_min / 30
        games_30_hits_min_date = worst['date']

    ##########  calculate games per season ##########
    games_per_season = {season: season_rows[season]['stat']['gamesPlayed'] for season in seasons_played}

    ##########  calculate hits per season ##########
    hits_per_season = {season: season_rows[season]['stat']['hits'] for season in seasons_played}

    ##########  calculate hits season cumulative ##########
    hits_season_cumulative = {}
    running_sum = 0

    for key, value in hits_per_season.items():
        running_sum += value
        hits_season_cumulative[key] = running_sum

    # exports
    data = {
        'player_firstName': player_firstName,
        'player_lastName': player_lastName,
        'player_fullName': player_fullName,
        'player_age': player_age,
        'player_birthDate': player_birthDate,
        'player_birthCity': player_birthCity,
        'player_birthCountry': player_birthCountry,
        'player_Position': player_Position,

        'career_mlb_debut': career_mlb_debut,
        'career_mlb_final': career_mlb_final,
        'career_gamesPlayed': career_gamesPlayed,
        'career_atBats': career_atBats,
        'career_hits': career_hits,
        'career_avg': career_avg,
        'career_pace': career_pace,

        'games30_hits': games30_hits,
        'games30_pace': games30_pace,

        'games15_hits': games15_hits,
        'games15_pace': games15_pace,

        'games_30_hits_max': games_30_hits_max,
        'games_30_hits_max_date': games_30_hits_max_date,
        'games_30_hits_max_pace': games_30_hits_max_pace,

        'games_30_hits_min': games_30_hits_min,
        'games_30_hits_min_date': games_30_hits_min_date,
        'games_30_hits_min_pace': games_30_hits_min_pace,
    }

    # add dict
    data['games_per_season'] = games_per_season
    data['hits_per_season'] = hits_per_season
    data['hits_season_cumulative'] = hits_season_cumulative

    # clean accents names
    for key in ['player_firstName','player_lastName','player_fullName','player_birthCity','player_birthCountry']:
        data[key] = unicodedata.normalize('NFKD', data[key]).encode('ascii', 'ignore').decode('ascii')

    return data


def save_local(data: dict) -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    fileName = os.path.join(script_dir, '..', '..', 'site', 'data', 'club', 'stats_'+data['player_lastName']+data['player_firstName']+'.json')
    os.makedirs(os.path.dirname(fileName), exist_ok=True)
    with open(fileName, 'w') as f:
        json.dump(data, f, indent=2)
    return fileName


def save_s3(data: dict, bucket: str) -> None:
    import boto3
    s3 = boto3.client('s3')
    body = json.dumps(data, indent=2).encode('utf-8')
    latest_key = 'stats_'+data['player_lastName']+data['player_firstName']+'.json'
    history_key = 'history/'+date.today().isoformat()+'/'+latest_key
    s3.put_object(Bucket=bucket, Key=latest_key, Body=body, ContentType='application/json')
    s3.put_object(Bucket=bucket, Key=history_key, Body=body, ContentType='application/json')


def main():
    player_id = int(sys.argv[1])
    data = fetch_player_stats(player_id)

    data_bucket = os.environ.get('DATA_BUCKET')
    if data_bucket:
        save_s3(data, data_bucket)
    else:
        save_local(data)


if __name__ == '__main__':
    main()

