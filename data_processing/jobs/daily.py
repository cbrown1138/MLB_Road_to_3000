"""
Daily refresh, run by lambda_handler.py (or locally with
`python -m data_processing.jobs.daily`): every tracked active player, the
current season's league hits, and the player index.
"""
import sys

from data_processing.config import LEAGUE_HITS_KEY, local_today
from data_processing.fetch.league import fetch_hits_by_season, merge_hits_by_season
from data_processing.fetch.player_active import fetch_active_player
from data_processing.jobs.common import refresh_players, write_player_index
from data_processing.players import TRACKED
from data_processing.storage import read_json, write_json


def run() -> list[dict]:
    """Returns the failures; an empty list means everything refreshed."""
    failed = refresh_players(TRACKED, fetch_active_player)

    try:
        # merges into the existing file, which holds every earlier season
        new = fetch_hits_by_season([local_today().year])
        write_json(LEAGUE_HITS_KEY, merge_hits_by_season(read_json(LEAGUE_HITS_KEY), new))
    except Exception as exc:  # noqa: BLE001
        failed.append({'task': 'league', 'error': str(exc)})

    write_player_index()
    return failed


if __name__ == '__main__':
    failures = run()
    if failures:
        print(f'\nFailed: {failures}')
        sys.exit(1)
