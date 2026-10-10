"""
This season's qualified hitters: writes the list to league/qualified_hitters.json,
then (with --players) fetches each one's stats into players/. Run by hand.

    python -m data_processing.jobs.backfill_qualified [--players] [season]
"""
import sys

from data_processing.config import QUALIFIED_HITTERS_KEY, local_today
from data_processing.fetch.league import fetch_qualified_hitters
from data_processing.fetch.player_active import fetch_active_player
from data_processing.jobs.common import refresh_players
from data_processing.storage import write_json


def main(args: list[str]) -> None:
    with_players = '--players' in args
    seasons = [int(a) for a in args if a.isdigit()]
    season = seasons[0] if seasons else local_today().year

    hitters = fetch_qualified_hitters(season)
    print(f'{len(hitters)} qualified hitters -> {write_json(QUALIFIED_HITTERS_KEY, hitters)}')

    if with_players:
        failed = refresh_players([h['id'] for h in hitters], fetch_active_player)
        if failed:
            print(f'\nFailed: {failed}')
            sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
