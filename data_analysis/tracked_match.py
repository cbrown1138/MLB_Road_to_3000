"""
Find the 3,000-hit club members whose careers best match a tracked player's
so far, and project the tracked player's path from each match's later career.

    python -m data_analysis.tracked_match 514888
    python -m data_analysis.tracked_match altuve --top 5 --align season
    python -m data_analysis.tracked_match --all
    python -m data_analysis.tracked_match 116539 --as-of-age 30   # backtest Jeter

Trajectories are cumulative hits keyed by age (or career season number).
Seasons played on a short schedule are scaled up to their era's full length
so strike years, 2020 and the 19th century don't skew the comparison.
"""
import argparse
import math
import statistics
import sys
import unicodedata

from data_processing.config import player_key
from data_processing.players import RETIRED_3000, TRACKED
from data_processing.storage import read_json, write_json

TARGET_HITS = 3000

# Games on the schedule in seasons shorter than their era's norm.
# Pre-1904 values are the NL schedule, which most early club members played.
SHORT_SCHEDULES = {
    1876: 70, 1877: 60, 1878: 60, 1879: 84, 1880: 84, 1881: 84, 1882: 84,
    1883: 98, 1884: 112, 1885: 112, 1886: 124, 1887: 128, 1888: 136,
    1889: 136, 1890: 136, 1891: 140, 1893: 132, 1894: 132, 1895: 132,
    1896: 132, 1897: 132, 1900: 140, 1901: 140, 1902: 140, 1903: 140,
    1918: 128, 1919: 140, 1981: 107, 1994: 115, 1995: 144, 2020: 60,
}

# How much each similarity component counts. Each component is divided by its
# spread across the club first, so these are relative importances.
WEIGHTS = {
    'trajectory': 1.0,   # recency-weighted RMSE of cumulative hits
    'hits_now': 0.5,     # cumulative hits at the current age
    'pace': 0.5,         # mean hits over the last PACE_SEASONS
    'debut_age': 0.25,
}
PACE_SEASONS = 3
MIN_SHARED = 3


def full_schedule(year: int) -> int:
    return 162 if year >= 1961 else 154


def season_factor(year: int) -> float:
    return full_schedule(year) / SHORT_SCHEDULES.get(year, full_schedule(year))


def load_player(player_id: int) -> dict:
    data = read_json(player_key(player_id))
    if data is None:
        raise SystemExit(f'No data for player {player_id} ({player_key(player_id)})')
    return data


def build_seasons(player: dict, align: str, adjust: bool, exclude_year: int | None = None) -> dict[int, float]:
    """Hits per alignment key (age or career season number), merging seasons
    that share an age and filling gaps with zero-hit seasons."""
    hits = {}
    years = sorted(int(y) for y in player['hits_per_season'] if int(y) != exclude_year)
    for n, year in enumerate(years, start=1):
        key = player['age_per_season'][str(year)] if align == 'age' else n
        h = player['hits_per_season'][str(year)] * (season_factor(year) if adjust else 1)
        hits[key] = hits.get(key, 0) + h
    if hits:
        for key in range(min(hits), max(hits) + 1):
            hits.setdefault(key, 0)
    return hits


def cumulative(seasons: dict[int, float], key: int) -> float:
    return sum(h for k, h in seasons.items() if k <= key)


def similarity_parts(tracked: dict[int, float], member: dict[int, float], upto: int, half_life: float) -> dict | None:
    """Raw (unscaled) distance components, or None if too little overlap."""
    start = min(tracked)
    shared = [k for k in range(start, upto + 1) if k in member]
    if len(shared) < MIN_SHARED:
        return None

    num = den = 0.0
    for k in range(start, upto + 1):
        w = 0.5 ** ((upto - k) / half_life)
        num += w * (cumulative(tracked, k) - cumulative(member, k)) ** 2
        den += w
    pace_keys = range(upto - PACE_SEASONS + 1, upto + 1)
    return {
        'trajectory': math.sqrt(num / den),
        'hits_now': abs(cumulative(tracked, upto) - cumulative(member, upto)),
        'pace': abs(statistics.mean(tracked.get(k, 0) for k in pace_keys)
                    - statistics.mean(member.get(k, 0) for k in pace_keys)),
        'debut_age': abs(start - min(member)),
    }


def project(career_hits: float, member: dict[int, float], upto: int) -> dict:
    """Add the member's hits after `upto` to the tracked player's total."""
    total, reached = career_hits, None
    for k in sorted(k for k in member if k > upto):
        total += member[k]
        if reached is None and total >= TARGET_HITS:
            reached = k
    if career_hits >= TARGET_HITS:
        reached = upto
    return {'final_hits': round(total), 'reaches_3000_at': reached}


