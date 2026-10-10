"""
Fetch retired players' career stats. Run by hand; output is committed to git.

    python -m data_processing.jobs.backfill_retired              # retired_3000
    python -m data_processing.jobs.backfill_retired retired_2000
    python -m data_processing.jobs.backfill_retired 116539 110001  # specific IDs
"""
import sys

from data_processing.fetch.player_retired import fetch_retired_player
from data_processing.jobs.common import refresh_players, write_player_index
from data_processing.players import GROUPS


def main(args: list[str]) -> None:
    args = args or ['retired_3000']
    if all(a.isdigit() for a in args):
        player_ids = [int(a) for a in args]
    else:
        player_ids = [i for group in args for i in GROUPS[group]]

    failed = refresh_players(player_ids, fetch_retired_player)
    write_player_index()
    if failed:
        print(f'\nFailed: {failed}')
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
