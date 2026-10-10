"""
Created on Thu Apr  9 21:54:19 2026

@author: christopherbrown

Get individual MLB player stats for Road to 3000, Retired.
Field names match fetch/player_active.py wherever the stat is the same.
"""
import statsapi as mlb

from data_processing.fetch.common import (
    age_per_season, ascii_names, cumulative, fetch_bio, flatten_splits,
    get_game_log, split_stats, streak_splits, sum_games, whole_years_between,
)


def fetch_retired_player(player_id: int) -> dict:
    ##########  career imports ##########
    career_data = mlb.player_stat_data(player_id, group="hitting", type="career")
    career_mlb_debut = career_data['mlb_debut']
    career_mlb_final = career_data['last_played']
    career_stats = career_data['stats'][0]['stats']

    ##########  bio imports ##########
    bio = fetch_bio(player_id)
    player_age_debut = whole_years_between(bio['birth_date'], career_mlb_debut)

    ##########  season totals ##########
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

    ##########  career games imports ##########
    games_career_data = []
    for each in seasons_played:
        games_career_data.extend(get_game_log(player_id, each))
    games_career_data = sorted(games_career_data, key=lambda g: g['date'], reverse=True)

    ##########  calculate ##########
    splits = {
        'career': split_stats(
            hits=career_stats['hits'],
            games=career_stats['gamesPlayed'],
            pa=career_stats.get('plateAppearances', 0),
            ab=career_stats['atBats'],
        ),
    }
    # game-log stats (last 30/15, streaks) are only meaningful when the logs cover
    # the whole career; otherwise they're left out
    if len(games_career_data) == career_stats['gamesPlayed']:
        splits['last30games'] = sum_games(games_career_data[:30])
        splits['last15games'] = sum_games(games_career_data[:15])
        splits.update(streak_splits(games_career_data))

    hits_per_season = {s: season_rows[s]['stat']['hits'] for s in seasons_played}

    ##########  export ##########
    data = {
        **bio,
        'debut_date': career_mlb_debut,
        'debut_age': player_age_debut,
        'final_date': career_mlb_final,
        'game_logs_complete': 'last30games' in splits,
    }
    flatten_splits(data, splits)

    data['games_per_season'] = {s: season_rows[s]['stat']['gamesPlayed'] for s in seasons_played}
    data['hits_per_season'] = hits_per_season
    data['PA_per_season'] = {s: season_rows[s]['stat'].get('plateAppearances') for s in seasons_played}
    data['AB_per_season'] = {s: season_rows[s]['stat']['atBats'] for s in seasons_played}
    data['hits_season_cumulative'] = cumulative(hits_per_season)
    data['age_per_season'] = age_per_season(hits_per_season, player_age_debut, career_mlb_debut)

    ascii_names(data)
    return data
