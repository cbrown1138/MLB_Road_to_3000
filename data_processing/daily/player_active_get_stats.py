"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

Get individual MLB player stats for Road to 3000, 3000 club members

Future will add predictions and season charts by hits and games

"""
import json
import os
import sys
import unicodedata
from datetime import date, datetime
from zoneinfo import ZoneInfo
import statsapi as mlb

# The pipeline runs in UTC (Lambda), but "today" should be the site's local
# date: an evening Central run would otherwise stamp tomorrow's date.
SITE_TZ = ZoneInfo('America/Chicago')

def local_today() -> date:
    return datetime.now(SITE_TZ).date()

def fetch_atBats(game_pks:list[int],player_id:int) -> dict:
    # plate appearances that don't count as an official at-bat
    NON_AB_EVENTS = {
        'walk', 'intent_walk', 'hit_by_pitch',
        'sac_fly', 'sac_bunt', 'sac_fly_double_play', 'sac_bunt_double_play',
        'catcher_interf', 'fielder_interference',
    }
    HIT_EVENTS = {'single', 'double', 'triple', 'home_run'}

    atBats = []
    for game_pk in game_pks:
        try:
            pbp = mlb.get('game_playByPlay', {'gamePk': game_pk})
        except Exception as e:
            print(f"--- game {game_pk} failed: {e} ---")
            continue
        plate_appearances = [
            p for p in pbp['allPlays']
            if p['matchup']['batter']['id'] == player_id
            and p['about'].get('isComplete', True)
        ]

        for p in plate_appearances:
            event = p['result'].get('eventType')
            if event in NON_AB_EVENTS:
                continue
            atBats.append({
                'inning': p['about']['inning'],
                'half': p['about']['halfInning'],
                'pitcher': p['matchup']['pitcher']['fullName'],
                'event': p['result'].get('event'),
                'is_hit': event in HIT_EVENTS,
                'rbi': p['result'].get('rbi', 0),
                'description': p['result'].get('description'),
                'pitches': len([e for e in p['playEvents'] if e.get('isPitch')]),
            })
    return atBats

def fetch_player_stats(player_id: int) -> dict:
    today = local_today()
    season = today.year

    ##########################################################################
    #############  imports ###################################################
    ##########################################################################
    ##########  career imports ##########
    career_data = mlb.player_stat_data(player_id, group="hitting", type="career")
    career_mlb_debut = career_data['mlb_debut']
    career_gamesPlayed = career_data['stats'][0]['stats']['gamesPlayed']
    career_plateApperances = career_data['stats'][0]['stats']['plateAppearances']
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

    # get differnce in years, most recent as date2 
    def getDifYears (date1, date2):
        dateformat = "%Y-%m-%d"
        date1 = datetime.strptime(date1, dateformat)
        date2 = datetime.strptime(date2, dateformat)
        days_difference = (date2 - date1).days
        years_fractional = days_difference / 365.25
        years_whole = int(years_fractional)
        return years_whole
    player_age_debut = getDifYears(player_birthDate, career_mlb_debut)

    ##########  season stats imports ##########
    season_data = mlb.player_stat_data(player_id, group="hitting", type="season")
    season_current_team = season_data['current_team']
    season_hits = season_data['stats'][0]['stats']['hits']
    season_games_played = season_data['stats'][0]['stats']['gamesPlayed']
    season_plateApperances = season_data['stats'][0]['stats']['plateAppearances']
    season_atBats = season_data['stats'][0]['stats']['atBats']

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

    ##########################################################################
    #############  calculate #################################################
    ##########################################################################
    remaining_hits = 3000 - career_hits

    ## career
    career_games_pace =  career_hits / career_gamesPlayed
    career_PA_pace = career_hits / career_plateApperances
    career_AB_pace =  career_hits / career_atBats

    ## season
    season_games_pace =  season_hits / season_games_played
    season_PA_pace = season_hits / season_plateApperances
    season_AB_pace =  season_hits / season_atBats


    # 30 game
    last30games_hits = sum(g['stat']['hits'] for g in games_30_data)
    last30games_PA = sum(g['stat']['plateApperances'] for g in games_30_data)
    last30games_AB = sum(g['stat']['atBats'] for g in games_30_data)
    last30games_AVG = last30games_hits / last30games_AB
    last30games_games_pace =  last30games_hits / 30
    last30games_PA_pace =  last30games_hits / last30games_PA
    last30games_AB_pace =  last30games_hits / last30games_AB

    # 15 game
    last15games_hits = sum(g['stat']['hits'] for g in games_15_data)
    last15games_PA = sum(g['stat']['plateApperances'] for g in games_15_data)
    last15games_AB = sum(g['stat']['atBats'] for g in games_15_data)
    last15games_AVG = last15games_hits / last15games_AB
    last15games_games_pace =  last15games_hits / 15
    last15games_PA_pace =  last15games_hits / last15games_PA
    last15games_AB_pace =  last15games_hits / last15games_AB

    # 120 PA
    # first get most recent gamescovering the last 120 pa
    pa_target = 120
    recent_game_pks = []
    recent_atBats = 0
    for g in games_career_data:
        if recent_atBats >= pa_target:
            break
        recent_game_pks.append(g['game']['gamePk'])
        recent_atBats += g['stat']['plateApperances']
    plateApperances = fetch_atBats(recent_game_pks,player_id)
    plateApperances_120 = plateApperances[0:pa_target]

    last120PA_games_hits = sum(g['stat']['hits'] for g in plateApperances_120)
    last120PA_games_PA = sum(g['stat']['plateApperances'] for g in plateApperances_120)
    last120PA_games_AB = sum(g['stat']['atBats'] for g in plateApperances_120)
    last120PA_games_AVG = last120PA_games_hits / last120PA_games_AB
    last120PA_games_games_pace =  last120PA_games_hits / 15
    last120PA_games_PA_pace =  last120PA_games_hits / last120PA_games_PA
    last120PA_games_AB_pace =  last120PA_games_hits / last120PA_games_AB

        



 


    ##########  calculate best and worst 30 game streak ##########
    games_count = len(games_career_data)
    rolling = []
    # games are newest-first, so window games_career_data[i:i+30] ends at i and starts at i+29
    for i in range(games_count-29):
        games_in_window = games_career_data[i:i+30]
        rolling.append({
            'date_end': games_in_window[0]['date'],
            'date_start': games_in_window[-1]['date'],
            'hits_rolling_30': sum(g['stat']['hits'] for g in games_in_window)
        })

    best = max(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_max = best['hits_rolling_30']
    games_30_hits_max_pace = games_30_hits_max / 30
    games_30_hits_max_date_end = best['date_end']
    games_30_hits_max_date_start = best['date_start']

    worst = min(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_min = worst['hits_rolling_30']
    games_30_hits_min_pace = games_30_hits_min / 30
    games_30_hits_min_date_end = worst['date_end']
    games_30_hits_min_date_start = worst['date_start']

       'best30games_hits': best30games_hits,
        'best30games_start': best30games_start,
        'best30games_end': best30games_end,
        'best30games_games_pace': best30games_games_pace,
        'best30games_PA_pace': best30games_PA_pace,
        'best30games_AB_pace': best30games_AB_pace,

        'worst30games_hits': worst30games_hits,
        'worst30games_start': worst30games_start,
        'worst30games_end': worst30games_end,
        'worst30games_games_pace': worst30games_games_pace,
        'worst30games_PA_pace': worst30games_PA_pace,
        'worst30games_AB_pace': worst30games_AB_pace,
    
    
    



    ######################################
    ######### pace by atBats #############
    ######################################
    # need to import atBats
    # first get most recent gamescovering the last 120 at bats
    ab_target = 120
    recent_game_pks = []
    recent_atBats = 0
    for g in games_career_data:
        if recent_atBats >= ab_target:
            break
        recent_game_pks.append(g['game']['gamePk'])
        recent_atBats += g['stat']['atBats']
    atBats = fetch_atBats(recent_game_pks,player_id)
    atBats_120 = atBats[0:ab_target]



    ##########  calculate 120 atBats ##########
    atBats_120_hits = sum(ab['is_hit'] for ab in atBats_120)
    atBats_120_pace =  atBats_120_hits / len(atBats_120)

    ##########  calculate 15 game ##########
    games15_atBats = sum(g['stat']['atBats'] for g in games_15_data)

    ##########  calculate best and worst 30 game streak ##########
    games_count = len(games_career_data)
    rolling = []
    # games are newest-first, so window games_career_data[i:i+30] ends at i and starts at i+29
    for i in range(games_count-29):
        games_in_window = games_career_data[i:i+30]
        rolling.append({
            'date_end': games_in_window[0]['date'],
            'date_start': games_in_window[-1]['date'],
            'hits_rolling_30': sum(g['stat']['hits'] for g in games_in_window)
        })

    best = max(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_max = best['hits_rolling_30']
    games_30_hits_max_pace = games_30_hits_max / 30
    games_30_hits_max_date_end = best['date_end']
    games_30_hits_max_date_start = best['date_start']

    worst = min(rolling, key=lambda r: r['hits_rolling_30'])
    games_30_hits_min = worst['hits_rolling_30']
    games_30_hits_min_pace = games_30_hits_min / 30
    games_30_hits_min_date_end = worst['date_end']
    games_30_hits_min_date_start = worst['date_start']




    
    ##########################################################################
    #############  calculate dicts ###########################################
    ##########################################################################
    ##########  calculate games per season ##########
    games_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        games_per_season[g_season] = games_per_season.get(g_season, 0) + 1
    games_per_season = dict(reversed(games_per_season.items()))

    #  calculate hits per season
    hits_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        hits_per_season[g_season] = sum([g['stat']['hits'] for g in games_career_data if g['season'] == g_season])
    hits_per_season = dict(reversed(hits_per_season.items()))

    #  calculate PA per season
    pa_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        pa_per_season[g_season] = sum([g['stat']['plateApperances'] for g in games_career_data if g['season'] == g_season])
    pa_per_season = dict(reversed(pa_per_season.items()))

    #  calculate at-bats per season
    ab_per_season = {}
    for g in games_career_data:
        g_season = g['season']
        ab_per_season[g_season] = sum([g['stat']['atBats'] for g in games_career_data if g['season'] == g_season])
    ab_per_season = dict(reversed(ab_per_season.items()))

    #  calculate hits season cumulative
    hits_season_cumulative = {}
    running_sum = 0
    for key, value in hits_per_season.items():
        running_sum += value
        hits_season_cumulative[key] = running_sum

    #  calculate age per season
    age_per_season = {}
    running_sum_age = player_age_debut
    year_prev = int(career_mlb_debut[0:4])
    for key, value in hits_per_season.items():
        key_int = int(key)
        yrDiff = key_int - year_prev
        running_sum_age += yrDiff
        age_per_season[key] = running_sum_age
        year_prev = key_int


    ##########################################################################
    #############  export ####################################################
    ##########################################################################
    # exports
    data = {
        'today': today.strftime("%B %d, %Y"),
        'season': season,

        # bio
        'player_id': player_id,
        'full_name': player_fullName,
        'first_ame': player_firstName,
        'last_name': player_lastName,
        'birth_date': player_birthDate,
        'birth_city': player_birthCity,
        'birth_country': player_birthCountry,
        'age': player_age,
        'position': player_Position,

        'debut_date': career_mlb_debut,
        'debut_age': player_age_debut,
        'current_team': season_current_team,
        'remaining_hits': remaining_hits,

        # career / overall stats
        'career_hits': career_hits,
        'career_AVG': career_avg,
        'career_games': career_gamesPlayed,
        'career_games_pace': career_games_pace,
        'career_PA': career_plateApperances,
        'career_PA_pace': career_PA_pace,
        'career_AB': career_atBats,
        'career_AB_pace': career_AB_pace,

        'season_hits': season_hits,
        'season_AVG': season_a,
        'season_games': season_games_played,
        'season_games_pace': season_games_pace,
        'season_PA': season_plateApperances,
        'season_PA_pace': season_PA_pace,
        'season_AB': season_atBats,
        'season_AB_pace': season_AB_pace,

        'last30games_hits': last30games_hits,
        'last30games_AVG': last30games_AVG,
        'last30games_games_pace': last30games_games_pace,
        'last30games_PA': last30games_PA,
        'last30games_PA_pace': last30games_PA_pace,
        'last30games_AB': last30games_AB,
        'last30games_AB_pace': last30games_AB_pace,
        
        'last15games_hits': last15games_hits,
        'last15games_AVG': last15games_AVG,
        'last15games_games_pace': last15games_games_pace,
        'last15games_PA': last15games_PA,
        'last15games_PA_pace': last15games_PA_pace,
        'last15games_AB': last15games_AB,
        'last15games_AB_pace': last15games_AB_pace,

        'last120PA_hits': last120PA_hits,
        'last120PA_AVG': last120PA_AVG,
        'last120PA_game': last120PA_game,
        'last120PA_games_pace': last120PA_games_pace,
        'last120PA_PA': last120PA_PA,
        'last120PA_PA_pace': last120PA_PA_pace,
        'last120PA_AB': last120PA_AB,
        'last120PA_AB_pace': last120PA_AB_pace,

        'best30games_hits': best30games_hits,
        'best30games_start': best30games_start,
        'best30games_end': best30games_end,
        'best30games_games_pace': best30games_games_pace,
        'best30games_PA_pace': best30games_PA_pace,
        'best30games_AB_pace': best30games_AB_pace,

        'worst30games_hits': worst30games_hits,
        'worst30games_start': worst30games_start,
        'worst30games_end': worst30games_end,
        'worst30games_games_pace': worst30games_games_pace,
        'worst30games_PA_pace': worst30games_PA_pace,
        'worst30games_AB_pace': worst30games_AB_pace,
    }

    # add dict
    data['games_per_season'] = games_per_season
    data['hits_per_season'] = hits_per_season
    data['PA_per_season'] = pa_per_season
    data['AB_per_season'] = ab_per_season
    data['hits_season_cumulative'] = hits_season_cumulative
    data['age_per_season'] = age_per_season
    
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
    history_key = 'history/'+local_today().isoformat()+'/'+latest_key
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

