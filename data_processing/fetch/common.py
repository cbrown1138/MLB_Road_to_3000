"""
Helpers shared by the active and retired player fetchers.
"""
import unicodedata
from datetime import datetime

import statsapi as mlb


def fetch_bio(player_id: int) -> dict:
    """Bio fields, keyed as they appear in every player JSON."""
    person = mlb.get('people', {'personIds': player_id})['people'][0]
    return {
        'player_id': player_id,
        'full_name': person['fullName'],
        'first_name': person['firstName'],
        'last_name': person['lastName'],
        'birth_date': person['birthDate'],
        'birth_city': person.get('birthCity', ''),
        'birth_country': person.get('birthCountry', ''),
        'age': person['currentAge'],
        'position': person['primaryPosition']['abbreviation'],
    }


def ascii_names(data: dict) -> None:
    """Strip accents from name/place fields in place (e.g. José -> Jose)."""
    for key in ['first_name', 'last_name', 'full_name', 'birth_city', 'birth_country']:
        data[key] = unicodedata.normalize('NFKD', data[key]).encode('ascii', 'ignore').decode('ascii')


def whole_years_between(date1: str, date2: str) -> int:
    """Whole years from date1 to date2 (YYYY-MM-DD), most recent as date2."""
    dateformat = '%Y-%m-%d'
    days = (datetime.strptime(date2, dateformat) - datetime.strptime(date1, dateformat)).days
    return int(days / 365.25)


def get_game_log(player_id: int, season) -> list[dict]:
    data = mlb.get('people', {
        'personIds': player_id,
        'hydrate': f'stats(group=[hitting],type=[gameLog],season={season})'
    })
    # seasons with no games (military service, injury, suspension) have no 'stats' key
    stats = data['people'][0].get('stats', [])
    return stats[0]['splits'] if stats else []


def split_stats(hits: int, games: int, pa: int, ab: int) -> dict:
    # shared key set for every split; None when a denominator is 0 (e.g. off-season)
    return {
        'hits': hits,
        'games': games,
        'PA': pa,
        'AB': ab,
        'AVG': hits / ab if ab else None,
        'games_pace': hits / games if games else None,
        'PA_pace': hits / pa if pa else None,
        'AB_pace': hits / ab if ab else None,
    }


def sum_games(games: list[dict]) -> dict:
    # split_stats for a list of game-log splits
    return split_stats(
        hits=sum(g['stat']['hits'] for g in games),
        games=len(games),
        pa=sum(g['stat']['plateAppearances'] for g in games),
        ab=sum(g['stat']['atBats'] for g in games),
    )


def streak_splits(games_newest_first: list[dict]) -> dict:
    """best30games / worst30games splits over rolling 30-game windows, or {} if under 30 games."""
    games = games_newest_first
    if len(games) < 30:
        return {}
    # games are newest-first, so window[0] is the end and window[-1] the start
    rolling = [games[i:i+30] for i in range(len(games) - 29)]
    best = max(rolling, key=lambda w: sum(g['stat']['hits'] for g in w))
    worst = min(rolling, key=lambda w: sum(g['stat']['hits'] for g in w))
    return {
        'best30games': {**sum_games(best), 'start_date': best[-1]['date'], 'end_date': best[0]['date']},
        'worst30games': {**sum_games(worst), 'start_date': worst[-1]['date'], 'end_date': worst[0]['date']},
    }


def flatten_splits(data: dict, splits: dict) -> None:
    # split stats, flattened to <split>_<stat>, e.g. last30games_AB_pace
    for name, stats in splits.items():
        for key, value in stats.items():
            data[f'{name}_{key}'] = value


def cumulative(per_season: dict) -> dict:
    """Running total over a season-ordered dict."""
    out = {}
    running_sum = 0
    for key, value in per_season.items():
        running_sum += value
        out[key] = running_sum
    return out


def age_per_season(seasons, debut_age: int, debut_date: str) -> dict:
    """Age in each season, counting from the debut age in the debut year."""
    out = {}
    running_age = debut_age
    year_prev = int(debut_date[0:4])
    for key in seasons:
        running_age += int(key) - year_prev
        out[key] = running_age
        year_prev = int(key)
    return out
