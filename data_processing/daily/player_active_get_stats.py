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
# from sklearn.linear_model import LinearRegression
# import numpy as np
# import pandas as pd
# import seaborn as sns
# import matplotlib.pyplot as plt


def fetch_player_stats(player_id: int) -> dict:
    today = date.today()  # noqa: DTZ011
    season = today.year
    season_start_date = str(season)+'-01-01'
    season_end_date = str(season+1)+'-12-31'


    ##########  career imports ##########
    career_data = mlb.player_stat_data(player_id, group="hitting", type="career")
    career_mlb_debut = career_data['mlb_debut']
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



    ##########  season stats imports ##########
    season_data = mlb.player_stat_data(player_id, group="hitting", type="season")
    season_current_team = season_data['current_team']
    season_current_team_id = mlb.lookup_team(season_current_team)[0]['id']

    season_hits = season_data['stats'][0]['stats']['hits']
    season_games_played = season_data['stats'][0]['stats']['gamesPlayed']


    ##########  team schedule imports ##########
    team_schedule = mlb.schedule(team=season_current_team_id, start_date=season_start_date, end_date=season_end_date)
    # regular season only (schedule() also returns spring training/postseason if in range)
    team_schedule = [g['game_date'] for g in team_schedule if g['game_type'] == 'R']
    team_schedule = [datetime.strptime(d, '%Y-%m-%d').date() for d in team_schedule]
    # get potential future game dates for next 60 years
    temp = []
    for each in range(1,59):
        temp.extend([d.replace(year=season+each) for d in team_schedule])
    team_schedule = team_schedule + temp
    team_schedule = sorted(team_schedule)


    ##########  career games imports ##########
    # get all career games
    def get_game_log(season):
        data = mlb.get('people', {
            'personIds': player_id,
            'hydrate': f'stats(group=[hitting],type=[gameLog],season={season})'
        })
        return data['people'][0]['stats'][0]['splits']

    debut_year = int(career_mlb_debut[0:4])
    games_career_data = []
    for each in range(debut_year, season + 1):
        games_career_data.extend(get_game_log(each))
    games_career_data = sorted(games_career_data, key=lambda g: g['date'], reverse=True)

    # get last 30 games, and last 15 games
    games_30_data = games_career_data[:30]
    games_15_data = games_career_data[:15]


    ##########  calculate stats  ##########
    remaining_hits = 3000 - career_hits


    ##########  calculate career ##########
    career_pace =  career_hits / career_gamesPlayed
    career_pace_remaining = round(remaining_hits / career_pace)
    ## get career remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #career_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+career_pace_remaining]


    ##########  calculate season ##########
    season_pace =  season_hits / season_games_played
    season_pace_remaining = round(remaining_hits / season_pace)
    ## get season remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #season_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+season_pace_remaining]


    ##########  calculate 30 game ##########
    games30_hits = sum(g['stat']['hits'] for g in games_30_data)
    games30_pace =  games30_hits / 30
    games30_pace_remaining = round(remaining_hits / games30_pace)
    ## get season remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #games30_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+games30_pace_remaining]


    ##########  calculate 15 game ##########
    games15_hits = sum(g['stat']['hits'] for g in games_15_data)
    games15_pace =  games15_hits / 15
    #games15_pace_remaining = round(remaining_hits / games15_pace)
    ## get season remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #games15_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+games15_pace_remaining]


    ##########  calculate best and worst 30 game streak ##########
    games_count = len(games_career_data)
    rolling = []
    for i in range(1,games_count-30):
        games_in_window = games_career_data[i-1:i+29]
        rolling.append({
            'date': games_career_data[i-1]['date'],
            'hits_rolling_30': sum(g['stat']['hits'] for g in games_in_window)
        })

    best = max(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_max = best['hits_rolling_30']
    games_30_hits_max_pace = games_30_hits_max / 30
    games_30_hits_max_date_end = best['date']
    games_30_hits_max_date_start = games_career_data[rolling.index(best)+30]['date']

    worst = min(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_min = worst['hits_rolling_30']
    games_30_hits_min_pace = games_30_hits_min / 30
    games_30_hits_min_date_end = worst['date']
    games_30_hits_min_date_start = games_career_data[rolling.index(worst)+30]['date']


    ### max
    # games_30_hits_max_pace_remaining = round(remaining_hits / games_30_hits_max_pace)
    ## get season remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #games_30_hits_max_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+games_30_hits_max_pace_remaining]

    ### min
    # games_30_hits_min_pace_remaining = round(remaining_hits / games_30_hits_min_pace)
    ## get season remaining date estimate
    #closest_game = min(team_schedule, key=lambda d: abs(d - today))
    #games_30_hits_min_pace_remaining_date = team_schedule[team_schedule.index(closest_game)+games_30_hits_min_pace_remaining]

    ##########  calculate games per season ##########
    games_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        games_per_season[g_season] = games_per_season.get(g_season, 0) + 1
    games_per_season = dict(reversed(games_per_season.items()))

    ##########  calculate hits per season ##########
    hits_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        hits_per_season[g_season] = sum([g['stat']['hits'] for g in games_career_data if g['season'] == g_season])
    hits_per_season = dict(reversed(hits_per_season.items()))

    ##########  calculate hits season cumulative ##########
    hits_season_cumulative = {}
    running_sum = 0

    for key, value in hits_per_season.items():
        running_sum += value
        hits_season_cumulative[key] = running_sum

# Output: {'a': 10, 'b': 30, 'c': 45, 'd': 50}




    ##########  predict games per season in future ##########



    ##########  calculate current pace ##########
    # rolling = []
    # idx_first = 0
    # idx_last = 50
    # for i in range(1,int(games_count/50)+1):
    #     games_in_window = games_career_data[idx_first:idx_last]
    #     rolling.append({
    #         'date': games_in_window[-1]['date'],
    #         'hits_50': sum(g['stat']['hits'] for g in games_in_window)
    #     })
    #     idx_first = idx_first + 50
    #     idx_last = idx_last + 50



    # # Load, convert to DataFrame, and sort
    # games_50_hits = pd.DataFrame(rolling)

    # games_50_hits = games_50_hits.sort_values('date')
    # games_50_hits.reset_index(inplace=True)
    # games_50_hits['peroid'] = games_50_hits.index


    # # Build the chart
    # plt.figure(figsize=(10, 6))
    # sns.barplot(x='peroid', y='hits_50', data=games_50_hits, color='royalblue')

    # plt.xticks(rotation=45)
    # plt.tight_layout()
    # plt.show()




    # also need to estimate games per season played, that goes into predicive future date
    # maybe just use league avg for games played a season for player age?


    # exports
    data = {
        'today': today.strftime("%B %d, %Y"),
        'season': season,

        'player_firstName': player_firstName,
        'player_lastName': player_lastName,
        'player_fullName': player_fullName,
        'player_age': player_age,
        'player_birthDate': player_birthDate,
        'player_birthCity': player_birthCity,
        'player_birthCountry': player_birthCountry,
        'player_Position': player_Position,

        'remaining_hits': remaining_hits,

        'career_mlb_debut': career_mlb_debut,
        'career_gamesPlayed': career_gamesPlayed,
        'career_atBats': career_atBats,
        'career_hits': career_hits,
        'career_avg': career_avg,
        'career_pace': career_pace,
        'career_pace_remaining': career_pace_remaining,
     #   'career_pace_remaining_date': career_pace_remaining_date.strftime("%B %d, %Y"),

        'season_current_team': season_current_team,
        'season_hits': season_hits,
        'season_games_played': season_games_played,
        'season_pace': season_pace,
        'season_pace_remaining': season_pace_remaining,
     #   'season_pace_remaining_date': season_pace_remaining_date.strftime("%B %d, %Y"),

        'games30_hits': games30_hits,
        'games30_pace': games30_pace,
        'games30_pace_remaining': games30_pace_remaining,
     #   'games30_pace_remaining_date': games30_pace_remaining_date.strftime("%B %d, %Y"),

        'games15_hits': games15_hits,
        'games15_pace': games15_pace,
     #   'games15_pace_remaining': games15_pace_remaining,
     #   'games15_pace_remaining_date': games15_pace_remaining_date.strftime("%B %d, %Y"),

        'games_30_hits_max': games_30_hits_max,
        'games_30_hits_max_date_end': games_30_hits_max_date_end,
        'games_30_hits_max_date_start': games_30_hits_max_date_start,
        'games_30_hits_max_pace': games_30_hits_max_pace,
     #   'games_30_hits_max_pace_remaining_date': games_30_hits_max_pace_remaining_date.strftime("%B %d, %Y"),

        'games_30_hits_min': games_30_hits_min,
        'games_30_hits_min_date_end': games_30_hits_min_date_end,
        'games_30_hits_min_date_start': games_30_hits_min_date_start,
        'games_30_hits_min_pace': games_30_hits_min_pace,
     #   'games_30_hits_min_pace_remaining_date': games_30_hits_min_pace_remaining_date.strftime("%B %d, %Y"),

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
    fileName = os.path.join(script_dir, '..', '..', 'site', 'data', 'active', 'stats_'+data['player_lastName']+data['player_firstName']+'.json')
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