def rank_matches(player: dict, args) -> dict:
    exclude_year = player.get('season') if args.exclude_current else None
    tracked = build_seasons(player, args.align, args.adjust, exclude_year)
    if args.as_of_age is not None:
        # backtest: cut the career off at an age (age keys only)
        if args.align != 'age':
            raise SystemExit('--as-of-age needs --align age')
        tracked = {k: h for k, h in tracked.items() if k <= args.as_of_age}
        if not tracked:
            raise SystemExit(f'{player["full_name"]} has no seasons through age {args.as_of_age}')
    upto = max(tracked)
    # projection starts from real hits; only the member's future is adjusted
    if args.as_of_age is not None or exclude_year is not None:
        career_hits = cumulative(build_seasons(player, args.align, False, exclude_year), upto)
    else:
        career_hits = player['career_hits']

    rows = []
    for pid, name in RETIRED_3000.items():
        if args.exclude_self and pid == player['player_id']:
            continue
        member_data = load_player(pid)
        member = build_seasons(member_data, args.align, args.adjust)
        parts = similarity_parts(tracked, member, upto, args.recency)
        if parts is None:
            continue
        rows.append({
            'player_id': pid,
            'name': name,
            'parts': parts,
            'member_hits_now': round(cumulative(member, upto)),
            'logs_complete': member_data.get('game_logs_complete', True),
            **project(career_hits, member, upto),
        })

    # scale each component by its spread across the club so weights compare
    for part, weight in WEIGHTS.items():
        values = [r['parts'][part] for r in rows]
        spread = statistics.pstdev(values) or 1
        for r in rows:
            r['score'] = r.get('score', 0) + weight * r['parts'][part] / spread
    rows.sort(key=lambda r: r['score'])

    last_year = max(int(y) for y in player['hits_per_season'] if int(y) != exclude_year)
    if args.as_of_age is not None:
        last_year = min(int(y) for y, a in player['age_per_season'].items() if a == upto)
    top = rows[:args.top]
    for r in top:
        r['score'] = round(r['score'], 3)
        r['parts'] = {k: round(v, 2) for k, v in r['parts'].items()}
        at = r['reaches_3000_at']
        r['reaches_3000_year'] = None if at is None else last_year + (at - upto)

    reached = [r['reaches_3000_at'] for r in top if r['reaches_3000_at'] is not None]
    return {
        'player_id': player['player_id'],
        'name': player['full_name'],
        'align': args.align,
        'as_of': upto,
        'as_of_year': last_year,
        'career_hits': round(career_hits),
        'tracked_hits_now': round(cumulative(tracked, upto)),
        'matches': top,
        'summary': {
            'share_reaching_3000': len(reached) / len(top) if top else 0,
            'median_3000_at': statistics.median(reached) if reached else None,
            'median_final_hits': statistics.median(r['final_hits'] for r in top) if top else None,
        },
    }


def print_result(result: dict) -> None:
    unit = 'age' if result['align'] == 'age' else 'season #'
    print(f"\n{result['name']} — {result['career_hits']} hits through {unit} {result['as_of']} "
          f"({result['as_of_year']}); adjusted cumulative {result['tracked_hits_now']}")
    print(f"{'#':>2}  {'Match':<22}{'Score':>7}{'Hits@' + str(result['as_of']):>9}"
          f"{'3000 at':>9}{'Year':>6}{'Final':>7}")
    for i, r in enumerate(result['matches'], start=1):
        at = r['reaches_3000_at']
        name = r['name'] + ('' if r['logs_complete'] else '*')
        print(f"{i:>2}  {name:<22}{r['score']:>7.2f}{r['member_hits_now']:>9}"
              f"{'—' if at is None else at:>9}{r['reaches_3000_year'] or '—':>6}{r['final_hits']:>7}")
    s = result['summary']
    print(f"Top {len(result['matches'])}: {s['share_reaching_3000']:.0%} reach 3,000"
          + (f", median {unit} {s['median_3000_at']}" if s['median_3000_at'] is not None else '')
          + f"; median final hits {s['median_final_hits']}")
    if any(not r['logs_complete'] for r in result['matches']):
        print('* game logs incomplete (season totals are still complete)')


def resolve_player(query: str) -> int:
    if query.isdigit():
        return int(query)

    def fold(s):
        return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    hits = [pid for pid, name in {**TRACKED, **RETIRED_3000}.items() if fold(query) in fold(name)]
    if len(hits) != 1:
        raise SystemExit(f'"{query}" matched {len(hits)} players; use an ID')
    return hits[0]


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('player', nargs='?', help='MLBAM ID or part of a tracked/club name')
    parser.add_argument('--all', action='store_true', help='run every tracked player')
    parser.add_argument('--top', type=int, default=5)
    parser.add_argument('--align', choices=['age', 'season'], default='age')
    parser.add_argument('--recency', type=float, default=4, help='half-life in seasons for trajectory weights')
    parser.add_argument('--no-adjust', dest='adjust', action='store_false', help="don't scale short seasons")
    parser.add_argument('--exclude-current', action='store_true', help='drop the in-progress season')
    parser.add_argument('--as-of-age', type=int, help='backtest: cut the career off at this age')
    parser.add_argument('--exclude-self', action='store_true', help='skip the player when they are a club member')
    parser.add_argument('--write', action='store_true', help='save to analysis/matches/<id>.json')
    args = parser.parse_args(argv)

    if args.all:
        ids = list(TRACKED)
    elif args.player:
        ids = [resolve_player(args.player)]
    else:
        parser.error('give a player or --all')

    for pid in ids:
        result = rank_matches(load_player(pid), args)
        print_result(result)
        if args.write:
            print(f"wrote {write_json(f'analysis/matches/{pid}.json', result)}")


if __name__ == '__main__':
    main(sys.argv[1:])
