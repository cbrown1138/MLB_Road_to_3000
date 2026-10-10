"""
Paths, storage keys and dates shared by every job.

Storage keys are relative paths. Locally they resolve under site/data/; in
Lambda (DATA_BUCKET set) they are S3 keys in the data bucket. Both use the
same layout, so CodeBuild can sync the bucket straight into site/data/.
"""
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, 'site', 'data')

# The pipeline runs in UTC (Lambda), but "today" should be the site's local
# date: an evening Central run would otherwise stamp tomorrow's date.
SITE_TZ = ZoneInfo('America/Chicago')

PLAYER_INDEX_KEY = 'players/index.json'
LEAGUE_HITS_KEY = 'league/hits_by_season.json'
QUALIFIED_HITTERS_KEY = 'league/qualified_hitters.json'


def player_key(player_id: int) -> str:
    return f'players/{player_id}.json'


def local_today() -> date:
    return datetime.now(SITE_TZ).date()
