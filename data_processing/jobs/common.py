"""
Steps shared by the jobs in this package.
"""
from data_processing.config import PLAYER_INDEX_KEY, player_key
from data_processing.players import GROUPS
from data_processing.storage import write_json


def refresh_players(player_ids, fetch) -> list[dict]:
    """Fetch and write each player; returns failures instead of stopping at the first."""
    failed = []
    for player_id in player_ids:
        try:
            where = write_json(player_key(player_id), fetch(player_id))
            print(f'{player_id} -> {where}')
        except Exception as exc:  # noqa: BLE001 - collect all failures before reporting
            print(f'--- player {player_id} failed: {exc} ---')
            failed.append({'player_id': player_id, 'error': str(exc)})
    return failed


def write_player_index() -> str:
    """players/index.json: which player IDs belong to which group, from players.py."""
    index = {
        group: [{'id': player_id, 'name': name} for player_id, name in ids.items()]
        for group, ids in GROUPS.items()
    }
    return write_json(PLAYER_INDEX_KEY, index)
