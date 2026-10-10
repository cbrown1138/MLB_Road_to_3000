"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

Get individual MLB player stats for Road to 3000, Active
"""
import statsapi as mlb

from data_processing.config import local_today
from data_processing.fetch.common import (
    age_per_season, ascii_names, cumulative, fetch_bio, flatten_splits,
    get_game_log, split_stats, streak_splits, sum_games, whole_years_between,
)


def fetch_plate_appearances(game_pks: list[int], player_id: int) -> list[dict]:
    # plate appearances that don't count as an official at-bat
    NON_AB_EVENTS = {
        'walk', 'intent_walk', 'hit_by_pitch',
        'sac_fly', 'sac_bunt', 'sac_fly_double_play', 'sac_bunt_double_play',
        'catcher_interf', 'fielder_interference',
    }
    HIT_EVENTS = {'single', 'double', 'triple', 'home_run'}

    # game_pks are newest-first; plays within a game stay in order
    plate_appearances = []
    for game_pk in game_pks:
        try:
            pbp = mlb.get('game_playByPlay', {'gamePk': game_pk})
        except Exception as e:
            print(f"--- game {game_pk} failed: {e} ---")
            continue
        game_pas = [
            p for p in pbp['allPlays']
            if p['matchup']['batter']['id'] == player_id
            and p['about'].get('isComplete', True)
        ]

        for p in game_pas:
            event = p['result'].get('eventType')
            plate_appearances.append({
                'game_pk': game_pk,
                'inning': p['about']['inning'],
                'half': p['about']['halfInning'],
                'pitcher': p['matchup']['pitcher']['fullName'],
                'event': p['result'].get('event'),
                'is_ab': event not in NON_AB_EVENTS,
                'is_hit': event in HIT_EVENTS,
                'rbi': p['result'].get('rbi', 0),
                'description': p['result'].get('description'),
                'pitches': len([e for e in p['playEvents'] if e.get('isPitch')]),
            })
    return plate_appearances


def fetch_active_player(player_id: int) -> dict:
    today = local_today()
    season = today.year

    ##########################################################################
    #############  imports ###################################################
    ##########################################################################
    ##########  career imports ##########
    career_data = mlb.player_stat_data(player_id, group="hitting", type="career")
    career_mlb_debut = career_data['mlb_debut']
    career_stats = career_data['stats'][0]['stats']
    career_hits = career_stats['hits']

    ##########  bio imports ##########
    bio = fetch_bio(player_id)
    player_age_debut = whole_years_between(bio['birth_date'], career_mlb_debut)

    ##########  season stats imports ##########
    season_data = mlb.player_stat_data(player_id, group="hitting", type="season")
    season_current_team = season_data['current_team']
    # no season splits before Opening Day
    season_stats = season_data['stats'][0]['stats'] if season_data['stats'] else {}

    ##########  career games imports ##########
    debut_year = int(career_mlb_debut[0:4])
    games_career_data = []
    for each in range(debut_year, season + 1):
        games_career_data.extend(get_game_log(player_id, each))
    games_career_data = sorted(games_career_data, key=lambda g: g['date'], reverse=True)

    ##########  get windows  ##########
    # last 120 PA: collect whole games until they cover the target, then trim to exactly 120
    PA_target = 120
    recent_game_pks = []
    recent_PA = 0
    for g in games_career_data:
        if recent_PA >= PA_target:
            break
        recent_game_pks.append(g['game']['gamePk'])
        recent_PA += g['stat']['plateAppearances']
    PA_120 = fetch_plate_appearances(recent_game_pks, player_id)[:PA_target]


    ##########################################################################
    #############  calculate #################################################
    ##########################################################################
    remaining_hits = 3000 - career_hits

    splits = {
        'career': split_stats(
            hits=career_stats['hits'],
            games=career_stats['gamesPlayed'],
            pa=career_stats['plateAppearances'],
            ab=career_stats['atBats'],
        ),
        'season': split_stats(
            hits=season_stats.get('hits', 0),
            games=season_stats.get('gamesPlayed', 0),
            pa=season_stats.get('plateAppearances', 0),
            ab=season_stats.get('atBats', 0),
        ),
        'last30games': sum_games(games_career_data[:30]),
        'last15games': sum_games(games_career_data[:15]),
        'last120PA': split_stats(
            hits=sum(p['is_hit'] for p in PA_120),
            games=len({p['game_pk'] for p in PA_120}),
            pa=len(PA_120),
            ab=sum(p['is_ab'] for p in PA_120),
        ),
        **streak_splits(games_career_data),
    }


    ##########################################################################
    #############  calculate dicts ###########################################
    ##########################################################################
    ##########  calculate per season ##########
    per_season = {}
    for g in games_career_data:
        s = per_season.setdefault(g['season'], {'games': 0, 'hits': 0, 'PA': 0, 'AB': 0})
        s['games'] += 1
        s['hits']  += g['stat']['hits']
        s['PA']    += g['stat']['plateAppearances']
        s['AB']    += g['stat']['atBats']
    # games are newest-first, so sort seasons oldest-first for the cumulative/age running sums
    per_season = dict(sorted(per_season.items(), key=lambda kv: int(kv[0])))

    hits_per_season = {k: v['hits'] for k, v in per_season.items()}


    ##########################################################################
    #############  export ####################################################
    ##########################################################################
    data = {
        'today': today.strftime("%B %d, %Y"),
        'season': season,
        **bio,
        'debut_date': career_mlb_debut,
        'debut_age': player_age_debut,
        'current_team': season_current_team,
        'remaining_hits': remaining_hits,
    }
    flatten_splits(data, splits)

    data['games_per_season'] = {k: v['games'] for k, v in per_season.items()}
    data['hits_per_season'] = hits_per_season
    data['PA_per_season'] = {k: v['PA'] for k, v in per_season.items()}
    data['AB_per_season'] = {k: v['AB'] for k, v in per_season.items()}
    data['hits_season_cumulative'] = cumulative(hits_per_season)
    data['age_per_season'] = age_per_season(hits_per_season, player_age_debut, career_mlb_debut)

    ascii_names(data)
    return data
