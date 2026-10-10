"""
Fill historic seasons into league/hits_by_season.json. Run by hand; merges
with what's there, so ranges can be run in pieces.

    python -m data_processing.jobs.backfill_league 1901 2025
"""
import sys

from data_processing.config import LEAGUE_HITS_KEY
from data_processing.fetch.league import fetch_hits_by_season, merge_hits_by_season
from data_processing.storage import read_json, write_json


def main(start: int, end: int) -> None:
    new = fetch_hits_by_season(range(start, end + 1))
    print(write_json(LEAGUE_HITS_KEY, merge_hits_by_season(read_json(LEAGUE_HITS_KEY), new)))


if __name__ == '__main__':
    main(int(sys.argv[1]), int(sys.argv[2]))
